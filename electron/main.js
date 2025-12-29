import { app, BrowserWindow, dialog, ipcMain, screen } from 'electron'
import path from 'node:path'
import fs from 'node:fs/promises'
import os from 'node:os'
import pty from 'node-pty'
import { AIAgent, toolExecutor, toolDefinitions } from './ai/index.js'

const isDev = !app.isPackaged

let currentWorkspacePath = null

// Terminal PTY instances
const terminals = new Map()

// ===== Config Management =====
const CONFIG_DIR_NAME = '.monarco'
const SETTINGS_FILE_NAME = 'settings.json'

const defaultSettings = {
  editor: {
    fontSize: 14,
    wordWrap: 'off',
    tabSize: 2,
    minimap: true,
    lineNumbers: 'on'
  },
  appearance: {
    theme: 'dark',
    windowControlsPosition: 'left'
  },
  terminal: {
    fontSize: 13,
    fontFamily: 'monospace',
    cursorBlink: true,
    cursorStyle: 'block'
  },
  panels: {
    aiChat: { open: false, width: 400 },
    terminal: { open: false, height: 250 },
    sidebar: { width: 280 }
  },
  ai: {
    provider: 'vllm',
    endpoint: 'http://192.168.1.18:8000/v1/chat/completions',
    model: 'Qwen/Qwen2.5-Coder-7B-Instruct-AWQ',
    temperature: 0.2,
    maxTokens: 1024
  },
  recentWorkspaces: [] // Lista de workspaces recentes (máx 10)
}

function getConfigDir() {
  return path.join(os.homedir(), CONFIG_DIR_NAME)
}

function getSettingsPath() {
  return path.join(getConfigDir(), SETTINGS_FILE_NAME)
}

async function ensureConfigDir() {
  const configDir = getConfigDir()
  try {
    await fs.access(configDir)
  } catch {
    await fs.mkdir(configDir, { recursive: true })
  }
  return configDir
}

async function loadSettings() {
  try {
    const settingsPath = getSettingsPath()
    await fs.access(settingsPath)
    const content = await fs.readFile(settingsPath, 'utf8')
    const parsed = JSON.parse(content)
    // Merge with defaults to ensure all keys exist
    return {
      editor: { ...defaultSettings.editor, ...parsed.editor },
      appearance: { ...defaultSettings.appearance, ...parsed.appearance },
      terminal: { ...defaultSettings.terminal, ...parsed.terminal },
      panels: {
        aiChat: { ...defaultSettings.panels.aiChat, ...parsed.panels?.aiChat },
        terminal: { ...defaultSettings.panels.terminal, ...parsed.panels?.terminal },
        sidebar: { ...defaultSettings.panels.sidebar, ...parsed.panels?.sidebar }
      },
      ai: { ...defaultSettings.ai, ...parsed.ai },
      recentWorkspaces: parsed.recentWorkspaces || []
    }
  } catch {
    // File doesn't exist or is invalid, create with defaults
    await ensureConfigDir()
    const settingsPath = getSettingsPath()
    const content = JSON.stringify(defaultSettings, null, 2)
    await fs.writeFile(settingsPath, content, 'utf8')
    return { ...defaultSettings }
  }
}

async function saveSettings(settings) {
  await ensureConfigDir()
  const settingsPath = getSettingsPath()
  const content = JSON.stringify(settings, null, 2)
  await fs.writeFile(settingsPath, content, 'utf8')
  return settings
}

/**
 * Adiciona um workspace à lista de recentes
 */
async function addRecentWorkspace(workspacePath) {
  if (!workspacePath) return
  
  const settings = await loadSettings()
  const recents = settings.recentWorkspaces || []
  
  // Remove se já existe (para reordenar)
  const filtered = recents.filter(w => w.path !== workspacePath)
  
  // Adiciona no início
  filtered.unshift({
    path: workspacePath,
    name: path.basename(workspacePath),
    lastOpened: new Date().toISOString()
  })
  
  // Limita a 10 recentes
  settings.recentWorkspaces = filtered.slice(0, 10)
  
  await saveSettings(settings)
  return settings.recentWorkspaces
}

/**
 * Retorna o último workspace aberto
 */
async function getLastWorkspace() {
  const settings = await loadSettings()
  const recents = settings.recentWorkspaces || []
  return recents.length > 0 ? recents[0] : null
}

function assertWorkspaceSelected() {
  if (!currentWorkspacePath) {
    throw new Error('No workspace selected')
  }
  return currentWorkspacePath
}

function assertPathInsideWorkspace(filePath) {
  const workspacePath = assertWorkspaceSelected()
  const resolvedWorkspace = path.resolve(workspacePath)
  const resolvedFile = path.resolve(filePath)

  const wsWithSep = resolvedWorkspace.endsWith(path.sep) ? resolvedWorkspace : resolvedWorkspace + path.sep
  if (resolvedFile !== resolvedWorkspace && !resolvedFile.startsWith(wsWithSep)) {
    throw new Error('Path is outside workspace')
  }

  return resolvedFile
}

function assertValidName(name) {
  if (typeof name !== 'string' || name.trim().length === 0) {
    throw new Error('Invalid name')
  }
  if (name.includes('/') || name.includes('\\')) {
    throw new Error('Name must not include path separators')
  }
  return name.trim()
}

async function buildTree(rootPath) {
  const stat = await fs.stat(rootPath)
  const name = path.basename(rootPath)

  if (!stat.isDirectory()) {
    return { name, path: rootPath, kind: 'file' }
  }

  const entries = await fs.readdir(rootPath, { withFileTypes: true })

  const children = await Promise.all(
    entries
      .filter((e) => !e.name.startsWith('.'))
      .map(async (e) => {
        const p = path.join(rootPath, e.name)
        if (e.isDirectory()) return buildTree(p)
        return { name: e.name, path: p, kind: 'file' }
      })
  )

  children.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'dir' ? -1 : 1
    return a.name.localeCompare(b.name)
  })

  return { name, path: rootPath, kind: 'dir', children }
}

function createWindow() {
  const cursorPoint = screen.getCursorScreenPoint()
  const display = screen.getDisplayNearestPoint(cursorPoint)
  const { x: waX, y: waY, width: waW, height: waH } = display.workArea

  const desiredWidth = 1530
  const desiredHeight = 760
  const width = Math.min(desiredWidth, waW)
  const height = Math.min(desiredHeight, waH)
  const x = waX + Math.round((waW - width) / 2)
  const y = waY + Math.round((waH - height) / 2)

  const win = new BrowserWindow({
    width,
    height,
    x,
    y,
    frame: false,
    backgroundColor: '#0f111a',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(app.getAppPath(), 'electron', 'preload.cjs')
    }
  })

  if (isDev) {
    win.loadURL('http://localhost:5175')
    win.webContents.openDevTools({ mode: 'detach' })
  } else {
    win.loadFile(path.join(app.getAppPath(), 'dist', 'index.html'))
  }
}

app.whenReady().then(() => {
  ipcMain.handle('window:minimize', (evt) => {
    const win = BrowserWindow.fromWebContents(evt.sender)
    if (!win) return
    win.minimize()
  })

  ipcMain.handle('window:toggleMaximize', (evt) => {
    const win = BrowserWindow.fromWebContents(evt.sender)
    if (!win) return
    if (win.isMaximized()) win.unmaximize()
    else win.maximize()
  })

  ipcMain.handle('window:close', (evt) => {
    const win = BrowserWindow.fromWebContents(evt.sender)
    if (!win) return
    win.close()
  })

  ipcMain.handle('window:isMaximized', (evt) => {
    const win = BrowserWindow.fromWebContents(evt.sender)
    if (!win) return false
    return win.isMaximized()
  })

  ipcMain.handle('workspace:select', async () => {
    try {
      const res = await dialog.showOpenDialog({
        title: 'Select workspace folder',
        properties: ['openDirectory']
      })
      if (res.canceled) return null
      const selected = res.filePaths[0] ?? null
      currentWorkspacePath = selected
      
      // Salva nos recentes
      if (selected) {
        await addRecentWorkspace(selected)
        
        // Configura o agente de IA com o workspace
        if (aiAgent) {
          aiAgent.setWorkspace(selected)
        }
      }
      
      return selected
    } catch (e) {
      console.error('workspace:select failed', e)
      throw e
    }
  })

  ipcMain.handle('workspace:getRecent', async () => {
    try {
      const settings = await loadSettings()
      return settings.recentWorkspaces || []
    } catch (e) {
      console.error('workspace:getRecent failed', e)
      return []
    }
  })

  ipcMain.handle('workspace:openRecent', async (_evt, workspacePath) => {
    try {
      // Verifica se o diretório existe
      await fs.access(workspacePath)
      const stat = await fs.stat(workspacePath)
      if (!stat.isDirectory()) {
        throw new Error('Path is not a directory')
      }
      
      currentWorkspacePath = workspacePath
      await addRecentWorkspace(workspacePath)
      
      // Configura o agente de IA
      if (aiAgent) {
        aiAgent.setWorkspace(workspacePath)
      }
      
      return workspacePath
    } catch (e) {
      console.error('workspace:openRecent failed', e)
      throw e
    }
  })

  ipcMain.handle('workspace:getLast', async () => {
    try {
      const last = await getLastWorkspace()
      return last
    } catch (e) {
      console.error('workspace:getLast failed', e)
      return null
    }
  })

  ipcMain.handle('workspace:removeRecent', async (_evt, workspacePath) => {
    try {
      const settings = await loadSettings()
      settings.recentWorkspaces = (settings.recentWorkspaces || []).filter(
        w => w.path !== workspacePath
      )
      await saveSettings(settings)
      return settings.recentWorkspaces
    } catch (e) {
      console.error('workspace:removeRecent failed', e)
      throw e
    }
  })

  ipcMain.handle('workspace:tree', async () => {
    try {
      const workspacePath = assertWorkspaceSelected()
      return buildTree(workspacePath)
    } catch (e) {
      console.error('workspace:tree failed', { currentWorkspacePath }, e)
      throw e
    }
  })

  ipcMain.handle('fs:readTextFile', async (_evt, filePath) => {
    try {
      if (typeof filePath !== 'string' || filePath.length === 0) {
        throw new Error('Invalid filePath')
      }
      const resolved = assertPathInsideWorkspace(filePath)
      return fs.readFile(resolved, 'utf8')
    } catch (e) {
      console.error('fs:readTextFile failed', { filePath, currentWorkspacePath }, e)
      throw e
    }
  })

  ipcMain.handle('fs:writeTextFile', async (_evt, filePath, contents) => {
    try {
      if (typeof filePath !== 'string' || filePath.length === 0) {
        throw new Error('Invalid filePath')
      }
      if (typeof contents !== 'string') {
        throw new Error('Invalid contents')
      }
      const resolved = assertPathInsideWorkspace(filePath)
      await fs.writeFile(resolved, contents, 'utf8')
    } catch (e) {
      console.error('fs:writeTextFile failed', { filePath, currentWorkspacePath }, e)
      throw e
    }
  })

  ipcMain.handle('fs:createFile', async (_evt, parentDirPath, name) => {
    try {
      if (typeof parentDirPath !== 'string' || parentDirPath.length === 0) {
        throw new Error('Invalid parentDirPath')
      }
      const safeName = assertValidName(name)
      const resolvedParent = assertPathInsideWorkspace(parentDirPath)
      const targetPath = path.join(resolvedParent, safeName)
      assertPathInsideWorkspace(targetPath)
      await fs.writeFile(targetPath, '', { encoding: 'utf8', flag: 'wx' })
      return targetPath
    } catch (e) {
      console.error('fs:createFile failed', { parentDirPath, name, currentWorkspacePath }, e)
      throw e
    }
  })

  ipcMain.handle('fs:createFolder', async (_evt, parentDirPath, name) => {
    try {
      if (typeof parentDirPath !== 'string' || parentDirPath.length === 0) {
        throw new Error('Invalid parentDirPath')
      }
      const safeName = assertValidName(name)
      const resolvedParent = assertPathInsideWorkspace(parentDirPath)
      const targetPath = path.join(resolvedParent, safeName)
      assertPathInsideWorkspace(targetPath)
      await fs.mkdir(targetPath, { recursive: false })
      return targetPath
    } catch (e) {
      console.error('fs:createFolder failed', { parentDirPath, name, currentWorkspacePath }, e)
      throw e
    }
  })

  ipcMain.handle('fs:renamePath', async (_evt, oldPath, newName) => {
    try {
      if (typeof oldPath !== 'string' || oldPath.length === 0) {
        throw new Error('Invalid oldPath')
      }
      const safeName = assertValidName(newName)
      const resolvedOld = assertPathInsideWorkspace(oldPath)
      const parentDir = path.dirname(resolvedOld)
      const newPath = path.join(parentDir, safeName)
      assertPathInsideWorkspace(newPath)
      await fs.rename(resolvedOld, newPath)
      return newPath
    } catch (e) {
      console.error('fs:renamePath failed', { oldPath, newName, currentWorkspacePath }, e)
      throw e
    }
  })

  ipcMain.handle('fs:deletePath', async (_evt, targetPath) => {
    try {
      if (typeof targetPath !== 'string' || targetPath.length === 0) {
        throw new Error('Invalid targetPath')
      }
      const resolved = assertPathInsideWorkspace(targetPath)
      const stat = await fs.lstat(resolved)
      if (stat.isDirectory()) {
        await fs.rm(resolved, { recursive: true, force: true })
      } else {
        await fs.rm(resolved, { force: true })
      }
      return true
    } catch (e) {
      console.error('fs:deletePath failed', { targetPath, currentWorkspacePath }, e)
      throw e
    }
  })

  // ===== Terminal PTY Handlers =====
  
  // Criar novo terminal
  ipcMain.handle('terminal:create', (evt, options = {}) => {
    try {
      const shell = process.platform === 'win32' ? 'powershell.exe' : (process.env.SHELL || '/bin/bash')
      const cwd = options.cwd || currentWorkspacePath || os.homedir()
      const cols = options.cols || 80
      const rows = options.rows || 24
      
      const terminalId = `term_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      
      const ptyProcess = pty.spawn(shell, [], {
        name: 'xterm-256color',
        cols,
        rows,
        cwd,
        env: {
          ...process.env,
          TERM: 'xterm-256color',
          COLORTERM: 'truecolor'
        }
      })
      
      terminals.set(terminalId, ptyProcess)
      
      // Enviar dados do terminal para o renderer
      ptyProcess.onData((data) => {
        const win = BrowserWindow.fromWebContents(evt.sender)
        if (win && !win.isDestroyed()) {
          evt.sender.send('terminal:data', terminalId, data)
        }
      })
      
      // Quando o terminal fechar
      ptyProcess.onExit(({ exitCode }) => {
        terminals.delete(terminalId)
        const win = BrowserWindow.fromWebContents(evt.sender)
        if (win && !win.isDestroyed()) {
          evt.sender.send('terminal:exit', terminalId, exitCode)
        }
      })
      
      return terminalId
    } catch (e) {
      console.error('terminal:create failed', e)
      throw e
    }
  })
  
  // Escrever no terminal
  ipcMain.handle('terminal:write', (_evt, terminalId, data) => {
    const term = terminals.get(terminalId)
    if (term) {
      term.write(data)
    }
  })
  
  // Redimensionar terminal
  ipcMain.handle('terminal:resize', (_evt, terminalId, cols, rows) => {
    const term = terminals.get(terminalId)
    if (term) {
      term.resize(cols, rows)
    }
  })
  
  // Destruir terminal
  ipcMain.handle('terminal:destroy', (_evt, terminalId) => {
    const term = terminals.get(terminalId)
    if (term) {
      term.kill()
      terminals.delete(terminalId)
    }
  })
  
  // Obter caminho do workspace atual
  ipcMain.handle('terminal:getCwd', () => {
    return currentWorkspacePath || os.homedir()
  })

  // ===== Settings Handlers =====
  
  // Carregar configurações
  ipcMain.handle('settings:load', async () => {
    try {
      return await loadSettings()
    } catch (e) {
      console.error('settings:load failed', e)
      return { ...defaultSettings }
    }
  })
  
  // Salvar configurações
  ipcMain.handle('settings:save', async (_evt, settings) => {
    try {
      return await saveSettings(settings)
    } catch (e) {
      console.error('settings:save failed', e)
      throw e
    }
  })
  
  // Obter caminho do diretório de configurações
  ipcMain.handle('settings:getConfigPath', () => {
    return getConfigDir()
  })
  
  // Abrir diretório de configurações no explorador de arquivos
  ipcMain.handle('settings:openConfigDir', async () => {
    const { shell } = await import('electron')
    const configDir = getConfigDir()
    await ensureConfigDir()
    shell.openPath(configDir)
  })

  // ===== AI Agent Handlers =====
  
  // Instância do agente (uma por janela seria ideal, mas singleton por agora)
  let aiAgent = null
  
  // Inicializar agente de IA
  ipcMain.handle('ai:init', async (_evt, settings) => {
    try {
      aiAgent = new AIAgent(settings)
      if (currentWorkspacePath) {
        aiAgent.setWorkspace(currentWorkspacePath)
        toolExecutor.setWorkspace(currentWorkspacePath)
      }
      return { success: true }
    } catch (e) {
      console.error('ai:init failed', e)
      throw e
    }
  })
  
  // Enviar mensagem para o agente
  ipcMain.handle('ai:chat', async (evt, message, options = {}) => {
    try {
      if (!aiAgent) {
        // Inicializa com configurações padrão se não existir
        const settings = await loadSettings()
        aiAgent = new AIAgent(settings.ai)
        if (currentWorkspacePath) {
          aiAgent.setWorkspace(currentWorkspacePath)
          toolExecutor.setWorkspace(currentWorkspacePath)
        }
      }
      
      // Configura callback para notificar tool calls
      aiAgent.onToolCall = (toolInfo) => {
        const win = BrowserWindow.fromWebContents(evt.sender)
        if (win && !win.isDestroyed()) {
          evt.sender.send('ai:tool-call', toolInfo)
        }
      }
      
      const result = await aiAgent.chat(message, options)
      return result
    } catch (e) {
      console.error('ai:chat failed', e)
      throw e
    }
  })
  
  // Limpar histórico do agente
  ipcMain.handle('ai:clear', async () => {
    if (aiAgent) {
      aiAgent.clearHistory()
    }
    return { success: true }
  })
  
  // Atualizar configurações do agente
  ipcMain.handle('ai:updateSettings', async (_evt, settings) => {
    if (aiAgent) {
      aiAgent.updateSettings(settings)
    }
    return { success: true }
  })
  
  // Obter definições das tools (para exibir no frontend)
  ipcMain.handle('ai:getTools', async () => {
    return toolDefinitions
  })
  
  // Executar uma tool diretamente (útil para testes)
  ipcMain.handle('ai:executeTool', async (_evt, toolName, params) => {
    try {
      if (currentWorkspacePath) {
        toolExecutor.setWorkspace(currentWorkspacePath)
      }
      const result = await toolExecutor.execute(toolName, params)
      
      // Notifica o frontend sobre mudanças no filesystem
      const window = BrowserWindow.getAllWindows()[0]
      if (window && ['write_file', 'patch_file', 'insert_at_line'].includes(toolName)) {
        // Aguarda um pouco para garantir que o arquivo foi escrito
        setTimeout(() => {
          window.webContents.send('fs:changed', {
            type: toolName === 'write_file' ? 'created' : 'modified',
            path: params.path
          })
        }, 100)
      }
      
      return result
    } catch (e) {
      console.error('ai:executeTool failed', e)
      throw e
    }
  })
  
  // Atualiza workspace no agente quando selecionar nova pasta
  const originalWorkspaceSelect = ipcMain.listeners('workspace:select')[0]
  // Hook para atualizar workspace no agente

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
