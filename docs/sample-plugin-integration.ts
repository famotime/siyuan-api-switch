/**
 * @file sample-plugin-integration.ts
 * @description API 旋钮 (siyuan-api-switch) 集成示例代码
 * 开发者可直接将此模板复制到插件项目中，参考进行集成。
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
  requestTimeoutSeconds?: number;// 请求超时时间（秒）
  temperature?: number;          // 采样温度
  maxTokens?: number;            // 最大 Token
  memo?: string;                 // 备注说明
  providerUrl?: string;          // 厂商链接
}

/** API 旋钮挂载在 window 上的全局对象类型 */
export interface SiyuanApiSwitch {
  version: string;
  register(
    pluginId: string,
    displayName: string,
    callback: (config: SharedConfig | null) => void,
    localConfig?: Omit<SharedConfig, "profileId" | "profileName">
  ): void;
  unregister(pluginId: string): void;
  getBoundConfig(pluginId: string): SharedConfig | null;
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
  isAiManaged?: boolean;
  aiManagedProfileName?: string;
}

// ============================================================================
// 2. 插件生命周期集成类示例
// ============================================================================

export class SamplePluginWithApiSwitch extends Plugin {
  // 本地配置对象
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

  // 接管状态与备份
  private isManaged = false;
  private localAiConfigBackup: PluginAiConfig | null = null;
  public managedConfig: SharedConfig | null = null;

  async onload() {
    // 初始化同步与注册
    this.initApiSwitchSync();
  }

  onunload() {
    // 卸载插件时主动取消注册
    if (window.siyuanApiSwitch) {
      window.siyuanApiSwitch.unregister(this.name);
    }
  }

  /**
   * 核心注册与事件同步方法
   */
  private initApiSwitchSync() {
    // 配置变更通知回调
    const syncCallback = (shared: SharedConfig | null) => {
      if (shared) {
        // 首次被接管时，备份本地配置，用于未来解绑恢复
        if (!this.isManaged) {
          this.localAiConfigBackup = { ...this.config };
          this.isManaged = true;
        }

        this.managedConfig = shared;

        // 写入当前配置
        this.config.baseUrl = shared.baseUrl;
        this.config.apiKey = shared.apiKey;
        this.config.model = shared.model;
        if (shared.requestTimeoutSeconds !== undefined) this.config.timeout = shared.requestTimeoutSeconds;
        if (shared.temperature !== undefined) this.config.temperature = shared.temperature;
        if (shared.maxTokens !== undefined) this.config.maxTokens = shared.maxTokens;
        
        this.config.isAiManaged = true;
        this.config.aiManagedProfileName = shared.profileName;

        // 刷新已打开的 UI 界面
        this.notifySettingsUiUpdate(shared);
      } else {
        // 解除接管，平滑还原为本地备份
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

    // 抓取当前可供 API 旋钮一键导入的本地快照
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

    // 支持两种先后加载顺序的监听挂载
    if (window.siyuanApiSwitch) {
      window.siyuanApiSwitch.register(this.name, this.displayName, syncCallback, localSnapshot);
    } else {
      window.addEventListener(
        "siyuan-api-switch:ready",
        () => {
          if (window.siyuanApiSwitch) {
            window.siyuanApiSwitch.register(this.name, this.displayName, syncCallback, localSnapshot);
          }
        },
        { once: true }
      );
    }
  }

  /**
   * 模拟更新 UI 设置面板的方法（Vue / React / DOM 驱动）
   */
  private notifySettingsUiUpdate(shared: SharedConfig | null) {
    const rootEl = document.getElementById("my-plugin-settings-root");
    if (rootEl) {
      applyManagedStylesToPanel(rootEl, shared);
    }
  }

  /**
   * 获取当前生效的 AI API 配置（供发起 HTTP 请求时使用）
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
      isManaged: false,
    };
  }
}

// ============================================================================
// 3. 原生 DOM 设置面板操控辅助函数
// ============================================================================

/**
 * 为原生 HTML 设置面板动态挂载/卸载接管横幅与置灰输入框
 */
export function applyManagedStylesToPanel(panelElement: HTMLElement, shared: SharedConfig | null) {
  const existingTip = panelElement.querySelector(".api-switch-managed-tip");
  if (existingTip) {
    existingTip.remove();
  }

  // 假设所有 AI 输入框均带有 [data-ai-field] 标记
  const aiInputs = panelElement.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-ai-field]");

  if (shared) {
    // 1. 置灰禁用输入框
    aiInputs.forEach((input) => {
      input.disabled = true;
    });

    // 2. 挂载统一接管横幅
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
    // 3. 解除禁用
    aiInputs.forEach((input) => {
      input.disabled = false;
    });
  }
}
