import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SiyuanAdapter } from "@/services/siyuan-adapter";
import { setFetchHandler } from "siyuan";
import type { ApiProfile, ApiProvider } from "@/types";

/**
 * 写回等价性测试：锁定 updateSiyuanSystemAi（单数）与 updateSiyuanSystemAiBatch（批量）
 * 对相同输入产出相同 aiConfig 的行为，并记录两者已知的语义分叉点
 * （decision.name 兜底、openAI 兼容字段写入条件），防止后续重构引入回归。
 */
describe("SiyuanAdapter 写回单数/批量等价性", () => {
  let adapter: SiyuanAdapter;
  let baseAi: any;
  const setAiPayloads: any[] = [];

  const provider: ApiProvider = {
    id: "prov_openai",
    name: "openai",
    displayName: "OpenAI Official",
    protocol: "openai",
    baseUrl: "https://api.openai.com/v1",
    apiKey: "sk-prov",
    models: [],
  } as ApiProvider;

  const baseProfile: ApiProfile = {
    id: "prof_1",
    name: "OpenAI Official-gpt-4o",
    providerId: "prov_openai",
    provider: "openai",
    model: "gpt-4o",
    baseUrl: "https://api.openai.com/v1",
    apiKey: "sk-user",
    temperature: 0.5,
    maxTokens: 2048,
    maxHistoryMessages: 10,
    maxToolCallRounds: 5,
    sessionTimeout: 120,
    streamIdleTimeout: 180,
    confirmTimeout: 60,
    maxRetries: 3,
    requestTimeoutSeconds: 45,
    contextWindow: 128000,
    models: ["gpt-4o-mini"],
  } as unknown as ApiProfile;

  const decisionProfile: ApiProfile = {
    ...baseProfile,
    id: "prof_jev",
    name: "SystemOne-jev-latest",
    providerId: "",
    provider: "systemone",
    model: "jev-latest",
    isDecisionModel: true,
  } as unknown as ApiProfile;

  beforeEach(() => {
    adapter = new SiyuanAdapter(() => {}, () => {});
    baseAi = {
      providers: [
        {
          id: "legacy_p",
          displayName: "Legacy Provider",
          baseURL: "https://legacy.example.com",
          baseUrl: "https://legacy.example.com",
          apiKey: "sk-legacy",
          protocol: "openai",
          models: [{ id: "legacy-model", name: "legacy-model", enabled: true }],
        },
      ],
      editing: { modelId: "legacy-model", temperature: 0.3 },
      agent: { modelId: "legacy-model", temperature: 0.3 },
      decision: { enabled: true, name: "jev-legacy", endpoint: "https://legacy.example.com", apiKey: "sk-legacy" },
      openAI: { apiBaseURL: "https://legacy.example.com", apiKey: "sk-legacy", apiModel: "legacy-model" },
    };
    setFetchHandler((url: string, data: any) => {
      if (url === "/api/setting/setAI") {
        setAiPayloads.push(JSON.parse(JSON.stringify(data)));
        return { code: 0, msg: "", data: null };
      }
      if (url === "/api/system/getConf") {
        return { code: 0, msg: "", data: { ai: JSON.parse(JSON.stringify(baseAi)) } };
      }
      return { code: 0, msg: "", data: {} };
    });
  });

  afterEach(() => {
    setFetchHandler(null);
  });

  const runSingle = async (scope: "editing" | "agent" | "decision" | "all", effective: ApiProfile) => {
    setAiPayloads.length = 0;
    await adapter.updateSiyuanSystemAi(effective, scope, [provider]);
    expect(setAiPayloads.length).toBe(1);
    return setAiPayloads[0];
  };

  const runBatch = async (scopes: ("editing" | "agent" | "decision")[], effective: ApiProfile) => {
    setAiPayloads.length = 0;
    await adapter.updateSiyuanSystemAiBatch(
      scopes.map((scope) => ({ scope, effective })),
      [provider]
    );
    expect(setAiPayloads.length).toBe(1);
    return setAiPayloads[0];
  };

  it("editing scope：单数与批量产出深度相等的 aiConfig", async () => {
    const single = await runSingle("editing", baseProfile);
    const batch = await runBatch(["editing"], baseProfile);
    expect(single).toEqual(batch);

    // 关键字段写入正确性
    expect(single.editing.modelId).toBe("gpt-4o");
    expect(single.editing.temperature).toBe(0.5);
    expect(single.editing.maxCompletionTokens).toBe(2048);
    expect(single.editing.maxHistoryMessages).toBe(10);
    expect(single.openAI.apiBaseURL).toBe("https://api.openai.com/v1");
    expect(single.openAI.apiModel).toBe("gpt-4o");
    const target = single.providers.find((p: any) => p.id === "prov_openai");
    expect(target).toBeDefined();
    expect(target.displayName).toBe("OpenAI Official");
    expect(target.requestTimeout).toBe(45);
    expect(target.models.some((m: any) => m.id === "gpt-4o-mini")).toBe(true);
    expect(target.models.find((m: any) => m.id === "gpt-4o").contextLength).toBe(128000);
    // 原有 legacy 提供商保留
    expect(single.providers.some((p: any) => p.id === "legacy_p")).toBe(true);
  });

  it("agent scope：单数与批量产出深度相等的 aiConfig", async () => {
    const single = await runSingle("agent", baseProfile);
    const batch = await runBatch(["agent"], baseProfile);
    expect(single).toEqual(batch);

    expect(single.agent.modelId).toBe("gpt-4o");
    expect(single.agent.maxToolCallRounds).toBe(5);
    expect(single.agent.sessionTimeout).toBe(120);
    expect(single.agent.streamIdleTimeout).toBe(180);
    expect(single.agent.confirmTimeout).toBe(60);
    expect(single.agent.maxRetries).toBe(3);
    // agent scope 不写 openAI 兼容字段
    expect(single.openAI).toEqual(baseAi.openAI);
  });

  it("decision scope（模型已设置）：单数与批量产出深度相等的 aiConfig", async () => {
    const single = await runSingle("decision", decisionProfile);
    const batch = await runBatch(["decision"], decisionProfile);
    expect(single).toEqual(batch);

    expect(single.decision.enabled).toBe(true);
    expect(single.decision.name).toBe("jev-latest");
    expect(single.decision.endpoint).toBe("https://api.openai.com/v1");
    expect(single.decision.apiKey).toBe("sk-user");
    expect(single.decision.timeout).toBe(45);
    // decision scope 不触碰 providers 与 openAI
    expect(single.providers).toEqual(baseAi.providers);
    expect(single.openAI).toEqual(baseAi.openAI);
  });

  it("decision scope（模型为空时的已知分叉）：单数兜底 jev-latest，批量保留原 name", async () => {
    const emptyModelProfile = { ...decisionProfile, model: "" } as unknown as ApiProfile;
    const single = await runSingle("decision", emptyModelProfile);
    const batch = await runBatch(["decision"], emptyModelProfile);
    // 记录当前分叉行为：单数直接兜底 jev-latest，批量优先保留存量 name
    expect(single.decision.name).toBe("jev-latest");
    expect(batch.decision.name).toBe("jev-legacy");
  });

  it("all scope（非决策模型）：单数等价于批量 [agent, editing]", async () => {
    const single = await runSingle("all", baseProfile);
    const batch = await runBatch(["agent", "editing"], baseProfile);
    expect(single).toEqual(batch);

    // all + 非决策模型：agent 与 editing 参数均写入，openAI 同步
    expect(single.agent.modelId).toBe("gpt-4o");
    expect(single.editing.modelId).toBe("gpt-4o");
    expect(single.openAI.apiBaseURL).toBe("https://api.openai.com/v1");
  });

  it("all scope（决策模型）：除 openAI 兼容字段外与批量 [decision, agent, editing] 等致（锁定分叉）", async () => {
    const single = await runSingle("all", decisionProfile);
    const batch = await runBatch(["decision", "agent", "editing"], decisionProfile);
    // 已知分叉：批量 editing 任务同步 openAI，单数 all + 决策模型不写 openAI
    expect(single.openAI).toEqual(baseAi.openAI);
    expect(batch.openAI.apiBaseURL).toBe("https://api.openai.com/v1");
    // 去除 openAI 字段后两者其余部分深度一致
    const batchRest = JSON.parse(JSON.stringify(batch));
    delete batchRest.openAI;
    const singleRest = JSON.parse(JSON.stringify(single));
    delete singleRest.openAI;
    expect(singleRest).toEqual(batchRest);
  });
});
