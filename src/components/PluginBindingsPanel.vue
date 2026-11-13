<template>
  <div class="binding-container">
    <div class="content-header">
      <h2>{{ t('takeoverConfig') }}{{ plugin.displayName }}</h2>
      <p class="subtitle">{{ plugin.pluginId }}</p>
    </div>

    <div class="binding-content">
      <!-- 多槽位展示模式（如对话模型 + 决策模型双模式） -->
      <div v-if="plugin.slots && plugin.slots.length > 0" class="multi-slots-container">
        <div
          class="card-status-info"
          :class="plugin.bindingState === 'full' ? 'bound-card' : (plugin.bindingState === 'partial' ? 'partial-card' : (plugin.isBound ? 'bound-card' : 'unbound-card'))"
          style="margin-bottom: 16px;"
        >
          <div class="status-title">
            {{ t('currentTakeoverStatus') }}
            <strong v-if="plugin.bindingState === 'full'">{{ t('allSlotsBound') }}</strong>
            <strong v-else-if="plugin.bindingState === 'partial'">{{ t('partialSlotsBound', { bound: plugin.boundSlotsCount ?? 0, total: plugin.totalSlotsCount ?? 0 }) }}</strong>
            <strong v-else>{{ t('allSlotsUnbound') }}</strong>
          </div>
          <div class="status-desc">
            {{ t('multiSlotsDesc') }}
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
              {{ slot.isBound ? t('bound') : t('unbound') }}
            </span>
          </div>

          <!-- 本地配置检测与一键导入（当未绑定且存在本地参数时） -->
          <div
            v-if="!slot.isBound && slot.localConfig && (slot.localConfig.baseUrl || slot.localConfig.apiKey || slot.localConfig.model)"
            class="local-config-import-card animate-fade-in"
            style="margin-bottom: 12px; padding: 10px; border-radius: 6px; background: rgba(0, 0, 0, 0.03);"
          >
            <div class="import-card-title" style="font-size: 12px; font-weight: 600;">
              {{ t('detectedLocalParam', { provider: getProviderName(slot.localConfig.provider), model: slot.localConfig.model || t('unspecified') }) }}
            </div>
            <div
              v-if="slot.matchedProfileName"
              class="matched-profile-hint"
              style="margin-top: 6px; padding: 4px 8px; background: rgba(54, 163, 247, 0.12); border-left: 3px solid #36a3f7; border-radius: 4px; font-size: 12px;"
            >
              {{ t('matchedProfileHint', { name: slot.matchedProfileName }) }}
            </div>
            <button
              class="b3-button b3-button--primary import-action-btn"
              style="margin-top: 8px; padding: 4px 10px; font-size: 11px; height: auto;"
              @click="$emit('importLocalConfig', plugin.pluginId, slot.slotId)"
            >
              <span v-if="slot.matchedProfileName">{{ t('bindExistingProfile', { name: slot.matchedProfileName }) }}</span>
              <span v-else>{{ t('importAsProfileAndTakeover') }}</span>
            </button>
          </div>

          <!-- 槽位 Profile 绑定下拉框 -->
          <div class="form-group binding-select-group" style="margin-bottom: 0;">
            <label style="font-size: 12px; margin-bottom: 4px; display: block; opacity: 0.85;">{{ t('bindProfileLabel') }}</label>
            <select class="b3-select select-lg" :value="slot.boundProfileId" @change="onSlotSelectChange(slot.slotId, $event)">
              <option value="">{{ t('doNotTakeoverSlot') }}</option>
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
            {{ t('currentTakeoverStatus') }}<strong>{{ plugin.isBound ? t('bound') : t('unbound') }}</strong>
          </div>
          <div class="status-desc">
            {{ plugin.isBound ? t('boundDesc') : t('unboundDesc') }}
          </div>
        </div>

        <div v-if="!plugin.isBound && plugin.localConfig && (plugin.localConfig.baseUrl || plugin.localConfig.apiKey || plugin.localConfig.model)" class="local-config-import-card animate-fade-in" style="margin-bottom: 16px;">
          <div class="import-card-title">
            {{ t('detectedLocalConfigTitle', { type: plugin.pluginId.startsWith(SIYUAN_BUILTIN_PREFIX) ? t('systemModule') : t('pluginWord') }) }}
          </div>
          <div class="import-card-desc" style="margin-top: 6px; line-height: 1.6;">
            <div>{{ t('baseParams', { provider: getProviderName(plugin.localConfig.provider), model: plugin.localConfig.model || t('unspecified'), url: plugin.localConfig.baseUrl || t('none') }) }}</div>
            <div style="margin-top: 4px; font-size: 12px; opacity: 0.9;">
              {{ t('advancedParams', { timeout: plugin.localConfig.requestTimeoutSeconds ?? 30, temp: plugin.localConfig.temperature ?? 0.7, maxTokens: plugin.localConfig.maxTokens ? plugin.localConfig.maxTokens : t('unlimited') }) }}
              <span v-if="(plugin.localConfig as any).maxHistoryMessages !== undefined">{{ t('contextRounds', { rounds: (plugin.localConfig as any).maxHistoryMessages }) }}</span>
              <span v-if="(plugin.localConfig as any).maxToolCallRounds !== undefined">{{ t('toolCallRounds', { rounds: (plugin.localConfig as any).maxToolCallRounds }) }}</span>
              <span v-if="(plugin.localConfig as any).sessionTimeout !== undefined">{{ t('sessionTimeoutParam', { sec: (plugin.localConfig as any).sessionTimeout }) }}</span>
              <span v-if="(plugin.localConfig as any).streamIdleTimeout !== undefined">{{ t('streamIdleTimeoutParam', { sec: (plugin.localConfig as any).streamIdleTimeout }) }}</span>
            </div>
          </div>
          <div v-if="plugin.matchedProfileName" class="matched-profile-hint" style="margin-top: 8px; padding: 6px 10px; background: rgba(54, 163, 247, 0.12); border-left: 3px solid #36a3f7; border-radius: 4px; font-size: 12px; color: var(--b3-theme-on-surface);">
            {{ t('matchedProfilePluginHint', { name: plugin.matchedProfileName }) }}
          </div>
          <button class="b3-button b3-button--primary import-action-btn" style="margin-top: 10px; padding: 4px 10px; font-size: 11px; height: auto;" @click="$emit('importLocalConfig', plugin.pluginId)">
            <span v-if="plugin.matchedProfileName">{{ t('bindExistingProfileAndTakeover', { name: plugin.matchedProfileName }) }}</span>
            <span v-else>{{ t('importAsProfileAndTakeover') }}</span>
          </button>
        </div>

        <div class="form-group binding-select-group">
          <label>{{ t('bindProfileLabel') }}</label>
          <select class="b3-select select-lg" :value="plugin.boundProfileId" @change="onSelectChange($event)">
            <option value="">{{ t('doNotTakeoverPlugin') }}</option>
            <option v-for="prof in profiles" :key="prof.id" :value="prof.id">
              🔗 {{ prof.name }} ({{ getProviderName(prof.provider) }} | {{ prof.model }})
            </option>
          </select>
        </div>
      </div>

      <div class="binding-tips" v-if="plugin.boundProfileId || (plugin.slots && plugin.slots.some(s => s.isBound))">
        <h3>{{ t('takeoverFieldsTitle') }}</h3>
        <ul>
          <li>{{ t('takeoverField1') }}</li>
          <li>{{ t('takeoverField2') }}</li>
          <li>{{ t('takeoverField3') }}</li>
          <li>{{ t('takeoverField4') }}</li>
        </ul>
        <p class="warning-text">{{ t('takeoverNotice') }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { RegisteredPluginInfo, ApiProfile } from "@/services/api-switch-core";
import { SIYUAN_BUILTIN_PREFIX } from "@/constants/siyuan-scopes";
import { PRESET_PROVIDERS } from "@/constants/providers";
import { t } from "@/utils/i18n";

defineProps<{
  plugin: RegisteredPluginInfo;
  profiles: ApiProfile[];
}>();

const emit = defineEmits<{
  (e: "bindingChange", profileId: string, slotId?: string): void;
  (e: "importLocalConfig", pluginId: string, slotId?: string): void;
}>();

const getProviderName = (provider: string) => {
  const preset = PRESET_PROVIDERS[provider];
  if (preset) return preset.displayName;
  const dict: Record<string, string> = {
    custom: t("custom"),
    systemone: t("protoSystemOne"),
  };
  return dict[provider] || provider || t("unknown");
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
