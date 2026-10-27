// Google refuses to sign in browsers it takes for an embedded framework ("This
// browser or app may not be secure"), and Electron is one. On Google's sign-in
// pages only, a tab presents itself as Firefox, which has none of the Chromium
// signals Google checks for. Every other site, Gmail included, still sees Chrome.

const { join } = require('path')

const PRELOAD = join(__dirname, 'signin-preload.js')

const PLATFORM = {
  darwin: 'Macintosh; Intel Mac OS X 10.15',
  win32: 'Windows NT 10.0; Win64; x64',
}[process.platform] || 'X11; Linux x86_64'

const FIREFOX_UA = `Mozilla/5.0 (${PLATFORM}; rv:140.0) Gecko/20100101 Firefox/140.0`

const isSignInPage = (url) => {
  try {
    return new URL(url).hostname === 'accounts.google.com'
  } catch (_) {
    return false
  }
}

// Request pipeline: Firefox's User-Agent and no client hints (Firefox sends none)
// for sign-in pages and everything they load
function applySignInHeaders(details, contents, headers) {
  const page = details.resourceType === 'mainFrame' ? details.url : contents.getURL()
  if (!isSignInPage(details.url) && !isSignInPage(page)) return
  headers['User-Agent'] = FIREFOX_UA
  for (const name of Object.keys(headers)) {
    if (/^sec-ch-ua/i.test(name)) delete headers[name]
  }
}

// Tab: switch navigator.userAgent to match while it's on a sign-in page
function watchSignIn(contents) {
  let normalUA = null
  contents.on('did-start-navigation', (details) => {
    if (!details.isMainFrame || details.isSameDocument) return
    if (isSignInPage(details.url)) {
      if (normalUA === null) normalUA = contents.getUserAgent()
      contents.setUserAgent(FIREFOX_UA)
    } else if (normalUA !== null) {
      contents.setUserAgent(normalUA)
      normalUA = null
    }
  })
}

// Session: the preload that keeps the page's JavaScript consistent with it
function installSignIn(ses) {
  ses.setPreloads([...ses.getPreloads().filter(p => p !== PRELOAD), PRELOAD])
}

module.exports = { applySignInHeaders, watchSignIn, installSignIn }
