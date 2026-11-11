// =====================================================================
// 统一 Mock 数据层（纯函数式、同步、可测试）
// - 金额一律以「整数分」存储与计算
// - 所有业务规则在持久化之前校验，校验失败不落库
// - localStorage 带版本标记；结构不符自动重新播种
// - 本模块无框架依赖，可直接被 Jest / 纯 Node 测试加载
// =====================================================================
const { buildSeed } = require('./seed')

const STORAGE_KEY = 'astra_hospital_db_v1'
// 数据版本：每次结构变更 +1，并提供对应增量迁移；禁止直接重播种覆盖用户数据
const CURRENT_VERSION = 5
const BACKUP_KEY_PREFIX = STORAGE_KEY + '_backup_v'

let state = null
// 当前操作人（结构化审计记录真实操作人/角色）
let currentActor = null

function safeGet() {
  try {
    if (typeof localStorage !== 'undefined') return localStorage.getItem(STORAGE_KEY)
  } catch (e) {
    /* noop */
  }
  return null
}

function safeSet(v) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, v)
      return true
    }
  } catch (e) {
    /* noop */
  }
  return false
}

function now() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

function fail(error) {
  return { ok: false, error }
}

function ok(data) {
  return { ok: true, data }
}

// 备份原始数据串（迁移/兜底前调用），不覆盖已有同名备份
function backupRaw(raw, fromVersion) {
  try {
    if (typeof localStorage !== 'undefined' && raw) {
      const key = BACKUP_KEY_PREFIX + fromVersion
      if (!localStorage.getItem(key)) localStorage.setItem(key, raw)
    }
  } catch (e) {
    /* noop */
  }
}

// 增量迁移表：MIGRATIONS[v] 把版本 v 升级到 v+1（只增不删、补默认值、回填派生）
const MIGRATIONS = {
  1: function migrate1to2(s) {
    // v1 -> v2：新增 审计事件 / 待办 / 提醒确认 / AI 事件 与对应计数器
    if (!Array.isArray(s.auditEvents)) {
      // 用旧 logs 回填结构化审计（尽力保留历史，标记 legacy）
      s.auditEvents = (Array.isArray(s.logs) ? s.logs : []).map(function (l, i) {
        return {
          id: 'aud' + (i + 1),
          time: l.time || '',
          actorStaffId: '',
          actorName: l.operator || '系统',
          actorRole: '',
          action: l.action || '',
          entityType: 'legacy',
          entityId: '',
          entityCode: '',
          summary: l.target || '',
          before: null,
          after: null,
          refs: {},
          result: 'ok',
          ip: l.ip || ''
        }
      })
    }
    if (!Array.isArray(s.todos)) s.todos = []
    if (!Array.isArray(s.reminderAcks)) s.reminderAcks = []
    if (!Array.isArray(s.aiEvents)) s.aiEvents = []
    s.counters = s.counters || {}
    if (s.counters.auditEvents === undefined) s.counters.auditEvents = (s.auditEvents || []).length
    if (s.counters.todos === undefined) s.counters.todos = 0
    if (s.counters.reminderAcks === undefined) s.counters.reminderAcks = 0
    if (s.counters.aiEvents === undefined) s.counters.aiEvents = 0
    s.version = 2
    return s
  },
  2: function migrate2to3(s) {
    // v2 -> v3：合并新增菜单节点（患者360°时间线、审计中心）；补待办描述字段
    function ensureMenu(groupCode, node) {
      const g = (Array.isArray(s.menus) ? s.menus : []).find(function (m) { return m.code === groupCode })
      if (!g) return
      g.children = g.children || []
      if (!g.children.some(function (c) { return c.code === node.code })) g.children.push(node)
    }
    ensureMenu('patient', { id: 'm-patient-timeline', code: 'patient-timeline', name: '患者360°时间线', type: 'menu', children: [] })
    ensureMenu('system', { id: 'm-sys-audit', code: 'system-audit', name: '审计中心', type: 'menu', children: [] })
    if (Array.isArray(s.todos)) {
      s.todos.forEach(function (t) { if (t.description === undefined) t.description = '' })
    }
    s.version = 3
    return s
  },
  3: function migrate3to4(s) {
    // v3 -> v4：新增「AI 智能中心」菜单分组与 AI 治理中心节点；确保 aiEvents 集合存在
    if (!Array.isArray(s.menus)) s.menus = []
    if (!s.menus.some(function (m) { return m.code === 'ai' })) {
      s.menus.push({
        id: 'm-ai',
        code: 'ai',
        name: 'AI 智能中心',
        type: 'group',
        children: [{ id: 'm-ai-center', code: 'ai-center', name: 'AI 治理中心', type: 'menu', children: [] }]
      })
    } else {
      const g = s.menus.find(function (m) { return m.code === 'ai' })
      g.children = Array.isArray(g.children) ? g.children : []
      if (!g.children.some(function (c) { return c.code === 'ai-center' })) {
        g.children.push({ id: 'm-ai-center', code: 'ai-center', name: 'AI 治理中心', type: 'menu', children: [] })
      }
    }
    if (!Array.isArray(s.aiEvents)) s.aiEvents = []
    s.counters = s.counters || {}
    if (s.counters.aiEvents === undefined) s.counters.aiEvents = s.aiEvents.length
    s.version = 4
    return s
  },
  4: function migrate4to5(s) {
    // v4 -> v5：新增 AI 应用菜单（助手/智能报表/异常分析/预测分析）并按角色授权
    const nodes = [
      { id: 'm-ai-assistant', code: 'ai-assistant', name: 'Ask Astra 助手', type: 'menu', children: [] },
      { id: 'm-ai-report', code: 'ai-report', name: '智能报表', type: 'menu', children: [] },
      { id: 'm-ai-anomaly', code: 'ai-anomaly', name: '运营异常分析', type: 'menu', children: [] },
      { id: 'm-ai-forecast', code: 'ai-forecast', name: '预测分析', type: 'menu', children: [] }
    ]
    if (!Array.isArray(s.menus)) s.menus = []
    let g = s.menus.find(function (m) { return m.code === 'ai' })
    if (!g) {
      g = { id: 'm-ai', code: 'ai', name: 'AI 智能中心', type: 'group', children: [] }
      s.menus.push(g)
    }
    g.children = Array.isArray(g.children) ? g.children : []
    nodes.forEach(function (n) {
      if (!g.children.some(function (c) { return c.code === n.code })) g.children.push(n)
    })
    function grant(roleCode, codes) {
      const role = (Array.isArray(s.roles) ? s.roles : []).find(function (r) { return r.code === roleCode })
      if (!role) return
      role.menuCodes = Array.isArray(role.menuCodes) ? role.menuCodes : []
      codes.forEach(function (c) {
        if (role.menuCodes.indexOf(c) === -1) role.menuCodes.push(c)
      })
    }
    grant('DOCTOR', ['ai-assistant', 'ai-forecast'])
    grant('CASHIER', ['ai-assistant', 'ai-forecast'])
    grant('RESIDENT', ['ai-assistant', 'ai-forecast'])
    grant('HEAD_NURSE', ['ai-assistant', 'ai-anomaly', 'ai-forecast'])
    s.version = 5
    return s
  }
}

const REQUIRED_ARRAYS = ['departments', 'staff', 'patients', 'registrations']

function isValidState(s) {
  return !!s && typeof s === 'object' && REQUIRED_ARRAYS.every(function (k) { return Array.isArray(s[k]) })
}

function migrateToCurrent(parsed, raw) {
  let s = parsed
  let v = Number(s.version) || 0
  if (v > CURRENT_VERSION) {
    // 未来更高版本：拒绝降级，备份后续数据保持不被覆盖
    backupRaw(raw, v)
    if (typeof console !== 'undefined') console.warn('[db] 检测到更高版本 v' + v + ' > 当前 ' + CURRENT_VERSION + '，已备份且不覆盖。')
    return null
  }
  if (v < CURRENT_VERSION) {
    backupRaw(raw, v)
    const startV = v
    while (v < CURRENT_VERSION) {
      const fn = MIGRATIONS[v]
      if (typeof fn !== 'function') { v = CURRENT_VERSION; break }
      s = fn(s) || s
      v += 1
      s.version = v
    }
    s.migrationLog = (Array.isArray(s.migrationLog) ? s.migrationLog : []).concat({ from: startV, to: CURRENT_VERSION, at: now() })
    s.migratedAt = now()
  }
  return s
}

function load() {
  const raw = safeGet()
  if (raw) {
    try {
      const parsed = JSON.parse(raw)
      if (isValidState(parsed)) {
        if (parsed.version === CURRENT_VERSION) {
          state = parsed
          return state
        }
        const migrated = migrateToCurrent(parsed, raw)
        if (migrated) {
          state = migrated
          persist()
          return state
        }
        // 更高版本：内存退回种子但不写回，避免覆盖较新数据
        state = buildSeed()
        return state
      }
      // 结构损坏：先备份再兜底播种
      backupRaw(raw, (parsed && parsed.version) || 'corrupt')
    } catch (e) {
      backupRaw(raw, 'unparsable')
    }
  }
  state = buildSeed()
  persist()
  return state
}

function persist() {
  state.savedAt = now()
  safeSet(JSON.stringify(state))
}

function requireState() {
  if (!state) load()
  return state
}

// ---------- 操作人 / 结构化审计 ----------
function setCurrentActor(actor) {
  currentActor = actor ? { id: actor.id || '', name: actor.name || '', role: actor.role || '', code: actor.code || '' } : null
}
function getCurrentActor() {
  return currentActor
}
function setActorByToken(token) {
  if (!token) return
  const m = String(token).match(/^mock-token-(.+)$/)
  if (!m) return
  const staff = all('staff').find(function (s) { return s.id === m[1] })
  if (staff) setCurrentActor({ id: staff.id, name: staff.name, role: staff.role, code: staff.code })
}
function actorInfo(actor) {
  let a = actor
  if (!a) a = currentActor
  if (!a) return { actorStaffId: '', actorName: '系统', actorRole: '' }
  if (typeof a === 'string') return { actorStaffId: '', actorName: a, actorRole: '' }
  return { actorStaffId: a.id || '', actorName: a.name || '系统', actorRole: a.role || '' }
}
function cloneSans(d, omit) {
  if (d === null || typeof d !== 'object') return d
  const o = Array.isArray(d) ? [] : {}
  Object.keys(d).forEach(function (k) {
    if (omit && omit.indexOf(k) !== -1) return
    o[k] = d[k]
  })
  return o
}
function summarizeEntity(data) {
  if (!data || typeof data !== 'object') return null
  const s = cloneSans(data, ['password', 'token'])
  if (Array.isArray(s)) return { count: s.length }
  return s
}
function nextSeq(name) {
  const s = requireState()
  const n = (s.counters[name] || 0) + 1
  s.counters[name] = n
  return n
}
function recordAudit(actor, action, meta) {
  requireState()
  meta = meta || {}
  if (!Array.isArray(state.auditEvents)) state.auditEvents = []
  if (!state.counters) state.counters = {}
  const info = actorInfo(actor)
  const ev = {
    id: 'aud' + nextSeq('auditEvents'),
    time: now(),
    actorStaffId: info.actorStaffId,
    actorName: info.actorName,
    actorRole: info.actorRole,
    action: action || '',
    entityType: meta.entityType || '',
    entityId: meta.entityId || '',
    entityCode: meta.entityCode || '',
    summary: meta.summary || '',
    before: meta.before === undefined ? null : meta.before,
    after: meta.after === undefined ? null : meta.after,
    refs: meta.refs || {},
    result: meta.result || 'ok',
    ip: '192.168.1.10'
  }
  state.auditEvents.unshift(ev)
  if (state.auditEvents.length > 2000) state.auditEvents = state.auditEvents.slice(0, 2000)
  return ev
}

// ---------- 基础查询 ----------

function all(name) {
  requireState()
  return state[name] || []
}

function find(name, id) {
  return all(name).find((x) => x.id === id) || null
}

function byIdMap(name) {
  const m = {}
  all(name).forEach((x) => (m[x.id] = x))
  return m
}

/**
 * 列表查询。filters 值支持：
 *   普通值    —— 字符串 = 包含(不区分大小写)，其他 = 相等
 *   {eq:v}    相等      {contains:v} 包含
 *   {in:[..]} 枚举      {gte:v} {lte:v} 范围
 *   {fn:(row)=>bool}   自定义
 */
function query(name, opts) {
  opts = opts || {}
  const filters = opts.filters || {}
  const page = Math.max(1, Number(opts.page) || 1)
  const size = Math.max(1, Number(opts.size) || 10)

  let list = all(name).slice()

  Object.keys(filters).forEach((field) => {
    const cond = filters[field]
    if (cond === undefined || cond === null || cond === '') return
    list = list.filter((row) => {
      const val = row[field]
      if (typeof cond === 'object' && cond !== null) {
        if ('eq' in cond) return val === cond.eq
        if ('ne' in cond) return val !== cond.ne
        if ('contains' in cond) return String(val || '').toLowerCase().indexOf(String(cond.contains).toLowerCase()) !== -1
        if ('in' in cond) return cond.in.indexOf(val) !== -1
        if ('gte' in cond && val < cond.gte) return false
        if ('lte' in cond && val > cond.lte) return false
        if (typeof cond.fn === 'function') return cond.fn(row)
        return true
      }
      if (typeof cond === 'string') {
        return String(val || '').toLowerCase().indexOf(cond.toLowerCase()) !== -1
      }
      return val === cond
    })
  })

  if (opts.sortBy) {
    const field = opts.sortBy
    const dir = opts.sortOrder === 'asc' ? 1 : -1
    list.sort((a, b) => {
      const va = a[field]
      const vb = b[field]
      if (va === vb) return 0
      if (va === undefined || va === null) return 1
      if (vb === undefined || vb === null) return -1
      return va < vb ? -1 * dir : 1 * dir
    })
  }

  const total = list.length
  const start = (page - 1) * size
  return { total, list: list.slice(start, start + size) }
}

// ---------- 工具 ----------

function nextCode(counterKey, prefix, width) {
  const s = requireState()
  const n = (s.counters[counterKey] || 0) + 1
  s.counters[counterKey] = n
  return prefix + String(n).padStart(width, '0')
}

function nextPatientCode() {
  const n = nextCode('patient', '', 15)
  return 'P' + n
}

function nextRegCode() {
  return nextCode('reg', 'REG', 13)
}

function nextVisitCode() {
  return nextCode('visit', 'VIS', 13)
}

function nextAdmissionCode() {
  return nextCode('admission', 'ADM', 9)
}

function nextPayCode() {
  return nextCode('feeRecord', 'PAY', 13)
}

function nextStaffCode() {
  return nextCode('staff', 'S', 3)
}

function nextId(name) {
  const s = requireState()
  const n = (s.counters[name] || 0) + 1
  s.counters[name] = n
  return name + '-' + n
}

function add(name, row) {
  all(name).push(row)
}

function assignCode(name, prefix, width) {
  const s = requireState()
  const n = (s.counters[name] || 0) + 1
  s.counters[name] = n
  return prefix + String(n).padStart(width, '0')
}

function sumCents(arr) {
  return arr.reduce((acc, n) => acc + (Number.isInteger(n) ? n : 0), 0)
}

function validDate(v) {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)
}

function isPosInt(v) {
  return Number.isInteger(Number(v)) && Number(v) > 0
}

function isNonNegInt(v) {
  return Number.isInteger(Number(v)) && Number(v) >= 0
}

const STAFF_TYPES = ['系统管理员', '门诊医生', '住院医生', '收费人员', '护士']
const BED_STATUS = ['空闲', '占用']
const ADM_ACTIVE = ['待入科', '在院', '待结算']

// =====================================================================
// 登录（演示：不校验真实安全，仅比较内置演示密码）
// =====================================================================
function login(account, password) {
  requireState()
  const staff = all('staff').find((s) => s.loginAccount === account)
  if (!staff) return fail('账号不存在')
  if (!staff.enabled) return fail('账号已被停用，请联系管理员')
  if (staff.password !== password) return fail('密码错误')
  staff.lastLoginAt = now()
  persist()
  setCurrentActor({ id: staff.id, name: staff.name, role: staff.role, code: staff.code })
  addLog(staff.name, '登录系统', '登录')
  const perm = permissionsOf(staff)
  return ok({ token: 'mock-token-' + staff.id, staff: Object.assign(stripPassword(staff), { roleCode: perm.roleCode, menuCodes: perm.menuCodes }) })
}

function stripPassword(staff) {
  const s = Object.assign({}, staff)
  delete s.password
  return s
}

// =====================================================================
// 员工
// =====================================================================
function createStaff(input) {
  requireState()
  const p = input || {}
  if (!p.name || !String(p.name).trim()) return fail('员工姓名不能为空')
  if (!STAFF_TYPES.includes(p.type)) return fail('员工类型不合法')
  if (!p.loginAccount || !/^[A-Za-z0-9_]{3,20}$/.test(p.loginAccount)) return fail('登录账号须为 3-20 位字母/数字/下划线')
  if (all('staff').some((s) => s.loginAccount === p.loginAccount)) return fail('登录账号已存在')
  if (!p.phone || !/^1[3-9]\d{9}$/.test(p.phone)) return fail('联系电话格式不正确')
  if (all('staff').some((s) => s.phone === p.phone)) return fail('联系电话已存在')
  const code = nextStaffCode()
  const row = {
    id: 's' + code,
    code,
    name: String(p.name).trim(),
    type: p.type,
    departmentId: p.departmentId || '',
    phone: p.phone,
    loginAccount: p.loginAccount,
    role: p.role || p.type,
    password: '123456',
    enabled: p.enabled !== false,
    lastLoginAt: '',
    createdAt: now()
  }
  add('staff', row)
  persist()
  addLog('系统管理员', '新增', `员工 ${row.code} ${row.name}`)
  return ok(stripPassword(row))
}

function updateStaff(id, patch) {
  requireState()
  const row = find('staff', id)
  if (!row) return fail('员工不存在')
  const p = patch || {}
  if (p.loginAccount !== undefined) {
    if (!/^[A-Za-z0-9_]{3,20}$/.test(p.loginAccount)) return fail('登录账号须为 3-20 位字母/数字/下划线')
    if (all('staff').some((s) => s.loginAccount === p.loginAccount && s.id !== id)) return fail('登录账号已存在')
  }
  if (p.phone !== undefined) {
    if (!/^1[3-9]\d{9}$/.test(p.phone)) return fail('联系电话格式不正确')
    if (all('staff').some((s) => s.phone === p.phone && s.id !== id)) return fail('联系电话已存在')
  }
  if (p.name !== undefined && !String(p.name).trim()) return fail('员工姓名不能为空')
  Object.keys(p).forEach((k) => {
    if (k !== 'id' && k !== 'password' && p[k] !== undefined) row[k] = p[k]
  })
  if (row.name) row.name = String(row.name).trim()
  persist()
  addLog('系统管理员', '修改', `员工 ${row.code} ${row.name}`)
  return ok(stripPassword(row))
}

function setStaffEnabled(id, enabled) {
  const row = find('staff', id)
  if (!row) return fail('员工不存在')
  if (!enabled && row.code === 'S000') return fail('超级管理员账号不能停用')
  row.enabled = !!enabled
  persist()
  addLog('系统管理员', enabled ? '启用账号' : '停用账号', `员工 ${row.code} ${row.name}`)
  return ok(stripPassword(row))
}

function resetStaffPassword(id) {
  const row = find('staff', id)
  if (!row) return fail('员工不存在')
  row.password = '123456'
  persist()
  addLog('系统管理员', '重置密码', `员工 ${row.code} ${row.name}`)
  return ok({ msg: '已重置为默认密码 123456' })
}

function deleteStaff(id) {
  requireState()
  const row = find('staff', id)
  if (!row) return fail('员工不存在')
  if (row.code === 'S000') return fail('超级管理员账号不能删除')
  if (all('schedules').some((x) => x.doctorId === id)) return fail('该员工存在排班记录，不能删除（可停用账号）')
  if (all('registrations').some((x) => x.doctorId === id)) return fail('该员工存在挂号记录，不能删除（可停用账号）')
  if (all('visits').some((x) => x.doctorId === id)) return fail('该员工存在接诊记录，不能删除（可停用账号）')
  if (all('admissions').some((x) => x.doctorId === id)) return fail('该员工存在住院记录，不能删除（可停用账号）')
  state.staff = all('staff').filter((x) => x.id !== id)
  persist()
  addLog('系统管理员', '删除', `员工 ${row.code} ${row.name}`)
  return ok({ id })
}

// =====================================================================
// 科室
// =====================================================================
function createDepartment(input) {
  const p = input || {}
  if (!p.name || !String(p.name).trim()) return fail('科室名称不能为空')
  if (!p.code || !String(p.code).trim()) return fail('科室编号不能为空')
  if (all('departments').some((x) => x.code === p.code)) return fail('科室编号已存在')
  const row = {
    id: 'dep' + nextId('departments').split('-')[1],
    code: String(p.code).trim(),
    name: String(p.name).trim(),
    phone: p.phone || '',
    director: p.director || '',
    status: p.status === 0 ? 0 : 1,
    createdAt: now()
  }
  add('departments', row)
  persist()
  addLog('系统管理员', '新增', `科室 ${row.code} ${row.name}`)
  return ok(row)
}

function updateDepartment(id, patch) {
  const row = find('departments', id)
  if (!row) return fail('科室不存在')
  const p = patch || {}
  if (p.code !== undefined && all('departments').some((x) => x.code === p.code && x.id !== id)) return fail('科室编号已存在')
  if (p.name !== undefined && !String(p.name).trim()) return fail('科室名称不能为空')
  Object.keys(p).forEach((k) => {
    if (p[k] !== undefined) row[k] = p[k]
  })
  persist()
  addLog('系统管理员', '修改', `科室 ${row.code} ${row.name}`)
  return ok(row)
}

function deleteDepartment(id) {
  const row = find('departments', id)
  if (!row) return fail('科室不存在')
  if (all('staff').some((x) => x.departmentId === id)) return fail('该科室下存在员工，不能删除')
  if (all('wards').some((x) => x.departmentId === id)) return fail('该科室下存在病区，不能删除')
  if (all('schedules').some((x) => x.departmentId === id)) return fail('该科室存在排班记录，不能删除')
  if (all('registrations').some((x) => x.departmentId === id)) return fail('该科室存在挂号记录，不能删除')
  state.departments = all('departments').filter((x) => x.id !== id)
  persist()
  addLog('系统管理员', '删除', `科室 ${row.code} ${row.name}`)
  return ok({ id })
}

// =====================================================================
// 病区
// =====================================================================
function createWard(input) {
  const p = input || {}
  if (!p.name || !String(p.name).trim()) return fail('病区名称不能为空')
  if (!p.code || !String(p.code).trim()) return fail('病区编号不能为空')
  if (all('wards').some((x) => x.code === p.code)) return fail('病区编号已存在')
  if (!p.departmentId) return fail('请选择所属科室')
  const row = {
    id: 'w' + nextId('wards').split('-')[1],
    code: String(p.code).trim(),
    name: String(p.name).trim(),
    departmentId: p.departmentId,
    floor: p.floor || '',
    headNurse: p.headNurse || '',
    status: p.status === 0 ? 0 : 1,
    createdAt: now()
  }
  add('wards', row)
  persist()
  addLog('系统管理员', '新增', `病区 ${row.code} ${row.name}`)
  return ok(row)
}

function updateWard(id, patch) {
  const row = find('wards', id)
  if (!row) return fail('病区不存在')
  const p = patch || {}
  if (p.code !== undefined && all('wards').some((x) => x.code === p.code && x.id !== id)) return fail('病区编号已存在')
  if (p.name !== undefined && !String(p.name).trim()) return fail('病区名称不能为空')
  Object.keys(p).forEach((k) => {
    if (p[k] !== undefined) row[k] = p[k]
  })
  persist()
  addLog('系统管理员', '修改', `病区 ${row.code} ${row.name}`)
  return ok(row)
}

function deleteWard(id) {
  const row = find('wards', id)
  if (!row) return fail('病区不存在')
  if (all('beds').some((x) => x.wardId === id)) return fail('该病区下存在床位，不能删除')
  if (all('admissions').some((x) => x.wardId === id)) return fail('该病区存在住院记录，不能删除')
  state.wards = all('wards').filter((x) => x.id !== id)
  persist()
  addLog('系统管理员', '删除', `病区 ${row.code} ${row.name}`)
  return ok({ id })
}

// =====================================================================
// 床位
// =====================================================================
function createBed(input) {
  const p = input || {}
  if (!p.wardId) return fail('请选择所属病区')
  if (!p.code || !String(p.code).trim()) return fail('床位号不能为空')
  const code = String(p.code).trim()
  if (all('beds').some((x) => x.wardId === p.wardId && x.code === code)) return fail('该病区下床位号已存在')
  const row = {
    id: 'b' + nextId('beds').split('-')[1],
    wardId: p.wardId,
    code,
    type: p.type || '普通床',
    status: '空闲',
    enabled: p.enabled === 0 ? 0 : 1,
    remark: p.remark || '',
    createdAt: now()
  }
  add('beds', row)
  persist()
  addLog('系统管理员', '新增', `床位 ${code}`)
  return ok(row)
}

function updateBed(id, patch) {
  const row = find('beds', id)
  if (!row) return fail('床位不存在')
  const p = patch || {}
  if (p.status !== undefined) {
    if (p.status === '占用' && row.status === '空闲') return fail('不能直接占用床位，请通过入院登记分配')
    if (p.status === '空闲' && row.status === '占用') return fail('占用床位请通过取消登记/出院结算释放')
  }
  if (p.enabled === 0 && row.status === '占用') return fail('床位正在被占用，不能停用')
  if (p.code !== undefined) {
    const code = String(p.code).trim()
    if (!code) return fail('床位号不能为空')
    if (all('beds').some((x) => x.wardId === row.wardId && x.code === code && x.id !== id)) return fail('该病区下床位号已存在')
    p.code = code
  }
  Object.keys(p).forEach((k) => {
    if (p[k] !== undefined) row[k] = p[k]
  })
  persist()
  addLog('系统管理员', '修改', `床位 ${row.code}`)
  return ok(row)
}

function deleteBed(id) {
  const row = find('beds', id)
  if (!row) return fail('床位不存在')
  if (row.status === '占用') return fail('床位正在被占用，不能删除')
  if (all('admissions').some((x) => x.bedId === id && ADM_ACTIVE.includes(x.status))) return fail('床位存在在院记录，不能删除')
  state.beds = all('beds').filter((x) => x.id !== id)
  persist()
  addLog('系统管理员', '删除', `床位 ${row.code}`)
  return ok({ id })
}

// =====================================================================
// 患者
// =====================================================================
function createPatient(input) {
  const p = input || {}
  if (!p.name || !String(p.name).trim()) return fail('患者姓名不能为空')
  if (!p.phone || !/^1[3-9]\d{9}$/.test(p.phone)) return fail('联系电话格式不正确')
  if (all('patients').some((x) => x.phone === p.phone)) return fail('联系电话已被其他患者使用')
  const row = {
    id: 'p' + nextId('patients').split('-')[1],
    code: nextPatientCode(),
    name: String(p.name).trim(),
    gender: p.gender === '男' ? '男' : '女',
    phone: p.phone,
    birthDate: p.birthDate || '',
    allergy: p.allergy || '',
    status: '正常',
    createdAt: now()
  }
  add('patients', row)
  persist()
  addLog('系统管理员', '新增', `患者 ${row.code} ${row.name}`)
  return ok(row)
}

function updatePatient(id, patch) {
  const row = find('patients', id)
  if (!row) return fail('患者不存在')
  const p = patch || {}
  if (p.phone !== undefined) {
    if (!/^1[3-9]\d{9}$/.test(p.phone)) return fail('联系电话格式不正确')
    if (all('patients').some((x) => x.phone === p.phone && x.id !== id)) return fail('联系电话已被其他患者使用')
  }
  if (p.name !== undefined && !String(p.name).trim()) return fail('患者姓名不能为空')
  Object.keys(p).forEach((k) => {
    if (p[k] !== undefined) row[k] = p[k]
  })
  if (row.name) row.name = String(row.name).trim()
  persist()
  addLog('系统管理员', '修改', `患者 ${row.code} ${row.name}`)
  return ok(row)
}

function deletePatient(id) {
  const row = find('patients', id)
  if (!row) return fail('患者不存在')
  if (all('registrations').some((x) => x.patientId === id)) return fail('该患者存在挂号记录，不能删除')
  if (all('admissions').some((x) => x.patientId === id)) return fail('该患者存在住院记录，不能删除')
  state.patients = all('patients').filter((x) => x.id !== id)
  persist()
  addLog('系统管理员', '删除', `患者 ${row.code} ${row.name}`)
  return ok({ id })
}

// =====================================================================
// 排班
// =====================================================================
function conflictSchedule(doctorId, date, period, excludeId) {
  return all('schedules').some(
    (x) => x.doctorId === doctorId && x.date === date && x.period === period && x.id !== excludeId
  )
}

function createSchedule(input) {
  const p = input || {}
  if (!p.doctorId) return fail('请选择出诊医生')
  if (!p.departmentId) return fail('请选择科室')
  if (!validDate(p.date)) return fail('请选择排班日期')
  if (!['上午', '下午'].includes(p.period)) return fail('请选择排班时段')
  if (conflictSchedule(p.doctorId, p.date, p.period)) return fail('该医生同一日期同时段已有排班，存在冲突')
  const doctor = find('staff', p.doctorId)
  if (doctor && doctor.departmentId && doctor.departmentId !== p.departmentId) return fail('医生与科室不匹配')
  const row = {
    id: 'sc' + nextId('schedules').split('-')[1],
    doctorId: p.doctorId,
    departmentId: p.departmentId,
    date: p.date,
    period: p.period,
    limit: isPosInt(p.limit) ? Number(p.limit) : 30,
    createdAt: now()
  }
  add('schedules', row)
  persist()
  addLog('系统管理员', '新增', `排班 ${doctor ? doctor.name : ''} ${p.date} ${p.period}`)
  return ok(row)
}

function updateSchedule(id, patch) {
  const row = find('schedules', id)
  if (!row) return fail('排班记录不存在')
  const p = patch || {}
  const doctorId = p.doctorId !== undefined ? p.doctorId : row.doctorId
  const date = p.date !== undefined ? p.date : row.date
  const period = p.period !== undefined ? p.period : row.period
  if (!validDate(date)) return fail('请选择排班日期')
  if (!['上午', '下午'].includes(period)) return fail('请选择排班时段')
  if (conflictSchedule(doctorId, date, period, id)) return fail('该医生同一日期同时段已有排班，存在冲突')
  if (row.date !== date || row.period !== period || row.doctorId !== doctorId) {
    if (all('registrations').some((x) => x.doctorId === row.doctorId && x.date === row.date && x.period === row.period && x.regStatus !== '已退号')) {
      return fail('该排班已产生挂号记录，不能修改时间或医生')
    }
  }
  Object.keys(p).forEach((k) => {
    if (p[k] !== undefined) row[k] = p[k]
  })
  if (p.limit !== undefined) row.limit = isPosInt(p.limit) ? Number(p.limit) : row.limit
  persist()
  addLog('系统管理员', '修改', `排班 ${row.date} ${row.period}`)
  return ok(row)
}

function deleteSchedule(id) {
  const row = find('schedules', id)
  if (!row) return fail('排班记录不存在')
  if (all('registrations').some((x) => x.doctorId === row.doctorId && x.date === row.date && x.period === row.period && x.regStatus !== '已退号')) {
    return fail('该排班已产生挂号记录，不能删除')
  }
  state.schedules = all('schedules').filter((x) => x.id !== id)
  persist()
  addLog('系统管理员', '删除', `排班 ${row.date} ${row.period}`)
  return ok({ id })
}

// =====================================================================
// 挂号
// =====================================================================
function regFeeForDepartment(departmentId) {
  return departmentId === 'dep4' ? 2000 : 1500
}

function createRegistration(input) {
  requireState()
  const p = input || {}
  if (!p.patientId) return fail('请选择患者')
  if (!p.departmentId) return fail('请选择科室')
  if (!p.doctorId) return fail('请选择医生')
  if (!validDate(p.date)) return fail('请选择就诊日期')
  if (!['上午', '下午'].includes(p.period)) return fail('请选择时段')
  const sched = all('schedules').find((x) => x.doctorId === p.doctorId && x.date === p.date && x.period === p.period)
  if (!sched) return fail('所选医生在该日期时段没有排班，请重新选择')
  const regCount = all('registrations').filter((x) => x.doctorId === p.doctorId && x.date === p.date && x.period === p.period && x.regStatus !== '已退号').length
  if (regCount >= sched.limit) return fail('该医生该时段号源已满')

  const feeCents = regFeeForDepartment(p.departmentId)
  const code = nextRegCode()
  const row = {
    id: 'r' + nextId('registrations').split('-')[1],
    code,
    patientId: p.patientId,
    departmentId: p.departmentId,
    doctorId: p.doctorId,
    date: p.date,
    period: p.period,
    feeCents,
    regStatus: '待分诊',
    payStatus: '已缴费',
    visitId: '',
    createdAt: now()
  }
  add('registrations', row)
  add('feeRecords', {
    id: 'fr' + nextId('feeRecords').split('-')[1],
    code: nextPayCode(),
    type: '挂号费',
    refId: row.id,
    amountCents: feeCents,
    status: '已缴费',
    paidAt: now()
  })
  persist()
  addLog('系统管理员', '挂号', `挂号 ${code}`)
  return ok(row)
}

function refundRegistration(id) {
  requireState()
  const row = find('registrations', id)
  if (!row) return fail('挂号记录不存在')
  if (row.regStatus === '已退号') return fail('该挂号已退号，不能重复退号')
  if (row.visitId || all('visits').some((x) => x.regId === id)) return fail('该挂号已接诊，不能退号')
  row.regStatus = '已退号'
  const fr = all('feeRecords').find((x) => x.refId === id && x.type === '挂号费')
  if (fr) fr.status = '已退费'
  else if (row.payStatus === '已缴费') {
    add('feeRecords', {
      id: 'fr' + nextId('feeRecords').split('-')[1],
      code: nextPayCode(),
      type: '挂号费',
      refId: id,
      amountCents: row.feeCents,
      status: '已退费',
      paidAt: now()
    })
  }
  row.payStatus = '已退费'
  persist()
  addLog('系统管理员', '退号', `挂号 ${row.code}`)
  return ok(row)
}

// =====================================================================
// 接诊
// =====================================================================
function normalizeVisitItems(prescriptions, exams) {
  const pItems = []
  for (const it of prescriptions || []) {
    if (!it.medicineId) return { error: '请选择处方药品' }
    const med = find('medicines', it.medicineId)
    if (!med) return { error: '药品不存在' }
    if (!isPosInt(it.qty)) return { error: '药品数量须为正整数' }
    const priceCents = Number.isInteger(it.priceCents) ? it.priceCents : med.priceCents
    if (priceCents < 0) return { error: '药品价格不合法' }
    pItems.push({
      medicineId: it.medicineId,
      medicineName: med.name,
      usage: it.usage || '口服',
      qty: Number(it.qty),
      priceCents,
      amountCents: Number(it.qty) * priceCents
    })
  }
  const eItems = []
  for (const it of exams || []) {
    if (!it.examItemId) return { error: '请选择医技项目' }
    const exam = find('examItems', it.examItemId)
    if (!exam) return { error: '医技项目不存在' }
    if (!isPosInt(it.qty)) return { error: '项目数量须为正整数' }
    const priceCents = Number.isInteger(it.priceCents) ? it.priceCents : exam.priceCents
    if (priceCents < 0) return { error: '项目价格不合法' }
    eItems.push({
      examItemId: it.examItemId,
      examItemName: exam.name,
      qty: Number(it.qty),
      priceCents,
      amountCents: Number(it.qty) * priceCents
    })
  }
  return { pItems, eItems }
}

function createVisit(input) {
  requireState()
  const p = input || {}
  if (!p.regId) return fail('请选择挂号记录')
  const reg = find('registrations', p.regId)
  if (!reg) return fail('挂号记录不存在')
  if (reg.regStatus === '已退号') return fail('该挂号已退号，不能接诊')
  if (reg.visitId) return fail('该挂号已接诊，不能重复接诊')
  if (all('visits').some((x) => x.regId === p.regId)) return fail('该挂号已存在接诊记录')

  const items = normalizeVisitItems(p.prescriptions || [], p.exams || [])
  if (items.error) return fail(items.error)

  const row = {
    id: 'v' + nextId('visits').split('-')[1],
    code: nextVisitCode(),
    regId: reg.id,
    patientId: reg.patientId,
    doctorId: reg.doctorId,
    departmentId: reg.departmentId,
    date: reg.date,
    visitStatus: p.visitStatus === '已完成' ? '已完成' : '就诊中',
    needHospital: p.needHospital === '建议住院' ? '建议住院' : '否',
    complaint: p.complaint || '',
    history: p.history || '',
    diagnosis: p.diagnosis || '',
    advice: p.advice || '',
    prescriptions: items.pItems,
    exams: items.eItems,
    chargeStatus: '未收费',
    dispenseStatus: items.pItems.length ? '未发药' : '—',
    reportStatus: items.eItems.length ? '待报告' : '—',
    reports: [],
    createdAt: now()
  }
  add('visits', row)
  reg.visitId = row.id
  if (row.visitStatus === '已完成') reg.regStatus = '已完成'
  persist()
  addLog('系统管理员', '接诊', `接诊 ${row.code}`)
  return ok(row)
}

function updateVisit(id, patch) {
  requireState()
  const row = find('visits', id)
  if (!row) return fail('接诊记录不存在')
  const p = patch || {}
  if (row.chargeStatus === '已收费') return fail('该接诊已收费，不能修改（如需变更请先处理收费记录）')
  if (row.dispenseStatus === '已发药') return fail('该接诊处方已发药，不能修改')
  const prescriptions = p.prescriptions !== undefined ? p.prescriptions : row.prescriptions
  const exams = p.exams !== undefined ? p.exams : row.exams
  const items = normalizeVisitItems(prescriptions, exams)
  if (items.error) return fail(items.error)

  row.prescriptions = items.pItems
  row.exams = items.eItems
  row.visitStatus = p.visitStatus === '已完成' ? '已完成' : '就诊中'
  row.needHospital = p.needHospital === '建议住院' ? '建议住院' : '否'
  row.complaint = p.complaint !== undefined ? p.complaint : row.complaint
  row.history = p.history !== undefined ? p.history : row.history
  row.diagnosis = p.diagnosis !== undefined ? p.diagnosis : row.diagnosis
  row.advice = p.advice !== undefined ? p.advice : row.advice
  row.dispenseStatus = items.pItems.length ? (row.dispenseStatus === '—' ? '未发药' : row.dispenseStatus) : '—'
  row.reportStatus = items.eItems.length ? (row.reportStatus === '—' ? '待报告' : row.reportStatus) : '—'

  const reg = find('registrations', row.regId)
  if (reg) reg.regStatus = row.visitStatus === '已完成' ? '已完成' : '待分诊'
  persist()
  addLog('系统管理员', '修改', `接诊 ${row.code}`)
  return ok(row)
}

// =====================================================================
// 药品 / 医技项目 / 收费项目 / 批次库存
// =====================================================================
function createMedicine(input) {
  const p = input || {}
  if (!p.name || !String(p.name).trim()) return fail('药品名称不能为空')
  if (!p.code || !String(p.code).trim()) return fail('药品编码不能为空')
  if (all('medicines').some((x) => x.code === p.code)) return fail('药品编码已存在')
  if (!isNonNegInt(p.priceCents)) return fail('药品价格不合法')
  const row = {
    id: 'm' + nextId('medicines').split('-')[1],
    code: String(p.code).trim(),
    name: String(p.name).trim(),
    spec: p.spec || '',
    unit: p.unit || '盒',
    priceCents: Number(p.priceCents),
    stock: isNonNegInt(p.stock) ? Number(p.stock) : 0,
    status: p.status === 0 ? 0 : 1,
    createdAt: now()
  }
  add('medicines', row)
  persist()
  addLog('系统管理员', '新增', `药品 ${row.code} ${row.name}`)
  return ok(row)
}

function updateMedicine(id, patch) {
  const row = find('medicines', id)
  if (!row) return fail('药品不存在')
  const p = patch || {}
  if (p.code !== undefined && all('medicines').some((x) => x.code === p.code && x.id !== id)) return fail('药品编码已存在')
  if (p.name !== undefined && !String(p.name).trim()) return fail('药品名称不能为空')
  if (p.priceCents !== undefined && !isNonNegInt(p.priceCents)) return fail('药品价格不合法')
  Object.keys(p).forEach((k) => {
    if (p[k] !== undefined) row[k] = p[k]
  })
  persist()
  addLog('系统管理员', '修改', `药品 ${row.code} ${row.name}`)
  return ok(row)
}

function deleteMedicine(id) {
  const row = find('medicines', id)
  if (!row) return fail('药品不存在')
  if (all('stocks').some((x) => x.medicineId === id)) return fail('该药品存在批次库存记录，不能删除')
  if (all('visits').some((x) => (x.prescriptions || []).some((it) => it.medicineId === id))) return fail('该药品已被处方引用，不能删除')
  if (all('orders').some((x) => x.refId === id && x.type === '药品')) return fail('该药品已被住院医嘱引用，不能删除')
  state.medicines = all('medicines').filter((x) => x.id !== id)
  persist()
  addLog('系统管理员', '删除', `药品 ${row.code} ${row.name}`)
  return ok({ id })
}

function createExamItem(input) {
  const p = input || {}
  if (!p.name || !String(p.name).trim()) return fail('项目名称不能为空')
  if (!p.code || !String(p.code).trim()) return fail('项目编码不能为空')
  if (all('examItems').some((x) => x.code === p.code)) return fail('项目编码已存在')
  if (!isNonNegInt(p.priceCents)) return fail('项目价格不合法')
  const row = {
    id: 'e' + nextId('examItems').split('-')[1],
    code: String(p.code).trim(),
    name: String(p.name).trim(),
    category: p.category || '检验',
    priceCents: Number(p.priceCents),
    status: p.status === 0 ? 0 : 1,
    createdAt: now()
  }
  add('examItems', row)
  persist()
  addLog('系统管理员', '新增', `医技项目 ${row.code} ${row.name}`)
  return ok(row)
}

function updateExamItem(id, patch) {
  const row = find('examItems', id)
  if (!row) return fail('项目不存在')
  const p = patch || {}
  if (p.code !== undefined && all('examItems').some((x) => x.code === p.code && x.id !== id)) return fail('项目编码已存在')
  if (p.name !== undefined && !String(p.name).trim()) return fail('项目名称不能为空')
  if (p.priceCents !== undefined && !isNonNegInt(p.priceCents)) return fail('项目价格不合法')
  Object.keys(p).forEach((k) => {
    if (p[k] !== undefined) row[k] = p[k]
  })
  persist()
  addLog('系统管理员', '修改', `医技项目 ${row.code} ${row.name}`)
  return ok(row)
}

function deleteExamItem(id) {
  const row = find('examItems', id)
  if (!row) return fail('项目不存在')
  if (all('visits').some((x) => (x.exams || []).some((it) => it.examItemId === id))) return fail('该项目已被医技申请引用，不能删除')
  if (all('orders').some((x) => x.refId === id && x.type === '医技项目')) return fail('该项目已被住院医嘱引用，不能删除')
  state.examItems = all('examItems').filter((x) => x.id !== id)
  persist()
  addLog('系统管理员', '删除', `医技项目 ${row.code} ${row.name}`)
  return ok({ id })
}

function createFeeItem(input) {
  const p = input || {}
  if (!p.name || !String(p.name).trim()) return fail('收费项目名称不能为空')
  if (!p.code || !String(p.code).trim()) return fail('项目编码不能为空')
  if (all('feeItems').some((x) => x.code === p.code)) return fail('项目编码已存在')
  if (!isNonNegInt(p.priceCents)) return fail('收费价格不合法')
  const row = {
    id: 'f' + nextId('feeItems').split('-')[1],
    code: String(p.code).trim(),
    name: String(p.name).trim(),
    category: p.category || '门诊',
    priceCents: Number(p.priceCents),
    status: p.status === 0 ? 0 : 1,
    createdAt: now()
  }
  add('feeItems', row)
  persist()
  addLog('系统管理员', '新增', `收费项目 ${row.code} ${row.name}`)
  return ok(row)
}

function updateFeeItem(id, patch) {
  const row = find('feeItems', id)
  if (!row) return fail('收费项目不存在')
  const p = patch || {}
  if (p.code !== undefined && all('feeItems').some((x) => x.code === p.code && x.id !== id)) return fail('项目编码已存在')
  if (p.name !== undefined && !String(p.name).trim()) return fail('收费项目名称不能为空')
  if (p.priceCents !== undefined && !isNonNegInt(p.priceCents)) return fail('收费价格不合法')
  Object.keys(p).forEach((k) => {
    if (p[k] !== undefined) row[k] = p[k]
  })
  persist()
  addLog('系统管理员', '修改', `收费项目 ${row.code} ${row.name}`)
  return ok(row)
}

function deleteFeeItem(id) {
  const row = find('feeItems', id)
  if (!row) return fail('收费项目不存在')
  if (all('orders').some((x) => x.refId === id && x.type === '收费项目')) return fail('该项目已被住院医嘱引用，不能删除')
  state.feeItems = all('feeItems').filter((x) => x.id !== id)
  persist()
  addLog('系统管理员', '删除', `收费项目 ${row.code} ${row.name}`)
  return ok({ id })
}

function createStock(input) {
  const p = input || {}
  if (!p.medicineId) return fail('请选择药品')
  if (!p.batchNo || !String(p.batchNo).trim()) return fail('批号不能为空')
  if (all('stocks').some((x) => x.medicineId === p.medicineId && x.batchNo === p.batchNo)) return fail('该药品批号已存在')
  if (!isNonNegInt(p.qty)) return fail('库存数量不合法')
  if (!validDate(p.expiry)) return fail('有效期格式不正确')
  const row = {
    id: 'st' + nextId('stocks').split('-')[1],
    medicineId: p.medicineId,
    batchNo: String(p.batchNo).trim(),
    qty: Number(p.qty),
    expiry: p.expiry,
    createdAt: now()
  }
  add('stocks', row)
  persist()
  addLog('系统管理员', '新增', `批次库存 ${row.batchNo}`)
  return ok(row)
}

function updateStock(id, patch) {
  const row = find('stocks', id)
  if (!row) return fail('库存记录不存在')
  const p = patch || {}
  if (p.qty !== undefined && !isNonNegInt(p.qty)) return fail('库存数量不合法')
  if (p.expiry !== undefined && !validDate(p.expiry)) return fail('有效期格式不正确')
  Object.keys(p).forEach((k) => {
    if (p[k] !== undefined) row[k] = p[k]
  })
  persist()
  addLog('系统管理员', '修改', `批次库存 ${row.batchNo}`)
  return ok(row)
}

function deleteStock(id) {
  const row = find('stocks', id)
  if (!row) return fail('库存记录不存在')
  state.stocks = all('stocks').filter((x) => x.id !== id)
  persist()
  addLog('系统管理员', '删除', `批次库存 ${row.batchNo}`)
  return ok({ id })
}

// =====================================================================
// 入院登记
// =====================================================================
function activeAdmissionOfPatient(patientId, excludeId) {
  return all('admissions').find((x) => x.patientId === patientId && ADM_ACTIVE.includes(x.status) && x.id !== excludeId)
}

function admissionOfBed(bedId, excludeId) {
  return all('admissions').find((x) => x.bedId === bedId && ADM_ACTIVE.includes(x.status) && x.id !== excludeId)
}

function createAdmission(input) {
  requireState()
  const p = input || {}
  if (!p.patientId) return fail('请选择患者')
  if (!p.departmentId) return fail('请选择入院科室')
  if (!p.wardId) return fail('请选择病区')
  if (!p.bedId) return fail('请选择床位')
  if (!isNonNegInt(p.depositCents)) return fail('预交金额不合法')
  const patient = find('patients', p.patientId)
  if (!patient) return fail('患者不存在')
  if (activeAdmissionOfPatient(p.patientId)) return fail('该患者已有在院/待入科/待结算记录，不能重复登记')
  const ward = find('wards', p.wardId)
  if (!ward) return fail('病区不存在')
  const bed = find('beds', p.bedId)
  if (!bed) return fail('床位不存在')
  if (bed.wardId !== p.wardId) return fail('所选床位不属于该病区')
  if (bed.status !== '空闲') return fail('所选床位已被占用，请选择空闲床位')
  if (!bed.enabled) return fail('所选床位已停用，请选择其他床位')
  if (admissionOfBed(p.bedId)) return fail('所选床位已被其他在院患者占用')

  const row = {
    id: 'a' + nextId('admissions').split('-')[1],
    code: nextAdmissionCode(),
    patientId: p.patientId,
    departmentId: p.departmentId,
    wardId: p.wardId,
    bedId: p.bedId,
    doctorId: p.doctorId || '',
    depositCents: Number(p.depositCents),
    status: '待入科',
    admitAt: now(),
    confirmAt: '',
    dischargeAt: '',
    createdAt: now()
  }
  bed.status = '占用'
  add('admissions', row)
  persist()
  addLog('系统管理员', '入院登记', `住院 ${row.code}`)
  return ok(row)
}

function updateAdmissionDeposit(id, depositCents) {
  const row = find('admissions', id)
  if (!row) return fail('住院记录不存在')
  if (!ADM_ACTIVE.includes(row.status)) return fail('当前状态不能修改预交金额')
  if (!isNonNegInt(depositCents)) return fail('预交金额不合法')
  row.depositCents = Number(depositCents)
  persist()
  addLog('系统管理员', '修改', `住院 ${row.code} 预交金额`)
  return ok(row)
}

function confirmAdmission(id) {
  const row = find('admissions', id)
  if (!row) return fail('住院记录不存在')
  if (row.status !== '待入科') return fail('仅待入科记录可执行入科确认')
  row.status = '在院'
  row.confirmAt = now()
  persist()
  addLog('系统管理员', '入科确认', `住院 ${row.code}`)
  return ok(row)
}

function transferAdmission(id, input) {
  requireState()
  const row = find('admissions', id)
  if (!row) return fail('住院记录不存在')
  if (!ADM_ACTIVE.includes(row.status)) return fail('当前状态不能转科转床')
  const p = input || {}
  const wardId = p.wardId || row.wardId
  const bedId = p.bedId || row.bedId
  const ward = find('wards', wardId)
  if (!ward) return fail('病区不存在')
  const bed = find('beds', bedId)
  if (!bed) return fail('床位不存在')
  if (bed.wardId !== wardId) return fail('所选床位不属于该病区')
  if (bedId === row.bedId && wardId === row.wardId) return fail('未发生任何变更')
  if (bedId !== row.bedId) {
    if (bed.status !== '空闲') return fail('目标床位已被占用')
    if (!bed.enabled) return fail('目标床位已停用')
    if (admissionOfBed(bedId, id)) return fail('目标床位已被其他在院患者占用')
  }
  if (bedId !== row.bedId) {
    const oldBed = find('beds', row.bedId)
    if (oldBed) oldBed.status = '空闲'
    bed.status = '占用'
  }
  row.wardId = wardId
  row.bedId = bedId
  if (p.departmentId) row.departmentId = p.departmentId
  persist()
  addLog('系统管理员', '转科转床', `住院 ${row.code}`)
  return ok(row)
}

function cancelAdmission(id) {
  requireState()
  const row = find('admissions', id)
  if (!row) return fail('住院记录不存在')
  if (row.status !== '待入科') return fail('已入科记录不能取消登记，请走出院结算流程')
  const bed = find('beds', row.bedId)
  if (bed) bed.status = '空闲'
  row.status = '已取消'
  persist()
  addLog('系统管理员', '取消登记', `住院 ${row.code}`)
  return ok(row)
}

function requestDischarge(id) {
  const row = find('admissions', id)
  if (!row) return fail('住院记录不存在')
  if (row.status === '在院') {
    row.status = '待结算'
    persist()
    addLog('系统管理员', '申请出院', `住院 ${row.code}`)
    return ok(row)
  }
  if (row.status === '待结算') return ok(row)
  return fail('当前状态不能申请出院')
}

// =====================================================================
// 住院医嘱 / 出院结算
// =====================================================================
function createOrder(input) {
  requireState()
  const p = input || {}
  const adm = find('admissions', p.admissionId)
  if (!adm) return fail('住院记录不存在')
  if (!['在院', '待结算'].includes(adm.status)) return fail('仅住院中的患者可开立医嘱')
  if (!p.type || !['药品', '医技项目', '收费项目'].includes(p.type)) return fail('医嘱类型不合法')
  if (!p.refId) return fail('请选择医嘱项目')
  if (!isPosInt(p.qty)) return fail('数量须为正整数')
  if (!isNonNegInt(p.priceCents)) return fail('价格不合法')
  let name = p.name
  if (!name) {
    const src = p.type === '药品' ? find('medicines', p.refId) : p.type === '医技项目' ? find('examItems', p.refId) : find('feeItems', p.refId)
    if (!src) return fail('医嘱项目不存在')
    name = src.name
  }
  const row = {
    id: 'o' + nextId('orders').split('-')[1],
    admissionId: p.admissionId,
    type: p.type,
    refId: p.refId,
    name,
    qty: Number(p.qty),
    priceCents: Number(p.priceCents),
    status: '未执行',
    executedAt: '',
    createdAt: now()
  }
  add('orders', row)
  persist()
  addLog('系统管理员', '开立医嘱', `${adm.code} ${name}`)
  return ok(row)
}

function executeOrder(id) {
  const row = find('orders', id)
  if (!row) return fail('医嘱不存在')
  if (row.status === '已执行') return fail('医嘱已执行，不能重复执行')
  row.status = '已执行'
  row.executedAt = now()
  persist()
  addLog('系统管理员', '执行医嘱', row.name)
  return ok(row)
}

function cancelOrder(id) {
  const row = find('orders', id)
  if (!row) return fail('医嘱不存在')
  if (row.status === '已执行') return fail('已执行医嘱不能作废')
  state.orders = all('orders').filter((x) => x.id !== id)
  persist()
  addLog('系统管理员', '作废医嘱', row.name)
  return ok({ id })
}

function settleDischarge(id) {
  requireState()
  const row = find('admissions', id)
  if (!row) return fail('住院记录不存在')
  if (row.status === '已结算' || row.status === '已出院') return fail('该记录已结算，不能重复结算')
  if (row.status === '已取消') return fail('已取消记录不能结算')
  if (row.status === '待入科') return fail('待入科记录请先取消登记或执行入科')
  const admOrders = all('orders').filter((x) => x.admissionId === id && x.status === '已执行')
  const totalCents = sumCents(admOrders.map((o) => o.qty * o.priceCents))
  const balanceCents = row.depositCents - totalCents
  const settlement = {
    id: 'set' + nextId('settlements').split('-')[1],
    admissionId: id,
    totalCents,
    depositCents: row.depositCents,
    balanceCents,
    status: '已结算',
    settledAt: now(),
    createdAt: now()
  }
  add('settlements', settlement)
  row.status = '已出院'
  row.dischargeAt = now()
  const bed = find('beds', row.bedId)
  if (bed) bed.status = '空闲'
  if (balanceCents < 0) {
    add('feeRecords', {
      id: 'fr' + nextId('feeRecords').split('-')[1],
      code: nextPayCode(),
      type: '住院结算补缴',
      refId: id,
      amountCents: -balanceCents,
      status: '已缴费',
      paidAt: now()
    })
  } else if (balanceCents > 0) {
    add('feeRecords', {
      id: 'fr' + nextId('feeRecords').split('-')[1],
      code: nextPayCode(),
      type: '住院结算退费',
      refId: id,
      amountCents: balanceCents,
      status: '已退费',
      paidAt: now()
    })
  }
  persist()
  addLog('系统管理员', '出院结算', `住院 ${row.code}`)
  return ok({ settlement, totalCents, balanceCents })
}

// =====================================================================
// 门诊收费 / 处方发药 / 医技报告
// =====================================================================
function visitTotalCents(visit) {
  const rx = sumCents((visit.prescriptions || []).map((x) => x.amountCents))
  const ex = sumCents((visit.exams || []).map((x) => x.amountCents))
  return rx + ex
}

function chargeVisit(id) {
  requireState()
  const row = find('visits', id)
  if (!row) return fail('接诊记录不存在')
  if (row.chargeStatus === '已收费') return fail('该记录已收费，不能重复收费')
  const total = visitTotalCents(row)
  if (total <= 0) return fail('该接诊没有待收费项目')
  add('feeRecords', {
    id: 'fr' + nextId('feeRecords').split('-')[1],
    code: nextPayCode(),
    type: '门诊收费',
    refId: row.id,
    amountCents: total,
    status: '已缴费',
    paidAt: now()
  })
  row.chargeStatus = '已收费'
  if (row.dispenseStatus === '未发药') row.dispenseStatus = '未发药'
  persist()
  addLog('系统管理员', '门诊收费', `接诊 ${row.code}`)
  return ok({ totalCents: total })
}

function dispenseVisit(id) {
  requireState()
  const row = find('visits', id)
  if (!row) return fail('接诊记录不存在')
  if (!(row.prescriptions || []).length) return fail('该接诊没有处方明细')
  if (row.chargeStatus !== '已收费') return fail('请先完成门诊收费')
  if (row.dispenseStatus === '已发药') return fail('处方已发药，不能重复发药')
  for (const it of row.prescriptions) {
    const med = find('medicines', it.medicineId)
    if (!med) return fail(`药品 ${it.medicineName} 不存在`)
    if (med.stock < it.qty) return fail(`药品 ${it.medicineName} 库存不足`)
  }
  for (const it of row.prescriptions) {
    const med = find('medicines', it.medicineId)
    med.stock = med.stock - it.qty
  }
  row.dispenseStatus = '已发药'
  persist()
  addLog('系统管理员', '处方发药', `接诊 ${row.code}`)
  return ok(row)
}

function createReport(visitId, examItemId, content) {
  requireState()
  const row = find('visits', visitId)
  if (!row) return fail('接诊记录不存在')
  const exam = (row.exams || []).find((x) => x.examItemId === examItemId)
  if (!exam) return fail('该接诊没有此医技申请')
  if (!content || !String(content).trim()) return fail('报告内容不能为空')
  row.reports = row.reports || []
  if (row.reports.some((x) => x.examItemId === examItemId)) return fail('该项目已出报告')
  row.reports.push({ examItemId, examItemName: exam.examItemName, content: String(content).trim(), at: now() })
  if ((row.exams || []).every((x) => (row.reports || []).some((r) => r.examItemId === x.examItemId))) {
    row.reportStatus = '已出报告'
  } else {
    row.reportStatus = '部分出报告'
  }
  persist()
  addLog('系统管理员', '出具报告', exam.examItemName)
  return ok(row)
}

// =====================================================================
// 操作日志 / 系统
// =====================================================================
function addLog(operator, action, target) {
  requireState()
  all('logs').unshift({
    id: 'lg' + nextId('logs').split('-')[1],
    operator,
    action,
    target,
    time: now(),
    ip: '192.168.1.10'
  })
  if (all('logs').length > 500) state.logs = all('logs').slice(0, 500)
  persist()
  return true
}

function clearLogs() {
  state.logs = []
  persist()
  return ok({})
}

function saveRoleMenu(roleId, menuCodes) {
  const role = find('roles', roleId)
  if (!role) return fail('角色不存在')
  role.menuCodes = Array.isArray(menuCodes) ? menuCodes.slice() : []
  persist()
  addLog('系统管理员', '修改角色权限', role.name)
  return ok(role)
}

function createRole(input) {
  const p = input || {}
  if (!p.name || !String(p.name).trim()) return fail('角色名称不能为空')
  if (!p.code || !String(p.code).trim()) return fail('角色编码不能为空')
  if (all('roles').some((x) => x.code === p.code)) return fail('角色编码已存在')
  const row = {
    id: 'role' + nextId('roles').split('-')[1],
    name: String(p.name).trim(),
    code: String(p.code).trim(),
    description: p.description || '',
    menuCodes: Array.isArray(p.menuCodes) ? p.menuCodes : []
  }
  add('roles', row)
  persist()
  addLog('系统管理员', '新增角色', row.name)
  return ok(row)
}

function deleteRole(id) {
  const row = find('roles', id)
  if (!row) return fail('角色不存在')
  if (row.code === 'SUPER_ADMIN') return fail('超级管理员角色不能删除')
  if (all('staff').some((x) => x.role === row.name)) return fail('该角色已分配员工，不能删除')
  state.roles = all('roles').filter((x) => x.id !== id)
  persist()
  addLog('系统管理员', '删除角色', row.name)
  return ok({ id })
}

function resetAll() {
  state = buildSeed()
  persist()
  addLog('系统管理员', '重置演示数据', '全部演示数据')
  return ok({ msg: '演示数据已重置' })
}

// =====================================================================
// 首页统计（全部由当前 Mock 数据计算）
// =====================================================================
function stats() {
  requireState()
  const today = state.demoToday
  const regs = all('registrations')
  const fees = all('feeRecords')
  const visits = all('visits')
  const beds = all('beds')
  const adms = all('admissions')
  const orders = all('orders')

  const activeRegs = regs.filter((r) => r.regStatus !== '已退号')
  const todayRegCount = activeRegs.filter((r) => r.date === today).length
  const todayFeeCents = sumCents(fees.filter((f) => f.status === '已缴费' && String(f.paidAt).startsWith(today)).map((f) => f.amountCents))

  const pendingAdm = adms.filter((a) => a.status === '待入科').length
  const inWard = adms.filter((a) => a.status === '在院').length
  const pendingSettle = adms.filter((a) => a.status === '待结算').length

  const totalBeds = beds.length
  const occupiedBeds = beds.filter((b) => b.status === '占用').length
  const idleBeds = beds.filter((b) => b.status === '空闲').length

  const days = []
  for (let i = 6; i >= 0; i--) {
    const dt = new Date(today + 'T00:00:00')
    dt.setDate(dt.getDate() - i)
    const p = (n) => String(n).padStart(2, '0')
    const ds = `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`
    const regCount = activeRegs.filter((r) => r.date === ds).length
    const feeSum = sumCents(fees.filter((f) => f.status === '已缴费' && String(f.paidAt).startsWith(ds)).map((f) => f.amountCents))
    days.push({ date: ds, regCount, feeCents: feeSum })
  }

  const pendingOrders = orders.filter((o) => o.status === '未执行').length
  const pendingDispense = visits.filter(
    (v) => v.chargeStatus === '已收费' && v.dispenseStatus === '未发药' && (v.prescriptions || []).length > 0
  ).length
  const pendingReports = visits.filter((v) => (v.exams || []).length > 0 && v.reportStatus !== '已出报告').length

  const regStatusCount = {
    待分诊: activeRegs.filter((r) => r.regStatus === '待分诊').length,
    已完成: activeRegs.filter((r) => r.regStatus === '已完成').length,
    已退号: regs.filter((r) => r.regStatus === '已退号').length
  }

  return {
    today,
    todayRegCount,
    todayFeeCents,
    totalPatients: all('patients').length,
    totalStaff: all('staff').length,
    inHospital: { pendingAdm, inWard, pendingSettle, total: pendingAdm + inWard + pendingSettle },
    beds: { total: totalBeds, occupied: occupiedBeds, idle: idleBeds, occupancyPct: totalBeds ? Math.round((occupiedBeds / totalBeds) * 100) : 0 },
    last7days: days,
    todo: { pendingOrders, pendingDispense, todayFeeCents, pendingReports },
    regStatusCount,
    totalDepartments: all('departments').length
  }
}

// =====================================================================
// 身份 / 角色（登录后按 token 复原，刷新不丢角色）
// =====================================================================
function permissionsOf(staff) {
  if (!staff) return { roleCode: '', menuCodes: [] }
  const role = all('roles').find(function (r) { return r.name === staff.role }) || all('roles').find(function (r) { return r.code === staff.role })
  return { roleCode: role ? role.code : '', menuCodes: role ? (role.menuCodes || []).slice() : [] }
}

function profileOf(token) {
  const m = String(token || '').match(/^mock-token-(.+)$/)
  if (!m) return null
  const staff = find('staff', m[1])
  if (!staff) return null
  const perm = permissionsOf(staff)
  return Object.assign(stripPassword(staff), { roleCode: perm.roleCode, menuCodes: perm.menuCodes })
}

// =====================================================================
// 个人待办（优先级建议为本地规则占位，B3 起可改接 AI 服务）
// =====================================================================
function suggestTodoPriority(input) {
  const p = input || {}
  const due = p.dueDate || ''
  const today = (state && state.demoToday) ? state.demoToday : now().slice(0, 10)
  let score = 0
  const reasons = []
  if (due) {
    const diff = Math.round((new Date(due + 'T00:00:00') - new Date(today + 'T00:00:00')) / 86400000)
    if (diff < 0) { score += 3; reasons.push('已逾期') }
    else if (diff === 0) { score += 2; reasons.push('今日到期') }
    else if (diff <= 2) { score += 1; reasons.push(diff + ' 天内到期') }
  } else {
    reasons.push('未设置截止时间')
  }
  const mod = p.module || ''
  if (['住院管理', '门诊管理', '收费', '收费项目'].indexOf(mod) !== -1) { score += 1; reasons.push('关联高风险业务模块') }
  const priority = score >= 3 ? '高' : score >= 1 ? '中' : '低'
  return { priority: priority, reason: reasons.join('；') || '常规事务' }
}

function createTodo(input) {
  requireState()
  const p = input || {}
  if (!p.title || !String(p.title).trim()) return fail('待办标题不能为空')
  const sug = suggestTodoPriority(p)
  const actor = currentActor || {}
  const row = {
    id: 'td' + nextSeq('todos'),
    ownerStaffId: p.ownerStaffId || actor.id || '',
    ownerRole: p.ownerRole || actor.role || '',
    title: String(p.title).trim(),
    description: p.description || '',
    module: p.module || '',
    dueDate: p.dueDate || '',
    prioritySuggested: sug.priority,
    priorityConfirmed: p.priorityConfirmed || '',
    aiReason: sug.reason,
    status: '未完成',
    source: p.source === 'system' ? 'system' : 'user',
    createdAt: now(),
    doneAt: ''
  }
  add('todos', row)
  recordAudit(currentActor, '新增待办', { entityType: 'todo', entityId: row.id, entityCode: row.id, summary: '待办 ' + row.title, after: summarizeEntity(row) })
  persist()
  return ok(row)
}

function updateTodo(id, patch) {
  requireState()
  const row = find('todos', id)
  if (!row) return fail('待办不存在')
  const p = patch || {}
  if (p.title !== undefined && !String(p.title).trim()) return fail('待办标题不能为空')
  const before = summarizeEntity(row)
  Object.keys(p).forEach(function (k) {
    if (['title', 'description', 'module', 'dueDate', 'priorityConfirmed', 'status'].indexOf(k) !== -1 && p[k] !== undefined) row[k] = p[k]
  })
  if (p.title !== undefined) row.title = String(row.title).trim()
  if (row.status === '已完成' && !row.doneAt) row.doneAt = now()
  recordAudit(currentActor, '修改待办', { entityType: 'todo', entityId: row.id, entityCode: row.id, summary: '待办 ' + row.title, before: before, after: summarizeEntity(row) })
  persist()
  return ok(row)
}

function setTodoStatus(id, status) {
  return updateTodo(id, { status: status === '已完成' ? '已完成' : '未完成' })
}

function deleteTodo(id) {
  requireState()
  const row = find('todos', id)
  if (!row) return fail('待办不存在')
  state.todos = all('todos').filter(function (x) { return x.id !== id })
  recordAudit(currentActor, '删除待办', { entityType: 'todo', entityId: id, entityCode: id, summary: '待办 ' + row.title, before: summarizeEntity(row) })
  persist()
  return ok({ id: id })
}

// =====================================================================
// 系统提醒（规则实时计算：问题解决即自动完成，不能仅靠关闭）
// =====================================================================
const REMINDER_RULES = {
  LOW_STOCK: 50,
  BED_OCCUPANCY: 80,
  STOCK_EXPIRY_DAYS: 30
}

function daysBetween(a, b) {
  return Math.round((new Date(a + 'T00:00:00') - new Date(b + 'T00:00:00')) / 86400000)
}

function computeReminders() {
  requireState()
  const out = []
  const today = state.demoToday || now().slice(0, 10)
  all('medicines').forEach(function (m) {
    if (m.status === 1 && Number(m.stock) < REMINDER_RULES.LOW_STOCK) {
      out.push({ id: 'lowStock:' + m.id, rule: 'lowStock', level: 'high', title: '药品库存偏低', detail: m.name + ' 当前库存 ' + m.stock + '，低于阈值 ' + REMINDER_RULES.LOW_STOCK, refType: 'medicine', refId: m.id, link: '/basic/medicines' })
    }
  })
  const beds = all('beds')
  const totalBeds = beds.length
  const occ = beds.filter(function (b) { return b.status === '占用' }).length
  const pct = totalBeds ? Math.round((occ / totalBeds) * 100) : 0
  if (pct > REMINDER_RULES.BED_OCCUPANCY) {
    out.push({ id: 'bedOccupancy:all', rule: 'bedOccupancy', level: 'high', title: '床位占用率过高', detail: '当前占用率 ' + pct + '%，超过阈值 ' + REMINDER_RULES.BED_OCCUPANCY + '%', refType: 'bed', refId: '', link: '/basic/beds' })
  }
  const pendingReport = all('visits').filter(function (v) { return (v.exams || []).length > 0 && v.reportStatus !== '已出报告' })
  if (pendingReport.length) out.push({ id: 'pendingReport:all', rule: 'pendingReport', level: 'medium', title: '检查报告待处理', detail: '共 ' + pendingReport.length + ' 条接诊存在待出报告', refType: 'visit', refId: '', link: '/outpatient/reports', count: pendingReport.length })
  const pendingDispense = all('visits').filter(function (v) { return v.chargeStatus === '已收费' && v.dispenseStatus === '未发药' && (v.prescriptions || []).length > 0 })
  if (pendingDispense.length) out.push({ id: 'pendingDispense:all', rule: 'pendingDispense', level: 'medium', title: '处方待发药', detail: '共 ' + pendingDispense.length + ' 张处方已收费未发药', refType: 'visit', refId: '', link: '/outpatient/dispenses', count: pendingDispense.length })
  const pendingOrders = all('orders').filter(function (o) { return o.status === '未执行' })
  if (pendingOrders.length) out.push({ id: 'pendingOrder:all', rule: 'pendingOrder', level: 'medium', title: '住院医嘱待执行', detail: '共 ' + pendingOrders.length + ' 条医嘱未执行', refType: 'order', refId: '', link: '/inpatient/orders', count: pendingOrders.length })
  all('stocks').forEach(function (st) {
    const d = daysBetween(st.expiry, today)
    if (d >= 0 && d <= REMINDER_RULES.STOCK_EXPIRY_DAYS) {
      out.push({ id: 'expiring:' + st.id, rule: 'stockExpiring', level: 'medium', title: '药品批次临近有效期', detail: '批号 ' + st.batchNo + ' 距有效期 ' + d + ' 天', refType: 'stock', refId: st.id, link: '/basic/stocks' })
    }
  })
  const unpaid = all('registrations').filter(function (r) { return r.regStatus === '待分诊' && r.payStatus === '未缴费' })
  if (unpaid.length) out.push({ id: 'unpaidReg:all', rule: 'unpaidRegistration', level: 'low', title: '挂号未缴费', detail: '共 ' + unpaid.length + ' 条待分诊挂号未缴费', refType: 'registration', refId: '', link: '/outpatient/registrations', count: unpaid.length })
  return out
}

function reminderSummary() {
  requireState()
  const items = computeReminders()
  const ackMap = {}
  all('reminderAcks').forEach(function (a) { ackMap[a.id] = a })
  const merged = items.map(function (it) {
    return Object.assign({}, it, {
      acknowledged: !!ackMap[it.id],
      snoozeUntil: ackMap[it.id] ? ackMap[it.id].snoozeUntil || '' : '',
      ackAt: ackMap[it.id] ? ackMap[it.id].acknowledgedAt || '' : ''
    })
  })
  const byLevel = { high: 0, medium: 0, low: 0 }
  merged.forEach(function (m) { if (byLevel[m.level] !== undefined) byLevel[m.level] += 1 })
  return { items: merged, total: merged.length, byLevel: byLevel, rules: REMINDER_RULES, generatedAt: now() }
}

function acknowledgeReminder(id) {
  requireState()
  if (!Array.isArray(state.reminderAcks)) state.reminderAcks = []
  const exist = state.reminderAcks.find(function (a) { return a.id === id })
  if (exist) {
    exist.acknowledgedAt = now()
    exist.ackBy = currentActor ? currentActor.id : ''
  } else {
    state.reminderAcks.push({ id: id, acknowledgedAt: now(), ackBy: currentActor ? currentActor.id : '', snoozeUntil: '' })
  }
  persist()
  return ok({ id: id, acknowledged: true })
}

function snoozeReminder(id, until) {
  requireState()
  if (!Array.isArray(state.reminderAcks)) state.reminderAcks = []
  const exist = state.reminderAcks.find(function (a) { return a.id === id })
  if (exist) { exist.snoozeUntil = until || '' } else { state.reminderAcks.push({ id: id, acknowledgedAt: now(), ackBy: currentActor ? currentActor.id : '', snoozeUntil: until || '' }) }
  persist()
  return ok({ id: id, snoozeUntil: until || '' })
}

// 审计事件查询（供 B2 回放/时间线复用）
function queryAudit(opts) {
  return query('auditEvents', opts)
}

// =====================================================================
// B3：AI 审计事件（aiEvents，append-only 只读审计集合）
// - 由 AI 编排层 aiAudit 通过 recordAiEvent() 写入；业务层只读展示
// - 仅记录摘要，不记录完整敏感原文/密码/token
// - AI 层唯一允许写入的集合；业务数据写函数对 AI 层不可用（G1）
// =====================================================================
function recordAiEvent(ev) {
  requireState()
  const e = ev || {}
  if (!Array.isArray(state.aiEvents)) state.aiEvents = []
  if (!state.counters) state.counters = {}
  const row = {
    id: 'ai' + nextSeq('aiEvents'),
    time: now(),
    actorStaffId: e.actorStaffId || '',
    actorName: e.actorName || '系统',
    actorRole: e.actorRole || '',
    task: e.task || '',
    provider: e.provider || '',
    inputSummary: String(e.inputSummary || '').slice(0, 300),
    outputSummary: String(e.outputSummary || '').slice(0, 400),
    confidence: typeof e.confidence === 'number' ? e.confidence : 0,
    latencyMs: Number(e.latencyMs) || 0,
    accepted: !!e.accepted,
    acceptedAt: '',
    error: String(e.error || '').slice(0, 300)
  }
  state.aiEvents.unshift(row)
  if (state.aiEvents.length > 1000) state.aiEvents = state.aiEvents.slice(0, 1000)
  persist()
  return ok(row)
}

function queryAiEvents(opts) {
  const o = opts || {}
  const filters = {}
  if (o.task) filters.task = o.task
  if (o.provider) filters.provider = o.provider
  if (o.actorStaffId) filters.actorStaffId = o.actorStaffId
  if (o.accepted !== undefined && o.accepted !== '' && o.accepted !== null) filters.accepted = !!o.accepted
  if (o.keyword) {
    const kw = String(o.keyword).toLowerCase()
    filters.keyword = {
      fn: function (row) {
        return (String(row.inputSummary || '') + ' ' + String(row.outputSummary || '') + ' ' + String(row.task || '')).toLowerCase().indexOf(kw) !== -1
      }
    }
  }
  return query('aiEvents', { filters: filters, page: o.page, size: o.size })
}

function markAiEventAccepted(id) {
  requireState()
  const row = find('aiEvents', id)
  if (!row) return fail('AI 事件不存在')
  row.accepted = true
  row.acceptedAt = now()
  persist()
  return ok(row)
}

function aiEventStats() {
  requireState()
  const list = all('aiEvents')
  const byTask = {}
  const byProvider = {}
  let accepted = 0
  let errors = 0
  list.forEach(function (e) {
    byTask[e.task] = (byTask[e.task] || 0) + 1
    byProvider[e.provider] = (byProvider[e.provider] || 0) + 1
    if (e.accepted) accepted += 1
    if (e.error) errors += 1
  })
  return {
    total: list.length,
    accepted: accepted,
    acceptanceRate: list.length ? Math.round((accepted / list.length) * 100) : 0,
    errors: errors,
    byTask: byTask,
    byProvider: byProvider,
    lastAt: list.length ? list[0].time : ''
  }
}

// =====================================================================
// B2：权限域判断（演示级 RBAC，前端菜单/路由 + Mock API 共用）
// =====================================================================
function actorMenuCodes(actor) {
  if (!actor) return []
  if (actor.id) {
    const staff = find('staff', actor.id)
    if (staff) return permissionsOf(staff).menuCodes || []
  }
  if (actor.role) {
    const role = all('roles').find(function (r) { return r.name === actor.role || r.code === actor.role })
    if (role) return role.menuCodes || []
  }
  return []
}

function canDomain(actor, domain) {
  const codes = actorMenuCodes(actor)
  if (!codes.length) return false
  if (codes.indexOf('*') !== -1) return true
  if (codes.indexOf(domain) !== -1) return true
  return codes.some(function (c) { return c.indexOf(domain + '-') === 0 })
}

function canMenu(actor, code) {
  const codes = actorMenuCodes(actor)
  if (!codes.length) return false
  if (codes.indexOf('*') !== -1) return true
  if (codes.indexOf(code) !== -1) return true
  const group = String(code).split('-')[0]
  return codes.indexOf(group) !== -1
}

// =====================================================================
// B2：分角色工作台聚合（只读，基于真实业务数据）
// =====================================================================
function workbenchSummary(actor) {
  requireState()
  const a = actor || currentActor
  const staff = a && a.id ? find('staff', a.id) : null
  const perm = staff ? permissionsOf(staff) : { roleCode: '', menuCodes: [] }
  const isAdmin = perm.roleCode === 'SUPER_ADMIN' || (perm.menuCodes || []).indexOf('*') !== -1
  const canOut = isAdmin || canDomain(a, 'outpatient')
  const canIn = isAdmin || canDomain(a, 'inpatient')
  const canBasic = isAdmin || canDomain(a, 'basic')
  const s = stats()
  const pmap = byIdMap('patients')
  const wmap = byIdMap('wards')
  const bmap = byIdMap('beds')
  const dmap = byIdMap('departments')
  const smap = byIdMap('staff')
  const LIMIT = 30
  function pname(id) { return (pmap[id] || {}).name || '—' }
  function dname(id) { return (dmap[id] || {}).name || '—' }
  function regBrief(r) { return { id: r.id, code: r.code, patientId: r.patientId, patientName: pname(r.patientId), date: r.date, period: r.period, regStatus: r.regStatus, departmentName: dname(r.departmentId), doctorName: (smap[r.doctorId] || {}).name || '—' } }
  function visitBrief(v) { return { id: v.id, code: v.code, patientId: v.patientId, patientName: pname(v.patientId), date: v.date, visitStatus: v.visitStatus, reportStatus: v.reportStatus, chargeStatus: v.chargeStatus, dispenseStatus: v.dispenseStatus, departmentName: dname(v.departmentId) } }
  function admBrief(x) { return { id: x.id, code: x.code, patientId: x.patientId, patientName: pname(x.patientId), status: x.status, wardName: (wmap[x.wardId] || {}).name || '—', bedCode: (bmap[x.bedId] || {}).code || '—', departmentName: dname(x.departmentId) } }
  function orderBrief(o) { const adm = find('admissions', o.admissionId) || {}; return { id: o.id, name: o.name, qty: o.qty, status: o.status, admissionId: o.admissionId, admissionCode: adm.code || '—', patientId: adm.patientId || '', patientName: pname(adm.patientId) } }
  function medBrief(m) { return { id: m.id, code: m.code, name: m.name, stock: m.stock, unit: m.unit } }
  function take(arr) { return arr.slice(0, LIMIT) }

  const myRegs = staff ? all('registrations').filter(function (r) { return r.doctorId === staff.id && r.regStatus === '待分诊' }) : []
  const myReports = staff ? all('visits').filter(function (v) { return v.doctorId === staff.id && (v.exams || []).length > 0 && v.reportStatus !== '已出报告' }) : []
  const pendingCharge = all('visits').filter(function (v) { return v.chargeStatus === '未收费' && ((v.prescriptions || []).length + (v.exams || []).length) > 0 })
  const pendingDispense = all('visits').filter(function (v) { return v.chargeStatus === '已收费' && v.dispenseStatus === '未发药' && (v.prescriptions || []).length > 0 })
  const pendingSettle = all('admissions').filter(function (x) { return x.status === '待结算' })
  const pendingOrders = all('orders').filter(function (o) { return o.status === '未执行' })
  const pendingAdm = all('admissions').filter(function (x) { return x.status === '待入科' })
  const lowStock = all('medicines').filter(function (m) { return m.status === 1 && Number(m.stock) < REMINDER_RULES.LOW_STOCK })

  return {
    roleCode: perm.roleCode,
    roleName: staff ? staff.role : '',
    staffName: staff ? staff.name : '',
    staffId: staff ? staff.id : '',
    menuCodes: perm.menuCodes,
    capabilities: { admin: isAdmin, outpatient: canOut, inpatient: canIn, basic: canBasic, cashier: (perm.menuCodes || []).indexOf('outpatient-charge') !== -1 },
    stats: s,
    today: state.demoToday,
    queues: {
      myPendingRegs: take(myRegs).map(regBrief),
      myPendingReports: take(myReports).map(visitBrief),
      pendingCharge: take(pendingCharge).map(visitBrief),
      pendingDispense: take(pendingDispense).map(visitBrief),
      pendingSettle: take(pendingSettle).map(admBrief),
      pendingOrders: take(pendingOrders).map(orderBrief),
      pendingAdm: take(pendingAdm).map(admBrief),
      lowStock: take(lowStock).map(medBrief)
    },
    counts: {
      myPendingRegs: myRegs.length,
      myPendingReports: myReports.length,
      pendingCharge: pendingCharge.length,
      pendingDispense: pendingDispense.length,
      pendingSettle: pendingSettle.length,
      pendingOrders: pendingOrders.length,
      pendingAdm: pendingAdm.length,
      lowStock: lowStock.length
    },
    generatedAt: now()
  }
}

// =====================================================================
// B2：患者 360° 全流程时间线（只读聚合，不修改业务数据）
// =====================================================================
function timelineProgress(events) {
  const total = events.length
  const done = events.filter(function (e) { return e.statusKind === 'done' }).length
  const pending = events.filter(function (e) { return e.statusKind === 'pending' || e.statusKind === 'progress' }).length
  let stage = '全部完成'
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i]
    if (e.statusKind === 'pending' || e.statusKind === 'progress') {
      stage = e.category + '·' + (e.status || '进行中')
      break
    }
  }
  return { stage: stage, total: total, done: done, pending: pending }
}

function patientTimeline(patientId) {
  requireState()
  const patient = find('patients', patientId)
  if (!patient) return fail('患者不存在')
  const dmap = byIdMap('departments')
  const smap = byIdMap('staff')
  const wmap = byIdMap('wards')
  const bmap = byIdMap('beds')
  const events = []
  function dname(id) { return (dmap[id] || {}).name || '' }
  function sname(id) { return (smap[id] || {}).name || '' }
  function push(ev) { events.push(ev) }

  all('registrations').filter(function (r) { return r.patientId === patientId }).forEach(function (r) {
    push({ id: 'reg:' + r.id, category: '挂号', time: r.createdAt || '', title: '门诊挂号', summary: dname(r.departmentId) + ' ' + sname(r.doctorId) + ' ' + (r.period || ''), status: r.regStatus, statusKind: r.regStatus === '已完成' ? 'done' : (r.regStatus === '已退号' ? 'cancelled' : 'pending'), departmentName: dname(r.departmentId), role: '挂号', refType: 'registration', refId: r.id, link: '/outpatient/registrations' })
  })

  all('visits').filter(function (v) { return v.patientId === patientId }).forEach(function (v) {
    push({ id: 'visit:' + v.id, category: '接诊', time: v.createdAt || '', title: '门诊接诊', summary: v.diagnosis || v.complaint || '', status: v.visitStatus, statusKind: v.visitStatus === '已完成' ? 'done' : 'progress', departmentName: dname(v.departmentId), role: '医生', refType: 'visit', refId: v.id, link: '/outpatient/visits' })
    if ((v.prescriptions || []).length) {
      push({ id: 'rx:' + v.id, category: '处方', time: v.createdAt || '', title: '处方开具', summary: (v.prescriptions || []).map(function (x) { return x.medicineName + '×' + x.qty }).join('、'), status: v.dispenseStatus, statusKind: v.dispenseStatus === '已发药' ? 'done' : 'pending', departmentName: dname(v.departmentId), role: '医生', refType: 'visit', refId: v.id, link: '/outpatient/prescriptions' })
    }
    if ((v.exams || []).length) {
      push({ id: 'exam:' + v.id, category: '检查', time: v.createdAt || '', title: '医技申请', summary: (v.exams || []).map(function (x) { return x.examItemName + '×' + x.qty }).join('、'), status: v.reportStatus, statusKind: v.reportStatus === '已出报告' ? 'done' : 'pending', departmentName: dname(v.departmentId), role: '医生', refType: 'visit', refId: v.id, link: '/outpatient/exam-applies' })
    }
    if (v.chargeStatus === '已收费') {
      const fr = all('feeRecords').find(function (f) { return f.refId === v.id && f.type === '门诊收费' })
      push({ id: 'charge:' + v.id, category: '收费', time: fr ? fr.paidAt : '', title: '门诊收费', summary: '收费金额 ' + (fr ? (fr.amountCents / 100).toFixed(2) : '0.00') + ' 元', status: '已收费', statusKind: 'done', departmentName: '', role: '收费员', refType: 'visit', refId: v.id, link: '/outpatient/charges' })
    }
    (v.reports || []).forEach(function (rep, i) {
      push({ id: 'report:' + v.id + ':' + i, category: '检查报告', time: rep.at || '', title: '检查报告：' + rep.examItemName, summary: rep.content || '', status: '已出报告', statusKind: 'done', departmentName: '', role: '医技', refType: 'visit', refId: v.id, link: '/outpatient/reports' })
    })
  })

  all('admissions').filter(function (a) { return a.patientId === patientId }).forEach(function (a) {
    const wardName = (wmap[a.wardId] || {}).name || ''
    const bedCode = (bmap[a.bedId] || {}).code || ''
    push({ id: 'adm:' + a.id, category: '入院', time: a.admitAt || '', title: '入院登记', summary: dname(a.departmentId) + ' ' + wardName + ' ' + bedCode, status: a.status, statusKind: a.status === '已出院' ? 'done' : (a.status === '已取消' ? 'cancelled' : 'progress'), departmentName: dname(a.departmentId), role: '住院', refType: 'admission', refId: a.id, link: '/inpatient/admissions' })
    if (a.confirmAt) {
      push({ id: 'adm-confirm:' + a.id, category: '入院', time: a.confirmAt, title: '入科确认', summary: '患者入科', status: '在院', statusKind: 'progress', departmentName: dname(a.departmentId), role: '护士', refType: 'admission', refId: a.id, link: '/inpatient/admissions' })
    }
    all('orders').filter(function (o) { return o.admissionId === a.id }).forEach(function (o) {
      push({ id: 'order:' + o.id, category: '医嘱', time: o.createdAt || '', title: '住院医嘱', summary: o.name + '×' + o.qty, status: o.status, statusKind: o.status === '已执行' ? 'done' : 'pending', departmentName: '', role: '医生', refType: 'order', refId: o.id, link: '/inpatient/orders' })
    })
    all('settlements').filter(function (st) { return st.admissionId === a.id }).forEach(function (st) {
      push({ id: 'settle:' + st.id, category: '出院结算', time: st.settledAt || '', title: '出院结算', summary: '总额 ' + (st.totalCents / 100).toFixed(2) + ' 元，差额 ' + (st.balanceCents / 100).toFixed(2) + ' 元', status: st.status, statusKind: 'done', departmentName: '', role: '收费员', refType: 'settlement', refId: st.id, link: '/inpatient/settlements' })
    })
    all('auditEvents').filter(function (e) { return e.entityType === 'admissions' && e.entityId === a.id && ['转科转床', '取消登记', '申请出院'].indexOf(e.action) !== -1 }).forEach(function (e) {
      push({ id: 'audit:' + e.id, category: '住院', time: e.time || '', title: e.action, summary: e.summary || '', status: '已记录', statusKind: 'info', departmentName: '', role: e.actorRole || '', refType: 'admission', refId: a.id, link: '/inpatient/admissions' })
    })
  })

  events.sort(function (x, y) {
    if (!x.time) return 1
    if (!y.time) return -1
    return x.time < y.time ? -1 : x.time > y.time ? 1 : 0
  })
  return ok({ patient: { id: patient.id, code: patient.code, name: patient.name, gender: patient.gender, phone: patient.phone, allergy: patient.allergy }, events: events, progress: timelineProgress(events), generatedAt: now() })
}

// =====================================================================
module.exports = {
  STORAGE_KEY,
  CURRENT_VERSION,
  demoToday: () => (requireState(), state.demoToday),
  load,
  persist,
  resetAll,
  all,
  find,
  query,
  stats,
  byIdMap,

  login,

  createStaff,
  updateStaff,
  setStaffEnabled,
  resetStaffPassword,
  deleteStaff,

  createDepartment,
  updateDepartment,
  deleteDepartment,

  createWard,
  updateWard,
  deleteWard,

  createBed,
  updateBed,
  deleteBed,

  createPatient,
  updatePatient,
  deletePatient,

  createSchedule,
  updateSchedule,
  deleteSchedule,

  createRegistration,
  refundRegistration,

  createVisit,
  updateVisit,

  createMedicine,
  updateMedicine,
  deleteMedicine,
  createExamItem,
  updateExamItem,
  deleteExamItem,
  createFeeItem,
  updateFeeItem,
  deleteFeeItem,
  createStock,
  updateStock,
  deleteStock,

  createAdmission,
  updateAdmissionDeposit,
  confirmAdmission,
  transferAdmission,
  cancelAdmission,
  requestDischarge,
  settleDischarge,

  createOrder,
  executeOrder,
  cancelOrder,

  chargeVisit,
  dispenseVisit,
  createReport,
  visitTotalCents,

  addLog,
  clearLogs,
  saveRoleMenu,
  createRole,
  deleteRole,

  // === B1 新增：身份/角色、审计、待办、提醒 ===
  profileOf,
  permissionsOf,
  setCurrentActor,
  getCurrentActor,
  setActorByToken,
  recordAudit,
  queryAudit,
  createTodo,
  updateTodo,
  setTodoStatus,
  deleteTodo,
  suggestTodoPriority,
  computeReminders,
  reminderSummary,
  acknowledgeReminder,
  snoozeReminder,
  REMINDER_RULES,

  // === B2 新增：权限域、工作台聚合、患者时间线 ===
  canDomain,
  canMenu,
  workbenchSummary,
  patientTimeline,

  // === B3 新增：AI 审计事件（只读集合，AI 层唯一写入口） ===
  recordAiEvent,
  queryAiEvents,
  markAiEventAccepted,
  aiEventStats
}

// =====================================================================
// B1：为所有写操作自动记录结构化审计（真实操作人 + 实体 + 前后摘要）
// 说明：不改变业务函数签名与校验逻辑，仅在成功后追加一条 auditEvent。
// =====================================================================
function collectBefore(entity, id) {
  if (!entity || typeof id !== 'string') return null
  const row = find(entity, id)
  return row ? summarizeEntity(row) : null
}

const AUDIT_WRAP = [
  ['createStaff', '新增员工', 'staff', false], ['updateStaff', '修改员工', 'staff', true], ['setStaffEnabled', '启停账号', 'staff', true], ['resetStaffPassword', '重置密码', 'staff', true], ['deleteStaff', '删除员工', 'staff', true],
  ['createDepartment', '新增科室', 'departments', false], ['updateDepartment', '修改科室', 'departments', true], ['deleteDepartment', '删除科室', 'departments', true],
  ['createWard', '新增病区', 'wards', false], ['updateWard', '修改病区', 'wards', true], ['deleteWard', '删除病区', 'wards', true],
  ['createBed', '新增床位', 'beds', false], ['updateBed', '修改床位', 'beds', true], ['deleteBed', '删除床位', 'beds', true],
  ['createPatient', '新增患者', 'patients', false], ['updatePatient', '修改患者', 'patients', true], ['deletePatient', '删除患者', 'patients', true],
  ['createSchedule', '新增排班', 'schedules', false], ['updateSchedule', '修改排班', 'schedules', true], ['deleteSchedule', '删除排班', 'schedules', true],
  ['createRegistration', '挂号', 'registrations', false], ['refundRegistration', '退号', 'registrations', true],
  ['createVisit', '接诊', 'visits', false], ['updateVisit', '修改接诊', 'visits', true],
  ['createMedicine', '新增药品', 'medicines', false], ['updateMedicine', '修改药品', 'medicines', true], ['deleteMedicine', '删除药品', 'medicines', true],
  ['createExamItem', '新增医技项目', 'examItems', false], ['updateExamItem', '修改医技项目', 'examItems', true], ['deleteExamItem', '删除医技项目', 'examItems', true],
  ['createFeeItem', '新增收费项目', 'feeItems', false], ['updateFeeItem', '修改收费项目', 'feeItems', true], ['deleteFeeItem', '删除收费项目', 'feeItems', true],
  ['createStock', '新增批次库存', 'stocks', false], ['updateStock', '修改批次库存', 'stocks', true], ['deleteStock', '删除批次库存', 'stocks', true],
  ['createAdmission', '入院登记', 'admissions', false], ['updateAdmissionDeposit', '修改预交金', 'admissions', true],
  ['confirmAdmission', '入科确认', 'admissions', true], ['transferAdmission', '转科转床', 'admissions', true],
  ['cancelAdmission', '取消登记', 'admissions', true], ['requestDischarge', '申请出院', 'admissions', true], ['settleDischarge', '出院结算', 'admissions', true],
  ['createOrder', '开立医嘱', 'orders', false], ['executeOrder', '执行医嘱', 'orders', true], ['cancelOrder', '作废医嘱', 'orders', true],
  ['chargeVisit', '门诊收费', 'visits', true], ['dispenseVisit', '处方发药', 'visits', true], ['createReport', '出具报告', 'visits', true],
  ['saveRoleMenu', '修改角色权限', 'roles', true], ['createRole', '新增角色', 'roles', false], ['deleteRole', '删除角色', 'roles', true],
  ['resetAll', '重置演示数据', 'system', false],
  ['login', '登录系统', 'staff', false]
]

AUDIT_WRAP.forEach(function (cfg) {
  const name = cfg[0], action = cfg[1], entity = cfg[2], byId = cfg[3]
  const orig = module.exports[name]
  if (typeof orig !== 'function') return
  module.exports[name] = function () {
    const args = Array.prototype.slice.call(arguments)
    const before = byId ? collectBefore(entity, args[0]) : null
    const res = orig.apply(null, args)
    try {
      if (res && res.ok) {
        const data = res.data
        const id = (data && (data.id || (data.staff && data.staff.id))) || (typeof args[0] === 'string' ? args[0] : '')
        recordAudit(currentActor, action, {
          entityType: entity,
          entityId: id,
          entityCode: (data && data.code) || '',
          summary: action + (data && data.code ? ' ' + data.code : id ? ' ' + id : ''),
          before: before,
          after: summarizeEntity(data)
        })
        persist()
      }
    } catch (e) {
      /* 审计失败不影响业务结果 */
    }
    return res
  }
})
