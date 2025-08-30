import React, { useState, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ImprintItem, ImprintFile } from "@/types/imprint";
import { GarmentDetails, GarmentStatus, GarmentIssue } from "@/types/garment";
import { GarmentStatusDropdown } from "@/components/garment/GarmentStatusDropdown";
import { StockIssueDialog } from "@/components/garment/StockIssueDialog";
import { GarmentIssuesList } from "@/components/garment/GarmentIssuesList";
import { useToast } from "@/hooks/use-toast";
import { quoteStorage } from "@/lib/quoteStorage";

interface Mockup {
  id: string;
  name: string;
  url: string;
  type: string;
}

interface QuoteItem {
  id: string;
  category: string;
  itemNumber: string;
  color: string;
  description: string;
  sizes: {
    xs: number;
    s: number;
    m: number;
    l: number;
    xl: number;
    xxl: number;
    xxxl: number;
  };
  price: number | string;
  taxed: boolean;
  total: number | string;
  status: string;
  mockups: Mockup[];
  garmentDetails?: GarmentDetails;
}

interface ItemGroup {
  id: string;
  items: QuoteItem[];
  imprints: ImprintItem[];
}

interface QuoteItemsTableProps {
  itemGroups: ItemGroup[];
  quoteId?: string;
}

export function QuoteItemsTable({ itemGroups, quoteId }: QuoteItemsTableProps) {
  const { toast } = useToast();
  const [issueDialogOpen, setIssueDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<QuoteItem | null>(null);
  const [garmentDetailsMap, setGarmentDetailsMap] = useState<Record<string, GarmentDetails>>({});
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [lightboxTitle, setLightboxTitle] = useState<string>("");

  // Debug: render context
  useEffect(() => {
    console.debug("[QuoteItemsTable] mount - itemGroups:", itemGroups?.length || 0);
  }, [itemGroups]);

  // Helper to resolve a displayable URL from various shapes (library-signed URLs or File objects)
  const resolveFileUrl = (file: any): string | null => {
    if (!file) return null;
    if (typeof file === 'string') return file;
    const candidates = [file?.url, file?.signedUrl, file?.publicUrl, file?.signed_url, file?.public_url];
    const found = candidates.find((u) => typeof u === 'string' && u.length > 0);
    if (found) return found as string;
    try {
      if (file instanceof File || file instanceof Blob) {
        return URL.createObjectURL(file);
      }
    } catch {}
    return null;
  };

  const resolveFileName = (file: any, fallback: string): string => {
    if (!file) return fallback;
    return (file?.name || file?.file_name || fallback) as string;
  };

  // Helper function to get total quantity for an item
  const getTotalQuantity = (sizes: QuoteItem['sizes']) => {
    return Object.values(sizes).reduce((sum, qty) => sum + qty, 0);
  };

  // Load garment details from localStorage on mount
  useEffect(() => {
    if (!quoteId) return;
    
    const savedQuote = quoteStorage.loadQuote(quoteId);
    if (savedQuote && savedQuote.garmentDetails) {
      setGarmentDetailsMap(savedQuote.garmentDetails);
    }
  }, [quoteId]);

  // Save garment details to localStorage whenever they change
  const saveGarmentDetails = (updatedDetails: Record<string, GarmentDetails>) => {
    if (!quoteId) return;
    
    const savedQuote = quoteStorage.loadQuote(quoteId);
    if (savedQuote) {
      const updatedQuote = {
        ...savedQuote,
        garmentDetails: updatedDetails,
        lastModified: new Date().toISOString()
      };
      quoteStorage.saveQuote(quoteId, updatedQuote);
    }
  };

  // Get garment details for an item (from state or create default)
  const getGarmentDetails = (item: QuoteItem): GarmentDetails => {
    const existingDetails = garmentDetailsMap[item.id] || item.garmentDetails;
    if (existingDetails) {
      return { id: item.id, ...existingDetails } as GarmentDetails;
    }
    
    const totalQuantity = getTotalQuantity(item.sizes);
    const defaultDetails: GarmentDetails = {
      id: item.id,
      status: 'pending',
      stockIssues: [],
      receivedQuantity: 0,
      expectedQuantity: totalQuantity,
      statusHistory: [{
        id: `${item.id}-initial`,
        status: 'pending',
        timestamp: new Date(),
        notes: 'Initial status'
      }],
      lastUpdated: new Date()
    };
    
    return defaultDetails;
  };

  const handleStatusChange = (item: QuoteItem, newStatus: GarmentStatus, notes?: string) => {
    const currentDetails = getGarmentDetails(item);
    
    // Create new status history entry
    const newHistoryEntry = {
      id: `${item.id}-${Date.now()}`,
      status: newStatus,
      timestamp: new Date(),
      notes,
    };
    
    // Update garment details
    const updatedDetails: GarmentDetails = {
      ...currentDetails,
      status: newStatus,
      statusHistory: [...currentDetails.statusHistory, newHistoryEntry],
      lastUpdated: new Date()
    };
    
    // Update state
    const updatedDetailsMap = {
      ...garmentDetailsMap,
      [item.id]: updatedDetails
    };
    
    setGarmentDetailsMap(updatedDetailsMap);
    saveGarmentDetails(updatedDetailsMap);
    
    toast({
      title: "Status Updated",
      description: `${item.description} status changed to ${newStatus}`,
    });
  };

  const handleReportIssue = (item: QuoteItem) => {
    setSelectedItem(item);
    setIssueDialogOpen(true);
  };

  const handleIssueSubmit = (issueData: Omit<GarmentIssue, 'id' | 'reportedDate'>) => {
    if (!selectedItem) return;
    
    const currentDetails = getGarmentDetails(selectedItem);
    
    // Create new issue
    const newIssue: GarmentIssue = {
      ...issueData,
      id: `${selectedItem.id}-issue-${Date.now()}`,
      reportedDate: new Date()
    };
    
    // Update garment details with new issue and set status to stock_issue
    const updatedDetails: GarmentDetails = {
      ...currentDetails,
      status: 'stock_issue',
      stockIssues: [...currentDetails.stockIssues, newIssue],
      statusHistory: [...currentDetails.statusHistory, {
        id: `${selectedItem.id}-${Date.now()}`,
        status: 'stock_issue',
        timestamp: new Date(),
        notes: `Issue reported: ${issueData.type}`
      }],
      lastUpdated: new Date()
    };
    
    // Update state
    const updatedDetailsMap = {
      ...garmentDetailsMap,
      [selectedItem.id]: updatedDetails
    };
    
    setGarmentDetailsMap(updatedDetailsMap);
    saveGarmentDetails(updatedDetailsMap);
    
    toast({
      title: "Issue Reported",
      description: `${issueData.type} reported for ${selectedItem.description}`,
      variant: "destructive",
    });
    
    setSelectedItem(null);
  };

  const handleResolveIssue = (item: QuoteItem, issueId: string) => {
    const currentDetails = getGarmentDetails(item);
    
    // Find and resolve the issue
    const updatedIssues = currentDetails.stockIssues.map(issue => 
      issue.id === issueId 
        ? { ...issue, resolvedDate: new Date() }
        : issue
    );

    // Update garment details
    const updatedDetails: GarmentDetails = {
      ...currentDetails,
      stockIssues: updatedIssues,
      // If all issues are resolved and status is stock_issue, change to ready
      status: updatedIssues.every(issue => issue.resolvedDate) && currentDetails.status === 'stock_issue' 
        ? 'ready' 
        : currentDetails.status,
      statusHistory: [...currentDetails.statusHistory, {
        id: `${item.id}-${Date.now()}`,
        status: updatedIssues.every(issue => issue.resolvedDate) && currentDetails.status === 'stock_issue' 
          ? 'ready' 
          : currentDetails.status,
        timestamp: new Date(),
        notes: `Issue ${issueId} resolved`
      }],
      lastUpdated: new Date()
    };

    // Update state
    const updatedDetailsMap = {
      ...garmentDetailsMap,
      [item.id]: updatedDetails
    };

    setGarmentDetailsMap(updatedDetailsMap);
    saveGarmentDetails(updatedDetailsMap);

    toast({
      title: "Issue Resolved",
      description: "Stock issue has been marked as resolved",
    });
  };

  const handleDeleteArtwork = async (file: any) => {
    try {
      if (!file || !file.url) return;
      // Try to infer storage path: signed URLs contain the path after '/object/sign/artwork/'
      let path: string | null = null;
      if (file.path) {
        path = file.path;
      } else if (typeof file.url === 'string') {
        const m = file.url.match(/\/object\/sign\/artwork\/([^?]+)/);
        if (m && m[1]) path = decodeURIComponent(m[1]);
      }
      if (!path) {
        console.warn('[QuoteItemsTable] Could not resolve storage path for deletion', file);
        return;
      }
      const { error } = await (await import('@/lib/supabase')).supabase.storage.from('artwork').remove([path]);
      if (error) {
        console.error('[QuoteItemsTable] Delete error', error);
        return;
      }
      // Optimistically remove from UI by clearing its url so filter/renderer hides it
      file.url = '';
      setLightboxSrc(null);
    } catch (e) {
      console.error('[QuoteItemsTable] Delete exception', e);
    }
  };

  const openLightbox = (url: string, name: string) => {
    console.debug("[QuoteItemsTable] openLightbox", { url, name });
    setLightboxSrc(url);
    setLightboxTitle(name);
    setIsLightboxOpen(true);
  };

  const handleRemoveIssue = (item: QuoteItem, issueId: string) => {
    const currentDetails = getGarmentDetails(item);
    
    // Remove the issue completely
    const updatedIssues = currentDetails.stockIssues.filter(issue => issue.id !== issueId);

    // Update garment details
    const updatedDetails: GarmentDetails = {
      ...currentDetails,
      stockIssues: updatedIssues,
      // If no more issues and status is stock_issue, change to ready
      status: updatedIssues.length === 0 && currentDetails.status === 'stock_issue' 
        ? 'ready' 
        : currentDetails.status,
      statusHistory: [...currentDetails.statusHistory, {
        id: `${item.id}-${Date.now()}`,
        status: updatedIssues.length === 0 && currentDetails.status === 'stock_issue' 
          ? 'ready' 
          : currentDetails.status,
        timestamp: new Date(),
        notes: `Issue ${issueId} removed`
      }],
      lastUpdated: new Date()
    };

    // Update state
    const updatedDetailsMap = {
      ...garmentDetailsMap,
      [item.id]: updatedDetails
    };

    setGarmentDetailsMap(updatedDetailsMap);
    saveGarmentDetails(updatedDetailsMap);

    toast({
      title: "Issue Removed",
      description: "Stock issue has been removed",
    });
  };
  const renderItemGroup = (group: ItemGroup, groupIndex: number) => {
    const rawImprints = group.imprints || [];
    const visibleImprints = rawImprints.filter((imp: any) => {
      const hasText = (imp?.method && String(imp.method).trim() !== '') || (imp?.location && String(imp.location).trim() !== '');
      const fileCount = (imp?.customerArt?.length || 0) + (imp?.productionFiles?.length || 0) + (imp?.proofMockup?.length || 0);
      const hasNotes = !!(imp?.notes && String(imp.notes).trim() !== '');
      const keep = hasText || fileCount > 0 || hasNotes;
      if (!keep) {
        console.debug('[QuoteItemsTable] filtering blank imprint card', { imprintId: imp?.id, method: imp?.method, location: imp?.location, fileCount, hasNotes });
      }
      return keep;
    });
    if (rawImprints.length > 0) {
      console.debug('[QuoteItemsTable] group imprints', { groupIndex, total: rawImprints.length, visible: visibleImprints.length, ids: rawImprints.map((i: any) => i?.id) });
    }
    return (
      <div key={group.id} className="mb-8 border rounded-md overflow-hidden">
        {/* Group Title */}
        {itemGroups.length > 1 && (
          <div className="bg-blue-50 px-4 py-2 border-b">
            <h4 className="font-medium text-blue-900">Group {groupIndex + 1}</h4>
          </div>
        )}
        <Table className="w-full table-fixed">
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead className="py-2 text-xs uppercase w-[8%]">Category</TableHead>
              <TableHead className="py-2 text-xs uppercase w-[6%]">Item#</TableHead>
              <TableHead className="py-2 text-xs uppercase w-[6%]">Color</TableHead>
              <TableHead className="py-2 text-xs uppercase w-[15%]">Description</TableHead>
              <TableHead className="py-2 text-xs uppercase text-center w-[4%]">XS</TableHead>
              <TableHead className="py-2 text-xs uppercase text-center w-[4%]">S</TableHead>
              <TableHead className="py-2 text-xs uppercase text-center w-[4%]">M</TableHead>
              <TableHead className="py-2 text-xs uppercase text-center w-[4%]">L</TableHead>
              <TableHead className="py-2 text-xs uppercase text-center w-[4%]">XL</TableHead>
              <TableHead className="py-2 text-xs uppercase text-center w-[4%]">2XL</TableHead>
              <TableHead className="py-2 text-xs uppercase text-center w-[4%]">3XL</TableHead>
              <TableHead className="py-2 text-xs uppercase text-center w-[4%]">QTY</TableHead>
              <TableHead className="py-2 text-xs uppercase text-center w-[5%]">Price</TableHead>
              <TableHead className="py-2 text-xs uppercase text-center w-[5%]">Taxed</TableHead>
              <TableHead className="py-2 text-xs uppercase text-center w-[6%]">Total</TableHead>
              <TableHead className="py-2 text-xs uppercase w-[12%]">Garment Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {group.items.flatMap((item, itemIndex) => {
              const garmentDetails = getGarmentDetails(item);
              const totalQuantity = getTotalQuantity(item.sizes);
              
              const rows = [
                  <TableRow key={`${group.id}-item-${itemIndex}`} className="border-b hover:bg-gray-50">
                    <TableCell className="p-2 border-r border-gray-200">
                      <div className="text-sm">{item.category}</div>
                    </TableCell>
                    <TableCell className="p-2 border-r border-gray-200">
                      <div className="text-sm">{item.itemNumber}</div>
                    </TableCell>
                    <TableCell className="p-2 border-r border-gray-200">
                      <div className="text-sm">{item.color}</div>
                    </TableCell>
                    <TableCell className="p-2 border-r border-gray-200">
                      <div className="text-sm">{item.description}</div>
                    </TableCell>
                    <TableCell className="p-2 text-center border-r border-gray-200">
                      <div className="text-sm">{item.sizes.xs || 0}</div>
                    </TableCell>
                    <TableCell className="p-2 text-center border-r border-gray-200">
                      <div className="text-sm">{item.sizes.s || 0}</div>
                    </TableCell>
                    <TableCell className="p-2 text-center border-r border-gray-200">
                      <div className="text-sm">{item.sizes.m || 0}</div>
                    </TableCell>
                    <TableCell className="p-2 text-center border-r border-gray-200">
                      <div className="text-sm">{item.sizes.l || 0}</div>
                    </TableCell>
                    <TableCell className="p-2 text-center border-r border-gray-200">
                      <div className="text-sm">{item.sizes.xl || 0}</div>
                    </TableCell>
                    <TableCell className="p-2 text-center border-r border-gray-200">
                      <div className="text-sm">{item.sizes.xxl || 0}</div>
                    </TableCell>
                    <TableCell className="p-2 text-center border-r border-gray-200">
                      <div className="text-sm">{item.sizes.xxxl || 0}</div>
                    </TableCell>
                    <TableCell className="p-2 text-center border-r border-gray-200">
                      <div className="text-sm">{totalQuantity}</div>
                    </TableCell>
                    <TableCell className="p-2 border-r border-gray-200">
                      <div className="text-sm">${typeof item.price === 'number' ? item.price.toFixed(2) : parseFloat(item.price.toString().replace(/[$,]/g, '')).toFixed(2)}</div>
                    </TableCell>
                    <TableCell className="p-2 text-center border-r border-gray-200">
                      <div className="text-sm">{item.taxed ? '✓' : ''}</div>
                    </TableCell>
                    <TableCell className="p-2 border-r border-gray-200">
                      <div className="text-sm font-medium">${typeof item.total === 'number' ? item.total.toFixed(2) : parseFloat(item.total.toString().replace(/[$,]/g, '')).toFixed(2)}</div>
                    </TableCell>
                    <TableCell className="p-2">
                      <div className="flex flex-col gap-1">
                        <GarmentStatusDropdown
                          garmentDetails={garmentDetails}
                          onStatusChange={(status, notes) => handleStatusChange(item, status, notes)}
                          onReportIssue={() => handleReportIssue(item)}
                        />
                        {totalQuantity > 0 && garmentDetails.receivedQuantity !== garmentDetails.expectedQuantity && (
                          <div className="text-xs text-muted-foreground">
                            {garmentDetails.receivedQuantity}/{garmentDetails.expectedQuantity} received
                          </div>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
              ];
              
              if (getGarmentDetails(item).stockIssues.length > 0) {
                rows.push(
                  <TableRow key={`${group.id}-item-${itemIndex}-details`} className="border-b hover:bg-gray-50">
                    <TableCell colSpan={15} className="p-2 bg-gray-50">
                      <div className="space-y-4">
                        <GarmentIssuesList 
                          issues={getGarmentDetails(item).stockIssues}
                          onResolveIssue={(issueId) => handleResolveIssue(item, issueId)}
                          onRemoveIssue={(issueId) => handleRemoveIssue(item, issueId)}
                          showResolved={true}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              }
              
              return rows;
            })}

            {visibleImprints.length > 0 && (
              <TableRow className="border-b">
                <TableCell colSpan={16} className="p-6 bg-gray-50">
                  <div className="space-y-6">
                    <div className="border-b pb-4">
                      <h3 className="text-lg font-semibold text-gray-900">Imprint Details</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                        {visibleImprints.map((imprint) => (
                          <div key={imprint.id} className="border rounded-md p-3 bg-white">
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <span className="font-medium">Method:</span> {imprint.method || '—'}
                              </div>
                              <div>
                                <span className="font-medium">Location:</span> {imprint.location || '—'}
                              </div>
                              <div>
                                <span className="font-medium">Size:</span> {(imprint.width || 0) > 0 || (imprint.height || 0) > 0 ? `${imprint.width}" × ${imprint.height}"` : '—'}
                              </div>
                              {imprint.colorsOrThreads && (
                                <div>
                                  <span className="font-medium">Colors/Threads:</span> {imprint.colorsOrThreads}
                                </div>
                              )}
                            </div>
                            {imprint.notes && (
                              <div className="mt-2 text-sm">
                                <span className="font-medium">Notes:</span> {imprint.notes}
                              </div>
                            )}

                            {/* Customer Art */}
                            {imprint.customerArt && imprint.customerArt.length > 0 && (
                              <div className="mt-2">
                                <span className="font-medium text-sm">Customer Art:</span>
                                <div className="flex flex-wrap gap-2 mt-1">
                                  {imprint.customerArt.map((f: any, idx: number) => {
                                    const src = resolveFileUrl(f);
                                    const name = resolveFileName(f, `img-${idx}`);
                                    return (
                                      <div key={`ca-${imprint.id}-${idx}`} className="w-16 h-16 border rounded-md overflow-hidden flex items-center justify-center bg-white relative group">
                                        {src ? (
                                          <>
                                            <img src={src} alt={name} className="w-full h-full object-cover cursor-pointer" onClick={() => openLightbox(src, name)} />
                                            <button className="absolute top-0 right-0 m-0.5 px-1 text-[10px] bg-red-600 text-white rounded opacity-0 group-hover:opacity-100" onClick={(e)=>{e.stopPropagation(); handleDeleteArtwork(f);}}>✕</button>
                                          </>
                                        ) : (
                                          <span className="text-xs">{(name || 'file').split('.').pop()?.toUpperCase()}</span>
                                      )}
                                    </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {/* Production Files */}
                            {imprint.productionFiles && imprint.productionFiles.length > 0 && (
                              <div className="mt-2">
                                <span className="font-medium text-sm">Production Files:</span>
                                <div className="flex flex-wrap gap-2 mt-1">
                                  {imprint.productionFiles.map((f: any, idx: number) => {
                                    const src = resolveFileUrl(f);
                                    const name = resolveFileName(f, `prod-${idx}`);
                                    return (
                                      <div key={`pf-${imprint.id}-${idx}`} className="w-16 h-16 border rounded-md overflow-hidden flex items-center justify-center bg-white relative group">
                                        {src ? (
                                          <>
                                            <img src={src} alt={name} className="w-full h-full object-cover cursor-pointer" onClick={() => openLightbox(src, name)} />
                                            <button className="absolute top-0 right-0 m-0.5 px-1 text-[10px] bg-red-600 text-white rounded opacity-0 group-hover:opacity-100" onClick={(e)=>{e.stopPropagation(); handleDeleteArtwork(f);}}>✕</button>
                                          </>
                                        ) : (
                                          <span className="text-xs">{(name || 'file').split('.').pop()?.toUpperCase()}</span>
                                      )}
                                    </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {/* Proof/Mockup */}
                            {imprint.proofMockup && imprint.proofMockup.length > 0 && (
                              <div className="mt-2">
                                <span className="font-medium text-sm">Proof/Mockup:</span>
                                <div className="flex flex-wrap gap-2 mt-1">
                                  {imprint.proofMockup.map((f: any, idx: number) => {
                                    const src = resolveFileUrl(f);
                                    const name = resolveFileName(f, `mock-${idx}`);
                                    return (
                                      <div key={`pm-${imprint.id}-${idx}`} className="w-16 h-16 border rounded-md overflow-hidden flex items-center justify-center bg-white relative group">
                                        {src ? (
                                          <>
                                            <img src={src} alt={name} className="w-full h-full object-cover cursor-pointer" onClick={() => openLightbox(src, name)} />
                                            <button className="absolute top-0 right-0 m-0.5 px-1 text-[10px] bg-red-600 text-white rounded opacity-0 group-hover:opacity-100" onClick={(e)=>{e.stopPropagation(); handleDeleteArtwork(f);}}>✕</button>
                                          </>
                                        ) : (
                                          <span className="text-xs">{(name || 'file').split('.').pop()?.toUpperCase()}</span>
                                      )}
                                    </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            )}

            {/* Note: second, aggregated imprint block removed to keep correct order: 
                item rows → per-item mockups → group imprint details → next group. */}

          </TableBody>
        </Table>
      </div>
    );
  };

  return (
    <div className="space-y-2">
      <h3 className="text-base font-medium">Quote Items</h3>
      {itemGroups.map((group, groupIndex) => renderItemGroup(group, groupIndex))}
      
      <StockIssueDialog
        open={issueDialogOpen}
        onOpenChange={setIssueDialogOpen}
        onSubmit={handleIssueSubmit}
        maxQuantity={selectedItem ? getTotalQuantity(selectedItem.sizes) : 1}
      />
      {/* Lightbox Modal */}
      <Dialog open={isLightboxOpen} onOpenChange={setIsLightboxOpen}>
        <DialogContent className="max-w-3xl">
          <DialogTitle>{lightboxTitle}</DialogTitle>
          {lightboxSrc && (
            <div className="w-full">
              <img src={lightboxSrc} alt={lightboxTitle} className="w-full h-auto object-contain" />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}