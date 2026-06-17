# 思源笔记 API 管家 (siyuan-api-manager)

思源笔记 API 管家是一款旨在帮助用户集中化管理、切换和共享 AI 服务 API 配置的插件。

---

## 💡 为什么需要 API 管家？
思源笔记生态中有大量优秀的 AI 辅助插件（如文献总结、知识图谱分析、Muse 写作助手等）。但每个插件都需要单独配置 AI 的 API 地址、API Key、模型名称等通用参数。
- **痛点**：当您需要更换 API Key 或切换 AI 提供商（如从 DeepSeek 切换到 SiliconFlow）时，必须进入每个插件逐个修改，十分繁琐。
- **解决方式**：**API 管家** 提供统一的 Profile 管理。您只需配置一次，就可以将指定的 Profile 绑定接管到其他插件，实现一键共享与无缝切换。

---

## ✨ 核心特性

1. **集中式 Profile 管理**
   - 完美适配深浅色主题的拟物化磨砂玻璃后台界面。
   - 内置并支持 DeepSeek、Google Gemini、SiliconFlow、OpenAI 及自定义（Custom）等主流服务商。
   - 自定义 Profile 包含：Base URL、API Key、Model 模型、超时时间、Temperature、Max Tokens、备注说明及服务商官网链接。

2. **一键分发与接管**
   - 自动发现所有在全局注册的兼容子插件。
   - 提供直观的绑定面板，可将特定的配置 Profile 灵活绑定至具体的插件（例如：文献助手使用 DeepSeek，Muse 写作助手使用 OpenAI）。
   - 绑定后，子插件原生设置面板中被接管的输入框会自动置灰并展示接管提示，无需重启即可实时重定向 AI 请求。

3. **零输入一键导入**
   - 当检测到已注册的插件拥有本地独立 API 配置时，绑定面板会显示「一键导入为 Profile 并接管」的选项。
   - 一键自动将本地配置迁移为管家全局 Profile 并实现绑定，免除手动复制粘贴秘钥的烦恼。

4. **优雅的降级保护**
   - 采用全局解耦设计。若未安装 API 管家插件，子插件将完全无感地继续使用其自身独立的本地配置面板，没有任何副作用。

---

## 🛠️ 第三方插件接入协议 (开发者指南)

作为思源笔记插件开发者，您只需在子插件中加入约 20 行极简的同步逻辑，即可加入 API 管家的生态中。

### 1. 初始化时主动注册并监听
在子插件的 `onload` 方法中加入以下注册逻辑，并在回调中接收 API 配置的覆盖和还原：

```typescript
// 保存内存接管变量
private managedAiConfig: any | null = null;

private initApiManagerSync() {
  const sync = (shared: any | null) => {
    if (shared) {
      // 1. 进入接管状态：将管家下发的 SharedConfig 保存并覆盖本地 API 调用
      this.managedAiConfig = {
        baseUrl: shared.baseUrl,
        apiKey: shared.apiKey,
        model: shared.model,
        requestTimeoutSeconds: shared.requestTimeoutSeconds ?? 60,
        temperature: shared.temperature ?? 0.7,
        maxTokens: shared.maxTokens ?? 4096,
      };
    } else {
      // 2. 退出接管状态：还原为插件原生的本地配置
      this.managedAiConfig = null;
    }
    
    // 3. 通知您自己的设置面板 UI 重新渲染（例如置灰或解禁 inputs）
    if (this.setting) {
      const updater = (this.setting as any).updateManagedConfig;
      if (typeof updater === "function") {
        updater(this.managedAiConfig);
      }
    }
  };

  // 4. 提取当前插件已有的本地配置，供管家做一键导入迁移
  const localConfig = {
    provider: "custom", // 您的服务商标识
    baseUrl: this.config.baseUrl,
    apiKey: this.config.apiKey,
    model: this.config.model,
    requestTimeoutSeconds: this.config.requestTimeoutSeconds,
    temperature: this.config.temperature,
    maxTokens: this.config.maxTokens,
  };

  if (window.siyuanApiManager) {
    window.siyuanApiManager.register(this.name, this.displayName, sync, localConfig);
  } else {
    // 兼容思源插件并行加载时，管家加载慢于子插件的情况
    window.addEventListener("siyuan-api-manager:ready", () => {
      if (window.siyuanApiManager) {
        window.siyuanApiManager.register(this.name, this.displayName, sync, localConfig);
      }
    }, { once: true });
  }
}
```

### 2. 卸载时注销
在子插件的 `onunload` 生命周期方法中，调用注销方法释放内存占用：

```typescript
onunload() {
  if (window.siyuanApiManager) {
    window.siyuanApiManager.unregister(this.name);
  }
}
```

---

## 📦 已适配接管的插件列表

- [siyuan-doc-assist (文献助手)](https://github.com/famotime/siyuan-doc-assist)
- [siyuan-network-lens (关系图谱分析)](https://github.com/famotime/siyuan-network-lens)
- [siyuan-muse (Muse 写作助手)](https://github.com/famotime/siyuan-muse)
