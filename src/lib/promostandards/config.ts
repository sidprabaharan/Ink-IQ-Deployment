/**
 * PromoStandards Configuration
 * Manages supplier registry, endpoints, and environment validation
 */

export interface ServiceConfig {
  version: string;
  url: string;
}

export interface SupplierConfig {
  id: string;
  password: string;
  services: {
    productData?: ServiceConfig;
    inventory?: ServiceConfig;
    mediaContent?: ServiceConfig;
    pricingConfig?: ServiceConfig;
    orderStatus?: ServiceConfig;
    shipmentNotification?: ServiceConfig;
    purchaseOrder?: ServiceConfig;
    invoice?: ServiceConfig;
  };
}

export interface PromoStandardsConfig {
  suppliers: Record<string, SupplierConfig>;
  defaultSupplier: string;
  requestTimeoutMs: number;
  maxRetries: number;
  cacheTtls: Record<string, number>;
  cacheBackend: 'postgres' | 'redis' | 'memory';
}

/**
 * Load configuration from environment variables
 */
export function loadConfig(): PromoStandardsConfig {
  // For S&S Activewear, we'll use their REST API endpoints for now
  // In production, these would be proper SOAP endpoints
  const ssConfig: SupplierConfig = {
    id: "944527", // Your S&S account number
    password: "663f142b-1a2d-4c68-a2cf-88e032f092e3", // Your S&S API key
    services: {
      productData: {
        version: "2.0.0",
        url: "https://api.ssactivewear.com/V2/Products" // REST endpoint for now
      },
      inventory: {
        version: "2.0.0", 
        url: "https://api.ssactivewear.com/V2/Products" // REST endpoint for now
      },
      mediaContent: {
        version: "1.1.0",
        url: "https://api.ssactivewear.com/V2/Products" // REST endpoint for now
      }
    }
  };

  return {
    suppliers: {
      ssactivewear: ssConfig
    },
    defaultSupplier: 'ssactivewear',
    requestTimeoutMs: 10000,
    maxRetries: 3,
    cacheTtls: {
      productData: 86400,    // 24h
      mediaContent: 86400,   // 24h  
      pricingConfig: 21600,  // 6h
      inventory: 600,        // 10m
      orderStatus: 0,
      shipmentNotification: 0,
      invoice: 0
    },
    cacheBackend: 'memory'
  };
}

/**
 * Get supplier configuration by ID
 */
export function getSupplierConfig(supplierId?: string): SupplierConfig {
  const config = loadConfig();
  const id = supplierId || config.defaultSupplier;
  const supplier = config.suppliers[id];
  
  if (!supplier) {
    throw new Error(`Supplier '${id}' not found in configuration`);
  }
  
  return supplier;
}

/**
 * PromoStandards service namespaces
 */
export const NAMESPACES = {
  productData: "http://www.promostandards.org/WSDL/ProductDataService/2.0.0/",
  inventory: "http://www.promostandards.org/WSDL/InventoryService/2.0.0/",
  mediaContent: "http://www.promostandards.org/WSDL/MediaContentService/1.1.0/",
  pricingConfig: "http://www.promostandards.org/WSDL/PricingAndConfigurationService/1.0.0/",
  orderStatus: "http://www.promostandards.org/WSDL/OrderStatusService/2.0.0/",
  shipmentNotification: "http://www.promostandards.org/WSDL/OrderShipmentNotificationService/1.0.0/",
  purchaseOrder: "http://www.promostandards.org/WSDL/PurchaseOrderService/1.0.0/",
  invoice: "http://www.promostandards.org/WSDL/InvoiceService/1.0.0/"
} as const;





