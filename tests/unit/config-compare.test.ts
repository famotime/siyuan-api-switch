import { describe, it, expect } from "vitest";
import {
  normalizeUrl,
  normalizeString,
  isProtocolCompatible,
  isProfileConfigMatching,
} from "@/utils/config-compare";
// 兼容面：core 与 profile-store 的 re-export 必须与 utils 源头为同一引用
import {
  normalizeUrl as coreNormalizeUrl,
  normalizeString as coreNormalizeString,
  isProtocolCompatible as coreIsProtocolCompatible,
  isProfileConfigMatching as coreIsProfileConfigMatching,
} from "@/services/api-switch-core";
import {
  normalizeUrl as storeNormalizeUrl,
  normalizeString as storeNormalizeString,
  isProtocolCompatible as storeIsProtocolCompatible,
  isProfileConfigMatching as storeIsProfileConfigMatching,
} from "@/services/profile-store";

describe("config-compare 纯函数迁移后的引用一致性", () => {
  it("utils 源头、profile-store re-export、core re-export 为同一函数引用", () => {
    expect(storeNormalizeUrl).toBe(normalizeUrl);
    expect(storeNormalizeString).toBe(normalizeString);
    expect(storeIsProtocolCompatible).toBe(isProtocolCompatible);
    expect(storeIsProfileConfigMatching).toBe(isProfileConfigMatching);
    expect(coreNormalizeUrl).toBe(normalizeUrl);
    expect(coreNormalizeString).toBe(normalizeString);
    expect(coreIsProtocolCompatible).toBe(isProtocolCompatible);
    expect(coreIsProfileConfigMatching).toBe(isProfileConfigMatching);
  });

  it("迁移后行为不变（URL 归一化 / 协议兼容 / 配置比对）", () => {
    expect(normalizeUrl("https://API.Example.com/v1///")).toBe("https://api.example.com/v1");
    expect(normalizeString("  x ")).toBe("x");
    expect(isProtocolCompatible("openai", "deepseek")).toBe(true);
    expect(isProtocolCompatible("openai", "anthropic-messages")).toBe(false);

    const res = isProfileConfigMatching(
      {
        id: "p1",
        name: "n",
        provider: "openai",
        protocol: "openai",
        baseUrl: "https://api.example.com/v1",
        apiKey: "sk-1",
        model: "m1",
      } as any,
      { baseUrl: "https://api.example.com/v1", apiKey: "sk-1", model: "m1", provider: "openai" }
    );
    expect(res.isMatch).toBe(true);
    expect(res.isExact).toBe(true);
    expect(res.score).toBe(100);
  });
});
