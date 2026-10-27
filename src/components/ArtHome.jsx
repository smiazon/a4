import { useEffect, useRef, useState } from 'react'
import { ARTWORKS } from '../utils/art'
import { toNavigableUrl } from '../utils/url'
import { shortcut } from '../utils/env'
import { FAVORITES } from './Favorites'
import './ArtHome.css'

const ART_INTERVAL_KEY = 'a4-art-interval' // set in Settings
const slideMs = () => {
  try {
    return Number(window.localStorage.getItem(ART_INTERVAL_KEY)) || 20000
  } catch (_) {
    return 20000
  }
}
const IDLE_MS = 2500

// One shuffled order shared by every new tab, so each tab opens on the next painting
const order = (() => {
  const a = ARTWORKS.map((_, i) => i)
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
})()
let cursor = 0
const takeNext = () => order[cursor++ % order.length]
let loadSeq = 0 // identifies each load, so only the latest one lands

function useClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 5000)
    return () => clearInterval(id)
  }, [])
  const time = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' })
    .formatToParts(now)
    .filter(p => p.type !== 'dayPeriod')
    .map(p => p.value)
    .join('')
    .trim()
  const date = now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
  return { time, date }
}

const Icon = {
  prev: <path d="M10 3.5L5.5 8L10 12.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />,
  next: <path d="M6 3.5L10.5 8L6 12.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />,
  pause: <path d="M5.5 3.5V12.5M10.5 3.5V12.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />,
  play: <path d="M5 3.2L12.5 8L5 12.8V3.2Z" fill="currentColor" />,
  focus: <><circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.4" /><circle cx="8" cy="8" r="2" fill="currentColor" /></>,
}
const Svg = ({ children }) => <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>{children}</svg>

/**
 * New-tab page in "Art" mode: a slow slideshow of public-domain paintings.
 * In focus mode the chrome disappears and the whole painting is shown uncropped.
 */
function ArtHome({ onNavigate, focusMode, onToggleFocus, initialArt, onArtChange, account }) {
  const [slides, setSlides] = useState([]) // last two shown, newest last: [{ key, art }]
  const [paused, setPaused] = useState(false)
  const [offline, setOffline] = useState(false)
  const [idle, setIdle] = useState(false)
  const [query, setQuery] = useState('')
  const historyRef = useRef([])   // indexes shown, for "previous"
  const loadingRef = useRef(null) // index currently being loaded
  const onArtChangeRef = useRef(onArtChange)
  onArtChangeRef.current = onArtChange
  const { time, date } = useClock()

  // Load a painting, then cross-fade it in. Skips images that fail to load.
  const show = (index, { remember = true, attempts = 0 } = {}) => {
    const token = ++loadSeq
    loadingRef.current = token
    const art = ARTWORKS[index]
    const img = new Image()
    img.decoding = 'async'
    img.onload = () => {
      if (loadingRef.current !== token) return
      if (remember) historyRef.current.push(index)
      onArtChangeRef.current?.(index)
      setOffline(false)
      setSlides(prev => [...prev.slice(-1), { key: `slide-${token}`, art }])
    }
    img.onerror = () => {
      if (loadingRef.current !== token) return
      if (attempts < 3) show(takeNext(), { remember, attempts: attempts + 1 })
      else setOffline(true)
    }
    img.src = art.src
  }

  const next = () => show(takeNext())
  const previous = () => {
    const h = historyRef.current
    if (h.length < 2) return
    h.pop()
    show(h[h.length - 1], { remember: false })
  }

  // First painting: the one this tab was showing (e.g. after Back), else the next
  useEffect(() => {
    show(Number.isInteger(initialArt) && ARTWORKS[initialArt] ? initialArt : takeNext())
    return () => { loadingRef.current = null }
  }, [])

  // Advance on a timer unless paused
  const current = slides[slides.length - 1]
  useEffect(() => {
    if (paused || !current) return
    const id = setTimeout(next, slideMs())
    return () => clearTimeout(id)
  }, [current?.key, paused])

  // Controls fade away while the mouse rests (always in focus mode)
  useEffect(() => {
    let timer
    const wake = () => {
      setIdle(false)
      clearTimeout(timer)
      timer = setTimeout(() => setIdle(true), IDLE_MS)
    }
    wake()
    window.addEventListener('mousemove', wake)
    window.addEventListener('keydown', wake)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('mousemove', wake)
      window.removeEventListener('keydown', wake)
    }
  }, [])

  // Arrow keys flip paintings unless you're typing somewhere
  useEffect(() => {
    const onKey = (e) => {
      const typing = e.target instanceof HTMLInputElement && e.target.value
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'ArrowRight') next()
      else if (e.key === 'ArrowLeft') previous()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const handleSubmit = (e) => {
    e.preventDefault()
    const url = toNavigableUrl(query)
    if (url) onNavigate(url)
  }

  const art = current?.art
  const classes = [
    'art-home',
    focusMode && 'is-focus',
    idle && 'is-idle',
    (offline || !art) && 'is-empty',
  ].filter(Boolean).join(' ')

  return (
    <div className={classes}>
      <div className="art-stage" aria-hidden>
        {slides.map((s, i) => (
          <div key={s.key} className={`art-slide${i === slides.length - 1 ? ' is-current' : ''}`}>
            <img className="art-backdrop" src={s.art.src} alt="" />
            <img className="art-image" src={s.art.src} alt="" draggable="false" />
          </div>
        ))}
        <div className="art-grain" />
        <div className="art-scrim" />
      </div>

      <div className="art-center">
        <div className="art-clock">
          <div className="art-time">{time}</div>
          <div className="art-date">{date}</div>
        </div>

        <div className="art-search-halo rainbow-glow">
        <form className="art-search glass rainbow" onSubmit={handleSubmit}>
          <svg width="17" height="17" viewBox="0 0 16 16" fill="none" aria-hidden>
            <circle cx="7" cy="7" r="4.6" stroke="currentColor" strokeWidth="1.4" />
            <path d="M10.6 10.6L14 14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search or enter address"
            spellCheck="false"
            autoFocus
            aria-label="Search or enter address"
          />
          <span className="kbd art-search-hint">return ↵</span>
        </form>
        </div>

        <div className="art-shortcuts">
          {FAVORITES.map(f => (
            <button key={f.url} type="button" className="art-shortcut glass" onClick={() => onNavigate(f.url)} title={f.url}>
              <img src={f.icon} alt="" />
              <span>{f.name}</span>
            </button>
          ))}
        </div>
      </div>

      {account}

      {/* Focus mode: a quiet gallery caption under the framed painting */}
      {art && (
        <div key={current.key} className="art-caption" aria-hidden={!focusMode}>
          <span className="art-caption-title">{art.title}</span>
          <span className="art-caption-meta">
            {art.artist}
            <span className="art-caption-rule" aria-hidden />
            {art.year}
          </span>
        </div>
      )}

      {art && (
        <button
          type="button"
          className="art-label"
          onClick={() => onNavigate(art.info)}
          title="Read about this painting on Wikipedia"
        >
          <span className="art-label-title">{art.title}</span>
          <span className="art-label-meta">{art.artist}, {art.year}</span>
        </button>
      )}

      <div className="art-dock" role="toolbar" aria-label="Slideshow">
        <button type="button" onClick={previous} aria-label="Previous painting" title="Previous (←)"><Svg>{Icon.prev}</Svg></button>
        <button type="button" onClick={() => setPaused(p => !p)} aria-label={paused ? 'Play slideshow' : 'Pause slideshow'} title={paused ? 'Play' : 'Pause'}>
          <Svg>{paused ? Icon.play : Icon.pause}</Svg>
        </button>
        <button type="button" onClick={next} aria-label="Next painting" title="Next (→)"><Svg>{Icon.next}</Svg></button>
        <span className="art-dock-sep" aria-hidden />
        <button
          type="button"
          className={`art-dock-focus${focusMode ? ' is-on' : ''}`}
          onClick={onToggleFocus}
          aria-pressed={focusMode}
          aria-label={focusMode ? 'Leave focus mode' : 'Focus mode'}
          title={`${focusMode ? 'Leave focus' : 'Focus'} (${shortcut('⇧⌘F', 'Ctrl+Shift+F')})`}
        >
          <Svg>{Icon.focus}</Svg>
        </button>
      </div>
    </div>
  )
}

export default ArtHome
