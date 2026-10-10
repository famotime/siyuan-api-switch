import { fetchSyncPost } from "siyuan";
import { ApiProvider, ApiProviderModel, SiyuanAiJson } from "@/types";
import { ApiProfile } from "./profile-store";

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
      headers: editingResolved ? (agentResolved.provider.headers || {}) : {},
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

export class SiyuanAdapter {
  private log: (msg: string, ...args: any[]) => void;
  private logError: (msg: string, ...args: any[]) => void;

  constructor(
    log: (msg: string, ...args: any[]) => void,
    logError: (msg: string, ...args: any[]) => void
  ) {
    this.log = log;
    this.logError = logError;
  }

  async fetchSystemAiConfig(): Promise<any> {
    try {
      const confRes = await fetchSyncPost("/api/system/getConf", {});
      const fullConf = confRes && confRes.code === 0 ? confRes.data : null;
      return fullConf?.ai || (window as any).siyuan?.config?.ai || null;
    } catch (err) {
      this.logError("Failed to fetch system AI config", err);
      return (window as any).siyuan?.config?.ai || null;
    }
  }

  async setSystemAiConfig(aiConfig: any): Promise<boolean> {
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
      return true;
    }
    return false;
  }

  async updateSiyuanSystemAi(
    effective: ApiProfile | null,
    targetScope: "editing" | "agent" | "decision" | "all" = "all"
  ): Promise<void> {
    if (!effective) return;

    try {
      const currentAi = await this.fetchSystemAiConfig();
      let aiConfig = JSON.parse(JSON.stringify(currentAi || {}));

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
          const providerId = effective.providerId || `provider_${effective.provider || "custom"}`;

          let targetProvider = aiConfig.providers.find(
            (p: any) => p.id === providerId || p.displayName === effective.name
          );

          if (!targetProvider) {
            targetProvider = {
              id: providerId,
              displayName: effective.name || "API Switch Provider",
              enabled: true,
              protocol: effective.protocol || effective.provider || "openai",
              models: [],
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
              enabled: true,
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
                  enabled: true,
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

      const success = await this.setSystemAiConfig(aiConfig);
      if (success) {
        this.log(`Successfully synchronized to Siyuan system AI (scope: ${targetScope})`);
      } else {
        this.logError("Failed to synchronize to Siyuan system AI");
      }
    } catch (err) {
      this.logError("Error updating Siyuan system AI", err);
    }
  }

  exportSiyuanAiJson(
    providers: ApiProvider[],
    profiles: ApiProfile[],
    bindings: Record<string, string>,
    resolveEffectiveProfile: (p: ApiProfile) => ApiProfile
  ): string {
    const exportData: SiyuanAiJson & { _siyuanApiSwitch?: any } = {
      providers: providers.map((p) => ({
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
        profiles,
        bindings,
      },
    };

    if (bindings["siyuan_builtin_editing"]) {
      const prof = profiles.find((p) => p.id === bindings["siyuan_builtin_editing"]);
      if (prof) {
        const effective = resolveEffectiveProfile(prof);
        exportData.editing = {
          modelId: effective.model,
          maxHistoryMessages: effective.maxHistoryMessages ?? 7,
          temperature: effective.temperature ?? 0.7,
          maxCompletionTokens: effective.maxTokens ?? 4096,
        };
      }
    }

    if (bindings["siyuan_builtin_agent"]) {
      const prof = profiles.find((p) => p.id === bindings["siyuan_builtin_agent"]);
      if (prof) {
        const effective = resolveEffectiveProfile(prof);
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

    if (bindings["siyuan_builtin_decision"]) {
      const prof = profiles.find((p) => p.id === bindings["siyuan_builtin_decision"]);
      if (prof) {
        const effective = resolveEffectiveProfile(prof);
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
}
