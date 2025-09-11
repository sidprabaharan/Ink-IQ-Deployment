import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { MapPin, Package, Truck, AlertCircle, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { SSProduct } from '@/lib/ss-catalog';

interface InventoryData {
  productId: string;
  parts: Array<{
    partId: string;
    color: string;
    size: string;
    quantityAvailable: number;
    inventoryByLocation: Array<{
      locationId: string;
      locationName: string;
      quantity: number;
      address?: {
        city?: string;
        state?: string;
      };
    }>;
  }>;
}

interface ProductInventoryMatrixProps {
  product: SSProduct;
  onClose?: () => void;
}

export function ProductInventoryMatrix({ product, onClose }: ProductInventoryMatrixProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inventoryData, setInventoryData] = useState<InventoryData | null>(null);
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('all');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadInventoryData();
  }, [product.style_id]);

  const loadInventoryData = async (forceRefresh = false) => {
    if (forceRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      // First check if we have cached data
      if (!forceRefresh) {
        const { data: variants, error: variantsError } = await supabase
          .from('ss_product_variants')
          .select(`
            *,
            ss_inventory_levels(
              *,
              ss_warehouse_locations(*)
            )
          `)
          .eq('product_id', product.id)
          .order('size_label');

        if (variants && variants.length > 0) {
          // Transform database data to inventory format
          const transformedData = transformVariantsToInventory(variants);
          setInventoryData(transformedData);
          setLoading(false);
          return;
        }
      }

      // Fetch fresh data from PromoStandards API
      console.log('Fetching inventory from PromoStandards...');
      const { data: result, error: apiError } = await supabase.functions.invoke('ss-promostandards-soap', {
        body: { 
          op: 'getInventory',
          productId: product.style_id
        }
      });

      if (apiError || !result?.success) {
        throw new Error(apiError?.message || result?.error || 'Failed to fetch inventory');
      }

      setInventoryData(result.data);
    } catch (err) {
      console.error('Error loading inventory:', err);
      setError(err instanceof Error ? err.message : 'Failed to load inventory data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const transformVariantsToInventory = (variants: any[]): InventoryData => {
    return {
      productId: product.style_id,
      parts: variants.map(v => ({
        partId: v.part_id,
        color: v.color_name || 'Default',
        size: v.size_label || 'One Size',
        quantityAvailable: v.ss_inventory_levels?.reduce((sum: number, inv: any) => sum + (inv.quantity_available || 0), 0) || 0,
        inventoryByLocation: v.ss_inventory_levels?.map((inv: any) => ({
          locationId: inv.warehouse_id,
          locationName: inv.ss_warehouse_locations?.name || inv.warehouse_id,
          quantity: inv.quantity_available || 0,
          address: {
            city: inv.ss_warehouse_locations?.city,
            state: inv.ss_warehouse_locations?.state
          }
        })) || []
      }))
    };
  };

  // Group inventory by color and size
  const getInventoryMatrix = () => {
    if (!inventoryData) return { colors: [], sizes: [], matrix: {} };

    const colors = [...new Set(inventoryData.parts.map(p => p.color))].sort();
    const sizes = [...new Set(inventoryData.parts.map(p => p.size))].sort((a, b) => {
      // Sort sizes logically
      const sizeOrder = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL'];
      return sizeOrder.indexOf(a) - sizeOrder.indexOf(b);
    });

    const matrix: Record<string, Record<string, any>> = {};
    
    inventoryData.parts.forEach(part => {
      if (!matrix[part.color]) matrix[part.color] = {};
      
      const quantity = selectedWarehouse === 'all' 
        ? part.quantityAvailable
        : part.inventoryByLocation.find(loc => loc.locationId === selectedWarehouse)?.quantity || 0;
      
      matrix[part.color][part.size] = {
        quantity,
        part
      };
    });

    return { colors, sizes, matrix };
  };

  const { colors, sizes, matrix } = getInventoryMatrix();

  // Get unique warehouses
  const warehouses = inventoryData?.parts[0]?.inventoryByLocation || [];

  const getStockLevelBadge = (quantity: number) => {
    if (quantity === 0) {
      return <Badge variant="destructive" className="text-xs">Out of Stock</Badge>;
    } else if (quantity < 10) {
      return <Badge variant="outline" className="text-xs bg-yellow-50">Low Stock</Badge>;
    } else if (quantity < 50) {
      return <Badge variant="outline" className="text-xs">Limited</Badge>;
    } else {
      return <Badge variant="default" className="text-xs bg-green-50 text-green-700">In Stock</Badge>;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Loading Inventory...</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          {error}
          <Button 
            variant="link" 
            size="sm" 
            onClick={() => loadInventoryData(true)}
            className="ml-2"
          >
            Try Again
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-bold flex items-center gap-2">
            <Package className="w-5 h-5" />
            Inventory & Pricing Matrix
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadInventoryData(true)}
            disabled={refreshing}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>
        
        <div className="text-sm text-gray-600 mt-2">
          {product.name} • {product.style_id}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Warehouse Selector */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium">Warehouse:</span>
          <div className="flex gap-2 flex-wrap">
            <Button
              variant={selectedWarehouse === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedWarehouse('all')}
            >
              <MapPin className="w-3 h-3 mr-1" />
              All Locations
            </Button>
            {warehouses.map(warehouse => (
              <Button
                key={warehouse.locationId}
                variant={selectedWarehouse === warehouse.locationId ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedWarehouse(warehouse.locationId)}
                className="flex items-center gap-1"
              >
                <MapPin className="w-3 h-3" />
                {warehouse.locationId}
                {warehouse.address?.state && (
                  <span className="text-xs opacity-75">
                    ({warehouse.address.city}, {warehouse.address.state})
                  </span>
                )}
              </Button>
            ))}
          </div>
        </div>

        {/* Inventory Matrix */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="border p-2 text-left bg-gray-50">Color</th>
                {sizes.map(size => (
                  <th key={size} className="border p-2 text-center bg-gray-50 min-w-[80px]">
                    {size}
                  </th>
                ))}
                <th className="border p-2 text-center bg-gray-50">Total</th>
              </tr>
            </thead>
            <tbody>
              {colors.map(color => {
                const rowTotal = sizes.reduce((sum, size) => {
                  return sum + (matrix[color]?.[size]?.quantity || 0);
                }, 0);

                return (
                  <tr key={color}>
                    <td className="border p-2 font-medium">
                      <div className="flex items-center gap-2">
                        {color}
                      </div>
                    </td>
                    {sizes.map(size => {
                      const cell = matrix[color]?.[size];
                      const quantity = cell?.quantity || 0;

                      return (
                        <td key={size} className="border p-2 text-center">
                          {cell ? (
                            <div className="space-y-1">
                              <div className="font-semibold text-lg">
                                {quantity}
                              </div>
                              {getStockLevelBadge(quantity)}
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="border p-2 text-center bg-gray-50">
                      <div className="font-bold text-lg">{rowTotal}</div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50">
                <td className="border p-2 font-bold">Total</td>
                {sizes.map(size => {
                  const sizeTotal = colors.reduce((sum, color) => {
                    return sum + (matrix[color]?.[size]?.quantity || 0);
                  }, 0);
                  
                  return (
                    <td key={size} className="border p-2 text-center font-bold">
                      {sizeTotal}
                    </td>
                  );
                })}
                <td className="border p-2 text-center font-bold text-lg">
                  {inventoryData?.parts.reduce((sum, part) => {
                    return sum + (selectedWarehouse === 'all' 
                      ? part.quantityAvailable 
                      : part.inventoryByLocation.find(loc => loc.locationId === selectedWarehouse)?.quantity || 0);
                  }, 0) || 0}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Warehouse Summary */}
        {selectedWarehouse === 'all' && warehouses.length > 0 && (
          <div className="mt-6">
            <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
              <Truck className="w-4 h-4" />
              Inventory by Warehouse
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {warehouses.map(warehouse => {
                const warehouseTotal = inventoryData?.parts.reduce((sum, part) => {
                  const loc = part.inventoryByLocation.find(l => l.locationId === warehouse.locationId);
                  return sum + (loc?.quantity || 0);
                }, 0) || 0;

                return (
                  <div key={warehouse.locationId} className="border rounded-lg p-3 bg-gray-50">
                    <div className="font-semibold">{warehouse.locationName}</div>
                    {warehouse.address && (
                      <div className="text-xs text-gray-600">
                        {warehouse.address.city}, {warehouse.address.state}
                      </div>
                    )}
                    <div className="text-lg font-bold mt-1">{warehouseTotal} units</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Delivery Information */}
        <Alert>
          <Truck className="h-4 w-4" />
          <AlertDescription>
            Estimated delivery times vary by warehouse location. Contact sales for expedited shipping options.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}

