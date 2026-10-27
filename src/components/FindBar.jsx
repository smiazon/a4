import { useRef, useEffect, forwardRef, useImperativeHandle } from 'react'
import { shortcut } from '../utils/env'
import './FindBar.css'

// Chrome-style find box. Query lives in the parent so menu shortcuts
// (⌘G / ⇧⌘G) can step through matches too.
const FindBar = forwardRef(({ visible, query, onQueryChange, onNext, onPrevious, onClose, result }, ref) => {
  const inputRef = useRef(null)

  useImperativeHandle(ref, () => ({
    focus: () => {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }))

  useEffect(() => {
    if (visible) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [visible])

  if (!visible) return null

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (e.shiftKey) onPrevious()
      else onNext()
    }
  }

  const noMatches = query && result && result.matches === 0

  return (
    <div className="find-bar glass rainbow" role="search">
      <input
        ref={inputRef}
        type="text"
        className={`find-bar-input${noMatches ? ' no-matches' : ''}`}
        placeholder="Find in page"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        onKeyDown={handleKeyDown}
        aria-label="Find in page"
      />
      <span className="find-bar-count" aria-live="polite">
        {query && result ? `${result.activeMatchOrdinal || 0}/${result.matches || 0}` : ''}
      </span>
      <span className="find-bar-sep" />
      <button
        type="button"
        className="find-bar-btn"
        onClick={onPrevious}
        title={`Previous (${shortcut('⇧⌘G', 'Shift+Enter')})`}
        aria-label="Previous match"
        disabled={!query}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M4 10L8 6L12 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      <button
        type="button"
        className="find-bar-btn"
        onClick={onNext}
        title={`Next (${shortcut('⌘G', 'Enter')})`}
        aria-label="Next match"
        disabled={!query}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      <button
        type="button"
        className="find-bar-btn"
        onClick={onClose}
        title="Close (Esc)"
        aria-label="Close find bar"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M9 3L3 9M3 3L9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
      </button>
    </div>
  )
})

FindBar.displayName = 'FindBar'

export default FindBar
