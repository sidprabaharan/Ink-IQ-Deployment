// Vercel Edge Runtime - no imports needed
export const config = {
  runtime: 'edge',
};

// S&S Activewear credentials from environment
const SS_ACCOUNT = process.env.SS_ACCOUNT || '944527';
const SS_API_KEY = process.env.SS_API_KEY || '663f142b-1a2d-4c68-a2cf-88e032f092e3';

interface SSProduct {
  id: number;
  sku: string;
  name: string;
  brand: string;
  image: string;
  price: number;
  lowestPrice: number;
  highestPrice: number;
  colors: string[];
  suppliers: Array<{ name: string; price: number; inventory: number }>;
  supplierId: string;
  supplierName: string;
  styleId: string;
  description: string;
  images: string[];
  variants: any[];
}

function getSampleProducts(limit: number, page: number) {
  const allSampleProducts: SSProduct[] = [
    {
      id: 1, sku: 'SS-B15453', name: 'S&S Ultra Cotton T-Shirt', 
      lowestPrice: 3.42, highestPrice: 12.85, 
      image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=300&h=375&fit=crop',
      colors: ['White', 'Black', 'Navy', 'Red', 'Gray'], price: 3.42, brand: 'Gildan',
      suppliers: [{ name: 'S&S Activewear', price: 3.42, inventory: 2850 }],
      supplierId: 'SS', supplierName: 'S&S Activewear', styleId: 'B15453',
      description: '6 oz. (US) 10 oz. (CA), 100% preshrunk cotton. Double-needle stitched neckline and sleeves.',
      images: ['https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=300&h=375&fit=crop'], 
      variants: []
    },
    {
      id: 2, sku: 'SS-B18500', name: 'S&S Heavy Cotton Hoodie',
      lowestPrice: 15.20, highestPrice: 28.50,
      image: 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=300&h=375&fit=crop',
      colors: ['Black', 'Navy', 'Gray', 'White'], price: 15.20, brand: 'Gildan',
      suppliers: [{ name: 'S&S Activewear', price: 15.20, inventory: 1200 }],
      supplierId: 'SS', supplierName: 'S&S Activewear', styleId: 'B18500',
      description: '8 oz., 50/50 cotton/polyester blend. Double-lined hood with matching drawcord.',
      images: ['https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=300&h=375&fit=crop'],
      variants: []
    },
    {
      id: 3, sku: 'SS-B8000', name: 'S&S DryBlend T-Shirt',
      lowestPrice: 4.15, highestPrice: 9.80,
      image: 'https://images.unsplash.com/photo-1503341504253-dff4815485f1?w=300&h=375&fit=crop',
      colors: ['White', 'Black', 'Red', 'Royal', 'Navy'], price: 4.15, brand: 'Gildan',
      suppliers: [{ name: 'S&S Activewear', price: 4.15, inventory: 3200 }],
      supplierId: 'SS', supplierName: 'S&S Activewear', styleId: 'B8000',
      description: '5.6 oz., 50/50 cotton/polyester blend. Moisture-wicking properties.',
      images: ['https://images.unsplash.com/photo-1503341504253-dff4815485f1?w=300&h=375&fit=crop'],
      variants: []
    }
  ];

  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;
  const pageProducts = allSampleProducts.slice(startIndex, endIndex);
  
  return {
    products: pageProducts,
    count: pageProducts.length,
    totalProducts: allSampleProducts.length,
    page: page,
    totalPages: Math.ceil(allSampleProducts.length / limit),
    hasNextPage: endIndex < allSampleProducts.length,
    hasPrevPage: page > 1,
    asOf: new Date().toISOString()
  };
}

async function testSSLiveData() {
  console.log('🚀 VERCEL EDGE: Testing S&S SOAP API...');
  
  const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ns="http://www.promostandards.org/WSDL/ProductDataService/2.0.0/" xmlns:shar="http://www.promostandards.org/WSDL/ProductDataService/2.0.0/SharedObjects/">
   <soapenv:Header/>
   <soapenv:Body>
      <ns:GetProductRequest>
         <shar:wsVersion>2.0.0</shar:wsVersion>
         <shar:id>${SS_ACCOUNT}</shar:id>
         <shar:password>${SS_API_KEY}</shar:password>
         <shar:localizationCountry>US</shar:localizationCountry>
         <shar:localizationLanguage>en</shar:localizationLanguage>
         <shar:productId>B15453</shar:productId>
      </ns:GetProductRequest>
   </soapenv:Body>
</soapenv:Envelope>`;

  try {
    const startTime = Date.now();
    
    const response = await Promise.race([
      fetch('https://promostandards.ssactivewear.com/ProductData/v2/ProductDataServicev2.svc', {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'SOAPAction': 'getProduct',
          'User-Agent': 'InkIQ-Vercel/1.0.0'
        },
        body: soapEnvelope
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('VERCEL_TIMEOUT_10S')), 10000))
    ]) as Response;

    const responseTime = Date.now() - startTime;
    const responseText = await response.text();
    
    console.log(`📥 VERCEL Response in ${responseTime}ms:`, response.status);
    console.log('📄 Response length:', responseText.length);

    if (response.ok && responseText.includes('<productName>')) {
      const nameMatch = responseText.match(/<productName[^>]*>([^<]+)<\/productName>/);
      const brandMatch = responseText.match(/<productBrand[^>]*>([^<]+)<\/productBrand>/);
      const imageMatch = responseText.match(/<primaryImageURL[^>]*>([^<]+)<\/primaryImageURL>/);
      
      console.log('🎉 VERCEL SUCCESS! Live S&S data retrieved!');
      
      const liveProduct: SSProduct = {
        id: 1,
        sku: 'SS-B15453',
        name: nameMatch ? nameMatch[1] : 'S&S Product B15453',
        brand: brandMatch ? brandMatch[1] : 'S&S Activewear',
        image: imageMatch ? `https://cdn.ssactivewear.com${imageMatch[1]}` : 'https://cdn.ssactivewear.com/default.jpg',
        price: 3.42,
        lowestPrice: 3.42,
        highestPrice: 12.85,
        colors: ['White', 'Black', 'Navy'],
        suppliers: [{ name: 'S&S Activewear', price: 3.42, inventory: 2850 }],
        supplierId: 'SS',
        supplierName: 'S&S Activewear',
        styleId: 'B15453',
        description: 'Live S&S Product Data via Vercel Edge',
        images: [imageMatch ? `https://cdn.ssactivewear.com${imageMatch[1]}` : 'https://cdn.ssactivewear.com/default.jpg'],
        variants: []
      };

      return {
        products: [liveProduct],
        count: 1,
        totalProducts: 1,
        page: 1,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false,
        asOf: new Date().toISOString(),
        debug: {
          apiType: 'LIVE_S&S_VERCEL_SUCCESS',
          responseTime: responseTime,
          host: 'VERCEL_EDGE_FUNCTIONS'
        }
      };
    } else {
      throw new Error(`Unexpected response: ${response.status}`);
    }
  } catch (error: any) {
    console.log('❌ VERCEL SOAP failed:', error.message);
    throw error;
  }
}

export default async function handler(req: Request) {
  // CORS headers for cross-origin requests
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json'
  };

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      status: 200,
      headers: corsHeaders
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { 
      status: 405,
      headers: corsHeaders
    });
  }

  try {
    const body = await req.json();
    const { op, params } = body;

    console.log(`🔥 VERCEL EDGE: ${op} called`);

    if (op === 'browseProducts') {
      const limit = params?.limit || 50;
      const page = params?.page || 1;
      
      console.log(`📦 VERCEL: browseProducts - page: ${page}, limit: ${limit}`);

      // Try live S&S data first
      try {
        console.log('🌐 VERCEL: Attempting live S&S data...');
        const liveData = await testSSLiveData();
        return new Response(JSON.stringify(liveData), {
          headers: corsHeaders
        });
      } catch (error: any) {
        console.log('⚠️ VERCEL: Live data failed, using sample data');
        console.log('Error:', error.message);
        
        const sampleData = getSampleProducts(limit, page);
        (sampleData as any).debug = {
          apiType: 'VERCEL_SAMPLE_FALLBACK',
          error: error.message,
          attempted: 'LIVE_S&S_SOAP_VERCEL',
          host: 'VERCEL_EDGE_FUNCTIONS',
          note: 'Testing if Vercel has better S&S connectivity than Supabase'
        };
        
        return new Response(JSON.stringify(sampleData), {
          headers: corsHeaders
        });
      }
    }

    if (op === 'testVercel') {
      // Direct test endpoint
      try {
        const result = await testSSLiveData();
        return new Response(JSON.stringify({
          success: true,
          message: '🎉 VERCEL SUCCESS! S&S API working from Vercel Edge Functions!',
          ...result
        }), {
          headers: corsHeaders
        });
      } catch (error: any) {
        return new Response(JSON.stringify({
          success: false,
          message: `❌ VERCEL also has connectivity issues: ${error.message}`,
          error: error.message,
          host: 'VERCEL_EDGE_FUNCTIONS'
        }), {
          headers: corsHeaders
        });
      }
    }

    return new Response(JSON.stringify({ error: 'Unknown operation' }), { 
      status: 400,
      headers: corsHeaders
    });

  } catch (error: any) {
    console.error('❌ VERCEL handler error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error', 
      details: error.message,
      host: 'VERCEL_EDGE_FUNCTIONS'
    }), { 
      status: 500,
      headers: corsHeaders
    });
  }
}

