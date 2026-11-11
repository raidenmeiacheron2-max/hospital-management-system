<template>
  <div class="ai-disclaimer">
    <i class="el-icon-warning-outline"></i>
    <div class="ad-body">
      <div v-for="(d, i) in list" :key="i" class="ad-line">{{ d }}</div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'AiDisclaimer',
  props: {
    disclaimers: { type: Array, default: () => [] }
  },
  computed: {
    list() {
      return (this.disclaimers || []).length ? this.disclaimers : ['本功能为演示用途，数据均为虚构。']
    }
  }
}
</script>

<style lang="scss" scoped>
.ai-disclaimer {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  background: #fffbf0;
  border: 1px solid #f5e3bd;
  border-radius: $radius-md;
  padding: 9px 12px;
  margin-top: 10px;
  color: #8a6d3b;
  font-size: 12px;
  line-height: 1.6;

  i {
    font-size: 15px;
    margin-top: 1px;
    flex-shrink: 0;
  }

  .ad-body {
    flex: 1;
    min-width: 0;
  }

  .ad-line + .ad-line {
    margin-top: 3px;
  }
}
</style>
