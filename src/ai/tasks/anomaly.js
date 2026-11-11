// =====================================================================
// 任务：anomaly.explain（B4 · 运营异常分析）
// 用途：基于阈值/统计识别库存、床位、积压、临期、未缴费等运营异常并解释，
//       给出排查入口；只读，不提供自动处理。
// 阈值均为演示规则（写入 reason 口径）：
//   - 库存 < 50 为 high；50 ≤ 库存 < 200 为 medium；
//   - 床位占用率 > 80% 为 high；
//   - 待出报告 / 待执行医嘱 / 待收费 / 待发药 > 0 为 medium；
//   - 未缴费挂号 / 待入科 / 待结算 > 0 为 low；
//   - 药品批次距有效期 ≤ 30 天为临期（≤ 7 天 high，其余 medium）。
// 红线：只读（不引用 db、不写库）、确定性（无随机数/当前时间）、不自动处理。
// 说明：本任务由 tasks/index.js 统一注册（Lead 负责），文件只导出定义。
// =====================================================================
const guardrails = require('../guardrails')

const DEMO = guardrails.DISCLAIMER.DEMO
const READONLY = guardrails.DISCLAIMER.READONLY

const LEVEL_WEIGHT = { high: 3, medium: 2, low: 1 }

function num(value) {
  const n = Number(value)
  return isFinite(n) ? n : 0
}

/** 路由 -> 业务域（用于按当前角色权限裁剪处理入口，避免跳转到 403 页面） */
function pathDomain(path) {
  const p = String(path || '')
  if (p.indexOf('/basic/') === 0) return 'basic'
  if (p.indexOf('/patients') === 0) return 'patient'
  if (p.indexOf('/outpatient/') === 0) return 'outpatient'
  if (p.indexOf('/inpatient/') === 0) return 'inpatient'
  if (p.indexOf('/system/') === 0) return 'system'
  if (p.indexOf('/ai/') === 0) return 'ai'
  return 'home'
}

/** 按当前角色权限过滤处理入口（home 域对所有登录角色开放） */
function filterLinks(actor, links) {
  const domains = (actor && actor.domains) || {}
  return (links || [])
    .filter(function (link) {
      const domain = pathDomain(link.path)
      return domain === 'home' || !!domains[domain]
    })
    .slice(0, 3)
}

function levelCount(items, level) {
  return items.filter(function (item) {
    return item.level === level
  }).length
}

/** 只读上下文：库存/床位/积压/临期/统计快照 */
function buildContext(sel) {
  const stats = sel.stats()
  const wards = sel.byIdMap('wards')
  const medMap = sel.byIdMap('medicines')
  return {
    stats: stats,
    rules: sel.rules(),
    beds: sel.list('beds').map(function (b) {
      return {
        id: b.id,
        wardId: b.wardId,
        wardName: (wards[b.wardId] || {}).name || '未知病区',
        code: b.code,
        type: b.type,
        status: b.status,
        enabled: b.enabled,
        remark: b.remark || ''
      }
    }),
    medicines: sel.list('medicines').map(function (m) {
      return { id: m.id, name: m.name, unit: m.unit, stock: num(m.stock), status: m.status }
    }),
    expiring: sel.expiringStocks().map(function (st) {
      return {
        id: st.id,
        medicineId: st.medicineId,
        medicineName: (medMap[st.medicineId] || {}).name || '未知药品',
        batchNo: st.batchNo,
        expiry: st.expiry,
        daysLeft: num(st.daysLeft)
      }
    }),
    pendingReports: sel.pendingVisits('report').length,
    pendingCharge: sel.pendingVisits('charge').length,
    pendingDispense: sel.pendingVisits('dispense').length,
    pendingOrders: sel.pendingOrders().length,
    pendingAdm: sel.pendingAdmissions().length,
    pendingSettle: sel.pendingSettlements().length,
    unpaidRegs: sel.unpaidRegistrations().length,
    bedTurnover: sel.bedTurnover()
  }
}

function pushBedDisabled(items, data, actor) {
  const beds = data.beds || []
  const totalBeds = beds.length
  beds.forEach(function (b) {
    if (b.enabled !== 0) return
    items.push({
      id: 'bed:' + b.id,
      type: 'bed',
      level: 'high',
      title: '床位停用：' + b.code + (b.remark ? '（' + b.remark + '）' : ''),
      reason:
        '床位 ' + b.code + '（' + b.id + '，' + b.wardName + '）处于停用状态（enabled=0），不参与可用床位统计。' +
        '口径：beds.enabled === 0 视为停用/检修，演示规则。',
      metric: { label: '停用床位', value: '1 张 / 共 ' + totalBeds + ' 张' },
      suggestion: '建议确认检修进度，完成后在床位管理启用该床位；停用期间安排患者使用其他可用床位。',
      links: filterLinks(actor, [
        { label: '床位管理', path: '/basic/beds' },
        { label: '入院登记', path: '/inpatient/admissions' }
      ])
    })
  })
}

function pushLowStock(items, data, actor) {
  ;(data.medicines || []).forEach(function (m) {
    if (m.status !== 1) return
    if (m.stock < 50) {
      items.push({
        id: 'stock:' + m.id,
        type: 'medicine',
        level: 'high',
        title: '药品库存严重不足：' + m.name,
        reason:
          '当前库存 ' + m.stock + ' ' + m.unit + '，低于高优先级阈值 50。' +
          '口径：演示规则库存 < 50 为高，50 ≤ 库存 < 200 为中。',
        metric: { label: '当前库存', value: m.stock + ' ' + m.unit },
        suggestion: '建议立即核对采购计划并补货，库存补足至 200 以上后异常自动消失。',
        links: filterLinks(actor, [
          { label: '药品目录', path: '/basic/medicines' },
          { label: '批次库存', path: '/basic/stocks' }
        ])
      })
      return
    }
    if (m.stock < 200) {
      items.push({
        id: 'stock:' + m.id,
        type: 'medicine',
        level: 'medium',
        title: '药品库存偏低：' + m.name,
        reason:
          '当前库存 ' + m.stock + ' ' + m.unit + '，处于 [50, 200) 区间。' +
          '口径：演示规则库存 < 50 为高，50 ≤ 库存 < 200 为中。',
        metric: { label: '当前库存', value: m.stock + ' ' + m.unit },
        suggestion: '建议核对采购计划，按消耗速度安排补货；库存补足至 200 以上后异常自动消失。',
        links: filterLinks(actor, [
          { label: '药品目录', path: '/basic/medicines' },
          { label: '批次库存', path: '/basic/stocks' }
        ])
      })
    }
  })
}

function pushQueues(items, data, actor) {
  if (num(data.pendingReports) > 0) {
    items.push({
      id: 'report:backlog',
      type: 'report',
      level: 'medium',
      title: '检查报告积压',
      reason:
        '当前有 ' + num(data.pendingReports) + ' 条接诊存在待出报告（exams 非空且 reportStatus ≠ 已出报告）。' +
        '口径：待出报告 > 0 即视为积压，演示规则。',
      metric: { label: '待出报告', value: num(data.pendingReports) + ' 条' },
      suggestion: '建议医技科室按开单时间优先处理，报告出具后该异常自动消失。',
      links: filterLinks(actor, [
        { label: '医技报告', path: '/outpatient/reports' },
        { label: '医技申请', path: '/outpatient/exam-applies' }
      ])
    })
  }
  if (num(data.pendingOrders) > 0) {
    items.push({
      id: 'order:backlog',
      type: 'order',
      level: 'medium',
      title: '住院医嘱待执行',
      reason:
        '当前有 ' + num(data.pendingOrders) + ' 条住院医嘱未执行（orders.status = 未执行）。' +
        '口径：待执行医嘱 > 0 即视为积压，演示规则。',
      metric: { label: '待执行医嘱', value: num(data.pendingOrders) + ' 条' },
      suggestion: '建议护理站按医嘱优先级执行，执行后该异常自动消失。',
      links: filterLinks(actor, [
        { label: '住院医嘱', path: '/inpatient/orders' },
        { label: '入院登记', path: '/inpatient/admissions' }
      ])
    })
  }
  if (num(data.pendingCharge) > 0) {
    items.push({
      id: 'charge:backlog',
      type: 'charge',
      level: 'medium',
      title: '门诊待收费',
      reason:
        '当前有 ' + num(data.pendingCharge) + ' 条接诊未收费且存在处方/检查项目（chargeStatus = 未收费）。' +
        '口径：待收费 > 0 即提示，演示规则。',
      metric: { label: '待收费接诊', value: num(data.pendingCharge) + ' 条' },
      suggestion: '建议收费窗口按接诊顺序确认收费，收费后该异常自动消失。',
      links: filterLinks(actor, [
        { label: '门诊收费', path: '/outpatient/charges' },
        { label: '门诊接诊', path: '/outpatient/visits' }
      ])
    })
  }
  if (num(data.pendingDispense) > 0) {
    items.push({
      id: 'dispense:backlog',
      type: 'dispense',
      level: 'medium',
      title: '处方待发药',
      reason:
        '当前有 ' + num(data.pendingDispense) + ' 张处方已收费未发药（dispenseStatus = 未发药）。' +
        '口径：待发药 > 0 即提示，演示规则。',
      metric: { label: '待发药处方', value: num(data.pendingDispense) + ' 条' },
      suggestion: '建议药房按收费顺序发药，发药后该异常自动消失。',
      links: filterLinks(actor, [{ label: '处方发药', path: '/outpatient/dispenses' }])
    })
  }
  if (num(data.unpaidRegs) > 0) {
    items.push({
      id: 'registration:unpaid',
      type: 'registration',
      level: 'low',
      title: '挂号未缴费',
      reason:
        '当前有 ' + num(data.unpaidRegs) + ' 条待分诊挂号未缴费（regStatus = 待分诊 且 payStatus = 未缴费）。' +
        '口径：未缴费挂号 > 0 即提示，演示规则。',
      metric: { label: '未缴费挂号', value: num(data.unpaidRegs) + ' 条' },
      suggestion: '建议收费窗口确认缴费状态后再进行分诊。',
      links: filterLinks(actor, [
        { label: '门诊挂号', path: '/outpatient/registrations' },
        { label: '门诊收费', path: '/outpatient/charges' }
      ])
    })
  }
  if (num(data.pendingAdm) > 0) {
    items.push({
      id: 'admission:pending',
      type: 'admission',
      level: 'low',
      title: '待入科患者',
      reason:
        '当前有 ' + num(data.pendingAdm) + ' 名患者待入科（admissions.status = 待入科）。' +
        '口径：待入科 > 0 即提示，演示规则。',
      metric: { label: '待入科', value: num(data.pendingAdm) + ' 人' },
      suggestion: '建议住院处协调病区床位，尽快完成入科确认。',
      links: filterLinks(actor, [
        { label: '入院登记', path: '/inpatient/admissions' },
        { label: '床位管理', path: '/basic/beds' }
      ])
    })
  }
  if (num(data.pendingSettle) > 0) {
    items.push({
      id: 'settlement:pending',
      type: 'settlement',
      level: 'low',
      title: '待结算出院',
      reason:
        '当前有 ' + num(data.pendingSettle) + ' 名患者待结算（admissions.status = 待结算）。' +
        '口径：待结算 > 0 即提示，演示规则。',
      metric: { label: '待结算', value: num(data.pendingSettle) + ' 人' },
      suggestion: '建议出院结算窗口核对费用明细后完成结算。',
      links: filterLinks(actor, [{ label: '出院结算', path: '/inpatient/settlements' }])
    })
  }
}

function pushOccupancy(items, data, actor) {
  const beds = (data.stats || {}).beds || {}
  const pct = num(beds.occupancyPct)
  if (pct <= 80) return
  items.push({
    id: 'occupancy:all',
    type: 'occupancy',
    level: 'high',
    title: '床位占用率过高',
    reason:
      '当前床位占用率 ' + pct + '%（占用 ' + num(beds.occupied) + ' / 共 ' + num(beds.total) + ' 张），超过 80% 阈值。' +
      '口径：占用率 > 80% 为高，演示规则。',
    metric: { label: '床位占用率', value: pct + '%' },
    suggestion: '建议优先安排可出院患者、协调转床，并评估启用停用床位或加床。',
    links: filterLinks(actor, [
      { label: '床位管理', path: '/basic/beds' },
      { label: '入院登记', path: '/inpatient/admissions' }
    ])
  })
}

function pushExpiring(items, data, actor) {
  const rows = data.expiring || []
  if (!rows.length) return
  let minDays = rows[0].daysLeft
  rows.forEach(function (row) {
    if (num(row.daysLeft) < minDays) minDays = num(row.daysLeft)
  })
  const urgent = rows.some(function (row) {
    return num(row.daysLeft) <= 7
  })
  items.push({
    id: 'expiring:all',
    type: 'expiring',
    level: urgent ? 'high' : 'medium',
    title: '药品批次临近有效期',
    reason:
      '当前有 ' + rows.length + ' 个药品批次将在 30 天内到期，最近一批仅剩 ' + minDays + ' 天' +
      '（批号 ' + rows[0].batchNo + '）。口径：距有效期 ≤ 30 天为临期，≤ 7 天为高，演示规则。',
    metric: { label: '临期批次', value: rows.length + ' 个' },
    suggestion: '建议先进先出，临期批次优先使用或联系药剂科处理。',
    links: filterLinks(actor, [
      { label: '批次库存', path: '/basic/stocks' },
      { label: '药品目录', path: '/basic/medicines' }
    ])
  })
}

/** 汇总文案：共 N 项异常、高 N 项，并点出最需关注的 1-2 项 */
function buildSummary(items, counts) {
  const total = counts.total
  let summary
  if (!total) {
    summary = '共 0 项异常，其中高 0 项。当前演示阈值规则下未发现异常。'
  } else {
    summary =
      '共 ' + total + ' 项异常，其中高 ' + counts.high + ' 项、中 ' + counts.medium + ' 项、低 ' + counts.low + ' 项。'
    const focus = items.slice(0, 2).map(function (item) {
      return item.title
    })
    summary += '最需关注：' + focus.join('；') + '。'
  }
  summary += '以上为演示阈值规则的只读识别结果，不提供自动处理，落地操作需人工确认并走原有业务校验。'
  return summary
}

module.exports = {
  name: 'anomaly.explain',
  title: '运营异常分析',
  batch: 'B4',
  readOnly: true,
  description: '基于库存/床位/积压/临期/未缴费等演示阈值识别运营异常并解释，给出排查入口',
  disclaimers: [DEMO, READONLY],
  outputSchema: {
    items: 'array<object>',
    summary: 'string',
    total: 'number',
    highCount: 'number',
    disclaimers: 'array'
  },
  buildContext: buildContext,
  generate: function (ctx, input) {
    const context = ctx || {}
    const data = context.data || {}
    const actor = context.actor || {}
    const items = []

    pushBedDisabled(items, data, actor)
    pushLowStock(items, data, actor)
    pushQueues(items, data, actor)
    pushOccupancy(items, data, actor)
    pushExpiring(items, data, actor)

    // 排序：高 > 中 > 低；同级别按 id 字典序，保证确定性
    items.sort(function (a, b) {
      const diff = (LEVEL_WEIGHT[b.level] || 0) - (LEVEL_WEIGHT[a.level] || 0)
      if (diff) return diff
      if (a.id === b.id) return 0
      return a.id < b.id ? -1 : 1
    })

    // 可选级别筛选（页面默认展示全部，由前端切换）
    const safeInput = input || context.input || {}
    const level = ['high', 'medium', 'low'].indexOf(safeInput.level) !== -1 ? safeInput.level : ''
    const visible = level
      ? items.filter(function (item) {
          return item.level === level
        })
      : items

    const counts = {
      total: visible.length,
      high: levelCount(visible, 'high'),
      medium: levelCount(visible, 'medium'),
      low: levelCount(visible, 'low')
    }
    const summary = buildSummary(visible, counts)
    return {
      text: summary,
      confidence: 0.9,
      basis: [
        { label: '异常总数', value: counts.total + ' 项', source: 'anomaly.explain.items', raw: counts.total },
        { label: '高优先级', value: counts.high + ' 项', source: 'anomaly.explain.highCount', raw: counts.high },
        { label: '中优先级', value: counts.medium + ' 项', source: 'anomaly.explain.mediumCount', raw: counts.medium },
        { label: '低优先级', value: counts.low + ' 项', source: 'anomaly.explain.lowCount', raw: counts.low },
        { label: '演示基准日', value: context.demoToday || '' }
      ],
      data: {
        items: visible,
        summary: summary,
        total: counts.total,
        highCount: counts.high,
        mediumCount: counts.medium,
        lowCount: counts.low,
        disclaimers: [DEMO, READONLY]
      }
    }
  },
  fallback: function () {
    return {
      items: [],
      summary: '异常分析输出未通过结构校验，已回退为"暂无异常结论"，请人工核对阈值与数据。',
      total: 0,
      highCount: 0,
      disclaimers: [DEMO, READONLY]
    }
  }
}
