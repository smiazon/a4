import { useEffect, useRef, useState } from 'react'
import './ContextMenu.css'

function ContextMenu({ items, position, onClose }) {
  const menuRef = useRef(null)
  const [adjustedPos, setAdjustedPos] = useState(position)

  useEffect(() => {
    const menu = menuRef.current
    if (!menu) return
    const rect = menu.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    let { x, y } = position
    if (x + rect.width > vw) x = vw - rect.width - 4
    if (y + rect.height > vh) y = vh - rect.height - 4
    if (x < 4) x = 4
    if (y < 4) y = 4
    setAdjustedPos({ x, y })
  }, [position])

  // Take focus from the web page, so clicking back into it blurs this window
  useEffect(() => {
    menuRef.current?.focus({ preventScroll: true })
  }, [])

  useEffect(() => {
    const handleDown = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) onClose()
    }
    const handleKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('mousedown', handleDown)
    document.addEventListener('keydown', handleKey)
    // Clicks inside a web page never reach this document, but they blur it
    window.addEventListener('blur', onClose)
    return () => {
      document.removeEventListener('mousedown', handleDown)
      document.removeEventListener('keydown', handleKey)
      window.removeEventListener('blur', onClose)
    }
  }, [onClose])

  return (
    <div
      className="ctx-menu glass"
      ref={menuRef}
      tabIndex={-1}
      style={{ left: adjustedPos.x, top: adjustedPos.y }}
      onContextMenu={e => e.preventDefault()}
    >
      {items.map((item, i) => {
        if (item.type === 'separator') return <div key={i} className="ctx-menu-sep" />
        return (
          <button
            key={i}
            className={`ctx-menu-item${item.disabled ? ' disabled' : ''}`}
            onClick={() => {
              if (!item.disabled) {
                item.action()
                onClose()
              }
            }}
            disabled={item.disabled}
          >
            <span className="ctx-menu-label">{item.label}</span>
            {item.shortcut && <span className="ctx-menu-shortcut">{item.shortcut}</span>}
          </button>
        )
      })}
    </div>
  )
}

export default ContextMenu
