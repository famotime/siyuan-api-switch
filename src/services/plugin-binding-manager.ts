import { SharedConfig } from "@/types";

export interface RegisteredPluginInfo {
  pluginId: string;
  displayName: string;
  isBound: boolean;
  boundProfileId: string;
  localConfig?: Omit<SharedConfig, "profileId" | "profileName">;
}

export interface PluginRegistration {
  displayName: string;
  callback: (config: SharedConfig | null) => void;
  localConfig?: Omit<SharedConfig, "profileId" | "profileName">;
}

export class PluginBindingManager {
  private bindings: Record<string, string> = {}; // pluginId -> profileId
  private registrations = new Map<string, PluginRegistration>();
  private log: (msg: string, ...args: any[]) => void;
  private logError: (msg: string, ...args: any[]) => void;

  constructor(
    log: (msg: string, ...args: any[]) => void,
    logError: (msg: string, ...args: any[]) => void
  ) {
    this.log = log;
    this.logError = logError;
  }

  setBindings(bindings: Record<string, string>) {
    this.bindings = bindings && typeof bindings === "object" ? { ...bindings } : {};
  }

  getBindings(): Record<string, string> {
    return this.bindings;
  }

  getBoundProfileId(pluginId: string): string | undefined {
    return this.bindings[pluginId];
  }

  removeBinding(pluginId: string) {
    delete this.bindings[pluginId];
  }

  setBinding(pluginId: string, profileId: string) {
    this.bindings[pluginId] = profileId;
  }

  getRegistrations(): Map<string, PluginRegistration> {
    return this.registrations;
  }

  setRegistrations(reg: Map<string, PluginRegistration>) {
    this.registrations = reg;
  }

  getRegistration(pluginId: string): PluginRegistration | undefined {
    return this.registrations.get(pluginId);
  }

  registerPlugin(
    pluginId: string,
    displayName: string,
    callback: (config: SharedConfig | null) => void,
    localConfig?: Omit<SharedConfig, "profileId" | "profileName">,
    initialConfig?: SharedConfig | null
  ) {
    this.registrations.set(pluginId, { displayName, callback, localConfig });
    this.log(`Plugin registered: ${displayName} (${pluginId})`, localConfig ? "with local config" : "without local config");

    try {
      callback(initialConfig || null);
    } catch (err) {
      this.logError(`Error during initial register callback for ${pluginId}`, err);
    }
  }

  unregisterPlugin(pluginId: string) {
    this.registrations.delete(pluginId);
    this.log(`Plugin unregistered: ${pluginId}`);
  }

  notifyPluginUpdate(pluginId: string, config: SharedConfig | null) {
    const reg = this.registrations.get(pluginId);
    if (reg) {
      try {
        reg.callback(config);
        this.log(`Notified plugin ${pluginId} with config update`);
      } catch (err) {
        this.logError(`Failed to notify plugin ${pluginId}`, err);
      }
    }
  }

  destroy() {
    for (const [pluginId, reg] of this.registrations.entries()) {
      try {
        reg.callback(null);
      } catch (err) {
        this.logError(`Error in callback during destroy for ${pluginId}`, err);
      }
    }
    this.registrations.clear();
  }
}
