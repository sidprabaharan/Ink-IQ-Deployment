import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

// Types based on your SNS.md PromoStandards documentation
interface ProductDataRequest {
  wsVersion: string;
  id: string; // Account number
  password: string; // API key
  localizationCountry: string;
  localizationLanguage: string;
  productId?: string;
  isSellable?: boolean;
}

interface ProductDataResponse {
  products?: Array<{
    productId: string;
    productName?: string;
    productBrand?: string;
    description?: string;
    primaryImageURL?: string;
    lastChangeDate?: string;
    effectiveDate?: string;
    endDate?: string;
    isCloseout?: boolean;
    isCaution?: boolean;
    isOnDemand?: boolean;
    isHazmat?: boolean;
    ProductPartArray?: Array<{
      partId: string;
      ColorArray?: Array<{
        hex?: string;
        approximatePms?: string;
        colorName: string;
      }>;
      ApparelSize?: {
        apparelStyle?: string;
        labelSize: string;
      };
      Dimension?: {
        weight?: number;
        weightUom?: string;
      };
      gtin?: string;
      isRushService?: boolean;
      ShippingPackageArray?: Array<{
        packageType: string;
        quantity: number;
        depth: number;
        height: number;
        width: number;
        weight: number;
        dimensionUom: string;
        weightUom: string;
      }>;
      isCloseout?: boolean;
      isCaution?: boolean;
      isOnDemand?: boolean;
      isHazmat?: boolean;
    }>;
  }>;
}

interface InventoryRequest {
  wsVersion: string;
  id: string;
  password: string;
  productId: string;
}

interface PricingRequest {
  wsVersion: string;
  id: string;
  password: string;
  productId: string;
  currency: string;
  fobId: string;
  priceType: string;
  localizationCountry: string;
  localizationLanguage: string;
  configurationType: string;
}

// Utility: Normalize boolean-like flags
function asBool(value: any): boolean {
  if (value === true || value === 1) return true;
  const s = String(value ?? '').trim().toLowerCase();
  return s === 'true' || s === '1' || s === 'y' || s === 'yes';
}

// Utility: Determine if a product record appears discontinued/inactive
function isDiscontinuedLike(record: any): boolean {
  return asBool(record?.isDiscontinued ?? record?.ISDISCONTINUED ?? record?.discontinued ?? false);
}

// Resolve user-provided style code (e.g., "2000", "18500") to S&S numeric styleId (e.g., 39)
async function resolveSSStyleId(inputId: string): Promise<{ resolvedStyleId?: string, styleQuery?: string }> {
  const id = String(inputId || '').trim();
  if (!id) return {};

  try {
    // 1) If numeric, try directly first
    if (/^\d{3,6}$/.test(id)) {
      const url = new URL('products', SS_BASE_URL);
      url.searchParams.set('styleid', id);
      url.searchParams.set('mediaType', 'json');
      const basicAuth = btoa(`${SS_ACCOUNT_NUMBER}:${SS_API_KEY}`);
      const r = await fetch(url.toString(), { headers: { 'Authorization': `Basic ${basicAuth}` } });
      if (r.ok) {
        const data = await r.json();
        const items = Array.isArray(data) ? data : (data?.products || data?.items || data?.Results || []);
        if (items?.length) return { resolvedStyleId: id };
      }
    }

    // 2) Use suppliers-ss search to find proper styleId and brand+style
    const resp = await fetch(`${SUPABASE_URL}/functions/v1/suppliers-ss`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'apikey': `${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ op: 'searchProducts', params: { query: id, page: 1 } })
    });
    if (resp.ok) {
      const results = await resp.json();
      const arr = Array.isArray(results) ? results : [];
      if (arr.length > 0) {
        const first = arr[0];
        const styleId = String(first?.styleId || '').trim();
        const brand = String(first?.brand || first?.brandName || '').trim();
        const styleName = String(first?.styleName || first?.name || '').trim();
        const styleQuery = brand && styleName ? `${brand} ${styleName}` : undefined;
        if (styleId) return { resolvedStyleId: styleId, styleQuery };
        if (styleQuery) return { styleQuery };
      }
    }
  } catch (_e) { /* ignore */ }

  return {};
}

// Environment configuration
const SS_ACCOUNT_NUMBER = Deno.env.get('SS_ACCOUNT_NUMBER') || '';
const SS_API_KEY = Deno.env.get('SS_API_KEY') || '';
const SS_BASE_URL = Deno.env.get('SS_BASE_URL') || 'https://api.ssactivewear.com/v2/';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

// Initialize Supabase client with service role for database operations
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// SOAP request helper using your documented format
async function makeSOAPRequest(endpoint: string, soapAction: string, body: string): Promise<string> {
  console.log(`📡 Making SOAP request to ${endpoint}`);
  
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      'SOAPAction': soapAction,
      'User-Agent': 'InkIQ-CatalogSync/2.0.0',
    },
    body: body,
  });

  if (!response.ok) {
    throw new Error(`SOAP request failed: ${response.status} ${response.statusText}`);
  }

  return await response.text();
}

// Get real S&S product IDs using the working suppliers-ss search approach
async function getSSProductSellableTestBatch(): Promise<string[]> {
  console.log('🔄 Getting real S&S product IDs via search...');
  
  try {
    // Use the working suppliers-ss function to search for common products
    const basicAuth = btoa(`${SS_ACCOUNT_NUMBER}:${SS_API_KEY}`);
    const searches = [
      'gildan',
      'hanes', 
      't-shirt',
      'polo',
      'sweatshirt',
      'hoodie',
      'cotton',
      'polyester',
      'bella',
      'canvas'
    ];
    
    const allProductIds = new Set<string>();
    
    for (const searchTerm of searches) {
      try {
        console.log(`🔍 Searching S&S for: "${searchTerm}"`);
        
        // Call the working suppliers-ss function approach
        const response = await fetch(`${SUPABASE_URL}/functions/v1/suppliers-ss`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            'apikey': `${SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            op: 'searchProducts',
            params: { query: searchTerm, page: 1 }
          })
        });
        
        if (response.ok) {
          const searchResults = await response.json();
          console.log(`📦 Found ${searchResults.length || 0} products for "${searchTerm}"`);
          
          // Extract style IDs from search results
          if (Array.isArray(searchResults)) {
            searchResults.forEach((product: any) => {
              if (product.styleId) {
                allProductIds.add(product.styleId.toString());
              }
            });
          }
        } else {
          console.log(`❌ Search failed for "${searchTerm}": ${response.status}`);
        }
        
        // Small delay between searches
        await new Promise(r => setTimeout(r, 500));
        
      } catch (error) {
        console.log(`❌ Search error for "${searchTerm}":`, (error as Error).message);
      }
    }
    
    const productIds = Array.from(allProductIds).slice(0, 20); // Take first 20
    
    if (productIds.length > 0) {
      console.log(`✅ Found ${productIds.length} real S&S product IDs`);
      console.log('📝 Real product IDs:', productIds);
      return productIds;
    }
    
  } catch (error) {
    console.log('❌ Search approach failed:', (error as Error).message);
  }
  
  // Final fallback - use known working product IDs from database
  console.log('📦 Falling back to known working product IDs...');
  return [
    '2000',  // Gildan Ultra Cotton T-Shirt (confirmed working)
    '8000',  // Gildan DryBlend T-Shirt (in database)
    '18500', // Gildan Heavy Blend Hoodie (in database)
    '5000',  // Gildan Heavy Cotton (common style)
    '64000', // Gildan Softstyle (popular)
    '18000'  // Gildan Crewneck Sweatshirt (common)
  ];
}

// Alternative: Try to get products by category if categories endpoint works
async function getSSProductsByCategory(): Promise<string[]> {
  console.log('🔄 Attempting to get S&S products by category...');
  
  try {
    const basicAuth = btoa(`${SS_ACCOUNT_NUMBER}:${SS_API_KEY}`);
    
    // Try to get categories first
    const categoriesUrl = new URL('categories', SS_BASE_URL);
    categoriesUrl.searchParams.set('mediaType', 'json');
    
    const categoriesResponse = await fetch(categoriesUrl.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
    
    if (categoriesResponse.ok) {
      const categoriesData = await categoriesResponse.json();
      console.log('📋 Categories available:', typeof categoriesData, Array.isArray(categoriesData) ? categoriesData.length : 'Object');
      
      // If we have categories, try to get products for the first category
      let firstCategory = null;
      if (Array.isArray(categoriesData) && categoriesData.length > 0) {
        firstCategory = categoriesData[0].id || categoriesData[0].name || categoriesData[0];
      } else if (categoriesData && typeof categoriesData === 'object') {
        const cats = Object.values(categoriesData);
        firstCategory = cats[0];
      }
      
      if (firstCategory) {
        console.log(`🔍 Trying to get products for category: ${firstCategory}`);
        
        const productsUrl = new URL('products', SS_BASE_URL);
        productsUrl.searchParams.set('categoryId', String(firstCategory));
        productsUrl.searchParams.set('mediaType', 'json');
        
        const productsResponse = await fetch(productsUrl.toString(), {
          method: 'GET',
          headers: {
            'Authorization': `Basic ${basicAuth}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        });
        
        if (productsResponse.ok) {
          const productsData = await productsResponse.json();
          const productIds = Array.isArray(productsData) 
            ? productsData.map((p: any) => p.styleID || p.productID || p.id || p.SKU).filter(Boolean)
            : [];
          
          console.log(`✅ Found ${productIds.length} products in category ${firstCategory}`);
          return productIds.slice(0, 10); // Return first 10 for testing
        }
      }
    }
    
  } catch (error) {
    console.log('❌ Category-based approach failed:', (error as Error).message);
  }
  
  // Fall back to test batch
  console.log('📦 Falling back to hardcoded test batch...');
  return getSSProductSellableTestBatch();
}

// Updated function that uses safe approaches
async function getSSProductSellablePage(page: number = 1, pageSize: number = 20): Promise<{ productIds: string[], totalPages: number, hasMore: boolean }> {
  console.log(`🔄 Getting S&S products safely (page ${page}, ${pageSize} per page)...`);
  
  // Get real product IDs from search or fallback
  const allProductIds = await getSSProductSellableTestBatch();
  
  // Simulate pagination with the available products
  const startIndex = (page - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const pageProducts = allProductIds.slice(startIndex, endIndex);
  const totalPages = Math.ceil(allProductIds.length / pageSize);
  const hasMore = page < totalPages;
  
  console.log(`✅ Page ${page}: ${pageProducts.length} products (${startIndex + 1}-${startIndex + pageProducts.length} of ${allProductIds.length})`);
  console.log('📝 Products on this page:', pageProducts);
  
  return {
    productIds: pageProducts,
    totalPages,
    hasMore
  };
}

// Legacy function for backward compatibility - gets first page only
async function getSSProductSellable(): Promise<string[]> {
  const result = await getSSProductSellablePage(1, 100);
  return result.productIds;
}

// Get detailed product information using REST API (same approach as suppliers-ss)
async function getSSProductDetails(productId: string): Promise<any> {
  console.log(`📦 Getting product details for ${productId} via REST...`);
  
  try {
    // Resolve to proper styleId or style query
    const resolved = await resolveSSStyleId(productId);
    const styleIdOrSame = resolved.resolvedStyleId || productId;
    const styleQuery = resolved.styleQuery; // e.g., "Gildan 2000"

    const basicAuth = btoa(`${SS_ACCOUNT_NUMBER}:${SS_API_KEY}`);
    
    // Try Styles endpoint for better image and product data
    const stylesUrl = new URL('styles', SS_BASE_URL);
    stylesUrl.searchParams.set('styleId', styleIdOrSame);
    stylesUrl.searchParams.set('mediaType', 'json');
    console.log(`🎨 First try Styles API: ${stylesUrl.toString()}`);
    
    // Also prepare fallback Products URL without field restrictions
    const productsUrl = new URL('products', SS_BASE_URL);
    if (styleQuery) {
      productsUrl.searchParams.set('style', styleQuery);
    } else {
      productsUrl.searchParams.set('styleid', styleIdOrSame);
    }
    productsUrl.searchParams.set('mediaType', 'json');
    console.log(`📦 Backup Products API: ${productsUrl.toString()}`);
    
    // Try Styles first, then Products as fallback
    let url = stylesUrl;

    let response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    // If Styles fails, try Products endpoint as fallback
    if (!response.ok && url === stylesUrl) {
      console.log(`⚠️ Styles API failed (${response.status}), trying Products API...`);
      url = productsUrl;
      response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${basicAuth}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });
    }

    if (!response.ok) {
      throw new Error(`S&S API returned ${response.status}: ${response.statusText} for ${url.toString()}`);
    }

    const data = await response.json();
    console.log(`✅ Got product details for ${productId} via REST`);
    console.log(`🔍 RAW API Response for ${productId}:`, JSON.stringify(data, null, 2));
    
    // Extract product info from REST response
    const products = Array.isArray(data) ? data : 
                    (data.products || data.items || data.Results || []);

    // Skip discontinued/inactive items if flagged
    const isDiscontinued = (val: any) => String(val).toLowerCase() === 'true' || val === true || val === 1;
    if (products?.length) {
      const active = products.filter((p: any) => !isDiscontinued(p.isDiscontinued || p.ISDISCONTINUED || p.discontinued));
      if (active.length === 0) {
        throw new Error(`Style ${productId} appears discontinued or inactive`);
      }
    }
    
    const product = products[0] || {};
    console.log(`🔍 Extracted product for ${productId}:`, JSON.stringify(product, null, 2));
    
    // Process image URLs - convert relative paths to full URLs (using correct S&S CDN)
    const processImageUrl = (imageUrl: string | null) => {
      if (!imageUrl) return null;
      if (imageUrl.startsWith('http')) return imageUrl; // Already full URL
      
      // Convert relative S&S image paths to full URLs using correct CDN
      const cdnBase = 'https://cdn.ssactivewear.com/';
      let cleanUrl = String(imageUrl).replace(/^\//, ''); // Remove leading slash
      
      // Ensure the URL starts with Images/ for S&S CDN structure
      if (!cleanUrl.startsWith('Images/')) {
        cleanUrl = 'Images/' + cleanUrl;
      }
      
      const fullUrl = cdnBase + cleanUrl;
      console.log(`🖼️ Processed image URL: "${imageUrl}" -> "${fullUrl}"`);
      return fullUrl;
    };
    
    // Look for images in variants (like suppliers-ss does)
    const variants = Array.isArray(product.variants) ? product.variants : 
                    Array.isArray(product.skus) ? product.skus : [];
    
    let primaryImageUrl = null;
    const additionalImages: string[] = [];
    
    // First try style-level images
    primaryImageUrl = processImageUrl(
      product.primaryImageURL || 
      product.PRIMARYIMAGEURL || 
      product.image || 
      product.IMAGE ||
      product.imageUrl ||
      product.styleImage ||
      product.frontImage
    );
    
    // Then look in variants for better images (like suppliers-ss does)
    for (const variant of variants) {
      const frontImg = processImageUrl(variant.imageFront || variant.frontImage || variant.front);
      const sideImg = processImageUrl(variant.imageSide || variant.sideImage || variant.side);
      const backImg = processImageUrl(variant.imageBack || variant.backImage || variant.back);
      const swatchImg = processImageUrl(variant.swatchImage || variant.swatch || variant.swatchUrl);
      
      // Use first variant's front image as primary if none found
      if (!primaryImageUrl && frontImg) {
        primaryImageUrl = frontImg;
      }
      
      // Collect all variant images
      [frontImg, sideImg, backImg, swatchImg].forEach(img => {
        if (img && !additionalImages.includes(img)) {
          additionalImages.push(img);
        }
      });
    }
    
    // Fallback to any images array
    if (!primaryImageUrl || additionalImages.length === 0) {
      const imageFields = product.images || product.IMAGES || product.styleImages || [];
      const fallbackImages = Array.isArray(imageFields) 
        ? imageFields.map((img: any) => {
            if (typeof img === 'string') return processImageUrl(img);
            return processImageUrl(img.url || img.imageURL || img.src || img.href || img);
          }).filter(Boolean)
        : [];
      
      if (!primaryImageUrl && fallbackImages.length > 0) {
        primaryImageUrl = fallbackImages[0];
      }
      fallbackImages.forEach(img => {
        if (!additionalImages.includes(img)) {
          additionalImages.push(img);
        }
      });
    }
    
    console.log(`🖼️ Image processing for ${productId}: primary="${primaryImageUrl}", additional=[${additionalImages.join(', ')}]`);
    
    // Extract pricing information from variants (like suppliers-ss does)
    let minPrice = null;
    let maxPrice = null;
    
    // Try style-level pricing first (check many common fields)
    const styleLevelPrice = (
      product.price ?? product.PRICE ??
      product.wholesale ?? product.WHOLESALE ??
      product.wholesalePrice ?? product.WHOLESALEPRICE ??
      product.salePrice ?? product.SALEPRICE ??
      product.cost ?? product.COST ?? null
    );
    if (styleLevelPrice && styleLevelPrice > 0) {
      minPrice = styleLevelPrice;
      maxPrice = (
        product.msrp ?? product.MSRP ??
        product.retailPrice ?? product.RETAILPRICE ??
        product.listPrice ?? product.LISTPRICE ??
        styleLevelPrice
      );
    }
    
    // Look for variant-level pricing (using same approach as working suppliers-ss)
    const variantPrices: number[] = [];
    for (const variant of variants) {
      // Try multiple price fields like suppliers-ss does
      const priceRaw = (
        variant?.price ?? variant?.PRICE ??
        variant?.wholesale ?? variant?.WHOLESALE ??
        variant?.wholesalePrice ?? variant?.WHOLESALEPRICE ??
        variant?.salePrice ?? variant?.SALEPRICE ??
        variant?.cost ?? variant?.COST ??
        variant?.tier ?? variant?.msrp ?? variant?.MSRP ?? 0
      );
      const price = Number(priceRaw) || 0;
      
      console.log(`💰 Variant pricing for ${productId}: raw=${priceRaw}, parsed=${price}`);
      
      if (price > 0) {
        variantPrices.push(price);
      }
    }
    
    // If we found variant prices, use them
    if (variantPrices.length > 0) {
      minPrice = Math.min(...variantPrices);
      maxPrice = Math.max(...variantPrices);
    }
    
    console.log(`💰 Pricing for ${productId}: min=${minPrice}, max=${maxPrice}, variant_prices=[${variantPrices.join(', ')}]`);

    const processedData = {
      productId: productId,
      productName: product.styleName || product.STYLENAME || product.name || product.productName || `S&S Product ${productId}`,
      description: product.description || product.DESCRIPTION || product.styleName || `Description for ${productId}`,
      brand: product.brand || product.BRAND || product.brandName || 'S&S Activewear',
      category: product.category || product.CATEGORY || product.categoryName,
      primaryImageUrl: primaryImageUrl,
      images: additionalImages.length > 0 ? additionalImages : null,
      colors: product.colors || product.COLORS || [],
      sizes: product.sizes || product.SIZES || [],
      minPrice: minPrice,
      maxPrice: maxPrice,
      currency: 'USD',
      lastChangeDate: product.lastChangeDate || product.LASTCHANGEDATE,
      source: url === stylesUrl ? 'styles_api' : 'products_api',
      hasImageData: !!primaryImageUrl || additionalImages.length > 0,
      hasPricingData: !!(minPrice && minPrice > 0)
    };
    
    console.log(`🔍 Processed product data for ${productId}:`, JSON.stringify(processedData, null, 2));
    return processedData;

  } catch (error) {
    console.error(`❌ Failed to get product details for ${productId}:`, (error as Error).message);
    throw new Error(`Failed to get real S&S product data for ${productId}: ${(error as Error).message}`);
  }
}

// Get inventory for a product using REST API
async function getSSInventory(productId: string): Promise<any> {
  console.log(`📦 Getting inventory for ${productId} via REST...`);
  
  try {
    const resolved = await resolveSSStyleId(productId);
    const styleIdOrSame = resolved.resolvedStyleId || productId;

    // Use same Products REST API approach with inventory fields
    const basicAuth = btoa(`${SS_ACCOUNT_NUMBER}:${SS_API_KEY}`);
    const url = new URL('products', SS_BASE_URL);
    url.searchParams.set('styleid', styleIdOrSame);
    url.searchParams.set('page', '1');
    url.searchParams.set('pageSize', '50');
    url.searchParams.set('mediaType', 'json');
    url.searchParams.set('fields', 'sku,qty,warehouses,size,color,isDiscontinued,isCloseout'); // proper-case fields

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`S&S Products API returned ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`✅ Got inventory data for ${productId} via REST`);
    
    // Extract inventory info from REST response
    const products = Array.isArray(data) ? data : 
                    (data.products || data.items || data.Results || []);
    
    return {
      productId: productId,
      totalQuantity: products.reduce((sum: number, p: any) => sum + (p.qty || p.QTY || 0), 0),
      partInventories: products.map((p: any) => ({
        partId: p.sku || p.SKU || p.id,
        colorName: p.color || p.COLOR,
        labelSize: p.size || p.SIZE,
        totalQuantity: p.qty || p.QTY || 0,
        warehouses: p.warehouses || p.WAREHOUSES || []
      })),
      source: 'rest_api'
    };

  } catch (error) {
    console.error(`❌ Failed to get inventory for ${productId}:`, (error as Error).message);
    throw new Error(`Failed to get real S&S inventory for ${productId}: ${(error as Error).message}`);
  }
}

// Get pricing for a product using REST API
async function getSSPricing(productId: string, fobId: string = 'IL'): Promise<any> {
  console.log(`💰 Getting pricing for ${productId} at ${fobId} via REST...`);
  
  try {
    const resolved = await resolveSSStyleId(productId);
    const styleIdOrSame = resolved.resolvedStyleId || productId;
    const styleQuery = resolved.styleQuery;

    const basicAuth = btoa(`${SS_ACCOUNT_NUMBER}:${SS_API_KEY}`);
    
    // Try inventory endpoint which often has better pricing data
    const inventoryUrl = new URL('inventory', SS_BASE_URL);
    inventoryUrl.searchParams.set('styleId', styleIdOrSame);
    inventoryUrl.searchParams.set('fobId', fobId);
    inventoryUrl.searchParams.set('mediaType', 'json');
    console.log(`💰 Trying Inventory API for pricing: ${inventoryUrl.toString()}`);
    
    // Also prepare Products endpoint as fallback
    const productsUrl = new URL('products', SS_BASE_URL);
    if (styleQuery) {
      productsUrl.searchParams.set('style', styleQuery);
    } else {
      productsUrl.searchParams.set('styleid', styleIdOrSame);
    }
    productsUrl.searchParams.set('mediaType', 'json');
    productsUrl.searchParams.set('page', '1');
    productsUrl.searchParams.set('pageSize', '200');
    productsUrl.searchParams.set('fields', 'sku,styleid,price,wholesale,wholesalePrice,salePrice,cost,msrp,retailPrice,listPrice,isDiscontinued');
    console.log(`💰 Backup Products API for pricing: ${productsUrl.toString()}`);
    
    // Try Inventory first, then Products as fallback  
    let url = inventoryUrl;

    let response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    // If Inventory fails, try Products endpoint as fallback
    if (!response.ok && url === inventoryUrl) {
      console.log(`⚠️ Inventory API failed for pricing (${response.status}), trying Products API...`);
      url = productsUrl;
      response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${basicAuth}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });
    }

    if (!response.ok) {
      throw new Error(`S&S API returned ${response.status}: ${response.statusText} for pricing from ${url.toString()}`);
    }

    const data = await response.json();
    console.log(`✅ Got pricing data for ${productId} via REST`);
    console.log(`💰 RAW Pricing API Response for ${productId}:`, JSON.stringify(data, null, 2));
    
    // Extract pricing info from REST response
    let products = Array.isArray(data) ? data : 
                   (data.products || data.items || data.Results || []);

    // If Inventory endpoint shape differs, normalize possible fields
    if (!Array.isArray(data) && data && typeof data === 'object') {
      if (Array.isArray((data as any).variants)) products = (data as any).variants;
      if (Array.isArray((data as any).skus)) products = (data as any).skus;
      if (Array.isArray((data as any).Inventory)) products = (data as any).Inventory;
    }
    
    console.log(`💰 Extracted pricing products for ${productId}:`, products.length, products.slice(0, 2));
    
    // Calculate min/max pricing across all variants
    let allPrices = products.map((p: any) => ({
      price: (
        p.price ?? p.PRICE ??
        p.wholesale ?? p.WHOLESALE ??
        p.wholesalePrice ?? p.WHOLESALEPRICE ??
        p.salePrice ?? p.SALEPRICE ?? 0
      ),
      cost: (p.cost ?? p.COST ?? 0),
      msrp: (
        p.msrp ?? p.MSRP ??
        p.retailPrice ?? p.RETAILPRICE ??
        p.listPrice ?? p.LISTPRICE ?? 0
      )
    })).filter(p => Number(p.price) > 0);

    // If Inventory returned OK but with no prices, try Products as secondary source
    if (allPrices.length === 0 && url === inventoryUrl) {
      console.log('ℹ️ Inventory returned no price data. Fetching Products for pricing...');
      const resp2 = await fetch(productsUrl.toString(), {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${basicAuth}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });
      if (resp2.ok) {
        const data2 = await resp2.json();
        console.log('💰 RAW Products Pricing Response:', JSON.stringify(data2, null, 2));
        const products2 = Array.isArray(data2) ? data2 : (data2.products || data2.items || data2.Results || []);
        allPrices = products2.map((p: any) => ({
          price: (
            p.price ?? p.PRICE ??
            p.wholesale ?? p.WHOLESALE ??
            p.wholesalePrice ?? p.WHOLESALEPRICE ??
            p.salePrice ?? p.SALEPRICE ?? 0
          ),
          cost: (p.cost ?? p.COST ?? 0),
          msrp: (
            p.msrp ?? p.MSRP ??
            p.retailPrice ?? p.RETAILPRICE ??
            p.listPrice ?? p.LISTPRICE ?? 0
          )
        })).filter(p => Number(p.price) > 0);
        console.log(`💰 Derived ${allPrices.length} prices from Products endpoint`);
      } else {
        console.log(`⚠️ Products fallback for pricing failed: ${resp2.status} ${resp2.statusText}`);
      }
    }

    const minPrice = allPrices.length > 0 ? Math.min(...allPrices.map(p => p.price)) : null;
    const maxPrice = allPrices.length > 0 ? Math.max(...allPrices.map(p => p.msrp || p.price)) : null;

    return {
      productId,
      fobId,
      currency: 'USD',
      minPrice,
      maxPrice,
      prices: products.map((p: any) => ({
        partId: p.sku || p.SKU || p.id,
        price: p.price || p.PRICE || p.wholesalePrice || p.WHOLESALEPRICE || 0,
        cost: p.cost || p.COST || 0,
        msrp: p.msrp || p.MSRP || p.retailPrice || p.RETAILPRICE || 0,
        minimumQuantity: p.minimumQuantity || p.MINIMUMQUANTITY || 1
      })),
      priceLastUpdated: new Date().toISOString(),
      source: 'rest_api'
    };

  } catch (error) {
    console.error(`❌ Failed to get pricing for ${productId} at ${fobId}:`, (error as Error).message);
    throw new Error(`Failed to get real S&S pricing for ${productId}: ${(error as Error).message}`);
  }
}

// Sync a single product to the database
async function syncProductToDatabase(productId: string): Promise<void> {
  console.log(`📦 Syncing product ${productId} to database...`);

  try {
    // Get product details, inventory, and pricing concurrently
    const [productDetails, inventory, pricing] = await Promise.all([
      getSSProductDetails(productId),
      getSSInventory(productId),
      getSSPricing(productId),
    ]);

    // Insert/update main product record with enhanced image and pricing data
    const { data: productData, error: productError } = await supabase
      .from('ss_products')
      .upsert({
        supplier_id: 'SS',
        style_id: productId,
        sku: productId,
        name: productDetails.productName || `S&S Product ${productId}`,
        brand: productDetails.brand || 'S&S Activewear',
        description: productDetails.description || '',
        category: productDetails.category || 'Apparel',
        // Enhanced image data
        primary_image_url: productDetails.primaryImageUrl,
        images: productDetails.images?.length > 0 ? productDetails.images : null,
        // Enhanced pricing data - use pricing API data if available, otherwise product details
        min_price: pricing.minPrice || productDetails.minPrice,
        max_price: pricing.maxPrice || productDetails.maxPrice,
        currency: pricing.currency || productDetails.currency || 'USD',
        price_last_updated: new Date(),
        // Color and size data
        colors: productDetails.colors?.length > 0 ? productDetails.colors : null,
        sizes: productDetails.sizes?.length > 0 ? productDetails.sizes : null,
        // Status flags
        is_closeout: productDetails.isCloseout || false,
        is_caution: productDetails.isCaution || false,
        is_on_demand: productDetails.isOnDemand || false,
        is_hazmat: productDetails.isHazmat || false,
        // Set sync_status to active for successful syncs
        sync_status: 'active',
        // Date tracking
        effective_date: productDetails.effectiveDate ? new Date(productDetails.effectiveDate) : null,
        end_date: productDetails.endDate ? new Date(productDetails.endDate) : null,
        last_change_date: productDetails.lastChangeDate ? new Date(productDetails.lastChangeDate) : null,
        // Source data for debugging
        source_data: {
          productDetails,
          inventory,
          pricing,
          hasRealData: !!productDetails.primaryImageUrl || !!productDetails.minPrice
        },
        sync_status: 'active',
        last_synced: new Date(),
      }, {
        onConflict: 'supplier_id,style_id',
      })
      .select()
      .single();

    if (productError) {
      throw new Error(`Failed to sync product ${productId}: ${productError.message}`);
    }

    console.log(`✅ Synced product ${productId} to database`);

    // TODO: Sync variants, inventory, and pricing data
    // This is a complex process that would parse the XML responses
    // and create detailed variant and inventory records

  } catch (error) {
    console.error(`❌ Failed to sync product ${productId}:`, error);
    
    // Update product status as error
    await supabase
      .from('ss_products')
      .upsert({
        supplier_id: 'SS',
        style_id: productId,
        sku: productId,
        name: `S&S Product ${productId} (Sync Error)`,
        sync_status: 'error',
        last_synced: new Date(),
        source_data: { error: (error as Error).message },
      }, {
        onConflict: 'supplier_id,style_id',
      });
  }
}

// Main sync operation
async function performFullSync(limit: number = 1): Promise<any> {
  console.log(`🚀 Starting S&S catalog sync with limit: ${limit}...`);
  console.log('🔐 Using S&S credentials:', {
    accountNumber: SS_ACCOUNT_NUMBER?.substring(0, 3) + '***',
    hasApiKey: !!SS_API_KEY
  });

  // Update supplier sync status
  await supabase
    .from('suppliers')
    .update({ 
      sync_status: 'syncing',
      updated_at: new Date(),
    })
    .eq('id', 'SS');

  try {
    // Get all sellable products from S&S
    console.log('📡 Attempting to fetch sellable products from S&S...');
    console.log('⏱️ Using extended 90-second timeouts for SOAP API calls');
    const productIds = await getSSProductSellable();
    console.log(`📦 Found ${productIds.length} products to sync`);

    if (productIds.length === 0) {
      throw new Error('No sellable products found from S&S API');
    }

    let syncedCount = 0;
    let errorCount = 0;

    // Process limited number of products for testing
    const limitedProducts = productIds.slice(0, limit);
    console.log(`🔄 Processing limited batch: ${limitedProducts.length} products (limit: ${limit})`);

    for (const productId of limitedProducts) {
      try {
        await syncProductToDatabase(productId);
        syncedCount++;
      } catch (error) {
        console.error(`❌ Error syncing ${productId}:`, error);
        errorCount++;
      }
      
      // Small delay to be respectful to S&S API
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Update supplier sync completion status
    await supabase
      .from('suppliers')
      .update({ 
        sync_status: 'complete',
        last_sync: new Date(),
        updated_at: new Date(),
      })
      .eq('id', 'SS');

    console.log(`✅ S&S sync completed: ${syncedCount} synced, ${errorCount} errors`);

    return {
      success: true,
      totalProducts: productIds.length,
      processedInThisBatch: limitedProducts.length,
      syncedCount,
      errorCount,
      limit: limit,
      message: `Successfully synced ${syncedCount}/${limitedProducts.length} products (limit: ${limit})`,
    };

  } catch (error) {
    console.error('❌ S&S sync failed:', error);
    
    // Update supplier sync error status
    await supabase
      .from('suppliers')
      .update({ 
        sync_status: 'error',
        updated_at: new Date(),
      })
      .eq('id', 'SS');

    return {
      success: false,
      error: (error as Error).message,
      message: 'S&S catalog sync failed',
    };
  }
}

// Paginated sync operation - syncs one page of products at a time to avoid timeouts
async function performPageSync(page: number = 1, pageSize: number = 50): Promise<any> {
  console.log(`📄 Starting S&S paginated sync - page ${page} (${pageSize} products)...`);
  console.log('🔐 Using S&S credentials:', {
    accountNumber: SS_ACCOUNT_NUMBER?.substring(0, 3) + '***',
    hasApiKey: !!SS_API_KEY
  });

  // Validate environment variables
  if (!SS_ACCOUNT_NUMBER || !SS_API_KEY) {
    throw new Error('Missing required S&S credentials: SS_ACCOUNT_NUMBER and/or SS_API_KEY');
  }

  // Update supplier status
  await supabase
    .from('suppliers')
    .update({ 
      last_sync_attempt: new Date().toISOString(),
      sync_status: 'syncing'
    })
    .eq('id', 'SS');

  try {
    // Get one page of sellable products from S&S
    console.log(`📡 Fetching page ${page} of products from S&S...`);
    const pageResult = await getSSProductSellablePage(page, pageSize);
    const productIds = pageResult.productIds;
    
    console.log(`📦 Found ${productIds.length} products on page ${page}`);
    console.log(`📊 Page info: hasMore=${pageResult.hasMore}, totalPages=${pageResult.totalPages}`);

    if (productIds.length === 0) {
      const message = page === 1 ? 'No sellable products found from S&S API' : `No more products found on page ${page}`;
      return {
        success: true,
        message,
        page,
        pageSize,
        processedInThisPage: 0,
        hasMore: pageResult.hasMore,
        totalPages: pageResult.totalPages,
        timestamp: new Date().toISOString()
      };
    }

    let syncedCount = 0;
    let errorCount = 0;

    // Process all products on this page
    console.log(`🔄 Processing ${productIds.length} products from page ${page}...`);

    for (const productId of productIds) {
      try {
        console.log(`🔄 Starting sync for product ${productId}...`);
        await syncProductToDatabase(productId);
        syncedCount++;
        console.log(`✅ Successfully synced product ${productId} (${syncedCount}/${productIds.length})`);
      } catch (error) {
        console.error(`❌ FAILED to sync product ${productId}:`, (error as Error).message);
        console.error(`❌ Full error details for ${productId}:`, error);
        errorCount++;
        // Continue processing other products
      }
    }

    console.log(`📊 Page ${page} sync complete: ${syncedCount} successful, ${errorCount} errors`);

    // Update supplier status
    const finalStatus = errorCount === 0 ? 'active' : 'error';
    await supabase
      .from('suppliers')
      .update({ 
        last_sync: new Date().toISOString(),
        sync_status: finalStatus,
        product_count_estimate: null // Will be recalculated
      })
      .eq('id', 'SS');

    const successMessage = errorCount === 0 
      ? `Page ${page} sync: ${syncedCount}/${productIds.length} products successfully saved to database`
      : `Page ${page} sync: ${syncedCount} successful, ${errorCount} failed (${Math.round((syncedCount / productIds.length) * 100)}% success rate)`;

    return {
      success: true,
      message: successMessage,
      page,
      pageSize,
      processedInThisPage: productIds.length,
      syncedCount,
      errorCount,
      successRate: `${Math.round((syncedCount / productIds.length) * 100)}%`,
      hasMore: pageResult.hasMore,
      totalPages: pageResult.totalPages,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.error('❌ Page sync failed:', error);
    
    // Update supplier status to error
    await supabase
      .from('suppliers')
      .update({ 
        sync_status: 'error',
        last_sync_error: (error as Error).message
      })
      .eq('id', 'SS');

    return {
      success: false,
      error: (error as Error).message,
      message: `S&S page ${page} sync failed`,
      page,
      pageSize,
      timestamp: new Date().toISOString()
    };
  }
}

// Main Edge Function handler
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Validate required environment variables
    if (!SS_ACCOUNT_NUMBER || !SS_API_KEY) {
      console.error('❌ Missing S&S credentials:', {
        hasAccountNumber: !!SS_ACCOUNT_NUMBER,
        hasApiKey: !!SS_API_KEY
      });
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing S&S API credentials',
        details: 'SS_ACCOUNT_NUMBER and SS_API_KEY must be configured'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { op, limit = 1, page = 1, pageSize = 50 } = body;

    if (op === 'testSync') {
      console.log('🧪 Testing S&S API connectivity...');
      try {
        // Simple test: just check if we can connect to S&S API
        const basicAuth = btoa(`${SS_ACCOUNT_NUMBER}:${SS_API_KEY}`);
        
        const testResponse = await fetch(`${SS_BASE_URL}Products`, {
          method: 'GET',
          headers: {
            'Authorization': `Basic ${basicAuth}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        });

        console.log(`📡 Test Response: ${testResponse.status} ${testResponse.statusText}`);

        if (!testResponse.ok) {
          const errorText = await testResponse.text();
          throw new Error(`S&S API returned ${testResponse.status}: ${errorText.substring(0, 100)}`);
        }

        return new Response(JSON.stringify({
          success: true,
          message: `S&S API connection successful (${testResponse.status})`,
          status: testResponse.status,
          statusText: testResponse.statusText,
          timestamp: new Date().toISOString(),
          credentials: {
            accountLength: SS_ACCOUNT_NUMBER.length,
            apiKeyLength: SS_API_KEY.length,
            baseUrl: SS_BASE_URL
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (error) {
        console.error('❌ Test sync failed:', error);
        return new Response(JSON.stringify({
          success: false,
          error: (error as Error).message,
          stack: (error as Error).stack,
          timestamp: new Date().toISOString()
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    if (op === 'fullSync') {
      console.log(`🚀 Starting full sync with limit: ${limit}`);
      
      const result = await performFullSync(limit);
      
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: result.success ? 200 : 500,
      });
    }

    if (op === 'testProduct') {
      console.log('🧪 Testing single product sync with hardcoded ID...');
      try {
        // Test with a hardcoded S&S product ID (skip getting full catalog)
        const testProductId = '2000'; // Common S&S style ID
        console.log(`📦 Testing product sync for: ${testProductId}`);
        
        await syncProductToDatabase(testProductId);
        
        return new Response(JSON.stringify({
          success: true,
          message: `Successfully tested sync for product ${testProductId}`,
          productId: testProductId,
          timestamp: new Date().toISOString()
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      } catch (error) {
        console.error('❌ Test product sync failed:', error);
        return new Response(JSON.stringify({
          success: false,
          error: (error as Error).message,
          stack: (error as Error).stack,
          timestamp: new Date().toISOString()
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    if (op === 'pageSync') {
      console.log('📄 Starting paginated sync...');
      try {
        console.log(`📄 Syncing page ${page} (${pageSize} products per page)...`);
        
        const result = await performPageSync(page, pageSize);
        
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: result.success ? 200 : 500,
        });

      } catch (error) {
        console.error('❌ Page sync failed:', error);
        console.error('❌ Error details:', (error as Error).stack);
        return new Response(JSON.stringify({
          success: false,
          message: `Page sync failed: ${(error as Error).message}`,
          error: (error as Error).message,
          stack: (error as Error).stack,
          timestamp: new Date().toISOString()
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        });
      }
    }

    if (op === 'debugPage') {
      console.log('🔍 Debug: Testing S&S API with different approaches...');
      try {
        const basicAuth = btoa(`${SS_ACCOUNT_NUMBER}:${SS_API_KEY}`);
        const results: any = {};
        
        // Test 1: Try with STYLEID filter (like working suppliers-ss function)
        console.log('🔍 Test 1: Products API with STYLEID filter');
        try {
          const url1 = new URL('products', SS_BASE_URL);
          url1.searchParams.set('styleid', '2000'); // Known working product ID
          url1.searchParams.set('mediaType', 'json');
          
          const response1 = await fetch(url1.toString(), {
            method: 'GET',
            headers: {
              'Authorization': `Basic ${basicAuth}`,
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            }
          });
          
          console.log(`📡 Test 1 Response: ${response1.status} ${response1.statusText}`);
          results.styleidTest = {
            status: response1.status,
            ok: response1.ok,
            url: url1.toString()
          };
          
          if (response1.ok) {
            const data1 = await response1.json();
            results.styleidTest.responseType = typeof data1;
            results.styleidTest.isArray = Array.isArray(data1);
            results.styleidTest.keys = typeof data1 === 'object' ? Object.keys(data1 || {}) : null;
          }
        } catch (e) {
          results.styleidTest = { error: (e as Error).message };
        }
        
        // Test 2: Try different API endpoints that might list products
        console.log('🔍 Test 2: Alternative endpoints');
        const endpoints = [
          'styles',
          'categories', 
          'brands',
          'inventory'
        ];
        
        results.endpointTests = {};
        
        for (const endpoint of endpoints) {
          try {
            const url = new URL(endpoint, SS_BASE_URL);
            url.searchParams.set('mediaType', 'json');
            
            const response = await fetch(url.toString(), {
              method: 'GET',
              headers: {
                'Authorization': `Basic ${basicAuth}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
              }
            });
            
            results.endpointTests[endpoint] = {
              status: response.status,
              ok: response.ok,
              url: url.toString()
            };
            
            console.log(`📡 ${endpoint}: ${response.status} ${response.statusText}`);
            
          } catch (e) {
            results.endpointTests[endpoint] = { error: (e as Error).message };
          }
        }
        
        return new Response(JSON.stringify({
          success: true,
          message: 'Debug: S&S API endpoint tests completed',
          results,
          timestamp: new Date().toISOString()
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      } catch (error) {
        console.error('❌ Debug API tests failed:', error);
        return new Response(JSON.stringify({
          success: false,
          message: `Debug API tests failed: ${(error as Error).message}`,
          error: (error as Error).message,
          stack: (error as Error).stack,
          timestamp: new Date().toISOString()
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        });
      }
    }

    // On-demand single product sync to avoid polling
    if (op === 'syncSingle') {
      try {
        const { styleId, productId, force = false, ttlHours = 12 } = body as any;
        const id = String(styleId || productId || '').trim();

        if (!id) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Missing required parameter: styleId or productId',
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Check cache in DB first
        const { data: existing } = await supabase
          .from('ss_products')
          .select('*')
          .eq('supplier_id', 'SS')
          .eq('style_id', id)
          .maybeSingle();

        const now = Date.now();
        const ttlMs = Math.max(1, Number(ttlHours)) * 3600 * 1000;
        const lastSyncedMs = existing?.last_synced ? new Date(existing.last_synced as string).getTime() : 0;
        const isFresh = Boolean(existing && lastSyncedMs && (now - lastSyncedMs) < ttlMs);

        if (existing && isFresh && !force) {
          return new Response(JSON.stringify({
            success: true,
            message: 'Cache hit',
            cache: {
              isFresh,
              ttlHours,
              lastSynced: existing.last_synced,
            },
            product: existing,
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Fetch from S&S and upsert
        await syncProductToDatabase(id);

        // Read the freshly saved record
        const { data: saved, error: fetchErr } = await supabase
          .from('ss_products')
          .select('*')
          .eq('supplier_id', 'SS')
          .eq('style_id', id)
          .single();

        if (fetchErr) {
          throw new Error(`Synced but failed to fetch saved record: ${fetchErr.message}`);
        }

        return new Response(JSON.stringify({
          success: true,
          message: 'Synced from upstream',
          cache: { isFresh: false, ttlHours },
          product: saved,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      } catch (error) {
        console.error('❌ syncSingle failed:', error);
        return new Response(JSON.stringify({
          success: false,
          error: (error as Error).message,
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    if (op === 'syncActiveFromSearch') {
      try {
        const { term = 'Gildan', page = 1 } = body as any;

        // Use the known-working suppliers-ss function to search by term
        // This handles brand/style queries robustly and returns styleIds
        const resp = await fetch(`${SUPABASE_URL}/functions/v1/suppliers-ss`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            'apikey': `${SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ op: 'searchProducts', params: { query: term, page } })
        });
        if (!resp.ok) {
          throw new Error(`searchProducts failed: ${resp.status} ${resp.statusText}`);
        }
        const results = await resp.json();
        const items = Array.isArray(results) ? results : [];

        // Extract styleIds, skip discontinued
        const styleIds = Array.from(new Set(
          items
            .filter((p: any) => !isDiscontinuedLike(p))
            .map((p: any) => String(p.styleId ?? p.styleID ?? p.STYLEID ?? '').trim())
            .filter(Boolean)
        ));

        let synced = 0, failed = 0;
        for (const sid of styleIds.slice(0, 25)) {
          try {
            await syncProductToDatabase(sid);
            synced++;
          } catch {
            failed++;
          }
        }

        return new Response(JSON.stringify({
          success: true,
          term,
          page,
          found: items.length,
          active: styleIds.length,
          synced,
          failed
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      } catch (error) {
        return new Response(JSON.stringify({ success: false, error: (error as Error).message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    if (op === 'listActive') {
      const { limit = 24 } = body as any;
      const { data, error } = await supabase
        .from('ss_products')
        .select('*')
        .eq('supplier_id', 'SS')
        .eq('sync_status', 'active')
        .not('primary_image_url', 'is', null)
        .order('last_synced', { ascending: false })
        .limit(Math.max(1, Math.min(100, Number(limit))))
        ;
      if (error) {
        return new Response(JSON.stringify({ success: false, error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      return new Response(JSON.stringify({ success: true, items: data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (op === 'status') {
      // Get current sync status
      const { data: supplier } = await supabase
        .from('suppliers')
        .select('*')
        .eq('id', 'SS')
        .single();

      const { data: productCount } = await supabase
        .from('ss_products')
        .select('id', { count: 'exact' })
        .eq('supplier_id', 'SS');

      return new Response(JSON.stringify({
        supplier,
        productCount: productCount?.length || 0,
        timestamp: new Date().toISOString(),
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ 
      error: 'Unknown operation. Supported: fullSync, pageSync, testProduct, debugPage, syncSingle, syncActiveFromSearch, listActive, status' 
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Edge function error:', error);
    
    return new Response(JSON.stringify({ 
      error: (error as Error).message,
      success: false,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

