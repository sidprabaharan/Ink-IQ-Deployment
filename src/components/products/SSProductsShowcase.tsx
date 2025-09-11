import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ExternalLink, ShoppingCart, Palette, Star, Info, ChevronDown, ChevronUp, Package } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { SSProduct } from '@/lib/ss-catalog';
import { ProductInventoryMatrix } from './ProductInventoryMatrix';
import { ProductSpecifications } from './ProductSpecifications';
import { ShippingCalculator } from './ShippingCalculator';

interface SSProductsShowcaseProps {
  limit?: number;
}

export function SSProductsShowcase({ limit = 6 }: SSProductsShowcaseProps) {
  const [products, setProducts] = useState<SSProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedDescriptions, setExpandedDescriptions] = useState<Record<string, boolean>>({});
  const [selectedProduct, setSelectedProduct] = useState<SSProduct | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [inventoryData, setInventoryData] = useState<Record<string, any>>({});

  useEffect(() => {
    loadLatestProducts();
  }, [limit]);

  const loadLatestProducts = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get latest S&S products with enhanced data (images + pricing)
      const { data, error: queryError } = await supabase
        .from('ss_products')
        .select('*')
        .eq('sync_status', 'active')
        .not('primary_image_url', 'is', null)
        .order('last_synced', { ascending: false })
        .limit(limit);

      if (queryError) throw queryError;

      setProducts(data || []);
      
      // Load inventory summary for each product
      if (data && data.length > 0) {
        loadInventorySummaries(data);
      }
    } catch (err) {
      console.error('Failed to load S&S products:', err);
      setError(err instanceof Error ? err.message : 'Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const loadInventorySummaries = async (products: SSProduct[]) => {
    for (const product of products) {
      try {
        // Get variant count and total stock
        const { data: variants } = await supabase
          .from('ss_product_variants')
          .select(`
            id,
            ss_inventory_levels(quantity_available)
          `)
          .eq('product_id', product.id);

        if (variants && variants.length > 0) {
          const totalStock = variants.reduce((sum, v) => {
            const stock = v.ss_inventory_levels?.reduce((s: number, inv: any) => s + (inv.quantity_available || 0), 0) || 0;
            return sum + stock;
          }, 0);

          setInventoryData(prev => ({
            ...prev,
            [product.id]: {
              variantCount: variants.length,
              totalStock,
              hasStock: totalStock > 0
            }
          }));
        }
      } catch (err) {
        console.error(`Error loading inventory for ${product.style_id}:`, err);
      }
    }
  };

  const formatPrice = (minPrice: number | null, maxPrice: number | null, currency: string = 'USD') => {
    if (!minPrice) return 'Price on request';
    if (!maxPrice || minPrice === maxPrice) {
      return `$${minPrice.toFixed(2)}`;
    }
    return `$${minPrice.toFixed(2)} - $${maxPrice.toFixed(2)}`;
  };

  const getImageUrl = (imageUrl: string | null) => {
    if (!imageUrl) return null;
    
    // If it's already a full URL, use it
    if (imageUrl.startsWith('http')) return imageUrl;
    
    // If it's a relative S&S path, convert to full URL
    const baseUrl = 'https://images.ssactivewear.com/';
    if (imageUrl.startsWith('Images/')) {
      return `${baseUrl}${imageUrl}`;
    }
    return `${baseUrl}Images/${imageUrl}`;
  };

  const processBrandName = (brand: string | null) => {
    if (!brand || brand === 'S&S Activewear') return 'S&S';
    return brand;
  };

  const toggleDescription = (productId: string) => {
    setExpandedDescriptions(prev => ({
      ...prev,
      [productId]: !prev[productId]
    }));
  };

  const openProductDetail = (product: SSProduct) => {
    setSelectedProduct(product);
    setShowDetailModal(true);
  };

  const formatDescription = (description: string | null | undefined) => {
    if (!description) return [];
    return description.split('\n').filter(line => line.trim().startsWith('•'));
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="w-5 h-5" />
            Latest S&S Products
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="bg-gray-200 aspect-square rounded-lg mb-3"></div>
                <div className="bg-gray-200 h-4 rounded mb-2"></div>
                <div className="bg-gray-200 h-3 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="w-5 h-5" />
            Latest S&S Products
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-red-600 mb-4">{error}</p>
            <Button onClick={loadLatestProducts} variant="outline">
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (products.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="w-5 h-5" />
            Latest S&S Products
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-gray-600 mb-4">No S&S products with images found.</p>
            <p className="text-sm text-gray-500">Run "📦 Sync 10 Products" to get products with images!</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Star className="w-5 h-5 text-blue-600" />
          Latest S&S Products  
          <Badge variant="secondary" className="ml-2">
            {products.length} with images
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((product) => (
            <div key={product.id} className="group">
              <div className="relative overflow-hidden rounded-lg bg-gray-100 aspect-square mb-4">
                {getImageUrl(product.primary_image_url) ? (
                  <img
                    src={getImageUrl(product.primary_image_url)!}
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                    <div className="text-center">
                      <div className="w-16 h-16 mx-auto mb-2 bg-gray-200 rounded-lg flex items-center justify-center">
                        <span className="text-2xl">📦</span>
                      </div>
                      <p className="text-sm">No Image</p>
                    </div>
                  </div>
                )}
                
                {/* Product badges */}
                <div className="absolute top-2 left-2 flex flex-col gap-1">
                  {product.is_closeout && (
                    <Badge variant="destructive" className="text-xs">
                      Closeout
                    </Badge>
                  )}
                  {product.is_on_demand && (
                    <Badge variant="outline" className="text-xs bg-white">
                      On Demand
                    </Badge>
                  )}
                </div>

                {/* Hover overlay */}
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-opacity duration-200 flex items-center justify-center">
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex gap-2">
                    <Button size="sm" variant="secondary">
                      <ShoppingCart className="w-4 h-4 mr-1" />
                      Add to Cart
                    </Button>
                    <Button size="sm" variant="outline">
                      <Palette className="w-4 h-4 mr-1" />
                      Customize
                    </Button>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm line-clamp-2 text-gray-900">
                      {product.name}
                    </h3>
                    <p className="text-xs text-gray-600 mt-1">
                      <span className="font-medium">{product.sku}</span>
                      {product.brand && (
                        <>
                          {' • '}
                          <span>{processBrandName(product.brand)}</span>
                        </>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-green-600">
                    {formatPrice(product.min_price, product.max_price, product.currency)}
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {product.category || 'Apparel'}
                  </Badge>
                </div>

                {/* Quick Inventory Status */}
                <div className="flex items-center gap-2 text-xs">
                  <Package className="w-3 h-3 text-gray-500" />
                  <span className="text-gray-600">
                    {inventoryData[product.id] ? (
                      inventoryData[product.id].hasStock ? (
                        <>
                          {inventoryData[product.id].variantCount} variants • {inventoryData[product.id].totalStock.toLocaleString()} units in stock
                        </>
                      ) : (
                        'Check availability'
                      )
                    ) : (
                      'Loading inventory...'
                    )}
                  </span>
                </div>

                {/* Colors preview */}
                {product.colors && Array.isArray(product.colors) && product.colors.length > 0 && (
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-gray-500">Colors:</span>
                    <div className="flex gap-1">
                      {product.colors.slice(0, 5).map((color: any, index: number) => {
                        const colorHex = color.hex || color.color_hex || '#ccc';
                        return (
                          <div
                            key={index}
                            className="w-3 h-3 rounded-full border border-gray-300"
                            style={{ backgroundColor: colorHex }}
                            title={color.name || color.color_name || 'Color'}
                          />
                        );
                      })}
                      {product.colors.length > 5 && (
                        <span className="text-xs text-gray-500">
                          +{product.colors.length - 5}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Additional images indicator */}
                {product.images && Array.isArray(product.images) && product.images.length > 0 && (
                  <div className="text-xs text-gray-500">
                    📷 {product.images.length + 1} images available
                  </div>
                )}

                {/* Description section */}
                {product.description && (
                  <div className="mt-2">
                    <button
                      onClick={() => toggleDescription(product.id)}
                      className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 transition-colors"
                    >
                      {expandedDescriptions[product.id] ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      {expandedDescriptions[product.id] ? 'Hide' : 'Show'} Specifications
                    </button>
                    
                    {expandedDescriptions[product.id] && (
                      <div className="mt-2 p-3 bg-gray-50 rounded-md text-xs space-y-1 border border-gray-100">
                        {formatDescription(product.description).slice(0, 4).map((line, idx) => (
                          <div key={idx} className="text-gray-700">{line}</div>
                        ))}
                        {formatDescription(product.description).length > 4 && (
                          <button
                            onClick={() => openProductDetail(product)}
                            className="text-blue-600 hover:text-blue-700 font-medium mt-2"
                          >
                            View All Specifications →
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <Separator />

                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>Updated {new Date(product.last_synced).toLocaleDateString()}</span>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-6 text-xs p-1"
                    onClick={() => openProductDetail(product)}
                  >
                    View Full Details
                    <Info className="w-3 h-3 ml-1" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>

    {/* Product Detail Modal */}
    <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        {selectedProduct && (
          <>
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">
                {selectedProduct.name}
              </DialogTitle>
              <DialogDescription className="text-sm text-gray-600">
                <span className="font-medium">{selectedProduct.sku}</span>
                {selectedProduct.brand && (
                  <>
                    {' • '}
                    <span>{processBrandName(selectedProduct.brand)}</span>
                  </>
                )}
                {selectedProduct.category && (
                  <>
                    {' • '}
                    <span>{selectedProduct.category}</span>
                  </>
                )}
              </DialogDescription>
            </DialogHeader>

            <Tabs defaultValue="overview" className="mt-6">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="overview">Overview & Specifications</TabsTrigger>
                <TabsTrigger value="inventory">
                  <Package className="w-4 h-4 mr-2" />
                  Inventory & Pricing
                </TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-6">
                {/* Product Image */}
                {getImageUrl(selectedProduct.primary_image_url) && (
                  <div className="relative aspect-square w-full max-w-md mx-auto bg-gray-100 rounded-lg overflow-hidden">
                    <img
                      src={getImageUrl(selectedProduct.primary_image_url)!}
                      alt={selectedProduct.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                {/* Price */}
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {formatPrice(selectedProduct.min_price, selectedProduct.max_price, selectedProduct.currency)}
                  </div>
                  <p className="text-sm text-gray-500 mt-1">Price varies by quantity and options</p>
                </div>

                {/* Full Specifications */}
                {selectedProduct.description && (
                  <div>
                    <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                      <Info className="w-5 h-5" />
                      Product Specifications
                    </h3>
                    <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                      {formatDescription(selectedProduct.description).map((line, idx) => (
                        <div key={idx} className="text-sm text-gray-700 flex items-start">
                          <span className="mr-2">{line}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {/* Additional Product Info */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                {selectedProduct.is_closeout && (
                  <div className="flex items-center gap-2">
                    <Badge variant="destructive">Closeout Item</Badge>
                    <span className="text-xs text-gray-500">Limited availability</span>
                  </div>
                )}
                {selectedProduct.is_on_demand && (
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">On Demand</Badge>
                    <span className="text-xs text-gray-500">Made to order</span>
                  </div>
                )}
                {selectedProduct.colors && selectedProduct.colors.length > 0 && (
                  <div className="col-span-2">
                    <span className="font-medium">Available Colors:</span>
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {selectedProduct.colors.map((color: any, index: number) => {
                        const colorHex = color.hex || color.color_hex || '#ccc';
                        return (
                          <div
                            key={index}
                            className="w-6 h-6 rounded-full border border-gray-300 relative group"
                            style={{ backgroundColor: colorHex }}
                          >
                            <span className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                              {color.name || color.color_name || 'Color'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4">
                  <Button className="flex-1" size="lg">
                    <ShoppingCart className="w-4 h-4 mr-2" />
                    Add to Cart
                  </Button>
                  <Button variant="outline" size="lg" className="flex-1">
                    <Palette className="w-4 h-4 mr-2" />
                    Customize Design
                  </Button>
                </div>

                {/* Product Specifications Component */}
                <ProductSpecifications product={selectedProduct as any} />
              </TabsContent>

              <TabsContent value="inventory" className="mt-6">
                <ProductInventoryMatrix product={selectedProduct} />
              </TabsContent>
            </Tabs>
          </>
        )}
      </DialogContent>
    </Dialog>
    </>
  );
}
