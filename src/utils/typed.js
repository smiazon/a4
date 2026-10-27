// Addresses typed into the address bar, remembered for inline completion:
// type "you" and the bar offers "youtube.com/…" the way you last entered it.
// Private windows read this but never add to it.
import { isIncognito } from './env'
import { isWebUrl } from './url'

export const TYPED_STORAGE_KEY = 'a4-typed'
const LIMIT = 300
const DAY = 24 * 60 * 60 * 1000

function read() {
  try {
    const list = JSON.parse(window.localStorage.getItem(TYPED_STORAGE_KEY))
    return Array.isArray(list) ? list : []
  } catch (_) {
    return []
  }
}

function write(list) {
  try {
    window.localStorage.setItem(TYPED_STORAGE_KEY, JSON.stringify(list))
  } catch (_) {}
}

// How an address reads when typed: "https://www.youtube.com/" -> "youtube.com"
export const bare = (text) => text
  .trim()
  .replace(/^https?:\/\//i, '')
  .replace(/^www\./i, '')
  .replace(/^([^/?#]+)\/$/, '$1')

export function rememberTyped(url) {
  if (isIncognito || !isWebUrl(url)) return
  const text = bare(url).toLowerCase()
  const list = read()
  const old = list.find(e => e.text === text)
  const entry = { text, url, count: (old?.count || 0) + 1, last: Date.now() }
  write([entry, ...list.filter(e => e !== old)].slice(0, LIMIT))
}

// The URL an address was typed as ("youtube.com" -> "https://www.youtube.com/")
export function typedUrlFor(input) {
  const text = bare(input).toLowerCase()
  return read().find(e => e.text === text)?.url || null
}

export function forgetTyped(since = 0) {
  write(since ? read().filter(e => e.last < since) : [])
}

// Used often and lately wins: each use counts less as it ages
const score = (count, last) => count / (1 + (Date.now() - last) / (7 * DAY))

// The best address starting with what's typed, as the text to show, or null.
// Falls back to sites from history the user keeps returning to.
export function completeAddress(input, history = []) {
  if (!input || /\s/.test(input)) return null
  const query = input.replace(/^https?:\/\//i, '').replace(/^www\./i, '').toLowerCase()
  if (!query) return null

  let best = null
  for (const e of read()) {
    if (e.text.length > query.length && e.text.startsWith(query)) {
      const s = score(e.count, e.last)
      if (!best || s > best.score) best = { text: e.text, score: s }
    }
  }

  if (!best && query.length >= 2) {
    const sites = new Map()
    for (const { url, visitedAt } of history) {
      if (!isWebUrl(url)) continue
      const site = bare(new URL(url).host).toLowerCase()
      if (site.length <= query.length || !site.startsWith(query)) continue
      const seen = sites.get(site) || { count: 0, last: 0 }
      sites.set(site, { count: seen.count + 1, last: Math.max(seen.last, visitedAt) })
    }
    for (const [site, { count, last }] of sites) {
      const s = score(count, last)
      if (count >= 2 && (!best || s > best.score)) best = { text: site, score: s }
    }
  }

  // Keep exactly what was typed ("www.", "https://", capitals) and add the rest
  return best ? input + best.text.slice(query.length) : null
}
