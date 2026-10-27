export const SEARCH_ENGINES = [
  { label: 'Google', url: 'https://www.google.com/search?q=' },
  { label: 'DuckDuckGo', url: 'https://duckduckgo.com/?q=' },
  { label: 'Bing', url: 'https://www.bing.com/search?q=' },
  { label: 'Brave Search', url: 'https://search.brave.com/search?q=' },
]

export const SEARCH_ENGINE_STORAGE_KEY = 'a4-search-engine'
export const HOMEPAGE_STORAGE_KEY = 'a4-homepage'

// The search engine picked in Settings (falls back to Google)
export function getSearchEngine() {
  let saved = null
  try {
    saved = window.localStorage.getItem(SEARCH_ENGINE_STORAGE_KEY)
  } catch (_) {}
  return SEARCH_ENGINES.find(se => se.url === saved) || SEARCH_ENGINES[0]
}

export function getHomepage() {
  try {
    return window.localStorage.getItem(HOMEPAGE_STORAGE_KEY) || ''
  } catch (_) {
    return ''
  }
}

// Internal pages (History, Downloads, Settings…) rendered by the app itself
export const isInternalUrl = (url) => !!url && url.startsWith('a4://')

export const isWebUrl = (url) => !!url && /^https?:\/\//i.test(url)

// A results page from one of the search engines (what typed searches become)
export const isSearchUrl = (url) => SEARCH_ENGINES.some(se => url.startsWith(se.url))

// "https://www.example.com/a" -> "example.com"
export function hostOf(url) {
  try {
    return new URL(url).host.replace(/^www\./, '')
  } catch (_) {
    return url
  }
}

// Turn whatever was typed in the address bar into a URL: keep explicit URLs,
// add https:// to things that look like domains, search for everything else.
export function toNavigableUrl(input) {
  const text = (input || '').trim()
  if (!text) return null
  if (/^(https?|file|about|a4|view-source):/i.test(text)) return text
  if (/^(localhost|127\.0\.0\.1)(:\d+)?(\/.*)?$/i.test(text)) return 'http://' + text
  if (!/\s/.test(text) && /^[^\s/]+\.[a-z0-9-]{2,}(:\d+)?(\/.*)?$/i.test(text)) return 'https://' + text
  return getSearchEngine().url + encodeURIComponent(text)
}

// Chrome-style short form shown in the address bar when it isn't focused:
// "https://www.example.com/" -> "example.com"
export function displayUrl(url) {
  if (!url) return ''
  if (!/^https:\/\//i.test(url)) return url
  return url
    .replace(/^https:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/^([^/?#]+)\/$/, '$1')
}
