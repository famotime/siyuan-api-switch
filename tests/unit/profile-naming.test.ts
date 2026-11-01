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
