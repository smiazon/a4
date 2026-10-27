import { useState, useEffect } from 'react'
import ConfirmButton from './ConfirmButton'
import { shortcut } from '../utils/env'
import './Page.css'
import './Extensions.css'

const PuzzleIcon = ({ size = 18, width = 1.2 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden>
    <path d="M6 2.5H9V4.2A1.3 1.3 0 1 0 11.6 4.2V4.2H13.5V7.5H11.8A1.3 1.3 0 1 0 11.8 10.1H13.5V13.5H10V11.8A1.3 1.3 0 1 0 7.4 11.8V13.5H2.5V9.5H4.2A1.3 1.3 0 1 0 4.2 6.9H2.5V2.5H6Z" stroke="currentColor" strokeWidth={width} strokeLinejoin="round" />
  </svg>
)

// "https://*.example.com/*" -> "example.com", "<all_urls>" -> "All sites"
const describePermission = (p) => {
  if (p === '<all_urls>' || p === '*://*/*') return 'All sites'
  const host = p.match(/^[a-z*]+:\/\/(?:\*\.)?([^/]+)/)
  return host ? host[1] : p
}

function Extensions() {
  const [extensions, setExtensions] = useState([])
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState(null) // { kind: 'ok' | 'error', text }
  const api = window.electronAPI

  const refresh = async () => setExtensions((await api?.getExtensions?.()) || [])

  useEffect(() => {
    refresh().catch(() => {})
  }, [])

  const add = async () => {
    if (!api?.loadExtension) {
      setStatus({ kind: 'error', text: 'Extensions need the desktop app.' })
      return
    }
    setLoading(true)
    setStatus(null)
    try {
      const result = await api.loadExtension()
      if (result?.error) setStatus({ kind: 'error', text: `Couldn’t add it: ${result.error}` })
      else if (result?.id) {
        setStatus({ kind: 'ok', text: `Added “${result.name}”. It will load every time A4 starts.` })
        await refresh()
      }
    } finally {
      setLoading(false)
    }
  }

  const act = async (fn, okText) => {
    const result = await fn()
    if (result?.error) setStatus({ kind: 'error', text: result.error })
    else if (okText) setStatus({ kind: 'ok', text: okText })
    await refresh()
  }

  return (
    <div className="page">
      <div className="page-inner">
        <header className="page-header">
          <div>
            <h1 className="page-title">Extensions</h1>
            <p className="page-subtitle">
              {extensions.length ? `${extensions.length} installed · loaded on every launch` : 'Add small powers to your browser'}
            </p>
          </div>
          <div className="page-actions">
            <button className="btn btn-primary" onClick={add} disabled={loading}>
              {loading ? 'Choosing…' : 'Add extension'}
            </button>
          </div>
        </header>

        {status && <div className={`page-banner is-${status.kind}`}>{status.text}</div>}

        {extensions.length === 0 ? (
          <>
            <div className="empty ext-empty">
              <div className="empty-glyph"><PuzzleIcon size={26} width={1} /></div>
              <h2 className="empty-title">No extensions yet</h2>
              <p className="empty-text">A4 runs Chrome extensions from a folder on your Mac.</p>
            </div>
            <h2 className="group-title">How to add one</h2>
            <ol className="group ext-steps">
              <li><span className="ext-step-n">1</span><span>Download the extension and unzip it, so you have a folder containing <code>manifest.json</code>.</span></li>
              <li><span className="ext-step-n">2</span><span>Click <strong>Add extension</strong> and choose that folder.</span></li>
              <li><span className="ext-step-n">3</span><span>It stays installed. Edit its files, then press <strong>Reload</strong> here to apply changes.</span></li>
            </ol>
            <p className="group-note">Installing straight from the Chrome Web Store isn’t supported.</p>
          </>
        ) : (
          <div className="group">
            {extensions.map(ext => (
              <div key={ext.id} className="row has-icon ext-row">
                <span className="row-icon ext-icon"><PuzzleIcon /></span>
                <span className="row-main">
                  <span className="row-title">
                    {ext.name} {ext.version && <span className="ext-version">{ext.version}</span>}
                  </span>
                  {ext.description && <span className="ext-desc">{ext.description}</span>}
                  {ext.permissions?.length > 0 && (
                    <span className="ext-perms" title={ext.permissions.join('\n')}>
                      {ext.permissions.slice(0, 4).map(p => <span key={p} className="ext-perm">{describePermission(p)}</span>)}
                      {ext.permissions.length > 4 && <span className="ext-perm">+{ext.permissions.length - 4}</span>}
                    </span>
                  )}
                </span>
                <span className="row-trailing ext-actions">
                  <button type="button" className="btn btn-ghost" onClick={() => act(() => api.reloadExtension(ext.id), `Reloaded “${ext.name}”.`)}>Reload</button>
                  <button type="button" className="btn btn-ghost" onClick={() => api.revealExtension(ext.id)}>{shortcut('Show in Finder', 'Show folder')}</button>
                  <ConfirmButton className="btn-ghost" onConfirm={() => act(() => api.removeExtension(ext.id), `Removed “${ext.name}”.`)} confirmLabel="Remove?">Remove</ConfirmButton>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default Extensions
