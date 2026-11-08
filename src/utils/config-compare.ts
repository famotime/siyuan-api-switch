/**
 * 配置比对与归一化纯函数（从 profile-store 迁出，供 provider-store、config-migration、core 共用）。
 * 仅依赖领域类型，不依赖任何仓储实现。
 */
import { ApiProfile, SharedConfig } from "@/types";

// 规范化 URL（去除首尾空白与尾部多余斜杠）
export function normalizeUrl(url?: string | null): string {
  if (!url) return "";
  const trimmed = url.trim();
  if (!trimmed) return "";
  try {
    const parsed = new URL(trimmed);
    const protocol = parsed.protocol.toLowerCase();
    const host = parsed.host.toLowerCase();
    const pathname = parsed.pathname.replace(/\/+$/, "");
    return `${protocol}//${host}${pathname}${parsed.search}`;
  } catch {
    return trimmed.replace(/\/+$/, "");
  }
}

// 规范化字符串
export function normalizeString(str?: string | null): string {
  return str ? str.trim() : "";
}

// 判断协议/服务商是否兼容（OpenAI 生态系列视作兼容；anthropic-messages 与其余互不兼容）
export function isProtocolCompatible(proto1?: string, proto2?: string): boolean {
  const p1 = (proto1 || "openai").toLowerCase().trim();
  const p2 = (proto2 || "openai").toLowerCase().trim();
  if (p1 === p2) return true;
  const openaiCompat = [
    "openai",
    "openai-responses",
    "custom",
    "gemini",
    "deepseek",
    "siliconflow",
    "openrouter",
    "groq",
    "together",
    "ollama",
    "moonshot",
    "zhipu",
    "minimax",
    "stepfun",
  ];
  return openaiCompat.includes(p1) && openaiCompat.includes(p2);
}

export interface ProfileMatchResult {
  isMatch: boolean;
  isExact: boolean;
  score: number;
}

// 校验两个配置是否一致
export function isProfileConfigMatching(
  effectiveProfile: ApiProfile,
  targetConfig: Partial<ApiProfile> | Partial<SharedConfig> | any
): ProfileMatchResult {
  if (!effectiveProfile || !targetConfig) {
    return { isMatch: false, isExact: false, score: 0 };
  }

  // 1. 决策模型属性必须一致
  const targetIsDecision = Boolean(targetConfig.isDecisionModel);
  const profileIsDecision = Boolean(effectiveProfile.isDecisionModel);
  if (targetIsDecision !== profileIsDecision) {
    return { isMatch: false, isExact: false, score: 0 };
  }

  // 2. Base URL 比对
  const profUrl = normalizeUrl(effectiveProfile.baseUrl);
  const targetUrl = normalizeUrl(targetConfig.baseUrl || targetConfig.baseURL);
  if (profUrl && targetUrl) {
    if (profUrl !== targetUrl) {
      return { isMatch: false, isExact: false, score: 0 };
    }
  } else if ((profUrl && !targetUrl) || (!profUrl && targetUrl)) {
    return { isMatch: false, isExact: false, score: 0 };
  }

  // 3. API Key 比对
  const profKey = normalizeString(effectiveProfile.apiKey);
  const targetKey = normalizeString(targetConfig.apiKey);
  if (profKey || targetKey) {
    if (profKey !== targetKey) {
      return { isMatch: false, isExact: false, score: 0 };
    }
  }

  // 4. 协议兼容性比对
  const profProto = effectiveProfile.protocol || effectiveProfile.provider;
  const targetProto = targetConfig.protocol || targetConfig.provider;
  if (!isProtocolCompatible(profProto, targetProto)) {
    return { isMatch: false, isExact: false, score: 0 };
  }

  // 5. 模型比对
  const profModel = normalizeString(effectiveProfile.model);
  const targetModel = normalizeString(
    targetConfig.model || targetConfig.modelId || targetConfig.name
  );
  if (profileIsDecision) {
    // 决策模型：若任意一方有指定模型，则双方均需指定且不区分大小写一致
    if (profModel || targetModel) {
      if (!profModel || !targetModel || profModel.toLowerCase() !== targetModel.toLowerCase()) {
        return { isMatch: false, isExact: false, score: 0 };
      }
    }
  } else {
    // 非决策模型：必须均指定模型且完全一致
    if (!profModel || !targetModel || profModel.toLowerCase() !== targetModel.toLowerCase()) {
      return { isMatch: false, isExact: false, score: 0 };
    }
  }

  // 核心连接参数通过，基础分 80 分
  let score = 80;
  let exactBonus = true;

  if (profModel === targetModel) {
    score += 5;
  } else {
    exactBonus = false;
  }

  if (profProto && targetProto && profProto.toLowerCase() === targetProto.toLowerCase()) {
    score += 5;
  }

  const compareNumber = (pNum?: number, tNum?: number) => {
    if (pNum !== undefined && tNum !== undefined && pNum !== null && tNum !== null) {
      if (Math.abs(pNum - tNum) > 0.001) {
        exactBonus = false;
        score -= 1;
      }
    }
  };

  compareNumber(effectiveProfile.temperature, targetConfig.temperature);
  compareNumber(effectiveProfile.maxTokens, targetConfig.maxTokens ?? targetConfig.maxCompletionTokens);
  compareNumber(effectiveProfile.maxHistoryMessages, targetConfig.maxHistoryMessages);
  compareNumber(effectiveProfile.maxToolCallRounds, targetConfig.maxToolCallRounds);
  compareNumber(effectiveProfile.sessionTimeout, targetConfig.sessionTimeout);
  compareNumber(effectiveProfile.streamIdleTimeout, targetConfig.streamIdleTimeout);
  compareNumber(effectiveProfile.confirmTimeout, targetConfig.confirmTimeout);
  compareNumber(effectiveProfile.maxRetries, targetConfig.maxRetries);
  compareNumber(effectiveProfile.requestTimeoutSeconds, targetConfig.requestTimeoutSeconds ?? targetConfig.timeout);

  if (exactBonus) {
    score = 100;
  }

  return {
    isMatch: true,
    isExact: score === 100,
    score: Math.max(score, 80),
  };
}
