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
    // 日历面板默认系统当前月份（2026-10），先真实点击打开面板，再退回 2026-08 选 28 日
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
    await step(page, 'prev-month', async () => {
      for (let i = 0; i < 2; i++) {
        await page.evaluate(() => {
          const btns = [...document.querySelectorAll('.el-picker-panel button.el-date-picker__prev-btn')]
          // 第 2 个 prev 按钮是「上一月」
          if (btns[1]) btns[1].click()
        })
        await sleep(400)
      }
    })
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
  sections.push(['12. 全部 25 个页面渲染冒烟 + 404', async () => {
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
      '/system/reset'
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
