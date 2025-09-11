import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { FileText, Building2, User, Calendar, DollarSign } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Cart, CartItem } from '@/types/cart';

interface CreatePOFromCartProps {
  cart: Cart;
  onPOCreated?: (poNumber: string) => void;
}

export function CreatePOFromCart({ cart, onPOCreated }: CreatePOFromCartProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    // Buyer Information
    buyer_name: '',
    buyer_email: '',
    buyer_phone: '',
    buyer_company: '',
    
    // Billing Address
    billing_address_line1: '',
    billing_address_line2: '',
    billing_city: '',
    billing_state: '',
    billing_zip: '',
    
    // Shipping Address
    shipping_address_line1: '',
    shipping_address_line2: '',
    shipping_city: '',
    shipping_state: '',
    shipping_zip: '',
    shipping_same_as_billing: true,
    
    // Order Details
    requested_ship_date: '',
    shipping_method: 'Ground',
    payment_terms: 'Net 30',
    special_instructions: '',
    
    // Financial
    tax_rate: 0,
    shipping_amount: 0
  });

  const calculateTotals = () => {
    const subtotal = cart.items.reduce((sum, item) => {
      return sum + (item.totalQuantity * item.price);
    }, 0);
    
    const taxAmount = subtotal * (formData.tax_rate / 100);
    const total = subtotal + taxAmount + formData.shipping_amount;
    
    return { subtotal, taxAmount, total };
  };

  const createPurchaseOrder = async () => {
    try {
      setLoading(true);

      const { subtotal, taxAmount, total } = calculateTotals();

      // Create the purchase order
      const { data: poData, error: poError } = await supabase
        .from('purchase_orders')
        .insert({
          supplier_id: 'SS',
          supplier_name: 'S&S Activewear',
          buyer_name: formData.buyer_name,
          buyer_email: formData.buyer_email,
          buyer_phone: formData.buyer_phone,
          buyer_company: formData.buyer_company,
          
          billing_address_line1: formData.billing_address_line1,
          billing_address_line2: formData.billing_address_line2,
          billing_city: formData.billing_city,
          billing_state: formData.billing_state,
          billing_zip: formData.billing_zip,
          billing_country: 'United States',
          
          shipping_address_line1: formData.shipping_same_as_billing ? formData.billing_address_line1 : formData.shipping_address_line1,
          shipping_address_line2: formData.shipping_same_as_billing ? formData.billing_address_line2 : formData.shipping_address_line2,
          shipping_city: formData.shipping_same_as_billing ? formData.billing_city : formData.shipping_city,
          shipping_state: formData.shipping_same_as_billing ? formData.billing_state : formData.shipping_state,
          shipping_zip: formData.shipping_same_as_billing ? formData.billing_zip : formData.shipping_zip,
          shipping_country: 'United States',
          
          requested_ship_date: formData.requested_ship_date || null,
          shipping_method: formData.shipping_method,
          payment_terms: formData.payment_terms,
          
          subtotal: subtotal,
          tax_amount: taxAmount,
          shipping_amount: formData.shipping_amount,
          total_amount: total,
          
          special_instructions: formData.special_instructions,
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
          color: extractColor(qty.location),
          size: qty.size,
          quantity: qty.quantity,
          unit_price: item.price,
          line_total: item.price * qty.quantity,
          ship_from_warehouse: extractWarehouse(qty.location)
        }))
      );

      const { error: itemsError } = await supabase
        .from('purchase_order_items')
        .insert(poItems);

      if (itemsError) throw itemsError;

      toast.success(`Purchase Order ${poData.po_number} created successfully!`);
      setOpen(false);
      
      if (onPOCreated) {
        onPOCreated(poData.po_number);
      }

      // Reset form
      setFormData({
        buyer_name: '',
        buyer_email: '',
        buyer_phone: '',
        buyer_company: '',
        billing_address_line1: '',
        billing_address_line2: '',
        billing_city: '',
        billing_state: '',
        billing_zip: '',
        shipping_address_line1: '',
        shipping_address_line2: '',
        shipping_city: '',
        shipping_state: '',
        shipping_zip: '',
        shipping_same_as_billing: true,
        requested_ship_date: '',
        shipping_method: 'Ground',
        payment_terms: 'Net 30',
        special_instructions: '',
        tax_rate: 0,
        shipping_amount: 0
      });

    } catch (error) {
      console.error('Error creating PO:', error);
      toast.error('Failed to create purchase order');
    } finally {
      setLoading(false);
    }
  };

  const extractColor = (location: string): string => {
    // Extract color from location string if it contains color info
    // This might need adjustment based on your data structure
    return '';
  };

  const extractWarehouse = (location: string): string => {
    // Extract warehouse code from location
    if (location.includes('IL')) return 'IL';
    if (location.includes('TX')) return 'TX';
    if (location.includes('NJ')) return 'NJ';
    if (location.includes('GA')) return 'GA';
    if (location.includes('NV')) return 'NV';
    if (location.includes('KS')) return 'KS';
    return 'IL'; // Default
  };

  const { subtotal, taxAmount, total } = calculateTotals();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="flex items-center gap-2">
          <FileText className="w-4 h-4" />
          Create Purchase Order
        </Button>
      </DialogTrigger>
      
      <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Create Purchase Order from Cart
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Cart Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                Order Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Variant</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Unit Price</TableHead>
                    <TableHead>Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cart.items.map((item) => 
                    item.quantities.map((qty, idx) => (
                      <TableRow key={`${item.id}-${idx}`}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{item.name}</p>
                            <p className="text-sm text-gray-600">{item.sku}</p>
                          </div>
                        </TableCell>
                        <TableCell>{qty.size}</TableCell>
                        <TableCell>{qty.quantity}</TableCell>
                        <TableCell>{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(item.price)}</TableCell>
                        <TableCell>{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(item.price * qty.quantity)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              
              <div className="mt-4 space-y-2 bg-gray-50 p-4 rounded-lg">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Tax ({formData.tax_rate}%):</span>
                  <span>{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(taxAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Shipping:</span>
                  <span>{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(formData.shipping_amount)}</span>
                </div>
                <div className="flex justify-between text-lg font-semibold border-t pt-2">
                  <span>Total:</span>
                  <span>{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(total)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Buyer Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                Buyer Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="buyer_name">Buyer Name *</Label>
                  <Input
                    id="buyer_name"
                    value={formData.buyer_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, buyer_name: e.target.value }))}
                    placeholder="John Doe"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="buyer_email">Email *</Label>
                  <Input
                    id="buyer_email"
                    type="email"
                    value={formData.buyer_email}
                    onChange={(e) => setFormData(prev => ({ ...prev, buyer_email: e.target.value }))}
                    placeholder="john@company.com"
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="buyer_phone">Phone</Label>
                  <Input
                    id="buyer_phone"
                    value={formData.buyer_phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, buyer_phone: e.target.value }))}
                    placeholder="(555) 123-4567"
                  />
                </div>
                <div>
                  <Label htmlFor="buyer_company">Company</Label>
                  <Input
                    id="buyer_company"
                    value={formData.buyer_company}
                    onChange={(e) => setFormData(prev => ({ ...prev, buyer_company: e.target.value }))}
                    placeholder="Your Company Inc."
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Order Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Order Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="shipping_method">Shipping Method</Label>
                  <Select value={formData.shipping_method} onValueChange={(value) => setFormData(prev => ({ ...prev, shipping_method: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Ground">Ground (3-5 days)</SelectItem>
                      <SelectItem value="Express">Express (1-2 days)</SelectItem>
                      <SelectItem value="Overnight">Overnight</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="payment_terms">Payment Terms</Label>
                  <Select value={formData.payment_terms} onValueChange={(value) => setFormData(prev => ({ ...prev, payment_terms: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Net 30">Net 30</SelectItem>
                      <SelectItem value="Net 15">Net 15</SelectItem>
                      <SelectItem value="Due on Receipt">Due on Receipt</SelectItem>
                      <SelectItem value="COD">COD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="requested_ship_date">Requested Ship Date</Label>
                  <Input
                    id="requested_ship_date"
                    type="date"
                    value={formData.requested_ship_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, requested_ship_date: e.target.value }))}
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="tax_rate">Tax Rate (%)</Label>
                  <Input
                    id="tax_rate"
                    type="number"
                    min="0"
                    max="20"
                    step="0.1"
                    value={formData.tax_rate}
                    onChange={(e) => setFormData(prev => ({ ...prev, tax_rate: parseFloat(e.target.value) || 0 }))}
                    placeholder="8.5"
                  />
                </div>
                <div>
                  <Label htmlFor="shipping_amount">Shipping Amount ($)</Label>
                  <Input
                    id="shipping_amount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.shipping_amount}
                    onChange={(e) => setFormData(prev => ({ ...prev, shipping_amount: parseFloat(e.target.value) || 0 }))}
                    placeholder="15.00"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="special_instructions">Special Instructions</Label>
                <Textarea
                  id="special_instructions"
                  value={formData.special_instructions}
                  onChange={(e) => setFormData(prev => ({ ...prev, special_instructions: e.target.value }))}
                  placeholder="Any special requirements, rush orders, decoration details, etc."
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* Billing Address */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                Billing Address
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="billing_address_line1">Address Line 1 *</Label>
                <Input
                  id="billing_address_line1"
                  value={formData.billing_address_line1}
                  onChange={(e) => setFormData(prev => ({ ...prev, billing_address_line1: e.target.value }))}
                  placeholder="123 Main Street"
                  required
                />
              </div>
              <div>
                <Label htmlFor="billing_address_line2">Address Line 2</Label>
                <Input
                  id="billing_address_line2"
                  value={formData.billing_address_line2}
                  onChange={(e) => setFormData(prev => ({ ...prev, billing_address_line2: e.target.value }))}
                  placeholder="Suite 100"
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="billing_city">City *</Label>
                  <Input
                    id="billing_city"
                    value={formData.billing_city}
                    onChange={(e) => setFormData(prev => ({ ...prev, billing_city: e.target.value }))}
                    placeholder="Chicago"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="billing_state">State *</Label>
                  <Input
                    id="billing_state"
                    value={formData.billing_state}
                    onChange={(e) => setFormData(prev => ({ ...prev, billing_state: e.target.value }))}
                    placeholder="IL"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="billing_zip">ZIP Code *</Label>
                  <Input
                    id="billing_zip"
                    value={formData.billing_zip}
                    onChange={(e) => setFormData(prev => ({ ...prev, billing_zip: e.target.value }))}
                    placeholder="60601"
                    required
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={createPurchaseOrder} 
              disabled={loading || !formData.buyer_name || !formData.buyer_email || !formData.billing_address_line1}
              className="flex items-center gap-2"
            >
              <FileText className="w-4 h-4" />
              {loading ? 'Creating...' : 'Create Purchase Order'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
