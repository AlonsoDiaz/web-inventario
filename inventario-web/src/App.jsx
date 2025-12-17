import { useEffect, useMemo, useState } from 'react'
import './App.css'
import Header from './components/Header.jsx'
import ActionBar from './components/ActionBar.jsx'
import KPIGrid from './components/KPIGrid.jsx'
import InventoryTable from './components/InventoryTable.jsx'
import ActivityFeed from './components/ActivityFeed.jsx'
import Modal from './components/Modal.jsx'
import ClientForm from './components/forms/ClientForm.jsx'
import ClientEditForm from './components/forms/ClientEditForm.jsx'
import OrderEditForm from './components/forms/OrderEditForm.jsx'
import OrderForm from './components/forms/OrderForm.jsx'
import ProductEditForm from './components/forms/ProductEditForm.jsx'
import PriceChangeForm from './components/forms/PriceChangeForm.jsx'
import PriceOverrideForm from './components/forms/PriceOverrideForm.jsx'
import SummaryPanel from './components/SummaryPanel.jsx'
import ReportViewer from './components/ReportViewer.jsx'
import ProductCreateForm from './components/forms/ProductCreateForm.jsx'
import PendingClientsPanel from './components/PendingClientsPanel.jsx'
import ClientDirectoryPanel from './components/ClientDirectoryPanel.jsx'
import CashflowPanel from './components/CashflowPanel.jsx'
import CashflowEntryForm from './components/forms/CashflowEntryForm.jsx'
import ClientInsightModal from './components/ClientInsightModal.jsx'
import { api } from './services/api.js'

const DELIVERY_DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

const normalizeSettings = (settings = {}) => ({
  ...settings,
  comunas: settings.comunas || [],
  diasReparto: settings.diasReparto || DELIVERY_DAYS,
})

const normalizeText = (value) => {
  if (value == null) {
    return ''
  }
  return value
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

const normalizeDashboard = (data = {}) => ({
  metrics: data.metrics || null,
  products: Array.isArray(data.products)
    ? data.products.map((product) => ({
        ...product,
        unit: product?.unit || 'Unidad',
      }))
    : [],
  activities: data.activities || [],
  pricing: data.pricing || null,
  settings: normalizeSettings(data.settings || {}),
})

const initialDashboard = normalizeDashboard()

const normalizeCashflow = (data = {}) => {
  const summary = data.summary || {}
  return {
    transactions: Array.isArray(data.transactions) ? data.transactions : [],
    summary: {
      totalIncome: summary.totalIncome || 0,
      totalExpense: summary.totalExpense || 0,
      balance: summary.balance || 0,
    },
    generatedAt: data.generatedAt || null,
  }
}

const initialCashflow = normalizeCashflow()

function App() {
  const [dashboard, setDashboard] = useState(initialDashboard)
  const [clients, setClients] = useState([])
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedProductId, setSelectedProductId] = useState(null)
  const [modal, setModal] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [toast, setToast] = useState(null)
  const [report, setReport] = useState(null)
  const [summaryVisible, setSummaryVisible] = useState(false)
  const [pendingClientsData, setPendingClientsData] = useState(null)
  const [pendingClientsLoading, setPendingClientsLoading] = useState(false)
  const [pendingClientsSubmitting, setPendingClientsSubmitting] = useState(false)
  const [pendingClientsProcessingId, setPendingClientsProcessingId] = useState(null)
  const [cashflow, setCashflow] = useState(initialCashflow)
  const [cashflowLoading, setCashflowLoading] = useState(false)
  const normalizedSearchTerm = useMemo(() => normalizeText(searchTerm), [searchTerm])

  const pendingSummaryMap = useMemo(() => {
    const map = new Map()
    if (pendingClientsData?.clients) {
      pendingClientsData.clients.forEach((entry) => {
        const clientId = entry?.client?.id
        if (!clientId) {
          return
        }

        map.set(clientId, {
          totalAmount: entry.totalAmount || 0,
          orderCount:
            entry.orderCount || (Array.isArray(entry.orderIds) ? entry.orderIds.length : 0),
          totalUnits: entry.totalUnits || 0,
          latestOrderAt: entry.latestOrderAt || null,
        })
      })
    }
    return map
  }, [pendingClientsData])

  useEffect(() => {
    loadInitialData()
  }, [])

  useEffect(() => {
    if (!selectedProductId && dashboard.products.length > 0) {
      setSelectedProductId(dashboard.products[0].id)
    }
  }, [dashboard.products, selectedProductId])

  const filteredProducts = useMemo(() => {
    if (!normalizedSearchTerm) {
      return dashboard.products
    }
    return dashboard.products.filter((product) => {
      const haystack = normalizeText(
        `${product.name} ${product.category || ''} ${product.notes || ''}`,
      )
      return haystack.includes(normalizedSearchTerm)
    })
  }, [dashboard.products, normalizedSearchTerm])

  const selectedProduct = useMemo(
    () => dashboard.products.find((product) => product.id === selectedProductId) || null,
    [dashboard.products, selectedProductId],
  )

  useEffect(() => {
    if (!filteredProducts.length) {
      return
    }
    if (!filteredProducts.some((product) => product.id === selectedProductId)) {
      setSelectedProductId(filteredProducts[0].id)
    }
  }, [filteredProducts, selectedProductId])

  async function loadInitialData() {
    try {
      setLoading(true)
      setPendingClientsLoading(true)
      const [dashboardData, clientData, ordersData, pendingClients, cashflowData] = await Promise.all([
        api.getDashboard(),
        api.getClients(),
        api.getOrders(),
        api.getPendingClients(),
        api.getCashflow(),
      ])
      setDashboard(normalizeDashboard(dashboardData))
      setClients(clientData)
      setOrders(ordersData)
      setPendingClientsData(pendingClients)
      setCashflow(normalizeCashflow(cashflowData))
      setError(null)
    } catch (err) {
      console.error(err)
      setError(err.message)
    } finally {
      setLoading(false)
      setPendingClientsLoading(false)
    }
  }

  const refreshDashboard = async () => {
    const data = await api.getDashboard()
    setDashboard(normalizeDashboard(data))
  }

  const refreshClients = async () => {
    const data = await api.getClients()
    setClients(data)
  }

  const refreshOrders = async () => {
    const data = await api.getOrders()
    setOrders(data)
  }

  const fetchPendingClients = async () => {
    try {
      const data = await api.getPendingClients()
      setPendingClientsData(data)
      return data
    } catch (err) {
      console.error(err)
      setError(err.message)
      throw err
    }
  }

  const fetchCashflow = async () => {
    try {
      setCashflowLoading(true)
      const data = await api.getCashflow()
      const normalized = normalizeCashflow(data)
      setCashflow(normalized)
      return normalized
    } catch (err) {
      console.error(err)
      setError(err.message)
      throw err
    } finally {
      setCashflowLoading(false)
    }
  }

  const showToast = (message) => {
    setToast(message)
    window.setTimeout(() => setToast(null), 2800)
  }

  const closeModal = () => {
    setModal(null)
    setActionLoading(false)
  }

  const handleEditChoice = (choice) => {
    switch (choice) {
      case 'product':
        setModal('edit-product')
        break
      case 'client':
        setModal('edit-client')
        break
      case 'order':
        setModal('edit-order')
        break
      default:
        break
    }
  }

  const handleAction = (action) => {
    switch (action) {
      case 'add-client':
        setModal('add-client')
        break
      case 'create-product':
        setModal('create-product')
        break
      case 'new-order':
        setModal('new-order')
        break
      case 'edit-product':
        setModal('choose-edit')
        break
      case 'generate-report':
        handleGenerateReport()
        break
      case 'view-summary':
        setSummaryVisible((prev) => !prev)
        break
      case 'view-client':
        setModal('view-client')
        break
      case 'view-pending-clients':
        handlePendingClientsRefresh()
        break
      case 'record-cashflow':
        setModal('cashflow-entry')
        break
      case 'manage-prices':
        setModal('manage-prices')
        break
      case 'change-price':
        setModal('change-price')
        break
      default:
        break
    }
  }

  const handleClientSubmit = async (payload, resetForm) => {
    try {
      setActionLoading(true)
      const sanitized = {
        ...payload,
        diaReparto: payload.diaReparto?.trim() || undefined,
      }
      if (!sanitized.diaReparto) {
        delete sanitized.diaReparto
      }
      await api.addClient(sanitized)
      resetForm?.()
      showToast('Cliente agregado correctamente')
      await Promise.all([refreshDashboard(), refreshClients()])
      closeModal()
    } catch (err) {
      setError(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const handleOrderSubmit = async (payload, resetForm) => {
    try {
      setActionLoading(true)
      await api.createOrder(payload)
      resetForm?.()
      showToast('Pedido creado correctamente')
      await Promise.all([
        refreshDashboard(),
        refreshOrders(),
        fetchPendingClients().catch(() => null),
      ])
      closeModal()
    } catch (err) {
      setError(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const handleProductCreate = async (payload, resetForm) => {
    try {
      setActionLoading(true)
      const created = await api.createProduct({
        ...payload,
        unitPrice: Number(payload.unitPrice || 0),
      })
      resetForm?.()
      showToast('Producto creado correctamente')
      await refreshDashboard()
      setSelectedProductId(created?.id || null)
      closeModal()
    } catch (err) {
      setError(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const handleProductUpdate = async ({ productId, updates }) => {
    if (!productId) {
      showToast('Selecciona un producto para editar')
      return
    }
    try {
      setActionLoading(true)
      await api.updateProduct(productId, updates)
      showToast('Producto actualizado')
      setSelectedProductId(productId)
      await Promise.all([refreshDashboard(), fetchPendingClients().catch(() => null)])
      closeModal()
    } catch (err) {
      setError(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const handleProductDelete = async (productId) => {
    if (!productId) {
      showToast('Selecciona un producto para eliminar')
      return
    }

    try {
      setActionLoading(true)
      await api.deleteProduct(productId)
      showToast('Producto eliminado')
      if (selectedProductId === productId) {
        setSelectedProductId(null)
      }
      await Promise.all([
        refreshOrders(),
        refreshDashboard(),
        fetchPendingClients().catch(() => null),
      ])
      closeModal()
    } catch (err) {
      setError(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const handleClientUpdate = async ({ clientId, updates }) => {
    if (!clientId) {
      showToast('Selecciona un cliente para editar')
      return
    }

    try {
      setActionLoading(true)
      await api.updateClient(clientId, updates)
      showToast('Cliente actualizado')
      await Promise.all([refreshClients(), refreshDashboard(), fetchPendingClients().catch(() => null)])
      closeModal()
    } catch (err) {
      setError(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const handleClientDelete = async (clientId) => {
    if (!clientId) {
      showToast('Selecciona un cliente para eliminar')
      return
    }

    try {
      setActionLoading(true)
      await api.deleteClient(clientId)
      showToast('Cliente eliminado')
      await Promise.all([
        refreshClients(),
        refreshOrders(),
        refreshDashboard(),
        fetchPendingClients().catch(() => null),
      ])
      closeModal()
    } catch (err) {
      setError(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const handleOrderUpdate = async ({ orderId, updates }) => {
    if (!orderId) {
      showToast('Selecciona un pedido para editar')
      return
    }

    try {
      setActionLoading(true)
      await api.updateOrder(orderId, updates)
      showToast('Pedido actualizado')
      await Promise.all([
        refreshOrders(),
        refreshDashboard(),
        fetchPendingClients().catch(() => null),
      ])
      closeModal()
    } catch (err) {
      setError(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const handlePriceChange = async (updates) => {
    if (!selectedProductId) {
      showToast('Selecciona un producto de la tabla')
      return
    }
    try {
      setActionLoading(true)
      await api.updateProductPrice(selectedProductId, updates)
      showToast('Precio actualizado')
      await Promise.all([refreshDashboard(), fetchPendingClients().catch(() => null)])
      closeModal()
    } catch (err) {
      setError(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const handlePriceOverride = async (payload, resetForm) => {
    try {
      setActionLoading(true)
      await api.setPriceOverride(payload)
      resetForm?.()
      showToast('Precio personalizado guardado')
      await Promise.all([refreshDashboard(), fetchPendingClients().catch(() => null)])
      closeModal()
    } catch (err) {
      setError(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const handleCashflowSubmit = async (payload, resetForm) => {
    try {
      setActionLoading(true)
      await api.createCashflowEntry(payload)
      resetForm?.()
      showToast(payload.type === 'egreso' ? 'Egreso registrado' : 'Ingreso registrado')
      await fetchCashflow().catch(() => null)
      closeModal()
    } catch (err) {
      setError(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const handleGenerateReport = async () => {
    try {
      setActionLoading(true)
      const reportData = await api.getInventoryReport()
      setReport(reportData)
      showToast('Reporte generado')
    } catch (err) {
      setError(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const handlePendingClientsRefresh = async () => {
    try {
      setPendingClientsLoading(true)
      setPendingClientsProcessingId(null)
      await fetchPendingClients()
      showToast('Clientes con deuda actualizados')
    } catch (err) {
      setError(err.message)
    } finally {
      setPendingClientsLoading(false)
    }
  }

  const handleMarkOrdersDelivered = async (entry) => {
    if (!entry || !Array.isArray(entry.orderIds) || entry.orderIds.length === 0) {
      showToast('No hay pedidos pendientes para este cliente')
      return
    }

    try {
      setPendingClientsSubmitting(true)
      setPendingClientsProcessingId(entry.client?.id || null)
      setError(null)
      await api.markOrdersDelivered(entry.orderIds)
      const incomeAmount = Number(entry.totalAmount || 0)
      const clientName = entry.client?.nombreCompleto?.trim() || ''
      let saleRegistered = false
      let cashflowError = null

      if (incomeAmount > 0) {
        try {
          await api.createCashflowEntry({
            type: 'ingreso',
            amount: incomeAmount,
            category: 'Ventas',
            description: clientName ? `Venta a ${clientName}` : 'Venta registrada',
          })
          saleRegistered = true
          await fetchCashflow().catch(() => null)
        } catch (err) {
          cashflowError = err
          console.error(err)
        }
      }

      if (cashflowError) {
        setError(cashflowError.message)
      }

      const baseMessage = clientName
        ? `Entrega confirmada: ${clientName}`
        : 'Pedidos marcados como entregados'
      const finalMessage = saleRegistered ? `${baseMessage} · Venta registrada` : baseMessage
      showToast(
        cashflowError ? `${finalMessage} (revisa ingresos)` : finalMessage,
      )
      await Promise.all([
        refreshDashboard(),
        refreshOrders(),
        fetchPendingClients().catch(() => null),
      ])
    } catch (err) {
      setError(err.message)
    } finally {
      setPendingClientsSubmitting(false)
      setPendingClientsProcessingId(null)
    }
  }

  const handleCancelPendingOrders = async (entry) => {
    if (!entry || !Array.isArray(entry.orderIds) || entry.orderIds.length === 0) {
      showToast('No hay pedidos pendientes para este cliente')
      return
    }

    const clientName = entry.client?.nombreCompleto?.trim() || ''
    const confirmationMessage = clientName
      ? `¿Cancelar los pedidos pendientes de ${clientName}?`
      : '¿Cancelar los pedidos seleccionados?'

    const confirmed = window.confirm(confirmationMessage)
    if (!confirmed) {
      return
    }

    try {
      setPendingClientsSubmitting(true)
      setPendingClientsProcessingId(entry.client?.id || null)
      setError(null)
      await api.cancelOrders(entry.orderIds)
      showToast(clientName ? `Pedidos cancelados: ${clientName}` : 'Pedidos cancelados')
      await Promise.all([
        refreshDashboard(),
        refreshOrders(),
        fetchPendingClients().catch(() => null),
      ])
    } catch (err) {
      setError(err.message)
    } finally {
      setPendingClientsSubmitting(false)
      setPendingClientsProcessingId(null)
    }
  }

  return (
    <div className="app-shell">
      <Header
        onSearch={setSearchTerm}
        searchTerm={searchTerm}
        totalClients={clients.length}
        onNewProduct={() => setModal('create-product')}
      />
      <ActionBar onSelect={handleAction} />
      {error && <div className="app-error">{error}</div>}
      <main className="main-grid">
        <section className="primary-panel">
          <KPIGrid metrics={dashboard.metrics} />
          {loading ? (
            <div className="panel loading-panel">Cargando inventario...</div>
          ) : (
            <>
              <CashflowPanel
                data={cashflow}
                loading={cashflowLoading}
                searchTerm={searchTerm}
                onAddEntry={() => setModal('cashflow-entry')}
              />
              {pendingClientsLoading ? (
                <div className="panel loading-panel">Calculando montos...</div>
              ) : pendingClientsData?.clients?.length ? (
                <PendingClientsPanel
                  data={pendingClientsData}
                  searchTerm={searchTerm}
                  onMarkDelivered={handleMarkOrdersDelivered}
                  onCancelOrders={handleCancelPendingOrders}
                  isUpdating={pendingClientsSubmitting}
                  processingClientId={pendingClientsProcessingId}
                />
              ) : (
                <div className="panel empty-panel">
                  <h2>Clientes sin deuda pendiente</h2>
                  <p>No hay productos por entregar en este momento.</p>
                </div>
              )}
              <ClientDirectoryPanel
                clients={clients}
                pendingSummary={pendingSummaryMap}
                searchTerm={searchTerm}
              />
              <InventoryTable
                products={filteredProducts}
                selectedProductId={selectedProductId}
                onSelectProduct={setSelectedProductId}
              />
            </>
          )}
          {report && <ReportViewer report={report} />}
        </section>
        <aside className="secondary-panel">
          <button
            type="button"
            className="panel-button"
            onClick={() => setModal('activity-feed')}
          >
            <span>Actividad reciente</span>
            <span className="panel-button-badge">
              {Array.isArray(dashboard.activities) ? dashboard.activities.length : 0}
            </span>
          </button>
          {summaryVisible && (
            <SummaryPanel
              metrics={dashboard.metrics}
              clients={clients}
              orders={orders}
              pricing={dashboard.pricing}
              products={dashboard.products}
            />
          )}
        </aside>
      </main>

      {modal === 'add-client' && (
        <Modal title="Agregar cliente" onClose={closeModal}>
          <ClientForm
            comunas={dashboard.settings?.comunas || []}
            diasReparto={dashboard.settings?.diasReparto || DELIVERY_DAYS}
            onSubmit={handleClientSubmit}
            submitting={actionLoading}
          />
        </Modal>
      )}

      {modal === 'choose-edit' && (
        <Modal title="¿Qué deseas editar?" onClose={closeModal}>
          <div className="modal-choice-buttons">
            <button
              type="button"
              className="modal-choice-button"
              onClick={() => handleEditChoice('product')}
            >
              Producto
            </button>
            <button
              type="button"
              className="modal-choice-button"
              onClick={() => handleEditChoice('client')}
            >
              Cliente
            </button>
            <button
              type="button"
              className="modal-choice-button"
              onClick={() => handleEditChoice('order')}
            >
              Pedido
            </button>
          </div>
        </Modal>
      )}

      {modal === 'new-order' && (
        <Modal title="Nuevo pedido" onClose={closeModal}>
          <OrderForm
            clients={clients}
            products={dashboard.products}
            onSubmit={handleOrderSubmit}
            submitting={actionLoading}
          />
        </Modal>
      )}

      {modal === 'create-product' && (
        <Modal title="Crear producto" onClose={closeModal}>
          <ProductCreateForm onSubmit={handleProductCreate} submitting={actionLoading} />
        </Modal>
      )}

      {modal === 'edit-product' && (
        <Modal title="Editar producto" onClose={closeModal}>
          <ProductEditForm
            products={dashboard.products}
            onSubmit={handleProductUpdate}
            onDeleteProduct={handleProductDelete}
            submitting={actionLoading}
          />
        </Modal>
      )}

      {modal === 'edit-client' && (
        <Modal title="Editar cliente" onClose={closeModal}>
          <ClientEditForm
            clients={clients}
            comunas={dashboard.settings?.comunas || []}
            diasReparto={dashboard.settings?.diasReparto || DELIVERY_DAYS}
            onSubmit={handleClientUpdate}
            onDeleteClient={handleClientDelete}
            submitting={actionLoading}
          />
        </Modal>
      )}

      {modal === 'edit-order' && (
        <Modal title="Editar pedido" onClose={closeModal}>
          <OrderEditForm
            orders={orders}
            clients={clients}
            products={dashboard.products}
            onSubmit={handleOrderUpdate}
            submitting={actionLoading}
          />
        </Modal>
      )}

      {modal === 'change-price' && (
        <Modal title="Cambiar precio" onClose={closeModal}>
          <PriceChangeForm
            product={selectedProduct}
            onSubmit={handlePriceChange}
            submitting={actionLoading}
          />
        </Modal>
      )}

      {modal === 'manage-prices' && (
        <Modal title="Gestionar precios" onClose={closeModal}>
          <PriceOverrideForm
            comunas={dashboard.settings?.comunas || []}
            products={dashboard.products || []}
            overrides={dashboard.pricing?.preciosPorComuna || {}}
            onSubmit={handlePriceOverride}
            submitting={actionLoading}
          />
        </Modal>
      )}

      {modal === 'view-client' && (
        <Modal title="Historial del cliente" onClose={closeModal}>
          <ClientInsightModal
            clients={clients}
            orders={orders}
            products={dashboard.products || []}
            pricing={dashboard.pricing}
          />
        </Modal>
      )}

      {modal === 'cashflow-entry' && (
        <Modal title="Registrar ingreso/egreso" onClose={closeModal}>
          <CashflowEntryForm onSubmit={handleCashflowSubmit} submitting={actionLoading} />
        </Modal>
      )}

      {modal === 'activity-feed' && (
        <Modal title="Actividad reciente" onClose={closeModal}>
          <ActivityFeed activities={dashboard.activities} variant="modal" />
        </Modal>
      )}

      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  )
}

export default App
