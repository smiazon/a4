// Small pieces shared by the internal pages

export const SearchField = ({ value, onChange, placeholder }) => (
  <label className="field rainbow rainbow-subtle">
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="7" cy="7" r="4.6" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10.6 10.6L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
    <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} />
  </label>
)

export const RemoveButton = ({ onClick, label }) => (
  <span
    role="button"
    tabIndex={0}
    className="row-remove"
    aria-label={label}
    title={label}
    onClick={(e) => {
      e.stopPropagation()
      onClick()
    }}
    onKeyDown={(e) => {
      if (e.key === 'Enter') {
        e.stopPropagation()
        onClick()
      }
    }}
  >
    <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path d="M9 3L3 9M3 3L9 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  </span>
)

// iOS-style on/off switch
export const Toggle = ({ checked, onChange, label }) => (
  <button
    type="button"
    role="switch"
    aria-checked={!!checked}
    aria-label={label}
    className="switch"
    onClick={() => onChange(!checked)}
  >
    <span className="switch-knob" />
  </button>
)
