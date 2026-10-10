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
});
