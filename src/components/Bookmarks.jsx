import { useState, useMemo } from 'react'
import ConfirmButton from './ConfirmButton'
import { SearchField, RemoveButton } from './PageParts'
import { getFaviconUrl } from '../utils/favicon'
import { hostOf } from '../utils/url'
import { shortcut } from '../utils/env'
import { childrenOf, folders, isFolder, moveItem, removeItem } from '../utils/bookmarks'
import './Page.css'

const BOOKMARKS_PAGE_URL = 'a4://bookmarks'

function Bookmarks({ entries = [], onChange, onNavigate, onDeleteEntry, onClearBookmarks }) {
  const [search, setSearch] = useState('')
  const allFolders = folders(entries)
  const bookmarkCount = entries.filter(e => !isFolder(e)).length

  // Sections: the bar itself, then each folder
  const sections = useMemo(() => {
    const q = search.trim().toLowerCase()
    const match = (e) => !q || e.title?.toLowerCase().includes(q) || e.url?.toLowerCase().includes(q)
    const bar = { id: null, title: 'Bookmarks bar', items: childrenOf(entries, null).filter(e => !isFolder(e) && match(e)) }
    const rest = folders(entries).map(f => ({ id: f.id, title: f.title, items: childrenOf(entries, f.id).filter(match) }))
    return [bar, ...rest].filter(s => s.items.length || (!q && s.id))
  }, [entries, search])

  return (
    <div className="page">
      <div className="page-inner">
        <header className="page-header">
          <div>
            <h1 className="page-title">Bookmarks</h1>
            <p className="page-subtitle">
              {bookmarkCount
                ? `${bookmarkCount} saved${allFolders.length ? ` · ${allFolders.length} folder${allFolders.length > 1 ? 's' : ''}` : ''} · ${shortcut('⌘D', 'Ctrl+D')} to add · ${shortcut('⇧⌘B', 'Ctrl+Shift+B')} shows the bar`
                : `Press ${shortcut('⌘D', 'Ctrl+D')} or the star in the address bar to save a page`}
            </p>
          </div>
          <div className="page-actions">
            <ConfirmButton onConfirm={onClearBookmarks} disabled={!entries.length} confirmLabel="Delete all?">Clear</ConfirmButton>
          </div>
        </header>

        {entries.length > 0 && (
          <div className="page-toolbar">
            <SearchField value={search} onChange={setSearch} placeholder="Search bookmarks" />
          </div>
        )}

        {sections.length === 0 ? (
          <div className="empty">
            <div className="empty-glyph">
              <svg width="24" height="24" viewBox="0 0 16 16" fill="none" aria-hidden>
                <path d="M4.5 2.5H11.5V13.5L8 11L4.5 13.5V2.5Z" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" />
              </svg>
            </div>
            <h2 className="empty-title">{search ? 'Nothing found' : 'No bookmarks yet'}</h2>
            <p className="empty-text">{search ? 'Try a different word.' : 'Save the pages you love and they’ll wait for you on the bookmarks bar.'}</p>
          </div>
        ) : sections.map(section => (
          <section key={section.id || 'bar'} className="page-section">
            <h2 className="group-title is-sticky">
              {section.title}
              <span className="group-title-count">{section.items.length}</span>
              {section.id && (
                <span className="group-title-action">
                  <ConfirmButton
                    className="btn-ghost"
                    onConfirm={() => onChange(removeItem(entries, section.id))}
                    confirmLabel={section.items.length ? `Delete with ${section.items.length}?` : 'Delete?'}
                  >
                    Delete folder
                  </ConfirmButton>
                </span>
              )}
            </h2>
            <div className="group">
              {section.items.length === 0 && <div className="row"><span className="row-sub">Empty — drag bookmarks onto this folder in the bar</span></div>}
              {section.items.map((entry) => (
                <button key={entry.id} type="button" className="row has-icon" onClick={() => onNavigate(entry.url)} title={entry.url}>
                  <span className="row-icon"><img src={getFaviconUrl(entry.url)} alt="" onError={(e) => { e.target.style.visibility = 'hidden' }} /></span>
                  <span className="row-main">
                    <span className="row-title">{entry.title || entry.url}</span>
                    <span className="row-sub">{hostOf(entry.url)}</span>
                  </span>
                  <span className="row-trailing" onClick={(e) => e.stopPropagation()}>
                    {allFolders.length > 0 && (
                      <select
                        className="bookmarks-move"
                        value={entry.parent ?? ''}
                        onChange={(e) => onChange(moveItem(entries, entry.id, { parent: e.target.value || null }))}
                        aria-label="Move to folder"
                        title="Move to folder"
                      >
                        <option value="">Bookmarks bar</option>
                        {allFolders.map(f => <option key={f.id} value={f.id}>{f.title}</option>)}
                      </select>
                    )}
                    <RemoveButton label="Remove bookmark" onClick={() => onDeleteEntry(entry)} />
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

export default Bookmarks
export { BOOKMARKS_PAGE_URL }
