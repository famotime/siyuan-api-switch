<template>
  <div class="plugin-app-main" v-if="showDialog">
    <div class="dialog-overlay">
      <div 
        class="switch-dialog"
        :class="{ 'is-dragging': isDraggingWindow, 'is-resizing': isResizingWindow }"
        :style="{
          width: `${dialogWidth}px`,
          height: `${dialogHeight}px`,
          transform: `translate(${dialogTranslateX}px, ${dialogTranslateY}px)`,
        }"
      >
        <!-- 顶栏 (支持按住拖拽移动、双击最大化/还原) -->
        <div class="dialog-header" @mousedown="onHeaderMouseDown" @dblclick="toggleMaximize">
          <div class="header-title">
            <svg class="header-icon" viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3" style="fill:none!important"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" style="fill:none!important"></path></svg>
            <span>API 旋钮 (siyuan-api-switch)</span>
          </div>
          <div class="header-actions">
            <!-- 业务同步操作组 -->
            <div class="header-sync-group">
              <button 
                class="header-sync-btn header-sync-btn--read" 
                @click="syncFromSiyuanAction" 
                data-tooltip="从思源读取 AI 配置并同步" 
                data-tooltip-position="bottom"
              >
                <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="7 10 12 15 17 10"></polyline>
                  <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
                <span>读取思源配置</span>
              </button>
            </div>

            <!-- 分割线 -->
            <div class="header-divider"></div>

            <!-- 窗口控制组 -->
            <div class="header-window-group">
              <button class="header-btn" @click="toggleMaximize" :data-tooltip="isMaximized ? '还原窗口' : '最大化窗口'" data-tooltip-position="bottom">
                <svg v-if="!isMaximized" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" style="fill:none!important"></rect></svg>
                <svg v-else viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 14 10 14 10 20" style="fill:none!important"></polyline><polyline points="20 10 14 10 14 4" style="fill:none!important"></polyline><line x1="14" y1="10" x2="21" y2="3"></line><line x1="3" y1="21" x2="10" y2="14"></line></svg>
              </button>
              <button class="close-btn" @click="handleCloseDialog" data-tooltip="关闭窗口" data-tooltip-position="bottom">
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
          </div>
        </div>

        <!-- 主体区域 -->
        <div class="dialog-body">
          <!-- 左侧导航栏 -->
          <div class="dialog-sidebar">
            <div class="sidebar-scroll-content">
              <!-- 分区一：API 提供商 (Providers) -->
              <div class="sidebar-section">
                <div class="section-title">
                  <div class="title-text">
                    <span class="title-indicator"></span>
                    <span>API 提供商 (Providers)</span>
                  </div>
                  <div class="title-actions">
                    <button 
                      class="title-action-btn" 
                      @click="createNewProvider" 
                      data-tooltip="添加新提供商" 
                      data-tooltip-position="bottom"
                    >
                      <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                    </button>
                  </div>
                </div>
                <div class="profile-list">
                  <div 
                    v-for="prov in providers" 
                    :key="prov.id" 
                    :class="['profile-item', { active: activeView === 'provider' && selectedProviderId === prov.id }]"
                    @click="selectProvider(prov.id)"
                  >
                    <div class="profile-item-meta">
                      <div class="profile-item-name">{{ prov.displayName }}</div>
                      <div class="profile-item-sub">{{ prov.protocol || 'openai' }} | {{ (prov.models && prov.models.length) || 0 }} 个模型</div>
                    </div>
                    <button class="profile-quick-delete" @click.stop="quickDeleteProvider(prov)" data-tooltip="删除提供商" data-tooltip-position="left">
                      <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                    </button>
                  </div>
                  <div v-if="providers.length === 0" class="empty-list">
                    暂无提供商，点击 + 或从思源同步
                  </div>
                </div>
              </div>

              <!-- 分区二：API 配置文件 (Profiles) -->
              <div class="sidebar-section">
                <div class="section-title">
                  <div class="title-text">
                    <span class="title-indicator"></span>
                    <span>API 配置文件 (Profiles)</span>
                  </div>
                  <div class="title-actions">
                    <input 
                      type="file" 
                      ref="fileInputRef" 
                      style="display: none" 
                      accept=".json" 
                      @change="handleFileImport" 
                    />
                    <button 
                      class="title-action-btn" 
                      @click="triggerImport" 
                      data-tooltip="导入 API 配置"
                      data-tooltip-position="bottom"
                    >
                      <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" style="fill:none!important"></path><polyline points="17 8 12 3 7 8" style="fill:none!important"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                    </button>
                    <button 
                      class="title-action-btn" 
                      @click="exportProfiles" 
                      data-tooltip="导出 API 配置"
                      data-tooltip-position="bottom"
                    >
                      <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" style="fill:none!important"></path><polyline points="7 10 12 15 17 10" style="fill:none!important"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                    </button>
                    <button 
                      class="title-action-btn" 
                      @click="createNewProfile" 
                      data-tooltip="添加新配置" 
                      data-tooltip-position="bottom"
                    >
                      <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                    </button>
                  </div>
                </div>
                <div class="profile-list">
                  <div 
                    v-for="prof in profiles" 
                    :key="prof.id" 
                    :class="['profile-item', { active: selectedProfileId === prof.id }]"
                    @click="selectProfile(prof.id)"
                  >
                    <div class="profile-item-meta">
                      <div class="profile-item-name">
                        <span>{{ prof.name }}</span>
                        <span v-if="prof.isDecisionModel" class="profile-badge decision-badge">决策模型</span>
                        <span v-else-if="prof.name.includes('编辑器')" class="profile-badge builtin-badge">思源编辑器</span>
                        <span v-else-if="prof.name.includes('智能体')" class="profile-badge builtin-badge">思源智能体</span>
                      </div>
                      <div class="profile-item-sub">{{ getProfileDisplaySub(prof) }}</div>
                    </div>
                    <button class="profile-quick-apply" @click.stop="applyProfileToAll(prof)" data-tooltip="应用到所有接管项目" data-tooltip-position="left">
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" style="fill:none!important"></polygon></svg>
                    </button>
                    <button class="profile-quick-delete" @click.stop="quickDeleteProfile(prof)" data-tooltip="删除配置" data-tooltip-position="left">
                      <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" style="fill:none!important"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                    </button>
                  </div>
                  <div v-if="profiles.length === 0" class="empty-list">
                    暂无 API 配置，点击上方 + 创建
                  </div>
                </div>
              </div>

              <!-- 分区三：子插件接管 (Bindings) -->
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
                        <span :class="['status-badge', plug.bindingState === 'partial' ? 'partial' : (plug.isBound ? 'bound' : 'unbound')]">
                          {{ plug.bindingState === 'partial' ? '部分接管' : (plug.isBound ? '已接管' : '独立配置') }}
                        </span>
                      </div>
                      <div class="plugin-sub text-truncate">{{ plug.pluginId }}</div>
                    </div>
                    <button v-if="plug.isBound" class="plugin-quick-unbind" @click.stop="quickUnbindPlugin(plug)" data-tooltip="解除接管" data-tooltip-position="left">
                      <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M18.84 12.77A4 4 0 0 0 20 10a4 4 0 0 0-4-4h-4a4 4 0 0 0-4 4M5.16 11.23A4 4 0 0 0 4 14a4 4 0 0 0 4 4h4a4 4 0 0 0 4-4" style="fill:none!important"></path><line x1="2" y1="2" x2="22" y2="22"></line></svg>
                    </button>
                  </div>
                  <div v-if="registeredPlugins.length === 0" class="empty-list">
                    暂无活跃的兼容子插件
                  </div>
                </div>
              </div>
            </div>
            
            <div class="sidebar-footer">
              <label class="log-switch-label" title="开启后，在删除配置或同步过程中若遇到异常，会弹窗提示详细堆栈">
                <input type="checkbox" v-model="enableDebugLog" @change="saveLogSetting" />
                <span>启用日志调试</span>
              </label>
            </div>
          </div>

          <!-- 右侧内容编辑区 -->
          <div class="dialog-content">
            <!-- 场景一：编辑 API 提供商 (Provider) -->
            <ProviderEditPanel
              ref="providerPanelRef"
              v-if="activeView === 'provider' && editingProvider"
              :provider="editingProvider"
              :is-new="isNewProvider"
              @save="saveProvider"
              @delete="deleteProvider"
              @cancel="cancelProviderEdit"
            />

            <!-- 场景二：编辑 Profile -->
            <ProfileEditPanel
              ref="profilePanelRef"
              v-else-if="activeView === 'profile' && editingProfile"
              :profile="editingProfile"
              :is-new="isNewProfile"
              :providers="providers"
              @save="saveProfile"
              @delete="deleteProfile"
              @cancel="cancelEdit"
            />

            <!-- 场景三：编辑插件绑定 -->
            <PluginBindingsPanel
              v-else-if="activeView === 'plugin' && activePlugin"
              :plugin="activePlugin"
              :profiles="profiles"
              @binding-change="onBindingChange"
              @import-local-config="importLocalConfig"
            />

            <!-- 场景四：空白状态 -->
            <div v-else class="empty-content">
              <svg class="welcome-icon" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3" style="fill:none!important"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" style="fill:none!important"></path></svg>
              <h2>欢迎使用 API 旋钮</h2>
              <p>左侧点击「+」可以创建多套不同的 AI 供应商配置。选择接管子插件，实现一键共享、无缝切换模型与供应商。</p>

              <!-- 快捷导入思源配置卡片 -->
              <div v-if="hasSiyuanBuiltInAi" class="siyuan-import-card animate-fade-in">
                <div class="card-icon">
                  <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" style="fill:none!important"></path><polyline points="7 10 12 15 17 10" style="fill:none!important"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                </div>
                <div class="card-content">
                  <div class="card-title">检测到思源笔记已配置内置 AI</div>
                  <div class="card-desc">自动读取思源笔记「设置 -> AI」中配置的信息：{{ siyuanBuiltInAiInfo }}。</div>
                  <button class="b3-button b3-button--primary import-action-btn" @click="importSiyuanBuiltInAi">
                    一键导入并创建 Profile
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 8 个方向的拖拽缩放手柄 -->
        <div class="resize-handle resize-handle-n" @mousedown.prevent.stop="onResizeStart($event, 'n')"></div>
        <div class="resize-handle resize-handle-s" @mousedown.prevent.stop="onResizeStart($event, 's')"></div>
        <div class="resize-handle resize-handle-w" @mousedown.prevent.stop="onResizeStart($event, 'w')"></div>
        <div class="resize-handle resize-handle-e" @mousedown.prevent.stop="onResizeStart($event, 'e')"></div>
        <div class="resize-handle resize-handle-nw" @mousedown.prevent.stop="onResizeStart($event, 'nw')"></div>
        <div class="resize-handle resize-handle-ne" @mousedown.prevent.stop="onResizeStart($event, 'ne')"></div>
        <div class="resize-handle resize-handle-sw" @mousedown.prevent.stop="onResizeStart($event, 'sw')"></div>
        <div class="resize-handle resize-handle-se" @mousedown.prevent.stop="onResizeStart($event, 'se')">
          <svg class="resize-grip-icon" viewBox="0 0 10 10" width="10" height="10">
            <path d="M8 2 L2 8 M9 5 L5 9 M9 8 L8 9" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" fill="none" />
          </svg>
        </div>
      </div>
    </div>

    <!-- 自定义确认弹窗 -->
    <div class="confirm-overlay" v-if="confirmDialog.show" @click.self="handleConfirmOverlayClick">
      <div class="confirm-dialog animate-fade-in">
        <div class="confirm-title">{{ confirmDialog.title }}</div>
        <div class="confirm-text" style="white-space: pre-line;">{{ confirmDialog.text }}</div>
        <div class="confirm-actions">
          <button class="b3-button b3-button--cancel" @click="handleConfirmCancel">{{ confirmDialog.cancelText }}</button>
          <button class="b3-button b3-button--primary" @click="handleConfirmOk">{{ confirmDialog.confirmText }}</button>
        </div>
      </div>
    </div>

    <!-- 预置供应商目录选择器 -->
    <ProviderPresetPicker
      v-if="showPresetPicker"
      @select="createProviderFromPreset"
      @cancel="showPresetPicker = false"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { apiSwitchCore, ApiProfile, RegisteredPluginInfo, extractSiyuanAiSettings, PRESET_PROVIDERS, PRESET_PROVIDER_LIST, AutoProviderResult } from "@/services/api-switch-core"
import { ApiProvider, ApiProviderModel } from "@/types"
import { lookupModelContextLength } from "@/constants/model-contexts"
import { computeDefaultProfileName } from "@/utils/profile-naming"
import { showMessage } from "siyuan"
import { useWindowDrag } from "@/composables/useWindowDrag"
import ProviderEditPanel from "@/components/ProviderEditPanel.vue"
import ProfileEditPanel from "@/components/ProfileEditPanel.vue"
import PluginBindingsPanel from "@/components/PluginBindingsPanel.vue"
import ProviderPresetPicker from "@/components/ProviderPresetPicker.vue"

// 调试日志开关
const STORAGE_KEY_DEBUG = "sy_api_switch_debug"
const enableDebugLog = ref(localStorage.getItem(STORAGE_KEY_DEBUG) === "true")
const saveLogSetting = () => {
  localStorage.setItem(STORAGE_KEY_DEBUG, enableDebugLog.value ? "true" : "false")
}
const logDebug = (msg: string, ...args: any[]) => {
  if (enableDebugLog.value) {
    console.log(`[API Switch Debug] ${msg}`, ...args)
  }
}

// 窗口拖拽缩放管理
const {
  showDialog,
  dialogWidth,
  dialogHeight,
  dialogTranslateX,
  dialogTranslateY,
  isMaximized,
  isDraggingWindow,
  isResizingWindow,
  openDialog,
  closeDialog,
  toggleMaximize,
  onHeaderMouseDown,
  onResizeStart,
} = useWindowDrag(() => enableDebugLog.value)

// 响应式数据
const providers = ref<ApiProvider[]>([])
const profiles = ref<ApiProfile[]>([])
const registeredPlugins = ref<RegisteredPluginInfo[]>([])

const activeView = ref<'provider' | 'profile' | 'plugin' | 'empty'>('empty')
const selectedProviderId = ref<string | null>(null)
const selectedProfileId = ref<string | null>(null)
const activePluginId = ref<string | null>(null)

const editingProvider = ref<ApiProvider | null>(null)
const isNewProvider = ref(false)

const editingProfile = ref<ApiProfile | null>(null)
const isNewProfile = ref(false)

const fileInputRef = ref<HTMLInputElement | null>(null)
const providerPanelRef = ref<InstanceType<typeof ProviderEditPanel> | null>(null)
const profilePanelRef = ref<InstanceType<typeof ProfileEditPanel> | null>(null)

const activePlugin = computed(() => {
  if (activeView.value !== 'plugin' || !activePluginId.value) return null
  return registeredPlugins.value.find((p) => p.pluginId === activePluginId.value) || null
})

// 确认弹窗状态
interface ConfirmDialogOptions {
  title: string
  text: string
  confirmText?: string
  cancelText?: string
  onConfirm: () => void | Promise<void>
  onCancel?: () => void
}

const confirmDialog = ref<{
  show: boolean
  title: string
  text: string
  confirmText: string
  cancelText: string
  onConfirm: () => void | Promise<void>
  onCancel?: () => void
}>({
  show: false,
  title: "",
  text: "",
  confirmText: "确定",
  cancelText: "取消",
  onConfirm: () => {},
  onCancel: undefined,
})

const showCustomConfirm = (
  titleOrOptions: string | ConfirmDialogOptions,
  text?: string,
  onConfirm?: () => void | Promise<void>
) => {
  if (typeof titleOrOptions === 'object') {
    confirmDialog.value = {
      show: true,
      title: titleOrOptions.title,
      text: titleOrOptions.text,
      confirmText: titleOrOptions.confirmText || '确定',
      cancelText: titleOrOptions.cancelText || '取消',
      onConfirm: titleOrOptions.onConfirm,
      onCancel: titleOrOptions.onCancel,
    }
  } else {
    confirmDialog.value = {
      show: true,
      title: titleOrOptions,
      text: text || '',
      confirmText: '确定',
      cancelText: '取消',
      onConfirm: onConfirm || (() => {}),
      onCancel: undefined,
    }
  }
}

const handleConfirmOk = async () => {
  const onConfirm = confirmDialog.value.onConfirm
  confirmDialog.value.show = false
  if (onConfirm) {
    await onConfirm()
  }
}

const handleConfirmCancel = () => {
  const onCancel = confirmDialog.value.onCancel
  confirmDialog.value.show = false
  if (onCancel) {
    onCancel()
  }
}

const handleConfirmOverlayClick = () => {
  confirmDialog.value.show = false
}

// 脏检查辅助
const isCurrentViewDirty = (): { dirty: boolean; type: 'provider' | 'profile' } => {
  if (activeView.value === 'provider' && providerPanelRef.value?.isDirty()) {
    return { dirty: true, type: 'provider' }
  }
  if (activeView.value === 'profile' && profilePanelRef.value?.isDirty()) {
    return { dirty: true, type: 'profile' }
  }
  return { dirty: false, type: 'provider' }
}

const handleSafeNavigate = (navigateAction: () => void | Promise<void>) => {
  const { dirty, type } = isCurrentViewDirty()
  if (!dirty) {
    navigateAction()
    return
  }

  const typeName = type === 'provider' ? 'API 提供商' : 'API 配置'
  showCustomConfirm({
    title: "未保存修改",
    text: `当前 ${typeName} 有未保存的改动，是否在离开前保存？`,
    confirmText: "保存",
    cancelText: "放弃",
    onConfirm: async () => {
      let saved = false
      if (type === 'provider') {
        const data = providerPanelRef.value?.getCurrentData()
        if (data) {
          saved = await saveProvider(data, true)
        }
      } else {
        const data = profilePanelRef.value?.getCurrentData()
        if (data) {
          saved = await saveProfile(data, true)
        }
      }

      if (saved) {
        confirmDialog.value.show = false
        await navigateAction()
      }
    },
    onCancel: async () => {
      if (type === 'provider') {
        providerPanelRef.value?.resetDirty()
      } else {
        profilePanelRef.value?.resetDirty()
      }
      confirmDialog.value.show = false
      await navigateAction()
    },
  })
}

const handleCloseDialog = () => {
  handleSafeNavigate(() => {
    closeDialog()
  })
}

// 全局 Esc 快捷键关闭处理（支持层级关闭与未保存保护）
const handleGlobalKeydown = (e: KeyboardEvent) => {
  if (e.key === "Escape" && !e.repeat) {
    if (confirmDialog.value.show) {
      handleConfirmCancel()
      e.preventDefault()
      e.stopPropagation()
      return
    }
    if (showPresetPicker.value) {
      showPresetPicker.value = false
      e.preventDefault()
      e.stopPropagation()
      return
    }
    if (showDialog.value) {
      handleCloseDialog()
      e.preventDefault()
      e.stopPropagation()
    }
  }
}

watch(showDialog, (val) => {
  if (val) {
    window.addEventListener("keydown", handleGlobalKeydown, true)
  } else {
    window.removeEventListener("keydown", handleGlobalKeydown, true)
  }
})

onUnmounted(() => {
  window.removeEventListener("keydown", handleGlobalKeydown, true)
})

// 刷新全部数据
const refreshData = () => {
  providers.value = [...apiSwitchCore.getProviders()]
  profiles.value = [...apiSwitchCore.getProfiles()]
  registeredPlugins.value = [...apiSwitchCore.getRegisteredPlugins()]
}

// 选中与切换操作
const selectProvider = (id: string) => {
  handleSafeNavigate(() => {
    activeView.value = 'provider'
    selectedProviderId.value = id
    selectedProfileId.value = null
    activePluginId.value = null
    isNewProvider.value = false

    const prov = providers.value.find((p) => p.id === id)
    if (prov) {
      editingProvider.value = JSON.parse(JSON.stringify(prov))
    }
  })
}

const createNewProvider = () => {
  handleSafeNavigate(() => {
    // 「+」先弹出预置目录（与思源原生一致）；选择后再进入表单
    showPresetPicker.value = true
  })
}

const showPresetPicker = ref(false)

const createProviderFromPreset = (presetId: string) => {
  showPresetPicker.value = false
  const preset = PRESET_PROVIDER_LIST.find((p) => p.id === presetId)
  if (!preset) return

  handleSafeNavigate(() => {
    activeView.value = 'provider'
    selectedProviderId.value = null
    selectedProfileId.value = null
    activePluginId.value = null
    isNewProvider.value = true

    if (preset.category === 'custom') {
      // 自定义：进入空白表单
      editingProvider.value = {
        id: "",
        displayName: "新 API 提供商",
        enabled: true,
        protocol: "openai",
        baseUrl: "",
        apiKey: "",
        requestTimeout: 30,
        headers: {},
        models: [],
      }
    } else {
      // 预置模板：带名称/协议/地址/推荐模型池，容量优先取内置快照表
      const models: ApiProviderModel[] = preset.presetModels.map((name) => ({
        id: name,
        name,
        displayName: name,
        enabled: true,
        contextLength: lookupModelContextLength(name) || undefined,
      }))
      editingProvider.value = {
        id: "",
        displayName: preset.displayName,
        enabled: true,
        protocol: preset.protocol,
        baseUrl: preset.defaultBaseUrl,
        apiKey: "",
        requestTimeout: 30,
        headers: {},
        models,
      }
    }
  })
}

const selectProfile = (id: string) => {
  handleSafeNavigate(() => {
    activeView.value = 'profile'
    selectedProfileId.value = id
    selectedProviderId.value = null
    activePluginId.value = null
    isNewProfile.value = false

    const prof = profiles.value.find((p) => p.id === id)
    if (prof) {
      editingProfile.value = JSON.parse(JSON.stringify(prof))
    }
  })
}

const createNewProfile = () => {
  handleSafeNavigate(() => {
    activeView.value = 'profile'
    selectedProfileId.value = null
    selectedProviderId.value = null
    activePluginId.value = null
    isNewProfile.value = true

    editingProfile.value = {
      id: "",
      name: "",
      providerId: undefined,
      provider: "deepseek",
      baseUrl: "https://api.deepseek.com",
      apiKey: "",
      model: "deepseek-chat",
      models: ["deepseek-chat", "deepseek-reasoner"],
      requestTimeoutSeconds: 60,
      temperature: 0.7,
      maxTokens: 4096,
      memo: "",
      providerUrl: "https://platform.deepseek.com/api_keys",
    }
  })
}

const selectPlugin = (id: string) => {
  handleSafeNavigate(() => {
    activeView.value = 'plugin'
    activePluginId.value = id
    selectedProviderId.value = null
    selectedProfileId.value = null
  })
}

// 提供商保存与删除
const isLocalBaseUrl = (url: string) => /\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?\//i.test(url.trim()) || /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?\/?$/i.test(url.trim())

const saveProvider = async (providerData: ApiProvider, skipReselect = false): Promise<boolean> => {
  const isLocal = isLocalBaseUrl(providerData.baseUrl || "")
  if (!providerData.displayName.trim() || !providerData.baseUrl.trim()) {
    showMessage("请填写提供商名称与 Base URL", 5000, "error")
    return false
  }
  if (!providerData.apiKey.trim() && !isLocal) {
    showMessage("请填写 API Key（本地服务如 Ollama / LM Studio 可留空）", 5000, "error")
    return false
  }

  try {
    let targetId = providerData.id
    if (isNewProvider.value) {
      const newProv = await apiSwitchCore.addProvider(providerData)
      targetId = newProv.id
      selectedProviderId.value = targetId
      isNewProvider.value = false
    } else {
      await apiSwitchCore.updateProvider(providerData)
    }

    refreshData()
    showMessage("提供商配置已保存", 3000, "info")
    providerPanelRef.value?.resetDirty?.()

    if (!skipReselect && targetId) {
      selectProvider(targetId)
    }
    return true
  } catch (err: any) {
    showMessage(`保存提供商失败: ${err?.message || err}`, 5000, "error")
    return false
  }
}

const deleteProvider = (id: string) => {
  showCustomConfirm("删除提供商", "确定要删除此 API 提供商吗？关联此提供商的 Profile 将解除关联。", async () => {
    try {
      providerPanelRef.value?.resetDirty?.()
      await apiSwitchCore.deleteProvider(id)
      activeView.value = 'empty'
      selectedProviderId.value = null
      refreshData()
      editingProvider.value = null
    } catch (err) {
      logDebug("Exception in deleteProvider", err)
    }
  })
}

const quickDeleteProvider = (prov: ApiProvider) => {
  handleSafeNavigate(() => {
    selectProvider(prov.id)
    deleteProvider(prov.id)
  })
}

const cancelProviderEdit = () => {
  handleSafeNavigate(() => {
    activeView.value = 'empty'
    selectedProviderId.value = null
    editingProvider.value = null
  })
}

// Profile 保存与删除
const saveProfile = async (profileData: ApiProfile, skipReselect = false): Promise<boolean> => {
  if (!profileData.name || !profileData.name.trim()) {
    profileData.name = computeDefaultProfileName(
      profileData.providerId,
      profileData.provider,
      profileData.model,
      providers.value
    );
  }

  if (!profileData.name.trim() || !profileData.model.trim()) {
    showMessage("请填写配置名称与模型名称", 5000, "error")
    return false
  }

  const provKey = (profileData.provider || "").trim().toLowerCase()
  const defaultBaseUrl = PRESET_PROVIDERS[provKey]?.defaultBaseUrl || ""
  const effectiveBaseUrl = profileData.baseUrl?.trim() || defaultBaseUrl

  if (!profileData.providerId && (!effectiveBaseUrl || !profileData.apiKey?.trim())) {
    showMessage("独立配置必须填写 API 密钥与基础 URL", 5000, "error")
    return false
  }

  try {
    let autoRes: AutoProviderResult | null = null
    let targetId = profileData.id

    if (isNewProfile.value) {
      const newProf = await apiSwitchCore.addProfile(profileData)
      targetId = newProf.id
      selectedProfileId.value = targetId
      isNewProfile.value = false
      autoRes = (newProf as any)._autoProviderResult || null
    } else {
      autoRes = await apiSwitchCore.updateProfile(profileData)
    }

    refreshData()

    if (autoRes) {
      const provName = autoRes.provider.displayName
      if (autoRes.action === "created") {
        showMessage(`API 配置已保存，并已自动生成提供商「${provName}」`, 4000, "info")
      } else {
        showMessage(`API 配置已保存，并已关联至已有提供商「${provName}」`, 4000, "info")
      }
    } else {
      showMessage("API 配置已保存", 3000, "info")
    }

    profilePanelRef.value?.resetDirty?.()

    if (!skipReselect && targetId) {
      selectProfile(targetId)
    }
    return true
  } catch (err: any) {
    showMessage(`保存配置失败: ${err?.message || err}`, 5000, "error")
    return false
  }
}

const deleteProfile = (id: string) => {
  showCustomConfirm("删除配置", "确定要删除此 API 配置吗？绑定此配置的插件将被取消接管。", async () => {
    try {
      profilePanelRef.value?.resetDirty?.()
      await apiSwitchCore.deleteProfile(id)
      activeView.value = 'empty'
      selectedProfileId.value = null
      refreshData()
      editingProfile.value = null
    } catch (err) {
      logDebug("Exception in deleteProfile", err)
    }
  })
}

const quickDeleteProfile = (prof: ApiProfile) => {
  handleSafeNavigate(() => {
    selectProfile(prof.id)
    deleteProfile(prof.id)
  })
}

const cancelEdit = () => {
  handleSafeNavigate(() => {
    activeView.value = 'empty'
    selectedProfileId.value = null
    editingProfile.value = null
  })
}

// 快捷操作
const applyProfileToAll = (prof: ApiProfile) => {
  handleSafeNavigate(() => {
    showCustomConfirm("一键配置", `确定要将 API 配置「${prof.name}」应用到所有接管项目吗？这将会覆盖当前所有子插件和思源内置 AI 的绑定配置。`, async () => {
      try {
        await apiSwitchCore.applyProfileToAllPlugins(prof.id)
        refreshData()
        showMessage("已将配置应用至所有项目", 3000, "info")
      } catch (err) {
        logDebug("Exception in applyProfileToAll", err)
      }
    })
  })
}

const quickUnbindPlugin = (plug: RegisteredPluginInfo) => {
  handleSafeNavigate(() => {
    showCustomConfirm("解除接管", `确定要解除对插件「${plug.displayName}」的接管吗？它将恢复为独立配置。`, async () => {
      await apiSwitchCore.bindPlugin(plug.pluginId, "")
      refreshData()
      showMessage(`已解除对 ${plug.displayName} 的接管`, 3000, "info")
    })
  })
}

const onBindingChange = async (profileId: string, slotId?: string) => {
  if (!activePlugin.value) return
  await apiSwitchCore.bindPlugin(activePlugin.value.pluginId, profileId, slotId)
  refreshData()
  showMessage("接管配置已更新", 3000, "info")
}

const importLocalConfig = async (pluginId: string, slotId?: string) => {
  const res = await apiSwitchCore.importLocalConfigToProfile(pluginId, slotId)
  refreshData()
  if (res?.action === "reused") {
    showMessage(`检测到与已有配置「${res.profile.name}」一致，已自动绑定，避免生成重复配置`, 4000, "info")
  } else if (res?.action === "created") {
    showMessage(`已基于本地配置新建「${res.profile.name}」并完成接管`, 3000, "info")
  } else {
    showMessage("已完成接管更新", 3000, "info")
  }
}

// 导入导出与思源同步
const triggerImport = () => {
  handleSafeNavigate(() => {
    fileInputRef.value?.click()
  })
}

const handleFileImport = async (e: Event) => {
  const input = e.target as HTMLInputElement
  if (!input.files || input.files.length === 0) return
  const file = input.files[0]
  const reader = new FileReader()
  reader.onload = async (event) => {
    try {
      const content = event.target?.result as string
      const res = await apiSwitchCore.importSiyuanAiJson(content)
      refreshData()
      showMessage(`成功导入！提供商: ${res.providersCount} 个，配置: ${res.profilesCount} 个`, 4000, "info")
    } catch (err: any) {
      showMessage(`导入失败: ${err?.message || err}`, 5000, "error")
    } finally {
      input.value = ""
    }
  }
  reader.readAsText(file)
}

const exportProfiles = () => {
  handleSafeNavigate(() => {
    try {
      const jsonStr = apiSwitchCore.exportSiyuanAiJson()
      const blob = new Blob([jsonStr], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `siyuan-ai-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      showMessage("配置已成功导出为 ai.json 格式", 3000, "info")
    } catch (err: any) {
      showMessage(`导出失败: ${err?.message || err}`, 5000, "error")
    }
  })
}

const syncFromSiyuanAction = async () => {
  handleSafeNavigate(async () => {
    try {
      const res = await apiSwitchCore.syncFromSiyuan()
      refreshData()
      let detailMsg = ""
      if (res.reusedProfilesCount > 0 && res.createdProfilesCount > 0) {
        detailMsg = `（复用 ${res.reusedProfilesCount} 个已有配置，新增 ${res.createdProfilesCount} 个配置）`
      } else if (res.reusedProfilesCount > 0) {
        detailMsg = `（已复用 ${res.reusedProfilesCount} 个一致的已有配置，未产生重复配置）`
      } else if (res.createdProfilesCount > 0) {
        detailMsg = `（新增 ${res.createdProfilesCount} 个配置）`
      }
      showMessage(`已成功从思源同步！检测到 ${res.providersCount} 个提供商，已联动 ${res.profilesCount} 个场景配置${detailMsg}。`, 4000, "info")
    } catch (err: any) {
      showMessage(`读取同步失败: ${err?.message || err}`, 5000, "error")
    }
  })
}

// 思源笔记快捷导入检测
const hasSiyuanBuiltInAi = computed(() => {
  try {
    const ai = (window as any).siyuan?.config?.ai
    if (!ai) return false
    const extracted = extractSiyuanAiSettings(ai)
    return Boolean(extracted.editing?.model || extracted.agent?.model || (extracted.providers && extracted.providers.length > 0))
  } catch (e) {
    return false
  }
})

const siyuanBuiltInAiInfo = computed(() => {
  try {
    const ai = (window as any).siyuan?.config?.ai
    if (!ai) return ""
    const extracted = extractSiyuanAiSettings(ai)
    const count = extracted.providers.length
    const editingModel = extracted.editing?.model || "无"
    return `${count} 个提供商，编辑器模型: ${editingModel}`
  } catch (e) {
    return ""
  }
})

const importSiyuanBuiltInAi = async () => {
  await syncFromSiyuanAction()
}

const getProviderName = (provider: string) => {
  const preset = PRESET_PROVIDERS[provider]
  if (preset) return preset.displayName
  const dict: Record<string, string> = {
    custom: "自定义",
    systemone: "Jev 决策模型",
  }
  return dict[provider] || provider || "未知"
}

const getProfileDisplaySub = (prof: ApiProfile) => {
  let provName = ""
  if (prof.providerId) {
    const matched = providers.value.find((p) => p.id === prof.providerId)
    provName = matched?.displayName || getProviderName(matched?.protocol || "")
  }
  if (!provName) {
    provName = getProviderName(prof.provider)
  }
  if (prof.isDecisionModel && (!provName || provName === "未知" || provName === "自定义")) {
    provName = "决策模型"
  }
  return `${provName || "未知"} | ${prof.model || "未设模型"}`
}

onMounted(() => {
  apiSwitchCore.onStateChange = refreshData
  refreshData()

  window._sy_api_switch = window._sy_api_switch || {}
  window._sy_api_switch.openSetting = () => {
    openDialog()
  }
})
</script>

<style lang="scss">
@use "@/styles/dialog.scss";
</style>