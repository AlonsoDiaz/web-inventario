import { useMemo, useState } from 'react'
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
  const baseSummary = {
    totalIncome: Number(data?.summary?.totalIncome || 0),
    totalExpense: Number(data?.summary?.totalExpense || 0),
    balance: Number(data?.summary?.balance || 0),
    cash: Number(data?.summary?.cash || 0),
    bank: Number(data?.summary?.bank || 0),
  }

  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const normalizedSearch = useMemo(() => normalizeText(searchTerm), [searchTerm])

  const filteredTransactions = useMemo(() => {
    const toTimestamp = (value, fallback = null) => {
      if (!value) {
        return fallback
      }
      const date = new Date(value)
      const time = date.getTime()
      return Number.isFinite(time) ? time : fallback
    }

    const fromTs = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null
    const toTs = dateTo ? new Date(`${dateTo}T23:59:59.999`).getTime() : null

    const matches = transactions.filter((entry) => {
      const haystack = normalizeText(
        `${entry.type || ''} ${entry.category || ''} ${entry.description || ''}`,
      )
      if (normalizedSearch && !haystack.includes(normalizedSearch)) {
        return false
      }

      const entryTs = toTimestamp(entry.date || entry.createdAt)
      if (entryTs == null) {
        return false
      }
      if (fromTs != null && entryTs < fromTs) {
        return false
      }
      if (toTs != null && entryTs > toTs) {
        return false
      }

      return true
    })

    return [...matches].sort((a, b) => {
      const dateA = toTimestamp(a.date, Number.NEGATIVE_INFINITY)
      const dateB = toTimestamp(b.date, Number.NEGATIVE_INFINITY)
      if (dateA !== dateB) {
        return dateB - dateA
      }

      const createdA = toTimestamp(a.createdAt, Number.NEGATIVE_INFINITY)
      const createdB = toTimestamp(b.createdAt, Number.NEGATIVE_INFINITY)
      if (createdA !== createdB) {
        return createdB - createdA
      }

      return 0
    })
  }, [transactions, normalizedSearch, dateFrom, dateTo])

  const filteredSummary = useMemo(() => {
    const totals = filteredTransactions.reduce(
      (acc, entry) => {
        const amount = Number(entry.amount || 0)
        const method = entry.paymentMethod === 'efectivo' ? 'efectivo' : entry.paymentMethod === 'transferencia' ? 'transferencia' : 'otro'

        if (entry.type === 'ingreso') {
          acc.totalIncome += amount
          if (method === 'efectivo') acc.cash += amount
          if (method === 'transferencia') acc.bank += amount
        } else {
          acc.totalExpense += amount
          if (method === 'efectivo') acc.cash -= amount
          if (method === 'transferencia') acc.bank -= amount
        }

        return acc
      },
      { totalIncome: 0, totalExpense: 0, balance: 0, cash: 0, bank: 0 },
    )

    totals.balance = totals.totalIncome - totals.totalExpense
    return totals
  }, [filteredTransactions])

  const displayedSummary = filteredSummary

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

      <div className="cashflow-filters" role="group" aria-label="Filtros por fecha">
        <label>
          <span>Desde</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(event) => setDateFrom(event.target.value)}
          />
        </label>
        <label>
          <span>Hasta</span>
          <input
            type="date"
            value={dateTo}
            onChange={(event) => setDateTo(event.target.value)}
          />
        </label>
        <button
          type="button"
          className="chip-button"
          onClick={() => {
            setDateFrom('')
            setDateTo('')
          }}
          disabled={!dateFrom && !dateTo}
        >
          Quitar filtro de fechas
        </button>
      </div>

      <div className="cashflow-summary">
        <article className="cashflow-card cashflow-card-income">
          <h3>Ingresos</h3>
          <p>{formatCurrency((displayedSummary.totalIncome ?? baseSummary.totalIncome))}</p>
        </article>
        <article className="cashflow-card cashflow-card-expense">
          <h3>Egresos</h3>
          <p>{formatCurrency((displayedSummary.totalExpense ?? baseSummary.totalExpense))}</p>
        </article>
        <article className="cashflow-card cashflow-card-balance">
          <h3>Saldo</h3>
          <p>{formatCurrency((displayedSummary.balance ?? baseSummary.balance))}</p>
        </article>
      </div>

      {loading ? (
        <div className="loading-panel">Cargando movimientos...</div>
      ) : filteredTransactions.length === 0 ? (
        <div className="empty-state">
          No hay movimientos que coincidan con la búsqueda o el rango de fechas.
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
