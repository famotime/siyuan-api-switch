import { describe, it, expect, beforeEach } from "vitest";
import { apiSwitchCore, ApiProfile } from "@/services/api-switch-core";
import { ApiProvider } from "@/types";

describe("Profile 有效参数继承解析 (resolveEffectiveProfile)", () => {
  const mockProvider: ApiProvider = {
    id: "provider_deepseek",
    displayName: "DeepSeek 官方",
    apiKey: "sk-provider-secret",
    baseUrl: "https://api.deepseek.com",
    protocol: "openai",
    requestTimeout: 60,
    headers: {
      "X-Provider-Header": "provider-val",
      "Authorization": "Bearer overrideme",
    },
    models: [
      { id: "deepseek-chat", name: "deepseek-chat", displayName: "DeepSeek V3" },
      { id: "deepseek-reasoner", name: "deepseek-reasoner", displayName: "DeepSeek R1" },
    ],
  };

  beforeEach(() => {
    // 重置 provider 列表
    (apiSwitchCore as any).providers = [mockProvider];
    (apiSwitchCore as any).profiles = [];
    (apiSwitchCore as any).bindings = {};
  });

  it("无关联 providerId 的独立 Profile，直接返回自身字段", () => {
    const standaloneProfile: ApiProfile = {
      id: "prof_standalone",
      name: "Standalone Custom",
      provider: "custom",
      baseUrl: "https://my-proxy.com/v1",
      apiKey: "sk-custom",
      model: "custom-llm",
      requestTimeoutSeconds: 15,
      temperature: 0.3,
    };

    const resolved = apiSwitchCore.resolveEffectiveProfile(standaloneProfile);
    expect(resolved).toEqual(standaloneProfile);
  });

  it("关联有效 Provider 的 Profile，正确继承 baseUrl、apiKey、protocol、timeout 及 models", () => {
    const linkedProfile: ApiProfile = {
      id: "prof_linked",
      name: "DeepSeek 默认配置",
      providerId: "provider_deepseek",
      provider: "custom",
      baseUrl: "",
      apiKey: "",
      model: "deepseek-chat",
      temperature: 0.7,
      maxTokens: 4096,
    };

    const resolved = apiSwitchCore.resolveEffectiveProfile(linkedProfile);
    expect(resolved.baseUrl).toBe("https://api.deepseek.com");
    expect(resolved.apiKey).toBe("sk-provider-secret");
    expect(resolved.protocol).toBe("openai");
    expect(resolved.requestTimeoutSeconds).toBe(60);
    expect(resolved.models).toEqual(["deepseek-chat", "deepseek-reasoner"]);
  });

  it("Profile 自身的特定 headers 能够与 Provider 的 headers 深度合并并优先覆盖", () => {
    const profileWithHeaders: ApiProfile = {
      id: "prof_hdr",
      name: "Custom Headers Profile",
      providerId: "provider_deepseek",
      provider: "openai",
      baseUrl: "",
      apiKey: "",
      model: "deepseek-chat",
      headers: {
        "X-Custom-Profile": "profile-val",
        "Authorization": "Bearer profile-override",
      },
    };

    const resolved = apiSwitchCore.resolveEffectiveProfile(profileWithHeaders);
    expect(resolved.headers).toEqual({
      "X-Provider-Header": "provider-val",
      "Authorization": "Bearer profile-override",
      "X-Custom-Profile": "profile-val",
    });
  });

  it("Profile 自身的超时时间优先于 Provider 的默认超时时间", () => {
    const profileWithTimeout: ApiProfile = {
      id: "prof_timeout",
      name: "Timeout Profile",
      providerId: "provider_deepseek",
      provider: "openai",
      baseUrl: "",
      apiKey: "",
      model: "deepseek-chat",
      requestTimeoutSeconds: 120, // 覆盖 Provider 的 60
    };

    const resolved = apiSwitchCore.resolveEffectiveProfile(profileWithTimeout);
    expect(resolved.requestTimeoutSeconds).toBe(120);
  });
});
