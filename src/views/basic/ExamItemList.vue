<template>
  <div class="app-page">
    <div class="panel-card">
      <el-form :inline="true" class="search-form" @submit.native.prevent="handleSearch">
        <el-form-item label="项目名称">
          <el-input v-model.trim="filters.name" placeholder="请输入项目名称" clearable @keyup.enter.native="handleSearch" />
        </el-form-item>
        <el-form-item label="项目分类">
          <el-select v-model="filters.category" placeholder="请选择分类" clearable>
            <el-option label="检验" value="检验" />
            <el-option label="检查" value="检查" />
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
        <el-table-column prop="code" label="项目编码" min-width="110" />
        <el-table-column prop="name" label="项目名称" min-width="150" />
        <el-table-column prop="category" label="项目分类" min-width="90" />
        <el-table-column label="价格" min-width="100">
          <template slot-scope="{ row }">{{ fmtMoney(row.priceCents) }}</template>
        </el-table-column>
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

    <el-dialog :title="editing ? '修改项目' : '新增项目'" :visible.sync="dialogVisible" width="440px" :close-on-click-modal="false">
      <el-form ref="form" :model="form" :rules="formRules" label-width="90px">
        <el-form-item label="项目编码" prop="code">
          <el-input v-model.trim="form.code" placeholder="如 JY0005" />
        </el-form-item>
        <el-form-item label="项目名称" prop="name">
          <el-input v-model.trim="form.name" placeholder="请输入项目名称" />
        </el-form-item>
        <el-form-item label="项目分类" prop="category">
          <el-select v-model="form.category" style="width: 100%">
            <el-option label="检验" value="检验" />
            <el-option label="检查" value="检查" />
          </el-select>
        </el-form-item>
        <el-form-item label="价格(元)" prop="priceYuan">
          <el-input v-model="form.priceYuan" placeholder="如 25.00" />
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
import { apiListExamItems, apiCreateExamItem, apiUpdateExamItem, apiDeleteExamItem } from '@/api'
import { exportCsv } from '@/utils/csv'
import { fmtMoney, yuanToCents, centsToYuan, isValidCents } from '@/utils/money'

export default {
  name: 'ExamItemList',
  components: { StatusTag, Pagination },
  mixins: [listPage],
  data() {
    return {
      filters: { name: '', category: '' },
      dialogVisible: false,
      submitting: false,
      editing: null,
      form: this.emptyForm(),
      formRules: {
        code: [{ required: true, message: '请输入项目编码', trigger: 'blur' }],
        name: [{ required: true, message: '请输入项目名称', trigger: 'blur' }],
        category: [{ required: true, message: '请选择项目分类', trigger: 'change' }],
        priceYuan: [
          { required: true, message: '请输入价格', trigger: 'blur' },
          { validator: (r, v, cb) => (isValidCents(yuanToCents(v)) ? cb() : cb(new Error('价格须为非负数')), true), trigger: 'blur' }
        ]
      }
    }
  },
  created() {
    this.fetchData()
  },
  methods: {
    fmtMoney,
    emptyForm() {
      return { code: '', name: '', category: '检验', priceYuan: '', status: 1 }
    },
    buildParams() {
      const p = { page: this.query.page, size: this.query.size }
      if (this.filters.name) p.name = this.filters.name
      if (this.filters.category) p.category = this.filters.category
      return p
    },
    async fetchData() {
      this.loading = true
      try {
        const res = await apiListExamItems(this.buildParams())
        this.list = res.list
        this.total = res.total
      } finally {
        this.loading = false
      }
    },
    resetFilters() {
      this.filters = { name: '', category: '' }
      this.handleSearch()
    },
    openDialog(row) {
      this.editing = row || null
      this.form = row
        ? { code: row.code, name: row.name, category: row.category, priceYuan: centsToYuan(row.priceCents), status: row.status }
        : this.emptyForm()
      this.dialogVisible = true
      this.$nextTick(() => this.$refs.form && this.$refs.form.clearValidate())
    },
    submitForm() {
      this.$refs.form.validate(async (valid) => {
        if (!valid || this.submitting) return
        this.submitting = true
        try {
          const payload = { ...this.form, priceCents: yuanToCents(this.form.priceYuan) }
          delete payload.priceYuan
          if (this.editing) {
            await apiUpdateExamItem(this.editing.id, payload)
            this.$message.success('修改成功')
          } else {
            await apiCreateExamItem(payload)
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
      this.$confirm(`确定删除项目「${row.name}」吗？`, '删除确认', { type: 'warning' })
        .then(async () => {
          await apiDeleteExamItem(row.id)
          this.$message.success('删除成功')
          this.afterDelete()
        })
        .catch(() => {})
    },
    async exportCsv() {
      const res = await apiListExamItems({ ...this.buildParams(), page: 1, size: 1000 })
      exportCsv(
        `检验检查项目_${new Date().toISOString().slice(0, 10)}`,
        [
          { label: '项目编码', key: 'code' },
          { label: '项目名称', key: 'name' },
          { label: '项目分类', key: 'category' },
          { label: '价格(元)', key: 'priceYuan' }
        ],
        res.list.map((r) => ({ ...r, priceYuan: centsToYuan(r.priceCents) }))
      )
      this.$message.success('已导出')
    }
  }
}
</script>
