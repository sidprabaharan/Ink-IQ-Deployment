
import { cva } from "class-variance-authority";

interface QuotationStatusBadgeProps {
  status: string;
}

const statusVariants = cva(
  "inline-flex items-center justify-center rounded-md px-3 py-1 text-sm font-medium",
  {
    variants: {
      variant: {
        quote: "bg-blue-500 text-white",
        quoteApprovalSent: "bg-blue-500 text-white",
        quoteApproved: "bg-blue-500 text-white",
        artwork: "bg-green-500 text-white",
        purchaseOrders: "bg-purple-600 text-white",
        production: "bg-orange-400 text-white",
        shipping: "bg-purple-500 text-white",
        complete: "bg-yellow-400 text-white",
        miscellaneous: "bg-purple-900 text-white",
        canceled: "bg-black text-white",
        achievedQuote: "bg-black text-white",
        shortCollections: "bg-black text-white",
        onHold: "bg-red-600 text-white",
        default: "bg-gray-500 text-white",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export function QuotationStatusBadge({ status }: QuotationStatusBadgeProps) {
  const normalizedStatus = (status || '').toLowerCase();
  // Map DB quote statuses to visual variants
  const map: Record<string, string> = {
    draft: 'quote',
    sent: 'quoteApprovalSent',
    pending_approval: 'quoteApprovalSent',
    approved: 'quoteApproved',
    rejected: 'onHold',
    expired: 'onHold',
    converted: 'production',
  };
  const variant = map[normalizedStatus] || 'default';
  const display = status
    ? status
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase())
    : 'Unknown';
  return (
    <span className={statusVariants({ variant: variant as any })}>
      {display}
    </span>
  );
}
