import { useState, useRef, useEffect } from 'react'
import './MenuButton.css'

function MenuButton({
  onNewWindow,
  onHistory,
  onDownloads,
  onBookmarks,
  onFindInPage,
  onPrint,
  onTranslate,
  onSummarize,
  onSettings,
  onExtensions,
  onDeveloperTools,
  onHelp,
}) {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  const handleItem = (fn) => {
    if (typeof fn === 'function') fn()
    setIsOpen(false)
  }

  return (
    <div className="menu-button-container" ref={menuRef}>
      <button
        className="menu-button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="More options"
        aria-expanded={isOpen}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="4" r="1" fill="currentColor" />
          <circle cx="8" cy="8" r="1" fill="currentColor" />
          <circle cx="8" cy="12" r="1" fill="currentColor" />
        </svg>
      </button>
      {isOpen && (
        <div className="menu-dropdown menu-dropdown-three-dots">
          <button className="menu-item" onClick={() => handleItem(onNewWindow)}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M2 4H14V12H2V4Z M6 2V6 M10 2V6 M6 10H10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>New window</span>
          </button>
          <div className="menu-divider" />
          <button className="menu-item" onClick={() => handleItem(onHistory)}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 4V8L10 10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.2" fill="none" />
            </svg>
            <span>History</span>
          </button>
          <button className="menu-item" onClick={() => handleItem(onDownloads)}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 10V2M8 10L5 7M8 10L11 7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M2 12V13C2 13.55 2.45 14 3 14H13C13.55 14 14 13.55 14 13V12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
            <span>Downloads</span>
          </button>
          <button className="menu-item" onClick={() => handleItem(onBookmarks)}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M4 2H12V14L8 11L4 14V2Z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>Bookmarks</span>
          </button>
          <div className="menu-divider" />
          <button className="menu-item" onClick={() => handleItem(onFindInPage)}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="7" cy="7" r="4" stroke="currentColor" strokeWidth="1.2" fill="none" />
              <path d="M10.5 10.5L13 13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
            <span>Find in page</span>
          </button>
          <button className="menu-item" onClick={() => handleItem(onPrint)}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M4 2H12V5H4V2Z M4 5H2C1.45 5 1 5.45 1 6V11H3V14H13V11H15V6C15 5.45 14.55 5 14 5H12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>Print</span>
          </button>
          <div className="menu-divider" />
          <button className="menu-item" onClick={() => handleItem(onTranslate)}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M11 2L8 8L5 2 M3 14H13 M6 14L8 10L10 14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>Translate page</span>
          </button>
          <button className="menu-item" onClick={() => handleItem(onSummarize)}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M2 4H14 M2 8H14 M2 12H9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
            <span>Summarize with AI</span>
          </button>
          <div className="menu-divider" />
          <button className="menu-item" onClick={() => handleItem(onSettings)}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.2" fill="none" />
              <path d="M8 1V3 M8 13V15 M15 8H13 M3 8H1 M12.07 3.93L10.66 5.34 M5.34 10.66L3.93 12.07 M12.07 12.07L10.66 10.66 M5.34 5.34L3.93 3.93" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
            <span>Settings</span>
          </button>
          <button className="menu-item" onClick={() => handleItem(onExtensions)}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M6 2L8 6L12 7L9 10L9.5 14L6 12L2.5 14L3 10L0 7L4 6L6 2Z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
            <span>Extensions</span>
          </button>
          <button className="menu-item" onClick={() => handleItem(onDeveloperTools)}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M2 4L6 8L2 12 M8 4L14 4L14 12L8 12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>Developer tools</span>
          </button>
          <div className="menu-divider" />
          <button className="menu-item" onClick={() => handleItem(onHelp)}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.2" fill="none" />
              <path d="M8 6.5V8 M8 10.5H8.01" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
            <span>{'Help & about'}</span>
          </button>
        </div>
      )}
    </div>
  )
}

export default MenuButton
