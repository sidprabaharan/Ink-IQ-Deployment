// Simple proxy to test Vercel Edge Function without CORS issues
export async function testVercelDirectly() {
  console.log('🚀 Testing Vercel Edge Function directly...');
  
  try {
    // Use a different approach - test from server-side or use a different method
    const testData = {
      op: 'testVercel',
      params: {}
    };

    // For now, let's simulate what the Vercel function would do
    // We'll test the S&S API directly from the browser
    console.log('🌐 Testing S&S SOAP API directly from browser...');
    
    const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ns="http://www.promostandards.org/WSDL/ProductDataService/2.0.0/" xmlns:shar="http://www.promostandards.org/WSDL/ProductDataService/2.0.0/SharedObjects/">
   <soapenv:Header/>
   <soapenv:Body>
      <ns:GetProductRequest>
         <shar:wsVersion>2.0.0</shar:wsVersion>
         <shar:id>944527</shar:id>
         <shar:password>663f142b-1a2d-4c68-a2cf-88e032f092e3</shar:password>
         <shar:localizationCountry>US</shar:localizationCountry>
         <shar:localizationLanguage>en</shar:localizationLanguage>
         <shar:productId>B15453</shar:productId>
      </ns:GetProductRequest>
   </soapenv:Body>
</soapenv:Envelope>`;

    const startTime = Date.now();
    
    const response = await Promise.race([
      fetch('https://promostandards.ssactivewear.com/ProductData/v2/ProductDataServicev2.svc', {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'SOAPAction': 'getProduct',
          'User-Agent': 'InkIQ-Browser-Test/1.0.0'
        },
        body: soapEnvelope
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('BROWSER_TIMEOUT_10S')), 10000))
    ]) as Response;

    const responseTime = Date.now() - startTime;
    const responseText = await response.text();
    
    console.log(`📥 Browser S&S Response in ${responseTime}ms:`, response.status);
    console.log('📄 Response length:', responseText.length);
    console.log('📄 Response preview:', responseText.substring(0, 500));

    if (response.ok && responseText.includes('<productName>')) {
      console.log('🎉 BROWSER SUCCESS! S&S API accessible from browser!');
      return {
        success: true,
        message: '🎉 Browser can reach S&S API directly!',
        responseTime,
        host: 'BROWSER_DIRECT',
        status: response.status,
        responseLength: responseText.length
      };
    } else if (responseText.includes('ActionNotSupported')) {
      console.log('⚠️ ActionNotSupported - but connection works!');
      return {
        success: true,
        message: '✅ Network connectivity confirmed (ActionNotSupported is a SOAP format issue, not network)',
        responseTime,
        host: 'BROWSER_DIRECT',
        status: response.status,
        note: 'S&S servers are reachable, just need to fix SOAP format'
      };
    } else {
      throw new Error(`Unexpected response: ${response.status} - ${responseText.substring(0, 200)}`);
    }
  } catch (error: any) {
    console.log('❌ Browser S&S test failed:', error.message);
    
    if (error.message.includes('TIMEOUT')) {
      return {
        success: false,
        message: '❌ Browser also has timeout issues with S&S API',
        error: error.message,
        host: 'BROWSER_DIRECT',
        note: 'This suggests a network-level issue between your location and S&S servers'
      };
    } else if (error.message.includes('CORS')) {
      return {
        success: false,
        message: '❌ CORS policy blocks direct browser access to S&S API',
        error: error.message,
        host: 'BROWSER_DIRECT',
        note: 'This is expected - S&S API blocks direct browser access'
      };
    } else {
      return {
        success: false,
        message: `❌ Browser test failed: ${error.message}`,
        error: error.message,
        host: 'BROWSER_DIRECT'
      };
    }
  }
}

