// =====================================================================
// 任务：report.summary（B4 · 智能报表，对应 I7）
// 用途：把只读选择器的聚合结果整理为「收入结构 / 科室工作量 / 医生接诊量 /
//       药品消耗 / 床位周转」五类报表，并生成确定性的中文摘要与要点。
// 红线（AI_ARCHITECTURE §0）：
//   - 只读：只通过 selectors 读取，不直接引用数据层模块，不调用任何业务写函数；
//   - 确定性：不使用随机数或当前时间影响数值，同一数据下输出稳定；
//   - 金额保持整数分（展示层再转元），rows 求和必须等于 totals（可复算）；
//   - 未知 reportType 回退为 revenue，保证输出结构始终合法。
// 说明：本文件只导出任务定义，由 tasks/index.js 统一注册（不由任务自身注册）。
// =====================================================================
const guardrails = require('../guardrails')

// 报表类型元信息（顺序即 UI tab 顺序）
const TYPE_META = {
  revenue: { label: '收入结构', title: '收入结构报表' },
  department: { label: '科室工作量', title: '科室工作量报表' },
  doctor: { label: '医生接诊量', title: '医生接诊量报表' },
  medicine: { label: '药品消耗', title: '药品消耗报表' },
  bed: { label: '床位周转', title: '床位周转报表' }
}
const TYPE_LIST = Object.keys(TYPE_META)
const DEFAULT_TYPE = 'revenue'

// 各报表列定义：money:true 表示数据为整数分，由 UI 用 fmtMoney 转元展示
const COLUMNS = {
  revenue: [
    { prop: 'departmentName', label: '科室' },
    { prop: 'regFeeCents', label: '挂号费(元)', align: 'right', money: true },
    { prop: 'visitFeeCents', label: '门诊收费(元)', align: 'right', money: true },
    { prop: 'totalCents', label: '合计(元)', align: 'right', money: true },
    { prop: 'count', label: '收费笔数', align: 'right' }
  ],
  department: [
    { prop: 'departmentName', label: '科室' },
    { prop: 'visitCount', label: '接诊量(人次)', align: 'right' },
    { prop: 'revenueCents', label: '门诊收入(元)', align: 'right', money: true }
  ],
  doctor: [
    { prop: 'doctorName', label: '医生' },
    { prop: 'departmentName', label: '科室' },
    { prop: 'visitCount', label: '接诊量(人次)', align: 'right' },
    { prop: 'revenueCents', label: '门诊收入(元)', align: 'right', money: true }
  ],
  medicine: [
    { prop: 'medicineName', label: '药品' },
    { prop: 'unit', label: '单位' },
    { prop: 'prescribedQty', label: '处方消耗', align: 'right' },
    { prop: 'orderQty', label: '医嘱消耗', align: 'right' },
    { prop: 'totalQty', label: '合计消耗', align: 'right' },
    { prop: 'stock', label: '当前库存', align: 'right' }
  ],
  bed: [
    { prop: 'wardName', label: '病区' },
    { prop: 'totalBeds', label: '床位数', align: 'right' },
    { prop: 'occupied', label: '占用', align: 'right' },
    { prop: 'idle', label: '空闲', align: 'right' },
    { prop: 'occupancyPct', label: '占用率', align: 'right' },
    { prop: 'admissions', label: '入院数', align: 'right' }
  ]
}

// ---------- 通用数值/文本工具（纯函数，保证确定性） ----------
function toInt(v) {
  const n = Number(v)
  return isFinite(n) ? Math.round(n) : 0
}

function sumBy(rows, key) {
  return (rows || []).reduce(function (acc, row) {
    return acc + toInt(row && row[key])
  }, 0)
}

/** 整数分 -> "1234.56"（不依赖 ES Module 的 utils/money，供纯 Node 测试直接 require） */
function centsToYuanText(cents) {
  const n = toInt(cents)
  const sign = n < 0 ? '-' : ''
  const abs = Math.abs(n)
  const yuan = Math.floor(abs / 100)
  const fen = String(abs % 100).padStart(2, '0')
  return sign + yuan + '.' + fen
}

function moneyText(cents) {
  return '¥' + centsToYuanText(cents)
}

/** 占比（保留 1 位小数，0 分母返回 0） */
function pct(part, total) {
  if (!total) return 0
  return Math.round((part / total) * 1000) / 10
}

function normalizeType(value) {
  const s = String(value === undefined || value === null ? '' : value).trim()
  return TYPE_LIST.indexOf(s) !== -1 ? s : DEFAULT_TYPE
}

/** 近 7 日挂号量趋势（数据来自 stats().last7days，演示口径） */
function trendText(series) {
  const list = Array.isArray(series) ? series : []
  if (!list.length) return ''
  const from = toInt(list[0] && list[0].regCount)
  const to = toInt(list[list.length - 1] && list[list.length - 1].regCount)
  const diff = to - from
  const word = diff > 0 ? '上升' : diff < 0 ? '下降' : '持平'
  return '近 7 日挂号量 ' + from + ' → ' + to + ' 人次（' + word + '，演示口径）'
}

function compact(list) {
  return (list || []).filter(function (x) {
    return typeof x === 'string' && x.length > 0
  }).slice(0, 5)
}

// ---------- 五类报表构建 ----------
function buildRevenue(rowsIn, series) {
  const rows = (rowsIn || []).map(function (r) {
    return {
      departmentName: String((r && r.departmentName) || '未知科室'),
      regFeeCents: toInt(r && r.regFeeCents),
      visitFeeCents: toInt(r && r.visitFeeCents),
      totalCents: toInt(r && r.totalCents),
      count: toInt(r && r.count)
    }
  })
  const totals = {
    totalCents: sumBy(rows, 'totalCents'),
    count: sumBy(rows, 'count'),
    regFeeCents: sumBy(rows, 'regFeeCents'),
    visitFeeCents: sumBy(rows, 'visitFeeCents')
  }
  const top = rows[0] || null
  const bottom = rows.length > 1 ? rows[rows.length - 1] : null
  const top3 = rows.slice(0, 3)
  const top3Cents = sumBy(top3, 'totalCents')
  const highlights = compact([
    top ? '收入最高科室：' + top.departmentName + '（' + moneyText(top.totalCents) + '，占 ' + pct(top.totalCents, totals.totalCents) + '%）' : '',
    bottom ? '收入最低科室：' + bottom.departmentName + '（' + moneyText(bottom.totalCents) + '）' : '',
    top3.length ? '集中度：前 ' + top3.length + ' 个科室合计占 ' + pct(top3Cents, totals.totalCents) + '%' : '',
    trendText(series),
    totals.count ? '已缴费记录 ' + totals.count + ' 笔，平均每笔 ' + moneyText(Math.round(totals.totalCents / totals.count)) : ''
  ])
  return { rows: rows, totals: totals, highlights: highlights }
}

function revenueSummary(demoToday, built) {
  const rows = built.rows
  const totals = built.totals
  if (!rows.length) return '演示基准日 ' + demoToday + '，暂无可统计的已缴费收入数据。'
  const top = rows[0]
  const bottom = rows[rows.length - 1]
  return (
    '演示基准日 ' + demoToday + '，收入结构报表覆盖 ' + rows.length + ' 个科室、' + totals.count +
    ' 笔已缴费记录，合计收入 ' + moneyText(totals.totalCents) + '（数据层金额为整数分，展示与导出时转换为元）。' +
    '收入最高的科室为' + top.departmentName + '（' + moneyText(top.totalCents) + '，占 ' +
    pct(top.totalCents, totals.totalCents) + '%），最低为' + bottom.departmentName + '（' + moneyText(bottom.totalCents) + '）。' +
    '口径：仅统计已缴费的挂号费与门诊收费，按收费归属科室归集；数据为虚构演示数据。'
  )
}

function buildDepartment(visitsIn, feeRecordsIn, departmentsMap, series) {
  const feeByVisit = {}
  ;(feeRecordsIn || []).forEach(function (f) {
    if (!f || f.status !== '已缴费' || f.type !== '门诊收费') return
    feeByVisit[f.refId] = (feeByVisit[f.refId] || 0) + toInt(f.amountCents)
  })
  const buckets = {}
  ;(visitsIn || []).forEach(function (v) {
    if (!v) return
    const depId = v.departmentId || ''
    const dep = (departmentsMap && departmentsMap[depId]) || {}
    if (!buckets[depId]) {
      buckets[depId] = {
        departmentName: dep.name || '未知科室',
        visitCount: 0,
        revenueCents: 0
      }
    }
    buckets[depId].visitCount += 1
    buckets[depId].revenueCents += feeByVisit[v.id] || 0
  })
  const rows = Object.keys(buckets).map(function (k) {
    return buckets[k]
  }).sort(function (a, b) {
    if (b.visitCount !== a.visitCount) return b.visitCount - a.visitCount
    if (b.revenueCents !== a.revenueCents) return b.revenueCents - a.revenueCents
    return a.departmentName < b.departmentName ? -1 : a.departmentName > b.departmentName ? 1 : 0
  })
  const totals = {
    visitCount: sumBy(rows, 'visitCount'),
    revenueCents: sumBy(rows, 'revenueCents')
  }
  const top = rows[0] || null
  const bottom = rows.length > 1 ? rows[rows.length - 1] : null
  const highlights = compact([
    top ? '接诊量最高科室：' + top.departmentName + '（' + top.visitCount + ' 人次，收入 ' + moneyText(top.revenueCents) + '）' : '',
    bottom ? '接诊量最低科室：' + bottom.departmentName + '（' + bottom.visitCount + ' 人次）' : '',
    totals.visitCount ? '平均每次接诊门诊收入 ' + moneyText(Math.round(totals.revenueCents / totals.visitCount)) : '',
    trendText(series)
  ])
  return { rows: rows, totals: totals, highlights: highlights }
}

function departmentSummary(demoToday, built) {
  const rows = built.rows
  const totals = built.totals
  if (!rows.length) return '演示基准日 ' + demoToday + '，暂无可统计的科室工作量数据。'
  const top = rows[0]
  const bottom = rows[rows.length - 1]
  return (
    '演示基准日 ' + demoToday + '，科室工作量报表覆盖 ' + rows.length + ' 个科室，共接诊 ' + totals.visitCount +
    ' 人次，已缴费门诊收入合计 ' + moneyText(totals.revenueCents) + '（整数分转元展示）。' +
    '接诊量最高为' + top.departmentName + '（' + top.visitCount + ' 人次），最低为' + bottom.departmentName + '（' + bottom.visitCount + ' 人次）。' +
    '口径：接诊量取全部门诊接诊记录，收入取已缴费门诊收费并按接诊科室归集（不含挂号费）；数据为虚构演示数据。'
  )
}

function buildDoctor(rowsIn) {
  const rows = (rowsIn || []).map(function (r) {
    return {
      doctorName: String((r && r.doctorName) || '未知医生'),
      departmentName: String((r && r.departmentName) || '未知科室'),
      visitCount: toInt(r && r.visitCount),
      revenueCents: toInt(r && r.revenueCents)
    }
  })
  const totals = {
    doctorCount: rows.length,
    visitCount: sumBy(rows, 'visitCount'),
    revenueCents: sumBy(rows, 'revenueCents')
  }
  const top = rows[0] || null
  const bottom = rows.length > 1 ? rows[rows.length - 1] : null
  const highlights = compact([
    top ? '接诊量最高医生：' + top.doctorName + '（' + top.visitCount + ' 人次，收入 ' + moneyText(top.revenueCents) + '）' : '',
    bottom ? '接诊量最低医生：' + bottom.doctorName + '（' + bottom.visitCount + ' 人次）' : '',
    totals.doctorCount ? '人均接诊 ' + Math.round((totals.visitCount / totals.doctorCount) * 10) / 10 + ' 人次（共 ' + totals.doctorCount + ' 名医生）' : ''
  ])
  return { rows: rows, totals: totals, highlights: highlights }
}

function doctorSummary(demoToday, built) {
  const rows = built.rows
  const totals = built.totals
  if (!rows.length) return '演示基准日 ' + demoToday + '，暂无可统计的医生接诊数据。'
  const top = rows[0]
  const bottom = rows[rows.length - 1]
  return (
    '演示基准日 ' + demoToday + '，医生接诊量报表覆盖 ' + rows.length + ' 名医生，共接诊 ' + totals.visitCount +
    ' 人次，已缴费门诊收入 ' + moneyText(totals.revenueCents) + '（整数分转元展示）。' +
    '接诊量最高为' + top.doctorName + '（' + top.visitCount + ' 人次），最低为' + bottom.doctorName + '（' + bottom.visitCount + ' 人次）。' +
    '口径：接诊量取门诊接诊记录，收入取已缴费门诊收费并按接诊医生归集；数据为虚构演示数据。'
  )
}

function buildMedicine(rowsIn, lowStockCount, threshold) {
  const rows = (rowsIn || []).map(function (r) {
    return {
      medicineName: String((r && r.medicineName) || '未知药品'),
      unit: String((r && r.unit) || ''),
      prescribedQty: toInt(r && r.prescribedQty),
      orderQty: toInt(r && r.orderQty),
      totalQty: toInt(r && r.totalQty),
      stock: toInt(r && r.stock)
    }
  })
  const totals = {
    medicineCount: rows.length,
    prescribedQty: sumBy(rows, 'prescribedQty'),
    orderQty: sumBy(rows, 'orderQty'),
    totalQty: sumBy(rows, 'totalQty')
  }
  const top = rows[0] || null
  const bottom = rows.length > 1 ? rows[rows.length - 1] : null
  const highlights = compact([
    top ? '消耗量最高：' + top.medicineName + '（' + top.totalQty + ' ' + top.unit + '，当前库存 ' + top.stock + '）' : '',
    bottom ? '消耗量最低：' + bottom.medicineName + '（' + bottom.totalQty + ' ' + bottom.unit + '）' : '',
    totals.totalQty ? '住院医嘱消耗占比 ' + pct(totals.orderQty, totals.totalQty) + '%，处方消耗占比 ' + pct(totals.prescribedQty, totals.totalQty) + '%' : '',
    '库存低于阈值（' + toInt(threshold) + '）的药品：' + toInt(lowStockCount) + ' 种',
    '共覆盖 ' + totals.medicineCount + ' 种药品'
  ])
  return { rows: rows, totals: totals, highlights: highlights }
}

function medicineSummary(demoToday, built, lowStockCount, threshold) {
  const rows = built.rows
  const totals = built.totals
  if (!rows.length) return '演示基准日 ' + demoToday + '，暂无可统计的药品消耗数据。'
  const top = rows[0]
  const bottom = rows[rows.length - 1]
  return (
    '演示基准日 ' + demoToday + '，药品消耗报表覆盖 ' + rows.length + ' 种药品，处方消耗 ' + totals.prescribedQty +
    '、住院医嘱消耗 ' + totals.orderQty + '，合计 ' + totals.totalQty + '（数量单位以药品目录为准）。' +
    '消耗最多为' + top.medicineName + '（' + top.totalQty + ' ' + top.unit + '），消耗最少为' + bottom.medicineName + '（' + bottom.totalQty + ' ' + bottom.unit + '）。' +
    '口径：处方取门诊接诊处方明细，医嘱取住院药品医嘱，库存取药品目录当前库存，库存阈值 ' + toInt(threshold) +
    '（低于阈值 ' + toInt(lowStockCount) + ' 种）；数据为虚构演示数据。'
  )
}

function buildBed(bedsIn, wardsIn, admissionsIn, bedSummary) {
  const wardMap = {}
  ;(wardsIn || []).forEach(function (w) {
    if (w) wardMap[w.id] = w
  })
  const buckets = {}
  function bucket(wardId) {
    const key = wardId || ''
    if (!buckets[key]) {
      buckets[key] = {
        wardName: (wardMap[key] || {}).name || '未知病区',
        totalBeds: 0,
        occupied: 0,
        idle: 0,
        admissions: 0
      }
    }
    return buckets[key]
  }
  ;(bedsIn || []).forEach(function (b) {
    if (!b) return
    const row = bucket(b.wardId)
    row.totalBeds += 1
    if (b.status === '占用') row.occupied += 1
    else if (b.status === '空闲' && b.enabled !== 0) row.idle += 1
  })
  ;(admissionsIn || []).forEach(function (a) {
    if (!a || !a.wardId) return
    bucket(a.wardId).admissions += 1
  })
  const rows = Object.keys(buckets).map(function (k) {
    const r = buckets[k]
    return {
      wardName: r.wardName,
      totalBeds: r.totalBeds,
      occupied: r.occupied,
      idle: r.idle,
      occupancyPct: r.totalBeds ? Math.round((r.occupied / r.totalBeds) * 100) : 0,
      admissions: r.admissions
    }
  }).filter(function (r) {
    return r.totalBeds > 0 || r.admissions > 0
  }).sort(function (a, b) {
    if (b.totalBeds !== a.totalBeds) return b.totalBeds - a.totalBeds
    return a.wardName < b.wardName ? -1 : a.wardName > b.wardName ? 1 : 0
  })
  const totals = {
    totalBeds: sumBy(rows, 'totalBeds'),
    occupied: sumBy(rows, 'occupied'),
    idle: sumBy(rows, 'idle'),
    admissions: sumBy(rows, 'admissions')
  }
  totals.occupancyPct = totals.totalBeds ? Math.round((totals.occupied / totals.totalBeds) * 100) : 0
  const byOccupancy = rows.slice().sort(function (a, b) {
    if (b.occupancyPct !== a.occupancyPct) return b.occupancyPct - a.occupancyPct
    return a.wardName < b.wardName ? -1 : a.wardName > b.wardName ? 1 : 0
  })
  const highest = byOccupancy[0] || null
  const lowest = byOccupancy.length > 1 ? byOccupancy[byOccupancy.length - 1] : null
  const disabled = Math.max(0, totals.totalBeds - totals.occupied - totals.idle)
  const avgStayDays = bedSummary ? Number(bedSummary.avgStayDays) || 0 : 0
  const highlights = compact([
    highest ? '占用率最高病区：' + highest.wardName + '（' + highest.occupancyPct + '%，占用 ' + highest.occupied + '/' + highest.totalBeds + ' 张）' : '',
    lowest ? '占用率最低病区：' + lowest.wardName + '（' + lowest.occupancyPct + '%）' : '',
    '全院床位 ' + totals.totalBeds + ' 张：占用 ' + totals.occupied + '、空闲 ' + totals.idle + '、停用 ' + disabled,
    '入院记录 ' + totals.admissions + ' 条' + (avgStayDays > 0 ? '，已出院平均住院 ' + avgStayDays + ' 天' : '')
  ])
  return { rows: rows, totals: totals, highlights: highlights, disabled: disabled }
}

function bedSummaryText(demoToday, built) {
  const rows = built.rows
  const totals = built.totals
  if (!rows.length) return '演示基准日 ' + demoToday + '，暂无可统计的床位周转数据。'
  const byOccupancy = rows.slice().sort(function (a, b) {
    if (b.occupancyPct !== a.occupancyPct) return b.occupancyPct - a.occupancyPct
    return a.wardName < b.wardName ? -1 : a.wardName > b.wardName ? 1 : 0
  })
  const highest = byOccupancy[0]
  const lowest = byOccupancy[byOccupancy.length - 1]
  return (
    '演示基准日 ' + demoToday + '，床位周转报表覆盖 ' + rows.length + ' 个病区、' + totals.totalBeds +
    ' 张床位，占用 ' + totals.occupied + ' 张、空闲 ' + totals.idle + ' 张、停用 ' + built.disabled +
    ' 张，整体占用率 ' + totals.occupancyPct + '%，入院记录 ' + totals.admissions + ' 条。' +
    '占用率最高为' + highest.wardName + '（' + highest.occupancyPct + '%），最低为' + lowest.wardName + '（' + lowest.occupancyPct + '%）。' +
    '口径：床位占用取床位状态，入院数取住院登记记录（含已出院），占用率按全部床位（含停用床位）计算；数据为虚构演示数据。'
  )
}

module.exports = {
  name: 'report.summary',
  title: '智能报表',
  batch: 'B4',
  readOnly: true,
  description: '只读聚合生成收入结构/科室工作量/医生接诊量/药品消耗/床位周转报表，含中文摘要、要点与导出用数据',
  disclaimers: [guardrails.DISCLAIMER.DEMO, guardrails.DISCLAIMER.REPORT],
  outputSchema: {
    reportType: 'string',
    title: 'string',
    columns: 'array<object>',
    rows: 'array<object>',
    totals: 'object',
    summary: 'string',
    highlights: 'array<string>',
    disclaimers: 'array'
  },

  // 只读上下文：按报表类型取所需聚合（其余类型不加载，控制上下文规模）
  buildContext: function (sel, input) {
    const requested = input && input.reportType !== undefined ? String(input.reportType) : ''
    const reportType = normalizeType(requested)
    const data = {
      reportType: reportType,
      requestedType: requested || DEFAULT_TYPE,
      demoToday: sel.demoToday(),
      series: sel.registrationSeries()
    }
    if (reportType === 'revenue') {
      data.revenueRows = sel.revenueByDepartment()
    } else if (reportType === 'department') {
      data.visits = sel.list('visits')
      data.feeRecords = sel.list('feeRecords')
      data.departments = sel.byIdMap('departments')
    } else if (reportType === 'doctor') {
      data.doctorRows = sel.doctorWorkload()
    } else if (reportType === 'medicine') {
      data.medicineRows = sel.medicineConsumption()
      data.lowStockCount = sel.lowStockMedicines().length
      data.rules = sel.rules()
    } else if (reportType === 'bed') {
      data.beds = sel.list('beds')
      data.wards = sel.list('wards')
      data.admissions = sel.list('admissions')
      data.bedSummary = sel.bedTurnover()
    }
    return data
  },

  generate: function (ctx, input) {
    const data = (ctx && ctx.data) || {}
    const reportType = normalizeType(data.reportType || (input && input.reportType))
    const demoToday = String((ctx && ctx.demoToday) || data.demoToday || '')
    const series = data.series || []
    const meta = TYPE_META[reportType]
    let built
    let summary

    if (reportType === 'revenue') {
      built = buildRevenue(data.revenueRows, series)
      summary = revenueSummary(demoToday, built)
    } else if (reportType === 'department') {
      built = buildDepartment(data.visits, data.feeRecords, data.departments, series)
      summary = departmentSummary(demoToday, built)
    } else if (reportType === 'doctor') {
      built = buildDoctor(data.doctorRows)
      built.highlights = compact([
        built.highlights[0],
        built.highlights[1],
        built.highlights[2],
        trendText(series)
      ])
      summary = doctorSummary(demoToday, built)
    } else if (reportType === 'medicine') {
      const threshold = toInt((data.rules || {}).LOW_STOCK)
      built = buildMedicine(data.medicineRows, data.lowStockCount, threshold)
      summary = medicineSummary(demoToday, built, data.lowStockCount, threshold)
    } else {
      built = buildBed(data.beds, data.wards, data.admissions, data.bedSummary)
      summary = bedSummaryText(demoToday, built)
    }

    const output = {
      reportType: reportType,
      title: meta.title,
      columns: COLUMNS[reportType].map(function (c) {
        return Object.assign({}, c)
      }),
      rows: built.rows,
      totals: built.totals,
      summary: summary,
      highlights: compact(built.highlights),
      disclaimers: [guardrails.DISCLAIMER.DEMO, guardrails.DISCLAIMER.REPORT]
    }
    return {
      text: summary,
      confidence: 0.9,
      basis: [
        { label: '报表类型', value: meta.label },
        { label: '数据来源', value: '只读选择器聚合（selectors）' },
        { label: '演示基准日', value: demoToday }
      ],
      data: output
    }
  },

  // G2：结构校验失败时回退为结构合法的空报表
  fallback: function () {
    return {
      reportType: DEFAULT_TYPE,
      title: '智能报表（已回退）',
      columns: [],
      rows: [],
      totals: {},
      summary: '报表生成未通过结构校验，已回退为“暂无可用报表”。请稍后重试或联系管理员。',
      highlights: [],
      disclaimers: [guardrails.DISCLAIMER.DEMO, guardrails.DISCLAIMER.REPORT]
    }
  }
}
