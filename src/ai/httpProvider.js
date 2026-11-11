// =====================================================================
// HttpLLMProvider（B3，可选骨架，默认禁用）
// - 默认不启用：VUE_APP_AI_PROVIDER 默认为 local，且 endpoint 默认为空
// - 本文件不包含任何真实网络实现（不发起请求），避免"默认零网络"被破坏；
//   接入真实 LLM 需后端/代理与显式配置，属后续独立工作
// - 永不读取或保存密钥：密钥只能放 .env.local（已被 .gitignore 忽略）
// =====================================================================
const providerRegistry = require('./provider')
const config = require('./config')

const httpProvider = {
  name: 'http-llm',
  kind: 'http',
  sync: false,
  isAvailable: function () {
    return !!config.getConfig().endpointConfigured
  },
  generate: function () {
    const cfg = config.getConfig()
    if (!cfg.endpointConfigured) {
      throw new Error('外部 LLM Provider 未配置 endpoint，已禁用（默认零网络）')
    }
    throw new Error('外部 LLM Provider 仅保留骨架：本项目为纯前端 Mock 演示，未实现真实网络调用')
  }
}

providerRegistry.registerProvider(httpProvider)

module.exports = httpProvider
