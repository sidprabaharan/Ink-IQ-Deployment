import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ExternalLink, ShoppingCart, Palette, Star } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { SSProduct } from '@/lib/ss-catalog';

interface SSProductsShowcaseProps {
  limit?: number;
}

export function SSProductsShowcase({ limit = 6 }: SSProductsShowcaseProps) {
  const [products, setProducts] = useState<SSProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    } catch (err) {
      console.error('Failed to load S&S products:', err);
      setError(err instanceof Error ? err.message : 'Failed to load products');
    } finally {
      setLoading(false);
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

                <Separator />

                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>Updated {new Date(product.last_synced).toLocaleDateString()}</span>
                  <Button variant="ghost" size="sm" className="h-6 text-xs p-1">
                    View Details
                    <ExternalLink className="w-3 h-3 ml-1" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
