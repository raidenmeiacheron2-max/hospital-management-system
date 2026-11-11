// =====================================================================
// 只读数据选择器（B3）
// - 仅调用 db 的只读函数（all/find/query/stats/...），返回深拷贝，AI 无法修改业务数据
// - 统一剔除敏感字段（password/token/phone 等）
// - 金额保持整数分（展示层再转元），日期统一 'YYYY-MM-DD'
// - 聚合口径集中在此，B4/B5 任务复用，保证"AI 数值与 db/stats() 一致"
// =====================================================================
const db = require('../mock/db')
const guardrails = require('./guardrails')

function clone(v) {
  try {
    return JSON.parse(JSON.stringify(v))
  } catch (e) {
    return v
  }
}

function list(name) {
  return guardrails.stripSensitive(clone(db.all(name)) || [])
}

function find(name, id) {
  return guardrails.stripSensitive(clone(db.find(name, id)) || null)
}

function byIdMap(name) {
  return guardrails.stripSensitive(clone(db.byIdMap(name)) || {})
}

function demoToday() {
  return db.demoToday()
}

function stats() {
  return guardrails.stripSensitive(clone(db.stats()))
}

function reminders() {
  return guardrails.stripSensitive(clone(db.reminderSummary()))
}

function rules() {
  return clone(db.REMINDER_RULES)
}

function suggestTodoPriority(input) {
  return guardrails.stripSensitive(clone(db.suggestTodoPriority(input || {})))
}

/** 当前操作人的角色与权限域（供上下文按权限收敛） */
function perm(actor) {
  const a = actor || db.getCurrentActor() || {}
  const staff = a.id ? db.find('staff', a.id) : null
  const p = staff ? db.permissionsOf(staff) : { roleCode: '', menuCodes: [] }
  const domains = {}
  ;['home', 'basic', 'patient', 'outpatient', 'inpatient', 'system', 'ai'].forEach(function (d) {
    domains[d] = staff ? !!db.canDomain(a, d) : false
  })
  return {
    staffId: a.id || '',
    staffName: (staff && staff.name) || a.name || '',
    roleName: (staff && staff.role) || a.role || '',
    roleCode: p.roleCode || '',
    menuCodes: (p.menuCodes || []).slice(),
    domains: domains
  }
}

function canDomain(actor, domain) {
  const a = actor || db.getCurrentActor()
  if (!a || !a.id) return false
  return !!db.canDomain(a, domain)
}

// ---------- 业务队列（只读） ----------
function lowStockMedicines() {
  const threshold = db.REMINDER_RULES.LOW_STOCK
  return list('medicines').filter(function (m) {
    return m.status === 1 && Number(m.stock) < threshold
  })
}

function expiringStocks() {
  const today = demoToday()
  const limit = db.REMINDER_RULES.STOCK_EXPIRY_DAYS
  return list('stocks').map(function (st) {
    const d = Math.round((new Date(st.expiry + 'T00:00:00') - new Date(today + 'T00:00:00')) / 86400000)
    return Object.assign({}, st, { daysLeft: d })
  }).filter(function (st) {
    return st.daysLeft >= 0 && st.daysLeft <= limit
  })
}

function pendingVisits(kind) {
  const visits = list('visits')
  if (kind === 'report') return visits.filter(function (v) { return (v.exams || []).length > 0 && v.reportStatus !== '已出报告' })
  if (kind === 'charge') return visits.filter(function (v) { return v.chargeStatus === '未收费' && ((v.prescriptions || []).length + (v.exams || []).length) > 0 })
  if (kind === 'dispense') return visits.filter(function (v) { return v.chargeStatus === '已收费' && v.dispenseStatus === '未发药' && (v.prescriptions || []).length > 0 })
  return visits
}

function pendingOrders() {
  return list('orders').filter(function (o) { return o.status === '未执行' })
}

function pendingAdmissions() {
  return list('admissions').filter(function (a) { return a.status === '待入科' })
}

function pendingSettlements() {
  return list('admissions').filter(function (a) { return a.status === '待结算' })
}

function unpaidRegistrations() {
  return list('registrations').filter(function (r) { return r.regStatus === '待分诊' && r.payStatus === '未缴费' })
}

function disabledBeds() {
  return list('beds').filter(function (b) { return b.enabled === 0 })
}

function registrationSeries() {
  return (stats().last7days || []).slice()
}

// ---------- 聚合（报表/异常/预测复用） ----------
function nameMaps() {
  return {
    departments: byIdMap('departments'),
    staff: byIdMap('staff'),
    patients: byIdMap('patients'),
    wards: byIdMap('wards'),
    beds: byIdMap('beds'),
    medicines: byIdMap('medicines')
  }
}

function departmentName(id, maps) {
  const m = (maps && maps.departments) || byIdMap('departments')
  return (m[id] || {}).name || '未知科室'
}

/** 已缴费收入按科室拆分（挂号费按挂号科室、门诊收费按接诊科室） */
function revenueByDepartment() {
  const maps = nameMaps()
  const regMap = {}
  list('registrations').forEach(function (r) { regMap[r.id] = r })
  const visitMap = {}
  list('visits').forEach(function (v) { visitMap[v.id] = v })
  const rows = {}
  function bucket(depId) {
    if (!rows[depId]) {
      rows[depId] = { departmentId: depId, departmentName: departmentName(depId, maps), regFeeCents: 0, visitFeeCents: 0, totalCents: 0, count: 0 }
    }
    return rows[depId]
  }
  list('feeRecords').filter(function (f) { return f.status === '已缴费' }).forEach(function (f) {
    let depId = ''
    if (f.type === '挂号费') {
      const r = regMap[f.refId]
      depId = (r && r.departmentId) || ''
    } else if (f.type === '门诊收费') {
      const v = visitMap[f.refId]
      depId = (v && v.departmentId) || ''
    }
    if (!depId) return
    const b = bucket(depId)
    if (f.type === '挂号费') b.regFeeCents += f.amountCents
    else b.visitFeeCents += f.amountCents
    b.totalCents += f.amountCents
    b.count += 1
  })
  return Object.keys(rows).map(function (k) { return rows[k] }).sort(function (a, b) { return b.totalCents - a.totalCents })
}

/** 医生接诊量与门诊收入 */
function doctorWorkload() {
  const maps = nameMaps()
  const feeByVisit = {}
  list('feeRecords').filter(function (f) { return f.status === '已缴费' && f.type === '门诊收费' }).forEach(function (f) {
    feeByVisit[f.refId] = (feeByVisit[f.refId] || 0) + f.amountCents
  })
  const rows = {}
  list('visits').forEach(function (v) {
    const key = v.doctorId || ''
    if (!rows[key]) {
      rows[key] = {
        doctorId: key,
        doctorName: (maps.staff[key] || {}).name || '未知医生',
        departmentId: v.departmentId || '',
        departmentName: departmentName(v.departmentId, maps),
        visitCount: 0,
        revenueCents: 0
      }
    }
    rows[key].visitCount += 1
    rows[key].revenueCents += feeByVisit[v.id] || 0
  })
  return Object.keys(rows).map(function (k) { return rows[k] }).sort(function (a, b) { return b.visitCount - a.visitCount })
}

/** 药品消耗（处方 + 住院医嘱）与当前库存 */
function medicineConsumption() {
  const rows = {}
  function bucket(id, name, unit) {
    if (!rows[id]) rows[id] = { medicineId: id, medicineName: name || '未知药品', unit: unit || '', prescribedQty: 0, orderQty: 0, totalQty: 0, stock: 0 }
    return rows[id]
  }
  const medMap = byIdMap('medicines')
  list('visits').forEach(function (v) {
    ;(v.prescriptions || []).forEach(function (p) {
      const b = bucket(p.medicineId, p.medicineName, (medMap[p.medicineId] || {}).unit)
      b.prescribedQty += Number(p.qty) || 0
    })
  })
  list('orders').filter(function (o) { return o.type === '药品' }).forEach(function (o) {
    const b = bucket(o.refId, o.name, (medMap[o.refId] || {}).unit)
    b.orderQty += Number(o.qty) || 0
  })
  Object.keys(rows).forEach(function (id) {
    const b = rows[id]
    b.totalQty = b.prescribedQty + b.orderQty
    b.stock = Number((medMap[id] || {}).stock) || 0
  })
  return Object.keys(rows).map(function (k) { return rows[k] }).sort(function (a, b) { return b.totalQty - a.totalQty })
}

/** 床位周转与占用 */
function bedTurnover() {
  const beds = list('beds')
  const adms = list('admissions')
  const occupied = beds.filter(function (b) { return b.status === '占用' }).length
  const disabled = beds.filter(function (b) { return b.enabled === 0 }).length
  const discharged = adms.filter(function (a) { return a.status === '已出院' && a.dischargeAt })
  let totalStay = 0
  discharged.forEach(function (a) {
    const days = Math.round((new Date(a.dischargeAt.slice(0, 10) + 'T00:00:00') - new Date(String(a.admitAt).slice(0, 10) + 'T00:00:00')) / 86400000)
    totalStay += days > 0 ? days : 0
  })
  return {
    totalBeds: beds.length,
    occupied: occupied,
    idle: beds.filter(function (b) { return b.status === '空闲' && b.enabled !== 0 }).length,
    disabled: disabled,
    occupancyPct: beds.length ? Math.round((occupied / beds.length) * 100) : 0,
    admissionsTotal: adms.length,
    inWard: adms.filter(function (a) { return a.status === '在院' }).length,
    pendingAdmit: adms.filter(function (a) { return a.status === '待入科' }).length,
    pendingSettle: adms.filter(function (a) { return a.status === '待结算' }).length,
    discharged: discharged.length,
    avgStayDays: discharged.length ? Math.round((totalStay / discharged.length) * 10) / 10 : 0
  }
}

/** 最近审计事件（只读，供上下文引用） */
function recentAudit(limit) {
  const r = db.queryAudit({ page: 1, size: limit || 10 })
  return guardrails.stripSensitive(clone(r.list || []))
}

module.exports = {
  // 基础
  demoToday,
  stats,
  reminders,
  rules,
  perm,
  canDomain,
  all: list,
  list: list,
  find,
  byIdMap,
  suggestTodoPriority,
  recentAudit,
  // 队列
  lowStockMedicines,
  expiringStocks,
  pendingVisits,
  pendingOrders,
  pendingAdmissions,
  pendingSettlements,
  unpaidRegistrations,
  disabledBeds,
  registrationSeries,
  // 聚合
  nameMaps,
  departmentName,
  revenueByDepartment,
  doctorWorkload,
  medicineConsumption,
  bedTurnover
}
