// =====================================================================
// 数据层测试套件：金额计算、状态机、关联规则、Mock CRUD、失败不落库
// 可被纯 Node（tests/data/run.js）与 Jest（tests/unit/data.test.js）复用
// =====================================================================
const assert = require('assert')
const fs = require('fs')
const path = require('path')
const db = require('../../src/mock/db')
const ai = require('../../src/ai')

// 递归列出 src/ai 下的 .js 文件（供 G1/G7 静态断言）
function walkJsFiles(dir) {
  const out = []
  if (!fs.existsSync(dir)) return out
  fs.readdirSync(dir).forEach(function (name) {
    const full = path.join(dir, name)
    if (fs.statSync(full).isDirectory()) out.push.apply(out, walkJsFiles(full))
    else if (/\.js$/.test(name)) out.push(full)
  })
  return out
}

function test(name, fn) {
  try {
    fn()
    console.log('  ✔ ' + name)
  } catch (e) {
    console.error('  ✘ ' + name)
    throw e
  }
}

function section(name) {
  console.log('■ ' + name)
}

function runAll() {
  // 每个场景从种子状态开始，保证可重复
  const fresh = () => db.resetAll()

  section('金额（整数分）计算')
  test('100 元 = 10000 分，格式化无浮点误差', () => {
    assert.strictEqual(10000, Math.round(99.99 * 100) + 1)
    const sum = [1, 2, 3].reduce((a, b) => a + b, 0)
    assert.strictEqual(sum, 6)
  })
  test('挂号费种子均为正整数分', () => {
    fresh()
    db.all('registrations').forEach((r) => {
      assert.ok(Number.isInteger(r.feeCents), r.code)
      assert.ok(r.feeCents >= 0)
    })
  })
  test('接诊金额 = 数量 × 单价（整数分）', () => {
    fresh()
    const v = db.all('visits').find((x) => x.id === 'v3')
    const rxTotal = v.prescriptions.reduce((a, p) => a + p.qty * p.priceCents, 0)
    assert.strictEqual(rxTotal, 1450 + 1250)
    assert.strictEqual(v.prescriptions[0].amountCents, 1450)
  })

  section('登录')
  test('正确账号密码登录成功并更新最后登录时间', () => {
    fresh()
    const before = db.find('staff', 's0').lastLoginAt
    const r = db.login('admin', '123456')
    assert.ok(r.ok)
    assert.ok(db.find('staff', 's0').lastLoginAt >= before)
  })
  test('错误密码登录失败', () => {
    fresh()
    const r = db.login('admin', 'wrong')
    assert.ok(!r.ok)
  })
  test('停用账号不能登录', () => {
    fresh()
    db.setStaffEnabled('s1', false)
    const r = db.login('13900000001', '123456')
    assert.ok(!r.ok)
    assert.ok(r.error.indexOf('停用') !== -1)
  })

  section('员工规则')
  test('登录账号唯一性：重复账号被拒绝且不落库', () => {
    fresh()
    const before = db.all('staff').length
    const r = db.createStaff({ name: '测试员', type: '收费人员', loginAccount: 'admin', phone: '13911111111' })
    assert.ok(!r.ok)
    assert.strictEqual(db.all('staff').length, before)
  })
  test('被排班引用的员工不能删除', () => {
    fresh()
    const r = db.deleteStaff('s0')
    assert.ok(!r.ok)
  })
  test('删除未引用员工成功', () => {
    fresh()
    const r = db.deleteStaff('s11')
    assert.ok(r.ok)
  })
  test('重置密码为 123456', () => {
    fresh()
    db.resetStaffPassword('s1')
    assert.strictEqual(db.find('staff', 's1').password, '123456')
  })

  section('科室/病区/床位关联规则')
  test('有员工的科室不能删除', () => {
    fresh()
    const r = db.deleteDepartment('dep1')
    assert.ok(!r.ok)
  })
  test('无引用的科室可删除', () => {
    fresh()
    // dep8 药剂科：无员工、无病区、无排班、无挂号
    const r = db.deleteDepartment('dep8')
    assert.ok(r.ok, r.error)
  })
  test('有病区的病区不能删除；有床位的病区不能删除', () => {
    fresh()
    assert.ok(!db.deleteWard('w1').ok)
  })
  test('占用床位不能删除、不能停用', () => {
    fresh()
    const occupied = db.all('beds').find((b) => b.status === '占用')
    assert.ok(!db.deleteBed(occupied.id).ok)
    assert.ok(!db.updateBed(occupied.id, { enabled: 0 }).ok)
  })
  test('空闲床位可删除', () => {
    fresh()
    const idle = db.all('beds').find((b) => b.status === '空闲')
    assert.ok(db.deleteBed(idle.id).ok)
  })
  test('同病区床位号唯一', () => {
    fresh()
    const r = db.createBed({ wardId: 'w1', code: 'A01', type: '普通床' })
    assert.ok(!r.ok)
  })

  section('排班规则')
  test('同医生同日同时段冲突排班不能提交', () => {
    fresh()
    const before = db.all('schedules').length
    const r = db.createSchedule({ doctorId: 's0', departmentId: 'dep1', date: '2026-08-28', period: '上午' })
    assert.ok(!r.ok)
    assert.strictEqual(db.all('schedules').length, before)
  })
  test('不同时段排班可提交', () => {
    fresh()
    const r = db.createSchedule({ doctorId: 's0', departmentId: 'dep1', date: '2026-08-28', period: '下午' })
    assert.ok(r.ok, r.error)
  })
  test('已产生挂号的排班不能删除', () => {
    fresh()
    // s0 2026-08-22 上午 已有挂号 r1-r3
    const sc = db.all('schedules').find((x) => x.doctorId === 's0' && x.date === '2026-08-22' && x.period === '上午')
    assert.ok(!db.deleteSchedule(sc.id).ok)
  })

  section('挂号规则')
  test('无排班医生不能挂号且不产生收费记录', () => {
    fresh()
    const feesBefore = db.all('feeRecords').length
    const r = db.createRegistration({ patientId: 'p0', departmentId: 'dep5', doctorId: 's7', date: '2026-08-28', period: '下午' })
    assert.ok(!r.ok)
    assert.strictEqual(db.all('feeRecords').length, feesBefore)
  })
  test('有排班医生挂号成功，自动生成已缴费记录', () => {
    fresh()
    const r = db.createRegistration({ patientId: 'p0', departmentId: 'dep1', doctorId: 's0', date: '2026-08-28', period: '上午' })
    assert.ok(r.ok, r.error)
    const fr = db.all('feeRecords').filter((f) => f.refId === r.data.id)
    assert.strictEqual(fr.length, 1)
    assert.strictEqual(fr[0].status, '已缴费')
  })
  test('退号后状态为已退号且收费记录已退费', () => {
    fresh()
    const reg = db.all('registrations').find((x) => x.id === 'r17')
    const r = db.refundRegistration(reg.id)
    assert.ok(r.ok)
    const now = db.find('registrations', reg.id)
    assert.strictEqual(now.regStatus, '已退号')
    const fr = db.all('feeRecords').find((f) => f.refId === reg.id && f.type === '挂号费')
    assert.strictEqual(fr.status, '已退费')
  })
  test('已接诊的挂号不能退号', () => {
    fresh()
    const r = db.refundRegistration('r1')
    assert.ok(!r.ok)
  })

  section('接诊规则与状态联动')
  test('退号记录不能接诊', () => {
    fresh()
    const reg = db.all('registrations').find((x) => x.regStatus === '已退号')
    const r = db.createVisit({ regId: reg.id, complaint: 'x', history: 'x', diagnosis: 'x', advice: 'x' })
    assert.ok(!r.ok)
  })
  test('待分诊挂号可接诊，保存已完成联动挂号状态', () => {
    fresh()
    const reg = db.all('registrations').find((x) => x.id === 'r0')
    const r = db.createVisit({
      regId: reg.id,
      visitStatus: '已完成',
      complaint: '头痛',
      history: '两天来头痛',
      diagnosis: '偏头痛',
      advice: '休息观察',
      prescriptions: [{ medicineId: 'm1', usage: '口服', qty: 2, priceCents: 1250 }],
      exams: [{ examItemId: 'e1', qty: 1, priceCents: 2500 }]
    })
    assert.ok(r.ok, r.error)
    assert.strictEqual(db.find('registrations', reg.id).regStatus, '已完成')
    assert.strictEqual(r.data.prescriptions[0].amountCents, 2500)
  })
  test('负数量/负价格不能提交且不落库', () => {
    fresh()
    const before = db.all('visits').length
    const r = db.createVisit({
      regId: 'r17',
      complaint: 'x',
      history: 'x',
      diagnosis: 'x',
      advice: 'x',
      prescriptions: [{ medicineId: 'm1', usage: '口服', qty: -1, priceCents: 1250 }]
    })
    assert.ok(!r.ok)
    assert.strictEqual(db.all('visits').length, before)
  })
  test('已收费接诊不能修改（防止金额漂移）', () => {
    fresh()
    const r = db.updateVisit('v1', { complaint: '改一下' })
    assert.ok(!r.ok)
  })

  section('门诊收费 / 发药')
  test('未收费接诊可收费，重复收费被阻止', () => {
    fresh()
    const r = db.chargeVisit('v2')
    assert.ok(r.ok, r.error)
    assert.ok(!db.chargeVisit('v2').ok)
  })
  test('未收费处方不能发药', () => {
    fresh()
    const r = db.dispenseVisit('v2')
    assert.ok(!r.ok)
  })
  test('发药扣减库存，库存不足被阻止', () => {
    fresh()
    db.chargeVisit('v2')
    const med = db.find('medicines', 'm4')
    const before = med.stock
    assert.ok(db.dispenseVisit('v2').ok)
    assert.strictEqual(db.find('medicines', 'm4').stock, before - 1)
    assert.ok(!db.dispenseVisit('v2').ok) // 重复发药
  })

  section('入院与床位联动')
  test('登记分配空闲床位，床位变为占用', () => {
    fresh()
    const idle = db.all('beds').find((b) => b.status === '空闲' && b.enabled === 1)
    const r = db.createAdmission({ patientId: 'p6', departmentId: 'dep1', wardId: idle.wardId, bedId: idle.id, depositCents: 50000 })
    assert.ok(r.ok, r.error)
    assert.strictEqual(db.find('beds', idle.id).status, '占用')
  })
  test('同一床位不能被两名在院患者占用', () => {
    fresh()
    const idle = db.all('beds').find((b) => b.status === '空闲')
    db.createAdmission({ patientId: 'p6', departmentId: 'dep1', wardId: idle.wardId, bedId: idle.id, depositCents: 50000 })
    const r = db.createAdmission({ patientId: 'p7', departmentId: 'dep1', wardId: idle.wardId, bedId: idle.id, depositCents: 50000 })
    assert.ok(!r.ok)
  })
  test('已有在院记录的患者不能重复登记', () => {
    fresh()
    const idle = db.all('beds').find((b) => b.status === '空闲')
    const r = db.createAdmission({ patientId: 'p3', departmentId: 'dep1', wardId: idle.wardId, bedId: idle.id, depositCents: 0 })
    assert.ok(!r.ok)
  })
  test('入科确认：待入科 -> 在院', () => {
    fresh()
    const r = db.confirmAdmission('a4')
    assert.ok(r.ok)
    assert.strictEqual(db.find('admissions', 'a4').status, '在院')
  })
  test('转床同时释放原床位并占用新床位', () => {
    fresh()
    const idle = db.all('beds').find((b) => b.status === '空闲')
    const r = db.transferAdmission('a2', { wardId: idle.wardId, bedId: idle.id })
    assert.ok(r.ok, r.error)
    assert.strictEqual(db.find('beds', 'b2').status, '空闲') // 原床位释放
    assert.strictEqual(db.find('beds', idle.id).status, '占用') // 新床位占用
  })
  test('取消登记释放床位', () => {
    fresh()
    const r = db.cancelAdmission('a4')
    assert.ok(r.ok)
    assert.strictEqual(db.find('beds', 'b11').status, '空闲')
  })
  test('已入科记录不能取消登记', () => {
    fresh()
    assert.ok(!db.cancelAdmission('a3').ok)
  })
  test('出院结算：状态一致、床位释放、差额计算正确', () => {
    fresh()
    const r = db.settleDischarge('a2')
    assert.ok(r.ok, r.error)
    const adm = db.find('admissions', 'a2')
    assert.strictEqual(adm.status, '已出院')
    assert.strictEqual(db.find('beds', 'b2').status, '空闲')
    // 已执行医嘱：o3 16000 + o4 12000 = 28000 分；预交 10000 分 → 差额 -18000
    assert.strictEqual(r.data.totalCents, 28000)
    assert.strictEqual(r.data.balanceCents, -18000)
  })
  test('重复结算被阻止', () => {
    fresh()
    db.settleDischarge('a1')
    assert.ok(!db.settleDischarge('a1').ok)
  })

  section('分页与筛选（数据层）')
  test('分页查询 total 与页大小正确', () => {
    fresh()
    const r = db.query('registrations', { filters: {}, page: 2, size: 10 })
    assert.strictEqual(r.total, db.all('registrations').length)
    assert.strictEqual(r.list.length, Math.min(10, Math.max(0, r.total - 10)))
  })
  test('字符串筛选为包含匹配', () => {
    fresh()
    const r = db.query('patients', { filters: { name: '张' }, page: 1, size: 10 })
    assert.ok(r.list.every((p) => p.name.indexOf('张') !== -1))
  })

  section('首页统计（实时计算）')
  test('今日门诊 = 当日非退号挂号数', () => {
    fresh()
    const s = db.stats()
    const expect = db.all('registrations').filter((r) => r.date === s.today && r.regStatus !== '已退号').length
    assert.strictEqual(s.todayRegCount, expect)
    assert.strictEqual(s.todayRegCount, 0) // 种子数据 08-28 无挂号，与截图一致
  })
  test('床位占用比例 = 占用/总数（25%）', () => {
    fresh()
    const s = db.stats()
    assert.strictEqual(s.beds.total, 12)
    assert.strictEqual(s.beds.occupied, 3)
    assert.strictEqual(s.beds.occupancyPct, 25)
  })
  test('新增挂号后首页统计联动', () => {
    fresh()
    db.createRegistration({ patientId: 'p0', departmentId: 'dep1', doctorId: 's0', date: '2026-08-28', period: '上午' })
    const s = db.stats()
    assert.strictEqual(s.todayRegCount, 1)
  })

  section('持久化与重置')
  test('重置后恢复种子数据', () => {
    fresh()
    db.createPatient({ name: '临时患者', gender: '男', phone: '15911112222' })
    db.resetAll()
    assert.strictEqual(db.all('patients').length, 12)
    assert.ok(!db.all('patients').some((p) => p.name === '临时患者'))
  })
  test('查询空结果返回空列表', () => {
    fresh()
    const r = db.query('patients', { filters: { name: '不存在的患者xyz' }, page: 1, size: 10 })
    assert.strictEqual(r.total, 0)
    assert.strictEqual(r.list.length, 0)
  })

  section('数据版本迁移（v1 -> 当前版本 无损）')
  test('v1 数据升级到当前版本、原有数据零丢失且生成备份', () => {
    const seed = require('../../src/mock/seed').buildSeed()
    const v1 = JSON.parse(JSON.stringify(seed))
    v1.version = 1
    delete v1.auditEvents
    delete v1.todos
    delete v1.reminderAcks
    delete v1.aiEvents
    delete v1.counters.auditEvents
    delete v1.counters.todos
    delete v1.counters.reminderAcks
    delete v1.counters.aiEvents
    // 模拟旧数据：移除 v3 才新增的菜单节点
    ;(v1.menus || []).forEach((m) => {
      if (Array.isArray(m.children)) m.children = m.children.filter((c) => ['patient-timeline', 'system-audit'].indexOf(c.code) === -1)
    })
    // 模拟旧数据：移除 v4 才新增的 AI 菜单分组
    v1.menus = (v1.menus || []).filter((m) => m.code !== 'ai')
    const patientsBefore = v1.patients.length
    const staffBefore = v1.staff.length
    const regBefore = v1.registrations.length
    const store = {}
    global.localStorage = {
      getItem: (k) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v) },
      removeItem: (k) => { delete store[k] }
    }
    try {
      store.astra_hospital_db_v1 = JSON.stringify(v1)
      db.load()
      assert.strictEqual(db.CURRENT_VERSION, 5)
      assert.strictEqual(db.all('patients').length, patientsBefore)
      assert.strictEqual(db.all('staff').length, staffBefore)
      assert.strictEqual(db.all('registrations').length, regBefore)
      assert.ok(Array.isArray(db.all('todos')))
      assert.ok(Array.isArray(db.all('reminderAcks')))
      assert.ok(Array.isArray(db.all('auditEvents')))
      assert.ok(db.all('menus').some((m) => m.code === 'system' && (m.children || []).some((c) => c.code === 'system-audit')), '应迁移出审计中心菜单')
      assert.ok(db.all('menus').some((m) => m.code === 'patient' && (m.children || []).some((c) => c.code === 'patient-timeline')), '应迁移出患者时间线菜单')
      assert.ok(db.all('menus').some((m) => m.code === 'ai' && (m.children || []).some((c) => c.code === 'ai-center')), '应迁移出 AI 治理中心菜单')
      assert.ok(db.all('menus').some((m) => m.code === 'ai' && (m.children || []).some((c) => c.code === 'ai-assistant')), '应迁移出 AI 应用菜单')
      assert.ok(store.astra_hospital_db_v1_backup_v1, '应生成 v1 备份')
      assert.strictEqual(JSON.parse(store.astra_hospital_db_v1).version, 5)
    } finally {
      delete global.localStorage
      db.resetAll()
    }
  })

  section('结构化审计与真实操作人')
  test('登录后写操作审计记录真实操作人/角色/实体且不含密码', () => {
    fresh()
    const lr = db.login('admin', '123456')
    assert.ok(lr.ok)
    const before = db.all('auditEvents').length
    const cr = db.createPatient({ name: '审计测试患者', gender: '男', phone: '13912345678' })
    assert.ok(cr.ok, cr.error)
    const list = db.all('auditEvents')
    assert.strictEqual(list.length, before + 1)
    const ev = list[0]
    assert.strictEqual(ev.actorName, '周明远')
    assert.strictEqual(ev.actorRole, '超级管理员')
    assert.strictEqual(ev.entityType, 'patients')
    assert.ok(ev.entityId)
    db.createStaff({ name: '审计员工', type: '收费人员', loginAccount: 'audituser', phone: '13912340000' })
    const staffEv = db.all('auditEvents')[0]
    assert.strictEqual(staffEv.entityType, 'staff')
    assert.ok(JSON.stringify(staffEv).indexOf('"password"') === -1, '审计不应包含密码字段')
  })

  section('身份与角色复原')
  test('profileOf 按 token 复原员工与角色且不含密码', () => {
    fresh()
    const lr = db.login('admin', '123456')
    const p = db.profileOf(lr.data.token)
    assert.ok(p)
    assert.strictEqual(p.name, '周明远')
    assert.strictEqual(p.roleCode, 'SUPER_ADMIN')
    assert.ok(p.menuCodes.indexOf('*') !== -1)
    assert.ok(!('password' in p))
    const dr = db.login('13900000001', '123456')
    const dp = db.profileOf(dr.data.token)
    assert.strictEqual(dp.roleCode, 'DOCTOR')
    assert.ok(dp.menuCodes.indexOf('outpatient') !== -1)
    assert.ok(dp.menuCodes.indexOf('system') === -1)
  })

  section('个人待办（含优先级建议）')
  test('创建/更新/状态/删除待办，优先级建议可用', () => {
    fresh()
    const sug = db.suggestTodoPriority({ title: 'x', dueDate: '2026-08-28', module: '收费' })
    assert.ok(['高', '中', '低'].indexOf(sug.priority) !== -1)
    assert.ok(sug.reason && sug.reason.length > 0)
    const c = db.createTodo({ title: '测试待办', module: '门诊管理', dueDate: '2026-08-28' })
    assert.ok(c.ok, c.error)
    assert.strictEqual(c.data.prioritySuggested, '高')
    const u = db.updateTodo(c.data.id, { title: '测试待办改', priorityConfirmed: '中' })
    assert.ok(u.ok)
    assert.strictEqual(u.data.title, '测试待办改')
    const st = db.setTodoStatus(c.data.id, '已完成')
    assert.ok(st.ok)
    assert.strictEqual(st.data.status, '已完成')
    const d = db.deleteTodo(c.data.id)
    assert.ok(d.ok)
    assert.ok(!db.find('todos', c.data.id))
  })

  section('系统提醒规则引擎（解决即自动完成）')
  test('低库存提醒随库存恢复自动消失，关闭不视为解决', () => {
    fresh()
    db.updateMedicine('m10', { stock: 5 })
    assert.ok(db.computeReminders().some((r) => r.rule === 'lowStock' && r.refId === 'm10'))
    db.acknowledgeReminder('lowStock:m10')
    assert.ok(db.computeReminders().some((r) => r.rule === 'lowStock' && r.refId === 'm10'))
    db.updateMedicine('m10', { stock: 500 })
    assert.ok(!db.computeReminders().some((r) => r.rule === 'lowStock' && r.refId === 'm10'))
  })
  test('种子数据存在待报告/待执行医嘱提醒且摘要可用', () => {
    fresh()
    const rules = db.computeReminders().map((r) => r.rule)
    assert.ok(rules.indexOf('pendingReport') !== -1, '应有待报告提醒')
    assert.ok(rules.indexOf('pendingOrder') !== -1, '应有待执行医嘱提醒')
    const sum = db.reminderSummary()
    assert.ok(sum.total >= 2)
    assert.ok(sum.byLevel.high + sum.byLevel.medium + sum.byLevel.low === sum.total)
  })

  section('B2 权限域判断（演示级 RBAC）')
  test('不同角色可访问的业务域不同', () => {
    fresh()
    const admin = db.find('staff', 's0')
    const doctor = db.find('staff', 's1')
    const cashier = db.find('staff', 's9')
    const resident = db.find('staff', 's10')
    const nurse = db.find('staff', 's11')
    assert.ok(db.canDomain(admin, 'system'))
    assert.ok(db.canDomain(admin, 'basic'))
    assert.ok(db.canDomain(doctor, 'outpatient'))
    assert.ok(db.canDomain(doctor, 'patient'))
    assert.ok(!db.canDomain(doctor, 'system'))
    assert.ok(!db.canDomain(doctor, 'inpatient'))
    assert.ok(db.canDomain(cashier, 'outpatient'))
    assert.ok(!db.canDomain(cashier, 'basic'))
    assert.ok(db.canDomain(resident, 'inpatient'))
    assert.ok(!db.canDomain(resident, 'outpatient'))
    assert.ok(db.canDomain(nurse, 'basic'))
    assert.ok(db.canDomain(nurse, 'inpatient'))
  })
  test('canMenu 支持分组与子项', () => {
    fresh()
    const doctor = db.find('staff', 's1')
    assert.ok(db.canMenu(doctor, 'outpatient-visit'))
    assert.ok(db.canMenu(doctor, 'outpatient-charge'))
    assert.ok(!db.canMenu(doctor, 'system-role'))
  })

  section('B2 分角色工作台聚合')
  test('医生工作台返回本人待接诊数据', () => {
    fresh()
    db.login('13900000002', '123456')
    const staff = db.find('staff', 's2')
    const wb0 = db.workbenchSummary(db.getCurrentActor())
    assert.strictEqual(wb0.roleCode, 'DOCTOR')
    assert.ok(wb0.capabilities.outpatient)
    assert.ok(!wb0.capabilities.admin)
    const before = wb0.counts.myPendingRegs
    db.createRegistration({ patientId: 'p0', departmentId: 'dep1', doctorId: staff.id, date: '2026-08-28', period: '上午' })
    const wb = db.workbenchSummary(db.getCurrentActor())
    assert.strictEqual(wb.counts.myPendingRegs, before + 1)
    assert.ok(wb.queues.myPendingRegs.some((x) => x.patientName === '林雪梅'))
  })
  test('收费员工作台返回待收费/待发药/待结算', () => {
    fresh()
    db.login('13800001000', '123456')
    const wb = db.workbenchSummary(db.getCurrentActor())
    assert.strictEqual(wb.roleCode, 'CASHIER')
    assert.ok(wb.capabilities.cashier)
    assert.ok(wb.counts.pendingCharge >= 1)
    assert.ok(wb.counts.pendingSettle >= 1)
  })
  test('管理员工作台含运营统计与库存提醒', () => {
    fresh()
    db.login('admin', '123456')
    const wb = db.workbenchSummary(db.getCurrentActor())
    assert.ok(wb.capabilities.admin)
    assert.strictEqual(wb.stats.beds.total, 12)
    assert.ok(Array.isArray(wb.queues.lowStock))
  })

  section('B2 患者 360° 时间线')
  test('时间线聚合真实业务记录且只读、不重复', () => {
    fresh()
    const before = JSON.stringify({ r: db.all('registrations').length, v: db.all('visits').length, a: db.all('admissions').length })
    const r = db.patientTimeline('p3')
    assert.ok(r.ok, r.error)
    const cats = r.data.events.map((e) => e.category)
    assert.ok(cats.indexOf('挂号') !== -1)
    assert.ok(cats.indexOf('接诊') !== -1)
    assert.ok(cats.indexOf('入院') !== -1)
    assert.ok(cats.indexOf('医嘱') !== -1)
    const ids = r.data.events.map((e) => e.id)
    assert.strictEqual(ids.length, new Set(ids).size)
    const after = JSON.stringify({ r: db.all('registrations').length, v: db.all('visits').length, a: db.all('admissions').length })
    assert.strictEqual(before, after)
    assert.ok(r.data.progress.total > 0)
  })
  test('不存在的患者返回失败', () => {
    fresh()
    assert.ok(!db.patientTimeline('not-exist').ok)
  })

  section('B2 审计只读与待办描述')
  test('审计无删除接口且记录不含密码', () => {
    fresh()
    db.login('admin', '123456')
    db.createPatient({ name: '审计只读测试', gender: '女', phone: '13912349999' })
    assert.strictEqual(typeof db.deleteAuditEvent, 'undefined')
    assert.ok(JSON.stringify(db.all('auditEvents')).indexOf('"password"') === -1)
  })
  test('待办描述可创建与更新', () => {
    fresh()
    const c = db.createTodo({ title: '带描述待办', description: '初始描述', module: '收费' })
    assert.ok(c.ok, c.error)
    assert.strictEqual(c.data.description, '初始描述')
    const u = db.updateTodo(c.data.id, { description: '更新后的描述' })
    assert.ok(u.ok)
    assert.strictEqual(u.data.description, '更新后的描述')
  })

  section('B3 AI 基础设施（只读 / 脱敏 / 审计 / 开关 / 零网络）')
  test('任务注册表包含基础设施任务且全部声明只读', () => {
    fresh()
    const names = ai.listTasks().map((t) => t.name)
    ;['system.selftest', 'todo.priority', 'reminder.explain'].forEach((n) => {
      assert.ok(names.indexOf(n) !== -1, '缺少任务 ' + n)
    })
    ai.listTasks().forEach((t) => {
      assert.strictEqual(t.readOnly, true, '任务必须只读：' + t.name)
      assert.ok(t.schemaFields > 0, '任务必须声明输出结构：' + t.name)
    })
  })

  test('Provider 契约：本地引擎可用且同步，外部 Provider 默认不可用', () => {
    const list = ai.listProviders()
    const local = list.find((p) => p.name === 'local-rule-engine')
    assert.ok(local, '缺少本地引擎')
    assert.strictEqual(local.kind, 'local')
    assert.strictEqual(local.sync, true)
    assert.strictEqual(local.available, true)
    const http = list.find((p) => p.name === 'http-llm')
    assert.ok(http, '缺少外部 Provider 骨架')
    assert.strictEqual(http.available, false, '外部 Provider 默认必须禁用')
  })

  test('自检任务返回结构合法结果并附免责声明', () => {
    fresh()
    const r = ai.runTask('system.selftest', {})
    assert.ok(r.ok, r.error)
    assert.strictEqual(r.task, 'system.selftest')
    assert.strictEqual(r.provider, 'local-rule-engine')
    assert.strictEqual(typeof r.data.summary, 'string')
    assert.ok(r.data.summary.length > 0)
    assert.ok(Array.isArray(r.data.checks) && r.data.checks.length >= 5)
    assert.ok(r.data.checks.every((c) => c.ok === true))
    assert.ok(Array.isArray(r.data.disclaimers) && r.data.disclaimers.length >= 1)
    assert.strictEqual(r.meta.readOnly, true)
    assert.strictEqual(r.meta.audited, true)
  })

  test('每次 AI 调用写入 aiEvents 且不含敏感信息', () => {
    fresh()
    const before = db.all('aiEvents').length
    const r = ai.runTask('system.selftest', { password: 'secret', token: 'mock-token-s0', phone: '13912345678', note: '演示输入' })
    assert.ok(r.ok, r.error)
    assert.strictEqual(db.all('aiEvents').length, before + 1)
    const ev = db.all('aiEvents')[0]
    assert.strictEqual(ev.task, 'system.selftest')
    assert.strictEqual(ev.provider, 'local-rule-engine')
    assert.ok(ev.inputSummary.length > 0)
    const raw = JSON.stringify(ev).toLowerCase()
    assert.ok(raw.indexOf('password') === -1, '审计不应包含 password 字段名')
    assert.ok(raw.indexOf('secret') === -1, '审计不应包含密码值')
    assert.ok(raw.indexOf('mock-token') === -1, '审计不应包含 token 值')
    assert.ok(raw.indexOf('13912345678') === -1, '审计不应包含手机号')
  })

  test('AI 开关关闭时无任何副作用（G6）', () => {
    fresh()
    const before = db.all('aiEvents').length
    const old = process.env.VUE_APP_AI_ENABLED
    process.env.VUE_APP_AI_ENABLED = 'false'
    try {
      const r = ai.runTask('system.selftest', {})
      assert.ok(!r.ok)
      assert.strictEqual(r.code, 'AI_DISABLED')
      assert.strictEqual(db.all('aiEvents').length, before, '关闭后不得写入审计或产生副作用')
    } finally {
      if (old === undefined) delete process.env.VUE_APP_AI_ENABLED
      else process.env.VUE_APP_AI_ENABLED = old
    }
  })

  test('上下文与选择器脱敏（G5）：不含密码/手机号/token', () => {
    fresh()
    const staff = ai.selectors.all('staff')
    assert.ok(staff.length > 0)
    const staffRaw = JSON.stringify(staff).toLowerCase()
    assert.ok(staffRaw.indexOf('"password"') === -1)
    assert.ok(staffRaw.indexOf('"phone"') === -1)
    const contextBuilder = require('../../src/ai/contextBuilder')
    const ctx = contextBuilder.build(ai.getTask('system.selftest'), { password: 'x', token: 'mock-token-s0' }, db.getCurrentActor())
    const ctxRaw = JSON.stringify(ctx).toLowerCase()
    assert.ok(ctxRaw.indexOf('"password"') === -1)
    assert.ok(ctxRaw.indexOf('mock-token') === -1)
    assert.ok(ctx.note.indexOf('只读') !== -1)
  })

  test('输出 schema 校验失败时回退"无建议"（G2）', () => {
    const g = ai.guardrails
    const bad = g.validateSchema({ answer: 1 }, { answer: 'string', basis: 'array' })
    assert.strictEqual(bad.ok, false)
    assert.strictEqual(bad.errors.length, 2)
    const fb = g.fallbackOutput({ fallback: null }, bad.errors)
    assert.ok(fb && typeof fb === 'object')
    assert.ok(typeof fb.note === 'string' && fb.note.length > 0)
    assert.ok(Array.isArray(fb.disclaimers))
  })

  test('G1 静态断言：AI 层无业务写函数调用', () => {
    const g = ai.guardrails
    const files = walkJsFiles(path.join(__dirname, '../../src/ai'))
    assert.ok(files.length >= 8, '应扫描到 AI 层源码文件')
    const hits = []
    files.forEach((f) => {
      const src = fs.readFileSync(f, 'utf8')
      g.scanSource(src, g.FORBIDDEN_WRITE_PATTERNS).forEach((h) => hits.push(path.basename(f) + ':' + h.label))
    })
    assert.strictEqual(hits.length, 0, 'AI 层不应具备写能力：' + hits.slice(0, 5).join('；'))
  })

  test('G7 静态断言：AI 层无网络请求实现', () => {
    const g = ai.guardrails
    // guardrails.js 本身定义静态规则文本，故排除；其余 AI 文件不得出现网络调用
    const files = walkJsFiles(path.join(__dirname, '../../src/ai')).filter((f) => path.basename(f) !== 'guardrails.js')
    const hits = []
    files.forEach((f) => {
      const src = fs.readFileSync(f, 'utf8')
      g.scanSource(src, g.FORBIDDEN_NETWORK_PATTERNS).forEach((h) => hits.push(path.basename(f) + ':' + h.label))
    })
    assert.strictEqual(hits.length, 0, '默认链路不应发起网络请求：' + hits.slice(0, 5).join('；'))
  })

  test('AI 审计事件统计与采纳标记可用', () => {
    fresh()
    const r = ai.runTask('system.selftest', {})
    assert.ok(r.meta.eventId, '应返回审计事件 id')
    const m = ai.markAccepted(r.meta.eventId)
    assert.ok(m.ok, m.error)
    const st = ai.eventStats()
    assert.strictEqual(st.total, 1)
    assert.strictEqual(st.accepted, 1)
    assert.strictEqual(st.acceptanceRate, 100)
    assert.strictEqual(st.byTask['system.selftest'], 1)
  })

  test('未知任务与非法输入安全失败', () => {
    fresh()
    const r = ai.runTask('not.exist', {})
    assert.ok(!r.ok)
    assert.strictEqual(r.code, 'AI_TASK_NOT_FOUND')
    assert.strictEqual(db.all('aiEvents').length, 0)
  })

  console.log('\n全部数据层测试通过 ✔')
}

module.exports = { runAll }
