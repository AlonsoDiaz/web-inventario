const Header = ({ onSearch, searchTerm = '', totalClients, onNewProduct }) => {
  const handleSearchChange = (event) => {
    onSearch?.(event.target.value)
  }

  return (
    <header className="topbar">
      <div className="brand">
        <h1>Control de Reparto | Ducks Company SPA</h1>
        <p>
          Monitor de pedidos, compras y precios en un solo lugar
          {typeof totalClients === 'number' ? ` · ${totalClients} clientes` : ''}.
        </p>
      </div>
      <div className="topbar-tools">
        <label className="search-box">
          <span className="sr-only">Buscar</span>
          <input
            type="search"
            placeholder="Buscar productos o clientes"
            value={searchTerm}
            onChange={handleSearchChange}
          />
        </label>
        <button type="button" className="primary-button" onClick={onNewProduct}>
          + Nuevo producto
        </button>
      </div>
    </header>
  )
}

export default Header
