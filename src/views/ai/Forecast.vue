<template>
  <div class="app-page forecast-page" v-loading="loading">
    <!-- 顶部说明条 -->
    <div class="panel-card intro-bar">
      <div class="intro-left">
        <span class="intro-icon"><i class="el-icon-magic-stick"></i></span>
        <div class="intro-text">
          <div class="intro-title">
            流程预测分析
            <span class="intro-badge">B5 · 只读预测</span>
          </div>
          <div class="intro-desc">预测基于演示数据统计口径，仅作运营参考，不自动改变数据</div>
        </div>
      </div>
      <div class="intro-right">
        <span v-if="demoToday" class="as-of"><i class="el-icon-date"></i> 基准日 {{ demoToday }}</span>
        <el-button type="primary" size="small" icon="el-icon-refresh" :loading="loading" @click="loadAll">
          刷新预测
        </el-button>
      </div>
    </div>

    <!-- 部分失败提示 -->
    <el-alert
      v-if="failedCount > 0"
      class="fail-alert"
      type="warning"
      :closable="false"
      show-icon
      :title="'部分预测任务调用失败（' + failedCount + ' / ' + cards.length + '）'"
      :description="'已展示成功的结果；失败任务：' + failedNames + '。可点击「刷新预测」重试。'"
    ></el-alert>

    <!-- 5 张预测卡片 -->
    <el-row :gutter="12" class="forecast-grid">
      <el-col v-for="card in viewCards" :key="card.task" :xs="24" :sm="12" :md="8">
        <div class="panel-card forecast-card">
          <div class="card-head">
            <span class="card-icon" :style="{ background: card.bg, color: card.color }">
              <i :class="card.icon"></i>
            </span>
            <div class="card-head-text">
              <div class="card-title">{{ card.title }}</div>
              <div class="card-sub">{{ card.sub }}</div>
            </div>
            <el-tag v-if="card.data" size="mini" :type="confidenceTagType(card.data.confidence)">
              置信度 {{ confidencePct(card.data.confidence) }}%
            </el-tag>
          </div>

          <template v-if="card.data">
            <div class="card-value">
              <span class="num">{{ formatValue(card.data) }}</span>
              <span class="unit">{{ card.data.unit }}</span>
            </div>
            <div class="card-range">
              <span class="range-label">预测区间</span>
              <span class="range-value">{{ formatRange(card.data) }}</span>
            </div>
            <div v-if="card.data.breakdown && card.data.breakdown.length" class="card-breakdown">
              <span v-for="(item, i) in card.data.breakdown" :key="i" class="bd-chip">
                {{ item.label }} <b>{{ item.value }}</b>
              </span>
            </div>
            <div class="card-method">
              <div class="method-line">
                <span class="m-label">口径</span>
                <span class="m-text">{{ card.data.method }}</span>
              </div>
              <div class="method-line note-line">
                <span class="m-label">提示</span>
                <span class="m-text">{{ card.data.note }}</span>
              </div>
            </div>
            <AiMetaBar :meta="card.result.meta"></AiMetaBar>
            <div class="card-links">
              <el-link
                v-for="link in card.links"
                :key="link.path"
                type="primary"
                :underline="false"
                @click="go(link.path)"
              >
                <i :class="link.icon"></i> {{ link.label }}
              </el-link>
            </div>
          </template>

          <div v-else class="card-empty">
            <i class="el-icon-warning-outline"></i>
            <span>{{ card.error || (loading ? '预测计算中…' : '暂无预测结果') }}</span>
          </div>
        </div>
      </el-col>
    </el-row>

    <!-- 次日门诊量趋势图：最近 7 日实际 + 预测点 -->
    <div class="panel-card chart-card">
      <h3 class="panel-title">次日门诊量预测趋势</h3>
      <div class="chart-hint">
        <span class="legend-dot actual"></span>最近 7 日实际门诊量
        <span class="legend-dot forecast"></span>次日预测点（虚线）
        <span class="legend-dot band"></span>预测区间
      </div>
      <div class="chart-wrap">
        <div ref="outpatientChart" class="chart-box"></div>
        <div v-if="!hasOutpatient" class="chart-empty">
          <i class="el-icon-data-line"></i>
          <span>{{ loading ? '预测计算中…' : '暂无门诊量预测数据' }}</span>
        </div>
      </div>
    </div>

    <!-- 统计口径与免责声明 -->
    <div class="panel-card method-panel">
      <h3 class="panel-title">统计口径与使用说明</h3>
      <el-row :gutter="12">
        <el-col v-for="card in methodCards" :key="card.task" :xs="24" :md="12">
          <div class="method-item">
            <div class="method-title"><i :class="card.icon"></i> {{ card.title }}</div>
            <div class="method-body">{{ card.data.method }}</div>
          </div>
        </el-col>
      </el-row>
      <div class="confidence-note">
        <i class="el-icon-cpu"></i>
        置信度按样本量折算：0.5 + min(0.3, 0.02 × 样本数)，样本越多置信度越高（上限 0.8）；预测区间表示统计误差范围。
      </div>
      <div class="readonly-line">
        <i class="el-icon-lock"></i>
        预测为只读分析：AI 不调用任何业务写函数，不自动修改挂号、床位、医嘱、处方等业务数据；如需调整，请进入对应业务页面按原有校验操作。
      </div>
      <AiDisclaimer :disclaimers="disclaimers"></AiDisclaimer>
    </div>
  </div>
</template>

<script>
import * as echarts from 'echarts'
import AiDisclaimer from '@/components/AiDisclaimer.vue'
import AiMetaBar from '@/components/AiMetaBar.vue'
import { apiAiRun } from '@/api'

const TASK_NAMES = [
  'forecast.outpatient',
  'forecast.beds',
  'forecast.discharge',
  'forecast.backlog',
  'forecast.noshow'
]

export default {
  name: 'AiForecast',
  components: { AiDisclaimer, AiMetaBar },
  data() {
    return {
      loading: false,
      demoToday: '',
      results: {},
      errors: {},
      disclaimers: [],
      chart: null,
      cards: [
        {
          task: 'forecast.outpatient',
          title: '次日门诊量',
          sub: '门诊挂号量预测',
          icon: 'el-icon-user',
          bg: '#EAF4FE',
          color: '#3F9DF9',
          links: [
            { label: '门诊挂号', path: '/outpatient/registrations', icon: 'el-icon-tickets' },
            { label: '医生排班', path: '/outpatient/schedules', icon: 'el-icon-date' }
          ]
        },
        {
          task: 'forecast.beds',
          title: '次日床位需求',
          sub: '全院床位占用预测',
          icon: 'el-icon-office-building',
          bg: '#E0F7F6',
          color: '#0F9C96',
          links: [
            { label: '入院登记', path: '/inpatient/admissions', icon: 'el-icon-plus' },
            { label: '床位管理', path: '/basic/beds', icon: 'el-icon-s-grid' }
          ]
        },
        {
          task: 'forecast.discharge',
          title: '未来 3 日预计出院',
          sub: '出院与结算安排',
          icon: 'el-icon-s-home',
          bg: '#DBF9E6',
          color: '#23A56B',
          links: [{ label: '出院结算', path: '/inpatient/settlements', icon: 'el-icon-bank-card' }]
        },
        {
          task: 'forecast.backlog',
          title: '次日医嘱/发药积压',
          sub: '待处理业务项预测',
          icon: 'el-icon-s-order',
          bg: '#FDF3E3',
          color: '#D98E2B',
          links: [
            { label: '住院医嘱', path: '/inpatient/orders', icon: 'el-icon-s-order' },
            { label: '处方发药', path: '/outpatient/dispenses', icon: 'el-icon-box' }
          ]
        },
        {
          task: 'forecast.noshow',
          title: '挂号爽约风险率',
          sub: '退号占比风险预测',
          icon: 'el-icon-warning-outline',
          bg: '#FDE8E8',
          color: '#E05656',
          links: [{ label: '门诊挂号', path: '/outpatient/registrations', icon: 'el-icon-tickets' }]
        }
      ]
    }
  },
  computed: {
    viewCards() {
      return this.cards.map((card) => {
        const result = this.results[card.task] || null
        const data = (result && result.data) || null
        return Object.assign({}, card, {
          result: result,
          data: data,
          error: this.errors[card.task] || ''
        })
      })
    },
    methodCards() {
      return this.viewCards.filter((card) => !!card.data)
    },
    failedTasks() {
      return TASK_NAMES.filter((name) => !!this.errors[name])
    },
    failedCount() {
      return this.failedTasks.length
    },
    failedNames() {
      return this.failedTasks
        .map((name) => {
          const card = this.cards.find((c) => c.task === name)
          return card ? card.title : name
        })
        .join('、')
    },
    hasOutpatient() {
      const result = this.results['forecast.outpatient']
      return !!(result && result.data && result.data.series && result.data.series.length)
    }
  },
  mounted() {
    this.loadAll()
    window.addEventListener('resize', this.resizeChart)
    // ECharts 在 mounted 初始化（容器常驻），数据返回后仅 setOption
    this.$nextTick(() => this.initChart())
  },
  beforeDestroy() {
    window.removeEventListener('resize', this.resizeChart)
    this.disposeChart()
  },
  methods: {
    /** 并行调用 5 个预测任务；部分失败时保留成功结果并提示 */
    async loadAll() {
      this.loading = true
      const names = this.cards.map((card) => card.task)
      const settled = await Promise.all(
        names.map((name) =>
          apiAiRun(name, {})
            .then((result) => ({ name: name, result: result }))
            .catch((e) => ({ name: name, error: (e && e.message) || 'AI 调用失败' }))
        )
      )
      const results = {}
      const errors = {}
      const disclaimers = []
      let demoToday = ''
      settled.forEach((item) => {
        if (item.error) {
          errors[item.name] = item.error
          return
        }
        const result = item.result
        if (!result || result.ok === false) {
          errors[item.name] = (result && result.error) || 'AI 调用失败'
          return
        }
        results[item.name] = result
        const basis = (result.meta && result.meta.basis) || []
        if (!demoToday) {
          const base = basis.find((b) => b.label === '演示基准日')
          if (base && base.value) demoToday = base.value
        }
        const list = (result.data && result.data.disclaimers) || []
        list.forEach((d) => {
          if (disclaimers.indexOf(d) === -1) disclaimers.push(d)
        })
      })
      this.results = results
      this.errors = errors
      this.disclaimers = disclaimers
      if (demoToday) this.demoToday = demoToday
      this.loading = false
      this.$nextTick(() => this.renderChart())
    },
    formatValue(data) {
      if (!data) return '—'
      const value = Number(data.value)
      if (!isFinite(value)) return '—'
      return data.unit === '%' ? value.toFixed(1) : String(Math.round(value))
    },
    formatRange(data) {
      if (!data || !Array.isArray(data.range)) return '—'
      const unit = data.unit === '%' ? '%' : ' ' + (data.unit || '')
      return data.range[0] + ' ~ ' + data.range[1] + unit
    },
    confidencePct(value) {
      return Math.round((Number(value) || 0) * 100)
    },
    confidenceTagType(value) {
      const n = Number(value) || 0
      if (n >= 0.7) return 'success'
      if (n >= 0.6) return ''
      return 'warning'
    },
    go(path) {
      this.$router.push(path)
    },
    initChart() {
      if (!this.chart && this.$refs.outpatientChart) {
        this.chart = echarts.init(this.$refs.outpatientChart)
      }
    },
    renderChart() {
      const result = this.results['forecast.outpatient']
      const data = result && result.data
      if (!data || !Array.isArray(data.series) || !data.series.length) return
      this.initChart()
      if (!this.chart) return
      const series = data.series
      const labels = series.map((s) => String(s.date).slice(5))
      const actual = series.map((s) => (s.kind === 'forecast' ? null : s.value))
      const forecast = series.map((s) => (s.kind === 'forecast' ? s.value : null))
      // 让预测虚线与最后一个实际点相连，直观展示"从实际到预测"
      const lastActualIndex = series.length - 2
      if (lastActualIndex >= 0 && series[lastActualIndex].kind === 'actual') {
        forecast[lastActualIndex] = series[lastActualIndex].value
      }
      const forecastDate = labels[labels.length - 1]
      const prevDate = labels[labels.length - 2]
      const lo = data.range[0]
      const hi = data.range[1]
      const lastIndex = series.length - 1
      this.chart.setOption(
        {
          tooltip: { trigger: 'axis', axisPointer: { type: 'line' } },
          legend: {
            data: ['实际门诊量', '次日预测'],
            right: 8,
            top: 0,
            itemWidth: 12,
            itemHeight: 8,
            textStyle: { fontSize: 12, color: '#606266' }
          },
          grid: { left: 12, right: 24, top: 40, bottom: 8, containLabel: true },
          xAxis: {
            type: 'category',
            boundaryGap: false,
            data: labels,
            axisLine: { lineStyle: { color: '#dcdfe6' } },
            axisTick: { show: false },
            axisLabel: { color: '#909399', fontSize: 11 }
          },
          yAxis: {
            type: 'value',
            name: '人次',
            minInterval: 1,
            axisLabel: { color: '#909399', fontSize: 11 },
            splitLine: { lineStyle: { color: '#eef0f4' } }
          },
          series: [
            {
              name: '实际门诊量',
              type: 'line',
              data: actual,
              smooth: true,
              symbolSize: 6,
              connectNulls: false,
              lineStyle: { color: '#3F9DF9', width: 2 },
              itemStyle: { color: '#3F9DF9' },
              areaStyle: { color: 'rgba(63, 157, 249, 0.08)' }
            },
            {
              name: '次日预测',
              type: 'line',
              data: forecast,
              symbol: 'circle',
              symbolSize: 9,
              lineStyle: { type: 'dashed', color: '#E6A23C', width: 2 },
              itemStyle: { color: '#E6A23C' },
              label: {
                show: true,
                position: 'top',
                color: '#E6A23C',
                fontSize: 12,
                formatter: (p) => (p.dataIndex === lastIndex ? p.value : '')
              },
              markArea: {
                silent: true,
                itemStyle: { color: 'rgba(230, 162, 60, 0.12)' },
                data: [
                  [
                    { xAxis: prevDate, yAxis: lo },
                    { xAxis: forecastDate, yAxis: hi }
                  ]
                ]
              }
            }
          ]
        },
        true
      )
    },
    resizeChart() {
      if (this.chart) this.chart.resize()
    },
    disposeChart() {
      if (this.chart) {
        this.chart.dispose()
        this.chart = null
      }
    }
  }
}
</script>

<style lang="scss" scoped>
.forecast-page {
  padding-bottom: 4px;
}

/* ---------- 顶部说明条 ---------- */
.intro-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 12px;
}

.intro-left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.intro-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: $primary-lighter;
  color: $primary;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  flex-shrink: 0;
}

.intro-title {
  font-size: 15px;
  font-weight: 600;
  color: $text-main;
  display: flex;
  align-items: center;
  gap: 8px;
}

.intro-badge {
  font-size: 11px;
  font-weight: 400;
  color: $primary-deep;
  background: $primary-lighter;
  border-radius: 9px;
  padding: 1px 8px;
}

.intro-desc {
  font-size: 12px;
  color: $text-secondary;
  margin-top: 2px;
}

.intro-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.as-of {
  font-size: 12px;
  color: $text-secondary;
}

.fail-alert {
  margin-bottom: 12px;
}

/* ---------- 预测卡片 ---------- */
.forecast-grid {
  .el-col {
    margin-bottom: 12px;
  }
}

.forecast-card {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 250px;
}

.card-head {
  display: flex;
  align-items: center;
  gap: 10px;
}

.card-icon {
  width: 36px;
  height: 36px;
  border-radius: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  flex-shrink: 0;
}

.card-head-text {
  flex: 1;
  min-width: 0;
}

.card-title {
  font-size: 14px;
  font-weight: 600;
  color: $text-main;
}

.card-sub {
  font-size: 12px;
  color: $text-secondary;
  margin-top: 2px;
}

.card-value {
  margin-top: 12px;
  display: flex;
  align-items: baseline;
  gap: 4px;

  .num {
    font-size: 30px;
    line-height: 1.1;
    font-weight: 700;
    color: $text-main;
  }

  .unit {
    font-size: 13px;
    color: $text-secondary;
  }
}

.card-range {
  margin-top: 8px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: #f7fafd;
  border-radius: $radius-sm;
  padding: 3px 8px;
  align-self: flex-start;

  .range-label {
    font-size: 12px;
    color: $text-secondary;
  }

  .range-value {
    font-size: 12px;
    font-weight: 600;
    color: $primary-deep;
  }
}

.card-breakdown {
  margin-top: 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;

  .bd-chip {
    font-size: 12px;
    color: $text-secondary;
    background: #f8fafd;
    border-radius: 9px;
    padding: 1px 8px;

    b {
      color: $text-main;
      font-weight: 600;
    }
  }
}

.card-method {
  margin-top: 8px;

  .method-line {
    display: flex;
    gap: 6px;
    font-size: 12px;
    line-height: 1.65;
    color: $text-secondary;
    margin-top: 4px;
  }

  .m-label {
    flex-shrink: 0;
    font-weight: 600;
    color: $primary;
  }

  .note-line .m-label {
    color: $warning;
  }

  .m-text {
    flex: 1;
    min-width: 0;
    word-break: break-all;
  }
}

.card-links {
  margin-top: auto;
  padding-top: 10px;
  border-top: 1px dashed $border-light;
  display: flex;
  flex-wrap: wrap;
  gap: 14px;

  .el-link {
    font-size: 12px;
  }
}

.card-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 26px 0;
  color: $text-secondary;
  font-size: 12px;

  i {
    font-size: 22px;
    color: $info;
  }
}

/* ---------- 图表 ---------- */
.chart-card {
  margin-bottom: 12px;
}

.chart-hint {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  font-size: 12px;
  color: $text-secondary;
  margin: -4px 0 6px;
}

.legend-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
  margin-left: 6px;

  &.actual {
    background: $primary;
  }

  &.forecast {
    background: $warning;
  }

  &.band {
    border-radius: 2px;
    background: rgba(230, 162, 60, 0.35);
  }
}

.chart-wrap {
  position: relative;
}

.chart-box {
  width: 100%;
  height: 300px;
}

.chart-empty {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: $text-secondary;
  font-size: 13px;
  background: rgba(255, 255, 255, 0.7);

  i {
    font-size: 24px;
    color: $info;
  }
}

/* ---------- 口径说明 ---------- */
.method-item {
  height: 100%;
  background: #f8fafd;
  border-radius: $radius-md;
  padding: 10px 12px;
  margin-bottom: 10px;
}

.method-title {
  font-size: 13px;
  font-weight: 600;
  color: $text-main;

  i {
    color: $primary;
    margin-right: 4px;
  }
}

.method-body {
  margin-top: 4px;
  font-size: 12px;
  line-height: 1.7;
  color: $text-secondary;
}

.confidence-note {
  margin-top: 6px;
  font-size: 12px;
  line-height: 1.6;
  color: $text-secondary;
  background: $primary-lighter;
  border-radius: $radius-sm;
  padding: 8px 10px;

  i {
    color: $primary;
    margin-right: 4px;
  }
}

.readonly-line {
  margin-top: 6px;
  font-size: 12px;
  line-height: 1.6;
  color: $text-secondary;
  background: #f7fafd;
  border-radius: $radius-sm;
  padding: 8px 10px;

  i {
    color: $success;
    margin-right: 4px;
  }
}

@media (max-width: 900px) {
  .card-value .num {
    font-size: 24px;
  }

  .chart-box {
    height: 240px;
  }
}
</style>
