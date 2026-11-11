// =====================================================================
// B4 用例：assistant.qa（Ask Astra 业务助手）
// 覆盖：schema 合法、数值与 db/stats() 一致、医生视角过滤、权限收敛、
//       低库存口径、未知问题回退、输出确定性、建议入口结构、只读静态检查。
// 说明：每个 test 前 run-one.js 会执行 db.resetAll()，保证 demoToday=2026-08-28。
// =====================================================================
const assert = require('assert')
const fs = require('fs')
const path = require('path')
const task = require('../../../src/ai/tasks/assistant')
const contextBuilder = require('../../../src/ai/contextBuilder')
const guardrails = require('../../../src/ai/guardrails')

// 演示角色（与 seed.js 的 staff/roles 对应）
const ADMIN = { id: 's0', name: '周明远', role: '超级管理员' }
const DOCTOR = { id: 's1', name: '王雨桐', role: '门诊医生' }
const NURSE = { id: 's11', name: '钱丽华', role: '护士长' }

const KNOWN_ROUTES = [
  '/dashboard',
  '/workbench/reminders',
  '/workbench/todos',
  '/outpatient/registrations',
  '/outpatient/visits',
  '/outpatient/charges',
  '/outpatient/dispenses',
  '/outpatient/reports',
  '/outpatient/exam-applies',
  '/outpatient/schedules',
  '/inpatient/orders',
  '/inpatient/admissions',
  '/inpatient/settlements',
  '/basic/medicines',
  '/basic/stocks',
  '/basic/beds',
  '/patients',
  '/patients/timeline'
]

function buildContext(question, actor) {
  const input = { question: question }
  return contextBuilder.build(task, input, actor || ADMIN)
}

function ask(question, actor) {
  const input = { question: question }
  const ctx = contextBuilder.build(task, input, actor || ADMIN)
  return task.generate(ctx, input, {})
}

module.exports = function register({ test, section, db }) {
  section('B4 Ask Astra 助手')

  test('schema 合法：outputSchema 字段齐全且类型正确（含 fallback）', () => {
    const out = ask('今天门诊量多少')
    const checked = guardrails.validateSchema(out.data, task.outputSchema)
    assert.ok(checked.ok, 'schema 校验失败：' + checked.errors.join('；'))
    assert.deepStrictEqual(Object.keys(out.data).sort(), [
      'actions',
      'answer',
      'basis',
      'disclaimers',
      'followups',
      'intent'
    ])
    assert.ok(Array.isArray(out.data.disclaimers) && out.data.disclaimers.length > 0)
    const fb = task.fallback(['模拟结构错误'])
    const fbChecked = guardrails.validateSchema(fb, task.outputSchema)
    assert.ok(fbChecked.ok, 'fallback 结构不合法：' + fbChecked.errors.join('；'))
  })

  test('今日门诊量回答与 db.stats() 一致（basis.source + raw）', () => {
    const out = ask('今天门诊量多少')
    const stats = db.stats()
    assert.strictEqual(out.data.intent, 'todayReg')
    const basis = out.data.basis.find((b) => b.source === 'stats.todayRegCount')
    assert.ok(basis, '缺少 stats.todayRegCount 依据')
    assert.strictEqual(basis.raw, stats.todayRegCount)
    assert.ok(Number.isInteger(basis.raw), 'raw 必须为整数')
    assert.ok(out.data.answer.indexOf(String(stats.todayRegCount)) !== -1)
    assert.ok(out.data.answer.indexOf('2026-08-28') !== -1, '回答需包含演示基准日口径')
  })

  test('待出报告 / 待执行医嘱与 stats.todo 一致', () => {
    const stats = db.stats()
    const report = ask('待出报告有几条')
    assert.strictEqual(report.data.intent, 'report')
    const rb = report.data.basis.find((b) => b.source === 'stats.todo.pendingReports')
    assert.ok(rb)
    assert.strictEqual(rb.raw, stats.todo.pendingReports)

    const order = ask('待执行医嘱有几条')
    assert.strictEqual(order.data.intent, 'order')
    const ob = order.data.basis.find((b) => b.source === 'stats.todo.pendingOrders')
    assert.ok(ob)
    assert.strictEqual(ob.raw, stats.todo.pendingOrders)
  })

  test('医生视角待接诊按 actor.staffId 过滤 doctorId', () => {
    const doc = ask('待接诊有多少', DOCTOR)
    assert.strictEqual(doc.data.intent, 'triage')
    const mine = doc.data.basis.find((b) => b.source === 'selectors.pendingTriage(doctorId=actor.staffId)')
    assert.ok(mine, '医生视角缺少按 staffId 过滤的依据')
    assert.strictEqual(mine.raw, 1)
    assert.ok(doc.data.answer.indexOf('王雨桐') !== -1)

    const admin = ask('待接诊有多少', ADMIN)
    const total = admin.data.basis.find((b) => b.source === 'selectors.pendingTriage')
    assert.ok(total)
    assert.strictEqual(total.raw, 6)
    assert.notStrictEqual(doc.data.answer, admin.data.answer)
  })

  test('低库存：说明无低于阈值药品并列出库存最低 3 个', () => {
    const out = ask('库存最低的药品有哪些')
    assert.strictEqual(out.data.intent, 'stock')
    const low = out.data.basis.find((b) => b.source === 'selectors.lowStockMedicines')
    assert.ok(low)
    assert.strictEqual(low.raw, 0)
    assert.ok(out.data.answer.indexOf('没有低于阈值') !== -1)
    const lowest = out.data.basis
      .filter((b) => String(b.source || '').indexOf('medicines.') === 0)
      .map((b) => b.raw)
    assert.deepStrictEqual(lowest, [130, 150, 180], '库存最低 3 个应按升序为 m10/m4/m6')
  })

  test('今日收入 raw 为整数分且与 stats.todayFeeCents 一致', () => {
    const out = ask('今天收入多少')
    const stats = db.stats()
    assert.strictEqual(out.data.intent, 'income')
    const today = out.data.basis.find((b) => b.source === 'stats.todayFeeCents')
    assert.ok(today)
    assert.strictEqual(today.raw, stats.todayFeeCents)
    assert.ok(Number.isInteger(today.raw), '金额 raw 必须为整数分')
    const week = out.data.basis.find((b) => b.source === 'stats.last7days')
    assert.ok(week)
    const weekSum = stats.last7days.reduce((acc, d) => acc + d.feeCents, 0)
    assert.strictEqual(week.raw, weekSum)
  })

  test('床位占用率与 stats.beds 一致', () => {
    const out = ask('床位占用率多少')
    const stats = db.stats()
    assert.strictEqual(out.data.intent, 'bed')
    const basis = out.data.basis.find((b) => b.source === 'stats.beds.occupancyPct')
    assert.ok(basis)
    assert.strictEqual(basis.raw, stats.beds.occupancyPct)
    assert.ok(out.data.answer.indexOf(String(stats.beds.occupancyPct) + '%') !== -1)
    assert.ok(out.data.answer.indexOf('C02') !== -1, '应说明停用检修床位 C02')
  })

  test('权限收敛：医生问库存/床位提示无权限，护士长可查', () => {
    const stockDenied = ask('库存最低的药品有哪些', DOCTOR)
    assert.ok(stockDenied.data.answer.indexOf('无权限') !== -1)
    const permBasis = stockDenied.data.basis.find((b) => b.source === 'perm.domains.basic')
    assert.ok(permBasis)
    assert.strictEqual(permBasis.raw, 0)

    const bedDenied = ask('床位占用率多少', DOCTOR)
    assert.ok(bedDenied.data.answer.indexOf('无权限') !== -1)

    const nurseAllowed = ask('库存最低的药品有哪些', NURSE)
    assert.strictEqual(nurseAllowed.data.intent, 'stock')
    assert.ok(nurseAllowed.data.answer.indexOf('无权限') === -1)
  })

  test('未识别问题回退能力说明 + followups', () => {
    const out = ask('今天天气怎么样')
    assert.strictEqual(out.data.intent, 'unknown')
    assert.ok(out.data.answer.length > 20)
    assert.ok(out.data.answer.indexOf('暂未识别') !== -1)
    assert.ok(Array.isArray(out.data.followups) && out.data.followups.length >= 1)
    assert.ok(out.data.followups.every((f) => typeof f === 'string' && f.length > 0))
  })

  test('建议入口最多 3 条且均为现有路由', () => {
    const questions = ['今天门诊量多少', '待收费有多少', '今天收入多少', '在院患者有多少', '医生接诊量如何']
    questions.forEach((q) => {
      const out = ask(q)
      assert.ok(out.data.actions.length <= 3, q + ' 的 actions 超过 3 条')
      out.data.actions.forEach((a) => {
        assert.ok(a.label, q + ' 的 action 缺少 label')
        assert.ok(a.path && a.path.charAt(0) === '/', q + ' 的 action path 不合法')
        assert.ok(KNOWN_ROUTES.indexOf(a.path) !== -1, q + ' 的 action 不是现有路由：' + a.path)
      })
    })
  })

  test('输出确定性：连续两次调用 data 深度相等', () => {
    const q = '待收费有多少'
    const first = ask(q)
    const second = ask(q)
    assert.deepStrictEqual(first.data, second.data)
    assert.deepStrictEqual(first.basis, second.basis)
    const ctxA = buildContext(q, ADMIN)
    const ctxB = buildContext(q, ADMIN)
    assert.deepStrictEqual(ctxA.data, ctxB.data)
  })

  test('任务只读：无业务写函数引用、无 db 直连、无网络调用', () => {
    const src = fs.readFileSync(path.join(__dirname, '../../../src/ai/tasks/assistant.js'), 'utf8')
    assert.strictEqual(src.indexOf("require('../mock/db')"), -1, '任务不得直接 require db')
    assert.strictEqual(guardrails.scanSource(src, guardrails.FORBIDDEN_WRITE_PATTERNS).length, 0, '发现写函数引用')
    assert.strictEqual(guardrails.scanSource(src, guardrails.FORBIDDEN_NETWORK_PATTERNS).length, 0, '发现网络调用')
    assert.strictEqual(task.readOnly, true)
  })
}
