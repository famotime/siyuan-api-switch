import { ApiProvider } from "@/types";
import { PRESET_PROVIDERS } from "@/constants/providers";

/**
 * 根据所选提供商与模型，计算新建 API 配置的默认名称
 * 规则：API供应商-模型
 * - 若关联已有提供商：取其 displayName（若为空则回退其 id）
 * - 若为独立预置提供商：取预置模板 displayName（若未匹配则取 key）
 * - 若为自定义：取「自定义」
 * - 连字符连接模型名称（若模型未选或为空则仅显示供应商名）
 */
export function computeDefaultProfileName(
  providerId: string | undefined,
  providerKey: string | undefined,
  model: string | undefined,
  providers: ApiProvider[] = []
): string {
  let providerDisplayName = "";

  if (providerId) {
    const prov = providers.find((p) => p.id === providerId);
    if (prov) {
      providerDisplayName = prov.displayName?.trim() || prov.id || "";
    }
  }

  if (!providerDisplayName) {
    const key = (providerKey || "").trim().toLowerCase();
    if (key === "custom") {
      providerDisplayName = "自定义";
    } else if (key && PRESET_PROVIDERS[key]) {
      providerDisplayName = PRESET_PROVIDERS[key].displayName?.trim() || key;
    } else if (key) {
      providerDisplayName = providerKey?.trim() || "自定义";
    } else {
      providerDisplayName = "自定义";
    }
  }

  const modelName = (model || "").trim();
  if (modelName) {
    return `${providerDisplayName}-${modelName}`;
  }
  return providerDisplayName;
}
