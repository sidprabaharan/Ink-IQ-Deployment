import { PSInventorySummary, PSProduct, UnifiedProduct, UnifiedSupplierOffer } from './types'

export function toUnifiedProduct(
  p: PSProduct,
  inventory?: PSInventorySummary | null,
  localId?: number
): UnifiedProduct {
  const suppliers: UnifiedSupplierOffer[] = [
    {
      name: p.supplierName,
      price: p.price ?? 0,
      inventory: inventory?.totalAvailable ?? 0,
      inventoryByWarehouseSize: summarizeInventoryByWarehouse(inventory),
    },
  ]

  const colors = Array.from(
    new Set(
      (p.variants || [])
        .map(v => v.color?.hex)
        .filter((x): x is string => Boolean(x))
    )
  )

  const imageUrl = p.images?.[0]?.url

  return {
    id: localId ?? Math.abs(hashCode(`${p.supplierId}:${p.sku}`)),
    sku: p.sku,
    name: p.name,
    category: p.category || 'Apparel',
    lowestPrice: Math.max(0, p.price ?? 0),
    image: imageUrl,
    colors,
    suppliers,
  }
}

function summarizeInventoryByWarehouse(inv?: PSInventorySummary | null): Record<string, Record<string, number>> | undefined {
  if (!inv?.byWarehouse) return undefined
  const out: Record<string, Record<string, number>> = {}
  for (const wh of inv.byWarehouse) {
    out[wh.warehouseName || wh.warehouseId] = { ...(wh.bySize || {}) }
  }
  return out
}

function hashCode(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i)
    hash = (hash << 5) - hash + chr
    hash |= 0
  }
  return hash
}


