<template>
  <div class="app-page">
    <!-- 筛选 -->
    <div class="panel-card">
      <el-form :inline="true" class="search-form" @submit.native.prevent="handleSearch">
        <el-form-item label="员工姓名">
          <el-input v-model.trim="filters.name" placeholder="请输入员工姓名" clearable @keyup.enter.native="handleSearch" />
        </el-form-item>
        <el-form-item label="账号状态">
          <el-select v-model="filters.enabled" placeholder="请选择账号状态" clearable>
            <el-option label="启用" value="1" />
            <el-option label="停用" value="0" />
          </el-select>
        </el-form-item>
        <el-form-item label="员工类型">
          <el-select v-model="filters.type" placeholder="请选择员工类型" clearable>
            <el-option v-for="t in staffTypes" :key="t" :label="t" :value="t" />
          </el-select>
        </el-form-item>
        <el-form-item label="所属科室">
          <el-select v-model="filters.departmentId" placeholder="请选择科室" clearable filterable>
            <el-option v-for="d in departments" :key="d.id" :label="d.name" :value="d.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="登录账号">
          <el-input v-model.trim="filters.loginAccount" placeholder="请输入登录账号" clearable @keyup.enter.native="handleSearch" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" icon="el-icon-search" @click="handleSearch">搜索</el-button>
          <el-button icon="el-icon-refresh-left" @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>
    </div>

    <!-- 表格 -->
    <div class="panel-card">
      <div class="toolbar-row">
        <div class="toolbar-left">
          <el-button type="primary" icon="el-icon-plus" @click="openDialog()">新增</el-button>
          <el-button icon="el-icon-delete" :disabled="!selection.length" @click="batchDelete">删除</el-button>
          <el-button icon="el-icon-download" @click="exportCsv">导出</el-button>
        </div>
        <div class="toolbar-right">
          <span v-if="selection.length" class="text-muted">已选 {{ selection.length }} 项</span>
        </div>
      </div>

      <el-table
        v-loading="loading"
        :data="list"
        style="width: 100%; margin-top: 12px"
        @selection-change="(rows) => (selection = rows)"
      >
        <el-table-column type="selection" width="46" />
        <el-table-column label="工号/姓名" min-width="120">
          <template slot-scope="{ row }">
            <div>{{ row.code }}</div>
            <div class="text-muted" style="font-size: 12px">{{ row.name }}</div>
          </template>
        </el-table-column>
        <el-table-column prop="type" label="员工类型" min-width="100" />
        <el-table-column prop="departmentName" label="所属科室" min-width="100" />
        <el-table-column prop="phone" label="联系电话" min-width="120" />
        <el-table-column prop="loginAccount" label="登录账号" min-width="120" />
        <el-table-column prop="role" label="账号角色" min-width="110" />
        <el-table-column label="账号状态" min-width="90">
          <template slot-scope="{ row }">
            <el-switch :value="row.enabled" @change="(v) => toggleEnabled(row, v)" />
          </template>
        </el-table-column>
        <el-table-column prop="lastLoginAt" label="最后登录" min-width="150" />
        <el-table-column label="操作" width="200" fixed="right">
          <template slot-scope="{ row }">
            <div class="operation-links">
              <el-link type="primary" @click="openDialog(row)">修改</el-link>
              <el-link type="warning" @click="resetPassword(row)">重置密码</el-link>
              <el-link type="danger" @click="removeRow(row)">删除</el-link>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <div class="table-footer">
        <Pagination :total="total" :page="query.page" :size="query.size" @change="handlePageChange" />
      </div>
    </div>

    <!-- 新增/编辑弹窗 -->
    <el-dialog :title="editing ? '修改员工' : '新增员工'" :visible.sync="dialogVisible" width="520px" :close-on-click-modal="false">
      <el-form ref="form" :model="form" :rules="formRules" label-width="90px">
        <el-form-item label="员工姓名" prop="name">
          <el-input v-model.trim="form.name" placeholder="请输入员工姓名" />
        </el-form-item>
        <el-form-item label="员工类型" prop="type">
          <el-select v-model="form.type" placeholder="请选择员工类型" style="width: 100%">
            <el-option v-for="t in staffTypes" :key="t" :label="t" :value="t" />
          </el-select>
        </el-form-item>
        <el-form-item label="所属科室" prop="departmentId">
          <el-select v-model="form.departmentId" placeholder="请选择科室" style="width: 100%" filterable>
            <el-option v-for="d in departments" :key="d.id" :label="d.name" :value="d.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="联系电话" prop="phone">
          <el-input v-model.trim="form.phone" placeholder="请输入联系电话" />
        </el-form-item>
        <el-form-item label="登录账号" prop="loginAccount">
          <el-input v-model.trim="form.loginAccount" placeholder="3-20 位字母/数字/下划线" />
        </el-form-item>
        <el-form-item label="账号角色" prop="role">
          <el-input v-model.trim="form.role" placeholder="如：门诊医生" />
        </el-form-item>
        <el-form-item label="账号状态">
          <el-switch v-model="form.enabled" active-text="启用" inactive-text="停用" />
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
import listPage from '@/mixins/listPage'
import StatusTag from '@/components/StatusTag.vue'
import Pagination from '@/components/Pagination.vue'
import { apiListStaff, apiCreateStaff, apiUpdateStaff, apiDeleteStaff, apiSetStaffEnabled, apiResetStaffPassword, apiOptions } from '@/api'
import { exportCsv } from '@/utils/csv'
import { isValidPhone } from '@/utils/validate'

export default {
  name: 'StaffList',
  components: { StatusTag, Pagination },
  mixins: [listPage],
  data() {
    return {
      filters: { name: '', enabled: '', type: '', departmentId: '', loginAccount: '' },
      staffTypes: ['系统管理员', '门诊医生', '住院医生', '收费人员', '护士'],
      departments: [],
      selection: [],
      dialogVisible: false,
      submitting: false,
      editing: null,
      form: this.emptyForm(),
      formRules: {
        name: [{ required: true, message: '请输入员工姓名', trigger: 'blur' }],
        type: [{ required: true, message: '请选择员工类型', trigger: 'change' }],
        phone: [
          { required: true, message: '请输入联系电话', trigger: 'blur' },
          { validator: (r, v, cb) => (isValidPhone(v) ? cb() : cb(new Error('联系电话格式不正确')), true), trigger: 'blur' }
        ],
        loginAccount: [
          { required: true, message: '请输入登录账号', trigger: 'blur' },
          { pattern: /^[A-Za-z0-9_]{3,20}$/, message: '须为 3-20 位字母/数字/下划线', trigger: 'blur' }
        ]
      }
    }
  },
  created() {
    this.fetchData()
    this.loadOptions()
  },
  methods: {
    emptyForm() {
      return { name: '', type: '门诊医生', departmentId: '', phone: '', loginAccount: '', role: '', enabled: true }
    },
    async loadOptions() {
      const deps = await apiOptions('departments')
      this.departments = deps
    },
    buildParams() {
      const p = { page: this.query.page, size: this.query.size }
      Object.keys(this.filters).forEach((k) => {
        if (this.filters[k] !== '' && this.filters[k] !== null) p[k] = this.filters[k]
      })
      return p
    },
    async fetchData() {
      this.loading = true
      try {
        const res = await apiListStaff(this.buildParams())
        this.list = res.list
        this.total = res.total
      } finally {
        this.loading = false
      }
    },
    resetFilters() {
      this.filters = { name: '', enabled: '', type: '', departmentId: '', loginAccount: '' }
      this.handleSearch()
    },
    openDialog(row) {
      this.editing = row || null
      this.form = row ? { name: row.name, type: row.type, departmentId: row.departmentId, phone: row.phone, loginAccount: row.loginAccount, role: row.role, enabled: row.enabled } : this.emptyForm()
      this.dialogVisible = true
      this.$nextTick(() => this.$refs.form && this.$refs.form.clearValidate())
    },
    submitForm() {
      this.$refs.form.validate(async (valid) => {
        if (!valid || this.submitting) return
        this.submitting = true
        try {
          if (this.editing) {
            await apiUpdateStaff(this.editing.id, this.form)
            this.$message.success('修改成功')
          } else {
            await apiCreateStaff(this.form)
            this.$message.success('新增成功')
          }
          this.dialogVisible = false
          this.fetchData()
        } catch (e) {
          /* 拦截器已提示 */
        } finally {
          this.submitting = false
        }
      })
    },
    async toggleEnabled(row, v) {
      try {
        await apiSetStaffEnabled(row.id, v)
        row.enabled = v
        this.$message.success(v ? '账号已启用' : '账号已停用')
      } catch (e) {
        /* 拦截器已提示，开关回弹 */
        row.enabled = !v
        this.$forceUpdate()
      }
    },
    resetPassword(row) {
      this.$confirm(`确定将员工「${row.name}」的密码重置为默认密码 123456 吗？`, '重置密码', { type: 'warning' })
        .then(async () => {
          await apiResetStaffPassword(row.id)
          this.$message.success('密码已重置为 123456')
        })
        .catch(() => {})
    },
    removeRow(row) {
      this.$confirm(`确定删除员工「${row.name}」吗？删除后不可恢复。`, '删除确认', { type: 'warning' })
        .then(async () => {
          await apiDeleteStaff(row.id)
          this.$message.success('删除成功')
          this.afterDelete()
        })
        .catch(() => {})
    },
    batchDelete() {
      const names = this.selection.map((r) => r.name).join('、')
      this.$confirm(`确定删除选中的 ${this.selection.length} 名员工（${names}）吗？`, '批量删除确认', { type: 'warning' })
        .then(async () => {
          const ids = this.selection.map((r) => r.id)
          let failCount = 0
          for (const id of ids) {
            try {
              await apiDeleteStaff(id)
            } catch (e) {
              failCount++
            }
          }
          this.$message.success(`删除完成${failCount ? `，${failCount} 条因存在业务引用未删除` : ''}`)
          this.afterDelete()
        })
        .catch(() => {})
    },
    async exportCsv() {
      const res = await apiListStaff({ ...this.buildParams(), page: 1, size: Math.min(this.total || 1000, 5000) })
      exportCsv(
        `员工列表_${new Date().toISOString().slice(0, 10)}`,
        [
          { label: '工号', key: 'code' },
          { label: '姓名', key: 'name' },
          { label: '员工类型', key: 'type' },
          { label: '所属科室', key: 'departmentName' },
          { label: '联系电话', key: 'phone' },
          { label: '登录账号', key: 'loginAccount' },
          { label: '账号角色', key: 'role' },
          { label: '账号状态', key: 'enabledText' },
          { label: '最后登录', key: 'lastLoginAt' }
        ],
        res.list.map((r) => ({ ...r, enabledText: r.enabled ? '启用' : '停用' }))
      )
      this.$message.success('已导出当前筛选结果')
    }
  }
}
</script>
