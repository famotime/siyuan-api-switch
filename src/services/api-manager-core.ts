import { Plugin } from "siyuan";
import { SharedConfig, SiyuanApiManager } from "@/types";

export interface ApiProfile {
  id: string;
  name: string;
  provider: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  requestTimeoutSeconds: number;
  temperature: number;
  maxTokens: number;
  memo?: string;
  providerUrl?: string;
}

export interface ApiManagerStorage {
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

class ApiManagerCore {
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

  async initialize(plugin: Plugin) {
    this.plugin = plugin;
    await this.loadData();
    this.mountGlobal();
  }

  private async loadData() {
    if (!this.plugin) return;
    try {
      const data = await this.plugin.loadData(STORAGE_KEY);
      if (data) {
        this.profiles = Array.isArray(data.profiles) ? data.profiles : [];
        this.bindings = data.bindings && typeof data.bindings === "object" ? data.bindings : {};
      } else {
        this.profiles = [];
        this.bindings = {};
      }
    } catch (err) {
      console.error("[API Manager] Failed to load config data", err);
      this.profiles = [];
      this.bindings = {};
    }
  }

  async save() {
    if (!this.plugin) return;
    try {
      const data: ApiManagerStorage = {
        profiles: this.profiles,
        bindings: this.bindings,
      };
      await this.plugin.saveData(STORAGE_KEY, data);
      if (this.onStateChange) {
        this.onStateChange();
      }
    } catch (err) {
      console.error("[API Manager] Failed to save config data", err);
    }
  }

  private mountGlobal() {
    const manager: SiyuanApiManager = {
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

    window.siyuanApiManager = manager;
    console.log("[API Manager] Mounted global window.siyuanApiManager");

    // 触发就绪事件给先加载的子插件
    const event = new CustomEvent("siyuan-api-manager:ready", {
      detail: manager,
    });
    window.dispatchEvent(event);
  }

  destroy() {
    // 卸载全局对象并通知所有注册的插件解除接管
    if (window.siyuanApiManager) {
      delete window.siyuanApiManager;
    }
    
    for (const [pluginId, reg] of this.registrations.entries()) {
      try {
        reg.callback(null);
      } catch (err) {
        console.error(`[API Manager] Error in callback during destroy for ${pluginId}`, err);
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
    console.log(`[API Manager] Plugin registered: ${displayName} (${pluginId})`, localConfig ? "with local config" : "without local config");

    // 注册时立即将当前绑定的配置通知过去
    const boundConfig = this.getBoundSharedConfig(pluginId);
    try {
      callback(boundConfig);
    } catch (err) {
      console.error(`[API Manager] Error during initial register callback for ${pluginId}`, err);
    }

    if (this.onStateChange) {
      this.onStateChange();
    }
  }

  private unregisterPlugin(pluginId: string) {
    this.registrations.delete(pluginId);
    console.log(`[API Manager] Plugin unregistered: ${pluginId}`);
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

    return {
      profileId: profile.id,
      profileName: profile.name,
      provider: profile.provider,
      baseUrl: profile.baseUrl,
      apiKey: profile.apiKey,
      model: profile.model,
      requestTimeoutSeconds: profile.requestTimeoutSeconds,
      temperature: profile.temperature,
      maxTokens: profile.maxTokens,
      memo: profile.memo,
      providerUrl: profile.providerUrl,
    };
  }

  // 管理 API Profiles
  getProfiles(): ApiProfile[] {
    return this.profiles;
  }

  async addProfile(profile: Omit<ApiProfile, "id">): Promise<ApiProfile> {
    const newProfile: ApiProfile = {
      ...profile,
      id: "prof_" + Math.random().toString(36).substring(2, 11),
    };
    this.profiles.push(newProfile);
    await this.save();
    return newProfile;
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
    
    // 对绑定了这个 Profile 的插件解除接管
    for (const pluginId in this.bindings) {
      if (this.bindings[pluginId] === profileId) {
        delete this.bindings[pluginId];
        this.notifyPluginUpdate(pluginId, null);
      }
    }
    await this.save();
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
    }
    await this.save();
  }

  private syncBindingsByProfile(profileId: string) {
    for (const pluginId in this.bindings) {
      if (this.bindings[pluginId] === profileId) {
        const config = this.getBoundSharedConfig(pluginId);
        this.notifyPluginUpdate(pluginId, config);
      }
    }
  }

  private notifyPluginUpdate(pluginId: string, config: SharedConfig | null) {
    const reg = this.registrations.get(pluginId);
    if (reg) {
      try {
        reg.callback(config);
        console.log(`[API Manager] Notified plugin ${pluginId} with config update`);
      } catch (err) {
        console.error(`[API Manager] Failed to notify plugin ${pluginId}`, err);
      }
    }
  }

  // 用于 UI 展示的注册列表
  getRegisteredPlugins(): RegisteredPluginInfo[] {
    const list: RegisteredPluginInfo[] = [];
    
    // 从已注册的 Map 里拿插件，同时查一下 bindings
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
    return list;
  }

  // 从本地配置一键导入为 Profile 并自动绑定
  async importLocalConfigToProfile(pluginId: string) {
    const reg = this.registrations.get(pluginId);
    if (!reg || !reg.localConfig) return;

    const lc = reg.localConfig;
    const profileName = `导入 - ${reg.displayName}`;
    
    const newProfile = await this.addProfile({
      name: profileName,
      provider: lc.provider || "custom",
      baseUrl: lc.baseUrl || "",
      apiKey: lc.apiKey || "",
      model: lc.model || "",
      requestTimeoutSeconds: lc.requestTimeoutSeconds ?? 60,
      temperature: lc.temperature ?? 0.7,
      maxTokens: lc.maxTokens ?? 4096,
      memo: `从 ${reg.displayName} 插件本地一键导入的配置`,
      providerUrl: "",
    });

    await this.bindPlugin(pluginId, newProfile.id);
    console.log(`[API Manager] Imported local config from ${pluginId} to new profile: ${profileName}`);
  }
}

export const apiManagerCore = new ApiManagerCore();
