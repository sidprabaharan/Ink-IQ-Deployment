
import React from "react";
import { Search } from "lucide-react";
import { QuotationStatusBadge } from "./QuotationStatusBadge";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useQuotes } from "@/context/QuotesContext";
import { useInvoices } from "@/context/InvoicesContext";

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  price: string;
  status: string;
}

interface Quotation {
  id: string;
  norisId?: string;
  customer: string;
  dueDate: string;
  owner: string;
  total: string;
  outstanding: string;
  status: string;
  isPaid: boolean;
  lineItems?: LineItem[];
}

// Define which statuses belong to quotes vs invoices
// Updated to match the actual database statuses
const quoteStatuses = ["draft", "sent", "pending_approval", "approved", "rejected", "expired"];

// Sample data for both quotes and invoices
const allQuotationsData: Quotation[] = [
  // Quotes data - will show on Quotes page
  {
    id: "3046",
    customer: "Western Alliance Transport",
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('en-CA'),
    owner: "Kiriakos",
    total: "$8,344.31",
    outstanding: "$8,344.31",
    status: "Quote",
    isPaid: false,
  },
  {
    id: "3032",
    norisId: "Noris shahid",
    customer: "Project Care",
    dueDate: "24-12-2024",
    owner: "Noraiz shahid",
    total: "$278",
    outstanding: "$24",
    status: "Quote",
    isPaid: false,
  },
  {
    id: "3039",
    norisId: "Noris shahid",
    customer: "Care Pharmacy",
    dueDate: "24-12-2024",
    owner: "Tim",
    total: "$12382",
    outstanding: "$82",
    status: "Quote Approval Sent",
    isPaid: true,
  },
  {
    id: "3045",
    customer: "Montreal University",
    dueDate: "15-01-2025",
    owner: "Sarah",
    total: "$3,450",
    outstanding: "$3,450",
    status: "Quote Approved",
    isPaid: false,
  },
  
  // Invoices data - will show on Invoices page
  {
    id: "3033",
    customer: "Cinemania",
    dueDate: "24-12-2024",
    owner: "Shahid Raja",
    total: "$9102",
    outstanding: "$992",
    status: "Purchase Orders",
    isPaid: true,
  },
  {
    id: "3034",
    norisId: "Noris shahid",
    customer: "McGill Investment Club",
    dueDate: "24-12-2024",
    owner: "Kiri",
    total: "$1292",
    outstanding: "$241",
    status: "Production",
    isPaid: false,
  },
  {
    id: "3035",
    customer: "Peer Support system",
    dueDate: "24-12-2024",
    owner: "Jhon",
    total: "$777.28",
    outstanding: "$0.000",
    status: "Production",
    isPaid: true,
  },
  {
    id: "3036",
    norisId: "Noris shahid",
    customer: "Qubic Inc",
    dueDate: "24-12-2024",
    owner: "Kamelia",
    total: "$939.92",
    outstanding: "$424.92",
    status: "Artwork",
    isPaid: false,
  },
  {
    id: "3037",
    customer: "Custom shirts",
    dueDate: "24-12-2024",
    owner: "Picanto",
    total: "$1,892",
    outstanding: "$1.21",
    status: "On Hold",
    isPaid: false,
  },
  {
    id: "3038",
    norisId: "Noris shahid",
    customer: "Design & Co",
    dueDate: "24-12-2024",
    owner: "Helper",
    total: "$9,9282",
    outstanding: "$2,421",
    status: "Artwork",
    isPaid: true,
  },
  {
    id: "3040",
    customer: "ABC Print Shop",
    dueDate: "30-11-2024",
    owner: "Jessica",
    total: "$4,590",
    outstanding: "$0",
    status: "Complete",
    isPaid: true,
  },
  {
    id: "3041",
    customer: "Tech Innovators",
    dueDate: "15-12-2024",
    owner: "Michael",
    total: "$2,750",
    outstanding: "$1,250",
    status: "Production",
    isPaid: false,
  },
  {
    id: "3042",
    customer: "Global Retail Solutions",
    dueDate: "05-01-2025",
    owner: "Emma",
    total: "$8,325",
    outstanding: "$4,125",
    status: "Shipping",
    isPaid: false,
  },
];

interface QuotationTableProps {
  isInvoicesPage?: boolean;
}

export function QuotationTable({ isInvoicesPage = false }: QuotationTableProps) {
  const navigate = useNavigate();
  const { quotes, loading: quotesLoading, error: quotesError } = useQuotes();
  const { invoices, loading: invoicesLoading, error: invoicesError } = useInvoices();

  const formatCurrency = (value: any) => {
    const num = typeof value === 'number' ? value : Number(value || 0);
    if (Number.isNaN(num)) return '$0.00';
    return `$${num.toFixed(2)}`;
  };

  const formatDate = (value: any) => {
    if (!value) return 'N/A';
    if (typeof value === 'string') {
      const m = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (m) {
        const y = parseInt(m[1], 10);
        const mo = parseInt(m[2], 10) - 1;
        const d = parseInt(m[3], 10);
        const local = new Date(y, mo, d);
        return local.toLocaleDateString();
      }
    }
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? 'N/A' : d.toLocaleDateString();
  };
  
  // Filter data based on whether we're on the Quotes or Invoices page
  const quotationsData = isInvoicesPage
    ? (invoices || []).slice().sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    : (quotes || [])
        .filter((quotation) => quoteStatuses.includes(quotation.status))
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const handleRowClick = (quotationId: string) => {
    navigate(`/quotes/${quotationId}`);
  };

  // Show loading state
  const loading = isInvoicesPage ? invoicesLoading : quotesLoading;
  const error = isInvoicesPage ? invoicesError : quotesError;

  if (loading) {
    return (
      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-xl font-semibold">{isInvoicesPage ? "Invoices" : "Quotations"}</h2>
        </div>
        <div className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-inkiq-primary mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading quotes...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-xl font-semibold">{isInvoicesPage ? "Invoices" : "Quotations"}</h2>
        </div>
        <div className="p-8 text-center">
          <p className="text-red-600">Error loading quotes: {error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-2 px-4 py-2 bg-inkiq-primary text-white rounded hover:bg-inkiq-primary/90"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border overflow-hidden">
      <div className="flex justify-between items-center p-4 border-b">
        <h2 className="text-xl font-semibold">{isInvoicesPage ? "Invoices" : "Quotations"}</h2>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <input
            type="text"
            placeholder="Search"
            className="pl-9 pr-4 py-2 border rounded-md w-64 focus:outline-none focus:ring-2 focus:ring-inkiq-primary focus:border-transparent"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                ID
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Customer
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Due Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Owner
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Total
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Outstanding
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>

            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {quotationsData.map((quotation: any) => {
              const idDisplay = isInvoicesPage ? (quotation.invoice_number || quotation.id) : (quotation.quote_number || quotation.id);
              const customerDisplay =
                quotation.customer_name || quotation.customer_company || quotation.customer || quotation.customer_id || 'Unknown Customer';
              // Prefer customer due date; fallback to other meaningful dates if missing
              const dueDateRaw = isInvoicesPage
                ? (quotation.due_date || quotation.invoice_date || quotation.created_at)
                : (quotation.customer_due_date || quotation.production_due_date || quotation.payment_due_date || quotation.valid_until || quotation.created_at);
              const ownerDisplay = quotation.created_by_full_name || quotation.created_by || 'N/A';
              // Debug row-level fields
              console.debug('[QuotationTable] row', {
                id: quotation.id,
                status: quotation.status,
                customer_due_date: quotation.customer_due_date,
                production_due_date: quotation.production_due_date,
                payment_due_date: quotation.payment_due_date,
                valid_until: quotation.valid_until,
                created_at: quotation.created_at,
                resolved_due: dueDateRaw,
              });
              const totalDisplay = isInvoicesPage ? formatCurrency(quotation.total_amount) : formatCurrency(quotation.final_amount ?? quotation.total_amount);
              const outstandingDisplay = isInvoicesPage ? formatCurrency(quotation.balance_due ?? quotation.total_amount) : totalDisplay;
              return (
                <tr 
                  key={quotation.id}
                  className="hover:bg-gray-50 cursor-pointer" 
                  onClick={() => navigate(isInvoicesPage ? `/invoices/${quotation.id}` : `/quotes/${quotation.id}`)}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {idDisplay}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{customerDisplay}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {formatDate(dueDateRaw)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{ownerDisplay}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{totalDisplay}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{outstandingDisplay}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <QuotationStatusBadge status={quotation.status} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {quotationsData.length === 0 && (
          <div className="text-center py-8">
            <p className="text-gray-500">No {isInvoicesPage ? 'invoices' : 'quotes'} found.</p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between p-4 border-t">
        <div className="flex items-center space-x-1">
          <button className="pagination-button">
            <span className="sr-only">Previous</span>
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
          </button>
          <button className="pagination-button active">1</button>
          <button className="pagination-button">2</button>
          <button className="pagination-button">3</button>
          <button className="pagination-button">
            <span className="sr-only">Next</span>
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="border-gray-300">Previous</Button>
          <Button variant="outline" className="border-gray-300">Next</Button>
        </div>
      </div>


    </div>
  );
}
