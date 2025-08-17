import React from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, FileText, Palette, CheckCircle, Cog, Package, DollarSign, CreditCard, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface QuoteStatusDropdownProps {
  currentStatus: string;
  onStatusChange: (newStatus: string) => void;
  useDbStatuses?: boolean; // if true, show DB statuses (draft/sent/...) instead of friendly labels
}

const quoteStatusOptions = [
  { name: "Quote", icon: FileText, color: "text-gray-600" },
  { name: "Artwork Pending", icon: Palette, color: "text-yellow-600" },
  { name: "Approved", icon: CheckCircle, color: "text-blue-600" },
  { name: "In Production", icon: Cog, color: "text-purple-600" },
  { name: "Complete", icon: Package, color: "text-green-600" },
  { name: "Invoiced", icon: FileText, color: "text-teal-600" },
  { name: "Paid", icon: CreditCard, color: "text-green-700" },
  { name: "Cancelled", icon: X, color: "text-red-600" },
];

// Database-backed statuses used by quotes table
const dbStatusOptions = [
  { name: "draft", icon: FileText, color: "text-gray-600" },
  { name: "sent", icon: FileText, color: "text-blue-600" },
  { name: "pending_approval", icon: Palette, color: "text-yellow-600" },
  { name: "approved", icon: CheckCircle, color: "text-green-600" },
  { name: "rejected", icon: X, color: "text-red-600" },
  { name: "expired", icon: Package, color: "text-purple-600" },
  { name: "converted", icon: CreditCard, color: "text-teal-600" },
];

export function QuoteStatusDropdown({ currentStatus, onStatusChange, useDbStatuses = false }: QuoteStatusDropdownProps) {
  const { toast } = useToast();

  const handleStatusSelect = (status: string) => {
    onStatusChange(status);
    toast({
      title: "Status Updated",
      description: `Quote status changed to ${status}`,
    });
  };

  const options = useDbStatuses ? dbStatusOptions : quoteStatusOptions;

  const currentStatusConfig = options.find(option => 
    option.name.toLowerCase() === currentStatus.toLowerCase()
  ) || options[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2">
          <currentStatusConfig.icon className={`h-4 w-4 ${currentStatusConfig.color}`} />
          {useDbStatuses ? currentStatus.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : currentStatus}
          <ChevronDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-48 bg-white">
        {options.map((option) => (
          <DropdownMenuItem
            key={option.name}
            onClick={() => handleStatusSelect(option.name)}
            className="flex items-center gap-2 cursor-pointer"
          >
            <option.icon className={`h-4 w-4 ${option.color}`} />
            {useDbStatuses ? option.name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : option.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}