<template>
  <Teleport to="body">
    <Transition name="quickopen">
      <div v-if="isOpen" class="quickopen-overlay" @click="close">
        <div class="quickopen-container" @click.stop>
          <div class="quickopen-search">
            <svg class="quickopen-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"></circle>
              <path d="m21 21-4.3-4.3"></path>
            </svg>
            <input
              ref="inputRef"
              v-model="query"
              type="text"
              placeholder="Buscar arquivos... (ex: delete-leads.js)"
              @input="onSearchInput"
              @keydown="handleKeyDown"
              class="quickopen-input"
            />
            <kbd v-if="!query" class="quickopen-hint">ESC</kbd>
          </div>
          
          <div v-if="loading" class="quickopen-loading">
            <div class="spinner"></div>
            <span>Buscando arquivos...</span>
          </div>
          
          <div v-else-if="filteredFiles.length > 0" class="quickopen-results">
            <div
              v-for="(file, idx) in filteredFiles"
              :key="file.path"
              :class="['quickopen-item', { active: idx === selectedIndex }]"
              @click="openFile(file)"
              @mouseenter="selectedIndex = idx"
            >
              <div class="quickopen-item-icon">
                <img :src="getFileIcon(file.name)" :alt="file.name" class="file-icon" />
              </div>
              <div class="quickopen-item-content">
                <div class="quickopen-item-name" v-html="highlightMatch(file.name)"></div>
                <div class="quickopen-item-path" v-html="highlightMatch(file.relativePath)"></div>
              </div>
            </div>
          </div>
          
          <div v-else-if="query && !loading" class="quickopen-empty">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <circle cx="11" cy="11" r="8"></circle>
              <path d="m21 21-4.3-4.3"></path>
            </svg>
            <p>Nenhum arquivo encontrado para "{{ query }}"</p>
          </div>
          
          <div v-else class="quickopen-empty">
            <p>Digite para buscar arquivos no workspace</p>
          </div>
          
          <div class="quickopen-footer">
            <span class="quickopen-footer-item">
              <kbd>↑↓</kbd> Navegar
            </span>
            <span class="quickopen-footer-item">
              <kbd>↵</kbd> Abrir
            </span>
            <span class="quickopen-footer-item">
              <kbd>ESC</kbd> Fechar
            </span>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch, nextTick, shallowRef } from 'vue'

const props = defineProps({
  isOpen: Boolean,
  workspaceFolders: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['close', 'open-file'])

const query = ref('')
const selectedIndex = ref(0)
const inputRef = ref(null)
const allFiles = shallowRef([])
const loading = ref(false)
let searchTimeout = null

// Ícones de arquivo
const FILE_ICON_MAP = {
  'js': 'file_type_js.svg',
  'ts': 'file_type_typescript.svg',
  'tsx': 'file_type_typescript.svg',
  'html': 'file_type_html.svg',
  'css': 'file_type_css.svg',
  'scss': 'file_type_scss.svg',
  'json': 'file_type_json.svg',
  'vue': 'file_type_vue.svg',
  'md': 'file_type_markdown.svg',
  'py': 'file_type_python.svg',
  'go': 'file_type_go.svg',
  'default': 'default_file.svg'
}

function getFileIcon(filename) {
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  return `./icons/${FILE_ICON_MAP[ext] || FILE_ICON_MAP.default}`
}

// Fuzzy matching
function fuzzyMatch(text, pattern) {
  const textLower = text.toLowerCase()
  const patternLower = pattern.toLowerCase()
  
  let textIndex = 0
  let patternIndex = 0
  const matches = []
  
  while (textIndex < textLower.length && patternIndex < patternLower.length) {
    if (textLower[textIndex] === patternLower[patternIndex]) {
      matches.push(textIndex)
      patternIndex++
    }
    textIndex++
  }
  
  return patternIndex === patternLower.length ? matches : null
}

// Score para ranking
function calculateScore(text, pattern, matches) {
  if (!matches || matches.length === 0) return 0
  
  let score = 0
  let lastMatchIndex = -1
  
  for (const matchIndex of matches) {
    // Bonus por match no início de palavra
    if (matchIndex === 0 || text[matchIndex - 1] === '/' || text[matchIndex - 1] === '-') {
      score += 10
    }
    
    // Bonus por match em maiúsculas
    if (text[matchIndex] === text[matchIndex].toUpperCase()) {
      score += 5
    }
    
    // Penalidade por gaps
    if (lastMatchIndex !== -1) {
      const gap = matchIndex - lastMatchIndex - 1
      score -= gap * 0.5
    }
    
    lastMatchIndex = matchIndex
  }
  
  // Bonus por match completo no nome do arquivo
  if (text.toLowerCase().includes(pattern.toLowerCase())) {
    score += 20
  }
  
  return score
}

watch(() => props.isOpen, async (isOpen) => {
  if (isOpen) {
    query.value = ''
    selectedIndex.value = 0
    loading.value = true
    
    // Carregar arquivos do workspace
    await loadWorkspaceFiles()
    
    loading.value = false
    
    nextTick(() => {
      inputRef.value?.focus()
    })
  }
})

async function loadWorkspaceFiles() {
  if (!window.monarco?.listWorkspaceTree) {
    allFiles.value = []
    return
  }
  
  try {
    const tree = await window.monarco.listWorkspaceTree()
    const files = []
    
    function extractFiles(node, basePath = '') {
      if (!node) return
      
      if (node.kind === 'file') {
        const fullPath = node.path || `${basePath}/${node.name}`
        const relativePath = fullPath.replace(/^(\/+|\.\/)/, '')
        
        files.push({
          name: node.name,
          path: fullPath,
          relativePath,
          kind: 'file'
        })
      } else if (node.kind === 'dir' && node.children) {
        // Ignorar node_modules, .git, dist, build
        const skipDirs = ['node_modules', '.git', 'dist', 'build', 'out', '.DS_Store']
        if (!skipDirs.includes(node.name)) {
          for (const child of node.children) {
            extractFiles(child, node.path || basePath)
          }
        }
      }
    }
    
    // Suporte a múltiplos roots
    if (Array.isArray(tree)) {
      for (const root of tree) {
        extractFiles(root)
      }
    } else if (tree) {
      extractFiles(tree)
    }
    
    allFiles.value = files
  } catch (error) {
    console.error('Erro ao carregar arquivos:', error)
    allFiles.value = []
  }
}

function onSearchInput() {
  selectedIndex.value = 0
  
  // Debounce para performance
  if (searchTimeout) {
    clearTimeout(searchTimeout)
  }
}

const filteredFiles = computed(() => {
  if (!query.value.trim()) {
    return allFiles.value.slice(0, 50)
  }
  
  const q = query.value.trim()
  const results = []
  
  for (const file of allFiles.value) {
    // Match no nome do arquivo (prioridade)
    const nameMatches = fuzzyMatch(file.name, q)
    // Match no path relativo
    const pathMatches = fuzzyMatch(file.relativePath, q)
    
    if (nameMatches || pathMatches) {
      const nameScore = nameMatches ? calculateScore(file.name, q, nameMatches) * 2 : 0
      const pathScore = pathMatches ? calculateScore(file.relativePath, q, pathMatches) : 0
      const totalScore = nameScore + pathScore
      
      results.push({
        ...file,
        score: totalScore,
        matches: nameMatches || pathMatches
      })
    }
  }
  
  // Ordenar por score (mais relevante primeiro)
  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, 50)
})

function highlightMatch(text) {
  if (!query.value.trim() || !text) return text
  
  const matches = fuzzyMatch(text, query.value)
  if (!matches || matches.length === 0) return text
  
  let result = ''
  let lastIndex = 0
  
  for (const matchIndex of matches) {
    result += text.slice(lastIndex, matchIndex)
    result += `<mark>${text[matchIndex]}</mark>`
    lastIndex = matchIndex + 1
  }
  
  result += text.slice(lastIndex)
  return result
}

function handleKeyDown(e) {
  if (e.key === 'Escape') {
    close()
  } else if (e.key === 'ArrowDown') {
    e.preventDefault()
    selectedIndex.value = Math.min(selectedIndex.value + 1, filteredFiles.value.length - 1)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    selectedIndex.value = Math.max(selectedIndex.value - 1, 0)
  } else if (e.key === 'Enter') {
    e.preventDefault()
    const file = filteredFiles.value[selectedIndex.value]
    if (file) {
      openFile(file)
    }
  }
}

function openFile(file) {
  emit('open-file', file)
  close()
}

function close() {
  emit('close')
}
</script>

<style scoped>
.quickopen-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  z-index: 9999;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 15vh;
}

.quickopen-container {
  width: 680px;
  max-width: 90vw;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  max-height: 60vh;
}

.quickopen-search {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  border-bottom: 1px solid var(--border);
}

.quickopen-icon {
  color: var(--muted);
  flex-shrink: 0;
}

.quickopen-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: var(--text);
  font-size: 15px;
  font-family: inherit;
}

.quickopen-input::placeholder {
  color: var(--muted);
}

.quickopen-hint {
  font-size: 11px;
  color: var(--muted);
  background: var(--panel-2);
  padding: 2px 6px;
  border-radius: 3px;
  font-family: monospace;
}

.quickopen-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 32px;
  color: var(--muted);
  font-size: 13px;
}

.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.quickopen-results {
  max-height: 450px;
  overflow-y: auto;
}

.quickopen-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  cursor: pointer;
  transition: background 0.1s ease;
  border-left: 2px solid transparent;
}

.quickopen-item:hover,
.quickopen-item.active {
  background: var(--hover);
  border-left-color: var(--accent);
}

.quickopen-item-icon {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.file-icon {
  width: 18px;
  height: 18px;
  object-fit: contain;
}

.quickopen-item-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.quickopen-item-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.quickopen-item-name :deep(mark) {
  background: var(--accent);
  color: var(--text);
  border-radius: 2px;
  padding: 0 1px;
}

.quickopen-item-path {
  font-size: 11px;
  color: var(--muted);
  font-family: 'ui-monospace', 'SF Mono', 'Monaco', 'Consolas', monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.quickopen-item-path :deep(mark) {
  background: var(--accent);
  color: var(--text);
  border-radius: 2px;
  padding: 0 1px;
}

.quickopen-empty {
  padding: 48px 32px;
  text-align: center;
  color: var(--muted);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.quickopen-empty svg {
  opacity: 0.3;
}

.quickopen-empty p {
  font-size: 13px;
  margin: 0;
}

.quickopen-footer {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 10px 16px;
  border-top: 1px solid var(--border);
  background: var(--panel-2);
}

.quickopen-footer-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--muted);
}

.quickopen-footer-item kbd {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 3px;
  padding: 1px 4px;
  font-size: 10px;
  font-family: monospace;
}

/* Animações */
.quickopen-enter-active,
.quickopen-leave-active {
  transition: opacity 0.15s ease;
}

.quickopen-enter-from,
.quickopen-leave-to {
  opacity: 0;
}

.quickopen-enter-active .quickopen-container,
.quickopen-leave-active .quickopen-container {
  transition: transform 0.15s ease, opacity 0.15s ease;
}

.quickopen-enter-from .quickopen-container,
.quickopen-leave-to .quickopen-container {
  opacity: 0;
  transform: translateY(-20px) scale(0.98);
}
</style>
