import { useState } from 'react'

import {
  formatCurrencyDisplay,
  sanitizeCurrencyInput,
} from '../../utils/currencyInput'

const UNIT_OPTIONS = [
  'Unidad',
  'Docena',
  'Caja',
  'Bandeja',
  'Kilogramo',
  'Gramo',
  'Litro',
  'Mililitro',
  'Bolsa',
  'Pack',
]

const initialState = {
  name: '',
  unitPrice: '',
  category: '',
  notes: '',
  unit: UNIT_OPTIONS[0],
}

const ProductCreateForm = ({ onSubmit, submitting }) => {
  const [form, setForm] = useState(() => ({ ...initialState }))

  const updateField = (field) => (event) => {
    let { value } = event.target
    if (field === 'unitPrice') {
      value = sanitizeCurrencyInput(value)
    }
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    onSubmit?.(form, () => setForm({ ...initialState }))
  }

  return (
    <form onSubmit={handleSubmit} className="form-grid">
      <label>
        <span>Nombre</span>
        <input
          type="text"
          required
          value={form.name}
          onChange={updateField('name')}
          placeholder="Ej: Caja térmica 40L"
        />
      </label>
      <label>
        <span>Categoría</span>
        <input
          type="text"
          value={form.category}
          onChange={updateField('category')}
          placeholder="Ej: Lácteos"
        />
      </label>
      <label>
        <span>Unidad de medida</span>
        <select value={form.unit} onChange={updateField('unit')}>
          {UNIT_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Precio unidad ($)</span>
        <input
          type="text"
          inputMode="numeric"
          value={formatCurrencyDisplay(form.unitPrice)}
          onChange={updateField('unitPrice')}
        />
      </label>
      <label>
        <span>Notas</span>
        <textarea
          rows="3"
          value={form.notes}
          onChange={updateField('notes')}
          placeholder="Observaciones para la compra"
        />
      </label>
      <div className="form-actions">
        <button type="submit" className="primary-button" disabled={submitting}>
          {submitting ? 'Creando...' : 'Crear producto'}
        </button>
      </div>
    </form>
  )
}

export default ProductCreateForm
