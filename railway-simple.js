// Simplified Railway deployment for S&S API proxy
// This avoids the database.ts UTF-8 issue

import express from 'express';
import https from 'https';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3000;

// S&S Credentials
const SS_ACCOUNT = '944527';
const SS_API_KEY = '663f142b-1a2d-4c68-a2cf-88e032f092e3';

app.use(cors());
app.use(express.json());

function makeSOAPRequest(soapEnvelope, timeout = 15000) {
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

        console.log('🚂 RAILWAY: Making SOAP request to S&S...');
        
        const req = https.request(options, (res) => {
            let data = '';
            console.log('🔍 S&S Response Status:', res.statusCode);
            console.log('🔍 CF-Ray-ID:', res.headers['cf-ray'] || res.headers['CF-Ray'] || 'Not found');
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                console.log('✅ RAILWAY: S&S Response received, length:', data.length);
                resolve({
                    statusCode: res.statusCode,
                    headers: res.headers,
                    body: data,
                    cfRayId: res.headers['cf-ray'] || res.headers['CF-Ray'] || null
                });
            });
        });

        req.on('error', (error) => {
            console.error('❌ RAILWAY: SOAP request error:', error.message);
            reject(error);
        });

        req.on('timeout', () => {
            console.error('❌ RAILWAY: SOAP request timeout');
            req.destroy();
            reject(new Error('Request timeout after 15 seconds'));
        });

        req.write(postData);
        req.end();
    });
}

// Main API endpoint
app.post('/api/ss-proxy', async (req, res) => {
    console.log('🚂 RAILWAY: S&S API request received', req.body);
    
    const { op, params } = req.body;
    
    try {
        if (op === 'browseProducts' || op === 'testAWS') {
            // Real S&S SOAP request with correct product ID
            const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ns="http://www.promostandards.org/WSDL/ProductData/2.0.0/" xmlns:shar="http://www.promostandards.org/WSDL/ProductData/2.0.0/SharedObjects/">
   <soap:Header/>
   <soap:Body>
      <ns:GetProductRequest>
         <shar:wsVersion>2.0.0</shar:wsVersion>
         <shar:id>${SS_ACCOUNT}</shar:id>
         <shar:password>${SS_API_KEY}</shar:password>
         <shar:localizationCountry>US</shar:localizationCountry>
         <shar:localizationLanguage>en</shar:localizationLanguage>
         <shar:productId>B15453</shar:productId>
      </ns:GetProductRequest>
   </soap:Body>
</soap:Envelope>`;

            console.log('🔥 RAILWAY: Attempting S&S API connection...');
            const response = await makeSOAPRequest(soapEnvelope, 15000);
            
            console.log('🔍 CF-Ray-ID for S&S support:', response.cfRayId || 'Not found');
            console.log('📋 Response status:', response.statusCode);
            
            if (response.statusCode === 200) {
                // Check if we got actual product data or an error
                const hasProductData = response.body.includes('<Product>') || response.body.includes('productId');
                const hasError = response.body.includes('soap:Fault') || response.body.includes('ActionNotSupported');
                
                res.json({
                    success: true,
                    message: hasProductData ? 
                        '🎉 RAILWAY SUCCESS! Connected to LIVE S&S API and got product data!' :
                        hasError ? 
                        '⚠️ RAILWAY CONNECTED but S&S returned an error (check CF-Ray-ID)' :
                        '🎉 RAILWAY SUCCESS! Connected to S&S API',
                    data: response.body,
                    cfRayId: response.cfRayId,
                    source: 'Live S&S PromoStandards API via Railway',
                    hasProductData,
                    hasError,
                    responseLength: response.body.length
                });
            } else {
                res.json({
                    success: false,
                    message: `S&S API returned HTTP ${response.statusCode}`,
                    cfRayId: response.cfRayId,
                    response: response.body.substring(0, 500) + '...',
                    source: 'Railway -> S&S API'
                });
            }
        } else {
            res.json({
                success: false,
                message: `Unknown operation: ${op}. Use 'browseProducts' or 'testAWS'`
            });
        }
    } catch (error) {
        console.error('❌ RAILWAY: Error:', error.message);
        
        // Check if it's a network/timeout error (likely Cloudflare blocking)
        const isNetworkError = error.message.includes('timeout') || 
                              error.message.includes('ECONNRESET') || 
                              error.message.includes('ENOTFOUND');
        
        res.json({
            success: false,
            message: isNetworkError ? 
                '🚫 Network error - likely Cloudflare blocking Railway IPs' : 
                `Error: ${error.message}`,
            error: error.toString(),
            source: 'Railway deployment',
            isNetworkError
        });
    }
});

// Health check endpoint
app.get('/', (req, res) => {
    res.json({ 
        message: '🚂 S&S API Proxy on Railway (Simplified)', 
        status: 'Running',
        endpoints: ['/api/ss-proxy'],
        timestamp: new Date().toISOString()
    });
});

// Health check for Railway
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
    console.log(`🚂 Railway S&S Proxy running on port ${PORT}`);
    console.log(`✅ Ready to connect to S&S Activewear API!`);
});
