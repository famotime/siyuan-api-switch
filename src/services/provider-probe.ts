/**
 * 供应商探测服务：刷新可用模型 / 测试连接 / 探测模型上下文容量
 *
 * 全部经由思源内核端点发出（由 Go 进程代理，无浏览器 CORS 问题）：
 * - POST /api/ai/listModels  传 providerConfig 草稿，拉取 /v1/models 清单与 context_length 元数据（内核 v3.7.0+）
 * - POST /api/ai/testModel   传 providerConfig 草稿 + model，先校验模型在清单中，再发 max_tokens=1 极简对话
 * - POST /api/network/forwardProxy 任意 method/url/payload 转发（主动探测上下文容量用，超时可调）
 */
import { fetchSyncPost } from "siyuan";
import { normalizeAiProtocol } from "@/utils/protocol";
import { lookupModelContextLength } from "@/constants/model-contexts";

export interface ProviderDraft {
  displayName?: string;
  baseUrl: string;
  apiKey: string;
  protocol?: string;
  requestTimeout?: number;
  headers?: Record<string, string>;
  models?: Array<{ id?: string; name?: string; [key: string]: any }>;
}

export interface ModelsFetchResult {
  models: string[];
  contextLengths: Record<string, number>;
}

export interface ConnectionTestResult {
  ok: boolean;
  latencyMs: number;
  modelCount: number;
  message: string;
}

export interface ModelTestResult {
  ok: boolean;
  matched: boolean;
  availableCount: number;
  message: string;
}

export interface ProbeProgress {
  attempt: number;
  maxRequests: number;
  tokens: number;
  phase: "exponential" | "bisect";
}

export interface ProbeOptions {
  maxRequests?: number;
  granularity?: number;
  requestTimeoutMs?: number;
  onProgress?: (progress: ProbeProgress) => void;
}

export interface ProbeResult {
  contextLength: number;      // 探得的真实下界（确认可容纳的输入 tokens）
  lowerBound: number;
  upperBound: number | null;  // 确认溢出的规模；null 表示未触顶（已达探测上梯）
  requests: number;
  aborted?: string;           // 硬错误（鉴权/网络/限流等）时中止的原因
}

/** 内核 providerConfig 草稿（kernel/apicontract/setting.go SettingProvider） */
function toProviderConfig(draft: ProviderDraft) {
  return {
    displayName: draft.displayName || "API Switch",
    apiKey: (draft.apiKey || "").trim(),
    baseURL: (draft.baseUrl || "").trim(),
    protocol: normalizeAiProtocol(draft.protocol),
    requestTimeout: draft.requestTimeout ?? 30,
    headers: draft.headers || {},
    models: [],
  };
}

const KERNEL_ENDPOINT_HINT = "（该能力依赖思源内核 /api/ai 端点，需要思源笔记 v3.7.0 及以上版本）";

function extractKernelError(res: any, fallback: string): string {
  const msg = res && typeof res.msg === "string" && res.msg ? res.msg : "";
  return msg || fallback;
}

/** 判断是否为 System One (Jev) 决策模型协议 */
export function isSystemOneProtocol(draft: ProviderDraft): boolean {
  const proto = normalizeAiProtocol(draft.protocol);
  if (proto === "systemone") return true;
  const baseUrl = (draft.baseUrl || "").trim().toLowerCase();
  return /\/systemone(\/|$)/i.test(baseUrl);
}

/** 格式化 System One 端点完整 URL */
export function resolveSystemOneEndpoint(baseUrl: string): string {
  const clean = (baseUrl || "").trim().replace(/\/+$/, "");
  return /\/systemone$/i.test(clean) ? clean : `${clean}/systemone`;
}

/** 内置默认 System One 推荐模型与上下文容量 */
const DEFAULT_SYSTEMONE_MODELS = ["bocha-jev-v1", "ateve-jev-v1", "jev-latest"];
const DEFAULT_SYSTEMONE_CONTEXTS: Record<string, number> = {
  "bocha-jev-v1": 32000,
  "ateve-jev-v1": 32000,
  "jev-latest": 32000,
};

/**
 * 决策模型专用：拉取/刷新可用模型
 * 优先嗅探 TokenDance 等多协议网关的主目录 /gateway/v1/models 并提取 systemone 支持模型；
 * 若未命中或服务商不支持则回退为内置决策模型推荐池。
 */
export async function fetchSystemOneModels(draft: ProviderDraft): Promise<ModelsFetchResult> {
  const baseUrl = (draft.baseUrl || "").trim();
  if (!baseUrl) {
    throw new Error("请先填写 Base URL");
  }

  // 1. 若为类似 TokenDance 的聚合网关，尝试探测主目录 GET /gateway/v1/models
  if (baseUrl.includes("tokendance.space")) {
    try {
      const gatewayModelsUrl = "https://tokendance.space/gateway/v1/models";
      const res: any = await fetchSyncPost("/api/network/forwardProxy", {
        url: gatewayModelsUrl,
        method: "GET",
        timeout: 10000,
        headers: [
          { Authorization: `Bearer ${(draft.apiKey || "").trim()}` },
          { "User-Agent": "siyuan-api-switch" },
        ],
      });
      if (res && res.code === 0 && res.data?.status === 200 && res.data?.body) {
        const parsed = typeof res.data.body === "string" ? JSON.parse(res.data.body) : res.data.body;
        if (Array.isArray(parsed?.data)) {
          const matchedModels: string[] = [];
          const contextLengths: Record<string, number> = {};
          for (const item of parsed.data) {
            const protocols: string[] = Array.isArray(item.supported_protocols) ? item.supported_protocols : [];
            const isSystemOne = protocols.some(
              (p: string) => typeof p === "string" && (p.includes("systemone") || p.includes("system-one") || p.includes("jev"))
            );
            if (isSystemOne && typeof item.id === "string" && item.id.trim()) {
              const id = item.id.trim();
              matchedModels.push(id);
              if (typeof item.context_length === "number" && item.context_length > 0) {
                contextLengths[id] = item.context_length;
                contextLengths[id.toLowerCase()] = item.context_length;
              }
            }
          }
          if (matchedModels.length > 0) {
            return {
              models: [...new Set(matchedModels)].sort((a, b) => a.localeCompare(b)),
              contextLengths,
            };
          }
        }
      }
    } catch {
      // 嗅探失败时自动回退为默认决策模型池
    }
  }

  // 2. 默认推荐池（包含当前 draft 已有自定义模型）
  const candidateModels = new Set(DEFAULT_SYSTEMONE_MODELS);
  if (Array.isArray(draft.models)) {
    for (const m of draft.models) {
      const name = (m.name || m.id || "").trim();
      if (name) candidateModels.add(name);
    }
  }
  return {
    models: Array.from(candidateModels).sort((a, b) => a.localeCompare(b)),
    contextLengths: { ...DEFAULT_SYSTEMONE_CONTEXTS },
  };
}

/**
 * 决策模型专用：一级连通性测试（发送轻量 Schema 探针，零 Token 消耗）
 */
export async function testSystemOneConnection(draft: ProviderDraft, start: number): Promise<ConnectionTestResult> {
  const url = resolveSystemOneEndpoint(draft.baseUrl);
  const candidateModel = draft.models?.[0]?.name || draft.models?.[0]?.id || "bocha-jev-v1";
  const headers: Array<Record<string, string>> = [
    { "content-type": "application/json" },
    { Authorization: `Bearer ${(draft.apiKey || "").trim()}` },
  ];
  for (const [key, value] of Object.entries(draft.headers || {})) {
    headers.push({ [key]: value });
  }

  let res: any;
  try {
    res = await fetchSyncPost("/api/network/forwardProxy", {
      url,
      method: "POST",
      timeout: (draft.requestTimeout ?? 30) * 1000,
      contentType: "application/json",
      headers,
      payload: { model: candidateModel },
    });
  } catch (err: any) {
    return {
      ok: false,
      latencyMs: Date.now() - start,
      modelCount: 0,
      message: `网络或思源内核代理请求失败: ${err?.message || err}`,
    };
  }

  const latencyMs = Date.now() - start;
  if (!res || typeof res !== "object" || res.code !== 0) {
    return {
      ok: false,
      latencyMs,
      modelCount: 0,
      message: extractKernelError(res, "思源内核转发请求失败"),
    };
  }

  const data = res.data || {};
  const status = typeof data.status === "number" ? data.status : 0;
  const body = typeof data.body === "string" ? data.body : "";

  // 1. 200 OK
  if (status >= 200 && status < 300) {
    return {
      ok: true,
      latencyMs,
      modelCount: 1,
      message: `决策模型端点连接成功（${latencyMs}ms）`,
    };
  }

  // 2. 422: FastAPI/Pydantic 校验缺少必填字段（state/questions），证明认证与网关路由 100% 成功，0 token 消耗
  if (status === 422) {
    return {
      ok: true,
      latencyMs,
      modelCount: 1,
      message: `决策模型端点连接成功（${latencyMs}ms，零 Token 探针已验证端点连通与 API 密钥有效）`,
    };
  }

  // 3. 401 / 403 鉴权失败
  if (status === 401 || status === 403) {
    return {
      ok: false,
      latencyMs,
      modelCount: 0,
      message: `鉴权失败 (HTTP ${status})：请检查 API Key 是否有效`,
    };
  }

  // 4. 404 端点未找到
  if (status === 404) {
    return {
      ok: false,
      latencyMs,
      modelCount: 0,
      message: `端点未找到 (HTTP 404)：请检查 Base URL 是否正确`,
    };
  }

  // 5. 400 校验
  if (status === 400) {
    if (body.includes("模型不存在") || body.includes("invalid_request")) {
      return {
        ok: true,
        latencyMs,
        modelCount: 0,
        message: `端点连接成功（${latencyMs}ms，密钥有效），但候选模型「${candidateModel}」未在服务商处找到，可手动添加其他可用模型`,
      };
    }
    return {
      ok: false,
      latencyMs,
      modelCount: 0,
      message: `请求参数错误 (HTTP 400)：${body.slice(0, 150)}`,
    };
  }

  return {
    ok: false,
    latencyMs,
    modelCount: 0,
    message: `服务响应异常 (HTTP ${status})：${body.slice(0, 150)}`,
  };
}

/**
 * 决策模型专用：二级深度测试（发送极简 noul 结构化决策请求，消耗少量 tokens 验证真实推理）
 */
export async function testSystemOneModel(draft: ProviderDraft, modelName: string): Promise<ModelTestResult> {
  const start = Date.now();
  const url = resolveSystemOneEndpoint(draft.baseUrl);
  const headers: Array<Record<string, string>> = [
    { "content-type": "application/json" },
    { Authorization: `Bearer ${(draft.apiKey || "").trim()}` },
  ];
  for (const [key, value] of Object.entries(draft.headers || {})) {
    headers.push({ [key]: value });
  }

  let res: any;
  try {
    res = await fetchSyncPost("/api/network/forwardProxy", {
      url,
      method: "POST",
      timeout: (draft.requestTimeout ?? 30) * 1000,
      contentType: "application/json",
      headers,
      payload: {
        model: modelName,
        state: "ping",
        questions: {
          probe: {
            type: "noul",
            instructions: "ping connectivity check",
          },
        },
      },
    });
  } catch (err: any) {
    throw new Error(`调用思源内核 forwardProxy 失败: ${err?.message || err}`);
  }

  const latencyMs = Date.now() - start;
  if (!res || typeof res !== "object" || res.code !== 0) {
    throw new Error(extractKernelError(res, "思源内核转发请求失败"));
  }

  const data = res.data || {};
  const status = typeof data.status === "number" ? data.status : 0;
  const body = typeof data.body === "string" ? data.body : "";

  if (status >= 200 && status < 300) {
    let tokensDesc = "";
    let probDesc = "";
    try {
      const parsed = typeof body === "string" ? JSON.parse(body) : body;
      const inputTokens = parsed?.usage?.input_tokens;
      if (typeof inputTokens === "number") {
        tokensDesc = `，消耗 ${inputTokens} tokens`;
      }
      const noul = parsed?.answers?.probe?.noul;
      if (typeof noul === "number") {
        probDesc = `，决策真假概率: ${noul.toFixed(3)}`;
      }
    } catch {}

    return {
      ok: true,
      matched: true,
      availableCount: 1,
      message: `决策模型「${modelName}」深度测试通过（耗时 ${latencyMs}ms${tokensDesc}${probDesc}）`,
    };
  }

  if (status === 400 && (body.includes("模型不存在") || body.includes("invalid_request"))) {
    return {
      ok: false,
      matched: false,
      availableCount: 0,
      message: `模型「${modelName}」在服务商不存在或未开通`,
    };
  }
  if (status === 401 || status === 403) {
    return {
      ok: false,
      matched: false,
      availableCount: 0,
      message: `鉴权失败 (HTTP ${status})：请检查 API Key`,
    };
  }
  if (status === 429) {
    return {
      ok: false,
      matched: false,
      availableCount: 0,
      message: `请求被限流 (HTTP 429)：请稍后重试`,
    };
  }

  return {
    ok: false,
    matched: false,
    availableCount: 0,
    message: `深度测试失败 (HTTP ${status})：${body.slice(0, 150)}`,
  };
}

/**
 * 刷新可用模型：调用内核 listModels 拉取 /v1/models 清单与 context_length 元数据。
 * 部分供应商不支持该端点或拒不返回清单，此时抛出带内核 msg 的错误，由 UI 回退为手动输入。
 */
export async function fetchProviderModels(draft: ProviderDraft): Promise<ModelsFetchResult> {
  if (!(draft.baseUrl || "").trim()) {
    throw new Error("请先填写 Base URL");
  }

  if (isSystemOneProtocol(draft)) {
    return fetchSystemOneModels(draft);
  }

  let res: any;
  try {
    res = await fetchSyncPost("/api/ai/listModels", { providerConfig: toProviderConfig(draft) });
  } catch (err: any) {
    throw new Error(`调用思源内核 listModels 失败: ${err?.message || err}${KERNEL_ENDPOINT_HINT}`);
  }
  if (!res || typeof res !== "object") {
    throw new Error(`思源内核未返回有效响应${KERNEL_ENDPOINT_HINT}`);
  }
  if (res.code !== 0) {
    throw new Error(extractKernelError(res, "拉取模型清单失败"));
  }

  const data = res.data || {};
  const models: string[] = Array.isArray(data.models)
    ? data.models.filter((m: unknown): m is string => typeof m === "string" && m.trim() !== "").map((m: string) => m.trim())
    : [];

  const contextLengths: Record<string, number> = {};
  if (data.contextLengths && typeof data.contextLengths === "object") {
    for (const [name, value] of Object.entries(data.contextLengths as Record<string, unknown>)) {
      if (typeof value === "number" && Number.isSafeInteger(value) && value > 0) {
        contextLengths[name] = value;
        contextLengths[name.toLowerCase()] = value;
      }
    }
  }

  if (models.length === 0) {
    const msg = typeof data.msg === "string" && data.msg ? `：${data.msg}` : "";
    throw new Error(`未获取到可用模型清单${msg}（部分服务商不支持 /v1/models，可手动输入模型名）`);
  }

  return { models: [...new Set(models)].sort((a, b) => a.localeCompare(b)), contextLengths };
}

/**
 * 一级测试（连通性）：调 listModels 或决策探针，不消耗 tokens，验证地址、密钥与网络可达。
 */
export async function testProviderConnection(draft: ProviderDraft): Promise<ConnectionTestResult> {
  const start = Date.now();
  if (isSystemOneProtocol(draft)) {
    return testSystemOneConnection(draft, start);
  }

  try {
    const result = await fetchProviderModels(draft);
    return {
      ok: true,
      latencyMs: Date.now() - start,
      modelCount: result.models.length,
      message: `连接成功（${Date.now() - start}ms），获取到 ${result.models.length} 个可用模型`,
    };
  } catch (err: any) {
    return {
      ok: false,
      latencyMs: Date.now() - start,
      modelCount: 0,
      message: err?.message || String(err),
    };
  }
}

/**
 * 二级测试（深度测试）：对指定模型发极简请求，消耗少量 tokens，验证模型名、余额与端到端可用性。
 */
export async function testProviderModel(draft: ProviderDraft, modelName: string): Promise<ModelTestResult> {
  if (!(draft.baseUrl || "").trim()) {
    throw new Error("请先填写 Base URL");
  }
  const model = (modelName || "").trim();
  if (!model) {
    throw new Error("请先选择或输入要测试的模型");
  }

  if (isSystemOneProtocol(draft)) {
    return testSystemOneModel(draft, model);
  }

  let res: any;
  try {
    res = await fetchSyncPost("/api/ai/testModel", { providerConfig: toProviderConfig(draft), model });
  } catch (err: any) {
    throw new Error(`调用思源内核 testModel 失败: ${err?.message || err}${KERNEL_ENDPOINT_HINT}`);
  }
  if (!res || typeof res !== "object") {
    throw new Error(`思源内核未返回有效响应${KERNEL_ENDPOINT_HINT}`);
  }
  if (res.code !== 0) {
    throw new Error(extractKernelError(res, "模型测试失败"));
  }

  const data = res.data || {};
  const matched = data.matched === true;
  const availableCount = Array.isArray(data.available) ? data.available.length : 0;
  const msg = typeof data.msg === "string" && data.msg ? data.msg : "";
  return {
    ok: matched && !msg,
    matched,
    availableCount,
    message: matched && !msg
      ? "深度测试通过：模型在可用清单中，且对话补全请求成功"
      : (msg || "模型不在服务商返回的可用清单中"),
  };
}

/** 容量三级查询：listModels 元数据 > 内置快照表；均未命中返回 0（可再走主动探测） */
export function resolveModelContextLength(modelName: string, apiContextLengths?: Record<string, number>): number {
  const name = (modelName || "").trim();
  if (!name) return 0;
  const fromApi = apiContextLengths?.[name] || apiContextLengths?.[name.toLowerCase()];
  if (fromApi && fromApi > 0) return fromApi;
  return lookupModelContextLength(name);
}

// ===================== 主动探测上下文容量 =====================

/** 指数上探阶梯（tokens）：4k → 16k → 64k → 256k → 1M */
const PROBE_LADDER = [4096, 16384, 65536, 262144, 1048576];
const DEFAULT_PROBE_MAX_REQUESTS = 8;
const DEFAULT_PROBE_GRANULARITY = 1024;
const DEFAULT_PROBE_TIMEOUT_MS = 60000;

/** 填充文本按「中文约 0.5 token/字」保守估算并上浮 20%，确保实际 tokens ≥ 目标值 */
const FILLER_SENTENCE = "这是一段用于探测模型上下文窗口长度的中性填充内容，不包含任何指令。";
function buildFillerContent(targetTokens: number): string {
  const targetChars = Math.ceil(targetTokens * 2.4);
  const unit = FILLER_SENTENCE.length;
  const repeats = Math.ceil(targetChars / unit);
  return FILLER_SENTENCE.repeat(repeats);
}

// 常见「上下文超限」错误特征（OpenAI / DeepSeek / Qwen / Claude 等家族的错误措辞均覆盖）
const CONTEXT_OVERFLOW_PATTERN = /context|token|too\s*long|too\s*many|length|长度|过长|超长|请求体/i;

interface ForwardOutcome {
  pass: boolean;
  contextOverflow: boolean;
  status: number;
  message: string;
}

/** 经内核 forwardProxy 发送一次极简对话补全（max_tokens=1 + 超长填充输入） */
async function sendProbeRequest(
  draft: ProviderDraft,
  model: string,
  targetTokens: number,
  timeoutMs: number
): Promise<ForwardOutcome> {
  const protocol = normalizeAiProtocol(draft.protocol);
  const baseUrl = (draft.baseUrl || "").trim().replace(/\/+$/, "");
  if (!baseUrl) throw new Error("请先填写 Base URL");

  let url: string;
  let headers: Array<Record<string, string>>;
  let payload: Record<string, unknown>;

  if (protocol === "anthropic-messages") {
    // 与内核 anthropicEndpoint 一致：baseURL 已以 /v1 结尾则直接拼 /messages，否则补 v1
    url = /\/v1$/i.test(baseUrl) ? `${baseUrl}/messages` : `${baseUrl}/v1/messages`;
    headers = [
      { "content-type": "application/json" },
      { "x-api-key": (draft.apiKey || "").trim() },
      { "anthropic-version": "2023-06-01" },
    ];
    payload = {
      model,
      max_tokens: 1,
      messages: [{ role: "user", content: buildFillerContent(targetTokens) }],
    };
  } else if (protocol === "systemone" || isSystemOneProtocol(draft)) {
    // TypeSafe System One (Jev) 原生决策端点：POST /systemone
    url = resolveSystemOneEndpoint(baseUrl);
    headers = [
      { "content-type": "application/json" },
      { "Authorization": `Bearer ${(draft.apiKey || "").trim()}` },
    ];
    payload = {
      model: model || "jev-latest",
      state: buildFillerContent(targetTokens),
      questions: {
        ping: {
          type: "noul",
          instructions: "connectivity probe",
        },
      },
    };
  } else {
    url = `${baseUrl}/chat/completions`;
    headers = [
      { "content-type": "application/json" },
      { "Authorization": `Bearer ${(draft.apiKey || "").trim()}` },
    ];
    payload = {
      model,
      max_tokens: 1,
      stream: false,
      messages: [{ role: "user", content: buildFillerContent(targetTokens) }],
    };
  }
  for (const [key, value] of Object.entries(draft.headers || {})) {
    headers.push({ [key]: value });
  }

  const res: any = await fetchSyncPost("/api/network/forwardProxy", {
    url,
    method: "POST",
    timeout: timeoutMs,
    contentType: "application/json",
    headers,
    payload,
  });

  if (!res || typeof res !== "object") {
    throw new Error(`思源内核 forwardProxy 未返回有效响应${KERNEL_ENDPOINT_HINT}`);
  }
  if (res.code !== 0) {
    throw new Error(extractKernelError(res, "内核转发请求失败"));
  }

  const data = res.data || {};
  const status = typeof data.status === "number" ? data.status : 0;
  const body = typeof data.body === "string" ? data.body : "";

  if (status >= 200 && status < 300) {
    return { pass: true, contextOverflow: false, status, message: "" };
  }

  const brief = body.slice(0, 300);
  if (status === 401 || status === 403) {
    return { pass: false, contextOverflow: false, status, message: `鉴权失败 (HTTP ${status})：${brief || "请检查 API Key"}` };
  }
  if (status === 429) {
    return { pass: false, contextOverflow: false, status, message: `请求被限流 (HTTP 429)：${brief || "请稍后重试"}` };
  }
  if (status >= 500) {
    return { pass: false, contextOverflow: false, status, message: `服务商错误 (HTTP ${status})：${brief}` };
  }
  // 4xx：仅当错误信息符合「上下文超限」特征时视作容量触顶，其余按硬错误中止
  if (CONTEXT_OVERFLOW_PATTERN.test(brief)) {
    return { pass: false, contextOverflow: true, status, message: brief };
  }
  return { pass: false, contextOverflow: false, status, message: `请求被拒绝 (HTTP ${status})：${brief}` };
}

/**
 * 主动探测模型上下文容量：4k 起指数上探，触顶后在区间内二分逼进（粒度 1k）。
 * 每次请求都真实消耗 tokens（输入侧），默认预算 8 次；硬错误（鉴权/限流/网络）立即中止并报告已确认下界。
 */
export async function probeModelContextLength(
  draft: ProviderDraft,
  modelName: string,
  options: ProbeOptions = {}
): Promise<ProbeResult> {
  const model = (modelName || "").trim();
  if (!model) throw new Error("请先选择要探测的模型");
  if (!(draft.baseUrl || "").trim()) throw new Error("请先填写 Base URL");

  const maxRequests = options.maxRequests ?? DEFAULT_PROBE_MAX_REQUESTS;
  const granularity = options.granularity ?? DEFAULT_PROBE_GRANULARITY;
  const timeoutMs = options.requestTimeoutMs ?? DEFAULT_PROBE_TIMEOUT_MS;

  let requests = 0;
  let lowerBound = 0;
  let upperBound: number | null = null;

  const attempt = async (tokens: number, phase: ProbeProgress["phase"]): Promise<ForwardOutcome> => {
    requests += 1;
    options.onProgress?.({ attempt: requests, maxRequests, tokens, phase });
    return sendProbeRequest(draft, model, tokens, timeoutMs);
  };

  try {
    // 阶段一：指数上探
    for (const candidate of PROBE_LADDER) {
      if (requests >= maxRequests) break;
      const outcome = await attempt(candidate, "exponential");
      if (outcome.pass) {
        lowerBound = candidate;
      } else if (outcome.contextOverflow) {
        upperBound = candidate;
        break;
      } else {
        return { contextLength: lowerBound, lowerBound, upperBound, requests, aborted: outcome.message };
      }
    }

    // 阶段二：在 (lowerBound, upperBound) 内二分逼进
    if (upperBound !== null) {
      while (requests < maxRequests && upperBound - lowerBound > granularity) {
        const mid = Math.floor((lowerBound + upperBound) / 2 / granularity) * granularity;
        if (mid <= lowerBound || mid >= upperBound) break;
        const outcome = await attempt(mid, "bisect");
        if (outcome.pass) {
          lowerBound = mid;
        } else if (outcome.contextOverflow) {
          upperBound = mid;
        } else {
          return { contextLength: lowerBound, lowerBound, upperBound, requests, aborted: outcome.message };
        }
      }
    }
  } catch (err: any) {
    return { contextLength: lowerBound, lowerBound, upperBound, requests, aborted: err?.message || String(err) };
  }

  return { contextLength: lowerBound, lowerBound, upperBound, requests };
}

/** 探测成本的最坏情况估算（输入 tokens 合计），用于确认弹窗展示 */
export function estimateProbeWorstCost(): number {
  return PROBE_LADDER.reduce((sum, n) => sum + n, 0) + PROBE_LADDER[PROBE_LADDER.length - 1];
}

/** 容量数字格式化：131072 → "128k"、1048576 → "1M" */
export function formatContextLength(tokens?: number | null): string {
  if (!tokens || tokens <= 0) return "?";
  if (tokens >= 1048576 && tokens % 1048576 === 0) return `${tokens / 1048576}M`;
  if (tokens >= 1024) return `${Math.round(tokens / 1024)}k`;
  return String(tokens);
}
