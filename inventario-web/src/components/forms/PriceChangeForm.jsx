import { useEffect, useState } from 'react'

import {
  currencyDigitsToNumber,
  formatCurrencyDisplay,
  sanitizeCurrencyInput,
  toCurrencyDigits,
} from '../../utils/currencyInput'

const PriceChangeForm = ({ product, onSubmit, submitting }) => {
  const [price, setPrice] = useState(() => toCurrencyDigits(product?.unitPrice))

  useEffect(() => {
    setPrice(toCurrencyDigits(product?.unitPrice))
  }, [product])

  if (!product) {
    return <p>Selecciona un producto desde la tabla para actualizar el precio.</p>
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    onSubmit?.({ unitPrice: currencyDigitsToNumber(price) })
  }

  return (
    <form onSubmit={handleSubmit} className="form-grid">
      <p className="form-context">
        Precio actual de <strong>{product.name}</strong>
      </p>
      <label>
        <span>Precio unidad ($)</span>
        <input
          type="text"
          inputMode="numeric"
          required
          value={formatCurrencyDisplay(price)}
          onChange={(event) => setPrice(sanitizeCurrencyInput(event.target.value))}
        />
      </label>
      <div className="form-actions">
        <button type="submit" className="primary-button" disabled={submitting}>
          {submitting ? 'Actualizando...' : 'Actualizar precio'}
        </button>
      </div>
    </form>
  )
}

export default PriceChangeForm
