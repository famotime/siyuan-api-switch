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
      models: profile.models || (profile.model ? [profile.model] : []),
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
          (p: any) => p.id === providerId || p.displayName === profile.name || (profile.provider && p.protocol === profile.provider)
        );

        if (!targetProvider) {
          if (aiConfig.providers.length > 0) {
            targetProvider = aiConfig.providers[0];
          } else {
            targetProvider = {
              id: providerId,
              displayName: profile.name || "API Switch Custom",
              enabled: true,
              protocol: profile.provider || "openai",
              models: []
            };
            aiConfig.providers.push(targetProvider);
          }
        }

        // 更新 Provider 属性
        targetProvider.enabled = true;
        targetProvider.apiKey = profile.apiKey || "";
        targetProvider.baseUrl = profile.baseUrl || "";
        targetProvider.requestTimeout = profile.requestTimeoutSeconds ?? 30;
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

        // 更新 Agent 与 Editing 的场景使用模型 ID 及相关参数
        if (!aiConfig.agent || typeof aiConfig.agent !== "object") {
          aiConfig.agent = {};
        }
        aiConfig.agent.modelId = targetModel.id || modelId;
        if (profile.temperature !== undefined) aiConfig.agent.temperature = profile.temperature;
        if (profile.maxTokens !== undefined) aiConfig.agent.maxCompletionTokens = profile.maxTokens;

        if (!aiConfig.editing || typeof aiConfig.editing !== "object") {
          aiConfig.editing = {};
        }
        aiConfig.editing.modelId = targetModel.id || modelId;
        if (profile.temperature !== undefined) aiConfig.editing.temperature = profile.temperature;
        if (profile.maxTokens !== undefined) aiConfig.editing.maxCompletionTokens = profile.maxTokens;
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
      const ai = (window as any).siyuan?.config?.ai;
      if (ai) {
        // 优先尝试从新版 multi-provider 中解析
        if (Array.isArray(ai.providers) && ai.providers.length > 0) {
          let activeProvider = ai.providers.find((p: any) => p.enabled && p.apiKey);
          if (!activeProvider) activeProvider = ai.providers[0];

          if (activeProvider && activeProvider.apiKey) {
            const activeModel = ai.agent?.modelId || (activeProvider.models?.[0]?.name || activeProvider.models?.[0]?.id || "");
            siyuanLocalConfig = {
              provider: activeProvider.protocol || "openai",
              baseUrl: activeProvider.baseUrl || "",
              apiKey: activeProvider.apiKey || "",
              model: activeModel,
              requestTimeoutSeconds: activeProvider.requestTimeout ?? 30,
              temperature: ai.agent?.temperature ?? 0.7,
              maxTokens: ai.agent?.maxCompletionTokens ?? 4096,
            };
          }
        }
        
        // 若新版未解析出有效配置，退回从 openAI 字段解析
        if (!siyuanLocalConfig && ai.openAI && ai.openAI.apiKey && ai.openAI.apiKey.trim() !== "") {
          siyuanLocalConfig = {
            provider: "openai",
            baseUrl: ai.openAI.apiBaseURL || "",
            apiKey: ai.openAI.apiKey || "",
            model: ai.openAI.apiModel || "",
            requestTimeoutSeconds: ai.openAI.apiTimeout ?? 30,
            temperature: ai.openAI.apiTemperature ?? 0.7,
            maxTokens: ai.openAI.apiMaxTokens ?? 4096,
          };
        }
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
    let lc: any = undefined;
    let displayName = "";

    if (pluginId === "siyuan_builtin") {
      const regPlugins = this.getRegisteredPlugins();
      const siyuanPlug = regPlugins.find((p) => p.pluginId === "siyuan_builtin");
      if (siyuanPlug && siyuanPlug.localConfig) {
        lc = siyuanPlug.localConfig;
        displayName = siyuanPlug.displayName;
      }
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
      requestTimeoutSeconds: lc.requestTimeoutSeconds ?? 60,
      temperature: lc.temperature ?? 0.7,
      maxTokens: lc.maxTokens ?? 4096,
      memo: `从 ${displayName} 本地一键导入的配置`,
      providerUrl: "",
    });

    await this.bindPlugin(pluginId, newProfile.id);
    this.log(`Imported local config from ${pluginId} to new profile: ${profileName}`);
  }

  // 一键配置应用至所有接管项目
  async applyProfileToAllPlugins(profileId: string) {
    if (!profileId) return;
    
    // 获取全部待绑定插件，包括已注册的第三方子插件和虚拟的“思源内置AI”
    const allPluginIds = [...this.registrations.keys(), "siyuan_builtin"];
    
    for (const pluginId of allPluginIds) {
      this.bindings[pluginId] = profileId;
      const config = this.getBoundSharedConfig(pluginId);
      this.notifyPluginUpdate(pluginId, config);
      
      if (pluginId === "siyuan_builtin") {
        const profile = this.profiles.find(p => p.id === profileId) || null;
        await this.updateSiyuanSystemAi(profile);
      }
    }
    
    await this.save();
  }
}

export const apiSwitchCore = new ApiSwitchCore();
