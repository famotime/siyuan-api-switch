<template>
  <div class="binding-container">
    <div class="content-header">
      <h2>接管配置：{{ plugin.displayName }}</h2>
      <p class="subtitle">{{ plugin.pluginId }}</p>
    </div>

    <div class="binding-content">
      <!-- 多槽位展示模式（如对话模型 + 决策模型双模式） -->
      <div v-if="plugin.slots && plugin.slots.length > 0" class="multi-slots-container">
        <div class="card-status-info" :class="plugin.isBound ? 'bound-card' : 'unbound-card'" style="margin-bottom: 16px;">
          <div class="status-title">
            当前接管状态: <strong>{{ plugin.isBound ? '部分或全部槽位已接管' : '独立配置 (全部未接管)' }}</strong>
          </div>
          <div class="status-desc">
            该插件支持双模型/多槽位配置。您可以为每个槽位独立绑定 API Profile 或使用插件本地配置。
          </div>
        </div>

        <div
          v-for="slot in plugin.slots"
          :key="slot.slotId"
          class="slot-card"
          style="margin-bottom: 18px; padding: 14px 16px; border: 1px solid var(--b3-theme-surface-lighter, #e0e0e0); border-radius: 8px; background: var(--b3-theme-surface);"
        >
          <div class="slot-card-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <div style="font-weight: 600; font-size: 14px; display: flex; align-items: center; gap: 6px;">
              <span>{{ slot.slotId === 'chat' ? '💬' : (slot.slotId === 'decision' ? '🧠' : '⚙️') }}</span>
              <span>{{ slot.name }}</span>
              <span v-if="slot.description" style="font-size: 12px; font-weight: normal; opacity: 0.7;">({{ slot.description }})</span>
            </div>
            <span :class="['status-badge', slot.isBound ? 'bound' : 'unbound']">
              {{ slot.isBound ? '已接管' : '独立配置' }}
            </span>
          </div>

          <!-- 本地配置检测与一键导入（当未绑定且存在本地参数时） -->
          <div
            v-if="!slot.isBound && slot.localConfig && (slot.localConfig.baseUrl || slot.localConfig.apiKey || slot.localConfig.model)"
            class="local-config-import-card animate-fade-in"
            style="margin-bottom: 12px; padding: 10px; border-radius: 6px; background: rgba(0, 0, 0, 0.03);"
          >
            <div class="import-card-title" style="font-size: 12px; font-weight: 600;">
              💡 检测到该槽位本地参数：服务商 <strong>{{ getProviderName(slot.localConfig.provider) }}</strong> | 模型 <strong>{{ slot.localConfig.model || '未指定' }}</strong>
            </div>
            <div
              v-if="slot.matchedProfileName"
              class="matched-profile-hint"
              style="margin-top: 6px; padding: 4px 8px; background: rgba(54, 163, 247, 0.12); border-left: 3px solid #36a3f7; border-radius: 4px; font-size: 12px;"
            >
              ✨ 检测到与已有场景配置 <strong>「{{ slot.matchedProfileName }}」</strong> 一致，点击直接复用绑定
            </div>
            <button
              class="b3-button b3-button--primary import-action-btn"
              style="margin-top: 8px; padding: 4px 10px; font-size: 11px; height: auto;"
              @click="$emit('importLocalConfig', plugin.pluginId, slot.slotId)"
            >
              <span v-if="slot.matchedProfileName">🔗 直接绑定「{{ slot.matchedProfileName }}」</span>
              <span v-else>📥 一键导入为 Profile 并接管</span>
            </button>
          </div>

          <!-- 槽位 Profile 绑定下拉框 -->
          <div class="form-group binding-select-group" style="margin-bottom: 0;">
            <label style="font-size: 12px; margin-bottom: 4px; display: block; opacity: 0.85;">绑定 API 配置文件 (Profile)</label>
            <select class="b3-select select-lg" :value="slot.boundProfileId" @change="onSlotSelectChange(slot.slotId, $event)">
              <option value="">❌ 独立配置 (不接管此槽位)</option>
              <option v-for="prof in profiles" :key="prof.id" :value="prof.id">
                🔗 {{ prof.name }} ({{ getProviderName(prof.provider) }} | {{ prof.model }})
              </option>
            </select>
          </div>
        </div>
      </div>

      <!-- 单模型常规展示模式 -->
      <div v-else class="single-slot-container">
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
            💡 检测到该{{ plugin.pluginId.startsWith('siyuan_builtin') ? '系统模块' : '插件' }}已有配置与高级参数
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
          <div v-if="plugin.matchedProfileName" class="matched-profile-hint" style="margin-top: 8px; padding: 6px 10px; background: rgba(54, 163, 247, 0.12); border-left: 3px solid #36a3f7; border-radius: 4px; font-size: 12px; color: var(--b3-theme-on-surface);">
            ✨ 检测到与已有场景配置 <strong>「{{ plugin.matchedProfileName }}」</strong> 一致，点击将直接复用绑定，避免生成重复配置
          </div>
          <button class="b3-button b3-button--primary import-action-btn" style="margin-top: 10px; padding: 4px 10px; font-size: 11px; height: auto;" @click="$emit('importLocalConfig', plugin.pluginId)">
            <span v-if="plugin.matchedProfileName">🔗 直接绑定已有配置「{{ plugin.matchedProfileName }}」并接管</span>
            <span v-else>📥 一键导入为 Profile 并接管</span>
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
      </div>

      <div class="binding-tips" v-if="plugin.boundProfileId || (plugin.slots && plugin.slots.some(s => s.isBound))">
        <h3>接管字段包括：</h3>
        <ul>
          <li>API Base URL 和 API Key</li>
          <li>默认 Model 模型名称</li>
          <li>请求超时时间 (Timeout)</li>
          <li>Temperature 采样温度与 Max Tokens 限制</li>
        </ul>
        <p class="warning-text">💡 提示：绑定完成后，AI 请求与思源原生系统配置将自动联动生效，无需手动写回或重启插件。</p>
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
  (e: "bindingChange", profileId: string, slotId?: string): void;
  (e: "importLocalConfig", pluginId: string, slotId?: string): void;
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

const onSlotSelectChange = (slotId: string, e: Event) => {
  const target = e.target as HTMLSelectElement;
  emit("bindingChange", target.value, slotId);
};
</script>
