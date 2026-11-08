import { describe, it, expect, beforeEach } from "vitest";
import { apiSwitchCore } from "@/services/api-switch-core";
import { ProviderStore } from "@/services/provider-store";
import { ApiProvider } from "@/types";

/**
 * 提供商判重语义统一测试：
 * id 精确匹配 → displayName 忽略大小写比较 → baseUrl+apiKey 且协议兼容。
 * 该口径同时约束 ProviderStore 直查、思源同步、ai.json 导入与备份导入四条路径。
 */
describe("提供商判重语义统一（id → displayName 忽略大小写 → 连接参数+协议兼容）", () => {
  describe("ProviderStore.isProviderMatching 单元语义", () => {
    const store = new ProviderStore(async () => {});
    const existing: ApiProvider = {
      id: "prov_local",
      name: "openai",
      displayName: "SiliconFlow 硅基流动",
      protocol: "openai",
      baseUrl: "https://api.siliconflow.cn/v1",
      apiKey: "sk-local",
      models: [],
    } as ApiProvider;

    it("规则一：id 精确匹配优先", () => {
      expect(store.isProviderMatching(existing, { id: "prov_local" })).toBe(true);
    });

    it("规则二：displayName 忽略大小写与首尾空白", () => {
      expect(store.isProviderMatching(existing, { displayName: "siliconflow 硅基流动" })).toBe(true);
      expect(store.isProviderMatching(existing, { displayName: "  SILICONFLOW 硅基流动  " })).toBe(true);
      // 仅大小写不同也算匹配；完全不同则不匹配
      expect(store.isProviderMatching(existing, { displayName: "SiliconFlow" })).toBe(false);
    });

    it("规则三：baseUrl+apiKey 一致且协议兼容时匹配", () => {
      expect(
        store.isProviderMatching(existing, {
          displayName: "别的名字",
          baseUrl: "https://api.siliconflow.cn/v1/",
          apiKey: "sk-local",
          protocol: "openai-responses",
        })
      ).toBe(true);
    });

    it("规则三补充：baseUrl+apiKey 一致但协议不兼容（如 anthropic-messages vs openai）视为不同提供商", () => {
      expect(
        store.isProviderMatching(existing, {
          displayName: "别的名字",
          baseUrl: "https://api.siliconflow.cn/v1",
          apiKey: "sk-local",
          protocol: "anthropic-messages",
        })
      ).toBe(false);
    });
  });

  describe("ai.json 导入路径：displayName 忽略大小写判重", () => {
    beforeEach(() => {
      (apiSwitchCore as any).providerStore.setProviders([]);
      (apiSwitchCore as any).profileStore.setProfiles([]);
      (apiSwitchCore as any).bindingManager.setBindings({});
    });

    it("仅大小写不同的 displayName 导入时合并进已有提供商而非重复新建", async () => {
      (apiSwitchCore as any).providerStore.setProviders([
        {
          id: "prov_sf",
          name: "siliconflow",
          displayName: "SiliconFlow",
          protocol: "openai",
          baseUrl: "https://api.siliconflow.cn/v1",
          apiKey: "sk-a",
          models: [{ id: "deepseek-chat", name: "deepseek-chat", displayName: "deepseek-chat", enabled: true }],
        } as ApiProvider,
      ]);

      const jsonStr = JSON.stringify({
        providers: [
          {
            id: "ext_sf",
            displayName: "siliconflow",
            baseURL: "https://other.example.com/v1",
            apiKey: "sk-b",
            models: [{ id: "Qwen/Qwen3", name: "Qwen/Qwen3" }],
          },
        ],
      });

      await apiSwitchCore.importSiyuanAiJson(jsonStr);

      const providers = apiSwitchCore.getProviders();
      expect(providers).toHaveLength(1);
      expect(providers[0].id).toBe("prov_sf");
      expect(providers[0].displayName).toBe("SiliconFlow");
      // 模型池增量合并
      expect(providers[0].models.some((m) => m.id === "Qwen/Qwen3")).toBe(true);
      expect(providers[0].models.some((m) => m.id === "deepseek-chat")).toBe(true);
    });
  });

  describe("备份导入路径：判重语义与统一口径对齐", () => {
    beforeEach(() => {
      (apiSwitchCore as any).providerStore.setProviders([]);
      (apiSwitchCore as any).profileStore.setProfiles([]);
      (apiSwitchCore as any).bindingManager.setBindings({});
    });

    const makeBackup = (provider: Partial<ApiProvider>) =>
      JSON.stringify({
        version: "1.0",
        exportTime: "2026-11-08T00:00:00.000Z",
        providers: [provider],
        profiles: [],
      });

    it("displayName 仅大小写不同（连接参数不同）判定为重复并跳过", async () => {
      (apiSwitchCore as any).providerStore.setProviders([
        {
          id: "prov_ds",
          name: "deepseek",
          displayName: "DeepSeek",
          protocol: "openai",
          baseUrl: "https://api.deepseek.com/v1",
          apiKey: "sk-a",
          models: [],
        } as ApiProvider,
      ]);

      const res = await apiSwitchCore.importBackupConfig(
        makeBackup({
          id: "ext_ds",
          displayName: "deepseek",
          protocol: "openai",
          baseUrl: "https://other.example.com/v1",
          apiKey: "sk-b",
          models: [],
        })
      );
      expect(res.providersSkipped).toBe(1);
      expect(apiSwitchCore.getProviders()).toHaveLength(1);
    });

    it("baseUrl+apiKey 相同但协议不兼容时判定为不同提供商（不再仅凭连接参数判重）", async () => {
      (apiSwitchCore as any).providerStore.setProviders([
        {
          id: "prov_x",
          name: "openai",
          displayName: "My Relay",
          protocol: "openai",
          baseUrl: "https://relay.example.com/v1",
          apiKey: "sk-x",
          models: [],
        } as ApiProvider,
      ]);

      const res = await apiSwitchCore.importBackupConfig(
        makeBackup({
          id: "ext_x",
          displayName: "My Relay Anthropic Line",
          protocol: "anthropic-messages",
          baseUrl: "https://relay.example.com/v1",
          apiKey: "sk-x",
          models: [],
        })
      );
      expect(res.providersAdded).toBe(1);
      expect(apiSwitchCore.getProviders()).toHaveLength(2);
    });

    it("baseUrl+apiKey 相同且协议兼容时仍判定为重复并跳过", async () => {
      (apiSwitchCore as any).providerStore.setProviders([
        {
          id: "prov_y",
          name: "openai",
          displayName: "My Relay",
          protocol: "openai",
          baseUrl: "https://relay.example.com/v1",
          apiKey: "sk-y",
          models: [],
        } as ApiProvider,
      ]);

      const res = await apiSwitchCore.importBackupConfig(
        makeBackup({
          id: "ext_y",
          displayName: "Another Name",
          protocol: "openai-responses",
          baseUrl: "https://relay.example.com/v1",
          apiKey: "sk-y",
          models: [],
        })
      );
      expect(res.providersSkipped).toBe(1);
      expect(apiSwitchCore.getProviders()).toHaveLength(1);
    });
  });
});
