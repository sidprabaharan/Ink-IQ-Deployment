
import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { QuoteSummaryCard } from "@/components/quotes/QuoteSummaryCard";
import { QuotationTable } from "@/components/quotes/QuotationTable";
import { 
  Search, Plus, ArrowLeft, Mail, Phone, FileText, Calendar as CalendarIcon, MessageSquare, 
  File, Image, Folder, Code, PenTool, ShoppingCart, FileCheck, UserPlus,
  Edit, MapPin, ClipboardList, Upload, Grid, List, FileImage, Download, 
  Eye, MoreVertical, User, Tag, Layers, Globe, Linkedin, Facebook, Twitter,
  Building, Users, DollarSign, Trash
} from "lucide-react";
import { CustomerDialog } from "@/components/quotes/CustomerDialog";
import { useCustomers } from "@/context/CustomersContext";
import { useToast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AddContactDialog, ContactFormValues } from "@/components/customers/AddContactDialog";
import { ContactsList } from "@/components/customers/ContactsList";
import { Contact } from "@/types/customer";
import { EditContactDialog } from "@/components/customers/EditContactDialog";
import { EditCompanyDialog, CompanyFormValues } from "@/components/customers/EditCompanyDialog";
import { EditAddressDialog, AddressFormValues } from "@/components/customers/EditAddressDialog";
import { EditTaxInfoDialog, TaxInfoFormValues } from "@/components/customers/EditTaxInfoDialog";
import { mockArtworkLibrary, ArtworkFile } from "@/types/artwork";
import { IMPRINT_METHODS } from "@/types/imprint";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from 'react-router-dom';
import { INDUSTRIES, getIndustryNameFromId } from "@/data/industries";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

// Unified imprint type for customer-specific artwork
interface UnifiedImprint {
  id: string;
  designName: string;
  imprintMethod: string;
  associatedCustomers: Array<{ id: string; name: string }>;
  customerArt: ArtworkFile[];
  productionFiles: ArtworkFile[];
  mockups: ArtworkFile[];
  fileCount: number;
  totalSizeBytes: number;
  createdAt: Date;
  updatedAt: Date;
  notes?: string;
}

export default function Customers() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [openDialog, setOpenDialog] = useState(false);
  const [openContactDialog, setOpenContactDialog] = useState(false);
  const { customers, addContactToCustomer, updateCustomer, updateCustomerContact, deleteCustomer } = useCustomers();
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Edit dialog states  
  const [editContactDialog, setEditContactDialog] = useState(false);
  const [editCompanyOpen, setEditCompanyOpen] = useState(false);
  const [editBillingAddressOpen, setEditBillingAddressOpen] = useState(false);
  const [editShippingAddressOpen, setEditShippingAddressOpen] = useState(false);
  const [editTaxInfoOpen, setEditTaxInfoOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [activeTab, setActiveTab] = useState("contacts");

  // Delete customer handler
  const handleDeleteCustomer = async (customerId: string, customerName: string) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${customerName}"? This action cannot be undone.`
    );
    
    if (!confirmed) return;

    try {
      const result = await deleteCustomer(customerId);
      
      if (result.success) {
        toast({
          title: "Customer deleted",
          description: `${customerName} has been successfully deleted`,
        });
        
        // Clear selection if deleted customer was selected
        if (selectedCustomerId === customerId) {
          setSelectedCustomerId(null);
        }
      } else {
        toast({
          title: "Failed to delete customer",
          description: result.error || "An unknown error occurred",
          variant: "destructive"
        });
      }
    } catch (err) {
      toast({
        title: "Error deleting customer",
        description: "An unexpected error occurred while deleting the customer",
        variant: "destructive"
      });
    }
  };
  
  // Artwork & Files tab states
  const [artworkSearchTerm, setArtworkSearchTerm] = useState('');
  const [selectedMethod, setSelectedMethod] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedArtwork, setSelectedArtwork] = useState<UnifiedImprint | null>(null);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [folderViewOpen, setFolderViewOpen] = useState(false);

  // Quote filters
  const [quoteDateFrom, setQuoteDateFrom] = useState<Date>();
  const [quoteDateTo, setQuoteDateTo] = useState<Date>();
  const [quoteStatusFilter, setQuoteStatusFilter] = useState<string>("all");
  const [quoteOwnerFilter, setQuoteOwnerFilter] = useState<string>("all");
  const [quotePaymentFilter, setQuotePaymentFilter] = useState<string>("all");

  // Order filters
  const [orderDateFrom, setOrderDateFrom] = useState<Date>();
  const [orderDateTo, setOrderDateTo] = useState<Date>();
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>("all");
  const [orderOwnerFilter, setOrderOwnerFilter] = useState<string>("all");
  const [orderPaymentFilter, setOrderPaymentFilter] = useState<string>("all");

  const selectedCustomer = selectedCustomerId
    ? customers.find(c => c.id === selectedCustomerId) 
    : null;

  // Get customer-specific artwork data
  const customerArtworkLibrary = useMemo(() => {
    if (!selectedCustomerId) return null;
    return mockArtworkLibrary.find(lib => lib.customerId === selectedCustomerId);
  }, [selectedCustomerId]);

  // Create unified imprints list for selected customer
  const customerImprints = useMemo(() => {
    if (!customerArtworkLibrary) return [];
    
    const imprints: UnifiedImprint[] = [];
    customerArtworkLibrary.folders.forEach(folder => {
      folder.artworks.forEach(artwork => {
        imprints.push({
          id: artwork.id,
          designName: artwork.designName,
          imprintMethod: artwork.method,
          associatedCustomers: [{ id: customerArtworkLibrary.customerId, name: customerArtworkLibrary.customerName }],
          customerArt: artwork.customerArt,
          productionFiles: artwork.productionFiles,
          mockups: artwork.mockups,
          fileCount: artwork.fileCount,
          totalSizeBytes: artwork.totalSizeBytes,
          createdAt: artwork.createdAt,
          updatedAt: artwork.updatedAt,
          notes: artwork.description
        });
      });
    });
    return imprints;
  }, [customerArtworkLibrary]);

  // Group customer imprints by method to create folders
  const customerImprintFolders = useMemo(() => {
    const folders = new Map<string, UnifiedImprint[]>();
    
    customerImprints.forEach(imprint => {
      // Apply method filter
      if (selectedMethod !== 'all' && imprint.imprintMethod !== selectedMethod) {
        return;
      }

      // Apply search filter
      if (artworkSearchTerm) {
        const searchLower = artworkSearchTerm.toLowerCase();
        const matchesSearch = (
          imprint.designName.toLowerCase().includes(searchLower) ||
          (imprint.notes && imprint.notes.toLowerCase().includes(searchLower))
        );
        if (!matchesSearch) return;
      }

      const method = imprint.imprintMethod;
      if (!folders.has(method)) {
        folders.set(method, []);
      }
      folders.get(method)!.push(imprint);
    });

    return Array.from(folders.entries()).map(([method, imprints]) => ({
      method,
      imprints,
      count: imprints.length,
      totalSize: imprints.reduce((sum, imprint) => sum + imprint.totalSizeBytes, 0)
    }));
  }, [customerImprints, artworkSearchTerm, selectedMethod]);

  // Get imprints for selected folder
  const folderImprints = useMemo(() => {
    if (!selectedFolder) return [];
    const folder = customerImprintFolders.find(f => f.method === selectedFolder);
    return folder ? folder.imprints : [];
  }, [selectedFolder, customerImprintFolders]);

  const filteredCustomers = customers.filter(customer => 
    customer.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getInitials = (companyName: string) => {
    return companyName.charAt(0).toUpperCase();
  };

  const getIndustryName = (industryId: string) => getIndustryNameFromId(industryId);

  const handleAddContact = (data: ContactFormValues) => {
    if (selectedCustomerId) {
      // Ensure all required fields are present
      // The Contact type requires email, firstName, lastName, and phoneNumber to be required
      const newContact: Omit<Contact, "id"> = {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phoneNumber: data.phoneNumber,
        jobTitle: data.jobTitle,
        department: data.department,
        contactOwner: data.contactOwner,
      };
      
      addContactToCustomer(selectedCustomerId, newContact);
      toast.success("Contact added successfully");
    }
  };

  const handleEditContact = (contactId: string, data: ContactFormValues) => {
    if (selectedCustomerId) {
      updateCustomerContact(selectedCustomerId, contactId, data);
      toast.success("Contact updated successfully");
    }
  };

  const handleEditCompany = (data: CompanyFormValues) => {
    if (selectedCustomerId) {
      // Transform form data to match Customer interface
      const updatedCustomerData = {
        companyName: data.companyName,
        industry: data.industry,
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phoneNumber: data.phoneNumber,
        faxNumber: data.faxNumber || "",
        invoiceOwner: data.invoiceOwner || "",
        companySize: data.companySize || undefined,
        estimatedAnnualMerchSpend: data.estimatedAnnualMerchSpend || undefined,
        socialMedia: {
          linkedin: data.linkedinUrl || undefined,
          facebook: data.facebookUrl || undefined,
          twitter: data.twitterUrl || undefined,
          website: data.websiteUrl || undefined,
        },
        billingAddress: {
          address1: data.billingAddress1,
          address2: data.billingAddress2 || "",
          city: data.billingCity,
          stateProvince: data.billingStateProvince,
          zipCode: data.billingZipCode,
          country: data.billingCountry,
        },
        shippingAddress: {
          address1: data.shippingAddress1,
          address2: data.shippingAddress2 || "",
          city: data.shippingCity,
          stateProvince: data.shippingStateProvince,
          zipCode: data.shippingZipCode,
          country: data.shippingCountry,
        },
        taxInfo: {
          taxId: data.taxId || "",
          taxRate: data.taxRate || "",
          taxExemptionNumber: data.taxExemptionNumber || "",
        },
      };
      
      updateCustomer(selectedCustomerId, updatedCustomerData);
      toast.success("Company information updated successfully");
    }
  };

  // Update these handler functions to ensure they pass non-optional values
  const handleEditBillingAddress = (data: AddressFormValues) => {
    if (selectedCustomerId) {
      // Ensure all required fields are present
      const billingAddress = {
        address1: data.address1,
        address2: data.address2 || "",
        city: data.city,
        stateProvince: data.stateProvince || "",
        zipCode: data.zipCode,
        country: data.country,
      };
      
      updateCustomer(selectedCustomerId, { billingAddress });
      toast.success("Billing address updated successfully");
    }
  };

  const handleEditShippingAddress = (data: AddressFormValues) => {
    if (selectedCustomerId) {
      // Ensure all required fields are present
      const shippingAddress = {
        address1: data.address1,
        address2: data.address2 || "",
        city: data.city,
        stateProvince: data.stateProvince || "",
        zipCode: data.zipCode,
        country: data.country,
      };
      
      updateCustomer(selectedCustomerId, { shippingAddress });
      toast.success("Shipping address updated successfully");
    }
  };

  const handleEditTaxInfo = (data: TaxInfoFormValues) => {
    if (selectedCustomerId) {
      // Ensure all required fields are present
      const taxInfo = {
        taxId: data.taxId || "",
        taxRate: data.taxRate || "",
        taxExemptionNumber: data.taxExemptionNumber || "",
      };
      
      updateCustomer(selectedCustomerId, { taxInfo });
      toast.success("Tax information updated successfully");
    }
  };

  const handleEditPrimaryContact = () => {
    if (selectedCustomer) {
      // Create a partial update for the primary contact fields
      const data = {
        firstName: selectedCustomer.firstName,
        lastName: selectedCustomer.lastName,
        email: selectedCustomer.email,
        phoneNumber: selectedCustomer.phoneNumber
      };
      
      // We'll reuse the company dialog since it contains these fields
      setEditCompanyOpen(true);
    }
  };

  const customerOrders = [
    {
      id: "3032",
      date: "2023-08-15",
      total: "$1,245.00",
      status: "Completed",
      items: "T-shirts (50), Hoodies (25)"
    },
    {
      id: "2987",
      date: "2023-06-22",
      total: "$780.50",
      status: "Completed",
      items: "Polos (30), Caps (40)"
    },
    {
      id: "2756",
      date: "2023-04-10",
      total: "$2,100.00",
      status: "Completed",
      items: "Custom Jackets (20)"
    }
  ];

  const customerQuotes = [
    {
      id: "Q-5893",
      date: "2023-09-05",
      total: "$2,450.00",
      status: "Pending Approval",
      items: "Custom T-shirts (100), Embroidered Caps (50)"
    },
    {
      id: "Q-5742",
      date: "2023-08-28",
      total: "$980.00",
      status: "Draft",
      items: "Polo Shirts (45)"
    },
    {
      id: "Q-5621",
      date: "2023-08-10",
      total: "$3,200.00",
      status: "Approved",
      items: "Hoodies (80), Tote Bags (100)"
    }
  ];

  // Mock functions to calculate filtered totals for customer quotes and orders
  const getCustomerQuoteFilteredTotals = () => {
    const baseAmounts = {
      totalOpportunity: 6630,
      quotesSent: 3450,
      approvalSent: 2450,
      approved: 3200
    };
    
    const filterMultiplier = (quoteDateFrom || quoteDateTo || quoteStatusFilter !== "all" || quoteOwnerFilter !== "all" || quotePaymentFilter !== "all") ? 0.7 : 1;
    
    return {
      totalOpportunity: Math.round(baseAmounts.totalOpportunity * filterMultiplier),
      quotesSent: Math.round(baseAmounts.quotesSent * filterMultiplier),
      approvalSent: Math.round(baseAmounts.approvalSent * filterMultiplier),
      approved: Math.round(baseAmounts.approved * filterMultiplier)
    };
  };

  const getCustomerOrderFilteredTotals = () => {
    const baseAmounts = {
      total: 4125,
      completed: 4125,
      processing: 0,
      pending: 0
    };
    
    const filterMultiplier = (orderDateFrom || orderDateTo || orderStatusFilter !== "all" || orderOwnerFilter !== "all" || orderPaymentFilter !== "all") ? 0.7 : 1;
    
    return {
      total: Math.round(baseAmounts.total * filterMultiplier),
      completed: Math.round(baseAmounts.completed * filterMultiplier),
      processing: Math.round(baseAmounts.processing * filterMultiplier),
      pending: Math.round(baseAmounts.pending * filterMultiplier)
    };
  };

  const customerQuoteTotals = getCustomerQuoteFilteredTotals();
  const customerOrderTotals = getCustomerOrderFilteredTotals();

  const customerQuoteSummaryCards = [
    {
      title: "Total Opportunity",
      amount: `$${customerQuoteTotals.totalOpportunity.toLocaleString()}`,
      percentage: 40,
      period: "last month"
    },
    {
      title: "Quotes Sent",
      amount: `$${customerQuoteTotals.quotesSent.toLocaleString()}`,
      percentage: 25,
      period: "last month"
    },
    {
      title: "Quote Approval Sent",
      amount: `$${customerQuoteTotals.approvalSent.toLocaleString()}`,
      percentage: 35,
      period: "last month"
    },
    {
      title: "Quote Approved",
      amount: `$${customerQuoteTotals.approved.toLocaleString()}`,
      percentage: 18,
      period: "last month"
    }
  ];

  const customerOrderSummaryCards = [
    {
      title: "Total Orders",
      amount: `$${customerOrderTotals.total.toLocaleString()}`,
      percentage: 32,
      period: "last month"
    },
    {
      title: "Completed Orders",
      amount: `$${customerOrderTotals.completed.toLocaleString()}`,
      percentage: 28,
      period: "last month"
    },
    {
      title: "Processing Orders",
      amount: `$${customerOrderTotals.processing.toLocaleString()}`,
      percentage: 12,
      period: "last month"
    },
    {
      title: "Pending Orders",
      amount: `$${customerOrderTotals.pending.toLocaleString()}`,
      percentage: 8,
      period: "last month"
    }
  ];

  const clearQuoteFilters = () => {
    setQuoteDateFrom(undefined);
    setQuoteDateTo(undefined);
    setQuoteStatusFilter("all");
    setQuoteOwnerFilter("all");
    setQuotePaymentFilter("all");
  };

  const clearOrderFilters = () => {
    setOrderDateFrom(undefined);
    setOrderDateTo(undefined);
    setOrderStatusFilter("all");
    setOrderOwnerFilter("all");
    setOrderPaymentFilter("all");
  };

  // Utility functions for artwork tab
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }).format(date);
  };

  const handlePreviewArtwork = (artwork: UnifiedImprint) => {
    setSelectedArtwork(artwork);
    setPreviewDialogOpen(true);
  };

  const handleFolderClick = (method: string) => {
    setSelectedFolder(method);
    setFolderViewOpen(true);
  };

  const getCustomerArtworkStats = () => {
    const totalImprints = customerImprints.length;
    const totalSize = customerImprints.reduce((sum, imprint) => sum + imprint.totalSizeBytes, 0);
    const totalFolders = customerImprintFolders.length;
    
    return { totalImprints, totalSize, totalFolders };
  };

  return (
    <div className="p-6 bg-gray-50 min-h-full">
      {!selectedCustomer ? (
        <>
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-semibold">Customers</h1>
            <div className="flex items-center gap-4">
              <Button variant="outline">Delete</Button>
              <Button variant="outline">Export</Button>
              <Button 
                className="bg-blue-600 hover:bg-blue-700 text-white"
                onClick={() => setOpenDialog(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Create New
              </Button>
            </div>
          </div>

          <div className="bg-white rounded-lg border overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b">
              <h2 className="text-xl font-semibold">Customer Directory</h2>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <input
                  type="text"
                  placeholder="Search customers..."
                  className="pl-9 pr-4 py-2 border rounded-md w-64 focus:outline-none focus:ring-2 focus:ring-inkiq-primary focus:border-transparent"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 text-left">
                  <tr>
                    <th className="px-4 py-3 text-sm font-medium text-gray-600">
                      <input type="checkbox" className="h-4 w-4 rounded" />
                    </th>
                    <th className="px-4 py-3 text-sm font-medium text-gray-600">Company</th>
                    <th className="px-4 py-3 text-sm font-medium text-gray-600">City</th>
                    <th className="px-4 py-3 text-sm font-medium text-gray-600">Country</th>
                    <th className="px-4 py-3 text-sm font-medium text-gray-600">No. of Orders Placed</th>
                    <th className="px-4 py-3 text-sm font-medium text-gray-600">Sales Volume</th>
                    <th className="px-4 py-3 text-sm font-medium text-gray-600">Industry</th>
                    <th className="px-4 py-3 text-sm font-medium text-gray-600 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCustomers.map((customer) => (
                    <tr 
                      key={customer.id} 
                      className="border-b hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => setSelectedCustomerId(customer.id)}
                    >
                      <td className="px-4 py-3 text-sm">
                        <input type="checkbox" className="h-4 w-4 rounded" onClick={(e) => e.stopPropagation()} />
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {customer.companyName}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {customer.billingAddress.city}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {customer.billingAddress.country}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        0
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        $0
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {getIndustryName(customer.industry)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteCustomer(customer.id, customer.companyName);
                          }}
                        >
                          <Trash className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {filteredCustomers.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-gray-500 text-sm">
                        No customers found. Add a new customer to get started.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            
            {filteredCustomers.length > 0 && (
              <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
                <div className="text-sm text-gray-500">
                  Showing {filteredCustomers.length} of {customers.length} results
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled={true}>
                    Previous
                  </Button>
                  <Button variant="outline" size="sm" className="bg-blue-50">
                    1
                  </Button>
                  <Button variant="outline" size="sm" disabled={true}>
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="space-y-6">
          {/* Back button */}
          <Button 
            variant="ghost" 
            className="text-gray-500"
            onClick={() => setSelectedCustomerId(null)}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Customers
          </Button>

          {/* Full-width Customer Card */}
          <Card className="w-full">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16">
                    <AvatarFallback className="bg-primary text-primary-foreground text-xl">
                      {getInitials(selectedCustomer.companyName)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle className="text-2xl">{selectedCustomer.companyName}</CardTitle>
                    <CardDescription className="text-lg">
                      {selectedCustomer.firstName} {selectedCustomer.lastName}
                    </CardDescription>
                    <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        <span>{selectedCustomer.email}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4" />
                        <span>{selectedCustomer.phoneNumber}</span>
                      </div>
                      {selectedCustomer.industry && (
                        <div className="flex items-center gap-2">
                          <Layers className="h-4 w-4" />
                          <span>{getIndustryName(selectedCustomer.industry)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setEditCompanyOpen(true)}
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Edit Company
                  </Button>
                  <Button variant="outline" size="sm" className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Email
                  </Button>
                  <Button variant="outline" size="sm" className="flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    Call
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Company Details</h3>
                  
                  <div className="grid grid-cols-2 gap-6">
                    {/* Industry */}
                    {selectedCustomer.industry && (
                      <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                        <div className="flex-shrink-0">
                          <Building className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">Industry</p>
                          <p className="text-sm text-gray-600">{getIndustryName(selectedCustomer.industry)}</p>
                        </div>
                      </div>
                    )}

                    {/* Company Size */}
                    {selectedCustomer.companySize && (
                      <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                        <div className="flex-shrink-0">
                          <Users className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">Company Size</p>
                          <p className="text-sm text-gray-600">{selectedCustomer.companySize}</p>
                        </div>
                      </div>
                    )}

                    {/* Estimated Annual Spend */}
                    {selectedCustomer.estimatedAnnualMerchSpend && (
                      <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                        <div className="flex-shrink-0">
                          <DollarSign className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">Estimated Annual Spend</p>
                          <p className="text-sm text-gray-600">{selectedCustomer.estimatedAnnualMerchSpend}</p>
                        </div>
                      </div>
                    )}

                    {/* Social Media & Website */}
                    {selectedCustomer.socialMedia && (Object.values(selectedCustomer.socialMedia).some(url => url)) && (
                      <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
                        <div className="flex-shrink-0">
                          <Globe className="h-5 w-5 text-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-900 mb-2">Online Presence</p>
                          <div className="flex flex-wrap gap-2">
                            {selectedCustomer.socialMedia.website && (
                              <a 
                                href={selectedCustomer.socialMedia.website} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-gray-200 rounded-md text-xs font-medium text-gray-700 hover:bg-gray-50 hover:text-primary transition-colors"
                              >
                                <Globe className="h-3 w-3" />
                                Website
                              </a>
                            )}
                            {selectedCustomer.socialMedia.linkedin && (
                              <a 
                                href={selectedCustomer.socialMedia.linkedin} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-gray-200 rounded-md text-xs font-medium text-gray-700 hover:bg-gray-50 hover:text-blue-600 transition-colors"
                              >
                                <Linkedin className="h-3 w-3" />
                                LinkedIn
                              </a>
                            )}
                            {selectedCustomer.socialMedia.facebook && (
                              <a 
                                href={selectedCustomer.socialMedia.facebook} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-gray-200 rounded-md text-xs font-medium text-gray-700 hover:bg-gray-50 hover:text-blue-600 transition-colors"
                              >
                                <Facebook className="h-3 w-3" />
                                Facebook
                              </a>
                            )}
                            {selectedCustomer.socialMedia.twitter && (
                              <a 
                                href={selectedCustomer.socialMedia.twitter} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-gray-200 rounded-md text-xs font-medium text-gray-700 hover:bg-gray-50 hover:text-blue-400 transition-colors"
                              >
                                <Twitter className="h-3 w-3" />
                                Twitter
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Full-width Tabs */}
          <div className="w-full">
            <Tabs defaultValue="contacts" className="w-full">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="contacts">Overview</TabsTrigger>
                <TabsTrigger value="quotes">Quotes</TabsTrigger>
                <TabsTrigger value="orders">Orders</TabsTrigger>
                <TabsTrigger value="tasks">Tasks</TabsTrigger>
                <TabsTrigger value="artwork">Artwork & Files</TabsTrigger>
              </TabsList>
              
              <TabsContent value="contacts" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Data Highlights</CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="grid grid-cols-3 gap-6">
                      <div className="bg-blue-50 p-4 rounded-lg">
                        <p className="text-gray-500 mb-1">Number of Orders</p>
                        <p className="text-2xl font-bold">3</p>
                      </div>
                      <div className="bg-green-50 p-4 rounded-lg">
                        <p className="text-gray-500 mb-1">Total Sales Volume</p>
                        <p className="text-2xl font-bold">$4,125.50</p>
                      </div>
                      <div className="bg-purple-50 p-4 rounded-lg">
                        <p className="text-gray-500 mb-1">Current Quotes Volume</p>
                        <p className="text-2xl font-bold">$6,630.00</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Contact Information</CardTitle>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="text-blue-600"
                      onClick={() => setOpenContactDialog(true)}
                    >
                      <UserPlus className="h-4 w-4 mr-2" />
                      Add Contact
                    </Button>
                  </CardHeader>
                  <CardContent className="p-6">
                    <ContactsList 
                      contacts={selectedCustomer.contacts || []}
                      primaryContact={{
                        firstName: selectedCustomer.firstName,
                        lastName: selectedCustomer.lastName,
                        email: selectedCustomer.email,
                        phoneNumber: selectedCustomer.phoneNumber
                      }}
                      onEditContact={(contact) => {
                        setSelectedContact(contact);
                        setEditContactDialog(true);
                      }}
                      onEditPrimaryContact={handleEditPrimaryContact}
                    />
                  </CardContent>
                </Card>
                
                <div className="grid grid-cols-2 gap-6">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                      <CardTitle>Billing Address</CardTitle>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-8 w-8 p-0"
                        onClick={() => setEditBillingAddressOpen(true)}
                      >
                        <Edit className="h-4 w-4" />
                        <span className="sr-only">Edit billing address</span>
                      </Button>
                    </CardHeader>
                    <CardContent className="p-6">
                      <div className="space-y-2">
                        <p>{selectedCustomer.billingAddress.address1}</p>
                        {selectedCustomer.billingAddress.address2 && (
                          <p>{selectedCustomer.billingAddress.address2}</p>
                        )}
                        <p>
                          {selectedCustomer.billingAddress.city}, 
                          {selectedCustomer.billingAddress.stateProvince && ` ${selectedCustomer.billingAddress.stateProvince},`} 
                          {selectedCustomer.billingAddress.zipCode}
                        </p>
                        <p>{selectedCustomer.billingAddress.country}</p>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                      <CardTitle>Shipping Address</CardTitle>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-8 w-8 p-0"
                        onClick={() => setEditShippingAddressOpen(true)}
                      >
                        <Edit className="h-4 w-4" />
                        <span className="sr-only">Edit shipping address</span>
                      </Button>
                    </CardHeader>
                    <CardContent className="p-6">
                      <div className="space-y-2">
                        <p>{selectedCustomer.shippingAddress.address1}</p>
                        {selectedCustomer.shippingAddress.address2 && (
                          <p>{selectedCustomer.shippingAddress.address2}</p>
                        )}
                        <p>
                          {selectedCustomer.shippingAddress.city}, 
                          {selectedCustomer.shippingAddress.stateProvince && ` ${selectedCustomer.shippingAddress.stateProvince},`} 
                          {selectedCustomer.shippingAddress.zipCode}
                        </p>
                        <p>{selectedCustomer.shippingAddress.country}</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
                
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Tax Information</CardTitle>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-8 w-8 p-0"
                      onClick={() => setEditTaxInfoOpen(true)}
                    >
                      <Edit className="h-4 w-4" />
                      <span className="sr-only">Edit tax information</span>
                    </Button>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="grid grid-cols-3 gap-6">
                      <div>
                        <p className="text-sm text-gray-500 mb-1">Tax ID</p>
                        <p>{selectedCustomer.taxInfo.taxId || "N/A"}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 mb-1">Tax Rate</p>
                        <p>{selectedCustomer.taxInfo.taxRate ? `${selectedCustomer.taxInfo.taxRate}%` : "N/A"}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 mb-1">Tax Exemption Number</p>
                        <p>{selectedCustomer.taxInfo.taxExemptionNumber || "N/A"}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="quotes" className="p-6 bg-gray-50 min-h-full">
                <div className="mb-6 flex justify-between items-center">
                  <h2 className="text-xl font-semibold">Customer Quotes</h2>
                  <Button 
                    className="bg-inkiq-primary hover:bg-inkiq-primary/90"
                    onClick={() => navigate("/quotes/new")}
                  >
                    New Quote for Customer
                  </Button>
                </div>

                {/* Filter Controls */}
                <div className="mb-6 p-4 bg-white rounded-lg border">
                  <div className="flex items-center gap-4 flex-wrap">
                    
                    {/* Date From */}
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">From:</span>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-[140px] justify-start text-left font-normal",
                              !quoteDateFrom && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {quoteDateFrom ? format(quoteDateFrom, "MMM dd") : "Select"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={quoteDateFrom}
                            onSelect={setQuoteDateFrom}
                            initialFocus
                            className="p-3 pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                    </div>

                    {/* Date To */}
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">To:</span>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-[140px] justify-start text-left font-normal",
                              !quoteDateTo && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {quoteDateTo ? format(quoteDateTo, "MMM dd") : "Select"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={quoteDateTo}
                            onSelect={setQuoteDateTo}
                            initialFocus
                            className="p-3 pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                    </div>

                    {/* Status Filter */}
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">Status:</span>
                      <Select value={quoteStatusFilter} onValueChange={setQuoteStatusFilter}>
                        <SelectTrigger className="w-[140px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Statuses</SelectItem>
                          <SelectItem value="artwork">Artwork</SelectItem>
                          <SelectItem value="production">Production</SelectItem>
                          <SelectItem value="shipping">Shipping</SelectItem>
                          <SelectItem value="complete">Complete</SelectItem>
                          <SelectItem value="onhold">On Hold</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Owner Filter */}
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">Owner:</span>
                      <Select value={quoteOwnerFilter} onValueChange={setQuoteOwnerFilter}>
                        <SelectTrigger className="w-[140px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Owners</SelectItem>
                          <SelectItem value="shahid">Shahid Raja</SelectItem>
                          <SelectItem value="kiri">Kiri</SelectItem>
                          <SelectItem value="jhon">Jhon</SelectItem>
                          <SelectItem value="kamelia">Kamelia</SelectItem>
                          <SelectItem value="picanto">Picanto</SelectItem>
                          <SelectItem value="helper">Helper</SelectItem>
                          <SelectItem value="jessica">Jessica</SelectItem>
                          <SelectItem value="michael">Michael</SelectItem>
                          <SelectItem value="emma">Emma</SelectItem>
                          <SelectItem value="tim">Tim</SelectItem>
                          <SelectItem value="sarah">Sarah</SelectItem>
                          <SelectItem value="kiriakos">Kiriakos</SelectItem>
                          <SelectItem value="noraiz">Noraiz shahid</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Payment Status Filter */}
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">Payment:</span>
                      <Select value={quotePaymentFilter} onValueChange={setQuotePaymentFilter}>
                        <SelectTrigger className="w-[140px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Payments</SelectItem>
                          <SelectItem value="paid">Paid</SelectItem>
                          <SelectItem value="unpaid">Unpaid</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Clear Filters */}
                    {(quoteDateFrom || quoteDateTo || quoteStatusFilter !== "all" || quoteOwnerFilter !== "all" || quotePaymentFilter !== "all") && (
                      <Button variant="outline" size="sm" onClick={clearQuoteFilters}>
                        Clear Filters
                      </Button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  {customerQuoteSummaryCards.map((card, index) => (
                    <QuoteSummaryCard
                      key={index}
                      title={card.title}
                      amount={card.amount}
                      percentage={card.percentage}
                      period={card.period}
                    />
                  ))}
                </div>

                <QuotationTable />
              </TabsContent>
              
              <TabsContent value="orders" className="p-6 bg-gray-50 min-h-full">
                <div className="mb-6 flex justify-between items-center">
                  <h2 className="text-xl font-semibold">Customer Orders</h2>
                  <Button 
                    className="bg-inkiq-primary hover:bg-inkiq-primary/90"
                    onClick={() => navigate("/quotes/new")}
                  >
                    New Order for Customer
                  </Button>
                </div>

                {/* Filter Controls */}
                <div className="mb-6 p-4 bg-white rounded-lg border">
                  <div className="flex items-center gap-4 flex-wrap">
                    
                    {/* Date From */}
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">From:</span>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-[140px] justify-start text-left font-normal",
                              !orderDateFrom && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {orderDateFrom ? format(orderDateFrom, "MMM dd") : "Select"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={orderDateFrom}
                            onSelect={setOrderDateFrom}
                            initialFocus
                            className="p-3 pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                    </div>

                    {/* Date To */}
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">To:</span>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-[140px] justify-start text-left font-normal",
                              !orderDateTo && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {orderDateTo ? format(orderDateTo, "MMM dd") : "Select"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={orderDateTo}
                            onSelect={setOrderDateTo}
                            initialFocus
                            className="p-3 pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                    </div>

                    {/* Status Filter */}
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">Status:</span>
                      <Select value={orderStatusFilter} onValueChange={setOrderStatusFilter}>
                        <SelectTrigger className="w-[140px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Statuses</SelectItem>
                          <SelectItem value="artwork">Artwork</SelectItem>
                          <SelectItem value="production">Production</SelectItem>
                          <SelectItem value="shipping">Shipping</SelectItem>
                          <SelectItem value="complete">Complete</SelectItem>
                          <SelectItem value="onhold">On Hold</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Owner Filter */}
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">Owner:</span>
                      <Select value={orderOwnerFilter} onValueChange={setOrderOwnerFilter}>
                        <SelectTrigger className="w-[140px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Owners</SelectItem>
                          <SelectItem value="shahid">Shahid Raja</SelectItem>
                          <SelectItem value="kiri">Kiri</SelectItem>
                          <SelectItem value="jhon">Jhon</SelectItem>
                          <SelectItem value="kamelia">Kamelia</SelectItem>
                          <SelectItem value="picanto">Picanto</SelectItem>
                          <SelectItem value="helper">Helper</SelectItem>
                          <SelectItem value="jessica">Jessica</SelectItem>
                          <SelectItem value="michael">Michael</SelectItem>
                          <SelectItem value="emma">Emma</SelectItem>
                          <SelectItem value="tim">Tim</SelectItem>
                          <SelectItem value="sarah">Sarah</SelectItem>
                          <SelectItem value="kiriakos">Kiriakos</SelectItem>
                          <SelectItem value="noraiz">Noraiz shahid</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Payment Status Filter */}
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">Payment:</span>
                      <Select value={orderPaymentFilter} onValueChange={setOrderPaymentFilter}>
                        <SelectTrigger className="w-[140px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Payments</SelectItem>
                          <SelectItem value="paid">Paid</SelectItem>
                          <SelectItem value="unpaid">Unpaid</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Clear Filters */}
                    {(orderDateFrom || orderDateTo || orderStatusFilter !== "all" || orderOwnerFilter !== "all" || orderPaymentFilter !== "all") && (
                      <Button variant="outline" size="sm" onClick={clearOrderFilters}>
                        Clear Filters
                      </Button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  {customerOrderSummaryCards.map((card, index) => (
                    <QuoteSummaryCard
                      key={index}
                      title={card.title}
                      amount={card.amount}
                      percentage={card.percentage}
                      period={card.period}
                    />
                  ))}
                </div>

                <QuotationTable isInvoicesPage={true} />
              </TabsContent>
              
              <TabsContent value="artwork">
                <div className="space-y-6">
                  {/* Customer Artwork Header and Stats */}
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h3 className="text-xl font-semibold">Customer Artwork Library</h3>
                      <p className="text-muted-foreground">
                        Manage artwork files and imprints for {selectedCustomer?.companyName}
                      </p>
                    </div>
                    <Button className="gap-2">
                      <Upload className="h-4 w-4" />
                      Upload Artwork
                    </Button>
                  </div>

                  {/* Stats Cards */}
                  {(() => {
                    const stats = getCustomerArtworkStats();
                    return (
                      <div className="grid gap-4 md:grid-cols-3">
                        <Card>
                          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Imprints</CardTitle>
                            <FileImage className="h-4 w-4 text-muted-foreground" />
                          </CardHeader>
                          <CardContent>
                            <div className="text-2xl font-bold">{stats.totalImprints}</div>
                            <p className="text-xs text-muted-foreground">
                              Across {stats.totalFolders} method folders
                            </p>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Storage Used</CardTitle>
                            <Layers className="h-4 w-4 text-muted-foreground" />
                          </CardHeader>
                          <CardContent>
                            <div className="text-2xl font-bold">{formatFileSize(stats.totalSize)}</div>
                            <p className="text-xs text-muted-foreground">
                              Production files & mockups
                            </p>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Method Folders</CardTitle>
                            <Folder className="h-4 w-4 text-muted-foreground" />
                          </CardHeader>
                          <CardContent>
                            <div className="text-2xl font-bold">{stats.totalFolders}</div>
                            <p className="text-xs text-muted-foreground">
                              Imprint methods used
                            </p>
                          </CardContent>
                        </Card>
                      </div>
                    );
                  })()}

                  {/* Filters */}
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex flex-col gap-4 md:flex-row md:items-center md:gap-6">
                        <div className="relative flex-1">
                          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            placeholder="Search customer imprints by name or notes..."
                            value={artworkSearchTerm}
                            onChange={(e) => setArtworkSearchTerm(e.target.value)}
                            className="pl-9"
                          />
                        </div>
                        <select 
                          value={selectedMethod} 
                          onChange={(e) => setSelectedMethod(e.target.value)}
                          className="w-[180px] h-10 px-3 py-2 border border-input rounded-md bg-background text-sm ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2"
                        >
                          <option value="all">All Methods</option>
                          {IMPRINT_METHODS.map((method) => (
                            <option key={method.value} value={method.value}>
                              {method.label}
                            </option>
                          ))}
                        </select>
                        <div className="flex gap-1">
                          <Button
                            variant={viewMode === 'grid' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setViewMode('grid')}
                          >
                            <Grid className="h-4 w-4" />
                          </Button>
                          <Button
                            variant={viewMode === 'list' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setViewMode('list')}
                          >
                            <List className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Results Summary */}
                  {!folderViewOpen ? (
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">
                        {customerImprintFolders.length} folder{customerImprintFolders.length !== 1 ? 's' : ''} found
                      </p>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => {
                            setFolderViewOpen(false);
                            setSelectedFolder(null);
                          }}
                          className="gap-2"
                        >
                          ← Back to Folders
                        </Button>
                        <span className="text-muted-foreground">/</span>
                        <span className="font-medium">
                          {IMPRINT_METHODS.find(m => m.value === selectedFolder)?.label || selectedFolder}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {folderImprints.length} imprint{folderImprints.length !== 1 ? 's' : ''} in folder
                      </p>
                    </div>
                  )}

                  {/* Main Content: Folder View vs Imprints View */}
                  {!folderViewOpen ? (
                    // Folders Grid
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {customerImprintFolders.map((folder) => (
                        <Card 
                          key={folder.method} 
                          className="group cursor-pointer hover:shadow-md transition-shadow"
                          onClick={() => handleFolderClick(folder.method)}
                        >
                          <CardHeader className="pb-2">
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <div className="p-2 bg-muted rounded-lg">
                                  <Layers className="h-8 w-8 text-primary" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <CardTitle className="text-lg truncate">
                                    {IMPRINT_METHODS.find(m => m.value === folder.method)?.label || folder.method}
                                  </CardTitle>
                                  <CardDescription className="truncate">
                                    {folder.count} imprint{folder.count !== 1 ? 's' : ''}
                                  </CardDescription>
                                </div>
                              </div>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem>
                                    <Upload className="h-4 w-4 mr-2" />
                                    Upload Files
                                  </DropdownMenuItem>
                                  <DropdownMenuItem>
                                    <Download className="h-4 w-4 mr-2" />
                                    Download All
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                              <div className="text-center">
                                <div className="font-medium">{folder.count}</div>
                                <div>Imprints</div>
                              </div>
                              <div className="text-center">
                                <div className="font-medium">{formatFileSize(folder.totalSize)}</div>
                                <div>Size</div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                      {customerImprintFolders.length === 0 && (
                        <div className="col-span-full">
                          <Card>
                            <CardContent className="p-6 text-center">
                              <FileImage className="h-16 w-16 mx-auto mb-4 opacity-40" />
                              <p className="text-lg text-muted-foreground">No artwork files found</p>
                              <p className="text-sm text-muted-foreground">Upload some artwork to get started</p>
                            </CardContent>
                          </Card>
                        </div>
                      )}
                    </div>
                  ) : (
                    // Imprints Grid/List within folder
                    viewMode === 'grid' ? (
                      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {folderImprints.map((imprint) => (
                          <Card 
                            key={imprint.id} 
                            className="group cursor-pointer hover:shadow-md transition-shadow"
                            onClick={() => navigate(`/imprint/${imprint.id}`)}
                          >
                            <CardHeader className="pb-2">
                              <div className="flex items-start justify-between">
                                <div className="flex-1 min-w-0">
                                  <CardTitle className="text-lg truncate">{imprint.designName}</CardTitle>
                                  <CardDescription className="truncate">
                                    {imprint.fileCount} files • {formatFileSize(imprint.totalSizeBytes)}
                                  </CardDescription>
                                </div>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                      <MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={(e) => {
                                      e.stopPropagation();
                                      handlePreviewArtwork(imprint);
                                    }}>
                                      <Eye className="h-4 w-4 mr-2" />
                                      Preview
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={(e) => {
                                      e.stopPropagation();
                                      navigate(`/imprint/${imprint.id}`);
                                    }}>
                                      <FileImage className="h-4 w-4 mr-2" />
                                      View Details
                                    </DropdownMenuItem>
                                    <DropdownMenuItem>
                                      <Download className="h-4 w-4 mr-2" />
                                      Download
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </CardHeader>
                            <CardContent className="space-y-3">
                              <div className="text-xs space-y-1">
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Customer Art:</span>
                                  <span>{imprint.customerArt.length}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Production:</span>
                                  <span>{imprint.productionFiles.length}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Mockups:</span>
                                  <span>{imprint.mockups.length}</span>
                                </div>
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Last updated: {formatDate(imprint.updatedAt)}
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    ) : (
                      // List view
                      <Card>
                        <CardContent className="p-0">
                          <div className="divide-y">
                            {folderImprints.map((imprint) => (
                              <div 
                                key={imprint.id} 
                                className="p-4 hover:bg-muted/50 cursor-pointer transition-colors"
                                onClick={() => navigate(`/imprint/${imprint.id}`)}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-4 flex-1 min-w-0">
                                    <div className="p-2 bg-muted rounded-lg">
                                      <FileImage className="h-6 w-6 text-primary" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <h4 className="font-medium truncate">{imprint.designName}</h4>
                                      <p className="text-sm text-muted-foreground">
                                        {imprint.fileCount} files • {formatFileSize(imprint.totalSizeBytes)} • 
                                        Updated {formatDate(imprint.updatedAt)}
                                      </p>
                                      <div className="flex gap-2 mt-1">
                                        <Badge variant="secondary" className="text-xs">
                                          {imprint.customerArt.length} Customer Art
                                        </Badge>
                                        <Badge variant="secondary" className="text-xs">
                                          {imprint.productionFiles.length} Production
                                        </Badge>
                                        <Badge variant="secondary" className="text-xs">
                                          {imprint.mockups.length} Mockups
                                        </Badge>
                                      </div>
                                    </div>
                                  </div>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                        <MoreVertical className="h-4 w-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuItem onClick={(e) => {
                                        e.stopPropagation();
                                        handlePreviewArtwork(imprint);
                                      }}>
                                        <Eye className="h-4 w-4 mr-2" />
                                        Preview
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={(e) => {
                                        e.stopPropagation();
                                        navigate(`/imprint/${imprint.id}`);
                                      }}>
                                        <FileImage className="h-4 w-4 mr-2" />
                                        View Details
                                      </DropdownMenuItem>
                                      <DropdownMenuItem>
                                        <Download className="h-4 w-4 mr-2" />
                                        Download
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )
                  )}
                </div>

                {/* Preview Dialog */}
                <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
                  <DialogContent className="max-w-4xl max-h-[80vh]">
                    <DialogHeader>
                      <DialogTitle>{selectedArtwork?.designName}</DialogTitle>
                    </DialogHeader>
                    <ScrollArea className="max-h-[60vh]">
                      {selectedArtwork && (
                        <Tabs defaultValue="customerArt" className="w-full">
                          <TabsList className="grid w-full grid-cols-3">
                            <TabsTrigger value="customerArt">Customer Art ({selectedArtwork.customerArt.length})</TabsTrigger>
                            <TabsTrigger value="production">Production ({selectedArtwork.productionFiles.length})</TabsTrigger>
                            <TabsTrigger value="mockups">Mockups ({selectedArtwork.mockups.length})</TabsTrigger>
                          </TabsList>
                          
                          <TabsContent value="customerArt" className="space-y-4">
                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                              {selectedArtwork.customerArt.map((file) => (
                                <Card key={file.id} className="p-4">
                                  <div className="aspect-square bg-muted rounded-lg mb-2 flex items-center justify-center">
                                    <FileImage className="h-8 w-8 text-muted-foreground" />
                                  </div>
                                  <h4 className="font-medium text-sm truncate">{file.name}</h4>
                                  <p className="text-xs text-muted-foreground">
                                    {formatFileSize(file.sizeBytes)}
                                  </p>
                                </Card>
                              ))}
                            </div>
                          </TabsContent>
                          
                          <TabsContent value="production" className="space-y-4">
                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                              {selectedArtwork.productionFiles.map((file) => (
                                <Card key={file.id} className="p-4">
                                  <div className="aspect-square bg-muted rounded-lg mb-2 flex items-center justify-center">
                                    <File className="h-8 w-8 text-muted-foreground" />
                                  </div>
                                  <h4 className="font-medium text-sm truncate">{file.name}</h4>
                                  <p className="text-xs text-muted-foreground">
                                    {formatFileSize(file.sizeBytes)}
                                  </p>
                                </Card>
                              ))}
                            </div>
                          </TabsContent>
                          
                          <TabsContent value="mockups" className="space-y-4">
                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                              {selectedArtwork.mockups.map((file) => (
                                <Card key={file.id} className="p-4">
                                  <div className="aspect-square bg-muted rounded-lg mb-2 flex items-center justify-center">
                                    <Image className="h-8 w-8 text-muted-foreground" />
                                  </div>
                                  <h4 className="font-medium text-sm truncate">{file.name}</h4>
                                  <p className="text-xs text-muted-foreground">
                                    {formatFileSize(file.sizeBytes)}
                                  </p>
                                </Card>
                              ))}
                            </div>
                          </TabsContent>
                        </Tabs>
                      )}
                    </ScrollArea>
                  </DialogContent>
                </Dialog>
              </TabsContent>
              
              <TabsContent value="tasks">
                <Card>
                  <CardContent className="p-6 min-h-[200px] flex items-center justify-center">
                    <div className="text-center text-gray-500">
                      <ClipboardList className="h-16 w-16 mx-auto mb-4 opacity-40" />
                      <p className="text-lg">No tasks assigned to this customer yet.</p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      )}

      <CustomerDialog 
        open={openDialog}
        onOpenChange={setOpenDialog}
      />

      {selectedCustomerId && (
        <>
          <AddContactDialog 
            open={openContactDialog}
            onOpenChange={setOpenContactDialog}
            onAddContact={handleAddContact}
            customerId={selectedCustomerId}
          />
          
          {selectedContact && (
            <EditContactDialog 
              open={editContactDialog}
              onOpenChange={setEditContactDialog}
              onUpdateContact={handleEditContact}
              contact={selectedContact}
            />
          )}
          
          {selectedCustomer && (
            <>
              <EditCompanyDialog 
                open={editCompanyOpen}
                onOpenChange={setEditCompanyOpen}
                onUpdateCompany={handleEditCompany}
                customer={selectedCustomer}
              />
              
              <EditAddressDialog 
                open={editBillingAddressOpen}
                onOpenChange={setEditBillingAddressOpen}
                onUpdateAddress={handleEditBillingAddress}
                address={selectedCustomer.billingAddress}
                title="Billing Address"
              />
              
              <EditAddressDialog 
                open={editShippingAddressOpen}
                onOpenChange={setEditShippingAddressOpen}
                onUpdateAddress={handleEditShippingAddress}
                address={selectedCustomer.shippingAddress}
                title="Shipping Address"
              />
              
              <EditTaxInfoDialog 
                open={editTaxInfoOpen}
                onOpenChange={setEditTaxInfoOpen}
                onUpdateTaxInfo={handleEditTaxInfo}
                taxInfo={selectedCustomer.taxInfo}
              />
            </>
          )}
        </>
      )}
    </div>
  );
}

// Centralized industries available via INDUSTRIES import
