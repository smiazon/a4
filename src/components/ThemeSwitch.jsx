// One switch for light ⇄ dark: a sun on paper, a moon on a starry night
function ThemeSwitch({ theme, onChange }) {
  const dark = theme === 'dark'
  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label="Dark mode"
      title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="switch theme-switch"
      onClick={() => onChange(dark ? 'light' : 'dark')}
    >
      <span className="theme-switch-stars" />
      <span className="switch-knob">
        {dark ? (
          <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
            <path d="M13.5 9.6A5.8 5.8 0 0 1 6.4 2.5a5.8 5.8 0 1 0 7.1 7.1Z" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
            <circle cx="8" cy="8" r="3" fill="currentColor" />
            <path d="M8 1.5V3M8 13V14.5M1.5 8H3M13 8H14.5M3.4 3.4L4.4 4.4M11.6 11.6L12.6 12.6M3.4 12.6L4.4 11.6M11.6 4.4L12.6 3.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
        )}
      </span>
    </button>
  )
}

export default ThemeSwitch
