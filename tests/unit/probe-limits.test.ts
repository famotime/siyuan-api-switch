import { describe, it, expect } from "vitest";
import {
  DEFAULT_PROBE_MAX_REQUESTS,
  DEFAULT_PROBE_TIMEOUT_MS,
  DEFAULT_PROBE_GRANULARITY,
} from "@/services/provider-probe";

/**
 * 容量探测上限常量契约：ProviderEditPanel 的探测确认文案引用这些导出常量，
 * 常量变更即自动同步文案；本测试锁定既有值，防止无意改动探测成本预算。
 */
describe("容量探测上限常量导出", () => {
  it("最大请求数 / 单次超时 / 粒度保持既有值", () => {
    expect(DEFAULT_PROBE_MAX_REQUESTS).toBe(8);
    expect(DEFAULT_PROBE_TIMEOUT_MS).toBe(60000);
    expect(DEFAULT_PROBE_GRANULARITY).toBe(1024);
  });
});
