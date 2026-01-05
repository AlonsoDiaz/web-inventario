import Modal from './Modal.jsx'

const toneMap = {
  primary: 'confirm-hero-primary',
  success: 'confirm-hero-success',
  danger: 'confirm-hero-danger',
}

const buttonToneClass = {
  primary: 'confirm-button-primary',
  success: 'confirm-button-success',
  danger: 'confirm-button-danger',
}

const ConfirmDialog = ({
  title,
  message,
  detail,
  highlight,
  tone = 'primary',
  variant = 'default',
  accentIcon = null,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  onConfirm,
  onCancel,
  isProcessing = false,
}) => {
  const heroClass = toneMap[tone] || toneMap.primary
  const confirmClass = buttonToneClass[tone] || buttonToneClass.primary
  const isReceiptVariant = variant === 'receipt'
  const fallbackIcon = tone === 'success' ? '✓' : '!'
  const iconSymbol = accentIcon || fallbackIcon

  return (
    <Modal title={title} onClose={onCancel}>
      <div className={`confirm-dialog${isReceiptVariant ? ' confirm-dialog-receipt' : ''}`}>
        {isReceiptVariant ? (
          <div className="confirm-receipt-card">
            <div className="confirm-receipt-header">
              <div className="confirm-receipt-icon" aria-hidden="true">
                {iconSymbol}
              </div>
              <div className="confirm-receipt-amounts">
                {highlight && <p className="confirm-receipt-amount">{highlight}</p>}
                <span className="confirm-receipt-caption">Monto a registrar</span>
              </div>
              <span className="confirm-receipt-tag">Cobranza</span>
            </div>
            {detail && <p className="confirm-receipt-detail">{detail}</p>}
            <div className="confirm-receipt-meta">
              <div>
                <p className="confirm-receipt-label">Estado</p>
                <strong>Pasará a pagada</strong>
              </div>
              <div>
                <p className="confirm-receipt-label">Registro</p>
                <strong>Ingresos del día</strong>
              </div>
            </div>
          </div>
        ) : (
          <div className={`confirm-hero ${heroClass}`}>
            <div className="confirm-hero-content">
              <div className="confirm-hero-icon" aria-hidden="true">
                {iconSymbol}
              </div>
              {highlight && <span className="confirm-hero-highlight">{highlight}</span>}
            </div>
          </div>
        )}
        <div className="confirm-copy">
          <p className="confirm-message">{message}</p>
          {detail && !isReceiptVariant && <p className="confirm-detail">{detail}</p>}
        </div>
        <div className="confirm-actions">
          <button type="button" className="chip-button" onClick={onCancel} disabled={isProcessing}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`confirm-button ${confirmClass}`}
            onClick={onConfirm}
            disabled={isProcessing}
          >
            {isProcessing ? 'Procesando...' : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  )
}

export default ConfirmDialog
