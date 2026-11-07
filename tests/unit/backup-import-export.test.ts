import { describe, it, expect, beforeEach } from "vitest";
import { apiSwitchCore, ApiProfile, ImportBackupResult, BackupConfigFile } from "@/services/api-switch-core";
import { ApiProvider } from "@/types";

describe("全量配置导入导出与去重机制 (backup-import-export)", () => {
  beforeEach(() => {
    (apiSwitchCore as any).providerStore.setProviders([]);
    (apiSwitchCore as any).profileStore.setProfiles([]);
    (apiSwitchCore as any).bindingManager.setBindings({});
    (apiSwitchCore as any).bindingManager.registrations.clear();
  });

  describe("exportBackupConfig 全量导出", () => {
    it("导出包含规范结构（version, exportTime, providers, profiles）且不含 bindings 关系", async () => {
      const prov: ApiProvider = {
        id: "p_deepseek",
        displayName: "DeepSeek 官方",
        baseUrl: "https://api.deepseek.com",
        apiKey: "sk-ds-123456",
        protocol: "openai",
        requestTimeout: 30,
        headers: {},
        models: [
          { id: "deepseek-chat", name: "deepseek-chat", displayName: "deepseek-chat", enabled: true },
        ],
      };

      const prof: ApiProfile = {
        id: "prof_ds_chat",
        name: "DeepSeek 对话",
        providerId: "p_deepseek",
        provider: "deepseek",
        model: "deepseek-chat",
        temperature: 0.7,
        maxTokens: 4096,
        baseUrl: "",
        apiKey: "",
      };

      (apiSwitchCore as any).providerStore.setProviders([prov]);
      (apiSwitchCore as any).profileStore.setProfiles([prof]);
      (apiSwitchCore as any).bindingManager.setBinding("siyuan_builtin_editing", prof.id);

      const jsonStr = apiSwitchCore.exportBackupConfig();
      const parsed: BackupConfigFile = JSON.parse(jsonStr);

      expect(parsed.version).toBe("1.0");
      expect(parsed.exportTime).toBeDefined();
      expect(parsed.providers).toHaveLength(1);
      expect(parsed.providers[0].displayName).toBe("DeepSeek 官方");
      expect(parsed.profiles).toHaveLength(1);
      expect(parsed.profiles[0].name).toBe("DeepSeek 对话");

      // 验证 bindings 关系绝不导出（纯净配置库）
      expect((parsed as any).bindings).toBeUndefined();
      expect((parsed as any)._siyuanApiSwitch).toBeUndefined();
    });

    it("导出时清洗提供商 displayName 中的脏后缀", () => {
      const prov: ApiProvider = {
        id: "p_dirty",
        displayName: "OpenAI-gpt-4o",
        baseUrl: "https://api.openai.com/v1",
        apiKey: "sk-openai",
        protocol: "openai",
        models: [{ id: "gpt-4o", name: "gpt-4o" }],
      };
      (apiSwitchCore as any).providerStore.setProviders([prov]);

      const jsonStr = apiSwitchCore.exportBackupConfig();
      const parsed = JSON.parse(jsonStr);
      expect(parsed.providers[0].displayName).toBe("OpenAI");
    });
  });

  describe("importBackupConfig 智能去重导入", () => {
    it("全新导入：当本地为空时，全量写入提供商与配置", async () => {
      const backupJson = JSON.stringify({
        version: "1.0",
        providers: [
          {
            id: "p_1",
            displayName: "SiliconFlow",
            baseUrl: "https://api.siliconflow.cn/v1",
            apiKey: "sk-sf-123",
            protocol: "openai",
            models: [{ id: "deepseek-ai/DeepSeek-V3", name: "deepseek-ai/DeepSeek-V3" }],
          },
        ],
        profiles: [
          {
            id: "prof_1",
            name: "硅基流动-V3",
            providerId: "p_1",
            provider: "siliconflow",
            model: "deepseek-ai/DeepSeek-V3",
          },
        ],
      });

      const res: ImportBackupResult = await apiSwitchCore.importBackupConfig(backupJson);
      expect(res.providersAdded).toBe(1);
      expect(res.providersSkipped).toBe(0);
      expect(res.profilesAdded).toBe(1);
      expect(res.profilesSkipped).toBe(0);

      expect(apiSwitchCore.getProviders()).toHaveLength(1);
      expect(apiSwitchCore.getProfiles()).toHaveLength(1);
    });

    it("完全重复导入：重复导入相同配置时，全部被智能跳过，未产生冗余项", async () => {
      const backupJson = JSON.stringify({
        version: "1.0",
        providers: [
          {
            id: "p_1",
            displayName: "DeepSeek",
            baseUrl: "https://api.deepseek.com",
            apiKey: "sk-ds-1",
            protocol: "openai",
            models: [{ id: "deepseek-chat", name: "deepseek-chat" }],
          },
        ],
        profiles: [
          {
            id: "prof_1",
            name: "DeepSeek-Chat",
            providerId: "p_1",
            provider: "deepseek",
            model: "deepseek-chat",
          },
        ],
      });

      // 第一次导入
      const firstRes = await apiSwitchCore.importBackupConfig(backupJson);
      expect(firstRes.providersAdded).toBe(1);
      expect(firstRes.profilesAdded).toBe(1);

      // 第二次重复导入相同内容
      const secondRes = await apiSwitchCore.importBackupConfig(backupJson);
      expect(secondRes.providersAdded).toBe(0);
      expect(secondRes.providersSkipped).toBe(1);
      expect(secondRes.profilesAdded).toBe(0);
      expect(secondRes.profilesSkipped).toBe(1);

      // 本地总数依然保持 1
      expect(apiSwitchCore.getProviders()).toHaveLength(1);
      expect(apiSwitchCore.getProfiles()).toHaveLength(1);
    });

    it("提供商去重：displayName 相同判定为重复，增量合并新模型至模型池", async () => {
      // 本地已有该提供商，只有 gpt-4o 模型
      (apiSwitchCore as any).providerStore.setProviders([
        {
          id: "p_local_openai",
          displayName: "OpenAI 官方",
          baseUrl: "https://api.openai.com/v1",
          apiKey: "sk-local-key",
          protocol: "openai",
          models: [{ id: "gpt-4o", name: "gpt-4o", displayName: "gpt-4o" }],
        },
      ]);

      // 导入包含相同 displayName，但模型池中多了 gpt-4o-mini 和 o1
      const importJson = JSON.stringify({
        providers: [
          {
            id: "p_imported_openai",
            displayName: "OpenAI 官方",
            baseUrl: "https://api.openai.com/v1",
            apiKey: "sk-other-key",
            protocol: "openai",
            models: [
              { id: "gpt-4o", name: "gpt-4o" },
              { id: "gpt-4o-mini", name: "gpt-4o-mini" },
              { id: "o1", name: "o1" },
            ],
          },
        ],
        profiles: [],
      });

      const res = await apiSwitchCore.importBackupConfig(importJson);
      expect(res.providersAdded).toBe(0);
      expect(res.providersSkipped).toBe(1);
      expect(res.modelsMerged).toBe(2); // gpt-4o-mini 与 o1 被增量合并

      const prov = apiSwitchCore.getProviders()[0];
      expect(prov.models).toHaveLength(3);
      expect(prov.models.map((m) => m.name)).toEqual(["gpt-4o", "gpt-4o-mini", "o1"]);
    });

    it("提供商去重：BaseURL 与 Key 相同（即使 displayName 不同）判定为重复并跳过", async () => {
      (apiSwitchCore as any).providerStore.setProviders([
        {
          id: "p_ds_existing",
          displayName: "我的 DeepSeek",
          baseUrl: "https://api.deepseek.com",
          apiKey: "sk-ds-secret",
          protocol: "openai",
          models: [{ id: "deepseek-chat", name: "deepseek-chat" }],
        },
      ]);

      const importJson = JSON.stringify({
        providers: [
          {
            id: "p_ds_imported",
            displayName: "DeepSeek 官方备份", // 名称不同
            baseUrl: "https://api.deepseek.com/", // 归一化后一致
            apiKey: "sk-ds-secret", // Key 一致
            protocol: "openai",
            models: [{ id: "deepseek-chat", name: "deepseek-chat" }],
          },
        ],
        profiles: [],
      });

      const res = await apiSwitchCore.importBackupConfig(importJson);
      expect(res.providersAdded).toBe(0);
      expect(res.providersSkipped).toBe(1);
      expect(apiSwitchCore.getProviders()).toHaveLength(1);
    });

    it("Profile 去重：同名配置判定为重复，跳过新建", async () => {
      (apiSwitchCore as any).profileStore.setProfiles([
        {
          id: "prof_existing",
          name: "翻译主力模型",
          provider: "openai",
          baseUrl: "https://api.openai.com/v1",
          apiKey: "sk-1",
          model: "gpt-4o",
        },
      ]);

      const importJson = JSON.stringify({
        profiles: [
          {
            id: "prof_imported",
            name: "翻译主力模型", // 同名
            provider: "openai",
            baseUrl: "https://api.openai.com/v1",
            apiKey: "sk-2",
            model: "gpt-4o-mini",
          },
        ],
      });

      const res = await apiSwitchCore.importBackupConfig(importJson);
      expect(res.profilesAdded).toBe(0);
      expect(res.profilesSkipped).toBe(1);
      expect(apiSwitchCore.getProfiles()).toHaveLength(1);
      expect(apiSwitchCore.getProfiles()[0].model).toBe("gpt-4o"); // 依然是原配置
    });

    it("Profile 去重：参数一致（模型+提供商核心配置匹配）判定为重复并跳过", async () => {
      (apiSwitchCore as any).providerStore.setProviders([
        {
          id: "p_prov_1",
          displayName: "OpenAI",
          baseUrl: "https://api.openai.com/v1",
          apiKey: "sk-openai",
          protocol: "openai",
          models: [{ id: "gpt-4o", name: "gpt-4o" }],
        },
      ]);
      (apiSwitchCore as any).profileStore.setProfiles([
        {
          id: "prof_existing",
          name: "GPT-4o 默认配置",
          providerId: "p_prov_1",
          provider: "openai",
          model: "gpt-4o",
          temperature: 0.7,
          maxTokens: 4096,
        },
      ]);

      // 导入一项名称不同（如 "导入的 GPT-4o"），但关联相同提供商且模型+主要参数完全一致
      const importJson = JSON.stringify({
        profiles: [
          {
            id: "prof_import_alias",
            name: "导入的 GPT-4o",
            providerId: "p_prov_1",
            provider: "openai",
            model: "gpt-4o",
            temperature: 0.7,
            maxTokens: 4096,
          },
        ],
      });

      const res = await apiSwitchCore.importBackupConfig(importJson);
      expect(res.profilesAdded).toBe(0);
      expect(res.profilesSkipped).toBe(1);
      expect(apiSwitchCore.getProfiles()).toHaveLength(1);
    });

    it("关联重映射：导入新 Profile 关联的 Provider 若被判定重复跳过，其 providerId 自动重新关联到本地已有 Provider", async () => {
      // 本地已有提供商，本地 ID 为 p_local_123
      (apiSwitchCore as any).providerStore.setProviders([
        {
          id: "p_local_123",
          displayName: "DeepSeek",
          baseUrl: "https://api.deepseek.com",
          apiKey: "sk-ds-key",
          protocol: "openai",
          models: [{ id: "deepseek-chat", name: "deepseek-chat" }],
        },
      ]);

      // 导入文件中：Provider ID 为 p_remote_999（判定重复跳过），新 Profile 关联了 p_remote_999
      const importJson = JSON.stringify({
        providers: [
          {
            id: "p_remote_999",
            displayName: "DeepSeek",
            baseUrl: "https://api.deepseek.com",
            apiKey: "sk-ds-key",
            protocol: "openai",
            models: [
              { id: "deepseek-chat", name: "deepseek-chat" },
              { id: "deepseek-reasoner", name: "deepseek-reasoner" },
            ],
          },
        ],
        profiles: [
          {
            id: "prof_new_reasoner",
            name: "DeepSeek R1 深度思考",
            providerId: "p_remote_999",
            provider: "deepseek",
            model: "deepseek-reasoner",
          },
        ],
      });

      const res = await apiSwitchCore.importBackupConfig(importJson);
      expect(res.providersAdded).toBe(0);
      expect(res.providersSkipped).toBe(1);
      expect(res.profilesAdded).toBe(1);
      expect(res.profilesSkipped).toBe(0);

      // 验证新 Profile 的 providerId 成功重映射到本地提供商 p_local_123
      const importedProfile = apiSwitchCore.getProfiles().find((p) => p.name === "DeepSeek R1 深度思考");
      expect(importedProfile).toBeDefined();
      expect(importedProfile?.providerId).toBe("p_local_123");
    });

    it("多源向下兼容性：支持思源官方原生 ai.json 自动派生 Profiles 并去重", async () => {
      const nativeSiyuanJson = JSON.stringify({
        providers: [
          {
            id: "prov_siyuan",
            displayName: "思源原生",
            baseURL: "https://api.native.com/v1",
            apiKey: "sk-native",
            protocol: "openai",
            models: [{ id: "native-model", name: "native-model" }],
          },
        ],
        editing: {
          modelId: "native-model",
          temperature: 0.7,
        },
        decision: {
          endpoint: "https://api.typesafe.ai/v1/systemone",
          apiKey: "sk-jev",
          name: "jev-latest",
        },
      });

      const res = await apiSwitchCore.importBackupConfig(nativeSiyuanJson);
      expect(res.providersAdded).toBe(1);
      expect(res.profilesAdded).toBe(2); // 编辑器 + 决策模型

      const profiles = apiSwitchCore.getProfiles();
      expect(profiles.some((p) => p.name === "思源-编辑器")).toBe(true);
      expect(profiles.some((p) => p.name === "思源-决策模型")).toBe(true);
    });

    it("多源向下兼容性：支持旧版纯 profile 数组格式的 JSON", async () => {
      const legacyArrayJson = JSON.stringify([
        {
          id: "p_arr_1",
          name: "纯数组配置",
          provider: "openai",
          baseUrl: "https://api.arr.com/v1",
          apiKey: "sk-arr",
          model: "gpt-4",
        },
      ]);

      const res = await apiSwitchCore.importBackupConfig(legacyArrayJson);
      expect(res.profilesAdded).toBe(1);
      expect(apiSwitchCore.getProfiles()[0].name).toBe("纯数组配置");
    });

    it("无效格式校验：非合法 JSON 时抛出错误", async () => {
      await expect(apiSwitchCore.importBackupConfig("not-a-valid-json")).rejects.toThrow();
    });
  });

  describe("界面按钮呈现与布局 (UI in App.vue)", () => {
    it("右上角操作组正确包含「导入」「导出」「读取思源配置」按钮，左侧栏已清理收口旧图标", async () => {
      const { createApp, nextTick } = await import("vue");
      const App = (await import("@/App.vue")).default;

      const container = document.createElement("div");
      document.body.appendChild(container);

      const app = createApp(App);
      app.mount(container);
      await nextTick();

      // 模拟打开配置窗口
      if (window._sy_api_switch?.openSetting) {
        window._sy_api_switch.openSetting();
      }
      await nextTick();

      // 验证右上角 header-sync-group
      const syncGroup = container.querySelector(".dialog-header .header-sync-group");
      expect(syncGroup).not.toBeNull();

      const buttons = syncGroup?.querySelectorAll("button.header-sync-btn");
      expect(buttons?.length).toBe(3);

      const btnTexts = Array.from(buttons || []).map((b) => b.textContent?.trim());
      expect(btnTexts).toContain("导入");
      expect(btnTexts).toContain("导出");
      expect(btnTexts).toContain("读取思源配置");

      // 验证隐藏的 input file
      const fileInput = syncGroup?.querySelector('input[type="file"]') as HTMLInputElement;
      expect(fileInput).not.toBeNull();
      expect(fileInput.accept).toBe(".json");

      // 验证左侧边栏 Profiles 标题旁仅有 1 个「添加新配置」按钮，旧的导入导出已收口移除
      const sidebarSections = container.querySelectorAll(".sidebar-section");
      const profileSection = Array.from(sidebarSections).find((sec) =>
        sec.querySelector(".section-title")?.textContent?.includes("API 配置文件 (Profiles)")
      );
      expect(profileSection).toBeDefined();

      const profileTitleActions = profileSection?.querySelectorAll(".title-actions button");
      expect(profileTitleActions?.length).toBe(1);
      expect(profileTitleActions?.[0].getAttribute("data-tooltip")).toBe("添加新配置");

      app.unmount();
      container.remove();
    });
  });
});
