<template>
  <div class="app-page">
    <div class="panel-card">
      <el-form :inline="true" class="search-form" @submit.native.prevent="handleSearch">
        <el-form-item label="患者姓名">
          <el-input v-model.trim="filters.patientName" placeholder="请输入患者姓名" clearable @keyup.enter.native="handleSearch" />
        </el-form-item>
        <el-form-item label="报告状态">
          <el-select v-model="filters.reportStatus" placeholder="请选择状态" clearable>
            <el-option label="待报告" value="待报告" />
            <el-option label="部分出报告" value="部分出报告" />
            <el-option label="已出报告" value="已出报告" />
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
        <el-table-column prop="date" label="就诊日期" min-width="110" />
        <el-table-column prop="departmentName" label="科室" min-width="90" />
        <el-table-column label="医技项目" min-width="200">
          <template slot-scope="{ row }">
            <span v-if="(row.exams || []).length">
              {{ (row.exams || []).map((e) => `${e.examItemName}×${e.qty}`).join('、') }}
            </span>
            <span v-else class="text-muted">—</span>
          </template>
        </el-table-column>
        <el-table-column label="报告状态" width="110">
          <template slot-scope="{ row }">
            <StatusTag :label="row.reportStatus" />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="110" fixed="right">
          <template slot-scope="{ row }">
            <el-link v-if="row.reportStatus !== '已出报告' && (row.exams || []).length" type="primary" @click="openReport(row)">
              出具报告
            </el-link>
            <span v-else class="text-muted" style="font-size: 12px">—</span>
          </template>
        </el-table-column>
      </el-table>

      <div class="table-footer">
        <Pagination :total="total" :page="query.page" :size="query.size" @change="handlePageChange" />
      </div>
    </div>

    <!-- 出具报告 -->
    <el-dialog title="出具报告" :visible.sync="reportVisible" width="560px" :close-on-click-modal="false">
      <el-form label-width="90px">
        <el-form-item label="接诊记录">
          <el-input :value="reportRow ? `${reportRow.code} · ${reportRow.patientName}` : ''" disabled />
        </el-form-item>
        <el-form-item label="医技项目" prop="examItemId">
          <el-select v-model="reportForm.examItemId" placeholder="请选择项目" style="width: 100%">
            <el-option
              v-for="e in reportRow ? reportRow.exams || [] : []"
              :key="e.examItemId"
              :label="`${e.examItemName}（${e.qty}）`"
              :value="e.examItemId"
              :disabled="(reportRow && reportRow.reports || []).some((r) => r.examItemId === e.examItemId)"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="报告内容" prop="content">
          <el-input v-model="reportForm.content" type="textarea" :rows="6" placeholder="请输入检查所见与诊断意见" />
        </el-form-item>
      </el-form>
      <div slot="footer">
        <el-button @click="reportVisible = false">取 消</el-button>
        <el-button type="primary" :loading="submitting" @click="submitReport">确 定</el-button>
      </div>
    </el-dialog>
  </div>
</template>

<script>
import listPage from '@/mixins/listPage'
import StatusTag from '@/components/StatusTag.vue'
import Pagination from '@/components/Pagination.vue'
import { apiListVisits, apiCreateReport } from '@/api'

export default {
  name: 'ExamApplyList',
  components: { StatusTag, Pagination },
  mixins: [listPage],
  data() {
    return {
      filters: { patientName: '', reportStatus: '' },
      reportVisible: false,
      reportRow: null,
      reportForm: { examItemId: '', content: '' },
      submitting: false
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
        this.list = res.list.filter((v) => (v.exams || []).length > 0)
        this.total = this.list.length
      } finally {
        this.loading = false
      }
    },
    resetFilters() {
      this.filters = { patientName: '', reportStatus: '' }
      this.handleSearch()
    },
    openReport(row) {
      this.reportRow = row
      this.reportForm = { examItemId: '', content: '' }
      this.reportVisible = true
    },
    submitReport() {
      if (!this.reportForm.examItemId) {
        this.$message.warning('请选择医技项目')
        return
      }
      if (!this.reportForm.content.trim()) {
        this.$message.warning('请输入报告内容')
        return
      }
      if (this.submitting) return
      this.submitting = true
      apiCreateReport(this.reportRow.id, this.reportForm)
        .then(() => {
          this.$message.success('报告已出具')
          this.reportVisible = false
          this.fetchData()
        })
        .catch(() => {})
        .finally(() => {
          this.submitting = false
        })
    }
  }
}
</script>
