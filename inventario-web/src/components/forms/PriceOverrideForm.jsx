import { useEffect, useMemo, useState } from 'react'

import {
  currencyDigitsToNumber,
  formatCurrencyDisplay,
  sanitizeCurrencyInput,
  toCurrencyDigits,
} from '../../utils/currencyInput'

const GENERAL_PRICE_KEY = '__general__'

const PriceOverrideForm = ({
  comunas = [],
  products = [],
  overrides = {},
  onSubmit,
  submitting,
}) => {
  const [productId, setProductId] = useState('')
  const [comuna, setComuna] = useState('')
  const [precio, setPrecio] = useState('')

  const productOptions = useMemo(
    () => [
      { id: GENERAL_PRICE_KEY, name: 'Todos los productos (precio general)' },
      ...products.map((product) => ({ id: product.id, name: product.name })),
    ],
    [products],
  )

  const productNameMap = useMemo(() => {
    const map = new Map()
    productOptions.forEach((option) => {
      map.set(option.id, option.name)
    })
    return map
  }, [productOptions])

  const flattenedOverrides = useMemo(() => {
    const entries = []
    if (!overrides || typeof overrides !== 'object') {
      return entries
    }

    Object.entries(overrides).forEach(([comunaKey, value]) => {
      if (value == null) {
        return
      }

      if (typeof value === 'number' || typeof value === 'string') {
        const numeric = Number(value)
        if (Number.isFinite(numeric)) {
          entries.push({ comuna: comunaKey, productId: GENERAL_PRICE_KEY, price: numeric })
        }
        return
      }

      if (typeof value === 'object' && !Array.isArray(value)) {
        Object.entries(value).forEach(([productKey, rawPrice]) => {
          const numeric = Number(rawPrice)
          if (Number.isFinite(numeric)) {
            entries.push({ comuna: comunaKey, productId: productKey, price: numeric })
          }
        })
      }
    })

    entries.sort((a, b) => {
      const comunaCompare = a.comuna.localeCompare(b.comuna, 'es-CL')
      if (comunaCompare !== 0) {
        return comunaCompare
      }
      const nameA = productNameMap.get(a.productId) || a.productId
      const nameB = productNameMap.get(b.productId) || b.productId
      return nameA.localeCompare(nameB, 'es-CL')
    })

    return entries
  }, [overrides, productNameMap])

  useEffect(() => {
    if (!comuna || !productId) {
      return
    }

    const comunaOverrides = overrides?.[comuna]

    if (typeof comunaOverrides === 'number' || typeof comunaOverrides === 'string') {
      if (productId === GENERAL_PRICE_KEY) {
        const numeric = Number(comunaOverrides)
        setPrecio(Number.isFinite(numeric) ? toCurrencyDigits(numeric) : '')
      } else {
        setPrecio('')
      }
      return
    }

    if (typeof comunaOverrides === 'object' && comunaOverrides !== null && !Array.isArray(comunaOverrides)) {
      const raw = comunaOverrides[productId]
      const numeric = Number(raw)
      setPrecio(Number.isFinite(numeric) ? toCurrencyDigits(numeric) : '')
      return
    }

    setPrecio('')
  }, [comuna, productId, overrides])

  const handleSubmit = (event) => {
    event.preventDefault()
    if (!productId || !comuna || precio === '') {
      return
    }
    onSubmit?.(
      {
        productId,
        comuna,
        precio: currencyDigitsToNumber(precio),
      },
      () => {
        setProductId('')
        setComuna('')
        setPrecio('')
      },
    )
  }

  return (
    <form onSubmit={handleSubmit} className="form-grid">
      <label>
        <span>Producto</span>
        <select
          required
          value={productId}
          onChange={(event) => setProductId(event.target.value)}
        >
          <option value="">Selecciona</option>
          {productOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Comuna</span>
        <select required value={comuna} onChange={(event) => setComuna(event.target.value)}>
          <option value="">Selecciona</option>
          {comunas.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Precio especial ($)</span>
        <input
          type="text"
          inputMode="numeric"
          required
          value={formatCurrencyDisplay(precio)}
          onChange={(event) => setPrecio(sanitizeCurrencyInput(event.target.value))}
        />
      </label>
      <div className="price-override-list">
        <p>Precios configurados:</p>
        <ul>
          {flattenedOverrides.map((entry) => {
            const label = productNameMap.get(entry.productId) || entry.productId
            const isSelected = entry.comuna === comuna && entry.productId === productId
            return (
              <li key={`${entry.comuna}-${entry.productId}`}>
                {entry.comuna} · {label}: ${entry.price.toLocaleString('es-CL')}
                {isSelected ? ' (seleccionado)' : ''}
              </li>
            )
          })}
          {flattenedOverrides.length === 0 && <li>No hay precios personalizados</li>}
        </ul>
      </div>
      <div className="form-actions">
        <button type="submit" className="primary-button" disabled={submitting}>
          {submitting ? 'Guardando...' : 'Guardar precio'}
        </button>
      </div>
    </form>
  )
}

export default PriceOverrideForm
