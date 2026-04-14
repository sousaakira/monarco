const { contextBridge, ipcRenderer, clipboard } = require('electron')

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

  clipboard: {
    readText: () => clipboard.readText(),
    writeText: (text) => clipboard.writeText(String(text ?? ''))
  },

  webview: {
    getPreloadPath: () => ipcRenderer.invoke('webview:getPreloadPath')
  },
  
  // Git APIs — todos aceitam rootPath opcional para suporte multi-repo
  git: {
    isRepository:  (rootPath)              => ipcRenderer.invoke('git:isRepository', rootPath),
    status:        (rootPath)              => ipcRenderer.invoke('git:status', rootPath),
    currentBranch: (rootPath)              => ipcRenderer.invoke('git:currentBranch', rootPath),
    stage:         (filePath, rootPath)    => ipcRenderer.invoke('git:stage', filePath, rootPath),
    unstage:       (filePath, rootPath)    => ipcRenderer.invoke('git:unstage', filePath, rootPath),
    discard:       (filePath, rootPath)    => ipcRenderer.invoke('git:discard', filePath, rootPath),
    commit:        (message, rootPath)     => ipcRenderer.invoke('git:commit', message, rootPath),
    init:          (rootPath)              => ipcRenderer.invoke('git:init', rootPath),
    config:        (key, value, rootPath)  => ipcRenderer.invoke('git:config', key, value, rootPath),
    getConfig:     (key, rootPath)         => ipcRenderer.invoke('git:getConfig', key, rootPath),
    pull:          (rootPath)              => ipcRenderer.invoke('git:pull', rootPath),
    push:          (rootPath)              => ipcRenderer.invoke('git:push', rootPath),
    fetch:         (rootPath)              => ipcRenderer.invoke('git:fetch', rootPath),
    branches:      (rootPath)              => ipcRenderer.invoke('git:branches', rootPath),
    createBranch:  (name, rootPath)        => ipcRenderer.invoke('git:createBranch', name, rootPath),
    checkout:      (name, rootPath)        => ipcRenderer.invoke('git:checkout', name, rootPath),
    deleteBranch:  (name, rootPath)        => ipcRenderer.invoke('git:deleteBranch', name, rootPath),
    log:           (options, rootPath)     => ipcRenderer.invoke('git:log', options, rootPath),
    diff:          (filePath, staged, rootPath) => ipcRenderer.invoke('git:diff', filePath, staged, rootPath),
    // Multi-repo
    allRepos:               ()         => ipcRenderer.invoke('git:allRepos'),
    generateCommitMessage:  (rootPath) => ipcRenderer.invoke('git:generateCommitMessage', rootPath)
  },
  
  // Workspace Recent APIs
  workspace: {
    select: () => ipcRenderer.invoke('workspace:select'),
    getRecent: () => ipcRenderer.invoke('workspace:getRecent'),
    openRecent: (path) => ipcRenderer.invoke('workspace:openRecent', path),
    getLast: () => ipcRenderer.invoke('workspace:getLast'),
    getInitialPath: () => ipcRenderer.invoke('workspace:getInitialPath'),
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
    openDetached: (terminalId, name) => ipcRenderer.invoke('terminal:openDetached', { terminalId, name }),
    transfer: (terminalId) => ipcRenderer.invoke('terminal:transfer', terminalId),
    reattach: (terminalId, name) => ipcRenderer.invoke('terminal:reattach', { terminalId, name }),
    onReattach: (callback) => {
      const listener = (_event, data) => callback(data)
      ipcRenderer.on('terminal:reattached', listener)
      return () => ipcRenderer.removeListener('terminal:reattached', listener)
    },
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
