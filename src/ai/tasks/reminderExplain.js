// =====================================================================
// 任务：reminder.explain（B3 注册，B4 UI 接入）
// 用途：解释系统提醒的触发依据并给出处理建议（只读，不改变提醒状态）。
// 说明：提醒"完成"仍由数据层规则实时判定（D9），AI 不参与状态变更。
// =====================================================================
const guardrails = require('../guardrails')

const RULE_SUGGESTION = {
  lowStock: '建议核对采购计划并及时补货，使库存高于阈值后再复核提醒。',
  bedOccupancy: '建议优先安排可出院患者、协调转床，必要时排查停用床位（如检修床位）。',
  pendingReport: '建议医技科室按开单时间优先处理待出报告，完成后提醒自动消失。',
  pendingDispense: '建议药房按收费顺序发药，发药后提醒自动完成。',
  pendingOrder: '建议护理站按医嘱优先级执行，执行后提醒自动完成。',
  stockExpiring: '建议先进先出，临期批次优先使用或联系药剂科处理。',
  unpaidRegistration: '建议收费窗口确认缴费状态后再进行分诊。'
}

module.exports = {
  name: 'reminder.explain',
  title: '系统提醒解释',
  batch: 'B3',
  readOnly: true,
  description: '解释提醒触发依据与处理建议（不改变提醒状态）',
  disclaimers: [guardrails.DISCLAIMER.DEMO, guardrails.DISCLAIMER.READONLY],
  outputSchema: {
    found: 'boolean',
    title: 'string',
    basis: 'array<string>',
    suggestion: 'string',
    links: 'array'
  },
  buildContext: function (sel, input) {
    return {
      reminders: sel.reminders(),
      rules: sel.rules(),
      targetId: (input && input.reminderId) || ''
    }
  },
  generate: function (ctx) {
    const data = ctx.data || {}
    const items = (data.reminders && data.reminders.items) || []
    const target = items.find(function (it) { return it.id === data.targetId })
    if (!target) {
      return {
        text: '未找到该提醒，可能对应问题已解决并自动完成。',
        confidence: 0.6,
        basis: ['提醒规则实时计算：问题解决后提醒自动消失', '当前有效提醒 ' + items.length + ' 条'],
        data: {
          found: false,
          title: '',
          basis: ['提醒规则实时计算：问题解决后提醒自动消失', '当前有效提醒 ' + items.length + ' 条'],
          suggestion: '刷新提醒列表查看最新状态。',
          links: [{ label: '提醒中心', path: '/workbench/reminders' }]
        }
      }
    }
    const rule = target.rule || ''
    const suggestion = RULE_SUGGESTION[rule] || '建议结合业务实际处理，处理完成后提醒将自动完成。'
    const basis = [
      '规则：' + rule + '（' + (target.level === 'high' ? '高' : target.level === 'medium' ? '中' : '低') + '优先级）',
      '触发依据：' + (target.detail || ''),
      '演示基准日：' + ctx.demoToday + '，阈值：' + JSON.stringify((ctx.data && ctx.data.rules) || {})
    ]
    const text = '提醒「' + (target.title || '') + '」：' + (target.detail || '') + '。' + suggestion
    return {
      text: text,
      confidence: 0.85,
      basis: basis,
      data: {
        found: true,
        title: target.title || '',
        basis: basis,
        suggestion: suggestion,
        links: target.link ? [{ label: '前往处理', path: target.link }] : []
      }
    }
  },
  fallback: function () {
    return { found: false, title: '', basis: [], suggestion: '暂无可用解释，请人工核对提醒依据。', links: [] }
  }
}
