import { useEffect, useMemo, useState } from 'react'

const DEFAULT_DIAS_REPARTO = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

const toFormState = (client) => {
  if (!client) {
    return {
      nombreCompleto: '',
      telefono: '',
      direccion: '',
      comuna: '',
      diaReparto: '',
    }
  }

  return {
    nombreCompleto: client.nombreCompleto ?? '',
    telefono: client.telefono ?? '',
    direccion: client.direccion ?? '',
    comuna: client.comuna ?? '',
    diaReparto: client.diaReparto ?? '',
  }
}

const ClientEditForm = ({ clients = [], comunas = [], diasReparto = [], onSubmit, submitting }) => {
  const [selectedId, setSelectedId] = useState('')
  const [form, setForm] = useState(() => toFormState(null))

  const deliveryOptions = diasReparto.length ? diasReparto : DEFAULT_DIAS_REPARTO

  useEffect(() => {
    if (selectedId && !clients.some((client) => client.id === selectedId)) {
      setSelectedId('')
    }
  }, [clients, selectedId])

  useEffect(() => {
    if (!selectedId && clients.length > 0) {
      setSelectedId(clients[0].id)
    }
  }, [clients, selectedId])

  const selectedClient = useMemo(
    () => clients.find((client) => client.id === selectedId) || null,
    [clients, selectedId],
  )

  useEffect(() => {
    setForm(toFormState(selectedClient))
  }, [selectedClient?.id])

  const updateField = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }))
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    if (!selectedClient) {
      return
    }

    onSubmit?.({
      clientId: selectedClient.id,
      updates: {
        nombreCompleto: form.nombreCompleto,
        telefono: form.telefono,
        direccion: form.direccion,
        comuna: form.comuna,
        diaReparto: form.diaReparto,
      },
    })
  }

  return (
    <form onSubmit={handleSubmit} className="form-grid">
      <label>
        <span>Seleccionar cliente</span>
        <select value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
          <option value="">Selecciona un cliente</option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.nombreCompleto} · {client.comuna || 'Sin comuna'}
            </option>
          ))}
        </select>
      </label>

      {selectedClient ? (
        <>
          <p className="form-context">
            Editando <strong>{selectedClient.nombreCompleto}</strong>
          </p>
          <label>
            <span>Nombre completo</span>
            <input type="text" required value={form.nombreCompleto} onChange={updateField('nombreCompleto')} />
          </label>
          <label>
            <span>Teléfono</span>
            <input type="tel" required value={form.telefono} onChange={updateField('telefono')} />
          </label>
          <label>
            <span>Dirección</span>
            <input type="text" required value={form.direccion} onChange={updateField('direccion')} />
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
              {deliveryOptions.map((dia) => (
                <option key={dia} value={dia}>
                  {dia}
                </option>
              ))}
            </select>
          </label>
        </>
      ) : (
        clients.length > 0 && (
          <p className="form-context">Selecciona un cliente para habilitar la edición.</p>
        )
      )}

      <div className="form-actions">
        <button type="submit" className="primary-button" disabled={submitting || !selectedClient}>
          {submitting ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </div>
    </form>
  )
}

export default ClientEditForm
