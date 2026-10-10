# 重构计划

## 1. 项目快照

- 生成日期：2026-10-11
- 范围：`siyuan-api-switch`（思源笔记 API 旋钮插件代码库）
- 目标：解耦 1380 行巨石核心服务 `src/services/api-switch-core.ts` 与 2763 行巨石视图 `src/App.vue`，清理模板遗留死代码，引入 Vitest 自动化测试套件建立防护网，达成高内聚、低耦合、高可测性的工程架构。
- 文档刷新目标：`docs/project-structure.md`、`README.md`、`AGENTS.md`

## 2. 架构与模块分析

| 模块 | 关键文件 | 当前职责 | 主要痛点 | 测试覆盖情况 |
| --- | --- | --- | --- | --- |
| 核心单例服务 | `src/services/api-switch-core.ts` (1380行) | 负责配置持久化、思源内核 AI 同步、Provider 增删改查、Profile 继承计算、子插件接管注册与通知分发、JSON 导入导出 | 承担过多职责（God Class）；逻辑混杂（文件 IO、HTTP 请求、数据转换、业务分发交织在一起）；代码行数过大 | 无测试（0%） |
| 主视图与界面交互 | `src/App.vue` (2763行) | 承载弹窗渲染、拖拽缩放最大化、Provider 表单、Profile 表单、接管列表、文件导入导出及全部样式 | 巨石组件；模板 629 行、脚本 970 行、样式 1162 行未拆分；状态过度集中；缺乏子组件复用 | 无测试（0%） |
| 插件入口与生命周期 | `src/index.ts`, `src/main.ts` | 插件加载 `onload`/`onunload`，Vue App 挂载与销毁，环境检测 | 逻辑清晰紧凑，基本无需大改，仅需配合服务解耦对齐类型引入 | 无测试 |
| 类型与声明 | `src/types/index.d.ts`, `src/types/api.d.ts` | 定义全局接口、SiyuanApiSwitch 协议、思源模板数据类型 | 混杂了大量 frostime 模板自带的未使用类型（Block, Notebook, Kramdown 等共计 100+ 行），而业务关键类型如 `ApiProfile` 却留在 `api-switch-core.ts` 内部 | N/A |
| 模板冗余资产 | `src/api.ts` (487行), `src/components/SiyuanTheme/` (6个文件), `src/utils/index.ts` (9行) | 初始插件脚手架遗留的通用 API 函数与未使用的占位组件 | 从未被项目任何文件 import 或引用，属于 100% 死代码与认知负担 | N/A |

## 3. 按优先级排序的重构待办

| ID | 优先级 | 模块/场景 | 涉及文件 | 重构目标 | 风险等级 | 重构前测试清单 | 文档影响 | 状态 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| RF-001 | P0 | 测试基础设施构建 | `package.json`, `vite.config.ts`, `vitest.config.ts`, `tests/unit/*.test.ts` | 引入 `vitest` 与测试环境配置；为 `extractSiyuanAiSettings`、`resolveEffectiveProfile`、`exportSiyuanAiJson`/`importSiyuanAiJson` 等核心计算建立高覆盖自动化单元测试防护网 | 低 | - [x] 思源 AI 配置解析与 fallback 降级测试<br>- [x] Profile 继承 Provider 参数（Headers、Timeout、Model池）计算测试<br>- [x] ai.json 格式导入导出双向无损转换测试<br>- [x] 运行 `npm test` 确认基线全部通过 (17/17 passed) | `docs/project-structure.md`：记录 tests 目录；`README.md`：记录测试脚本 | done |
| RF-002 | P0 | 核心服务分层解耦 | `src/services/siyuan-adapter.ts`<br>`src/services/provider-store.ts`<br>`src/services/profile-store.ts`<br>`src/services/plugin-binding-manager.ts`<br>`src/services/api-switch-core.ts` | 将 1380 行的单例拆分为：思源适配层（内核配置读写与转换）、Provider 仓储、Profile 仓储（含继承解析）、插件接管分发器；`apiSwitchCore` 重构为组合门面（Facade），对外保持 100% 向下兼容 | 中 | - [x] 保持 `apiSwitchCore` 对外方法签名与字段类型完全不变<br>- [x] 验证 Provider 增删改查及 Profile 关联同步<br>- [x] 验证 Profile 增删改查及批量导入导出<br>- [x] 验证子插件注册、接管绑定与回调通知分发<br>- [x] 运行 RF-001 单元测试全部通过 (17/17 passed)<br>- [x] 生产构建 `npm run build` 成功通过 | `docs/project-structure.md`：记录 services 分层架构 | done |
| RF-003 | P1 | 视图层组件化解耦 | `src/composables/useWindowDrag.ts`<br>`src/components/ProviderEditPanel.vue`<br>`src/components/ProfileEditPanel.vue`<br>`src/components/PluginBindingsPanel.vue`<br>`src/App.vue` | 抽取窗口拖拽缩放逻辑到 Composable；将 Provider 表单、Profile 表单、接管列表抽离为高内聚子组件；`App.vue` 作为容器骨架，精简至 500 行左右 | 中 | - [x] 窗口拖动、缩放、最大化/还原交互行为正常<br>- [x] Provider 与 Profile 表单字段响应式双向绑定正常<br>- [x] 接管列表与思源原生 3 大场景切换正常<br>- [x] 生产打包 `npm run build` 成功且无 Sass/TS 错误 | `docs/project-structure.md`：更新 components 与 composables 结构 | done |
| RF-004 | P2 | 模板遗留冗余资产清理与类型集中化 | `src/api.ts` (删除)<br>`src/types/api.d.ts` (删除)<br>`src/components/SiyuanTheme/` (删除)<br>`src/utils/index.ts` (清理)<br>`src/types/index.d.ts` (整理) | 删除 100% 未引用的模板死代码（约 560 行）；将散落的领域类型（`ApiProfile`, `ApiSwitchStorage`, `RegisteredPluginInfo`, `SiyuanExtractedAiInfo`）统一规范至 `src/types/`，移除未使用的 Block/Notebook 冗余定义 | 低 | - [x] 确认全项目无任何对被删除文件的残留 import<br>- [x] 运行 `npx tsc --noEmit` 类型检查通过 (0 errors)<br>- [x] 运行 `npm test` 单元测试全部通过 (17/17 passed)<br>- [x] 运行 `npm run build` 构建打包通过 | `docs/project-structure.md`：更新清理后的项目文件清单 | done |
| RF-005 | P2 | 仓库文档全面刷新 | `docs/project-structure.md`<br>`README.md`<br>`AGENTS.md`<br>`docs/refactor-plan.md` | 新建 `docs/project-structure.md` 描述清晰的项目目录与模块职责映射；刷新 `README.md` 与 `AGENTS.md`，写回计划执行日志 | 无 | - [x] 文档内容与实际代码库架构完全一致<br>- [x] 验证链接与文件路径有效性 | `docs/project-structure.md`：新建；`README.md`：刷新；`AGENTS.md`：刷新 | done |

优先级说明：
- `P0`：价值和风险都最高，优先执行（自动化测试基准 + 核心领域服务拆分解耦）
- `P1`：价值或风险中等，放在 `P0` 之后（巨石组件 `App.vue` 视图与 Composable 拆分）
- `P2`：低风险清理项，最后执行（冗余死代码清理、类型规范化、文档刷新）

状态说明：
- `pending`
- `in_progress`
- `done`
- `blocked`

## 4. 执行日志

| ID | 开始日期 | 结束日期 | 验证命令 | 结果 | 已刷新文档 | 备注 |
| --- | --- | --- | --- | --- | --- | --- |
| RF-001 | 2026-10-11 | 2026-10-11 | `npm test` | pass (4 files, 17 tests passed) | `package.json` | 自动化测试防护网已就绪 |
| RF-002 | 2026-10-11 | 2026-10-11 | `npm test` & `npm run build` | pass (测试通过且构建打包成功) | `src/services/*` | 核心服务成功拆分为 5 个单一职责模块 |
| RF-003 | 2026-10-11 | 2026-10-11 | `npm test` & `npm run build` | pass (App.vue 精简至 500 行，拆出 3 个 Panel 与 Composable) | `src/components/*` | 视图层组件化解耦完成 |
| RF-004 | 2026-10-11 | 2026-10-11 | `npx tsc --noEmit` & `npm run build` | pass (死代码删除，类型统一收敛，零错误) | `src/types/*` | 模板冗余清理与类型集中化完成 |
| RF-005 | 2026-10-11 | 2026-10-11 | 文档交叉一致性审查 | pass (所有路径与命令验证无误) | `docs/project-structure.md`、`README.md`、`AGENTS.md` | 文档体系全面刷新并同步完成 |

## 5. 决策与确认

- 用户批准的条目：RF-001, RF-002, RF-003, RF-004, RF-005 (全部获批实施)
- 延后的条目：无
- 阻塞条目及原因：无

## 6. 文档刷新

- `docs/project-structure.md`：已新建并完整记录分层架构、目录结构、核心模型与开发指令
- `README.md`：已刷新工程开发与自动化测试指南
- `AGENTS.md`：已精简更新架构速查手册与常用验证命令
- 最终同步检查：所有文档链接与代码库实际状态 100% 一致

## 7. 下一步

1. 获批重构项（RF-001 ~ RF-005）已全部高质量完成交付。
2. 保持持续自动化测试防护，供后续功能迭代安全演进。
