/**
 * PromoStandards SOAP Client
 * Handles XML envelope building, HTTP POST, retry/backoff, and fault handling
 */

export interface SoapConfig {
  timeoutMs?: number;
  maxRetries?: number;
}

export interface SoapFault {
  code: string;
  message: string;
  details?: any;
}

export class SoapError extends Error {
  constructor(
    public fault: SoapFault,
    public requestId?: string
  ) {
    super(`SOAP Fault ${fault.code}: ${fault.message}`);
    this.name = 'SoapError';
  }
}

/**
 * Build SOAP 1.2 envelope with the given body content
 */
export function buildEnvelope(namespace: string, bodyInnerXml: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Body>${bodyInnerXml}</soap12:Body>
</soap12:Envelope>`;
}

/**
 * Post SOAP request with retry logic and fault handling
 */
export async function postSoap(
  url: string, 
  xml: string, 
  config: SoapConfig = {}
): Promise<string> {
  const { timeoutMs = 10000, maxRetries = 3 } = config;
  
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`📡 SOAP Request (attempt ${attempt}/${maxRetries}) to ${url}`);
      console.log(`📤 Request XML:`, xml.substring(0, 500) + '...');
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/soap+xml; charset=utf-8',
          'SOAPAction': '""', // Empty SOAPAction for SOAP 1.2
        },
        body: xml,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      const responseText = await response.text();
      console.log(`📥 Response status: ${response.status}`);
      console.log(`📥 Response XML:`, responseText.substring(0, 500) + '...');
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${responseText}`);
      }
      
      // Check for SOAP faults
      if (responseText.includes('soap:Fault') || responseText.includes('soap12:Fault')) {
        const fault = parseSoapFault(responseText);
        throw new SoapError(fault);
      }
      
      return responseText;
      
    } catch (error) {
      lastError = error as Error;
      console.error(`❌ SOAP Request attempt ${attempt} failed:`, error);
      
      // Don't retry on SOAP faults or non-network errors
      if (error instanceof SoapError || attempt === maxRetries) {
        throw error;
      }
      
      // Exponential backoff with jitter
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000) + Math.random() * 1000;
      console.log(`⏳ Retrying in ${Math.round(delay)}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
}

/**
 * Parse SOAP fault from response XML
 */
function parseSoapFault(xml: string): SoapFault {
  try {
    // Simple regex-based parsing for fault elements
    const codeMatch = xml.match(/<(?:soap:|soap12:)?faultcode[^>]*>([^<]+)</i);
    const messageMatch = xml.match(/<(?:soap:|soap12:)?faultstring[^>]*>([^<]+)</i);
    
    return {
      code: codeMatch?.[1] || 'UNKNOWN_FAULT',
      message: messageMatch?.[1] || 'Unknown SOAP fault',
      details: xml,
    };
  } catch (e) {
    return {
      code: 'PARSE_ERROR',
      message: 'Failed to parse SOAP fault',
      details: xml,
    };
  }
}

/**
 * Simple XML parser for response data
 * Returns a basic object representation of the XML
 */
export function parseXml<T = any>(xml: string): T {
  try {
    // For now, return the raw XML - in production you'd use a proper XML parser
    // This is a placeholder that works for basic testing
    console.log('🔍 Parsing XML response...');
    
    // Simple extraction of array data from S&S-style responses
    if (xml.includes('<Product>') || xml.includes('<product>')) {
      // Extract product data using regex (simplified for demo)
      const products: any[] = [];
      const productMatches = xml.match(/<Product[^>]*>[\s\S]*?<\/Product>/gi) || [];
      
      for (const productXml of productMatches) {
        const product: any = {};
        
        // Extract common fields
        const styleIdMatch = productXml.match(/<styleID[^>]*>([^<]+)</i);
        const styleNameMatch = productXml.match(/<styleName[^>]*>([^<]+)</i);
        const brandNameMatch = productXml.match(/<brandName[^>]*>([^<]+)</i);
        const piecePriceMatch = productXml.match(/<piecePrice[^>]*>([^<]+)</i);
        const colorFrontImageMatch = productXml.match(/<colorFrontImage[^>]*>([^<]+)</i);
        const sizeNameMatch = productXml.match(/<sizeName[^>]*>([^<]+)</i);
        const colorNameMatch = productXml.match(/<colorName[^>]*>([^<]+)</i);
        const skuMatch = productXml.match(/<sku[^>]*>([^<]+)</i);
        
        if (styleIdMatch) product.styleID = styleIdMatch[1];
        if (styleNameMatch) product.styleName = styleNameMatch[1];
        if (brandNameMatch) product.brandName = brandNameMatch[1];
        if (piecePriceMatch) product.piecePrice = parseFloat(piecePriceMatch[1]);
        if (colorFrontImageMatch) product.colorFrontImage = colorFrontImageMatch[1];
        if (sizeNameMatch) product.sizeName = sizeNameMatch[1];
        if (colorNameMatch) product.colorName = colorNameMatch[1];
        if (skuMatch) product.sku = skuMatch[1];
        
        products.push(product);
      }
      
      return products as T;
    }
    
    // For other responses, return a simple parsed structure
    return { raw: xml } as T;
    
  } catch (error) {
    console.error('❌ XML parsing failed:', error);
    throw new Error(`XML parsing failed: ${error}`);
  }
}




