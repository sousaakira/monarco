<template>
  <div class="settings-overlay" @click.self="close">
    <div class="settings-panel">
      <!-- Header -->
      <div class="settings-header">
        <div class="settings-title">
          <span class="settings-icon">⚙️</span>
          <span>Configurações</span>
        </div>
        <button class="settings-close" @click="close" title="Fechar">×</button>
      </div>

      <!-- Search -->
      <div class="settings-search">
        <input 
          type="text" 
          v-model="searchQuery" 
          placeholder="Buscar configurações..."
          class="search-input"
        />
      </div>

      <!-- Content -->
      <div class="settings-content">
        <!-- Sidebar Categories -->
        <div class="settings-sidebar">
          <div 
            v-for="category in categories" 
            :key="category.id"
            class="sidebar-item"
            :class="{ active: activeCategory === category.id }"
            @click="activeCategory = category.id"
          >
            <span class="sidebar-icon">{{ category.icon }}</span>
            <span class="sidebar-label">{{ category.label }}</span>
          </div>
        </div>

        <!-- Settings List -->
        <div class="settings-list">
          <!-- Editor Settings -->
          <div v-show="activeCategory === 'editor' || searchQuery" class="settings-section">
            <h3 class="section-title">Editor</h3>
            
            <div class="setting-item">
              <div class="setting-info">
                <label class="setting-label">Tamanho da Fonte</label>
                <p class="setting-description">Controla o tamanho da fonte em pixels do editor.</p>
              </div>
              <div class="setting-control">
                <input 
                  type="number" 
                  v-model.number="localSettings.editor.fontSize" 
                  min="10" 
                  max="30"
                  class="control-input control-input--small"
                />
              </div>
            </div>

            <div class="setting-item">
              <div class="setting-info">
                <label class="setting-label">Quebra de Linha</label>
                <p class="setting-description">Controla como o editor deve quebrar linhas longas.</p>
              </div>
              <div class="setting-control">
                <select v-model="localSettings.editor.wordWrap" class="control-select">
                  <option value="off">Desativado</option>
                  <option value="on">Ativado</option>
                  <option value="wordWrapColumn">Na coluna</option>
                  <option value="bounded">Limitado</option>
                </select>
              </div>
            </div>

            <div class="setting-item">
              <div class="setting-info">
                <label class="setting-label">Tamanho do Tab</label>
                <p class="setting-description">Número de espaços por indentação.</p>
              </div>
              <div class="setting-control">
                <input 
                  type="number" 
                  v-model.number="localSettings.editor.tabSize" 
                  min="1" 
                  max="8"
                  class="control-input control-input--small"
                />
              </div>
            </div>

            <div class="setting-item">
              <div class="setting-info">
                <label class="setting-label">Minimap</label>
                <p class="setting-description">Exibir minimap na lateral do editor.</p>
              </div>
              <div class="setting-control">
                <label class="control-toggle">
                  <input type="checkbox" v-model="localSettings.editor.minimap" />
                  <span class="toggle-slider"></span>
                </label>
              </div>
            </div>

            <div class="setting-item">
              <div class="setting-info">
                <label class="setting-label">Números de Linha</label>
                <p class="setting-description">Exibir números de linha no editor.</p>
              </div>
              <div class="setting-control">
                <select v-model="localSettings.editor.lineNumbers" class="control-select">
                  <option value="on">Ativado</option>
                  <option value="off">Desativado</option>
                  <option value="relative">Relativo</option>
                </select>
              </div>
            </div>
          </div>

          <!-- AI Settings -->
          <div v-show="activeCategory === 'ai' || searchQuery" class="settings-section">
            <h3 class="section-title">Assistente IA</h3>
            
            <div class="setting-item">
              <div class="setting-info">
                <label class="setting-label">URL da API</label>
                <p class="setting-description">Endereço do servidor de IA (compatível com OpenAI).</p>
              </div>
              <div class="setting-control setting-control--wide">
                <input 
                  type="text" 
                  v-model="localSettings.ai.apiUrl" 
                  placeholder="http://localhost:8000/v1/chat/completions"
                  class="control-input"
                />
              </div>
            </div>

            <div class="setting-item">
              <div class="setting-info">
                <label class="setting-label">Modelo</label>
                <p class="setting-description">Nome do modelo de IA a ser utilizado.</p>
              </div>
              <div class="setting-control setting-control--wide">
                <input 
                  type="text" 
                  v-model="localSettings.ai.model" 
                  placeholder="Qwen/Qwen2.5-Coder-3B-Instruct"
                  class="control-input"
                />
              </div>
            </div>

            <div class="setting-item">
              <div class="setting-info">
                <label class="setting-label">Temperatura</label>
                <p class="setting-description">Controla a criatividade das respostas (0 = determinístico, 1 = criativo).</p>
              </div>
              <div class="setting-control">
                <input 
                  type="number" 
                  v-model.number="localSettings.ai.temperature" 
                  min="0" 
                  max="2"
                  step="0.1"
                  class="control-input control-input--small"
                />
              </div>
            </div>

            <div class="setting-item">
              <div class="setting-info">
                <label class="setting-label">Máximo de Tokens</label>
                <p class="setting-description">Limite máximo de tokens na resposta.</p>
              </div>
              <div class="setting-control">
                <input 
                  type="number" 
                  v-model.number="localSettings.ai.maxTokens" 
                  min="100" 
                  max="8000"
                  step="100"
                  class="control-input control-input--small"
                />
              </div>
            </div>
          </div>

          <!-- Appearance Settings -->
          <div v-show="activeCategory === 'appearance' || searchQuery" class="settings-section">
            <h3 class="section-title">Aparência</h3>
            
            <div class="setting-item">
              <div class="setting-info">
                <label class="setting-label">Tema</label>
                <p class="setting-description">Selecione o tema de cores da interface.</p>
              </div>
              <div class="setting-control">
                <select v-model="localSettings.appearance.theme" class="control-select">
                  <option value="dark">Escuro</option>
                  <option value="light">Claro</option>
                  <option value="system">Sistema</option>
                </select>
              </div>
            </div>

            <div class="setting-item">
              <div class="setting-info">
                <label class="setting-label">Posição dos Botões da Janela</label>
                <p class="setting-description">Posição dos botões de minimizar, maximizar e fechar.</p>
              </div>
              <div class="setting-control">
                <select v-model="localSettings.appearance.windowControlsPosition" class="control-select">
                  <option value="left">Esquerda</option>
                  <option value="right">Direita</option>
                </select>
              </div>
            </div>

            <div class="setting-item">
              <div class="setting-info">
                <label class="setting-label">Barra Lateral</label>
                <p class="setting-description">Posição da barra lateral de arquivos.</p>
              </div>
              <div class="setting-control">
                <select v-model="localSettings.appearance.sidebarPosition" class="control-select">
                  <option value="left">Esquerda</option>
                  <option value="right">Direita</option>
                </select>
              </div>
            </div>
          </div>

          <!-- Keyboard Shortcuts -->
          <div v-show="activeCategory === 'keyboard' || searchQuery" class="settings-section">
            <h3 class="section-title">Atalhos de Teclado</h3>
            
            <div class="shortcuts-list">
              <div class="shortcut-item" v-for="shortcut in shortcuts" :key="shortcut.id">
                <span class="shortcut-label">{{ shortcut.label }}</span>
                <div class="shortcut-keys">
                  <span class="kbd" v-for="key in shortcut.keys" :key="key">{{ key }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Terminal Settings -->
          <div v-show="activeCategory === 'terminal' || searchQuery" class="settings-section">
            <h3 class="section-title">Terminal</h3>
            
            <div class="setting-item">
              <div class="setting-info">
                <label class="setting-label">Tamanho da Fonte</label>
                <p class="setting-description">Controla o tamanho da fonte do terminal.</p>
              </div>
              <div class="setting-control">
                <input 
                  type="number" 
                  v-model.number="localSettings.terminal.fontSize" 
                  min="10" 
                  max="24"
                  class="control-input control-input--small"
                />
              </div>
            </div>

            <div class="setting-item">
              <div class="setting-info">
                <label class="setting-label">Família da Fonte</label>
                <p class="setting-description">Fonte utilizada no terminal.</p>
              </div>
              <div class="setting-control setting-control--wide">
                <input 
                  type="text" 
                  v-model="localSettings.terminal.fontFamily" 
                  class="control-input"
                />
              </div>
            </div>

            <div class="setting-item">
              <div class="setting-info">
                <label class="setting-label">Cursor Piscando</label>
                <p class="setting-description">Ativar animação de piscar do cursor.</p>
              </div>
              <div class="setting-control">
                <label class="control-toggle">
                  <input type="checkbox" v-model="localSettings.terminal.cursorBlink" />
                  <span class="toggle-slider"></span>
                </label>
              </div>
            </div>

            <div class="setting-item">
              <div class="setting-info">
                <label class="setting-label">Estilo do Cursor</label>
                <p class="setting-description">Formato do cursor no terminal.</p>
              </div>
              <div class="setting-control">
                <select v-model="localSettings.terminal.cursorStyle" class="control-select">
                  <option value="block">Bloco</option>
                  <option value="underline">Sublinhado</option>
                  <option value="bar">Barra</option>
                </select>
              </div>
            </div>
          </div>

          <!-- Advanced Settings -->
          <div v-show="activeCategory === 'advanced' || searchQuery" class="settings-section">
            <h3 class="section-title">Avançado</h3>
            
            <div class="setting-item">
              <div class="setting-info">
                <label class="setting-label">Diretório de Configurações</label>
                <p class="setting-description">Abrir a pasta onde as configurações são salvas (~/.monarco).</p>
              </div>
              <div class="setting-control">
                <button class="btn btn--secondary" @click="openConfigDir">Abrir Pasta</button>
              </div>
            </div>

            <div class="setting-item">
              <div class="setting-info">
                <label class="setting-label">Caminho das Configurações</label>
                <p class="setting-description">{{ configPath || 'Carregando...' }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="settings-footer">
        <button class="btn btn--secondary" @click="resetToDefaults">Restaurar Padrões</button>
        <div class="footer-actions">
          <button class="btn btn--secondary" @click="close">Cancelar</button>
          <button class="btn btn--primary" @click="save">Salvar</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'

const props = defineProps({
  isOpen: Boolean
})

const emit = defineEmits(['close', 'save'])

const searchQuery = ref('')
const activeCategory = ref('editor')

const categories = [
  { id: 'editor', label: 'Editor', icon: '📝' },
  { id: 'ai', label: 'Assistente IA', icon: '🤖' },
  { id: 'appearance', label: 'Aparência', icon: '🎨' },
  { id: 'terminal', label: 'Terminal', icon: '💻' },
  { id: 'keyboard', label: 'Atalhos', icon: '⌨️' },
  { id: 'advanced', label: 'Avançado', icon: '⚙️' }
]

const shortcuts = [
  { id: 'save', label: 'Salvar arquivo', keys: ['Ctrl', 'S'] },
  { id: 'find', label: 'Buscar no arquivo', keys: ['Ctrl', 'F'] },
  { id: 'openAI', label: 'Abrir assistente IA', keys: ['Ctrl', 'L'] },
  { id: 'terminal', label: 'Abrir/Fechar terminal', keys: ['Ctrl', '`'] },
  { id: 'settings', label: 'Abrir configurações', keys: ['Ctrl', 'Shift', ','] },
  { id: 'newFile', label: 'Novo arquivo', keys: ['Ctrl', 'N'] },
  { id: 'closeTab', label: 'Fechar aba', keys: ['Ctrl', 'W'] }
]

const defaultSettings = {
  editor: {
    fontSize: 14,
    wordWrap: 'off',
    tabSize: 2,
    minimap: true,
    lineNumbers: 'on'
  },
  ai: {
    apiUrl: 'http://192.168.1.18:8000/v1/chat/completions',
    model: 'Qwen/Qwen2.5-Coder-3B-Instruct',
    temperature: 0.2,
    maxTokens: 2048
  },
  appearance: {
    theme: 'dark',
    windowControlsPosition: 'right',
    sidebarPosition: 'left'
  },
  terminal: {
    fontSize: 13,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    cursorBlink: true,
    cursorStyle: 'block'
  }
}

const localSettings = reactive(JSON.parse(JSON.stringify(defaultSettings)))
const configPath = ref('')

const loadSettings = async () => {
  try {
    // Carregar via API do Electron
    if (window.monarco?.settings) {
      const settings = await window.monarco.settings.load()
      if (settings.editor) Object.assign(localSettings.editor, settings.editor)
      if (settings.appearance) Object.assign(localSettings.appearance, settings.appearance)
      if (settings.terminal) Object.assign(localSettings.terminal, settings.terminal)
      
      // Obter caminho das configurações
      configPath.value = await window.monarco.settings.getConfigPath()
    }
  } catch (e) {
    console.error('Erro ao carregar configurações:', e)
  }
}

const save = async () => {
  try {
    emit('save', localSettings)
    emit('close')
  } catch (e) {
    console.error('Erro ao salvar configurações:', e)
  }
}

const openConfigDir = async () => {
  try {
    if (window.monarco?.settings) {
      await window.monarco.settings.openConfigDir()
    }
  } catch (e) {
    console.error('Erro ao abrir diretório:', e)
  }
}

const close = () => {
  emit('close')
}

const resetToDefaults = () => {
  Object.assign(localSettings, JSON.parse(JSON.stringify(defaultSettings)))
}

onMounted(() => {
  loadSettings()
})
</script>

<style scoped>
.settings-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
}

.settings-panel {
  width: 900px;
  max-width: 95vw;
  height: 80vh;
  max-height: 700px;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
}

/* Header */
.settings-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
  background: var(--panel-2);
}

.settings-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 16px;
  font-weight: 600;
}

.settings-icon {
  font-size: 18px;
}

.settings-close {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: var(--muted);
  font-size: 20px;
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.15s ease;
}

.settings-close:hover {
  background: rgba(255, 255, 255, 0.08);
  color: var(--text);
}

/* Search */
.settings-search {
  padding: 12px 20px;
  border-bottom: 1px solid var(--border);
}

.search-input {
  width: 100%;
  padding: 10px 14px;
  background: var(--panel-2);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text);
  font-size: 13px;
  outline: none;
  transition: border-color 0.15s ease;
}

.search-input:focus {
  border-color: var(--accent);
}

.search-input::placeholder {
  color: var(--muted);
}

/* Content */
.settings-content {
  flex: 1;
  display: flex;
  overflow: hidden;
}

/* Sidebar */
.settings-sidebar {
  width: 200px;
  border-right: 1px solid var(--border);
  padding: 12px 8px;
  background: var(--panel-2);
}

.sidebar-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 6px;
  cursor: pointer;
  color: var(--muted);
  font-size: 13px;
  transition: all 0.15s ease;
}

.sidebar-item:hover {
  background: rgba(255, 255, 255, 0.05);
  color: var(--text);
}

.sidebar-item.active {
  background: var(--accent);
  color: #fff;
}

.sidebar-icon {
  font-size: 14px;
}

/* Settings List */
.settings-list {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
}

.settings-section {
  margin-bottom: 32px;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
  margin: 0 0 16px 0;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border);
}

.setting-item {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 12px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.setting-info {
  flex: 1;
  padding-right: 20px;
}

.setting-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--text);
  display: block;
  margin-bottom: 4px;
}

.setting-description {
  font-size: 12px;
  color: var(--muted);
  margin: 0;
  line-height: 1.4;
}

.setting-control {
  flex-shrink: 0;
}

.setting-control--wide {
  width: 300px;
}

/* Controls */
.control-input {
  padding: 8px 12px;
  background: var(--panel-2);
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text);
  font-size: 13px;
  outline: none;
  width: 100%;
  transition: border-color 0.15s ease;
}

.control-input:focus {
  border-color: var(--accent);
}

.control-input--small {
  width: 80px;
}

.control-select {
  padding: 8px 12px;
  background: var(--panel-2);
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text);
  font-size: 13px;
  outline: none;
  cursor: pointer;
  min-width: 140px;
}

.control-select:focus {
  border-color: var(--accent);
}

/* Toggle */
.control-toggle {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 24px;
}

.control-toggle input {
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--border);
  border-radius: 24px;
  transition: 0.2s;
}

.toggle-slider:before {
  position: absolute;
  content: "";
  height: 18px;
  width: 18px;
  left: 3px;
  bottom: 3px;
  background: white;
  border-radius: 50%;
  transition: 0.2s;
}

.control-toggle input:checked + .toggle-slider {
  background: var(--accent);
}

.control-toggle input:checked + .toggle-slider:before {
  transform: translateX(20px);
}

/* Shortcuts */
.shortcuts-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.shortcut-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  background: var(--panel-2);
  border-radius: 6px;
}

.shortcut-label {
  font-size: 13px;
  color: var(--text);
}

.shortcut-keys {
  display: flex;
  gap: 4px;
}

.kbd {
  padding: 4px 8px;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 4px;
  font-size: 11px;
  font-family: ui-monospace, monospace;
  color: var(--text);
}

/* Footer */
.settings-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-top: 1px solid var(--border);
  background: var(--panel-2);
}

.footer-actions {
  display: flex;
  gap: 10px;
}

.btn {
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  border: 1px solid transparent;
}

.btn--secondary {
  background: var(--panel);
  border-color: var(--border);
  color: var(--text);
}

.btn--secondary:hover {
  background: rgba(255, 255, 255, 0.08);
}

.btn--primary {
  background: var(--accent);
  color: #fff;
}

.btn--primary:hover {
  background: #1a8ad4;
}

/* Scrollbar */
.settings-list::-webkit-scrollbar {
  width: 8px;
}

.settings-list::-webkit-scrollbar-track {
  background: transparent;
}

.settings-list::-webkit-scrollbar-thumb {
  background: rgba(121, 121, 121, 0.4);
  border-radius: 4px;
}

.settings-list::-webkit-scrollbar-thumb:hover {
  background: rgba(121, 121, 121, 0.6);
}
</style>
