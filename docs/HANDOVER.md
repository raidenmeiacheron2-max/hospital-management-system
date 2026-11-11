# 医院业务管理系统 · 项目交接文档（面向后续 AI 代理 / 开发者）

> 文档用途：让接手方（人或 AI 代理）在不了解历史对话的前提下，快速理解项目边界、架构、数据模型、业务规则、验证方式与已知坑，并能安全地继续开发。
> 文档生成时间：2026-10-27。生成依据：仓库实际代码 + 本项目历史对话中的决策与验证记录。

---

## 0. 文档元信息

| 项 | 值 |
| --- | --- |
| 仓库地址 | https://github.com/raidenmeiacheron2-max/hospital-management-system |
| 可见性 | Public |
| 默认分支 | `main` |
| 基线提交 | `85251fe`（B1/B2/B3–B5 改动当前在工作区，**未提交/未推送**） |
| 包名 / 版本 | `astra-hospital-ui` / `1.0.0`（`private: true`，不发布 npm 包） |
| 运行环境验证 | Node v24.21.0 + npm 11.19.0（要求 Node ≥ 18） |
| 核心定位 | **纯前端 SPA 演示系统**：无后端、无数据库、无真实 API，全部数据为虚构演示数据 |
| 完成批次 | B1/B2（2026-11-07）、B3/B4/B5（2026-11-10）；数据版本 `CURRENT_VERSION=5` |
| 测试基线 | `test:data` 72/72 · `test:ai` 49/49 · `build` 通过 · `e2e` 48/48（含 W1/W2/W3 修复回归） |

---

## 1. 项目定位与硬性边界（不要违反）

1. **技术栈锁定（除非用户明确要求更换）**：Vue **2.7.x** + Vue CLI **5** + Element UI **2.15.x** + Vue Router **3** + Vuex **3** + Axios **1.x** + ECharts **5.x** + Mock.js **1.1.0** + SCSS。
   - 禁止：Vue 3 / Vite / Element Plus / Vue Router 4 / Vuex 4 / Pinia / TypeScript。
   - 版本以 `package.json` + `package-lock.json` 为准，升级依赖需同步验证并更新 lock 文件。
2. **纯前端、Mock 优先**：所有业务数据来自 `src/mock/` 的种子与内存数据层，持久化到浏览器 `localStorage`（键 `astra_hospital_db_v1`，带版本标记）。
   - 不得接入真实医院数据；演示账号密码（`123456`）只存在于虚构种子数据中。
3. **金额一律用整数「分」**：数据层（`src/mock/db.js`、`src/mock/seed.js`）所有金额字段以整数分存储与计算，界面用 `src/utils/money.js` 格式化为元。**禁止浮点累加金额**。
4. **视觉基准是九张参考截图**（参考图未随仓库发布，见第 13 节）；设计令牌见 `src/styles/variables.scss`。
5. **权限/菜单只是界面演示**，不得宣称具备真实安全控制能力。

---

## 2. 快速上手

```bash
git clone https://github.com/raidenmeiacheron2-max/hospital-management-system.git
cd hospital-management-system
npm ci                     # 或 npm install
npm run serve              # http://localhost:8080（hash 路由）
npm run build              # 产物 dist/
npm run test:data          # 数据层测试（纯 Node，40 项断言）
npm run test:unit          # Jest（同一套件，--runInBand）
npm run e2e                # 端到端验证（需先启动 serve，见 11.3）
```

**演示账号**（全部密码 `123456`）：`admin`（超级管理员）、`13900000001`~`13900000008`（门诊医生）、`13800001000`（挂号收费员）、`13800001002`（住院医生）。

---

## 3. 运行环境与已知环境坑（重要）

| 现象 | 原因 | 处理方式 |
| --- | --- | --- |
| `npm install` 报 `EPERM ... npm-cache` | 受限环境无法写全局缓存 | `npm install --cache .npm-cache` |
| 安装阶段 `spawn EPERM` | 受限环境的安装生命周期脚本无法 spawn 子进程 | 加 `--ignore-scripts`（本项目无必需安装脚本；`sass` 是纯 JS 包） |
| `vue-cli-service serve/build` 报 `spawn EPERM`（thread-loader） | 受限环境禁止带管道的子进程 | `vue.config.js` 已设 `parallel: false`；**不要改回 true** |
| 构建日志 18 条 `export 'default' (imported as 'style0') was not found` | css-loader 与 vue-loader 15 的 ESM 警告 | 无害，样式正常生效；**不要为此改构建配置** |
| Jest 通过但 PowerShell 包装显示 `exit code: 1` | PS 把 native stderr 当错误 | 以 `Test Suites: ... passed` 为准 |
| `git push` 报 `schannel: AcquireCredentialsHandle ... SEC_E_NO_CREDENTIALS` | 受限环境 schannel 不可用 | 所有网络 git 命令加 `-c http.sslBackend=openssl` |
| `git credential` 报 `couldn't create signal pipe` / `Win32 error 5` | 受限环境禁止凭据助手 spawn | 推送需一次性完整权限运行；凭据用 `-c credential.helper=wincred`（读取 Windows 凭据库） |
| PowerShell 读中文文件乱码 | PS 5.1 `Get-Content` 默认 ANSI | 用 `-Encoding UTF8`，或直接用编辑器/read 工具 |
| PowerShell 语法报错 `??` | 环境是 **PowerShell 5.1**，不是 PS7 | 不使用 `??`、`&&` 等 PS7 语法 |
| `file://` 打开 `dist/index.html` 白屏 | 产物是 ES module 分块，file:// 被 CORS 拦截 | 用静态服务器：`npx serve dist` 或 `python -m http.server` |

---

## 4. 架构总览

```
┌─────────────── 视图层 views/*.vue（Element UI 组件 + 页面逻辑）
│   ├─ components/  StatusTag、Pagination 等通用组件
│   ├─ mixins/listPage.js  列表页通用逻辑（搜索/分页/末页删除回退）
│   └─ layout/  Sidebar / Navbar / TagsView / AppMain
│
├─────────────── api/index.js（Axios 封装的方法集合）
│       └─ utils/request.js（baseURL=/api、15s 超时、响应信封解包、401 跳登录）
│
├─────────────── mock/index.js（Mock.js 拦截 XHR，mock 路由表 + 关联字段 enrich + 80~260ms 延迟）
│       └─ mock/db.js（纯函数数据层：规则校验 → 变更 → 持久化；无框架依赖，可 Node 直测）
│               └─ mock/seed.js（虚构种子数据 + counters）
│
└─────────────── utils/storage.js → localStorage('astra_hospital_db_v1')
```

路由用 **hash 模式**（刷新不白屏，纯静态部署友好）；构建 `publicPath: './'`。

---

## 5. 目录与文件职责

```
src/
├─ ai/                     AI 服务层（B3–B5，CommonJS，可被 Node 直测）
│  ├─ index.js             runTask 编排：开关→任务→只读上下文→Provider→schema→免责→审计
│  ├─ config.js            AI 开关/Provider 配置（默认本地、零网络、零密钥）
│  ├─ provider.js          Provider 注册与契约
│  ├─ localProvider.js     本地确定性引擎（默认，同步离线）
│  ├─ httpProvider.js      外部 LLM 骨架（默认禁用，无网络实现）
│  ├─ selectors.js         只读数据选择器（深拷贝/脱敏/聚合口径）
│  ├─ contextBuilder.js    只读上下文构建（脱敏 + 按角色权限域收敛）
│  ├─ guardrails.js        G1–G7 护栏（no-write/schema/免责/脱敏/零网络静态规则）
│  ├─ aiAudit.js           AI 审计写入 aiEvents
│  ├─ taskRegistry.js      任务注册表（强制 readOnly + outputSchema）
│  └─ tasks/               selftest / todoPriority / reminderExplain / assistant / anomaly / report / recordStruct / forecast
├─ api/index.js            所有 HTTP 方法（含 B1–B5：待办/提醒/审计/工作台/时间线/AI）
├─ components/
│  ├─ StatusTag.vue        状态标签（label → 色系映射 STATUS_COLOR）
│  ├─ Pagination.vue       Element 分页封装（total/page/size，change 事件）
│  ├─ AiDisclaimer.vue     AI 免责声明块（B4/B5 复用）
│  └─ AiMetaBar.vue        AI 元信息（provider/置信度/耗时/只读/审计 id）
├─ config/menu.js          侧栏菜单树（含 AI 智能中心分组）
├─ layout/
│  ├─ index.vue            后台框架（侧栏 + 顶栏 + 面包屑 + 标签页 + 主区 + 刷新 key）
│  └─ components/TagsView.vue  可关闭标签页（关闭/关闭其他/关闭全部/刷新）
├─ mixins/listPage.js      列表页通用：loading/list/total/query、搜索重置、分页、末页删除回退
├─ mock/
│  ├─ index.js             Mock.js 路由注册、信封、enrich、apiGuard 权限校验、AI 路由
│  ├─ db.js                数据层核心（规则、状态机、迁移、审计、统计、AI 审计）—— 见第 6 节
│  └─ seed.js              种子数据（version=5，虚构）+ 计数器 counters
├─ router/index.js         hash 路由 + 登录守卫 + RBAC 守卫 + 标签页注册 + 404
├─ store/
│  ├─ modules/user.js      token/staff；login/logout/restore action
│  ├─ modules/app.js       sidebarCollapsed、refreshKey（INCREMENT_REFRESH）
│  └─ modules/tabs.js      visitedViews（ADD/DEL/DEL_OTHERS/DEL_ALL）
├─ styles/
│  ├─ variables.scss       设计令牌（颜色/圆角/阴影/字体）
│  └─ index.scss           全局样式 + Element UI 主题覆盖
├─ utils/
│  ├─ request.js           Axios 实例与拦截器
│  ├─ money.js             分↔元、金额校验、整数求和
│  ├─ storage.js           localStorage 安全读写（带内存兜底）
│  ├─ auth.js              token 与「记住账号」（不保存真实密码）
│  ├─ validate.js          手机号/正整数/账号正则
│  ├─ csv.js               CSV 导出（BOM，Excel 友好）
│  ├─ date.js              日期格式化/加减/星期
│  └─ perm.js              B2 演示级 RBAC 辅助（hasMenu/hasDomain/filterMenuTree）
└─ views/
   ├─ login/index.vue
   ├─ dashboard/index.vue  原首页（嵌入管理员工作台「运营概览」）
   ├─ workbench/           index.vue（/dashboard 分角色工作台）/ TodoCenter / ReminderCenter
   ├─ ai/                  Assistant / Reports / Anomaly / Forecast（B4/B5）
   ├─ basic/               DepartmentList / StaffList / WardList / BedList / FeeItemList / MedicineList / ExamItemList / StockList
   ├─ patients/            PatientList / Timeline（患者 360°）
   ├─ outpatient/          ScheduleList / RegistrationList / VisitList(+components/VisitDialog，含 AI 病历结构化) /
   │                       PrescriptionQuery / ExamApplyList / ChargeList / DispenseList / ReportList
   ├─ inpatient/           AdmissionList / OrderList / SettlementList
   ├─ system/              RoleList / MenuPerm / OpLogList / AuditCenter / DataReset / AiCenter
   └─ error/               403.vue / 404.vue
tests/
├─ data/suite.js           数据层测试套件（72 项，纯 Node，可直接跑）
├─ data/run.js             入口：node tests/data/run.js
├─ ai/run.js               AI 任务测试入口（npm run test:ai，用例在 ai/cases/）
├─ ai/run-one.js           单用例文件运行器
├─ unit/data.test.js       Jest 包装同一套件
└─ e2e/run.js              puppeteer-core E2E（14 节，含 AI 页面、30 页冒烟、W1/W2/W3 回归、截图）
tools/                     开发辅助脚本（含 check-vue.js：.vue 模板 + 脚本语法检查）
docs/                      对照清单（checklist.md）、视觉验收（visual-check.md）、本文档、
                           智能化升级规划（INNOVATION_PLAN.md / IMPLEMENTATION_STATUS.md /
                           AI_ARCHITECTURE.md / DECISIONS.md，见第 18 节）
```

---

## 6. 数据层（`src/mock/db.js`）—— 系统的核心

### 6.1 持久化与安全

- 存储键：`astra_hospital_db_v1`；`CURRENT_VERSION = 5`（v1→v2→v3→v4→v5 增量迁移，见 `DECISIONS D2/D19/D22`）。
- `load()`：版本低于当前 → 先备份 `astra_hospital_db_v1_backup_v<old>`，再按 `MIGRATIONS` **逐级增量迁移**（只增不删、补默认值）；版本更高 → **拒绝降级**并保留原数据（内存退回种子但不写回）；仅损坏/不可解析才备份后兜底播种。
- `persist()`：每次成功变更后写回，并更新 `savedAt`。
- 所有写操作（create/update/delete/业务动作）统一返回 `{ ok: true, data } | { ok: false, error: '中文提示' }`。
- **失败不落库**：每个操作先完整校验，通过后才修改状态并 `persist()`。Mock 层收到 `x-mock-fail: 1` 请求头时直接返回错误，不触碰数据层。
- `resetAll()`：重建种子数据（页面「系统管理 → 演示数据重置」）。

### 6.2 查询与分页

`db.query(name, { filters, page, size, sortBy, sortOrder })` → `{ total, list }`。

过滤值语义：

| 写法 | 含义 |
| --- | --- |
| `'张三'`（字符串） | 包含匹配（忽略大小写） |
| `{ eq: v }` / `{ ne: v }` | 相等 / 不等 |
| `{ contains: v }` | 包含 |
| `{ in: [..] }` | 枚举 |
| `{ gte: v }` / `{ lte: v }` | 范围（日期字符串可直接比较） |
| `{ fn: row => boolean }` | 自定义（用于跨表关联过滤，如按患者姓名筛挂号） |

### 6.3 实体与字段

所有集合均存于同一 state，按名称访问（`db.all('patients')`、`db.find('staff', id)`）。

| 集合 | 关键字段 |
| --- | --- |
| `departments` | id, code(D001…), name, phone, director, status(1/0), createdAt |
| `wards` | id, code(W001…), name, departmentId, floor, headNurse, status |
| `beds` | id, wardId, code(A01…), type(普通床/加床), status(空闲/占用), enabled(1/0), remark |
| `staff` | id, code(S000…), name, type, departmentId, phone, loginAccount, role, password(仅演示), enabled, lastLoginAt |
| `patients` | id, code(P+15 位数字), name, gender, phone, birthDate, allergy, status |
| `schedules` | id, doctorId, departmentId, date('YYYY-MM-DD'), period(上午/下午), limit, createdAt |
| `registrations` | id, code(REG…), patientId, departmentId, doctorId, date, period, feeCents, regStatus, payStatus, visitId |
| `visits` | id, code(VIS…), regId, patientId, doctorId, departmentId, date, visitStatus, needHospital, complaint, history, diagnosis, advice, prescriptions[], exams[], chargeStatus, dispenseStatus, reportStatus, reports[] |
| `medicines` | id, code(YP…), name, spec, unit, priceCents, stock, status |
| `examItems` | id, code(JY/JC…), name, category(检验/检查), priceCents, status |
| `feeItems` | id, code(SF…), name, category, priceCents, status |
| `stocks` | id, medicineId, batchNo, qty, expiry |
| `admissions` | id, code(ADM…), patientId, departmentId, wardId, bedId, doctorId, depositCents, status, admitAt, confirmAt, dischargeAt |
| `orders` | id, admissionId, type(药品/医技项目/收费项目), refId, name, qty, priceCents, status(未执行/已执行) |
| `settlements` | id, admissionId, totalCents, depositCents, balanceCents, status, settledAt |
| `feeRecords` | id, code(PAY…), type(挂号费/门诊收费/住院结算补缴/住院结算退费), refId, amountCents, status, paidAt |
| `logs` | id, operator, action, target, time, ip（最多保留 500 条） |
| `roles` / `menus` | 角色（含 menuCodes，`'*'` 表示全部）/ 菜单树（演示用） |
| `counters` | 各类单号与 id 自增计数，新增实体时必须同步维护 |

> 新增集合时：`seed.js` 增加种子与 counters → `db.js` 增加 load 校验字段、CRUD 与业务函数 → `mock/index.js` 注册路由与 enrich → `api/index.js` 暴露方法 → 前端页面。

### 6.4 业务规则与状态机

```
患者 --挂号(须医生当日时段有排班，号源未满)--> 待分诊
待分诊 --接诊--> 就诊中/已完成（visitId 回写；已完成时挂号同步「已完成」）
待分诊 --退号--> 已退号（已缴费则生成退费；已接诊不可退号；已退号不可接诊）

接诊(处方/医技明细，金额=数量×单价，整数分)
  --门诊收费--> chargeStatus 已收费（生成 feeRecord，重复收费被拒）
  --处方发药--> dispenseStatus 已发药（扣 medicines.stock；未收费不可发药；重复发药被拒）
  --出具报告--> reportStatus 待报告→部分出报告→已出报告

入院登记：须选空闲且启用的床位；床位→占用，状态「待入科」
  待入科 --入科确认--> 在院（记录 confirmAt）
  在院/待入科/待结算 --转科转床--> 释放原床位(空闲)、占用新床位；目标床必须空闲
  仅待入科 --取消登记--> 已取消、释放床位
  在院 --出院申请--> 待结算（床位仍占用）
  待结算 --出院结算--> 已出院、释放床位，生成 settlement（预交抵扣，差额补缴/退费）

住院医嘱：仅「在院/待结算」可开立；未执行 → 已执行（不可重复执行）；未执行可作废
```

关键约束（测试已覆盖）：同医生同日同时段排班唯一；已产生挂号的排班不可删除/改期；同一床位不可同时分给两名在院患者；同一患者不可重复在院登记；有引用关系（员工/科室/病区/床位/患者/药品/项目）的删除会被拒绝并给出原因。

### 6.5 `db.js` 导出 API 一览

| 分组 | 方法 |
| --- | --- |
| 基础 | `load` `persist` `resetAll` `all` `find` `query` `stats` `byIdMap` `STORAGE_KEY` `CURRENT_VERSION` `demoToday()` |
| 认证 | `login(account, password)` → `{token, staff}`（staff 已剔除密码） |
| 员工 | `createStaff` `updateStaff` `setStaffEnabled` `resetStaffPassword` `deleteStaff` |
| 科室/病区/床位 | `createDepartment/updateDepartment/deleteDepartment`、`createWard/updateWard/deleteWard`、`createBed/updateBed/deleteBed` |
| 患者 | `createPatient` `updatePatient` `deletePatient` |
| 排班 | `createSchedule` `updateSchedule` `deleteSchedule`（内部 `conflictSchedule`） |
| 挂号 | `createRegistration` `refundRegistration` |
| 接诊 | `createVisit` `updateVisit`（内部 `normalizeVisitItems` 归一化明细与金额） |
| 药品/医技/收费/库存 | `createMedicine/updateMedicine/deleteMedicine`、`createExamItem/…`、`createFeeItem/…`、`createStock/…` |
| 入院 | `createAdmission` `updateAdmissionDeposit` `confirmAdmission` `transferAdmission` `cancelAdmission` `requestDischarge` `settleDischarge` |
| 医嘱 | `createOrder` `executeOrder` `cancelOrder` |
| 门诊 | `chargeVisit` `dispenseVisit` `createReport` `visitTotalCents` |
| 系统 | `addLog` `clearLogs` `saveRoleMenu` `createRole` `deleteRole` |
| B1 身份/审计/待办/提醒 | `profileOf` `permissionsOf` `setCurrentActor` `getCurrentActor` `setActorByToken` `recordAudit` `queryAudit` `createTodo` `updateTodo` `setTodoStatus` `deleteTodo` `suggestTodoPriority` `computeReminders` `reminderSummary` `acknowledgeReminder` `snoozeReminder` `REMINDER_RULES` |
| B2 权限/工作台/时间线 | `canDomain` `canMenu` `workbenchSummary` `patientTimeline` |
| B3 AI 审计（AI 层唯一写入口） | `recordAiEvent` `queryAiEvents` `markAiEventAccepted` `aiEventStats` |

`stats()` 返回首页所有指标（今日门诊、在院人数分项、床位占用率、近七日门诊/收费、待办数量），**全部由当前数据实时计算**，不写死。

---

## 7. Mock / HTTP 层（`src/mock/index.js`）

- 基地址：`process.env.VUE_APP_BASE_API`（默认 `/api`）。
- 响应信封：成功 `{ code: 200, msg: 'success', data }`；失败 `{ code: 500, msg: '中文原因' }`；列表 `data = { list, total }`。
- 延迟：`Mock.setup({ timeout: '80-260' })`。
- 失败模拟：请求头 `x-mock-fail: 1` → 直接返回 500，**不落库**（用于验证失败安全）。
- 关联字段 enrich（列表接口返回时补充）：员工 departmentName；床位 wardName/departmentName；挂号 patientName/patientPhone/patientGender/departmentName/doctorName/feeYuan；接诊 regCode/doctorName/金额合计；入院 patientName/patientGender/patientPhone/wardName/bedCode/departmentName/doctorName/depositYuan；库存 medicineName；医嘱 admissionCode/patientName/wardName/amountCents。

路由表（节选，完整见代码）：

| 域 | 路由 |
| --- | --- |
| 认证 | `POST /auth/login`、`POST /auth/logout`、`GET /auth/profile?token=`（刷新复原身份） |
| 首页 | `GET /dashboard/stats` |
| B1/B2 新增 | `GET /workbench/summary`、`GET /timeline/patient/:id`、`GET/POST /todos`、`PUT/DELETE /todos/:id`、`PUT /todos/:id/status`、`POST /todos/suggest-priority`、`GET /reminders`、`POST /reminders/:id/ack`、`POST /reminders/:id/snooze`、`GET /audit-events` |
| B3–B5 AI | `GET /ai/settings`、`PUT /ai/settings`、`GET /ai/tasks`、`GET /ai/providers`、`GET /ai/stats`、`POST /ai/run`、`GET /ai/events`、`PUT /ai/events/:id/accept` |
| 列表（GET，均支持 query 分页筛选） | `/staff` `/departments` `/wards` `/beds` `/patients` `/schedules` `/registrations` `/visits` `/medicines` `/exam-items` `/fee-items` `/stocks` `/fee-records` `/admissions` `/orders` `/logs` `/roles` `/menus` |
| 标准 CRUD | `POST /X`、`PUT /X/:id`、`DELETE /X/:id`（员工另有 `PUT /staff/:id/enabled`、`PUT /staff/:id/password`） |
| 业务动作 | `PUT /registrations/:id/refund`；`PUT /visits/:id/charge`、`PUT /visits/:id/dispense`、`POST /visits/:id/report`；`PUT /admissions/:id/confirm\|transfer\|cancel\|discharge\|settle\|deposit`；`PUT /orders/:id/execute`、`DELETE /orders/:id`；`PUT /roles/:id/menus`；`POST /system/reset` |
| 选项字典 | `GET /options/doctors\|departments\|wards\|beds\|patients\|medicines\|exam-items\|fee-items\|adm-inside` |

> 注意：正则路由按注册顺序匹配，**更具体的子路由必须先注册**（如 `/staff/:id/enabled` 在 `/staff/:id` 之前）；列表 GET 正则需允许查询串 `(?:\?.*)?$`。

---

## 8. API 层与请求封装

- `src/api/index.js`：按域导出的方法，页面只调用它，不直接写 URL。
- `src/utils/request.js`：`baseURL = VUE_APP_BASE_API`、超时 15s、自动附加 `X-Token`、解包 `{code,msg,data}`、`code===401` 清 token 并跳 `#/login`、失败统一 `Message.error`。
- 页面约定：`loading` 控制遮罩/按钮 loading；提交按钮用 `:loading` + 防重复提交；错误由拦截器提示，页面只 try/catch 收尾。

---

## 9. 前端结构

### 9.1 路由（hash 模式）

| 路由 | 页面 | 备注 |
| --- | --- | --- |
| `/login` | `views/login/index.vue` | 未登录访问任意页会重定向到此 |
| `/dashboard` | `views/workbench/index.vue` | 分角色工作台（管理员内嵌原 Dashboard「运营概览」）；`meta.affix: true` |
| `/workbench/todos|reminders` | `views/workbench/*` | 待办中心 / 提醒中心 |
| `/basic/departments|staff|wards|beds|fee-items|medicines|exam-items|stocks` | `views/basic/*` | 8 个基础资料页 |
| `/patients` | `views/patients/PatientList.vue` | |
| `/patients/timeline` | `views/patients/Timeline.vue` | 患者 360° 时间线（只读） |
| `/outpatient/schedules|registrations|visits|prescriptions|exam-applies|charges|dispenses|reports` | `views/outpatient/*` | 门诊 8 页 |
| `/inpatient/admissions|orders|settlements` | `views/inpatient/*` | 住院 3 页 |
| `/system/roles|menus|logs|audit|reset` | `views/system/*` | 系统 5 页（含审计中心） |
| `/ai/assistant|reports|anomaly|forecast|center` | `views/ai/*`、`views/system/AiCenter.vue` | AI 应用 4 页 + AI 治理中心 |
| `/403`、`/404` + `*` | `views/error/*` | 无权限 / 兜底 |

守卫逻辑：无 token → `/login?redirect=...`；有 token 访问 `/login` → `/`；刷新后按 token 复原身份；每个路由 `meta.menuCode` 校验角色菜单（无权限跳 `/403`）；每次导航向 `tabs` 提交 `ADD_VIEW`（path 去重）；`document.title` 同步。

### 9.2 状态管理

- `user`（namespaced）：`token`（localStorage 持久）、`staff`；`login` 成功后写 token 与员工信息；`logout` 清 token。
- `app`：`sidebarCollapsed`；`refreshKey` —— 顶栏刷新按钮与「重置演示数据」都通过 `commit('app/INCREMENT_REFRESH')` 让 `<router-view :key="refreshKey">` 重新挂载当前页，从而重新拉数据。
- `tabs`：`visitedViews`（关闭当前后跳到相邻标签）。

### 9.3 布局与组件

- `layout/index.vue`：侧栏（菜单树来自 `src/config/menu.js`）+ 顶栏（面包屑/刷新/用户下拉：首页、重置演示数据、退出）+ `TagsView` + 主内容区。
- `StatusTag.vue`：状态文案 → 色系映射（绿/蓝/橙/红/灰），完整映射见 `STATUS_COLOR`；新状态需补映射。
- `Pagination.vue`：`total/page/size` 受控，`change({page,size})`；改每页条数时页码回归 1。
- `mixins/listPage.js`：`fetchData()`（页面实现）、`handleSearch()`（重置页码）、`handlePageChange()`、`afterDelete()`（删除后若当前页空则回退有效页）。

### 9.4 样式与设计令牌（`src/styles/variables.scss`）

| 令牌 | 值 | 用途 |
| --- | --- | --- |
| `$primary` | `#3F9DF9` | 主色（按钮/开关/链接/激活项） |
| `$primary-deep` → `$primary` | `#327AE0 → #3F9DF9` | 登录按钮渐变 |
| `$sidebar-bg` | `#1C1F2E` | 深色侧栏 |
| `$sidebar-deep` | `#151925` | 侧栏 logo 区 |
| `$sidebar-active` | `#2C4362` | 激活菜单项 |
| `$table-header-bg` | `#FAFAFA` | 浅灰表头 |
| `$page-bg` / `$card-bg` | `#F0F2F5` / `#FFFFFF` | 页面/卡片 |
| 状态色 | 绿 `#34B37C`、橙 `#D98E2B`、红 `#E56C6C`、灰 `#909399`（浅底深字） | 状态标签 |

登录页背景为「浅蓝渐变 + 稀疏点阵」（`radial-gradient` + `linear-gradient`）。Element 主题覆盖集中在 `styles/index.scss`。

### 9.5 金额与日期

- `money.js`：`centsToYuan/fmtMoney/fmtMoneyGrouped/yuanToCents/isValidCents/sumCents`。
- 表单输入用「元」，提交前 `yuanToCents`；展示用 `centsToYuan`。
- `demoToday` 固定为 `2026-08-28`（种子与首页「今天」一致，便于还原截图）；日期比较均为 `'YYYY-MM-DD'` 字符串。

---

## 10. 页面清单与九张参考截图对应

| # | 参考图 | 页面文件 | 要点 |
| --- | --- | --- | --- |
| 1 | 登录 | `views/login/index.vue` | 浅蓝渐变点阵、白色圆角卡片、渐变按钮、记住账号（不存密码） |
| 2 | 首页 | `views/dashboard/index.vue` | 4 指标卡、近七日门诊/收费双轴图（ECharts）、床位环图、待办闭环、快捷入口；数据来自 `GET /dashboard/stats` |
| 3 | 员工管理 | `views/basic/StaffList.vue` | 5 条件筛选、批量删除、账号开关、重置密码、导出 CSV、引用删除保护 |
| 4 | 床位管理 | `views/basic/BedList.vue` | 病区/床号/类型/状态/启用筛选；占床不可删/不可停用 |
| 5 | 患者档案 | `views/patients/PatientList.vue` | 编号/姓名/电话筛选、过敏史标签、CRUD |
| 6 | 医生排班 | `views/outpatient/ScheduleList.vue` | 日期范围 + 查看周次 + 科室卡片（本周排班/出诊医生）、详情弹窗、排班编辑（冲突校验） |
| 7 | 门诊挂号 | `views/outpatient/RegistrationList.vue` | 新增（患者→科室→日期→时段→有排班医生）、退号、导出 |
| 8 | 门诊接诊弹窗 | `views/outpatient/VisitList.vue` + `components/VisitDialog.vue` | 1060px 大弹窗：挂号记录/接诊状态/是否住院/主诉/现病史/诊断/处理意见 + 处方/医技动态行 + 金额汇总；底部按钮固定可达 |
| 9 | 入院登记 | `views/inpatient/AdmissionList.vue` | 新增登记/入科确认/转科转床/取消登记/导出；床位联动 |

辅助页（同设计系统）：处方查询、医技申请、门诊收费（含小票）、处方发药、医技报告、住院医嘱、出院结算、用户角色、菜单权限、操作日志、审计中心、演示数据重置、分角色工作台（待办中心/提醒中心）、患者 360° 时间线、AI 智能中心（Ask Astra 助手 / 智能报表 / 运营异常分析 / 预测分析 / AI 治理中心）。

---

## 11. 测试体系

### 11.1 数据层测试（`tests/data/suite.js`，72 项）

覆盖：金额整数分与非法金额、登录（错误/停用/成功）、账号唯一与引用删除保护、科室/病区/床位删除规则、床位号唯一、排班冲突与已挂号排班保护、挂号（无排班拒绝、收费记录生成）、退号（状态+退费、已接诊拒绝）、接诊（退号拒绝、状态联动、负数量拒绝、已收费不可改）、收费/发药/库存扣减、入院（占床、重复占床、重复登记、入科、转床释放+占用、取消、结算差额、重复结算）、分页筛选、首页统计实时性、重置与空结果；B1 迁移/审计/身份/待办提醒；B2 权限域/工作台/时间线/审计只读；**B3 AI 基础设施 11 项**（Provider 契约、自检、schema、脱敏、G6 开关无副作用、G1/G7 静态断言、审计统计、未知任务安全失败）。

**约束**：新增/修改业务规则时必须同时补断言，并保证 `node tests/data/run.js` 全绿。

### 11.2 Jest

`tests/unit/data.test.js` 复用同一套件（`--runInBand`，进程内运行，适配受限环境）。

### 11.2b AI 任务测试（`tests/ai/run.js`，49 项）

- 用例目录 `tests/ai/cases/*.js`，每个文件导出 `register({ test, section, db, ai })`；运行器每个用例前 `db.resetAll()` 保证确定性。
- 覆盖：助手 12（数值一致/权限收敛/未知回退/确定性/只读）、异常 11（b12/待报告/低库存/排序/阈值构造）、报表 9（5 类报表可复算、确定性、回退）、病历结构化 9（词典/否定语境/空输入/不改输入）、预测 8（schema/确定性/区间/series/只读/fallback）。
- 单文件运行：`node tests/ai/run-one.js tests/ai/cases/xxx.test.js`。

### 11.3 E2E（`tests/e2e/run.js`，14 节 / 48 项）

- 技术：`puppeteer-core` + 系统 Edge/Chrome，**自起浏览器（`stdio:'ignore'`）+ CDP(9333) 连接**（受限沙箱下不能用管道 stdio）。
- 分区：登录守卫与登录、九页截图、筛选空态重置、末页删除回退、排班冲突（**已改为动态翻月，不再依赖系统当前日期**）、挂号→接诊联动+刷新持久化、退号禁接诊、入院占床/转床/出院结算、重置数据、退出、375px 窄屏/1024px 宽表滚动/CSV 导出/顶部刷新、全部 30 页渲染冒烟 + 404、**AI 智能中心与 AI 应用**（自检/审计、助手问答、异常命中、报表合计、预测与 ECharts、工作台预测面板）。
- 截图输出：`tests/e2e/shots/*.png`（九页 + 窄屏 + AI 页面）。
- 运行前提：先 `npm run serve`；受限环境下需要**一次性完整权限**才能启动浏览器（否则 `spawn EPERM` / CDP 不就绪）。
- 失败时自动截 `fail-*.png` 便于定位。

**新增页面/交互时，建议在对应分区补断言**；若新增页面，请加入第 12 分区的路径列表。

---

## 12. 扩展指南（给后续代理的操作手册）

### 12.1 新增一个实体（7 步）

1. `src/mock/seed.js`：新增集合种子 + `counters.<集合>` 初始值。
2. `src/mock/db.js`：`load()` 的必填校验按需加入该集合；实现 `create/update/delete`，先校验后变更再 `persist()`；导出方法。
3. `src/mock/index.js`：注册列表/新增/修改/删除路由（注意具体子路由先注册、GET 允许查询串），补充关联字段 enrich；如需下拉字典加 `options/<name>`。
4. `src/api/index.js`：新增方法。
5. `src/config/menu.js` + `src/router/index.js`：菜单项与路由。
6. `src/views/...`：列表页可复用 `mixins/listPage.js`、`StatusTag`、`Pagination`；弹窗表单用 Element 表单校验 + `:loading` 防重复。
7. `tests/data/suite.js` 补规则断言；必要时 `tests/e2e/run.js` 补交互断言。

### 12.2 新增字段

- 数据：seed 默认值 → db 校验/归一化 → mock enrich（如需展示名称）→ 页面列/表单项 → 测试断言。
- 金额字段必须是整数分；日期必须是 `'YYYY-MM-DD'`。

### 12.3 替换 Mock 为真实后端

- 保留 `api/index.js` 的调用方式，仅把 `utils/request.js` 的 `baseURL` 指向真实服务；删除 `main.js` 中的 `registerMock()`。
- 保持响应信封 `{code,msg,data}`，或改拦截器适配后端格式。
- 认证：替换 `store/modules/user.js` 的 login 流程（token 存储位置可保留）。
- 注意：`db.js` 的业务规则需要迁移到后端，前端只保留展示与校验。

### 12.4 依赖升级

- 先改 `package.json` 版本 → `npm install` 生成 lock → 跑 `test:data`、`build`、`serve` 手测九个核心页 → E2E。
- Vue 2 已 EOL；若用户要求升级 Vue 3，属于技术栈变更，需先确认并整体迁移（Element Plus、Router 4、Vuex 4/Pinia、Mock 方式）。

### 12.5 视觉调整

- 颜色/圆角/阴影先改 `styles/variables.scss`；Element 组件覆盖集中在 `styles/index.scss`；页面局部样式用 scoped SCSS。
- 不要引入与截图风格无关的第三方后台模板。

### 12.6 新增一个 AI 任务（B3 起）

1. `src/ai/tasks/<name>.js`：导出任务定义（CommonJS）——`name/title/batch/readOnly:true/outputSchema/buildContext(sel,input,actor)/generate(ctx,input,options)/fallback(errors)`。
2. `src/ai/tasks/index.js`：在 `modules` 中 `require('./<name>')`（任务文件只导出定义，不自行注册）。
3. 只读约束：任务文件不得 `require('../mock/db')`、不得调用业务写函数、不得联网/读 localStorage；数据只能经 `selectors` 获取（深拷贝+脱敏）。
4. 输出：`generate` 返回 `{text, data, confidence, basis}`，`data` 必须含 `outputSchema` 全部字段（否则 G2 回退）；免责声明由框架注入，任务可追加。
5. 页面：调用 `apiAiRun('<task>', input)`；展示 `data`、`meta`（`AiMetaBar`）、免责（`AiDisclaimer`）；采纳用 `apiAiAcceptEvent(meta.eventId)`。
6. 测试：`tests/ai/cases/<name>.test.js` 导出 `register({test,section,db,ai})`，用 `contextBuilder.build(taskDef,...)` 构造上下文；`node tests/ai/run-one.js tests/ai/cases/<name>.test.js`。
7. 新增 AI 页面需同步 `router`、`config/menu.js`、`db.js` 迁移（菜单/角色授权）与 `seed.js`。

---

## 13. 已知限制、风险与待办

1. **参考图不可入库**：九张 JPG、指导手册 DOCX、手册正文提取、`release/` ZIP 已在 `.gitignore`，仅本地保留（版权原因）；视觉核对方法见 `docs/visual-check.md`（OCR + 像素配色，未逐像素还原）。
2. **E2E 依赖图形浏览器**：受限环境必须完整权限运行；CI 中需安装 Chromium 或使用系统浏览器。
3. **无 LICENSE**：公开仓库默认「保留所有权利」；若希望他人复用，建议加 MIT（需用户决定）。
4. **无 CI 配置**：建议 `.github/workflows/ci.yml` 跑 `npm ci && npm run test:data && npm run build`。
5. **权限为演示**：菜单权限/角色不构成安全边界。
6. **`demoToday` 固定为 2026-08-28**：若需要真实「今天」，修改 `seed.js` 的 `demoToday` 并调整种子日期（首页/挂号/排班筛选依赖它）。
7. **模拟失败入口未暴露 UI**：仅能通过请求头 `x-mock-fail: 1` 触发（可考虑加调试开关）。
8. **无国际化**、**无多主题**（如需，需评估范围）。
9. **依赖告警**：Vue 2 EOL、`npm audit` 可能有告警，属演示项目已知情况。
10. **AI 层限制**：外部 LLM Provider 仅骨架（默认禁用、无网络实现）；本地引擎同步链路（Mock.js 无法 await，见 `DECISIONS D21`）；`aiEvents` 上限 1000 条；AI 阈值/预测均为演示规则，不构成诊疗或经营结论。
11. **AI 页面依赖 AI 开关**：关闭后页面显示"AI 功能已关闭"（接口 503），不会产生审计事件或修改业务数据（G6）。

---

## 14. 交接验收清单（接手方第一轮必做）

- [ ] `npm ci`（受限环境用 `--cache .npm-cache --ignore-scripts`）成功。
- [ ] `npm run serve` 打开 `http://localhost:8080`，`admin/123456` 登录成功。
- [ ] 逐页打开九个核心页面（登录/首页/员工/床位/患者/排班/挂号/接诊弹窗/入院登记），无空白、无控制台报错。
- [ ] 打开 AI 智能中心五个页面（助手/报表/异常/预测/治理），运行一次 AI 自检并确认 `aiEvents` 有记录。
- [ ] `npm run test:data` 72/72 通过；`npm run test:ai` 49/49 通过；`npm run build` 成功；`npm run e2e` 通过（需先 `npm run serve`）。
- [ ] `git status` 干净；确认 `dist/`、`node_modules/`、参考素材未入库。
- [ ] 按第 12 节流程完成一次小改动（如新增一个收费项目字段）并跑通测试与构建；如需新增 AI 任务，按 §12.6 流程。

---

## 15. 历史决策记录（为什么这样做）

| 决策 | 原因 |
| --- | --- |
| 锁定 Vue 2 技术栈 | 需求明确指定，禁止 Vue 3/Vite/Element Plus |
| Mock.js 拦截 XHR + 自有数据层 | 需在浏览器内演示完整业务流，同时保持数据层可 Node 直测 |
| 数据层用 CommonJS、无框架依赖 | 可被 Jest 与纯 Node 直接加载，便于规则测试 |
| 金额用整数分 | 避免浮点误差（需求硬性要求） |
| 单例 state + persist() | 演示场景简单可靠；重置/播种逻辑集中 |
| `demoToday = 2026-08-28` | 与参考截图日期一致，便于视觉比对 |
| 种子 12 床位、3 占用（25%） | 与截图床位环图一致，同时保证列表可分页 |
| `parallel: false` | 受限环境禁止子进程管道，thread-loader 会 EPERM |
| 参考素材不入库 | 第三方截图/手册版权风险；仓库保持可公开 |
| 单条 `Initial commit` 历史 | 按发布要求整理为单提交并替换旧本地历史 |
| 提交身份用 noreply 邮箱 | 关联 GitHub 账号且不暴露真实邮箱 |

---

## 16. 常用命令速查

```bash
npm run serve                 # 开发服务器 8080
npm run build                 # 生产构建 dist/
node tests/data/run.js        # 数据层 40 项
node node_modules/jest/bin/jest.js --runInBand tests/unit
node tests/e2e/run.js         # 需先 serve；受限环境需完整权限
node tests/e2e/run.js 5       # 只跑第 5 节（含登录）

# 受限环境推送（Windows + 凭据库）
git -c http.sslBackend=openssl -c credential.helper=wincred push
```

---

## 17. 术语表

| 术语 | 含义 |
| --- | --- |
| 挂号 / regStatus | 患者预约医生时段；状态：待分诊/已完成/已退号 |
| 接诊 / visit | 医生实际诊疗记录，关联挂号；含处方与医技申请 |
| 处方明细 | 药品、用法、数量、单价（分）、金额（分） |
| 医技申请 | 检验/检查项目申请，数量与金额 |
| 医嘱 / order | 住院期间开立的药品/医技/收费项目，可执行/作废 |
| 结算 / settlement | 出院时按已执行医嘱汇总，用预交金额抵扣 |
| 预交金额 | 入院时缴纳的押金（整数分，界面元代） |
| 参考图 | 九张医院管理系统的目标 UI 截图（仅本地） |
| demoToday | 演示用「今天」，固定 2026-08-28 |

---

> 维护本文档时，请同步更新：第 0 节基线提交、第 6 节实体/规则、第 12 节扩展流程、第 13 节限制与待办。修改后请执行第 14 节验收清单并在提交信息中注明 `docs:` 前缀。

---

## 18. 智能化升级规划（2026-11-07 起，长期依据）

> 本节为“后续所有开发任务的长期依据”入口。原始项目已完成克隆/环境/验证/迁移（当前路径 `F:\Project\hospital-management-system`，基线提交 `85251fe`）。下一阶段的智能化升级**尚未修改任何业务代码**，仅建立规划文档。

### 18.1 规划文档索引（开发必读）

| 文档 | 作用 |
| --- | --- |
| [`docs/INNOVATION_PLAN.md`](INNOVATION_PLAN.md) | **路线图与各批次任务/验收标准**：4 个保留方向（智能待办与提醒、操作审计与流程回放、患者全流程时间线、分角色工作台）+ 5 个新增方向（AI 业务助手、运营异常分析、智能报表、病历结构化、流程预测） |
| [`docs/IMPLEMENTATION_STATUS.md`](IMPLEMENTATION_STATUS.md) | 逐任务状态看板、验收清单、创新↔批次映射、基线快照与变更记录 |
| [`docs/AI_ARCHITECTURE.md`](AI_ARCHITECTURE.md) | AI 分层架构、Provider 抽象、任务注册表、Guardrails、AI 审计（自批次 3 起强制） |
| [`docs/DECISIONS.md`](DECISIONS.md) | ADR 决策记录（D1–D13），重大实现变更的依据 |

### 18.2 五个实施批次（顺序：业务基础 → 工作台 → AI 基础设施 → AI 应用 → 预测分析）

| 批次 | 名称 | 核心交付 |
| --- | --- | --- |
| B1 | 业务基础与数据安全基座 | 版本化增量迁移框架、结构化审计事件 `auditEvents`、身份/角色持久化、待办与系统提醒数据层 |
| B2 | 分角色工作台与四大业务创新 | 分角色工作台、智能待办/提醒 UI、患者时间线、审计回放、角色菜单+路由+Mock 权限 |
| B3 | AI 基础设施 | AI 服务层（本地确定性引擎 + 上下文构建 + Guardrails + AI 审计 + 开关） |
| B4 | AI 应用 | AI 业务助手、智能报表、病历结构化、运营异常分析 |
| B5 | 流程预测 | 门诊量/床位/出院/积压/爽约预测并与工作台集成 |

### 18.3 对现有代码的强制约束（与第 1 节边界一脉相承）

1. 技术栈锁定（Vue2 全家桶），不引入 Vue3/Vite/Element Plus/Pinia/TS，不升级既有依赖。
2. **数据迁移安全**：现 `load()` 版本不符即 `buildSeed()` 重播种会丢数据，升级必须走增量迁移框架（先备份、逐级迁移、拒绝降级），见 `DECISIONS D2`。
3. **AI 不得绕过业务校验写数据**：AI 只读 + 建议/提案，写操作必须经原有 `db.*` 校验路径（见 `AI_ARCHITECTURE.md` 与 `DECISIONS D7`）。
4. 金额整数分、日期 `YYYY-MM-DD`、`demoToday=2026-08-28` 不变；每批次独立 `test:data`/`build`/`serve` 验收并入 `IMPLEMENTATION_STATUS.md`。
5. 不执行 `git push`、不执行 `npm audit fix`、不修改无关目录。

### 18.4 现状与待办

- 现状：**B1、B2 已完成（2026-11-07）**，**B3、B4、B5 已完成（2026-11-10）**，当前数据版本 `CURRENT_VERSION=5`；B3–B5 全部验收通过，项目进入维护/演示阶段。
- 待办：无强制待办；可选增强见 §13 与 §18.10「后续可选增强」。

### 18.5 B1 实施结果（2026-11-07）

- **状态**：B1 ✅ 完成（原 40 项数据测试不回退，新增 6 项，共 **46/46**；`build` 通过；`serve` + 浏览器实测通过）。
- **数据版本迁移**：`CURRENT_VERSION` 1→2；`db.js` `load()` 重写为增量迁移（迁移前备份 `astra_hospital_db_v1_backup_v<v>`、逐级 `MIGRATIONS`、更高版本拒绝降级、损坏先备份再兜底）。浏览器实测 v1→v2 **患者 12 / 挂号 21 全部保留、生成备份键、无静默重置**。
- **新增集合**（同步进 `seed.js` + counters）：`auditEvents`（结构化审计）、`todos`（个人待办）、`reminderAcks`（提醒确认）、`aiEvents`（AI 审计占位）。
- **结构化审计**：`db.recordAudit()` + `currentActor`；在 `module.exports` 上用 `AUDIT_WRAP` 统一包装写操作，成功后记录真实 `actorName/actorRole/entityType/entityId/before/after`（剔除 `password`/`token`），旧 `logs` 保留兼容。
- **身份/角色持久化**：`db.profileOf(token)`/`permissionsOf`；`store/modules/user.js` 增 `restore()`；`router/index.js` 刷新后按 token 复原；`api.getProfile()`（token 走查询参数，见 `DECISIONS D14`）。
- **待办与提醒引擎**：`createTodo/updateTodo/setTodoStatus/deleteTodo/suggestTodoPriority`；`computeReminders/reminderSummary/acknowledgeReminder/snoozeReminder`（低库存/床位占用/待报告/待发药/待执行医嘱/临期/未缴费；**问题解决即自动完成，关闭不等于解决**）。
- **API/Mock 路由**：`/auth/profile`、`/todos*`、`/reminders*`、`/audit-events`；`api/index.js` 对应方法。
- **关键文件**：`src/mock/db.js`、`src/mock/seed.js`、`src/mock/index.js`、`src/api/index.js`、`src/store/modules/user.js`、`src/router/index.js`、`src/views/system/DataReset.vue`（版本显示 2）、`src/components/StatusTag.vue`（状态色）、`tests/data/suite.js`。
- **注意事项/遗留**：① 本项目 Mock.js `options` 不含 headers，token 经查询参数传递（演示级，见 `D14`）；② 审计 `before` 仅对按 id 更新的函数采集；③ `x-mock-fail` 依赖请求头，在当前 Mock 版本不可达（**历史遗留，未处理**，不影响 B1 验收）；④ 新增写函数须登记 `AUDIT_WRAP`（见 `D15`）。
- **下一阶段入口**：B2「分角色工作台与四大业务创新」，范围见 `docs/IMPLEMENTATION_STATUS.md` §2 批次 2。

### 18.6 B2 实施结果（2026-11-07）

- **状态**：B2 ✅ 完成。`npm run test:data` **55/55**；`npm run build` 通过；三角色浏览器实测通过；`npm run e2e` **27/29**（2 项为既有 E2E 日期敏感缺陷，非 B2 回归，见下）。
- **分角色工作台**：`views/workbench/index.vue` 作为 `/dashboard` 新首页；`db.workbenchSummary()` 按角色聚合真实数据；管理员嵌入原 Dashboard「运营概览」，医生/收费员/住院角色展示各自队列；待办/提醒概览与角色化快捷入口。
- **RBAC（演示级）**：`utils/perm.js`（`hasMenu/hasDomain/filterMenuTree`）；`layout` 按 `menuCodes` 过滤菜单；`router` 每路由 `meta.menuCode` + 守卫跳 `/403`；`mock/index.js` 以 `guardedMock`/`apiGuard` 按**当前登录会话角色域**校验 API（不读取客户端 role 参数，不能提权）。`/403` 页面与请求拦截 403 提示。
- **智能待办与提醒 UI**：`views/workbench/TodoCenter.vue`（增删改、描述、截止、模块、优先级建议/采纳、筛选排序、完成统计）；`views/workbench/ReminderCenter.vue`（触发原因、状态、关联业务、处理入口、确认/暂缓、规则阈值展示）。**提醒完成仍由业务规则决定**（实测执行医嘱 o6 后 pendingOrder 自动消失）。
- **患者 360° 时间线**：`db.patientTimeline()` 只读聚合挂号/接诊/处方/检查/报告/收费/入院/医嘱/结算，并补充转床等审计事件；`views/patients/Timeline.vue` 支持正倒序、环节筛选、进度、节点详情与原始记录跳转；患者档案/入院记录增入口。
- **审计中心**：`views/system/AuditCenter.vue` 基于 `auditEvents`，支持操作人/角色/业务类型/动作/时间范围/关键字筛选、分页、before/after 差异（缺失明确标注）、按业务对象回放；只读，无删除/重放执行。旧 `OpLogList.vue` 保留。
- **数据结构变化（v2→v3 迁移）**：`CURRENT_VERSION=3`，`MIGRATIONS[2]` 合并新增菜单（`patient-timeline`、`system-audit`）并补 `todos.description`；迁移前备份 `astra_hospital_db_v1_backup_v2`，浏览器实测 v2→v3 零丢失。
- **新增/修改关键文件**：新增 `src/views/workbench/{index,TodoCenter,ReminderCenter}.vue`、`src/views/patients/Timeline.vue`、`src/views/system/AuditCenter.vue`、`src/views/error/403.vue`、`src/utils/perm.js`；修改 `src/mock/{db,seed,index}.js`、`src/api/index.js`、`src/router/index.js`、`src/layout/index.vue`、`src/main.js`、`src/config/menu.js`、`src/views/patients/PatientList.vue`、`src/views/inpatient/AdmissionList.vue`、`tests/data/suite.js`。
- **已知问题/遗留**：① `npm run e2e` 的「排班冲突校验」2 项失败源于脚本硬编码“当前月 2026-10”并回退两月（实际 2026-11 → 2026-09），属**既有日期敏感缺陷**，排班冲突逻辑由数据层测试覆盖；② 审计 `before` 仅对按 id 更新的函数采集（创建为 null）；③ `x-mock-fail` 依赖请求头在当前 Mock 版本不可达（历史遗留）；④ token 仅用于 `/auth/profile` 查询参数，未扩大暴露。
- **下一阶段入口**：B3「AI 基础设施与安全治理」，范围见 `docs/IMPLEMENTATION_STATUS.md` §2 批次 3 与 `docs/AI_ARCHITECTURE.md`。

### 18.7 B3 实施结果（2026-11-10）

- **状态**：B3 ✅ 完成。`npm run test:data` **72/72**；`npm run build` 通过；`npm run serve` + 浏览器实测 AI 治理中心自检/审计/开关通过（截图 `tests/e2e/shots/11-ai-center.png`）。
- **新增 AI 服务层（`src/ai/`，全部 CommonJS，可被 Node 直测）**：
  - `config.js`：`VUE_APP_AI_ENABLED/VUE_APP_AI_PROVIDER/VUE_APP_AI_ENDPOINT` 默认值 + 运行时开关（非业务偏好键 `astra_ai_prefs`，不含密钥）。
  - `provider.js` / `localProvider.js` / `httpProvider.js`：Provider 契约（name/kind/sync/isAvailable/generate）；默认 `local-rule-engine` 同步、离线、确定性；`http-llm` 仅骨架且默认禁用（无网络实现）。
  - `selectors.js`：只读数据选择器（深拷贝 + 敏感字段剔除 + 金额整数分 + 聚合口径：收入/医生工作量/药品消耗/床位周转/队列）。
  - `contextBuilder.js`：按任务构建最小必要上下文（只读、脱敏、按当前角色权限域收敛；业务文本作为数据处理，不执行指令）。
  - `taskRegistry.js`：任务注册（强制 `readOnly:true`、`outputSchema`、`buildContext/generate`）；内置 `system.selftest`、`todo.priority`、`reminder.explain`。
  - `guardrails.js`：G1 no-write（静态扫描规则）、G2 schema 校验与"无建议"回退、G3 免责声明注入、G5 递归脱敏、G7 零网络静态规则。
  - `aiAudit.js` + `index.js`：调用编排（开关→任务→上下文→Provider→schema→免责→审计）与 `aiEvents` 写入。
- **数据层**：新增 `db.recordAiEvent/queryAiEvents/markAiEventAccepted/aiEventStats`（AI 层唯一允许写入口，仅审计集合）；`CURRENT_VERSION` 3→4→5（AI 菜单与角色授权，见 `DECISIONS D22`）。
- **Mock/API**：`/ai/settings`（GET/PUT）、`/ai/tasks`、`/ai/providers`、`/ai/stats`、`/ai/run`（POST，AI 关闭返回 503）、`/ai/events`（GET）、`/ai/events/:id/accept`；`api/index.js` 对应 `apiAi*` 方法。
- **页面**：`views/system/AiCenter.vue`（`/ai/center`，AI 治理中心：开关、Provider、Guardrails 清单、自检、任务表、审计事件与采纳）；`components/AiDisclaimer.vue`、`AiMetaBar.vue`（B4/B5 复用）。
- **测试**：`tests/data/suite.js` 新增 B3 段 11 项（契约/自检/schema/脱敏/G6 开关无副作用/G1 静态/G7 静态/审计统计/未知任务）；`tests/ai/run.js`（`npm run test:ai`，B4/B5 用例目录）与 `tests/ai/run-one.js`（单文件运行）；`tools/check-vue.js`（模板+脚本语法检查）。
- **已知限制/遗留**：① 外部 LLM Provider 仅骨架（默认禁用，无网络实现），接入真实 LLM 需后端/代理；② Mock.js 拦截层不支持异步，故本地引擎走同步链路（`D21`）；③ `aiEvents` 上限 1000 条（超出截断，仅演示）；④ AI 上下文仅覆盖任务所需聚合，非全量数据。
- **下一阶段入口**：B4「AI 应用」（Ask Astra 助手、智能报表、病历结构化、运营异常分析），范围见 `docs/IMPLEMENTATION_STATUS.md` §2 批次 4。

### 18.8 B4 实施结果（2026-11-10）

- **状态**：B4 ✅ 完成。`npm run test:data` 72/72；`npm run test:ai` **49/49**；`npm run build` 通过；浏览器实测助手/异常/报表/病历结构化/待办 AI/提醒 AI 全部通过。
- **Ask Astra 助手**（`src/ai/tasks/assistant.js` + `views/ai/Assistant.vue`，`/ai/assistant`）：确定性关键词意图识别（门诊量/挂号量、待接诊、待收费、待发药、待报告、待医嘱、库存、床位、收入、在院、患者数、科室/医生工作量）；回答 = 结论 + 数据依据（`source`+`raw`）+ 建议入口 + 追问 + 免责；按角色权限域收敛，越权问题直接拒绝取数。
- **智能报表**（`src/ai/tasks/report.js` + `views/ai/Reports.vue`，`/ai/reports`）：收入结构/科室工作量/医生接诊量/药品消耗/床位周转 5 类；动态列（`money` 列转元）、合计行、AI 摘要与要点、CSV 导出；`rows` 求和 = `totals`（用例断言）。
- **病历结构化**（`src/ai/tasks/recordStruct.js` + `VisitDialog.vue`）：主诉/现病史/诊断/处理意见 → 症状/病程/诱因/过敏/诊断关键词/风险提示；否定语境识别；**原文只读保留**；确认后仅追加缺失诊断关键词，保存仍走原 `apiUpdateVisit` 校验；采纳标记 `aiEvents.accepted`。
- **运营异常分析**（`src/ai/tasks/anomaly.js` + `views/ai/Anomaly.vue`，`/ai/anomaly`）：停用床位（b12）、低库存（<50 高 / 50–199 中，命中 m4/m6/m10）、待报告/待医嘱/待收费/待发药积压、占用率 >80%、临期、未缴费挂号、待入科/待结算；级别筛选 + 处理入口。
- **待办/提醒 AI 接入**：`TodoCenter` 调用 `todo.priority`（失败回退数据层同口径规则）；`ReminderCenter` 新增 `reminder.explain` 只读解释弹窗（不改变提醒状态）。
- **关键文件**：`src/ai/tasks/{assistant,report,recordStruct,anomaly}.js`、`src/views/ai/{Assistant,Reports,Anomaly}.vue`、`src/views/outpatient/components/VisitDialog.vue`、`src/views/workbench/{TodoCenter,ReminderCenter}.vue`、`tests/ai/cases/{assistant,anomaly,report,recordStruct}.test.js`。
- **已知限制**：AI 回答/报表口径基于演示数据与规则；外部 LLM 仍为骨架；结构化建议需医生确认。

### 18.9 B5 实施结果（2026-11-10）

- **状态**：B5 ✅ 完成。`npm run test:ai` 49/49（预测 8 项）；`npm run build` 通过；浏览器实测预测页与工作台预测面板通过。
- **预测引擎**（`src/ai/tasks/forecast.js`）：5 个确定性任务 —— 次日门诊量（7 日加权移动平均）、次日床位需求（占用+待入科+预计新增−预计出院）、未来 3 日预计出院、次日医嘱/发药/报告积压、挂号爽约风险率（退号代理指标）；统一输出 `value/unit/range/method/confidence/note/series/disclaimers`，`demoToday=2026-08-28` 下可回归。
- **预测呈现**（`src/views/ai/Forecast.vue`，`/ai/forecast`）：5 张卡片（主值/区间/置信度/口径/跳转）+ ECharts 趋势图（实际 + 预测点 + 区间）+ 免责；并行调用 5 个任务，部分失败保留成功结果。
- **工作台集成**：`views/workbench/index.vue` 新增「明日运营预测」面板（次日门诊量/床位需求/积压 + 详情入口），AI 关闭或任务不可用时降级提示，不阻塞工作台。
- **已知限制**：预测为统计口径建议，非真实预测模型；样本量小（演示数据），置信度 0.5–0.8。

### 18.10 后续可选增强（非必需）

1. 接入真实后端/LLM：实现 `HttpLLMProvider`（需后端代理与密钥管理，前端不存密钥），并把 Mock 层替换为真实 API。
2. 预测模型升级：引入历史序列模型（需真实数据与后端计算）。
3. AI 成本/限额治理：增加调用配额、缓存与降级策略。
4. E2E 扩展：AI 关闭态、权限越权态、CSV 下载内容校验。
5. 报告导出增强：PDF/Excel（当前 CSV 已够演示）。

### 18.11 缺陷修复记录（2026-11-11，最终验收后）

> 依据 `acceptance/ASTRA_FINAL_ACCEPTANCE_REPORT.md` §7 的 W1/W2/W3/W5 执行修复；仅修改涉及问题、未新增功能、未重构架构、未变更数据模型；未提交/未推送 Git。

- **W1 医技申请列表分页过滤缺陷**（`src/mock/index.js`、`src/views/outpatient/ExamApplyList.vue`）：`GET /visits` 新增 `hasExams=1`（**分页前**过滤「存在医技项目」）与 `reportStatus` 过滤；页面改为传 `hasExams=1` 并使用服务端 `total/list`，去掉「先分页后前端过滤」。效果：医技申请列表共 9 条，历史待报告接诊（VIS000000000002/003）可见并可「出具报告」，提醒「检查报告待处理」随报告出具由 2 条降为 1 条。
- **W2 接诊弹窗医技项目 undefined**（`src/mock/index.js`）：`GET /options/exam-items` 补充 `category` 字段，下拉标签恢复为「名称（检验/检查）」。
- **W3 病历结构化「应用建议」反馈**（`src/views/outpatient/components/VisitDialog.vue`）：新增持久化内联反馈（已包含关键词/已追加/已取消/采纳成功/失败），「标记采纳」后按钮显示「已标记采纳」并说明仅记录审计；**人工确认 MessageBox 与「AI 不直接写库」约束保持不变**。
- **W5 文档任务数量**（`docs/B3-B5_DELIVERY_REPORT.md`）：AI 任务数量由「10 个」更正为「12 个（8 个任务模块 + 注册索引）」。
- **回归测试**：`tests/e2e/run.js` 新增第 14 节（7 项断言：W1 4 项、W2 1 项、W3 2 项）。
- **修复后验证**：`test:data` 72/72、`test:ai` 49/49、`test:unit` 通过、`build` 通过、`e2e` **48/48**（控制台零错误）；真实浏览器复验通过；用户 localStorage 哈希 `3cca075d` 前后一致。
- **未修改**：W4（375px 后台移动端适配，设计限制，超出本轮范围）。
- **证据**：`acceptance/ASTRA_FINAL_ACCEPTANCE_REPORT.md` §10、`acceptance/screenshots/fix/`、`acceptance/logs/fix-*.log`。
