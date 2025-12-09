const ReportViewer = ({ report }) => {
  if (!report) {
    return null
  }

  return (
    <section className="panel" aria-label="Reporte de inventario">
      <header className="panel-header">
        <div>
          <h2>Reporte de inventario</h2>
          <p>Generado el {new Date(report.generatedAt).toLocaleString('es-CL')}</p>
        </div>
      </header>
      <div className="report-summary">
        <p>
          <strong>Productos:</strong> {report.totals.totalProducts}
        </p>
        <p>
          <strong>Precios especiales:</strong> {report.rows.filter((row) => row.category).length}
        </p>
      </div>
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Producto</th>
              <th>Unidad</th>
              <th>Categoría</th>
              <th>Precio unidad</th>
            </tr>
          </thead>
          <tbody>
            {report.rows.map((row) => (
              <tr key={row.id}>
                <td>{row.name}</td>
                <td>{row.unit || 'Unidad'}</td>
                <td>{row.category || 'Sin categoría'}</td>
                <td>${row.unitPrice.toLocaleString('es-CL')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export default ReportViewer
