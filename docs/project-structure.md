# 项目结构与架构文档 (Project Structure)

本文档记录思源笔记 API 旋钮 (`siyuan-api-switch`) 插件的整体工程架构、目录规范与模块职责映射。

---

## 1. 架构总览

项目采用 **分层组合式架构**，严格遵循高内聚、低耦合原则：

```
UI 交互层 (Vue 3 SFC)
  ├── 容器骨架: src/App.vue
  ├── 窗口控制: src/composables/useWindowDrag.ts
  └── 业务面板: src/components/*.vue
       ├── ProviderEditPanel (API 提供商编辑)
       ├── ProfileEditPanel (场景配置编辑)
       └── PluginBindingsPanel (子插件接管管理)
                 │
                 ▼
核心领域服务层 (src/services/)
  ├── 外观门面 (Facade): api-switch-core.ts
  ├── 思源内核适配器: siyuan-adapter.ts (内核 AI 配置读写、双向同步与 ai.json 导入导出)
  ├── 提供商仓储: provider-store.ts (Provider 增删改查)
  ├── 配置文件仓储: profile-store.ts (Profile 增删改查与有效参数继承计算)
  └── 插件接管分发器: plugin-binding-manager.ts (子插件注册、接管绑定与广播通知)
                 │
                 ▼
协议与生命周期层
  ├── 插件入口: src/index.ts (生命周期 onload / onunload)
  ├── 挂载启动: src/main.ts (Vue App 实例化与卸载)
  └── 全局类型: src/types/index.d.ts (SharedConfig, ApiProfile, SiyuanApiSwitch 等核心领域类型)
```

---

## 2. 目录结构与职责说明

```
siyuan-api-switch/
├── docs/                               # 项目文档
│   ├── API_SWITCH_INTEGRATION_GUIDE.md # 第三方插件开发者集成指南
│   ├── changelog.md                    # 版本更新日志
│   ├── project-structure.md            # 本文件：项目模块架构与职责映射
│   ├── refactor-plan.md                # 重构规划与执行跟踪日志
│   └── sample-plugin-integration.ts    # 示例插件集成源码
│
├── src/                                # 源码根目录
│   ├── components/                     # UI 业务面板组件
│   │   ├── PluginBindingsPanel.vue     # 子插件接管状态与配置绑定面板
│   │   ├── ProfileEditPanel.vue        # API Profile 表单编辑与参数池联动面板
│   │   └── ProviderEditPanel.vue       # API Provider 账号、协议与模型池编辑面板
│   │
│   ├── composables/                    # 组合式函数 (Composables)
│   │   └── useWindowDrag.ts            # 弹窗拖拽移动、8方向缩放、最大化/还原及本地持久化
│   │
│   ├── i18n/                           # 多语言本地化资源
│   │   ├── en_US.json
│   │   └── zh_CN.json
│   │
│   ├── services/                       # 核心业务服务层 (解耦单例组合)
│   │   ├── api-switch-core.ts          # ApiSwitchCore 统一外观门面类
│   │   ├── plugin-binding-manager.ts   # PluginBindingManager 子插件接管注册与变更分发管理器
│   │   ├── profile-store.ts            # ProfileStore 配置文件内存仓储与继承解析
│   │   ├── provider-store.ts           # ProviderStore API 提供商仓储
│   │   └── siyuan-adapter.ts           # SiyuanAdapter 思源笔记内核 API 交互与 ai.json 格式转换
│   │
│   ├── styles/                         # 样式文件
│   │   └── dialog.scss                 # 弹窗容器、表单、标签池与动效样式
│   │
│   ├── types/                          # TypeScript 类型声明
│   │   ├── env.d.ts                    # Vue SFC 模块声明
│   │   └── index.d.ts                  # 全局领域模型、思源协议与 Window 接口扩展
│   │
│   ├── App.vue                         # 主界面容器组件 (左右侧分栏、路由与同步调度)
│   ├── index.scss                      # 全局基础样式与 SVG 图标防填充覆盖
│   ├── index.ts                        # 插件主入口 (ApiSwitchPlugin)
│   └── main.ts                         # Vue 应用挂载与销毁生命周期
│
├── tests/                              # 自动化测试套件
│   ├── mocks/                          # 测试桩与环境 Mock
│   │   └── siyuan.ts                   # 思源笔记核心 API 的轻量运行桩
│   └── unit/                           # 单元测试用例
│       ├── binding-manager.test.ts     # 子插件注册与实时配置分发测试
│       ├── effective-profile.test.ts   # Profile 继承 Provider 参数与优先级计算测试
│       ├── extract-siyuan-ai.test.ts   # 思源原生 AI 设置抽取与 fallback 机制测试
│       └── import-export.test.ts       # 思源原生 ai.json 双向序列化与兼容转换测试
│
├── package.json                        # 依赖与脚本配置 (含 build / test / dev / release)
├── tsconfig.json                       # TypeScript 编译配置
├── vite.config.ts                      # Vite 插件打包配置 (Rollup CJS 库格式)
└── vitest.config.ts                    # Vitest 单元测试运行配置
```

---

## 3. 核心领域模型

| 类型名 | 所在文件 | 说明 |
| :--- | :--- | :--- |
| `SharedConfig` | `src/types/index.d.ts` | 旋钮向第三方子插件分发的统一只读配置协议包（含 protocol、headers 等增强项） |
| `ApiProvider` | `src/types/index.d.ts` | 底层服务商账号（Base URL、API Key、Protocol、Headers、Model池） |
| `ApiProfile` | `src/types/index.d.ts` | 场景配置文件（可独立设置或关联 Provider 继承参数，配置 Token/温度/上下文） |
| `SiyuanAiJson` | `src/types/index.d.ts` | 对齐思源笔记原生 `ai.json` 的四根节点规范与扩展数据格式 |
| `SiyuanApiSwitch` | `src/types/index.d.ts` | 挂载于 `window.siyuanApiSwitch` 的全局注册管理协议接口 |
| `RegisteredPluginInfo` | `src/services/plugin-binding-manager.ts` | 注册插件的接管状态、绑定 ID 与本地配置快照 |

---

## 4. 开发与测试指令

- **启动单元测试**：`npm test`（基于 Vitest，支持毫秒级快速运行所有单测）
- **类型检查**：`npx tsc --noEmit`（基于 TypeScript 编译器严格类型审查）
- **生产构建打包**：`npm run build`（编译产物输出至 `dist/` 并自动打包 `package.zip`）
- **监听构建调试**：`npm run dev`（持续监听源码变动并实时增量构建）
