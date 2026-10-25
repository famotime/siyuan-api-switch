/**
 * 存量配置静默迁移：协议旧值 → 思源内核原生值域
 *
 * 旧版插件使用 openai / gemini / anthropic / custom 四值并原样写入内核，
 * 内核仅识别 openai / openai-responses / anthropic-messages，未知值按 OpenAI 兼容处理，
 * 导致 anthropic 协议实际失效。读档时统一迁移：
 *   gemini → openai（同时把 Gemini 原生 API 端点改写为其 OpenAI 兼容端点）
 *   anthropic → anthropic-messages
 *   custom → openai（决策模型的 custom 标记除外）
 */
import { ApiProvider, ApiProfile } from "@/types";
import { normalizeAiProtocol } from "@/utils/protocol";
import { LEGACY_GEMINI_BASE_URL, GEMINI_OPENAI_COMPAT_BASE_URL } from "@/constants/providers";
import { normalizeUrl } from "./profile-store";

function isLegacyGeminiUrl(url?: string): boolean {
  const normalized = normalizeUrl(url || "").toLowerCase();
  return normalized === LEGACY_GEMINI_BASE_URL || normalized === `${LEGACY_GEMINI_BASE_URL}/`;
}

/**
 * 就地迁移 providers 与 profiles 的协议值域；返回是否有变更（调用方据此决定是否落盘）。
 */
export function migrateLegacyAiProtocols(providers: ApiProvider[], profiles: ApiProfile[]): boolean {
  let changed = false;

  for (const provider of providers) {
    // 读档数据可能仍是旧值域（类型标注为 AiProtocol，但历史存量未迁移），按 string 比较
    const oldProtocol = provider.protocol as string | undefined;
    const newProtocol = normalizeAiProtocol(oldProtocol);
    if (oldProtocol !== newProtocol) {
      provider.protocol = newProtocol;
      changed = true;
    }
    // Gemini 旧端点（原生 API）在 openai 协议下不可用，改写为 OpenAI 兼容端点
    if ((oldProtocol === "gemini" || newProtocol === "openai") && isLegacyGeminiUrl(provider.baseUrl)) {
      provider.baseUrl = GEMINI_OPENAI_COMPAT_BASE_URL;
      changed = true;
    }
  }

  for (const profile of profiles) {
    // 决策模型的 provider/protocol "custom" 是业务标记，不参与协议迁移
    if (profile.isDecisionModel) continue;
    const oldProtocol = profile.protocol;
    const newProtocol = normalizeAiProtocol(oldProtocol);
    if (oldProtocol !== newProtocol) {
      profile.protocol = newProtocol;
      changed = true;
    }
    if ((oldProtocol === "gemini" || profile.provider === "gemini") && isLegacyGeminiUrl(profile.baseUrl)) {
      profile.baseUrl = GEMINI_OPENAI_COMPAT_BASE_URL;
      changed = true;
    }
  }

  return changed;
}
