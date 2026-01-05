import { useMemo } from 'react'
import { formatChileanPhone } from '../utils/phoneInput'
import { exportToExcel } from '../utils/export.js'

const formatQuantity = (quantity) => {
  const parsed = Number(quantity)
  if (!Number.isFinite(parsed)) {
    return '0'
  }
  if (Number.isInteger(parsed)) {
    return parsed.toString()
  }
  const fixed = parsed.toFixed(2)
  return fixed.replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1')
}

const DebtsPanel = ({ data, loading = false, limit = null, onRefresh, onMarkPaid }) => {
  const debts = data?.debts ?? []

  const outstandingDebts = useMemo(
    () => debts.filter((debt) => (debt?.status || 'pendiente') !== 'pagada'),
    [debts],
  )

  const visibleDebts = useMemo(() => {
    if (!limit || outstandingDebts.length <= limit) {
      return outstandingDebts
    }
    return outstandingDebts.slice(0, limit)
  }, [limit, outstandingDebts])

  const totalOutstanding = useMemo(
    () => outstandingDebts.reduce((sum, debt) => sum + (Number(debt?.amount) || 0), 0),
    [outstandingDebts],
  )

  const exportColumns = [
    { key: 'client', label: 'Cliente' },
    { key: 'comuna', label: 'Comuna' },
    { key: 'phone', label: 'Contacto' },
    { key: 'orders', label: 'Pedidos' },
    { key: 'items', label: 'Productos' },
    { key: 'amount', label: 'Total adeudado' },
    { key: 'status', label: 'Estado' },
    { key: 'createdAt', label: 'Creado' },
    { key: 'note', label: 'Nota' },
  ]

  const exportRows = outstandingDebts.map((debt) => {
    const clientName = debt.client?.nombreCompleto || 'Cliente'
    const comuna = debt.client?.comuna || ''
    const phone = formatChileanPhone(debt.client?.telefono) || debt.client?.telefono || '—'
    const items = Array.isArray(debt.items)
      ? debt.items
          .map((item) => `${item.name || 'Producto'} x${formatQuantity(item.quantity)} (${item.unit || 'unidad'})`)
          .join(' | ')
      : '—'
    const orders = Array.isArray(debt.orderIds) ? debt.orderIds.length : 0
    const status = (debt.status || 'pendiente').toLowerCase() === 'pagada' ? 'Pagada' : 'Pendiente'
    const createdAt = debt.createdAt ? new Date(debt.createdAt).toLocaleDateString('es-CL') : '—'

    return {
      client: clientName,
      comuna,
      phone,
      orders,
      items,
      amount: Number(debt.amount || 0),
      status,
      createdAt,
      note: debt.note || '',
    }
  })

  const handleExportExcel = () => {
    exportToExcel('deudas.xls', exportColumns, exportRows)
  }

  return (
    <section className="panel" aria-label="Deudores">
      <header className="panel-header">
        <div>
          <h2>Deudores</h2>
          <p>Clientes con deudas registradas y sus productos.</p>
        </div>
        <div className="panel-actions">
          {onRefresh && (
            <button
              type="button"
              className="chip-button"
              onClick={() => onRefresh()}
              disabled={loading}
            >
              {loading ? 'Actualizando...' : 'Actualizar'}
            </button>
          )}
          <button type="button" className="link-button" onClick={handleExportExcel}>
            Exportar Excel
          </button>
        </div>
      </header>

      {loading ? (
        <p className="empty-state">Cargando deudas...</p>
      ) : outstandingDebts.length === 0 ? (
        <p className="empty-state">No hay deudas registradas.</p>
      ) : (
        <>
          <div className="pending-summary">
            <p>
              <strong>Total adeudado:</strong> ${totalOutstanding.toLocaleString('es-CL')}
            </p>
            <p>
              <strong>Clientes con deuda:</strong> {outstandingDebts.length}
            </p>
            {data?.generatedAt && (
              <p>
                <strong>Generado:</strong> {new Date(data.generatedAt).toLocaleString('es-CL')}
              </p>
            )}
          </div>

          <div className="table-wrapper">
            <table className="debts-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Contacto</th>
                  <th>Productos en deuda</th>
                  <th>Total adeudado</th>
                  <th>Creado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {visibleDebts.map((debt) => {
                  const clientName = debt.client?.nombreCompleto || 'Cliente'
                  const comuna = debt.client?.comuna || ''
                  const createdAt = debt.createdAt ? new Date(debt.createdAt) : null
                  const formattedPhone =
                    formatChileanPhone(debt.client?.telefono) || debt.client?.telefono || '—'
                  const delivery = debt.client?.diaReparto
                    ? `Entrega: ${debt.client.diaReparto}`
                    : null
                  const status = (debt.status || 'pendiente').toLowerCase()
                  const statusClass =
                    status === 'pagada' ? 'status-pill-success' : 'status-pill-danger'
                  const statusLabel = status === 'pagada' ? 'Pagada' : 'Pendiente'
                  const paidAtLabel = debt.paidAt
                    ? new Date(debt.paidAt).toLocaleDateString('es-CL')
                    : null
                  const canMarkPaid = typeof onMarkPaid === 'function' && status !== 'pagada'

                  return (
                    <tr key={debt.id}>
                      <td>
                        <div className="debt-client-name">{clientName}</div>
                        <div className="debt-client-meta">
                          {comuna ? comuna : 'Sin comuna'}
                          {Array.isArray(debt.orderIds) && debt.orderIds.length
                            ? ` · ${debt.orderIds.length} pedidos`
                            : ''}
                        </div>
                        <span className={`status-pill ${statusClass}`}>{statusLabel}</span>
                      </td>
                      <td>
                        <div className="debt-contact-line">{formattedPhone}</div>
                        {delivery && <div className="debt-contact-line">{delivery}</div>}
                        {debt.note && <div className="debt-contact-line">Nota: {debt.note}</div>}
                      </td>
                      <td>
                        <ul className="debt-products">
                          {(Array.isArray(debt.items) ? debt.items : []).map((item) => (
                            <li key={`${debt.id}-${item.productId || item.name}`}>
                              <div className="debt-product-name">{item.name}</div>
                              <div className="debt-product-meta">
                                x{formatQuantity(item.quantity)} {item.unit || 'unidad'} · $
                                {Number(item.subtotal || 0).toLocaleString('es-CL')}
                              </div>
                            </li>
                          ))}
                        </ul>
                      </td>
                      <td>${Number(debt.amount || 0).toLocaleString('es-CL')}</td>
                      <td>{createdAt ? createdAt.toLocaleDateString('es-CL') : '—'}</td>
                      <td className="debt-actions-cell">
                        {canMarkPaid ? (
                          <button
                            type="button"
                            className="chip-button chip-success"
                            onClick={() => onMarkPaid(debt)}
                            disabled={loading}
                            aria-label={`Registrar pago para ${clientName}`}
                          >
                            Pagado
                          </button>
                        ) : (
                          <span className="debt-paid-label">
                            {paidAtLabel ? `Pagada el ${paidAtLabel}` : 'Pagada'}
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {limit && outstandingDebts.length > limit && (
            <p className="debts-footnote">
              Mostrando los {limit} principales · Usa el botón "Ver deudas" para ver el listado
              completo y registrar otros pagos.
            </p>
          )}
        </>
      )}
    </section>
  )
}

export default DebtsPanel
