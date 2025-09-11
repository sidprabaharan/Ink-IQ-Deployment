import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Download, CheckCircle, AlertCircle, Image } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface PromoStandardsResponse {
  success: boolean;
  productId?: string;
  data?: {
    products?: Array<{
      productId: string;
      productName?: string;
      productBrand?: string;
      description?: string;
      primaryImageURL?: string;
    }>;
  };
  error?: string;
  timestamp?: string;
}

export function PromoStandardsSync() {
  const [productId, setProductId] = useState('B00760');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<PromoStandardsResponse | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [activeOperation, setActiveOperation] = useState<string>('');

  const handleGetProduct = async () => {
    if (!productId.trim()) return;
    
    setIsLoading(true);
    setResult(null);
    
    try {
      const response = await fetch('/functions/v1/ss-promostandards-soap', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          op: 'getProduct',
          productId: productId.trim(),
        }),
      });
      
      const data = await response.json();
      setResult(data);
    } catch (error) {
      setResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSyncProduct = async () => {
    if (!productId.trim()) return;
    
    setIsSyncing(true);
    setResult(null);
    
    try {
      const response = await fetch('/functions/v1/ss-promostandards-soap', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          op: 'syncProduct',
          productId: productId.trim(),
        }),
      });
      
      const data = await response.json();
      setResult(data);
      
      if (data.success) {
        // Refresh the page to show updated product data
        window.location.reload();
      }
    } catch (error) {
      setResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleGetProductSellable = async () => {
    setIsLoading(true);
    setResult(null);
    setActiveOperation('getProductSellable');
    
    try {
      const response = await fetch('/functions/v1/ss-promostandards-soap', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          op: 'getProductSellable',
        }),
      });
      
      const data = await response.json();
      setResult(data);
    } catch (error) {
      setResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      });
    } finally {
      setIsLoading(false);
      setActiveOperation('');
    }
  };

  const handleGetInventory = async () => {
    if (!productId.trim()) return;
    
    setIsLoading(true);
    setResult(null);
    setActiveOperation('getInventory');
    
    try {
      const response = await fetch('/functions/v1/ss-promostandards-soap', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          op: 'getInventory',
          productId: productId.trim(),
        }),
      });
      
      const data = await response.json();
      setResult(data);
    } catch (error) {
      setResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      });
    } finally {
      setIsLoading(false);
      setActiveOperation('');
    }
  };

  const handleSyncMultiple = async () => {
    const commonProducts = ['B00760', 'G500', 'G180', 'G185', 'G200', 'G640'];
    
    setIsSyncing(true);
    setResult(null);
    setActiveOperation('syncMultiple');
    
    try {
      const response = await fetch('/functions/v1/ss-promostandards-soap', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          op: 'syncMultiple',
          productIds: commonProducts,
        }),
      });
      
      const data = await response.json();
      setResult(data);
      
      if (data.success) {
        // Refresh the page to show updated product data
        setTimeout(() => window.location.reload(), 2000);
      }
    } catch (error) {
      setResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      });
    } finally {
      setIsSyncing(false);
      setActiveOperation('');
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Image className="h-5 w-5" />
          PromoStandards SOAP Client
        </CardTitle>
        <CardDescription>
          Get real S&S product data with actual images using PromoStandards WSDL
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* PromoStandards Operations */}
        <div className="space-y-4">
          {/* Get Sellable Products */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Get All Sellable Products</label>
            <Button
              onClick={handleGetProductSellable}
              disabled={isLoading}
              variant="outline"
              className="w-full"
            >
              {isLoading && activeOperation === 'getProductSellable' ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              Get All Sellable Products (PromoStandards)
            </Button>
          </div>

          {/* Single Product Operations */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Product ID Operations</label>
            <div className="flex gap-2 mb-2">
              <Input
                placeholder="Enter S&S Product ID (e.g., B00760)"
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                className="flex-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button
                onClick={handleGetProduct}
                disabled={isLoading || !productId.trim()}
                variant="outline"
                size="sm"
              >
                {isLoading && activeOperation === 'getProduct' ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <Download className="h-4 w-4 mr-1" />
                )}
                Get Product
              </Button>
              <Button
                onClick={handleGetInventory}
                disabled={isLoading || !productId.trim()}
                variant="outline"
                size="sm"
              >
                {isLoading && activeOperation === 'getInventory' ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <Download className="h-4 w-4 mr-1" />
                )}
                Get Inventory
              </Button>
              <Button
                onClick={handleSyncProduct}
                disabled={isSyncing || !productId.trim()}
                size="sm"
              >
                {isSyncing && activeOperation === 'syncProduct' ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <CheckCircle className="h-4 w-4 mr-1" />
                )}
                Sync to DB
              </Button>
            </div>
          </div>
        </div>

        {/* Batch Sync */}
        <div className="pt-4 border-t">
          <label className="text-sm font-medium">Batch Operations</label>
          <Button
            onClick={handleSyncMultiple}
            disabled={isSyncing}
            className="w-full mt-2"
            size="lg"
          >
            {isSyncing && activeOperation === 'syncMultiple' ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Syncing Multiple Products...
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                Sync All Common Products to Database
              </>
            )}
          </Button>
          <p className="text-xs text-muted-foreground mt-1 text-center">
            Syncs: B00760, G500, G180, G185, G200, G640 with real S&S data
          </p>
        </div>

        {/* Results */}
        {result && (
          <div className="space-y-3">
            <Alert className={result.success ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}>
              <div className="flex items-center gap-2">
                {result.success ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-red-600" />
                )}
                <AlertDescription className="font-medium">
                  {result.success ? 'Success!' : 'Error'}
                </AlertDescription>
              </div>
            </Alert>

            {result.success && result.data?.products?.[0] && (
              <Card>
                <CardContent className="pt-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Product ID:</span>
                      <Badge variant="outline">{result.data.products[0].productId}</Badge>
                    </div>
                    {result.data.products[0].productName && (
                      <div className="flex items-center justify-between">
                        <span className="font-medium">Name:</span>
                        <span className="text-sm">{result.data.products[0].productName}</span>
                      </div>
                    )}
                    {result.data.products[0].productBrand && (
                      <div className="flex items-center justify-between">
                        <span className="font-medium">Brand:</span>
                        <Badge>{result.data.products[0].productBrand}</Badge>
                      </div>
                    )}
                    {result.data.products[0].primaryImageURL && (
                      <div className="space-y-2">
                        <span className="font-medium">Primary Image:</span>
                        <div className="flex items-center gap-2">
                          <img
                            src={result.data.products[0].primaryImageURL}
                            alt="Product"
                            className="w-16 h-16 object-cover rounded border"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                          <code className="text-xs bg-gray-100 p-1 rounded flex-1 break-all">
                            {result.data.products[0].primaryImageURL}
                          </code>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {result.error && (
              <Alert className="border-red-200 bg-red-50">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-800">
                  {result.error}
                </AlertDescription>
              </Alert>
            )}

            {result.timestamp && (
              <p className="text-xs text-muted-foreground text-center">
                {new Date(result.timestamp).toLocaleString()}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
