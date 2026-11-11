<template>
  <div class="app-page assistant-page">
    <el-row :gutter="12">
      <el-col :xs="24" :md="16">
        <div class="panel-card intro-card">
          <h3 class="panel-title">Ask Astra 业务助手</h3>
          <p class="intro-text">
            用自然语言询问系统数据与业务规则，回答包含<strong>结论、数据依据、建议入口</strong>；AI 只读、默认离线、可审计，不会修改任何业务数据。
          </p>
          <div class="chip-row">
            <span class="chip-label"><i class="el-icon-magic-stick"></i> 推荐问题</span>
            <el-button
              v-for="q in presets"
              :key="q"
              class="q-chip"
              size="mini"
              round
              :disabled="loading"
              @click="ask(q)"
            >{{ q }}</el-button>
          </div>
        </div>
      </el-col>
      <el-col :xs="24" :md="8">
        <div class="panel-card tip-card">
          <h3 class="panel-title">使用说明</h3>
          <ul class="tip-list">
            <li>支持门诊、收费、发药、报告、医嘱、库存、床位、收入、住院、患者、科室与医生工作量等问题。</li>
            <li>回答数值可在「数据依据」中核对来源与原始值（金额以整数分存储、展示为元）。</li>
            <li>角色无权访问的业务域会直接提示无权限，不会越权取数。</li>
          </ul>
        </div>
      </el-col>
    </el-row>

    <div class="panel-card chat-card">
      <div ref="chatBox" class="chat-box">
        <div v-if="!messages.length && !loading" class="chat-empty">
          <i class="el-icon-chat-dot-round"></i>
          <p>你好，我是 Ask Astra。点击上方推荐问题，或在下方输入问题开始对话。</p>
        </div>

        <div v-for="(m, i) in messages" :key="i" class="msg-row" :class="m.role">
          <div class="avatar"><i :class="m.role === 'user' ? 'el-icon-user' : 'el-icon-cpu'"></i></div>
          <div class="bubble-wrap">
            <div class="bubble" :class="m.role">
              <template v-if="m.role === 'user'">{{ m.text }}</template>
              <template v-else>
                <div class="answer" :class="{ 'answer-error': m.error }">{{ m.answer }}</div>

                <div v-if="m.basis && m.basis.length" class="basis-block">
                  <div class="block-label">数据依据</div>
                  <div class="basis-chips">
                    <el-tooltip v-for="(b, bi) in m.basis" :key="bi" placement="top" :content="basisTip(b)">
                      <span class="basis-chip">
                        <span class="b-label">{{ b.label }}</span>
                        <b class="b-value">{{ b.value }}</b>
                      </span>
                    </el-tooltip>
                  </div>
                </div>

                <div v-if="m.actions && m.actions.length" class="action-row">
                  <el-button
                    v-for="(a, ai) in m.actions"
                    :key="ai"
                    size="mini"
                    type="primary"
                    plain
                    @click="go(a.path)"
                  >{{ a.label }}</el-button>
                </div>

                <div v-if="m.followups && m.followups.length" class="followup-row">
                  <span class="followup-label">继续追问</span>
                  <el-link
                    v-for="(f, fi) in m.followups"
                    :key="fi"
                    type="primary"
                    :underline="false"
                    @click="ask(f)"
                  >{{ f }}</el-link>
                </div>

                <AiMetaBar
                  v-if="!m.error"
                  :meta="m.meta || {}"
                  :provider-label="m.providerLabel || providerLabel"
                ></AiMetaBar>
                <AiDisclaimer v-if="!m.error" :disclaimers="m.disclaimers || []"></AiDisclaimer>
              </template>
            </div>
          </div>
        </div>

        <div v-if="loading" class="msg-row assistant">
          <div class="avatar"><i class="el-icon-cpu"></i></div>
          <div class="bubble-wrap">
            <div class="bubble assistant typing">
              <span class="dot"></span><span class="dot"></span><span class="dot"></span>
              <span class="typing-text">Ask Astra 正在分析只读数据…</span>
            </div>
          </div>
        </div>

        <div v-if="aiDisabled" class="disabled-tip">
          <i class="el-icon-warning-outline"></i>
          AI 功能已关闭（演示开关），本次未产生任何 AI 调用。可在「AI 治理中心」重新启用后再试。
        </div>
      </div>

      <div class="composer">
        <el-input
          v-model="question"
          class="composer-input"
          placeholder="输入业务问题，例如：今天待接诊多少 / 哪些药品库存最低 / 床位占用率多少"
          clearable
          @keyup.enter.native="send"
        ></el-input>
        <el-button type="primary" icon="el-icon-s-promotion" :loading="loading" @click="send">发送</el-button>
      </div>
      <div class="composer-hint">Enter 发送 · AI 只读 · 数值依据可核对 · 演示基准日 2026-08-28</div>
    </div>
  </div>
</template>

<script>
import AiDisclaimer from '@/components/AiDisclaimer.vue'
import AiMetaBar from '@/components/AiMetaBar.vue'
import { apiAiRun } from '@/api'

const PROVIDER_LABELS = {
  'local-rule-engine': '本地确定性引擎',
  'http-llm': '外部 LLM（骨架）'
}

export default {
  name: 'AiAssistant',
  components: { AiDisclaimer, AiMetaBar },
  data() {
    return {
      question: '',
      loading: false,
      aiDisabled: false,
      messages: [],
      presets: [
        '今天门诊量多少？',
        '待出报告有几条？',
        '待收费有多少？',
        '库存最低的药品有哪些？',
        '床位占用率多少？',
        '今天收入多少？'
      ]
    }
  },
  computed: {
    providerLabel() {
      return '本地确定性引擎'
    }
  },
  methods: {
    ask(text) {
      const q = String(text || '').trim()
      if (!q || this.loading) return
      this.question = q
      this.send()
    },
    async send() {
      const text = String(this.question || '').trim()
      if (!text || this.loading) return
      this.messages.push({ role: 'user', text: text })
      this.question = ''
      this.loading = true
      this.aiDisabled = false
      this.scrollBottom()
      try {
        const res = await apiAiRun('assistant.qa', { question: text })
        const data = (res && res.data) || {}
        this.messages.push({
          role: 'assistant',
          answer: data.answer || '本次未返回结论，请换个问法重试。',
          basis: data.basis || [],
          actions: data.actions || [],
          followups: data.followups || [],
          disclaimers: data.disclaimers || [],
          meta: (res && res.meta) || {},
          providerLabel: PROVIDER_LABELS[(res && res.provider) || ''] || '本地确定性引擎'
        })
      } catch (e) {
        const message = (e && e.message) || ''
        // 拦截器已对 503 弹出一次提示；此处只做页面内展示，不重复弹错
        if (message.indexOf('AI 功能已关闭') !== -1 || message.indexOf('AI_DISABLED') !== -1) {
          this.aiDisabled = true
          this.messages.push({
            role: 'assistant',
            error: true,
            answer: 'AI 功能已关闭（演示开关），本次问答未执行。请在「AI 治理中心」重新启用后再试。'
          })
        } else {
          this.messages.push({
            role: 'assistant',
            error: true,
            answer: '本次问答失败：' + (message || '未知错误') + '。请稍后重试或刷新页面。'
          })
        }
      } finally {
        this.loading = false
        this.scrollBottom()
      }
    },
    go(path) {
      if (path) this.$router.push(path)
    },
    scrollBottom() {
      this.$nextTick(() => {
        const box = this.$refs.chatBox
        if (box) box.scrollTop = box.scrollHeight
      })
    },
    basisTip(basis) {
      const parts = []
      if (basis && basis.source) parts.push('来源：' + basis.source)
      if (basis && basis.raw !== undefined) parts.push('原始值：' + basis.raw)
      return parts.join('；') || '只读聚合'
    }
  }
}
</script>

<style lang="scss" scoped>
.assistant-page {
  .panel-card + .panel-card {
    margin-top: 0;
  }
}

.intro-card {
  margin-bottom: 12px;
}

.intro-text {
  margin: 0 0 12px;
  font-size: 13px;
  line-height: 1.7;
  color: $text-regular;

  strong {
    color: $primary-deep;
    font-weight: 600;
  }
}

.chip-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.chip-label {
  font-size: 12px;
  color: $text-secondary;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.q-chip {
  margin: 0 !important;
  border-color: lighten($primary, 24%);
  color: $primary-deep;
  background: $primary-lighter;

  &:hover,
  &:focus {
    color: #fff;
    background: $primary;
    border-color: $primary;
  }
}

.tip-card {
  margin-bottom: 12px;
}

.tip-list {
  margin: 0;
  padding-left: 16px;
  font-size: 12px;
  line-height: 1.8;
  color: $text-regular;
}

.chat-card {
  display: flex;
  flex-direction: column;
}

.chat-box {
  height: 460px;
  overflow-y: auto;
  padding: 12px;
  background: #fafbfd;
  border: 1px solid $border-light;
  border-radius: $radius-md;
}

.chat-empty {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: $text-secondary;
  gap: 10px;

  i {
    font-size: 34px;
    color: $primary-light;
  }

  p {
    margin: 0;
    font-size: 13px;
    text-align: center;
    line-height: 1.7;
    max-width: 420px;
  }
}

.msg-row {
  display: flex;
  gap: 8px;
  margin-bottom: 14px;

  &.user {
    flex-direction: row-reverse;

    .bubble {
      background: $primary;
      color: #fff;
      border-color: $primary;
    }

    .bubble-wrap {
      align-items: flex-end;
    }
  }

  &.assistant {
    .bubble {
      background: #fff;
      border-color: $border-color;
    }
  }
}

.avatar {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: $primary-lighter;
  color: $primary-deep;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  flex-shrink: 0;
}

.msg-row.user .avatar {
  background: $primary;
  color: #fff;
}

.bubble-wrap {
  display: flex;
  flex-direction: column;
  max-width: calc(100% - 46px);
  min-width: 0;
}

.bubble {
  border: 1px solid $border-light;
  border-radius: $radius-md;
  padding: 10px 12px;
  font-size: 13px;
  line-height: 1.7;
  color: $text-main;
  max-width: 100%;
  word-break: break-word;
}

.answer {
  white-space: pre-wrap;

  &.answer-error {
    color: $danger;
  }
}

.basis-block {
  margin-top: 10px;
}

.block-label {
  font-size: 12px;
  color: $text-secondary;
  margin-bottom: 5px;
}

.basis-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.basis-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 100%;
  background: #f5f7fa;
  border-radius: 10px;
  padding: 2px 9px;
  font-size: 12px;
  color: $text-secondary;

  .b-label {
    color: $text-secondary;
  }

  .b-value {
    color: $text-main;
    font-weight: 600;
  }
}

.action-row {
  margin-top: 10px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.followup-row {
  margin-top: 10px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  padding-top: 8px;
  border-top: 1px dashed $border-light;

  .followup-label {
    font-size: 12px;
    color: $text-secondary;
  }

  .el-link {
    font-size: 12px;
  }
}

.typing {
  display: flex;
  align-items: center;
  gap: 4px;

  .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: $primary;
    opacity: 0.35;
    animation: blink 1s infinite;

    &:nth-child(2) {
      animation-delay: 0.2s;
    }

    &:nth-child(3) {
      animation-delay: 0.4s;
    }
  }

  .typing-text {
    margin-left: 6px;
    color: $text-secondary;
    font-size: 12px;
  }
}

@keyframes blink {
  0%,
  100% {
    opacity: 0.25;
  }

  50% {
    opacity: 1;
  }
}

.disabled-tip {
  display: flex;
  align-items: center;
  gap: 6px;
  background: $warning-bg;
  border: 1px solid #f5e3bd;
  border-radius: $radius-md;
  padding: 8px 12px;
  font-size: 12px;
  color: #a86b12;
  margin-top: 6px;
}

.composer {
  display: flex;
  gap: 10px;
  margin-top: 12px;

  .composer-input {
    flex: 1;
  }
}

.composer-hint {
  margin-top: 8px;
  font-size: 12px;
  color: $text-secondary;
  text-align: right;
}

@media (max-width: 900px) {
  .chat-box {
    height: 380px;
  }

  .composer-hint {
    text-align: left;
  }
}
</style>
