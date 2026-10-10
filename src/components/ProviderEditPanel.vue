<template>
  <div class="form-container">
    <div class="content-header">
      <h2>{{ isNew ? '新建 API 提供商' : '编辑 API 提供商' }}</h2>
      <p class="subtitle" v-if="localProvider.id">ID: {{ localProvider.id }}</p>
    </div>
    <div class="form-scroll-wrapper">
      <div class="form-row">
        <div class="form-group col-6">
          <label>提供商名称 *</label>
          <input type="text" class="b3-text-field" v-model="localProvider.displayName" placeholder="如 DeepSeek 官方 / SiliconFlow" />
        </div>
        <div class="form-group col-6">
          <label>协议类型 *</label>
          <select class="b3-select" v-model="localProvider.protocol">
            <option value="openai">OpenAI (主流兼容协议)</option>
            <option value="gemini">Google Gemini</option>
            <option value="anthropic">Anthropic</option>
            <option value="custom">Custom (自定义)</option>
          </select>
        </div>
      </div>

      <div class="form-group">
        <label>API 基础地址 (Base URL) *</label>
        <input type="text" class="b3-text-field" v-model="localProvider.baseUrl" placeholder="https://api.example.com/v1" />
      </div>

      <div class="form-group">
        <label>API 密钥 (API Key) *</label>
        <div class="input-password-wrapper">
          <input 
            :type="showApiKey ? 'text' : 'password'" 
            class="b3-text-field" 
            v-model="localProvider.apiKey" 
            placeholder="sk-..." 
          />
          <button class="toggle-password-btn" @click="showApiKey = !showApiKey" type="button" :data-tooltip="showApiKey ? '隐藏密钥' : '显示密钥'" data-tooltip-position="left">
            <svg v-if="showApiKey" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
            <svg v-else viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
          </button>
        </div>
      </div>

      <div class="form-row">
        <div class="form-group col-6">
          <label>请求超时 (秒)</label>
          <input type="number" class="b3-text-field" v-model.number="localProvider.requestTimeout" placeholder="默认 30" min="1" max="600" />
        </div>
        <div class="form-group col-6">
          <label>状态</label>
          <label class="form-checkbox-label" style="margin-top: 8px; display: flex; align-items: center; gap: 6px; cursor: pointer;">
            <input type="checkbox" v-model="localProvider.enabled" />
            <span>启用此提供商</span>
          </label>
        </div>
      </div>

      <!-- 模型列表 -->
      <div class="form-group">
        <label>模型列表 (Models)</label>
        <div class="model-pool-container">
          <div class="model-tags" v-if="localProvider.models && localProvider.models.length > 0">
            <span 
              v-for="(m, mIdx) in localProvider.models" 
              :key="m.id || m.name || mIdx" 
              class="model-tag"
            >
              {{ m.displayName || m.name }}
              <span class="remove-tag" @click.stop="removeModel(mIdx)" title="删除模型">×</span>
            </span>
          </div>
          <div class="model-tags-empty" v-else>
            暂无模型，请在下方输入模型名添加。
          </div>
          <div class="add-model-input-group">
            <input 
              type="text" 
              class="b3-text-field mini-input" 
              v-model="newModelInput" 
              placeholder="输入新模型名称 (如 deepseek-chat)，按回车添加" 
              @keyup.enter="addModel"
            />
            <button class="b3-button b3-button--primary mini-btn" @click="addModel" type="button">添加</button>
          </div>
        </div>
      </div>

      <!-- 自定义请求头 Headers -->
      <div class="form-group">
        <label>自定义请求头 (Headers JSON，可选)</label>
        <textarea 
          class="b3-text-field textarea-field" 
          v-model="headersText" 
          placeholder='例如: { "HTTP-Referer": "https://siyuan-note.com", "X-Title": "MySiYuan" }'
          style="height: 60px; font-family: monospace; font-size: 12px;"
        ></textarea>
      </div>
    </div>

    <div class="form-actions">
      <button class="b3-button b3-button--error" v-if="!isNew" @click.stop="$emit('delete', localProvider.id)" type="button">删除</button>
      <div class="flex-spacer"></div>
      <button class="b3-button b3-button--cancel" @click="$emit('cancel')">取消</button>
      <button class="b3-button b3-button--primary" @click="handleSave">保存提供商</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import { ApiProvider, ApiProviderModel } from "@/types";

const props = defineProps<{
  provider: ApiProvider;
  isNew: boolean;
}>();

const emit = defineEmits<{
  (e: "save", provider: ApiProvider): void;
  (e: "delete", id: string): void;
  (e: "cancel"): void;
}>();

const localProvider = ref<ApiProvider>({ ...props.provider });
const showApiKey = ref(false);
const newModelInput = ref("");
const headersText = ref("");

watch(
  () => props.provider,
  (newVal) => {
    localProvider.value = {
      ...newVal,
      models: newVal.models ? [...newVal.models] : [],
      headers: newVal.headers ? { ...newVal.headers } : {},
    };
    headersText.value = localProvider.value.headers && Object.keys(localProvider.value.headers).length > 0
      ? JSON.stringify(localProvider.value.headers, null, 2)
      : "";
  },
  { immediate: true, deep: true }
);

const removeModel = (index: number) => {
  if (localProvider.value.models) {
    localProvider.value.models.splice(index, 1);
  }
};

const addModel = () => {
  const val = newModelInput.value.trim();
  if (!val) return;
  if (!localProvider.value.models) {
    localProvider.value.models = [];
  }
  if (!localProvider.value.models.some((m) => m.name === val || m.id === val)) {
    localProvider.value.models.push({
      id: val,
      name: val,
      displayName: val,
      enabled: true,
    });
  }
  newModelInput.value = "";
};

const handleSave = () => {
  let parsedHeaders: Record<string, string> = {};
  if (headersText.value.trim()) {
    try {
      parsedHeaders = JSON.parse(headersText.value);
    } catch (e) {
      alert("Headers JSON 格式不正确，请检查！");
      return;
    }
  }
  localProvider.value.headers = parsedHeaders;
  emit("save", localProvider.value);
};
</script>
