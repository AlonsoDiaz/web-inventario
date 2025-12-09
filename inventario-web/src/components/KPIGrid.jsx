const KPIGrid = ({ metrics }) => {
  const safeMetrics = metrics || {
    productosActivos: 0,
    pedidosPendientes: 0,
    clientesActivos: 0,
  }

  const cards = [
    {
      label: 'Productos disponibles',
      value: safeMetrics.productosActivos.toLocaleString('es-CL'),
      change: 'Listos para cotizar al cliente',
    },
    {
      label: 'Pedidos abiertos',
      value: safeMetrics.pedidosPendientes.toLocaleString('es-CL'),
      change: 'A la espera de compra/entrega',
    },
    {
      label: 'Clientes activos',
      value: safeMetrics.clientesActivos.toLocaleString('es-CL'),
      change: 'Con pedidos o historial reciente',
    },
  ]

  return (
    <section className="kpi-grid" aria-label="Indicadores de inventario">
      {cards.map((card) => (
        <article key={card.label} className="kpi-card">
          <p className="kpi-label">{card.label}</p>
          <p className="kpi-value">{card.value}</p>
          <p className="kpi-change">{card.change}</p>
        </article>
      ))}
    </section>
  )
}

export default KPIGrid
