import { describe, it, expect } from "vitest";
import { normalizeAiProtocol } from "@/utils/protocol";
import {
  PRESET_PROVIDER_LIST,
  PRESET_PROVIDERS,
  getPresetProtocolBaseUrl,
  findPresetByBaseUrl,
  GEMINI_OPENAI_COMPAT_BASE_URL,
} from "@/constants/providers";
import { lookupModelContextLength, MODEL_CONTEXT_LENGTHS } from "@/constants/model-contexts";
import { migrateLegacyAiProtocols } from "@/services/config-migration";
import { ApiProvider, ApiProfile } from "@/types";

describe("协议值域规范化 (normalizeAiProtocol)", () => {
  it("原生三值原样放行", () => {
    expect(normalizeAiProtocol("openai")).toBe("openai");
    expect(normalizeAiProtocol("openai-responses")).toBe("openai-responses");
    expect(normalizeAiProtocol("anthropic-messages")).toBe("anthropic-messages");
  });

  it("旧值静默迁移：gemini/custom→openai、anthropic→anthropic-messages", () => {
    expect(normalizeAiProtocol("gemini")).toBe("openai");
    expect(normalizeAiProtocol("custom")).toBe("openai");
    expect(normalizeAiProtocol("anthropic")).toBe("anthropic-messages");
  });

  it("空值与未知值回退 openai；大小写与空白不敏感", () => {
    expect(normalizeAiProtocol(undefined)).toBe("openai");
    expect(normalizeAiProtocol("")).toBe("openai");
    expect(normalizeAiProtocol("some-future-protocol")).toBe("openai");
    expect(normalizeAiProtocol("  Anthropic ")).toBe("anthropic-messages");
  });
});

describe("预置供应商目录完整性", () => {
  it("镜像思源原生 18 项（17 家服务商 + 自定义），id 唯一且自定义在最后", () => {
    expect(PRESET_PROVIDER_LIST).toHaveLength(18);
    const ids = PRESET_PROVIDER_LIST.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids[ids.length - 1]).toBe("custom");
    // 思源原生目录的关键成员全覆盖
    for (const mustHave of ["openai", "anthropic", "deepseek", "moonshot", "volcengine", "zhipu", "gemini",
      "mistral", "siliconflow", "openrouter", "groq", "ollama", "lmstudio"]) {
      expect(ids).toContain(mustHave);
    }
  });

  it("非 custom 预置均具备协议、BaseURL、Key 获取地址与图标，协议值全部为内核原生值域", () => {
    for (const preset of PRESET_PROVIDER_LIST) {
      if (preset.category === "custom") continue;
      expect(preset.defaultBaseUrl).toMatch(/^https?:\/\//);
      expect(preset.providerUrl).toBeTruthy();
      expect(preset.icon).toMatch(/^\/stage\/images\/ai-providers\/[\w-]+\.svg$/);
      expect(["openai", "openai-responses", "anthropic-messages"]).toContain(preset.protocol);
    }
  });

  it("Record 索引与列表一致（兼容旧消费方 PRESET_PROVIDERS[provKey] 用法）", () => {
    for (const preset of PRESET_PROVIDER_LIST) {
      expect(PRESET_PROVIDERS[preset.id]).toBe(preset);
    }
  });

  it("协议感知地址：DeepSeek 切 anthropic-messages 得到 /anthropic 入口，切回 openai 还原标准地址", () => {
    expect(getPresetProtocolBaseUrl("https://api.deepseek.com", "anthropic-messages")).toBe("https://api.deepseek.com/anthropic");
    expect(getPresetProtocolBaseUrl("https://api.deepseek.com/anthropic", "openai")).toBe("https://api.deepseek.com");
    expect(getPresetProtocolBaseUrl("https://my-own-gateway.example.com", "anthropic-messages")).toBe("https://my-own-gateway.example.com");
    expect(findPresetByBaseUrl("https://api.deepseek.com/anthropic")?.id).toBe("deepseek");
  });
});

describe("内置容量快照表", () => {
  it("收录规模约 100 条且包含主流模型家族", () => {
    expect(Object.keys(MODEL_CONTEXT_LENGTHS).length).toBeGreaterThanOrEqual(90);
    for (const family of ["gpt-4o", "claude-sonnet-4-5", "gemini-2.5-flash", "deepseek-chat",
      "kimi-k2", "qwen-plus", "glm-4.5", "doubao-seed-1-6-250615", "minimax-m2", "llama-3.3-70b-versatile"]) {
      expect(lookupModelContextLength(family)).toBeGreaterThan(0);
    }
  });

  it("大小写不敏感、支持 provider/model 末段匹配、未知返回 0", () => {
    expect(lookupModelContextLength("GPT-4O-MINI")).toBe(128000);
    expect(lookupModelContextLength("z-ai/glm-4.6")).toBe(200000);
    expect(lookupModelContextLength("no-such-model")).toBe(0);
    expect(lookupModelContextLength("")).toBe(0);
  });
});

describe("存量配置协议迁移 (migrateLegacyAiProtocols)", () => {
  const makeProvider = (overrides: Partial<ApiProvider>): ApiProvider => ({
    id: "provider_x",
    displayName: "X",
    apiKey: "sk-x",
    baseUrl: "https://api.x.com/v1",
    protocol: "openai",
    models: [],
    ...overrides,
  });
  const makeProfile = (overrides: Partial<ApiProfile>): ApiProfile => ({
    id: "prof_x",
    name: "X",
    provider: "custom",
    baseUrl: "",
    apiKey: "",
    model: "m",
    ...overrides,
  });

  it("供应商旧协议值迁移为原生值域", () => {
    const providers = [
      makeProvider({ protocol: "anthropic" }),
      makeProvider({ protocol: "gemini" }),
      makeProvider({ protocol: "custom" }),
      makeProvider({ protocol: "openai-responses" }),
    ];
    const changed = migrateLegacyAiProtocols(providers, []);
    expect(changed).toBe(true);
    expect(providers.map((p) => p.protocol)).toEqual([
      "anthropic-messages",
      "openai",
      "openai",
      "openai-responses",
    ]);
  });

  it("Gemini 旧原生端点随迁移改写为 OpenAI 兼容端点", () => {
    const providers = [makeProvider({ protocol: "gemini", baseUrl: "https://generativelanguage.googleapis.com/v1beta" })];
    const profiles = [makeProfile({ protocol: "gemini", provider: "gemini", baseUrl: "https://generativelanguage.googleapis.com/v1beta/" })];
    migrateLegacyAiProtocols(providers, profiles);
    expect(providers[0].protocol).toBe("openai");
    expect(providers[0].baseUrl).toBe(GEMINI_OPENAI_COMPAT_BASE_URL);
    expect(profiles[0].baseUrl).toBe(GEMINI_OPENAI_COMPAT_BASE_URL);
  });

  it("决策模型的 custom 标记保留，不做协议迁移", () => {
    const profiles = [makeProfile({ protocol: "custom", provider: "custom", isDecisionModel: true })];
    const changed = migrateLegacyAiProtocols([], profiles);
    expect(changed).toBe(false);
    expect(profiles[0].protocol).toBe("custom");
  });

  it("无旧值时返回 false（避免无谓落盘）", () => {
    const providers = [makeProvider({ protocol: "openai" })];
    const profiles = [makeProfile({ protocol: "anthropic-messages" })];
    expect(migrateLegacyAiProtocols(providers, profiles)).toBe(false);
  });
});
