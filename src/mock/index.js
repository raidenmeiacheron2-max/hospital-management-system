// =====================================================================
// Mock.js 拦截层：把 HTTP 请求路由到统一数据层 db.js
// - 模拟网络延迟；所有变更由 db 校验成功后才持久化
// - 请求头 x-mock-fail: 1 时模拟服务失败（不落库），用于验证失败安全
// =====================================================================
import Mock from 'mockjs'
import db from './db'
import aiService from '@/ai'
import { centsToYuan } from '@/utils/money'

Mock.setup({ timeout: '80-260' })

const wrap = (data) => ({ code: 200, msg: 'success', data })
const wrapErr = (msg) => ({ code: 500, msg: msg || '操作失败' })

function parseQuery(url) {
  const q = {}
  const idx = url.indexOf('?')
  if (idx === -1) return q
  url
    .slice(idx + 1)
    .split('&')
    .forEach((pair) => {
      if (!pair) return
      const [k, v] = pair.split('=')
      q[decodeURIComponent(k)] = decodeURIComponent(v || '')
    })
  return q
}

function run(options, fn) {
  if (options && options.headers && options.headers['x-mock-fail'] === '1') {
    return wrapErr('模拟网络错误（x-mock-fail）')
  }
  const r = fn()
  if (r && r.ok) return wrap(r.data)
  return wrapErr(r && r.error)
}

function idOf(options, url, method) {
  const m = url.match(/\/([^/?]+)$/)
  return m ? m[1] : ''
}

// ---------- 关联名称 ----------
const maps = {}
function refreshMaps() {
  maps.departments = db.byIdMap('departments')
  maps.wards = db.byIdMap('wards')
  maps.beds = db.byIdMap('beds')
  maps.staff = db.byIdMap('staff')
  maps.patients = db.byIdMap('patients')
  maps.medicines = db.byIdMap('medicines')
  maps.examItems = db.byIdMap('examItems')
  maps.feeItems = db.byIdMap('feeItems')
}

function enrichStaff(row) {
  return Object.assign({}, row, {
    departmentName: (maps.departments[row.departmentId] || {}).name || '—'
  })
}

function enrichBed(row) {
  const ward = maps.wards[row.wardId] || {}
  return Object.assign({}, row, {
    wardName: ward.name || '—',
    departmentName: (maps.departments[ward.departmentId] || {}).name || '—'
  })
}

function enrichWard(row) {
  return Object.assign({}, row, {
    departmentName: (maps.departments[row.departmentId] || {}).name || '—',
    bedCount: db.all('beds').filter((b) => b.wardId === row.id).length
  })
}

function enrichRegistration(row) {
  const patient = maps.patients[row.patientId] || {}
  return Object.assign({}, row, {
    patientName: patient.name || '—',
    patientPhone: patient.phone || '—',
    patientGender: patient.gender || '—',
    departmentName: (maps.departments[row.departmentId] || {}).name || '—',
    doctorName: (maps.staff[row.doctorId] || {}).name || '—',
    feeYuan: centsToYuan(row.feeCents)
  })
}

function enrichVisit(row) {
  const patient = maps.patients[row.patientId] || {}
  const reg = db.all('registrations').find((x) => x.id === row.regId) || {}
  return Object.assign({}, row, {
    patientName: patient.name || '—',
    patientGender: patient.gender || '—',
    regCode: reg.code || '—',
    doctorName: (maps.staff[row.doctorId] || {}).name || '—',
    departmentName: (maps.departments[row.departmentId] || {}).name || '—',
    prescriptionAmountCents: (row.prescriptions || []).reduce((a, x) => a + x.amountCents, 0),
    examAmountCents: (row.exams || []).reduce((a, x) => a + x.amountCents, 0),
    totalAmountCents: (row.prescriptions || []).concat(row.exams || []).reduce((a, x) => a + x.amountCents, 0)
  })
}

function enrichAdmission(row) {
  const patient = maps.patients[row.patientId] || {}
  const bed = maps.beds[row.bedId] || {}
  return Object.assign({}, row, {
    patientName: patient.name || '—',
    patientGender: patient.gender || '—',
    patientPhone: patient.phone || '—',
    wardName: (maps.wards[row.wardId] || {}).name || '—',
    bedCode: bed.code || '—',
    departmentName: (maps.departments[row.departmentId] || {}).name || '—',
    doctorName: (maps.staff[row.doctorId] || {}).name || '—',
    depositYuan: centsToYuan(row.depositCents)
  })
}

function enrichStock(row) {
  const med = maps.medicines[row.medicineId] || {}
  return Object.assign({}, row, {
    medicineName: med.name || '—',
    medicineCode: med.code || '—',
    unit: med.unit || ''
  })
}

function enrichOrder(row) {
  return Object.assign({}, row, { amountCents: row.qty * row.priceCents })
}

function withPaging(result) {
  return { list: result.list, total: result.total }
}

const base = (process.env.VUE_APP_BASE_API || '/api').replace(/\/$/, '')

// ===== B2：演示级 API 权限校验（Mock 层）=====
// 说明：角色来自当前登录会话（token→员工→角色），不读取客户端传入的 role 参数，
// 因此不能通过修改前端参数获得更高权限。纯前端 Mock，仅演示，不构成真实后端安全隔离。
function domainOf(path) {
  if (/\/auth\//.test(path)) return null
  if (/\/(dashboard|workbench|todos|reminders|audit-events|timeline)(\/|$)/.test(path)) return 'home'
  if (/\/(ai)(\/|$)/.test(path)) return 'home'
  if (/\/(staff|departments|wards|beds|medicines|exam-items|fee-items|stocks)(\/|$)/.test(path)) return 'basic'
  if (/\/patients(\/|$)/.test(path)) return 'patient'
  if (/\/(schedules|registrations|visits|fee-records)(\/|$)/.test(path)) return 'outpatient'
  if (/\/(admissions|orders|settlements)(\/|$)/.test(path)) return 'inpatient'
  if (/\/(logs|roles|menus|system)(\/|$)/.test(path)) return 'system'
  if (/\/options(\/|$)/.test(path)) return 'home'
  return null
}

function apiGuard(options) {
  const url = (options && options.url) || ''
  const path = url.replace(/\?.*$/, '')
  const domain = domainOf(path)
  if (!domain) return null
  let actor = db.getCurrentActor()
  if (!actor || !actor.id) {
    try {
      if (typeof localStorage !== 'undefined') {
        const t = localStorage.getItem('astra_hospital_token')
        if (t) {
          db.setActorByToken(t)
          actor = db.getCurrentActor()
        }
      }
    } catch (e) {
      /* noop */
    }
  }
  if (!actor || !actor.id) return { code: 401, msg: '未登录或登录状态已失效（演示级 RBAC）' }
  if (domain === 'home') return null
  if (!db.canDomain(actor, domain)) return { code: 403, msg: '当前角色无权限访问该接口（演示级 RBAC）' }
  return null
}

const rawMock = Mock.mock.bind(Mock)
function guardedMock(re, method, handler) {
  return rawMock(re, method, function (options) {
    const deny = apiGuard(options)
    if (deny) return deny
    return handler(options)
  })
}

function registerMock() {
  db.load()
  refreshMaps()

  // ---------- 认证 ----------
  guardedMock(new RegExp(`^${base}/auth/login$`), 'post', (options) =>
    run(options, () => {
      const body = JSON.parse(options.body || '{}')
      return db.login(body.account, body.password)
    })
  )
  guardedMock(new RegExp(`^${base}/auth/logout$`), 'post', () => wrap({}))

  // ---------- 身份（按 token 复原员工/角色，刷新不丢失）----------
  // 说明：本 Mock.js 的 options 不含 headers，故 token 通过查询参数传递（仅演示）
  guardedMock(new RegExp(`^${base}/auth/profile(\\?.*)?$`), 'get', (options) => {
    const q = parseQuery(options.url)
    const token = q.token || ''
    if (token) db.setActorByToken(token)
    const p = db.profileOf(token)
    if (p) return wrap(p)
    return wrapErr('登录状态无效')
  })

  // ---------- 分角色工作台（B2，只读聚合）----------
  guardedMock(new RegExp(`^${base}/workbench/summary$`), 'get', () => wrap(db.workbenchSummary(db.getCurrentActor())))

  // ---------- 患者 360° 时间线（B2，只读聚合）----------
  guardedMock(new RegExp(`^${base}/timeline/patient/[^/?]+$`), 'get', (options) => run(options, () => db.patientTimeline(idOf(options, options.url))))

  // ---------- 首页 ----------
  guardedMock(new RegExp(`^${base}/dashboard/stats$`), 'get', () => wrap(db.stats()))

  // ---------- 员工 ----------
  guardedMock(new RegExp(`^${base}/staff(\\?.*)?$`), 'get', (options) => {
    refreshMaps()
    const q = parseQuery(options.url)
    const filters = {}
    if (q.name) filters.name = q.name
    if (q.loginAccount) filters.loginAccount = q.loginAccount
    if (q.type) filters.type = q.type
    if (q.departmentId) filters.departmentId = q.departmentId
    if (q.enabled === '1') filters.enabled = { eq: true }
    if (q.enabled === '0') filters.enabled = { eq: false }
    const r = db.query('staff', { filters, page: q.page, size: q.size, sortBy: 'code', sortOrder: 'asc' })
    return { total: r.total, list: r.list.map(enrichStaff) }
  })
  guardedMock(new RegExp(`^${base}/staff(\\?.*)?$`), 'post', (options) =>
    run(options, () => {
      refreshMaps()
      return db.createStaff(JSON.parse(options.body || '{}'))
    })
  )
  guardedMock(new RegExp(`^${base}/staff/[^/?]+/enabled$`), 'put', (options) =>
    run(options, () => db.setStaffEnabled(idOf(options, options.url.replace(/\/enabled$/, '')), JSON.parse(options.body || '{}').enabled))
  )
  guardedMock(new RegExp(`^${base}/staff/[^/?]+/password$`), 'put', (options) =>
    run(options, () => db.resetStaffPassword(idOf(options, options.url.replace(/\/password$/, ''))))
  )
  guardedMock(new RegExp(`^${base}/staff/[^/?]+$`), 'put', (options) =>
    run(options, () => db.updateStaff(idOf(options, options.url), JSON.parse(options.body || '{}')))
  )
  guardedMock(new RegExp(`^${base}/staff/[^/?]+$`), 'delete', (options) =>
    run(options, () => db.deleteStaff(idOf(options, options.url)))
  )

  // ---------- 科室 ----------
  guardedMock(new RegExp(`^${base}/departments(\\?.*)?$`), 'get', (options) => {
    const q = parseQuery(options.url)
    const filters = {}
    if (q.name) filters.name = q.name
    if (q.code) filters.code = q.code
    if (q.status === '1' || q.status === '0') filters.status = { eq: Number(q.status) }
    const r = db.query('departments', { filters, page: q.page, size: q.size, sortBy: 'code', sortOrder: 'asc' })
    return withPaging(r)
  })
  guardedMock(new RegExp(`^${base}/departments(\\?.*)?$`), 'post', (options) =>
    run(options, () => db.createDepartment(JSON.parse(options.body || '{}')))
  )
  guardedMock(new RegExp(`^${base}/departments/[^/?]+$`), 'put', (options) =>
    run(options, () => db.updateDepartment(idOf(options, options.url), JSON.parse(options.body || '{}')))
  )
  guardedMock(new RegExp(`^${base}/departments/[^/?]+$`), 'delete', (options) =>
    run(options, () => db.deleteDepartment(idOf(options, options.url)))
  )

  // ---------- 病区 ----------
  guardedMock(new RegExp(`^${base}/wards(\\?.*)?$`), 'get', (options) => {
    refreshMaps()
    const q = parseQuery(options.url)
    const filters = {}
    if (q.name) filters.name = q.name
    if (q.departmentId) filters.departmentId = q.departmentId
    const r = db.query('wards', { filters, page: q.page, size: q.size, sortBy: 'code', sortOrder: 'asc' })
    return { total: r.total, list: r.list.map(enrichWard) }
  })
  guardedMock(new RegExp(`^${base}/wards(\\?.*)?$`), 'post', (options) =>
    run(options, () => db.createWard(JSON.parse(options.body || '{}')))
  )
  guardedMock(new RegExp(`^${base}/wards/[^/?]+$`), 'put', (options) =>
    run(options, () => db.updateWard(idOf(options, options.url), JSON.parse(options.body || '{}')))
  )
  guardedMock(new RegExp(`^${base}/wards/[^/?]+$`), 'delete', (options) =>
    run(options, () => db.deleteWard(idOf(options, options.url)))
  )

  // ---------- 床位 ----------
  guardedMock(new RegExp(`^${base}/beds(\\?.*)?$`), 'get', (options) => {
    refreshMaps()
    const q = parseQuery(options.url)
    const filters = {}
    if (q.wardId) filters.wardId = q.wardId
    if (q.code) filters.code = q.code
    if (q.type) filters.type = q.type
    if (q.status) filters.status = q.status
    if (q.enabled === '1' || q.enabled === '0') filters.enabled = { eq: Number(q.enabled) }
    const r = db.query('beds', { filters, page: q.page, size: q.size, sortBy: 'code', sortOrder: 'asc' })
    return { total: r.total, list: r.list.map(enrichBed) }
  })
  guardedMock(new RegExp(`^${base}/beds(\\?.*)?$`), 'post', (options) =>
    run(options, () => db.createBed(JSON.parse(options.body || '{}')))
  )
  guardedMock(new RegExp(`^${base}/beds/[^/?]+$`), 'put', (options) =>
    run(options, () => db.updateBed(idOf(options, options.url), JSON.parse(options.body || '{}')))
  )
  guardedMock(new RegExp(`^${base}/beds/[^/?]+$`), 'delete', (options) =>
    run(options, () => db.deleteBed(idOf(options, options.url)))
  )

  // ---------- 患者 ----------
  guardedMock(new RegExp(`^${base}/patients(\\?.*)?$`), 'get', (options) => {
    const q = parseQuery(options.url)
    const filters = {}
    if (q.code) filters.code = q.code
    if (q.name) filters.name = q.name
    if (q.phone) filters.phone = q.phone
    if (q.gender) filters.gender = q.gender
    const r = db.query('patients', { filters, page: q.page, size: q.size, sortBy: 'code', sortOrder: 'desc' })
    return withPaging(r)
  })
  guardedMock(new RegExp(`^${base}/patients(\\?.*)?$`), 'post', (options) =>
    run(options, () => db.createPatient(JSON.parse(options.body || '{}')))
  )
  guardedMock(new RegExp(`^${base}/patients/[^/?]+$`), 'put', (options) =>
    run(options, () => db.updatePatient(idOf(options, options.url), JSON.parse(options.body || '{}')))
  )
  guardedMock(new RegExp(`^${base}/patients/[^/?]+$`), 'delete', (options) =>
    run(options, () => db.deletePatient(idOf(options, options.url)))
  )

  // ---------- 排班 ----------
  guardedMock(new RegExp(`^${base}/schedules(\\?.*)?$`), 'get', (options) => {
    refreshMaps()
    const q = parseQuery(options.url)
    const filters = {}
    if (q.start) filters.date = { gte: q.start }
    if (q.end) filters.date = { lte: q.end }
    if (q.departmentId) filters.departmentId = q.departmentId
    if (q.doctorId) filters.doctorId = q.doctorId
    if (q.period) filters.period = q.period
    if (q.date) filters.date = { eq: q.date }
    const r = db.query('schedules', { filters, page: q.page, size: q.size || 10000, sortBy: 'date', sortOrder: 'asc' })
    return {
      total: r.total,
      list: r.list.map((row) =>
        Object.assign({}, row, {
          doctorName: (maps.staff[row.doctorId] || {}).name || '—',
          departmentName: (maps.departments[row.departmentId] || {}).name || '—',
          regCount: db
            .all('registrations')
            .filter((x) => x.doctorId === row.doctorId && x.date === row.date && x.period === row.period && x.regStatus !== '已退号').length
        })
      )
    }
  })
  guardedMock(new RegExp(`^${base}/schedules(\\?.*)?$`), 'post', (options) =>
    run(options, () => db.createSchedule(JSON.parse(options.body || '{}')))
  )
  guardedMock(new RegExp(`^${base}/schedules/[^/?]+$`), 'put', (options) =>
    run(options, () => db.updateSchedule(idOf(options, options.url), JSON.parse(options.body || '{}')))
  )
  guardedMock(new RegExp(`^${base}/schedules/[^/?]+$`), 'delete', (options) =>
    run(options, () => db.deleteSchedule(idOf(options, options.url)))
  )

  // ---------- 挂号 ----------
  guardedMock(new RegExp(`^${base}/registrations(\\?.*)?$`), 'get', (options) => {
    refreshMaps()
    const q = parseQuery(options.url)
    const filters = {}
    if (q.code) filters.code = q.code
    if (q.departmentId) filters.departmentId = q.departmentId
    if (q.doctorId) filters.doctorId = q.doctorId
    if (q.date) filters.date = { eq: q.date }
    if (q.period) filters.period = q.period
    if (q.regStatus) filters.regStatus = q.regStatus
    if (q.payStatus) filters.payStatus = q.payStatus
    if (q.patientName) filters.patientName = { fn: (row) => String((maps.patients[row.patientId] || {}).name || '').indexOf(q.patientName) !== -1 }
    const r = db.query('registrations', { filters, page: q.page, size: q.size, sortBy: 'code', sortOrder: 'desc' })
    return { total: r.total, list: r.list.map(enrichRegistration) }
  })
  guardedMock(new RegExp(`^${base}/registrations(\\?.*)?$`), 'post', (options) =>
    run(options, () => db.createRegistration(JSON.parse(options.body || '{}')))
  )
  guardedMock(new RegExp(`^${base}/registrations/[^/?]+/refund$`), 'put', (options) =>
    run(options, () => db.refundRegistration(idOf(options, options.url.replace(/\/refund$/, ''))))
  )

  // ---------- 接诊 ----------
  guardedMock(new RegExp(`^${base}/visits(\\?.*)?$`), 'get', (options) => {
    refreshMaps()
    const q = parseQuery(options.url)
    const filters = {}
    if (q.code) filters.code = q.code
    if (q.visitStatus) filters.visitStatus = q.visitStatus
    if (q.chargeStatus) filters.chargeStatus = q.chargeStatus
    if (q.reportStatus) filters.reportStatus = q.reportStatus
    // 仅返回存在医技项目的接诊（在分页前过滤，供「医技申请/报告」列表使用）
    if (q.hasExams === '1') filters.hasExams = { fn: (row) => (row.exams || []).length > 0 }
    if (q.patientName) filters.patientName = { fn: (row) => String((maps.patients[row.patientId] || {}).name || '').indexOf(q.patientName) !== -1 }
    const r = db.query('visits', { filters, page: q.page, size: q.size, sortBy: 'code', sortOrder: 'desc' })
    return { total: r.total, list: r.list.map(enrichVisit) }
  })
  guardedMock(new RegExp(`^${base}/visits(\\?.*)?$`), 'post', (options) =>
    run(options, () => db.createVisit(JSON.parse(options.body || '{}')))
  )
  guardedMock(new RegExp(`^${base}/visits/[^/?]+/charge$`), 'put', (options) =>
    run(options, () => db.chargeVisit(idOf(options, options.url.replace(/\/charge$/, ''))))
  )
  guardedMock(new RegExp(`^${base}/visits/[^/?]+/dispense$`), 'put', (options) =>
    run(options, () => db.dispenseVisit(idOf(options, options.url.replace(/\/dispense$/, ''))))
  )
  guardedMock(new RegExp(`^${base}/visits/[^/?]+/report$`), 'post', (options) =>
    run(options, () => {
      const body = JSON.parse(options.body || '{}')
      return db.createReport(idOf(options, options.url.replace(/\/report$/, '')), body.examItemId, body.content)
    })
  )
  guardedMock(new RegExp(`^${base}/visits/[^/?]+$`), 'put', (options) =>
    run(options, () => db.updateVisit(idOf(options, options.url), JSON.parse(options.body || '{}')))
  )

  // ---------- 药品 / 医技 / 收费项目 / 批次库存 ----------
  const simpleCrud = (name, filtersFn, enrichFn) => {
    guardedMock(new RegExp(`^${base}/${name}(\\?.*)?$`), 'get', (options) => {
      const q = parseQuery(options.url)
      const filters = filtersFn(q)
      const r = db.query(name === 'exam-items' ? 'examItems' : name === 'fee-items' ? 'feeItems' : name, { filters, page: q.page, size: q.size, sortBy: 'code', sortOrder: 'asc' })
      return { total: r.total, list: enrichFn ? r.list.map(enrichFn) : r.list }
    })
  }
  simpleCrud('medicines', (q) => {
    const f = {}
    if (q.name) f.name = q.name
    if (q.code) f.code = q.code
    if (q.status === '1' || q.status === '0') f.status = { eq: Number(q.status) }
    return f
  })
  simpleCrud('exam-items', (q) => {
    const f = {}
    if (q.name) f.name = q.name
    if (q.code) f.code = q.code
    if (q.category) f.category = q.category
    return f
  })
  simpleCrud('fee-items', (q) => {
    const f = {}
    if (q.name) f.name = q.name
    if (q.code) f.code = q.code
    if (q.category) f.category = q.category
    return f
  })
  simpleCrud('stocks', (q) => {
    const f = {}
    if (q.batchNo) f.batchNo = q.batchNo
    if (q.medicineId) f.medicineId = q.medicineId
    return f
  }, enrichStock)

  const medicineCrud = (url, dispatch) => {
    guardedMock(new RegExp(`^${base}/${url}$`), 'post', (options) => run(options, () => dispatch(JSON.parse(options.body || '{}'))))
    guardedMock(new RegExp(`^${base}/${url}/[^/?]+$`), 'put', (options) => run(options, () => dispatch(idOf(options, options.url), JSON.parse(options.body || '{}'))))
    guardedMock(new RegExp(`^${base}/${url}/[^/?]+$`), 'delete', (options) => run(options, () => dispatch(idOf(options, options.url))))
  }
  // 分发：create(body) / update(id, patch) / delete(id)
  const splitDispatch = (createFn, updateFn, deleteFn) => (a, b) => {
    if (typeof a === 'string') return b === undefined ? deleteFn(a) : updateFn(a, b)
    return createFn(a)
  }
  medicineCrud('medicines', splitDispatch(db.createMedicine, db.updateMedicine, db.deleteMedicine))
  medicineCrud('exam-items', splitDispatch(db.createExamItem, db.updateExamItem, db.deleteExamItem))
  medicineCrud('fee-items', splitDispatch(db.createFeeItem, db.updateFeeItem, db.deleteFeeItem))
  medicineCrud('stocks', splitDispatch(db.createStock, db.updateStock, db.deleteStock))

  // ---------- 收费记录 ----------
  guardedMock(new RegExp(`^${base}/fee-records(\\?.*)?$`), 'get', (options) => {
    const q = parseQuery(options.url)
    const filters = {}
    if (q.type) filters.type = q.type
    if (q.status) filters.status = q.status
    if (q.keyword) filters.keyword = { fn: (row) => String(row.code).indexOf(q.keyword) !== -1 }
    const r = db.query('feeRecords', { filters, page: q.page, size: q.size, sortBy: 'code', sortOrder: 'desc' })
    return withPaging(r)
  })

  // ---------- 入院登记 ----------
  guardedMock(new RegExp(`^${base}/admissions(\\?.*)?$`), 'get', (options) => {
    refreshMaps()
    const q = parseQuery(options.url)
    const filters = {}
    if (q.code) filters.code = q.code
    if (q.status) filters.status = q.status
    if (q.patientName) filters.patientName = { fn: (row) => String((maps.patients[row.patientId] || {}).name || '').indexOf(q.patientName) !== -1 }
    const r = db.query('admissions', { filters, page: q.page, size: q.size, sortBy: 'code', sortOrder: 'desc' })
    return { total: r.total, list: r.list.map(enrichAdmission) }
  })
  guardedMock(new RegExp(`^${base}/admissions(\\?.*)?$`), 'post', (options) =>
    run(options, () => db.createAdmission(JSON.parse(options.body || '{}')))
  )
  guardedMock(new RegExp(`^${base}/admissions/[^/?]+/confirm$`), 'put', (options) =>
    run(options, () => db.confirmAdmission(idOf(options, options.url.replace(/\/confirm$/, ''))))
  )
  guardedMock(new RegExp(`^${base}/admissions/[^/?]+/transfer$`), 'put', (options) =>
    run(options, () => db.transferAdmission(idOf(options, options.url.replace(/\/transfer$/, '')), JSON.parse(options.body || '{}')))
  )
  guardedMock(new RegExp(`^${base}/admissions/[^/?]+/cancel$`), 'put', (options) =>
    run(options, () => db.cancelAdmission(idOf(options, options.url.replace(/\/cancel$/, ''))))
  )
  guardedMock(new RegExp(`^${base}/admissions/[^/?]+/discharge$`), 'put', (options) =>
    run(options, () => db.requestDischarge(idOf(options, options.url.replace(/\/discharge$/, ''))))
  )
  guardedMock(new RegExp(`^${base}/admissions/[^/?]+/settle$`), 'put', (options) =>
    run(options, () => db.settleDischarge(idOf(options, options.url.replace(/\/settle$/, ''))))
  )
  guardedMock(new RegExp(`^${base}/admissions/[^/?]+/deposit$`), 'put', (options) =>
    run(options, () => db.updateAdmissionDeposit(idOf(options, options.url.replace(/\/deposit$/, '')), JSON.parse(options.body || '{}').depositCents))
  )

  // ---------- 住院医嘱 ----------
  guardedMock(new RegExp(`^${base}/orders(\\?.*)?$`), 'get', (options) => {
    refreshMaps()
    const q = parseQuery(options.url)
    const filters = {}
    if (q.admissionId) filters.admissionId = q.admissionId
    if (q.status) filters.status = q.status
    const r = db.query('orders', { filters, page: q.page, size: q.size, sortBy: 'createdAt', sortOrder: 'desc' })
    return {
      total: r.total,
      list: r.list.map((row) => {
        const adm = db.all('admissions').find((x) => x.id === row.admissionId) || {}
        return Object.assign({}, row, enrichOrder(row), {
          admissionCode: adm.code || '—',
          patientName: (maps.patients[adm.patientId] || {}).name || '—',
          wardName: (maps.wards[adm.wardId] || {}).name || '—'
        })
      })
    }
  })
  guardedMock(new RegExp(`^${base}/orders(\\?.*)?$`), 'post', (options) =>
    run(options, () => db.createOrder(JSON.parse(options.body || '{}')))
  )
  guardedMock(new RegExp(`^${base}/orders/[^/?]+/execute$`), 'put', (options) =>
    run(options, () => db.executeOrder(idOf(options, options.url.replace(/\/execute$/, ''))))
  )
  guardedMock(new RegExp(`^${base}/orders/[^/?]+$`), 'delete', (options) =>
    run(options, () => db.cancelOrder(idOf(options, options.url)))
  )

  // ---------- 系统 ----------
  guardedMock(new RegExp(`^${base}/logs(\\?.*)?$`), 'get', (options) => {
    const q = parseQuery(options.url)
    const filters = {}
    if (q.keyword) {
      filters.keyword = { fn: (row) => `${row.operator}${row.action}${row.target}`.indexOf(q.keyword) !== -1 }
    }
    const r = db.query('logs', { filters, page: q.page, size: q.size, sortBy: 'time', sortOrder: 'desc' })
    return withPaging(r)
  })
  guardedMock(new RegExp(`^${base}/logs/clear$`), 'delete', (options) => run(options, () => db.clearLogs()))

  guardedMock(new RegExp(`^${base}/roles(\\?.*)?$`), 'get', () => wrap(db.all('roles')))
  guardedMock(new RegExp(`^${base}/roles(\\?.*)?$`), 'post', (options) => run(options, () => db.createRole(JSON.parse(options.body || '{}'))))
  guardedMock(new RegExp(`^${base}/roles/[^/?]+$`), 'delete', (options) => run(options, () => db.deleteRole(idOf(options, options.url))))
  guardedMock(new RegExp(`^${base}/roles/[^/?]+/menus$`), 'put', (options) =>
    run(options, () => db.saveRoleMenu(idOf(options, options.url.replace(/\/menus$/, '')), JSON.parse(options.body || '{}').menuCodes))
  )
  guardedMock(new RegExp(`^${base}/menus(\\?.*)?$`), 'get', () => wrap(db.all('menus')))

  guardedMock(new RegExp(`^${base}/system/reset$`), 'post', (options) => {
    const r = run(options, () => db.resetAll())
    refreshMaps()
    return r
  })

  // ---------- 待办（B1）----------
  guardedMock(new RegExp(`^${base}/todos(\\?.*)?$`), 'get', (options) => {
    const q = parseQuery(options.url)
    const filters = {}
    if (q.ownerStaffId) filters.ownerStaffId = q.ownerStaffId
    if (q.status) filters.status = q.status
    if (q.module) filters.module = q.module
    if (q.source) filters.source = q.source
    if (q.priority) filters.priorityConfirmed = { in: [q.priority, ''] }
    if (q.keyword) filters.keyword = { fn: (row) => `${row.title}${row.description || ''}`.indexOf(q.keyword) !== -1 }
    const r = db.query('todos', { filters: filters, page: q.page, size: q.size || 1000, sortBy: 'createdAt', sortOrder: 'desc' })
    return { total: r.total, list: r.list }
  })
  guardedMock(new RegExp(`^${base}/todos/suggest-priority$`), 'post', (options) => wrap(db.suggestTodoPriority(JSON.parse(options.body || '{}'))))
  guardedMock(new RegExp(`^${base}/todos(\\?.*)?$`), 'post', (options) => run(options, () => db.createTodo(JSON.parse(options.body || '{}'))))
  guardedMock(new RegExp(`^${base}/todos/[^/?]+/status$`), 'put', (options) => run(options, () => db.setTodoStatus(idOf(options, options.url.replace(/\/status$/, '')), JSON.parse(options.body || '{}').status)))
  guardedMock(new RegExp(`^${base}/todos/[^/?]+$`), 'put', (options) => run(options, () => db.updateTodo(idOf(options, options.url), JSON.parse(options.body || '{}'))))
  guardedMock(new RegExp(`^${base}/todos/[^/?]+$`), 'delete', (options) => run(options, () => db.deleteTodo(idOf(options, options.url))))

  // ---------- 系统提醒（B1，规则实时计算 + 确认/稍后）----------
  guardedMock(new RegExp(`^${base}/reminders$`), 'get', () => wrap(db.reminderSummary()))
  guardedMock(new RegExp(`^${base}/reminders/[^/?]+/ack$`), 'post', (options) => run(options, () => db.acknowledgeReminder(idOf(options, options.url.replace(/\/ack$/, '')))))
  guardedMock(new RegExp(`^${base}/reminders/[^/?]+/snooze$`), 'post', (options) => run(options, () => db.snoozeReminder(idOf(options, options.url.replace(/\/snooze$/, '')), JSON.parse(options.body || '{}').until)))

  // ---------- 审计事件（B1，供 B2 回放/时间线复用）----------
  guardedMock(new RegExp(`^${base}/audit-events(\\?.*)?$`), 'get', (options) => {
    const q = parseQuery(options.url)
    const filters = {}
    if (q.entityType) filters.entityType = q.entityType
    if (q.entityId) filters.entityId = q.entityId
    if (q.actorName) filters.actorName = q.actorName
    if (q.actorRole) filters.actorRole = q.actorRole
    if (q.action) filters.action = q.action
    if (q.result) filters.result = q.result
    if (q.start) filters.time = { gte: q.start }
    if (q.end) filters.time = Object.assign({}, filters.time, { lte: q.end + ' 23:59' })
    if (q.keyword) filters.keyword = { fn: (row) => `${row.actorName}${row.actorRole}${row.action}${row.summary}${row.entityCode}`.indexOf(q.keyword) !== -1 }
    const r = db.queryAudit({ filters: filters, page: q.page, size: q.size, sortBy: 'time', sortOrder: 'desc' })
    return withPaging(r)
  })

  // ---------- AI 服务层（B3：只读、可审计、可关闭、默认零网络）----------
  guardedMock(new RegExp(`^${base}/ai/settings$`), 'get', () => wrap(aiService.describeConfig()))
  guardedMock(new RegExp(`^${base}/ai/settings$`), 'put', (options) => run(options, () => aiService.applyConfig(JSON.parse(options.body || '{}'))))
  guardedMock(new RegExp(`^${base}/ai/tasks$`), 'get', () => wrap(aiService.listTasks()))
  guardedMock(new RegExp(`^${base}/ai/providers$`), 'get', () => wrap(aiService.listProviders()))
  guardedMock(new RegExp(`^${base}/ai/stats$`), 'get', () => wrap(aiService.eventStats()))
  guardedMock(new RegExp(`^${base}/ai/run$`), 'post', (options) => {
    const body = JSON.parse(options.body || '{}')
    const r = aiService.runTask(body.task, body.input || {}, { actor: db.getCurrentActor() })
    if (r && r.ok) return wrap(r)
    const code = r && r.code === 'AI_DISABLED' ? 503 : 400
    return { code: code, msg: (r && r.error) || 'AI 调用失败', data: r || null }
  })
  guardedMock(new RegExp(`^${base}/ai/events(\\?.*)?$`), 'get', (options) => {
    const q = parseQuery(options.url)
    const r = db.queryAiEvents({
      task: q.task,
      provider: q.provider,
      accepted: q.accepted,
      keyword: q.keyword,
      page: q.page,
      size: q.size || 20
    })
    return { total: r.total, list: r.list }
  })
  guardedMock(new RegExp(`^${base}/ai/events/[^/?]+/accept$`), 'put', (options) =>
    run(options, () => db.markAiEventAccepted(idOf(options, options.url.replace(/\/accept$/, ''))))
  )

  // ---------- 选项字典（供下拉框复用） ----------
  guardedMock(new RegExp(`^${base}/options/[^/?]+$`), 'get', (options) => {
    const name = options.url.match(/options\/([^/?]+)/)[1]
    if (name === 'doctors') return wrap(db.all('staff').filter((s) => s.type === '门诊医生' || s.code === 'S000').map((s) => ({ id: s.id, code: s.code, name: s.name, departmentId: s.departmentId })))
    if (name === 'departments') return wrap(db.all('departments').map((d) => ({ id: d.id, code: d.code, name: d.name })))
    if (name === 'wards') return wrap(db.all('wards').map((w) => ({ id: w.id, code: w.code, name: w.name, departmentId: w.departmentId })))
    if (name === 'beds') return wrap(db.all('beds').map((b) => ({ id: b.id, code: b.code, type: b.type, wardId: b.wardId, status: b.status, enabled: b.enabled })))
    if (name === 'patients') return wrap(db.all('patients').map((p) => ({ id: p.id, code: p.code, name: p.name, gender: p.gender, phone: p.phone })))
    if (name === 'medicines') return wrap(db.all('medicines').filter((m) => m.status === 1).map((m) => ({ id: m.id, code: m.code, name: m.name, spec: m.spec, unit: m.unit, priceCents: m.priceCents, stock: m.stock })))
    if (name === 'exam-items') return wrap(db.all('examItems').filter((m) => m.status === 1).map((m) => ({ id: m.id, code: m.code, name: m.name, category: m.category, priceCents: m.priceCents })))
    if (name === 'fee-items') return wrap(db.all('feeItems').filter((m) => m.status === 1).map((m) => ({ id: m.id, code: m.code, name: m.name, priceCents: m.priceCents })))
    if (name === 'adm-inside') return wrap(db.all('admissions').filter((a) => ['在院', '待结算'].includes(a.status)))
    return wrap([])
  })
}

export default registerMock
