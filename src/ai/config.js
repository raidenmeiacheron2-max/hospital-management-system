// =====================================================================
// AI 配置（B3）
// - 默认：本地确定性引擎（local）、零外部网络、零密钥
// - 环境变量：VUE_APP_AI_ENABLED / VUE_APP_AI_PROVIDER / VUE_APP_AI_ENDPOINT
// - 运行时开关：仅覆盖 enabled / provider，保存在 localStorage 的「非业务偏好」键
// - 本文件永不读取、保存或返回任何密钥；endpoint 仅来自构建环境变量
// - CommonJS：可被纯 Node 测试直接 require（与 src/mock/db.js 一致）
// =====================================================================
const PREFS_KEY = 'astra_ai_prefs'
const PROVIDERS = ['local', 'http-llm']

function readEnv(name, fallback) {
  try {
    if (typeof process !== 'undefined' && process.env && process.env[name] !== undefined) {
      return process.env[name]
    }
  } catch (e) {
    /* noop */
  }
  return fallback
}

function readPrefs() {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(PREFS_KEY)
      if (!raw) return {}
      const parsed = JSON.parse(raw)
      return parsed && typeof parsed === 'object' ? parsed : {}
    }
  } catch (e) {
    /* noop */
  }
  return {}
}

function writePrefs(prefs) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
      return true
    }
  } catch (e) {
    /* noop */
  }
  return false
}

/** 归一化后的完整配置（不含密钥） */
function getConfig() {
  const prefs = readPrefs()
  const enabledEnv = String(readEnv('VUE_APP_AI_ENABLED', 'true')).toLowerCase() !== 'false'
  const providerEnv = String(readEnv('VUE_APP_AI_PROVIDER', 'local')).toLowerCase()
  const endpointEnv = String(readEnv('VUE_APP_AI_ENDPOINT', '') || '')
  const provider = prefs.provider && PROVIDERS.indexOf(prefs.provider) !== -1 ? prefs.provider : providerEnv === 'http-llm' ? 'http-llm' : 'local'
  return {
    enabled: prefs.enabled === undefined ? enabledEnv : !!prefs.enabled,
    provider: provider,
    endpoint: provider === 'http-llm' ? endpointEnv : '',
    endpointConfigured: !!endpointEnv,
    keyConfigured: false,
    runtimeOverride: prefs.enabled !== undefined || !!prefs.provider,
    prefsKey: PREFS_KEY,
    providers: PROVIDERS.slice()
  }
}

function isEnabled() {
  return getConfig().enabled
}

function providerName() {
  return getConfig().provider
}

/** 对外展示用配置摘要（永不含密钥/完整 endpoint） */
function describe() {
  const c = getConfig()
  return {
    enabled: c.enabled,
    provider: c.provider,
    providerLabel: c.provider === 'http-llm' ? '外部 LLM（骨架，默认禁用）' : '本地确定性规则引擎',
    mode: c.provider === 'http-llm' ? 'http-llm' : 'local-deterministic',
    endpointConfigured: c.endpointConfigured,
    keyConfigured: false,
    runtimeOverride: c.runtimeOverride,
    zeroNetwork: c.provider === 'local',
    notes: [
      '默认使用本地确定性引擎，零外部网络、零密钥。',
      'AI 只读：不调用任何业务写函数，不修改业务数据。',
      '外部 Provider 仅保留骨架，需自行配置 endpoint，且密钥不得写入仓库。'
    ]
  }
}

/** 运行时开关（仅 enabled / provider；不涉及任何业务数据） */
function applyRuntime(patch) {
  const p = patch || {}
  const prefs = readPrefs()
  if (p.enabled !== undefined) prefs.enabled = !!p.enabled
  if (p.provider !== undefined) {
    const next = String(p.provider)
    if (PROVIDERS.indexOf(next) === -1) return { ok: false, error: '不支持的 Provider：' + next }
    if (next === 'http-llm' && !String(readEnv('VUE_APP_AI_ENDPOINT', '') || '')) {
      return { ok: false, error: '未配置 VUE_APP_AI_ENDPOINT，外部 Provider 不可启用（默认零网络）' }
    }
    prefs.provider = next
  }
  writePrefs(prefs)
  return { ok: true, data: describe() }
}

/** 清除运行时覆盖，回到构建环境变量默认值 */
function resetRuntime() {
  writePrefs({})
  return { ok: true, data: describe() }
}

module.exports = {
  PREFS_KEY,
  PROVIDERS,
  getConfig,
  isEnabled,
  providerName,
  describe,
  applyRuntime,
  resetRuntime
}
