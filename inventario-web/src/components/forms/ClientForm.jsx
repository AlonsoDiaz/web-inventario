import { useState } from 'react'

const initialState = {
  nombreCompleto: '',
  telefono: '',
  direccion: '',
  comuna: '',
  diaReparto: '',
}

const DEFAULT_DIAS_REPARTO = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

const ClientForm = ({ comunas = [], diasReparto = [], onSubmit, submitting }) => {
  const [form, setForm] = useState(initialState)
  const optionsDias = diasReparto.length ? diasReparto : DEFAULT_DIAS_REPARTO

  const updateField = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }))
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    onSubmit?.(form, () => setForm(initialState))
  }

  return (
    <form onSubmit={handleSubmit} className="form-grid">
      <label>
        <span>Nombre completo</span>
        <input
          type="text"
          required
          value={form.nombreCompleto}
          onChange={updateField('nombreCompleto')}
          placeholder="Ej: Laura Ortiz"
        />
      </label>
      <label>
        <span>Teléfono</span>
        <input
          type="tel"
          required
          value={form.telefono}
          onChange={updateField('telefono')}
          placeholder="959000000"
        />
      </label>
      <label>
        <span>Dirección</span>
        <input
          type="text"
          required
          value={form.direccion}
          onChange={updateField('direccion')}
          placeholder="Av. Principal 123"
        />
      </label>
      <label>
        <span>Comuna</span>
        <select required value={form.comuna} onChange={updateField('comuna')}>
          <option value="">Selecciona comuna</option>
          {comunas.map((comuna) => (
            <option key={comuna} value={comuna}>
              {comuna}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Día de reparto (opcional)</span>
        <select value={form.diaReparto} onChange={updateField('diaReparto')}>
          <option value="">Sin asignar</option>
          {optionsDias.map((dia) => (
            <option key={dia} value={dia}>
              {dia}
            </option>
          ))}
        </select>
      </label>
      <div className="form-actions">
        <button type="submit" className="primary-button" disabled={submitting}>
          {submitting ? 'Guardando...' : 'Guardar cliente'}
        </button>
      </div>
    </form>
  )
}

export default ClientForm
