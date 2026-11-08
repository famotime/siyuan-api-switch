/**
 * 协议值域工具：与思源内核原生协议值对齐
 *
 * 思源内核仅识别 openai / openai-responses / anthropic-messages（kernel/conf/ai.go），
 * 未知值会被当作 OpenAI 兼容处理。本插件历史版本曾使用
 * openai / gemini / anthropic / custom 四值并原样写入内核，导致 anthropic 协议实际失效，
 * 本模块在读档与写回内核时统一做静默映射迁移。
 */
import { AiProtocol } from "@/types";

export const NATIVE_PROTOCOLS: AiProtocol[] = [
  "openai",
  "openai-responses",
  "anthropic-messages",
  "systemone",
];

const LEGACY_PROTOCOL_MAP: Record<string, AiProtocol> = {
  // 原生值直接放行
  openai: "openai",
  "openai-responses": "openai-responses",
  "anthropic-messages": "anthropic-messages",
  systemone: "systemone",
  // Jev / TypeSafe 决策模型别名规范化
  "system-one": "systemone",
  jev: "systemone",
  typesafe: "systemone",
  // 旧值迁移：Gemini 走其 OpenAI 兼容端点；Anthropic 对齐 Messages 协议；custom 视作 OpenAI 兼容
  gemini: "openai",
  anthropic: "anthropic-messages",
  custom: "openai",
};

export function normalizeAiProtocol(raw?: string | null): AiProtocol {
  const val = (raw || "").trim().toLowerCase();
  return LEGACY_PROTOCOL_MAP[val] || "openai";
}
