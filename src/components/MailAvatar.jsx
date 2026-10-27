import { useEffect, useRef, useState } from 'react'
import { MAIL_PROVIDERS, initialOf, providerFor } from '../utils/mail'
import { toNavigableUrl } from '../utils/url'
import './MailAvatar.css'

const PersonIcon = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
    <circle cx="8" cy="5.6" r="2.8" stroke="currentColor" strokeWidth="1.3" />
    <path d="M2.8 13.6C3.4 11.2 5.5 9.8 8 9.8C10.5 9.8 12.6 11.2 13.2 13.6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
  </svg>
)

export function Avatar({ account, size = 30, unread = 0 }) {
  const { color } = providerFor(account)
  return (
    <span
      className="mail-avatar"
      style={{ width: size, height: size, fontSize: size * 0.46, '--mail-color': color }}
      aria-hidden
    >
      <span className="mail-avatar-fill" />
      <span className="mail-avatar-initial">{initialOf(account)}</span>
      {unread > 0 && <span className="mail-avatar-badge">{unread > 99 ? '99+' : unread}</span>}
    </span>
  )
}

// Pick a provider; signing in happens on the provider's own page
function ProviderChooser({ onPick }) {
  const [custom, setCustom] = useState(false)
  return (
    <div className="mail-chooser">
      <p className="mail-chooser-title">Sign in to your mail</p>
      <p className="mail-chooser-text">You’ll sign in on your provider’s own page. A4 never sees your password.</p>
      <div className="mail-providers">
        {Object.entries(MAIL_PROVIDERS).map(([id, p]) => (
          <button key={id} type="button" className="mail-provider" onClick={() => onPick({ provider: id })}>
            <span className="mail-provider-dot" style={{ background: p.color }} />
            {p.name}
          </button>
        ))}
        {custom ? (
          <form
            className="mail-custom"
            onSubmit={(e) => {
              e.preventDefault()
              const url = toNavigableUrl(e.target.elements.url.value)
              if (url && /^https?:/.test(url)) onPick({ provider: 'custom', inbox: url })
            }}
          >
            <label className="field">
              <input name="url" autoFocus placeholder="mail.example.com" spellCheck="false" aria-label="Webmail address" />
            </label>
            <button type="submit" className="btn">Go</button>
          </form>
        ) : (
          <button type="button" className="mail-provider mail-provider-other" onClick={() => setCustom(true)}>Other…</button>
        )}
      </div>
    </div>
  )
}

function MailAvatar({ variant, accounts, unread, onOpenMail, onSignIn, onRemove }) {
  const [panel, setPanel] = useState(null) // 'choose' | 'accounts'
  const ref = useRef(null)
  const connected = accounts.filter(a => a.connected)
  const primary = connected[0]
  const pending = accounts.find(a => !a.connected)

  useEffect(() => {
    if (!panel) return
    const close = () => setPanel(null)
    const onDown = (e) => { if (!ref.current?.contains(e.target)) close() }
    const onKey = (e) => { if (e.key === 'Escape') close() }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    window.addEventListener('blur', close)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('blur', close)
    }
  }, [panel])

  if (variant === 'toolbar' && !primary) return null

  const pick = (choice) => {
    setPanel(null)
    onSignIn(choice)
  }

  const accountsMenu = (
    <div className="mail-menu">
      {connected.map(a => (
        <div key={a.id} className="mail-menu-row">
          <button type="button" className="mail-menu-account" onClick={() => { setPanel(null); onOpenMail(a) }}>
            <Avatar account={a} size={28} />
            <span className="mail-menu-text">
              <span className="mail-menu-email">{a.email || providerFor(a).name}</span>
              <span className="mail-menu-provider">Open {providerFor(a).name}</span>
            </span>
          </button>
          <button type="button" className="mail-menu-remove" title="Remove from A4" aria-label={`Remove ${a.email || providerFor(a).name}`} onClick={() => onRemove(a)}>×</button>
        </div>
      ))}
      <button type="button" className="mail-menu-add" onClick={() => setPanel('choose')}>
        <PersonIcon /> Add another account
      </button>
    </div>
  )

  const openAccounts = (e) => {
    e.preventDefault()
    setPanel(panel ? null : 'accounts')
  }

  return (
    <div className={`mail mail-${variant}`} ref={ref}>
      {primary ? (
        <>
          <button
            type="button"
            className="mail-avatar-btn"
            onClick={() => onOpenMail(primary)}
            onContextMenu={openAccounts}
            title={`Open ${providerFor(primary).name}${primary.email ? ` · ${primary.email}` : ''} (right-click for accounts)`}
            aria-label={`Open ${providerFor(primary).name}`}
          >
            <Avatar account={primary} size={variant === 'home' ? 28 : 24} unread={unread} />
          </button>
          {variant === 'home' && (
            <button type="button" className="mail-caret" onClick={openAccounts} aria-label="Accounts" aria-expanded={panel === 'accounts'} title="Accounts">
              <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden><path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
          )}
        </>
      ) : (
        <button type="button" className="mail-signin" onClick={() => setPanel(panel ? null : 'choose')}>
          <PersonIcon />
          {pending ? 'Finish signing in' : 'Sign in'}
        </button>
      )}

      {panel && (
        <div className="mail-panel" role="dialog" aria-label="Mail accounts">
          {panel === 'choose' ? <ProviderChooser onPick={pick} /> : accountsMenu}
        </div>
      )}
    </div>
  )
}

export default MailAvatar
