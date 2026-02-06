import { useState, useRef } from 'react'
import './Tabs.css'

function Tabs({ tabs, activeTabId, onTabClick, onNewTab, onCloseTab, onReorderTabs, isFullscreen }) {
  const [draggedTab, setDraggedTab] = useState(null)
  const [dragOverTab, setDragOverTab] = useState(null)
  const tabsListRef = useRef(null)
  const clickCountRef = useRef(0)
  const clickTimerRef = useRef(null)
  const doubleClickTimerRef = useRef(null)

  // Check if we're in Electron
  const isElectron = typeof window !== 'undefined' && (
    (window.electronAPI && window.electronAPI.isElectron === true) ||
    (window.process && window.process.type === 'renderer') ||
    navigator.userAgent.includes('Electron') ||
    (window.require && typeof window.require === 'function')
  )

  // Double-click tab bar to maximize window (when not in fullscreen)
  const handleTabBarDoubleClick = (e) => {
    // Only trigger on empty space, not on tabs
    if (e.target === e.currentTarget || e.target.classList.contains('tabs-list')) {
      // Only maximize if not in fullscreen and in Electron
      if (!isFullscreen && isElectron && window.electronAPI && window.electronAPI.maximizeWindow) {
        window.electronAPI.maximizeWindow()
      }
    }
  }

  // Triple-click tab bar to create new tab
  const handleTabBarClick = (e) => {
    // Only trigger on empty space, not on tabs
    if (e.target === e.currentTarget || e.target.classList.contains('tabs-list')) {
      clickCountRef.current += 1
      
      // Clear existing timer
      if (clickTimerRef.current) {
        clearTimeout(clickTimerRef.current)
      }
      
      // Set timer to reset click count
      clickTimerRef.current = setTimeout(() => {
        clickCountRef.current = 0
      }, 400) // 400ms window for triple-click
      
      // If we've reached 3 clicks, create new tab
      if (clickCountRef.current === 3) {
        clickCountRef.current = 0
        clearTimeout(clickTimerRef.current)
        onNewTab()
      }
    }
  }

  // Middle-click to close tab
  const handleTabMouseDown = (e, tabId) => {
    if (e.button === 1) { // Middle mouse button
      e.preventDefault()
      onCloseTab(tabId)
    }
  }

  // Drag and drop
  const handleDragStart = (e, tabId) => {
    setDraggedTab(tabId)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/html', '')
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
    // Simple context menu - could be enhanced later
    if (tabs.length > 1) {
      onCloseTab(tabId)
    }
  }

  return (
    <div 
      className={`tabs-container ${isFullscreen ? 'fullscreen' : ''}`}
      onClick={handleTabBarClick}
      onDoubleClick={handleTabBarDoubleClick}
    >
      <div className="tabs-list" ref={tabsListRef}>
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`tab ${tab.id === activeTabId ? 'active' : ''} ${draggedTab === tab.id ? 'dragging' : ''} ${dragOverTab === tab.id ? 'drag-over' : ''}`}
            onClick={() => onTabClick(tab.id)}
            onMouseDown={(e) => handleTabMouseDown(e, tab.id)}
            onDragStart={(e) => handleDragStart(e, tab.id)}
            onDragOver={(e) => handleDragOver(e, tab.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, tab.id)}
            onDragEnd={handleDragEnd}
            onContextMenu={(e) => handleContextMenu(e, tab.id)}
            draggable
          >
            {tab.favicon && (
              <img 
                src={tab.favicon} 
                alt="" 
                className="tab-favicon"
                onError={(e) => {
                  e.target.style.display = 'none'
                }}
              />
            )}
            <span className="tab-title">{tab.title}</span>
            <button
              className="tab-close"
              onClick={(e) => {
                e.stopPropagation()
                onCloseTab(tab.id)
              }}
              aria-label="Close tab"
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
      </div>
      <button className="new-tab-button" onClick={onNewTab} aria-label="New tab">
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
  )
}

export default Tabs
