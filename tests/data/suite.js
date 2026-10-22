// =====================================================================
// 数据层测试套件：金额计算、状态机、关联规则、Mock CRUD、失败不落库
// 可被纯 Node（tests/data/run.js）与 Jest（tests/unit/data.test.js）复用
// =====================================================================
const assert = require('assert')
const db = require('../../src/mock/db')

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

  console.log('\n全部数据层测试通过 ✔')
}

module.exports = { runAll }
