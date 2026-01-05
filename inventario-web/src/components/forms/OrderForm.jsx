import { useState } from 'react'

const formatUnitLabel = (unit) => {
  if (typeof unit !== 'string') {
    return 'unidad'
  }
  const normalized = unit.trim()
  return normalized.length ? normalized.toLowerCase() : 'unidad'
}

const createItemEntry = () => ({
  id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
  productId: '',
  cantidad: '1',
})

const isValidItem = (item) => {
  const parsedCantidad = Number.parseFloat(item.cantidad)
  return Boolean(item.productId) && Number.isFinite(parsedCantidad) && parsedCantidad > 0
}

const OrderForm = ({ clients = [], products = [], onSubmit, submitting }) => {
  const [clienteId, setClienteId] = useState('')
  const [items, setItems] = useState([createItemEntry()])

  const handleSubmit = (event) => {
    event.preventDefault()
    if (!clienteId || !items.length || !items.every(isValidItem)) {
      return
    }

    const payloadItems = items.map((item) => ({
      productId: item.productId,
      cantidad: Number.parseFloat(item.cantidad),
    }))

    onSubmit?.(
      {
        clienteId,
        items: payloadItems,
      },
      () => {
        setClienteId('')
        setItems([createItemEntry()])
      },
    )
  }

  const handleAddItem = () => {
    setItems((prev) => [...prev, createItemEntry()])
  }

  const handleRemoveItem = (itemId) => {
    setItems((prev) => {
      const next = prev.filter((item) => item.id !== itemId)
      return next.length ? next : [createItemEntry()]
    })
  }

  const handleItemChange = (itemId, field, value) => {
    setItems((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, [field]: value } : item)),
    )
  }

  const canSubmit = Boolean(clienteId) && items.length > 0 && items.every(isValidItem)

  return (
    <form onSubmit={handleSubmit} className="form-grid">
      <label>
        <span>Cliente</span>
        <select required value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
          <option value="">Selecciona cliente</option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.nombreCompleto}
              {client.diaReparto ? ` · ${client.diaReparto}` : ''}
            </option>
          ))}
        </select>
      </label>

      <div className="order-items-group">
        <div className="order-items-headline">
          <span>Productos del pedido</span>
          <p>Agrega todos los productos y cantidades en un solo paso.</p>
        </div>

        <div className="order-items-list">
          {items.map((item, index) => (
            <div key={item.id} className="order-item-row">
              <label>
                <span>
                  Producto
                  {items.length > 1 ? ` ${index + 1}` : ''}
                </span>
                <select
                  required
                  value={item.productId}
                  onChange={(e) => handleItemChange(item.id, 'productId', e.target.value)}
                >
                  <option value="">Selecciona producto</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name} · ${product.unitPrice.toLocaleString('es-CL')} por{' '}
                      {formatUnitLabel(product.unit)}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Cantidad</span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  inputMode="decimal"
                  required
                  value={item.cantidad}
                  onChange={(e) => handleItemChange(item.id, 'cantidad', e.target.value)}
                />
              </label>

              {items.length > 1 && (
                <button
                  type="button"
                  className="order-item-remove"
                  onClick={() => handleRemoveItem(item.id)}
                >
                  Quitar
                </button>
              )}
            </div>
          ))}
        </div>

        <button type="button" className="link-button" onClick={handleAddItem}>
          + Agregar otro producto
        </button>
      </div>

      <div className="form-actions">
        <button type="submit" className="primary-button" disabled={submitting || !canSubmit}>
          {submitting ? 'Creando pedido...' : 'Crear pedido'}
        </button>
      </div>
    </form>
  )
}

export default OrderForm
