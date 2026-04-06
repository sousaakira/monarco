<template>
  <div class="terminal-panel">
    <div class="terminal-header">
      <div class="terminal-tabs">
        <div 
          v-for="(term, index) in terminals" 
          :key="term.id"
          class="terminal-tab"
          :class="{ active: term.id === activeTerminalId }"
          @click="selectTerminal(term.id)"
        >
          <span class="icon-terminal"></span>
          <span class="terminal-tab-name">Terminal {{ index + 1 }}</span>
          <button class="terminal-tab-close" @click.stop="closeTerminal(term.id)">×</button>
        </div>
        <button class="terminal-add-btn" @click="createTerminal" title="Novo Terminal">
          <span class="icon-plus"></span>
        </button>
      </div>
      <div class="terminal-actions">
        <button class="terminal-action-btn" @click="clearTerminal" title="Limpar">
          <span class="icon-trash"></span>
        </button>
        <button class="terminal-action-btn" @click="$emit('close')" title="Fechar Painel">
          <span class="icon-xmark"></span>
        </button>
      </div>
    </div>
    <div ref="terminalContainer" class="terminal-container" @contextmenu.prevent="openTerminalContextMenu"></div>
    <div
      v-if="terminalContextMenu.open"
      class="terminal-context-overlay"
      @pointerdown="closeTerminalContextMenu"
      @contextmenu.prevent
    >
      <div
        class="terminal-context-menu"
        :style="{ left: terminalContextMenu.x + 'px', top: terminalContextMenu.y + 'px' }"
        @pointerdown.stop
      >
        <button class="terminal-context-item" :disabled="!terminalContextMenu.hasSelection" @click="contextCopy">
          <span class="terminal-context-left">
            <svg class="terminal-context-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
            <span>Copiar</span>
          </span>
          <span class="terminal-context-shortcut">Ctrl+Shift+C</span>
        </button>
        <button class="terminal-context-item" :disabled="!activeTerminalId" @click="contextPaste">
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
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { Terminal } from 'xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import 'xterm/css/xterm.css'

const emit = defineEmits(['close'])

const terminalContainer = ref(null)
const terminals = ref([])
const activeTerminalId = ref(null)

let activeXterm = null
let activeFitAddon = null
let resizeObserver = null
let dataUnsubscribe = null
let exitUnsubscribe = null

const terminalContextMenu = ref({
  open: false,
  x: 0,
  y: 0,
  hasSelection: false
})

const termTheme = {
  background: '#1e1e1e',
  foreground: '#cccccc',
  cursor: '#aeafad',
  cursorAccent: '#1e1e1e',
  selectionBackground: '#264f78',
  black: '#000000',
  red: '#cd3131',
  green: '#0dbc79',
  yellow: '#e5e510',
  blue: '#2472c8',
  magenta: '#bc3fbc',
  cyan: '#11a8cd',
  white: '#e5e5e5',
  brightBlack: '#666666',
  brightRed: '#f14c4c',
  brightGreen: '#23d18b',
  brightYellow: '#f5f543',
  brightBlue: '#3b8eea',
  brightMagenta: '#d670d6',
  brightCyan: '#29b8db',
  brightWhite: '#e5e5e5'
}

async function createTerminal() {
  if (!window.monarco?.terminal) {
    console.error('Terminal API not available')
    return
  }

  try {
    const cwd = await window.monarco.terminal.getCwd()
    const terminalId = await window.monarco.terminal.create({
      cwd,
      cols: 80,
      rows: 24
    })

    const term = {
      id: terminalId,
      xterm: null,
      fitAddon: null
    }

    // Criar instância xterm
    term.xterm = new Terminal({
      theme: termTheme,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      fontSize: 13,
      lineHeight: 1.2,
      cursorBlink: true,
      cursorStyle: 'block',
      scrollback: 10000,
      allowProposedApi: true
    })

    // Addons
    term.fitAddon = new FitAddon()
    term.xterm.loadAddon(term.fitAddon)
    term.xterm.loadAddon(new WebLinksAddon())

    // Enviar input para o PTY
    term.xterm.onData((data) => {
      window.monarco.terminal.write(terminalId, data)
    })

    term.xterm.attachCustomKeyEventHandler((e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.code === 'KeyC' || e.key?.toLowerCase() === 'c')) {
        void copySelectionFromXterm(term.xterm)
        return false
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.code === 'KeyV' || e.key?.toLowerCase() === 'v')) {
        void pasteTextToTerminalId(terminalId)
        return false
      }
      return true
    })

    terminals.value.push(term)
    activeTerminalId.value = terminalId

    await nextTick()
    mountTerminal(term)

  } catch (e) {
    console.error('Failed to create terminal:', e)
  }
}

function mountTerminal(term) {
  if (!terminalContainer.value) return

  // Limpar container
  terminalContainer.value.innerHTML = ''

  // Montar terminal
  term.xterm.open(terminalContainer.value)
  term.fitAddon.fit()
  term.xterm.focus()

  activeXterm = term.xterm
  activeFitAddon = term.fitAddon

  // Atualizar dimensões no PTY
  const { cols, rows } = term.xterm
  window.monarco.terminal.resize(term.id, cols, rows)
}

function selectTerminal(terminalId) {
  if (activeTerminalId.value === terminalId) return

  activeTerminalId.value = terminalId
  const term = terminals.value.find(t => t.id === terminalId)
  if (term) {
    nextTick(() => {
      mountTerminal(term)
    })
  }
}

function closeTerminal(terminalId) {
  const index = terminals.value.findIndex(t => t.id === terminalId)
  if (index === -1) return

  const term = terminals.value[index]
  
  // Destruir xterm
  if (term.xterm) {
    term.xterm.dispose()
  }
  
  // Destruir PTY
  window.monarco.terminal.destroy(terminalId)

  terminals.value.splice(index, 1)

  // Se era o terminal ativo, selecionar outro
  if (activeTerminalId.value === terminalId) {
    if (terminals.value.length > 0) {
      const nextIndex = Math.min(index, terminals.value.length - 1)
      selectTerminal(terminals.value[nextIndex].id)
    } else {
      activeTerminalId.value = null
      activeXterm = null
      activeFitAddon = null
      if (terminalContainer.value) {
        terminalContainer.value.innerHTML = ''
      }
    }
  }
}

function clearTerminal() {
  if (activeXterm) {
    activeXterm.clear()
  }
}

function openTerminalContextMenu(e) {
  if (!activeXterm) return
  terminalContextMenu.value = {
    open: true,
    x: e.clientX,
    y: e.clientY,
    hasSelection: !!(activeXterm.getSelection?.() || '')
  }
}

function closeTerminalContextMenu() {
  terminalContextMenu.value.open = false
}

async function contextCopy() {
  await copyActiveSelection()
  closeTerminalContextMenu()
}

async function contextPaste() {
  await pasteToActiveTerminal()
  closeTerminalContextMenu()
}

async function copySelectionFromXterm(xterm) {
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

async function pasteTextToTerminalId(terminalId) {
  if (!terminalId) return
  try {
    const text = await navigator.clipboard.readText()
    if (!text) return
    window.monarco?.terminal?.write?.(terminalId, text)
  } catch (e) {
    window.monarcoToast?.error?.('Falha ao colar', { description: e?.message })
  }
}

async function copyActiveSelection() {
  await copySelectionFromXterm(activeXterm)
}

async function pasteToActiveTerminal() {
  if (!activeTerminalId.value) return
  await pasteTextToTerminalId(activeTerminalId.value)
  activeXterm?.focus?.()
}

function fitTerminal() {
  if (activeFitAddon && activeXterm) {
    activeFitAddon.fit()
    const { cols, rows } = activeXterm
    if (activeTerminalId.value) {
      window.monarco.terminal.resize(activeTerminalId.value, cols, rows)
    }
  }
}

function handleTerminalData(terminalId, data) {
  const term = terminals.value.find(t => t.id === terminalId)
  if (term && term.xterm) {
    term.xterm.write(data)
  }
}

function handleTerminalExit(terminalId, exitCode) {
  console.log(`Terminal ${terminalId} exited with code ${exitCode}`)
  // Opcional: fechar a aba automaticamente ou mostrar mensagem
}

onMounted(async () => {
  // Criar terminal inicial
  await createTerminal()

  // Observer para redimensionamento
  if (terminalContainer.value) {
    resizeObserver = new ResizeObserver(() => {
      fitTerminal()
    })
    resizeObserver.observe(terminalContainer.value)
  }

  // Listeners de dados do terminal
  if (window.monarco?.terminal) {
    dataUnsubscribe = window.monarco.terminal.onData(handleTerminalData)
    exitUnsubscribe = window.monarco.terminal.onExit(handleTerminalExit)
  }

  document.addEventListener('keydown', handleContextMenuKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleContextMenuKeydown)
  // Limpar observer
  if (resizeObserver) {
    resizeObserver.disconnect()
  }

  // Remover listeners
  if (dataUnsubscribe) {
    dataUnsubscribe()
  }
  if (exitUnsubscribe) {
    exitUnsubscribe()
  }

  // Destruir todos os terminais
  terminals.value.forEach(term => {
    if (term.xterm) {
      term.xterm.dispose()
    }
    window.monarco?.terminal?.destroy(term.id)
  })
})

// Expor método para redimensionar externamente
defineExpose({
  fit: fitTerminal,
  createTerminal
})

function handleContextMenuKeydown(e) {
  if (!terminalContextMenu.value.open) return
  if (e.key === 'Escape') {
    e.preventDefault()
    closeTerminalContextMenu()
  }
}
</script>

<style scoped>
.terminal-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #1e1e1e;
  border-top: 1px solid var(--border);
}

.terminal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 36px;
  background: var(--panel);
  border-bottom: 1px solid var(--border);
  padding: 0 8px;
  flex-shrink: 0;
}

.terminal-tabs {
  display: flex;
  align-items: center;
  gap: 2px;
  overflow-x: auto;
  flex: 1;
}

.terminal-tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  background: transparent;
  color: var(--muted);
  font-size: 12px;
  border-radius: 4px;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.1s ease;
}

.terminal-tab:hover {
  background: rgba(255, 255, 255, 0.06);
  color: var(--text);
}

.terminal-tab.active {
  background: rgba(255, 255, 255, 0.1);
  color: var(--text);
}

.terminal-tab-name {
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.terminal-tab-close {
  width: 16px;
  height: 16px;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--muted);
  font-size: 12px;
  cursor: pointer;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.1s ease;
}

.terminal-tab:hover .terminal-tab-close {
  opacity: 1;
}

.terminal-tab-close:hover {
  background: rgba(255, 255, 255, 0.1);
  color: var(--text);
}

.terminal-add-btn {
  width: 24px;
  height: 24px;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--muted);
  font-size: 14px;
  cursor: pointer;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.terminal-add-btn:hover {
  background: rgba(255, 255, 255, 0.06);
  color: var(--text);
}

.terminal-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.terminal-action-btn {
  width: 24px;
  height: 24px;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--muted);
  font-size: 12px;
  cursor: pointer;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.terminal-action-btn:hover {
  background: rgba(255, 255, 255, 0.06);
  color: var(--text);
}

.terminal-action-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.terminal-container {
  flex: 1;
  min-height: 0;
  padding: 8px;
  overflow: hidden;
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

/* Ajustes para xterm */
.terminal-container :deep(.xterm) {
  height: 100%;
}

.terminal-container :deep(.xterm-viewport) {
  /* Scrollbar estilo VS Code */
  scrollbar-width: thin;
  scrollbar-color: rgba(121, 121, 121, 0.4) transparent;
}

.terminal-container :deep(.xterm-viewport::-webkit-scrollbar) {
  width: 10px;
}

.terminal-container :deep(.xterm-viewport::-webkit-scrollbar-track) {
  background: transparent;
}

.terminal-container :deep(.xterm-viewport::-webkit-scrollbar-thumb) {
  background: rgba(121, 121, 121, 0.4);
  border-radius: 5px;
}

.terminal-container :deep(.xterm-viewport::-webkit-scrollbar-thumb:hover) {
  background: rgba(121, 121, 121, 0.6);
}
</style>
