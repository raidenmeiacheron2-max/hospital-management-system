<template>
  <div class="workbench" v-loading="loading">
    <div v-if="error" class="panel-card error-state">
      <i class="el-icon-warning-outline"></i>
      <p>{{ error }}</p>
      <el-button type="primary" size="small" @click="load">重新加载</el-button>
    </div>

    <template v-else>
      <div class="wb-header">
        <div class="wb-title">
          <span class="role-badge">{{ roleName || '工作台' }}</span>
          <span class="wb-greet">{{ staffName }}，欢迎回来</span>
          <span class="wb-date">{{ summary.today }}</span>
        </div>
        <div class="wb-actions">
          <el-button size="small" icon="el-icon-tickets" @click="$router.push('/workbench/todos')">待办中心</el-button>
          <el-button size="small" icon="el-icon-bell" @click="$router.push('/workbench/reminders')">提醒中心</el-button>
        </div>
      </div>

      <el-row :gutter="12" class="kpi-row">
        <el-col v-for="k in kpis" :key="k.label" :xs="12" :sm="6">
          <div class="kpi-card">
            <span class="kpi-icon" :style="{ background: k.bg, color: k.color }"><i :class="k.icon"></i></span>
            <div class="kpi-body">
              <div class="kpi-label">{{ k.label }}</div>
              <div class="kpi-value">{{ k.value }}</div>
              <div class="kpi-sub">{{ k.sub }}</div>
            </div>
          </div>
        </el-col>
      </el-row>

      <el-row :gutter="12">
        <el-col :xs="24" :md="16">
          <div v-for="p in queuePanels" :key="p.key" class="panel-card queue-card">
            <div class="card-head">
              <div>
                <div class="card-title">{{ p.title }} <span class="count-badge">{{ p.count }}</span></div>
                <div class="card-sub">{{ p.desc }}</div>
              </div>
              <el-button v-if="p.link" type="text" @click="$router.push(p.link)">查看全部 <i class="el-icon-arrow-right"></i></el-button>
            </div>
            <div v-if="p.note" class="panel-note">{{ p.note }}</div>
            <div v-if="!p.items.length" class="empty-state">暂无待处理事项</div>
            <div v-else class="queue-list">
              <div v-for="it in p.items" :key="it.id" class="queue-item" @click="goItem(p, it)">
                <div class="qi-main">
                  <span class="qi-title">{{ itemTitle(it) }}</span>
                  <span class="qi-sub">{{ itemSub(it) }}</span>
                </div>
                <StatusTag v-if="it.status" :label="it.status" />
                <i v-if="it.link || p.link" class="el-icon-arrow-right qi-arrow"></i>
              </div>
            </div>
          </div>

          <div v-if="isAdmin" class="panel-card overview-card">
            <div class="card-head">
              <div>
                <div class="card-title">运营概览</div>
                <div class="card-sub">保留原首页指标与图表</div>
              </div>
            </div>
            <dashboard-overview />
          </div>
        </el-col>

        <el-col :xs="24" :md="8">
          <div class="panel-card">
            <div class="card-head">
              <div>
                <div class="card-title">我的待办 <span class="count-badge">{{ todoPending }}</span></div>
                <div class="card-sub">个人工作事项</div>
              </div>
              <el-button type="text" @click="$router.push('/workbench/todos')">管理</el-button>
            </div>
            <div v-if="!myTodos.length" class="empty-state">暂无待办，去创建一个吧</div>
            <div v-else class="todo-mini">
              <div v-for="t in myTodos" :key="t.id" class="todo-mini-item">
                <el-checkbox :value="t.status === '已完成'" @change="toggleTodo(t)"></el-checkbox>
                <div class="tm-main">
                  <div class="tm-title" :class="{ done: t.status === '已完成' }">{{ t.title }}</div>
                  <div class="tm-sub">{{ t.module || '未关联模块' }} · {{ t.dueDate || '无截止' }}</div>
                </div>
                <span class="prio" :class="'p-' + (t.priorityConfirmed || t.prioritySuggested)">{{ t.priorityConfirmed || t.prioritySuggested }}</span>
              </div>
            </div>
          </div>

          <div class="panel-card">
            <div class="card-head">
              <div>
                <div class="card-title">系统提醒 <span class="count-badge">{{ reminders.length }}</span></div>
                <div class="card-sub">由业务规则实时生成</div>
              </div>
              <el-button type="text" @click="$router.push('/workbench/reminders')">管理</el-button>
            </div>
            <div v-if="!reminders.length" class="empty-state">暂无系统提醒</div>
            <div v-else class="reminder-mini">
              <div v-for="r in topReminders" :key="r.id" class="rm-item">
                <span class="rm-level" :class="'lv-' + r.level">{{ levelText(r.level) }}</span>
                <div class="rm-main">
                  <div class="rm-title">{{ r.title }}</div>
                  <div class="rm-sub">{{ r.detail }}</div>
                </div>
                <el-button type="text" @click="goReminder(r)">查看</el-button>
              </div>
            </div>
          </div>

          <div class="panel-card">
            <div class="card-head">
              <div>
                <div class="card-title">明日运营预测</div>
                <div class="card-sub">AI 只读预测 · 演示口径</div>
              </div>
              <el-button type="text" @click="$router.push('/ai/forecast')">详情</el-button>
            </div>
            <div v-if="forecastError" class="empty-state">{{ forecastError }}</div>
            <div v-else-if="!forecast" class="empty-state">{{ forecastLoading ? '预测计算中…' : '暂无预测' }}</div>
            <div v-else class="forecast-grid">
              <div class="fc-item">
                <div class="fc-value">{{ forecast.outpatient.value }}<span class="fc-unit">{{ forecast.outpatient.unit }}</span></div>
                <div class="fc-label">次日门诊量</div>
                <div class="fc-range">区间 {{ forecast.outpatient.range[0] }}–{{ forecast.outpatient.range[1] }}</div>
              </div>
              <div class="fc-item">
                <div class="fc-value">{{ forecast.beds.value }}<span class="fc-unit">{{ forecast.beds.unit }}</span></div>
                <div class="fc-label">次日床位需求</div>
                <div class="fc-range">区间 {{ forecast.beds.range[0] }}–{{ forecast.beds.range[1] }}</div>
              </div>
              <div class="fc-item">
                <div class="fc-value">{{ forecast.backlog.value }}<span class="fc-unit">{{ forecast.backlog.unit }}</span></div>
                <div class="fc-label">医嘱/发药积压</div>
                <div class="fc-range">区间 {{ forecast.backlog.range[0] }}–{{ forecast.backlog.range[1] }}</div>
              </div>
            </div>
            <div v-if="forecast" class="fc-note">基于最近 7 日演示数据统计口径，仅作运营参考，不自动改变数据。</div>
          </div>

          <div class="panel-card">
            <div class="card-head">
              <div>
                <div class="card-title">快捷入口</div>
                <div class="card-sub">按当前角色展示</div>
              </div>
            </div>
            <div class="quick-grid">
              <div v-for="q in quickLinks" :key="q.path" class="quick-item" @click="$router.push(q.path)">
                <span class="quick-icon" :style="{ background: q.bg }"><i :class="q.icon"></i></span>
                <span class="quick-name">{{ q.label }}</span>
              </div>
            </div>
          </div>
        </el-col>
      </el-row>
    </template>
  </div>
</template>

<script>
import StatusTag from '@/components/StatusTag.vue'
import DashboardOverview from '@/views/dashboard/index.vue'
import { apiWorkbenchSummary, apiListTodos, apiListReminders, apiSetTodoStatus, apiAiRun, apiAiSettings } from '@/api'
import { fmtMoney } from '@/utils/money'

const QUICK = [
  { label: '门诊接诊', icon: 'el-icon-s-check', path: '/outpatient/visits', menu: 'outpatient-visit', bg: '#fdf3e3' },
  { label: '门诊收费', icon: 'el-icon-bank-card', path: '/outpatient/charges', menu: 'outpatient-charge', bg: '#fde8e8' },
  { label: '处方发药', icon: 'el-icon-medicine', path: '/outpatient/dispenses', menu: 'outpatient-dispense', bg: '#dbf9e6' },
  { label: '医技报告', icon: 'el-icon-document-checked', path: '/outpatient/reports', menu: 'outpatient-report', bg: '#e8f3fe' },
  { label: '患者档案', icon: 'el-icon-notebook-2', path: '/patients', menu: 'patient-list', bg: '#e0f7f6' },
  { label: '患者时间线', icon: 'el-icon-time', path: '/patients/timeline', menu: 'patient-timeline', bg: '#f3e8ff' },
  { label: '入院登记', icon: 'el-icon-plus', path: '/inpatient/admissions', menu: 'inpatient-admission', bg: '#f3e8ff' },
  { label: '住院医嘱', icon: 'el-icon-s-operation', path: '/inpatient/orders', menu: 'inpatient-order', bg: '#fdf3e3' },
  { label: '出院结算', icon: 'el-icon-s-finance', path: '/inpatient/settlements', menu: 'inpatient-settlement', bg: '#fde8e8' },
  { label: '员工管理', icon: 'el-icon-user', path: '/basic/staff', menu: 'basic-staff', bg: '#e8f3fe' },
  { label: '用户角色', icon: 'el-icon-s-custom', path: '/system/roles', menu: 'system-role', bg: '#f3e8ff' },
  { label: '审计中心', icon: 'el-icon-finished', path: '/system/audit', menu: 'system-audit', bg: '#e0f7f6' }
]

export default {
  name: 'Workbench',
  components: { StatusTag, DashboardOverview },
  data() {
    return {
      loading: false,
      error: '',
      summary: { capabilities: {}, stats: {}, counts: {}, queues: {} },
      todos: [],
      reminders: [],
      forecast: null,
      forecastLoading: false,
      forecastError: ''
    }
  },
  computed: {
    staff() {
      return this.$store.state.user.staff
    },
    staffName() {
      return this.summary.staffName || (this.staff && this.staff.name) || '用户'
    },
    roleName() {
      return this.summary.roleName || (this.staff && this.staff.role) || ''
    },
    caps() {
      return this.summary.capabilities || {}
    },
    isAdmin() {
      return !!this.caps.admin
    },
    todoPending() {
      return this.todos.filter((t) => t.status !== '已完成').length
    },
    myTodos() {
      return this.todos.filter((t) => t.status !== '已完成').slice(0, 5)
    },
    topReminders() {
      return this.reminders.slice(0, 5)
    },
    kpis() {
      const s = this.summary.stats || {}
      const c = this.summary.counts || {}
      if (this.isAdmin) {
        return [
          { label: '今日门诊', value: s.todayRegCount || 0, sub: '今日新挂号', icon: 'el-icon-s-order', bg: '#e8f3fe', color: '#3f8fef' },
          { label: '在院患者', value: (s.inHospital && s.inHospital.total) || 0, sub: '待入科/在院/待结算', icon: 'el-icon-s-custom', bg: '#dbf9e6', color: '#23a56b' },
          { label: '床位占用率', value: ((s.beds && s.beds.occupancyPct) || 0) + '%', sub: '空闲 ' + ((s.beds && s.beds.idle) || 0) + ' 张', icon: 'el-icon-s-home', bg: '#e0f7f6', color: '#0f9c96' },
          { label: '今日收费', value: fmtMoney(s.todayFeeCents || 0), sub: '已缴费合计', icon: 'el-icon-money', bg: '#fdf3e3', color: '#d98e2b' }
        ]
      }
      if (this.caps.cashier) {
        return [
          { label: '待收费业务', value: c.pendingCharge || 0, sub: '已接诊未收费', icon: 'el-icon-bank-card', bg: '#fde8e8', color: '#e05656' },
          { label: '待发药业务', value: c.pendingDispense || 0, sub: '已收费未发药', icon: 'el-icon-medicine', bg: '#dbf9e6', color: '#23a56b' },
          { label: '待结算住院', value: c.pendingSettle || 0, sub: '可办理出院结算', icon: 'el-icon-s-finance', bg: '#f3e8ff', color: '#8b5cf6' },
          { label: '今日收费', value: fmtMoney(s.todayFeeCents || 0), sub: '已缴费合计', icon: 'el-icon-money', bg: '#fdf3e3', color: '#d98e2b' }
        ]
      }
      if (this.caps.inpatient) {
        return [
          { label: '待入科', value: c.pendingAdm || 0, sub: '已登记待入科', icon: 'el-icon-plus', bg: '#fdf3e3', color: '#d98e2b' },
          { label: '待执行医嘱', value: c.pendingOrders || 0, sub: '未执行医嘱', icon: 'el-icon-s-operation', bg: '#e8f3fe', color: '#3f8fef' },
          { label: '在院患者', value: (s.inHospital && s.inHospital.inWard) || 0, sub: '当前在院', icon: 'el-icon-s-custom', bg: '#dbf9e6', color: '#23a56b' },
          { label: '待结算', value: c.pendingSettle || 0, sub: '待出院结算', icon: 'el-icon-s-finance', bg: '#fde8e8', color: '#e05656' }
        ]
      }
      return [
        { label: '待接诊', value: c.myPendingRegs || 0, sub: '我的待分诊挂号', icon: 'el-icon-s-check', bg: '#fdf3e3', color: '#d98e2b' },
        { label: '待出报告', value: c.myPendingReports || 0, sub: '我的待处理报告', icon: 'el-icon-document-checked', bg: '#e8f3fe', color: '#3f8fef' },
        { label: '今日门诊', value: s.todayRegCount || 0, sub: '今日新挂号', icon: 'el-icon-s-order', bg: '#dbf9e6', color: '#23a56b' },
        { label: '我的未完成待办', value: this.todoPending, sub: '个人事项', icon: 'el-icon-tickets', bg: '#f3e8ff', color: '#8b5cf6' }
      ]
    },
    queuePanels() {
      const q = this.summary.queues || {}
      const c = this.summary.counts || {}
      const panels = []
      const add = (key, title, desc, items, link, note) => {
        const list = items || []
        panels.push({ key: key, title: title, desc: desc, items: list, link: link || '', count: (c[key] !== undefined ? c[key] : list.length), note: note || '' })
      }
      if (this.isAdmin) {
        add('lowStock', '库存偏低药品', '低于阈值的药品需补货', q.lowStock, '/basic/medicines')
        add('pendingCharge', '待收费接诊', '已接诊未收费的业务', q.pendingCharge, '/outpatient/charges')
        add('pendingSettle', '待结算住院', '可办理出院结算的记录', q.pendingSettle, '/inpatient/settlements')
      } else if (this.caps.cashier) {
        add('pendingCharge', '待收费业务', '已接诊未收费', q.pendingCharge, '/outpatient/charges')
        add('pendingDispense', '待发药业务', '已收费未发药', q.pendingDispense, '/outpatient/dispenses')
        add('pendingSettle', '待结算住院', '可办理出院结算', q.pendingSettle, '/inpatient/settlements')
      } else if (this.caps.inpatient) {
        add('pendingAdm', '待入科患者', '已登记待入科', q.pendingAdm, '/inpatient/admissions')
        add('pendingOrders', '待执行医嘱', '未执行医嘱', q.pendingOrders, '/inpatient/orders')
        add('pendingSettle', '待结算住院', '可办理出院结算', q.pendingSettle, '/inpatient/settlements')
      } else {
        add('myPendingRegs', '待接诊患者', '我的待分诊挂号', q.myPendingRegs, '/outpatient/visits')
        add('myPendingReports', '待处理检查报告', '我的待出报告', q.myPendingReports, '/outpatient/reports')
        add('pendingOrders', '待处理医嘱', '全院未执行医嘱', q.pendingOrders, this.caps.inpatient ? '/inpatient/orders' : '', this.caps.inpatient ? '' : '当前角色无住院权限，仅展示统计，需住院权限查看详情')
        // 患者诊疗进度
        const map = {}
        ;(q.myPendingRegs || []).concat(q.myPendingReports || []).forEach((it) => {
          if (it.patientId && !map[it.patientId]) {
            map[it.patientId] = { id: 'pt-' + it.patientId, patientId: it.patientId, patientName: it.patientName, code: '患者诊疗进度', status: '', link: '/patients/timeline?patientId=' + it.patientId }
          }
        })
        add('myPatients', '患者诊疗进度', '点击进入患者 360° 时间线', Object.keys(map).map((k) => map[k]), '/patients/timeline')
      }
      return panels
    },
    quickLinks() {
      return QUICK.filter((q) => this.$can(q.menu)).slice(0, 6)
    }
  },
  created() {
    this.load()
    this.loadForecast()
  },
  methods: {
    async loadForecast() {
      this.forecastLoading = true
      this.forecastError = ''
      try {
        // 先读 AI 开关，关闭时不发起 AI 调用（避免无意义的失败提示）
        const cfg = await apiAiSettings()
        if (cfg && cfg.enabled === false) {
          this.forecastError = 'AI 已关闭（可在 AI 治理中心开启）'
          return
        }
        const [outpatient, beds, backlog] = await Promise.all([
          apiAiRun('forecast.outpatient', {}),
          apiAiRun('forecast.beds', {}),
          apiAiRun('forecast.backlog', {})
        ])
        this.forecast = {
          outpatient: outpatient.data,
          beds: beds.data,
          backlog: backlog.data
        }
      } catch (e) {
        // AI 关闭或任务不可用时不阻塞工作台
        this.forecastError = 'AI 预测暂不可用（可在 AI 治理中心开启）'
      } finally {
        this.forecastLoading = false
      }
    },
    async load() {
      this.loading = true
      this.error = ''
      try {
        const staffId = this.staff ? this.staff.id : ''
        const [summary, todoRes, remRes] = await Promise.all([
          apiWorkbenchSummary(),
          apiListTodos({ ownerStaffId: staffId, size: 1000 }),
          apiListReminders()
        ])
        this.summary = summary || this.summary
        this.todos = (todoRes && todoRes.list) || []
        this.reminders = (remRes && remRes.items) || []
      } catch (e) {
        this.error = e.message || '工作台加载失败'
      } finally {
        this.loading = false
      }
    },
    itemTitle(it) {
      if (it.patientName) return it.patientName + (it.code ? ' · ' + it.code : '')
      if (it.name) return it.name
      return it.code || it.id
    },
    itemSub(it) {
      const parts = []
      if (it.departmentName) parts.push(it.departmentName)
      if (it.wardName) parts.push(it.wardName)
      if (it.bedCode) parts.push(it.bedCode)
      if (it.date) parts.push(it.date + (it.period ? ' ' + it.period : ''))
      if (it.admissionCode) parts.push('住院 ' + it.admissionCode)
      if (it.stock !== undefined) parts.push('库存 ' + it.stock)
      if (it.status) parts.push(it.status)
      return parts.join(' · ')
    },
    goItem(panel, it) {
      const path = it.link || panel.link
      if (path) this.$router.push(path)
    },
    goReminder(r) {
      if (r.link) this.$router.push(r.link)
      else this.$router.push('/workbench/reminders')
    },
    levelText(l) {
      return l === 'high' ? '高' : l === 'medium' ? '中' : '低'
    },
    async toggleTodo(t) {
      try {
        await apiSetTodoStatus(t.id, t.status === '已完成' ? '未完成' : '已完成')
        this.$message.success('待办状态已更新')
        const res = await apiListTodos({ ownerStaffId: this.staff ? this.staff.id : '', size: 1000 })
        this.todos = (res && res.list) || []
      } catch (e) {
        /* 拦截器已提示 */
      }
    }
  }
}
</script>

<style lang="scss" scoped>
.workbench {
  min-height: 100%;
}

.wb-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 12px;
}

.wb-title {
  display: flex;
  align-items: center;
  gap: 10px;

  .role-badge {
    background: $primary-lighter;
    color: $primary-dark;
    border-radius: 12px;
    padding: 3px 12px;
    font-size: 13px;
    font-weight: 600;
  }

  .wb-greet {
    font-size: 16px;
    font-weight: 600;
    color: $text-main;
  }

  .wb-date {
    font-size: 12px;
    color: $text-secondary;
  }
}

.kpi-row {
  margin-bottom: 4px;
}

.kpi-card {
  display: flex;
  align-items: center;
  background: $card-bg;
  border-radius: $radius-md;
  box-shadow: $shadow-card;
  border: 1px solid $border-light;
  padding: 14px 12px;
  height: 88px;
  margin-bottom: 12px;
}

.kpi-icon {
  width: 42px;
  height: 42px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  margin-right: 10px;
  flex-shrink: 0;
}

.kpi-body {
  min-width: 0;
}

.kpi-label {
  font-size: 13px;
  color: $text-secondary;
}

.kpi-value {
  font-size: 21px;
  font-weight: 700;
  color: $text-main;
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.kpi-sub {
  font-size: 12px;
  color: $text-secondary;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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

.count-badge {
  display: inline-block;
  margin-left: 6px;
  background: #e8f3fe;
  color: $primary-dark;
  font-size: 12px;
  font-weight: 500;
  padding: 0 8px;
  border-radius: 10px;
  vertical-align: 1px;
}

.queue-card {
  margin-bottom: 12px;
}

.panel-note {
  font-size: 12px;
  color: #a35555;
  background: #fef3f3;
  border: 1px solid #f3c7c7;
  border-radius: 4px;
  padding: 6px 10px;
  margin-bottom: 8px;
}

.queue-list {
  max-height: 280px;
  overflow-y: auto;
}

.queue-item {
  display: flex;
  align-items: center;
  padding: 9px 4px;
  border-bottom: 1px solid $border-light;
  cursor: pointer;

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background: #f7fafd;
  }
}

.qi-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.qi-title {
  font-size: 14px;
  color: $text-main;
}

.qi-sub {
  font-size: 12px;
  color: $text-secondary;
  margin-top: 2px;
}

.qi-arrow {
  color: $text-secondary;
  margin-left: 8px;
}

.empty-state {
  text-align: center;
  color: $text-secondary;
  font-size: 13px;
  padding: 18px 0;
}

.error-state {
  text-align: center;
  padding: 40px 0;
  color: $text-regular;

  i {
    font-size: 30px;
    color: $warning;
  }
}

.todo-mini-item {
  display: flex;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid $border-light;

  &:last-child {
    border-bottom: none;
  }
}

.tm-main {
  flex: 1;
  min-width: 0;
  margin-left: 6px;
}

.tm-title {
  font-size: 13px;
  color: $text-main;

  &.done {
    color: $text-secondary;
    text-decoration: line-through;
  }
}

.tm-sub {
  font-size: 12px;
  color: $text-secondary;
  margin-top: 2px;
}

.prio {
  font-size: 11px;
  border-radius: 8px;
  padding: 1px 7px;
  flex-shrink: 0;

  &.p-高 {
    background: #fde8e8;
    color: #e05656;
  }

  &.p-中 {
    background: #fdf3e3;
    color: #d98e2b;
  }

  &.p-低 {
    background: #f0f2f5;
    color: #909399;
  }
}

.rm-item {
  display: flex;
  align-items: flex-start;
  padding: 8px 0;
  border-bottom: 1px solid $border-light;

  &:last-child {
    border-bottom: none;
  }
}

.rm-level {
  font-size: 11px;
  border-radius: 8px;
  padding: 1px 6px;
  margin-right: 8px;
  flex-shrink: 0;
  margin-top: 2px;

  &.lv-high {
    background: #fde8e8;
    color: #e05656;
  }

  &.lv-medium {
    background: #fdf3e3;
    color: #d98e2b;
  }

  &.lv-low {
    background: #f0f2f5;
    color: #909399;
  }
}

.rm-main {
  flex: 1;
  min-width: 0;
}

.rm-title {
  font-size: 13px;
  color: $text-main;
}

.rm-sub {
  font-size: 12px;
  color: $text-secondary;
  margin-top: 2px;
}

.quick-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.quick-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 10px 4px;
  border-radius: $radius-md;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: #f5f8fd;
  }

  .quick-icon {
    width: 38px;
    height: 38px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    margin-bottom: 6px;
  }

  .quick-name {
    font-size: 12px;
    color: $text-regular;
  }
}

.overview-card {
  ::v-deep .dashboard {
    min-height: auto;
  }
}

.forecast-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.fc-item {
  background: #f8fafd;
  border-radius: $radius-sm;
  padding: 10px 8px;
  text-align: center;
}

.fc-value {
  font-size: 20px;
  font-weight: 700;
  color: $primary-deep;
  line-height: 1.2;
}

.fc-unit {
  font-size: 12px;
  font-weight: 400;
  color: $text-secondary;
  margin-left: 2px;
}

.fc-label {
  font-size: 12px;
  color: $text-regular;
  margin-top: 4px;
}

.fc-range {
  font-size: 11px;
  color: $text-secondary;
  margin-top: 2px;
}

.fc-note {
  margin-top: 10px;
  font-size: 12px;
  color: $text-secondary;
  background: #f7fafd;
  border-radius: $radius-sm;
  padding: 7px 9px;
  line-height: 1.6;
}
</style>
