import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Package, 
  Warehouse, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle, 
  Clock,
  MapPin,
  BarChart3,
  Search
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

// Types based on S&S Inventory 2.0.0 structure from SNS.md
interface InventoryLocationData {
  inventoryLocationId: string;
  inventoryLocationName: string;
  city: string;
  country: string;
  postalCode: string;
  quantity: number;
}

interface PartInventoryData {
  partId: string;
  mainPart: boolean;
  partColor: string;
  labelSize: string;
  partDescription: string;
  totalQuantity: number;
  manufacturedItem: boolean;
  locations: InventoryLocationData[];
}

interface InventoryStatus {
  totalInventoryRecords: number;
  totalInventoryQuantity: number;
  uniqueWarehouses: number;
  warehouseTotals: Record<string, number>;
  lastUpdate: string | null;
  timestamp: string;
}

interface SyncResult {
  success: boolean;
  message: string;
  syncedCount?: number;
  errorCount?: number;
  errors?: Array<{ productId: string; error: string }>;
}

interface InventoryResult {
  success: boolean;
  productId: string;
  partInventories: PartInventoryData[];
  totalParts: number;
  totalQuantity: number;
  warehouses: string[];
  asOf: string;
}

export function SSInventoryManager() {
  const [inventoryStatus, setInventoryStatus] = useState<InventoryStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Individual product lookup
  const [lookupProductId, setLookupProductId] = useState('');
  const [lookupResult, setLookupResult] = useState<InventoryResult | null>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);

  // Load inventory status
  const loadInventoryStatus = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error: funcError } = await supabase.functions.invoke('ss-inventory-sync', {
        body: { op: 'status' },
      });

      if (funcError) {
        throw new Error(`Failed to load inventory status: ${funcError.message}`);
      }

      setInventoryStatus(data);
      console.log('📦 Inventory status loaded:', data);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to load inventory status';
      setError(errorMsg);
      console.error('❌ Failed to load inventory status:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Trigger inventory sync
  const triggerInventorySync = async (limit: number = 5) => {
    setIsSyncing(true);
    setSyncResult(null);
    setError(null);

    try {
      console.log(`🔄 Triggering inventory sync for ${limit} products...`);
      
      const { data, error: funcError } = await supabase.functions.invoke('ss-inventory-sync', {
        body: { op: 'syncInventory', params: { limit } },
      });

      if (funcError) {
        throw new Error(`Inventory sync failed: ${funcError.message}`);
      }

      setSyncResult(data);
      console.log('✅ Inventory sync completed:', data);

      // Reload status after sync
      setTimeout(() => {
        loadInventoryStatus();
      }, 1000);

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Inventory sync failed';
      setError(errorMsg);
      setSyncResult({
        success: false,
        message: errorMsg,
      });
      console.error('❌ Inventory sync failed:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  // Look up inventory for specific product
  const lookupProductInventory = async () => {
    if (!lookupProductId.trim()) return;
    
    setIsLookingUp(true);
    setLookupResult(null);
    setError(null);

    try {
      console.log(`🔍 Looking up inventory for product: ${lookupProductId}`);
      
      const { data, error: funcError } = await supabase.functions.invoke('ss-inventory-sync', {
        body: { op: 'getInventory', params: { productId: lookupProductId.trim() } },
      });

      if (funcError) {
        throw new Error(`Inventory lookup failed: ${funcError.message}`);
      }

      setLookupResult(data);
      console.log('✅ Inventory lookup completed:', data);

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Inventory lookup failed';
      setError(errorMsg);
      console.error('❌ Inventory lookup failed:', err);
    } finally {
      setIsLookingUp(false);
    }
  };

  // Load status on component mount
  useEffect(() => {
    loadInventoryStatus();
  }, []);

  const formatLastUpdate = (lastUpdate: string | null) => {
    if (!lastUpdate) return 'Never';
    
    const date = new Date(lastUpdate);
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes} minutes ago`;
    
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours} hours ago`;
    
    return date.toLocaleDateString();
  };

  // Get warehouse display name mapping (based on SNS.md sample data)
  const getWarehouseName = (warehouseId: string): string => {
    const warehouseNames: Record<string, string> = {
      'NJ': 'Robbinsville, NJ',
      'KS': 'Olathe, KS', 
      'DS': 'Dropship',
      'TX': 'Fort Worth, TX',
      'GA': 'McDonough, GA',
      'NV': 'Reno, NV',
      'IL': 'Lockport, IL',
    };
    return warehouseNames[warehouseId] || warehouseId;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5" />
                S&S Inventory Management
              </CardTitle>
              <CardDescription>
                Real-time warehouse inventory tracking using S&S Inventory 2.0.0 API
              </CardDescription>
            </div>
            <Button 
              onClick={loadInventoryStatus}
              variant="outline"
              size="sm"
              disabled={isLoading}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        
        <CardContent>
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="sync">Sync Control</TabsTrigger>
              <TabsTrigger value="lookup">Product Lookup</TabsTrigger>
            </TabsList>
            
            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-4">
              {inventoryStatus && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-slate-50 p-4 rounded-lg">
                    <div className="text-sm font-medium text-slate-600">Total Records</div>
                    <div className="text-2xl font-bold">
                      {inventoryStatus.totalInventoryRecords.toLocaleString()}
                    </div>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-lg">
                    <div className="text-sm font-medium text-slate-600">Total Inventory</div>
                    <div className="text-2xl font-bold">
                      {inventoryStatus.totalInventoryQuantity.toLocaleString()}
                    </div>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-lg">
                    <div className="text-sm font-medium text-slate-600">Warehouses</div>
                    <div className="text-2xl font-bold">
                      {inventoryStatus.uniqueWarehouses}
                    </div>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-lg">
                    <div className="text-sm font-medium text-slate-600">Last Update</div>
                    <div className="text-sm font-semibold">
                      {formatLastUpdate(inventoryStatus.lastUpdate)}
                    </div>
                  </div>
                </div>
              )}
              
              {/* Warehouse Breakdown */}
              {inventoryStatus && Object.keys(inventoryStatus.warehouseTotals).length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <Warehouse className="w-5 h-5" />
                    Warehouse Inventory
                  </h3>
                  <div className="grid gap-3">
                    {Object.entries(inventoryStatus.warehouseTotals)
                      .sort(([,a], [,b]) => b - a)
                      .map(([warehouseId, quantity]) => (
                      <div key={warehouseId} className="flex items-center justify-between p-3 bg-slate-50 rounded">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-slate-500" />
                          <span className="font-medium">{getWarehouseName(warehouseId)}</span>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold">{quantity.toLocaleString()}</div>
                          <div className="text-xs text-slate-500">units</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>
            
            {/* Sync Control Tab */}
            <TabsContent value="sync" className="space-y-4">
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Button 
                    onClick={() => triggerInventorySync(5)}
                    disabled={isSyncing}
                    className="flex-1"
                  >
                    {isSyncing ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Syncing...
                      </>
                    ) : (
                      <>
                        <Package className="w-4 h-4 mr-2" />
                        Sync 5 Products
                      </>
                    )}
                  </Button>
                  
                  <Button 
                    onClick={() => triggerInventorySync(15)}
                    disabled={isSyncing}
                    variant="outline"
                  >
                    Sync 15 Products
                  </Button>
                </div>
                
                {/* Sync Progress */}
                {isSyncing && (
                  <div className="space-y-2">
                    <div className="text-sm font-medium">Syncing inventory data from S&S...</div>
                    <Progress value={undefined} className="w-full" />
                    <div className="text-xs text-slate-500">
                      Fetching warehouse-level inventory using S&S Inventory 2.0.0 API
                    </div>
                  </div>
                )}
                
                {/* Sync Result */}
                {syncResult && (
                  <Alert variant={syncResult.success ? "default" : "destructive"}>
                    {syncResult.success ? (
                      <CheckCircle className="h-4 w-4" />
                    ) : (
                      <AlertCircle className="h-4 w-4" />
                    )}
                    <AlertDescription>
                      <div className="space-y-2">
                        <div>{syncResult.message}</div>
                        {syncResult.success && syncResult.syncedCount !== undefined && (
                          <div className="text-sm space-y-1">
                            <div>✅ Synced: {syncResult.syncedCount} products</div>
                            {syncResult.errorCount !== undefined && syncResult.errorCount > 0 && (
                              <div>❌ Errors: {syncResult.errorCount} products</div>
                            )}
                            {syncResult.errors && syncResult.errors.length > 0 && (
                              <details className="mt-2">
                                <summary className="cursor-pointer text-xs">View Errors</summary>
                                <div className="mt-1 space-y-1">
                                  {syncResult.errors.slice(0, 5).map((err, i) => (
                                    <div key={i} className="text-xs bg-red-50 p-1 rounded">
                                      {err.productId}: {err.error}
                                    </div>
                                  ))}
                                </div>
                              </details>
                            )}
                          </div>
                        )}
                      </div>
                    </AlertDescription>
                  </Alert>
                )}
                
                {/* Sync Information */}
                <div className="text-xs text-slate-500 space-y-1">
                  <div>• Inventory sync uses S&S Inventory 2.0.0 PromoStandards API</div>
                  <div>• Captures warehouse-level inventory for all product variants</div>
                  <div>• Based on SNS.md documentation: NJ, KS, TX, GA, NV, IL warehouses</div>
                  <div>• Recommended sync frequency: Every 30 minutes for high-traffic products</div>
                </div>
              </div>
            </TabsContent>
            
            {/* Product Lookup Tab */}
            <TabsContent value="lookup" className="space-y-4">
              <div className="space-y-4">
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Label htmlFor="product-lookup">Product/Style ID</Label>
                    <Input
                      id="product-lookup"
                      placeholder="Enter S&S product ID (e.g., B00760, 2000)"
                      value={lookupProductId}
                      onChange={(e) => setLookupProductId(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && lookupProductInventory()}
                    />
                  </div>
                  <div className="flex items-end">
                    <Button 
                      onClick={lookupProductInventory}
                      disabled={isLookingUp || !lookupProductId.trim()}
                    >
                      {isLookingUp ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Search className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
                
                {/* Lookup Result */}
                {lookupResult && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
                      <div>
                        <div className="font-semibold">Product {lookupResult.productId}</div>
                        <div className="text-sm text-slate-600">
                          {lookupResult.totalParts} variants • {lookupResult.totalQuantity.toLocaleString()} total units
                        </div>
                      </div>
                      <div className="text-xs text-slate-500">
                        Updated: {formatLastUpdate(lookupResult.asOf)}
                      </div>
                    </div>
                    
                    {/* Variant Inventory Table */}
                    {lookupResult.partInventories.length > 0 && (
                      <div>
                        <h4 className="font-semibold mb-2">Variant Inventory</h4>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Part ID</TableHead>
                              <TableHead>Color</TableHead>
                              <TableHead>Size</TableHead>
                              <TableHead>Total</TableHead>
                              <TableHead>Warehouses</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {lookupResult.partInventories.map((part) => (
                              <TableRow key={part.partId}>
                                <TableCell className="font-mono text-sm">{part.partId}</TableCell>
                                <TableCell>{part.partColor}</TableCell>
                                <TableCell>
                                  <Badge variant="outline">{part.labelSize}</Badge>
                                </TableCell>
                                <TableCell className="font-semibold">
                                  {part.totalQuantity.toLocaleString()}
                                </TableCell>
                                <TableCell>
                                  <div className="flex gap-1 flex-wrap">
                                    {part.locations.map((loc) => (
                                      <Badge 
                                        key={loc.inventoryLocationId} 
                                        variant="secondary"
                                        className="text-xs"
                                      >
                                        {loc.inventoryLocationId}: {loc.quantity}
                                      </Badge>
                                    ))}
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
          
          {/* Error Display */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

