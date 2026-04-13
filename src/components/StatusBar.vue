<template>
  <div class="statusbar">
    <!-- Branch Picker Popover -->
    <Teleport to="body">
      <div v-if="branchPickerOpen" class="branch-overlay" @mousedown.self="closeBranchPicker"></div>
      <div v-if="branchPickerOpen" class="branch-picker" :style="pickerStyle">
        <div class="branch-picker-header">
          <span class="sb-icon icon-code-branch"></span>
          <span>Checkout de Branch</span>
        </div>
        <div class="branch-picker-search-wrap">
          <input
            ref="branchSearchRef"
            v-model="branchSearch"
            class="branch-picker-search"
            placeholder="Filtrar ou digitar novo nome..."
            @keydown.enter="handleBranchEnter"
            @keydown.escape="closeBranchPicker"
          />
        </div>
        <div class="branch-picker-list">
          <template v-if="filteredBranches.length > 0">
            <div
              v-for="b in filteredBranches"
              :key="b.name"
              class="branch-picker-item"
              :class="{ active: b.current }"
              @click="selectBranch(b)"
            >
              <span class="sb-icon icon-code-branch branch-item-icon"></span>
              <span class="branch-item-name">{{ b.name }}</span>
              <span v-if="b.current" class="branch-item-badge">atual</span>
            </div>
          </template>
          <div v-else-if="branchSearch" class="branch-picker-create" @click="createBranch">
            <span class="sb-icon icon-plus branch-item-icon"></span>
            <span>Criar branch <strong>{{ branchSearch }}</strong></span>
          </div>
          <div v-else class="branch-picker-empty">Nenhuma branch encontrada</div>
        </div>
        <div class="branch-picker-footer">
          <button class="branch-picker-new-btn" @click="focusSearch">
            <span class="sb-icon icon-plus"></span> Criar nova branch
          </button>
        </div>
      </div>
    </Teleport>

    <!-- Esquerda -->
    <div class="status-left">
      <button
        v-if="isGitRepo"
        ref="branchBtnRef"
        class="sb-item branch-btn"
        :title="`${workspaceName} (Git) — ${branch || '...'}`"
        @click="toggleBranchPicker"
      >
        <span class="sb-icon icon-code-branch"></span>
        <span class="branch-text">
          {{ workspaceName ? workspaceName + ' ' : '' }}{{ branch || '...' }}<template v-if="gitChanges > 0">*</template>
        </span>
      </button>

      <span v-if="fileName" class="sb-text sep-left">{{ fileName }}</span>

      <div
        v-if="pickedColor"
        class="sb-item sep-left"
        @click="$emit('copyColor', pickedColor)"
        :title="'Copiar: ' + pickedColor"
        style="cursor:pointer"
      >
        <span class="color-swatch" :style="{ background: pickedColor }"></span>
        <span>{{ pickedColor }}</span>
        <button class="color-close" @click.stop="$emit('clearPickedColor')">×</button>
      </div>
    </div>

    <!-- Direita -->
    <div class="status-right">
      <button
        class="sb-item"
        :class="{ 'ac-active': autocompleteEnabled, 'ac-loading': autocompleteLoading }"
        @click="$emit('toggleAutocomplete')"
        :title="autocompleteEnabled ? 'AI Autocomplete ativo' : 'AI Autocomplete desativado'"
      >
        <span v-if="autocompleteLoading" class="spinner"></span>
        <span v-else class="sb-icon icon-wand-magic-sparkles"></span>
        <span>{{ autocompleteEnabled ? 'AI' : 'AI Off' }}</span>
      </button>

      <button class="sb-item" @click="$emit('activateEyedropper')" title="Capturar cor">
        <span class="sb-icon icon-palette"></span>
        <span>Cor</span>
      </button>

      <button class="sb-item" @click="$emit('toggleColorPalette')" title="Histórico de cores">
        <span class="sb-icon icon-swatchbook"></span>
      </button>

      <span v-if="language" class="sb-text">{{ language }}</span>
      <span v-if="lineCol" class="sb-text">Ln {{ lineCol.line }}, Col {{ lineCol.col }}</span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, nextTick } from 'vue'

const props = defineProps({
  fileName:            { type: String,  default: '' },
  language:            { type: String,  default: '' },
  lineCol:             { type: Object,  default: () => ({ line: 1, col: 1 }) },
  pickedColor:         { type: String,  default: null },
  autocompleteEnabled: { type: Boolean, default: true },
  autocompleteLoading: { type: Boolean, default: false },
  branch:              { type: String,  default: '' },
  branches:            { type: Array,   default: () => [] },
  isGitRepo:           { type: Boolean, default: false },
  gitChanges:          { type: Number,  default: 0 },
  workspaceName:       { type: String,  default: '' },
})

const emit = defineEmits([
  'activateEyedropper', 'toggleColorPalette', 'copyColor',
  'clearPickedColor', 'toggleAutocomplete',
  'checkoutBranch', 'createBranch', 'requestBranches',
])

const branchPickerOpen = ref(false)
const branchSearch     = ref('')
const branchBtnRef     = ref(null)
const branchSearchRef  = ref(null)
const pickerStyle      = ref({})

const filteredBranches = computed(() => {
  const q = branchSearch.value.trim().toLowerCase()
  return q ? props.branches.filter(b => b.name.toLowerCase().includes(q)) : props.branches
})

function toggleBranchPicker() {
  if (branchPickerOpen.value) { closeBranchPicker(); return }
  branchPickerOpen.value = true
  branchSearch.value = ''
  emit('requestBranches')
  nextTick(() => { positionPicker(); branchSearchRef.value?.focus() })
}

function closeBranchPicker() {
  branchPickerOpen.value = false
  branchSearch.value = ''
}

function positionPicker() {
  const btn = branchBtnRef.value
  if (!btn) return
  const rect = btn.getBoundingClientRect()
  pickerStyle.value = {
    left:   rect.left + 'px',
    bottom: (window.innerHeight - rect.top + 6) + 'px',
  }
}

function selectBranch(b) {
  if (b.current) { closeBranchPicker(); return }
  emit('checkoutBranch', b.name)
  closeBranchPicker()
}

function createBranch() {
  const name = branchSearch.value.trim()
  if (!name) return
  emit('createBranch', name)
  closeBranchPicker()
}

function focusSearch() {
  branchSearch.value = ''
  branchSearchRef.value?.focus()
}

function handleBranchEnter() {
  const q = branchSearch.value.trim()
  if (!q) return
  const exact = props.branches.find(b => b.name === q)
  if (exact) selectBranch(exact)
  else createBranch()
}
</script>

<style scoped>
.statusbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 22px;
  background: var(--statusbar-bg, var(--monaco-statusbar-bg, #007acc));
  color: var(--statusbar-fg, var(--monaco-statusbar-fg, #fff));
  font-size: 12px;
  flex-shrink: 0;
  user-select: none;
}

.status-left,
.status-right {
  display: flex;
  align-items: center;
  height: 100%;
  gap: 0;
}

/* Ícone base da status bar — sobrescreve o tamanho da activity bar */
.sb-icon {
  width: 13px !important;
  height: 13px !important;
  flex-shrink: 0;
}

/* Item clicável */
.sb-item {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 0 10px;
  height: 100%;
  border: none;
  background: transparent;
  color: inherit;
  font-size: 11px;
  font-family: inherit;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.1s;
}

.sb-item:hover {
  background: rgba(255,255,255,0.13);
}

/* Texto simples sem hover */
.sb-text {
  padding: 0 10px;
  font-size: 11px;
  opacity: 0.85;
  display: flex;
  align-items: center;
  height: 100%;
  border-left: 1px solid rgba(255,255,255,0.1);
}

.sep-left {
  border-left: 1px solid rgba(255,255,255,0.1);
}

/* Branch button */
.branch-btn { padding: 0 10px 0 8px; }

.branch-text {
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.01em;
}

/* Cor */
.color-swatch {
  width: 11px;
  height: 11px;
  border-radius: 2px;
  border: 1px solid rgba(255,255,255,0.25);
  flex-shrink: 0;
}

.color-close {
  width: 14px;
  height: 14px;
  padding: 0;
  border: none;
  background: rgba(255,255,255,0.18);
  color: inherit;
  font-size: 11px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

.color-close:hover { background: rgba(255,255,255,0.32); }

/* Autocomplete */
.ac-active { background: rgba(80,220,130,0.18) !important; }
.ac-active:hover { background: rgba(80,220,130,0.28) !important; }
.ac-loading { background: rgba(255,200,80,0.18) !important; }

.spinner {
  width: 11px;
  height: 11px;
  border: 1.5px solid rgba(255,255,255,0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  flex-shrink: 0;
}

@keyframes spin { to { transform: rotate(360deg); } }
</style>

<style>
/* Branch Picker — global (Teleport) */
.branch-overlay {
  position: fixed;
  inset: 0;
  z-index: 9998;
}

.branch-picker {
  position: fixed;
  z-index: 9999;
  width: 300px;
  background: var(--panel, #252526);
  border: 1px solid var(--border, #454545);
  border-radius: 4px;
  box-shadow: 0 6px 20px rgba(0,0,0,0.5);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  font-size: 12px;
  color: var(--text, #ccc);
}

.branch-picker-header {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 7px 12px;
  font-size: 11px;
  font-weight: 600;
  color: var(--muted, #888);
  border-bottom: 1px solid var(--border, #3c3c3c);
  text-transform: uppercase;
  letter-spacing: 0.07em;
}

.branch-picker-header .sb-icon {
  width: 13px !important;
  height: 13px !important;
  opacity: 0.6;
  filter: invert(0.6) !important;
}

.branch-picker-search-wrap {
  padding: 7px 8px;
  border-bottom: 1px solid var(--border, #3c3c3c);
}

.branch-picker-search {
  width: 100%;
  background: var(--input-bg, #3c3c3c);
  border: 1px solid var(--border, #555);
  border-radius: 3px;
  color: var(--text, #ccc);
  font-size: 12px;
  padding: 5px 8px;
  outline: none;
  box-sizing: border-box;
}

.branch-picker-search:focus {
  border-color: var(--accent, #007acc);
}

.branch-picker-list {
  max-height: 220px;
  overflow-y: auto;
  padding: 3px 0;
}

.branch-picker-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  cursor: pointer;
  transition: background 0.08s;
}

.branch-picker-item:hover { background: var(--list-hover, rgba(255,255,255,0.07)); }
.branch-picker-item.active { background: rgba(0,122,204,0.14); }

.branch-item-icon {
  width: 13px !important;
  height: 13px !important;
  flex-shrink: 0;
  opacity: 0.55;
  filter: invert(0.55) !important;
}

.branch-picker-item.active .branch-item-icon {
  opacity: 1;
  filter: invert(0.4) sepia(1) saturate(4) hue-rotate(180deg) !important;
}

.branch-item-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
}

.branch-picker-item.active .branch-item-name {
  color: var(--accent, #007acc);
  font-weight: 500;
}

.branch-item-badge {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 10px;
  background: var(--accent, #007acc);
  color: #fff;
  flex-shrink: 0;
}

.branch-picker-create {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  cursor: pointer;
  color: var(--accent, #007acc);
  font-size: 12px;
  transition: background 0.08s;
}

.branch-picker-create:hover { background: var(--list-hover, rgba(255,255,255,0.06)); }

.branch-picker-empty {
  padding: 16px 12px;
  text-align: center;
  color: var(--muted, #888);
  font-size: 11px;
}

.branch-picker-footer {
  border-top: 1px solid var(--border, #3c3c3c);
  padding: 5px 8px;
}

.branch-picker-new-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  width: 100%;
  padding: 5px 8px;
  background: none;
  border: 1px dashed var(--border, #555);
  border-radius: 3px;
  color: var(--muted, #888);
  font-size: 11px;
  cursor: pointer;
  transition: all 0.12s;
}

.branch-picker-new-btn:hover {
  background: var(--list-hover, rgba(255,255,255,0.05));
  color: var(--text, #ccc);
  border-color: var(--accent, #007acc);
}

.branch-picker-new-btn .sb-icon {
  width: 11px !important;
  height: 11px !important;
  filter: invert(0.6) !important;
}
</style>
