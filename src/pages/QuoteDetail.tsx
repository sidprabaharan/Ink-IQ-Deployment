import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { QuoteHeader } from "@/components/quotes/QuoteHeader";
import { QuoteDetailHeader } from "@/components/quotes/QuoteDetailHeader";
import { useInvoices } from "@/context/InvoicesContext";
import { CompanyInfoCard } from "@/components/quotes/CompanyInfoCard";
import { QuoteDetailsCard } from "@/components/quotes/QuoteDetailsCard";
import { CustomerInfoCard } from "@/components/quotes/CustomerInfoCard";
import { QuoteItemsTable } from "@/components/quotes/QuoteItemsTable";
import { NotesCard } from "@/components/quotes/NotesCard";
import { InvoiceSummaryCard } from "@/components/quotes/InvoiceSummaryCard";
import { useQuotes } from "@/context/QuotesContext";
import { useCustomers } from "@/context/CustomersContext";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
// LocalStorage image helpers removed; rely on DB only
import { supabase } from "@/lib/supabase";

export default function QuoteDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getQuote } = useQuotes();
  const { createFromQuote } = useInvoices();
  const { customers, fetchCustomers } = useCustomers();
  const { user } = useAuth();
  
  const [quote, setQuote] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [artworkFiles, setArtworkFiles] = useState<Record<string, any[]>>({});
  const [imprintsByItem, setImprintsByItem] = useState<Record<string, any[]>>({});
  
  // Add ref to track if component is mounted
  const isMountedRef = useRef(true);

  // Cleanup effect
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Removed localStorage mockup augmentation; details load from DB only

  // Function to fetch artwork files for quote items
  const fetchArtworkFiles = async (quoteItems: any[], quoteIdForPaths: string) => {
    if (!quoteItems || quoteItems.length === 0) return {};
    
    try {
      const artworkMap: Record<string, any[]> = {};
      
      for (const item of quoteItems) {
        console.debug('[QuoteDetail] Fetching artwork for item', item?.id);
        // Try DB first
        const { data: files, error } = await supabase
          .from('artwork_files')
          .select('*')
          .eq('quote_item_id', item.id);

        if (files && files.length > 0 && !error) {
          const filesWithUrls = await Promise.all(
            files.map(async (file) => {
              const { data: signedUrl } = await supabase.storage
                .from('artwork')
                .createSignedUrl(file.file_path, 3600);
              return { ...file, url: signedUrl?.signedUrl || null };
            })
          );
          console.debug('[QuoteDetail] DB artwork_files found', { itemId: item.id, count: filesWithUrls.length });
          artworkMap[item.id] = filesWithUrls;
          continue;
        }

        // If DB empty, list each imprint folder under item, then read its files per category
        const { data: imprintFolders, error: imprintListErr } = await supabase.storage
          .from('artwork')
          .list(`${quoteIdForPaths}/${item.id}`, { limit: 100 });
        if (imprintListErr) {
          console.debug('[QuoteDetail] No imprint folders found', { itemId: item.id });
          artworkMap[item.id] = [];
          continue;
        }
        const collected: any[] = [];
        for (const folderEntry of imprintFolders || []) {
          // Each entry should be an imprintId folder
          const imprintId = folderEntry.name;
          const categories: Array<'customer_art' | 'production_files' | 'proof_mockup'> = ['customer_art', 'production_files', 'proof_mockup'];
          for (const cat of categories) {
            const folder = `${quoteIdForPaths}/${item.id}/${imprintId}/${cat}`;
            const { data: listed, error: listErr } = await supabase.storage
              .from('artwork')
              .list(folder, { limit: 100 });
            if (listErr || !Array.isArray(listed)) continue;
            for (const obj of listed) {
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
        console.debug('[QuoteDetail] storage collected per-imprint files', { itemId: item.id, count: collected.length });
        artworkMap[item.id] = collected;
      }
      
      return artworkMap;
    } catch (err) {
      console.error('Error fetching artwork files:', err);
      return {};
    }
  };

  // Fetch imprints for items
  const fetchImprints = async (quoteItems) => {
    if (!quoteItems || quoteItems.length === 0) return {};
    const result: Record<string, any[]> = {};
    try {
      for (const item of quoteItems) {
        const { data, error } = await supabase
          .from('quote_imprints')
          .select('*')
          .eq('quote_item_id', item.id);
        if (!error && data) {
          result[item.id] = data;
        }
      }
    } catch (e) {
      console.error('Error fetching imprints', e);
    }
    return result;
  };

  useEffect(() => {
    const loadQuoteData = async () => {

      
      if (!id) {
        setError("Quote ID is required");
        setLoading(false);
        return;
      }

      // TEMPORARY: Redirect removed to debug current quote data
      // if (id === '6f1c5b0d-0551-4ed9-9737-9bd3169d0a2d') {
      //   console.log('🔍 [DEBUG] QuoteDetail - Redirecting to quote with proper data');
      //   navigate('/quotes/d3fcaba7-9c32-45dd-b054-b15c61a8d9f9', { replace: true });
      //   return;
      // }

      // Don't fetch if component is unmounting
      if (!isMountedRef.current) {

        return;
      }

      // Don't fetch if we're not on the quote detail page anymore
      if (!window.location.pathname.includes(`/quotes/${id}`)) {

        return;
      }

      try {
        setLoading(true);
        
        // Fetch the quote
        const quoteData = await getQuote(id);
        
        // Check again after async operation
        if (!isMountedRef.current) {
          return;
        }
        
        if (!quoteData) {
          setError("Quote not found");
          setLoading(false);
          return;
        }
        
        // Quote data loaded successfully
        
        setQuote(quoteData);

        // Ensure customers are loaded
        if (customers.length === 0) {
          await fetchCustomers();
        }

        // Check again after potential async operation
        if (!isMountedRef.current) {
          return;
        }

        // Find the customer for this quote
        const quoteCustomer = customers.find(c => c.id === quoteData.customer_id);
        setCustomer(quoteCustomer);

        // Fetch artwork files and imprints for the quote items
        if (quoteData.items && quoteData.items.length > 0) {

          try {
            const [artwork, imprints] = await Promise.all([
              fetchArtworkFiles(quoteData.items, id),
              fetchImprints(quoteData.items)
            ]);

            if (isMountedRef.current) {
              setArtworkFiles(artwork);
              setImprintsByItem(imprints);
            }
          } catch (error) {
            console.error("🔍 [DEBUG] QuoteDetail - Error fetching artwork files:", error);
            // Continue without artwork files for now
            if (isMountedRef.current) {
              setArtworkFiles({});
              setImprintsByItem({});
            }
          }
        }

      } catch (err) {
        // Only set error if component is still mounted
        if (isMountedRef.current) {
          console.error('Error loading quote:', err);
          setError(err.message || 'Failed to load quote');
        }
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
        }
      }
    };

    loadQuoteData();
  }, [id, getQuote, customers, fetchCustomers]);

  if (loading) {
    return (
      <div className="p-6 bg-gray-50 min-h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading quote details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-gray-50 min-h-full flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-xl mb-2">⚠️</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Quote</h2>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="p-6 bg-gray-50 min-h-full flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Quote Not Found</h2>
          <p className="text-gray-600">The requested quote could not be found.</p>
        </div>
      </div>
    );
  }
  
  // Format the quote data for display
  const status = quote.status;
  
  // Format financial amounts with safety checks
  const totalAmountValue = parseFloat(quote.total_amount) || 0;
  const taxRateValue = parseFloat(quote.tax_rate) || 0;
  const taxAmountValue = totalAmountValue * taxRateValue;
  const subtotalAmountValue = totalAmountValue - taxAmountValue;
  
  const totalAmount = `$${totalAmountValue.toFixed(2)}`;
  const taxAmount = `$${taxAmountValue.toFixed(2)}`;
  const subtotalAmount = `$${subtotalAmountValue.toFixed(2)}`;
  
  // For now, assume no payments made (all amount is outstanding)
  const amountOutstanding = totalAmount;
  const amountPaid = "$0.00";
  
  // Format customer billing info for display (matching CustomerInfoCard interface)
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

  // Format customer shipping info for display (matching CustomerInfoCard interface)
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

  // Format customer info for PackingSlip component (uses old interface)
  const customerInfoForPacking = customer ? {
    name: `${customer.firstName} ${customer.lastName}`,
    companyName: customer.companyName || "",
    address1: customer.shippingAddress?.address1 || "",
    address2: customer.shippingAddress?.address2 || "",
    city: customer.shippingAddress?.city || "",
    stateProvince: customer.shippingAddress?.stateProvince || "",
    zipCode: customer.shippingAddress?.zipCode || "",
    country: customer.shippingAddress?.country || "Canada",
    phone: customer.phoneNumber || "",
    email: customer.email || ""
  } : null;
  
  // Format quote details for the details card
  const formattedDetails = {
    number: quote.quote_number,
    date: new Date(quote.created_at).toLocaleDateString(),
    expiryDate: quote.valid_until ? new Date(quote.valid_until).toLocaleDateString() : "N/A",
    productionDueDate: quote.production_due_date ? new Date(quote.production_due_date).toLocaleDateString() : "N/A",
    customerDueDate: quote.customer_due_date ? new Date(quote.customer_due_date).toLocaleDateString() : "N/A",
    salesRep: "N/A", // Column doesn't exist in database yet
    terms: quote.terms_conditions || "Net 30"
  };
  
  // Transform quote items for display with proper structure

  
  const itemGroups = quote.items ? (() => {
    // If group_index is missing on all items (fallback insertion path), render one chart per item
    const hasAnyGroupIndex = (quote.items as any[]).some((it) => it.group_index != null);
    console.debug('[QuoteDetail] Grouping mode:', { 
      totalItems: quote.items.length, 
      hasAnyGroupIndex,
      mode: hasAnyGroupIndex ? 'GROUP_BY_INDEX' : 'ONE_PER_ITEM'
    });
    if (!hasAnyGroupIndex) {
      console.debug('[QuoteDetail] No group_index on items; rendering one chart per item');
      return (quote.items as any[]).map((item: any, idx: number) => {
        const itemArtwork = artworkFiles[item.id] || [];
        const makeFiles = (arr: any[]) => (arr || []).map((f: any) => ({ id: f.id, name: f.file_name || f.name, url: f.url, type: f.file_type || f.type, category: f.category }));
        const rows = imprintsByItem[item.id] || [];
        const files = itemArtwork || [];
        const filesForImprint = (imprintId: string | null) => makeFiles((files || []).filter((f: any) => !imprintId || f.imprint_id === imprintId));
        const imprints = rows.length > 0
          ? rows.map((r: any) => ({
              id: r.id,
              method: r.method,
              location: r.location || 'N/A',
              width: parseFloat(r.width) || 0,
              height: parseFloat(r.height) || 0,
              colorsOrThreads: r.colors_or_threads || 'N/A',
              notes: r.notes || '',
              customerArt: filesForImprint(r.id).filter((f: any) => f.category === 'customer_art'),
              productionFiles: filesForImprint(r.id).filter((f: any) => f.category === 'production_files'),
              proofMockup: filesForImprint(r.id).filter((f: any) => f.category === 'proof_mockup'),
            }))
          : [];
        return {
          id: `group-${idx + 1}`,
          items: [{
            id: item.id,
            category: item.category || (item.product_name ? 'Product' : 'T-Shirts'),
            itemNumber: item.item_number || item.product_sku || 'N/A',
            color: item.color || 'N/A',
            description: item.product_name || item.product_description || 'Product',
            sizes: { xs: item.xs || 0, s: item.s || 0, m: item.m || 0, l: item.l || 0, xl: item.xl || 0, xxl: item.xxl || 0, xxxl: item.xxxl || 0 },
            price: parseFloat(item.unit_price) || 0,
            taxed: item.taxed !== false,
            total: parseFloat(item.total_price) || 0,
            status: item.garment_status || 'pending',
            mockups: makeFiles(files).filter((f: any) => f.category === 'proof_mockup').map((f: any) => ({ id: f.id, name: f.name, url: f.url, type: f.type })),
          }],
          imprints,
        };
      });
    }
    // Group items by group_index to mirror creation groups exactly
    const byGroup = new Map<number, any[]>();
    quote.items.forEach((it: any) => {
      const gi = it.group_index || 1;
      console.debug('[QuoteDetail] Processing item for grouping', { itemId: it.id, productName: it.product_name, groupIndex: gi });
      if (!byGroup.has(gi)) byGroup.set(gi, []);
      byGroup.get(gi)!.push(it);
    });
    const sortedGroups = Array.from(byGroup.entries()).sort((a, b) => a[0] - b[0]);
    console.debug('[QuoteDetail] Final groups created', sortedGroups.map(([g, items]) => ({ group: g, itemCount: items.length })));

    const groups: any[] = [];
    sortedGroups.forEach(([groupIdx, itemsInCat]) => {
      const transformedItems = itemsInCat.map((item: any) => ({
        id: item.id,
        category: item.category || (item.product_name ? 'Product' : 'T-Shirts'),
        itemNumber: item.item_number || item.product_sku || 'N/A',
        color: item.color || 'N/A',
        description: item.product_name || item.product_description || 'Product',
        sizes: {
          xs: item.xs || 0,
          s: item.s || 0,
          m: item.m || 0,
          l: item.l || 0,
          xl: item.xl || 0,
          xxl: item.xxl || 0,
          xxxl: item.xxxl || 0,
        },
        price: parseFloat(item.unit_price) || 0,
        taxed: item.taxed !== false,
        total: parseFloat(item.total_price) || 0,
        status: item.garment_status || 'pending',
        mockups: (() => {
          const itemArtwork = artworkFiles[item.id] || [];
          return itemArtwork
            .filter((f: any) => f.category === 'proof_mockup' && f.url)
            .map((f: any) => ({ id: f.id, name: f.file_name || f.name, url: f.url, type: f.file_type || f.type }));
        })(),
      }));

      const groupItemIds = new Set(itemsInCat.map((i: any) => i.id));
      const makeFiles = (files: any[]) => (files || []).map((f: any) => ({
        id: f.id,
        name: f.file_name || f.name,
        url: f.url,
        type: f.file_type || f.type,
        category: f.category,
      }));

      const imprints: any[] = [];
      itemsInCat.forEach((item: any) => {
        const rows = imprintsByItem[item.id] || [];
        const itemArtwork = artworkFiles[item.id] || [];
        console.debug('[QuoteDetail] Processing imprints for item', { itemId: item.id, imprintCount: rows.length });
        const filesForImprint = (imprintId: string | null) => makeFiles(
          (itemArtwork || []).filter((f: any) => !imprintId || f.imprint_id === imprintId)
        );
        if (rows.length > 0) {
          rows.forEach((r: any) => {
            console.debug('[QuoteDetail] Adding imprint', { imprintId: r.id, method: r.method, location: r.location });
            const files = filesForImprint(r.id);
            imprints.push({
              id: r.id,
              method: r.method,
              location: r.location || 'N/A',
              width: parseFloat(r.width) || 0,
              height: parseFloat(r.height) || 0,
              colorsOrThreads: r.colors_or_threads || 'N/A',
              notes: r.notes || '',
              customerArt: files.filter((f: any) => f.category === 'customer_art'),
              productionFiles: files.filter((f: any) => f.category === 'production_files'),
              proofMockup: files.filter((f: any) => f.category === 'proof_mockup'),
            });
          });
        } else if (item.imprint_type) {
          const files = filesForImprint(null);
          imprints.push({
            id: `imprint-${item.id}`,
            method: item.imprint_type,
            location: 'N/A',
            width: 0,
            height: 0,
            colorsOrThreads: 'N/A',
            notes: item.notes || '',
            customerArt: files.filter((f: any) => f.category === 'customer_art'),
            productionFiles: files.filter((f: any) => f.category === 'production_files'),
            proofMockup: files.filter((f: any) => f.category === 'proof_mockup'),
          });
        }
      });

      // De-duplicate imprints by unique imprint ID to avoid duplicates
      const seen = new Set<string>();
      const dedupedImprints = imprints.filter((imp) => {
        if (seen.has(imp.id)) {
          console.debug('[QuoteDetail] Filtering out duplicate imprint', { imprintId: imp.id, method: imp.method, location: imp.location });
          return false;
        }
        seen.add(imp.id);
        return true;
      });

      console.debug('[QuoteDetail] Built group', { group: groupIdx, items: transformedItems.length, imprints: dedupedImprints.length, imprintIds: dedupedImprints.map(i => i.id) });
      groups.push({ id: `group-${groupIdx}`, items: transformedItems, imprints: dedupedImprints });
    });

    return groups;
  })() : [];
  
  // Create mock company info (keeping existing format)
  const companyInfo = {
    name: "InkIQ Print Solutions",
    address: "123 Business St",
    city: "Toronto", 
    province: "ON",
    postalCode: "M1A 1A1",
    phone: "(555) 123-4567",
    email: "info@inkiq.com"
  };

  // Format summary (keeping existing format)
  const quoteSummary = {
    subtotal: subtotalAmount,
    taxRate: `${(quote.tax_rate * 100).toFixed(1)}%`,
    taxAmount: taxAmount,
    totalDue: totalAmount
  };
  
  return (
    <div className="p-6 bg-gray-50 min-h-full">
        <QuoteDetailHeader 
          quoteId={quote.id} 
          quoteNumber={quote.quote_number}
          status={status} 
          customerInfo={customerInfoForPacking}
          items={quote.items || []}
        />
        <div className="flex justify-end mb-4">
          <Button
            className="bg-inkiq-primary hover:bg-inkiq-primary/90 gap-2"
            onClick={async () => {
              if (!id) return;
              const result = await createFromQuote(id);
              if (result.success && result.invoice_id) {
                navigate(`/invoices/${result.invoice_id}`);
              }
            }}
          >
            Create Invoice
          </Button>
        </div>

        {/* Create New Quote Button */}
        <div className="flex justify-end">
          <Button 
            onClick={() => navigate("/quotes/new")}
            className="bg-inkiq-primary hover:bg-inkiq-primary/90 gap-2"
          >
            <Plus className="h-4 w-4" />
            Create New Quote
          </Button>
        </div>

        <div className="space-y-6">
          {/* Company and Quote Details - top row */}
          <div className="grid grid-cols-2 gap-6">
            {/* Company Information - top left */}
            <CompanyInfoCard company={companyInfo} />
            
            {/* Quote Details - top right */}
            <QuoteDetailsCard 
              details={formattedDetails} 
              totalAmount={totalAmount}
              amountPaid={amountPaid}
              amountOutstanding={amountOutstanding}
            />
          </div>
          
                    {/* Customer Information - second row */}
          {customer && (
          <div className="grid grid-cols-2 gap-6">
            {/* Billing Information */}
            <CustomerInfoCard 
              title="Customer Billing" 
                customerInfo={customerBilling} 
            />
            
            {/* Shipping Information */}
            <CustomerInfoCard 
              title="Customer Shipping" 
                customerInfo={customerShipping} 
            />
          </div>
          )}
          
          {/* Quote Items - full width */}
          {quote.items && quote.items.length > 0 && (
          <QuoteItemsTable itemGroups={itemGroups} quoteId={id} />
          )}
          
          {/* Notes and Invoice Summary - bottom row */}
          <div className="grid grid-cols-3 gap-6">
            {/* Customer Notes */}
            <NotesCard title="Customer Notes" content={quote.notes || "No customer notes"} />
            
            {/* Production Notes */}
            <NotesCard title="Production Notes" content={quote.description || "No production notes"} />
            
            {/* Invoice Summary */}
            <InvoiceSummaryCard summary={quoteSummary} />
          </div>
        </div>
    </div>
  );
}

