# 医院业务管理系统 · AI 架构设计（AI ARCHITECTURE）

> 文档性质：**AI 相关开发的强制架构依据**。自批次 3 起生效。配套 `docs/INNOVATION_PLAN.md`、`docs/DECISIONS.md`。
> 编制时间：2026-11-07。约束来源：开发原则 #6「AI 不得绕过原有业务校验直接修改数据」。

---

## 0. 设计目标与红线

**目标**：在本纯前端 Mock 环境中，为 AI 应用（业务助手、智能报表、病历结构化、异常分析、流程预测）提供**统一、可插拔、可审计、默认离线且确定性**的 AI 基础设施，使 AI 只做“建议与只读分析”，不破坏业务规则与数据安全。

**三条红线（不可违反）**

1. **AI 无写能力**：AI 层不得引用任何 `db.create*/update*/delete*/settle*/confirm*` 等写函数；AI 只调用**只读选择器**。任何“操作建议/提案”需由用户在既有 UI 触发，由 `db.*` 按**原有业务校验**执行。
2. **默认离线确定性**：默认使用本地规则引擎，**零外部网络、零密钥**；外部 LLM Provider 仅保留骨架且默认禁用，密钥永不入库。
3. **人工确认 + 免责声明**：AI 输出为建议；涉及病历/诊断一律“建议、需人工确认、演示数据、非诊疗结论”。

---

## 1. 分层架构

```
┌─────────────────────────────────────────────────────────────┐
│  UI 层（Vue 视图/组件）                                       │
│  工作台助手面板 / 报表页 / 病历结构化弹窗 / 异常分析页 / 预测卡 │
└───────────────▲─────────────────────────────────────────────┘
                │ 调用 aiService.run(taskName, input, {actor})
┌───────────────┴─────────────────────────────────────────────┐
│  AI 编排层（src/ai/index.js, taskRegistry）                  │
│  - 任务注册与分发  - 参数/输入校验  - 输出 schema 校验        │
│  - 免责声明注入  - 结果缓存(可选)                            │
└───────▲──────────────▲───────────────▲──────────────────────┘
        │              │               │
┌───────┴──────┐ ┌─────┴──────┐ ┌──────┴───────────────────────┐
│ 上下文构建    │ │ Guardrails │ │ AI 审计 aiAudit              │
│ contextBuilder│ │  guardrails│ │ （写入 db.aiEvents，只读约束）│
│ 只读选择器    │ │ no-write   │ │ 输入摘要/输出/provider/采纳   │
│ 脱敏/分→元    │ │ schema     │ └──────────────────────────────┘
└───────▲──────┘ │ 免责/disclaim│
        │        └────────────┘
┌───────┴──────────────────────────────────────────────────────┐
│ 数据只读访问层（src/ai/selectors.js）                         │
│  封装 db.all/find/query/stats 的只读组合查询（禁止写）        │
└───────▲──────────────────────────────────────────────────────┘
        │
┌───────┴──────────────────────────────────────────────────────┐
│ 业务数据层 db.js（原有，含全部业务校验）                       │
│  ★ AI 只可只读访问；写操作只能经原有 UI→db 校验路径            │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ Provider 层（可插拔）                                         │
│  - LocalRuleEngineProvider（默认，确定性、离线、可测试）        │
│  - HttpLLMProvider（骨架，默认禁用，需显式配置且无密钥入库）    │
└──────────────────────────────────────────────────────────────┘
```

---

## 2. Provider 抽象

统一契约（示意，实现于 `src/ai/provider.js`）：

```js
// 所有 Provider 实现同一接口；同步或异步均可，内部统一 Promise 化
provider = {
  name: 'local-rule-engine' | 'http-llm',
  // task: 任务名；context: 已脱敏的只读上下文；options: 任务参数
  async generate(task, context, options) => {
    // 返回 { text, data?, confidence?, basis?, disclaimers? }
  }
}
```

- **LocalRuleEngineProvider（默认）**：基于规则/模板/简单统计生成确定性结果，便于测试与回归；`demoToday=2026-08-28` 下结果稳定。**实现为同步链路**（Mock.js 拦截层无法 await，见 `DECISIONS D21`）。
- **HttpLLMProvider（可选骨架）**：仅当显式开启（如 `VUE_APP_AI_PROVIDER=http-llm` 且用户自备 endpoint）时启用；**默认关闭**；密钥通过本地 `.env.local`（已被 `.gitignore` 忽略）提供，**绝不写入仓库或种子**；请求体经 `contextBuilder` 脱敏。当前仅保留骨架、不含真实网络实现（默认零网络）。
- Provider 切换不影响任务与 UI；便于将来真实后端/LLM 替换。

---

## 3. 任务注册表（Task Registry）

> 实现位置：`src/ai/tasks/*.js`，由 `src/ai/tasks/index.js` 统一注册（`registry.registerTask`）。所有任务强制 `readOnly:true` 且声明 `outputSchema`。

| 任务名 | 批次 | 输入 | 输出（schema 要点） | 只读数据来源 |
| --- | --- | --- | --- | --- |
| `system.selftest` | B3 | 无 | `{summary, checks[], demoToday, taskCount}` | `stats()`、`reminders()`、任务注册表 |
| `todo.priority` | B3/B4 | 待办标题/截止/模块/描述 | `{priority, reason, suggestion, basis[]}` | 数据层同口径规则 `suggestTodoPriority`（只读） |
| `reminder.explain` | B3/B4 | `{reminderId}` | `{found, title, basis[], suggestion, links[]}` | `reminderSummary()` 规则结果 |
| `assistant.qa` | B4 | `{question}` | `{answer, intent, basis[], actions[], followups[], disclaimers[]}` | selectors 聚合 + `stats()`（数值依据带 `source`+`raw`） |
| `report.summary` | B4 | `{reportType}` | `{reportType, title, columns[], rows[], totals, summary, highlights[], disclaimers[]}` | `revenueByDepartment/doctorWorkload/medicineConsumption/bedTurnover` 等 |
| `record.structure` | B4 | `{complaint, history, diagnosis, advice}` | `{symptoms[], duration, triggers[], allergy, diagKeywords[], riskFlags[], confidence, note, disclaimers[]}` | 就诊文本（仅关键词匹配，不覆盖原文） |
| `anomaly.explain` | B4 | `{scope, level?}` | `{items[], summary, total, highCount, disclaimers[]}` | `stats()`、库存、床位、积压、临期 |
| `forecast.outpatient` | B5 | 无 | `{value, unit, range[2], method, confidence, note, series[], disclaimers[]}` | `registrationSeries()`（近 7 日挂号量） |
| `forecast.beds` | B5 | 无 | 同上 | `stats().beds`、`bedTurnover()` |
| `forecast.discharge` | B5 | 无 | 同上 | `admissions`、`bedTurnover()` |
| `forecast.backlog` | B5 | 无 | 同上 | `pendingOrders()`、`pendingVisits('dispense'/'report')` |
| `forecast.noshow` | B5 | 无 | 同上 | `registrations`（退号代理指标） |

> 每个任务均在 `guardrails` 中声明 `outputSchema` 与 `readOnly:true`；`aiService` 调用前统一校验。

---

## 4. 上下文构建与脱敏（contextBuilder）

- **只读**：仅通过 `src/ai/selectors.js` 组合 `db.all/find/query/stats`，返回**副本**，不持有可变引用。
- **脱敏规则**：
  - 永不包含 `staff.password`（`stripPassword` 语义）；
  - 不包含 token、IP 等无关敏感项；
  - 患者信息按演示范围（虚构数据）提供最小必要字段；
  - 金额统一由整数分经 `utils/money.js` 转元展示（**上下文中保留整数分，展示层转元**，避免浮点）。
- **规模控制**：只取任务所需聚合/前 N 条，避免把全量数据塞入上下文。
- **注入防护**：业务文本（主诉/病史等）作为**数据**而非指令处理；本地引擎用结构化匹配，不执行文本中的“指令”；外部 Provider 输出必须过 schema 校验。

---

## 5. Guardrails（护栏）

| 护栏 | 规则 | 校验方式 |
| --- | --- | --- |
| G1 no-write | AI 层无写库能力 | 静态检查 + 单测断言 AI 模块不 import/调用 `db.*` 写函数 |
| G2 schema | 输出符合任务 schema | 运行时校验，失败回退“无建议” |
| G3 disclaimer | 医疗/建议类附免责声明 | 输出强制注入 `disclaimers` |
| G4 人工确认 | 任何落地写操作需用户确认 | UI 确认 → 走原 `db.*` 校验 |
| G5 脱敏 | 不含密码/敏感字段 | contextBuilder 单测 |
| G6 开关 | `VUE_APP_AI_ENABLED=false` 时 AI 无副作用 | 单测 |
| G7 零网络默认 | 默认 Provider 不发网络请求 | 本地引擎无 fetch/axios |

---

## 6. AI 审计（aiEvents）

新增只读审计集合（由 `aiAudit` 写入，业务层只读展示）：`{id, time, actorStaffId, actorName, actorRole, task, provider, inputSummary, outputSummary, confidence, accepted, latencyMs, error}`。

- **不记录**：完整敏感原文、密码、token。
- **用途**：可追溯“AI 给过什么建议、是否被采纳”；用于演示“AI 治理”。
- **注意**：`aiEvents` 属新增集合，需经迁移框架加入（B1 已建迁移能力），不能破坏原数据。

---

## 7. 病历结构化的特殊约束（I8）

1. 输入原文**只读展示**，解析结果以“建议字段”呈现；
2. **不覆盖** `visits.complaint/history/diagnosis/advice` 原文；
3. 医生确认后，结构化结果作为**附加字段**（如 `visits.structured`）或经表单回填后由 `db.updateVisit` **原有校验**写入；`updateVisit` 已有“已收费不可改”等规则仍生效；
4. 输出附“演示用途、非诊疗结论”免责声明。

---

## 8. 配置项（拟新增，均在 `.env.*`，非敏感）

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `VUE_APP_AI_ENABLED` | `true` | AI 功能总开关（关闭则隐藏入口且无副作用） |
| `VUE_APP_AI_PROVIDER` | `local` | `local`(默认) / `http-llm`(需自行配置) |
| `VUE_APP_AI_ENDPOINT` | 空 | 仅 `http-llm` 时使用；**默认空=不联网** |

> 密钥类配置仅可放 `.env.local`（`.gitignore` 已忽略 `.env.local`），不提交、不写种子。

---

## 9. 测试策略

- **确定性**：本地引擎在 `demoToday=2026-08-28` 下输出稳定，可断言。
- **契约测试**：Provider 接口、任务 schema（`tests/data/suite.js` B3 段 + `tests/ai/cases/*.js`）。
- **护栏测试**：G1（无写，静态扫描 `src/ai/**`）、G2（schema 失败回退）、G5（脱敏）、G6（开关关闭无副作用）、G7（无网络静态断言）。
- **一致性测试**（B4）：助手/报表数值与 `db`/`stats()`/selectors 复算一致（basis 的 `source`+`raw`、rows 求和 = totals）。
- **回归**：AI 引入不得使原数据层测试失败（现 `npm run test:data` 72/72）。
- **入口**：`npm run test:data`（数据层 + B3 护栏）、`npm run test:ai`（B4/B5 任务用例，`tests/ai/cases/`）、`npm run e2e`（浏览器端 AI 页面）。

---

## 10. 与业务校验的关系（核心原则落地）

```
用户点击“应用建议” → UI 收集参数 → 调用原有 api（如 apiUpdateVisit）
   → Mock 路由 → db.updateVisit(原有校验：状态/金额/权限)
   → 通过则写库 + 记 auditEvents；不通过则返回错误
AI 仅提供：建议文本、结构化提案、只读分析、预测区间
```

**AI 永远不持有 `state` 引用、不调用写函数、不直接 `persist()`。**

---

## 11. 批次落地

- **B3 ✅（2026-11-10）**：建立本架构骨架（Provider 抽象、本地引擎、contextBuilder、taskRegistry、guardrails、aiAudit、开关）与护栏单测；交付 AI 治理中心（`/ai/center`），不交付业务 AI 应用。
- **B4 ✅（2026-11-10）**：实现 `assistant.qa`、`report.summary`、`record.structure`、`anomaly.explain` 及对应页面/弹窗集成；`todo.priority`、`reminder.explain` 接入待办中心与提醒中心。
- **B5 ✅（2026-11-10）**：实现 `forecast.*`（5 个任务）与预测分析页，并集成工作台「明日运营预测」面板。

> 任何偏离本架构的实现须先在 `docs/DECISIONS.md` 记 ADR 并获得确认。
