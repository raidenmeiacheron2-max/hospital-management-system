<template>
  <div class="login-page">
    <div class="login-card">
      <div class="brand-icon">
        <svg viewBox="0 0 48 48" width="34" height="34">
          <rect width="48" height="48" rx="10" fill="#3F9DF9" />
          <path d="M14 20a10 10 0 0 1 20 0v14h-4v-6h-4v6h-4V20z" fill="#fff" />
        </svg>
      </div>
      <h1 class="sys-title">医院管理系统</h1>
      <div class="sub-pill">一站式医院管理平台</div>
      <div class="welcome">欢迎登录</div>

      <el-form ref="form" :model="form" :rules="rules" @submit.native.prevent>
        <el-form-item prop="account">
          <el-input
            v-model.trim="form.account"
            placeholder="请输入登录账号"
            prefix-icon="el-icon-user"
            clearable
            @keyup.enter.native="submit"
          />
        </el-form-item>
        <el-form-item prop="password">
          <el-input
            v-model="form.password"
            type="password"
            placeholder="请输入密码"
            prefix-icon="el-icon-lock"
            show-password
            @keyup.enter.native="submit"
          />
        </el-form-item>
        <div class="form-options">
          <el-checkbox v-model="form.remember">记住密码</el-checkbox>
          <span class="demo-tip">演示账号 admin / 123456</span>
        </div>
        <el-button class="login-btn" type="primary" :loading="loading" @click="submit">
          登 录
        </el-button>
      </el-form>
    </div>
  </div>
</template>

<script>
import { getRemembered, setRemembered } from '@/utils/auth'

export default {
  name: 'Login',
  data() {
    const remembered = getRemembered()
    return {
      loading: false,
      form: {
        account: (remembered && remembered.account) || 'admin',
        password: '',
        remember: !!(remembered && remembered.account)
      },
      rules: {
        account: [{ required: true, message: '请输入登录账号', trigger: 'blur' }],
        password: [{ required: true, message: '请输入密码', trigger: 'blur' }]
      }
    }
  },
  methods: {
    submit() {
      this.$refs.form.validate(async (valid) => {
        if (!valid) return
        this.loading = true
        try {
          await this.$store.dispatch('user/login', {
            account: this.form.account,
            password: this.form.password
          })
          // 「记住密码」仅记住账号与勾选状态，不保存真实密码
          setRemembered(this.form.remember, this.form.account)
          this.$message.success('登录成功')
          const redirect = this.$route.query.redirect
          this.$router.replace(redirect ? decodeURIComponent(redirect) : '/')
        } catch (e) {
          /* 错误提示由拦截器统一处理 */
        } finally {
          this.loading = false
        }
      })
    }
  }
}
</script>

<style lang="scss" scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: linear-gradient(135deg, #d9e8f8 0%, #eef4fb 55%, #f6f9fd 100%);
  background-image: radial-gradient(circle, rgba(63, 157, 249, 0.18) 1.2px, transparent 1.2px),
    linear-gradient(135deg, #d9e8f8 0%, #eef4fb 55%, #f6f9fd 100%);
  background-size: 26px 26px, cover;
  background-position: 0 0, center;
}

.login-card {
  width: 400px;
  max-width: 100%;
  background: #fff;
  border-radius: 18px;
  box-shadow: 0 12px 40px rgba(50, 122, 224, 0.16);
  padding: 44px 40px 40px;
  text-align: center;
}

.brand-icon {
  width: 64px;
  height: 64px;
  margin: 0 auto 14px;
  background: $primary-lighter;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.sys-title {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
  color: $text-main;
  letter-spacing: 2px;
}

.sub-pill {
  display: inline-block;
  margin-top: 10px;
  padding: 4px 14px;
  border-radius: 12px;
  background: $primary-lighter;
  color: $primary-dark;
  font-size: 12px;
}

.welcome {
  margin: 22px 0 18px;
  font-size: 18px;
  font-weight: 600;
  color: $text-main;
}

::v-deep .el-input__inner {
  height: 44px;
  line-height: 44px;
  border-radius: 6px;
}

.form-options {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;

  .demo-tip {
    font-size: 12px;
    color: $text-secondary;
  }
}

.login-btn {
  width: 100%;
  height: 44px;
  font-size: 16px;
  letter-spacing: 8px;
  border-radius: 6px;
  background: linear-gradient(90deg, $primary-deep, $primary);
  border: none;

  &:hover,
  &:focus {
    background: linear-gradient(90deg, #2a6cc7, $primary-dark);
    border: none;
  }
}

@media (max-width: 480px) {
  .login-card {
    padding: 32px 22px 28px;
  }
}
</style>
