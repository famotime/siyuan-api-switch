# 思源笔记 API 旋钮 (siyuan-api-switch)

思源笔记 API 旋钮是一款旨在帮助用户集中化管理、无缝切换、多端共享 AI 服务 API 配置，并能深度双向联动思源笔记原生 AI 引擎的全局配置中枢插件。

---

## 💡 为什么需要 API 旋钮？

思源笔记生态中有大量优秀的 AI 辅助插件（如 Muse 写作助手、文档助手、脉络镜、无界画布、时间统计等），同时思源笔记本体也在「设置 - 人工智能」中内置了强大的 AI 引擎（包含编辑器改写、智能体对话、决策模型等）。

然而在过去，配置 AI 服务面临诸多痛点：
- **割裂繁琐**：每个插件都要单独填写 Base URL、API Key、模型名称；更换密钥或模型时需要在多处逐个修改。
- **与思源本体脱节**：思源原生配置了一套 API 提供商与模型，第三方插件却无法直接复用，造成配置重复与管理混乱。
- **网关与定制头受限**：部分中转服务（如 OpenRouter、One API 或自建内网网关）需要特定 Header 鉴权或区分协议，传统插件难以统一支持。

**“API 旋钮”正是为了彻底终结上述痛点而打造的全局统一配置中枢（Hub）**。只需在此统一配置，即可同时接管思源原生 AI 场景与所有兼容插件，实现一处更新、全局生效、丝滑轮转。

---

## ✨ 核心特性

### 1. 层次化架构：API 提供商池 + 场景配置 Profile
- **底层 API 提供商 (Providers)**：
  - 统一维护您的模型底座供应商账号（例如 DeepSeek、OpenAI、Gemini、Claude、SiliconFlow 或自定义网关）。
  - 集中配置 Base URL、API Key、通信协议（`openai` / `gemini` / `anthropic`）、超时时间、**自定义 HTTP Headers** 及支持的模型清单。
- **上层场景配置 (Profiles)**：
  - **继承机制**：Profile 可直接下拉关联已配置的提供商，自动继承其通信参数与密钥，并直接从模型池中点选模型；
  - **独立定制**：亦可脱离提供商，单独设置定制化的 Base URL、Key、温度与 Token 限制；
  - **决策模型标识**：支持将 Profile 标记为决策判别模型，专用于意图分类与决策场景。

### 2. 思源笔记原生 4 大场景深度双向联动
插件深度打通思源笔记内核，实现对思源「设置 - 人工智能」的原生接管：
- **API 提供商 (Providers)**：完整同步思源原生配置的提供商与可用模型列表。
- **思源 - 编辑器 (Editing)**：接管思源笔记内置的快捷 AI 改写、补全与内容生成。
- **思源 - 智能体 (Agent)**：接管思源原生的对话智能体与多轮 Agent 助手。
- **思源 - 决策模型 (Decision)**：接管思源内核用于自动化路由分类的决策模型。
- **双向同步能力**：
  - 🔄 **「从思源读取」**：一键从思源内核拉取最新的原生提供商与场景模型配置，自动解析纳入旋钮管理池。
  - 🚀 **「写回思源」**：在旋钮中完成配置优化或切换后，一键无缝热写回思源笔记原生内核，思源立即生效。
  - 🎛️ **原生场景独立接管**：思源-编辑器、思源-智能体、思源-决策模型均在接管面板中独立呈现，切换旋钮绑定即可秒级写回思源。

### 3. 一键分发接管 5 大插件生态
- 自动发现并接管全局注册的兼容插件（Muse 写作助手、文档助手、脉络镜、无界画布、时间统计）。
- **零输入一键导入**：检测到插件本地原有配置时，提供一键提取导入为旋钮 Profile 并立即接管。
- **统一请求增强**：下发配置全面携带自定义 `headers` 与 `protocol`，确保所有插件在面对复杂中转网关时依然稳定通信。
- **置灰反馈**：子插件在被接管后，原生面板自动提示当前由 API 旋钮接管并显示 Profile 名称，配置项防误改置灰。

### 4. 完全对齐思源原生 `ai.json` 的统一导入与导出
- 导出文件严格遵循思源笔记 `ai.json` 标准格式：
  - 包含 `providers`, `editing`, `agent`, `decision` 4 大思源原生配置根节点，思源本体可直接无损读取。
  - 附带 `_siyuanApiSwitch` 扩展元数据，完整记录 Profile 配置池及全部子插件的接管绑定状态。
- 跨设备迁移时一键导入，配置池与接管绑定关系 100% 完整复原。
- 完美向下兼容旧版纯 Profile 数组格式的 JSON 文件。

### 5. 优雅的降级保护
- 全局解耦设计：若未安装或停用 API 旋钮插件，所有子插件将完全无感地继续使用其自身独立的本地配置，绝不影响日常使用。

---

## 📦 已适配接管的插件与原生场景

| 目标应用 / 插件 | 场景说明 | 接管支持状态 |
| :--- | :--- | :---: |
| **思源笔记 - 编辑器** | 思源原生快捷 AI 改写与内容续写 | ✅ 原生双向写回 |
| **思源笔记 - 智能体** | 思源原生多轮对话智能体与 Agent | ✅ 原生双向写回 |
| **思源笔记 - 决策模型** | 思源内核意图路由与分类判别 | ✅ 原生双向写回 |
| [**siyuan-muse (Muse 写作助手)**](https://github.com/famotime/siyuan-muse) | 智能长文撰写、卡片激发与交互式创作 | ✅ 全功能接管 |
| [**siyuan-doc-assist (文档助手)**](https://github.com/famotime/siyuan-doc-assist) | AI 智能摘要、好标题生成、段落翻译、废话标记、图片 OCR | ✅ 全功能接管 |
| [**siyuan-network-lens (脉络镜)**](https://github.com/famotime/siyuan-network-lens) | LLM Wiki 维护生成、知识网脉络分析、Wiki 对话问答 | ✅ 全功能接管 |
| [**siyuan-canvas (无界画布)**](https://github.com/famotime/siyuan-canvas) | 白板思维导图关联节点 AI 探索下钻与卡片生成 | ✅ 全功能接管 |
| [**siyuan-time-spent (时间统计)**](https://github.com/famotime/siyuan-time-spent) | 时间日志 AI 智能总结与目标复盘 | ✅ 全功能接管 |

---

## 🛠️ 第三方插件接入协议 (开发者指南)

作为思源笔记插件开发者，您只需在子插件中加入极简的同步逻辑，即可支持通过 API 旋钮 进行统一配置管理。

### 1. 协议核心数据结构 (`SharedConfig`)

```typescript
export interface SharedConfig {
  /** 绑定的 Profile 唯一标识 */
  profileId: string;
  /** Profile 显示名称，如 "DeepSeek-V3 默认" */
  profileName: string;
  /** 服务商标识，如 "deepseek", "openai", "siliconflow", "custom" 等 */
  provider: string;
  /** API 基础 URL，如 "https://api.deepseek.com/v1" */
  baseUrl: string;
  /** API Key / 鉴权密钥 */
  apiKey: string;
  /** 当前选中的主模型名称，如 "deepseek-chat" */
  model: string;
  /** 候选模型列表（可选） */
  models?: string[];
  /** 通信协议（可选）："openai" | "gemini" | "anthropic" */
  protocol?: string;
  /** 请求超时时间（秒，可选） */
  requestTimeoutSeconds?: number;
  /** 采样温度 (0.0 - 2.0，可选) */
  temperature?: number;
  /** 最大输出 Token 数（可选） */
  maxTokens?: number;
  /** 自定义 HTTP Headers 字典（可选，如中转网关特定鉴权头） */
  headers?: Record<string, string>;
  /** 是否为分类决策模型（可选） */
  isDecisionModel?: boolean;
  /** Profile 备注说明（可选） */
  memo?: string;
  /** 服务商官网地址（可选） */
  providerUrl?: string;
}
```

### 2. 初始化时注册并监听

在子插件的 `onload` 生命周期中加入以下注册逻辑，在回调中接收旋钮下发的配置并在请求时携带 `headers`：

```typescript
// 插件内存中保存的接管配置
private managedAiConfig: SharedConfig | null = null;

private initApiSwitchSync() {
  const sync = (shared: SharedConfig | null) => {
    if (shared) {
      // 1. 进入接管状态：将旋钮下发的 SharedConfig 保存并覆盖本地请求参数
      this.managedAiConfig = {
        ...shared,
        requestTimeoutSeconds: shared.requestTimeoutSeconds ?? 60,
        temperature: shared.temperature ?? 0.7,
        maxTokens: shared.maxTokens ?? 4096,
      };
    } else {
      // 2. 退出接管状态：还原为插件原生的本地配置
      this.managedAiConfig = null;
    }

    // 3. 通知插件设置面板重新渲染（置灰或解禁输入项）
    if (this.setting) {
      (this.setting as any).updateManagedConfig?.(this.managedAiConfig);
    }
  };

  // 4. 提取当前插件已有的本地配置快照，供旋钮做一键导入迁移
  const localConfig = {
    provider: "custom",
    baseUrl: this.config.baseUrl,
    apiKey: this.config.apiKey,
    model: this.config.model,
    requestTimeoutSeconds: this.config.requestTimeoutSeconds,
    temperature: this.config.temperature,
    maxTokens: this.config.maxTokens,
  };

  if (window.siyuanApiSwitch) {
    window.siyuanApiSwitch.register(this.name, this.displayName, sync, localConfig);
  } else {
    // 兼容思源笔记并行加载插件时，旋钮晚于当前插件加载完成的情况
    window.addEventListener("siyuan-api-switch:ready", () => {
      if (window.siyuanApiSwitch) {
        window.siyuanApiSwitch.register(this.name, this.displayName, sync, localConfig);
      }
    }, { once: true });
  }
}
```

### 3. 在 API 请求中合并自定义 Headers

发起大模型请求（无论是 `fetch` 还是思源内核 `forwardProxy`）时，务必合并 `config.headers`：

```typescript
// 以 fetch 为例
const activeConfig = this.managedAiConfig || this.localConfig;
const response = await fetch(`${activeConfig.baseUrl.replace(/\/+$/, "")}/chat/completions`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${activeConfig.apiKey}`,
    ...(activeConfig.headers || {}), // 合并旋钮下发的自定义请求头
  },
  body: JSON.stringify({
    model: activeConfig.model,
    messages,
    temperature: activeConfig.temperature,
    max_tokens: activeConfig.maxTokens,
  }),
});
```

### 4. 卸载时注销

在子插件的 `onunload` 中注销以清理监听：

```typescript
onunload() {
  if (window.siyuanApiSwitch) {
    window.siyuanApiSwitch.unregister(this.name);
  }
}
```

---

## 📱 平台兼容性

- **桌面端 / 浏览器端 (Desktop / Web)**：深度适配，功能完全支持。
- **移动端 (Mobile)**：目前以桌面端与平板为主。移动端可在无旋钮接管时无缝使用子插件原生配置，建议在桌面端完成全局 Profiles 管理与分配。

---

## 📄 开源许可证

本项目基于 [MIT 许可证](LICENSE) 开源。
