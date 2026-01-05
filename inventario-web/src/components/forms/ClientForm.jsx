import { useMemo, useState } from 'react'

import { formatChileanPhone, parseChileanPhoneValue } from '../../utils/phoneInput'
import { formatRegionLabel, getRegionOptions } from '../../utils/regions'

const createInitialState = () => ({
  nombreCompleto: '',
  telefono: '',
  telefonoHasCountryCode: false,
  direccion: '',
  comuna: '',
  region: '',
  diaReparto: '',
})

const DEFAULT_DIAS_REPARTO = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

const ClientForm = ({ comunas = [], diasReparto = [], onSubmit, submitting }) => {
  const [form, setForm] = useState(() => createInitialState())
  const optionsDias = diasReparto.length ? diasReparto : DEFAULT_DIAS_REPARTO
  const regionOptions = useMemo(() => getRegionOptions(), [])

  const updateField = (field) => (event) => {
    let { value } = event.target
    if (field === 'telefono') {
      const { digits, hasCountryCode } = parseChileanPhoneValue(value)
      setForm((prev) => ({ ...prev, telefono: digits, telefonoHasCountryCode: hasCountryCode }))
      return
    }
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    const { telefono, telefonoHasCountryCode, region, ...rest } = form
    const trimmedRegion = region.trim()
    const payload = {
      ...rest,
      region: trimmedRegion || undefined,
      telefono: formatChileanPhone(telefono, {
        includeCountryCode: telefonoHasCountryCode,
      }),
    }
    if (!payload.region) {
      delete payload.region
    }
    onSubmit?.(payload, () => setForm(createInitialState()))
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
          inputMode="numeric"
          required
          value={formatChileanPhone(form.telefono, {
            includeCountryCode: form.telefonoHasCountryCode,
          })}
          onChange={updateField('telefono')}
          placeholder="X XXXX XXXX"
          maxLength={16}
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
        <span>Región (opcional)</span>
        <select value={form.region} onChange={updateField('region')}>
          <option value="">Sin región</option>
          {regionOptions.map((regionKey) => (
            <option key={regionKey} value={regionKey}>
              {formatRegionLabel(regionKey)}
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
