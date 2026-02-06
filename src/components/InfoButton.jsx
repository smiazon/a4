import { useState, useRef, useEffect } from 'react'
import './InfoButton.css'

function InfoButton({ onReadingMode, onIncognitoMode, isIncognito }) {
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

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleClick = () => {
    setIsOpen(!isOpen)
  }

  const handleMenuItemClick = (action) => {
    action()
    setIsOpen(false)
  }

  return (
    <div className="info-button-container" ref={menuRef}>
      <button
        className="info-button"
        onClick={handleClick}
        aria-label="Options"
        aria-expanded={isOpen}
      >
        <span className="info-button-icon">i</span>
      </button>
      {isOpen && (
        <div className="info-button-dropdown">
          <button
            className="info-button-item"
            onClick={() => handleMenuItemClick(onReadingMode)}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M3 4H13M3 8H13M3 12H10"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
              />
            </svg>
            <span>Reading Mode</span>
          </button>
          <button
            className={`info-button-item ${isIncognito ? 'active' : ''}`}
            onClick={() => handleMenuItemClick(onIncognitoMode)}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M8 2C6.343 2 5 3.343 5 5C5 6.657 6.343 8 8 8C9.657 8 11 6.657 11 5C11 3.343 9.657 2 8 2Z"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M3 14C3 11.791 5.239 10 8 10C10.761 10 13 11.791 13 14"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span>Incognito Mode</span>
            {isIncognito && <span className="info-button-badge">ON</span>}
          </button>
        </div>
      )}
    </div>
  )
}

export default InfoButton
