import { useMemo, useState } from 'react'

import {
  currencyDigitsToNumber,
  formatCurrencyDisplay,
  sanitizeCurrencyInput,
} from '../../utils/currencyInput'

const createInitialForm = () => ({
  type: 'ingreso',
  amount: '',
  category: '',
  description: '',
  date: new Date().toISOString().slice(0, 10),
})

const CashflowEntryForm = ({ onSubmit, submitting }) => {
  const [form, setForm] = useState(() => createInitialForm())
  const [error, setError] = useState(null)

  const isIncome = useMemo(() => form.type === 'ingreso', [form.type])

  const updateField = (field) => (event) => {
    let { value } = event.target
    if (field === 'amount') {
      value = sanitizeCurrencyInput(value)
    }
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    const parsedAmount = currencyDigitsToNumber(form.amount)

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError('Ingresa un monto válido mayor a cero')
      return
    }

    setError(null)
    const payload = {
      type: form.type,
      amount: parsedAmount,
      category: form.category.trim(),
      description: form.description.trim(),
      date: form.date,
    }

    onSubmit?.(payload, () => setForm(createInitialForm()))
  }

  return (
    <form className="form-grid" onSubmit={handleSubmit}>
      <label>
        <span>Tipo de movimiento</span>
        <select value={form.type} onChange={updateField('type')} disabled={submitting}>
          <option value="ingreso">Ingreso</option>
          <option value="egreso">Egreso</option>
        </select>
      </label>
      <label>
        <span>Monto</span>
        <input
          type="text"
          inputMode="numeric"
          required
          value={formatCurrencyDisplay(form.amount)}
          onChange={updateField('amount')}
          placeholder={isIncome ? 'Ej: 45.000' : 'Ej: 23.500'}
          disabled={submitting}
        />
      </label>
      <label>
        <span>Categoría</span>
        <input
          type="text"
          value={form.category}
          onChange={updateField('category')}
          placeholder="Ej: Compras proveedores"
          disabled={submitting}
        />
      </label>
      <label>
        <span>Fecha</span>
        <input
          type="date"
          value={form.date}
          onChange={updateField('date')}
          required
          disabled={submitting}
        />
      </label>
      <label>
        <span>Notas</span>
        <textarea
          rows="3"
          value={form.description}
          onChange={updateField('description')}
          placeholder="Detalle breve del movimiento"
          disabled={submitting}
        />
      </label>
      {error && <p className="form-error">{error}</p>}
      <div className="form-actions">
        <button type="submit" className="primary-button" disabled={submitting}>
          {submitting ? 'Guardando...' : 'Registrar movimiento'}
        </button>
      </div>
    </form>
  )
}

export default CashflowEntryForm
