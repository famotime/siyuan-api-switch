import { describe, it, expect, beforeEach } from "vitest";
import { apiSwitchCore } from "@/services/api-switch-core";
import { extractSiyuanAiSettings } from "@/services/siyuan-adapter";
import { decryptSiyuanApiKey, extractApiKey } from "@/utils/siyuan-crypto";

describe("Jev 决策模型与思源内置 AI 配置读取/导入测试", () => {
  beforeEach(() => {
    (apiSwitchCore as any).providers = [];
    (apiSwitchCore as any).profiles = [];
    (apiSwitchCore as any).bindings = {};
  });

  describe("API Key 健壮提取与思源 AES 密文解密", () => {
    it("正确解密思源笔记原生 AES CBC 加密格式的 API Key", () => {
      // 对应明文为 "test-decision-key" 的思源 AES 密文
      const cipherHex = "fa6379474001e36a59db8f8ee022dca9fd572e214dba3c69571d2ca172f57bc2c8c892c924fd4ef449ebc97df426ca57";
      const decrypted = decryptSiyuanApiKey(cipherHex);
      expect(decrypted).toBe("test-decision-key");
    });

    it("extractApiKey 支持识别 APIKey, api_key, key, token 等多种命名，并自动解密", () => {
      expect(extractApiKey({ APIKey: "sk-upper-case" })).toBe("sk-upper-case");
      expect(extractApiKey({ api_key: "sk-snake-case" })).toBe("sk-snake-case");
      expect(extractApiKey({ key: "sk-just-key" })).toBe("sk-just-key");
      expect(extractApiKey({ token: "sk-token" })).toBe("sk-token");

      const encrypted = "fa6379474001e36a59db8f8ee022dca9fd572e214dba3c69571d2ca172f57bc2c8c892c924fd4ef449ebc97df426ca57";
      expect(extractApiKey({ APIKey: encrypted })).toBe("test-decision-key");
    });
  });

  describe("extractSiyuanAiSettings 对 Jev 决策模型的支持", () => {
    it("未填 endpoint 时默认补全官方端点与 jev-latest 模型", () => {
      const raw = {
        decision: {
          enabled: true,
          apiKey: "my-jev-api-key",
          timeout: 30,
        },
      };

      const extracted = extractSiyuanAiSettings(raw);
      expect(extracted.decision).toBeDefined();
      expect(extracted.decision?.baseUrl).toBe("https://api.typesafe.ai/v1/systemone");
      expect(extracted.decision?.model).toBe("jev-latest");
      expect(extracted.decision?.apiKey).toBe("my-jev-api-key");
      expect(extracted.decision?.isDecisionModel).toBe(true);
    });

    it("支持解包包含 { ai: ... } 的思源全局配置对象", () => {
      const globalConf = {
        ai: {
          decision: {
            APIKey: "sk-global-jev-key",
            name: "jev-custom-2026",
            endpoint: "https://typesafe.example.com",
            timeout: 45,
          },
        },
      };

      const extracted = extractSiyuanAiSettings(globalConf);
      expect(extracted.decision).toEqual({
        provider: "custom",
        baseUrl: "https://typesafe.example.com",
        apiKey: "sk-global-jev-key",
        model: "jev-custom-2026",
        requestTimeoutSeconds: 45,
        isDecisionModel: true,
      });
    });
  });

  describe("importSiyuanAiJson 原生导入决策模型与场景隔离", () => {
    it("导入思源原生包含 Jev 决策模型的 JSON，无论有无显式 endpoint 均成功识别 apiKey 并创建决策模型 Profile", async () => {
      const jsonStr = JSON.stringify({
        decision: {
          APIKey: "jev-secret-999",
          name: "jev-latest",
          timeout: 25,
        },
      });

      const res = await apiSwitchCore.importSiyuanAiJson(jsonStr);
      expect(res.profilesCount).toBe(1);

      const profiles = apiSwitchCore.getProfiles();
      const decProfile = profiles.find((p) => p.isDecisionModel);
      expect(decProfile).toBeDefined();
      expect(decProfile?.name).toBe("导入-思源决策模型");
      expect(decProfile?.apiKey).toBe("jev-secret-999");
      expect(decProfile?.baseUrl).toBe("https://api.typesafe.ai/v1/systemone");
      expect(decProfile?.model).toBe("jev-latest");
      expect(decProfile?.requestTimeoutSeconds).toBe(25);
      expect((apiSwitchCore as any).bindingManager.getBoundProfileId("siyuan_builtin_decision")).toBe(decProfile?.id);
    });

    it("直接导入思源 conf.json 格式时，解密 apiKey 并同时导入编辑器与智能体专属 Profile", async () => {
      const encryptedKey = "fa6379474001e36a59db8f8ee022dca9fd572e214dba3c69571d2ca172f57bc2c8c892c924fd4ef449ebc97df426ca57";
      const confJson = JSON.stringify({
        ai: {
          providers: [
            {
              id: "p_common",
              displayName: "SiliconFlow",
              baseURL: "https://api.siliconflow.cn/v1",
              apiKey: "sk-silicon",
              models: [{ id: "deepseek-ai/DeepSeek-V3", name: "deepseek-ai/DeepSeek-V3" }],
            },
          ],
          editing: {
            modelId: "deepseek-ai/DeepSeek-V3",
            temperature: 0.6,
            maxCompletionTokens: 2000,
            maxHistoryMessages: 8,
          },
          agent: {
            modelId: "deepseek-ai/DeepSeek-V3",
            temperature: 0.9,
            maxCompletionTokens: 4000,
            maxToolCallRounds: 50,
            sessionTimeout: 1500,
          },
          decision: {
            APIKey: encryptedKey,
            name: "jev-latest",
          },
        },
      });

      const res = await apiSwitchCore.importSiyuanAiJson(confJson);
      expect(res.providersCount).toBe(1);
      expect(res.profilesCount).toBe(3); // 编辑器 + 智能体 + 决策模型

      const profiles = apiSwitchCore.getProfiles();
      const editProf = profiles.find((p) => p.name === "导入-思源编辑器");
      const agentProf = profiles.find((p) => p.name === "导入-思源智能体");
      const decProf = profiles.find((p) => p.isDecisionModel);

      expect(editProf).toBeDefined();
      expect(agentProf).toBeDefined();
      expect(decProf).toBeDefined();

      // 验证智能体与编辑器互不吞并，各自拥有独立 Profile
      expect(editProf?.id).not.toBe(agentProf?.id);
      expect(editProf?.maxHistoryMessages).toBe(8);
      expect(agentProf?.maxToolCallRounds).toBe(50);
      expect(agentProf?.sessionTimeout).toBe(1500);

      // 验证决策模型 apiKey 成功解密
      expect(decProf?.apiKey).toBe("test-decision-key");
    });
  });

  describe("从思源读取 (syncFromSiyuan) 完整体现编辑器、智能体、Jev 决策模型", () => {
    it("即使编辑器与智能体使用相同模型，读取后也必须分别在 API 配置文件栏建立并体现独立 Profile", async () => {
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
          temperature: 0.5,
          maxCompletionTokens: 2048,
          maxHistoryMessages: 10,
        },
        agent: {
          modelId: "deepseek-chat", // 相同模型
          temperature: 0.85,
          maxCompletionTokens: 4096,
          maxToolCallRounds: 64,
          sessionTimeout: 1800,
          streamIdleTimeout: 120,
        },
        decision: {
          enabled: true,
          apiKey: "jev-api-key-2026",
          name: "jev-latest",
          timeout: 30,
        },
      });

      const res = await apiSwitchCore.syncFromSiyuan();
      expect(res.providersCount).toBe(1);
      expect(res.createdProfilesCount).toBe(3); // 必须创建全部 3 个独立场景配置

      const profiles = apiSwitchCore.getProfiles();
      const editProf = profiles.find((p) => p.name === "思源-编辑器");
      const agentProf = profiles.find((p) => p.name === "思源-智能体");
      const decProf = profiles.find((p) => p.name === "思源-决策模型");

      expect(editProf).toBeDefined();
      expect(agentProf).toBeDefined();
      expect(decProf).toBeDefined();

      // 验证编辑器和智能体互相独立
      expect(editProf?.id).not.toBe(agentProf?.id);

      // 验证编辑器参数准确体现
      expect(editProf?.temperature).toBe(0.5);
      expect(editProf?.maxTokens).toBe(2048);
      expect(editProf?.maxHistoryMessages).toBe(10);

      // 验证智能体参数准确体现
      expect(agentProf?.temperature).toBe(0.85);
      expect(agentProf?.maxTokens).toBe(4096);
      expect(agentProf?.maxToolCallRounds).toBe(64);
      expect(agentProf?.sessionTimeout).toBe(1800);
      expect(agentProf?.streamIdleTimeout).toBe(120);

      // 验证决策模型准确体现
      expect(decProf?.isDecisionModel).toBe(true);
      expect(decProf?.apiKey).toBe("jev-api-key-2026");
      expect(decProf?.model).toBe("jev-latest");
      expect(decProf?.baseUrl).toBe("https://api.typesafe.ai/v1/systemone");

      // 验证接管绑定
      expect((apiSwitchCore as any).bindingManager.getBoundProfileId("siyuan_builtin_editing")).toBe(editProf?.id);
      expect((apiSwitchCore as any).bindingManager.getBoundProfileId("siyuan_builtin_agent")).toBe(agentProf?.id);
      expect((apiSwitchCore as any).bindingManager.getBoundProfileId("siyuan_builtin_decision")).toBe(decProf?.id);
    });

    it("再次从思源读取时，更新思源编辑器与智能体的最新参数到已有 Profile 中", async () => {
      // 第一次读取
      (apiSwitchCore as any).siyuanAdapter.fetchSystemAiConfig = async () => ({
        providers: [{ id: "p1", baseURL: "https://api.test/v1", apiKey: "k1", models: [{ id: "m1", name: "m1" }] }],
        editing: { modelId: "m1", temperature: 0.5, maxCompletionTokens: 1000, maxHistoryMessages: 5 },
      });
      await apiSwitchCore.syncFromSiyuan();

      // 用户在思源笔记中修改了参数，再次读取
      (apiSwitchCore as any).siyuanAdapter.fetchSystemAiConfig = async () => ({
        providers: [{ id: "p1", baseURL: "https://api.test/v1", apiKey: "k1", models: [{ id: "m1", name: "m1" }] }],
        editing: { modelId: "m1", temperature: 0.9, maxCompletionTokens: 3000, maxHistoryMessages: 15 },
      });
      const res2 = await apiSwitchCore.syncFromSiyuan();

      expect(res2.createdProfilesCount).toBe(0);
      expect(res2.reusedProfilesCount).toBe(1);

      const editProf = apiSwitchCore.getProfiles().find((p) => p.name === "思源-编辑器");
      expect(editProf?.temperature).toBe(0.9);
      expect(editProf?.maxTokens).toBe(3000);
      expect(editProf?.maxHistoryMessages).toBe(15);
    });
  });
});
