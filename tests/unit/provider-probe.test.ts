import { describe, it, expect, afterEach } from "vitest";
import { setFetchHandler } from "siyuan";
import {
  fetchProviderModels,
  testProviderConnection,
  testProviderModel,
  probeModelContextLength,
  resolveModelContextLength,
  formatContextLength,
} from "@/services/provider-probe";

const baseDraft = {
  displayName: "Test Provider",
  baseUrl: "https://api.example.com/v1",
  apiKey: "sk-test",
  protocol: "openai",
  requestTimeout: 30,
};

afterEach(() => {
  setFetchHandler(null);
});

describe("刷新可用模型 (fetchProviderModels)", () => {
  it("调用内核 listModels 传 providerConfig 草稿，并解析 models 与 contextLengths", async () => {
    let capturedUrl = "";
    let capturedPayload: any = null;
    setFetchHandler((url, data) => {
      capturedUrl = url;
      capturedPayload = data;
      return {
        code: 0,
        msg: "",
        data: {
          models: ["model-b", "model-a", "model-b"],
          contextLengths: { "model-a": 131072 },
        },
      };
    });

    const result = await fetchProviderModels(baseDraft);

    expect(capturedUrl).toBe("/api/ai/listModels");
    expect(capturedPayload.providerConfig).toMatchObject({
      baseURL: "https://api.example.com/v1",
      apiKey: "sk-test",
      protocol: "openai",
      requestTimeout: 30,
    });
    // 去重 + 排序
    expect(result.models).toEqual(["model-a", "model-b"]);
    expect(result.contextLengths["model-a"]).toBe(131072);
    // 小写键可反查（resolveModelContextLength 以大小写不敏感方式消费）
    expect(resolveModelContextLength("MODEL-A", result.contextLengths)).toBe(131072);
  });

  it("旧协议值在传给内核前被规范化（anthropic → anthropic-messages）", async () => {
    let capturedPayload: any = null;
    setFetchHandler((url, data) => {
      capturedPayload = data;
      return { code: 0, msg: "", data: { models: ["claude-x"], contextLengths: {} } };
    });

    await fetchProviderModels({ ...baseDraft, protocol: "anthropic" });
    expect(capturedPayload.providerConfig.protocol).toBe("anthropic-messages");
  });

  it("服务商不支持 /v1/models 时抛出含内核 msg 的错误", async () => {
    setFetchHandler(() => ({
      code: 0,
      msg: "",
      data: { models: [], contextLengths: {}, msg: "unsupported endpoint" },
    }));

    await expect(fetchProviderModels(baseDraft)).rejects.toThrow(/unsupported endpoint/);
  });

  it("内核端点不存在（老版本思源）时错误包含版本提示", async () => {
    setFetchHandler(() => undefined);
    await expect(fetchProviderModels(baseDraft)).rejects.toThrow(/v3\.7\.0/);
  });

  it("内核返回业务错误码时抛出内核 msg", async () => {
    setFetchHandler(() => ({ code: -1, msg: "provider not found", data: null }));
    await expect(fetchProviderModels(baseDraft)).rejects.toThrow("provider not found");
  });
});

describe("两级测试", () => {
  it("一级连通性测试成功返回时延与模型数", async () => {
    setFetchHandler(() => ({
      code: 0,
      msg: "",
      data: { models: ["a", "b"], contextLengths: {} },
    }));

    const result = await testProviderConnection(baseDraft);
    expect(result.ok).toBe(true);
    expect(result.modelCount).toBe(2);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    expect(result.message).toContain("2");
  });

  it("一级连通性测试失败时 ok=false 且带原因", async () => {
    setFetchHandler(() => ({ code: -1, msg: "invalid api key", data: null }));
    const result = await testProviderConnection(baseDraft);
    expect(result.ok).toBe(false);
    expect(result.message).toContain("invalid api key");
  });

  it("二级深度测试：传 providerConfig + model，matched=true 判定通过", async () => {
    let capturedUrl = "";
    let capturedPayload: any = null;
    setFetchHandler((url, data) => {
      capturedUrl = url;
      capturedPayload = data;
      return {
        code: 0,
        msg: "",
        data: { available: ["m1", "m2"], matched: true, msg: null },
      };
    });

    const result = await testProviderModel(baseDraft, "m1");
    expect(capturedUrl).toBe("/api/ai/testModel");
    expect(capturedPayload.model).toBe("m1");
    expect(capturedPayload.providerConfig.baseURL).toBe("https://api.example.com/v1");
    expect(result.ok).toBe(true);
    expect(result.matched).toBe(true);
    expect(result.availableCount).toBe(2);
  });

  it("二级深度测试：matched=false 时 ok=false 并透传 msg", async () => {
    setFetchHandler(() => ({
      code: 0,
      msg: "",
      data: { available: ["m2"], matched: false, msg: "model not in available list" },
    }));
    const result = await testProviderModel(baseDraft, "m1");
    expect(result.ok).toBe(false);
    expect(result.message).toBe("model not in available list");
  });
});

describe("容量三级查询与格式化", () => {
  it("接口元数据优先于内置快照表", () => {
    expect(resolveModelContextLength("deepseek-chat", { "deepseek-chat": 999999 })).toBe(999999);
  });

  it("快照表兜底：大小写不敏感、支持 provider/model 末段匹配", () => {
    expect(resolveModelContextLength("DeepSeek-Chat")).toBe(131072);
    expect(resolveModelContextLength("deepseek/deepseek-r1")).toBe(163840);
  });

  it("未知模型返回 0，formatContextLength 显示 ?", () => {
    expect(resolveModelContextLength("totally-unknown-model-x")).toBe(0);
    expect(formatContextLength(undefined)).toBe("?");
    expect(formatContextLength(0)).toBe("?");
  });

  it("formatContextLength: 131072 → 128k, 1048576 → 1M", () => {
    expect(formatContextLength(131072)).toBe("128k");
    expect(formatContextLength(1048576)).toBe("1M");
  });
});

describe("主动探测上下文容量 (probeModelContextLength)", () => {
  const LIMIT_TOKENS = 100000;

  /** 模拟 forwardProxy：按填充文本长度估算 tokens（与实现同口径 2.4 字/token），超出上限返回 400 上下文超限 */
  function installFakeProvider(limitTokens: number, hardFail?: () => { status: number; body: string } | undefined) {
    const requests: { url: string; tokens: number }[] = [];
    setFetchHandler((url, data) => {
      if (url !== "/api/network/forwardProxy") {
        return { code: 0, msg: "", data: {} };
      }
      const hard = hardFail?.();
      if (hard) {
        return { code: 0, msg: "", data: { status: hard.status, body: hard.body } };
      }
      const content = data.payload.messages[0].content as string;
      const estTokens = Math.floor(content.length / 2.4);
      requests.push({ url: data.url, tokens: data.tokens ?? estTokens });
      if (estTokens <= limitTokens) {
        return { code: 0, msg: "", data: { status: 200, body: '{"id":"ok"}' } };
      }
      return {
        code: 0,
        msg: "",
        data: { status: 400, body: `{"error":{"message":"This model's maximum context length is ${limitTokens} tokens. However, you requested ${estTokens} tokens."}}` },
      };
    });
    return requests;
  }

  it("指数上探 + 二分逼进，预算内得到真实下界且不超过 8 次请求", async () => {
    const requests = installFakeProvider(LIMIT_TOKENS);

    const result = await probeModelContextLength(baseDraft, "test-model");

    expect(result.requests).toBeLessThanOrEqual(8);
    expect(result.aborted).toBeUndefined();
    // 4k/16k/64k 通过，256k 触顶 → 二分收窄到 100k 附近（粒度 1k）
    expect(result.lowerBound).toBeGreaterThanOrEqual(LIMIT_TOKENS - 16384);
    expect(result.upperBound).not.toBeNull();
    if (result.upperBound !== null) {
      expect(result.upperBound).toBeGreaterThan(LIMIT_TOKENS - 1024);
    }
    expect(result.contextLength).toBe(result.lowerBound);
    // 请求发往 OpenAI 兼容 chat/completions，带 Bearer 头与 max_tokens=1
    expect(requests.length).toBe(result.requests);
    expect(requests[0].url).toBe("https://api.example.com/v1/chat/completions");
  });

  it("anthropic-messages 协议使用 /v1/messages 与 x-api-key 头", async () => {
    let sawAnthropic = false;
    setFetchHandler((url, data) => {
      if (url !== "/api/network/forwardProxy") return { code: 0, msg: "", data: {} };
      if (data.url.endsWith("/messages")) {
        sawAnthropic = true;
        expect(data.headers.some((h: any) => h["x-api-key"] === "sk-test")).toBe(true);
      }
      return { code: 0, msg: "", data: { status: 400, body: "prompt is too long: maximum context length exceeded" } };
    });

    await probeModelContextLength({ ...baseDraft, protocol: "anthropic-messages" }, "claude-x", { maxRequests: 1 });
    expect(sawAnthropic).toBe(true);
  });

  it("鉴权类硬错误立即中止并报告，不再消耗请求", async () => {
    let calls = 0;
    setFetchHandler(() => {
      calls++;
      return { code: 0, msg: "", data: { status: 401, body: '{"error":{"message":"invalid api key"}}' } };
    });

    const result = await probeModelContextLength(baseDraft, "m");
    expect(calls).toBe(1);
    expect(result.aborted).toContain("鉴权失败");
    expect(result.contextLength).toBe(0);
  });

  it("4xx 但错误信息与上下文无关时按硬错误中止", async () => {
    setFetchHandler(() => ({
      code: 0,
      msg: "",
      data: { status: 400, body: '{"error":{"message":"invalid model name"}}' },
    }));

    const result = await probeModelContextLength(baseDraft, "m", { maxRequests: 8 });
    expect(result.aborted).toContain("invalid model name");
  });

  it("模型从未触顶时返回阶梯上界作为下界（声明 ≥1M）", async () => {
    installFakeProvider(Number.MAX_SAFE_INTEGER);
    const result = await probeModelContextLength(baseDraft, "big-model");
    expect(result.upperBound).toBeNull();
    expect(result.contextLength).toBe(1048576);
    expect(result.requests).toBe(5);
  });
});

describe("决策模型 (System One / Jev) 独立探测机制", () => {
  const systemOneDraft = {
    displayName: "TokenDance Jev",
    baseUrl: "https://tokendance.space/gateway/typesafe/v1/systemone",
    apiKey: "sk-tokendance",
    protocol: "systemone",
    models: [{ id: "bocha-jev-v1", name: "bocha-jev-v1" }],
  };

  it("协议识别与端点自动规范化", async () => {
    const { isSystemOneProtocol, resolveSystemOneEndpoint } = await import("@/services/provider-probe");
    expect(isSystemOneProtocol(systemOneDraft)).toBe(true);
    expect(isSystemOneProtocol({ ...systemOneDraft, protocol: "openai" })).toBe(true); // url 含 systemone
    expect(isSystemOneProtocol({ ...systemOneDraft, baseUrl: "https://api.example.com", protocol: "jev" })).toBe(true);
    expect(isSystemOneProtocol({ ...systemOneDraft, baseUrl: "https://api.example.com", protocol: "openai" })).toBe(false);

    expect(resolveSystemOneEndpoint("https://api.typesafe.ai/v1/systemone")).toBe("https://api.typesafe.ai/v1/systemone");
    expect(resolveSystemOneEndpoint("https://api.typesafe.ai/v1")).toBe("https://api.typesafe.ai/v1/systemone");
    expect(resolveSystemOneEndpoint("https://api.typesafe.ai/v1/systemone/")).toBe("https://api.typesafe.ai/v1/systemone");
  });

  it("一级连通性测试：经 forwardProxy 发送轻量 Schema 探针，422 视为成功 (0 tokens)", async () => {
    let capturedUrl = "";
    let capturedPayload: any = null;
    setFetchHandler((url, data) => {
      capturedUrl = url;
      capturedPayload = data;
      return {
        code: 0,
        msg: "",
        data: {
          status: 422,
          body: JSON.stringify({ detail: [{ msg: "Field required", loc: ["body", "state"] }] }),
        },
      };
    });

    const res = await testProviderConnection(systemOneDraft);
    expect(capturedUrl).toBe("/api/network/forwardProxy");
    expect(capturedPayload.url).toBe("https://tokendance.space/gateway/typesafe/v1/systemone");
    expect(capturedPayload.payload).toEqual({ model: "bocha-jev-v1" });
    expect(res.ok).toBe(true);
    expect(res.message).toContain("零 Token 探针");
  });

  it("一级连通性测试：401 判定鉴权失败，404 判定端点未找到", async () => {
    setFetchHandler(() => ({
      code: 0,
      msg: "",
      data: { status: 401, body: "Unauthorized" },
    }));
    const res401 = await testProviderConnection(systemOneDraft);
    expect(res401.ok).toBe(false);
    expect(res401.message).toContain("鉴权失败");

    setFetchHandler(() => ({
      code: 0,
      msg: "",
      data: { status: 404, body: "Not Found" },
    }));
    const res404 = await testProviderConnection(systemOneDraft);
    expect(res404.ok).toBe(false);
    expect(res404.message).toContain("端点未找到");
  });

  it("二级深度测试：发送极简 noul 决策请求，200 返回真假概率与 tokens", async () => {
    let capturedPayload: any = null;
    setFetchHandler((url, data) => {
      capturedPayload = data;
      return {
        code: 0,
        msg: "",
        data: {
          status: 200,
          body: JSON.stringify({
            model: "bocha-jev-v1",
            answers: { probe: { type: "noul", noul: 0.84 } },
            usage: { input_tokens: 99, output_tokens: 0 },
          }),
        },
      };
    });

    const res = await testProviderModel(systemOneDraft, "bocha-jev-v1");
    expect(capturedPayload.url).toBe("https://tokendance.space/gateway/typesafe/v1/systemone");
    expect(capturedPayload.payload.questions.probe.type).toBe("noul");
    expect(res.ok).toBe(true);
    expect(res.message).toContain("深度测试通过");
    expect(res.message).toContain("99 tokens");
    expect(res.message).toContain("0.840");
  });

  it("模型刷新：自动嗅探 TokenDance 主网关并筛选 supported_protocols 包含 systemone 的模型", async () => {
    let capturedProbeUrl = "";
    setFetchHandler((url, data) => {
      capturedProbeUrl = data.url;
      return {
        code: 0,
        msg: "",
        data: {
          status: 200,
          body: JSON.stringify({
            data: [
              { id: "gpt-4o", supported_protocols: ["openai:chat-completions"] },
              { id: "bocha-jev-v1", supported_protocols: ["typesafe:systemone"], context_length: 32000 },
              { id: "ateve-jev-v1", supported_protocols: ["typesafe:systemone"], context_length: 32000 },
            ],
          }),
        },
      };
    });

    const res = await fetchProviderModels(systemOneDraft);
    expect(capturedProbeUrl).toBe("https://tokendance.space/gateway/v1/models");
    expect(res.models).toEqual(["ateve-jev-v1", "bocha-jev-v1"]);
    expect(res.contextLengths["bocha-jev-v1"]).toBe(32000);
  });

  it("模型刷新兜底：网关无相应接口或请求失败时回退为默认决策模型池，不报错 404", async () => {
    setFetchHandler(() => ({
      code: 0,
      msg: "",
      data: { status: 404, body: "Not Found" },
    }));

    const res = await fetchProviderModels({
      baseUrl: "https://api.typesafe.ai/v1/systemone",
      apiKey: "sk-xyz",
      protocol: "systemone",
      models: [{ name: "my-custom-jev" }],
    });

    expect(res.models).toContain("bocha-jev-v1");
    expect(res.models).toContain("my-custom-jev");
    expect(res.contextLengths["bocha-jev-v1"]).toBe(32000);
  });
});
