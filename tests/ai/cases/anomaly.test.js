// =====================================================================
// B4 用例：anomaly.explain（运营异常分析）
// 覆盖：schema 合法、命中 b12 检修床位 / 待报告积压 / 低库存 medium、
//       级别排序与计数一致、summary 口径、床位占用率与临期规则可触发、
//       级别筛选、角色链接裁剪、输出确定性、只读静态检查。
// 说明：每个 test 前 run-one.js 会执行 db.resetAll()，保证 demoToday=2026-08-28。
// =====================================================================
const assert = require('assert')
const fs = require('fs')
const path = require('path')
const task = require('../../../src/ai/tasks/anomaly')
const contextBuilder = require('../../../src/ai/contextBuilder')
const guardrails = require('../../../src/ai/guardrails')

const ADMIN = { id: 's0', name: '周明远', role: '超级管理员' }
const NURSE = { id: 's11', name: '钱丽华', role: '护士长' }

const LEVEL_WEIGHT = { high: 3, medium: 2, low: 1 }

function build(actor) {
  const input = { scope: 'all' }
  return contextBuilder.build(task, input, actor || ADMIN)
}

function run(ctx, input) {
  return task.generate(ctx, input || { scope: 'all' }, {})
}

function cloneCtx(ctx) {
  return JSON.parse(JSON.stringify(ctx))
}

module.exports = function register({ test, section, db }) {
  section('B4 运营异常分析')

  test('schema 合法且计数与 items 一致', () => {
    const out = run(build())
    const checked = guardrails.validateSchema(out.data, task.outputSchema)
    assert.ok(checked.ok, 'schema 校验失败：' + checked.errors.join('；'))
    assert.ok(Array.isArray(out.data.items))
    assert.strictEqual(out.data.total, out.data.items.length)
    assert.strictEqual(out.data.highCount, out.data.items.filter((i) => i.level === 'high').length)
    assert.strictEqual(out.data.mediumCount, out.data.items.filter((i) => i.level === 'medium').length)
    assert.strictEqual(out.data.lowCount, out.data.items.filter((i) => i.level === 'low').length)
    assert.ok(out.data.items.length > 0, '种子数据下应有可识别异常')
    assert.ok(Array.isArray(out.data.disclaimers) && out.data.disclaimers.length > 0)
    out.data.items.forEach((item) => {
      ;['id', 'type', 'level', 'title', 'reason', 'suggestion'].forEach((key) => {
        assert.ok(item[key], '异常项缺少字段 ' + key)
      })
      assert.ok(item.metric && item.metric.label && item.metric.value, '异常项缺少 metric')
      assert.ok(Array.isArray(item.links), '异常项 links 必须为数组')
      assert.ok(LEVEL_WEIGHT[item.level], '非法级别：' + item.level)
    })
  })

  test('命中种子已知异常：b12 检修床位（high）与待报告积压（medium）', () => {
    const out = run(build())
    const bed = out.data.items.find((i) => i.type === 'bed' && (i.id === 'bed:b12' || i.reason.indexOf('b12') !== -1))
    assert.ok(bed, '未命中 b12 停用/检修床位')
    assert.strictEqual(bed.level, 'high')
    assert.ok(bed.reason.indexOf('C02') !== -1, '检修床位原因应包含 C02')

    const report = out.data.items.find((i) => i.type === 'report')
    assert.ok(report, '未命中待报告积压')
    assert.strictEqual(report.level, 'medium')
    assert.strictEqual(report.metric.value, '2 条')
    assert.strictEqual(db.stats().todo.pendingReports, 2)
  })

  test('低库存阈值：种子无 <50 药品，m4/m6/m10 命中 medium', () => {
    const out = run(build())
    const stockItems = out.data.items.filter((i) => i.type === 'medicine')
    const ids = stockItems.map((i) => i.id).sort()
    assert.deepStrictEqual(ids, ['stock:m10', 'stock:m4', 'stock:m6'])
    stockItems.forEach((item) => {
      assert.strictEqual(item.level, 'medium')
      assert.ok(item.reason.indexOf('50') !== -1 && item.reason.indexOf('200') !== -1, 'reason 应写明阈值口径')
    })
    assert.strictEqual(
      out.data.items.filter((i) => i.type === 'medicine' && i.level === 'high').length,
      0,
      '种子中不存在库存 <50 的药品'
    )
  })

  test('排序：high > medium > low，且同级按 id 稳定', () => {
    const out = run(build())
    const weights = out.data.items.map((i) => LEVEL_WEIGHT[i.level])
    for (let i = 1; i < weights.length; i++) {
      assert.ok(weights[i - 1] >= weights[i], '异常项未按级别降序排列')
    }
    const highs = out.data.items.filter((i) => i.level === 'high')
    assert.strictEqual(highs[0].id, 'bed:b12')
    assert.strictEqual(out.data.highCount, 1)
  })

  test('summary 概述"共 N 项异常，其中高 N 项"并点出关注项', () => {
    const out = run(build())
    assert.ok(out.data.summary.indexOf('共 ' + out.data.total + ' 项异常') !== -1)
    assert.ok(out.data.summary.indexOf('其中高 ' + out.data.highCount + ' 项') !== -1)
    assert.ok(out.data.summary.indexOf('最需关注') !== -1)
    assert.ok(out.data.summary.indexOf('不提供自动处理') !== -1)
  })

  test('床位占用率 >80% 规则可触发（构造高占用上下文）', () => {
    const ctx = cloneCtx(build())
    ctx.data.stats.beds.occupancyPct = 92
    ctx.data.stats.beds.occupied = 11
    const out = run(ctx)
    const occupancy = out.data.items.find((i) => i.id === 'occupancy:all')
    assert.ok(occupancy, '占用率 92% 时未产生占用率异常')
    assert.strictEqual(occupancy.level, 'high')
    assert.strictEqual(occupancy.metric.value, '92%')
    assert.ok(occupancy.reason.indexOf('80%') !== -1, 'reason 应写明 80% 阈值口径')
  })

  test('临期库存规则可触发（构造临期批次上下文）', () => {
    const ctx = cloneCtx(build())
    ctx.data.expiring.push({
      id: 'stTest',
      medicineId: 'm1',
      medicineName: '测试药品',
      batchNo: 'TEST202608',
      expiry: '2026-09-15',
      daysLeft: 18
    })
    const out = run(ctx)
    const expiring = out.data.items.find((i) => i.id === 'expiring:all')
    assert.ok(expiring, '存在临期批次时未产生临期异常')
    assert.strictEqual(expiring.level, 'medium')
    assert.strictEqual(expiring.metric.value, '1 个')
    assert.ok(expiring.reason.indexOf('30 天') !== -1)
  })

  test('级别筛选：input.level=high 时仅返回高优先级项', () => {
    const ctx = build()
    const out = run(ctx, { scope: 'all', level: 'high' })
    assert.strictEqual(out.data.total, out.data.items.length)
    assert.ok(out.data.items.length > 0)
    assert.ok(out.data.items.every((i) => i.level === 'high'))
    assert.strictEqual(out.data.total, out.data.highCount)
    assert.strictEqual(out.data.mediumCount, 0)
    assert.strictEqual(out.data.lowCount, 0)
  })

  test('角色权限裁剪：护士长不出现门诊域处理入口', () => {
    const out = run(build(NURSE))
    const paths = []
    out.data.items.forEach((item) => {
      item.links.forEach((link) => paths.push(link.path))
    })
    assert.ok(paths.length > 0, '护士长应有基础资料/住院域入口')
    paths.forEach((p) => {
      assert.ok(p.indexOf('/outpatient/') !== 0, '护士长无门诊域权限，不应出现门诊入口：' + p)
    })
  })

  test('输出确定性：连续两次调用深度相等', () => {
    const ctx = build()
    const first = run(ctx)
    const second = run(ctx)
    assert.deepStrictEqual(first.data, second.data)
    const ctxA = build()
    const ctxB = build()
    assert.deepStrictEqual(ctxA.data, ctxB.data)
  })

  test('任务只读：无业务写函数引用、无 db 直连、无网络调用', () => {
    const src = fs.readFileSync(path.join(__dirname, '../../../src/ai/tasks/anomaly.js'), 'utf8')
    assert.strictEqual(src.indexOf("require('../mock/db')"), -1, '任务不得直接 require db')
    assert.strictEqual(guardrails.scanSource(src, guardrails.FORBIDDEN_WRITE_PATTERNS).length, 0, '发现写函数引用')
    assert.strictEqual(guardrails.scanSource(src, guardrails.FORBIDDEN_NETWORK_PATTERNS).length, 0, '发现网络调用')
    assert.strictEqual(task.readOnly, true)
  })
}
