import { ApiProvider } from "@/types";
import { normalizeUrl, normalizeString, isProtocolCompatible } from "./profile-store";

export class ProviderStore {
  private providers: ApiProvider[] = [];
  private onSave: () => Promise<void>;

  constructor(onSave: () => Promise<void>) {
    this.onSave = onSave;
  }

  setProviders(providers: ApiProvider[]) {
    this.providers = Array.isArray(providers) ? providers : [];
  }

  getProviders(): ApiProvider[] {
    return this.providers;
  }

  getProvider(id: string): ApiProvider | null {
    return this.providers.find((p) => p.id === id) || null;
  }

  async addProvider(provider: Omit<ApiProvider, "id">): Promise<ApiProvider> {
    const newProvider: ApiProvider = {
      ...provider,
      id: "provider_" + Math.random().toString(36).substring(2, 11),
      models: provider.models || [],
      headers: provider.headers || {},
    };
    this.providers.push(newProvider);
    await this.onSave();
    return newProvider;
  }

  async updateProvider(provider: ApiProvider): Promise<void> {
    const idx = this.providers.findIndex((p) => p.id === provider.id);
    if (idx !== -1) {
      this.providers[idx] = { ...provider };
      await this.onSave();
    }
  }

  async deleteProvider(providerId: string): Promise<void> {
    this.providers = this.providers.filter((p) => p.id !== providerId);
    await this.onSave();
  }

  // 校验目标提供商是否与已有提供商配置一致
  isProviderMatching(existing: ApiProvider, target: Partial<ApiProvider>): boolean {
    if (!existing || !target) return false;
    // 1. ID 相同
    if (target.id && existing.id && existing.id === target.id) {
      return true;
    }
    // 2. 显示名称相同且非空
    if (
      target.displayName &&
      existing.displayName &&
      existing.displayName.trim() === target.displayName.trim()
    ) {
      return true;
    }
    // 3. 核心连接参数相同（baseUrl 与 apiKey 一致，且 baseUrl 非空）
    const existingUrl = normalizeUrl(existing.baseUrl);
    const targetUrl = normalizeUrl(target.baseUrl);
    const existingKey = normalizeString(existing.apiKey);
    const targetKey = normalizeString(target.apiKey);

    if (existingUrl && targetUrl && existingUrl === targetUrl && existingKey === targetKey) {
      if (existing.protocol && target.protocol && !isProtocolCompatible(existing.protocol, target.protocol)) {
        return false;
      }
      return true;
    }

    return false;
  }

  // 查找匹配的已有提供商
  findMatchingProvider(target: Partial<ApiProvider>): ApiProvider | null {
    if (!target) return null;
    return this.providers.find((p) => this.isProviderMatching(p, target)) || null;
  }
}

