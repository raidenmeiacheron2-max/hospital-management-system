<template>
  <div class="ai-meta">
    <span class="meta-chip provider"><i class="el-icon-cpu"></i> {{ providerLabel }}</span>
    <span class="meta-chip">置信度 {{ confidencePct }}%</span>
    <span class="meta-chip">耗时 {{ meta.latencyMs || 0 }}ms</span>
    <span class="meta-chip readonly"><i class="el-icon-lock"></i> 只读</span>
    <span v-if="meta.fallback" class="meta-chip fallback"><i class="el-icon-warning-outline"></i> 已回退</span>
    <span v-if="meta.eventId" class="meta-chip audit">审计 {{ meta.eventId }}</span>
  </div>
</template>

<script>
export default {
  name: 'AiMetaBar',
  props: {
    meta: { type: Object, default: () => ({}) },
    providerLabel: { type: String, default: '本地确定性引擎' }
  },
  computed: {
    confidencePct() {
      const c = Number(this.meta && this.meta.confidence)
      return isFinite(c) ? Math.round(c * 100) : 0
    }
  }
}
</script>

<style lang="scss" scoped>
.ai-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}

.meta-chip {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 12px;
  color: $text-secondary;
  background: #f5f7fa;
  border-radius: 10px;
  padding: 1px 9px;

  &.provider {
    background: $primary-lighter;
    color: $primary-deep;
  }

  &.readonly {
    background: $success-bg;
    color: #1f8a5b;
  }

  &.fallback {
    background: $warning-bg;
    color: #a86b12;
  }

  &.audit {
    background: #f3e8ff;
    color: #7b4fbf;
  }
}
</style>
