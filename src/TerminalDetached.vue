<template>
  <div class="detached-root">
    <div class="titlebar">
      <!-- Controles à esquerda (macOS style) -->
      <div class="titlebarLeft">
        <div v-if="controlsPos === 'left'" class="windowControls">
          <button class="tbBtn close" title="Fechar" @click="closeWindow">
            <span class="icon-xmark"></span>
          </button>
          <button class="tbBtn" title="Minimizar" @click="minimizeWindow">
            <span class="icon-window-minimize"></span>
          </button>
          <button class="tbBtn" :title="isMaximized ? 'Restaurar' : 'Maximizar'" @click="toggleMaximize">
            <span v-if="!isMaximized" class="icon-window-maximize"></span>
            <span v-else class="icon-window-restore"></span>
          </button>
        </div>
        <span class="detached-title">{{ name }}</span>
      </div>

      <div class="titlebarCenter"></div>

      <!-- Controles à direita (Windows style) -->
      <div class="titlebarRight">
        <div v-if="controlsPos === 'right'" class="windowControls">
          <button class="tbBtn" title="Minimizar" @click="minimizeWindow">
            <span class="icon-window-minimize"></span>
          </button>
          <button class="tbBtn" :title="isMaximized ? 'Restaurar' : 'Maximizar'" @click="toggleMaximize">
            <span v-if="!isMaximized" class="icon-window-maximize"></span>
            <span v-else class="icon-window-restore"></span>
          </button>
          <button class="tbBtn close" title="Fechar" @click="closeWindow">
            <span class="icon-xmark"></span>
          </button>
        </div>
      </div>
    </div>
    <div ref="container" class="detached-terminal"></div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { Terminal } from 'xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import 'xterm/css/xterm.css'

const props = defineProps({
  terminalId: { type: String, required: true },
  name: { type: String, default: 'Terminal' },
  controlsPos: { type: String, default: 'left' }
})

const isMaximized = ref(false)

const container = ref(null)
let xterm = null
let fitAddon = null
let resizeObserver = null
let dataUnsub = null
let exitUnsub = null

onMounted(async () => {
  // Sincroniza estado de maximização
  isMaximized.value = await window.monarco?.windowIsMaximized?.() || false
  window.addEventListener('resize', async () => {
    isMaximized.value = await window.monarco?.windowIsMaximized?.() || false
  })

  // Transfere a propriedade dos eventos do PTY para esta janela
  await window.monarco?.terminal?.transfer?.(props.terminalId)

  xterm = new Terminal({
    theme: {
      background: '#1e1e1e',
      foreground: '#cccccc',
      cursor: '#aeafad',
      cursorAccent: '#1e1e1e',
      selectionBackground: '#264f78',
    },
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
    fontSize: 13,
    lineHeight: 1.2,
    cursorBlink: true,
    cursorStyle: 'block',
    scrollback: 10000,
    allowProposedApi: true
  })

  fitAddon = new FitAddon()
  xterm.loadAddon(fitAddon)
  xterm.loadAddon(new WebLinksAddon())

  xterm.onData((data) => {
    window.monarco?.terminal?.write?.(props.terminalId, data)
  })

  xterm.open(container.value)
  fitAddon.fit()
  xterm.focus()

  const { cols, rows } = xterm
  window.monarco?.terminal?.resize?.(props.terminalId, cols, rows)

  if (window.monarco?.terminal?.onData) {
    dataUnsub = window.monarco.terminal.onData((id, data) => {
      if (id === props.terminalId) xterm.write(data)
    })
  }

  if (window.monarco?.terminal?.onExit) {
    exitUnsub = window.monarco.terminal.onExit((id) => {
      if (id === props.terminalId) {
        xterm.writeln('\r\n\x1b[2m[processo encerrado]\x1b[0m')
      }
    })
  }

  resizeObserver = new ResizeObserver(() => {
    fitAddon.fit()
    const { cols, rows } = xterm
    window.monarco?.terminal?.resize?.(props.terminalId, cols, rows)
  })
  resizeObserver.observe(container.value)
})

onUnmounted(() => {
  resizeObserver?.disconnect()
  dataUnsub?.()
  exitUnsub?.()
  xterm?.dispose()
})

async function closeWindow() {
  // Devolve o terminal para o painel de IA antes de fechar
  await window.monarco?.terminal?.reattach?.(props.terminalId, props.name)
  // O processo main fecha esta janela após o reattach
}

function minimizeWindow() {
  window.monarco?.windowMinimize?.()
}

function toggleMaximize() {
  window.monarco?.windowToggleMaximize?.()
}
</script>

<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { overflow: hidden; background: #1e1e1e; height: 100%; }
</style>

<style scoped>
.detached-root {
  display: flex;
  flex-direction: column;
  width: 100vw;
  height: 100vh;
  background: #1e1e1e;
}

.detached-title {
  font-size: 12px;
  color: var(--muted);
  font-family: ui-monospace, monospace;
  padding-left: 8px;
}

.detached-terminal {
  flex: 1;
  overflow: hidden;
  padding: 4px;
}
</style>
