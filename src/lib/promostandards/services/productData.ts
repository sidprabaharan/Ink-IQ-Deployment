/**
 * PromoStandards Product Data Service 2.0.0
 * Handles product catalog requests
 */

import { buildEnvelope, postSoap, parseXml } from '../soapClient';
import { getSupplierConfig, NAMESPACES } from '../config';
import { PSProduct } from '../types';

export interface GetProductParams {
  supplier?: string;
  productId: string;
  localizationCountry?: string;
  localizationLanguage?: string;
}

export interface BrowseProductsParams {
  supplier?: string;
  limit?: number;
  page?: number;
}

/**
 * Build GetProduct SOAP request XML
 */
function buildGetProductXML(
  namespace: string,
  id: string,
  password: string,
  wsVersion: string,
  params: GetProductParams
): string {
  const { productId, localizationCountry = "US", localizationLanguage = "en" } = params;
  
  return buildEnvelope(namespace, `
    <pd:GetProductRequest xmlns:pd="${namespace}">
      <pd:wsVersion>${wsVersion}</pd:wsVersion>
      <pd:id>${id}</pd:id>
      <pd:password>${password}</pd:password>
      <pd:productId>${productId}</pd:productId>
      <pd:localizationCountry>${localizationCountry}</pd:localizationCountry>
      <pd:localizationLanguage>${localizationLanguage}</pd:localizationLanguage>
    </pd:GetProductRequest>`);
}

/**
 * For S&S, we'll use their REST API temporarily until we have proper SOAP endpoints
 */
async function callSSRestAPI(endpoint: string, params: Record<string, any> = {}): Promise<any> {
  const config = getSupplierConfig('ssactivewear');
  const url = new URL(endpoint);
  
  // Add query parameters
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  });
  
  // Add authentication and format
  url.searchParams.set('mediaType', 'json');
  
  console.log(`📡 S&S REST API call: ${url.toString()}`);
  
  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'Authorization': `Basic ${btoa(`${config.id}:${config.password}`)}`,
      'Accept': 'application/json',
    },
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`S&S API error ${response.status}: ${errorText}`);
  }
  
  const data = await response.json();
  console.log(`📥 S&S API response:`, data);
  return data;
}

/**
 * Get product details by product ID
 */
export async function getProduct(params: GetProductParams): Promise<PSProduct | null> {
  console.log('🔍 getProduct called with:', params);
  
  try {
    const supplierConfig = getSupplierConfig(params.supplier);
    const service = supplierConfig.services.productData;
    
    if (!service) {
      throw new Error('Product Data service not configured for supplier');
    }
    
    // For S&S, use REST API temporarily
    if (params.supplier === 'ssactivewear' || !params.supplier) {
      const data = await callSSRestAPI('https://api.ssactivewear.com/V2/Products', {
        productId: params.productId,
        pageSize: 1
      });
      
      // Map S&S response to PSProduct
      const items = Array.isArray(data) ? data : [];
      if (items.length === 0) return null;
      
      const item = items[0];
      return mapSSItemToPSProduct(item);
    }
    
    // For other suppliers, use SOAP (not implemented yet)
    throw new Error('SOAP implementation not yet available for this supplier');
    
  } catch (error) {
    console.error('❌ getProduct error:', error);
    throw error;
  }
}

/**
 * Browse products (get first N products)
 */
export async function browseProducts(params: BrowseProductsParams): Promise<PSProduct[]> {
  console.log('🔍 browseProducts called with:', params);
  
  try {
    const { limit = 10, page = 1 } = params;
    
    // For S&S, use REST API
    const data = await callSSRestAPI('https://api.ssactivewear.com/V2/Products', {
      page,
      pageSize: limit
    });
    
    // Map S&S response to PSProduct array
    const items = Array.isArray(data) ? data : [];
    return items.map(mapSSItemToPSProduct);
    
  } catch (error) {
    console.error('❌ browseProducts error:', error);
    throw error;
  }
}

/**
 * Map S&S API item to PSProduct format
 */
function mapSSItemToPSProduct(item: any): PSProduct {
  const styleId = String(item?.styleID || item?.styleId || item?.style || '');
  const styleName = item?.styleName || item?.name || '';
  const brandName = item?.brandName || item?.brand || '';
  
  // Extract pricing
  const price = Number(item?.piecePrice || item?.price || item?.customerPrice || item?.salePrice || 0);
  
  // Build image URL
  const images = [];
  if (item?.colorFrontImage) {
    images.push({ url: `https://api.ssactivewear.com/V2/${item.colorFrontImage}` });
  }
  
  // Map variants
  const variants = [];
  if (item?.sizeName && item?.colorName) {
    variants.push({
      sku: item?.sku || styleId,
      size: { code: String(item.sizeName).toUpperCase() },
      color: { name: item.colorName, code: item?.colorCode || item.colorName },
    });
  }
  
  return {
    supplierId: 'SS',
    supplierName: 'S&S Activewear',
    styleId,
    sku: styleId,
    name: `${brandName} ${styleName}`.trim(),
    description: item?.description || '',
    category: 'Apparel',
    images,
    variants,
    price,
  };
}





