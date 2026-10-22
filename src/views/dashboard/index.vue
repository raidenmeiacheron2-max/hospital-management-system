<template>
  <div class="dashboard" v-loading="loading">
    <!-- 四张指标卡 -->
    <el-row :gutter="12" class="stat-row">
      <el-col :xs="12" :sm="12" :md="6">
        <div class="stat-card">
          <div class="stat-icon blue"><i class="el-icon-s-order"></i></div>
          <div class="stat-body">
            <div class="stat-label">今日门诊</div>
            <div class="stat-value">{{ stats.todayRegCount }}</div>
            <div class="stat-sub">今日新挂号人次</div>
          </div>
        </div>
      </el-col>
      <el-col :xs="12" :sm="12" :md="6">
        <div class="stat-card">
          <div class="stat-icon green"><i class="el-icon-s-custom"></i></div>
          <div class="stat-body">
            <div class="stat-label">在院患者</div>
            <div class="stat-value">{{ stats.inHospital.total }}</div>
            <div class="stat-sub">
              待入科 {{ stats.inHospital.pendingAdm }} / 在院 {{ stats.inHospital.inWard }} / 待结算
              {{ stats.inHospital.pendingSettle }}
            </div>
          </div>
        </div>
      </el-col>
      <el-col :xs="12" :sm="12" :md="6">
        <div class="stat-card">
          <div class="stat-icon cyan"><i class="el-icon-s-home"></i></div>
          <div class="stat-body">
            <div class="stat-label">空闲床位</div>
            <div class="stat-value">{{ stats.beds.idle }}</div>
            <div class="stat-sub">可立即办理入院</div>
          </div>
        </div>
      </el-col>
      <el-col :xs="12" :sm="12" :md="6">
        <div class="stat-card">
          <div class="stat-icon orange"><i class="el-icon-money"></i></div>
          <div class="stat-body">
            <div class="stat-label">收费金额</div>
            <div class="stat-value">{{ fmtMoney(stats.todayFeeCents) }}</div>
            <div class="stat-sub">今日门诊收费合计</div>
          </div>
        </div>
      </el-col>
    </el-row>

    <el-row :gutter="12" class="main-row">
      <!-- 左列：门诊收费图 + 待办闭环 -->
      <el-col :xs="24" :md="16">
        <div class="panel-card chart-card">
          <div class="card-head">
            <div>
              <div class="card-title">近七日门诊与收费</div>
              <div class="card-sub">人次走柱，金额走线，双轴对照</div>
            </div>
          </div>
          <div ref="trendChart" class="chart-box"></div>
        </div>
        <div class="panel-card">
          <div class="card-head">
            <div>
              <div class="card-title">
                待办闭环
                <span v-if="todoTotal" class="todo-badge">{{ todoTotal }} 项待处理</span>
              </div>
              <div class="card-sub">医嘱、发药、危急值和库存积压</div>
            </div>
          </div>
          <div class="todo-list">
            <div class="todo-item">
              <span class="todo-icon t-blue"><i class="el-icon-s-operation"></i></span>
              <div class="todo-info">
                <div class="todo-name">待执行住院医嘱</div>
                <div class="todo-desc">{{ stats.todo.pendingOrders ? stats.todo.pendingOrders + ' 条待执行' : '当前无积压' }}</div>
              </div>
              <span class="todo-count">{{ stats.todo.pendingOrders }}</span>
            </div>
            <div class="todo-item">
              <span class="todo-icon t-green"><i class="el-icon-medicine"></i></span>
              <div class="todo-info">
                <div class="todo-name">待发药处方</div>
                <div class="todo-desc">{{ stats.todo.pendingDispense ? stats.todo.pendingDispense + ' 张待发药' : '当前无积压' }}</div>
              </div>
              <span class="todo-count">{{ stats.todo.pendingDispense }}</span>
            </div>
            <div class="todo-item">
              <span class="todo-icon t-orange"><i class="el-icon-bank-card"></i></span>
              <div class="todo-info">
                <div class="todo-name">今日收费</div>
                <div class="todo-desc">门诊收费合计</div>
              </div>
              <span class="todo-count money">{{ fmtMoney(stats.todayFeeCents) }}</span>
            </div>
          </div>
        </div>
      </el-col>

      <!-- 右列：床位环图 + 快捷入口 -->
      <el-col :xs="24" :md="8">
        <div class="panel-card">
          <div class="card-head">
            <div>
              <div class="card-title">床位占用</div>
              <div class="card-sub">在院与空闲床位对照</div>
            </div>
          </div>
          <div ref="bedChart" class="chart-box donut-box"></div>
          <div class="bed-legend">
            <span class="legend-item"><i class="lg lg-occupied"></i>在院 {{ stats.beds.occupied }}</span>
            <span class="legend-item"><i class="lg lg-idle"></i>空闲 {{ stats.beds.idle }}</span>
            <span class="legend-item"><i class="lg lg-done"></i>已出院 {{ dischargedCount }}</span>
          </div>
        </div>
        <div class="panel-card">
          <div class="card-head">
            <div>
              <div class="card-title">快捷入口</div>
              <div class="card-sub">直接进入当日高频业务</div>
            </div>
          </div>
          <div class="quick-grid">
            <div v-for="q in quickLinks" :key="q.path" class="quick-item" @click="go(q)">
              <span class="quick-icon" :style="{ background: q.bg }"><i :class="q.icon"></i></span>
              <span class="quick-name">{{ q.label }}</span>
            </div>
          </div>
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<script>
import * as echarts from 'echarts'
import { apiStats, apiListAdmissions } from '@/api'
import { fmtMoney } from '@/utils/money'

export default {
  name: 'Dashboard',
  data() {
    return {
      loading: false,
      stats: {
        todayRegCount: 0,
        todayFeeCents: 0,
        inHospital: { pendingAdm: 0, inWard: 0, pendingSettle: 0, total: 0 },
        beds: { total: 0, occupied: 0, idle: 0, occupancyPct: 0 },
        last7days: [],
        todo: { pendingOrders: 0, pendingDispense: 0, todayFeeCents: 0 },
        regStatusCount: {}
      },
      dischargedCount: 0,
      trendChart: null,
      bedChart: null,
      quickLinks: [
        { label: '门诊挂号', icon: 'el-icon-tickets', path: '/outpatient/registrations', bg: '#e8f3fe', color: '#3f8fef' },
        { label: '建档分诊', icon: 'el-icon-notebook-2', path: '/patients', bg: '#dbf9e6', color: '#23a56b' },
        { label: '门诊接诊', icon: 'el-icon-s-check', path: '/outpatient/visits', bg: '#fdf3e3', color: '#d98e2b' },
        { label: '医生排班', icon: 'el-icon-date', path: '/outpatient/schedules', bg: '#f3e8ff', color: '#8b5cf6' },
        { label: '入院登记', icon: 'el-icon-plus', path: '/inpatient/admissions', bg: '#e0f7f6', color: '#0f9c96' },
        { label: '门诊收费', icon: 'el-icon-bank-card', path: '/outpatient/charges', bg: '#fde8e8', color: '#e05656' }
      ]
    }
  },
  computed: {
    todoTotal() {
      return this.stats.todo.pendingOrders + this.stats.todo.pendingDispense
    }
  },
  mounted() {
    this.loadData()
    window.addEventListener('resize', this.resizeCharts)
  },
  beforeDestroy() {
    window.removeEventListener('resize', this.resizeCharts)
    this.disposeCharts()
  },
  methods: {
    fmtMoney,
    async loadData() {
      this.loading = true
      try {
        const [stats, adm] = await Promise.all([apiStats(), apiListAdmissions({ size: 1000 })])
        this.stats = stats
        this.dischargedCount = adm.list.filter((a) => a.status === '已出院').length
        this.$nextTick(() => this.renderCharts())
      } finally {
        this.loading = false
      }
    },
    renderCharts() {
      this.disposeCharts()
      this.renderTrend()
      this.renderBed()
    },
    renderTrend() {
      const days = this.stats.last7days
      const chart = echarts.init(this.$refs.trendChart)
      chart.setOption({
        tooltip: { trigger: 'axis' },
        legend: {
          data: ['门诊人次', '收费金额'],
          right: 10,
          top: 0,
          itemWidth: 12,
          itemHeight: 8,
          textStyle: { fontSize: 12, color: '#606266' }
        },
        grid: { left: 46, right: 50, top: 36, bottom: 28 },
        xAxis: {
          type: 'category',
          data: days.map((d) => d.date.slice(5)),
          axisLine: { lineStyle: { color: '#dcdfe6' } },
          axisTick: { show: false },
          axisLabel: { color: '#909399', fontSize: 11 }
        },
        yAxis: [
          {
            type: 'value',
            name: '人次',
            minInterval: 1,
            axisLabel: { color: '#909399', fontSize: 11 },
            splitLine: { lineStyle: { color: '#eef0f4' } }
          },
          {
            type: 'value',
            name: '金额(元)',
            axisLabel: { color: '#909399', fontSize: 11, formatter: (v) => v },
            splitLine: { show: false }
          }
        ],
        series: [
          {
            name: '门诊人次',
            type: 'bar',
            barWidth: 18,
            data: days.map((d) => d.regCount),
            itemStyle: { color: '#a4d0ea', borderRadius: [3, 3, 0, 0] }
          },
          {
            name: '收费金额',
            type: 'line',
            yAxisIndex: 1,
            smooth: true,
            symbolSize: 6,
            data: days.map((d) => +(d.feeCents / 100).toFixed(2)),
            lineStyle: { color: '#2f78bf', width: 2 },
            itemStyle: { color: '#2f78bf' }
          }
        ]
      })
      this.trendChart = chart
    },
    renderBed() {
      const b = this.stats.beds
      const chart = echarts.init(this.$refs.bedChart)
      chart.setOption({
        tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
        series: [
          {
            type: 'pie',
            radius: ['58%', '76%'],
            center: ['50%', '46%'],
            avoidLabelOverlap: true,
            label: { show: false },
            data: [
              { value: b.occupied, name: '在院', itemStyle: { color: '#a4d0ea' } },
              { value: b.idle, name: '空闲', itemStyle: { color: '#eef2f7' } }
            ]
          }
        ],
        graphic: [
          {
            type: 'text',
            left: 'center',
            top: '40%',
            style: {
              text: b.occupancyPct + '%',
              fontSize: 26,
              fontWeight: 700,
              fill: '#303133',
              textAlign: 'center'
            }
          },
          {
            type: 'text',
            left: 'center',
            top: '56%',
            style: {
              text: '当前占用',
              fontSize: 12,
              fill: '#909399',
              textAlign: 'center'
            }
          }
        ]
      })
      this.bedChart = chart
    },
    resizeCharts() {
      if (this.trendChart) this.trendChart.resize()
      if (this.bedChart) this.bedChart.resize()
    },
    disposeCharts() {
      if (this.trendChart) {
        this.trendChart.dispose()
        this.trendChart = null
      }
      if (this.bedChart) {
        this.bedChart.dispose()
        this.bedChart = null
      }
    },
    go(link) {
      this.$router.push(link.path)
    }
  }
}
</script>

<style lang="scss" scoped>
.dashboard {
  min-height: 100%;
}

.stat-row {
  margin-bottom: 12px;
}

.stat-card {
  display: flex;
  align-items: center;
  background: $card-bg;
  border-radius: $radius-md;
  box-shadow: $shadow-card;
  border: 1px solid $border-light;
  padding: 16px 14px;
  height: 92px;
  overflow: hidden;
}

.stat-icon {
  width: 46px;
  height: 46px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  margin-right: 12px;
  flex-shrink: 0;

  &.blue {
    background: #e8f3fe;
    color: #3f8fef;
  }

  &.green {
    background: #dbf9e6;
    color: #23a56b;
  }

  &.cyan {
    background: #e0f7f6;
    color: #0f9c96;
  }

  &.orange {
    background: #fdf3e3;
    color: #d98e2b;
  }
}

.stat-body {
  min-width: 0;
}

.stat-label {
  font-size: 13px;
  color: $text-secondary;
}

.stat-value {
  font-size: 22px;
  font-weight: 700;
  color: $text-main;
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.stat-sub {
  font-size: 12px;
  color: $text-secondary;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.main-row {
  .el-col {
    margin-bottom: 12px;
  }
}

.card-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 10px;
}

.card-title {
  font-size: 15px;
  font-weight: 600;
  color: $text-main;
}

.card-sub {
  font-size: 12px;
  color: $text-secondary;
  margin-top: 3px;
}

.todo-badge {
  display: inline-block;
  margin-left: 8px;
  background: #fde8e8;
  color: #e05656;
  font-size: 12px;
  font-weight: 400;
  padding: 1px 8px;
  border-radius: 10px;
  vertical-align: 1px;
}

.chart-box {
  height: 300px;
}

.donut-box {
  height: 230px;
}

.todo-list {
  .todo-item {
    display: flex;
    align-items: center;
    padding: 12px 4px;
    border-bottom: 1px solid $border-light;

    &:last-child {
      border-bottom: none;
    }
  }

  .todo-icon {
    width: 38px;
    height: 38px;
    border-radius: 9px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    margin-right: 12px;
    flex-shrink: 0;

    &.t-blue {
      background: #e8f3fe;
      color: #3f8fef;
    }

    &.t-green {
      background: #dbf9e6;
      color: #23a56b;
    }

    &.t-orange {
      background: #fdf3e3;
      color: #d98e2b;
    }
  }

  .todo-info {
    flex: 1;
    min-width: 0;
  }

  .todo-name {
    font-size: 14px;
    color: $text-main;
  }

  .todo-desc {
    font-size: 12px;
    color: $text-secondary;
    margin-top: 2px;
  }

  .todo-count {
    font-size: 18px;
    font-weight: 700;
    color: $text-main;

    &.money {
      font-size: 16px;
    }
  }
}

.bed-legend {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 14px;
  padding-top: 4px;

  .legend-item {
    font-size: 12px;
    color: $text-regular;
    display: inline-flex;
    align-items: center;

    .lg {
      display: inline-block;
      width: 10px;
      height: 10px;
      border-radius: 2px;
      margin-right: 5px;

      &.lg-occupied {
        background: #a4d0ea;
      }

      &.lg-idle {
        background: #eef2f7;
        border: 1px solid #dcdfe6;
      }

      &.lg-done {
        background: #b9c4d2;
      }
    }
  }
}

.quick-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.quick-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px 4px;
  border-radius: $radius-md;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: #f5f8fd;
  }

  .quick-icon {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 19px;
    margin-bottom: 6px;
  }

  .quick-name {
    font-size: 12px;
    color: $text-regular;
  }
}

@media (max-width: 992px) {
  .stat-card {
    margin-bottom: 12px;
  }
}
</style>
