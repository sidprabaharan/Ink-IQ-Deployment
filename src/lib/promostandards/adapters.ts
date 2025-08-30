import { InventoryQueryOptions, PSInventorySummary, PSProduct, ProductSearchOptions } from './types'
import { supabase } from '@/lib/supabase'

export interface SupplierAdapter {
  id: string; // e.g., 'ss', 'sanmar', 'stormtech'
  name: string;
  // Product Data
  searchProducts(term: string, opts?: ProductSearchOptions): Promise<PSProduct[]>;
  getProductByStyle(styleId: string): Promise<PSProduct | null>;
  // Inventory
  getInventoryBySku(sku: string, opts?: InventoryQueryOptions): Promise<PSInventorySummary | null>;
  // New contract variant for Phase 1 acceptance
  getInventory?(input: { styleIds?: string[]; skus?: string[] }): Promise<{
    sku: string;
    totalAvailable: number;
    byWarehouse?: PSInventorySummary['byWarehouse'];
  }[]>
}

// Minimal placeholder adapters to be filled per supplier when credentials/endpoints are provided
export class PlaceholderAdapter implements SupplierAdapter {
  id: string
  name: string
  constructor(id: string, name: string) {
    this.id = id
    this.name = name
  }
  async searchProducts(term: string): Promise<PSProduct[]> {
    // Return empty until wired to real endpoint
    return []
  }
  async getProductByStyle(_styleId: string): Promise<PSProduct | null> {
    return null
  }
  async getInventoryBySku(_sku: string): Promise<PSInventorySummary | null> {
    return null
  }
}

// S&S adapter delegating to Edge Function suppliers-ss
export class SSAdapter implements SupplierAdapter {
  id = 'ss'
  name = 'S&S Activewear'
  async searchProducts(term: string, opts?: ProductSearchOptions): Promise<PSProduct[]> {
    const limit = opts?.limit || 8
    const useLocal = (globalThis as any)?.location?.origin && (localStorage.getItem('SS_USE_LOCAL_PROXY') || import.meta.env.VITE_SS_LOCAL_PROXY)
    let results: any[] = []
    if (useLocal) {
      const base = (import.meta.env.VITE_SS_LOCAL_PROXY as string) || 'http://localhost:8081'
      const url = new URL('/ss/search', base)
      url.searchParams.set('q', term)
      url.searchParams.set('page', '1')
      const res = await fetch(url.toString())
      if (!res.ok) throw new Error(`status_${res.status}`)
      results = await res.json()
    } else {
      const { data, error } = await supabase.functions.invoke('suppliers-ss', {
        body: { op: 'searchProducts', params: { query: term, page: 1 } },
      })
      if (error) throw error
      results = Array.isArray(data) ? data : []
    }
    // Map ProductSearchResult[] -> PSProduct[]
    const out: PSProduct[] = []
    for (const r of results.slice(0, limit)) {
      const images = [] as { url: string }[]
      if (r?.heroImageUrl) images.push({ url: r.heroImageUrl })
      const variants = Array.isArray(r?.variants) ? r.variants.map((v: any) => ({
        sku: v.sku,
        size: { code: v.size },
        color: { name: v.color, code: v.color },
      })) : []
      out.push({
        supplierId: 'SS',
        supplierName: 'S&S Activewear',
        styleId: String(r?.styleId || ''),
        sku: String(r?.styleId || ''),
        name: r?.name || '',
        description: '',
        category: 'Apparel',
        images,
        variants,
        price: Number(r?.price?.min || 0),
      })
    }
    return out
  }
  async getProductByStyle(_styleId: string): Promise<PSProduct | null> { return null }
  async getInventoryBySku(sku: string): Promise<PSInventorySummary | null> {
    // For S&S, sku here is effectively the styleId in our mapping
    const styleIdNum = Number(String(sku).replace(/[^0-9]/g, ''))
    if (!styleIdNum) return null
    const matrix = await this.getInventory!({ styleIds: [String(styleIdNum)] })
    const first = Array.isArray(matrix) ? matrix[0] : null
    if (!first) return null
    return { sku, totalAvailable: first.totalAvailable, byWarehouse: first.byWarehouse, asOf: first.asOf }
  }
  async getInventory(input: { styleIds?: string[]; skus?: string[] }) {
    const useLocal = (globalThis as any)?.location?.origin && (localStorage.getItem('SS_USE_LOCAL_PROXY') || import.meta.env.VITE_SS_LOCAL_PROXY)
    const styleId = (input.styleIds && input.styleIds[0]) || (input.skus && input.skus[0]) || ''
    if (!styleId) return []
    let matrix: any
    if (useLocal) {
      const base = (import.meta.env.VITE_SS_LOCAL_PROXY as string) || 'http://localhost:8081'
      const url = new URL('/ss/inventory', base)
      url.searchParams.set('styleId', styleId)
      const res = await fetch(url.toString())
      if (!res.ok) throw new Error(`status_${res.status}`)
      matrix = await res.json()
    } else {
      const styleIdNum = Number(String(styleId).replace(/[^0-9]/g, ''))
      const { data, error } = await supabase.functions.invoke('suppliers-ss', {
        body: { op: 'getInventory', params: { styleId: styleIdNum } },
      })
      if (error) throw error
      matrix = data
    }
    // Map InventoryMatrix -> PSInventorySummary[] (single entry by style)
    const warehouses: any[] = Array.isArray(matrix?.warehouses) ? matrix.warehouses : []
    const sizes: any[] = Array.isArray(matrix?.sizes) ? matrix.sizes : []
    const qty: Record<string, number> = matrix?.qty || {}
    const byWarehouse = warehouses.map((wh: string) => {
      const bySize: Record<string, number> = {}
      for (const sz of sizes) {
        const k = `${wh}|${sz}`
        bySize[sz] = Number(qty[k] || 0)
      }
      const total = Object.values(bySize).reduce((a, b) => a + Number(b || 0), 0)
      return { warehouseId: wh, warehouseName: wh, bySize, total }
    })
    const totalAvailable = byWarehouse.reduce((acc, w) => acc + (w.total || 0), 0)
    return [{ sku: String(styleId), totalAvailable, byWarehouse, asOf: matrix?.asOf }]
  }
}


