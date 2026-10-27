import { useState, useRef, useEffect, useCallback } from 'react'
import AddressBar from './AddressBar'
import NavigationButtons from './NavigationButtons'
import MenuButton from './MenuButton'
import FindBar from './FindBar'
import Tabs from './Tabs'
import WebView from './WebView'
import SmiazonLogo from './SmiazonLogo'
import Favorites from './Favorites'
import ArtHome from './ArtHome'
import Downloads, { DOWNLOADS_PAGE_URL, DownloadsButton } from './Downloads'
import History, { HISTORY_PAGE_URL } from './History'
import Bookmarks, { BOOKMARKS_PAGE_URL } from './Bookmarks'
import ContextMenu from './ContextMenu'
import Settings from './Settings'
import Extensions from './Extensions'
import ReaderView, { extractArticle } from './ReaderView'
import Assistant from './Assistant'
import Shields from './Shields'
import BookmarksBar from './BookmarksBar'
import BookmarkBubble from './BookmarkBubble'
import MailAvatar from './MailAvatar'
import { addBookmark, findByUrl, isFolder, removeItem } from '../utils/bookmarks'
import { MAIL_STORAGE_KEY, providerFor, readInboxTitle } from '../utils/mail'
import { forgetTyped } from '../utils/typed'
import { isElectron, isMac, isIncognito, launchUrl, shortcut } from '../utils/env'
import { toNavigableUrl, isInternalUrl, isWebUrl, getHomepage, getSearchEngine, hostOf } from '../utils/url'
import './BrowserWindow.css'

const SETTINGS_PAGE_URL = 'a4://settings'
const EXTENSIONS_PAGE_URL = 'a4://extensions'

const SPECIAL_PAGE_TITLES = {
  [DOWNLOADS_PAGE_URL]: 'Downloads',
  [HISTORY_PAGE_URL]: 'History',
  [BOOKMARKS_PAGE_URL]: 'Bookmarks',
  [SETTINGS_PAGE_URL]: 'Settings',
  [EXTENSIONS_PAGE_URL]: 'Extensions',
}

const BOOKMARKS_STORAGE_KEY = 'smiazon-bookmarks'
const HISTORY_STORAGE_KEY = 'smiazon-history'
const THEME_STORAGE_KEY = 'smiazon-theme'
const HOME_STYLE_STORAGE_KEY = 'a4-home-style'
const BOOKMARKS_BAR_STORAGE_KEY = 'a4-bookmarks-bar'
const HISTORY_LIMIT = 1000
const CLOSED_TABS_LIMIT = 25

function readList(key) {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key))
    return Array.isArray(parsed) ? parsed : []
  } catch (_) {
    return []
  }
}

// A list saved in localStorage and kept in sync between windows
function useStoredList(key, persist = true) {
  const [list, setList] = useState(() => (persist ? readList(key) : []))
  useEffect(() => {
    if (!persist) return
    try {
      window.localStorage.setItem(key, JSON.stringify(list))
    } catch (_) {}
  }, [key, list, persist])
  useEffect(() => {
    if (!persist) return
    // Another window changed the list (key === null means storage was cleared)
    const onStorage = (e) => {
      if (e.key === key || e.key === null) setList(readList(key))
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [key, persist])
  return [list, setList]
}

// Seeded from the clock so ids stay unique even if this module is hot-reloaded in dev
let nextTabId = Date.now()
function makeTab(url = null) {
  return {
    id: nextTabId++,
    url,
    title: !url ? 'New Tab' : (SPECIAL_PAGE_TITLES[url] || 'Loading…'),
    favicon: null,
    loading: !!url && !isInternalUrl(url),
    canGoBack: false,
    canGoForward: false,
    zoom: 1,
    reader: null, // extracted article while reading mode is on
    homeBack: false, // Back from this page returns to the new tab page
    homeForward: null, // on the new tab page: the page Forward goes back to
    artIndex: null, // painting shown on this tab's art home page
  }
}

// First tab of a window: a URL passed by the main process, else the homepage
function startupUrl() {
  if (launchUrl) return toNavigableUrl(launchUrl)
  if (isIncognito) return null
  return toNavigableUrl(getHomepage())
}

function BrowserWindow() {
  const [initialTab] = useState(() => makeTab(startupUrl()))
  const [tabs, setTabs] = useState([initialTab])
  const [activeTabId, setActiveTabId] = useState(initialTab.id)
  const [closedTabs, setClosedTabs] = useState([]) // { url, index } for "Reopen closed tab"
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [find, setFind] = useState({ open: false, query: '' })
  const [findResult, setFindResult] = useState(null) // { tabId, activeMatchOrdinal, matches }
  const [history, setHistory] = useStoredList(HISTORY_STORAGE_KEY, !isIncognito)
  const [bookmarks, setBookmarks] = useStoredList(BOOKMARKS_STORAGE_KEY)
  const [mailAccounts, setMailAccounts] = useStoredList(MAIL_STORAGE_KEY)
  const [mailUnread, setMailUnread] = useState({}) // account id -> unread count from its inbox title
  const [bookmarkBubble, setBookmarkBubble] = useState(null) // { id, isNew }
  const [showBookmarksBar, setShowBookmarksBar] = useState(() => {
    try {
      return window.localStorage.getItem(BOOKMARKS_BAR_STORAGE_KEY) !== 'hide'
    } catch (_) {
      return true
    }
  })
  const [downloads, setDownloads] = useState([])
  const [homeStyle, setHomeStyle] = useState(() => {
    try {
      return window.localStorage.getItem(HOME_STYLE_STORAGE_KEY) === 'classic' ? 'classic' : 'art'
    } catch (_) {
      return 'art'
    }
  })
  // Focus mode: tabs and toolbar step aside; they slide back at the top edge
  const [focusMode, setFocusMode] = useState(false)
  const [chromeRevealed, setChromeRevealed] = useState(false)
  const [focusHint, setFocusHint] = useState(false)
  const [assistantOpen, setAssistantOpen] = useState(false)
  const [assistantBusy, setAssistantBusy] = useState(false)
  const [settingsSection, setSettingsSection] = useState(null) // section to scroll to
  const [assistantConnect, setAssistantConnect] = useState(null) // { provider } to open its connect form
  const [shieldPrefs, setShieldPrefs] = useState(null)
  const [shieldStats, setShieldStats] = useState({}) // webContentsId -> { blocked, popups, lastPopup, upgraded }
  const [pageContextMenu, setPageContextMenu] = useState(null) // { tabId, x, y, params }
  const [theme, setTheme] = useState(() => {
    if (isIncognito) return 'dark'
    try {
      const saved = window.localStorage.getItem(THEME_STORAGE_KEY)
      if (saved === 'light' || saved === 'dark' || saved === 'system') return saved
    } catch (_) {}
    return 'light'
  })
  // 'system' follows the Mac's appearance
  const [systemDark, setSystemDark] = useState(() => window.matchMedia?.('(prefers-color-scheme: dark)').matches)
  const effectiveTheme = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme
  const webViewRefs = useRef(new Map())
  const addressBarRef = useRef(null)
  const findBarRef = useRef(null)
  const chromeRef = useRef(null)

  useEffect(() => {
    const media = window.matchMedia?.('(prefers-color-scheme: dark)')
    const onChange = (e) => setSystemDark(e.matches)
    media?.addEventListener('change', onChange)
    return () => media?.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', effectiveTheme)
  }, [effectiveTheme])

  useEffect(() => {
    if (!isIncognito) {
      try {
        window.localStorage.setItem(THEME_STORAGE_KEY, theme)
      } catch (_) {}
    }
  }, [theme])

  useEffect(() => {
    try {
      window.localStorage.setItem(HOME_STYLE_STORAGE_KEY, homeStyle)
    } catch (_) {}
  }, [homeStyle])

  const activeTab = tabs.find(tab => tab.id === activeTabId) || tabs[0]
  const activeView = () => webViewRefs.current.get(activeTab.id)
  const hasPage = !!activeTab.url && !isInternalUrl(activeTab.url)
  const canBookmark = isWebUrl(activeTab.url)
  const isBookmarked = canBookmark && !!findByUrl(bookmarks, activeTab.url)

  const updateTab = (tabId, patch) => {
    setTabs(prev => prev.map(t => (t.id === tabId ? { ...t, ...patch } : t)))
  }

  // ---- Page state reported by each tab's WebView --------------------------

  const handleTabState = useCallback((tabId, { navigated, ...patch }) => {
    setTabs(prev => prev.map(t => {
      if (t.id !== tabId) return t
      // Navigating away exits reading mode
      const reader = patch.url && patch.url !== t.url ? null : t.reader
      return { ...t, ...patch, reader }
    }))

    // A tab reached a webmail inbox: that account is signed in (and its title may hold the address)
    if (!isIncognito && isWebUrl(patch.url)) {
      setMailAccounts(prev => {
        let changed = false
        const next = prev.map(account => {
          if (!providerFor(account).match.test(patch.url)) return account
          const { email, unread } = readInboxTitle(patch.title)
          setMailUnread(u => (u[account.id] === unread ? u : { ...u, [account.id]: unread }))
          if (account.connected && (!email || account.email === email)) return account
          changed = true
          return { ...account, connected: true, email: email || account.email || null }
        })
        return changed ? next : prev
      })
    }

    if (isIncognito || !isWebUrl(patch.url)) return
    if (navigated) {
      setHistory(prev => {
        const last = prev[prev.length - 1]
        // A reload of the same page just refreshes the visit time
        if (last?.url === patch.url) {
          return [...prev.slice(0, -1), { ...last, visitedAt: Date.now() }]
        }
        return [...prev, { url: patch.url, title: patch.title || patch.url, visitedAt: Date.now() }].slice(-HISTORY_LIMIT)
      })
    } else if (patch.title) {
      // Titles arrive after the navigation: fill in the latest visit of this page
      setHistory(prev => {
        for (let i = prev.length - 1; i >= Math.max(0, prev.length - 20); i--) {
          if (prev[i].url !== patch.url) continue
          if (prev[i].title === patch.title) return prev
          const next = [...prev]
          next[i] = { ...prev[i], title: patch.title }
          return next
        }
        return prev
      })
    }
  }, [setHistory, setMailAccounts])

  const handleFoundInPage = useCallback((tabId, result) => {
    setFindResult(prev => ({ ...(prev?.tabId === tabId ? prev : {}), ...result, tabId }))
  }, [])

  const handlePageContextMenu = useCallback((tabId, params, x, y) => {
    setPageContextMenu({ tabId, params, x, y })
  }, [])

  // ---- Tabs ----------------------------------------------------------------

  const openTab = (url = null, { background = false, afterTabId = null } = {}) => {
    const tab = makeTab(url ? toNavigableUrl(url) : null)
    setTabs(prev => {
      const index = afterTabId == null ? -1 : prev.findIndex(t => t.id === afterTabId)
      if (index === -1) return [...prev, tab]
      return [...prev.slice(0, index + 1), tab, ...prev.slice(index + 1)]
    })
    if (!background) setActiveTabId(tab.id)
    return tab
  }

  const closeWindow = () => {
    if (window.electronAPI?.closeWindow) window.electronAPI.closeWindow()
    else window.close()
  }

  const closeTabs = (ids) => {
    const closing = new Set(ids)
    const remaining = tabs.filter(t => !closing.has(t.id))
    const closed = tabs
      .map((t, index) => ({ url: t.url, index, closing: closing.has(t.id) }))
      .filter(t => t.closing && t.url)
      .map(({ url, index }) => ({ url, index }))
    if (closed.length) setClosedTabs(prev => [...prev, ...closed].slice(-CLOSED_TABS_LIMIT))

    // Closing the last tab closes the window, like Chrome
    if (remaining.length === 0) {
      closeWindow()
      return
    }
    if (closing.has(activeTab.id)) {
      // Activate the tab to the right, or the one to the left if it was last
      const index = tabs.findIndex(t => t.id === activeTab.id)
      const next = tabs.slice(index + 1).find(t => !closing.has(t.id)) ||
        tabs.slice(0, index).reverse().find(t => !closing.has(t.id))
      setActiveTabId(next.id)
    }
    setTabs(remaining)
  }

  const reopenClosedTab = () => {
    const last = closedTabs[closedTabs.length - 1]
    if (!last) return
    setClosedTabs(prev => prev.slice(0, -1))
    const tab = makeTab(last.url)
    setTabs(prev => {
      const next = [...prev]
      next.splice(Math.min(last.index, next.length), 0, tab)
      return next
    })
    setActiveTabId(tab.id)
  }

  const selectTabByOffset = (offset) => {
    const index = tabs.findIndex(t => t.id === activeTab.id)
    setActiveTabId(tabs[(index + offset + tabs.length) % tabs.length].id)
  }

  // Leaving a tab closes its find box and any open page menu
  const previousTabIdRef = useRef(activeTabId)
  useEffect(() => {
    if (previousTabIdRef.current === activeTabId) return
    webViewRefs.current.get(previousTabIdRef.current)?.stopFindInPage()
    previousTabIdRef.current = activeTabId
    setFind(f => (f.open ? { ...f, open: false } : f))
    setFindResult(null)
    setPageContextMenu(null)
  }, [activeTabId])

  // ---- Navigation ----------------------------------------------------------

  const navigateTab = (tabId, input) => {
    const url = toNavigableUrl(input)
    if (!url) return
    const view = webViewRefs.current.get(tabId)
    const tab = tabs.find(t => t.id === tabId)
    if (view && !isInternalUrl(url)) {
      view.navigate(url)
      updateTab(tabId, { url, reader: null })
    } else {
      // Mounts a WebView for web URLs, or shows an internal page. Leaving the
      // new tab page keeps a way back to it (and to the painting it showed).
      const fromHome = !tab?.url && !isInternalUrl(url)
      updateTab(tabId, { ...makeTab(url), id: tabId, homeBack: fromHome, artIndex: tab?.artIndex ?? null })
    }
  }

  // Back past the first page of a tab that started on the new tab page
  const returnHome = (tab) => {
    updateTab(tab.id, { ...makeTab(null), id: tab.id, homeForward: tab.url, artIndex: tab.artIndex })
  }

  const goBack = () => {
    if (activeTab.canGoBack) activeView()?.goBack()
    else if (activeTab.homeBack) returnHome(activeTab)
  }

  const goForward = () => {
    if (!activeTab.url && activeTab.homeForward) navigateActive(activeTab.homeForward)
    else activeView()?.goForward()
  }

  const navigateActive = (input) => navigateTab(activeTab.id, input)

  // History, Settings, etc. reuse an existing tab or an empty new tab, like Chrome
  const openSpecialPage = (url) => {
    const existing = tabs.find(t => t.url === url)
    if (existing) setActiveTabId(existing.id)
    else if (!activeTab.url) navigateTab(activeTab.id, url)
    else openTab(url, { afterTabId: activeTab.id })
  }

  const goHome = () => {
    const home = toNavigableUrl(getHomepage())
    if (home) navigateActive(home)
    else updateTab(activeTab.id, { ...makeTab(null), id: activeTab.id })
  }

  const newWindow = (options) => window.electronAPI?.newWindow?.(options)

  // ---- Page actions ----------------------------------------------------------

  const openFind = () => {
    if (!hasPage) return
    setFind(f => ({ ...f, open: true }))
    findBarRef.current?.focus()
  }

  const setFindQuery = (query) => {
    setFind(f => ({ ...f, query }))
    if (query) {
      activeView()?.findInPage(query, { findNext: true })
    } else {
      activeView()?.stopFindInPage()
      setFindResult(null)
    }
  }

  const findStep = (forward) => {
    if (!find.open || !find.query) return openFind()
    activeView()?.findInPage(find.query, { forward, findNext: false })
  }

  const closeFind = () => {
    activeView()?.stopFindInPage()
    setFind(f => ({ ...f, open: false }))
    setFindResult(null)
  }

  // ★ / ⌘D: bookmark the page (onto the bar) and show the card to name and file it
  const toggleBookmark = () => {
    if (!canBookmark) return
    const existing = findByUrl(bookmarks, activeTab.url)
    if (existing) {
      setBookmarkBubble(b => (b?.id === existing.id ? null : { id: existing.id, isNew: false }))
      return
    }
    const next = addBookmark(bookmarks, { url: activeTab.url, title: activeTab.title || hostOf(activeTab.url) })
    setBookmarks(next)
    setBookmarkBubble({ id: next[next.length - 1].id, isNew: true })
  }

  const toggleBookmarksBar = () => {
    setShowBookmarksBar(show => {
      try {
        window.localStorage.setItem(BOOKMARKS_BAR_STORAGE_KEY, show ? 'hide' : 'show')
      } catch (_) {}
      return !show
    })
  }

  // ---- Mail: sign in on the provider's page, then the avatar opens the inbox ----

  const mailConnected = mailAccounts.filter(a => a.connected)
  const primaryMail = mailConnected[0]
  const primaryUnread = primaryMail && tabs.some(t => providerFor(primaryMail).match.test(t.url || ''))
    ? mailUnread[primaryMail.id] || 0
    : 0

  const openMail = (account) => {
    const provider = providerFor(account)
    const existing = tabs.find(t => provider.match.test(t.url || ''))
    if (existing) setActiveTabId(existing.id)
    else if (!activeTab.url) navigateActive(provider.inbox)
    else openTab(provider.inbox, { afterTabId: activeTab.id })
  }

  const signInMail = ({ provider, inbox }) => {
    const id = `m-${Date.now()}`
    const account = { id, provider, inbox: inbox || null, connected: false, email: null }
    // Replace an unfinished sign-in for the same provider
    setMailAccounts(prev => [...prev.filter(a => a.connected || a.provider !== provider), account])
    const url = providerFor(account).signIn
    if (!activeTab.url) navigateActive(url)
    else openTab(url, { afterTabId: activeTab.id })
  }

  const removeMail = (account) => setMailAccounts(prev => prev.filter(a => a.id !== account.id))

  const mailAvatar = (variant) => !isIncognito && isElectron && (
    <MailAvatar
      variant={variant}
      accounts={mailAccounts}
      unread={primaryUnread}
      onOpenMail={openMail}
      onSignIn={signInMail}
      onRemove={removeMail}
    />
  )

  const toggleReadingMode = async () => {
    const tab = activeTab
    if (tab.reader) {
      updateTab(tab.id, { reader: null })
      return
    }
    const view = activeView()
    if (!view || !hasPage) return
    try {
      const article = await view.executeJavaScript(`(${extractArticle.toString()})()`)
      updateTab(tab.id, { reader: article })
    } catch (_) {
      updateTab(tab.id, { reader: { title: tab.title, site: '', blocks: [] } })
    }
  }

  const savePage = () => {
    const id = activeView()?.getWebContentsId()
    if (id != null) window.electronAPI?.savePage(id, activeTab.title)
  }

  const translatePage = () => {
    if (!isWebUrl(activeTab.url)) return
    const lang = (navigator.language || 'en').split('-')[0]
    navigateActive(`https://translate.google.com/translate?sl=auto&tl=${lang}&u=${encodeURIComponent(activeTab.url)}`)
  }

  const toggleFocus = () => setFocusMode(on => !on)

  // Entering or leaving focus mode always starts with the chrome tucked away
  useEffect(() => {
    setChromeRevealed(false)
  }, [focusMode])

  // Show a short hint when entering focus mode
  useEffect(() => {
    if (!focusMode) return
    setFocusHint(true)
    const id = setTimeout(() => setFocusHint(false), 2800)
    return () => clearTimeout(id)
  }, [focusMode])

  // Hide the macOS traffic lights while the chrome is tucked away
  useEffect(() => {
    window.electronAPI?.setWindowButtonsVisible?.(!focusMode || chromeRevealed)
  }, [focusMode, chromeRevealed])

  // Esc leaves focus mode (when the browser UI, not a page, has the keyboard)
  useEffect(() => {
    if (!focusMode) return
    const onKey = (e) => {
      if (e.key === 'Escape' && !(e.target instanceof HTMLInputElement && e.target.value)) setFocusMode(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [focusMode])

  const hideChromeSoon = () => {
    // Keep it out while you're typing in it or using a menu
    if (chromeRef.current?.contains(document.activeElement) && document.activeElement !== document.body) return
    setChromeRevealed(false)
  }

  // ---- Commands: toolbar, menus and keyboard shortcuts all land here --------

  const commands = {
    'new-tab': () => openTab(),
    'reopen-closed-tab': reopenClosedTab,
    'close-tab': () => closeTabs([activeTab.id]),
    'focus-address-bar': () => {
      if (focusMode) setChromeRevealed(true)
      addressBarRef.current?.focus()
    },
    'toggle-focus': toggleFocus,
    'toggle-assistant': () => setAssistantOpen(o => !o),
    'save-page': savePage,
    'print': () => activeView()?.print(),
    'find': openFind,
    'find-next': () => findStep(true),
    'find-previous': () => findStep(false),
    'reload': () => activeView()?.reload(),
    'force-reload': () => activeView()?.reloadIgnoringCache(),
    'stop': () => activeView()?.stop(),
    'zoom-in': () => activeView()?.zoomIn(),
    'zoom-out': () => activeView()?.zoomOut(),
    'zoom-reset': () => activeView()?.resetZoom(),
    'reading-mode': toggleReadingMode,
    'devtools': () => activeView()?.openDevTools(),
    'back': goBack,
    'forward': goForward,
    'home': goHome,
    'toggle-bookmark': toggleBookmark,
    'toggle-bookmarks-bar': toggleBookmarksBar,
    'open-history': () => openSpecialPage(HISTORY_PAGE_URL),
    'open-bookmarks': () => openSpecialPage(BOOKMARKS_PAGE_URL),
    'open-downloads': () => openSpecialPage(DOWNLOADS_PAGE_URL),
    'open-settings': () => openSpecialPage(SETTINGS_PAGE_URL),
    'open-extensions': () => openSpecialPage(EXTENSIONS_PAGE_URL),
    'next-tab': () => selectTabByOffset(1),
    'previous-tab': () => selectTabByOffset(-1),
    // ⌘1–⌘8 pick that tab, ⌘9 the last one
    'select-tab': (n) => {
      const tab = n === 9 ? tabs[tabs.length - 1] : tabs[n - 1]
      if (tab) setActiveTabId(tab.id)
    },
    'open-in-new-tab': ({ url, background }) => openTab(url, { background, afterTabId: activeTab.id }),
    'help': () => openSpecialPage(SETTINGS_PAGE_URL),
  }
  const runCommandRef = useRef(null)
  runCommandRef.current = (name, arg) => commands[name]?.(arg)

  // Electron: the app menu (electron/main.js) owns keyboard shortcuts and sends
  // them here, along with links pages want opened in a new tab.
  useEffect(() => {
    const api = window.electronAPI
    if (!api?.onCommand) return
    const unsubscribers = [
      api.onCommand((name, arg) => runCommandRef.current(name, arg)),
      api.onOpenInNewTab((info) => runCommandRef.current('open-in-new-tab', info)),
    ]
    return () => unsubscribers.forEach(off => off())
  }, [])

  // Plain browser (no app menu): handle the main shortcuts from the keyboard
  useEffect(() => {
    if (isElectron) return
    const handleKeyDown = (e) => {
      const mod = isMac ? e.metaKey : e.ctrlKey
      const key = e.key.toLowerCase()
      let command = null
      let arg
      if (mod && e.shiftKey && key === 't') command = 'reopen-closed-tab'
      else if (mod && key === 't') command = 'new-tab'
      else if (mod && key === 'w') command = 'close-tab'
      else if (mod && key === 'l') command = 'focus-address-bar'
      else if (e.key === 'F5' || (mod && key === 'r')) command = 'reload'
      else if (mod && key === 'f') command = 'find'
      else if (mod && key === 'd') command = 'toggle-bookmark'
      else if (e.ctrlKey && e.key === 'Tab') command = e.shiftKey ? 'previous-tab' : 'next-tab'
      else if (mod && e.key >= '1' && e.key <= '9') {
        command = 'select-tab'
        arg = Number(e.key)
      }
      if (!command) return
      e.preventDefault()
      runCommandRef.current(command, arg)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Downloads are tracked here (not on the Downloads page) so none are missed
  useEffect(() => {
    const api = window.electronAPI
    if (!api?.onDownloadStarted) return
    const upsert = (info) => setDownloads(prev => {
      const index = prev.findIndex(d => d.id === info.id)
      if (index === -1) return [info, ...prev]
      const next = [...prev]
      // Smoothed transfer speed, for "1.2 MB/s · 8s left"
      const before = prev[index]
      const now = Date.now()
      const seconds = (now - (before.sampledAt || now)) / 1000
      const instant = seconds > 0 ? Math.max(0, (info.receivedBytes - before.receivedBytes) / seconds) : before.speed || 0
      const speed = seconds > 0 ? (before.speed ? before.speed * 0.7 + instant * 0.3 : instant) : before.speed || 0
      next[index] = { ...before, ...info, startTime: before.startTime, speed, sampledAt: now }
      return next
    })
    const unsubscribers = [api.onDownloadStarted(upsert), api.onDownloadUpdated(upsert), api.onDownloadDone(upsert)]
    return () => unsubscribers.forEach(off => off())
  }, [])

  // Shields: settings (shared with Settings) and per-page counters from the main process
  useEffect(() => {
    const api = window.electronAPI?.shields
    if (!api) return
    const load = () => api.get().then(setShieldPrefs).catch(() => {})
    load()
    window.addEventListener('shields-changed', load)
    const off = api.onStats((stat) => setShieldStats(prev => ({ ...prev, [stat.webContentsId]: stat })))
    return () => {
      window.removeEventListener('shields-changed', load)
      off()
    }
  }, [])

  const toggleSiteShields = async (host, on) => {
    setShieldPrefs(await window.electronAPI.shields.setSite(host, on))
    window.dispatchEvent(new Event('shields-changed'))
    activeView()?.reload()
  }

  const vpnActive = !!shieldPrefs?.proxy?.host && !!shieldPrefs?.proxy?.port &&
    (shieldPrefs.proxy.mode === 'always' || (shieldPrefs.proxy.mode === 'private' && isIncognito))

  // Hide the macOS traffic-light padding when the window is fullscreen
  useEffect(() => {
    let windowFullscreen = false
    const update = () => setIsFullscreen(windowFullscreen || !!document.fullscreenElement)
    document.addEventListener('fullscreenchange', update)
    const off = window.electronAPI?.onFullscreenChange?.((value) => {
      windowFullscreen = value
      update()
    })
    return () => {
      document.removeEventListener('fullscreenchange', update)
      off?.()
    }
  }, [])

  // ---- Page context menu -----------------------------------------------------

  const buildPageContextMenu = () => {
    const { params, tabId } = pageContextMenu
    const view = webViewRefs.current.get(tabId)
    const tab = tabs.find(t => t.id === tabId)
    const items = []
    const separator = () => {
      if (items.length && items[items.length - 1].type !== 'separator') items.push({ type: 'separator' })
    }

    if (params.linkURL) {
      items.push({ label: 'Open link in new tab', action: () => openTab(params.linkURL, { afterTabId: tabId }) })
      items.push({ label: 'Open link in new window', action: () => newWindow({ url: params.linkURL, incognito: isIncognito }) })
      items.push({ label: 'Open link in incognito window', action: () => newWindow({ url: params.linkURL, incognito: true }) })
      separator()
      items.push({ label: 'Save link as…', action: () => window.electronAPI?.downloadURL(params.linkURL) })
      items.push({ label: 'Copy link address', action: () => navigator.clipboard.writeText(params.linkURL) })
    }

    if (params.mediaType === 'image' && params.srcURL) {
      separator()
      items.push({ label: 'Open image in new tab', action: () => openTab(params.srcURL, { afterTabId: tabId }) })
      items.push({ label: 'Save image as…', action: () => window.electronAPI?.downloadURL(params.srcURL) })
      items.push({ label: 'Copy image address', action: () => navigator.clipboard.writeText(params.srcURL) })
    }

    if (params.isEditable) {
      separator()
      const flags = params.editFlags || {}
      items.push({ label: 'Cut', shortcut: shortcut('⌘X', 'Ctrl+X'), action: () => view?.cut(), disabled: flags.canCut === false })
      items.push({ label: 'Copy', shortcut: shortcut('⌘C', 'Ctrl+C'), action: () => view?.copy(), disabled: flags.canCopy === false })
      items.push({ label: 'Paste', shortcut: shortcut('⌘V', 'Ctrl+V'), action: () => view?.paste(), disabled: flags.canPaste === false })
      items.push({ label: 'Select all', shortcut: shortcut('⌘A', 'Ctrl+A'), action: () => view?.selectAll() })
    } else if (params.selectionText?.trim()) {
      separator()
      const text = params.selectionText.trim()
      const short = text.length > 32 ? text.slice(0, 32) + '…' : text
      const engine = getSearchEngine()
      items.push({ label: 'Copy', shortcut: shortcut('⌘C', 'Ctrl+C'), action: () => view?.copy() })
      items.push({ label: `Search ${engine.label} for “${short}”`, action: () => openTab(engine.url + encodeURIComponent(text), { afterTabId: tabId }) })
    }

    // Right-click on the page itself (not a link, image, text or field)
    if (!items.length) {
      items.push({ label: 'Back', shortcut: shortcut('⌘[', 'Alt+←'), action: goBack, disabled: !tab?.canGoBack && !tab?.homeBack })
      items.push({ label: 'Forward', shortcut: shortcut('⌘]', 'Alt+→'), action: () => view?.goForward(), disabled: !tab?.canGoForward })
      items.push({ label: 'Reload', shortcut: shortcut('⌘R', 'Ctrl+R'), action: () => view?.reload() })
      separator()
      items.push({ label: 'Save as…', shortcut: shortcut('⌘S', 'Ctrl+S'), action: savePage })
      items.push({ label: 'Print…', shortcut: shortcut('⌘P', 'Ctrl+P'), action: () => view?.print() })
      items.push({ label: 'Translate page', action: translatePage, disabled: !isWebUrl(tab?.url) })
      separator()
      items.push({ label: 'View page source', action: () => openTab(`view-source:${tab?.url}`, { afterTabId: tabId }), disabled: !tab?.url })
    }

    separator()
    items.push({ label: 'Inspect', action: () => view?.inspectElement(params.x || 0, params.y || 0) })
    return items
  }

  // ---- Assistant: the page the user is looking at, shared only when they ask ----

  const pageInfo = hasPage && isWebUrl(activeTab.url)
    ? { host: hostOf(activeTab.url), favicon: activeTab.favicon, url: activeTab.url, title: activeTab.title }
    : null

  const getPage = async () => {
    if (!pageInfo) return null
    try {
      const text = await activeView()?.executeJavaScript("(document.body ? document.body.innerText : '').slice(0, 24000)")
      return { url: activeTab.url, title: activeTab.title, text: (text || '').trim() }
    } catch (_) {
      return null
    }
  }

  // ---- Render ----------------------------------------------------------------

  const specialPage = (() => {
    switch (activeTab.url) {
      case null:
        return homeStyle === 'art'
          ? (
            <ArtHome
              key={activeTab.id}
              onNavigate={navigateActive}
              focusMode={focusMode}
              onToggleFocus={toggleFocus}
              initialArt={activeTab.artIndex}
              onArtChange={(index) => updateTab(activeTab.id, { artIndex: index })}
              account={mailAvatar('home')}
            />
          )
          : <Favorites onNavigate={navigateActive} focusMode={focusMode} onToggleFocus={toggleFocus} account={mailAvatar('home')} />
      case DOWNLOADS_PAGE_URL:
        return (
          <Downloads
            items={downloads}
            onClearAll={() => setDownloads(prev => prev.filter(d => d.state === 'progressing'))}
            onRemove={(id) => setDownloads(prev => prev.filter(d => d.id !== id))}
            onOpenSettings={() => {
              setSettingsSection({ id: 'downloads', at: Date.now() })
              openSpecialPage(SETTINGS_PAGE_URL)
            }}
          />
        )
      case HISTORY_PAGE_URL:
        return (
          <History
            entries={history}
            onNavigate={navigateActive}
            onOpenInNewTab={(url) => openTab(url, { afterTabId: activeTab.id, background: true })}
            onDeleteEntry={(entry) => setHistory(prev => prev.filter(e => !(e.url === entry.url && e.visitedAt === entry.visitedAt)))}
            onClearSince={(since) => {
              setHistory(prev => (since ? prev.filter(e => e.visitedAt < since) : []))
              forgetTyped(since)
            }}
          />
        )
      case BOOKMARKS_PAGE_URL:
        return (
          <Bookmarks
            entries={bookmarks}
            onChange={setBookmarks}
            onNavigate={navigateActive}
            onDeleteEntry={(entry) => setBookmarks(prev => removeItem(prev, entry.id))}
            onClearBookmarks={() => setBookmarks([])}
          />
        )
      case SETTINGS_PAGE_URL:
        return (
          <Settings
            theme={theme}
            onSetTheme={setTheme}
            homeStyle={homeStyle}
            onSetHomeStyle={setHomeStyle}
            onNavigate={navigateActive}
            section={settingsSection}
            onClearHistory={() => {
              setHistory([])
              forgetTyped()
            }}
            onConnectAssistant={(provider) => {
              setAssistantConnect({ provider, at: Date.now() })
              setAssistantOpen(true)
            }}
          />
        )
      case EXTENSIONS_PAGE_URL:
        return <Extensions />
      default:
        return null
    }
  })()

  return (
    <div className={[
      'browser-window',
      isFullscreen && 'fullscreen',
      isIncognito && 'incognito',
      focusMode && 'focus-mode',
      chromeRevealed && 'chrome-revealed',
    ].filter(Boolean).join(' ')}>
      {focusMode && <div className="chrome-hover-zone" onMouseEnter={() => setChromeRevealed(true)} />}
      <div
        className="browser-chrome"
        ref={chromeRef}
        onMouseLeave={() => focusMode && hideChromeSoon()}
        onBlur={(e) => {
          // Done typing in the revealed toolbar (e.g. after Enter): tuck it away again
          if (focusMode && !chromeRef.current?.contains(e.relatedTarget) && !chromeRef.current?.matches(':hover')) {
            setChromeRevealed(false)
          }
        }}
      >
        <Tabs
          tabs={tabs}
          activeTabId={activeTab.id}
          onTabClick={setActiveTabId}
          onNewTab={() => openTab()}
          onNewTabRight={(tabId) => openTab(null, { afterTabId: tabId })}
          onCloseTab={(tabId) => closeTabs([tabId])}
          onCloseOtherTabs={(tabId) => closeTabs(tabs.filter(t => t.id !== tabId).map(t => t.id))}
          onCloseTabsToRight={(tabId) => closeTabs(tabs.slice(tabs.findIndex(t => t.id === tabId) + 1).map(t => t.id))}
          onReorderTabs={setTabs}
          isFullscreen={isFullscreen}
          onDuplicateTab={(tabId) => openTab(tabs.find(t => t.id === tabId)?.url, { afterTabId: tabId })}
          onReloadTab={(tabId) => webViewRefs.current.get(tabId)?.reload()}
        />
        <div className="browser-header">
          <button
            type="button"
            className={`browser-home${assistantOpen ? ' is-open' : ''}${assistantBusy ? ' is-thinking' : ''}`}
            onClick={() => setAssistantOpen(o => !o)}
            title={`Ask AI (${shortcut('⌘K', 'Ctrl+K')})`}
            aria-label="Ask AI"
            aria-expanded={assistantOpen}
          >
            <SmiazonLogo />
          </button>
          <NavigationButtons
            canGoBack={hasPage && (activeTab.canGoBack || activeTab.homeBack)}
            canGoForward={hasPage ? activeTab.canGoForward : !activeTab.url && !!activeTab.homeForward}
            canReload={hasPage}
            loading={hasPage && activeTab.loading}
            onBack={commands.back}
            onForward={commands.forward}
            onRefresh={commands.reload}
            onStop={commands.stop}
          />
          <AddressBar
            key={activeTab.id}
            ref={addressBarRef}
            url={activeTab.url || ''}
            loading={hasPage && activeTab.loading}
            onNavigate={navigateActive}
            history={history}
            zoom={hasPage ? activeTab.zoom : 1}
            onResetZoom={commands['zoom-reset']}
            canBookmark={canBookmark}
            isBookmarked={isBookmarked}
            onToggleBookmark={toggleBookmark}
            canRead={hasPage && isElectron}
            isReading={!!activeTab.reader}
            onToggleReading={toggleReadingMode}
            bookmarkBubble={bookmarkBubble && findByUrl(bookmarks, activeTab.url)?.id === bookmarkBubble.id && (
              <BookmarkBubble
                key={bookmarkBubble.id}
                bookmark={bookmarks.find(b => b.id === bookmarkBubble.id)}
                items={bookmarks}
                isNew={bookmarkBubble.isNew}
                onChange={setBookmarks}
                onRemove={() => {
                  setBookmarks(prev => removeItem(prev, bookmarkBubble.id))
                  setBookmarkBubble(null)
                }}
                onClose={() => setBookmarkBubble(null)}
              />
            )}
            shields={isWebUrl(activeTab.url) && isElectron && (
              <Shields
                host={hostOf(activeTab.url)}
                stats={shieldStats[activeTab.webContentsId]}
                prefs={shieldPrefs}
                isPrivate={isIncognito}
                onToggleSite={toggleSiteShields}
                onOpenPopup={(url) => openTab(url, { afterTabId: activeTab.id })}
                onOpenSettings={() => {
                  setSettingsSection({ id: 'privacy', at: Date.now() })
                  openSpecialPage(SETTINGS_PAGE_URL)
                }}
              />
            )}
          />
          <div className="browser-header-actions">
            {isIncognito && (
              <span className="incognito-badge" title="Pages you view in this window won’t appear in your history, and cookies are deleted when you quit.">
                {vpnActive ? 'Private · VPN' : 'Private'}
              </span>
            )}
            {!isIncognito && vpnActive && (
              <span className="incognito-badge" title="All tabs go through your VPN / proxy">VPN</span>
            )}
            <DownloadsButton items={downloads} onClick={commands['open-downloads']} />
            {activeTab.url && mailAvatar('toolbar')}
            <MenuButton
              theme={effectiveTheme}
              onThemeChange={setTheme}
              onNewTab={commands['new-tab']}
              onNewWindow={() => newWindow({ incognito: isIncognito })}
              onNewIncognitoWindow={() => newWindow({ incognito: true })}
              focusMode={focusMode}
              onToggleFocus={toggleFocus}
              zoom={hasPage ? activeTab.zoom : 1}
              canZoom={hasPage && isElectron}
              onZoomIn={commands['zoom-in']}
              onZoomOut={commands['zoom-out']}
              onResetZoom={commands['zoom-reset']}
              hasPage={hasPage}
              isReading={!!activeTab.reader}
              onToggleReading={toggleReadingMode}
              onOpenHistory={commands['open-history']}
              onOpenBookmarks={commands['open-bookmarks']}
              onOpenDownloads={commands['open-downloads']}
              onFindInPage={openFind}
              onTranslate={translatePage}
              onPrint={commands.print}
              onSavePage={savePage}
              onSettings={commands['open-settings']}
              onExtensions={commands['open-extensions']}
              onDeveloperTools={commands.devtools}
              onAskAI={() => setAssistantOpen(true)}
              showBookmarksBar={showBookmarksBar}
              onToggleBookmarksBar={toggleBookmarksBar}
            />
          </div>
        </div>
        {showBookmarksBar && (
          <BookmarksBar
            items={bookmarks}
            onChange={setBookmarks}
            onOpen={(url, { newTab, background } = {}) => (newTab ? openTab(url, { afterTabId: activeTab.id, background }) : navigateActive(url))}
            onHide={toggleBookmarksBar}
          />
        )}
      </div>
      {focusHint && (
        <div className="focus-hint glass" role="status">
          Focus mode · move to the top edge for tabs · {shortcut('⇧⌘F', 'Ctrl+Shift+F')} or Esc to leave
        </div>
      )}
      <div className="browser-content-inner">
        {/* Always keep tab webviews mounted so playback (e.g. YouTube) never stops when opening or viewing new-tab/Downloads */}
        <div className="browser-tab-views">
          {tabs.filter(tab => tab.url && !isInternalUrl(tab.url)).map(tab => (
            <div
              key={tab.id}
              className={`webview-tab ${tab.id === activeTab.id ? 'active' : ''}`}
            >
              <WebView
                ref={r => {
                  if (r) webViewRefs.current.set(tab.id, r)
                  else webViewRefs.current.delete(tab.id)
                }}
                tabId={tab.id}
                initialUrl={tab.url}
                incognito={isIncognito}
                onStateChange={handleTabState}
                onContextMenu={handlePageContextMenu}
                onFoundInPage={handleFoundInPage}
              />
            </div>
          ))}
        </div>
        {activeTab.reader && (
          <ReaderView article={activeTab.reader} onClose={() => updateTab(activeTab.id, { reader: null })} />
        )}
        {specialPage && (
          <div className="browser-special-page-overlay">
            {specialPage}
          </div>
        )}
        <FindBar
          ref={findBarRef}
          visible={find.open && hasPage}
          query={find.query}
          onQueryChange={setFindQuery}
          onNext={() => findStep(true)}
          onPrevious={() => findStep(false)}
          onClose={closeFind}
          result={findResult?.tabId === activeTab.id ? findResult : null}
        />
      </div>
      <Assistant
        open={assistantOpen}
        onClose={() => setAssistantOpen(false)}
        getPage={getPage}
        pageInfo={pageInfo}
        onOpenUrl={(url) => openTab(url, { afterTabId: activeTab.id })}
        onOpenSettings={() => {
          setAssistantOpen(false)
          setSettingsSection({ id: 'assistant', at: Date.now() })
          openSpecialPage(SETTINGS_PAGE_URL)
        }}
        onBusyChange={setAssistantBusy}
        connectRequest={assistantConnect}
      />
      {pageContextMenu && pageContextMenu.tabId === activeTab.id && (
        <ContextMenu
          items={buildPageContextMenu()}
          position={{ x: pageContextMenu.x, y: pageContextMenu.y }}
          onClose={() => setPageContextMenu(null)}
        />
      )}
    </div>
  )
}

export default BrowserWindow
