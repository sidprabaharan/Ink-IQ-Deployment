// Core types for PromoStandards Product Data and Inventory services

export type PSVendorId = string;

export interface PSImage {
  url: string;
  type?: string;
  colorCode?: string;
}

export interface PSSize {
  code: string; // e.g., S, M, L, XL
  name?: string;
}

export interface PSColor {
  code: string; // supplier color code
  name?: string;
  hex?: string;
}

export interface PSVariant {
  sku: string;
  upc?: string;
  size?: PSSize;
  color?: PSColor;
  msrp?: number;
}

export interface PSProduct {
  supplierId: PSVendorId;
  supplierName: string;
  styleId: string; // supplier style number
  sku: string; // base style sku (may be same as styleId)
  name: string;
  description?: string;
  category?: string;
  materials?: string;
  images?: PSImage[];
  variants?: PSVariant[];
  // Optional minimal pricing (if available from Product Data)
  price?: number;
}

export interface PSWarehouseInventory {
  warehouseId: string;
  warehouseName?: string;
  bySize?: Record<string, number>; // sizeCode -> qty
  total?: number;
}

export interface PSInventorySummary {
  sku: string; // variant or style sku
  totalAvailable: number;
  byWarehouse?: PSWarehouseInventory[];
  asOf?: string; // ISO timestamp when inventory snapshot was fetched
}

export interface ProductSearchOptions {
  limit?: number;
  cursor?: string;
  category?: string;
}

export interface InventoryQueryOptions {
  sizeCodes?: string[];
}

// Unified product for UI consumption
export interface UnifiedSupplierOffer {
  name: string; // supplier name
  price?: number; // minimal/landed price if available
  inventory: number; // total available across warehouses/sizes
  inventoryByWarehouseSize?: Record<string, Record<string, number>>; // wh -> size -> qty
}

export interface UnifiedProduct {
  id: number; // local numeric id for UI list keys
  sku: string;
  name: string;
  category: string;
  lowestPrice: number;
  image?: string;
  colors?: string[]; // hex values if available
  suppliers: UnifiedSupplierOffer[];
}



