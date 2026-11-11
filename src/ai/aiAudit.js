// =====================================================================
// AI 审计（B3）
// - 每次 AI 调用写入 db.aiEvents（独立只读审计集合，AI_ARCHITECTURE §6）
// - 仅记录摘要：不记录完整敏感原文、密码、token
// - 允许的写入口只有 aiEvents 审计集合本身：
//     db.recordAiEvent() / db.markAiEventAccepted()
//   业务数据写函数一律不可用（G1，静态断言见 tests/data/suite.js）
// =====================================================================
const db = require('../mock/db')
const guardrails = require('./guardrails')

function safeStringify(value) {
  try {
    return JSON.stringify(guardrails.stripSensitive(value))
  } catch (e) {
    return '"[unserializable]"'
  }
}

/**
 * 写入一条 AI 审计事件
 * entry: { task, provider, actor, input, text, confidence, latencyMs, accepted, error }
 */
function record(entry) {
  const e = entry || {}
  const actor = e.actor || {}
  const inputSummary = guardrails.summarize(safeStringify(e.input || {}), 200)
  const outputSummary = guardrails.summarize(e.text || '', 300)
  return db.recordAiEvent({
    actorStaffId: actor.id || actor.staffId || '',
    actorName: actor.name || actor.staffName || '系统',
    actorRole: actor.role || actor.roleName || '',
    task: e.task || '',
    provider: e.provider || '',
    inputSummary: inputSummary,
    outputSummary: outputSummary,
    confidence: typeof e.confidence === 'number' ? e.confidence : 0,
    latencyMs: Number(e.latencyMs) || 0,
    accepted: !!e.accepted,
    error: guardrails.summarize(e.error || '', 200)
  })
}

function markAccepted(id) {
  return db.markAiEventAccepted(id)
}

function list(opts) {
  return db.queryAiEvents(opts || {})
}

function stats() {
  return db.aiEventStats()
}

module.exports = { record, markAccepted, list, stats }
