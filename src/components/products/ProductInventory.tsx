import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  MapPin, 
  RefreshCw, 
  Package, 
  Warehouse, 
  AlertTriangle,
  CheckCircle,
  Clock
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { getSSProductInventory } from '@/lib/ss-catalog';

interface WarehouseInventory {
  warehouse_id: string;
  warehouse_name: string;
  total_quantity: number;
  last_updated: string;
}

interface ProductInventoryProps {
  productId: string;
  productName: string;
  styleId?: string;
  className?: string;
}

const WAREHOUSE_LOCATIONS = {
  'IL': { name: 'Illinois', city: 'Lockport', state: 'IL', postalCode: '60441' },
  'KS': { name: 'Kansas', city: 'Olathe', state: 'KS', postalCode: '66061' },
  'NV': { name: 'Nevada', city: 'Reno', state: 'NV', postalCode: '89506' },
  'TX': { name: 'Texas', city: 'Fort Worth', state: 'TX', postalCode: '76137' },
  'GA': { name: 'Georgia', city: 'McDonough', state: 'GA', postalCode: '30253' },
  'NJ': { name: 'New Jersey', city: 'Robbinsville', state: 'NJ', postalCode: '08691' },
  'DS': { name: 'Dropship', city: 'Bolingbrook', state: 'IL', postalCode: '60440' },
};

export function ProductInventory({ productId, productName, styleId, className }: ProductInventoryProps) {
  const [inventory, setInventory] = useState<WarehouseInventory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);

  // Load inventory from local database
  const loadInventoryFromDB = async () => {
    setLoading(true);
    setError(null);

    try {
      console.log(`📦 Loading inventory for product ${productId} from database`);
      
      const inventoryData = await getSSProductInventory(styleId || productId);
      
      setInventory(inventoryData);
      setLastUpdated(new Date().toISOString());
      console.log(`✅ Loaded inventory for ${productId}:`, inventoryData);

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to load inventory';
      setError(errorMsg);
      console.error(`❌ Failed to load inventory for ${productId}:`, err);
    } finally {
      setLoading(false);
    }
  };

  // Load live inventory from S&S API
  const loadLiveInventory = async () => {
    setLoading(true);
    setError(null);

    try {
      console.log(`🌐 Loading LIVE inventory for product ${productId} from S&S API`);

      const { data, error: funcError } = await supabase.functions.invoke('suppliers-ps', {
        body: { op: 'getInventory', params: { productId: styleId || productId } },
      });

      if (funcError) {
        throw new Error(`API Error: ${funcError.message}`);
      }

      // Map API response to warehouse inventory format
      const warehouseInventory: WarehouseInventory[] = [];
      const inventoryMatrix = data?.inventoryMatrix || {};
      const warehouses = data?.warehouses || [];

      warehouses.forEach((warehouseId: string) => {
        const sizes = data?.sizes || [];
        let totalQuantity = 0;

        sizes.forEach((size: string) => {
          const key = `${warehouseId}|${size}`;
          const qty = inventoryMatrix[key] || 0;
          totalQuantity += qty;
        });

        const warehouseInfo = WAREHOUSE_LOCATIONS[warehouseId as keyof typeof WAREHOUSE_LOCATIONS];
        
        warehouseInventory.push({
          warehouse_id: warehouseId,
          warehouse_name: warehouseInfo?.name || warehouseId,
          total_quantity: totalQuantity,
          last_updated: data?.asOf || new Date().toISOString(),
        });
      });

      setInventory(warehouseInventory);
      setLastUpdated(new Date().toISOString());
      console.log(`✅ Loaded LIVE inventory for ${productId}:`, warehouseInventory);

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to load live inventory';
      setError(errorMsg);
      console.error(`❌ Failed to load live inventory for ${productId}:`, err);
    } finally {
      setLoading(false);
    }
  };

  // Auto-refresh inventory every 5 minutes when enabled
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      console.log(`🔄 Auto-refreshing inventory for ${productId}`);
      loadLiveInventory();
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(interval);
  }, [autoRefresh, productId, styleId]);

  // Load inventory on component mount
  useEffect(() => {
    loadInventoryFromDB();
  }, [productId, styleId]);

  const getTotalInventory = () => {
    return inventory.reduce((total, warehouse) => total + warehouse.total_quantity, 0);
  };

  const getInventoryStatus = (quantity: number) => {
    if (quantity === 0) return { label: 'Out of Stock', color: 'destructive' };
    if (quantity < 50) return { label: 'Low Stock', color: 'warning' };
    if (quantity < 200) return { label: 'In Stock', color: 'default' };
    return { label: 'High Stock', color: 'success' };
  };

  const formatLastUpdated = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes} min ago`;
    if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)} hr ago`;
    return date.toLocaleDateString();
  };

  const totalInventory = getTotalInventory();
  const inventoryStatus = getInventoryStatus(totalInventory);

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Package className="w-4 h-4" />
              Inventory Levels
            </CardTitle>
            <CardDescription className="text-xs">
              {productName} • Style: {styleId || productId}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {/* Auto-refresh toggle */}
            <Button
              onClick={() => setAutoRefresh(!autoRefresh)}
              variant="ghost"
              size="sm"
              className={`text-xs ${autoRefresh ? 'bg-green-50 text-green-700' : ''}`}
            >
              {autoRefresh ? <CheckCircle className="w-3 h-3 mr-1" /> : <Clock className="w-3 h-3 mr-1" />}
              Auto-refresh
            </Button>
            
            {/* Manual refresh */}
            <Button
              onClick={loadLiveInventory}
              variant="outline"
              size="sm"
              disabled={loading}
              className="text-xs"
            >
              <RefreshCw className={`w-3 h-3 mr-1 ${loading ? 'animate-spin' : ''}`} />
              Live Update
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Total Inventory Summary */}
        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
          <div>
            <div className="text-sm font-medium text-slate-600">Total Available</div>
            <div className="text-lg font-bold">
              {loading ? <Skeleton className="h-6 w-20" /> : totalInventory.toLocaleString()}
            </div>
          </div>
          <div className="text-right">
            <Badge 
              variant={inventoryStatus.color as any}
              className="text-xs"
            >
              {inventoryStatus.label}
            </Badge>
            {lastUpdated && (
              <div className="text-xs text-slate-500 mt-1">
                Updated {formatLastUpdated(lastUpdated)}
              </div>
            )}
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="flex items-center gap-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Warehouse Inventory Breakdown */}
        <div className="space-y-2">
          <div className="text-sm font-medium text-slate-700">Warehouse Breakdown</div>
          
          {loading ? (
            // Loading skeleton
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex items-center justify-between p-2 border rounded">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-4 rounded" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </div>
          ) : inventory.length === 0 ? (
            <div className="text-center py-4 text-sm text-slate-500">
              No inventory data available
            </div>
          ) : (
            <div className="space-y-1">
              {inventory.map((warehouse) => (
                <div key={warehouse.warehouse_id} className="flex items-center justify-between p-2 border rounded hover:bg-slate-50">
                  <div className="flex items-center gap-2">
                    <Warehouse className="w-4 h-4 text-slate-500" />
                    <div>
                      <div className="text-sm font-medium">{warehouse.warehouse_name}</div>
                      <div className="text-xs text-slate-500">
                        {warehouse.warehouse_id}
                        {WAREHOUSE_LOCATIONS[warehouse.warehouse_id as keyof typeof WAREHOUSE_LOCATIONS] && (
                          <> • {WAREHOUSE_LOCATIONS[warehouse.warehouse_id as keyof typeof WAREHOUSE_LOCATIONS].city}, {WAREHOUSE_LOCATIONS[warehouse.warehouse_id as keyof typeof WAREHOUSE_LOCATIONS].state}</>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold">
                      {warehouse.total_quantity.toLocaleString()}
                    </div>
                    <div className="text-xs text-slate-500">units</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Inventory Distribution Chart */}
        {inventory.length > 0 && totalInventory > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-medium text-slate-700">Distribution</div>
            <div className="space-y-1">
              {inventory.map((warehouse) => {
                const percentage = (warehouse.total_quantity / totalInventory) * 100;
                return (
                  <div key={warehouse.warehouse_id} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span>{warehouse.warehouse_id}</span>
                      <span>{percentage.toFixed(1)}%</span>
                    </div>
                    <Progress value={percentage} className="h-1" />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Last Update Info */}
        <div className="text-xs text-slate-500 pt-2 border-t">
          💡 Inventory updates every 10-30 minutes from S&S warehouses
          {autoRefresh && ' • Auto-refresh enabled (5 min intervals)'}
        </div>
      </CardContent>
    </Card>
  );
}
