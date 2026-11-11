# 医院业务管理系统 · 长期智能化创新规划（INNOVATION PLAN）

> 文档性质：**长期开发依据**。本文件与 `docs/IMPLEMENTATION_STATUS.md`、`docs/AI_ARCHITECTURE.md`、`docs/DECISIONS.md`、`docs/HANDOVER.md` 共同构成项目后续开发的权威依据。
> 编制时间：2026-11-07。编制依据：仓库实际代码（`src/mock/db.js`、`src/mock/index.js`、`src/mock/seed.js`、`src/views/**`、`src/store/**`、`src/router/index.js`、`src/utils/**`、`tests/**`）+ `README.md` + `docs/HANDOVER.md` + `创新点记录`。

---

## 0. 一句话目标

在不改变现有技术栈、不破坏现有业务功能与 localStorage 数据的前提下，分 5 个批次为纯前端 Mock 医院管理系统叠加「智能待办、审计回放、患者时间线、分角色工作台、AI 业务助手、运营异常分析、智能报表、病历结构化、流程预测」等能力，做到**每个批次可独立测试/构建/验收**，AI 只做建议与只读分析、**永不绕过原有业务校验写数据**。

---

## 1. 现状基线（迁移审查结论，均为真实代码事实）

### 1.1 技术栈（锁定，不得更换）

Vue `2.7.16` + Vue CLI `5.0.8` + Element UI `2.15.14` + Vue Router `3.6.5`（hash 模式）+ Vuex `3.6.2` + Axios `1.7.9` + ECharts `5.6.0` + Mock.js `1.1.0` + SCSS；测试 Jest（`@vue/cli-plugin-unit-jest`）+ puppeteer-core。运行环境 Node ≥ 18（本机 v24.21.0 / npm 11.19.0）。

### 1.2 架构分层（现状）

```
views/*.vue ──(api/index.js)──> utils/request.js ──(Mock 拦截)──> mock/index.js ──> mock/db.js ──> localStorage('astra_hospital_db_v1')
                                                    │                                  │
                                             响应信封 {code,msg,data}            seed.js（种子与 counters）
```

- **数据层 `src/mock/db.js`**（1533 行）：纯 CommonJS、单例 `state`、同步、无框架依赖，可被 Node/Jest 直测。所有写操作先校验后变更再 `persist()`，统一返回 `{ok:true,data}` / `{ok:false,error}`。
- **Mock 层 `src/mock/index.js`**（529 行）：`Mock.mock()` 注册路由，统一信封、`80–260ms` 延迟、`x-mock-fail` 失败模拟、关联字段 `enrich*`、`options/*` 下拉字典。
- **种子 `src/mock/seed.js`**（385 行）：`buildSeed()` 返回 `version:1` 的全量集合 + `counters`。
- **视图**：`dashboard`（592 行，`stats()` 实时指标 + ECharts）为首页；各业务列表页复用 `mixins/listPage.js`、`StatusTag`、`Pagination`。
- **测试**：`tests/data/suite.js`（**40 项断言**，`fresh()=db.resetAll()` 每场景重置）、`tests/unit/data.test.js`（Jest 包装）、`tests/e2e/run.js`（puppeteer-core，28 项、9 图截图、CDP 9333）。

### 1.3 现有可复用的“半成品”能力

| 现有能力 | 代码锚点 | 对创新的意义 |
| --- | --- | --- |
| 操作日志 `logs`（operator/action/target/time/ip，上限 500） | `db.js` `addLog()` L1321-1334；`OpLogList.vue` | 审计/回放的雏形，但**字段不足、operator 硬编码** |
| 角色与菜单数据 `roles.menuCodes` / `menus` | `seed.js` L275-325 | 分角色工作台的数据基础，但**未真正生效** |
| 首页指标 `stats()`（实时计算） | `db.js` L1390-1448 | 运营分析、智能报表、异常与预测的数据源 |
| 业务状态机（挂号/接诊/收费/发药/入院/结算） | `db.js` 全量业务函数 | 审计事件、患者时间线、规则提醒的业务语义来源 |
| ECharts 使用范式 | `views/dashboard/index.vue` | 报表/异常/预测可视化复用 |
| `StatusTag` 状态色映射 | `components/StatusTag.vue` L9-36 | 新增待办/提醒/异常状态需扩展映射 |

### 1.4 关键缺口（创新必须先补齐的“地基”）

1. **数据迁移缺失（高风险）**：`db.js` `load()`（L50-73）判断 `parsed.version === CURRENT_VERSION` 且必需数组存在，否则**直接 `buildSeed()` 重播种并写回**。即：**一旦提升 `CURRENT_VERSION`，用户 localStorage 现有数据会被清空重置**。→ 必须建立**版本化增量迁移框架**（见 §4、`DECISIONS D2`）。
2. **审计信息不足**：`addLog(operator, action, target)` 的 `operator` 在全部业务函数中**硬编码为「系统管理员」**（如 `createStaff` L279、`createVisit` L778 等），不记录真实操作人/角色，也无 `entityType/entityId/before/after/关联患者` 等结构化字段，无法支撑“流程回放”。
3. **身份/角色不持久**：`store/modules/user.js` 只在内存保存 `staff`；`auth.js` 只持久化 token（`mock-token-<id>`）。刷新后 `staff=null`，`layout/index.vue` `staffName` 回退「系统管理员」（L109-111）→ **无法在刷新后按角色渲染工作台**。需“按 token 复原员工+角色”。
4. **RBAC 仅演示、未生效**：`layout/index.vue` 无条件渲染全部 `menuTree`（L24-39）；`router/index.js` 的 `beforeEach`（L61-86）**只校验 token、无角色/权限校验**。→ 分角色工作台需实现“菜单过滤 + 路由守卫 + Mock 层权限校验”（演示级纵深防御）。
5. **完全没有 AI 层**：无任何 AI 服务、上下文构建、审计、脱敏或 Guardrail。

---

## 2. 创新方向总览（4 保留 + 5 新增）

> 所有 AI/医疗辅助功能均标注**演示边界**：数据为虚构、AI 仅为建议与只读分析、须人工确认、不得表述为真实诊断/治疗结论。

### 2.1 保留方向（用户明确要求）

| 编号 | 方向 | 目标 | 依赖现有代码 | 演示边界 |
| --- | --- | --- | --- | --- |
| I1 | **智能待办与系统提醒** | 个人待办 + AI 建议优先级并解释理由（用户确认/调整）+ 系统按规则生成提醒（库存低于阈值、床位占用率超限、报告待处理等），**问题解决后自动完成，不可仅靠关闭** | `stats()`、`medicines.stock`、`stocks.expiry`、`visits.reportStatus`、`orders.status` | 阈值均为模拟规则；AI 只排序/解释，不判定临床紧急程度 |
| I2 | **操作审计与流程回放** | 记录关键操作（操作人/角色/时间/对象/结果/状态变化摘要），按患者或业务记录只读回放 | `addLog` 需升级为结构化 `auditEvents`；业务状态机 | 只读，不重放执行；不记录密码等敏感信息 |
| I3 | **患者全流程时间线** | 以患者为主线串联挂号→接诊→处方/检查→住院→出院，标出当前进度、卡点，可正/倒序、按类别筛选 | `registrations→visits→admissions→orders→settlements→feeRecords` 关联 | 只读，不修改业务数据；不构成诊断结论 |
| I4 | **分角色工作台** | 医生/收费员/管理员登录进入各自工作台，展示本角色待办与常用操作，越权入口不展示且**Mock 层同样校验** | `roles.menuCodes`、`staff.role`、`stats()`、菜单/路由 | 角色权限为演示；演示级“后端校验”指 Mock 层校验 |

### 2.2 新增方向

| 编号 | 方向 | 目标 | 依赖现有代码 | 演示边界 |
| --- | --- | --- | --- | --- |
| I5 | **AI 业务助手** | 用自然语言问答查询/解释系统数据与业务规则，给出“结论 + 数据依据 + 建议操作入口” | 只读选择器封装 `db` 查询与 `stats()` | 只读；不得代替用户执行写操作；回答附免责声明 |
| I6 | **运营异常分析** | 基于阈值/统计（近 7 日趋势、库存、床位、积压）识别异常并解释，给出排查入口 | `stats().last7days`、`medicines/stocks`、`orders`、`visits` | 异常为规则/统计口径，非临床或经营定论 |
| I7 | **智能报表** | 生成收入结构/科室工作量/医生接诊量/药品消耗/床位周转等报表，含自然语言摘要，支持导出 | `stats()`、各集合聚合；`utils/csv.js` | 报表基于虚构演示数据 |
| I8 | **病历结构化** | 将主诉/现病史/诊断等自由文本解析为结构化字段（症状、病程、诱因、过敏、诊断关键词），供医生确认 | `visits.complaint/history/diagnosis/advice` | **不覆盖原文**；解析结果为建议，确认后经原 `updateVisit` 校验写入 |
| I9 | **流程预测** | 基于历史（`demoToday` 前 7 日）预测次日门诊量、床位需求、出院时机、医嘱/发药积压趋势、爽约风险 | `stats().last7days`、`admissions`、`orders`、`visits` | 输出区间+置信说明；仅建议，不自动改数据 |

---

## 3. 分批实施路线图

> 顺序遵循「业务基础 → 工作台 → AI 基础设施 → AI 应用 → 预测分析」。每批次结束必须独立通过 `npm run test:data`、`npm run build`、`npm run serve` 手测，并在相关处补 E2E。

```
B1 业务基础与数据安全基座
      │  (迁移框架 / 审计事件 / 身份角色持久化 / 待办与提醒数据层)
      ├──────────────► B2 分角色工作台 + 四大业务创新(UI 层)
      │                         │(消费 B1 数据)
      └──────────────► B3 AI 基础设施
                                │
                                ├──► B4 AI 应用（助手 / 智能报表 / 病历结构化 / 异常分析）
                                │
                                └──► B5 流程预测（预测分析）
```

| 批次 | 名称 | 核心交付 | 依赖 | 里程碑 |
| --- | --- | --- | --- | --- |
| B1 | 业务基础与数据安全基座 | 版本迁移框架、结构化审计事件、身份/角色持久化、待办与系统提醒数据层、状态色扩展 | 无 | 数据零丢失迁移可用；审计可写入 |
| B2 | 工作台与业务创新 | 分角色工作台、智能待办/提醒 UI、患者时间线、审计回放、角色菜单+路由+Mock 权限 | B1 | 三角色登录所见不同；四方向可用 |
| B3 | AI 基础设施 | AI 服务层（Provider 抽象 + 本地确定性引擎 + 上下文构建 + Guardrail + AI 审计 + 开关） | B1 | AI 可调用、可审计、可关闭、不写库 |
| B4 | AI 应用 | AI 业务助手、智能报表、病历结构化、运营异常分析 | B3 | 4 项 AI 应用可用且数据一致 |
| B5 | 预测分析 | 门诊量/床位/出院/积压/爽约预测与工作台集成 | B3 + B4 数据 | 预测结果可用、可解释、可回归 |

---

## 4. 数据安全迁移设计（贯穿各批次的硬约束）

> 对应开发原则 #5「保留 localStorage 原有数据，必须设计安全的数据迁移」，以及 `DECISIONS D2`。

- **保留存储键**：仍用 `astra_hospital_db_v1`（避免用户数据“换键即丢”）；`CURRENT_VERSION` 从 `1` 起**逐级递增**（B1 起版本将为 2）。
- **迁移框架**（拟新增于 `src/mock/db.js` 或抽出 `src/mock/migrations.js`）：
  1. `load()` 读取 `parsed.version`；
  2. 若 `parsed.version < CURRENT_VERSION`：**先备份**原串到 `astra_hospital_db_v1_backup_v<oldVersion>`（另存，不删原键），再**按 `MIGRATIONS[v]` 顺序执行增量迁移**（只增字段/集合、补默认值、回填派生字段，绝不删除已有行）；
  3. 迁移完成写回并记录 `migratedAt`、`migrationLog`；
  4. 若 `parsed.version > CURRENT_VERSION`（未来更高版本）→ **拒绝降级**，保留原数据并提示，不重播种；
  5. 仅当数据损坏/无法解析时才回退到 `buildSeed()`，且**先备份原始串**。
- **迁移必须可测**：新增「v1→v2（→v3…）」样本迁移测试，逐集合比对 `id` 集合与行数**零丢失**，关键业务字段一致。
- **新增集合必须**：`seed.js` 增加种子与 `counters`；`db.js` `load()` 校验字段按需加入；`mock/index.js` 注册路由与 enrich；`api/index.js` 暴露方法；页面消费；`tests/data/suite.js` 补断言（沿用 `HANDOVER §12` 的 7 步扩展法）。
- **重置语义**：`resetAll()` 始终重建**最新版本**种子（含新集合），与迁移互不干扰。

---

## 5. 各批次任务与验收标准

> 详细的逐任务状态与勾选见 `docs/IMPLEMENTATION_STATUS.md`。此处为**范围级**任务与验收。
>
> **状态更新（2026-11-10）**：B1–B5 全部完成并通过验收；本节的验收标准已由 `IMPLEMENTATION_STATUS.md` §3 逐项勾选，测试/构建/E2E/浏览器实测证据见 `docs/B3-B5_DELIVERY_REPORT.md`。

### 批次 1 · 业务基础与数据安全基座（Business Foundation）

**任务**
1. 实现版本化增量迁移框架（备份 + 逐级迁移 + 拒绝降级 + 损坏兜底），新增迁移单测（v1 样本无损升级）。
2. 新增结构化审计事件集合 `auditEvents`（append-only）：`{id,time,actorStaffId,actorName,actorRole,action,entityType,entityId,entityCode,summary,before,after,refs,result,ip}`；新增内部 `recordAudit()`；逐步把关键业务函数从硬编码 `addLog('系统管理员',…)` 改为写入真实操作人/角色与结构化字段（保留 `logs` 兼容旧 UI）。
3. 身份/角色持久化：新增 `db.profileOf(token)` 或 `getStaffProfile(id)`；前端启动时按 token 复原 `staff`（含 `role`、`menuCodes`）；`store/user` 增加 `restore()`；`layout` 不再回退「系统管理员」。
4. 待办与提醒数据层：新增 `todos`（个人待办，含 `prioritySuggested/aiReason/priorityConfirmed`）与 `reminderAcks`（提醒确认/稍后状态）；新增**规则提醒引擎** `computeReminders()`（库存阈值、床位占用阈值、待报告、待发药、待执行医嘱、库存临期、未缴费挂号等），**提醒完成以规则不再成立为准**。
5. 扩展 `StatusTag` 状态色映射（待办/提醒/异常相关状态）。

**验收标准**
- [ ] `test:data` 全绿（原 40 项不回退 + 新增迁移/审计/提醒断言）。
- [ ] 迁移测试：构造 `version:1` 样本 → 升级后**每集合行数与 `id` 集合不变**、新集合默认值存在。
- [ ] 任一成功业务变更后，`auditEvents` 新增一条含真实 `actorName/actorRole/entityId` 的记录，且**不含密码**。
- [ ] 刷新后员工与角色信息仍在（由 token 复原），`layout` 显示真实姓名/角色。
- [ ] 规则提醒随数据变化自动出现/自动完成（构造库存不足→补足→自动消失）且不能仅凭“关闭”改状态。
- [ ] `npm run build` 通过；`npm run serve` 可登录。

### 批次 2 · 分角色工作台与四大业务创新（Workbench）

**任务**
1. 分角色工作台：登录后按 `role.menuCodes` 渲染工作台（医生：待接诊/待出报告；收费员：待收费/待结算；管理员：待审核/异常提醒/维护入口）；快捷操作按角色裁剪。
2. 角色菜单过滤 + 路由守卫（`meta.menuCode` / `meta.roles`）+ **Mock 层权限校验**（越权请求返回 403/拒绝，演示级纵深防御）。
3. 智能待办与系统提醒 UI：待办 CRUD、AI 优先级建议与原因展示、用户确认/调整；系统提醒列表含触发依据与处理入口、解决自动完成。
4. 患者全流程时间线：只读患者旅程（时间/科室/角色/摘要/状态/跳转），正倒序、类别筛选。
5. 操作审计与流程回放：审计事件筛选/详情/状态变化摘要；按患者或业务记录只读回放；明确“不可重放执行”。

**验收标准**
- [ ] 三种角色登录后**可见菜单/工作台不同**；直接访问越权路由被拦截；构造越权 API 请求被 Mock 层拒绝。
- [ ] 待办可增删改，AI 优先级建议可采纳/改，系统提醒可跟踪至自动完成。
- [ ] 患者时间线与审计回放**只读**（无写库调用），节点可按时间排序并跳转到对应业务记录。
- [ ] `test:data`（原 + 新增）全绿；`build` 通过；`serve` 手测三角色；关键流程补 E2E。

### 批次 3 · AI 基础设施（AI Infrastructure）

> 详见 `docs/AI_ARCHITECTURE.md`。本批只建“地基与安全护栏”，不交付具体业务 AI 应用。

**任务**
1. 新增 `src/ai/` 服务层：`provider` 抽象（默认 `LocalRuleEngineProvider` 确定性离线；外部 `HttpLLMProvider` 仅骨架、默认禁用、无密钥）、`contextBuilder`（只读选择器 + 脱敏 + 金额分→元）、`taskRegistry`、`guardrails`（结构校验/免责声明/no-write）、`aiAudit`。
2. AI 审计集合 `aiEvents`；AI 开关与配置（`VUE_APP_AI_ENABLED` 等，默认本地引擎）；确保**默认零网络**。
3. Guardrail 单测：AI 无写库能力、输出符合 schema、上下文不含密码/敏感字段、开关关闭无副作用。

**验收标准**
- [ ] AI 服务层单测通过（provider 契约、上下文脱敏、schema 校验、禁用无副作用）。
- [ ] 每次 AI 调用产生 `aiEvents`（输入摘要/输出/provider/延迟/采纳状态），不含敏感信息。
- [ ] 架构上 AI 无任何 `db.create*/update*/delete*` 引用（静态检查/单测断言）。
- [ ] 现有 40 项数据测试不回退；`build`/`serve` 正常。

### 批次 4 · AI 应用（AI Applications）

**任务**
1. AI 业务助手：只读问答（“今天待接诊多少/哪些药品库存偏低/床位占用如何”等），输出“结论+数据依据+建议入口+免责”。
2. 智能报表：收入结构、科室工作量、医生接诊量、药品消耗、床位周转，含 AI 摘要与 CSV 导出。
3. 病历结构化：自由文本 → 结构化建议（症状/病程/诱因/过敏/诊断关键词），**不覆盖原文**，确认后经 `updateVisit` 原有校验写入。
4. 运营异常分析：阈值/统计识别异常并解释、给出排查入口。

**验收标准**
- [ ] 助手回答数值与 `db`/`stats()` 聚合一致，标注数据依据与免责声明。
- [ ] 报表数值可复算、导出成功。
- [ ] 病历结构化保留原文，未确认不写库，确认后走原业务校验；越权/非法值被拒。
- [ ] 异常分析能命中种子已知项（如 `b12` 检修停用、低库存药品、待报告积压）。
- [ ] 均有 `aiEvents` 审计；`test:data`/`build`/`serve` 通过。

### 批次 5 · 流程预测（Predictive Analytics）

**任务**
1. 预测引擎（基于 `demoToday` 前 7 日与当前状态，确定性、可回归）：次日门诊量、床位需求、出院时机、医嘱/发药积压趋势、挂号爽约风险。
2. 预测结果以“区间 + 说明 + 置信提示”呈现，集成工作台与提醒（仅建议）。

**验收标准**
- [ ] 预测输出含数值区间、口径说明、免责声明；固定 `demoToday` 下单测结果确定。
- [ ] 预测仅建议、不自动改数据；可从结果跳转相关业务页。
- [ ] `test:data`/`build`/`serve` 通过，预测相关单测覆盖。

---

## 6. 主要技术风险（详见 `DECISIONS.md` 与 `IMPLEMENTATION_STATUS.md`）

| # | 风险 | 影响 | 缓解 |
| --- | --- | --- | --- |
| R1 | 版本升级触发 `load()` 重播种 → **用户数据丢失** | 高 | 增量迁移框架 + 先备份 + 迁移测试 + 拒绝降级（B1 首务）|
| R2 | 审计改造涉及 30+ 业务函数，易漏/易错 | 中高 | 统一 `recordAudit()` 辅助 + 逐模块迁移 + 断言覆盖 |
| R3 | RBAC 纯前端无法真正安全 | 中 | 明确演示边界；实现 Mock 层校验作为“后端校验”雏形 |
| R4 | AI 越权修改数据 | 高 | 架构隔离（AI 只读+提案）+ 静态/单测断言无写能力 + 人工确认 + 走原校验 |
| R5 | 外部 LLM 依赖（网络/密钥/合规/可复现） | 中 | 默认本地确定性引擎、外部 Provider 默认禁用、无密钥入库、测试零网络 |
| R6 | 测试脆弱（40 项依赖种子结构与计数器） | 中 | 新增集合同步 seed/counters/load 校验；迁移与规则变更必补断言 |
| R7 | 刷新丢失 staff/role（现有缺陷） | 中 | B1 身份持久化 |
| R8 | Vue2 已 EOL / 包体积增长 | 低中 | 保持锁定版本；按需懒加载 AI/报表模块 |
| R9 | 病历结构化误解析被当成结论 | 中 | 不覆盖原文、人工确认、免责声明、标注“演示” |

---

## 7. 开发原则（对全部批次的硬约束）

1. **保留原有技术栈与业务功能**：不引入 Vue3/Vite/Element Plus/Pinia/TS；不升级既有依赖。
2. **一切创新结合实际代码**，禁止纯概念设计；每个方向须落到具体集合、函数、页面。
3. **按批次独立测试/构建/验收**，未通过不进下一批。
4. **保留 localStorage 原有数据**，任何结构变更走迁移框架。
5. **AI 不得绕过原有业务校验直接修改数据**：AI 只产出建议/只读分析，写操作必须走原有 `db.*` 校验；AI 层不引入写能力。
6. **金额一律整数分**，日期一律 `'YYYY-MM-DD'`，`demoToday` 保持 `2026-08-28`。
7. **不执行 `git push`、不执行 `npm audit fix`、不修改无关目录。**
8. 所有 AI/医疗辅助功能标注演示边界与免责声明。

---

## 8. 交付物与维护

- 本文件：方向与路线图（长期）。
- `docs/IMPLEMENTATION_STATUS.md`：逐任务状态、验收勾选、基线快照（随开发更新）。
- `docs/AI_ARCHITECTURE.md`：AI 分层架构与安全红线（B3 起为强制依据）。
- `docs/DECISIONS.md`：ADR 决策记录（新增重要决策需追加）。
- `docs/HANDOVER.md`：面向接手方总览（已增加“智能化升级”入口）。

> 维护约定：任何批次范围调整先改本文件 §3/§5，并同步 `IMPLEMENTATION_STATUS.md`；架构性决策追加到 `DECISIONS.md`；AI 相关变更同步 `AI_ARCHITECTURE.md`。
