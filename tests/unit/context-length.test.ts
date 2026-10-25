import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { setFetchHandler } from "siyuan";
import { apiSwitchCore } from "@/services/api-switch-core";
import { SiyuanAdapter } from "@/services/siyuan-adapter";
import { ApiProvider, ApiProfile } from "@/types";

const noopLog = () => {};

describe("上下文容量全链路打通", () => {
  beforeEach(() => {
    (apiSwitchCore as any).providerStore.setProviders([]);
    (apiSwitchCore as any).profileStore.setProfiles([]);
    (apiSwitchCore as any).bindingManager.setBindings({});
  });

  afterEach(() => {
    setFetchHandler(null);
  });

  it("resolveEffectiveProfile 从关联提供商当前模型继承 contextWindow，Profile 显式值优先", () => {
    const provider: ApiProvider = {
      id: "provider_ds",
      displayName: "DeepSeek 官方",
      apiKey: "sk-x",
      baseUrl: "https://api.deepseek.com",
      protocol: "openai",
      models: [
        { id: "deepseek-chat", name: "deepseek-chat", displayName: "deepseek-chat", enabled: true, contextLength: 131072 },
        { id: "deepseek-reasoner", name: "deepseek-reasoner", displayName: "deepseek-reasoner", enabled: true, contextLength: 65536 },
      ],
    };
    (apiSwitchCore as any).providerStore.setProviders([provider]);
    const profile: ApiProfile = {
      id: "prof_1",
      name: "日常",
      providerId: "provider_ds",
      provider: "openai",
      protocol: "openai",
      baseUrl: "",
      apiKey: "",
      model: "deepseek-chat",
    };

    const effective = apiSwitchCore.resolveEffectiveProfile(profile);
    expect(effective.contextWindow).toBe(131072);

    // 切换模型 → 继承对应模型的容量
    profile.model = "deepseek-reasoner";
    expect(apiSwitchCore.resolveEffectiveProfile(profile).contextWindow).toBe(65536);

    // Profile 显式覆盖优先
    profile.contextWindow = 32000;
    expect(apiSwitchCore.resolveEffectiveProfile(profile).contextWindow).toBe(32000);
  });

  it("toSharedConfig 向子插件下发 contextWindow（>0 时）", async () => {
    await apiSwitchCore.addProvider({
      displayName: "DeepSeek 官方",
      apiKey: "sk-x",
      baseUrl: "https://api.deepseek.com",
      protocol: "openai",
      models: [{ id: "deepseek-chat", name: "deepseek-chat", displayName: "deepseek-chat", enabled: true, contextLength: 131072 }],
    });
    const prof = await apiSwitchCore.addProfile({
      name: "接管配置",
      provider: "deepseek",
      apiKey: "sk-x",
      model: "deepseek-chat",
    });

    const config = apiSwitchCore.getBoundSharedConfig("any-plugin");
    // 未绑定时为 null；直接经由绑定通道验证
    expect(config).toBeNull();

    (apiSwitchCore as any).bindingManager.setBinding("any-plugin", prof.id);
    const bound = apiSwitchCore.getBoundSharedConfig("any-plugin");
    expect(bound?.contextWindow).toBe(131072);
  });

  it("写回思源时同步模型 contextLength 与原生协议值", async () => {
    let capturedSetAI: any = null;
    setFetchHandler((url, data) => {
      if (url === "/api/system/getConf") {
        return { code: 0, msg: "", data: { ai: { providers: [] } } };
      }
      if (url === "/api/setting/setAI") {
        capturedSetAI = data;
        return { code: 0, msg: "", data: null };
      }
      return { code: 0, msg: "", data: {} };
    });

    const adapter = new SiyuanAdapter(noopLog, noopLog);
    const effective: ApiProfile = {
      id: "prof_1",
      name: "接管配置",
      providerId: "provider_1",
      provider: "openai",
      // 旧协议值 anthropic 也会被写回为内核原生 anthropic-messages
      protocol: "anthropic",
      baseUrl: "https://api.anthropic.com/v1",
      apiKey: "sk-ant",
      model: "claude-sonnet-4-5",
      models: ["claude-sonnet-4-5"],
      contextWindow: 200000,
    };

    await adapter.updateSiyuanSystemAi(effective, "editing");

    expect(capturedSetAI).not.toBeNull();
    const provider = capturedSetAI.providers[0];
    expect(provider.protocol).toBe("anthropic-messages");
    const model = provider.models.find((m: any) => m.name === "claude-sonnet-4-5");
    expect(model.contextLength).toBe(200000);
    expect(capturedSetAI.editing.modelId).toBe(model.id);
  });

  it("importProfiles 白名单透传 contextWindow", async () => {
    await apiSwitchCore.importProfiles([
      {
        id: "prof_import",
        name: "导入配置",
        provider: "custom",
        baseUrl: "https://api.custom.com/v1",
        apiKey: "sk-c",
        model: "m1",
        contextWindow: 8192,
      } as ApiProfile,
    ]);
    const imported = apiSwitchCore.getProfile("prof_import");
    expect(imported?.contextWindow).toBe(8192);
  });
});
