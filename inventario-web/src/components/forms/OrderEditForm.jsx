import { useEffect, useMemo, useState } from 'react'

const toFormState = (order) => {
  if (!order) {
    return {
      clienteId: '',
      items: [],
    }
  }

  return {
    clienteId: order.clienteId ?? '',
    items: Array.isArray(order.items)
      ? order.items.map((item) => ({
          productId: item.productId,
          quantity: item.cantidad != null ? String(item.cantidad) : '1',
        }))
      : [],
  }
}

const resolveProduct = (products, productId) =>
  products.find((product) => product.id === productId) || null

const resolveClient = (clients, clientId) =>
  clients.find((client) => client.id === clientId) || null

const OrderEditForm = ({ orders = [], clients = [], products = [], onSubmit, submitting }) => {
  const editableOrders = useMemo(
    () => orders.filter((order) => order.estado !== 'completado'),
    [orders],
  )

  const [selectedId, setSelectedId] = useState('')
  const [form, setForm] = useState(() => toFormState(null))
  const [newItem, setNewItem] = useState({ productId: '', quantity: '1' })

  useEffect(() => {
    if (selectedId && !editableOrders.some((order) => order.id === selectedId)) {
      setSelectedId('')
    }
  }, [editableOrders, selectedId])

  useEffect(() => {
    if (!selectedId && editableOrders.length > 0) {
      setSelectedId(editableOrders[0].id)
    }
  }, [editableOrders, selectedId])

  const selectedOrder = useMemo(
    () => editableOrders.find((order) => order.id === selectedId) || null,
    [editableOrders, selectedId],
  )

  useEffect(() => {
    setForm(toFormState(selectedOrder))
  }, [selectedOrder?.id])

  useEffect(() => {
    if (selectedOrder) {
      setNewItem({ productId: '', quantity: '1' })
    }
  }, [selectedOrder?.id])

  const updateClient = (event) => {
    const value = event.target.value
    setForm((prev) => ({ ...prev, clienteId: value }))
  }

  const updateQuantity = (productId) => (event) => {
    const value = event.target.value
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((item) =>
        item.productId === productId ? { ...item, quantity: value } : item,
      ),
    }))
  }

  const handleRemoveItem = (productId) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.filter((item) => item.productId !== productId),
    }))
  }

  const handleNewItemChange = (field) => (event) => {
    setNewItem((prev) => ({ ...prev, [field]: event.target.value }))
  }

  const handleAddItem = (event) => {
    event.preventDefault()

    if (!newItem.productId) {
      return
    }

    const quantity = Number(newItem.quantity)
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return
    }

    setForm((prev) => ({
      ...prev,
      items: [...prev.items, { productId: newItem.productId, quantity: String(quantity) }],
    }))

    setNewItem({ productId: '', quantity: '1' })
  }

  const availableProducts = useMemo(() => {
    const used = new Set(form.items.map((item) => item.productId))
    return products.filter((product) => !used.has(product.id))
  }, [products, form.items])

  const handleSubmit = (event) => {
    event.preventDefault()
    if (!selectedOrder) {
      return
    }

    const normalizedItems = form.items
      .map((item) => ({
        productId: item.productId,
        cantidad: Number(item.quantity),
      }))
      .filter((item) => item.productId && Number.isFinite(item.cantidad) && item.cantidad > 0)

    if (!form.clienteId) {
      return
    }

    if (!normalizedItems.length) {
      return
    }

    onSubmit?.({
      orderId: selectedOrder.id,
      updates: {
        clienteId: form.clienteId,
        items: normalizedItems,
      },
    })
  }

  const clientOptions = useMemo(
    () =>
      clients
        .slice()
        .sort((a, b) => (a.nombreCompleto || '').localeCompare(b.nombreCompleto || '', 'es-CL')),
    [clients],
  )

  return (
    <form onSubmit={handleSubmit} className="form-grid">
      <label>
        <span>Seleccionar pedido</span>
        <select value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
          <option value="">Selecciona un pedido</option>
          {editableOrders.map((order) => {
            const client = resolveClient(clients, order.clienteId)
            return (
              <option key={order.id} value={order.id}>
                {order.id} · {client ? client.nombreCompleto : 'Sin cliente'}
              </option>
            )
          })}
        </select>
      </label>

      {!editableOrders.length && (
        <p className="form-context">No hay pedidos pendientes para editar.</p>
      )}

      {selectedOrder ? (
        <>
          <p className="form-context">
            Pedido creado el{' '}
            {selectedOrder.createdAt
              ? new Date(selectedOrder.createdAt).toLocaleString('es-CL')
              : 'Fecha no disponible'}
          </p>
          <label>
            <span>Cliente</span>
            <select value={form.clienteId} onChange={updateClient} required>
              <option value="">Selecciona cliente</option>
              {clientOptions.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.nombreCompleto}
                </option>
              ))}
            </select>
          </label>

          <div className="order-items-editor">
            <span className="order-items-title">Productos</span>
            {form.items.length === 0 ? (
              <p className="form-context">Agrega al menos un producto al pedido.</p>
            ) : (
              <ul className="order-items-list">
                {form.items.map((item) => {
                  const product = resolveProduct(products, item.productId)
                  return (
                    <li key={item.productId} className="order-item-row">
                      <div className="order-item-info">
                        <strong>{product ? product.name : 'Producto eliminado'}</strong>
                        <span className="order-item-unit">
                          {product ? product.unit : 'Unidad'}
                        </span>
                      </div>
                      <div className="order-item-actions">
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          inputMode="decimal"
                          value={item.quantity}
                          onChange={updateQuantity(item.productId)}
                        />
                        <button
                          type="button"
                          className="chip-button"
                          onClick={() => handleRemoveItem(item.productId)}
                        >
                          Quitar
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}

            <div className="order-item-add">
              <select value={newItem.productId} onChange={handleNewItemChange('productId')}>
                <option value="">Agregar producto</option>
                {availableProducts.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min="0.01"
                step="0.01"
                inputMode="decimal"
                value={newItem.quantity}
                onChange={handleNewItemChange('quantity')}
              />
              <button type="button" className="primary-button" onClick={handleAddItem}>
                Agregar
              </button>
            </div>
          </div>
        </>
      ) : (
        editableOrders.length > 0 && (
          <p className="form-context">Selecciona un pedido para editar sus detalles.</p>
        )
      )}

      <div className="form-actions">
        <button type="submit" className="primary-button" disabled={submitting || !selectedOrder}>
          {submitting ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </div>
    </form>
  )
}

export default OrderEditForm
