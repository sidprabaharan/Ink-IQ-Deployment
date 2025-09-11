import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { 
  FileText, 
  Search, 
  Download, 
  Send, 
  Eye, 
  Edit, 
  Trash2,
  Calendar,
  DollarSign,
  Package,
  Building2,
  User,
  Filter
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { PurchaseOrderManager } from '@/components/orders/PurchaseOrderManager';

interface PurchaseOrder {
  id: string;
  po_number: string;
  supplier_id: string;
  supplier_name: string;
  buyer_name?: string;
  buyer_email?: string;
  buyer_company?: string;
  po_date: string;
  requested_ship_date?: string;
  status: string;
  subtotal: number;
  tax_amount: number;
  shipping_amount: number;
  total_amount: number;
  special_instructions?: string;
  created_at: string;
  payment_terms?: string;
  shipping_method?: string;
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

export default function PurchaseOrders() {
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<PurchaseOrder[]>([]);
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [poItems, setPOItems] = useState<POItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showViewDialog, setShowViewDialog] = useState(false);

  useEffect(() => {
    loadPurchaseOrders();
  }, []);

  useEffect(() => {
    filterOrders();
  }, [purchaseOrders, searchTerm, statusFilter]);

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

  const filterOrders = () => {
    let filtered = [...purchaseOrders];

    // Apply search filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(po => 
        po.po_number.toLowerCase().includes(term) ||
        po.supplier_name.toLowerCase().includes(term) ||
        po.buyer_name?.toLowerCase().includes(term) ||
        po.buyer_company?.toLowerCase().includes(term)
      );
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(po => po.status === statusFilter);
    }

    setFilteredOrders(filtered);
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

  const viewPO = async (po: PurchaseOrder) => {
    setSelectedPO(po);
    await loadPOItems(po.id);
    setShowViewDialog(true);
  };

  const exportPO = async (po: PurchaseOrder) => {
    try {
      // Load PO items for export
      const { data: items, error } = await supabase
        .from('purchase_order_items')
        .select('*')
        .eq('po_id', po.id);

      if (error) throw error;

      // Create PDF-style content
      const poContent = generatePOContent(po, items || []);
      
      // Create and download as text file (could be enhanced to PDF)
      const blob = new Blob([poContent], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `PO_${po.po_number}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Purchase order exported successfully');
    } catch (error) {
      console.error('Error exporting PO:', error);
      toast.error('Failed to export purchase order');
    }
  };

  const generatePOContent = (po: PurchaseOrder, items: POItem[]): string => {
    const formatCurrency = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
    const formatDate = (date: string) => new Date(date).toLocaleDateString();

    return `
PURCHASE ORDER
=====================================

PO Number: ${po.po_number}
Date: ${formatDate(po.po_date)}
Status: ${po.status.toUpperCase()}

SUPPLIER:
${po.supplier_name}
Supplier ID: ${po.supplier_id}

BUYER:
${po.buyer_name || 'Not specified'}
${po.buyer_email || ''}
${po.buyer_company || ''}

ORDER DETAILS:
Payment Terms: ${po.payment_terms || 'Net 30'}
Shipping Method: ${po.shipping_method || 'Ground'}
${po.requested_ship_date ? `Requested Ship Date: ${formatDate(po.requested_ship_date)}` : ''}

LINE ITEMS:
=====================================
${'SKU'.padEnd(15)} ${'Product Name'.padEnd(30)} ${'Color/Size'.padEnd(15)} ${'Qty'.padEnd(5)} ${'Unit Price'.padEnd(12)} ${'Total'.padEnd(12)}
${'-'.repeat(95)}
${items.map(item => 
  `${item.sku.padEnd(15)} ${item.product_name.substring(0, 30).padEnd(30)} ${`${item.color || ''}/${item.size || ''}`.padEnd(15)} ${item.quantity.toString().padEnd(5)} ${formatCurrency(item.unit_price).padEnd(12)} ${formatCurrency(item.line_total).padEnd(12)}`
).join('\n')}
${'-'.repeat(95)}

TOTALS:
Subtotal: ${formatCurrency(po.subtotal)}
Tax: ${formatCurrency(po.tax_amount)}
Shipping: ${formatCurrency(po.shipping_amount)}
TOTAL: ${formatCurrency(po.total_amount)}

${po.special_instructions ? `\nSPECIAL INSTRUCTIONS:\n${po.special_instructions}` : ''}

Generated on: ${new Date().toLocaleString()}
    `.trim();
  };

  const getStatusBadge = (status: string) => {
    const colorClass = statusColors[status as keyof typeof statusColors] || statusColors.draft;
    return (
      <Badge className={`${colorClass} border-0`}>
        {status.replace('_', ' ').toUpperCase()}
      </Badge>
    );
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Purchase Orders</h1>
          <p className="text-gray-600">Manage and track your supplier purchase orders</p>
        </div>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search PO number, supplier, or buyer..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="w-48">
              <select 
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Statuses</option>
                <option value="draft">Draft</option>
                <option value="submitted">Submitted</option>
                <option value="confirmed">Confirmed</option>
                <option value="in_production">In Production</option>
                <option value="shipped">Shipped</option>
                <option value="delivered">Delivered</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Purchase Order Manager Component */}
      <PurchaseOrderManager />

      {/* Purchase Orders Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Purchase Orders ({filteredOrders.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-gray-500">Loading purchase orders...</div>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No purchase orders found</p>
              <p className="text-sm">
                {searchTerm || statusFilter !== 'all' ? 'Try adjusting your filters' : 'Create your first PO from a cart'}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>PO Number</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Buyer</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.map((po) => (
                  <TableRow key={po.id}>
                    <TableCell className="font-mono font-medium">{po.po_number}</TableCell>
                    <TableCell>{po.supplier_name}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{po.buyer_name || 'Not specified'}</p>
                        {po.buyer_company && (
                          <p className="text-sm text-gray-600">{po.buyer_company}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{formatDate(po.po_date)}</TableCell>
                    <TableCell>{getStatusBadge(po.status)}</TableCell>
                    <TableCell className="font-medium">{formatCurrency(po.total_amount)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => viewPO(po)}
                          className="flex items-center gap-1"
                        >
                          <Eye className="w-3 h-3" />
                          View
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => exportPO(po)}
                          className="flex items-center gap-1"
                        >
                          <Download className="w-3 h-3" />
                          Export
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
        <DialogContent className="max-w-5xl max-h-[95vh] overflow-y-auto">
          {selectedPO && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Purchase Order {selectedPO.po_number}
                  </span>
                  {getStatusBadge(selectedPO.status)}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-6">
                {/* Header Information */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Building2 className="w-4 h-4" />
                        Supplier
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="font-medium">{selectedPO.supplier_name}</p>
                      <p className="text-sm text-gray-600">ID: {selectedPO.supplier_id}</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <User className="w-4 h-4" />
                        Buyer
                      </CardTitle>
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

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        Dates
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm">
                        <span className="font-medium">PO Date:</span> {formatDate(selectedPO.po_date)}
                      </p>
                      {selectedPO.requested_ship_date && (
                        <p className="text-sm">
                          <span className="font-medium">Ship Date:</span> {formatDate(selectedPO.requested_ship_date)}
                        </p>
                      )}
                      <p className="text-sm">
                        <span className="font-medium">Payment:</span> {selectedPO.payment_terms || 'Net 30'}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Line Items */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Package className="w-5 h-5" />
                      Line Items
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>SKU</TableHead>
                          <TableHead>Product</TableHead>
                          <TableHead>Variant</TableHead>
                          <TableHead>Warehouse</TableHead>
                          <TableHead className="text-right">Qty</TableHead>
                          <TableHead className="text-right">Unit Price</TableHead>
                          <TableHead className="text-right">Total</TableHead>
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
                              {item.color && item.size ? (
                                <div className="text-sm">
                                  <span className="block">{item.color}</span>
                                  <span className="text-gray-600">Size: {item.size}</span>
                                </div>
                              ) : (
                                <span className="text-gray-500">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {item.ship_from_warehouse || 'TBD'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">{item.quantity}</TableCell>
                            <TableCell className="text-right">{formatCurrency(item.unit_price)}</TableCell>
                            <TableCell className="text-right font-medium">{formatCurrency(item.line_total)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                {/* Totals */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <DollarSign className="w-5 h-5" />
                      Order Totals
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
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
                      <p className="text-gray-700 whitespace-pre-wrap">{selectedPO.special_instructions}</p>
                    </CardContent>
                  </Card>
                )}

                {/* Action Buttons */}
                <div className="flex justify-end gap-3">
                  <Button variant="outline" onClick={() => exportPO(selectedPO)}>
                    <Download className="w-4 h-4 mr-2" />
                    Export
                  </Button>
                  <Button>
                    <Send className="w-4 h-4 mr-2" />
                    Send to Supplier
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}