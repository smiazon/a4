import { shortcut } from '../utils/env'
import './NavigationButtons.css'

function NavigationButtons({ canGoBack, canGoForward, canReload, loading, onBack, onForward, onRefresh, onStop }) {
  return (
    <div className="navigation-buttons">
      <button
        className="icon-btn"
        onClick={onBack}
        disabled={!canGoBack}
        aria-label="Back"
        title={`Click to go back (${shortcut('⌘[', 'Alt+Left')})`}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path
            d="M10 12L6 8L10 4"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <button
        className="icon-btn"
        onClick={onForward}
        disabled={!canGoForward}
        aria-label="Forward"
        title={`Click to go forward (${shortcut('⌘]', 'Alt+Right')})`}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path
            d="M6 12L10 8L6 4"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {loading ? (
        <button
          className="icon-btn"
          onClick={onStop}
          aria-label="Stop"
          title="Stop loading this page"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M11.5 4.5L4.5 11.5M4.5 4.5L11.5 11.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      ) : (
        <button
          className="icon-btn"
          onClick={onRefresh}
          disabled={!canReload}
          aria-label="Reload"
          title={`Reload this page (${shortcut('⌘R', 'Ctrl+R')})`}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M13 8A5 5 0 1 1 11.5 4.4M13 2.5V5H10.5"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      )}
    </div>
  )
}

export default NavigationButtons
