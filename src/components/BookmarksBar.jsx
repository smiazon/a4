import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import ContextMenu from './ContextMenu'
import { getFaviconUrl } from '../utils/favicon'
import { hostOf } from '../utils/url'
import { TAB_DRAG_TYPE, addBookmark, addFolder, childrenOf, isFolder, moveItem, removeItem, updateItem } from '../utils/bookmarks'
import './BookmarksBar.css'

const DRAG_TYPE = 'application/x-a4-bookmark'

const FolderIcon = ({ open }) => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
    <path d={open ? 'M1.8 5V12.4C1.8 13 2.2 13.4 2.8 13.4H12.6L14.4 7.6H4L2.6 12' : 'M1.8 4.2C1.8 3.6 2.2 3.2 2.8 3.2H6L7.4 4.6H13.2C13.8 4.6 14.2 5 14.2 5.6V12.4C14.2 13 13.8 13.4 13.2 13.4H2.8C2.2 13.4 1.8 13 1.8 12.4V4.2Z'} stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
    {open && <path d="M1.8 5V4.2C1.8 3.6 2.2 3.2 2.8 3.2H6L7.4 4.6H12.2" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />}
  </svg>
)

const Favicon = ({ url }) => {
  const [failed, setFailed] = useState(false)
  if (failed) {
    return (
      <svg className="bm-favicon" width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
        <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.1" />
        <path d="M2 8H14M8 2C9.6 3.8 10.2 5.8 10.2 8S9.6 12.2 8 14M8 2C6.4 3.8 5.8 5.8 5.8 8S6.4 12.2 8 14" stroke="currentColor" strokeWidth="1.1" />
      </svg>
    )
  }
  return <img className="bm-favicon" src={getFaviconUrl(url)} alt="" onError={() => setFailed(true)} draggable="false" />
}

const LINK_TYPES = [TAB_DRAG_TYPE, 'text/uri-list', 'text/plain']

// A tab, or a link dragged in from a web page (or anywhere): { url, title }
function droppedLink(dataTransfer) {
  const tab = dataTransfer.getData(TAB_DRAG_TYPE)
  if (tab) {
    const { url, title } = JSON.parse(tab)
    return { url, title: title || hostOf(url) }
  }
  const uri = (dataTransfer.getData('text/uri-list') || '').split('\n').find(l => l && !l.startsWith('#'))
  const plain = dataTransfer.getData('text/plain')
  const url = (uri || plain || '').trim()
  if (!/^https?:\/\//i.test(url)) return null
  const html = dataTransfer.getData('text/html')
  const text = html ? html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : ''
  return { url, title: text && text !== url ? text.slice(0, 80) : hostOf(url) }
}

function BookmarksBar({ items, onChange, onOpen, onHide }) {
  const [openFolder, setOpenFolder] = useState(null) // { id, x, y }
  const [overflowOpen, setOverflowOpen] = useState(null) // { x, y }
  const [editingId, setEditingId] = useState(null)
  const [drop, setDrop] = useState(null) // { id, mode: 'before' | 'into' | 'end' }
  const [menu, setMenu] = useState(null) // { x, y, item }
  const [hidden, setHidden] = useState([]) // root ids that don't fit
  const rowRef = useRef(null)
  const draggedRef = useRef(null)

  const root = childrenOf(items, null)

  // Which chips overflow the row (they go into the » menu)
  useLayoutEffect(() => {
    const row = rowRef.current
    if (!row) return
    const measure = () => {
      const chips = [...row.querySelectorAll('[data-bm-id]')]
      const top = chips[0]?.offsetTop ?? 0
      setHidden(chips.filter(c => c.offsetTop > top + 4).map(c => c.dataset.bmId))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(row)
    return () => ro.disconnect()
  }, [items, editingId])

  // Close popovers on outside click, Escape, or clicking into a page
  useEffect(() => {
    if (!openFolder && !overflowOpen) return
    const close = () => {
      setOpenFolder(null)
      setOverflowOpen(null)
    }
    const onDown = (e) => { if (!e.target.closest('.bm-popover, .bm-chip-folder, .bm-more')) close() }
    const onKey = (e) => { if (e.key === 'Escape') close() }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    window.addEventListener('blur', close)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('blur', close)
    }
  }, [openFolder, overflowOpen])

  const open = (e, url) => {
    onOpen(url, { newTab: e.metaKey || e.ctrlKey || e.button === 1 })
    setOpenFolder(null)
    setOverflowOpen(null)
  }

  const popoverAt = (el) => {
    const r = el.getBoundingClientRect()
    return { x: Math.min(r.left, window.innerWidth - 290), y: r.bottom + 6 }
  }

  const newFolder = () => {
    const { list, folder } = addFolder(items)
    onChange(list)
    setEditingId(folder.id)
  }

  // ---- Drag & drop ----
  const dragStart = (e, item) => {
    draggedRef.current = item.id
    e.dataTransfer.setData(DRAG_TYPE, item.id)
    if (!isFolder(item)) {
      e.dataTransfer.setData('text/uri-list', item.url)
      e.dataTransfer.setData('text/plain', item.url)
    }
    e.dataTransfer.effectAllowed = 'move'
  }

  const dragOver = (e, target, mode) => {
    const internal = e.dataTransfer.types.includes(DRAG_TYPE)
    const external = LINK_TYPES.some(type => e.dataTransfer.types.includes(type))
    if (!internal && !external) return
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = internal ? 'move' : 'copy'
    const dragged = items.find(i => i.id === draggedRef.current)
    // Folders can't go inside folders: treat as "before"
    const effective = mode === 'into' && internal && isFolder(dragged) ? 'before' : mode
    setDrop({ id: target?.id || null, mode: effective })
  }

  const dropOn = (e, target, mode) => {
    e.preventDefault()
    e.stopPropagation()
    const id = e.dataTransfer.getData(DRAG_TYPE)
    const effective = drop?.mode || mode
    setDrop(null)
    draggedRef.current = null
    const placement = effective === 'into'
      ? { parent: target.id }
      : { parent: target ? target.parent ?? null : null, beforeId: effective === 'before' ? target?.id : null }
    if (id) {
      onChange(moveItem(items, id, placement))
      return
    }
    const link = droppedLink(e.dataTransfer)
    if (!link) return
    const added = addBookmark(items, { ...link, parent: placement.parent })
    const newOne = added[added.length - 1]
    onChange(placement.beforeId ? moveItem(added, newOne.id, placement) : added)
  }

  // ---- Context menus ----
  const menuFor = (item) => {
    if (!item) {
      return [
        { label: 'New folder', action: newFolder },
        { type: 'separator' },
        { label: 'Hide bookmarks bar', action: onHide },
      ]
    }
    if (isFolder(item)) {
      const kids = childrenOf(items, item.id)
      return [
        { label: `Open all (${kids.length})`, action: () => kids.forEach(k => onOpen(k.url, { newTab: true, background: true })), disabled: !kids.length },
        { label: 'Rename', action: () => setEditingId(item.id) },
        { type: 'separator' },
        { label: kids.length ? `Delete folder and ${kids.length} bookmark${kids.length > 1 ? 's' : ''}` : 'Delete folder', action: () => onChange(removeItem(items, item.id)) },
      ]
    }
    return [
      { label: 'Open in new tab', action: () => onOpen(item.url, { newTab: true }) },
      { label: 'Rename', action: () => setEditingId(item.id) },
      ...(item.parent ? [{ label: 'Move to bookmarks bar', action: () => onChange(moveItem(items, item.id, { parent: null })) }] : []),
      { type: 'separator' },
      { label: 'Delete', action: () => onChange(removeItem(items, item.id)) },
    ]
  }

  const showMenu = (e, item) => {
    e.preventDefault()
    e.stopPropagation()
    setMenu({ x: e.clientX, y: e.clientY, item })
  }

  // ---- Rendering ----
  const renameInput = (item) => (
    <input
      className="bm-rename"
      autoFocus
      defaultValue={item.title}
      onFocus={(e) => e.target.select()}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.target.blur()
        if (e.key === 'Escape') setEditingId(null)
      }}
      onBlur={(e) => {
        const title = e.target.value.trim()
        if (title && editingId === item.id) onChange(updateItem(items, item.id, { title }))
        setEditingId(null)
      }}
    />
  )

  const chip = (item) => {
    const folder = isFolder(item)
    const dropClass = drop?.id === item.id ? ` is-drop-${drop.mode}` : ''
    const isOpen = openFolder?.id === item.id
    return (
      <button
        key={item.id}
        type="button"
        data-bm-id={item.id}
        className={`bm-chip${folder ? ' bm-chip-folder' : ''}${isOpen ? ' is-open' : ''}${dropClass}`}
        title={folder ? item.title : `${item.title}\n${item.url}`}
        draggable={editingId !== item.id}
        onDragStart={(e) => dragStart(e, item)}
        onDragEnd={() => { setDrop(null); draggedRef.current = null }}
        onDragOver={(e) => {
          if (folder) {
            const r = e.currentTarget.getBoundingClientRect()
            dragOver(e, item, e.clientX < r.left + 10 ? 'before' : 'into')
          } else {
            dragOver(e, item, 'before')
          }
        }}
        onDragLeave={() => setDrop(null)}
        onDrop={(e) => dropOn(e, item, folder ? 'into' : 'before')}
        onClick={(e) => {
          if (editingId === item.id) return
          if (folder) setOpenFolder(isOpen ? null : { id: item.id, ...popoverAt(e.currentTarget) })
          else open(e, item.url)
        }}
        onAuxClick={(e) => { if (!folder && e.button === 1) open(e, item.url) }}
        onContextMenu={(e) => showMenu(e, item)}
      >
        {folder ? <FolderIcon open={isOpen} /> : <Favicon url={item.url} />}
        {editingId === item.id ? renameInput(item) : <span className="bm-title">{item.title}</span>}
        {folder && <span className="bm-count">{childrenOf(items, item.id).length}</span>}
      </button>
    )
  }

  const listRow = (item) => (
    <button
      key={item.id}
      type="button"
      className="bm-pop-item"
      draggable
      onDragStart={(e) => dragStart(e, item)}
      onClick={(e) => (isFolder(item) ? setOpenFolder({ id: item.id, ...popoverAt(e.currentTarget) }) : open(e, item.url))}
      onAuxClick={(e) => { if (!isFolder(item) && e.button === 1) open(e, item.url) }}
      onContextMenu={(e) => showMenu(e, item)}
      title={isFolder(item) ? item.title : item.url}
    >
      {isFolder(item) ? <FolderIcon /> : <Favicon url={item.url} />}
      <span className="bm-pop-title">{item.title}</span>
      {!isFolder(item) && <span className="bm-pop-host">{hostOf(item.url)}</span>}
    </button>
  )

  const folderItem = openFolder && items.find(i => i.id === openFolder.id)
  const folderKids = folderItem ? childrenOf(items, folderItem.id) : []

  return (
    <div
      className={`bookmarks-bar${drop?.mode === 'end' ? ' is-drop-end' : ''}`}
      onContextMenu={(e) => showMenu(e, null)}
      onDragOver={(e) => dragOver(e, null, 'end')}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setDrop(null) }}
      onDrop={(e) => dropOn(e, null, 'end')}
    >
      <div className="bm-row" ref={rowRef}>
        {root.map(chip)}
      </div>
      {hidden.length > 0 && (
        <button
          type="button"
          className="bm-more"
          title="More bookmarks"
          onClick={(e) => setOverflowOpen(overflowOpen ? null : popoverAt(e.currentTarget))}
        >
          »
        </button>
      )}
      <button type="button" className="bm-add" title="New folder" aria-label="New folder" onClick={newFolder}>
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path d="M1.8 4.2C1.8 3.6 2.2 3.2 2.8 3.2H6L7.4 4.6H13.2C13.8 4.6 14.2 5 14.2 5.6V12.4C14.2 13 13.8 13.4 13.2 13.4H2.8C2.2 13.4 1.8 13 1.8 12.4V4.2Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
          <path d="M8 7V11M6 9H10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      </button>

      {folderItem && (
        <div
          className="bm-popover"
          style={{ left: openFolder.x, top: openFolder.y }}
          onDragOver={(e) => dragOver(e, folderItem, 'into')}
          onDrop={(e) => dropOn(e, folderItem, 'into')}
        >
          <div className="bm-pop-head">
            <FolderIcon open />
            <span>{folderItem.title}</span>
          </div>
          {folderKids.length === 0
            ? <p className="bm-pop-empty">Drag bookmarks here</p>
            : folderKids.map(listRow)}
          {folderKids.length > 1 && (
            <button
              type="button"
              className="bm-pop-all"
              onClick={() => {
                folderKids.forEach(k => onOpen(k.url, { newTab: true, background: true }))
                setOpenFolder(null)
              }}
            >
              Open all {folderKids.length} in tabs
            </button>
          )}
        </div>
      )}

      {overflowOpen && (
        <div className="bm-popover" style={{ left: overflowOpen.x - 200, top: overflowOpen.y }}>
          {root.filter(i => hidden.includes(i.id)).map(listRow)}
        </div>
      )}

      {menu && (
        <ContextMenu items={menuFor(menu.item)} position={{ x: menu.x, y: menu.y }} onClose={() => setMenu(null)} />
      )}
    </div>
  )
}

export default BookmarksBar
