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
| 基线提交 | `cc1e4c4`（`Initial commit`，98 个文件） |
| 包名 / 版本 | `astra-hospital-ui` / `1.0.0`（`private: true`，不发布 npm 包） |
| 运行环境验证 | Node v24.21.0 + npm 11.19.0（要求 Node ≥ 18） |
| 核心定位 | **纯前端 SPA 演示系统**：无后端、无数据库、无真实 API，全部数据为虚构演示数据 |

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
├─ api/index.js           所有 HTTP 方法（按 auth/dashboard/basic/patients/outpatient/inpatient/system/options 分组）
├─ components/
│  ├─ StatusTag.vue       状态标签（label → 色系映射 STATUS_COLOR）
│  └─ Pagination.vue      Element 分页封装（total/page/size，change 事件）
├─ config/menu.js         侧栏菜单树（与路由、标签页、面包屑、权限演示共用）
├─ layout/
│  ├─ index.vue           后台框架（侧栏 + 顶栏 + 面包屑 + 标签页 + 主区 + 刷新 key）
│  └─ components/TagsView.vue  可关闭标签页（关闭/关闭其他/关闭全部/刷新）
├─ mixins/listPage.js     列表页通用：loading/list/total/query、搜索重置、分页、末页删除回退
├─ mock/
│  ├─ index.js            Mock.js 路由注册、响应信封、关联字段补充、失败模拟
│  ├─ db.js               数据层核心（规则、状态机、持久化、统计）—— 见第 6 节
│  └─ seed.js             种子数据（虚构）+ 计数器 counters
├─ router/index.js        hash 路由 + 登录守卫 + 标签页注册 + 404
├─ store/
│  ├─ modules/user.js     token/staff；login/logout action
│  ├─ modules/app.js      sidebarCollapsed、refreshKey（INCREMENT_REFRESH）
│  └─ modules/tabs.js     visitedViews（ADD/DEL/DEL_OTHERS/DEL_ALL）
├─ styles/
│  ├─ variables.scss      设计令牌（颜色/圆角/阴影/字体）
│  └─ index.scss          全局样式 + Element UI 主题覆盖
├─ utils/
│  ├─ request.js          Axios 实例与拦截器
│  ├─ money.js            分↔元、金额校验、整数求和
│  ├─ storage.js          localStorage 安全读写（带内存兜底）
│  ├─ auth.js             token 与「记住账号」（不保存真实密码）
│  ├─ validate.js         手机号/正整数/账号正则
│  ├─ csv.js              CSV 导出（BOM，Excel 友好）
│  └─ date.js             日期格式化/加减/星期
└─ views/
   ├─ login/index.vue
   ├─ dashboard/index.vue
   ├─ basic/       DepartmentList / StaffList / WardList / BedList / FeeItemList / MedicineList / ExamItemList / StockList
   ├─ patients/    PatientList
   ├─ outpatient/  ScheduleList / RegistrationList / VisitList(+components/VisitDialog) / PrescriptionQuery /
   │               ExamApplyList / ChargeList / DispenseList / ReportList
   ├─ inpatient/   AdmissionList / OrderList / SettlementList
   ├─ system/      RoleList / MenuPerm / OpLogList / DataReset
   └─ error/404.vue
tests/
├─ data/suite.js          数据层测试套件（40 项，纯 Node，可直接跑）
├─ data/run.js            入口：node tests/data/run.js
├─ unit/data.test.js      Jest 包装同一套件
└─ e2e/run.js             puppeteer-core E2E（28 项，9 页截图 + 全站冒烟）
tools/                     开发辅助脚本（DOCX 文本提取、截图 OCR、配色分析、E2E 调试）
docs/                      对照清单（checklist.md）、视觉验收（visual-check.md）、本文档
```

---

## 6. 数据层（`src/mock/db.js`）—— 系统的核心

### 6.1 持久化与安全

- 存储键：`astra_hospital_db_v1`；`CURRENT_VERSION = 1`。
- `load()`：读取 localStorage；JSON 解析失败、版本不符或结构缺失时**自动重新播种**并写回。
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
| 认证 | `POST /auth/login`、`POST /auth/logout` |
| 首页 | `GET /dashboard/stats` |
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
| `/dashboard` | `views/dashboard/index.vue` | `meta.affix: true`（标签页固定） |
| `/basic/departments|staff|wards|beds|fee-items|medicines|exam-items|stocks` | `views/basic/*` | 8 个基础资料页 |
| `/patients` | `views/patients/PatientList.vue` | |
| `/outpatient/schedules|registrations|visits|prescriptions|exam-applies|charges|dispenses|reports` | `views/outpatient/*` | 门诊 8 页 |
| `/inpatient/admissions|orders|settlements` | `views/inpatient/*` | 住院 3 页 |
| `/system/roles|menus|logs|reset` | `views/system/*` | 系统 4 页 |
| `/404` + `*` | `views/error/404.vue` | 兜底 |

守卫逻辑：无 token → `/login?redirect=...`；有 token 访问 `/login` → `/`；每次导航向 `tabs` 提交 `ADD_VIEW`（path 去重）；`document.title` 同步。

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

辅助页（同设计系统）：处方查询、医技申请、门诊收费（含小票）、处方发药、医技报告、住院医嘱、出院结算、用户角色、菜单权限、操作日志、演示数据重置。

---

## 11. 测试体系

### 11.1 数据层测试（`tests/data/suite.js`，40 项）

覆盖：金额整数分与非法金额、登录（错误/停用/成功）、账号唯一与引用删除保护、科室/病区/床位删除规则、床位号唯一、排班冲突与已挂号排班保护、挂号（无排班拒绝、收费记录生成）、退号（状态+退费、已接诊拒绝）、接诊（退号拒绝、状态联动、负数量拒绝、已收费不可改）、收费/发药/库存扣减、入院（占床、重复占床、重复登记、入科、转床释放+占用、取消、结算差额、重复结算）、分页筛选、首页统计实时性、重置与空结果。

**约束**：新增/修改业务规则时必须同时补断言，并保证 `node tests/data/run.js` 全绿。

### 11.2 Jest

`tests/unit/data.test.js` 复用同一套件（`--runInBand`，进程内运行，适配受限环境）。

### 11.3 E2E（`tests/e2e/run.js`，28 项）

- 技术：`puppeteer-core` + 系统 Edge/Chrome，**自起浏览器（`stdio:'ignore'`）+ CDP(9333) 连接**（受限沙箱下不能用管道 stdio）。
- 分区：登录守卫与登录、九页截图、筛选空态重置、末页删除回退、排班冲突、挂号→接诊联动+刷新持久化、退号禁接诊、入院占床/转床/出院结算、重置数据、退出、375px 窄屏/1024px 宽表滚动/CSV 导出/顶部刷新、全部 25 页渲染冒烟 + 404。
- 截图输出：`tests/e2e/shots/*.png`（含九页 + 窄屏登录）。
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

---

## 14. 交接验收清单（接手方第一轮必做）

- [ ] `npm ci`（受限环境用 `--cache .npm-cache --ignore-scripts`）成功。
- [ ] `npm run serve` 打开 `http://localhost:8080`，`admin/123456` 登录成功。
- [ ] 逐页打开九个核心页面（登录/首页/员工/床位/患者/排班/挂号/接诊弹窗/入院登记），无空白、无控制台报错。
- [ ] `npm run test:data` 40/40 通过；`npm run build` 成功。
- [ ] `git status` 干净；确认 `dist/`、`node_modules/`、参考素材未入库。
- [ ] 按第 12 节流程完成一次小改动（如新增一个收费项目字段）并跑通测试与构建。

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
