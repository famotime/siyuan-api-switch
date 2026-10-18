<template>
  <div class="form-container">
    <div class="content-header">
      <h2>{{ isNew ? '新建 API 配置' : '编辑 API 配置' }}</h2>
    </div>
    <div class="form-scroll-wrapper">
      <!-- 关联 API 提供商选择 -->
      <div class="form-group" style="background: rgba(63,81,181,0.06); padding: 10px 12px; border-radius: 6px; border: 1px dashed rgba(63,81,181,0.25); margin-bottom: 14px;">
        <label style="font-weight: 600; color: var(--b3-theme-primary); margin-bottom: 4px; display: block;">🔗 关联已配置的 API 提供商 (从提供商继承)</label>
        <select class="b3-select" v-model="localProfile.providerId" @change="onProfileProviderSelect">
          <option value="">-- 无 (独立自定义配置，不继承提供商) --</option>
          <option v-for="prov in providers" :key="prov.id" :value="prov.id">
            {{ prov.displayName }} ({{ prov.protocol || 'openai' }}) - {{ (prov.models && prov.models.length) || 0 }} 个可用模型
          </option>
        </select>
        <div v-if="localProfile.providerId" style="margin-top: 6px; font-size: 12px; opacity: 0.85; line-height: 1.5;">
          💡 已继承提供商的基础连接信息 (Base URL、API Key 与自定义 Headers)。当提供商更新时，此 Profile 自动联动生效。
        </div>
      </div>

      <div class="form-row">
        <div class="form-group col-6">
          <label>配置名称 *</label>
          <input type="text" class="b3-text-field" v-model="localProfile.name" placeholder="如 DeepSeek 默认" />
        </div>
        <div class="form-group col-6">
          <div class="label-with-link">
            <label>AI 服务商 *</label>
            <a v-if="localProfile.providerUrl" href="javascript:void(0)" @click.prevent="openProviderUrl(localProfile.providerUrl)" class="provider-link-btn" data-tooltip="前往官网获取 API Key" data-tooltip-position="bottom">
              <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" style="fill:none!important"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
            </a>
          </div>
          <input v-if="localProfile.providerId" type="text" class="b3-text-field" :value="localProfile.provider" disabled />
          <select v-else class="b3-select" v-model="localProfile.provider" @change="onProviderChange">
            <option value="deepseek">DeepSeek</option>
            <option value="gemini">Google Gemini</option>
            <option value="siliconflow">SiliconFlow (硅基流动)</option>
            <option value="openai">OpenAI</option>
            <option value="custom">Custom (自定义)</option>
          </select>
        </div>
      </div>

      <div class="form-group">
        <label>API 基础 URL (Base URL) *</label>
        <input type="text" class="b3-text-field" v-model="localProfile.baseUrl" :disabled="Boolean(localProfile.providerId)" placeholder="https://api.example.com/v1" />
      </div>

      <div class="form-group">
        <label>API 密钥 (API Key) *</label>
        <div class="input-password-wrapper">
          <input 
            :type="showApiKey ? 'text' : 'password'" 
            class="b3-text-field" 
            v-model="localProfile.apiKey" 
            :disabled="Boolean(localProfile.providerId)"
            placeholder="sk-..." 
          />
          <button class="toggle-password-btn" @click="showApiKey = !showApiKey" type="button" :data-tooltip="showApiKey ? '隐藏密钥' : '显示密钥'" data-tooltip-position="left">
            <svg v-if="showApiKey" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" style="fill:none!important"></path><circle cx="12" cy="12" r="3" style="fill:none!important"></circle></svg>
            <svg v-else viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" style="fill:none!important"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
          </button>
        </div>
      </div>

      <div class="form-row">
        <div class="form-group col-8">
          <label>当前启用模型 (Active Model) *</label>
          <select class="b3-select" v-model="localProfile.model">
            <option v-for="m in currentAvailableModels" :key="m" :value="m">{{ m }}</option>
          </select>
        </div>
        <div class="form-group col-4" v-if="!localProfile.providerId">
          <label>添加推荐模型</label>
          <select class="b3-select" @change="selectPresetModel($event)">
            <option value="">-- 选择并添加 --</option>
            <option v-for="m in presetModels[localProfile.provider] || []" :key="m" :value="m">{{ m }}</option>
          </select>
        </div>
      </div>

      <div class="form-group" v-if="!localProfile.providerId">
        <label>候选模型池 (Model Pool)</label>
        <div class="model-pool-container">
          <div class="model-tags" v-if="localProfile.models && localProfile.models.length > 0">
            <span 
              v-for="m in localProfile.models" 
              :key="m" 
              :class="['model-tag', { active: localProfile.model === m }]"
              @click="localProfile.model = m"
              title="点击设为当前启用模型"
            >
              {{ m }}
              <span class="remove-tag" @click.stop="removeModel(m)" title="从池中移除">×</span>
            </span>
          </div>
          <div class="model-tags-empty" v-else>
            候选模型池为空，请在下方输入或选择推荐模型进行添加。
          </div>
          <div class="add-model-input-group">
            <input 
              type="text" 
              class="b3-text-field mini-input" 
              v-model="newModelInput" 
              placeholder="输入新模型名称，按回车添加" 
              @keyup.enter="addCustomModel"
            />
            <button class="b3-button b3-button--primary mini-btn" @click="addCustomModel" type="button">添加</button>
          </div>
        </div>
      </div>

      <!-- 决策模型标识开关 -->
      <div class="form-group" style="margin-top: 6px;">
        <label class="form-checkbox-label" style="display: flex; align-items: center; gap: 8px; font-weight: 500; cursor: pointer;">
          <input type="checkbox" v-model="localProfile.isDecisionModel" />
          <span>设为决策模型 (Decision Model，专用于思源笔记 API-决策模型接管)</span>
        </label>
      </div>

      <!-- 折叠的高级设置面板 -->
      <div class="advanced-divider" @click="showAdvanced = !showAdvanced">
        <span>高级参数设置</span>
        <svg :class="['arrow-icon', { expanded: showAdvanced }]" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9" style="fill:none!important"></polyline></svg>
      </div>

      <div class="advanced-fields" v-show="showAdvanced">
        <div class="form-row">
          <div class="form-group col-4">
            <label>请求超时 (秒)</label>
            <input type="number" class="b3-text-field" v-model.number="localProfile.requestTimeoutSeconds" placeholder="留空保持默认 (30s)" min="1" max="600" />
          </div>
          <div class="form-group col-4">
            <label>采样温度 (Temperature)</label>
            <input type="number" class="b3-text-field" v-model.number="localProfile.temperature" placeholder="0~2.0, 留空保持默认" step="0.1" min="0" max="2" />
          </div>
          <div class="form-group col-4">
            <label>单次 Max Tokens</label>
            <input type="number" class="b3-text-field" v-model.number="localProfile.maxTokens" placeholder="0或留空表示不限" min="0" />
          </div>
        </div>

        <div class="form-row">
          <div class="form-group col-4">
            <label>编辑器最大上下文 (轮)</label>
            <input type="number" class="b3-text-field" v-model.number="localProfile.maxHistoryMessages" placeholder="1~64轮, 留空保持默认" min="1" max="64" />
          </div>
          <div class="form-group col-4">
            <label>智能体最大工具调用 (轮)</label>
            <input type="number" class="b3-text-field" v-model.number="localProfile.maxToolCallRounds" placeholder="0或留空表示不限" min="0" />
          </div>
          <div class="form-group col-4">
            <label>智能体会话超时 (秒)</label>
            <input type="number" class="b3-text-field" v-model.number="localProfile.sessionTimeout" placeholder="0或留空表示不限" min="0" max="3600" />
          </div>
        </div>

        <div class="form-row">
          <div class="form-group col-4">
            <label>智能体流空闲超时 (秒)</label>
            <input type="number" class="b3-text-field" v-model.number="localProfile.streamIdleTimeout" placeholder="120s, 留空保持默认" min="1" max="600" />
          </div>
          <div class="form-group col-4">
            <label>智能体确认超时 (秒)</label>
            <input type="number" class="b3-text-field" v-model.number="localProfile.confirmTimeout" placeholder="120s, 留空保持默认" min="1" max="600" />
          </div>
          <div class="form-group col-4">
            <label>智能体最大重试次数</label>
            <input type="number" class="b3-text-field" v-model.number="localProfile.maxRetries" placeholder="0~10次, 留空保持默认" min="0" max="10" />
          </div>
        </div>

        <div class="form-group">
          <label>备注说明 (可选)</label>
          <textarea class="b3-text-field textarea-field" v-model="localProfile.memo" placeholder="添加此 API 账号的备注信息..."></textarea>
        </div>
      </div>
    </div>

    <div class="form-actions">
      <button class="b3-button b3-button--error" v-if="!isNew" @click.stop="$emit('delete', localProfile.id)" type="button">删除</button>
      <div class="flex-spacer"></div>
      <button class="b3-button b3-button--cancel" @click="$emit('cancel')">取消</button>
      <button class="b3-button b3-button--primary" @click="$emit('save', localProfile)">保存</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { ApiProfile } from "@/services/api-switch-core";
import { ApiProvider } from "@/types";
import { PRESET_PROVIDERS } from "@/constants/providers";

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

const presetModels: Record<string, string[]> = {
  deepseek: PRESET_PROVIDERS.deepseek.presetModels,
  gemini: PRESET_PROVIDERS.gemini.presetModels,
  siliconflow: PRESET_PROVIDERS.siliconflow.presetModels,
  openai: PRESET_PROVIDERS.openai.presetModels,
  custom: [],
};

watch(
  () => props.profile,
  (newVal) => {
    localProfile.value = {
      ...newVal,
      models: newVal.models ? [...newVal.models] : [],
    };
  },
  { immediate: true, deep: true }
);

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
    localProfile.value.providerUrl = preset.providerUrl || "";
    const defaultModels = preset.presetModels ? [...preset.presetModels] : [preset.defaultModel];
    localProfile.value.models = defaultModels;
    if (!defaultModels.includes(localProfile.value.model)) {
      localProfile.value.model = defaultModels[0] || preset.defaultModel;
    }
  } else {
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
