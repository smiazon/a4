import { forwardRef, useImperativeHandle, useRef, useEffect, useState } from 'react'
import { getFaviconUrl } from '../utils/favicon'
import { isElectron } from '../utils/env'
import './WebView.css'

// In-memory session for incognito windows (must match electron/main.js)
const INCOGNITO_PARTITION = 'incognito'

// Chrome's zoom steps
const ZOOM_LEVELS = [0.25, 0.33, 0.5, 0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4, 5]

function normalizeUrl(url) {
  if (!url) return 'about:blank'
  if (/^(https?|file|about|view-source):/i.test(url)) return url
  return 'https://' + url
}

/**
 * One tab's page. In Electron this is a <webview>; in a plain browser it falls
 * back to an <iframe> (many sites refuse to be framed).
 *
 * Reports page state to the parent via onStateChange(tabId, patch), where patch
 * may contain: url, title, favicon, loading, canGoBack, canGoForward, zoom, and
 * navigated: true when a main-frame navigation committed (used for history).
 */
const WebView = forwardRef(({ tabId, initialUrl, incognito, onStateChange, onContextMenu, onFoundInPage }, ref) => {
  const containerRef = useRef(null)
  const webviewRef = useRef(null)
  const readyRef = useRef(false)
  const zoomRef = useRef(1)
  const [error, setError] = useState(null) // { kind: 'failed' | 'blocked', description, url }

  // Keep the latest callbacks without re-binding webview listeners every render
  const callbacksRef = useRef({})
  callbacksRef.current = { onStateChange, onContextMenu, onFoundInPage }
  const report = (patch) => callbacksRef.current.onStateChange?.(tabId, patch)

  const setZoom = (factor) => {
    zoomRef.current = factor
    if (isElectron && readyRef.current) webviewRef.current?.setZoomFactor(factor)
    report({ zoom: factor })
  }

  useImperativeHandle(ref, () => ({
    navigate: (url) => {
      const wv = webviewRef.current
      if (!wv) return
      setError(null)
      const finalUrl = normalizeUrl(url)
      if (isElectron && readyRef.current) {
        // loadURL rejects for aborted/redirected loads; did-fail-load reports real failures
        wv.loadURL(finalUrl).catch(() => {})
      } else {
        wv.src = finalUrl
      }
    },
    goBack: () => {
      const wv = webviewRef.current
      if (isElectron && readyRef.current && wv.canGoBack()) wv.goBack()
      else if (!isElectron) wv?.contentWindow?.history.back()
    },
    goForward: () => {
      const wv = webviewRef.current
      if (isElectron && readyRef.current && wv.canGoForward()) wv.goForward()
      else if (!isElectron) wv?.contentWindow?.history.forward()
    },
    reload: () => {
      setError(null)
      if (isElectron && readyRef.current) webviewRef.current.reload()
      else if (webviewRef.current) webviewRef.current.src = webviewRef.current.src
    },
    reloadIgnoringCache: () => {
      setError(null)
      if (isElectron && readyRef.current) webviewRef.current.reloadIgnoringCache()
    },
    stop: () => {
      if (isElectron && readyRef.current) webviewRef.current.stop()
      report({ loading: false })
    },
    findInPage: (text, options) => {
      if (!text) return
      if (isElectron && readyRef.current) {
        webviewRef.current.findInPage(text, options || {})
      } else {
        try {
          webviewRef.current?.contentWindow?.find(text, false, options?.forward === false, true)
        } catch (_) {}
      }
    },
    stopFindInPage: () => {
      if (isElectron && readyRef.current) webviewRef.current.stopFindInPage('clearSelection')
    },
    print: () => {
      if (isElectron && readyRef.current) webviewRef.current.print()
      else {
        try { webviewRef.current?.contentWindow?.print() } catch (_) {}
      }
    },
    openDevTools: () => {
      if (isElectron && readyRef.current) webviewRef.current.openDevTools()
    },
    inspectElement: (x, y) => {
      if (isElectron && readyRef.current) webviewRef.current.inspectElement(x, y)
    },
    zoomIn: () => setZoom(ZOOM_LEVELS.find(z => z > zoomRef.current + 0.001) ?? zoomRef.current),
    zoomOut: () => setZoom([...ZOOM_LEVELS].reverse().find(z => z < zoomRef.current - 0.001) ?? zoomRef.current),
    resetZoom: () => setZoom(1),
    // Clipboard / editing commands for the page's context menu
    cut: () => readyRef.current && webviewRef.current.cut(),
    copy: () => readyRef.current && webviewRef.current.copy(),
    paste: () => readyRef.current && webviewRef.current.paste(),
    selectAll: () => readyRef.current && webviewRef.current.selectAll(),
    executeJavaScript: (code) => (isElectron && readyRef.current
      ? webviewRef.current.executeJavaScript(code)
      : Promise.reject(new Error('Page is not ready'))),
    getWebContentsId: () => (isElectron && readyRef.current ? webviewRef.current.getWebContentsId() : null),
  }))

  // Electron: create the <webview> once and wire up its events
  useEffect(() => {
    if (!isElectron || !containerRef.current) return
    const container = containerRef.current

    // Reuse an existing webview (React StrictMode runs this effect twice in dev)
    let webview = container.querySelector('webview')
    if (!webview) {
      webview = document.createElement('webview')
      webview.setAttribute('allowpopups', 'true') // popups are turned into tabs by the main process
      webview.setAttribute('webpreferences', 'allowRunningInsecureContent=yes,javascript=yes,nodeIntegration=no,webSecurity=yes,images=yes,plugins=yes,backgroundThrottling=no')
      if (incognito) webview.setAttribute('partition', INCOGNITO_PARTITION)
      webview.className = 'webview-iframe'
      // Electron docs: use display:inline-flex with explicit pixel dimensions
      webview.style.display = 'inline-flex'
      webview.setAttribute('src', normalizeUrl(initialUrl))
      container.appendChild(webview)
    }
    webviewRef.current = webview

    // Webview needs explicit pixel width/height; position absolute so size is explicit
    const syncWebviewSize = () => {
      if (!webview.parentNode) return
      Object.assign(webview.style, {
        display: 'inline-flex',
        position: 'absolute',
        top: '0',
        left: '0',
        right: 'auto',
        bottom: 'auto',
        width: container.clientWidth + 'px',
        height: container.clientHeight + 'px',
      })
    }
    const ro = new ResizeObserver(syncWebviewSize)
    ro.observe(container)
    syncWebviewSize()

    const navState = () => {
      try {
        return {
          url: webview.getURL(),
          canGoBack: webview.canGoBack(),
          canGoForward: webview.canGoForward(),
        }
      } catch (_) {
        return {}
      }
    }

    const handlers = {
      'dom-ready': () => {
        readyRef.current = true
        if (zoomRef.current !== 1) webview.setZoomFactor(zoomRef.current)
        report({ ...navState(), title: webview.getTitle(), webContentsId: webview.getWebContentsId() })
      },
      'did-start-loading': () => {
        setError(null)
        report({ loading: true })
      },
      'did-stop-loading': () => {
        syncWebviewSize()
        report({ loading: false, ...navState(), title: webview.getTitle() })
      },
      'did-navigate': (e) => {
        report({ ...navState(), url: e.url, favicon: getFaviconUrl(e.url), navigated: true })
      },
      'did-navigate-in-page': (e) => {
        if (e.isMainFrame) report({ ...navState(), url: e.url, navigated: true })
      },
      'page-title-updated': (e) => {
        report({ title: e.title, url: navState().url })
      },
      'page-favicon-updated': (e) => {
        if (e.favicons?.length) report({ favicon: e.favicons[0] })
      },
      'did-fail-load': (e) => {
        // -3 is ERR_ABORTED: the load was replaced by another navigation (normal)
        if (!e.isMainFrame || e.errorCode === -3) return
        setError({ kind: 'failed', description: e.errorDescription, url: e.validatedURL })
        report({ loading: false, url: e.validatedURL, title: e.validatedURL })
      },
      'found-in-page': (e) => {
        callbacksRef.current.onFoundInPage?.(tabId, e.result)
      },
      'context-menu': (e) => {
        // params.x/y are relative to the page; the menu is positioned in the window
        const params = e.params || {}
        const rect = container.getBoundingClientRect()
        callbacksRef.current.onContextMenu?.(tabId, params, rect.left + (params.x || 0), rect.top + (params.y || 0))
      },
    }
    for (const [name, fn] of Object.entries(handlers)) webview.addEventListener(name, fn)

    return () => {
      ro.disconnect()
      for (const [name, fn] of Object.entries(handlers)) webview.removeEventListener(name, fn)
    }
    // initialUrl/incognito only matter when the webview is first created
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabId])

  // Plain-browser fallback: report what we can (cross-origin frames hide their URL/title)
  const handleIframeLoad = () => {
    const iframe = webviewRef.current
    try {
      const currentUrl = iframe.contentWindow.location.href
      report({ url: currentUrl, title: iframe.contentDocument?.title || currentUrl, favicon: getFaviconUrl(currentUrl), loading: false, navigated: true })
    } catch (_) {
      report({ title: iframe?.src || initialUrl, favicon: getFaviconUrl(iframe?.src || initialUrl), loading: false })
    }
  }

  const retry = () => {
    setError(null)
    const wv = webviewRef.current
    if (!wv) return
    if (isElectron && readyRef.current && error?.url) wv.loadURL(error.url).catch(() => {})
    else if (isElectron && readyRef.current) wv.reload()
  }

  let errorHost = ''
  try {
    errorHost = error?.url ? new URL(error.url).host : ''
  } catch (_) {}

  return (
    <div className="webview-container" ref={containerRef}>
      {error?.kind === 'failed' && (
        <div className="webview-error">
          <h3 className="error-title">This site can’t be reached</h3>
          <p className="error-message">
            {errorHost ? <><strong>{errorHost}</strong> couldn’t be loaded.</> : 'The page couldn’t be loaded.'}
            <br />
            <span className="error-code">{error.description}</span>
          </p>
          <button className="btn" onClick={retry}>Try again</button>
        </div>
      )}
      {error?.kind === 'blocked' && (
        <div className="webview-error">
          <h3 className="error-title">This site can’t be displayed</h3>
          <p className="error-message">
            This website has security restrictions that prevent it from being displayed in a frame.
            Run the Electron app for full browsing.
          </p>
          <button className="btn" onClick={() => window.open(initialUrl, '_blank')}>
            Open in a new browser tab
          </button>
        </div>
      )}
      {!isElectron && (
        <iframe
          ref={webviewRef}
          className="webview-iframe"
          src={normalizeUrl(initialUrl)}
          title="Web content"
          onLoad={handleIframeLoad}
          onError={() => setError({ kind: 'blocked' })}
          allow="fullscreen; autoplay; camera; microphone; geolocation"
          referrerPolicy="no-referrer-when-downgrade"
        />
      )}
    </div>
  )
})

WebView.displayName = 'WebView'

export default WebView
