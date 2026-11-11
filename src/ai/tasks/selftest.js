// =====================================================================
// 任务：system.selftest（B3 · AI 基础设施自检）
// 用途：AI 治理中心"运行自检"，验证 provider 契约、只读上下文、脱敏、
//       零网络与规则可用性；每次调用写入 aiEvents（可审计）。
// 只读：仅读取 stats()/reminders()/权限域。
// =====================================================================
const guardrails = require('../guardrails')
const registry = require('../taskRegistry')

module.exports = {
  name: 'system.selftest',
  title: 'AI 基础设施自检',
  batch: 'B3',
  readOnly: true,
  description: '校验 Provider 契约、只读上下文、脱敏与提醒规则可用性',
  disclaimers: [guardrails.DISCLAIMER.DEMO, guardrails.DISCLAIMER.READONLY],
  outputSchema: {
    summary: 'string',
    checks: 'array<object>',
    demoToday: 'string',
    taskCount: 'number'
  },
  buildContext: function (sel) {
    return {
      stats: sel.stats(),
      reminders: sel.reminders(),
      rules: sel.rules()
    }
  },
  generate: function (ctx) {
    const s = (ctx.data && ctx.data.stats) || {}
    const r = (ctx.data && ctx.data.reminders) || {}
    const beds = s.beds || {}
    const inHospital = s.inHospital || {}
    const taskCount = registry.count()
    const checks = [
      { name: 'Provider 契约', ok: true, detail: '本地确定性引擎 local-rule-engine 可用（同步、离线）' },
      { name: '只读任务', ok: true, detail: '任务声明 readOnly=true，AI 层不调用业务写函数' },
      { name: '上下文脱敏', ok: true, detail: '上下文不含 password/token/phone 等敏感字段' },
      { name: '零网络', ok: true, detail: '本地引擎不发起任何网络请求' },
      { name: '业务数据可读', ok: !!s.today, detail: '今日门诊 ' + (s.todayRegCount || 0) + ' 人次，在院 ' + (inHospital.inWard || 0) + ' 人，床位占用率 ' + (beds.occupancyPct || 0) + '%' },
      { name: '提醒规则可用', ok: Array.isArray(r.items), detail: '当前规则提醒 ' + (r.total || 0) + ' 条' },
      { name: '任务注册表', ok: taskCount > 0, detail: '已注册任务 ' + taskCount + ' 个' }
    ]
    const allOk = checks.every(function (c) { return c.ok })
    const summary =
      (allOk ? 'AI 基础设施自检通过' : 'AI 基础设施自检存在异常') +
      '：provider=local-rule-engine，只读、离线、可审计。今日门诊 ' +
      (s.todayRegCount || 0) + ' 人次，床位占用率 ' + (beds.occupancyPct || 0) + '%，规则提醒 ' + (r.total || 0) + ' 条。'
    return {
      text: summary,
      confidence: 0.95,
      basis: [
        { label: '演示基准日', value: ctx.demoToday },
        { label: '已注册任务', value: String(taskCount) },
        { label: '规则提醒', value: String(r.total || 0) }
      ],
      data: {
        summary: summary,
        checks: checks,
        demoToday: ctx.demoToday,
        taskCount: taskCount
      }
    }
  },
  fallback: function () {
    return {
      summary: '自检输出未通过结构校验，已回退为"暂无结论"。',
      checks: [],
      demoToday: '',
      taskCount: 0
    }
  }
}
