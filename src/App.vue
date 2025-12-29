<script setup>
import { computed, onMounted, onUnmounted, ref, watch, nextTick } from 'vue'
import MonacoEditor from 'monaco-editor-vue3'
import FileTree from './components/FileTree.vue'
import AIChat from './components/AIChat.vue'
import TitleBar from './components/TitleBar.vue'
import Settings from './components/Settings.vue'
import ConfirmDialog from './components/ConfirmDialog.vue'
import CrudDialog from './components/CrudDialog.vue'
import ColorPalette from './components/ColorPalette.vue'
import ContextMenu from './components/ContextMenu.vue'
import StatusBar from './components/StatusBar.vue'
import EditorTabs from './components/EditorTabs.vue'
import TerminalPanel from './components/Terminal.vue'

// Monaco Editor instance
const monacoEditorRef = ref(null)
let monacoInstance = null
let resizeObserver = null

function handleEditorMount(editor) {
  monacoInstance = editor
  // Faz layout inicial após montar
  setTimeout(() => {
    if (monacoInstance) {
      monacoInstance.layout()
    }
  }, 100)
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

// Terminal state
const isTerminalOpen = ref(false)
const terminalHeight = ref(250)
const isResizingTerminal = ref(false)
const minTerminalHeight = 100
const maxTerminalHeight = 600
const terminalRef = ref(null)

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

// Grid template columns computed
const gridTemplateColumns = computed(() => {
  if (isAIChatOpen.value) {
    return `${sidebarWidth.value}px 4px 1fr 4px ${aiChatWidth.value}px`
  }
  return `${sidebarWidth.value}px 4px 1fr`
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

function toggleDir(dirPath) {
  const isExpanded = expandedMap.value[dirPath] !== false
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
  lineNumbers: editorSettings.value.lineNumbers || 'on'
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

function onKeyDown(e) {
  if (!e.isTrusted) return

  if (e.key === 'Escape') {
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
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('keyup', updateCursorOffsetFromDom, true)
  window.removeEventListener('mouseup', updateCursorOffsetFromDom, true)
  window.removeEventListener('pointerdown', onGlobalPointerDown)
  window.removeEventListener('resize', layoutMonaco)
  
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

    <aside class="sidebar">
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
</template>
