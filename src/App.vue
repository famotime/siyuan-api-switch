<template>
  <div class="plugin-app-main" v-if="showDialog">
    <div class="dialog-overlay" @click.self="closeDialog">
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
            <!-- 业务同步操作组（凸显核心功能） -->
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
              <button 
                class="header-sync-btn header-sync-btn--write" 
                @click="applyAllToSiyuanAction" 
                data-tooltip="一键将全量配置写回思源笔记" 
                data-tooltip-position="bottom"
              >
                <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="17 8 12 3 7 8"></polyline>
                  <line x1="12" y1="3" x2="12" y2="15"></line>
                </svg>
                <span>写回思源</span>
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
              <button class="close-btn" @click="closeDialog" data-tooltip="关闭窗口" data-tooltip-position="bottom">
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
                      <div class="profile-item-name">{{ prof.name }}</div>
                      <div class="profile-item-sub">{{ getProviderName(prof.provider) }} | {{ prof.model }}</div>
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
            <div v-if="activeView === 'provider' && editingProvider" class="form-container">
              <div class="content-header">
                <h2>{{ isNewProvider ? '新建 API 提供商' : '编辑 API 提供商' }}</h2>
                <p class="subtitle" v-if="editingProvider.id">ID: {{ editingProvider.id }}</p>
              </div>
              <div class="form-scroll-wrapper">
                <div class="form-row">
                  <div class="form-group col-6">
                    <label>提供商名称 *</label>
                    <input type="text" class="b3-text-field" v-model="editingProvider.displayName" placeholder="如 DeepSeek 官方 / SiliconFlow" />
                  </div>
                  <div class="form-group col-6">
                    <label>协议类型 *</label>
                    <select class="b3-select" v-model="editingProvider.protocol">
                      <option value="openai">OpenAI (主流兼容协议)</option>
                      <option value="gemini">Google Gemini</option>
                      <option value="anthropic">Anthropic</option>
                      <option value="custom">Custom (自定义)</option>
                    </select>
                  </div>
                </div>

                <div class="form-group">
                  <label>API 基础地址 (Base URL) *</label>
                  <input type="text" class="b3-text-field" v-model="editingProvider.baseUrl" placeholder="https://api.example.com/v1" />
                </div>

                <div class="form-group">
                  <label>API 密钥 (API Key) *</label>
                  <div class="input-password-wrapper">
                    <input 
                      :type="showApiKey ? 'text' : 'password'" 
                      class="b3-text-field" 
                      v-model="editingProvider.apiKey" 
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
                    <input type="number" class="b3-text-field" v-model.number="editingProvider.requestTimeout" placeholder="默认 30" min="1" max="600" />
                  </div>
                  <div class="form-group col-6">
                    <label>状态</label>
                    <label class="form-checkbox-label" style="margin-top: 8px; display: flex; align-items: center; gap: 6px; cursor: pointer;">
                      <input type="checkbox" v-model="editingProvider.enabled" />
                      <span>启用此提供商</span>
                    </label>
                  </div>
                </div>

                <!-- 模型列表 -->
                <div class="form-group">
                  <label>模型列表 (Models)</label>
                  <div class="model-pool-container">
                    <div class="model-tags" v-if="editingProvider.models && editingProvider.models.length > 0">
                      <span 
                        v-for="(m, mIdx) in editingProvider.models" 
                        :key="m.id || m.name || mIdx" 
                        class="model-tag"
                      >
                        {{ m.displayName || m.name }}
                        <span class="remove-tag" @click.stop="removeModelFromProvider(mIdx)" title="删除模型">×</span>
                      </span>
                    </div>
                    <div class="model-tags-empty" v-else>
                      暂无模型，请在下方输入模型名添加。
                    </div>
                    <div class="add-model-input-group">
                      <input 
                        type="text" 
                        class="b3-text-field mini-input" 
                        v-model="newProviderModelInput" 
                        placeholder="输入新模型名称 (如 deepseek-chat)，按回车添加" 
                        @keyup.enter="addModelToEditingProvider"
                      />
                      <button class="b3-button b3-button--primary mini-btn" @click="addModelToEditingProvider" type="button">添加</button>
                    </div>
                  </div>
                </div>

                <!-- 自定义请求头 Headers -->
                <div class="form-group">
                  <label>自定义请求头 (Headers JSON，可选)</label>
                  <textarea 
                    class="b3-text-field textarea-field" 
                    v-model="providerHeadersText" 
                    placeholder='例如: { "HTTP-Referer": "https://siyuan-note.com", "X-Title": "MySiYuan" }'
                    style="height: 60px; font-family: monospace; font-size: 12px;"
                  ></textarea>
                </div>
              </div>

              <div class="form-actions">
                <button class="b3-button b3-button--error" v-if="!isNewProvider" @click.stop="deleteProvider(editingProvider.id)" type="button">删除</button>
                <div class="flex-spacer"></div>
                <button class="b3-button b3-button--cancel" @click="cancelProviderEdit">取消</button>
                <button class="b3-button b3-button--primary" @click="saveProvider">保存提供商</button>
              </div>
            </div>

            <!-- 场景二：编辑 Profile -->
            <div v-else-if="activeView === 'profile' && editingProfile" class="form-container">
              <div class="content-header">
                <h2>{{ isNewProfile ? '新建 API 配置' : '编辑 API 配置' }}</h2>
              </div>
              <div class="form-scroll-wrapper">
                <!-- 关联 API 提供商选择 -->
                <div class="form-group" style="background: rgba(63,81,181,0.06); padding: 10px 12px; border-radius: 6px; border: 1px dashed rgba(63,81,181,0.25); margin-bottom: 14px;">
                  <label style="font-weight: 600; color: var(--b3-theme-primary); margin-bottom: 4px; display: block;">🔗 关联已配置的 API 提供商 (从提供商继承)</label>
                  <select class="b3-select" v-model="editingProfile.providerId" @change="onProfileProviderSelect">
                    <option value="">-- 无 (独立自定义配置，不继承提供商) --</option>
                    <option v-for="prov in providers" :key="prov.id" :value="prov.id">
                      {{ prov.displayName }} ({{ prov.protocol || 'openai' }}) - {{ (prov.models && prov.models.length) || 0 }} 个可用模型
                    </option>
                  </select>
                  <div v-if="editingProfile.providerId" style="margin-top: 6px; font-size: 12px; opacity: 0.85; line-height: 1.5;">
                    💡 已继承提供商的基础连接信息 (Base URL、API Key 与自定义 Headers)。当提供商更新时，此 Profile 自动联动生效。
                  </div>
                </div>

                <div class="form-row">
                  <div class="form-group col-6">
                    <label>配置名称 *</label>
                    <input type="text" class="b3-text-field" v-model="editingProfile.name" placeholder="如 DeepSeek 默认" />
                  </div>
                  <div class="form-group col-6">
                    <div class="label-with-link">
                      <label>AI 服务商 *</label>
                      <a v-if="editingProfile.providerUrl" href="javascript:void(0)" @click.prevent="openProviderUrl(editingProfile.providerUrl)" class="provider-link-btn" data-tooltip="前往官网获取 API Key" data-tooltip-position="bottom">
                        <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" style="fill:none!important"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                      </a>
                    </div>
                    <input v-if="editingProfile.providerId" type="text" class="b3-text-field" :value="editingProfile.provider" disabled />
                    <select v-else class="b3-select" v-model="editingProfile.provider" @change="onProviderChange">
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
                  <input type="text" class="b3-text-field" v-model="editingProfile.baseUrl" :disabled="Boolean(editingProfile.providerId)" placeholder="https://api.example.com/v1" />
                </div>

                <div class="form-group">
                  <label>API 密钥 (API Key) *</label>
                  <div class="input-password-wrapper">
                    <input 
                      :type="showApiKey ? 'text' : 'password'" 
                      class="b3-text-field" 
                      v-model="editingProfile.apiKey" 
                      :disabled="Boolean(editingProfile.providerId)"
                      placeholder="sk-..." 
                    />
                    <button class="toggle-password-btn" @click="showApiKey = !showApiKey" type="button" :data-tooltip="showApiKey ? '隐藏密钥' : '显示密钥'" data-tooltip-position="left">
                      <svg v-if="showApiKey" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" style="fill:none!important"></path><circle cx="12" cy="12" r="3" style="fill:none!important"></circle></svg>
                      <svg v-else viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" style="fill:none!important"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                    </button>
                  </div>
                </div>

                <div class="form-row">
                  <div class="form-group col-8">
                    <label>当前启用模型 (Active Model) *</label>
                    <select class="b3-select" v-model="editingProfile.model">
                      <option v-for="m in currentProfileAvailableModels" :key="m" :value="m">{{ m }}</option>
                    </select>
                  </div>
                  <div class="form-group col-4" v-if="!editingProfile.providerId">
                    <label>添加推荐模型</label>
                    <select class="b3-select" @change="selectPresetModel($event)">
                      <option value="">-- 选择并添加 --</option>
                      <option v-for="m in presetModels[editingProfile.provider] || []" :key="m" :value="m">{{ m }}</option>
                    </select>
                  </div>
                </div>

                <div class="form-group" v-if="!editingProfile.providerId">
                  <label>候选模型池 (Model Pool)</label>
                  <div class="model-pool-container">
                    <div class="model-tags" v-if="editingProfile.models && editingProfile.models.length > 0">
                      <span 
                        v-for="m in editingProfile.models" 
                        :key="m" 
                        :class="['model-tag', { active: editingProfile.model === m }]"
                        @click="editingProfile.model = m"
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
                    <input type="checkbox" v-model="editingProfile.isDecisionModel" />
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
                      <input type="number" class="b3-text-field" v-model.number="editingProfile.requestTimeoutSeconds" placeholder="留空保持默认 (30s)" min="1" max="600" />
                    </div>
                    <div class="form-group col-4">
                      <label>采样温度 (Temperature)</label>
                      <input type="number" class="b3-text-field" v-model.number="editingProfile.temperature" placeholder="0~2.0, 留空保持默认" step="0.1" min="0" max="2" />
                    </div>
                    <div class="form-group col-4">
                      <label>单次 Max Tokens</label>
                      <input type="number" class="b3-text-field" v-model.number="editingProfile.maxTokens" placeholder="0或留空表示不限" min="0" />
                    </div>
                  </div>

                  <div class="form-row">
                    <div class="form-group col-4">
                      <label>编辑器最大上下文 (轮)</label>
                      <input type="number" class="b3-text-field" v-model.number="editingProfile.maxHistoryMessages" placeholder="1~64轮, 留空保持默认" min="1" max="64" />
                    </div>
                    <div class="form-group col-4">
                      <label>智能体最大工具调用 (轮)</label>
                      <input type="number" class="b3-text-field" v-model.number="editingProfile.maxToolCallRounds" placeholder="0或留空表示不限" min="0" />
                    </div>
                    <div class="form-group col-4">
                      <label>智能体会话超时 (秒)</label>
                      <input type="number" class="b3-text-field" v-model.number="editingProfile.sessionTimeout" placeholder="0或留空表示不限" min="0" max="3600" />
                    </div>
                  </div>

                  <div class="form-row">
                    <div class="form-group col-4">
                      <label>智能体流空闲超时 (秒)</label>
                      <input type="number" class="b3-text-field" v-model.number="editingProfile.streamIdleTimeout" placeholder="120s, 留空保持默认" min="1" max="600" />
                    </div>
                    <div class="form-group col-4">
                      <label>智能体确认超时 (秒)</label>
                      <input type="number" class="b3-text-field" v-model.number="editingProfile.confirmTimeout" placeholder="120s, 留空保持默认" min="1" max="600" />
                    </div>
                    <div class="form-group col-4">
                      <label>智能体最大重试次数</label>
                      <input type="number" class="b3-text-field" v-model.number="editingProfile.maxRetries" placeholder="0~10次, 留空保持默认" min="0" max="10" />
                    </div>
                  </div>

                  <div class="form-group">
                    <label>备注说明 (可选)</label>
                    <textarea class="b3-text-field textarea-field" v-model="editingProfile.memo" placeholder="添加此 API 账号的备注信息..."></textarea>
                  </div>
                </div>
              </div>

              <div class="form-actions">
                <button class="b3-button b3-button--error" v-if="!isNewProfile" @click.stop="deleteProfile(editingProfile.id)" type="button">删除</button>
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
                      ? '当前子插件的通用 AI API 配置由 API 旋钮接管。子插件原配置面板的相应字段已置灰只读。' 
                      : '当前子插件独立运行，使用其自身的配置面板所保存的 API 配置。' }}
                  </div>
                </div>

                <div v-if="!activePlugin.isBound && activePlugin.localConfig && (activePlugin.localConfig.baseUrl || activePlugin.localConfig.apiKey || activePlugin.localConfig.model)" class="local-config-import-card animate-fade-in" style="margin-bottom: 16px;">
                  <div class="import-card-title">
                    💡 检测到该插件已有本地配置与高级参数
                  </div>
                  <div class="import-card-desc" style="margin-top: 6px; line-height: 1.6;">
                    <div>基础参数：服务商 <strong>{{ getProviderName(activePlugin.localConfig.provider) }}</strong> | 模型 <strong>{{ activePlugin.localConfig.model || '未指定' }}</strong> | 地址 <code>{{ activePlugin.localConfig.baseUrl || '无' }}</code></div>
                    <div style="margin-top: 4px; font-size: 12px; opacity: 0.9;">
                      高级参数：超时 <strong>{{ activePlugin.localConfig.requestTimeoutSeconds ?? 30 }}s</strong> | 
                      温度 <strong>{{ activePlugin.localConfig.temperature ?? 0.7 }}</strong> | 
                      Max Tokens <strong>{{ activePlugin.localConfig.maxTokens ? activePlugin.localConfig.maxTokens : '不限(0)' }}</strong>
                      <span v-if="(activePlugin.localConfig as any).maxHistoryMessages !== undefined"> | 上下文 <strong>{{ (activePlugin.localConfig as any).maxHistoryMessages }} 轮</strong></span>
                      <span v-if="(activePlugin.localConfig as any).maxToolCallRounds !== undefined"> | 工具调用 <strong>{{ (activePlugin.localConfig as any).maxToolCallRounds }} 轮</strong></span>
                      <span v-if="(activePlugin.localConfig as any).sessionTimeout !== undefined"> | 会话超时 <strong>{{ (activePlugin.localConfig as any).sessionTimeout }}s</strong></span>
                      <span v-if="(activePlugin.localConfig as any).streamIdleTimeout !== undefined"> | 流空闲超时 <strong>{{ (activePlugin.localConfig as any).streamIdleTimeout }}s</strong></span>
                    </div>
                  </div>
                  <button class="b3-button b3-button--primary import-action-btn" style="margin-top: 10px; padding: 4px 10px; font-size: 11px; height: auto;" @click="importLocalConfig(activePlugin.pluginId)">
                    📥 一键导入为 Profile 并接管
                  </button>
                </div>

                <div class="form-group binding-select-group">
                  <label>绑定 API 配置文件 (Profile)</label>
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
                  <p class="warning-text">⚠️ 提示：绑定完成后，该子插件的 AI 请求将实时重定向至旋钮配置，无需手动重启插件。</p>
                </div>
              </div>
            </div>

            <!-- 场景三：空白状态 -->
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

    <!-- 自定义精美确认弹窗 (与 dialog-overlay 平级，移出 switch-dialog 以免被其 overflow: hidden 裁剪或事件冒泡阻挡) -->
    <div class="confirm-overlay" v-if="confirmDialog.show" @click.self="closeConfirm(false)">
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
</template>

<script setup lang="ts">
import { usePlugin } from '@/main'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { apiSwitchCore, ApiProfile, RegisteredPluginInfo, extractSiyuanAiSettings } from "@/services/api-switch-core"
import { ApiProvider, ApiProviderModel } from "@/types"
import { showMessage } from "siyuan"

// 弹窗尺寸与拖拽/缩放状态
const STORAGE_KEY_SIZE = "sy_api_switch_dialog_size"
const DEFAULT_WIDTH = 960
const DEFAULT_HEIGHT = 640
const MIN_WIDTH = 640
const MIN_HEIGHT = 420

const dialogWidth = ref(DEFAULT_WIDTH)
const dialogHeight = ref(DEFAULT_HEIGHT)
const dialogTranslateX = ref(0)
const dialogTranslateY = ref(0)
const isMaximized = ref(false)
const isDraggingWindow = ref(false)
const isResizingWindow = ref(false)
const prevWindowState = ref<{ width: number; height: number; x: number; y: number } | null>(null)

// 状态定义
const showDialog = ref(false)
const showApiKey = ref(false)
const showAdvanced = ref(false)
const activeView = ref<'empty' | 'profile' | 'provider' | 'plugin'>('empty')
const selectedProfileId = ref<string | null>(null)
const selectedProviderId = ref<string | null>(null)
const activePluginId = ref<string | null>(null)

const providers = ref<ApiProvider[]>([])
const profiles = ref<ApiProfile[]>([])
const registeredPlugins = ref<RegisteredPluginInfo[]>([])

const activePlugin = ref<RegisteredPluginInfo | null>(null)
const editingProfile = ref<ApiProfile | null>(null)
const editingProvider = ref<ApiProvider | null>(null)
const newModelInput = ref("")
const newProviderModelInput = ref("")
const providerHeadersText = ref("{}")
const isNewProfile = ref(false)
const isNewProvider = ref(false)

// 当前 Profile 可用的模型列表（若关联提供商，则来自提供商；否则来自自身 models）
const currentProfileAvailableModels = computed(() => {
  if (!editingProfile.value) return []
  if (editingProfile.value.providerId) {
    const prov = providers.value.find(p => p.id === editingProfile.value?.providerId)
    if (prov && prov.models && prov.models.length > 0) {
      return prov.models.map(m => m.displayName || m.name || m.id)
    }
  }
  return editingProfile.value.models && editingProfile.value.models.length > 0
    ? editingProfile.value.models
    : (editingProfile.value.model ? [editingProfile.value.model] : [])
})

// 日志调试开关及工具函数
const enableDebugLog = ref(localStorage.getItem("sy_api_switch_debug") === "true")

const saveLogSetting = () => {
  localStorage.setItem("sy_api_switch_debug", enableDebugLog.value ? "true" : "false")
}

const logDebug = (message: string, ...args: any[]) => {
  if (enableDebugLog.value) {
    if (message.toLowerCase().includes("error") || message.toLowerCase().includes("fail") || args.some(a => a instanceof Error)) {
      const errorObj = args.find(a => a instanceof Error)
      const errText = errorObj ? `${message}: ${errorObj.message}\n${errorObj.stack || ''}` : `${message} ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ')}`
      showMessage(`调试日志: ${errText.substring(0, 300)}`, 10000, "error")
    }
  }
}

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
    if (confirmDialog.value.onConfirm) {
      try {
        const res = confirmDialog.value.onConfirm()
        if (res instanceof Promise) {
          res.catch(err => logDebug("Async error in onConfirm", err))
        }
      } catch (err) {
        logDebug("Sync error in onConfirm", err)
      }
    }
  } else {
    if (confirmDialog.value.onCancel) {
      try {
        const res = confirmDialog.value.onCancel()
        if (res instanceof Promise) {
          res.catch(err => logDebug("Async error in onCancel", err))
        }
      } catch (err) {
        logDebug("Sync error in onCancel", err)
      }
    }
  }
}

// 脏检查保护拦截
const handleSafeNavigate = (navigateFn: () => void) => {
  if (isProfileDirty()) {
    showCustomConfirm("未保存的更改", "当前配置已被修改，是否放弃更改并离开？", () => {
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
    baseUrl: "https://generativetoolkit.googleapis.com",
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

const hasSiyuanBuiltInAi = ref(false)
const siyuanBuiltInAiInfo = ref("")

// 检测思源笔记内置的 AI 配置信息
const checkSiyuanBuiltInAi = () => {
  try {
    const ai = (window as any).siyuan?.config?.ai
    if (ai) {
      const extracted = extractSiyuanAiSettings(ai)
      if (extracted.editing || extracted.agent || extracted.decision) {
        hasSiyuanBuiltInAi.value = true
        const edModel = extracted.editing ? `${extracted.editing.provider} (${extracted.editing.model})` : "未配置"
        const agModel = extracted.agent ? `${extracted.agent.provider} (${extracted.agent.model})` : "未配置"
        const dcModel = extracted.decision ? `决策: ${extracted.decision.model}` : "决策未配"
        siyuanBuiltInAiInfo.value = `编辑器: ${edModel} | 智能体: ${agModel} | ${dcModel}`
        return
      }
    }
    hasSiyuanBuiltInAi.value = false
  } catch (err) {
    hasSiyuanBuiltInAi.value = false
  }
}

const fileInputRef = ref<HTMLInputElement | null>(null)

const triggerImport = () => {
  if (fileInputRef.value) {
    fileInputRef.value.value = ""
    fileInputRef.value.click()
  }
}

const handleFileImport = (e: Event) => {
  const target = e.target as HTMLInputElement
  if (!target.files || target.files.length === 0) return

  const file = target.files[0]
  const reader = new FileReader()
  reader.onload = async (event) => {
    try {
      const content = event.target?.result as string
      showCustomConfirm("导入 AI 配置", "确定要导入该 JSON 配置文件吗？将自动解析提供商与各场景配置。", async () => {
        try {
          const res = await apiSwitchCore.importSiyuanAiJson(content)
          refreshData()
          showMessage(`导入成功！解析了 ${res.providersCount} 个提供商与 ${res.profilesCount} 个场景配置。`, 4000, "info")
        } catch (err: any) {
          logDebug("导入解析失败", err)
          showMessage(`导入失败: ${err.message || err}`, 5000, "error")
        }
      })
    } catch (err: any) {
      logDebug("读取文件失败", err)
      showMessage(`读取失败: ${err.message || err}`, 5000, "error")
    }
  }
  reader.readAsText(file)
}

const exportProfiles = () => {
  try {
    const dataStr = apiSwitchCore.exportSiyuanAiJson()
    const blob = new Blob([dataStr], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `siyuan-ai-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
  } catch (err: any) {
    logDebug("导出配置文件失败", err)
    showMessage(`导出失败: ${err.message || err}`, 5000, "error")
  }
}

// 数据同步刷新
const refreshData = () => {
  providers.value = [...apiSwitchCore.getProviders()]
  profiles.value = [...apiSwitchCore.getProfiles()]
  registeredPlugins.value = [...apiSwitchCore.getRegisteredPlugins()]
  
  if (activePluginId.value) {
    activePlugin.value = registeredPlugins.value.find(p => p.pluginId === activePluginId.value) || null
  }
  if (selectedProviderId.value) {
    const prov = providers.value.find(p => p.id === selectedProviderId.value)
    if (prov) editingProvider.value = JSON.parse(JSON.stringify(prov))
  }
  if (selectedProfileId.value) {
    const prof = profiles.value.find(p => p.id === selectedProfileId.value)
    if (prof) editingProfile.value = JSON.parse(JSON.stringify(prof))
  }

  checkSiyuanBuiltInAi()
}

// 顶栏快捷操作：从思源同步
const syncFromSiyuanAction = async () => {
  showCustomConfirm("从思源同步配置", "确定要从思源笔记「设置-人工智能」中读取并同步所有的 API 提供商、编辑器、智能体与决策模型配置吗？", async () => {
    try {
      const res = await apiSwitchCore.syncFromSiyuan()
      refreshData()
      showMessage(`成功从思源同步！更新了 ${res.providersCount} 个提供商与 ${res.profilesCount} 个配置。`, 4000, "info")
    } catch (err: any) {
      logDebug("从思源同步失败", err)
      showMessage(`同步失败: ${err.message || err}`, 5000, "error")
    }
  })
}

// 顶栏快捷操作：全量写回思源
const applyAllToSiyuanAction = async () => {
  showCustomConfirm("全量写回思源笔记", "确定要将当前 API 旋钮中的所有提供商、编辑器、智能体、决策模型配置全量写回思源笔记系统设置吗？", async () => {
    try {
      await apiSwitchCore.applyAllToSiyuan()
      showMessage("全量配置已成功写回思源笔记系统设置！", 4000, "info")
    } catch (err: any) {
      logDebug("全量写回思源失败", err)
      showMessage(`写回思源失败: ${err.message || err}`, 5000, "error")
    }
  })
}

const importLocalConfig = async (pluginId: string) => {
  showCustomConfirm("导入本地配置", "确定要将此插件的本地配置（含高级参数）导入为全局 API Profile 并由 API 旋钮接管吗？", async () => {
    await apiSwitchCore.importLocalConfigToProfile(pluginId)
    refreshData()
  })
}

const importSiyuanBuiltInAi = async () => {
  showCustomConfirm(
    "导入思源内置 AI 配置",
    "将读取思源笔记「设置 -> AI」中的所有提供商、编辑器、智能体与决策模型并完整同步，确定继续吗？",
    async () => {
      await apiSwitchCore.syncFromSiyuan()
      refreshData()
    }
  )
}

// 加载本地持久化的弹窗尺寸
const loadSavedDialogSize = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SIZE)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (typeof parsed.width === 'number' && typeof parsed.height === 'number') {
        const maxW = Math.max(MIN_WIDTH, window.innerWidth - 32)
        const maxH = Math.max(MIN_HEIGHT, window.innerHeight - 32)
        dialogWidth.value = Math.min(Math.max(parsed.width, MIN_WIDTH), maxW)
        dialogHeight.value = Math.min(Math.max(parsed.height, MIN_HEIGHT), maxH)
        return
      }
    }
  } catch (err) {
    if (enableDebugLog.value) {
      console.warn('Failed to load dialog size:', err)
    }
  }
  dialogWidth.value = Math.min(DEFAULT_WIDTH, Math.max(MIN_WIDTH, window.innerWidth - 32))
  dialogHeight.value = Math.min(DEFAULT_HEIGHT, Math.max(MIN_HEIGHT, window.innerHeight - 32))
}

// 保存弹窗尺寸至本地
const saveDialogSize = () => {
  if (isMaximized.value) return
  try {
    localStorage.setItem(STORAGE_KEY_SIZE, JSON.stringify({
      width: Math.round(dialogWidth.value),
      height: Math.round(dialogHeight.value),
    }))
  } catch (err) {
    // ignore
  }
}

// 打开弹窗
const openDialog = () => {
  loadSavedDialogSize()
  dialogTranslateX.value = 0
  dialogTranslateY.value = 0
  isMaximized.value = false
  showDialog.value = true
}

// 8 方向拖拽缩放
const onResizeStart = (e: MouseEvent, direction: string) => {
  if (isMaximized.value) {
    isMaximized.value = false
  }

  isResizingWindow.value = true
  const startX = e.clientX
  const startY = e.clientY
  const startW = dialogWidth.value
  const startH = dialogHeight.value
  const startTx = dialogTranslateX.value
  const startTy = dialogTranslateY.value

  const minW = MIN_WIDTH
  const minH = MIN_HEIGHT
  const maxW = Math.max(minW, window.innerWidth - 32)
  const maxH = Math.max(minH, window.innerHeight - 32)

  const originalUserSelect = document.body.style.userSelect
  document.body.style.userSelect = 'none'

  const onMouseMove = (moveEvent: MouseEvent) => {
    const dx = moveEvent.clientX - startX
    const dy = moveEvent.clientY - startY

    if (direction.includes('e')) {
      const targetW = startW + dx
      const newW = Math.min(maxW, Math.max(minW, targetW))
      const deltaW = newW - startW
      dialogWidth.value = newW
      dialogTranslateX.value = startTx + deltaW / 2
    } else if (direction.includes('w')) {
      const targetW = startW - dx
      const newW = Math.min(maxW, Math.max(minW, targetW))
      const deltaW = newW - startW
      dialogWidth.value = newW
      dialogTranslateX.value = startTx - deltaW / 2
    }

    if (direction.includes('s')) {
      const targetH = startH + dy
      const newH = Math.min(maxH, Math.max(minH, targetH))
      const deltaH = newH - startH
      dialogHeight.value = newH
      dialogTranslateY.value = startTy + deltaH / 2
    } else if (direction.includes('n')) {
      const targetH = startH - dy
      const newH = Math.min(maxH, Math.max(minH, targetH))
      const deltaH = newH - startH
      dialogHeight.value = newH
      dialogTranslateY.value = startTy - deltaH / 2
    }
  }

  const onMouseUp = () => {
    isResizingWindow.value = false
    document.body.style.userSelect = originalUserSelect
    window.removeEventListener('mousemove', onMouseMove)
    window.removeEventListener('mouseup', onMouseUp)
    saveDialogSize()
  }

  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)
}

// 顶栏按住拖拽移动弹窗
const onHeaderMouseDown = (e: MouseEvent) => {
  const target = e.target as HTMLElement | null
  if (target && target.closest('button, input, select, textarea, a, .header-actions')) {
    return
  }

  if (isMaximized.value) {
    return
  }

  isDraggingWindow.value = true
  const startX = e.clientX
  const startY = e.clientY
  const startTx = dialogTranslateX.value
  const startTy = dialogTranslateY.value

  const originalUserSelect = document.body.style.userSelect
  document.body.style.userSelect = 'none'

  const maxTx = Math.max(0, (window.innerWidth - dialogWidth.value) / 2)
  const maxTy = Math.max(0, (window.innerHeight - dialogHeight.value) / 2)

  const onMouseMove = (moveEvent: MouseEvent) => {
    const dx = moveEvent.clientX - startX
    const dy = moveEvent.clientY - startY

    const newTx = startTx + dx
    const newTy = startTy + dy

    dialogTranslateX.value = Math.min(maxTx, Math.max(-maxTx, newTx))
    dialogTranslateY.value = Math.min(maxTy, Math.max(-maxTy, newTy))
  }

  const onMouseUp = () => {
    isDraggingWindow.value = false
    document.body.style.userSelect = originalUserSelect
    window.removeEventListener('mousemove', onMouseMove)
    window.removeEventListener('mouseup', onMouseUp)
  }

  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)
}

// 最大化 / 还原切换
const toggleMaximize = () => {
  if (!isMaximized.value) {
    prevWindowState.value = {
      width: dialogWidth.value,
      height: dialogHeight.value,
      x: dialogTranslateX.value,
      y: dialogTranslateY.value,
    }
    dialogWidth.value = Math.max(MIN_WIDTH, window.innerWidth - 32)
    dialogHeight.value = Math.max(MIN_HEIGHT, window.innerHeight - 32)
    dialogTranslateX.value = 0
    dialogTranslateY.value = 0
    isMaximized.value = true
  } else {
    if (prevWindowState.value) {
      dialogWidth.value = prevWindowState.value.width
      dialogHeight.value = prevWindowState.value.height
      dialogTranslateX.value = prevWindowState.value.x
      dialogTranslateY.value = prevWindowState.value.y
    } else {
      loadSavedDialogSize()
      dialogTranslateX.value = 0
      dialogTranslateY.value = 0
    }
    isMaximized.value = false
  }
}

// 窗口尺寸自适应监听
const handleWindowResize = () => {
  if (isMaximized.value) {
    dialogWidth.value = Math.max(MIN_WIDTH, window.innerWidth - 32)
    dialogHeight.value = Math.max(MIN_HEIGHT, window.innerHeight - 32)
    dialogTranslateX.value = 0
    dialogTranslateY.value = 0
  } else {
    const maxW = Math.max(MIN_WIDTH, window.innerWidth - 32)
    const maxH = Math.max(MIN_HEIGHT, window.innerHeight - 32)
    if (dialogWidth.value > maxW) dialogWidth.value = maxW
    if (dialogHeight.value > maxH) dialogHeight.value = maxH
    const maxTx = Math.max(0, (window.innerWidth - dialogWidth.value) / 2)
    const maxTy = Math.max(0, (window.innerHeight - dialogHeight.value) / 2)
    dialogTranslateX.value = Math.min(maxTx, Math.max(-maxTx, dialogTranslateX.value))
    dialogTranslateY.value = Math.min(maxTy, Math.max(-maxTy, dialogTranslateY.value))
  }
}

onMounted(() => {
  loadSavedDialogSize()
  window.addEventListener('resize', handleWindowResize)
  apiSwitchCore.onStateChange = refreshData
  refreshData()
  
  window._sy_api_switch = window._sy_api_switch || {}
  window._sy_api_switch.openSetting = () => {
    openDialog()
  }
})

onUnmounted(() => {
  window.removeEventListener('resize', handleWindowResize)
})

// 顶栏图标初始化
const plugin = usePlugin()
plugin.addTopBar({
  icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 13h5m3 3V8h3a2 2 0 0 1 2 2v1a2 2 0 0 1-2 2h-3m8-5v8M9 16v-5.5a2.5 2.5 0 0 0-5 0V16" style="fill:none!important"></path></svg>`,
  title: 'API 旋钮',
  callback: () => {
    openDialog()
  },
})

// 交互操作
const closeDialog = () => {
  handleSafeNavigate(() => {
    showDialog.value = false
  })
}

// ===================== 提供商交互 =====================

const createNewProvider = () => {
  handleSafeNavigate(() => {
    selectedProfileId.value = null
    activePluginId.value = null
    selectedProviderId.value = null
    isNewProvider.value = true
    activeView.value = 'provider'
    showApiKey.value = false
    newProviderModelInput.value = ""
    providerHeadersText.value = "{}"
    editingProvider.value = {
      id: "",
      displayName: "新 API 提供商",
      enabled: true,
      baseUrl: "",
      apiKey: "",
      protocol: "openai",
      requestTimeout: 30,
      headers: {},
      models: [
        { id: "gpt-4o", name: "gpt-4o", displayName: "gpt-4o", enabled: true }
      ]
    }
  })
}

const selectProvider = (id: string) => {
  handleSafeNavigate(() => {
    selectedProfileId.value = null
    activePluginId.value = null
    selectedProviderId.value = id
    isNewProvider.value = false
    activeView.value = 'provider'
    showApiKey.value = false
    newProviderModelInput.value = ""

    const prov = providers.value.find(p => p.id === id)
    if (prov) {
      editingProvider.value = JSON.parse(JSON.stringify(prov))
      providerHeadersText.value = prov.headers ? JSON.stringify(prov.headers, null, 2) : "{}"
    }
  })
}

const addModelToEditingProvider = () => {
  const name = newProviderModelInput.value.trim()
  if (!name || !editingProvider.value) return
  if (!editingProvider.value.models) editingProvider.value.models = []
  if (!editingProvider.value.models.some(m => m.name === name || m.id === name)) {
    editingProvider.value.models.push({
      id: name,
      name: name,
      displayName: name,
      enabled: true
    })
  }
  newProviderModelInput.value = ""
}

const removeModelFromProvider = (idx: number) => {
  if (!editingProvider.value || !editingProvider.value.models) return
  editingProvider.value.models.splice(idx, 1)
}

const cancelProviderEdit = () => {
  activeView.value = 'empty'
  selectedProviderId.value = null
  editingProvider.value = null
}

const saveProvider = async () => {
  if (!editingProvider.value) return
  const ep = editingProvider.value
  if (!ep.displayName.trim() || !ep.baseUrl.trim()) {
    showMessage("请填写提供商名称与 API 基础地址", 5000, "error")
    return
  }

  try {
    if (providerHeadersText.value.trim()) {
      ep.headers = JSON.parse(providerHeadersText.value)
    } else {
      ep.headers = {}
    }
  } catch (e: any) {
    showMessage("自定义 Headers JSON 格式不合法: " + e.message, 5000, "error")
    return
  }

  if (isNewProvider.value) {
    const created = await apiSwitchCore.addProvider(ep)
    selectedProviderId.value = created.id
    isNewProvider.value = false
  } else {
    await apiSwitchCore.updateProvider(ep)
  }

  refreshData()
  showMessage("API 提供商保存成功", 3000, "info")
}

const deleteProvider = (id: string) => {
  showCustomConfirm("删除提供商", "确定要删除该提供商吗？关联该提供商的配置将转为独立配置。", async () => {
    await apiSwitchCore.deleteProvider(id)
    activeView.value = 'empty'
    selectedProviderId.value = null
    editingProvider.value = null
    refreshData()
  })
}

const quickDeleteProvider = (prov: ApiProvider) => {
  selectProvider(prov.id)
  showCustomConfirm("删除提供商", `确定要删除提供商「${prov.displayName}」吗？关联该提供商的配置将转为独立配置。`, async () => {
    await apiSwitchCore.deleteProvider(prov.id)
    if (editingProvider.value && editingProvider.value.id === prov.id) {
      activeView.value = 'empty'
      selectedProviderId.value = null
      editingProvider.value = null
    }
    refreshData()
  })
}

// ===================== Profile 交互 =====================

const selectProfile = (id: string) => {
  const doSelect = () => {
    activePluginId.value = null
    selectedProviderId.value = null
    selectedProfileId.value = id
    isNewProfile.value = false
    activeView.value = 'profile'
    showApiKey.value = false
    showAdvanced.value = false
    newModelInput.value = ""

    const profile = profiles.value.find(p => p.id === id)
    if (profile) {
      editingProfile.value = { ...profile }
      if (!editingProfile.value.models || !Array.isArray(editingProfile.value.models)) {
        editingProfile.value.models = editingProfile.value.model ? [editingProfile.value.model] : []
      }
      recordProfileSnapshot(editingProfile.value)
    }
  }
  handleSafeNavigate(doSelect)
}

const selectPlugin = (pluginId: string) => {
  const doSelect = () => {
    selectedProfileId.value = null
    selectedProviderId.value = null
    activePluginId.value = pluginId
    activeView.value = 'plugin'
    activePlugin.value = registeredPlugins.value.find(p => p.pluginId === pluginId) || null
  }
  handleSafeNavigate(doSelect)
}

const createNewProfile = () => {
  const doCreate = () => {
    activePluginId.value = null
    selectedProviderId.value = null
    selectedProfileId.value = null
    isNewProfile.value = true
    activeView.value = 'profile'
    showApiKey.value = false
    showAdvanced.value = false
    newModelInput.value = ""

    const defaultProvider = "deepseek"
    const defaults = providerDefaults[defaultProvider]
    const defaultModels = presetModels[defaultProvider] ? [...presetModels[defaultProvider]] : [defaults.model]

    editingProfile.value = {
      id: "",
      name: "新配置",
      providerId: undefined,
      provider: defaultProvider,
      baseUrl: defaults.baseUrl,
      apiKey: "",
      model: defaults.model,
      models: defaultModels,
      requestTimeoutSeconds: 60,
      temperature: 0.7,
      maxTokens: 4096,
      memo: "",
      providerUrl: defaults.providerUrl
    }
    recordProfileSnapshot(editingProfile.value)
  }
  handleSafeNavigate(doCreate)
}

// 关联提供商切换
const onProfileProviderSelect = () => {
  if (!editingProfile.value) return
  const provId = editingProfile.value.providerId
  if (provId) {
    const prov = providers.value.find(p => p.id === provId)
    if (prov) {
      editingProfile.value.provider = prov.protocol || "custom"
      editingProfile.value.baseUrl = prov.baseUrl
      editingProfile.value.apiKey = prov.apiKey
      if (prov.models && prov.models.length > 0) {
        editingProfile.value.models = prov.models.map(m => m.displayName || m.name || m.id)
        if (!editingProfile.value.models.includes(editingProfile.value.model)) {
          editingProfile.value.model = editingProfile.value.models[0] || ""
        }
      }
    }
  }
}

const onProviderChange = () => {
  if (!editingProfile.value) return
  const prov = editingProfile.value.provider
  const defaults = providerDefaults[prov]
  if (defaults) {
    if (!editingProfile.value.baseUrl) editingProfile.value.baseUrl = defaults.baseUrl
    if (!editingProfile.value.model) editingProfile.value.model = defaults.model
    if (!editingProfile.value.providerUrl) editingProfile.value.providerUrl = defaults.providerUrl
    
    const defaultModels = presetModels[prov] ? [...presetModels[prov]] : [defaults.model]
    editingProfile.value.models = defaultModels
    
    if (!defaultModels.includes(editingProfile.value.model)) {
      editingProfile.value.model = defaultModels[0] || defaults.model
    }
  }
}

const selectPresetModel = (e: Event) => {
  const selectEl = e.target as HTMLSelectElement
  const val = selectEl.value
  if (val && editingProfile.value) {
    if (!editingProfile.value.models) {
      editingProfile.value.models = []
    }
    if (!editingProfile.value.models.includes(val)) {
      editingProfile.value.models.push(val)
    }
    editingProfile.value.model = val
  }
  selectEl.value = ""
}

const addCustomModel = () => {
  const modelName = newModelInput.value.trim()
  if (!modelName) return
  if (!editingProfile.value) return
  if (!editingProfile.value.models) {
    editingProfile.value.models = []
  }
  if (!editingProfile.value.models.includes(modelName)) {
    editingProfile.value.models.push(modelName)
  }
  editingProfile.value.model = modelName
  newModelInput.value = ""
}

const removeModel = (modelName: string) => {
  if (!editingProfile.value || !editingProfile.value.models) return
  editingProfile.value.models = editingProfile.value.models.filter(m => m !== modelName)
  if (editingProfile.value.model === modelName) {
    editingProfile.value.model = editingProfile.value.models[0] || ""
  }
}

const cancelEdit = () => {
  handleSafeNavigate(() => {
    activeView.value = 'empty'
    selectedProfileId.value = null
    setTimeout(() => {
      editingProfile.value = null
    }, 0)
  })
}

const saveProfile = async () => {
  if (!editingProfile.value) return
  const ep = editingProfile.value
  if (!ep.name.trim() || !ep.model.trim()) {
    showMessage("请填写配置名称与模型名称", 5000, "error")
    return
  }
  if (!ep.providerId && (!ep.baseUrl.trim() || !ep.apiKey.trim())) {
    showMessage("独立配置必须填写 API 基础 URL 与 API 密钥", 5000, "error")
    return
  }

  if (isNewProfile.value) {
    const newProf = await apiSwitchCore.addProfile(ep)
    selectedProfileId.value = newProf.id
    isNewProfile.value = false
  } else {
    await apiSwitchCore.updateProfile(ep)
  }
  
  refreshData()
  
  const savedProfile = profiles.value.find(p => p.id === selectedProfileId.value)
  if (savedProfile) {
    editingProfile.value = { ...savedProfile }
    recordProfileSnapshot(editingProfile.value)
  } else {
    recordProfileSnapshot(ep)
  }
  
  selectProfile(selectedProfileId.value!)
}

const deleteProfile = async (id: string) => {
  showCustomConfirm("删除配置", "确定要删除此 API 配置吗？绑定此配置的插件将被取消接管。", async () => {
    try {
      originalProfileState.value = ""
      await apiSwitchCore.deleteProfile(id)
      activeView.value = 'empty'
      selectedProfileId.value = null
      refreshData()
      setTimeout(() => {
        editingProfile.value = null
      }, 0)
    } catch (err) {
      logDebug("Exception in deleteProfile", err)
    }
  })
}

const quickDeleteProfile = (prof: ApiProfile) => {
  selectProfile(prof.id)
  showCustomConfirm("删除配置", `确定要删除 API 配置「${prof.name}」吗？绑定此配置的插件将被取消接管。`, async () => {
    try {
      if (editingProfile.value && editingProfile.value.id === prof.id) {
        originalProfileState.value = ""
        activeView.value = 'empty'
        selectedProfileId.value = null
        setTimeout(() => {
          editingProfile.value = null
        }, 0)
      }
      await apiSwitchCore.deleteProfile(prof.id)
      refreshData()
    } catch (err) {
      logDebug("Exception in quickDeleteProfile", err)
    }
  })
}

const applyProfileToAll = (prof: ApiProfile) => {
  showCustomConfirm("一键配置", `确定要将 API 配置「${prof.name}」应用到所有接管项目吗？这将会覆盖当前所有子插件和思源内置 AI 的绑定配置。`, async () => {
    try {
      await apiSwitchCore.applyProfileToAllPlugins(prof.id)
      refreshData()
    } catch (err) {
      logDebug("Exception in applyProfileToAll", err)
    }
  })
}

const quickUnbindPlugin = (plug: RegisteredPluginInfo) => {
  showCustomConfirm("解除接管", `确定要解除对插件「${plug.displayName}」的接管吗？它将恢复为独立配置。`, async () => {
    await apiSwitchCore.bindPlugin(plug.pluginId, "")
    refreshData()
  })
}

const onBindingChange = async (e: Event) => {
  if (!activePlugin.value) return
  const val = (e.target as HTMLSelectElement).value
  await apiSwitchCore.bindPlugin(activePlugin.value.pluginId, val)
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

  // 严格重置所有线框图标，防止思源笔记或第三方主题强制将 SVG 元素设置 fill 填充
  svg {
    fill: none !important;

    path,
    rect,
    circle,
    polygon,
    polyline,
    line {
      fill: none !important;
    }
  }
}

.dialog-overlay {
  width: 100%;
  height: 100%;
  background-color: var(--b3-mask-background, rgba(0, 0, 0, 0.45));
  backdrop-filter: blur(4px);
  display: flex;
  justify-content: center;
  align-items: center;
}

.switch-dialog {
  width: 960px;
  height: 640px;
  min-width: 640px;
  min-height: 420px;
  max-width: calc(100vw - 32px);
  max-height: calc(100vh - 32px);
  position: relative;
  box-sizing: border-box;
  background-color: var(--b3-theme-background);
  color: var(--b3-theme-on-background);
  border-radius: 4px;
  border: 1px solid var(--b3-border-color);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.25);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  user-select: none;
  animation: dialogFadeIn 0.18s cubic-bezier(0.16, 1, 0.3, 1) forwards;

  &.is-dragging, &.is-resizing {
    transition: none !important;
  }
}

@keyframes dialogFadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.dialog-header {
  height: 48px;
  padding: 0 16px;
  border-bottom: 1px solid var(--b3-border-color);
  display: flex;
  align-items: center;
  justify-content: space-between;
  background-color: var(--b3-theme-surface);
  cursor: grab;
  user-select: none;

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

  .header-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: default;
  }

  .header-sync-group {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .header-sync-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 28px;
    padding: 0 11px;
    font-size: 12px;
    font-weight: 600;
    line-height: 1;
    border-radius: 6px;
    cursor: pointer;
    user-select: none;
    white-space: nowrap;
    box-sizing: border-box;
    transition: all 0.18s cubic-bezier(0.4, 0, 0.2, 1);

    svg {
      width: 14px;
      height: 14px;
      flex-shrink: 0;
      transition: transform 0.18s ease;
    }

    &:active {
      transform: scale(0.97);
    }

    /* 读取思源配置：清晰高对比度描边按钮（无低对比度浅蓝底色） */
    &--read {
      background-color: transparent;
      border: 1.5px solid var(--b3-theme-primary);
      color: var(--b3-theme-primary);

      &:hover {
        background-color: var(--b3-theme-primary);
        color: var(--b3-theme-on-primary, #ffffff);
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.12);

        svg {
          transform: translateY(1px);
        }
      }
    }

    /* 写回思源：主色实心高亮按钮（保持高对比度白字） */
    &--write {
      background-color: var(--b3-theme-primary);
      border: 1.5px solid var(--b3-theme-primary);
      color: var(--b3-theme-on-primary, #ffffff);
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);

      &:hover {
        filter: brightness(1.1);
        box-shadow: 0 3px 8px rgba(0, 0, 0, 0.2);

        svg {
          transform: translateY(-1px);
        }
      }
    }
  }

  .header-divider {
    width: 1px;
    height: 18px;
    background-color: var(--b3-border-color);
    margin: 0 2px;
    opacity: 0.8;
  }

  .header-window-group {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .header-btn, .close-btn {
    background: none;
    border: none;
    cursor: pointer;
    padding: 6px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--b3-theme-on-surface);
    transition: background-color 0.15s ease, color 0.15s ease;

    svg {
      width: 16px;
      height: 16px;
    }

    &:hover {
      background-color: var(--b3-theme-background-hover);
      color: var(--b3-theme-primary);
    }
  }

  .close-btn:hover {
    color: #e54d2e;
    background-color: var(--b3-theme-error-light, rgba(229, 77, 46, 0.12));
  }
}

.switch-dialog.is-dragging .dialog-header {
  cursor: grabbing;
}

/* 拖拽缩放手柄 */
.resize-handle {
  position: absolute;
  z-index: 50;
  touch-action: none;

  &-n {
    top: 0;
    left: 8px;
    right: 8px;
    height: 6px;
    cursor: ns-resize;
  }
  &-s {
    bottom: 0;
    left: 8px;
    right: 8px;
    height: 6px;
    cursor: ns-resize;
  }
  &-w {
    top: 8px;
    bottom: 8px;
    left: 0;
    width: 6px;
    cursor: ew-resize;
  }
  &-e {
    top: 8px;
    bottom: 8px;
    right: 0;
    width: 6px;
    cursor: ew-resize;
  }
  &-nw {
    top: 0;
    left: 0;
    width: 12px;
    height: 12px;
    cursor: nwse-resize;
  }
  &-ne {
    top: 0;
    right: 0;
    width: 12px;
    height: 12px;
    cursor: nesw-resize;
  }
  &-sw {
    bottom: 0;
    left: 0;
    width: 12px;
    height: 12px;
    cursor: nesw-resize;
  }
  &-se {
    bottom: 0;
    right: 0;
    width: 18px;
    height: 18px;
    cursor: nwse-resize;
    display: flex;
    align-items: flex-end;
    justify-content: flex-end;
    padding: 3px;
    box-sizing: border-box;

    .resize-grip-icon {
      color: var(--b3-theme-on-surface);
      opacity: 0.35;
      transition: opacity 0.15s ease, color 0.15s ease;
      pointer-events: none;
      user-select: none;
    }

    &:hover .resize-grip-icon {
      opacity: 0.85;
      color: var(--b3-theme-primary);
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
  overflow: hidden;
}

.sidebar-scroll-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px 0;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.sidebar-footer {
  padding: 12px 16px;
  border-top: 1px solid var(--b3-border-color);
  background-color: var(--b3-theme-surface);
  display: flex;
  align-items: center;
}

.log-switch-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: var(--b3-theme-on-surface-mute, #888);
  cursor: pointer;
  user-select: none;
  
  input[type="checkbox"] {
    cursor: pointer;
    margin: 0;
  }
  
  &:hover {
    color: var(--b3-theme-primary);
  }
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

    .title-action-btn {
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

  .profile-quick-delete, .profile-quick-apply, .plugin-quick-unbind {
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
    margin-left: 4px;

    &:hover {
      background-color: var(--b3-theme-background-hover);
    }
  }

  .profile-quick-delete:hover {
    color: var(--b3-theme-error, #f44336);
  }

  .profile-quick-apply:hover {
    color: var(--b3-theme-primary, #4caf50);
  }

  .plugin-quick-unbind:hover {
    color: var(--b3-theme-error, #f44336);
  }

  &:hover {
    background-color: var(--b3-theme-background-hover);
    
    .profile-quick-delete, .profile-quick-apply, .plugin-quick-unbind {
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
      background-color: var(--b3-theme-success-light, rgba(76, 175, 80, 0.12));
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
  border-radius: 4px;
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
  border-radius: 4px;
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
  border-radius: 4px;
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
    transform-origin: center bottom;
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

  /* 下方定位 */
  &[data-tooltip-position="bottom"]::after {
    bottom: auto;
    top: 125%;
    left: 50%;
    transform: translateX(-50%) scale(0.8);
    transform-origin: center top;
  }
  &[data-tooltip-position="bottom"]:hover::after {
    transform: translateX(-50%) scale(1);
  }

  /* 左侧定位 */
  &[data-tooltip-position="left"]::after {
    bottom: auto;
    left: auto;
    top: 50%;
    right: 125%;
    transform: translateY(-50%) scale(0.8);
    transform-origin: right center;
  }
  &[data-tooltip-position="left"]:hover::after {
    transform: translateY(-50%) scale(1);
  }

  /* 右侧定位 */
  &[data-tooltip-position="right"]::after {
    bottom: auto;
    left: 125%;
    top: 50%;
    transform: translateY(-50%) scale(0.8);
    transform-origin: left center;
  }
  &[data-tooltip-position="right"]:hover::after {
    transform: translateY(-50%) scale(1);
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
  background-color: var(--b3-mask-background, rgba(0, 0, 0, 0.45));
  backdrop-filter: blur(2px);
    z-index: 2100;
  display: flex;
  justify-content: center;
  align-items: center;
}

.confirm-dialog {
  width: 360px;
  background-color: var(--b3-theme-background);
  color: var(--b3-theme-on-background);
  border-radius: 4px;
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

/* 导入思源内置AI相关的样式 */
.title-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}



.siyuan-import-card {
  margin-top: 24px;
  padding: 16px;
  background-color: var(--b3-theme-surface);
  border: 1px dashed var(--b3-border-color);
  border-radius: 4px;
  max-width: 400px;
  display: flex;
  gap: 16px;
  align-items: flex-start;
  text-align: left;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);

  .card-icon {
    padding: 8px;
    background-color: rgba(63, 81, 181, 0.1);
    color: var(--b3-theme-primary);
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .card-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .card-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--b3-theme-on-background);
  }

  .card-desc {
    font-size: 11px;
    color: var(--b3-theme-on-surface-mute, #888);
    line-height: 1.5;
  }

  .import-action-btn {
    margin-top: 10px;
    align-self: flex-start;
    padding: 6px 14px;
    font-size: 12px;
  }
}

.model-pool-container {
  border: 1px dashed var(--b3-border-color);
  padding: 12px;
  border-radius: 4px;
  background-color: var(--b3-theme-background-hover);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.model-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  min-height: 28px;
  align-items: center;
}

.model-tags-empty {
  font-size: 11px;
  color: var(--b3-theme-on-surface-mute, #888);
  padding: 6px 0;
}

.model-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 11px;
  background-color: var(--b3-theme-surface);
  border: 1px solid var(--b3-border-color);
  color: var(--b3-theme-on-surface);
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;
  font-family: monospace;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
    border-color: var(--b3-theme-primary);
  }

  &.active {
    background-color: var(--b3-theme-primary-light, rgba(74, 144, 226, 0.15));
    border-color: var(--b3-theme-primary);
    color: var(--b3-theme-primary);
    font-weight: 600;
    box-shadow: 0 0 0 1px var(--b3-theme-primary);
  }

  .remove-tag {
    font-size: 12px;
    font-weight: bold;
    color: var(--b3-theme-on-surface-mute, #888);
    cursor: pointer;
    width: 14px;
    height: 14px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    transition: background-color 0.2s, color 0.2s;

    &:hover {
      background-color: var(--b3-theme-error, #f44336);
      color: #fff;
    }
  }
}

.add-model-input-group {
  display: flex;
  gap: 8px;

  .mini-input {
    flex: 1;
    height: 28px;
    font-size: 12px;
    padding: 0 8px;
  }

  .mini-btn {
    height: 28px;
    padding: 0 12px;
    font-size: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
}
</style>