const GENERAL_PRICE_KEY = '__general__'

const SummaryPanel = ({ metrics, clients = [], orders = [], pricing, products = [] }) => {
  const clientesActivos = clients.length
  const pedidosPendientes = orders.filter((order) => order.estado !== 'completado').length
  const totalProductos = metrics?.productosActivos ?? 0
  const precioCaja = pricing?.precioCaja ?? 0
  const overrides = pricing?.preciosPorComuna ?? {}

  const productNameMap = new Map(products.map((product) => [product.id, product.name]))
  productNameMap.set(GENERAL_PRICE_KEY, 'Todos los productos')

  const overrideEntries = []

  if (overrides && typeof overrides === 'object') {
    Object.entries(overrides).forEach(([comuna, value]) => {
      if (value == null) {
        return
      }

      if (typeof value === 'number' || typeof value === 'string') {
        const numeric = Number(value)
        if (Number.isFinite(numeric)) {
          overrideEntries.push({ comuna, productId: GENERAL_PRICE_KEY, price: numeric })
        }
        return
      }

      if (typeof value === 'object' && !Array.isArray(value)) {
        Object.entries(value).forEach(([productId, rawPrice]) => {
          const numeric = Number(rawPrice)
          if (Number.isFinite(numeric)) {
            overrideEntries.push({ comuna, productId, price: numeric })
          }
        })
      }
    })
  }

  overrideEntries.sort((a, b) => {
    const comunaCompare = a.comuna.localeCompare(b.comuna, 'es-CL')
    if (comunaCompare !== 0) {
      return comunaCompare
    }
    const nameA = productNameMap.get(a.productId) || a.productId
    const nameB = productNameMap.get(b.productId) || b.productId
    return nameA.localeCompare(nameB, 'es-CL')
  })

  const overrideCount = overrideEntries.length

  return (
    <section className="panel" aria-label="Resumen general">
      <header className="panel-header">
        <div>
          <h2>Resumen general</h2>
          <p>Instantánea de clientes, pedidos y precios vigentes.</p>
        </div>
      </header>
      <div className="summary-grid">
        <article>
          <h3>Productos listos</h3>
          <p className="summary-value">{totalProductos}</p>
        </article>
        <article>
          <h3>Pedidos abiertos</h3>
          <p className="summary-value">{pedidosPendientes}</p>
        </article>
        <article>
          <h3>Clientes activos</h3>
          <p className="summary-value">{clientesActivos}</p>
        </article>
        <article>
          <h3>Precios especiales</h3>
          <p className="summary-value">{overrideCount}</p>
        </article>
      </div>
      <div className="summary-pricing">
        <h4>Precio base</h4>
        <p className="summary-value">${precioCaja.toLocaleString('es-CL')}</p>
        <h4>Precios por comuna</h4>
        <ul>
          {overrideEntries.map((entry) => {
            const label = productNameMap.get(entry.productId) || entry.productId
            return (
              <li key={`${entry.comuna}-${entry.productId}`}>
                {entry.comuna} · {label}: ${entry.price.toLocaleString('es-CL')}
              </li>
            )
          })}
          {overrideEntries.length === 0 && <li>Sin precios diferenciados</li>}
        </ul>
      </div>
    </section>
  )
}

export default SummaryPanel
