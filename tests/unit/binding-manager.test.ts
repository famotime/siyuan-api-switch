import { describe, it, expect, beforeEach, vi } from "vitest";
import { apiSwitchCore, ApiProfile } from "@/services/api-switch-core";
import { SharedConfig } from "@/types";

describe("子插件注册、接管绑定与实时通知分发", () => {
  const sampleProfile: ApiProfile = {
    id: "prof_share",
    name: "Shared Model",
    provider: "openai",
    baseUrl: "https://api.openai.com/v1",
    apiKey: "sk-real",
    model: "gpt-4o",
    temperature: 0.5,
    maxTokens: 2048,
  };

  beforeEach(() => {
    (apiSwitchCore as any).providers = [];
    (apiSwitchCore as any).profiles = [sampleProfile];
    (apiSwitchCore as any).bindings = {};
    (apiSwitchCore as any).registrations = new Map();
  });

  it("子插件注册时，若未绑定则立即接收到 null 配置", () => {
    const callback = vi.fn();
    (apiSwitchCore as any).registerPlugin("plugin_test_1", "测试插件1", callback);

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(null);
  });

  it("子插件已预先绑定时注册，立即接收到绑定的有效配置", () => {
    (apiSwitchCore as any).bindings["plugin_test_2"] = "prof_share";
    const callback = vi.fn();

    (apiSwitchCore as any).registerPlugin("plugin_test_2", "测试插件2", callback);

    expect(callback).toHaveBeenCalledTimes(1);
    const passedConfig: SharedConfig = callback.mock.calls[0][0];
    expect(passedConfig).toBeDefined();
    expect(passedConfig.profileId).toBe("prof_share");
    expect(passedConfig.apiKey).toBe("sk-real");
    expect(passedConfig.model).toBe("gpt-4o");
  });

  it("通过 bindPlugin 绑定后，注册回调立即收到新配置；解除绑定后收到 null", async () => {
    const callback = vi.fn();
    (apiSwitchCore as any).registerPlugin("plugin_test_3", "测试插件3", callback);
    expect(callback).toHaveBeenLastCalledWith(null);

    // 绑定 Profile
    await apiSwitchCore.bindPlugin("plugin_test_3", "prof_share");
    expect(callback).toHaveBeenLastCalledWith(
      expect.objectContaining({
        profileId: "prof_share",
        model: "gpt-4o",
      })
    );

    // 解除绑定
    await apiSwitchCore.bindPlugin("plugin_test_3", "");
    expect(callback).toHaveBeenLastCalledWith(null);
  });

  it("Profile 更新时，已绑定的插件自动收到同步更新", async () => {
    const callback = vi.fn();
    (apiSwitchCore as any).registerPlugin("plugin_test_4", "测试插件4", callback);
    await apiSwitchCore.bindPlugin("plugin_test_4", "prof_share");

    // 更新 Profile
    await apiSwitchCore.updateProfile({
      ...sampleProfile,
      model: "gpt-4o-mini",
      temperature: 0.2,
    });

    expect(callback).toHaveBeenLastCalledWith(
      expect.objectContaining({
        model: "gpt-4o-mini",
        temperature: 0.2,
      })
    );
  });

  it("多槽位插件（对话模型 + 决策模型）注册与分别独立接管绑定", async () => {
    const decisionProfile: ApiProfile = {
      id: "prof_decision",
      name: "Decision Jev",
      provider: "custom",
      baseUrl: "https://api.typesafe.ai/v1/systemone",
      apiKey: "sk-decision",
      model: "jev-latest",
      isDecisionModel: true,
    };
    (apiSwitchCore as any).profiles = [sampleProfile, decisionProfile];

    const callback = vi.fn();
    apiSwitchCore.registerPlugin(
      "siyuan-mate",
      "思源灵犀",
      callback,
      undefined,
      [
        { id: "chat", name: "对话模型", localConfig: { baseUrl: "http://127.0.0.1:11434", model: "deepseek-r1:1.5b", apiKey: "", provider: "ollama" } },
        { id: "decision", name: "决策模型", localConfig: { baseUrl: "https://api.typesafe.ai", model: "jev-latest", apiKey: "", provider: "custom" } },
      ]
    );

    // 初始注册时两个槽位分别收到通知 (slotId: 'chat', slotId: 'decision')
    expect(callback).toHaveBeenCalledWith(null, "chat");
    expect(callback).toHaveBeenCalledWith(null, "decision");

    // 1. 独立绑定对话槽位至 sampleProfile
    await apiSwitchCore.bindPlugin("siyuan-mate", "prof_share", "chat");
    expect(callback).toHaveBeenLastCalledWith(
      expect.objectContaining({
        profileId: "prof_share",
        model: "gpt-4o",
      }),
      "chat"
    );

    // 2. 独立绑定决策槽位至 decisionProfile
    await apiSwitchCore.bindPlugin("siyuan-mate", "prof_decision", "decision");
    expect(callback).toHaveBeenLastCalledWith(
      expect.objectContaining({
        profileId: "prof_decision",
        model: "jev-latest",
      }),
      "decision"
    );

    // 3. 验证 getBoundSharedConfig 分别获取对应槽位
    const chatBound = apiSwitchCore.getBoundSharedConfig("siyuan-mate", "chat");
    expect(chatBound?.model).toBe("gpt-4o");
    const decisionBound = apiSwitchCore.getBoundSharedConfig("siyuan-mate", "decision");
    expect(decisionBound?.model).toBe("jev-latest");

    // 4. 验证 getRegisteredPlugins 正确反映多槽位识别与状态
    const registered = apiSwitchCore.getRegisteredPlugins();
    const matePlug = registered.find((p) => p.pluginId === "siyuan-mate");
    expect(matePlug).toBeDefined();
    expect(matePlug?.slots?.length).toBe(2);
    expect(matePlug?.slots?.[0].slotId).toBe("chat");
    expect(matePlug?.slots?.[0].isBound).toBe(true);
    expect(matePlug?.slots?.[0].boundProfileId).toBe("prof_share");
    expect(matePlug?.slots?.[1].slotId).toBe("decision");
    expect(matePlug?.slots?.[1].isBound).toBe(true);
    expect(matePlug?.slots?.[1].boundProfileId).toBe("prof_decision");

    // 5. 解除决策槽位绑定
    await apiSwitchCore.bindPlugin("siyuan-mate", "", "decision");
    expect(callback).toHaveBeenLastCalledWith(null, "decision");
    expect(apiSwitchCore.getBoundSharedConfig("siyuan-mate", "decision")).toBeNull();
    // 对话槽位依然处于接管状态
    expect(apiSwitchCore.getBoundSharedConfig("siyuan-mate", "chat")?.model).toBe("gpt-4o");
  });
});
