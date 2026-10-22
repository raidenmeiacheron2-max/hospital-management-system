<template>
  <div class="app-page">
    <div class="panel-card">
      <div class="toolbar-row">
        <div class="toolbar-left">
          <el-button type="primary" icon="el-icon-plus" @click="openDialog">新增角色</el-button>
        </div>
        <div class="toolbar-right">
          <span class="text-muted" style="font-size: 12px">纯前端权限仅用于界面演示，不具备真实安全控制能力</span>
        </div>
      </div>

      <el-table v-loading="loading" :data="roles" style="width: 100%; margin-top: 12px">
        <el-table-column prop="name" label="角色名称" min-width="120" />
        <el-table-column prop="code" label="角色编码" min-width="140" />
        <el-table-column prop="description" label="说明" min-width="220" />
        <el-table-column label="权限范围" min-width="200">
          <template slot-scope="{ row }">
            <el-tag v-if="row.menuCodes.includes('*')" size="small" type="success">全部菜单</el-tag>
            <el-tag v-else size="small" type="info">{{ row.menuCodes.length }} 个菜单</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200">
          <template slot-scope="{ row }">
            <div class="operation-links">
              <el-link type="primary" @click="goMenuPerm(row)">菜单权限</el-link>
              <el-link type="danger" @click="removeRow(row)">删除</el-link>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <el-dialog title="新增角色" :visible.sync="dialogVisible" width="440px" :close-on-click-modal="false">
      <el-form ref="form" :model="form" :rules="rules" label-width="90px">
        <el-form-item label="角色名称" prop="name">
          <el-input v-model.trim="form.name" placeholder="请输入角色名称" />
        </el-form-item>
        <el-form-item label="角色编码" prop="code">
          <el-input v-model.trim="form.code" placeholder="如 NURSE" />
        </el-form-item>
        <el-form-item label="说明">
          <el-input v-model.trim="form.description" type="textarea" :rows="2" placeholder="选填" />
        </el-form-item>
      </el-form>
      <div slot="footer">
        <el-button @click="dialogVisible = false">取 消</el-button>
        <el-button type="primary" :loading="submitting" @click="submitForm">确 定</el-button>
      </div>
    </el-dialog>
  </div>
</template>

<script>
import { apiListRoles, apiCreateRole, apiDeleteRole } from '@/api'

export default {
  name: 'RoleList',
  data() {
    return {
      loading: false,
      roles: [],
      dialogVisible: false,
      submitting: false,
      form: { name: '', code: '', description: '' },
      rules: {
        name: [{ required: true, message: '请输入角色名称', trigger: 'blur' }],
        code: [{ required: true, message: '请输入角色编码', trigger: 'blur' }]
      }
    }
  },
  created() {
    this.fetchData()
  },
  methods: {
    async fetchData() {
      this.loading = true
      try {
        this.roles = await apiListRoles()
      } finally {
        this.loading = false
      }
    },
    openDialog() {
      this.form = { name: '', code: '', description: '' }
      this.dialogVisible = true
      this.$nextTick(() => this.$refs.form && this.$refs.form.clearValidate())
    },
    submitForm() {
      this.$refs.form.validate(async (valid) => {
        if (!valid || this.submitting) return
        this.submitting = true
        try {
          await apiCreateRole(this.form)
          this.$message.success('新增成功')
          this.dialogVisible = false
          this.fetchData()
        } catch (e) {
          /* 拦截器已提示 */
        } finally {
          this.submitting = false
        }
      })
    },
    removeRow(row) {
      this.$confirm(`确定删除角色「${row.name}」吗？`, '删除确认', { type: 'warning' })
        .then(async () => {
          await apiDeleteRole(row.id)
          this.$message.success('删除成功')
          this.fetchData()
        })
        .catch(() => {})
    },
    goMenuPerm(row) {
      this.$router.push({ path: '/system/menus', query: { role: row.id } })
    }
  }
}
</script>
