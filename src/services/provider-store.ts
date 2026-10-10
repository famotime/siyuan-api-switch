import { ApiProvider } from "@/types";

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
}
