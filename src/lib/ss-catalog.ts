import { supabase } from './supabase';

// Types for local S&S catalog data
export interface SSProduct {
  id: string;
  supplier_id: string;
  style_id: string;
  sku: string;
  name: string;
  brand?: string;
  description?: string;
  category?: string;
  min_price?: number;
  max_price?: number;
  currency: string;
  colors?: Array<{
    name: string;
    code?: string;
    hex?: string;
    swatchUrl?: string;
  }>;
  sizes?: string[];
  primary_image_url?: string;
  images?: string[];
  is_closeout: boolean;
  is_on_demand: boolean;
  is_caution: boolean;
  is_hazmat: boolean;
  is_rush_service: boolean;
  effective_date?: string;
  end_date?: string;
  last_change_date?: string;
  sync_status: string;
  last_synced: string;
  created_at: string;
  updated_at: string;
}

export interface SSProductVariant {
  id: string;
  product_id: string;
  part_id: string;
  sku: string;
  color_name: string;
  color_code?: string;
  color_hex?: string;
  size_label: string;
  price?: number;
  gtin?: string;
  weight_oz?: number;
  images?: {
    front?: string;
    back?: string;
    side?: string;
    swatch?: string;
  };
  is_main_part: boolean;
  manufactured_item: boolean;
  last_synced: string;
}

export interface SSInventory {
  id: string;
  variant_id: string;
  warehouse_id: string;
  warehouse_name: string;
  warehouse_address?: {
    city: string;
    state: string;
    postalCode: string;
  };
  quantity_available: number;
  as_of: string;
  last_synced: string;
}

export interface SSCatalogSearchOptions {
  query?: string;
  category?: string;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  colors?: string[];
  sizes?: string[];
  inStock?: boolean;
  limit?: number;
  offset?: number;
}

export interface SSCatalogSearchResult {
  products: SSProduct[];
  totalCount: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

// Search S&S products in local database
export async function searchSSCatalog(options: SSCatalogSearchOptions = {}): Promise<SSCatalogSearchResult> {
  const {
    query = '',
    category,
    brand,
    minPrice,
    maxPrice,
    colors,
    sizes,
    inStock,
    limit = 50,
    offset = 0,
  } = options;

  console.log('🔍 Searching local S&S catalog with options:', options);

  try {
    // Start building the query
    let queryBuilder = supabase
      .from('ss_products')
      .select(`
        *,
        ss_product_variants (
          id,
          part_id,
          sku,
          color_name,
          color_code,
          color_hex,
          size_label,
          price,
          images,
          is_main_part,
          ss_inventory_levels (
            quantity_available,
            warehouse_id,
            ss_warehouse_locations (
              id,
              name,
              city,
              state
            )
          )
        )
      `, { count: 'exact' })
      .eq('supplier_id', 'SS')
      .eq('sync_status', 'active');

    // Apply text search filter
    if (query.trim()) {
      queryBuilder = queryBuilder.or(`
        name.ilike.%${query}%,
        brand.ilike.%${query}%,
        style_id.ilike.%${query}%,
        sku.ilike.%${query}%,
        description.ilike.%${query}%
      `);
    }

    // Apply category filter
    if (category) {
      queryBuilder = queryBuilder.eq('category', category);
    }

    // Apply brand filter
    if (brand) {
      queryBuilder = queryBuilder.eq('brand', brand);
    }

    // Apply price range filters
    if (minPrice !== undefined) {
      queryBuilder = queryBuilder.gte('min_price', minPrice);
    }
    if (maxPrice !== undefined) {
      queryBuilder = queryBuilder.lte('max_price', maxPrice);
    }

    // Apply colors filter (if colors array contains specific values)
    if (colors && colors.length > 0) {
      // This requires a more complex JSON query for the colors array
      const colorFilters = colors.map(color => `colors @> '[{"name": "${color}"}]'`);
      if (colorFilters.length === 1) {
        queryBuilder = queryBuilder.filter('colors', 'cs', `[{"name": "${colors[0]}"}]`);
      }
      // For multiple colors, we'd need a more complex approach
    }

    // Apply sizes filter (similar to colors)
    if (sizes && sizes.length > 0) {
      const sizeFilter = sizes.map(size => `"${size}"`).join(',');
      queryBuilder = queryBuilder.filter('sizes', 'cs', `[${sizeFilter}]`);
    }

    // Apply stock filter (requires joining with inventory)
    if (inStock) {
      // This would require a more complex query joining with inventory data
      console.log('📦 Stock filtering not yet implemented in local catalog search');
    }

    // Apply pagination
    queryBuilder = queryBuilder
      .range(offset, offset + limit - 1)
      .order('last_synced', { ascending: false });

    const { data: products, error, count } = await queryBuilder;

    if (error) {
      console.error('❌ Error searching S&S catalog:', error);
      throw new Error(`Failed to search catalog: ${error.message}`);
    }

    const totalCount = count || 0;
    const currentPage = Math.floor(offset / limit) + 1;
    const totalPages = Math.ceil(totalCount / limit);

    console.log(`✅ Found ${products?.length || 0} products (${totalCount} total) from local S&S catalog`);

    return {
      products: products || [],
      totalCount,
      page: currentPage,
      limit,
      totalPages,
      hasNextPage: currentPage < totalPages,
      hasPrevPage: currentPage > 1,
    };

  } catch (error) {
    console.error('❌ Failed to search S&S catalog:', error);
    throw error;
  }
}

// Get a specific S&S product by style ID
export async function getSSProductByStyleId(styleId: string): Promise<SSProduct | null> {
  console.log(`🔍 Getting S&S product by style ID: ${styleId}`);

  try {
    const { data: product, error } = await supabase
      .from('ss_products')
      .select(`
        *,
        ss_product_variants (
          id,
          part_id,
          sku,
          color_name,
          color_code,
          color_hex,
          size_label,
          price,
          gtin,
          weight_oz,
          images,
          is_main_part,
          manufactured_item
        )
      `)
      .eq('supplier_id', 'SS')
      .eq('style_id', styleId)
      .eq('sync_status', 'active')
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
      console.error('❌ Error getting S&S product:', error);
      throw new Error(`Failed to get product: ${error.message}`);
    }

    if (!product) {
      console.log(`⚠️ Product ${styleId} not found in local catalog`);
      return null;
    }

    console.log(`✅ Found product ${styleId} in local catalog:`, product.name);
    return product;

  } catch (error) {
    console.error(`❌ Failed to get S&S product ${styleId}:`, error);
    throw error;
  }
}

// Get inventory for a specific S&S product from local database
export async function getSSProductInventory(styleId: string): Promise<Array<{
  warehouse_id: string;
  warehouse_name: string;
  total_quantity: number;
  last_updated: string;
}>> {
  console.log(`📦 Getting inventory for S&S product: ${styleId}`);

  try {
    const { data: inventory, error } = await supabase
      .rpc('get_ss_product_inventory', { product_style_id: styleId });

    if (error) {
      console.error('❌ Error getting S&S inventory:', error);
      throw new Error(`Failed to get inventory: ${error.message}`);
    }

    console.log(`✅ Found inventory for ${styleId}:`, inventory?.length || 0, 'warehouses');
    return inventory || [];

  } catch (error) {
    console.error(`❌ Failed to get inventory for ${styleId}:`, error);
    throw error;
  }
}

// Get real-time inventory directly from S&S API
export async function getSSProductInventoryRealTime(styleId: string): Promise<{
  success: boolean;
  productId: string;
  partInventories: Array<{
    partId: string;
    partColor: string;
    labelSize: string;
    totalQuantity: number;
    locations: Array<{
      inventoryLocationId: string;
      inventoryLocationName: string;
      quantity: number;
      city?: string;
      postalCode?: string;
    }>;
  }>;
  totalQuantity: number;
  warehouses: string[];
  asOf: string;
}> {
  console.log(`🔄 Getting real-time inventory for S&S product: ${styleId}`);

  try {
    const { data, error } = await supabase.functions.invoke('ss-inventory-sync', {
      body: { op: 'getInventory', params: { productId: styleId } },
    });

    if (error) {
      console.error('❌ Error getting real-time inventory:', error);
      throw new Error(`Failed to get real-time inventory: ${error.message}`);
    }

    console.log(`✅ Real-time inventory for ${styleId}:`, data.totalQuantity, 'total units');
    return data;

  } catch (error) {
    console.error(`❌ Failed to get real-time inventory for ${styleId}:`, error);
    throw error;
  }
}

// Get detailed inventory breakdown with warehouse-level data
export async function getSSInventoryDetails(styleId: string): Promise<{
  localInventory: Array<{
    warehouse_id: string;
    warehouse_name: string;
    total_quantity: number;
    last_updated: string;
  }>;
  variants: Array<{
    id: string;
    part_id: string;
    sku: string;
    color_name: string;
    size_label: string;
    warehouses: Array<{
      warehouse_id: string;
      warehouse_name: string;
      quantity_available: number;
      as_of: string;
    }>;
  }>;
  summary: {
    totalQuantity: number;
    uniqueWarehouses: number;
    lastUpdate: string | null;
  };
}> {
  console.log(`📊 Getting detailed inventory for S&S product: ${styleId}`);

  try {
    // Get product ID first
    const { data: product, error: productError } = await supabase
      .from('ss_products')
      .select('id')
      .eq('supplier_id', 'SS')
      .eq('style_id', styleId)
      .single();

    if (productError || !product) {
      throw new Error(`Product ${styleId} not found in local database`);
    }

    // Get variants with inventory
    const { data: variants, error: variantsError } = await supabase
      .from('ss_product_variants')
      .select(`
        id,
        part_id,
        sku,
        color_name,
        size_label,
        ss_inventory (
          warehouse_id,
          warehouse_name,
          quantity_available,
          as_of
        )
      `)
      .eq('product_id', product.id);

    if (variantsError) {
      throw new Error(`Failed to get variants: ${variantsError.message}`);
    }

    // Get warehouse totals using the existing RPC
    const localInventory = await getSSProductInventory(styleId);

    // Calculate summary
    const totalQuantity = localInventory.reduce((sum, inv) => sum + inv.total_quantity, 0);
    const uniqueWarehouses = new Set(localInventory.map(inv => inv.warehouse_id)).size;
    const lastUpdate = localInventory.length > 0 
      ? localInventory.reduce((latest, inv) => 
          !latest || inv.last_updated > latest ? inv.last_updated : latest, null)
      : null;

    const result = {
      localInventory,
      variants: variants?.map(v => ({
        ...v,
        warehouses: Array.isArray((v as any).ss_inventory) ? (v as any).ss_inventory : []
      })) || [],
      summary: {
        totalQuantity,
        uniqueWarehouses,
        lastUpdate,
      }
    };

    console.log(`✅ Detailed inventory for ${styleId}:`, result.summary);
    return result;

  } catch (error) {
    console.error(`❌ Failed to get detailed inventory for ${styleId}:`, error);
    throw error;
  }
}

// Get catalog statistics
export async function getSSCatalogStats(): Promise<{
  totalProducts: number;
  totalVariants: number;
  lastSyncDate: string | null;
  syncStatus: string;
  topBrands: Array<{ brand: string; count: number }>;
  topCategories: Array<{ category: string; count: number }>;
}> {
  console.log('📊 Getting S&S catalog statistics...');

  try {
    // Get basic counts
    const [productsResult, variantsResult, supplierResult] = await Promise.all([
      supabase
        .from('ss_products')
        .select('id', { count: 'exact' })
        .eq('supplier_id', 'SS')
        .eq('sync_status', 'active'),
      
      supabase
        .from('ss_product_variants')
        .select('id', { count: 'exact' }),
      
      supabase
        .from('suppliers')
        .select('last_sync, sync_status')
        .eq('id', 'SS')
        .single(),
    ]);

    // Get top brands
    const { data: brandsData } = await supabase
      .from('ss_products')
      .select('brand')
      .eq('supplier_id', 'SS')
      .eq('sync_status', 'active')
      .not('brand', 'is', null);

    // Get top categories
    const { data: categoriesData } = await supabase
      .from('ss_products')
      .select('category')
      .eq('supplier_id', 'SS')
      .eq('sync_status', 'active')
      .not('category', 'is', null);

    // Process brand counts
    const brandCounts = new Map<string, number>();
    brandsData?.forEach(item => {
      if (item.brand) {
        brandCounts.set(item.brand, (brandCounts.get(item.brand) || 0) + 1);
      }
    });

    // Process category counts
    const categoryCounts = new Map<string, number>();
    categoriesData?.forEach(item => {
      if (item.category) {
        categoryCounts.set(item.category, (categoryCounts.get(item.category) || 0) + 1);
      }
    });

    const topBrands = Array.from(brandCounts.entries())
      .map(([brand, count]) => ({ brand, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const topCategories = Array.from(categoryCounts.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    console.log('✅ S&S catalog stats retrieved');

    return {
      totalProducts: productsResult.count || 0,
      totalVariants: variantsResult.count || 0,
      lastSyncDate: supplierResult.data?.last_sync || null,
      syncStatus: supplierResult.data?.sync_status || 'unknown',
      topBrands,
      topCategories,
    };

  } catch (error) {
    console.error('❌ Failed to get catalog stats:', error);
    throw error;
  }
}

// Map local catalog product to the format expected by ProductRow component
export function mapSSProductToUnified(product: SSProduct): any {
  const variants = Array.isArray((product as any).ss_product_variants) 
    ? (product as any).ss_product_variants 
    : [];

  // Extract unique colors and sizes from variants
  const colors = new Set<string>();
  const sizes = new Set<string>();
  let minPrice = product.min_price;
  let maxPrice = product.max_price;
  let totalInventory = 0;
  const inventoryByWarehouseSize: Record<string, Record<string, number>> = {};

  variants.forEach((variant: SSProductVariant) => {
    if (variant.color_name) colors.add(variant.color_name);
    if (variant.size_label) sizes.add(variant.size_label);
    if (variant.price && (!minPrice || variant.price < minPrice)) minPrice = variant.price;
    if (variant.price && (!maxPrice || variant.price > maxPrice)) maxPrice = variant.price;

    // Process inventory levels if available
    if (Array.isArray((variant as any).ss_inventory_levels)) {
      (variant as any).ss_inventory_levels.forEach((inv: any) => {
        const warehouse = inv.ss_warehouse_locations;
        const warehouseName = warehouse ? `${warehouse.city}, ${warehouse.state}` : inv.warehouse_id;
        
        if (!inventoryByWarehouseSize[warehouseName]) {
          inventoryByWarehouseSize[warehouseName] = {};
        }
        
        if (!inventoryByWarehouseSize[warehouseName][variant.size_label]) {
          inventoryByWarehouseSize[warehouseName][variant.size_label] = 0;
        }
        
        inventoryByWarehouseSize[warehouseName][variant.size_label] += inv.quantity_available || 0;
        totalInventory += inv.quantity_available || 0;
      });
    }
  });

  return {
    id: product.id,
    sku: product.sku,
    name: product.name,
    category: product.category || 'Apparel',
    lowestPrice: minPrice || 0,
    highestPrice: maxPrice || minPrice || 0,
    image: product.primary_image_url,
    colors: Array.from(colors),
    suppliers: [{
      name: 'S&S Activewear',
      price: minPrice || 0,
      inventory: totalInventory,
      inventoryByWarehouseSize: Object.keys(inventoryByWarehouseSize).length > 0 ? inventoryByWarehouseSize : undefined,
    }],
    // Keep original fields for compatibility
    supplierId: 'SS',
    supplierName: 'S&S Activewear',
    styleId: product.style_id,
    description: product.description || '',
    images: product.images || [],
    variants: variants,
    price: minPrice || 0,
    brand: product.brand || 'S&S Activewear',
    // Sync metadata
    lastSynced: product.last_synced,
    syncStatus: product.sync_status,
  };
}

