import React, { createContext, useContext, useState, useEffect } from 'react';
import { toast } from "sonner";
import { Cart, CartItem, UserSettings } from '@/types/cart';

interface CartManagerContextType {
  carts: Cart[];
  activeCartId: string | null;
  activeCart: Cart | null;
  userSettings: UserSettings;
  
  // Cart management
  createCart: (name?: string, strategy?: 'separate' | 'combined') => string;
  deleteCart: (cartId: string) => void;
  updateCart: (cartId: string, updates: Partial<Cart> | ((prevCart: Cart) => Partial<Cart>)) => void;
  setActiveCart: (cartId: string) => void;
  duplicateCart: (cartId: string) => string;
  
  // Item management
  addToCart: (cartId: string, item: CartItem) => void;
  removeFromCart: (cartId: string, itemId: number) => void;
  clearCart: (cartId: string) => void;
  
  // Cart operations
  convertCartToPO: (cartId: string) => Promise<string>;
  saveCartTemplate: (cartId: string, templateName: string) => void;
  
  // Settings
  updateUserSettings: (settings: Partial<UserSettings>) => void;
  
  // Totals
  getCartTotals: (cartId: string) => { totalItems: number; subtotal: number };
  getAllCartsTotals: () => { totalItems: number; subtotal: number };
  getActiveCartsTotals: () => { totalItems: number; subtotal: number };
}

const CartManagerContext = createContext<CartManagerContextType | undefined>(undefined);

export const CartManagerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [carts, setCarts] = useState<Cart[]>([]);
  const [activeCartId, setActiveCartId] = useState<string | null>(null);
  const [userSettings, setUserSettings] = useState<UserSettings>({
    automationLevel: 'manual',
    defaultOrderingStrategy: 'separate',
    cartNamingPreference: 'manual',
    approvalRequired: true
  });
  
  // Load data from localStorage on mount
  useEffect(() => {
    console.log('🛒 Loading data from localStorage...');
    const savedCarts = localStorage.getItem('cartManager_carts');
    const savedSettings = localStorage.getItem('cartManager_settings');
    const savedActiveCart = localStorage.getItem('cartManager_activeCart');
    
    console.log('🛒 Raw saved carts:', savedCarts);
    console.log('🛒 Raw saved settings:', savedSettings);
    console.log('🛒 Raw saved active cart:', savedActiveCart);
    
    if (savedCarts) {
      try {
        const parsedCarts = JSON.parse(savedCarts).map((cart: any) => ({
          ...cart,
          createdAt: new Date(cart.createdAt),
          updatedAt: new Date(cart.updatedAt)
        }));
        console.log('🛒 Parsed carts:', parsedCarts);
        setCarts(parsedCarts);
      } catch (error) {
        console.error('🛒 Error parsing saved carts:', error);
        localStorage.removeItem('cartManager_carts');
      }
    } else {
      // Add test data if no saved carts
      const testCarts: Cart[] = [
        {
          id: 'test_cart_1',
          name: 'Test Order - Apparel',
          createdAt: new Date(),
          updatedAt: new Date(),
          status: 'draft',
          orderingStrategy: 'separate',
          automationLevel: 'manual',
          items: [
            {
              id: 1,
              sku: 'G185',
              name: 'Gildan Heavy Blend Adult Hooded Sweatshirt',
              category: 'Apparel',
              price: 12.50,
              supplierName: 'Gildan',
              image: '/placeholder.svg',
              quantities: [
                { location: 'DALLAS, TX', size: 'M', quantity: 25 },
                { location: 'DALLAS, TX', size: 'L', quantity: 35 },
                { location: 'MEMPHIS, TN', size: 'XL', quantity: 15 }
              ],
              totalQuantity: 75
            },
            {
              id: 2,
              sku: 'G500',
              name: 'Gildan Heavy Cotton T-Shirt',
              category: 'Apparel',
              price: 4.25,
              supplierName: 'Gildan',
              image: '/placeholder.svg',
              quantities: [
                { location: 'DALLAS, TX', size: 'S', quantity: 50 },
                { location: 'DALLAS, TX', size: 'M', quantity: 100 },
                { location: 'DALLAS, TX', size: 'L', quantity: 75 }
              ],
              totalQuantity: 225
            }
          ],
          metadata: {
            notes: 'Rush order for client presentation',
            priority: 'high' as const
          }
        },
        {
          id: 'test_cart_2',
          name: 'Test Order - Promotional Items',
          createdAt: new Date(),
          updatedAt: new Date(),
          status: 'ready',
          orderingStrategy: 'combined',
          automationLevel: 'hybrid',
          items: [
            {
              id: 3,
              sku: 'PROMO123',
              name: 'Custom Branded Pens',
              category: 'Promotional',
              price: 0.85,
              supplierName: 'PromoShop',
              quantities: [
                { location: 'DALLAS, TX', size: 'One Size', quantity: 500 }
              ],
              totalQuantity: 500
            }
          ],
          metadata: {
            notes: 'Trade show giveaways',
            priority: 'medium' as const
          }
        }
      ];
      
      setCarts(testCarts);
      setActiveCartId('test_cart_1');
      console.log('🛒 Added test cart data');
    }
    
    if (savedSettings) {
      try {
        const parsedSettings = JSON.parse(savedSettings);
        console.log('🛒 Parsed settings:', parsedSettings);
        setUserSettings(parsedSettings);
      } catch (error) {
        console.error('🛒 Error parsing saved settings:', error);
        localStorage.removeItem('cartManager_settings');
      }
    }
    
    if (savedActiveCart) {
      console.log('🛒 Setting active cart ID:', savedActiveCart);
      setActiveCartId(savedActiveCart);
    }
  }, []);
  
  // Save to localStorage whenever data changes
  useEffect(() => {
    localStorage.setItem('cartManager_carts', JSON.stringify(carts));
  }, [carts]);
  
  useEffect(() => {
    localStorage.setItem('cartManager_settings', JSON.stringify(userSettings));
  }, [userSettings]);
  
  useEffect(() => {
    if (activeCartId) {
      localStorage.setItem('cartManager_activeCart', activeCartId);
    }
  }, [activeCartId]);
  
  const generateCartName = (strategy?: 'separate' | 'combined'): string => {
    const orderNumber = Math.floor(Math.random() * 900000) + 100000; // 6-digit order number
    
    if (strategy === 'combined') {
      return `Combined-Order-${orderNumber}`;
    }
    return `Order-${orderNumber}`;
  };
  
  const createCart = (name?: string, strategy?: 'separate' | 'combined'): string => {
    console.log('🛒 Creating new cart...');
    const cartId = `cart_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const cartName = name || generateCartName(strategy);
    console.log('🛒 Generated cart ID:', cartId, 'name:', cartName);
    
    const newCart: Cart = {
      id: cartId,
      name: cartName,
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'draft',
      orderingStrategy: strategy || userSettings.defaultOrderingStrategy,
      automationLevel: userSettings.automationLevel,
      items: [],
      metadata: {}
    };
    console.log('🛒 New cart object:', newCart);
    console.log('🛒 Current carts before update:', carts);
    
    setCarts(prev => {
      const updated = [...prev, newCart];
      console.log('🛒 Updated carts array:', updated);
      return updated;
    });
    setActiveCartId(cartId);
    console.log('🛒 Set active cart ID to:', cartId);
    
    toast.success(`Created new cart: ${cartName}`);
    return cartId;
  };
  
  const deleteCart = (cartId: string) => {
    setCarts(prev => prev.filter(cart => cart.id !== cartId));
    if (activeCartId === cartId) {
      const remainingCarts = carts.filter(cart => cart.id !== cartId);
      setActiveCartId(remainingCarts.length > 0 ? remainingCarts[0].id : null);
    }
    toast.info("Cart deleted");
  };
  
  const updateCart = (cartId: string, updates: Partial<Cart> | ((prevCart: Cart) => Partial<Cart>)) => {
    setCarts(prev => prev.map(cart => {
      if (cart.id !== cartId) return cart;
      
      const updatesObj = typeof updates === 'function' ? updates(cart) : updates;
      return { ...cart, ...updatesObj, updatedAt: new Date() };
    }));
  };
  
  const setActiveCart = (cartId: string) => {
    setActiveCartId(cartId);
  };
  
  const duplicateCart = (cartId: string): string => {
    const originalCart = carts.find(cart => cart.id === cartId);
    if (!originalCart) return '';
    
    const newCartId = createCart(`${originalCart.name} (Copy)`, originalCart.orderingStrategy);
    const newCart = { ...originalCart, id: newCartId, name: `${originalCart.name} (Copy)` };
    
    updateCart(newCartId, newCart);
    return newCartId;
  };
  
  const addToCart = (cartId: string, newItem: CartItem) => {
    console.log('🛒 addToCart called with cartId:', cartId, 'item:', newItem);
    console.log('🛒 Current carts before adding item:', carts);
    
    setCarts(prev => {
      console.log('🛒 Previous carts in setCarts:', prev);
      const updated = prev.map(cart => {
        if (cart.id !== cartId) {
          console.log('🛒 Skipping cart:', cart.id);
          return cart;
        }
        
        console.log('🛒 Found target cart:', cart);
        const existingItemIndex = cart.items.findIndex(item => 
          item.id === newItem.id && item.supplierName === newItem.supplierName
        );
        console.log('🛒 Existing item index:', existingItemIndex);
        
        let updatedItems;
        if (existingItemIndex >= 0) {
          console.log('🛒 Updating existing item');
          updatedItems = [...cart.items];
          const existingItem = updatedItems[existingItemIndex];
          
          // Merge quantities
          newItem.quantities.forEach(newQty => {
            const existingQtyIndex = existingItem.quantities.findIndex(
              q => q.location === newQty.location && q.size === newQty.size
            );
            
            if (existingQtyIndex >= 0) {
              existingItem.quantities[existingQtyIndex].quantity += newQty.quantity;
            } else {
              existingItem.quantities.push(newQty);
            }
          });
          
          existingItem.totalQuantity = existingItem.quantities.reduce(
            (total, q) => total + q.quantity, 0
          );
        } else {
          console.log('🛒 Adding new item to cart');
          updatedItems = [...cart.items, newItem];
        }
        
        const updatedCart = {
          ...cart,
          items: updatedItems,
          updatedAt: new Date()
        };
        console.log('🛒 Updated cart:', updatedCart);
        return updatedCart;
      });
      console.log('🛒 Final updated carts array:', updated);
      return updated;
    });
    
    toast.success(`Added ${newItem.totalQuantity} items to cart`);
  };
  
  const removeFromCart = (cartId: string, itemId: number) => {
    setCarts(prev => prev.map(cart => 
      cart.id === cartId 
        ? { 
            ...cart, 
            items: cart.items.filter(item => item.id !== itemId),
            updatedAt: new Date()
          }
        : cart
    ));
    toast.info("Item removed from cart");
  };
  
  const clearCart = (cartId: string) => {
    setCarts(prev => prev.map(cart => 
      cart.id === cartId 
        ? { ...cart, items: [], updatedAt: new Date() }
        : cart
    ));
  };
  
  const convertCartToPO = async (cartId: string): Promise<string> => {
    const cart = carts.find(c => c.id === cartId);
    if (!cart) throw new Error('Cart not found');
    
    if (cart.items.length === 0) {
      throw new Error('Cannot create PO from empty cart');
    }
    
    try {
      // Import supabase dynamically to avoid issues
      const { supabase } = await import('@/lib/supabase');
      
      // Create the purchase order
      const { data: poData, error: poError } = await supabase
        .from('purchase_orders')
        .insert({
          supplier_id: 'SS',
          supplier_name: 'S&S Activewear',
          buyer_name: 'Cart User',
          buyer_email: 'user@example.com',
          status: 'draft'
        })
        .select()
        .single();

      if (poError) throw poError;

      // Create PO items from cart items
      const poItems = cart.items.flatMap((item: CartItem) => 
        item.quantities.map(qty => ({
          po_id: poData.id,
          sku: item.sku,
          product_name: item.name,
          brand: item.supplierName,
          size: qty.size,
          quantity: qty.quantity,
          unit_price: item.price,
          line_total: item.price * qty.quantity,
          ship_from_warehouse: qty.location
        }))
      );

      const { error: itemsError } = await supabase
        .from('purchase_order_items')
        .insert(poItems);

      if (itemsError) throw itemsError;

      // Update cart status
      updateCart(cartId, { status: 'submitted' });
      
      toast.success(`Purchase Order ${poData.po_number} created successfully!`);
      return poData.po_number;
      
    } catch (error) {
      console.error('Error creating PO:', error);
      toast.error('Failed to create purchase order');
      throw error;
    }
  };
  
  const saveCartTemplate = (cartId: string, templateName: string) => {
    const cart = carts.find(c => c.id === cartId);
    if (!cart) return;
    
    // Save template to localStorage
    const templates = JSON.parse(localStorage.getItem('cartTemplates') || '[]');
    templates.push({
      id: `template_${Date.now()}`,
      name: templateName,
      items: cart.items,
      createdAt: new Date()
    });
    localStorage.setItem('cartTemplates', JSON.stringify(templates));
    
    toast.success(`Template "${templateName}" saved`);
  };
  
  const updateUserSettings = (settings: Partial<UserSettings>) => {
    setUserSettings(prev => ({ ...prev, ...settings }));
  };
  
  const getCartTotals = (cartId: string) => {
    const cart = carts.find(c => c.id === cartId);
    if (!cart) return { totalItems: 0, subtotal: 0 };
    
    const totalItems = cart.items.reduce((acc, item) => acc + item.totalQuantity, 0);
    const subtotal = cart.items.reduce((acc, item) => acc + (item.price * item.totalQuantity), 0);
    
    return { totalItems, subtotal };
  };
  
  const getAllCartsTotals = () => {
    console.log('getAllCartsTotals - All carts:', carts.map(c => ({ id: c.id, name: c.name, status: c.status, itemCount: c.items.length })));
    
    const totalItems = carts.reduce((acc, cart) => {
      return acc + cart.items.reduce((itemAcc, item) => itemAcc + item.totalQuantity, 0);
    }, 0);
    
    const subtotal = carts.reduce((acc, cart) => {
      return acc + cart.items.reduce((itemAcc, item) => itemAcc + (item.price * item.totalQuantity), 0);
    }, 0);
    
    return { totalItems, subtotal };
  };

  const getActiveCartsTotals = () => {
    console.log('🛒 Getting active carts totals...');
    console.log('🛒 All carts:', carts);
    const activeCarts = carts.filter(cart => cart.status === 'draft' || cart.status === 'ready');
    console.log('🛒 Active carts:', activeCarts);
    console.log('getActiveCartsTotals - Active carts:', activeCarts.map(c => ({ id: c.id, name: c.name, status: c.status, itemCount: c.items.length })));
    
    const totalItems = activeCarts.reduce((acc, cart) => {
      return acc + cart.items.reduce((itemAcc, item) => itemAcc + item.totalQuantity, 0);
    }, 0);
    
    const subtotal = activeCarts.reduce((acc, cart) => {
      return acc + cart.items.reduce((itemAcc, item) => itemAcc + (item.price * item.totalQuantity), 0);
    }, 0);
    
    console.log('🛒 Final totals:', { totalItems, subtotal });
    return { totalItems, subtotal };
  };
  
  const activeCart = activeCartId ? carts.find(cart => cart.id === activeCartId) || null : null;
  
  return (
    <CartManagerContext.Provider value={{
      carts,
      activeCartId,
      activeCart,
      userSettings,
      createCart,
      deleteCart,
      updateCart,
      setActiveCart,
      duplicateCart,
      addToCart,
      removeFromCart,
      clearCart,
      convertCartToPO,
      saveCartTemplate,
      updateUserSettings,
      getCartTotals,
      getAllCartsTotals,
      getActiveCartsTotals
    }}>
      {children}
    </CartManagerContext.Provider>
  );
};

export const useCartManager = () => {
  const context = useContext(CartManagerContext);
  if (context === undefined) {
    throw new Error('useCartManager must be used within a CartManagerProvider');
  }
  return context;
};