<template>
  <div class="layout-root">
    <aside class="sidebar" :class="{ collapsed }">
      <div class="logo">
        <span class="logo-icon">
          <svg viewBox="0 0 48 48" width="26" height="26">
            <rect width="48" height="48" rx="10" fill="#3F9DF9" />
            <path d="M14 20a10 10 0 0 1 20 0v14h-4v-6h-4v6h-4V20z" fill="#fff" />
          </svg>
        </span>
        <span v-if="!collapsed" class="logo-title">医院管理系统</span>
      </div>
      <el-scrollbar class="menu-scroll">
        <el-menu
          :default-active="activePath"
          :collapse="collapsed"
          :unique-opened="false"
          background-color="#1c1f2e"
          text-color="#aeb6c4"
          active-text-color="#ffffff"
          :collapse-transition="false"
          router
        >
          <template v-for="item in menuTree">
            <el-menu-item v-if="!item.children" :key="item.code" :index="item.path">
              <i :class="item.icon"></i>
              <span slot="title">{{ item.title }}</span>
            </el-menu-item>
            <el-submenu v-else :key="item.code" :index="item.code">
              <template slot="title">
                <i :class="item.icon"></i>
                <span>{{ item.title }}</span>
              </template>
              <el-menu-item v-for="child in item.children" :key="child.code" :index="child.path">
                <i :class="child.icon"></i>
                <span slot="title">{{ child.title }}</span>
              </el-menu-item>
            </el-submenu>
          </template>
        </el-menu>
      </el-scrollbar>
    </aside>

    <div class="main-col">
      <header class="navbar">
        <div class="navbar-left">
          <span class="collapse-btn" @click="toggleSidebar">
            <i :class="collapsed ? 'el-icon-s-unfold' : 'el-icon-s-fold'"></i>
          </span>
          <el-breadcrumb separator="/" class="breadcrumb">
            <el-breadcrumb-item v-for="(item, i) in breadcrumbs" :key="item.title + i">
              <span>{{ item.title }}</span>
            </el-breadcrumb-item>
          </el-breadcrumb>
        </div>
        <div class="navbar-right">
          <el-tooltip content="刷新当前页面" placement="bottom">
            <span class="action-btn" @click="refreshPage">
              <i class="el-icon-refresh"></i>
            </span>
          </el-tooltip>
          <el-dropdown trigger="click" @command="handleCommand">
            <span class="user-area">
              <span class="avatar">{{ avatarText }}</span>
              <span class="user-name">{{ staffName }}</span>
              <i class="el-icon-arrow-down"></i>
            </span>
            <el-dropdown-menu slot="dropdown">
              <el-dropdown-item command="home">首页</el-dropdown-item>
              <el-dropdown-item command="reset">重置演示数据</el-dropdown-item>
              <el-dropdown-item command="logout" divided>退出登录</el-dropdown-item>
            </el-dropdown-menu>
          </el-dropdown>
        </div>
      </header>

      <tags-view />

      <main class="app-main">
        <router-view :key="refreshKey" />
      </main>
    </div>
  </div>
</template>

<script>
import { menuTree, flattenMenus } from '@/config/menu'
import TagsView from './components/TagsView.vue'

export default {
  name: 'Layout',
  components: { TagsView },
  data() {
    return { menuTree }
  },
  computed: {
    collapsed() {
      return this.$store.state.app.sidebarCollapsed
    },
    refreshKey() {
      return this.$store.state.app.refreshKey
    },
    activePath() {
      return this.$route.path
    },
    staff() {
      return this.$store.state.user.staff
    },
    staffName() {
      return (this.staff && this.staff.name) || '系统管理员'
    },
    avatarText() {
      return (this.staffName || '管').slice(0, 1)
    },
    breadcrumbs() {
      const flat = flattenMenus()
      const current = flat.find((m) => m.path === this.$route.path)
      const crumbs = [{ title: '首页', path: '/dashboard' }]
      if (current && current.group) crumbs.push({ title: current.group, path: current.path })
      if (current && current.title !== '首页') crumbs.push({ title: current.title, path: current.path, current: true })
      return crumbs
    }
  },
  methods: {
    toggleSidebar() {
      this.$store.commit('app/TOGGLE_SIDEBAR')
    },
    refreshPage() {
      this.$store.commit('app/INCREMENT_REFRESH')
    },
    handleCommand(cmd) {
      if (cmd === 'home') this.$router.push('/dashboard')
      else if (cmd === 'reset') this.$router.push('/system/reset')
      else if (cmd === 'logout') this.logout()
    },
    logout() {
      this.$confirm('确定退出登录吗？', '提示', { type: 'warning' })
        .then(async () => {
          await this.$store.dispatch('user/logout')
          this.$store.commit('tabs/DEL_ALL')
          this.$message.success('已退出登录')
          this.$router.replace('/login')
        })
        .catch(() => {})
    }
  }
}
</script>

<style lang="scss" scoped>
.layout-root {
  display: flex;
  height: 100%;
  overflow: hidden;
}

.sidebar {
  width: 210px;
  flex-shrink: 0;
  background: $sidebar-bg;
  display: flex;
  flex-direction: column;
  transition: width 0.25s;

  &.collapsed {
    width: 64px;
  }
}

.logo {
  height: 56px;
  display: flex;
  align-items: center;
  padding: 0 16px;
  background: $sidebar-deep;
  overflow: hidden;
  white-space: nowrap;

  .logo-icon {
    display: inline-flex;
    align-items: center;
    flex-shrink: 0;
  }

  .logo-title {
    margin-left: 10px;
    color: #fff;
    font-size: 16px;
    font-weight: 600;
    letter-spacing: 1px;
  }
}

.menu-scroll {
  flex: 1;
  overflow: hidden;
}

::v-deep .el-menu {
  border-right: none;
}

::v-deep .el-menu-item,
::v-deep .el-submenu__title {
  height: 44px;
  line-height: 44px;

  &:hover {
    background-color: $sidebar-hover !important;
  }
}

::v-deep .el-menu-item.is-active {
  background-color: $sidebar-active !important;
  position: relative;

  &::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 3px;
    background: $primary;
  }
}

::v-deep .el-menu--collapse .el-submenu__title span,
::v-deep .el-menu--collapse .el-submenu__title i.el-submenu__icon-arrow {
  display: none;
}

.main-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.navbar {
  height: 56px;
  background: $header-bg;
  border-bottom: 1px solid $border-color;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  flex-shrink: 0;
}

.navbar-left {
  display: flex;
  align-items: center;
}

.collapse-btn {
  font-size: 20px;
  color: $text-regular;
  cursor: pointer;
  margin-right: 14px;

  &:hover {
    color: $primary;
  }
}

.breadcrumb {
  font-size: 14px;
}

.navbar-right {
  display: flex;
  align-items: center;
}

.action-btn {
  font-size: 17px;
  color: $text-regular;
  cursor: pointer;
  margin-right: 18px;

  &:hover {
    color: $primary;
  }
}

.user-area {
  display: flex;
  align-items: center;
  cursor: pointer;
  outline: none;

  .avatar {
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background: $primary;
    color: #fff;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    margin-right: 8px;
  }

  .user-name {
    color: $text-main;
    font-size: 14px;
    margin-right: 4px;
  }

  .el-icon-arrow-down {
    color: $text-secondary;
    font-size: 12px;
  }
}

.app-main {
  flex: 1;
  overflow: auto;
  padding: 16px;
  background: $page-bg;
}
</style>
