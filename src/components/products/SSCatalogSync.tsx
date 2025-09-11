import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle, Clock, RefreshCw, Database, AlertTriangle, Zap } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface SyncStatus {
  supplier: {
    id: string;
    name: string;
    sync_status: 'pending' | 'syncing' | 'complete' | 'error';
    last_sync: string | null;
  };
  productCount: number;
  timestamp: string;
}

interface SyncResult {
  success: boolean;
  totalProducts?: number;
  processedInThisBatch?: number;
  syncedCount?: number;
  errorCount?: number;
  message: string;
  error?: string;
}

export function SSCatalogSync() {
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load current sync status
  const loadSyncStatus = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error: funcError } = await supabase.functions.invoke('ss-catalog-sync', {
        body: { op: 'status' },
      });

      if (funcError) {
        throw new Error(`Failed to load sync status: ${funcError.message}`);
      }

      setSyncStatus(data);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to load sync status';
      setError(errorMsg);
      console.error('❌ Failed to load S&S sync status:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Test S&S API connectivity
  const triggerTestSync = async () => {
    setIsSyncing(true);
    setSyncResult(null);
    setError(null);

    try {
      console.log('🧪 Testing S&S API connectivity...');
      
      const { data, error: funcError } = await supabase.functions.invoke('ss-catalog-sync', {
        body: { op: 'testSync' },
      });

      if (funcError) {
        throw new Error(`Test failed: ${funcError.message}`);
      }

      setSyncResult(data);
      console.log('✅ S&S API test completed:', data);

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'API test failed';
      setError(errorMsg);
      setSyncResult({
        success: false,
        message: errorMsg,
        error: errorMsg,
      });
      console.error('❌ S&S API test failed:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  // Trigger full catalog sync
  const triggerFullSync = async () => {
    setIsSyncing(true);
    setSyncResult(null);
    setError(null);

    try {
      console.log('🚀 Triggering S&S full catalog sync...');
      
      const { data, error: funcError } = await supabase.functions.invoke('ss-catalog-sync', {
        body: { op: 'fullSync', limit: 1 },
      });

      if (funcError) {
        throw new Error(`Sync failed: ${funcError.message}`);
      }

      setSyncResult(data);
      console.log('✅ S&S sync completed:', data);

      // Reload status after sync
      setTimeout(() => {
        loadSyncStatus();
      }, 1000);

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Sync operation failed';
      setError(errorMsg);
      setSyncResult({
        success: false,
        message: errorMsg,
        error: errorMsg,
      });
      console.error('❌ S&S sync failed:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  // Test single product sync (bypass full catalog)
  const triggerTestProduct = async () => {
    setIsSyncing(true);
    setSyncResult(null);
    setError(null);

    try {
      console.log('🧪 Testing single product sync...');
      
      const { data, error: funcError } = await supabase.functions.invoke('ss-catalog-sync', {
        body: { op: 'testProduct' },
      });

      if (funcError) {
        throw new Error(`Test failed: ${funcError.message}`);
      }

      setSyncResult(data);
      console.log('✅ S&S product test completed:', data);

      // Reload status after test
      setTimeout(() => {
        loadSyncStatus();
      }, 1000);

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Test operation failed';
      setError(errorMsg);
      setSyncResult({
        success: false,
        message: errorMsg,
        error: errorMsg,
      });
      console.error('❌ S&S product test failed:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  // Paginated sync - processes one page of products at a time
  const triggerPageSync = async (page: number = 1) => {
    setIsSyncing(true);
    setSyncResult(null);
    setError(null);

    try {
      console.log(`📄 Starting page ${page} sync...`);

      const { data, error: funcError } = await supabase.functions.invoke('ss-catalog-sync', {
        body: { op: 'pageSync', page, pageSize: 25 },
      });

      if (funcError) {
        throw new Error(`Page sync failed: ${funcError.message}`);
      }

      setSyncResult(data);
      console.log(`✅ S&S page ${page} sync completed:`, data);

      // Reload status after sync
      setTimeout(() => {
        loadSyncStatus();
      }, 1000);

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Page sync operation failed';
      setError(errorMsg);
      setSyncResult({
        success: false,
        message: errorMsg,
        error: errorMsg,
      });
      console.error(`❌ S&S page ${page} sync failed:`, err);
    } finally {
      setIsSyncing(false);
    }
  };

  // Debug page fetch - tests just the page fetch without syncing
  const triggerDebugPage = async (page: number = 1) => {
    setIsSyncing(true);
    setSyncResult(null);
    setError(null);

    try {
      console.log(`🔍 Debug: Testing page ${page} fetch...`);

      const { data, error: funcError } = await supabase.functions.invoke('ss-catalog-sync', {
        body: { op: 'debugPage', page, pageSize: 50 },
      });

      if (funcError) {
        throw new Error(`Debug page failed: ${funcError.message}`);
      }

      setSyncResult(data);
      console.log(`✅ Debug page ${page} completed:`, data);

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Debug page operation failed';
      setError(errorMsg);
      setSyncResult({
        success: false,
        message: errorMsg,
        error: errorMsg,
      });
      console.error(`❌ Debug page ${page} failed:`, err);
    } finally {
      setIsSyncing(false);
    }
  };

  // Load status on component mount
  useEffect(() => {
    loadSyncStatus();
  }, []);

  const getSyncStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case 'syncing':
        return <Badge variant="outline"><RefreshCw className="w-3 h-3 mr-1 animate-spin" />Syncing</Badge>;
      case 'complete':
        return <Badge variant="default"><CheckCircle className="w-3 h-3 mr-1" />Complete</Badge>;
      case 'error':
        return <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" />Error</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  const formatLastSync = (lastSync: string | null) => {
    if (!lastSync) return 'Never';
    
    const date = new Date(lastSync);
    const now = new Date();
    const diffHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours} hours ago`;
    return date.toLocaleDateString();
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5" />
              S&S Catalog Sync
            </CardTitle>
            <CardDescription>
              Synchronize S&S Activewear product catalog to local database
            </CardDescription>
          </div>
          <Button 
            onClick={loadSyncStatus}
            variant="outline"
            size="sm"
            disabled={isLoading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Current Status */}
        {syncStatus && (
          <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg">
            <div>
              <div className="text-sm font-medium text-slate-600">Sync Status</div>
              <div className="mt-1">
                {getSyncStatusBadge(syncStatus.supplier.sync_status)}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-slate-600">Products in Database</div>
              <div className="mt-1 text-lg font-semibold">
                {syncStatus.productCount.toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-slate-600">Last Sync</div>
              <div className="mt-1 text-sm">
                {formatLastSync(syncStatus.supplier.last_sync)}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-slate-600">Supplier</div>
              <div className="mt-1 text-sm font-medium">
                {syncStatus.supplier.name}
              </div>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Sync Result Display */}
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
                    {syncResult.totalProducts && (
                      <div>📦 Total available: {syncResult.totalProducts} products</div>
                    )}
                  </div>
                )}
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Sync Progress */}
        {isSyncing && (
          <div className="space-y-2">
            <div className="text-sm font-medium">Syncing S&S catalog...</div>
            <Progress value={undefined} className="w-full" />
            <div className="text-xs text-slate-500">
              This may take several minutes. The process will continue in the background.
            </div>
          </div>
        )}

        {/* Sync Actions */}
        <div className="flex gap-2">
          <Button 
            onClick={triggerTestSync}
            disabled={isSyncing || isLoading}
            variant="outline"
            className="flex-1"
          >
            {isSyncing ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Testing...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 mr-2" />
                🧪 Test API
              </>
            )}
          </Button>
          
          <Button 
            onClick={triggerFullSync}
            disabled={isSyncing || isLoading}
            className="flex-1"
          >
            {isSyncing ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <Database className="w-4 h-4 mr-2" />
                Start Full Sync
              </>
            )}
          </Button>
          
          <Button 
            onClick={triggerTestProduct}
            disabled={isSyncing || isLoading}
            variant="outline"
            className="flex-1"
          >
            {isSyncing ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Testing...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 mr-2" />
                Test Single Product
              </>
            )}
          </Button>
          
          <Button 
            onClick={() => triggerPageSync(1)}
            disabled={isSyncing || isLoading}
            variant="secondary"
            className="flex-1"
          >
            {isSyncing ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Syncing Page...
              </>
            ) : (
              <>
                <Database className="w-4 h-4 mr-2" />
                  📦 Sync 25 Products
              </>
            )}
          </Button>
          
          <Button 
            onClick={() => triggerDebugPage(1)}
            disabled={isSyncing || isLoading}
            variant="outline"
            className="flex-1"
          >
            {isSyncing ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Debugging...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 mr-2" />
                🔍 Debug Page 1
              </>
            )}
          </Button>
        </div>

        {/* Sync Information */}
        <div className="text-xs text-slate-500 space-y-1">
          <div>• <strong>Test API:</strong> Quick connectivity test (few seconds)</div>
          <div>• <strong>Test Single Product:</strong> Sync one hardcoded product (few seconds)</div>
          <div>• <strong>Debug Page 1:</strong> Just fetch product IDs, no sync (for troubleshooting)</div>
          <div>• <strong>Sync Page 1:</strong> Process up to 10 S&S products (under 30 seconds)</div>
          <div>• <strong>Full Sync:</strong> All products at once (may timeout - use Page Sync instead)</div>
        </div>
      </CardContent>
    </Card>
  );
}


