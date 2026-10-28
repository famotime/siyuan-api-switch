import { describe, it, expect, beforeEach } from "vitest";
import {
  apiSwitchCore,
  normalizeUrl,
  isProtocolCompatible,
  isProfileConfigMatching,
  ApiProfile,
} from "@/services/api-switch-core";
import { ApiProvider } from "@/types";

describe("配置一致性校验与防重复配置机制", () => {
  beforeEach(() => {
    (apiSwitchCore as any).providerStore.setProviders([]);
    (apiSwitchCore as any).profileStore.setProfiles([]);
    (apiSwitchCore as any).bindingManager.setBindings({});
    (apiSwitchCore as any).bindingManager.registrations.clear();
  });

  describe("URL 归一化与协议兼容性", () => {
    it("normalizeUrl 能正确去除尾部多余斜杠并小写协议与域名", () => {
      expect(normalizeUrl("https://api.openai.com/v1/")).toBe("https://api.openai.com/v1");
      expect(normalizeUrl("https://API.OpenAI.COM/v1///")).toBe("https://api.openai.com/v1");
      expect(normalizeUrl("  https://api.deepseek.com/v1  ")).toBe("https://api.deepseek.com/v1");
      expect(normalizeUrl("")).toBe("");
      expect(normalizeUrl(undefined)).toBe("");
    });

    it("isProtocolCompatible 正确识别 OpenAI 生态兼容协议", () => {
      expect(isProtocolCompatible("openai", "custom")).toBe(true);
      expect(isProtocolCompatible("deepseek", "openai")).toBe(true);
      expect(isProtocolCompatible("siliconflow", "deepseek")).toBe(true);
      // 值域迁移后：gemini 走 OpenAI 兼容端点（读档时已映射为 openai），与 openai 视作兼容
      expect(isProtocolCompatible("gemini", "openai")).toBe(true);
      expect(isProtocolCompatible("openai", "openai-responses")).toBe(true);
      // anthropic-messages 是独立线路协议，与 OpenAI 生态互不兼容
      expect(isProtocolCompatible("anthropic-messages", "openai")).toBe(false);
      expect(isProtocolCompatible("anthropic", "gemini")).toBe(false);
      // systemone 决策模型为独立专属协议，仅与自身兼容
      expect(isProtocolCompatible("systemone", "systemone")).toBe(true);
      expect(isProtocolCompatible("systemone", "openai")).toBe(false);
      expect(isProtocolCompatible("systemone", "anthropic-messages")).toBe(false);
    });
  });

  describe("isProfileConfigMatching 配置比对", () => {
    const baseEffective: ApiProfile = {
      id: "prof_base",
      name: "已有主力模型",
      provider: "openai",
      protocol: "openai",
      baseUrl: "https://api.deepseek.com/v1",
      apiKey: "sk-test-key-123",
      model: "deepseek-chat",
      temperature: 0.7,
      maxTokens: 4096,
      maxHistoryMessages: 10,
    };

    it("核心参数与高级参数完全一致时判定为完全匹配 (100分)", () => {
      const target = {
        provider: "openai",
        baseUrl: "https://api.deepseek.com/v1/",
        apiKey: "sk-test-key-123",
        model: "deepseek-chat",
        temperature: 0.7,
        maxTokens: 4096,
        maxHistoryMessages: 10,
      };

      const res = isProfileConfigMatching(baseEffective, target);
      expect(res.isMatch).toBe(true);
      expect(res.isExact).toBe(true);
      expect(res.score).toBe(100);
    });

    it("核心参数一致但高级参数略有不同时仍判定为匹配但非完全匹配", () => {
      const target = {
        provider: "custom",
        baseUrl: "https://api.deepseek.com/v1",
        apiKey: "sk-test-key-123",
        model: "deepseek-chat",
        temperature: 1.0, // 参数有差异
        maxTokens: 8192,
      };

      const res = isProfileConfigMatching(baseEffective, target);
      expect(res.isMatch).toBe(true);
      expect(res.isExact).toBe(false);
      expect(res.score).toBeGreaterThanOrEqual(80);
    });

    it("模型名称不同或 API Key 不同判定为不匹配", () => {
      const targetDiffModel = {
        baseUrl: "https://api.deepseek.com/v1",
        apiKey: "sk-test-key-123",
        model: "deepseek-coder",
      };
      expect(isProfileConfigMatching(baseEffective, targetDiffModel).isMatch).toBe(false);

      const targetDiffKey = {
        baseUrl: "https://api.deepseek.com/v1",
        apiKey: "sk-diff-key",
        model: "deepseek-chat",
      };
      expect(isProfileConfigMatching(baseEffective, targetDiffKey).isMatch).toBe(false);
    });

    it("严格区分普通对话模型与决策模型", () => {
      const decisionTarget = {
        baseUrl: "https://api.deepseek.com/v1",
        apiKey: "sk-test-key-123",
        model: "deepseek-chat",
        isDecisionModel: true,
      };
      // baseEffective 不是决策模型，所以不匹配
      expect(isProfileConfigMatching(baseEffective, decisionTarget).isMatch).toBe(false);
    });

    it("决策模型：模型不一致或某一方未指定模型时判定为不匹配", () => {
      const decisionProfile: ApiProfile = {
        id: "prof_decision",
        name: "默认决策模型",
        provider: "openai",
        protocol: "openai",
        baseUrl: "https://api.openai.com/v1",
        apiKey: "sk-decision-key",
        model: "gpt-4o-mini",
        isDecisionModel: true,
      };

      // 目标模型不同
      const targetDiffModel = {
        baseUrl: "https://api.openai.com/v1",
        apiKey: "sk-decision-key",
        model: "deepseek-chat",
        isDecisionModel: true,
      };
      expect(isProfileConfigMatching(decisionProfile, targetDiffModel).isMatch).toBe(false);

      // 目标未指定模型
      const targetNoModel = {
        baseUrl: "https://api.openai.com/v1",
        apiKey: "sk-decision-key",
        model: "",
        isDecisionModel: true,
      };
      expect(isProfileConfigMatching(decisionProfile, targetNoModel).isMatch).toBe(false);
    });

    it("本地配置有 API Key 而已有 Profile API Key 为空时严格判定为不匹配", () => {
      const emptyKeyProfile: ApiProfile = {
        id: "prof_empty_key",
        name: "空壳决策模型",
        provider: "openai",
        protocol: "openai",
        baseUrl: "https://api.openai.com/v1",
        apiKey: "",
        model: "gpt-4o-mini",
        isDecisionModel: true,
      };

      const realKeyTarget = {
        baseUrl: "https://api.openai.com/v1",
        apiKey: "sk-real-key-999",
        model: "gpt-4o-mini",
        isDecisionModel: true,
      };

      expect(isProfileConfigMatching(emptyKeyProfile, realKeyTarget).isMatch).toBe(false);
    });
  });

  describe("插件本地配置提取防重 (importLocalConfigToProfile)", () => {
    it("若已有相同配置的 Profile，直接复用已有配置，不生成重复 Profile", async () => {
      // 1. 先在旋钮中存在一个 Profile
      const existingProfile = await apiSwitchCore.addProfile({
        name: "我的 DeepSeek",
        provider: "deepseek",
        protocol: "openai",
        baseUrl: "https://api.deepseek.com/v1",
        apiKey: "sk-my-deepseek-key",
        model: "deepseek-chat",
        temperature: 0.7,
        maxTokens: 4096,
      });

      // 2. 模拟一个插件注册，其上报的本地配置与现有 Profile 一致
      (apiSwitchCore as any).registerPlugin(
        "siyuan-plugin-demo",
        "示例演示插件",
        () => {},
        {
          provider: "openai",
          protocol: "openai",
          baseUrl: "https://api.deepseek.com/v1/",
          apiKey: "sk-my-deepseek-key",
          model: "deepseek-chat",
          temperature: 0.7,
          maxTokens: 4096,
        }
      );

      // 验证未接管前能识别出匹配的已有配置
      const registered = apiSwitchCore.getRegisteredPlugins();
      const demoPlug = registered.find((p) => p.pluginId === "siyuan-plugin-demo");
      expect(demoPlug).toBeDefined();
      expect(demoPlug?.matchedProfileId).toBe(existingProfile.id);
      expect(demoPlug?.matchedProfileName).toBe("我的 DeepSeek");

      // 3. 执行一键导入本地配置
      const initialCount = apiSwitchCore.getProfiles().length;
      const res = await apiSwitchCore.importLocalConfigToProfile("siyuan-plugin-demo");

      // 4. 校验结果：复用已有配置，总数不增加
      expect(res?.action).toBe("reused");
      expect(res?.profile.id).toBe(existingProfile.id);
      expect(apiSwitchCore.getProfiles().length).toBe(initialCount);
      expect(apiSwitchCore.getBoundSharedConfig("siyuan-plugin-demo")?.profileId).toBe(existingProfile.id);

      // 5. 再次重复调用，依然幂等防重
      const resRepeat = await apiSwitchCore.importLocalConfigToProfile("siyuan-plugin-demo");
      expect(resRepeat?.action).toBe("reused");
      expect(apiSwitchCore.getProfiles().length).toBe(initialCount);
    });

    it("若无相同配置 Profile，创建新 Profile 并关联匹配的已有提供商", async () => {
      // 1. 存在已有 Provider
      const prov = await apiSwitchCore.addProvider({
        displayName: "OpenAI 官方服务",
        baseUrl: "https://api.openai.com/v1",
        apiKey: "sk-openai-key-abc",
        protocol: "openai",
        models: [{ id: "gpt-4o", name: "gpt-4o" }],
      });

      // 2. 插件注册未配置过的模型配置
      (apiSwitchCore as any).registerPlugin(
        "siyuan-plugin-translator",
        "智能翻译器",
        () => {},
        {
          provider: "openai",
          protocol: "openai",
          baseUrl: "https://api.openai.com/v1",
          apiKey: "sk-openai-key-abc",
          model: "gpt-4o-mini", // 新模型
          temperature: 0.3,
        }
      );

      const res = await apiSwitchCore.importLocalConfigToProfile("siyuan-plugin-translator");
      expect(res?.action).toBe("created");
      expect(res?.profile.providerId).toBe(prov.id); // 成功复用提供商
      expect(res?.profile.model).toBe("gpt-4o-mini");
      expect(apiSwitchCore.getProfiles()).toHaveLength(1);
    });

    it("带槽位插件导入决策模型本地配置时，完整持久化其 apiKey 并广播有效配置", async () => {
      let notifiedConfig: any = null;

      (apiSwitchCore as any).registerPlugin(
        "siyuan-mate",
        "思源灵犀",
        (conf: any, slotId?: string) => {
          if (slotId === "decision") {
            notifiedConfig = conf;
          }
        },
        undefined,
        [
          {
            id: "chat",
            name: "对话模型",
            localConfig: {
              provider: "openai",
              baseUrl: "https://api.openai.com/v1",
              apiKey: "sk-mate-chat",
              model: "gpt-4o",
            },
          },
          {
            id: "decision",
            name: "决策模型",
            localConfig: {
              provider: "custom",
              protocol: "openai",
              baseUrl: "https://api.deepseek.com/v1",
              apiKey: "sk-mate-decision-key",
              model: "deepseek-chat",
              temperature: 0.1,
              isDecisionModel: true,
            },
          },
        ]
      );

      const res = await apiSwitchCore.importLocalConfigToProfile("siyuan-mate", "decision");
      expect(res?.action).toBe("created");
      expect(res?.profile.model).toBe("deepseek-chat");
      expect(res?.profile.apiKey).toBe("sk-mate-decision-key");
      expect(res?.profile.isDecisionModel).toBe(true);

      // 验证绑定并广播给槽位的配置中包含有效的 apiKey
      expect(notifiedConfig).not.toBeNull();
      expect(notifiedConfig.apiKey).toBe("sk-mate-decision-key");
      expect(notifiedConfig.model).toBe("deepseek-chat");
    });
  });

  describe("思源笔记本体同步防重 (syncFromSiyuan)", () => {
    it("思源编辑器配置与已有 Profile 一致时，自动复用已有 Profile 避免重复创建", async () => {
      // 1. 预先配置了一个 Provider 与 Profile
      const prov = await apiSwitchCore.addProvider({
        id: "p_deepseek",
        displayName: "DeepSeek",
        baseUrl: "https://api.deepseek.com/v1",
        apiKey: "sk-sync-key",
        protocol: "openai",
        models: [{ id: "deepseek-chat", name: "deepseek-chat" }],
      });

      const existingProfile = await apiSwitchCore.addProfile({
        name: "我的主力写作配置",
        providerId: prov.id,
        provider: "openai",
        model: "deepseek-chat",
        temperature: 0.7,
        maxTokens: 2000,
      });

      // 2. 模拟思源笔记原生配置包含相同参数
      (apiSwitchCore as any).siyuanAdapter.fetchSystemAiConfig = async () => ({
        providers: [
          {
            id: "p_deepseek",
            displayName: "DeepSeek",
            baseURL: "https://api.deepseek.com/v1",
            apiKey: "sk-sync-key",
            protocol: "openai",
            models: [{ id: "deepseek-chat", name: "deepseek-chat" }],
          },
        ],
        editing: {
          modelId: "deepseek-chat",
          temperature: 0.7,
          maxCompletionTokens: 2000,
        },
      });

      const res = await apiSwitchCore.syncFromSiyuan();

      // 3. 校验：复用 1 个已有配置，新增 0 个配置
      expect(res.reusedProfilesCount).toBe(1);
      expect(res.createdProfilesCount).toBe(0);
      expect(apiSwitchCore.getProfiles()).toHaveLength(1);
      expect(apiSwitchCore.getProfiles()[0].id).toBe(existingProfile.id);
      expect((apiSwitchCore as any).bindingManager.getBoundProfileId("siyuan_builtin_editing")).toBe(existingProfile.id);
    });

    it("提供商存在相同 baseUrl 和 apiKey 时合并更新，不生成重复提供商", async () => {
      // 已有手动配置的提供商（但 ID 不同）
      await apiSwitchCore.addProvider({
        id: "prov_custom_ds",
        displayName: "自定义 DeepSeek",
        baseUrl: "https://api.deepseek.com/v1",
        apiKey: "sk-sync-key-123",
        protocol: "openai",
        models: [{ id: "deepseek-chat", name: "deepseek-chat" }],
      });

      // 思源笔记同步过来的提供商带有新模型
      (apiSwitchCore as any).siyuanAdapter.fetchSystemAiConfig = async () => ({
        providers: [
          {
            id: "prov_siyuan_ds",
            displayName: "思源 DeepSeek",
            baseURL: "https://api.deepseek.com/v1",
            apiKey: "sk-sync-key-123",
            protocol: "openai",
            models: [
              { id: "deepseek-chat", name: "deepseek-chat" },
              { id: "deepseek-reasoner", name: "deepseek-reasoner" },
            ],
          },
        ],
      });

      const res = await apiSwitchCore.syncFromSiyuan();
      expect(res.providersCount).toBe(1);
      const provs = apiSwitchCore.getProviders();
      expect(provs).toHaveLength(1);
      // 成功合并新模型
      expect(provs[0].models).toHaveLength(2);
    });
  });
});
