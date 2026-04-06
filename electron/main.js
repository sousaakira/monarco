import { app, BrowserWindow, dialog, ipcMain, screen, Menu } from 'electron'
import path from 'node:path'
import fs from 'node:fs/promises'
import { existsSync, watch } from 'node:fs'
import os from 'node:os'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import pty from 'node-pty'
import { AIAgent, toolExecutor, toolDefinitions, CHAT_MODES } from './ai/index.js'

const execAsync = promisify(exec)

const isDev = !app.isPackaged

/**
 * Tenta extrair um caminho de diretório dos argumentos da linha de comando
 */
async function getPathFromArgv(argv) {
  // Ignora o primeiro argumento (executável)
  // Se estiver em dev, ignora também o segundo argumento (script do vite/electron)
  const startIndex = isDev ? 2 : 1
  const userArgs = argv.slice(startIndex)
  
  // Procuramos por algo que pareça um caminho absoluto ou relativo existente
  for (const arg of userArgs) {
    if (arg.startsWith('-')) continue // Pula flags como --remote-debugging-port
    
    try {
      // Resolve caminhos relativos ao diretório atual de execução
      const resolvedPath = path.isAbsolute(arg) ? arg : path.resolve(process.cwd(), arg)
      
      if (existsSync(resolvedPath)) {
        const stat = await fs.stat(resolvedPath)
        if (stat.isDirectory()) {
          return resolvedPath
        } else {
          // Se for arquivo, pegamos o diretório pai
          return path.dirname(resolvedPath)
        }
      }
    } catch {
      // Ignora argumentos que não são caminhos válidos
    }
  }
  return null
}

// ===== DEBUG CONFIGURATION =====
const DEBUG = {
  enabled: true,
  level: isDev ? 'verbose' : 'info', // 'error' | 'info' | 'verbose'
  file: true // Log to file
}

const log = (level, context, message, data = null) => {
  const levels = { error: 0, info: 1, verbose: 2 }
  if (levels[level] > levels[DEBUG.level]) return
  
  const timestamp = new Date().toISOString()
  const prefix = `[${timestamp}] [${level.toUpperCase()}] [${context}]`
  const output = data ? `${prefix} ${message} ${JSON.stringify(data)}` : `${prefix} ${message}`
  
  if (level === 'error') console.error(output)
  else if (level === 'info') console.log(output)
  else console.log(output)
}

let currentWorkspacePath = null
let workspaceFolders = []
let mainWindow = null // Referência global para a janela principal
let aiAgent = null // Instância global do agente de IA

// Terminal PTY instances
const terminals = new Map()

// Workspace FS watchers (to detect external changes, e.g. terminal AI)
let workspaceWatchRoots = []
let workspaceWatchers = new Map()
let workspaceWatchDebounce = new Map()

function shouldIgnoreWorkspacePath(p) {
  const normalized = p.replaceAll('\\', '/')
  const parts = normalized.split('/')
  return parts.includes('.git') || parts.includes('node_modules') || parts.includes('dist') || parts.includes('build') || parts.includes('out') || parts.includes('dist-electron')
}

function stopWorkspaceWatcher() {
  for (const w of workspaceWatchers.values()) {
    try { w.close() } catch {}
  }
  workspaceWatchers = new Map()
  workspaceWatchRoots = []
  for (const t of workspaceWatchDebounce.values()) {
    clearTimeout(t)
  }
  workspaceWatchDebounce = new Map()
}

function emitFsChanged(changeInfo) {
  const window = BrowserWindow.getAllWindows()[0]
  if (!window) return
  window.webContents.send('fs:changed', changeInfo)
}

function emitWorkspaceChanged(payload) {
  const window = BrowserWindow.getAllWindows()[0]
  if (!window) return
  window.webContents.send('workspace:changed', payload)
}

async function addWorkspaceWatchDir(dirPath) {
  if (!workspaceWatchRoots.length) return
  if (workspaceWatchers.has(dirPath)) return
  if (shouldIgnoreWorkspacePath(dirPath)) return
  try {
    const w = watch(dirPath, { persistent: false }, (eventType, filename) => {
      if (!workspaceWatchRoots.length) return
      if (!filename) {
        emitFsChanged({ type: 'modified', path: dirPath })
        return
      }
      const name = typeof filename === 'string' ? filename : filename.toString()
      const fullPath = path.resolve(dirPath, name)
      if (!workspaceWatchRoots.some((r) => fullPath === r.slice(0, -1) || fullPath.startsWith(r))) return
      if (shouldIgnoreWorkspacePath(fullPath)) return

      const key = fullPath
      const existing = workspaceWatchDebounce.get(key)
      if (existing) clearTimeout(existing)
      workspaceWatchDebounce.set(
        key,
        setTimeout(async () => {
          workspaceWatchDebounce.delete(key)
          try {
            const st = await fs.stat(fullPath)
            if (st.isDirectory()) {
              if (eventType === 'rename') {
                await addWorkspaceWatchDir(fullPath)
                try {
                  const entries = await fs.readdir(fullPath, { withFileTypes: true })
                  for (const ent of entries) {
                    if (ent.isDirectory()) {
                      await addWorkspaceWatchDir(path.join(fullPath, ent.name))
                    }
                  }
                } catch {}
              }
              return
            }
            emitFsChanged({ type: 'modified', path: fullPath })
          } catch {
            emitFsChanged({ type: 'deleted', path: fullPath })
          }
        }, 120)
      )
    })
    workspaceWatchers.set(dirPath, w)
  } catch (e) {
    log('error', 'workspace:watch', 'Falha ao criar watcher', { dirPath, error: e?.message })
  }
}

async function walkAndWatch(dirPath) {
  if (!workspaceWatchRoots.length) return
  if (shouldIgnoreWorkspacePath(dirPath)) return
  await addWorkspaceWatchDir(dirPath)
  let entries = []
  try {
    entries = await fs.readdir(dirPath, { withFileTypes: true })
  } catch {
    return
  }
  for (const ent of entries) {
    if (!ent.isDirectory()) continue
    const child = path.join(dirPath, ent.name)
    await walkAndWatch(child)
  }
}

async function startWorkspaceWatcher(workspacePaths) {
  const list = Array.isArray(workspacePaths) ? workspacePaths : [workspacePaths]
  const roots = list
    .filter(Boolean)
    .map((p) => path.resolve(p))
    .map((p) => (p.endsWith(path.sep) ? p : p + path.sep))
  if (!roots.length) return
  const same =
    workspaceWatchRoots.length === roots.length &&
    workspaceWatchRoots.every((r, idx) => r === roots[idx])
  if (same) return
  stopWorkspaceWatcher()
  workspaceWatchRoots = roots
  for (const root of roots) {
    await walkAndWatch(root.slice(0, -1))
  }
  log('info', 'workspace:watch', 'Watcher iniciado', { roots })
}

// ===== Config Management =====
const CONFIG_DIR_NAME = '.monarco'
const SETTINGS_FILE_NAME = 'settings.json'
const CLI_TOOLS_DIR_NAME = 'cli'
const CLI_STORE_RAW_URL = 'https://raw.githubusercontent.com/sousaakira/monarco/main/cli-store.json'

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
    cursorStyle: 'block',
    activeProfileId: 'openclaude-openrouter',
    profiles: [
      {
        id: 'openclaude-openrouter',
        name: 'OpenClaude (OpenRouter)',
        startupCommand: 'openclaude',
        env: {
          CLAUDE_CODE_USE_OPENAI: '1',
          OPENAI_BASE_URL: 'https://openrouter.ai/api/v1',
          OPENAI_API_KEY: '',
          OPENAI_MODEL: 'qwen/qwen3.6-plus:free'
        }
      },
      {
        id: 'openclaude-local',
        name: 'OpenClaude (Local)',
        startupCommand: 'openclaude',
        env: {
          CLAUDE_CODE_USE_OPENAI: '1',
          OPENAI_BASE_URL: 'http://192.168.1.19:11434/v1',
          OPENAI_API_KEY: 'sk-fake',
          OPENAI_MODEL: 'glm-5:cloud'
        }
      }
    ]
  },
  panels: {
    aiChat: { open: false, width: 400 },
    terminal: { open: false, height: 250 },
    sidebar: { width: 280 }
  },
  ai: {
    provider: 'vllm',
    // endpoint: 'http://192.168.1.18:8000/v1/chat/completions',
    endpoint: 'https://ia.auth.com.br/v1/chat/completions',
    model: 'Qwen/Qwen2.5-Coder-7B-Instruct-AWQ',
    temperature: 0.2,
    maxTokens: 1024
  },
  workspace: {
    folders: [],
    activeFolder: ''
  },
  recentWorkspaces: [] // Lista de workspaces recentes (máx 10)
}

function getConfigDir() {
  return path.join(os.homedir(), CONFIG_DIR_NAME)
}

function getSettingsPath() {
  return path.join(getConfigDir(), SETTINGS_FILE_NAME)
}

function getCliToolsDir() {
  return path.join(getConfigDir(), CLI_TOOLS_DIR_NAME)
}

function getCliToolsPackageJsonPath() {
  return path.join(getCliToolsDir(), 'package.json')
}

function getCliToolsBinDir() {
  const base = getCliToolsDir()
  return process.platform === 'win32'
    ? path.join(base, 'node_modules', '.bin')
    : path.join(base, 'node_modules', '.bin')
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

async function ensureCliToolsProject() {
  await ensureConfigDir()
  const dir = getCliToolsDir()
  try {
    await fs.mkdir(dir, { recursive: true })
  } catch {}
  const pkgPath = getCliToolsPackageJsonPath()
  if (!existsSync(pkgPath)) {
    const content = JSON.stringify({ name: 'monarco-cli', private: true }, null, 2)
    await fs.writeFile(pkgPath, content, 'utf8')
  }
  return dir
}

async function loadSettings() {
  const settingsPath = getSettingsPath()
  try {
    const content = await fs.readFile(settingsPath, 'utf8')
    const parsed = JSON.parse(content)
    const base = { ...defaultSettings, ...parsed }
    return {
      ...base,
      editor: { ...defaultSettings.editor, ...parsed.editor },
      appearance: { ...defaultSettings.appearance, ...parsed.appearance },
      terminal: { ...defaultSettings.terminal, ...parsed.terminal },
      panels: {
        aiChat: { ...defaultSettings.panels.aiChat, ...parsed.panels?.aiChat },
        terminal: { ...defaultSettings.panels.terminal, ...parsed.panels?.terminal },
        sidebar: { ...defaultSettings.panels.sidebar, ...parsed.panels?.sidebar }
      },
      ai: { ...defaultSettings.ai, ...parsed.ai },
      workspace: { ...defaultSettings.workspace, ...parsed.workspace },
      recentWorkspaces: parsed.recentWorkspaces || []
    }
  } catch (e) {
    if (e && typeof e === 'object' && e.code === 'ENOENT') {
      await ensureConfigDir()
      const content = JSON.stringify(defaultSettings, null, 2)
      await fs.writeFile(settingsPath, content, 'utf8')
      return { ...defaultSettings }
    }
    log('error', 'settings:load', 'Falha ao ler settings.json (usando defaults em memória)', { error: e?.message || String(e) })
    return { ...defaultSettings }
  }
}

function mergeSettings(current, patch) {
  const safeCurrent = current && typeof current === 'object' ? current : { ...defaultSettings }
  const safePatch = patch && typeof patch === 'object' ? patch : {}
  const base = { ...safeCurrent, ...safePatch }

  const mergedTerminal = safePatch.terminal
    ? {
        ...safeCurrent.terminal,
        ...safePatch.terminal,
        profiles:
          safePatch.terminal.profiles !== undefined
            ? safePatch.terminal.profiles
            : safeCurrent.terminal?.profiles,
        activeProfileId:
          safePatch.terminal.activeProfileId !== undefined
            ? safePatch.terminal.activeProfileId
            : safeCurrent.terminal?.activeProfileId
      }
    : safeCurrent.terminal

  const mergedPanels = safePatch.panels
    ? {
        ...(safeCurrent.panels || {}),
        ...(safePatch.panels || {}),
        aiChat: { ...(safeCurrent.panels?.aiChat || {}), ...(safePatch.panels?.aiChat || {}) },
        terminal: { ...(safeCurrent.panels?.terminal || {}), ...(safePatch.panels?.terminal || {}) },
        sidebar: { ...(safeCurrent.panels?.sidebar || {}), ...(safePatch.panels?.sidebar || {}) }
      }
    : safeCurrent.panels

  return {
    ...base,
    editor: safePatch.editor ? { ...safeCurrent.editor, ...safePatch.editor } : safeCurrent.editor,
    appearance: safePatch.appearance ? { ...safeCurrent.appearance, ...safePatch.appearance } : safeCurrent.appearance,
    terminal: mergedTerminal,
    panels: mergedPanels,
    ai: safePatch.ai ? { ...safeCurrent.ai, ...safePatch.ai } : safeCurrent.ai,
    recentWorkspaces:
      safePatch.recentWorkspaces !== undefined ? safePatch.recentWorkspaces : safeCurrent.recentWorkspaces
  }
}

async function saveSettings(settingsPatch) {
  await ensureConfigDir()
  const settingsPath = getSettingsPath()
  const current = await loadSettings()
  const merged = mergeSettings(current, settingsPatch)
  const content = JSON.stringify(merged, null, 2)
  const tmpPath = settingsPath + '.tmp'
  await fs.writeFile(tmpPath, content, 'utf8')
  try {
    await fs.rename(tmpPath, settingsPath)
  } catch (e) {
    try {
      await fs.unlink(settingsPath)
    } catch {}
    await fs.rename(tmpPath, settingsPath)
  }
  return merged
}

async function checkNodeAndNpm() {
  try {
    const nodeRes = await execAsync('node -v')
    const npmRes = await execAsync('npm -v')
    return {
      ok: true,
      nodeVersion: String(nodeRes.stdout || '').trim(),
      npmVersion: String(npmRes.stdout || '').trim()
    }
  } catch (e) {
    return { ok: false, nodeVersion: null, npmVersion: null, error: e?.message || String(e) }
  }
}

async function fetchCliStoreCatalog() {
  try {
    const res = await fetch(CLI_STORE_RAW_URL, { method: 'GET' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json()
    return { ok: true, source: 'remote', catalog: json }
  } catch (e) {
    try {
      const localPath = path.join(app.getAppPath(), 'cli-store.json')
      const content = await fs.readFile(localPath, 'utf8')
      const json = JSON.parse(content)
      return { ok: true, source: 'local', catalog: json }
    } catch (e2) {
      return { ok: false, error: e?.message || String(e) }
    }
  }
}

async function npmListInstalled(scope = 'local') {
  try {
    if (scope === 'global') {
      const { stdout } = await execAsync('npm ls -g --json --depth=0')
      const parsed = JSON.parse(stdout || '{}')
      const deps = parsed.dependencies || {}
      return Object.keys(deps).map((name) => ({ name, version: deps[name]?.version || null }))
    }

    await ensureCliToolsProject()
    const dir = getCliToolsDir()
    const { stdout } = await execAsync(`npm ls --json --depth=0 --prefix "${dir}"`)
    const parsed = JSON.parse(stdout || '{}')
    const deps = parsed.dependencies || {}
    return Object.keys(deps).map((name) => ({ name, version: deps[name]?.version || null }))
  } catch {
    return []
  }
}

async function npmInstallPackage(pkg, scope = 'local') {
  const check = await checkNodeAndNpm()
  if (!check.ok) throw new Error(check.error || 'Node.js/npm não disponível')
  if (scope === 'global') {
    await execAsync(`npm install -g --no-fund --no-audit --silent "${pkg}"`)
    return { ok: true }
  }
  await ensureCliToolsProject()
  const dir = getCliToolsDir()
  await execAsync(`npm install --no-fund --no-audit --silent --prefix "${dir}" "${pkg}"`)
  return { ok: true }
}

async function npmUninstallPackage(pkg, scope = 'local') {
  const check = await checkNodeAndNpm()
  if (!check.ok) throw new Error(check.error || 'Node.js/npm não disponível')
  if (scope === 'global') {
    await execAsync(`npm uninstall -g --no-fund --no-audit --silent "${pkg}"`)
    return { ok: true }
  }
  await ensureCliToolsProject()
  const dir = getCliToolsDir()
  await execAsync(`npm uninstall --no-fund --no-audit --silent --prefix "${dir}" "${pkg}"`)
  return { ok: true }
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

async function setWorkspaceState({ folders, activeFolder }) {
  const unique = Array.isArray(folders)
    ? Array.from(new Set(folders.filter(Boolean).map((p) => path.resolve(p))))
    : []
  const resolvedActive = activeFolder ? path.resolve(activeFolder) : ''
  const active = resolvedActive && unique.includes(resolvedActive) ? resolvedActive : unique[0] || null

  workspaceFolders = unique
  currentWorkspacePath = active

  if (workspaceFolders.length) {
    await startWorkspaceWatcher(workspaceFolders)
  } else {
    stopWorkspaceWatcher()
  }

  try {
    const settings = await loadSettings()
    settings.workspace = settings.workspace || {}
    settings.workspace.folders = workspaceFolders
    settings.workspace.activeFolder = active || ''
    await saveSettings(settings)
  } catch {}

  if (aiAgent && active) {
    aiAgent.setWorkspace(active)
    toolExecutor.setWorkspace(active)
  }

  emitWorkspaceChanged({ folders: workspaceFolders, activeFolder: active || '' })
  return { folders: workspaceFolders, activeFolder: active }
}

function assertWorkspaceSelected() {
  if (!currentWorkspacePath || !workspaceFolders.length) {
    throw new Error('No workspace selected')
  }
  return currentWorkspacePath
}

function assertPathInsideWorkspace(filePath) {
  const resolvedFile = path.resolve(filePath)
  if (!workspaceFolders.length) throw new Error('No workspace selected')

  const isInside = workspaceFolders.some((root) => {
    const resolvedWorkspace = path.resolve(root)
    const wsWithSep = resolvedWorkspace.endsWith(path.sep) ? resolvedWorkspace : resolvedWorkspace + path.sep
    return resolvedFile === resolvedWorkspace || resolvedFile.startsWith(wsWithSep)
  })

  if (!isInside) throw new Error('Path is outside workspace')

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

function parseGitStatus(status) {
  const X = status[0]
  const Y = status[1]
  
  // Status codes: https://git-scm.com/docs/git-status#_short_format
  if (X === '?' && Y === '?') return 'untracked'
  if (X === 'A') return 'added'
  if (X === 'M' || Y === 'M') return 'modified'
  if (X === 'D' || Y === 'D') return 'deleted'
  if (X === 'R') return 'renamed'
  if (X === 'C') return 'copied'
  if (X === 'U' || Y === 'U') return 'conflict'
  return 'unknown'
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
  log('info', 'electron:createWindow', '🪟 Criando nova janela')
  const cursorPoint = screen.getCursorScreenPoint()
  const display = screen.getDisplayNearestPoint(cursorPoint)
  const { x: waX, y: waY, width: waW, height: waH } = display.workArea
  log('verbose', 'electron:createWindow', 'Dimensões da tela', { x: waX, y: waY, w: waW, h: waH })

  const desiredWidth = 1530
  const desiredHeight = 760
  const width = Math.min(desiredWidth, waW)
  const height = Math.min(desiredHeight, waH)
  const x = waX + Math.round((waW - width) / 2)
  const y = waY + Math.round((waH - height) / 2)

  // Caminho do ícone (SVG convertido para PNG)
  const iconPath = path.join(app.getAppPath(), 'assets', 'icons', 'icon.png')
  const iconSvgPath = path.join(app.getAppPath(), 'assets', 'icons', 'icon.svg')
  log('verbose', 'electron:createWindow', 'Caminho do ícone', { iconPath, existe: existsSync(iconPath) })

  const win = new BrowserWindow({
    width,
    height,
    x,
    y,
    frame: false,
    backgroundColor: '#0f111a',
    icon: existsSync(iconPath) ? iconPath : (existsSync(iconSvgPath) ? iconSvgPath : undefined),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(app.getAppPath(), 'electron', 'preload.cjs')
    }
  })
  log('info', 'electron:createWindow', '✅ BrowserWindow criado')

  mainWindow = win // Salva referência global

  // Log quando o arquivo é carregado
  win.webContents.on('did-start-loading', () => {
    log('info', 'electron:renderer', '📄 Começando a carregar página')
  })

  win.webContents.on('did-finish-load', () => {
    log('info', 'electron:renderer', '✅ Página carregada com sucesso')
  })

  win.webContents.on('did-fail-load', (evt, code, desc) => {
    log('error', 'electron:renderer', '❌ Erro ao carregar página', { code, desc })
  })

  // Capturar erros do console do renderer
  win.webContents.on('console-message', (level, message, line, sourceId) => {
    try {
      const messageStr = String(message || '')
      const levelStr = ['log', 'warning', 'error'][level] || 'unknown'
      
      // Log padrão dos mensagens do console
      log(levelStr === 'error' ? 'error' : 'verbose', 'renderer:console', messageStr, { line, sourceId })
    } catch (e) {
      // Evita erros ao processar console-message
      console.error('[console-message handler error]', e)
    }
  })

  if (isDev) {
    log('info', 'electron:createWindow', '🔗 Modo desenvolvimento: conectando a http://localhost:5175')
    win.loadURL('http://localhost:5175')
    // Abre DevTools automaticamente em dev
    win.webContents.openDevTools({ mode: 'detach' })
  } else {
    const indexPath = path.join(app.getAppPath(), 'dist', 'index.html')
    log('info', 'electron:createWindow', '📂 Modo produção: carregando', { indexPath, existe: existsSync(indexPath) })
    if (!existsSync(indexPath)) {
      log('error', 'electron:createWindow', '❌ index.html NÃO ENCONTRADO!', { indexPath })
    }
    
    win.loadFile(indexPath)
  }

  // Show window after loading
  win.once('ready-to-show', () => {
    log('info', 'electron:createWindow', '🎨 Mostrando janela')
    win.show()
  })

  return win
}

app.whenReady().then(async () => {
  // Desabilita o menu apenas em produção. Em desenvolvimento, ele é mantido para facilitar o debug.
  if (!isDev) {
    Menu.setApplicationMenu(null)
  }
  
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
      log('info', 'ipc:workspace:select', 'Iniciando seleção de workspace')
      const res = await dialog.showOpenDialog({
        title: 'Select workspace folder',
        properties: ['openDirectory']
      })
      if (res.canceled) {
        log('info', 'ipc:workspace:select', 'Seleção cancelada pelo usuário')
        return null
      }
      const selected = res.filePaths[0] ?? null
      if (selected) await setWorkspaceState({ folders: [selected], activeFolder: selected })
      log('info', 'ipc:workspace:select', 'Workspace selecionado', { path: selected })
      
      // Salva nos recentes
      if (selected) {
        await addRecentWorkspace(selected)
        log('info', 'ipc:workspace:select', 'Workspace adicionado aos recentes')
        
        // Configura o agente de IA com o workspace
        if (aiAgent) {
          aiAgent.setWorkspace(selected)
          log('info', 'ipc:workspace:select', 'Workspace configurado no agente de IA')
        }
      }
      
      return selected
    } catch (e) {
      log('error', 'ipc:workspace:select', 'Erro ao selecionar workspace', { error: e.message })
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
      
      const settings = await loadSettings()
      const saved = Array.isArray(settings?.workspace?.folders) ? settings.workspace.folders : []
      const nextFolders = saved.length ? Array.from(new Set([...saved, workspacePath])) : [workspacePath]
      await setWorkspaceState({ folders: nextFolders, activeFolder: workspacePath })
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

  ipcMain.handle('workspace:getFolders', async () => {
    return { folders: workspaceFolders, activeFolder: currentWorkspacePath }
  })

  ipcMain.handle('workspace:setActiveFolder', async (_evt, folderPath) => {
    if (typeof folderPath !== 'string' || folderPath.trim().length === 0) throw new Error('Invalid folderPath')
    const resolved = path.resolve(folderPath)
    if (!workspaceFolders.includes(resolved) && !workspaceFolders.includes(folderPath)) {
      throw new Error('Folder is not in workspace')
    }
    const active = workspaceFolders.find((p) => path.resolve(p) === resolved) || folderPath
    await setWorkspaceState({ folders: workspaceFolders, activeFolder: active })
    return { folders: workspaceFolders, activeFolder: currentWorkspacePath }
  })

  ipcMain.handle('workspace:addFolder', async () => {
    const res = await dialog.showOpenDialog({
      title: 'Add folder to workspace',
      properties: ['openDirectory']
    })
    if (res.canceled) return { folders: workspaceFolders, activeFolder: currentWorkspacePath }
    const selected = res.filePaths[0] ?? null
    if (!selected) return { folders: workspaceFolders, activeFolder: currentWorkspacePath }
    const next = Array.from(new Set([...(workspaceFolders || []), selected]))
    await setWorkspaceState({ folders: next, activeFolder: currentWorkspacePath || selected })
    await addRecentWorkspace(selected)
    return { folders: workspaceFolders, activeFolder: currentWorkspacePath }
  })

  ipcMain.handle('workspace:removeFolder', async (_evt, folderPath) => {
    if (typeof folderPath !== 'string' || folderPath.trim().length === 0) throw new Error('Invalid folderPath')
    const resolved = path.resolve(folderPath)
    const next = (workspaceFolders || []).filter((p) => path.resolve(p) !== resolved)
    const nextActive = currentWorkspacePath && path.resolve(currentWorkspacePath) === resolved ? (next[0] || null) : currentWorkspacePath
    await setWorkspaceState({ folders: next, activeFolder: nextActive })
    return { folders: workspaceFolders, activeFolder: currentWorkspacePath }
  })

  ipcMain.handle('workspace:tree', async () => {
    try {
      assertWorkspaceSelected()
      if (workspaceFolders.length === 1) {
        return buildTree(workspaceFolders[0])
      }
      const children = await Promise.all(workspaceFolders.map((p) => buildTree(p)))
      children.sort((a, b) => a.name.localeCompare(b.name))
      return { name: 'WORKSPACE', path: '__workspace__', kind: 'dir', children }
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

  // Buscar arquivos no workspace
  ipcMain.handle('fs:search', async (_evt, query, options = {}) => {
    try {
      const workspacePath = assertWorkspaceSelected()
      const maxResults = options.maxResults || 100
      const results = []
      
      async function searchInDirectory(dirPath, depth = 0) {
        if (results.length >= maxResults || depth > 10) return
        
        try {
          const entries = await fs.readdir(dirPath, { withFileTypes: true })
          
          for (const entry of entries) {
            if (results.length >= maxResults) break
            
            // Ignora diretórios ocultos e node_modules
            if (entry.name.startsWith('.') || entry.name === 'node_modules') {
              continue
            }
            
            const fullPath = path.join(dirPath, entry.name)
            const relativePath = path.relative(workspacePath, fullPath)
            
            if (entry.isDirectory()) {
              // Busca no nome do diretório
              if (entry.name.toLowerCase().includes(query.toLowerCase())) {
                results.push({
                  path: relativePath,
                  name: entry.name,
                  type: 'directory',
                  fullPath
                })
              }
              // Busca recursivamente
              await searchInDirectory(fullPath, depth + 1)
            } else if (entry.isFile()) {
              // Busca no nome do arquivo
              if (entry.name.toLowerCase().includes(query.toLowerCase())) {
                results.push({
                  path: relativePath,
                  name: entry.name,
                  type: 'file',
                  fullPath
                })
              }
              
              // Busca no conteúdo de arquivos de texto
              if (options.searchContent && entry.name.match(/\.(js|ts|vue|css|html|json|md|txt)$/i)) {
                try {
                  const content = await fs.readFile(fullPath, 'utf8')
                  const lines = content.split('\n')
                  
                  lines.forEach((line, lineNumber) => {
                    if (results.length >= maxResults) return
                    
                    if (line.toLowerCase().includes(query.toLowerCase())) {
                      results.push({
                        path: relativePath,
                        name: entry.name,
                        type: 'match',
                        line: lineNumber + 1,
                        text: line.trim(),
                        fullPath
                      })
                    }
                  })
                } catch {
                  // Ignora erros de leitura (arquivos binários, etc)
                }
              }
            }
          }
        } catch (err) {
          // Ignora erros de permissão
          console.warn('Error searching directory:', dirPath, err.message)
        }
      }
      
      await searchInDirectory(workspacePath)
      
      return results
    } catch (e) {
      console.error('fs:search failed', e)
      throw e
    }
  })

  // ===== Git Handlers =====
  
  // Verificar se é um repositório Git
  ipcMain.handle('git:isRepository', async () => {
    try {
      const workspacePath = assertWorkspaceSelected()
      await execAsync('git rev-parse --git-dir', { cwd: workspacePath })
      return true
    } catch {
      return false
    }
  })
  
  // Obter status do repositório
  ipcMain.handle('git:status', async () => {
    try {
      const workspacePath = assertWorkspaceSelected()
      const { stdout } = await execAsync('git status --porcelain', { cwd: workspacePath })
      
      const files = []
      const lines = stdout.trim().split('\n').filter(Boolean)
      
      for (const line of lines) {
        const status = line.substring(0, 2)
        const filePath = line.substring(3)
        
        const parsedStatus = parseGitStatus(status)
        const X = status[0] // Index (staging area)
        const Y = status[1] // Working tree
        
        // X mostra status no index (staged)
        // Y mostra status no working tree (unstaged)
        const isStaged = X !== ' ' && X !== '?'
        const isUnstaged = Y !== ' ' || parsedStatus === 'untracked'
        
        files.push({
          path: filePath,
          status: parsedStatus,
          staged: isStaged,
          unstaged: isUnstaged
        })
      }
      
      return files
    } catch (e) {
      console.error('git:status failed', e)
      throw new Error('Failed to get git status')
    }
  })
  
  // Obter branch atual
  ipcMain.handle('git:currentBranch', async () => {
    try {
      const workspacePath = assertWorkspaceSelected()
      const { stdout } = await execAsync('git branch --show-current', { cwd: workspacePath })
      return stdout.trim()
    } catch (e) {
      console.error('git:currentBranch failed', e)
      return 'unknown'
    }
  })
  
  // Stage arquivo (melhorado)
  ipcMain.handle('git:stage', async (_evt, filePath) => {
    try {
      const workspacePath = assertWorkspaceSelected()
      // Usa -A para adicionar tudo (novo no Void)
      await execAsync(`git add -A "${filePath}"`, { cwd: workspacePath })
      return true
    } catch (e) {
      console.error('git:stage failed', e)
      throw new Error(`Failed to stage ${filePath}`)
    }
  })
  
  // Unstage arquivo
  ipcMain.handle('git:unstage', async (_evt, filePath) => {
    try {
      const workspacePath = assertWorkspaceSelected()
      await execAsync(`git reset HEAD "${filePath}"`, { cwd: workspacePath })
      return true
    } catch (e) {
      console.error('git:unstage failed', e)
      throw new Error(`Failed to unstage ${filePath}`)
    }
  })
  
  // Descartar mudanças
  ipcMain.handle('git:discard', async (_evt, filePath) => {
    try {
      const workspacePath = assertWorkspaceSelected()
      await execAsync(`git checkout -- "${filePath}"`, { cwd: workspacePath })
      return true
    } catch (e) {
      console.error('git:discard failed', e)
      throw new Error(`Failed to discard changes in ${filePath}`)
    }
  })
  
  // Commit
  ipcMain.handle('git:commit', async (_evt, message) => {
    try {
      const workspacePath = assertWorkspaceSelected()
      
      // Verifica se o Git está configurado
      try {
        await execAsync('git config user.name', { cwd: workspacePath })
        await execAsync('git config user.email', { cwd: workspacePath })
      } catch (configError) {
        throw new Error('Git não está configurado. Configure seu nome e email primeiro.')
      }
      
      // Verifica se há arquivos staged usando git status
      const { stdout: statusOutput } = await execAsync('git status --porcelain', { cwd: workspacePath })
      const lines = statusOutput.trim().split('\n').filter(Boolean)
      const hasStagedFiles = lines.some(line => {
        const X = line[0]
        return X !== ' ' && X !== '?'
      })
      
      if (!hasStagedFiles) {
        throw new Error('Nenhum arquivo no stage. Use o botão + para adicionar arquivos antes de commitar.')
      }
      
      const escapedMessage = message.replace(/"/g, '\\"')
      await execAsync(`git commit -m "${escapedMessage}"`, { cwd: workspacePath })
      return true
    } catch (e) {
      console.error('git:commit failed', e)
      throw new Error(e.message || 'Falha ao fazer commit')
    }
  })
  
  // Configurar usuário Git
  ipcMain.handle('git:config', async (_evt, key, value) => {
    try {
      const workspacePath = assertWorkspaceSelected()
      await execAsync(`git config ${key} "${value}"`, { cwd: workspacePath })
      return true
    } catch (e) {
      console.error('git:config failed', e)
      throw new Error(`Failed to set git config ${key}`)
    }
  })
  
  // Obter configuração Git
  ipcMain.handle('git:getConfig', async (_evt, key) => {
    try {
      const workspacePath = assertWorkspaceSelected()
      const { stdout } = await execAsync(`git config ${key}`, { cwd: workspacePath })
      return stdout.trim()
    } catch (e) {
      return null // Config não existe
    }
  })
  
  // Inicializar repositório
  ipcMain.handle('git:init', async () => {
    try {
      const workspacePath = assertWorkspaceSelected()
      await execAsync('git init', { cwd: workspacePath })
      return true
    } catch (e) {
      console.error('git:init failed', e)
      throw new Error('Failed to initialize git repository')
    }
  })
  
  // ===== Comandos Git Avançados =====
  
  // Pull
  ipcMain.handle('git:pull', async () => {
    try {
      const workspacePath = assertWorkspaceSelected()
      const { stdout, stderr } = await execAsync('git pull', { cwd: workspacePath })
      return { success: true, message: stdout || stderr }
    } catch (e) {
      console.error('git:pull failed', e)
      throw new Error('Failed to pull: ' + e.message)
    }
  })
  
  // Push
  ipcMain.handle('git:push', async () => {
    try {
      const workspacePath = assertWorkspaceSelected()
      const { stdout, stderr } = await execAsync('git push', { cwd: workspacePath })
      return { success: true, message: stdout || stderr }
    } catch (e) {
      console.error('git:push failed', e)
      throw new Error('Failed to push: ' + e.message)
    }
  })
  
  // Fetch
  ipcMain.handle('git:fetch', async () => {
    try {
      const workspacePath = assertWorkspaceSelected()
      const { stdout, stderr } = await execAsync('git fetch', { cwd: workspacePath })
      return { success: true, message: stdout || stderr }
    } catch (e) {
      console.error('git:fetch failed', e)
      throw new Error('Failed to fetch: ' + e.message)
    }
  })
  
  // Listar branches
  ipcMain.handle('git:branches', async () => {
    try {
      const workspacePath = assertWorkspaceSelected()
      const { stdout } = await execAsync('git branch -a', { cwd: workspacePath })
      
      const branches = stdout.trim().split('\n').map(line => {
        const isCurrent = line.startsWith('*')
        const name = line.replace(/^\*?\s+/, '').trim()
        const isRemote = name.startsWith('remotes/')
        
        return {
          name: name.replace('remotes/', ''),
          current: isCurrent,
          remote: isRemote
        }
      }).filter(b => b.name && b.name !== 'HEAD')
      
      return branches
    } catch (e) {
      console.error('git:branches failed', e)
      return []
    }
  })
  
  // Criar branch
  ipcMain.handle('git:createBranch', async (_evt, branchName) => {
    try {
      const workspacePath = assertWorkspaceSelected()
      await execAsync(`git branch "${branchName}"`, { cwd: workspacePath })
      return true
    } catch (e) {
      console.error('git:createBranch failed', e)
      throw new Error(`Failed to create branch ${branchName}`)
    }
  })
  
  // Trocar branch
  ipcMain.handle('git:checkout', async (_evt, branchName) => {
    try {
      const workspacePath = assertWorkspaceSelected()
      await execAsync(`git checkout "${branchName}"`, { cwd: workspacePath })
      return true
    } catch (e) {
      console.error('git:checkout failed', e)
      throw new Error(`Failed to checkout branch ${branchName}`)
    }
  })
  
  // Deletar branch
  ipcMain.handle('git:deleteBranch', async (_evt, branchName) => {
    try {
      const workspacePath = assertWorkspaceSelected()
      await execAsync(`git branch -d "${branchName}"`, { cwd: workspacePath })
      return true
    } catch (e) {
      console.error('git:deleteBranch failed', e)
      throw new Error(`Failed to delete branch ${branchName}`)
    }
  })
  
  // Histórico de commits
  ipcMain.handle('git:log', async (_evt, options = {}) => {
    try {
      const workspacePath = assertWorkspaceSelected()
      const limit = options.limit || 50
      const skip = options.skip || 0
      
      // Format: hash|author|email|date|subject
      const format = '%H|%an|%ae|%ai|%s'
      const cmd = `git log --format="${format}" --max-count=${limit} --skip=${skip}`
      
      const { stdout } = await execAsync(cmd, { cwd: workspacePath })
      
      if (!stdout.trim()) {
        return []
      }
      
      const commits = stdout.trim().split('\n').map(line => {
        const [hash, author, email, date, subject] = line.split('|')
        return {
          hash: hash.trim(),
          shortHash: hash.trim().substring(0, 7),
          author: author.trim(),
          email: email.trim(),
          date: date.trim(),
          subject: subject.trim()
        }
      })
      
      return commits
    } catch (e) {
      console.error('git:log failed', e)
      return []
    }
  })
  
  // Diff de arquivo
  ipcMain.handle('git:diff', async (_evt, filePath, staged = false) => {
    try {
      const workspacePath = assertWorkspaceSelected()
      const flag = staged ? '--cached' : ''
      const cmd = `git diff ${flag} -- "${filePath}"`
      
      const { stdout } = await execAsync(cmd, { cwd: workspacePath })
      
      if (!stdout.trim()) {
        return null
      }
      
      return stdout
    } catch (e) {
      console.error('git:diff failed', e)
      return null
    }
  })

  // ===== Terminal PTY Handlers =====
  
  // Criar novo terminal
  ipcMain.handle('terminal:create', (evt, options = {}) => {
    try {
      log('info', 'ipc:terminal:create', 'Criando novo terminal', { cwd: options?.cwd })
      const shell = process.platform === 'win32' ? 'powershell.exe' : (process.env.SHELL || '/bin/bash')
      const cwd = options.cwd || currentWorkspacePath || os.homedir()
      const cols = options.cols || 80
      const rows = options.rows || 24
      const envOverrides = options?.env && typeof options.env === 'object' ? options.env : null
      const safeEnvOverrides = {}
      if (envOverrides) {
        for (const [key, value] of Object.entries(envOverrides)) {
          if (typeof key !== 'string' || key.trim().length === 0) continue
          if (typeof value !== 'string') continue
          safeEnvOverrides[key] = value
        }
      }
      
      const terminalId = `term_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      log('verbose', 'ipc:terminal:create', 'Terminal ID gerado', { id: terminalId, shell })
      
      const ptyProcess = pty.spawn(shell, [], {
        name: 'xterm-256color',
        cols,
        rows,
        cwd,
        env: {
          ...process.env,
          TERM: 'xterm-256color',
          COLORTERM: 'truecolor',
          ...safeEnvOverrides
        }
      })
      
      terminals.set(terminalId, ptyProcess)
      log('info', 'ipc:terminal:create', 'Terminal criado com sucesso', { id: terminalId, pid: ptyProcess.pid })
      
      // Enviar dados do terminal para o renderer
      ptyProcess.onData((data) => {
        const win = BrowserWindow.fromWebContents(evt.sender)
        if (win && !win.isDestroyed()) {
          evt.sender.send('terminal:data', terminalId, data)
        }
      })
      
      // Quando o terminal fechar
      ptyProcess.onExit(({ exitCode }) => {
        log('info', 'ipc:terminal:create', 'Terminal fechado', { id: terminalId, exitCode })
        terminals.delete(terminalId)
        const win = BrowserWindow.fromWebContents(evt.sender)
        if (win && !win.isDestroyed()) {
          evt.sender.send('terminal:exit', terminalId, exitCode)
        }
      })
      
      return terminalId
    } catch (e) {
      log('error', 'ipc:terminal:create', 'Erro ao criar terminal', { error: e.message })
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

  // ===== CLI Store Handlers =====
  ipcMain.handle('cliStore:checkNode', async () => {
    return await checkNodeAndNpm()
  })

  ipcMain.handle('cliStore:fetchCatalog', async () => {
    return await fetchCliStoreCatalog()
  })

  ipcMain.handle('cliStore:listInstalled', async (_evt, options = {}) => {
    const scope = options?.scope === 'global' ? 'global' : 'local'
    return await npmListInstalled(scope)
  })

  ipcMain.handle('cliStore:install', async (_evt, options = {}) => {
    const pkg = typeof options?.pkg === 'string' ? options.pkg.trim() : ''
    if (!pkg) throw new Error('Invalid package')
    const scope = options?.scope === 'global' ? 'global' : 'local'
    await npmInstallPackage(pkg, scope)
    return await npmListInstalled(scope)
  })

  ipcMain.handle('cliStore:uninstall', async (_evt, options = {}) => {
    const pkg = typeof options?.pkg === 'string' ? options.pkg.trim() : ''
    if (!pkg) throw new Error('Invalid package')
    const scope = options?.scope === 'global' ? 'global' : 'local'
    await npmUninstallPackage(pkg, scope)
    return await npmListInstalled(scope)
  })

  ipcMain.handle('cliStore:getBinPath', async (_evt, options = {}) => {
    const scope = options?.scope === 'global' ? 'global' : 'local'
    if (scope === 'global') {
      const check = await checkNodeAndNpm()
      if (!check.ok) throw new Error(check.error || 'Node.js/npm não disponível')
      const { stdout } = await execAsync('npm bin -g')
      return String(stdout || '').trim()
    }
    await ensureCliToolsProject()
    return getCliToolsBinDir()
  })

  // ===== AI Agent Handlers =====
  
  // Instância do agente (uma por janela seria ideal, mas singleton por agora)
  
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
  
  ipcMain.handle('ai:chat', async (evt, message, options = {}) => {
    try {
      log('info', 'ipc:ai:chat', 'Mensagem recebida', { length: message?.length, mode: options?.mode })
      
      if (!aiAgent) {
        log('verbose', 'ipc:ai:chat', 'Inicializando agente de IA (primeira vez)')
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
        log('info', 'ipc:ai:chat', 'Tool call executado', { tool: toolInfo?.name })
        const win = BrowserWindow.fromWebContents(evt.sender)
        if (win && !win.isDestroyed()) {
          evt.sender.send('ai:tool-call', toolInfo)
        }
      }
      
      log('info', 'ipc:ai:chat', 'Enviando mensagem para IA')
      const result = await aiAgent.chat(message, options)
      log('info', 'ipc:ai:chat', 'Resposta da IA recebida', { tokens: result?.usage?.total_tokens })
      return result
    } catch (e) {
      log('error', 'ipc:ai:chat', 'Erro no chat com IA', { error: e.message })
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
  
  // Obter modos de chat disponíveis
  ipcMain.handle('ai:getModes', async () => {
    return CHAT_MODES
  })
  
  // Definir modo de chat
  ipcMain.handle('ai:setMode', async (_evt, mode) => {
    try {
      if (!aiAgent) {
        const settings = await loadSettings()
        aiAgent = new AIAgent(settings.ai)
        if (currentWorkspacePath) {
          aiAgent.setWorkspace(currentWorkspacePath)
          toolExecutor.setWorkspace(currentWorkspacePath)
        }
      }
      return aiAgent.setMode(mode)
    } catch (e) {
      console.error('ai:setMode failed', e)
      throw e
    }
  })
  
  // Obter modo atual
  ipcMain.handle('ai:getMode', async () => {
    if (aiAgent) {
      return aiAgent.getMode()
    }
    return { mode: 'agent', ...CHAT_MODES.agent }
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

  // ===== Autocomplete AI Service =====
  
  // Instância do serviço de autocomplete
  let autocompleteService = null
  
  // Inicializar autocomplete com configurações
  ipcMain.handle('ai:autocomplete:init', async (_evt, settings) => {
    try {
      const { AutocompleteService } = await import('./ai/autocomplete.js')
      autocompleteService = new AutocompleteService(settings)
      return { success: true }
    } catch (e) {
      console.error('ai:autocomplete:init failed', e)
      throw e
    }
  })
  
  // Fazer uma completion
  ipcMain.handle('ai:autocomplete:complete', async (_evt, params) => {
    try {
      if (!autocompleteService) {
        const { AutocompleteService } = await import('./ai/autocomplete.js')
        const settings = await loadSettings()
        autocompleteService = new AutocompleteService({
          // endpoint: settings.ai?.endpoint?.replace('/chat/completions', '/completions') || 'http://192.168.1.18:8000/v1/completions',
          endpoint: settings.ai?.endpoint?.replace('/chat/completions', '/completions') || 'https://ia.auth.com.br/v1/completions',
          model: settings.ai?.model || 'Qwen/Qwen2.5-Coder-3B-Instruct',
          temperature: settings.ai?.temperature ?? 0.1,
          maxTokens: 128,
          enabled: settings.ai?.autocomplete?.enabled ?? true
        })
      }
      
      const result = await autocompleteService.complete(params)
      return result
    } catch (e) {
      console.error('ai:autocomplete:complete failed', e)
      throw e
    }
  })
  
  // Atualizar configurações do autocomplete
  ipcMain.handle('ai:autocomplete:updateSettings', async (_evt, settings) => {
    if (autocompleteService) {
      autocompleteService.updateSettings(settings)
    }
    return { success: true }
  })
  
  // Ativar/desativar autocomplete
  ipcMain.handle('ai:autocomplete:setEnabled', async (_evt, enabled) => {
    if (autocompleteService) {
      autocompleteService.updateSettings({ enabled })
    }
    return { success: true }
  })
  
  // Limpar cache do autocomplete
  ipcMain.handle('ai:autocomplete:clearCache', async () => {
    if (autocompleteService) {
      autocompleteService.clearCache()
    }
    return { success: true }
  })
  
  // Abortar requests pendentes
  ipcMain.handle('ai:autocomplete:abort', async () => {
    if (autocompleteService) {
      autocompleteService.abort()
    }
    return { success: true }
  })
  
  // Atualiza workspace no agente quando selecionar nova pasta
  const originalWorkspaceSelect = ipcMain.listeners('workspace:select')[0]
  // Hook para atualizar workspace no agente

  const win = createWindow()

  // Verifica se o app foi iniciado com um caminho via CLI
  win.webContents.once('did-finish-load', async () => {
    const pathFromArgv = await getPathFromArgv(process.argv)
    if (pathFromArgv) {
      log('info', 'app:startup', 'Abrindo workspace inicial via CLI', { path: pathFromArgv })
      win.webContents.send('workspace:open-from-cli', pathFromArgv)
    }
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  stopWorkspaceWatcher()
  if (process.platform !== 'darwin') app.quit()
})
