# 思源笔记 API 旋钮 (siyuan-api-switch)

思源笔记 API 旋钮是一款旨在帮助用户集中化管理、无缝切换、多端共享 AI 服务 API 配置，并能深度双向联动思源笔记原生 AI 引擎的全局配置中枢插件。

---

## 💡 为什么需要 API 旋钮？

思源笔记生态中有大量优秀的 AI 辅助插件，同时思源笔记本体也在「设置 - 人工智能」中内置了强大的 AI 引擎（包含快捷编辑器改写、智能体对话、决策模型等）。

然而在过去，配置 AI 服务面临诸多痛点：
- **割裂繁琐**：每个插件都要单独填写 Base URL、API Key、模型名称；更换密钥或模型时需要在多处逐个修改。
- **与思源本体脱节**：思源原生配置了一套 API 提供商与模型，第三方插件却无法直接复用，造成配置重复与管理混乱。
- **网关与定制头受限**：部分中转服务（如 OpenRouter、One API 或自建内网网关）需要特定 Header 鉴权或区分协议，传统插件难以统一支持。
- **多模型任务配置困难**：部分高级插件同时需要「主对话模型」与「意图判别/决策模型」，单一套配置无法满足精细化分工。

**“API 旋钮”正是为了彻底终结上述痛点而打造的全局统一配置中枢（Hub）**。只需在此统一配置，即可同时接管思源原生 AI 场景与所有兼容插件，实现一处更新、全局生效、丝滑轮转。

---

## ✨ 核心特性

### 1. 统一顶栏入口与层次化架构 (Providers + Profiles)
- 🌟 **顶栏快捷入口**：思源笔记顶部工具栏新增专属旋钮图标，随时随地一键唤出或关闭统一配置中心，告别多层设置菜单寻址。
- **底层 API 提供商 (Providers)**：
  - 统一维护模型底座供应商账号（例如 DeepSeek、OpenAI、Gemini、Claude、SiliconFlow 或自定义网关）。
  - 集中配置 Base URL、API Key、通信协议（`openai` / `gemini` / `anthropic`）、超时时间、**自定义 HTTP Headers** 及支持的模型清单。
- **上层场景配置 (Profiles)**：
  - **继承机制**：Profile 可直接下拉关联已配置的提供商，自动继承其通信参数与密钥，并直接从模型池中点选模型；
  - **独立定制**：亦可脱离提供商，单独设置定制化的 Base URL、Key、温度与 Token 限制；
  - **决策模型通用标识**：支持将 Profile 标记为决策判别模型，专用于意图分类与轻量决策场景。
- ⚡ **合法预设配置自动生成与关联 Provider**：
  - 新建或编辑 Profile 时，若选择了主流预设服务商（DeepSeek、Gemini、SiliconFlow、OpenAI 等）或输入有效 Base URL，系统将**自动识别并智能生成/匹配底层的 API 提供商**，并补全官方端点与推荐模型池，无需反复跨面板手动创建 Provider。
  - 创建 Profile 未填 Base URL 时，系统会自动补齐官方预设地址并提供轻量反馈。

### 2. 思源笔记原生 4 大场景深度自动联动
深度打通思源笔记内核，实现对思源「设置 - 人工智能」的原生接管：
- **API 提供商 (Providers)**：完整同步思源原生配置的提供商与可用模型列表。
- **思源 - 编辑器 (Editing)**：接管思源笔记内置的快捷 AI 改写、补全与内容生成。
- **思源 - 智能体 (Agent)**：接管思源原生的对话智能体与多轮 Agent 助手。
- **思源 - 决策模型 (Decision)**：接管思源内核用于自动化路由分类的决策判别模型。
- **双向无感联动与增量写回**：
  - 🔄 **「从思源读取」**：一键从思源内核拉取最新的原生提供商与场景配置；内置内核级 AES 密文解密（`siyuan-crypto`）与多变命名 API Key 提取，原生 Jev 决策模型与第三方模型端点精准解析。
  - ⚡ **静默自动联动写回**：在接管面板中为思源原生场景切换绑定或调整参数后，系统自动静默精准写回思源内核，无需手动点击写回按钮与确认弹窗。
  - 🛡️ **安全隔离与合并**：增量写回仅同步已接管的场景项，安全合并底层 Provider，绝不污染或覆盖思源原生未接管的配置与原生 `openAI` 设置。
  - 🧩 **编辑器与智能体解耦**：思源-编辑器与思源-智能体解耦为独立 Profile，各自参数与模型独立调优、互不影响。

### 3. 多模型槽位协议（Multi-Slot Protocol）与生态接管
- **多模型槽位协议**：突破单一插件只能绑定一个模型的局限，全面支持子插件注册多模型槽位（如「主对话模型」与「决策分类模型」独立接管）。
- **槽位级独立展示与接管**：接管面板按插件卡片内的槽位清晰陈列，各槽位支持独立绑定不同 Profile、独立本地配置解析与独立通知广播。
- **一键分发接管 5 大插件生态**：自动发现并接管全局注册的兼容插件（Muse 写作助手、文档助手、脉络镜、无界画布、时间统计）。
- **零输入一键导入**：检测到插件本地原有配置时，提供一键提取导入为旋钮 Profile 并立即完成绑定。
- **统一请求增强**：下发配置全面携带自定义 `headers` 与 `protocol`，确保所有插件在面对复杂中转网关时稳定通信。
- **置灰反馈**：子插件在被接管后，原生面板自动提示当前由 API 旋钮接管并显示 Profile 名称，配置输入框自动防误改置灰。

### 4. 配置提取智能去重与防重复生成 (Smart Deduplication)
- 提取思源原生配置或子插件本地配置时，内置多维一致性比对与评分算法（Base URL 归一化、协议兼容判定、Key 比对、模型匹配等）。
- 优先复用已有相同配置并自动绑定，合并已有 Provider 模型列表，彻底避免重复同步导致生成大量同名冗余项。

### 5. 完全对齐思源原生 `ai.json` 的统一导入与导出
- 导出文件严格遵循思源笔记 `ai.json` 标准格式：
  - 包含 `providers`, `editing`, `agent`, `decision` 4 大思源原生配置根节点，思源本体可直接无损读取。
  - 附带 `_siyuanApiSwitch` 扩展元数据，完整记录 Profile 配置池及全部子插件各槽位的接管绑定状态。
- 跨设备迁移时一键导入，配置池与接管绑定关系 100% 完整复原。
- 完美向下兼容旧版纯 Profile 数组格式的 JSON 文件。

### 6. 优雅的降级保护
- 全局解耦设计：若未安装或停用 API 旋钮插件，所有子插件将完全无感地继续使用其自身独立的本地配置，绝不影响日常使用。

---

## 📦 已适配接管的插件与原生场景

| 目标应用 / 插件 | 场景说明 | 接管支持状态 |
| :--- | :--- | :---: |
| **思源笔记 - 编辑器** | 思源原生快捷 AI 改写与内容续写 | ✅ 原生增量自动联动 |
| **思源笔记 - 智能体** | 思源原生多轮对话智能体与 Agent | ✅ 原生增量自动联动 |
| **思源笔记 - 决策模型** | 思源内核意图路由与分类判别 | ✅ 原生增量自动联动 |
| [**siyuan-muse (Muse 写作助手)**](https://github.com/famotime/siyuan-muse) | 智能长文撰写、卡片激发与交互式创作 | ✅ 全功能多槽位接管 |
| [**siyuan-doc-assist (文档助手)**](https://github.com/famotime/siyuan-doc-assist) | AI 智能摘要、好标题生成、段落翻译、废话标记、图片 OCR | ✅ 全功能接管 |
| [**siyuan-network-lens (脉络镜)**](https://github.com/famotime/siyuan-network-lens) | LLM Wiki 维护生成、知识网脉络分析、Wiki 对话问答 | ✅ 全功能接管 |
| [**siyuan-canvas (无界画布)**](https://github.com/famotime/siyuan-canvas) | 白板思维导图关联节点 AI 探索下钻与卡片生成 | ✅ 全功能接管 |
| [**siyuan-time-spent (时间统计)**](https://github.com/famotime/siyuan-time-spent) | 时间日志 AI 智能总结与目标复盘 | ✅ 全功能接管 |

---

## 🛠️ 第三方插件接入协议 (开发者指南)

作为思源笔记插件开发者，您只需在子插件中加入极简的同步逻辑，即可支持通过 API 旋钮 进行统一配置管理与多模型槽位接管。

### 1. 协议核心数据结构

#### 1.1 `SharedConfig`（旋钮下发的只读共享配置）

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

#### 1.2 `PluginSlotDefinition` 与 `RegisterPluginOptions`（多槽位协议定义）

```typescript
export interface PluginSlotDefinition {
  /** 槽位唯一标识，例如 "chat" | "decision" */
  id: string;
  /** 槽位显示名称，例如 "对话模型" | "决策模型" */
  name: string;
  /** 槽位详细说明（可选） */
  description?: string;
  /** 槽位本地降级配置快照（可选，用于一键导入） */
  localConfig?: Omit<SharedConfig, "profileId" | "profileName">;
}

export interface RegisterPluginOptions {
  pluginId: string;
  displayName: string;
  callback: (config: SharedConfig | null, slotId?: string) => void;
  slots?: PluginSlotDefinition[];
  localConfig?: Omit<SharedConfig, "profileId" | "profileName">;
}
```

#### 1.3 `SiyuanApiSwitch` 全局服务接口

```typescript
export interface SiyuanApiSwitch {
  version: string;
  /**
   * 注册子插件（支持对象式配置或多参数重载）
   */
  register(
    pluginIdOrOptions: string | RegisterPluginOptions,
    displayName?: string,
    callback?: (config: SharedConfig | null, slotId?: string) => void,
    localConfig?: Omit<SharedConfig, "profileId" | "profileName">,
    options?: { slots?: PluginSlotDefinition[] }
  ): void;
  /** 取消注册 */
  unregister(pluginId: string): void;
  /** 获取指定插件或槽位当前绑定的配置 */
  getBoundConfig(pluginId: string, slotId?: string): SharedConfig | null;
}
```

---

### 2. 初始化时注册并监听

#### 模式 A：极简单模型接入（适用于单一 AI 任务插件）

在子插件的 `onload` 生命周期中注册，在回调中接收旋钮下发的配置：

```typescript
// 插件内保存的接管配置
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

  const register = () => {
    window.siyuanApiSwitch?.register(this.name, this.displayName, sync, localConfig);
  };

  if (window.siyuanApiSwitch) {
    register();
  } else {
    // 兼容思源笔记并行加载插件时，旋钮晚于当前插件加载完成的情况
    window.addEventListener("siyuan-api-switch:ready", register, { once: true });
  }
}
```

#### 模式 B：多模型槽位接入（适用于同时具备对话与决策/意图识别的复合插件）

```typescript
// 区分管理不同槽位的生效配置
private managedSlotsConfig: Record<string, SharedConfig | null> = {
  chat: null,
  decision: null,
};

private initMultiSlotSync() {
  const syncSlot = (shared: SharedConfig | null, slotId?: string) => {
    const key = slotId || "chat";
    this.managedSlotsConfig[key] = shared;

    // 通知设置界面更新对应槽位的置灰状态与输入框显示
    this.setting?.refreshSlotUi?.(key, shared);
  };

  const options: RegisterPluginOptions = {
    pluginId: this.name,
    displayName: this.displayName,
    callback: syncSlot,
    slots: [
      {
        id: "chat",
        name: "对话生成模型",
        description: "用于长文续写、多轮对话与卡片内容生成",
        localConfig: {
          provider: "custom",
          baseUrl: this.config.chatBaseUrl,
          apiKey: this.config.chatApiKey,
          model: this.config.chatModel,
        },
      },
      {
        id: "decision",
        name: "意图分类模型",
        description: "用于轻量意图识别、路由决策与关键词打标",
        localConfig: {
          provider: "custom",
          baseUrl: this.config.decisionBaseUrl,
          apiKey: this.config.decisionApiKey,
          model: this.config.decisionModel,
        },
      },
    ],
  };

  const register = () => {
    window.siyuanApiSwitch?.register(options);
  };

  if (window.siyuanApiSwitch) {
    register();
  } else {
    window.addEventListener("siyuan-api-switch:ready", register, { once: true });
  }
}
```

---

### 3. 在 API 请求中合并自定义 Headers

发起大模型请求（无论是 `fetch` 还是思源内核 `forwardProxy`）时，务必合并 `config.headers`：

```typescript
// 以 fetch 为例，优先读取被接管的配置
const activeConfig = this.managedAiConfig || this.localConfig;

const response = await fetch(`${activeConfig.baseUrl.replace(/\/+$/, "")}/chat/completions`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${activeConfig.apiKey}`,
    ...(activeConfig.headers || {}), // 合并旋钮下发的自定义请求头（如中转网关鉴权）
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

## 💻 工程开发与测试

本项目采用 Vue 3 + TypeScript 构建，分层服务架构并配备完整的 Vitest 自动化单元测试套件：

```bash
# 启动单元测试套件 (7 大测试模块，51 个用例秒级全绿验证)
npm test

# 执行 TypeScript 静态类型检查
npx tsc --noEmit

# 生产环境构建打包 (输出 dist/ 及 package.zip)
npm run build

# 持续增量监听开发
npm run dev
```

### 自动化测试覆盖范围

- 🔌 **多模型槽位接管与通知广播** ([`binding-manager.test.ts`](file:///d:/MyCodingProjects/siyuan-api-switch/tests/unit/binding-manager.test.ts))：槽位隔离注册、复合键持久化、槽位独立绑定与实时通知分发
- 🛡️ **智能去重与防重复生成** ([`deduplicate-config.test.ts`](file:///d:/MyCodingProjects/siyuan-api-switch/tests/unit/deduplicate-config.test.ts))：URL 与协议归一化、Profile / Provider 多维评分比对算法与配置自动复用
- ⚡ **合法预设配置自动生成 Provider** ([`auto-generate-provider.test.ts`](file:///d:/MyCodingProjects/siyuan-api-switch/tests/unit/auto-generate-provider.test.ts))：预设服务商智能创建、官方默认端点补齐、推荐模型池扩充与冗余字段清理
- 🔐 **思源内核 AES 密文解密与增量写回** ([`siyuan-sync-and-decision.test.ts`](file:///d:/MyCodingProjects/siyuan-api-switch/tests/unit/siyuan-sync-and-decision.test.ts))：原生 Key 密文解密、编辑器与智能体独立解耦同步、已接管项精准增量写回与未接管项安全保护
- 📐 **参数继承与有效 Profile 计算** ([`effective-profile.test.ts`](file:///d:/MyCodingProjects/siyuan-api-switch/tests/unit/effective-profile.test.ts))：提供商参数级联继承、独立覆盖与优先级决策
- 📦 **思源原生 `ai.json` 导入导出** ([`import-export.test.ts`](file:///d:/MyCodingProjects/siyuan-api-switch/tests/unit/import-export.test.ts)、[`extract-siyuan-ai.test.ts`](file:///d:/MyCodingProjects/siyuan-api-switch/tests/unit/extract-siyuan-ai.test.ts))：4 大原生根节点规范对齐、扩展元数据无损嵌入与旧版兼容转换

详细模块职责与分层设计请参阅 [docs/project-structure.md](docs/project-structure.md)。

---

## 📄 开源许可证

本项目基于 [MIT 许可证](LICENSE) 开源。
