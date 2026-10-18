# API 旋钮 (siyuan-api-switch) 第三方插件集成开发指南

本文档旨在指导思源笔记第三方插件开发者快速接入「**API 旋钮 (`siyuan-api-switch`)**」，实现 AI API 配置的全量接管、多模型槽位独立调度、实时无感重定向、设置面板置灰禁用及动态联动。

---

## 一、集成架构与核心概念

API 旋钮通过在全局 `window` 对象上挂载 `window.siyuanApiSwitch` 单例服务，为各个子插件提供配置注册、槽位定义与变更广播回调。

### 1.1 核心数据结构

#### 1. `SharedConfig`（旋钮下发的共享配置对象）

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

#### 2. `PluginSlotDefinition` 与 `RegisterPluginOptions`（多模型槽位定义）

```typescript
export interface PluginSlotDefinition {
  /** 槽位唯一标识，例如 "chat" | "decision" */
  id: string;
  /** 槽位显示名称，例如 "对话模型" | "决策模型" */
  name: string;
  /** 槽位详细说明（可选） */
  description?: string;
  /** 槽位本地初始降级配置快照（可选，用于一键导入） */
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

#### 3. `SiyuanApiSwitch`（全局管理服务）

```typescript
export interface SiyuanApiSwitch {
  version: string;
  /**
   * 注册子插件到 API 旋钮
   * 支持通过 RegisterPluginOptions 对象注册（推荐），亦兼容传统多参数重载方式
   */
  register(
    pluginIdOrOptions: string | RegisterPluginOptions,
    displayName?: string,
    callback?: (config: SharedConfig | null, slotId?: string) => void,
    localConfig?: Omit<SharedConfig, "profileId" | "profileName">,
    options?: { slots?: PluginSlotDefinition[] }
  ): void;

  /**
   * 取消注册子插件
   */
  unregister(pluginId: string): void;

  /**
   * 获取指定插件或槽位当前绑定的配置（未接管时返回 null）
   */
  getBoundConfig(pluginId: string, slotId?: string): SharedConfig | null;
}
```

---

## 二、规范要求与最佳实践

为了保障用户体验的一致性与严谨性，集成 API 旋钮的子插件需遵循以下规范：

1. **输入框置灰禁用 (`disabled`)**：
   - 当插件或槽位处于接管状态时，设置面板中相关的 API 配置输入框（Base URL、API Key、Model、Timeout、Temperature、Max Tokens 等）必须被置灰禁用，防止用户混淆修改。
2. **统一接管提示横幅**：
   - 在设置面板 AI 配置区域或对应槽位上方显示统一样式的提示横幅：
     `💡 通用 AI API 已由 <strong>API 旋钮 (siyuan-api-switch)</strong> 接管 (Profile: ${profileName})。相关输入框已置灰只读，如需修改请前往 API 旋钮面板。`
3. **零刷新实时更新**：
   - 当插件的设置弹窗处于打开状态时，若用户在 API 旋钮中切换或修改了绑定 Profile，子插件设置弹窗内的输入框数值、置灰状态及横幅文本应**实时无感更新**，无需重启或重新打开设置面板。
4. **解绑平滑恢复**：
   - 当用户在 API 旋钮中解除对该插件或特定槽位的接管（`callback(null, slotId)`）时，插件应无缝还原为本地原始配置，重新启用输入框并移除接管横幅。
5. **AI 请求调用优先级与 Headers 合并**：
   - 插件在发起实际 AI 请求时，必须优先读取被接管的配置（`managedConfig || localConfig`），并**务必合并**下发的 `config.headers`，确保自定义网关与中转鉴权正常通信。

---

## 三、标准集成步骤与代码示例

### 步骤 1：添加类型声明 (`src/types/index.d.ts`)

在插件项目中为全局 `window` 扩展类型：

```typescript
declare global {
  interface Window {
    siyuanApiSwitch?: import("../docs/sample-plugin-integration").SiyuanApiSwitch;
  }
}
```

### 步骤 2：初始化注册与监听

#### 模式 A：单一模型极简接入（适用于单 AI 任务插件）

在子插件生命周期的 `onload` 中初始化同步，并在 `onunload` 中解除注册：

```typescript
import { Plugin } from "siyuan";
import type { SharedConfig } from "./types";

export default class MyPlugin extends Plugin {
  private localAiConfigBackup: any = null;
  private isManaged = false;
  private managedConfig: SharedConfig | null = null;

  async onload() {
    this.initApiSwitchSync();
  }

  onunload() {
    if (window.siyuanApiSwitch) {
      window.siyuanApiSwitch.unregister(this.name);
    }
  }

  private initApiSwitchSync() {
    const sync = (shared: SharedConfig | null) => {
      if (shared) {
        // 第一次接管时，备份本地配置供解绑还原
        if (!this.isManaged) {
          this.localAiConfigBackup = {
            baseUrl: this.config.baseUrl,
            apiKey: this.config.apiKey,
            model: this.config.model,
            timeout: this.config.timeout,
            temperature: this.config.temperature,
            maxTokens: this.config.maxTokens,
          };
          this.isManaged = true;
        }

        this.managedConfig = shared;

        // 更新插件当前运行参数
        this.config.baseUrl = shared.baseUrl;
        this.config.apiKey = shared.apiKey;
        this.config.model = shared.model;
        if (shared.requestTimeoutSeconds !== undefined) this.config.timeout = shared.requestTimeoutSeconds;
        if (shared.temperature !== undefined) this.config.temperature = shared.temperature;
        if (shared.maxTokens !== undefined) this.config.maxTokens = shared.maxTokens;

        this.config.isAiManaged = true;
        this.config.aiManagedProfileName = shared.profileName;

        // 若设置弹窗处于打开状态，触发响应式更新
        this.updateSettingsUiIfOpen(shared);
      } else {
        // 解除接管，恢复本地备份配置
        if (this.isManaged && this.localAiConfigBackup) {
          this.config.baseUrl = this.localAiConfigBackup.baseUrl;
          this.config.apiKey = this.localAiConfigBackup.apiKey;
          this.config.model = this.localAiConfigBackup.model;
          this.config.timeout = this.localAiConfigBackup.timeout;
          this.config.temperature = this.localAiConfigBackup.temperature;
          this.config.maxTokens = this.localAiConfigBackup.maxTokens;
          this.localAiConfigBackup = null;
          this.isManaged = false;
        }

        this.managedConfig = null;
        this.config.isAiManaged = false;
        this.config.aiManagedProfileName = undefined;

        this.updateSettingsUiIfOpen(null);
      }
    };

    const activeLocal = this.isManaged ? this.localAiConfigBackup : this.config;
    const localConfig = {
      provider: "custom",
      baseUrl: activeLocal?.baseUrl || "",
      apiKey: activeLocal?.apiKey || "",
      model: activeLocal?.model || "",
      requestTimeoutSeconds: activeLocal?.timeout,
      temperature: activeLocal?.temperature,
      maxTokens: activeLocal?.maxTokens,
    };

    const register = () => {
      window.siyuanApiSwitch?.register(this.name, this.displayName, sync, localConfig);
    };

    if (window.siyuanApiSwitch) {
      register();
    } else {
      window.addEventListener("siyuan-api-switch:ready", register, { once: true });
    }
  }

  private updateSettingsUiIfOpen(shared: SharedConfig | null) {
    // 刷新设置面板 UI
  }
}
```

#### 模式 B：多模型槽位接入（适用于对话 + 决策意图等多任务复合插件）

```typescript
import { Plugin } from "siyuan";
import type { SharedConfig, RegisterPluginOptions } from "./types";

export default class ComplexPlugin extends Plugin {
  // 分槽位保存接管配置
  private managedSlots: Record<string, SharedConfig | null> = {
    chat: null,
    decision: null,
  };

  async onload() {
    this.initMultiSlotSync();
  }

  onunload() {
    window.siyuanApiSwitch?.unregister(this.name);
  }

  private initMultiSlotSync() {
    const syncCallback = (shared: SharedConfig | null, slotId?: string) => {
      const key = slotId || "chat";
      this.managedSlots[key] = shared;

      // 实时通知设置页刷新对应槽位 UI
      this.refreshSlotSettingsUi(key, shared);
    };

    const registerOptions: RegisterPluginOptions = {
      pluginId: this.name,
      displayName: this.displayName,
      callback: syncCallback,
      slots: [
        {
          id: "chat",
          name: "主对话模型",
          description: "用于长文撰写、卡片生成与多轮交互",
          localConfig: {
            provider: "custom",
            baseUrl: this.config.chatBaseUrl,
            apiKey: this.config.chatApiKey,
            model: this.config.chatModel,
          },
        },
        {
          id: "decision",
          name: "决策与分类模型",
          description: "用于意图识别、路由分类与轻量决策判别",
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
      window.siyuanApiSwitch?.register(registerOptions);
    };

    if (window.siyuanApiSwitch) {
      register();
    } else {
      window.addEventListener("siyuan-api-switch:ready", register, { once: true });
    }
  }

  private refreshSlotSettingsUi(slotId: string, shared: SharedConfig | null) {
    // 针对特定槽位刷新置灰与横幅
  }
}
```

---

## 四、发起 AI 请求时的 Headers 合并与调用规范

在发起实际大模型请求时，**务必合并 `config.headers`**（无论是通过 `fetch` 还是思源原生 `forwardProxy`）：

```typescript
export async function sendAiCompletion(
  activeConfig: SharedConfig | LocalAiConfig,
  messages: Array<{ role: string; content: string }>
) {
  const url = `${activeConfig.baseUrl.replace(/\/+$/, "")}/chat/completions`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${activeConfig.apiKey}`,
    // 合并旋钮下发的自定义请求头（例如 OpenRouter-Title, 自定义鉴权网关 Header 等）
    ...((activeConfig as SharedConfig).headers || {}),
  };

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: activeConfig.model,
      messages,
      temperature: activeConfig.temperature ?? 0.7,
      max_tokens: activeConfig.maxTokens ?? 4096,
    }),
  });

  return await response.json();
}
```

---

## 五、设置面板 UI 联动处理

### 5.1 DOM 原生 / Siyuan Setting 类集成

如果使用思源 SDK 提供的 `Setting` 类构造设置页：

```typescript
function applyManagedStylesToSettingPanel(
  panelElement: HTMLElement,
  managedConfig: SharedConfig | null,
  slotId?: string
) {
  const selector = slotId ? `.api-switch-managed-tip[data-slot="${slotId}"]` : ".api-switch-managed-tip";
  const existingTip = panelElement.querySelector(selector);
  if (existingTip) existingTip.remove();

  const fieldSelector = slotId ? `[data-slot="${slotId}"] input, [data-slot="${slotId}"] select` : "input, select, textarea";
  const inputs = panelElement.querySelectorAll<HTMLInputElement | HTMLSelectElement>(fieldSelector);

  if (managedConfig) {
    // 1. 设置输入框置灰
    inputs.forEach((input) => {
      if (input.dataset.settingKey?.startsWith("ai-") || !slotId) {
        input.disabled = true;
      }
    });

    // 2. 插入统一横幅
    const tip = document.createElement("div");
    tip.className = "api-switch-managed-tip";
    if (slotId) tip.dataset.slot = slotId;
    tip.style.cssText = `
      background-color: rgba(63, 81, 181, 0.08);
      border: 1px solid rgba(63, 81, 181, 0.2);
      border-radius: 6px;
      padding: 10px 12px;
      margin-bottom: 12px;
      font-size: 12px;
      line-height: 1.5;
      color: var(--b3-theme-on-background);
      grid-column: 1 / -1;
    `;
    tip.innerHTML = `💡 通用 AI API 已由 <strong>API 旋钮 (siyuan-api-switch)</strong> 接管 (Profile: ${managedConfig.profileName || '未命名'})。相关输入框已置灰只读，如需修改请前往 API 旋钮面板。`;

    const targetSection = panelElement.querySelector(slotId ? `.slot-section-${slotId}` : ".ai-settings-section") || panelElement;
    targetSection.insertBefore(tip, targetSection.firstChild);
  } else {
    // 3. 解除置灰
    inputs.forEach((input) => {
      input.disabled = false;
    });
  }
}
```

### 5.2 Vue / React 响应式集成

```vue
<template>
  <div class="settings-panel">
    <!-- 接管提示横幅 -->
    <div v-if="isAiManaged" class="api-switch-managed-tip">
      💡 通用 AI API 已由 <strong>API 旋钮 (siyuan-api-switch)</strong> 接管 
      (Profile: {{ currentManagedProfileName || '未命名' }})。相关输入框已置灰只读，如需修改请前往 API 旋钮面板。
    </div>

    <!-- AI 配置表单 -->
    <div class="form-group">
      <label>Base URL</label>
      <input type="text" v-model.trim="config.baseUrl" :disabled="isAiManaged" />
    </div>

    <div class="form-group">
      <label>API Key</label>
      <input type="password" v-model.trim="config.apiKey" :disabled="isAiManaged" />
    </div>

    <div class="form-group">
      <label>Model</label>
      <input type="text" v-model.trim="config.model" :disabled="isAiManaged" />
    </div>
  </div>
</template>
```

---

## 六、参考示例与项目落地

已成功集成 API 旋钮与多槽位协议的官方生态项目参考：
1. **[siyuan-muse (Muse 写作助手)](https://github.com/famotime/siyuan-muse)**：长文与卡片生成，支持全功能接管。
2. **[siyuan-doc-assist (文档助手)](https://github.com/famotime/siyuan-doc-assist)**：智能摘要、好标题、图片 OCR，支持 DOM & 原生 Setting 置灰。
3. **[siyuan-network-lens (脉络镜)](https://github.com/famotime/siyuan-network-lens)**：Wiki 生成与问答，支持 Vue 响应式驱动联动。
4. **[siyuan-canvas (无界画布)](https://github.com/famotime/siyuan-canvas)**：白板脑图下钻与卡片生成。
5. **[siyuan-time-spent (时间统计)](https://github.com/famotime/siyuan-time-spent)**：时间日志 AI 总结与复盘。
