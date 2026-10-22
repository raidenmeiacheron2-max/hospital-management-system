<template>
  <div class="app-page">
    <div class="panel-card">
      <el-form :inline="true" class="search-form" @submit.native.prevent="handleSearch">
        <el-form-item label="患者编号">
          <el-input v-model.trim="filters.code" placeholder="请输入患者编号" clearable @keyup.enter.native="handleSearch" />
        </el-form-item>
        <el-form-item label="患者姓名">
          <el-input v-model.trim="filters.name" placeholder="请输入患者姓名" clearable @keyup.enter.native="handleSearch" />
        </el-form-item>
        <el-form-item label="联系电话">
          <el-input v-model.trim="filters.phone" placeholder="请输入联系电话" clearable @keyup.enter.native="handleSearch" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" icon="el-icon-search" @click="handleSearch">搜索</el-button>
          <el-button icon="el-icon-refresh-left" @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>
    </div>

    <div class="panel-card">
      <div class="toolbar-row">
        <div class="toolbar-left">
          <el-button type="primary" icon="el-icon-plus" @click="openDialog()">新增</el-button>
          <el-button icon="el-icon-download" @click="exportCsv">导出</el-button>
        </div>
      </div>

      <el-table v-loading="loading" :data="list" style="width: 100%; margin-top: 12px">
        <el-table-column prop="code" label="患者编号" min-width="160" />
        <el-table-column prop="name" label="患者姓名" min-width="100" />
        <el-table-column label="性别" width="70">
          <template slot-scope="{ row }">
            <span :class="row.gender === '男' ? 'text-primary' : 'text-danger'">{{ row.gender }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="phone" label="联系电话" min-width="120" />
        <el-table-column prop="birthDate" label="出生日期" min-width="110">
          <template slot-scope="{ row }">{{ row.birthDate || '—' }}</template>
        </el-table-column>
        <el-table-column label="过敏史" min-width="160">
          <template slot-scope="{ row }">
            <span v-if="row.allergy" class="allergy">{{ row.allergy }}</span>
            <span v-else class="text-muted">无</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template slot-scope="{ row }">
            <StatusTag :label="row.status" />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right">
          <template slot-scope="{ row }">
            <div class="operation-links">
              <el-link type="primary" @click="openDialog(row)">修改</el-link>
              <el-link type="danger" @click="removeRow(row)">删除</el-link>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <div class="table-footer">
        <Pagination :total="total" :page="query.page" :size="query.size" @change="handlePageChange" />
      </div>
    </div>

    <el-dialog :title="editing ? '修改患者' : '新增患者'" :visible.sync="dialogVisible" width="480px" :close-on-click-modal="false">
      <el-form ref="form" :model="form" :rules="formRules" label-width="90px">
        <el-form-item label="患者姓名" prop="name">
          <el-input v-model.trim="form.name" placeholder="请输入患者姓名" />
        </el-form-item>
        <el-form-item label="性别" prop="gender">
          <el-radio-group v-model="form.gender">
            <el-radio label="男">男</el-radio>
            <el-radio label="女">女</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="联系电话" prop="phone">
          <el-input v-model.trim="form.phone" placeholder="请输入联系电话" />
        </el-form-item>
        <el-form-item label="出生日期">
          <el-date-picker v-model="form.birthDate" type="date" placeholder="选择日期" value-format="yyyy-MM-dd" style="width: 100%" />
        </el-form-item>
        <el-form-item label="过敏史">
          <el-input v-model.trim="form.allergy" placeholder="如：青霉素过敏（选填）" />
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
import { apiListPatients, apiCreatePatient, apiUpdatePatient, apiDeletePatient } from '@/api'
import { exportCsv } from '@/utils/csv'
import { isValidPhone } from '@/utils/validate'

export default {
  name: 'PatientList',
  components: { StatusTag, Pagination },
  mixins: [listPage],
  data() {
    return {
      filters: { code: '', name: '', phone: '' },
      dialogVisible: false,
      submitting: false,
      editing: null,
      form: this.emptyForm(),
      formRules: {
        name: [{ required: true, message: '请输入患者姓名', trigger: 'blur' }],
        gender: [{ required: true, message: '请选择性别', trigger: 'change' }],
        phone: [
          { required: true, message: '请输入联系电话', trigger: 'blur' },
          { validator: (r, v, cb) => (isValidPhone(v) ? cb() : cb(new Error('联系电话格式不正确')), true), trigger: 'blur' }
        ]
      }
    }
  },
  created() {
    this.fetchData()
  },
  methods: {
    emptyForm() {
      return { name: '', gender: '男', phone: '', birthDate: '', allergy: '' }
    },
    buildParams() {
      const p = { page: this.query.page, size: this.query.size }
      Object.keys(this.filters).forEach((k) => {
        if (this.filters[k] !== '') p[k] = this.filters[k]
      })
      return p
    },
    async fetchData() {
      this.loading = true
      try {
        const res = await apiListPatients(this.buildParams())
        this.list = res.list
        this.total = res.total
      } finally {
        this.loading = false
      }
    },
    resetFilters() {
      this.filters = { code: '', name: '', phone: '' }
      this.handleSearch()
    },
    openDialog(row) {
      this.editing = row || null
      this.form = row
        ? { name: row.name, gender: row.gender, phone: row.phone, birthDate: row.birthDate, allergy: row.allergy }
        : this.emptyForm()
      this.dialogVisible = true
      this.$nextTick(() => this.$refs.form && this.$refs.form.clearValidate())
    },
    submitForm() {
      this.$refs.form.validate(async (valid) => {
        if (!valid || this.submitting) return
        this.submitting = true
        try {
          if (this.editing) {
            await apiUpdatePatient(this.editing.id, this.form)
            this.$message.success('修改成功')
          } else {
            await apiCreatePatient(this.form)
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
    removeRow(row) {
      this.$confirm(`确定删除患者「${row.name}」吗？删除后不可恢复。`, '删除确认', { type: 'warning' })
        .then(async () => {
          await apiDeletePatient(row.id)
          this.$message.success('删除成功')
          this.afterDelete()
        })
        .catch(() => {})
    },
    async exportCsv() {
      const res = await apiListPatients({ ...this.buildParams(), page: 1, size: Math.min(this.total || 1000, 5000) })
      exportCsv(
        `患者档案_${new Date().toISOString().slice(0, 10)}`,
        [
          { label: '患者编号', key: 'code' },
          { label: '患者姓名', key: 'name' },
          { label: '性别', key: 'gender' },
          { label: '联系电话', key: 'phone' },
          { label: '出生日期', key: 'birthDate' },
          { label: '过敏史', key: 'allergy' },
          { label: '状态', key: 'status' }
        ],
        res.list
      )
      this.$message.success('已导出当前筛选结果')
    }
  }
}
</script>

<style lang="scss" scoped>
.allergy {
  color: #d98e2b;
  background: #fdf3e3;
  border: 1px solid #f5dfb8;
  border-radius: 3px;
  padding: 1px 6px;
  font-size: 12px;
}
</style>
