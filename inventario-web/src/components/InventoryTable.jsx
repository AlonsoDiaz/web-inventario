const InventoryTable = ({ products = [], selectedProductId, onSelectProduct }) => {
  return (
    <section className="panel" aria-label="Listado de productos">
      <header className="panel-header">
        <div>
          <h2>Catálogo de productos</h2>
          <p>Lista base con precios y categorías para generar pedidos.</p>
        </div>
        <button type="button" className="link-button">
          Exportar listado
        </button>
      </header>
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Producto</th>
              <th>Unidad</th>
              <th>Categoría</th>
              <th>Precio</th>
              <th>Notas</th>
            </tr>
          </thead>
          <tbody>
            {products.map((row) => {
              const isSelected = selectedProductId === row.id

              return (
                <tr
                  key={row.id}
                  data-selected={isSelected ? 'true' : 'false'}
                  onClick={() => onSelectProduct?.(row.id)}
                >
                  <td>{row.name}</td>
                  <td>{row.unit || 'Unidad'}</td>
                  <td>{row.category || 'Sin categoría'}</td>
                  <td>${row.unitPrice.toLocaleString('es-CL')}</td>
                  <td>{row.notes || '-'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export default InventoryTable
