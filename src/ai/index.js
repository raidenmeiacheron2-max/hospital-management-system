// =====================================================================
// AI 服务编排层（B3）
// 调用链：UI → ai.runTask(task, input, {actor})
//   → 开关检查（G6）→ 任务查找 → 只读上下文构建（脱敏/G5）
//   → Provider 生成 → 输出结构校验（G2，失败回退"无建议"）
//   → 免责声明注入（G3）→ AI 审计写入 aiEvents → 返回结果
// 红线：本层不持有业务数据引用、不调用任何业务写函数、不 persist 业务数据。
// 说明：Mock.js 拦截层无法 await，本地引擎（默认）走同步链路；
//       外部异步 Provider 仅保留骨架（默认禁用），需真实后端/代理。
// =====================================================================
const config = require('./config')
const registry = require('./taskRegistry')
const providerRegistry = require('./provider')
const contextBuilder = require('./contextBuilder')
const guardrails = require('./guardrails')
const aiAudit = require('./aiAudit')
const db = require('../mock/db')

// 注册 Provider 与内置任务（任务文件只导出定义，由 tasks/index.js 统一注册）
require('./localProvider')
require('./httpProvider')
require('./tasks')

function fail(code, error) {
  return { ok: false, code: code, error: error }
}

/**
 * 执行一个 AI 任务（同步链路）
 * @param {string} taskName 任务名（如 assistant.qa）
 * @param {object} input 任务输入（会被脱敏后写入审计摘要）
 * @param {object} options { actor }
 * @returns {{ok:boolean, code?:string, error?:string, task?:string, provider?:string, data?:object, meta?:object}}
 */
function runTask(taskName, input, options) {
  const startedAt = Date.now()
  const opts = options || {}
  const cfg = config.getConfig()

  // G6：关闭时提前返回，不构建上下文、不写审计（零副作用）
  if (!cfg.enabled) {
    return fail('AI_DISABLED', 'AI 功能已关闭（演示开关），本次未产生任何调用与副作用')
  }

  const task = registry.getTask(taskName)
  if (!task) {
    return fail('AI_TASK_NOT_FOUND', '未注册的 AI 任务：' + taskName)
  }

  const actor = opts.actor || db.getCurrentActor()
  const provider = providerRegistry.getProvider(cfg.provider) || providerRegistry.getProvider('local-rule-engine')

  let context
  try {
    context = contextBuilder.build(task, input, actor)
  } catch (e) {
    return fail('AI_CONTEXT_ERROR', 'AI 上下文构建失败：' + (e && e.message ? e.message : e))
  }

  let raw
  try {
    raw = provider.generate(task, context, input || {}, opts)
  } catch (e) {
    const message = e && e.message ? e.message : String(e)
    aiAudit.record({
      task: task.name,
      provider: provider.name,
      actor: actor,
      input: input || {},
      text: '',
      confidence: 0,
      latencyMs: Date.now() - startedAt,
      error: message
    })
    return fail('AI_PROVIDER_ERROR', message)
  }

  if (raw && typeof raw.then === 'function') {
    return fail('AI_ASYNC_UNSUPPORTED', '当前 Mock 同步链路不支持异步 Provider（外部 LLM 仅保留骨架）')
  }

  // G2：结构校验；失败回退"无建议"
  const checked = guardrails.validateSchema(raw.data, task.outputSchema)
  const data = checked.ok ? raw.data : guardrails.fallbackOutput(task, checked.errors)

  // G3：免责声明强制注入
  data.disclaimers = guardrails.ensureDisclaimers(data.disclaimers || raw.disclaimers, task.disclaimers)

  const latencyMs = Date.now() - startedAt
  const result = {
    ok: true,
    task: task.name,
    provider: provider.name,
    data: data,
    meta: {
      confidence: typeof raw.confidence === 'number' ? raw.confidence : 0,
      basis: Array.isArray(raw.basis) ? raw.basis : [],
      fallback: !checked.ok,
      schemaErrors: checked.errors,
      latencyMs: latencyMs,
      readOnly: true,
      generatedAt: new Date().toISOString()
    }
  }

  const ev = aiAudit.record({
    task: task.name,
    provider: provider.name,
    actor: actor,
    input: input || {},
    text: raw.text || (data && (data.summary || data.answer)) || '',
    confidence: result.meta.confidence,
    latencyMs: latencyMs
  })
  result.meta.audited = !!(ev && ev.ok)
  result.meta.eventId = ev && ev.ok ? ev.data.id : ''
  return result
}

function listTasks() {
  return registry.listTasks()
}

function getTask(name) {
  return registry.getTask(name)
}

function describeConfig() {
  return config.describe()
}

function applyConfig(patch) {
  return config.applyRuntime(patch)
}

function resetConfig() {
  return config.resetRuntime()
}

function markAccepted(eventId) {
  return aiAudit.markAccepted(eventId)
}

function listEvents(opts) {
  return aiAudit.list(opts)
}

function eventStats() {
  return aiAudit.stats()
}

function listProviders() {
  return providerRegistry.listProviders()
}

module.exports = {
  runTask,
  listTasks,
  getTask,
  describeConfig,
  applyConfig,
  resetConfig,
  markAccepted,
  listEvents,
  eventStats,
  listProviders,
  // 便于测试/治理页只读展示
  guardrails: guardrails,
  selectors: require('./selectors')
}
