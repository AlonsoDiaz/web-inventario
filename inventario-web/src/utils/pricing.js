export const GENERAL_PRICE_KEY = '__general__'

const normalizePriceValue = (value) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null
  }
  return parsed
}

export const resolvePriceForComuna = (productId, comuna, overrides, fallback) => {
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
