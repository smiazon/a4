import { useEffect, useRef, useState } from 'react'
import ConfirmButton from './ConfirmButton'
import { Toggle } from './PageParts'
import { SEARCH_ENGINES, SEARCH_ENGINE_STORAGE_KEY, HOMEPAGE_STORAGE_KEY, getSearchEngine } from '../utils/url'
import { shortcut } from '../utils/env'
import './Page.css'
import './Settings.css'

export const ART_INTERVAL_KEY = 'a4-art-interval'
const ART_INTERVALS = [
  { label: '10 s', ms: 10000 },
  { label: '20 s', ms: 20000 },
  { label: '1 min', ms: 60000 },
  { label: '5 min', ms: 300000 },
]

const SECTIONS = [
  { id: 'appearance', label: 'Appearance', icon: <><circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.2" /><path d="M8 2.5A5.5 5.5 0 0 1 8 13.5Z" fill="currentColor" /></> },
  { id: 'newtab', label: 'New tab', icon: <><rect x="2.5" y="3" width="11" height="10" rx="2" stroke="currentColor" strokeWidth="1.2" /><path d="M2.5 10L5.5 7.5L8 9.5L10.5 7L13.5 9.5" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" /></> },
  { id: 'search', label: 'Search & start', icon: <><circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.2" /><path d="M10.4 10.4L13.5 13.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></> },
  { id: 'assistant', label: 'Assistant', icon: <path d="M8 1.8L9.3 5.6L13.2 7L9.3 8.4L8 12.2L6.7 8.4L2.8 7L6.7 5.6L8 1.8Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" /> },
  { id: 'downloads', label: 'Downloads', icon: <><path d="M8 2.5V10M8 10L5 7M8 10L11 7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /><path d="M3 13H13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></> },
  { id: 'privacy', label: 'Privacy & shields', icon: <path d="M8 1.8L13 3.6V7.6C13 10.6 10.9 13 8 14.2C5.1 13 3 10.6 3 7.6V3.6L8 1.8Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" /> },
  { id: 'vpn', label: 'VPN & proxy', icon: <><circle cx="8" cy="8" r="5.8" stroke="currentColor" strokeWidth="1.2" /><path d="M2.5 8H13.5M8 2.2C9.6 4 10.2 6 10.2 8S9.6 12 8 13.8M8 2.2C6.4 4 5.8 6 5.8 8S6.4 12 8 13.8" stroke="currentColor" strokeWidth="1.1" /></> },
  { id: 'extensions', label: 'Extensions', icon: <path d="M6 2.5H9V4.2A1.3 1.3 0 1 0 11.6 4.2V4.2H13.5V7.5H11.8A1.3 1.3 0 1 0 11.8 10.1H13.5V13.5H10V11.8A1.3 1.3 0 1 0 7.4 11.8V13.5H2.5V9.5H4.2A1.3 1.3 0 1 0 4.2 6.9H2.5V2.5H6Z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" /> },
  { id: 'shortcuts', label: 'Shortcuts', icon: <><rect x="2" y="4" width="12" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.2" /><path d="M4.5 6.5H5M7 6.5H7.5M9.5 6.5H10M12 6.5H11.5M5 9.5H11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></> },
  { id: 'about', label: 'About', icon: <><circle cx="8" cy="8" r="5.8" stroke="currentColor" strokeWidth="1.2" /><path d="M8 7.2V11M8 5V5.1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></> },
]

const SHORTCUTS = [
  ['Ask AI', shortcut('⌘K', 'Ctrl+K')],
  ['New tab', shortcut('⌘T', 'Ctrl+T')],
  ['Reopen closed tab', shortcut('⇧⌘T', 'Ctrl+Shift+T')],
  ['Focus mode', shortcut('⇧⌘F', 'Ctrl+Shift+F')],
  ['Address bar', shortcut('⌘L', 'Ctrl+L')],
  ['Find in page', shortcut('⌘F', 'Ctrl+F')],
  ['Bookmark page', shortcut('⌘D', 'Ctrl+D')],
  ['Back / forward', shortcut('⌘[  ⌘]', 'Alt+← / →')],
  ['Switch tabs', shortcut('⌃Tab  ⌘1–9', 'Ctrl+Tab / 1–9')],
  ['Zoom', shortcut('⌘+  ⌘−  ⌘0', 'Ctrl + / − / 0')],
  ['History', shortcut('⌘Y', 'Ctrl+H')],
  ['Downloads', shortcut('⌥⌘L', 'Ctrl+J')],
]

const PROVIDER_ORDER = ['anthropic', 'openai', 'gemini']
const shortPath = (path = '') => path.replace(/^\/Users\/[^/]+/, '~')

const Row = ({ title, sub, children }) => (
  <div className="row">
    <span className="row-main">
      <span className="row-title">{title}</span>
      {sub && <span className="row-sub settings-sub">{sub}</span>}
    </span>
    {children}
  </div>
)

// ---- Assistant section ------------------------------------------------------------

function AssistantSettings({ onConnect }) {
  const api = window.electronAPI?.assistant
  const [config, setConfig] = useState(null)
  const [models, setModels] = useState({})

  const load = async () => {
    if (!api) return
    const next = await api.getConfig()
    setConfig(next)
    for (const id of PROVIDER_ORDER) {
      if (next.providers[id]?.connected) {
        api.listModels(id).then(r => setModels(m => ({ ...m, [id]: r.models || [] }))).catch(() => {})
      }
    }
  }

  useEffect(() => {
    load()
    const onChange = () => load()
    window.addEventListener('assistant-config-changed', onChange)
    return () => window.removeEventListener('assistant-config-changed', onChange)
  }, [])

  if (!api) return <Row title="Assistant" sub="Available in the desktop app" />
  if (!config) return null

  const changed = (next) => {
    setConfig(next)
    window.dispatchEvent(new Event('assistant-config-changed'))
  }

  return (
    <>
      {PROVIDER_ORDER.map(id => {
        const p = config.providers[id]
        const active = config.provider === id && p.connected
        const list = models[id] || []
        return (
          <div key={id} className="row settings-provider">
            <span className={`settings-dot${p.connected ? ' is-on' : ''}`} aria-hidden />
            <span className="row-main">
              <span className="row-title">
                {p.label}
                {active && <span className="settings-badge">In use</span>}
              </span>
              <span className="row-sub settings-sub">{p.connected ? `Model: ${list.find(m => m.id === config.models[id])?.name || config.models[id]}` : 'Not connected'}</span>
            </span>
            {p.connected ? (
              <span className="settings-provider-actions">
                {list.length > 0 && (
                  <select
                    className="settings-select"
                    value={config.models[id] || ''}
                    onChange={async (e) => changed(await api.select(id, e.target.value))}
                    aria-label={`${p.label} model`}
                  >
                    {list.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                )}
                {!active && <button type="button" className="btn" onClick={async () => changed(await api.select(id))}>Use</button>}
                <ConfirmButton className="btn-ghost" onConfirm={async () => changed(await api.disconnect(id))} confirmLabel="Remove key?">Disconnect</ConfirmButton>
              </span>
            ) : (
              <button type="button" className="btn" onClick={() => onConnect(id)}>Connect…</button>
            )}
          </div>
        )
      })}
    </>
  )
}

// ---- Downloads section ------------------------------------------------------------

function DownloadSettings() {
  const api = window.electronAPI
  const [prefs, setPrefs] = useState(null)

  useEffect(() => {
    api?.getDownloadPrefs?.().then(setPrefs).catch(() => {})
  }, [])

  if (!api?.getDownloadPrefs) return <Row title="Downloads" sub="Available in the desktop app" />
  if (!prefs) return null

  return (
    <>
      <Row title="Save files to" sub={shortPath(prefs.downloadDir)}>
        <button type="button" className="btn" onClick={async () => setPrefs(await api.chooseDownloadFolder())}>Change…</button>
      </Row>
      <Row title="Ask where to save each file" sub="Choose a name and place every time you download">
        <button
          type="button"
          role="switch"
          aria-checked={prefs.askWhereToSave}
          aria-label="Ask where to save each file"
          className="switch"
          onClick={async () => setPrefs(await api.setDownloadPrefs({ askWhereToSave: !prefs.askWhereToSave }))}
        >
          <span className="switch-knob" />
        </button>
      </Row>
    </>
  )
}

// ---- Shields & VPN -----------------------------------------------------------------------

function useShields() {
  const api = window.electronAPI?.shields
  const [prefs, setPrefs] = useState(null)
  useEffect(() => {
    if (!api) return
    const load = () => api.get().then(setPrefs).catch(() => {})
    load()
    window.addEventListener('shields-changed', load)
    return () => window.removeEventListener('shields-changed', load)
  }, [])
  const apply = async (promise) => {
    setPrefs(await promise)
    window.dispatchEvent(new Event('shields-changed'))
  }
  return { api, prefs, apply }
}

const DNS_OPTIONS = [['off', 'Off'], ['cloudflare', 'Cloudflare'], ['quad9', 'Quad9'], ['google', 'Google']]

function ShieldSettings() {
  const { api, prefs, apply } = useShields()
  if (!api) return <Row title="Shields" sub="Available in the desktop app" />
  if (!prefs) return null
  const toggle = (key) => (value) => apply(api.set({ [key]: value }))
  return (
    <>
      <Row title="Block ads & trackers" sub={prefs.blockerReady ? 'EasyList and EasyPrivacy filters, kept up to date' : 'Downloading filter lists…'}>
        <Toggle checked={prefs.adblock} onChange={toggle('adblock')} label="Block ads and trackers" />
      </Row>
      <Row title="Block pop-ups" sub="Sites can open new tabs only right after you click">
        <Toggle checked={prefs.popups} onChange={toggle('popups')} label="Block pop-ups" />
      </Row>
      <Row title="Always use secure connections" sub="Upgrades http to https, and falls back if a site can’t">
        <Toggle checked={prefs.httpsUpgrade} onChange={toggle('httpsUpgrade')} label="Upgrade to HTTPS" />
      </Row>
      <Row title="Ask sites not to sell or share my data" sub="Sends Global Privacy Control and Do Not Track">
        <Toggle checked={prefs.gpc} onChange={toggle('gpc')} label="Global Privacy Control" />
      </Row>
      <div className="row settings-row-stack">
        <span className="row-main">
          <span className="row-title">Secure DNS</span>
          <span className="row-sub settings-sub">Encrypts the lookups that reveal which sites you visit</span>
        </span>
        <div className="segmented" role="group" aria-label="Secure DNS provider">
          {DNS_OPTIONS.map(([id, label]) => (
            <button key={id} type="button" aria-pressed={prefs.secureDns === id} onClick={() => apply(api.set({ secureDns: id }))}>{label}</button>
          ))}
        </div>
      </div>
      {prefs.allowlist.length > 0 && (
        <div className="row settings-row-stack">
          <span className="row-main">
            <span className="row-title">Shields down on</span>
            <span className="settings-sites">
              {prefs.allowlist.map(h => (
                <span key={h} className="page-chip settings-site">
                  {h}
                  <button type="button" aria-label={`Turn shields back on for ${h}`} title="Turn shields back on" onClick={() => apply(api.setSite(h, true))}>×</button>
                </span>
              ))}
            </span>
          </span>
        </div>
      )}
    </>
  )
}

function VpnSettings() {
  const { api, prefs, apply } = useShields()
  const [draft, setDraft] = useState(null)
  const [auth, setAuth] = useState({ username: '', password: '' })
  const [test, setTest] = useState(null) // { pending } | { ip, location } | { error }

  useEffect(() => {
    if (prefs && !draft) setDraft({ type: prefs.proxy.type, host: prefs.proxy.host, port: prefs.proxy.port })
  }, [prefs])

  if (!api) return <Row title="VPN & proxy" sub="Available in the desktop app" />
  if (!prefs || !draft) return null

  const { mode } = prefs.proxy
  const configured = prefs.proxy.host && prefs.proxy.port
  const dirty = draft.type !== prefs.proxy.type || draft.host !== prefs.proxy.host || draft.port !== prefs.proxy.port

  const runTest = async () => {
    setTest({ pending: true })
    setTest(await api.test(mode === 'always' ? 'normal' : 'private'))
  }

  return (
    <>
      <div className="row settings-row-stack">
        <span className="row-main">
          <span className="row-title">Use VPN</span>
          <span className="row-sub settings-sub">
            {mode === 'off' ? 'Off' : mode === 'private' ? 'Private windows connect automatically' : 'Every window goes through it'}
          </span>
        </span>
        <div className="segmented" role="group" aria-label="Use VPN">
          {[['off', 'Off'], ['private', 'Private windows'], ['always', 'Always']].map(([id, label]) => (
            <button key={id} type="button" aria-pressed={mode === id} onClick={() => apply(api.set({ proxy: { mode: id } }))}>{label}</button>
          ))}
        </div>
      </div>
      <div className="row settings-row-stack">
        <span className="row-main">
          <span className="row-title">Server</span>
          <span className="row-sub settings-sub">A SOCKS5 or HTTP proxy from your VPN provider, or Tor (SOCKS5 · 127.0.0.1 · 9050)</span>
        </span>
        <form
          className="settings-proxy"
          onSubmit={(e) => {
            e.preventDefault()
            apply(api.set({ proxy: draft }))
            setTest(null)
          }}
        >
          <select className="settings-select" value={draft.type} onChange={(e) => setDraft(d => ({ ...d, type: e.target.value }))} aria-label="Proxy type">
            <option value="socks5">SOCKS5</option>
            <option value="http">HTTP</option>
            <option value="https">HTTPS</option>
          </select>
          <label className="field settings-proxy-host">
            <input placeholder="host" value={draft.host} spellCheck="false" onChange={(e) => setDraft(d => ({ ...d, host: e.target.value }))} aria-label="Proxy host" />
          </label>
          <label className="field settings-proxy-port">
            <input placeholder="port" inputMode="numeric" value={draft.port} onChange={(e) => setDraft(d => ({ ...d, port: e.target.value }))} aria-label="Proxy port" />
          </label>
          {dirty && <button type="submit" className="btn">Save</button>}
        </form>
      </div>
      <div className="row settings-row-stack">
        <span className="row-main">
          <span className="row-title">Sign-in</span>
          <span className="row-sub settings-sub">
            {prefs.proxyAuth ? `Signed in as ${prefs.proxyAuth.username} · stored in your keychain` : 'Only if your proxy needs a username and password'}
          </span>
        </span>
        {prefs.proxyAuth ? (
          <ConfirmButton className="btn-ghost" onConfirm={() => apply(api.setProxyAuth(null))} confirmLabel="Remove sign-in?">Remove</ConfirmButton>
        ) : (
          <form
            className="settings-proxy"
            onSubmit={(e) => {
              e.preventDefault()
              apply(api.setProxyAuth(auth))
              setAuth({ username: '', password: '' })
            }}
          >
            <label className="field settings-proxy-host">
              <input placeholder="username" autoComplete="off" spellCheck="false" value={auth.username} onChange={(e) => setAuth(a => ({ ...a, username: e.target.value }))} aria-label="Proxy username" />
            </label>
            <label className="field settings-proxy-host">
              <input type="password" placeholder="password" autoComplete="off" value={auth.password} onChange={(e) => setAuth(a => ({ ...a, password: e.target.value }))} aria-label="Proxy password" />
            </label>
            {auth.username && <button type="submit" className="btn">Save</button>}
          </form>
        )}
      </div>
      <Row
        title="Check connection"
        sub={
          test?.pending ? 'Checking…'
            : test?.error ? `Couldn’t connect: ${test.error}`
              : test?.ip ? `Websites see ${test.ip}${test.location ? ` · ${test.location}` : ''}`
                : `Shows the address websites see${mode === 'always' ? '' : ' from a private window'}`
        }
      >
        <button type="button" className="btn" onClick={runTest} disabled={test?.pending || (mode !== 'off' && !configured)}>Check</button>
      </Row>
    </>
  )
}

// ---- Page ------------------------------------------------------------------------------

function Settings({ theme, onSetTheme, homeStyle, onSetHomeStyle, onNavigate, section, onClearHistory, onConnectAssistant }) {
  const [searchEngine, setSearchEngine] = useState(() => getSearchEngine().url)
  const [homepage, setHomepage] = useState(() => window.localStorage?.getItem(HOMEPAGE_STORAGE_KEY) || '')
  const [homepageDraft, setHomepageDraft] = useState(homepage)
  const [artInterval, setArtInterval] = useState(() => Number(window.localStorage?.getItem(ART_INTERVAL_KEY)) || 20000)
  const [done, setDone] = useState({}) // which privacy actions just ran
  const [current, setCurrent] = useState(SECTIONS[0].id)
  const scrollRef = useRef(null)
  const versions = window.electronAPI?.versions

  const scrollTo = (id) => {
    document.getElementById(`settings-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // Jump to a section when asked (e.g. from the assistant's gear button)
  useEffect(() => {
    if (section?.id) setTimeout(() => scrollTo(section.id), 50)
  }, [section])

  // Highlight the section being read in the sidebar
  useEffect(() => {
    const root = scrollRef.current
    if (!root) return
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
      if (visible) setCurrent(visible.target.dataset.section)
    }, { root, rootMargin: '0px 0px -65% 0px' })
    root.querySelectorAll('[data-section]').forEach(el => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  const saveSearchEngine = (url) => {
    setSearchEngine(url)
    window.localStorage?.setItem(SEARCH_ENGINE_STORAGE_KEY, url)
  }

  const saveHomepage = () => {
    const value = homepageDraft.trim()
    setHomepage(value)
    window.localStorage?.setItem(HOMEPAGE_STORAGE_KEY, value)
  }

  const saveArtInterval = (ms) => {
    setArtInterval(ms)
    window.localStorage?.setItem(ART_INTERVAL_KEY, String(ms))
  }

  const mark = (key) => setDone(d => ({ ...d, [key]: true }))

  return (
    <div className="page" ref={scrollRef}>
      <div className="settings-layout">
        <nav className="settings-nav" aria-label="Settings sections">
          <h1 className="page-title settings-title">Settings</h1>
          {SECTIONS.map(s => (
            <button
              key={s.id}
              type="button"
              className={`settings-nav-item${current === s.id ? ' is-current' : ''}`}
              onClick={() => scrollTo(s.id)}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>{s.icon}</svg>
              {s.label}
            </button>
          ))}
        </nav>

        <div className="settings-content">
          <section id="settings-appearance" data-section="appearance" className="settings-section">
            <h2 className="group-title">Appearance</h2>
            <div className="group">
              <Row title="Theme" sub="Auto follows your Mac’s light or dark appearance">
                <div className="segmented" role="group" aria-label="Theme">
                  {[['light', 'Light'], ['dark', 'Dark'], ['system', 'Auto']].map(([id, label]) => (
                    <button key={id} type="button" aria-pressed={theme === id} onClick={() => onSetTheme(id)}>{label}</button>
                  ))}
                </div>
              </Row>
            </div>
          </section>

          <section id="settings-newtab" data-section="newtab" className="settings-section">
            <h2 className="group-title">New tab</h2>
            <div className="group">
              <Row title="Page" sub={homeStyle === 'art' ? 'A slideshow of public-domain paintings' : 'A daily line, shortcuts and search'}>
                <div className="segmented" role="group" aria-label="New tab page">
                  <button type="button" aria-pressed={homeStyle === 'art'} onClick={() => onSetHomeStyle('art')}>Art</button>
                  <button type="button" aria-pressed={homeStyle === 'classic'} onClick={() => onSetHomeStyle('classic')}>Classic</button>
                </div>
              </Row>
              {homeStyle === 'art' && (
                <Row title="Change painting every">
                  <div className="segmented" role="group" aria-label="Slideshow speed">
                    {ART_INTERVALS.map(i => (
                      <button key={i.ms} type="button" aria-pressed={artInterval === i.ms} onClick={() => saveArtInterval(i.ms)}>{i.label}</button>
                    ))}
                  </div>
                </Row>
              )}
            </div>
          </section>

          <section id="settings-search" data-section="search" className="settings-section">
            <h2 className="group-title">Search & start</h2>
            <div className="group">
              <div className="row settings-row-stack">
                <span className="row-main"><span className="row-title">Search engine</span></span>
                <div className="segmented" role="group" aria-label="Search engine">
                  {SEARCH_ENGINES.map(se => (
                    <button key={se.url} type="button" aria-pressed={searchEngine === se.url} onClick={() => saveSearchEngine(se.url)}>
                      {se.label}
                    </button>
                  ))}
                </div>
              </div>
              <Row title="Homepage" sub={`Opens in new windows and with Home (${shortcut('⇧⌘H', 'Ctrl+Shift+H')})`}>
                <form
                  className="settings-homepage"
                  onSubmit={(e) => {
                    e.preventDefault()
                    saveHomepage()
                  }}
                >
                  <label className="field rainbow rainbow-subtle">
                    <input
                      type="text"
                      placeholder="New tab page"
                      value={homepageDraft}
                      onChange={e => setHomepageDraft(e.target.value)}
                      spellCheck="false"
                      aria-label="Homepage address"
                    />
                  </label>
                  {homepageDraft.trim() !== homepage && <button type="submit" className="btn">Save</button>}
                </form>
              </Row>
            </div>
          </section>

          <section id="settings-assistant" data-section="assistant" className="settings-section">
            <h2 className="group-title">Assistant</h2>
            <div className="group">
              <AssistantSettings onConnect={onConnectAssistant} />
            </div>
            <p className="group-note">
              Open it from the orb in the top-left or with {shortcut('⌘K', 'Ctrl+K')}. Keys are encrypted with your Mac’s
              keychain and only sent to the provider you choose. The page you’re on is shared only while “Use this page” is on.
            </p>
          </section>

          <section id="settings-downloads" data-section="downloads" className="settings-section">
            <h2 className="group-title">Downloads</h2>
            <div className="group">
              <DownloadSettings />
            </div>
          </section>

          <section id="settings-privacy" data-section="privacy" className="settings-section">
            <h2 className="group-title">Privacy & shields</h2>
            <div className="group">
              <ShieldSettings />
            </div>
            <p className="group-note">
              The shield in the address bar shows what was blocked on each page, and switches shields off for a site that misbehaves.
            </p>
            <h2 className="group-title settings-subgroup">Clear data</h2>
            <div className="group">
              <Row title="Clear history" sub="Every page you visited and the addresses you typed">
                {done.history
                  ? <span className="row-trailing">Cleared</span>
                  : <ConfirmButton onConfirm={() => { onClearHistory(); mark('history') }} confirmLabel="Clear history?">Clear</ConfirmButton>}
              </Row>
              <Row title="Clear cookies and cached files" sub="Signs you out of most sites">
                {done.cookies
                  ? <span className="row-trailing">Cleared</span>
                  : <ConfirmButton onConfirm={async () => { await window.electronAPI?.clearBrowsingData?.(); mark('cookies') }} confirmLabel="Clear cookies?">Clear</ConfirmButton>}
              </Row>
              <Row title="Reset A4" sub="History, bookmarks and all settings go back to the start">
                <ConfirmButton
                  onConfirm={async () => {
                    await window.electronAPI?.clearBrowsingData?.().catch(() => {})
                    window.localStorage?.clear()
                    setTimeout(() => window.location.reload(), 300)
                  }}
                  confirmLabel="Reset everything?"
                >
                  Reset…
                </ConfirmButton>
              </Row>
            </div>
          </section>

          <section id="settings-vpn" data-section="vpn" className="settings-section">
            <h2 className="group-title">VPN & proxy</h2>
            <div className="group">
              <VpnSettings />
            </div>
            <p className="group-note">
              A4 doesn’t include a VPN service. It connects to one you already use: many VPN providers offer a SOCKS5 or
              HTTP proxy, and Tor offers SOCKS5 on 127.0.0.1:9050. If the VPN is unreachable, pages won’t load rather than
              quietly skipping it.
            </p>
          </section>

          <section id="settings-extensions" data-section="extensions" className="settings-section">
            <h2 className="group-title">Extensions</h2>
            <div className="group">
              <button type="button" className="row" onClick={() => onNavigate('a4://extensions')}>
                <span className="row-main">
                  <span className="row-title">Manage extensions</span>
                  <span className="row-sub settings-sub">Add, reload or remove unpacked Chrome extensions</span>
                </span>
                <svg className="row-chevron" width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
                  <path d="M4.5 2.5L8 6L4.5 9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          </section>

          <section id="settings-shortcuts" data-section="shortcuts" className="settings-section">
            <h2 className="group-title">Keyboard shortcuts</h2>
            <div className="group settings-shortcuts">
              {SHORTCUTS.map(([label, keys]) => (
                <div key={label} className="settings-shortcut">
                  <span>{label}</span>
                  <span className="kbd">{keys}</span>
                </div>
              ))}
            </div>
          </section>

          <section id="settings-about" data-section="about" className="settings-section">
            <h2 className="group-title">About</h2>
            <div className="group">
              <div className="row settings-about">
                <span className="settings-about-mark" aria-hidden>A4</span>
                <span className="row-main">
                  <span className="row-title">A4 Web Explorer</span>
                  <span className="row-sub settings-sub">
                    Version 1.0{versions ? ` · Chromium ${versions.chrome} · Electron ${versions.electron}` : ''}
                  </span>
                </span>
              </div>
            </div>
            <p className="group-note">
              Paintings on the new tab page are public-domain works, shown via Wikimedia Commons.
              Click a painting’s label to read about it.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}

export default Settings
