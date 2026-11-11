<template>
  <div class="forbidden-page">
    <div class="forbidden-card">
      <div class="code">403</div>
      <h2>无权限访问</h2>
      <p>当前账号的角色没有访问该页面的权限（演示级 RBAC）。</p>
      <p class="hint">如需访问，请联系管理员调整角色菜单权限，或使用具备权限的账号登录。</p>
      <div class="actions">
        <el-button type="primary" @click="$router.replace('/dashboard')">返回首页</el-button>
        <el-button @click="relogin">切换账号</el-button>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'Forbidden',
  methods: {
    relogin() {
      this.$store.dispatch('user/logout').then(() => {
        this.$router.replace('/login')
      })
    }
  }
}
</script>

<style lang="scss" scoped>
.forbidden-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: $page-bg;
  padding: 24px;
}

.forbidden-card {
  width: 460px;
  max-width: 100%;
  background: #fff;
  border-radius: $radius-md;
  box-shadow: $shadow-card;
  border: 1px solid $border-light;
  padding: 36px 32px;
  text-align: center;

  .code {
    font-size: 56px;
    font-weight: 800;
    color: $primary;
    line-height: 1;
    letter-spacing: 2px;
  }

  h2 {
    margin: 14px 0 8px;
    color: $text-main;
  }

  p {
    color: $text-regular;
    font-size: 14px;
    line-height: 1.7;
    margin: 4px 0;
  }

  .hint {
    color: $text-secondary;
    font-size: 13px;
  }

  .actions {
    margin-top: 22px;
  }
}
</style>
