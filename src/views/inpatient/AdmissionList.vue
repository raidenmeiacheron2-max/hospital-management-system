<template>
  <div class="app-page">
    <div class="panel-card">
      <el-form :inline="true" class="search-form" @submit.native.prevent="handleSearch">
        <el-form-item label="住院号">
          <el-input v-model.trim="filters.code" placeholder="请输入住院号" clearable @keyup.enter.native="handleSearch" />
        </el-form-item>
        <el-form-item label="患者姓名">
          <el-input v-model.trim="filters.patientName" placeholder="请输入患者姓名" clearable @keyup.enter.native="handleSearch" />
        </el-form-item>
        <el-form-item label="住院状态">
          <el-select v-model="filters.status" placeholder="请选择住院状态" clearable>
            <el-option label="待入科" value="待入科" />
            <el-option label="在院" value="在院" />
            <el-option label="待结算" value="待结算" />
            <el-option label="已出院" value="已出院" />
            <el-option label="已取消" value="已取消" />
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
          <el-button type="primary" icon="el-icon-plus" @click="openCreate">新增登记</el-button>
          <el-button icon="el-icon-circle-check" @click="confirmSelected">入科确认</el-button>
          <el-button icon="el-icon-sort" @click="transferSelected">转科转床</el-button>
          <el-button icon="el-icon-close" @click="cancelSelected">取消登记</el-button>
          <el-button icon="el-icon-download" @click="exportCsv">导出</el-button>
        </div>
      </div>

      <el-table
        v-loading="loading"
        :data="list"
        style="width: 100%; margin-top: 12px"
        highlight-current-row
        @current-change="(row) => (currentRow = row)"
      >
        <el-table-column prop="code" label="住院号" min-width="150" />
        <el-table-column prop="patientName" label="患者姓名" min-width="100" />
        <el-table-column label="性别" width="70">
          <template slot-scope="{ row }">
            <span :class="row.patientGender === '男' ? 'text-primary' : 'text-danger'">{{ row.patientGender }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="patientPhone" label="联系电话" min-width="120" />
        <el-table-column prop="departmentName" label="入院科室" min-width="100" />
        <el-table-column prop="wardName" label="病区" min-width="110" />
        <el-table-column prop="bedCode" label="床位" width="80" />
        <el-table-column label="预交金额" min-width="100">
          <template slot-scope="{ row }">¥{{ row.depositYuan }}</template>
        </el-table-column>
        <el-table-column label="住院状态" width="100">
          <template slot-scope="{ row }">
            <StatusTag :label="row.status" />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="190" fixed="right">
          <template slot-scope="{ row }">
            <div class="operation-links">
              <el-link type="primary" @click="openDetail(row)">详情</el-link>
              <el-link v-if="row.status === '待入科'" type="primary" @click="confirmRow(row)">入科</el-link>
              <el-link v-if="['待入科', '在院', '待结算'].includes(row.status)" type="primary" @click="openTransfer(row)">转床</el-link>
              <el-link v-if="row.status === '待入科'" type="warning" @click="cancelRow(row)">取消</el-link>
              <el-link v-if="row.status === '在院'" type="danger" @click="dischargeRow(row)">出院</el-link>
              <el-link v-if="row.status === '待结算'" type="danger" @click="goSettle">结算</el-link>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <div class="table-footer">
        <Pagination :total="total" :page="query.page" :size="query.size" @change="handlePageChange" />
      </div>
    </div>

    <!-- 新增登记 -->
    <el-dialog title="新增入院登记" :visible.sync="createVisible" width="520px" :close-on-click-modal="false">
      <el-form ref="createForm" :model="createForm" :rules="createRules" label-width="90px">
        <el-form-item label="患者" prop="patientId">
          <el-select v-model="createForm.patientId" placeholder="请选择患者" style="width: 100%" filterable>
            <el-option v-for="p in patients" :key="p.id" :label="`${p.name}（${p.code}）`" :value="p.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="入院科室" prop="departmentId">
          <el-select v-model="createForm.departmentId" placeholder="请选择科室" style="width: 100%" filterable @change="onDeptChange">
            <el-option v-for="d in departments" :key="d.id" :label="d.name" :value="d.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="病区" prop="wardId">
          <el-select v-model="createForm.wardId" placeholder="请选择病区" style="width: 100%" @change="onWardChange">
            <el-option v-for="w in wards" :key="w.id" :label="w.name" :value="w.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="床位" prop="bedId">
          <el-select v-model="createForm.bedId" placeholder="请选择空闲床位" style="width: 100%">
            <el-option
              v-for="b in idleBeds"
              :key="b.id"
              :label="`${b.code}（${b.type}）`"
              :value="b.id"
              :disabled="b.enabled !== 1"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="主治医生">
          <el-select v-model="createForm.doctorId" placeholder="请选择医生" style="width: 100%" filterable clearable>
            <el-option v-for="d in doctors" :key="d.id" :label="d.name" :value="d.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="预交金额(元)" prop="depositYuan">
          <el-input v-model="createForm.depositYuan" placeholder="如 1000.00" />
        </el-form-item>
      </el-form>
      <div slot="footer">
        <el-button @click="createVisible = false">取 消</el-button>
        <el-button type="primary" :loading="submitting" @click="submitCreate">确 定</el-button>
      </div>
    </el-dialog>

    <!-- 转科转床 -->
    <el-dialog title="转科转床" :visible.sync="transferVisible" width="460px" :close-on-click-modal="false">
      <el-form label-width="90px">
        <el-form-item label="当前床位">
          <el-input :value="transferRow ? `${transferRow.wardName} ${transferRow.bedCode}` : ''" disabled />
        </el-form-item>
        <el-form-item label="目标病区">
          <el-select v-model="transferForm.wardId" placeholder="请选择病区" style="width: 100%" @change="onTransferWardChange">
            <el-option v-for="w in wards" :key="w.id" :label="w.name" :value="w.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="目标床位">
          <el-select v-model="transferForm.bedId" placeholder="请选择空闲床位" style="width: 100%">
            <el-option
              v-for="b in transferIdleBeds"
              :key="b.id"
              :label="`${b.code}（${b.type}）`"
              :value="b.id"
              :disabled="b.enabled !== 1"
            />
          </el-select>
        </el-form-item>
      </el-form>
      <div slot="footer">
        <el-button @click="transferVisible = false">取 消</el-button>
        <el-button type="primary" :loading="submitting" @click="submitTransfer">确 定</el-button>
      </div>
    </el-dialog>

    <!-- 详情 -->
    <el-dialog title="入院详情" :visible.sync="detailVisible" width="720px" append-to-body>
      <div v-if="detailRow" class="detail-body">
        <el-descriptions :column="2" border size="medium">
          <el-descriptions-item label="住院号">{{ detailRow.code }}</el-descriptions-item>
          <el-descriptions-item label="住院状态"><StatusTag :label="detailRow.status" /></el-descriptions-item>
          <el-descriptions-item label="患者">{{ detailRow.patientName }}（{{ detailRow.patientGender }}）</el-descriptions-item>
          <el-descriptions-item label="联系电话">{{ detailRow.patientPhone }}</el-descriptions-item>
          <el-descriptions-item label="入院科室">{{ detailRow.departmentName }}</el-descriptions-item>
          <el-descriptions-item label="病区/床位">{{ detailRow.wardName }} {{ detailRow.bedCode }}</el-descriptions-item>
          <el-descriptions-item label="主治医生">{{ detailRow.doctorName || '—' }}</el-descriptions-item>
          <el-descriptions-item label="预交金额">¥{{ detailRow.depositYuan }}</el-descriptions-item>
          <el-descriptions-item label="登记时间">{{ detailRow.admitAt }}</el-descriptions-item>
          <el-descriptions-item label="入科时间">{{ detailRow.confirmAt || '—' }}</el-descriptions-item>
          <el-descriptions-item label="出院时间">{{ detailRow.dischargeAt || '—' }}</el-descriptions-item>
        </el-descriptions>
      </div>
      <div slot="footer">
        <el-button @click="detailVisible = false">关 闭</el-button>
      </div>
    </el-dialog>
  </div>
</template>

<script>
import listPage from '@/mixins/listPage'
import StatusTag from '@/components/StatusTag.vue'
import Pagination from '@/components/Pagination.vue'
import {
  apiListAdmissions,
  apiCreateAdmission,
  apiConfirmAdmission,
  apiTransferAdmission,
  apiCancelAdmission,
  apiRequestDischarge,
  apiOptions
} from '@/api'
import { exportCsv } from '@/utils/csv'
import { yuanToCents, isValidCents } from '@/utils/money'

export default {
  name: 'AdmissionList',
  components: { StatusTag, Pagination },
  mixins: [listPage],
  data() {
    return {
      filters: { code: '', patientName: '', status: '' },
      currentRow: null,
      departments: [],
      wards: [],
      allBeds: [],
      patients: [],
      doctors: [],
      createVisible: false,
      submitting: false,
      createForm: { patientId: '', departmentId: '', wardId: '', bedId: '', doctorId: '', depositYuan: '1000.00' },
      createRules: {
        patientId: [{ required: true, message: '请选择患者', trigger: 'change' }],
        departmentId: [{ required: true, message: '请选择入院科室', trigger: 'change' }],
        wardId: [{ required: true, message: '请选择病区', trigger: 'change' }],
        bedId: [{ required: true, message: '请选择床位', trigger: 'change' }],
        depositYuan: [
          { required: true, message: '请输入预交金额', trigger: 'blur' },
          { validator: (r, v, cb) => (isValidCents(yuanToCents(v)) ? cb() : cb(new Error('金额须为非负数')), true), trigger: 'blur' }
        ]
      },
      transferVisible: false,
      transferRow: null,
      transferForm: { wardId: '', bedId: '' },
      detailVisible: false,
      detailRow: null
    }
  },
  computed: {
    idleBeds() {
      if (!this.createForm.wardId) return []
      return this.allBeds.filter((b) => b.wardId === this.createForm.wardId && b.status === '空闲')
    },
    transferIdleBeds() {
      if (!this.transferForm.wardId) return []
      return this.allBeds.filter((b) => b.wardId === this.transferForm.wardId && b.status === '空闲')
    }
  },
  created() {
    this.fetchData()
    this.loadOptions()
  },
  methods: {
    async loadOptions() {
      const [deps, wards, beds, pats, docs] = await Promise.all([
        apiOptions('departments'),
        apiOptions('wards'),
        apiOptions('beds'),
        apiOptions('patients'),
        apiOptions('doctors')
      ])
      this.departments = deps
      this.wards = wards
      this.allBeds = beds
      this.patients = pats
      this.doctors = docs
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
        const res = await apiListAdmissions(this.buildParams())
        this.list = res.list
        this.total = res.total
      } finally {
        this.loading = false
      }
    },
    resetFilters() {
      this.filters = { code: '', patientName: '', status: '' }
      this.handleSearch()
    },
    openCreate() {
      this.createForm = { patientId: '', departmentId: '', wardId: '', bedId: '', doctorId: '', depositYuan: '1000.00' }
      this.createVisible = true
      this.$nextTick(() => this.$refs.createForm && this.$refs.createForm.clearValidate())
    },
    onDeptChange() {
      this.createForm.wardId = ''
      this.createForm.bedId = ''
      this.wards = this.wards
    },
    onWardChange() {
      this.createForm.bedId = ''
    },
    submitCreate() {
      this.$refs.createForm.validate(async (valid) => {
        if (!valid || this.submitting) return
        this.submitting = true
        try {
          await apiCreateAdmission({ ...this.createForm, depositCents: yuanToCents(this.createForm.depositYuan) })
          this.$message.success('入院登记成功，床位已分配')
          this.createVisible = false
          this.loadOptions()
          this.fetchData()
        } catch (e) {
          /* 拦截器已提示 */
        } finally {
          this.submitting = false
        }
      })
    },
    confirmRow(row) {
      this.$confirm(`确认患者「${row.patientName}」入科（${row.wardName} ${row.bedCode}）吗？`, '入科确认', { type: 'info' })
        .then(async () => {
          await apiConfirmAdmission(row.id)
          this.$message.success('入科确认成功')
          this.fetchData()
        })
        .catch(() => {})
    },
    confirmSelected() {
      const row = this.currentRow
      if (!row || row.status !== '待入科') {
        this.$message.warning('请先选中一条「待入科」记录')
        return
      }
      this.confirmRow(row)
    },
    openTransfer(row) {
      this.transferRow = row
      this.transferForm = { wardId: row.wardId, bedId: '' }
      this.transferVisible = true
    },
    transferSelected() {
      const row = this.currentRow
      if (!row || !['待入科', '在院', '待结算'].includes(row.status)) {
        this.$message.warning('请先选中一条可转床的记录')
        return
      }
      this.openTransfer(row)
    },
    onTransferWardChange() {
      this.transferForm.bedId = ''
    },
    submitTransfer() {
      if (!this.transferForm.wardId || !this.transferForm.bedId) {
        this.$message.warning('请选择目标病区与床位')
        return
      }
      if (this.submitting) return
      this.submitting = true
      apiTransferAdmission(this.transferRow.id, this.transferForm)
        .then(() => {
          this.$message.success('转科转床成功，原床位已释放')
          this.transferVisible = false
          this.loadOptions()
          this.fetchData()
        })
        .catch(() => {})
        .finally(() => {
          this.submitting = false
        })
    },
    cancelRow(row) {
      this.$confirm(`确定取消「${row.patientName}」的入院登记吗？床位将同时释放。`, '取消登记', { type: 'warning' })
        .then(async () => {
          await apiCancelAdmission(row.id)
          this.$message.success('已取消登记，床位已释放')
          this.loadOptions()
          this.fetchData()
        })
        .catch(() => {})
    },
    cancelSelected() {
      const row = this.currentRow
      if (!row || row.status !== '待入科') {
        this.$message.warning('请先选中一条「待入科」记录')
        return
      }
      this.cancelRow(row)
    },
    dischargeRow(row) {
      this.$confirm(`确认为「${row.patientName}」办理出院申请吗？状态将变为待结算。`, '出院申请', { type: 'warning' })
        .then(async () => {
          await apiRequestDischarge(row.id)
          this.$message.success('已提交出院申请，请在出院结算中完成结算')
          this.fetchData()
        })
        .catch(() => {})
    },
    goSettle() {
      this.$router.push('/inpatient/settlements')
    },
    openDetail(row) {
      this.detailRow = row
      this.detailVisible = true
    },
    async exportCsv() {
      const res = await apiListAdmissions({ ...this.buildParams(), page: 1, size: Math.min(this.total || 1000, 5000) })
      exportCsv(
        `入院登记_${new Date().toISOString().slice(0, 10)}`,
        [
          { label: '住院号', key: 'code' },
          { label: '患者姓名', key: 'patientName' },
          { label: '性别', key: 'patientGender' },
          { label: '联系电话', key: 'patientPhone' },
          { label: '入院科室', key: 'departmentName' },
          { label: '病区', key: 'wardName' },
          { label: '床位', key: 'bedCode' },
          { label: '预交金额(元)', key: 'depositYuan' },
          { label: '住院状态', key: 'status' }
        ],
        res.list
      )
      this.$message.success('已导出当前筛选结果')
    }
  }
}
</script>

<style lang="scss" scoped>
.detail-body {
  max-height: 66vh;
  overflow-y: auto;
}
</style>
