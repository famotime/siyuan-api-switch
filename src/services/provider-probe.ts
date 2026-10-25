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

/**
 * 刷新可用模型：调用内核 listModels 拉取 /v1/models 清单与 context_length 元数据。
 * 部分供应商不支持该端点或拒不返回清单，此时抛出带内核 msg 的错误，由 UI 回退为手动输入。
 */
export async function fetchProviderModels(draft: ProviderDraft): Promise<ModelsFetchResult> {
  if (!(draft.baseUrl || "").trim()) {
    throw new Error("请先填写 Base URL");
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
 * 一级测试（连通性）：调 listModels，不消耗 tokens，验证地址、密钥与网络可达。
 */
export async function testProviderConnection(draft: ProviderDraft): Promise<ConnectionTestResult> {
  const start = Date.now();
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
 * 二级测试（深度测试）：调内核 testModel 对指定模型发 max_tokens=1 的真实对话请求，
 * 消耗少量 tokens，可验证模型名、余额与端到端可用性。
 */
export async function testProviderModel(draft: ProviderDraft, modelName: string): Promise<ModelTestResult> {
  if (!(draft.baseUrl || "").trim()) {
    throw new Error("请先填写 Base URL");
  }
  const model = (modelName || "").trim();
  if (!model) {
    throw new Error("请先选择或输入要测试的模型");
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
