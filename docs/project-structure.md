# 项目结构与架构文档 (Project Structure)

本文档记录思源笔记 API 旋钮 (`siyuan-api-switch`) 插件的整体工程架构、目录规范与模块职责映射。

---

## 1. 架构总览

项目采用 **分层组合式架构**，严格遵循高内聚、低耦合原则：

```
UI 交互层 (Vue 3 SFC)
  ├── 容器骨架: src/App.vue (分栏布局、顶栏操作、未保存改动保护与状态通知)
  ├── 窗口控制: src/composables/useWindowDrag.ts (拖拽移动、8向缩放与持久化)
  ├── 面板共享: src/composables/useSavedFeedback.ts (保存反馈轻提示)
  │             src/composables/useDirtySnapshot.ts (JSON 快照脏检查)
  └── 业务面板: src/components/*.vue
       ├── ProviderEditPanel (API 提供商编辑与探测操作)
       ├── ProfileEditPanel (场景配置编辑与智能默认命名)
       ├── ProviderPresetPicker (预置供应商目录选择弹窗)
       └── PluginBindingsPanel (子插件与思源原生多槽位接管管理)
                 │
                 ▼
核心领域服务层 (src/services/)
  ├── 外观门面 (Facade): api-switch-core.ts (整合各子服务并向下兼容)
  ├── 思源内核适配器: siyuan-adapter.ts (内核 AI 配置读写、AES 解密、原生双向无感同步、提供商名称净化与 ai.json 转换；编辑器/智能体/决策写回共用同一共享核心)
  ├── 提供商仓储: provider-store.ts (Provider 增删改查、统一判重口径 id→displayName 忽略大小写→连接参数+协议兼容、模型池增量合并 mergeProviderModels/mergeProviderIntoList)
  ├── 配置文件仓储: profile-store.ts (Profile 增删改查、参数继承计算与防重比对算法；比对纯函数已迁至 utils/config-compare 并保留 re-export)
  ├── 插件接管分发器: plugin-binding-manager.ts (子插件注册、多模型槽位隔离、full/partial/none 三态接管状态与变更广播)
  ├── 供应商探测服务: provider-probe.ts (刷新模型清单、两级连通测试、上下文容量探测与 System One 决策模型独立探测；探测成本预算常量导出供 UI 文案共用)
  └── 配置迁移器: config-migration.ts (存量协议值域与 Gemini 旧端点静默迁移)
                 │
                 ▼
协议与生命周期层
  ├── 插件入口: src/index.ts (生命周期 onload / onunload，顶部工具栏入口挂载)
  ├── 挂载启动: src/main.ts (Vue App 实例化与销毁)
  ├── 常量预设: src/constants/providers.ts (主流服务商官方元数据、推荐模型池与 System One 决策模型官方端点常量)
  │             src/constants/model-contexts.ts (内置模型上下文容量快照表)
  │             src/constants/siyuan-scopes.ts (思源内置编辑器/智能体/决策模型场景的保留插件 ID)
  │             src/constants/debug.ts (调试开关 localStorage 键名)
  ├── 协议工具: src/utils/protocol.ts (思源内核原生协议值域规范化与 systemone 扩展)
  ├── 比对工具: src/utils/config-compare.ts (URL/字符串归一化、协议兼容性与配置比对纯函数，provider-store/config-migration/core 共用)
  ├── 命名工具: src/utils/profile-naming.ts (Profile「供应商-模型」默认命名计算)
  ├── ID 工具: src/utils/id.ts (provider_/prof_ 前缀命名空间的实体 ID 生成)
  ├── 加密工具: src/utils/siyuan-crypto.ts (思源笔记内核 AES 密文解密)
  └── 全局类型: src/types/index.d.ts (SharedConfig, ApiProfile, ApiProvider, AiProtocol, PluginBindingState 等核心领域模型)
```

---

## 2. 目录结构与职责说明

```
siyuan-api-switch/
├── .github/workflows/                  # GitHub Actions CI/CD 流水线
│   └── release.yml                     # 自动化构建打包与 Release 发布流水线
│
├── docs/                               # 项目架构与开发者文档
│   ├── API_SWITCH_INTEGRATION_GUIDE.md # 第三方插件开发者集成指南（单模型与多槽位）
│   ├── project-structure.md            # 本文件：项目模块架构与职责映射
│   ├── refactor-plan.md                # 重构规划与执行日志（第二轮进行中，第一轮已完结归档于 git 历史）
│   └── sample-plugin-integration.ts    # 示例插件集成源码（含单模型与多槽位参考实现）
│
├── scripts/                            # 自动化脚本工具
│   ├── extract-changelog.mjs           # CHANGELOG 版本内容自动提取工具
│   └── verify-package.mjs              # 打包发布产物合规性校验工具
│
├── src/                                # 源码根目录
│   ├── components/                     # UI 业务面板组件
│   │   ├── PluginBindingsPanel.vue     # 子插件多槽位接管状态与配置绑定面板
│   │   ├── ProfileEditPanel.vue        # API Profile 表单编辑与参数池联动面板
│   │   ├── ProviderEditPanel.vue       # API Provider 账号、协议、模型池与探测操作编辑面板
│   │   └── ProviderPresetPicker.vue    # 预置供应商目录选择弹窗（镜像思源原生 17 家 + 自定义）
│   │
│   ├── composables/                    # 组合式函数 (Composables)
│   │   ├── useDirtySnapshot.ts         # JSON 快照脏检查（两编辑面板共用）
│   │   ├── useSavedFeedback.ts         # 保存成功轻提示状态机（两编辑面板共用，默认 1800ms 自动消退）
│   │   └── useWindowDrag.ts            # 弹窗拖拽移动、8方向缩放、最大化/还原及本地持久化
│   │
│   ├── constants/                      # 常量与预设元数据
│   │   ├── debug.ts                    # 调试开关 localStorage 键名 (sy_api_switch_debug)
│   │   ├── model-contexts.ts           # 内置模型上下文容量快照表（约 100 条主流模型，离线兜底）
│   │   ├── providers.ts                # DeepSeek、Gemini、SiliconFlow、OpenAI 等官方端点、推荐模型与 System One 决策模型常量
│   │   └── siyuan-scopes.ts            # 思源内置编辑器/智能体/决策模型场景的保留插件 ID (siyuan_builtin_*)
│   │
│   ├── i18n/                           # 多语言本地化资源
│   │   ├── en_US.json
│   │   └── zh_CN.json
│   │
│   ├── services/                       # 核心业务服务层 (解耦单例组合)
│   │   ├── api-switch-core.ts          # ApiSwitchCore 统一外观门面类
│   │   ├── config-migration.ts         # 存量配置静默迁移（旧协议值域 → 内核原生值域、Gemini 端点改写）
│   │   ├── plugin-binding-manager.ts   # PluginBindingManager 多槽位注册、三态接管状态与变更分发管理器
│   │   ├── profile-store.ts            # ProfileStore 配置文件内存仓储、防重匹配与继承解析
│   │   ├── provider-probe.ts           # ProviderProbe 刷新模型清单 / 两级测试 / 容量探测 / 决策模型独立探测
│   │   ├── provider-store.ts           # ProviderStore API 提供商仓储、统一判重口径与模型池增量合并
│   │   └── siyuan-adapter.ts           # SiyuanAdapter 内核 AI 交互、场景解耦、增量写回（共享写回核心）与 ai.json 转换
│   │
│   ├── styles/                         # 样式文件
│   │   └── dialog.scss                 # 弹窗容器、表单、标签池与动效样式
│   │
│   ├── types/                          # TypeScript 类型声明
│   │   ├── env.d.ts                    # Vue SFC 模块声明
│   │   └── index.d.ts                  # 全局领域模型、协议值域、多模型槽位协议与 Window 接口扩展
│   │
│   ├── utils/                          # 工具函数
│   │   ├── config-compare.ts           # URL/字符串归一化、协议兼容性与配置比对纯函数（自 profile-store 迁出）
│   │   ├── id.ts                       # provider_/prof_ 前缀实体 ID 生成
│   │   ├── profile-naming.ts           # Profile「供应商-模型」默认命名计算与兜底
│   │   ├── protocol.ts                 # 协议值域规范化（内核原生三值 + systemone 扩展）与旧值映射
│   │   └── siyuan-crypto.ts            # 思源内核 AES 密文解密工具
│   │
│   ├── App.vue                         # 主界面容器组件 (左右侧分栏、路由与同步调度)
│   ├── index.scss                      # 全局基础样式与 SVG 图标防填充覆盖
│   ├── index.ts                        # 插件主入口 (ApiSwitchPlugin，注册顶栏快捷图标)
│   └── main.ts                         # Vue 应用挂载与销毁生命周期
│
├── tests/                              # 自动化测试套件
│   ├── mocks/                          # 测试桩与环境 Mock
│   │   └── siyuan.ts                   # 思源笔记核心 API 的轻量运行桩（可编程 fetchSyncPost 拦截）
│   └── unit/                           # 单元测试用例 (18 大套件，158 个用例全绿通过)
│       ├── auto-generate-provider.test.ts    # 合法预设配置自动生成 Provider 与模型扩充测试
│       ├── backup-import-export.test.ts      # 全量备份导出、去重导入与模型池增量合并测试
│       ├── binding-manager.test.ts           # 多槽位注册、三态接管流转与顶层历史键清理测试
│       ├── config-compare.test.ts            # 比对纯函数迁移后的引用一致性与行为回归测试
│       ├── context-length.test.ts            # 上下文容量继承覆盖、下发与写回同步测试
│       ├── deduplicate-config.test.ts        # 配置比对评分、空密钥防复用与智能防重复生成测试
│       ├── effective-profile.test.ts         # Profile 继承 Provider 参数与优先级计算测试
│       ├── extract-siyuan-ai.test.ts         # 思源原生 AI 设置抽取、fallback 与名称净化测试
│       ├── import-export.test.ts             # 思源原生 ai.json 双向序列化与兼容转换测试
│       ├── panel-composables.test.ts         # 面板共享 composable（保存反馈状态机与快照脏检查）测试
│       ├── profile-naming.test.ts            # 「供应商-模型」默认命名、锁定与兜底回退测试
│       ├── protocol-and-presets.test.ts      # 预置目录完整性、协议值域迁移与 systemone 规范化测试
│       ├── provider-matching.test.ts         # 提供商统一判重口径（id→displayName 忽略大小写→连接参数+协议兼容）测试
│       ├── provider-probe.test.ts            # 刷新模型/两级测试/容量探测/决策模型独立探测测试
│       ├── probe-limits.test.ts              # 容量探测成本预算常量契约测试（UI 文案共用）
│       ├── save-feedback.test.ts             # 编辑面板保存反馈与 defineExpose 契约测试
│       ├── siyuan-sync-and-decision.test.ts  # 思源 AES 解密、决策模型端点与增量写回测试
│       └── siyuan-writeback.test.ts          # 写回单数/批量方法等价性与已知语义分叉锁定测试
│
├── CHANGELOG.md                        # 版本演进与变更日志
├── package.json                        # 依赖与脚本配置 (使用 pnpm 管理)
├── pnpm-lock.yaml                      # pnpm 依赖锁文件
├── plugin.json                         # 思源插件市场元数据清单
├── release.js                          # 发版自动化脚本 (对齐 CHANGELOG 与产物预检)
├── tsconfig.json                       # TypeScript 编译配置
├── vite.config.ts                      # Vite 插件打包配置 (Rollup CJS 库格式)
└── vitest.config.ts                    # Vitest 单元测试运行配置
```

---

## 3. 核心领域模型

| 类型名 | 所在文件 | 说明 |
| :--- | :--- | :--- |
| `AiProtocol` | `src/types/index.d.ts` | 协议值域：内核原生 `openai` / `openai-responses` / `anthropic-messages` + Jev 决策模型扩展 `systemone` |
| `SharedConfig` | `src/types/index.d.ts` | 旋钮向第三方子插件分发的统一只读配置协议包（含 protocol、headers、contextWindow、isDecisionModel 与思源编辑器/智能体高级参数等增强项） |
| `PluginSlotDefinition` | `src/types/index.d.ts` | 子插件多模型槽位定义（含 slotId、name、description 与本地降级配置） |
| `RegisterPluginOptions` | `src/types/index.d.ts` | 子插件接入旋钮的统一配置参数（支持单槽位与多槽位插槽配置） |
| `RegisteredPluginSlotInfo` | `src/types/index.d.ts` | 内存中各槽位接管状态、绑定 Profile ID 与本地快照信息 |
| `PluginBindingState` | `src/types/index.d.ts` | 插件接管三态模型：`full` 全部接管 / `partial` 部分接管 / `none` 独立配置 |
| `ApiProvider` | `src/types/index.d.ts` | 底层服务商账号（Base URL、API Key、Protocol、Headers、Model池与容量元数据） |
| `ApiProfile` | `src/types/index.d.ts` | 场景配置文件（可独立设置或关联 Provider 继承参数，标记决策模型） |
| `SiyuanAiJson` | `src/types/index.d.ts` | 对齐思源笔记原生 `ai.json` 的四根节点规范与 `_siyuanApiSwitch` 扩展数据格式 |
| `SiyuanApiSwitch` | `src/types/index.d.ts` | 挂载于 `window.siyuanApiSwitch` 的全局注册管理协议接口 |

---

## 4. 开发与测试指令

- **启动单元测试**：`npm test`（基于 Vitest，18 大测试套件 158 个用例秒级全绿执行）
- **类型检查**：`npx tsc --noEmit`（基于 TypeScript 编译器严格类型审查）
- **生产构建打包**：`npm run build`（编译产物输出至 `dist/` 并自动执行 `scripts/verify-package.mjs` 产物校验）
- **持续增量开发**：`npm run dev`（持续监听源码变动并实时增量构建）
- **发版自动化**：`npm run release`（支持 `release:patch` / `release:minor` / `release:major` 模式，自动对齐 CHANGELOG、plugin.json 版本并打包产物）
- **产物预检**：`node scripts/verify-package.mjs`（校验 package.json、plugin.json、CHANGELOG 及 zip 产物完整性）
