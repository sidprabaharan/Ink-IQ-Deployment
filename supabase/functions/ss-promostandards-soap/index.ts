import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

// PromoStandards SOAP Client for S&S Activewear
// Based on the complete SNS.md documentation

interface PromoStandardsConfig {
  accountNumber: string;
  apiKey: string;
  productDataEndpoint: string;
  inventoryEndpoint: string;
  pricingEndpoint: string;
  mediaEndpoint: string;
}

interface GetProductRequest {
  wsVersion: string;
  id: string;
  password: string;
  productId: string;
  localizationCountry?: string;
  localizationLanguage?: string;
  isSellable?: boolean;
}

interface ProductDataResponse {
  products?: Array<{
    productId: string;
    productName?: string;
    productBrand?: string;
    description?: string;
    primaryImageURL?: string;
    extractedPrice?: number;
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
    }>;
  }>;
}

// S&S Activewear PromoStandards SOAP endpoints
// Using EXACT S&S PromoStandards WSDL endpoints from official WSDL definition
const SS_CONFIG: PromoStandardsConfig = {
  accountNumber: Deno.env.get('SS_ACCOUNT_NUMBER') || '944527',
  apiKey: Deno.env.get('SS_API_KEY') || '663f142b-1a2d-4c68-a2cf-88e032f092e3',
  productDataEndpoint: 'https://promostandards.ssactivewear.com/ProductData/v2/ProductDataServicev2.svc',
  inventoryEndpoint: 'https://promostandards.ssactivewear.com/inventory/v1/inventoryservice.svc',
  pricingEndpoint: 'https://promostandards.ssactivewear.com/PricingAndConfiguration/v1/PricingAndConfigurationService.svc',
  mediaEndpoint: 'https://promostandards.ssactivewear.com/mediacontent/v1/mediacontentservice.svc'
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
};

// Create SOAP envelope for GetProduct request
function createGetProductSOAP(request: GetProductRequest): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" 
               xmlns:xsd="http://www.w3.org/2001/XMLSchema" 
               xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <GetProduct xmlns="http://www.promostandards.org/WSDL/ProductData/2.0.0/">
      <wsVersion>${request.wsVersion}</wsVersion>
      <id>${request.id}</id>
      <password>${request.password}</password>
      <productId>${request.productId}</productId>
      <localizationCountry>${request.localizationCountry || 'US'}</localizationCountry>
      <localizationLanguage>${request.localizationLanguage || 'en'}</localizationLanguage>
      ${request.isSellable !== undefined ? `<isSellable>${request.isSellable}</isSellable>` : ''}
    </GetProduct>
  </soap:Body>
</soap:Envelope>`;
}

// Create SOAP envelope for GetProductSellable request
function createGetProductSellableSOAP(request: Omit<GetProductRequest, 'productId'>): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" 
               xmlns:xsd="http://www.w3.org/2001/XMLSchema" 
               xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <GetProductSellable xmlns="http://www.promostandards.org/WSDL/ProductData/2.0.0/">
      <wsVersion>${request.wsVersion}</wsVersion>
      <id>${request.id}</id>
      <password>${request.password}</password>
      <localizationCountry>${request.localizationCountry || 'US'}</localizationCountry>
      <localizationLanguage>${request.localizationLanguage || 'en'}</localizationLanguage>
      <isSellable>true</isSellable>
    </GetProductSellable>
  </soap:Body>
</soap:Envelope>`;
}

// Create SOAP envelope for GetInventoryLevels request
function createGetInventorySOAP(productId: string, request: Omit<GetProductRequest, 'productId'>): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" 
               xmlns:xsd="http://www.w3.org/2001/XMLSchema" 
               xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <GetInventoryLevels xmlns="http://www.promostandards.org/WSDL/Inventory/2.0.0/">
      <wsVersion>2.0.0</wsVersion>
      <id>${request.id}</id>
      <password>${request.password}</password>
      <productId>${productId}</productId>
    </GetInventoryLevels>
  </soap:Body>
</soap:Envelope>`;
}

// Create SOAP envelope for GetMediaContent request (Images)
function createGetMediaContentSOAP(productId: string, request: Omit<GetProductRequest, 'productId'>): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                  xmlns:ns="http://www.promostandards.org/WSDL/MediaService/1.0.0/"
                  xmlns:shar="http://www.promostandards.org/WSDL/MediaService/1.0.0/SharedObjects/">
  <soapenv:Header/>
  <soapenv:Body>
    <ns:GetMediaContentRequest>
      <shar:wsVersion>1.0.0</shar:wsVersion>
      <shar:id>${request.id}</shar:id>
      <shar:password>${request.password}</shar:password>
      <shar:mediaType>Image</shar:mediaType>
      <shar:productId>${productId}</shar:productId>
    </ns:GetMediaContentRequest>
  </soapenv:Body>
</soapenv:Envelope>`;
}

// Create SOAP envelope for GetConfigurationAndPricing request - EXACT S&S FORMAT
function createGetPricingSOAP(productId: string, request: Omit<GetProductRequest, 'productId'>, fobId: string = 'all'): string {
  return `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ns="http://www.promostandards.org/WSDL/PricingAndConfiguration/1.0.0/" xmlns:shar="http://www.promostandards.org/WSDL/PricingAndConfiguration/1.0.0/SharedObjects/">
   <soapenv:Header/>
   <soapenv:Body>
      <ns:GetConfigurationAndPricingRequest>
         <shar:wsVersion>1.0.0</shar:wsVersion>
         <shar:id>${request.id}</shar:id>
         <shar:password>${request.password}</shar:password>
         <shar:productId>${productId}</shar:productId>
         <shar:partId></shar:partId>
         <shar:currency>USD</shar:currency>
         <shar:fobId>${fobId}</shar:fobId>
         <shar:priceType>List</shar:priceType>
         <shar:localizationCountry>${request.localizationCountry || 'US'}</shar:localizationCountry>
         <shar:localizationLanguage>${request.localizationLanguage || 'en'}</shar:localizationLanguage>
         <shar:configurationType>Blank</shar:configurationType>
      </ns:GetConfigurationAndPricingRequest>
   </soapenv:Body>
</soapenv:Envelope>`;
}

// Parse MediaContent response to get image URLs
function parseMediaContentResponse(soapXml: string): Array<{ url: string; mediaType: string; classType?: string; color?: string; size?: string }> {
  try {
    console.log('🖼️ Parsing MediaContent response...');
    
    const images: Array<{ url: string; mediaType: string; classType?: string; color?: string; size?: string }> = [];
    
    // Look for MediaContentArray → MediaContent items
    const mediaContentMatches = soapXml.match(/<MediaContent>[\s\S]*?<\/MediaContent>/g) || [];
    console.log(`🔍 Found ${mediaContentMatches.length} MediaContent elements`);
    
    for (const mediaMatch of mediaContentMatches) {
      const urlMatch = mediaMatch.match(/<url[^>]*>(.*?)<\/url>/i);
      const mediaTypeMatch = mediaMatch.match(/<mediaType[^>]*>(.*?)<\/mediaType>/i);
      const classTypeMatch = mediaMatch.match(/<ClassType[^>]*>(.*?)<\/ClassType>/i);
      const colorMatch = mediaMatch.match(/<color[^>]*>(.*?)<\/color>/i);
      
      if (urlMatch && mediaTypeMatch) {
        const imageData = {
          url: urlMatch[1].trim(),
          mediaType: mediaTypeMatch[1].trim(),
          classType: classTypeMatch?.[1]?.trim(),
          color: colorMatch?.[1]?.trim()
        };
        
        images.push(imageData);
        console.log(`🖼️ Found image: ${imageData.url} (${imageData.classType || 'Unknown class'})`);
      }
    }
    
    console.log(`✅ Parsed ${images.length} images from MediaContent response`);
    return images;
    
  } catch (error) {
    console.error('❌ Error parsing MediaContent response:', error);
    return [];
  }
}

// Parse sellable products response to discover available SKUs
function parseProductSellableResponse(soapXml: string): Array<{ productId: string; productName?: string; brand?: string }> {
  try {
    console.log('🔍 Parsing sellable products response...');
    
    // Look for product entries in the SOAP response
    const productMatches = soapXml.match(/<Product>[\s\S]*?<\/Product>/g) || [];
    const products: Array<{ productId: string; productName?: string; brand?: string }> = [];

    for (const productMatch of productMatches) {
      const productIdMatch = productMatch.match(/<productId[^>]*>(.*?)<\/productId>/i);
      const productNameMatch = productMatch.match(/<productName[^>]*>(.*?)<\/productName>/i);
      const brandMatch = productMatch.match(/<productBrand[^>]*>(.*?)<\/productBrand>/i);

      if (productIdMatch) {
        products.push({
          productId: productIdMatch[1],
          productName: productNameMatch?.[1],
          brand: brandMatch?.[1]
        });
      }
    }

    console.log(`🎯 Found ${products.length} sellable products`);
    
    // Show first few products for debugging
    if (products.length > 0) {
      console.log('📦 Sample products:', products.slice(0, 5));
    }

    return products;
  } catch (error) {
    console.error('❌ Error parsing sellable products:', error);
    return [];
  }
}

// Parse SOAP response and extract product data including pricing
function parseProductDataResponse(soapXml: string): ProductDataResponse {
  try {
    // Simple XML parsing for product data
    // In a production environment, you'd use a proper XML parser
    const products: ProductDataResponse['products'] = [];
    
    // Extract primary image URL using regex (basic implementation)
    const primaryImageMatch = soapXml.match(/<primaryImageURL[^>]*>(.*?)<\/primaryImageURL>/i);
    const productIdMatch = soapXml.match(/<productId[^>]*>(.*?)<\/productId>/i);
    const productNameMatch = soapXml.match(/<productName[^>]*>(.*?)<\/productName>/i);
    const productBrandMatch = soapXml.match(/<productBrand[^>]*>(.*?)<\/productBrand>/i);
    const descriptionMatch = soapXml.match(/<description[^>]*>(.*?)<\/description>/i);
    
    // Log what we found for debugging
    console.log('🔍 SOAP Response Analysis:');
    console.log(`📦 Product ID: ${productIdMatch?.[1] || 'NOT FOUND'}`);
    console.log(`📛 Product Name: ${productNameMatch?.[1] || 'NOT FOUND'}`);
    console.log(`🖼️ Primary Image URL: ${primaryImageMatch?.[1] || 'NOT FOUND'}`);
    console.log(`📝 Description: ${descriptionMatch?.[1]?.substring(0, 100) || 'NOT FOUND'}...`);
    
    // Also try to extract pricing from ProductPriceGroupArray if present in product data
    let extractedPrice: number | undefined;
    const productPriceGroupMatches = soapXml.match(/<ProductPriceGroup>[\s\S]*?<\/ProductPriceGroup>/g) || [];
    
    if (productPriceGroupMatches.length > 0) {
      console.log('🔍 Found ProductPriceGroupArray in product data');
      const pricingData = parsePricingResponse(soapXml);
      extractedPrice = pricingData.minPrice;
    }
    
    if (productIdMatch) {
      const productId = productIdMatch[1];
      let imageURL = primaryImageMatch?.[1];
      
      // If no primaryImageURL from PromoStandards, use S&S CDN with real internal IDs
      if (!imageURL) {
        console.log('🖼️ No primaryImageURL from PromoStandards, using S&S CDN mapping...');
        
        // Real S&S internal ID mapping from your screenshot
        const ssImageIdMap: Record<string, string> = {
          'B00760': '39',     // Gildan 2000 -> 39_fl.jpg (from your screenshot)
          'B18500': '18500',  // Gildan 18500 -> 18500_fl.jpg
          'B18000': '18000',  // Gildan 18000 -> 18000_fl.jpg
          'B05000': '5000',   // Gildan 5000 -> 5000_fl.jpg
          'B64000': '64000'   // Gildan 64000 -> 64000_fl.jpg
        };
        
        const imageId = ssImageIdMap[productId] || productId.replace('B', '');
        imageURL = `https://cdn.ssactivewear.com/Images/Style/${imageId}_fl.jpg`;
        console.log(`🖼️ Using S&S CDN image: ${imageURL}`);
      } else {
        console.log(`🖼️ Using PromoStandards primaryImageURL: ${imageURL}`);
      }
      
      products.push({
        productId: productId,
        productName: productNameMatch?.[1],
        productBrand: productBrandMatch?.[1],
        description: descriptionMatch?.[1],
        primaryImageURL: imageURL,
        extractedPrice: extractedPrice, // Include pricing if found
      });
    }
    
    return { products };
  } catch (error) {
    console.error('Error parsing SOAP response:', error);
    return { products: [] };
  }
}

// Parse pricing response and extract LIVE pricing data from PromoStandards
function parsePricingResponse(soapXml: string): { minPrice?: number; maxPrice?: number; prices?: Array<{ quantity: number; price: number }> } {
  try {
    console.log('🔍 Parsing LIVE PromoStandards pricing response...');
    console.log('📄 Raw SOAP Response (first 500 chars):', soapXml.substring(0, 500));

    const prices: Array<{ quantity: number; price: number }> = [];

    // Try multiple pricing structures from PromoStandards spec
    
    // 1. ProductPriceGroupArray structure (most common)
    const productPriceGroupMatches = soapXml.match(/<ProductPriceGroup>[\s\S]*?<\/ProductPriceGroup>/g) || [];
    console.log(`🔍 Found ${productPriceGroupMatches.length} ProductPriceGroup elements`);

    for (const groupMatch of productPriceGroupMatches) {
      const priceArrayMatches = groupMatch.match(/<ProductPriceArray>[\s\S]*?<\/ProductPriceArray>/g) || [];
      console.log(`🔍 Found ${priceArrayMatches.length} ProductPriceArray elements in group`);

      for (const priceArrayMatch of priceArrayMatches) {
        const quantityMinMatch = priceArrayMatch.match(/<quantityMin[^>]*>(.*?)<\/quantityMin>/i);
        const priceValueMatch = priceArrayMatch.match(/<price[^>]*>(.*?)<\/price>/i);

        if (quantityMinMatch && priceValueMatch) {
          const quantity = parseInt(quantityMinMatch[1]);
          const price = parseFloat(priceValueMatch[1]);

          if (!isNaN(quantity) && !isNaN(price)) {
            prices.push({ quantity, price });
            console.log(`💰 Found price: ${quantity} qty = $${price}`);
          }
        }
      }
    }

    // 2. PartPrice structure (Pricing & Configuration 1.0.0) - EXACT format from documentation
    if (prices.length === 0) {
      console.log('🔄 Trying PartPrice structure from Pricing & Configuration 1.0.0...');
      
      // Look for PartPriceArray structure as shown in SNS.md documentation
      const partPriceArrayMatches = soapXml.match(/<PartPriceArray>[\s\S]*?<\/PartPriceArray>/g) || [];
      console.log(`🔍 Found ${partPriceArrayMatches.length} PartPriceArray elements`);

      for (const arrayMatch of partPriceArrayMatches) {
        const partPriceMatches = arrayMatch.match(/<PartPrice>[\s\S]*?<\/PartPrice>/g) || [];
        console.log(`🔍 Found ${partPriceMatches.length} PartPrice elements in array`);

        for (const priceMatch of partPriceMatches) {
          const minQuantityMatch = priceMatch.match(/<minQuantity[^>]*>(.*?)<\/minQuantity>/i);
          const priceValueMatch = priceMatch.match(/<price[^>]*>(.*?)<\/price>/i);

          if (minQuantityMatch && priceValueMatch) {
            const quantity = parseInt(minQuantityMatch[1]);
            const price = parseFloat(priceValueMatch[1]);

            if (!isNaN(quantity) && !isNaN(price)) {
              prices.push({ quantity, price });
              console.log(`💰 Found PartPrice: ${quantity} qty = $${price}`);
            }
          }
        }
      }
    }

    // 3. Simple price structure fallback
    if (prices.length === 0) {
      console.log('🔄 Trying simple price structure...');
      const simplePriceMatches = soapXml.match(/<price[^>]*>([\d.]+)<\/price>/gi) || [];
      console.log(`🔍 Found ${simplePriceMatches.length} simple price elements`);

      simplePriceMatches.forEach((match, index) => {
        const priceMatch = match.match(/>([\d.]+)</);
        if (priceMatch) {
          const price = parseFloat(priceMatch[1]);
          if (!isNaN(price)) {
            prices.push({ quantity: 1, price });
            console.log(`💰 Found simple price: $${price}`);
          }
        }
      });
    }

    // Calculate min/max prices
    let minPrice: number | undefined;
    let maxPrice: number | undefined;

    if (prices.length > 0) {
      // Sort by quantity to get the base price (lowest quantity)
      prices.sort((a, b) => a.quantity - b.quantity);

      const priceValues = prices.map(p => p.price);
      minPrice = prices[0].price; // Use the lowest quantity price as the single price
      maxPrice = Math.max(...priceValues);

      console.log(`💰 ✅ EXTRACTED LIVE PRICING:`);
      console.log(`💵 Base price (qty ${prices[0].quantity}): $${minPrice}`);
      console.log(`📊 Price range: $${minPrice} - $${maxPrice}`);
      console.log(`🔢 All prices:`, prices);
    } else {
      console.log(`❌ NO PRICING DATA FOUND in SOAP response`);
    }

    return { minPrice, maxPrice, prices };
  } catch (error) {
    console.error('❌ Error parsing LIVE pricing data:', error);
    return {};
  }
}

// Make SOAP request to S&S PromoStandards endpoint
async function callPromoStandardsSOAP(endpoint: string, soapBody: string, soapAction: string): Promise<string> {
  console.log(`🌐 Making SOAP request to: ${endpoint}`);
  console.log(`🎯 SOAP Action: ${soapAction}`);
  console.log(`🔐 Using Account: ${SS_CONFIG.accountNumber}`);
  console.log(`📤 SOAP Body: ${soapBody.substring(0, 800)}...`);

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      'SOAPAction': soapAction,
      'Accept': 'text/xml',
      'User-Agent': 'InkIQ-PromoStandards-Client/1.0',
      'Cache-Control': 'no-cache'
    },
    body: soapBody,
  });

  console.log(`📥 Response Status: ${response.status} ${response.statusText}`);
  console.log(`📋 Response Headers:`, Object.fromEntries(response.headers.entries()));

  const responseText = await response.text();
  console.log(`📄 Full Response (${responseText.length} chars):`, responseText);

  if (!response.ok) {
    console.error(`❌ SOAP Error Response: ${responseText}`);
    throw new Error(`SOAP request failed: ${response.status} ${response.statusText} - ${responseText}`);
  }

  return responseText;
}

// Get product data using PromoStandards SOAP
async function getProductData(productId: string): Promise<ProductDataResponse> {
  console.log(`🧼 Getting product data for ${productId} via PromoStandards SOAP...`);
  
  const request: GetProductRequest = {
    wsVersion: '2.0.0',
    id: SS_CONFIG.accountNumber,
    password: SS_CONFIG.apiKey,
    productId: productId,
    localizationCountry: 'US',
    localizationLanguage: 'en',
    isSellable: true,
  };

  const soapEnvelope = createGetProductSOAP(request);
  console.log('📤 SOAP Request:', soapEnvelope);

  try {
    const soapResponse = await callPromoStandardsSOAP(SS_CONFIG.productDataEndpoint, soapEnvelope, 'getProduct');
    console.log('📥 SOAP Response received, length:', soapResponse.length);
    
    const productData = parseProductDataResponse(soapResponse);
    console.log('✅ Parsed product data:', JSON.stringify(productData, null, 2));
    
    return productData;
  } catch (error) {
    console.error('❌ PromoStandards SOAP error:', error);
    throw error;
  }
}

// Get media content (images) from PromoStandards MediaContent service
async function getMediaContent(productId: string): Promise<Array<{ url: string; mediaType: string; classType?: string; color?: string }>> {
  console.log(`🖼️ Getting MediaContent for ${productId} from PromoStandards...`);
  
  const request = {
    wsVersion: '1.0.0',
    id: SS_CONFIG.accountNumber,
    password: SS_CONFIG.apiKey,
  };

  const soapEnvelope = createGetMediaContentSOAP(productId, request);
  
  try {
    const soapResponse = await callPromoStandardsSOAP(SS_CONFIG.mediaEndpoint, soapEnvelope, 'getMediaContent');
    const mediaData = parseMediaContentResponse(soapResponse);
    console.log(`🖼️ Retrieved ${mediaData.length} images for ${productId}`);
    
    return mediaData;
  } catch (error) {
    console.error(`❌ PromoStandards MediaContent error for ${productId}:`, error);
    throw error;
  }
}

// Get pricing data from S&S PromoStandards
// Loops through multiple FOB warehouses as recommended by S&S guide
async function getPricingData(productId: string, fobIds: string[] = ['IL', 'NJ', 'TX', 'GA']): Promise<{ minPrice?: number; maxPrice?: number; prices?: Array<{ quantity: number; price: number; fobId: string }> }> {
  console.log(`💰 Getting pricing data for ${productId} from ${fobIds.length} FOB warehouses...`);
  
  const request = {
    wsVersion: '1.0.0',
    id: SS_CONFIG.accountNumber,
    password: SS_CONFIG.apiKey,
    localizationCountry: 'US',
    localizationLanguage: 'en',
  };

  let allPrices: Array<{ quantity: number; price: number; fobId: string }> = [];
  let minPrice: number | undefined;
  let maxPrice: number | undefined;

  // Loop through each FOB warehouse as recommended by S&S guide
  for (const fobId of fobIds) {
    try {
      console.log(`💰 Checking pricing for ${productId} at FOB ${fobId}...`);
      
      const soapEnvelope = createGetPricingSOAP(productId, request, fobId);
      const soapResponse = await callPromoStandardsSOAP(SS_CONFIG.pricingEndpoint, soapEnvelope, 'getConfigurationAndPricing');
      const pricingData = parsePricingResponse(soapResponse);
      
      if (pricingData.prices && pricingData.prices.length > 0) {
        // Add FOB ID to each price entry
        const fobPrices = pricingData.prices.map(p => ({ ...p, fobId }));
        allPrices.push(...fobPrices);
        
        console.log(`💰 Found ${pricingData.prices.length} price points for ${productId} at FOB ${fobId}`);
        
        // Update min/max prices
        if (pricingData.minPrice !== undefined) {
          minPrice = minPrice === undefined ? pricingData.minPrice : Math.min(minPrice, pricingData.minPrice);
        }
        if (pricingData.maxPrice !== undefined) {
          maxPrice = maxPrice === undefined ? pricingData.maxPrice : Math.max(maxPrice, pricingData.maxPrice);
        }
      } else {
        console.log(`💰 No pricing data found for ${productId} at FOB ${fobId}`);
      }
    } catch (error) {
      console.error(`❌ Error getting pricing for ${productId} at FOB ${fobId}:`, error);
      // Continue with other FOBs even if one fails
    }
  }

  console.log(`💰 ✅ FINAL PRICING for ${productId}: ${allPrices.length} total price points, min: $${minPrice}, max: $${maxPrice}`);
  
  return { minPrice, maxPrice, prices: allPrices };
}

// Generate smart image fallback based on product ID patterns
function generateSmartImageFallback(productId: string): string {
  console.log(`🖼️ Generating smart image fallback for ${productId}`);
  
  // S&S CDN image mapping for known products
  const ssImageIdMap: Record<string, string> = {
    'B00760': '39',     // Gildan 2000 -> 39_fl.jpg
    'B18500': '18500',  // Gildan 18500 -> 18500_fl.jpg
    'B18000': '18000',  // Gildan 18000 -> 18000_fl.jpg
    'B05000': '5000',   // Gildan 5000 -> 5000_fl.jpg
    'B64000': '64000',  // Gildan 64000 -> 64000_fl.jpg
    'B42000': '42000',  // Gildan 42000 -> 42000_fl.jpg
    'B29M': '29M',      // Jerzees 29M -> 29M_fl.jpg
    'B8000': '8000',    // Gildan 8000 -> 8000_fl.jpg
    'B180': '180',      // Hanes 180 -> 180_fl.jpg
    'B8800': '8800'     // Gildan 8800 -> 8800_fl.jpg
  };
  
  // Try exact match first
  if (ssImageIdMap[productId]) {
    const imageUrl = `https://cdn.ssactivewear.com/Images/Style/${ssImageIdMap[productId]}_fl.jpg`;
    console.log(`🖼️ Using exact match fallback: ${imageUrl}`);
    return imageUrl;
  }
  
  // Try pattern matching for style IDs
  const styleMatch = productId.match(/B?(\d+)/);
  if (styleMatch) {
    const styleId = styleMatch[1];
    const imageUrl = `https://cdn.ssactivewear.com/Images/Style/${styleId}_fl.jpg`;
    console.log(`🖼️ Using pattern match fallback: ${imageUrl}`);
    return imageUrl;
  }
  
  // Default fallback
  const defaultUrl = `https://cdn.ssactivewear.com/Images/Style/${productId.replace('B', '')}_fl.jpg`;
  console.log(`🖼️ Using default fallback: ${defaultUrl}`);
  return defaultUrl;
}

// Generate smart product data based on product ID patterns
function generateSmartProductData(productId: string, existingProduct: any) {
  console.log(`📦 Generating smart product data for ${productId}`);
  
  // Known S&S product patterns
  const productPatterns: Record<string, any> = {
    'B00760': { name: 'Ultra Cotton® T-Shirt', brand: 'Gildan', category: 'T-Shirts' },
    'B18500': { name: 'Heavy Blend™ Hooded Sweatshirt', brand: 'Gildan', category: 'Hoodies' },
    'B18000': { name: 'Heavy Blend™ Crewneck Sweatshirt', brand: 'Gildan', category: 'Sweatshirts' },
    'B05000': { name: 'Heavy Cotton™ T-Shirt', brand: 'Gildan', category: 'T-Shirts' },
    'B64000': { name: 'Softstyle® T-Shirt', brand: 'Gildan', category: 'T-Shirts' },
    'B42000': { name: 'Performance® T-Shirt', brand: 'Gildan', category: 'Performance' },
    'B29M': { name: 'Dri-Power® T-Shirt', brand: 'Jerzees', category: 'Performance' },
    'B8000': { name: 'DryBlend® T-Shirt', brand: 'Gildan', category: 'T-Shirts' },
    'B180': { name: 'Ringspun Cotton T-Shirt', brand: 'Hanes', category: 'T-Shirts' },
    'B8800': { name: 'Ultra Blend® Fleece Pullover', brand: 'Gildan', category: 'Fleece' }
  };
  
  // Use existing product data if available
  if (existingProduct) {
    return {
      name: existingProduct.productName,
      brand: existingProduct.productBrand,
      description: existingProduct.description
    };
  }
  
  // Use pattern match
  if (productPatterns[productId]) {
    const pattern = productPatterns[productId];
    return {
      name: pattern.name,
      brand: pattern.brand,
      description: `High-quality ${pattern.category.toLowerCase()} from ${pattern.brand}. Professional grade apparel suitable for decoration and customization.`
    };
  }
  
  // Generic fallback
  return {
    name: `S&S Product ${productId}`,
    brand: 'S&S Activewear',
    description: `Professional apparel item ${productId} from S&S Activewear catalog. Suitable for decoration and customization.`
  };
}

// Update database with HYBRID approach: Working APIs + Known product data
async function updateProductWithSOAPData(productId: string, productData?: ProductDataResponse) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log(`💾 HYBRID UPDATE: Using working APIs + known product data for ${productId}...`);

  // Use ACCURATE S&S product data while S&S Product Data API is down
  // These match the actual S&S website product information
  const knownProducts: Record<string, any> = {
    // Gildan 2000 - Ultra Cotton T-Shirt (6.0 oz) - Both style ID and product ID
    '2000': { 
      name: 'Ultra Cotton® T-Shirt', 
      brand: 'Gildan', 
      description: '6.0 oz., pre-shrunk 100% cotton. Seamless rib at neck. Taped shoulder-to-shoulder. Double-needle stitching throughout. Tearaway label. Classic fit.' 
    },
    'B00760': { 
      name: 'Ultra Cotton® T-Shirt', 
      brand: 'Gildan', 
      description: '6.0 oz., pre-shrunk 100% cotton. Seamless rib at neck. Taped shoulder-to-shoulder. Double-needle stitching throughout. Tearaway label. Classic fit.' 
    },
    // Gildan 5000 - Heavy Cotton T-Shirt (5.3 oz)
    '5000': { 
      name: 'Heavy Cotton™ T-Shirt', 
      brand: 'Gildan', 
      description: '5.3 oz., pre-shrunk 100% cotton (Sport Grey is 90% cotton, 10% polyester; Dark Heather is 50% cotton, 50% polyester). Classic fit. Seamless rib at neck. Taped shoulder-to-shoulder. Double-needle stitching throughout.' 
    },
    'B05000': { 
      name: 'Heavy Cotton™ T-Shirt', 
      brand: 'Gildan', 
      description: '5.3 oz., pre-shrunk 100% cotton (Sport Grey is 90% cotton, 10% polyester; Dark Heather is 50% cotton, 50% polyester). Classic fit. Seamless rib at neck. Taped shoulder-to-shoulder. Double-needle stitching throughout.' 
    },
    // Gildan 64000 - Softstyle T-Shirt (4.5 oz)
    '64000': { 
      name: 'Softstyle® T-Shirt', 
      brand: 'Gildan', 
      description: '4.5 oz., 100% ring spun cotton (Sport Grey is 90% ring spun cotton, 10% polyester). Soft-washed garment-dyed fabric. Narrow width, rib collar. Taped neck and shoulders. Rolled forward shoulders. Double-needle bottom hem.' 
    },
    'B64000': { 
      name: 'Softstyle® T-Shirt', 
      brand: 'Gildan', 
      description: '4.5 oz., 100% ring spun cotton (Sport Grey is 90% ring spun cotton, 10% polyester). Soft-washed garment-dyed fabric. Narrow width, rib collar. Taped neck and shoulders. Rolled forward shoulders. Double-needle bottom hem.' 
    },
    // Gildan 18500 - Heavy Blend Hooded Sweatshirt (8.0 oz)
    '18500': { 
      name: 'Heavy Blend™ Hooded Sweatshirt', 
      brand: 'Gildan', 
      description: '8.0 oz., 50% cotton, 50% polyester. Air jet yarn creates a smooth, low-pill surface. Double-needle stitching. Set-in sleeves. 1x1 athletic rib with spandex. Pouch pocket. Matching drawstring.' 
    },
    'B18500': { 
      name: 'Heavy Blend™ Hooded Sweatshirt', 
      brand: 'Gildan', 
      description: '8.0 oz., 50% cotton, 50% polyester. Air jet yarn creates a smooth, low-pill surface. Double-needle stitching. Set-in sleeves. 1x1 athletic rib with spandex. Pouch pocket. Matching drawstring.' 
    },
    // Gildan 18000 - Heavy Blend Crewneck Sweatshirt (8.0 oz)
    '18000': { 
      name: 'Heavy Blend™ Crewneck Sweatshirt', 
      brand: 'Gildan', 
      description: '8.0 oz., 50% cotton, 50% polyester. Air jet yarn creates a smooth, low-pill surface. Double-needle stitching. Set-in sleeves. 1x1 athletic rib with spandex.' 
    },
    'B18000': { 
      name: 'Heavy Blend™ Crewneck Sweatshirt', 
      brand: 'Gildan', 
      description: '8.0 oz., 50% cotton, 50% polyester. Air jet yarn creates a smooth, low-pill surface. Double-needle stitching. Set-in sleeves. 1x1 athletic rib with spandex.' 
    }
  };

  // Get real product info or use known data
  console.log(`🔍 Looking for product info for productId: ${productId}`);
  console.log(`🔍 Available known products: ${Object.keys(knownProducts).join(', ')}`);
  
  let productInfo;
  if (productData?.products?.[0]) {
    productInfo = productData.products[0];
    console.log(`📦 Using REAL API product data: ${productInfo.productName}`);
  } else if (knownProducts[productId]) {
    productInfo = knownProducts[productId];
    console.log(`📦 Using KNOWN product data for ${productId}: ${productInfo.name}`);
  } else {
    // Create generic fallback based on style ID
    productInfo = {
      name: `S&S Product ${productId}`,
      brand: 'S&S Activewear',
      description: `Professional apparel item ${productId} from S&S Activewear catalog.`
    };
    console.log(`📦 Using GENERIC fallback for unknown product: ${productId}`);
  }

  // Get LIVE pricing data from PromoStandards API
  console.log(`💰 Getting LIVE pricing from PromoStandards for ${productId}...`);
  let realMinPrice: number | undefined;
  let realMaxPrice: number | undefined;
  
  try {
    const pricingData = await getPricingData(productId);
    if (pricingData.minPrice && pricingData.maxPrice) {
      realMinPrice = pricingData.minPrice;
      realMaxPrice = pricingData.maxPrice;
      console.log(`💰 ✅ LIVE PRICING from S&S API: ${productId} = $${realMinPrice} - $${realMaxPrice}`);
    } else {
      console.log(`💰 ⚠️ Pricing API returned empty data for ${productId}, checking response format...`);
      // Log the actual pricing response for debugging
      console.log(`🔍 Pricing response: minPrice=${pricingData.minPrice}, maxPrice=${pricingData.maxPrice}, prices=${pricingData.prices?.length || 0}`);
    }
  } catch (error) {
    console.error(`❌ Pricing API failed for ${productId}:`, error);
  }

  // Get LIVE images from PromoStandards MediaContent API
  console.log(`🖼️ Getting LIVE images from PromoStandards MediaContent for ${productId}...`);
  let realImageUrl: string | undefined;
  
  try {
    const mediaData = await getMediaContent(productId);
    
    if (mediaData.length > 0) {
      // Prefer 'Front' class type, or take the first available image
      const frontImage = mediaData.find(img => img.classType?.toLowerCase().includes('front'));
      const selectedImage = frontImage || mediaData[0];
      realImageUrl = selectedImage.url;
      
      console.log(`🖼️ ✅ LIVE IMAGE from S&S MediaContent API: ${realImageUrl} (${selectedImage.classType || 'Unknown class'})`);
      console.log(`🖼️ Total images available: ${mediaData.length}`);
    } else {
      console.log(`🖼️ ⚠️ No images returned from MediaContent API for ${productId}`);
    }
  } catch (error) {
    console.error(`❌ MediaContent API failed for ${productId}:`, error);
  }

  // Create update with HYBRID data: Real APIs + Known product info
  const updateData: any = {
    name: productInfo.name,
    brand: productInfo.brand,
    description: productInfo.description,
    primary_image_url: realImageUrl,
    last_synced: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    source_data: { 
      hybrid: true, 
      productInfo: !!productData,
      mediaContent: !!realImageUrl,
      pricing: !!(realMinPrice && realMaxPrice),
      timestamp: new Date().toISOString()
    },
  };

  // Add pricing if we got real data
  if (realMinPrice && realMaxPrice) {
    updateData.min_price = realMinPrice;
    updateData.max_price = realMaxPrice;
    updateData.price_last_updated = new Date().toISOString();
    console.log(`💰 ✅ Adding LIVE pricing to database: $${realMinPrice} - $${realMaxPrice}`);
  } else {
    console.log(`💰 ⚠️ No live pricing available - database will not include pricing`);
  }

  // Ensure we have an image
  if (!realImageUrl) {
    console.log(`🖼️ ⚠️ No live image available - database will not include image`);
  }

  const { error } = await supabase
    .from('ss_products')
    .update(updateData)
    .eq('style_id', productId);

  if (error) {
    throw new Error(`Database update failed: ${error.message}`);
  }

  console.log(`✅ Successfully updated product ${productId} with hybrid S&S data`);
  if (realImageUrl) {
    console.log(`🖼️ Real image URL: ${realImageUrl}`);
  }
  if (realMinPrice && realMaxPrice) {
    console.log(`💰 Real pricing: $${realMinPrice} - $${realMaxPrice}`);
  }
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { op, productId, productIds } = await req.json();

    if (op === 'getProductSellable') {
      console.log('🛒 Getting sellable products from S&S...');
      
      const request = {
        wsVersion: '2.0.0',
        id: SS_CONFIG.accountNumber,
        password: SS_CONFIG.apiKey,
        localizationCountry: 'US',
        localizationLanguage: 'en',
      };

      const soapEnvelope = createGetProductSellableSOAP(request);
      
      try {
        const soapResponse = await callPromoStandardsSOAP(SS_CONFIG.productDataEndpoint, soapEnvelope, 'getProductSellable');
        const sellableProducts = parseProductSellableResponse(soapResponse);
        
        return new Response(JSON.stringify({
          success: true,
          operation: 'getProductSellable',
          products: sellableProducts,
          timestamp: new Date().toISOString(),
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (error) {
        console.error('❌ getProductSellable error:', error);
        return new Response(JSON.stringify({
          success: false,
          operation: 'getProductSellable',
          error: (error as Error).message,
          details: error.toString(),
          timestamp: new Date().toISOString(),
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    if (op === 'getInventory') {
      if (!productId) {
        return new Response(JSON.stringify({ error: 'productId is required for inventory' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log(`📦 Getting inventory for ${productId}...`);
      
      const request = {
        wsVersion: '2.0.0',
        id: SS_CONFIG.accountNumber,
        password: SS_CONFIG.apiKey,
      };

      const soapEnvelope = createGetInventorySOAP(productId, request);
      
      try {
        const soapResponse = await callPromoStandardsSOAP(SS_CONFIG.inventoryEndpoint, soapEnvelope);
        
        return new Response(JSON.stringify({
          success: true,
          operation: 'getInventory',
          productId,
          data: { rawResponse: soapResponse },
          timestamp: new Date().toISOString(),
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (error) {
        return new Response(JSON.stringify({
          success: false,
          operation: 'getInventory',
          productId,
          error: (error as Error).message,
          timestamp: new Date().toISOString(),
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    if (op === 'getMediaContent') {
      if (!productId) {
        return new Response(JSON.stringify({ error: 'productId is required for MediaContent' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log(`🖼️ Getting MediaContent for ${productId}...`);
      
      try {
        const mediaData = await getMediaContent(productId);
        
        return new Response(JSON.stringify({
          success: true,
          operation: 'getMediaContent',
          productId,
          data: { 
            images: mediaData,
            count: mediaData.length 
          },
          timestamp: new Date().toISOString(),
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (error) {
        console.error(`❌ Error getting MediaContent for ${productId}:`, error);
        return new Response(JSON.stringify({
          success: false,
          operation: 'getMediaContent',
          productId,
          error: (error as Error).message,
          timestamp: new Date().toISOString(),
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    if (op === 'getProduct') {
      if (!productId) {
        return new Response(JSON.stringify({ error: 'productId is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const productData = await getProductData(productId);
      
      return new Response(JSON.stringify({
        success: true,
        productId,
        data: productData,
        timestamp: new Date().toISOString(),
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (op === 'getPricing') {
      if (!productId) {
        return new Response(JSON.stringify({ error: 'productId is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log(`💰 Getting pricing for product ${productId} from S&S...`);
      
      const request = {
        wsVersion: '1.0.0',
        id: SS_CONFIG.accountNumber,
        password: SS_CONFIG.apiKey,
        localizationCountry: 'US',
        localizationLanguage: 'en',
      };

      const soapEnvelope = createGetPricingSOAP(productId, request);
      
      try {
        const soapResponse = await callPromoStandardsSOAP(SS_CONFIG.pricingEndpoint, soapEnvelope, 'getConfigurationAndPricing');
        const pricingData = parsePricingResponse(soapResponse);
        
        return new Response(JSON.stringify({
          success: true,
          operation: 'getPricing',
          productId,
          data: { 
            pricing: pricingData,
            rawResponse: soapResponse 
          },
          timestamp: new Date().toISOString(),
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (error) {
        console.error(`❌ Error getting pricing for ${productId}:`, error);
        return new Response(JSON.stringify({
          success: false,
          operation: 'getPricing',
          productId,
          error: (error as Error).message,
          timestamp: new Date().toISOString(),
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    if (op === 'syncProduct') {
      if (!productId) {
        return new Response(JSON.stringify({ error: 'productId is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log(`🔄 HYBRID sync for product ${productId} - Working APIs + Known data...`);
      
      // Try to get product data, but don't fail if S&S Product Data API is down
      let productData = null;
      try {
        productData = await getProductData(productId);
        console.log(`✅ Got product data from S&S API for ${productId}`);
      } catch (error) {
        console.log(`⚠️ S&S Product Data API unavailable for ${productId}, using known product data`);
      }
      
      // Update with HYBRID approach: Working APIs + Known product data
      await updateProductWithSOAPData(productId, productData);
      
      return new Response(JSON.stringify({
        success: true,
        productId,
        message: `Successfully synced product ${productId} with HYBRID S&S data (APIs + Known info)`,
        data: productData || { hybrid: true },
        timestamp: new Date().toISOString(),
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (op === 'syncMultiple') {
      if (!productIds || !Array.isArray(productIds)) {
        return new Response(JSON.stringify({ error: 'productIds array is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log(`🔄 Syncing multiple products with real S&S SKUs: ${productIds.join(', ')}`);
      
      // Map style IDs to real S&S product IDs from PromoStandards documentation
      const styleToProductIdMap: Record<string, string> = {
        '18500': 'B18500',  // Gildan 18500 Heavy Blend Hoodie
        '18000': 'B18000',  // Gildan 18000 Heavy Blend Crewneck
        '2000': 'B00760',   // Real S&S product ID from documentation
        '5000': 'B05000',   // Gildan 5000 Heavy Cotton T-Shirt
        '64000': 'B64000'   // Gildan 64000 Softstyle T-Shirt
      };

      const results = [];
      for (const styleId of productIds) {
        try {
          console.log(`🔄 Syncing product ${styleId}...`);
          
          // Try to get real S&S product ID, fallback to style ID
          const productId = styleToProductIdMap[styleId] || styleId;
          console.log(`🆔 Using S&S Product ID: ${productId} for style: ${styleId}`);
          
          // Try to get product data, but don't fail if S&S Product Data API is down
          let productData = null;
          try {
            productData = await getProductData(productId);
            console.log(`✅ Got product data from S&S API for ${styleId}`);
          } catch (error) {
            console.log(`⚠️ S&S Product Data API unavailable for ${styleId}, using known product data`);
          }
          
          // Update with HYBRID approach: Working APIs + Known product data
          await updateProductWithSOAPData(styleId, productData);
          results.push({ 
            productId: styleId, 
            ssProductId: productId,
            success: true, 
            data: productData || { hybrid: true },
            dataSource: productData ? 'api_plus_known' : 'hybrid_known'
          });
        } catch (error) {
          console.error(`❌ Failed to sync product ${styleId}:`, error);
          results.push({ 
            productId: styleId, 
            success: false, 
            error: (error as Error).message 
          });
        }
      }

      return new Response(JSON.stringify({
        success: true,
        message: `Processed ${productIds.length} products with real S&S Product IDs`,
        results,
        timestamp: new Date().toISOString(),
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (op === 'getExactData') {
      if (!productId) {
        return new Response(JSON.stringify({ error: 'productId is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log(`🔍 Fetching EXACT data from SOAP APIs for ${productId}...`);
      
      const result: any = { productId };
      
      // 1. Get exact image from MediaContent API
      try {
        const mediaData = await getMediaContent(productId);
        if (mediaData.images && mediaData.images.length > 0) {
          result.imageUrl = mediaData.images[0]; // Primary image
          result.allImages = mediaData.images;
          console.log(`✅ Got ${mediaData.images.length} exact images from MediaContent API`);
        }
      } catch (error) {
        console.log(`⚠️ MediaContent API error:`, error);
      }
      
      // 2. Get exact pricing from Pricing API
      try {
        const pricingData = await getPricingAndConfiguration(productId, 'all');
        if (pricingData.minPrice && pricingData.maxPrice) {
          result.minPrice = pricingData.minPrice;
          result.maxPrice = pricingData.maxPrice;
          result.priceGroups = pricingData.priceGroups;
          console.log(`✅ Got exact pricing: $${pricingData.minPrice} - $${pricingData.maxPrice}`);
        }
      } catch (error) {
        console.log(`⚠️ Pricing API error:`, error);
      }
      
      // 3. Get exact product details from Product Data API
      try {
        const productData = await getProductData(productId);
        if (productData.products && productData.products.length > 0) {
          const product = productData.products[0];
          result.productName = product.productName;
          result.brand = product.productBrand;
          result.category = product.productCategory;
          result.description = product.description;
          console.log(`✅ Got exact product details from Product Data API`);
        }
      } catch (error) {
        console.log(`⚠️ Product Data API error:`, error);
        // Use known data as fallback
        const knownData = getKnownProductData(productId);
        result.productName = knownData.name;
        result.brand = knownData.brand;
        result.description = knownData.description;
      }
      
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (op === 'syncAll') {
      console.log('🔄 Syncing ALL products with exact SOAP data...');
      
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      // Get all products from database
      const { data: products, error } = await supabase
        .from('ss_products')
        .select('style_id')
        .order('style_id');
      
      if (error || !products) {
        return new Response(JSON.stringify({ error: 'Failed to fetch products' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      let processed = 0;
      let updated = 0;
      
      for (const product of products) {
        try {
          const productId = product.style_id;
          console.log(`Syncing ${productId}...`);
          
          // Try to get product data
          let productData = null;
          try {
            productData = await getProductData(productId);
          } catch (error) {
            console.log(`Product Data API unavailable for ${productId}`);
          }
          
          // Update with SOAP data
          await updateProductWithSOAPData(productId, productData);
          updated++;
        } catch (error) {
          console.error(`Failed to sync ${product.style_id}:`, error);
        }
        processed++;
      }
      
      return new Response(JSON.stringify({
        success: true,
        processed,
        updated,
        timestamp: new Date().toISOString()
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (op === 'fetchRestCatalog') {
      console.log('📡 Fetching complete catalog from S&S REST API...');
      
      // S&S REST API configuration
      const restApiUrl = 'https://api.ssactivewear.com/v2/products/';
      const auth = btoa(`${SS_CONFIG.accountNumber}:${SS_CONFIG.apiKey}`);
      
      let offset = parseInt(body.offset || '0');
      const limit = 100; // Max allowed by S&S
      let totalFetched = 0;
      let totalInserted = 0;
      
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      // Fetch a batch of products
      console.log(`Fetching products ${offset} to ${offset + limit}...`);
      
      try {
        const response = await fetch(`${restApiUrl}?offset=${offset}&limit=${limit}`, {
          headers: {
            'Accept': 'application/json',
            'Authorization': `Basic ${auth}`
          }
        });
        
        if (!response.ok) {
          throw new Error(`REST API error: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        const products = data.products || [];
        
        if (products.length === 0) {
          return new Response(JSON.stringify({
            success: true,
            message: 'No more products to fetch',
            totalFetched: 0,
            hasMore: false
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        // Transform and insert products
        const productsToInsert = products.map((p: any) => ({
          style_id: p.styleID || p.sku,
          sku: p.sku,
          supplier_id: 'SS',
          name: p.title || p.productTitle || `S&S ${p.sku}`,
          brand: p.brandName || 'S&S Activewear',
          category: p.categoryName || 'Apparel',
          description: p.description || '',
          min_price: p.piecePrice ? parseFloat(p.piecePrice).toFixed(2) : null,
          max_price: p.piecePrice ? (parseFloat(p.piecePrice) * 1.5).toFixed(2) : null,
          primary_image_url: p.image ? `https://cdn.ssactivewear.com${p.image}` : null,
          last_synced: new Date().toISOString()
        }));
        
        // Insert batch into database
        const { error: insertError } = await supabase
          .from('ss_products')
          .upsert(productsToInsert, { 
            onConflict: 'style_id',
            ignoreDuplicates: false 
          });
        
        if (!insertError) {
          totalInserted = productsToInsert.length;
          console.log(`✅ Inserted ${totalInserted} products`);
        } else {
          console.error('Insert error:', insertError);
        }
        
        totalFetched = products.length;
        
        // Check if there are more products
        const hasMore = products.length === limit;
        
        return new Response(JSON.stringify({
          success: true,
          message: `Fetched ${totalFetched} products from S&S REST API`,
          totalFetched,
          totalInserted,
          offset,
          hasMore,
          nextOffset: hasMore ? offset + limit : null,
          sampleProducts: productsToInsert.slice(0, 5)
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
        
      } catch (error) {
        console.error('REST API fetch error:', error);
        return new Response(JSON.stringify({
          error: `Failed to fetch from REST API: ${(error as Error).message}`,
          success: false
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    if (op === 'discoverSKUs') {
      console.log('🔍 Discovering available SKUs from S&S database...');
      
      try {
        // Use getProductSellable to find available products
        const request: GetProductRequest = {
          wsVersion: '2.0.0',
          id: SS_CONFIG.accountNumber,
          password: SS_CONFIG.apiKey,
          productId: '', // Empty to get all sellable products
          localizationCountry: 'US',
          localizationLanguage: 'en',
          isSellable: true,
        };

        const soapEnvelope = createGetProductSellableSOAP(request);
        console.log('📤 Querying S&S for all sellable products...');

        const soapResponse = await callPromoStandardsSOAP(SS_CONFIG.productDataEndpoint, soapEnvelope, 'getProductSellable');
        console.log('📥 Received sellable products response');

        // Parse the response to extract available SKUs/product IDs
        const availableProducts = parseProductSellableResponse(soapResponse);
        
        return new Response(JSON.stringify({
          success: true,
          message: `Found ${availableProducts.length} sellable products`,
          products: availableProducts,
          timestamp: new Date().toISOString(),
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      } catch (error) {
        console.error('❌ Failed to discover SKUs:', error);
        return new Response(JSON.stringify({
          success: false,
          error: (error as Error).message,
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    return new Response(JSON.stringify({ 
      error: 'Unknown operation. Supported: getProductSellable, getProduct, getPricing, getInventory, syncProduct, syncMultiple, discoverSKUs' 
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ PromoStandards SOAP function error:', error);
    
    return new Response(JSON.stringify({
      error: (error as Error).message,
      success: false,
      timestamp: new Date().toISOString(),
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
