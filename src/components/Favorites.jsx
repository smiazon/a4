import { useState } from 'react'
import { toNavigableUrl } from '../utils/url'
import { shortcut } from '../utils/env'
import './Favorites.css'

export const FAVORITES = [
  { name: 'Google', url: 'https://www.google.com', icon: 'https://www.google.com/s2/favicons?domain=google.com&sz=64' },
  { name: 'YouTube', url: 'https://www.youtube.com', icon: 'https://www.google.com/s2/favicons?domain=youtube.com&sz=64' },
  { name: 'Wikipedia', url: 'https://www.wikipedia.org', icon: 'https://www.google.com/s2/favicons?domain=wikipedia.org&sz=64' },
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
  const dayOfYear = Math.floor((now - start) / (1000 * 60 * 60 * 24))
  return dailyQuotes[dayOfYear % dailyQuotes.length]
}

// New-tab page in "Classic" mode: the A4 mark, a daily line, shortcuts and search
function Favorites({ onNavigate, focusMode, onToggleFocus, account }) {
  const [searchValue, setSearchValue] = useState('')
  const [dailyQuote] = useState(getDailyQuote)

  const handleSubmit = (e) => {
    e.preventDefault()
    const navigateUrl = toNavigableUrl(searchValue)
    if (navigateUrl) onNavigate(navigateUrl)
  }

  return (
    <div className="classic-home">
      {account}
      <div className="classic-content">
        <div className="classic-mark" aria-hidden="true">A4</div>
        <h1 className="classic-quote">{dailyQuote}</h1>
        <div className="classic-search-halo rainbow-glow">
        <form className="classic-search rainbow" onSubmit={handleSubmit}>
          <svg width="17" height="17" viewBox="0 0 16 16" fill="none" aria-hidden>
            <circle cx="7" cy="7" r="4.6" stroke="currentColor" strokeWidth="1.4" />
            <path d="M10.6 10.6L14 14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            placeholder="Explore the cosmic web..."
            spellCheck="false"
            autoFocus
            aria-label="Search or enter address"
          />
        </form>
        </div>
        <div className="classic-grid">
          {FAVORITES.map((favorite) => (
            <button key={favorite.url} className="classic-tile" onClick={() => onNavigate(favorite.url)}>
              <span className="classic-tile-icon">
                <img src={favorite.icon} alt="" onError={(e) => { e.target.style.visibility = 'hidden' }} />
              </span>
              <span className="classic-tile-name">{favorite.name}</span>
            </button>
          ))}
        </div>
      </div>
      <button
        type="button"
        className={`classic-focus${focusMode ? ' is-on' : ''}`}
        onClick={onToggleFocus}
        aria-pressed={focusMode}
        aria-label={focusMode ? 'Leave focus mode' : 'Focus mode'}
        title={`${focusMode ? 'Leave' : 'Enter'} focus mode (${shortcut('⇧⌘F', 'Ctrl+Shift+F')})`}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
          <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.4" />
          <circle cx="8" cy="8" r="2" fill="currentColor" />
        </svg>
      </button>
    </div>
  )
}

export default Favorites
