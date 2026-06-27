import { Plugin } from "siyuan";
import { SharedConfig, SiyuanApiSwitch } from "@/types";

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
      console.error("[API Switch] Failed to load config data", err);
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
      console.error("[API Switch] Failed to save config data", err);
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
    console.log("[API Switch] Mounted global window.siyuanApiSwitch");

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
        requestTimeoutSeconds: Number(prof.requestTimeoutSeconds ?? 30),
        temperature: Number(prof.temperature ?? 0.7),
        maxTokens: Number(prof.maxTokens ?? 4096),
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
  private async updateSiyuanSystemAi(profile: ApiProfile | null) {
    if (!profile) return;
    
    try {
      const { fetchSyncPost } = await import("siyuan");
      const currentOpenAi = (window as any).siyuan?.config?.ai?.openAI || {};
      
      const updatedOpenAi = {
        ...currentOpenAi,
        apiBaseURL: profile.baseUrl,
        apiKey: profile.apiKey,
        apiModel: profile.model,
        apiTimeout: profile.requestTimeoutSeconds ?? 30,
        apiTemperature: profile.temperature ?? 0.7,
        apiMaxTokens: profile.maxTokens ?? 4096,
      };
      
      // 调用思源接口修改设置
      const res = await fetchSyncPost("/api/setting/setAI", {
        openAI: updatedOpenAi
      });
      
      if (res && res.code === 0) {
        // 同步修改内存配置，方便前端立即响应
        if ((window as any).siyuan?.config?.ai) {
          (window as any).siyuan.config.ai.openAI = updatedOpenAi;
        }
        console.log("[API Switch] Successfully synchronized to Siyuan system AI");
      } else {
        console.error("[API Switch] Failed to synchronize to Siyuan system AI", res);
      }
    } catch (err) {
      console.error("[API Switch] Error updating Siyuan system AI", err);
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
      if (pluginId === "siyuan_builtin") {
        const profile = this.profiles.find(p => p.id === profileId) || null;
        await this.updateSiyuanSystemAi(profile);
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
        if (pluginId === "siyuan_builtin") {
          const profile = this.profiles.find(p => p.id === profileId) || null;
          this.updateSiyuanSystemAi(profile);
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

    // 内置一个思源设置的虚拟“子插件”，允许对其进行接管
    const siyuanBoundId = this.bindings["siyuan_builtin"] || "";
    let siyuanLocalConfig: any = undefined;
    try {
      const openAI = (window as any).siyuan?.config?.ai?.openAI;
      if (openAI && openAI.apiKey && openAI.apiKey.trim() !== "") {
        siyuanLocalConfig = {
          provider: "openai",
          baseUrl: openAI.apiBaseURL || "",
          apiKey: openAI.apiKey || "",
          model: openAI.apiModel || "",
          requestTimeoutSeconds: openAI.apiTimeout ?? 30,
          temperature: openAI.apiTemperature ?? 0.7,
          maxTokens: openAI.apiMaxTokens ?? 4096,
        };
      }
    } catch (e) {}

    list.push({
      pluginId: "siyuan_builtin",
      displayName: "思源笔记内置 AI",
      isBound: Boolean(siyuanBoundId),
      boundProfileId: siyuanBoundId,
      localConfig: siyuanLocalConfig
    });

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
    this.log(`Imported local config from ${pluginId} to new profile: ${profileName}`);
  }
}

export const apiSwitchCore = new ApiSwitchCore();
