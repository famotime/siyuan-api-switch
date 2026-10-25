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
          <select class="b3-select" v-model="localProvider.protocol" @change="onProtocolChange">
            <option value="openai">OpenAI 兼容 (Chat Completions)</option>
            <option value="openai-responses">OpenAI Responses</option>
            <option value="anthropic-messages">Anthropic Messages</option>
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
        <div class="model-pool-header">
          <label style="margin-bottom: 0;">模型列表 (Models)</label>
          <div class="model-pool-actions">
            <button
              class="b3-button b3-button--primary mini-btn"
              type="button"
              :disabled="testingConnection"
              @click="runConnectionTest"
              data-tooltip="验证 Base URL 与 API Key 连通性（经思源内核转发，不消耗 tokens）"
              data-tooltip-position="left"
            >
              {{ testingConnection ? '测试中…' : '测试链接' }}
            </button>
            <button
              class="b3-button b3-button--primary mini-btn refresh-models-btn"
              type="button"
              :disabled="refreshingModels"
              @click="refreshModels"
              data-tooltip="调用服务商 /v1/models 接口拉取真实可用模型清单（经思源内核转发，不消耗 tokens）"
              data-tooltip-position="left"
            >
              <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" :class="{ 'fn__rotate': refreshingModels }"><path d="M23 4v6h-6"></path><path d="M1 20v-6h6"></path><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
              {{ refreshingModels ? '刷新中…' : '刷新可用模型' }}
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
              :title="m.contextLength ? `上下文容量 ${formatContextLength(m.contextLength)}（点击选中后可深度测试/探测）` : '点击选中后可深度测试/探测容量'"
            >
              {{ m.displayName || m.name }}
              <span :class="['model-cap-badge', m.contextLength ? 'known' : 'unknown']">{{ formatContextLength(m.contextLength) }}</span>
              <span class="remove-tag" @click.stop="removeModel(mIdx)" title="删除模型">×</span>
            </span>
          </div>
          <div class="model-tags-empty" v-else>
            暂无模型：可点击上方「刷新可用模型」自动拉取，或在下方手动输入模型名添加。
          </div>

          <!-- 选中模型的操作区 -->
          <div class="model-action-row" v-if="selectedModelName">
            <span class="model-action-label">已选中 <code>{{ selectedModelName }}</code></span>
            <button class="b3-button b3-button--cancel mini-btn" type="button" :disabled="testingModel" @click="runDeepTest">
              {{ testingModel ? '深度测试中…' : '深度测试' }}
            </button>
            <button class="b3-button b3-button--cancel mini-btn" type="button" :disabled="probing" @click="confirmProbe">
              {{ probing ? probeProgressText : '探测容量' }}
            </button>
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

          <!-- 测试/探测结果反馈 -->
          <div v-if="actionMessage" :class="['probe-status', actionOk === true ? 'ok' : actionOk === false ? 'fail' : 'info']">
            {{ actionMessage }}
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

    <!-- 探测容量确认弹窗 -->
    <div class="confirm-overlay" v-if="probeConfirm.show" @click.self="probeConfirm.show = false">
      <div class="confirm-dialog animate-fade-in">
        <div class="confirm-title">探测上下文容量</div>
        <div class="confirm-text" style="white-space: pre-line;">{{ probeConfirm.text }}</div>
        <div class="confirm-actions">
          <button class="b3-button b3-button--cancel" @click="probeConfirm.show = false">取消</button>
          <button class="b3-button b3-button--primary" @click="startProbe">开始探测</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { showMessage } from "siyuan";
import { ApiProvider, ApiProviderModel, AiProtocol } from "@/types";
import { getPresetProtocolBaseUrl } from "@/constants/providers";
import {
  ProviderDraft,
  fetchProviderModels,
  testProviderConnection,
  testProviderModel,
  probeModelContextLength,
  resolveModelContextLength,
  formatContextLength,
  estimateProbeWorstCost,
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

// 操作态与反馈
const refreshingModels = ref(false);
const testingConnection = ref(false);
const testingModel = ref(false);
const probing = ref(false);
const probeProgressText = ref("探测中…");
const actionMessage = ref("");
const actionOk = ref<boolean | null>(null);
const probeConfirm = ref<{ show: boolean; text: string }>({ show: false, text: "" });

const setActionMessage = (text: string, ok: boolean | null) => {
  actionMessage.value = text;
  actionOk.value = ok;
};

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
    selectedModelName.value = "";
    setActionMessage("", null);
  },
  { immediate: true, deep: true }
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
  };
});

const onProtocolChange = () => {
  // 命中预置（如 DeepSeek）时自动切换到该协议的专用地址；自定义网关保持不变
  localProvider.value.baseUrl = getPresetProtocolBaseUrl(
    localProvider.value.baseUrl,
    (localProvider.value.protocol || "openai") as AiProtocol
  );
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
  if (refreshingModels.value) return;
  if (!currentDraft.value.baseUrl.trim()) {
    showMessage("请先填写 Base URL 再刷新可用模型", 5000, "error");
    return;
  }
  refreshingModels.value = true;
  setActionMessage("", null);
  try {
    const result = await fetchProviderModels(currentDraft.value);
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
    setActionMessage(
      `已获取 ${result.models.length} 个可用模型：新增 ${added} 个${backfilled > 0 ? `，回填 ${backfilled} 个模型的容量` : ""}（已手动添加的模型不会被移除）`,
      true
    );
  } catch (err: any) {
    setActionMessage(`刷新失败：${err?.message || err}`, false);
  } finally {
    refreshingModels.value = false;
  }
};

/** 一级测试：连通性（listModels，不消耗 tokens） */
const runConnectionTest = async () => {
  if (testingConnection.value) return;
  testingConnection.value = true;
  setActionMessage("正在测试连接…", null);
  try {
    const result = await testProviderConnection(currentDraft.value);
    setActionMessage(result.ok ? result.message : `连接测试失败：${result.message}`, result.ok);
    showMessage(result.ok ? result.message : `连接测试失败：${result.message}`, 4000, result.ok ? "info" : "error");
  } catch (err: any) {
    setActionMessage(`连接测试失败：${err?.message || err}`, false);
  } finally {
    testingConnection.value = false;
  }
};

/** 二级测试：对选中模型发 max_tokens=1 真实请求（消耗少量 tokens） */
const runDeepTest = async () => {
  if (testingModel.value || !selectedModelName.value) return;
  testingModel.value = true;
  setActionMessage(`正在对「${selectedModelName.value}」发送深度测试请求（消耗少量 tokens）…`, null);
  try {
    const result = await testProviderModel(currentDraft.value, selectedModelName.value);
    setActionMessage(result.message, result.ok);
    showMessage(result.message, 5000, result.ok ? "info" : "error");
  } catch (err: any) {
    setActionMessage(`深度测试失败：${err?.message || err}`, false);
  } finally {
    testingModel.value = false;
  }
};

const confirmProbe = () => {
  if (probing.value || !selectedModelName.value) return;
  if (!currentDraft.value.baseUrl.trim()) {
    showMessage("请先填写 Base URL", 5000, "error");
    return;
  }
  probeConfirm.value = {
    show: true,
    text:
      `即将对模型「${selectedModelName.value}」进行主动探测：从 4k tokens 起指数上探、触顶后二分逼进，` +
      `最多 ${8} 次真实请求、单次超时 60s，粒度 1k tokens。\n` +
      `每次请求都会真实消耗输入 tokens（最坏情况约 ${formatContextLength(estimateProbeWorstCost())} 输入 tokens，实际取决于模型上限，通常远小于此）。` +
      `探测结果将写入该模型的容量徽标（随「保存提供商」落盘）。是否继续？`,
  };
};

const startProbe = async () => {
  probeConfirm.value.show = false;
  if (probing.value) return;
  probing.value = true;
  setActionMessage("探测中…", null);
  try {
    const result = await probeModelContextLength(currentDraft.value, selectedModelName.value, {
      onProgress: (p) => {
        probeProgressText.value = `探测中 (${p.attempt}/${p.maxRequests}·${formatContextLength(p.tokens)})…`;
        setActionMessage(probeProgressText.value, null);
      },
    });

    if (result.contextLength > 0) {
      const target = (localProvider.value.models || []).find(
        (m) => (m.name || m.id) === selectedModelName.value
      );
      if (target) {
        target.contextLength = result.contextLength;
      }
      const bound = result.upperBound
        ? `，确认上限不超过 ${formatContextLength(result.upperBound)}`
        : "（未触顶，已达探测阶梯上界）";
      setActionMessage(
        `探测完成：实际可容纳 ≥ ${formatContextLength(result.contextLength)} 的输入${bound}，共 ${result.requests} 次请求。结果已写入模型容量，记得保存。`,
        true
      );
      showMessage(`「${selectedModelName.value}」上下文容量探测完成（≥ ${formatContextLength(result.contextLength)}）`, 4000, "info");
    } else if (result.aborted) {
      setActionMessage(`探测中止：${result.aborted}`, false);
    } else {
      setActionMessage("探测失败：连最小规模（4k tokens）请求都未能通过，请先用「深度测试」确认模型可用", false);
    }
  } catch (err: any) {
    setActionMessage(`探测失败：${err?.message || err}`, false);
  } finally {
    probing.value = false;
  }
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
