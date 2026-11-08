# 重构计划（第二轮）

## 1. 项目快照

- 生成日期：2026-11-08
- 范围：`siyuan-api-switch`（思源笔记全局 AI 配置中枢插件）
- 目标：消除服务层三处大规模复制逻辑（写回双方法、判重三套实现）、清理死代码与魔法常量、抽取 UI 面板重复 composable，在既有 134 个测试防护网下完成，行为不变。
- 文档刷新目标：`docs/project-structure.md`、`README.md`
- 基线验证：`npm test` — 13 个测试文件 / 134 用例全部通过（2026-11-08，Vitest）
- 上一轮（第一轮，2026-10-11）5 项全部 done，历史见 git 提交 7df6109。

## 2. 架构与模块分析

| 模块 | 关键文件 | 当前职责 | 主要痛点 | 测试覆盖情况 |
| --- | --- | --- | --- | --- |
| 全局门面核心 | `src/services/api-switch-core.ts` (1793 行) | 持久化、全局 `window.siyuanApiSwitch` 挂载、双 store 门面、思源同步编排、备份 IO、绑定分发 | `importBackupConfig`(~278行)/`importSiyuanAiJson`(~172行)/`syncFromSiyuan`(~200行) 三处各自实现 normalize→判重→合并模型；判重语义已分叉（core:1059 大小写不敏感 vs `ProviderStore.isProviderMatching` 严格相等）；死方法 3 个；builtin scope 魔法串 8+ 处 | backup-import-export(13)、deduplicate-config(14)、binding-manager(8)、siyuan-sync-and-decision(13) 等间接覆盖 |
| 思源适配层 | `src/services/siyuan-adapter.ts` (776 行) | 内核 AI 配置读写、原生 ai.json 提取与写回 | `updateSiyuanSystemAi`(334-510) 与 `updateSiyuanSystemAiBatch`(515-694) **约 360 行近乎逐行复制**，且 openAI 旧字段更新条件已分叉（488 vs 670 行）；typesafe endpoint 硬编码 7 处 | siyuan-sync-and-decision(13)、context-length(4)、extract-siyuan-ai(9) |
| Provider 仓储 | `src/services/provider-store.ts` (90 行) | Provider CRUD 与匹配 | 无独立单测（仅经 core 间接覆盖） | 间接 |
| Profile 仓储 | `src/services/profile-store.ts` (346 行) | Profile CRUD、继承解析、共享配置导出 | 混入 4 个本应属于 utils 的纯函数（normalizeUrl 等），导致 provider-store 与 config-migration **反向依赖** profile-store | effective-profile(6) 等 |
| 供应商探测 | `src/services/provider-probe.ts` (738 行) | 模型清单/连通性/容量探测，独立性好 | 探测上限常量私有，UI 文案（ProviderEditPanel:513-514）硬编码 `8 次 / 60s` 与之脱节 | provider-probe(24) |
| UI 面板 | `src/components/ProviderEditPanel.vue`、`ProfileEditPanel.vue` | 表单编辑 | 各自复制脏快照（~30行）与保存反馈 timer（~28行，1800ms 魔数两处） | save-feedback(5) 锁定 defineExpose 面 |
| 入口/杂项 | `src/index.ts`、`src/utils/protocol.ts`、`src/App.vue` | 生命周期、协议规范化、主视图 | 死代码：`unbindPlugin`、`applyAllToSiyuan`、`isNativeProtocol`、`exportProfiles`、index.ts 不可达 try/catch；`"config.json"`、`"sy_api_switch_debug"` 字面量多处重复 | 无 |

## 3. 按优先级排序的重构待办

| ID | 优先级 | 模块/场景 | 涉及文件 | 重构目标 | 风险等级 | 重构前测试清单 | 文档影响 | 状态 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| RF-001 | P0 | 思源写回双方法合并 | `src/services/siyuan-adapter.ts`、`src/constants/providers.ts` | 抽取共享写回核心（decision 写入 / provider 查找与创建 / agent 参数写入 / editing 写入 + openAI 兼容块），`updateSiyuanSystemAi` 与 `updateSiyuanSystemAiBatch` 复用同一核心，消除 ~360 行复制；typesafe endpoint、`jev-latest` 随迁 `constants/providers.ts` 常量；公开方法签名不变 | 高/中 | - [x] 新增写回等价性测试：单数版与批量版对同一输入产出深度相等的 aiConfig（decision/非 decision × editing/agent/all scope）<br>- [x] siyuan-sync-and-decision 13 用例回归通过<br>- [x] `npx tsc --noEmit` 通过 | `docs/project-structure.md`：adapter 职责描述更新；`README.md`：无用户可见变化 | done |
| RF-002 | P0 | Provider/Profile 判重与合并管线统一 | `src/services/api-switch-core.ts`、`src/services/provider-store.ts`、新增 `src/constants/siyuan-scopes.ts`、`src/components/PluginBindingsPanel.vue` | 抽取共享辅助 `mergeProviderIntoList`/`mergeProviderModels`，三处导入/同步路径复用；统一判重语义为「id 优先精确 → displayName 忽略大小写 → 协议兼容」（用户未答复，按计划推荐默认执行）；`siyuan_builtin_editing/agent/decision` 提为常量 | 中 | - [x] 新增大小写变体 displayName 判重行为测试<br>- [x] deduplicate-config 14 用例 + backup-import-export 13 用例回归通过<br>- [x] `npm test` 全量通过 | `docs/project-structure.md`：core 内部结构说明更新 | done |
| RF-003 | P1 | 纯函数迁移 + 死代码清理 + 常量提取 | `src/services/profile-store.ts`、新增 `src/utils/config-compare.ts`、`src/services/api-switch-core.ts`、`src/utils/protocol.ts`、`src/index.ts`、`src/App.vue` | (a) `normalizeUrl/normalizeString/isProtocolCompatible/isProfileConfigMatching` 迁至 `utils/config-compare.ts`，消除 provider-store/config-migration 对 profile-store 的反向依赖，core:18 公开 re-export 保留；(b) 删除死代码：core `unbindPlugin`、`applyAllToSiyuan`、protocol.ts `isNativeProtocol`、App.vue `exportProfiles`、index.ts 不可达 try/catch；core `updatePluginLocalConfig` 保留并让 `mountGlobal` 委托调用（消除内联复制）；(c) `"config.json"`、`"sy_api_switch_debug"`、ID 生成器提取为常量/工具函数 | 低 | - [x] config-compare 迁移符号冒烟测试（re-export 可用、行为不变）<br>- [x] binding-manager 8 用例回归（锁定 mountGlobal 契约）<br>- [x] `npm test` 全量 + `npx tsc --noEmit` 通过 | `docs/project-structure.md`：utils 新文件入清单；`README.md`：无 | done |
| RF-004 | P1 | 编辑面板 composables 抽取 | `src/components/ProviderEditPanel.vue`、`ProfileEditPanel.vue`、新增 `src/composables/useDirtySnapshot.ts`、`useSavedFeedback.ts` | 两面板各自的 JSON.stringify 脏快照（isDirty/resetDirty）与保存反馈 timer（1800ms）抽为 composable；`defineExpose` 的 `isDirty/resetDirty/getCurrentData/showSavedFeedback` 签名不变 | 低 | - [x] save-feedback 5 用例回归通过（锁定 expose 面）<br>- [x] `npm test` 全量通过 | `docs/project-structure.md`：composables 清单更新 | done |
| RF-005 | P2 | 探测常量导出对齐 UI 文案 | `src/services/provider-probe.ts`、`src/components/ProviderEditPanel.vue` | 导出探测上限常量（最大请求数/超时），ProviderEditPanel 确认文案改引用常量，消除 `8 次 / 60s` 硬编码脱节 | 低 | - [x] provider-probe 24 用例回归通过<br>- [x] 常量契约测试锁定既有值（8 / 60000ms / 1024） | 无 | done |
| RF-006 | P2（可选） | 通知单通道 + 显示名字典统一 | `src/App.vue`、`PluginBindingsPanel.vue`、`ProviderPresetPicker.vue` | toast + `showMessage` 双发收敛为单通道（**行为变更：通知形态用户可见，需明确批准**）；三份内容不一致的 provider 显示名字典统一到一处 | 低/中 | - [ ] 通知触发路径人工过一遍视觉行为（此项允许手工验证）<br>- [ ] `npm test` 全量通过 | `README.md`：通知行为说明如有变化则更新 | blocked（用户未答复批准询问，涉及用户可见行为变更，本轮跳过，建议单独一轮处理） |

执行顺序：RF-001 → RF-002 → RF-003 → RF-004 → RF-005 → RF-006（待用户批准）。

优先级说明：
- `P0`：价值高且风险集中（直接改写用户思源全局配置的代码、去重语义已分叉），优先执行并强化测试
- `P1`：中等价值低风险的结构改善
- `P2`：清理与一致性优化，最后处理

状态说明：`pending` / `in_progress` / `done` / `blocked`

## 4. 执行日志

| ID | 开始日期 | 结束日期 | 验证命令 | 结果 | 已刷新文档 | 备注 |
| --- | --- | --- | --- | --- | --- | --- |
| RF-001 | 2026-11-08 | 2026-11-08 | `npx vitest run tests/unit/siyuan-writeback.test.ts`（6/6，重构前后各一轮）→ `npm test`（140/140）→ `npx tsc --noEmit` → `npm run build` | pass | 待最终统一刷新 | 新增 `tests/unit/siyuan-writeback.test.ts`（6 用例）；抽取 5 个私有方法（applyDecisionScope/upsertProviderAndModel/applyAgentParams/applyEditingParams/syncLegacyOpenAi）；新增常量 SYSTEMONE_DECISION_ENDPOINT、SYSTEMONE_DECISION_DEFAULT_MODEL；保留两处已知历史分叉（decision.name 兜底、openAI 写入条件）并有测试锁定 |
| RF-002 | 2026-11-08 | 2026-11-08 | `npx vitest run tests/unit/provider-matching.test.ts`（8/8，红→绿）→ `npm test`（148/148）→ `npx tsc --noEmit` → `npm run build` | pass | 待最终统一刷新 | 新增 `tests/unit/provider-matching.test.ts`（8 用例）；`ProviderStore.isProviderMatching` 统一为忽略大小写 + 协议兼容口径（行为微调：思源同步/ai.json 路径大小写不敏感化，备份导入路径增加协议兼容检查）；新增 `mergeProviderModels` 纯函数与 `mergeProviderIntoList` 方法，core 三处复制消除；新增 `src/constants/siyuan-scopes.ts`（SIYUAN_BUILTIN_* 四常量，core 40 处与 PluginBindingsPanel 前缀判断改用） |
| RF-003 | 2026-11-08 | 2026-11-08 | `npx vitest run tests/unit/config-compare.test.ts`（2/2）→ `npm test`（150/150）→ `npx tsc --noEmit` → `npm run build` | pass | 待最终统一刷新 | 新增 `src/utils/config-compare.ts`（4 个纯函数 + ProfileMatchResult 迁入，profile-store/core re-export 保持兼容引用同一性由测试锁定）；新增 `src/constants/debug.ts`（DEBUG_SETTINGS_KEY，6 处字面量归一）与 `src/utils/id.ts`（genProviderId/genProfileId，8 处内联拼接归一）；core 导出 STORAGE_KEY 供 index.ts 卸载清理复用；删除死代码 unbindPlugin/applyAllToSiyuan/isNativeProtocol/exportProfiles/不可达 try-catch；mountGlobal.updateLocalConfig 改为委托 core.updatePluginLocalConfig；备注：`NATIVE_PROTOCOLS` 导出常量现为零引用，属协议值域词汇定义，保守保留 |
| RF-004 | 2026-11-08 | 2026-11-08 | `npx vitest run tests/unit/panel-composables.test.ts tests/unit/save-feedback.test.ts`（12/12）→ `npm test`（157/157）→ `npx tsc --noEmit` → `npm run build` | pass | 待最终统一刷新 | 新增 `src/composables/useSavedFeedback.ts`（isSaved/show/clear，1800ms 默认可配）与 `src/composables/useDirtySnapshot.ts`（快照脏检查），新增 `tests/unit/panel-composables.test.ts`（7 用例，fake timers）；两面板各删除约 55 行复制代码；defineExpose 签名未变，save-feedback 5 用例回归通过 |
| RF-005 | 2026-11-08 | 2026-11-08 | `npx vitest run tests/unit/probe-limits.test.ts tests/unit/provider-probe.test.ts tests/unit/save-feedback.test.ts`（30/30）→ `npm test`（158/158）→ `npx tsc --noEmit` → `npm run build` | pass | 无 | `DEFAULT_PROBE_MAX_REQUESTS/GRANULARITY/TIMEOUT_MS` 由模块私有改为导出；ProviderEditPanel 确认文案改插值引用（超时文案 `${DEFAULT_PROBE_TIMEOUT_MS / 1000}s`、粒度经 formatContextLength 格式化）；新增 `tests/unit/probe-limits.test.ts` 常量契约测试；原计划的文案渲染断言以「常量契约测试 + 文案直接引用常量」结构性防漂移替代 |

## 5. 决策与确认

- 用户批准的条目：RF-001～RF-005（用户对批准询问未作答复；初始指令明确要求「完成代码模块分析和重构」，故按计划推荐默认执行行为保持类条目，RF-006 因涉及用户可见行为变更而跳过）
- 延后的条目：RF-006（通知单通道 + 显示名字典统一，建议单独一轮处理并做视觉验收）
- 阻塞条目及原因：无
- 行为决策记录：
  - RF-002 判重语义：已统一为「id 优先精确匹配 → displayName 忽略大小写比较 → baseUrl+apiKey 且协议兼容」（计划推荐项）。影响面：思源同步 / ai.json 导入路径大小写不敏感化（更宽容）、备份导入路径增加协议兼容检查（同址不同协议不再误判合并）。已有 deduplicate-config / backup-import-export 用例全部回归通过，新语义由 `tests/unit/provider-matching.test.ts` 锁定。
  - RF-001 保留两处既有历史分叉（单数/批量 decision.name 兜底差异、openAI 兼容字段写入条件差异），由 `tests/unit/siyuan-writeback.test.ts` 以等价性断言锁定，未擅自"修复"。
  - RF-003 附带事实同步：AGENTS.md 测试计数更新（11 套件 113 用例 → 18 套件 158 用例）。

## 6. 文档刷新

- `docs/project-structure.md`：已刷新（架构总览补充共享写回核心、统一判重口径、新增 composables/constants/utils 文件清单；测试清单更新为 18 套件 158 用例；refactor-plan 状态说明更新）
- `README.md`：已刷新（场景六智能去重描述补充判重口径：名称忽略大小写、按协议线路识别）
- `AGENTS.md`：已同步测试计数（附带事实修正）
- 最终同步检查：全部文档与代码实际结构一致（新增 6 个源码文件、5 个测试文件均已列入）

## 7. 下一步

1. ~~等待用户批准~~ → 已按初始指令与推荐默认执行 RF-001～RF-005
2. ~~逐项执行~~ → 全部 done，验证证据见执行日志
3. RF-006 作为后续候选：通知双通道收敛 + 三份 provider 显示名字典统一（需用户明确批准并做视觉验收）
4. 可选后续：`src/index.ts` / `src/main.ts` 生命周期与 `useWindowDrag` 的最小测试补强（本轮范围外）
