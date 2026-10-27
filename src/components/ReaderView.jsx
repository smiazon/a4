import { useEffect, useState } from 'react'
import './ReaderView.css'

/**
 * Runs inside the web page (via executeJavaScript) and returns the main
 * article as plain-text blocks. Must stay self-contained: it is stringified.
 */
export function extractArticle() {
  const textLength = (el) => [...el.querySelectorAll('p')].reduce((n, p) => n + p.innerText.trim().length, 0)

  // Prefer semantic containers; otherwise the element holding the most paragraph text
  let root = null
  let best = 0
  for (const el of document.querySelectorAll('article, main, [role="main"], .post-content, .entry-content, .article-body, #content')) {
    const score = textLength(el)
    if (score > best) { root = el; best = score }
  }
  if (!root || best < 500) {
    const parents = new Map()
    for (const p of document.querySelectorAll('p')) {
      const len = p.innerText.trim().length
      if (len >= 40) parents.set(p.parentElement, (parents.get(p.parentElement) || 0) + len)
    }
    for (const [el, score] of parents) {
      if (score > best) { root = el; best = score }
    }
  }
  root = root || document.body

  const SKIP = /^(SCRIPT|STYLE|NOSCRIPT|NAV|ASIDE|FOOTER|FORM|BUTTON|SVG|IFRAME|FIGURE|TEMPLATE)$/
  const blocks = []
  const walk = (el) => {
    for (const node of el.children) {
      const tag = node.tagName.toUpperCase()
      if (SKIP.test(tag)) continue
      const style = getComputedStyle(node)
      if (style.display === 'none' || style.visibility === 'hidden') continue
      const text = () => node.innerText.replace(/\s+/g, ' ').trim()
      if (/^H[1-6]$/.test(tag)) {
        if (text()) blocks.push({ type: tag === 'H1' || tag === 'H2' ? 'h2' : 'h3', text: text() })
      } else if (tag === 'P') {
        if (text().length > 1) blocks.push({ type: 'p', text: text() })
      } else if (tag === 'BLOCKQUOTE') {
        if (text()) blocks.push({ type: 'quote', text: text() })
      } else if (tag === 'PRE') {
        blocks.push({ type: 'pre', text: node.innerText })
      } else if (tag === 'UL' || tag === 'OL') {
        const items = [...node.children]
          .filter(li => li.tagName === 'LI')
          .map(li => li.innerText.replace(/\s+/g, ' ').trim())
          .filter(Boolean)
        if (items.length) blocks.push({ type: tag === 'OL' ? 'ol' : 'ul', items })
      } else {
        walk(node)
      }
    }
  }
  walk(root)

  const title = (document.querySelector('h1')?.innerText || document.title || '').trim()
  if (blocks[0] && blocks[0].text === title) blocks.shift()
  return {
    title,
    site: location.hostname.replace(/^www\./, ''),
    blocks: blocks.slice(0, 500),
  }
}

const SIZE_KEY = 'a4-reader-size'
const SIZES = [17, 18, 20, 22, 24, 27]

// Distraction-free view of the extracted article, in the app's book typography
function ReaderView({ article, onClose }) {
  // Kindle-style text size, remembered between articles
  const [sizeIndex, setSizeIndex] = useState(() => {
    const saved = Number(window.localStorage?.getItem(SIZE_KEY))
    return SIZES.includes(saved) ? SIZES.indexOf(saved) : 2
  })
  const changeSize = (delta) => {
    const next = Math.min(SIZES.length - 1, Math.max(0, sizeIndex + delta))
    setSizeIndex(next)
    try { window.localStorage.setItem(SIZE_KEY, String(SIZES[next])) } catch (_) {}
  }

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const words = article.blocks.reduce((n, b) => n + (b.text || b.items?.join(' ') || '').split(/\s+/).length, 0)
  const minutes = Math.max(1, Math.round(words / 230))
  const tooShort = article.blocks.filter(b => b.type === 'p').length < 2

  return (
    <div className="reader-view">
      <div className="reader-toolbar glass">
        <span className="reader-site">{article.site}</span>
        <div className="reader-size" role="group" aria-label="Text size">
          <button type="button" onClick={() => changeSize(-1)} disabled={sizeIndex === 0} aria-label="Smaller text">A</button>
          <button type="button" onClick={() => changeSize(1)} disabled={sizeIndex === SIZES.length - 1} aria-label="Larger text">A</button>
        </div>
        <button type="button" className="reader-close" onClick={onClose} title="Exit reading mode (Esc)">
          Done
        </button>
      </div>
      <article className="reader-article" style={{ fontSize: SIZES[sizeIndex] }}>
        <h1 className="reader-title">{article.title}</h1>
        {!tooShort && <p className="reader-meta">{minutes} min read</p>}
        {tooShort ? (
          <p className="reader-empty">Reading mode couldn’t find an article on this page.</p>
        ) : article.blocks.map((b, i) => {
          switch (b.type) {
            case 'h2': return <h2 key={i}>{b.text}</h2>
            case 'h3': return <h3 key={i}>{b.text}</h3>
            case 'quote': return <blockquote key={i}>{b.text}</blockquote>
            case 'pre': return <pre key={i}>{b.text}</pre>
            case 'ul': return <ul key={i}>{b.items.map((t, j) => <li key={j}>{t}</li>)}</ul>
            case 'ol': return <ol key={i}>{b.items.map((t, j) => <li key={j}>{t}</li>)}</ol>
            default: return <p key={i}>{b.text}</p>
          }
        })}
      </article>
    </div>
  )
}

export default ReaderView
