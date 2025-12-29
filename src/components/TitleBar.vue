<template>
  <div class="titlebar">
    <div class="titlebarLeft">
      <div v-if="windowControlsPosition === 'left'" class="windowControls">
        <button class="tbBtn close" title="Close" aria-label="Close" @click="$emit('close')">
          <span class="icon-xmark"></span>
        </button>
        <button class="tbBtn" title="Minimize" aria-label="Minimize" @click="$emit('minimize')">
          <span class="icon-window-minimize"></span>
        </button>
        <button
          class="tbBtn"
          :title="isMaximized ? 'Restore' : 'Maximize'"
          :aria-label="isMaximized ? 'Restore' : 'Maximize'"
          @click="$emit('toggle-maximize')"
        >
          <span v-if="!isMaximized" class="icon-window-maximize"></span>
          <span v-else class="icon-window-restore"></span>
        </button>
      </div>
      
      <!-- Menus do Sistema -->
      <nav class="menubar" @mouseleave="handleMenubarLeave">
        <div 
          v-for="menu in menus" 
          :key="menu.id"
          class="menu-item"
          :class="{ active: activeMenu === menu.id }"
          @click="toggleMenu(menu.id)"
          @mouseenter="handleMenuHover(menu.id)"
        >
          <span class="menu-label">{{ menu.label }}</span>
          
          <!-- Dropdown -->
          <div 
            v-if="activeMenu === menu.id" 
            class="menu-dropdown"
            @mouseenter="cancelCloseTimeout"
          >
            <template v-for="item in menu.items" :key="item.id">
              <div v-if="item.type === 'separator'" class="menu-separator"></div>
              <button 
                v-else
                class="menu-dropdown-item"
                :disabled="item.disabled"
                @click.stop="executeMenuItem(item)"
              >
                <span class="menu-dropdown-label">{{ item.label }}</span>
                <span v-if="item.shortcut" class="menu-dropdown-shortcut">{{ item.shortcut }}</span>
              </button>
            </template>
          </div>
        </div>
      </nav>
    </div>

    <div class="titlebarCenter">{{ title }}</div>

    <div class="titlebarRight">
      <div style="display: flex; gap: 0px; align-items: center; margin-right: 12px;">
        <button @click="$emit('save-all')" title="Save All" class="tbBtn" :disabled="!hasDirtyTabs">
          <span class="icon-floppy-disk"></span>
        </button>
        <button @click="$emit('save-active')" title="Save" class="tbBtn" :disabled="!hasDirtyActiveTab">
          <span class="icon-floppy-disk"></span>
        </button>
        <button @click="$emit('open-settings')" title="Settings" class="tbBtn">
          <span class="icon-gear"></span>
        </button>
      </div>
      <div v-if="windowControlsPosition === 'right'" class="windowControls">
        <button class="tbBtn" title="Minimize" aria-label="Minimize" @click="$emit('minimize')">
          <span class="icon-window-minimize"></span>
        </button>
        <button
          class="tbBtn"
          :title="isMaximized ? 'Restore' : 'Maximize'"
          :aria-label="isMaximized ? 'Restore' : 'Maximize'"
          @click="$emit('toggle-maximize')"
        >
          <span v-if="!isMaximized" class="icon-window-maximize"></span>
          <span v-else class="icon-window-restore"></span>
        </button>
        <button class="tbBtn close" title="Close" aria-label="Close" @click="$emit('close')">
          <span class="icon-xmark"></span>
        </button>
      </div>
    </div>
  </div>
  
  <!-- Overlay para fechar menu ao clicar fora -->
  <div v-if="activeMenu" class="menu-overlay" @click="closeMenu"></div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

defineProps({
  title: String,
  windowControlsPosition: String,
  isMaximized: Boolean,
  hasDirtyTabs: Boolean,
  hasDirtyActiveTab: Boolean
})

const emit = defineEmits([
  'minimize',
  'toggle-maximize',
  'close',
  'save-all',
  'save-active',
  'open-settings',
  'menu-action'
])

const activeMenu = ref(null)
let closeTimeout = null

// Definição dos menus
const menus = [
  {
    id: 'file',
    label: 'File',
    items: [
      { id: 'new-file', label: 'New File', shortcut: 'Ctrl+N', action: 'newFile' },
      { id: 'new-folder', label: 'New Folder', action: 'newFolder' },
      { type: 'separator' },
      { id: 'open-folder', label: 'Open Folder...', shortcut: 'Ctrl+O', action: 'openFolder' },
      { id: 'open-recent', label: 'Open Recent', disabled: true },
      { type: 'separator' },
      { id: 'save', label: 'Save', shortcut: 'Ctrl+S', action: 'save' },
      { id: 'save-all', label: 'Save All', shortcut: 'Ctrl+Shift+S', action: 'saveAll' },
      { type: 'separator' },
      { id: 'preferences', label: 'Preferences', shortcut: 'Ctrl+,', action: 'openSettings' },
      { type: 'separator' },
      { id: 'exit', label: 'Exit', shortcut: 'Alt+F4', action: 'exit' }
    ]
  },
  {
    id: 'edit',
    label: 'Edit',
    items: [
      { id: 'undo', label: 'Undo', shortcut: 'Ctrl+Z', action: 'undo' },
      { id: 'redo', label: 'Redo', shortcut: 'Ctrl+Y', action: 'redo' },
      { type: 'separator' },
      { id: 'cut', label: 'Cut', shortcut: 'Ctrl+X', action: 'cut' },
      { id: 'copy', label: 'Copy', shortcut: 'Ctrl+C', action: 'copy' },
      { id: 'paste', label: 'Paste', shortcut: 'Ctrl+V', action: 'paste' },
      { type: 'separator' },
      { id: 'find', label: 'Find', shortcut: 'Ctrl+F', action: 'find' },
      { id: 'replace', label: 'Replace', shortcut: 'Ctrl+H', action: 'replace' },
      { type: 'separator' },
      { id: 'select-all', label: 'Select All', shortcut: 'Ctrl+A', action: 'selectAll' }
    ]
  },
  {
    id: 'view',
    label: 'View',
    items: [
      { id: 'explorer', label: 'Explorer', shortcut: 'Ctrl+Shift+E', action: 'toggleExplorer' },
      { id: 'ai-assistant', label: 'AI Assistant', shortcut: 'Ctrl+L', action: 'toggleAIChat' },
      { id: 'terminal', label: 'Terminal', shortcut: 'Ctrl+`', action: 'toggleTerminal' },
      { type: 'separator' },
      { id: 'command-palette', label: 'Command Palette', shortcut: 'Ctrl+Shift+P', action: 'commandPalette', disabled: true },
      { type: 'separator' },
      { id: 'zoom-in', label: 'Zoom In', shortcut: 'Ctrl++', action: 'zoomIn' },
      { id: 'zoom-out', label: 'Zoom Out', shortcut: 'Ctrl+-', action: 'zoomOut' },
      { id: 'reset-zoom', label: 'Reset Zoom', shortcut: 'Ctrl+0', action: 'resetZoom' },
      { type: 'separator' },
      { id: 'fullscreen', label: 'Toggle Full Screen', shortcut: 'F11', action: 'toggleFullscreen' }
    ]
  },
  {
    id: 'help',
    label: 'Help',
    items: [
      { id: 'welcome', label: 'Welcome', action: 'welcome', disabled: true },
      { id: 'documentation', label: 'Documentation', action: 'documentation', disabled: true },
      { type: 'separator' },
      { id: 'keyboard-shortcuts', label: 'Keyboard Shortcuts', shortcut: 'Ctrl+K Ctrl+S', action: 'keyboardShortcuts', disabled: true },
      { type: 'separator' },
      { id: 'about', label: 'About', action: 'about' }
    ]
  }
]

function toggleMenu(menuId) {
  if (activeMenu.value === menuId) {
    closeMenu()
  } else {
    activeMenu.value = menuId
  }
}

function handleMenuHover(menuId) {
  // Se já existe um menu aberto, troca para o novo imediatamente
  if (activeMenu.value && activeMenu.value !== menuId) {
    cancelCloseTimeout()
    activeMenu.value = menuId
  }
}

function handleMenubarLeave() {
  // Quando sai da menubar, fecha com delay para permitir entrar no dropdown
  if (activeMenu.value) {
    closeTimeout = setTimeout(() => {
      closeMenu()
    }, 150)
  }
}

function cancelCloseTimeout() {
  if (closeTimeout) {
    clearTimeout(closeTimeout)
    closeTimeout = null
  }
}

function closeMenu() {
  cancelCloseTimeout()
  activeMenu.value = null
}

function executeMenuItem(item) {
  if (item.disabled) return
  
  closeMenu()
  
  // Ações diretas
  switch (item.action) {
    case 'save':
      emit('save-active')
      break
    case 'saveAll':
      emit('save-all')
      break
    case 'openSettings':
      emit('open-settings')
      break
    case 'exit':
      emit('close')
      break
    default:
      // Emite evento genérico para ações tratadas pelo App.vue
      emit('menu-action', item.action)
  }
}

// Fechar menu com Escape
function handleKeydown(e) {
  if (e.key === 'Escape' && activeMenu.value) {
    closeMenu()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<style scoped>
.menubar {
  display: flex;
  align-items: center;
  height: 100%;
  margin-left: 8px;
  -webkit-app-region: no-drag;
  app-region: no-drag;
  position: relative;
  z-index: 1000;
}

.menu-item {
  position: relative;
  height: 100%;
  display: flex;
  align-items: center;
}

.menu-label {
  padding: 0 8px;
  height: 100%;
  display: flex;
  align-items: center;
  font-size: 13px;
  color: var(--text);
  cursor: pointer;
  border-radius: 4px;
  transition: background 0.1s ease;
}

.menu-label:hover,
.menu-item.active .menu-label {
  background: rgba(255, 255, 255, 0.1);
}

.menu-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  min-width: 220px;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 4px 0;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
  z-index: 1000;
}

.menu-dropdown-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 6px 12px;
  border: none;
  background: transparent;
  color: var(--text);
  font-size: 13px;
  text-align: left;
  cursor: pointer;
  transition: background 0.1s ease;
}

.menu-dropdown-item:hover:not(:disabled) {
  background: var(--list-hover);
}

.menu-dropdown-item:disabled {
  color: var(--muted);
  cursor: not-allowed;
}

.menu-dropdown-label {
  flex: 1;
}

.menu-dropdown-shortcut {
  margin-left: 24px;
  font-size: 12px;
  color: var(--muted);
}

.menu-separator {
  height: 1px;
  background: var(--border);
  margin: 4px 0;
}

.menu-overlay {
  position: fixed;
  inset: 0;
  z-index: 999;
}
</style>
