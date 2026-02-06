// Preload script for Electron security
// This runs in a context that has access to Node.js APIs
// but is isolated from the web page content

const { contextBridge, ipcRenderer } = require('electron')

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  onFullscreenChange: (callback) => {
    ipcRenderer.on('fullscreen-changed', (event, isFullscreen) => {
      callback(isFullscreen)
    })
  },
  closeApp: () => {
    ipcRenderer.send('close-app')
  },
  maximizeWindow: () => {
    ipcRenderer.send('maximize-window')
  },
  newWindow: () => {
    ipcRenderer.send('new-window')
  }
})

// Enable webview tag
process.once('loaded', () => {
  // Webview tag is enabled by default in Electron
})
