<script setup>
import { computed, onMounted, onUnmounted, ref, watch, nextTick } from 'vue'
import MonacoEditor from 'monaco-editor-vue3'
import * as monaco from 'monaco-editor'
import FileTree from './components/FileTree.vue'
import AIChat from './components/AIChat.vue'
import TitleBar from './components/TitleBar.vue'
import ActivityBar from './components/ActivityBar.vue'
import Settings from './components/Settings.vue'
import ConfirmDialog from './components/ConfirmDialog.vue'
import CrudDialog from './components/CrudDialog.vue'
import ColorPalette from './components/ColorPalette.vue'
import ContextMenu from './components/ContextMenu.vue'
import StatusBar from './components/StatusBar.vue'
import EditorTabs from './components/EditorTabs.vue'
import TerminalPanel from './components/Terminal.vue'
import Toast from './components/Toast.vue'
import CommandPalette from './components/CommandPalette.vue'

// Monaco Editor instance
const monacoEditorRef = ref(null)
let monacoInstance = null
let resizeObserver = null

function handleEditorMount(editor) {
  monacoInstance = editor
  
  // Registra atalhos personalizados
  registerEditorShortcuts(editor)
  
  // Faz layout inicial após montar
  setTimeout(() => {
    if (monacoInstance) {
      monacoInstance.layout()
    }
  }, 100)
}

function registerEditorShortcuts(editor) {
  // Usa o Monaco importado diretamente
  const { KeyMod, KeyCode } = monaco

  // Ctrl+D - Duplicar linha
  editor.addAction({
    id: 'duplicate-line',
    label: 'Duplicate Line',
    keybindings: [
      KeyMod.CtrlCmd | KeyCode.KeyD
    ],
    run: (ed) => {
      ed.trigger('keyboard', 'editor.action.copyLinesDownAction', null)
    }
  })
  
  // Ctrl+/ - Comentar/Descomentar
  editor.addAction({
    id: 'toggle-comment',
    label: 'Toggle Line Comment',
    keybindings: [
      KeyMod.CtrlCmd | KeyCode.Slash
    ],
    run: (ed) => {
      ed.trigger('keyboard', 'editor.action.commentLine', null)
    }
  })
  
  // Alt+↑ - Mover linha para cima
  editor.addAction({
    id: 'move-line-up',
    label: 'Move Line Up',
    keybindings: [
      KeyMod.Alt | KeyCode.UpArrow
    ],
    run: (ed) => {
      ed.trigger('keyboard', 'editor.action.moveLinesUpAction', null)
    }
  })
  
  // Alt+↓ - Mover linha para baixo
  editor.addAction({
    id: 'move-line-down',
    label: 'Move Line Down',
    keybindings: [
      KeyMod.Alt | KeyCode.DownArrow
    ],
    run: (ed) => {
      ed.trigger('keyboard', 'editor.action.moveLinesDownAction', null)
    }
  })
  
  // Ctrl+Shift+K - Deletar linha
  editor.addAction({
    id: 'delete-line',
    label: 'Delete Line',
    keybindings: [
      KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyK
    ],
    run: (ed) => {
      ed.trigger('keyboard', 'editor.action.deleteLines', null)
    }
  })
  
  // Ctrl+Shift+D - Duplicar seleção
  editor.addAction({
    id: 'duplicate-selection',
    label: 'Duplicate Selection',
    keybindings: [
      KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyD
    ],
    run: (ed) => {
      const selection = ed.getSelection()
      const text = ed.getModel().getValueInRange(selection)
      ed.executeEdits('', [{
        range: selection,
        text: text + text
      }])
    }
  })
  
  // Ctrl+] - Indent
  editor.addAction({
    id: 'indent-line',
    label: 'Indent Line',
    keybindings: [
      KeyMod.CtrlCmd | KeyCode.BracketRight
    ],
    run: (ed) => {
      ed.trigger('keyboard', 'editor.action.indentLines', null)
    }
  })
  
  // Ctrl+[ - Outdent
  editor.addAction({
    id: 'outdent-line',
    label: 'Outdent Line',
    keybindings: [
      KeyMod.CtrlCmd | KeyCode.BracketLeft
    ],
    run: (ed) => {
      ed.trigger('keyboard', 'editor.action.outdentLines', null)
    }
  })
  
  // Ctrl+Shift+F - Format document
  editor.addAction({
    id: 'format-document',
    label: 'Format Document',
    keybindings: [
      KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyF
    ],
    run: (ed) => {
      ed.trigger('keyboard', 'editor.action.formatDocument', null)
    }
  })
  
  // Ctrl+K - Edição inline com IA
  editor.addAction({
    id: 'ai-inline-edit',
    label: 'AI: Edit Selection (Ctrl+K)',
    keybindings: [
      KeyMod.CtrlCmd | KeyCode.KeyK
    ],
    run: (ed) => {
      // Emitir evento para abrir o popup de edição inline
      const selection = ed.getSelection()
      const model = ed.getModel()
      
      if (!model) return
      
      // Se não tem seleção, seleciona a linha atual
      let range = selection
      if (selection.isEmpty()) {
        const lineNumber = selection.startLineNumber
        range = {
          startLineNumber: lineNumber,
          startColumn: 1,
          endLineNumber: lineNumber,
          endColumn: model.getLineMaxColumn(lineNumber)
        }
        ed.setSelection(range)
      }
      
      const selectedText = model.getValueInRange(range)
      const position = ed.getPosition()
      
      // Notificar a UI para mostrar o popup
      window.dispatchEvent(new CustomEvent('monarco:ctrlk', {
        detail: {
          selection: range,
          text: selectedText,
          position: position,
          filePath: window.monarcoEditor?.getCurrentFile?.() || ''
        }
      }))
    }
  })
}

function layoutMonaco() {
  if (monacoInstance) {
    monacoInstance.layout()
  }
}

// Sidebar resize
const sidebarWidth = ref(280)
const isResizing = ref(false)
const minSidebarWidth = 180
const maxSidebarWidth = 600

// AI Chat panel resize
const aiChatWidth = ref(400)
const isResizingAIChat = ref(false)
const minAIChatWidth = 300
const maxAIChatWidth = 800

// AI Chat state
const isAIChatOpen = ref(false)

// Active view state
const activeView = ref('explorer')

// Search state
const searchQuery = ref('')
const searchResults = ref([])
const isSearching = ref(false)
const searchInContent = ref(false)
const searchCaseSensitive = ref(false)
const searchUseRegex = ref(false)

// Git state
const isGitRepo = ref(false)
const gitStatus = ref([])
const gitBranch = ref('')
const gitCommitMessage = ref('')
const isLoadingGit = ref(false)
const gitBranches = ref([])
const showBranchDialog = ref(false)
const newBranchName = ref('')
const showBranchesPanel = ref(false)
const gitCommits = ref([])
const showCommitsPanel = ref(false)
const isLoadingCommits = ref(false)
const showDiffModal = ref(false)
const diffContent = ref('')
const diffFilePath = ref('')
const diffStaged = ref(false)

// Terminal state
const isTerminalOpen = ref(false)
const terminalHeight = ref(250)
const isResizingTerminal = ref(false)
const minTerminalHeight = 100
const maxTerminalHeight = 600
const terminalRef = ref(null)

// NPM Scripts state
const npmScripts = ref([])
const isLoadingScripts = ref(false)
const runningScripts = ref(new Set())

// Command Palette state
const showCommandPalette = ref(false)

// Ctrl+K Inline Edit state
const showCtrlKPopup = ref(false)
const ctrlKInput = ref('')
const ctrlKLoading = ref(false)
const ctrlKSelection = ref(null)
const ctrlKText = ref('')
const ctrlKPosition = ref(null)
const ctrlKFilePath = ref('')
const ctrlKInputRef = ref(null)

const commandPaletteCommands = computed(() => [
  // File commands
  { id: 'file.new', label: 'Novo Arquivo', icon: '📄', category: 'file', keybinding: 'Ctrl+N', action: () => createNewFile() },
  { id: 'file.newFolder', label: 'Nova Pasta', icon: '📁', category: 'file', action: () => createNewFolder() },
  { id: 'file.save', label: 'Salvar', icon: '💾', category: 'file', keybinding: 'Ctrl+S', action: () => saveActive() },
  { id: 'file.saveAll', label: 'Salvar Tudo', icon: '💾', category: 'file', keybinding: 'Ctrl+K S', action: () => saveAll() },
  
  // Edit commands
  { id: 'edit.find', label: 'Buscar no Arquivo', icon: '🔍', category: 'edit', keybinding: 'Ctrl+F', action: () => triggerFindInMonaco() },
  
  // View commands
  { id: 'view.explorer', label: 'Mostrar Explorer', icon: '📂', category: 'view', keybinding: 'Ctrl+Shift+E', action: () => activeView.value = 'explorer' },
  { id: 'view.search', label: 'Mostrar Busca', icon: '🔍', category: 'view', keybinding: 'Ctrl+Shift+F', action: () => activeView.value = 'search' },
  { id: 'view.git', label: 'Mostrar Git', icon: '🌿', category: 'view', action: () => activeView.value = 'git' },
  { id: 'view.tasks', label: 'Mostrar NPM Scripts', icon: '⚙️', category: 'view', action: () => activeView.value = 'tasks' },
  { id: 'view.terminal', label: 'Abrir Terminal', icon: '💻', category: 'view', keybinding: 'Ctrl+`', action: () => openTerminal() },
  { id: 'view.aiChat', label: 'Abrir Chat IA', icon: '🤖', category: 'view', action: () => openAIChat() },
  
  // Git commands
  { id: 'git.commit', label: 'Git: Commit', icon: '✔️', category: 'git', description: 'Criar commit com mudanças staged', action: () => gitCommit() },
  { id: 'git.push', label: 'Git: Push', icon: '⬆️', category: 'git', description: 'Enviar commits para o remote', action: () => gitPush() },
  { id: 'git.pull', label: 'Git: Pull', icon: '⬇️', category: 'git', description: 'Baixar mudanças do remote', action: () => gitPull() },
  { id: 'git.refresh', label: 'Git: Atualizar Status', icon: '🔄', category: 'git', action: () => loadGitStatus() },
  
  // Settings
  { id: 'settings.open', label: 'Abrir Configurações', icon: '⚙️', category: 'settings', action: () => openSettings() },
  
  // Window
  { id: 'window.reload', label: 'Recarregar Janela', icon: '🔄', category: 'window', action: () => location.reload() },
])

function startResize(e) {
  isResizing.value = true
  document.addEventListener('mousemove', onResize)
  document.addEventListener('mouseup', stopResize)
  document.body.style.cursor = 'ew-resize'
  document.body.style.userSelect = 'none'
  e.preventDefault()
}

function onResize(e) {
  if (!isResizing.value) return
  const newWidth = e.clientX
  sidebarWidth.value = Math.max(minSidebarWidth, Math.min(maxSidebarWidth, newWidth))
  // Atualiza Monaco durante o redimensionamento
  layoutMonaco()
}

function stopResize() {
  isResizing.value = false
  document.removeEventListener('mousemove', onResize)
  document.removeEventListener('mouseup', stopResize)
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
  // Faz layout final do Monaco
  layoutMonaco()
  saveSettingsToFile()
}

// AI Chat resize functions
function startResizeAIChat(e) {
  isResizingAIChat.value = true
  document.addEventListener('mousemove', onResizeAIChat)
  document.addEventListener('mouseup', stopResizeAIChat)
  document.body.style.cursor = 'ew-resize'
  document.body.style.userSelect = 'none'
  e.preventDefault()
}

function onResizeAIChat(e) {
  if (!isResizingAIChat.value) return
  // Calcula a largura a partir da borda direita
  const newWidth = window.innerWidth - e.clientX
  aiChatWidth.value = Math.max(minAIChatWidth, Math.min(maxAIChatWidth, newWidth))
  layoutMonaco()
}

function stopResizeAIChat() {
  isResizingAIChat.value = false
  document.removeEventListener('mousemove', onResizeAIChat)
  document.removeEventListener('mouseup', stopResizeAIChat)
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
  layoutMonaco()
  saveSettingsToFile()
}

// Terminal resize functions
function startResizeTerminal(e) {
  isResizingTerminal.value = true
  document.addEventListener('mousemove', onResizeTerminal)
  document.addEventListener('mouseup', stopResizeTerminal)
  document.body.style.cursor = 'ns-resize'
  document.body.style.userSelect = 'none'
  e.preventDefault()
}

function onResizeTerminal(e) {
  if (!isResizingTerminal.value) return
  // Calcula a altura a partir da borda inferior
  const appHeight = window.innerHeight - 36 - 22 // titlebar + statusbar
  const mouseY = e.clientY - 36 // offset da titlebar
  const newHeight = appHeight - mouseY
  terminalHeight.value = Math.max(minTerminalHeight, Math.min(maxTerminalHeight, newHeight))
  layoutMonaco()
  fitTerminal()
}

function stopResizeTerminal() {
  isResizingTerminal.value = false
  document.removeEventListener('mousemove', onResizeTerminal)
  document.removeEventListener('mouseup', stopResizeTerminal)
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
  layoutMonaco()
  fitTerminal()
  saveSettingsToFile()
}

function openTerminal() {
  isTerminalOpen.value = true
  nextTick(() => {
    layoutMonaco()
    fitTerminal()
  })
  saveSettingsToFile()
}

function closeTerminal() {
  isTerminalOpen.value = false
  nextTick(() => {
    layoutMonaco()
  })
  saveSettingsToFile()
}

function toggleTerminal() {
  if (isTerminalOpen.value) {
    closeTerminal()
  } else {
    openTerminal()
  }
}

function fitTerminal() {
  if (terminalRef.value) {
    terminalRef.value.fit()
  }
}

// NPM Scripts functions
async function loadNpmScripts() {
  if (!workspacePath.value) return
  
  isLoadingScripts.value = true
  try {
    const packageJsonPath = workspacePath.value + '/package.json'
    const content = await window.monarco.readTextFile(packageJsonPath)
    const packageJson = JSON.parse(content)
    
    if (packageJson.scripts) {
      npmScripts.value = Object.entries(packageJson.scripts).map(([name, command]) => ({
        name,
        command,
        running: false
      }))
    } else {
      npmScripts.value = []
    }
  } catch (e) {
    console.error('Failed to load npm scripts', e)
    npmScripts.value = []
  } finally {
    isLoadingScripts.value = false
  }
}

async function runNpmScript(scriptName) {
  if (runningScripts.value.has(scriptName)) {
    window.monarcoToast?.warning('Este script já está em execução')
    return
  }
  
  // Abre o terminal se não estiver aberto
  if (!isTerminalOpen.value) {
    openTerminal()
  }
  
  // Aguarda o terminal abrir
  await nextTick()
  
  // Envia comando para o terminal
  if (terminalRef.value) {
    runningScripts.value.add(scriptName)
    terminalRef.value.sendCommand(`npm run ${scriptName}`)
    window.monarcoToast?.info(`Executando: npm run ${scriptName}`)
    
    // Remove do set após 2 segundos (tempo mínimo)
    setTimeout(() => {
      runningScripts.value.delete(scriptName)
    }, 2000)
  }
}

// Grid template columns computed
const gridTemplateColumns = computed(() => {
  if (isAIChatOpen.value) {
    return `36px ${sidebarWidth.value}px 4px 1fr 4px ${aiChatWidth.value}px`
  }
  return `36px ${sidebarWidth.value}px 4px 1fr`
})

// Color Palette state
const showColorPalette = ref(false)
const colorPaletteRef = ref(null)
const pickedColor = ref(null)

function toggleColorPalette() {
  showColorPalette.value = !showColorPalette.value
}

function activateEyedropper() {
  if (colorPaletteRef.value) {
    colorPaletteRef.value.activateEyedropper()
  }
}

function onColorPicked(color) {
  pickedColor.value = color
}

function clearPickedColor() {
  pickedColor.value = null
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    console.log('Cor copiada:', text)
  })
}

async function refreshTree() {
  if (!workspacePath.value) return
  lastError.value = null
  try {
    const selectedPath = selectedNode.value?.path ?? null
    tree.value = await window.monarco.listWorkspaceTree()
    if (!selectedPath || !tree.value) {
      selectedNode.value = tree.value
      return
    }

    // Try to keep selection by path after refresh. If not found, fallback to root.
    const findByPath = (node) => {
      if (node.path === selectedPath) return node
      if (node.kind === 'dir' && node.children) {
        for (const c of node.children) {
          const found = findByPath(c)
          if (found) return found
        }
      }
      return null
    }

    selectedNode.value = findByPath(tree.value) ?? tree.value
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('refreshTree failed', e)
    lastError.value = msg
  }
}

function onSelectNode(node) {
  selectedNode.value = node
}

const contextMenu = ref({ open: false, x: 0, y: 0, node: null })

const contextMenuWidth = 240
const contextMenuHeight = 250

function openContextMenu(payload) {
  selectedNode.value = payload.node

  const margin = 8
  const maxX = Math.max(margin, window.innerWidth - contextMenuWidth - margin)
  const maxY = Math.max(margin, window.innerHeight - contextMenuHeight - margin)
  const x = Math.max(margin, Math.min(payload.x, maxX))
  const y = Math.max(margin, Math.min(payload.y, maxY))

  contextMenu.value = { open: true, x, y, node: payload.node }
}

function openTreeContextMenu(e) {
  if (!tree.value) return
  const node = selectedNode.value ?? tree.value
  openContextMenu({ node, x: e.clientX, y: e.clientY })
}

function closeContextMenu() {
  contextMenu.value = { open: false, x: 0, y: 0, node: null }
}

function onGlobalPointerDown(e) {
  if (!contextMenu.value.open) return
  const target = e.target
  if (target && target.closest('[data-context-menu="file-tree"]')) return
  closeContextMenu()
}

function onContextMenuRename() {
  closeContextMenu()
  renameSelected()
}

function onContextMenuDelete() {
  closeContextMenu()
  deleteSelected()
}

function onContextMenuNewFile() {
  closeContextMenu()
  createNewFile()
}

function onContextMenuNewFolder() {
  closeContextMenu()
  createNewFolder()
}

function onContextMenuOpen() {
  const n = contextMenu.value.node
  closeContextMenu()
  if (!n) return
  if (n.kind !== 'file') return
  openFile(n.path)
}

async function onContextMenuRefresh() {
  closeContextMenu()
  await refreshTree()
}

function onContextMenuCopyPath() {
  const n = contextMenu.value.node
  closeContextMenu()
  if (!n) return
  navigator.clipboard.writeText(n.path)
}

function onContextMenuCopyRelativePath() {
  const n = contextMenu.value.node
  closeContextMenu()
  if (!n || !workspacePath.value) return
  const relativePath = n.path.replace(workspacePath.value + '/', '')
  navigator.clipboard.writeText(relativePath)
}

function getSelectedDirPath() {
  if (!selectedNode.value) return workspacePath.value
  if (selectedNode.value.kind === 'dir') return selectedNode.value.path
  return selectedNode.value.path.split('/').slice(0, -1).join('/') || workspacePath.value
}

function isSameOrInside(targetPath, basePath) {
  if (targetPath === basePath) return true
  const prefix = basePath.endsWith('/') ? basePath : basePath + '/'
  return targetPath.startsWith(prefix)
}

async function createNewFile() {
  const parentDir = getSelectedDirPath()
  if (!parentDir) return

  crudDialogOpen.value = true
  crudDialogMode.value = 'newFile'
  crudDialogTitle.value = 'New file'
  crudDialogLabel.value = 'File name'
  crudDialogValue.value = ''
  crudDialogTargetPath.value = parentDir
  crudDialogTargetKind.value = 'dir'
}

async function createNewFolder() {
  const parentDir = getSelectedDirPath()
  if (!parentDir) return

  crudDialogOpen.value = true
  crudDialogMode.value = 'newFolder'
  crudDialogTitle.value = 'New folder'
  crudDialogLabel.value = 'Folder name'
  crudDialogValue.value = ''
  crudDialogTargetPath.value = parentDir
  crudDialogTargetKind.value = 'dir'
}

async function renameSelected() {
  if (!selectedNode.value || selectedNode.value.path === workspacePath.value) return
  const currentName = selectedNode.value.name

  crudDialogOpen.value = true
  crudDialogMode.value = 'rename'
  crudDialogTitle.value = 'Rename'
  crudDialogLabel.value = 'New name'
  crudDialogValue.value = currentName
  crudDialogTargetPath.value = selectedNode.value.path
  crudDialogTargetKind.value = selectedNode.value.kind
}

async function deleteSelected() {
  if (!selectedNode.value || selectedNode.value.path === workspacePath.value) return

  crudDialogOpen.value = true
  crudDialogMode.value = 'delete'
  crudDialogTitle.value = 'Delete'
  crudDialogLabel.value = `Delete ${selectedNode.value.kind === 'dir' ? 'folder' : 'file'}: ${selectedNode.value.name}?`
  crudDialogValue.value = ''
  crudDialogTargetPath.value = selectedNode.value.path
  crudDialogTargetKind.value = selectedNode.value.kind
}

function closeCrudDialog() {
  crudDialogOpen.value = false
  crudDialogMode.value = null
  crudDialogTitle.value = ''
  crudDialogLabel.value = ''
  crudDialogValue.value = ''
  crudDialogTargetPath.value = null
  crudDialogTargetKind.value = null
}

async function handleCrudConfirm(value) {
  crudDialogValue.value = value
  await confirmCrudDialog()
}

async function confirmCrudDialog() {
  if (!crudDialogMode.value) return
  lastError.value = null

  try {
    if (crudDialogMode.value === 'newFile') {
      const parentDir = crudDialogTargetPath.value
      if (!parentDir) throw new Error('No target directory')
      const name = crudDialogValue.value.trim()
      if (!name) throw new Error('Name is required')
      const newPath = await window.monarco.createFile(parentDir, name)
      closeCrudDialog()
      await refreshTree()
      await openFile(newPath)
      return
    }

    if (crudDialogMode.value === 'newFolder') {
      const parentDir = crudDialogTargetPath.value
      if (!parentDir) throw new Error('No target directory')
      const name = crudDialogValue.value.trim()
      if (!name) throw new Error('Name is required')
      await window.monarco.createFolder(parentDir, name)
      closeCrudDialog()
      await refreshTree()
      return
    }

    if (crudDialogMode.value === 'rename') {
      const oldPath = crudDialogTargetPath.value
      if (!oldPath) throw new Error('No target path')
      const newName = crudDialogValue.value.trim()
      if (!newName) throw new Error('Name is required')
      const newPath = await window.monarco.renamePath(oldPath, newName)

      for (const t of tabs.value) {
        if (isSameOrInside(t.path, oldPath)) {
          t.path = newPath + t.path.slice(oldPath.length)
          if (t.path === newPath) t.name = newName
        }
      }
      if (activePath.value && isSameOrInside(activePath.value, oldPath)) {
        activePath.value = newPath + activePath.value.slice(oldPath.length)
      }

      closeCrudDialog()
      await refreshTree()
      return
    }

    if (crudDialogMode.value === 'delete') {
      const targetPath = crudDialogTargetPath.value
      if (!targetPath) throw new Error('No target path')
      await window.monarco.deletePath(targetPath)

      const remainingTabs = tabs.value.filter((t) => !isSameOrInside(t.path, targetPath))
      tabs.value.splice(0, tabs.value.length, ...remainingTabs)
      if (activePath.value && isSameOrInside(activePath.value, targetPath)) activePath.value = tabs.value[0]?.path ?? null

      closeCrudDialog()
      await refreshTree()
      selectedNode.value = tree.value
      return
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('confirmCrudDialog failed', e)
    lastError.value = msg
  }
}

const workspacePath = ref(null)
const tree = ref(null)

const lastError = ref(null)

const selectedNode = ref(null)

const expandedMap = ref({})

const isMaximized = ref(false)
const statusLineCol = ref({ line: 1, col: 1 })

function winMinimize() {
  window.monarco.windowMinimize()
}

function winToggleMaximize() {
  window.monarco.windowToggleMaximize()
  setTimeout(() => refreshIsMaximized(), 100) // Delay to allow state update
}

function winClose() {
  window.monarco.windowClose()
}

function refreshIsMaximized() {
  window.monarco.windowIsMaximized().then((maximized) => {
    isMaximized.value = maximized
  })
}

function openAIChat() {
  isAIChatOpen.value = true
  saveSettingsToFile()
}

function closeAIChat() {
  isAIChatOpen.value = false
  saveSettingsToFile()
}

// Handler para ações do menu
function handleMenuAction(action) {
  switch (action) {
    case 'newFile':
      createNewFile()
      break
    case 'newFolder':
      createNewFolder()
      break
    case 'openFolder':
      pickWorkspace()
      break
    case 'toggleAIChat':
      if (isAIChatOpen.value) {
        closeAIChat()
      } else {
        openAIChat()
      }
      break
    case 'toggleExplorer':
      // TODO: Implementar toggle do explorer
      break
    case 'toggleTerminal':
      toggleTerminal()
      break
    case 'find':
      triggerFindInMonaco()
      break
    case 'replace':
      triggerReplaceInMonaco()
      break
    case 'undo':
      executeMonacoAction('undo')
      break
    case 'redo':
      executeMonacoAction('redo')
      break
    case 'cut':
      executeMonacoAction('editor.action.clipboardCutAction')
      break
    case 'copy':
      executeMonacoAction('editor.action.clipboardCopyAction')
      break
    case 'paste':
      // Paste precisa de tratamento especial devido às permissões do clipboard
      navigator.clipboard.readText().then((text) => {
        if (monacoInstance) {
          monacoInstance.trigger('keyboard', 'paste', { text })
        }
      }).catch(() => {
        executeMonacoAction('editor.action.clipboardPasteAction')
      })
      break
    case 'selectAll':
      executeMonacoAction('editor.action.selectAll')
      break
    case 'zoomIn':
      editorSettings.value.fontSize = Math.min(30, editorSettings.value.fontSize + 1)
      saveSettingsToFile()
      break
    case 'zoomOut':
      editorSettings.value.fontSize = Math.max(10, editorSettings.value.fontSize - 1)
      saveSettingsToFile()
      break
    case 'resetZoom':
      editorSettings.value.fontSize = 14
      saveSettingsToFile()
      break
    case 'toggleFullscreen':
      if (document.fullscreenElement) {
        document.exitFullscreen()
      } else {
        document.documentElement.requestFullscreen()
      }
      break
    case 'about':
      alert('Monarco Editor\nVersão 1.0.0\n\nUm editor de código moderno construído com\nElectron + Vue 3 + Monaco Editor')
      break
    default:
      console.log('Menu action not implemented:', action)
  }
}

// Executar ações do Monaco Editor
function executeMonacoAction(actionId) {
  if (monacoInstance) {
    monacoInstance.focus()
    monacoInstance.trigger('menu', actionId, null)
  }
}

// Trigger Replace no Monaco
function triggerReplaceInMonaco() {
  if (!activeTab.value) return
  const input = document.querySelector('.monaco-editor textarea.inputarea')
  if (!input) return
  
  input.focus()
  
  const event = new KeyboardEvent('keydown', {
    key: 'h',
    code: 'KeyH',
    ctrlKey: true,
    bubbles: true,
    cancelable: true
  })
  input.dispatchEvent(event)
}

// Atualiza layout do Monaco quando AI Chat abre/fecha
watch(isAIChatOpen, () => {
  nextTick(() => {
    layoutMonaco()
  })
})

// Carrega NPM scripts quando workspace mudar
watch(workspacePath, (newPath) => {
  if (newPath) {
    // Limpa o expandedMap quando trocar de workspace
    expandedMap.value = {}
    loadNpmScripts()
  }
})

function toggleDir(dirPath) {
  // Agora a lógica é invertida: undefined/false = colapsado, true = expandido
  const isExpanded = expandedMap.value[dirPath] === true
  expandedMap.value = {
    ...expandedMap.value,
    [dirPath]: !isExpanded
  }
}

function updateCursorOffsetFromDom() {
  // TODO: Implement to update cursor offset from DOM
}

const tabs = ref([])
const activePath = ref(null)

const activeTab = computed(() => tabs.value.find((t) => t.path === activePath.value) ?? null)

const hasDirtyTabs = computed(() => tabs.value.some((t) => t.dirty))

const closeConfirmOpen = ref(false)
const closeConfirmTabPath = ref(null)
const closeConfirmResolver = ref(null)

const crudDialogOpen = ref(false)
const crudDialogMode = ref(null)
const crudDialogTitle = ref('')
const crudDialogLabel = ref('')
const crudDialogValue = ref('')
const crudDialogTargetPath = ref(null)
const crudDialogTargetKind = ref(null)

const settingsDialogOpen = ref(false)
const settingsDraft = ref({ fontSize: 14, wordWrap: 'off', tabSize: 2 })
const uiSettingsDraft = ref({ windowControlsPosition: 'left' })
const editorSettings = ref({ fontSize: 14, wordWrap: 'off', tabSize: 2, minimap: true, lineNumbers: 'on' })
const uiSettings = ref({ windowControlsPosition: 'left', theme: 'dark' })
const terminalSettings = ref({ fontSize: 13, fontFamily: 'monospace', cursorBlink: true, cursorStyle: 'block' })

const editorOptions = computed(() => ({
  fontSize: editorSettings.value.fontSize,
  wordWrap: editorSettings.value.wordWrap === 'on',
  tabSize: editorSettings.value.tabSize,
  minimap: { enabled: editorSettings.value.minimap !== false },
  lineNumbers: editorSettings.value.lineNumbers || 'on',
  // Recursos avançados
  suggestOnTriggerCharacters: true,
  quickSuggestions: true,
  wordBasedSuggestions: true,
  formatOnPaste: true,
  formatOnType: true,
  autoClosingBrackets: 'always',
  autoClosingQuotes: 'always',
  autoSurround: 'languageDefined',
  bracketPairColorization: { enabled: true },
  guides: {
    bracketPairs: true,
    indentation: true
  },
  cursorBlinking: 'smooth',
  cursorSmoothCaretAnimation: 'on',
  smoothScrolling: true,
  mouseWheelZoom: true,
  multiCursorModifier: 'ctrlCmd',
  snippetSuggestions: 'top',
  suggest: {
    showKeywords: true,
    showSnippets: true,
    showClasses: true,
    showFunctions: true,
    showVariables: true,
    showModules: true,
    showProperties: true,
    showMethods: true
  },
  folding: true,
  foldingStrategy: 'indentation',
  showFoldingControls: 'always',
  unfoldOnClickAfterEndOfLine: true,
  matchBrackets: 'always',
  renderWhitespace: 'selection',
  renderLineHighlight: 'all',
  scrollBeyondLastLine: false,
  automaticLayout: true
}))

async function loadSettings() {
  try {
    if (!window.monarco?.settings) return
    const settings = await window.monarco.settings.load()
    
    if (settings.editor) {
      editorSettings.value = {
        fontSize: settings.editor.fontSize ?? 14,
        wordWrap: settings.editor.wordWrap ?? 'off',
        tabSize: settings.editor.tabSize ?? 2,
        minimap: settings.editor.minimap !== false,
        lineNumbers: settings.editor.lineNumbers ?? 'on'
      }
    }
    
    if (settings.appearance) {
      uiSettings.value = {
        windowControlsPosition: settings.appearance.windowControlsPosition ?? 'left',
        theme: settings.appearance.theme ?? 'dark'
      }
    }
    
    if (settings.terminal) {
      terminalSettings.value = {
        fontSize: settings.terminal.fontSize ?? 13,
        fontFamily: settings.terminal.fontFamily ?? 'monospace',
        cursorBlink: settings.terminal.cursorBlink !== false,
        cursorStyle: settings.terminal.cursorStyle ?? 'block'
      }
    }
    
    // Carregar estado dos painéis
    if (settings.panels) {
      if (settings.panels.aiChat) {
        isAIChatOpen.value = settings.panels.aiChat.open ?? false
        aiChatWidth.value = settings.panels.aiChat.width ?? 400
      }
      if (settings.panels.terminal) {
        isTerminalOpen.value = settings.panels.terminal.open ?? false
        terminalHeight.value = settings.panels.terminal.height ?? 250
      }
      if (settings.panels.sidebar) {
        sidebarWidth.value = settings.panels.sidebar.width ?? 280
      }
    }
  } catch (e) {
    console.error('Failed to load settings:', e)
  }
}

async function saveSettingsToFile() {
  try {
    if (!window.monarco?.settings) return
    // Converter objetos reativos para plain objects para evitar erro de clonagem no IPC
    await window.monarco.settings.save({
      editor: { ...editorSettings.value },
      appearance: { ...uiSettings.value },
      terminal: { ...terminalSettings.value },
      panels: {
        aiChat: { open: isAIChatOpen.value, width: aiChatWidth.value },
        terminal: { open: isTerminalOpen.value, height: terminalHeight.value },
        sidebar: { width: sidebarWidth.value }
      }
    })
  } catch (e) {
    console.error('Failed to save settings:', e)
  }
}

function openSettings() {
  settingsDraft.value = { ...editorSettings.value }
  uiSettingsDraft.value = { ...uiSettings.value }
  settingsDialogOpen.value = true
}

function closeSettings() {
  settingsDialogOpen.value = false
}

async function handleSettingsSave(settings) {
  // Aplica configurações do editor
  if (settings.editor) {
    editorSettings.value = {
      fontSize: settings.editor.fontSize || 14,
      wordWrap: settings.editor.wordWrap || 'off',
      tabSize: settings.editor.tabSize || 2,
      minimap: settings.editor.minimap !== false,
      lineNumbers: settings.editor.lineNumbers || 'on'
    }
  }
  
  // Aplica configurações de aparência
  if (settings.appearance) {
    uiSettings.value = {
      windowControlsPosition: settings.appearance.windowControlsPosition || 'left',
      theme: settings.appearance.theme || 'dark'
    }
  }
  
  // Aplica configurações de terminal
  if (settings.terminal) {
    terminalSettings.value = {
      fontSize: settings.terminal.fontSize || 13,
      fontFamily: settings.terminal.fontFamily || 'monospace',
      cursorBlink: settings.terminal.cursorBlink !== false,
      cursorStyle: settings.terminal.cursorStyle || 'block'
    }
  }
  
  // Salva no arquivo ~/.monarco/settings.json
  await saveSettingsToFile()
  console.log('Settings saved to file')
}

async function saveSettings() {
  const next = {
    fontSize: Math.max(10, Math.min(30, Number(settingsDraft.value.fontSize) || 14)),
    wordWrap: settingsDraft.value.wordWrap === 'on' ? 'on' : 'off',
    tabSize: Math.max(1, Math.min(8, Number(settingsDraft.value.tabSize) || 2)),
    minimap: editorSettings.value.minimap,
    lineNumbers: editorSettings.value.lineNumbers
  }

  const nextUi = {
    windowControlsPosition: uiSettingsDraft.value.windowControlsPosition === 'left' ? 'left' : 'right',
    theme: uiSettings.value.theme
  }
  
  editorSettings.value = next
  uiSettings.value = nextUi
  await saveSettingsToFile()
  settingsDialogOpen.value = false
}

const activeBreadcrumb = computed(() => {
  if (!activeTab.value) return null
  if (!workspacePath.value) return activeTab.value.path
  const ws = workspacePath.value
  if (activeTab.value.path === ws) return ws
  const prefix = ws.endsWith('/') ? ws : ws + '/'
  if (activeTab.value.path.startsWith(prefix)) return activeTab.value.path.slice(prefix.length)
})

function languageForPath(filePath) {
  const lower = filePath.toLowerCase()
  if (lower.endsWith('.js') || lower.endsWith('.jsx') || lower.endsWith('.mjs') || lower.endsWith('.cjs')) {
    return 'javascript'
  }
  if (lower.endsWith('.ts') || lower.endsWith('.tsx')) {
    return 'typescript'
  }
  if (lower.endsWith('.go')) return 'go'
  if (lower.endsWith('.html')) return 'html'
  if (lower.endsWith('.css')) return 'css'
  if (lower.endsWith('.sh') || lower.endsWith('.bash')) return 'shell'
  if (lower.endsWith('.json')) return 'json'
  if (lower.endsWith('.md')) return 'markdown'
  return 'plaintext'
}

async function pickWorkspace() {
  lastError.value = null
  try {
    const selected = await window.monarco.selectWorkspace()
    if (!selected) return

    workspacePath.value = selected
    tree.value = await window.monarco.listWorkspaceTree()
    selectedNode.value = tree.value
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('pickWorkspace failed', e)
    lastError.value = msg
  }
}

async function openFile(filePath) {
  lastError.value = null
  try {
    const existing = tabs.value.find((t) => t.path === filePath)
    if (existing) {
      activePath.value = existing.path
      return
    }

    const contents = await window.monarco.readTextFile(filePath)
    const name = filePath.split('/').pop() ?? filePath
    const tab = {
      path: filePath,
      name,
      language: languageForPath(filePath),
      value: contents,
      dirty: false
    }

    tabs.value.push(tab)
    activePath.value = tab.path
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('openFile failed', filePath, e)
    lastError.value = msg
  }
}

// Abre arquivo Git (caminho relativo ao workspace)
function openGitFile(relativePath) {
  if (!workspacePath.value) return
  
  // Constrói o caminho absoluto
  const separator = workspacePath.value.includes('\\') ? '\\' : '/'
  const fullPath = workspacePath.value + separator + relativePath
  
  openFile(fullPath)
}

// Search in workspace
async function performSearch() {
  if (!searchQuery.value.trim()) {
    searchResults.value = []
    return
  }

  isSearching.value = true
  try {
    const results = await window.monarco.searchFiles(searchQuery.value, {
      searchContent: searchInContent.value,
      caseSensitive: searchCaseSensitive.value,
      useRegex: searchUseRegex.value,
      maxResults: 500
    })
    
    // Adiciona highlight e contexto aos resultados
    searchResults.value = results.map(result => {
      if (result.type === 'match' && result.text) {
        const query = searchQuery.value
        let highlightedText = result.text
        
        // Highlight do match
        if (!searchUseRegex.value) {
          const flags = searchCaseSensitive.value ? 'g' : 'gi'
          const regex = new RegExp(escapeRegExp(query), flags)
          highlightedText = result.text.replace(regex, match => `<mark>${match}</mark>`)
        }
        
        return { ...result, highlightedText }
      }
      return result
    })
    
    // Notificação de sucesso
    if (results.length > 0) {
      window.monarcoToast?.success(`${results.length} resultado${results.length > 1 ? 's' : ''} encontrado${results.length > 1 ? 's' : ''}`, { duration: 2000 })
    } else {
      window.monarcoToast?.info('Nenhum resultado encontrado')
    }
  } catch (e) {
    console.error('Search failed', e)
    lastError.value = e.message
    window.monarcoToast?.error('Erro na busca', { description: e.message })
  } finally {
    isSearching.value = false
  }
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function openSearchResult(result) {
  if (result.type === 'directory') return
  
  // Abre o arquivo
  openFile(result.fullPath)
  
  // Se tiver número de linha, posiciona o cursor
  if (result.line && monacoInstance) {
    nextTick(() => {
      try {
        monacoInstance.revealLineInCenter(result.line)
        monacoInstance.setPosition({ lineNumber: result.line, column: 1 })
        monacoInstance.focus()
      } catch (e) {
        console.error('Failed to position cursor:', e)
      }
    })
  }
}

// Git functions
async function loadGitStatus() {
  if (!workspacePath.value) return
  
  isLoadingGit.value = true
  try {
    isGitRepo.value = await window.monarco.git.isRepository()
    
    if (isGitRepo.value) {
      const [status, branch] = await Promise.all([
        window.monarco.git.status(),
        window.monarco.git.currentBranch()
      ])
      gitStatus.value = status
      gitBranch.value = branch
    }
  } catch (e) {
    console.error('Failed to load git status', e)
  } finally {
    isLoadingGit.value = false
  }
}

async function gitStageFile(filePath) {
  try {
    await window.monarco.git.stage(filePath)
    await loadGitStatus()
  } catch (e) {
    console.error('Failed to stage file', e)
    lastError.value = e.message
  }
}

async function gitUnstageFile(filePath) {
  try {
    await window.monarco.git.unstage(filePath)
    await loadGitStatus()
  } catch (e) {
    console.error('Failed to unstage file', e)
    lastError.value = e.message
  }
}

async function gitDiscardFile(filePath) {
  if (!confirm(`Discard changes in ${filePath}?`)) return
  
  try {
    await window.monarco.git.discard(filePath)
    await loadGitStatus()
    await refreshTree()
  } catch (e) {
    console.error('Failed to discard file', e)
    lastError.value = e.message
  }
}

async function gitCommit() {
  if (!gitCommitMessage.value.trim()) {
    window.monarcoToast?.warning('Por favor, insira uma mensagem de commit')
    return
  }
  
  try {
    await window.monarco.git.commit(gitCommitMessage.value)
    gitCommitMessage.value = ''
    await loadGitStatus()
    window.monarcoToast?.success('Commit realizado com sucesso!')
  } catch (e) {
    console.error('Failed to commit', e)
    
    // Verifica se o erro é de configuração Git
    if (e.message.includes('não está configurado') || e.message.includes('user.name') || e.message.includes('user.email')) {
      const userName = prompt('Configure o Git:\n\nDigite seu nome:')
      if (!userName) return
      
      const userEmail = prompt('Digite seu email:')
      if (!userEmail) return
      
      try {
        await window.monarco.git.config('user.name', userName)
        await window.monarco.git.config('user.email', userEmail)
        
        // Tenta commit novamente
        await window.monarco.git.commit(gitCommitMessage.value)
        gitCommitMessage.value = ''
        await loadGitStatus()
        window.monarcoToast?.success('Git configurado e commit realizado!', { duration: 4000 })
      } catch (configError) {
        console.error('Failed to configure git', configError)
        lastError.value = configError.message
        window.monarcoToast?.error('Erro ao configurar Git', { description: configError.message })
      }
    } else {
      lastError.value = e.message
      window.monarcoToast?.error('Erro ao fazer commit', { description: e.message })
    }
  }
}

async function gitInitRepo() {
  try {
    await window.monarco.git.init()
    await loadGitStatus()
  } catch (e) {
    console.error('Failed to init git', e)
    lastError.value = e.message
  }
}

async function gitPull() {
  isLoadingGit.value = true
  try {
    const result = await window.monarco.git.pull()
    await loadGitStatus()
    window.monarcoToast?.success('Pull realizado com sucesso!', { description: result.message, duration: 4000 })
  } catch (e) {
    console.error('Failed to pull', e)
    lastError.value = e.message
    window.monarcoToast?.error('Erro ao fazer pull', { description: e.message })
  } finally {
    isLoadingGit.value = false
  }
}

async function gitPush() {
  isLoadingGit.value = true
  try {
    const result = await window.monarco.git.push()
    await loadGitStatus()
    window.monarcoToast?.success('Push realizado com sucesso!', { description: result.message, duration: 4000 })
  } catch (e) {
    console.error('Failed to push', e)
    lastError.value = e.message
    window.monarcoToast?.error('Erro ao fazer push', { description: e.message })
  } finally {
    isLoadingGit.value = false
  }
}

async function loadGitBranches() {
  try {
    const branches = await window.monarco.git.branches()
    gitBranches.value = branches
  } catch (e) {
    console.error('Failed to load branches', e)
    lastError.value = e.message
  }
}

async function gitCheckout(branchName) {
  if (!confirm(`Trocar para a branch "${branchName}"?`)) return
  
  isLoadingGit.value = true
  try {
    await window.monarco.git.checkout(branchName)
    await Promise.all([loadGitStatus(), loadGitBranches()])
    await refreshTree()
    window.monarcoToast?.success(`Branch trocada para "${branchName}"`)
  } catch (e) {
    console.error('Failed to checkout branch', e)
    lastError.value = e.message
    window.monarcoToast?.error('Erro ao trocar de branch', { description: e.message })
  } finally {
    isLoadingGit.value = false
  }
}

async function gitCreateBranch() {
  const name = newBranchName.value.trim()
  if (!name) {
    window.monarcoToast?.warning('Por favor, insira um nome para a branch')
    return
  }
  
  isLoadingGit.value = true
  try {
    await window.monarco.git.createBranch(name)
    await Promise.all([loadGitStatus(), loadGitBranches()])
    newBranchName.value = ''
    showBranchDialog.value = false
    window.monarcoToast?.success(`Branch "${name}" criada com sucesso!`)
  } catch (e) {
    console.error('Failed to create branch', e)
    lastError.value = e.message
    window.monarcoToast?.error('Erro ao criar branch', { description: e.message })
  } finally {
    isLoadingGit.value = false
  }
}

async function gitDeleteBranch(branchName) {
  if (!confirm(`Deletar a branch "${branchName}"?\n\nATENÇÃO: Esta ação não pode ser desfeita!`)) return
  
  isLoadingGit.value = true
  try {
    await window.monarco.git.deleteBranch(branchName)
    await Promise.all([loadGitStatus(), loadGitBranches()])
    window.monarcoToast?.success(`Branch "${branchName}" deletada com sucesso!`)
  } catch (e) {
    console.error('Failed to delete branch', e)
    lastError.value = e.message
    window.monarcoToast?.error('Erro ao deletar branch', { description: e.message })
  } finally {
    isLoadingGit.value = false
  }
}

function toggleBranchesPanel() {
  showBranchesPanel.value = !showBranchesPanel.value
  if (showBranchesPanel.value && gitBranches.value.length === 0) {
    loadGitBranches()
  }
}

function openBranchDialog() {
  newBranchName.value = ''
  showBranchDialog.value = true
}

function closeBranchDialog() {
  showBranchDialog.value = false
  newBranchName.value = ''
}

async function loadGitCommits(reset = false) {
  if (reset) {
    gitCommits.value = []
  }
  
  isLoadingCommits.value = true
  try {
    const skip = reset ? 0 : gitCommits.value.length
    const commits = await window.monarco.git.log({ limit: 20, skip })
    
    if (reset) {
      gitCommits.value = commits
    } else {
      gitCommits.value = [...gitCommits.value, ...commits]
    }
  } catch (e) {
    console.error('Failed to load commits', e)
    lastError.value = e.message
  } finally {
    isLoadingCommits.value = false
  }
}

function toggleCommitsPanel() {
  showCommitsPanel.value = !showCommitsPanel.value
  if (showCommitsPanel.value && gitCommits.value.length === 0) {
    loadGitCommits(true)
  }
}

function formatCommitDate(dateStr) {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now - date
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)
  
  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

async function showFileDiff(filePath, staged = false) {
  try {
    const diff = await window.monarco.git.diff(filePath, staged)
    
    if (!diff) {
      window.monarcoToast?.info('Sem mudanças para exibir')
      return
    }
    
    diffFilePath.value = filePath
    diffStaged.value = staged
    diffContent.value = diff
    showDiffModal.value = true
  } catch (e) {
    console.error('Failed to get diff', e)
    lastError.value = e.message
    window.monarcoToast?.error('Erro ao carregar diff', { description: e.message })
  }
}

function closeDiffModal() {
  showDiffModal.value = false
  diffContent.value = ''
  diffFilePath.value = ''
  diffStaged.value = false
}

const parsedDiff = computed(() => {
  if (!diffContent.value) return []
  
  const lines = diffContent.value.split('\n')
  const result = []
  
  for (const line of lines) {
    let type = 'normal'
    if (line.startsWith('+++') || line.startsWith('---')) {
      type = 'header'
    } else if (line.startsWith('@@')) {
      type = 'hunk'
    } else if (line.startsWith('+')) {
      type = 'add'
    } else if (line.startsWith('-')) {
      type = 'delete'
    } else if (line.startsWith('diff --git')) {
      type = 'file'
    }
    
    result.push({ text: line, type })
  }
  
  return result
})

const stagedFiles = computed(() => gitStatus.value.filter(f => f.staged))
const unstagedFiles = computed(() => gitStatus.value.filter(f => f.unstaged && !f.staged))

function getGitStatusIcon(status) {
  switch (status) {
    case 'modified': return 'M'
    case 'added': return 'A'
    case 'deleted': return 'D'
    case 'renamed': return 'R'
    case 'untracked': return 'U'
    case 'conflict': return 'C'
    default: return '?'
  }
}

function removeTab(filePath) {
  const idx = tabs.value.findIndex((t) => t.path === filePath)
  if (idx === -1) return

  const wasActive = activePath.value === filePath
  tabs.value.splice(idx, 1)

  if (wasActive) {
    activePath.value = tabs.value[idx - 1]?.path ?? tabs.value[0]?.path ?? null
  }
}

function askCloseDecision(filePath) {
  closeConfirmOpen.value = true
  closeConfirmTabPath.value = filePath

  return new Promise((resolve) => {
    closeConfirmResolver.value = resolve
  })
}

function resolveCloseDecision(decision) {
  closeConfirmOpen.value = false
  const resolver = closeConfirmResolver.value
  closeConfirmResolver.value = null
  closeConfirmTabPath.value = null
  if (resolver) resolver(decision)
}

async function closeTab(filePath) {
  const tab = tabs.value.find((t) => t.path === filePath)
  if (!tab) return

  if (!tab.dirty) {
    removeTab(filePath)
    return
  }

  const decision = await askCloseDecision(filePath)
  if (decision === 'cancel') return

  if (decision === 'save') {
    lastError.value = null
    try {
      await window.monarco.writeTextFile(tab.path, tab.value)
      tab.dirty = false
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error('closeTab save failed', e)
      lastError.value = msg
      return
    }
  }

  removeTab(filePath)
}

async function saveActive() {
  if (!activeTab.value) return
  lastError.value = null
  try {
    await window.monarco.writeTextFile(activeTab.value.path, activeTab.value.value)
    activeTab.value.dirty = false
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('saveActive failed', e)
    lastError.value = msg
  }
}

async function saveAll() {
  lastError.value = null
  const dirtyTabs = tabs.value.filter((t) => t.dirty)
  if (dirtyTabs.length === 0) return

  try {
    for (const t of dirtyTabs) {
      await window.monarco.writeTextFile(t.path, t.value)
      t.dirty = false
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('saveAll failed', e)
    lastError.value = msg
  }
}

function triggerFindInMonaco() {
  const input = document.querySelector('.monaco-editor textarea.inputarea')
  if (!input) return

  input.focus()

  const down = new KeyboardEvent('keydown', {
    key: 'f',
    code: 'KeyF',
    ctrlKey: true,
    bubbles: true,
    cancelable: true
  })
  input.dispatchEvent(down)

  const up = new KeyboardEvent('keyup', {
    key: 'f',
    code: 'KeyF',
    ctrlKey: true,
    bubbles: true,
    cancelable: true
  })
  input.dispatchEvent(up)
}

function onEditorChange(v) {
  if (!activeTab.value) return
  activeTab.value.value = v
  activeTab.value.dirty = true
}

function executeCommandPaletteAction(command) {
  if (command && command.action) {
    command.action()
  }
}

// ========================================
// CTRL+K - Edição Inline com IA
// ========================================

function handleCtrlKEvent(event) {
  const { selection, text, position, filePath } = event.detail
  
  ctrlKSelection.value = selection
  ctrlKText.value = text
  ctrlKPosition.value = position
  ctrlKFilePath.value = filePath
  ctrlKInput.value = ''
  showCtrlKPopup.value = true
  
  // Focar no input após o popup aparecer
  nextTick(() => {
    ctrlKInputRef.value?.focus()
  })
}

function cancelCtrlK() {
  showCtrlKPopup.value = false
  ctrlKInput.value = ''
  ctrlKLoading.value = false
  ctrlKSelection.value = null
  ctrlKText.value = ''
  
  // Retornar foco ao editor
  if (monacoInstance) {
    monacoInstance.focus()
  }
}

async function submitCtrlK() {
  if (!ctrlKInput.value.trim() || ctrlKLoading.value) return
  
  ctrlKLoading.value = true
  
  try {
    const instruction = ctrlKInput.value.trim()
    const selectedCode = ctrlKText.value
    const filePath = ctrlKFilePath.value
    const selection = ctrlKSelection.value
    
    // Prompt especial para edição inline
    const message = `Edit the following code according to this instruction: "${instruction}"

IMPORTANT: Return ONLY the modified code. No explanations, no markdown code blocks, no comments about the changes. Just the raw code that should replace the selection.

Code to edit:
${selectedCode}`
    
    // Enviar para a IA (modo simples, sem tools)
    const result = await window.monarco.ai.chat(message, { useTools: false })
    
    if (result.content) {
      // Limpar possíveis markdown code blocks da resposta
      let newCode = result.content.trim()
      
      // Remover markdown code blocks se existirem
      const codeBlockMatch = newCode.match(/^```\w*\n?([\s\S]*?)\n?```$/)
      if (codeBlockMatch) {
        newCode = codeBlockMatch[1]
      }
      
      // Aplicar a mudança no editor
      if (monacoInstance && selection) {
        const model = monacoInstance.getModel()
        if (model) {
          // Criar a operação de edição
          monacoInstance.executeEdits('ai-inline-edit', [{
            range: selection,
            text: newCode,
            forceMoveMarkers: true
          }])
          
          // Marcar arquivo como modificado
          if (activeTab.value) {
            activeTab.value.dirty = true
          }
          
          window.monarcoToast?.success('Código editado com sucesso!')
        }
      }
    } else {
      window.monarcoToast?.error('A IA não retornou uma resposta válida')
    }
  } catch (error) {
    console.error('Erro ao processar Ctrl+K:', error)
    window.monarcoToast?.error('Erro ao processar: ' + error.message)
  } finally {
    cancelCtrlK()
  }
}

function onKeyDown(e) {
  if (!e.isTrusted) return

  if (e.key === 'Escape') {
    // Fechar popup do Ctrl+K se estiver aberto
    if (showCtrlKPopup.value) {
      cancelCtrlK()
      return
    }
    closeContextMenu()
    return
  }

  const isCmdOrCtrl = e.metaKey || e.ctrlKey
  if (isCmdOrCtrl && e.key.toLowerCase() === 's') {
    e.preventDefault()
    saveActive()
  }

  if (isCmdOrCtrl && e.key.toLowerCase() === 'f') {
    const targetEl = e.target
    if (targetEl && targetEl.closest('.monaco-editor') && targetEl.matches('textarea.inputarea')) {
      return
    }

    e.preventDefault()
    if (!activeTab.value) return
    triggerFindInMonaco()
  }

  if (isCmdOrCtrl && e.key.toLowerCase() === 'l') {
    e.preventDefault()
    openAIChat()
  }

  if (isCmdOrCtrl && e.shiftKey && e.key.toLowerCase() === ',') {
    e.preventDefault()
    openSettings()
  }

  // Ctrl+` para toggle terminal
  if (isCmdOrCtrl && e.key === '`') {
    e.preventDefault()
    toggleTerminal()
  }

  // Ctrl+Shift+P para Command Palette
  if (isCmdOrCtrl && e.shiftKey && e.key.toLowerCase() === 'p') {
    e.preventDefault()
    showCommandPalette.value = true
  }
}

onMounted(async () => {
  refreshIsMaximized()
  await loadSettings()
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', updateCursorOffsetFromDom, true)
  window.addEventListener('mouseup', updateCursorOffsetFromDom, true)
  window.addEventListener('pointerdown', onGlobalPointerDown)
  
  // Listener para redimensionamento da janela
  window.addEventListener('resize', layoutMonaco)
  
  // Expor API do editor para o chat da IA
  window.monarcoEditor = {
    // Retorna o caminho do arquivo atualmente focado
    getCurrentFile: () => activePath.value,
    
    // Retorna todas as abas abertas
    getOpenTabs: () => tabs.value.map(t => ({ path: t.path, name: t.name, dirty: t.dirty })),
    
    // Abre um arquivo em uma aba
    openFile: (filePath) => openFile(filePath),
    
    // Retorna o workspace atual
    getWorkspace: () => workspacePath.value,
    
    // Busca um arquivo pelo nome no projeto
    findFile: async (fileName) => {
      try {
        // Busca recursiva na árvore
        const searchInTree = (nodes, target) => {
          for (const node of nodes) {
            if (node.type === 'file' && node.name === target) {
              return node.path
            }
            if (node.children) {
              const found = searchInTree(node.children, target)
              if (found) return found
            }
          }
          return null
        }
        
        // Primeiro tenta nome exato
        let found = searchInTree(tree.value, fileName)
        if (found) return found
        
        // Tenta com extensão parcial
        const baseName = fileName.split('/').pop()
        found = searchInTree(tree.value, baseName)
        if (found) return found
        
        return null
      } catch (e) {
        console.error('Erro ao buscar arquivo:', e)
        return null
      }
    },
    
    // Atualiza o conteúdo de um arquivo aberto
    updateFileContent: (filePath, content) => {
      const tab = tabs.value.find(t => t.path === filePath)
      if (tab) {
        tab.value = content
        tab.dirty = true
        if (activePath.value === filePath && monacoInstance) {
          const currentPosition = monacoInstance.getPosition()
          monacoInstance.setValue(content)
          if (currentPosition) {
            monacoInstance.setPosition(currentPosition)
          }
        }
        return true
      }
      return false
    }
  }
  
  // Listener para mudanças no filesystem (IA criando/editando arquivos)
  if (window.monarco?.onFileSystemChange) {
    window.monarco.onFileSystemChange(async (changeInfo) => {
      console.log('Filesystem changed:', changeInfo)
      
      // Atualiza FileTree
      await refreshTree()
      
      // Se o arquivo modificado está aberto, recarrega
      if (changeInfo.type === 'modified' && changeInfo.path) {
        const openTab = tabs.value.find(t => t.path === changeInfo.path)
        if (openTab && !openTab.dirty) {
          try {
            const content = await window.monarco.readTextFile(changeInfo.path)
            openTab.value = content
            
            // Atualiza Monaco se for a aba ativa
            if (activePath.value === changeInfo.path && monacoInstance) {
              const currentPosition = monacoInstance.getPosition()
              monacoInstance.setValue(content)
              if (currentPosition) {
                monacoInstance.setPosition(currentPosition)
              }
            }
          } catch (e) {
            console.error('Erro ao recarregar arquivo:', e)
          }
        }
      }
    })
  }
  
  // Carrega o último workspace automaticamente
  try {
    const lastWorkspace = await window.monarco.workspace.getLast()
    if (lastWorkspace && lastWorkspace.path) {
      const path = await window.monarco.workspace.openRecent(lastWorkspace.path)
      if (path) {
        workspacePath.value = path
        await refreshTree()
      }
    }
  } catch (e) {
    console.log('Não foi possível carregar o último workspace:', e.message)
  }
  
  // ResizeObserver para o container do editor
  nextTick(() => {
    const editorContainer = document.querySelector('.editorWrap')
    if (editorContainer) {
      resizeObserver = new ResizeObserver(() => {
        layoutMonaco()
      })
      resizeObserver.observe(editorContainer)
    }
  })
  
  // Listener para Ctrl+K (edição inline com IA)
  window.addEventListener('monarco:ctrlk', handleCtrlKEvent)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('keyup', updateCursorOffsetFromDom, true)
  window.removeEventListener('mouseup', updateCursorOffsetFromDom, true)
  window.removeEventListener('pointerdown', onGlobalPointerDown)
  window.removeEventListener('resize', layoutMonaco)
  window.removeEventListener('monarco:ctrlk', handleCtrlKEvent)
  
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
})
</script>

<template>
  <div class="appShell">
    <TitleBar
      :title="'Monarco'"
      :window-controls-position="uiSettings.windowControlsPosition"
      :is-maximized="isMaximized"
      :has-dirty-tabs="hasDirtyTabs"
      :has-dirty-active-tab="!!(activeTab && activeTab.dirty)"
      @minimize="winMinimize"
      @toggle-maximize="winToggleMaximize"
      @close="winClose"
      @save-all="saveAll"
      @save-active="saveActive"
      @open-settings="openSettings"
      @menu-action="handleMenuAction"
    />

    <div class="app" :style="{ gridTemplateColumns: gridTemplateColumns }">
    
    <!-- Componente de Settings -->
    <Settings 
      v-if="settingsDialogOpen" 
      :is-open="settingsDialogOpen"
      @close="closeSettings"
      @save="handleSettingsSave"
    />

    <!-- Dialog CRUD (criar/renomear/deletar) -->
    <CrudDialog
      :is-open="crudDialogOpen"
      :mode="crudDialogMode"
      :title="crudDialogTitle"
      :label="crudDialogLabel"
      :initial-value="crudDialogValue"
      @confirm="handleCrudConfirm"
      @cancel="closeCrudDialog"
    />

    <!-- Dialog de confirmação para fechar aba -->
    <ConfirmDialog
      :is-open="closeConfirmOpen"
      title="Alterações não salvas"
      message="Este arquivo possui alterações não salvas. O que deseja fazer?"
      confirm-text="Salvar"
      cancel-text="Cancelar"
      discard-text="Descartar"
      :show-discard="true"
      @confirm="resolveCloseDecision('save')"
      @cancel="resolveCloseDecision('cancel')"
      @discard="resolveCloseDecision('discard')"
    />

    <!-- Dialog para criar nova branch -->
    <div v-if="showBranchDialog" class="dialog-overlay" @click="closeBranchDialog">
      <div class="dialog" @click.stop style="max-width: 400px;">
        <div class="dialog-header">
          <h3 style="margin: 0; font-size: 14px;">Create New Branch</h3>
          <button class="dialog-close" @click="closeBranchDialog" title="Close">×</button>
        </div>
        <div class="dialog-body" style="padding: 16px;">
          <label style="display: block; margin-bottom: 8px; font-size: 12px; font-weight: 500;">Branch name:</label>
          <input 
            v-model="newBranchName"
            type="text" 
            placeholder="e.g., feature/new-feature"
            @keyup.enter="gitCreateBranch"
            @keyup.esc="closeBranchDialog"
            style="width: 100%; padding: 8px; font-size: 13px; background: var(--bg); color: var(--text); border: 1px solid var(--border); border-radius: 4px;"
            autofocus
          />
        </div>
        <div class="dialog-footer" style="display: flex; gap: 8px; justify-content: flex-end; padding: 12px 16px; border-top: 1px solid var(--border);">
          <button @click="closeBranchDialog" style="padding: 6px 12px; font-size: 12px;">Cancel</button>
          <button 
            @click="gitCreateBranch" 
            :disabled="!newBranchName.trim()"
            style="padding: 6px 12px; font-size: 12px; background: var(--accent); color: white;"
          >
            Create
          </button>
        </div>
      </div>
    </div>

    <!-- Modal de Diff -->
    <div v-if="showDiffModal" class="dialog-overlay" @click="closeDiffModal">
      <div class="dialog" @click.stop style="max-width: 90vw; width: 1000px; max-height: 90vh;">
        <div class="dialog-header">
          <h3 style="margin: 0; font-size: 14px;">
            Diff: {{ diffFilePath }}
            <span style="margin-left: 8px; font-size: 11px; color: var(--muted);">
              ({{ diffStaged ? 'staged' : 'unstaged' }})
            </span>
          </h3>
          <button class="dialog-close" @click="closeDiffModal" title="Close">×</button>
        </div>
        <div class="dialog-body" style="padding: 0; overflow: auto;">
          <div class="diff-viewer">
            <div 
              v-for="(line, idx) in parsedDiff" 
              :key="idx"
              :class="['diff-line', 'diff-line-' + line.type]"
            >
              <pre style="margin: 0; padding: 4px 8px; font-size: 12px; font-family: 'Courier New', monospace; white-space: pre-wrap; word-wrap: break-word;">{{ line.text }}</pre>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Activity Bar -->
    <ActivityBar
      :active-view="activeView"
      @select="activeView = $event; if ($event === 'git') loadGitStatus()"
      @settings="openSettings"
    />

    <aside class="sidebar">
      <!-- Explorer View -->
      <div v-show="activeView === 'explorer'" class="sidebar-content">
        <div class="sidebarHeader">
          <button @click="pickWorkspace" title="Open folder">
            <span class="icon-folder-open"></span>
          </button>
          <button :disabled="!workspacePath" @click="createNewFile" title="New File">
            <span class="icon-file-plus"></span>
          </button>
          <button :disabled="!workspacePath" @click="createNewFolder" title="New Folder">
            <span class="icon-folder-plus"></span>
          </button>
          <button :disabled="!selectedNode || selectedNode.path === workspacePath" @click="renameSelected" title="Rename">
            <span class="icon-pen-to-square"></span>
          </button>
          <button :disabled="!selectedNode || selectedNode.path === workspacePath" @click="deleteSelected" title="Delete">
            <span class="icon-trash"></span>
          </button>
          <button @click="openAIChat" title="IA Chat">
            <span class="icon-comment-dots"></span>
          </button>
          <button @click="toggleTerminal" title="Terminal (Ctrl+`)">
            <span class="icon-terminal"></span>
          </button>
          <div class="path">{{ workspacePath ?? 'No folder selected' }}</div>
        </div>

        <div class="tree">
          <div class="treeArea" @contextmenu.prevent="openTreeContextMenu">
            <div v-if="!tree" class="emptyState">
              Select a folder to start.
            </div>
            <div v-else>
              <FileTree
                :node="tree"
                :selectedPath="selectedNode?.path ?? null"
                :expanded-map="expandedMap"
                @open="openFile"
                @select="onSelectNode"
                @toggle="toggleDir"
                @context="openContextMenu"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Search View -->
      <div v-show="activeView === 'search'" class="sidebar-content">
        <div class="sidebarHeader">
          <h3 style="margin: 0; font-size: 13px; font-weight: 600;">SEARCH</h3>
        </div>
        <div class="search-panel">
          <div class="search-input-container">
            <input 
              v-model="searchQuery"
              type="text" 
              placeholder="Search in workspace..." 
              class="search-input"
              @keyup.enter="performSearch"
            />
            <button 
              class="search-btn" 
              title="Search"
              @click="performSearch"
              :disabled="!searchQuery.trim() || isSearching"
            >
              <span v-if="isSearching">⏳</span>
              <span v-else class="icon-magnifying-glass"></span>
            </button>
          </div>
          
          <!-- Opções de busca -->
          <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px; padding: 0 4px;">
            <label style="display: flex; align-items: center; gap: 4px; cursor: pointer; font-size: 12px;">
              <input 
                v-model="searchInContent" 
                type="checkbox" 
                style="cursor: pointer;"
              />
              <span>Buscar no conteúdo dos arquivos</span>
            </label>
            
            <label style="display: flex; align-items: center; gap: 4px; cursor: pointer; font-size: 12px;">
              <input 
                v-model="searchCaseSensitive" 
                type="checkbox" 
                style="cursor: pointer;"
              />
              <span>Maiúsculas/minúsculas (Aa)</span>
            </label>
            
            <label style="display: flex; align-items: center; gap: 4px; cursor: pointer; font-size: 12px;">
              <input 
                v-model="searchUseRegex" 
                type="checkbox" 
                style="cursor: pointer;"
              />
              <span>Usar expressão regular (.*)</span>
            </label>
          </div>

          <div v-if="isSearching" class="emptyState" style="padding: 20px; text-align: center;">
            Buscando...
          </div>

          <div v-else-if="searchResults.length === 0 && searchQuery" class="emptyState" style="padding: 20px; text-align: center;">
            Nenhum resultado
          </div>

          <div v-else-if="searchResults.length > 0" class="search-results">
            <div class="search-result-header">
              {{ searchResults.length }} resultado{{ searchResults.length > 1 ? 's' : '' }}
            </div>
            <div 
              v-for="(result, idx) in searchResults" 
              :key="idx" 
              class="search-result-item"
              @click="openSearchResult(result)"
            >
              <div class="search-result-icon">
                <span v-if="result.type === 'directory'" style="color: var(--accent);">📁</span>
                <span v-else-if="result.type === 'file'" style="color: var(--text);">📄</span>
                <span v-else style="color: var(--muted);">📝</span>
              </div>
              <div class="search-result-content">
                <div class="search-result-path">{{ result.path }}</div>
                <div v-if="result.type === 'match'" class="search-result-match">
                  <span class="search-result-line">Linha {{ result.line }}:</span>
                  <span 
                    class="search-result-text"
                    v-html="result.highlightedText || result.text"
                  ></span>
                </div>
              </div>
            </div>
          </div>

          <div v-else class="emptyState" style="padding: 20px; text-align: center;">
            Digite para buscar no workspace
          </div>
        </div>
      </div>

      <!-- Source Control View -->
      <div v-show="activeView === 'git'" class="sidebar-content">
        <div class="sidebarHeader">
          <h3 style="margin: 0; font-size: 13px; font-weight: 600;">SOURCE CONTROL</h3>
          <span v-if="gitBranch" style="font-size: 11px; color: var(--muted); margin-left: 8px;">
            {{ gitBranch }}
          </span>
          <div style="margin-left: auto; display: flex; gap: 4px;">
            <button 
              @click="gitPull" 
              :disabled="isLoadingGit"
              title="Pull"
              style="padding: 4px 8px; font-size: 11px;"
            >
              ⬇️
            </button>
            <button 
              @click="gitPush" 
              :disabled="isLoadingGit"
              title="Push"
              style="padding: 4px 8px; font-size: 11px;"
            >
              ⬆️
            </button>
            <button 
              @click="loadGitStatus" 
              :disabled="isLoadingGit"
              title="Refresh Git Status"
              style="padding: 4px 8px; font-size: 11px;"
            >
              <span v-if="isLoadingGit">⟳</span>
              <span v-else>🔄</span>
            </button>
          </div>
        </div>

        <div v-if="isLoadingGit" class="emptyState" style="padding: 20px; text-align: center;">
          Loading...
        </div>

        <div v-else-if="!isGitRepo" class="git-panel">
          <div class="emptyState" style="padding: 20px; text-align: center;">
            <p>No git repository found</p>
            <button @click="gitInitRepo" style="margin-top: 12px;">
              Initialize Repository
            </button>
          </div>
        </div>

        <div v-else class="git-panel">
          <!-- Branches Section -->
          <div class="git-section" style="border-bottom: 1px solid var(--border); padding-bottom: 8px; margin-bottom: 8px;">
            <div class="git-section-header" style="cursor: pointer; display: flex; align-items: center; justify-content: space-between;" @click="toggleBranchesPanel">
              <div>
                <span style="margin-right: 4px;">{{ showBranchesPanel ? '▼' : '▶' }}</span>
                <span>BRANCHES</span>
              </div>
              <button 
                @click.stop="openBranchDialog"
                title="Create new branch"
                style="padding: 2px 6px; font-size: 11px;"
              >
                +
              </button>
            </div>
            
            <div v-if="showBranchesPanel" style="margin-top: 8px;">
              <div v-if="gitBranches.length === 0" style="padding: 8px; color: var(--muted); font-size: 11px; text-align: center;">
                Loading branches...
              </div>
              <div 
                v-for="branch in gitBranches" 
                :key="branch.name"
                class="git-file-item"
                :style="{ backgroundColor: branch.current ? 'var(--accent-bg)' : 'transparent' }"
              >
                <div class="git-file-info" @click="!branch.current && gitCheckout(branch.name)" :style="{ cursor: branch.current ? 'default' : 'pointer' }">
                  <span style="margin-right: 4px;">{{ branch.current ? '●' : '○' }}</span>
                  <span class="git-file-path" :style="{ fontWeight: branch.current ? '600' : '400' }">
                    {{ branch.name }}
                  </span>
                  <span v-if="branch.remote" style="margin-left: 4px; font-size: 9px; color: var(--muted);">
                    (remote)
                  </span>
                </div>
                <button 
                  v-if="!branch.current && !branch.remote"
                  class="git-file-action"
                  @click="gitDeleteBranch(branch.name)"
                  title="Delete branch"
                  style="color: var(--error);"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>

          <!-- Commits History Section -->
          <div class="git-section" style="border-bottom: 1px solid var(--border); padding-bottom: 8px; margin-bottom: 8px;">
            <div class="git-section-header" style="cursor: pointer; display: flex; align-items: center; justify-content: space-between;" @click="toggleCommitsPanel">
              <div>
                <span style="margin-right: 4px;">{{ showCommitsPanel ? '▼' : '▶' }}</span>
                <span>COMMITS</span>
              </div>
              <button 
                @click.stop="loadGitCommits(true)"
                title="Refresh commits"
                :disabled="isLoadingCommits"
                style="padding: 2px 6px; font-size: 11px;"
              >
                🔄
              </button>
            </div>
            
            <div v-if="showCommitsPanel" style="margin-top: 8px; max-height: 400px; overflow-y: auto;">
              <div v-if="isLoadingCommits && gitCommits.length === 0" style="padding: 8px; color: var(--muted); font-size: 11px; text-align: center;">
                Loading commits...
              </div>
              <div v-else-if="gitCommits.length === 0" style="padding: 8px; color: var(--muted); font-size: 11px; text-align: center;">
                No commits yet
              </div>
              <div v-else>
                <div 
                  v-for="commit in gitCommits" 
                  :key="commit.hash"
                  class="git-commit-item"
                >
                  <div class="git-commit-header">
                    <span class="git-commit-hash" :title="commit.hash">{{ commit.shortHash }}</span>
                    <span class="git-commit-date">{{ formatCommitDate(commit.date) }}</span>
                  </div>
                  <div class="git-commit-subject">{{ commit.subject }}</div>
                  <div class="git-commit-author">{{ commit.author }}</div>
                </div>
                <button 
                  v-if="gitCommits.length >= 20"
                  @click="loadGitCommits(false)"
                  :disabled="isLoadingCommits"
                  style="width: 100%; padding: 8px; margin-top: 4px; font-size: 11px; background: transparent;"
                >
                  {{ isLoadingCommits ? 'Loading...' : 'Load more' }}
                </button>
              </div>
            </div>
          </div>

          <!-- Commit Section -->
          <div class="git-commit-section">
            <textarea 
              v-model="gitCommitMessage"
              placeholder="Commit message..."
              class="git-commit-input"
              rows="3"
            ></textarea>
            <button 
              @click="gitCommit"
              class="git-commit-btn"
              :disabled="!stagedFiles.length || !gitCommitMessage.trim()"
            >
              Commit ({{ stagedFiles.length }})
            </button>
          </div>

          <!-- Staged Changes -->
          <div v-if="stagedFiles.length > 0" class="git-section">
            <div class="git-section-header">STAGED CHANGES ({{ stagedFiles.length }})</div>
            <div 
              v-for="file in stagedFiles" 
              :key="file.path"
              class="git-file-item"
            >
              <div class="git-file-info" @click="showFileDiff(file.path, true)" style="cursor: pointer;" title="View diff">
                <span :class="'git-status-' + file.status">{{ getGitStatusIcon(file.status) }}</span>
                <span class="git-file-path">{{ file.path }}</span>
              </div>
              <div class="git-file-actions">
                <button 
                  class="git-file-action"
                  @click.stop="openGitFile(file.path)"
                  title="Open file"
                >
                  📄
                </button>
                <button 
                  class="git-file-action"
                  @click.stop="gitUnstageFile(file.path)"
                  title="Unstage"
                >
                  -
                </button>
              </div>
            </div>
          </div>

          <!-- Unstaged Changes -->
          <div v-if="unstagedFiles.length > 0" class="git-section">
            <div class="git-section-header">CHANGES ({{ unstagedFiles.length }})</div>
            <div 
              v-for="file in unstagedFiles" 
              :key="file.path"
              class="git-file-item"
            >
              <div class="git-file-info" @click="showFileDiff(file.path, false)" style="cursor: pointer;" title="View diff">
                <span :class="'git-status-' + file.status">{{ getGitStatusIcon(file.status) }}</span>
                <span class="git-file-path">{{ file.path }}</span>
              </div>
              <div class="git-file-actions">
                <button 
                  class="git-file-action"
                  @click.stop="openGitFile(file.path)"
                  title="Open file"
                >
                  📄
                </button>
                <button 
                  class="git-file-action"
                  @click.stop="gitStageFile(file.path)"
                  title="Stage"
                >
                  +
                </button>
                <button 
                  class="git-file-action"
                  @click.stop="gitDiscardFile(file.path)"
                  title="Discard"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>

          <!-- No Changes -->
          <div v-if="gitStatus.length === 0" class="emptyState" style="padding: 20px; text-align: center;">
            No changes to commit
          </div>
        </div>
      </div>

      <!-- NPM Scripts View -->
      <div v-show="activeView === 'tasks'" class="sidebar-content">
        <div class="sidebarHeader">
          <h3 style="margin: 0; font-size: 13px; font-weight: 600;">NPM SCRIPTS</h3>
          <button 
            @click="loadNpmScripts" 
            :disabled="isLoadingScripts"
            title="Refresh scripts"
            style="padding: 4px 8px; font-size: 11px; margin-left: auto;"
          >
            <span v-if="isLoadingScripts">⏳</span>
            <span v-else>🔄</span>
          </button>
        </div>

        <div v-if="isLoadingScripts" class="emptyState" style="padding: 20px; text-align: center;">
          Loading scripts...
        </div>

        <div v-else-if="!workspacePath" class="emptyState" style="padding: 20px; text-align: center;">
          <p>No workspace open</p>
        </div>

        <div v-else-if="npmScripts.length === 0" class="emptyState" style="padding: 20px; text-align: center;">
          <p>No scripts found in package.json</p>
        </div>

        <div v-else class="npm-scripts-list">
          <div 
            v-for="script in npmScripts" 
            :key="script.name"
            class="npm-script-item"
          >
            <div class="npm-script-info">
              <div class="npm-script-name">{{ script.name }}</div>
              <div class="npm-script-command">{{ script.command }}</div>
            </div>
            <button 
              class="npm-script-run"
              @click="runNpmScript(script.name)"
              :disabled="runningScripts.has(script.name)"
              title="Run script"
            >
              <span v-if="runningScripts.has(script.name)">⏳</span>
              <span v-else>▶</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Debug View -->
      <div v-show="activeView === 'debug'" class="sidebar-content">
        <div class="sidebarHeader">
          <h3 style="margin: 0; font-size: 13px; font-weight: 600;">RUN AND DEBUG</h3>
        </div>
        <div class="emptyState" style="padding: 20px; text-align: center;">
          Debug functionality coming soon...
        </div>
      </div>

      <!-- Extensions View -->
      <div v-show="activeView === 'extensions'" class="sidebar-content">
        <div class="sidebarHeader">
          <h3 style="margin: 0; font-size: 13px; font-weight: 600;">EXTENSIONS</h3>
        </div>
        <div class="emptyState" style="padding: 20px; text-align: center;">
          Extensions marketplace coming soon...
        </div>
      </div>
    </aside>

    <div class="sidebar-resizer" @mousedown="startResize"></div>

    <!-- Menu de Contexto -->
    <ContextMenu
      :is-open="contextMenu.open"
      :x="contextMenu.x"
      :y="contextMenu.y"
      :width="contextMenuWidth"
      :node="contextMenu.node"
      :root-path="workspacePath"
      :has-tree="!!tree"
      @close="closeContextMenu"
      @open="onContextMenuOpen"
      @refresh="onContextMenuRefresh"
      @new-file="onContextMenuNewFile"
      @new-folder="onContextMenuNewFolder"
      @rename="onContextMenuRename"
      @delete="onContextMenuDelete"
      @copy-path="onContextMenuCopyPath"
      @copy-relative-path="onContextMenuCopyRelativePath"
    />

    <main class="main">

      <div v-if="lastError" class="emptyState" style="color: var(--danger); border-bottom: 1px solid var(--border);">
        {{ lastError }}
      </div>

      <!-- Componente de Abas -->
      <EditorTabs
        :tabs="tabs"
        :active-path="activePath"
        @select="activePath = $event"
        @close="closeTab"
      />

      <div class="editor-terminal-container" :style="{ '--terminal-height': isTerminalOpen ? terminalHeight + 'px' : '0px' }">
        <div class="editorWrap" ref="monacoEditorRef">
          <div v-if="!activeTab" class="emptyState">
            Open a file from the explorer.
          </div>
          <MonacoEditor
            v-else
            :language="activeTab.language"
            :value="activeTab.value"
            theme="vs-dark"
            :options="editorOptions"
            @change="onEditorChange"
            @editorDidMount="handleEditorMount"
          />
        </div>

        <!-- Terminal Resizer -->
        <div v-if="isTerminalOpen" class="terminal-sash" @mousedown="startResizeTerminal"></div>

        <!-- Terminal Panel -->
        <TerminalPanel
          v-if="isTerminalOpen"
          ref="terminalRef"
          :style="{ height: terminalHeight + 'px' }"
          @close="closeTerminal"
        />
      </div>

      <!-- Barra de Status -->
      <StatusBar
        :file-name="activeTab?.name || ''"
        :language="activeTab?.language || ''"
        :line-col="statusLineCol"
        :picked-color="pickedColor"
        @activate-eyedropper="activateEyedropper"
        @toggle-color-palette="toggleColorPalette"
        @copy-color="copyToClipboard"
        @clear-picked-color="clearPickedColor"
      />
    </main>

    <!-- AI Chat Panel Resizer -->
    <div v-if="isAIChatOpen" class="sash ai-chat-sash" @mousedown="startResizeAIChat"></div>

    <!-- AI Chat Panel integrado no grid -->
    <AIChat
      v-if="isAIChatOpen"
      :is-open="isAIChatOpen"
      :style="{ width: aiChatWidth + 'px' }"
      class="ai-chat-integrated"
      @close="closeAIChat"
    />
    </div>
  </div>

  <!-- Componente de Histórico de Cores -->
  <ColorPalette
    ref="colorPaletteRef"
    :is-open="showColorPalette"
    @close="toggleColorPalette"
    @color-picked="onColorPicked"
  />

  <!-- Sistema de Notificações Toast -->
  <Toast />

  <!-- Command Palette -->
  <CommandPalette
    :is-open="showCommandPalette"
    :commands="commandPaletteCommands"
    @close="showCommandPalette = false"
    @execute="executeCommandPaletteAction"
  />
  
  <!-- Ctrl+K Inline Edit Popup -->
  <Teleport to="body">
    <div v-if="showCtrlKPopup" class="ctrlk-overlay" @click="cancelCtrlK">
      <div class="ctrlk-popup" @click.stop>
        <div class="ctrlk-header">
          <span class="ctrlk-icon">AI</span>
          <span class="ctrlk-title">Edit with AI</span>
          <span class="ctrlk-hint">Enter → Submit · Esc → Cancel</span>
        </div>
        <div class="ctrlk-input-area">
          <input
            ref="ctrlKInputRef"
            v-model="ctrlKInput"
            type="text"
            class="ctrlk-input"
            placeholder="Descreva a edição... (ex: adicione tratamento de erros)"
            :disabled="ctrlKLoading"
            @keydown.enter="submitCtrlK"
            @keydown.esc="cancelCtrlK"
          />
          <button 
            class="ctrlk-submit" 
            :disabled="!ctrlKInput.trim() || ctrlKLoading"
            @click="submitCtrlK"
          >
            <span v-if="ctrlKLoading" class="ctrlk-loading"></span>
            <span v-else>↑</span>
          </button>
        </div>
        <div v-if="ctrlKText" class="ctrlk-preview">
          <div class="ctrlk-preview-label">Código selecionado ({{ ctrlKText.split('\n').length }} linhas)</div>
          <pre class="ctrlk-preview-code">{{ ctrlKText.length > 200 ? ctrlKText.slice(0, 200) + '...' : ctrlKText }}</pre>
        </div>
      </div>
    </div>
  </Teleport>
</template>
