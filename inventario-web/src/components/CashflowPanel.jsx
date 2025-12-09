import { useMemo } from 'react'

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

const formatDateTime = (value) => {
  if (!value) {
    return 'Sin fecha'
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return 'Sin fecha'
  }
  return date.toLocaleString('es-CL', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

const CashflowPanel = ({ data, loading, searchTerm, onAddEntry }) => {
  const transactions = Array.isArray(data?.transactions) ? data.transactions : []
  const summary = data?.summary || { totalIncome: 0, totalExpense: 0, balance: 0 }

  const normalizedSearch = useMemo(() => normalizeText(searchTerm), [searchTerm])

  const filteredTransactions = useMemo(() => {
    if (!normalizedSearch) {
      return transactions
    }
    return transactions.filter((entry) => {
      const haystack = normalizeText(
        `${entry.type || ''} ${entry.category || ''} ${entry.description || ''}`,
      )
      return haystack.includes(normalizedSearch)
    })
  }, [transactions, normalizedSearch])

  return (
    <section className="panel cashflow-panel">
      <div className="cashflow-header">
        <div>
          <h2>Control de ingresos y egresos</h2>
          {data?.generatedAt && (
            <p className="cashflow-updated">Actualizado {formatDateTime(data.generatedAt)}</p>
          )}
        </div>
        <button type="button" className="primary-button" onClick={onAddEntry}>
          Registrar movimiento
        </button>
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
                <th className="cashflow-amount">Monto</th>
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
                  <td className={`cashflow-amount ${entry.type === 'ingreso' ? 'is-income' : 'is-expense'}`}>
                    {entry.type === 'ingreso' ? '+' : '-'}
                    {formatCurrency(entry.amount)}
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
