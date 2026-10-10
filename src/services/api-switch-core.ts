import { Plugin, fetchSyncPost } from "siyuan";
import { SharedConfig, SiyuanApiSwitch, ApiProvider } from "@/types";
import { ProviderStore } from "./provider-store";
import { ProfileStore, ApiProfile } from "./profile-store";
import { PluginBindingManager, RegisteredPluginInfo } from "./plugin-binding-manager";
import { SiyuanAdapter, extractSiyuanAiSettings, SiyuanExtractedAiInfo } from "./siyuan-adapter";

export type { ApiProfile } from "./profile-store";
export type { RegisteredPluginInfo } from "./plugin-binding-manager";
export { extractSiyuanAiSettings };
export type { SiyuanExtractedAiInfo } from "./siyuan-adapter";

export interface ApiSwitchStorage {
  providers?: ApiProvider[];
  profiles: ApiProfile[];
  bindings: Record<string, string>; // pluginId -> profileId
}

const STORAGE_KEY = "config.json";

export class ApiSwitchCore {
  private plugin: Plugin | null = null;
  private providerStore: ProviderStore;
  private profileStore: ProfileStore;
  private bindingManager: PluginBindingManager;
  private siyuanAdapter: SiyuanAdapter;

  // ref 方式通知 UI 更新
  public onStateChange: (() => void) | null = null;

  constructor() {
    this.providerStore = new ProviderStore(() => this.save());
    this.profileStore = new ProfileStore(() => this.save());
    this.bindingManager = new PluginBindingManager(
      (msg, ...args) => this.log(msg, ...args),
      (msg, ...args) => this.logError(msg, ...args)
    );
    this.siyuanAdapter = new SiyuanAdapter(
      (msg, ...args) => this.log(msg, ...args),
      (msg, ...args) => this.logError(msg, ...args)
    );
  }

  // 内部属性代理，保持测试与兼容层透明
  public get providers(): ApiProvider[] {
    return this.providerStore.getProviders();
  }
  public set providers(val: ApiProvider[]) {
    this.providerStore.setProviders(val);
  }

  public get profiles(): ApiProfile[] {
    return this.profileStore.getProfiles();
  }
  public set profiles(val: ApiProfile[]) {
    this.profileStore.setProfiles(val);
  }

  public get bindings(): Record<string, string> {
    return this.bindingManager.getBindings();
  }
  public set bindings(val: Record<string, string>) {
    this.bindingManager.setBindings(val);
  }

  public get registrations() {
    return this.bindingManager.getRegistrations();
  }
  public set registrations(val: Map<string, any>) {
    this.bindingManager.setRegistrations(val);
  }

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
        const profile = this.profileStore.getProfile(this.bindings["siyuan_builtin_editing"]);
        if (profile) {
          await this.updateSiyuanSystemAi(profile, "editing");
        }
      }
      if (this.bindings["siyuan_builtin_agent"]) {
        const profile = this.profileStore.getProfile(this.bindings["siyuan_builtin_agent"]);
        if (profile) {
          await this.updateSiyuanSystemAi(profile, "agent");
        }
      }
      if (this.bindings["siyuan_builtin_decision"]) {
        const profile = this.profileStore.getProfile(this.bindings["siyuan_builtin_decision"]);
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
        this.providerStore.setProviders(data.providers || []);
        this.profileStore.setProfiles(data.profiles || []);
        this.bindingManager.setBindings(data.bindings || {});
      } else {
        this.providerStore.setProviders([]);
        this.profileStore.setProfiles([]);
        this.bindingManager.setBindings({});
      }
    } catch (err) {
      this.logError("Failed to load config data", err);
      this.providerStore.setProviders([]);
      this.profileStore.setProfiles([]);
      this.bindingManager.setBindings({});
    }
  }

  async save() {
    if (!this.plugin) return;
    try {
      const data: ApiSwitchStorage = {
        providers: this.providerStore.getProviders(),
        profiles: this.profileStore.getProfiles(),
        bindings: this.bindingManager.getBindings(),
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
      version: (this.plugin as any)?.version || "0.0.1",
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
    this.bindingManager.destroy();
  }

  // 子插件注册逻辑
  private registerPlugin(
    pluginId: string,
    displayName: string,
    callback: (config: SharedConfig | null) => void,
    localConfig?: Omit<SharedConfig, "profileId" | "profileName">
  ) {
    const boundConfig = this.getBoundSharedConfig(pluginId);
    this.bindingManager.registerPlugin(pluginId, displayName, callback, localConfig, boundConfig);
    if (this.onStateChange) {
      this.onStateChange();
    }
  }

  private unregisterPlugin(pluginId: string) {
    this.bindingManager.unregisterPlugin(pluginId);
    if (this.onStateChange) {
      this.onStateChange();
    }
  }

  // 解析 Profile 的有效参数（联动继承 Provider）
  public resolveEffectiveProfile(profile: ApiProfile): ApiProfile {
    return this.profileStore.resolveEffectiveProfile(profile, this.providerStore.getProviders());
  }

  // 获取共享配置（供插件调用）
  public getBoundSharedConfig(pluginId: string): SharedConfig | null {
    const profileId = this.bindingManager.getBoundProfileId(pluginId);
    if (!profileId) return null;

    const rawProfile = this.profileStore.getProfile(profileId);
    if (!rawProfile) return null;

    const effective = this.resolveEffectiveProfile(rawProfile);
    return this.profileStore.toSharedConfig(effective);
  }

  // ===================== API 提供商管理 (Providers) =====================

  getProviders(): ApiProvider[] {
    return this.providerStore.getProviders();
  }

  getProvider(id: string): ApiProvider | null {
    return this.providerStore.getProvider(id);
  }

  async addProvider(provider: Omit<ApiProvider, "id">): Promise<ApiProvider> {
    return this.providerStore.addProvider(provider);
  }

  async updateProvider(provider: ApiProvider): Promise<void> {
    await this.providerStore.updateProvider(provider);
    // 通知所有关联此提供商的 Profile 绑定的插件
    for (const profile of this.profileStore.getProfiles()) {
      if (profile.providerId === provider.id) {
        this.syncBindingsByProfile(profile.id);
      }
    }
  }

  async deleteProvider(providerId: string): Promise<void> {
    await this.providerStore.deleteProvider(providerId);
    // 解除 Profile 对该提供商的关联
    for (const profile of this.profileStore.getProfiles()) {
      if (profile.providerId === providerId) {
        profile.providerId = undefined;
      }
    }
    await this.save();
  }

  // ===================== API Profiles 管理 =====================

  getProfiles(): ApiProfile[] {
    return this.profileStore.getProfiles();
  }

  getProfile(id: string): ApiProfile | null {
    return this.profileStore.getProfile(id);
  }

  async addProfile(profile: Omit<ApiProfile, "id">): Promise<ApiProfile> {
    return this.profileStore.addProfile(profile);
  }

  async importProfiles(imported: ApiProfile[]): Promise<{ added: number; updated: number }> {
    return this.profileStore.importProfiles(imported);
  }

  async updateProfile(profile: ApiProfile): Promise<void> {
    await this.profileStore.updateProfile(profile);
    this.syncBindingsByProfile(profile.id);
  }

  async deleteProfile(profileId: string): Promise<void> {
    await this.profileStore.deleteProfile(profileId);

    const pluginsToUnbind: string[] = [];
    const bindings = this.bindingManager.getBindings();
    for (const pluginId in bindings) {
      if (bindings[pluginId] === profileId) {
        pluginsToUnbind.push(pluginId);
      }
    }

    for (const pluginId of pluginsToUnbind) {
      this.bindingManager.removeBinding(pluginId);
      this.bindingManager.notifyPluginUpdate(pluginId, null);
    }

    await this.save();
  }

  // ===================== 思源系统 AI 同步与写回 =====================

  public async updateSiyuanSystemAi(profile: ApiProfile | null, targetScope: "editing" | "agent" | "decision" | "all" = "all") {
    if (!profile) return;
    const effective = this.resolveEffectiveProfile(profile);
    await this.siyuanAdapter.updateSiyuanSystemAi(effective, targetScope);
  }

  // 从思源笔记全量同步/读取配置到旋钮（提供商、编辑器、智能体、决策模型）
  public async syncFromSiyuan(): Promise<{ providersCount: number; profilesCount: number }> {
    try {
      const aiConfig = await this.siyuanAdapter.fetchSystemAiConfig();
      if (!aiConfig) {
        return { providersCount: 0, profilesCount: 0 };
      }

      const extracted = extractSiyuanAiSettings(aiConfig);

      // 1. 同步提供商
      const currentProviders = this.providerStore.getProviders();
      for (const prov of extracted.providers) {
        const existIdx = currentProviders.findIndex((p) => p.id === prov.id || p.displayName === prov.displayName);
        if (existIdx !== -1) {
          currentProviders[existIdx] = { ...currentProviders[existIdx], ...prov };
        } else {
          currentProviders.push(prov);
        }
      }
      this.providerStore.setProviders(currentProviders);

      let createdProfilesCount = 0;
      const profiles = this.profileStore.getProfiles();
      const bindings = this.bindingManager.getBindings();

      // 2. 导入/更新思源-编辑器 Profile
      if (extracted.editing && extracted.editing.model) {
        const profileName = "思源-编辑器";
        let exist = profiles.find((p) => p.id === bindings["siyuan_builtin_editing"] || p.name === profileName);
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
        this.bindingManager.setBinding("siyuan_builtin_editing", exist.id);
      }

      // 3. 导入/更新思源-智能体 Profile
      if (extracted.agent && extracted.agent.model) {
        const profileName = "思源-智能体";
        let exist = profiles.find((p) => p.id === bindings["siyuan_builtin_agent"] || p.name === profileName);
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
        this.bindingManager.setBinding("siyuan_builtin_agent", exist.id);
      }

      // 4. 导入/更新思源-决策模型 Profile
      if (extracted.decision && extracted.decision.baseUrl) {
        const profileName = "思源-决策模型";
        let exist = profiles.find((p) => p.id === bindings["siyuan_builtin_decision"] || p.name === profileName);
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
        this.bindingManager.setBinding("siyuan_builtin_decision", exist.id);
      }

      await this.save();
      return { providersCount: this.providerStore.getProviders().length, profilesCount: this.profileStore.getProfiles().length };
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
      aiConfig.providers = this.providerStore.getProviders().map((p) => ({
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
      const bindings = this.bindingManager.getBindings();
      if (bindings["siyuan_builtin_editing"]) {
        const prof = this.profileStore.getProfile(bindings["siyuan_builtin_editing"]);
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
      if (bindings["siyuan_builtin_agent"]) {
        const prof = this.profileStore.getProfile(bindings["siyuan_builtin_agent"]);
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
      if (bindings["siyuan_builtin_decision"]) {
        const prof = this.profileStore.getProfile(bindings["siyuan_builtin_decision"]);
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
    return this.siyuanAdapter.exportSiyuanAiJson(
      this.providerStore.getProviders(),
      this.profileStore.getProfiles(),
      this.bindingManager.getBindings(),
      (p) => this.resolveEffectiveProfile(p)
    );
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
      const currentProviders = this.providerStore.getProviders();
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
          const existIdx = currentProviders.findIndex((p) => p.id === prov.id);
          if (existIdx !== -1) {
            currentProviders[existIdx] = prov;
          } else {
            currentProviders.push(prov);
          }
          importedProviders++;
        }
        this.providerStore.setProviders(currentProviders);
      }

      // 3. 如果包含 _siyuanApiSwitch 扩展
      if (parsed._siyuanApiSwitch?.profiles && Array.isArray(parsed._siyuanApiSwitch.profiles)) {
        await this.importProfiles(parsed._siyuanApiSwitch.profiles);
        if (parsed._siyuanApiSwitch.bindings && typeof parsed._siyuanApiSwitch.bindings === "object") {
          this.bindingManager.setBindings({ ...this.bindingManager.getBindings(), ...parsed._siyuanApiSwitch.bindings });
        }
      } else {
        // 如果是原生思源 ai.json（无 _siyuanApiSwitch），由 editing/agent/decision 派生 Profiles
        if (parsed.editing?.modelId) {
          const matchedProv = this.providerStore.getProviders().find((p) => p.models?.some((m) => m.id === parsed.editing.modelId || m.name === parsed.editing.modelId));
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
          this.bindingManager.setBinding("siyuan_builtin_editing", p.id);
        }

        if (parsed.agent?.modelId) {
          const matchedProv = this.providerStore.getProviders().find((p) => p.models?.some((m) => m.id === parsed.agent.modelId || m.name === parsed.agent.modelId));
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
          this.bindingManager.setBinding("siyuan_builtin_agent", p.id);
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
          this.bindingManager.setBinding("siyuan_builtin_decision", p.id);
        }
      }

      await this.save();
      return { providersCount: this.providerStore.getProviders().length, profilesCount: this.profileStore.getProfiles().length };
    } catch (err) {
      this.logError("Failed to import Siyuan ai.json", err);
      throw err;
    }
  }

  // ===================== 插件接管与绑定 =====================

  async bindPlugin(pluginId: string, profileId: string) {
    if (!profileId) {
      this.bindingManager.removeBinding(pluginId);
      this.bindingManager.notifyPluginUpdate(pluginId, null);
    } else {
      this.bindingManager.setBinding(pluginId, profileId);
      const config = this.getBoundSharedConfig(pluginId);
      this.bindingManager.notifyPluginUpdate(pluginId, config);

      const profile = this.profileStore.getProfile(profileId);
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
    const bindings = this.bindingManager.getBindings();
    for (const pluginId in bindings) {
      if (bindings[pluginId] === profileId) {
        const config = this.getBoundSharedConfig(pluginId);
        this.bindingManager.notifyPluginUpdate(pluginId, config);

        const profile = this.profileStore.getProfile(profileId);
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

  // 用于 UI 展示的注册列表
  getRegisteredPlugins(): RegisteredPluginInfo[] {
    const list: RegisteredPluginInfo[] = [];
    const bindings = this.bindingManager.getBindings();

    for (const [pluginId, reg] of this.bindingManager.getRegistrations().entries()) {
      const boundId = bindings[pluginId] || "";
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
    const editingBoundId = bindings["siyuan_builtin_editing"] || "";
    list.push({
      pluginId: "siyuan_builtin_editing",
      displayName: "思源笔记 API-编辑器",
      isBound: Boolean(editingBoundId),
      boundProfileId: editingBoundId,
      localConfig: extracted.editing || undefined,
    });

    // 2. 思源笔记 API - 智能体
    const agentBoundId = bindings["siyuan_builtin_agent"] || "";
    list.push({
      pluginId: "siyuan_builtin_agent",
      displayName: "思源笔记 API-智能体",
      isBound: Boolean(agentBoundId),
      boundProfileId: agentBoundId,
      localConfig: extracted.agent || undefined,
    });

    // 3. 思源笔记 API - 决策模型
    const decisionBoundId = bindings["siyuan_builtin_decision"] || "";
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
      const reg = this.bindingManager.getRegistration(pluginId);
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
      ...this.bindingManager.getRegistrations().keys(),
      "siyuan_builtin_editing",
      "siyuan_builtin_agent",
      "siyuan_builtin_decision",
    ];

    for (const pluginId of allPluginIds) {
      this.bindingManager.setBinding(pluginId, profileId);
      const config = this.getBoundSharedConfig(pluginId);
      this.bindingManager.notifyPluginUpdate(pluginId, config);

      const profile = this.profileStore.getProfile(profileId);
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
