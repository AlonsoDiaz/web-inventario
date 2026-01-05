const normalizeCell = (value) => {
  if (value === null || value === undefined) {
    return ''
  }
  if (typeof value === 'boolean') {
    return value ? 'Sí' : 'No'
  }
  if (value instanceof Date) {
    return value.toISOString()
  }
  // Evita saltos de línea para que Excel no corte palabras ni celdas.
  return String(value).replace(/\r?\n|\r/g, ' ')
}

const escapeCell = (value, delimiter) => {
  const stringValue = normalizeCell(value)
  const needsQuote = stringValue.includes('"') || stringValue.includes('\n') || stringValue.includes(delimiter)
  const escaped = stringValue.replace(/"/g, '""')
  return needsQuote ? `"${escaped}"` : escaped
}

const escapeHtml = (value) => {
  const stringValue = normalizeCell(value)
  return stringValue
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const buildRows = (columns, rows, delimiter) => {
  const header = columns.map((col) => escapeCell(col.label || col.key, delimiter)).join(delimiter)
  const body = rows
    .map((row) => columns.map((col) => escapeCell(row[col.key], delimiter)).join(delimiter))
    .join('\n')
  return `${header}\n${body}`
}

const buildHtmlTable = (columns, rows) => {
  const header = columns
    .map((col) => `<th style="text-align:left;padding:6px 8px;">${escapeHtml(col.label || col.key)}</th>`)
    .join('')

  const body = rows
    .map((row) => {
      const cells = columns
        .map((col) => `<td style="padding:6px 8px;">${escapeHtml(row[col.key])}</td>`)
        .join('')
      return `<tr>${cells}</tr>`
    })
    .join('')

  return `<table border="1" cellspacing="0" cellpadding="0">` +
    `<thead><tr>${header}</tr></thead>` +
    `<tbody>${body}</tbody>` +
  `</table>`
}

const triggerDownload = (filename, content, mimeType) => {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.setTimeout(() => URL.revokeObjectURL(url), 1500)
}

export const exportToCsv = (filename, columns, rows) => {
  if (!Array.isArray(columns) || !Array.isArray(rows)) {
    return
  }
  const content = `\ufeff${buildRows(columns, rows, ',')}`
  triggerDownload(filename || 'export.csv', content, 'text/csv;charset=utf-8;')
}

export const exportToExcel = (filename, columns, rows) => {
  if (!Array.isArray(columns) || !Array.isArray(rows)) {
    return
  }
  const table = buildHtmlTable(columns, rows)
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body>${table}</body></html>`
  const content = `\ufeff${html}`
  triggerDownload(filename || 'export.xls', content, 'application/vnd.ms-excel;charset=utf-8')
}
