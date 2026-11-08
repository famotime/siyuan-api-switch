import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createApp, defineComponent, ref } from "vue";
import { useSavedFeedback } from "@/composables/useSavedFeedback";
import { useDirtySnapshot } from "@/composables/useDirtySnapshot";

/**
 * 面板共享 composable 单元测试：
 * useSavedFeedback（保存反馈 1800ms 自动消退）与 useDirtySnapshot（JSON 快照脏检查）。
 * 两面板 ProviderEditPanel / ProfileEditPanel 的 defineExpose 契约由 save-feedback.test.ts 锁定。
 */
describe("useSavedFeedback", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const mountWith = (setup: () => any) => {
    let api: any;
    const Host = defineComponent({
      setup() {
        api = setup();
        return () => null;
      },
    });
    const root = document.createElement("div");
    createApp(Host).mount(root);
    return api;
  };

  it("showSavedFeedback 置 isSaved 为 true，1800ms 后自动消退", () => {
    const api = mountWith(() => useSavedFeedback());
    api.showSavedFeedback();
    expect(api.isSaved.value).toBe(true);
    vi.advanceTimersByTime(1799);
    expect(api.isSaved.value).toBe(true);
    vi.advanceTimersByTime(1);
    expect(api.isSaved.value).toBe(false);
  });

  it("clearSavedFeedback 立即复位且不再自动触发", () => {
    const api = mountWith(() => useSavedFeedback());
    api.showSavedFeedback();
    api.clearSavedFeedback();
    expect(api.isSaved.value).toBe(false);
    vi.advanceTimersByTime(3000);
    expect(api.isSaved.value).toBe(false);
  });

  it("重复 showSavedFeedback 不会叠加多个定时器", () => {
    const api = mountWith(() => useSavedFeedback());
    api.showSavedFeedback();
    vi.advanceTimersByTime(1000);
    api.showSavedFeedback();
    vi.advanceTimersByTime(1000);
    expect(api.isSaved.value).toBe(true);
    vi.advanceTimersByTime(800);
    expect(api.isSaved.value).toBe(false);
  });

  it("支持自定义展示时长", () => {
    const api = mountWith(() => useSavedFeedback(500));
    api.showSavedFeedback();
    vi.advanceTimersByTime(500);
    expect(api.isSaved.value).toBe(false);
  });
});

describe("useDirtySnapshot", () => {
  const mountWith = (setup: () => any) => {
    let api: any;
    const Host = defineComponent({
      setup() {
        api = setup();
        return () => null;
      },
    });
    const root = document.createElement("div");
    createApp(Host).mount(root);
    return api;
  };

  it("未建立快照时 isDirty 为 false", () => {
    const data = ref({ a: 1 });
    const api = mountWith(() => useDirtySnapshot(() => data.value));
    expect(api.isDirty()).toBe(false);
  });

  it("建立快照后数据变更返回 true，重置快照后返回 false", () => {
    const data = ref({ a: 1 });
    const api = mountWith(() => useDirtySnapshot(() => data.value));
    api.updateInitialSnapshot();
    expect(api.isDirty()).toBe(false);
    data.value = { a: 2 };
    expect(api.isDirty()).toBe(true);
    api.updateInitialSnapshot();
    expect(api.isDirty()).toBe(false);
  });

  it("以 JSON 序列化比对，深拷贝同值数据不算脏", () => {
    const data = ref({ a: 1, nested: { b: [1, 2] } });
    const api = mountWith(() => useDirtySnapshot(() => data.value));
    api.updateInitialSnapshot();
    data.value = JSON.parse(JSON.stringify(data.value));
    expect(api.isDirty()).toBe(false);
  });
});
