// =====================================================================
// .vue 单文件语法检查（模板编译 + 脚本语法），不依赖 webpack 构建
// 用法：node tools/check-vue.js src/views/ai/Assistant.vue [更多文件...]
// =====================================================================
const fs = require('fs')
const compiler = require('vue-template-compiler')
const parser = require('@babel/parser')

const files = process.argv.slice(2)
if (!files.length) {
  console.error('用法：node tools/check-vue.js <file.vue> [...]')
  process.exit(2)
}

let bad = 0
files.forEach(function (f) {
  let ok = true
  const src = fs.readFileSync(f, 'utf8')
  const sfc = compiler.parseComponent(src)
  if (!sfc.template) {
    console.error('✘ ' + f + '：缺少 <template>')
    bad++
    return
  }
  const compiled = compiler.compile(sfc.template.content)
  if (compiled.errors && compiled.errors.length) {
    console.error('✘ ' + f + '：模板错误 -> ' + compiled.errors.join(' | '))
    ok = false
  }
  if (sfc.script && sfc.script.content) {
    try {
      parser.parse(sfc.script.content, {
        sourceType: 'module',
        plugins: ['objectRestSpread', 'dynamicImport', 'optionalChaining', 'nullishCoalescingOperator']
      })
    } catch (e) {
      console.error('✘ ' + f + '：脚本语法错误 -> ' + e.message)
      ok = false
    }
  }
  if (!ok) bad++
  else console.log('✔ ' + f)
})

if (bad) process.exit(1)
