// =====================================================================
// 任务注册表（B3）
// 每个任务声明：name / title / batch / readOnly / outputSchema / buildContext / generate
// - readOnly 必须为 true（G1：AI 层无写能力）
// - outputSchema 用于 G2 运行时校验
// - disclaimers 由 G3 强制注入
// 任务实现文件位于 src/ai/tasks/*.js，由 tasks/index.js 统一注册。
// =====================================================================
const tasks = {}

function assertTask(def) {
  if (!def || typeof def !== 'object') throw new Error('任务定义不合法：必须为对象')
  ;['name', 'title', 'batch', 'outputSchema'].forEach(function (k) {
    if (def[k] === undefined || def[k] === null || def[k] === '') throw new Error('任务定义不合法：缺少 ' + k)
  })
  if (def.readOnly !== true) throw new Error('任务 ' + def.name + ' 必须声明 readOnly:true（AI 无写能力）')
  if (typeof def.generate !== 'function') throw new Error('任务 ' + def.name + ' 缺少 generate()')
  if (typeof def.buildContext !== 'function') throw new Error('任务 ' + def.name + ' 缺少 buildContext()')
  return true
}

function registerTask(def) {
  assertTask(def)
  if (tasks[def.name]) throw new Error('任务重复注册：' + def.name)
  tasks[def.name] = def
  return def
}

function getTask(name) {
  return tasks[name] || null
}

function listTasks() {
  return Object.keys(tasks).map(function (name) {
    const t = tasks[name]
    return {
      name: t.name,
      title: t.title,
      batch: t.batch,
      readOnly: t.readOnly === true,
      description: t.description || '',
      disclaimerCount: (t.disclaimers || []).length,
      schemaFields: Object.keys(t.outputSchema || {}).length
    }
  })
}

function count() {
  return Object.keys(tasks).length
}

module.exports = { registerTask, getTask, listTasks, count }
