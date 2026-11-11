# 医院业务管理系统 · 架构决策记录（DECISIONS / ADR）

> 文档性质：**长期决策依据**。采用 ADR（Architecture Decision Record）形式，记录重要决策的背景、选项、决定与影响。重大变更须追加条目而非覆盖。
> 建立时间：2026-11-07。配套 `docs/INNOVATION_PLAN.md`、`docs/AI_ARCHITECTURE.md`、`docs/IMPLEMENTATION_STATUS.md`。

> 状态词：`已接受` / `提议中` / `已废弃` / `被取代`（被取代需注明替代条目）。

---

## D1 · 保持现有技术栈锁定

- **日期**：2026-11-07
- **状态**：已接受
- **背景**：项目为 Vue2 + Vue CLI5 + Element UI 2.15 + Router3 + Vuex3 + Mock.js 的纯前端演示，已在真实代码与截图中定型。
- **决定**：所有创新批次**保持现有技术栈**，不引入 Vue3/Vite/Element Plus/Pinia/TypeScript，不升级既有依赖。
- **理由**：降低回归风险、保持与截图/交接文档一致、避免牵动全部页面迁移。
- **影响**：AI/报表按现有 Vue2 组件与 ECharts 实现；新页面沿用 `listPage`/`StatusTag`/`Pagination` 范式。
- **替代方案**：升级 Vue3（否决，成本高、超范围）。

---

## D2 · 数据采用版本化增量迁移，禁止“版本不符即重播种”

- **日期**：2026-11-07
- **状态**：已接受
- **背景**：现 `db.js` `load()`（L50-73）在 `parsed.version !== CURRENT_VERSION` 或结构缺失时**直接 `buildSeed()` 重播种**，会清空用户 localStorage 数据。
- **决定**：建立 `MIGRATIONS` 版本链：升级前先备份原串到 `astra_hospital_db_v1_backup_v<old>`，再**逐级增量迁移**（只增不删、补默认、回填派生）；`parsed.version > CURRENT_VERSION` 时**拒绝降级并保留原数据**；仅损坏/不可解析才回退种子且先备份。保留存储键 `astra_hospital_db_v1`。
- **理由**：满足开发原则 #5「保留 localStorage 原有数据」与安全要求。
- **影响**：B1 首要任务；每次新增集合/字段须登记迁移步骤并补迁移测试；`resetAll()` 仍重建**最新版本**种子。
- **风险**：迁移写错→数据损坏；以“先备份 + 逐级 + 零丢失测试”缓解。

---

## D3 · 审计采用独立 append-only `auditEvents`，保留旧 `logs`

- **日期**：2026-11-07
- **状态**：已接受
- **背景**：现有 `logs` 仅 `operator/action/target/time/ip`，operator 硬编码「系统管理员」，无实体/前后状态，无法支撑流程回放。
- **决定**：新增 `auditEvents` 集合（append-only），字段含 `actorStaffId/actorName/actorRole/action/entityType/entityId/entityCode/summary/before/after/refs/result/ip`；新增 `recordAudit()` 辅助；业务成功变更时写入；**保留 `logs`** 供旧“操作日志”页展示（兼容）。
- **理由**：非破坏性演进；回放/时间线需要结构化实体与状态摘要；避免重写全部日志 UI。
- **影响**：涉及 30+ 业务函数逐步迁移；密码等敏感字段永不入审计。
- **替代方案**：直接扩展现有 `logs`（否决，语义混杂、兼容风险高）。

---

## D4 · 身份/角色持久化：token 复原员工快照

- **日期**：2026-11-07
- **状态**：已接受
- **背景**：`store/modules/user.js` 仅内存保存 `staff`，`auth.js` 只持久 token（`mock-token-<id>`）；刷新后 `staff=null`，`layout` 回退「系统管理员」，无法按角色渲染工作台。
- **决定**：新增按 token/id 复原员工与角色的只读查询（如 `db.profileOf(token)` / `getStaffProfile(id)`）；应用启动或 `layout` 创建时若 `staff` 为空则复原；`store/user` 增 `restore()`。
- **理由**：为分角色工作台与权限守卫提供稳定身份来源；避免明文持久密码。
- **影响**：B1 实现；复原信息剔除密码；token 与 id 的映射保持在 `mock-token-<id>` 约定。

---

## D5 · RBAC 为演示级，实现“菜单过滤 + 路由守卫 + Mock 层校验”纵深雏形

- **日期**：2026-11-07
- **状态**：已接受
- **背景**：`layout` 无条件渲染全量菜单；`router.beforeEach` 只校验 token；`roles.menuCodes` 仅数据演示。纯前端无法提供真实安全边界。
- **决定**：按 `role.menuCodes` 过滤菜单与工作台；路由 `meta.menuCode`/`meta.roles` 做前端守卫；**Mock 层对越权请求返回拒绝**（演示“后端也校验”，不可仅靠隐藏菜单）。
- **理由**：贴近真实业务分工；满足创新点“后端同样校验”表述；同时明确演示边界。
- **影响**：`seed.js` 的 roles 需与菜单 code 对齐；工作台入口与可见数据由角色决定。

---

## D6 · AI 默认本地确定性引擎，外部 LLM 可选且默认禁用、零密钥

- **日期**：2026-11-07
- **状态**：已接受
- **背景**：纯前端演示、无后端与密钥；需可测试、可复现、不影响构建与其它批次。
- **决定**：`src/ai/` 提供 Provider 抽象；默认 `LocalRuleEngineProvider`（离线确定性）；`HttpLLMProvider` 仅骨架、默认关闭；密钥只可放 `.env.local`（已被忽略），不入库；默认零网络。
- **理由**：可复现测试、无外部依赖与合规风险；保留未来接入真实 LLM 的扩展点。
- **影响**：B3 起生效；见 `AI_ARCHITECTURE.md`。

---

## D7 · AI 只读 + 提案，写操作必须走原有业务校验

- **日期**：2026-11-07
- **状态**：已接受
- **背景**：开发原则 #6「AI 不得绕过原有业务校验直接修改数据」。
- **决定**：AI 层不引入任何写能力（不引用 `db.create*/update*/delete*`，不持有 `state`，不 `persist()`）；AI 只输出建议/结构化提案/只读分析/预测；落地写操作由用户在既有 UI 触发，经原 `db.*` 校验执行。
- **理由**：保证业务规则（状态机、金额整数分、引用保护）不被 AI 绕过；可控可审计。
- **影响**：AI 模块单测须断言“无写引用”；病历结构化不覆盖原文（见 D10）。

---

## D8 · 金额一律整数分（沿用）

- **日期**：2026-11-07
- **状态**：已接受（沿用现有规则）
- **决定**：数据层所有金额字段以整数“分”存储与计算；展示用 `utils/money.js` 转元；AI/报表/预测上下文保留整数分，展示再转元；**禁止浮点累加金额**。
- **影响**：新增报表/预测/待办金额字段必须整数分；测试须校验。

---

## D9 · 系统提醒由规则实时计算，解决即自动完成，不可仅“关闭”

- **日期**：2026-11-07
- **状态**：已接受
- **背景**：创新点 I1 要求“对应问题解决后自动标记完成，不能仅通过关闭提醒视为已解决”。
- **决定**：系统提醒来自 `computeReminders()` 规则实时评估（库存阈值、床位占用率、待报告、待发药、待执行医嘱、库存临期、未缴费挂号等）；`reminderAcks` 仅记录“确认/稍后”，**完成状态由规则不再成立决定**。AI 仅解释与建议，判定阈值均为模拟规则。
- **影响**：B1 数据层 + B2 UI；新增规则须补测试。

---

## D10 · 病历结构化不覆盖原文，需人工确认

- **日期**：2026-11-07
- **状态**：已接受
- **决定**：自由文本（主诉/现病史/诊断/处理意见）解析为结构化**建议**；原文只读保留；确认后作为附加字段或表单回填，经 `db.updateVisit` 原有校验写入；附“演示、非诊疗结论”免责。
- **影响**：B4 实现；`updateVisit` 的“已收费不可改”等规则仍生效。

---

## D11 · `demoToday` 固定 `2026-08-28`

- **日期**：2026-11-07
- **状态**：已接受（沿用现有规则）
- **决定**：保持种子与首页/排班/挂号/预测口径的“今天”为 `2026-08-28`，以稳定视觉与测试复现。预测/异常基于该基准前 7 日数据。
- **影响**：预测与统计测试以固定基准断言；若未来改真实日期，需整体调整种子并更新测试。

---

## D12 · 测试基线扩展策略

- **日期**：2026-11-07
- **状态**：已接受
- **背景**：`tests/data/suite.js` 40 项依赖种子结构与 `counters`；新增集合/规则易致脆弱。
- **决定**：每次新增/修改业务规则或集合**必须同步**：`seed.js`（种子+counters）→ `db.js`（load 校验/CRUD/业务）→ `mock/index.js`（路由/enrich）→ `api/index.js` → 页面 → `tests/data/suite.js` 断言；每批次 `test:data` 全绿方可验收；关键交互补 `tests/e2e`。
- **影响**：保证回归可测；迁移/审计/AI 护栏各有专项测试。

---

## D13 · 规划阶段不改业务代码

- **日期**：2026-11-07
- **状态**：已接受
- **决定**：本轮仅完成项目审查与规划文档（`docs/*` 与 HANDOVER 更新），**不修改任何业务代码**；实际编码从下一轮 B1 开始，按 `IMPLEMENTATION_STATUS.md` 推进。
- **影响**：当前代码保持基线 `85251fe` 状态；规划文档为后续开发唯一依据。

---

## D14 · B1 实施：Mock.js 无 headers，身份复原改用查询参数

- **日期**：2026-11-07
- **状态**：已接受（B1 实施）
- **背景**：本项目 Mock.js 版本传给路由 handler 的 `options` 仅含 `url/type/body`，**不含 headers**，无法从请求头读取 token。
- **决定**：`/auth/profile` 通过查询参数 `?token=` 传递 token；进入页面时 `store/user.restore()` 调 `apiGetProfile()`，Mock 侧 `setActorByToken(token)` 顺带设置当前操作人；登录时 `login()` 设置 `currentActor`。写操作审计据此得到真实操作人/角色。
- **理由**：在不改 Mock 机制、不引入真实后端的前提下，实现刷新后身份复原与真实操作人审计。
- **影响**：token 以查询参数出现在本地请求（演示范围可接受，不构成真实安全）；若未来替换 Mock/引入后端，应改回 Authorization 头。
- **替代方案**：升级/替换 Mock.js 以支持 headers（超范围，暂不做）。

---

## D15 · B1 实施：审计采用“导出层统一包装”而非逐函数改造

- **日期**：2026-11-07
- **状态**：已接受（B1 实施）
- **背景**：30+ 业务函数，逐个改 `addLog` 风险高且易漏。
- **决定**：业务函数保持不变，在 `module.exports` 上对写操作统一包装（`AUDIT_WRAP`）：调用成功后 `recordAudit` 记录真实 `actorName/actorRole/entityType/entityId/before/after` 并 `persist()`；旧 `logs` 保留兼容。前后摘要剔除 `password`/`token`。
- **影响**：审计覆盖面全、侵入小；`before` 仅对“按 id 更新”的函数采集（创建为 null）；**新增写函数须登记到 `AUDIT_WRAP`**。
- **替代方案**：逐函数手工埋点（易漏，否决）。

---

## D16 · B1 实施：迁移逻辑内置于 db.js（暂不拆独立文件）

- **日期**：2026-11-07
- **状态**：已接受（B1 实施）
- **背景**：规划曾建议 `src/mock/migrations.js`。
- **决定**：`MIGRATIONS`/`backupRaw`/`migrateToCurrent` 内置于 `db.js`；新集合（`auditEvents/todos/reminderAcks/aiEvents`）与 counters 同步进 `seed.js`。
- **影响**：迁移集中、可测；后续版本在 `db.js` 追加 `MIGRATIONS[n]` 即可，必要时再抽离。

---

## D17 · B2 实施：演示级 RBAC 采用三层校验，角色取自登录会话

- **日期**：2026-11-07
- **状态**：已接受（B2 实施）
- **背景**：B1 已持久化身份/角色；B2 需让权限真正生效，且不能只隐藏菜单。
- **决定**：
  1. **菜单过滤**：`utils/perm.js` `filterMenuTree` 按 `staff.menuCodes` 过滤侧栏；
  2. **路由守卫**：每个路由 `meta.menuCode`，`router.beforeEach` 无权限跳 `/403`；
  3. **Mock API 校验**：`mock/index.js` `guardedMock` + `apiGuard`，按 URL 映射业务域（basic/patient/outpatient/inpatient/system/home），角色取自 `db.getCurrentActor()`（由 token/login 确定），**不读取客户端传入的 role 参数**，故不能通过改前端参数提权。
  4. 页面入口用 `$can`/`v-perm` 控制。
- **理由**：满足“不允许只隐藏菜单而不检查 API 权限”，同时保持纯前端演示可运行。
- **影响**：权限为**演示级**，不构成真实后端安全隔离；越权 API 返回 403（拦截器提示），未登录返回 401；`/auth/*` 与 `options/*` 按需放行。
- **替代方案**：接入真实后端鉴权（超出纯前端 Mock 范围）。

---

## D18 · B2 实施：工作台与患者时间线使用只读聚合接口

- **日期**：2026-11-07
- **状态**：已接受（B2 实施）
- **背景**：工作台需按角色展示真实业务队列；患者时间线需跨模块聚合，且均不得修改业务数据。
- **决定**：新增只读聚合函数 `db.workbenchSummary(actor)` 与 `db.patientTimeline(patientId)`，经 `/workbench/summary`、`/timeline/patient/:id` 暴露（`home`/`patient` 域）。时间线优先使用业务记录，仅对“转床/取消/出院申请”等未存于业务实体的动作补充 `auditEvents`，事件按 `id` 去重、按时间排序，缺失时间显示“时间缺失”，**不虚构**。
- **影响**：聚合逻辑集中在数据层、可 Node 直测；AI 后续（B3/B4）可复用同一只读选择器，不得借聚合接口写库。
- **替代方案**：前端多接口拼装（数据一致性与权限更难保证，否决）。

---

## D19 · B2 实施：数据结构 v2→v3 迁移（菜单合并 + 待办描述）

- **日期**：2026-11-07
- **状态**：已接受（B2 实施）
- **决定**：`CURRENT_VERSION` 2→3，`MIGRATIONS[2]`：向 `menus` 合并 `patient-timeline`、`system-audit` 节点（只增不删），为 `todos` 补 `description` 字段；`seed.js` version=3。迁移前备份 `astra_hospital_db_v1_backup_v2`。
- **影响**：旧数据（v1/v2）可逐级升级到 v3；迁移测试覆盖 v1→当前版本零丢失与新菜单存在。
- **替代方案**：仅改静态 `config/menu.js` 不动 `menus` 集合（会导致菜单权限页缺项，否决）。

---

## D20 · 已知问题：E2E「排班冲突校验」日期敏感（非 B2 回归）

- **日期**：2026-11-07
- **状态**：已知问题（待后续修复）
- **背景**：`npm run e2e` 27/29 通过；2 项失败在「5. 排班冲突校验」。
- **原因**：`tests/e2e/run.js` 第 5 节假定“当前月份为 2026-10”，固定点击两次上一月到 2026-08 再选 28 日；实际系统日期为 2026-11，回退两次到 2026-09，未命中已有排班，故未触发冲突、提交成功导致关闭弹窗后找不到“取消”按钮。
- **判定**：**非 B2 回归**——B2 未改动排班页面/逻辑；排班冲突规则由 `test:data` 覆盖并通过。
- **后续**：建议将该用例改为按 `demoToday` 动态计算回退月数（或直接定位 2026-08 面板）后再启用；当前保留原样并如实记录。

---

## D21 · B3 实施：本地引擎同步链路、aiEvents 存储 API 与 AI 治理中心

- **日期**：2026-11-10
- **状态**：已接受（B3 实施）
- **背景**：`AI_ARCHITECTURE.md` 要求 Provider 统一 Promise 化，但本项目 Mock.js 1.1 的响应拦截层**无法 await** 异步返回值（返回 Promise 会被当作响应体序列化），而 B3 要求"默认离线、零网络、可测试"。
- **决定**：
  1. **默认 Provider（local-rule-engine）走同步链路**：`provider.generate()` 同步返回 `{text,data,confidence,basis,disclaimers}`；`aiService.runTask()` 同步返回结果，Mock 路由可直接 `wrap()`。外部 `http-llm` 仅保留骨架（默认禁用、无网络实现），若返回 Promise 则安全失败 `AI_ASYNC_UNSUPPORTED`，不阻塞业务。
  2. **aiEvents 存储 API**：`db.recordAiEvent/queryAiEvents/markAiEventAccepted/aiEventStats` 是 AI 层唯一允许的写入口（仅审计集合）；G1 静态断言禁止业务写函数（`db.create*/update*/delete*/persist/...`）。
  3. **运行时开关**：`VUE_APP_AI_ENABLED/VUE_APP_AI_PROVIDER/VUE_APP_AI_ENDPOINT` 为构建默认值；页面开关仅覆盖 enabled/provider，存于非业务偏好键 `astra_ai_prefs`（不写入业务数据、不含密钥）。关闭时 `runTask` 在构建上下文前短路，零副作用（G6）。
  4. **AI 治理中心页面**：新增 `views/system/AiCenter.vue`（`/ai/center`）作为 B3 可验证入口：开关、Provider 状态、Guardrails 清单、自检（写 `aiEvents`）、任务注册表、审计事件筛选与采纳标记。
  5. **权限**：AI API 归入 `home` 域（登录即可调用，只读）；`ai-center` 菜单仅管理员（`*`）可见；B4/B5 应用菜单按角色授权（见 D22）。
- **影响**：`src/ai/**` 全部 CommonJS（可被 Node/Jest 直测）；AI 层不 import ES 模块、不使用 `@/` 别名；任务由 `tasks/index.js` 统一注册；新增 AI 任务必须声明 `readOnly:true` 与 `outputSchema`。
- **替代方案**：改用真实后端或升级 Mock.js 以支持异步（超出纯前端演示范围，否决）。

---

## D22 · B3/B4 实施：数据版本 v3→v4→v5 与 AI 菜单/角色授权

- **日期**：2026-11-10
- **状态**：已接受（B3/B4 实施）
- **决定**：
  1. `CURRENT_VERSION` 3→4（B3）：`MIGRATIONS[3]` 新增「AI 智能中心」菜单分组与 `ai-center` 节点；确保 `aiEvents` 集合存在（B1 已建）。
  2. `CURRENT_VERSION` 4→5（B4/B5 共用）：`MIGRATIONS[4]` 新增 `ai-assistant`、`ai-report`、`ai-anomaly`、`ai-forecast` 四个应用菜单，并按角色**只增不删**追加授权：DOCTOR/CASHIER/RESIDENT 增 `ai-assistant`、`ai-forecast`；HEAD_NURSE 增 `ai-assistant`、`ai-anomaly`、`ai-forecast`；`ai-report` 仅超级管理员（`*`）可见。
  3. `seed.js` 与迁移结果保持一致（version=5）；`config/menu.js` 同步 AI 菜单分组。
- **理由**：AI 应用菜单属一次性结构变更，B5 只新增代码（预测任务与页面）不改变数据结构，故合并为一次迁移，减少迁移链复杂度。
- **影响**：旧数据 v1–v4 可逐级升级到 v5（迁移测试覆盖 v1→v5 零丢失 + AI 菜单存在）；菜单权限页可对 AI 菜单单独授权。

---

## D23 · B4 实施：四个 AI 应用的输出契约与落地边界

- **日期**：2026-11-10
- **状态**：已接受（B4 实施）
- **决定**：
  1. **`assistant.qa`**：确定性关键词意图识别（顺序敏感，先具体后通用）；数值结论必须给出带 `source`（如 `stats.todayRegCount`）与 `raw`（数值，金额整数分）的 `basis`，便于与 `db.stats()`/selectors 核对；`actions` 最多 3 条且为现有路由；按 `ctx.actor.domains` 收敛权限，越权问题直接回答"无权限"；未识别问题给能力说明 + `followups`。
  2. **`report.summary`**：五类报表（revenue/department/doctor/medicine/bed），`rows` 求和严格等于 `totals`；金额保持整数分，`columns[].money=true` 由 UI 用 `fmtMoney` 转元；CSV 导出用 `utils/csv.js`，金额转元字符串；未知类型回退 revenue。
  3. **`record.structure`**：关键词/正则规则解析（症状/病程/诱因/过敏/诊断关键词/风险提示），识别否定语境（"无发热"）；**不覆盖原文**；`VisitDialog` 仅在用户确认后把缺失诊断关键词追加到"诊断"字段，保存仍走原 `apiUpdateVisit` 校验；解析结果附 `MEDICAL` 免责；采纳后标记 `aiEvents.accepted`。
  4. **`anomaly.explain`**：演示阈值（库存 <50 高 / 50–199 中、停用床位、待报告/医嘱/收费/发药积压、占用率 >80%、临期 ≤30 天、未缴费挂号、待入科/待结算），按 high>medium>low 排序并附处理入口；阈值口径写入 `reason`。
  5. **待办/提醒 AI 接入**：`TodoCenter` 优先调用 `todo.priority`（失败回退数据层同口径规则）；`ReminderCenter` 增加只读 `reminder.explain` 解释弹窗，"采纳"仅标记审计，不改变提醒状态（D9 不变）。
- **影响**：所有 AI 调用统一写 `aiEvents`；`/ai/events/:id/accept` 记录采纳；页面错误分支处理 503（AI 关闭）与 400（任务/参数错误）。

---

## D24 · B5 实施：预测任务口径与工作台集成

- **日期**：2026-11-10
- **状态**：已接受（B5 实施）
- **决定**：新增 5 个确定性预测任务（`forecast.outpatient/beds/discharge/backlog/noshow`），统一输出 `{value, unit, range[2], method, confidence, note, series[], disclaimers[]}`：
  1. 次日门诊量：近 7 日 `regCount` 加权移动平均（权重 1,1,1,1.5,1.5,2,2），四舍五入，区间 ±max(1,20%)；
  2. 次日床位需求：占用 + 待入科 + `ceil(近 7 日新增入院/7)` − 预计出院，区间 ±1；
  3. 未来 3 日预计出院：待结算 + 在院且住院天数 ≥ 平均住院日−1；
  4. 次日积压：待执行医嘱 + 待发药处方 + 待出报告，区间 ±2；
  5. 爽约风险率：近 7 日退号/挂号×100（1 位小数），区间 ±2。
- **理由**：纯前端、无历史训练数据，采用可解释的统计口径；`demoToday=2026-08-28` 固定，便于回归。
- **影响**：预测仅建议、不写数据（用例断言预测前后业务数据 JSON 一致）；`/ai/forecast` 页面与工作台「明日运营预测」面板消费；`confidence` 由样本量决定（0.5–0.8）。

---

## D25 · 修复 E2E「排班冲突校验」日期敏感缺陷（关闭 D20）

- **日期**：2026-11-10
- **状态**：已接受（B3–B5 验收期间修复）
- **背景**：D20 记录的 2 项 E2E 失败源于脚本硬编码"当前月 2026-10 回退两月到 2026-08"。
- **决定**：新增 `gotoCalendarMonth(page, year, month)`：读取日历面板实际年月（`.el-date-picker__header-label`），按差值点击"上一月/下一月"（`prev/next` 第 2 个按钮）直到 2026-08，再选 28 日；不依赖系统当前日期。
- **影响**：E2E 该用例恢复通过；同时新增第 13 节 AI 页面 E2E（治理中心自检、助手问答、异常命中、报表合计、预测与工作台面板），第 12 节页面冒烟从 25 页扩到 30 页。

---

## 变更记录

| 日期 | 条目 | 变更 |
| --- | --- | --- |
| 2026-11-07 | D1–D13 | 初始建立 |
| 2026-11-07 | D14–D16 | B1 实施决策：Mock 无 headers→token 经查询参数、审计导出层包装、迁移内置于 db.js |
| 2026-11-07 | D17–D20 | B2 实施决策：三层演示级 RBAC、只读聚合接口、v2→v3 迁移、E2E 日期敏感已知问题 |
| 2026-11-10 | D21–D22 | B3/B4 实施决策：本地引擎同步链路与 aiEvents 存储 API、AI 治理中心、运行时开关、v3→v4→v5 迁移与 AI 菜单角色授权 |
| 2026-11-10 | D23–D25 | B4/B5 实施决策：四个 AI 应用输出契约与落地边界、5 个预测任务口径与工作台集成、E2E 日期敏感缺陷修复（关闭 D20） |
