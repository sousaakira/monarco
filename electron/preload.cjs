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
    getConfig: (key) => ipcRenderer.invoke('git:getConfig', key),
    // Novos comandos avançados
    pull: () => ipcRenderer.invoke('git:pull'),
    push: () => ipcRenderer.invoke('git:push'),
    fetch: () => ipcRenderer.invoke('git:fetch'),
    branches: () => ipcRenderer.invoke('git:branches'),
    createBranch: (name) => ipcRenderer.invoke('git:createBranch', name),
    checkout: (name) => ipcRenderer.invoke('git:checkout', name),
    deleteBranch: (name) => ipcRenderer.invoke('git:deleteBranch', name),
    log: (options) => ipcRenderer.invoke('git:log', options),
    diff: (filePath, staged) => ipcRenderer.invoke('git:diff', filePath, staged)
  },
  
  // Workspace Recent APIs
  workspace: {
    select: () => ipcRenderer.invoke('workspace:select'),
    getRecent: () => ipcRenderer.invoke('workspace:getRecent'),
    openRecent: (path) => ipcRenderer.invoke('workspace:openRecent', path),
    getLast: () => ipcRenderer.invoke('workspace:getLast'),
    removeRecent: (path) => ipcRenderer.invoke('workspace:removeRecent', path),
    getFolders: () => ipcRenderer.invoke('workspace:getFolders'),
    addFolder: () => ipcRenderer.invoke('workspace:addFolder'),
    removeFolder: (path) => ipcRenderer.invoke('workspace:removeFolder', path),
    setActiveFolder: (path) => ipcRenderer.invoke('workspace:setActiveFolder', path),
    onOpenFromCli: (callback) => {
      const listener = (_event, path) => callback(path)
      ipcRenderer.on('workspace:open-from-cli', listener)
      return () => ipcRenderer.removeListener('workspace:open-from-cli', listener)
    },
    onChanged: (callback) => {
      const listener = (_event, info) => callback(info)
      ipcRenderer.on('workspace:changed', listener)
      return () => ipcRenderer.removeListener('workspace:changed', listener)
    }
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

  // CLI Store APIs
  cliStore: {
    checkNode: () => ipcRenderer.invoke('cliStore:checkNode'),
    fetchCatalog: () => ipcRenderer.invoke('cliStore:fetchCatalog'),
    listInstalled: ({ scope } = {}) => ipcRenderer.invoke('cliStore:listInstalled', { scope }),
    install: (pkg, { scope } = {}) => ipcRenderer.invoke('cliStore:install', { pkg, scope }),
    uninstall: (pkg, { scope } = {}) => ipcRenderer.invoke('cliStore:uninstall', { pkg, scope }),
    getBinPath: ({ scope } = {}) => ipcRenderer.invoke('cliStore:getBinPath', { scope })
  },

  // AI CLI Sessions (persisted files)
  aiSessions: {
    list: ({ limit } = {}) => ipcRenderer.invoke('aiSessions:list', { limit }),
    upsert: (session) => ipcRenderer.invoke('aiSessions:upsert', session),
    remove: (resumeId) => ipcRenderer.invoke('aiSessions:remove', resumeId),
    onChanged: (callback) => {
      const listener = (_event, info) => callback(info)
      ipcRenderer.on('aiSessions:changed', listener)
      return () => ipcRenderer.removeListener('aiSessions:changed', listener)
    }
  },

  // AI Profiles (persisted files)
  aiProfiles: {
    list: () => ipcRenderer.invoke('aiProfiles:list'),
    upsert: (profile) => ipcRenderer.invoke('aiProfiles:upsert', profile),
    remove: (id) => ipcRenderer.invoke('aiProfiles:remove', id),
    setActive: (id) => ipcRenderer.invoke('aiProfiles:setActive', id),
    onChanged: (callback) => {
      const listener = (_event, info) => callback(info)
      ipcRenderer.on('aiProfiles:changed', listener)
      return () => ipcRenderer.removeListener('aiProfiles:changed', listener)
    }
  },
  
  // AI Agent APIs
  ai: {
    init: (settings) => ipcRenderer.invoke('ai:init', settings),
    chat: (message, options) => ipcRenderer.invoke('ai:chat', message, options),
    clear: () => ipcRenderer.invoke('ai:clear'),
    updateSettings: (settings) => ipcRenderer.invoke('ai:updateSettings', settings),
    getTools: () => ipcRenderer.invoke('ai:getTools'),
    executeTool: (toolName, params) => ipcRenderer.invoke('ai:executeTool', toolName, params),
    // Modos de chat
    getModes: () => ipcRenderer.invoke('ai:getModes'),
    setMode: (mode) => ipcRenderer.invoke('ai:setMode', mode),
    getMode: () => ipcRenderer.invoke('ai:getMode'),
    onToolCall: (callback) => {
      const listener = (_event, toolInfo) => callback(toolInfo)
      ipcRenderer.on('ai:tool-call', listener)
      return () => ipcRenderer.removeListener('ai:tool-call', listener)
    },
    // Autocomplete AI APIs
    autocomplete: {
      init: (settings) => ipcRenderer.invoke('ai:autocomplete:init', settings),
      complete: (params) => ipcRenderer.invoke('ai:autocomplete:complete', params),
      updateSettings: (settings) => ipcRenderer.invoke('ai:autocomplete:updateSettings', settings),
      setEnabled: (enabled) => ipcRenderer.invoke('ai:autocomplete:setEnabled', enabled),
      clearCache: () => ipcRenderer.invoke('ai:autocomplete:clearCache'),
      abort: () => ipcRenderer.invoke('ai:autocomplete:abort')
    }
  },
  
  // Filesystem change notifications
  onFileSystemChange: (callback) => {
    const listener = (_event, changeInfo) => callback(changeInfo)
    ipcRenderer.on('fs:changed', listener)
    return () => ipcRenderer.removeListener('fs:changed', listener)
  }
})
