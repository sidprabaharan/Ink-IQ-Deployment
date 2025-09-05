// ZenRows Cloudflare Bypass for S&S API
// Get free API key at: https://www.zenrows.com/

const ZENROWS_API_KEY = 'YOUR_ZENROWS_API_KEY'; // Get free key
const SS_ACCOUNT = '944527';
const SS_API_KEY = '663f142b-1a2d-4c68-a2cf-88e032f092e3';

export async function callSSViaZenRows() {
  const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ns="http://www.promostandards.org/WSDL/ProductData/2.0.0/" xmlns:shar="http://www.promostandards.org/WSDL/ProductData/2.0.0/SharedObjects/">
   <soap:Header/>
   <soap:Body>
      <ns:GetProductRequest>
         <shar:wsVersion>2.0.0</shar:wsVersion>
         <shar:id>${SS_ACCOUNT}</shar:id>
         <shar:password>${SS_API_KEY}</shar:password>
         <shar:localizationCountry>US</shar:localizationLanguage>
         <shar:localizationLanguage>en</shar:localizationLanguage>
         <shar:productId>B15453</shar:productId>
      </ns:GetProductRequest>
   </soap:Body>
</soap:Envelope>`;

  try {
    const response = await fetch('https://api.zenrows.com/v1/', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ZENROWS_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: 'https://promostandards.ssactivewear.com/ProductData/v2/ProductDataServicev2.svc',
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'SOAPAction': 'getProduct'
        },
        body: soapEnvelope,
        js_render: false,
        premium_proxy: true
      })
    });

    const result = await response.text();
    
    return {
      success: true,
      data: result,
      message: '🎉 ZenRows bypassed Cloudflare successfully!'
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message,
      error: error.toString()
    };
  }
}

