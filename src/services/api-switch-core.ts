import { Plugin, fetchSyncPost } from "siyuan";
import { SharedConfig, SiyuanApiSwitch, ApiProvider, ApiProviderModel, SiyuanAiJson } from "@/types";

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
  // 思源笔记编辑器与智能体 API 参数全量合集（标准扩展，为空不下发）
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

export interface ApiSwitchStorage {
  providers?: ApiProvider[];
  profiles: ApiProfile[];
  bindings: Record<string, string>; // pluginId -> profileId
}

export interface RegisteredPluginInfo {
  pluginId: string;
  displayName: string;
  isBound: boolean;
  boundProfileId: string;
  localConfig?: Omit<SharedConfig, "profileId" | "profileName">;
}

const STORAGE_KEY = "config.json";

export interface SiyuanExtractedAiInfo {
  providerId?: string;
  provider: string;
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
}

export function extractSiyuanAiSettings(aiConfig: any): {
  providers: ApiProvider[];
  editing: SiyuanExtractedAiInfo | null;
  agent: SiyuanExtractedAiInfo | null;
  decision: SiyuanExtractedAiInfo | null;
} {
  if (!aiConfig || typeof aiConfig !== "object") {
    return { providers: [], editing: null, agent: null, decision: null };
  }

  const rawProviders = Array.isArray(aiConfig.providers) ? aiConfig.providers : [];

  const getBaseUrl = (obj: any): string => {
    if (!obj || typeof obj !== "object") return "";
    return obj.baseURL || obj.baseUrl || obj.apiBaseURL || obj.apiBaseUrl || "";
  };

  const getApiKey = (obj: any): string => {
    if (!obj || typeof obj !== "object") return "";
    return obj.apiKey || obj.apikey || obj.api_key || "";
  };

  // 1. 解析思源 providers 列表
  const providers: ApiProvider[] = rawProviders.map((p: any, idx: number) => {
    const pModels: ApiProviderModel[] = Array.isArray(p.models)
      ? p.models.map((m: any) => ({
          id: m.id || m.name || `model_${idx}`,
          name: m.name || m.id || "",
          displayName: m.displayName || m.name || m.id || "",
          enabled: m.enabled ?? true,
          contextLength: m.contextLength,
        }))
      : [];

    return {
      id: p.id || `provider_${idx}_${Math.random().toString(36).substring(2, 7)}`,
      displayName: p.displayName || p.id || `提供商 ${idx + 1}`,
      enabled: p.enabled ?? true,
      apiKey: getApiKey(p),
      baseUrl: getBaseUrl(p),
      protocol: p.protocol || "openai",
      requestTimeout: p.requestTimeout ?? 30,
      headers: p.headers && typeof p.headers === "object" ? p.headers : {},
      models: pModels,
    };
  });

  function resolveModel(modelId?: string) {
    if (!modelId || rawProviders.length === 0) return null;
    for (const p of rawProviders) {
      if (!p || !p.enabled) continue;
      if (Array.isArray(p.models)) {
        for (const m of p.models) {
          if (m && m.enabled && (m.id === modelId || m.displayName === modelId || m.name === modelId)) {
            return { provider: p, model: m };
          }
        }
      }
    }
    const fallbackProvider = rawProviders.find((p: any) => p && p.enabled && getApiKey(p) !== "") || rawProviders[0];
    if (fallbackProvider) {
      const fallbackModel = fallbackProvider.models?.find((m: any) => m && m.enabled) || fallbackProvider.models?.[0];
      return { provider: fallbackProvider, model: fallbackModel };
    }
    return null;
  }

  // 2. 思源笔记 API - 编辑器 (Editing)
  let editingConfig: SiyuanExtractedAiInfo | null = null;
  const editingResolved = resolveModel(aiConfig.editing?.modelId);
  if (editingResolved && editingResolved.provider) {
    editingConfig = {
      providerId: editingResolved.provider.id,
      provider: editingResolved.provider.protocol || "openai",
      protocol: editingResolved.provider.protocol || "openai",
      baseUrl: getBaseUrl(editingResolved.provider),
      apiKey: getApiKey(editingResolved.provider),
      model: editingResolved.model?.name || editingResolved.model?.id || aiConfig.editing?.modelId || "",
      headers: editingResolved.provider.headers || {},
      requestTimeoutSeconds: editingResolved.provider.requestTimeout,
      temperature: aiConfig.editing?.temperature,
      maxTokens: aiConfig.editing?.maxCompletionTokens,
      maxHistoryMessages: aiConfig.editing?.maxHistoryMessages,
    };
  } else if (aiConfig.openAI && (getApiKey(aiConfig.openAI) !== "" || getBaseUrl(aiConfig.openAI) !== "")) {
    editingConfig = {
      provider: "openai",
      baseUrl: getBaseUrl(aiConfig.openAI),
      apiKey: getApiKey(aiConfig.openAI),
      model: aiConfig.openAI.apiModel || "",
      requestTimeoutSeconds: aiConfig.openAI.apiTimeout,
      temperature: aiConfig.openAI.apiTemperature,
      maxTokens: aiConfig.openAI.apiMaxTokens,
    };
  }

  // 3. 思源笔记 API - 智能体 (Agent)
  let agentConfig: SiyuanExtractedAiInfo | null = null;
  const agentResolved = resolveModel(aiConfig.agent?.modelId);
  if (agentResolved && agentResolved.provider) {
    agentConfig = {
      providerId: agentResolved.provider.id,
      provider: agentResolved.provider.protocol || "openai",
      protocol: agentResolved.provider.protocol || "openai",
      baseUrl: getBaseUrl(agentResolved.provider),
      apiKey: getApiKey(agentResolved.provider),
      model: agentResolved.model?.name || agentResolved.model?.id || aiConfig.agent?.modelId || "",
      headers: agentResolved.provider.headers || {},
      requestTimeoutSeconds: agentResolved.provider.requestTimeout,
      temperature: aiConfig.agent?.temperature,
      maxTokens: aiConfig.agent?.maxCompletionTokens,
      maxToolCallRounds: aiConfig.agent?.maxToolCallRounds,
      sessionTimeout: aiConfig.agent?.sessionTimeout,
      streamIdleTimeout: aiConfig.agent?.streamIdleTimeout,
      confirmTimeout: aiConfig.agent?.confirmTimeout,
      maxRetries: aiConfig.agent?.maxRetries,
    };
  } else if (aiConfig.openAI && (getApiKey(aiConfig.openAI) !== "" || getBaseUrl(aiConfig.openAI) !== "")) {
    agentConfig = {
      provider: "openai",
      baseUrl: getBaseUrl(aiConfig.openAI),
      apiKey: getApiKey(aiConfig.openAI),
      model: aiConfig.openAI.apiModel || "",
      requestTimeoutSeconds: aiConfig.openAI.apiTimeout,
      temperature: aiConfig.openAI.apiTemperature,
      maxTokens: aiConfig.openAI.apiMaxTokens,
    };
  }

  // 4. 思源笔记 API - 决策模型 (Decision)
  let decisionConfig: SiyuanExtractedAiInfo | null = null;
  if (aiConfig.decision && typeof aiConfig.decision === "object") {
    decisionConfig = {
      provider: "custom",
      baseUrl: aiConfig.decision.endpoint || "",
      apiKey: aiConfig.decision.apiKey || "",
      model: aiConfig.decision.name || "",
      requestTimeoutSeconds: aiConfig.decision.timeout ?? 30,
      isDecisionModel: true,
    };
  }

  return { providers, editing: editingConfig, agent: agentConfig, decision: decisionConfig };
}

class ApiSwitchCore {
  private plugin: Plugin | null = null;
  private providers: ApiProvider[] = [];
  private profiles: ApiProfile[] = [];
  private bindings: Record<string, string> = {}; // pluginId -> profileId
  private registrations = new Map<
    string,
    {
      displayName: string;
      callback: (config: SharedConfig | null) => void;
      localConfig?: Omit<SharedConfig, "profileId" | "profileName">;
    }
  >();

  // ref 方式通知 UI 更新
  public onStateChange: (() => void) | null = null;

  constructor() {}

  private log(message: string, ...args: any[]) {
    if (localStorage.getItem("sy_api_switch_debug") === "true") {
      console.log(`[API Switch] ${message}`, ...args);
    }
  }

  private logError(message: string, ...args: any[]) {
    if (localStorage.getItem("sy_api_switch_debug") === "true") {
      console.error(`[API Switch] ${message}`, ...args);
    }
  }

  async initialize(plugin: Plugin) {
    this.plugin = plugin;
    await this.loadData();
    this.mountGlobal();

    // 智能初始化：首次使用或配置为空时，自动从思源笔记检测并导入
    if (this.profiles.length === 0 && this.providers.length === 0) {
      await this.syncFromSiyuan();
    } else {
      await this.syncSiyuanBuiltinBindings();
    }
  }

  private async syncSiyuanBuiltinBindings() {
    try {
      if (this.bindings["siyuan_builtin_editing"]) {
        const profile = this.profiles.find((p) => p.id === this.bindings["siyuan_builtin_editing"]) || null;
        if (profile) {
          await this.updateSiyuanSystemAi(profile, "editing");
        }
      }
      if (this.bindings["siyuan_builtin_agent"]) {
        const profile = this.profiles.find((p) => p.id === this.bindings["siyuan_builtin_agent"]) || null;
        if (profile) {
          await this.updateSiyuanSystemAi(profile, "agent");
        }
      }
      if (this.bindings["siyuan_builtin_decision"]) {
        const profile = this.profiles.find((p) => p.id === this.bindings["siyuan_builtin_decision"]) || null;
        if (profile) {
          await this.updateSiyuanSystemAi(profile, "decision");
        }
      }
    } catch (err) {
      this.logError("Failed to sync Siyuan builtin bindings on initialize", err);
    }
  }

  private async loadData() {
    if (!this.plugin) return;
    try {
      const data = await this.plugin.loadData(STORAGE_KEY);
      if (data) {
        this.providers = Array.isArray(data.providers) ? data.providers : [];
        this.profiles = Array.isArray(data.profiles) ? data.profiles : [];
        // 数据向后兼容：若 models 不存在，则用 [model] 初始化
        this.profiles.forEach((p) => {
          if (!p.models || !Array.isArray(p.models)) {
            p.models = p.model ? [p.model] : [];
          }
        });
        this.bindings = data.bindings && typeof data.bindings === "object" ? data.bindings : {};
      } else {
        this.providers = [];
        this.profiles = [];
        this.bindings = {};
      }
    } catch (err) {
      this.logError("Failed to load config data", err);
      this.providers = [];
      this.profiles = [];
      this.bindings = {};
    }
  }

  async save() {
    if (!this.plugin) return;
    try {
      const data: ApiSwitchStorage = {
        providers: this.providers,
        profiles: this.profiles,
        bindings: this.bindings,
      };
      await this.plugin.saveData(STORAGE_KEY, data);
      if (this.onStateChange) {
        this.onStateChange();
      }
    } catch (err) {
      this.logError("Failed to save config data", err);
    }
  }

  private mountGlobal() {
    const manager: SiyuanApiSwitch = {
      version: this.plugin?.version || "0.0.1",
      register: (pluginId, displayName, callback, localConfig) => {
        this.registerPlugin(pluginId, displayName, callback, localConfig);
      },
      unregister: (pluginId) => {
        this.unregisterPlugin(pluginId);
      },
      getBoundConfig: (pluginId) => {
        return this.getBoundSharedConfig(pluginId);
      },
    };

    window.siyuanApiSwitch = manager;
    this.log("Mounted global window.siyuanApiSwitch");

    // 触发就绪事件给先加载的子插件
    const event = new CustomEvent("siyuan-api-switch:ready", {
      detail: manager,
    });
    window.dispatchEvent(event);
  }

  destroy() {
    if (window.siyuanApiSwitch) {
      delete window.siyuanApiSwitch;
    }

    for (const [pluginId, reg] of this.registrations.entries()) {
      try {
        reg.callback(null);
      } catch (err) {
        this.logError(`Error in callback during destroy for ${pluginId}`, err);
      }
    }

    this.registrations.clear();
  }

  // 子插件注册逻辑
  private registerPlugin(
    pluginId: string,
    displayName: string,
    callback: (config: SharedConfig | null) => void,
    localConfig?: Omit<SharedConfig, "profileId" | "profileName">
  ) {
    this.registrations.set(pluginId, { displayName, callback, localConfig });
    this.log(`Plugin registered: ${displayName} (${pluginId})`, localConfig ? "with local config" : "without local config");

    const boundConfig = this.getBoundSharedConfig(pluginId);
    try {
      callback(boundConfig);
    } catch (err) {
      this.logError(`Error during initial register callback for ${pluginId}`, err);
    }

    if (this.onStateChange) {
      this.onStateChange();
    }
  }

  private unregisterPlugin(pluginId: string) {
    this.registrations.delete(pluginId);
    this.log(`Plugin unregistered: ${pluginId}`);
    if (this.onStateChange) {
      this.onStateChange();
    }
  }

  // 解析 Profile 的有效参数（联动继承 Provider）
  public resolveEffectiveProfile(profile: ApiProfile): ApiProfile {
    if (!profile.providerId) return profile;

    const provider = this.providers.find((p) => p.id === profile.providerId);
    if (!provider) return profile;

    const providerModels = provider.models && provider.models.length > 0
      ? provider.models.map((m) => m.name || m.id)
      : [];

    return {
      ...profile,
      provider: provider.protocol || profile.provider || "custom",
      protocol: provider.protocol || profile.protocol || "openai",
      baseUrl: profile.baseUrl || provider.baseUrl || "",
      apiKey: profile.apiKey || provider.apiKey || "",
      headers: { ...(provider.headers || {}), ...(profile.headers || {}) },
      requestTimeoutSeconds: profile.requestTimeoutSeconds ?? provider.requestTimeout ?? 30,
      models: providerModels.length > 0 ? providerModels : (profile.models || (profile.model ? [profile.model] : [])),
    };
  }

  // 获取共享配置（供插件调用）
  public getBoundSharedConfig(pluginId: string): SharedConfig | null {
    const profileId = this.bindings[pluginId];
    if (!profileId) return null;

    const rawProfile = this.profiles.find((p) => p.id === profileId);
    if (!rawProfile) return null;

    const effective = this.resolveEffectiveProfile(rawProfile);

    const conf: SharedConfig = {
      profileId: effective.id,
      profileName: effective.name,
      provider: effective.provider,
      protocol: effective.protocol,
      baseUrl: effective.baseUrl,
      apiKey: effective.apiKey,
      model: effective.model,
      models: effective.models || (effective.model ? [effective.model] : []),
      headers: effective.headers,
    };

    if (effective.requestTimeoutSeconds !== undefined && effective.requestTimeoutSeconds !== null) conf.requestTimeoutSeconds = effective.requestTimeoutSeconds;
    if (effective.temperature !== undefined && effective.temperature !== null) conf.temperature = effective.temperature;
    if (effective.maxTokens !== undefined && effective.maxTokens !== null) conf.maxTokens = effective.maxTokens;
    if (effective.maxHistoryMessages !== undefined && effective.maxHistoryMessages !== null) conf.maxHistoryMessages = effective.maxHistoryMessages;
    if (effective.maxToolCallRounds !== undefined && effective.maxToolCallRounds !== null) conf.maxToolCallRounds = effective.maxToolCallRounds;
    if (effective.sessionTimeout !== undefined && effective.sessionTimeout !== null) conf.sessionTimeout = effective.sessionTimeout;
    if (effective.streamIdleTimeout !== undefined && effective.streamIdleTimeout !== null) conf.streamIdleTimeout = effective.streamIdleTimeout;
    if (effective.confirmTimeout !== undefined && effective.confirmTimeout !== null) conf.confirmTimeout = effective.confirmTimeout;
    if (effective.maxRetries !== undefined && effective.maxRetries !== null) conf.maxRetries = effective.maxRetries;
    if (effective.isDecisionModel !== undefined) conf.isDecisionModel = effective.isDecisionModel;
    if (effective.memo) conf.memo = effective.memo;
    if (effective.providerUrl) conf.providerUrl = effective.providerUrl;

    return conf;
  }

  // ===================== API 提供商管理 (Providers) =====================

  getProviders(): ApiProvider[] {
    return this.providers;
  }

  getProvider(id: string): ApiProvider | null {
    return this.providers.find((p) => p.id === id) || null;
  }

  async addProvider(provider: Omit<ApiProvider, "id">): Promise<ApiProvider> {
    const newProvider: ApiProvider = {
      ...provider,
      id: "provider_" + Math.random().toString(36).substring(2, 11),
      models: provider.models || [],
      headers: provider.headers || {},
    };
    this.providers.push(newProvider);
    await this.save();
    return newProvider;
  }

  async updateProvider(provider: ApiProvider): Promise<void> {
    const idx = this.providers.findIndex((p) => p.id === provider.id);
    if (idx !== -1) {
      this.providers[idx] = { ...provider };
      await this.save();

      // 通知所有关联此提供商的 Profile 绑定的插件
      for (const profile of this.profiles) {
        if (profile.providerId === provider.id) {
          this.syncBindingsByProfile(profile.id);
        }
      }
    }
  }

  async deleteProvider(providerId: string): Promise<void> {
    this.providers = this.providers.filter((p) => p.id !== providerId);

    // 解除 Profile 对该提供商的关联
    for (const profile of this.profiles) {
      if (profile.providerId === providerId) {
        profile.providerId = undefined;
      }
    }

    await this.save();
  }

  // ===================== API Profiles 管理 =====================

  getProfiles(): ApiProfile[] {
    return this.profiles;
  }

  async addProfile(profile: Omit<ApiProfile, "id">): Promise<ApiProfile> {
    const newProfile: ApiProfile = {
      ...profile,
      id: "prof_" + Math.random().toString(36).substring(2, 11),
      models: profile.models || (profile.model ? [profile.model] : []),
    };
    this.profiles.push(newProfile);
    await this.save();
    return newProfile;
  }

  async importProfiles(imported: ApiProfile[]): Promise<{ added: number; updated: number }> {
    let added = 0;
    let updated = 0;
    for (const prof of imported) {
      if (!prof || typeof prof !== "object") continue;
      if (!prof.name || !prof.model) continue;

      const normalizedProf: ApiProfile = {
        id: prof.id || "prof_" + Math.random().toString(36).substring(2, 11),
        name: String(prof.name),
        providerId: prof.providerId ? String(prof.providerId) : undefined,
        provider: String(prof.provider || "custom"),
        protocol: prof.protocol ? String(prof.protocol) : undefined,
        baseUrl: String(prof.baseUrl || ""),
        apiKey: String(prof.apiKey || ""),
        model: String(prof.model),
        models: Array.isArray(prof.models) ? prof.models.map(String) : (prof.model ? [String(prof.model)] : []),
        headers: prof.headers && typeof prof.headers === "object" ? prof.headers : undefined,
        requestTimeoutSeconds: prof.requestTimeoutSeconds !== undefined ? Number(prof.requestTimeoutSeconds) : undefined,
        temperature: prof.temperature !== undefined ? Number(prof.temperature) : undefined,
        maxTokens: prof.maxTokens !== undefined ? Number(prof.maxTokens) : undefined,
        maxHistoryMessages: prof.maxHistoryMessages !== undefined ? Number(prof.maxHistoryMessages) : undefined,
        maxToolCallRounds: prof.maxToolCallRounds !== undefined ? Number(prof.maxToolCallRounds) : undefined,
        sessionTimeout: prof.sessionTimeout !== undefined ? Number(prof.sessionTimeout) : undefined,
        streamIdleTimeout: prof.streamIdleTimeout !== undefined ? Number(prof.streamIdleTimeout) : undefined,
        confirmTimeout: prof.confirmTimeout !== undefined ? Number(prof.confirmTimeout) : undefined,
        maxRetries: prof.maxRetries !== undefined ? Number(prof.maxRetries) : undefined,
        isDecisionModel: Boolean(prof.isDecisionModel),
        memo: prof.memo ? String(prof.memo) : "",
        providerUrl: prof.providerUrl ? String(prof.providerUrl) : ""
      };

      const existingIdx = this.profiles.findIndex((p) => p.id === normalizedProf.id);
      if (existingIdx !== -1) {
        this.profiles[existingIdx] = normalizedProf;
        updated++;
      } else {
        this.profiles.push(normalizedProf);
        added++;
      }
    }

    if (added > 0 || updated > 0) {
      await this.save();
    }
    return { added, updated };
  }

  async updateProfile(profile: ApiProfile) {
    const idx = this.profiles.findIndex((p) => p.id === profile.id);
    if (idx !== -1) {
      this.profiles[idx] = { ...profile };
      await this.save();
      this.syncBindingsByProfile(profile.id);
    }
  }

  async deleteProfile(profileId: string) {
    this.profiles = this.profiles.filter((p) => p.id !== profileId);

    const pluginsToUnbind: string[] = [];
    for (const pluginId in this.bindings) {
      if (this.bindings[pluginId] === profileId) {
        pluginsToUnbind.push(pluginId);
      }
    }

    for (const pluginId of pluginsToUnbind) {
      delete this.bindings[pluginId];
      this.notifyPluginUpdate(pluginId, null);
    }

    await this.save();
  }

  // ===================== 思源系统 AI 同步与写回 =====================

  public async updateSiyuanSystemAi(profile: ApiProfile | null, targetScope: "editing" | "agent" | "decision" | "all" = "all") {
    if (!profile) return;

    try {
      const confRes = await fetchSyncPost("/api/system/getConf", {});
      const fullConf = confRes && confRes.code === 0 ? confRes.data : null;
      let aiConfig = fullConf?.ai || (window as any).siyuan?.config?.ai || {};

      aiConfig = JSON.parse(JSON.stringify(aiConfig));
      const effective = this.resolveEffectiveProfile(profile);

      if (typeof aiConfig === "object") {
        if (!Array.isArray(aiConfig.providers)) {
          aiConfig.providers = [];
        }

        // 决策模型独立更新
        if (targetScope === "decision" || (targetScope === "all" && effective.isDecisionModel)) {
          if (!aiConfig.decision || typeof aiConfig.decision !== "object") {
            aiConfig.decision = {};
          }
          aiConfig.decision.enabled = true;
          aiConfig.decision.endpoint = effective.baseUrl || "https://api.typesafe.ai/v1/systemone";
          aiConfig.decision.apiKey = effective.apiKey || "";
          aiConfig.decision.name = effective.model || "jev-latest";
          if (effective.requestTimeoutSeconds !== undefined && !isNaN(effective.requestTimeoutSeconds)) {
            aiConfig.decision.timeout = effective.requestTimeoutSeconds;
          }
        }

        // 编辑器与智能体：需要确保 Provider 存在
        if (targetScope === "editing" || targetScope === "agent" || targetScope === "all") {
          const modelId = effective.model || "custom-model";
          const providerId = effective.providerId || `provider_${effective.provider || 'custom'}`;

          let targetProvider = aiConfig.providers.find(
            (p: any) => p.id === providerId || p.displayName === effective.name
          );

          if (!targetProvider) {
            targetProvider = {
              id: providerId,
              displayName: effective.name || "API Switch Provider",
              enabled: true,
              protocol: effective.protocol || effective.provider || "openai",
              models: []
            };
            aiConfig.providers.push(targetProvider);
          }

          targetProvider.enabled = true;
          targetProvider.apiKey = effective.apiKey || "";
          targetProvider.baseURL = effective.baseUrl || "";
          targetProvider.baseUrl = effective.baseUrl || "";
          if (effective.headers) {
            targetProvider.headers = effective.headers;
          }
          if (effective.requestTimeoutSeconds !== undefined && !isNaN(effective.requestTimeoutSeconds)) {
            targetProvider.requestTimeout = effective.requestTimeoutSeconds;
          }
          if (!targetProvider.protocol) {
            targetProvider.protocol = effective.protocol || effective.provider || "openai";
          }

          if (!Array.isArray(targetProvider.models)) {
            targetProvider.models = [];
          }

          let targetModel = targetProvider.models.find((m: any) => m.id === modelId || m.name === modelId);
          if (!targetModel) {
            targetModel = {
              id: modelId,
              name: modelId,
              displayName: modelId,
              enabled: true
            };
            targetProvider.models.push(targetModel);
          } else {
            targetModel.enabled = true;
          }

          if (Array.isArray(effective.models)) {
            for (const mName of effective.models) {
              if (mName && !targetProvider.models.some((m: any) => m.id === mName || m.name === mName)) {
                targetProvider.models.push({
                  id: mName,
                  name: mName,
                  displayName: mName,
                  enabled: true
                });
              }
            }
          }

          const targetModelId = targetModel.id || modelId;

          if (targetScope === "agent" || targetScope === "all") {
            if (!aiConfig.agent || typeof aiConfig.agent !== "object") {
              aiConfig.agent = {};
            }
            aiConfig.agent.modelId = targetModelId;
            if (effective.temperature !== undefined && !isNaN(effective.temperature)) {
              aiConfig.agent.temperature = effective.temperature;
            }
            if (effective.maxTokens !== undefined && !isNaN(effective.maxTokens)) {
              aiConfig.agent.maxCompletionTokens = effective.maxTokens;
            }
            if (effective.maxToolCallRounds !== undefined && !isNaN(effective.maxToolCallRounds)) {
              aiConfig.agent.maxToolCallRounds = effective.maxToolCallRounds;
            }
            if (effective.sessionTimeout !== undefined && !isNaN(effective.sessionTimeout)) {
              aiConfig.agent.sessionTimeout = effective.sessionTimeout;
            }
            if (effective.streamIdleTimeout !== undefined && !isNaN(effective.streamIdleTimeout)) {
              aiConfig.agent.streamIdleTimeout = effective.streamIdleTimeout;
            }
            if (effective.confirmTimeout !== undefined && !isNaN(effective.confirmTimeout)) {
              aiConfig.agent.confirmTimeout = effective.confirmTimeout;
            }
            if (effective.maxRetries !== undefined && !isNaN(effective.maxRetries)) {
              aiConfig.agent.maxRetries = effective.maxRetries;
            }
          }

          if (targetScope === "editing" || targetScope === "all") {
            if (!aiConfig.editing || typeof aiConfig.editing !== "object") {
              aiConfig.editing = {};
            }
            aiConfig.editing.modelId = targetModelId;
            if (effective.temperature !== undefined && !isNaN(effective.temperature)) {
              aiConfig.editing.temperature = effective.temperature;
            }
            if (effective.maxTokens !== undefined && !isNaN(effective.maxTokens)) {
              aiConfig.editing.maxCompletionTokens = effective.maxTokens;
            }
            if (effective.maxHistoryMessages !== undefined && !isNaN(effective.maxHistoryMessages)) {
              aiConfig.editing.maxHistoryMessages = effective.maxHistoryMessages;
            }
          }
        }
      }

      // 旧版兼容更新
      const currentOpenAi = aiConfig.openAI || (window as any).siyuan?.config?.ai?.openAI || {};
      aiConfig.openAI = {
        ...currentOpenAi,
        apiBaseURL: effective.baseUrl,
        apiKey: effective.apiKey,
        apiModel: effective.model,
        apiTimeout: effective.requestTimeoutSeconds ?? 30,
        apiTemperature: effective.temperature ?? 0.7,
        apiMaxTokens: effective.maxTokens ?? 4096,
      };

      const res = await fetchSyncPost("/api/setting/setAI", aiConfig);
      if (res && res.code === 0) {
        if ((window as any).siyuan?.config) {
          (window as any).siyuan.config.ai = aiConfig;
        }
        fetchSyncPost("/api/system/getConf", {}).then((confData) => {
          if (confData && confData.code === 0 && confData.data?.ai && (window as any).siyuan?.config) {
            (window as any).siyuan.config.ai = confData.data.ai;
          }
        }).catch(() => {});

        this.log(`Successfully synchronized to Siyuan system AI (scope: ${targetScope})`);
      } else {
        this.logError("Failed to synchronize to Siyuan system AI", res);
      }
    } catch (err) {
      this.logError("Error updating Siyuan system AI", err);
    }
  }

  // 从思源笔记全量同步/读取配置到旋钮（提供商、编辑器、智能体、决策模型）
  public async syncFromSiyuan(): Promise<{ providersCount: number; profilesCount: number }> {
    try {
      const confRes = await fetchSyncPost("/api/system/getConf", {});
      const fullConf = confRes && confRes.code === 0 ? confRes.data : null;
      const aiConfig = fullConf?.ai || (window as any).siyuan?.config?.ai;

      if (!aiConfig) {
        return { providersCount: 0, profilesCount: 0 };
      }

      const extracted = extractSiyuanAiSettings(aiConfig);

      // 1. 同步提供商
      for (const prov of extracted.providers) {
        const existIdx = this.providers.findIndex((p) => p.id === prov.id || p.displayName === prov.displayName);
        if (existIdx !== -1) {
          this.providers[existIdx] = { ...this.providers[existIdx], ...prov };
        } else {
          this.providers.push(prov);
        }
      }

      let createdProfilesCount = 0;

      // 2. 导入/更新思源-编辑器 Profile
      if (extracted.editing && extracted.editing.model) {
        const profileName = "思源-编辑器";
        let exist = this.profiles.find((p) => p.id === this.bindings["siyuan_builtin_editing"] || p.name === profileName);
        if (!exist) {
          exist = await this.addProfile({
            name: profileName,
            providerId: extracted.editing.providerId,
            provider: extracted.editing.provider,
            protocol: extracted.editing.protocol,
            baseUrl: extracted.editing.baseUrl,
            apiKey: extracted.editing.apiKey,
            model: extracted.editing.model,
            models: [extracted.editing.model],
            temperature: extracted.editing.temperature,
            maxTokens: extracted.editing.maxTokens,
            maxHistoryMessages: extracted.editing.maxHistoryMessages,
            memo: "从思源笔记「设置-人工智能-编辑器」同步的配置",
          });
          createdProfilesCount++;
        } else {
          exist.providerId = extracted.editing.providerId;
          exist.model = extracted.editing.model;
          exist.temperature = extracted.editing.temperature;
          exist.maxTokens = extracted.editing.maxTokens;
          exist.maxHistoryMessages = extracted.editing.maxHistoryMessages;
        }
        this.bindings["siyuan_builtin_editing"] = exist.id;
      }

      // 3. 导入/更新思源-智能体 Profile
      if (extracted.agent && extracted.agent.model) {
        const profileName = "思源-智能体";
        let exist = this.profiles.find((p) => p.id === this.bindings["siyuan_builtin_agent"] || p.name === profileName);
        if (!exist) {
          exist = await this.addProfile({
            name: profileName,
            providerId: extracted.agent.providerId,
            provider: extracted.agent.provider,
            protocol: extracted.agent.protocol,
            baseUrl: extracted.agent.baseUrl,
            apiKey: extracted.agent.apiKey,
            model: extracted.agent.model,
            models: [extracted.agent.model],
            temperature: extracted.agent.temperature,
            maxTokens: extracted.agent.maxTokens,
            maxToolCallRounds: extracted.agent.maxToolCallRounds,
            sessionTimeout: extracted.agent.sessionTimeout,
            streamIdleTimeout: extracted.agent.streamIdleTimeout,
            confirmTimeout: extracted.agent.confirmTimeout,
            maxRetries: extracted.agent.maxRetries,
            memo: "从思源笔记「设置-人工智能-智能体」同步的配置",
          });
          createdProfilesCount++;
        } else {
          exist.providerId = extracted.agent.providerId;
          exist.model = extracted.agent.model;
          exist.temperature = extracted.agent.temperature;
          exist.maxTokens = extracted.agent.maxTokens;
          exist.maxToolCallRounds = extracted.agent.maxToolCallRounds;
          exist.sessionTimeout = extracted.agent.sessionTimeout;
          exist.streamIdleTimeout = extracted.agent.streamIdleTimeout;
          exist.confirmTimeout = extracted.agent.confirmTimeout;
          exist.maxRetries = extracted.agent.maxRetries;
        }
        this.bindings["siyuan_builtin_agent"] = exist.id;
      }

      // 4. 导入/更新思源-决策模型 Profile
      if (extracted.decision && extracted.decision.baseUrl) {
        const profileName = "思源-决策模型";
        let exist = this.profiles.find((p) => p.id === this.bindings["siyuan_builtin_decision"] || p.name === profileName);
        if (!exist) {
          exist = await this.addProfile({
            name: profileName,
            provider: "custom",
            baseUrl: extracted.decision.baseUrl,
            apiKey: extracted.decision.apiKey,
            model: extracted.decision.model,
            models: [extracted.decision.model],
            requestTimeoutSeconds: extracted.decision.requestTimeoutSeconds,
            isDecisionModel: true,
            memo: "从思源笔记「设置-人工智能-决策模型」同步的配置",
          });
          createdProfilesCount++;
        } else {
          exist.baseUrl = extracted.decision.baseUrl;
          exist.apiKey = extracted.decision.apiKey;
          exist.model = extracted.decision.model;
          exist.requestTimeoutSeconds = extracted.decision.requestTimeoutSeconds;
          exist.isDecisionModel = true;
        }
        this.bindings["siyuan_builtin_decision"] = exist.id;
      }

      await this.save();
      return { providersCount: this.providers.length, profilesCount: this.profiles.length };
    } catch (err) {
      this.logError("Failed to sync from Siyuan", err);
      throw err;
    }
  }

  // 一键将全量配置（提供商、编辑器、智能体、决策模型）应用到思源笔记本体
  public async applyAllToSiyuan(): Promise<void> {
    try {
      const confRes = await fetchSyncPost("/api/system/getConf", {});
      const fullConf = confRes && confRes.code === 0 ? confRes.data : null;
      let aiConfig = fullConf?.ai || (window as any).siyuan?.config?.ai || {};

      aiConfig = JSON.parse(JSON.stringify(aiConfig));

      // 1. 同步全量 Providers 到思源
      aiConfig.providers = this.providers.map((p) => ({
        id: p.id,
        displayName: p.displayName,
        enabled: p.enabled ?? true,
        baseURL: p.baseUrl,
        apiKey: p.apiKey,
        protocol: p.protocol || "openai",
        requestTimeout: p.requestTimeout ?? 30,
        headers: p.headers || {},
        models: (p.models || []).map((m) => ({
          id: m.id,
          name: m.name,
          displayName: m.displayName || m.name,
          enabled: m.enabled ?? true,
          contextLength: m.contextLength,
        })),
      }));

      // 2. 更新编辑器
      if (this.bindings["siyuan_builtin_editing"]) {
        const prof = this.profiles.find((p) => p.id === this.bindings["siyuan_builtin_editing"]);
        if (prof) {
          const effective = this.resolveEffectiveProfile(prof);
          if (!aiConfig.editing) aiConfig.editing = {};
          aiConfig.editing.modelId = effective.model;
          if (effective.temperature !== undefined) aiConfig.editing.temperature = effective.temperature;
          if (effective.maxTokens !== undefined) aiConfig.editing.maxCompletionTokens = effective.maxTokens;
          if (effective.maxHistoryMessages !== undefined) aiConfig.editing.maxHistoryMessages = effective.maxHistoryMessages;
        }
      }

      // 3. 更新智能体
      if (this.bindings["siyuan_builtin_agent"]) {
        const prof = this.profiles.find((p) => p.id === this.bindings["siyuan_builtin_agent"]);
        if (prof) {
          const effective = this.resolveEffectiveProfile(prof);
          if (!aiConfig.agent) aiConfig.agent = {};
          aiConfig.agent.modelId = effective.model;
          if (effective.temperature !== undefined) aiConfig.agent.temperature = effective.temperature;
          if (effective.maxTokens !== undefined) aiConfig.agent.maxCompletionTokens = effective.maxTokens;
          if (effective.maxToolCallRounds !== undefined) aiConfig.agent.maxToolCallRounds = effective.maxToolCallRounds;
          if (effective.sessionTimeout !== undefined) aiConfig.agent.sessionTimeout = effective.sessionTimeout;
          if (effective.streamIdleTimeout !== undefined) aiConfig.agent.streamIdleTimeout = effective.streamIdleTimeout;
          if (effective.confirmTimeout !== undefined) aiConfig.agent.confirmTimeout = effective.confirmTimeout;
          if (effective.maxRetries !== undefined) aiConfig.agent.maxRetries = effective.maxRetries;
        }
      }

      // 4. 更新决策模型
      if (this.bindings["siyuan_builtin_decision"]) {
        const prof = this.profiles.find((p) => p.id === this.bindings["siyuan_builtin_decision"]);
        if (prof) {
          const effective = this.resolveEffectiveProfile(prof);
          if (!aiConfig.decision) aiConfig.decision = {};
          aiConfig.decision.enabled = true;
          aiConfig.decision.endpoint = effective.baseUrl;
          aiConfig.decision.apiKey = effective.apiKey;
          aiConfig.decision.name = effective.model;
          if (effective.requestTimeoutSeconds !== undefined) aiConfig.decision.timeout = effective.requestTimeoutSeconds;
        }
      }

      const res = await fetchSyncPost("/api/setting/setAI", aiConfig);
      if (res && res.code === 0) {
        if ((window as any).siyuan?.config) {
          (window as any).siyuan.config.ai = aiConfig;
        }
        this.log("Successfully applied all AI configs to Siyuan system");
      } else {
        throw new Error(res?.msg || "调用 setAI 失败");
      }
    } catch (err) {
      this.logError("Failed to apply all configs to Siyuan", err);
      throw err;
    }
  }

  // ===================== 对齐思源原生 ai.json 格式的导入导出 =====================

  public exportSiyuanAiJson(): string {
    // 构造完全对齐思源原生 ai.json 格式的 JSON 字符串
    const exportData: SiyuanAiJson & { _siyuanApiSwitch?: any } = {
      providers: this.providers.map((p) => ({
        id: p.id,
        displayName: p.displayName,
        enabled: p.enabled ?? true,
        baseURL: p.baseUrl,
        apiKey: p.apiKey,
        protocol: p.protocol || "openai",
        requestTimeout: p.requestTimeout ?? 30,
        headers: p.headers || {},
        models: (p.models || []).map((m) => ({
          id: m.id,
          name: m.name,
          displayName: m.displayName || m.name,
          enabled: m.enabled ?? true,
          contextLength: m.contextLength,
        })),
      })),
      _siyuanApiSwitch: {
        profiles: this.profiles,
        bindings: this.bindings,
      }
    };

    if (this.bindings["siyuan_builtin_editing"]) {
      const prof = this.profiles.find((p) => p.id === this.bindings["siyuan_builtin_editing"]);
      if (prof) {
        const effective = this.resolveEffectiveProfile(prof);
        exportData.editing = {
          modelId: effective.model,
          maxHistoryMessages: effective.maxHistoryMessages ?? 7,
          temperature: effective.temperature ?? 0.7,
          maxCompletionTokens: effective.maxTokens ?? 4096,
        };
      }
    }

    if (this.bindings["siyuan_builtin_agent"]) {
      const prof = this.profiles.find((p) => p.id === this.bindings["siyuan_builtin_agent"]);
      if (prof) {
        const effective = this.resolveEffectiveProfile(prof);
        exportData.agent = {
          modelId: effective.model,
          sessionTimeout: effective.sessionTimeout ?? 1800,
          streamIdleTimeout: effective.streamIdleTimeout ?? 120,
          confirmTimeout: effective.confirmTimeout ?? 600,
          maxRetries: effective.maxRetries ?? 3,
          temperature: effective.temperature ?? 0.7,
          maxCompletionTokens: effective.maxTokens ?? 4096,
          maxToolCallRounds: effective.maxToolCallRounds ?? 64,
        };
      }
    }

    if (this.bindings["siyuan_builtin_decision"]) {
      const prof = this.profiles.find((p) => p.id === this.bindings["siyuan_builtin_decision"]);
      if (prof) {
        const effective = this.resolveEffectiveProfile(prof);
        exportData.decision = {
          enabled: true,
          endpoint: effective.baseUrl,
          apiKey: effective.apiKey,
          name: effective.model,
          timeout: effective.requestTimeoutSeconds ?? 30,
        };
      }
    }

    return JSON.stringify(exportData, null, 2);
  }

  public async importSiyuanAiJson(content: string): Promise<{ providersCount: number; profilesCount: number }> {
    try {
      const parsed = JSON.parse(content);
      if (!parsed || typeof parsed !== "object") {
        throw new Error("无效的 JSON 格式");
      }

      // 1. 如果是旧版纯 Profile 数组格式
      if (Array.isArray(parsed)) {
        const res = await this.importProfiles(parsed);
        return { providersCount: 0, profilesCount: res.added + res.updated };
      }

      // 2. 如果包含 providers
      let importedProviders = 0;
      if (Array.isArray(parsed.providers)) {
        for (const rawP of parsed.providers) {
          const prov: ApiProvider = {
            id: rawP.id || "provider_" + Math.random().toString(36).substring(2, 11),
            displayName: rawP.displayName || rawP.id || "未命名提供商",
            enabled: rawP.enabled ?? true,
            baseUrl: rawP.baseURL || rawP.baseUrl || "",
            apiKey: rawP.apiKey || "",
            protocol: rawP.protocol || "openai",
            requestTimeout: rawP.requestTimeout ?? 30,
            headers: rawP.headers || {},
            models: Array.isArray(rawP.models)
              ? rawP.models.map((m: any) => ({
                  id: m.id || m.name,
                  name: m.name || m.id,
                  displayName: m.displayName || m.name,
                  enabled: m.enabled ?? true,
                  contextLength: m.contextLength,
                }))
              : [],
          };
          const existIdx = this.providers.findIndex((p) => p.id === prov.id);
          if (existIdx !== -1) {
            this.providers[existIdx] = prov;
          } else {
            this.providers.push(prov);
          }
          importedProviders++;
        }
      }

      // 3. 如果包含 _siyuanApiSwitch 扩展
      if (parsed._siyuanApiSwitch?.profiles && Array.isArray(parsed._siyuanApiSwitch.profiles)) {
        await this.importProfiles(parsed._siyuanApiSwitch.profiles);
        if (parsed._siyuanApiSwitch.bindings && typeof parsed._siyuanApiSwitch.bindings === "object") {
          this.bindings = { ...this.bindings, ...parsed._siyuanApiSwitch.bindings };
        }
      } else {
        // 如果是原生思源 ai.json（无 _siyuanApiSwitch），由 editing/agent/decision 派生 Profiles
        if (parsed.editing?.modelId) {
          const matchedProv = this.providers.find((p) => p.models?.some((m) => m.id === parsed.editing.modelId || m.name === parsed.editing.modelId));
          const p = await this.addProfile({
            name: "导入-思源编辑器",
            providerId: matchedProv?.id,
            provider: matchedProv?.protocol || "openai",
            baseUrl: matchedProv?.baseUrl || "",
            apiKey: matchedProv?.apiKey || "",
            model: parsed.editing.modelId,
            temperature: parsed.editing.temperature,
            maxTokens: parsed.editing.maxCompletionTokens,
            maxHistoryMessages: parsed.editing.maxHistoryMessages,
            memo: "从原生 ai.json 导入的编辑器配置",
          });
          this.bindings["siyuan_builtin_editing"] = p.id;
        }

        if (parsed.agent?.modelId) {
          const matchedProv = this.providers.find((p) => p.models?.some((m) => m.id === parsed.agent.modelId || m.name === parsed.agent.modelId));
          const p = await this.addProfile({
            name: "导入-思源智能体",
            providerId: matchedProv?.id,
            provider: matchedProv?.protocol || "openai",
            baseUrl: matchedProv?.baseUrl || "",
            apiKey: matchedProv?.apiKey || "",
            model: parsed.agent.modelId,
            temperature: parsed.agent.temperature,
            maxTokens: parsed.agent.maxCompletionTokens,
            maxToolCallRounds: parsed.agent.maxToolCallRounds,
            sessionTimeout: parsed.agent.sessionTimeout,
            streamIdleTimeout: parsed.agent.streamIdleTimeout,
            confirmTimeout: parsed.agent.confirmTimeout,
            maxRetries: parsed.agent.maxRetries,
            memo: "从原生 ai.json 导入的智能体配置",
          });
          this.bindings["siyuan_builtin_agent"] = p.id;
        }

        if (parsed.decision?.endpoint) {
          const p = await this.addProfile({
            name: "导入-思源决策模型",
            provider: "custom",
            baseUrl: parsed.decision.endpoint,
            apiKey: parsed.decision.apiKey || "",
            model: parsed.decision.name || "jev-latest",
            requestTimeoutSeconds: parsed.decision.timeout ?? 30,
            isDecisionModel: true,
            memo: "从原生 ai.json 导入的决策模型配置",
          });
          this.bindings["siyuan_builtin_decision"] = p.id;
        }
      }

      await this.save();
      return { providersCount: this.providers.length, profilesCount: this.profiles.length };
    } catch (err) {
      this.logError("Failed to import Siyuan ai.json", err);
      throw err;
    }
  }

  // ===================== 插件接管与绑定 =====================

  async bindPlugin(pluginId: string, profileId: string) {
    if (!profileId) {
      delete this.bindings[pluginId];
      this.notifyPluginUpdate(pluginId, null);
    } else {
      this.bindings[pluginId] = profileId;
      const config = this.getBoundSharedConfig(pluginId);
      this.notifyPluginUpdate(pluginId, config);

      const profile = this.profiles.find((p) => p.id === profileId) || null;
      if (pluginId === "siyuan_builtin_editing") {
        await this.updateSiyuanSystemAi(profile, "editing");
      } else if (pluginId === "siyuan_builtin_agent") {
        await this.updateSiyuanSystemAi(profile, "agent");
      } else if (pluginId === "siyuan_builtin_decision") {
        await this.updateSiyuanSystemAi(profile, "decision");
      } else if (pluginId === "siyuan_builtin") {
        await this.updateSiyuanSystemAi(profile, "all");
      }
    }
    await this.save();
  }

  private syncBindingsByProfile(profileId: string) {
    for (const pluginId in this.bindings) {
      if (this.bindings[pluginId] === profileId) {
        const config = this.getBoundSharedConfig(pluginId);
        this.notifyPluginUpdate(pluginId, config);

        const profile = this.profiles.find((p) => p.id === profileId) || null;
        if (pluginId === "siyuan_builtin_editing") {
          this.updateSiyuanSystemAi(profile, "editing");
        } else if (pluginId === "siyuan_builtin_agent") {
          this.updateSiyuanSystemAi(profile, "agent");
        } else if (pluginId === "siyuan_builtin_decision") {
          this.updateSiyuanSystemAi(profile, "decision");
        } else if (pluginId === "siyuan_builtin") {
          this.updateSiyuanSystemAi(profile, "all");
        }
      }
    }
  }

  private notifyPluginUpdate(pluginId: string, config: SharedConfig | null) {
    const reg = this.registrations.get(pluginId);
    if (reg) {
      try {
        reg.callback(config);
        this.log(`Notified plugin ${pluginId} with config update`);
      } catch (err) {
        this.logError(`Failed to notify plugin ${pluginId}`, err);
      }
    }
  }

  // 用于 UI 展示的注册列表
  getRegisteredPlugins(): RegisteredPluginInfo[] {
    const list: RegisteredPluginInfo[] = [];

    for (const [pluginId, reg] of this.registrations.entries()) {
      const boundId = this.bindings[pluginId] || "";
      list.push({
        pluginId,
        displayName: reg.displayName,
        isBound: Boolean(boundId),
        boundProfileId: boundId,
        localConfig: reg.localConfig,
      });
    }

    let extracted: {
      editing: SiyuanExtractedAiInfo | null;
      agent: SiyuanExtractedAiInfo | null;
      decision: SiyuanExtractedAiInfo | null;
    } = { editing: null, agent: null, decision: null };

    try {
      const ai = (window as any).siyuan?.config?.ai;
      if (ai) {
        extracted = extractSiyuanAiSettings(ai);
      }
    } catch (e) {}

    // 1. 思源笔记 API - 编辑器
    const editingBoundId = this.bindings["siyuan_builtin_editing"] || "";
    list.push({
      pluginId: "siyuan_builtin_editing",
      displayName: "思源笔记 API-编辑器",
      isBound: Boolean(editingBoundId),
      boundProfileId: editingBoundId,
      localConfig: extracted.editing || undefined,
    });

    // 2. 思源笔记 API - 智能体
    const agentBoundId = this.bindings["siyuan_builtin_agent"] || "";
    list.push({
      pluginId: "siyuan_builtin_agent",
      displayName: "思源笔记 API-智能体",
      isBound: Boolean(agentBoundId),
      boundProfileId: agentBoundId,
      localConfig: extracted.agent || undefined,
    });

    // 3. 思源笔记 API - 决策模型
    const decisionBoundId = this.bindings["siyuan_builtin_decision"] || "";
    list.push({
      pluginId: "siyuan_builtin_decision",
      displayName: "思源笔记 API-决策模型",
      isBound: Boolean(decisionBoundId),
      boundProfileId: decisionBoundId,
      localConfig: extracted.decision || undefined,
    });

    return list;
  }

  // 从本地配置一键导入为 Profile 并自动绑定
  async importLocalConfigToProfile(pluginId: string) {
    let lc: any = undefined;
    let displayName = "";

    const regPlugins = this.getRegisteredPlugins();
    const targetPlug = regPlugins.find((p) => p.pluginId === pluginId);
    if (targetPlug && targetPlug.localConfig) {
      lc = targetPlug.localConfig;
      displayName = targetPlug.displayName;
    } else {
      const reg = this.registrations.get(pluginId);
      if (reg && reg.localConfig) {
        lc = reg.localConfig;
        displayName = reg.displayName;
      }
    }

    if (!lc) return;

    const profileName = `导入 - ${displayName}`;

    const newProfile = await this.addProfile({
      name: profileName,
      providerId: lc.providerId,
      provider: lc.provider || "custom",
      protocol: lc.protocol,
      baseUrl: lc.baseUrl || "",
      apiKey: lc.apiKey || "",
      model: lc.model || "",
      models: lc.models || (lc.model ? [lc.model] : []),
      headers: lc.headers,
      requestTimeoutSeconds: lc.requestTimeoutSeconds,
      temperature: lc.temperature,
      maxTokens: lc.maxTokens,
      maxHistoryMessages: lc.maxHistoryMessages,
      maxToolCallRounds: lc.maxToolCallRounds,
      sessionTimeout: lc.sessionTimeout,
      streamIdleTimeout: lc.streamIdleTimeout,
      confirmTimeout: lc.confirmTimeout,
      maxRetries: lc.maxRetries,
      isDecisionModel: lc.isDecisionModel,
      memo: `从 ${displayName} 本地一键导入的配置`,
      providerUrl: "",
    });

    await this.bindPlugin(pluginId, newProfile.id);
    this.log(`Imported local config from ${pluginId} to new profile: ${profileName}`);
  }

  // 一键配置应用至所有接管项目
  async applyProfileToAllPlugins(profileId: string) {
    if (!profileId) return;

    const allPluginIds = [
      ...this.registrations.keys(),
      "siyuan_builtin_editing",
      "siyuan_builtin_agent",
      "siyuan_builtin_decision",
    ];

    for (const pluginId of allPluginIds) {
      this.bindings[pluginId] = profileId;
      const config = this.getBoundSharedConfig(pluginId);
      this.notifyPluginUpdate(pluginId, config);

      const profile = this.profiles.find((p) => p.id === profileId) || null;
      if (pluginId === "siyuan_builtin_editing") {
        await this.updateSiyuanSystemAi(profile, "editing");
      } else if (pluginId === "siyuan_builtin_agent") {
        await this.updateSiyuanSystemAi(profile, "agent");
      } else if (pluginId === "siyuan_builtin_decision") {
        await this.updateSiyuanSystemAi(profile, "decision");
      } else if (pluginId === "siyuan_builtin") {
        await this.updateSiyuanSystemAi(profile, "all");
      }
    }

    await this.save();
  }
}

export const apiSwitchCore = new ApiSwitchCore();
