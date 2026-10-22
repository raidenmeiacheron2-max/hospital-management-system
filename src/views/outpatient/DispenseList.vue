<template>
  <div class="app-page">
    <div class="panel-card">
      <el-form :inline="true" class="search-form" @submit.native.prevent="handleSearch">
        <el-form-item label="患者姓名">
          <el-input v-model.trim="filters.patientName" placeholder="请输入患者姓名" clearable @keyup.enter.native="handleSearch" />
        </el-form-item>
        <el-form-item label="发药状态">
          <el-select v-model="filters.dispenseStatus" placeholder="请选择状态" clearable>
            <el-option label="未发药" value="未发药" />
            <el-option label="已发药" value="已发药" />
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
        <el-table-column prop="code" label="接诊编号" min-width="150" />
        <el-table-column prop="patientName" label="患者" min-width="90" />
        <el-table-column prop="departmentName" label="科室" min-width="90" />
        <el-table-column prop="doctorName" label="医生" min-width="90" />
        <el-table-column label="处方药品" min-width="220">
          <template slot-scope="{ row }">
            {{ (row.prescriptions || []).map((p) => `${p.medicineName}×${p.qty}`).join('、') || '—' }}
          </template>
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
        <el-table-column label="操作" width="110" fixed="right">
          <template slot-scope="{ row }">
            <el-link
              v-if="row.chargeStatus === '已收费' && row.dispenseStatus === '未发药'"
              type="primary"
              @click="dispenseRow(row)"
            >
              发药
            </el-link>
            <span v-else class="text-muted" style="font-size: 12px">—</span>
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
import { apiListVisits, apiDispenseVisit } from '@/api'

export default {
  name: 'DispenseList',
  components: { StatusTag, Pagination },
  mixins: [listPage],
  data() {
    return {
      filters: { patientName: '', dispenseStatus: '' }
    }
  },
  created() {
    this.fetchData()
  },
  methods: {
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
        this.list = res.list.filter((v) => (v.prescriptions || []).length > 0 && v.chargeStatus !== '未收费')
        this.total = this.list.length
      } finally {
        this.loading = false
      }
    },
    resetFilters() {
      this.filters = { patientName: '', dispenseStatus: '' }
      this.handleSearch()
    },
    dispenseRow(row) {
      this.$confirm(`确认为「${row.patientName}」的处方执行发药吗？将扣减药品库存。`, '发药确认', { type: 'info' })
        .then(async () => {
          await apiDispenseVisit(row.id)
          this.$message.success('发药成功，库存已扣减')
          this.fetchData()
        })
        .catch(() => {})
    }
  }
}
</script>
