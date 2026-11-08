import { ApiProvider, ApiProviderModel } from "@/types";
import { normalizeUrl, normalizeString, isProtocolCompatible } from "@/utils/config-compare";
import { genProviderId } from "@/utils/id";

/**
 * 将导入/同步所得的模型池增量合并进已有模型池（纯函数）。
 * 默认模式：已存在的模型用导入项覆盖合并（{...旧, ...新}）；
 * backfillContextLengthOnly：已存在的模型仅在本地缺失 contextLength 时补齐容量（备份导入路径的历史行为）。
 */
export function mergeProviderModels(
  existingModels: ApiProviderModel[] | undefined,
  incomingModels: ApiProviderModel[] | undefined,
  opts: { backfillContextLengthOnly?: boolean } = {}
): ApiProviderModel[] {
  const merged = [...(existingModels || [])];
  if (!Array.isArray(incomingModels)) return merged;
  for (const m of incomingModels) {
    const idx = merged.findIndex((em) => em.id === m.id || (em.name && em.name === m.name));
    if (idx !== -1) {
      if (opts.backfillContextLengthOnly) {
        // 模型已存在，如果本地缺失 contextLength 但导入项包含，则增量补齐容量
        if (!merged[idx].contextLength && m.contextLength) {
          merged[idx] = { ...merged[idx], contextLength: m.contextLength };
        }
      } else {
        merged[idx] = { ...merged[idx], ...m };
      }
    } else {
      merged.push(m);
    }
  }
  return merged;
}

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
      id: genProviderId(),
      models: provider.models || [],
      headers: provider.headers || {},
      providerUrl: provider.providerUrl ? String(provider.providerUrl).trim() : "",
    };
    this.providers.push(newProvider);
    await this.onSave();
    return newProvider;
  }

  async updateProvider(provider: ApiProvider): Promise<void> {
    const idx = this.providers.findIndex((p) => p.id === provider.id);
    if (idx !== -1) {
      this.providers[idx] = {
        ...provider,
        providerUrl: provider.providerUrl ? String(provider.providerUrl).trim() : "",
      };
      await this.onSave();
    }
  }

  async deleteProvider(providerId: string): Promise<void> {
    this.providers = this.providers.filter((p) => p.id !== providerId);
    await this.onSave();
  }

  // 校验目标提供商是否与已有提供商配置一致
  // 统一判重口径（思源同步 / ai.json 导入 / 备份导入共用）：
  // id 精确匹配 → displayName 忽略大小写比较 → baseUrl+apiKey 一致且协议兼容
  isProviderMatching(existing: ApiProvider, target: Partial<ApiProvider>): boolean {
    if (!existing || !target) return false;
    // 1. ID 相同
    if (target.id && existing.id && existing.id === target.id) {
      return true;
    }
    // 2. 显示名称相同且非空（忽略大小写与首尾空白）
    if (
      target.displayName &&
      existing.displayName &&
      existing.displayName.trim().toLowerCase() === target.displayName.trim().toLowerCase()
    ) {
      return true;
    }
    // 3. 核心连接参数相同（baseUrl 与 apiKey 一致，且 baseUrl 非空）；协议不兼容则视为不同提供商
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

  /**
   * 将提供商 upsert 进给定列表（原地修改）：命中判重则保留已有 id 并增量合并模型池，
   * displayName 由 resolveDisplayName 决定；未命中则直接追加。返回是否命中已有项。
   */
  mergeProviderIntoList(
    currentProviders: ApiProvider[],
    prov: ApiProvider,
    resolveDisplayName: (existing: ApiProvider, prov: ApiProvider, mergedModels: ApiProviderModel[]) => string
  ): boolean {
    const existIdx = currentProviders.findIndex((p) => this.isProviderMatching(p, prov));
    if (existIdx !== -1) {
      const existing = currentProviders[existIdx];
      const mergedModels = mergeProviderModels(existing.models, prov.models);
      currentProviders[existIdx] = {
        ...existing,
        ...prov,
        id: existing.id,
        displayName: resolveDisplayName(existing, prov, mergedModels),
        models: mergedModels,
      };
      return true;
    }
    currentProviders.push(prov);
    return false;
  }
}

