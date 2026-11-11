// =====================================================================
// B5 流程预测任务（forecast.*，对应 INNOVATION_PLAN I9 与 AI_ARCHITECTURE §3）
//
// 五个只读预测任务：
//   1) forecast.outpatient  次日门诊量（人次）
//   2) forecast.beds       次日床位需求（张）
//   3) forecast.discharge  未来 3 日预计出院（人）
//   4) forecast.backlog    次日医嘱/发药积压（项）
//   5) forecast.noshow     挂号爽约风险率（%）
//
// 红线（AI_ARCHITECTURE §0）：
//   - 只读：本文件不 require 业务数据层，只消费 contextBuilder 注入的
//     只读选择器结果（sel.* 深拷贝 + 脱敏），不调用任何写函数（G1）。
//   - 默认离线：不发起任何网络请求（G7）。
//   - 确定性：固定 demoToday=2026-08-28 与同一份数据下，重复调用结果完全一致；
//     数值计算不使用 Math.random()/Date.now()，日期全部由 ctx.demoToday 推导。
//   - 仅建议：预测不自动改变任何业务数据；输出附演示/预测免责声明（G3）。
//
// 输出契约（每任务 outputSchema 相同，另附 breakdown 计算明细便于页面"可复算"）：
//   { value:number, unit:string, range:[lo,hi], method:string,
//     confidence:number(0.5~0.8), note:string, series:array<object>, disclaimers:array }
// =====================================================================
const guardrails = require('../guardrails')

const DAY_MS = 86400000

// 门诊量加权移动平均权重（由旧到新：最近一日权重最高）
const REG_WEIGHTS = [1, 1, 1, 1.5, 1.5, 2, 2]
const REG_WEIGHT_TEXT = '1,1,1,1.5,1.5,2,2'

// note 固定口径：演示数据、仅建议、不自动改变数据
const NOTE_BASE = '演示数据、仅建议、不自动改变数据'

const DISCLAIMERS = [guardrails.DISCLAIMER.DEMO, guardrails.DISCLAIMER.FORECAST]

const OUTPUT_SCHEMA = {
  value: 'number',
  unit: 'string',
  range: 'array<number>',
  method: 'string',
  confidence: 'number',
  note: 'string',
  series: 'array<object>',
  disclaimers: 'array'
}

// ---------- 纯函数工具（无副作用、无时间依赖） ----------
function pad2(n) {
  return n < 10 ? '0' + n : String(n)
}

function parseDate(dateStr) {
  return new Date(String(dateStr || '').slice(0, 10) + 'T00:00:00')
}

function formatDate(d) {
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate())
}

/** 'YYYY-MM-DD' 加减天数（本地日期运算，与运行环境时区无关） */
function addDays(dateStr, days) {
  const d = parseDate(dateStr)
  if (isNaN(d.getTime())) return ''
  d.setDate(d.getDate() + (Number(days) || 0))
  return formatDate(d)
}

/** a - b 的自然日差（a、b 均为 'YYYY-MM-DD'） */
function diffDays(a, b) {
  const da = parseDate(a)
  const dbDate = parseDate(b)
  if (isNaN(da.getTime()) || isNaN(dbDate.getTime())) return 0
  return Math.round((da.getTime() - dbDate.getTime()) / DAY_MS)
}

function round1(n) {
  return Math.round((Number(n) || 0) * 10) / 10
}

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100
}

/** 日期是否落在闭区间 [start, end]（'YYYY-MM-DD' 字符串可直接比较） */
function inWindow(date, start, end) {
  const d = String(date || '').slice(0, 10)
  return !!d && d >= start && d <= end
}

/** 加权移动平均；权重与数值按"最近对齐"取尾部 */
function weightedAverage(values, weights) {
  const list = Array.isArray(values) ? values : []
  let sum = 0
  let weightSum = 0
  for (let i = 0; i < list.length; i++) {
    const w = Number(weights[i]) || 0
    sum += (Number(list[i]) || 0) * w
    weightSum += w
  }
  return weightSum ? sum / weightSum : 0
}

/** 按序列长度截取尾部权重（序列恒为 7 日时即全部权重） */
function weightsFor(n) {
  const size = Math.max(0, Math.min(REG_WEIGHTS.length, Number(n) || 0))
  return REG_WEIGHTS.slice(REG_WEIGHTS.length - size)
}

/** 置信度：按样本量折算，限定在 0.5~0.8（确定性，不随运行时间变化） */
function confidenceOf(sampleSize) {
  const n = Math.max(0, Number(sampleSize) || 0)
  return round2(0.5 + Math.min(0.3, n * 0.02))
}

function note(extra) {
  return extra ? NOTE_BASE + '；' + extra : NOTE_BASE
}

/** 7 日观测窗口：优先用 stats().last7days 的日期，缺失时由 demoToday 推导 */
function windowOf(series, demoToday) {
  const list = Array.isArray(series) ? series : []
  if (list.length) {
    return {
      start: String(list[0].date || '').slice(0, 10),
      end: String(list[list.length - 1].date || '').slice(0, 10)
    }
  }
  return { start: addDays(demoToday, -6), end: demoToday }
}

function datesOf(series, demoToday) {
  const list = Array.isArray(series) ? series : []
  if (list.length) {
    return list.map(function (s) {
      return String(s.date || '').slice(0, 10)
    })
  }
  const out = []
  for (let i = 6; i >= 0; i--) out.push(addDays(demoToday, -i))
  return out
}

/** 住院天数（>=0；admitAt 为 'YYYY-MM-DD HH:mm' 或 'YYYY-MM-DD'） */
function stayDays(admitAt, demoToday) {
  const d = String(admitAt || '').slice(0, 10)
  if (!d || !demoToday) return 0
  const n = diffDays(demoToday, d)
  return n > 0 ? n : 0
}

/** G2 回退输出：结构与 outputSchema 一致（value 0、区间 [0,0]） */
function makeFallback(unit) {
  return function () {
    return {
      value: 0,
      unit: unit,
      range: [0, 0],
      method: '输出未通过结构校验，已回退为"暂无预测"。',
      confidence: 0,
      note: '输出未通过结构校验，已回退为"暂无预测"；' + NOTE_BASE + '。',
      series: [],
      disclaimers: DISCLAIMERS.slice(),
      breakdown: []
    }
  }
}

// =====================================================================
// 1) 次日门诊量预测（人次）
// 口径：最近 7 日 regCount 加权移动平均（权重 1,1,1,1.5,1.5,2,2 由旧到新），
//       四舍五入取整；区间 ±max(1, 20%)。
// =====================================================================
const outpatient = {
  name: 'forecast.outpatient',
  title: '次日门诊量预测',
  batch: 'B5',
  readOnly: true,
  description: '基于最近 7 日门诊挂号量（不含已退号）的加权移动平均，预测次日门诊量并给出区间',
  disclaimers: DISCLAIMERS.slice(),
  outputSchema: OUTPUT_SCHEMA,
  buildContext: function (sel) {
    return { series: sel.registrationSeries() }
  },
  generate: function (ctx) {
    const series = (ctx.data && ctx.data.series) || []
    const values = series.map(function (s) {
      return Number(s.regCount) || 0
    })
    const weighted = weightedAverage(values, weightsFor(values.length))
    const value = Math.round(weighted)
    const margin = Math.max(1, Math.round(value * 0.2))
    const lo = Math.max(0, value - margin)
    const hi = value + margin
    const nextDate = addDays(ctx.demoToday, 1)

    const outSeries = series.map(function (s) {
      return { date: String(s.date || '').slice(0, 10), value: Number(s.regCount) || 0, kind: 'actual' }
    })
    outSeries.push({ date: nextDate, value: value, kind: 'forecast' })

    const confidence = confidenceOf(series.length)
    const method =
      '最近 7 日门诊量加权移动平均（权重 ' +
      REG_WEIGHT_TEXT +
      '，由旧到新、最近一日权重最高；取 stats().last7days 的 regCount，不含已退号），四舍五入取整；区间 ±max(1, 20%)。'

    const data = {
      value: value,
      unit: '人次',
      range: [lo, hi],
      method: method,
      confidence: confidence,
      note: note('预测目标日 ' + nextDate + '，可用于排班与号源参考'),
      series: outSeries,
      disclaimers: DISCLAIMERS.slice(),
      breakdown: [
        { label: '近 7 日实际', value: values.join(' / ') },
        { label: '加权均值', value: round2(weighted) },
        { label: '次日预测', value: value }
      ]
    }
    const text =
      '次日（' +
      nextDate +
      '）门诊量预测约 ' +
      value +
      ' 人次（区间 ' +
      lo +
      '~' +
      hi +
      ' 人次），' +
      NOTE_BASE +
      '。'
    return {
      text: text,
      confidence: confidence,
      basis: [
        { label: '演示基准日', value: ctx.demoToday },
        { label: '近 7 日实际门诊量', value: values.join(' / ') },
        { label: '加权均值', value: String(round2(weighted)) }
      ],
      data: data
    }
  },
  fallback: makeFallback('人次')
}

// =====================================================================
// 2) 次日床位需求预测（张）
// 口径：床位需求 = 当前占用床位 + 待入科 + 预计新增入院 - 预计出院
//   预计新增入院 = ceil(近 7 日新增入院数 ÷ 7)（向上取整，为床位预留余量）
//   预计出院     = 待结算人数 + 在院且住院天数 ≥ 平均住院日-1 天的人数
// 区间 ±1 张。
// =====================================================================
const beds = {
  name: 'forecast.beds',
  title: '次日床位需求预测',
  batch: 'B5',
  readOnly: true,
  description: '按"占用 + 待入科 + 预计新增入院 - 预计出院"复算次日床位需求（张）',
  disclaimers: DISCLAIMERS.slice(),
  outputSchema: OUTPUT_SCHEMA,
  buildContext: function (sel) {
    return {
      turnover: sel.bedTurnover(),
      admissions: sel.all('admissions')
    }
  },
  generate: function (ctx) {
    const turnover = (ctx.data && ctx.data.turnover) || {}
    const admissions = (ctx.data && ctx.data.admissions) || []
    const today = ctx.demoToday || ''

    const occupied = Number(turnover.occupied) || 0
    const pendingAdmit = Number(turnover.pendingAdmit) || 0
    const pendingSettle = Number(turnover.pendingSettle) || 0

    const window = windowOf(null, today)
    const recentAdmits = admissions.filter(function (a) {
      return inWindow(a.createdAt, window.start, window.end)
    }).length
    const expectedNewAdmits = Math.ceil(recentAdmits / 7)

    const avgStay = Number(turnover.avgStayDays) || 0
    const nearThreshold = avgStay > 0 ? Math.max(1, Math.floor(avgStay) - 1) : 1
    const inWardNearAvg = admissions.filter(function (a) {
      return a.status === '在院' && stayDays(a.admitAt, today) >= nearThreshold
    }).length
    const expectedDischarge = pendingSettle + inWardNearAvg

    const value = Math.max(0, occupied + pendingAdmit + expectedNewAdmits - expectedDischarge)
    const margin = 1
    const lo = Math.max(0, value - margin)
    const hi = value + margin
    const confidence = confidenceOf(7)

    const stayRuleText =
      avgStay > 0
        ? '在院且住院天数 ≥ 平均住院日 ' + avgStay + ' 天 - 1 天 = ' + nearThreshold + ' 天'
        : '在院且住院天数 ≥ 1 天（暂无已出院样本）'

    const method =
      '次日床位需求 = 当前占用床位 ' +
      occupied +
      ' 张 + 待入科 ' +
      pendingAdmit +
      ' 张 + 预计新增入院 ' +
      expectedNewAdmits +
      ' 张（近 7 日新增入院 ' +
      recentAdmits +
      ' 例 ÷ 7 向上取整，为床位预留余量）- 预计出院 ' +
      expectedDischarge +
      ' 张（待结算 ' +
      pendingSettle +
      ' 例 + 满足「' +
      stayRuleText +
      '」的 ' +
      inWardNearAvg +
      ' 例）；区间 ±1 张。'

    const data = {
      value: value,
      unit: '张',
      range: [lo, hi],
      method: method,
      confidence: confidence,
      note: note('需求为次日全院床位占用预测，不包含停用床位'),
      series: [],
      disclaimers: DISCLAIMERS.slice(),
      breakdown: [
        { label: '当前占用', value: occupied },
        { label: '待入科', value: pendingAdmit },
        { label: '预计新增入院', value: expectedNewAdmits },
        { label: '预计出院', value: expectedDischarge }
      ]
    }
    const text =
      '次日床位需求预测约 ' +
      value +
      ' 张（区间 ' +
      lo +
      '~' +
      hi +
      ' 张），计算：占用 ' +
      occupied +
      ' + 待入科 ' +
      pendingAdmit +
      ' + 预计新增 ' +
      expectedNewAdmits +
      ' - 预计出院 ' +
      expectedDischarge +
      '；' +
      NOTE_BASE +
      '。'
    return {
      text: text,
      confidence: confidence,
      basis: [
        { label: '演示基准日', value: today },
        { label: '当前占用床位', value: String(occupied) },
        { label: '近 7 日新增入院', value: String(recentAdmits) },
        { label: '预计出院', value: String(expectedDischarge) }
      ],
      data: data
    }
  },
  fallback: makeFallback('张')
}

// =====================================================================
// 3) 未来 3 日预计出院（人）
// 口径：待结算患者（已申请出院、等待结算离院）+ 在院且住院天数达到
//       "平均住院日 - 1 天"阈值的患者；区间 ±1 人。
// =====================================================================
const discharge = {
  name: 'forecast.discharge',
  title: '未来 3 日预计出院',
  batch: 'B5',
  readOnly: true,
  description: '统计待结算与接近平均住院日的在院患者，预测未来 3 日出院人数',
  disclaimers: DISCLAIMERS.slice(),
  outputSchema: OUTPUT_SCHEMA,
  buildContext: function (sel) {
    return {
      turnover: sel.bedTurnover(),
      admissions: sel.all('admissions')
    }
  },
  generate: function (ctx) {
    const turnover = (ctx.data && ctx.data.turnover) || {}
    const admissions = (ctx.data && ctx.data.admissions) || []
    const today = ctx.demoToday || ''

    const pendingSettle = Number(turnover.pendingSettle) || 0
    const avgStay = Number(turnover.avgStayDays) || 0
    const nearThreshold = avgStay > 0 ? Math.max(1, Math.floor(avgStay) - 1) : 1
    const inWardNearAvg = admissions.filter(function (a) {
      return a.status === '在院' && stayDays(a.admitAt, today) >= nearThreshold
    }).length

    const value = pendingSettle + inWardNearAvg
    const margin = 1
    const lo = Math.max(0, value - margin)
    const hi = value + margin

    const sample = (Number(turnover.discharged) || 0) + (Number(turnover.inWard) || 0) + pendingSettle
    const confidence = confidenceOf(sample)

    const stayRuleText =
      avgStay > 0
        ? '在院且住院天数 ≥ 平均住院日 ' + avgStay + ' 天 - 1 天 = ' + nearThreshold + ' 天'
        : '在院且住院天数 ≥ 1 天（暂无已出院样本）'

    const method =
      '未来 3 日预计出院 = 待结算患者 ' +
      pendingSettle +
      ' 人 + 满足「' +
      stayRuleText +
      '」的患者 ' +
      inWardNearAvg +
      ' 人 = ' +
      value +
      ' 人；区间 ±1 人。'

    const data = {
      value: value,
      unit: '人',
      range: [lo, hi],
      method: method,
      confidence: confidence,
      note: note('待结算患者已申请出院、等待结算后离院；预测窗口为 ' + today + ' 起 3 日'),
      series: [],
      disclaimers: DISCLAIMERS.slice(),
      breakdown: [
        { label: '待结算', value: pendingSettle },
        { label: '在院达阈值', value: inWardNearAvg },
        { label: '预计出院', value: value }
      ]
    }
    const text =
      '未来 3 日预计出院约 ' +
      value +
      ' 人（区间 ' +
      lo +
      '~' +
      hi +
      ' 人），其中待结算 ' +
      pendingSettle +
      ' 人、在院接近平均住院日 ' +
      inWardNearAvg +
      ' 人；' +
      NOTE_BASE +
      '。'
    return {
      text: text,
      confidence: confidence,
      basis: [
        { label: '演示基准日', value: today },
        { label: '待结算患者', value: String(pendingSettle) },
        { label: '平均住院日', value: avgStay > 0 ? avgStay + ' 天' : '暂无样本' },
        { label: '在院达阈值', value: String(inWardNearAvg) }
      ],
      data: data
    }
  },
  fallback: makeFallback('人')
}

// =====================================================================
// 4) 次日医嘱/发药积压（项）
// 口径：待执行住院医嘱 + 已收费待发药处方 + 待出检查报告；区间 ±2 项。
// 趋势：orders 按 createdAt / executedAt 聚合近 7 日新增与已执行数量。
// =====================================================================
const backlog = {
  name: 'forecast.backlog',
  title: '次日医嘱/发药积压',
  batch: 'B5',
  readOnly: true,
  description: '汇总待执行医嘱、待发药处方与待出报告，预测次日待处理积压项',
  disclaimers: DISCLAIMERS.slice(),
  outputSchema: OUTPUT_SCHEMA,
  buildContext: function (sel) {
    return {
      stats: sel.stats(),
      orders: sel.all('orders'),
      pendingOrders: sel.pendingOrders(),
      pendingDispense: sel.pendingVisits('dispense'),
      pendingReports: sel.pendingVisits('report')
    }
  },
  generate: function (ctx) {
    const data = ctx.data || {}
    const stats = data.stats || {}
    const orders = data.orders || []
    const pendingOrderCount = (data.pendingOrders || []).length
    const pendingDispenseCount = (data.pendingDispense || []).length
    const pendingReportCount = (data.pendingReports || []).length

    const value = pendingOrderCount + pendingDispenseCount + pendingReportCount
    const margin = 2
    const lo = Math.max(0, value - margin)
    const hi = value + margin
    const confidence = confidenceOf(orders.length)

    const dates = datesOf(stats.last7days, ctx.demoToday)
    const series = dates.map(function (d) {
      const created = orders.filter(function (o) {
        return String(o.createdAt || '').slice(0, 10) === d
      }).length
      const executed = orders.filter(function (o) {
        return o.status === '已执行' && String(o.executedAt || '').slice(0, 10) === d
      }).length
      return { date: d, created: created, executed: executed }
    })

    const method =
      '次日积压 = 待执行住院医嘱 ' +
      pendingOrderCount +
      ' 项 + 已收费待发药处方 ' +
      pendingDispenseCount +
      ' 项 + 待出检查报告 ' +
      pendingReportCount +
      ' 项 = ' +
      value +
      ' 项；趋势为 orders 按 createdAt / executedAt 聚合近 7 日新增与已执行数量；区间 ±2 项。'

    const outData = {
      value: value,
      unit: '项',
      range: [lo, hi],
      method: method,
      confidence: confidence,
      note: note('积压项需由对应科室按原有流程处理，AI 不代为执行'),
      series: series,
      disclaimers: DISCLAIMERS.slice(),
      breakdown: [
        { label: '待执行医嘱', value: pendingOrderCount },
        { label: '待发药处方', value: pendingDispenseCount },
        { label: '待出报告', value: pendingReportCount }
      ]
    }
    const text =
      '次日医嘱/发药积压约 ' +
      value +
      ' 项（区间 ' +
      lo +
      '~' +
      hi +
      ' 项）：待执行医嘱 ' +
      pendingOrderCount +
      '、待发药处方 ' +
      pendingDispenseCount +
      '、待出报告 ' +
      pendingReportCount +
      '；' +
      NOTE_BASE +
      '。'
    return {
      text: text,
      confidence: confidence,
      basis: [
        { label: '演示基准日', value: ctx.demoToday },
        { label: '待执行医嘱', value: String(pendingOrderCount) },
        { label: '待发药处方', value: String(pendingDispenseCount) },
        { label: '待出报告', value: String(pendingReportCount) }
      ],
      data: outData
    }
  },
  fallback: makeFallback('项')
}

// =====================================================================
// 5) 挂号爽约风险率（%）
// 口径：近 7 日退号数 ÷ 挂号总数 × 100（保留 1 位小数，以退号作为爽约代理指标）；
//       区间 ±2 个百分点。
// =====================================================================
const noshow = {
  name: 'forecast.noshow',
  title: '挂号爽约风险率',
  batch: 'B5',
  readOnly: true,
  description: '按近 7 日退号占挂号总数比例，估计挂号爽约风险率（%）',
  disclaimers: DISCLAIMERS.slice(),
  outputSchema: OUTPUT_SCHEMA,
  buildContext: function (sel) {
    return {
      series: sel.registrationSeries(),
      registrations: sel.all('registrations')
    }
  },
  generate: function (ctx) {
    const series = (ctx.data && ctx.data.series) || []
    const registrations = (ctx.data && ctx.data.registrations) || []
    const window = windowOf(series, ctx.demoToday)
    const dates = datesOf(series, ctx.demoToday)

    const scoped = registrations.filter(function (r) {
      return inWindow(r.date, window.start, window.end)
    })
    const total = scoped.length
    const cancelled = scoped.filter(function (r) {
      return r.regStatus === '已退号'
    }).length
    const value = total ? round1((cancelled / total) * 100) : 0
    const margin = 2
    const lo = round1(Math.max(0, value - margin))
    const hi = round1(Math.min(100, value + margin))
    const confidence = confidenceOf(total)

    const daySeries = dates.map(function (d) {
      const dayRegs = registrations.filter(function (r) {
        return String(r.date || '').slice(0, 10) === d
      })
      const dayTotal = dayRegs.length
      const dayCancelled = dayRegs.filter(function (r) {
        return r.regStatus === '已退号'
      }).length
      return {
        date: d,
        total: dayTotal,
        cancelled: dayCancelled,
        rate: dayTotal ? round1((dayCancelled / dayTotal) * 100) : 0
      }
    })

    const method =
      '近 7 日挂号爽约风险率 = 退号数 ' +
      cancelled +
      ' ÷ 挂号总数 ' +
      total +
      ' × 100 = ' +
      value +
      '%（以退号作为爽约代理指标，按挂号日期统计，含已退号）；区间 ±2 个百分点。'

    const data = {
      value: value,
      unit: '%',
      range: [lo, hi],
      method: method,
      confidence: confidence,
      note: note('爽约率用于提示挂号资源浪费风险，不改变挂号与退号数据'),
      series: daySeries,
      disclaimers: DISCLAIMERS.slice(),
      breakdown: [
        { label: '近 7 日挂号', value: total },
        { label: '近 7 日退号', value: cancelled },
        { label: '风险率', value: value + '%' }
      ]
    }
    const text =
      '近 7 日挂号爽约风险率约 ' +
      value +
      '%（区间 ' +
      lo +
      '~' +
      hi +
      '%）：退号 ' +
      cancelled +
      ' / 挂号 ' +
      total +
      '；' +
      NOTE_BASE +
      '。'
    return {
      text: text,
      confidence: confidence,
      basis: [
        { label: '演示基准日', value: ctx.demoToday },
        { label: '近 7 日挂号总数', value: String(total) },
        { label: '近 7 日退号数', value: String(cancelled) }
      ],
      data: data
    }
  },
  fallback: makeFallback('%')
}

module.exports = [outpatient, beds, discharge, backlog, noshow]
