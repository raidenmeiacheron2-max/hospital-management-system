import Vue from 'vue'
import VueRouter from 'vue-router'
import store from '@/store'
import { getToken } from '@/utils/auth'
import { flattenMenus } from '@/config/menu'

Vue.use(VueRouter)

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/login/index.vue'),
    meta: { title: '登录' }
  },
  {
    path: '/',
    component: () => import('@/layout/index.vue'),
    redirect: '/dashboard',
    children: [
      { path: 'dashboard', name: 'Dashboard', component: () => import('@/views/dashboard/index.vue'), meta: { title: '首页', affix: true } },
      { path: 'basic/departments', name: 'Departments', component: () => import('@/views/basic/DepartmentList.vue'), meta: { title: '科室管理' } },
      { path: 'basic/staff', name: 'Staff', component: () => import('@/views/basic/StaffList.vue'), meta: { title: '员工管理' } },
      { path: 'basic/wards', name: 'Wards', component: () => import('@/views/basic/WardList.vue'), meta: { title: '病区管理' } },
      { path: 'basic/beds', name: 'Beds', component: () => import('@/views/basic/BedList.vue'), meta: { title: '床位管理' } },
      { path: 'basic/fee-items', name: 'FeeItems', component: () => import('@/views/basic/FeeItemList.vue'), meta: { title: '收费项目' } },
      { path: 'basic/medicines', name: 'Medicines', component: () => import('@/views/basic/MedicineList.vue'), meta: { title: '药品目录' } },
      { path: 'basic/exam-items', name: 'ExamItems', component: () => import('@/views/basic/ExamItemList.vue'), meta: { title: '检验检查项目' } },
      { path: 'basic/stocks', name: 'Stocks', component: () => import('@/views/basic/StockList.vue'), meta: { title: '批次库存' } },
      { path: 'patients', name: 'Patients', component: () => import('@/views/patients/PatientList.vue'), meta: { title: '患者档案' } },
      { path: 'outpatient/schedules', name: 'Schedules', component: () => import('@/views/outpatient/ScheduleList.vue'), meta: { title: '医生排班' } },
      { path: 'outpatient/registrations', name: 'Registrations', component: () => import('@/views/outpatient/RegistrationList.vue'), meta: { title: '门诊挂号' } },
      { path: 'outpatient/visits', name: 'Visits', component: () => import('@/views/outpatient/VisitList.vue'), meta: { title: '门诊接诊' } },
      { path: 'outpatient/prescriptions', name: 'Prescriptions', component: () => import('@/views/outpatient/PrescriptionQuery.vue'), meta: { title: '处方查询' } },
      { path: 'outpatient/exam-applies', name: 'ExamApplies', component: () => import('@/views/outpatient/ExamApplyList.vue'), meta: { title: '医技申请' } },
      { path: 'outpatient/charges', name: 'Charges', component: () => import('@/views/outpatient/ChargeList.vue'), meta: { title: '门诊收费' } },
      { path: 'outpatient/dispenses', name: 'Dispenses', component: () => import('@/views/outpatient/DispenseList.vue'), meta: { title: '处方发药' } },
      { path: 'outpatient/reports', name: 'Reports', component: () => import('@/views/outpatient/ReportList.vue'), meta: { title: '医技报告' } },
      { path: 'inpatient/admissions', name: 'Admissions', component: () => import('@/views/inpatient/AdmissionList.vue'), meta: { title: '入院登记' } },
      { path: 'inpatient/orders', name: 'Orders', component: () => import('@/views/inpatient/OrderList.vue'), meta: { title: '住院医嘱' } },
      { path: 'inpatient/settlements', name: 'Settlements', component: () => import('@/views/inpatient/SettlementList.vue'), meta: { title: '出院结算' } },
      { path: 'system/roles', name: 'Roles', component: () => import('@/views/system/RoleList.vue'), meta: { title: '用户角色' } },
      { path: 'system/menus', name: 'MenuPerm', component: () => import('@/views/system/MenuPerm.vue'), meta: { title: '菜单权限' } },
      { path: 'system/logs', name: 'OpLogs', component: () => import('@/views/system/OpLogList.vue'), meta: { title: '操作日志' } },
      { path: 'system/reset', name: 'DataReset', component: () => import('@/views/system/DataReset.vue'), meta: { title: '演示数据重置' } }
    ]
  },
  { path: '/404', name: 'NotFound', component: () => import('@/views/error/404.vue'), meta: { title: '404' } },
  { path: '*', redirect: '/404' }
]

const router = new VueRouter({
  mode: 'hash',
  base: process.env.BASE_URL,
  routes,
  scrollBehavior: () => ({ x: 0, y: 0 })
})

const flat = flattenMenus()

router.beforeEach((to, from, next) => {
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
  // 添加标签页
  const menu = flat.find((m) => m.path === to.path)
  if (menu) {
    store.commit('tabs/ADD_VIEW', {
      path: to.path,
      title: to.meta.title || menu.title,
      affix: !!to.meta.affix
    })
  }
  next()
})

export default router
