import { useEffect, useMemo, useState } from 'react'

const formatQuantity = (quantity) => {
  const parsed = Number(quantity)
  if (!Number.isFinite(parsed)) {
    return '0'
  }
  if (Number.isInteger(parsed)) {
    return parsed.toString()
  }
  return parsed.toFixed(2).replace(/\.0+$/, '').replace(/(\.[1-9]*?)0+$/, '$1')
}

const groupOrderItems = (order) => {
  const groupsMap = new Map()
  const orderId = order.orderId || order.id
  if (!orderId) {
    return []
  }

  const items = Array.isArray(order.items) ? order.items : []

  items.forEach((item, index) => {
    const lineId = item?.lineId
    if (!lineId) {
      return
    }
    const productName = item?.product?.name || item?.name || 'Producto'
    const productId = item?.product?.id || item?.productId || productName
    const unit = item?.product?.unit || item?.unit || 'unidad'
    const quantity = Number(item?.quantity ?? item?.cantidad ?? 0) || 0
    if (quantity <= 0) {
      return
    }
    const unitPrice = Number(
      item?.product?.unitPrice ?? item?.unitPrice ?? item?.price ?? item?.product?.price ?? 0,
    )
    const lineSubtotal = Number(item?.subtotal)
    const subtotal = Number.isFinite(lineSubtotal) ? lineSubtotal : quantity * unitPrice

    const groupingKey = `${productId}::${unitPrice}::${unit}`
    if (!groupsMap.has(groupingKey)) {
      groupsMap.set(groupingKey, {
        groupId: `${orderId}__${groupingKey}__${index}`,
        product: {
          name: productName,
          unit,
        },
        unitPrice,
        quantity: 0,
        subtotal: 0,
        lineIds: [],
      })
    }

    const group = groupsMap.get(groupingKey)
    group.quantity += quantity
    group.subtotal += subtotal
    group.lineIds.push(lineId)
  })

  return Array.from(groupsMap.values())
}

const buildInitialSelection = (orders) => {
  return orders.reduce((acc, order) => {
    const groupIds = order.groups.map((group) => group.groupId)
    if (groupIds.length) {
      acc[order.orderId] = groupIds
    }
    return acc
  }, {})
}

const DeliverySelectionForm = ({
  entry,
  onCancel,
  onConfirm,
  isSubmitting = false,
  introText,
  emptyStateMessage,
  submitLabel,
}) => {
  const introCopy =
    introText ||
    'Selecciona los productos que ya fueron entregados. Los montos se calculan con los precios actuales, solo para referencia.'
  const emptyCopy =
    emptyStateMessage ||
    'No hay productos pendientes con desglose disponible para este cliente. Vuelve a calcular la lista y prueba nuevamente.'
  const confirmCopy = submitLabel || 'Confirmar entrega'
  const orders = useMemo(() => {
    if (!entry || !Array.isArray(entry.orders)) {
      return []
    }
    return entry.orders
      .map((order) => {
        const orderId = order.orderId || order.id
        const groups = groupOrderItems(order)
        if (!orderId || groups.length === 0) {
          return null
        }
        return {
          orderId,
          createdAt: order.createdAt,
          groups,
        }
      })
      .filter(Boolean)
  }, [entry])

  const totalPendingUnits = orders.reduce(
    (sum, order) =>
      sum + order.groups.reduce((groupSum, group) => groupSum + (group.quantity || 0), 0),
    0,
  )

  const [selection, setSelection] = useState(() => buildInitialSelection(orders))
  const [formError, setFormError] = useState(null)

  useEffect(() => {
    setSelection(buildInitialSelection(orders))
    setFormError(null)
  }, [orders])

  const selectedSummary = useMemo(() => {
    let units = 0
    let amount = 0
    orders.forEach((order) => {
      const selectedGroupIds = new Set(selection[order.orderId] || [])
      order.groups.forEach((group) => {
        if (selectedGroupIds.has(group.groupId)) {
          units += group.quantity || 0
          amount += group.subtotal || 0
        }
      })
    })
    return { units, amount }
  }, [orders, selection])

  const updateSelection = (orderId, updater) => {
    setSelection((prev) => {
      const current = new Set(prev[orderId] || [])
      updater(current)
      return { ...prev, [orderId]: Array.from(current) }
    })
    setFormError(null)
  }

  const handleToggleGroup = (orderId, groupId) => {
    updateSelection(orderId, (current) => {
      if (current.has(groupId)) {
        current.delete(groupId)
      } else {
        current.add(groupId)
      }
    })
  }

  const handleToggleOrder = (orderId, checked) => {
    const order = orders.find((item) => item.orderId === orderId)
    if (!order) {
      return
    }
    updateSelection(orderId, (current) => {
      current.clear()
      if (checked) {
        order.groups.forEach((group) => current.add(group.groupId))
      }
    })
  }

  const buildDeliveriesPayload = () => {
    return orders
      .map((order) => {
        const selectedGroupIds = new Set(selection[order.orderId] || [])
        const lineIds = order.groups
          .filter((group) => selectedGroupIds.has(group.groupId))
          .flatMap((group) => group.lineIds)
          .filter(Boolean)
        return { orderId: order.orderId, lineIds }
      })
      .filter((entry) => entry.orderId && entry.lineIds.length)
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    const deliveries = buildDeliveriesPayload()
    if (!deliveries.length) {
      setFormError('Selecciona al menos un producto pendiente.')
      return
    }
    onConfirm?.(deliveries)
  }

  if (!orders.length || totalPendingUnits === 0) {
    return (
      <div className="delivery-selection-empty">
        <p>{emptyCopy}</p>
        <button type="button" className="chip-button" onClick={onCancel}>
          Cerrar
        </button>
      </div>
    )
  }

  return (
    <form className="delivery-selection-form" onSubmit={handleSubmit}>
      <p className="delivery-selection-intro">{introCopy}</p>
      <div className="delivery-selection-list" role="group" aria-label="Pedidos pendientes">
        {orders.map((order) => {
          const selectedGroupIds = new Set(selection[order.orderId] || [])
          const allSelected =
            order.groups.length > 0 && order.groups.every((group) => selectedGroupIds.has(group.groupId))
          return (
            <article key={order.orderId} className="delivery-selection-order">
              <header>
                <div>
                  <p className="delivery-order-title">Pedido {order.orderId}</p>
                  {order.createdAt && (
                    <p className="delivery-order-date">
                      {new Date(order.createdAt).toLocaleDateString('es-CL', {
                        day: '2-digit',
                        month: 'short',
                      })}
                    </p>
                  )}
                </div>
                <label className="delivery-order-toggle">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={(event) => handleToggleOrder(order.orderId, event.target.checked)}
                    disabled={isSubmitting}
                  />
                  <span>{allSelected ? 'Quitar todo' : 'Seleccionar todo'}</span>
                </label>
              </header>
              <ul>
                {order.groups.map((group) => {
                  const checked = selectedGroupIds.has(group.groupId)
                  return (
                    <li key={group.groupId}>
                      <label className={`delivery-selection-item${checked ? ' is-selected' : ''}`}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => handleToggleGroup(order.orderId, group.groupId)}
                          disabled={isSubmitting}
                        />
                        <div>
                          <p className="delivery-item-name">{group.product.name}</p>
                          <p className="delivery-item-meta">
                            x{formatQuantity(group.quantity)} {group.product.unit} · $
                            {group.subtotal.toLocaleString('es-CL')}
                          </p>
                        </div>
                      </label>
                    </li>
                  )
                })}
              </ul>
            </article>
          )
        })}
      </div>
      <div className="delivery-selection-summary">
        <div>
          <p>Productos seleccionados</p>
          <strong>
            {formatQuantity(selectedSummary.units)} / {formatQuantity(totalPendingUnits)}
          </strong>
        </div>
        <div>
          <p>Total estimado</p>
          <strong>${selectedSummary.amount.toLocaleString('es-CL')}</strong>
        </div>
      </div>
      {formError && <p className="form-error">{formError}</p>}
      <div className="delivery-selection-actions">
        <button
          type="button"
          className="chip-button"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="primary-button"
          disabled={isSubmitting || selectedSummary.units === 0}
        >
          {isSubmitting ? 'Guardando...' : confirmCopy}
        </button>
      </div>
    </form>
  )
}

export default DeliverySelectionForm
