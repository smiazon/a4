import { useState, useRef, useEffect } from 'react'
import './FindBar.css'

function FindBar({ onFind, onStopFind, onClose, visible }) {
  const [query, setQuery] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    if (visible) {
      inputRef.current?.focus()
    } else {
      onStopFind?.()
    }
  }, [visible])

  useEffect(() => {
    if (!visible) return
    if (query === '') {
      onStopFind?.()
    } else {
      onFind(query)
    }
  }, [query, visible])

  if (!visible) return null

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose()
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      if (e.shiftKey) {
        onFind(query, { forward: false })
      } else {
        onFind(query, { forward: true })
      }
    }
  }

  return (
    <div className="find-bar">
      <input
        ref={inputRef}
        type="text"
        className="find-bar-input"
        placeholder="Find in page..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
      />
      <button
        type="button"
        className="find-bar-btn"
        onClick={() => onFind(query, { forward: false })}
        title="Previous"
        disabled={!query}
      >
        ↑
      </button>
      <button
        type="button"
        className="find-bar-btn"
        onClick={() => onFind(query, { forward: true })}
        title="Next"
        disabled={!query}
      >
        ↓
      </button>
      <button
        type="button"
        className="find-bar-close"
        onClick={onClose}
        title="Close"
        aria-label="Close find bar"
      >
        ✕
      </button>
    </div>
  )
}

export default FindBar
