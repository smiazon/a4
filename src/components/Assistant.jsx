import { useEffect, useRef, useState } from 'react'
import { shortcut } from '../utils/env'
import { hostOf } from '../utils/url'
import './Assistant.css'

const PROVIDERS = [
  { id: 'anthropic', label: 'Claude' },
  { id: 'openai', label: 'ChatGPT' },
  { id: 'gemini', label: 'Gemini' },
]

const PAGE_PROMPTS = ['Summarize this page', 'What are the key points?', 'Explain it simply']
const PLAIN_PROMPTS = ['Explain something simply', 'Help me write an email', 'Plan my afternoon']

// ---- A tiny, safe formatter: builds React elements, never HTML -------------

const INLINE = /(`[^`\n]+`|\*\*[^*\n]+\*\*|\[[^\]\n]+\]\(https?:\/\/[^\s)]+\)|https?:\/\/[^\s<>()]+[^\s<>().,;:!?'"])/g

function renderInline(text, onOpenUrl, keyPrefix) {
  return text.split(INLINE).map((part, i) => {
    const key = `${keyPrefix}-${i}`
    if (!part) return null
    if (part.startsWith('`') && part.endsWith('`')) return <code key={key}>{part.slice(1, -1)}</code>
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={key}>{part.slice(2, -2)}</strong>
    const link = part.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/)
    const url = link ? link[2] : /^https?:\/\//.test(part) ? part : null
    if (url) {
      return (
        <a key={key} href={url} onClick={(e) => { e.preventDefault(); onOpenUrl(url) }} title={url}>
          {link ? link[1] : hostOf(url)}
        </a>
      )
    }
    return part
  })
}

function renderMarkdown(text, onOpenUrl) {
  const out = []
  text.split(/```[^\n]*\n?/).forEach((chunk, i) => {
    if (i % 2 === 1) {
      out.push(<pre key={`pre-${i}`}><code>{chunk.replace(/\n$/, '')}</code></pre>)
      return
    }
    chunk.split(/\n{2,}/).forEach((block, j) => {
      const lines = block.split('\n').filter(l => l.trim())
      if (!lines.length) return
      const key = `${i}-${j}`
      if (lines.every(l => /^\s*[-*•]\s+/.test(l))) {
        out.push(<ul key={key}>{lines.map((l, k) => <li key={k}>{renderInline(l.replace(/^\s*[-*•]\s+/, ''), onOpenUrl, `${key}-${k}`)}</li>)}</ul>)
      } else if (lines.every(l => /^\s*\d+[.)]\s+/.test(l))) {
        out.push(<ol key={key}>{lines.map((l, k) => <li key={k}>{renderInline(l.replace(/^\s*\d+[.)]\s+/, ''), onOpenUrl, `${key}-${k}`)}</li>)}</ol>)
      } else if (/^#{1,4}\s/.test(lines[0]) && lines.length === 1) {
        out.push(<h4 key={key}>{renderInline(lines[0].replace(/^#{1,4}\s/, ''), onOpenUrl, key)}</h4>)
      } else {
        out.push(
          <p key={key}>
            {lines.map((l, k) => (
              <span key={k}>{k > 0 && <br />}{renderInline(l.replace(/^#{1,4}\s/, ''), onOpenUrl, `${key}-${k}`)}</span>
            ))}
          </p>
        )
      }
    })
  })
  return out
}

// ---- Panel -----------------------------------------------------------------------

function Assistant({ open, onClose, getPage, pageInfo, onOpenUrl, onOpenSettings, onBusyChange, connectRequest }) {
  const api = typeof window !== 'undefined' ? window.electronAPI?.assistant : null
  const [config, setConfig] = useState(null)
  const [models, setModels] = useState([])
  const [view, setView] = useState('chat') // 'chat' | 'connect'
  const [connectForm, setConnectForm] = useState({ provider: 'anthropic', key: '', error: '', pending: false })
  const [modelMenu, setModelMenu] = useState(false)
  const [messages, setMessages] = useState([]) // { role, content, requestId?, streaming?, error? }
  const [input, setInput] = useState('')
  const [busyId, setBusyId] = useState(null)
  const [usePage, setUsePage] = useState(true)
  const listRef = useRef(null)
  const inputRef = useRef(null)

  const connected = config && Object.values(config.providers).some(p => p.connected)
  const provider = config?.provider
  const model = config?.models?.[provider]

  // Load settings, and reload when Settings changes them
  useEffect(() => {
    const load = () => api?.getConfig().then(setConfig).catch(() => {})
    load()
    window.addEventListener('assistant-config-changed', load)
    return () => window.removeEventListener('assistant-config-changed', load)
  }, [])

  // "Connect…" from Settings opens the form for that provider
  useEffect(() => {
    if (!connectRequest) return
    setConnectForm({ provider: connectRequest.provider, key: '', error: '', pending: false })
    setView('connect')
  }, [connectRequest])

  // Model list for the current provider (for the picker)
  useEffect(() => {
    if (!open || !connected || !provider || !config.providers[provider]?.connected) return
    api.listModels(provider).then(r => setModels(r.models || [])).catch(() => {})
  }, [open, provider, connected])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 60)
  }, [open, view])

  useEffect(() => { onBusyChange?.(!!busyId) }, [busyId])

  // Streamed reply events from the main process
  useEffect(() => {
    if (!api) return
    const offDelta = api.onDelta(({ requestId, text }) => {
      setMessages(prev => prev.map(m => (m.requestId === requestId ? { ...m, content: m.content + text } : m)))
    })
    const offDone = api.onDone(({ requestId, error, stopReason }) => {
      setMessages(prev => prev.map(m => {
        if (m.requestId !== requestId) return m
        const note = stopReason === 'refusal' ? 'The model declined to answer this.' : null
        return { ...m, streaming: false, error: error || (!m.content && note) || null }
      }))
      setBusyId(id => (id === requestId ? null : id))
    })
    return () => { offDelta(); offDone() }
  }, [])

  // Keep the newest message in view
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [messages])

  const send = async (text) => {
    const content = text.trim()
    if (!content || busyId || !api) return
    const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    const history = [...messages.filter(m => m.content && !m.error), { role: 'user', content }]
    setMessages([...history, { role: 'assistant', content: '', requestId, streaming: true }])
    setInput('')
    setBusyId(requestId)
    const page = usePage && pageInfo ? await getPage() : null
    api.chat(requestId, history.map(({ role, content: c }) => ({ role, content: c })), page)
  }

  const stop = () => busyId && api?.cancel(busyId)

  const connect = async (e) => {
    e.preventDefault()
    setConnectForm(f => ({ ...f, pending: true, error: '' }))
    const result = await api.connect(connectForm.provider, connectForm.key)
    if (result.error) {
      setConnectForm(f => ({ ...f, pending: false, error: result.error }))
      return
    }
    setConfig(result.config)
    setModels(result.models || [])
    window.dispatchEvent(new Event('assistant-config-changed'))
    setConnectForm({ provider: connectForm.provider, key: '', error: '', pending: false })
    setView('chat')
  }

  const choose = async (nextProvider, nextModel) => {
    setModelMenu(false)
    setConfig(await api.select(nextProvider, nextModel))
    window.dispatchEvent(new Event('assistant-config-changed'))
  }

  if (!api) {
    return open ? (
      <div className="assistant is-open">
        <p className="assistant-empty-note">The assistant needs the desktop app.</p>
      </div>
    ) : null
  }

  const providerLabel = PROVIDERS.find(p => p.id === provider)?.label
  const modelLabel = models.find(m => m.id === model)?.name || model
  const showConnect = view === 'connect' || (config && !connected)
  const keyUrl = config?.providers?.[connectForm.provider]?.keyUrl

  return (
    <div
      className={`assistant${open ? ' is-open' : ''}`}
      role="dialog"
      aria-label="AI assistant"
      aria-hidden={!open}
      onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}
    >
      <header className="assistant-header">
        <span className="assistant-orb" aria-hidden />
        {connected && !showConnect ? (
          <div className="assistant-model">
            <button type="button" className="assistant-model-btn" onClick={() => setModelMenu(m => !m)} title="Choose model">
              <span className="assistant-model-provider">{providerLabel}</span>
              <span className="assistant-model-name">{modelLabel}</span>
              <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden><path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
            {modelMenu && (
              <div className="assistant-model-menu">
                {PROVIDERS.filter(p => config.providers[p.id]?.connected).map(p => (
                  <div key={p.id} className="assistant-model-group">
                    <div className="assistant-model-group-title">{p.label}</div>
                    {(p.id === provider ? models : [{ id: config.models[p.id], name: config.models[p.id] }]).slice(0, 12).map(m => (
                      <button
                        key={m.id}
                        type="button"
                        className={`assistant-model-option${p.id === provider && m.id === model ? ' is-selected' : ''}`}
                        onClick={() => choose(p.id, m.id)}
                      >
                        {m.name}
                      </button>
                    ))}
                  </div>
                ))}
                <button type="button" className="assistant-model-option assistant-model-add" onClick={() => { setModelMenu(false); setView('connect') }}>
                  Connect another AI…
                </button>
              </div>
            )}
          </div>
        ) : (
          <span className="assistant-title">Assistant</span>
        )}
        <div className="assistant-header-actions">
          {connected && !showConnect && (
            <button type="button" className="icon-btn" onClick={() => setMessages([])} title="New chat" aria-label="New chat" disabled={!messages.length || !!busyId}>
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden><path d="M11 2.5L13.5 5L6.5 12H4V9.5L11 2.5Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /><path d="M3 14.5H13" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>
            </button>
          )}
          <button type="button" className="icon-btn" onClick={onOpenSettings} title="Assistant settings" aria-label="Assistant settings">
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden><circle cx="8" cy="8" r="2.2" stroke="currentColor" strokeWidth="1.3" /><path d="M8 1.8V3.6M8 12.4V14.2M14.2 8H12.4M3.6 8H1.8M12.4 3.6L11.1 4.9M4.9 11.1L3.6 12.4M12.4 12.4L11.1 11.1M4.9 4.9L3.6 3.6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>
          </button>
          <button type="button" className="icon-btn" onClick={onClose} title="Close (Esc)" aria-label="Close assistant">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden><path d="M9 3L3 9M3 3L9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
          </button>
        </div>
      </header>

      {showConnect ? (
        <form className="assistant-connect" onSubmit={connect}>
          <h3 className="assistant-connect-title">Connect an AI</h3>
          <p className="assistant-connect-text">
            Choose a provider and paste an API key from its developer console. Your key is encrypted with your
            Mac’s keychain and only ever sent to that provider.
          </p>
          <div className="segmented assistant-providers" role="group" aria-label="Provider">
            {PROVIDERS.map(p => (
              <button key={p.id} type="button" aria-pressed={connectForm.provider === p.id} onClick={() => setConnectForm(f => ({ ...f, provider: p.id, error: '' }))}>
                {p.label}
              </button>
            ))}
          </div>
          <label className="field assistant-key rainbow rainbow-subtle">
            <input
              type="password"
              autoComplete="off"
              spellCheck="false"
              placeholder={`${PROVIDERS.find(p => p.id === connectForm.provider)?.label} API key`}
              value={connectForm.key}
              onChange={(e) => setConnectForm(f => ({ ...f, key: e.target.value, error: '' }))}
              ref={inputRef}
            />
          </label>
          {connectForm.error && <p className="assistant-error">{connectForm.error}</p>}
          <div className="assistant-connect-actions">
            {keyUrl && (
              <button type="button" className="btn btn-ghost" onClick={() => onOpenUrl(keyUrl)}>Get a key ↗</button>
            )}
            {connected && (
              <button type="button" className="btn btn-ghost" onClick={() => setView('chat')}>Cancel</button>
            )}
            <button type="submit" className="btn btn-primary" disabled={!connectForm.key.trim() || connectForm.pending}>
              {connectForm.pending ? 'Checking…' : 'Connect'}
            </button>
          </div>
          {config && !config.encryption && (
            <p className="assistant-error">Secure key storage isn’t available on this system, so keys can’t be saved.</p>
          )}
        </form>
      ) : (
        <>
          <div className="assistant-messages" ref={listRef}>
            {messages.length === 0 ? (
              <div className="assistant-welcome">
                <p className="assistant-welcome-title">How can I help?</p>
                <div className="assistant-suggestions">
                  {(pageInfo ? PAGE_PROMPTS : PLAIN_PROMPTS).map(s => (
                    <button key={s} type="button" className="assistant-suggestion" onClick={() => send(s)}>{s}</button>
                  ))}
                </div>
              </div>
            ) : messages.map((m, i) => (
              <div key={m.requestId || i} className={`assistant-msg assistant-msg-${m.role}${m.error ? ' is-error' : ''}`}>
                {m.role === 'user'
                  ? m.content
                  : m.error
                    ? m.error
                    : m.content
                      ? renderMarkdown(m.content, onOpenUrl)
                      : <span className="assistant-typing" aria-label="Thinking"><i /><i /><i /></span>}
                {m.streaming && m.content && <span className="assistant-caret" aria-hidden />}
              </div>
            ))}
          </div>

          <form
            className="assistant-composer"
            onSubmit={(e) => {
              e.preventDefault()
              send(input)
            }}
          >
            {pageInfo && (
              <button
                type="button"
                className={`assistant-page-chip${usePage ? ' is-on' : ''}`}
                onClick={() => setUsePage(u => !u)}
                title={usePage ? 'The current page is shared with the AI' : 'Click to share the current page with the AI'}
              >
                {pageInfo.favicon && <img src={pageInfo.favicon} alt="" />}
                <span>{usePage ? 'Using' : 'Use'} {pageInfo.host}</span>
              </button>
            )}
            <div className="assistant-input rainbow">
              <textarea
                ref={inputRef}
                rows={1}
                value={input}
                placeholder={pageInfo && usePage ? 'Ask about this page…' : 'Ask anything…'}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    send(input)
                  }
                }}
              />
              {busyId ? (
                <button type="button" className="assistant-send is-stop" onClick={stop} title="Stop" aria-label="Stop">
                  <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden><rect width="10" height="10" rx="2" fill="currentColor" /></svg>
                </button>
              ) : (
                <button type="submit" className="assistant-send" disabled={!input.trim()} title="Send (Return)" aria-label="Send">
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden><path d="M8 13V3M8 3L3.5 7.5M8 3L12.5 7.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </button>
              )}
            </div>
            <p className="assistant-hint">{shortcut('⌘K', 'Ctrl+K')} to open or close · Return to send · AI can make mistakes</p>
          </form>
        </>
      )}
    </div>
  )
}

export default Assistant
