import { useState, useRef } from 'react'
import ContextMenu from './ContextMenu'
import { isElectron, shortcut } from '../utils/env'
import { isWebUrl } from '../utils/url'
import { TAB_DRAG_TYPE } from '../utils/bookmarks'
import './Tabs.css'

// Spinner while loading, the site's favicon once known, otherwise a globe
function TabIcon({ loading, favicon }) {
  const [failedSrc, setFailedSrc] = useState(null)
  if (loading) return <span className="tab-spinner" aria-label="Loading" />
  if (favicon && favicon !== failedSrc) {
    return <img src={favicon} alt="" className="tab-favicon" onError={() => setFailedSrc(favicon)} />
  }
  return (
    <svg className="tab-favicon tab-favicon-fallback" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.1" />
      <path d="M2 8H14M8 2C9.6 3.8 10.2 5.8 10.2 8S9.6 12.2 8 14M8 2C6.4 3.8 5.8 5.8 5.8 8S6.4 12.2 8 14" stroke="currentColor" strokeWidth="1.1" />
    </svg>
  )
}

function Tabs({
  tabs,
  activeTabId,
  onTabClick,
  onNewTab,
  onNewTabRight,
  onCloseTab,
  onCloseOtherTabs,
  onCloseTabsToRight,
  onReorderTabs,
  isFullscreen,
  onDuplicateTab,
  onReloadTab,
}) {
  const [draggedTab, setDraggedTab] = useState(null)
  const [dragOverTab, setDragOverTab] = useState(null)
  const [tabContextMenu, setTabContextMenu] = useState(null) // { x, y, tabId }
  const tabsListRef = useRef(null)

  // Double-click empty tab bar space to maximize the window (when not in fullscreen)
  const handleTabBarDoubleClick = (e) => {
    if (e.target === e.currentTarget || e.target.classList.contains('tabs-list')) {
      if (!isFullscreen && isElectron) window.electronAPI?.maximizeWindow?.()
    }
  }

  // Middle-click to close tab
  const handleTabMouseDown = (e, tabId) => {
    if (e.button === 1) {
      e.preventDefault()
      onCloseTab(tabId)
    }
  }

  // Drag and drop
  const handleDragStart = (e, tab) => {
    setDraggedTab(tab.id)
    e.dataTransfer.effectAllowed = 'copyMove'
    e.dataTransfer.setData('text/html', '')
    // Dropping the tab on the bookmarks bar saves its page
    if (isWebUrl(tab.url)) e.dataTransfer.setData(TAB_DRAG_TYPE, JSON.stringify({ url: tab.url, title: tab.title }))
  }

  const handleDragOver = (e, tabId) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (draggedTab !== tabId) {
      setDragOverTab(tabId)
    }
  }

  const handleDragLeave = () => {
    setDragOverTab(null)
  }

  const handleDrop = (e, dropTabId) => {
    e.preventDefault()
    if (!draggedTab || draggedTab === dropTabId) {
      setDraggedTab(null)
      setDragOverTab(null)
      return
    }

    const draggedIndex = tabs.findIndex(tab => tab.id === draggedTab)
    const dropIndex = tabs.findIndex(tab => tab.id === dropTabId)

    const newTabs = [...tabs]
    const [removed] = newTabs.splice(draggedIndex, 1)
    newTabs.splice(dropIndex, 0, removed)

    onReorderTabs(newTabs)
    setDraggedTab(null)
    setDragOverTab(null)
  }

  const handleDragEnd = () => {
    setDraggedTab(null)
    setDragOverTab(null)
  }

  // Right-click context menu
  const handleContextMenu = (e, tabId) => {
    e.preventDefault()
    setTabContextMenu({ x: e.clientX, y: e.clientY, tabId })
  }

  const tabContextMenuItems = tabContextMenu ? (() => {
    const { tabId } = tabContextMenu
    const tabIndex = tabs.findIndex(t => t.id === tabId)
    const tab = tabs[tabIndex]
    const hasPage = !!tab?.url && !tab.url.startsWith('a4://')
    return [
      { label: 'New tab to the right', action: () => onNewTabRight(tabId) },
      { type: 'separator' },
      { label: 'Reload', shortcut: shortcut('⌘R', 'Ctrl+R'), action: () => onReloadTab(tabId), disabled: !hasPage },
      { label: 'Duplicate', action: () => onDuplicateTab(tabId), disabled: !tab?.url },
      { type: 'separator' },
      { label: 'Close', shortcut: shortcut('⌘W', 'Ctrl+W'), action: () => onCloseTab(tabId) },
      { label: 'Close other tabs', action: () => onCloseOtherTabs(tabId), disabled: tabs.length === 1 },
      { label: 'Close tabs to the right', action: () => onCloseTabsToRight(tabId), disabled: tabIndex === tabs.length - 1 },
    ]
  })() : []

  return (
    <>
    <div
      className={`tabs-container ${isFullscreen ? 'fullscreen' : ''}`}
      onDoubleClick={handleTabBarDoubleClick}
    >
      <div className="tabs-list" ref={tabsListRef}>
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`tab ${tab.id === activeTabId ? 'active' : ''} ${draggedTab === tab.id ? 'dragging' : ''} ${dragOverTab === tab.id ? 'drag-over' : ''}`}
            title={tab.title}
            onClick={() => onTabClick(tab.id)}
            onMouseDown={(e) => handleTabMouseDown(e, tab.id)}
            onDragStart={(e) => handleDragStart(e, tab)}
            onDragOver={(e) => handleDragOver(e, tab.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, tab.id)}
            onDragEnd={handleDragEnd}
            onContextMenu={(e) => handleContextMenu(e, tab.id)}
            draggable
          >
            <TabIcon loading={tab.loading} favicon={tab.favicon} />
            <span className="tab-title">{tab.title}</span>
            <button
              className="tab-close"
              onClick={(e) => {
                e.stopPropagation()
                onCloseTab(tab.id)
              }}
              aria-label="Close tab"
              title={`Close tab (${shortcut('⌘W', 'Ctrl+W')})`}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path
                  d="M9 3L3 9M3 3L9 9"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        ))}
        <button
          className="icon-btn new-tab-button"
          onClick={() => onNewTab()}
          aria-label="New tab"
          title={`New tab (${shortcut('⌘T', 'Ctrl+T')})`}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M8 3V13M3 8H13"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

    </div>
    {tabContextMenu && (
      <ContextMenu
        items={tabContextMenuItems}
        position={{ x: tabContextMenu.x, y: tabContextMenu.y }}
        onClose={() => setTabContextMenu(null)}
      />
    )}
    </>
  )
}

export default Tabs
