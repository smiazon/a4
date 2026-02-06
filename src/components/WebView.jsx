import { forwardRef, useImperativeHandle, useRef, useEffect, useState } from 'react'
import { getFaviconUrl } from '../utils/favicon'
import './WebView.css'

const isElectron = typeof window !== 'undefined' && (
  (window.electronAPI && window.electronAPI.isElectron === true) ||
  (window.process && window.process.type === 'renderer') ||
  navigator.userAgent.includes('Electron') ||
  (window.require && typeof window.require === 'function')
)

const WebView = forwardRef(({ url, onUrlChange }, ref) => {
  const webviewRef = useRef(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const historyRef = useRef({ current: 0, stack: [url] })

  useImperativeHandle(ref, () => ({
    navigate: (newUrl) => {
      if (!newUrl) return
      
      // Ensure URL has protocol
      let finalUrl = newUrl.trim()
      if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://') && !finalUrl.startsWith('file://') && !finalUrl.startsWith('about:')) {
        finalUrl = 'https://' + finalUrl
      }
      
      if (isElectron && webviewRef.current) {
        const currentUrl = webviewRef.current.getURL ? webviewRef.current.getURL() : ''
        if (currentUrl !== finalUrl) {
          setLoading(true)
          setError(null)
          webviewRef.current.src = finalUrl
          historyRef.current.stack = historyRef.current.stack.slice(0, historyRef.current.current + 1)
          historyRef.current.stack.push(finalUrl)
          historyRef.current.current = historyRef.current.stack.length - 1
        }
      } else if (webviewRef.current) {
        setLoading(true)
        setError(null)
        webviewRef.current.src = finalUrl
        historyRef.current.stack = historyRef.current.stack.slice(0, historyRef.current.current + 1)
        historyRef.current.stack.push(finalUrl)
        historyRef.current.current = historyRef.current.stack.length - 1
      }
    },
    goBack: () => {
      if (isElectron && webviewRef.current) {
        if (webviewRef.current.canGoBack && webviewRef.current.canGoBack()) {
          setLoading(true)
          webviewRef.current.goBack()
        }
        return
      }
      if (historyRef.current.current > 0) {
        historyRef.current.current--
        const backUrl = historyRef.current.stack[historyRef.current.current]
        if (webviewRef.current) {
          setLoading(true)
          webviewRef.current.src = backUrl
        }
      }
    },
    goForward: () => {
      if (isElectron && webviewRef.current) {
        if (webviewRef.current.canGoForward && webviewRef.current.canGoForward()) {
          setLoading(true)
          webviewRef.current.goForward()
        }
        return
      }
      if (historyRef.current.current < historyRef.current.stack.length - 1) {
        historyRef.current.current++
        const forwardUrl = historyRef.current.stack[historyRef.current.current]
        if (webviewRef.current) {
          setLoading(true)
          webviewRef.current.src = forwardUrl
        }
      }
    },
    refresh: () => {
      if (isElectron && webviewRef.current) {
        setLoading(true)
        webviewRef.current.reload()
      } else if (webviewRef.current) {
        setLoading(true)
        webviewRef.current.src = webviewRef.current.src
      }
    },
    findInPage: (text, options) => {
      if (!text) return
      if (isElectron && webviewRef.current && webviewRef.current.findInPage) {
        webviewRef.current.findInPage(text, options || {})
      } else if (webviewRef.current && webviewRef.current.contentWindow) {
        try {
          const backwards = options && options.forward === false
          webviewRef.current.contentWindow.find(text, false, backwards, true)
        } catch (_) {}
      }
    },
    stopFindInPage: (action) => {
      if (isElectron && webviewRef.current && webviewRef.current.stopFindInPage) {
        webviewRef.current.stopFindInPage(action || 'clearSelection')
      }
    },
    print: () => {
      if (isElectron && webviewRef.current && webviewRef.current.print) {
        webviewRef.current.print()
      } else if (webviewRef.current && webviewRef.current.contentWindow) {
        try {
          webviewRef.current.contentWindow.print()
        } catch (_) {}
      }
    },
    openDevTools: () => {
      if (isElectron && webviewRef.current && webviewRef.current.openDevTools) {
        webviewRef.current.openDevTools()
      }
    }
  }))


  // Iframe handlers (for web fallback)
  const handleLoad = () => {
    if (isElectron) return // Electron uses webview events
    
    setLoading(false)
    setError(null)
    
    // Run immediately so we don't add delay after load
    setTimeout(() => {
      const iframe = webviewRef.current
      if (iframe) {
        try {
          const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document
          if (!iframeDoc || iframeDoc.body === null) {
            try {
              iframe.contentWindow.location.href
            } catch (e) {
              if (e.message && (e.message.includes('X-Frame-Options') || e.message.includes('frame'))) {
                setError('blocked')
              }
            }
          } else {
            const currentUrl = iframe.contentWindow.location.href
            const title = iframeDoc.title || currentUrl
            const favicon = getFaviconUrl(currentUrl)
            if (onUrlChange) {
              onUrlChange(currentUrl, title, favicon)
            }
          }
        } catch (e) {
          const fallbackUrl = iframe?.src || url
          const favicon = getFaviconUrl(fallbackUrl)
          if (onUrlChange) {
            onUrlChange(fallbackUrl, fallbackUrl, favicon)
          }
          if (e.message && (e.message.includes('X-Frame-Options') || e.message.includes('refused'))) {
            setError('blocked')
          }
        }
      }
    }, 0)
  }

  const handleError = () => {
    if (isElectron) return
    setLoading(false)
    setTimeout(() => {
      setError('blocked')
    }, 0)
  }

  const handleOpenInNewTab = () => {
    window.open(url, '_blank')
  }

  const containerRef = useRef(null)

  // Create webview element directly for Electron (only once)
  useEffect(() => {
    if (!isElectron || !containerRef.current) return

    const container = containerRef.current

    // Check if webview already exists
    let webview = containerRef.current.querySelector('webview')
    
    if (!webview) {
      // Create new webview element
      webview = document.createElement('webview')
      webview.setAttribute('allowpopups', 'true')
      webview.setAttribute('webpreferences', 'allowRunningInsecureContent=yes,javascript=yes,nodeIntegration=no,webSecurity=yes,images=yes,plugins=yes')
      webview.className = 'webview-iframe'
      // Electron docs: use display:inline-flex with explicit pixel dimensions; do not overwrite display unless inline-flex
      webview.style.display = 'inline-flex'
      
      webviewRef.current = webview
      containerRef.current.appendChild(webview)
      
      // If URL is already provided, wait for dom-ready before setting it
      if (url) {
        const handleInitialDomReady = () => {
          let finalUrl = url
          if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('file://') && !url.startsWith('about:')) {
            finalUrl = 'https://' + url
          }
          webview.src = finalUrl
          webview.removeEventListener('dom-ready', handleInitialDomReady)
        }
        webview.addEventListener('dom-ready', handleInitialDomReady)
      }
    }

    // Electron: webview needs display:inline-flex and explicit pixel width/height; use position absolute + top/left/width/height so size is explicit
    const syncWebviewSize = () => {
      const c = containerRef.current
      if (!c || !webview.parentNode) return
      const w = c.clientWidth
      const h = c.clientHeight
      webview.style.display = 'inline-flex'
      webview.style.position = 'absolute'
      webview.style.top = '0'
      webview.style.left = '0'
      webview.style.right = 'auto'
      webview.style.bottom = 'auto'
      webview.style.width = w + 'px'
      webview.style.height = h + 'px'
    }

    const ro = new ResizeObserver(() => { syncWebviewSize() })
    ro.observe(container)
    syncWebviewSize()
    requestAnimationFrame(syncWebviewSize)

    // Set up event listeners
    const handleDidStartLoading = () => {
      setLoading(true)
      setError(null)
    }

    const handleDidStopLoading = () => {
      setLoading(false)
      syncWebviewSize()
      if (webview && onUrlChange) {
        try {
          const currentUrl = webview.getURL()
          if (currentUrl && currentUrl !== 'about:blank' && currentUrl !== '') {
            // Use requestIdleCallback or setTimeout to avoid blocking
            setTimeout(() => {
              webview.executeJavaScript('document.title').then(title => {
                const favicon = getFaviconUrl(currentUrl)
                onUrlChange(currentUrl, title || currentUrl, favicon)
              }).catch(() => {
                const favicon = getFaviconUrl(currentUrl)
                onUrlChange(currentUrl, currentUrl, favicon)
              })
            }, 0)
          }
        } catch (e) {
          // ignore
        }
      }
    }

    const handleDidFailLoad = (event) => {
      setLoading(false)
      if (event.errorCode !== -3 && event.errorCode !== -102) { // -3 is ERR_ABORTED, -102 is ERR_CONNECTION_REFUSED (sometimes normal)
        setError('failed')
      }
    }

    const handleDomReady = () => {
      // Clear loading as soon as DOM is ready so the page appears quickly
      if (webview && webview.getURL() && webview.getURL() !== 'about:blank') {
        setLoading(false)
      }
    }

    // Remove old listeners if they exist, then add new ones
    webview.removeEventListener('did-start-loading', handleDidStartLoading)
    webview.removeEventListener('did-stop-loading', handleDidStopLoading)
    webview.removeEventListener('did-fail-load', handleDidFailLoad)
    webview.removeEventListener('dom-ready', handleDomReady)
    
    webview.addEventListener('did-start-loading', handleDidStartLoading)
    webview.addEventListener('did-stop-loading', handleDidStopLoading)
    webview.addEventListener('did-fail-load', handleDidFailLoad)
    webview.addEventListener('dom-ready', handleDomReady)

    // Fallback timeout to clear loading state if events don't fire
    const loadingTimeout = setTimeout(() => {
      setLoading(false)
    }, 30000) // 30 second timeout

    return () => {
      clearTimeout(loadingTimeout)
      ro.disconnect()
      webview.removeEventListener('did-start-loading', handleDidStartLoading)
      webview.removeEventListener('did-stop-loading', handleDidStopLoading)
      webview.removeEventListener('did-fail-load', handleDidFailLoad)
      webview.removeEventListener('dom-ready', handleDomReady)
    }
  }, [isElectron, onUrlChange])

  // Update webview src when url changes
  useEffect(() => {
    if (!isElectron || !webviewRef.current || !url) return

    setLoading(true)
    setError(null)
    
    // Ensure URL has protocol
    let finalUrl = url
    if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('file://') && !url.startsWith('about:')) {
      finalUrl = 'https://' + url
    }
    
    const webview = webviewRef.current
    
    // Set src directly - webview handles this automatically
    try {
      const currentUrl = webview.getURL ? webview.getURL() : (webview.getAttribute('src') || webview.src || '')
      if (currentUrl !== finalUrl) {
        webview.src = finalUrl
        historyRef.current = { current: 0, stack: [finalUrl] }
      } else {
        setLoading(false)
      }
    } catch (e) {
      // Fallback: set attribute directly
      webview.setAttribute('src', finalUrl)
      webview.src = finalUrl
      historyRef.current = { current: 0, stack: [finalUrl] }
    }
  }, [url, isElectron])

  return (
    <div className="webview-container" ref={containerRef}>
      {loading && !error && (
        <div className="webview-loading">
          <div className="loading-spinner"></div>
          <p className="loading-text">Loading page...</p>
        </div>
      )}
      {error === 'blocked' && !isElectron && (
        <div className="webview-error">
          <div className="error-icon">🔒</div>
          <h3 className="error-title">This site can't be displayed</h3>
          <p className="error-message">
            This website has security restrictions that prevent it from being displayed in a frame.
            Many modern websites block iframe embedding for security reasons.
          </p>
          <button className="error-button" onClick={handleOpenInNewTab}>
            Open in New Tab
          </button>
        </div>
      )}
      {url && !isElectron && (
        <iframe
          ref={webviewRef}
          className="webview-iframe"
          src={url}
          title="Web content"
          onLoad={handleLoad}
          onError={handleError}
          allow="fullscreen; autoplay; camera; microphone; geolocation"
          referrerPolicy="no-referrer-when-downgrade"
          style={{ display: error === 'blocked' ? 'none' : 'block' }}
        />
      )}
    </div>
  )
})

WebView.displayName = 'WebView'

export default WebView
