/**
 * 预置 AI 服务商目录
 *
 * 镜像思源笔记原生设置「AI → 供应商」的预置清单（app/src/config/tabs/ai/aiProviderPresets.ts），
 * 含按协议区分的 BaseURL（如 DeepSeek 的 Anthropic Messages 入口），
 * 保证与原生体验一致、双向同步无认知冲突。
 * 用户选择预置后只需填入 API Key 即可使用。
 */
import { AiProtocol } from "@/types";

export interface PresetProviderInfo {
  id: string;
  displayName: string;
  defaultBaseUrl: string;                     // OpenAI 兼容（或该预置默认协议）的标准地址
  defaultModel: string;
  protocol: AiProtocol;
  providerUrl?: string;                       // 获取 API Key 的控制台地址
  presetModels: string[];                     // 推荐模型池（作为初始种子，可用「刷新可用模型」拉取真实清单）
  category: "official" | "aggregator" | "local" | "custom";
  icon?: string;                              // 供应商图标（复用思源原生分发的 /stage/images/ai-providers/ 资源）
  region?: "china" | "international";
  protocolBaseUrls?: Partial<Record<AiProtocol, string>>; // 协议感知的专用地址（如 anthropic-messages 入口）
}

// 旧版 Gemini 原生 API 端点；读档迁移时自动改写为其 OpenAI 兼容端点
export const LEGACY_GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
export const GEMINI_OPENAI_COMPAT_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai";

// 思源内核 Jev 决策模型的官方端点与默认模型名（写回 ai.json、解析与读档兜底共用）
export const SYSTEMONE_DECISION_ENDPOINT = "https://api.typesafe.ai/v1/systemone";
export const SYSTEMONE_DECISION_DEFAULT_MODEL = "jev-latest";

const PRESET_PROVIDER_ORDER: PresetProviderInfo[] = [
  {
    id: "openai",
    icon: "/stage/images/ai-providers/openai.svg",
    displayName: "OpenAI 官方",
    defaultBaseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-4o-mini",
    protocol: "openai-responses",
    providerUrl: "https://platform.openai.com/api-keys",
    presetModels: ["gpt-4o-mini", "gpt-4o", "gpt-4.1", "gpt-4.1-mini", "o4-mini"],
    category: "official",
  },
  {
    id: "anthropic",
    icon: "/stage/images/ai-providers/anthropic.svg",
    displayName: "Anthropic 官方",
    defaultBaseUrl: "https://api.anthropic.com/v1",
    defaultModel: "claude-sonnet-4-5",
    protocol: "anthropic-messages",
    providerUrl: "https://console.anthropic.com/settings/keys",
    presetModels: ["claude-sonnet-4-5", "claude-opus-4-5", "claude-haiku-4-5", "claude-3-7-sonnet-latest"],
    category: "official",
  },
  {
    id: "deepseek",
    icon: "/stage/images/ai-providers/deepseek.svg",
    displayName: "DeepSeek 官方",
    defaultBaseUrl: "https://api.deepseek.com",
    defaultModel: "deepseek-chat",
    protocol: "openai",
    providerUrl: "https://platform.deepseek.com/api_keys",
    presetModels: ["deepseek-chat", "deepseek-reasoner"],
    category: "official",
    region: "china",
    protocolBaseUrls: {
      "openai": "https://api.deepseek.com",
      "openai-responses": "https://api.deepseek.com",
      "anthropic-messages": "https://api.deepseek.com/anthropic",
    },
  },
  {
    id: "moonshot",
    icon: "/stage/images/ai-providers/moonshot.svg",
    displayName: "Moonshot AI (Kimi)",
    defaultBaseUrl: "https://api.moonshot.cn/v1",
    defaultModel: "kimi-k2-turbo-preview",
    protocol: "openai",
    providerUrl: "https://platform.moonshot.cn/console/api-keys",
    presetModels: ["kimi-k2-turbo-preview", "kimi-k2-0905-vision-preview", "kimi-latest", "moonshot-v1-128k"],
    category: "official",
    region: "china",
    protocolBaseUrls: { "anthropic-messages": "https://api.moonshot.cn/anthropic" },
  },
  {
    id: "minimax",
    icon: "/stage/images/ai-providers/minimax.svg",
    displayName: "MiniMax 国际版",
    defaultBaseUrl: "https://api.minimax.io/v1",
    defaultModel: "MiniMax-M2",
    protocol: "openai",
    providerUrl: "https://platform.minimax.io/",
    presetModels: ["MiniMax-M2", "MiniMax-Text-01", "MiniMax-M1"],
    category: "official",
    region: "international",
    protocolBaseUrls: { "anthropic-messages": "https://api.minimax.io/anthropic" },
  },
  {
    id: "minimax-cn",
    icon: "/stage/images/ai-providers/minimax.svg",
    displayName: "MiniMax 国内版",
    defaultBaseUrl: "https://api.minimax.cn/v1",
    defaultModel: "MiniMax-M2",
    protocol: "openai",
    providerUrl: "https://platform.minimax.cn/",
    presetModels: ["MiniMax-M2", "MiniMax-Text-01", "MiniMax-M1"],
    category: "official",
    region: "china",
    protocolBaseUrls: { "anthropic-messages": "https://api.minimax.cn/anthropic" },
  },
  {
    id: "aliyun",
    icon: "/stage/images/ai-providers/aliyun.svg",
    displayName: "阿里云百炼 (通义千问)",
    defaultBaseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    defaultModel: "qwen-plus",
    protocol: "openai",
    providerUrl: "https://bailian.console.aliyun.com/",
    presetModels: ["qwen-plus", "qwen-max", "qwen-turbo", "qwen3-max"],
    category: "official",
    region: "china",
    protocolBaseUrls: { "anthropic-messages": "https://dashscope.aliyuncs.com/apps/anthropic" },
  },
  {
    id: "aliyun-intl",
    icon: "/stage/images/ai-providers/aliyun.svg",
    displayName: "Alibaba Model Studio 国际版",
    defaultBaseUrl: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
    defaultModel: "qwen-plus",
    protocol: "openai",
    providerUrl: "https://modelstudio.alibaba.com/",
    presetModels: ["qwen-plus", "qwen-max", "qwen-turbo", "qwen3-max"],
    category: "official",
    region: "international",
    protocolBaseUrls: { "anthropic-messages": "https://dashscope-intl.aliyuncs.com/apps/anthropic" },
  },
  {
    id: "volcengine",
    icon: "/stage/images/ai-providers/volcengine.svg",
    displayName: "火山方舟 (Volcengine Ark)",
    defaultBaseUrl: "https://ark.cn-beijing.volces.com/api/v3",
    defaultModel: "doubao-seed-1-6-250615",
    protocol: "openai",
    providerUrl: "https://console.volcengine.com/ark",
    presetModels: ["doubao-seed-1-6-250615", "doubao-seed-1-6-flash-250815", "doubao-1-5-pro-32k-250115"],
    category: "official",
    region: "china",
  },
  {
    id: "zhipu",
    icon: "/stage/images/ai-providers/zhipu.svg",
    displayName: "智谱 AI (GLM)",
    defaultBaseUrl: "https://open.bigmodel.cn/api/paas/v4",
    defaultModel: "glm-4.5",
    protocol: "openai",
    providerUrl: "https://open.bigmodel.cn/usercenter/apikeys",
    presetModels: ["glm-4.5", "glm-4.6", "glm-4.5-air", "glm-4-flash"],
    category: "official",
    region: "china",
  },
  {
    id: "gemini",
    icon: "/stage/images/ai-providers/gemini.svg",
    displayName: "Google Gemini 官方",
    defaultBaseUrl: GEMINI_OPENAI_COMPAT_BASE_URL,
    defaultModel: "gemini-2.5-flash",
    protocol: "openai",
    providerUrl: "https://aistudio.google.com/app/apikey",
    presetModels: ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.5-flash-lite"],
    category: "official",
    region: "international",
  },
  {
    id: "mistral",
    icon: "/stage/images/ai-providers/mistral.svg",
    displayName: "Mistral AI",
    defaultBaseUrl: "https://api.mistral.ai/v1",
    defaultModel: "mistral-large-latest",
    protocol: "openai",
    providerUrl: "https://console.mistral.ai/api-keys",
    presetModels: ["mistral-large-latest", "mistral-medium-latest", "mistral-small-latest"],
    category: "official",
    region: "international",
  },
  {
    id: "siliconflow",
    icon: "/stage/images/ai-providers/siliconflow.svg",
    displayName: "SiliconFlow (硅基流动)",
    defaultBaseUrl: "https://api.siliconflow.cn/v1",
    defaultModel: "deepseek-ai/DeepSeek-V3",
    protocol: "openai",
    providerUrl: "https://cloud.siliconflow.cn/account/ak",
    presetModels: [
      "deepseek-ai/DeepSeek-V3",
      "deepseek-ai/DeepSeek-R1",
      "Qwen/Qwen2.5-72B-Instruct",
      "THUDM/glm-4-9b-chat",
      "meta-llama/Meta-Llama-3-8B-Instruct",
    ],
    category: "aggregator",
    region: "china",
  },
  {
    id: "openrouter",
    icon: "/stage/images/ai-providers/openrouter.svg",
    displayName: "OpenRouter",
    defaultBaseUrl: "https://openrouter.ai/api/v1",
    defaultModel: "deepseek/deepseek-chat",
    protocol: "openai",
    providerUrl: "https://openrouter.ai/settings/keys",
    presetModels: ["openai/gpt-4o-mini", "anthropic/claude-sonnet-4.5", "deepseek/deepseek-chat", "google/gemini-2.5-flash"],
    category: "aggregator",
    region: "international",
  },
  {
    id: "groq",
    icon: "/stage/images/ai-providers/groq.svg",
    displayName: "Groq",
    defaultBaseUrl: "https://api.groq.com/openai/v1",
    defaultModel: "llama-3.3-70b-versatile",
    protocol: "openai",
    providerUrl: "https://console.groq.com/keys",
    presetModels: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "openai/gpt-oss-120b"],
    category: "aggregator",
    region: "international",
  },
  {
    id: "ollama",
    icon: "/stage/images/ai-providers/ollama.svg",
    displayName: "Ollama (本地)",
    defaultBaseUrl: "http://localhost:11434/v1",
    defaultModel: "",
    protocol: "openai",
    providerUrl: "https://ollama.com",
    presetModels: [],
    category: "local",
  },
  {
    id: "lmstudio",
    icon: "/stage/images/ai-providers/lmstudio.svg",
    displayName: "LM Studio (本地)",
    defaultBaseUrl: "http://localhost:1234/v1",
    defaultModel: "",
    protocol: "openai",
    providerUrl: "https://lmstudio.ai",
    presetModels: [],
    category: "local",
  },
  {
    id: "custom",
    displayName: "自定义",
    defaultBaseUrl: "",
    defaultModel: "",
    protocol: "openai",
    presetModels: [],
    category: "custom",
  },
];

/** 有序预置目录（官方 → 聚合 → 本地 → 自定义），供选择器 UI 渲染 */
export const PRESET_PROVIDER_LIST: PresetProviderInfo[] = PRESET_PROVIDER_ORDER;

/** 按 id 索引的预置表，兼容旧版消费方 PRESET_PROVIDERS[provKey]?.defaultBaseUrl 等用法 */
export const PRESET_PROVIDERS: Record<string, PresetProviderInfo> = PRESET_PROVIDER_ORDER.reduce(
  (acc, preset) => {
    acc[preset.id] = preset;
    return acc;
  },
  {} as Record<string, PresetProviderInfo>
);

function normalizeBaseUrl(url: string): string {
  return (url || "").trim().replace(/\/+$/, "").toLowerCase();
}

/** 判断某个 BaseURL 是否命中指定预置（含其协议专用地址） */
export function findPresetByBaseUrl(baseUrl?: string): PresetProviderInfo | null {
  const target = normalizeBaseUrl(baseUrl || "");
  if (!target) return null;
  for (const preset of PRESET_PROVIDER_ORDER) {
    if (preset.category === "custom") continue;
    const candidates = [preset.defaultBaseUrl, ...Object.values(preset.protocolBaseUrls || {})];
    if (candidates.some((c) => normalizeBaseUrl(c) === target)) {
      return preset;
    }
  }
  return null;
}

/**
 * 切换协议时替换为该协议的预置专用地址（如 DeepSeek 切 anthropic-messages → /anthropic 入口）。
 * 仅当当前地址命中某预置时生效，用户自定义网关保持不变。
 */
export function getPresetProtocolBaseUrl(baseUrl: string, protocol: AiProtocol): string {
  const preset = findPresetByBaseUrl(baseUrl);
  if (!preset) return baseUrl;
  if (preset.protocolBaseUrls && preset.protocolBaseUrls[protocol]) {
    return preset.protocolBaseUrls[protocol]!;
  }
  if (protocol === "anthropic-messages") {
    // 无专用入口的预置保持原地址，由内核归一化兜底
    return baseUrl;
  }
  return preset.defaultBaseUrl;
}
