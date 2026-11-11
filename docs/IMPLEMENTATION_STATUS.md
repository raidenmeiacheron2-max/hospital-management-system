# 医院业务管理系统 · 实施状态看板（IMPLEMENTATION STATUS）

> 文档性质：**长期开发进度与验收依据**，与 `docs/INNOVATION_PLAN.md` 配套。任何批次/任务状态变化须同步更新本文件。
> 初次建立：2026-11-07。维护人：后续 AI 代理/开发者。

---

## 0. 状态图例

| 标记 | 含义 |
| --- | --- |
| ⬜ 未开始 | 已规划，尚未动工 |
| 🟡 进行中 | 正在开发 |
| ✅ 已完成 | 已实现并通过验收 |
| ⛔ 阻塞 | 存在阻塞条件（需在“阻塞说明”写明） |

> 本文件建立时（规划阶段）全部任务为 ⬜；**2026-11-07 完成 B1、B2**；**2026-11-10 完成 B3、B4、B5**。三个批次全部验收通过，项目进入维护/演示阶段。

---

## 1. 基线快照（规划前，已实测）

| 项 | 值 |
| --- | --- |
| 基线提交 | `85251fe`（`docs: README 增加交接文档入口`） |
| 分支 / 远程 | `main` / `origin` GitHub 原仓库 |
| 代码规模 | `db.js` 1533 行、`seed.js` 385、`mock/index.js` 529、`dashboard` 592、`layout` 324 |
| 数据层测试 | `npm run test:data` **40/40 通过** |
| 生产构建 | `npm run build` **通过**（21 条已知无害警告） |
| 开发服务 | `npm run serve` 正常，`admin/123456` 登录 → Dashboard 正常 |
| 数据存储 | localStorage `astra_hospital_db_v1`，`CURRENT_VERSION=1` |
| 已知缺陷 | ① 版本不符即重播种（数据丢失风险）② operator 硬编码「系统管理员」③ staff/role 不持久化 ④ 菜单未按角色过滤 ⑤ 无 AI 层 |

### 1.1 B1 完成后基线（2026-11-07，已实测）

| 项 | 值 |
| --- | --- |
| 数据版本 | `CURRENT_VERSION = 2`（v1 自动迁移，先备份，不静默重置） |
| 数据层测试 | `npm run test:data` **46/46 通过**（原 40 + 新增迁移/审计/身份/待办/提醒 6 项） |
| 生产构建 | `npm run build` **通过**（21 条已知无害警告） |
| 开发服务 | `npm run serve` 正常；浏览器实测 v1→v2 迁移零丢失、身份恢复、待办/提醒/审计接口可用 |
| 已消除缺陷 | ① 迁移不丢数据（备份 + 逐级迁移 + 拒绝降级）② 审计记录真实操作人/角色 ③ 身份/角色持久化 |
| 仍待后续 | ④ 菜单按角色过滤与 Mock 权限校验（B2）⑤ AI 层（B3+） |

### 1.2 B2 完成后基线（2026-11-07，已实测）

| 项 | 值 |
| --- | --- |
| 数据版本 | `CURRENT_VERSION = 3`（v2 自动迁移：合并新增菜单、补待办描述；先备份） |
| 数据层测试 | `npm run test:data` **55/55 通过**（B1 46 + B2 权限域/工作台/时间线/审计只读/待办描述 9 项） |
| 生产构建 | `npm run build` **通过** |
| E2E | `npm run e2e` **27/29 通过**；2 项失败均为「排班冲突校验」，属**既有 E2E 日期敏感缺陷**（脚本假设当前月 2026-10，实际 2026-11），非 B2 回归；排班冲突逻辑由数据层测试覆盖 |
| 浏览器实测 | 管理员/医生/收费员三工作台、菜单过滤、路由 403、API 403、待办 CRUD、提醒确认与自动完成、患者时间线、审计差异与对象回放、刷新恢复，全部通过 |
| 已消除缺陷 | ④ 菜单按角色过滤 + 路由守卫 + Mock API 权限校验；分角色工作台、待办/提醒 UI、患者时间线、审计中心落地 |
| 仍待后续 | ⑤ AI 层（B3+） |

### 1.3 B3 完成后基线（2026-11-10，已实测）

| 项 | 值 |
| --- | --- |
| 数据版本 | `CURRENT_VERSION = 5`（v3→v4 增 AI 治理中心菜单；v4→v5 增 AI 应用菜单与角色授权；均先备份、只增不删） |
| 数据层测试 | `npm run test:data` **72/72 通过**（B3 新增 11 项 AI 基础设施断言，原数据层用例全部不回退） |
| AI 任务测试 | `npm run test:ai`（B4/B5 用例持续补充，B3 用例在数据层套件内） |
| 生产构建 | `npm run build` **通过** |
| 浏览器实测 | `/ai/center` AI 治理中心：开关、Provider 状态、Guardrails 清单、自检（写入 `aiEvents`）、任务注册表、审计事件筛选/采纳，全部通过 |
| AI 基础设施 | `src/ai/`：Provider 抽象（本地确定性引擎默认、外部 LLM 骨架禁用）、只读 selectors、上下文脱敏、Guardrails G1–G7、`aiEvents` 审计、运行时开关 |
| 仍待后续 | B4 AI 应用、B5 流程预测 |

### 1.4 B4/B5 完成后基线（2026-11-10，已实测）

| 项 | 值 |
| --- | --- |
| 数据版本 | `CURRENT_VERSION = 5`（无新增结构变更；B4/B5 仅新增任务/页面/集成代码） |
| 数据层测试 | `npm run test:data` **72/72 通过** |
| AI 任务测试 | `npm run test:ai` **49/49 通过**（助手 12 + 异常 11 + 报表 9 + 病历结构化 9 + 预测 8） |
| 生产构建 | `npm run build` **通过** |
| E2E | `npm run e2e` **48/48 通过、控制台零错误**（含 B3/B4/B5 AI 页面、W1/W2/W3 修复回归；已修复原「排班冲突」日期敏感缺陷，见 `DECISIONS D25`） |
| 浏览器实测 | `/ai/assistant`、`/ai/anomaly`、`/ai/reports`、`/ai/forecast`、`/ai/center`、工作台预测面板、待办 AI 建议、提醒 AI 解释、接诊弹窗病历结构化（含 AI 关闭 503 无副作用），全部通过 |
| 仍待后续 | 无（B3/B4/B5 全部完成；外部真实 LLM 接入为可选项，需后端/代理） |

---

## 2. 批次看板

### 批次 1 · 业务基础与数据安全基座 — ✅ 已完成（2026-11-07）

| 任务 | 状态 | 实现要点 / 关键文件 |
| --- | --- | --- |
| T1.1 版本化增量迁移框架 + 迁移测试 | ✅ | `db.js` `load()` 重写：`MIGRATIONS`（1→2）、`backupRaw` 备份到 `astra_hospital_db_v1_backup_v<v>`、版本更高拒绝降级、损坏先备份再兜底；`seed.js` version=2；`tests/data/suite.js` 迁移用例 |
| T1.2 结构化审计 `auditEvents` + 真实操作人 | ✅ | `recordAudit()`/`currentActor`/`setActorByToken`；导出层统一包装（`AUDIT_WRAP`）在成功写操作后记录 actor/role/entity/before/after（剔除 password/token）；`seed.js`/`mock`/`api`/查询接口 `queryAudit` |
| T1.3 身份/角色持久化与复原 | ✅ | `db.profileOf(token)`/`permissionsOf`；`store/user` 增 `restore()`；`router.beforeEach` 刷新后按 token 复原；`api.getProfile`（token 走查询参数） |
| T1.4 待办 `todos` / 提醒 `reminderAcks` / 规则引擎 | ✅ | `createTodo/updateTodo/setTodoStatus/deleteTodo/suggestTodoPriority`；`computeReminders/reminderSummary/acknowledgeReminder/snoozeReminder`（低库存/床位占用/待报告/待发药/待执行医嘱/临期/未缴费；完成由规则成立与否决定） |
| T1.5 `StatusTag` 状态色扩展 | ✅ | 增加 未完成/处理中/已读/高/中/低 映射 |

> B1 验收门：见 §3「批次 1 验收清单」（全部已勾选）。

### 批次 2 · 分角色工作台与四大业务创新 — ✅ 已完成（2026-11-07）

| 任务 | 状态 | 实现要点 / 关键文件 |
| --- | --- | --- |
| T2.1 分角色工作台（医生/收费员/管理员） | ✅ | 新 `views/workbench/index.vue`（`/dashboard` 首页），`db.workbenchSummary()` 按角色聚合；管理员嵌入原 Dashboard 运营概览；KPI/队列/快捷入口按角色与权限动态渲染 |
| T2.2 角色菜单过滤 + 路由守卫 + Mock 层权限校验 | ✅ | `utils/perm.js`（hasMenu/hasDomain/filterMenuTree）；`layout` 过滤菜单；`router` 每路由 `menuCode` + 守卫跳 `/403`；`mock/index.js` `guardedMock`/`apiGuard` 按当前登录角色域校验（客户端无法参数提权） |
| T2.3 智能待办与系统提醒 UI | ✅ | `views/workbench/TodoCenter.vue`（CRUD/描述/截止/模块/优先级建议/筛选排序/统计）、`ReminderCenter.vue`（触发原因/状态/关联/入口/确认/暂缓）；`db` 增待办 description；提醒完成仍由规则决定 |
| T2.4 患者全流程时间线（只读） | ✅ | `db.patientTimeline()` 聚合挂号/接诊/处方/检查/报告/收费/入院/医嘱/结算 + 转床审计事件；`views/patients/Timeline.vue`（正倒序/环节筛选/进度/节点详情/跳转）；患者档案与入院记录增入口 |
| T2.5 操作审计与流程回放（只读） | ✅ | `views/system/AuditCenter.vue`（多条件筛选/分页/before-after 差异/按业务对象回放）；`mock` audit-events 增时间范围/角色/关键字筛选；保留旧 `OpLogList.vue` 兼容；无删除/重放执行入口 |
| T2.6 数据结构 v2→v3 迁移 | ✅ | `db.js` `MIGRATIONS[2]`：合并 patient-timeline/system-audit 菜单、补 todos.description；`seed.js` version=3；迁移测试覆盖 |

> B2 验收门：见 §3「批次 2 验收清单」（全部已勾选）。

### 批次 3 · AI 基础设施 — ✅ 已完成（2026-11-10）

| 任务 | 状态 | 关键文件 |
| --- | --- | --- |
| T3.1 AI Provider 抽象 + 本地确定性引擎 | ✅ | `src/ai/provider.js`、`src/ai/localProvider.js`、`src/ai/httpProvider.js`（骨架默认禁用） |
| T3.2 上下文构建（只读选择器 + 脱敏） | ✅ | `src/ai/contextBuilder.js`、`src/ai/selectors.js`（深拷贝 + 敏感字段剔除 + 权限域收敛） |
| T3.3 任务注册表 + Guardrail（no-write/schema/免责） | ✅ | `src/ai/taskRegistry.js`、`src/ai/guardrails.js`、`src/ai/tasks/{index,selftest,todoPriority,reminderExplain}.js` |
| T3.4 AI 审计 `aiEvents` + 开关配置 | ✅ | `src/ai/aiAudit.js`、`src/ai/config.js`、`db.recordAiEvent/queryAiEvents/aiEventStats`、`views/system/AiCenter.vue` |
| T3.5 Guardrail 单测 | ✅ | `tests/data/suite.js` B3 段（11 项：契约/schema/脱敏/开关/G1/G7/审计/统计） |

### 批次 4 · AI 应用 — ✅ 已完成（2026-11-10，依赖 B3）

| 任务 | 状态 | 关键文件 |
| --- | --- | --- |
| T4.1 AI 业务助手（只读问答） | ✅ | `src/ai/tasks/assistant.js`（`assistant.qa`）、`src/views/ai/Assistant.vue`（推荐问题/依据/入口/追问/免责/元信息） |
| T4.2 智能报表 | ✅ | `src/ai/tasks/report.js`（`report.summary` 五类报表）、`src/views/ai/Reports.vue`（tab/合计/摘要/CSV 导出） |
| T4.3 病历结构化（不覆盖原文，确认后走 `updateVisit`） | ✅ | `src/ai/tasks/recordStruct.js`（`record.structure`）、`VisitDialog.vue` 集成（仅追加诊断关键词 + 人工确认 + 标记采纳） |
| T4.4 运营异常分析 | ✅ | `src/ai/tasks/anomaly.js`（`anomaly.explain`）、`src/views/ai/Anomaly.vue`（级别筛选/处理入口） |
| T4.5 待办/提醒 AI 接入（B3 任务） | ✅ | `TodoCenter.vue`（`todo.priority` + 回退规则）、`ReminderCenter.vue`（`reminder.explain` 解释弹窗） |

### 批次 5 · 流程预测 — ✅ 已完成（2026-11-10，依赖 B3/B4）

| 任务 | 状态 | 关键文件 |
| --- | --- | --- |
| T5.1 预测引擎（门诊量/床位/出院/积压/爽约） | ✅ | `src/ai/tasks/forecast.js`（5 个 `forecast.*` 任务，确定性、区间、口径、免责） |
| T5.2 预测呈现与工作台集成 | ✅ | `src/views/ai/Forecast.vue`（5 卡片 + ECharts 趋势 + 区间/口径）、`src/views/workbench/index.vue`「明日运营预测」面板 |

---

## 3. 验收清单（每批次独立执行）

### 批次 1 验收清单（✅ 已全部通过，2026-11-07）
- [x] `npm run test:data` 全绿（原 40 项不回退 + 迁移/审计/提醒新增断言，共 46/46）。
- [x] 迁移测试：`version:1` 样本升级后每集合行数与 id 集合不变，新集合默认值存在，原键有备份。
- [x] 任一成功业务变更 → `auditEvents` 新增一条含真实 `actorName/actorRole/entityId`，不含密码。
- [x] 刷新后员工/角色由 token 复原，`layout` 显示真实姓名与角色（浏览器实测「周明远」）。
- [x] 规则提醒随数据变化自动出现/自动完成，不能仅凭关闭变更状态。
- [x] `npm run build` 通过；`npm run serve` 可登录、无阻断错误；浏览器实测 v1→v2 迁移零丢失。

### 批次 2 验收清单（✅ 已全部通过，2026-11-07）
- [x] 医生/收费员/管理员登录后**菜单与工作台不同**；越权路由（`/system/roles`）跳 `/403`；越权 API（`/api/staff`、`/api/roles`、`/api/admissions`）返回 403。
- [x] 待办增删改、优先级建议可采纳/调整；系统提醒可确认/暂缓，且问题解决后自动完成（执行医嘱 o6 后 pendingOrder 消失）。
- [x] 患者时间线只读、可正倒序/环节筛选、可跳转；审计中心只读、展示 before/after 差异、按对象回放，无删除/重放执行。
- [x] `test:data` 55/55 全绿；`build` 通过；`serve` 三角色浏览器实测；E2E 27/29（2 项为既有日期敏感缺陷，非 B2 回归）。

### 批次 3 验收清单（✅ 已全部通过，2026-11-10）
- [x] AI 服务层单测通过（provider 契约、上下文脱敏、schema 校验、开关关闭无副作用）——数据层套件新增 11 项断言。
- [x] 每次 AI 调用写入 `aiEvents`，不含敏感信息；默认零网络请求（`local-rule-engine`，静态断言无 axios/fetch/XHR）。
- [x] 静态/单测断言：AI 层无 `db.create*/update*/delete*` 等业务写引用（仅允许 `recordAiEvent`/`markAiEventAccepted` 审计写入）。
- [x] 原数据层用例全部不回退（现 72/72）；`build` 通过；`serve` + 浏览器实测 AI 治理中心自检/审计/开关正常。

### 批次 4 验收清单（✅ 已全部通过，2026-11-10）
- [x] 助手数值与 `db`/`stats()` 一致，含数据依据（`source`+`raw`）与免责声明（12 项用例覆盖数值一致性、权限收敛、未知回退、确定性）。
- [x] 智能报表可复算（rows 求和 = totals，与 selectors 聚合一致）、可导出 CSV（9 项用例）。
- [x] 病历结构化保留原文、未确认不写库、确认后走原校验（仅追加诊断关键词 + MessageBox 确认 + 原 `apiUpdateVisit`；9 项用例覆盖词典/否定语境/空输入/不改输入）。
- [x] 异常分析命中种子已知异常项（b12 检修床位、待报告积压、低库存 m4/m6/m10；11 项用例）。
- [x] 各应用均有 `aiEvents` 审计；`test:data` 72/72、`test:ai` 49/49、`build` 通过、`serve` 浏览器实测通过。

### 批次 5 验收清单（✅ 已全部通过，2026-11-10）
- [x] 预测含区间/口径/免责；固定 `demoToday=2026-08-28` 下可回归（8 项用例断言确定性、区间包含主值、series、只读）。
- [x] 预测仅建议、不自动改数据（用例断言预测前后业务数据 JSON 完全一致）；页面提供门诊挂号/入院登记/住院医嘱等跳转入口。
- [x] `test:data`/`test:ai`/`build`/`serve` 通过，预测单测覆盖；工作台集成「明日运营预测」面板。

---

## 4. 创新方向 ↔ 批次映射

| 创新方向 | 主要批次 | 说明 |
| --- | --- | --- |
| I1 智能待办与系统提醒 | B1（数据层）+ B2（UI） | 规则引擎在 B1，交互在 B2 |
| I2 操作审计与流程回放 | B1（审计事件）+ B2（回放 UI） | operator 真实化在 B1 |
| I3 患者全流程时间线 | B2（聚合只读，依赖 B1 数据） | 只读聚合 |
| I4 分角色工作台 | B1（身份持久化）+ B2（工作台/权限） | 权限演示级 |
| I5 AI 业务助手 | B3（地基）+ B4（应用） | 只读问答 |
| I6 运营异常分析 | B4 | 规则/统计 |
| I7 智能报表 | B4 | 聚合+摘要+导出 |
| I8 病历结构化 | B4 | 原文保留、人工确认 |
| I9 流程预测 | B5 | 建议型 |

---

## 5. 阻塞与变更记录

| 日期 | 类型 | 内容 |
| --- | --- | --- |
| 2026-11-07 | 初始 | 建立规划与状态看板；全部开发任务 ⬜ 未开始，B1 待启动；基线快照见 §1。 |
| 2026-11-07 | B1 完成 | 迁移框架(v1→v2)、结构化审计、身份持久化、待办/提醒引擎、API/Mock 路由完成；`test:data` 46/46、`build` 通过、浏览器实测迁移零丢失；见 §1.1/§2/§3。 |
| 2026-11-07 | B2 完成 | 分角色工作台、待办/提醒 UI、患者 360° 时间线、审计中心、RBAC（菜单/路由/Mock API）落地；v2→v3 迁移；`test:data` 55/55、`build` 通过、三角色浏览器实测；E2E 27/29（2 项既有日期敏感失败）；见 §1.2/§2/§3。 |
| 2026-11-10 | B3 完成 | AI 服务层（Provider 抽象/本地确定性引擎/只读 selectors/上下文脱敏/Guardrails G1–G7/`aiEvents` 审计/开关）、AI 治理中心页面、v3→v4 迁移；`test:data` 72/72、`build` 通过、浏览器实测自检与审计；见 §1.3/§2/§3。 |
| 2026-11-10 | B4 完成 | Ask Astra 助手、智能报表（5 类+CSV）、病历结构化（弹窗集成，仅追加+人工确认）、运营异常分析、待办/提醒 AI 接入；`test:ai` 49/49、`build` 通过、浏览器实测；见 §1.4/§2/§3。 |
| 2026-11-10 | B5 完成 | 5 个预测任务（门诊量/床位/出院/积压/爽约）与预测分析页（ECharts 趋势+区间+口径+免责）、工作台「明日运营预测」集成；v4→v5 AI 菜单授权；E2E 日期敏感缺陷修复；见 §1.4/§2/§3。 |
| 2026-11-11 | 缺陷修复 | 最终验收 W1/W2/W3/W5 修复：医技申请列表改为服务端 `hasExams` 分页前过滤（历史待报告可见、提醒可闭环）、医技项目下拉补 `category`（消除 undefined）、病历结构化「应用建议/标记采纳」增加持久反馈（人工确认不变）、AI 任务数量文档更正；E2E 新增第 14 节回归，`test:data` 72/72、`test:ai` 49/49、`build` 通过、`e2e` 48/48；见 `acceptance/ASTRA_FINAL_ACCEPTANCE_REPORT.md` §10 与 `HANDOVER §18.11`。 |

> 记录约定：每次批次启动/完成、验收结果、阻塞与范围调整，追加一行到本表，并同步更新 §2 对应任务状态。
