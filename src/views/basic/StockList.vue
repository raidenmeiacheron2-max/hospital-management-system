<template>
  <div class="app-page">
    <div class="panel-card">
      <el-form :inline="true" class="search-form" @submit.native.prevent="handleSearch">
        <el-form-item label="药品">
          <el-select v-model="filters.medicineId" placeholder="请选择药品" clearable filterable>
            <el-option v-for="m in medicines" :key="m.id" :label="m.name" :value="m.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="批号">
          <el-input v-model.trim="filters.batchNo" placeholder="请输入批号" clearable @keyup.enter.native="handleSearch" />
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
        <el-table-column prop="medicineCode" label="药品编码" min-width="100" />
        <el-table-column prop="medicineName" label="药品名称" min-width="150" />
        <el-table-column prop="batchNo" label="批号" min-width="110" />
        <el-table-column label="数量" min-width="90">
          <template slot-scope="{ row }">{{ row.qty }} {{ row.unit }}</template>
        </el-table-column>
        <el-table-column prop="expiry" label="有效期至" min-width="110" />
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

    <el-dialog :title="editing ? '修改批次库存' : '新增批次库存'" :visible.sync="dialogVisible" width="440px" :close-on-click-modal="false">
      <el-form ref="form" :model="form" :rules="formRules" label-width="90px">
        <el-form-item label="药品" prop="medicineId">
          <el-select v-model="form.medicineId" placeholder="请选择药品" style="width: 100%" filterable>
            <el-option v-for="m in medicines" :key="m.id" :label="`${m.code} ${m.name}`" :value="m.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="批号" prop="batchNo">
          <el-input v-model.trim="form.batchNo" placeholder="如 20260901" />
        </el-form-item>
        <el-form-item label="数量" prop="qty">
          <el-input v-model="form.qty" placeholder="非负整数" />
        </el-form-item>
        <el-form-item label="有效期至" prop="expiry">
          <el-date-picker v-model="form.expiry" type="date" placeholder="选择日期" value-format="yyyy-MM-dd" style="width: 100%" />
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
import Pagination from '@/components/Pagination.vue'
import { apiListStocks, apiCreateStock, apiUpdateStock, apiDeleteStock, apiOptions } from '@/api'
import { exportCsv } from '@/utils/csv'
import { isNonNegativeInt } from '@/utils/validate'

export default {
  name: 'StockList',
  components: { Pagination },
  mixins: [listPage],
  data() {
    return {
      filters: { medicineId: '', batchNo: '' },
      medicines: [],
      dialogVisible: false,
      submitting: false,
      editing: null,
      form: this.emptyForm(),
      formRules: {
        medicineId: [{ required: true, message: '请选择药品', trigger: 'change' }],
        batchNo: [{ required: true, message: '请输入批号', trigger: 'blur' }],
        qty: [{ validator: (r, v, cb) => (isNonNegativeInt(v) ? cb() : cb(new Error('数量须为非负整数')), true), trigger: 'blur' }],
        expiry: [{ required: true, message: '请选择有效期', trigger: 'change' }]
      }
    }
  },
  created() {
    this.fetchData()
    this.loadOptions()
  },
  methods: {
    emptyForm() {
      return { medicineId: '', batchNo: '', qty: '', expiry: '' }
    },
    async loadOptions() {
      this.medicines = await apiOptions('medicines')
    },
    buildParams() {
      const p = { page: this.query.page, size: this.query.size }
      if (this.filters.medicineId) p.medicineId = this.filters.medicineId
      if (this.filters.batchNo) p.batchNo = this.filters.batchNo
      return p
    },
    async fetchData() {
      this.loading = true
      try {
        const res = await apiListStocks(this.buildParams())
        this.list = res.list
        this.total = res.total
      } finally {
        this.loading = false
      }
    },
    resetFilters() {
      this.filters = { medicineId: '', batchNo: '' }
      this.handleSearch()
    },
    openDialog(row) {
      this.editing = row || null
      this.form = row
        ? { medicineId: row.medicineId, batchNo: row.batchNo, qty: row.qty, expiry: row.expiry }
        : this.emptyForm()
      this.dialogVisible = true
      this.$nextTick(() => this.$refs.form && this.$refs.form.clearValidate())
    },
    submitForm() {
      this.$refs.form.validate(async (valid) => {
        if (!valid || this.submitting) return
        this.submitting = true
        try {
          const payload = { ...this.form, qty: Number(this.form.qty) }
          if (this.editing) {
            await apiUpdateStock(this.editing.id, payload)
            this.$message.success('修改成功')
          } else {
            await apiCreateStock(payload)
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
      this.$confirm(`确定删除批次「${row.batchNo}」吗？`, '删除确认', { type: 'warning' })
        .then(async () => {
          await apiDeleteStock(row.id)
          this.$message.success('删除成功')
          this.afterDelete()
        })
        .catch(() => {})
    },
    async exportCsv() {
      const res = await apiListStocks({ ...this.buildParams(), page: 1, size: 1000 })
      exportCsv(
        `批次库存_${new Date().toISOString().slice(0, 10)}`,
        [
          { label: '药品编码', key: 'medicineCode' },
          { label: '药品名称', key: 'medicineName' },
          { label: '批号', key: 'batchNo' },
          { label: '数量', key: 'qty' },
          { label: '有效期至', key: 'expiry' }
        ],
        res.list
      )
      this.$message.success('已导出')
    }
  }
}
</script>
