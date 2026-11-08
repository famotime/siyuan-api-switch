/**
 * 实体 ID 生成：`provider_` / `prof_` 前缀命名空间 + 9 位 base36 随机段。
 * 全仓统一入口，避免各处内联拼接格式漂移。
 */
export function genRandomId(prefix: string): string {
  return prefix + Math.random().toString(36).substring(2, 11);
}

export const genProviderId = (): string => genRandomId("provider_");
export const genProfileId = (): string => genRandomId("prof_");
