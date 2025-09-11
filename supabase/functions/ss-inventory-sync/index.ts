import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

// Inventory sync service for S&S Activewear using Inventory 2.0.0 API
// Based on SNS.md documentation - warehouse-level inventory tracking

interface InventoryRequest {
  wsVersion: string;
  id: string; // Account number
  password: string; // API key
  productId: string; // Style ID like "B00760"
}

interface InventoryLocationData {
  inventoryLocationId: string; // "NJ", "KS", "TX", etc.
  inventoryLocationName: string; // "Robbinsville", "Olathe", etc.
  city: string;
  country: string;
  postalCode: string;
  quantity: number;
}

interface PartInventoryData {
  partId: string; // "B00760033"
  mainPart: boolean;
  partColor: string; // "Antique Cherry Red"
  labelSize: string; // "S", "M", "L", etc.
  partDescription: string;
  totalQuantity: number;
  manufacturedItem: boolean;
  locations: InventoryLocationData[];
}

// Environment configuration
const SS_ACCOUNT_NUMBER = Deno.env.get('SS_ACCOUNT_NUMBER') || '';
const SS_API_KEY = Deno.env.get('SS_API_KEY') || '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Enhanced SOAP request with retry logic from your suppliers-ss function
async function makeSOAPRequest(endpoint: string, soapAction: string, body: string, retries = 3): Promise<string> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`📡 SOAP request attempt ${attempt}/${retries} to ${endpoint}`);
      
      const response = await Promise.race([
        fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'text/xml; charset=utf-8',
            'SOAPAction': soapAction,
            'User-Agent': 'InkIQ-InventorySync/2.0.0',
          },
          body: body,
        }),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Request timeout')), 30000)
        )
      ]);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const responseText = await response.text();
      console.log(`✅ SOAP request successful on attempt ${attempt}`);
      return responseText;
      
    } catch (error) {
      lastError = error as Error;
      console.warn(`⚠️ SOAP attempt ${attempt} failed:`, error);
      
      if (attempt < retries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        console.log(`⏳ Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw new Error(`All ${retries} SOAP attempts failed. Last error: ${lastError.message}`);
}

// Get inventory levels for a specific product using S&S Inventory 2.0.0 format from SNS.md
async function getSSInventoryLevels(productId: string): Promise<PartInventoryData[]> {
  console.log(`📦 Getting inventory levels for product: ${productId}`);
  
  // Use exact format from your SNS.md documentation
  const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ns="http://www.promostandards.org/WSDL/Inventory/2.0.0/" xmlns:shar="http://www.promostandards.org/WSDL/Inventory/2.0.0/SharedObjects/">
  <soapenv:Header/>
  <soapenv:Body>
      <ns:GetInventoryLevelsRequest>
         <shar:wsVersion>2.0.0</shar:wsVersion>
         <shar:id>${SS_ACCOUNT_NUMBER}</shar:id>
         <shar:password>${SS_API_KEY}</shar:password>
         <shar:productId>${productId}</shar:productId>
      </ns:GetInventoryLevelsRequest>
   </soapenv:Body>
</soapenv:Envelope>`;

  const responseXml = await makeSOAPRequest(
    'https://promostandards.ssactivewear.com/Inventory/v2/InventoryServicev2.svc',
    'http://www.promostandards.org/WSDL/Inventory/2.0.0/GetInventoryLevels',
    soapEnvelope
  );

  // Parse the XML response based on your SNS.md sample response format
  return parseInventoryResponse(responseXml, productId);
}

// Parse inventory XML response based on SNS.md sample format
function parseInventoryResponse(xml: string, productId: string): PartInventoryData[] {
  const partInventories: PartInventoryData[] = [];
  
  try {
    // Extract PartInventory elements based on your SNS.md sample
    const partMatches = xml.match(/<PartInventory>(.*?)<\/PartInventory>/gs) || [];
    
    for (const partMatch of partMatches) {
      const partId = extractXmlValue(partMatch, 'partId');
      const mainPart = extractXmlValue(partMatch, 'mainPart') === 'true';
      const partColor = extractXmlValue(partMatch, 'partColor');
      const labelSize = extractXmlValue(partMatch, 'labelSize');
      const partDescription = extractXmlValue(partMatch, 'partDescription');
      const manufacturedItem = extractXmlValue(partMatch, 'manufacturedItem') === 'true';
      
      // Extract total quantity from quantityAvailable/Quantity/value
      const totalQuantityMatch = partMatch.match(/<quantityAvailable>.*?<value>(\d+)<\/value>/s);
      const totalQuantity = totalQuantityMatch ? parseInt(totalQuantityMatch[1]) : 0;
      
      // Extract warehouse locations based on SNS.md InventoryLocationArray format
      const locations: InventoryLocationData[] = [];
      const locationMatches = partMatch.match(/<InventoryLocation>(.*?)<\/InventoryLocation>/gs) || [];
      
      for (const locationMatch of locationMatches) {
        const inventoryLocationId = extractXmlValue(locationMatch, 'inventoryLocationId');
        const inventoryLocationName = extractXmlValue(locationMatch, 'inventoryLocationName');
        const city = extractXmlValue(locationMatch, 'city');
        const country = extractXmlValue(locationMatch, 'country');
        const postalCode = extractXmlValue(locationMatch, 'postalCode');
        
        // Extract quantity for this location
        const locationQuantityMatch = locationMatch.match(/<inventoryLocationQuantity>.*?<value>(\d+)<\/value>/s);
        const quantity = locationQuantityMatch ? parseInt(locationQuantityMatch[1]) : 0;
        
        if (inventoryLocationId && inventoryLocationName) {
          locations.push({
            inventoryLocationId,
            inventoryLocationName,
            city: city || '',
            country: country || 'US',
            postalCode: postalCode || '',
            quantity
          });
        }
      }
      
      if (partId) {
        partInventories.push({
          partId,
          mainPart,
          partColor: partColor || '',
          labelSize: labelSize || '',
          partDescription: partDescription || '',
          totalQuantity,
          manufacturedItem,
          locations
        });
      }
    }
    
    console.log(`✅ Parsed ${partInventories.length} part inventories for ${productId}`);
    return partInventories;
    
  } catch (error) {
    console.error(`❌ Failed to parse inventory XML for ${productId}:`, error);
    return [];
  }
}

// Helper function to extract XML values
function extractXmlValue(xml: string, tagName: string): string {
  const match = xml.match(new RegExp(`<${tagName}[^>]*>([^<]+)<\/${tagName}>`, 'i'));
  return match ? match[1].trim() : '';
}

// Sync inventory data to database
async function syncInventoryToDatabase(productId: string, partInventories: PartInventoryData[]): Promise<void> {
  console.log(`💾 Syncing inventory for ${productId} to database...`);
  
  try {
    // Get the product record to link variants
    const { data: product, error: productError } = await supabase
      .from('ss_products')
      .select('id')
      .eq('supplier_id', 'SS')
      .eq('style_id', productId)
      .single();
      
    if (productError || !product) {
      console.warn(`⚠️ Product ${productId} not found in database - skipping inventory sync`);
      return;
    }
    
    for (const partInventory of partInventories) {
      // Upsert product variant
      const { data: variant, error: variantError } = await supabase
        .from('ss_product_variants')
        .upsert({
          product_id: product.id,
          part_id: partInventory.partId,
          sku: partInventory.partId,
          color_name: partInventory.partColor,
          size_label: partInventory.labelSize,
          is_main_part: partInventory.mainPart,
          manufactured_item: partInventory.manufacturedItem,
          last_synced: new Date().toISOString(),
        }, {
          onConflict: 'product_id,part_id'
        })
        .select()
        .single();
        
      if (variantError) {
        console.error(`❌ Failed to sync variant ${partInventory.partId}:`, variantError);
        continue;
      }
      
      // Sync warehouse inventory for this variant
      for (const location of partInventory.locations) {
        await supabase
          .from('ss_inventory')
          .upsert({
            variant_id: variant.id,
            warehouse_id: location.inventoryLocationId,
            warehouse_name: location.inventoryLocationName,
            warehouse_address: {
              city: location.city,
              state: location.inventoryLocationId, // Use warehouse ID as state for now
              postalCode: location.postalCode
            },
            quantity_available: location.quantity,
            as_of: new Date().toISOString(),
            last_synced: new Date().toISOString(),
          }, {
            onConflict: 'variant_id,warehouse_id'
          });
      }
    }
    
    console.log(`✅ Synced inventory for ${productId}: ${partInventories.length} variants`);
    
  } catch (error) {
    console.error(`❌ Failed to sync inventory for ${productId}:`, error);
    throw error;
  }
}

// Batch inventory sync for multiple products
async function batchInventorySync(productIds: string[]): Promise<{
  syncedCount: number;
  errorCount: number;
  errors: Array<{ productId: string; error: string }>;
}> {
  console.log(`🔄 Starting batch inventory sync for ${productIds.length} products...`);
  
  let syncedCount = 0;
  let errorCount = 0;
  const errors: Array<{ productId: string; error: string }> = [];
  
  // Process in small batches to be respectful to S&S API
  const batchSize = 3;
  const batches = [];
  for (let i = 0; i < productIds.length; i += batchSize) {
    batches.push(productIds.slice(i, i + batchSize));
  }
  
  for (const batch of batches) {
    const batchPromises = batch.map(async (productId) => {
      try {
        const partInventories = await getSSInventoryLevels(productId);
        await syncInventoryToDatabase(productId, partInventories);
        syncedCount++;
      } catch (error) {
        errorCount++;
        errors.push({
          productId,
          error: (error as Error).message
        });
        console.error(`❌ Failed to sync inventory for ${productId}:`, error);
      }
    });
    
    await Promise.all(batchPromises);
    
    // Small delay between batches
    if (batches.indexOf(batch) < batches.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  console.log(`✅ Batch inventory sync complete: ${syncedCount} synced, ${errorCount} errors`);
  
  return {
    syncedCount,
    errorCount,
    errors
  };
}

// Get products that need inventory refresh
async function getProductsForInventorySync(limit = 10): Promise<string[]> {
  console.log(`🔍 Getting products for inventory sync (limit: ${limit})...`);
  
  try {
    // Get products that haven't been synced recently or have no inventory data
    const { data: products, error } = await supabase
      .from('ss_products')
      .select('style_id')
      .eq('supplier_id', 'SS')
      .eq('sync_status', 'active')
      .order('last_synced', { ascending: true })
      .limit(limit);
      
    if (error) {
      throw new Error(`Failed to get products: ${error.message}`);
    }
    
    const productIds = products?.map(p => p.style_id) || [];
    console.log(`✅ Found ${productIds.length} products needing inventory sync`);
    
    return productIds;
    
  } catch (error) {
    console.error('❌ Failed to get products for sync:', error);
    return [];
  }
}

// Main Edge Function handler
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { op, params = {} } = await req.json();

    if (op === 'syncInventory') {
      // Sync inventory for specific products or batch
      const productIds = params.productIds || await getProductsForInventorySync(params.limit || 5);
      
      if (productIds.length === 0) {
        return new Response(JSON.stringify({
          success: true,
          message: 'No products found that need inventory sync',
          syncedCount: 0,
          errorCount: 0,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      const result = await batchInventorySync(productIds);
      
      return new Response(JSON.stringify({
        success: true,
        message: `Inventory sync completed: ${result.syncedCount} synced, ${result.errorCount} errors`,
        ...result,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (op === 'getInventory') {
      // Get current inventory for a specific product
      const { productId } = params;
      
      if (!productId) {
        throw new Error('productId parameter required');
      }
      
      const partInventories = await getSSInventoryLevels(productId);
      
      return new Response(JSON.stringify({
        success: true,
        productId,
        partInventories,
        totalParts: partInventories.length,
        totalQuantity: partInventories.reduce((sum, part) => sum + part.totalQuantity, 0),
        warehouses: [...new Set(partInventories.flatMap(part => 
          part.locations.map(loc => loc.inventoryLocationId)
        ))],
        asOf: new Date().toISOString(),
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (op === 'status') {
      // Get inventory sync status
      const { data: inventoryStats } = await supabase
        .from('ss_inventory')
        .select('warehouse_id, quantity_available, as_of')
        .order('as_of', { ascending: false })
        .limit(1000);
        
      const warehouseTotals = new Map<string, number>();
      let totalInventory = 0;
      let lastUpdate: string | null = null;
      
      inventoryStats?.forEach(inv => {
        const current = warehouseTotals.get(inv.warehouse_id) || 0;
        warehouseTotals.set(inv.warehouse_id, current + inv.quantity_available);
        totalInventory += inv.quantity_available;
        
        if (!lastUpdate || inv.as_of > lastUpdate) {
          lastUpdate = inv.as_of;
        }
      });
      
      return new Response(JSON.stringify({
        totalInventoryRecords: inventoryStats?.length || 0,
        totalInventoryQuantity: totalInventory,
        uniqueWarehouses: warehouseTotals.size,
        warehouseTotals: Object.fromEntries(warehouseTotals),
        lastUpdate,
        timestamp: new Date().toISOString(),
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ 
      error: 'Unknown operation. Supported: syncInventory, getInventory, status' 
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

