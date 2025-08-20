
import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams, useParams } from "react-router-dom";
import { QuoteHeader } from "@/components/quotes/QuoteHeader";
import { CustomerSection } from "@/components/quotes/CustomerSection";
import { BillingSection } from "@/components/quotes/BillingSection";
import { ShippingSection } from "@/components/quotes/ShippingSection";
import { QuoteItemsSection, QuoteItemsSectionRef } from "@/components/quotes/QuoteItemsSection";
import { QuotationHeader } from "@/components/quotes/QuotationHeader";
import { QuotationDetailsSection } from "@/components/quotes/QuotationDetailsSection";
import { NickNameSection } from "@/components/quotes/NickNameSection";
import { NotesSection } from "@/components/quotes/NotesSection";
import { InvoiceSummarySection } from "@/components/quotes/InvoiceSummarySection";
import { CustomersProvider, useCustomers } from "@/context/CustomersContext";
import { useQuotes } from "@/context/QuotesContext";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { getQuoteById, QuotationData } from "@/components/quotes/QuoteData";
import { clearQuoteDraft, cleanupOldStorageData } from '@/utils/quoteStorage';
import { quoteStorage } from "@/lib/quoteStorage";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";



// Sample data for demonstration purposes
const generateNewQuoteId = () => {
  // In a real app, this would be generated on the server
  return Math.floor(3000 + Math.random() * 1000).toString();
};

// Inner component that has access to CustomersContext
function NewQuoteContent() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { createQuote, updateQuoteStatus, getQuote } = useQuotes();
  const { selectedCustomer } = useCustomers();
  const [searchParams] = useSearchParams();
  const { id: editQuoteId } = useParams();
  
  // Determine if we're in edit mode
  const isEditMode = !!editQuoteId;
  
  // Generate a new quote ID for this quote (only if creating new)
  const [quoteId] = useState(isEditMode ? editQuoteId : generateNewQuoteId());
  const [nickname, setNickname] = useState(isEditMode ? `Edit Quote #${editQuoteId}` : "New Quotation");
  const [leadData, setLeadData] = useState<any>(null);
  const [quoteData, setQuoteData] = useState<QuotationData | null>(null);
  const [isLoading, setIsLoading] = useState(isEditMode);
  const quoteItemsRef = useRef<QuoteItemsSectionRef>(null);
  const [createdQuoteId, setCreatedQuoteId] = useState<string | null>(null);
  
  // Clear quote draft when starting a new quote (not in edit mode)
  useEffect(() => {
    if (!isEditMode) {
      // Small delay to ensure page has loaded
      setTimeout(() => {
        cleanupOldStorageData();
        clearQuoteDraft();
        console.log('🧹 Cleared quote draft for new quote');
      }, 100);
    }
  }, [isEditMode]);
  
  
  // State for quote dates
  const [quoteDates, setQuoteDates] = useState<{
    productionDueDate?: Date;
    customerDueDate?: Date;
    paymentDueDate?: Date;
    invoiceDate?: Date;
  }>({});

  // Check if this quote is being created from a lead or if we're editing
  useEffect(() => {
    if (isEditMode) {
      // In edit mode, load existing quote data
      // For demo purposes, we'll use the sample quotationData
      setIsLoading(true);
      
      // Simulate loading delay
      setTimeout(() => {
        const loadedQuoteData = getQuoteById(editQuoteId);
        if (loadedQuoteData) {
          setQuoteData(loadedQuoteData);
          setNickname(loadedQuoteData.nickname || `Edit Quote #${editQuoteId}`);
          setIsLoading(false);
          
          toast({
            title: "Quote loaded for editing",
            description: `Editing quote #${editQuoteId}`,
          });
        } else {
          setIsLoading(false);
          toast({
            title: "Quote not found",
            description: `Quote #${editQuoteId} could not be found`,
            variant: "destructive"
          });
        }
      }, 500);
    } else {
      // Check if creating from a lead
      const leadParam = searchParams.get('lead');
      if (leadParam) {
        try {
          const data = JSON.parse(decodeURIComponent(leadParam));
          setLeadData(data);
          setNickname(`Quote for ${data.company || data.customerName}`);
          
          toast({
            title: "Lead data loaded",
            description: `Creating quote for ${data.customerName} at ${data.company}`,
          });
        } catch (error) {
          console.error('Error parsing lead data:', error);
        }
      }
    }
  }, [searchParams, toast, isEditMode, editQuoteId]);
  
  const handleCancel = () => {
    navigate("/quotes");
  };

  const handlePreview = () => {
    // Unused now; Save & Finish is handled by handleFinalize
  };

  // Save Draft helper that returns the created quote id
  const saveDraft = async (): Promise<string | null> => {

    
    // Get current item groups data from QuoteItemsSection if available
    const currentItemGroups = quoteItemsRef.current?.getCurrentItemGroups();
    console.log("🔍 [DEBUG] handleSave - currentItemGroups:", currentItemGroups);

    
    if (isEditMode && quoteData && quoteId) {
      console.log("Update quote with ID:", quoteId);
      console.log("Saving item groups with imprints:", currentItemGroups);
      
      // Convert item groups to the format expected by QuotationData
      const convertedItems = currentItemGroups ? 
        currentItemGroups.flatMap(group => group.items.map(item => ({
          category: item.category,
          itemNumber: item.itemNumber,
          color: item.color,
          description: item.description,
          xs: item.sizes.xs.toString(),
          s: item.sizes.s.toString(),
          m: item.sizes.m.toString(),
          l: item.sizes.l.toString(),
          xl: item.sizes.xl.toString(),
          xxl: item.sizes.xxl.toString(),
          qty: item.quantity.toString(),
          quantity: item.quantity.toString(),
          price: item.unitPrice.toString(),
          taxed: item.taxed,
          total: item.total.toString(),
          status: "active",
          mockups: item.mockups?.map(mockup => ({
            id: mockup.id,
            name: mockup.name,
            url: mockup.url,
            type: mockup.type
          }))
        }))) : 
        quoteData.items;

      // Extract and flatten imprints from all item groups
      const convertedImprints = currentItemGroups ? 
        currentItemGroups.flatMap(group => 
          group.imprints?.map(imprint => ({
            id: imprint.id,
            type: imprint.method,
            placement: imprint.location,
            size: `${imprint.width}" x ${imprint.height}"`,
            colours: imprint.colorsOrThreads,
            notes: imprint.notes,
            customerArt: (imprint.customerArt || []).map((file, idx) => ({
              id: `${imprint.id}-ca-${idx}`,
              name: file.name,
              url: URL.createObjectURL(file),
              type: file.type,
              category: 'customer_art'
            })),
            productionFiles: (imprint.productionFiles || []).map((file, idx) => ({
              id: `${imprint.id}-pf-${idx}`,
              name: file.name,
              url: URL.createObjectURL(file),
              type: file.type,
              category: 'production_files'
            })),
            proofMockup: (imprint.proofMockup || []).map((file, idx) => ({
              id: `${imprint.id}-pm-${idx}`,
              name: file.name,
              url: URL.createObjectURL(file),
              type: file.type,
              category: 'proof_mockup'
            }))
          })) || []
        ) : 
        quoteData.imprints || [];

      // Update the quote data with the new items and imprints
      const updatedQuoteData: QuotationData = {
        ...quoteData,
        items: convertedItems,
        imprints: convertedImprints,
        nickname: nickname
      };
      
      // Save to localStorage
      quoteStorage.saveQuote(quoteId, updatedQuoteData);
      console.log("Updated quote data saved:", updatedQuoteData);
      
      // For now, just show a toast since update functionality isn't implemented yet
      toast({
        title: "Update not implemented",
        description: "Quote updates will be implemented in the next phase",
        variant: "destructive"
      });
      return null;
    } else {
      try {
        // Check if a customer is selected
        if (!selectedCustomer) {
          toast({
            title: "Please select a customer",
            description: "You must select a customer before creating a quote",
            variant: "destructive"
          });
          return null;
        }
                 
        // Get the current items and imprints from QuoteItemsSection
        const currentItemGroups = quoteItemsRef.current?.getCurrentItemGroups() || [];

        
        // Validate that at least one item has quantity > 0
        const hasValidQuantity = currentItemGroups.some(group =>
          group.items.some(item => {
            const totalQuantity = Object.values(item.sizes).reduce((sum, qty) => sum + qty, 0);
            return totalQuantity > 0;
          })
        );

        if (!hasValidQuantity) {
          toast({
            title: "Invalid Quote",
            description: "Please add at least one item with quantity greater than 0",
            variant: "destructive",
          });
          return null;
        }

        // Convert items to the format expected by the backend
        const quoteItems = currentItemGroups.flatMap((group, groupIdx) => 
          group.items.map(item => {
            console.log("🔍 [DEBUG] handleSave - Converting item for backend:", item);
            const convertedItem = {
              product_name: item.description || "Unknown Product",
              product_sku: item.itemNumber || "",
              product_description: item.description || "",
              category: item.category || "",
              item_number: item.itemNumber || "",
              color: item.color || "",
              quantity: item.quantity || 0,
              unit_price: item.unitPrice || 0,
              total_price: item.total || 0,
              xs: item.sizes?.xs || 0,
              s: item.sizes?.s || 0,
              m: item.sizes?.m || 0,
              l: item.sizes?.l || 0,
              xl: item.sizes?.xl || 0,
              xxl: item.sizes?.xxl || 0,
              xxxl: item.sizes?.xxxl || 0,
              taxed: item.taxed || false,
              garment_status: 'pending',
              imprint_type: group.imprints?.find((imp:any) => imp.itemId === item.id)?.method || null,
              setup_fee: 0,
              imprint_cost: 0,
              notes: group.imprints?.find((imp:any) => imp.itemId === item.id)?.notes || "",
              group_index: groupIdx + 1,
              group_label: `Group ${groupIdx + 1}`
            };
            console.log("🔍 [DEBUG] handleSave - Converted item for backend:", convertedItem);
            return convertedItem;
          })
        );

        const quoteData = {
          customer_id: selectedCustomer.id,
          subject: nickname || "New Quote",
          description: "Quote created from frontend",
          tax_rate: 0.08,
          discount_percentage: 0,
          valid_until_days: 30,
          notes: "Quote created via NewQuote component",
          terms_conditions: "Standard terms apply",
          production_due_date: quoteDates.productionDueDate ? new Date(quoteDates.productionDueDate) : undefined,
          customer_due_date: quoteDates.customerDueDate ? new Date(quoteDates.customerDueDate) : undefined,
          payment_due_date: quoteDates.paymentDueDate ? new Date(quoteDates.paymentDueDate) : undefined,
          invoice_date: quoteDates.invoiceDate ? new Date(quoteDates.invoiceDate) : undefined,
          items: quoteItems
        };
        

        
        const result = await createQuote(quoteData);

        
        if (result.success && result.quote_id) {
          setCreatedQuoteId(result.quote_id);
          toast({
            title: "Draft saved",
            description: `Draft quote for ${selectedCustomer.companyName} has been saved`,
          });
          return result.quote_id;
        } else {
          toast({
            title: "Failed to create quote",
            description: result.error || "Unknown error occurred",
            variant: "destructive"
          });
          return null;
        }
      } catch (error) {
        console.error("Error creating quote:", error);
      toast({
          title: "Error creating quote",
          description: "An unexpected error occurred",
          variant: "destructive"
      });
      return null;
    }
    }
  };

  // Save Draft (for header button)
  const handleSave = async () => {
    await saveDraft();
  };

  // Finalize & navigate to quote detail
  const [isFinalizingRef] = useState({ current: false });
  
  const handleFinalize = async () => {
    // Prevent multiple simultaneous finalization calls
    if (isFinalizingRef.current) {
      console.debug('Finalization already in progress, skipping');
      return;
    }
    isFinalizingRef.current = true;
    
    let id = createdQuoteId;
    if (!id) {
      id = await saveDraft();
    }
    if (!id) {
      isFinalizingRef.current = false;
      toast({ title: "Unable to finalize", description: "Please try saving again", variant: "destructive" });
      return;
    }
    try {
      // Ensure we have latest saved quote with DB item IDs
      const savedQuote = await getQuote(id);
      const savedItems = savedQuote?.items || [];

      // Build a map from item_number to DB item id for association
      const itemNumberToId = new Map<string, string>();
      savedItems.forEach((it: any) => {
        if (it.item_number) itemNumberToId.set(it.item_number, it.id);
        else if (it.product_sku) itemNumberToId.set(it.product_sku, it.id);
      });

      // Get client item groups and persist imprints and files
      const currentItemGroups = quoteItemsRef.current?.getCurrentItemGroups() || [];

      // Insert imprints per item
      for (const group of currentItemGroups) {
        for (const imprint of group.imprints) {
          const clientItem = group.items.find(i => i.id === (imprint as any).itemId);
          if (!clientItem) continue;
          const dbItemId = itemNumberToId.get(clientItem.itemNumber);
          if (!dbItemId) continue;

          // Check if imprint already exists to prevent duplicates
          const { data: existingImprints } = await supabase
            .from('quote_imprints')
            .select('id')
            .eq('quote_id', id)
            .eq('quote_item_id', dbItemId)
            .eq('method', imprint.method)
            .eq('location', imprint.location);

          let imprintRow;
          if (existingImprints && existingImprints.length > 0) {
            console.debug('Imprint already exists, skipping insert', { imprintId: existingImprints[0].id });
            imprintRow = existingImprints[0];
          } else {
            // Insert imprint row
            const { data, error: imprintErr } = await supabase
              .from('quote_imprints')
              .insert({
                quote_id: id,
                quote_item_id: dbItemId,
                method: imprint.method,
                location: imprint.location,
                width: imprint.width,
                height: imprint.height,
                colors_or_threads: imprint.colorsOrThreads,
                notes: imprint.notes
              })
              .select('*')
              .single();
            if (imprintErr) {
              console.error('Failed to insert imprint', imprintErr);
              continue;
            }
            imprintRow = data;
          }

          // Helper to upload a single file and create artwork_files row
          const uploadAndRecord = async (file: File, category: 'customer_art' | 'production_files' | 'proof_mockup') => {
            const imprintId = imprintRow?.id || 'no-imprint';
            const folderPath = `${id}/${dbItemId}/${imprintId}/${category}`;
            
            // Check if files already exist in this folder to prevent duplicates
            const { data: existingFiles } = await supabase.storage
              .from('artwork')
              .list(folderPath, { limit: 100 });
            
            if (existingFiles && existingFiles.length > 0) {
              console.debug('Files already exist in folder, skipping upload', { folderPath, count: existingFiles.length });
              return;
            }
            
            const ext = file.name.split('.').pop() || 'bin';
            const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
            const filePath = `${folderPath}/${fileName}`;
            const { error: upErr } = await supabase.storage.from('artwork').upload(filePath, file, {
              cacheControl: '3600',
              upsert: false,
              contentType: file.type || undefined
            });
            if (upErr) {
              console.error('Failed to upload artwork', upErr);
              return;
            }
            // Skip DB insert; QuoteDetail will read from storage by imprint folder
          };

          // Upload all files
          await Promise.all([
            ...(imprint.customerArt || []).map(f => uploadAndRecord(f, 'customer_art')),
            ...(imprint.productionFiles || []).map(f => uploadAndRecord(f, 'production_files')),
            ...(imprint.proofMockup || []).map(f => uploadAndRecord(f, 'proof_mockup')),
          ]);
        }
      }

      // Update status and navigate
      await updateQuoteStatus(id, 'sent');
      isFinalizingRef.current = false;
      navigate(`/quotes/${id}`);
    } catch (e) {
      console.error('Finalize error', e);
      await updateQuoteStatus(id, 'sent');
      isFinalizingRef.current = false;
      navigate(`/quotes/${id}`);
    }
  };

  const handleNicknameChange = (value: string) => {
    setNickname(value);
  };

  const handleDatesChange = (dates: {
    productionDueDate?: Date;
    customerDueDate?: Date;
    paymentDueDate?: Date;
    invoiceDate?: Date;
  }) => {
    setQuoteDates(dates);
  };

  return (
      <div className="p-0 bg-gray-50 min-h-full">
        <QuoteHeader 
          onCancel={handleCancel}
          onPreview={handleFinalize}
          onSave={handleSave}
          quoteId={quoteId}
          isNewQuote={!isEditMode}
        />

        {/* Lead Context Banner */}
        {leadData && (
          <div className="bg-primary/10 border-b px-6 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="h-2 w-2 bg-primary rounded-full"></div>
                <span className="text-sm font-medium">
                  Creating quote from lead: {leadData.customerName} ({leadData.company})
                </span>
              </div>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => navigate(`/leads`)}
                className="text-xs"
              >
                ← Back to Leads
              </Button>
            </div>
          </div>
        )}

        <div className="p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <span className="ml-2">Loading quote data...</span>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Left Content - 8 columns (2/3 of grid) */}
                <div className="md:col-span-2 space-y-6">
                  <CustomerSection leadData={leadData} quoteData={quoteData} />
                  <BillingSection quoteData={quoteData} />
                  <ShippingSection quoteData={quoteData} />
                </div>

                {/* Right Content - 4 columns (1/3 of grid) */}
                <div className="md:col-span-1 space-y-4">
                  <QuotationHeader quoteData={quoteData} />
                <QuotationDetailsSection quoteData={quoteData} onDatesChange={handleDatesChange} />
                  <NickNameSection value={nickname} onChange={handleNicknameChange} />
                  <div className="space-y-4">
                    <NotesSection title="Customer Notes" initialValue={quoteData?.notes.customer} />
                    <NotesSection title="Production Note" initialValue={quoteData?.notes.production} />
                  </div>
                </div>
              </div>
              
              {/* Quote Items Section - Full Width */}
              <div className="mt-6">
                <QuoteItemsSection 
                  quoteData={quoteData} 
                  ref={quoteItemsRef}
                />
              </div>
              
              {/* Invoice Summary Section - Full Width but with right alignment */}
              <div className="mt-6 md:w-1/3 md:ml-auto">
                <InvoiceSummarySection quoteData={quoteData} />
              </div>
            </>
          )}
        </div>
      </div>
  );
}

// Main component that provides the CustomersContext
export default function NewQuote() {
  return (
    <CustomersProvider>
      <NewQuoteContent />
    </CustomersProvider>
  );
}
