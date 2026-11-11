<template>
  <div class="app-page audit-center">
    <div class="panel-card">
      <div class="audit-head">
        <div>
          <div class="page-title">操作审计与流程回放</div>
          <div class="page-sub">基于结构化 auditEvents，只读展示操作与状态变化；不支持重放执行，也不允许修改或删除审计记录。</div>
        </div>
        <span class="readonly-tag"><i class="el-icon-lock"></i> 只读</span>
      </div>
    </div>

    <div class="panel-card">
      <el-form :inline="true" class="search-form">
        <el-form-item label="关键字">
          <el-input v-model.trim="filters.keyword" placeholder="操作人/动作/对象" clearable style="width: 170px" />
        </el-form-item>
        <el-form-item label="操作人">
          <el-input v-model.trim="filters.actorName" placeholder="操作人" clearable style="width: 120px" />
        </el-form-item>
        <el-form-item label="角色">
          <el-input v-model.trim="filters.actorRole" placeholder="角色" clearable style="width: 120px" />
        </el-form-item>
        <el-form-item label="业务类型">
          <el-select v-model="filters.entityType" placeholder="全部" clearable style="width: 130px">
            <el-option v-for="(label, key) in entityLabels" :key="key" :label="label" :value="key" />
          </el-select>
        </el-form-item>
        <el-form-item label="动作">
          <el-input v-model.trim="filters.action" placeholder="如 挂号/出院结算" clearable style="width: 130px" />
        </el-form-item>
        <el-form-item label="时间">
          <el-date-picker v-model="dateRange" type="daterange" value-format="yyyy-MM-dd" range-separator="至" start-placeholder="开始" end-placeholder="结束" style="width: 240px" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" icon="el-icon-search" @click="handleSearch">查询</el-button>
          <el-button icon="el-icon-refresh-left" @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>
      <div v-if="filters.entityId" class="entity-filter">
        正在按业务对象筛选：<b>{{ entityLabel(filters.entityType) }} / {{ filters.entityId }}</b>
        <el-button type="text" @click="clearEntityFilter">清除</el-button>
      </div>
    </div>

    <div class="panel-card">
      <div v-if="error" class="empty-state error">{{ error }}</div>
      <el-table v-else v-loading="loading" :data="list" style="width: 100%">
        <el-table-column prop="time" label="时间" min-width="150" />
        <el-table-column prop="actorName" label="操作人" min-width="100" />
        <el-table-column prop="actorRole" label="角色" min-width="110">
          <template slot-scope="{ row }">{{ row.actorRole || '—' }}</template>
        </el-table-column>
        <el-table-column prop="action" label="动作" min-width="120" />
        <el-table-column label="业务类型" min-width="110">
          <template slot-scope="{ row }">{{ entityLabel(row.entityType) }}</template>
        </el-table-column>
        <el-table-column label="对象" min-width="200">
          <template slot-scope="{ row }">{{ row.summary || row.entityCode || row.entityId || '—' }}</template>
        </el-table-column>
        <el-table-column label="结果" width="90">
          <template slot-scope="{ row }">
            <span :class="row.result === 'ok' ? 'text-success' : 'text-danger'">{{ row.result === 'ok' ? '成功' : (row.result || '—') }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right">
          <template slot-scope="{ row }">
            <div class="operation-links">
              <el-link type="primary" @click="openDetail(row)">查看变化</el-link>
              <el-link type="primary" @click="viewEntityTimeline(row)">对象时间线</el-link>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <div v-if="!loading && !error && !list.length" class="empty-state">暂无符合条件的审计记录</div>

      <div class="table-footer">
        <Pagination :total="total" :page="query.page" :size="query.size" @change="handlePageChange" />
      </div>
    </div>

    <el-dialog title="审计详情（只读）" :visible.sync="detailVisible" width="720px" append-to-body>
      <template v-if="detailRow">
        <el-descriptions :column="2" border size="medium">
          <el-descriptions-item label="时间">{{ detailRow.time }}</el-descriptions-item>
          <el-descriptions-item label="操作人">{{ detailRow.actorName }}（{{ detailRow.actorRole || '角色未知' }}）</el-descriptions-item>
          <el-descriptions-item label="动作">{{ detailRow.action }}</el-descriptions-item>
          <el-descriptions-item label="业务类型">{{ entityLabel(detailRow.entityType) }}</el-descriptions-item>
          <el-descriptions-item label="对象编号">{{ detailRow.entityCode || detailRow.entityId || '—' }}</el-descriptions-item>
          <el-descriptions-item label="结果">{{ detailRow.result }}</el-descriptions-item>
          <el-descriptions-item label="摘要" :span="2">{{ detailRow.summary || '—' }}</el-descriptions-item>
        </el-descriptions>

        <div class="diff-section">
          <div class="diff-title">操作前后状态差异</div>
          <div v-if="!hasDiff" class="diff-empty">
            <i class="el-icon-warning-outline"></i>
            该记录缺少 before/after 结构化快照（可能为 B1 前的历史日志），无法展示状态差异；此处不伪造数据。
          </div>
          <el-table v-else :data="diffRows" size="mini" border>
            <el-table-column prop="field" label="字段" width="160" />
            <el-table-column label="变更前" min-width="200">
              <template slot-scope="{ row }"><span :class="{ 'diff-changed': row.changed }">{{ fmtVal(row.before) }}</span></template>
            </el-table-column>
            <el-table-column label="变更后" min-width="200">
              <template slot-scope="{ row }"><span :class="{ 'diff-changed': row.changed }">{{ fmtVal(row.after) }}</span></template>
            </el-table-column>
          </el-table>
        </div>
      </template>
      <div slot="footer">
        <el-button @click="detailVisible = false">关 闭</el-button>
        <el-button v-if="detailRow" type="primary" @click="viewEntityTimeline(detailRow)">查看该对象操作时间线</el-button>
      </div>
    </el-dialog>
  </div>
</template>

<script>
import Pagination from '@/components/Pagination.vue'
import { apiListAuditEvents } from '@/api'

const ENTITY_LABELS = {
  staff: '员工',
  departments: '科室',
  wards: '病区',
  beds: '床位',
  patients: '患者',
  schedules: '排班',
  registrations: '挂号',
  visits: '接诊',
  medicines: '药品',
  examItems: '医技项目',
  feeItems: '收费项目',
  stocks: '批次库存',
  admissions: '住院',
  orders: '医嘱',
  roles: '角色',
  todo: '待办',
  system: '系统',
  legacy: '历史日志'
}

export default {
  name: 'AuditCenter',
  components: { Pagination },
  data() {
    return {
      loading: false,
      error: '',
      list: [],
      total: 0,
      query: { page: 1, size: 10 },
      filters: { keyword: '', actorName: '', actorRole: '', entityType: '', action: '', entityId: '' },
      dateRange: [],
      entityLabels: ENTITY_LABELS,
      detailVisible: false,
      detailRow: null
    }
  },
  computed: {
    hasDiff() {
      const d = this.detailRow
      return !!(d && (d.before || d.after))
    },
    diffRows() {
      const d = this.detailRow
      if (!d) return []
      const b = d.before || {}
      const a = d.after || {}
      const keys = {}
      Object.keys(b).forEach((k) => { keys[k] = 1 })
      Object.keys(a).forEach((k) => { keys[k] = 1 })
      return Object.keys(keys)
        .filter((k) => k !== 'id')
        .map((k) => ({
          field: k,
          before: b[k],
          after: a[k],
          changed: JSON.stringify(b[k]) !== JSON.stringify(a[k])
        }))
    }
  },
  created() {
    this.fetchData()
  },
  methods: {
    entityLabel(type) {
      return ENTITY_LABELS[type] || type || '—'
    },
    fmtVal(v) {
      if (v === undefined) return '—'
      if (v === null) return 'null'
      if (typeof v === 'object') return JSON.stringify(v)
      if (v === '') return '（空）'
      return String(v)
    },
    buildParams() {
      const p = { page: this.query.page, size: this.query.size }
      Object.keys(this.filters).forEach((k) => {
        if (this.filters[k]) p[k] = this.filters[k]
      })
      if (this.dateRange && this.dateRange.length === 2) {
        p.start = this.dateRange[0]
        p.end = this.dateRange[1]
      }
      return p
    },
    async fetchData() {
      this.loading = true
      this.error = ''
      try {
        const res = await apiListAuditEvents(this.buildParams())
        this.list = res.list
        this.total = res.total
      } catch (e) {
        this.error = e.message || '审计记录加载失败'
      } finally {
        this.loading = false
      }
    },
    handleSearch() {
      this.query.page = 1
      this.fetchData()
    },
    handlePageChange(p) {
      this.query.page = p.page
      this.query.size = p.size
      this.fetchData()
    },
    resetFilters() {
      this.filters = { keyword: '', actorName: '', actorRole: '', entityType: '', action: '', entityId: '' }
      this.dateRange = []
      this.handleSearch()
    },
    openDetail(row) {
      this.detailRow = row
      this.detailVisible = true
    },
    viewEntityTimeline(row) {
      if (!row.entityId) {
        this.$message.warning('该记录缺少业务对象编号，无法按对象回放')
        return
      }
      this.filters.entityType = row.entityType
      this.filters.entityId = row.entityId
      this.detailVisible = false
      this.handleSearch()
    },
    clearEntityFilter() {
      this.filters.entityType = ''
      this.filters.entityId = ''
      this.handleSearch()
    }
  }
}
</script>

<style lang="scss" scoped>
.audit-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
}

.page-title {
  font-size: 17px;
  font-weight: 600;
  color: $text-main;
}

.page-sub {
  font-size: 12px;
  color: $text-secondary;
  margin-top: 4px;
  line-height: 1.6;
}

.readonly-tag {
  font-size: 12px;
  color: $text-secondary;
  background: $page-bg;
  border: 1px solid $border-color;
  border-radius: 10px;
  padding: 2px 10px;
}

.entity-filter {
  margin-top: 4px;
  font-size: 12px;
  color: $text-regular;
  background: #f7fafd;
  border: 1px solid $border-light;
  border-radius: 4px;
  padding: 6px 10px;
}

.diff-section {
  margin-top: 16px;
}

.diff-title {
  font-size: 14px;
  font-weight: 600;
  color: $text-main;
  margin-bottom: 8px;
}

.diff-empty {
  font-size: 13px;
  color: $text-secondary;
  background: #fbfbfc;
  border: 1px dashed $border-color;
  border-radius: 4px;
  padding: 12px;
  line-height: 1.7;

  i {
    color: $warning;
    margin-right: 4px;
  }
}

.diff-changed {
  color: $danger;
  font-weight: 600;
}

.empty-state {
  text-align: center;
  color: $text-secondary;
  font-size: 13px;
  padding: 24px 0;

  &.error {
    color: $danger;
  }
}
</style>
