<template>
  <div
    v-if="isOpen"
    class="context-menu-overlay"
    @pointerdown="close"
    @contextmenu.prevent
  >
    <div
      class="context-menu"
      :style="{
        left: x + 'px',
        top: y + 'px',
        width: width + 'px'
      }"
      @pointerdown.stop
    >
      <button 
        class="context-menu-item" 
        :disabled="!node || node.kind !== 'file'" 
        @click="emit('open')"
      >
        Abrir
      </button>
      <button 
        class="context-menu-item" 
        :disabled="!hasTree"
        @click="emit('refresh')"
      >
        Atualizar
      </button>

      <div class="context-menu-sep" />

      <button class="context-menu-item" @click="emit('newFile')">
        Novo Arquivo
      </button>
      <button class="context-menu-item" @click="emit('newFolder')">
        Nova Pasta
      </button>

      <div class="context-menu-sep" />

      <button
        class="context-menu-item"
        :disabled="!node || isRoot"
        @click="emit('rename')"
      >
        Renomear
      </button>
      <button
        class="context-menu-item context-menu-item--danger"
        :disabled="!node || isRoot"
        @click="emit('delete')"
      >
        Excluir
      </button>

      <div class="context-menu-sep" />

      <button
        class="context-menu-item context-menu-item--danger"
        :disabled="!isRoot"
        @click="emit('removeRoot')"
      >
        Remover Pasta do Workspace
      </button>
      <div class="context-menu-sep" />

      <button
        class="context-menu-item"
        :disabled="!node"
        @click="emit('copyPath')"
      >
        Copiar Caminho
      </button>
      <button
        class="context-menu-item"
        :disabled="!node"
        @click="emit('copyRelativePath')"
      >
        Copiar Caminho Relativo
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  },
  x: {
    type: Number,
    default: 0
  },
  y: {
    type: Number,
    default: 0
  },
  width: {
    type: Number,
    default: 200
  },
  node: {
    type: Object,
    default: null
  },
  rootPath: {
    type: String,
    default: ''
  },
  hasTree: {
    type: Boolean,
    default: false
  },
  isRoot: {
    type: Boolean,
    default: false
  },
})

const emit = defineEmits(['close', 'open', 'refresh', 'newFile', 'newFolder', 'rename', 'delete', 'copyPath', 'copyRelativePath', 'removeRoot'])

function close() {
  emit('close')
}
</script>

<style scoped>
.context-menu-overlay {
  position: fixed;
  inset: 0;
  z-index: 80;
}

.context-menu {
  position: fixed;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 6px 0;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  min-width: 160px;
}

.context-menu-item {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 8px 14px;
  border: none;
  background: transparent;
  color: var(--text);
  font-size: 13px;
  text-align: left;
  cursor: pointer;
  transition: background 0.1s ease;
}

.context-menu-item:hover:not(:disabled) {
  background: var(--list-hover);
}

.context-menu-item:disabled {
  color: var(--muted);
  cursor: not-allowed;
  opacity: 0.5;
}

.context-menu-item--danger {
  color: var(--danger);
}

.context-menu-item--danger:hover:not(:disabled) {
  background: rgba(241, 76, 76, 0.1);
}

.context-menu-sep {
  height: 1px;
  background: var(--border);
  margin: 6px 0;
}
</style>
