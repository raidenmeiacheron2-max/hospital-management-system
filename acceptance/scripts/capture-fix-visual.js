// =====================================================================
// 缺陷修复验收截图（W1/W2/W3）——隔离浏览器配置，不接触用户 localStorage
// 用法：node acceptance/scripts/capture-fix-visual.js
// 输出：acceptance/screenshots/fix/
// =====================================================================
const fs = require('fs')
const os = require('os')
const path = require('path')
const { spawn } = require('child_process')
const puppeteer = require('puppeteer-core')

const BASE = 'http://localhost:8080'
const OUT = path.join(__dirname, '..', 'screenshots', 'fix')
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const EDGE2 = 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const CDP_PORT = 9446
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

fs.mkdirSync(OUT, { recursive: true })

async function launch() {
  const exe = fs.existsSync(EDGE) ? EDGE : fs.existsSync(EDGE2) ? EDGE2 : CHROME
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'astra-fix-'))
  const proc = spawn(
    exe,
    ['--headless=new', `--remote-debugging-port=${CDP_PORT}`, '--no-sandbox', '--disable-gpu', '--no-first-run', '--window-size=1440,900', `--user-data-dir=${profile}`, 'about:blank'],
    { stdio: 'ignore' }
  )
  const deadline = Date.now() + 30000
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`)
      await res.json()
      return { browser: await puppeteer.connect({ browserURL: `http://127.0.0.1:${CDP_PORT}` }), proc }
    } catch (e) {
      await sleep(500)
    }
  }
  try { proc.kill() } catch (e) {}
  throw new Error('CDP 未就绪')
}

async function main() {
  const { browser, proc } = await launch()
  const page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 900 })
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e && e.message ? e.message : e)))
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })

  const nav = async (hash) => {
    await page.goto(BASE + '/#' + hash, { waitUntil: 'networkidle0', timeout: 30000 })
    await sleep(1400)
  }
  const shot = async (name) => {
    await sleep(500)
    await page.screenshot({ path: path.join(OUT, name + '.png') })
    console.log('SHOT ' + name)
  }
  const waitText = async (text, timeout = 8000) => {
    try {
      await page.waitForFunction((t) => document.body.innerText.indexOf(t) !== -1, { timeout }, text)
      return true
    } catch (e) { return false }
  }

  // 登录（账号默认预填 admin，需全选后输入）
  await page.goto(BASE + '/#/login', { waitUntil: 'networkidle0', timeout: 30000 })
  await sleep(1200)
  const fill = async (selector, text) => {
    const el = await page.$(selector)
    await el.click({ clickCount: 3 })
    await el.type(text)
  }
  await fill('input[placeholder="请输入登录账号"]', 'admin')
  await fill('input[placeholder="请输入密码"]', '123456')
  await page.click('.login-btn')
  await sleep(2500)
  if (!(await page.evaluate(() => localStorage.getItem('astra_hospital_token')))) throw new Error('登录失败')

  const results = []

  // W1：医技申请列表（历史待报告可见）
  await nav('/outpatient/exam-applies')
  const w1 = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('.el-table__body-wrapper tbody tr')].map((r) => r.innerText.replace(/\s+/g, ' '))
    return {
      total: (document.body.innerText.match(/共\s*\d+\s*条/) || [''])[0],
      pending: rows.filter((r) => r.indexOf('待报告') !== -1).map((r) => (r.match(/VIS\d+/) || [''])[0])
    }
  })
  results.push({ W1: w1 })
  await shot('01-W1-exam-applies')

  // W2：接诊弹窗医技项目下拉标签
  await nav('/outpatient/visits')
  await page.evaluate(() => {
    const row = document.querySelector('.el-table__body-wrapper tbody tr')
    const link = row ? [...row.querySelectorAll('.el-link--inner')].find((s) => s.textContent.trim() === '修改') : null
    if (link) link.click()
  })
  await sleep(1400)
  await page.evaluate(() => {
    const dlg = [...document.querySelectorAll('.el-dialog')].find((d) => d.offsetParent !== null)
    const input = dlg ? [...dlg.querySelectorAll('.el-select input')].find((i) => (i.getAttribute('placeholder') || '').indexOf('请选择项目') !== -1) : null
    if (input) input.click()
  })
  await sleep(900)
  const w2 = await page.evaluate(() => {
    const labels = [...document.querySelectorAll('.el-select-dropdown__item')].filter((o) => o.offsetParent !== null).map((o) => o.textContent.trim())
    return { count: labels.length, hasUndefined: labels.some((t) => t.indexOf('undefined') !== -1), sample: labels.slice(0, 4) }
  })
  results.push({ W2: w2 })
  await shot('02-W2-exam-labels')
  await page.keyboard.press('Escape')
  await sleep(400)

  // W3：应用建议明确反馈 + 标记采纳状态
  await page.evaluate(() => {
    const dlg = [...document.querySelectorAll('.el-dialog')].find((d) => d.offsetParent !== null)
    const b = dlg ? [...dlg.querySelectorAll('button')].find((x) => x.innerText.trim() === '解析当前文本') : null
    if (b) b.click()
  })
  await sleep(1800)
  await page.evaluate(() => {
    const dlg = [...document.querySelectorAll('.el-dialog')].find((d) => d.offsetParent !== null)
    const b = dlg ? [...dlg.querySelectorAll('button')].find((x) => x.innerText.trim().indexOf('应用建议') === 0) : null
    if (b) b.click()
  })
  await sleep(1000)
  const w3Hint = await page.evaluate(() => {
    const dlg = [...document.querySelectorAll('.el-dialog')].find((d) => d.offsetParent !== null)
    return dlg ? [...dlg.querySelectorAll('.el-alert__title')].map((x) => x.textContent.trim()).join(' | ') : ''
  })
  // 滚动弹窗内容到 AI 面板底部，确保持久反馈可见
  await page.evaluate(() => {
    const dlg = [...document.querySelectorAll('.el-dialog')].find((d) => d.offsetParent !== null)
    if (!dlg) return
    const scroller = [...dlg.querySelectorAll('*')].find((el) => el.scrollHeight > el.clientHeight + 20 && getComputedStyle(el).overflowY !== 'visible')
    if (scroller) scroller.scrollTop = scroller.scrollHeight
  })
  await sleep(600)
  results.push({ W3: { hint: w3Hint } })
  await shot('03-W3-apply-feedback')

  await page.evaluate(() => {
    const dlg = [...document.querySelectorAll('.el-dialog')].find((d) => d.offsetParent !== null)
    const b = dlg ? [...dlg.querySelectorAll('button')].find((x) => x.innerText.trim() === '标记采纳') : null
    if (b) b.click()
  })
  await sleep(1200)
  const w3Accepted = await page.evaluate(() => {
    const dlg = [...document.querySelectorAll('.el-dialog')].find((d) => d.offsetParent !== null)
    return dlg ? dlg.innerText.indexOf('已标记采纳') !== -1 : false
  })
  results.push({ W3Accepted: w3Accepted })
  await shot('04-W3-accepted')

  // 关闭弹窗（不保存）
  await page.evaluate(() => {
    const dlg = [...document.querySelectorAll('.el-dialog')].find((d) => d.offsetParent !== null)
    const b = dlg ? [...dlg.querySelectorAll('button')].find((x) => x.innerText.replace(/\s/g, '') === '取消') : null
    if (b) b.click()
  })
  await sleep(600)

  results.push({ consoleErrors: errors.slice(0, 10) })
  console.log('RESULT ' + JSON.stringify(results, null, 1))
  await browser.close()
  try { proc.kill() } catch (e) {}
}

main().catch((e) => {
  console.error('CAPTURE FAILED: ' + (e && e.stack ? e.stack : e))
  process.exit(1)
})
