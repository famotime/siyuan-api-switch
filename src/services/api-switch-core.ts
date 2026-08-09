import { Plugin, fetchSyncPost } from "siyuan";
import { SharedConfig, SiyuanApiSwitch } from "@/types";

export interface ApiProfile {
  id: string;
  name: string;
  provider: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  models?: string[];
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
  memo?: string;
  providerUrl?: string;
}

export interface ApiSwitchStorage {
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
  provider: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  requestTimeoutSeconds?: number;
  temperature?: number;
  maxTokens?: number;
  maxHistoryMessages?: number;
  maxToolCallRounds?: number;
  sessionTimeout?: number;
  streamIdleTimeout?: number;
  confirmTimeout?: number;
  maxRetries?: number;
}

export function extractSiyuanAiSettings(aiConfig: any): {
  editing: SiyuanExtractedAiInfo | null;
  agent: SiyuanExtractedAiInfo | null;
} {
  if (!aiConfig || typeof aiConfig !== "object") {
    return { editing: null, agent: null };
  }

  const providers = Array.isArray(aiConfig.providers) ? aiConfig.providers : [];

  const getBaseUrl = (obj: any): string => {
    if (!obj || typeof obj !== "object") return "";
    return obj.baseURL || obj.baseUrl || obj.apiBaseURL || obj.apiBaseUrl || "";
  };

  const getApiKey = (obj: any): string => {
    if (!obj || typeof obj !== "object") return "";
    return obj.apiKey || obj.apikey || obj.api_key || "";
  };

  function resolveModel(modelId?: string) {
    if (!modelId || providers.length === 0) return null;
    for (const p of providers) {
      if (!p || !p.enabled) continue;
      if (Array.isArray(p.models)) {
        for (const m of p.models) {
          if (m && m.enabled && (m.id === modelId || m.displayName === modelId || m.name === modelId)) {
            return { provider: p, model: m };
          }
        }
      }
    }
    const fallbackProvider = providers.find((p: any) => p && p.enabled && getApiKey(p) !== "") || providers[0];
    if (fallbackProvider) {
      const fallbackModel = fallbackProvider.models?.find((m: any) => m && m.enabled) || fallbackProvider.models?.[0];
      return { provider: fallbackProvider, model: fallbackModel };
    }
    return null;
  }

  // 1. 思源笔记 API - 编辑器 (Editing)
  let editingConfig: SiyuanExtractedAiInfo | null = null;
  const editingResolved = resolveModel(aiConfig.editing?.modelId);
  if (editingResolved && editingResolved.provider) {
    editingConfig = {
      provider: editingResolved.provider.protocol || "openai",
      baseUrl: getBaseUrl(editingResolved.provider),
      apiKey: getApiKey(editingResolved.provider),
      model: editingResolved.model?.name || editingResolved.model?.id || aiConfig.editing?.modelId || "",
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

  // 2. 思源笔记 API - 智能体 (Agent)
  let agentConfig: SiyuanExtractedAiInfo | null = null;
  const agentResolved = resolveModel(aiConfig.agent?.modelId);
  if (agentResolved && agentResolved.provider) {
    agentConfig = {
      provider: agentResolved.provider.protocol || "openai",
      baseUrl: getBaseUrl(agentResolved.provider),
      apiKey: getApiKey(agentResolved.provider),
      model: agentResolved.model?.name || agentResolved.model?.id || aiConfig.agent?.modelId || "",
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

  return { editing: editingConfig, agent: agentConfig };
}

class ApiSwitchCore {
  private plugin: Plugin | null = null;
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

  // 用一个 ref 方式通知 UI 更新
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
    await this.syncSiyuanBuiltinBindings();
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
    } catch (err) {
      this.logError("Failed to sync Siyuan builtin bindings on initialize", err);
    }
  }

  private async loadData() {
    if (!this.plugin) return;
    try {
      const data = await this.plugin.loadData(STORAGE_KEY);
      if (data) {
        this.profiles = Array.isArray(data.profiles) ? data.profiles : [];
        // 数据向后兼容兼容：若 models 不存在，则用 [model] 初始化
        this.profiles.forEach((p) => {
          if (!p.models || !Array.isArray(p.models)) {
            p.models = p.model ? [p.model] : [];
          }
        });
        this.bindings = data.bindings && typeof data.bindings === "object" ? data.bindings : {};
      } else {
        this.profiles = [];
        this.bindings = {};
      }
    } catch (err) {
      this.logError("Failed to load config data", err);
      this.profiles = [];
      this.bindings = {};
    }
  }

  async save() {
    if (!this.plugin) return;
    try {
      const data: ApiSwitchStorage = {
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
    // 卸载全局对象并通知所有注册的插件解除接管
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

    // 注册时立即将当前绑定的配置通知过去
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

  // 获取共享配置
  private getBoundSharedConfig(pluginId: string): SharedConfig | null {
    const profileId = this.bindings[pluginId];
    if (!profileId) return null;

    const profile = this.profiles.find((p) => p.id === profileId);
    if (!profile) return null;

    const conf: SharedConfig = {
      profileId: profile.id,
      profileName: profile.name,
      provider: profile.provider,
      baseUrl: profile.baseUrl,
      apiKey: profile.apiKey,
      model: profile.model,
      models: profile.models || (profile.model ? [profile.model] : []),
    };

    if (profile.requestTimeoutSeconds !== undefined && profile.requestTimeoutSeconds !== null) conf.requestTimeoutSeconds = profile.requestTimeoutSeconds;
    if (profile.temperature !== undefined && profile.temperature !== null) conf.temperature = profile.temperature;
    if (profile.maxTokens !== undefined && profile.maxTokens !== null) conf.maxTokens = profile.maxTokens;
    if (profile.maxHistoryMessages !== undefined && profile.maxHistoryMessages !== null) conf.maxHistoryMessages = profile.maxHistoryMessages;
    if (profile.maxToolCallRounds !== undefined && profile.maxToolCallRounds !== null) conf.maxToolCallRounds = profile.maxToolCallRounds;
    if (profile.sessionTimeout !== undefined && profile.sessionTimeout !== null) conf.sessionTimeout = profile.sessionTimeout;
    if (profile.streamIdleTimeout !== undefined && profile.streamIdleTimeout !== null) conf.streamIdleTimeout = profile.streamIdleTimeout;
    if (profile.confirmTimeout !== undefined && profile.confirmTimeout !== null) conf.confirmTimeout = profile.confirmTimeout;
    if (profile.maxRetries !== undefined && profile.maxRetries !== null) conf.maxRetries = profile.maxRetries;
    if (profile.memo) conf.memo = profile.memo;
    if (profile.providerUrl) conf.providerUrl = profile.providerUrl;

    return conf;
  }

  // 管理 API Profiles
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
      if (!prof.name || !prof.provider || !prof.model) continue;

      const normalizedProf: ApiProfile = {
        id: prof.id || "prof_" + Math.random().toString(36).substring(2, 11),
        name: String(prof.name),
        provider: String(prof.provider),
        baseUrl: String(prof.baseUrl || ""),
        apiKey: String(prof.apiKey || ""),
        model: String(prof.model),
        models: Array.isArray(prof.models) ? prof.models.map(String) : (prof.model ? [String(prof.model)] : []),
        requestTimeoutSeconds: prof.requestTimeoutSeconds !== undefined ? Number(prof.requestTimeoutSeconds) : undefined,
        temperature: prof.temperature !== undefined ? Number(prof.temperature) : undefined,
        maxTokens: prof.maxTokens !== undefined ? Number(prof.maxTokens) : undefined,
        maxHistoryMessages: prof.maxHistoryMessages !== undefined ? Number(prof.maxHistoryMessages) : undefined,
        maxToolCallRounds: prof.maxToolCallRounds !== undefined ? Number(prof.maxToolCallRounds) : undefined,
        sessionTimeout: prof.sessionTimeout !== undefined ? Number(prof.sessionTimeout) : undefined,
        streamIdleTimeout: prof.streamIdleTimeout !== undefined ? Number(prof.streamIdleTimeout) : undefined,
        confirmTimeout: prof.confirmTimeout !== undefined ? Number(prof.confirmTimeout) : undefined,
        maxRetries: prof.maxRetries !== undefined ? Number(prof.maxRetries) : undefined,
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
    
    // 先找出所有绑定了此 Profile 的插件 ID，不直接在循环中修改 bindings 对象，规避遍历时修改属性的潜在引擎报错
    const pluginsToUnbind: string[] = [];
    for (const pluginId in this.bindings) {
      if (this.bindings[pluginId] === profileId) {
        pluginsToUnbind.push(pluginId);
      }
    }
    
    // 统一执行解绑与通知
    for (const pluginId of pluginsToUnbind) {
      delete this.bindings[pluginId];
      this.notifyPluginUpdate(pluginId, null);
    }
    
    await this.save();
  }

  // 将最新的 Profile 同步给思源笔记内置的 AI 配置
  private async updateSiyuanSystemAi(profile: ApiProfile | null, targetScope: "editing" | "agent" | "all" = "all") {
    if (!profile) return;
    
    try {
      // 1. 获取完整的思源 conf 配置，拿到全量 AI 节点
      const confRes = await fetchSyncPost("/api/system/getConf", {});
      const fullConf = confRes && confRes.code === 0 ? confRes.data : null;
      let aiConfig = fullConf?.ai || (window as any).siyuan?.config?.ai || {};

      // 深拷贝，避免对只读引用修改
      aiConfig = JSON.parse(JSON.stringify(aiConfig));

      // 2. 最新版 Multi-Provider 结构更新
      if (typeof aiConfig === "object") {
        if (!Array.isArray(aiConfig.providers)) {
          aiConfig.providers = [];
        }

        const modelId = profile.model || "custom-model";
        const providerId = `provider_${profile.provider || 'custom'}`;

        // 查找匹配的 Provider
        let targetProvider = aiConfig.providers.find(
          (p: any) => p.id === providerId || p.displayName === profile.name || (profile.provider && p.protocol === profile.provider && p.displayName === profile.name)
        );

        if (!targetProvider) {
          targetProvider = {
            id: providerId,
            displayName: profile.name || "API Switch Custom",
            enabled: true,
            protocol: profile.provider || "openai",
            models: []
          };
          aiConfig.providers.push(targetProvider);
        }

        // 更新 Provider 属性
        targetProvider.enabled = true;
        targetProvider.apiKey = profile.apiKey || "";
        targetProvider.baseURL = profile.baseUrl || "";
        targetProvider.baseUrl = profile.baseUrl || "";
        if (profile.requestTimeoutSeconds !== undefined && profile.requestTimeoutSeconds !== null && !isNaN(profile.requestTimeoutSeconds)) {
          targetProvider.requestTimeout = profile.requestTimeoutSeconds;
        }
        if (!targetProvider.protocol) {
          targetProvider.protocol = profile.provider || "openai";
        }

        // 确保 models 列表中包含 modelId
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

        // 如果 Profile 包含多个候选模型，也同步加入模型列表
        if (Array.isArray(profile.models)) {
          for (const mName of profile.models) {
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

        // 根据 targetScope 分离更新“编辑器”与“智能体”配置（注：为空的参数不下发/不覆盖）
        if (targetScope === "agent" || targetScope === "all") {
          if (!aiConfig.agent || typeof aiConfig.agent !== "object") {
            aiConfig.agent = {};
          }
          aiConfig.agent.modelId = targetModelId;
          if (profile.temperature !== undefined && profile.temperature !== null && !isNaN(profile.temperature)) {
            aiConfig.agent.temperature = profile.temperature;
          }
          if (profile.maxTokens !== undefined && profile.maxTokens !== null && !isNaN(profile.maxTokens)) {
            aiConfig.agent.maxCompletionTokens = profile.maxTokens;
          }
          if (profile.maxToolCallRounds !== undefined && profile.maxToolCallRounds !== null && !isNaN(profile.maxToolCallRounds)) {
            aiConfig.agent.maxToolCallRounds = profile.maxToolCallRounds;
          }
          if (profile.sessionTimeout !== undefined && profile.sessionTimeout !== null && !isNaN(profile.sessionTimeout)) {
            aiConfig.agent.sessionTimeout = profile.sessionTimeout;
          }
          if (profile.streamIdleTimeout !== undefined && profile.streamIdleTimeout !== null && !isNaN(profile.streamIdleTimeout)) {
            aiConfig.agent.streamIdleTimeout = profile.streamIdleTimeout;
          }
          if (profile.confirmTimeout !== undefined && profile.confirmTimeout !== null && !isNaN(profile.confirmTimeout)) {
            aiConfig.agent.confirmTimeout = profile.confirmTimeout;
          }
          if (profile.maxRetries !== undefined && profile.maxRetries !== null && !isNaN(profile.maxRetries)) {
            aiConfig.agent.maxRetries = profile.maxRetries;
          }
        }

        if (targetScope === "editing" || targetScope === "all") {
          if (!aiConfig.editing || typeof aiConfig.editing !== "object") {
            aiConfig.editing = {};
          }
          aiConfig.editing.modelId = targetModelId;
          if (profile.temperature !== undefined && profile.temperature !== null && !isNaN(profile.temperature)) {
            aiConfig.editing.temperature = profile.temperature;
          }
          if (profile.maxTokens !== undefined && profile.maxTokens !== null && !isNaN(profile.maxTokens)) {
            aiConfig.editing.maxCompletionTokens = profile.maxTokens;
          }
          if (profile.maxHistoryMessages !== undefined && profile.maxHistoryMessages !== null && !isNaN(profile.maxHistoryMessages)) {
            aiConfig.editing.maxHistoryMessages = profile.maxHistoryMessages;
          }
        }
      }

      // 3. 旧版 openAI 结构兼容更新
      const currentOpenAi = aiConfig.openAI || (window as any).siyuan?.config?.ai?.openAI || {};
      const updatedOpenAi = {
        ...currentOpenAi,
        apiBaseURL: profile.baseUrl,
        apiKey: profile.apiKey,
        apiModel: profile.model,
        apiTimeout: profile.requestTimeoutSeconds ?? 30,
        apiTemperature: profile.temperature ?? 0.7,
        apiMaxTokens: profile.maxTokens ?? 4096,
      };
      aiConfig.openAI = updatedOpenAi;

      // 4. 调用思源接口修改设置（发送全量 ai 对象）
      const res = await fetchSyncPost("/api/setting/setAI", aiConfig);
      
      if (res && res.code === 0) {
        // 同步修改内存中的 AI 配置节点，绝不覆盖整套 window.siyuan.config 引用，避免损坏思源前端运行时 editor 等对象
        if ((window as any).siyuan?.config) {
          (window as any).siyuan.config.ai = aiConfig;
        }
        // 重新异步校验拉取系统配置，并仅增量同步 ai 节点
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

  // 管理绑定
  async bindPlugin(pluginId: string, profileId: string) {
    if (!profileId) {
      delete this.bindings[pluginId];
      this.notifyPluginUpdate(pluginId, null);
    } else {
      this.bindings[pluginId] = profileId;
      const config = this.getBoundSharedConfig(pluginId);
      this.notifyPluginUpdate(pluginId, config);
      
      // 如果是思源内置AI，则写回思源配置
      const profile = this.profiles.find(p => p.id === profileId) || null;
      if (pluginId === "siyuan_builtin_editing") {
        await this.updateSiyuanSystemAi(profile, "editing");
      } else if (pluginId === "siyuan_builtin_agent") {
        await this.updateSiyuanSystemAi(profile, "agent");
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
        
        // 如果思源内置AI绑定了该Profile，则同步更新
        const profile = this.profiles.find(p => p.id === profileId) || null;
        if (pluginId === "siyuan_builtin_editing") {
          this.updateSiyuanSystemAi(profile, "editing");
        } else if (pluginId === "siyuan_builtin_agent") {
          this.updateSiyuanSystemAi(profile, "agent");
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
    
    // 从已注册 of Map 里拿插件，同时查一下 bindings
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

    // 提取思源笔记系统内置 AI 的“编辑器”和“智能体”两条路线
    let extracted = { editing: null as SiyuanExtractedAiInfo | null, agent: null as SiyuanExtractedAiInfo | null };
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
      localConfig: extracted.editing || undefined
    });

    // 2. 思源笔记 API - 智能体
    const agentBoundId = this.bindings["siyuan_builtin_agent"] || "";
    list.push({
      pluginId: "siyuan_builtin_agent",
      displayName: "思源笔记 API-智能体",
      isBound: Boolean(agentBoundId),
      boundProfileId: agentBoundId,
      localConfig: extracted.agent || undefined
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
      provider: lc.provider || "custom",
      baseUrl: lc.baseUrl || "",
      apiKey: lc.apiKey || "",
      model: lc.model || "",
      models: lc.models || (lc.model ? [lc.model] : []),
      requestTimeoutSeconds: lc.requestTimeoutSeconds,
      temperature: lc.temperature,
      maxTokens: lc.maxTokens,
      maxHistoryMessages: lc.maxHistoryMessages,
      maxToolCallRounds: lc.maxToolCallRounds,
      sessionTimeout: lc.sessionTimeout,
      streamIdleTimeout: lc.streamIdleTimeout,
      confirmTimeout: lc.confirmTimeout,
      maxRetries: lc.maxRetries,
      memo: `从 ${displayName} 本地一键导入的配置`,
      providerUrl: "",
    });

    await this.bindPlugin(pluginId, newProfile.id);
    this.log(`Imported local config from ${pluginId} to new profile: ${profileName}`);
  }

  // 一键配置应用至所有接管项目
  async applyProfileToAllPlugins(profileId: string) {
    if (!profileId) return;
    
    // 获取全部待绑定插件，包括已注册的第三方子插件和思源内置的编辑器与智能体 API
    const allPluginIds = [...this.registrations.keys(), "siyuan_builtin_editing", "siyuan_builtin_agent"];
    
    for (const pluginId of allPluginIds) {
      this.bindings[pluginId] = profileId;
      const config = this.getBoundSharedConfig(pluginId);
      this.notifyPluginUpdate(pluginId, config);
      
      const profile = this.profiles.find(p => p.id === profileId) || null;
      if (pluginId === "siyuan_builtin_editing") {
        await this.updateSiyuanSystemAi(profile, "editing");
      } else if (pluginId === "siyuan_builtin_agent") {
        await this.updateSiyuanSystemAi(profile, "agent");
      } else if (pluginId === "siyuan_builtin") {
        await this.updateSiyuanSystemAi(profile, "all");
      }
    }
    
    await this.save();
  }
}

export const apiSwitchCore = new ApiSwitchCore();

