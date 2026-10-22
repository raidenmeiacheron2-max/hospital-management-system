// 调试：观测收费项目弹窗提交与挂号弹窗医生下拉的真实 DOM 状态
const path = require('path')
const fs = require('fs')
const os = require('os')
const { spawn } = require('child_process')
const puppeteer = require('puppeteer-core')

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const CDP_PORT = 9334
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const proc = spawn(
    EDGE,
    ['--headless=new', `--remote-debugging-port=${CDP_PORT}`, '--no-sandbox', '--disable-gpu', '--no-first-run', `--user-data-dir=${fs.mkdtempSync(path.join(os.tmpdir(), 'astra-dbg-'))}`, 'about:blank'],
    { stdio: 'ignore' }
  )
  let ok = false
  for (let i = 0; i < 60 && !ok; i++) {
    try {
      await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`)
      ok = true
    } catch (e) {
      await sleep(500)
    }
  }
  const browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${CDP_PORT}` })
  const page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 900 })
  page.on('console', (m) => console.log('[console]', m.type(), m.text().slice(0, 200)))
  page.on('pageerror', (e) => console.log('[pageerror]', e.message))
  page.setDefaultTimeout(20000)

  const clickByText = async (text, sel = 'button') => {
    const r = await page.evaluate(
      (s, t) => {
        const els = [...document.querySelectorAll(s)]
        const el = els.find((x) => x.textContent.trim() === t && x.offsetParent !== null) || els.find((x) => x.textContent.trim().indexOf(t) !== -1 && x.offsetParent !== null)
        if (el) {
          el.click()
          return true
        }
        return false
      },
      sel,
      text
    )
    console.log('[click]', text, '->', r)
    await sleep(400)
    return r
  }
  const typeInto = async (ph, text) => {
    await page.waitForFunction(
      (p) => [...document.querySelectorAll('input')].some((el) => el.offsetParent !== null && (el.getAttribute('placeholder') || '').indexOf(p) !== -1),
      {},
      ph
    )
    const h = await page.evaluateHandle((p) => {
      const inputs = [...document.querySelectorAll('input')].filter((el) => el.offsetParent !== null && (el.getAttribute('placeholder') || '').indexOf(p) !== -1)
      return inputs[inputs.length - 1]
    }, ph)
    await h.asElement().click({ clickCount: 3 })
    await h.asElement().type(text)
    await sleep(150)
    console.log('[type]', ph, '<-', text)
  }
  const pick = async (ph, opt) => {
    const h = await page.evaluateHandle((p) => {
      const inputs = [...document.querySelectorAll('.el-select input')].filter((el) => el.offsetParent !== null && (el.getAttribute('placeholder') || '').indexOf(p) !== -1)
      return inputs[inputs.length - 1]
    }, ph)
    await h.asElement().click()
    await sleep(800)
    const state = await page.evaluate(() =>
      [...document.querySelectorAll('.el-select-dropdown')].map((d) => ({ display: getComputedStyle(d).display, visible: d.offsetParent !== null, items: [...d.querySelectorAll('.el-select-dropdown__item')].map((i) => i.textContent.trim()) }))
    )
    console.log('[pick]', ph, JSON.stringify(state, null, 2))
    const r = await page.evaluate((t) => {
      const items = [...document.querySelectorAll('.el-select-dropdown__item')]
      const visible = items.filter((x) => x.offsetParent !== null)
      const el = visible.find((x) => x.textContent.trim().indexOf(t) !== -1)
      if (el) {
        el.click()
        return true
      }
      return false
    }, opt)
    console.log('[pick-option]', opt, '->', r)
    await sleep(400)
    return r
  }

  try {
    await page.goto('http://localhost:8080/#/login', { waitUntil: 'networkidle0' })
    await typeInto('登录账号', 'admin')
    await typeInto('请输入密码', '123456')
    await clickByText('登 录', '.login-btn')
    await sleep(2500)

    // ---- XHR 探针：绕过 axios，直接观测 Mock.js 对三类请求的响应 ----
    console.log('\n===== X. fee-items Mock 路由探针 =====')
    const probe = async (method, url, body) => {
      const r = await page.evaluate(
        (m, u, b) =>
          new Promise((res) => {
            const x = new XMLHttpRequest()
            x.open(m, u)
            x.setRequestHeader('Content-Type', 'application/json')
            x.onload = () => res('OK ' + x.status + ' | ' + x.responseText.slice(0, 160))
            x.onerror = () => res('XHR_ERROR')
            x.send(b)
          }),
        method,
        url,
        body
      )
      console.log(`[probe ${method} ${url}]`, r)
    }
    await probe('POST', '/api/fee-items', JSON.stringify({ code: 'SF9002', name: '探针项目', category: '门诊', priceCents: 1000, status: 1 }))
    await probe('PUT', '/api/fee-items/f1', JSON.stringify({ name: '探针改名' }))
    await probe('DELETE', '/api/fee-items/f1')

    console.log('\n===== A. 收费项目弹窗提交 =====')
    await page.goto('http://localhost:8080/#/basic/fee-items', { waitUntil: 'networkidle0' })
    await sleep(800)
    await clickByText('新增')
    await sleep(600)
    await typeInto('如 SF0007', 'SF9001')
    await typeInto('请输入项目名称', '调试项目')
    await typeInto('如 15.00', '10.00')
    const before = await page.evaluate(() => ({
      dialogs: [...document.querySelectorAll('.el-dialog')].filter((d) => d.offsetParent !== null).map((d) => d.textContent.trim().slice(0, 120))
    }))
    console.log('[dialogs before submit]', JSON.stringify(before))
    await clickByText('确 定', '.el-dialog__footer button')
    await sleep(2000)
    const after = await page.evaluate(() => ({
      messages: [...document.querySelectorAll('.el-message')].map((m) => m.textContent.trim()),
      openDialogs: [...document.querySelectorAll('.el-dialog')].filter((d) => d.offsetParent !== null).length,
      rows: [...document.querySelectorAll('.el-table__body-wrapper tbody tr')].map((tr) => tr.textContent.trim().slice(0, 60))
    }))
    console.log('[after submit]', JSON.stringify(after, null, 2))

    console.log('\n===== B. 挂号弹窗医生下拉 =====')
    await page.goto('http://localhost:8080/#/outpatient/registrations', { waitUntil: 'networkidle0' })
    await sleep(800)
    await clickByText('新增')
    await sleep(600)
    await pick('请选择患者', '林雪梅')
    await pick('请选择科室', '内科')
    await sleep(1200)
    const scheduleState = await page.evaluate(() => {
      const dialogs = [...document.querySelectorAll('.el-dialog')].filter((d) => d.offsetParent !== null)
      const dlg = dialogs[dialogs.length - 1]
      return dlg ? dlg.textContent.trim().slice(0, 300) : 'no dialog'
    })
    console.log('[dialog state]', scheduleState)
    await pick('请先选择科室与日期', '周明远')
    await sleep(1500)
    const final = await page.evaluate(() =>
      [...document.querySelectorAll('.el-select-dropdown')].map((d) => ({ display: getComputedStyle(d).display, items: [...d.querySelectorAll('.el-select-dropdown__item')].map((i) => i.textContent.trim()) }))
    )
    console.log('[doctor dropdown final]', JSON.stringify(final, null, 2))
  } catch (e) {
    console.log('[error]', e.message)
  } finally {
    await browser.close()
    try {
      proc.kill()
    } catch (e) {}
    process.exit(0)
  }
}

main()
