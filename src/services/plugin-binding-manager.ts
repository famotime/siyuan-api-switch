import { SharedConfig, PluginSlotDefinition, RegisteredPluginSlotInfo } from "@/types";

export type { PluginSlotDefinition, RegisteredPluginSlotInfo };

export interface RegisteredPluginInfo {
  pluginId: string;
  displayName: string;
  isBound: boolean;
  boundProfileId: string;
  localConfig?: Omit<SharedConfig, "profileId" | "profileName">;
  matchedProfileId?: string;
  matchedProfileName?: string;
  slots?: RegisteredPluginSlotInfo[];
}

export interface PluginRegistration {
  displayName: string;
  callback: (config: SharedConfig | null, slotId?: string) => void;
  localConfig?: Omit<SharedConfig, "profileId" | "profileName">;
  slots?: PluginSlotDefinition[];
}

export class PluginBindingManager {
  private bindings: Record<string, string> = {}; // pluginId 或 pluginId:slotId -> profileId
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

  getBoundProfileId(pluginId: string, slotId?: string): string | undefined {
    if (slotId) {
      return this.bindings[`${pluginId}:${slotId}`] || this.bindings[pluginId];
    }
    return this.bindings[pluginId];
  }

  removeBinding(pluginId: string, slotId?: string) {
    if (slotId) {
      delete this.bindings[`${pluginId}:${slotId}`];
    } else {
      delete this.bindings[pluginId];
      // 清理该插件关联的所有槽位键
      for (const k of Object.keys(this.bindings)) {
        if (k.startsWith(`${pluginId}:`)) {
          delete this.bindings[k];
        }
      }
    }
  }

  setBinding(pluginId: string, profileId: string, slotId?: string) {
    if (slotId) {
      this.bindings[`${pluginId}:${slotId}`] = profileId;
    } else {
      this.bindings[pluginId] = profileId;
    }
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
    callback: (config: SharedConfig | null, slotId?: string) => void,
    localConfig?: Omit<SharedConfig, "profileId" | "profileName">,
    initialConfig?: SharedConfig | null,
    slots?: PluginSlotDefinition[],
    initialSlotConfigs?: Record<string, SharedConfig | null>
  ) {
    this.registrations.set(pluginId, { displayName, callback, localConfig, slots });
    this.log(
      `Plugin registered: ${displayName} (${pluginId})`,
      slots && slots.length > 0
        ? `with ${slots.length} slots`
        : localConfig
        ? "with local config"
        : "without local config"
    );

    try {
      if (slots && slots.length > 0) {
        for (const slot of slots) {
          const cfg =
            initialSlotConfigs && initialSlotConfigs[slot.id] !== undefined
              ? initialSlotConfigs[slot.id]
              : initialConfig ?? null;
          callback(cfg, slot.id);
        }
      } else {
        callback(initialConfig || null);
      }
    } catch (err) {
      this.logError(`Error during initial register callback for ${pluginId}`, err);
    }
  }

  unregisterPlugin(pluginId: string) {
    this.registrations.delete(pluginId);
    this.log(`Plugin unregistered: ${pluginId}`);
  }

  notifyPluginUpdate(pluginId: string, config: SharedConfig | null, slotId?: string) {
    const reg = this.registrations.get(pluginId);
    if (reg) {
      try {
        if (slotId !== undefined) {
          reg.callback(config, slotId);
        } else {
          reg.callback(config);
        }
        this.log(`Notified plugin ${pluginId}${slotId ? ` (slot: ${slotId})` : ""} with config update`);
      } catch (err) {
        this.logError(`Failed to notify plugin ${pluginId}`, err);
      }
    }
  }

  destroy() {
    for (const [pluginId, reg] of this.registrations.entries()) {
      try {
        if (reg.slots && reg.slots.length > 0) {
          for (const s of reg.slots) {
            reg.callback(null, s.id);
          }
        } else {
          reg.callback(null);
        }
      } catch (err) {
        this.logError(`Error in callback during destroy for ${pluginId}`, err);
      }
    }
    this.registrations.clear();
  }
}
