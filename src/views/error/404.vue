<template>
  <div class="nf-page">
    <div class="nf-code">404</div>
    <div class="nf-text">抱歉，您访问的页面不存在</div>
    <el-button type="primary" @click="$router.replace('/')">返回首页</el-button>
  </div>
</template>

<script>
export default {
  name: 'NotFound'
}
</script>

<style lang="scss" scoped>
.nf-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: $page-bg;
}

.nf-code {
  font-size: 96px;
  font-weight: 800;
  color: $primary;
  line-height: 1;
}

.nf-text {
  color: $text-secondary;
  margin: 16px 0 24px;
}
</style>
