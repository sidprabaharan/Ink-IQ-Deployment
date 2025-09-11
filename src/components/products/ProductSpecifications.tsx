import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Package, Ruler, Truck, AlertCircle, CheckCircle, Box } from 'lucide-react';
import { SSProduct } from '@/lib/ss-catalog';

interface ProductSpecificationsProps {
  product: SSProduct & {
    weight?: number;
    width?: number;
    height?: number;
    depth?: number;
    units_per_carton?: number;
    carton_weight?: number;
    carton_width?: number;
    carton_height?: number;
    carton_depth?: number;
    is_closeout?: boolean;
    is_rush_service?: boolean;
    gtin?: string;
    country_of_origin?: string;
  };
}

export function ProductSpecifications({ product }: ProductSpecificationsProps) {
  const hasSpecs = product.weight || product.width || product.units_per_carton;
  
  if (!hasSpecs) {
    return null;
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Package className="w-5 h-5" />
          Product Specifications
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="product" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="product">Product Details</TabsTrigger>
            <TabsTrigger value="shipping">Shipping Info</TabsTrigger>
            <TabsTrigger value="availability">Availability</TabsTrigger>
          </TabsList>
          
          <TabsContent value="product" className="space-y-4">
            {/* Dimensions */}
            {(product.width || product.height || product.depth || product.weight) && (
              <div className="border rounded-lg p-4">
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <Ruler className="w-4 h-4" />
                  Product Dimensions
                </h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {product.width && (
                    <div>
                      <span className="text-gray-600">Width:</span>
                      <span className="ml-2 font-medium">{product.width}"</span>
                    </div>
                  )}
                  {product.height && (
                    <div>
                      <span className="text-gray-600">Height:</span>
                      <span className="ml-2 font-medium">{product.height}"</span>
                    </div>
                  )}
                  {product.depth && (
                    <div>
                      <span className="text-gray-600">Depth:</span>
                      <span className="ml-2 font-medium">{product.depth}"</span>
                    </div>
                  )}
                  {product.weight && (
                    <div>
                      <span className="text-gray-600">Weight:</span>
                      <span className="ml-2 font-medium">{product.weight} oz</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Additional Info */}
            <div className="space-y-2 text-sm">
              {product.gtin && (
                <div>
                  <span className="text-gray-600">GTIN/UPC:</span>
                  <span className="ml-2 font-mono">{product.gtin}</span>
                </div>
              )}
              {product.country_of_origin && (
                <div>
                  <span className="text-gray-600">Country of Origin:</span>
                  <span className="ml-2">{product.country_of_origin}</span>
                </div>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="shipping" className="space-y-4">
            {/* Packaging Info */}
            {(product.units_per_carton || product.carton_weight) && (
              <div className="border rounded-lg p-4">
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <Box className="w-4 h-4" />
                  Carton Information
                </h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {product.units_per_carton && (
                    <div>
                      <span className="text-gray-600">Units per Carton:</span>
                      <span className="ml-2 font-medium">{product.units_per_carton}</span>
                    </div>
                  )}
                  {product.carton_weight && (
                    <div>
                      <span className="text-gray-600">Carton Weight:</span>
                      <span className="ml-2 font-medium">{product.carton_weight} lbs</span>
                    </div>
                  )}
                  {product.carton_width && (
                    <div>
                      <span className="text-gray-600">Carton Width:</span>
                      <span className="ml-2 font-medium">{product.carton_width}"</span>
                    </div>
                  )}
                  {product.carton_height && (
                    <div>
                      <span className="text-gray-600">Carton Height:</span>
                      <span className="ml-2 font-medium">{product.carton_height}"</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-sm text-blue-800">
                <Truck className="w-4 h-4 inline mr-2" />
                Shipping estimates vary by warehouse location and selected shipping method.
              </p>
            </div>
          </TabsContent>
          
          <TabsContent value="availability" className="space-y-4">
            <div className="flex gap-3">
              {product.is_closeout && (
                <Badge variant="destructive" className="flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Closeout Item
                </Badge>
              )}
              {product.is_rush_service && (
                <Badge variant="default" className="flex items-center gap-1 bg-green-100 text-green-800">
                  <CheckCircle className="w-3 h-3" />
                  Rush Service Available
                </Badge>
              )}
              {!product.is_closeout && !product.is_rush_service && (
                <Badge variant="outline" className="flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" />
                  Regular Stock Item
                </Badge>
              )}
            </div>
            
            {product.is_closeout && (
              <div className="bg-red-50 p-4 rounded-lg">
                <p className="text-sm text-red-800">
                  <AlertCircle className="w-4 h-4 inline mr-2" />
                  This is a closeout item with limited availability. Once sold out, it will not be restocked.
                </p>
              </div>
            )}
            
            {product.is_rush_service && (
              <div className="bg-green-50 p-4 rounded-lg">
                <p className="text-sm text-green-800">
                  <CheckCircle className="w-4 h-4 inline mr-2" />
                  Rush service is available for this product. Contact sales for expedited production and delivery options.
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
