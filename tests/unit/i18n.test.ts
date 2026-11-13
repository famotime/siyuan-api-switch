import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { t, getCurrentLang } from "@/utils/i18n";
import zhJson from "@/i18n/zh_CN.json";
import enJson from "@/i18n/en_US.json";

describe("i18n 国际化工具", () => {
  const originalSiyuan = (globalThis as any).window?.siyuan;

  beforeEach(() => {
    (globalThis as any).window = (globalThis as any).window || {};
    delete (globalThis as any).window.siyuan;
  });

  afterEach(() => {
    if (originalSiyuan) {
      (globalThis as any).window.siyuan = originalSiyuan;
    } else {
      delete (globalThis as any).window.siyuan;
    }
  });

  it("中英文语言包键集合必须完全对称", () => {
    const zhKeys = Object.keys(zhJson).sort();
    const enKeys = Object.keys(enJson).sort();
    expect(zhKeys).toEqual(enKeys);
    expect(zhKeys.length).toBeGreaterThan(200);
  });

  it("默认环境（无思源全局变量）应返回简体中文", () => {
    expect(getCurrentLang()).toBe("zh_CN");
    expect(t("topBarTitle")).toBe("API 旋钮");
    expect(t("save")).toBe("保存");
    expect(t("cancel")).toBe("取消");
  });

  it("支持占位符参数插值", () => {
    const msg = t("unboundSuccess", { name: "思源助手" });
    expect(msg).toBe("已解除对 思源助手 的接管");
  });

  it("缺失的占位符保留原样或不报错", () => {
    const msg = t("itemCountProviders", { count: 3 });
    expect(msg).toBe("3 个提供商");
  });

  it("不存在的键名直接返回键名自身", () => {
    // @ts-expect-error 测试非法键
    expect(t("non_existing_key_12345")).toBe("non_existing_key_12345");
  });

  it("当思源客户端语言配置为 en_US 时返回英文", () => {
    (globalThis as any).window.siyuan = {
      config: { lang: "en_US" },
    };
    expect(getCurrentLang()).toBe("en_US");
    expect(t("topBarTitle")).toBe("API Switch");
    expect(t("save")).toBe("Save");
    expect(t("cancel")).toBe("Cancel");
    expect(t("unboundSuccess", { name: "TestPlugin" })).toBe("Takeover released for TestPlugin");
  });
});
