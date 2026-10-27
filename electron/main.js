const { app, BrowserWindow, Menu, ipcMain, shell, dialog, session, webContents } = require('electron')
const { join, parse } = require('path')
const { existsSync, readFileSync, writeFileSync } = require('fs')
const { registerAssistant } = require('./assistant')
const { setupShields, attachToWebview } = require('./shields')
const { watchSignIn, installSignIn } = require('./signin')

const isMac = process.platform === 'darwin'
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged
// Shown in the menu bar and About panel. app.name also names the profile folder
// and keychain entry: the dev app keeps "smiazon-browser" so existing bookmarks and
// history stay put, while installed builds are "A4" (build.extraMetadata) with their own.
const APP_NAME = 'A4'

// Small JSON files in the app's userData folder (download prefs, extensions)
function readJson(name, fallback) {
  try {
    return JSON.parse(readFileSync(join(app.getPath('userData'), name), 'utf8'))
  } catch (_) {
    return fallback
  }
}

function writeJson(name, value) {
  writeFileSync(join(app.getPath('userData'), name), JSON.stringify(value, null, 2))
}

const downloadPrefs = () => ({
  downloadDir: app.getPath('downloads'),
  askWhereToSave: false,
  ...readJson('prefs.json', {}),
})

// Incognito tabs use an in-memory partition (no "persist:" prefix), so cookies,
// cache and storage disappear when the app quits. Must match WebView.jsx.
const INCOGNITO_PARTITION = 'incognito'

// Load the renderer UI into a window. `query` is passed through to the renderer
// (e.g. { incognito: '1', url: 'https://…' }) and read from location.search.
function loadApp(win, query = {}) {
  if (isDev) {
    const qs = new URLSearchParams(query).toString()
    const tryLoad = (ports) => {
      const [port, ...rest] = ports
      win.loadURL(`http://localhost:${port}${qs ? `/?${qs}` : ''}`).catch(() => {
        if (win.isDestroyed()) return
        if (rest.length) setTimeout(() => tryLoad(rest), 500)
        else console.error('Failed to load dev server from any port')
      })
    }
    // Give Vite a moment to come up when launched alongside it
    setTimeout(() => tryLoad([3000, 3001, 5173]), 1000)
  } else {
    const indexPath = join(__dirname, '../dist/index.html')
    if (existsSync(indexPath)) {
      win.loadFile(indexPath, { query })
    } else {
      console.error('Built files not found. Run npm run build first.')
    }
  }
}

function createWindow({ url, incognito = false } = {}) {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: incognito ? '#0F0F0F' : '#faf8f5', // Matches --paper-beige
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: true,
      preload: join(__dirname, 'preload.js'),
      // Performance optimizations
      enableBlinkFeatures: 'CSSColorSchemeUARendering',
      disableBlinkFeatures: 'Auxclick',
      v8CacheOptions: 'code',
      backgroundThrottling: false
    }
  })

  const query = {}
  if (incognito) query.incognito = '1'
  if (url) query.url = url
  loadApp(win, query)

  if (isDev && !incognito) {
    win.webContents.openDevTools()
  }

  win.on('enter-full-screen', () => win.webContents.send('fullscreen-changed', true))
  win.on('leave-full-screen', () => win.webContents.send('fullscreen-changed', false))

  return win
}

// ---------------------------------------------------------------------------
// Application menu: gives Chrome's keyboard shortcuts. Menu accelerators fire
// even while a web page (webview) has keyboard focus, which a keydown listener
// in the renderer can't do. Each item forwards a command to the focused window.
// ---------------------------------------------------------------------------

function sendCommand(command, arg) {
  const win = BrowserWindow.getFocusedWindow()
  if (!win) {
    if (command === 'new-tab') createWindow()
    return
  }
  // Pull keyboard focus out of the page so the address bar / find bar can take it
  if (command === 'focus-address-bar' || command === 'find') win.webContents.focus()
  win.webContents.send('browser-command', command, arg)
}

const cmd = (label, accelerator, command, arg, extra = {}) => ({
  label,
  accelerator,
  click: () => sendCommand(command, arg),
  ...extra,
})
// Alternate shortcut for an existing command, not shown in the menu
const hidden = (accelerator, command, arg) => cmd(command, accelerator, command, arg, { visible: false, acceleratorWorksWhenHidden: true })

function buildMenu() {
  const selectTabItems = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => hidden(`CmdOrCtrl+${n}`, 'select-tab', n))

  const template = [
    ...(isMac ? [{
      label: APP_NAME,
      submenu: [
        { role: 'about', label: `About ${APP_NAME}` },
        { type: 'separator' },
        cmd('Settings…', 'Cmd+,', 'open-settings'),
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide', label: `Hide ${APP_NAME}` },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit', label: `Quit ${APP_NAME}` },
      ],
    }] : []),
    {
      label: 'File',
      submenu: [
        cmd('New Tab', 'CmdOrCtrl+T', 'new-tab'),
        { label: 'New Window', accelerator: 'CmdOrCtrl+N', click: () => createWindow() },
        { label: 'New Incognito Window', accelerator: 'CmdOrCtrl+Shift+N', click: () => createWindow({ incognito: true }) },
        cmd('Reopen Closed Tab', 'CmdOrCtrl+Shift+T', 'reopen-closed-tab'),
        { type: 'separator' },
        cmd('Open Location…', 'CmdOrCtrl+L', 'focus-address-bar'),
        { type: 'separator' },
        cmd('Close Tab', 'CmdOrCtrl+W', 'close-tab'),
        { label: 'Close Window', accelerator: 'CmdOrCtrl+Shift+W', role: 'close' },
        { type: 'separator' },
        cmd('Save Page As…', 'CmdOrCtrl+S', 'save-page'),
        cmd('Print…', 'CmdOrCtrl+P', 'print'),
        ...(isMac ? [] : [{ type: 'separator' }, cmd('Settings', undefined, 'open-settings'), { role: 'quit' }]),
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
        { type: 'separator' },
        cmd('Find…', 'CmdOrCtrl+F', 'find'),
        cmd('Find Next', 'CmdOrCtrl+G', 'find-next'),
        cmd('Find Previous', 'CmdOrCtrl+Shift+G', 'find-previous'),
      ],
    },
    {
      label: 'View',
      submenu: [
        cmd('Reload This Page', 'CmdOrCtrl+R', 'reload'),
        hidden('F5', 'reload'),
        cmd('Force Reload This Page', 'CmdOrCtrl+Shift+R', 'force-reload'),
        cmd('Stop', 'CmdOrCtrl+.', 'stop'),
        { type: 'separator' },
        cmd('Actual Size', 'CmdOrCtrl+0', 'zoom-reset'),
        cmd('Zoom In', 'CmdOrCtrl+=', 'zoom-in'),
        hidden('CmdOrCtrl+Plus', 'zoom-in'),
        cmd('Zoom Out', 'CmdOrCtrl+-', 'zoom-out'),
        { type: 'separator' },
        cmd('Ask AI', 'CmdOrCtrl+K', 'toggle-assistant'),
        cmd('Focus Mode', 'CmdOrCtrl+Shift+F', 'toggle-focus'),
        cmd('Reading Mode', undefined, 'reading-mode'),
        { role: 'togglefullscreen' },
        { type: 'separator' },
        cmd('Developer Tools', isMac ? 'Alt+Cmd+I' : 'Ctrl+Shift+I', 'devtools'),
        hidden('F12', 'devtools'),
        {
          label: 'Inspect Browser UI',
          click: () => BrowserWindow.getFocusedWindow()?.webContents.openDevTools({ mode: 'detach' }),
        },
      ],
    },
    {
      label: 'History',
      submenu: [
        cmd('Back', 'CmdOrCtrl+[', 'back'),
        cmd('Forward', 'CmdOrCtrl+]', 'forward'),
        cmd('Home', 'CmdOrCtrl+Shift+H', 'home'),
        { type: 'separator' },
        cmd('Show Full History', 'CmdOrCtrl+Y', 'open-history'),
      ],
    },
    {
      label: 'Bookmarks',
      submenu: [
        cmd('Bookmark This Page', 'CmdOrCtrl+D', 'toggle-bookmark'),
        cmd('Show All Bookmarks', 'CmdOrCtrl+Alt+B', 'open-bookmarks'),
        cmd('Show Bookmarks Bar', 'CmdOrCtrl+Shift+B', 'toggle-bookmarks-bar'),
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        ...(isMac ? [{ role: 'zoom' }] : []),
        { type: 'separator' },
        cmd('Select Next Tab', 'Ctrl+Tab', 'next-tab'),
        hidden('CmdOrCtrl+Alt+Right', 'next-tab'),
        cmd('Select Previous Tab', 'Ctrl+Shift+Tab', 'previous-tab'),
        hidden('CmdOrCtrl+Alt+Left', 'previous-tab'),
        ...selectTabItems,
        { type: 'separator' },
        cmd('Downloads', isMac ? 'Alt+Cmd+L' : 'Ctrl+J', 'open-downloads'),
        cmd('Extensions', undefined, 'open-extensions'),
        ...(isMac ? [{ type: 'separator' }, { role: 'front' }] : []),
      ],
    },
    {
      role: 'help',
      submenu: [cmd('Help & About', undefined, 'help')],
    },
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

// ---------------------------------------------------------------------------
// Downloads
// ---------------------------------------------------------------------------

let nextDownloadId = 1
const downloadItems = new Map() // id -> DownloadItem (for cancel)
const downloadedPaths = new Set() // paths the renderer may open / reveal

// Avoid overwriting: "file.pdf" -> "file (1).pdf" like Chrome does
function uniqueSavePath(dir, filename) {
  const { name, ext } = parse(filename)
  let candidate = join(dir, filename)
  for (let n = 1; existsSync(candidate); n++) {
    candidate = join(dir, `${name} (${n})${ext}`)
  }
  return candidate
}

function trackDownloads(ses) {
  ses.on('will-download', (event, item, sourceContents) => {
    // Downloads started from a page belong to the window hosting that webview
    const host = sourceContents?.hostWebContents || sourceContents
    const win = (host && BrowserWindow.fromWebContents(host)) || BrowserWindow.getFocusedWindow()
    const prefs = downloadPrefs()
    const suggested = uniqueSavePath(existsSync(prefs.downloadDir) ? prefs.downloadDir : app.getPath('downloads'), item.getFilename())
    if (prefs.askWhereToSave) {
      item.setSaveDialogOptions({ defaultPath: suggested }) // Electron shows the save dialog
    } else {
      item.setSavePath(suggested)
    }

    const id = String(nextDownloadId++)
    const startTime = Date.now()
    downloadItems.set(id, item)
    const snapshot = (state) => {
      const savePath = item.getSavePath() || suggested
      downloadedPaths.add(savePath)
      return {
        id,
        name: parse(savePath).base,
        url: item.getURL(),
        savePath,
        state,
        paused: item.isPaused(),
        totalBytes: item.getTotalBytes(),
        receivedBytes: item.getReceivedBytes(),
        startTime,
      }
    }
    const send = (channel, state) => {
      if (win && !win.isDestroyed()) win.webContents.send(channel, snapshot(state))
    }

    send('download-started', 'progressing')
    item.on('updated', (e, state) => send('download-updated', state))
    item.once('done', (e, state) => {
      downloadItems.delete(id)
      send('download-done', state)
    })
  })
}

// ---------------------------------------------------------------------------
// Extensions (remembered across launches)
// ---------------------------------------------------------------------------

const savedExtensionPaths = () => readJson('extensions.json', [])

async function loadSavedExtensions() {
  for (const path of savedExtensionPaths()) {
    if (!existsSync(path)) continue
    try {
      await session.defaultSession.loadExtension(path, { allowFileAccess: true })
    } catch (e) {
      console.error('Could not load extension', path, e.message)
    }
  }
}

function describeExtension(e) {
  const m = e.manifest || {}
  return {
    id: e.id,
    name: e.name,
    version: e.version || m.version || '',
    description: m.description || '',
    path: e.path,
    permissions: [...(m.permissions || []), ...(m.host_permissions || [])].filter(p => typeof p === 'string'),
  }
}

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------

app.whenReady().then(async () => {
  app.setAboutPanelOptions({ applicationName: APP_NAME })
  // Unpackaged, the Dock would show Electron's icon
  if (isDev && process.platform === 'darwin') app.dock.setIcon(join(__dirname, '..', 'build', 'icon-mac.png'))
  // Present as the Chrome it's built on. Some sites (notably Google sign-in)
  // refuse browsers whose user agent says "Electron".
  app.userAgentFallback = app.userAgentFallback.replace(/ (Electron|smiazon-browser)\/\S+/g, '')
  buildMenu()
  registerAssistant()
  await setupShields()
  for (const ses of [session.defaultSession, session.fromPartition(INCOGNITO_PARTITION)]) {
    trackDownloads(ses)
    installSignIn(ses)
  }
  await loadSavedExtensions()
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
  if (!isMac) {
    app.quit()
  }
})

app.on('web-contents-created', (event, contents) => {
  // Lock down any <webview> the UI attaches: pages never get Node or a preload
  contents.on('will-attach-webview', (e, webPreferences) => {
    delete webPreferences.preload
    webPreferences.nodeIntegration = false
    webPreferences.contextIsolation = true
  })

  // Links with target=_blank / window.open from a page open as a new tab
  // in the same window, instead of a bare Electron window with no browser UI.
  if (contents.getType() === 'webview') {
    // Webviews don't paint a default page background, so sites that opt into
    // dark mode (color-scheme: light dark) showed light text on white. Give the
    // page Chrome's default canvas; any background the site sets still wins.
    contents.on('dom-ready', () => {
      contents.insertCSS(':root { background-color: Canvas; }', { cssOrigin: 'user' }).catch(() => {})
    })

    const shields = attachToWebview(contents)
    watchSignIn(contents)
    contents.setWindowOpenHandler(({ url, disposition }) => {
      const host = contents.hostWebContents
      // Pop-up blocker: new tabs only right after the user clicked or typed on the page
      if (host && !host.isDestroyed() && shields.allowPopup(url)) {
        host.send('open-in-new-tab', { url, background: disposition === 'background-tab' })
      }
      return { action: 'deny' }
    })
  }
})

// ---------------------------------------------------------------------------
// IPC from the renderer UI
// ---------------------------------------------------------------------------

const senderWindow = (event) => BrowserWindow.fromWebContents(event.sender)

// Closing the last tab closes that window (not the whole app)
ipcMain.on('close-window', (event) => {
  senderWindow(event)?.close()
})

ipcMain.on('maximize-window', (event) => {
  const win = senderWindow(event)
  if (!win) return
  if (win.isMaximized()) win.unmaximize()
  else win.maximize()
})

// Focus mode hides the macOS traffic lights while the browser chrome is tucked away
ipcMain.on('set-window-buttons-visible', (event, visible) => {
  const win = senderWindow(event)
  if (win && isMac) win.setWindowButtonVisibility(!!visible)
})

ipcMain.on('toggle-fullscreen', (event) => {
  const win = senderWindow(event)
  if (win) win.setFullScreen(!win.isFullScreen())
})

// Open a new browser window, optionally with a URL and/or in incognito mode
ipcMain.on('new-window', (event, options = {}) => {
  createWindow({ url: options.url, incognito: !!options.incognito })
})

// Open a path (e.g. downloads folder) in the system file manager
ipcMain.handle('open-path', async (event, pathKey) => {
  if (pathKey === 'downloads') {
    const err = await shell.openPath(downloadPrefs().downloadDir)
    return err ? { error: err } : {}
  }
  return { error: 'Unknown path' }
})

ipcMain.handle('show-item-in-folder', async (event, filePath) => {
  if (!downloadedPaths.has(filePath)) return { error: 'Unknown file' }
  if (!existsSync(filePath)) return { error: 'File was moved or deleted' }
  shell.showItemInFolder(filePath)
  return {}
})

ipcMain.handle('open-file', async (event, filePath) => {
  if (!downloadedPaths.has(filePath)) return { error: 'Unknown file' }
  const err = await shell.openPath(filePath)
  return err ? { error: err } : {}
})

ipcMain.handle('cancel-download', async (event, id) => {
  downloadItems.get(id)?.cancel()
  return {}
})

ipcMain.handle('pause-download', async (event, id) => {
  const item = downloadItems.get(id)
  if (item?.isPaused()) item.resume()
  else item?.pause()
  return { paused: !!item?.isPaused() }
})

ipcMain.handle('get-download-prefs', async () => downloadPrefs())

ipcMain.handle('set-download-prefs', async (event, changes) => {
  const next = { ...readJson('prefs.json', {}) }
  if (typeof changes?.askWhereToSave === 'boolean') next.askWhereToSave = changes.askWhereToSave
  writeJson('prefs.json', next)
  return downloadPrefs()
})

ipcMain.handle('choose-download-folder', async (event) => {
  const result = await dialog.showOpenDialog(senderWindow(event), {
    title: 'Choose download folder',
    defaultPath: downloadPrefs().downloadDir,
    properties: ['openDirectory', 'createDirectory'],
  })
  if (!result.canceled && result.filePaths[0]) {
    writeJson('prefs.json', { ...readJson('prefs.json', {}), downloadDir: result.filePaths[0] })
  }
  return downloadPrefs()
})

// Download a URL directly (e.g. "Save link as…")
ipcMain.handle('download-url', async (event, url) => {
  senderWindow(event)?.webContents.downloadURL(url)
  return {}
})

// "Save page as…" for the page shown in a webview
ipcMain.handle('save-page', async (event, { webContentsId, title }) => {
  const page = webContents.fromId(webContentsId)
  if (!page) return { error: 'Page not found' }
  const safeTitle = (title || 'page').replace(/[\\/:*?"<>|]/g, '_').slice(0, 100)
  const result = await dialog.showSaveDialog(senderWindow(event), {
    title: 'Save page as',
    defaultPath: join(app.getPath('downloads'), `${safeTitle}.html`),
    filters: [{ name: 'Web page, complete', extensions: ['html'] }],
  })
  if (result.canceled || !result.filePath) return { canceled: true }
  try {
    await page.savePage(result.filePath, 'HTMLComplete')
    return {}
  } catch (e) {
    return { error: e.message }
  }
})

// Clear cookies, cache and site storage for normal (non-incognito) browsing
ipcMain.handle('clear-browsing-data', async () => {
  await session.defaultSession.clearStorageData()
  await session.defaultSession.clearCache()
  return {}
})

// Extensions management
ipcMain.handle('load-extension', async (event) => {
  const result = await dialog.showOpenDialog(senderWindow(event), {
    title: 'Select extension folder',
    properties: ['openDirectory'],
  })
  if (result.canceled || !result.filePaths[0]) return { canceled: true }
  const path = result.filePaths[0]
  try {
    const ext = await session.defaultSession.loadExtension(path, { allowFileAccess: true })
    writeJson('extensions.json', [...new Set([...savedExtensionPaths(), path])])
    return { id: ext.id, name: ext.name }
  } catch (e) {
    return { error: e.message }
  }
})

ipcMain.handle('get-extensions', async () => {
  return Object.values(session.defaultSession.getAllExtensions()).map(describeExtension)
})

ipcMain.handle('remove-extension', async (event, id) => {
  try {
    const ext = session.defaultSession.getExtension(id)
    await session.defaultSession.removeExtension(id)
    if (ext) writeJson('extensions.json', savedExtensionPaths().filter(p => p !== ext.path))
    return {}
  } catch (e) {
    return { error: e.message }
  }
})

// Reload an unpacked extension after editing its files
ipcMain.handle('reload-extension', async (event, id) => {
  const ext = session.defaultSession.getExtension(id)
  if (!ext) return { error: 'Extension not found' }
  try {
    await session.defaultSession.removeExtension(id)
    const reloaded = await session.defaultSession.loadExtension(ext.path, { allowFileAccess: true })
    return { id: reloaded.id }
  } catch (e) {
    return { error: e.message }
  }
})

ipcMain.handle('reveal-extension', async (event, id) => {
  const ext = session.defaultSession.getExtension(id)
  if (ext) shell.openPath(ext.path)
  return {}
})
