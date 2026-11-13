<template>
  <div class="confirm-overlay" @click.self="$emit('cancel')">
    <div class="preset-picker-dialog animate-fade-in">
      <div class="preset-picker-title">{{ t('addProviderTitle') }}</div>
      <div class="preset-picker-body">
        <div v-for="group in groups" :key="group.key" class="preset-group">
          <div class="preset-group-title">{{ group.title }}</div>
          <div class="preset-grid">
            <button
              v-for="preset in group.items"
              :key="preset.id"
              type="button"
              class="preset-card"
              @click="$emit('select', preset.id)"
            >
              <div class="preset-card-header">
                <img
                  v-if="preset.icon && !failedIcons.has(preset.id)"
                  class="preset-card-icon"
                  :src="preset.icon"
                  alt=""
                  loading="lazy"
                  @error="failedIcons.add(preset.id)"
                />
                <span v-else class="preset-card-icon preset-card-icon--fallback">{{ preset.displayName.charAt(0) || '＋' }}</span>
                <span class="preset-card-name">{{ preset.displayName }}</span>
              </div>
              <div class="preset-card-url">{{ preset.defaultBaseUrl || t('manualUrlAndModel') }}</div>
              <div class="preset-card-tags">
                <span v-if="preset.region === 'china'" class="preset-chip preset-chip--china">{{ t('regionChina') }}</span>
                <span v-else-if="preset.region === 'international'" class="preset-chip preset-chip--intl">{{ t('regionIntl') }}</span>
                <span class="preset-chip preset-chip--proto">{{ protocolLabel(preset.protocol) }}</span>
              </div>
            </button>
          </div>
        </div>
      </div>
      <div class="confirm-actions">
        <button class="b3-button b3-button--cancel" @click="$emit('cancel')">{{ t('cancel') }}</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { PRESET_PROVIDER_LIST, PresetProviderInfo } from "@/constants/providers";
import { t } from "@/utils/i18n";

defineEmits<{
  (e: "select", presetId: string): void;
  (e: "cancel"): void;
}>();

// 图标加载失败（老版本内核缺失该资源等）时回退为文字头像
const failedIcons = ref(new Set<string>());

const groups = computed(() => {
  const by = (category: PresetProviderInfo["category"]) =>
    PRESET_PROVIDER_LIST.filter((p) => p.category === category);
  return [
    { key: "official", title: t("presetGroupOfficial"), items: by("official") },
    { key: "aggregator", title: t("presetGroupAggregator"), items: by("aggregator") },
    { key: "local", title: t("presetGroupLocal"), items: by("local") },
    { key: "custom", title: t("presetGroupCustom"), items: by("custom") },
  ].filter((g) => g.items.length > 0);
});

const protocolLabel = (protocol: string) => {
  if (protocol === "anthropic-messages") return "Anthropic Messages";
  if (protocol === "openai-responses") return "OpenAI Responses";
  if (protocol === "systemone") return "System One (Jev)";
  return t("protoOpenAiCompat");
};
</script>
