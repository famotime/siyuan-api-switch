/**
 * @file sample-plugin-integration.ts
 * @description API 旋钮 (siyuan-api-switch) 第三方插件集成示例代码
 * 包含单模型接管与多模型槽位（Multi-Slot）接管两套完整示例。
 * 开发者可直接参考或复制相关逻辑到插件项目中。
 */

import { Plugin } from "siyuan";

// ============================================================================
// 1. 类型接口定义
// ============================================================================

/** 旋钮下发的共享 AI API 配置结构 */
export interface SharedConfig {
  profileId: string;             // 绑定的 Profile ID
  profileName: string;           // Profile 显示名称
  provider: string;              // 服务商标识（deepseek, openai, siliconflow, custom 等）
  baseUrl: string;               // API Base URL
  apiKey: string;                // API Key / Token
  model: string;                 // 启用的模型 ID
  models?: string[];             // 候选模型列表
  protocol?: string;             // 通信协议（"openai" | "gemini" | "anthropic"）
  requestTimeoutSeconds?: number;// 请求超时时间（秒）
  temperature?: number;          // 采样温度
  maxTokens?: number;            // 最大 Token
  headers?: Record<string, string>; // 自定义 HTTP 请求头（网关鉴权）
  isDecisionModel?: boolean;     // 是否为决策/判别模型
  memo?: string;                 // 备注说明
  providerUrl?: string;          // 厂商链接
}

/** 插件多模型槽位定义 */
export interface PluginSlotDefinition {
  id: string;                    // 槽位唯一标识，例如 "chat" | "decision"
  name: string;                  // 槽位显示名称，例如 "对话模型" | "决策模型"
  description?: string;          // 槽位详细说明
  localConfig?: Omit<SharedConfig, "profileId" | "profileName">; // 本地降级配置
}

/** 插件注册参数对象 */
export interface RegisterPluginOptions {
  pluginId: string;
  displayName: string;
  callback: (config: SharedConfig | null, slotId?: string) => void;
  slots?: PluginSlotDefinition[];
  localConfig?: Omit<SharedConfig, "profileId" | "profileName">;
}

/** API 旋钮挂载在 window 上的全局对象类型 */
export interface SiyuanApiSwitch {
  version: string;
  register(
    pluginIdOrOptions: string | RegisterPluginOptions,
    displayName?: string,
    callback?: (config: SharedConfig | null, slotId?: string) => void,
    localConfig?: Omit<SharedConfig, "profileId" | "profileName">,
    options?: { slots?: PluginSlotDefinition[] }
  ): void;
  unregister(pluginId: string): void;
  getBoundConfig(pluginId: string, slotId?: string): SharedConfig | null;
}

// 扩展全局 window 类型
declare global {
  interface Window {
    siyuanApiSwitch?: SiyuanApiSwitch;
  }
}

/** 插件自身的 AI 本地配置类型 */
export interface PluginAiConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  timeout?: number;
  temperature?: number;
  maxTokens?: number;
  headers?: Record<string, string>;
  isAiManaged?: boolean;
  aiManagedProfileName?: string;
}

// ============================================================================
// 2. 插件示例类 A：极简单模型接管
// ============================================================================

export class SampleSingleSlotPlugin extends Plugin {
  public config: PluginAiConfig = {
    baseUrl: "https://api.openai.com/v1",
    apiKey: "",
    model: "gpt-4o-mini",
    timeout: 30,
    temperature: 0.7,
    maxTokens: 4096,
    isAiManaged: false,
    aiManagedProfileName: undefined,
  };

  private isManaged = false;
  private localAiConfigBackup: PluginAiConfig | null = null;
  public managedConfig: SharedConfig | null = null;

  async onload() {
    this.initApiSwitchSync();
  }

  onunload() {
    if (window.siyuanApiSwitch) {
      window.siyuanApiSwitch.unregister(this.name);
    }
  }

  private initApiSwitchSync() {
    const syncCallback = (shared: SharedConfig | null) => {
      if (shared) {
        if (!this.isManaged) {
          this.localAiConfigBackup = { ...this.config };
          this.isManaged = true;
        }

        this.managedConfig = shared;
        this.config.baseUrl = shared.baseUrl;
        this.config.apiKey = shared.apiKey;
        this.config.model = shared.model;
        if (shared.requestTimeoutSeconds !== undefined) this.config.timeout = shared.requestTimeoutSeconds;
        if (shared.temperature !== undefined) this.config.temperature = shared.temperature;
        if (shared.maxTokens !== undefined) this.config.maxTokens = shared.maxTokens;
        this.config.headers = shared.headers;
        this.config.isAiManaged = true;
        this.config.aiManagedProfileName = shared.profileName;

        this.notifySettingsUiUpdate(shared);
      } else {
        if (this.isManaged && this.localAiConfigBackup) {
          this.config = { ...this.localAiConfigBackup };
          this.localAiConfigBackup = null;
          this.isManaged = false;
        }

        this.managedConfig = null;
        this.config.isAiManaged = false;
        this.config.aiManagedProfileName = undefined;

        this.notifySettingsUiUpdate(null);
      }
    };

    const activeLocal = this.isManaged ? this.localAiConfigBackup : this.config;
    const localSnapshot = {
      provider: "custom",
      baseUrl: activeLocal?.baseUrl || "",
      apiKey: activeLocal?.apiKey || "",
      model: activeLocal?.model || "",
      requestTimeoutSeconds: activeLocal?.timeout,
      temperature: activeLocal?.temperature,
      maxTokens: activeLocal?.maxTokens,
    };

    const register = () => {
      window.siyuanApiSwitch?.register(this.name, this.displayName, syncCallback, localSnapshot);
    };

    if (window.siyuanApiSwitch) {
      register();
    } else {
      window.addEventListener("siyuan-api-switch:ready", register, { once: true });
    }
  }

  private notifySettingsUiUpdate(shared: SharedConfig | null) {
    const rootEl = document.getElementById("my-plugin-settings-root");
    if (rootEl) {
      applyManagedStylesToPanel(rootEl, shared);
    }
  }

  /**
   * 发起请求时获取生效配置，务必合并 headers
   */
  public getEffectiveAiConfig() {
    if (this.managedConfig) {
      return {
        baseUrl: this.managedConfig.baseUrl,
        apiKey: this.managedConfig.apiKey,
        model: this.managedConfig.model,
        timeout: (this.managedConfig.requestTimeoutSeconds ?? 30) * 1000,
        temperature: this.managedConfig.temperature ?? 0.7,
        maxTokens: this.managedConfig.maxTokens ?? 4096,
        headers: this.managedConfig.headers || {},
        isManaged: true,
      };
    }
    return {
      baseUrl: this.config.baseUrl,
      apiKey: this.config.apiKey,
      model: this.config.model,
      timeout: (this.config.timeout ?? 30) * 1000,
      temperature: this.config.temperature ?? 0.7,
      maxTokens: this.config.maxTokens ?? 4096,
      headers: this.config.headers || {},
      isManaged: false,
    };
  }
}

// ============================================================================
// 3. 插件示例类 B：多模型槽位（Multi-Slot）复合接管
// ============================================================================

export class SampleMultiSlotPlugin extends Plugin {
  public managedSlots: Record<string, SharedConfig | null> = {
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
      const slotKey = slotId || "chat";
      this.managedSlots[slotKey] = shared;
      // 触发 UI 刷新
    };

    const options: RegisterPluginOptions = {
      pluginId: this.name,
      displayName: this.displayName,
      callback: syncCallback,
      slots: [
        {
          id: "chat",
          name: "主对话模型",
          description: "用于长文撰写与卡片内容生成",
          localConfig: {
            provider: "custom",
            baseUrl: "https://api.openai.com/v1",
            apiKey: "",
            model: "gpt-4o",
          },
        },
        {
          id: "decision",
          name: "决策与分类模型",
          description: "用于轻量意图分类与关键词打标",
          localConfig: {
            provider: "custom",
            baseUrl: "https://api.deepseek.com",
            apiKey: "",
            model: "deepseek-chat",
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

  /**
   * 发起请求时合并自定义 Headers 的标准模式
   */
  public async sendRequest(slotId: "chat" | "decision", messages: any[]) {
    const config = this.managedSlots[slotId];
    if (!config) throw new Error(`Slot ${slotId} is not configured`);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
      ...(config.headers || {}), // 合并自定义 Headers
    };

    return await fetch(`${config.baseUrl.replace(/\/+$/, "")}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: config.model,
        messages,
        temperature: config.temperature ?? 0.7,
        max_tokens: config.maxTokens ?? 4096,
      }),
    });
  }
}

// ============================================================================
// 4. 原生 DOM 设置面板操控辅助函数
// ============================================================================

export function applyManagedStylesToPanel(panelElement: HTMLElement, shared: SharedConfig | null) {
  const existingTip = panelElement.querySelector(".api-switch-managed-tip");
  if (existingTip) {
    existingTip.remove();
  }

  const aiInputs = panelElement.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-ai-field]");

  if (shared) {
    aiInputs.forEach((input) => {
      input.disabled = true;
    });

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
    tip.innerHTML = `💡 通用 AI API 已由 <strong>API 旋钮 (siyuan-api-switch)</strong> 接管 (Profile: ${shared.profileName || '未命名'})。相关输入框已置灰只读，如需修改请前往 API 旋钮面板。`;

    const container = panelElement.querySelector(".ai-fields-container") || panelElement;
    container.insertBefore(tip, container.firstChild);
  } else {
    aiInputs.forEach((input) => {
      input.disabled = false;
    });
  }
}
