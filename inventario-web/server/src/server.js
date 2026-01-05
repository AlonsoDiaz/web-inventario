import cors from 'cors'
import express from 'express'
import { nanoid } from 'nanoid'
import { readData, mutateData } from './storage.js'

const app = express()
const PORT = Number(process.env.PORT || 4000)
const CORS_WHITELIST = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
]

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || CORS_WHITELIST.includes(origin)) {
        callback(null, true)
        return
      }
      callback(new Error('CORS not allowed'))
    },
  }),
)
app.use(express.json())

const toISO = () => new Date().toISOString()
const normalizeUnit = (unit) => {
  if (typeof unit !== 'string') {
    return 'Unidad'
  }
  const cleaned = unit.trim()
  return cleaned.length ? cleaned : 'Unidad'
}

const normalizeProductForResponse = (product) => ({
  ...product,
  unit: normalizeUnit(product?.unit),
})

const normalizeProductsForResponse = (products = []) =>
  Array.isArray(products) ? products.map(normalizeProductForResponse) : []

const GENERAL_PRICE_KEY = '__general__'

const normalizePriceValue = (value) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null
  }
  return parsed
}

const normalizePriceOverrides = (overrides = {}) => {
  if (!overrides || typeof overrides !== 'object' || Array.isArray(overrides)) {
    return {}
  }

  const result = {}

  Object.entries(overrides).forEach(([comuna, value]) => {
    if (value == null) {
      return
    }

    if (typeof value === 'number' || typeof value === 'string') {
      const parsed = normalizePriceValue(value)
      if (parsed != null) {
        result[comuna] = { [GENERAL_PRICE_KEY]: parsed }
      }
      return
    }

    if (typeof value === 'object' && !Array.isArray(value)) {
      const comunaEntries = {}

      Object.entries(value).forEach(([productKey, priceValue]) => {
        const parsed = normalizePriceValue(priceValue)
        if (parsed != null) {
          comunaEntries[productKey] = parsed
        }
      })

      if (Object.keys(comunaEntries).length > 0) {
        result[comuna] = comunaEntries
      }
    }
  })

  return result
}

const ensurePricingShape = (data) => {
  if (!data.pricing || typeof data.pricing !== 'object') {
    data.pricing = { precioCaja: 0, preciosPorComuna: {} }
  }

  const normalizedOverrides = normalizePriceOverrides(data.pricing.preciosPorComuna)
  data.pricing.preciosPorComuna = normalizedOverrides

  const basePrice = normalizePriceValue(data.pricing.precioCaja)
  data.pricing.precioCaja = basePrice != null ? basePrice : 0

  return data.pricing
}

const resolvePriceForComuna = (productId, comuna, overrides, fallback) => {
  if (!comuna || !overrides || typeof overrides !== 'object') {
    return fallback
  }

  const comunaOverrides = overrides[comuna]
  if (comunaOverrides == null) {
    return fallback
  }

  if (typeof comunaOverrides === 'number' || typeof comunaOverrides === 'string') {
    const parsed = normalizePriceValue(comunaOverrides)
    return parsed != null ? parsed : fallback
  }

  if (typeof comunaOverrides !== 'object' || Array.isArray(comunaOverrides)) {
    return fallback
  }

  if (Object.prototype.hasOwnProperty.call(comunaOverrides, productId)) {
    const parsed = normalizePriceValue(comunaOverrides[productId])
    if (parsed != null) {
      return parsed
    }
  }

  if (Object.prototype.hasOwnProperty.call(comunaOverrides, GENERAL_PRICE_KEY)) {
    const parsed = normalizePriceValue(comunaOverrides[GENERAL_PRICE_KEY])
    if (parsed != null) {
      return parsed
    }
  }

  return fallback
}

function computeMetrics(data) {
  const productosActivos = data.products.length
  const pedidosPendientes = data.orders.filter((order) => order.estado === 'pendiente').length
  const clientesActivos = data.clients.length

  return {
    productosActivos,
    pedidosPendientes,
    clientesActivos,
  }
}

const normalizePaymentMethod = (method) => {
  if (typeof method !== 'string') {
    return 'otro'
  }
  const value = method.trim().toLowerCase()
  if (value === 'efectivo' || value === 'transferencia') {
    return value
  }
  return 'otro'
}

function computeCashflowSummary(transactions = []) {
  return transactions.reduce(
    (acc, item) => {
      const amount = Number(item.amount || 0)
      const method = normalizePaymentMethod(item.paymentMethod)

      if (item.type === 'ingreso') {
        acc.totalIncome += amount
        if (method === 'efectivo') {
          acc.cash += amount
        } else if (method === 'transferencia') {
          acc.bank += amount
        }
      } else if (item.type === 'egreso') {
        acc.totalExpense += amount
        if (method === 'efectivo') {
          acc.cash -= amount
        } else if (method === 'transferencia') {
          acc.bank -= amount
        }
      }
      return acc
    },
    { totalIncome: 0, totalExpense: 0, cash: 0, bank: 0 },
  )
}

function formatActivity(activity) {
  return {
    ...activity,
    createdAt: activity.createdAt,
  }
}

function ensureActivityLog(data, activity) {
  const entry = {
    id: activity.id || nanoid(),
    title: activity.title,
    detail: activity.detail,
    createdAt: activity.createdAt || toISO(),
  }
  data.activities.unshift(entry)
  if (data.activities.length > 30) {
    data.activities = data.activities.slice(0, 30)
  }
}

function ensureDebtsCollection(data) {
  if (!Array.isArray(data.debts)) {
    data.debts = []
  }
  return data.debts
}

function ensureCashflowCollection(data) {
  if (!Array.isArray(data.cashflow)) {
    data.cashflow = []
  }
  return data.cashflow
}

const normalizeItemStatus = (status) => {
  if (status === 'entregado' || status === 'deuda') {
    return status
  }
  return 'pendiente'
}

function ensureOrderItemsStructure(order) {
  if (!order || !Array.isArray(order.items)) {
    order.items = []
    return order.items
  }
  order.items = order.items.map((item) => {
    if (!item.lineId) {
      item.lineId = nanoid()
    }
    item.status = normalizeItemStatus(item.status)
    return item
  })
  return order.items
}

function orderHasPendingItems(order) {
  return ensureOrderItemsStructure(order).some((item) => normalizeItemStatus(item.status) === 'pendiente')
}

function recalculateOrderStatus(order) {
  const items = ensureOrderItemsStructure(order)
  const hasPending = items.some((item) => normalizeItemStatus(item.status) === 'pendiente')
  if (hasPending) {
    order.estado = 'pendiente'
    return order.estado
  }
  const hasDebt = items.some((item) => item.status === 'deuda')
  if (hasDebt) {
    order.estado = 'deuda'
    return order.estado
  }
  const hasDelivered = items.some((item) => item.status === 'entregado')
  if (hasDelivered) {
    order.estado = 'completado'
    return order.estado
  }
  order.estado = 'pendiente'
  return order.estado
}

function findProduct(data, productId) {
  const product = data.products.find((item) => item.id === productId)
  if (!product) {
    const error = new Error('Producto no encontrado')
    error.status = 404
    throw error
  }
  return product
}

function formatDebtForResponse(debt, client) {
  if (!debt) {
    return null
  }

  const items = Array.isArray(debt.items)
    ? debt.items.map((item) => ({
        productId: item.productId,
        name: item.name,
        unit: item.unit,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        subtotal: item.subtotal,
      }))
    : []

  return {
    id: debt.id,
    clientId: debt.clientId,
    client: client || null,
    orderIds: Array.isArray(debt.orderIds) ? debt.orderIds : [],
    amount: Number.isFinite(Number(debt.amount)) ? Number(debt.amount) : 0,
    status: debt.status || 'pendiente',
    note: typeof debt.note === 'string' ? debt.note : '',
    createdAt: debt.createdAt,
    updatedAt: debt.updatedAt,
    paidAt: debt.paidAt || null,
    cashflowEntryId: debt.cashflowEntryId || null,
    items,
  }
}

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: toISO() })
})

app.get('/api/dashboard', async (_req, res) => {
  const data = await readData()
  const metrics = computeMetrics(data)
  const pricing = ensurePricingShape(data)
  res.json({
    metrics,
    products: normalizeProductsForResponse(data.products),
    activities: data.activities.map(formatActivity),
    pricing,
    settings: data.settings,
  })
})

app.get('/api/products', async (_req, res) => {
  const data = await readData()
  res.json(normalizeProductsForResponse(data.products))
})

app.post('/api/products', async (req, res, next) => {
  const { name, unitPrice = 0, category = 'General', notes = '', unit } = req.body

  if (!name) {
    res.status(400).json({ message: 'El campo name es requerido' })
    return
  }

  try {
    let createdProduct = null
    await mutateData((draft) => {
      const newProduct = {
        id: nanoid(),
        name,
        unitPrice: Number.isFinite(Number(unitPrice)) ? Number(unitPrice) : 0,
        category: typeof category === 'string' && category.trim() ? category.trim() : 'General',
        notes: typeof notes === 'string' ? notes.trim() : '',
        unit: normalizeUnit(unit),
      }

      draft.products.push(newProduct)
      createdProduct = newProduct
      ensureActivityLog(draft, {
        title: `Producto creado: ${name}`,
        detail: 'Nuevo producto agregado al inventario',
      })

      return draft
    })

    res.status(201).json(createdProduct)
  } catch (error) {
    next(error)
  }
})

app.patch('/api/products/:id', async (req, res, next) => {
  const { id } = req.params
  const updates = { ...req.body }

  if (Object.prototype.hasOwnProperty.call(updates, 'unitPrice')) {
    const parsed = Number(updates.unitPrice)
    if (Number.isFinite(parsed)) {
      updates.unitPrice = parsed
    } else {
      delete updates.unitPrice
    }
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'category')) {
    updates.category = typeof updates.category === 'string' && updates.category.trim()
      ? updates.category.trim()
      : 'General'
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'notes')) {
    updates.notes = typeof updates.notes === 'string' ? updates.notes.trim() : ''
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'unit')) {
    updates.unit = normalizeUnit(updates.unit)
  }

  try {
    const data = await mutateData((draft) => {
      const product = findProduct(draft, id)
      Object.assign(product, updates)
      ensureActivityLog(draft, {
        title: `Producto actualizado: ${product.name}`,
        detail: 'Se actualizaron detalles del producto.',
      })
      return draft
    })

    const product = data.products.find((item) => item.id === id)
    res.json(product)
  } catch (error) {
    next(error)
  }
})

app.post('/api/products/:id/price', async (req, res, next) => {
  const { id } = req.params
  const { unitPrice } = req.body

  if (typeof unitPrice !== 'number' || Number.isNaN(unitPrice)) {
    res.status(400).json({ message: 'unitPrice debe ser numérico' })
    return
  }

  try {
    const data = await mutateData((draft) => {
      const product = findProduct(draft, id)
      product.unitPrice = unitPrice
      ensureActivityLog(draft, {
        title: `Precio actualizado: ${product.name}`,
        detail: `Nuevo precio unidad $${unitPrice.toLocaleString('es-CL')}`,
      })
      return draft
    })

    const product = data.products.find((item) => item.id === id)
    res.json(product)
  } catch (error) {
    next(error)
  }
})

app.delete('/api/products/:id', async (req, res, next) => {
  const { id } = req.params

  try {
    let removedProduct = null
    let adjustedOrderIds = []
    let removedOrderIds = []

    await mutateData((draft) => {
      const index = draft.products.findIndex((product) => product.id === id)
      if (index === -1) {
        const error = new Error('Producto no encontrado')
        error.status = 404
        throw error
      }

      removedProduct = draft.products[index]
      draft.products.splice(index, 1)

      if (draft.pricing && draft.pricing.preciosPorComuna && typeof draft.pricing.preciosPorComuna === 'object') {
        Object.entries(draft.pricing.preciosPorComuna).forEach(([comuna, overrides]) => {
          if (overrides && typeof overrides === 'object' && !Array.isArray(overrides)) {
            if (Object.prototype.hasOwnProperty.call(overrides, id)) {
              delete overrides[id]
            }
            if (Object.keys(overrides).length === 0) {
              delete draft.pricing.preciosPorComuna[comuna]
            }
          }
        })
      }

      const remainingOrders = []

      draft.orders.forEach((order) => {
        if (!Array.isArray(order.items) || order.items.length === 0) {
          remainingOrders.push(order)
          return
        }

        const filteredItems = order.items.filter((item) => item?.productId !== id)

        if (filteredItems.length === 0) {
          removedOrderIds.push(order.id)
          return
        }

        if (filteredItems.length !== order.items.length) {
          order.items = filteredItems
          order.updatedAt = toISO()
          adjustedOrderIds.push(order.id)
        }

        remainingOrders.push(order)
      })

      draft.orders = remainingOrders

      const detailParts = []
      if (adjustedOrderIds.length) {
        detailParts.push(`${adjustedOrderIds.length} pedidos actualizados`)
      }
      if (removedOrderIds.length) {
        detailParts.push(`${removedOrderIds.length} pedidos eliminados`)
      }

      ensureActivityLog(draft, {
        title: `Producto eliminado: ${removedProduct.name}`,
        detail: detailParts.length ? detailParts.join(' · ') : 'Producto removido del inventario',
      })

      return draft
    })

    res.json({ productId: id, adjustedOrders: adjustedOrderIds, removedOrders: removedOrderIds })
  } catch (error) {
    next(error)
  }
})

app.get('/api/clients', async (_req, res) => {
  const data = await readData()
  res.json(data.clients)
})

app.post('/api/clients', async (req, res) => {
  const { nombreCompleto, telefono, direccion, comuna, diaReparto, region } = req.body

  if (!nombreCompleto || !telefono || !direccion || !comuna) {
    res.status(400).json({ message: 'Campos requeridos: nombreCompleto, telefono, direccion, comuna' })
    return
  }

  const cleanedDay = typeof diaReparto === 'string' ? diaReparto.trim() : ''
  const cleanedRegion = typeof region === 'string' ? region.trim() : ''

  const newClient = {
    id: nanoid(),
    nombreCompleto,
    telefono,
    direccion,
    comuna,
  }

  if (cleanedDay) {
    newClient.diaReparto = cleanedDay
  }

  if (cleanedRegion) {
    newClient.region = cleanedRegion
  }

  const data = await mutateData((draft) => {
    draft.clients.push(newClient)
    ensureActivityLog(draft, {
      title: `Cliente agregado: ${nombreCompleto}`,
      detail: `${comuna} · ${telefono}${cleanedDay ? ` · Entrega ${cleanedDay}` : ''}`,
    })
    return draft
  })

  res.status(201).json({ client: newClient, clientsTotal: data.clients.length })
})

app.patch('/api/clients/:id', async (req, res, next) => {
  const { id } = req.params
  const updates = { ...req.body }

  const sanitizeString = (value) => (typeof value === 'string' ? value.trim() : '')

  if (Object.prototype.hasOwnProperty.call(updates, 'nombreCompleto')) {
    updates.nombreCompleto = sanitizeString(updates.nombreCompleto)
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'nombre')) {
    updates.nombreCompleto = sanitizeString(updates.nombre)
    delete updates.nombre
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'telefono')) {
    updates.telefono = sanitizeString(updates.telefono)
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'direccion')) {
    updates.direccion = sanitizeString(updates.direccion)
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'comuna')) {
    updates.comuna = sanitizeString(updates.comuna)
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'region')) {
    const cleaned = sanitizeString(updates.region)
    updates.region = cleaned || undefined
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'diaReparto')) {
    const cleaned = sanitizeString(updates.diaReparto)
    updates.diaReparto = cleaned || undefined
  }

  try {
    const data = await mutateData((draft) => {
      const client = draft.clients.find((c) => c.id === id)
      if (!client) {
        const error = new Error('Cliente no encontrado')
        error.status = 404
        throw error
      }

      Object.assign(client, updates)

      ensureActivityLog(draft, {
        title: `Cliente actualizado: ${client.nombreCompleto}`,
        detail: `${client.comuna || 'Sin comuna'} · ${client.telefono || 'Sin teléfono'}`,
      })

      return draft
    })

    const updated = data.clients.find((c) => c.id === id)
    res.json(updated)
  } catch (error) {
    next(error)
  }
})

app.delete('/api/clients/:id', async (req, res, next) => {
  const { id } = req.params

  try {
    let removedClient = null
    let removedOrderIds = []

    await mutateData((draft) => {
      const index = draft.clients.findIndex((client) => client.id === id)
      if (index === -1) {
        const error = new Error('Cliente no encontrado')
        error.status = 404
        throw error
      }

      removedClient = draft.clients[index]
      draft.clients.splice(index, 1)

      const remainingOrders = []
      draft.orders.forEach((order) => {
        if (order.clienteId === id) {
          removedOrderIds.push(order.id)
          return
        }
        remainingOrders.push(order)
      })
      draft.orders = remainingOrders

      ensureActivityLog(draft, {
        title: `Cliente eliminado: ${removedClient.nombreCompleto}`,
        detail: `${removedClient.comuna || 'Sin comuna'} · ${removedClient.telefono || 'Sin teléfono'}`,
      })

      return draft
    })

    res.json({ clientId: id, removedOrders: removedOrderIds })
  } catch (error) {
    next(error)
  }
})

app.post('/api/orders', async (req, res) => {
  const { clienteId, items } = req.body

  if (!clienteId || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ message: 'clienteId y items son requeridos' })
    return
  }

  const normalizedItems = items
    .map((item = {}) => {
      const productId = item.productId
      const parsedQuantity = Number(item.cantidad)
      if (!productId || !Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
        return null
      }
      return {
        productId,
        cantidad: parsedQuantity,
        lineId: nanoid(),
        status: 'pendiente',
      }
    })
    .filter(Boolean)

  if (normalizedItems.length === 0) {
    res.status(400).json({ message: 'items deben incluir cantidades válidas' })
    return
  }

  const order = {
    id: nanoid(),
    clienteId,
    estado: 'pendiente',
    createdAt: toISO(),
    deliveredAt: null,
    items: normalizedItems,
  }

  const data = await mutateData((draft) => {
    const client = draft.clients.find((c) => c.id === clienteId)
    draft.orders.push(order)
    ensureActivityLog(draft, {
      title: `Pedido creado: ${order.id}`,
      detail: client ? `${client.nombreCompleto} · ${items.length} ítems` : 'Pedido registrado',
    })
    return draft
  })

  res.status(201).json({ order, ordersTotal: data.orders.length })
})

app.get('/api/orders', async (_req, res) => {
  const data = await readData()
  res.json(data.orders)
})

app.patch('/api/orders/:id', async (req, res, next) => {
  const { id } = req.params
  const { clienteId, items } = req.body || {}

  if (clienteId == null && !Array.isArray(items)) {
    res.status(400).json({ message: 'Debes especificar campos para actualizar' })
    return
  }

  try {
    const data = await mutateData((draft) => {
      const order = draft.orders.find((o) => o.id === id)
      if (!order) {
        const error = new Error('Pedido no encontrado')
        error.status = 404
        throw error
      }

      if (order.estado === 'completado') {
        const error = new Error('No se pueden editar pedidos completados')
        error.status = 400
        throw error
      }

      if (clienteId) {
        const clientExists = draft.clients.some((client) => client.id === clienteId)
        if (!clientExists) {
          const error = new Error('Cliente no válido')
          error.status = 400
          throw error
        }
        order.clienteId = clienteId
      }

      if (Array.isArray(items)) {
        const normalizedItems = []

        items.forEach((item) => {
          const productId = item?.productId
          const quantity = Number(item?.cantidad ?? item?.quantity)
          if (!productId || !Number.isFinite(quantity) || quantity <= 0) {
            return
          }

          const productExists = draft.products.some((product) => product.id === productId)
          if (!productExists) {
            return
          }

          normalizedItems.push({
            productId,
            cantidad: quantity,
            lineId: nanoid(),
            status: 'pendiente',
          })
        })

        if (!normalizedItems.length) {
          const error = new Error('Debes incluir al menos un producto válido')
          error.status = 400
          throw error
        }

        order.items = normalizedItems
      }

      order.updatedAt = toISO()

      const client = draft.clients.find((c) => c.id === order.clienteId)
      ensureActivityLog(draft, {
        title: `Pedido actualizado: ${order.id}`,
        detail: client ? `${client.nombreCompleto} · ${order.items.length} ítems` : `Pedido ${order.id} actualizado`,
      })

      return draft
    })

    const order = data.orders.find((o) => o.id === id)
    res.json(order)
  } catch (error) {
    next(error)
  }
})

app.get('/api/cashflow', async (_req, res) => {
  const data = await readData()
  const transactions = Array.isArray(data.cashflow) ? data.cashflow : []
  const summary = computeCashflowSummary(transactions)
  const response = {
    generatedAt: toISO(),
    transactions: [...transactions].sort((a, b) => {
      const dateA = new Date(a.date || a.createdAt || 0)
      const dateB = new Date(b.date || b.createdAt || 0)
      return dateB.getTime() - dateA.getTime()
    }),
    summary: {
      totalIncome: summary.totalIncome,
      totalExpense: summary.totalExpense,
      balance: summary.totalIncome - summary.totalExpense,
      cash: summary.cash,
      bank: summary.bank,
    },
  }
  res.json(response)
})

app.post('/api/cashflow', async (req, res) => {
  const { type, amount, category, description, date, paymentMethod } = req.body || {}

  const normalizedType = type === 'egreso' ? 'egreso' : 'ingreso'
  const parsedAmount = Number(amount)

  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    res.status(400).json({ message: 'amount debe ser numérico y mayor a 0' })
    return
  }

  const parsedDate = date ? new Date(date) : null
  if (parsedDate && Number.isNaN(parsedDate.getTime())) {
    res.status(400).json({ message: 'date no es válida' })
    return
  }

  const entryDate = parsedDate ? parsedDate.toISOString() : toISO()
  const now = toISO()
  const normalizedMethod = normalizePaymentMethod(paymentMethod)

  const data = await mutateData((draft) => {
    if (!Array.isArray(draft.cashflow)) {
      draft.cashflow = []
    }

    const entry = {
      id: nanoid(),
      type: normalizedType,
      amount: parsedAmount,
      category: typeof category === 'string' ? category.trim() : '',
      description: typeof description === 'string' ? description.trim() : '',
      date: entryDate,
      createdAt: now,
      paymentMethod: normalizedMethod,
    }

    draft.cashflow.push(entry)

    ensureActivityLog(draft, {
      title: `${normalizedType === 'ingreso' ? 'Ingreso' : 'Egreso'} registrado`,
      detail: `${entry.category || 'Sin categoría'} · $${parsedAmount.toLocaleString('es-CL')}`,
    })

    return draft
  })

  const transactions = Array.isArray(data.cashflow) ? data.cashflow : []
  const summary = computeCashflowSummary(transactions)

  res.status(201).json({
    entry: data.cashflow[data.cashflow.length - 1],
    summary: {
      totalIncome: summary.totalIncome,
      totalExpense: summary.totalExpense,
      balance: summary.totalIncome - summary.totalExpense,
      cash: summary.cash,
      bank: summary.bank,
    },
  })
})

app.delete('/api/cashflow/:id', async (req, res, next) => {
  const { id } = req.params

  try {
    const data = await mutateData((draft) => {
      const cashflow = ensureCashflowCollection(draft)
      const index = cashflow.findIndex((entry) => entry.id === id)
      if (index === -1) {
        const error = new Error('Movimiento no encontrado')
        error.status = 404
        throw error
      }

      const [removed] = cashflow.splice(index, 1)
      const amount = Number(removed?.amount || 0)
      ensureActivityLog(draft, {
        title: 'Movimiento eliminado',
        detail: `${removed?.category || 'Sin categoría'} · $${amount.toLocaleString('es-CL')}`,
      })
      return draft
    })

    const summary = computeCashflowSummary(Array.isArray(data.cashflow) ? data.cashflow : [])

    res.json({
      summary: {
        totalIncome: summary.totalIncome,
        totalExpense: summary.totalExpense,
        balance: summary.totalIncome - summary.totalExpense,
      },
    })
  } catch (error) {
    next(error)
  }
})

app.post('/api/orders/mark-delivered', async (req, res) => {
  const deliveriesInput = Array.isArray(req.body.deliveries) ? req.body.deliveries : []
  const legacyOrderIds = Array.isArray(req.body.orderIds) ? req.body.orderIds : []

  const sanitizedDeliveries = deliveriesInput
    .map((delivery) => {
      const orderId = typeof delivery?.orderId === 'string' ? delivery.orderId.trim() : ''
      if (!orderId) {
        return null
      }

      const lineIds = Array.isArray(delivery.lineIds)
        ? Array.from(
            new Set(
              delivery.lineIds
                .map((lineId) => (typeof lineId === 'string' ? lineId.trim() : ''))
                .filter(Boolean),
            ),
          )
        : null

      return {
        orderId,
        lineIds: lineIds && lineIds.length > 0 ? lineIds : null,
      }
    })
    .filter(Boolean)

  legacyOrderIds.forEach((orderId) => {
    if (typeof orderId === 'string' && orderId.trim()) {
      sanitizedDeliveries.push({ orderId: orderId.trim(), lineIds: null })
    }
  })

  if (!sanitizedDeliveries.length) {
    res.status(400).json({ message: 'Debes seleccionar al menos un pedido o producto' })
    return
  }

  const deliveriesByOrder = new Map()
  sanitizedDeliveries.forEach(({ orderId, lineIds }) => {
    if (!deliveriesByOrder.has(orderId)) {
      deliveriesByOrder.set(orderId, { orderId, deliverAll: false, lineIds: new Set() })
    }

    const entry = deliveriesByOrder.get(orderId)
    if (!lineIds || !lineIds.length) {
      entry.deliverAll = true
      entry.lineIds.clear()
      return
    }

    if (entry.deliverAll) {
      return
    }

    lineIds.forEach((lineId) => entry.lineIds.add(lineId))
  })

  const normalizedDeliveries = Array.from(deliveriesByOrder.values()).map((entry) => ({
    orderId: entry.orderId,
    lineIds: entry.deliverAll ? null : Array.from(entry.lineIds),
  }))

  const deliveredItems = []
  const now = toISO()

  const data = await mutateData((draft) => {
    const pricing = ensurePricingShape(draft)

    normalizedDeliveries.forEach(({ orderId, lineIds }) => {
      const order = draft.orders.find((o) => o.id === orderId)
      if (!order) {
        return
      }

      const items = ensureOrderItemsStructure(order)
      const targetLineIds = Array.isArray(lineIds) && lineIds.length ? new Set(lineIds) : null

      const pendingItems = items.filter((item) => {
        if (normalizeItemStatus(item.status) !== 'pendiente') {
          return false
        }
        if (targetLineIds && !targetLineIds.has(item.lineId)) {
          return false
        }
        return true
      })

      if (!pendingItems.length) {
        return
      }

      const client = draft.clients.find((c) => c.id === order.clienteId) || null
      const comuna = client?.comuna

      pendingItems.forEach((item) => {
        item.status = 'entregado'
        const product = draft.products.find((p) => p.id === item.productId) || null
        const fallbackPrice = product?.unitPrice || 0
        const unitPrice = product
          ? resolvePriceForComuna(
              product.id,
              comuna,
              pricing.preciosPorComuna,
              fallbackPrice,
            )
          : 0
        const quantity = Number(item.cantidad) || 0
        const subtotal = quantity * unitPrice

        deliveredItems.push({
          orderId: order.id,
          lineId: item.lineId,
          productId: item.productId,
          productName: product?.name || 'Producto',
          quantity,
          unitPrice,
          subtotal,
          clientId: order.clienteId,
        })
      })

      order.updatedAt = now
      const newStatus = recalculateOrderStatus(order)
      if (newStatus === 'completado') {
        order.deliveredAt = now
      } else if (newStatus === 'pendiente') {
        order.deliveredAt = null
      }

      const deliveredCount = pendingItems.length
      const clientName = client?.nombreCompleto || 'Cliente'
      ensureActivityLog(draft, {
        title: `Entrega registrada: ${order.id}`,
        detail: `${clientName} · ${deliveredCount} producto${deliveredCount === 1 ? '' : 's'}`,
        createdAt: now,
      })
    })

    return draft
  })

  if (!deliveredItems.length) {
    res.status(400).json({ message: 'No se encontraron productos pendientes para entregar' })
    return
  }

  const totalAmount = deliveredItems.reduce((sum, item) => sum + (item.subtotal || 0), 0)
  const updatedOrders = Array.from(new Set(deliveredItems.map((item) => item.orderId)))

  res.json({
    deliveredItems,
    totalAmount,
    updatedOrders,
    ordersTotal: data.orders.length,
  })
})

app.post('/api/orders/cancel', async (req, res) => {
  const { orderIds } = req.body

  if (!Array.isArray(orderIds) || orderIds.length === 0) {
    res.status(400).json({ message: 'orderIds debe ser un arreglo con al menos un id' })
    return
  }

  const idsSet = new Set(orderIds)
  const removedOrders = []

  const data = await mutateData((draft) => {
    const remaining = []

    draft.orders.forEach((order) => {
      if (!idsSet.has(order.id) || order.estado === 'completado' || order.estado === 'deuda') {
        remaining.push(order)
        return
      }

      removedOrders.push(order)

      const client = draft.clients.find((c) => c.id === order.clienteId)
      const detailParts = []
      if (client) {
        detailParts.push(client.nombreCompleto)
        if (client.comuna) {
          detailParts.push(client.comuna)
        }
      }
      detailParts.push(`Pedido ${order.id}`)

      ensureActivityLog(draft, {
        title: `Pedido cancelado: ${order.id}`,
        detail: detailParts.join(' · '),
      })
    })

    draft.orders = remaining

    return draft
  })

  if (removedOrders.length === 0) {
    res.status(400).json({ message: 'No se encontraron pedidos pendientes para cancelar' })
    return
  }

  res.json({
    removed: removedOrders.map((order) => order.id),
    ordersTotal: data.orders.length,
  })
})

app.post('/api/debts', async (req, res, next) => {
  const clientId = typeof req.body.clientId === 'string' ? req.body.clientId.trim() : ''
  const orderIdsInput = Array.isArray(req.body.orderIds) ? req.body.orderIds : []
  const rawSelections = Array.isArray(req.body.selections) ? req.body.selections : []
  const note = typeof req.body.note === 'string' ? req.body.note.trim() : ''

  const selections = rawSelections
    .map((entry) => {
      const orderId = typeof entry?.orderId === 'string' ? entry.orderId.trim() : ''
      const lineIds = Array.isArray(entry?.lineIds)
        ? Array.from(
            new Set(
              entry.lineIds
                .filter((lineId) => typeof lineId === 'string')
                .map((lineId) => lineId.trim())
                .filter(Boolean),
            ),
          )
        : []
      if (!orderId || lineIds.length === 0) {
        return null
      }
      return { orderId, lineIds }
    })
    .filter(Boolean)

  const hasSelections = selections.length > 0

  const orderIds = hasSelections
    ? Array.from(new Set(selections.map((entry) => entry.orderId)))
    : Array.from(
        new Set(
          orderIdsInput
            .filter((orderId) => typeof orderId === 'string')
            .map((orderId) => orderId.trim())
            .filter(Boolean),
        ),
      )

  if (!clientId) {
    res.status(400).json({ message: 'clientId es requerido' })
    return
  }

  if (orderIds.length === 0) {
    res.status(400).json({ message: 'Indica al menos un pedido para crear la deuda' })
    return
  }

  try {
    let createdDebtId = null

    const data = await mutateData((draft) => {
      const pricing = ensurePricingShape(draft)
      const client = draft.clients.find((c) => c.id === clientId)
      if (!client) {
        const error = new Error('Cliente no encontrado')
        error.status = 404
        throw error
      }

      const debts = ensureDebtsCollection(draft)
      const aggregatedItems = new Map()
      const targetOrders = []
      const selectionMap = hasSelections
        ? new Map(selections.map((entry) => [entry.orderId, new Set(entry.lineIds)]))
        : null
      let totalAmount = 0
      const now = toISO()

      orderIds.forEach((orderId) => {
        const order = draft.orders.find((o) => o.id === orderId)
        if (!order) {
          const error = new Error(`Pedido no encontrado: ${orderId}`)
          error.status = 400
          throw error
        }

        if (order.clienteId !== clientId) {
          const error = new Error('El pedido no pertenece al cliente indicado')
          error.status = 400
          throw error
        }

        if (order.estado !== 'pendiente') {
          const error = new Error('Solo se pueden usar pedidos pendientes para crear una deuda')
          error.status = 400
          throw error
        }

        const allowedLineIds = hasSelections ? selectionMap.get(orderId) : null
        let contributedItems = 0

        ensureOrderItemsStructure(order).forEach((item) => {
          if (normalizeItemStatus(item.status) !== 'pendiente') {
            return
          }

          if (hasSelections && (!allowedLineIds || !allowedLineIds.has(item.lineId))) {
            return
          }

          const product = draft.products.find((p) => p.id === item.productId)
          if (!product) {
            return
          }

          const quantity = Number(item.cantidad)
          if (!Number.isFinite(quantity) || quantity <= 0) {
            return
          }

          const unitPrice = resolvePriceForComuna(
            product.id,
            client.comuna,
            pricing.preciosPorComuna,
            product.unitPrice || 0,
          )

          const subtotal = quantity * unitPrice
          const existing = aggregatedItems.get(product.id) || {
            productId: product.id,
            name: product.name,
            unit: product.unit || 'Unidad',
            unitPrice,
            quantity: 0,
            subtotal: 0,
          }

          existing.quantity += quantity
          existing.subtotal += subtotal
          aggregatedItems.set(product.id, existing)
          totalAmount += subtotal
          contributedItems += 1
        })

        if (hasSelections && contributedItems === 0) {
          const error = new Error('Los productos seleccionados ya no están pendientes. Actualiza el listado e inténtalo nuevamente.')
          error.status = 400
          throw error
        }

        if (contributedItems > 0 || !hasSelections) {
          targetOrders.push(order)
        }
      })

      if (aggregatedItems.size === 0 || totalAmount <= 0) {
        const error = new Error('No hay productos válidos para registrar como deuda')
        error.status = 400
        throw error
      }

      const debt = {
        id: nanoid(),
        clientId,
        orderIds,
        amount: totalAmount,
        status: 'pendiente',
        note,
        items: Array.from(aggregatedItems.values()).map((item) => ({
          productId: item.productId,
          name: item.name,
          unit: item.unit,
          unitPrice: item.unitPrice,
          quantity: Number(item.quantity) || 0,
          subtotal: Number(item.subtotal) || 0,
        })),
        createdAt: now,
        updatedAt: now,
      }

      debts.push(debt)

      targetOrders.forEach((order) => {
        const items = ensureOrderItemsStructure(order)
        items.forEach((item) => {
          if (normalizeItemStatus(item.status) !== 'pendiente') {
            return
          }
          if (hasSelections) {
            const allowedLineIds = selectionMap?.get(order.id)
            if (!allowedLineIds || !allowedLineIds.has(item.lineId)) {
              return
            }
          }
          item.status = 'deuda'
        })

        recalculateOrderStatus(order)
        order.debtId = debt.id
        order.deliveredAt = order.deliveredAt || now
        order.updatedAt = now
      })

      ensureActivityLog(draft, {
        title: `Deuda creada: ${client.nombreCompleto}`,
        detail: `${orderIds.length} pedidos · $${totalAmount.toLocaleString('es-CL')}`,
        createdAt: now,
      })

      createdDebtId = debt.id
      return draft
    })

    const debt = data.debts.find((item) => item.id === createdDebtId)
    const client = data.clients.find((item) => item.id === clientId)

    res.status(201).json({ debt: formatDebtForResponse(debt, client) })
  } catch (error) {
    next(error)
  }
})

app.get('/api/debts', async (_req, res) => {
  const data = await readData()
  ensureDebtsCollection(data)

  const debts = Array.isArray(data.debts) ? data.debts : []

  const response = debts
    .map((debt) => {
      const client = data.clients.find((item) => item.id === debt.clientId)
      return formatDebtForResponse(debt, client)
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (!a?.createdAt || !b?.createdAt) {
        return 0
      }
      return b.createdAt.localeCompare(a.createdAt)
    })

  res.json({ debts: response, generatedAt: toISO() })
})

app.post('/api/debts/:id/pay', async (req, res, next) => {
  const { id } = req.params
  const { paymentMethod } = req.body || {}

  try {
    let updatedDebt = null
    let cashflowEntry = null
    let clientForResponse = null

    const data = await mutateData((draft) => {
      const debts = ensureDebtsCollection(draft)
      const debt = debts.find((entry) => entry.id === id)
      if (!debt) {
        const error = new Error('Deuda no encontrada')
        error.status = 404
        throw error
      }

      if ((debt.status || 'pendiente') === 'pagada') {
        const error = new Error('La deuda ya está pagada')
        error.status = 400
        throw error
      }

      const now = toISO()
      const amount = Number(debt.amount) || 0
      const method = normalizePaymentMethod(paymentMethod)

      clientForResponse = draft.clients.find((client) => client.id === debt.clientId) || null
      const clientName = clientForResponse?.nombreCompleto || 'Cliente'

      const cashflow = ensureCashflowCollection(draft)
      cashflowEntry = {
        id: nanoid(),
        type: 'ingreso',
        amount,
        category: 'Cobranza',
        description: `Pago deuda ${clientName}`,
        date: now,
        createdAt: now,
        paymentMethod: method,
      }
      cashflow.push(cashflowEntry)

      debt.status = 'pagada'
      debt.paidAt = now
      debt.updatedAt = now
      debt.cashflowEntryId = cashflowEntry.id

      if (!Array.isArray(debt.orderIds)) {
        debt.orderIds = []
      }

      debt.orderIds.forEach((orderId) => {
        const order = draft.orders.find((orderEntry) => orderEntry.id === orderId)
        if (!order) {
          return
        }

        ensureOrderItemsStructure(order).forEach((item) => {
          if (item.status === 'deuda') {
            item.status = 'entregado'
          }
        })

        recalculateOrderStatus(order)
        order.debtId = debt.id
        order.deliveredAt = order.deliveredAt || now
        order.updatedAt = now
      })

      ensureActivityLog(draft, {
        title: `Deuda pagada: ${clientName}`,
        detail: `$${amount.toLocaleString('es-CL')}`,
        createdAt: now,
      })

      updatedDebt = debt
      return draft
    })

    const summary = computeCashflowSummary(Array.isArray(data.cashflow) ? data.cashflow : [])
    const formattedDebt = formatDebtForResponse(updatedDebt, clientForResponse)

    res.json({
      debt: formattedDebt,
      cashflowEntry,
      cashflowSummary: {
        totalIncome: summary.totalIncome,
        totalExpense: summary.totalExpense,
        balance: summary.totalIncome - summary.totalExpense,
        cash: summary.cash,
        bank: summary.bank,
      },
    })
  } catch (error) {
    next(error)
  }
})

app.get('/api/dashboard/pending-clients', async (_req, res) => {
  const data = await readData()
  const pricing = ensurePricingShape(data)
  const pendingOrders = data.orders.filter((order) => orderHasPendingItems(order))

  const clientsMap = new Map()

  pendingOrders.forEach((order) => {
    const client = data.clients.find((c) => c.id === order.clienteId)
    if (!client) {
      return
    }

    const current = clientsMap.get(order.clienteId) || {
      client,
      products: new Map(),
      totalAmount: 0,
      orderIds: [],
      latestOrderAt: null,
      orders: [],
    }

    const pendingOrderItems = []
    ensureOrderItemsStructure(order).forEach((item) => {
      if (normalizeItemStatus(item.status) !== 'pendiente') {
        return
      }
      const product = data.products.find((p) => p.id === item.productId)
      if (!product) {
        return
      }

      const unitPrice = resolvePriceForComuna(
        product.id,
        client?.comuna,
        pricing.preciosPorComuna,
        product.unitPrice || 0,
      )

      const itemSubtotal = item.cantidad * unitPrice

      const productEntry = current.products.get(product.id) || {
        product,
        quantity: 0,
        subtotal: 0,
      }

      productEntry.quantity += item.cantidad
      productEntry.subtotal += itemSubtotal

      current.products.set(product.id, productEntry)
      current.totalAmount += itemSubtotal

      pendingOrderItems.push({
        orderId: order.id,
        lineId: item.lineId,
        product: {
          id: product.id,
          name: product.name,
          unit: product.unit || 'Unidad',
          unitPrice,
        },
        quantity: item.cantidad,
        subtotal: itemSubtotal,
        createdAt: order.createdAt,
      })
    })

    if (pendingOrderItems.length > 0) {
      current.orders.push({
        orderId: order.id,
        createdAt: order.createdAt,
        items: pendingOrderItems,
      })
    }

    current.orderIds.push(order.id)
    if (!current.latestOrderAt || order.createdAt > current.latestOrderAt) {
      current.latestOrderAt = order.createdAt
    }

    clientsMap.set(order.clienteId, current)
  })

  const response = Array.from(clientsMap.values())
    .map((entry) => {
      const products = Array.from(entry.products.values())
        .map((productEntry) => ({
          product: {
            id: productEntry.product.id,
            name: productEntry.product.name,
            unitPrice: resolvePriceForComuna(
              productEntry.product.id,
              entry.client?.comuna,
              pricing.preciosPorComuna,
              productEntry.product.unitPrice,
            ),
            unit: productEntry.product.unit || 'Unidad',
          },
          quantity: productEntry.quantity,
          subtotal: productEntry.subtotal,
        }))
        .sort((a, b) => b.subtotal - a.subtotal)

      const totalUnits = products.reduce((sum, product) => sum + product.quantity, 0)

      return {
        client: entry.client,
        products,
        totalAmount: entry.totalAmount,
        totalUnits,
        orderIds: entry.orderIds,
        orderCount: entry.orderIds.length,
        latestOrderAt: entry.latestOrderAt,
        orders: entry.orders,
      }
    })
    .filter((entry) => entry.client)
    .sort((a, b) => b.totalAmount - a.totalAmount)

  res.json({ clients: response, generatedAt: toISO() })
})

app.get('/api/reports/inventory', async (_req, res) => {
  const data = await readData()
  const rows = data.products.map((product) => ({
    id: product.id,
    name: product.name,
    unitPrice: product.unitPrice,
    category: product.category,
    unit: product.unit || 'Unidad',
  }))

  const totalProductos = rows.length

  res.json({
    generatedAt: toISO(),
    totals: {
      totalProducts: totalProductos,
    },
    rows,
  })
})

app.post('/api/pricing/overrides', async (req, res, next) => {
  const comuna = typeof req.body.comuna === 'string' ? req.body.comuna.trim() : ''
  const productId = typeof req.body.productId === 'string' ? req.body.productId.trim() : ''
  const precio = normalizePriceValue(req.body.precio)

  if (!comuna) {
    res.status(400).json({ message: 'comuna es requerida' })
    return
  }

  if (!productId) {
    res.status(400).json({ message: 'productId es requerido' })
    return
  }

  if (precio == null) {
    res.status(400).json({ message: 'precio debe ser un número válido' })
    return
  }

  try {
    const data = await mutateData((draft) => {
      const pricing = ensurePricingShape(draft)
      const overrides = pricing.preciosPorComuna

      let productName = 'Todos los productos'
      const targetProductId = productId === GENERAL_PRICE_KEY ? GENERAL_PRICE_KEY : productId

      if (targetProductId !== GENERAL_PRICE_KEY) {
        const product = draft.products.find((item) => item.id === targetProductId)
        if (!product) {
          const error = new Error('Producto no válido')
          error.status = 400
          throw error
        }
        productName = product.name
      }

      const comunaOverrides = overrides[comuna] ? { ...overrides[comuna] } : {}
      comunaOverrides[targetProductId] = precio
      overrides[comuna] = comunaOverrides

      ensureActivityLog(draft, {
        title: `Precio por comuna actualizado`,
        detail: `${productName} · ${comuna} → $${precio.toLocaleString('es-CL')}`,
      })

      pricing.preciosPorComuna = normalizePriceOverrides(overrides)

      return draft
    })

    res.json({ overrides: data.pricing.preciosPorComuna })
  } catch (error) {
    next(error)
  }
})

app.use((error, _req, res, _next) => {
  const status = error.status || 500
  res.status(status).json({ message: error.message || 'Error inesperado' })
})

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[api] Inventario escuchando en puerto ${PORT}`)
})
