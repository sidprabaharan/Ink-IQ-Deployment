import React from 'react';
import { useCartManager } from '@/context/CartManagerContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ShoppingCart, X, Plus, FileText } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { CartSelector } from './CartSelector';

export function EnhancedCartSidebar() {
  const { 
    activeCart, 
    removeFromCart, 
    convertCartToPO, 
    getCartTotals,
    getAllCartsTotals,
    updateCart,
    createCart 
  } = useCartManager();
  
  const [poNumber, setPoNumber] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [isCheckingOut, setIsCheckingOut] = React.useState(false);
  const navigate = useNavigate();
  
  const allTotals = getAllCartsTotals();
  const activeCartTotals = activeCart ? getCartTotals(activeCart.id) : { totalItems: 0, subtotal: 0 };
  
  // Group cart items by supplier
  const itemsBySupplier = React.useMemo(() => {
    if (!activeCart) return {};
    
    const grouped: Record<string, typeof activeCart.items> = {};
    
    activeCart.items.forEach(item => {
      if (!grouped[item.supplierName]) {
        grouped[item.supplierName] = [];
      }
      grouped[item.supplierName].push(item);
    });
    
    return grouped;
  }, [activeCart?.items]);
  
  const handleCheckout = async () => {
    if (!activeCart) return;
    
    if (!poNumber.trim()) {
      toast.error("Please enter a PO Number");
      return;
    }
    
    try {
      setIsCheckingOut(true);
      
      // Update cart metadata
      updateCart(activeCart.id, {
        metadata: {
          ...activeCart.metadata,
          poNumber,
          notes
        }
      });
      
      // Convert to PO
      const poId = await convertCartToPO(activeCart.id);
      
      setPoNumber('');
      setNotes('');
      setIsCheckingOut(false);
      
      // Create a new cart for continued shopping
      createCart();
      
      navigate('/purchase-orders');
    } catch (error) {
      toast.error("Failed to create purchase order");
      setIsCheckingOut(false);
    }
  };
  
  if (!activeCart || activeCartTotals.totalItems === 0) {
    return (
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="ghost" className="relative">
            <ShoppingCart className="h-5 w-5" />
            {allTotals.totalItems > 0 && (
              <Badge className="absolute -top-2 -right-2 px-1 min-w-5 h-5 flex items-center justify-center">
                {allTotals.totalItems}
              </Badge>
            )}
            <span className="sr-only">Open cart</span>
          </Button>
        </SheetTrigger>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Shopping Cart</SheetTitle>
          </SheetHeader>
          
          <div className="mt-4">
            <CartSelector />
          </div>
          
          <div className="flex flex-col items-center justify-center h-[60vh]">
            <ShoppingCart className="h-16 w-16 text-gray-300 mb-4" />
            <p className="text-gray-500 mb-2">
              {activeCart ? 'This cart is empty' : 'No active cart'}
            </p>
            <Button 
              variant="outline" 
              className="mt-4"
              onClick={() => {
                if (!activeCart) {
                  createCart();
                }
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              {activeCart ? 'Continue Shopping' : 'Create Cart'}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    );
  }
  
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" className="relative">
          <ShoppingCart className="h-5 w-5" />
          {allTotals.totalItems > 0 && (
            <Badge className="absolute -top-2 -right-2 px-1 min-w-5 h-5 flex items-center justify-center">
              {allTotals.totalItems}
            </Badge>
          )}
          <span className="sr-only">Open cart</span>
        </Button>
      </SheetTrigger>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Shopping Cart</SheetTitle>
        </SheetHeader>
        
        <div className="mt-4">
          <CartSelector />
        </div>
        
        {isCheckingOut ? (
          <div className="mt-8 space-y-6">
            <div className="space-y-2">
              <Label htmlFor="po-number">PO Number *</Label>
              <Input 
                id="po-number" 
                value={poNumber} 
                onChange={(e) => setPoNumber(e.target.value)} 
                placeholder="Enter your purchase order number"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="notes">Order Notes</Label>
              <Textarea 
                id="notes" 
                value={notes} 
                onChange={(e) => setNotes(e.target.value)} 
                placeholder="Any special requirements for this order?"
                className="min-h-[100px]"
              />
            </div>
            
            <Separator />
            
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm">Cart:</span>
                <span className="text-sm font-medium">{activeCart.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Strategy:</span>
                <span className="text-sm capitalize">{activeCart.orderingStrategy}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Total Items:</span>
                <span className="text-sm">{activeCartTotals.totalItems}</span>
              </div>
              <div className="flex justify-between text-lg font-bold">
                <span>Total Amount:</span>
                <span>${activeCartTotals.subtotal.toFixed(2)}</span>
              </div>
            </div>
            
            <div className="pt-4 space-y-2">
              <Button 
                className="w-full" 
                onClick={handleCheckout}
              >
                Create Purchase Order
              </Button>
              <Button 
                variant="outline" 
                className="w-full" 
                onClick={() => setIsCheckingOut(false)}
              >
                Back to Cart
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex justify-between items-center mt-4 mb-2">
              <div className="text-sm text-gray-500">
                {activeCartTotals.totalItems} {activeCartTotals.totalItems === 1 ? 'item' : 'items'} in {activeCart.name}
              </div>
              <Badge variant="outline" className="capitalize">
                {activeCart.orderingStrategy}
              </Badge>
            </div>
            
            <div className="space-y-6 my-4 max-h-[50vh] overflow-auto pr-2">
              {Object.entries(itemsBySupplier).map(([supplier, items]) => (
                <div key={supplier} className="space-y-2">
                  <h3 className="font-medium text-sm text-gray-700">{supplier}</h3>
                  
                  {items.map((item) => (
                    <div key={`${item.id}-${item.supplierName}`} className="flex gap-3 py-2">
                      <div className="w-12 h-12 rounded border bg-gray-50 flex items-center justify-center overflow-hidden flex-shrink-0">
                        {item.image ? (
                          <img src={item.image} alt={item.name} className="w-full h-full object-contain" />
                        ) : (
                          <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium line-clamp-1">{item.name}</div>
                        <div className="text-xs text-gray-500">{item.sku}</div>
                        <div className="text-xs text-gray-500 mt-1">
                          {item.totalQuantity} × ${item.price.toFixed(2)}
                        </div>
                      </div>
                      
                      <div className="flex flex-col items-end">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-6 w-6" 
                          onClick={() => removeFromCart(activeCart.id, item.id)}
                        >
                          <X className="h-4 w-4" />
                          <span className="sr-only">Remove</span>
                        </Button>
                        <div className="mt-auto text-sm font-medium">
                          ${(item.price * item.totalQuantity).toFixed(2)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
            
            <div className="space-y-4 mt-6 pt-6 border-t">
              <div className="flex justify-between text-sm">
                <span>Subtotal</span>
                <span>${activeCartTotals.subtotal.toFixed(2)}</span>
              </div>
              
              <div className="flex justify-between text-sm">
                <span>Shipping</span>
                <span>Calculated at checkout</span>
              </div>
              
              <div className="flex justify-between font-bold text-lg">
                <span>Total</span>
                <span>${activeCartTotals.subtotal.toFixed(2)}</span>
              </div>
              
              <div className="flex gap-2">
                <Button 
                  className="flex-1" 
                  onClick={() => setIsCheckingOut(true)}
                  disabled={activeCartTotals.totalItems === 0}
                >
                  Checkout
                </Button>
                <Button 
                  variant="outline"
                  className="flex-1"
                  onClick={async () => {
                    if (!activeCart) return;
                    try {
                      const poNumber = await convertCartToPO(activeCart.id);
                      toast.success(`PO ${poNumber} created!`);
                      navigate('/purchase-orders');
                    } catch (error) {
                      toast.error('Failed to create PO');
                    }
                  }}
                  disabled={activeCartTotals.totalItems === 0}
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Create PO
                </Button>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}