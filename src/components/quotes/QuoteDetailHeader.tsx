
import { Button } from "@/components/ui/button";
import { ChevronRight, Printer, Copy, ListChecks, MessageCircle, Edit, Link, File, Trash, Download, DollarSign, Truck, Package, ListPlus, Wrench, Box, Calendar } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "@/components/ui/sheet";
import { QuoteStatusDropdown } from "./QuoteStatusDropdown";
import { useState } from "react";
import { PackingSlip } from "./PackingSlip";
import { ShippingLabelDialog } from "./ShippingLabelDialog";
import { BoxLabelDialog } from "./BoxLabelDialog";
import { OrderTasksDialog } from "@/components/tasks/OrderTasksDialog";
import { DecoratorSelectionDialog } from "./DecoratorSelectionDialog";
import { ProductionSchedulingDialog } from "@/components/production/ProductionSchedulingDialog";

interface QuoteDetailHeaderProps {
  quoteId: string;
  status: string;
  customerInfo?: any;
  items?: any[];
}

export function QuoteDetailHeader({ 
  quoteId, 
  status: initialStatus, 
  customerInfo, 
  items = [] 
}: QuoteDetailHeaderProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [status, setStatus] = useState(initialStatus);
  const [packingSlipOpen, setPackingSlipOpen] = useState(false);
  const [shippingLabelOpen, setShippingLabelOpen] = useState(false);
  const [boxLabelOpen, setBoxLabelOpen] = useState(false);
  const [tasksDialogOpen, setTasksDialogOpen] = useState(false);
  const [showDecoratorSelection, setShowDecoratorSelection] = useState(false);
  const [showProductionScheduling, setShowProductionScheduling] = useState(false);
  
  const isInvoice = !status.toLowerCase().startsWith('quote');
  const documentType = isInvoice ? "Invoice" : "Quote";
  
  const handleDuplicate = () => {
    toast({
      title: `${documentType} duplicated`,
      description: `A new ${documentType.toLowerCase()} has been created based on this one`,
    });
    navigate("/quotes/new");
  };
  
  const handlePrint = () => {
    toast({
      title: `Printing ${documentType.toLowerCase()}`,
      description: `The ${documentType.toLowerCase()} would be sent to the printer in a real application`,
    });
    window.print();
  };
  
  const handleEditDocument = () => {
    navigate(`/quotes/${quoteId}/edit`);
  };
  
  const handleDocumentLink = () => {
    toast({
      title: `${documentType} Link Generated`,
      description: "Link copied to clipboard",
    });
  };
  
  const handlePackingSlip = () => {
    setPackingSlipOpen(true);
  };
  
  const handleShipping = () => {
    setShippingLabelOpen(true);
  };
  
  const handleBoxLabel = () => {
    setBoxLabelOpen(true);
  };
  
  const handleAddLineItemsToPO = () => {
    toast({
      title: "Add to PO",
      description: "Adding line items to purchase order",
    });
  };
  
  const handleWorkOrder = () => {
    const workOrderUrl = `/work-orders/${quoteId}`;
    window.open(workOrderUrl, '_blank');
    toast({
      title: "Work Order",
      description: `Work order for ${documentType.toLowerCase()} #${quoteId} opened in new tab`,
    });
  };
  
  const handlePrintBoxLabels = () => {
    setBoxLabelOpen(true);
  };
  
  const handleDownloadPDF = () => {
    toast({
      title: "Download PDF",
      description: `Downloading ${documentType.toLowerCase()} PDF`,
    });
  };
  
  const handlePaymentExpenses = () => {
    toast({
      title: "Payment/Expenses",
      description: `Managing payment and expenses for ${documentType.toLowerCase()} #${quoteId}`,
    });
  };
  
  const handleApproval = () => {
    toast({
      title: "Approval",
      description: `Processing approval for ${documentType.toLowerCase()} #${quoteId}`,
    });
  };
  
  const handleDelete = () => {
    toast({
      title: `${documentType} deleted`,
      description: `The ${documentType.toLowerCase()} has been deleted`,
    });
    navigate("/quotes");
  };
  
  const handleStatusChange = (newStatus: string) => {
    setStatus(newStatus);
  };
  
  return (
    <div className="flex justify-between items-center mb-6">
      <div className="flex gap-4 items-center">
        <h1 className="text-2xl font-semibold">{documentType} #{quoteId}</h1>
        
        <Button 
          variant="outline" 
          size="sm" 
          className="gap-1"
          onClick={() => setTasksDialogOpen(true)}
        >
          <ListChecks className="h-4 w-4" />
          Tasks
        </Button>
        
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1">
              <MessageCircle className="h-4 w-4" />
              Messages
            </Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Messages for {documentType} #{quoteId}</SheetTitle>
              <SheetDescription>
                Communicate with your customer about this {documentType.toLowerCase()}.
              </SheetDescription>
            </SheetHeader>
            <div className="py-6">
              <p className="text-muted-foreground">Messaging interface will be designed later.</p>
            </div>
          </SheetContent>
        </Sheet>
      </div>
      <div className="flex items-center gap-2">
        <QuoteStatusDropdown currentStatus={status} onStatusChange={handleStatusChange} />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              More Actions <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56 bg-white">
            <DropdownMenuItem onClick={handleApproval}>
              Approval
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleEditDocument}>
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleDocumentLink}>
              <Link className="h-4 w-4 mr-2" />
              {documentType} Link
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handlePackingSlip}>
              <Package className="h-4 w-4 mr-2" />
              Packing Slip
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleShipping}>
              <Truck className="h-4 w-4 mr-2" />
              Shipping
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleBoxLabel}>
              <Box className="h-4 w-4 mr-2" />
              Box Label
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleAddLineItemsToPO}>
              <ListPlus className="h-4 w-4 mr-2" />
              Add Line Items to PO
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setShowProductionScheduling(true)}>
              <Calendar className="h-4 w-4 mr-2" />
              Schedule Production
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setShowDecoratorSelection(true)}>
              <Package className="mr-2 h-4 w-4" />
              Outsource Decorations
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleWorkOrder}>
              <Wrench className="h-4 w-4 mr-2" />
              Work Order
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-2" />
              Print
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleDownloadPDF}>
              <Download className="h-4 w-4 mr-2" />
              Download PDF
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handlePaymentExpenses}>
              <DollarSign className="h-4 w-4 mr-2" />
              Payment/Expenses
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleDuplicate}>
              <Copy className="h-4 w-4 mr-2" />
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleDelete} className="text-red-600">
              <Trash className="h-4 w-4 mr-2" />
              Delete {documentType}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      
      <OrderTasksDialog
        open={tasksDialogOpen}
        onOpenChange={setTasksDialogOpen}
        quoteId={quoteId}
      />
      
      <PackingSlip
        open={packingSlipOpen}
        onOpenChange={setPackingSlipOpen}
        quoteId={quoteId}
        customerInfo={customerInfo}
        items={items || []}
      />
      
      <ShippingLabelDialog
        open={shippingLabelOpen}
        onOpenChange={setShippingLabelOpen}
        quoteId={quoteId}
        customerInfo={customerInfo}
      />
      
      <BoxLabelDialog
        open={boxLabelOpen}
        onOpenChange={setBoxLabelOpen}
        quoteId={quoteId}
        customerInfo={customerInfo}
        orderNickname="Project Care Quote"
      />

      <DecoratorSelectionDialog
        open={showDecoratorSelection}
        onOpenChange={setShowDecoratorSelection}
        quoteId={quoteId}
        quoteItems={items}
      />

      <ProductionSchedulingDialog
        open={showProductionScheduling}
        onOpenChange={setShowProductionScheduling}
        quoteId={quoteId}
        quoteItems={items}
      />
    </div>
  );
}
