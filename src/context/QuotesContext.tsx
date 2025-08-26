import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface QuoteItem {
  id: string;
  product_name: string;
  product_sku?: string;
  product_description?: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  imprint_type?: string;
  setup_fee: number;
  imprint_cost: number;
  notes?: string;
  created_at: string;
}

interface Quote {
  id: string;
  quote_number: string;
  customer_id: string;
  customer_name?: string;
  customer_company?: string;
  status: 'draft' | 'sent' | 'pending_approval' | 'approved' | 'rejected' | 'expired' | 'converted';
  subject?: string;
  description?: string;
  total_amount: number;
  tax_rate: number;
  tax_amount: number;
  discount_percentage: number;
  discount_amount: number;
  final_amount: number;
  valid_until: string;
  sent_date?: string;
  approved_date?: string;
  notes?: string;
  terms_conditions?: string;
  created_at: string;
  updated_at: string;
  items?: QuoteItem[];
}

interface QuotesContextType {
  quotes: Quote[];
  loading: boolean;
  error: string | null;
  createQuote: (quoteData: CreateQuoteData) => Promise<{ success: boolean; quote_id?: string; error?: string }>;
  getQuotes: (filters?: QuoteFilters) => Promise<void>;
  getQuote: (quoteId: string) => Promise<Quote | null>;
  updateQuoteStatus: (quoteId: string, status: Quote['status']) => Promise<{ success: boolean; error?: string }>;
  addQuoteItem: (quoteId: string, itemData: CreateQuoteItemData) => Promise<{ success: boolean; error?: string }>;
  removeQuoteItem: (quoteId: string, itemId: string) => Promise<{ success: boolean; error?: string }>;
  deleteQuote: (quoteId: string) => Promise<{ success: boolean; error?: string }>;
}

interface CreateQuoteData {
  customer_id: string;
  subject?: string;
  description?: string;
  tax_rate?: number;
  discount_percentage?: number;
  valid_until_days?: number;
  notes?: string;
  terms_conditions?: string;
  production_due_date?: Date;
  customer_due_date?: Date;
  payment_due_date?: Date;
  invoice_date?: Date;
  items?: CreateQuoteItemData[];
}

interface CreateQuoteItemData {
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  product_sku?: string;
  product_description?: string;
  category?: string;
  item_number?: string;
  color?: string;
  xs?: number;
  s?: number;
  m?: number;
  l?: number;
  xl?: number;
  xxl?: number;
  xxxl?: number;
  taxed?: boolean;
  garment_status?: string;
  imprint_type?: string;
  setup_fee?: number;
  imprint_cost?: number;
  notes?: string;
}

interface QuoteFilters {
  page_number?: number;
  page_size?: number;
  search_term?: string;
  status_filter?: string;
  customer_filter?: string;
  date_from?: string;
  date_to?: string;
}

const QuotesContext = createContext<QuotesContextType | undefined>(undefined);

export const useQuotes = () => {
  const context = useContext(QuotesContext);
  if (context === undefined) {
    throw new Error('useQuotes must be used within a QuotesProvider');
  }
  return context;
};

interface QuotesProviderProps {
  children: React.ReactNode;
}

export const QuotesProvider: React.FC<QuotesProviderProps> = ({ children }) => {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get all quotes with optional filtering
  const getQuotes = async (filters: QuoteFilters = {}) => {
    setLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase.rpc('get_quotes', {
        page_number: filters.page_number || 1,
        page_size: filters.page_size || 25,
        search_term: filters.search_term || null,
        status_filter: filters.status_filter || null,
        customer_filter: filters.customer_filter || null,
        date_from: filters.date_from || null,
        date_to: filters.date_to || null
      });

      if (error) throw error;

      if (data && data.length > 0) {
        const quotesData = data[0].quotes;
        // Handle both array and null cases
        if (quotesData && Array.isArray(quotesData)) {
          // Debug: log date fields coming from backend
          try {
            console.debug('[QuotesContext] getQuotes received', {
              count: quotesData.length,
              sample: quotesData.slice(0, 5).map((q: any) => ({
                id: q.id,
                quote_number: q.quote_number,
                status: q.status,
                customer_due_date: q.customer_due_date,
                production_due_date: q.production_due_date,
                payment_due_date: q.payment_due_date,
                valid_until: q.valid_until,
                created_at: q.created_at,
              }))
            });
          } catch {}
          // If RPC payload is missing due date fields, fall back to direct select
          const missingDueFields = quotesData.every((q: any) => (
            typeof q.customer_due_date === 'undefined' &&
            typeof q.production_due_date === 'undefined' &&
            typeof q.payment_due_date === 'undefined' &&
            typeof q.valid_until === 'undefined'
          ));
          if (missingDueFields) {
            console.warn('[QuotesContext] RPC get_quotes lacks due date fields; falling back to direct select');
            const { data: rows, error: selErr } = await supabase
              .from('quotes')
              .select('id, quote_number, customer_id, status, subject, description, total_amount, tax_rate, tax_amount, discount_percentage, discount_amount, final_amount, valid_until, sent_date, approved_date, created_at, updated_at, production_due_date, customer_due_date, payment_due_date, terms_conditions, customers:customer_id (name, company)')
              .order('created_at', { ascending: false })
              .limit(filters.page_size || 25);
            if (!selErr && Array.isArray(rows)) {
              const mapped = rows.map((r: any) => ({
                ...r,
                customer_name: r.customers?.name || null,
                customer_company: r.customers?.company || null,
              }));
              setQuotes(mapped as any);
            } else {
              setQuotes(quotesData as any);
            }
          } else {
            // Merge missing due date fields from direct select by IDs
            try {
              const ids = quotesData.map((q: any) => q.id).filter(Boolean);
              if (ids.length > 0) {
                const { data: dueRows, error: dueErr } = await supabase
                  .from('quotes')
                  .select('id, customer_due_date, production_due_date, payment_due_date, valid_until')
                  .in('id', ids);
                if (!dueErr && Array.isArray(dueRows)) {
                  const byId = new Map<string, any>();
                  dueRows.forEach((r: any) => byId.set(r.id, r));
                  const merged = quotesData.map((q: any) => ({
                    ...q,
                    ...byId.get(q.id),
                  }));
                  setQuotes(merged as any);
                } else {
                  setQuotes(quotesData);
                }
              } else {
                setQuotes(quotesData);
              }
            } catch {
              setQuotes(quotesData);
            }
          }
        } else {
          setQuotes([]);
        }
      } else {
        setQuotes([]);
      }
    } catch (err) {
      console.error('Error fetching quotes:', err);
      // Log more details about the error
      if (err && typeof err === 'object' && 'message' in err) {
        setError(err.message as string);
      } else if (err && typeof err === 'object' && 'details' in err) {
        setError(err.details as string);
      } else {
        setError('Failed to fetch quotes');
      }
    } finally {
      setLoading(false);
    }
  };

  // Get a single quote with items
  const getQuote = async (quoteId: string): Promise<Quote | null> => {
    try {
      const { data, error } = await supabase.rpc('get_quote', { p_quote_id: quoteId });
      if (!error && data) return data as Quote;
    } catch (err) {
      console.warn('RPC get_quote failed, falling back to direct select:', err);
    }

    try {
      // Fallback: select directly from tables with embedded items
      const { data, error } = await supabase
        .from('quotes')
        .select('*, items:quote_items(*)')
        .eq('id', quoteId)
        .single();
      if (error) throw error;
      return data as unknown as Quote;
    } catch (err) {
      console.error('Error fetching quote (fallback):', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch quote');
      return null;
    }
  };

  // Create a new quote
  const createQuote = async (quoteData: CreateQuoteData) => {
    try {
      const itemsArray = quoteData.items || [];

      const formatDateParam = (d?: Date) => {
        if (!d) return null;
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
      };
      const prodDueStr = formatDateParam(quoteData.production_due_date as any ?? (quoteData as any).productionDueDate);
      const custDueStr = formatDateParam(quoteData.customer_due_date as any ?? (quoteData as any).customerDueDate);
      const payDueStr = formatDateParam(quoteData.payment_due_date as any ?? (quoteData as any).paymentDueDate);
      const invDateStr = formatDateParam(quoteData.invoice_date as any ?? (quoteData as any).invoiceDate);

      // Try RPC v1 then v2
      let rpc = await supabase.rpc('create_quote_with_items', {
        customer_id: quoteData.customer_id,
        quote_subject: quoteData.subject,
        quote_description: quoteData.description,
        tax_rate: quoteData.tax_rate || 0,
        discount_percentage: quoteData.discount_percentage || 0,
        valid_until_days: quoteData.valid_until_days || 30,
        notes: quoteData.notes,
        terms_conditions: quoteData.terms_conditions,
        production_due_date: prodDueStr,
        customer_due_date: custDueStr,
        payment_due_date: payDueStr,
        invoice_date: invDateStr,
        items: itemsArray
      });
      if (rpc.error) {
        rpc = await supabase.rpc('create_quote_with_items_v2', {
          customer_id: quoteData.customer_id,
          quote_subject: quoteData.subject,
          quote_description: quoteData.description,
          tax_rate: quoteData.tax_rate || 0,
          discount_percentage: quoteData.discount_percentage || 0,
          valid_until_days: quoteData.valid_until_days || 30,
          notes: quoteData.notes,
          terms_conditions: quoteData.terms_conditions,
          production_due_date: prodDueStr,
          customer_due_date: custDueStr,
          payment_due_date: payDueStr,
          invoice_date: invDateStr,
          items: itemsArray
        });
      }

      if (rpc.error) {
        // Fallback: create_quote then insert items
        const cq = await supabase.rpc('create_quote', {
          customer_id: quoteData.customer_id,
          quote_subject: quoteData.subject,
          quote_description: quoteData.description,
          tax_rate: quoteData.tax_rate || 0,
          discount_percentage: quoteData.discount_percentage || 0,
          valid_until_days: quoteData.valid_until_days || 30,
          notes: quoteData.notes || null,
          terms_conditions: quoteData.terms_conditions || null,
          production_due_date: prodDueStr,
          customer_due_date: custDueStr,
          payment_due_date: payDueStr,
          invoice_date: invDateStr
        });
        if (cq.error || !cq.data?.quote_id) throw cq.error || new Error('create_quote failed');
        const newQuoteId = cq.data.quote_id as string;

        let orgId: string | null = null;
        try {
          const org = await supabase.rpc('get_user_org');
          orgId = (org.data as string) || null;
        } catch {}
        if (!orgId) {
          try {
            const orgInfo = await supabase.rpc('get_user_org_info');
            orgId = Array.isArray(orgInfo.data) ? (orgInfo.data[0]?.org_id as string) : null;
          } catch {}
        }

        const directItems = itemsArray.map((it) => ({
          quote_id: newQuoteId,
          org_id: orgId,
          product_name: it.product_name,
          product_sku: it.product_sku || null,
          product_description: it.product_description || null,
          category: it.category || null,
          item_number: it.item_number || null,
          color: it.color || null,
          quantity: it.quantity || 0,
          unit_price: it.unit_price || 0,
          total_price: it.total_price || 0,
          xs: it.xs || 0,
          s: it.s || 0,
          m: it.m || 0,
          l: it.l || 0,
          xl: it.xl || 0,
          xxl: it.xxl || 0,
          xxxl: it.xxxl || 0,
          taxed: it.taxed ?? true,
          garment_status: it.garment_status || 'pending',
          imprint_type: it.imprint_type || null,
          setup_fee: it.setup_fee || 0,
          imprint_cost: it.imprint_cost || 0,
          notes: it.notes || null,
          group_index: (it as any).group_index || null,
          group_label: (it as any).group_label || null,
        }));

        const bulk = await supabase.from('quote_items').insert(directItems);
        if (bulk.error) {
          for (const it of itemsArray) {
            const v2 = await supabase.rpc('add_quote_item_v2', {
              p_quote_id: newQuoteId,
              p_product_name: it.product_name,
              p_product_sku: it.product_sku || '',
              p_product_description: it.product_description || '',
              p_category: it.category || '',
              p_item_number: it.item_number || '',
              p_color: it.color || '',
              p_quantity: it.quantity || 0,
              p_unit_price: it.unit_price || 0,
              p_imprint_type: it.imprint_type || '',
              p_setup_fee: it.setup_fee || 0,
              p_imprint_cost: it.imprint_cost || 0,
              p_notes: it.notes || '',
              p_xs: it.xs || 0,
              p_s: it.s || 0,
              p_m: it.m || 0,
              p_l: it.l || 0,
              p_xl: it.xl || 0,
              p_xxl: it.xxl || 0,
              p_xxxl: it.xxxl || 0,
              p_taxed: it.taxed ?? true,
              p_group_index: (it as any).group_index || 0,
              p_group_label: (it as any).group_label || '',
              p_l: it.l || 0,
            } as any);
            if (v2.error) {
              const v1 = await supabase.rpc('add_quote_item', {
                quote_id: newQuoteId,
                product_name: it.product_name,
                quantity: it.quantity || 0,
                unit_price: it.unit_price || 0,
                product_sku: it.product_sku || null,
                product_description: it.product_description || null,
                imprint_type: it.imprint_type || null,
                setup_fee: it.setup_fee || 0,
                imprint_cost: it.imprint_cost || 0,
                notes: it.notes || null,
              });
              if (v1.error) throw v1.error;
            }
          }
        }

        await getQuotes();
        return { success: true, quote_id: newQuoteId, quote_number: cq.data.quote_number };
      }

      await getQuotes();
      return { success: true, quote_id: (rpc.data as any).quote_id, quote_number: (rpc.data as any).quote_number };
    } catch (err: any) {
      console.error('Error creating quote:', err);
      return { success: false, error: err?.message || err?.details || 'Failed to create quote' };
    }
  };

  // Add item to quote
  const addQuoteItem = async (quoteId: string, itemData: CreateQuoteItemData) => {
    try {
      const { data, error } = await supabase.rpc('add_quote_item', {
        quote_id: quoteId,
        product_name: itemData.product_name,
        quantity: itemData.quantity,
        unit_price: itemData.unit_price,
        product_sku: itemData.product_sku,
        product_description: itemData.product_description,
        imprint_type: itemData.imprint_type,
        setup_fee: itemData.setup_fee || 0,
        imprint_cost: itemData.imprint_cost || 0,
        notes: itemData.notes
      });

      if (error) throw error;

      // Refresh quotes list
      await getQuotes();

      return { success: true };
    } catch (err) {
      console.error('Error adding quote item:', err);
      return { 
        success: false, 
        error: err instanceof Error ? err.message : 'Failed to add quote item' 
      };
    }
  };

  // Remove item from quote
  const removeQuoteItem = async (quoteId: string, itemId: string) => {
    try {
      const { data, error } = await supabase.rpc('remove_quote_item', {
        quote_id: quoteId,
        item_id: itemId
      });

      if (error) throw error;

      // Refresh quotes list
      await getQuotes();

      return { success: true };
    } catch (err) {
      console.error('Error removing quote item:', err);
      return { 
        success: false, 
        error: err instanceof Error ? err.message : 'Failed to remove quote item' 
      };
    }
  };

  // Update quote status
  const updateQuoteStatus = async (quoteId: string, status: Quote['status']) => {
    try {
      const { data, error } = await supabase.rpc('update_quote_status', {
        quote_id: quoteId,
        new_status: status
      });

      if (error) throw error;

      // Refresh quotes list
      await getQuotes();

      return { success: true };
    } catch (err) {
      console.error('Error updating quote status:', err);
      return { 
        success: false, 
        error: err instanceof Error ? err.message : 'Failed to update quote status' 
      };
    }
  };

  // Delete quote
  const deleteQuote = async (quoteId: string) => {
    console.log('🔍 [DEBUG] QuotesContext - deleteQuote called with ID:', quoteId);
    
    try {
      
      const { data, error } = await supabase.rpc('delete_quote', {
        p_quote_id: quoteId
      });

      if (error) {
        throw error;
      }

      console.log('🔍 [DEBUG] QuotesContext - Quote deletion successful');
      // Soft-cancel associated jobs (non-destructive)
      try {
        await supabase.rpc('cancel_jobs_for_quote', { p_quote_id: quoteId, p_reason: 'Quote deleted' });
      } catch (e) {
        console.warn('Failed to soft-cancel jobs for quote', e);
      }
      return { success: true };
    } catch (err) {
      console.error('🔍 [DEBUG] QuotesContext - Error deleting quote:', err);
      console.error('🔍 [DEBUG] QuotesContext - Error details:', {
        message: err instanceof Error ? err.message : 'Unknown error',
        details: err.details || 'No details',
        hint: err.hint || 'No hint',
        code: err.code || 'No code'
      });
      return { 
        success: false, 
        error: err instanceof Error ? err.message : 'Failed to delete quote' 
      };
    }
  };

  // Load quotes on mount
  useEffect(() => {
    getQuotes();
  }, []);

  const value: QuotesContextType = {
    quotes,
    loading,
    error,
    createQuote,
    getQuotes,
    getQuote,
    updateQuoteStatus,
    addQuoteItem,
    removeQuoteItem,
    deleteQuote
  };

  return (
    <QuotesContext.Provider value={value}>
      {children}
    </QuotesContext.Provider>
  );
};
