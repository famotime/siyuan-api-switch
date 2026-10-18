import { describe, it, expect, beforeEach } from "vitest";
import {
  apiSwitchCore,
  shouldAutoGenerateProvider,
  PRESET_PROVIDERS,
} from "@/services/api-switch-core";

describe("自动生成 AI 提供商配置机制 (Auto Generate Provider)", () => {
  beforeEach(() => {
    (apiSwitchCore as any).providerStore.setProviders([]);
    (apiSwitchCore as any).profileStore.setProfiles([]);
    (apiSwitchCore as any).bindingManager.setBindings({});
    (apiSwitchCore as any).bindingManager.registrations.clear();
  });

  describe("shouldAutoGenerateProvider 判定条件", () => {
    it("未绑定提供商且服务商非 custom 且具备 API Key 时判定为应生成", () => {
      expect(
        shouldAutoGenerateProvider({
          provider: "deepseek",
          apiKey: "sk-test-key",
          baseUrl: "https://api.deepseek.com",
        })
      ).toBe(true);
    });

    it("Base URL 留空但属于知名预设服务商时应判定为可生成（支持自动补齐）", () => {
      expect(
        shouldAutoGenerateProvider({
          provider: "openai",
          apiKey: "sk-openai-key",
          baseUrl: "",
        })
      ).toBe(true);
    });

    it("服务商为 custom 时不应自动生成", () => {
      expect(
        shouldAutoGenerateProvider({
          provider: "custom",
          apiKey: "sk-test-key",
          baseUrl: "https://api.custom.com",
        })
      ).toBe(false);
    });

    it("已绑定 providerId 的 Profile 不应重复触发生成", () => {
      expect(
        shouldAutoGenerateProvider({
          providerId: "prov_123",
          provider: "deepseek",
          apiKey: "sk-test-key",
        })
      ).toBe(false);
    });

    it("API Key 为空时不应自动生成", () => {
      expect(
        shouldAutoGenerateProvider({
          provider: "deepseek",
          apiKey: "   ",
          baseUrl: "https://api.deepseek.com",
        })
      ).toBe(false);
    });

    it("决策模型若是 custom 协议时不应生成", () => {
      expect(
        shouldAutoGenerateProvider({
          provider: "custom",
          protocol: "custom",
          isDecisionModel: true,
          apiKey: "sk-jev-key",
        })
      ).toBe(false);
    });
  });

  describe("addProfile 手动保存时自动生成提供商", () => {
    it("保存非 custom 且具备 API Key 的 Profile 时，自动生成标准官方提供商并关联", async () => {
      const profile = await apiSwitchCore.addProfile({
        name: "我的 DeepSeek 助手",
        provider: "deepseek",
        apiKey: "sk-deepseek-test-123",
        model: "deepseek-chat",
        temperature: 0.7,
      });

      // 1. 验证生成了对应的 Provider
      const providers = apiSwitchCore.getProviders();
      expect(providers).toHaveLength(1);
      const generatedProv = providers[0];

      expect(generatedProv.displayName).toBe("DeepSeek 官方");
      expect(generatedProv.protocol).toBe("openai");
      expect(generatedProv.baseUrl).toBe("https://api.deepseek.com");
      expect(generatedProv.apiKey).toBe("sk-deepseek-test-123");
      expect(generatedProv.enabled).toBe(true);

      // 2. 验证模型池包含了当前 Profile 模型并扩充了官方推荐模型
      const modelNames = generatedProv.models.map((m) => m.name);
      expect(modelNames).toContain("deepseek-chat");
      expect(modelNames).toContain("deepseek-reasoner");

      // 3. 验证 Profile 关联状态及冗余连接字段清空
      expect(profile.providerId).toBe(generatedProv.id);
      expect(profile.baseUrl).toBe("");
      expect(profile.apiKey).toBe("");

      // 4. 验证继承解析正常
      const effective = apiSwitchCore.resolveEffectiveProfile(profile);
      expect(effective.baseUrl).toBe("https://api.deepseek.com");
      expect(effective.apiKey).toBe("sk-deepseek-test-123");
    });

    it("若已有相同 BaseURL 与 API Key 的提供商，自动复用并合并模型池，不生成重复提供商", async () => {
      // 1. 先配置一个已有的 OpenAI 官方提供商
      const prov = await apiSwitchCore.addProvider({
        displayName: "OpenAI 官方",
        baseUrl: "https://api.openai.com/v1",
        apiKey: "sk-openai-shared-key",
        protocol: "openai",
        models: [{ id: "gpt-4o", name: "gpt-4o", displayName: "gpt-4o", enabled: true }],
      });

      // 2. 新增一个使用相同 BaseURL 和 Key 的 Profile，但使用了新模型 o3-mini
      const profile = await apiSwitchCore.addProfile({
        name: "推理专用配置",
        provider: "openai",
        baseUrl: "https://api.openai.com/v1",
        apiKey: "sk-openai-shared-key",
        model: "o3-mini",
      });

      // 3. 校验：复用已有提供商，总数仍为 1
      const providers = apiSwitchCore.getProviders();
      expect(providers).toHaveLength(1);
      expect(profile.providerId).toBe(prov.id);

      // 4. 提供商模型池成功合并了新模型 o3-mini
      const updatedProv = apiSwitchCore.getProvider(prov.id)!;
      const modelNames = updatedProv.models.map((m) => m.name);
      expect(modelNames).toContain("gpt-4o");
      expect(modelNames).toContain("o3-mini");
    });

    it("服务商为 custom 时，保持独立配置，不自动生成提供商", async () => {
      const profile = await apiSwitchCore.addProfile({
        name: "我的本地 Ollama",
        provider: "custom",
        baseUrl: "http://localhost:11434/v1",
        apiKey: "ollama-local",
        model: "llama3",
      });

      expect(profile.providerId).toBeUndefined();
      expect(profile.baseUrl).toBe("http://localhost:11434/v1");
      expect(profile.apiKey).toBe("ollama-local");
      expect(apiSwitchCore.getProviders()).toHaveLength(0);
    });

    it("已有同名提供商但连接参数不同时，名称自动追加序号避免冲突", async () => {
      await apiSwitchCore.addProvider({
        displayName: "DeepSeek 官方",
        baseUrl: "https://api.deepseek.com",
        apiKey: "sk-account-A",
        protocol: "openai",
        models: [],
      });

      // 账户 B 的 DeepSeek 配置
      const profileB = await apiSwitchCore.addProfile({
        name: "DeepSeek 备用账户",
        provider: "deepseek",
        apiKey: "sk-account-B",
        model: "deepseek-chat",
      });

      const providers = apiSwitchCore.getProviders();
      expect(providers).toHaveLength(2);
      const provB = providers.find((p) => p.id === profileB.providerId)!;
      expect(provB.displayName).toBe("DeepSeek 官方 (2)");
      expect(provB.apiKey).toBe("sk-account-B");
    });
  });

  describe("ensureProvidersForProfiles 批量迁移扫描", () => {
    it("能扫描所有未绑定的合法独立配置并一键完成迁移关联", async () => {
      // 模拟加载旧版本存储的未关联独立配置
      const rawProfiles = [
        {
          id: "prof_legacy_ds",
          name: "旧版 DeepSeek",
          provider: "deepseek",
          baseUrl: "https://api.deepseek.com",
          apiKey: "sk-ds-legacy",
          model: "deepseek-chat",
        },
        {
          id: "prof_legacy_silicon",
          name: "旧版 硅基流动",
          provider: "siliconflow",
          baseUrl: "https://api.siliconflow.cn/v1",
          apiKey: "sk-sf-legacy",
          model: "deepseek-ai/DeepSeek-V3",
        },
        {
          id: "prof_legacy_custom",
          name: "旧版 自定义",
          provider: "custom",
          baseUrl: "https://my-custom.api/v1",
          apiKey: "sk-custom",
          model: "custom-model",
        },
      ];

      (apiSwitchCore as any).profileStore.setProfiles(rawProfiles);

      const res = await apiSwitchCore.ensureProvidersForProfiles();

      // 2 个非 custom 的配置成功创建并迁移提供商
      expect(res.createdCount).toBe(2);
      expect(apiSwitchCore.getProviders()).toHaveLength(2);

      const dsProf = apiSwitchCore.getProfile("prof_legacy_ds")!;
      expect(dsProf.providerId).toBeDefined();
      expect(dsProf.apiKey).toBe("");

      const sfProf = apiSwitchCore.getProfile("prof_legacy_silicon")!;
      expect(sfProf.providerId).toBeDefined();
      expect(sfProf.apiKey).toBe("");

      // custom 配置不受影响
      const customProf = apiSwitchCore.getProfile("prof_legacy_custom")!;
      expect(customProf.providerId).toBeUndefined();
      expect(customProf.apiKey).toBe("sk-custom");
    });
  });
});
