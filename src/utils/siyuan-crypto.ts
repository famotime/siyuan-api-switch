/**
 * 思源笔记专属 API 密钥加解密与提取工具
 * 对应思源内核 kernel/util/crypt.go 与 kernel/conf/ai.go
 */

// 思源笔记内核内置的 AES 加密固定密钥与初始向量
const SIYUAN_SK = "696D897C9AA0611B";
const SIYUAN_IV = "RandomInitVector";

/**
 * 尝试对思源笔记持久化存储的 AES-128-CBC 密文 APIKey 进行解密
 * 思源加密逻辑：hex(apiKey) -> AES-128-CBC(SK, IV) -> hex(crypted)
 * 若解密成功且明文有效则返回明文；否则原样返回输入字符串。
 */
export function decryptSiyuanApiKey(cipherHex: string): string {
  if (!cipherHex || typeof cipherHex !== "string") return cipherHex;
  const trimmed = cipherHex.trim();

  // 思源 AES 密文特征：全十六进制字符，长度至少 32 且为 32 的整数倍
  if (trimmed.length < 32 || trimmed.length % 32 !== 0 || !/^[0-9a-fA-F]+$/.test(trimmed)) {
    return cipherHex;
  }

  try {
    let cryptoMod: any = null;
    // 兼容 Node.js 与 Electron 渲染/主进程环境
    try {
      if (typeof require === "function") {
        cryptoMod = require("crypto");
      }
    } catch {}

    if (cryptoMod && typeof cryptoMod.createDecipheriv === "function") {
      const key = Buffer.from(SIYUAN_SK, "utf8");
      const iv = Buffer.from(SIYUAN_IV, "utf8");
      const decipher = cryptoMod.createDecipheriv("aes-128-cbc", key, iv);
      decipher.setAutoPadding(true);
      const decBuf = Buffer.concat([
        decipher.update(Buffer.from(trimmed, "hex")),
        decipher.final(),
      ]);
      const hexStr = decBuf.toString("utf8");
      if (/^[0-9a-fA-F]+$/.test(hexStr)) {
        const plain = Buffer.from(hexStr, "hex").toString("utf8");
        if (plain && plain.length > 0) {
          return plain;
        }
      }
    }
  } catch {
    // 解密失败则安全返回原值
  }

  return cipherHex;
}

/**
 * 健壮地从任意思源笔记配置节点中提取 API Key
 * 支持兼容多种常见大小写与属性名：
 * apiKey, APIKey, api_key, apikey, key, token, secret
 * 并自动检测思源 AES 密文进行解密还原为明文
 */
export function extractApiKey(obj: any): string {
  if (!obj || typeof obj !== "object") return "";
  const rawKey =
    obj.apiKey ||
    obj.APIKey ||
    obj.api_key ||
    obj.apikey ||
    obj.key ||
    obj.token ||
    obj.secret ||
    "";
  if (typeof rawKey !== "string") return "";
  const trimmed = rawKey.trim();
  if (!trimmed) return "";
  return decryptSiyuanApiKey(trimmed);
}

/**
 * 健壮提取 Base URL / Endpoint
 */
export function extractBaseUrl(obj: any, isDecision = false): string {
  if (!obj || typeof obj !== "object") {
    return isDecision ? "https://api.typesafe.ai/v1/systemone" : "";
  }
  const url =
    obj.endpoint ||
    obj.baseURL ||
    obj.baseUrl ||
    obj.apiBaseURL ||
    obj.apiBaseUrl ||
    obj.url ||
    "";
  if (typeof url === "string" && url.trim()) {
    return url.trim();
  }
  return isDecision ? "https://api.typesafe.ai/v1/systemone" : "";
}

/**
 * 健壮提取模型名称
 */
export function extractModelName(obj: any, isDecision = false): string {
  if (!obj || typeof obj !== "object") {
    return isDecision ? "jev-latest" : "";
  }
  const name = obj.name || obj.model || obj.modelId || obj.id || "";
  if (typeof name === "string" && name.trim()) {
    return name.trim();
  }
  return isDecision ? "jev-latest" : "";
}
