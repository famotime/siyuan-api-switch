# API 旋钮 (siyuan-api-switch) 第三方插件集成开发指南

本文档旨在指导思源笔记第三方插件开发者快速接入「**API 旋钮 (`siyuan-api-switch`)**」，实现 AI API 配置的全量接管、实时无感重定向、设置面板置灰禁用及动态联动。

---

## 一、集成架构与核心概念

API 旋钮通过在全局 `window` 对象上挂载 `window.siyuanApiSwitch` 服务，为各个子插件提供配置注册与重定向回调。

### 1.1 核心数据结构

#### `SharedConfig`（旋钮下发的共享配置对象）
```typescript
export interface SharedConfig {
  profileId: string;             // 绑定的 Profile 唯一标识
  profileName: string;           // Profile 名称，如 "DeepSeek-V3 默认"
  provider: string;              // 服务商标识，如 "deepseek", "openai", "siliconflow", "custom"
  baseUrl: string;               // API 基础 URL，如 "https://api.deepseek.com/v1"
  apiKey: string;                // API Key / 鉴权密钥
  model: string;                 // 当前启用的模型名称，如 "deepseek-chat"
  models?: string[];             // 候选模型列表
  requestTimeoutSeconds?: number;// 请求超时时间（秒）
  temperature?: number;          // 采样温度 (0.0 - 2.0)
  maxTokens?: number;            // 最大输出 Token 数
  memo?: string;                 // Profile 备注
  providerUrl?: string;          // 服务商官网链接
}
```

#### `SiyuanApiSwitch`（全局服务对象）
```typescript
export interface SiyuanApiSwitch {
  version: string;
  /**
   * 注册子插件到 API 旋钮
   * @param pluginId 插件唯一 ID（通常对应 plugin.json 中的 name 字段，如 "siyuan-doc-assist"）
   * @param displayName 插件显示的名称（如 "文档助手"）
   * @param callback 配置变更回调函数。当被接管或配置更新时传入 SharedConfig；当解除接管时传入 null
   * @param localConfig 插件本地配置快照（用于在旋钮界面中一键导入）
   */
  register(
    pluginId: string,
    displayName: string,
    callback: (config: SharedConfig | null) => void,
    localConfig?: Omit<SharedConfig, "profileId" | "profileName">
  ): void;

  /**
   * 取消注册子插件
   */
  unregister(pluginId: string): void;

  /**
   * 获取当前插件绑定的配置（若未接管则返回 null）
   */
  getBoundConfig(pluginId: string): SharedConfig | null;
}
```

---

## 二、规范要求与最佳实践

为了保障用户体验的一致性与严谨性，集成 API 旋钮的子插件需遵循以下规范：

1. **输入框置灰禁用 (`disabled`)**：
   - 当插件处于接管状态（`config.isAiManaged === true`）时，设置面板中相关的 API 配置输入框（Base URL、API Key、Model、Timeout、Temperature、Max Tokens、提供商下拉框等）必须被置灰禁用，防止用户混淆修改。
2. **统一接管提示横幅**：
   - 在设置面板 AI 配置区域的正上方显示统一样式的提示横幅：
     `💡 通用 AI API 已由 <strong>API 旋钮 (siyuan-api-switch)</strong> 接管 (Profile: ${profileName})。相关输入框已置灰只读，如需修改请前往 API 旋钮面板。`
3. **零刷新实时更新**：
   - 当插件的设置弹窗处于打开状态时，若用户在 API 旋钮中切换或修改了绑定 Profile，子插件设置弹窗内的输入框数值、置灰状态及横幅文本应**实时无感更新**，无需重启或重新打开设置面板。
4. **解绑平滑恢复**：
   - 当用户在 API 旋钮中解除对该插件的接管（`callback(null)`）时，插件应无缝还原为本地原始配置，重新启用输入框并移除接管横幅。
5. **AI 请求调用优先级**：
   - 插件在发起实际 AI API 请求时，必须优先读取被接管的配置（即 `managedConfig || localConfig`）。

---

## 三、标准集成步骤

### 步骤 1：添加类型声明 (`types/index.d.ts`)

在插件项目中为全局 `window` 扩展类型：

```typescript
declare global {
  interface Window {
    siyuanApiSwitch?: import("../docs/sample-plugin-integration").SiyuanApiSwitch;
  }
}
```

### 步骤 2：初始化注册与监听 (`src/index.ts`)

在插件生命周期的 `onload` 中初始化同步，并在 `onunload` 中解除注册：

```typescript
import { Plugin } from "siyuan";

export default class MyPlugin extends Plugin {
  private localAiConfigBackup: any = null;
  private isManaged = false;
  private managedConfig: any = null;

  async onload() {
    // 注册到 API 旋钮
    this.initApiSwitchSync();
  }

  onunload() {
    // 插件卸载时取消注册
    if (window.siyuanApiSwitch) {
      window.siyuanApiSwitch.unregister(this.name);
    }
  }

  private initApiSwitchSync() {
    const sync = (shared: any | null) => {
      if (shared) {
        // 第一次接管时，备份本地配置
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

        // 更新插件当前的运行配置
        this.config.baseUrl = shared.baseUrl;
        this.config.apiKey = shared.apiKey;
        this.config.model = shared.model;
        if (shared.requestTimeoutSeconds !== undefined) this.config.timeout = shared.requestTimeoutSeconds;
        if (shared.temperature !== undefined) this.config.temperature = shared.temperature;
        if (shared.maxTokens !== undefined) this.config.maxTokens = shared.maxTokens;
        
        this.config.isAiManaged = true;
        this.config.aiManagedProfileName = shared.profileName;

        // 若设置弹窗处于打开状态，触发 DOM / 响应式更新
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

    // 考虑 API 旋钮与子插件的加载顺序
    if (window.siyuanApiSwitch) {
      window.siyuanApiSwitch.register(this.name, this.displayName, sync, localConfig);
    } else {
      window.addEventListener("siyuan-api-switch:ready", () => {
        if (window.siyuanApiSwitch) {
          window.siyuanApiSwitch.register(this.name, this.displayName, sync, localConfig);
        }
      }, { once: true });
    }
  }

  private updateSettingsUiIfOpen(shared: any | null) {
    // 详见后文设置面板联动说明
  }
}
```

---

## 四、设置面板 UI 联动处理

### 4.1 DOM 原生 / Siyuan Setting 类集成

如果使用思源 SDK 提供的 `Setting` 类构造设置页：

```typescript
function applyManagedStylesToSettingPanel(panelElement: HTMLElement, managedConfig: any | null) {
  const existingTip = panelElement.querySelector(".api-switch-managed-tip");
  if (existingTip) existingTip.remove();

  const inputs = panelElement.querySelectorAll<HTMLInputElement | HTMLSelectElement>("input, select, textarea");
  
  if (managedConfig) {
    // 1. 设置输入框置灰
    inputs.forEach((input) => {
      if (input.dataset.settingKey?.startsWith("ai-")) {
        input.disabled = true;
      }
    });

    // 2. 插入统一横幅
    const tip = document.createElement("div");
    tip.className = "api-switch-managed-tip";
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
    
    const targetSection = panelElement.querySelector(".ai-settings-section") || panelElement;
    targetSection.insertBefore(tip, targetSection.firstChild);
  } else {
    // 3. 解除置灰
    inputs.forEach((input) => {
      if (input.dataset.settingKey?.startsWith("ai-")) {
        input.disabled = false;
      }
    });
  }
}
```

### 4.2 Vue / React 框架集成

如果设置页使用 Vue 响应式数据驱动：

```vue
<template>
  <div class="settings-panel">
    <!-- 接管提示横幅 -->
    <div v-if="config.isAiManaged" class="api-switch-managed-tip">
      💡 通用 AI API 已由 <strong>API 旋钮 (siyuan-api-switch)</strong> 接管 
      (Profile: {{ config.aiManagedProfileName || '未命名' }})。相关输入框已置灰只读，如需修改请前往 API 旋钮面板。
    </div>

    <!-- AI 配置表单 -->
    <div class="form-group">
      <label>Base URL</label>
      <input type="text" v-model.trim="config.baseUrl" :disabled="config.isAiManaged" />
    </div>

    <div class="form-group">
      <label>API Key</label>
      <input type="password" v-model.trim="config.apiKey" :disabled="config.isAiManaged" />
    </div>

    <div class="form-group">
      <label>Model</label>
      <input type="text" v-model.trim="config.model" :disabled="config.isAiManaged" />
    </div>
  </div>
</template>
```

---

## 五、发起 AI 请求时的读取规范

在发起真实 LLM HTTP 请求时，推荐封装配置读取函数：

```typescript
export function getActiveAiConfig(plugin: MyPlugin) {
  // 优先读取接管配置，无接管时读取本地配置
  if (plugin.managedConfig) {
    return {
      baseUrl: plugin.managedConfig.baseUrl,
      apiKey: plugin.managedConfig.apiKey,
      model: plugin.managedConfig.model,
      timeout: plugin.managedConfig.requestTimeoutSeconds ?? 30,
      temperature: plugin.managedConfig.temperature ?? 0.7,
      maxTokens: plugin.managedConfig.maxTokens ?? 4096,
    };
  }
  return {
    baseUrl: plugin.config.baseUrl,
    apiKey: plugin.config.apiKey,
    model: plugin.config.model,
    timeout: plugin.config.timeout ?? 30,
    temperature: plugin.config.temperature ?? 0.7,
    maxTokens: plugin.config.maxTokens ?? 4096,
  };
}
```

---

## 六、参考示例与项目落地

已成功集成 API 旋钮的官方示例项目参考：
1. **[siyuan-doc-assist](file:///D:/MyCodingProjects/siyuan-doc-assist)** (文档助手 - DOM & 原生 Setting)
2. **[siyuan-network-lens](file:///D:/MyCodingProjects/siyuan-network-lens)** (脉络镜 - Vue 响应式驱动)
3. **[siyuan-canvas](file:///D:/MyCodingProjects/siyuan-canvas)** (Canvas 助手 - DOM 事件驱动)
4. **[siyuan-muse](file:///D:/MyCodingProjects/siyuan-muse)** (Muse 写作助手 - 零依赖快速集成)
