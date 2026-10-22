// ===== 侧栏菜单配置（与路由、标签页、面包屑共用）=====
export const menuTree = [
  { code: 'home', title: '首页', path: '/dashboard', icon: 'el-icon-s-home', affix: true },
  {
    code: 'basic',
    title: '基础资料',
    icon: 'el-icon-office-building',
    children: [
      { code: 'basic-dept', title: '科室管理', path: '/basic/departments', icon: 'el-icon-school' },
      { code: 'basic-staff', title: '员工管理', path: '/basic/staff', icon: 'el-icon-user' },
      { code: 'basic-ward', title: '病区管理', path: '/basic/wards', icon: 'el-icon-s-grid' },
      { code: 'basic-bed', title: '床位管理', path: '/basic/beds', icon: 'el-icon-s-home' },
      { code: 'basic-fee', title: '收费项目', path: '/basic/fee-items', icon: 'el-icon-money' },
      { code: 'basic-medicine', title: '药品目录', path: '/basic/medicines', icon: 'el-icon-first-aid-kit' },
      { code: 'basic-exam', title: '检验检查项目', path: '/basic/exam-items', icon: 'el-icon-view' },
      { code: 'basic-stock', title: '批次库存', path: '/basic/stocks', icon: 'el-icon-box' }
    ]
  },
  {
    code: 'patient',
    title: '患者服务',
    icon: 'el-icon-s-custom',
    children: [{ code: 'patient-list', title: '患者档案', path: '/patients', icon: 'el-icon-notebook-2' }]
  },
  {
    code: 'outpatient',
    title: '门诊管理',
    icon: 'el-icon-s-order',
    children: [
      { code: 'outpatient-schedule', title: '医生排班', path: '/outpatient/schedules', icon: 'el-icon-date' },
      { code: 'outpatient-registration', title: '门诊挂号', path: '/outpatient/registrations', icon: 'el-icon-tickets' },
      { code: 'outpatient-visit', title: '门诊接诊', path: '/outpatient/visits', icon: 'el-icon-s-check' },
      { code: 'outpatient-prescription', title: '处方查询', path: '/outpatient/prescriptions', icon: 'el-icon-document' },
      { code: 'outpatient-examapply', title: '医技申请', path: '/outpatient/exam-applies', icon: 'el-icon-s-data' },
      { code: 'outpatient-charge', title: '门诊收费', path: '/outpatient/charges', icon: 'el-icon-bank-card' },
      { code: 'outpatient-dispense', title: '处方发药', path: '/outpatient/dispenses', icon: 'el-icon-medicine' },
      { code: 'outpatient-report', title: '医技报告', path: '/outpatient/reports', icon: 'el-icon-document-checked' }
    ]
  },
  {
    code: 'inpatient',
    title: '住院管理',
    icon: 'el-icon-s-marketing',
    children: [
      { code: 'inpatient-admission', title: '入院登记', path: '/inpatient/admissions', icon: 'el-icon-plus' },
      { code: 'inpatient-order', title: '住院医嘱', path: '/inpatient/orders', icon: 'el-icon-s-operation' },
      { code: 'inpatient-settlement', title: '出院结算', path: '/inpatient/settlements', icon: 'el-icon-s-finance' }
    ]
  },
  {
    code: 'system',
    title: '系统管理',
    icon: 'el-icon-setting',
    children: [
      { code: 'system-role', title: '用户角色', path: '/system/roles', icon: 'el-icon-s-custom' },
      { code: 'system-menu', title: '菜单权限', path: '/system/menus', icon: 'el-icon-menu' },
      { code: 'system-log', title: '操作日志', path: '/system/logs', icon: 'el-icon-document-copy' },
      { code: 'system-reset', title: '演示数据重置', path: '/system/reset', icon: 'el-icon-refresh-left' }
    ]
  }
]

export function flattenMenus() {
  const out = []
  menuTree.forEach((g) => {
    if (g.children) {
      g.children.forEach((c) => out.push({ group: g.title, ...c }))
    } else {
      out.push({ group: '', ...g })
    }
  })
  return out
}
