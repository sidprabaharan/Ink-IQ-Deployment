import { getSuppliers } from './registry'
import { toUnifiedProduct } from './mappers'
import { PSProduct, UnifiedProduct } from './types'

export async function searchCatalog(term: string, opts?: { limit?: number }): Promise<UnifiedProduct[]> {
  const adapters = getSuppliers()
  const limit = opts?.limit ?? 10
  const results: UnifiedProduct[] = []

  // Run supplier searches in parallel; then map + fetch inventory per product
  const productLists = await Promise.all(
    adapters.map(a => a.searchProducts(term, { limit }).catch(() => [] as PSProduct[]))
  )

  let localId = 1
  for (let i = 0; i < adapters.length; i++) {
    const adapter = adapters[i]
    const products = productLists[i] || []
    for (const p of products) {
      // Prefer style-level inventory when adapter supports it (e.g., S&S)
      const invSku = (p.variants && p.variants[0]?.sku) || p.sku
      let inventory = null as any
      if (typeof (adapter as any).getInventory === 'function' && p.styleId) {
        try {
          const list = await (adapter as any).getInventory({ styleIds: [p.styleId] })
          const first = Array.isArray(list) ? list[0] : null
          if (first) inventory = { sku: invSku, totalAvailable: first.totalAvailable, byWarehouse: first.byWarehouse, asOf: first.asOf }
        } catch {}
      }
      if (!inventory) {
        inventory = await adapter.getInventoryBySku(invSku).catch(() => null)
      }
      results.push(toUnifiedProduct(p, inventory, localId++))
    }
  }

  return results
}



