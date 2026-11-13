import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createApp, defineComponent, h, nextTick, ref } from "vue";
import { Plugin, setFetchHandler } from "siyuan";
import { SiyuanAdapter } from "@/services/siyuan-adapter";
import { apiSwitchCore } from "@/services/api-switch-core";
import { probeModelContextLength } from "@/services/provider-probe";
import { useWindowDrag } from "@/composables/useWindowDrag";
import { SIYUAN_BUILTIN_EDITING, SIYUAN_BUILTIN_AGENT } from "@/constants/siyuan-scopes";
import ProviderEditPanel from "@/components/ProviderEditPanel.vue";
import ProfileEditPanel from "@/components/ProfileEditPanel.vue";
import App from "@/App.vue";
import type { ApiProvider, ApiProfile } from "@/types";

function flushPromises(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function makeDeferred<T>() {
  let resolve!: (val: T) => void;
  let reject!: (err?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function makeProvider(overrides: Partial<ApiProvider> = {}): ApiProvider {
  return {
    id: overrides.id ?? "prov-1",
    displayName: overrides.displayName ?? "Test Provider",
    enabled: overrides.enabled ?? true,
    protocol: overrides.protocol ?? "openai",
    baseUrl: overrides.baseUrl ?? "https://api.example.com/v1",
    apiKey: overrides.apiKey ?? "sk-provider-secret",
    providerUrl: overrides.providerUrl ?? "https://example.com",
    requestTimeout: overrides.requestTimeout ?? 30,
    headers: overrides.headers ?? {},
    models: overrides.models ?? [
      { id: "gpt-4o", name: "gpt-4o", displayName: "gpt-4o", enabled: true },
      { id: "gpt-4o-mini", name: "gpt-4o-mini", displayName: "gpt-4o-mini", enabled: true },
    ],
    decisionModel: overrides.decisionModel,
  };
}

function makeProfile(overrides: Partial<ApiProfile> = {}): ApiProfile {
  return {
    id: overrides.id ?? "prof-1",
    name: overrides.name ?? "Test Profile",
    providerId: overrides.providerId ?? "prov-1",
    provider: overrides.provider ?? "openai",
    protocol: overrides.protocol ?? "openai",
    baseUrl: overrides.baseUrl ?? "",
    apiKey: overrides.apiKey ?? "",
    providerUrl: overrides.providerUrl ?? "",
    model: overrides.model ?? "gpt-4o",
    maxTokens: overrides.maxTokens ?? 4096,
    temperature: overrides.temperature ?? 0.7,
    maxContext: overrides.maxContext ?? 128000,
    headers: overrides.headers,
  };
}

class MemoryPlugin extends Plugin {
  public storage = new Map<string, any>();
  public saveCalls: any[] = [];
  public customSaveData?: (storageName: string, data: any) => Promise<void>;

  constructor() {
    super({ app: {} as any, id: "siyuan-api-switch", name: "siyuan-api-switch" });
  }

  override async loadData(storageName: string): Promise<any> {
    return this.storage.get(storageName) ?? null;
  }

  override async saveData(storageName: string, data: any): Promise<void> {
    this.saveCalls.push(JSON.parse(JSON.stringify(data)));
    if (this.customSaveData) {
      await this.customSaveData(storageName, data);
    }
    this.storage.set(storageName, JSON.parse(JSON.stringify(data)));
  }
}

describe("State machine hardening", () => {
  beforeEach(() => {
    (window as any).siyuan = {
      config: {
        system: { id: "workspace-1" },
        ai: {
          openAI: {
            apiBaseURL: "https://old-edit.example/v1",
            apiKey: "old-edit-key",
            apiModel: "old-edit-model",
            apiProvider: "OldEdit",
            apiMaxTokens: 2048,
            apiTemperature: 0.7,
            apiMaxContexts: 8192,
            apiProxy: "",
            apiTimeout: 60,
            apiUserAgent: "",
            apiVersion: "",
            apiType: "openai",
            customHeaders: "{}",
          },
          openAIAgent: {
            apiBaseURL: "https://old-agent.example/v1",
            apiKey: "old-agent-key",
            apiModel: "old-agent-model",
            apiProvider: "OldAgent",
            apiMaxTokens: 2048,
            apiTemperature: 0.7,
            apiMaxContexts: 8192,
            apiProxy: "",
            apiTimeout: 60,
            apiUserAgent: "",
            apiVersion: "",
            apiType: "openai",
            customHeaders: "{}",
          },
          openAIDecision: {
            apiBaseURL: "https://old-decision.example/v1",
            apiKey: "old-decision-key",
            apiModel: "old-decision-model",
            apiProvider: "OldDecision",
          },
        },
      },
      languages: {},
    };
  });

  afterEach(() => {
    setFetchHandler(null as any);
    vi.restoreAllMocks();
    document.body.innerHTML = "";
    document.body.style.userSelect = "";
    delete (window as any)._sy_api_switch;
  });

  describe("SiyuanAdapter concurrency and epoch guards", () => {
    it("serializes concurrent updateSiyuanSystemAi writes across scopes without lost updates", async () => {
      let persistedAi = JSON.parse(JSON.stringify((window as any).siyuan.config.ai));
      const firstGetConfStarted = makeDeferred<void>();
      const releaseFirstGetConf = makeDeferred<void>();
      let getConfCount = 0;

      setFetchHandler(async (url, data) => {
        if (url === "/api/system/getConf") {
          getConfCount++;
          if (getConfCount === 1) {
            firstGetConfStarted.resolve();
            await releaseFirstGetConf.promise;
          }
          return { code: 0, msg: "", data: { ai: JSON.parse(JSON.stringify(persistedAi)) } };
        }
        if (url === "/api/setting/setAI") {
          persistedAi = JSON.parse(JSON.stringify(data));
          return { code: 0, msg: "", data: {} };
        }
        return { code: 0, msg: "", data: {} };
      });

      const adapter = new SiyuanAdapter(() => {}, () => {});
      const provider = makeProvider({ id: "p-1", displayName: "Acme", baseUrl: "https://acme.test/v1", apiKey: "sk-acme" });
      const editingProfile = makeProfile({ id: "e-1", providerId: "p-1", model: "acme-edit", baseUrl: "https://acme.test/v1", apiKey: "sk-acme" });
      const agentProfile = makeProfile({ id: "a-1", providerId: "p-1", model: "acme-agent", baseUrl: "https://acme.test/v1", apiKey: "sk-acme" });

      const p1 = adapter.updateSiyuanSystemAi(editingProfile, "editing", [provider]);
      await firstGetConfStarted.promise;
      const p2 = adapter.updateSiyuanSystemAi(agentProfile, "agent", [provider]);

      releaseFirstGetConf.resolve();
      await Promise.all([p1, p2]);

      expect(persistedAi.editing?.modelId).toBe("acme-edit");
      expect(persistedAi.agent?.modelId).toBe("acme-agent");
      expect(persistedAi.openAI?.apiModel).toBe("acme-edit");
      // Each of the 2 serialized writes reads getConf once before setAI and once after setAI to refresh cache
      expect(getConfCount).toBe(4);
    });

    it("ignores stale getConf overwrite in setSystemAiConfig using sync epoch", async () => {
      const slowGetConf = makeDeferred<any>();
      let getConfIdx = 0;

      setFetchHandler(async (url, data) => {
        if (url === "/api/setting/setAI") {
          return { code: 0, msg: "", data };
        }
        if (url === "/api/system/getConf") {
          getConfIdx++;
          if (getConfIdx === 1) {
            return await slowGetConf.promise;
          }
          return {
            code: 0,
            msg: "",
            data: { ai: { openAI: { apiModel: "newer-model" } } },
          };
        }
        return { code: 0, msg: "", data: {} };
      });

      const adapter = new SiyuanAdapter(() => {}, () => {});
      const pOld = adapter.setSystemAiConfig({ openAI: { apiModel: "stale-model" } });
      await flushPromises();
      const pNew = adapter.setSystemAiConfig({ openAI: { apiModel: "newer-model" } });
      await pNew;

      expect((window as any).siyuan.config.ai.openAI.apiModel).toBe("newer-model");

      // Let older getConf resolve with stale data — must NOT overwrite newer-model
      slowGetConf.resolve({
        code: 0,
        msg: "",
        data: { ai: { openAI: { apiModel: "stale-model" } } },
      });
      await pOld;

      expect((window as any).siyuan.config.ai.openAI.apiModel).toBe("newer-model");
    });
  });

  describe("ApiSwitchCore persistence, binding lifecycle, and deletion integrity", () => {
    it("coalesces concurrent save() calls in serial order without losing latest state", async () => {
      setFetchHandler(async () => ({ code: 0, msg: "", data: { ai: (window as any).siyuan.config.ai } }));
      const plugin = new MemoryPlugin();
      await apiSwitchCore.initialize(plugin);
      plugin.saveCalls = [];

      const firstSaveStarted = makeDeferred<void>();
      const releaseFirstSave = makeDeferred<void>();
      let activeSaves = 0;
      let maxConcurrentSaves = 0;
      let saveIdx = 0;

      plugin.customSaveData = async () => {
        saveIdx++;
        activeSaves++;
        maxConcurrentSaves = Math.max(maxConcurrentSaves, activeSaves);
        if (saveIdx === 1) {
          firstSaveStarted.resolve();
          await releaseFirstSave.promise;
        }
        activeSaves--;
      };

      const p1 = apiSwitchCore.save();
      await firstSaveStarted.promise;
      const p2 = apiSwitchCore.save();
      const p3 = apiSwitchCore.save();

      releaseFirstSave.resolve();
      await Promise.all([p1, p2, p3]);

      expect(maxConcurrentSaves).toBe(1);
      // 1 initial in-flight + 1 coalesced trailing save (not 3 uncoordinated concurrent saves)
      expect(plugin.saveCalls.length).toBe(2);
    });

    it("materializes inherited provider fields onto linked profiles before deleteProvider clears providerId", async () => {
      setFetchHandler(async () => ({ code: 0, msg: "", data: { ai: (window as any).siyuan.config.ai } }));
      const plugin = new MemoryPlugin();
      await apiSwitchCore.initialize(plugin);

      const prov = await apiSwitchCore.addProvider({
        displayName: "DeepSeek",
        enabled: true,
        protocol: "openai",
        baseUrl: "https://api.deepseek.com/v1",
        apiKey: "sk-ds-secret",
        providerUrl: "https://platform.deepseek.com",
        requestTimeout: 30,
        headers: { "X-Custom": "1" },
        models: [{ id: "deepseek-chat", name: "deepseek-chat", displayName: "deepseek-chat", enabled: true }],
      });
      const prof = await apiSwitchCore.addProfile({
        name: "DS Chat",
        providerId: prov.id,
        provider: "deepseek",
        protocol: "openai",
        baseUrl: "",
        apiKey: "",
        providerUrl: "",
        model: "deepseek-chat",
        maxTokens: 4096,
        temperature: 0.7,
        maxContext: 64000,
      });

      await apiSwitchCore.deleteProvider(prov.id);

      const updated = apiSwitchCore.getProfiles().find((p) => p.id === prof.id);
      expect(updated).toBeDefined();
      expect(updated!.providerId).toBeUndefined();
      expect(updated!.baseUrl).toBe("https://api.deepseek.com/v1");
      expect(updated!.apiKey).toBe("sk-ds-secret");
      expect(updated!.providerUrl).toBe("https://platform.deepseek.com");
      expect(updated!.headers).toEqual({ "X-Custom": "1" });
    });

    it("prunes dangling bindings on initialize and batches multi-scope SiYuan sync on updateProfile", async () => {
      let persistedAi = JSON.parse(JSON.stringify((window as any).siyuan.config.ai));
      const setAiCalls: any[] = [];

      setFetchHandler(async (url, data) => {
        if (url === "/api/system/getConf") {
          return { code: 0, msg: "", data: { ai: JSON.parse(JSON.stringify(persistedAi)) } };
        }
        if (url === "/api/setting/setAI") {
          setAiCalls.push(JSON.parse(JSON.stringify(data)));
          persistedAi = JSON.parse(JSON.stringify(data));
          return { code: 0, msg: "", data: {} };
        }
        return { code: 0, msg: "", data: {} };
      });

      const plugin = new MemoryPlugin();
      plugin.storage.set("config.json", {
        version: 1,
        providers: [makeProvider({ id: "prov-keep", baseUrl: "https://keep.test/v1", apiKey: "sk-keep" })],
        profiles: [makeProfile({ id: "prof-keep", providerId: "prov-keep", model: "model-v1" })],
        bindings: {
          [SIYUAN_BUILTIN_EDITING]: "prof-keep",
          [SIYUAN_BUILTIN_AGENT]: "prof-keep",
          "ghost-plugin:main": "non-existent-profile",
        },
        pluginNames: { "ghost-plugin": "Ghost" },
      });

      await apiSwitchCore.initialize(plugin);

      const bindings = apiSwitchCore.getBindings();
      expect(bindings["ghost-plugin:main"]).toBeUndefined();
      expect(bindings[SIYUAN_BUILTIN_EDITING]).toBe("prof-keep");
      expect(bindings[SIYUAN_BUILTIN_AGENT]).toBe("prof-keep");

      setAiCalls.length = 0;
      const existing = apiSwitchCore.getProfiles().find((p) => p.id === "prof-keep")!;
      await apiSwitchCore.updateProfile({ ...existing, model: "model-v2" });

      // Both siyuan_builtin_editing and siyuan_builtin_agent must be synced in a single batched setAI call
      expect(setAiCalls.length).toBe(1);
      expect(setAiCalls[0].editing?.modelId).toBe("model-v2");
      expect(setAiCalls[0].agent?.modelId).toBe("model-v2");
      expect(setAiCalls[0].openAI?.apiModel).toBe("model-v2");
    });
  });

  describe("provider-probe signal, openai-responses, and stopReason", () => {
    it("aborts immediately via AbortSignal and reports stopReason='aborted'", async () => {
      const controller = new AbortController();
      let requestCount = 0;

      setFetchHandler(async (url) => {
        if (url === "/api/network/forwardProxy") {
          requestCount++;
          controller.abort();
          return { code: 0, msg: "", data: { status: 200, body: "{}" } };
        }
        return { code: 0, msg: "", data: {} };
      });

      const res = await probeModelContextLength(
        { protocol: "openai", baseUrl: "https://api.example.com/v1", apiKey: "sk-1" },
        "gpt-4o",
        { maxRequests: 6, signal: controller.signal },
      );

      expect(res.stopReason).toBe("aborted");
      expect(res.aborted).toBeTruthy();
      expect(requestCount).toBe(1);
    });

    it("routes openai-responses probes to /responses with input & max_output_tokens", async () => {
      const payloads: any[] = [];

      setFetchHandler(async (url, data) => {
        if (url === "/api/network/forwardProxy") {
          const body = typeof data.payload === "string" ? JSON.parse(data.payload) : data.payload;
          payloads.push({ url: data.url, body });
          return { code: 0, msg: "", data: { status: 200, body: JSON.stringify({ output: [] }) } };
        }
        return { code: 0, msg: "", data: {} };
      });

      const res = await probeModelContextLength(
        { protocol: "openai-responses", baseUrl: "https://api.example.com/v1", apiKey: "sk-1" },
        "gpt-5",
        { maxRequests: 1 },
      );

      expect(payloads.length).toBe(1);
      expect(payloads[0].url).toBe("https://api.example.com/v1/responses");
      expect(payloads[0].body.max_output_tokens).toBe(16);
      expect(typeof payloads[0].body.input).toBe("string");
      expect(res.stopReason).toBe("budget_exhausted");
    });

    it("reports stopReason='overflow' when upper bound is exceeded", async () => {
      setFetchHandler(async (url, data) => {
        if (url === "/api/network/forwardProxy") {
          const body = typeof data.payload === "string" ? JSON.parse(data.payload) : data.payload;
          const content = body.messages?.[0]?.content || "";
          // Succeed at 4096 (default ladder[0] ~9831 chars) and fail at 16384 (~39322 chars)
          if (content.length > 20000) {
            return {
              code: 0,
              msg: "",
              data: {
                status: 400,
                body: JSON.stringify({ error: { message: "maximum context length is 8192 tokens" } }),
              },
            };
          }
          return { code: 0, msg: "", data: { status: 200, body: "{}" } };
        }
        return { code: 0, msg: "", data: {} };
      });

      const res = await probeModelContextLength(
        { protocol: "openai", baseUrl: "https://api.example.com/v1", apiKey: "sk-1" },
        "test-model",
        { maxRequests: 8, granularity: 8192 },
      );

      expect(res.stopReason).toBe("overflow");
      expect(res.upperBound).not.toBeNull();
    });
  });

  describe("useWindowDrag lifecycle cleanup", () => {
    it("cleans up body.userSelect and resets active interaction mode on closeDialog and unmount", async () => {
      let api!: ReturnType<typeof useWindowDrag>;
      const Host = defineComponent({
        setup() {
          api = useWindowDrag();
          return () => h("div");
        },
      });

      const container = document.createElement("div");
      document.body.appendChild(container);
      const app = createApp(Host);
      app.mount(container);

      api.openDialog();
      expect(api.showDialog.value).toBe(true);

      // Start dragging
      api.onHeaderMouseDown(new MouseEvent("mousedown", { clientX: 100, clientY: 100, button: 0 }));
      expect(api.isDraggingWindow.value).toBe(true);
      expect(document.body.style.userSelect).toBe("none");

      // Closing dialog mid-drag must clean up drag state and body style
      api.closeDialog();
      expect(api.showDialog.value).toBe(false);
      expect(api.isDraggingWindow.value).toBe(false);
      expect(document.body.style.userSelect).toBe("");

      // Start resizing and unmount mid-resize
      api.openDialog();
      api.onResizeStart("se", new MouseEvent("mousedown", { clientX: 500, clientY: 500, button: 0 }));
      expect(api.isResizingWindow.value).toBe(true);
      expect(document.body.style.userSelect).toBe("none");

      app.unmount();
      expect(api.isResizingWindow.value).toBe(false);
      expect(document.body.style.userSelect).toBe("");
    });
  });

  describe("ProviderEditPanel and ProfileEditPanel state integrity", () => {
    it("marks ProviderEditPanel dirty on invalid headers JSON, locks concurrent action buttons, and ignores stale probe after switching provider", async () => {
      const slowProxy = makeDeferred<any>();
      setFetchHandler(async (url) => {
        if (url === "/api/ai/listModels" || url === "/api/network/forwardProxy") {
          return await slowProxy.promise;
        }
        return { code: 0, msg: "", data: {} };
      });

      const providerRef = ref<ApiProvider>(makeProvider({ id: "p-a", displayName: "Provider A" }));
      let panelRef: any = null;

      const Host = defineComponent({
        setup() {
          return () =>
            h(ProviderEditPanel, {
              ref: (el: any) => {
                panelRef = el;
              },
              provider: providerRef.value,
              isNew: false,
              onSave: () => {},
              onDelete: () => {},
              onCancel: () => {},
            });
        },
      });

      const root = document.createElement("div");
      document.body.appendChild(root);
      const app = createApp(Host);
      app.mount(root);
      await nextTick();

      expect(panelRef.isDirty()).toBe(false);

      // Typing invalid JSON into headers textarea must still make isDirty() === true
      const headersTextarea = root.querySelector("textarea") as HTMLTextAreaElement;
      expect(headersTextarea).toBeTruthy();
      headersTextarea.value = "{ invalid json";
      headersTextarea.dispatchEvent(new Event("input"));
      await nextTick();
      expect(panelRef.isDirty()).toBe(true);

      // Trigger one async action button (test / refresh / probe)
      const actionButtons = Array.from(root.querySelectorAll("button")).filter((b) =>
        b.textContent?.includes("测试") || b.textContent?.includes("刷新") || b.textContent?.includes("探测"),
      );
      expect(actionButtons.length).toBeGreaterThan(0);

      actionButtons[0].click();
      await nextTick();

      // While task runs, all probe/test/refresh buttons must be disabled
      for (const btn of actionButtons) {
        expect(btn.disabled).toBe(true);
      }

      // Switch to a different provider while request is in-flight
      providerRef.value = makeProvider({
        id: "p-b",
        displayName: "Provider B",
        models: [{ id: "other-model", name: "other-model", displayName: "other-model", enabled: true }],
      });
      await nextTick();

      // Buttons for the new provider should be enabled immediately
      const newActionButtons = Array.from(root.querySelectorAll("button")).filter((b) =>
        b.textContent?.includes("测试") || b.textContent?.includes("刷新") || b.textContent?.includes("探测"),
      );
      for (const btn of newActionButtons) {
        expect(btn.disabled).toBe(false);
      }

      // Resolve stale response from provider A — must not mutate provider B's state
      slowProxy.resolve({
        code: 0,
        msg: "",
        data: { models: ["stale-from-a"], status: 200, body: JSON.stringify({ data: [{ id: "stale-from-a" }] }) },
      });
      await flushPromises();
      await nextTick();

      expect(root.textContent).not.toContain("stale-from-a");
      app.unmount();
    });

    it("clears literal baseUrl and apiKey on ProfileEditPanel when linking a Provider so inheritance updates propagate", async () => {
      const prov1 = makeProvider({ id: "p-1", displayName: "OpenAI", baseUrl: "https://p1.example/v1", apiKey: "sk-p1" });
      const prov2 = makeProvider({ id: "p-2", displayName: "Anthropic", protocol: "anthropic-messages", baseUrl: "https://p2.example/v1", apiKey: "sk-p2" });
      const unlinkedProfile = makeProfile({
        id: "prof-custom",
        name: "Custom",
        providerId: "",
        baseUrl: "https://custom.example/v1",
        apiKey: "sk-custom",
        providerUrl: "https://custom.example",
      });

      let savedProfile: ApiProfile | null = null;
      const Host = defineComponent({
        setup() {
          return () =>
            h(ProfileEditPanel, {
              profile: unlinkedProfile,
              providers: [prov1, prov2],
              isNew: false,
              onSave: (p: ApiProfile) => {
                savedProfile = p;
              },
              onDelete: () => {},
              onCancel: () => {},
            });
        },
      });

      const root = document.createElement("div");
      document.body.appendChild(root);
      const app = createApp(Host);
      app.mount(root);
      await nextTick();

      const providerSelect = root.querySelector("select") as HTMLSelectElement;
      expect(providerSelect).toBeTruthy();

      providerSelect.value = "p-1";
      providerSelect.dispatchEvent(new Event("change"));
      await nextTick();

      const saveBtn = root.querySelector(".form-actions .b3-button--primary") as HTMLButtonElement;
      expect(saveBtn).toBeTruthy();
      saveBtn.click();
      await nextTick();

      expect(savedProfile).not.toBeNull();
      expect(savedProfile!.providerId).toBe("p-1");
      expect(savedProfile!.baseUrl).toBe("");
      expect(savedProfile!.apiKey).toBe("");
      expect(savedProfile!.providerUrl).toBe("");
      app.unmount();
    });
  });

  describe("App.vue dirty navigation and confirmation modal", () => {
    it("awaits dirty navigation confirm before opening delete confirm and treats backdrop click as dismiss (keep editing)", async () => {
      setFetchHandler(async () => ({ code: 0, msg: "", data: { ai: (window as any).siyuan.config.ai } }));
      const plugin = new MemoryPlugin();
      plugin.storage.set("config.json", {
        version: 1,
        providers: [
          makeProvider({ id: "prov-1", displayName: "Provider One" }),
          makeProvider({ id: "prov-2", displayName: "Provider Two" }),
        ],
        profiles: [makeProfile({ id: "prof-1", name: "Profile One", providerId: "prov-1" })],
        bindings: {},
        pluginNames: {},
      });
      await apiSwitchCore.initialize(plugin);

      const root = document.createElement("div");
      document.body.appendChild(root);
      const app = createApp(App);
      app.mount(root);
      await flushPromises();
      (window as any)._sy_api_switch?.openSetting?.();
      await nextTick();

      // Open Provider One in sidebar
      const provItem = Array.from(root.querySelectorAll(".profile-item")).find((el) =>
        el.textContent?.includes("Provider One"),
      ) as HTMLElement | undefined;
      expect(provItem).toBeTruthy();
      provItem!.click();
      await flushPromises();
      await nextTick();

      // Make the active ProviderEditPanel dirty by editing name input
      const nameInput = root.querySelector(".dialog-content input") as HTMLInputElement;
      expect(nameInput).toBeTruthy();
      nameInput.value = "Provider One Modified";
      nameInput.dispatchEvent(new Event("input"));
      await nextTick();

      // Click quick delete on Provider Two while Provider One is dirty
      const prov2Item = Array.from(root.querySelectorAll(".profile-item")).find((el) =>
        el.textContent?.includes("Provider Two"),
      ) as HTMLElement;
      const quickDelBtn = prov2Item.querySelector(".profile-quick-delete") as HTMLElement;
      expect(quickDelBtn).toBeTruthy();
      quickDelBtn.click();
      await nextTick();

      // Modal must show unsaved-changes confirmation (not overwritten by delete confirm!)
      const confirmTitle = () => root.querySelector(".confirm-title")?.textContent ?? "";
      const confirmText = () => root.querySelector(".confirm-text")?.textContent ?? "";
      expect(confirmTitle()).not.toBe("删除提供商");
      expect(confirmTitle()).toBe("未保存修改");

      // Clicking overlay backdrop triggers onDismiss — keeps user on dirty Provider One without discarding changes
      const overlay = root.querySelector(".confirm-overlay") as HTMLElement;
      expect(overlay).toBeTruthy();
      overlay.click();
      await nextTick();

      expect(root.querySelector(".confirm-overlay")).toBeNull();
      expect((root.querySelector(".dialog-content input") as HTMLInputElement).value).toBe("Provider One Modified");

      // Now trigger quick delete again, and click Cancel/Discard button
      quickDelBtn.click();
      await nextTick();
      const cancelBtn = root.querySelector(".confirm-actions .b3-button--cancel") as HTMLButtonElement;
      expect(cancelBtn).toBeTruthy();
      cancelBtn.click();
      await flushPromises();
      await nextTick();

      // After discarding dirty edits, the delete confirm modal must now be shown
      expect(confirmTitle()).toBe("删除提供商");
      expect(confirmText()).toContain("确定要删除此 API 提供商吗");
      app.unmount();
    });
  });
});
