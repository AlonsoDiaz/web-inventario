const actions = [
  { key: 'add-client', label: 'Agregar cliente' },
  { key: 'create-product', label: 'Crear producto' },
  { key: 'new-order', label: 'Nuevo pedido' },
  { key: 'edit-product', label: 'Editar' },
  { key: 'generate-report', label: 'Generar reporte' },
  { key: 'view-summary', label: 'Ver resumen' },
  { key: 'view-pending-clients', label: 'Clientes con deuda' },
  { key: 'record-cashflow', label: 'Registrar ingreso/egreso' },
  { key: 'manage-prices', label: 'Gestionar Precios' },
]

const ActionBar = ({ onSelect }) => {
  return (
    <nav className="action-bar" aria-label="Acciones principales">
      {actions.map((action) => (
        <button
          key={action.key}
          type="button"
          className="action-button"
          onClick={() => onSelect?.(action.key)}
        >
          {action.label}
        </button>
      ))}
    </nav>
  )
}

export default ActionBar
