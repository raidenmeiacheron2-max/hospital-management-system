<template>
  <div class="app-page">
    <div class="panel-card">
      <div class="report-head">
        <h3 class="panel-title">智能报表</h3>
        <div class="report-actions">
          <el-button size="small" icon="el-icon-refresh" :loading="loading" @click="refresh">刷新</el-button>
          <el-button
            size="small"
            type="primary"
            icon="el-icon-download"
            :disabled="!report || !report.rows || !report.rows.length"
            @click="exportReport"
          >
            导出 CSV
          </el-button>
        </div>
      </div>

      <div class="report-hint">
        <i class="el-icon-info"></i>
        报表基于演示数据只读聚合生成，金额在数据层为整数分、页面与导出时转换为元；AI 仅生成摘要与要点，不修改任何业务数据。
      </div>

      <el-tabs v-model="activeType" class="report-tabs" @tab-click="onTabClick">
        <el-tab-pane v-for="t in reportTypes" :key="t.value" :label="t.label" :name="t.value"></el-tab-pane>
      </el-tabs>

      <div v-loading="loading" class="report-body">
        <template v-if="report">
          <div class="report-title-row">
            <span class="rt-title">{{ report.title }}</span>
            <span class="rt-sub">{{ (report.rows || []).length }} 行 · 演示数据</span>
          </div>

          <el-table :data="report.rows || []" size="small" border class="report-table">
            <el-table-column
              v-for="col in report.columns || []"
              :key="col.prop"
              :prop="col.prop"
              :label="col.label"
              :align="col.align || 'left'"
              show-overflow-tooltip
            >
              <template slot-scope="{ row }">
                <span v-if="col.money" class="money">{{ fmtMoney(row[col.prop]) }}</span>
                <span v-else-if="col.prop === 'occupancyPct'">{{ row[col.prop] }}%</span>
                <span v-else>{{ row[col.prop] }}</span>
              </template>
            </el-table-column>
            <template slot="empty">
              <el-empty description="暂无报表数据" :image-size="60"></el-empty>
            </template>
          </el-table>

          <div class="totals-row">
            <div
              v-for="(col, idx) in report.columns || []"
              :key="col.prop"
              class="total-cell"
              :class="{ 'is-right': col.align === 'right' }"
            >
              <template v-if="idx === 0">合计</template>
              <template v-else>{{ totalsCell(col) }}</template>
            </div>
          </div>

          <div class="ai-summary-card">
            <div class="sum-head">
              <i class="el-icon-magic-stick"></i>
              <span>AI 摘要</span>
            </div>
            <div class="sum-text">{{ report.summary }}</div>
            <ul v-if="(report.highlights || []).length" class="sum-highlights">
              <li v-for="(h, i) in report.highlights" :key="i">{{ h }}</li>
            </ul>
            <AiMetaBar :meta="meta" :provider-label="providerLabel"></AiMetaBar>
            <AiDisclaimer :disclaimers="report.disclaimers || []"></AiDisclaimer>
          </div>
        </template>

        <el-alert
          v-else-if="!loading && error"
          type="error"
          :closable="false"
          :title="error"
          description="AI 报表不可用时不影响原有业务功能，可稍后重试。"
          show-icon
        ></el-alert>
        <el-empty v-else-if="!loading" description="暂无报表数据" :image-size="70"></el-empty>
      </div>
    </div>
  </div>
</template>

<script>
import AiDisclaimer from '@/components/AiDisclaimer.vue'
import AiMetaBar from '@/components/AiMetaBar.vue'
import { apiAiRun, apiAiSettings } from '@/api'
import { fmtMoney, centsToYuan } from '@/utils/money'
import { exportCsv } from '@/utils/csv'

const REPORT_TYPES = [
  { value: 'revenue', label: '收入结构' },
  { value: 'department', label: '科室工作量' },
  { value: 'doctor', label: '医生接诊量' },
  { value: 'medicine', label: '药品消耗' },
  { value: 'bed', label: '床位周转' }
]

export default {
  name: 'AiReports',
  components: { AiDisclaimer, AiMetaBar },
  data() {
    return {
      reportTypes: REPORT_TYPES,
      activeType: 'revenue',
      loading: false,
      error: '',
      report: null,
      meta: {},
      providerLabel: '本地确定性引擎',
      cache: {},
      requestSeq: 0
    }
  },
  created() {
    this.loadSettings()
    this.loadReport('revenue')
  },
  methods: {
    fmtMoney,
    async loadSettings() {
      try {
        const s = await apiAiSettings()
        if (s && s.providerLabel) this.providerLabel = s.providerLabel
      } catch (e) {
        /* 读取配置失败不影响报表展示 */
      }
    },
    onTabClick(tab) {
      const name = (tab && tab.name) || this.activeType
      this.loadReport(name)
    },
    async loadReport(type, force) {
      const key = type || 'revenue'
      this.activeType = key
      if (!force && this.cache[key]) {
        this.applyCache(key)
        return
      }
      const seq = ++this.requestSeq
      this.loading = true
      this.error = ''
      try {
        const res = await apiAiRun('report.summary', { reportType: key })
        if (seq !== this.requestSeq) return
        if (res && res.data) {
          this.cache[key] = { data: res.data, meta: res.meta || {} }
          this.applyCache(key)
        } else {
          this.report = null
          this.meta = {}
          this.error = '未获得报表数据，请稍后重试。'
        }
      } catch (e) {
        if (seq !== this.requestSeq) return
        this.report = null
        this.meta = {}
        this.error = (e && e.message) || '报表生成失败，请稍后重试。'
      } finally {
        if (seq === this.requestSeq) this.loading = false
      }
    },
    applyCache(type) {
      const item = this.cache[type]
      if (!item) return
      this.report = item.data
      this.meta = item.meta || {}
      this.error = ''
    },
    refresh() {
      this.cache = {}
      this.loadReport(this.activeType, true)
    },
    totalsCell(col) {
      const totals = (this.report && this.report.totals) || {}
      if (!Object.prototype.hasOwnProperty.call(totals, col.prop)) return ''
      const value = totals[col.prop]
      if (col.money) return fmtMoney(value)
      if (col.prop === 'occupancyPct') return value + '%'
      return value
    },
    exportReport() {
      const r = this.report
      if (!r || !r.rows || !r.rows.length) {
        this.$message.warning('暂无可导出的报表数据')
        return
      }
      const columns = r.columns || []
      const headers = columns.map((c) => ({ label: c.label, key: c.prop }))
      const rows = r.rows.map((row) => {
        const out = {}
        columns.forEach((c) => {
          out[c.prop] = c.money ? centsToYuan(row[c.prop]) : row[c.prop]
        })
        return out
      })
      exportCsv('智能报表-' + r.title, headers, rows)
      this.$message.success('CSV 已开始下载（金额已转换为元）')
    }
  }
}
</script>

<style lang="scss" scoped>
.report-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;

  .panel-title {
    margin-bottom: 0;
  }
}

.report-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.report-hint {
  margin-top: 12px;
  font-size: 12px;
  color: $text-secondary;
  background: #f7fafd;
  border-radius: $radius-sm;
  padding: 8px 10px;
  line-height: 1.6;

  i {
    color: $primary;
    margin-right: 4px;
  }
}

.report-tabs {
  margin-top: 6px;
}

.report-body {
  min-height: 160px;
}

.report-title-row {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 10px;

  .rt-title {
    font-size: 15px;
    font-weight: 600;
    color: $text-main;
  }

  .rt-sub {
    font-size: 12px;
    color: $text-secondary;
  }
}

.report-table {
  width: 100%;
}

.money {
  color: $text-main;
  font-variant-numeric: tabular-nums;
}

.totals-row {
  display: flex;
  align-items: center;
  border: 1px solid $border-color;
  border-top: none;
  background: $table-header-bg;
  font-size: 13px;
  color: $text-main;
  font-weight: 600;

  .total-cell {
    flex: 1;
    min-width: 0;
    padding: 9px 10px;
    text-align: left;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;

    &:first-child {
      color: $text-regular;
    }

    &.is-right {
      text-align: right;
    }
  }
}

.ai-summary-card {
  margin-top: 14px;
  border: 1px solid $primary-lighter;
  background: linear-gradient(180deg, #f7fbff 0%, #ffffff 100%);
  border-radius: $radius-md;
  padding: 12px 14px;

  .sum-head {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 14px;
    font-weight: 600;
    color: $primary-deep;

    i {
      font-size: 16px;
    }
  }

  .sum-text {
    margin-top: 8px;
    font-size: 13px;
    color: $text-main;
    line-height: 1.8;
  }

  .sum-highlights {
    margin: 8px 0 0;
    padding-left: 18px;

    li {
      font-size: 12px;
      color: $text-regular;
      line-height: 1.9;

      &::marker {
        color: $primary;
      }
    }
  }
}
</style>
