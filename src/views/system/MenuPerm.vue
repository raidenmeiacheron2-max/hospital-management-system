<template>
  <div class="app-page">
    <div class="panel-card">
      <el-form :inline="true">
        <el-form-item label="角色">
          <el-select v-model="roleId" placeholder="请选择角色" style="width: 220px">
            <el-option v-for="r in roles" :key="r.id" :label="`${r.name}（${r.code}）`" :value="r.id" />
          </el-select>
        </el-form-item>
      </el-form>
      <div class="perm-note">勾选该角色可见的菜单（纯前端界面演示，不构成真实权限控制）</div>
      <el-tree
        ref="tree"
        :data="menus"
        show-checkbox
        node-key="code"
        :props="{ label: 'name', children: 'children' }"
        :default-checked-keys="checkedCodes"
        class="perm-tree"
      >
        <span slot-scope="{ data }" class="tree-node">
          {{ data.name }}
          <el-tag v-if="data.type === 'group'" size="mini" type="info" style="margin-left: 6px">分组</el-tag>
        </span>
      </el-tree>
      <div class="perm-footer">
        <el-button type="primary" :loading="saving" @click="save">保存权限</el-button>
        <el-button @click="loadChecked">重 置</el-button>
      </div>
    </div>
  </div>
</template>

<script>
import { apiListRoles, apiListMenus, apiSaveRoleMenus } from '@/api'

export default {
  name: 'MenuPerm',
  data() {
    return {
      roleId: '',
      roles: [],
      menus: [],
      checkedCodes: [],
      saving: false
    }
  },
  watch: {
    roleId(v) {
      if (v) this.loadChecked()
    }
  },
  created() {
    this.init()
  },
  methods: {
    async init() {
      const [roles, menus] = await Promise.all([apiListRoles(), apiListMenus()])
      this.roles = roles
      this.menus = menus
      const qRole = this.$route.query.role
      if (qRole && roles.some((r) => r.id === qRole)) {
        this.roleId = qRole
      } else if (roles.length) {
        this.roleId = roles[0].id
      }
      this.$nextTick(() => this.loadChecked())
    },
    loadChecked() {
      const role = this.roles.find((r) => r.id === this.roleId)
      if (!role) return
      if (role.menuCodes.includes('*')) {
        this.checkedCodes = this.collectCodes(this.menus)
      } else {
        this.checkedCodes = role.menuCodes.slice()
      }
      this.$nextTick(() => {
        if (this.$refs.tree) this.$refs.tree.setCheckedKeys(this.checkedCodes)
      })
    },
    collectCodes(nodes) {
      const out = []
      nodes.forEach((n) => {
        out.push(n.code)
        if (n.children) out.push(...this.collectCodes(n.children))
      })
      return out
    },
    save() {
      if (!this.roleId) {
        this.$message.warning('请选择角色')
        return
      }
      if (this.saving) return
      const codes = this.$refs.tree.getCheckedKeys().concat(this.$refs.tree.getHalfCheckedKeys())
      this.saving = true
      apiSaveRoleMenus(this.roleId, codes)
        .then(() => {
          this.$message.success('权限已保存')
          return apiListRoles()
        })
        .then((roles) => {
          this.roles = roles
        })
        .catch(() => {})
        .finally(() => {
          this.saving = false
        })
    }
  }
}
</script>

<style lang="scss" scoped>
.perm-note {
  font-size: 12px;
  color: $text-secondary;
  margin: 4px 0 12px;
}

.perm-tree {
  border: 1px solid $border-color;
  border-radius: $radius-md;
  padding: 8px;
  max-height: 480px;
  overflow-y: auto;
}

.tree-node {
  font-size: 14px;
}

.perm-footer {
  margin-top: 14px;
}
</style>
