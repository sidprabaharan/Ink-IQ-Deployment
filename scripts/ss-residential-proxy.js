// S&S API Residential Proxy Server
// Run this on your local machine with residential internet to bypass Cloudflare

const express = require('express');
const https = require('https');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

// S&S Credentials
const SS_ACCOUNT = '944527';
const SS_API_KEY = '663f142b-1a2d-4c68-a2cf-88e032f092e3';

app.use(cors());
app.use(express.json());

// Make SOAP request from residential IP
function makeResidentialSOAPRequest(soapEnvelope, service = 'inventory', timeout = 30000) {
    return new Promise((resolve, reject) => {
        const postData = soapEnvelope;
        
        // Different endpoints for different services
        const endpoints = {
            inventory: '/Inventory/v2/InventoryServicev2.svc',
            productdata: '/ProductData/v2/ProductDataServicev2.svc',
            pricing: '/PricingAndConfiguration/v1/PricingAndConfigurationServicev1.svc'
        };
        
        const soapActions = {
            inventory: 'getInventoryLevels',
            productdata: 'getProduct',
            pricing: 'getConfigurationAndPricing'
        };
        
        const options = {
            hostname: 'promostandards.ssactivewear.com',
            port: 443,
            path: endpoints[service],
            method: 'POST',
            headers: {
                'Content-Type': 'text/xml; charset=utf-8',
                'SOAPAction': soapActions[service],
                'Content-Length': Buffer.byteLength(postData),
                // Residential browser headers
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Encoding': 'gzip, deflate, br',
                'Accept-Language': 'en-US,en;q=0.9',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'DNT': '1',
                'Pragma': 'no-cache',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Sec-Fetch-User': '?1',
                'Upgrade-Insecure-Requests': '1'
            },
            timeout: timeout
        };

        console.log(`🏠 RESIDENTIAL: Making ${service} SOAP request from residential IP...`);
        
        const req = https.request(options, (res) => {
            let data = '';
            
            console.log(`📡 ${service} Response Status:`, res.statusCode);
            console.log('🔍 CF-Ray-ID:', res.headers['cf-ray'] || res.headers['CF-Ray'] || 'Not found');
            console.log('🔍 Server:', res.headers['server'] || 'Unknown');
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                console.log(`✅ RESIDENTIAL: ${service} response received, length:`, data.length);
                resolve({
                    statusCode: res.statusCode,
                    headers: res.headers,
                    body: data,
                    cfRayId: res.headers['cf-ray'] || res.headers['CF-Ray'] || null,
                    service: service
                });
            });
        });

        req.on('error', (error) => {
            console.error(`❌ RESIDENTIAL: ${service} SOAP request error:`, error.message);
            reject(error);
        });

        req.on('timeout', () => {
            console.error(`❌ RESIDENTIAL: ${service} SOAP request timeout after`, timeout, 'ms');
            req.destroy();
            reject(new Error(`RESIDENTIAL_${service.toUpperCase()}_TIMEOUT_${timeout}ms`));
        });

        req.write(postData);
        req.end();
    });
}

// Main proxy endpoint
app.post('/api/ss-residential', async (req, res) => {
    console.log('🏠 RESIDENTIAL: S&S API request received from residential IP');
    console.log('📋 Request body:', JSON.stringify(req.body, null, 2));
    
    const { op, params = {} } = req.body;
    
    try {
        if (op === 'testResidential' || op === 'browseProducts') {
            // Try multiple services in sequence
            const services = [
                {
                    name: 'inventory',
                    envelope: `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ns="http://www.promostandards.org/WSDL/Inventory/2.0.0/" xmlns:shar="http://www.promostandards.org/WSDL/Inventory/2.0.0/SharedObjects/">
   <soapenv:Header/>
   <soapenv:Body>
      <ns:GetInventoryLevelsRequest>
         <shar:wsVersion>2.0.0</shar:wsVersion>
         <shar:id>${SS_ACCOUNT}</shar:id>
         <shar:password>${SS_API_KEY}</shar:password>
         <shar:productId>B00760</shar:productId>
      </ns:GetInventoryLevelsRequest>
   </soapenv:Body>
</soapenv:Envelope>`
                },
                {
                    name: 'productdata',
                    envelope: `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ns="http://www.promostandards.org/WSDL/ProductDataService/2.0.0/" xmlns:shar="http://www.promostandards.org/WSDL/ProductDataService/2.0.0/SharedObjects/">
   <soap:Header/>
   <soap:Body>
      <ns:GetProductRequest>
         <shar:wsVersion>2.0.0</shar:wsVersion>
         <shar:id>${SS_ACCOUNT}</shar:id>
         <shar:password>${SS_API_KEY}</shar:password>
         <shar:localizationCountry>US</shar:localizationCountry>
         <shar:localizationLanguage>en</shar:localizationLanguage>
         <shar:productId>B00760</shar:productId>
      </ns:GetProductRequest>
   </soap:Body>
</soap:Envelope>`
                }
            ];

            for (const service of services) {
                try {
                    console.log(`🔍 RESIDENTIAL: Trying ${service.name} service...`);
                    const response = await makeResidentialSOAPRequest(service.envelope, service.name, 30000);
                    
                    if (response.statusCode === 200 && !response.body.includes('soap:Fault')) {
                        const hasData = response.body.includes('<PartInventory>') || 
                                       response.body.includes('<Product>') ||
                                       response.body.includes('quantityAvailable');
                        
                        return res.json({
                            success: true,
                            message: hasData ? 
                                `🎉 RESIDENTIAL SUCCESS! Got REAL S&S data via ${service.name}!` :
                                `🎉 RESIDENTIAL CONNECTED to ${service.name} service!`,
                            data: response.body,
                            cfRayId: response.cfRayId,
                            source: `Live S&S ${service.name} API via Residential IP`,
                            hasProductData: hasData,
                            hasError: false,
                            hasCloudflareBlock: false,
                            responseLength: response.body.length,
                            timestamp: new Date().toISOString(),
                            service: service.name,
                            residential: true
                        });
                    }
                } catch (serviceError) {
                    console.log(`❌ RESIDENTIAL: ${service.name} failed:`, serviceError.message);
                    continue;
                }
            }
            
            // All services failed
            throw new Error('All S&S services failed from residential IP');
            
        } else {
            res.json({
                success: false,
                message: `❌ Unknown operation: ${op}. Use 'testResidential' or 'browseProducts'`,
                availableOps: ['testResidential', 'browseProducts'],
                timestamp: new Date().toISOString()
            });
        }
    } catch (error) {
        console.error('❌ RESIDENTIAL: Error:', error.message);
        
        const isNetworkError = error.message.includes('timeout') || 
                              error.message.includes('ECONNRESET') || 
                              error.message.includes('ENOTFOUND');
        
        res.json({
            success: false,
            message: isNetworkError ? 
                '🚫 Network error from residential IP - check internet connection' : 
                `❌ Residential proxy error: ${error.message}`,
            error: error.toString(),
            source: 'Residential IP proxy',
            isNetworkError,
            residential: true,
            timestamp: new Date().toISOString()
        });
    }
});

// Health check
app.get('/', (req, res) => {
    res.json({ 
        message: '🏠 S&S API Residential Proxy', 
        status: 'Running',
        ip: 'Residential',
        endpoints: ['/api/ss-residential'],
        timestamp: new Date().toISOString()
    });
});

app.listen(PORT, () => {
    console.log(`🏠 Residential S&S Proxy running on port ${PORT}`);
    console.log(`✅ Using residential IP to bypass Cloudflare!`);
    console.log(`🔗 Test endpoint: http://localhost:${PORT}/api/ss-residential`);
    console.log(`📋 S&S Account: ${SS_ACCOUNT}`);
    console.log(`🎯 This should bypass Cloudflare bot protection!`);
});
