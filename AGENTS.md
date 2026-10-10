# AGENTS.md - 开发者与 AI 助手速查指南

## 1. 项目定位与架构概要

- **项目**: 思源笔记全局 AI 配置中枢插件 (`siyuan-api-switch`)。
- **架构**: Vue 3 + TypeScript，分层服务 + 外观门面 (Facade)。
  - `src/services/api-switch-core.ts`: 全局门面单例 (`apiSwitchCore`)，组合各子服务。
  - `src/services/provider-store.ts`: API 提供商 (Provider) 仓储。
  - `src/services/profile-store.ts`: 场景配置 (Profile) 仓储与参数继承解析。
  - `src/services/plugin-binding-manager.ts`: 子插件接管注册与事件广播。
  - `src/services/siyuan-adapter.ts`: 思源内核 AI 配置读写、双向同步与原生 `ai.json` 导入导出。
  - `src/composables/useWindowDrag.ts`: 弹窗拖拽、8向缩放与持久化。
  - `src/components/*.vue`: Provider、Profile、接管面板组件。
  - `src/types/index.d.ts`: 核心领域类型定义 (`SharedConfig`, `ApiProfile`, `ApiProvider` 等)。

## 2. 常用开发与验证命令

```bash
npm test            # 运行 Vitest 单元测试 (tests/unit/)
npx tsc --noEmit    # TypeScript 静态类型检查
npm run build       # Vite 生产构建与打包 (输出 dist/ 及 package.zip)
npm run dev         # 增量监听构建
```

## 3. Reference Projects

重要：在涉及解析思源笔记文档块结构和内容、确认 API 时，务必查看 developer_docs 目录下开发者文档和 siyuan-note 项目源码确认，不要凭猜测开发和测试。

路径按开发机器取用其一（两套路径指向同一批参考工程，不同机器布局不同）：

- siyuan-note（思源笔记源码项目）
  - Windows 开发机：`D:\MyCodingProjects\siyuan-note`
  - Linux 开发机：`/home/quincyzou/projects/siyuan-note`
- `developer_docs/`：思源笔记插件开发者文档
  - 仓库根目录，并已列入 `.gitignore`（仅本机参考，不入库、不推送）。
- 核对内核行为时以 siyuan-note 的 Go 源码为准（`kernel/server/serve.go`、`kernel/model/assets.go`），`app/src` 为前端实现参考；developer_docs 未覆盖的细节不要凭猜测推断。
