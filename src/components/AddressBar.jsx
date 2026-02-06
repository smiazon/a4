import { useState, useEffect, forwardRef, useImperativeHandle, useRef } from 'react'
import './AddressBar.css'

const AddressBar = forwardRef(({ url, onNavigate }, ref) => {
  const [inputValue, setInputValue] = useState(url)
  const [isFocused, setIsFocused] = useState(false)
  const inputRef = useRef(null)

  useImperativeHandle(ref, () => ({
    focus: () => {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }))

  useEffect(() => {
    setInputValue(url)
  }, [url])

  // Handle mouse down for first click selection
  const handleMouseDown = (e) => {
    const input = inputRef.current
    if (!input) return

    // Triple click - browser default selects all, which is what we want
    if (e.detail === 3) {
      return // Let browser handle it
    }

    // Double click - browser default selects word, which is what we want
    if (e.detail === 2) {
      return // Let browser handle it
    }

    // First click when not focused - select all
    if (!isFocused) {
      e.preventDefault()
      setTimeout(() => {
        input.focus()
        input.select()
        setIsFocused(true)
      }, 0)
      return
    }

    // If focused and text is already selected, allow normal click behavior
    // This allows placing cursor at click position
  }

  // Handle focus - select all on focus (Chrome-like behavior)
  const handleFocus = (e) => {
    setIsFocused(true)
    const input = inputRef.current
    if (input) {
      // Small delay to ensure focus is complete before selecting
      setTimeout(() => {
        // Only select if nothing is already selected (to allow triple-click to work)
        if (input.selectionStart === input.selectionEnd) {
          input.select()
        }
      }, 0)
    }
  }

  const handleBlur = () => {
    setIsFocused(false)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    let navigateUrl = inputValue.trim()
    
    if (!navigateUrl) return

    // Add protocol if missing
    if (!navigateUrl.startsWith('http://') && !navigateUrl.startsWith('https://')) {
      // Check if it looks like a domain
      if (navigateUrl.includes('.') && !navigateUrl.includes(' ')) {
        navigateUrl = 'https://' + navigateUrl
      } else {
        // Treat as search query
        navigateUrl = `https://www.google.com/search?q=${encodeURIComponent(navigateUrl)}`
      }
    }

    onNavigate(navigateUrl)
  }

  return (
    <form className="address-bar" onSubmit={handleSubmit}>
      <div className="address-bar-container">
        <svg
          className="address-bar-icon"
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
        >
          <path
            d="M7.33333 12.6667C10.2789 12.6667 12.6667 10.2789 12.6667 7.33333C12.6667 4.38781 10.2789 2 7.33333 2C4.38781 2 2 4.38781 2 7.33333C2 10.2789 4.38781 12.6667 7.33333 12.6667Z"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M14 14L11.1 11.1"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <input
          ref={inputRef}
          type="text"
          className="address-bar-input"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onMouseDown={handleMouseDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder="Explore the cosmic web..."
          spellCheck="false"
        />
      </div>
    </form>
  )
})

AddressBar.displayName = 'AddressBar'

export default AddressBar
