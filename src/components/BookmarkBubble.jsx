import { useEffect, useRef, useState } from 'react'
import { addFolder, folders, updateItem } from '../utils/bookmarks'
import './BookmarksBar.css'

// The card under ★: name the bookmark and pick where it lives, in one glance
function BookmarkBubble({ bookmark, items, isNew, onChange, onRemove, onClose }) {
  const ref = useRef(null)
  const [title, setTitle] = useState(bookmark.title)
  const [naming, setNaming] = useState(false) // naming a new folder

  useEffect(() => {
    const onDown = (e) => { if (!ref.current?.contains(e.target) && !e.target.closest('.address-bar-star')) onClose() }
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    window.addEventListener('blur', onClose)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('blur', onClose)
    }
  }, [onClose])

  const saveTitle = () => {
    const next = title.trim()
    if (next && next !== bookmark.title) onChange(updateItem(items, bookmark.id, { title: next }))
  }

  const moveTo = (parent) => onChange(updateItem(items, bookmark.id, { parent, title: title.trim() || bookmark.title }))

  const createFolder = (name) => {
    const { list, folder } = addFolder(items, name)
    onChange(updateItem(list, bookmark.id, { parent: folder.id, title: title.trim() || bookmark.title }))
    setNaming(false)
  }

  const current = bookmark.parent ?? null

  return (
    <div className="bm-bubble" ref={ref} role="dialog" aria-label="Bookmark">
      <div className="bm-bubble-head">
        <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
          <path d="M8 1.8L9.9 5.7L14.2 6.3L11.1 9.3L11.8 13.6L8 11.6L4.2 13.6L4.9 9.3L1.8 6.3L6.1 5.7L8 1.8Z" />
        </svg>
        <span>{isNew ? 'Bookmarked' : 'Edit bookmark'}</span>
      </div>

      <label className="field bm-bubble-name">
        <input
          autoFocus
          value={title}
          onFocus={(e) => e.target.select()}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={saveTitle}
          onKeyDown={(e) => { if (e.key === 'Enter') { saveTitle(); onClose() } }}
          aria-label="Bookmark name"
        />
      </label>

      <div className="bm-bubble-label">Save to</div>
      <div className="bm-bubble-folders">
        <button type="button" className={`bm-folder-chip${current === null ? ' is-on' : ''}`} onClick={() => moveTo(null)}>
          Bookmarks bar
        </button>
        {folders(items).map(f => (
          <button key={f.id} type="button" className={`bm-folder-chip${current === f.id ? ' is-on' : ''}`} onClick={() => moveTo(f.id)}>
            {f.title}
          </button>
        ))}
        {naming ? (
          <input
            className="bm-folder-new"
            autoFocus
            placeholder="Folder name"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.target.value.trim()) createFolder(e.target.value.trim())
              if (e.key === 'Escape') { e.stopPropagation(); setNaming(false) }
            }}
            onBlur={(e) => (e.target.value.trim() ? createFolder(e.target.value.trim()) : setNaming(false))}
          />
        ) : (
          <button type="button" className="bm-folder-chip bm-folder-add" onClick={() => setNaming(true)}>+ New folder</button>
        )}
      </div>

      <div className="bm-bubble-actions">
        <button type="button" className="btn btn-ghost btn-danger" onClick={onRemove}>Remove</button>
        <button type="button" className="btn btn-primary" onClick={() => { saveTitle(); onClose() }}>Done</button>
      </div>
    </div>
  )
}

export default BookmarkBubble
