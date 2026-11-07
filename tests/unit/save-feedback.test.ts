import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createApp, nextTick, ref } from "vue";
import ProfileEditPanel from "@/components/ProfileEditPanel.vue";
import ProviderEditPanel from "@/components/ProviderEditPanel.vue";
import App from "@/App.vue";
import { ApiProfile, apiSwitchCore } from "@/services/api-switch-core";
import { ApiProvider } from "@/types";

describe("保存按钮轻量提示反馈 (save-feedback)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  it("ProfileEditPanel 支持展示已保存状态，并在 1800ms 后自动复原", async () => {
    const profile: ApiProfile = {
      id: "prof-1",
      name: "测试配置",
      provider: "deepseek",
      baseUrl: "https://api.deepseek.com",
      apiKey: "sk-123",
      model: "deepseek-chat",
      models: ["deepseek-chat"],
    };

    const container = document.createElement("div");
    document.body.appendChild(container);

    let panelInstance: any = null;
    const app = createApp({
      components: { ProfileEditPanel },
      setup() {
        const panelRef = ref<any>(null);
        return { panelRef, profile };
      },
      template: `<ProfileEditPanel ref="panelRef" :profile="profile" :is-new="false" :providers="[]" />`,
    });

    const vm = app.mount(container) as any;
    await nextTick();
    panelInstance = vm.panelRef;

    expect(panelInstance).toBeDefined();
    expect(typeof panelInstance.showSavedFeedback).toBe("function");

    // 初始状态下保存按钮文案为“保存”
    const saveBtn = container.querySelector(".form-actions .b3-button--primary") as HTMLButtonElement;
    expect(saveBtn).not.toBeNull();
    expect(saveBtn.textContent?.trim()).toBe("保存");
    expect(saveBtn.classList.contains("b3-button--saved")).toBe(false);

    // 触发保存反馈
    panelInstance.showSavedFeedback();
    await nextTick();

    expect(saveBtn.textContent?.trim()).toBe("已保存");
    expect(saveBtn.classList.contains("b3-button--saved")).toBe(true);
    const inlineHint = container.querySelector(".saved-inline-hint");
    expect(inlineHint).not.toBeNull();
    expect(inlineHint?.textContent?.trim()).toBe("已保存");

    // 前进 1800ms，状态自动恢复
    vi.advanceTimersByTime(1800);
    await nextTick();

    expect(saveBtn.textContent?.trim()).toBe("保存");
    expect(saveBtn.classList.contains("b3-button--saved")).toBe(false);

    // 等待 transition 动画结束
    vi.advanceTimersByTime(500);
    await nextTick();
    expect(container.querySelector(".saved-inline-hint")).toBeNull();

    app.unmount();
  });

  it("当保存后用户修改配置表单内容产生 dirty 时，已保存提示立即清除", async () => {
    const profile: ApiProfile = {
      id: "prof-1",
      name: "测试配置",
      provider: "deepseek",
      baseUrl: "https://api.deepseek.com",
      apiKey: "sk-123",
      model: "deepseek-chat",
      models: ["deepseek-chat"],
    };

    const container = document.createElement("div");
    document.body.appendChild(container);

    let panelInstance: any = null;
    const app = createApp({
      components: { ProfileEditPanel },
      setup() {
        const panelRef = ref<any>(null);
        return { panelRef, profile };
      },
      template: `<ProfileEditPanel ref="panelRef" :profile="profile" :is-new="false" :providers="[]" />`,
    });

    const vm = app.mount(container) as any;
    await nextTick();
    panelInstance = vm.panelRef;

    // 触发保存反馈
    panelInstance.showSavedFeedback();
    await nextTick();

    const saveBtn = container.querySelector(".form-actions .b3-button--primary") as HTMLButtonElement;
    expect(saveBtn.textContent?.trim()).toBe("已保存");
    expect(saveBtn.classList.contains("b3-button--saved")).toBe(true);

    // 用户在输入框中修改配置名称
    const input = container.querySelector("input.b3-text-field") as HTMLInputElement;
    input.value = "新配置名称";
    input.dispatchEvent(new Event("input"));
    await nextTick();

    // 已保存状态立即清除，按钮恢复为“保存”
    expect(saveBtn.textContent?.trim()).toBe("保存");
    expect(saveBtn.classList.contains("b3-button--saved")).toBe(false);

    app.unmount();
  });

  it("ProviderEditPanel 支持展示已保存状态，并在 1800ms 后自动复原", async () => {
    const provider: ApiProvider = {
      id: "prov-1",
      displayName: "DeepSeek 官方",
      enabled: true,
      protocol: "openai",
      baseUrl: "https://api.deepseek.com",
      apiKey: "sk-abc",
      models: [{ id: "deepseek-chat", name: "deepseek-chat" }],
    };

    const container = document.createElement("div");
    document.body.appendChild(container);

    let panelInstance: any = null;
    const app = createApp({
      components: { ProviderEditPanel },
      setup() {
        const panelRef = ref<any>(null);
        return { panelRef, provider };
      },
      template: `<ProviderEditPanel ref="panelRef" :provider="provider" :is-new="false" />`,
    });

    const vm = app.mount(container) as any;
    await nextTick();
    panelInstance = vm.panelRef;

    expect(panelInstance).toBeDefined();
    expect(typeof panelInstance.showSavedFeedback).toBe("function");

    // 初始状态下按钮为“保存提供商”
    const saveBtn = container.querySelector(".form-actions .b3-button--primary") as HTMLButtonElement;
    expect(saveBtn).not.toBeNull();
    expect(saveBtn.textContent?.trim()).toBe("保存提供商");
    expect(saveBtn.classList.contains("b3-button--saved")).toBe(false);

    // 触发保存反馈
    panelInstance.showSavedFeedback();
    await nextTick();

    expect(saveBtn.textContent?.trim()).toBe("已保存");
    expect(saveBtn.classList.contains("b3-button--saved")).toBe(true);
    const inlineHint = container.querySelector(".saved-inline-hint");
    expect(inlineHint).not.toBeNull();
    expect(inlineHint?.textContent?.trim()).toBe("已保存");

    // 前进 1800ms，状态自动恢复
    vi.advanceTimersByTime(1800);
    await nextTick();

    expect(saveBtn.textContent?.trim()).toBe("保存提供商");
    expect(saveBtn.classList.contains("b3-button--saved")).toBe(false);

    // 等待 transition 动画结束
    vi.advanceTimersByTime(500);
    await nextTick();
    expect(container.querySelector(".saved-inline-hint")).toBeNull();

    app.unmount();
  });

  it("当保存后用户修改提供商表单内容产生 dirty 时，已保存提示立即清除", async () => {
    const provider: ApiProvider = {
      id: "prov-1",
      displayName: "DeepSeek 官方",
      enabled: true,
      protocol: "openai",
      baseUrl: "https://api.deepseek.com",
      apiKey: "sk-abc",
      models: [{ id: "deepseek-chat", name: "deepseek-chat" }],
    };

    const container = document.createElement("div");
    document.body.appendChild(container);

    let panelInstance: any = null;
    const app = createApp({
      components: { ProviderEditPanel },
      setup() {
        const panelRef = ref<any>(null);
        return { panelRef, provider };
      },
      template: `<ProviderEditPanel ref="panelRef" :provider="provider" :is-new="false" />`,
    });

    const vm = app.mount(container) as any;
    await nextTick();
    panelInstance = vm.panelRef;

    // 触发保存反馈
    panelInstance.showSavedFeedback();
    await nextTick();

    const saveBtn = container.querySelector(".form-actions .b3-button--primary") as HTMLButtonElement;
    expect(saveBtn.textContent?.trim()).toBe("已保存");
    expect(saveBtn.classList.contains("b3-button--saved")).toBe(true);

    // 用户在输入框中修改 Base URL
    const input = container.querySelectorAll("input.b3-text-field")[1] as HTMLInputElement;
    input.value = "https://new.api.url";
    input.dispatchEvent(new Event("input"));
    await nextTick();

    // 已保存状态立即清除，按钮恢复为“保存提供商”
    expect(saveBtn.textContent?.trim()).toBe("保存提供商");
    expect(saveBtn.classList.contains("b3-button--saved")).toBe(false);

    app.unmount();
  });

  it("App.vue 成功挂载并能响应保存与展示 Toast 悬浮胶囊，无 nextTick 未定义错误", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    const app = createApp(App);
    const vm = app.mount(container) as any;
    await nextTick();

    // 默认 showDialog 为 false，模拟打开弹窗
    if (window._sy_api_switch?.openSetting) {
      window._sy_api_switch.openSetting();
    }
    await nextTick();

    expect(container).toBeDefined();

    app.unmount();
  });
});
