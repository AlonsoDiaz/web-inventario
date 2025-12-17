import { useMemo } from 'react'

import { formatChileanPhone } from '../utils/phoneInput'

const normalizeText = (value) => {
  if (value == null) {
    return ''
  }
  return value
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

const formatCurrency = (value) => {
  const amount = Number.isFinite(Number(value)) ? Number(value) : 0
  return `$${amount.toLocaleString('es-CL')}`
}

const ClientDirectoryPanel = ({ clients = [], pendingSummary = new Map(), searchTerm = '' }) => {
  const normalizedSearch = useMemo(() => normalizeText(searchTerm), [searchTerm])

  const rows = useMemo(() => {
    return clients.map((client) => {
      const summary = pendingSummary.get(client.id)
      return {
        ...client,
        pendingOrderCount: summary?.orderCount ?? 0,
        pendingAmount: summary?.totalAmount ?? 0,
        pendingUnits: summary?.totalUnits ?? 0,
        latestOrderAt: summary?.latestOrderAt ?? null,
      }
    })
  }, [clients, pendingSummary])

  const filteredRows = useMemo(() => {
    if (!normalizedSearch) {
      return rows
    }

    return rows.filter((row) => {
      const haystacks = [
        row.nombreCompleto,
        row.telefono,
        row.direccion,
        row.comuna,
        row.diaReparto,
      ]
        .filter(Boolean)
        .map((value) => normalizeText(value))

      if (haystacks.some((value) => value.includes(normalizedSearch))) {
        return true
      }

      const pendingValues = [
        row.pendingOrderCount?.toString(),
        row.pendingUnits?.toString(),
        row.pendingAmount?.toString(),
      ]
        .filter(Boolean)
        .map((value) => normalizeText(value))

      return pendingValues.some((value) => value.includes(normalizedSearch))
    })
  }, [rows, normalizedSearch])

  const directoryTotal = rows.length
  const pendingClientsTotal = rows.filter((row) => row.pendingOrderCount > 0).length
  const filteredPendingAmount = filteredRows.reduce((acc, row) => acc + (row.pendingAmount || 0), 0)

  return (
    <section className="panel client-directory-panel" aria-label="Directorio de clientes">
      <header className="panel-header">
        <div>
          <h2>Directorio de clientes</h2>
          <p>Registro general con detalle de contacto y pedidos pendientes.</p>
        </div>
      </header>

      <div className="client-directory-summary">
        <p>
          <strong>Total registrados:</strong> {directoryTotal}
        </p>
        <p>
          <strong>Con pedidos pendientes:</strong> {pendingClientsTotal}
        </p>
        <p>
          <strong>Monto pendiente (vista actual):</strong> {formatCurrency(filteredPendingAmount)}
        </p>
      </div>

      {filteredRows.length === 0 ? (
        <p className="empty-state">
          {directoryTotal === 0
            ? 'Aún no hay clientes registrados.'
            : 'No hay clientes que coincidan con el término de búsqueda.'}
        </p>
      ) : (
        <div className="table-wrapper">
          <table className="client-directory-table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Contacto</th>
                <th>Dirección</th>
                <th>Comuna</th>
                <th>Día reparto</th>
                <th>Pedidos pendientes</th>
                <th>Monto pendiente</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr key={row.id}>
                  <td>{row.nombreCompleto}</td>
                  <td>
                    <div>{formatChileanPhone(row.telefono) || '—'}</div>
                  </td>
                  <td>{row.direccion || '—'}</td>
                  <td>{row.comuna || '—'}</td>
                  <td>{row.diaReparto || 'Sin asignar'}</td>
                  <td>
                    {row.pendingOrderCount > 0 ? (
                      <span className="status-pill status-pill-warning">
                        {row.pendingOrderCount} pedido{row.pendingOrderCount === 1 ? '' : 's'}
                      </span>
                    ) : (
                      <span className="status-pill status-pill-success">Sin pendientes</span>
                    )}
                  </td>
                  <td>
                    {row.pendingOrderCount > 0 ? formatCurrency(row.pendingAmount) : formatCurrency(0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

export default ClientDirectoryPanel
