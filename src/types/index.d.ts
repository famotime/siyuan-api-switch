/**
 * 思源笔记 API 旋钮 (siyuan-api-switch) - 核心类型定义
 */

export interface SharedConfig {
  profileId: string;      // 绑定的 Profile ID
  profileName: string;    // Profile 的名称，如 "DeepSeek-Default"
  provider: string;       // 服务商标识，如 "deepseek", "openai", "siliconflow", "custom"
  protocol?: string;      // 协议类型，如 "openai", "gemini", "anthropic"
  baseUrl: string;        // API 基础 URL
  apiKey: string;         // API 密钥
  model: string;          // 模型名称
  models?: string[];      // 候选模型列表
  headers?: Record<string, string>; // 自定义 HTTP 请求头
  requestTimeoutSeconds?: number; // 请求超时时间（秒）
  temperature?: number;   // 采样温度
  maxTokens?: number;     // 最大 Token 数
  // 思源笔记编辑器与智能体 API 参数全量合集（为空不下发）
  maxHistoryMessages?: number;   // 编辑器：最大上下文数
  maxToolCallRounds?: number;    // 智能体：最大工具调用轮数
  sessionTimeout?: number;       // 智能体：会话超时时间(s)
  streamIdleTimeout?: number;    // 智能体：流空闲超时时间(s)
  confirmTimeout?: number;       // 智能体：确认超时时间(s)
  maxRetries?: number;           // 智能体：最大重试次数
  isDecisionModel?: boolean;     // 是否为决策模型
  memo?: string;          // 备注
  providerUrl?: string;   // 服务商官网链接
}

export interface ApiProviderModel {
  id: string;
  name: string;
  displayName?: string;
  enabled?: boolean;
  contextLength?: number;
}

export interface ApiProvider {
  id: string;
  displayName: string;
  enabled?: boolean;
  apiKey: string;
  baseUrl: string;
  protocol?: string;
  requestTimeout?: number;
  headers?: Record<string, string>;
  models: ApiProviderModel[];
}

export interface ApiProfile {
  id: string;
  name: string;
  providerId?: string; // 关联的 API 提供商 ID
  provider: string;    // 服务商标识或协议，如 openai, gemini, anthropic, siliconflow, custom
  protocol?: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  models?: string[];
  headers?: Record<string, string>;
  requestTimeoutSeconds?: number;
  temperature?: number;
  maxTokens?: number;
  maxHistoryMessages?: number;
  maxToolCallRounds?: number;
  sessionTimeout?: number;
  streamIdleTimeout?: number;
  confirmTimeout?: number;
  maxRetries?: number;
  isDecisionModel?: boolean;
  memo?: string;
  providerUrl?: string;
}

export interface SiyuanAiJson {
  providers?: Array<{
    id: string;
    displayName?: string;
    enabled?: boolean;
    apiKey: string;
    baseURL: string;
    protocol?: string;
    requestTimeout?: number;
    headers?: Record<string, string>;
    models: Array<{
      id: string;
      name: string;
      displayName?: string;
      enabled?: boolean;
      contextLength?: number;
    }>;
  }>;
  editing?: {
    modelId: string;
    maxHistoryMessages?: number;
    temperature?: number;
    maxCompletionTokens?: number;
  };
  agent?: {
    modelId: string;
    sessionTimeout?: number;
    streamIdleTimeout?: number;
    confirmTimeout?: number;
    maxRetries?: number;
    temperature?: number;
    maxCompletionTokens?: number;
    maxToolCallRounds?: number;
    capabilityPolicy?: any;
    approvalPolicy?: any;
    skills?: any;
  };
  decision?: {
    enabled?: boolean;
    endpoint: string;
    apiKey: string;
    name: string;
    timeout?: number;
  };
}

export interface PluginSlotDefinition {
  id: string;               // 槽位唯一标识，例如 "chat" | "decision"
  name: string;             // 槽位显示名称，例如 "对话模型" | "决策模型"
  description?: string;     // 槽位说明
  localConfig?: Omit<SharedConfig, "profileId" | "profileName">; // 本地初始降级配置
}

export interface RegisteredPluginSlotInfo {
  slotId: string;
  name: string;
  description?: string;
  isBound: boolean;
  boundProfileId: string;
  localConfig?: Omit<SharedConfig, "profileId" | "profileName">;
  matchedProfileId?: string;
  matchedProfileName?: string;
}

export interface RegisterPluginOptions {
  pluginId: string;
  displayName: string;
  callback: (config: SharedConfig | null, slotId?: string) => void;
  slots?: PluginSlotDefinition[];
  localConfig?: Omit<SharedConfig, "profileId" | "profileName">;
}

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

export enum SyFrontendTypes {
  desktop = 'desktop',
  'desktop-window' = 'desktop-window',
  mobile = 'mobile',
  'browser-desktop' = 'browser-desktop',
  'browser-mobile' = 'browser-mobile',
}

declare global {
  interface Window {
    siyuan: {
      notebooks: any;
      menus: any;
      dialogs: any;
      blockPanels: any;
      storage: any;
      user: any;
      ws: any;
      languages: any;
      config?: any;
    };
    _sy_api_switch?: {
      openSetting?: () => void;
      [key: string]: any;
    };
    siyuanApiSwitch?: SiyuanApiSwitch;
  }
}
