// =====================================================================
// Guardrails（B3 安全护栏，对应 AI_ARCHITECTURE.md §5）
// G1 no-write : 提供静态扫描，断言 AI 层无业务写能力（供测试使用）
// G2 schema   : 输出结构校验，失败回退"无建议"
// G3 disclaimer: 强制注入免责声明
// G4 人工确认 : 落地写操作只能由 UI 触发原有 db 校验（AI 不持有写入口）
// G5 脱敏     : 递归剔除密码/token 等敏感字段
// G6 开关     : 关闭时 runTask 提前返回，无任何副作用
// G7 零网络   : 本地引擎无 fetch/axios/XMLHttpRequest（静态断言）
// 本文件为纯函数工具，不访问业务数据、不写库。
// =====================================================================

const DISCLAIMER = {
  DEMO: '本功能为演示用途，数据均为虚构，不构成真实诊疗或经营结论。',
  READONLY: 'AI 仅提供只读分析与建议，不会修改任何业务数据；任何落地操作均需人工确认并走原有业务校验。',
  MEDICAL: '以下内容为文本结构化建议，需医生人工确认，不作为诊断或治疗依据。',
  FORECAST: '预测基于历史演示数据的统计口径，存在误差，仅作运营参考，不自动改变任何业务数据。',
  REPORT: '报表基于演示数据统计；数据层金额以整数分存储，展示与导出时转换为元。'
}

// 敏感字段（小写比较）：永不进入 AI 上下文与审计摘要
const SENSITIVE_KEYS = ['password', 'token', 'idcard', 'id_card', 'phone', 'mobile', 'address', 'secret', 'apikey', 'api_key', 'accesskey']

// G1 静态扫描规则：AI 层出现以下调用即视为"具备写能力"
const FORBIDDEN_WRITE_PATTERNS = [
  { re: /\bdb\s*\.\s*(create|update|delete|set|reset|persist|charge|dispense|settle|confirm|transfer|cancel|execute|refund|saveRoleMenu|recordAudit)\w*\s*\(/g, label: '业务写函数调用（db.create/update/delete/...）' },
  { re: /\bpersist\s*\(/g, label: '直接调用数据层持久化函数' },
  { re: /\bstate\s*\.\s*[A-Za-z_$][\w$]*\s*=(?!=)/g, label: '直接修改数据层 state' }
]

// G7 静态扫描规则：本地链路不得出现网络请求
const FORBIDDEN_NETWORK_PATTERNS = [
  { re: /\baxios\b/g, label: 'axios 引用' },
  { re: /\bXMLHttpRequest\b/g, label: 'XMLHttpRequest 引用' },
  { re: /\bfetch\s*\(/g, label: 'fetch() 调用' },
  { re: /\bWebSocket\b/g, label: 'WebSocket 引用' }
]

function isPlainObject(v) {
  return !!v && typeof v === 'object' && !Array.isArray(v)
}

/** G5：递归剔除敏感字段并深拷贝（含循环引用保护） */
function stripSensitive(value, seen) {
  const visited = seen || []
  if (value === null || value === undefined) return value
  if (typeof value !== 'object') return value
  if (visited.indexOf(value) !== -1) return '[circular]'
  const next = visited.concat([value])
  if (Array.isArray(value)) {
    return value.map(function (item) {
      return stripSensitive(item, next)
    })
  }
  const out = {}
  Object.keys(value).forEach(function (key) {
    if (SENSITIVE_KEYS.indexOf(String(key).toLowerCase()) !== -1) return
    out[key] = stripSensitive(value[key], next)
  })
  return out
}

/** 文本摘要（用于审计，不记录完整原文） */
function summarize(text, max) {
  const limit = max || 200
  const s = String(text === undefined || text === null ? '' : text)
    .replace(/\s+/g, ' ')
    .trim()
  return s.length > limit ? s.slice(0, limit) + '…' : s
}

/** G2：轻量输出结构校验（类型描述符，够用且无外部依赖） */
function checkType(value, type) {
  if (!type) return true
  if (type === 'any') return true
  if (type === 'string') return typeof value === 'string'
  if (type === 'number') return typeof value === 'number' && isFinite(value)
  if (type === 'boolean') return typeof value === 'boolean'
  if (type === 'array') return Array.isArray(value)
  if (type === 'array<string>') return Array.isArray(value) && value.every(function (x) { return typeof x === 'string' })
  if (type === 'array<number>') return Array.isArray(value) && value.every(function (x) { return typeof x === 'number' && isFinite(x) })
  if (type === 'array<object>') return Array.isArray(value) && value.every(isPlainObject)
  if (type === 'object') return isPlainObject(value)
  return true
}

function validateSchema(data, schema) {
  const errors = []
  if (!schema || typeof schema !== 'object') return { ok: true, errors: errors }
  if (!isPlainObject(data)) return { ok: false, errors: ['输出不是对象'] }
  Object.keys(schema).forEach(function (key) {
    if (!checkType(data[key], schema[key])) {
      errors.push('字段 ' + key + ' 类型应为 ' + schema[key])
    }
  })
  return { ok: errors.length === 0, errors: errors }
}

/** G3：注入/去重免责声明 */
function ensureDisclaimers(list, extra) {
  const out = []
  ;(Array.isArray(list) ? list : []).concat(Array.isArray(extra) ? extra : []).forEach(function (d) {
    if (typeof d === 'string' && d && out.indexOf(d) === -1) out.push(d)
  })
  if (!out.length) out.push(DISCLAIMER.DEMO)
  return out
}

/** G2：结构校验失败时的"无建议"回退 */
function fallbackOutput(task, errors) {
  let out = null
  try {
    if (task && typeof task.fallback === 'function') out = task.fallback(errors || [])
  } catch (e) {
    out = null
  }
  if (!isPlainObject(out)) {
    out = { note: '输出未通过结构校验，已回退为"暂无可用建议"。', schemaErrors: errors || [] }
  }
  if (!Array.isArray(out.disclaimers)) out.disclaimers = []
  return out
}

/** G1/G7：源码静态扫描（供测试断言，不参与运行时） */
function scanSource(source, patterns) {
  const hits = []
  const text = String(source || '')
  ;(patterns || []).forEach(function (p) {
    const re = new RegExp(p.re.source, p.re.flags.indexOf('g') === -1 ? p.re.flags + 'g' : p.re.flags)
    let m
    while ((m = re.exec(text)) !== null) {
      hits.push({ label: p.label, match: m[0] })
      if (m.index === re.lastIndex) re.lastIndex++
    }
  })
  return hits
}

module.exports = {
  DISCLAIMER,
  SENSITIVE_KEYS,
  FORBIDDEN_WRITE_PATTERNS,
  FORBIDDEN_NETWORK_PATTERNS,
  stripSensitive,
  summarize,
  validateSchema,
  ensureDisclaimers,
  fallbackOutput,
  scanSource,
  checkType
}
