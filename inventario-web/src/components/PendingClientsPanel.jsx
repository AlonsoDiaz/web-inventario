import { useEffect, useMemo, useState } from 'react'

const ALL_VALUE = 'ALL'

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

const formatUnitLabel = (unit) => {
  if (typeof unit !== 'string') {
    return 'unidad'
  }
  const normalized = unit.trim()
  return normalized.length ? normalized.toLowerCase() : 'unidad'
}

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

const PendingClientsPanel = ({
  data,
  searchTerm = '',
  onMarkDelivered,
  onCancelOrders,
  isUpdating = false,
  processingClientId = null,
}) => {
  const clients = data?.clients || []

  const sortLocale = (a, b) => a.localeCompare(b, 'es-CL')

  const availableComunas = useMemo(
    () =>
      Array.from(new Set(clients.map((entry) => entry.client.comuna).filter(Boolean))).sort(
        sortLocale,
      ),
    [clients],
  )

  const availableDias = useMemo(
    () =>
      Array.from(
        new Set(
          clients
            .map((entry) => entry.client.diaReparto)
            .filter((dia) => typeof dia === 'string' && dia.trim()),
        ),
      ).sort(sortLocale),
    [clients],
  )

  const [filters, setFilters] = useState({ comuna: ALL_VALUE, diaReparto: ALL_VALUE })

  useEffect(() => {
    if (filters.comuna !== ALL_VALUE && !availableComunas.includes(filters.comuna)) {
      setFilters((prev) => ({ ...prev, comuna: ALL_VALUE }))
    }
  }, [filters.comuna, availableComunas])

  useEffect(() => {
    if (filters.diaReparto !== ALL_VALUE && !availableDias.includes(filters.diaReparto)) {
      setFilters((prev) => ({ ...prev, diaReparto: ALL_VALUE }))
    }
  }, [filters.diaReparto, availableDias])

  const normalizedSearch = useMemo(() => normalizeText(searchTerm), [searchTerm])

  const filteredClients = useMemo(() => {
    return clients.filter((entry) => {
      const matchComuna =
        filters.comuna === ALL_VALUE || entry.client.comuna === filters.comuna
      const matchDia =
        filters.diaReparto === ALL_VALUE || entry.client.diaReparto === filters.diaReparto
      if (!matchComuna || !matchDia) {
        return false
      }

      if (!normalizedSearch) {
        return true
      }

      const haystacks = [
        entry.client.nombreCompleto,
        entry.client.telefono,
        entry.client.direccion,
        entry.client.comuna,
        entry.client.diaReparto,
      ]
        .filter(Boolean)
        .map((value) => normalizeText(value))

      if (haystacks.some((value) => value.includes(normalizedSearch))) {
        return true
      }

      const productMatch = entry.products.some((product) => {
        const productStack = normalizeText(product.product.name)
        return productStack.includes(normalizedSearch)
      })

      if (productMatch) {
        return true
      }

      if (Array.isArray(entry.orderIds)) {
        const idMatch = entry.orderIds.some((id) => normalizeText(id).includes(normalizedSearch))
        if (idMatch) {
          return true
        }
      }

      return false
    })
  }, [clients, filters, normalizedSearch])

  const totalAmount = filteredClients.reduce((acc, entry) => acc + entry.totalAmount, 0)
  const totalUnits = filteredClients.reduce((acc, entry) => acc + (entry.totalUnits || 0), 0)
  const filtersApplied = filters.comuna !== ALL_VALUE || filters.diaReparto !== ALL_VALUE
  const searchApplied = Boolean(normalizedSearch)
  const searchLabel = searchTerm.trim()
  const showContextTotal = filtersApplied || searchApplied
  const canExport = filteredClients.length > 0
  const exportDisabled = !canExport || isUpdating

  const handleFilterChange = (field) => (event) => {
    setFilters((prev) => ({ ...prev, [field]: event.target.value }))
  }

  const handleResetFilters = () => {
    setFilters({ comuna: ALL_VALUE, diaReparto: ALL_VALUE })
  }

  const handleDelivered = (entry) => {
    if (!onMarkDelivered || !Array.isArray(entry?.orderIds) || entry.orderIds.length === 0) {
      return
    }

    onMarkDelivered(entry)
  }

  const handleCancel = (entry) => {
    if (!onCancelOrders || !Array.isArray(entry?.orderIds) || entry.orderIds.length === 0) {
      return
    }

    onCancelOrders(entry)
  }

  const handleExport = () => {
    if (exportDisabled) {
      return
    }

    const headers = [
      'Nombre cliente',
      'Teléfono',
      'Dirección',
      'Comuna',
      'Día reparto',
      'Producto',
      'Cantidad',
      'Precio unitario',
      'Subtotal',
      'Total cliente',
    ]

    const escapeCell = (value) => {
      const stringValue = value ?? ''
      const normalized = typeof stringValue === 'string' ? stringValue : String(stringValue)
      const needsQuotes = /[";\n]/.test(normalized)
      const escaped = normalized.replace(/"/g, '""')
      return needsQuotes ? `"${escaped}"` : escaped
    }

    const rows = []

    filteredClients.forEach((entry) => {
      const { client, products, totalAmount } = entry

      products.forEach((item, index) => {
        const isFirstRowForClient = index === 0
        rows.push([
          isFirstRowForClient ? client.nombreCompleto : '',
          isFirstRowForClient ? client.telefono : '',
          isFirstRowForClient ? client.direccion : '',
          isFirstRowForClient ? client.comuna : '',
          isFirstRowForClient ? client.diaReparto || '' : '',
          item.product.name,
          item.quantity,
          item.product.unitPrice,
          item.subtotal,
          isFirstRowForClient ? totalAmount : '',
        ])
      })

      if (products.length > 0) {
        // Espacio entre clientes para mejor lectura
        rows.push(new Array(headers.length).fill(''))
      }
    })

    if (rows.length > 0 && rows[rows.length - 1].every((cell) => cell === '')) {
      rows.pop()
    }

    const csvLines = [headers.map(escapeCell).join(';')]
    rows.forEach((row) => {
      csvLines.push(row.map(escapeCell).join(';'))
    })

    const csvContent = `\ufeff${csvLines.join('\r\n')}`

    const blob = new Blob([csvContent], {
      type: 'text/csv;charset=utf-8;',
    })

    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `clientes-pendientes-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <section className="panel pending-clients-panel" aria-label="Clientes con pedidos pendientes">
      <header className="panel-header">
        <div>
          <h2>Clientes con pedidos pendientes</h2>
          <p>Montos estimados según precios actuales de productos.</p>
        </div>
        <button
          type="button"
          className="link-button"
          onClick={handleExport}
          disabled={exportDisabled}
          title={
            exportDisabled
              ? isUpdating
                ? 'Espera a que se actualice el listado antes de exportar.'
                : 'No hay clientes que coincidan con los filtros seleccionados.'
              : undefined
          }
        >
          Exportar a Excel
        </button>
      </header>

      <div className="pending-filters" role="group" aria-label="Filtros de clientes">
        <label>
          <span>Filtrar por comuna</span>
          <select value={filters.comuna} onChange={handleFilterChange('comuna')}>
            <option value={ALL_VALUE}>Todas</option>
            {availableComunas.map((comuna) => (
              <option key={comuna} value={comuna}>
                {comuna}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Filtrar por día</span>
          <select value={filters.diaReparto} onChange={handleFilterChange('diaReparto')}>
            <option value={ALL_VALUE}>Todos</option>
            {availableDias.map((dia) => (
              <option key={dia} value={dia}>
                {dia}
              </option>
            ))}
          </select>
        </label>
        {filtersApplied && (
          <button type="button" className="chip-button" onClick={handleResetFilters}>
            Quitar filtros
          </button>
        )}
      </div>

      <div className="pending-clients-summary">
        <p>
          <strong>Total clientes:</strong> {filteredClients.length}
          {showContextTotal ? ` de ${clients.length}` : ''}
        </p>
        <p>
          <strong>Monto adeudado:</strong> ${totalAmount.toLocaleString('es-CL')}
        </p>
        <p>
          <strong>Productos pendientes:</strong> {formatQuantity(totalUnits)} artículos
        </p>
        {(filtersApplied || searchApplied) && (
          <p className="pending-filters-note">
            {[
              filters.comuna === ALL_VALUE ? null : `Comuna: ${filters.comuna}`,
              filters.diaReparto === ALL_VALUE ? null : `Entrega: ${filters.diaReparto}`,
              searchApplied ? `Búsqueda: "${searchLabel}"` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        )}
        {data?.generatedAt && (
          <p>
            <strong>Generado:</strong>{' '}
            {new Date(data.generatedAt).toLocaleString('es-CL')}
          </p>
        )}
      </div>
      {filteredClients.length === 0 ? (
        <p className="empty-state">
          {clients.length === 0
            ? 'No hay clientes con pedidos pendientes.'
            : 'No hay clientes que coincidan con los filtros o búsqueda aplicada.'}
        </p>
      ) : (
        <div className="table-wrapper">
          <table className="pending-clients-table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Contacto</th>
                <th>Productos pendientes</th>
                <th>Total adeudado</th>
                <th>Entregado</th>
                <th>Cancelar</th>
              </tr>
            </thead>
            <tbody>
              {filteredClients.map((entry) => {
                const orderIds = Array.isArray(entry.orderIds) ? entry.orderIds : []
                const rowDisabled =
                  isUpdating || processingClientId === entry.client.id || orderIds.length === 0

                return (
                  <tr key={entry.client.id}>
                    <td>
                      <div className="pending-client-name">{entry.client.nombreCompleto}</div>
                      <div className="pending-client-address">
                        {entry.client.direccion} · {entry.client.comuna}
                      </div>
                    </td>
                    <td>
                      <div>{entry.client.telefono}</div>
                      {entry.client.diaReparto && (
                        <div className="pending-client-day">Entrega: {entry.client.diaReparto}</div>
                      )}
                      {entry.latestOrderAt && (
                        <div className="pending-client-latest">
                          Último pedido: {new Date(entry.latestOrderAt).toLocaleDateString('es-CL')}
                        </div>
                      )}
                    </td>
                    <td>
                      <div className="pending-client-products">
                        <div className="pending-client-products-meta">
                          <span className="badge">{orderIds.length} pedidos</span>
                          <span className="pending-client-units">
                            {formatQuantity(entry.totalUnits)} artículos
                          </span>
                        </div>
                        <ul>
                          {entry.products.map((item) => (
                            <li key={item.product.id}>
                              <div className="pending-product-name">{item.product.name}</div>
                              <div className="pending-product-meta">
                                x{formatQuantity(item.quantity)} {formatUnitLabel(item.product.unit)} · $
                                {item.subtotal.toLocaleString('es-CL')}
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </td>
                    <td>${entry.totalAmount.toLocaleString('es-CL')}</td>
                    <td className="pending-actions-cell" colSpan={2}>
                      <div className="pending-actions">
                        <label className="delivery-toggle">
                          <input
                            type="checkbox"
                            onChange={(event) => {
                              event.target.checked = false
                              handleDelivered({ ...entry, orderIds })
                            }}
                            disabled={rowDisabled}
                            aria-label={`Marcar como entregado a ${entry.client.nombreCompleto}`}
                          />
                          <span>{rowDisabled ? 'Marcando...' : 'Marcar entregado'}</span>
                        </label>
                        <button
                          type="button"
                          className="chip-button"
                          onClick={() => handleCancel({ ...entry, orderIds })}
                          disabled={rowDisabled}
                          aria-label={`Cancelar pedidos de ${entry.client.nombreCompleto}`}
                        >
                          🗑 Cancelar
                        </button>
                      </div>
                      {orderIds.length > 1 && (
                        <div className="delivery-hint">{orderIds.length} pedidos pendientes</div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

export default PendingClientsPanel
