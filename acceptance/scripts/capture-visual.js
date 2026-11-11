// =====================================================================
// 最终验收 · 独立视觉截图脚本（隔离浏览器配置，不接触用户 localStorage）
// - 使用 puppeteer-core + 系统 Edge/Chrome，临时 user-data-dir（mkdtemp）
// - 登录 admin/123456（种子演示数据）
// - 输出 1440x900 / 1024x768 / 375x667 关键页面截图到 acceptance/screenshots/clean/
// 用法：node acceptance/scripts/capture-visual.js
// =====================================================================
const fs = require('fs')
const os = require('os')
const path = require('path')
const { spawn } = require('child_process')
const puppeteer = require('puppeteer-core')

const BASE = 'http://localhost:8080'
const OUT = path.join(__dirname, '..', 'screenshots', 'clean')
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const EDGE2 = 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const CDP_PORT = 9444

fs.mkdirSync(OUT, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function launch() {
  const exe = fs.existsSync(EDGE) ? EDGE : fs.existsSync(EDGE2) ? EDGE2 : CHROME
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'astra-accept-'))
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
      const browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${CDP_PORT}` })
      return { browser, proc }
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

  const shot = async (name) => {
    await sleep(700)
    await page.screenshot({ path: path.join(OUT, name + '.png') })
    console.log('SHOT ' + name)
  }
  const nav = async (hash) => {
    await page.goto(BASE + '/#' + hash, { waitUntil: 'networkidle0', timeout: 30000 })
    await sleep(1200)
  }
  const bodyText = () => page.evaluate(() => document.body.innerText)
  const waitText = async (text, timeout = 8000) => {
    try {
      await page.waitForFunction((t) => document.body.innerText.indexOf(t) !== -1, { timeout }, text)
      return true
    } catch (e) { return false }
  }

  // 登录（账号输入框默认预填 admin，需先全选再输入，避免拼接）
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
  const token = await page.evaluate(() => localStorage.getItem('astra_hospital_token'))
  if (!token) throw new Error('登录失败：未获得 token')

  const results = []

  // 管理员工作台
  await nav('/dashboard')
  results.push({ page: 'admin-workbench', text: (await bodyText()).length })
  await shot('01-admin-workbench-1440')

  // Ask Astra：提问并等待回答
  await nav('/ai/assistant')
  await page.evaluate(() => {
    const els = [...document.querySelectorAll('body *')].filter((e) => e.children.length === 0 && e.textContent.trim() === '今天门诊量多少？')
    if (els.length) els[els.length - 1].click()
  })
  await sleep(1800)
  results.push({ page: 'ai-assistant', hasBasis: await waitText('数据依据', 6000) })
  await shot('02-ai-assistant-1440')

  // 智能报表
  await nav('/ai/reports')
  results.push({ page: 'ai-reports', hasTotal: await waitText('¥1021.10', 6000) })
  await shot('03-ai-reports-1440')

  // 运营异常分析
  await nav('/ai/anomaly')
  results.push({ page: 'ai-anomaly', hasB12: await waitText('床位停用', 6000) })
  await shot('04-ai-anomaly-1440')

  // 预测分析
  await nav('/ai/forecast')
  results.push({ page: 'ai-forecast', hasRange: await waitText('预测区间', 8000), canvas: await page.evaluate(() => document.querySelectorAll('canvas').length) })
  await shot('05-ai-forecast-1440')

  // AI 治理中心（自检）
  await nav('/ai/center')
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.innerText.trim() === '运行自检')
    if (b) b.click()
  })
  await sleep(1800)
  results.push({ page: 'ai-center', selftest: await waitText('自检通过', 6000) })
  await shot('06-ai-governance-center-1440')

  // 病历结构化：打开接诊修改 → 解析 → 滚动到 AI 面板
  await nav('/outpatient/visits')
  await page.evaluate(() => {
    const row = document.querySelector('.el-table__body-wrapper tbody tr')
    const link = row ? [...row.querySelectorAll('.el-link--inner')].find((s) => s.textContent.trim() === '修改') : null
    if (link) link.click()
  })
  await sleep(1500)
  await page.evaluate(() => {
    const dlg = [...document.querySelectorAll('.el-dialog')].find((d) => d.offsetParent !== null)
    const b = dlg ? [...dlg.querySelectorAll('button')].find((x) => x.innerText.trim() === '解析当前文本') : null
    if (b) b.click()
  })
  await sleep(1800)
  await page.evaluate(() => {
    const dlg = [...document.querySelectorAll('.el-dialog')].find((d) => d.offsetParent !== null)
    if (!dlg) return
    const scroller = [...dlg.querySelectorAll('*')].find((el) => el.scrollHeight > el.clientHeight + 20 && getComputedStyle(el).overflowY !== 'visible')
    if (scroller) scroller.scrollTop = scroller.scrollHeight
  })
  await sleep(800)
  results.push({ page: 'record-structure', parsed: await waitText('诊断关键词', 4000) })
  await shot('07-record-structure-1440')
  await page.evaluate(() => {
    const dlg = [...document.querySelectorAll('.el-dialog')].find((d) => d.offsetParent !== null)
    const b = dlg ? [...dlg.querySelectorAll('button')].find((x) => x.innerText.replace(/\s/g, '') === '取消') : null
    if (b) b.click()
  })
  await sleep(600)

  // 患者 360° 时间线（选择患者）
  await nav('/patients/timeline')
  await page.evaluate(() => {
    const inp = document.querySelector('.el-select input[placeholder="搜索并选择患者"]')
    if (inp) inp.click()
  })
  await sleep(800)
  await page.evaluate(() => {
    const opt = [...document.querySelectorAll('.el-select-dropdown__item')].find((o) => o.offsetParent !== null && o.innerText.indexOf('周启航') !== -1)
    if (opt) opt.click()
  })
  await sleep(1800)
  results.push({ page: 'timeline', hasNodes: await waitText('诊疗全流程', 6000) })
  await shot('08-patient-timeline-1440')

  // 审计中心
  await nav('/system/audit')
  results.push({ page: 'audit', hasRows: await page.evaluate(() => document.querySelectorAll('.el-table__body-wrapper tbody tr').length) })
  await shot('09-audit-center-1440')

  // 响应式：1024 与 375（登录页 + AI 助手 + 报表）
  await page.setViewport({ width: 1024, height: 768 })
  await nav('/ai/assistant')
  const overflow1024 = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2)
  await shot('10-ai-assistant-1024')
  await nav('/ai/reports')
  await shot('11-ai-reports-1024')
  await page.setViewport({ width: 375, height: 667 })
  await page.evaluate(() => localStorage.removeItem('astra_hospital_token'))
  await page.goto(BASE + '/#/login', { waitUntil: 'networkidle0' })
  await sleep(1400)
  const overflow375 = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2)
  await shot('12-login-375')
  results.push({ responsive: { overflow1024, overflow375 } })

  // 控制台错误
  results.push({ consoleErrors: errors.slice(0, 10) })

  console.log('RESULT ' + JSON.stringify(results, null, 1))
  await browser.close()
  try { proc.kill() } catch (e) {}
}

main().catch((e) => {
  console.error('CAPTURE FAILED: ' + (e && e.stack ? e.stack : e))
  process.exit(1)
})
