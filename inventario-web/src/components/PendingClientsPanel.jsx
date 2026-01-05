import { useEffect, useMemo, useState } from 'react'
import { formatChileanPhone, sanitizeChileanPhoneDigits } from '../utils/phoneInput'
import { getRegionOptions, formatRegionLabel, regionIncludesComuna } from '../utils/regions'

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

const UNIT_SYNONYMS = {
  unidad: 'unidad',
  unidades: 'unidad',
  unit: 'unidad',
  u: 'unidad',
  kg: 'kg',
  kilo: 'kg',
  kilos: 'kg',
  kilogramo: 'kg',
  gramos: 'g',
  gr: 'g',
  g: 'g',
  grs: 'g',
  litro: 'litro',
  litros: 'litro',
  lt: 'litro',
  lts: 'litro',
  l: 'litro',
}


const formatUnitLabel = (unit) => {
  if (typeof unit !== 'string') {
    return 'unidad'
  }

  const normalized = unit.trim().toLowerCase()
  if (!normalized) {
    return 'unidad'
  }

  return UNIT_SYNONYMS[normalized] ?? normalized
}

const formatUnitLabelForExport = (unit) => {
  const label = formatUnitLabel(unit)
  if (label === 'kg' || label === 'g') {
    return label
  }
  if (label === 'litro') {
    return 'Litro'
  }
  return label.charAt(0).toUpperCase() + label.slice(1)
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
  onCreateDebt,
  onCancelOrders,
  isUpdating = false,
  processingClientId = null,
}) => {
  const clients = data?.clients ?? []

  const collator = useMemo(() => new Intl.Collator('es-CL'), [])

  const availableComunas = useMemo(() => {
    return Array.from(
      new Set(clients.map((entry) => entry.client.comuna).filter(Boolean)),
    ).sort(collator.compare)
  }, [clients, collator])

  const availableRegions = useMemo(() => getRegionOptions(collator), [collator])

  const availableDias = useMemo(() => {
    return Array.from(
      new Set(
        clients
          .map((entry) => entry.client.diaReparto)
          .filter((dia) => typeof dia === 'string' && dia.trim()),
      ),
    ).sort(collator.compare)
  }, [clients, collator])

  const [filters, setFilters] = useState({ region: ALL_VALUE, comuna: ALL_VALUE, diaReparto: ALL_VALUE })

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

  useEffect(() => {
    if (filters.region !== ALL_VALUE && !availableRegions.includes(filters.region)) {
      setFilters((prev) => ({ ...prev, region: ALL_VALUE }))
    }
  }, [filters.region, availableRegions])

  const normalizedSearch = useMemo(() => normalizeText(searchTerm), [searchTerm])
  const phoneSearchDigits = useMemo(() => sanitizeChileanPhoneDigits(searchTerm), [searchTerm])

  const filteredClients = useMemo(() => {
    return clients.filter((entry) => {
      const clientComuna = entry.client.comuna
      const matchRegion =
        filters.region === ALL_VALUE ||
        entry.client?.region === filters.region ||
        regionIncludesComuna(filters.region, clientComuna)
      const matchComuna = filters.comuna === ALL_VALUE || clientComuna === filters.comuna
      const matchDia =
        filters.diaReparto === ALL_VALUE || entry.client.diaReparto === filters.diaReparto

      if (!matchRegion || !matchComuna || !matchDia) {
        return false
      }

      if (!normalizedSearch && !phoneSearchDigits) {
        return true
      }

      if (normalizedSearch) {
        const textHaystacks = [
          entry.client.nombreCompleto,
          entry.client.telefono,
          entry.client.direccion,
          entry.client.comuna,
          entry.client.diaReparto,
        ]
          .filter(Boolean)
          .map((value) => normalizeText(value))

        if (textHaystacks.some((value) => value.includes(normalizedSearch))) {
          return true
        }

        const productMatch = Array.isArray(entry.products)
          ? entry.products.some((product) =>
              normalizeText(product.product?.name).includes(normalizedSearch),
            )
          : false

        if (productMatch) {
          return true
        }

        if (
          Array.isArray(entry.orderIds) &&
          entry.orderIds.some((id) => normalizeText(id).includes(normalizedSearch))
        ) {
          return true
        }
      }

      if (phoneSearchDigits) {
        const digitsHaystacks = [sanitizeChileanPhoneDigits(entry.client.telefono)]

        if (Array.isArray(entry.orderIds)) {
          entry.orderIds.forEach((id) => {
            const digits = sanitizeChileanPhoneDigits(id)
            if (digits) {
              digitsHaystacks.push(digits)
            }
          })
        }

        if (digitsHaystacks.some((digits) => digits.includes(phoneSearchDigits))) {
          return true
        }
      }

      return false
    })
  }, [clients, filters, normalizedSearch, phoneSearchDigits])

  const totalAmount = filteredClients.reduce(
    (acc, entry) => acc + (Number(entry.totalAmount) || 0),
    0,
  )
  const totalUnits = filteredClients.reduce(
    (acc, entry) => acc + (Number(entry.totalUnits) || 0),
    0,
  )

  const filtersApplied =
    filters.region !== ALL_VALUE || filters.comuna !== ALL_VALUE || filters.diaReparto !== ALL_VALUE
  const searchApplied = Boolean(normalizedSearch || phoneSearchDigits)
  const searchLabel = searchTerm.trim()
  const showContextTotal = filtersApplied || searchApplied
  const canExport = filteredClients.length > 0
  const exportDisabled = !canExport || isUpdating

  const handleFilterChange = (field) => (event) => {
    setFilters((prev) => ({ ...prev, [field]: event.target.value }))
  }

  const handleRegionChange = (event) => {
    const regionValue = event.target.value
    setFilters((prev) => ({ ...prev, region: regionValue, comuna: ALL_VALUE }))
  }

  const handleResetFilters = () => {
    setFilters({ region: ALL_VALUE, comuna: ALL_VALUE, diaReparto: ALL_VALUE })
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

  const handleCreateDebt = (entry) => {
    if (!onCreateDebt || !Array.isArray(entry?.orderIds) || entry.orderIds.length === 0) {
      return
    }

    onCreateDebt(entry)
  }

  const handleExport = async () => {
    if (exportDisabled) {
      return
    }

    try {
      const grandTotalAmount = filteredClients.reduce(
        (sum, entry) => sum + (Number(entry.totalAmount) || 0),
        0,
      )

      // Lazy-load the browser build to avoid bundler issues with ExcelJS' node path.
      const excelModule = await import('exceljs/dist/exceljs.min.js')
      const ExcelNamespace = excelModule?.default ?? excelModule
      if (!ExcelNamespace?.Workbook) {
        throw new Error('No se pudo cargar exceljs.Workbook')
      }

      const workbook = new ExcelNamespace.Workbook()
      workbook.creator = 'Inventario Web'
      workbook.created = new Date()

      const worksheet = workbook.addWorksheet('Clientes pendientes', {
        views: [{ state: 'frozen', ySplit: 1 }],
        pageSetup: {
          orientation: 'landscape',
          fitToPage: true,
          fitToWidth: 1,
          fitToHeight: 0,
          margins: { left: 0.3, right: 0.3, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
        },
      })

      const baseColumns = [
        { header: 'Nombre completo', key: 'cliente', width: 28 },
        { header: 'Teléfono', key: 'telefono', width: 16 },
        { header: 'Dirección', key: 'direccion', width: 30 },
        { header: 'Comuna', key: 'comuna', width: 18 },
      ]

      const productSummaryColumn = { header: 'Productos pendientes', key: 'productos', width: 42 }

      const tailColumns = [
        { header: 'Monto a pagar', key: 'totalCliente', width: 16 },
        { header: 'Pagado (Sí/No)', key: 'pagado', width: 14 },
        { header: 'Método de pago', key: 'metodoPago', width: 18 },
      ]

      const columns = [...baseColumns, productSummaryColumn, ...tailColumns]

      worksheet.columns = columns

      const headerRow = worksheet.getRow(1)
      columns.forEach((column, index) => {
        headerRow.getCell(index + 1).value = column.header
      })
      headerRow.height = 20
      headerRow.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: false }
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF111827' },
        }
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF000000' } },
          left: { style: 'thin', color: { argb: 'FF000000' } },
          bottom: { style: 'thin', color: { argb: 'FF000000' } },
          right: { style: 'thin', color: { argb: 'FF000000' } },
        }
      })

      const addBorders = (row) => {
        for (let columnIndex = 1; columnIndex <= columns.length; columnIndex += 1) {
          const cell = row.getCell(columnIndex)
          cell.border = {
            top: { style: 'thin', color: { argb: 'FF000000' } },
            left: { style: 'thin', color: { argb: 'FF000000' } },
            bottom: { style: 'thin', color: { argb: 'FF000000' } },
            right: { style: 'thin', color: { argb: 'FF000000' } },
          }
        }
      }

      const formatCurrencyCell = (cell) => {
        if (typeof cell.value === 'number') {
          cell.numFmt = '[$$-es-CL] #,##0'
        }
      }

      const textAlignment = { vertical: 'middle', horizontal: 'left', wrapText: true }
      const currencyAlignment = { vertical: 'middle', horizontal: 'right' }

      const baseColumnCount = baseColumns.length
      const amountColumnIndex = baseColumnCount + 2

      let dataRowIndex = 0

      filteredClients.forEach((entry) => {
        const { client, products, totalAmount } = entry
        if (!Array.isArray(products) || products.length === 0) {
          return
        }

        const formattedPhone = formatChileanPhone(client.telefono) || client.telefono || ''

        const perClientQuantities = new Map()
        products.forEach((item) => {
          const unitLabel = formatUnitLabelForExport(item.product.unit)
          const productKey = `${item.product.id ?? item.product.name}__${unitLabel}`
          const label = unitLabel && unitLabel.length ? `${item.product.name} (${unitLabel})` : item.product.name
          const previous = perClientQuantities.get(productKey) || { label, quantity: 0 }
          const quantityNumber = Number(item.quantity) || 0
          perClientQuantities.set(productKey, {
            label,
            quantity: previous.quantity + quantityNumber,
          })
        })

        const productSummary = Array.from(perClientQuantities.values())
          .sort((a, b) => collator.compare(a.label, b.label))
          .map((item) => `${item.label}: ${new Intl.NumberFormat('es-CL').format(item.quantity)}`)
          .join('\n')

        const clientTotalValue = Number(totalAmount) || 0

        const rowValues = [
          client.nombreCompleto,
          formattedPhone,
          client.direccion || '',
          client.comuna || '',
          productSummary,
          clientTotalValue,
          '',
          '',
        ]

        const row = worksheet.addRow(rowValues)

        dataRowIndex += 1

        row.eachCell((cell, cellNumber) => {
          if (cellNumber === amountColumnIndex) {
            cell.alignment = currencyAlignment
            formatCurrencyCell(cell)
          } else {
            cell.alignment = textAlignment
          }
        })

        if (dataRowIndex % 2 === 0) {
          row.eachCell((cell) => {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFF3F4F6' },
            }
          })
        }

        addBorders(row)
      })

      const totalRowValues = [
        'Total',
        '',
        '',
        '',
        '',
        grandTotalAmount,
        '',
        '',
      ]

      const totalRow = worksheet.addRow(totalRowValues)

      totalRow.eachCell((cell, cellNumber) => {
        cell.font = { bold: true }
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE0F2FE' },
        }

        if (cellNumber === amountColumnIndex) {
          cell.alignment = currencyAlignment
          formatCurrencyCell(cell)
        } else {
          cell.alignment = textAlignment
        }
      })

      addBorders(totalRow)

      const buffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })

      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `clientes-pendientes-${new Date().toISOString().slice(0, 10)}.xlsx`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error al generar el Excel de clientes pendientes:', error)
    }
  }

  return (
    <section className="panel pending-clients-panel" aria-label="Clientes con pedidos pendientes">
      <header className="panel-header">
        <div>
          <h2>Pedidos Pendientes</h2>
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
          <span>Filtrar por región</span>
          <select value={filters.region} onChange={handleRegionChange}>
            <option value={ALL_VALUE}>Todas</option>
            {availableRegions.map((regionKey) => (
              <option key={regionKey} value={regionKey}>
                {formatRegionLabel(regionKey)}
              </option>
            ))}
          </select>
        </label>
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
              filters.region === ALL_VALUE ? null : `Región: ${formatRegionLabel(filters.region)}`,
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
                const formattedPhone = formatChileanPhone(entry.client.telefono)

                return (
                  <tr key={entry.client.id}>
                    <td>
                      <div className="pending-client-name">{entry.client.nombreCompleto}</div>
                      <div className="pending-client-address">
                        {entry.client.direccion} · {entry.client.comuna}
                      </div>
                    </td>
                    <td>
                      <div>{formattedPhone || entry.client.telefono || '—'}</div>
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
                            aria-label={`Seleccionar productos entregados de ${entry.client.nombreCompleto}`}
                          />
                          <span>{rowDisabled ? 'Procesando...' : 'Marcar Entregado'}</span>
                        </label>
                        <button
                          type="button"
                          className="chip-button"
                          onClick={() => handleCreateDebt({ ...entry, orderIds })}
                          disabled={rowDisabled}
                          aria-label={`Crear deuda para ${entry.client.nombreCompleto}`}
                        >
                           Crear deuda
                        </button>
                        <button
                          type="button"
                          className="chip-button"
                          onClick={() => handleCancel({ ...entry, orderIds })}
                          disabled={rowDisabled}
                          aria-label={`Cancelar pedidos de ${entry.client.nombreCompleto}`}
                        >
                          Cancelar Pedido
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
