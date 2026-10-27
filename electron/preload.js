// Preload script for Electron security
// This runs in a context that has access to Node.js APIs
// but is isolated from the web page content

const { contextBridge, ipcRenderer } = require('electron')

// Subscribe to a main-process channel; returns an unsubscribe function
const subscribe = (channel, cb) => {
  const listener = (_, ...args) => cb(...args)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  versions: { chrome: process.versions.chrome, electron: process.versions.electron },
  onFullscreenChange: (cb) => subscribe('fullscreen-changed', cb),
  // Menu / keyboard-shortcut commands: cb(command, arg)
  onCommand: (cb) => subscribe('browser-command', cb),
  // A page asked to open a link in a new tab (target=_blank, window.open)
  onOpenInNewTab: (cb) => subscribe('open-in-new-tab', cb),
  closeWindow: () => ipcRenderer.send('close-window'),
  maximizeWindow: () => ipcRenderer.send('maximize-window'),
  toggleFullScreen: () => ipcRenderer.send('toggle-fullscreen'),
  setWindowButtonsVisible: (visible) => ipcRenderer.send('set-window-buttons-visible', visible),
  newWindow: (options) => ipcRenderer.send('new-window', options || {}),
  openPath: (pathKey) => ipcRenderer.invoke('open-path', pathKey),
  savePage: (webContentsId, title) => ipcRenderer.invoke('save-page', { webContentsId, title }),
  clearBrowsingData: () => ipcRenderer.invoke('clear-browsing-data'),
  // Downloads
  downloadURL: (url) => ipcRenderer.invoke('download-url', url),
  showItemInFolder: (filePath) => ipcRenderer.invoke('show-item-in-folder', filePath),
  openFile: (filePath) => ipcRenderer.invoke('open-file', filePath),
  cancelDownload: (id) => ipcRenderer.invoke('cancel-download', id),
  togglePauseDownload: (id) => ipcRenderer.invoke('pause-download', id),
  getDownloadPrefs: () => ipcRenderer.invoke('get-download-prefs'),
  setDownloadPrefs: (changes) => ipcRenderer.invoke('set-download-prefs', changes),
  chooseDownloadFolder: () => ipcRenderer.invoke('choose-download-folder'),
  onDownloadStarted: (cb) => subscribe('download-started', cb),
  onDownloadUpdated: (cb) => subscribe('download-updated', cb),
  onDownloadDone: (cb) => subscribe('download-done', cb),
  // Extensions
  loadExtension: () => ipcRenderer.invoke('load-extension'),
  getExtensions: () => ipcRenderer.invoke('get-extensions'),
  removeExtension: (id) => ipcRenderer.invoke('remove-extension', id),
  reloadExtension: (id) => ipcRenderer.invoke('reload-extension', id),
  revealExtension: (id) => ipcRenderer.invoke('reveal-extension', id),
  // Shields: ad/tracker/pop-up blocking, HTTPS upgrade, secure DNS, VPN/proxy
  shields: {
    get: () => ipcRenderer.invoke('shields:get'),
    set: (changes) => ipcRenderer.invoke('shields:set', changes),
    setSite: (host, allowed) => ipcRenderer.invoke('shields:set-site', { host, allowed }),
    setProxyAuth: (auth) => ipcRenderer.invoke('shields:set-proxy-auth', auth),
    test: (scope) => ipcRenderer.invoke('shields:test', { scope }),
    onStats: (cb) => subscribe('shields:stats', cb),
  },
  // AI assistant (keys stay in the main process; see electron/assistant.js)
  assistant: {
    getConfig: () => ipcRenderer.invoke('assistant:get-config'),
    connect: (provider, key) => ipcRenderer.invoke('assistant:connect', { provider, key }),
    disconnect: (provider) => ipcRenderer.invoke('assistant:disconnect', provider),
    listModels: (provider) => ipcRenderer.invoke('assistant:models', provider),
    select: (provider, model) => ipcRenderer.invoke('assistant:select', { provider, model }),
    chat: (requestId, messages, page) => ipcRenderer.invoke('assistant:chat', { requestId, messages, page }),
    cancel: (requestId) => ipcRenderer.invoke('assistant:cancel', requestId),
    onDelta: (cb) => subscribe('assistant:delta', cb),
    onDone: (cb) => subscribe('assistant:done', cb),
  },
})
