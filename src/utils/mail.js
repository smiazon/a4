// Webmail providers for the account avatar. Signing in happens on the
// provider's own page; A4 only notices when a tab reaches the inbox, and reads
// the address from the inbox's title when the provider shows it there.
export const MAIL_PROVIDERS = {
  gmail: {
    name: 'Gmail',
    color: '#EA4335',
    signIn: 'https://accounts.google.com/ServiceLogin?service=mail&continue=https://mail.google.com/mail/',
    inbox: 'https://mail.google.com/mail/',
    match: /^https:\/\/mail\.google\.com\/mail\//,
  },
  outlook: {
    name: 'Outlook',
    color: '#0F6CBD',
    signIn: 'https://outlook.live.com/mail/0/',
    inbox: 'https://outlook.live.com/mail/0/',
    match: /^https:\/\/outlook\.(live|office|office365)\.com\/mail\//,
  },
  icloud: {
    name: 'iCloud Mail',
    color: '#3693F3',
    signIn: 'https://www.icloud.com/mail/',
    inbox: 'https://www.icloud.com/mail/',
    match: /^https:\/\/www\.icloud\.com\/mail/,
  },
  yahoo: {
    name: 'Yahoo Mail',
    color: '#6001D2',
    signIn: 'https://login.yahoo.com/?.done=https%3A%2F%2Fmail.yahoo.com%2F',
    inbox: 'https://mail.yahoo.com/',
    match: /^https:\/\/mail\.yahoo\.com\//,
  },
  proton: {
    name: 'Proton Mail',
    color: '#6D4AFF',
    signIn: 'https://account.proton.me/mail',
    inbox: 'https://mail.proton.me/',
    match: /^https:\/\/mail\.proton\.me\//,
  },
}

export const MAIL_STORAGE_KEY = 'a4-mail-accounts'

const EMAIL = /[\w.+-]+@[\w-]+(\.[\w-]+)+/

// Provider definition for an account (custom webmail matches its own host)
export function providerFor(account) {
  if (MAIL_PROVIDERS[account.provider]) return MAIL_PROVIDERS[account.provider]
  let host = ''
  try {
    host = new URL(account.inbox).host
  } catch (_) {}
  const escaped = host.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return {
    name: account.name || host || 'Mail',
    color: '#5E584F',
    signIn: account.inbox,
    inbox: account.inbox,
    match: new RegExp(`^https?://${escaped}/`),
  }
}

// From an inbox tab title: "Inbox (3) - jane@gmail.com - Gmail" → { email, unread }
export function readInboxTitle(title = '') {
  const email = (title.match(EMAIL) || [])[0] || null
  const count = title.match(/\((\d+)\)|(\d+)\s+unread/i)
  return { email, unread: count ? Number(count[1] || count[2]) : 0 }
}

export const initialOf = (account) => (account.email || providerFor(account).name || '?').trim()[0].toUpperCase()
