<template>
  <div class="app-page">
    <div class="panel-card">
      <el-form :inline="true" class="search-form" @submit.native.prevent="handleSearch">
        <el-form-item label="患者姓名">
          <el-input v-model.trim="filters.patientName" placeholder="请输入患者姓名" clearable @keyup.enter.native="handleSearch" />
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
              <div v-for="r in row.reports || []" :key="r.examItemId" class="report-block">
                <div class="report-head">
                  <StatusTag label="已出报告" />
                  <span class="report-item">{{ r.examItemName }}</span>
                  <span class="text-muted report-time">{{ r.at }}</span>
                </div>
                <div class="report-content">{{ r.content }}</div>
              </div>
              <el-empty v-if="!(row.reports || []).length" description="暂无报告" :image-size="50" />
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="code" label="接诊编号" min-width="150" />
        <el-table-column prop="patientName" label="患者" min-width="90" />
        <el-table-column prop="date" label="就诊日期" min-width="110" />
        <el-table-column prop="departmentName" label="科室" min-width="90" />
        <el-table-column label="申请项目" min-width="200">
          <template slot-scope="{ row }">
            {{ (row.exams || []).map((e) => `${e.examItemName}×${e.qty}`).join('、') || '—' }}
          </template>
        </el-table-column>
        <el-table-column label="报告状态" width="110">
          <template slot-scope="{ row }">
            <StatusTag :label="row.reportStatus" />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="90">
          <template slot-scope="{ row }">
            <el-link type="primary" @click="openDetail(row)">查看</el-link>
          </template>
        </el-table-column>
      </el-table>

      <div class="table-footer">
        <Pagination :total="total" :page="query.page" :size="query.size" @change="handlePageChange" />
      </div>
    </div>

    <el-dialog title="医技报告" :visible.sync="detailVisible" width="640px" append-to-body>
      <div v-if="detailRow" class="detail-body">
        <div v-for="r in detailRow.reports || []" :key="r.examItemId" class="report-block">
          <div class="report-head">
            <StatusTag label="已出报告" />
            <span class="report-item">{{ r.examItemName }}</span>
            <span class="text-muted report-time">{{ r.at }}</span>
          </div>
          <div class="report-content">{{ r.content }}</div>
        </div>
        <el-empty v-if="!(detailRow.reports || []).length" description="暂无报告" :image-size="60" />
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
import { apiListVisits } from '@/api'

export default {
  name: 'ReportList',
  components: { StatusTag, Pagination },
  mixins: [listPage],
  data() {
    return {
      filters: { patientName: '' },
      detailVisible: false,
      detailRow: null
    }
  },
  created() {
    this.fetchData()
  },
  methods: {
    buildParams() {
      const p = { page: this.query.page, size: this.query.size }
      if (this.filters.patientName) p.patientName = this.filters.patientName
      return p
    },
    async fetchData() {
      this.loading = true
      try {
        const res = await apiListVisits(this.buildParams())
        this.list = res.list.filter((v) => (v.exams || []).length > 0)
        this.total = this.list.length
      } finally {
        this.loading = false
      }
    },
    resetFilters() {
      this.filters = { patientName: '' }
      this.handleSearch()
    },
    openDetail(row) {
      this.detailRow = row
      this.detailVisible = true
    }
  }
}
</script>

<style lang="scss" scoped>
.expand-body,
.detail-body {
  padding: 8px 20px;
  max-height: 60vh;
  overflow-y: auto;
}

.report-block {
  border: 1px solid $border-light;
  border-radius: $radius-md;
  padding: 10px 12px;
  margin-bottom: 10px;
}

.report-head {
  display: flex;
  align-items: center;
  margin-bottom: 6px;
}

.report-item {
  font-weight: 600;
  margin-left: 8px;
  color: $text-main;
}

.report-time {
  margin-left: auto;
  font-size: 12px;
}

.report-content {
  font-size: 13px;
  color: $text-regular;
  line-height: 1.7;
  white-space: pre-wrap;
}
</style>
