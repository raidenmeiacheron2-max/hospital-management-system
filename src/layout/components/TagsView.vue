<template>
  <div class="tags-view">
    <el-scrollbar class="tags-scroll">
      <div class="tags-inner">
        <router-link
          v-for="tag in visitedViews"
          :key="tag.path"
          :to="tag.path"
          class="tag-item"
          :class="{ active: isActive(tag) }"
        >
          <span>{{ tag.title }}</span>
          <i
            v-if="!tag.affix"
            class="el-icon-close tag-close"
            @click.prevent.stop="closeTag(tag)"
          ></i>
        </router-link>
      </div>
    </el-scrollbar>
    <el-dropdown class="tags-menu" trigger="click" @command="handleCommand">
      <span class="tags-menu-btn"><i class="el-icon-arrow-down"></i></span>
      <el-dropdown-menu slot="dropdown">
        <el-dropdown-item command="refresh">刷新当前页</el-dropdown-item>
        <el-dropdown-item command="closeOthers">关闭其他</el-dropdown-item>
        <el-dropdown-item command="closeAll">关闭全部</el-dropdown-item>
      </el-dropdown-menu>
    </el-dropdown>
  </div>
</template>

<script>
export default {
  name: 'TagsView',
  computed: {
    visitedViews() {
      return this.$store.state.tabs.visitedViews
    }
  },
  methods: {
    isActive(tag) {
      return tag.path === this.$route.path
    },
    closeTag(tag) {
      const views = this.visitedViews
      this.$store.commit('tabs/DEL_VIEW', tag)
      if (this.isActive(tag)) {
        const idx = views.findIndex((v) => v.path === tag.path)
        const next = views[idx - 1] || views[idx + 1]
        this.$router.push((next && next.path) || '/dashboard')
      }
    },
    handleCommand(cmd) {
      const active = this.visitedViews.find((v) => v.path === this.$route.path)
      if (cmd === 'refresh') {
        this.$store.commit('app/INCREMENT_REFRESH')
      } else if (cmd === 'closeOthers') {
        this.$store.commit('tabs/DEL_OTHERS', active || {})
      } else if (cmd === 'closeAll') {
        this.$store.commit('tabs/DEL_ALL')
        this.$router.push('/dashboard')
      }
    }
  }
}
</script>

<style lang="scss" scoped>
.tags-view {
  height: 40px;
  background: $header-bg;
  border-bottom: 1px solid $border-color;
  display: flex;
  align-items: center;
  flex-shrink: 0;
  padding: 0 8px;
}

.tags-scroll {
  flex: 1;
  overflow: hidden;
}

.tags-inner {
  display: flex;
  align-items: center;
  white-space: nowrap;
  padding: 4px 0;
}

.tag-item {
  display: inline-flex;
  align-items: center;
  height: 26px;
  line-height: 26px;
  padding: 0 10px;
  margin-right: 6px;
  border: 1px solid $border-color;
  border-radius: 3px;
  background: #fff;
  color: $text-regular;
  font-size: 12px;
  cursor: pointer;
  text-decoration: none;

  .tag-close {
    margin-left: 6px;
    font-size: 12px;
    border-radius: 50%;
    transition: all 0.2s;

    &:hover {
      background: #c8ccd4;
      color: #fff;
    }
  }

  &.active {
    background: $primary;
    border-color: $primary;
    color: #fff;
  }
}

.tags-menu-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 26px;
  border: 1px solid $border-color;
  border-radius: 3px;
  color: $text-regular;
  cursor: pointer;
  margin-left: 2px;
}
</style>
