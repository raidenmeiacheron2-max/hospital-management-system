<template>
  <div class="app-page">
    <div class="panel-card">
      <el-form :inline="true" class="search-form" @submit.native.prevent="handleSearch">
        <el-form-item label="药品名称">
          <el-input v-model.trim="filters.name" placeholder="请输入药品名称" clearable @keyup.enter.native="handleSearch" />
        </el-form-item>
        <el-form-item label="药品编码">
          <el-input v-model.trim="filters.code" placeholder="请输入药品编码" clearable @keyup.enter.native="handleSearch" />
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
        <el-table-column prop="code" label="药品编码" min-width="100" />
        <el-table-column prop="name" label="药品名称" min-width="150" />
        <el-table-column prop="spec" label="规格" min-width="110">
          <template slot-scope="{ row }">{{ row.spec || '—' }}</template>
        </el-table-column>
        <el-table-column prop="unit" label="单位" width="70" />
        <el-table-column label="单价" min-width="90">
          <template slot-scope="{ row }">{{ fmtMoney(row.priceCents) }}</template>
        </el-table-column>
        <el-table-column prop="stock" label="库存" min-width="90" />
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

    <el-dialog :title="editing ? '修改药品' : '新增药品'" :visible.sync="dialogVisible" width="460px" :close-on-click-modal="false">
      <el-form ref="form" :model="form" :rules="formRules" label-width="90px">
        <el-form-item label="药品编码" prop="code">
          <el-input v-model.trim="form.code" placeholder="如 YP0011" />
        </el-form-item>
        <el-form-item label="药品名称" prop="name">
          <el-input v-model.trim="form.name" placeholder="请输入药品名称" />
        </el-form-item>
        <el-form-item label="规格">
          <el-input v-model.trim="form.spec" placeholder="如 0.25g*24粒" />
        </el-form-item>
        <el-form-item label="单位">
          <el-input v-model.trim="form.unit" placeholder="如 盒" />
        </el-form-item>
        <el-form-item label="单价(元)" prop="priceYuan">
          <el-input v-model="form.priceYuan" placeholder="如 12.50" />
        </el-form-item>
        <el-form-item label="库存" prop="stock">
          <el-input v-model="form.stock" placeholder="非负整数" />
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
import { apiListMedicines, apiCreateMedicine, apiUpdateMedicine, apiDeleteMedicine } from '@/api'
import { exportCsv } from '@/utils/csv'
import { fmtMoney, yuanToCents, centsToYuan, isValidCents } from '@/utils/money'
import { isNonNegativeInt } from '@/utils/validate'

export default {
  name: 'MedicineList',
  components: { StatusTag, Pagination },
  mixins: [listPage],
  data() {
    return {
      filters: { name: '', code: '' },
      dialogVisible: false,
      submitting: false,
      editing: null,
      form: this.emptyForm(),
      formRules: {
        code: [{ required: true, message: '请输入药品编码', trigger: 'blur' }],
        name: [{ required: true, message: '请输入药品名称', trigger: 'blur' }],
        priceYuan: [
          { required: true, message: '请输入单价', trigger: 'blur' },
          { validator: (r, v, cb) => (isValidCents(yuanToCents(v)) ? cb() : cb(new Error('价格须为非负数')), true), trigger: 'blur' }
        ],
        stock: [{ validator: (r, v, cb) => (isNonNegativeInt(v) ? cb() : cb(new Error('库存须为非负整数')), true), trigger: 'blur' }]
      }
    }
  },
  created() {
    this.fetchData()
  },
  methods: {
    fmtMoney,
    emptyForm() {
      return { code: '', name: '', spec: '', unit: '盒', priceYuan: '', stock: 0, status: 1 }
    },
    buildParams() {
      const p = { page: this.query.page, size: this.query.size }
      if (this.filters.name) p.name = this.filters.name
      if (this.filters.code) p.code = this.filters.code
      return p
    },
    async fetchData() {
      this.loading = true
      try {
        const res = await apiListMedicines(this.buildParams())
        this.list = res.list
        this.total = res.total
      } finally {
        this.loading = false
      }
    },
    resetFilters() {
      this.filters = { name: '', code: '' }
      this.handleSearch()
    },
    openDialog(row) {
      this.editing = row || null
      this.form = row
        ? { code: row.code, name: row.name, spec: row.spec, unit: row.unit, priceYuan: centsToYuan(row.priceCents), stock: row.stock, status: row.status }
        : this.emptyForm()
      this.dialogVisible = true
      this.$nextTick(() => this.$refs.form && this.$refs.form.clearValidate())
    },
    submitForm() {
      this.$refs.form.validate(async (valid) => {
        if (!valid || this.submitting) return
        this.submitting = true
        try {
          const payload = { ...this.form, priceCents: yuanToCents(this.form.priceYuan), stock: Number(this.form.stock) }
          delete payload.priceYuan
          if (this.editing) {
            await apiUpdateMedicine(this.editing.id, payload)
            this.$message.success('修改成功')
          } else {
            await apiCreateMedicine(payload)
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
      this.$confirm(`确定删除药品「${row.name}」吗？`, '删除确认', { type: 'warning' })
        .then(async () => {
          await apiDeleteMedicine(row.id)
          this.$message.success('删除成功')
          this.afterDelete()
        })
        .catch(() => {})
    },
    async exportCsv() {
      const res = await apiListMedicines({ ...this.buildParams(), page: 1, size: 1000 })
      exportCsv(
        `药品目录_${new Date().toISOString().slice(0, 10)}`,
        [
          { label: '药品编码', key: 'code' },
          { label: '药品名称', key: 'name' },
          { label: '规格', key: 'spec' },
          { label: '单位', key: 'unit' },
          { label: '单价(元)', key: 'priceYuan' },
          { label: '库存', key: 'stock' }
        ],
        res.list.map((r) => ({ ...r, priceYuan: centsToYuan(r.priceCents) }))
      )
      this.$message.success('已导出')
    }
  }
}
</script>
