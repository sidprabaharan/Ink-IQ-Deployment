
import React from 'react';

interface InvoiceSummary {
  itemTotal: string;
  feesTotal: string;
  subTotal: string;
  discount: string;
  salesTax: string;
  totalDue: string;
}

interface InvoiceSummaryCardProps {
  summary: InvoiceSummary;
  title?: string;
}

export function InvoiceSummaryCard({ summary, title = "Quote Summary" }: InvoiceSummaryCardProps) {
  return (
    <div className="bg-white p-6 rounded-lg border">
      <div className="bg-blue-100 p-3 rounded-md mb-4">
        <h3 className="font-medium text-center">{title}</h3>
      </div>
      <div className="space-y-3">
        <div className="flex justify-between">
          <span className="text-gray-600">Item Total</span>
          <span>{summary.itemTotal}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Shipping</span>
          <span>{summary.feesTotal}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Sub Total</span>
          <span>{summary.subTotal}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Discount</span>
          <span>{summary.discount}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Sales Tax</span>
          <span>{summary.salesTax}</span>
        </div>
        <div className="flex justify-between font-medium">
          <span>Total Due</span>
          <span>{summary.totalDue}</span>
        </div>
      </div>
    </div>
  );
}
