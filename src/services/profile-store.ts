import { SharedConfig, ApiProvider, ApiProfile } from "@/types";

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
      id: "prof_" + Math.random().toString(36).substring(2, 11),
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

// 规范化 URL（去除首尾空白与尾部多余斜杠）
export function normalizeUrl(url?: string | null): string {
  if (!url) return "";
  const trimmed = url.trim();
  if (!trimmed) return "";
  try {
    const parsed = new URL(trimmed);
    const protocol = parsed.protocol.toLowerCase();
    const host = parsed.host.toLowerCase();
    const pathname = parsed.pathname.replace(/\/+$/, "");
    return `${protocol}//${host}${pathname}${parsed.search}`;
  } catch {
    return trimmed.replace(/\/+$/, "");
  }
}

// 规范化字符串
export function normalizeString(str?: string | null): string {
  return str ? str.trim() : "";
}

// 判断协议/服务商是否兼容（OpenAI 生态系列视作兼容）
export function isProtocolCompatible(proto1?: string, proto2?: string): boolean {
  const p1 = (proto1 || "openai").toLowerCase().trim();
  const p2 = (proto2 || "openai").toLowerCase().trim();
  if (p1 === p2) return true;
  const openaiCompat = [
    "openai",
    "custom",
    "deepseek",
    "siliconflow",
    "openrouter",
    "groq",
    "together",
    "ollama",
    "moonshot",
    "zhipu",
    "minimax",
    "stepfun",
  ];
  return openaiCompat.includes(p1) && openaiCompat.includes(p2);
}

export interface ProfileMatchResult {
  isMatch: boolean;
  isExact: boolean;
  score: number;
}

// 校验两个配置是否一致
export function isProfileConfigMatching(
  effectiveProfile: ApiProfile,
  targetConfig: Partial<ApiProfile> | Partial<SharedConfig> | any
): ProfileMatchResult {
  if (!effectiveProfile || !targetConfig) {
    return { isMatch: false, isExact: false, score: 0 };
  }

  // 1. 决策模型属性必须一致
  const targetIsDecision = Boolean(targetConfig.isDecisionModel);
  const profileIsDecision = Boolean(effectiveProfile.isDecisionModel);
  if (targetIsDecision !== profileIsDecision) {
    return { isMatch: false, isExact: false, score: 0 };
  }

  // 2. Base URL 比对
  const profUrl = normalizeUrl(effectiveProfile.baseUrl);
  const targetUrl = normalizeUrl(targetConfig.baseUrl || targetConfig.baseURL);
  if (profUrl && targetUrl) {
    if (profUrl !== targetUrl) {
      return { isMatch: false, isExact: false, score: 0 };
    }
  } else if ((profUrl && !targetUrl) || (!profUrl && targetUrl)) {
    return { isMatch: false, isExact: false, score: 0 };
  }

  // 3. API Key 比对
  const profKey = normalizeString(effectiveProfile.apiKey);
  const targetKey = normalizeString(targetConfig.apiKey);
  if (profKey || targetKey) {
    if (profKey !== targetKey) {
      return { isMatch: false, isExact: false, score: 0 };
    }
  }

  // 4. 协议兼容性比对
  const profProto = effectiveProfile.protocol || effectiveProfile.provider;
  const targetProto = targetConfig.protocol || targetConfig.provider;
  if (!isProtocolCompatible(profProto, targetProto)) {
    return { isMatch: false, isExact: false, score: 0 };
  }

  // 5. 模型比对
  if (!profileIsDecision) {
    const profModel = normalizeString(effectiveProfile.model);
    const targetModel = normalizeString(targetConfig.model || targetConfig.modelId);
    if (!profModel || !targetModel) {
      return { isMatch: false, isExact: false, score: 0 };
    }
    if (profModel.toLowerCase() !== targetModel.toLowerCase()) {
      return { isMatch: false, isExact: false, score: 0 };
    }
  } else {
    const profModel = normalizeString(effectiveProfile.model);
    const targetModel = normalizeString(targetConfig.model || targetConfig.modelId || targetConfig.name);
    if (profModel && targetModel && profModel.toLowerCase() !== targetModel.toLowerCase()) {
      return { isMatch: false, isExact: false, score: 0 };
    }
  }

  // 核心连接参数通过，基础分 80 分
  let score = 80;
  let exactBonus = true;

  const profModel = normalizeString(effectiveProfile.model);
  const targetModel = normalizeString(targetConfig.model || targetConfig.modelId);
  if (profModel === targetModel) {
    score += 5;
  } else {
    exactBonus = false;
  }

  if (profProto && targetProto && profProto.toLowerCase() === targetProto.toLowerCase()) {
    score += 5;
  }

  const compareNumber = (pNum?: number, tNum?: number) => {
    if (pNum !== undefined && tNum !== undefined && pNum !== null && tNum !== null) {
      if (Math.abs(pNum - tNum) > 0.001) {
        exactBonus = false;
        score -= 1;
      }
    }
  };

  compareNumber(effectiveProfile.temperature, targetConfig.temperature);
  compareNumber(effectiveProfile.maxTokens, targetConfig.maxTokens ?? targetConfig.maxCompletionTokens);
  compareNumber(effectiveProfile.maxHistoryMessages, targetConfig.maxHistoryMessages);
  compareNumber(effectiveProfile.maxToolCallRounds, targetConfig.maxToolCallRounds);
  compareNumber(effectiveProfile.sessionTimeout, targetConfig.sessionTimeout);
  compareNumber(effectiveProfile.streamIdleTimeout, targetConfig.streamIdleTimeout);
  compareNumber(effectiveProfile.confirmTimeout, targetConfig.confirmTimeout);
  compareNumber(effectiveProfile.maxRetries, targetConfig.maxRetries);
  compareNumber(effectiveProfile.requestTimeoutSeconds, targetConfig.requestTimeoutSeconds ?? targetConfig.timeout);

  if (exactBonus) {
    score = 100;
  }

  return {
    isMatch: true,
    isExact: score === 100,
    score: Math.max(score, 80),
  };
}

