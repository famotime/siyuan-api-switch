import { describe, it, expect } from "vitest";
import { extractSiyuanAiSettings, cleanRawProviderDisplayName, resolveProviderDisplayName } from "@/services/api-switch-core";

describe("extractSiyuanAiSettings 与提供商名称净化", () => {
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

  describe("提供商名称净化与独立显示（不含模型名）", () => {
    it("cleanRawProviderDisplayName 正确剥离末尾拼接的模型名称后缀", () => {
      // 命中当前模型名
      expect(cleanRawProviderDisplayName("讯飞星火-spark-x2.6", "spark-x2.6")).toBe("讯飞星火");
      expect(cleanRawProviderDisplayName("DeepSeek-v4-flash", "v4-flash")).toBe("DeepSeek");

      // 从模型列表中匹配并剥离
      expect(cleanRawProviderDisplayName("DeepSeek-v4-flash", undefined, ["deepseek-chat", "v4-flash"])).toBe("DeepSeek");

      // 干净的提供商名保持不变
      expect(cleanRawProviderDisplayName("StepFun", "step-1-8k")).toBe("StepFun");
      expect(cleanRawProviderDisplayName("OpenAI 官方", "gpt-4o")).toBe("OpenAI 官方");
      expect(cleanRawProviderDisplayName("自定义大模型", undefined, [])).toBe("自定义大模型");
    });

    it("resolveProviderDisplayName 优先使用关联提供商对象的纯粹 displayName", () => {
      const providers = [
        {
          id: "prov-spark",
          displayName: "讯飞星火",
          baseUrl: "https://maas-api.cn-huabei-1.xf-yun.com/v1",
          apiKey: "k",
          protocol: "openai" as const,
          requestTimeout: 30,
          headers: {},
          models: [{ id: "spark-x2.6", name: "spark-x2.6", displayName: "spark-x2.6", enabled: true }],
        },
      ];

      // Profile 命名带有 -spark-x2.6，但关联了 prov-spark
      const profile = {
        id: "prof-1",
        name: "讯飞星火-spark-x2.6",
        providerId: "prov-spark",
        provider: "openai",
        baseUrl: "https://maas-api.cn-huabei-1.xf-yun.com/v1",
        apiKey: "k",
        model: "spark-x2.6",
      };

      const resolved = resolveProviderDisplayName(profile, providers);
      expect(resolved).toBe("讯飞星火");
    });

    it("resolveProviderDisplayName 在无 providerId 时根据 baseUrl 或 name 剥离模型后缀", () => {
      // 命中 DeepSeek 预置 baseUrl
      const deepseekProfile = {
        id: "prof-ds",
        name: "DeepSeek-v4-flash",
        provider: "openai",
        baseUrl: "https://api.deepseek.com",
        apiKey: "k",
        model: "v4-flash",
      };
      expect(resolveProviderDisplayName(deepseekProfile)).toBe("DeepSeek 官方");

      // 未命中已知预置时，正确从 profile.name 中剥离模型名
      const customProfile = {
        id: "prof-custom",
        name: "公司私有网关-llama-3-8b",
        provider: "custom",
        baseUrl: "https://llm.mycompany.internal/v1",
        apiKey: "k",
        model: "llama-3-8b",
      };
      expect(resolveProviderDisplayName(customProfile)).toBe("公司私有网关");
    });

    it("extractSiyuanAiSettings 解析思源配置时自动清洗污染的提供商 displayName", () => {
      const raw = {
        providers: [
          {
            id: "p-spark",
            displayName: "讯飞星火-spark-x2.6",
            baseURL: "https://maas-api.cn-huabei-1.xf-yun.com/v1",
            apiKey: "key",
            models: [{ id: "spark-x2.6", name: "spark-x2.6" }],
          },
          {
            id: "p-ds",
            displayName: "DeepSeek-v4-flash",
            baseURL: "https://api.deepseek.com",
            apiKey: "key",
            models: [{ id: "v4-flash", name: "v4-flash" }],
          },
          {
            id: "p-step",
            displayName: "StepFun",
            baseURL: "https://api.stepfun.com/step_plan/v1",
            apiKey: "key",
            models: [{ id: "step-1-8k", name: "step-1-8k" }],
          },
        ],
      };

      const res = extractSiyuanAiSettings(raw);
      expect(res.providers).toHaveLength(3);
      expect(res.providers[0].displayName).toBe("讯飞星火");
      expect(res.providers[1].displayName).toBe("DeepSeek");
      expect(res.providers[2].displayName).toBe("StepFun");
    });
  });
});
