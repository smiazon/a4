import { useState, useRef, useEffect, useCallback } from 'react'
import AddressBar from './AddressBar'
import NavigationButtons from './NavigationButtons'
import InfoButton from './InfoButton'
import MenuButton from './MenuButton'
import FindBar from './FindBar'
import Tabs from './Tabs'
import WebView from './WebView'
import SmiazonLogo from './SmiazonLogo'
import Favorites from './Favorites'
import './BrowserWindow.css'

function BrowserWindow() {
  const [tabs, setTabs] = useState([
    { id: 1, url: null, title: 'New Tab', favicon: null, active: true, isNewTab: true }
  ])
  const [activeTabId, setActiveTabId] = useState(1)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showFindBar, setShowFindBar] = useState(false)
  const [sessionHistory, setSessionHistory] = useState([])
  const [showHistoryPanel, setShowHistoryPanel] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [showHelpModal, setShowHelpModal] = useState(false)
  const webViewRef = useRef(null)
  const addressBarRef = useRef(null)

  const activeTab = tabs.find(tab => tab.id === activeTabId)
  const showFavorites = activeTab && (!activeTab.url || activeTab.isNewTab)
  
  // Check if we're in Electron
  const isElectron = typeof window !== 'undefined' && (
    (window.electronAPI && window.electronAPI.isElectron === true) ||
    (window.process && window.process.type === 'renderer') ||
    navigator.userAgent.includes('Electron') ||
    (window.require && typeof window.require === 'function')
  )

  const handleCloseTab = useCallback((tabId) => {
    setTabs(prevTabs => {
      if (prevTabs.length === 1) {
        // Close the app when last tab is closed
        if (isElectron && window.electronAPI && window.electronAPI.closeApp) {
          window.electronAPI.closeApp()
        } else {
          window.close()
        }
        return prevTabs
      }
      const filteredTabs = prevTabs.filter(tab => tab.id !== tabId)
      const newActiveId = filteredTabs[filteredTabs.length - 1].id
      setActiveTabId(newActiveId)
      return filteredTabs
    })
  }, [isElectron])

  // Detect fullscreen mode (works for both web and Electron)
  useEffect(() => {
    let electronFullscreenState = null // Track Electron's fullscreen state
    
    const checkFullscreen = () => {
      // Prioritize Electron IPC fullscreen state if available
      if (electronFullscreenState !== null) {
        setIsFullscreen(electronFullscreenState)
        return
      }
      
      // Fallback to checking fullscreen APIs
      let isFullscreen = !!(
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement ||
        document.msFullscreenElement
      )
      
      // Note: We only check for true fullscreen mode, not maximized windows
      // Maximized windows should keep the padding for macOS window controls
      
      setIsFullscreen(isFullscreen)
    }

    // Listen for various fullscreen events
    document.addEventListener('fullscreenchange', checkFullscreen)
    document.addEventListener('webkitfullscreenchange', checkFullscreen)
    document.addEventListener('mozfullscreenchange', checkFullscreen)
    document.addEventListener('MSFullscreenChange', checkFullscreen)
    
    // Also check on resize (for Electron fullscreen)
    window.addEventListener('resize', checkFullscreen)
    
    // Listen for Electron fullscreen events via IPC (prioritized)
    if (window.electronAPI && window.electronAPI.onFullscreenChange) {
      window.electronAPI.onFullscreenChange((isFullscreen) => {
        electronFullscreenState = isFullscreen
        setIsFullscreen(isFullscreen)
      })
    }
    
    // Check more frequently for Electron (every 200ms)
    const interval = setInterval(checkFullscreen, isElectron ? 200 : 1000)
    
    // Initial check
    checkFullscreen()

    return () => {
      clearInterval(interval)
      document.removeEventListener('fullscreenchange', checkFullscreen)
      document.removeEventListener('webkitfullscreenchange', checkFullscreen)
      document.removeEventListener('mozfullscreenchange', checkFullscreen)
      document.removeEventListener('MSFullscreenChange', checkFullscreen)
      window.removeEventListener('resize', checkFullscreen)
    }
  }, [isElectron])

  const handleNavigate = (url) => {
    const updatedTabs = tabs.map(tab =>
      tab.id === activeTabId
        ? { ...tab, url, title: 'Loading...', favicon: null, isNewTab: false }
        : tab
    )
    setTabs(updatedTabs)
    if (webViewRef.current) {
      webViewRef.current.navigate(url)
    }
  }

  const handleBack = () => {
    if (webViewRef.current) {
      webViewRef.current.goBack()
    }
  }

  const handleForward = () => {
    if (webViewRef.current) {
      webViewRef.current.goForward()
    }
  }

  const handleRefresh = useCallback(() => {
    if (webViewRef.current) {
      webViewRef.current.refresh()
    }
  }, [])

  const handleNewTab = useCallback(() => {
    setTabs(prevTabs => {
      const newTab = {
        id: Date.now(),
        url: null,
        title: 'New Tab',
        favicon: null,
        active: false,
        isNewTab: true
      }
      setActiveTabId(newTab.id)
      return [...prevTabs, newTab]
    })
  }, [])

  const handleTabClick = (tabId) => {
    setActiveTabId(tabId)
  }

  const handleUrlChange = (url, title, favicon) => {
    const updatedTabs = tabs.map(tab =>
      tab.id === activeTabId
        ? { ...tab, url, title: title || url, favicon: favicon || tab.favicon, isNewTab: false }
        : tab
    )
    setTabs(updatedTabs)
    if (url && url !== 'about:blank') {
      setSessionHistory(prev => {
        const next = [...prev, { url, title: title || url }]
        if (next.length > 100) return next.slice(-100)
        return next
      })
    }
  }

  const handleReorderTabs = (newTabs) => {
    setTabs(newTabs)
  }

  // Keyboard shortcuts (Chrome-like)
  useEffect(() => {
    const handleKeyDown = (e) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
      const ctrlOrCmd = isMac ? e.metaKey : e.ctrlKey

      // Ctrl+T / Cmd+T - New tab
      if (ctrlOrCmd && e.key === 't') {
        e.preventDefault()
        handleNewTab()
        return
      }

      // Ctrl+W / Cmd+W - Close tab
      if (ctrlOrCmd && e.key === 'w') {
        e.preventDefault()
        handleCloseTab(activeTabId)
        return
      }

      // Ctrl+Tab / Cmd+Tab - Next tab
      if (ctrlOrCmd && e.key === 'Tab' && !e.shiftKey) {
        e.preventDefault()
        const currentIndex = tabs.findIndex(tab => tab.id === activeTabId)
        const nextIndex = (currentIndex + 1) % tabs.length
        setActiveTabId(tabs[nextIndex].id)
        return
      }

      // Ctrl+Shift+Tab / Cmd+Shift+Tab - Previous tab
      if (ctrlOrCmd && e.shiftKey && e.key === 'Tab') {
        e.preventDefault()
        const currentIndex = tabs.findIndex(tab => tab.id === activeTabId)
        const prevIndex = (currentIndex - 1 + tabs.length) % tabs.length
        setActiveTabId(tabs[prevIndex].id)
        return
      }

      // Ctrl+1-9 / Cmd+1-9 - Switch to tab by number
      if (ctrlOrCmd && e.key >= '1' && e.key <= '9') {
        e.preventDefault()
        const tabNumber = parseInt(e.key) - 1
        if (tabNumber < tabs.length) {
          setActiveTabId(tabs[tabNumber].id)
        }
        return
      }

      // Ctrl+L / Cmd+L - Focus address bar
      if (ctrlOrCmd && e.key === 'l') {
        e.preventDefault()
        if (addressBarRef.current) {
          addressBarRef.current.focus()
        }
        return
      }

      // F5 or Ctrl+R / Cmd+R - Refresh
      if (e.key === 'F5' || (ctrlOrCmd && e.key === 'r')) {
        e.preventDefault()
        handleRefresh()
        return
      }

      // Ctrl+F / Cmd+F - Find in page
      if (ctrlOrCmd && e.key === 'f') {
        e.preventDefault()
        setShowFindBar(prev => !prev)
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [tabs, activeTabId, handleNewTab, handleCloseTab, handleRefresh])

  const handleFindInPage = useCallback((text, options) => {
    webViewRef.current?.findInPage?.(text, options)
  }, [])
  const handleStopFindInPage = useCallback(() => {
    webViewRef.current?.stopFindInPage?.()
  }, [])
  const handlePrint = useCallback(() => {
    webViewRef.current?.print?.()
  }, [])
  const handleTranslate = useCallback(() => {
    const url = activeTab?.url
    if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
      handleNavigate(`https://translate.google.com/translate?u=${encodeURIComponent(url)}`)
    }
  }, [activeTab?.url])
  const handleOpenDevTools = useCallback(() => {
    webViewRef.current?.openDevTools?.()
  }, [])
  const handleNewWindow = useCallback(() => {
    if (typeof window !== 'undefined' && window.electronAPI?.newWindow) {
      window.electronAPI.newWindow()
    }
  }, [])
  const handleHistoryItemClick = useCallback((url) => {
    handleNavigate(url)
    setShowHistoryPanel(false)
  }, [])

  return (
    <div className={`browser-window ${isFullscreen ? 'fullscreen' : ''}`}>
      <Tabs
        tabs={tabs}
        activeTabId={activeTabId}
        onTabClick={handleTabClick}
        onNewTab={handleNewTab}
        onCloseTab={handleCloseTab}
        onReorderTabs={handleReorderTabs}
        isFullscreen={isFullscreen}
      />
      <div className="browser-header">
        <SmiazonLogo />
        <NavigationButtons
          onBack={handleBack}
          onForward={handleForward}
          onRefresh={handleRefresh}
        />
        <AddressBar
          ref={addressBarRef}
          url={activeTab?.url || ''}
          onNavigate={handleNavigate}
        />
        <div className="browser-header-actions">
          <InfoButton
            onReadingMode={() => {}}
            onIncognitoMode={() => {}}
            isIncognito={false}
          />
          <MenuButton
            onNewWindow={handleNewWindow}
            onHistory={() => setShowHistoryPanel(true)}
            onDownloads={() => { /* Downloads folder / manager could be implemented */ }}
            onBookmarks={handleNewTab}
            onFindInPage={() => setShowFindBar(true)}
            onPrint={handlePrint}
            onTranslate={handleTranslate}
            onSummarize={() => { /* AI summarization could be integrated */ }}
            onSettings={() => setShowSettingsModal(true)}
            onExtensions={() => { /* Extensions not available in this browser */ }}
            onDeveloperTools={handleOpenDevTools}
            onHelp={() => setShowHelpModal(true)}
          />
        </div>
      </div>
      <FindBar
        visible={showFindBar}
        onFind={handleFindInPage}
        onStopFind={handleStopFindInPage}
        onClose={() => setShowFindBar(false)}
      />
      {showHistoryPanel && (
        <div className="browser-overlay" onClick={() => setShowHistoryPanel(false)} aria-hidden="true">
          <div className="browser-panel browser-history-panel" onClick={e => e.stopPropagation()}>
            <div className="browser-panel-header">
              <h2 className="browser-panel-title">History</h2>
              <button type="button" className="browser-panel-close" onClick={() => setShowHistoryPanel(false)} aria-label="Close">✕</button>
            </div>
            <div className="browser-panel-body">
              {sessionHistory.length === 0 ? (
                <p className="browser-panel-empty">No history yet. Pages you visit will appear here.</p>
              ) : (
                <ul className="browser-history-list">
                  {[...sessionHistory].reverse().map((entry, i) => (
                    <li key={`${entry.url}-${i}`}>
                      <button type="button" className="browser-history-item" onClick={() => handleHistoryItemClick(entry.url)}>
                        <span className="browser-history-title">{entry.title || entry.url}</span>
                        <span className="browser-history-url">{entry.url}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
      {showSettingsModal && (
        <div className="browser-overlay" onClick={() => setShowSettingsModal(false)} aria-hidden="true">
          <div className="browser-modal" onClick={e => e.stopPropagation()}>
            <div className="browser-panel-header">
              <h2 className="browser-panel-title">Settings</h2>
              <button type="button" className="browser-panel-close" onClick={() => setShowSettingsModal(false)} aria-label="Close">✕</button>
            </div>
            <div className="browser-panel-body">
              <p className="browser-panel-empty">Settings options will appear here.</p>
            </div>
          </div>
        </div>
      )}
      {showHelpModal && (
        <div className="browser-overlay" onClick={() => setShowHelpModal(false)} aria-hidden="true">
          <div className="browser-modal" onClick={e => e.stopPropagation()}>
            <div className="browser-panel-header">
              <h2 className="browser-panel-title">Help & about</h2>
              <button type="button" className="browser-panel-close" onClick={() => setShowHelpModal(false)} aria-label="Close">✕</button>
            </div>
            <div className="browser-panel-body">
              <p className="browser-help-app-name">Smiazon Web Explorer</p>
              <p className="browser-help-version">Version 1.0</p>
              <p className="browser-panel-empty">A minimal browser for exploring the web.</p>
            </div>
          </div>
        </div>
      )}
      {showFavorites ? (
        <Favorites onNavigate={handleNavigate} />
      ) : (
        <WebView
          ref={webViewRef}
          url={activeTab?.url}
          onUrlChange={handleUrlChange}
        />
      )}
    </div>
  )
}

export default BrowserWindow
