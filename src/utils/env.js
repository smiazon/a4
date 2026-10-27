// Running inside the Electron shell (preload exposed the bridge) vs. a plain browser tab
export const isElectron = typeof window !== 'undefined' && (
  window.electronAPI?.isElectron === true ||
  navigator.userAgent.includes('Electron')
)

export const isMac = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform)

// Keyboard shortcut label for the current platform, e.g. shortcut('⌘T', 'Ctrl+T')
export const shortcut = (mac, other) => (isMac ? mac : other)

// Launch options passed by the main process via the query string (see electron/main.js)
const launchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams()
export const isIncognito = launchParams.get('incognito') === '1'
export const launchUrl = launchParams.get('url')
