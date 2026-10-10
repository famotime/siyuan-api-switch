import { describe, it, expect, beforeEach } from "vitest";
import { apiSwitchCore, ApiProfile } from "@/services/api-switch-core";
import { ApiProvider } from "@/types";

describe("思源原生 ai.json 双向序列化与兼容导入导出", () => {
  beforeEach(() => {
    (apiSwitchCore as any).providers = [];
    (apiSwitchCore as any).profiles = [];
    (apiSwitchCore as any).bindings = {};
  });

  it("exportSiyuanAiJson 导出符合思源原生架构且携带 _siyuanApiSwitch 扩展的 JSON", () => {
    const provider: ApiProvider = {
      id: "p_test",
      displayName: "Test Provider",
      baseUrl: "https://test.ai/v1",
      apiKey: "sk-test",
      protocol: "openai",
      requestTimeout: 30,
      headers: { "X-Test": "1" },
      models: [{ id: "m-1", name: "m-1", displayName: "Model 1" }],
    };

    const profile: ApiProfile = {
      id: "prof_editing",
      name: "思源-编辑器配置",
      providerId: "p_test",
      provider: "openai",
      baseUrl: "",
      apiKey: "",
      model: "m-1",
      maxHistoryMessages: 9,
      temperature: 0.6,
      maxTokens: 3000,
    };

    (apiSwitchCore as any).providers = [provider];
    (apiSwitchCore as any).profiles = [profile];
    (apiSwitchCore as any).bindings = {
      siyuan_builtin_editing: "prof_editing",
    };

    const exportedStr = apiSwitchCore.exportSiyuanAiJson();
    const parsed = JSON.parse(exportedStr);

    // 验证原生节点
    expect(parsed.providers).toHaveLength(1);
    expect(parsed.providers[0].id).toBe("p_test");
    expect(parsed.providers[0].baseURL).toBe("https://test.ai/v1");

    expect(parsed.editing).toEqual({
      modelId: "m-1",
      maxHistoryMessages: 9,
      temperature: 0.6,
      maxCompletionTokens: 3000,
    });

    // 验证插件私有扩展数据
    expect(parsed._siyuanApiSwitch).toBeDefined();
    expect(parsed._siyuanApiSwitch.profiles).toHaveLength(1);
    expect(parsed._siyuanApiSwitch.bindings.siyuan_builtin_editing).toBe("prof_editing");
  });

  it("importSiyuanAiJson 导入携带 _siyuanApiSwitch 的完整数据时能 100% 还原", async () => {
    const fullJson = JSON.stringify({
      providers: [
        {
          id: "p_import_1",
          displayName: "Imported Prov",
          baseURL: "https://import.ai/v1",
          apiKey: "sk-import",
          protocol: "anthropic",
          requestTimeout: 50,
          models: [{ id: "claude-3-5-sonnet", name: "claude-3-5-sonnet" }],
        },
      ],
      _siyuanApiSwitch: {
        profiles: [
          {
            id: "prof_restored",
            name: "恢复的 Profile",
            providerId: "p_import_1",
            provider: "anthropic",
            model: "claude-3-5-sonnet",
          },
        ],
        bindings: {
          plugin_muse: "prof_restored",
        },
      },
    });

    const res = await apiSwitchCore.importSiyuanAiJson(fullJson);
    expect(res.providersCount).toBe(1);
    expect(res.profilesCount).toBe(1);

    expect(apiSwitchCore.getProviders()).toHaveLength(1);
    expect(apiSwitchCore.getProfiles()).toHaveLength(1);
    expect((apiSwitchCore as any).bindings.plugin_muse).toBe("prof_restored");
  });

  it("importSiyuanAiJson 导入思源原生无扩展 ai.json 时，自动派生 Profiles 与思源绑定", async () => {
    const nativeJson = JSON.stringify({
      providers: [
        {
          id: "p_native",
          displayName: "Native Provider",
          baseURL: "https://native.ai",
          apiKey: "native-key",
          models: [{ id: "native-gpt", name: "native-gpt" }],
        },
      ],
      editing: {
        modelId: "native-gpt",
        temperature: 0.7,
        maxCompletionTokens: 2048,
        maxHistoryMessages: 6,
      },
      decision: {
        endpoint: "https://dec.ai",
        apiKey: "dec-key",
        name: "dec-model",
        timeout: 10,
      },
    });

    const res = await apiSwitchCore.importSiyuanAiJson(nativeJson);
    expect(res.providersCount).toBe(1);
    expect(res.profilesCount).toBe(2); // 编辑器 + 决策模型

    const profiles = apiSwitchCore.getProfiles();
    const editingProf = profiles.find((p) => p.name === "导入-思源编辑器");
    expect(editingProf).toBeDefined();
    expect(editingProf?.model).toBe("native-gpt");
    expect((apiSwitchCore as any).bindings.siyuan_builtin_editing).toBe(editingProf?.id);

    const decisionProf = profiles.find((p) => p.name === "导入-思源决策模型");
    expect(decisionProf).toBeDefined();
    expect(decisionProf?.isDecisionModel).toBe(true);
    expect((apiSwitchCore as any).bindings.siyuan_builtin_decision).toBe(decisionProf?.id);
  });

  it("importSiyuanAiJson 兼容旧版纯 profile 数组格式的 JSON", async () => {
    const legacyJson = JSON.stringify([
      {
        id: "prof_legacy_1",
        name: "Legacy Profile 1",
        provider: "openai",
        baseUrl: "https://legacy.ai/v1",
        apiKey: "sk-legacy",
        model: "gpt-4",
      },
    ]);

    const res = await apiSwitchCore.importSiyuanAiJson(legacyJson);
    expect(res.profilesCount).toBe(1);
    expect(apiSwitchCore.getProfiles()[0].name).toBe("Legacy Profile 1");
  });
});
