/**
 * 内置模型上下文容量快照表（单位：tokens）
 *
 * 数据整理自公开目录 OpenRouter (https://openrouter.ai/api/v1/models) 与 models.dev (https://models.dev/api.json)
 * 的 model → context_length 事实数据（仅数值，未复制任何代码），供离线快速展示。
 * 运行时以「刷新可用模型」返回的供应商元数据为准，快照表仅在元数据缺失时兜底，
 * 亦可随时通过「探测容量」获取真实测得值。
 *
 * 匹配规则与思源内核 (kernel/agent/modelmeta.go) 一致：
 * 大小写不敏感；支持聚合平台 "provider/model" 形式按末段匹配。
 */

export const MODEL_CONTEXT_LENGTHS: Record<string, number> = {
  // ===== OpenAI =====
  "gpt-5": 400000,
  "gpt-5-mini": 400000,
  "gpt-5-nano": 400000,
  "gpt-4.1": 1047576,
  "gpt-4.1-mini": 1047576,
  "gpt-4.1-nano": 1047576,
  "gpt-4o": 128000,
  "gpt-4o-mini": 128000,
  "gpt-4-turbo": 128000,
  "gpt-4": 8192,
  "gpt-4-32k": 32768,
  "gpt-3.5-turbo": 16385,
  "o4-mini": 200000,
  "o3": 200000,
  "o3-mini": 200000,
  "o3-pro": 200000,
  "o1": 200000,
  "o1-mini": 128000,
  "openai/gpt-5": 400000,
  "openai/gpt-4.1": 1047576,
  "openai/gpt-4o": 128000,
  "openai/gpt-4o-mini": 128000,
  "openai/o4-mini": 200000,

  // ===== Anthropic =====
  "claude-opus-4-5": 200000,
  "claude-sonnet-4-5": 200000,
  "claude-haiku-4-5": 200000,
  "claude-opus-4-1": 200000,
  "claude-sonnet-4-20250514": 200000,
  "claude-3-7-sonnet-latest": 200000,
  "claude-3-5-sonnet-latest": 200000,
  "claude-3-5-haiku-latest": 200000,
  "anthropic/claude-opus-4.5": 200000,
  "anthropic/claude-sonnet-4.5": 200000,

  // ===== Google Gemini =====
  "gemini-2.5-pro": 1048576,
  "gemini-2.5-flash": 1048576,
  "gemini-2.5-flash-lite": 1048576,
  "gemini-2.0-flash": 1048576,
  "gemini-2.0-flash-lite": 1048576,
  "gemini-1.5-pro": 2097152,
  "gemini-1.5-flash": 1048576,
  "google/gemini-2.5-pro": 1048576,
  "google/gemini-2.5-flash": 1048576,

  // ===== DeepSeek =====
  "deepseek-chat": 131072,
  "deepseek-reasoner": 131072,
  "deepseek-v3": 131072,
  "deepseek-v3.1": 131072,
  "deepseek-r1": 131072,
  "deepseek/deepseek-chat": 163840,
  "deepseek/deepseek-r1": 163840,
  "deepseek-ai/deepseek-v3": 65536,
  "deepseek-ai/deepseek-r1": 65536,

  // ===== Moonshot / Kimi =====
  "kimi-k2": 262144,
  "kimi-k2-turbo-preview": 262144,
  "kimi-k2-0905-vision-preview": 262144,
  "kimi-latest": 262144,
  "moonshot-v1-8k": 8192,
  "moonshot-v1-32k": 32768,
  "moonshot-v1-128k": 131072,
  "moonshotai/kimi-k2": 262144,

  // ===== Alibaba Qwen（通义千问）=====
  "qwen-plus": 131072,
  "qwen-turbo": 131072,
  "qwen-max": 32768,
  "qwen3-max": 262144,
  "qwen2.5-72b-instruct": 32768,
  "qwen2.5-32b-instruct": 32768,
  "qwen/qwen2.5-72b-instruct": 32768,
  "qwen/qwen3-235b-a22b": 131072,

  // ===== Zhipu GLM（智谱）=====
  "glm-4.6": 200000,
  "glm-4.5": 131072,
  "glm-4.5-air": 131072,
  "glm-4.5-flash": 131072,
  "glm-4-plus": 128000,
  "glm-4-flash": 128000,
  "glm-4-9b-chat": 131072,
  "thudm/glm-4-9b-chat": 131072,
  "z-ai/glm-4.6": 200000,

  // ===== ByteDance Doubao（豆包/火山方舟）=====
  "doubao-seed-1-6-250615": 256000,
  "doubao-seed-1-6-flash-250815": 256000,
  "doubao-1-5-pro-32k-250115": 32768,
  "doubao-1-5-pro-256k": 262144,
  "doubao-pro-32k": 32768,
  "doubao-pro-128k": 131072,

  // ===== MiniMax =====
  "minimax-m2": 204800,
  "minimax-text-01": 1000192,
  "minimax-m1": 1000192,
  "minimax/minimax-m2": 204800,

  // ===== Meta Llama =====
  "llama-3.3-70b-versatile": 131072,
  "llama-3.1-8b-instant": 131072,
  "llama-3.1-405b-instruct": 131072,
  "llama-3.1-70b-versatile": 131072,
  "llama3.2": 131072,
  "llama3.1": 131072,
  "llama3": 8192,
  "meta-llama/meta-llama-3-8b-instruct": 8192,
  "meta-llama/llama-3.3-70b-instruct": 131072,

  // ===== Mistral =====
  "mistral-large-latest": 131072,
  "mistral-medium-latest": 131072,
  "mistral-small-latest": 131072,
  "magistral-medium-latest": 40000,
  "devstral-medium-latest": 131072,
  "mistralai/mistral-large": 131072,
  "mistralai/mistral-small": 131072,

  // ===== xAI Grok =====
  "grok-4": 256000,
  "grok-4-fast": 2000000,
  "grok-3": 131072,
  "grok-3-mini": 131072,
  "x-ai/grok-4": 256000,

  // ===== 开源权重模型（SiliconFlow 等聚合平台常见）=====
  "gpt-oss-120b": 131072,
  "gpt-oss-20b": 131072,
  "openai/gpt-oss-120b": 131072,
  "qwen/qwen3-coder": 262144,
  "moonshotai/kimi-k2-instruct": 262144,
};

/**
 * 查询内置容量快照表：大小写不敏感；"provider/model" 形式先全量匹配、再按末段匹配。
 * 返回 0 表示未收录。
 */
export function lookupModelContextLength(modelName?: string | null): number {
  if (!modelName) return 0;
  const name = modelName.trim().toLowerCase();
  if (!name) return 0;
  if (MODEL_CONTEXT_LENGTHS[name]) return MODEL_CONTEXT_LENGTHS[name];
  const lastSegment = name.includes("/") ? name.slice(name.lastIndexOf("/") + 1) : "";
  if (lastSegment && MODEL_CONTEXT_LENGTHS[lastSegment]) return MODEL_CONTEXT_LENGTHS[lastSegment];
  return 0;
}
