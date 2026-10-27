import { useState, useEffect, useLayoutEffect, forwardRef, useImperativeHandle, useRef } from 'react'
import { isSearchUrl, toNavigableUrl } from '../utils/url'
import { completeAddress, rememberTyped, typedUrlFor } from '../utils/typed'
import { shortcut } from '../utils/env'
import './AddressBar.css'

const INTERNAL_NAMES = {
  'a4://history': 'History',
  'a4://downloads': 'Downloads',
  'a4://bookmarks': 'Bookmarks',
  'a4://settings': 'Settings',
  'a4://extensions': 'Extensions',
}

// What the bar shows when idle: just the site, like Safari ("en.wikipedia.org")
function idleLabel(url) {
  if (!url) return ''
  if (INTERNAL_NAMES[url]) return INTERNAL_NAMES[url]
  try {
    const { protocol, host } = new URL(url)
    if (protocol === 'http:' || protocol === 'https:') return host.replace(/^www\./, '')
  } catch (_) {}
  return url
}

function SiteIcon({ url }) {
  if (url?.startsWith('https://')) {
    return (
      <span className="address-bar-site" title="Connection is secure">
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden>
          <rect x="3.5" y="7" width="9" height="7" rx="1.6" fill="currentColor" />
          <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </span>
    )
  }
  if (url?.startsWith('http://')) {
    return (
      <span className="address-bar-site address-bar-not-secure" title="Your connection to this site is not secure">
        Not secure
      </span>
    )
  }
  return null
}

const AddressBar = forwardRef(({
  url,
  loading,
  onNavigate,
  history, // visited pages, for completing sites you return to
  zoom = 1,
  onResetZoom,
  canBookmark,
  isBookmarked,
  onToggleBookmark,
  canRead,
  isReading,
  onToggleReading,
  shields, // the Shields button, shown with the page actions
  bookmarkBubble, // the card shown under ★ after bookmarking
}, ref) => {
  const [inputValue, setInputValue] = useState(url)
  const [isFocused, setIsFocused] = useState(false)
  // True while the user has typed something they haven't submitted yet
  const [isDirty, setIsDirty] = useState(false)
  // Inline completion: { typed, full }; the rest of `full` shows as ghost text
  const [completion, setCompletion] = useState(null)
  const inputRef = useRef(null)

  useImperativeHandle(ref, () => ({
    focus: () => {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }))

  // Follow the page's URL unless the user is in the middle of typing
  useEffect(() => {
    if (!isDirty) setInputValue(url)
  }, [url])

  // The completed part stays selected, so the next key replaces it
  useLayoutEffect(() => {
    if (completion) inputRef.current?.setSelectionRange(completion.typed.length, completion.full.length)
  }, [completion])

  const handleChange = (e) => {
    const value = e.target.value
    // Complete only while typing forward at the end, never on delete or paste
    const typingAtEnd = e.nativeEvent.inputType === 'insertText' && e.target.selectionStart === value.length
    const full = typingAtEnd ? completeAddress(value, history) : null
    setInputValue(full || value)
    setCompletion(full ? { typed: value, full } : null)
    setIsDirty(true)
  }

  const handleMouseDown = (e) => {
    setCompletion(null)
    // First click selects everything (Chrome-like); double/triple click behave normally
    if (!isFocused && e.detail === 1) {
      e.preventDefault()
      inputRef.current?.focus()
    }
  }

  const handleFocus = () => {
    setIsFocused(true)
    setTimeout(() => inputRef.current?.select(), 0)
  }

  const handleKeyDown = (e) => {
    if (completion) {
      // Tab (or →, End) takes the completion; Escape drops it
      if (e.key === 'Tab') {
        e.preventDefault()
        const end = completion.full.length
        inputRef.current?.setSelectionRange(end, end)
        setCompletion(null)
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setInputValue(completion.typed)
        setCompletion(null)
        return
      }
      if (['ArrowRight', 'ArrowLeft', 'End', 'Home'].includes(e.key)) setCompletion(null)
    }
    // Escape restores the page's URL; a second Escape leaves the field
    if (e.key === 'Escape') {
      e.preventDefault()
      if (isDirty || inputValue !== url) {
        setInputValue(url)
        setIsDirty(false)
        setTimeout(() => inputRef.current?.select(), 0)
      } else {
        inputRef.current?.blur()
      }
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const navigateUrl = typedUrlFor(inputValue) || toNavigableUrl(inputValue)
    if (!navigateUrl) return
    if (!isSearchUrl(navigateUrl)) rememberTyped(navigateUrl)
    setCompletion(null)
    setIsDirty(false)
    inputRef.current?.blur()
    onNavigate(navigateUrl)
  }

  const editing = isFocused || isDirty

  return (
    <form className="address-bar" onSubmit={handleSubmit}>
      <div className={`address-bar-container rainbow${editing ? ' is-editing' : ''}${loading ? ' is-loading' : ''}`}>
        {editing && (
          <svg className="address-bar-search" width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
            <circle cx="7" cy="7" r="4.6" stroke="currentColor" strokeWidth="1.5" />
            <path d="M10.6 10.6L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        )}
        <input
          ref={inputRef}
          type="text"
          className={`address-bar-input${completion ? ' is-completing' : ''}`}
          value={editing ? inputValue || '' : ''}
          onChange={handleChange}
          onMouseDown={handleMouseDown}
          onFocus={handleFocus}
          onBlur={() => {
            setIsFocused(false)
            setCompletion(null)
          }}
          onKeyDown={handleKeyDown}
          placeholder={editing || !url ? 'Search or enter address' : ''}
          spellCheck="false"
          aria-label="Address and search bar"
        />
        {completion && <kbd className="kbd address-bar-tab-hint" title="Press Tab to complete">Tab</kbd>}
        {!editing && url && (
          <span className="address-bar-idle" aria-hidden>
            <SiteIcon url={url} />
            <span className="address-bar-idle-text">{idleLabel(url)}</span>
          </span>
        )}
        {!editing && (
          <div className="address-bar-actions">
            {shields}
            {Math.abs(zoom - 1) > 0.001 && (
              <button type="button" className="address-bar-action address-bar-zoom" onClick={onResetZoom} title="Reset zoom to 100%">
                {Math.round(zoom * 100)}%
              </button>
            )}
            {canRead && (
              <button
                type="button"
                className={`address-bar-action${isReading ? ' is-active' : ''}`}
                onClick={onToggleReading}
                aria-pressed={isReading}
                title={isReading ? 'Exit reading mode' : 'Reading mode'}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
                  <path d="M8 4.2C6.6 3.2 4.6 2.9 2.2 3.2V12.6C4.6 12.3 6.6 12.6 8 13.6M8 4.2C9.4 3.2 11.4 2.9 13.8 3.2V12.6C11.4 12.3 9.4 12.6 8 13.6M8 4.2V13.6" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" />
                </svg>
              </button>
            )}
            {canBookmark && (
              <div className="address-bar-star-wrap">
                <button
                  type="button"
                  className={`address-bar-action address-bar-star${isBookmarked ? ' is-active' : ''}`}
                  onClick={onToggleBookmark}
                  aria-pressed={isBookmarked}
                  title={isBookmarked ? 'Edit bookmark' : `Bookmark this page (${shortcut('⌘D', 'Ctrl+D')})`}
                >
                  <svg width="15" height="15" viewBox="0 0 16 16" fill={isBookmarked ? 'currentColor' : 'none'} aria-hidden>
                    <path d="M8 1.8L9.9 5.7L14.2 6.3L11.1 9.3L11.8 13.6L8 11.6L4.2 13.6L4.9 9.3L1.8 6.3L6.1 5.7L8 1.8Z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" />
                  </svg>
                </button>
                {bookmarkBubble}
              </div>
            )}
          </div>
        )}
      </div>
    </form>
  )
})

AddressBar.displayName = 'AddressBar'

export default AddressBar
