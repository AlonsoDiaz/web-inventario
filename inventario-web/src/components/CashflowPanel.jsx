import { useMemo } from 'react'
import { exportToExcel } from '../utils/export.js'

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
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(amount)
}

const formatMethod = (value) => {
  if (value === 'efectivo') return 'Efectivo'
  if (value === 'transferencia') return 'Transferencia'
  return 'Otro'
}

const CHILE_TIMEZONE = 'America/Santiago'

const formatDateTime = (value) => {
  if (!value) {
    return 'Sin fecha'
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return 'Sin fecha'
  }
  return date.toLocaleDateString('es-CL', {
    dateStyle: 'medium',
    timeZone: CHILE_TIMEZONE,
  })
}

const CashflowPanel = ({ data, loading, searchTerm, onAddEntry, onDeleteEntry }) => {
  const transactions = Array.isArray(data?.transactions) ? data.transactions : []
  const summary = data?.summary || { totalIncome: 0, totalExpense: 0, balance: 0 }

  const normalizedSearch = useMemo(() => normalizeText(searchTerm), [searchTerm])

  const filteredTransactions = useMemo(() => {
    const toTimestamp = (value) => {
      if (!value) {
        return Number.NEGATIVE_INFINITY
      }
      const date = new Date(value)
      const time = date.getTime()
      return Number.isFinite(time) ? time : Number.NEGATIVE_INFINITY
    }

    const matches = normalizedSearch
      ? transactions.filter((entry) => {
          const haystack = normalizeText(
            `${entry.type || ''} ${entry.category || ''} ${entry.description || ''}`,
          )
          return haystack.includes(normalizedSearch)
        })
      : transactions

    return [...matches].sort((a, b) => {
      const dateA = toTimestamp(a.date)
      const dateB = toTimestamp(b.date)
      if (dateA !== dateB) {
        return dateB - dateA
      }

      const createdA = toTimestamp(a.createdAt)
      const createdB = toTimestamp(b.createdAt)
      if (createdA !== createdB) {
        return createdB - createdA
      }

      return 0
    })
  }, [transactions, normalizedSearch])

  const exportColumns = [
    { key: 'date', label: 'Fecha' },
    { key: 'type', label: 'Tipo' },
    { key: 'category', label: 'Categoría' },
    { key: 'description', label: 'Descripción' },
    { key: 'method', label: 'Método' },
    { key: 'amount', label: 'Monto' },
    { key: 'cash', label: 'Efectivo' },
    { key: 'transfer', label: 'Transferencia' },
  ]

  const exportRows = filteredTransactions.map((entry) => ({
    date: formatDateTime(entry.date || entry.createdAt),
    type: entry.type === 'ingreso' ? 'Ingreso' : 'Egreso',
    category: entry.category || 'Sin categoría',
    description: entry.description || '—',
    method: formatMethod(entry.paymentMethod),
    amount: Number(entry.amount || 0),
    cash: entry.paymentMethod === 'efectivo' ? Number(entry.amount || 0) : 0,
    transfer: entry.paymentMethod === 'transferencia' ? Number(entry.amount || 0) : 0,
  }))

  const handleExportExcel = () => {
    exportToExcel('cashflow.xls', exportColumns, exportRows)
  }

  return (
    <section className="panel cashflow-panel">
      <div className="cashflow-header">
        <div>
          <h2>Control de ingresos y egresos</h2>
          {data?.generatedAt && (
            <p className="cashflow-updated">Actualizado {formatDateTime(data.generatedAt)}</p>
          )}
        </div>
        <div className="panel-actions">
          <button type="button" className="link-button" onClick={handleExportExcel}>
            Exportar Excel
          </button>
          <button type="button" className="primary-button" onClick={onAddEntry}>
            Registrar movimiento
          </button>
        </div>
      </div>

      <div className="cashflow-summary">
        <article className="cashflow-card cashflow-card-income">
          <h3>Ingresos</h3>
          <p>{formatCurrency(summary.totalIncome)}</p>
        </article>
        <article className="cashflow-card cashflow-card-expense">
          <h3>Egresos</h3>
          <p>{formatCurrency(summary.totalExpense)}</p>
        </article>
        <article className="cashflow-card cashflow-card-balance">
          <h3>Balance</h3>
          <p>{formatCurrency(summary.balance)}</p>
        </article>
      </div>

      {loading ? (
        <div className="loading-panel">Cargando movimientos...</div>
      ) : filteredTransactions.length === 0 ? (
        <div className="empty-state">
          No hay movimientos que coincidan con la búsqueda.
        </div>
      ) : (
        <div className="table-wrapper cashflow-table-wrapper">
          <table className="cashflow-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Tipo</th>
                <th>Categoría</th>
                <th>Descripción</th>
                <th>Método</th>
                <th className="cashflow-amount">Monto</th>
                <th className="cashflow-actions">Acción</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.map((entry) => (
                <tr key={entry.id}>
                  <td>{formatDateTime(entry.date || entry.createdAt)}</td>
                  <td>
                    <span
                      className={`cashflow-type ${
                        entry.type === 'ingreso' ? 'cashflow-type-income' : 'cashflow-type-expense'
                      }`}
                    >
                      {entry.type === 'ingreso' ? 'Ingreso' : 'Egreso'}
                    </span>
                  </td>
                  <td>{entry.category || 'Sin categoría'}</td>
                  <td>{entry.description || '—'}</td>
                  <td>{formatMethod(entry.paymentMethod)}</td>
                  <td className={`cashflow-amount ${entry.type === 'ingreso' ? 'is-income' : 'is-expense'}`}>
                    {entry.type === 'ingreso' ? '+' : '-'}
                    {formatCurrency(entry.amount)}
                  </td>
                  <td className="cashflow-actions">
                    <button
                      type="button"
                      className="link-button danger-ghost"
                      onClick={() => onDeleteEntry?.(entry)}
                    >
                      Eliminar
                    </button>
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

export default CashflowPanel
