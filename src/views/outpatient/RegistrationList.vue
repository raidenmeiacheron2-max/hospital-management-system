<template>
  <div class="app-page">
    <div class="panel-card">
      <el-form :inline="true" class="search-form" @submit.native.prevent="handleSearch">
        <el-form-item label="挂号编号">
          <el-input v-model.trim="filters.code" placeholder="请输入挂号编号" clearable @keyup.enter.native="handleSearch" />
        </el-form-item>
        <el-form-item label="患者姓名">
          <el-input v-model.trim="filters.patientName" placeholder="请输入患者姓名" clearable @keyup.enter.native="handleSearch" />
        </el-form-item>
        <el-form-item label="科室">
          <el-select v-model="filters.departmentId" placeholder="请选择科室" clearable filterable>
            <el-option v-for="d in departments" :key="d.id" :label="d.name" :value="d.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="挂号状态">
          <el-select v-model="filters.regStatus" placeholder="请选择状态" clearable>
            <el-option label="待分诊" value="待分诊" />
            <el-option label="已完成" value="已完成" />
            <el-option label="已退号" value="已退号" />
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
          <el-button icon="el-icon-remove-outline" :disabled="!selection.length" @click="batchRefund">退号</el-button>
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
        <el-table-column type="selection" width="46" :selectable="(row) => row.regStatus === '待分诊' && !row.visitId" />
        <el-table-column prop="code" label="挂号编号" min-width="150" />
        <el-table-column prop="patientName" label="患者" min-width="100" />
        <el-table-column prop="patientPhone" label="联系电话" min-width="120" />
        <el-table-column prop="date" label="就诊日期" min-width="110" />
        <el-table-column prop="period" label="时段" width="80" />
        <el-table-column prop="departmentName" label="科室" min-width="90" />
        <el-table-column prop="doctorName" label="医生" min-width="90" />
        <el-table-column label="挂号费" width="90">
          <template slot-scope="{ row }">¥{{ row.feeYuan }}</template>
        </el-table-column>
        <el-table-column label="挂号状态" width="100">
          <template slot-scope="{ row }">
            <StatusTag :label="row.regStatus" />
          </template>
        </el-table-column>
        <el-table-column label="收费状态" width="100">
          <template slot-scope="{ row }">
            <StatusTag :label="row.payStatus" />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120" fixed="right">
          <template slot-scope="{ row }">
            <div class="operation-links">
              <el-link v-if="row.regStatus === '待分诊' && !row.visitId" type="warning" @click="refundRow(row)">退号</el-link>
              <el-link v-else-if="row.regStatus === '待分诊' && row.visitId" type="primary" @click="goVisit">去接诊</el-link>
              <span v-else class="text-muted" style="font-size: 12px">—</span>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <div class="table-footer">
        <Pagination :total="total" :page="query.page" :size="query.size" @change="handlePageChange" />
      </div>
    </div>

    <!-- 新增挂号 -->
    <el-dialog title="新增挂号" :visible.sync="dialogVisible" width="520px" :close-on-click-modal="false">
      <el-form ref="form" :model="form" :rules="formRules" label-width="90px">
        <el-form-item label="患者" prop="patientId">
          <el-select v-model="form.patientId" placeholder="请选择患者" style="width: 100%" filterable>
            <el-option v-for="p in patients" :key="p.id" :label="`${p.name}（${p.code}）`" :value="p.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="科室" prop="departmentId">
          <el-select v-model="form.departmentId" placeholder="请选择科室" style="width: 100%" filterable @change="onDeptChange">
            <el-option v-for="d in departments" :key="d.id" :label="d.name" :value="d.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="就诊日期" prop="date">
          <el-date-picker v-model="form.date" type="date" placeholder="选择日期" value-format="yyyy-MM-dd" style="width: 100%" @change="loadDoctors" />
        </el-form-item>
        <el-form-item label="时段" prop="period">
          <el-select v-model="form.period" placeholder="请选择时段" style="width: 100%" @change="loadDoctors">
            <el-option label="上午" value="上午" />
            <el-option label="下午" value="下午" />
          </el-select>
        </el-form-item>
        <el-form-item label="医生" prop="doctorId">
          <el-select v-model="form.doctorId" placeholder="请先选择科室与日期" style="width: 100%" filterable :loading="loadingDoctors">
            <el-option v-for="d in availableDoctors" :key="d.id" :label="`${d.name}（剩余号源 ${d.limit - d.regCount}）`" :value="d.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="挂号费">
          <span class="fee-preview">¥{{ (form.departmentId === 'dep4' ? 20 : 15).toFixed(2) }}</span>
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
import { apiListRegistrations, apiCreateRegistration, apiRefundRegistration, apiOptions, apiListSchedules, apiStats } from '@/api'
import { exportCsv } from '@/utils/csv'

export default {
  name: 'RegistrationList',
  components: { StatusTag, Pagination },
  mixins: [listPage],
  data() {
    return {
      filters: { code: '', patientName: '', departmentId: '', regStatus: '' },
      departments: [],
      patients: [],
      selection: [],
      dialogVisible: false,
      submitting: false,
      loadingDoctors: false,
      availableDoctors: [],
      form: { patientId: '', departmentId: '', date: '', period: '上午', doctorId: '' },
      formRules: {
        patientId: [{ required: true, message: '请选择患者', trigger: 'change' }],
        departmentId: [{ required: true, message: '请选择科室', trigger: 'change' }],
        date: [{ required: true, message: '请选择就诊日期', trigger: 'change' }],
        period: [{ required: true, message: '请选择时段', trigger: 'change' }],
        doctorId: [{ required: true, message: '请选择医生', trigger: 'change' }]
      }
    }
  },
  created() {
    this.fetchData()
    this.loadOptions()
  },
  methods: {
    async loadOptions() {
      const [deps, pats, stats] = await Promise.all([apiOptions('departments'), apiOptions('patients'), apiStats()])
      this.departments = deps
      this.patients = pats
      this.form.date = stats.today
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
        const res = await apiListRegistrations(this.buildParams())
        this.list = res.list
        this.total = res.total
      } finally {
        this.loading = false
      }
    },
    resetFilters() {
      this.filters = { code: '', patientName: '', departmentId: '', regStatus: '' }
      this.handleSearch()
    },
    openDialog() {
      this.form = { patientId: '', departmentId: '', date: this.form.date || '2026-08-28', period: '上午', doctorId: '' }
      this.availableDoctors = []
      this.dialogVisible = true
      this.$nextTick(() => this.$refs.form && this.$refs.form.clearValidate())
    },
    onDeptChange() {
      this.form.doctorId = ''
      this.loadDoctors()
    },
    async loadDoctors() {
      this.form.doctorId = ''
      if (!this.form.departmentId || !this.form.date || !this.form.period) return
      this.loadingDoctors = true
      try {
        const res = await apiListSchedules({
          departmentId: this.form.departmentId,
          date: this.form.date,
          period: this.form.period,
          size: 10000
        })
        // 排班行 → 医生选项（同医生多排班去重）
        const seen = {}
        this.availableDoctors = res.list
          .filter((s) => s.doctorId)
          .reduce((acc, s) => {
            if (seen[s.doctorId]) return acc
            seen[s.doctorId] = true
            acc.push({ id: s.doctorId, name: s.doctorName, limit: s.limit, regCount: s.regCount })
            return acc
          }, [])
      } finally {
        this.loadingDoctors = false
      }
    },
    submitForm() {
      this.$refs.form.validate(async (valid) => {
        if (!valid || this.submitting) return
        this.submitting = true
        try {
          await apiCreateRegistration(this.form)
          this.$message.success('挂号成功')
          this.dialogVisible = false
          this.fetchData()
        } catch (e) {
          /* 拦截器已提示 */
        } finally {
          this.submitting = false
        }
      })
    },
    refundRow(row) {
      this.$confirm(`确定对挂号「${row.code}」（${row.patientName}）执行退号吗？已缴费用将原路退回。`, '退号确认', { type: 'warning' })
        .then(async () => {
          await apiRefundRegistration(row.id)
          this.$message.success('退号成功')
          this.fetchData()
        })
        .catch(() => {})
    },
    batchRefund() {
      this.$confirm(`确定对选中的 ${this.selection.length} 条挂号执行退号吗？`, '批量退号确认', { type: 'warning' })
        .then(async () => {
          let failCount = 0
          for (const row of this.selection) {
            try {
              await apiRefundRegistration(row.id)
            } catch (e) {
              failCount++
            }
          }
          this.$message.success(`退号完成${failCount ? `，${failCount} 条失败` : ''}`)
          this.fetchData()
        })
        .catch(() => {})
    },
    goVisit() {
      this.$router.push('/outpatient/visits')
    },
    async exportCsv() {
      const res = await apiListRegistrations({ ...this.buildParams(), page: 1, size: Math.min(this.total || 1000, 5000) })
      exportCsv(
        `门诊挂号_${new Date().toISOString().slice(0, 10)}`,
        [
          { label: '挂号编号', key: 'code' },
          { label: '患者', key: 'patientName' },
          { label: '联系电话', key: 'patientPhone' },
          { label: '就诊日期', key: 'date' },
          { label: '时段', key: 'period' },
          { label: '科室', key: 'departmentName' },
          { label: '医生', key: 'doctorName' },
          { label: '挂号费', key: 'feeYuan' },
          { label: '挂号状态', key: 'regStatus' },
          { label: '收费状态', key: 'payStatus' }
        ],
        res.list
      )
      this.$message.success('已导出当前筛选结果')
    }
  }
}
</script>

<style lang="scss" scoped>
.fee-preview {
  color: $danger;
  font-size: 16px;
  font-weight: 600;
}
</style>
