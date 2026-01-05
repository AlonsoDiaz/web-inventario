import { useEffect, useMemo, useRef, useState } from 'react'
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
import ReportViewer from './components/ReportViewer.jsx'
import ProductCreateForm from './components/forms/ProductCreateForm.jsx'
import PendingClientsPanel from './components/PendingClientsPanel.jsx'
import DebtsPanel from './components/DebtsPanel.jsx'
import ClientDirectoryPanel from './components/ClientDirectoryPanel.jsx'
import CashflowPanel from './components/CashflowPanel.jsx'
import CashflowEntryForm from './components/forms/CashflowEntryForm.jsx'
import ClientInsightModal from './components/ClientInsightModal.jsx'
import ConfirmDialog from './components/ConfirmDialog.jsx'
import DeliverySelectionForm from './components/forms/DeliverySelectionForm.jsx'
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
      cash: summary.cash || 0,
      bank: summary.bank || 0,
    },
    generatedAt: data.generatedAt || null,
  }
}

const initialCashflow = normalizeCashflow()

const normalizeDebts = (data = {}) => ({
  debts: Array.isArray(data.debts)
    ? data.debts.map((debt) => ({
        ...debt,
        items: Array.isArray(debt.items) ? debt.items : [],
        client: debt.client || null,
      }))
    : [],
  generatedAt: data.generatedAt || null,
})

const initialDebts = normalizeDebts()

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
  const [pendingClientsData, setPendingClientsData] = useState(null)
  const [pendingClientsLoading, setPendingClientsLoading] = useState(false)
  const [pendingClientsSubmitting, setPendingClientsSubmitting] = useState(false)
  const [pendingClientsProcessingId, setPendingClientsProcessingId] = useState(null)
  const [cashflow, setCashflow] = useState(initialCashflow)
  const [cashflowLoading, setCashflowLoading] = useState(false)
  const [debts, setDebts] = useState(initialDebts)
  const [debtsLoading, setDebtsLoading] = useState(false)
  const [deliveryContext, setDeliveryContext] = useState(null)
  const [debtContext, setDebtContext] = useState(null)
  const pendingClientsSectionRef = useRef(null)
  const [confirmDialog, setConfirmDialog] = useState(null)
  const confirmResolveRef = useRef(null)
  const normalizedSearchTerm = useMemo(() => normalizeText(searchTerm), [searchTerm])

  const openConfirmDialog = (config = {}) =>
    new Promise((resolve) => {
      confirmResolveRef.current = resolve
      setConfirmDialog({
        title: config.title || 'Confirmar acción',
        message: config.message || '¿Deseas continuar?',
        detail: config.detail || null,
        highlight: config.highlight || null,
        tone: config.tone || 'primary',
        confirmLabel: config.confirmLabel || 'Confirmar',
        cancelLabel: config.cancelLabel || 'Cancelar',
        variant: config.variant || 'default',
        accentIcon: config.accentIcon || null,
      })
    })

  const resolveConfirmDialog = (result) => {
    if (confirmResolveRef.current) {
      confirmResolveRef.current(result)
      confirmResolveRef.current = null
    }
    setConfirmDialog(null)
  }

  const paymentMethodPrompt = async () => {
    const result = await openConfirmDialog({
      title: 'Selecciona método de pago',
      message: 'Registra si el pago fue en efectivo o transferencia.',
      confirmLabel: 'Efectivo',
      cancelLabel: 'Transferencia',
      tone: 'primary',
      accentIcon: '💳',
    })
    if (result === true) {
      return 'efectivo'
    }
    if (result === false) {
      return 'transferencia'
    }
    return null
  }

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
      setDebtsLoading(true)
      const [dashboardData, clientData, ordersData, pendingClients, cashflowData, debtsData] = await Promise.all([
        api.getDashboard(),
        api.getClients(),
        api.getOrders(),
        api.getPendingClients(),
        api.getCashflow(),
        api.getDebts(),
      ])
      setDashboard(normalizeDashboard(dashboardData))
      setClients(clientData)
      setOrders(ordersData)
      setPendingClientsData(pendingClients)
      setCashflow(normalizeCashflow(cashflowData))
      setDebts(normalizeDebts(debtsData))
      setError(null)
    } catch (err) {
      console.error(err)
      setError(err.message)
    } finally {
      setLoading(false)
      setPendingClientsLoading(false)
      setDebtsLoading(false)
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

  const refreshDebts = async () => {
    const data = await api.getDebts()
    setDebts(normalizeDebts(data))
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

  const handleDebtsRefresh = async (notify = false) => {
    try {
      setDebtsLoading(true)
      await refreshDebts()
      if (notify) {
        showToast('Deudas actualizadas')
      }
    } catch (err) {
      console.error(err)
      setError(err.message)
      throw err
    } finally {
      setDebtsLoading(false)
    }
  }

  const handleOpenDebtsModal = () => {
    setModal('view-debts')
    handleDebtsRefresh().catch(() => null)
  }

  const closeModal = () => {
    setModal(null)
    setActionLoading(false)
    setDeliveryContext(null)
    setDebtContext(null)
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
      case 'view-client':
        setModal('view-client')
        break
      case 'view-pending-clients':
        handlePendingClientsRefresh()
        scrollToPendingClients()
        break
      case 'view-debts':
        handleOpenDebtsModal()
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

  const handleCashflowDelete = async (entry) => {
    if (!entry || !entry.id) {
      showToast('Movimiento no disponible')
      return
    }

    const amount = Number(entry.amount || 0)
    const confirmed = await openConfirmDialog({
      title: 'Eliminar movimiento',
      message: 'Esta acción quitará el ingreso o egreso del registro.',
      detail: entry.description || entry.category || 'Sin detalle',
      highlight: amount > 0 ? `$${amount.toLocaleString('es-CL')}` : null,
      confirmLabel: 'Eliminar',
      cancelLabel: 'Conservar',
      tone: 'danger',
    })
    if (!confirmed) {
      return
    }

    try {
      setCashflowLoading(true)
      setError(null)
      await api.deleteCashflowEntry(entry.id)
      showToast('Movimiento eliminado')
      await fetchCashflow().catch(() => null)
    } catch (err) {
      setError(err.message)
    } finally {
      setCashflowLoading(false)
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
      await Promise.all([fetchPendingClients(), handleDebtsRefresh()])
      showToast('Clientes con deuda actualizados')
      scrollToPendingClients()
    } catch (err) {
      setError(err.message)
    } finally {
      setPendingClientsLoading(false)
    }
  }

  const scrollToPendingClients = () => {
    if (pendingClientsSectionRef.current) {
      pendingClientsSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  const getOrdersWithPendingItems = (entry) => {
    if (!entry || !Array.isArray(entry.orders)) {
      return []
    }
    return entry.orders.filter((order) => Array.isArray(order.items) && order.items.length > 0)
  }

  const handleMarkOrdersDelivered = (entry) => {
    if (!entry || !Array.isArray(entry.orderIds) || entry.orderIds.length === 0) {
      showToast('No hay pedidos pendientes para este cliente')
      return
    }

    const ordersWithItems = getOrdersWithPendingItems(entry)

    if (!ordersWithItems.length) {
      showToast('Actualiza el listado para seleccionar los productos entregados')
      return
    }

    setDeliveryContext({ ...entry, orders: ordersWithItems })
    setModal('delivery-selection')
  }

  const handleDeliverySelectionConfirm = async (deliveries) => {
    if (!deliveryContext) {
      showToast('Selecciona nuevamente al cliente para registrar la entrega')
      return
    }

    if (!Array.isArray(deliveries) || deliveries.length === 0) {
      showToast('Selecciona al menos un producto pendiente')
      return
    }

    const clientId = deliveryContext.client?.id || null
    const clientName = deliveryContext.client?.nombreCompleto?.trim() || ''

    try {
      setPendingClientsSubmitting(true)
      setPendingClientsProcessingId(clientId)
      setError(null)

      const response = await api.markOrdersDelivered({ deliveries })
      const deliveredItems = Array.isArray(response?.deliveredItems)
        ? response.deliveredItems
        : []
      const deliveredCount = deliveredItems.length
      const deliveredAmount = Number(response?.totalAmount || 0)

      let saleRegistered = false
      let cashflowError = null

      if (deliveredAmount > 0) {
        const method = await paymentMethodPrompt()
        if (!method) {
          showToast('Selecciona método: efectivo o transferencia')
        } else {
          try {
            await api.createCashflowEntry({
              type: 'ingreso',
              amount: deliveredAmount,
              category: 'Ventas',
              description: clientName ? `Entrega a ${clientName}` : 'Entrega registrada',
              paymentMethod: method,
            })
            saleRegistered = true
            await fetchCashflow().catch(() => null)
          } catch (err) {
            cashflowError = err
            console.error(err)
          }
        }
      }

      if (cashflowError) {
        setError(cashflowError.message)
      }

      const baseLabel = clientName ? `Entrega registrada: ${clientName}` : 'Entrega registrada'
      const detailLabel = deliveredCount
        ? `${deliveredCount} producto${deliveredCount === 1 ? '' : 's'}`
        : null
      const combined = detailLabel ? `${baseLabel} · ${detailLabel}` : baseLabel
      const finalMessage = saleRegistered ? `${combined} · Venta registrada` : combined
      showToast(cashflowError ? `${finalMessage} (revisa ingresos)` : finalMessage)

      await Promise.all([
        refreshDashboard(),
        refreshOrders(),
        fetchPendingClients().catch(() => null),
      ])

      closeModal()
    } catch (err) {
      setError(err.message)
    } finally {
      setPendingClientsSubmitting(false)
      setPendingClientsProcessingId(null)
    }
  }

  const handleDebtSelectionConfirm = async (selections) => {
    if (!debtContext) {
      showToast('Selecciona nuevamente al cliente para registrar la deuda')
      return
    }

    if (!Array.isArray(selections) || selections.length === 0) {
      showToast('Selecciona al menos un producto pendiente')
      return
    }

    const clientId = debtContext.client?.id
    if (!clientId) {
      showToast('No se pudo identificar al cliente')
      return
    }

    const clientName = debtContext.client?.nombreCompleto?.trim() || ''

    try {
      setPendingClientsSubmitting(true)
      setPendingClientsProcessingId(clientId)
      setError(null)

      const response = await api.createDebt({
        clientId,
        selections,
      })

      const debtAmount = Number(response?.debt?.amount || 0)
      const baseLabel = clientName ? `Deuda creada para ${clientName}` : 'Deuda registrada'
      const amountLabel = debtAmount > 0 ? ` · $${debtAmount.toLocaleString('es-CL')}` : ''
      showToast(`${baseLabel}${amountLabel}`)

      await Promise.all([
        refreshDashboard(),
        refreshOrders(),
        fetchPendingClients().catch(() => null),
        handleDebtsRefresh().catch(() => null),
      ])

      closeModal()
    } catch (err) {
      setError(err.message)
    } finally {
      setPendingClientsSubmitting(false)
      setPendingClientsProcessingId(null)
    }
  }

  const handleCreateDebt = (entry) => {
    if (!entry || !Array.isArray(entry.orderIds) || entry.orderIds.length === 0) {
      showToast('No hay pedidos pendientes para este cliente')
      return
    }

    const clientId = entry.client?.id
    if (!clientId) {
      showToast('No se pudo identificar al cliente')
      return
    }

    const ordersWithItems = getOrdersWithPendingItems(entry)
    if (!ordersWithItems.length) {
      showToast('Actualiza el listado para seleccionar los productos a deuda')
      return
    }

    setDebtContext({ ...entry, orders: ordersWithItems })
    setModal('debt-selection')
  }

  const handleMarkDebtPaid = async (debt) => {
    if (!debt || !debt.id) {
      showToast('No se pudo identificar la deuda')
      return
    }

    const clientName = debt.client?.nombreCompleto?.trim() || ''
    const amount = Number(debt.amount || 0)
    const confirmed = await openConfirmDialog({
      title: clientName ? `Registrar pago · ${clientName}` : 'Registrar pago',
      message: 'Confirma que recibiste el pago de esta deuda.',
      detail: 'El monto se sumará a los ingresos del día y la deuda quedará marcada como pagada.',
      highlight: amount > 0 ? `$${amount.toLocaleString('es-CL')}` : null,
      confirmLabel: 'Registrar pago',
      cancelLabel: 'Volver',
      tone: 'success',
      variant: 'receipt',
      accentIcon: '💸',
    })
    if (!confirmed) {
      return
    }

    const method = await paymentMethodPrompt()
    if (!method) {
      showToast('Selecciona método: efectivo o transferencia')
      return
    }

    try {
      setDebtsLoading(true)
      setError(null)
      await api.payDebt(debt.id, { paymentMethod: method })
      showToast(clientName ? `Pago registrado: ${clientName}` : 'Pago registrado')
      await Promise.all([
        refreshDashboard(),
        refreshOrders(),
        fetchPendingClients().catch(() => null),
        refreshDebts().catch(() => null),
        fetchCashflow().catch(() => null),
      ])
    } catch (err) {
      setError(err.message)
    } finally {
      setDebtsLoading(false)
    }
  }

  const handleCancelPendingOrders = async (entry) => {
    if (!entry || !Array.isArray(entry.orderIds) || entry.orderIds.length === 0) {
      showToast('No hay pedidos pendientes para este cliente')
      return
    }

    const clientName = entry.client?.nombreCompleto?.trim() || ''
    const detailLabel = entry.orderIds.length > 1
      ? `${entry.orderIds.length} pedidos serán eliminados.`
      : `Se eliminará el pedido ${entry.orderIds[0]}.`
    const confirmed = await openConfirmDialog({
      title: clientName ? `Cancelar pedidos de ${clientName}` : 'Cancelar pedidos pendientes',
      message: 'Los productos pendientes se descartarán y el cliente saldrá del listado.',
      detail: detailLabel,
      highlight: `${entry.orderIds.length} ${entry.orderIds.length === 1 ? 'pedido' : 'pedidos'}`,
      confirmLabel: 'Sí, cancelar',
      cancelLabel: 'Mantener pedidos',
      tone: 'danger',
    })
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
                onDeleteEntry={handleCashflowDelete}
              />
              <div ref={pendingClientsSectionRef}>
                {pendingClientsLoading ? (
                  <div className="panel loading-panel">Calculando montos...</div>
                ) : pendingClientsData?.clients?.length ? (
                  <PendingClientsPanel
                    data={pendingClientsData}
                    searchTerm={searchTerm}
                    onMarkDelivered={handleMarkOrdersDelivered}
                    onCancelOrders={handleCancelPendingOrders}
                    onCreateDebt={handleCreateDebt}
                    isUpdating={pendingClientsSubmitting}
                    processingClientId={pendingClientsProcessingId}
                  />
                ) : (
                  <div className="panel empty-panel">
                    <h2>Sin pedidos pendientes</h2>
                    <p>No hay productos por entregar en este momento.</p>
                  </div>
                )}
              </div>
              <DebtsPanel
                data={debts}
                loading={debtsLoading}
                limit={3}
                onRefresh={() => handleDebtsRefresh(true).catch(() => null)}
                onMarkPaid={handleMarkDebtPaid}
              />
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

      {modal === 'view-debts' && (
        <Modal title="Clientes con deudas" onClose={closeModal}>
          <DebtsPanel
            data={debts}
            loading={debtsLoading}
            onRefresh={() => handleDebtsRefresh(true).catch(() => null)}
            onMarkPaid={handleMarkDebtPaid}
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
            onRequestConfirm={openConfirmDialog}
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
            onRequestConfirm={openConfirmDialog}
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

      {modal === 'delivery-selection' && (
        <Modal
          title={
            deliveryContext?.client?.nombreCompleto
              ? `Registrar entrega · ${deliveryContext.client.nombreCompleto}`
              : 'Registrar entrega'
          }
          onClose={closeModal}
        >
          <DeliverySelectionForm
            entry={deliveryContext}
            onCancel={closeModal}
            onConfirm={handleDeliverySelectionConfirm}
            isSubmitting={pendingClientsSubmitting}
          />
        </Modal>
      )}

      {modal === 'debt-selection' && (
        <Modal
          title={
            debtContext?.client?.nombreCompleto
              ? `Registrar deuda · ${debtContext.client.nombreCompleto}`
              : 'Registrar deuda'
          }
          onClose={closeModal}
        >
          <DeliverySelectionForm
            entry={debtContext}
            onCancel={closeModal}
            onConfirm={handleDebtSelectionConfirm}
            isSubmitting={pendingClientsSubmitting}
            introText="Selecciona los productos que pasarán a deuda. Solo se incluirán los seleccionados."
            emptyStateMessage="No hay productos pendientes disponibles para registrar como deuda. Actualiza la lista e inténtalo nuevamente."
            submitLabel="Confirmar deuda"
          />
        </Modal>
      )}

      {modal === 'activity-feed' && (
        <Modal title="Actividad reciente" onClose={closeModal}>
          <ActivityFeed activities={dashboard.activities} variant="modal" />
        </Modal>
      )}

      {confirmDialog && (
        <ConfirmDialog
          {...confirmDialog}
          onCancel={() => resolveConfirmDialog(false)}
          onConfirm={() => resolveConfirmDialog(true)}
        />
      )}

      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  )
}

export default App
