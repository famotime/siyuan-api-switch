<template>
  <div class="form-container">
    <div class="content-header">
      <h2>{{ isNew ? t('newProfileTitle') : t('editProfileTitle') }}</h2>
    </div>
    <div class="form-scroll-wrapper">
      <!-- 关联 API 提供商选择 -->
      <div class="form-group" style="background: rgba(63,81,181,0.06); padding: 10px 12px; border-radius: 6px; border: 1px dashed rgba(63,81,181,0.25); margin-bottom: 14px;">
        <label style="font-weight: 600; color: var(--b3-theme-primary); margin-bottom: 4px; display: block;">{{ t('linkProviderLabel') }}</label>
        <select class="b3-select" v-model="localProfile.providerId" @change="onProfileProviderSelect">
          <option value="">{{ t('noProviderLinked') }}</option>
          <option v-for="prov in providers" :key="prov.id" :value="prov.id">
            {{ prov.displayName }} ({{ prov.protocol || 'openai' }}) - {{ t('availableModelsCount', { count: (prov.models && prov.models.length) || 0 }) }}
          </option>
        </select>
        <div v-if="localProfile.providerId" style="margin-top: 6px; font-size: 12px; opacity: 0.85; line-height: 1.5;">
          {{ t('providerInheritedHint') }}
        </div>
      </div>

      <div class="form-row">
        <div class="form-group col-6">
          <label>{{ t('profileName') }}</label>
          <input 
            type="text" 
            class="b3-text-field" 
            v-model="localProfile.name" 
            @input="onNameInput"
            @blur="onNameBlur"
            :placeholder="t('profileNamePlaceholder')" 
          />
        </div>
        <div class="form-group col-6">
          <div class="label-with-link">
            <label>{{ t('aiProvider') }}</label>
            <a v-if="localProfile.providerUrl" href="javascript:void(0)" @click.prevent="openProviderUrl(localProfile.providerUrl)" class="provider-link-btn" :data-tooltip="t('getApiKeyTooltip')" data-tooltip-position="bottom">
              <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" style="fill:none!important"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
            </a>
          </div>
          <input v-if="localProfile.providerId" type="text" class="b3-text-field" :value="localProfile.provider" disabled />
          <select v-else class="b3-select" v-model="localProfile.provider" @change="onProviderChange">
            <option v-for="preset in presetOptions" :key="preset.id" :value="preset.id">{{ preset.displayName }}</option>
            <option value="custom">{{ t('customProvider') }}</option>
          </select>
        </div>
      </div>

      <div class="form-group">
        <label>{{ t('baseUrl') }}</label>
        <input type="text" class="b3-text-field" v-model="localProfile.baseUrl" :disabled="Boolean(localProfile.providerId)" placeholder="https://api.example.com/v1" />
      </div>

      <div class="form-group">
        <label>{{ t('apiKeyRequired') }}</label>
        <div class="input-password-wrapper">
          <input 
            :type="showApiKey ? 'text' : 'password'" 
            class="b3-text-field" 
            v-model="localProfile.apiKey" 
            :disabled="Boolean(localProfile.providerId)"
            placeholder="sk-..." 
          />
          <button class="toggle-password-btn" @click="showApiKey = !showApiKey" type="button" :data-tooltip="showApiKey ? t('hideApiKey') : t('showApiKey')" data-tooltip-position="left">
            <svg v-if="showApiKey" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" style="fill:none!important"></path><circle cx="12" cy="12" r="3" style="fill:none!important"></circle></svg>
            <svg v-else viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" style="fill:none!important"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
          </button>
        </div>
      </div>

      <div class="form-row">
        <div class="form-group col-8">
          <label>{{ t('activeModel') }}</label>
          <select class="b3-select" v-model="localProfile.model">
            <option v-for="m in currentAvailableModels" :key="m" :value="m">{{ m }}</option>
          </select>
        </div>
        <div class="form-group col-4" v-if="!localProfile.providerId">
          <label>{{ t('addPresetModel') }}</label>
          <select class="b3-select" @change="selectPresetModel($event)">
            <option value="">{{ t('selectAndAdd') }}</option>
            <option v-for="m in presetModels[localProfile.provider] || []" :key="m" :value="m">{{ m }}</option>
          </select>
        </div>
      </div>

      <div class="form-group" v-if="!localProfile.providerId">
        <label>{{ t('modelPool') }}</label>
        <div class="model-pool-container">
          <div class="model-tags" v-if="localProfile.models && localProfile.models.length > 0">
            <span 
              v-for="m in localProfile.models" 
              :key="m" 
              :class="['model-tag', { active: localProfile.model === m }]"
              @click="localProfile.model = m"
              :title="t('setAsActiveModel')"
            >
              {{ m }}
              <span class="remove-tag" @click.stop="removeModel(m)" :title="t('removeFromPool')">×</span>
            </span>
          </div>
          <div class="model-tags-empty" v-else>
            {{ t('modelPoolEmpty') }}
          </div>
          <div class="add-model-input-group">
            <input 
              type="text" 
              class="b3-text-field mini-input" 
              v-model="newModelInput" 
              :placeholder="t('inputModelPlaceholder')" 
              @keyup.enter="addCustomModel"
            />
            <button class="b3-button b3-button--primary mini-btn" @click="addCustomModel" type="button">{{ t('add') }}</button>
          </div>
        </div>
      </div>

      <!-- 决策模型标识开关 -->
      <div class="form-group" style="margin-top: 6px;">
        <label class="form-checkbox-label" style="display: flex; align-items: center; gap: 8px; font-weight: 500; cursor: pointer;">
          <input type="checkbox" v-model="localProfile.isDecisionModel" />
          <span>{{ t('setAsDecisionModel') }}</span>
        </label>
      </div>

      <!-- 折叠的高级设置面板 -->
      <div class="advanced-divider" @click="showAdvanced = !showAdvanced">
        <span>{{ t('advancedSettings') }}</span>
        <svg :class="['arrow-icon', { expanded: showAdvanced }]" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9" style="fill:none!important"></polyline></svg>
      </div>

      <div class="advanced-fields" v-show="showAdvanced">
        <div class="form-row">
          <div class="form-group col-4">
            <label>{{ t('requestTimeout') }}</label>
            <input type="number" class="b3-text-field" v-model.number="localProfile.requestTimeoutSeconds" :placeholder="t('timeoutPlaceholder')" min="1" max="600" />
          </div>
          <div class="form-group col-4">
            <label>{{ t('temperature') }}</label>
            <input type="number" class="b3-text-field" v-model.number="localProfile.temperature" :placeholder="t('temperaturePlaceholder')" step="0.1" min="0" max="2" />
          </div>
          <div class="form-group col-4">
            <label>{{ t('maxTokens') }}</label>
            <input type="number" class="b3-text-field" v-model.number="localProfile.maxTokens" :placeholder="t('maxTokensPlaceholder')" min="0" />
          </div>
        </div>

        <div class="form-row">
          <div class="form-group col-4">
            <label>{{ t('maxHistoryMessages') }}</label>
            <input type="number" class="b3-text-field" v-model.number="localProfile.maxHistoryMessages" :placeholder="t('maxHistoryMessagesPlaceholder')" min="1" max="64" />
          </div>
          <div class="form-group col-4">
            <label>{{ t('maxToolCallRounds') }}</label>
            <input type="number" class="b3-text-field" v-model.number="localProfile.maxToolCallRounds" :placeholder="t('maxToolCallRoundsPlaceholder')" min="0" />
          </div>
          <div class="form-group col-4">
            <label>{{ t('sessionTimeout') }}</label>
            <input type="number" class="b3-text-field" v-model.number="localProfile.sessionTimeout" :placeholder="t('sessionTimeoutPlaceholder')" min="0" max="3600" />
          </div>
        </div>

        <div class="form-row">
          <div class="form-group col-4">
            <label>{{ t('streamIdleTimeout') }}</label>
            <input type="number" class="b3-text-field" v-model.number="localProfile.streamIdleTimeout" :placeholder="t('streamIdleTimeoutPlaceholder')" min="1" max="600" />
          </div>
          <div class="form-group col-4">
            <label>{{ t('confirmTimeout') }}</label>
            <input type="number" class="b3-text-field" v-model.number="localProfile.confirmTimeout" :placeholder="t('confirmTimeoutPlaceholder')" min="1" max="600" />
          </div>
          <div class="form-group col-4">
            <label>{{ t('maxRetries') }}</label>
            <input type="number" class="b3-text-field" v-model.number="localProfile.maxRetries" :placeholder="t('maxRetriesPlaceholder')" min="0" max="10" />
          </div>
        </div>

        <div class="form-group">
          <label>{{ t('memo') }}</label>
          <textarea class="b3-text-field textarea-field" v-model="localProfile.memo" :placeholder="t('memoPlaceholder')"></textarea>
        </div>
      </div>
    </div>

    <div class="form-actions">
      <button class="b3-button b3-button--error" v-if="!isNew" @click.stop="$emit('delete', localProfile.id)" type="button">{{ t('delete') }}</button>
      <div class="flex-spacer"></div>
      <transition name="fade">
        <span v-if="isSaved" class="saved-inline-hint">
          <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          <span>{{ t('saved') }}</span>
        </span>
      </transition>
      <button class="b3-button b3-button--cancel" @click="$emit('cancel')">{{ t('cancel') }}</button>
      <button 
        class="b3-button b3-button--primary" 
        :class="{ 'b3-button--saved': isSaved }" 
        @click="handleSave"
      >
        <svg v-if="isSaved" class="saved-btn-icon" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        <span>{{ isSaved ? t('saved') : t('save') }}</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from "vue";
import { useSavedFeedback } from "@/composables/useSavedFeedback";
import { useDirtySnapshot } from "@/composables/useDirtySnapshot";
import { ApiProfile } from "@/services/api-switch-core";
import { ApiProvider } from "@/types";
import { PRESET_PROVIDERS, PRESET_PROVIDER_LIST } from "@/constants/providers";
import { computeDefaultProfileName } from "@/utils/profile-naming";
import { t } from "@/utils/i18n";

const props = defineProps<{
  profile: ApiProfile;
  isNew: boolean;
  providers: ApiProvider[];
}>();

const emit = defineEmits<{
  (e: "save", profile: ApiProfile): void;
  (e: "delete", id: string): void;
  (e: "cancel"): void;
}>();

const localProfile = ref<ApiProfile>({ ...props.profile });
const showApiKey = ref(false);
const showAdvanced = ref(false);
const newModelInput = ref("");
const isNameManuallyEdited = ref(false);
// 保存反馈与脏检查快照（共享 composable，defineExpose 契约不变）
const { isSaved, showSavedFeedback, clearSavedFeedback } = useSavedFeedback();

const presetOptions = PRESET_PROVIDER_LIST.filter((p) => p.category !== "custom");

const presetModels = computed<Record<string, string[]>>(() => {
  const map: Record<string, string[]> = { custom: [] };
  for (const preset of PRESET_PROVIDER_LIST) {
    map[preset.id] = preset.presetModels;
  }
  return map;
});

const generateDefaultName = () => {
  return computeDefaultProfileName(
    localProfile.value.providerId,
    localProfile.value.provider,
    localProfile.value.model,
    props.providers
  );
};

const { updateInitialSnapshot, isDirty } = useDirtySnapshot(() => localProfile.value);

watch(
  () => props.profile,
  (newVal, oldVal) => {
    if (oldVal && newVal?.id !== oldVal?.id) {
      clearSavedFeedback();
    }
    localProfile.value = {
      ...newVal,
      models: newVal.models ? [...newVal.models] : [],
    };
    if (props.isNew) {
      isNameManuallyEdited.value = false;
      localProfile.value.name = generateDefaultName();
    } else {
      isNameManuallyEdited.value = true;
    }
    nextTick(() => {
      updateInitialSnapshot();
    });
  },
  { immediate: true, deep: true }
);

// 监听 localProfile，当用户在已保存后重新改动导致变 dirty 时，立即清除已保存提示
watch(
  localProfile,
  () => {
    if (isSaved.value && isDirty()) {
      clearSavedFeedback();
    }
  },
  { deep: true }
);

// 联动自动更新名称（当且仅当新建且用户尚未手动自定义输入名称）
watch(
  [() => localProfile.value.providerId, () => localProfile.value.provider, () => localProfile.value.model],
  () => {
    if (props.isNew && !isNameManuallyEdited.value) {
      localProfile.value.name = generateDefaultName();
    }
  }
);

const onNameInput = () => {
  if (localProfile.value.name.trim() === "") {
    isNameManuallyEdited.value = false;
  } else {
    isNameManuallyEdited.value = true;
  }
};

const onNameBlur = () => {
  if (props.isNew && !isNameManuallyEdited.value && !localProfile.value.name.trim()) {
    localProfile.value.name = generateDefaultName();
  }
};

const resetDirty = () => {
  updateInitialSnapshot();
};

const handleSave = () => {
  if (!localProfile.value.name.trim()) {
    localProfile.value.name = generateDefaultName();
  }
  emit("save", localProfile.value);
};

defineExpose({
  isDirty,
  resetDirty,
  getCurrentData: () => {
    if (!localProfile.value.name.trim()) {
      localProfile.value.name = generateDefaultName();
    }
    return localProfile.value;
  },
  handleSave,
  showSavedFeedback,
  clearSavedFeedback,
});

const currentAvailableModels = computed(() => {
  if (localProfile.value.providerId) {
    const prov = props.providers.find((p) => p.id === localProfile.value.providerId);
    if (prov && prov.models && prov.models.length > 0) {
      return prov.models.map((m) => m.displayName || m.name || m.id);
    }
  }
  return localProfile.value.models && localProfile.value.models.length > 0
    ? localProfile.value.models
    : [localProfile.value.model || ""];
});

const onProfileProviderSelect = () => {
  if (localProfile.value.providerId) {
    const prov = props.providers.find((p) => p.id === localProfile.value.providerId);
    if (prov) {
      localProfile.value.provider = prov.protocol || "custom";
      localProfile.value.baseUrl = prov.baseUrl;
      localProfile.value.apiKey = prov.apiKey;
      if (prov.models && prov.models.length > 0) {
        localProfile.value.models = prov.models.map((m) => m.displayName || m.name || m.id);
        if (!localProfile.value.models.includes(localProfile.value.model)) {
          localProfile.value.model = localProfile.value.models[0];
        }
      }
    }
  }
};

const onProviderChange = () => {
  const prov = localProfile.value.provider;
  const preset = PRESET_PROVIDERS[prov];
  if (preset) {
    localProfile.value.baseUrl = preset.defaultBaseUrl;
    localProfile.value.protocol = preset.protocol;
    localProfile.value.providerUrl = preset.providerUrl || "";
    const defaultModels = preset.presetModels && preset.presetModels.length > 0
      ? [...preset.presetModels]
      : (preset.defaultModel ? [preset.defaultModel] : []);
    if (defaultModels.length > 0) {
      localProfile.value.models = defaultModels;
      if (!defaultModels.includes(localProfile.value.model)) {
        localProfile.value.model = defaultModels[0];
      }
    }
  } else {
    localProfile.value.protocol = "openai";
    localProfile.value.providerUrl = "";
  }
};

const selectPresetModel = (e: Event) => {
  const selectEl = e.target as HTMLSelectElement;
  const val = selectEl.value;
  if (val) {
    if (!localProfile.value.models) {
      localProfile.value.models = [];
    }
    if (!localProfile.value.models.includes(val)) {
      localProfile.value.models.push(val);
    }
    localProfile.value.model = val;
    selectEl.value = "";
  }
};

const addCustomModel = () => {
  const val = newModelInput.value.trim();
  if (val) {
    if (!localProfile.value.models) {
      localProfile.value.models = [];
    }
    if (!localProfile.value.models.includes(val)) {
      localProfile.value.models.push(val);
    }
    localProfile.value.model = val;
    newModelInput.value = "";
  }
};

const removeModel = (m: string) => {
  if (localProfile.value.models) {
    localProfile.value.models = localProfile.value.models.filter((item) => item !== m);
    if (localProfile.value.model === m) {
      localProfile.value.model = localProfile.value.models[0] || "";
    }
  }
};

const openProviderUrl = (url: string) => {
  window.open(url, "_blank");
};
</script>
