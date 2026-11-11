// =====================================================================
// Provider 抽象（B3）
// 契约（所有 Provider 实现同一接口）：
//   {
//     name: 'local-rule-engine' | 'http-llm',
//     kind: 'local' | 'http',
//     sync: boolean,                     // 本地引擎同步返回；HTTP 骨架异步
//     isAvailable(): boolean,
//     generate(taskDef, context, input, options) => {
//       text, data, confidence, basis, disclaimers
//     }
//   }
// 说明：Mock.js 拦截层无法 await，故默认本地引擎走同步链路；
//       异步外部 Provider 需真实后端/代理，当前仅保留骨架（默认禁用）。
// =====================================================================
const providers = {}

function assertProvider(p) {
  if (!p || typeof p !== 'object') throw new Error('Provider 契约不合法：必须为对象')
  if (typeof p.name !== 'string' || !p.name) throw new Error('Provider 契约不合法：缺少 name')
  if (typeof p.generate !== 'function') throw new Error('Provider 契约不合法：缺少 generate()')
  return true
}

function registerProvider(p) {
  assertProvider(p)
  providers[p.name] = p
  return p
}

function getProvider(name) {
  return providers[name] || null
}

function listProviders() {
  return Object.keys(providers).map(function (name) {
    const p = providers[name]
    return {
      name: name,
      kind: p.kind || 'unknown',
      sync: p.sync !== false,
      available: typeof p.isAvailable === 'function' ? !!p.isAvailable() : true
    }
  })
}

module.exports = { registerProvider, getProvider, listProviders, assertProvider }
