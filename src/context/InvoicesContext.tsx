import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface InvoiceContextType {
  invoices: any[];
  loading: boolean;
  error: string | null;
  getInvoices: (page?: number, size?: number) => Promise<void>;
  getInvoice: (id: string) => Promise<any | null>;
  createFromQuote: (quoteId: string, invoiceDate?: Date, dueDate?: Date) => Promise<{ success: boolean; invoice_id?: string; error?: string }>;
  updateInvoiceStatus: (invoiceId: string, status: string) => Promise<{ success: boolean; error?: string }>;
  recordPayment: (invoiceId: string, payload: { amount: number; method: string; reference?: string; received_at?: Date; memo?: string }) => Promise<{ success: boolean; error?: string }>;
}

const InvoicesContext = createContext<InvoiceContextType | undefined>(undefined);

export const useInvoices = () => {
  const ctx = useContext(InvoicesContext);
  if (!ctx) throw new Error('useInvoices must be used within InvoicesProvider');
  return ctx;
};

export const InvoicesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getInvoices = async (page = 1, size = 50) => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.rpc('get_invoices', { p_page: page, p_size: size });
      if (error) throw error;
      const arr = (data && data[0]?.invoices) || [];
      setInvoices(Array.isArray(arr) ? arr : []);
    } catch (e: any) {
      setError(e?.message || 'Failed to fetch invoices');
    } finally {
      setLoading(false);
    }
  };

  const getInvoice = async (id: string) => {
    try {
      const { data, error } = await supabase.rpc('get_invoice', { p_invoice_id: id });
      if (error) throw error;
      return data as any;
    } catch (e) {
      setError((e as any)?.message || 'Failed to fetch invoice');
      return null;
    }
  };

  const createFromQuote = async (quoteId: string, invoiceDate?: Date, dueDate?: Date) => {
    try {
      const { data, error } = await supabase.rpc('create_invoice_from_quote', {
        p_quote_id: quoteId,
        p_invoice_date: invoiceDate || null,
        p_due_date: dueDate || null,
      });
      if (error) throw error;
      const newId = data?.[0]?.invoice_id || data?.invoice_id || null;
      if (newId) await getInvoices();
      return newId ? { success: true, invoice_id: newId } : { success: false, error: 'No invoice id returned' };
    } catch (e: any) {
      return { success: false, error: e?.message || 'Failed to create invoice' };
    }
  };

  const updateInvoiceStatus = async (invoiceId: string, status: string) => {
    try {
      const { error } = await supabase.rpc('update_invoice_status', { p_invoice_id: invoiceId, p_new_status: status });
      if (error) throw error;
      await getInvoices();
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e?.message || 'Failed to update invoice status' };
    }
  };

  const recordPayment = async (invoiceId: string, payload: { amount: number; method: string; reference?: string; received_at?: Date; memo?: string }) => {
    try {
      const { error } = await supabase.rpc('record_payment', {
        p_invoice_id: invoiceId,
        p_amount: payload.amount,
        p_method: payload.method,
        p_reference: payload.reference || null,
        p_received_at: payload.received_at || null,
        p_memo: payload.memo || null,
      });
      if (error) throw error;
      await getInvoices();
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e?.message || 'Failed to record payment' };
    }
  };

  useEffect(() => { getInvoices(); }, []);

  return (
    <InvoicesContext.Provider value={{ invoices, loading, error, getInvoices, getInvoice, createFromQuote, updateInvoiceStatus, recordPayment }}>
      {children}
    </InvoicesContext.Provider>
  );
};



