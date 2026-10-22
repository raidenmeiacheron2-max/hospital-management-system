<template>
  <div class="app-page">
    <div class="panel-card">
      <el-form :inline="true" class="search-form" @submit.native.prevent="handleSearch">
        <el-form-item label="住院患者">
          <el-select v-model="filters.admissionId" placeholder="请选择在院患者" clearable filterable>
            <el-option
              v-for="a in admissions"
              :key="a.id"
              :label="`${a.code} · ${a.patientName}（${a.wardName} ${a.bedCode}）`"
              :value="a.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="执行状态">
          <el-select v-model="filters.status" placeholder="请选择状态" clearable>
            <el-option label="未执行" value="未执行" />
            <el-option label="已执行" value="已执行" />
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
          <el-button type="primary" icon="el-icon-plus" @click="openDialog">开立医嘱</el-button>
        </div>
      </div>

      <el-table v-loading="loading" :data="list" style="width: 100%; margin-top: 12px">
        <el-table-column prop="admissionCode" label="住院号" min-width="140" />
        <el-table-column prop="patientName" label="患者" min-width="90" />
        <el-table-column prop="wardName" label="病区" min-width="110" />
        <el-table-column prop="type" label="医嘱类型" width="100" />
        <el-table-column prop="name" label="项目" min-width="140" />
        <el-table-column prop="qty" label="数量" width="70" />
        <el-table-column label="单价" width="90">
          <template slot-scope="{ row }">¥{{ centsToYuan(row.priceCents) }}</template>
        </el-table-column>
        <el-table-column label="金额" width="100">
          <template slot-scope="{ row }">¥{{ centsToYuan(row.amountCents) }}</template>
        </el-table-column>
        <el-table-column label="执行状态" width="100">
          <template slot-scope="{ row }">
            <StatusTag :label="row.status" />
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="开立时间" min-width="150" />
        <el-table-column label="操作" width="140" fixed="right">
          <template slot-scope="{ row }">
            <div class="operation-links">
              <el-link v-if="row.status === '未执行'" type="primary" @click="executeRow(row)">执行</el-link>
              <el-link v-if="row.status === '未执行'" type="danger" @click="cancelRow(row)">作废</el-link>
              <span v-if="row.status === '已执行'" class="text-muted" style="font-size: 12px">—</span>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <div class="table-footer">
        <Pagination :total="total" :page="query.page" :size="query.size" @change="handlePageChange" />
      </div>
    </div>

    <el-dialog title="开立医嘱" :visible.sync="dialogVisible" width="480px" :close-on-click-modal="false">
      <el-form ref="form" :model="form" :rules="formRules" label-width="90px">
        <el-form-item label="住院患者" prop="admissionId">
          <el-select v-model="form.admissionId" placeholder="请选择在院患者" style="width: 100%" filterable>
            <el-option
              v-for="a in admissions"
              :key="a.id"
              :label="`${a.code} · ${a.patientName}`"
              :value="a.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="医嘱类型" prop="type">
          <el-select v-model="form.type" placeholder="请选择医嘱类型" style="width: 100%" @change="form.refId = ''">
            <el-option label="药品" value="药品" />
            <el-option label="医技项目" value="医技项目" />
            <el-option label="收费项目" value="收费项目" />
          </el-select>
        </el-form-item>
        <el-form-item label="项目" prop="refId">
          <el-select v-model="form.refId" placeholder="请选择项目" style="width: 100%" filterable @change="onItemChange">
            <el-option v-for="it in itemOptions" :key="it.id" :label="`${it.name}（¥${centsToYuan(it.priceCents)}）`" :value="it.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="数量" prop="qty">
          <el-input-number v-model="form.qty" :min="1" :max="99" style="width: 100%" />
        </el-form-item>
        <el-form-item label="单价(元)">
          <el-input :value="form.priceCents === null ? '' : centsToYuan(form.priceCents)" disabled />
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
import { apiListOrders, apiCreateOrder, apiExecuteOrder, apiCancelOrder, apiOptions } from '@/api'
import { centsToYuan } from '@/utils/money'

export default {
  name: 'OrderList',
  components: { StatusTag, Pagination },
  mixins: [listPage],
  data() {
    return {
      filters: { admissionId: '', status: '' },
      admissions: [],
      medicines: [],
      examItems: [],
      feeItems: [],
      dialogVisible: false,
      submitting: false,
      form: { admissionId: '', type: '药品', refId: '', qty: 1, priceCents: null },
      formRules: {
        admissionId: [{ required: true, message: '请选择住院患者', trigger: 'change' }],
        type: [{ required: true, message: '请选择医嘱类型', trigger: 'change' }],
        refId: [{ required: true, message: '请选择项目', trigger: 'change' }]
      }
    }
  },
  computed: {
    itemOptions() {
      if (this.form.type === '药品') return this.medicines
      if (this.form.type === '医技项目') return this.examItems
      return this.feeItems
    }
  },
  created() {
    this.fetchData()
    this.loadOptions()
  },
  methods: {
    centsToYuan,
    async loadOptions() {
      const [meds, exams, fees] = await Promise.all([apiOptions('medicines'), apiOptions('exam-items'), apiOptions('fee-items')])
      this.medicines = meds
      this.examItems = exams
      this.feeItems = fees
      const adms = await apiOptions('adm-inside')
      this.admissions = adms
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
        const res = await apiListOrders(this.buildParams())
        this.list = res.list
        this.total = res.total
      } finally {
        this.loading = false
      }
    },
    resetFilters() {
      this.filters = { admissionId: '', status: '' }
      this.handleSearch()
    },
    openDialog() {
      this.form = { admissionId: '', type: '药品', refId: '', qty: 1, priceCents: null }
      this.dialogVisible = true
      this.$nextTick(() => this.$refs.form && this.$refs.form.clearValidate())
    },
    onItemChange(id) {
      const it = this.itemOptions.find((x) => x.id === id)
      this.form.priceCents = it ? it.priceCents : null
    },
    submitForm() {
      this.$refs.form.validate(async (valid) => {
        if (!valid || this.submitting) return
        this.submitting = true
        try {
          await apiCreateOrder(this.form)
          this.$message.success('医嘱已开立')
          this.dialogVisible = false
          this.fetchData()
        } catch (e) {
          /* 拦截器已提示 */
        } finally {
          this.submitting = false
        }
      })
    },
    executeRow(row) {
      this.$confirm(`确定执行医嘱「${row.name} ×${row.qty}」吗？`, '执行确认', { type: 'info' })
        .then(async () => {
          await apiExecuteOrder(row.id)
          this.$message.success('医嘱已执行')
          this.fetchData()
        })
        .catch(() => {})
    },
    cancelRow(row) {
      this.$confirm(`确定作废医嘱「${row.name}」吗？`, '作废确认', { type: 'warning' })
        .then(async () => {
          await apiCancelOrder(row.id)
          this.$message.success('医嘱已作废')
          this.afterDelete()
        })
        .catch(() => {})
    }
  }
}
</script>
