<template>
  <div class="ai-chat-root">
    <div class="void-chat-panel" :class="{ open: props.isOpen }">
      <div class="panel-tabs">
        <div class="panel-tabs-left">
          <button
            class="panel-tab"
            :class="{ active: activeTab === 'chat' }"
            @click="activeTab = 'chat'"
            type="button"
          >
            Chat
          </button>
          <button
            class="panel-tab"
            :class="{ active: activeTab === 'terminal' }"
            @click="activeTab = 'terminal'"
            type="button"
          >
            Terminal
          </button>
        </div>
        <div v-if="activeTab === 'terminal'" class="panel-tabs-right">
          <select v-model="selectedTerminalProfileId" class="panel-profile-select" :disabled="terminalProfiles.length === 0" title="Perfil">
            <option v-if="terminalProfiles.length === 0" value="">Sem perfis</option>
            <option v-for="p in terminalProfiles" :key="p.id" :value="p.id">
              {{ p.name }}
            </option>
          </select>
          <div class="panel-actions">
            <button
              class="panel-icon-btn"
              type="button"
              title="Iniciar"
              @click="runAiTerminalStartupCommand"
              :disabled="!terminalApiAvailable || !activeAiProfile?.startupCommand || isStartingAiCli"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z"></path>
              </svg>
            </button>
            <button
              class="panel-icon-btn"
              type="button"
              title="Limpar"
              @click="clearAiTerminal"
              :disabled="!aiTerminalReady"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 6h18"></path>
                <path d="M8 6V4h8v2"></path>
                <path d="M19 6l-1 14H6L5 6"></path>
              </svg>
            </button>
            <button
              class="panel-icon-btn panel-icon-btn-primary"
              type="button"
              title="Novo terminal"
              @click="createAiTerminalSession"
              :disabled="!terminalApiAvailable"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 5v14"></path>
                <path d="M5 12h14"></path>
              </svg>
            </button>
            <button
              class="panel-icon-btn"
              type="button"
              title="Loja de CLIs"
              @click="openCliStore"
              :disabled="!cliStoreApiAvailable"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M6 2l1.5 4h9L18 2"></path>
                <path d="M3 6h18l-1.5 14H4.5L3 6z"></path>
                <path d="M9 10v6"></path>
                <path d="M15 10v6"></path>
              </svg>
            </button>
            <div class="panel-saved-menu-wrap">
              <button
                class="panel-icon-btn"
                type="button"
                title="Sessões salvas"
                @click.stop="toggleAiSavedMenu"
                :disabled="!aiSessionsApiAvailable"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 8v5l3 3"></path>
                  <path d="M3.05 11a9 9 0 1 1 .5 4"></path>
                  <path d="M3 17v4h4"></path>
                </svg>
              </button>
              <div v-if="showAiSavedMenu" class="panel-saved-menu" @click.stop>
                <button
                  v-for="s in aiSavedSessions"
                  :key="s.resumeCommand"
                  class="panel-saved-item"
                  type="button"
                  @click="resumeSavedSession(s)"
                >
                  <span class="panel-saved-left">
                    <span class="panel-saved-name">{{ s.name || s.tool || 'Sessão' }}</span>
                    <span class="panel-saved-meta">{{ s.resumeId || s.resumeCommand }}</span>
                  </span>
                  <span class="panel-saved-action">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M8 5v14l11-7z"></path>
                    </svg>
                  </span>
                </button>
              </div>
            </div>
            <button
              class="panel-icon-btn"
              type="button"
              title="Configurar perfis"
              @click="openTerminalProfilesModal"
              :disabled="!profilesApiAvailable"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z"></path>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.2.5.5.9 1.1 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09c-.6.1-.9.5-1.1 1z"></path>
              </svg>
            </button>
          </div>
        </div>
      </div>
      <!-- Chat Container -->
      <div v-if="activeTab === 'chat'" class="chat-container" ref="chatContainer">
        <!-- Messages -->
        <div class="messages-wrapper" ref="messagesWrapper">
          <template v-for="(msg, index) in messages" :key="index">
            <!-- User Message -->
            <div v-if="msg.role === 'user'" class="message user-message">
              <div class="message-content" v-html="parseMessage(msg.content)"></div>
            </div>
            
            <!-- Assistant Message -->
            <div v-else-if="msg.role === 'assistant'" class="message assistant-message">
              <!-- Tool Calls (se houver) -->
              <div v-if="msg.toolCalls?.length > 0" class="tool-calls-summary">
                <div v-for="(tool, idx) in msg.toolCalls" :key="idx" class="tool-badge">
                  <svg class="tool-check" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                    <polyline points="22 4 12 14.01 9 11.01"/>
                  </svg>
                  <span>{{ formatToolName(tool.name) }}</span>
                </div>
              </div>
              <div class="message-content" v-html="parseMessage(msg.content)"></div>
            </div>
          </template>

          <!-- Loading State -->
          <div v-if="isLoading" class="message assistant-message loading">
            <!-- Tool calls em execução -->
            <div v-if="currentToolCalls.length > 0" class="tool-calls-live">
              <div v-for="(tool, idx) in currentToolCalls" :key="idx" class="tool-call-item" :class="tool.status">
                <div class="tool-spinner" v-if="tool.status === 'executing'">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                  </svg>
                </div>
                <svg v-else class="tool-done" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                  <polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
                <span class="tool-name">{{ formatToolName(tool.name) }}</span>
              </div>
            </div>
            <div v-else class="thinking-indicator">
              <span class="thinking-dot"></span>
              <span class="thinking-dot"></span>
              <span class="thinking-dot"></span>
            </div>
          </div>
        </div>
      </div>

      <!-- Input Area (Void Style) -->
      <div v-if="activeTab === 'chat'" class="input-area">
        <div class="input-container" :class="{ focused: inputFocused }">
          <!-- Context items -->
          <div v-if="contextItems.length > 0" class="context-bar">
            <div v-for="(item, idx) in contextItems" :key="idx" class="context-item">
              <span class="context-icon">{{ item.icon }}</span>
              <span class="context-name">{{ item.label }}</span>
              <button class="context-remove" @click="removeContext(idx)">×</button>
            </div>
          </div>
          
          <!-- Input -->
          <div class="input-row">
            <div 
              ref="inputRef"
              contenteditable="true"
              class="text-input"
              @input="updateInput"
              @keydown="handleKeydown"
              @paste="handlePaste"
              @focus="inputFocused = true"
              @blur="inputFocused = false"
              :data-placeholder="getPlaceholder()"
            ></div>
          </div>
          
          <!-- Bottom Bar -->
          <div class="bottom-bar">
            <div class="left-controls">
              <!-- Mode Selector -->
              <div class="mode-selector" @click.stop="toggleModeMenu">
                <span class="mode-current">{{ selectedModeLabel }}</span>
                <svg class="chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
                
                <!-- Mode Dropdown -->
                <div v-if="showModeMenu" class="mode-menu">
                  <div 
                    v-for="(config, mode) in availableModes" 
                    :key="mode"
                    class="mode-item"
                    :class="{ active: selectedMode === mode }"
                    @click.stop="selectMode(mode)"
                  >
                    <span class="mode-name">{{ config.name }}</span>
                    <span class="mode-desc">{{ config.description }}</span>
                    <svg v-if="selectedMode === mode" class="mode-check" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  </div>
                </div>
              </div>
              
              <!-- Model -->
              <div class="model-display">
                <span>{{ selectedModel }}</span>
              </div>
            </div>
            
            <div class="right-controls">
              <!-- New Chat -->
              <button class="icon-btn" @click="clearChat" title="Nova conversa">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 5v14M5 12h14"/>
                </svg>
              </button>
              
              <!-- Send -->
              <button 
                class="send-btn"
                :class="{ active: inputMessage.trim().length > 0 && !isLoading }"
                :disabled="!inputMessage.trim() || isLoading"
                @click="sendPrompt"
              >
                <svg v-if="!isLoading" width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" clip-rule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z"/>
                </svg>
                <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="4" y="4" width="16" height="16" rx="2"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div v-else class="terminal-view">
      <div class="ai-terminal-tabs">
        <button
          v-for="s in aiTerminalSessions"
          :key="s.id"
          class="ai-terminal-tab"
          :class="{ active: s.id === activeAiTerminalId }"
          type="button"
          @click="setActiveAiTerminal(s.id)"
        >
          <span class="ai-terminal-tab-main">
            <span class="ai-terminal-tab-name">{{ s.name }}</span>
            <span class="ai-terminal-tab-meta">{{ s.profileName }}</span>
          </span>
          <span
            class="ai-terminal-tab-close"
            role="button"
            tabindex="0"
            title="Fechar"
            @click.stop="closeAiTerminalSession(s.id)"
            @keydown.enter.prevent.stop="closeAiTerminalSession(s.id)"
            @keydown.space.prevent.stop="closeAiTerminalSession(s.id)"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6 6 18"></path>
              <path d="M6 6 18 18"></path>
            </svg>
          </span>
        </button>
      </div>
      <div ref="aiTerminalContainer" class="ai-terminal-container" @contextmenu.prevent="openAiTerminalContextMenu"></div>
      <div
        v-if="aiTerminalContextMenu.open"
        class="terminal-context-overlay"
        @pointerdown="closeAiTerminalContextMenu"
        @contextmenu.prevent
      >
        <div
          class="terminal-context-menu"
          :style="{ left: aiTerminalContextMenu.x + 'px', top: aiTerminalContextMenu.y + 'px' }"
          @pointerdown.stop
        >
          <button class="terminal-context-item" :disabled="!aiTerminalContextMenu.hasSelection" @click="aiContextCopy">
            <span class="terminal-context-left">
              <svg class="terminal-context-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
              <span>Copiar</span>
            </span>
            <span class="terminal-context-shortcut">Ctrl+Shift+C</span>
          </button>
          <button class="terminal-context-item" :disabled="!aiTerminalReady" @click="aiContextPaste">
            <span class="terminal-context-left">
              <svg class="terminal-context-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M19 21H10a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2z"></path>
                <path d="M16 3h-1.18A2 2 0 0 0 13 2h-2a2 2 0 0 0-1.82 1H8a2 2 0 0 0-2 2v1h13V5a2 2 0 0 0-2-2z"></path>
              </svg>
              <span>Colar</span>
            </span>
            <span class="terminal-context-shortcut">Ctrl+Shift+V</span>
          </button>
        </div>
      </div>
    </div>
    </div>
  
  <!-- Diff Preview Modal -->
  <Teleport to="body">
    <div v-if="showDiffPreview" class="diff-modal-overlay" @click="handleRejectDiff">
      <div class="diff-modal" @click.stop>
        <div class="diff-modal-header">
          <h3>Preview de Mudanças</h3>
          <span class="diff-modal-file">{{ diffPreviewData.fileName }}</span>
          <button class="diff-modal-close" @click="handleRejectDiff">×</button>
        </div>
        <div class="diff-modal-content">
          <DiffViewer
            :original-code="diffPreviewData.originalCode"
            :new-code="diffPreviewData.newCode"
            :title="diffPreviewData.filePath"
            :show-accept="false"
            :show-reject="false"
            mode="inline"
            :context-lines="5"
          />
        </div>
        <div class="diff-modal-footer">
          <button class="diff-btn diff-btn-reject" @click="handleRejectDiff">
            <span class="icon-xmark"></span> Rejeitar
          </button>
          <button class="diff-btn diff-btn-accept" @click="handleAcceptDiff">
            <span class="icon-check"></span> Aceitar Mudanças
          </button>
        </div>
      </div>
    </div>
  </Teleport>

  <Teleport to="body">
    <div v-if="showTerminalProfilesModal" class="profiles-modal-overlay">
      <div
        ref="profilesModalRef"
        class="profiles-modal"
        :style="profilesModalStyle"
        @click.stop
      >
        <div class="profiles-modal-header">
          <div class="profiles-modal-title">
            Perfis de Terminal
            <span v-if="isProfileDraftDirty" class="profiles-unsaved-badge">Não salvo</span>
          </div>
          <button class="profiles-modal-close" type="button" @click="closeTerminalProfilesModal">×</button>
        </div>
        <div class="profiles-modal-content">
          <div v-if="isProfileDraftDirty" class="profiles-unsaved-note">
            Existem modificações não salvas neste perfil.
          </div>
          <div class="profiles-layout">
            <div class="profiles-sidebar">
              <div class="profiles-sidebar-header">
                <div class="profiles-sidebar-title">Perfis</div>
                <div class="profiles-sidebar-buttons">
                  <button class="profiles-icon-btn" type="button" @click="requestCreateProfileFromTemplate('openclaude-openrouter')">OpenRouter</button>
                  <button class="profiles-icon-btn" type="button" @click="requestCreateProfileFromTemplate('openclaude-local')">Local</button>
                  <button class="profiles-icon-btn" type="button" @click="requestCreateProfileFromTemplate('blank')">Novo</button>
                </div>
              </div>
              <div class="profiles-list">
                <button
                  v-for="p in terminalProfiles"
                  :key="p.id"
                  class="profiles-item"
                  :class="{ active: modalProfileId === p.id }"
                  type="button"
                  @click="requestSelectModalProfile(p.id)"
                >
                  <div class="profiles-item-main">
                    <div class="profiles-item-name">{{ p.name }}</div>
                    <div class="profiles-item-id">{{ p.id }}</div>
                  </div>
                  <div v-if="p.id === selectedTerminalProfileId" class="profiles-item-badge">Ativo</div>
                </button>
              </div>
              <div class="profiles-sidebar-actions">
                <button class="profiles-btn" type="button" @click="activateModalProfile" :disabled="!modalProfileId || modalProfileId === selectedTerminalProfileId">
                  Ativar
                </button>
                <button class="profiles-btn" type="button" @click="duplicateModalProfile" :disabled="!modalProfileId">
                  Duplicar
                </button>
                <button class="profiles-btn profiles-btn-danger" type="button" @click="deleteModalProfile" :disabled="!modalProfileId">
                  Excluir
                </button>
              </div>
            </div>
            <div class="profiles-editor">
              <div class="profiles-row">
                <label class="profiles-label">ID</label>
                <input class="profiles-input" v-model="profileDraft.id" />
              </div>
              <div class="profiles-row">
                <label class="profiles-label">Nome</label>
                <input class="profiles-input" v-model="profileDraft.name" />
              </div>
              <div class="profiles-row">
                <label class="profiles-label">Comando</label>
                <input class="profiles-input" v-model="profileDraft.startupCommand" placeholder="claude" />
              </div>
              <div class="profiles-row profiles-row--textarea">
                <label class="profiles-label">Env (JSON)</label>
                <textarea class="profiles-textarea" v-model="profileDraft.envText" spellcheck="false"></textarea>
              </div>
              <div class="profiles-hint">
                Salve a API key apenas se você confiar no armazenamento local (arquivo settings.json no seu usuário).
              </div>
            </div>
          </div>
        </div>
        <div class="profiles-modal-footer">
          <div v-if="pendingModalAction" class="profiles-unsaved-actions">
            <div class="profiles-unsaved-actions-text">Você tem mudanças não salvas.</div>
            <button class="profiles-btn" type="button" @click="resolvePendingAction('cancel')">
              Cancelar
            </button>
            <button class="profiles-btn" type="button" @click="resolvePendingAction('discard')">
              Descartar
            </button>
            <button class="profiles-btn profiles-btn-primary" type="button" @click="resolvePendingAction('save')">
              Salvar e continuar
            </button>
          </div>
          <button class="profiles-btn" type="button" @click="closeTerminalProfilesModal">
            Cancelar
          </button>
          <button class="profiles-btn profiles-btn-primary" type="button" @click="saveProfileDraft">
            Salvar
          </button>
        </div>
        <div class="profiles-resize-handle" @pointerdown.prevent="startResizeProfilesModal"></div>
      </div>
    </div>
  </Teleport>

  <Teleport to="body">
    <div v-if="showCliStoreModal" class="store-modal-overlay">
      <div class="store-modal" @click.stop>
        <div class="store-modal-header">
          <div class="store-modal-title">Loja de CLIs</div>
          <button class="store-modal-close" type="button" @click="closeCliStore">×</button>
        </div>
        <div class="store-modal-content">
          <div v-if="!nodeStatus?.ok" class="store-warning">
            Node.js/npm não encontrado. Instale Node.js para usar a loja.
          </div>
          <div v-else-if="storeScope === 'global'" class="store-note">
            Instalação global pode exigir permissões de admin dependendo do seu npm prefix.
          </div>
          <div class="store-toolbar">
            <input class="store-search" v-model="storeSearch" placeholder="Buscar pacote..." />
            <div class="store-scope">
              <button class="store-scope-btn" :class="{ active: storeScope === 'global' }" type="button" @click="storeScope = 'global'">
                Global
              </button>
              <button class="store-scope-btn" :class="{ active: storeScope === 'local' }" type="button" @click="storeScope = 'local'">
                Local
              </button>
            </div>
            <button class="store-refresh" type="button" @click="refreshCliStore" :disabled="storeLoading">
              Atualizar
            </button>
          </div>
          <div v-if="storeError" class="store-error">{{ storeError }}</div>
          <div v-if="storeLoading" class="store-loading">Carregando...</div>
          <div v-else class="store-list">
            <div v-for="app in filteredStoreApps" :key="app.id || app.package" class="store-item">
              <div class="store-item-main">
                <div class="store-item-title">{{ app.name }}</div>
                <div class="store-item-desc">{{ app.description }}</div>
                <div class="store-item-meta">{{ app.package }}</div>
              </div>
              <div class="store-item-actions">
                <button
                  v-if="isPackageInstalled(app.package)"
                  class="store-btn"
                  type="button"
                  @click="uninstallCli(app.package)"
                  :disabled="!nodeStatus?.ok || storeInstalling === app.package"
                >
                  <span v-if="storeInstalling === app.package" class="store-btn-inline">
                    <span class="store-spinner"></span>
                    Removendo...
                  </span>
                  <span v-else>Remover</span>
                </button>
                <button
                  v-else
                  class="store-btn store-btn-primary"
                  type="button"
                  @click="installCli(app.package)"
                  :disabled="!nodeStatus?.ok || storeInstalling === app.package"
                >
                  <span v-if="storeInstalling === app.package" class="store-btn-inline">
                    <span class="store-spinner"></span>
                    Instalando...
                  </span>
                  <span v-else>Instalar</span>
                </button>
              </div>
            </div>
          </div>
          <div v-if="cliBinPath" class="store-footer">
            Binários: {{ cliBinPath }}
          </div>
        </div>
      </div>
    </div>
  </Teleport>

  <Teleport to="body">
    <div v-if="showAiProjectPicker" class="project-picker-overlay" @click="closeAiProjectPicker">
      <div class="project-picker-modal" @click.stop>
        <div class="project-picker-header">
          <div class="project-picker-title">Escolher projeto</div>
          <button class="project-picker-close" type="button" @click="closeAiProjectPicker">×</button>
        </div>
        <div class="project-picker-content">
          <button
            v-for="p in workspaceFolderOptions"
            :key="p.path"
            class="project-picker-item"
            type="button"
            @click="startAiCliInProject(p.path)"
          >
            <span class="project-picker-name">{{ p.label }}</span>
            <span class="project-picker-path">{{ p.path }}</span>
          </button>
        </div>
        <div class="project-picker-footer">
          <button class="project-picker-btn" type="button" @click="closeAiProjectPicker">Cancelar</button>
        </div>
      </div>
    </div>
  </Teleport>
  </div>
</template>

<script setup>
import { computed, ref, toRaw, nextTick, onMounted, onUnmounted, watch } from 'vue'
import { marked } from 'marked'
import DiffViewer from './DiffViewer.vue'
import { hasChanges } from '../utils/diff.js'
import { Terminal as XTerm } from 'xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import 'xterm/css/xterm.css'

marked.setOptions({
  breaks: true,
  gfm: true
})

const props = defineProps({ 
  isOpen: Boolean
})

const emit = defineEmits(['close'])

// State
const messages = ref([
  { role: 'system', content: 'Você é um assistente de IA integrado ao Monarco IDE.' },
  { role: 'assistant', content: 'Como posso ajudar?' }
])
const inputMessage = ref('')
const isLoading = ref(false)
const chatContainer = ref(null)
const messagesWrapper = ref(null)
const inputRef = ref()
const inputFocused = ref(false)
let typingMessageIndex = -1

// Diff Preview State
const showDiffPreview = ref(false)
const diffPreviewData = ref({
  originalCode: '',
  newCode: '',
  filePath: '',
  fileName: '',
  blockId: null
})

// Tool calls
const currentToolCalls = ref([])
let cleanupToolCallListener = null

// Mode & Model
const contextItems = ref([])
const selectedMode = ref('agent')
const selectedModeLabel = ref('Agent')
const selectedModel = ref('Qwen 3B')
const showModeMenu = ref(false)
const availableModes = ref({
  normal: { name: 'Normal', description: 'Chat simples sem ferramentas' },
  gather: { name: 'Gather', description: 'Apenas ferramentas de leitura' },
  agent: { name: 'Agent', description: 'Acesso completo a todas as ferramentas' }
})

const activeTab = ref('chat')

const terminalProfiles = ref([])
const selectedTerminalProfileId = ref('')
const selectedTerminalProfile = computed(() => {
  return terminalProfiles.value.find(p => p?.id === selectedTerminalProfileId.value) || null
})
const showTerminalProfilesModal = ref(false)
const terminalProfilesLoaded = ref(false)
const profilesApiAvailable = !!window.monarco?.aiProfiles
const modalProfileId = ref('')
const profilesModalRef = ref(null)
const profilesModalSize = ref({ width: null, height: null })
const isResizingProfilesModal = ref(false)
const profilesResizeState = ref({ startX: 0, startY: 0, startW: 0, startH: 0 })
const draftBaseline = ref(null)
const pendingModalAction = ref(null)
const profileDraft = ref({
  id: '',
  name: '',
  startupCommand: '',
  envText: '{\n  "CLAUDE_CODE_USE_OPENAI": "1",\n  "OPENAI_BASE_URL": "https://openrouter.ai/api/v1",\n  "OPENAI_API_KEY": "",\n  "OPENAI_MODEL": ""\n}'
})

function getDraftSnapshot() {
  return {
    id: String(profileDraft.value.id || '').trim(),
    name: String(profileDraft.value.name || '').trim(),
    startupCommand: String(profileDraft.value.startupCommand || '').trim(),
    envText: String(profileDraft.value.envText || '')
  }
}

function setDraftBaselineFromCurrent() {
  draftBaseline.value = getDraftSnapshot()
}

const isProfileDraftDirty = computed(() => {
  if (!draftBaseline.value) return false
  const current = getDraftSnapshot()
  return JSON.stringify(current) !== JSON.stringify(draftBaseline.value)
})

async function loadTerminalProfilesFromStore() {
  if (!window.monarco?.aiProfiles?.list) {
    terminalProfiles.value = []
    selectedTerminalProfileId.value = ''
    terminalProfilesLoaded.value = true
    return
  }
  try {
    const res = await window.monarco.aiProfiles.list()
    const profiles = res?.profiles
    const activeProfileId = res?.activeProfileId
    terminalProfiles.value = Array.isArray(profiles)
      ? profiles
          .filter(p => p && typeof p === 'object')
          .map(p => ({
            id: String(p.id || '').trim(),
            name: String(p.name || '').trim(),
            startupCommand: String(p.startupCommand || '').trim(),
            env: p.env && typeof p.env === 'object' ? { ...p.env } : {}
          }))
          .filter(p => p.id && p.name)
      : []
    selectedTerminalProfileId.value = activeProfileId || terminalProfiles.value[0]?.id || ''
  } catch {
    terminalProfiles.value = []
    selectedTerminalProfileId.value = ''
  } finally {
    terminalProfilesLoaded.value = true
  }
}

function toPlainEnv(input) {
  const raw = input && typeof input === 'object' ? toRaw(input) : null
  if (!raw) return {}
  const out = {}
  for (const [k, v] of Object.entries(raw)) {
    if (typeof k !== 'string' || k.trim().length === 0) continue
    if (v === undefined || v === null) continue
    out[k] = typeof v === 'string' ? v : String(v)
  }
  return out
}

async function upsertTerminalProfile(profile) {
  if (!window.monarco?.aiProfiles?.upsert) return
  await window.monarco.aiProfiles.upsert({
    id: String(profile.id || '').trim(),
    name: String(profile.name || '').trim(),
    startupCommand: String(profile.startupCommand || '').trim(),
    env: toPlainEnv(profile.env)
  })
}

async function setActiveTerminalProfile(id) {
  if (!window.monarco?.aiProfiles?.setActive) return
  await window.monarco.aiProfiles.setActive(String(id || '').trim())
}

async function removeTerminalProfile(id) {
  if (!window.monarco?.aiProfiles?.remove) return
  await window.monarco.aiProfiles.remove(String(id || '').trim())
}

function openTerminalProfilesModal() {
  const initialId = selectedTerminalProfileId.value || terminalProfiles.value[0]?.id || ''
  if (initialId) {
    selectModalProfile(initialId)
  } else {
    createProfileFromTemplate('blank')
  }
  showTerminalProfilesModal.value = true
  initProfilesModalSize()
}

function closeTerminalProfilesModal() {
  showTerminalProfilesModal.value = false
}

const profilesModalStyle = computed(() => {
  const w = profilesModalSize.value.width
  const h = profilesModalSize.value.height
  return {
    width: typeof w === 'number' ? `${w}px` : undefined,
    height: typeof h === 'number' ? `${h}px` : undefined
  }
})

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

async function initProfilesModalSize() {
  await nextTick()
  const el = profilesModalRef.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  profilesModalSize.value = {
    width: Math.round(rect.width),
    height: Math.round(rect.height)
  }
}

function startResizeProfilesModal(e) {
  const el = profilesModalRef.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  profilesResizeState.value = {
    startX: e.clientX,
    startY: e.clientY,
    startW: rect.width,
    startH: rect.height
  }
  isResizingProfilesModal.value = true
  window.addEventListener('pointermove', handleResizeProfilesModal, { passive: true })
  window.addEventListener('pointerup', stopResizeProfilesModal, { passive: true, once: true })
}

function handleResizeProfilesModal(e) {
  if (!isResizingProfilesModal.value) return
  const { startX, startY, startW, startH } = profilesResizeState.value
  const dx = e.clientX - startX
  const dy = e.clientY - startY

  const minW = 640
  const minH = 420
  const maxW = Math.max(minW, window.innerWidth - 16)
  const maxH = Math.max(minH, window.innerHeight - 40)

  profilesModalSize.value = {
    width: Math.round(clamp(startW + dx, minW, maxW)),
    height: Math.round(clamp(startH + dy, minH, maxH))
  }
}

function stopResizeProfilesModal() {
  isResizingProfilesModal.value = false
  window.removeEventListener('pointermove', handleResizeProfilesModal)
}

function selectModalProfile(id) {
  modalProfileId.value = id
  const p = terminalProfiles.value.find(x => x?.id === id) || null
  profileDraft.value = {
    id: p?.id || '',
    name: p?.name || '',
    startupCommand: p?.startupCommand || '',
    envText: JSON.stringify(p?.env || {}, null, 2) || '{}'
  }
  setDraftBaselineFromCurrent()
}

function requestSelectModalProfile(id) {
  if (!id || id === modalProfileId.value) return
  if (isProfileDraftDirty.value) {
    pendingModalAction.value = { type: 'select', id }
    window.monarcoToast?.warning?.('Existem modificações não salvas')
    return
  }
  selectModalProfile(id)
}

function requestCreateProfileFromTemplate(template) {
  if (isProfileDraftDirty.value) {
    pendingModalAction.value = { type: 'create', template }
    window.monarcoToast?.warning?.('Existem modificações não salvas')
    return
  }
  createProfileFromTemplate(template)
  setDraftBaselineFromCurrent()
}

function createProfileFromTemplate(template) {
  const suffix = Date.now().toString(36)
  let id = `profile_${suffix}`
  let name = 'Novo Perfil'
  let startupCommand = 'openclaude'
  let env = {}

  if (template === 'openclaude-openrouter') {
    id = `openclaude_openrouter_${suffix}`
    name = 'OpenClaude (OpenRouter)'
    startupCommand = 'openclaude'
    env = {
      CLAUDE_CODE_USE_OPENAI: '1',
      OPENAI_BASE_URL: 'https://openrouter.ai/api/v1',
      OPENAI_API_KEY: '',
      OPENAI_MODEL: 'qwen/qwen3.6-plus:free'
    }
  } else if (template === 'openclaude-local') {
    id = `openclaude_local_${suffix}`
    name = 'OpenClaude (Local)'
    startupCommand = 'openclaude'
    env = {
      CLAUDE_CODE_USE_OPENAI: '1',
      OPENAI_BASE_URL: 'http://192.168.1.19:11434/v1',
      OPENAI_API_KEY: 'sk-fake',
      OPENAI_MODEL: 'glm-5:cloud'
    }
  }

  const profile = { id, name, startupCommand, env }
  terminalProfiles.value.push(profile)
  modalProfileId.value = id
  profileDraft.value = {
    id,
    name,
    startupCommand,
    envText: JSON.stringify(env, null, 2)
  }
}

async function saveProfileDraft() {
  let env
  try {
    env = JSON.parse(profileDraft.value.envText || '{}')
  } catch (e) {
    window.monarcoToast?.error?.('Env inválido', { description: 'JSON inválido nas variáveis de ambiente' })
    return
  }
  const normalizedEnvText = JSON.stringify(env, null, 2)
  profileDraft.value.envText = normalizedEnvText

  const draftId = String(profileDraft.value.id || '').trim()
  const draftName = String(profileDraft.value.name || '').trim()
  if (!draftId || !draftName) {
    window.monarcoToast?.warning?.('Preencha id e nome do perfil')
    return
  }

  const profile = {
    id: draftId,
    name: draftName,
    startupCommand: String(profileDraft.value.startupCommand || '').trim(),
    env: env && typeof env === 'object' ? env : {}
  }

  const originalId = String(modalProfileId.value || '').trim()
  const idxOriginal = originalId ? terminalProfiles.value.findIndex(p => p?.id === originalId) : -1
  const idxDraft = terminalProfiles.value.findIndex(p => p?.id === draftId)

  if (idxOriginal >= 0) {
    if (originalId === draftId) {
      terminalProfiles.value.splice(idxOriginal, 1, profile)
    } else {
      if (idxDraft >= 0) {
        window.monarcoToast?.warning?.('Já existe um perfil com esse ID')
        return
      }
      terminalProfiles.value.splice(idxOriginal, 1, profile)
    }
  } else if (idxDraft >= 0) {
    terminalProfiles.value.splice(idxDraft, 1, profile)
  } else {
    terminalProfiles.value.push(profile)
  }

  selectedTerminalProfileId.value = draftId
  modalProfileId.value = draftId
  await upsertTerminalProfile(profile)
  await setActiveTerminalProfile(draftId)
  setDraftBaselineFromCurrent()
  window.monarcoToast?.success?.('Perfil salvo!')
}

async function resolvePendingAction(action) {
  const pending = pendingModalAction.value
  if (!pending) return

  if (action === 'cancel') {
    pendingModalAction.value = null
    return
  }

  if (action === 'discard') {
    if (draftBaseline.value) {
      profileDraft.value = { ...draftBaseline.value }
    }
  }

  if (action === 'save') {
    await saveProfileDraft()
    if (isProfileDraftDirty.value) return
  }

  pendingModalAction.value = null
  if (pending.type === 'select') {
    selectModalProfile(pending.id)
  } else if (pending.type === 'create') {
    createProfileFromTemplate(pending.template)
    setDraftBaselineFromCurrent()
  }
}

async function deleteModalProfile() {
  const id = modalProfileId.value
  if (!id) return
  terminalProfiles.value = terminalProfiles.value.filter(p => p?.id !== id)
  const nextId = terminalProfiles.value[0]?.id || ''
  modalProfileId.value = nextId
  if (selectedTerminalProfileId.value === id) {
    selectedTerminalProfileId.value = nextId
  }
  await removeTerminalProfile(id)
  if (nextId) await setActiveTerminalProfile(nextId)
  window.monarcoToast?.info?.('Perfil removido. O terminal em execução não será reiniciado.')
}

async function activateModalProfile() {
  if (!modalProfileId.value) return
  selectedTerminalProfileId.value = modalProfileId.value
}

function duplicateModalProfile() {
  const source = terminalProfiles.value.find(p => p?.id === modalProfileId.value) || null
  if (!source) return
  const suffix = Date.now().toString(36)
  const id = `${String(source.id || 'profile')}_${suffix}`
  const profile = {
    id,
    name: `${String(source.name || 'Perfil')} (Cópia)`,
    startupCommand: String(source.startupCommand || ''),
    env: source.env && typeof source.env === 'object' ? { ...source.env } : {}
  }
  terminalProfiles.value.push(profile)
  selectModalProfile(id)
}

const aiTerminalContainer = ref(null)
const terminalApiAvailable = !!window.monarco?.terminal
const aiTerminalSessions = ref([])
const activeAiTerminalId = ref('')
const aiTerminalReady = computed(() => !!activeAiTerminalId.value)
const activeAiSession = computed(() => aiTerminalSessions.value.find(s => s.id === activeAiTerminalId.value) || null)
const activeAiProfile = computed(() => {
  const profileId = activeAiSession.value?.profileId || selectedTerminalProfileId.value
  return terminalProfiles.value.find(p => p?.id === profileId) || null
})
const aiSavedSessions = ref([])
const showAiSavedMenu = ref(false)
const workspaceFolderOptions = ref([])
const selectedAiCwd = ref('')
const showAiProjectPicker = ref(false)
const isStartingAiCli = ref(false)
const aiSessionsApiAvailable = !!window.monarco?.aiSessions
const cliStoreApiAvailable = !!window.monarco?.cliStore
const showCliStoreModal = ref(false)
const storeLoading = ref(false)
const storeError = ref('')
const storeCatalog = ref({ apps: [] })
const storeSearch = ref('')
const nodeStatus = ref(null)
const installedCli = ref([])
const storeInstalling = ref('')
const storeInstallingAction = ref('')
const cliBinPath = ref('')
const storeScope = ref('global')
const aiTerminalContextMenu = ref({
  open: false,
  x: 0,
  y: 0,
  hasSelection: false
})
let aiTerminalResizeObserver = null
let aiTerminalDataUnsub = null
let aiTerminalExitUnsub = null
const aiXterms = new Map()
const aiFitAddons = new Map()
const aiOutputBuffers = new Map()
const aiLastResumeByTerminalId = new Map()
let aiMigrateAttempted = false

function openAiTerminalContextMenu(e) {
  const xterm = aiXterms.get(activeAiTerminalId.value)
  if (!xterm) return
  aiTerminalContextMenu.value = {
    open: true,
    x: e.clientX,
    y: e.clientY,
    hasSelection: !!(xterm.getSelection?.() || '')
  }
}

function closeAiTerminalContextMenu() {
  aiTerminalContextMenu.value.open = false
}

async function aiContextCopy() {
  await copyAiTerminalSelection()
  closeAiTerminalContextMenu()
}

async function aiContextPaste() {
  await pasteToAiTerminal()
  closeAiTerminalContextMenu()
}

async function copyAiTerminalSelection() {
  const xterm = aiXterms.get(activeAiTerminalId.value)
  if (!xterm) return
  const selection = xterm.getSelection?.() || ''
  if (!selection) {
    window.monarcoToast?.info?.('Nenhuma seleção para copiar')
    return
  }
  try {
    await navigator.clipboard.writeText(selection)
    window.monarcoToast?.success?.('Copiado!')
  } catch (e) {
    window.monarcoToast?.error?.('Falha ao copiar', { description: e?.message })
  }
}

async function pasteToAiTerminal() {
  const terminalId = activeAiTerminalId.value
  if (!terminalId) return
  try {
    const text = await navigator.clipboard.readText()
    if (!text) return
    window.monarco?.terminal?.write?.(terminalId, text)
    aiXterms.get(terminalId)?.focus?.()
  } catch (e) {
    window.monarcoToast?.error?.('Falha ao colar', { description: e?.message })
  }
}

async function toggleAiSavedMenu() {
  const next = !showAiSavedMenu.value
  showAiSavedMenu.value = next
  if (next) {
    await refreshAiSavedSessions()
  }
}

async function runAiTerminalStartupCommand() {
  const cmd = String(activeAiProfile.value?.startupCommand || '').trim()
  if (!cmd) {
    window.monarcoToast?.warning?.('Perfil sem comando de inicialização')
    return
  }
  if (!terminalApiAvailable) return

  if (workspaceFolderOptions.value.length > 1) {
    openAiProjectPicker()
    return
  }

  const cwd = workspaceFolderOptions.value[0]?.path || selectedAiCwd.value || ''
  await startAiCliInProject(cwd)
}

function stripAnsi(input) {
  const s = String(input || '')
  return s
    .replace(/\x1B\[[0-9;?]*[ -/]*[@-~]/g, '')
    .replace(/\x1B\][^\x07]*(\x07|\x1B\\)/g, '')
}

function extractResumeCommand(text) {
  const clean = stripAnsi(text)
  const match = clean.match(/\b([\w-]+)\s+--resume\s+([0-9a-fA-F-]{36})\b/)
  if (!match) return null
  const tool = match[1]
  const resumeId = match[2]
  return { tool, resumeId, resumeCommand: `${tool} --resume ${resumeId}` }
}

async function refreshAiSavedSessions() {
  if (window.monarco?.aiSessions?.list) {
    try {
      const list = await window.monarco.aiSessions.list({ limit: 50 })
      aiSavedSessions.value = Array.isArray(list) ? list : []
    } catch {
      aiSavedSessions.value = []
    }
  }

  if (aiSavedSessions.value.length > 0) return
  if (aiMigrateAttempted) return
  aiMigrateAttempted = true

  const legacy = await loadLegacyAiSavedSessionsFromSettings()
  if (!legacy.length) return

  for (const s of legacy) {
    try {
      await window.monarco?.aiSessions?.upsert?.(s)
    } catch {}
  }
  try {
    const list = await window.monarco?.aiSessions?.list?.({ limit: 50 })
    aiSavedSessions.value = Array.isArray(list) ? list : aiSavedSessions.value
  } catch {}
}

async function loadLegacyAiSavedSessionsFromSettings() {
  try {
    const settings = await window.monarco?.settings?.load?.()
    const list = settings?.terminal?.aiCliSessions
    if (!Array.isArray(list)) return []
    return list
      .filter(x => x && typeof x === 'object' && typeof x.resumeCommand === 'string')
      .map(x => ({
        tool: String(x.tool || '').trim(),
        resumeId: String(x.resumeId || '').trim(),
        resumeCommand: String(x.resumeCommand || '').trim(),
        profileId: String(x.profileId || '').trim(),
        name: String(x.name || '').trim(),
        updatedAt: String(x.updatedAt || '').trim()
      }))
      .filter(x => x.resumeId.length > 0 && x.resumeCommand.length > 0)
  } catch {
    return []
  }
}

function folderLabel(p) {
  const parts = String(p || '').split(/[/\\]/)
  return parts[parts.length - 1] || p
}

function openAiProjectPicker() {
  showAiProjectPicker.value = true
}

function closeAiProjectPicker() {
  showAiProjectPicker.value = false
}

async function startAiCliInProject(projectPath) {
  const cwd = String(projectPath || '').trim()
  if (cwd) selectedAiCwd.value = cwd
  showAiProjectPicker.value = false

  const cmd = String(activeAiProfile.value?.startupCommand || '').trim()
  if (!cmd) {
    window.monarcoToast?.warning?.('Perfil sem comando de inicialização')
    return
  }

  isStartingAiCli.value = true
  try {
    const terminalId = await createAiTerminalSession(cwd ? { cwd, autoFocus: true } : { autoFocus: true })
    if (!terminalId) return
    window.monarco?.terminal?.write?.(terminalId, cmd + '\n')
  } finally {
    isStartingAiCli.value = false
  }
}

async function loadWorkspaceFoldersForAi() {
  try {
    const info = await window.monarco?.workspace?.getFolders?.()
    const folders = Array.isArray(info?.folders) ? info.folders : []
    workspaceFolderOptions.value = folders.map((p) => ({ path: p, label: folderLabel(p) }))
    if (!selectedAiCwd.value) {
      selectedAiCwd.value = info?.activeFolder || folders[0] || ''
    }
  } catch {
    workspaceFolderOptions.value = []
    if (!selectedAiCwd.value) selectedAiCwd.value = ''
  }
}

function applyWorkspaceFoldersInfo(info) {
  const folders = Array.isArray(info?.folders) ? info.folders : []
  workspaceFolderOptions.value = folders.map((p) => ({ path: p, label: folderLabel(p) }))
  const active = String(info?.activeFolder || '').trim()
  if (active && folders.includes(active)) {
    selectedAiCwd.value = active
    return
  }
  if (selectedAiCwd.value && folders.includes(selectedAiCwd.value)) return
  selectedAiCwd.value = folders[0] || ''
}

const filteredStoreApps = computed(() => {
  const q = storeSearch.value.trim().toLowerCase()
  const apps = Array.isArray(storeCatalog.value?.apps) ? storeCatalog.value.apps : []
  if (!q) return apps
  return apps.filter((a) => {
    const hay = `${a.name || ''} ${a.description || ''} ${a.package || ''}`.toLowerCase()
    return hay.includes(q)
  })
})

function isPackageInstalled(pkg) {
  if (!pkg) return false
  return installedCli.value.some((p) => p.name === pkg)
}

async function refreshCliStore() {
  if (!cliStoreApiAvailable) return
  storeLoading.value = true
  storeError.value = ''
  try {
    const status = await window.monarco.cliStore.checkNode()
    nodeStatus.value = status
    const catalogRes = await window.monarco.cliStore.fetchCatalog()
    if (catalogRes?.ok && catalogRes.catalog) {
      storeCatalog.value = catalogRes.catalog
    } else {
      storeError.value = catalogRes?.error || 'Falha ao carregar catálogo'
    }
    if (status?.ok) {
      installedCli.value = await window.monarco.cliStore.listInstalled({ scope: storeScope.value })
      cliBinPath.value = await window.monarco.cliStore.getBinPath({ scope: storeScope.value })
    } else {
      installedCli.value = []
      cliBinPath.value = ''
    }
  } catch (e) {
    storeError.value = e?.message || String(e)
  } finally {
    storeLoading.value = false
  }
}

function openCliStore() {
  showCliStoreModal.value = true
  refreshCliStore()
}

function closeCliStore() {
  showCliStoreModal.value = false
}

async function installCli(pkg) {
  if (!pkg || !nodeStatus.value?.ok) return
  storeInstalling.value = pkg
  storeInstallingAction.value = 'install'
  try {
    installedCli.value = await window.monarco.cliStore.install(pkg, { scope: storeScope.value })
    window.monarcoToast?.success?.('Instalado!')
  } catch (e) {
    window.monarcoToast?.error?.('Falha ao instalar', { description: e?.message })
  } finally {
    storeInstalling.value = ''
    storeInstallingAction.value = ''
  }
}

async function uninstallCli(pkg) {
  if (!pkg || !nodeStatus.value?.ok) return
  storeInstalling.value = pkg
  storeInstallingAction.value = 'uninstall'
  try {
    installedCli.value = await window.monarco.cliStore.uninstall(pkg, { scope: storeScope.value })
    window.monarcoToast?.success?.('Removido!')
  } catch (e) {
    window.monarcoToast?.error?.('Falha ao remover', { description: e?.message })
  } finally {
    storeInstalling.value = ''
    storeInstallingAction.value = ''
  }
}

watch(storeScope, async () => {
  if (!showCliStoreModal.value) return
  await refreshCliStore()
})

function upsertSavedSessionFromTerminal(terminalId) {
  const resume = aiLastResumeByTerminalId.get(terminalId)
  if (!resume) return
  const session = aiTerminalSessions.value.find(s => s.id === terminalId) || null
  const now = new Date().toISOString()
  const next = {
    tool: resume.tool,
    resumeId: resume.resumeId,
    resumeCommand: resume.resumeCommand,
    profileId: session?.profileId || '',
    name: session?.name || '',
    updatedAt: now
  }
  window.monarco?.aiSessions?.upsert?.(next)
}

function captureResumeFromOutput(terminalId, dataChunk) {
  const prev = aiOutputBuffers.get(terminalId) || ''
  const next = (prev + String(dataChunk || '')).slice(-8000)
  aiOutputBuffers.set(terminalId, next)
  const found = extractResumeCommand(next)
  if (!found) return
  const current = aiLastResumeByTerminalId.get(terminalId)
  if (current?.resumeCommand === found.resumeCommand) return
  aiLastResumeByTerminalId.set(terminalId, found)
  upsertSavedSessionFromTerminal(terminalId)
}

async function resumeSavedSession(saved) {
  const profileId = saved?.profileId || selectedTerminalProfileId.value
  const terminalId = await createAiTerminalSession({ profileId, name: saved?.name || 'IA', autoFocus: true })
  if (!terminalId) return
  const cmd = String(saved?.resumeCommand || '').trim()
  if (cmd) {
    window.monarco?.terminal?.write?.(terminalId, cmd + '\n')
  }
  showAiSavedMenu.value = false
}

function fitAiTerminal() {
  const terminalId = activeAiTerminalId.value
  if (!terminalId) return
  const fitAddon = aiFitAddons.get(terminalId)
  const xterm = aiXterms.get(terminalId)
  if (!fitAddon || !xterm) return
  fitAddon.fit()
  const { cols, rows } = xterm
  if (window.monarco?.terminal?.resize) {
    window.monarco.terminal.resize(terminalId, cols, rows)
  }
}

function mountAiTerminal(terminalId) {
  const xterm = aiXterms.get(terminalId)
  const fitAddon = aiFitAddons.get(terminalId)
  if (!xterm || !fitAddon || !aiTerminalContainer.value) return
  aiTerminalContainer.value.innerHTML = ''
  xterm.open(aiTerminalContainer.value)
  fitAddon.fit()
  xterm.focus()
  fitAiTerminal()
}

function setActiveAiTerminal(terminalId) {
  if (!terminalId || terminalId === activeAiTerminalId.value) return
  activeAiTerminalId.value = terminalId
  nextTick(() => mountAiTerminal(terminalId))
}

function closeAiTerminalSession(terminalId) {
  if (!terminalId) return

  upsertSavedSessionFromTerminal(terminalId)

  const xterm = aiXterms.get(terminalId)
  if (xterm) {
    try { xterm.dispose() } catch {}
    aiXterms.delete(terminalId)
  }
  aiFitAddons.delete(terminalId)
  aiOutputBuffers.delete(terminalId)
  aiLastResumeByTerminalId.delete(terminalId)

  aiTerminalSessions.value = aiTerminalSessions.value.filter(s => s.id !== terminalId)

  if (activeAiTerminalId.value === terminalId) {
    activeAiTerminalId.value = aiTerminalSessions.value[0]?.id || ''
    nextTick(() => {
      if (activeAiTerminalId.value) mountAiTerminal(activeAiTerminalId.value)
      else if (aiTerminalContainer.value) aiTerminalContainer.value.innerHTML = ''
    })
  }

  window.monarco?.terminal?.destroy?.(terminalId)
}

async function createAiTerminalSession(options = {}) {
  if (!window.monarco?.terminal) return
  if (!aiTerminalContainer.value) return
  const cwd = options?.cwd || selectedAiCwd.value || await window.monarco.terminal.getCwd()
  const profileId = options?.profileId || selectedTerminalProfileId.value || terminalProfiles.value[0]?.id || ''
  const profile = terminalProfiles.value.find(p => p?.id === profileId) || null
  const env = profile?.env && typeof profile.env === 'object' ? toPlainEnv(profile.env) : undefined
  const terminalId = await window.monarco.terminal.create({ cwd, cols: 80, rows: 24, env })

  const xterm = new XTerm({
    theme: {
      background: '#0f111a',
      foreground: '#cccccc',
      cursor: '#aeafad',
      selectionBackground: '#264f78'
    },
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
    fontSize: 13,
    lineHeight: 1.2,
    cursorBlink: true,
    cursorStyle: 'block',
    scrollback: 10000,
    allowProposedApi: true
  })

  const fitAddon = new FitAddon()
  xterm.loadAddon(fitAddon)
  xterm.loadAddon(new WebLinksAddon())

  xterm.onData((data) => {
    window.monarco.terminal.write(terminalId, data)
  })

  xterm.attachCustomKeyEventHandler((e) => {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.code === 'KeyC' || e.key?.toLowerCase() === 'c')) {
      void copyAiTerminalSelection()
      return false
    }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.code === 'KeyV' || e.key?.toLowerCase() === 'v')) {
      void pasteToAiTerminal()
      return false
    }
    return true
  })

  aiXterms.set(terminalId, xterm)
  aiFitAddons.set(terminalId, fitAddon)

  const sessionIndex = aiTerminalSessions.value.length + 1
  aiTerminalSessions.value.push({
    id: terminalId,
    name: String(options?.name || '').trim() || `IA ${sessionIndex}`,
    profileId: profile?.id || profileId,
    profileName: profile?.name || 'Sem perfil'
  })
  activeAiTerminalId.value = terminalId
  await nextTick()
  mountAiTerminal(terminalId)
  if (options?.autoFocus) {
    aiXterms.get(terminalId)?.focus?.()
  }

  if (!aiTerminalResizeObserver) {
    aiTerminalResizeObserver = new ResizeObserver(() => fitAiTerminal())
    aiTerminalResizeObserver.observe(aiTerminalContainer.value)
  }

  if (!aiTerminalDataUnsub && window.monarco?.terminal?.onData) {
    aiTerminalDataUnsub = window.monarco.terminal.onData((terminalIdFromEvent, data) => {
      const target = aiXterms.get(terminalIdFromEvent)
      if (!target) return
      target.write(data)
      captureResumeFromOutput(terminalIdFromEvent, data)
    })
  }

  if (!aiTerminalExitUnsub && window.monarco?.terminal?.onExit) {
    aiTerminalExitUnsub = window.monarco.terminal.onExit((terminalIdFromEvent) => {
      if (!aiXterms.has(terminalIdFromEvent)) return
      upsertSavedSessionFromTerminal(terminalIdFromEvent)
      aiXterms.delete(terminalIdFromEvent)
      aiFitAddons.delete(terminalIdFromEvent)
      aiOutputBuffers.delete(terminalIdFromEvent)
      aiLastResumeByTerminalId.delete(terminalIdFromEvent)
      aiTerminalSessions.value = aiTerminalSessions.value.filter(s => s.id !== terminalIdFromEvent)
      if (activeAiTerminalId.value === terminalIdFromEvent) {
        activeAiTerminalId.value = aiTerminalSessions.value[0]?.id || ''
        nextTick(() => {
          if (activeAiTerminalId.value) mountAiTerminal(activeAiTerminalId.value)
          else if (aiTerminalContainer.value) aiTerminalContainer.value.innerHTML = ''
        })
      }
    })
  }

  return terminalId
}

function clearAiTerminal() {
  aiXterms.get(activeAiTerminalId.value)?.clear()
}

async function disposeAiTerminal({ destroyPty } = { destroyPty: true }) {
  if (aiTerminalResizeObserver) {
    aiTerminalResizeObserver.disconnect()
    aiTerminalResizeObserver = null
  }
  if (aiTerminalDataUnsub) {
    aiTerminalDataUnsub()
    aiTerminalDataUnsub = null
  }
  if (aiTerminalExitUnsub) {
    aiTerminalExitUnsub()
    aiTerminalExitUnsub = null
  }
  if (destroyPty && window.monarco?.terminal?.destroy) {
    for (const s of aiTerminalSessions.value) {
      window.monarco.terminal.destroy(s.id)
    }
  }
  for (const [id, xterm] of aiXterms.entries()) {
    try { xterm.dispose() } catch {}
    aiXterms.delete(id)
  }
  aiFitAddons.clear()
  aiTerminalSessions.value = []
  activeAiTerminalId.value = ''

  if (aiTerminalContainer.value) {
    aiTerminalContainer.value.innerHTML = ''
  }
}

async function ensureAtLeastOneAiTerminal() {
  if (aiTerminalSessions.value.length > 0) return
  await createAiTerminalSession()
}

// Methods
function getPlaceholder() {
  if (selectedMode.value === 'agent') return 'Ask anything... (Ctrl+L)'
  if (selectedMode.value === 'gather') return 'Ask about your code...'
  return 'Chat...'
}

function formatToolName(name) {
  return name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
}

const updateInput = () => {
  if (inputRef.value) {
    inputMessage.value = inputRef.value.innerText || ''
  }
}

const handleKeydown = (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    sendPrompt()
  }
}

const handlePaste = (e) => {
  e.preventDefault()
  const text = e.clipboardData.getData('text/plain')
  document.execCommand('insertText', false, text)
}

const removeContext = (idx) => {
  contextItems.value.splice(idx, 1)
}

const toggleModeMenu = () => {
  showModeMenu.value = !showModeMenu.value
}

const selectMode = async (mode) => {
  try {
    if (window.monarco?.ai?.setMode) {
      await window.monarco.ai.setMode(mode)
    }
    selectedMode.value = mode
    selectedModeLabel.value = availableModes.value[mode]?.name || mode
    showModeMenu.value = false
  } catch (e) {
    console.error('Erro ao mudar modo:', e)
  }
}

// Smooth scroll to bottom
const scrollToBottom = () => {
  if (chatContainer.value) {
    chatContainer.value.scrollTo({
      top: chatContainer.value.scrollHeight,
      behavior: 'smooth'
    })
  }
}

// Funções para o modal de Diff Preview
const handleAcceptDiff = async () => {
  try {
    const { filePath, newCode, fileName } = diffPreviewData.value
    
    await window.monarco.ai.executeTool('write_file', {
      path: filePath,
      content: newCode
    })
    
    // Atualizar o conteúdo no editor se o arquivo estiver aberto
    window.monarcoEditor?.updateFileContent?.(filePath, newCode)
    
    messages.value.push({
      role: 'assistant',
      content: `✅ Applied changes to \`${fileName}\``
    })
    
    showDiffPreview.value = false
    await nextTick()
    scrollToBottom()
  } catch (error) {
    console.error('Erro ao aplicar código:', error)
    messages.value.push({
      role: 'assistant',
      content: `❌ Erro ao aplicar: ${error.message}`
    })
    showDiffPreview.value = false
    await nextTick()
    scrollToBottom()
  }
}

const handleRejectDiff = () => {
  showDiffPreview.value = false
  messages.value.push({
    role: 'assistant',
    content: `❎ Mudanças rejeitadas. O arquivo não foi alterado.`
  })
  nextTick().then(scrollToBottom)
}

const sendPrompt = async () => {
  const textContent = inputRef.value?.innerText?.trim() || ''
  if (!textContent || isLoading.value) return

  messages.value.push({ role: 'user', content: textContent })
  inputMessage.value = ''
  
  nextTick(() => {
    if (inputRef.value) {
      inputRef.value.innerHTML = ''
      inputRef.value.focus()
    }
    scrollToBottom()
  })
  
  isLoading.value = true
  currentToolCalls.value = []
  typingMessageIndex = messages.value.length
  messages.value.push({ role: 'assistant', content: '' })
  
  await nextTick()
  scrollToBottom()

  try {
    const result = await window.monarco.ai.chat(textContent)
    
    messages.value[typingMessageIndex] = { 
      role: 'assistant', 
      content: result.content || 'Desculpe, não consegui gerar uma resposta.',
      toolCalls: currentToolCalls.value.length > 0 ? [...currentToolCalls.value] : undefined
    }

    await nextTick()
    scrollToBottom()
  } catch (error) {
    console.error('Erro ao enviar mensagem:', error)
    messages.value[typingMessageIndex] = { 
      role: 'assistant', 
      content: `Erro: ${error.message || 'Erro desconhecido'}` 
    }
  } finally {
    isLoading.value = false
    currentToolCalls.value = []
  }
}

const clearChat = async () => {
  try {
    await window.monarco.ai.clear()
  } catch (e) {
    console.error('Erro ao limpar histórico:', e)
  }
  
  const systemMessage = messages.value.find(m => m.role === 'system')
  messages.value = systemMessage ? [systemMessage] : []
  messages.value.push({ role: 'assistant', content: 'Como posso ajudar?' })
  currentToolCalls.value = []
  nextTick().then(scrollToBottom)
}

const parseMessage = (text) => {
  if (!text) return ''
  try {
    let html = marked.parse(text)
    
    let codeBlockIndex = 0
    
    // Add Apply button to ALL code blocks
    html = html.replace(
      /<pre><code(?:\s+class="language-(\w+)")?>(([\s\S]*?))<\/code><\/pre>/g,
      (match, lang, code, innerCode) => {
        const decodedCode = (innerCode || code)
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&amp;/g, '&')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
        
        // Detectar caminho do arquivo de várias formas
        const fileMatch = 
          decodedCode.match(/^\/\/\s*File:\s*(.+)$/m) ||
          decodedCode.match(/^#\s*File:\s*(.+)$/m) ||
          decodedCode.match(/^\/\*\*?\s*File:\s*(.+?)\s*\*\//m) ||
          decodedCode.match(/^<!--\s*File:\s*(.+?)\s*-->/m) ||
          // Detectar caminhos absolutos ou relativos no início
          decodedCode.match(/^(\/[\w\-./]+\.\w+)$/m) ||
          decodedCode.match(/^([\w\-./]+\.\w{1,6})\s*$/m)
        
        let filePath = fileMatch ? fileMatch[1].trim() : null
        
        // Limpar o path se necessário
        if (filePath) {
          filePath = filePath.replace(/["'`]/g, '')
        }
        
        const displayLang = lang || 'code'
        const displayPath = filePath ? filePath.split('/').pop() : displayLang.toUpperCase()
        const blockId = `code-block-${codeBlockIndex++}`
        
        // Armazenar o código para acesso posterior
        if (typeof window !== 'undefined') {
          window._codeBlocks = window._codeBlocks || {}
          window._codeBlocks[blockId] = {
            code: decodedCode,
            filePath: filePath,
            lang: displayLang
          }
        }
        
        return `
          <div class="code-block" data-block-id="${blockId}">
            <div class="code-header">
              <span class="code-label">${displayPath}</span>
              <div class="code-actions">
                <button class="code-action-btn copy-btn" onclick="navigator.clipboard.writeText(window._codeBlocks['${blockId}'].code).then(() => { this.textContent = 'Copied!'; setTimeout(() => this.textContent = 'Copy', 1500) })">
                  Copy
                </button>
                <button class="code-action-btn apply-btn" onclick="window.applyCodeBlock('${blockId}')">
                  Apply
                </button>
              </div>
            </div>
            <pre><code class="language-${displayLang}">${code}</code></pre>
          </div>
        `
      }
    )
    
    return html
  } catch (e) {
    console.error('Erro ao parsear markdown:', e)
    return text
  }
}

onMounted(() => {
  scrollToBottom()
  
  if (window.monarco?.ai?.getModes) {
    window.monarco.ai.getModes().then((modes) => {
      if (modes) availableModes.value = modes
    }).catch(console.error)
  }

  if (window.monarco?.aiProfiles?.list) {
    loadTerminalProfilesFromStore()
  }
  if (window.monarco?.aiSessions?.list) {
    refreshAiSavedSessions()
  }
  if (window.monarco?.workspace?.getFolders) {
    loadWorkspaceFoldersForAi()
  }
  if (window.monarco?.workspace?.onChanged) {
    window.monarco.workspace.onChanged((info) => {
      applyWorkspaceFoldersInfo(info)
    })
  }
  if (window.monarco?.aiProfiles?.onChanged) {
    window.monarco.aiProfiles.onChanged(() => {
      loadTerminalProfilesFromStore()
    })
  }
  if (window.monarco?.aiSessions?.onChanged) {
    window.monarco.aiSessions.onChanged(() => {
      refreshAiSavedSessions()
    })
  }
  
  const handleClickOutside = (e) => {
    if (showModeMenu.value && !e.target.closest('.mode-selector')) {
      showModeMenu.value = false
    }
    if (showAiSavedMenu.value && !e.target.closest('.panel-saved-menu-wrap')) {
      showAiSavedMenu.value = false
    }
  }
  document.addEventListener('click', handleClickOutside)
  document.addEventListener('keydown', handleAiTerminalContextKeydown)
  
  // Apply code handler - agora mostra diff preview primeiro
  window.applyCodeBlock = async (blockId) => {
    try {
      const blockData = window._codeBlocks?.[blockId]
      if (!blockData) {
        console.error('Bloco de código não encontrado:', blockId)
        return
      }
      
      let { code, filePath, lang } = blockData
      
      // Se não tem caminho especificado, tentar encontrar de outras formas
      if (!filePath) {
        // 1. Tentar usar o arquivo atualmente focado no editor
        const currentFile = window.monarcoEditor?.getCurrentFile?.()
        
        if (currentFile) {
          // Verificar se a extensão do arquivo atual é compatível com a linguagem
          const currentExt = currentFile.split('.').pop()?.toLowerCase()
          const langExts = {
            'javascript': ['js', 'mjs', 'cjs'],
            'typescript': ['ts', 'tsx'],
            'python': ['py'],
            'html': ['html', 'htm'],
            'css': ['css', 'scss', 'sass', 'less'],
            'json': ['json'],
            'vue': ['vue'],
            'jsx': ['jsx', 'tsx'],
            'java': ['java'],
            'c': ['c', 'h'],
            'cpp': ['cpp', 'cc', 'cxx', 'hpp'],
            'go': ['go'],
            'rust': ['rs'],
            'php': ['php'],
            'ruby': ['rb'],
            'shell': ['sh', 'bash', 'zsh'],
            'sql': ['sql'],
            'markdown': ['md'],
            'yaml': ['yml', 'yaml'],
            'xml': ['xml']
          }
          
          const compatibleExts = langExts[lang?.toLowerCase()] || []
          const isCompatible = compatibleExts.length === 0 || compatibleExts.includes(currentExt)
          
          if (isCompatible) {
            filePath = currentFile
          }
        }
      }
      
      // 2. Se ainda não tem caminho, tentar buscar pelo nome do arquivo no código
      if (!filePath) {
        // Procurar por padrões comuns de referência a arquivos no código
        const fileNamePatterns = [
          /\/\/.*?([\w\-]+\.\w{1,6})\s*$/m,
          /#.*?([\w\-]+\.\w{1,6})\s*$/m,
          /\/\*.*?([\w\-]+\.\w{1,6}).*?\*\//m
        ]
        
        for (const pattern of fileNamePatterns) {
          const match = code.match(pattern)
          if (match) {
            const fileName = match[1]
            // Buscar no projeto
            const foundPath = await window.monarcoEditor?.findFile?.(fileName)
            if (foundPath) {
              filePath = foundPath
              break
            }
          }
        }
      }
      
      // 3. Se ainda não tem caminho, mostrar erro informativo
      if (!filePath) {
        messages.value.push({
          role: 'assistant',
          content: `⚠️ **Não foi possível aplicar o código**

O código não especifica o arquivo de destino e nenhum arquivo compatível está aberto.

**Soluções:**
1. Abra o arquivo de destino em uma aba e clique em Apply novamente
2. Peça para a IA especificar o arquivo: \"melhore o arquivo app.js\" ou \"edite src/main.js\"`
        })
        await nextTick()
        scrollToBottom()
        return
      }
      
      // Remover a linha do File: se existir
      code = code
        .replace(/^\/\/\s*File:.*\n?/m, '')
        .replace(/^#\s*File:.*\n?/m, '')
        .replace(/^\/\*\*?\s*File:.*?\*\/\n?/m, '')
        .replace(/^<!--\s*File:.*?-->\n?/m, '')
        .trim()
      
      // Buscar o conteúdo original do arquivo para mostrar diff
      let originalCode = ''
      try {
        originalCode = await window.monarco.readTextFile(filePath) || ''
      } catch (e) {
        // Arquivo novo, sem conteúdo original
        originalCode = ''
      }
      
      // Se há mudanças, mostrar preview do diff
      if (hasChanges(originalCode, code)) {
        diffPreviewData.value = {
          originalCode,
          newCode: code,
          filePath,
          fileName: filePath.split('/').pop(),
          blockId
        }
        showDiffPreview.value = true
      } else {
        // Sem mudanças, apenas informar
        messages.value.push({
          role: 'assistant',
          content: `ℹ️ O código é idêntico ao arquivo atual. Nenhuma mudança necessária.`
        })
        await nextTick()
        scrollToBottom()
      }
    } catch (error) {
      console.error('Erro ao preparar aplicação:', error)
      messages.value.push({
        role: 'assistant',
        content: `❌ Erro ao preparar: ${error.message}`
      })
      await nextTick()
      scrollToBottom()
    }
  }
  
  // Legacy handler (manter compatibilidade)
  window.applyCode = async (filePath) => {
    try {
      const lastAssistantMsg = [...messages.value].reverse().find(m => m.role === 'assistant')
      if (!lastAssistantMsg) return
      
      const codeRegex = new RegExp(`\`\`\`\\w*\\s*(?:\\/\\/|#|\\/\\*\\*?)\\s*File:\\s*${filePath.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}[^\\n]*\\n([\\s\\S]*?)\`\`\``, 'i')
      const match = lastAssistantMsg.content.match(codeRegex)
      
      if (!match) {
        console.error('Código não encontrado para:', filePath)
        return
      }
      
      const code = match[1].trim()
      
      await window.monarco.ai.executeTool('write_file', {
        path: filePath,
        content: code
      })
      
      messages.value.push({
        role: 'assistant',
        content: `✅ Applied changes to \`${filePath}\``
      })
      
      await nextTick()
      scrollToBottom()
    } catch (error) {
      console.error('Erro ao aplicar código:', error)
    }
  }
  
  // Tool call listener
  if (window.monarco?.ai?.onToolCall) {
    cleanupToolCallListener = window.monarco.ai.onToolCall((toolInfo) => {
      const existingIndex = currentToolCalls.value.findIndex(t => t.name === toolInfo.name)
      if (existingIndex >= 0) {
        currentToolCalls.value[existingIndex] = toolInfo
      } else {
        currentToolCalls.value.push(toolInfo)
      }
      nextTick().then(scrollToBottom)
    })
  }
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleAiTerminalContextKeydown)
  if (cleanupToolCallListener) {
    cleanupToolCallListener()
    cleanupToolCallListener = null
  }
  disposeAiTerminal({ destroyPty: true })
})

watch(() => props.isOpen, (newVal) => {
  if (!newVal) emit('close')
})

watch(activeTab, async (tab) => {
  if (tab === 'terminal') {
    await nextTick()
    await ensureAtLeastOneAiTerminal()
    if (activeAiTerminalId.value) {
      mountAiTerminal(activeAiTerminalId.value)
    }
  }
})

watch(selectedTerminalProfileId, async (id, prev) => {
  if (!terminalProfilesLoaded.value) return
  if (id === prev) return
  try {
    await setActiveTerminalProfile(id || '')
  } catch {}
})

function handleAiTerminalContextKeydown(e) {
  if (!aiTerminalContextMenu.value.open) return
  if (e.key === 'Escape') {
    e.preventDefault()
    closeAiTerminalContextMenu()
  }
}
</script>

<style scoped>
/* Void-style Chat Panel */
.void-chat-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0; /* ESSENCIAL para scroll funcionar em flex */
  background: var(--panel);
  border-left: 1px solid var(--border);
  font-size: 13px;
  overflow: hidden;
}

.panel-tabs {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: center;
  padding: 10px 12px;
  border-bottom: 1px solid var(--border);
  background: var(--panel);
}

.panel-tabs-left {
  display: inline-flex;
  gap: 6px;
}

.panel-tabs-right {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.panel-profile-select {
  width: 220px;
  max-width: 32vw;
  padding: 6px 10px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.02);
  color: var(--text);
  font-size: 12px;
  outline: none;
}

.panel-profile-select:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.panel-actions {
  display: inline-flex;
  gap: 6px;
}

.panel-saved-menu-wrap {
  position: relative;
}

.panel-saved-menu {
  position: absolute;
  right: 0;
  top: 40px;
  width: 320px;
  max-width: 70vw;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 6px;
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.45);
  z-index: 10001;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.panel-saved-item {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 10px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.02);
  color: var(--text);
  cursor: pointer;
  text-align: left;
}

.panel-saved-item:hover {
  background: rgba(255, 255, 255, 0.06);
}

.panel-saved-left {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.panel-saved-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.panel-saved-meta {
  font-size: 11px;
  color: var(--muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.panel-saved-action {
  width: 24px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  color: var(--text);
  background: rgba(0, 122, 204, 0.12);
  border: 1px solid rgba(0, 122, 204, 0.35);
  flex-shrink: 0;
}

.panel-icon-btn {
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.02);
  color: var(--text);
  cursor: pointer;
}

.panel-icon-btn:hover {
  background: rgba(255, 255, 255, 0.06);
}

.panel-icon-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.panel-icon-btn-primary {
  border-color: rgba(0, 122, 204, 0.5);
  background: rgba(0, 122, 204, 0.12);
}

.panel-icon-btn-primary:hover {
  background: rgba(0, 122, 204, 0.20);
}

.panel-tab {
  padding: 6px 10px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.03);
  color: var(--text);
  font-size: 12px;
  cursor: pointer;
}

.panel-tab:hover {
  background: rgba(255, 255, 255, 0.06);
}

.panel-tab.active {
  border-color: rgba(0, 122, 204, 0.5);
  background: rgba(0, 122, 204, 0.15);
}

.terminal-view {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.ai-terminal-container {
  flex: 1;
  min-height: 0;
  background: var(--bg);
}

.ai-terminal-tabs {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-bottom: 1px solid var(--border);
  background: transparent;
  overflow-x: auto;
}

.ai-terminal-tab {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  white-space: nowrap;
  min-width: 0;
  max-width: 260px;
  justify-content: space-between;
}

.ai-terminal-tab-main {
  display: inline-flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
}

.ai-terminal-tab:hover {
  background: rgba(255, 255, 255, 0.05);
  color: var(--text);
}

.ai-terminal-tab.active {
  background: rgba(0, 122, 204, 0.12);
  color: var(--text);
  box-shadow: inset 0 -2px 0 rgba(0, 122, 204, 0.65);
}

.ai-terminal-tab-name {
  font-size: 12px;
  font-weight: 500;
  color: currentColor;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 140px;
}

.ai-terminal-tab-meta {
  font-size: 11px;
  color: var(--muted);
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  opacity: 0.65;
}

.ai-terminal-tab-close {
  width: 18px;
  height: 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  color: var(--muted);
  opacity: 0;
}

.ai-terminal-tab:hover .ai-terminal-tab-close {
  opacity: 0.9;
}

.ai-terminal-tab-close:hover {
  background: rgba(255, 255, 255, 0.08);
  color: var(--text);
}

.terminal-context-overlay {
  position: fixed;
  inset: 0;
  z-index: 90;
}

.terminal-context-menu {
  position: fixed;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 6px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.35);
  min-width: 160px;
}

.terminal-context-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 8px 10px;
  border: none;
  background: transparent;
  color: var(--text);
  font-size: 13px;
  text-align: left;
  cursor: pointer;
  border-radius: 8px;
  transition: background 0.1s ease, color 0.1s ease;
}

.terminal-context-item:hover:not(:disabled) {
  background: var(--list-hover);
}

.terminal-context-item:disabled {
  color: var(--muted);
  cursor: not-allowed;
  opacity: 0.5;
}

.terminal-context-left {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.terminal-context-icon {
  color: var(--muted);
}

.terminal-context-item:hover:not(:disabled) .terminal-context-icon {
  color: var(--text);
}

.terminal-context-shortcut {
  font-size: 11px;
  color: var(--muted);
}

.profiles-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10002;
}

.profiles-modal {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 12px;
  width: 92vw;
  max-width: 96vw;
  height: 85vh;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
  position: relative;
}

.profiles-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 18px;
  border-bottom: 1px solid var(--border);
}

.profiles-modal-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
  display: inline-flex;
  align-items: center;
  gap: 10px;
}

.profiles-unsaved-badge {
  font-size: 11px;
  color: #f85149;
  border: 1px solid rgba(248, 81, 73, 0.45);
  background: rgba(248, 81, 73, 0.12);
  padding: 3px 8px;
  border-radius: 999px;
}

.profiles-modal-close {
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  color: var(--muted);
  font-size: 20px;
  cursor: pointer;
  border-radius: 6px;
}

.profiles-modal-close:hover {
  background: rgba(255, 255, 255, 0.08);
  color: var(--text);
}

.profiles-modal-content {
  padding: 16px 18px;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.profiles-unsaved-note {
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid rgba(248, 81, 73, 0.35);
  background: rgba(248, 81, 73, 0.10);
  color: var(--text);
  font-size: 12px;
}

.profiles-layout {
  display: grid;
  grid-template-columns: 260px 1fr;
  gap: 14px;
  min-height: 420px;
}

.profiles-sidebar {
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.02);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.profiles-sidebar-header {
  padding: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.profiles-sidebar-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text);
}

.profiles-sidebar-buttons {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.profiles-icon-btn {
  padding: 6px 10px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.03);
  color: var(--text);
  font-size: 12px;
  cursor: pointer;
}

.profiles-icon-btn:hover {
  background: rgba(255, 255, 255, 0.06);
}

.profiles-list {
  padding: 8px;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-height: 0;
}

.profiles-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  width: 100%;
  padding: 10px 10px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.02);
  color: var(--text);
  cursor: pointer;
  text-align: left;
}

.profiles-item:hover {
  background: rgba(255, 255, 255, 0.05);
}

.profiles-item.active {
  border-color: rgba(0, 122, 204, 0.5);
  background: rgba(0, 122, 204, 0.12);
}

.profiles-item-main {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.profiles-item-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.profiles-item-id {
  font-size: 11px;
  color: var(--muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.profiles-item-badge {
  font-size: 11px;
  color: #34d399;
  border: 1px solid rgba(52, 211, 153, 0.25);
  background: rgba(52, 211, 153, 0.08);
  padding: 3px 8px;
  border-radius: 999px;
}

.profiles-sidebar-actions {
  display: flex;
  gap: 10px;
  padding: 10px 12px 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.profiles-editor {
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.02);
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
}

.profiles-row {
  display: grid;
  grid-template-columns: 120px 1fr;
  gap: 12px;
  align-items: center;
}

.profiles-row--textarea {
  align-items: start;
}

.profiles-label {
  font-size: 12px;
  color: var(--muted);
}

.profiles-input {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.03);
  color: var(--text);
  font-size: 12px;
  outline: none;
}

.profiles-textarea {
  width: 100%;
  min-height: 180px;
  padding: 10px 10px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.03);
  color: var(--text);
  font-size: 12px;
  outline: none;
  resize: vertical;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
}

.profiles-hint {
  font-size: 12px;
  color: var(--muted);
  line-height: 1.4;
}

.profiles-modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 14px 18px;
  border-top: 1px solid var(--border);
  flex-wrap: wrap;
}

.profiles-unsaved-actions {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 10px;
  justify-content: flex-start;
}

.profiles-unsaved-actions-text {
  font-size: 12px;
  color: var(--muted);
  margin-right: 6px;
}

.profiles-resize-handle {
  position: absolute;
  right: 8px;
  bottom: 8px;
  width: 14px;
  height: 14px;
  cursor: nwse-resize;
  opacity: 0.65;
  background:
    linear-gradient(135deg, transparent 50%, rgba(255, 255, 255, 0.35) 50%) 0 0 / 6px 6px,
    linear-gradient(135deg, transparent 50%, rgba(255, 255, 255, 0.20) 50%) 4px 4px / 6px 6px;
  border-radius: 3px;
}

.profiles-resize-handle:hover {
  opacity: 0.9;
}

.store-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10003;
}

.store-modal {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 12px;
  width: 92vw;
  max-width: 860px;
  height: 80vh;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
}

.store-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 18px;
  border-bottom: 1px solid var(--border);
}

.store-modal-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
}

.store-modal-close {
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  color: var(--muted);
  font-size: 20px;
  cursor: pointer;
  border-radius: 6px;
}

.store-modal-close:hover {
  background: rgba(255, 255, 255, 0.08);
  color: var(--text);
}

.store-modal-content {
  padding: 14px 18px;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.store-toolbar {
  display: flex;
  gap: 10px;
  align-items: center;
}

.store-note {
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.03);
  color: var(--text);
  font-size: 12px;
}

.store-scope {
  display: inline-flex;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.02);
}

.store-scope-btn {
  padding: 8px 10px;
  border: none;
  background: transparent;
  color: var(--muted);
  font-size: 12px;
  cursor: pointer;
}

.store-scope-btn.active {
  color: var(--text);
  background: rgba(0, 122, 204, 0.14);
}

.store-scope-btn:hover {
  color: var(--text);
}

.store-search {
  flex: 1;
  padding: 8px 10px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.03);
  color: var(--text);
  font-size: 12px;
  outline: none;
}

.store-refresh {
  padding: 8px 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.03);
  color: var(--text);
  font-size: 12px;
  cursor: pointer;
}

.store-refresh:hover {
  background: rgba(255, 255, 255, 0.06);
}

.store-refresh:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.store-warning {
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid rgba(248, 81, 73, 0.35);
  background: rgba(248, 81, 73, 0.10);
  color: var(--text);
  font-size: 12px;
}

.store-error {
  color: #f85149;
  font-size: 12px;
}

.store-loading {
  color: var(--muted);
  font-size: 12px;
}

.store-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.store-item {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.02);
}

.store-item-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
}

.store-item-desc {
  font-size: 12px;
  color: var(--muted);
  margin-top: 4px;
  line-height: 1.3;
}

.store-item-meta {
  font-size: 11px;
  color: var(--muted);
  margin-top: 6px;
}

.store-item-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.store-btn {
  padding: 8px 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.03);
  color: var(--text);
  font-size: 12px;
  cursor: pointer;
}

.store-btn:hover {
  background: rgba(255, 255, 255, 0.06);
}

.store-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.store-btn-primary {
  border-color: rgba(0, 122, 204, 0.5);
  background: rgba(0, 122, 204, 0.15);
}

.store-btn-primary:hover {
  background: rgba(0, 122, 204, 0.22);
}

.store-btn-inline {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.store-spinner {
  width: 12px;
  height: 12px;
  border-radius: 999px;
  border: 2px solid rgba(255, 255, 255, 0.25);
  border-top-color: rgba(0, 122, 204, 0.9);
  animation: store-spin 0.9s linear infinite;
}

@keyframes store-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.store-footer {
  padding-top: 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  font-size: 11px;
  color: var(--muted);
}

.project-picker-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(3px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10004;
}

.project-picker-modal {
  width: 520px;
  max-width: 92vw;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
  overflow: hidden;
}

.project-picker-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border-bottom: 1px solid var(--border);
}

.project-picker-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
}

.project-picker-close {
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  color: var(--muted);
  font-size: 20px;
  cursor: pointer;
  border-radius: 8px;
}

.project-picker-close:hover {
  background: rgba(255, 255, 255, 0.08);
  color: var(--text);
}

.project-picker-content {
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 55vh;
  overflow: auto;
}

.project-picker-item {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px 10px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.02);
  color: var(--text);
  text-align: left;
  cursor: pointer;
}

.project-picker-item:hover {
  background: rgba(255, 255, 255, 0.06);
}

.project-picker-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--text);
}

.project-picker-path {
  font-size: 11px;
  color: var(--muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.project-picker-footer {
  padding: 10px 12px;
  border-top: 1px solid var(--border);
  display: flex;
  justify-content: flex-end;
}

.project-picker-btn {
  padding: 8px 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.03);
  color: var(--text);
  font-size: 12px;
  cursor: pointer;
}

.project-picker-btn:hover {
  background: rgba(255, 255, 255, 0.06);
}

.profiles-btn {
  padding: 8px 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.03);
  color: var(--text);
  font-size: 12px;
  cursor: pointer;
}

.profiles-btn:hover {
  background: rgba(255, 255, 255, 0.06);
}

.profiles-btn-primary {
  border-color: rgba(0, 122, 204, 0.5);
  background: rgba(0, 122, 204, 0.15);
}

.profiles-btn-primary:hover {
  background: rgba(0, 122, 204, 0.25);
}

.profiles-btn-danger {
  border-color: rgba(248, 81, 73, 0.45);
  background: rgba(248, 81, 73, 0.12);
  color: #f85149;
}

.profiles-btn-danger:hover {
  background: rgba(248, 81, 73, 0.18);
}

/* Chat Container - Scrollable */
.chat-container {
  flex: 1;
  min-height: 0; /* ESSENCIAL para scroll funcionar em flex */
  overflow-y: auto;
  overflow-x: hidden;
  scroll-behavior: smooth;
}

.chat-container::-webkit-scrollbar {
  width: 6px;
}

.chat-container::-webkit-scrollbar-track {
  background: transparent;
}

.chat-container::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
}

.messages-wrapper {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* Messages */
.message {
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}

.user-message {
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 8px;
  border-left: 2px solid var(--accent);
}

.assistant-message {
  padding: 0;
}

.message-content {
  color: var(--text);
  line-height: 1.6;
  word-break: break-word;
}

/* Tool Calls Summary (after completion) */
.tool-calls-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 12px;
}

.tool-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  background: rgba(52, 211, 153, 0.1);
  border: 1px solid rgba(52, 211, 153, 0.2);
  border-radius: 12px;
  font-size: 11px;
  color: #34d399;
}

.tool-check {
  color: #34d399;
}

/* Tool Calls Live (during execution) */
.tool-calls-live {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 8px;
}

.tool-call-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 6px;
  font-size: 12px;
}

.tool-call-item.executing {
  border-left: 2px solid var(--accent);
}

.tool-call-item.completed {
  border-left: 2px solid #34d399;
}

.tool-spinner {
  animation: spin 1s linear infinite;
  color: var(--accent);
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.tool-done {
  color: #34d399;
}

.tool-name {
  color: var(--text);
}

/* Thinking Indicator */
.thinking-indicator {
  display: flex;
  gap: 4px;
  padding: 8px 0;
}

.thinking-dot {
  width: 6px;
  height: 6px;
  background: var(--muted);
  border-radius: 50%;
  animation: pulse 1.4s ease-in-out infinite;
}

.thinking-dot:nth-child(2) { animation-delay: 0.2s; }
.thinking-dot:nth-child(3) { animation-delay: 0.4s; }

@keyframes pulse {
  0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
  40% { transform: scale(1); opacity: 1; }
}

/* Input Area */
.input-area {
  padding: 12px 16px 16px;
  background: var(--panel);
  border-top: 1px solid var(--border);
}

.input-container {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 12px;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.input-container.focused {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px rgba(0, 122, 204, 0.15);
}

/* Context Bar */
.context-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border);
}

.context-item {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
  font-size: 11px;
}

.context-remove {
  background: none;
  border: none;
  color: var(--muted);
  cursor: pointer;
  padding: 0 2px;
  font-size: 14px;
}

.context-remove:hover {
  color: #ef4444;
}

/* Input Row */
.input-row {
  padding: 10px 12px;
}

.text-input {
  min-height: 20px;
  max-height: 200px;
  outline: none;
  color: var(--text);
  font-size: 13px;
  line-height: 1.5;
  overflow-y: auto;
  word-break: break-word;
  white-space: pre-wrap;
}

.text-input:empty:before {
  content: attr(data-placeholder);
  color: var(--muted);
  pointer-events: none;
}

/* Bottom Bar */
.bottom-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.left-controls,
.right-controls {
  display: flex;
  align-items: center;
  gap: 6px;
}

/* Mode Selector */
.mode-selector {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 6px;
  cursor: pointer;
  position: relative;
  font-size: 12px;
  color: var(--text);
}

.mode-selector:hover {
  background: rgba(255, 255, 255, 0.06);
}

.chevron {
  color: var(--muted);
}

/* Mode Menu */
.mode-menu {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 0;
  min-width: 220px;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  z-index: 9999;
  overflow: hidden;
}

.mode-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px 12px;
  cursor: pointer;
  position: relative;
  transition: background 0.1s ease;
}

.mode-item:hover {
  background: rgba(255, 255, 255, 0.04);
}

.mode-item.active {
  background: rgba(0, 122, 204, 0.1);
}

.mode-name {
  font-size: 12px;
  font-weight: 500;
  color: var(--text);
}

.mode-desc {
  font-size: 11px;
  color: var(--muted);
}

.mode-check {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--accent);
}

/* Model Display */
.model-display {
  padding: 4px 8px;
  font-size: 11px;
  color: var(--muted);
  background: rgba(255, 255, 255, 0.02);
  border-radius: 4px;
}

/* Icon Button */
.icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: var(--muted);
  cursor: pointer;
  transition: all 0.1s ease;
}

.icon-btn:hover {
  background: rgba(255, 255, 255, 0.06);
  color: var(--text);
}

/* Send Button */
.send-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  border-radius: 6px;
  color: var(--bg);
  cursor: pointer;
  transition: all 0.1s ease;
}

.send-btn.active {
  background: white;
  color: black;
}

.send-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* Message Content Styles */
.message-content :deep(p) {
  margin: 0 0 8px 0;
}

.message-content :deep(p:last-child) {
  margin-bottom: 0;
}

.message-content :deep(code) {
  font-family: 'SF Mono', Monaco, Consolas, monospace;
  font-size: 0.9em;
  padding: 2px 5px;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 3px;
  color: #e5c07b;
}

.message-content :deep(pre) {
  margin: 8px 0;
  padding: 0;
  background: transparent;
  border: none;
}

.message-content :deep(pre code) {
  display: block;
  padding: 12px;
  background: var(--bg);
  border-radius: 6px;
  overflow-x: auto;
  font-size: 12px;
  line-height: 1.5;
  color: var(--text);
}

.message-content :deep(ul),
.message-content :deep(ol) {
  margin: 8px 0;
  padding-left: 20px;
}

.message-content :deep(li) {
  margin: 4px 0;
}

.message-content :deep(a) {
  color: var(--accent);
  text-decoration: none;
}

.message-content :deep(a:hover) {
  text-decoration: underline;
}

.message-content :deep(strong) {
  font-weight: 600;
  color: var(--text);
}

/* Code Block with Actions */
.message-content :deep(.code-block) {
  margin: 12px 0;
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
  background: var(--bg);
}

.message-content :deep(.code-header) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 12px;
  background: rgba(255, 255, 255, 0.02);
  border-bottom: 1px solid var(--border);
}

.message-content :deep(.code-label) {
  font-size: 11px;
  color: var(--muted);
  font-family: 'SF Mono', Monaco, Consolas, monospace;
}

.message-content :deep(.code-actions) {
  display: flex;
  gap: 6px;
}

.message-content :deep(.code-action-btn) {
  padding: 3px 10px;
  font-size: 11px;
  font-weight: 500;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.1s ease;
}

.message-content :deep(.copy-btn) {
  background: rgba(255, 255, 255, 0.06);
  color: var(--text);
}

.message-content :deep(.copy-btn:hover) {
  background: rgba(255, 255, 255, 0.1);
}

.message-content :deep(.apply-btn) {
  background: var(--accent);
  color: white;
}

.message-content :deep(.apply-btn:hover) {
  filter: brightness(1.1);
}

.message-content :deep(.code-block pre) {
  margin: 0;
  padding: 12px;
}

.message-content :deep(.code-block pre code) {
  padding: 0;
  background: transparent;
  border-radius: 0;
}

/* Diff Preview Modal */
.diff-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10001;
  animation: fade-in 0.15s ease;
}

@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

.diff-modal {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 12px;
  width: 90vw;
  max-width: 1000px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
  animation: slide-up 0.2s ease;
}

@keyframes slide-up {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.diff-modal-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
}

.diff-modal-header h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
}

.diff-modal-file {
  flex: 1;
  font-size: 12px;
  color: var(--muted);
  font-family: 'Monaco', 'Menlo', monospace;
}

.diff-modal-close {
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  color: var(--muted);
  font-size: 20px;
  cursor: pointer;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
}

.diff-modal-close:hover {
  background: rgba(255, 255, 255, 0.1);
  color: var(--text);
}

.diff-modal-content {
  flex: 1;
  overflow: auto;
  padding: 0;
}

.diff-modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 20px;
  border-top: 1px solid var(--border);
}

.diff-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.diff-btn-accept {
  background: #238636;
  color: white;
}

.diff-btn-accept:hover {
  background: #2ea043;
}

.diff-btn-reject {
  background: rgba(255, 255, 255, 0.1);
  color: var(--text);
}

.diff-btn-reject:hover {
  background: rgba(255, 255, 255, 0.15);
}
</style>
