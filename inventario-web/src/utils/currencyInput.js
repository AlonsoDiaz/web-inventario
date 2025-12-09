const DIGIT_PATTERN = /\D+/g

const cleanDigits = (value) => {
  if (value == null) {
    return ''
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      return ''
    }
    return Math.round(value).toString()
  }
  if (typeof value === 'string') {
    return value.replace(DIGIT_PATTERN, '')
  }
  return ''
}

export const formatCurrencyDisplay = (rawValue) => {
  const digits = cleanDigits(rawValue)
  if (!digits.length) {
    return ''
  }
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

export const sanitizeCurrencyInput = (value) => cleanDigits(value)

export const toCurrencyDigits = (value) => cleanDigits(value)

export const currencyDigitsToNumber = (value) => {
  const digits = cleanDigits(value)
  if (!digits.length) {
    return 0
  }
  const parsed = Number(digits)
  return Number.isFinite(parsed) ? parsed : 0
}
