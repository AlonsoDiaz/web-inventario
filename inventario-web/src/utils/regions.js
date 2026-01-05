export const REGION_GROUPS = {
  ruta_costera: [
    'Rocas de Santo Domingo',
    'Santo Domingo',
    'Llolleo',
    'San Antonio',
    'Cartagena',
    'San Sebastián',
    'Las Cruces',
    'El Tabo',
    'Isla Negra',
    'El Quisco',
    'Punta de Tralca',
    'Tunquén',
  ],
}

export const REGION_LABELS = {
  ruta_costera: 'Ruta costera',
}

export const formatRegionLabel = (regionKey) => REGION_LABELS[regionKey] || regionKey

export const getRegionOptions = (collator = new Intl.Collator('es-CL')) => {
  return Object.keys(REGION_GROUPS).sort((a, b) => {
    const labelA = REGION_LABELS[a] || a
    const labelB = REGION_LABELS[b] || b
    return collator.compare(labelA, labelB)
  })
}

export const regionIncludesComuna = (regionKey, comuna) => {
  if (!regionKey || !comuna) {
    return false
  }
  const comunas = REGION_GROUPS[regionKey]
  return Array.isArray(comunas) && comunas.includes(comuna)
}
