// =====================================================================
// 单个 AI 用例文件运行器（避免并行开发时其他用例文件的语法错误互相影响）
// 用法：node tests/ai/run-one.js tests/ai/cases/assistant.test.js
// =====================================================================
const path = require('path')
const db = require('../../src/mock/db')
const ai = require('../../src/ai')

const file = process.argv[2]
if (!file) {
  console.error('用法：node tests/ai/run-one.js <用例文件>')
  process.exit(2)
}

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

const mod = require(path.resolve(file))
const api = { test: test, section: section, db: db, ai: ai }
if (typeof mod === 'function') mod(api)
else if (mod && typeof mod.register === 'function') mod.register(api)
else {
  console.error('无效用例文件：' + file)
  process.exit(2)
}

console.log('\n' + path.basename(file) + '：通过 ' + passed + '，失败 ' + failed)
if (failed) process.exit(1)
