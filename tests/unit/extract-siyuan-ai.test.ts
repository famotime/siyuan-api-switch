import { describe, it, expect } from "vitest";
import { extractSiyuanAiSettings } from "@/services/api-switch-core";

describe("extractSiyuanAiSettings", () => {
  it("空配置或非法对象输入时安全返回空结构", () => {
    expect(extractSiyuanAiSettings(null)).toEqual({
      providers: [],
      editing: null,
      agent: null,
      decision: null,
    });
    expect(extractSiyuanAiSettings(undefined)).toEqual({
      providers: [],
      editing: null,
      agent: null,
      decision: null,
    });
    expect(extractSiyuanAiSettings("invalid" as any)).toEqual({
      providers: [],
      editing: null,
      agent: null,
      decision: null,
    });
  });

  it("正确提取提供商列表并规范化模型结构", () => {
    const raw = {
      providers: [
        {
          id: "p-deepseek",
          displayName: "DeepSeek Official",
          apiKey: "sk-test-123",
          baseURL: "https://api.deepseek.com/v1",
          protocol: "openai",
          requestTimeout: 45,
          headers: { "X-Custom": "header-val" },
          models: [
            { id: "deepseek-chat", name: "deepseek-chat", displayName: "DeepSeek V3", enabled: true, contextLength: 64000 },
            { id: "deepseek-reasoner", name: "deepseek-reasoner", enabled: false },
          ],
        },
      ],
    };

    const res = extractSiyuanAiSettings(raw);
    expect(res.providers).toHaveLength(1);
    const p = res.providers[0];
    expect(p.id).toBe("p-deepseek");
    expect(p.displayName).toBe("DeepSeek Official");
    expect(p.apiKey).toBe("sk-test-123");
    expect(p.baseUrl).toBe("https://api.deepseek.com/v1");
    expect(p.protocol).toBe("openai");
    expect(p.requestTimeout).toBe(45);
    expect(p.headers).toEqual({ "X-Custom": "header-val" });
    expect(p.models).toHaveLength(2);
    expect(p.models[0]).toEqual({
      id: "deepseek-chat",
      name: "deepseek-chat",
      displayName: "DeepSeek V3",
      enabled: true,
      contextLength: 64000,
    });
  });

  it("正确解析编辑器 (Editing) 与智能体 (Agent) 配置及提供商关联", () => {
    const raw = {
      providers: [
        {
          id: "p-1",
          apiKey: "key-1",
          baseURL: "https://api.openai.com/v1",
          protocol: "openai",
          requestTimeout: 30,
          models: [{ id: "gpt-4o", name: "gpt-4o", enabled: true }],
        },
      ],
      editing: {
        modelId: "gpt-4o",
        temperature: 0.5,
        maxCompletionTokens: 2048,
        maxHistoryMessages: 5,
      },
      agent: {
        modelId: "gpt-4o",
        temperature: 0.8,
        maxCompletionTokens: 4096,
        maxToolCallRounds: 32,
        sessionTimeout: 1200,
        streamIdleTimeout: 60,
        confirmTimeout: 300,
        maxRetries: 2,
      },
    };

    const res = extractSiyuanAiSettings(raw);

    expect(res.editing).toEqual({
      providerId: "p-1",
      provider: "openai",
      protocol: "openai",
      baseUrl: "https://api.openai.com/v1",
      apiKey: "key-1",
      model: "gpt-4o",
      headers: {},
      requestTimeoutSeconds: 30,
      temperature: 0.5,
      maxTokens: 2048,
      maxHistoryMessages: 5,
    });

    expect(res.agent).toEqual({
      providerId: "p-1",
      provider: "openai",
      protocol: "openai",
      baseUrl: "https://api.openai.com/v1",
      apiKey: "key-1",
      model: "gpt-4o",
      headers: {},
      requestTimeoutSeconds: 30,
      temperature: 0.8,
      maxTokens: 4096,
      maxToolCallRounds: 32,
      sessionTimeout: 1200,
      streamIdleTimeout: 60,
      confirmTimeout: 300,
      maxRetries: 2,
    });
  });

  it("正确提取决策模型 (Decision) 配置", () => {
    const raw = {
      decision: {
        endpoint: "https://decision.local/v1",
        apiKey: "dec-key",
        name: "decision-model-v1",
        timeout: 15,
      },
    };

    const res = extractSiyuanAiSettings(raw);
    expect(res.decision).toEqual({
      provider: "custom",
      baseUrl: "https://decision.local/v1",
      apiKey: "dec-key",
      model: "decision-model-v1",
      requestTimeoutSeconds: 15,
      isDecisionModel: true,
    });
  });

  it("当未配置提供商但包含旧版 openAI 配置时能够平滑 fallback", () => {
    const raw = {
      openAI: {
        apiBaseURL: "https://legacy.openai.com/v1",
        apiKey: "legacy-key",
        apiModel: "gpt-3.5-turbo",
        apiTimeout: 20,
        apiTemperature: 0.7,
        apiMaxTokens: 1000,
      },
    };

    const res = extractSiyuanAiSettings(raw);
    expect(res.editing).toEqual({
      provider: "openai",
      baseUrl: "https://legacy.openai.com/v1",
      apiKey: "legacy-key",
      model: "gpt-3.5-turbo",
      requestTimeoutSeconds: 20,
      temperature: 0.7,
      maxTokens: 1000,
    });
  });
});
