import { useState } from 'react'

const formatUnitLabel = (unit) => {
  if (typeof unit !== 'string') {
    return 'unidad'
  }
  const normalized = unit.trim()
  return normalized.length ? normalized.toLowerCase() : 'unidad'
}

const OrderForm = ({ clients = [], products = [], onSubmit, submitting }) => {
  const [clienteId, setClienteId] = useState('')
  const [productId, setProductId] = useState('')
  const [cantidad, setCantidad] = useState('1')

  const handleSubmit = (event) => {
    event.preventDefault()
    const parsedCantidad = Number.parseFloat(cantidad)
    if (!clienteId || !productId || !Number.isFinite(parsedCantidad) || parsedCantidad <= 0) {
      return
    }
    onSubmit?.(
      {
        clienteId,
        items: [
          {
            productId,
            cantidad: parsedCantidad,
          },
        ],
      },
      () => {
        setClienteId('')
        setProductId('')
        setCantidad('1')
      },
    )
  }

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

      <label>
        <span>Producto</span>
        <select required value={productId} onChange={(e) => setProductId(e.target.value)}>
          <option value="">Selecciona producto</option>
          {products.map((product) => (
            <option key={product.id} value={product.id}>
              {product.name} · ${product.unitPrice.toLocaleString('es-CL')} por
              {' '}
              {formatUnitLabel(product.unit)}
            </option>
          ))}
        </select>
      </label>

      <label>
        <span>Cantidad</span>
        <input
          type="number"
          min="0.01"
          step="0.01"
          inputMode="decimal"
          required
          value={cantidad}
          onChange={(e) => setCantidad(e.target.value)}
        />
      </label>

      <div className="form-actions">
        <button type="submit" className="primary-button" disabled={submitting}>
          {submitting ? 'Creando pedido...' : 'Crear pedido'}
        </button>
      </div>
    </form>
  )
}

export default OrderForm
