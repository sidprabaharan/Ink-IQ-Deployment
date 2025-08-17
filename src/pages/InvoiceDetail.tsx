import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useInvoices } from '@/context/InvoicesContext';
import { supabase } from '@/lib/supabase';
import { useCustomers } from '@/context/CustomersContext';
import { QuoteItemsTable } from '@/components/quotes/QuoteItemsTable';
import { QuoteDetailHeader } from '@/components/quotes/QuoteDetailHeader';
import { CompanyInfoCard } from '@/components/quotes/CompanyInfoCard';
import { CustomerInfoCard } from '@/components/quotes/CustomerInfoCard';
import { QuoteDetailsCard } from '@/components/quotes/QuoteDetailsCard';
import { NotesCard } from '@/components/quotes/NotesCard';
import { InvoiceSummaryCard } from '@/components/quotes/InvoiceSummaryCard';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

export default function InvoiceDetail() {
  const { id } = useParams();
  const { getInvoice, updateInvoiceStatus, recordPayment } = useInvoices();
  const { customers, fetchCustomers } = useCustomers();
  const [data, setData] = useState<any | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string>('draft');
  const [artworkFiles, setArtworkFiles] = useState<Record<string, any[]>>({});
  const [imprintsByItem, setImprintsByItem] = useState<Record<string, any[]>>({});
  const [quoteDueDates, setQuoteDueDates] = useState<{ production?: string; customer?: string } | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('cash');
  const [reference, setReference] = useState('');
  const [memo, setMemo] = useState('');

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      setLoading(true);
      const result = await getInvoice(id);
      if (result) {
        const inv = result.invoice || result;
        setData(inv);
        setItems(result.items || []);
        setPayments(result.payments || []);
        setStatus(inv.status || 'draft');
        // Fetch original quote due dates if available
        if (inv.quote_id) {
          try {
            const { data: q } = await supabase
              .from('quotes')
              .select('production_due_date, customer_due_date')
              .eq('id', inv.quote_id)
              .single();
            if (q) {
              setQuoteDueDates({
                production: q.production_due_date ? new Date(q.production_due_date).toLocaleDateString() : undefined,
                customer: q.customer_due_date ? new Date(q.customer_due_date).toLocaleDateString() : undefined,
              });
            }
          } catch (_) {
            setQuoteDueDates(null);
          }
        }
        // Fetch imprints and artwork for original quote items
        try {
          const [artwork, imprints] = await Promise.all([
            (async () => {
              const mapping: Record<string, any[]> = {};
              for (const it of (result.items || [])) {
                const quoteItemId = it.quote_item_id;
                if (!quoteItemId) continue;
                // Try DB artwork_files first
                const { data: files, error } = await supabase
                  .from('artwork_files')
                  .select('*')
                  .eq('quote_item_id', quoteItemId);
                if (files && files.length > 0 && !error) {
                  const filesWithUrls = await Promise.all(
                    files.map(async (file) => {
                      const { data: signedUrl } = await supabase.storage
                        .from('artwork')
                        .createSignedUrl(file.file_path, 3600);
                      return { ...file, url: signedUrl?.signedUrl || null };
                    })
                  );
                  mapping[quoteItemId] = filesWithUrls;
                  continue;
                }
                // Fallback to storage listing
                const { data: imprintFolders } = await supabase.storage
                  .from('artwork')
                  .list(`${inv.quote_id || inv.id}/${quoteItemId}`, { limit: 100 });
                const collected: any[] = [];
                for (const folderEntry of imprintFolders || []) {
                  const imprintId = folderEntry.name;
                  const cats: Array<'customer_art'|'production_files'|'proof_mockup'> = ['customer_art','production_files','proof_mockup'];
                  for (const cat of cats) {
                    const folder = `${inv.quote_id || inv.id}/${quoteItemId}/${imprintId}/${cat}`;
                    const { data: listed } = await supabase.storage
                      .from('artwork')
                      .list(folder, { limit: 100 });
                    for (const obj of listed || []) {
                      const fullPath = `${folder}/${obj.name}`;
                      const { data: signedUrl } = await supabase.storage
                        .from('artwork')
                        .createSignedUrl(fullPath, 3600);
                      collected.push({
                        id: `${imprintId}-${cat}-${obj.name}`,
                        file_name: obj.name,
                        file_type: (obj as any).metadata?.mimetype || 'application/octet-stream',
                        category: cat,
                        url: signedUrl?.signedUrl || null,
                        imprint_id: imprintId,
                      });
                    }
                  }
                }
                mapping[quoteItemId] = collected;
              }
              return mapping;
            })(),
            (async () => {
              const map: Record<string, any[]> = {};
              for (const it of (result.items || [])) {
                const quoteItemId = it.quote_item_id;
                if (!quoteItemId) continue;
                const { data: rows } = await supabase
                  .from('quote_imprints')
                  .select('*')
                  .eq('quote_item_id', quoteItemId);
                map[quoteItemId] = rows || [];
              }
              return map;
            })()
          ]);
          setArtworkFiles(artwork);
          setImprintsByItem(imprints);
        } catch (e) {
          setArtworkFiles({});
          setImprintsByItem({});
        }
      }
      if (customers.length === 0) {
        await fetchCustomers();
      }
      setLoading(false);
    };
    load();
  }, [id, getInvoice]);

  if (loading) return <div className="p-6">Loading invoice...</div>;
  if (!data) return <div className="p-6">Invoice not found</div>;

  // Transform invoice items into groups compatible with QuoteItemsTable (read-only rendering)
  const byGroup = new Map<number, any[]>();
  (items || []).forEach((it: any) => {
    const gi = it.group_index || 1;
    if (!byGroup.has(gi)) byGroup.set(gi, []);
    byGroup.get(gi)!.push(it);
  });
  const groups = Array.from(byGroup.entries()).sort((a,b)=>a[0]-b[0]).map(([gi, arr]) => {
    const transformedItems = arr.map((item: any) => ({
      id: item.id,
      category: item.category || 'Product',
      itemNumber: item.product_sku || item.line_no || 'N/A',
      color: item.color || 'N/A',
      description: item.product_name || item.description || 'Product',
      sizes: { xs: item.xs||0, s:item.s||0, m:item.m||0, l:item.l||0, xl:item.xl||0, xxl:item.xxl||0, xxxl:item.xxxl||0 },
      price: Number(item.unit_price)||0,
      taxed: item.taxed !== false,
      total: Number(item.line_subtotal)||0,
      status: 'n/a',
      mockups: [],
      quoteItemId: item.quote_item_id || null,
    }));
    // Build imprints for this group using quote_item_id mapping
    const imprints: any[] = [];
    arr.forEach((item: any) => {
      const rows = imprintsByItem[item.quote_item_id] || [];
      const itemFiles = artworkFiles[item.quote_item_id] || [];
      const filesForImprint = (imprintId: string | null) => (itemFiles || []).filter((f: any) => !imprintId || f.imprint_id === imprintId);
      if (rows.length > 0) {
        rows.forEach((r: any) => {
          const files = filesForImprint(r.id);
          imprints.push({
            id: r.id,
            method: r.method,
            location: r.location || 'N/A',
            width: parseFloat(r.width) || 0,
            height: parseFloat(r.height) || 0,
            colorsOrThreads: r.colors_or_threads || 'N/A',
            notes: r.notes || '',
            customerArt: files.filter((f: any) => f.category === 'customer_art').map((f:any)=>({ id: f.id, name: f.file_name, url: f.url, type: f.file_type })),
            productionFiles: files.filter((f: any) => f.category === 'production_files').map((f:any)=>({ id: f.id, name: f.file_name, url: f.url, type: f.file_type })),
            proofMockup: files.filter((f: any) => f.category === 'proof_mockup').map((f:any)=>({ id: f.id, name: f.file_name, url: f.url, type: f.file_type })),
          });
        });
      }
    });
    // De-duplicate
    const seen = new Set<string>();
    const dedupedImprints = imprints.filter((imp) => {
      if (seen.has(imp.id)) return false;
      seen.add(imp.id);
      return true;
    });
    return {
      id: `group-${gi}`,
      items: transformedItems,
      imprints: dedupedImprints,
    };
  });

  const handleStatusChange = async (newStatus: string) => {
    setStatus(newStatus);
    if (id) await updateInvoiceStatus(id, newStatus);
  };

  // Prepare top tiles similar to quote detail
  const companyInfo = {
    name: "InkIQ Print Solutions",
    address: "123 Business St",
    city: "Toronto",
    province: "ON",
    postalCode: "M1A 1A1",
    phone: "(555) 123-4567",
    email: "info@inkiq.com"
  };

  const customer = customers.find(c => c.id === data.customer_id);
  const customerBilling = customer ? {
    name: `${customer.firstName} ${customer.lastName}`,
    company: customer.companyName || "",
    contact: `${customer.firstName} ${customer.lastName}`,
    address: customer.billingAddress?.address1 || "",
    unit: customer.billingAddress?.address2 || undefined,
    city: customer.billingAddress?.city || "",
    region: customer.billingAddress?.stateProvince || "",
    postalCode: customer.billingAddress?.zipCode || "",
    phone: customer.phoneNumber || "",
    email: customer.email || ""
  } : null;
  const customerShipping = customer ? {
    name: `${customer.firstName} ${customer.lastName}`,
    company: customer.companyName || "",
    contact: `${customer.firstName} ${customer.lastName}`,
    address: customer.shippingAddress?.address1 || "",
    unit: customer.shippingAddress?.address2 || undefined,
    city: customer.shippingAddress?.city || "",
    region: customer.shippingAddress?.stateProvince || "",
    postalCode: customer.shippingAddress?.zipCode || "",
    phone: customer.phoneNumber || "",
    email: customer.email || ""
  } : null;

  const formattedDetails = {
    number: data.invoice_number,
    date: new Date(data.invoice_date || data.created_at).toLocaleDateString(),
    expiryDate: data.due_date ? new Date(data.due_date).toLocaleDateString() : 'N/A',
    productionDueDate: quoteDueDates?.production,
    customerDueDate: quoteDueDates?.customer,
    salesRep: 'N/A',
    terms: data.terms || 'Net 30'
  };

  const totalAmountValue = Number(data.total_amount) || 0;
  const amountPaidValue = (payments || []).reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
  const amountOutstandingValue = Math.max(totalAmountValue - amountPaidValue, 0);
  const totalAmount = `$${totalAmountValue.toFixed(2)}`;
  const amountPaid = `$${amountPaidValue.toFixed(2)}`;
  const amountOutstanding = `$${amountOutstandingValue.toFixed(2)}`;

  const invoiceSummary = {
    itemTotal: `$${(Number(data.subtotal) || 0).toFixed(2)}`,
    feesTotal: `$${(Number(data.shipping_amount) || 0).toFixed(2)}`,
    subTotal: `$${(Number(data.subtotal) || 0).toFixed(2)}`,
    discount: `$${(Number(data.discount_amount) || 0).toFixed(2)}`,
    salesTax: `$${(Number(data.tax_amount) || 0).toFixed(2)}`,
    totalDue: totalAmount
  };

  // Build imprint details and artwork using existing quote logic: map invoice items back to quote items
  const fetchImprintsAndArtwork = async () => {
    // re-use logic from QuoteDetail: we need quote_id and quote_item_ids
    // Since QuoteItemsTable expects imprints in each group, we can later enhance to include them
  };

  return (
    <div className="p-6 bg-gray-50 min-h-full">
      <QuoteDetailHeader 
        quoteId={data.id}
        quoteNumber={data.invoice_number}
        status={status}
        customerInfo={customerShipping}
        items={items || []}
      />

      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-6">
          <CompanyInfoCard company={companyInfo} />
          <QuoteDetailsCard 
            details={formattedDetails}
            totalAmount={totalAmount}
            amountPaid={amountPaid}
            amountOutstanding={amountOutstanding}
          />
        </div>

        {customer && (
          <div className="grid grid-cols-2 gap-6">
            <CustomerInfoCard title="Customer Billing" customerInfo={customerBilling} />
            <CustomerInfoCard title="Customer Shipping" customerInfo={customerShipping} />
          </div>
        )}

        <QuoteItemsTable itemGroups={groups} quoteId={data.id} />

        <div className="grid grid-cols-3 gap-6">
          <NotesCard title="Customer Notes" content={data.notes || 'No customer notes'} />
          <NotesCard title="Production Notes" content={data.description || 'No production notes'} />
          <InvoiceSummaryCard summary={invoiceSummary} />
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setPayOpen(true)}>Record Payment</Button>
        </div>
      </div>

      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogTitle>Record Payment</DialogTitle>
          <div className="space-y-3">
            <div>
              <label className="text-sm">Amount</label>
              <Input type="number" value={amount} onChange={(e)=>setAmount(e.target.value)} />
            </div>
            <div>
              <label className="text-sm">Method</label>
              <Input value={method} onChange={(e)=>setMethod(e.target.value)} />
            </div>
            <div>
              <label className="text-sm">Reference</label>
              <Input value={reference} onChange={(e)=>setReference(e.target.value)} />
            </div>
            <div>
              <label className="text-sm">Memo</label>
              <Input value={memo} onChange={(e)=>setMemo(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={()=>setPayOpen(false)}>Cancel</Button>
              <Button onClick={async ()=>{
                if (!id) return;
                const amt = parseFloat(amount||'0');
                if (isNaN(amt) || amt<=0) return;
                await recordPayment(id, { amount: amt, method, reference, memo });
                setPayOpen(false);
              }}>Save Payment</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}


