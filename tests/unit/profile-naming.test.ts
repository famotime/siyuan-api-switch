import { describe, it, expect } from "vitest";
import { computeDefaultProfileName } from "@/utils/profile-naming";
import { ApiProvider } from "@/types";

describe("computeDefaultProfileName", () => {
  const mockProviders: ApiProvider[] = [
    {
      id: "prov-1",
      displayName: "SiliconFlow 官方",
      enabled: true,
      protocol: "openai",
      baseUrl: "https://api.siliconflow.cn/v1",
      apiKey: "sk-xxx",
      models: [],
    },
    {
      id: "prov-2",
      displayName: "",
      enabled: true,
      protocol: "openai",
      baseUrl: "https://api.openai.com/v1",
      apiKey: "sk-yyy",
      models: [],
    },
  ];

  it("当关联已有提供商且提供商有 displayName 时，采用 供应商显示名-模型名", () => {
    const name = computeDefaultProfileName(
      "prov-1",
      "deepseek",
      "deepseek-ai/DeepSeek-V3",
      mockProviders
    );
    expect(name).toBe("SiliconFlow 官方-deepseek-ai/DeepSeek-V3");
  });

  it("当关联已有提供商但其 displayName 为空时，回退至提供商 id", () => {
    const name = computeDefaultProfileName(
      "prov-2",
      "openai",
      "gpt-4o",
      mockProviders
    );
    expect(name).toBe("prov-2-gpt-4o");
  });

  it("当使用独立预置提供商（如 deepseek）时，采用 预置显示名-模型名", () => {
    const name = computeDefaultProfileName(
      undefined,
      "deepseek",
      "deepseek-chat",
      mockProviders
    );
    expect(name).toBe("DeepSeek 官方-deepseek-chat");
  });

  it("当使用独立预置提供商（如 openai）时，采用 OpenAI 官方-模型名", () => {
    const name = computeDefaultProfileName(
      "",
      "openai",
      "gpt-4o-mini",
      mockProviders
    );
    expect(name).toBe("OpenAI 官方-gpt-4o-mini");
  });

  it("当选择自定义 (custom) 时，采用 自定义-模型名", () => {
    const name = computeDefaultProfileName(
      undefined,
      "custom",
      "my-local-llama3",
      mockProviders
    );
    expect(name).toBe("自定义-my-local-llama3");
  });

  it("当模型名称未提供或为空字符串时，仅显示供应商名称", () => {
    const nameWithProv = computeDefaultProfileName(
      "prov-1",
      undefined,
      "",
      mockProviders
    );
    expect(nameWithProv).toBe("SiliconFlow 官方");

    const namePreset = computeDefaultProfileName(
      undefined,
      "deepseek",
      "   ",
      mockProviders
    );
    expect(namePreset).toBe("DeepSeek 官方");
  });

  it("当提供商 key 未匹配且无关联提供商时，优雅回退", () => {
    const name = computeDefaultProfileName(
      undefined,
      "some-custom-provider",
      "model-x",
      mockProviders
    );
    expect(name).toBe("some-custom-provider-model-x");

    const fallback = computeDefaultProfileName(
      undefined,
      undefined,
      "model-y",
      mockProviders
    );
    expect(fallback).toBe("自定义-model-y");
  });
});

describe("API 配置文件保存时自动命名", () => {
  const mockProviders: ApiProvider[] = [
    {
      id: "prov_siliconflow",
      displayName: "SiliconFlow",
      enabled: true,
      protocol: "openai",
      baseUrl: "https://api.siliconflow.cn/v1",
      apiKey: "sk-sf-test",
      models: [{ id: "deepseek-ai/DeepSeek-V3", name: "deepseek-ai/DeepSeek-V3", displayName: "DeepSeek V3" }],
    },
  ];

  it("编辑已有配置清空名称后保存，updateProfile 应自动按照 提供商-启用模型 命名", async () => {
    const { apiSwitchCore } = await import("@/services/api-switch-core");
    (apiSwitchCore as any).providerStore.setProviders(mockProviders);
    (apiSwitchCore as any).profileStore.setProfiles([]);

    // 初始创建一个带有自定义名称的 Profile
    const profile = await apiSwitchCore.addProfile({
      name: "原配置名称",
      providerId: "prov_siliconflow",
      model: "deepseek-ai/DeepSeek-V3",
      apiKey: "",
      baseUrl: "",
    });
    expect(profile.name).toBe("原配置名称");

    // 用户在编辑时删除原配置名称后直接保存（传入空字符串）
    profile.name = "";
    await apiSwitchCore.updateProfile(profile);

    const updated = apiSwitchCore.getProfiles().find((p) => p.id === profile.id);
    expect(updated?.name).toBe("SiliconFlow-deepseek-ai/DeepSeek-V3");
  });

  it("编辑已有预置独立配置清空名称后保存（纯空格），updateProfile 应自动按照 预置提供商-启用模型 命名", async () => {
    const { apiSwitchCore } = await import("@/services/api-switch-core");
    (apiSwitchCore as any).providerStore.setProviders([]);
    (apiSwitchCore as any).profileStore.setProfiles([]);

    const profile = await apiSwitchCore.addProfile({
      name: "旧别名",
      provider: "deepseek",
      model: "deepseek-chat",
      apiKey: "sk-test",
      baseUrl: "https://api.deepseek.com",
    });

    // 用户删除原配置名称后直接保存（全空格）
    profile.name = "   ";
    await apiSwitchCore.updateProfile(profile);

    const updated = apiSwitchCore.getProfiles().find((p) => p.id === profile.id);
    expect(updated?.name).toBe("DeepSeek 官方-deepseek-chat");
  });

  it("新建配置时若未填写名称，addProfile 自动按照 提供商-启用模型 命名", async () => {
    const { apiSwitchCore } = await import("@/services/api-switch-core");
    (apiSwitchCore as any).providerStore.setProviders([]);
    (apiSwitchCore as any).profileStore.setProfiles([]);

    const profile = await apiSwitchCore.addProfile({
      name: "",
      provider: "openai",
      model: "gpt-4o",
      apiKey: "sk-test",
      baseUrl: "https://api.openai.com/v1",
    });

    expect(profile.name).toBe("OpenAI 官方-gpt-4o");
  });
});
