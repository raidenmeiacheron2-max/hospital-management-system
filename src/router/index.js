import Vue from 'vue'
import VueRouter from 'vue-router'
import store from '@/store'
import { getToken } from '@/utils/auth'
import { flattenMenus } from '@/config/menu'
import { hasMenu } from '@/utils/perm'

Vue.use(VueRouter)

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/login/index.vue'),
    meta: { title: '登录', noTab: true }
  },
  {
    path: '/',
    component: () => import('@/layout/index.vue'),
    redirect: '/dashboard',
    children: [
      { path: 'dashboard', name: 'Dashboard', component: () => import('@/views/workbench/index.vue'), meta: { title: '首页', menuCode: 'home', affix: true } },
      { path: 'workbench/todos', name: 'WorkbenchTodos', component: () => import('@/views/workbench/TodoCenter.vue'), meta: { title: '待办中心', menuCode: 'home' } },
      { path: 'workbench/reminders', name: 'WorkbenchReminders', component: () => import('@/views/workbench/ReminderCenter.vue'), meta: { title: '提醒中心', menuCode: 'home' } },
      { path: 'basic/departments', name: 'Departments', component: () => import('@/views/basic/DepartmentList.vue'), meta: { title: '科室管理', menuCode: 'basic-dept' } },
      { path: 'basic/staff', name: 'Staff', component: () => import('@/views/basic/StaffList.vue'), meta: { title: '员工管理', menuCode: 'basic-staff' } },
      { path: 'basic/wards', name: 'Wards', component: () => import('@/views/basic/WardList.vue'), meta: { title: '病区管理', menuCode: 'basic-ward' } },
      { path: 'basic/beds', name: 'Beds', component: () => import('@/views/basic/BedList.vue'), meta: { title: '床位管理', menuCode: 'basic-bed' } },
      { path: 'basic/fee-items', name: 'FeeItems', component: () => import('@/views/basic/FeeItemList.vue'), meta: { title: '收费项目', menuCode: 'basic-fee' } },
      { path: 'basic/medicines', name: 'Medicines', component: () => import('@/views/basic/MedicineList.vue'), meta: { title: '药品目录', menuCode: 'basic-medicine' } },
      { path: 'basic/exam-items', name: 'ExamItems', component: () => import('@/views/basic/ExamItemList.vue'), meta: { title: '检验检查项目', menuCode: 'basic-exam' } },
      { path: 'basic/stocks', name: 'Stocks', component: () => import('@/views/basic/StockList.vue'), meta: { title: '批次库存', menuCode: 'basic-stock' } },
      { path: 'patients', name: 'Patients', component: () => import('@/views/patients/PatientList.vue'), meta: { title: '患者档案', menuCode: 'patient-list' } },
      { path: 'patients/timeline', name: 'PatientTimeline', component: () => import('@/views/patients/Timeline.vue'), meta: { title: '患者360°时间线', menuCode: 'patient-timeline' } },
      { path: 'outpatient/schedules', name: 'Schedules', component: () => import('@/views/outpatient/ScheduleList.vue'), meta: { title: '医生排班', menuCode: 'outpatient-schedule' } },
      { path: 'outpatient/registrations', name: 'Registrations', component: () => import('@/views/outpatient/RegistrationList.vue'), meta: { title: '门诊挂号', menuCode: 'outpatient-registration' } },
      { path: 'outpatient/visits', name: 'Visits', component: () => import('@/views/outpatient/VisitList.vue'), meta: { title: '门诊接诊', menuCode: 'outpatient-visit' } },
      { path: 'outpatient/prescriptions', name: 'Prescriptions', component: () => import('@/views/outpatient/PrescriptionQuery.vue'), meta: { title: '处方查询', menuCode: 'outpatient-prescription' } },
      { path: 'outpatient/exam-applies', name: 'ExamApplies', component: () => import('@/views/outpatient/ExamApplyList.vue'), meta: { title: '医技申请', menuCode: 'outpatient-examapply' } },
      { path: 'outpatient/charges', name: 'Charges', component: () => import('@/views/outpatient/ChargeList.vue'), meta: { title: '门诊收费', menuCode: 'outpatient-charge' } },
      { path: 'outpatient/dispenses', name: 'Dispenses', component: () => import('@/views/outpatient/DispenseList.vue'), meta: { title: '处方发药', menuCode: 'outpatient-dispense' } },
      { path: 'outpatient/reports', name: 'Reports', component: () => import('@/views/outpatient/ReportList.vue'), meta: { title: '医技报告', menuCode: 'outpatient-report' } },
      { path: 'inpatient/admissions', name: 'Admissions', component: () => import('@/views/inpatient/AdmissionList.vue'), meta: { title: '入院登记', menuCode: 'inpatient-admission' } },
      { path: 'inpatient/orders', name: 'Orders', component: () => import('@/views/inpatient/OrderList.vue'), meta: { title: '住院医嘱', menuCode: 'inpatient-order' } },
      { path: 'inpatient/settlements', name: 'Settlements', component: () => import('@/views/inpatient/SettlementList.vue'), meta: { title: '出院结算', menuCode: 'inpatient-settlement' } },
      { path: 'system/roles', name: 'Roles', component: () => import('@/views/system/RoleList.vue'), meta: { title: '用户角色', menuCode: 'system-role' } },
      { path: 'system/menus', name: 'MenuPerm', component: () => import('@/views/system/MenuPerm.vue'), meta: { title: '菜单权限', menuCode: 'system-menu' } },
      { path: 'system/logs', name: 'OpLogs', component: () => import('@/views/system/OpLogList.vue'), meta: { title: '操作日志', menuCode: 'system-log' } },
      { path: 'system/audit', name: 'AuditCenter', component: () => import('@/views/system/AuditCenter.vue'), meta: { title: '审计中心', menuCode: 'system-audit' } },
      { path: 'system/reset', name: 'DataReset', component: () => import('@/views/system/DataReset.vue'), meta: { title: '演示数据重置', menuCode: 'system-reset' } },
      { path: 'ai/assistant', name: 'AiAssistant', component: () => import('@/views/ai/Assistant.vue'), meta: { title: 'Ask Astra 助手', menuCode: 'ai-assistant' } },
      { path: 'ai/reports', name: 'AiReports', component: () => import('@/views/ai/Reports.vue'), meta: { title: '智能报表', menuCode: 'ai-report' } },
      { path: 'ai/anomaly', name: 'AiAnomaly', component: () => import('@/views/ai/Anomaly.vue'), meta: { title: '运营异常分析', menuCode: 'ai-anomaly' } },
      { path: 'ai/forecast', name: 'AiForecast', component: () => import('@/views/ai/Forecast.vue'), meta: { title: '预测分析', menuCode: 'ai-forecast' } },
      { path: 'ai/center', name: 'AiCenter', component: () => import('@/views/system/AiCenter.vue'), meta: { title: 'AI 治理中心', menuCode: 'ai-center' } }
    ]
  },
  { path: '/403', name: 'Forbidden', component: () => import('@/views/error/403.vue'), meta: { title: '无权限', noTab: true } },
  { path: '/404', name: 'NotFound', component: () => import('@/views/error/404.vue'), meta: { title: '404', noTab: true } },
  { path: '*', redirect: '/404' }
]

const router = new VueRouter({
  mode: 'hash',
  base: process.env.BASE_URL,
  routes,
  scrollBehavior: () => ({ x: 0, y: 0 })
})

const flat = flattenMenus()

router.beforeEach(async (to, from, next) => {
  const token = getToken()
  document.title = (to.meta && to.meta.title ? to.meta.title + ' - ' : '') + '医院管理系统'
  if (!token && to.path !== '/login') {
    next(`/login?redirect=${encodeURIComponent(to.fullPath)}`)
    return
  }
  if (token && to.path === '/login') {
    next('/')
    return
  }
  if (to.path.startsWith('/login')) {
    next()
    return
  }
  // B1：刷新后按 token 复原员工/角色（身份持久化）
  if (token && !store.state.user.staff) {
    try {
      await store.dispatch('user/restore')
    } catch (e) {
      /* 复原失败不阻断导航 */
    }
  }
  // B2：路由级权限校验（演示级 RBAC）
  const menuCode = to.meta && to.meta.menuCode
  if (menuCode) {
    const staff = store.state.user.staff
    if (!staff || !hasMenu(staff, menuCode)) {
      next('/403')
      return
    }
  }
  // 添加标签页
  const menu = flat.find((m) => m.path === to.path)
  if (menu) {
    store.commit('tabs/ADD_VIEW', {
      path: to.path,
      title: to.meta.title || menu.title,
      affix: !!to.meta.affix
    })
  } else if (to.meta && to.meta.title && !to.meta.noTab) {
    store.commit('tabs/ADD_VIEW', { path: to.path, title: to.meta.title, affix: false })
  }
  next()
})

export default router
