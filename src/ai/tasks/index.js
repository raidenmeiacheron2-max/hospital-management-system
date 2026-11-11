// =====================================================================
// 内置 AI 任务注册（B3）
// 新增任务：在本文件追加 require 并加入 modules 数组；任务文件只导出定义。
// =====================================================================
const registry = require('../taskRegistry')

const modules = [
  require('./selftest'),
  require('./todoPriority'),
  require('./reminderExplain'),
  require('./assistant'),
  require('./anomaly'),
  require('./report'),
  require('./recordStruct'),
  require('./forecast')
]

modules.forEach(function (m) {
  const list = Array.isArray(m) ? m : [m]
  list.forEach(function (def) {
    registry.registerTask(def)
  })
})

module.exports = modules
