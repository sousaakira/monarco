const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('monarco', {
  windowMinimize: () => ipcRenderer.invoke('window:minimize'),
  windowToggleMaximize: () => ipcRenderer.invoke('window:toggleMaximize'),
  windowClose: () => ipcRenderer.invoke('window:close'),
  windowIsMaximized: () => ipcRenderer.invoke('window:isMaximized'),
  selectWorkspace: () => ipcRenderer.invoke('workspace:select'),
  listWorkspaceTree: () => ipcRenderer.invoke('workspace:tree'),
  readTextFile: (filePath) => ipcRenderer.invoke('fs:readTextFile', filePath),
  writeTextFile: (filePath, contents) => ipcRenderer.invoke('fs:writeTextFile', filePath, contents),
  createFile: (parentDirPath, name) => ipcRenderer.invoke('fs:createFile', parentDirPath, name),
  createFolder: (parentDirPath, name) => ipcRenderer.invoke('fs:createFolder', parentDirPath, name),
  renamePath: (oldPath, newName) => ipcRenderer.invoke('fs:renamePath', oldPath, newName),
  deletePath: (targetPath) => ipcRenderer.invoke('fs:deletePath', targetPath),
  searchFiles: (query, options) => ipcRenderer.invoke('fs:search', query, options),
  searchWorkspace: (query) => ipcRenderer.invoke('workspace:search', query),
  
  // Git APIs
  git: {
    isRepository: () => ipcRenderer.invoke('git:isRepository'),
    status: () => ipcRenderer.invoke('git:status'),
    currentBranch: () => ipcRenderer.invoke('git:currentBranch'),
    stage: (filePath) => ipcRenderer.invoke('git:stage', filePath),
    unstage: (filePath) => ipcRenderer.invoke('git:unstage', filePath),
    discard: (filePath) => ipcRenderer.invoke('git:discard', filePath),
    commit: (message) => ipcRenderer.invoke('git:commit', message),
    init: () => ipcRenderer.invoke('git:init'),
    config: (key, value) => ipcRenderer.invoke('git:config', key, value),
    getConfig: (key) => ipcRenderer.invoke('git:getConfig', key)
  },
  
  // Workspace Recent APIs
  workspace: {
    select: () => ipcRenderer.invoke('workspace:select'),
    getRecent: () => ipcRenderer.invoke('workspace:getRecent'),
    openRecent: (path) => ipcRenderer.invoke('workspace:openRecent', path),
    getLast: () => ipcRenderer.invoke('workspace:getLast'),
    removeRecent: (path) => ipcRenderer.invoke('workspace:removeRecent', path)
  },
  
  // Terminal APIs
  terminal: {
    create: (options) => ipcRenderer.invoke('terminal:create', options),
    write: (terminalId, data) => ipcRenderer.invoke('terminal:write', terminalId, data),
    resize: (terminalId, cols, rows) => ipcRenderer.invoke('terminal:resize', terminalId, cols, rows),
    destroy: (terminalId) => ipcRenderer.invoke('terminal:destroy', terminalId),
    getCwd: () => ipcRenderer.invoke('terminal:getCwd'),
    onData: (callback) => {
      const listener = (_event, terminalId, data) => callback(terminalId, data)
      ipcRenderer.on('terminal:data', listener)
      return () => ipcRenderer.removeListener('terminal:data', listener)
    },
    onExit: (callback) => {
      const listener = (_event, terminalId, exitCode) => callback(terminalId, exitCode)
      ipcRenderer.on('terminal:exit', listener)
      return () => ipcRenderer.removeListener('terminal:exit', listener)
    }
  },
  
  // Settings APIs
  settings: {
    load: () => ipcRenderer.invoke('settings:load'),
    save: (settings) => ipcRenderer.invoke('settings:save', settings),
    getConfigPath: () => ipcRenderer.invoke('settings:getConfigPath'),
    openConfigDir: () => ipcRenderer.invoke('settings:openConfigDir')
  },
  
  // AI Agent APIs
  ai: {
    init: (settings) => ipcRenderer.invoke('ai:init', settings),
    chat: (message, options) => ipcRenderer.invoke('ai:chat', message, options),
    clear: () => ipcRenderer.invoke('ai:clear'),
    updateSettings: (settings) => ipcRenderer.invoke('ai:updateSettings', settings),
    getTools: () => ipcRenderer.invoke('ai:getTools'),
    executeTool: (toolName, params) => ipcRenderer.invoke('ai:executeTool', toolName, params),
    onToolCall: (callback) => {
      const listener = (_event, toolInfo) => callback(toolInfo)
      ipcRenderer.on('ai:tool-call', listener)
      return () => ipcRenderer.removeListener('ai:tool-call', listener)
    }
  },
  
  // Filesystem change notifications
  onFileSystemChange: (callback) => {
    const listener = (_event, changeInfo) => callback(changeInfo)
    ipcRenderer.on('fs:changed', listener)
    return () => ipcRenderer.removeListener('fs:changed', listener)
  }
})
