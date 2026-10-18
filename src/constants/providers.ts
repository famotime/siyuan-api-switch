/**
 * 预设 AI 服务商基础信息与官方配置
 */

export interface PresetProviderInfo {
  displayName: string;
  defaultBaseUrl: string;
  defaultModel: string;
  protocol: string;
  providerUrl?: string;
  presetModels: string[];
}

export const PRESET_PROVIDERS: Record<string, PresetProviderInfo> = {
  deepseek: {
    displayName: "DeepSeek 官方",
    defaultBaseUrl: "https://api.deepseek.com",
    defaultModel: "deepseek-chat",
    protocol: "openai",
    providerUrl: "https://platform.deepseek.com/api_keys",
    presetModels: ["deepseek-chat", "deepseek-reasoner"],
  },
  gemini: {
    displayName: "Google Gemini 官方",
    defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta",
    defaultModel: "gemini-2.5-flash",
    protocol: "gemini",
    providerUrl: "https://aistudio.google.com/app/apikey",
    presetModels: ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-1.5-flash", "gemini-1.5-pro"],
  },
  siliconflow: {
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
  },
  openai: {
    displayName: "OpenAI 官方",
    defaultBaseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-4o-mini",
    protocol: "openai",
    providerUrl: "https://platform.openai.com/api-keys",
    presetModels: ["gpt-4o-mini", "gpt-4o", "o1-mini", "o3-mini"],
  },
};
