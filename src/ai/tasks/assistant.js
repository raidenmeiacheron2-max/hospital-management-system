// =====================================================================
// 任务：assistant.qa（B4 · Ask Astra 业务助手）
// 用途：用自然语言查询/解释系统数据与业务规则，输出"结论 + 数据依据 + 建议入口 + 追问"。
// 红线：
//   - 只读：仅通过 buildContext 收到的只读 selectors 快照读取数据，不引用 db、不写库；
//   - 确定性：关键词规则匹配 + 固定聚合，不使用随机数/当前时间影响输出；
//   - 权限收敛：涉及当前角色无权访问的业务域时，直接回答"无权限查看"；
//   - 依据可核对：数值结论在 basis 中标注 source（如 stats.todayRegCount）与 raw（金额为整数分）；
//   - 免责：输出附演示与只读声明（由 guardrails 统一注入/去重）。
// 说明：本任务由 tasks/index.js 统一注册（Lead 负责），文件只导出定义。
// =====================================================================
const guardrails = require('../guardrails')

const DEMO = guardrails.DISCLAIMER.DEMO
const READONLY = guardrails.DISCLAIMER.READONLY

// 业务域中文名（与 selectors.perm(actor).domains 的键一致）
const DOMAIN_LABELS = {
  home: '首页统计',
  basic: '基础资料',
  patient: '患者服务',
  outpatient: '门诊管理',
  inpatient: '住院管理',
  system: '系统管理',
  ai: 'AI 智能中心'
}

// 建议入口（均为现有路由；domain 用于按当前角色权限裁剪）
const ACTIONS = {
  dashboard: { label: '首页概览', path: '/dashboard', domain: 'home' },
  reminders: { label: '提醒中心', path: '/workbench/reminders', domain: 'home' },
  registrations: { label: '门诊挂号', path: '/outpatient/registrations', domain: 'outpatient' },
  visits: { label: '门诊接诊', path: '/outpatient/visits', domain: 'outpatient' },
  charges: { label: '门诊收费', path: '/outpatient/charges', domain: 'outpatient' },
  dispenses: { label: '处方发药', path: '/outpatient/dispenses', domain: 'outpatient' },
  reports: { label: '医技报告', path: '/outpatient/reports', domain: 'outpatient' },
  examApplies: { label: '医技申请', path: '/outpatient/exam-applies', domain: 'outpatient' },
  schedules: { label: '医生排班', path: '/outpatient/schedules', domain: 'outpatient' },
  orders: { label: '住院医嘱', path: '/inpatient/orders', domain: 'inpatient' },
  admissions: { label: '入院登记', path: '/inpatient/admissions', domain: 'inpatient' },
  settlements: { label: '出院结算', path: '/inpatient/settlements', domain: 'inpatient' },
  medicines: { label: '药品目录', path: '/basic/medicines', domain: 'basic' },
  stocks: { label: '批次库存', path: '/basic/stocks', domain: 'basic' },
  beds: { label: '床位管理', path: '/basic/beds', domain: 'basic' },
  patients: { label: '患者档案', path: '/patients', domain: 'patient' },
  timeline: { label: '患者时间线', path: '/patients/timeline', domain: 'patient' }
}

// 关键词意图（顺序敏感：越具体的意图越靠前）
const INTENTS = [
  { id: 'help', domain: null, keywords: ['能做什么', '能干什么', '帮助', '怎么用', '有什么功能', '有什么能力', '使用说明'] },
  { id: 'todayReg', domain: 'outpatient', keywords: ['门诊量', '挂号量', '今日门诊', '今天门诊', '门诊人次', '挂号人次', '门诊人数', '挂号人数', '今天挂号', '今日挂号'] },
  { id: 'triage', domain: 'outpatient', keywords: ['待接诊', '待分诊', '待就诊', '候诊', '待叫号', '分诊'] },
  { id: 'charge', domain: 'outpatient', keywords: ['待收费', '未收费', '待缴费', '待交费', '收费待办', '未结账'] },
  { id: 'unpaidReg', domain: 'outpatient', keywords: ['未缴费挂号', '挂号未缴费', '未缴费'] },
  { id: 'dispense', domain: 'outpatient', keywords: ['待发药', '未发药', '发药', '取药'] },
  { id: 'report', domain: 'outpatient', keywords: ['待出报告', '报告积压', '待报告', '出报告', '报告', '检查结果'] },
  { id: 'order', domain: 'inpatient', keywords: ['待执行医嘱', '医嘱', '待执行'] },
  { id: 'stock', domain: 'basic', keywords: ['库存', '低库存', '缺药', '补货', '药品库存', '库存最低'] },
  { id: 'bed', domain: 'basic', keywords: ['床位', '占用率', '空床', '停用床', '检修床'] },
  { id: 'deptWorkload', domain: 'outpatient', keywords: ['科室工作量', '科室收入', '收入结构', '按科室', '科室'] },
  { id: 'income', domain: 'home', keywords: ['收入', '营收', '营业额', '收了多少钱', '进账'] },
  { id: 'inpatient', domain: 'inpatient', keywords: ['在院', '住院', '入院', '待入科', '待结算', '出院', '病区'] },
  { id: 'patients', domain: 'patient', keywords: ['患者总数', '多少患者', '患者数量', '病人总数', '患者数', '病人数', '患者'] },
  { id: 'doctorWorkload', domain: 'outpatient', keywords: ['医生接诊量', '接诊量', '医生工作量', '医生'] }
]

/** 分 -> 元展示（任务层不引入 @/ 别名，金额仍以整数分参与计算） */
function fmtYuan(cents) {
  const value = Math.round(Number(cents) || 0)
  const sign = value < 0 ? '-' : ''
  const abs = Math.abs(value)
  const yuan = Math.floor(abs / 100)
  const fen = String(abs % 100).padStart(2, '0')
  return sign + '¥' + yuan + '.' + fen
}

/** 安全取数（非数值按 0 处理，保证确定性） */
function num(value) {
  const n = Number(value)
  return isFinite(n) ? n : 0
}

/** 按当前角色权限裁剪建议入口（最多 3 条，只保留有权访问的域） */
function pickActions(actor, keys) {
  const domains = (actor && actor.domains) || {}
  const out = []
  ;(keys || []).forEach(function (key) {
    const action = ACTIONS[key]
    if (!action) return
    if (action.domain && !domains[action.domain]) return
    if (out.length < 3) out.push({ label: action.label, path: action.path })
  })
  return out
}

/** 权限不足时的统一回答（与 outputSchema 同结构） */
function deniedResult(ctx, def) {
  const actor = ctx.actor || {}
  const roleName = actor.roleName || '当前角色'
  const label = DOMAIN_LABELS[def.domain] || def.domain
  return {
    intent: def.id,
    answer:
      '当前角色（' + roleName + '）无权限查看' + label + '数据，因此无法回答该问题。' +
      '请切换到具备该业务域权限的角色，或询问您有权限查看的业务数据。',
    basis: [
      { label: '当前角色', value: roleName },
      { label: '所需权限域', value: label + '（' + def.domain + '）' },
      { label: '权限判定', value: '未授权', source: 'perm.domains.' + def.domain, raw: 0 }
    ],
    actions: [],
    followups: ['我能做什么？'],
    confidence: 0.9
  }
}

// ---------- 各意图的回答模板（返回 answer/basis/actions/followups/confidence） ----------
const HANDLERS = {
  help: function (ctx) {
    return {
      intent: 'help',
      answer:
        '我可以基于只读数据回答：今日门诊量与挂号、待接诊/待分诊、待收费、待发药、待出报告、待执行医嘱、' +
        '药品库存与低库存、床位占用、今日收入、在院与住院业务、患者总数、科室收入结构与医生接诊量。' +
        '请换个更具体的问法，或点击下方推荐问题；每次回答均附数据依据、建议入口与免责声明（演示基准日 ' +
        ctx.demoToday +
        '）。',
      basis: [],
      actions: ['reminders', 'dashboard'],
      followups: ['今天门诊量多少？', '待出报告有几条？', '库存最低的药品有哪些？'],
      confidence: 0.6
    }
  },

  unknown: function (ctx) {
    return {
      intent: 'unknown',
      answer:
        '暂未识别您的问题，我可以回答：今日门诊量、待接诊/待收费/待发药/待出报告、待执行医嘱、药品库存与低库存、' +
        '床位占用、今日收入、在院情况、患者总数、科室与医生工作量。' +
        '请换个更具体的问法，或点击下方推荐问题（演示基准日 ' +
        ctx.demoToday +
        '）。',
      basis: [],
      actions: ['reminders', 'dashboard'],
      followups: ['今天门诊量多少？', '待出报告有几条？', '床位占用率多少？'],
      confidence: 0.5
    }
  },

  todayReg: function (ctx, data) {
    const s = data.stats || {}
    const today = num(s.todayRegCount)
    const series = s.last7days || []
    const week = series.reduce(function (acc, d) {
      return acc + num(d.regCount)
    }, 0)
    const triage = num((s.regStatusCount || {})['待分诊'])
    return {
      intent: 'todayReg',
      answer:
        '今日（' + ctx.demoToday + '）门诊挂号量（未退号口径）为 ' + today + ' 人次；' +
        '近 7 日累计 ' + week + ' 人次，全院待分诊挂号 ' + triage + ' 条。' +
        '口径：挂号日期等于演示基准日且状态非「已退号」，数据来自只读 stats 聚合。',
      basis: [
        { label: '今日门诊量', value: today + ' 人次', source: 'stats.todayRegCount', raw: today },
        { label: '近7日累计', value: week + ' 人次', source: 'stats.last7days', raw: week },
        { label: '待分诊挂号', value: triage + ' 条', source: 'stats.regStatusCount.待分诊', raw: triage }
      ],
      actions: ['registrations', 'visits'],
      followups: ['待接诊有多少？', '今天收入多少？', '床位占用率多少？'],
      confidence: 0.9
    }
  },

  triage: function (ctx, data) {
    const rows = data.pendingTriage || []
    const total = rows.length
    const unpaid = rows.filter(function (r) {
      return r.payStatus === '未缴费'
    }).length
    const actor = ctx.actor || {}
    const isDoctor = actor.roleCode === 'DOCTOR' || actor.roleName === '门诊医生'
    if (isDoctor) {
      const mine = rows.filter(function (r) {
        return r.doctorId === actor.staffId
      }).length
      return {
        intent: 'triage',
        answer:
          '您（' + (actor.staffName || '当前医生') + '）名下待接诊/待分诊挂号 ' + mine + ' 条，' +
          '全院共 ' + total + ' 条（其中未缴费 ' + unpaid + ' 条）。' +
          '口径：挂号状态为「待分诊」，医生视角按 doctorId 归属过滤，演示基准日 ' + ctx.demoToday + '。',
        basis: [
          { label: '我的待接诊', value: mine + ' 条', source: 'selectors.pendingTriage(doctorId=actor.staffId)', raw: mine },
          { label: '全院待分诊', value: total + ' 条', source: 'selectors.pendingTriage', raw: total },
          { label: '其中未缴费', value: unpaid + ' 条', source: 'selectors.unpaidRegistrations', raw: unpaid }
        ],
        actions: ['registrations', 'visits'],
        followups: ['待出报告有几条？', '待收费有多少？', '今天门诊量多少？'],
        confidence: 0.9
      }
    }
    return {
      intent: 'triage',
      answer:
        '全院待接诊/待分诊挂号共 ' + total + ' 条，其中未缴费 ' + unpaid + ' 条。' +
        '口径：挂号状态为「待分诊」，演示基准日 ' + ctx.demoToday + '。',
      basis: [
        { label: '待分诊挂号', value: total + ' 条', source: 'selectors.pendingTriage', raw: total },
        { label: '其中未缴费', value: unpaid + ' 条', source: 'selectors.unpaidRegistrations', raw: unpaid }
      ],
      actions: ['registrations', 'visits'],
      followups: ['待收费有多少？', '待出报告有几条？', '今天门诊量多少？'],
      confidence: 0.9
    }
  },

  charge: function (ctx, data) {
    const list = data.pendingCharge || []
    const amount = list.reduce(function (acc, v) {
      return acc + num(v.amountCents)
    }, 0)
    return {
      intent: 'charge',
      answer:
        '当前待收费接诊 ' + list.length + ' 条，合计应收 ' + fmtYuan(amount) + '（' + amount + ' 分）。' +
        '口径：visit.chargeStatus = 未收费 且存在处方或检查项目，金额为处方与检查项目整数分之和。',
      basis: [
        { label: '待收费接诊', value: list.length + ' 条', source: 'selectors.pendingVisits("charge")', raw: list.length },
        { label: '应收合计', value: fmtYuan(amount), source: 'selectors.pendingVisits("charge")[].amountCents', raw: amount }
      ],
      actions: ['charges', 'visits'],
      followups: ['待发药有多少？', '待出报告有几条？', '未缴费挂号有几条？'],
      confidence: 0.9
    }
  },

  unpaidReg: function (ctx, data) {
    const list = data.unpaidRegs || []
    return {
      intent: 'unpaidReg',
      answer:
        '当前待分诊且未缴费的挂号 ' + list.length + ' 条。' +
        '口径：registrations.regStatus = 待分诊 且 payStatus = 未缴费，演示基准日 ' + ctx.demoToday + '。',
      basis: [
        { label: '未缴费挂号', value: list.length + ' 条', source: 'selectors.unpaidRegistrations', raw: list.length }
      ],
      actions: ['registrations', 'charges'],
      followups: ['待收费有多少？', '待接诊有多少？', '今天收入多少？'],
      confidence: 0.9
    }
  },

  dispense: function (ctx, data) {
    const list = data.pendingDispense || []
    return {
      intent: 'dispense',
      answer:
        '当前已收费待发药处方 ' + list.length + ' 条' + (list.length === 0 ? '，暂无发药积压' : '') + '。' +
        '口径：visit.chargeStatus = 已收费、dispenseStatus = 未发药 且处方非空，演示基准日 ' + ctx.demoToday + '。',
      basis: [
        { label: '待发药处方', value: list.length + ' 条', source: 'stats.todo.pendingDispense', raw: list.length }
      ],
      actions: ['dispenses', 'charges'],
      followups: ['待收费有多少？', '待出报告有几条？', '库存最低的药品有哪些？'],
      confidence: 0.9
    }
  },

  report: function (ctx, data) {
    const list = data.pendingReports || []
    return {
      intent: 'report',
      answer:
        '当前待出报告（报告积压）' + list.length + ' 条，与首页待办统计一致。' +
        '口径：接诊存在检查项目且 reportStatus ≠ 已出报告，演示基准日 ' + ctx.demoToday + '。',
      basis: [
        { label: '待出报告', value: list.length + ' 条', source: 'stats.todo.pendingReports', raw: list.length }
      ],
      actions: ['reports', 'examApplies'],
      followups: ['待收费有多少？', '待执行医嘱有几条？', '床位占用率多少？'],
      confidence: 0.9
    }
  },

  order: function (ctx, data) {
    const list = data.pendingOrders || []
    return {
      intent: 'order',
      answer:
        '当前住院医嘱待执行 ' + list.length + ' 条。' +
        '口径：orders.status = 未执行，演示基准日 ' + ctx.demoToday + '。',
      basis: [
        { label: '待执行医嘱', value: list.length + ' 条', source: 'stats.todo.pendingOrders', raw: list.length }
      ],
      actions: ['orders', 'admissions'],
      followups: ['在院患者有多少？', '待入科有几条？', '待发药有多少？'],
      confidence: 0.9
    }
  },

  stock: function (ctx, data) {
    const low = data.lowStock || []
    const threshold = num((data.rules || {}).LOW_STOCK) || 50
    const meds = (data.medicines || [])
      .filter(function (m) {
        return m.status === 1
      })
      .slice()
      .sort(function (a, b) {
        if (a.stock !== b.stock) return a.stock - b.stock
        return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
      })
    const lowest = meds.slice(0, 3)
    const lowestText = lowest
      .map(function (m) {
        return m.name + ' ' + m.stock + m.unit
      })
      .join('、')
    const answer =
      low.length === 0
        ? '当前没有低于阈值 ' + threshold + ' 的药品；库存最低的 3 个药品为 ' + lowestText + '。' +
          '口径：演示规则库存阈值 ' + threshold + '，按当前库存升序取前 3，演示基准日 ' + ctx.demoToday + '。'
        : '当前有 ' + low.length + ' 个药品库存低于阈值 ' + threshold + '（' +
          low
            .map(function (m) {
              return m.name + ' ' + m.stock + m.unit
            })
            .join('、') +
          '）；库存最低的 3 个药品为 ' + lowestText + '。' +
          '口径：演示规则库存阈值 ' + threshold + '，演示基准日 ' + ctx.demoToday + '。'
    const basis = [
      { label: '低于阈值药品', value: low.length + ' 个', source: 'selectors.lowStockMedicines', raw: low.length }
    ]
    lowest.forEach(function (m) {
      basis.push({ label: '库存最低：' + m.name, value: m.stock + ' ' + m.unit, source: 'medicines.' + m.id + '.stock', raw: m.stock })
    })
    basis.push({ label: '库存阈值', value: String(threshold), source: 'rules.LOW_STOCK', raw: threshold })
    return {
      intent: 'stock',
      answer: answer,
      basis: basis,
      actions: ['medicines', 'stocks'],
      followups: ['待出报告有几条？', '床位占用率多少？', '今天收入多少？'],
      confidence: 0.9
    }
  },

  bed: function (ctx, data) {
    const b = (data.stats || {}).beds || {}
    const t = data.bedTurnover || {}
    const disabled = data.disabledBeds || []
    const disabledText = disabled.length
      ? '（' +
        disabled
          .map(function (d) {
            return d.code + (d.remark ? '·' + d.remark : '')
          })
          .join('、') +
        '）'
      : ''
    return {
      intent: 'bed',
      answer:
        '当前床位共 ' + num(b.total) + ' 张，占用 ' + num(b.occupied) + ' 张（占用率 ' + num(b.occupancyPct) + '%），' +
        '空闲 ' + num(t.idle) + ' 张，停用 ' + disabled.length + ' 张' + disabledText + '。' +
        '口径：占用率 = 占用床位 / 全部床位（含停用床），演示基准日 ' + ctx.demoToday + '。',
      basis: [
        { label: '床位占用率', value: num(b.occupancyPct) + '%', source: 'stats.beds.occupancyPct', raw: num(b.occupancyPct) },
        { label: '占用/总床位', value: num(b.occupied) + '/' + num(b.total), source: 'stats.beds.occupied', raw: num(b.occupied) },
        { label: '空闲床位', value: num(t.idle) + ' 张', source: 'selectors.bedTurnover.idle', raw: num(t.idle) },
        { label: '停用床位', value: disabled.length + ' 张', source: 'selectors.disabledBeds', raw: disabled.length }
      ],
      actions: ['beds', 'admissions'],
      followups: ['待入科有几条？', '库存最低的药品有哪些？', '今天收入多少？'],
      confidence: 0.9
    }
  },

  income: function (ctx, data) {
    const s = data.stats || {}
    const todayCents = num(s.todayFeeCents)
    const series = s.last7days || []
    const weekCents = series.reduce(function (acc, d) {
      return acc + num(d.feeCents)
    }, 0)
    return {
      intent: 'income',
      answer:
        '今日（' + ctx.demoToday + '）已缴费收入为 ' + fmtYuan(todayCents) + '（' + todayCents + ' 分）；' +
        '近 7 日累计 ' + fmtYuan(weekCents) + '。' +
        '口径：金额以整数分统计，仅计入 feeRecords 状态为「已缴费」的记录，展示时换算为元。',
      basis: [
        { label: '今日收入', value: fmtYuan(todayCents), source: 'stats.todayFeeCents', raw: todayCents },
        { label: '近7日收入', value: fmtYuan(weekCents), source: 'stats.last7days', raw: weekCents }
      ],
      actions: ['dashboard', 'charges'],
      followups: ['科室收入结构如何？', '今天门诊量多少？', '在院患者有多少？'],
      confidence: 0.9
    }
  },

  inpatient: function (ctx, data) {
    const h = (data.stats || {}).inHospital || {}
    return {
      intent: 'inpatient',
      answer:
        '当前在院 ' + num(h.inWard) + ' 人，待入科 ' + num(h.pendingAdm) + ' 人，待结算 ' + num(h.pendingSettle) + ' 人' +
        '（住院业务合计 ' + num(h.total) + ' 人）。' +
        '口径：按入院记录状态统计，演示基准日 ' + ctx.demoToday + '。',
      basis: [
        { label: '在院人数', value: num(h.inWard) + ' 人', source: 'stats.inHospital.inWard', raw: num(h.inWard) },
        { label: '待入科', value: num(h.pendingAdm) + ' 人', source: 'stats.inHospital.pendingAdm', raw: num(h.pendingAdm) },
        { label: '待结算', value: num(h.pendingSettle) + ' 人', source: 'stats.inHospital.pendingSettle', raw: num(h.pendingSettle) }
      ],
      actions: ['admissions', 'settlements', 'orders'],
      followups: ['待执行医嘱有几条？', '床位占用率多少？', '待入科有几条？'],
      confidence: 0.9
    }
  },

  patients: function (ctx, data) {
    const s = data.stats || {}
    const total = num(s.totalPatients)
    return {
      intent: 'patients',
      answer:
        '系统当前共有患者 ' + total + ' 名（演示虚构数据）。' +
        '口径：patients 集合总数，演示基准日 ' + ctx.demoToday + '。',
      basis: [{ label: '患者总数', value: total + ' 名', source: 'stats.totalPatients', raw: total }],
      actions: ['patients', 'timeline'],
      followups: ['今天门诊量多少？', '在院患者有多少？', '科室收入结构如何？'],
      confidence: 0.9
    }
  },

  deptWorkload: function (ctx, data) {
    const rows = data.revenueByDept || []
    const totalCents = rows.reduce(function (acc, r) {
      return acc + num(r.totalCents)
    }, 0)
    const top = rows.slice(0, 3)
    const topText = top
      .map(function (r) {
        return r.departmentName + ' ' + fmtYuan(r.totalCents)
      })
      .join('、')
    const answer =
      rows.length === 0
        ? '当前暂无可归集的科室收入数据。口径：仅统计已缴费的挂号费与门诊收费记录，演示基准日 ' + ctx.demoToday + '。'
        : '已缴费收入按科室合计 ' + fmtYuan(totalCents) + '，前三为 ' + topText + '。' +
          '口径：挂号费按挂号科室、门诊收费按接诊科室归集，仅统计已缴费记录，演示基准日 ' + ctx.demoToday + '。'
    const basis = [
      { label: '科室收入合计', value: fmtYuan(totalCents), source: 'selectors.revenueByDepartment.totalCents', raw: totalCents }
    ]
    top.forEach(function (r) {
      basis.push({
        label: r.departmentName + ' 收入',
        value: fmtYuan(r.totalCents),
        source: 'selectors.revenueByDepartment.' + r.departmentId + '.totalCents',
        raw: num(r.totalCents)
      })
    })
    return {
      intent: 'deptWorkload',
      answer: answer,
      basis: basis,
      actions: ['dashboard', 'charges'],
      followups: ['医生接诊量如何？', '今天收入多少？', '今天门诊量多少？'],
      confidence: 0.9
    }
  },

  doctorWorkload: function (ctx, data) {
    const rows = data.doctorWorkload || []
    const top = rows.slice(0, 3)
    const answer =
      rows.length === 0
        ? '当前暂无医生接诊记录。口径：按 visits 记录数统计，演示基准日 ' + ctx.demoToday + '。'
        : '医生接诊量前三为 ' +
          top
            .map(function (r) {
              return r.doctorName + ' ' + num(r.visitCount) + ' 人次'
            })
            .join('、') +
          '。口径：按 visits 记录数统计（全量演示数据，非仅当日），演示基准日 ' + ctx.demoToday + '。'
    const basis = top.map(function (r) {
      return {
        label: r.doctorName + ' 接诊量',
        value: num(r.visitCount) + ' 人次',
        source: 'selectors.doctorWorkload.' + r.doctorId + '.visitCount',
        raw: num(r.visitCount)
      }
    })
    return {
      intent: 'doctorWorkload',
      answer: answer,
      basis: basis,
      actions: ['visits', 'schedules'],
      followups: ['科室收入结构如何？', '今天门诊量多少？', '待接诊有多少？'],
      confidence: 0.9
    }
  }
}

/** 关键词识别意图；未识别返回 null */
function detectIntent(question) {
  const q = String(question === undefined || question === null ? '' : question).trim()
  if (!q) return null
  for (let i = 0; i < INTENTS.length; i++) {
    const def = INTENTS[i]
    for (let k = 0; k < def.keywords.length; k++) {
      if (q.indexOf(def.keywords[k]) !== -1) return def
    }
  }
  return null
}

/** 只读上下文：仅取问答所需的聚合与队列快照（不包含全量敏感数据） */
function buildContext(sel) {
  const stats = sel.stats()
  const wards = sel.byIdMap('wards')
  function amountOf(v) {
    const prescriptions = (v.prescriptions || []).reduce(function (acc, x) {
      return acc + num(x.amountCents)
    }, 0)
    const exams = (v.exams || []).reduce(function (acc, x) {
      return acc + num(x.amountCents)
    }, 0)
    return prescriptions + exams
  }
  function visitBrief(v) {
    return {
      id: v.id,
      code: v.code,
      date: v.date,
      doctorId: v.doctorId,
      departmentId: v.departmentId,
      chargeStatus: v.chargeStatus,
      dispenseStatus: v.dispenseStatus,
      reportStatus: v.reportStatus,
      amountCents: amountOf(v)
    }
  }
  return {
    stats: stats,
    rules: sel.rules(),
    medicines: sel.list('medicines').map(function (m) {
      return { id: m.id, name: m.name, unit: m.unit, stock: num(m.stock), status: m.status }
    }),
    lowStock: sel.lowStockMedicines().map(function (m) {
      return { id: m.id, name: m.name, unit: m.unit, stock: num(m.stock) }
    }),
    pendingTriage: sel
      .list('registrations')
      .filter(function (r) {
        return r.regStatus === '待分诊'
      })
      .map(function (r) {
        return { id: r.id, doctorId: r.doctorId, departmentId: r.departmentId, date: r.date, payStatus: r.payStatus }
      }),
    pendingCharge: sel.pendingVisits('charge').map(visitBrief),
    pendingDispense: sel.pendingVisits('dispense').map(visitBrief),
    pendingReports: sel.pendingVisits('report').map(visitBrief),
    pendingOrders: sel.pendingOrders().map(function (o) {
      return { id: o.id, name: o.name, status: o.status, admissionId: o.admissionId }
    }),
    pendingAdm: sel.pendingAdmissions().map(function (a) {
      return { id: a.id, status: a.status, wardId: a.wardId, bedId: a.bedId }
    }),
    pendingSettle: sel.pendingSettlements().map(function (a) {
      return { id: a.id, status: a.status }
    }),
    unpaidRegs: sel.unpaidRegistrations().map(function (r) {
      return { id: r.id, date: r.date, payStatus: r.payStatus }
    }),
    disabledBeds: sel.disabledBeds().map(function (b) {
      return {
        id: b.id,
        code: b.code,
        wardId: b.wardId,
        wardName: (wards[b.wardId] || {}).name || '未知病区',
        remark: b.remark,
        enabled: b.enabled
      }
    }),
    bedTurnover: sel.bedTurnover(),
    revenueByDept: sel.revenueByDepartment(),
    doctorWorkload: sel.doctorWorkload()
  }
}

module.exports = {
  name: 'assistant.qa',
  title: 'Ask Astra 业务助手',
  batch: 'B4',
  readOnly: true,
  description: '自然语言只读问答：结论 + 数据依据（source/raw）+ 建议入口 + 追问，按角色权限收敛',
  disclaimers: [DEMO, READONLY],
  outputSchema: {
    answer: 'string',
    intent: 'string',
    basis: 'array<object>',
    actions: 'array<object>',
    followups: 'array<string>',
    disclaimers: 'array'
  },
  buildContext: buildContext,
  generate: function (ctx, input) {
    const context = ctx || {}
    const data = context.data || {}
    const safeInput = input || context.input || {}
    const question = String(safeInput.question || '').trim()
    const def = detectIntent(question)
    let result
    if (!def) {
      result = HANDLERS.unknown(context, data)
    } else if (def.domain && !((context.actor && context.actor.domains) || {})[def.domain]) {
      result = deniedResult(context, def)
    } else {
      result = HANDLERS[def.id](context, data)
    }
    const payload = {
      answer: result.answer,
      intent: result.intent,
      basis: result.basis || [],
      actions: pickActions(context.actor, result.actions || []),
      followups: result.followups || [],
      disclaimers: [DEMO, READONLY]
    }
    return {
      text: payload.answer,
      confidence: typeof result.confidence === 'number' ? result.confidence : 0.8,
      basis: payload.basis,
      data: payload
    }
  },
  fallback: function () {
    return {
      answer: '助手输出未通过结构校验，已回退为"暂无结论"，请人工核对数据或换个问法。',
      intent: 'fallback',
      basis: [],
      actions: [],
      followups: ['我能做什么？'],
      disclaimers: [DEMO, READONLY]
    }
  }
}
