<template>
  <div class="app-page">
    <div class="panel-card">
      <el-form :inline="true" class="search-form" @submit.native.prevent="handleSearch">
        <el-form-item label="关键字">
          <el-input v-model.trim="filters.keyword" placeholder="操作人/动作/对象" clearable @keyup.enter.native="handleSearch" />
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
          <el-button icon="el-icon-delete" @click="clearLogs">清空日志</el-button>
        </div>
      </div>

      <el-table v-loading="loading" :data="list" style="width: 100%; margin-top: 12px">
        <el-table-column prop="time" label="时间" min-width="150" />
        <el-table-column prop="operator" label="操作人" min-width="110" />
        <el-table-column prop="action" label="动作" min-width="110" />
        <el-table-column prop="target" label="对象" min-width="240" />
        <el-table-column prop="ip" label="IP" min-width="120" />
      </el-table>

      <div class="table-footer">
        <Pagination :total="total" :page="query.page" :size="query.size" @change="handlePageChange" />
      </div>
    </div>
  </div>
</template>

<script>
import listPage from '@/mixins/listPage'
import Pagination from '@/components/Pagination.vue'
import { apiListLogs, apiClearLogs } from '@/api'

export default {
  name: 'OpLogList',
  components: { Pagination },
  mixins: [listPage],
  data() {
    return {
      filters: { keyword: '' }
    }
  },
  created() {
    this.fetchData()
  },
  methods: {
    buildParams() {
      const p = { page: this.query.page, size: this.query.size }
      if (this.filters.keyword) p.keyword = this.filters.keyword
      return p
    },
    async fetchData() {
      this.loading = true
      try {
        const res = await apiListLogs(this.buildParams())
        this.list = res.list
        this.total = res.total
      } finally {
        this.loading = false
      }
    },
    resetFilters() {
      this.filters = { keyword: '' }
      this.handleSearch()
    },
    clearLogs() {
      this.$confirm('确定清空全部操作日志吗？', '清空确认', { type: 'warning' })
        .then(async () => {
          await apiClearLogs()
          this.$message.success('日志已清空')
          this.fetchData()
        })
        .catch(() => {})
    }
  }
}
</script>
