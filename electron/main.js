const { app, BrowserWindow, ipcMain } = require('electron')
const { join } = require('path')
const { existsSync } = require('fs')

// Keep a global reference of the window object
let mainWindow

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#faf8f5', // Matches --paper-beige
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      webviewTag: true,
      preload: join(__dirname, 'preload.js'),
      // Performance optimizations
      enableBlinkFeatures: 'CSSColorSchemeUARendering',
      disableBlinkFeatures: 'Auxclick',
      v8CacheOptions: 'code',
      backgroundThrottling: false
    }
  })

  // Load the app
  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged
  
  if (isDev) {
    // In development, load from Vite dev server
    // Wait a bit for Vite to be ready, then try loading
    setTimeout(() => {
      const tryLoad = (port) => {
        mainWindow.loadURL(`http://localhost:${port}`).then(() => {
          console.log(`Loaded from port ${port}`)
        }).catch((err) => {
          console.log(`Failed to load from port ${port}, trying next...`)
          if (port === 3000) {
            setTimeout(() => tryLoad(3001), 500)
          } else if (port === 3001) {
            setTimeout(() => tryLoad(5173), 500)
          } else {
            console.error('Failed to load dev server from any port')
          }
        })
      }
      tryLoad(3000)
    }, 1000)
    // Open DevTools in development
    mainWindow.webContents.openDevTools()
  } else {
    // In production, load from built files
    const indexPath = join(__dirname, '../dist/index.html')
    if (existsSync(indexPath)) {
      mainWindow.loadFile(indexPath)
    } else {
      console.error('Built files not found. Run npm run build first.')
    }
  }

  // Emitted when the window is closed
  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // Handle fullscreen events
  mainWindow.on('enter-full-screen', () => {
    mainWindow.webContents.send('fullscreen-changed', true)
  })

  mainWindow.on('leave-full-screen', () => {
    mainWindow.webContents.send('fullscreen-changed', false)
  })
}

// This method will be called when Electron has finished initialization
app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    // On macOS, re-create window when dock icon is clicked
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

// Quit when all windows are closed (except on macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Handle webview creation requests from renderer
ipcMain.handle('create-webview', async (event, { url, tabId }) => {
  return { success: true, tabId }
})

// Handle webview navigation
ipcMain.handle('navigate-webview', async (event, { tabId, url }) => {
  // This will be handled by the webview tag in the renderer
  return { success: true }
})

// Handle webview history
ipcMain.handle('webview-back', async (event, { tabId }) => {
  return { success: true }
})

ipcMain.handle('webview-forward', async (event, { tabId }) => {
  return { success: true }
})

ipcMain.handle('webview-reload', async (event, { tabId }) => {
  return { success: true }
})

// Handle app close request
ipcMain.on('close-app', () => {
  app.quit()
})

// Handle window maximize request
ipcMain.on('maximize-window', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize()
    } else {
      mainWindow.maximize()
    }
  }
})

// Open a new browser window
ipcMain.on('new-window', () => {
  createWindow()
})
