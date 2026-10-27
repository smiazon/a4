// Session preload, runs in each page before its own scripts. On Google's
// sign-in pages the tab presents as Firefox (see signin.js), so hide the
// Chromium-only APIs that would contradict it.
if (location.hostname === 'accounts.google.com') {
  require('electron').webFrame.executeJavaScript(`
    delete Navigator.prototype.userAgentData
    delete window.chrome
    Object.defineProperty(Navigator.prototype, 'vendor', { get: () => '', configurable: true })
  `)
}
