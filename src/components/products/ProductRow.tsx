
import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, ExternalLink, ShoppingCart, Palette } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { toast } from "sonner";
import { useCartManager } from '@/context/CartManagerContext';
import { CartItem } from '@/types/cart';
import { ProductCustomizationDialog } from './ProductCustomizationDialog';
import { getSupplierById } from '@/lib/promostandards/registry';

type Supplier = {
  name: string;
  price: number;
  inventory: number;
  inventoryByWarehouseSize?: Record<string, Record<string, number>>;
};

type Product = {
  id: number;
  sku: string;
  name: string;
  category: string;
  suppliers: Supplier[];
  lowestPrice: number;
  image?: string;
  colors?: string[];
};

interface ProductRowProps {
  product: Product;
  showVendors: boolean;
  showPrices: boolean;
  resultsAsOf?: string | null;
}

export function ProductRow({ product, showVendors, showPrices, resultsAsOf }: ProductRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [expandedColor, setExpandedColor] = useState<string | null>(null);
  const [showAllColors, setShowAllColors] = useState(false);
  const [quantities, setQuantities] = useState<Record<string, Record<string, number>>>({});
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [showCustomizationDialog, setShowCustomizationDialog] = useState(false);
  const { addToCart, activeCart, createCart } = useCartManager();
  const [loadingInv, setLoadingInv] = useState(false);
  const [inventoryAsOf, setInventoryAsOf] = useState<string | null>(null);
  
  const sizes = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'];
  const dynamicLocations = React.useMemo(() => {
    const whs = selectedSupplier?.inventoryByWarehouseSize
      ? Object.keys(selectedSupplier.inventoryByWarehouseSize)
      : [];
    if (whs.length > 0) return whs;
    // Use actual S&S warehouse locations as fallback
    return ['Lockport, IL', 'Farmers Branch, TX', 'Robbinsville, NJ', 'Lithia Springs, GA', 'Reno, NV', 'Olathe, KS'];
  }, [selectedSupplier]);
  
  // Select first color as default expanded color
  useEffect(() => {
    if (product.colors && product.colors.length > 0 && !expandedColor) {
      setExpandedColor(product.colors[0]);
    }
  }, [product.colors, expandedColor]);
  
  const handleSupplierClick = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setExpanded(true);
    if (!supplier.inventoryByWarehouseSize && product?.sku) {
      const ss = getSupplierById('ss') as any;
      if (ss && ss.getInventoryBySku) {
        setLoadingInv(true);
        ss.getInventoryBySku(product.sku)
          .then((inv: any) => {
            if (!inv) return;
            const byWh: Record<string, Record<string, number>> = {};
            (inv.byWarehouse || []).forEach((w: any) => {
              byWh[w.warehouseName || w.warehouseId] = w.bySize || {};
            });
            setSelectedSupplier(prev => prev ? { ...prev, inventoryByWarehouseSize: byWh } : prev);
            if (inv.asOf) setInventoryAsOf(inv.asOf);
          })
          .finally(() => setLoadingInv(false));
      }
    }
  };

  const toggleShowAllColors = () => {
    setShowAllColors(!showAllColors);
  };
  
  const handleQuantityChange = (location: string, size: string, value: string) => {
    const numValue = value === '' ? 0 : Math.max(0, parseInt(value, 10) || 0);
    
    setQuantities(prev => ({
      ...prev,
      [location]: {
        ...(prev[location] || {}),
        [size]: numValue
      }
    }));
  };
  
  const getTotalQuantity = () => {
    let total = 0;
    Object.values(quantities).forEach(locationQuantities => {
      Object.values(locationQuantities).forEach(qty => {
        total += qty;
      });
    });
    return total;
  };
  
  const handleAddToCart = () => {
    console.log('🛒 handleAddToCart called');
    console.log('🛒 Current quantities:', quantities);
    console.log('🛒 Selected supplier:', selectedSupplier);
    console.log('🛒 Active cart:', activeCart);
    
    const total = getTotalQuantity();
    console.log('🛒 Total quantity:', total);
    
    if (total === 0) {
      console.log('🛒 No items selected');
      toast.error("Please select at least one item to add to cart");
      return;
    }
    
    if (!selectedSupplier) {
      console.log('🛒 No supplier selected');
      toast.error("Please select a supplier first");
      return;
    }

    // Create a cart if none exists
    let currentCartId = activeCart?.id;
    if (!currentCartId) {
      console.log('🛒 No active cart, creating new one...');
      currentCartId = createCart();
      console.log('🛒 Created cart with ID:', currentCartId);
    } else {
      console.log('🛒 Using existing cart ID:', currentCartId);
    }
    
    // Format the cart item
    const cartQuantities = [];
    for (const location in quantities) {
      for (const size in quantities[location]) {
        const quantity = quantities[location][size];
        if (quantity > 0) {
          cartQuantities.push({
            location,
            size,
            quantity
          });
        }
      }
    }
    console.log('🛒 Cart quantities:', cartQuantities);
    
    const cartItem: CartItem = {
      id: product.id,
      sku: product.sku,
      name: product.name,
      category: product.category,
      price: selectedSupplier.price,
      supplierName: selectedSupplier.name,
      image: product.image,
      quantities: cartQuantities,
      totalQuantity: total
    };
    console.log('🛒 Cart item to add:', cartItem);
    
    // Add to cart
    console.log('🛒 Calling addToCart with cartId:', currentCartId);
    addToCart(currentCartId, cartItem);
    
    // Show success message
    toast.success(`Added ${total} items to cart`);
    
    // Reset quantities after adding to cart
    setQuantities({});
    console.log('🛒 Quantities reset');
  };
  
  return (
    <Card className="overflow-hidden mb-4">
      <CardContent className="p-0">
        {/* Basic Product Row */}
        <div className="flex border-b">
          {/* Product Image & Basic Info - Now 50% width */}
          <div className="flex p-4 gap-4 w-1/2">
            <div className="w-24 h-24 flex-shrink-0 bg-gray-100 flex items-center justify-center rounded overflow-hidden">
              {product.image ? (
                <img src={product.image} alt={product.name} className="w-full h-full object-contain" />
              ) : (
                <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center text-gray-500">
                  No Image
                </div>
              )}
            </div>
            
            <div className="flex flex-col flex-grow min-w-0">
              <div className="text-sm text-black mb-1 truncate">
                <span className="font-semibold">{product.sku}</span> • {product.category}
              </div>
              <div className="font-semibold text-gray-800 mb-2 line-clamp-2">{product.name}</div>
              
              {product.colors && (
                <div className="flex flex-wrap gap-1 mb-2">
                  <span className="text-xs text-gray-500 mr-1 mt-1">Color:</span>
                  {product.colors.slice(0, showAllColors ? product.colors.length : 5).map((color, index) => (
                    <div
                      key={index}
                      className={`w-5 h-5 rounded-full cursor-pointer border ${expandedColor === color ? 'ring-2 ring-blue-500' : 'border-gray-300'}`}
                      style={{ backgroundColor: color }}
                      onClick={() => setExpandedColor(color)}
                    />
                  ))}
                  {product.colors.length > 5 && (
                    <div 
                      className="text-xs text-blue-600 mt-1 cursor-pointer hover:underline"
                      onClick={toggleShowAllColors}
                    >
                      {showAllColors ? "Show fewer" : `+${product.colors.length - 5} more colors`}
                    </div>
                  )}
                </div>
              )}
              
              <div className="flex items-center gap-2">
                {showPrices && (
                  <div className="text-green-600 font-semibold text-sm">
                    ${product.lowestPrice.toFixed(2)}
                  </div>
                )}
                {resultsAsOf && (
                  <span className="text-[10px] px-1 py-[1px] rounded bg-gray-100 text-gray-700">
                    {isLive(resultsAsOf) ? 'Live from S&S' : 'Cached'}
                  </span>
                )}
              </div>
            </div>
          </div>
          
          {/* Supplier Pricing Table - Now 50% width */}
          {showVendors && (
            <div className="flex-1 flex items-stretch divide-x border-l w-1/2">
              {product.suppliers.slice(0, 4).map((supplier, index) => (
                <div 
                  key={index} 
                  className="flex-1 flex flex-col items-center justify-center p-3 relative min-w-0 cursor-pointer hover:bg-gray-50"
                  onClick={() => handleSupplierClick(supplier)}
                >
                  <div className="text-xs font-medium mb-1 text-blue-600 truncate w-full text-center">{supplier.name}</div>
                  {showPrices && (
                    <div className="text-base font-semibold mb-1">
                      ${supplier.price.toFixed(2)}
                      {supplier.price === product.lowestPrice && (
                        <span className="absolute top-1 right-1">
                          <Badge variant="secondary" className="bg-green-100 text-green-800 text-[10px] px-1">Best</Badge>
                        </span>
                      )}
                    </div>
                  )}
                  <div className="flex gap-1 mt-1">
                    <div className={`w-2 h-2 rounded-full ${supplier.inventory > 500 ? 'bg-green-500' : supplier.inventory > 100 ? 'bg-yellow-500' : 'bg-red-500'}`}></div>
                    <span className="text-[10px] text-gray-500">{supplier.inventory}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Expanded Inventory Section */}
        {expanded && selectedSupplier && (
          <div className="bg-gray-50">
            {/* Supplier Header - Updated to show selected supplier */}
            <div className="px-4 py-3 flex items-center gap-6 border-b bg-white">
              <div className="text-sm font-medium flex-1">
                {selectedSupplier.name}'s Inventory & Pricing <span className="ml-2 text-[10px] px-1 py-[1px] rounded bg-gray-100 text-gray-700">S&S</span>
                {inventoryAsOf && (
                  <span className="ml-3 text-[10px] text-gray-500">
                    Updated {formatMinutesAgo(inventoryAsOf)} ago
                  </span>
                )}
              </div>
              
              <div className="ml-auto flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="text-xs h-7"
                  onClick={() => setShowCustomizationDialog(true)}
                >
                  <Palette className="h-3 w-3 mr-1" />
                  Customize
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-xs h-7"
                  onClick={() => setExpanded(false)}
                >
                  Close <ChevronUp className="h-3 w-3 ml-1" />
                </Button>
              </div>
            </div>
            
            {/* Sizes and Pricing Grid - Redesigned */}
            <div className="p-4">
              <div className="grid grid-cols-8 gap-2 text-center mb-4">
                <div className="font-medium text-sm"></div>
                {sizes.map(size => (
                  <div key={size} className="font-medium text-sm">{size}</div>
                ))}
              </div>
              
              {/* Price row - Using selected supplier price */}
              <div className="grid grid-cols-8 gap-2 text-center mb-4">
                <div className="text-sm text-left font-medium">Price</div>
                {sizes.map((size) => (
                  <div key={size} className="text-sm font-medium">
                    ${selectedSupplier.price.toFixed(2)}
                  </div>
                ))}
              </div>
              
              {/* Location inventory grid - improved display without input field styling */}
              {loadingInv && (
                <div className="text-xs text-gray-500">Loading inventory…</div>
              )}
              {dynamicLocations.map((location, locationIndex) => (
                <div key={location} className="mt-4">
                  <div className="grid grid-cols-8 gap-2 text-center items-center mb-2">
                    <div className="text-xs text-left font-medium">
                      {location}
                      {locationIndex < 2 && <div className="text-[10px] text-gray-500">Cutoff 4:00 CT</div>}
                    </div>
                    
                    {sizes.map((size) => {
                      const byWh = selectedSupplier?.inventoryByWarehouseSize;
                      const realInv = byWh?.[location]?.[size];
                      let inventory: number;
                      if (typeof realInv === 'number') {
                        inventory = realInv;
                      } else {
                        const base = selectedSupplier.inventory;
                        const fraction = 1 / Math.max(dynamicLocations.length, 1);
                        inventory = Math.floor(base * fraction * 0.8);
                      }
                      
                      return (
                        <div key={`${location}-${size}`} className="relative flex flex-col items-center">
                          {/* Inventory count shown as plain text rather than input-styled */}
                          <div className="text-xs mb-1 font-medium">
                            {inventory > 0 ? inventory : '-'}
                          </div>
                          
                          {/* Only show quantity selector when inventory > 0 */}
                          {inventory > 0 && (
                            <div className="flex items-center gap-1 w-full">
                              <Input
                                type="number"
                                min="0"
                                max={inventory}
                                value={quantities[location]?.[size] || ''}
                                onChange={(e) => handleQuantityChange(location, size, e.target.value)}
                                className="h-8 w-full text-xs text-center"
                                placeholder=""
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  
                  {locationIndex < 2 && (
                    <div className="ml-auto text-right">
                      <Badge variant="outline" className="bg-green-100 text-green-800 text-xs">
                        Est. delivery {locationIndex === 0 ? '02/10' : '02/10'}
                      </Badge>
                    </div>
                  )}
                  
                  {locationIndex === 2 && (
                    <div className="ml-auto text-right">
                      <Badge variant="outline" className="bg-gray-100 text-gray-800 text-xs">
                        Call For Pricing
                      </Badge>
                      <Badge variant="outline" className="bg-gray-100 text-gray-800 text-xs ml-2">
                        Est. delivery 3-7 Days
                      </Badge>
                    </div>
                  )}
                </div>
              ))}
              
              {/* Add to cart button with total quantity */}
              <div className="mt-6 text-right flex justify-end items-center gap-4">
                {getTotalQuantity() > 0 && (
                  <div className="text-sm font-medium">
                    Total Quantity: <span className="text-green-600">{getTotalQuantity()}</span>
                  </div>
                )}
                <Button 
                  variant="outline" 
                  className="bg-green-100 text-green-800 hover:bg-green-200"
                  onClick={handleAddToCart}
                >
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  Add to Cart
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
      
      {/* Customization Dialog */}
      {selectedSupplier && (
        <ProductCustomizationDialog
          open={showCustomizationDialog}
          onOpenChange={setShowCustomizationDialog}
          product={product}
          supplier={selectedSupplier}
        />
      )}
    </Card>
  );
}

function formatMinutesAgo(iso: string): string {
  try {
    const then = new Date(iso).getTime();
    const now = Date.now();
    const minutes = Math.max(0, Math.floor((now - then) / 60000));
    if (minutes < 1) return 'just now';
    if (minutes === 1) return '1 minute';
    return `${minutes} minutes`;
  } catch {
    return 'just now';
  }
}

function isLive(iso: string): boolean {
  try {
    const then = new Date(iso).getTime();
    const now = Date.now();
    const minutes = Math.max(0, Math.floor((now - then) / 60000));
    return minutes < 10;
  } catch {
    return false;
  }
}
