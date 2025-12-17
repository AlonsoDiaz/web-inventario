import { useMemo, useState } from 'react'

import { formatChileanPhone, sanitizeChileanPhoneDigits } from '../utils/phoneInput'
import { resolvePriceForComuna } from '../utils/pricing'

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

const formatCurrency = (value) => `$${Number(value || 0).toLocaleString('es-CL')}`

const formatDateTime = (value) => {
  if (!value) {
    return '—'
  }
  try {
    return new Date(value).toLocaleString('es-CL')
  } catch (error) {
    return '—'
  }
}

const MAX_SUGGESTIONS = 8

const ClientInsightModal = ({ clients = [], orders = [], products = [], pricing, onClose }) => {
  const [query, setQuery] = useState('')
  const [selectedClientId, setSelectedClientId] = useState('')

  const clientMap = useMemo(() => new Map(clients.map((client) => [client.id, client])), [clients])
  const productsMap = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products],
  )
  const priceOverrides = pricing?.preciosPorComuna ?? {}

  const normalizedQuery = useMemo(() => normalizeText(query), [query])

  const filteredClients = useMemo(() => {
    if (!normalizedQuery) {
      return clients.slice(0, MAX_SUGGESTIONS)
    }

    return clients
      .filter((client) => {
        const haystack = [
          client.nombreCompleto,
          client.telefono,
          sanitizeChileanPhoneDigits(client.telefono),
          client.direccion,
          client.comuna,
          client.diaReparto,
        ]
          .filter(Boolean)
          .map((value) => normalizeText(value))

        return haystack.some((value) => value.includes(normalizedQuery))
      })
      .slice(0, MAX_SUGGESTIONS)
  }, [clients, normalizedQuery])

  const selectedClient = selectedClientId ? clientMap.get(selectedClientId) : null
  const formattedSelectedPhone = selectedClient ? formatChileanPhone(selectedClient.telefono) : ''

  const clientOrders = useMemo(() => {
    if (!selectedClient) {
      return []
    }

    return orders
      .filter((order) => order.clienteId === selectedClient.id)
      .map((order) => {
        const enrichedItems = Array.isArray(order.items)
          ? order.items.map((item) => {
              const product = productsMap.get(item.productId)
              const basePrice = product?.unitPrice ?? 0
              const unitPrice = resolvePriceForComuna(
                item.productId,
                selectedClient.comuna,
                priceOverrides,
                basePrice,
              )
              const quantity = Number(item.cantidad || item.quantity || 0)
              const subtotal = quantity * unitPrice

              return {
                productId: item.productId,
                name: product?.name || 'Producto eliminado',
                unit: product?.unit || 'Unidad',
                quantity,
                unitPrice,
                subtotal,
              }
            })
          : []

        const total = enrichedItems.reduce((acc, item) => acc + item.subtotal, 0)

        return {
          id: order.id,
          estado: order.estado,
          createdAt: order.createdAt,
          deliveredAt: order.deliveredAt || null,
          items: enrichedItems,
          total,
        }
      })
      .sort((a, b) => {
        const aDate = a.createdAt ? new Date(a.createdAt).getTime() : 0
        const bDate = b.createdAt ? new Date(b.createdAt).getTime() : 0
        return bDate - aDate
      })
  }, [orders, priceOverrides, productsMap, selectedClient])

  const totals = useMemo(() => {
    if (!clientOrders.length) {
      return {
        totalOrders: 0,
        deliveredOrders: 0,
        pendingOrders: 0,
        totalRevenue: 0,
        deliveredRevenue: 0,
        latestOrderAt: null,
        latestDeliveryAt: null,
      }
    }

    const delivered = clientOrders.filter((order) => order.estado === 'completado')

    const totalRevenue = clientOrders.reduce((acc, order) => acc + order.total, 0)
    const deliveredRevenue = delivered.reduce((acc, order) => acc + order.total, 0)
    const latestOrderAt = clientOrders[0]?.createdAt || null
    const latestDeliveryAt = delivered.length
      ? delivered.reduce((latest, order) => {
          if (!order.deliveredAt) {
            return latest
          }
          const current = new Date(order.deliveredAt).getTime()
          return current > latest ? current : latest
        }, 0)
      : null

    return {
      totalOrders: clientOrders.length,
      deliveredOrders: delivered.length,
      pendingOrders: clientOrders.length - delivered.length,
      totalRevenue,
      deliveredRevenue,
      latestOrderAt,
      latestDeliveryAt: latestDeliveryAt ? new Date(latestDeliveryAt).toISOString() : null,
    }
  }, [clientOrders])

  const handleSuggestionClick = (clientId) => {
    setSelectedClientId(clientId)
    const client = clientMap.get(clientId)
    if (client) {
      setQuery(client.nombreCompleto || '')
    }
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    if (selectedClientId) {
      return
    }
    const [match] = filteredClients
    if (match) {
      handleSuggestionClick(match.id)
    }
  }

  return (
    <div className="client-insight-modal">
      <form className="client-insight-search" onSubmit={handleSubmit}>
        <label>
          <span>Buscar cliente</span>
          <input
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setSelectedClientId('')
            }}
            placeholder="Escribe nombre, teléfono o comuna"
          />
        </label>
        {filteredClients.length > 0 ? (
          <ul className="client-insight-suggestions">
            {filteredClients.map((client) => {
              const formattedPhone = formatChileanPhone(client.telefono)
              return (
                <li key={client.id}>
                  <button type="button" onClick={() => handleSuggestionClick(client.id)}>
                    <strong>{client.nombreCompleto}</strong>
                    <span>
                      {client.comuna ? `${client.comuna} · ` : ''}
                      {formattedPhone || client.telefono || 'Sin teléfono'}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="client-insight-empty">No encontramos coincidencias.</p>
        )}
      </form>

      {selectedClient ? (
        <section className="client-insight-details" aria-live="polite">
          <header className="client-insight-header">
            <div>
              <h3>{selectedClient.nombreCompleto}</h3>
              <p>
                {selectedClient.direccion ? `${selectedClient.direccion} · ` : ''}
                {selectedClient.comuna || 'Sin comuna'}
              </p>
            </div>
            <div className="client-insight-meta">
              {formattedSelectedPhone && <span>📞 {formattedSelectedPhone}</span>}
              {selectedClient.diaReparto && <span>🗓 {selectedClient.diaReparto}</span>}
            </div>
          </header>

          <div className="client-insight-stats">
            <article>
              <h4>Total pedidos</h4>
              <p>{totals.totalOrders}</p>
            </article>
            <article>
              <h4>Pedidos entregados</h4>
              <p>{totals.deliveredOrders}</p>
            </article>
            <article>
              <h4>Pedidos pendientes</h4>
              <p>{totals.pendingOrders}</p>
            </article>
            <article>
              <h4>Ganancia total</h4>
              <p>{formatCurrency(totals.totalRevenue)}</p>
            </article>
            <article>
              <h4>Ganancia entregada</h4>
              <p>{formatCurrency(totals.deliveredRevenue)}</p>
            </article>
            <article>
              <h4>Último pedido</h4>
              <p>{formatDateTime(totals.latestOrderAt)}</p>
            </article>
            <article>
              <h4>Última entrega</h4>
              <p>{formatDateTime(totals.latestDeliveryAt)}</p>
            </article>
          </div>

          <div className="client-insight-orders">
            <h4>Historial de pedidos</h4>
            {clientOrders.length === 0 ? (
              <p className="client-insight-empty">Este cliente aún no tiene pedidos registrados.</p>
            ) : (
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Pedido</th>
                      <th>Estado</th>
                      <th>Creado</th>
                      <th>Entregado</th>
                      <th>Detalle</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clientOrders.map((order) => (
                      <tr key={order.id}>
                        <td>{order.id}</td>
                        <td>
                          {order.estado === 'completado' ? (
                            <span className="status-pill status-pill-success">Entregado</span>
                          ) : (
                            <span className="status-pill status-pill-warning">Pendiente</span>
                          )}
                        </td>
                        <td>{formatDateTime(order.createdAt)}</td>
                        <td>{formatDateTime(order.deliveredAt)}</td>
                        <td>
                          <ul className="client-insight-order-items">
                            {order.items.map((item) => (
                              <li key={`${order.id}-${item.productId}`}>
                                <strong>{item.name}</strong>
                                <span>
                                  {item.quantity} {item.unit || 'un.'} · {formatCurrency(item.unitPrice)}
                                </span>
                                <span className="client-insight-item-total">
                                  {formatCurrency(item.subtotal)}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </td>
                        <td>{formatCurrency(order.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      ) : (
        <p className="client-insight-empty">
          Escribe para encontrar un cliente y revisa su historial de pedidos.
        </p>
      )}
    </div>
  )
}

export default ClientInsightModal
