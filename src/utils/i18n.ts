import zh_CN from "@/i18n/zh_CN.json";
import en_US from "@/i18n/en_US.json";
import { usePlugin } from "@/main";

export type I18nKey = keyof typeof zh_CN;

/**
 * 获取当前系统/客户端语言
 */
export function getCurrentLang(): "zh_CN" | "en_US" {
  const currentLang = typeof window !== "undefined" ? (window as any).siyuan?.config?.lang : "";
  if (currentLang && String(currentLang).toLowerCase().startsWith("en")) {
    return "en_US";
  }
  return "zh_CN";
}

/**
 * 国际化翻译函数
 * 优先读取思源为当前插件实例挂载的 plugin.i18n；
 * 若未挂载（如无头单元测试环境），则按思源配置语言探测或回退至 zh_CN / en_US。
 */
export function t(key: I18nKey | string, params?: Record<string, string | number>): string {
  let text: string | undefined;

  try {
    const plugin = usePlugin();
    if (plugin && plugin.i18n && typeof plugin.i18n[key] === "string") {
      text = plugin.i18n[key];
    }
  } catch {}

  if (!text) {
    const currentLang = typeof window !== "undefined" ? (window as any).siyuan?.config?.lang : "";
    if (currentLang && String(currentLang).toLowerCase().startsWith("en")) {
      text = (en_US as Record<string, string>)[key];
    }
    if (!text) {
      text = (zh_CN as Record<string, string>)[key] || (en_US as Record<string, string>)[key] || key;
    }
  }

  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
    }
  }

  return text;
}
