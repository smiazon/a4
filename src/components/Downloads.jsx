import { useEffect, useState } from 'react'
import { SearchField, RemoveButton } from './PageParts'
import { hostOf } from '../utils/url'
import { shortcut } from '../utils/env'
import './Page.css'
import './Downloads.css'

const DOWNLOADS_PAGE_URL = 'a4://downloads'

export function formatBytes(bytes) {
  if (!bytes || bytes < 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  return `${value < 10 && unit > 0 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`
}

const formatDuration = (seconds) => {
  if (!isFinite(seconds) || seconds <= 0) return ''
  if (seconds < 60) return `${Math.ceil(seconds)}s left`
  if (seconds < 3600) return `${Math.ceil(seconds / 60)} min left`
  return `${(seconds / 3600).toFixed(1)} h left`
}

function describeStatus(item) {
  switch (item.state) {
    case 'progressing': {
      const of = item.totalBytes ? ` of ${formatBytes(item.totalBytes)}` : ''
      if (item.paused) return `Paused · ${formatBytes(item.receivedBytes)}${of}`
      const speed = item.speed > 0 ? ` · ${formatBytes(item.speed)}/s` : ''
      const left = item.speed > 0 && item.totalBytes ? ` · ${formatDuration((item.totalBytes - item.receivedBytes) / item.speed)}` : ''
      return `${formatBytes(item.receivedBytes)}${of}${speed}${left}`
    }
    case 'completed':
      return formatBytes(item.totalBytes || item.receivedBytes)
    case 'cancelled':
      return 'Cancelled'
    case 'interrupted':
      return 'Failed — network or server problem'
    default:
      return ''
  }
}

const FILTERS = {
  all: { label: 'All', test: () => true },
  active: { label: 'Active', test: (i) => i.state === 'progressing' },
  done: { label: 'Done', test: (i) => i.state === 'completed' },
  failed: { label: 'Failed', test: (i) => i.state === 'cancelled' || i.state === 'interrupted' },
}

const extensionOf = (name = '') => (name.includes('.') ? name.split('.').pop().slice(0, 4).toUpperCase() : 'FILE')
const shortPath = (path = '') => path.replace(/^\/Users\/[^/]+/, '~')

// Download list page (a4://downloads). Items come from BrowserWindow, which
// listens for downloads even while this page isn't open.
function Downloads({ items = [], onClearAll, onRemove, onOpenSettings }) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [prefs, setPrefs] = useState(null)
  const api = typeof window !== 'undefined' ? window.electronAPI : null

  useEffect(() => {
    api?.getDownloadPrefs?.().then(setPrefs).catch(() => {})
  }, [])

  const q = search.trim().toLowerCase()
  const filtered = items.filter(item =>
    FILTERS[filter].test(item) && (!q || item.name?.toLowerCase().includes(q) || item.url?.toLowerCase().includes(q)))
  const totalBytes = items.filter(i => i.state === 'completed').reduce((n, i) => n + (i.totalBytes || i.receivedBytes || 0), 0)
  const finished = items.some(i => i.state !== 'progressing')

  return (
    <div className="page">
      <div className="page-inner">
        <header className="page-header">
          <div>
            <h1 className="page-title">Downloads</h1>
            <p className="page-subtitle">
              {items.length ? `${items.length} ${items.length === 1 ? 'file' : 'files'} · ${formatBytes(totalBytes)} saved` : 'Nothing downloaded in this window yet'}
              {prefs && <> · <button type="button" className="link-btn" onClick={onOpenSettings}>{prefs.askWhereToSave ? 'asks where to save' : shortPath(prefs.downloadDir)}</button></>}
            </p>
          </div>
          <div className="page-actions">
            <button type="button" className="btn" onClick={() => api?.openPath?.('downloads')}>Open folder</button>
          </div>
        </header>

        {items.length > 0 && (
          <div className="page-toolbar">
            <SearchField value={search} onChange={setSearch} placeholder="Search downloads" />
            <div className="segmented" role="group" aria-label="Filter">
              {Object.entries(FILTERS).map(([id, f]) => (
                <button key={id} type="button" aria-pressed={filter === id} onClick={() => setFilter(id)}>{f.label}</button>
              ))}
            </div>
          </div>
        )}

        {filtered.length === 0 ? (
          <div className="empty">
            <div className="empty-glyph">
              <svg width="24" height="24" viewBox="0 0 16 16" fill="none" aria-hidden>
                <path d="M8 2.5V10M8 10L5 7M8 10L11 7" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M3 13H13" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
              </svg>
            </div>
            <h2 className="empty-title">{items.length ? 'Nothing here' : 'No downloads yet'}</h2>
            <p className="empty-text">
              {items.length ? 'Try another filter or search.' : `Files you download appear here with their progress. ${shortcut('⌥⌘L', 'Ctrl+J')} opens this page.`}
            </p>
          </div>
        ) : (
          <>
            <div className="group">
              {filtered.map((item) => {
                const done = item.state === 'completed'
                const failed = item.state === 'cancelled' || item.state === 'interrupted'
                const active = item.state === 'progressing'
                const progress = active && item.totalBytes ? Math.min(100, (item.receivedBytes / item.totalBytes) * 100) : null
                return (
                  <div
                    key={item.id}
                    className={`row has-icon download-row${done ? ' is-link' : ''}${failed ? ' is-failed' : ''}${item.paused ? ' is-paused' : ''}`}
                    onClick={() => done && api?.openFile?.(item.savePath)}
                    title={done ? 'Open file' : undefined}
                  >
                    <span className="download-badge">{extensionOf(item.name)}</span>
                    <span className="row-main">
                      <span className="row-title download-name">{item.name || 'Unnamed file'}</span>
                      {progress !== null && <span className="download-progress"><span style={{ width: `${progress}%` }} /></span>}
                      <span className="row-sub">{describeStatus(item)} · {hostOf(item.url)}</span>
                    </span>
                    <span className="row-trailing download-actions" onClick={(e) => e.stopPropagation()}>
                      {active && (
                        <>
                          <button type="button" className="btn btn-ghost" onClick={() => api?.togglePauseDownload?.(item.id)}>{item.paused ? 'Resume' : 'Pause'}</button>
                          <button type="button" className="btn btn-ghost" onClick={() => api?.cancelDownload?.(item.id)}>Cancel</button>
                        </>
                      )}
                      {done && (
                        <button type="button" className="btn btn-ghost" onClick={() => api?.showItemInFolder?.(item.savePath)}>{shortcut('Show in Finder', 'Show in folder')}</button>
                      )}
                      {failed && item.url && !item.url.startsWith('blob:') && (
                        <button type="button" className="btn btn-ghost" onClick={() => api?.downloadURL?.(item.url)}>Retry</button>
                      )}
                      {!active && <RemoveButton label="Remove from list" onClick={() => onRemove?.(item.id)} />}
                    </span>
                  </div>
                )
              })}
            </div>
            {finished && (
              <div className="downloads-footer">
                <button type="button" className="btn btn-ghost" onClick={onClearAll}>Clear finished</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// Toolbar button that appears once something has been downloaded (like Chrome's
// download bubble). Shows a progress ring while downloads are running.
export function DownloadsButton({ items = [], onClick }) {
  if (!items.length) return null
  const active = items.filter(i => i.state === 'progressing')
  const total = active.reduce((n, i) => n + (i.totalBytes || 0), 0)
  const received = active.reduce((n, i) => n + (i.receivedBytes || 0), 0)
  const progress = active.length && total ? received / total : active.length ? 0.25 : 1
  const circumference = 2 * Math.PI * 10

  return (
    <button
      type="button"
      className={`icon-btn downloads-toolbar-button${active.length ? ' is-active' : ''}`}
      onClick={onClick}
      aria-label="Downloads"
      title={active.length ? `${active.length} download${active.length > 1 ? 's' : ''} in progress` : 'Downloads'}
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
        {active.length > 0 && (
          <circle
            cx="12" cy="12" r="10"
            stroke="currentColor" strokeWidth="1.5"
            strokeDasharray={`${circumference * progress} ${circumference}`}
            transform="rotate(-90 12 12)"
            className="downloads-toolbar-ring"
          />
        )}
        <path d="M12 7V15M12 15L9 12M12 15L15 12M8 17.5H16" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  )
}

export default Downloads
export { DOWNLOADS_PAGE_URL }
