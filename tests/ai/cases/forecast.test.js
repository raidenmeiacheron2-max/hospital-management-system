// =====================================================================
// B5 流程预测用例（tests/ai/run-one.js tests/ai/cases/forecast.test.js）
// 覆盖：
//   1. 5 个 forecast.* 任务定义完整、只读、附免责
//   2. 输出 schema 合法、字段齐全、confidence 0.5~0.8、method/note 非空
//   3. 确定性：同一数据重复调用 deepStrictEqual
//   4. 区间合法：lo <= value <= hi 且均为数字
//   5. 门诊量 series：7 日实际 + 次日预测点
//   6. 只读：预测前后业务数据（长度与 JSON）完全不变
//   7. 数值与统计口径可复算（固定 demoToday=2026-08-28 种子）
//   8. fallback 输出结构合法
// 说明：任务由 Lead 在 src/ai/tasks/index.js 注册；本用例直接 require 任务定义，
//       通过 contextBuilder 构建只读上下文，不依赖注册顺序，也不写业务数据。
// =====================================================================
const assert = require('assert')
const tasks = require('../../../src/ai/tasks/forecast')
const contextBuilder = require('../../../src/ai/contextBuilder')
const guardrails = require('../../../src/ai/guardrails')

const TASK_NAMES = [
  'forecast.outpatient',
  'forecast.beds',
  'forecast.discharge',
  'forecast.backlog',
  'forecast.noshow'
]

const BUSINESS_COLLECTIONS = [
  'registrations',
  'visits',
  'admissions',
  'orders',
  'settlements',
  'beds',
  'wards',
  'stocks',
  'medicines',
  'feeRecords',
  'patients',
  'staff',
  'departments',
  'schedules'
]

function buildCtx(task, db) {
  return contextBuilder.build(task, {}, db.getCurrentActor())
}

function runTask(task, db) {
  return task.generate(buildCtx(task, db), {}, {})
}

function taskByName(name) {
  const task = tasks.find(function (t) {
    return t.name === name
  })
  assert.ok(task, '缺少任务定义：' + name)
  return task
}

module.exports = function register({ test, section, db }) {
  section('B5 流程预测')

  test('5 个预测任务定义完整且声明只读、附预测免责', () => {
    assert.strictEqual(tasks.length, 5)
    TASK_NAMES.forEach(function (name) {
      const task = taskByName(name)
      assert.strictEqual(task.batch, 'B5', name + ' batch 应为 B5')
      assert.strictEqual(task.readOnly, true, name + ' 必须声明 readOnly:true')
      assert.ok(task.title && task.title.length > 0, name + ' 缺少 title')
      assert.ok(task.description && task.description.length > 0, name + ' 缺少 description')
      assert.ok(Array.isArray(task.disclaimers) && task.disclaimers.length >= 2, name + ' 免责声明不足')
      assert.ok(task.disclaimers.indexOf(guardrails.DISCLAIMER.FORECAST) !== -1, name + ' 缺少预测免责')
      assert.ok(task.disclaimers.indexOf(guardrails.DISCLAIMER.DEMO) !== -1, name + ' 缺少演示免责')
      assert.strictEqual(typeof task.buildContext, 'function')
      assert.strictEqual(typeof task.generate, 'function')
      assert.strictEqual(typeof task.fallback, 'function')
    })
  })

  test('5 个任务输出 schema 合法且字段齐全（含 confidence/method/note）', () => {
    tasks.forEach(function (task) {
      const out = runTask(task, db)
      const checked = guardrails.validateSchema(out.data, task.outputSchema)
      assert.ok(checked.ok, task.name + ' schema 校验失败：' + checked.errors.join('；'))
      Object.keys(task.outputSchema).forEach(function (key) {
        assert.ok(
          Object.prototype.hasOwnProperty.call(out.data, key),
          task.name + ' 输出缺少字段 ' + key
        )
      })
      assert.strictEqual(typeof out.data.value, 'number', task.name + ' value 应为数字')
      assert.strictEqual(typeof out.data.unit, 'string')
      assert.ok(out.data.unit.length > 0)
      assert.strictEqual(typeof out.data.confidence, 'number')
      assert.ok(
        out.data.confidence >= 0.5 && out.data.confidence <= 0.8,
        task.name + ' confidence 应在 0.5~0.8，实际 ' + out.data.confidence
      )
      assert.ok(typeof out.data.method === 'string' && out.data.method.length > 0, task.name + ' method 为空')
      assert.ok(typeof out.data.note === 'string' && out.data.note.length > 0, task.name + ' note 为空')
      assert.ok(out.data.note.indexOf('演示数据') !== -1, task.name + ' note 缺少"演示数据"')
      assert.ok(out.data.note.indexOf('仅建议') !== -1, task.name + ' note 缺少"仅建议"')
      assert.ok(out.data.note.indexOf('不自动改变数据') !== -1, task.name + ' note 缺少"不自动改变数据"')
      assert.ok(Array.isArray(out.data.disclaimers) && out.data.disclaimers.length >= 2)
      assert.ok(typeof out.text === 'string' && out.text.length > 0, task.name + ' text 为空')
      assert.strictEqual(typeof out.confidence, 'number')
    })
  })

  test('5 个任务确定性：同一数据重复调用结果完全一致', () => {
    tasks.forEach(function (task) {
      const ctx = buildCtx(task, db)
      const first = task.generate(ctx, {}, {})
      const second = task.generate(ctx, {}, {})
      const third = task.generate(ctx, {}, {})
      assert.deepStrictEqual(first.data, second.data, task.name + ' 两次输出不一致')
      assert.deepStrictEqual(first.data, third.data, task.name + ' 多次输出不一致')
      // 重新构建上下文（重读选择器）后结果也应一致
      const again = task.generate(buildCtx(task, db), {}, {})
      assert.deepStrictEqual(first.data, again.data, task.name + ' 重新构建上下文后输出不一致')
    })
  })

  test('5 个任务区间合法：lo <= value <= hi 且均为有限数字', () => {
    tasks.forEach(function (task) {
      const data = runTask(task, db).data
      assert.ok(Array.isArray(data.range), task.name + ' range 应为数组')
      assert.strictEqual(data.range.length, 2, task.name + ' range 应有两个端点')
      assert.strictEqual(typeof data.range[0], 'number')
      assert.strictEqual(typeof data.range[1], 'number')
      assert.ok(isFinite(data.range[0]) && isFinite(data.range[1]))
      assert.ok(data.range[0] <= data.range[1], task.name + ' range 下界应不大于上界')
      assert.ok(
        data.range[0] <= data.value && data.value <= data.range[1],
        task.name + ' 区间不包含主值：[' + data.range.join(', ') + '] vs ' + data.value
      )
      assert.ok(data.value >= 0, task.name + ' 预测值不应为负')
    })
  })

  test('次日门诊量 series：7 日实际 + 次日预测点（2026-08-29）', () => {
    const data = runTask(taskByName('forecast.outpatient'), db).data
    assert.ok(Array.isArray(data.series) && data.series.length === 8, 'series 应为 8 个点')
    const actual = data.series.filter(function (s) {
      return s.kind === 'actual'
    })
    const forecast = data.series.filter(function (s) {
      return s.kind === 'forecast'
    })
    assert.strictEqual(actual.length, 7, '实际点应为 7 个')
    assert.strictEqual(forecast.length, 1, '预测点应为 1 个')
    assert.strictEqual(forecast[0].date, '2026-08-29')
    assert.strictEqual(forecast[0].value, data.value)
    data.series.forEach(function (s) {
      assert.ok(typeof s.date === 'string' && s.date.length === 10, 'series.date 应为 YYYY-MM-DD')
      assert.strictEqual(typeof s.value, 'number')
      assert.ok(s.kind === 'actual' || s.kind === 'forecast')
    })
    // 实际点与 stats().last7days 口径一致
    const days = db.stats().last7days
    actual.forEach(function (s, i) {
      assert.strictEqual(s.date, days[i].date)
      assert.strictEqual(s.value, days[i].regCount)
    })
  })

  test('预测前后业务数据完全不变（只读，长度与 JSON 一致）', () => {
    const beforeJson = JSON.stringify(
      BUSINESS_COLLECTIONS.map(function (name) {
        return db.all(name)
      })
    )
    const beforeLen = BUSINESS_COLLECTIONS.map(function (name) {
      return db.all(name).length
    })
    // 每个任务执行两轮，确认不会累积修改
    tasks.forEach(function (task) {
      runTask(task, db)
      runTask(task, db)
    })
    const afterJson = JSON.stringify(
      BUSINESS_COLLECTIONS.map(function (name) {
        return db.all(name)
      })
    )
    const afterLen = BUSINESS_COLLECTIONS.map(function (name) {
      return db.all(name).length
    })
    assert.strictEqual(afterJson, beforeJson, '预测调用修改了业务数据内容')
    assert.deepStrictEqual(afterLen, beforeLen, '预测调用改变了业务数据行数')
  })

  test('预测数值与统计口径可复算（固定种子 demoToday=2026-08-28）', () => {
    // 门诊量：近 7 日 regCount = 6,4,3,2,2,2,0；加权 (1,1,1,1.5,1.5,2,2)
    // = 23 / 10 = 2.3 -> 四舍五入 2；区间 ±max(1, 20%) -> [1, 3]
    const outpatient = runTask(taskByName('forecast.outpatient'), db).data
    assert.strictEqual(outpatient.value, 2)
    assert.deepStrictEqual(outpatient.range, [1, 3])

    // 床位需求：占用 3 + 待入科 1 + 预计新增 ceil(3/7)=1 - 预计出院 1 = 4；区间 [3, 5]
    const beds = runTask(taskByName('forecast.beds'), db).data
    assert.strictEqual(beds.value, 4)
    assert.deepStrictEqual(beds.range, [3, 5])

    // 出院：待结算 1 + 在院达阈值 0 = 1；区间 [0, 2]
    const discharge = runTask(taskByName('forecast.discharge'), db).data
    assert.strictEqual(discharge.value, 1)
    assert.deepStrictEqual(discharge.range, [0, 2])

    // 积压：待执行医嘱 1 + 待发药 0 + 待出报告 2 = 3；区间 [1, 5]
    const backlog = runTask(taskByName('forecast.backlog'), db).data
    assert.strictEqual(backlog.value, 3)
    assert.deepStrictEqual(backlog.range, [1, 5])

    // 爽约率：退号 2 / 挂号 21 * 100 = 9.5%；区间 [7.5, 11.5]
    const noshow = runTask(taskByName('forecast.noshow'), db).data
    assert.strictEqual(noshow.value, 9.5)
    assert.deepStrictEqual(noshow.range, [7.5, 11.5])
  })

  test('fallback 输出结构与 schema 一致（异常时安全回退）', () => {
    tasks.forEach(function (task) {
      const fb = task.fallback(['模拟 schema 错误'])
      const checked = guardrails.validateSchema(fb, task.outputSchema)
      assert.ok(checked.ok, task.name + ' fallback schema 非法：' + checked.errors.join('；'))
      assert.strictEqual(fb.value, 0)
      assert.deepStrictEqual(fb.range, [0, 0])
      assert.ok(Array.isArray(fb.series))
      assert.ok(Array.isArray(fb.disclaimers) && fb.disclaimers.length > 0)
      assert.ok(typeof fb.method === 'string' && fb.method.length > 0)
      assert.ok(typeof fb.note === 'string' && fb.note.length > 0)
    })
  })
}
