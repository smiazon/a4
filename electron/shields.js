// Shields: privacy features applied to every web page (never the browser UI).
//   - Ad & tracker blocking (Ghostery's engine with EasyList/EasyPrivacy lists),
//     including hiding leftover ad boxes, with per-site exceptions
//   - Pop-up blocking: pages may only open new tabs right after a click or key
//   - HTTPS upgrade with automatic fallback for sites that don't support it
//   - Global Privacy Control / Do Not Track headers
//   - Secure DNS (DNS over HTTPS)
//   - VPN / proxy: route traffic through the user's own SOCKS5/HTTP(S) proxy,
//     in private windows only or everywhere. No direct fallback, so if the proxy
//     is down pages fail to load instead of leaking around it.
const { app, session, ipcMain, safeStorage, webContents } = require('electron')
const { join } = require('path')
const fs = require('fs')
const { ElectronBlocker } = require('@ghostery/adblocker-electron')
const { applySignInHeaders } = require('./signin')

const COSMETIC_PRELOAD = require.resolve('@ghostery/adblocker-electron-preload')
const INCOGNITO_PARTITION = 'incognito'

const DNS_PROVIDERS = {
  cloudflare: 'https://cloudflare-dns.com/dns-query',
  quad9: 'https://dns.quad9.net/dns-query',
  google: 'https://dns.google/dns-query',
}

const DEFAULTS = {
  adblock: true,
  popups: true,
  httpsUpgrade: true,
  gpc: true,
  secureDns: 'cloudflare', // 'off' | keyof DNS_PROVIDERS
  allowlist: [], // hosts with shields down
  proxy: { mode: 'off', type: 'socks5', host: '', port: '' }, // mode: 'off' | 'private' | 'always'
}

const prefsPath = () => join(app.getPath('userData'), 'shields.json')
let prefs = { ...DEFAULTS }
let proxyAuth = null // { username, password } decrypted in memory only
let blocker = null

function loadPrefs() {
  try {
    const saved = JSON.parse(fs.readFileSync(prefsPath(), 'utf8'))
    prefs = { ...DEFAULTS, ...saved, proxy: { ...DEFAULTS.proxy, ...saved.proxy } }
    if (saved.proxyAuth) {
      const [username, ...rest] = safeStorage.decryptString(Buffer.from(saved.proxyAuth, 'base64')).split('\n')
      proxyAuth = { username, password: rest.join('\n') }
    }
  } catch (_) {
    prefs = { ...DEFAULTS }
  }
}

function savePrefs() {
  const out = { ...prefs }
  if (proxyAuth) out.proxyAuth = safeStorage.encryptString(`${proxyAuth.username}\n${proxyAuth.password}`).toString('base64')
  fs.writeFileSync(prefsPath(), JSON.stringify(out, null, 2), { mode: 0o600 })
}

// What the UI may see (never the proxy password)
const publicPrefs = () => ({
  ...prefs,
  proxyAuth: proxyAuth ? { username: proxyAuth.username } : null,
  blockerReady: !!blocker,
})

// ---- Helpers ---------------------------------------------------------------------

const hostOf = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch (_) {
    return ''
  }
}

const isLocalHost = (host) =>
  host === 'localhost' || host.endsWith('.local') || host.endsWith('.localhost') ||
  /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?$)/.test(host)

// Only web pages shown in tabs (webview guests) are filtered; the browser UI isn't
function guestOf(details) {
  if (!details.webContentsId) return null
  const wc = webContents.fromId(details.webContentsId)
  return wc && wc.getType() === 'webview' ? wc : null
}

const siteAllowed = (url) => {
  const host = hostOf(url)
  return prefs.allowlist.some(h => host === h || host.endsWith('.' + h))
}

// Shields apply unless the page in this tab has them switched off
function shouldFilter(details) {
  const guest = guestOf(details)
  if (!guest && details.webContentsId) return false // the browser UI itself
  const topUrl = details.resourceType === 'mainFrame' ? details.url : guest?.getURL()
  return !(topUrl && siteAllowed(topUrl))
}

// ---- Per-tab counters, sent to the window hosting the tab ------------------------

const stats = new Map() // webContentsId -> { blocked, popups, lastPopup, upgraded }
const pending = new Map()

function bump(webContentsId, change) {
  if (!webContentsId) return
  const current = stats.get(webContentsId) || { blocked: 0, popups: 0, lastPopup: null, upgraded: false }
  stats.set(webContentsId, { ...current, ...change(current) })
  if (pending.has(webContentsId)) return
  pending.set(webContentsId, setTimeout(() => {
    pending.delete(webContentsId)
    const guest = webContents.fromId(webContentsId)
    const host = guest?.hostWebContents
    if (host && !host.isDestroyed()) host.send('shields:stats', { webContentsId, ...stats.get(webContentsId) })
  }, 250))
}

// ---- HTTPS upgrade bookkeeping ------------------------------------------------------

const httpAllowed = new Set() // hosts that only work over http
const upgrades = new Map() // host -> recent upgrade times (detects https→http redirect loops)

function shouldUpgrade(url) {
  if (!prefs.httpsUpgrade || !url.startsWith('http://')) return false
  const host = new URL(url).hostname
  if (isLocalHost(host) || httpAllowed.has(host)) return false
  const now = Date.now()
  const recent = (upgrades.get(host) || []).filter(t => now - t < 5000)
  if (recent.length >= 3) {
    httpAllowed.add(host) // the site keeps sending us back to http
    return false
  }
  upgrades.set(host, [...recent, now])
  return true
}

// ---- Session wiring -------------------------------------------------------------------

// Electron allows one listener per webRequest event, so this is the single pipeline
function installPipeline(ses) {
  ses.setPreloads([...ses.getPreloads().filter(p => p !== COSMETIC_PRELOAD), COSMETIC_PRELOAD])

  ses.webRequest.onBeforeRequest({ urls: ['<all_urls>'] }, (details, callback) => {
    if (details.resourceType === 'mainFrame' && guestOf(details) && shouldUpgrade(details.url)) {
      bump(details.webContentsId, () => ({ upgraded: true }))
      callback({ redirectURL: 'https://' + details.url.slice('http://'.length) })
      return
    }
    if (prefs.adblock && blocker && shouldFilter(details)) {
      blocker.onBeforeRequest(details, callback)
      return
    }
    callback({})
  })

  ses.webRequest.onHeadersReceived({ urls: ['<all_urls>'] }, (details, callback) => {
    if (prefs.adblock && blocker && shouldFilter(details)) {
      blocker.onHeadersReceived(details, callback)
      return
    }
    callback({})
  })

  ses.webRequest.onBeforeSendHeaders({ urls: ['<all_urls>'] }, (details, callback) => {
    const requestHeaders = details.requestHeaders
    if (prefs.gpc && guestOf(details)) {
      requestHeaders['Sec-GPC'] = '1'
      requestHeaders.DNT = '1'
    }
    const guest = guestOf(details)
    if (guest) applySignInHeaders(details, guest, requestHeaders)
    callback({ requestHeaders })
  })
}

async function loadBlocker() {
  const cache = join(app.getPath('userData'), 'adblock-engine.bin')
  try {
    blocker = await ElectronBlocker.fromPrebuiltAdsAndTracking(fetch, {
      path: cache,
      read: fs.promises.readFile,
      write: fs.promises.writeFile,
    })
    const count = (request) => bump(request.tabId, s => ({ blocked: s.blocked + 1 }))
    blocker.on('request-blocked', count)
    blocker.on('request-redirected', count)
  } catch (e) {
    console.error('Ad blocker could not load its filter lists:', e.message)
  }
}

function applyDns() {
  const server = DNS_PROVIDERS[prefs.secureDns]
  app.configureHostResolver(server
    ? { secureDnsMode: 'secure', secureDnsServers: [server] }
    : { secureDnsMode: 'automatic' })
}

async function applyProxy() {
  const { mode, type, host, port } = prefs.proxy
  const rules = host && port ? `${type}://${host}:${port}` : ''
  const proxied = { proxyRules: rules, proxyBypassRules: '<local>;localhost;127.0.0.1;::1' }
  const system = { mode: 'system' }
  const normal = mode === 'always' && rules ? proxied : system
  const priv = (mode === 'always' || mode === 'private') && rules ? proxied : system
  await session.defaultSession.setProxy(normal)
  await session.fromPartition(INCOGNITO_PARTITION).setProxy(priv)
  // Drop open connections so the change applies right away
  await session.defaultSession.closeAllConnections?.()
  await session.fromPartition(INCOGNITO_PARTITION).closeAllConnections?.()
}

// ---- Per-webview hooks (called from main.js for every <webview>) ------------------------

function attachToWebview(contents) {
  let lastInput = 0
  contents.on('input-event', (event, input) => {
    if (['mouseDown', 'mouseUp', 'keyDown', 'rawKeyDown', 'char', 'touchStart', 'gestureTap'].includes(input.type)) {
      lastInput = Date.now()
    }
  })

  // New page in this tab: counters start over
  contents.on('did-start-navigation', (details) => {
    if (details.isMainFrame && !details.isSameDocument) {
      stats.set(contents.id, { blocked: 0, popups: 0, lastPopup: null, upgraded: false })
    }
  })

  // An upgraded page that can't load over https falls back to http once
  contents.on('did-fail-load', (event, code, description, url, isMainFrame) => {
    if (!isMainFrame || code === -3 || !url.startsWith('https://')) return
    const host = new URL(url).hostname
    if (!upgrades.has(host) || httpAllowed.has(host)) return
    httpAllowed.add(host)
    bump(contents.id, () => ({ upgraded: false }))
    contents.loadURL('http://' + url.slice('https://'.length)).catch(() => {})
  })

  return {
    // Called by the window-open handler: allow only right after a user gesture
    allowPopup(url) {
      if (!prefs.popups || siteAllowed(contents.getURL())) return true
      if (Date.now() - lastInput < 1500) return true
      bump(contents.id, s => ({ popups: s.popups + 1, lastPopup: url }))
      return false
    },
  }
}

// ---- Setup & IPC ----------------------------------------------------------------------------

async function setupShields() {
  loadPrefs()
  installPipeline(session.defaultSession)
  installPipeline(session.fromPartition(INCOGNITO_PARTITION))
  applyDns()
  await applyProxy()

  // Cosmetic filtering: the preload asks for CSS/scriptlets for each page
  ipcMain.handle('@ghostery/adblocker/inject-cosmetic-filters', (event, url, msg) => {
    if (!prefs.adblock || !blocker || event.sender.getType() !== 'webview' || siteAllowed(url)) return
    return blocker.onInjectCosmeticFilters(event, url, msg)
  })
  ipcMain.handle('@ghostery/adblocker/is-mutation-observer-enabled', (event) =>
    !!blocker && event.sender.getType() === 'webview' && blocker.config.enableMutationObserver)

  // Proxy sign-in, when the proxy needs a username and password
  app.on('login', (event, wc, details, authInfo, callback) => {
    if (authInfo.isProxy && proxyAuth) {
      event.preventDefault()
      callback(proxyAuth.username, proxyAuth.password)
    }
  })

  ipcMain.handle('shields:get', () => publicPrefs())

  ipcMain.handle('shields:set', async (event, changes = {}) => {
    const next = { ...prefs }
    for (const key of ['adblock', 'popups', 'httpsUpgrade', 'gpc']) {
      if (typeof changes[key] === 'boolean') next[key] = changes[key]
    }
    if (changes.secureDns && (changes.secureDns === 'off' || DNS_PROVIDERS[changes.secureDns])) next.secureDns = changes.secureDns
    if (changes.proxy) {
      const p = { ...next.proxy, ...changes.proxy }
      if (!['off', 'private', 'always'].includes(p.mode)) p.mode = 'off'
      if (!['socks5', 'socks4', 'http', 'https'].includes(p.type)) p.type = 'socks5'
      p.host = String(p.host || '').trim().replace(/^[a-z0-9]+:\/\//i, '').replace(/\/.*$/, '')
      p.port = String(p.port || '').replace(/\D/g, '').slice(0, 5)
      next.proxy = p
    }
    prefs = next
    savePrefs()
    if ('secureDns' in changes) applyDns()
    if ('proxy' in changes) await applyProxy()
    return publicPrefs()
  })

  ipcMain.handle('shields:set-site', (event, { host, allowed }) => {
    const h = String(host || '').replace(/^www\./, '')
    if (!h) return publicPrefs()
    prefs.allowlist = allowed ? prefs.allowlist.filter(x => x !== h) : [...new Set([...prefs.allowlist, h])]
    savePrefs()
    return publicPrefs()
  })

  ipcMain.handle('shields:set-proxy-auth', (event, auth) => {
    if (auth?.username) {
      if (!safeStorage.isEncryptionAvailable()) return { error: 'Secure storage is not available.' }
      proxyAuth = { username: String(auth.username), password: String(auth.password || '') }
    } else {
      proxyAuth = null
    }
    savePrefs()
    return publicPrefs()
  })

  // Shows the address websites see, through the private-window session
  ipcMain.handle('shields:test', async (event, { scope }) => {
    const ses = scope === 'normal' ? session.defaultSession : session.fromPartition(INCOGNITO_PARTITION)
    try {
      const res = await ses.fetch('https://www.cloudflare.com/cdn-cgi/trace', { cache: 'no-store' })
      const text = await res.text()
      const field = (k) => (text.match(new RegExp(`^${k}=(.*)$`, 'm')) || [])[1]
      return { ip: field('ip'), location: field('loc') }
    } catch (e) {
      return { error: e.message }
    }
  })

  loadBlocker() // filter lists download in the background
}

module.exports = { setupShields, attachToWebview }
