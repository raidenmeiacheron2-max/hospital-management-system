// =====================================================================
// AI 任务测试入口：node tests/ai/run.js（npm run test:ai）
// - 每个用例文件位于 tests/ai/cases/*.js，导出 register({ test, section, db, ai })
// - 每个 test 前自动 db.resetAll()，保证确定性（demoToday=2026-08-28）
// - 不启动浏览器、不写业务数据；失败以非零退出码结束
// =====================================================================
const fs = require('fs')
const path = require('path')
const db = require('../../src/mock/db')
const ai = require('../../src/ai')

let passed = 0
let failed = 0
const failures = []

function test(name, fn) {
  try {
    db.resetAll()
    fn()
    passed++
    console.log('  ✔ ' + name)
  } catch (e) {
    failed++
    failures.push({ name: name, error: e })
    console.error('  ✘ ' + name + ' — ' + (e && e.message ? e.message : e))
  }
}

function section(name) {
  console.log('■ ' + name)
}

const api = { test: test, section: section, db: db, ai: ai }
const casesDir = path.join(__dirname, 'cases')

if (fs.existsSync(casesDir)) {
  const files = fs
    .readdirSync(casesDir)
    .filter(function (f) { return /\.js$/.test(f) })
    .sort()
  files.forEach(function (f) {
    const mod = require(path.join(casesDir, f))
    if (typeof mod === 'function') mod(api)
    else if (mod && typeof mod.register === 'function') mod.register(api)
    else console.error('  ! 跳过无效用例文件：' + f + '（需导出 function 或 { register }）')
  })
}

console.log('\nAI 任务测试：通过 ' + passed + '，失败 ' + failed)
if (failed) {
  failures.forEach(function (f) {
    console.error('  - ' + f.name + '：' + (f.error && f.error.stack ? f.error.stack.split('\n').slice(0, 3).join(' | ') : f.error))
  })
  process.exit(1)
}
