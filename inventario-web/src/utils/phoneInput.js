const DIGIT_PATTERN = /\D+/g
const COUNTRY_CODE = '56'
const MAX_LOCAL_DIGITS = 9

const stripNonDigits = (value) => {
  if (value == null) {
    return ''
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(Math.abs(value)) : ''
  }
  if (typeof value === 'string') {
    return value.replace(DIGIT_PATTERN, '')
  }
  return ''
}

export const parseChileanPhoneValue = (value) => {
  let digits = stripNonDigits(value)
  let hasCountryCode = false

  if (digits.startsWith(COUNTRY_CODE)) {
    hasCountryCode = true
    digits = digits.slice(COUNTRY_CODE.length)
  }

  return {
    digits: digits.slice(0, MAX_LOCAL_DIGITS),
    hasCountryCode,
  }
}

export const sanitizeChileanPhoneDigits = (value) => parseChileanPhoneValue(value).digits

export const formatChileanPhone = (value, { includeCountryCode } = {}) => {
  const parsed = parseChileanPhoneValue(value)
  const digits = parsed.digits
  if (!digits) {
    return ''
  }

  const localParts = [digits.slice(0, 1), digits.slice(1, 5), digits.slice(5, 9)].filter(Boolean)
  const localNumber = localParts.join(' ')

  const shouldIncludeCountryCode =
    typeof includeCountryCode === 'boolean' ? includeCountryCode : parsed.hasCountryCode

  return shouldIncludeCountryCode ? `+${COUNTRY_CODE} ${localNumber}` : localNumber
}

export const parseDigitsFromChileanPhone = (value) => parseChileanPhoneValue(value).digits

export const isCompleteChileanPhone = (value) => parseChileanPhoneValue(value).digits.length === MAX_LOCAL_DIGITS
