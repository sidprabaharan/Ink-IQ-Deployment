import { InventoryQueryOptions, PSInventorySummary, PSProduct, ProductSearchOptions } from './types'
import { supabase } from '@/lib/supabase'

export interface SupplierAdapter {
  id: string; // e.g., 'ss', 'sanmar', 'stormtech'
  name: string;
  // Product Data
  searchProducts(term: string, opts?: ProductSearchOptions): Promise<PSProduct[]>;
  browseProducts?(opts?: { limit?: number; page?: number; category?: string | null }): Promise<PSProduct[] | { products: PSProduct[]; count: number; totalProducts: number; page: number; totalPages: number; hasNextPage: boolean; hasPrevPage: boolean }>; // Browse without search term
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
        const raw = await res.json()
      
      // Handle raw S&S API response - could be direct array or wrapped
      const items = Array.isArray(raw) ? raw
        : (Array.isArray(raw?.items) ? raw.items
        : (Array.isArray(raw?.products) ? raw.products
        : (Array.isArray(raw?.value) ? raw.value : [])))
      
      // Map raw S&S items directly to PSProduct format
      const out: PSProduct[] = []
      for (const item of items.slice(0, limit)) {
        const styleId = String(item?.styleID || item?.styleId || item?.style || '')
        const styleName = item?.styleName || item?.name || ''
        const brandName = item?.brandName || item?.brand || ''
        
        // Extract pricing - S&S typically has piecePrice, dozenPrice, etc.
        const price = Number(item?.piecePrice || item?.price || item?.customerPrice || item?.salePrice || 0)
        
        // Build image URL from S&S image paths
        const images = []
        if (item?.colorFrontImage) {
          images.push({ url: `https://api.ssactivewear.com/V2/${item.colorFrontImage}` })
        }
        
        // Map variants from S&S structure
        const variants = []
        if (item?.sizeName && item?.colorName) {
          variants.push({
            sku: item?.sku || styleId,
            size: { code: String(item.sizeName).toUpperCase() },
            color: { name: item.colorName, code: item?.colorCode || item.colorName },
          })
        }
        
        out.push({
          supplierId: 'SS',
          supplierName: 'S&S Activewear',
          styleId,
          sku: styleId,
          name: `${brandName} ${styleName}`.trim(),
          description: item?.description || '',
          category: 'Apparel',
          images,
          variants,
          price, // Live pricing from S&S API
        })
      }
      return out
    } else {
      const { data, error } = await supabase.functions.invoke('suppliers-ss', {
        body: { op: 'searchProducts', params: { query: term, page: 1 } },
      })
    if (error) throw error
      results = Array.isArray(data) ? data : []
      
      // Map Supabase function results
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
  }

  async browseProducts(opts?: { limit?: number; page?: number; category?: string | null }): Promise<PSProduct[] | { products: PSProduct[]; count: number; totalProducts: number; page: number; totalPages: number; hasNextPage: boolean; hasPrevPage: boolean }> {
    const limit = opts?.limit || 50;
    const page = opts?.page || 1;
    const category = opts?.category || null;
    
    console.log('🔍 SSAdapter.browseProducts called with:', { limit, page, category });
    
    try {
      // Get the current session to ensure we have auth
      const { data: { session } } = await supabase.auth.getSession();
      console.log('🔐 Session available:', !!session);
      
      if (!session) {
        throw new Error('No active session - please sign in');
      }
      
      // Call the suppliers-ps Edge Function with pagination support
      const { data, error } = await supabase.functions.invoke('suppliers-ps', {
        body: { op: 'browseProducts', params: { limit, page, category } },
      });
      
      if (error) {
        console.error('❌ Supabase function error:', error);
        throw error;
      }
      
      console.log('✅ suppliers-ps browseProducts response:', data);
      
      // Map the response to UnifiedProduct format (what ProductRow expects)
      const products = (data?.products || []).map((p: any, index: number) => ({
        id: p.id || index + 1, // Use product ID from response
        sku: p.sku || p.styleId || '',
        name: p.name || '',
        category: p.category || 'Apparel',
        lowestPrice: p.lowestPrice || p.price || 0,
        highestPrice: p.highestPrice || p.price || 0,
        image: p.image || p.images?.[0]?.url || undefined,
        colors: p.colors || [],
        suppliers: p.suppliers || [{
          name: 'S&S Activewear',
          price: p.price || p.lowestPrice || 0,
          inventory: 100,
        }],
        // Keep PSProduct fields for compatibility
        supplierId: p.supplierId || 'SS',
        supplierName: p.supplierName || 'S&S Activewear',
        styleId: p.styleId || p.sku || '',
        description: p.description || '',
        images: p.images || [],
        variants: p.variants || [],
        price: p.price || p.lowestPrice || 0,
        brand: p.brand || 'S&S Activewear',
      }));
      
      console.log('✅ Mapped products:', products.length, products);
      
      // Return pagination info if available, otherwise return just products (legacy format)
      if (data?.totalProducts !== undefined) {
        return {
          products: products,
          count: products.length,
          totalProducts: data.totalProducts,
          page: data.page || page,
          totalPages: data.totalPages || 1,
          hasNextPage: data.hasNextPage || false,
          hasPrevPage: data.hasPrevPage || false
        };
      } else {
        return products; // Legacy format for backward compatibility
      }
      
    } catch (error) {
      console.error('❌ SSAdapter.browseProducts error:', error);
      throw error;
    }
  }

  async getProductByStyle(_styleId: string): Promise<PSProduct | null> { return null }
  async getInventoryBySku(sku: string): Promise<PSInventorySummary | null> {
    console.log('🔍 SSAdapter.getInventoryBySku called with:', { sku });
    
    try {
      // Get the current session to ensure we have auth
      const { data: { session } } = await supabase.auth.getSession();
      console.log('🔐 Session available for inventory:', !!session);
      if (!session) {
        throw new Error('No active session - please sign in');
      }
      
      // For S&S, sku here is effectively the styleId in our mapping
      const styleIdNum = Number(String(sku).replace(/[^0-9]/g, ''))
      const productId = styleIdNum ? String(styleIdNum) : sku;
      
      console.log('📦 Calling inventory for productId:', productId);
      
      // Call the suppliers-ps Edge Function for inventory
      const { data, error } = await supabase.functions.invoke('suppliers-ps', {
        body: { op: 'getInventory', params: { productId } },
      });
      
      if (error) {
        console.error('❌ Supabase inventory function error:', error);
        throw error;
      }
      
      console.log('✅ suppliers-ps getInventory response:', data);
      
      // Map the response to PSInventorySummary format
      const inventoryMatrix = data?.inventoryMatrix || {};
      const warehouses = data?.warehouses || [];
      const sizes = data?.sizes || [];
      
      const byWarehouse = warehouses.map((warehouseId: string) => {
        const bySize: Record<string, number> = {};
        let warehouseTotal = 0;
        
        sizes.forEach((size: string) => {
          const key = `${warehouseId}|${size}`;
          const qty = inventoryMatrix[key] || 0;
          bySize[size] = qty;
          warehouseTotal += qty;
        });
        
        return {
          warehouseId,
          warehouseName: this.mapWarehouseName(warehouseId),
          bySize,
          total: warehouseTotal
        };
      });
      
      return {
        sku,
        totalAvailable: data?.totalAvailable || 0,
        byWarehouse,
        asOf: data?.asOf || new Date().toISOString()
      };
      
    } catch (error) {
      console.error('❌ SSAdapter.getInventoryBySku error:', error);
      
      // Fallback to legacy method if new inventory service fails
      const styleIdNum = Number(String(sku).replace(/[^0-9]/g, ''))
      if (!styleIdNum) return null
      const matrix = await this.getInventory!({ styleIds: [String(styleIdNum)] })
      const first = Array.isArray(matrix) ? matrix[0] : null
    if (!first) return null
      return { sku, totalAvailable: first.totalAvailable, byWarehouse: first.byWarehouse, asOf: first.asOf }
    }
  }
  
  private mapWarehouseName(warehouseId: string): string {
    const warehouseMap: Record<string, string> = {
      'IL': 'Illinois',
      'KS': 'Kansas', 
      'NV': 'Nevada',
      'TX': 'Texas',
      'GA': 'Georgia',
      'NJ': 'New Jersey',
      'MAIN': 'Main Warehouse',
      'ERROR': 'Error'
    };
    return warehouseMap[warehouseId] || warehouseId;
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


