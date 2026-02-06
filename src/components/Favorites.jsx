import { useState, useRef, useEffect } from 'react'
import './Favorites.css'

const favorites = [
  {
    name: 'Google',
    url: 'https://www.google.com',
    icon: 'https://www.google.com/s2/favicons?domain=google.com&sz=64',
    color: '#4285F4'
  },
  {
    name: 'YouTube',
    url: 'https://www.youtube.com',
    icon: 'https://www.google.com/s2/favicons?domain=youtube.com&sz=64',
    color: '#FF0000'
  },
  {
    name: 'Wikipedia',
    url: 'https://www.wikipedia.org',
    icon: 'https://www.google.com/s2/favicons?domain=wikipedia.org&sz=64',
    color: '#000000'
  }
]

const dailyQuotes = [
  "Today is a fresh start.",
  "You've got this.",
  "Make it happen.",
  "Dream big, start small.",
  "Progress, not perfection.",
  "You are capable of great things.",
  "Today matters most.",
  "Stay curious, always.",
  "Be kind to yourself, always.",
  "Small steps lead to big changes.",
  "You're doing better than you think.",
  "Keep going, you're almost there.",
  "Believe in yourself, always.",
  "Every day brings new possibilities.",
  "You have the power to change.",
  "Stay positive, stay strong.",
  "Trust the process, trust yourself.",
  "You matter more than you know.",
  "Keep learning, keep growing.",
  "Be present in this moment.",
  "You're enough, exactly as you are.",
  "Stay focused on what matters.",
  "Embrace today with open arms.",
  "You can do anything you set your mind to.",
  "Stay grateful for what you have.",
  "Keep growing into who you're meant to be.",
  "Be yourself, unapologetically.",
  "Stay hopeful, even in darkness.",
  "You're stronger than you realize.",
  "Make today count.",
  "Stay inspired, stay motivated."
]

// Get a quote based on the day of the year (0-364)
function getDailyQuote() {
  const now = new Date()
  const start = new Date(now.getFullYear(), 0, 0)
  const diff = now - start
  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24))
  const quoteIndex = dayOfYear % dailyQuotes.length
  return dailyQuotes[quoteIndex]
}

function Favorites({ onNavigate }) {
  const [searchValue, setSearchValue] = useState('')
  const [isFocused, setIsFocused] = useState(false)
  const [dailyQuote] = useState(getDailyQuote())
  const searchInputRef = useRef(null)

  const handleSubmit = (e) => {
    e.preventDefault()
    const query = searchValue.trim()
    if (!query) return

    let navigateUrl = query

    // Add protocol if missing
    if (!query.startsWith('http://') && !query.startsWith('https://')) {
      // Check if it looks like a domain
      if (query.includes('.') && !query.includes(' ')) {
        navigateUrl = 'https://' + query
      } else {
        // Treat as search query
        navigateUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`
      }
    }

    onNavigate(navigateUrl)
  }

  // Auto-focus the search input
  useEffect(() => {
    searchInputRef.current?.focus()
    setIsFocused(true)
  }, [])

  const handleFocus = () => {
    setIsFocused(true)
  }

  const handleBlur = () => {
    setIsFocused(false)
  }

  return (
    <div className="favorites-container">
      <div className="favorites-a4-logo-wrap" aria-hidden="true">
        <div className="favorites-a4-circle" />
        <div className="favorites-a4-logo">A4</div>
      </div>
      <div className="favorites-content">
        <h1 className="favorites-title">{dailyQuote}</h1>
        <div className="favorites-grid">
          {favorites.map((favorite, index) => (
            <button
              key={index}
              className="favorite-card"
              onClick={() => onNavigate(favorite.url)}
              style={{ '--accent-color': favorite.color }}
            >
              <div className="favorite-icon-wrapper">
                <img 
                  src={favorite.icon} 
                  alt={favorite.name}
                  className="favorite-icon"
                  onError={(e) => {
                    e.target.style.display = 'none'
                  }}
                />
              </div>
              <span className="favorite-name">{favorite.name}</span>
            </button>
          ))}
        </div>
        <form className="favorites-search-form" onSubmit={handleSubmit}>
          <div className="favorites-search-wrapper">
            {!isFocused && !searchValue && (
              <span className="favorites-search-placeholder">Explore the cosmic web...</span>
            )}
            <input
              ref={searchInputRef}
              type="text"
              className="favorites-search-input"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onFocus={handleFocus}
              onBlur={handleBlur}
              spellCheck="false"
            />
          </div>
        </form>
      </div>
    </div>
  )
}

export default Favorites
