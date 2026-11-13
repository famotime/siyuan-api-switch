<template>
  <div class="form-container">
    <div class="content-header">
      <h2>{{ isNew ? t('newProviderTitle') : t('editProviderTitle') }}</h2>
      <p class="subtitle" v-if="localProvider.id">ID: {{ localProvider.id }}</p>
    </div>
    <div class="form-scroll-wrapper">
      <div class="form-row">
        <div class="form-group col-6">
          <label>{{ t('providerName') }}</label>
          <input type="text" class="b3-text-field" v-model="localProvider.displayName" :placeholder="t('providerNamePlaceholder')" />
        </div>
        <div class="form-group col-6">
          <label>{{ t('providerUrl') }}</label>
          <div class="input-link-wrapper">
            <input
              type="text"
              class="b3-text-field"
              v-model="localProvider.providerUrl"
              :placeholder="t('providerUrlPlaceholder')"
            />
            <button
              class="link-jump-btn"
              type="button"
              :disabled="!localProvider.providerUrl?.trim()"
              @click="openWebsite(localProvider.providerUrl)"
              :data-tooltip="localProvider.providerUrl?.trim() ? t('openOfficialSite') : t('inputOfficialSite')"
              data-tooltip-position="left"
            >
              <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                <polyline points="15 3 21 3 21 9"></polyline>
                <line x1="10" y1="14" x2="21" y2="3"></line>
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div class="form-group">
        <label>{{ t('baseUrl') }}</label>
        <input type="text" class="b3-text-field" v-model="localProvider.baseUrl" placeholder="https://api.example.com/v1" />
      </div>

      <div class="form-group">
        <label>{{ t('apiKey') }}</label>
        <div class="input-password-wrapper">
          <input
            :type="showApiKey ? 'text' : 'password'"
            class="b3-text-field"
            v-model="localProvider.apiKey"
            :placeholder="t('apiKeyPlaceholderOptional')"
          />
          <button class="toggle-password-btn" @click="showApiKey = !showApiKey" type="button" :data-tooltip="showApiKey ? t('hideApiKey') : t('showApiKey')" data-tooltip-position="left">
            <svg v-if="showApiKey" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
            <svg v-else viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
          </button>
        </div>
      </div>

      <div class="form-row">
        <div class="form-group col-5">
          <label>{{ t('protocolType') }}</label>
          <select class="b3-select" v-model="localProvider.protocol" @change="onProtocolChange">
            <option value="openai">{{ t('protoChatCompletions') }}</option>
            <option value="openai-responses">OpenAI Responses</option>
            <option value="anthropic-messages">Anthropic Messages</option>
            <option value="systemone">{{ t('protoSystemOne') }}</option>
          </select>
        </div>
        <div class="form-group col-3">
          <label>{{ t('requestTimeout') }}</label>
          <input type="number" class="b3-text-field" v-model.number="localProvider.requestTimeout" :placeholder="t('defaultTimeout')" min="1" max="600" />
        </div>
        <div class="form-group col-2">
          <label>{{ t('status') }}</label>
          <label class="form-checkbox-label" style="height: 28px; display: flex; align-items: center; gap: 6px; cursor: pointer; white-space: nowrap; margin: 0;">
            <input type="checkbox" v-model="localProvider.enabled" />
            <span>{{ t('enabled') }}</span>
          </label>
        </div>
      </div>

      <!-- 模型列表 -->
      <div class="form-group">
        <div class="model-pool-header">
          <label style="margin-bottom: 0;">{{ t('modelList') }}</label>
          <div class="model-pool-actions">
            <button
              class="b3-button b3-button--primary mini-btn"
              type="button"
              :disabled="isTaskRunning"
              @click="runConnectionTest"
              :data-tooltip="t('testConnectionTooltip')"
              data-tooltip-position="left"
            >
              {{ testingConnection ? t('testing') : t('testConnection') }}
            </button>
            <button
              class="b3-button b3-button--primary mini-btn refresh-models-btn"
              type="button"
              :disabled="isTaskRunning"
              @click="refreshModels"
              :data-tooltip="localProvider.protocol === 'systemone' ? t('refreshModelsSystemOneTooltip') : t('refreshModelsTooltip')"
              data-tooltip-position="left"
            >
              <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" :class="{ 'fn__rotate': refreshingModels }"><path d="M23 4v6h-6"></path><path d="M1 20v-6h6"></path><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
              {{ refreshingModels ? t('refreshing') : t('refreshModels') }}
            </button>
          </div>
        </div>
        <div class="model-pool-container">
          <div class="model-tags" v-if="localProvider.models && localProvider.models.length > 0">
            <span
              v-for="(m, mIdx) in localProvider.models"
              :key="m.id || m.name || mIdx"
              :class="['model-tag', { active: selectedModelName === (m.name || m.id) }]"
              @click="selectedModelName = (m.name || m.id) === selectedModelName ? '' : (m.name || m.id)"
              :title="m.contextLength ? t('contextCapacityTooltip', { capacity: formatContextLength(m.contextLength) }) : ''"
            >
              {{ m.displayName || m.name }}
              <span :class="['model-cap-badge', m.contextLength ? 'known' : 'unknown']">{{ formatContextLength(m.contextLength) }}</span>
              <span class="remove-tag" @click.stop="removeModel(mIdx)" :title="t('delete')">×</span>
            </span>
          </div>
          <div class="model-tags-empty" v-else>
            {{ t('noModelsHint') }}
          </div>

          <!-- 选中模型的操作区 -->
          <div class="model-action-row" v-if="selectedModelName">
            <span class="model-action-label">{{ t('selectedModelLabel') }} <code>{{ selectedModelName }}</code></span>
            <button class="b3-button b3-button--cancel mini-btn" type="button" :disabled="isTaskRunning" @click="runDeepTest">
              {{ testingModel ? t('deepTesting') : t('deepTest') }}
            </button>
            <button class="b3-button b3-button--cancel mini-btn" type="button" :disabled="isTaskRunning" @click="confirmProbe">
              {{ probing ? probeProgressText : t('probeCapacity') }}
            </button>
          </div>

          <div class="add-model-input-group">
            <input
              type="text"
              class="b3-text-field mini-input"
              v-model="newModelInput"
              :placeholder="localProvider.protocol === 'systemone' ? t('addModelSystemOnePlaceholder') : t('addModelPlaceholder')"
              @keyup.enter="addModel"
            />
            <button class="b3-button b3-button--primary mini-btn" @click="addModel" type="button">{{ t('add') }}</button>
          </div>

          <!-- 测试/探测结果反馈 -->
          <div v-if="actionMessage" :class="['probe-status', actionOk === true ? 'ok' : actionOk === false ? 'fail' : 'info']">
            {{ actionMessage }}
          </div>
        </div>
      </div>

      <!-- 自定义请求头 Headers -->
      <div class="form-group">
        <label>{{ t('customHeaders') }}</label>
        <textarea
          class="b3-text-field textarea-field"
          v-model="headersText"
          placeholder='{ "HTTP-Referer": "https://siyuan-note.com", "X-Title": "MySiYuan" }'
          style="height: 60px; font-family: monospace; font-size: 12px;"
        ></textarea>
      </div>
    </div>

    <div class="form-actions">
      <button class="b3-button b3-button--error" v-if="!isNew" @click.stop="$emit('delete', localProvider.id)" type="button">{{ t('delete') }}</button>
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
        <span>{{ isSaved ? t('saved') : t('saveProvider') }}</span>
      </button>
    </div>

    <!-- 探测容量确认弹窗 -->
    <div class="confirm-overlay" v-if="probeConfirm.show" @click.self="probeConfirm.show = false">
      <div class="confirm-dialog animate-fade-in">
        <div class="confirm-title">{{ t('probeCapacityTitle') }}</div>
        <div class="confirm-text" style="white-space: pre-line;">{{ probeConfirm.text }}</div>
        <div class="confirm-actions">
          <button class="b3-button b3-button--cancel" @click="probeConfirm.show = false">{{ t('cancel') }}</button>
          <button class="b3-button b3-button--primary" @click="startProbe">{{ t('startProbe') }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from "vue";
import { useSavedFeedback } from "@/composables/useSavedFeedback";
import { useDirtySnapshot } from "@/composables/useDirtySnapshot";
import { showMessage } from "siyuan";
import { ApiProvider, ApiProviderModel, AiProtocol } from "@/types";
import { getPresetProtocolBaseUrl } from "@/constants/providers";
import { t } from "@/utils/i18n";
import {
  ProviderDraft,
  fetchProviderModels,
  testProviderConnection,
  testProviderModel,
  probeModelContextLength,
  resolveModelContextLength,
  formatContextLength,
  estimateProbeWorstCost,
  DEFAULT_PROBE_MAX_REQUESTS,
  DEFAULT_PROBE_GRANULARITY,
  DEFAULT_PROBE_TIMEOUT_MS,
} from "@/services/provider-probe";

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
const selectedModelName = ref("");

// 操作态与反馈（单一互斥任务状态机 + epoch 防串台）
type ProbeTaskState =
  | { status: "idle" }
  | { status: "refreshing_models" }
  | { status: "testing_connection" }
  | { status: "testing_model"; model: string }
  | { status: "probing_context"; model: string; progressText: string };

const taskState = ref<ProbeTaskState>({ status: "idle" });
const isTaskRunning = computed(() => taskState.value.status !== "idle");
const refreshingModels = computed(() => taskState.value.status === "refreshing_models");
const testingConnection = computed(() => taskState.value.status === "testing_connection");
const testingModel = computed(() => taskState.value.status === "testing_model");
const probing = computed(() => taskState.value.status === "probing_context");
const probeProgressText = computed(() =>
  taskState.value.status === "probing_context" ? taskState.value.progressText : t("probing")
);

let taskEpoch = 0;
let probeAbortController: AbortController | null = null;

const cancelActiveTasks = () => {
  taskEpoch += 1;
  if (probeAbortController) {
    probeAbortController.abort();
    probeAbortController = null;
  }
  taskState.value = { status: "idle" };
};

onUnmounted(() => {
  cancelActiveTasks();
});

const actionMessage = ref("");
const actionOk = ref<boolean | null>(null);
const probeConfirm = ref<{ show: boolean; text: string }>({ show: false, text: "" });

// 保存反馈与脏检查快照（共享 composable，defineExpose 契约不变）
const { isSaved, showSavedFeedback, clearSavedFeedback } = useSavedFeedback();

const setActionMessage = (text: string, ok: boolean | null) => {
  actionMessage.value = text;
  actionOk.value = ok;
};

const getNormalizedCurrentData = (): ApiProvider => {
  let parsedHeaders: Record<string, string> = {};
  if (headersText.value.trim()) {
    try {
      parsedHeaders = JSON.parse(headersText.value);
    } catch {
      parsedHeaders = localProvider.value.headers || {};
    }
  }
  return {
    ...localProvider.value,
    providerUrl: (localProvider.value.providerUrl || "").trim(),
    headers: parsedHeaders,
    models: localProvider.value.models ? [...localProvider.value.models] : [],
  };
};

// 脏检查直接包含 headersText 原始文本，避免非法 JSON 时 fallback 回旧对象导致漏判脏态
const { updateInitialSnapshot, isDirty } = useDirtySnapshot(() => ({
  ...localProvider.value,
  providerUrl: (localProvider.value.providerUrl || "").trim(),
  models: localProvider.value.models ? [...localProvider.value.models] : [],
  headersText: headersText.value,
}));

const resetDirty = () => {
  updateInitialSnapshot();
};

watch(
  () => props.provider,
  (newVal, oldVal) => {
    if (oldVal && newVal?.id !== oldVal?.id) {
      cancelActiveTasks();
      clearSavedFeedback();
    }
    localProvider.value = {
      ...newVal,
      models: newVal.models ? [...newVal.models] : [],
      headers: newVal.headers ? { ...newVal.headers } : {},
    };
    headersText.value = localProvider.value.headers && Object.keys(localProvider.value.headers).length > 0
      ? JSON.stringify(localProvider.value.headers, null, 2)
      : "";
    selectedModelName.value = "";
    setActionMessage("", null);
    nextTick(() => {
      updateInitialSnapshot();
    });
  },
  { immediate: true, deep: true }
);

// 监听 localProvider 或 headersText，当变 dirty 时清除已保存提示
watch(
  [localProvider, headersText],
  () => {
    if (isSaved.value && isDirty()) {
      clearSavedFeedback();
    }
  },
  { deep: true }
);

// 当前表单草稿（未保存的值即可测试，内核 listModels/testModel 支持传草稿）
const currentDraft = computed<ProviderDraft>(() => {
  let parsedHeaders: Record<string, string> = {};
  if (headersText.value.trim()) {
    try {
      parsedHeaders = JSON.parse(headersText.value);
    } catch {
      parsedHeaders = {};
    }
  }
  return {
    displayName: localProvider.value.displayName,
    baseUrl: localProvider.value.baseUrl,
    apiKey: localProvider.value.apiKey,
    protocol: localProvider.value.protocol,
    requestTimeout: localProvider.value.requestTimeout ?? 30,
    headers: parsedHeaders,
    models: (localProvider.value.models || []).map((m) => ({ id: m.id, name: m.name })),
    providerUrl: (localProvider.value.providerUrl || "").trim(),
  };
});

const openWebsite = (url?: string) => {
  const target = (url || "").trim();
  if (!target) return;
  const fullUrl = /^https?:\/\//i.test(target) ? target : `https://${target}`;
  window.open(fullUrl, "_blank");
};

const onProtocolChange = () => {
  // 命中预置（如 DeepSeek）时自动切换到该协议的专用地址；自定义网关保持不变
  localProvider.value.baseUrl = getPresetProtocolBaseUrl(
    localProvider.value.baseUrl,
    (localProvider.value.protocol || "openai") as AiProtocol
  );
  // 当切换为 systemone 协议且当前无任何模型时，提供默认模型建议
  if (
    localProvider.value.protocol === "systemone" &&
    (!localProvider.value.models || localProvider.value.models.length === 0) &&
    !newModelInput.value
  ) {
    newModelInput.value = "jev-latest";
  }
};

const removeModel = (index: number) => {
  if (localProvider.value.models) {
    const removed = localProvider.value.models[index];
    if (removed && (removed.name || removed.id) === selectedModelName.value) {
      selectedModelName.value = "";
    }
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
      contextLength: resolveModelContextLength(val) || undefined,
    });
  }
  newModelInput.value = "";
};

/** 刷新可用模型：合并去重回填（不删除用户手动添加的模型），容量 = 接口元数据 > 内置快照表 */
const refreshModels = async () => {
  if (isTaskRunning.value) return;
  if (!currentDraft.value.baseUrl.trim()) {
    showMessage(t("fillBaseUrlBeforeRefresh"), 5000, "error");
    return;
  }
  const myEpoch = ++taskEpoch;
  taskState.value = { status: "refreshing_models" };
  setActionMessage("", null);
  try {
    const result = await fetchProviderModels(currentDraft.value);
    if (myEpoch !== taskEpoch) return;
    const models = localProvider.value.models || [];
    let added = 0;
    let backfilled = 0;
    for (const name of result.models) {
      if (!models.some((m) => m.name === name || m.id === name)) {
        models.push({
          id: name,
          name,
          displayName: name,
          enabled: true,
          contextLength: resolveModelContextLength(name, result.contextLengths) || undefined,
        });
        added++;
      }
    }
    for (const m of models) {
      const len = resolveModelContextLength(m.name || m.id, result.contextLengths);
      if (len > 0 && m.contextLength !== len) {
        m.contextLength = len;
        backfilled++;
      }
    }
    localProvider.value.models = models;
    const backfilledText = backfilled > 0 ? t('backfilledCapacityText', { count: backfilled }) : "";
    setActionMessage(
      t('refreshModelsSuccess', {
        count: result.models.length,
        added,
        backfilled: backfilledText,
      }),
      true
    );
  } catch (err: any) {
    if (myEpoch !== taskEpoch) return;
    setActionMessage(t('refreshModelsFailed', { error: err?.message || err }), false);
  } finally {
    if (myEpoch === taskEpoch) {
      taskState.value = { status: "idle" };
    }
  }
};

/** 一级测试：连通性（listModels，不消耗 tokens） */
const runConnectionTest = async () => {
  if (isTaskRunning.value) return;
  const myEpoch = ++taskEpoch;
  taskState.value = { status: "testing_connection" };
  setActionMessage(t('testingConnection'), null);
  try {
    const result = await testProviderConnection(currentDraft.value);
    if (myEpoch !== taskEpoch) return;
    const testMsg = result.ok ? result.message : t('testConnectionFailed', { error: result.message });
    setActionMessage(testMsg, result.ok);
    showMessage(testMsg, 4000, result.ok ? "info" : "error");
  } catch (err: any) {
    if (myEpoch !== taskEpoch) return;
    setActionMessage(t('testConnectionFailed', { error: err?.message || err }), false);
  } finally {
    if (myEpoch === taskEpoch) {
      taskState.value = { status: "idle" };
    }
  }
};

/** 二级测试：对选中模型发 max_tokens=1 真实请求（消耗少量 tokens） */
const runDeepTest = async () => {
  if (isTaskRunning.value || !selectedModelName.value) return;
  const myEpoch = ++taskEpoch;
  const model = selectedModelName.value;
  taskState.value = { status: "testing_model", model };
  setActionMessage(t('deepTestingForModel', { model }), null);
  try {
    const result = await testProviderModel(currentDraft.value, model);
    if (myEpoch !== taskEpoch) return;
    setActionMessage(result.message, result.ok);
    showMessage(result.message, 5000, result.ok ? "info" : "error");
  } catch (err: any) {
    if (myEpoch !== taskEpoch) return;
    setActionMessage(t('deepTestFailed', { error: err?.message || err }), false);
  } finally {
    if (myEpoch === taskEpoch) {
      taskState.value = { status: "idle" };
    }
  }
};

const confirmProbe = () => {
  if (isTaskRunning.value || !selectedModelName.value) return;
  if (!currentDraft.value.baseUrl.trim()) {
    showMessage(t("fillBaseUrlBeforeTest"), 5000, "error");
    return;
  }
  probeConfirm.value = {
    show: true,
    text: t('probeConfirmText', {
      model: selectedModelName.value,
      maxRequests: DEFAULT_PROBE_MAX_REQUESTS,
      timeout: DEFAULT_PROBE_TIMEOUT_MS / 1000,
      granularity: formatContextLength(DEFAULT_PROBE_GRANULARITY),
      worstCost: formatContextLength(estimateProbeWorstCost()),
    }),
  };
};

const startProbe = async () => {
  probeConfirm.value.show = false;
  if (isTaskRunning.value || !selectedModelName.value) return;
  const myEpoch = ++taskEpoch;
  const targetModel = selectedModelName.value;
  const controller = new AbortController();
  probeAbortController = controller;
  taskState.value = { status: "probing_context", model: targetModel, progressText: t('probing') };
  setActionMessage(t('probing'), null);
  try {
    const result = await probeModelContextLength(currentDraft.value, targetModel, {
      signal: controller.signal,
      onProgress: (p) => {
        if (myEpoch !== taskEpoch) return;
        const progressText = t('probingProgress', {
          attempt: p.attempt,
          maxRequests: p.maxRequests,
          tokens: formatContextLength(p.tokens),
        });
        taskState.value = { status: "probing_context", model: targetModel, progressText };
        setActionMessage(progressText, null);
      },
    });
    if (myEpoch !== taskEpoch) return;

    if (result.contextLength > 0) {
      const target = (localProvider.value.models || []).find(
        (m) => (m.name || m.id) === targetModel
      );
      if (target) {
        target.contextLength = result.contextLength;
      }
      const bound = result.upperBound
        ? t('probeBoundCeiling', { bound: formatContextLength(result.upperBound) })
        : t('probeBoundNotReached');
      setActionMessage(
        t('probeSuccess', {
          capacity: formatContextLength(result.contextLength),
          bound,
          requests: result.requests,
        }),
        true
      );
      showMessage(t('probeSuccessToast', { model: targetModel, capacity: formatContextLength(result.contextLength) }), 4000, "info");
    } else if (result.aborted) {
      setActionMessage(t('probeAborted', { reason: result.aborted }), false);
    } else {
      setActionMessage(t('probeFailedMin'), false);
    }
  } catch (err: any) {
    if (myEpoch !== taskEpoch) return;
    setActionMessage(t('probeFailed', { error: err?.message || err }), false);
  } finally {
    if (probeAbortController === controller) {
      probeAbortController = null;
    }
    if (myEpoch === taskEpoch) {
      taskState.value = { status: "idle" };
    }
  }
};

const handleSave = (): boolean => {
  let parsedHeaders: Record<string, string> = {};
  if (headersText.value.trim()) {
    try {
      parsedHeaders = JSON.parse(headersText.value);
    } catch (e) {
      showMessage(t("headersJsonInvalid"), 5000, "error");
      return false;
    }
  }
  localProvider.value.headers = parsedHeaders;
  localProvider.value.providerUrl = (localProvider.value.providerUrl || "").trim();
  emit("save", localProvider.value);
  return true;
};

defineExpose({
  isDirty,
  resetDirty,
  getCurrentData: getNormalizedCurrentData,
  handleSave,
  showSavedFeedback,
  clearSavedFeedback,
});
</script>
