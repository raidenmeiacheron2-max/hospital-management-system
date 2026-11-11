// =====================================================================
// 任务：todo.priority（B3 注册，B4 UI 接入）
// 用途：为个人待办给出优先级建议与理由。
// 只读：复用数据层既有只读规则 db.suggestTodoPriority（同一口径，保证一致），
//       不写任何数据；用户采纳后由原有待办接口保存。
// =====================================================================
const guardrails = require('../guardrails')

module.exports = {
  name: 'todo.priority',
  title: '待办优先级建议',
  batch: 'B3',
  readOnly: true,
  description: '结合截止时间与关联模块给出优先级建议及理由',
  disclaimers: [guardrails.DISCLAIMER.DEMO, guardrails.DISCLAIMER.READONLY],
  outputSchema: {
    priority: 'string',
    reason: 'string',
    suggestion: 'string',
    basis: 'array'
  },
  buildContext: function (sel, input) {
    return {
      rule: sel.suggestTodoPriority({
        title: input.title,
        dueDate: input.dueDate,
        module: input.module,
        description: input.description
      })
    }
  },
  generate: function (ctx) {
    const rule = (ctx.data && ctx.data.rule) || {}
    const priority = rule.priority || '低'
    const reason = rule.reason || '常规事务'
    const suggestion =
      priority === '高'
        ? '建议今日优先处理，并在处理前确认关联业务状态。'
        : priority === '中'
          ? '建议在截止前 2 天内处理，关注关联业务变化。'
          : '可按常规节奏处理，截止前复核即可。'
    const text = '建议优先级：' + priority + '。理由：' + reason + '。' + suggestion
    return {
      text: text,
      confidence: 0.8,
      basis: [
        { label: '截止日期', value: ctx.input && ctx.input.dueDate ? ctx.input.dueDate : '未设置' },
        { label: '关联模块', value: (ctx.input && ctx.input.module) || '未关联' },
        { label: '演示基准日', value: ctx.demoToday }
      ],
      data: {
        priority: priority,
        reason: reason,
        suggestion: suggestion,
        basis: [
          { label: '截止日期', value: (ctx.input && ctx.input.dueDate) || '未设置' },
          { label: '关联模块', value: (ctx.input && ctx.input.module) || '未关联' }
        ]
      }
    }
  },
  fallback: function () {
    return { priority: '中', reason: '规则输出异常，按默认优先级处理', suggestion: '请人工判断优先级。', basis: [] }
  }
}
