import './NavigationButtons.css'

function NavigationButtons({ onBack, onForward, onRefresh }) {
  return (
    <div className="navigation-buttons">
      <button
        className="nav-button"
        onClick={onBack}
        aria-label="Back"
        title="Back"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path
            d="M10 12L6 8L10 4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <button
        className="nav-button"
        onClick={onForward}
        aria-label="Forward"
        title="Forward"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path
            d="M6 12L10 8L6 4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <button
        className="nav-button"
        onClick={onRefresh}
        aria-label="Refresh"
        title="Refresh"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path
            d="M2 8C2 10.2091 3.79086 12 6 12L6 14M14 8C14 5.79086 12.2091 4 10 4L10 2M10 12C12.2091 12 14 10.2091 14 8M6 4C3.79086 4 2 5.79086 2 8"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  )
}

export default NavigationButtons
