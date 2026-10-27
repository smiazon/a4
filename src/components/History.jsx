import { useState, useMemo } from 'react'
import ConfirmButton from './ConfirmButton'
import { SearchField, RemoveButton } from './PageParts'
import { getFaviconUrl } from '../utils/favicon'
import { hostOf } from '../utils/url'
import './Page.css'

const HISTORY_PAGE_URL = 'a4://history'

const HOUR = 60 * 60 * 1000
const startOfToday = () => new Date().setHours(0, 0, 0, 0)

const RANGES = {
  all: { label: 'All', since: () => 0 },
  today: { label: 'Today', since: startOfToday },
  week: { label: 'This week', since: () => startOfToday() - 6 * 24 * HOUR },
}

const formatTime = (t) => new Date(t).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })

function dayLabel(t) {
  const d = new Date(t)
  const today = startOfToday()
  if (d >= today) return 'Today'
  if (d >= today - 24 * HOUR) return 'Yesterday'
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
}

function History({ entries = [], onNavigate, onOpenInNewTab, onDeleteEntry, onClearSince }) {
  const [search, setSearch] = useState('')
  const [range, setRange] = useState('all')
  const [clearing, setClearing] = useState(false)

  // Sites you return to most, as quick filters
  const topSites = useMemo(() => {
    const counts = new Map()
    for (const e of entries) {
      const host = hostOf(e.url)
      counts.set(host, { host, url: e.url, count: (counts.get(host)?.count || 0) + 1 })
    }
    return [...counts.values()].sort((a, b) => b.count - a.count).slice(0, 6)
  }, [entries])

  const siteCount = useMemo(() => new Set(entries.map(e => hostOf(e.url))).size, [entries])

  // Newest first, filtered, grouped by day
  const groups = useMemo(() => {
    const q = search.trim().toLowerCase()
    const since = RANGES[range].since()
    const map = new Map()
    for (const entry of [...entries].reverse()) {
      if (entry.visitedAt < since) continue
      if (q && !entry.title?.toLowerCase().includes(q) && !entry.url?.toLowerCase().includes(q)) continue
      const key = dayLabel(entry.visitedAt)
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(entry)
    }
    return [...map.entries()]
  }, [entries, search, range])

  const open = (e, url) => {
    if (e.metaKey || e.ctrlKey || e.button === 1) onOpenInNewTab(url)
    else onNavigate(url)
  }

  const clearSince = (since) => {
    onClearSince(since)
    setClearing(false)
  }

  return (
    <div className="page">
      <div className="page-inner">
        <header className="page-header">
          <div>
            <h1 className="page-title">History</h1>
            <p className="page-subtitle">
              {entries.length ? `${entries.length} visits across ${siteCount} ${siteCount === 1 ? 'site' : 'sites'}` : 'Pages you visit appear here'}
            </p>
          </div>
          <div className="page-actions">
            <button type="button" className={`btn${clearing ? ' is-pressed' : ''}`} onClick={() => setClearing(c => !c)} disabled={!entries.length}>
              Clear…
            </button>
          </div>
        </header>

        {clearing && (
          <div className="page-callout">
            <span>Clear browsing history from</span>
            <div className="page-callout-actions">
              <ConfirmButton onConfirm={() => clearSince(Date.now() - HOUR)} confirmLabel="Clear last hour?">The last hour</ConfirmButton>
              <ConfirmButton onConfirm={() => clearSince(startOfToday())} confirmLabel="Clear today?">Today</ConfirmButton>
              <ConfirmButton onConfirm={() => clearSince(0)} confirmLabel="Clear everything?">All time</ConfirmButton>
            </div>
          </div>
        )}

        <div className="page-toolbar">
          <SearchField value={search} onChange={setSearch} placeholder="Search history" />
          <div className="segmented" role="group" aria-label="Time range">
            {Object.entries(RANGES).map(([id, r]) => (
              <button key={id} type="button" aria-pressed={range === id} onClick={() => setRange(id)}>{r.label}</button>
            ))}
          </div>
        </div>

        {topSites.length > 1 && !search && (
          <div className="page-chips" aria-label="Most visited">
            <span className="page-chips-label">Most visited</span>
            {topSites.map(site => (
              <button key={site.host} type="button" className="page-chip" onClick={() => setSearch(site.host)} title={`Show visits to ${site.host}`}>
                <img src={getFaviconUrl(site.url)} alt="" onError={(e) => { e.target.style.visibility = 'hidden' }} />
                <span>{site.host}</span>
                <span className="page-chip-count">{site.count}</span>
              </button>
            ))}
          </div>
        )}

        {groups.length === 0 ? (
          <div className="empty">
            <div className="empty-glyph">
              <svg width="26" height="26" viewBox="0 0 16 16" fill="none" aria-hidden>
                <circle cx="8" cy="8" r="5.8" stroke="currentColor" strokeWidth="1" />
                <path d="M8 4.8V8L10.2 9.6" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
              </svg>
            </div>
            <h2 className="empty-title">{entries.length ? 'Nothing found' : 'No history yet'}</h2>
            <p className="empty-text">{entries.length ? 'Try another word or time range.' : 'Pages you visit will be listed here, grouped by day.'}</p>
          </div>
        ) : groups.map(([label, list]) => (
          <section key={label} className="page-section">
            <h2 className="group-title is-sticky">
              {label}
              <span className="group-title-count">{list.length}</span>
            </h2>
            <div className="group">
              {list.map((entry) => (
                <button
                  key={`${entry.url}-${entry.visitedAt}`}
                  type="button"
                  className="row has-icon"
                  onClick={(e) => open(e, entry.url)}
                  onAuxClick={(e) => open(e, entry.url)}
                  title={`${entry.url}\n⌘-click to open in a new tab`}
                >
                  <span className="row-time">{formatTime(entry.visitedAt)}</span>
                  <span className="row-icon"><img src={getFaviconUrl(entry.url)} alt="" onError={(e) => { e.target.style.visibility = 'hidden' }} /></span>
                  <span className="row-main">
                    <span className="row-title">{entry.title || entry.url}</span>
                    <span className="row-sub">{hostOf(entry.url)}</span>
                  </span>
                  <span className="row-trailing">
                    <RemoveButton label="Remove from history" onClick={() => onDeleteEntry(entry)} />
                  </span>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}

export default History
export { HISTORY_PAGE_URL }
