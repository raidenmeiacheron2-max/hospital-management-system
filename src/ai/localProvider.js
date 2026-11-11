// =====================================================================
// LocalRuleEngineProvider（B3，默认 Provider）
// - 完全离线、确定性、可回归：同一 demoToday 与同一数据下输出稳定
// - 不发起任何网络请求（静态规则见 guardrails.FORBIDDEN_NETWORK_PATTERNS）
// - 具体生成逻辑由各任务定义（task.generate），Provider 只负责统一契约与默认值
// =====================================================================
const providerRegistry = require('./provider')

const localProvider = {
  name: 'local-rule-engine',
  kind: 'local',
  sync: true,
  isAvailable: function () {
    return true
  },
  generate: function (task, context, input, options) {
    if (!task || typeof task.generate !== 'function') {
      throw new Error('本地引擎：任务未提供 generate()')
    }
    const out = task.generate(context, input || {}, options || {}) || {}
    return {
      text: out.text || '',
      data: out.data,
      confidence: typeof out.confidence === 'number' ? out.confidence : 0.8,
      basis: Array.isArray(out.basis) ? out.basis : [],
      disclaimers: Array.isArray(out.disclaimers) ? out.disclaimers : []
    }
  }
}

providerRegistry.registerProvider(localProvider)

module.exports = localProvider
