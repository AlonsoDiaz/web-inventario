import { useEffect } from 'react'

const Modal = ({ title, children, onClose, actions }) => {
  useEffect(() => {
    const handler = (event) => {
      if (event.key === 'Escape') {
        onClose?.()
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div className="modal-backdrop" role="presentation">
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-heading"
      >
        <header className="modal-header">
          <h2 id="modal-heading">{title}</h2>
          <button type="button" className="modal-close" onClick={() => onClose?.()}>
            X
          </button>
        </header>
        <div className="modal-body">{children}</div>
        {actions && <footer className="modal-footer">{actions}</footer>}
      </div>
    </div>
  )
}

export default Modal
