import { useEffect, useMemo, useState } from 'react'

import {
  currencyDigitsToNumber,
  formatCurrencyDisplay,
  sanitizeCurrencyInput,
  toCurrencyDigits,
} from '../../utils/currencyInput'

const UNIT_OPTIONS = [
  'Unidad',
  'Docena',
  'Caja',
  'Bandeja',
  'Kilogramo',
  'Gramo',
  'Litro',
  'Mililitro',
  'Bolsa',
  'Pack',
]

const toFormState = (product) => {
  if (!product) {
    return {
      name: '',
      category: '',
      notes: '',
      unit: 'Unidad',
      unitPrice: '',
    }
  }

  return {
    name: product.name ?? '',
    category: product.category ?? '',
    notes: product.notes ?? '',
    unit: product.unit ?? 'Unidad',
    unitPrice: product.unitPrice != null ? toCurrencyDigits(product.unitPrice) : '',
  }
}

const ProductEditForm = ({
  products = [],
  onSubmit,
  onDeleteProduct,
  submitting,
  onRequestConfirm,
}) => {
  const [selectedId, setSelectedId] = useState('')
  const [form, setForm] = useState(() => toFormState(null))

  useEffect(() => {
    if (selectedId && !products.some((product) => product.id === selectedId)) {
      setSelectedId('')
    }
  }, [products, selectedId])

  useEffect(() => {
    if (!selectedId && products.length > 0) {
      setSelectedId(products[0].id)
    }
  }, [products, selectedId])

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === selectedId) || null,
    [products, selectedId],
  )

  useEffect(() => {
    setForm(toFormState(selectedProduct))
  }, [selectedProduct?.id])

  const updateField = (field) => (event) => {
    let { value } = event.target
    if (field === 'unitPrice') {
      value = sanitizeCurrencyInput(value)
    }
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    if (!selectedProduct) {
      return
    }
    const updates = {
      name: form.name,
      category: form.category,
      notes: form.notes,
      unit: form.unit,
    }

    if (form.unitPrice !== '') {
      updates.unitPrice = currencyDigitsToNumber(form.unitPrice)
    }

    onSubmit?.({
      productId: selectedProduct.id,
      updates,
    })
  }

  const handleDeleteProduct = async () => {
    if (!selectedProduct || typeof onDeleteProduct !== 'function') {
      return
    }
    const message = `¿Eliminar el producto ${selectedProduct.name}? Esta acción no se puede deshacer.`
    if (typeof onRequestConfirm !== 'function') {
      onDeleteProduct(selectedProduct.id)
      return
    }

    const confirmed = await onRequestConfirm({
      title: 'Eliminar producto',
      message,
      detail: 'Se quitará del inventario y de los pedidos pendientes.',
      highlight: selectedProduct.category || 'Inventario',
      confirmLabel: 'Eliminar producto',
      cancelLabel: 'Conservar',
      tone: 'danger',
    })

    if (confirmed) {
      onDeleteProduct(selectedProduct.id)
    }
  }

  const hasProducts = products.length > 0

  return (
    <form onSubmit={handleSubmit} className="form-grid">
      <label>
        <span>Seleccionar producto</span>
        <select value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
          <option value="">Selecciona un producto</option>
          {products.map((product) => (
            <option key={product.id} value={product.id}>
              {product.name} · $
              {Number(product.unitPrice || 0).toLocaleString('es-CL')}
            </option>
          ))}
        </select>
      </label>

      {!hasProducts && (
        <p className="form-context">Aún no hay productos para editar.</p>
      )}

      {selectedProduct ? (
        <>
          <p className="form-context">
            Editando <strong>{selectedProduct.name}</strong>
          </p>
          <label>
            <span>Nombre</span>
            <input type="text" value={form.name} onChange={updateField('name')} />
          </label>
          <label>
            <span>Categoría</span>
            <input type="text" value={form.category} onChange={updateField('category')} />
          </label>
          <label>
            <span>Notas</span>
            <textarea rows="4" value={form.notes} onChange={updateField('notes')} />
          </label>
          <label>
            <span>Precio unidad ($)</span>
            <input
              type="text"
              inputMode="numeric"
              value={formatCurrencyDisplay(form.unitPrice)}
              onChange={updateField('unitPrice')}
            />
          </label>
          <label>
            <span>Unidad de medida</span>
            <select value={form.unit} onChange={updateField('unit')}>
              {(() => {
                const options = new Set(UNIT_OPTIONS)
                if (form.unit && !options.has(form.unit)) {
                  options.add(form.unit)
                }
                return Array.from(options)
              })().map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        </>
      ) : (
        hasProducts && (
          <p className="form-context">Selecciona un producto para habilitar la edición.</p>
        )
      )}

      <div className="form-actions">
        <button
          type="submit"
          className="primary-button"
          disabled={submitting || !selectedProduct}
        >
          {submitting ? 'Guardando...' : 'Guardar cambios'}
        </button>
        {selectedProduct && typeof onDeleteProduct === 'function' && (
          <button
            type="button"
            className="danger-button"
            onClick={handleDeleteProduct}
            disabled={submitting}
          >
            {submitting ? 'Procesando...' : 'Eliminar producto'}
          </button>
        )}
      </div>
    </form>
  )
}

export default ProductEditForm
