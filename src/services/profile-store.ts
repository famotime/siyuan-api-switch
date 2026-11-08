import { SharedConfig, ApiProvider, ApiProfile } from "@/types";
import { isProfileConfigMatching } from "@/utils/config-compare";
import { genProfileId } from "@/utils/id";

export type { ApiProfile };

export class ProfileStore {
  private profiles: ApiProfile[] = [];
  private onSave: () => Promise<void>;

  constructor(onSave: () => Promise<void>) {
    this.onSave = onSave;
  }

  setProfiles(profiles: ApiProfile[]) {
    this.profiles = Array.isArray(profiles) ? profiles : [];
    // 向后兼容处理：若 models 为空，则用 [model] 初始化
    this.profiles.forEach((p) => {
      if (!p.models || !Array.isArray(p.models)) {
        p.models = p.model ? [p.model] : [];
      }
    });
  }

  getProfiles(): ApiProfile[] {
    return this.profiles;
  }

  getProfile(id: string): ApiProfile | null {
    return this.profiles.find((p) => p.id === id) || null;
  }

  async addProfile(profile: Omit<ApiProfile, "id">): Promise<ApiProfile> {
    const newProfile: ApiProfile = {
      ...profile,
      id: genProfileId(),
      models: profile.models || (profile.model ? [profile.model] : []),
    };
    this.profiles.push(newProfile);
    await this.onSave();
    return newProfile;
  }

  async updateProfile(profile: ApiProfile): Promise<void> {
    const idx = this.profiles.findIndex((p) => p.id === profile.id);
    if (idx !== -1) {
      this.profiles[idx] = { ...profile };
      await this.onSave();
    }
  }

  async deleteProfile(profileId: string): Promise<void> {
    this.profiles = this.profiles.filter((p) => p.id !== profileId);
    await this.onSave();
  }

  async importProfiles(imported: ApiProfile[]): Promise<{ added: number; updated: number }> {
    let added = 0;
    let updated = 0;
    for (const prof of imported) {
      if (!prof || typeof prof !== "object") continue;
      if (!prof.name || !prof.model) continue;

      const normalizedProf: ApiProfile = {
        id: prof.id || genProfileId(),
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
        contextWindow: prof.contextWindow !== undefined ? Number(prof.contextWindow) : undefined,
        maxHistoryMessages: prof.maxHistoryMessages !== undefined ? Number(prof.maxHistoryMessages) : undefined,
        maxToolCallRounds: prof.maxToolCallRounds !== undefined ? Number(prof.maxToolCallRounds) : undefined,
        sessionTimeout: prof.sessionTimeout !== undefined ? Number(prof.sessionTimeout) : undefined,
        streamIdleTimeout: prof.streamIdleTimeout !== undefined ? Number(prof.streamIdleTimeout) : undefined,
        confirmTimeout: prof.confirmTimeout !== undefined ? Number(prof.confirmTimeout) : undefined,
        maxRetries: prof.maxRetries !== undefined ? Number(prof.maxRetries) : undefined,
        isDecisionModel: Boolean(prof.isDecisionModel),
        memo: prof.memo ? String(prof.memo) : "",
        providerUrl: prof.providerUrl ? String(prof.providerUrl) : "",
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
      await this.onSave();
    }
    return { added, updated };
  }

  // 解析 Profile 的有效参数（联动继承 Provider）
  public resolveEffectiveProfile(profile: ApiProfile, providers: ApiProvider[]): ApiProfile {
    if (!profile.providerId) return profile;

    const provider = providers.find((p) => p.id === profile.providerId);
    if (!provider) return profile;

    const providerModels = provider.models && provider.models.length > 0
      ? provider.models.map((m) => m.name || m.id)
      : [];
    // 上下文容量继承：Profile 显式值优先，缺省回退关联提供商当前模型的 contextLength
    const providerModelEntry = (provider.models || []).find(
      (m) => (m.name || m.id) === profile.model
    );

    return {
      ...profile,
      provider: provider.protocol || profile.provider || "custom",
      protocol: provider.protocol || profile.protocol || "openai",
      baseUrl: profile.baseUrl || provider.baseUrl || "",
      apiKey: profile.apiKey || provider.apiKey || "",
      headers: { ...(provider.headers || {}), ...(profile.headers || {}) },
      requestTimeoutSeconds: profile.requestTimeoutSeconds ?? provider.requestTimeout ?? 30,
      models: providerModels.length > 0 ? providerModels : (profile.models || (profile.model ? [profile.model] : [])),
      contextWindow: profile.contextWindow ?? providerModelEntry?.contextLength,
      providerUrl: profile.providerUrl || provider.providerUrl || "",
    };
  }

  // 获取对外共享的配置对象
  public toSharedConfig(effective: ApiProfile): SharedConfig {
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
    if (effective.contextWindow !== undefined && effective.contextWindow !== null && effective.contextWindow > 0) conf.contextWindow = effective.contextWindow;
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

  // 在已有 Profile 中查找与目标配置一致的最佳匹配，避免生成重复配置
  public findMatchingProfile(
    targetConfig: Partial<ApiProfile> | Partial<SharedConfig> | any,
    providers: ApiProvider[] = []
  ): { profile: ApiProfile; isExact: boolean; score: number } | null {
    if (!targetConfig) return null;

    let bestMatch: { profile: ApiProfile; isExact: boolean; score: number } | null = null;

    for (const profile of this.profiles) {
      const effective = this.resolveEffectiveProfile(profile, providers);
      const res = isProfileConfigMatching(effective, targetConfig);
      if (res.isMatch) {
        if (!bestMatch || res.score > bestMatch.score) {
          bestMatch = { profile, isExact: res.isExact, score: res.score };
          if (res.score === 100) {
            break;
          }
        }
      }
    }

    return bestMatch;
  }
}

// 配置比对与归一化纯函数已迁至 utils/config-compare.ts；此处 re-export 保持既有导入路径兼容
export { normalizeUrl, normalizeString, isProtocolCompatible, isProfileConfigMatching } from "@/utils/config-compare";
export type { ProfileMatchResult } from "@/utils/config-compare";
