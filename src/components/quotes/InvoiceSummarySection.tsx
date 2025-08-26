
import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Percent, DollarSign } from "lucide-react";

interface InvoiceSummarySectionProps {
  quoteData?: any;
}

export function InvoiceSummarySection({ quoteData }: InvoiceSummarySectionProps) {
  const [discountType, setDiscountType] = useState<"percentage" | "fixed">(
    quoteData?.invoiceSummary?.discountType || "percentage"
  );
  const [discountValue, setDiscountValue] = useState<string>(
    quoteData?.invoiceSummary?.discountValue?.toString() || ""
  );
  const [salesTax, setSalesTax] = useState<string>(
    quoteData?.invoiceSummary?.salesTaxRate?.toString() || ""
  );

  // Use quote data values or defaults
  const subTotal = quoteData?.invoiceSummary?.subTotal || 1250.00;
  
  // Calculate discount amount
  const discountAmount = discountValue 
    ? discountType === "percentage" 
      ? (subTotal * parseFloat(discountValue) / 100) 
      : parseFloat(discountValue)
    : 0;
  
  // Calculate new sub total
  const newSubTotal = subTotal - discountAmount;
  
  // Calculate sales tax amount
  const salesTaxAmount = salesTax 
    ? (newSubTotal * parseFloat(salesTax) / 100)
    : 0;
  
  // Calculate total due
  const totalDue = newSubTotal + salesTaxAmount;

  return (
    <div className="space-y-4">
      <div className="bg-blue-100 p-4 rounded-md">
        <h3 className="text-base font-medium text-center">Quote Summary</h3>
      </div>
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-sm">Sub Total</span>
          <span className="text-sm">${subTotal.toFixed(2)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm">Shipping</span>
          <span className="text-sm">$0.00</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm">Discount</span>
          <div className="flex items-center gap-2">
            <ToggleGroup type="single" value={discountType} onValueChange={(value) => value && setDiscountType(value as "percentage" | "fixed")}>
              <ToggleGroupItem value="percentage" size="sm" className="h-8 w-8 p-0">
                <Percent className="h-4 w-4" />
              </ToggleGroupItem>
              <ToggleGroupItem value="fixed" size="sm" className="h-8 w-8 p-0">
                <DollarSign className="h-4 w-4" />
              </ToggleGroupItem>
            </ToggleGroup>
            <Input 
              className="w-16 h-8 text-xs" 
              placeholder={discountType === "percentage" ? "%" : "$"}
              value={discountValue}
              onChange={(e) => setDiscountValue(e.target.value)}
            />
          </div>
        </div>
        {discountAmount > 0 && (
          <div className="flex justify-between items-center text-red-600">
            <span className="text-sm">- Discount</span>
            <span className="text-sm">-${discountAmount.toFixed(2)}</span>
          </div>
        )}
        
        {discountAmount > 0 && (
          <div className="flex justify-between items-center">
            <span className="text-sm">New Sub Total</span>
            <span className="text-sm">${newSubTotal.toFixed(2)}</span>
          </div>
        )}
        
        <div className="flex justify-between items-center">
          <span className="text-sm">Sales Tax</span>
          <div className="flex items-center">
            <Input 
              className="w-16 h-8 text-xs" 
              placeholder="%" 
              value={salesTax}
              onChange={(e) => setSalesTax(e.target.value)}
            />
          </div>
        </div>
        {salesTaxAmount > 0 && (
          <div className="flex justify-between items-center text-green-700">
            <span className="text-sm">+ Sales Tax</span>
            <span className="text-sm">+${salesTaxAmount.toFixed(2)}</span>
          </div>
        )}
        <div className="flex justify-between items-center font-medium border-t pt-2 mt-2">
          <span>Total Due</span>
          <span>${totalDue.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}
