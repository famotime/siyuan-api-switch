<template>
  <div class="binding-container">
    <div class="content-header">
      <h2>接管配置：{{ plugin.displayName }}</h2>
      <p class="subtitle">{{ plugin.pluginId }}</p>
    </div>

    <div class="binding-content">
      <div class="card-status-info" :class="plugin.isBound ? 'bound-card' : 'unbound-card'">
        <div class="status-title">
          当前接管状态: <strong>{{ plugin.isBound ? '已接管' : '独立配置 (未接管)' }}</strong>
        </div>
        <div class="status-desc">
          {{ plugin.isBound 
            ? '当前子插件的通用 AI API 配置由 API 旋钮接管。子插件原配置面板的相应字段已置灰只读。' 
            : '当前子插件独立运行，使用其自身的配置面板所保存的 API 配置。' }}
        </div>
      </div>

      <div v-if="!plugin.isBound && plugin.localConfig && (plugin.localConfig.baseUrl || plugin.localConfig.apiKey || plugin.localConfig.model)" class="local-config-import-card animate-fade-in" style="margin-bottom: 16px;">
        <div class="import-card-title">
          💡 检测到该插件已有本地配置与高级参数
        </div>
        <div class="import-card-desc" style="margin-top: 6px; line-height: 1.6;">
          <div>基础参数：服务商 <strong>{{ getProviderName(plugin.localConfig.provider) }}</strong> | 模型 <strong>{{ plugin.localConfig.model || '未指定' }}</strong> | 地址 <code>{{ plugin.localConfig.baseUrl || '无' }}</code></div>
          <div style="margin-top: 4px; font-size: 12px; opacity: 0.9;">
            高级参数：超时 <strong>{{ plugin.localConfig.requestTimeoutSeconds ?? 30 }}s</strong> | 
            温度 <strong>{{ plugin.localConfig.temperature ?? 0.7 }}</strong> | 
            Max Tokens <strong>{{ plugin.localConfig.maxTokens ? plugin.localConfig.maxTokens : '不限(0)' }}</strong>
            <span v-if="(plugin.localConfig as any).maxHistoryMessages !== undefined"> | 上下文 <strong>{{ (plugin.localConfig as any).maxHistoryMessages }} 轮</strong></span>
            <span v-if="(plugin.localConfig as any).maxToolCallRounds !== undefined"> | 工具调用 <strong>{{ (plugin.localConfig as any).maxToolCallRounds }} 轮</strong></span>
            <span v-if="(plugin.localConfig as any).sessionTimeout !== undefined"> | 会话超时 <strong>{{ (plugin.localConfig as any).sessionTimeout }}s</strong></span>
            <span v-if="(plugin.localConfig as any).streamIdleTimeout !== undefined"> | 流空闲超时 <strong>{{ (plugin.localConfig as any).streamIdleTimeout }}s</strong></span>
          </div>
        </div>
        <button class="b3-button b3-button--primary import-action-btn" style="margin-top: 10px; padding: 4px 10px; font-size: 11px; height: auto;" @click="$emit('importLocalConfig', plugin.pluginId)">
          📥 一键导入为 Profile 并接管
        </button>
      </div>

      <div class="form-group binding-select-group">
        <label>绑定 API 配置文件 (Profile)</label>
        <select class="b3-select select-lg" :value="plugin.boundProfileId" @change="onSelectChange($event)">
          <option value="">❌ 独立配置 (不接管此插件)</option>
          <option v-for="prof in profiles" :key="prof.id" :value="prof.id">
            🔗 {{ prof.name }} ({{ getProviderName(prof.provider) }} | {{ prof.model }})
          </option>
        </select>
      </div>

      <div class="binding-tips" v-if="plugin.boundProfileId">
        <h3>接管字段包括：</h3>
        <ul>
          <li>API Base URL 和 API Key</li>
          <li>默认 Model 模型名称</li>
          <li>请求超时时间 (Timeout)</li>
          <li>Temperature 采样温度与 Max Tokens 限制</li>
        </ul>
        <p class="warning-text">⚠️ 提示：绑定完成后，该子插件的 AI 请求将实时重定向至旋钮配置，无需手动重启插件。</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { RegisteredPluginInfo, ApiProfile } from "@/services/api-switch-core";

defineProps<{
  plugin: RegisteredPluginInfo;
  profiles: ApiProfile[];
}>();

const emit = defineEmits<{
  (e: "bindingChange", profileId: string): void;
  (e: "importLocalConfig", pluginId: string): void;
}>();

const getProviderName = (provider: string) => {
  const dict: Record<string, string> = {
    deepseek: "DeepSeek",
    gemini: "Google Gemini",
    siliconflow: "SiliconFlow",
    openai: "OpenAI",
    custom: "自定义",
  };
  return dict[provider] || provider || "未知";
};

const onSelectChange = (e: Event) => {
  const target = e.target as HTMLSelectElement;
  emit("bindingChange", target.value);
};
</script>
