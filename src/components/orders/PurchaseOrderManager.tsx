import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { 
  FileText, 
  Plus, 
  Edit, 
  Trash2, 
  Download, 
  Send, 
  Package, 
  Calendar,
  DollarSign,
  Building2
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useCartManager } from '@/context/CartManagerContext';

interface PurchaseOrder {
  id: string;
  po_number: string;
  supplier_id: string;
  supplier_name: string;
  buyer_name?: string;
  buyer_email?: string;
  buyer_company?: string;
  po_date: string;
  status: string;
  subtotal: number;
  tax_amount: number;
  shipping_amount: number;
  total_amount: number;
  special_instructions?: string;
  created_at: string;
}

interface POItem {
  id: string;
  sku: string;
  product_name: string;
  brand?: string;
  color?: string;
  size?: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  ship_from_warehouse?: string;
}

const statusColors = {
  draft: 'bg-gray-100 text-gray-800',
  submitted: 'bg-blue-100 text-blue-800',
  confirmed: 'bg-green-100 text-green-800',
  in_production: 'bg-yellow-100 text-yellow-800',
  shipped: 'bg-purple-100 text-purple-800',
  delivered: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-red-100 text-red-800'
};

export function PurchaseOrderManager() {
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [poItems, setPOItems] = useState<POItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const { carts } = useCartManager();

  // Form state for creating PO
  const [poForm, setPOForm] = useState({
    supplier_id: 'SS',
    supplier_name: 'S&S Activewear',
    buyer_name: '',
    buyer_email: '',
    buyer_company: '',
    shipping_method: 'Ground',
    payment_terms: 'Net 30',
    requested_ship_date: '',
    special_instructions: ''
  });

  useEffect(() => {
    loadPurchaseOrders();
  }, []);

  const loadPurchaseOrders = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('purchase_orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPurchaseOrders(data || []);
    } catch (error) {
      console.error('Error loading purchase orders:', error);
      toast.error('Failed to load purchase orders');
    } finally {
      setLoading(false);
    }
  };

  const loadPOItems = async (poId: string) => {
    try {
      const { data, error } = await supabase
        .from('purchase_order_items')
        .select('*')
        .eq('po_id', poId)
        .order('created_at');

      if (error) throw error;
      setPOItems(data || []);
    } catch (error) {
      console.error('Error loading PO items:', error);
      toast.error('Failed to load PO items');
    }
  };

  const createPOFromCart = async (cartId: string) => {
    if (!carts[cartId] || !carts[cartId].items.length) {
      toast.error('Cart is empty');
      return;
    }

    try {
      setLoading(true);
      
      // Create the purchase order
      const { data: poData, error: poError } = await supabase
        .from('purchase_orders')
        .insert({
          supplier_id: poForm.supplier_id,
          supplier_name: poForm.supplier_name,
          buyer_name: poForm.buyer_name,
          buyer_email: poForm.buyer_email,
          buyer_company: poForm.buyer_company,
          shipping_method: poForm.shipping_method,
          payment_terms: poForm.payment_terms,
          requested_ship_date: poForm.requested_ship_date || null,
          special_instructions: poForm.special_instructions,
          status: 'draft'
        })
        .select()
        .single();

      if (poError) throw poError;

      // Create PO items from cart
      const cartItems = carts[cartId].items;
      const poItems = cartItems.flatMap(item => 
        item.quantities.map(qty => ({
          po_id: poData.id,
          sku: item.sku,
          product_name: item.name,
          brand: item.supplierName,
          color: qty.location, // This might need adjustment based on your data structure
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

      toast.success(`Purchase Order ${poData.po_number} created successfully!`);
      setShowCreateDialog(false);
      loadPurchaseOrders();
      
      // Reset form
      setPOForm({
        supplier_id: 'SS',
        supplier_name: 'S&S Activewear',
        buyer_name: '',
        buyer_email: '',
        buyer_company: '',
        shipping_method: 'Ground',
        payment_terms: 'Net 30',
        requested_ship_date: '',
        special_instructions: ''
      });

    } catch (error) {
      console.error('Error creating PO:', error);
      toast.error('Failed to create purchase order');
    } finally {
      setLoading(false);
    }
  };

  const updatePOStatus = async (poId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('purchase_orders')
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', poId);

      if (error) throw error;

      // Add to status history
      await supabase
        .from('po_status_history')
        .insert({
          po_id: poId,
          old_status: selectedPO?.status,
          new_status: newStatus,
          changed_by: 'User',
          change_reason: 'Status updated via UI'
        });

      toast.success('PO status updated successfully');
      loadPurchaseOrders();
      
      if (selectedPO) {
        setSelectedPO({ ...selectedPO, status: newStatus });
      }
    } catch (error) {
      console.error('Error updating PO status:', error);
      toast.error('Failed to update PO status');
    }
  };

  const viewPO = async (po: PurchaseOrder) => {
    setSelectedPO(po);
    await loadPOItems(po.id);
    setShowViewDialog(true);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getStatusBadge = (status: string) => {
    const colorClass = statusColors[status as keyof typeof statusColors] || statusColors.draft;
    return (
      <Badge className={`${colorClass} border-0`}>
        {status.replace('_', ' ').toUpperCase()}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Purchase Orders</h1>
          <p className="text-gray-600">Manage your supplier purchase orders</p>
        </div>
        
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Create PO
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create Purchase Order</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-6">
              {/* Supplier Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="w-5 h-5" />
                    Supplier Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="supplier">Supplier</Label>
                      <Select value={poForm.supplier_id} onValueChange={(value) => {
                        setPOForm(prev => ({
                          ...prev,
                          supplier_id: value,
                          supplier_name: value === 'SS' ? 'S&S Activewear' : value
                        }));
                      }}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="SS">S&S Activewear</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Buyer Information */}
              <Card>
                <CardHeader>
                  <CardTitle>Buyer Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="buyer_name">Buyer Name</Label>
                      <Input
                        id="buyer_name"
                        value={poForm.buyer_name}
                        onChange={(e) => setPOForm(prev => ({ ...prev, buyer_name: e.target.value }))}
                        placeholder="Enter buyer name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="buyer_email">Email</Label>
                      <Input
                        id="buyer_email"
                        type="email"
                        value={poForm.buyer_email}
                        onChange={(e) => setPOForm(prev => ({ ...prev, buyer_email: e.target.value }))}
                        placeholder="buyer@company.com"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="buyer_company">Company</Label>
                    <Input
                      id="buyer_company"
                      value={poForm.buyer_company}
                      onChange={(e) => setPOForm(prev => ({ ...prev, buyer_company: e.target.value }))}
                      placeholder="Company name"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Order Details */}
              <Card>
                <CardHeader>
                  <CardTitle>Order Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="shipping_method">Shipping Method</Label>
                      <Select value={poForm.shipping_method} onValueChange={(value) => setPOForm(prev => ({ ...prev, shipping_method: value }))}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Ground">Ground</SelectItem>
                          <SelectItem value="Express">Express</SelectItem>
                          <SelectItem value="Overnight">Overnight</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="payment_terms">Payment Terms</Label>
                      <Select value={poForm.payment_terms} onValueChange={(value) => setPOForm(prev => ({ ...prev, payment_terms: value }))}>
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
                  </div>
                  <div>
                    <Label htmlFor="requested_ship_date">Requested Ship Date</Label>
                    <Input
                      id="requested_ship_date"
                      type="date"
                      value={poForm.requested_ship_date}
                      onChange={(e) => setPOForm(prev => ({ ...prev, requested_ship_date: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="special_instructions">Special Instructions</Label>
                    <Textarea
                      id="special_instructions"
                      value={poForm.special_instructions}
                      onChange={(e) => setPOForm(prev => ({ ...prev, special_instructions: e.target.value }))}
                      placeholder="Any special instructions for the supplier..."
                      rows={3}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Cart Selection */}
              <Card>
                <CardHeader>
                  <CardTitle>Select Cart to Convert</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {Object.entries(carts).map(([cartId, cart]) => (
                      <div key={cartId} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <p className="font-medium">Cart {cartId}</p>
                          <p className="text-sm text-gray-600">
                            {cart.items.length} items • {cart.items.reduce((sum, item) => sum + item.totalQuantity, 0)} total quantity
                          </p>
                        </div>
                        <Button 
                          onClick={() => createPOFromCart(cartId)}
                          disabled={loading || cart.items.length === 0}
                        >
                          Create PO
                        </Button>
                      </div>
                    ))}
                    {Object.keys(carts).length === 0 && (
                      <p className="text-gray-500 text-center py-4">No carts available. Add items to cart first.</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Purchase Orders List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Purchase Orders
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-gray-500">Loading purchase orders...</div>
            </div>
          ) : purchaseOrders.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No purchase orders found</p>
              <p className="text-sm">Create your first PO from a cart</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>PO Number</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {purchaseOrders.map((po) => (
                  <TableRow key={po.id}>
                    <TableCell className="font-medium">{po.po_number}</TableCell>
                    <TableCell>{po.supplier_name}</TableCell>
                    <TableCell>{formatDate(po.po_date)}</TableCell>
                    <TableCell>{getStatusBadge(po.status)}</TableCell>
                    <TableCell>{formatCurrency(po.total_amount)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => viewPO(po)}
                        >
                          View
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* View PO Dialog */}
      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {selectedPO && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center justify-between">
                  <span>Purchase Order {selectedPO.po_number}</span>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(selectedPO.status)}
                    <Select 
                      value={selectedPO.status} 
                      onValueChange={(value) => updatePOStatus(selectedPO.id, value)}
                    >
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="submitted">Submitted</SelectItem>
                        <SelectItem value="confirmed">Confirmed</SelectItem>
                        <SelectItem value="in_production">In Production</SelectItem>
                        <SelectItem value="shipped">Shipped</SelectItem>
                        <SelectItem value="delivered">Delivered</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-6">
                {/* PO Header Info */}
                <div className="grid grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Supplier</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="font-medium">{selectedPO.supplier_name}</p>
                      <p className="text-sm text-gray-600">Supplier ID: {selectedPO.supplier_id}</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Buyer</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="font-medium">{selectedPO.buyer_name || 'Not specified'}</p>
                      {selectedPO.buyer_email && (
                        <p className="text-sm text-gray-600">{selectedPO.buyer_email}</p>
                      )}
                      {selectedPO.buyer_company && (
                        <p className="text-sm text-gray-600">{selectedPO.buyer_company}</p>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Line Items */}
                <Card>
                  <CardHeader>
                    <CardTitle>Line Items</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>SKU</TableHead>
                          <TableHead>Product</TableHead>
                          <TableHead>Color/Size</TableHead>
                          <TableHead>Qty</TableHead>
                          <TableHead>Unit Price</TableHead>
                          <TableHead>Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {poItems.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-mono">{item.sku}</TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium">{item.product_name}</p>
                                {item.brand && <p className="text-sm text-gray-600">{item.brand}</p>}
                              </div>
                            </TableCell>
                            <TableCell>
                              {item.color && item.size ? `${item.color} / ${item.size}` : item.color || item.size || '-'}
                            </TableCell>
                            <TableCell>{item.quantity}</TableCell>
                            <TableCell>{formatCurrency(item.unit_price)}</TableCell>
                            <TableCell>{formatCurrency(item.line_total)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                {/* Totals */}
                <Card>
                  <CardContent className="pt-6">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Subtotal:</span>
                        <span>{formatCurrency(selectedPO.subtotal)}</span>
                      </div>
                      {selectedPO.tax_amount > 0 && (
                        <div className="flex justify-between">
                          <span>Tax:</span>
                          <span>{formatCurrency(selectedPO.tax_amount)}</span>
                        </div>
                      )}
                      {selectedPO.shipping_amount > 0 && (
                        <div className="flex justify-between">
                          <span>Shipping:</span>
                          <span>{formatCurrency(selectedPO.shipping_amount)}</span>
                        </div>
                      )}
                      <Separator />
                      <div className="flex justify-between text-lg font-semibold">
                        <span>Total:</span>
                        <span>{formatCurrency(selectedPO.total_amount)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Special Instructions */}
                {selectedPO.special_instructions && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Special Instructions</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-gray-700">{selectedPO.special_instructions}</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
