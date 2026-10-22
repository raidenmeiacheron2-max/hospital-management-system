<template>
  <div class="app-page">
    <div class="panel-card">
      <el-form :inline="true" class="search-form" @submit.native.prevent="handleSearch">
        <el-form-item label="患者姓名">
          <el-input v-model.trim="filters.patientName" placeholder="请输入患者姓名" clearable @keyup.enter.native="handleSearch" />
        </el-form-item>
        <el-form-item label="接诊状态">
          <el-select v-model="filters.visitStatus" placeholder="请选择状态" clearable>
            <el-option label="就诊中" value="就诊中" />
            <el-option label="已完成" value="已完成" />
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
          <el-button type="primary" icon="el-icon-plus" @click="openCreate">接诊</el-button>
        </div>
      </div>

      <el-table v-loading="loading" :data="list" style="width: 100%; margin-top: 12px">
        <el-table-column prop="regCode" label="挂号编号" min-width="150" />
        <el-table-column prop="patientName" label="患者" min-width="100" />
        <el-table-column label="性别" width="70">
          <template slot-scope="{ row }">
            <span :class="row.patientGender === '男' ? 'text-primary' : 'text-danger'">{{ row.patientGender }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="date" label="就诊日期" min-width="110" />
        <el-table-column prop="departmentName" label="科室" min-width="90" />
        <el-table-column prop="doctorName" label="医生" min-width="90" />
        <el-table-column label="诊断" min-width="140" show-overflow-tooltip>
          <template slot-scope="{ row }">{{ row.diagnosis || '—' }}</template>
        </el-table-column>
        <el-table-column label="接诊状态" width="100">
          <template slot-scope="{ row }">
            <StatusTag :label="row.visitStatus" />
          </template>
        </el-table-column>
        <el-table-column label="收费状态" width="100">
          <template slot-scope="{ row }">
            <StatusTag :label="row.chargeStatus" />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right">
          <template slot-scope="{ row }">
            <div class="operation-links">
              <el-link type="primary" @click="openDetail(row)">详情</el-link>
              <el-link type="primary" @click="openEdit(row)">修改</el-link>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <div class="table-footer">
        <Pagination :total="total" :page="query.page" :size="query.size" @change="handlePageChange" />
      </div>
    </div>

    <VisitDialog :visible.sync="dialogVisible" :mode="dialogMode" :visit="currentVisit" @saved="fetchData" />

    <!-- 详情 -->
    <el-dialog title="接诊详情" :visible.sync="detailVisible" width="720px" append-to-body>
      <div v-if="currentVisit" class="visit-detail">
        <el-descriptions :column="2" border size="medium">
          <el-descriptions-item label="挂号编号">{{ currentVisit.regCode }}</el-descriptions-item>
          <el-descriptions-item label="患者">{{ currentVisit.patientName }}（{{ currentVisit.patientGender }}）</el-descriptions-item>
          <el-descriptions-item label="科室">{{ currentVisit.departmentName }}</el-descriptions-item>
          <el-descriptions-item label="医生">{{ currentVisit.doctorName }}</el-descriptions-item>
          <el-descriptions-item label="接诊状态">
            <StatusTag :label="currentVisit.visitStatus" />
          </el-descriptions-item>
          <el-descriptions-item label="是否住院">{{ currentVisit.needHospital }}</el-descriptions-item>
          <el-descriptions-item label="主诉" :span="2">{{ currentVisit.complaint || '—' }}</el-descriptions-item>
          <el-descriptions-item label="现病史" :span="2">{{ currentVisit.history || '—' }}</el-descriptions-item>
          <el-descriptions-item label="诊断" :span="2">{{ currentVisit.diagnosis || '—' }}</el-descriptions-item>
          <el-descriptions-item label="处理意见" :span="2">{{ currentVisit.advice || '—' }}</el-descriptions-item>
        </el-descriptions>

        <h4 class="detail-h">处方明细</h4>
        <el-table :data="currentVisit.prescriptions || []" size="small" border>
          <el-table-column prop="medicineName" label="药品" min-width="150" />
          <el-table-column prop="usage" label="用法" width="90" />
          <el-table-column prop="qty" label="数量" width="70" />
          <el-table-column label="单价" width="90">
            <template slot-scope="{ row }">¥{{ centsToYuan(row.priceCents) }}</template>
          </el-table-column>
          <el-table-column label="金额" width="100">
            <template slot-scope="{ row }">¥{{ centsToYuan(row.amountCents) }}</template>
          </el-table-column>
        </el-table>
        <el-empty v-if="!(currentVisit.prescriptions || []).length" description="暂无数据" :image-size="50" />

        <h4 class="detail-h">医技申请</h4>
        <el-table :data="currentVisit.exams || []" size="small" border>
          <el-table-column prop="examItemName" label="检验检查项目" min-width="150" />
          <el-table-column prop="qty" label="数量" width="70" />
          <el-table-column label="单价" width="90">
            <template slot-scope="{ row }">¥{{ centsToYuan(row.priceCents) }}</template>
          </el-table-column>
          <el-table-column label="金额" width="100">
            <template slot-scope="{ row }">¥{{ centsToYuan(row.amountCents) }}</template>
          </el-table-column>
        </el-table>
        <el-empty v-if="!(currentVisit.exams || []).length" description="暂无数据" :image-size="50" />
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
import VisitDialog from './components/VisitDialog.vue'
import { apiListVisits } from '@/api'
import { centsToYuan } from '@/utils/money'

export default {
  name: 'VisitList',
  components: { StatusTag, Pagination, VisitDialog },
  mixins: [listPage],
  data() {
    return {
      filters: { patientName: '', visitStatus: '' },
      dialogVisible: false,
      dialogMode: 'create',
      currentVisit: null,
      detailVisible: false
    }
  },
  created() {
    this.fetchData()
  },
  methods: {
    centsToYuan,
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
        const res = await apiListVisits(this.buildParams())
        this.list = res.list
        this.total = res.total
      } finally {
        this.loading = false
      }
    },
    resetFilters() {
      this.filters = { patientName: '', visitStatus: '' }
      this.handleSearch()
    },
    openCreate() {
      this.dialogMode = 'create'
      this.currentVisit = null
      this.dialogVisible = true
    },
    openEdit(row) {
      this.dialogMode = 'edit'
      this.currentVisit = row
      this.dialogVisible = true
    },
    openDetail(row) {
      this.currentVisit = row
      this.detailVisible = true
    }
  }
}
</script>

<style lang="scss" scoped>
.visit-detail {
  max-height: 66vh;
  overflow-y: auto;
}

.detail-h {
  margin: 14px 0 8px;
  font-size: 14px;
  color: $text-main;
}
</style>
