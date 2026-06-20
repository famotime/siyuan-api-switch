<template>
  <div class="plugin-app-main" v-if="showDialog">
    <div class="dialog-overlay" @click.self="closeDialog">
      <div class="manager-dialog animate-fade-in">
        <!-- 顶栏 -->
        <div class="dialog-header">
          <div class="header-title">
            <svg class="header-icon" viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3" style="fill:none!important"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" style="fill:none!important"></path></svg>
            <span>API 管家 (siyuan-api-manager)</span>
          </div>
          <button class="close-btn" @click="closeDialog" data-tooltip="关闭窗口">
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>

        <!-- 主体区域 -->
        <div class="dialog-body">
          <!-- 左侧导航栏 -->
          <div class="dialog-sidebar">
            <div class="sidebar-section">
              <div class="section-title">
                <div class="title-text">
                  <span class="title-indicator"></span>
                  <span>API 配置轮廓 (Profiles)</span>
                </div>
                <button class="add-profile-btn" @click="createNewProfile" data-tooltip="添加新配置">
                  <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                </button>
              </div>
              <div class="profile-list">
                <div 
                  v-for="prof in profiles" 
                  :key="prof.id" 
                  :class="['profile-item', { active: selectedProfileId === prof.id }]"
                  @click="selectProfile(prof.id)"
                >
                  <div class="profile-item-meta">
                    <div class="profile-item-name">{{ prof.name }}</div>
                    <div class="profile-item-sub">{{ getProviderName(prof.provider) }} | {{ prof.model }}</div>
                  </div>
                  <button class="profile-quick-delete" @click.stop="quickDeleteProfile(prof)" data-tooltip="删除配置">
                    <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" style="fill:none!important"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                  </button>
                </div>
                <div v-if="profiles.length === 0" class="empty-list">
                  暂无 API 配置，点击上方 + 创建
                </div>
              </div>
            </div>

            <div class="sidebar-section">
              <div class="section-title">
                <div class="title-text">
                  <span class="title-indicator"></span>
                  <span>子插件接管 (Bindings)</span>
                </div>
              </div>
              <div class="plugin-list">
                <div 
                  v-for="plug in registeredPlugins" 
                  :key="plug.pluginId" 
                  :class="['plugin-item', { active: activePluginId === plug.pluginId }]"
                  @click="selectPlugin(plug.pluginId)"
                >
                  <div class="plugin-item-info">
                    <div class="plugin-item-header">
                      <span class="plugin-name">{{ plug.displayName }}</span>
                      <span :class="['status-badge', plug.isBound ? 'bound' : 'unbound']">
                        {{ plug.isBound ? '已接管' : '独立配置' }}
                      </span>
                    </div>
                    <div class="plugin-sub text-truncate">{{ plug.pluginId }}</div>
                  </div>
                  <button v-if="plug.isBound" class="plugin-quick-unbind" @click.stop="quickUnbindPlugin(plug)" data-tooltip="解除接管">
                    <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M18.84 12.77A4 4 0 0 0 20 10a4 4 0 0 0-4-4h-4a4 4 0 0 0-4 4M5.16 11.23A4 4 0 0 0 4 14a4 4 0 0 0 4 4h4a4 4 0 0 0 4-4" style="fill:none!important"></path><line x1="2" y1="2" x2="22" y2="22"></line></svg>
                  </button>
                </div>
                <div v-if="registeredPlugins.length === 0" class="empty-list">
                  暂无活跃的兼容子插件
                </div>
              </div>
            </div>
          </div>

          <!-- 右侧内容编辑区 -->
          <div class="dialog-content">
            <!-- 场景一：编辑 Profile -->
            <div v-if="activeView === 'profile' && editingProfile" class="form-container">
              <div class="content-header">
                <h2>{{ isNewProfile ? '新建 API 配置' : '编辑 API 配置' }}</h2>
              </div>
              <div class="form-scroll-wrapper">
                <div class="form-row">
                  <div class="form-group col-6">
                    <label>配置名称 *</label>
                    <input type="text" class="b3-text-field" v-model="editingProfile.name" placeholder="如 DeepSeek 默认" />
                  </div>
                  <div class="form-group col-6">
                    <div class="label-with-link">
                      <label>AI 服务商 *</label>
                      <a v-if="editingProfile.providerUrl" href="javascript:void(0)" @click.prevent="openProviderUrl(editingProfile.providerUrl)" class="provider-link-btn" data-tooltip="前往官网获取 API Key">
                        <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" style="fill:none!important"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                      </a>
                    </div>
                    <select class="b3-select" v-model="editingProfile.provider" @change="onProviderChange">
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
                  <input type="text" class="b3-text-field" v-model="editingProfile.baseUrl" placeholder="https://api.example.com/v1" />
                </div>

                <div class="form-group">
                  <label>API 密钥 (API Key) *</label>
                  <div class="input-password-wrapper">
                    <input 
                      :type="showApiKey ? 'text' : 'password'" 
                      class="b3-text-field" 
                      v-model="editingProfile.apiKey" 
                      placeholder="sk-..." 
                    />
                    <button class="toggle-password-btn" @click="showApiKey = !showApiKey" type="button" :data-tooltip="showApiKey ? '隐藏密钥' : '显示密钥'">
                      <svg v-if="showApiKey" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" style="fill:none!important"></path><circle cx="12" cy="12" r="3" style="fill:none!important"></circle></svg>
                      <svg v-else viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" style="fill:none!important"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                    </button>
                  </div>
                </div>

                <div class="form-row">
                  <div class="form-group col-8">
                    <label>模型名称 (Model) *</label>
                    <input type="text" class="b3-text-field" v-model="editingProfile.model" placeholder="gpt-4o-mini" />
                  </div>
                  <div class="form-group col-4">
                    <label>推荐预设模型</label>
                    <select class="b3-select" @change="selectPresetModel($event)">
                      <option value="">-- 选择预设模型 --</option>
                      <option v-for="m in presetModels[editingProfile.provider] || []" :key="m" :value="m">{{ m }}</option>
                    </select>
                  </div>
                </div>

                <!-- 折叠的高级设置面板 -->
                <div class="advanced-divider" @click="showAdvanced = !showAdvanced">
                  <span>高级参数设置</span>
                  <svg :class="['arrow-icon', { expanded: showAdvanced }]" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                </div>

                <div class="advanced-fields" v-show="showAdvanced">
                  <div class="form-row">
                    <div class="form-group col-4">
                      <label>超时时间 (秒)</label>
                      <input type="number" class="b3-text-field" v-model.number="editingProfile.requestTimeoutSeconds" min="1" max="600" />
                    </div>
                    <div class="form-group col-4">
                      <label>采样温度 (Temperature)</label>
                      <input type="number" class="b3-text-field" v-model.number="editingProfile.temperature" step="0.1" min="0" max="2" />
                    </div>
                    <div class="form-group col-4">
                      <label>单次 Max Tokens</label>
                      <input type="number" class="b3-text-field" v-model.number="editingProfile.maxTokens" min="1" />
                    </div>
                  </div>

                  <div class="form-group">
                    <label>备注说明 (可选)</label>
                    <textarea class="b3-text-field textarea-field" v-model="editingProfile.memo" placeholder="添加此 API 账号的备注信息，如过期时间或用途说明..."></textarea>
                  </div>
                </div>
              </div>

              <div class="form-actions">
                <button class="b3-button b3-button--error" v-if="!isNewProfile" @click="deleteProfile(editingProfile.id)">删除</button>
                <div class="flex-spacer"></div>
                <button class="b3-button b3-button--cancel" @click="cancelEdit">取消</button>
                <button class="b3-button b3-button--primary" @click="saveProfile">保存</button>
              </div>
            </div>

            <!-- 场景二：编辑插件绑定 -->
            <div v-else-if="activeView === 'plugin' && activePlugin" class="binding-container">
              <div class="content-header">
                <h2>接管配置：{{ activePlugin.displayName }}</h2>
                <p class="subtitle">{{ activePlugin.pluginId }}</p>
              </div>

              <div class="binding-content">
                <div class="card-status-info" :class="activePlugin.isBound ? 'bound-card' : 'unbound-card'">
                  <div class="status-title">
                    当前接管状态: <strong>{{ activePlugin.isBound ? '已接管' : '独立配置 (未接管)' }}</strong>
                  </div>
                  <div class="status-desc">
                    {{ activePlugin.isBound 
                      ? '当前子插件的通用 AI API 配置由 API 管家接管。子插件原配置面板的相应字段已置灰只读。' 
                      : '当前子插件独立运行，使用其自身的配置面板所保存的 API 配置。' }}
                  </div>
                </div>

                <div v-if="!activePlugin.isBound && activePlugin.localConfig && activePlugin.localConfig.apiKey" class="local-config-import-card animate-fade-in" style="margin-bottom: 16px;">
                  <div class="import-card-title">
                    💡 检测到该插件已有本地配置
                  </div>
                  <div class="import-card-desc" style="margin-top: 4px;">
                    服务商: <strong>{{ getProviderName(activePlugin.localConfig.provider) }}</strong> | 
                    模型: <strong>{{ activePlugin.localConfig.model }}</strong> | 
                    地址: <code>{{ activePlugin.localConfig.baseUrl }}</code>
                  </div>
                  <button class="b3-button b3-button--primary import-action-btn" style="margin-top: 10px; padding: 4px 10px; font-size: 11px; height: auto;" @click="importLocalConfig(activePlugin.pluginId)">
                    📥 一键导入为 Profile 并接管
                  </button>
                </div>

                <div class="form-group binding-select-group">
                  <label>绑定 API 配置轮廓 (Profile)</label>
                  <select class="b3-select select-lg" :value="activePlugin.boundProfileId" @change="onBindingChange($event)">
                    <option value="">❌ 独立配置 (不接管此插件)</option>
                    <option v-for="prof in profiles" :key="prof.id" :value="prof.id">
                      🔗 {{ prof.name }} ({{ getProviderName(prof.provider) }} | {{ prof.model }})
                    </option>
                  </select>
                </div>

                <div class="binding-tips" v-if="activePlugin.boundProfileId">
                  <h3>接管字段包括：</h3>
                  <ul>
                    <li>API Base URL 和 API Key</li>
                    <li>默认 Model 模型名称</li>
                    <li>请求超时时间 (Timeout)</li>
                    <li>Temperature 采样温度与 Max Tokens 限制</li>
                  </ul>
                  <p class="warning-text">⚠️ 提示：绑定完成后，该子插件的 AI 请求将实时重定向至管家配置，无需手动重启插件。</p>
                </div>
              </div>
            </div>

            <!-- 场景三：空白状态 -->
            <div v-else class="empty-content">
              <svg class="welcome-icon" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3" style="fill:none!important"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" style="fill:none!important"></path></svg>
              <h2>欢迎使用 API 管家</h2>
              <p>左侧点击「+」可以创建多套不同的 AI 供应商配置。选择接管子插件，实现一键共享、无缝切换模型与供应商。</p>
            </div>
          </div>
        </div>

        <!-- 自定义精美确认弹窗 -->
        <div class="confirm-overlay" v-if="confirmDialog.show">
          <div class="confirm-dialog animate-fade-in">
            <div class="confirm-title">{{ confirmDialog.title }}</div>
            <div class="confirm-text">{{ confirmDialog.text }}</div>
            <div class="confirm-actions">
              <button class="b3-button b3-button--cancel" @click="closeConfirm(false)">取消</button>
              <button class="b3-button b3-button--primary" @click="closeConfirm(true)">确定</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { usePlugin } from '@/main'
import { onMounted, ref, watch } from 'vue'
import { apiManagerCore, ApiProfile, RegisteredPluginInfo } from "@/services/api-manager-core"
import { showMessage } from "siyuan"

// 状态定义
const showDialog = ref(false)
const showApiKey = ref(false)
const showAdvanced = ref(false)
const activeView = ref<'empty' | 'profile' | 'plugin'>('empty')
const selectedProfileId = ref<string | null>(null)
const activePluginId = ref<string | null>(null)

const profiles = ref<ApiProfile[]>([])
const registeredPlugins = ref<RegisteredPluginInfo[]>([])

const activePlugin = ref<RegisteredPluginInfo | null>(null)
const editingProfile = ref<ApiProfile | null>(null)
const isNewProfile = ref(false)

// 记录原始快照用于脏检查
const originalProfileState = ref<string>("")

const recordProfileSnapshot = (profile: ApiProfile | null) => {
  originalProfileState.value = profile ? JSON.stringify(profile) : ""
}

const isProfileDirty = () => {
  if (activeView.value !== 'profile' || !editingProfile.value) return false
  return originalProfileState.value !== JSON.stringify(editingProfile.value)
}

// 自定义确认弹窗状态与方法
interface ConfirmState {
  show: boolean
  title: string
  text: string
  onConfirm?: () => void
  onCancel?: () => void
}

const confirmDialog = ref<ConfirmState>({
  show: false,
  title: "",
  text: ""
})

const showCustomConfirm = (title: string, text: string, onConfirm: () => void, onCancel?: () => void) => {
  confirmDialog.value = {
    show: true,
    title,
    text,
    onConfirm,
    onCancel
  }
}

const closeConfirm = (result: boolean) => {
  confirmDialog.value.show = false
  if (result) {
    if (confirmDialog.value.onConfirm) confirmDialog.value.onConfirm()
  } else {
    if (confirmDialog.value.onCancel) confirmDialog.value.onCancel()
  }
}

// 脏检查保护拦截
const handleSafeNavigate = (navigateFn: () => void) => {
  if (isProfileDirty()) {
    showCustomConfirm("未保存的更改", "当前配置已被修改，是否放弃更改并离开？", () => {
      // 放弃修改，重置快照并离开
      originalProfileState.value = ""
      navigateFn()
    })
  } else {
    navigateFn()
  }
}

// 提供商内置模板默认值
const providerDefaults: Record<string, { baseUrl: string; model: string; providerUrl: string }> = {
  deepseek: {
    baseUrl: "https://api.deepseek.com/v1",
    model: "deepseek-chat",
    providerUrl: "https://www.deepseek.com"
  },
  gemini: {
    baseUrl: "https://generativetoolkit.googleapis.com", // 思源笔记通用或直连代理
    model: "gemini-2.5-flash",
    providerUrl: "https://deepmind.google/technologies/gemini"
  },
  siliconflow: {
    baseUrl: "https://api.siliconflow.cn/v1",
    model: "deepseek-ai/DeepSeek-V3",
    providerUrl: "https://siliconflow.cn"
  },
  openai: {
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4o-mini",
    providerUrl: "https://openai.com"
  },
  custom: {
    baseUrl: "",
    model: "",
    providerUrl: ""
  }
}

// 常用模型列表预设
const presetModels: Record<string, string[]> = {
  deepseek: ["deepseek-chat", "deepseek-reasoner"],
  gemini: ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-1.5-flash", "gemini-1.5-pro"],
  siliconflow: [
    "deepseek-ai/DeepSeek-V3",
    "deepseek-ai/DeepSeek-R1",
    "Qwen/Qwen2.5-72B-Instruct",
    "THUDM/glm-4-9b-chat",
    "meta-llama/Meta-Llama-3-8B-Instruct"
  ],
  openai: ["gpt-4o-mini", "gpt-4o", "o1-mini", "o3-mini"],
  custom: []
}

const getProviderName = (provider: string) => {
  const dict: Record<string, string> = {
    deepseek: "DeepSeek",
    gemini: "Google Gemini",
    siliconflow: "SiliconFlow",
    openai: "OpenAI",
    custom: "Custom"
  }
  return dict[provider] || provider
}

const openProviderUrl = (url: string) => {
  if (url) {
    window.open(url, "_blank")
  }
}

// 数据同步刷新
const refreshData = () => {
  profiles.value = [...apiManagerCore.getProfiles()]
  registeredPlugins.value = [...apiManagerCore.getRegisteredPlugins()]
  
  if (activePluginId.value) {
    activePlugin.value = registeredPlugins.value.find(p => p.pluginId === activePluginId.value) || null
  }
}

const importLocalConfig = async (pluginId: string) => {
  showCustomConfirm("导入本地配置", "确定要将此插件的本地配置导入为全局 API Profile 并由 API 管家接管吗？", async () => {
    await apiManagerCore.importLocalConfigToProfile(pluginId)
    refreshData()
    showMessage("已成功导入并接管该插件", 3000, "info")
  })
}

onMounted(() => {
  apiManagerCore.onStateChange = refreshData
  refreshData()
  
  // 注册全局打开设置的方法
  window._sy_plugin_sample = window._sy_plugin_sample || {}
  window._sy_plugin_sample.openSetting = () => {
    showDialog.value = true
  }
})

// 顶栏图标初始化
const plugin = usePlugin()
plugin.addTopBar({
  icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 13h5m3 3V8h3a2 2 0 0 1 2 2v1a2 2 0 0 1-2 2h-3m8-5v8M9 16v-5.5a2.5 2.5 0 0 0-5 0V16" style="fill:none!important"></path></svg>`,
  title: 'API 管家',
  callback: () => {
    showDialog.value = true
  },
})

// 交互操作
const closeDialog = () => {
  handleSafeNavigate(() => {
    showDialog.value = false
  })
}

const selectProfile = (id: string) => {
  const doSelect = () => {
    activePluginId.value = null
    selectedProfileId.value = id
    isNewProfile.value = false
    activeView.value = 'profile'
    showApiKey.value = false
    showAdvanced.value = false // 切换Profile时收起高级

    const profile = profiles.value.find(p => p.id === id)
    if (profile) {
      editingProfile.value = { ...profile }
      recordProfileSnapshot(editingProfile.value)
    }
  }
  handleSafeNavigate(doSelect)
}

const selectPlugin = (pluginId: string) => {
  const doSelect = () => {
    selectedProfileId.value = null
    activePluginId.value = pluginId
    activeView.value = 'plugin'
    activePlugin.value = registeredPlugins.value.find(p => p.pluginId === pluginId) || null
  }
  handleSafeNavigate(doSelect)
}

const createNewProfile = () => {
  const doCreate = () => {
    activePluginId.value = null
    selectedProfileId.value = null
    isNewProfile.value = true
    activeView.value = 'profile'
    showApiKey.value = false
    showAdvanced.value = false // 新建时默认收起高级

    editingProfile.value = {
      id: "",
      name: "新配置",
      provider: "deepseek",
      baseUrl: providerDefaults.deepseek.baseUrl,
      apiKey: "",
      model: providerDefaults.deepseek.model,
      requestTimeoutSeconds: 60,
      temperature: 0.7,
      maxTokens: 4096,
      memo: "",
      providerUrl: providerDefaults.deepseek.providerUrl
    }
    recordProfileSnapshot(editingProfile.value)
  }
  handleSafeNavigate(doCreate)
}

const onProviderChange = () => {
  if (!editingProfile.value) return
  const prov = editingProfile.value.provider
  const defaults = providerDefaults[prov]
  if (defaults) {
    // 仅在字段为空时填充默认值，已有信息不覆盖
    if (!editingProfile.value.baseUrl) editingProfile.value.baseUrl = defaults.baseUrl
    if (!editingProfile.value.model) editingProfile.value.model = defaults.model
    if (!editingProfile.value.providerUrl) editingProfile.value.providerUrl = defaults.providerUrl
  }
}

const selectPresetModel = (e: Event) => {
  const val = (e.target as HTMLSelectElement).value
  if (val && editingProfile.value) {
    editingProfile.value.model = val
  }
}

const cancelEdit = () => {
  handleSafeNavigate(() => {
    editingProfile.value = null
    activeView.value = 'empty'
    selectedProfileId.value = null
  })
}

const saveProfile = async () => {
  if (!editingProfile.value) return
  const ep = editingProfile.value
  if (!ep.name.trim() || !ep.baseUrl.trim() || !ep.apiKey.trim() || !ep.model.trim()) {
    showMessage("请填写所有必填字段 (*)", 5000, "error")
    return
  }

  if (isNewProfile.value) {
    const newProf = await apiManagerCore.addProfile(ep)
    selectedProfileId.value = newProf.id
    isNewProfile.value = false
  } else {
    await apiManagerCore.updateProfile(ep)
  }
  
  showMessage("保存成功", 3000, "info")
  
  refreshData()
  
  // 更新快照，防止跳转拦截
  const savedProfile = profiles.value.find(p => p.id === selectedProfileId.value)
  if (savedProfile) {
    editingProfile.value = { ...savedProfile }
    recordProfileSnapshot(editingProfile.value)
  } else {
    recordProfileSnapshot(ep)
  }
  
  // 保持当前 profile 的选中状态
  selectProfile(selectedProfileId.value!)
}

const deleteProfile = async (id: string) => {
  showCustomConfirm("删除配置", "确定要删除此 API 配置吗？绑定此配置的插件将被取消接管。", async () => {
    originalProfileState.value = "" // 阻止脏检查
    await apiManagerCore.deleteProfile(id)
    editingProfile.value = null
    activeView.value = 'empty'
    selectedProfileId.value = null
    refreshData()
    showMessage("配置已成功删除", 3000, "info")
  })
}

// 侧边栏 Hover 快捷删除
const quickDeleteProfile = (prof: ApiProfile) => {
  showCustomConfirm("删除配置", `确定要删除 API 配置「${prof.name}」吗？绑定此配置的插件将被取消接管。`, async () => {
    if (editingProfile.value && editingProfile.value.id === prof.id) {
      originalProfileState.value = "" // 阻止脏检查
      editingProfile.value = null
      activeView.value = 'empty'
      selectedProfileId.value = null
    }
    await apiManagerCore.deleteProfile(prof.id)
    refreshData()
    showMessage(`配置「${prof.name}」已成功删除`, 3000, "info")
  })
}

// 侧边栏 Hover 快捷解除接管
const quickUnbindPlugin = (plug: RegisteredPluginInfo) => {
  showCustomConfirm("解除接管", `确定要解除对插件「${plug.displayName}」的接管吗？它将恢复为独立配置。`, async () => {
    await apiManagerCore.bindPlugin(plug.pluginId, "")
    refreshData()
    showMessage(`已解除对「${plug.displayName}」的接管`, 3000, "info")
  })
}

const onBindingChange = async (e: Event) => {
  if (!activePlugin.value) return
  const val = (e.target as HTMLSelectElement).value
  await apiManagerCore.bindPlugin(activePlugin.value.pluginId, val)
  refreshData()
}
</script>

<style lang="scss" scoped>
.plugin-app-main {
  width: 100vw;
  height: 100vh;
  position: fixed;
  top: 0;
  left: 0;
  z-index: 1999; /* 保证在思源最顶层 */
}

.dialog-overlay {
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px);
  display: flex;
  justify-content: center;
  align-items: center;
}

.manager-dialog {
  width: 960px;
  height: 640px;
  background-color: var(--b3-theme-background);
  color: var(--b3-theme-on-background);
  border-radius: 12px;
  border: 1px solid var(--b3-border-color);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.25);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  user-select: none;
}

.dialog-header {
  height: 48px;
  padding: 0 16px;
  border-bottom: 1px solid var(--b3-border-color);
  display: flex;
  align-items: center;
  justify-content: space-between;
  background-color: var(--b3-theme-surface);

  .header-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 15px;
    font-weight: 600;

    .header-icon {
      width: 18px;
      height: 18px;
      color: var(--b3-theme-primary);
    }
  }

  .close-btn {
    background: none;
    border: none;
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--b3-theme-on-surface);

    svg {
      width: 16px;
      height: 16px;
    }

    &:hover {
      background-color: var(--b3-theme-background-hover);
    }
  }
}

.dialog-body {
  flex: 1;
  display: flex;
  min-height: 0; /* 允许子元素滚动 */
}

.dialog-sidebar {
  width: 280px;
  border-right: 1px solid var(--b3-border-color);
  background-color: var(--b3-theme-surface);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  padding: 16px 0;
  gap: 20px;
}

.sidebar-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-bottom: 20px;
  
  &:not(:last-child) {
    border-bottom: 1.5px solid var(--b3-border-color);
    margin-bottom: 4px;
  }

  .section-title {
    font-size: 12px;
    font-weight: 600;
    color: var(--b3-theme-on-surface);
    padding: 0 16px;
    margin-bottom: 8px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    letter-spacing: 0.5px;
    
    .title-text {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    
    .title-indicator {
      width: 3px;
      height: 12px;
      background-color: var(--b3-theme-primary);
      border-radius: 2px;
      display: inline-block;
    }

    .add-profile-btn {
      background: none;
      border: none;
      cursor: pointer;
      color: var(--b3-theme-primary);
      padding: 2px;
      border-radius: 4px;
      display: flex;
      align-items: center;

      svg {
        width: 14px;
        height: 14px;
      }

      &:hover {
        background-color: var(--b3-theme-background-hover);
      }
    }
  }
}

.profile-list, .plugin-list {
  display: flex;
  flex-direction: column;
}

.profile-item, .plugin-item {
  padding: 8px 16px;
  cursor: pointer;
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  border-left: 3px solid transparent;
  transition: background-color 0.2s ease, border-left-color 0.2s ease;

  .profile-item-meta, .plugin-item-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .profile-quick-delete, .plugin-quick-unbind {
    opacity: 0;
    background: none;
    border: none;
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    color: var(--b3-theme-on-surface-mute, #888);
    transition: opacity 0.2s ease, color 0.2s ease, background-color 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-left: 8px;

    &:hover {
      background-color: var(--b3-theme-background-hover);
      color: var(--b3-theme-error, #f44336);
    }
  }

  &:hover {
    background-color: var(--b3-theme-background-hover);
    
    .profile-quick-delete, .plugin-quick-unbind {
      opacity: 1;
    }
  }

  &.active {
    background-color: var(--b3-theme-background-focus, rgba(63, 81, 181, 0.1));
    border-left-color: var(--b3-theme-primary);
  }
}

.profile-item-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--b3-theme-on-background);
}

.profile-item-sub {
  font-size: 11px;
  color: var(--b3-theme-on-surface-mute, #888);
}

.plugin-item-header {
  display: flex;
  align-items: center;
  justify-content: space-between;

  .plugin-name {
    font-size: 13px;
    font-weight: 500;
  }

  .status-badge {
    font-size: 9px;
    padding: 1px 4px;
    border-radius: 4px;
    font-weight: bold;

    &.bound {
      background-color: rgba(76, 175, 80, 0.12);
      color: var(--b3-theme-success, #4caf50);
    }

    &.unbound {
      background-color: rgba(158, 158, 158, 0.12);
      color: var(--b3-theme-on-surface-mute, #9e9e9e);
    }
  }
}

.plugin-sub {
  font-size: 10px;
  color: var(--b3-theme-on-surface-mute, #888);
}

.empty-list {
  font-size: 12px;
  color: var(--b3-theme-on-surface-mute, #888);
  padding: 12px 16px;
  text-align: center;
  font-style: italic;
}

.dialog-content {
  flex: 1;
  background-color: var(--b3-theme-background);
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.empty-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px;
  text-align: center;
  color: var(--b3-theme-on-surface-mute, #888);

  .welcome-icon {
    width: 64px;
    height: 64px;
    color: var(--b3-theme-primary-light, #cfd8dc);
    margin-bottom: 16px;
  }

  h2 {
    font-size: 18px;
    font-weight: 600;
    margin-bottom: 8px;
    color: var(--b3-theme-on-background);
  }

  p {
    font-size: 13px;
    max-width: 420px;
    line-height: 1.6;
  }
}

.content-header {
  padding: 20px 24px 12px;
  border-bottom: 1px solid var(--b3-border-color);

  h2 {
    font-size: 16px;
    font-weight: 600;
    margin: 0;
  }

  .subtitle {
    font-size: 12px;
    color: var(--b3-theme-on-surface-mute, #888);
    margin: 4px 0 0 0;
  }
}

.form-container, .binding-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.form-scroll-wrapper {
  flex: 1;
  overflow-y: auto;
  padding: 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-row {
  display: flex;
  gap: 16px;

  .form-group {
    margin-bottom: 0;
  }

  .col-6 {
    flex: 1;
  }

  .col-4 {
    width: calc(33.33% - 11px);
  }

  .col-8 {
    width: calc(66.66% - 5px);
  }

  .col-12 {
    width: 100%;
  }
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;

  label {
    font-size: 12px;
    font-weight: 600;
    color: var(--b3-theme-on-background);
  }

  .b3-text-field {
    width: 100%;
    box-sizing: border-box;
  }

  .b3-select {
    width: 100%;
    box-sizing: border-box;
    height: 32px;
  }

  .textarea-field {
    min-height: 80px;
    resize: vertical;
    font-family: inherit;
    padding: 6px 8px;
  }
}

.label-with-link {
  display: flex;
  align-items: center;
  gap: 6px;

  .provider-link-btn {
    display: inline-flex;
    align-items: center;
    color: var(--b3-theme-primary);
    opacity: 0.8;
    transition: opacity 0.2s ease;

    &:hover {
      opacity: 1;
    }
  }
}

.input-password-wrapper {
  position: relative;
  display: flex;
  align-items: center;

  .b3-text-field {
    padding-right: 40px;
  }

  .toggle-password-btn {
    position: absolute;
    right: 8px;
    background: none;
    border: none;
    color: var(--b3-theme-on-surface-mute, #888);
    cursor: pointer;
    padding: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition: color 0.2s ease, background-color 0.2s ease;

    &:hover {
      background-color: var(--b3-theme-background-hover);
      color: var(--b3-theme-primary);
    }
  }
}

.form-actions {
  padding: 16px 24px;
  border-top: 1px solid var(--b3-border-color);
  background-color: var(--b3-theme-surface);
  display: flex;
  gap: 12px;
}

.flex-spacer {
  flex: 1;
}

.binding-content {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.card-status-info {
  border-radius: 8px;
  padding: 16px;
  border: 1px solid transparent;

  .status-title {
    font-size: 14px;
    margin-bottom: 6px;
  }

  .status-desc {
    font-size: 12px;
    line-height: 1.5;
  }

  &.bound-card {
    background-color: rgba(76, 175, 80, 0.08);
    border-color: rgba(76, 175, 80, 0.2);
    .status-title strong {
      color: var(--b3-theme-success, #4caf50);
    }
  }

  &.unbound-card {
    background-color: rgba(158, 158, 158, 0.08);
    border-color: rgba(158, 158, 158, 0.2);
    .status-title strong {
      color: var(--b3-theme-on-surface-mute, #9e9e9e);
    }
  }
}

.binding-select-group {
  .select-lg {
    height: 40px;
    font-size: 14px;
  }
}

.binding-tips {
  background-color: var(--b3-theme-surface);
  border: 1px solid var(--b3-border-color);
  border-radius: 8px;
  padding: 16px;

  h3 {
    font-size: 13px;
    font-weight: 600;
    margin: 0 0 10px 0;
  }

  ul {
    margin: 0 0 16px 0;
    padding-left: 20px;
    font-size: 12px;
    line-height: 1.8;
    color: var(--b3-theme-on-background);
  }

  .warning-text {
    font-size: 11px;
    color: var(--b3-theme-on-surface-mute, #a0a0a0);
    margin: 0;
    font-style: italic;
  }
}

.local-config-import-card {
  background-color: rgba(63, 81, 181, 0.05);
  border: 1px dashed var(--b3-theme-primary);
  border-radius: 8px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;

  .import-card-title {
    font-size: 13px;
    font-weight: bold;
    color: var(--b3-theme-primary);
  }

  .import-card-desc {
    font-size: 11px;
    color: var(--b3-theme-on-background);
    opacity: 0.8;
    code {
      background: var(--b3-theme-surface);
      padding: 2px 4px;
      border-radius: 4px;
      font-size: 10px;
    }
  }

  .import-action-btn {
    align-self: flex-start;
    padding: 6px 12px;
    height: auto;
    font-size: 12px;
  }
}

.text-truncate {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 简单的进入动画 */
.animate-fade-in {
  animation: fadeIn 0.2s ease-out forwards;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

/* CSS Tooltip 机制 */
[data-tooltip] {
  position: relative;
  
  &::after {
    content: attr(data-tooltip);
    position: absolute;
    bottom: 125%;
    left: 50%;
    transform: translateX(-50%) scale(0.8);
    background-color: var(--b3-theme-on-background, #2c3e50);
    color: var(--b3-theme-background, #ffffff);
    padding: 5px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: normal;
    white-space: nowrap;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.15s cubic-bezier(0.4, 0, 0.2, 1), transform 0.15s cubic-bezier(0.4, 0, 0.2, 1);
    z-index: 2050;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }
  
  &:hover::after {
    opacity: 1;
    transform: translateX(-50%) scale(1);
  }
}

/* 折叠高级设置样式 */
.advanced-divider {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  color: var(--b3-theme-on-surface-mute, #888);
  padding: 10px 0;
  border-bottom: 1px dashed var(--b3-border-color);
  user-select: none;
  margin: 12px 0 4px 0;
  transition: color 0.2s ease;

  &:hover {
    color: var(--b3-theme-primary);
  }

  .arrow-icon {
    width: 14px;
    height: 14px;
    transition: transform 0.2s ease;
    
    &.expanded {
      transform: rotate(180deg);
    }
  }
}

.advanced-fields {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-top: 8px;
  animation: slideDown 0.2s ease-out forwards;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 自定义确认弹窗样式 */
.confirm-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background-color: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px);
  z-index: 2100;
  display: flex;
  justify-content: center;
  align-items: center;
}

.confirm-dialog {
  width: 360px;
  background-color: var(--b3-theme-background);
  color: var(--b3-theme-on-background);
  border-radius: 12px;
  border: 1px solid var(--b3-border-color);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  
  .confirm-title {
    font-size: 15px;
    font-weight: 600;
    color: var(--b3-theme-on-background);
  }
  
  .confirm-text {
    font-size: 13px;
    line-height: 1.5;
    color: var(--b3-theme-on-surface-mute, #888);
  }
  
  .confirm-actions {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
  }
}
</style>