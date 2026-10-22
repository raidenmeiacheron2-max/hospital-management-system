<template>
  <div class="app-page">
    <div class="panel-card">
      <el-form :inline="true" class="search-form" @submit.native.prevent="handleSearch">
        <el-form-item label="病区名称">
          <el-input v-model.trim="filters.name" placeholder="请输入病区名称" clearable @keyup.enter.native="handleSearch" />
        </el-form-item>
        <el-form-item label="所属科室">
          <el-select v-model="filters.departmentId" placeholder="请选择科室" clearable filterable>
            <el-option v-for="d in departments" :key="d.id" :label="d.name" :value="d.id" />
          </el-select>
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
        <el-table-column prop="code" label="病区编号" min-width="100" />
        <el-table-column prop="name" label="病区名称" min-width="130" />
        <el-table-column prop="departmentName" label="所属科室" min-width="110" />
        <el-table-column prop="floor" label="楼层" min-width="80" />
        <el-table-column prop="headNurse" label="护士长" min-width="100">
          <template slot-scope="{ row }">{{ row.headNurse || '—' }}</template>
        </el-table-column>
        <el-table-column prop="bedCount" label="床位数" min-width="90" />
        <el-table-column label="状态" width="90">
          <template slot-scope="{ row }">
            <StatusTag :label="row.status ? '正常' : '停用'" />
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

    <el-dialog :title="editing ? '修改病区' : '新增病区'" :visible.sync="dialogVisible" width="440px" :close-on-click-modal="false">
      <el-form ref="form" :model="form" :rules="formRules" label-width="90px">
        <el-form-item label="病区编号" prop="code">
          <el-input v-model.trim="form.code" placeholder="如 W007" />
        </el-form-item>
        <el-form-item label="病区名称" prop="name">
          <el-input v-model.trim="form.name" placeholder="请输入病区名称" />
        </el-form-item>
        <el-form-item label="所属科室" prop="departmentId">
          <el-select v-model="form.departmentId" placeholder="请选择科室" style="width: 100%" filterable>
            <el-option v-for="d in departments" :key="d.id" :label="d.name" :value="d.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="楼层">
          <el-input v-model.trim="form.floor" placeholder="如 3F" />
        </el-form-item>
        <el-form-item label="护士长">
          <el-input v-model.trim="form.headNurse" placeholder="选填" />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="form.status" style="width: 100%">
            <el-option label="正常" :value="1" />
            <el-option label="停用" :value="0" />
          </el-select>
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
import { apiListWards, apiCreateWard, apiUpdateWard, apiDeleteWard, apiOptions } from '@/api'
import { exportCsv } from '@/utils/csv'

export default {
  name: 'WardList',
  components: { StatusTag, Pagination },
  mixins: [listPage],
  data() {
    return {
      filters: { name: '', departmentId: '' },
      departments: [],
      dialogVisible: false,
      submitting: false,
      editing: null,
      form: this.emptyForm(),
      formRules: {
        code: [{ required: true, message: '请输入病区编号', trigger: 'blur' }],
        name: [{ required: true, message: '请输入病区名称', trigger: 'blur' }],
        departmentId: [{ required: true, message: '请选择所属科室', trigger: 'change' }]
      }
    }
  },
  created() {
    this.fetchData()
    this.loadOptions()
  },
  methods: {
    emptyForm() {
      return { code: '', name: '', departmentId: '', floor: '', headNurse: '', status: 1 }
    },
    async loadOptions() {
      this.departments = await apiOptions('departments')
    },
    buildParams() {
      const p = { page: this.query.page, size: this.query.size }
      if (this.filters.name) p.name = this.filters.name
      if (this.filters.departmentId) p.departmentId = this.filters.departmentId
      return p
    },
    async fetchData() {
      this.loading = true
      try {
        const res = await apiListWards(this.buildParams())
        this.list = res.list
        this.total = res.total
      } finally {
        this.loading = false
      }
    },
    resetFilters() {
      this.filters = { name: '', departmentId: '' }
      this.handleSearch()
    },
    openDialog(row) {
      this.editing = row || null
      this.form = row
        ? { code: row.code, name: row.name, departmentId: row.departmentId, floor: row.floor, headNurse: row.headNurse, status: row.status }
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
            await apiUpdateWard(this.editing.id, this.form)
            this.$message.success('修改成功')
          } else {
            await apiCreateWard(this.form)
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
      this.$confirm(`确定删除病区「${row.name}」吗？`, '删除确认', { type: 'warning' })
        .then(async () => {
          await apiDeleteWard(row.id)
          this.$message.success('删除成功')
          this.afterDelete()
        })
        .catch(() => {})
    },
    async exportCsv() {
      const res = await apiListWards({ ...this.buildParams(), page: 1, size: 1000 })
      exportCsv(
        `病区列表_${new Date().toISOString().slice(0, 10)}`,
        [
          { label: '病区编号', key: 'code' },
          { label: '病区名称', key: 'name' },
          { label: '所属科室', key: 'departmentName' },
          { label: '楼层', key: 'floor' },
          { label: '护士长', key: 'headNurse' },
          { label: '床位数', key: 'bedCount' }
        ],
        res.list
      )
      this.$message.success('已导出')
    }
  }
}
</script>
