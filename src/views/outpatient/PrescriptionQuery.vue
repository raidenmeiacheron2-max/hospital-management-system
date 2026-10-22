<template>
  <div class="app-page">
    <div class="panel-card">
      <el-form :inline="true" class="search-form" @submit.native.prevent="handleSearch">
        <el-form-item label="患者姓名">
          <el-input v-model.trim="filters.patientName" placeholder="请输入患者姓名" clearable @keyup.enter.native="handleSearch" />
        </el-form-item>
        <el-form-item label="收费状态">
          <el-select v-model="filters.chargeStatus" placeholder="请选择状态" clearable>
            <el-option label="未收费" value="未收费" />
            <el-option label="已收费" value="已收费" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" icon="el-icon-search" @click="handleSearch">搜索</el-button>
          <el-button icon="el-icon-refresh-left" @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>
    </div>

    <div class="panel-card">
      <el-table v-loading="loading" :data="list" style="width: 100%">
        <el-table-column type="expand">
          <template slot-scope="{ row }">
            <div class="expand-body">
              <h4>处方明细</h4>
              <el-table :data="row.prescriptions || []" size="small" border>
                <el-table-column prop="medicineName" label="药品" min-width="150" />
                <el-table-column prop="usage" label="用法" width="90" />
                <el-table-column prop="qty" label="数量" width="70" />
                <el-table-column label="单价" width="90">
                  <template slot-scope="{ row: p }">¥{{ centsToYuan(p.priceCents) }}</template>
                </el-table-column>
                <el-table-column label="金额" width="100">
                  <template slot-scope="{ row: p }">¥{{ centsToYuan(p.amountCents) }}</template>
                </el-table-column>
              </el-table>
              <el-empty v-if="!(row.prescriptions || []).length" description="暂无处方" :image-size="50" />
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="code" label="接诊编号" min-width="150" />
        <el-table-column prop="regCode" label="挂号编号" min-width="150" />
        <el-table-column prop="patientName" label="患者" min-width="90" />
        <el-table-column prop="departmentName" label="科室" min-width="90" />
        <el-table-column prop="doctorName" label="医生" min-width="90" />
        <el-table-column prop="date" label="就诊日期" min-width="110" />
        <el-table-column label="处方金额" min-width="100">
          <template slot-scope="{ row }">¥{{ centsToYuan(row.prescriptionAmountCents) }}</template>
        </el-table-column>
        <el-table-column label="收费状态" width="100">
          <template slot-scope="{ row }">
            <StatusTag :label="row.chargeStatus" />
          </template>
        </el-table-column>
        <el-table-column label="发药状态" width="100">
          <template slot-scope="{ row }">
            <StatusTag :label="row.dispenseStatus" />
          </template>
        </el-table-column>
      </el-table>

      <div class="table-footer">
        <Pagination :total="total" :page="query.page" :size="query.size" @change="handlePageChange" />
      </div>
    </div>
  </div>
</template>

<script>
import listPage from '@/mixins/listPage'
import StatusTag from '@/components/StatusTag.vue'
import Pagination from '@/components/Pagination.vue'
import { apiListVisits } from '@/api'
import { centsToYuan } from '@/utils/money'

export default {
  name: 'PrescriptionQuery',
  components: { StatusTag, Pagination },
  mixins: [listPage],
  data() {
    return {
      filters: { patientName: '', chargeStatus: '' }
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
        this.list = res.list.filter((v) => (v.prescriptions || []).length > 0)
        this.total = this.list.length
      } finally {
        this.loading = false
      }
    },
    resetFilters() {
      this.filters = { patientName: '', chargeStatus: '' }
      this.handleSearch()
    }
  }
}
</script>

<style lang="scss" scoped>
.expand-body {
  padding: 8px 20px;

  h4 {
    margin: 4px 0 8px;
    font-size: 13px;
    color: $text-regular;
  }
}
</style>
