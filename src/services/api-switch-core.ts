import { Plugin } from "siyuan";
import { SharedConfig, SiyuanApiSwitch, ApiProvider, PluginSlotDefinition, RegisteredPluginSlotInfo, RegisterPluginOptions } from "@/types";
import { ProviderStore } from "./provider-store";
import { ProfileStore, ApiProfile } from "./profile-store";
import { PluginBindingManager, RegisteredPluginInfo } from "./plugin-binding-manager";
import { SiyuanAdapter, extractSiyuanAiSettings, SiyuanExtractedAiInfo } from "./siyuan-adapter";
import { extractApiKey, extractBaseUrl, extractModelName } from "@/utils/siyuan-crypto";

export type { ApiProfile } from "./profile-store";
export type { RegisteredPluginInfo, PluginSlotDefinition, RegisteredPluginSlotInfo } from "./plugin-binding-manager";
export type { RegisterPluginOptions } from "@/types";
export { extractSiyuanAiSettings };
export type { SiyuanExtractedAiInfo } from "./siyuan-adapter";
export { normalizeUrl, normalizeString, isProtocolCompatible, isProfileConfigMatching } from "./profile-store";
export { extractApiKey, extractBaseUrl, extractModelName } from "@/utils/siyuan-crypto";

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

  public getBindings(): Record<string, string> {
    return this.bindingManager.getBindings();
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
      register: (
        pluginIdOrOptions: string | RegisterPluginOptions,
        displayName?: string,
        callback?: (config: SharedConfig | null, slotId?: string) => void,
        localConfig?: Omit<SharedConfig, "profileId" | "profileName">,
        options?: { slots?: PluginSlotDefinition[] }
      ) => {
        if (typeof pluginIdOrOptions === "object" && pluginIdOrOptions !== null) {
          this.registerPlugin(
            pluginIdOrOptions.pluginId,
            pluginIdOrOptions.displayName,
            pluginIdOrOptions.callback,
            pluginIdOrOptions.localConfig,
            pluginIdOrOptions.slots
          );
        } else {
          this.registerPlugin(
            pluginIdOrOptions as string,
            displayName!,
            callback!,
            localConfig,
            options?.slots
          );
        }
      },
      unregister: (pluginId) => {
        this.unregisterPlugin(pluginId);
      },
      getBoundConfig: (pluginId, slotId) => {
        return this.getBoundSharedConfig(pluginId, slotId);
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
  public registerPlugin(
    pluginId: string,
    displayName: string,
    callback: (config: SharedConfig | null, slotId?: string) => void,
    localConfig?: Omit<SharedConfig, "profileId" | "profileName">,
    slots?: PluginSlotDefinition[]
  ) {
    const boundConfig = this.getBoundSharedConfig(pluginId);
    const initialSlotConfigs: Record<string, SharedConfig | null> = {};
    if (slots && slots.length > 0) {
      for (const slot of slots) {
        initialSlotConfigs[slot.id] = this.getBoundSharedConfig(pluginId, slot.id);
      }
    }
    this.bindingManager.registerPlugin(
      pluginId,
      displayName,
      callback,
      localConfig,
      boundConfig,
      slots,
      initialSlotConfigs
    );
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

  // 查找与目标配置一致的最佳已有 Profile，避免生成重复配置
  public findMatchingProfile(
    targetConfig: Partial<ApiProfile> | Partial<SharedConfig> | any
  ) {
    return this.profileStore.findMatchingProfile(targetConfig, this.providerStore.getProviders());
  }

  // 查找匹配的已有提供商，避免生成重复提供商
  public findMatchingProvider(target: Partial<ApiProvider>) {
    return this.providerStore.findMatchingProvider(target);
  }

  // 获取共享配置（供插件调用）
  public getBoundSharedConfig(pluginId: string, slotId?: string): SharedConfig | null {
    const profileId = this.bindingManager.getBoundProfileId(pluginId, slotId);
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

  // 从思源笔记全量同步/读取配置到旋钮（提供商、编辑器、智能体、决策模型，自动校验避免重复配置）
  public async syncFromSiyuan(): Promise<{
    providersCount: number;
    profilesCount: number;
    createdProfilesCount: number;
    reusedProfilesCount: number;
  }> {
    try {
      const aiConfig = await this.siyuanAdapter.fetchSystemAiConfig();
      if (!aiConfig) {
        return { providersCount: 0, profilesCount: 0, createdProfilesCount: 0, reusedProfilesCount: 0 };
      }

      const extracted = extractSiyuanAiSettings(aiConfig);

      // 1. 同步提供商（严格校验避免重复提供商）
      const currentProviders = this.providerStore.getProviders();
      for (const prov of extracted.providers) {
        const existIdx = currentProviders.findIndex((p) => this.providerStore.isProviderMatching(p, prov));
        if (existIdx !== -1) {
          const existing = currentProviders[existIdx];
          const mergedModels = [...(existing.models || [])];
          if (Array.isArray(prov.models)) {
            for (const m of prov.models) {
              const mIdx = mergedModels.findIndex((em) => em.id === m.id || (em.name && em.name === m.name));
              if (mIdx !== -1) {
                mergedModels[mIdx] = { ...mergedModels[mIdx], ...m };
              } else {
                mergedModels.push(m);
              }
            }
          }
          currentProviders[existIdx] = {
            ...existing,
            ...prov,
            id: existing.id,
            displayName: existing.displayName || prov.displayName,
            models: mergedModels,
          };
        } else {
          currentProviders.push(prov);
        }
      }
      this.providerStore.setProviders(currentProviders);

      let createdProfilesCount = 0;
      let reusedProfilesCount = 0;
      const profiles = this.profileStore.getProfiles();
      const bindings = this.bindingManager.getBindings();

      // 2. 导入/更新思源-编辑器 Profile
      if (extracted.editing && extracted.editing.model) {
        const boundId = bindings["siyuan_builtin_editing"];
        let exist = profiles.find((p) => (boundId && p.id === boundId) || p.name === "思源-编辑器");
        if (!exist) {
          const match = this.findMatchingProfile(extracted.editing);
          if (match) {
            exist = match.profile;
          }
        }

        if (exist) {
          exist.providerId = extracted.editing.providerId;
          exist.provider = extracted.editing.provider || exist.provider || "openai";
          exist.protocol = extracted.editing.protocol || exist.protocol || "openai";
          exist.baseUrl = extracted.editing.baseUrl;
          exist.apiKey = extracted.editing.apiKey;
          exist.model = extracted.editing.model;
          if (!exist.models?.includes(extracted.editing.model)) {
            exist.models = [...(exist.models || []), extracted.editing.model];
          }
          if (extracted.editing.temperature !== undefined) exist.temperature = extracted.editing.temperature;
          if (extracted.editing.maxTokens !== undefined) exist.maxTokens = extracted.editing.maxTokens;
          if (extracted.editing.maxHistoryMessages !== undefined) exist.maxHistoryMessages = extracted.editing.maxHistoryMessages;
          this.bindingManager.setBinding("siyuan_builtin_editing", exist.id);
          reusedProfilesCount++;
        } else {
          exist = await this.addProfile({
            name: "思源-编辑器",
            providerId: extracted.editing.providerId,
            provider: extracted.editing.provider || "openai",
            protocol: extracted.editing.protocol || "openai",
            baseUrl: extracted.editing.baseUrl,
            apiKey: extracted.editing.apiKey,
            model: extracted.editing.model,
            models: [extracted.editing.model],
            temperature: extracted.editing.temperature,
            maxTokens: extracted.editing.maxTokens,
            maxHistoryMessages: extracted.editing.maxHistoryMessages,
            memo: "从思源笔记「设置-人工智能-编辑器」同步的配置",
          });
          this.bindingManager.setBinding("siyuan_builtin_editing", exist.id);
          createdProfilesCount++;
        }
      }

      // 3. 导入/更新思源-智能体 Profile（独立于编辑器，绝不吞并或复用编辑器 Profile）
      if (extracted.agent && extracted.agent.model) {
        const editingId = bindings["siyuan_builtin_editing"];
        const boundId = bindings["siyuan_builtin_agent"];
        let exist = profiles.find(
          (p) => (boundId && p.id === boundId && p.id !== editingId) || p.name === "思源-智能体"
        );
        if (exist) {
          exist.providerId = extracted.agent.providerId;
          exist.provider = extracted.agent.provider || exist.provider || "openai";
          exist.protocol = extracted.agent.protocol || exist.protocol || "openai";
          exist.baseUrl = extracted.agent.baseUrl;
          exist.apiKey = extracted.agent.apiKey;
          exist.model = extracted.agent.model;
          if (!exist.models?.includes(extracted.agent.model)) {
            exist.models = [...(exist.models || []), extracted.agent.model];
          }
          if (extracted.agent.temperature !== undefined) exist.temperature = extracted.agent.temperature;
          if (extracted.agent.maxTokens !== undefined) exist.maxTokens = extracted.agent.maxTokens;
          if (extracted.agent.maxToolCallRounds !== undefined) exist.maxToolCallRounds = extracted.agent.maxToolCallRounds;
          if (extracted.agent.sessionTimeout !== undefined) exist.sessionTimeout = extracted.agent.sessionTimeout;
          if (extracted.agent.streamIdleTimeout !== undefined) exist.streamIdleTimeout = extracted.agent.streamIdleTimeout;
          if (extracted.agent.confirmTimeout !== undefined) exist.confirmTimeout = extracted.agent.confirmTimeout;
          if (extracted.agent.maxRetries !== undefined) exist.maxRetries = extracted.agent.maxRetries;
          this.bindingManager.setBinding("siyuan_builtin_agent", exist.id);
          reusedProfilesCount++;
        } else {
          exist = await this.addProfile({
            name: "思源-智能体",
            providerId: extracted.agent.providerId,
            provider: extracted.agent.provider || "openai",
            protocol: extracted.agent.protocol || "openai",
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
          this.bindingManager.setBinding("siyuan_builtin_agent", exist.id);
          createdProfilesCount++;
        }
      }

      // 4. 导入/更新思源-决策模型 Profile (Jev 模型)
      if (extracted.decision) {
        const boundId = bindings["siyuan_builtin_decision"];
        let exist = profiles.find((p) => (boundId && p.id === boundId) || p.name === "思源-决策模型" || (p.isDecisionModel && p.name.includes("决策")));
        if (exist) {
          exist.provider = "custom";
          exist.protocol = "custom";
          exist.baseUrl = extracted.decision.baseUrl || "https://api.typesafe.ai/v1/systemone";
          exist.apiKey = extracted.decision.apiKey;
          exist.model = extracted.decision.model || "jev-latest";
          if (!exist.models?.includes(exist.model)) {
            exist.models = [...(exist.models || []), exist.model];
          }
          if (extracted.decision.requestTimeoutSeconds !== undefined) {
            exist.requestTimeoutSeconds = extracted.decision.requestTimeoutSeconds;
          }
          exist.isDecisionModel = true;
          this.bindingManager.setBinding("siyuan_builtin_decision", exist.id);
          reusedProfilesCount++;
        } else {
          exist = await this.addProfile({
            name: "思源-决策模型",
            provider: "custom",
            protocol: "custom",
            baseUrl: extracted.decision.baseUrl || "https://api.typesafe.ai/v1/systemone",
            apiKey: extracted.decision.apiKey,
            model: extracted.decision.model || "jev-latest",
            models: [extracted.decision.model || "jev-latest"],
            requestTimeoutSeconds: extracted.decision.requestTimeoutSeconds ?? 30,
            isDecisionModel: true,
            memo: "从思源笔记「设置-人工智能-决策模型」同步的配置",
          });
          this.bindingManager.setBinding("siyuan_builtin_decision", exist.id);
          createdProfilesCount++;
        }
      }

      this.profileStore.setProfiles(profiles);
      await this.save();
      return {
        providersCount: this.providerStore.getProviders().length,
        profilesCount: this.profileStore.getProfiles().length,
        createdProfilesCount,
        reusedProfilesCount,
      };
    } catch (err) {
      this.logError("Failed to sync from Siyuan", err);
      throw err;
    }
  }

  /**
   * 将当前生效接管的配置写回思源笔记原生系统
   * 仅写回生效接管的配置项；编辑器、智能体、决策模型支持单独写回或批量写回
   * @param scope 'all'（仅写回已生效接管的项）| 'editing' | 'agent' | 'decision'
   */
  public async applyToSiyuan(
    scope: "all" | "editing" | "agent" | "decision" = "all"
  ): Promise<{
    success: boolean;
    appliedScopes: ("editing" | "agent" | "decision")[];
    skippedScopes: ("editing" | "agent" | "decision")[];
    message: string;
  }> {
    const bindings = this.bindingManager.getBindings();

    const scopeMap: Record<"editing" | "agent" | "decision", { pluginId: string; name: string }> = {
      editing: { pluginId: "siyuan_builtin_editing", name: "编辑器" },
      agent: { pluginId: "siyuan_builtin_agent", name: "智能体" },
      decision: { pluginId: "siyuan_builtin_decision", name: "决策模型" },
    };

    if (scope !== "all") {
      const info = scopeMap[scope];
      const boundId = bindings[info.pluginId];
      if (!boundId) {
        throw new Error(`当前尚未接管思源「${info.name}」配置，无法单独写回。请先为其绑定配置。`);
      }
      const prof = this.profileStore.getProfile(boundId);
      if (!prof) {
        throw new Error(`未找到「${info.name}」绑定的配置 (ID: ${boundId})`);
      }
      const effective = this.resolveEffectiveProfile(prof);
      await this.siyuanAdapter.updateSiyuanSystemAi(effective, scope);
      return {
        success: true,
        appliedScopes: [scope],
        skippedScopes: (["editing", "agent", "decision"] as const).filter((s) => s !== scope),
        message: `已成功将「${info.name}」配置单独写回思源笔记原生系统！未接管项保持思源原有配置不变。`,
      };
    }

    // scope === "all": 仅写回生效接管的项！
    const tasks: { scope: "editing" | "agent" | "decision"; effective: ApiProfile }[] = [];
    const appliedScopes: ("editing" | "agent" | "decision")[] = [];
    const skippedScopes: ("editing" | "agent" | "decision")[] = [];

    for (const s of ["editing", "agent", "decision"] as const) {
      const boundId = bindings[scopeMap[s].pluginId];
      if (boundId) {
        const prof = this.profileStore.getProfile(boundId);
        if (prof) {
          tasks.push({ scope: s, effective: this.resolveEffectiveProfile(prof) });
          appliedScopes.push(s);
          continue;
        }
      }
      skippedScopes.push(s);
    }

    if (tasks.length === 0) {
      return {
        success: false,
        appliedScopes: [],
        skippedScopes,
        message: "当前未接管任何思源原生配置项（编辑器/智能体/决策模型），未执行写回。请先在「子插件接管」中绑定配置。",
      };
    }

    const ok = await this.siyuanAdapter.updateSiyuanSystemAiBatch(tasks);
    if (!ok) {
      throw new Error("写回思源笔记配置失败，请检查思源内核状态");
    }

    const appliedNames = appliedScopes.map((s) => scopeMap[s].name).join("、");
    const skippedNames = skippedScopes.map((s) => scopeMap[s].name).join("、");
    const tip = skippedScopes.length > 0 ? `（未接管项「${skippedNames}」保持原有设置不变）` : "";

    return {
      success: true,
      appliedScopes,
      skippedScopes,
      message: `已成功将生效接管的【${appliedNames}】写回思源笔记原生系统！${tip}`,
    };
  }

  // 兼容原有方法：写回生效接管的项
  public async applyAllToSiyuan(): Promise<void> {
    const res = await this.applyToSiyuan("all");
    if (!res.success && res.appliedScopes.length === 0) {
      throw new Error(res.message);
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

      // 兼容直接导入包含 { ai: ... } 的思源全局配置对象（如 conf.json）
      const realAi = parsed.ai && typeof parsed.ai === "object" ? parsed.ai : parsed;

      // 2. 如果包含 providers
      const currentProviders = this.providerStore.getProviders();
      let importedProviders = 0;
      if (Array.isArray(realAi.providers)) {
        for (const rawP of realAi.providers) {
          const prov: ApiProvider = {
            id: rawP.id || "provider_" + Math.random().toString(36).substring(2, 11),
            displayName: rawP.displayName || rawP.id || "未命名提供商",
            enabled: rawP.enabled ?? true,
            baseUrl: extractBaseUrl(rawP),
            apiKey: extractApiKey(rawP),
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
          const existIdx = currentProviders.findIndex((p) => this.providerStore.isProviderMatching(p, prov));
          if (existIdx !== -1) {
            const existing = currentProviders[existIdx];
            const mergedModels = [...(existing.models || [])];
            if (Array.isArray(prov.models)) {
              for (const m of prov.models) {
                const mIdx = mergedModels.findIndex((em) => em.id === m.id || (em.name && em.name === m.name));
                if (mIdx !== -1) {
                  mergedModels[mIdx] = { ...mergedModels[mIdx], ...m };
                } else {
                  mergedModels.push(m);
                }
              }
            }
            currentProviders[existIdx] = {
              ...existing,
              ...prov,
              id: existing.id,
              displayName: existing.displayName || prov.displayName,
              models: mergedModels,
            };
          } else {
            currentProviders.push(prov);
          }
          importedProviders++;
        }
        this.providerStore.setProviders(currentProviders);
      }

      // 3. 如果包含 _siyuanApiSwitch 扩展
      if (realAi._siyuanApiSwitch?.profiles && Array.isArray(realAi._siyuanApiSwitch.profiles)) {
        await this.importProfiles(realAi._siyuanApiSwitch.profiles);
        if (realAi._siyuanApiSwitch.bindings && typeof realAi._siyuanApiSwitch.bindings === "object") {
          this.bindingManager.setBindings({ ...this.bindingManager.getBindings(), ...realAi._siyuanApiSwitch.bindings });
        }
      } else {
        // 如果是原生思源 ai.json（无 _siyuanApiSwitch），由 editing/agent/decision 派生 Profiles
        if (realAi.editing && typeof realAi.editing === "object" && realAi.editing.modelId) {
          const matchedProv = this.providerStore.getProviders().find((p) => p.models?.some((m) => m.id === realAi.editing.modelId || m.name === realAi.editing.modelId));
          const targetConf = {
            providerId: matchedProv?.id,
            provider: matchedProv?.protocol || "openai",
            protocol: matchedProv?.protocol || "openai",
            baseUrl: matchedProv?.baseUrl || "",
            apiKey: matchedProv?.apiKey || "",
            model: realAi.editing.modelId,
            temperature: realAi.editing.temperature,
            maxTokens: realAi.editing.maxCompletionTokens ?? realAi.editing.maxTokens,
            maxHistoryMessages: realAi.editing.maxHistoryMessages,
          };
          let exist = this.profileStore.getProfiles().find((p) => p.name === "导入-思源编辑器");
          if (exist) {
            Object.assign(exist, targetConf);
          } else {
            exist = await this.addProfile({
              name: "导入-思源编辑器",
              ...targetConf,
              models: [realAi.editing.modelId],
              memo: "从原生 ai.json 导入的编辑器配置",
            });
          }
          this.bindingManager.setBinding("siyuan_builtin_editing", exist.id);
        }

        if (realAi.agent && typeof realAi.agent === "object" && realAi.agent.modelId) {
          const matchedProv = this.providerStore.getProviders().find((p) => p.models?.some((m) => m.id === realAi.agent.modelId || m.name === realAi.agent.modelId));
          const targetConf = {
            providerId: matchedProv?.id,
            provider: matchedProv?.protocol || "openai",
            protocol: matchedProv?.protocol || "openai",
            baseUrl: matchedProv?.baseUrl || "",
            apiKey: matchedProv?.apiKey || "",
            model: realAi.agent.modelId,
            temperature: realAi.agent.temperature,
            maxTokens: realAi.agent.maxCompletionTokens ?? realAi.agent.maxTokens,
            maxToolCallRounds: realAi.agent.maxToolCallRounds,
            sessionTimeout: realAi.agent.sessionTimeout,
            streamIdleTimeout: realAi.agent.streamIdleTimeout,
            confirmTimeout: realAi.agent.confirmTimeout,
            maxRetries: realAi.agent.maxRetries,
          };
          let exist = this.profileStore.getProfiles().find((p) => p.name === "导入-思源智能体");
          if (exist) {
            Object.assign(exist, targetConf);
          } else {
            exist = await this.addProfile({
              name: "导入-思源智能体",
              ...targetConf,
              models: [realAi.agent.modelId],
              memo: "从原生 ai.json 导入的智能体配置",
            });
          }
          this.bindingManager.setBinding("siyuan_builtin_agent", exist.id);
        }

        if (realAi.decision && typeof realAi.decision === "object") {
          const decKey = extractApiKey(realAi.decision);
          const decUrl = extractBaseUrl(realAi.decision, true);
          const decModel = extractModelName(realAi.decision, true);
          const targetConf = {
            provider: "custom",
            protocol: "custom",
            baseUrl: decUrl,
            apiKey: decKey,
            model: decModel,
            models: [decModel],
            requestTimeoutSeconds: realAi.decision.timeout ?? realAi.decision.requestTimeoutSeconds ?? 30,
            isDecisionModel: true,
            memo: "从原生 ai.json 导入的决策模型配置",
          };
          let exist = this.profileStore.getProfiles().find((p) => p.name === "导入-思源决策模型" || p.isDecisionModel);
          if (exist) {
            Object.assign(exist, targetConf);
          } else {
            exist = await this.addProfile({
              name: "导入-思源决策模型",
              ...targetConf,
            });
          }
          this.bindingManager.setBinding("siyuan_builtin_decision", exist.id);
        }
      }

      await this.save();
      return { providersCount: this.providerStore.getProviders().length, profilesCount: this.profileStore.getProfiles().length };
    } catch (err) {
      this.logError("Failed to import Siyuan ai.json", err);
      throw err;
    }
  }

  async bindPlugin(pluginId: string, profileId: string, slotId?: string) {
    if (!profileId) {
      this.bindingManager.removeBinding(pluginId, slotId);
      this.bindingManager.notifyPluginUpdate(pluginId, null, slotId);
    } else {
      this.bindingManager.setBinding(pluginId, profileId, slotId);
      const config = this.getBoundSharedConfig(pluginId, slotId);
      this.bindingManager.notifyPluginUpdate(pluginId, config, slotId);

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
    for (const key in bindings) {
      if (bindings[key] === profileId) {
        if (key.includes(":")) {
          const [pluginId, slotId] = key.split(":");
          const config = this.getBoundSharedConfig(pluginId, slotId);
          this.bindingManager.notifyPluginUpdate(pluginId, config, slotId);
        } else {
          const config = this.getBoundSharedConfig(key);
          this.bindingManager.notifyPluginUpdate(key, config);

          const profile = this.profileStore.getProfile(profileId);
          if (key === "siyuan_builtin_editing") {
            this.updateSiyuanSystemAi(profile, "editing");
          } else if (key === "siyuan_builtin_agent") {
            this.updateSiyuanSystemAi(profile, "agent");
          } else if (key === "siyuan_builtin_decision") {
            this.updateSiyuanSystemAi(profile, "decision");
          } else if (key === "siyuan_builtin") {
            this.updateSiyuanSystemAi(profile, "all");
          }
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
      let matchedProfileId: string | undefined = undefined;
      let matchedProfileName: string | undefined = undefined;
      if (!boundId && reg.localConfig) {
        const match = this.findMatchingProfile(reg.localConfig);
        if (match) {
          matchedProfileId = match.profile.id;
          matchedProfileName = match.profile.name;
        }
      }

      let slotInfos: RegisteredPluginSlotInfo[] | undefined = undefined;
      if (reg.slots && reg.slots.length > 0) {
        slotInfos = reg.slots.map((s) => {
          const slotBoundId = bindings[`${pluginId}:${s.id}`] || "";
          let slotMatchedId: string | undefined = undefined;
          let slotMatchedName: string | undefined = undefined;
          if (!slotBoundId && s.localConfig) {
            const match = this.findMatchingProfile(s.localConfig);
            if (match) {
              slotMatchedId = match.profile.id;
              slotMatchedName = match.profile.name;
            }
          }
          return {
            slotId: s.id,
            name: s.name,
            description: s.description,
            isBound: Boolean(slotBoundId),
            boundProfileId: slotBoundId,
            localConfig: s.localConfig,
            matchedProfileId: slotMatchedId,
            matchedProfileName: slotMatchedName,
          };
        });
      }

      const isAnySlotBound = slotInfos && slotInfos.length > 0
        ? slotInfos.some((s) => s.isBound)
        : Boolean(boundId);

      list.push({
        pluginId,
        displayName: reg.displayName,
        isBound: isAnySlotBound,
        boundProfileId: boundId,
        localConfig: reg.localConfig,
        matchedProfileId,
        matchedProfileName,
        slots: slotInfos,
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
    let editingMatchedId: string | undefined = undefined;
    let editingMatchedName: string | undefined = undefined;
    if (!editingBoundId && extracted.editing) {
      const match = this.findMatchingProfile(extracted.editing);
      if (match) {
        editingMatchedId = match.profile.id;
        editingMatchedName = match.profile.name;
      }
    }
    list.push({
      pluginId: "siyuan_builtin_editing",
      displayName: "思源笔记 API-编辑器",
      isBound: Boolean(editingBoundId),
      boundProfileId: editingBoundId,
      localConfig: extracted.editing || undefined,
      matchedProfileId: editingMatchedId,
      matchedProfileName: editingMatchedName,
    });

    // 2. 思源笔记 API - 智能体
    const agentBoundId = bindings["siyuan_builtin_agent"] || "";
    let agentMatchedId: string | undefined = undefined;
    let agentMatchedName: string | undefined = undefined;
    if (!agentBoundId && extracted.agent) {
      const match = this.findMatchingProfile(extracted.agent);
      if (match) {
        agentMatchedId = match.profile.id;
        agentMatchedName = match.profile.name;
      }
    }
    list.push({
      pluginId: "siyuan_builtin_agent",
      displayName: "思源笔记 API-智能体",
      isBound: Boolean(agentBoundId),
      boundProfileId: agentBoundId,
      localConfig: extracted.agent || undefined,
      matchedProfileId: agentMatchedId,
      matchedProfileName: agentMatchedName,
    });

    // 3. 思源笔记 API - 决策模型
    const decisionBoundId = bindings["siyuan_builtin_decision"] || "";
    let decisionMatchedId: string | undefined = undefined;
    let decisionMatchedName: string | undefined = undefined;
    if (!decisionBoundId && extracted.decision) {
      const match = this.findMatchingProfile(extracted.decision);
      if (match) {
        decisionMatchedId = match.profile.id;
        decisionMatchedName = match.profile.name;
      }
    }
    list.push({
      pluginId: "siyuan_builtin_decision",
      displayName: "思源笔记 API-决策模型",
      isBound: Boolean(decisionBoundId),
      boundProfileId: decisionBoundId,
      localConfig: extracted.decision || undefined,
      matchedProfileId: decisionMatchedId,
      matchedProfileName: decisionMatchedName,
    });

    return list;
  }

  // 从本地配置一键导入为 Profile 并自动绑定（先校验是否已有匹配配置，避免生成重复配置）
  async importLocalConfigToProfile(pluginId: string, slotId?: string): Promise<{
    action: "reused" | "created";
    profile: ApiProfile;
    pluginId: string;
    displayName: string;
  } | null> {
    let lc: any = undefined;
    let displayName = "";

    const regPlugins = this.getRegisteredPlugins();
    const targetPlug = regPlugins.find((p) => p.pluginId === pluginId);
    if (targetPlug) {
      if (slotId && targetPlug.slots) {
        const targetSlot = targetPlug.slots.find((s) => s.slotId === slotId);
        if (targetSlot && targetSlot.localConfig) {
          lc = targetSlot.localConfig;
          displayName = `${targetPlug.displayName} - ${targetSlot.name}`;
        }
      } else if (targetPlug.localConfig) {
        lc = targetPlug.localConfig;
        displayName = targetPlug.displayName;
      }
    }
    if (!lc) {
      const reg = this.bindingManager.getRegistration(pluginId);
      if (reg) {
        if (slotId && reg.slots) {
          const targetSlot = reg.slots.find((s) => s.id === slotId);
          if (targetSlot && targetSlot.localConfig) {
            lc = targetSlot.localConfig;
            displayName = `${reg.displayName} - ${targetSlot.name}`;
          }
        } else if (reg.localConfig) {
          lc = reg.localConfig;
          displayName = reg.displayName;
        }
      }
    }

    if (!lc) return null;

    // 1. 校验是否已有与待导入配置一致的 Profile，避免生成重复配置
    const match = this.findMatchingProfile(lc);
    if (match) {
      const matchedProfile = match.profile;
      await this.bindPlugin(pluginId, matchedProfile.id, slotId);
      this.log(`Matched existing profile '${matchedProfile.name}' for ${pluginId}${slotId ? `:${slotId}` : ""}, reused without duplication.`);
      return {
        action: "reused",
        profile: matchedProfile,
        pluginId,
        displayName,
      };
    }

    // 2. 无匹配 Profile 时新建：先检查是否可复用已有 Provider
    let matchedProviderId = lc.providerId;
    if (!matchedProviderId && (lc.baseUrl || lc.apiKey)) {
      const matchedProv = this.findMatchingProvider({
        baseUrl: lc.baseUrl,
        apiKey: lc.apiKey,
        protocol: lc.protocol || lc.provider,
      });
      if (matchedProv) {
        matchedProviderId = matchedProv.id;
      }
    }

    const baseName = `导入 - ${displayName}`;
    let profileName = baseName;
    const existingProfiles = this.profileStore.getProfiles();
    if (existingProfiles.some((p) => p.name === profileName)) {
      let counter = 2;
      while (existingProfiles.some((p) => p.name === `${baseName} (${counter})`)) {
        counter++;
      }
      profileName = `${baseName} (${counter})`;
    }

    const newProfile = await this.addProfile({
      name: profileName,
      providerId: matchedProviderId,
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

    await this.bindPlugin(pluginId, newProfile.id, slotId);
    this.log(`Imported local config from ${pluginId}${slotId ? `:${slotId}` : ""} to new profile: ${profileName}`);
    return {
      action: "created",
      profile: newProfile,
      pluginId,
      displayName,
    };
  }

  // 一键配置应用至所有接管项目
  async applyProfileToAllPlugins(profileId: string) {
    if (!profileId) return;

    for (const [pluginId, reg] of this.bindingManager.getRegistrations().entries()) {
      if (reg.slots && reg.slots.length > 0) {
        for (const s of reg.slots) {
          this.bindingManager.setBinding(pluginId, profileId, s.id);
          const config = this.getBoundSharedConfig(pluginId, s.id);
          this.bindingManager.notifyPluginUpdate(pluginId, config, s.id);
        }
      } else {
        this.bindingManager.setBinding(pluginId, profileId);
        const config = this.getBoundSharedConfig(pluginId);
        this.bindingManager.notifyPluginUpdate(pluginId, config);
      }
    }

    const builtinIds = [
      "siyuan_builtin_editing",
      "siyuan_builtin_agent",
      "siyuan_builtin_decision",
    ];

    for (const pluginId of builtinIds) {
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
      }
    }

    await this.save();
  }
}

export const apiSwitchCore = new ApiSwitchCore();
