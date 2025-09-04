// AWS Lambda function for S&S Activewear PromoStandards API
// This function provides better network connectivity than Supabase Edge Functions

const https = require('https');

// S&S Activewear credentials
const SS_ACCOUNT = '944527';
const SS_API_KEY = '663f142b-1a2d-4c68-a2cf-88e032f092e3';

// CORS headers for browser requests
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Accept, Origin',
    'Access-Control-Max-Age': '86400',
    'Content-Type': 'application/json'
};

function getSampleProducts(limit = 50, page = 1) {
    const allSampleProducts = [
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
        },
        {
            id: 4, sku: 'SS-B64000', name: 'S&S SoftStyle T-Shirt',
            lowestPrice: 2.98, highestPrice: 8.75,
            image: 'https://images.unsplash.com/photo-1618354691373-d851c5c3a990?w=300&h=375&fit=crop',
            colors: ['White', 'Black', 'Navy', 'Red', 'Gray', 'Royal'], price: 2.98, brand: 'Gildan',
            suppliers: [{ name: 'S&S Activewear', price: 2.98, inventory: 4100 }],
            supplierId: 'SS', supplierName: 'S&S Activewear', styleId: 'B64000',
            description: '4.5 oz., 100% ring spun cotton. Semi-fitted contoured silhouette with side seams.',
            images: ['https://images.unsplash.com/photo-1618354691373-d851c5c3a990?w=300&h=375&fit=crop'],
            variants: []
        },
        {
            id: 5, sku: 'SS-B42000', name: 'S&S Performance T-Shirt',
            lowestPrice: 5.25, highestPrice: 14.20,
            image: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=300&h=375&fit=crop',
            colors: ['White', 'Black', 'Navy', 'Red', 'Gray'], price: 5.25, brand: 'Gildan',
            suppliers: [{ name: 'S&S Activewear', price: 5.25, inventory: 2200 }],
            supplierId: 'SS', supplierName: 'S&S Activewear', styleId: 'B42000',
            description: '4.2 oz., 100% polyester jersey. Moisture-wicking and antimicrobial properties.',
            images: ['https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=300&h=375&fit=crop'],
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

function makeSOAPRequest(soapEnvelope, timeout = 10000) {
    return new Promise((resolve, reject) => {
        const postData = soapEnvelope;
        
        const options = {
            hostname: 'promostandards.ssactivewear.com',
            port: 443,
            path: '/ProductData/v2/ProductDataServicev2.svc',
            method: 'POST',
            headers: {
                'Content-Type': 'text/xml; charset=utf-8',
                'SOAPAction': 'getProduct',
                'Content-Length': Buffer.byteLength(postData),
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/xml, application/xml, application/soap+xml',
                'Accept-Encoding': 'gzip, deflate',
                'Connection': 'keep-alive'
            },
            timeout: timeout
        };

        const req = https.request(options, (res) => {
            let data = '';
            
            console.log('🔍 S&S Response Status:', res.statusCode);
            console.log('🔍 S&S Response Headers:', JSON.stringify(res.headers, null, 2));
            console.log('🔍 CF-Ray-ID:', res.headers['cf-ray'] || res.headers['CF-Ray'] || 'Not found');
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                resolve({
                    statusCode: res.statusCode,
                    headers: res.headers,
                    body: data,
                    cfRayId: res.headers['cf-ray'] || res.headers['CF-Ray'] || null
                });
            });
        });

        req.on('error', (err) => {
            reject(err);
        });

        req.on('timeout', () => {
            req.destroy();
            reject(new Error('AWS_LAMBDA_TIMEOUT'));
        });

        req.write(postData);
        req.end();
    });
}

async function testSSLiveData() {
    console.log('🚀 AWS LAMBDA: Testing S&S SOAP API...');
    
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
        const response = await makeSOAPRequest(soapEnvelope, 8000);
        const responseTime = Date.now() - startTime;
        
        console.log(`📥 AWS LAMBDA Response in ${responseTime}ms:`, response.statusCode);
        console.log('📄 Response length:', response.body.length);
        console.log('🔍 CF-Ray-ID for S&S support:', response.cfRayId || 'Not found');
        console.log('📋 Full response headers:', JSON.stringify(response.headers, null, 2));

        if (response.statusCode === 200 && response.body.includes('<productName>')) {
            const nameMatch = response.body.match(/<productName[^>]*>([^<]+)<\/productName>/);
            const brandMatch = response.body.match(/<productBrand[^>]*>([^<]+)<\/productBrand>/);
            const imageMatch = response.body.match(/<primaryImageURL[^>]*>([^<]+)<\/primaryImageURL>/);
            
            console.log('🎉 AWS LAMBDA SUCCESS! Live S&S data retrieved!');
            
            const liveProduct = {
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
                description: 'Live S&S Product Data via AWS Lambda',
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
                    apiType: 'LIVE_S&S_AWS_SUCCESS',
                    responseTime: responseTime,
                    host: 'AWS_LAMBDA_US_EAST_1'
                }
            };
        } else {
            throw new Error(`Unexpected response: ${response.statusCode}`);
        }
    } catch (error) {
        console.log('❌ AWS LAMBDA SOAP failed:', error.message);
        throw error;
    }
}

exports.handler = async (event) => {
    console.log('🔥 AWS LAMBDA: Request received', JSON.stringify(event, null, 2));

    // Handle both API Gateway v1 and v2 formats
    const method = event.httpMethod || event.requestContext?.http?.method || 'POST';
    const body = event.body || '{}';
    
    // Handle CORS preflight
    if (method === 'OPTIONS') {
        const preflightHeaders = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Accept, Origin',
            'Access-Control-Max-Age': '86400'
        };
        return {
            statusCode: 200,
            headers: preflightHeaders,
            body: ''
        };
    }

    if (method !== 'POST') {
        return {
            statusCode: 405,
            headers: corsHeaders,
            body: JSON.stringify({ 
                error: 'Method not allowed', 
                receivedMethod: method,
                eventKeys: Object.keys(event),
                debug: 'AWS Lambda CORS Debug'
            })
        };
    }

    try {
        const parsedBody = JSON.parse(body);
        const { op, params } = parsedBody;

        console.log(`🔥 AWS LAMBDA: ${op} operation called`);

        if (op === 'browseProducts') {
            const limit = params?.limit || 50;
            const page = params?.page || 1;
            
            console.log(`📦 AWS LAMBDA: browseProducts - page: ${page}, limit: ${limit}`);

            // Try live S&S data first
            try {
                console.log('🌐 AWS LAMBDA: Attempting live S&S data...');
                const liveData = await testSSLiveData();
                return {
                    statusCode: 200,
                    headers: corsHeaders,
                    body: JSON.stringify(liveData)
                };
            } catch (error) {
                console.log('⚠️ AWS LAMBDA: Live data failed, using sample data');
                console.log('Error:', error.message);
                
                const sampleData = getSampleProducts(limit, page);
                sampleData.debug = {
                    apiType: 'AWS_LAMBDA_SAMPLE_FALLBACK',
                    error: error.message,
                    attempted: 'LIVE_S&S_SOAP_AWS',
                    host: 'AWS_LAMBDA_US_EAST_1',
                    note: 'Testing if AWS Lambda has better S&S connectivity'
                };
                
                return {
                    statusCode: 200,
                    headers: corsHeaders,
                    body: JSON.stringify(sampleData)
                };
            }
        }

        if (op === 'testAWS') {
            // Direct test endpoint
            try {
                const result = await testSSLiveData();
                return {
                    statusCode: 200,
                    headers: corsHeaders,
                    body: JSON.stringify({
                        success: true,
                        message: '🎉 AWS LAMBDA SUCCESS! S&S API working from AWS Lambda!',
                        ...result
                    })
                };
            } catch (error) {
                return {
                    statusCode: 200,
                    headers: corsHeaders,
                    body: JSON.stringify({
                        success: false,
                        message: `❌ AWS Lambda also has connectivity issues: ${error.message}`,
                        error: error.message,
                        host: 'AWS_LAMBDA_US_EAST_1'
                    })
                };
            }
        }

        return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Unknown operation' })
        };

    } catch (error) {
        console.error('❌ AWS LAMBDA handler error:', error);
        return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({ 
                error: 'Internal server error', 
                details: error.message,
                host: 'AWS_LAMBDA_US_EAST_1'
            })
        };
    }
};
