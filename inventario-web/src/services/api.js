const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  })

  if (!response.ok) {
    const message = await response.json().catch(() => ({ message: response.statusText }))
    const error = new Error(message.message || 'Error en la petición')
    error.status = response.status
    throw error
  }

  if (response.status === 204) {
    return null
  }

  return response.json()
}

export const api = {
  async getDashboard() {
    return request('/api/dashboard')
  },
  async getClients() {
    return request('/api/clients')
  },
  async createProduct(payload) {
    return request('/api/products', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },
  async addClient(payload) {
    return request('/api/clients', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },
  async updateClient(clientId, payload) {
    return request(`/api/clients/${clientId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
  },
  async createOrder(payload) {
    return request('/api/orders', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },
  async updateProduct(productId, payload) {
    return request(`/api/products/${productId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
  },
  async updateProductPrice(productId, payload) {
    return request(`/api/products/${productId}/price`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },
  async setPriceOverride(payload) {
    return request('/api/pricing/overrides', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },
  async getInventoryReport() {
    return request('/api/reports/inventory')
  },
  async getOrders() {
    return request('/api/orders')
  },
  async updateOrder(orderId, payload) {
    return request(`/api/orders/${orderId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
  },
  async cancelOrders(orderIds) {
    return request('/api/orders/cancel', {
      method: 'POST',
      body: JSON.stringify({ orderIds }),
    })
  },
  async markOrdersDelivered(orderIds) {
    return request('/api/orders/mark-delivered', {
      method: 'POST',
      body: JSON.stringify({ orderIds }),
    })
  },
  async getPendingClients() {
    return request('/api/dashboard/pending-clients')
  },
  async getCashflow() {
    return request('/api/cashflow')
  },
  async createCashflowEntry(payload) {
    return request('/api/cashflow', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },
}
