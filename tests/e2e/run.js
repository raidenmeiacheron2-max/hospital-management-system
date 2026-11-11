// =====================================================================
// 端到端验证：登录/退出、筛选重置、CRUD 持久化、末页删除回退、
// 排班冲突、挂号→接诊、退号禁接诊、入院占床/转床/出院释放、重置演示数据
// 同时输出九个目标画面截图到 tests/e2e/shots/
// 用法：先 npm run serve，再 npm run e2e
// 说明：浏览器多进程模型需要 Windows 命名管道，受限沙箱下无法启动
//       headless 浏览器；如需在本环境执行请以完整权限运行本命令一次。
// =====================================================================
const path = require('path')
const fs = require('fs')
const os = require('os')
const { spawn } = require('child_process')
const puppeteer = require('puppeteer-core')

const BASE = 'http://localhost:8080'
const SHOTS = path.join(__dirname, 'shots')
fs.mkdirSync(SHOTS, { recursive: true })

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const EDGE2 = 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const CDP_PORT = 9333

let passed = 0
let failed = 0
const consoleErrors = []
const errMessages = []

async function launchViaCdp(executablePath) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'astra-e2e-'))
  const proc = spawn(
    executablePath,
    [
      '--headless=new',
      `--remote-debugging-port=${CDP_PORT}`,
      '--no-sandbox',
      '--disable-gpu',
      '--no-first-run',
      '--window-size=1440,900',
      `--user-data-dir=${profile}`,
      'about:blank'
    ],
    { stdio: 'ignore' }
  )
  const deadline = Date.now() + 30000
  let version = null
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`)
      version = await res.json()
      break
    } catch (e) {
      await sleep(500)
    }
  }
  if (!version) {
    try {
      proc.kill()
    } catch (e) {}
    throw new Error('CDP 端点未就绪，浏览器启动失败')
  }
  const browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${CDP_PORT}` })
  return { browser, proc }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

function ok(name) {
  passed++
  console.log('  ✔ ' + name)
}

function fail(name, err) {
  failed++
  errMessages.push(name)
  console.log('  ✘ ' + name + ' — ' + (err && err.message ? err.message : err))
}

async function clickByText(page, text, sel = 'button') {
  const clicked = await page.evaluate(
    (s, t) => {
      const els = [...document.querySelectorAll(s)]
      const target = els.find((el) => el.textContent.trim() === t && el.offsetParent !== null)
      if (target) {
        target.click()
        return true
      }
      const partial = els.find((el) => el.textContent.trim().indexOf(t) !== -1 && el.offsetParent !== null)
      if (partial) {
        partial.click()
        return true
      }
      return false
    },
    sel,
    text
  )
  if (!clicked) throw new Error('button not found: ' + text)
  await sleep(400)
}

/** 在指定患者所在表格行内点击操作链接 */
async function clickRowLink(page, rowText, linkText) {
  const clicked = await page.evaluate(
    (rowKey, link) => {
      const trs = [...document.querySelectorAll('.el-table__body-wrapper tbody tr')]
      const tr = trs.find((x) => x.textContent.indexOf(rowKey) !== -1)
      if (!tr) return 'no-row'
      const links = [...tr.querySelectorAll('.el-link')]
      const target = links.find((el) => el.textContent.trim() === link)
      if (target) {
        target.click()
        return true
      }
      return 'no-link'
    },
    rowText,
    linkText
  )
  if (clicked !== true) throw new Error(`row link not found: ${linkText} in row ${rowText} (${clicked})`)
  await sleep(400)
}

async function typeInto(page, placeholder, text) {
  await page.waitForFunction(
    (ph) =>
      [...document.querySelectorAll('input, textarea')].some(
        (el) => el.offsetParent !== null && (el.getAttribute('placeholder') || '').indexOf(ph) !== -1
      ),
    {},
    placeholder
  )
  const handle = await page.evaluateHandle((ph) => {
    const inputs = [...document.querySelectorAll('input, textarea')].filter(
      (el) => el.offsetParent !== null && (el.getAttribute('placeholder') || '').indexOf(ph) !== -1
    )
    // 弹窗渲染在 DOM 尾部，取最后一个可见匹配项
    return inputs[inputs.length - 1]
  }, placeholder)
  const el = handle.asElement()
  await el.click({ clickCount: 3 })
  await el.type(text)
  await sleep(150)
}

async function step(page, name, fn) {
  try {
    await fn()
  } catch (e) {
    e.message = `[step ${name}] ${e.message}`
    throw e
  }
}

async function pickSelect(page, placeholder, optionText) {
  await page.waitForFunction(
    (ph) =>
      [...document.querySelectorAll('.el-select input')].some(
        (el) => el.offsetParent !== null && (el.getAttribute('placeholder') || '').indexOf(ph) !== -1
      ),
    {},
    placeholder
  )
  const handle = await page.evaluateHandle((ph) => {
    const inputs = [...document.querySelectorAll('.el-select input')].filter(
      (el) => el.offsetParent !== null && (el.getAttribute('placeholder') || '').indexOf(ph) !== -1
    )
    return inputs[inputs.length - 1]
  }, placeholder)
  const el = handle.asElement()
  let clicked = false
  for (let attempt = 0; attempt < 2 && !clicked; attempt++) {
    if (attempt === 0) {
      await el.click()
    } else {
      // 首次点击可能只聚焦未展开；若下拉未展开则再点一次
      const open = await page.evaluate(() => {
        const dd = [...document.querySelectorAll('.el-select-dropdown')]
        return dd.some((d) => d.offsetParent !== null)
      })
      if (!open) await el.click()
    }
    await sleep(700)
    clicked = await page.evaluate((text) => {
      const items = [...document.querySelectorAll('.el-select-dropdown__item')]
      const visible = items.filter((x) => x.offsetParent !== null)
      const target = visible.find((x) => x.textContent.trim() === text)
      if (target) {
        target.click()
        return true
      }
      const partial = visible.find((x) => x.textContent.trim().indexOf(text) !== -1)
      if (partial) {
        partial.click()
        return true
      }
      return false
    }, optionText)
  }
  if (!clicked) {
    const items = await page.evaluate(() =>
      [...document.querySelectorAll('.el-select-dropdown__item')]
        .filter((el) => el.offsetParent !== null)
        .map((el) => el.textContent.trim())
    )
    throw new Error(`dropdown option not found: ${optionText} @ ${placeholder}; visible=[${items.join(' | ')}]`)
  }
  await sleep(400)
}

async function waitMessage(page, text, timeout = 6000) {
  try {
    await page.waitForFunction(
      (t) => [...document.querySelectorAll('.el-message')].some((m) => m.textContent.indexOf(t) !== -1),
      { timeout },
      text
    )
    return true
  } catch (e) {
    return false
  }
}

async function confirmBox(page, btnText = '确定') {
  await page.waitForSelector('.el-message-box__wrapper', { visible: true })
  await clickByText(page, btnText, '.el-message-box__btns button')
  await sleep(500)
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(SHOTS, name + '.png') })
  console.log('    📷 ' + name + '.png')
}

async function nav(page, hash) {
  // 强制整页加载，保证每次进入都是全新上下文
  await page.goto(BASE + '/#' + hash, { waitUntil: 'networkidle0', timeout: 30000 })
  await sleep(700)
}

/** 等待页面正文出现指定文本（用于 AI 页面断言） */
async function waitBodyText(page, text, timeout = 8000) {
  try {
    await page.waitForFunction((t) => document.body.innerText.indexOf(t) !== -1, { timeout }, text)
    return true
  } catch (e) {
    return false
  }
}

/** 点击页面正文中文本完全匹配的最深层可见元素（用于推荐问题 chips 等非按钮元素） */
async function clickBodyText(page, text) {
  const clicked = await page.evaluate((t) => {
    const els = [...document.querySelectorAll('body *')].filter(
      (el) => el.textContent.trim() === t && el.offsetParent !== null
    )
    if (!els.length) return false
    els[els.length - 1].click()
    return true
  }, text)
  await sleep(300)
  return clicked
}

/**
 * 日历面板翻页到目标年月（Element UI 日期面板含「上一年/上一月」两个 prev 按钮）。
 * 修复原「固定回退两个月」的日期敏感缺陷：按面板实际年月动态翻页。
 */
async function gotoCalendarMonth(page, targetYear, targetMonth) {
  for (let i = 0; i < 36; i++) {
    const cur = await page.evaluate(() => {
      const labels = [...document.querySelectorAll('.el-picker-panel .el-date-picker__header-label')].filter(
        (el) => el.offsetParent !== null
      )
      const year = labels[0] ? parseInt(labels[0].textContent, 10) : NaN
      const mm = labels[1] ? labels[1].textContent.match(/(\d+)/) : null
      return { year: year, month: mm ? parseInt(mm[1], 10) : NaN }
    })
    if (!cur.year || !cur.month) throw new Error('无法读取日历年月')
    const diff = (cur.year - targetYear) * 12 + (cur.month - targetMonth)
    if (diff === 0) return
    await page.evaluate((dir) => {
      const prev = [...document.querySelectorAll('.el-picker-panel button.el-date-picker__prev-btn')]
      const next = [...document.querySelectorAll('.el-picker-panel button.el-date-picker__next-btn')]
      if (dir > 0 && prev[1]) prev[1].click()
      else if (dir < 0 && next[1]) next[1].click()
    }, diff > 0 ? 1 : -1)
    await sleep(280)
  }
  throw new Error('日历年月切换失败')
}

async function gotoPage2(page) {
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('.el-pager li')]
    const p2 = btns.find((b) => b.textContent.trim() === '2')
    if (p2) p2.click()
  })
  await sleep(700)
}

async function main() {
  const executablePath = fs.existsSync(EDGE) ? EDGE : fs.existsSync(EDGE2) ? EDGE2 : CHROME
  console.log('browser: ' + executablePath)
  const { browser, proc } = await launchViaCdp(executablePath)
  const page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 900 })
  page.on('console', (msg) => {
    if (msg.type() === 'error' || (msg.type() === 'warning' && msg.text().indexOf('Duplicate keys') !== -1)) {
      consoleErrors.push(msg.text())
    }
  })
  page.on('pageerror', (err) => consoleErrors.push('PAGEERROR: ' + err.message))
  page.setDefaultTimeout(20000)

  const sections = []

  // ---------- 1 登录 ----------
  sections.push(['1. 登录守卫与登录', async () => {
    await page.goto(BASE + '/', { waitUntil: 'networkidle0', timeout: 30000 })
    await sleep(1000)
    if (page.url().indexOf('#/login') !== -1) ok('未登录访问首页被重定向到登录页')
    else fail('未登录访问首页被重定向到登录页', new Error(page.url()))
    await typeInto(page, '登录账号', 'admin')
    await typeInto(page, '请输入密码', '123456')
    await shot(page, '01-login')
    await clickByText(page, '登 录', '.login-btn')
    await sleep(2500)
    const loggedIn = await page.evaluate(() => !!document.querySelector('.card-title'))
    if (loggedIn) ok('登录成功进入首页')
    else fail('登录成功进入首页', new Error('dashboard 未加载'))
    await sleep(800)
    await shot(page, '02-dashboard')
  }])

  // ---------- 2 九页截图 ----------
  sections.push(['2. 九页导航截图', async () => {
    await nav(page, '/basic/staff')
    await shot(page, '03-staff')
    await nav(page, '/basic/beds')
    await shot(page, '04-beds')
    await nav(page, '/patients')
    await shot(page, '05-patients')
    await nav(page, '/outpatient/schedules')
    await sleep(500)
    await shot(page, '06-schedules')
    await nav(page, '/outpatient/registrations')
    await shot(page, '07-registrations')
    await nav(page, '/outpatient/visits')
    await clickByText(page, '接诊')
    await sleep(800)
    await shot(page, '08-visit-dialog')
    await clickByText(page, '取 消', '.el-dialog__footer button')
    await sleep(400)
    await nav(page, '/inpatient/admissions')
    await shot(page, '09-admissions')
    ok('九个目标画面截图完成')
  }])

  // ---------- 3 员工筛选 ----------
  sections.push(['3. 员工：筛选→空结果→重置', async () => {
    await nav(page, '/basic/staff')
    await typeInto(page, '请输入员工姓名', '不存在的员工xyz')
    await clickByText(page, '搜索')
    await sleep(600)
    if (await waitText(page, '.el-table__empty-text', '暂无数据', 5000)) ok('筛选无结果显示空状态')
    else fail('筛选无结果显示空状态')
    await clickByText(page, '重置')
    await sleep(700)
    const rowsBack = await page.$$eval('.el-table__body-wrapper tbody tr', (trs) => trs.length)
    if (rowsBack > 0) ok('重置后列表恢复（' + rowsBack + ' 行）')
    else fail('重置后列表恢复')
  }])

  // ---------- 4 末页删除回退（收费项目：造 5 条 → 第 2 页删最后一条） ----------
  sections.push(['4. 末页删除回退到有效页', async () => {
    await nav(page, '/basic/fee-items')
    await sleep(600)
    for (let i = 1; i <= 5; i++) {
      await clickByText(page, '新增')
      await sleep(400)
      await typeInto(page, '如 SF0007', 'SF10' + String(i).padStart(2, '0'))
      await typeInto(page, '请输入项目名称', '测试项目' + i)
      await typeInto(page, '如 15.00', '10.00')
      await clickByText(page, '确 定', '.el-dialog__footer button')
      await sleep(900)
      if (!(await waitMessage(page, '新增成功', 4000))) throw new Error('新增第 ' + i + ' 条失败')
    }
    await sleep(400)
    await gotoPage2(page)
    const page2Rows = await page.$$eval('.el-table__body-wrapper tbody tr', (trs) => trs.length)
    if (page2Rows !== 1) throw new Error('第 2 页应只有 1 条，实际 ' + page2Rows)
    // 删除该页最后一条（新造的第 5 条，无引用，可删除）
    await clickRowLink(page, '测试项目5', '删除')
    await confirmBox(page, '确定')
    await sleep(800)
    const activePage = await page.evaluate(() => {
      const act = document.querySelector('.el-pager li.active')
      return act ? act.textContent.trim() : '?'
    })
    const rowsAfter = await page.$$eval('.el-table__body-wrapper tbody tr', (trs) => trs.length)
    if (activePage === '1' && rowsAfter > 0) ok(`末页删除后回退到第 1 页（剩余 ${rowsAfter} 行）`)
    else fail('末页删除后回退到有效页', new Error('active=' + activePage + ' rows=' + rowsAfter))
    // 清理其余 4 条测试数据，恢复种子状态
    for (let i = 1; i <= 4; i++) {
      await typeInto(page, '请输入项目名称', '测试项目' + i)
      await clickByText(page, '搜索')
      await sleep(600)
      const hasRow = await page.$$eval('.el-table__body-wrapper tbody tr', (trs) => trs.length > 0)
      if (hasRow) {
        await clickRowLink(page, '测试项目' + i, '删除')
        await confirmBox(page, '确定')
        await sleep(700)
      }
      await clickByText(page, '重置')
      await sleep(400)
    }
  }])

  // ---------- 5 排班冲突 ----------
  sections.push(['5. 排班冲突校验', async () => {
    await nav(page, '/outpatient/schedules')
    await sleep(900)
    const opened = await page.evaluate(() => {
      const btns = [...document.querySelectorAll('.dep-card button')]
      const target = btns.find((b) => b.textContent.trim() === '排班' && b.offsetParent !== null)
      if (target) {
        target.click()
        return true
      }
      return false
    })
    if (!opened) throw new Error('排班按钮未找到')
    await sleep(600)
    await step(page, 'pick-doctor', () => pickSelect(page, '请选择医生', '周明远'))
    // 日历面板默认打开系统当前月份；动态翻页到种子排班所在的 2026-08 再选 28 日
    await step(page, 'open-calendar', async () => {
      const dateHandle = await page.evaluateHandle(() => {
        const inputs = [...document.querySelectorAll('.el-dialog input')].filter(
          (el) => (el.getAttribute('placeholder') || '').indexOf('选择日期') !== -1 && el.offsetParent !== null
        )
        return inputs[inputs.length - 1]
      })
      await dateHandle.asElement().click()
    })
    await sleep(800)
    await step(page, 'goto-2026-08', () => gotoCalendarMonth(page, 2026, 8))
    await step(page, 'pick-day', async () => {
      const picked = await page.evaluate(() => {
        const cells = [...document.querySelectorAll('.el-date-table td.available')]
        const target = cells.find((c) => c.textContent.trim() === '28')
        if (target) {
          target.click()
          return true
        }
        return false
      })
      if (!picked) throw new Error('日期 28 未找到')
    })
    await sleep(400)
    await step(page, 'pick-period', () => pickSelect(page, '请选择时段', '上午'))
    await step(page, 'submit-schedule', () => clickByText(page, '确 定', '.el-dialog__footer button'))
    await sleep(900)
    if (await waitMessage(page, '冲突', 5000)) ok('同医生同日同时段冲突排班被拦截')
    else fail('排班冲突被拦截', new Error('未出现冲突提示'))
    await step(page, 'close-dialog', () => clickByText(page, '取 消', '.el-dialog__footer button'))
    await sleep(400)
  }])

  // ---------- 6 挂号→接诊→联动 + 刷新持久化 ----------
  sections.push(['6. 挂号 → 接诊 → 状态联动 + 刷新持久化', async () => {
    await nav(page, '/outpatient/registrations')
    await clickByText(page, '新增')
    await sleep(500)
    await pickSelect(page, '请选择患者', '林雪梅')
    await pickSelect(page, '请选择科室', '内科')
    await sleep(700)
    await pickSelect(page, '请先选择科室与日期', '周明远')
    await clickByText(page, '确 定', '.el-dialog__footer button')
    await sleep(900)
    if (await waitMessage(page, '挂号成功', 6000)) ok('挂号成功（自动生成缴费记录）')
    else fail('挂号成功')
    await page.reload({ waitUntil: 'networkidle0' })
    await sleep(1000)
    await typeInto(page, '请输入挂号编号', 'REG0000000002136')
    await clickByText(page, '搜索')
    await sleep(700)
    const regRow = await page.$$eval('.el-table__body-wrapper tbody tr', (trs) =>
      trs.filter((tr) => tr.textContent.indexOf('REG0000000002136') !== -1).length
    )
    if (regRow === 1) ok('刷新后新增挂号仍在（localStorage 持久化）')
    else fail('刷新后新增挂号仍在', new Error('rows=' + regRow))
    await clickByText(page, '重置')
    await sleep(500)

    await nav(page, '/outpatient/visits')
    await clickByText(page, '接诊')
    await sleep(600)
    await pickSelect(page, '请选择待接诊挂号', 'REG0000000002136')
    await pickSelect(page, '请选择接诊状态', '已完成')
    await typeInto(page, '请输入主诉', '间歇性头痛两天')
    await typeInto(page, '请输入现病史', '两天前开始出现间歇性头痛，无发热呕吐。')
    await typeInto(page, '请输入诊断结果', '紧张性头痛')
    await typeInto(page, '请输入处理意见', '注意休息，避免劳累，必要时口服止痛药。')
    await clickByText(page, '添加药品', '.detail-section button')
    await sleep(400)
    await pickSelect(page, '请选择药品', '阿莫西林胶囊')
    await clickByText(page, '添加项目', '.detail-section button')
    await sleep(400)
    await pickSelect(page, '请选择项目', '血常规')
    await clickByText(page, '确 定', '.el-dialog__footer button')
    await sleep(1000)
    if (await waitMessage(page, '接诊保存成功', 6000)) ok('接诊保存成功')
    else fail('接诊保存成功')

    await nav(page, '/outpatient/registrations')
    await typeInto(page, '请输入挂号编号', 'REG0000000002136')
    await clickByText(page, '搜索')
    await sleep(700)
    const statusOk = await page.evaluate(() => {
      const trs = [...document.querySelectorAll('.el-table__body-wrapper tbody tr')]
      const tr = trs.find((x) => x.textContent.indexOf('REG0000000002136') !== -1)
      return tr ? tr.textContent.indexOf('已完成') !== -1 : false
    })
    if (statusOk) ok('接诊保存后挂号状态联动为已完成')
    else fail('接诊保存后挂号状态联动')
    await clickByText(page, '重置')
    await sleep(400)
  }])

  // ---------- 7 退号禁止接诊 ----------
  sections.push(['7. 退号后禁止接诊', async () => {
    await nav(page, '/outpatient/registrations')
    await typeInto(page, '请输入挂号编号', 'REG0000000002134')
    await clickByText(page, '搜索')
    await sleep(700)
    await clickRowLink(page, 'REG0000000002134', '退号')
    await confirmBox(page, '确定')
    await sleep(800)
    if (await waitMessage(page, '退号成功', 6000)) ok('退号成功（收费记录已退费）')
    else fail('退号成功')
    await nav(page, '/outpatient/visits')
    await clickByText(page, '接诊')
    await sleep(700)
    const regInOptions = await page.evaluate(() => {
      const items = [...document.querySelectorAll('.el-select-dropdown__item')]
      return items.some((el) => el.offsetParent !== null && el.textContent.indexOf('REG0000000002134') !== -1)
    })
    if (!regInOptions) ok('已退号挂号不出现在可接诊列表中')
    else fail('已退号挂号不出现在可接诊列表中')
    await clickByText(page, '取 消', '.el-dialog__footer button')
    await sleep(300)
  }])

  // ---------- 8 入院 → 转床 → 出院结算 ----------
  sections.push(['8. 入院占床 → 入科 → 转床 → 出院结算释放', async () => {
    await nav(page, '/inpatient/admissions')
    await clickByText(page, '新增登记')
    await sleep(500)
    await pickSelect(page, '请选择患者', '陈志明')
    await pickSelect(page, '请选择科室', '内科')
    await pickSelect(page, '请选择病区', '内科一病区')
    await sleep(300)
    await pickSelect(page, '请选择空闲床位', 'A03')
    await typeInto(page, '如 1000.00', '1000')
    await clickByText(page, '确 定', '.el-dialog__footer button')
    await sleep(900)
    if (await waitMessage(page, '入院登记成功', 6000)) ok('入院登记成功（床位分配）')
    else fail('入院登记成功')

    const rowTextOf = async (name) =>
      page.evaluate((n) => {
        const trs = [...document.querySelectorAll('.el-table__body-wrapper tbody tr')]
        const tr = trs.find((x) => x.textContent.indexOf(n) !== -1)
        return tr ? tr.textContent : ''
      }, name)

    let rowText = await rowTextOf('陈志明')
    if (rowText.indexOf('A03') !== -1 && rowText.indexOf('待入科') !== -1) ok('登记后占用 A03，状态待入科')
    else fail('登记后占用 A03，状态待入科', new Error(rowText))

    await clickRowLink(page, '陈志明', '入科')
    await confirmBox(page, '确定')
    await sleep(800)
    rowText = await rowTextOf('陈志明')
    if (rowText.indexOf('在院') !== -1) ok('入科确认后状态为在院')
    else fail('入科确认后状态为在院', new Error(rowText))

    await clickRowLink(page, '陈志明', '转床')
    await sleep(600)
    await pickSelect(page, '请选择病区', '内科一病区')
    await pickSelect(page, '请选择空闲床位', 'A04')
    await clickByText(page, '确 定', '.el-dialog__footer button')
    await sleep(1000)
    rowText = await rowTextOf('陈志明')
    if (rowText.indexOf('A04') !== -1) ok('转床成功：占用 A04')
    else fail('转床成功', new Error(rowText))

    await nav(page, '/basic/beds')
    await sleep(700)
    const bedStates = await page.evaluate(() => {
      const trs = [...document.querySelectorAll('.el-table__body-wrapper tbody tr')]
      const find = (code) => {
        const tr = trs.find((x) => x.textContent.trim().indexOf(code) !== -1)
        return tr ? tr.textContent : ''
      }
      return { a03: find('A03'), a04: find('A04') }
    })
    if (bedStates.a03.indexOf('空闲') !== -1 && bedStates.a04.indexOf('占用') !== -1) {
      ok('转床同时释放原床位 A03 并占用新床位 A04')
    } else {
      fail('转床床位联动', new Error(JSON.stringify(bedStates)))
    }

    await nav(page, '/inpatient/admissions')
    await sleep(600)
    await clickRowLink(page, '陈志明', '出院')
    await confirmBox(page, '确定')
    await sleep(800)
    await nav(page, '/inpatient/settlements')
    await sleep(700)
    await clickRowLink(page, '陈志明', '明细')
    await sleep(800)
    await clickByText(page, '确认结算', '.el-dialog__footer button')
    await sleep(1200)
    if (await waitMessage(page, '结算完成', 6000)) ok('出院结算完成')
    else fail('出院结算完成')
    await nav(page, '/basic/beds')
    await sleep(700)
    const a04State = await page.evaluate(() => {
      const trs = [...document.querySelectorAll('.el-table__body-wrapper tbody tr')]
      const tr = trs.find((x) => x.textContent.trim().indexOf('A04') !== -1)
      return tr ? tr.textContent : ''
    })
    if (a04State.indexOf('空闲') !== -1) ok('结算后床位 A04 释放为空闲')
    else fail('结算后床位释放', new Error(a04State))
  }])

  // ---------- 9 重置演示数据 ----------
  sections.push(['9. 重置演示数据', async () => {
    await nav(page, '/system/reset')
    await sleep(600)
    await clickByText(page, '重置演示数据')
    await confirmBox(page, '确定')
    await sleep(1200)
    if (await waitMessage(page, '演示数据已重置', 6000)) ok('重置演示数据成功')
    else fail('重置演示数据成功')
    await nav(page, '/patients')
    await sleep(800)
    const pRows = await page.$$eval('.el-table__body-wrapper tbody tr', (trs) => trs.length)
    if (pRows === 10) ok('重置后患者恢复种子数据（首页 10 条）')
    else fail('重置后患者恢复种子数据', new Error('rows=' + pRows))
  }])

  // ---------- 10 退出 ----------
  sections.push(['10. 退出登录', async () => {
    await page.evaluate(() => {
      const area = document.querySelector('.user-area')
      if (area) area.click()
    })
    await sleep(600)
    await clickByText(page, '退出登录', '.el-dropdown-menu__item')
    await confirmBox(page, '确定')
    await sleep(900)
    if (page.url().indexOf('#/login') !== -1) ok('退出后回到登录页')
    else fail('退出后回到登录页', new Error(page.url()))
    await sleep(600)
  }])

  // ---------- 11 窄屏 / 导出 / 刷新入口 ----------
  sections.push(['11. 窄屏登录、宽表滚动、导出与刷新入口', async () => {
    // 手机宽度登录页：卡片完整、无横向溢出
    await page.setViewport({ width: 375, height: 667 })
    await page.evaluate(() => {
      localStorage.removeItem('astra_hospital_token')
    })
    await page.goto(BASE + '/#/login', { waitUntil: 'networkidle0' })
    await sleep(1200)
    const loginCheck = await page.evaluate(() => {
      const card = document.querySelector('.login-card')
      if (!card) return { fail: 'no-card' }
      const rect = card.getBoundingClientRect()
      return {
        cardVisible: rect.width > 300 && rect.left >= 0 && rect.right <= 375,
        noHScroll: document.documentElement.scrollWidth <= 375
      }
    })
    if (loginCheck.cardVisible && loginCheck.noHScroll) ok('375px 窄屏登录卡片完整显示且无横向溢出')
    else fail('375px 窄屏登录卡片完整显示', new Error(JSON.stringify(loginCheck)))
    await shot(page, '10-login-narrow')

    // 恢复登录
    await typeInto(page, '登录账号', 'admin')
    await typeInto(page, '请输入密码', '123456')
    await clickByText(page, '登 录', '.login-btn')
    await sleep(2200)

    // 1024 宽屏：宽表允许内部横向滚动，工具栏不被裁切
    await page.setViewport({ width: 1024, height: 768 })
    await nav(page, '/outpatient/registrations')
    await sleep(900)
    const wideCheck = await page.evaluate(() => {
      const wrapper = document.querySelector('.el-table__body-wrapper')
      const addBtn = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === '新增' && b.offsetParent !== null)
      const tb = document.querySelector('.toolbar-row')
      return {
        tableScrollable: wrapper ? wrapper.scrollWidth > wrapper.clientWidth : false,
        addVisible: !!addBtn,
        toolbarVisible: tb ? tb.getBoundingClientRect().right <= 1024 && tb.getBoundingClientRect().left >= 0 : false
      }
    })
    if (wideCheck.tableScrollable && wideCheck.addVisible && wideCheck.toolbarVisible) {
      ok('1024px 宽表内部横向滚动，工具栏与操作按钮未被裁切')
    } else {
      fail('1024px 宽表滚动与工具栏可见', new Error(JSON.stringify(wideCheck)))
    }

    // 导出按钮：触发当前筛选范围内的 CSV 下载（无异常即通过）
    await clickByText(page, '导出')
    await sleep(1500)

    // 顶部刷新入口：点击后页面重新挂载
    const beforeKey = await page.evaluate(() => window.__store.state.app.refreshKey)
    await page.evaluate(() => {
      const btn = document.querySelector('.navbar .action-btn')
      if (btn) btn.click()
    })
    await sleep(1200)
    const afterKey = await page.evaluate(() => window.__store.state.app.refreshKey)
    if (afterKey > beforeKey) ok('顶部刷新入口触发页面重载')
    else fail('顶部刷新入口触发页面重载')
    await page.setViewport({ width: 1440, height: 900 })
  }])

  // ---------- 12 全部页面渲染冒烟 + 404 ----------
  sections.push(['12. 全部 30 个页面渲染冒烟 + 404', async () => {
    const paths = [
      '/dashboard',
      '/basic/departments',
      '/basic/staff',
      '/basic/wards',
      '/basic/beds',
      '/basic/fee-items',
      '/basic/medicines',
      '/basic/exam-items',
      '/basic/stocks',
      '/patients',
      '/outpatient/schedules',
      '/outpatient/registrations',
      '/outpatient/visits',
      '/outpatient/prescriptions',
      '/outpatient/exam-applies',
      '/outpatient/charges',
      '/outpatient/dispenses',
      '/outpatient/reports',
      '/inpatient/admissions',
      '/inpatient/orders',
      '/inpatient/settlements',
      '/system/roles',
      '/system/menus',
      '/system/logs',
      '/system/reset',
      '/ai/center',
      '/ai/assistant',
      '/ai/reports',
      '/ai/anomaly',
      '/ai/forecast'
    ]
    const bad = []
    for (const p of paths) {
      await nav(page, p)
      await sleep(450)
      const ok2 = await page.evaluate(() => {
        const hasPage =
          document.querySelector('.panel-card') !== null ||
          document.querySelector('.stat-row') !== null ||
          document.querySelector('.chart-box') !== null ||
          document.querySelector('.nf-code') !== null
        const appEmpty = document.querySelector('#app') && document.querySelector('#app').children.length === 0
        return hasPage && !appEmpty
      })
      if (!ok2) bad.push(p)
    }
    if (!bad.length) ok(`全部 ${paths.length} 个页面渲染正常（无空白）`)
    else fail('页面渲染冒烟', new Error('空白/异常页面: ' + bad.join(', ')))

    // 404 处理
    await nav(page, '/definitely-not-a-real-page')
    await sleep(600)
    const nf = await page.evaluate(() => {
      const el = document.querySelector('.nf-code')
      return el ? el.textContent.trim() : ''
    })
    if (nf === '404') ok('未知路由正确显示 404 页面')
    else fail('未知路由 404 处理', new Error('got: ' + nf))
  }])

  // ---------- 13 AI 智能中心与 AI 应用（B3/B4/B5） ----------
  sections.push(['13. AI 智能中心与 AI 应用（B3/B4/B5）', async () => {
    // 13.1 AI 治理中心：自检 + 审计
    await nav(page, '/ai/center')
    await sleep(1200)
    await clickByText(page, '运行自检')
    await sleep(1600)
    if (await waitBodyText(page, '自检通过', 8000)) ok('AI 治理中心自检通过（Provider/只读/脱敏/零网络）')
    else fail('AI 治理中心自检通过')
    if (await waitBodyText(page, 'system.selftest', 6000)) ok('AI 调用写入 aiEvents 审计事件')
    else fail('AI 调用写入 aiEvents 审计事件')
    await shot(page, '11-ai-center')

    // 13.2 Ask Astra 助手：推荐问题 → 结论 + 数据依据 + 元信息
    await nav(page, '/ai/assistant')
    await sleep(1000)
    if (!(await clickBodyText(page, '今天门诊量多少？'))) throw new Error('推荐问题未找到')
    await sleep(1800)
    if (await waitBodyText(page, '数据依据', 8000)) ok('Ask Astra 返回结论 + 数据依据')
    else fail('Ask Astra 返回结论 + 数据依据')
    if (await waitBodyText(page, '本地确定性引擎', 5000)) ok('AI 结果展示 provider/置信度/只读元信息')
    else fail('AI 结果展示 provider/置信度/只读元信息')
    await shot(page, '12-ai-assistant')

    // 13.3 运营异常分析：命中种子已知异常
    await nav(page, '/ai/anomaly')
    await sleep(1800)
    if (await waitBodyText(page, '床位停用', 8000)) ok('运营异常分析命中种子已知异常（b12 检修床位）')
    else fail('运营异常分析命中种子已知异常')
    if (await waitBodyText(page, '检查报告积压', 6000)) ok('运营异常分析命中待报告积压')
    else fail('运营异常分析命中待报告积压')
    await shot(page, '13-ai-anomaly')

    // 13.4 智能报表：可复算数值与 AI 摘要
    await nav(page, '/ai/reports')
    await sleep(2200)
    if (await waitBodyText(page, '收入结构报表', 8000)) ok('智能报表渲染收入结构')
    else fail('智能报表渲染收入结构')
    if (await waitBodyText(page, '¥1021.10', 6000)) ok('报表合计与种子数据一致（¥1021.10）')
    else fail('报表合计与种子数据一致')
    if (await waitBodyText(page, 'AI 摘要', 5000)) ok('智能报表附 AI 摘要与要点')
    else fail('智能报表附 AI 摘要与要点')
    await shot(page, '14-ai-reports')

    // 13.5 预测分析：5 项预测 + 区间 + ECharts
    await nav(page, '/ai/forecast')
    await sleep(3000)
    if (await waitBodyText(page, '次日门诊量', 8000)) ok('预测分析渲染次日门诊量等 5 项预测')
    else fail('预测分析渲染 5 项预测')
    if (await waitBodyText(page, '预测区间', 6000)) ok('预测输出包含区间与口径说明')
    else fail('预测输出包含区间与口径说明')
    const hasChart = await page.evaluate(() => document.querySelectorAll('canvas').length > 0)
    if (hasChart) ok('预测趋势图（ECharts）渲染成功')
    else fail('预测趋势图（ECharts）渲染成功')
    await shot(page, '15-ai-forecast')

    // 13.6 工作台集成：明日运营预测面板
    await nav(page, '/dashboard')
    await sleep(2500)
    if (await waitBodyText(page, '明日运营预测', 8000)) ok('工作台集成「明日运营预测」面板')
    else fail('工作台集成「明日运营预测」面板')
  }])

  // ---------- 14 缺陷修复回归（W1/W2/W3） ----------
  sections.push(['14. 缺陷修复回归（W1 医技申请分页 / W2 医技项目 undefined / W3 结构化反馈）', async () => {
    // W1：医技申请列表在分页前过滤「有医技项目」，历史待报告接诊可见且可出具报告
    await nav(page, '/outpatient/exam-applies')
    await sleep(1600)
    const totalText = await page.evaluate(() => {
      const m = document.body.innerText.match(/共\s*(\d+)\s*条/)
      return m ? m[1] : ''
    })
    if (totalText === '9') ok('W1 医技申请列表按「有医技项目」服务端过滤后共 9 条（含历史待报告）')
    else fail('W1 医技申请列表总数', new Error('共 ' + totalText + ' 条，期望 9'))

    const pendingInfo = await page.evaluate(() => {
      const rows = [...document.querySelectorAll('.el-table__body-wrapper tbody tr')]
      const pending = rows.filter((r) => r.innerText.indexOf('待报告') !== -1)
      const actionable = pending.filter((r) => [...r.querySelectorAll('.el-link--inner')].some((s) => s.textContent.trim() === '出具报告'))
      return { pending: pending.length, actionable: actionable.length, codes: pending.map((r) => (r.innerText.match(/VIS\d+/) || [''])[0]) }
    })
    if (pendingInfo.pending >= 2 && pendingInfo.actionable >= 2) {
      ok('W1 历史待报告接诊（' + pendingInfo.codes.join(',') + '）可见且可出具报告')
    } else {
      fail('W1 历史待报告接诊可见且可出具报告', new Error(JSON.stringify(pendingInfo)))
    }

    // 出具一份报告，验证提醒闭环：待报告提醒由 2 条降为 1 条
    await page.evaluate(() => {
      const rows = [...document.querySelectorAll('.el-table__body-wrapper tbody tr')]
      const row = rows.find((r) => r.innerText.indexOf('待报告') !== -1 && [...r.querySelectorAll('.el-link--inner')].some((s) => s.textContent.trim() === '出具报告'))
      const link = row ? [...row.querySelectorAll('.el-link--inner')].find((s) => s.textContent.trim() === '出具报告') : null
      if (link) link.click()
    })
    await sleep(900)
    await pickSelect(page, '请选择项目', '（1）')
    await typeInto(page, '请输入检查所见与诊断意见', '验收回归测试：检查所见未见明显异常。')
    await clickByText(page, '确 定', '.el-dialog__footer button')
    await sleep(1200)
    if (await waitMessage(page, '报告已出具', 6000)) ok('W1 历史待报告接诊可正常出具报告')
    else fail('W1 历史待报告接诊可正常出具报告')

    await nav(page, '/workbench/reminders')
    await sleep(1200)
    if (await waitBodyText(page, '共 1 条接诊存在待出报告', 6000)) ok('W1 提醒对应业务闭环：待报告提醒由 2 条降为 1 条')
    else fail('W1 提醒对应业务闭环')

    // W2：接诊弹窗医技项目下拉不再显示 undefined
    await nav(page, '/outpatient/visits')
    await sleep(1400)
    await page.evaluate(() => {
      const row = document.querySelector('.el-table__body-wrapper tbody tr')
      const link = row ? [...row.querySelectorAll('.el-link--inner')].find((s) => s.textContent.trim() === '修改') : null
      if (link) link.click()
    })
    await sleep(1200)
    await page.evaluate(() => {
      const dlg = [...document.querySelectorAll('.el-dialog')].find((d) => d.offsetParent !== null)
      const input = dlg ? [...dlg.querySelectorAll('.el-select input')].find((i) => (i.getAttribute('placeholder') || '').indexOf('请选择项目') !== -1) : null
      if (input) input.click()
    })
    await sleep(800)
    const examLabels = await page.evaluate(() =>
      [...document.querySelectorAll('.el-select-dropdown__item')].filter((el) => el.offsetParent !== null).map((el) => el.textContent.trim())
    )
    const hasUndefined = examLabels.some((t) => t.indexOf('undefined') !== -1)
    const hasCategory = examLabels.some((t) => t.indexOf('（检验）') !== -1 || t.indexOf('（检查）') !== -1)
    if (examLabels.length && !hasUndefined && hasCategory) ok('W2 医技项目下拉标签正常（含分类、无 undefined）')
    else fail('W2 医技项目下拉标签', new Error('labels=' + examLabels.slice(0, 4).join('|')))
    await page.keyboard.press('Escape')
    await sleep(400)

    // W3：病历结构化「应用建议」给出明确持久反馈；标记采纳状态明确；全程不写库
    await page.evaluate(() => {
      const dlg = [...document.querySelectorAll('.el-dialog')].find((d) => d.offsetParent !== null)
      const b = dlg ? [...dlg.querySelectorAll('button')].find((x) => x.innerText.trim() === '解析当前文本') : null
      if (b) b.click()
    })
    await sleep(1600)
    await page.evaluate(() => {
      const dlg = [...document.querySelectorAll('.el-dialog')].find((d) => d.offsetParent !== null)
      const b = dlg ? [...dlg.querySelectorAll('button')].find((x) => x.innerText.trim().indexOf('应用建议') === 0) : null
      if (b) b.click()
    })
    await sleep(800)
    const hintText = await page.evaluate(() => {
      const dlg = [...document.querySelectorAll('.el-dialog')].find((d) => d.offsetParent !== null)
      const alerts = dlg ? [...dlg.querySelectorAll('.el-alert__title')].map((x) => x.textContent.trim()) : []
      return alerts.join(' | ')
    })
    if (hintText.indexOf('已包含全部') !== -1) ok('W3 应用建议给出明确反馈（诊断已包含关键词，未做修改）')
    else fail('W3 应用建议明确反馈', new Error('hint=' + hintText))

    await page.evaluate(() => {
      const dlg = [...document.querySelectorAll('.el-dialog')].find((d) => d.offsetParent !== null)
      const b = dlg ? [...dlg.querySelectorAll('button')].find((x) => x.innerText.trim() === '标记采纳') : null
      if (b) b.click()
    })
    await sleep(1000)
    const accepted = await page.evaluate(() => {
      const dlg = [...document.querySelectorAll('.el-dialog')].find((d) => d.offsetParent !== null)
      return dlg ? dlg.innerText.indexOf('已标记采纳') !== -1 : false
    })
    if (accepted) ok('W3 标记采纳后按钮与提示状态明确（已标记采纳）')
    else fail('W3 标记采纳状态反馈')

    // 关闭弹窗（不保存，确保未修改业务数据）
    await page.evaluate(() => {
      const dlg = [...document.querySelectorAll('.el-dialog')].find((d) => d.offsetParent !== null)
      const b = dlg ? [...dlg.querySelectorAll('button')].find((x) => x.innerText.replace(/\s/g, '') === '取消') : null
      if (b) b.click()
    })
    await sleep(600)
  }])

  try {
    for (const [title, fn] of sections) {
      if (process.argv[2] && title.indexOf(process.argv[2]) === -1 && title.indexOf('1. 登录') === -1) continue
      console.log('■ ' + title)
      try {
        await fn()
      } catch (e) {
        fail(title, e)
        const fname = title.slice(0, 8).replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '_')
        await page.screenshot({ path: path.join(SHOTS, 'fail-' + fname + '.png') }).catch(() => {})
        console.log('    [失败现场截图 fail-' + fname + '.png]')
      }
    }
  } finally {
    if (consoleErrors.length) {
      console.log('\n⚠ 控制台错误/警告（' + consoleErrors.length + ' 条，前 6 条）：')
      consoleErrors.slice(0, 6).forEach((x) => console.log('   ' + x.split('\n')[0]))
      failed++
    } else {
      console.log('\n✔ 控制台无未处理错误')
    }
    await browser.close()
    try {
      proc.kill()
    } catch (e) {}
    console.log(`\nE2E 结果：通过 ${passed}，失败 ${failed}`)
    if (failed) {
      console.log('失败项：' + errMessages.join('；') || '(见上文)')
    }
    process.exit(failed ? 1 : 0)
  }
}

async function waitText(page, sel, text, timeout = 8000) {
  try {
    await page.waitForFunction(
      (s, t) => {
        const el = document.querySelector(s)
        return el && el.textContent.indexOf(t) !== -1
      },
      { timeout },
      sel,
      text
    )
    return true
  } catch (e) {
    return false
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
