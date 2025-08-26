
import { Check, Package, Tag, Clock, AlertTriangle, Truck, ShoppingCart, FileText, PackageX, RotateCcw } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { useOrganization } from "@/context/OrganizationContext";
import { runStatusChangeAutomations } from "@/lib/automation";

interface StatusDropdownProps {
  currentStatus: string;
  onStatusChange: (newStatus: string) => void;
}

export function StatusDropdown({ currentStatus, onStatusChange }: StatusDropdownProps) {
  const { toast } = useToast();
  const { organization } = useOrganization();
  
  const handleStatusSelect = (status: string) => {
    onStatusChange(status);
    toast({
      title: "Garment Status Updated",
      description: `Garment status changed to "${status}"`,
    });

    runStatusChangeAutomations(organization?.org_settings, {
      entityType: 'garment',
      toStatus: status,
    }, {
      notify: (title, description) => toast({ title, description }),
    });
  };

  // Define the status options with their styling - focused on garment procurement workflow
  const statusOptions = [
    // Core procurement flow
    { name: "Pending", color: "bg-slate-500 text-white", icon: <ShoppingCart className="h-4 w-4 mr-2" /> },
    { name: "PO", color: "bg-amber-500 text-white", icon: <FileText className="h-4 w-4 mr-2" /> },
    { name: "Ordered", color: "bg-blue-500 text-white", icon: <Truck className="h-4 w-4 mr-2" /> },
    { name: "Received", color: "bg-green-600 text-white", icon: <Package className="h-4 w-4 mr-2" /> },
    
    // Additional status handling
    { name: "Backordered", color: "bg-yellow-500 text-white", icon: <Clock className="h-4 w-4 mr-2" /> },
    { name: "Partial Received", color: "bg-orange-500 text-white", icon: <PackageX className="h-4 w-4 mr-2" /> },
    { name: "Quality Issue", color: "bg-red-600 text-white", icon: <AlertTriangle className="h-4 w-4 mr-2" /> },
    { name: "Returned", color: "bg-red-800 text-white", icon: <RotateCcw className="h-4 w-4 mr-2" /> },
  ];

  // Display status as is (no special handling needed for these simple statuses)
  const displayStatus = currentStatus;
  
  // Find the class for the current status button
  let currentStatusData = statusOptions.find(option => option.name === displayStatus);
  
  // If not found (could be a custom or old status format), use fallback
  if (!currentStatusData) {
    currentStatusData = { 
      name: "Unknown Status", 
      color: "bg-gray-500 text-white", 
      icon: <Tag className="h-4 w-4 mr-2" /> 
    };
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          className={`px-3 py-1 h-auto rounded-full text-sm font-normal ${currentStatusData.color}`}
        >
          {displayStatus}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56 max-h-[70vh] overflow-y-auto bg-white">
        {statusOptions.map((status, index) => (
          <DropdownMenuItem 
            key={index}
            className={`${status.color} my-1 rounded-md`}
            onClick={() => handleStatusSelect(status.name)}
          >
            {status.icon}
            {status.name}
            {status.name === displayStatus && <Check className="h-4 w-4 ml-auto" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem 
          className="bg-gray-100 text-gray-600 my-1 rounded-md"
          onClick={() => toast({
            title: "Customize Status",
            description: "Custom status feature will be implemented in the future",
          })}
        >
          Customize Status
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
