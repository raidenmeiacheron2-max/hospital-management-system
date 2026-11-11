// =====================================================================
// B4 智能报表用例（report.summary）
// 运行：node tests/ai/run-one.js tests/ai/cases/report.test.js
// 覆盖：五类报表 schema/rows、totals 可复算、与 selectors 聚合一致、
//       确定性（两次 deepEqual）、未知类型回退、只读静态断言。
// =====================================================================
const assert = require('assert')
const fs = require('fs')
const path = require('path')
const task = require('../../../src/ai/tasks/report')
const contextBuilder = require('../../../src/ai/contextBuilder')
const guardrails = require('../../../src/ai/guardrails')
const selectors = require('../../../src/ai/selectors')

const TYPES = ['revenue', 'department', 'doctor', 'medicine', 'bed']

module.exports = function register({ test, section, db }) {
  section('B4 智能报表（report.summary）')

  function generate(type) {
    const input = { reportType: type }
    const ctx = contextBuilder.build(task, input, db.getCurrentActor())
    return task.generate(ctx, input, {})
  }

  function assertSchema(out) {
    const check = guardrails.validateSchema(out.data, task.outputSchema)
    assert.ok(check.ok, '输出 schema 非法：' + check.errors.join('；'))
  }

  function paidVisitFeeCents() {
    return db.all('feeRecords')
      .filter((f) => f.status === '已缴费' && f.type === '门诊收费')
      .reduce((a, f) => a + f.amountCents, 0)
  }

  test('五类报表输出结构合法、rows 非空且含摘要/要点/免责', () => {
    TYPES.forEach((type) => {
      const out = generate(type)
      assertSchema(out)
      assert.strictEqual(out.data.reportType, type, '报表类型应为 ' + type)
      assert.ok(out.data.title.length > 0, type + ' 缺少标题')
      assert.ok(Array.isArray(out.data.columns) && out.data.columns.length > 0, type + ' 缺少列定义')
      assert.ok(Array.isArray(out.data.rows) && out.data.rows.length > 0, type + ' rows 不应为空')
      assert.ok(out.data.rows.every((r) => r && typeof r === 'object' && !Array.isArray(r)))
      assert.ok(typeof out.data.totals === 'object' && out.data.totals !== null, type + ' totals 应为对象')
      assert.ok(out.data.summary.length >= 20, type + ' 摘要过短')
      assert.ok(out.data.highlights.length >= 3 && out.data.highlights.length <= 5, type + ' 要点应为 3-5 条')
      assert.ok(out.data.highlights.every((h) => typeof h === 'string' && h.length > 0))
      assert.ok(Array.isArray(out.data.disclaimers) && out.data.disclaimers.length >= 1)
      assert.strictEqual(out.confidence > 0 && out.confidence <= 1, true)
    })
  })

  test('收入报表：totals 与 rows 求和一致，且与 revenueByDepartment 一致', () => {
    const out = generate('revenue')
    const rows = out.data.rows
    const totals = out.data.totals
    assert.strictEqual(rows.reduce((a, r) => a + r.totalCents, 0), totals.totalCents)
    assert.strictEqual(rows.reduce((a, r) => a + r.count, 0), totals.count)
    const selRows = selectors.revenueByDepartment()
    assert.strictEqual(rows.length, selRows.length)
    assert.strictEqual(totals.totalCents, selRows.reduce((a, r) => a + r.totalCents, 0))
    assert.strictEqual(totals.count, selRows.reduce((a, r) => a + r.count, 0))
    rows.forEach((r) => {
      ;['regFeeCents', 'visitFeeCents', 'totalCents'].forEach((k) => {
        assert.ok(Number.isInteger(r[k]), '金额必须为整数分：' + k)
      })
      assert.strictEqual(r.totalCents, r.regFeeCents + r.visitFeeCents)
    })
  })

  test('科室工作量报表：接诊量与收入可复算', () => {
    const out = generate('department')
    const rows = out.data.rows
    const totals = out.data.totals
    assert.strictEqual(rows.reduce((a, r) => a + r.visitCount, 0), totals.visitCount)
    assert.strictEqual(totals.visitCount, db.all('visits').length)
    assert.strictEqual(rows.reduce((a, r) => a + r.revenueCents, 0), totals.revenueCents)
    assert.strictEqual(totals.revenueCents, paidVisitFeeCents())
    rows.forEach((r) => assert.ok(Number.isInteger(r.revenueCents)))
  })

  test('医生接诊量报表：接诊量与收入可复算', () => {
    const out = generate('doctor')
    const rows = out.data.rows
    const totals = out.data.totals
    assert.strictEqual(rows.reduce((a, r) => a + r.visitCount, 0), db.all('visits').length)
    assert.strictEqual(totals.visitCount, db.all('visits').length)
    assert.strictEqual(totals.revenueCents, paidVisitFeeCents())
    assert.strictEqual(totals.doctorCount, selectors.doctorWorkload().length)
    rows.forEach((r) => {
      assert.ok(Number.isInteger(r.visitCount))
      assert.ok(Number.isInteger(r.revenueCents))
    })
  })

  test('药品消耗报表：每行合计 = 处方 + 医嘱，汇总可复算', () => {
    const out = generate('medicine')
    const rows = out.data.rows
    const totals = out.data.totals
    rows.forEach((r) => {
      assert.strictEqual(r.totalQty, r.prescribedQty + r.orderQty)
      assert.ok(Number.isInteger(r.stock))
    })
    assert.strictEqual(rows.reduce((a, r) => a + r.totalQty, 0), totals.totalQty)
    const selRows = selectors.medicineConsumption()
    assert.strictEqual(rows.length, selRows.length)
    assert.strictEqual(totals.totalQty, selRows.reduce((a, r) => a + r.totalQty, 0))
    assert.strictEqual(totals.prescribedQty, selRows.reduce((a, r) => a + r.prescribedQty, 0))
    assert.strictEqual(totals.orderQty, selRows.reduce((a, r) => a + r.orderQty, 0))
  })

  test('床位周转报表：按病区聚合与全院合计可复算', () => {
    const out = generate('bed')
    const rows = out.data.rows
    const totals = out.data.totals
    const beds = db.all('beds')
    const occupied = beds.filter((b) => b.status === '占用').length
    assert.strictEqual(totals.totalBeds, beds.length)
    assert.strictEqual(rows.reduce((a, r) => a + r.totalBeds, 0), beds.length)
    assert.strictEqual(totals.occupied, occupied)
    assert.strictEqual(rows.reduce((a, r) => a + r.occupied, 0), occupied)
    assert.strictEqual(totals.occupancyPct, Math.round((occupied / beds.length) * 100))
    assert.strictEqual(
      rows.reduce((a, r) => a + r.admissions, 0),
      db.all('admissions').filter((a) => a.wardId).length
    )
    rows.forEach((r) => {
      assert.strictEqual(r.occupancyPct, r.totalBeds ? Math.round((r.occupied / r.totalBeds) * 100) : 0)
    })
  })

  test('报表输出确定性：同一数据两次生成 deepEqual', () => {
    TYPES.forEach((type) => {
      const a = generate(type)
      const b = generate(type)
      assert.deepStrictEqual(a.data, b.data, type + ' 两次输出应完全一致')
    })
  })

  test('未知报表类型回退为收入结构，fallback 结构合法', () => {
    const input = { reportType: 'not-a-type' }
    const ctx = contextBuilder.build(task, input, db.getCurrentActor())
    const out = task.generate(ctx, input, {})
    assert.strictEqual(out.data.reportType, 'revenue')
    assertSchema(out)
    assert.ok(out.data.rows.length > 0)

    const fb = task.fallback(['模拟 schema 失败'])
    assertSchema({ data: fb })
    assert.deepStrictEqual(fb.rows, [])
    assert.deepStrictEqual(fb.columns, [])
    assert.ok(fb.summary.length > 0)
    assert.ok(Array.isArray(fb.disclaimers) && fb.disclaimers.length >= 1)
  })

  test('只读断言：任务文件不引用数据层、随机数或网络', () => {
    assert.strictEqual(task.readOnly, true)
    const src = fs.readFileSync(path.join(__dirname, '../../../src/ai/tasks/report.js'), 'utf8')
    assert.ok(src.indexOf('mock/db') === -1, '报表任务不得 require 数据层')
    assert.ok(src.indexOf('Math.random') === -1, '报表任务不得使用随机数')
    assert.ok(src.indexOf('Date.now') === -1, '报表任务不得使用当前时间影响数值')
    const writeHits = guardrails.scanSource(src, guardrails.FORBIDDEN_WRITE_PATTERNS)
    assert.strictEqual(writeHits.length, 0, '不应出现写函数：' + writeHits.map((h) => h.label).join('；'))
    const netHits = guardrails.scanSource(src, guardrails.FORBIDDEN_NETWORK_PATTERNS)
    assert.strictEqual(netHits.length, 0, '不应出现网络调用：' + netHits.map((h) => h.label).join('；'))
  })
}
