import { useState, useRef, useEffect } from 'react'
import ThemeSwitch from './ThemeSwitch'
import { shortcut } from '../utils/env'
import './MenuButton.css'

const icons = {
  newTab: <path d="M8 3V13M3 8H13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />,
  newWindow: <><rect x="2" y="3" width="12" height="10" rx="2" stroke="currentColor" strokeWidth="1.3" /><path d="M2 6H14" stroke="currentColor" strokeWidth="1.3" /></>,
  incognito: <><path d="M2.5 8.5H13.5M4 8.5L5.2 4.5H10.8L12 8.5" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /><circle cx="5" cy="11.5" r="1.8" stroke="currentColor" strokeWidth="1.3" /><circle cx="11" cy="11.5" r="1.8" stroke="currentColor" strokeWidth="1.3" /><path d="M6.8 11.5H9.2" stroke="currentColor" strokeWidth="1.3" /></>,
  focus: <><circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.3" /><circle cx="8" cy="8" r="2" fill="currentColor" /></>,
  history: <><circle cx="8" cy="8" r="5.8" stroke="currentColor" strokeWidth="1.25" /><path d="M8 4.8V8L10.2 9.6" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" /></>,
  downloads: <><path d="M8 2.5V10M8 10L5 7M8 10L11 7" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" /><path d="M3 13H13" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" /></>,
  bookmarks: <path d="M4.5 2.5H11.5V13.5L8 11L4.5 13.5V2.5Z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" />,
  find: <><circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.25" /><path d="M10.4 10.4L13.5 13.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" /></>,
  ai: <><path d="M8 1.8L9.3 5.6L13.2 7L9.3 8.4L8 12.2L6.7 8.4L2.8 7L6.7 5.6L8 1.8Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" /><path d="M12.6 11.2L13.1 12.6L14.5 13.1L13.1 13.6L12.6 15L12.1 13.6L10.7 13.1L12.1 12.6L12.6 11.2Z" fill="currentColor" /></>,
  reading: <path d="M8 4.2C6.6 3.2 4.6 2.9 2.2 3.2V12.6C4.6 12.3 6.6 12.6 8 13.6M8 4.2C9.4 3.2 11.4 2.9 13.8 3.2V12.6C11.4 12.3 9.4 12.6 8 13.6M8 4.2V13.6" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />,
  translate: <><path d="M2.5 4H9M5.8 2.5V4M4 4C4.6 6.4 6 8 8 9M7.6 4C7 6.6 5.2 8.6 2.8 9.6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /><path d="M8.5 13.5L11 7.5L13.5 13.5M9.4 11.5H12.6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></>,
  print: <><path d="M4.5 6V2.5H11.5V6" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" /><rect x="2" y="6" width="12" height="5.5" rx="1.5" stroke="currentColor" strokeWidth="1.2" /><path d="M4.5 9.5H11.5V13.5H4.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" /></>,
  save: <><path d="M8 2.5V9.5M8 9.5L5.5 7M8 9.5L10.5 7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /><path d="M3 10.5V12.5C3 13 3.4 13.5 4 13.5H12C12.6 13.5 13 13 13 12.5V10.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></>,
  settings: <><circle cx="8" cy="8" r="2.2" stroke="currentColor" strokeWidth="1.2" /><path d="M8 1.8V3.6M8 12.4V14.2M14.2 8H12.4M3.6 8H1.8M12.4 3.6L11.1 4.9M4.9 11.1L3.6 12.4M12.4 12.4L11.1 11.1M4.9 4.9L3.6 3.6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></>,
  extensions: <path d="M6 2.5H9V4.2A1.3 1.3 0 1 0 11.6 4.2V4.2H13.5V7.5H11.8A1.3 1.3 0 1 0 11.8 10.1H13.5V13.5H10V11.8A1.3 1.3 0 1 0 7.4 11.8V13.5H2.5V9.5H4.2A1.3 1.3 0 1 0 4.2 6.9H2.5V2.5H6Z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />,
  devtools: <path d="M5.5 4.5L2 8L5.5 11.5M10.5 4.5L14 8L10.5 11.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />,
}

const Icon = ({ name }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>{icons[name]}</svg>
)

function MenuButton({
  theme,
  onThemeChange,
  onNewTab,
  onNewWindow,
  onNewIncognitoWindow,
  focusMode,
  onToggleFocus,
  zoom = 1,
  canZoom,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  hasPage,
  isReading,
  onToggleReading,
  onOpenHistory,
  onOpenDownloads,
  onOpenBookmarks,
  onFindInPage,
  onTranslate,
  onPrint,
  onSavePage,
  onSettings,
  onExtensions,
  onDeveloperTools,
  onAskAI,
  showBookmarksBar,
  onToggleBookmarksBar,
}) {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    if (!isOpen) return
    const close = () => setIsOpen(false)
    const handleClickOutside = (event) => {
      if (!menuRef.current?.contains(event.target)) close()
    }
    const handleKey = (e) => { if (e.key === 'Escape') close() }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKey)
    // Clicks inside a web page never reach this document, but they blur it
    window.addEventListener('blur', close)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKey)
      window.removeEventListener('blur', close)
    }
  }, [isOpen])

  const run = (fn) => {
    fn?.()
    setIsOpen(false)
  }

  const tile = (icon, label, onClick, active) => (
    <button type="button" className={`menu-tile${active ? ' is-on rainbow' : ''}`} onClick={() => run(onClick)}>
      <Icon name={icon} />
      <span>{label}</span>
    </button>
  )

  const item = (icon, label, onClick, { keys, disabled, active } = {}) => (
    <button type="button" className={`menu-item${active ? ' is-active' : ''}`} onClick={() => run(onClick)} disabled={disabled}>
      <Icon name={icon} />
      <span className="menu-item-label">{label}</span>
      {keys && <span className="kbd">{keys}</span>}
    </button>
  )

  return (
    <div className="menu-button-container" ref={menuRef}>
      <button
        className={`icon-btn${isOpen ? ' is-open' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Menu"
        aria-expanded={isOpen}
        title="Menu"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
          <circle cx="8" cy="3.5" r="1.25" />
          <circle cx="8" cy="8" r="1.25" />
          <circle cx="8" cy="12.5" r="1.25" />
        </svg>
      </button>
      {isOpen && (
        <div className="menu-panel glass" role="menu">
          <div className="menu-tiles">
            {tile('newTab', 'New tab', onNewTab)}
            {tile('newWindow', 'Window', onNewWindow)}
            {tile('incognito', 'Private', onNewIncognitoWindow)}
            {tile('focus', 'Focus', onToggleFocus, focusMode)}
          </div>

          <div className="menu-row">
            <span className="menu-row-label">Dark mode</span>
            <ThemeSwitch theme={theme} onChange={onThemeChange} />
          </div>
          <div className="menu-row">
            <span className="menu-row-label">Zoom</span>
            <div className="menu-zoom">
              <button type="button" onClick={onZoomOut} disabled={!canZoom} aria-label="Zoom out" title={`Zoom out (${shortcut('⌘−', 'Ctrl+−')})`}>−</button>
              <button type="button" className="menu-zoom-value" onClick={onResetZoom} disabled={!canZoom} title="Reset to 100%">
                {Math.round(zoom * 100)}%
              </button>
              <button type="button" onClick={onZoomIn} disabled={!canZoom} aria-label="Zoom in" title={`Zoom in (${shortcut('⌘+', 'Ctrl++')})`}>+</button>
            </div>
          </div>

          <div className="menu-divider" />
          {item('ai', 'Ask AI', onAskAI, { keys: shortcut('⌘K', 'Ctrl+K') })}
          {item('history', 'History', onOpenHistory, { keys: shortcut('⌘Y', 'Ctrl+H') })}
          {item('bookmarks', 'Bookmarks', onOpenBookmarks, { keys: shortcut('⌥⌘B', 'Ctrl+Shift+O') })}
          {item('bookmarks', showBookmarksBar ? 'Hide bookmarks bar' : 'Show bookmarks bar', onToggleBookmarksBar, { keys: shortcut('⇧⌘B', 'Ctrl+Shift+B') })}
          {item('downloads', 'Downloads', onOpenDownloads, { keys: shortcut('⌥⌘L', 'Ctrl+J') })}
          <div className="menu-divider" />
          {item('find', 'Find in page', onFindInPage, { keys: shortcut('⌘F', 'Ctrl+F'), disabled: !hasPage })}
          {item('reading', isReading ? 'Exit reading mode' : 'Reading mode', onToggleReading, { disabled: !hasPage, active: isReading })}
          {item('translate', 'Translate page', onTranslate, { disabled: !hasPage })}
          {item('print', 'Print', onPrint, { keys: shortcut('⌘P', 'Ctrl+P'), disabled: !hasPage })}
          {item('save', 'Save page as', onSavePage, { keys: shortcut('⌘S', 'Ctrl+S'), disabled: !hasPage })}
          <div className="menu-divider" />
          {item('settings', 'Settings', onSettings, { keys: shortcut('⌘,', undefined) })}
          {item('extensions', 'Extensions', onExtensions)}
          {item('devtools', 'Developer tools', onDeveloperTools, { keys: shortcut('⌥⌘I', 'Ctrl+Shift+I'), disabled: !hasPage })}
        </div>
      )}
    </div>
  )
}

export default MenuButton
