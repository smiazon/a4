import { useEffect, useRef, useState } from 'react'
import { Toggle } from './PageParts'
import './Shields.css'

const DNS_LABELS = { cloudflare: 'Cloudflare', quad9: 'Quad9', google: 'Google' }

const ShieldIcon = ({ off }) => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
    <path d="M8 1.8L13 3.6V7.6C13 10.6 10.9 13 8 14.2C5.1 13 3 10.6 3 7.6V3.6L8 1.8Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" fill={off ? 'none' : 'currentColor'} fillOpacity={off ? 0 : 0.14} />
    {off && <path d="M3.5 13.5L12.5 2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />}
  </svg>
)

// Shield in the address bar: what was blocked on this page, and an on/off switch
// for the site. Settings live in Settings → Privacy & shields.
function Shields({ host, stats, prefs, isPrivate, onToggleSite, onOpenPopup, onOpenSettings }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
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
  }, [open])

  if (!prefs) return null

  const siteOff = prefs.allowlist.some(h => host === h || host.endsWith('.' + h))
  const blocked = stats?.blocked || 0
  const popups = stats?.popups || 0
  const total = blocked + popups
  const { mode, host: proxyHost, port } = prefs.proxy
  const vpnOn = proxyHost && port && (mode === 'always' || (mode === 'private' && isPrivate))
  const anyShield = prefs.adblock || prefs.popups

  return (
    <div className="shields" ref={ref}>
      <button
        type="button"
        className={`address-bar-action shields-btn${siteOff || !anyShield ? ' is-off' : ''}${total ? ' has-count' : ''}`}
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        title={siteOff ? `Shields are down for ${host}` : total ? `${total} blocked on this page` : 'Shields'}
      >
        <ShieldIcon off={siteOff || !anyShield} />
        {!siteOff && total > 0 && <span className="shields-count">{total > 99 ? '99+' : total}</span>}
      </button>

      {open && (
        <div className="shields-panel" role="dialog" aria-label="Shields">
          <div className="shields-head">
            <span className={`shields-head-icon${siteOff ? ' is-off' : ''}`}><ShieldIcon off={siteOff} /></span>
            <span className="shields-head-text">
              <span className="shields-title">Shields {siteOff ? 'down' : 'up'}</span>
              <span className="shields-host">{host}</span>
            </span>
            <Toggle checked={!siteOff} label={`Shields for ${host}`} onChange={(on) => onToggleSite(host, on)} />
          </div>

          {siteOff ? (
            <p className="shields-note">Ads, trackers and pop-ups are allowed on this site. The page reloads when you switch.</p>
          ) : (
            <ul className="shields-list">
              <li>
                <span className="shields-num">{prefs.adblock ? blocked : '—'}</span>
                <span>{prefs.adblock ? 'ads & trackers blocked' : 'Ad blocking is off'}</span>
              </li>
              <li>
                <span className="shields-num">{prefs.popups ? popups : '—'}</span>
                <span>{prefs.popups ? 'pop-ups blocked' : 'Pop-up blocking is off'}</span>
                {popups > 0 && stats?.lastPopup && (
                  <button type="button" className="link-btn shields-inline" onClick={() => { onOpenPopup(stats.lastPopup); setOpen(false) }}>Open last</button>
                )}
              </li>
              {stats?.upgraded && (
                <li><span className="shields-num shields-check">✓</span><span>Upgraded to a secure connection</span></li>
              )}
              <li>
                <span className={`shields-num shields-dot${vpnOn ? ' is-on' : ''}`} />
                <span>{vpnOn ? `Traffic goes through your VPN (${proxyHost})` : 'VPN off for this window'}</span>
              </li>
              <li>
                <span className={`shields-num shields-dot${prefs.secureDns !== 'off' ? ' is-on' : ''}`} />
                <span>{prefs.secureDns !== 'off' ? `Secure DNS · ${DNS_LABELS[prefs.secureDns]}` : 'Secure DNS off'}</span>
              </li>
            </ul>
          )}

          <button type="button" className="shields-footer" onClick={() => { onOpenSettings(); setOpen(false) }}>
            Privacy & VPN settings
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden><path d="M4.5 2.5L8 6L4.5 9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </div>
      )}
    </div>
  )
}

export default Shields
