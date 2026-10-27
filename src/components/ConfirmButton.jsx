import { useEffect, useState } from 'react'

// Destructive button that asks for a second click instead of a dialog
function ConfirmButton({ children, confirmLabel = 'Click again to confirm', onConfirm, disabled, className = '' }) {
  const [armed, setArmed] = useState(false)

  useEffect(() => {
    if (!armed) return
    const id = setTimeout(() => setArmed(false), 3000)
    return () => clearTimeout(id)
  }, [armed])

  return (
    <button
      type="button"
      className={`btn btn-danger${armed ? ' is-armed' : ''} ${className}`}
      disabled={disabled}
      onClick={() => {
        if (armed) {
          setArmed(false)
          onConfirm()
        } else {
          setArmed(true)
        }
      }}
    >
      {armed ? confirmLabel : children}
    </button>
  )
}

export default ConfirmButton
