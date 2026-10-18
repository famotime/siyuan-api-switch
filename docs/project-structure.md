# 项目结构与架构文档 (Project Structure)

本文档记录思源笔记 API 旋钮 (`siyuan-api-switch`) 插件的整体工程架构、目录规范与模块职责映射。

---

## 1. 架构总览

项目采用 **分层组合式架构**，严格遵循高内聚、低耦合原则：

```
UI 交互层 (Vue 3 SFC)
  ├── 容器骨架: src/App.vue (分栏布局、顶栏操作与状态通知)
  ├── 窗口控制: src/composables/useWindowDrag.ts (拖拽移动、8向缩放与持久化)
  └── 业务面板: src/components/*.vue
       ├── ProviderEditPanel (API 提供商编辑)
       ├── ProfileEditPanel (场景配置编辑)
       └── PluginBindingsPanel (子插件与思源原生多槽位接管管理)
                 │
                 ▼
核心领域服务层 (src/services/)
  ├── 外观门面 (Facade): api-switch-core.ts (整合各子服务并向下兼容)
  ├── 思源内核适配器: siyuan-adapter.ts (内核 AI 配置读写、AES 解密、原生双向无感同步与 ai.json 转换)
  ├── 提供商仓储: provider-store.ts (Provider 增删改查与模型扩充)
  ├── 配置文件仓储: profile-store.ts (Profile 增删改查、参数继承计算与防重比对算法)
  └── 插件接管分发器: plugin-binding-manager.ts (子插件注册、多模型槽位隔离与变更广播)
                 │
                 ▼
协议与生命周期层
  ├── 插件入口: src/index.ts (生命周期 onload / onunload，顶部工具栏入口挂载)
  ├── 挂载启动: src/main.ts (Vue App 实例化与销毁)
  ├── 常量预设: src/constants/providers.ts (主流服务商官方元数据与推荐模型池)
  ├── 加密工具: src/utils/siyuan-crypto.ts (思源笔记内核 AES 密文解密)
  └── 全局类型: src/types/index.d.ts (SharedConfig, ApiProfile, PluginSlotDefinition, SiyuanApiSwitch 等核心领域模型)
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
│   ├── refactor-plan.md                # 架构解耦重构规划与历史执行日志
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
│   │   └── ProviderEditPanel.vue       # API Provider 账号、协议与模型池编辑面板
│   │
│   ├── composables/                    # 组合式函数 (Composables)
│   │   └── useWindowDrag.ts            # 弹窗拖拽移动、8方向缩放、最大化/还原及本地持久化
│   │
│   ├── constants/                      # 常量与预设元数据
│   │   └── providers.ts                # DeepSeek、Gemini、SiliconFlow、OpenAI 等官方端点与推荐模型
│   │
│   ├── i18n/                           # 多语言本地化资源
│   │   ├── en_US.json
│   │   └── zh_CN.json
│   │
│   ├── services/                       # 核心业务服务层 (解耦单例组合)
│   │   ├── api-switch-core.ts          # ApiSwitchCore 统一外观门面类
│   │   ├── plugin-binding-manager.ts   # PluginBindingManager 多槽位注册与变更分发管理器
│   │   ├── profile-store.ts            # ProfileStore 配置文件内存仓储、防重匹配与继承解析
│   │   ├── provider-store.ts           # ProviderStore API 提供商仓储与自动生成
│   │   └── siyuan-adapter.ts           # SiyuanAdapter 内核 AI 交互、场景解耦、增量写回与 ai.json 转换
│   │
│   ├── styles/                         # 样式文件
│   │   └── dialog.scss                 # 弹窗容器、表单、标签池与动效样式
│   │
│   ├── types/                          # TypeScript 类型声明
│   │   ├── env.d.ts                    # Vue SFC 模块声明
│   │   └── index.d.ts                  # 全局领域模型、多模型槽位协议与 Window 接口扩展
│   │
│   ├── utils/                          # 工具函数
│   │   └── siyuan-crypto.ts            # 思源内核 AES 密文解密工具
│   │
│   ├── App.vue                         # 主界面容器组件 (左右侧分栏、路由与同步调度)
│   ├── index.scss                      # 全局基础样式与 SVG 图标防填充覆盖
│   ├── index.ts                        # 插件主入口 (ApiSwitchPlugin，注册顶栏快捷图标)
│   └── main.ts                         # Vue 应用挂载与销毁生命周期
│
├── tests/                              # 自动化测试套件
│   ├── mocks/                          # 测试桩与环境 Mock
│   │   └── siyuan.ts                   # 思源笔记核心 API 的轻量运行桩
│   └── unit/                           # 单元测试用例 (7 大套件，51 个用例全绿通过)
│       ├── auto-generate-provider.test.ts # 合法预设配置自动生成 Provider 与模型扩充测试
│       ├── binding-manager.test.ts        # 多模型槽位注册与实时配置分发测试
│       ├── deduplicate-config.test.ts     # 配置比对评分与智能防重复生成测试
│       ├── effective-profile.test.ts      # Profile 继承 Provider 参数与优先级计算测试
│       ├── extract-siyuan-ai.test.ts      # 思源原生 AI 设置抽取与 fallback 机制测试
│       ├── import-export.test.ts          # 思源原生 ai.json 双向序列化与兼容转换测试
│       └── siyuan-sync-and-decision.test.ts # 思源 AES 解密、决策模型端点与增量写回测试
│
├── CHANGELOG.md                        # 版本演进与变更日志
├── package.json                        # 依赖与脚本配置 (使用 pnpm 管理)
├── pnpm-lock.yaml                      # pnpm 依赖锁文件
├── release.js                          # 发版自动化脚本 (对齐 CHANGELOG 与产物预检)
├── tsconfig.json                       # TypeScript 编译配置
├── vite.config.ts                      # Vite 插件打包配置 (Rollup CJS 库格式)
└── vitest.config.ts                    # Vitest 单元测试运行配置
```

---

## 3. 核心领域模型

| 类型名 | 所在文件 | 说明 |
| :--- | :--- | :--- |
| `SharedConfig` | `src/types/index.d.ts` | 旋钮向第三方子插件分发的统一只读配置协议包（含 protocol、headers、isDecisionModel 等增强项） |
| `PluginSlotDefinition` | `src/types/index.d.ts` | 子插件多模型槽位定义（含 slotId、name、description 与本地降级配置） |
| `RegisterPluginOptions` | `src/types/index.d.ts` | 子插件接入旋钮的统一配置参数（支持单槽位与多槽位插槽配置） |
| `RegisteredPluginSlotInfo` | `src/types/index.d.ts` | 内存中各槽位接管状态、绑定 Profile ID 与本地快照信息 |
| `ApiProvider` | `src/types/index.d.ts` | 底层服务商账号（Base URL、API Key、Protocol、Headers、Model池） |
| `ApiProfile` | `src/types/index.d.ts` | 场景配置文件（可独立设置或关联 Provider 继承参数，标记决策模型） |
| `SiyuanAiJson` | `src/types/index.d.ts` | 对齐思源笔记原生 `ai.json` 的四根节点规范与 `_siyuanApiSwitch` 扩展数据格式 |
| `SiyuanApiSwitch` | `src/types/index.d.ts` | 挂载于 `window.siyuanApiSwitch` 的全局注册管理协议接口 |

---

## 4. 开发与测试指令

- **启动单元测试**：`npm test`（基于 Vitest，7 大测试套件 51 个用例秒级全绿执行）
- **类型检查**：`npx tsc --noEmit`（基于 TypeScript 编译器严格类型审查）
- **生产构建打包**：`npm run build`（编译产物输出至 `dist/` 并自动打包 `package.zip`）
- **持续增量开发**：`npm run dev`（持续监听源码变动并实时增量构建）
- **发布准备与预检**：`node scripts/verify-package.mjs`（校验 package.json、plugin.json、CHANGELOG 及 zip 产物完整性）
