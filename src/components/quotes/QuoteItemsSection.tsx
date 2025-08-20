import React, { useState, forwardRef, useImperativeHandle, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  updateItemGroupsInDraft,
  clearQuoteDraft,
  type StoredQuoteImage 
} from '@/utils/quoteStorage';
import { Plus, MoreHorizontal, Trash2, Copy, Image, X, Upload } from "lucide-react";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger } from "@/components/ui/dropdown-menu";
import { supabase } from "@/lib/supabase";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import LibrarySelectorDialog from '@/components/artwork/LibrarySelectorDialog';

interface ItemMockup {
  id: string;
  name: string;
  url: string;
  type: string;
}

interface ItemImprint {
  id: string;
  method: string;
  location: string;
  width: number;
  height: number;
  colorsOrThreads: string;
  notes: string;
  itemId: string; // client-side item id this imprint belongs to
  libraryImprintId?: string;
  customerArt: File[];
  productionFiles: File[];
  proofMockup: File[];
}

interface QuoteItem {
  id: string;
  category: string;
  itemNumber: string;
  color: string;
  description: string;
  imprintMethod?: string;
  decorationCode?: string;
  sizes: {
    xs: number;
    s: number;
    m: number;
    l: number;
    xl: number;
    xxl: number;
    xxxl: number;
  };
  quantity: number;
  unitPrice: number;
  taxed: boolean;
  total: number;
  mockups: ItemMockup[];
}

interface ItemGroup {
  id: string;
  items: QuoteItem[];
  imprints: ItemImprint[];
}

interface QuoteItemsSectionProps {
  quoteData?: any;
}

export interface QuoteItemsSectionRef {
  getCurrentItemGroups: () => ItemGroup[];
}

const PRODUCT_CATEGORIES = [
  "T-Shirts",
  "Polo Shirts", 
  "Hoodies",
  "Sweatshirts",
  "Tank Tops",
  "Long Sleeve Shirts",
  "Jackets",
  "Hats",
  "Bags",
  "Other"
];

export const QuoteItemsSection = forwardRef<QuoteItemsSectionRef, QuoteItemsSectionProps>(
  ({ quoteData }, ref) => {
    const [itemGroups, setItemGroups] = useState<ItemGroup[]>([
      {
        id: 'group-1',
        items: [
          {
            id: 'item-1',
            category: 'T-Shirts',
            itemNumber: 'ITEM-001',
            color: 'Black',
            description: 'Custom T-Shirt',
            sizes: { xs: 0, s: 0, m: 1, l: 0, xl: 0, xxl: 0, xxxl: 0 },
            quantity: 1,
            unitPrice: 20.00,
            taxed: true,
            total: 20.00,
            mockups: []
          }
        ],
        imprints: []
      }
    ]);

    // Track the currently active group (last interacted with)
    const [activeGroupId, setActiveGroupId] = useState<string>("group-1");

    useEffect(() => {
      // Initialize to first group's id on mount
      if (itemGroups[0] && !activeGroupId) {
        setActiveGroupId(itemGroups[0].id);
      }
    }, []);

    // Add state for imprint dialog
    const [imprintDialogOpen, setImprintDialogOpen] = useState(false);
    const [selectedItemId, setSelectedItemId] = useState<string>('');
    const [selectedGroupId, setSelectedGroupId] = useState<string>('');
    const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
    const [proofMockupFile, setProofMockupFile] = useState<File | null>(null);
    const [libraryOpen, setLibraryOpen] = useState(false);
    const [imprintData, setImprintData] = useState<Partial<ItemImprint>>({
      method: '',
      location: '',
      width: 0,
      height: 0,
      colorsOrThreads: '',
      notes: ''
    });

    // Debug logging in useEffect to prevent infinite re-renders

    // Production config for method/decoration selection
    const [prodConfig, setProdConfig] = useState<Record<string, { label: string; decorations: { code: string; label: string }[] }>>({});
    useEffect(() => {
      const loadConfig = async () => {
        try {
          const { data, error } = await supabase.rpc('get_production_config');
          if (!error && Array.isArray(data)) {
            const mapped: Record<string, { label: string; decorations: { code: string; label: string }[] }> = {} as any;
            (data as any[]).forEach((m: any) => {
              mapped[m.method_code] = {
                label: m.display_name,
                decorations: (m.decorations || []).map((d: any) => ({ code: d.decoration_code || 'standard', label: d.display_name })),
              };
            });
            setProdConfig(mapped);
          }
        } catch {}
      };
      loadConfig();
    }, []);
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
    
    // Save to localStorage whenever itemGroups change
    useEffect(() => {
      updateItemGroupsInDraft(itemGroups);
    }, [itemGroups]);

    // Clear localStorage when starting a new quote (component mounts)
    useEffect(() => {
      // Only clear if we're on the new quote page (not editing)
      // But delay clearing to avoid race conditions
      if (window.location.pathname === '/quotes/new') {
        setTimeout(() => {
          clearQuoteDraft();
        }, 500);
      }
    }, []); // Run only once on mount
    


    // Calculate totals for each item
    const calculateItemTotal = (item: QuoteItem) => {
      const totalQuantity = Object.values(item.sizes).reduce((sum, qty) => sum + qty, 0);
      return totalQuantity * item.unitPrice;
    };

    // Calculate total quantity for an item
    const calculateItemQuantity = (item: QuoteItem) => {
      return Object.values(item.sizes).reduce((sum, qty) => sum + qty, 0);
    };

    // Update item when any field changes
    const updateItem = (groupId: string, itemId: string, updates: Partial<QuoteItem>) => {

      
      // Mark this group as active for contextual add buttons
      setActiveGroupId(groupId);
      setItemGroups(prev => {
        const updated = prev.map(group => {
          if (group.id === groupId) {
        return {
              ...group,
              items: group.items.map(item => {
                if (item.id === itemId) {
                  
                  const updatedItem = { ...item, ...updates };
                  
                  // Recalculate total when sizes or price changes
                  if (updates.sizes || updates.unitPrice) {
                    updatedItem.total = calculateItemTotal(updatedItem);
                    updatedItem.quantity = calculateItemQuantity(updatedItem);
                  }
                  

                  
                  return updatedItem;
                }
                return item;
              })
            };
          }
          return group;
        });
        

        return updated;
      });
    };

    // Update size quantity
    const updateSizeQuantity = (groupId: string, itemId: string, size: keyof QuoteItem['sizes'], value: number) => {

      // Mark this group as active for contextual add buttons
      setActiveGroupId(groupId);
      updateItem(groupId, itemId, {
        sizes: {
          ...itemGroups.find(g => g.id === groupId)?.items.find(i => i.id === itemId)?.sizes!,
          [size]: value
        }
      });
    };



    // Get first available item ID for a group
    const getFirstItemId = (groupId: string) => {
      const group = itemGroups.find(g => g.id === groupId);
      return group?.items[0]?.id || '';
    };

    // Add new imprint to existing item
    const addImprint = (groupId: string, itemId: string) => {


      
      // If no specific item is selected, use the first available item in the group
      let targetItemId = itemId;
      if (!targetItemId && groupId) {
        const firstItem = itemGroups.find(g => g.id === groupId)?.items[0];
        if (firstItem) {
          targetItemId = firstItem.id;

        }
      }
      
      if (!targetItemId) {
        console.error('🔍 [ERROR] QuoteItemsSection - No item available for imprint');
        return;
      }
      

      setSelectedGroupId(groupId);
      setSelectedItemId(targetItemId);
      setImprintDialogOpen(true);
      setUploadedFiles([]);
      setProofMockupFile(null);
      
      
      
      // Verify the item exists
      const targetItem = itemGroups.find(g => g.id === groupId)?.items.find(i => i.id === targetItemId);

    };

    // Handle customer art upload
    const handleCustomerArtUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files || []);
      // No localStorage; keep in memory for preview until quote is saved
      setUploadedFiles(prev => [...prev, ...files]);
    };

    // Handle production files upload
    const handleProductionFilesUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files || []);
      setUploadedFiles(prev => [...prev, ...files]);
    };

    // Handle proof/mockup file upload
    const handleProofMockupUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        setProofMockupFile(file);
      }
    };

    // Handle imprint dialog close
    const handleImprintDialogClose = () => {

      
      setImprintDialogOpen(false);
      setSelectedItemId('');
      setSelectedGroupId('');
      setUploadedFiles([]);
      setProofMockupFile(null);
      setImprintData({
        method: '',
        location: '',
        width: 0,
        height: 0,
        colorsOrThreads: '',
        notes: ''
      });
      

    };

    // Handle imprint save
    const handleImprintSave = async () => {

      
      // Create new imprint with the collected data
      const newImprint: ItemImprint = {
        id: `imprint-${Date.now()}`,
        method: imprintData.method || '',
        location: imprintData.location || '',
        width: imprintData.width || 0,
        height: imprintData.height || 0,
        colorsOrThreads: imprintData.colorsOrThreads || '',
        notes: imprintData.notes || '',
        itemId: selectedItemId,
        customerArt: uploadedFiles.filter(f => f.type.startsWith('image/')),
        productionFiles: uploadedFiles.filter(f => !f.type.startsWith('image/')),
        proofMockup: proofMockupFile ? [proofMockupFile] : []
      };
      console.debug('[QuoteItemsSection] handleImprintSave newImprint', {
        groupId: selectedGroupId,
        itemId: selectedItemId,
        method: newImprint.method,
        location: newImprint.location,
        ca: newImprint.customerArt.length,
        pf: newImprint.productionFiles.length,
        pm: newImprint.proofMockup.length,
      });

      // If an imprint from Library was already added for the same item/method/location
      // and there are no newly uploaded files, avoid overwriting it with an empty one.
      const hasNewFiles = uploadedFiles.length > 0 || !!proofMockupFile;
      let didMergeExisting = false;

      setItemGroups(prev => prev.map(group => {
        if (group.id !== selectedGroupId) return group;
        const existingIndexExact = group.imprints.findIndex(imp => imp.itemId === selectedItemId && imp.method === newImprint.method && imp.location === newImprint.location);
        let existingIndex = existingIndexExact;
        if (existingIndex < 0) {
          // fallback: match by method only (merge dialog changes into library-imprint with empty location)
          existingIndex = group.imprints.findIndex(imp => imp.itemId === selectedItemId && imp.method === newImprint.method);
          if (existingIndex >= 0) {
            console.debug('[QuoteItemsSection] handleImprintSave merging by method-only (location changed)', { prevLocation: (group.imprints[existingIndex] as any)?.location, newLocation: newImprint.location });
          }
        }
        if (existingIndex >= 0) {
          const existing = group.imprints[existingIndex] as any;
          const hasFieldChanges = (
            (newImprint.location && newImprint.location !== existing.location) ||
            (newImprint.width && newImprint.width !== existing.width) ||
            (newImprint.height && newImprint.height !== existing.height) ||
            (newImprint.notes && newImprint.notes !== existing.notes) ||
            (newImprint.colorsOrThreads && newImprint.colorsOrThreads !== existing.colorsOrThreads)
          );
          if (!hasNewFiles && !hasFieldChanges && !(existing as any).libraryImprintId) {
            // Nothing meaningful to merge
            didMergeExisting = true;
            console.debug('[QuoteItemsSection] handleImprintSave skip overwrite existing library imprint');
            return group;
          }
          // Merge with existing: append new files, update editable fields
          const merged = {
            ...existing,
            width: newImprint.width || existing.width,
            height: newImprint.height || existing.height,
            // If user set a location, prefer it
            location: newImprint.location || existing.location,
            colorsOrThreads: newImprint.colorsOrThreads || existing.colorsOrThreads,
            notes: newImprint.notes || existing.notes,
            customerArt: [...(existing.customerArt || []), ...newImprint.customerArt],
            productionFiles: [...(existing.productionFiles || []), ...newImprint.productionFiles],
            proofMockup: [...(existing.proofMockup || []), ...newImprint.proofMockup],
          } as ItemImprint;
          console.debug('[QuoteItemsSection] handleImprintSave merged imprint', {
            id: existing.id,
            ca: merged.customerArt.length,
            pf: merged.productionFiles.length,
            pm: merged.proofMockup.length,
          });
          const updatedImprints = [...group.imprints];
          updatedImprints[existingIndex] = merged;
          didMergeExisting = true;
          return { ...group, imprints: updatedImprints };
        }
        return group;
      }));

      if (didMergeExisting) {
        handleImprintDialogClose();
        return;
      }

      // Enforce per-item imprint uniqueness within group (method+location per item)
      setItemGroups(prev => prev.map(group => {
        if (group.id === selectedGroupId) {
          const filtered = group.imprints.filter(imp => !(imp.itemId === selectedItemId && imp.method === newImprint.method && imp.location === newImprint.location));
          return {
            ...group,
            imprints: [...filtered, newImprint]
          };
        }
        return group;
      }));

      // Also add mockups to the selected item if proof/mockup files exist
      if (proofMockupFile || uploadedFiles.some(f => f.type.startsWith('image/'))) {
        const newMockups: ItemMockup[] = [];
        
        // Add image files as mockups
        uploadedFiles.forEach((file, index) => {
          if (file.type.startsWith('image/')) {
            const mockup = {
              id: `mockup-${Date.now()}-${index}`,
        name: file.name,
        url: URL.createObjectURL(file),
        type: file.type
            };
            newMockups.push(mockup);
          }
        });
        
        // Add proof/mockup file if exists
        if (proofMockupFile) {
          const proofMockup = {
            id: `proof-mockup-${Date.now()}`,
            name: proofMockupFile.name,
            url: URL.createObjectURL(proofMockupFile),
            type: proofMockupFile.type
          };
          newMockups.push(proofMockup);
        }

        // Find current item to get existing mockups
        const currentItem = itemGroups.find(g => g.id === selectedGroupId)?.items.find(i => i.id === selectedItemId);
        
        if (currentItem && newMockups.length > 0) {
          const updatedMockups = [...(currentItem.mockups || []), ...newMockups];
          updateItem(selectedGroupId, selectedItemId, {
            mockups: updatedMockups
          });
        }
      }
      
      handleImprintDialogClose();
    };

    // Duplicate an item
    const duplicateItem = (groupId: string, itemId: string) => {

      const originalItem = itemGroups.find(g => g.id === groupId)?.items.find(i => i.id === itemId);
      if (originalItem) {
        const newItem = {
          ...originalItem,
          id: `item-${Date.now()}`,
          itemNumber: `${originalItem.itemNumber}-copy`
        };
        
        setItemGroups(prev => prev.map(group => {
          if (group.id === groupId) {
            return {
              ...group,
              items: [...group.items, newItem]
            };
          }
          return group;
        }));
      }
    };

    // Delete an item
    const deleteItem = (groupId: string, itemId: string) => {
      setItemGroups(prev => {
        const updatedGroups = prev.map(group => {
          if (group.id === groupId) {
            return {
              ...group,
              items: group.items.filter(item => item.id !== itemId)
            };
          }
          return group;
        });

        // If a group becomes empty and there are multiple groups, remove the empty group
        // But keep at least one group
        if (updatedGroups.length > 1) {
          return updatedGroups.filter(group => group.items.length > 0);
        }
        
        return updatedGroups;
      });
    };

    // Add new line item group
    const addLineItemGroup = () => {
      const groupNumber = itemGroups.length + 1;
      const newGroup: ItemGroup = {
        id: `group-${Date.now()}`,
        items: [
          {
            id: `item-${Date.now()}`,
            category: 'T-Shirts',
            itemNumber: `ITEM-${String(groupNumber).padStart(3, '0')}`,
            color: 'Black',
            description: 'Custom Item',
            sizes: { xs: 0, s: 0, m: 1, l: 0, xl: 0, xxl: 0, xxxl: 0 },
            quantity: 1,
            unitPrice: 20.00,
            taxed: true,
            total: 20.00,
            mockups: []
          }
        ],
        imprints: []
      };
      setItemGroups([...itemGroups, newGroup]);
    };

    // Add new line item to existing group
    const addLineItem = (groupId: string) => {
      const targetGroup = itemGroups.find(g => g.id === groupId);
      if (!targetGroup) return;
      
      const itemNumber = targetGroup.items.length + 1;
      const newItem: QuoteItem = {
        id: `item-${Date.now()}`,
        category: 'T-Shirts',
        itemNumber: `ITEM-${String(itemNumber).padStart(3, '0')}`,
        color: 'Black',
        description: 'Custom Item',
        sizes: { xs: 0, s: 0, m: 1, l: 0, xl: 0, xxl: 0, xxxl: 0 },
        quantity: 1,
        unitPrice: 20.00,
        taxed: true,
        total: 20.00,
        mockups: []
      };

      setItemGroups(itemGroups.map(group => 
        group.id === groupId 
          ? { ...group, items: [...group.items, newItem] }
          : group
      ));
    };

    // Calculate subtotal for all items
    const calculateSubtotal = () => {
      return itemGroups.reduce((total, group) => {
        return total + group.items.reduce((groupTotal, item) => {
          return groupTotal + item.total;
        }, 0);
      }, 0);
    };

    // Expose methods to parent component
    useImperativeHandle(ref, () => ({
      getCurrentItemGroups: () => itemGroups,
    }));

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-medium">Quote Items</h3>
        </div>

        {/* Quote Items Table */}
        <div className="border rounded-lg overflow-hidden">
          <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
                <TableHead className="font-medium text-gray-900">CATEGORY</TableHead>
                <TableHead className="font-medium text-gray-900">ITEM#</TableHead>
                <TableHead className="font-medium text-gray-900">COLOR</TableHead>
                <TableHead className="font-medium text-gray-900">DESCRIPTION</TableHead>
                <TableHead className="font-medium text-gray-900 text-center">XS</TableHead>
                <TableHead className="font-medium text-gray-900 text-center">S</TableHead>
                <TableHead className="font-medium text-gray-900 text-center">M</TableHead>
                <TableHead className="font-medium text-gray-900 text-center">L</TableHead>
                <TableHead className="font-medium text-gray-900 text-center">XL</TableHead>
                <TableHead className="font-medium text-gray-900 text-center">2XL</TableHead>
                <TableHead className="font-medium text-gray-900 text-center">3XL</TableHead>
                <TableHead className="font-medium text-gray-900">PRICE</TableHead>
                <TableHead className="font-medium text-gray-900 text-center">TAXED</TableHead>
                <TableHead className="font-medium text-gray-900">TOTAL</TableHead>
                <TableHead className="font-medium text-gray-900"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
              {itemGroups.map((group) => [
                // Group Items
                ...group.items.map((item) => (
                  <TableRow key={item.id} className="border-b hover:bg-gray-50">
                    {/* Category */}
                    <TableCell>
                      <Select 
                        value={item.category} 
                        onValueChange={(value) => updateItem(group.id, item.id, { category: value })}
                      >
                        <SelectTrigger className="w-full border-0 shadow-none">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          {PRODUCT_CATEGORIES.map(category => (
                            <SelectItem key={category} value={category}>
                              {category}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>

                    {/* Item Number */}
                    <TableCell>
                      <Input 
                        value={item.itemNumber}
                        onChange={(e) => updateItem(group.id, item.id, { itemNumber: e.target.value })}
                        placeholder="Item #"
                        className="w-full border-0 shadow-none"
                      />
                    </TableCell>

                    {/* Color */}
                    <TableCell>
                      <Input 
                        value={item.color}
                        onChange={(e) => updateItem(group.id, item.id, { color: e.target.value })}
                        placeholder="Color"
                        className="w-full border-0 shadow-none"
                      />
                    </TableCell>

                    {/* Description */}
                    <TableCell>
                      <Input
                        value={item.description}
                        onChange={(e) => updateItem(group.id, item.id, { description: e.target.value })}
                        placeholder="Description"
                        className="w-full border-0 shadow-none"
                      />
                    </TableCell>

                    {/* Method / Decoration (inline selectors, compact; no layout change beyond cell content) */}
                    <TableCell colSpan={1}>
                      <div className="flex items-center gap-2">
                        <Select
                          value={item.imprintMethod || ''}
                          onValueChange={(value) => updateItem(group.id, item.id, { imprintMethod: value, decorationCode: '' })}
                        >
                          <SelectTrigger className="w-40 border-0 shadow-none">
                            <SelectValue placeholder="Method" />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(prodConfig).map(([code, m]) => (
                              <SelectItem key={code} value={code}>{m.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select
                          value={item.decorationCode || ''}
                          onValueChange={(value) => updateItem(group.id, item.id, { decorationCode: value })}
                          disabled={!item.imprintMethod}
                        >
                          <SelectTrigger className="w-44 border-0 shadow-none">
                            <SelectValue placeholder="Decoration" />
                          </SelectTrigger>
                          <SelectContent>
                            {(item.imprintMethod && prodConfig[item.imprintMethod]?.decorations || []).map((d) => (
                              <SelectItem key={d.code} value={d.code}>{d.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </TableCell>

                    {/* Size Quantities */}
                    <TableCell>
                      <Input 
                        type="number" 
                        value={item.sizes.xs}
                        onChange={(e) => updateSizeQuantity(group.id, item.id, 'xs', parseInt(e.target.value) || 0)}
                        className="w-16 text-center border-0 shadow-none"
                        min="0"
                      />
                    </TableCell>
                    <TableCell>
                      <Input 
                        type="number" 
                        value={item.sizes.s}
                        onChange={(e) => updateSizeQuantity(group.id, item.id, 's', parseInt(e.target.value) || 0)}
                        className="w-16 text-center border-0 shadow-none"
                        min="0"
                      />
                    </TableCell>
                    <TableCell>
                      <Input 
                        type="number" 
                        value={item.sizes.m}
                        onChange={(e) => updateSizeQuantity(group.id, item.id, 'm', parseInt(e.target.value) || 0)}
                        className="w-16 text-center border-0 shadow-none"
                        min="0"
                      />
                    </TableCell>
                    <TableCell>
                      <Input 
                        type="number" 
                        value={item.sizes.l}
                        onChange={(e) => updateSizeQuantity(group.id, item.id, 'l', parseInt(e.target.value) || 0)}
                        className="w-16 text-center border-0 shadow-none"
                        min="0"
                      />
                    </TableCell>
                    <TableCell>
                      <Input 
                        type="number" 
                        value={item.sizes.xl}
                        onChange={(e) => updateSizeQuantity(group.id, item.id, 'xl', parseInt(e.target.value) || 0)}
                        className="w-16 text-center border-0 shadow-none"
                        min="0"
                      />
                    </TableCell>
                    <TableCell>
                      <Input 
                        type="number" 
                        value={item.sizes.xxl}
                        onChange={(e) => updateSizeQuantity(group.id, item.id, 'xxl', parseInt(e.target.value) || 0)}
                        className="w-16 text-center border-0 shadow-none"
                        min="0"
                      />
                    </TableCell>
                    <TableCell>
                      <Input 
                        type="number" 
                        value={item.sizes.xxxl}
                        onChange={(e) => updateSizeQuantity(group.id, item.id, 'xxxl', parseInt(e.target.value) || 0)}
                        className="w-16 text-center border-0 shadow-none"
                        min="0"
                      />
                    </TableCell>

                    {/* Price */}
                    <TableCell>
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                        <Input 
                          type="number"
                          value={item.unitPrice}
                          onChange={(e) => updateItem(group.id, item.id, { unitPrice: parseFloat(e.target.value) || 0 })}
                          className="w-20 pl-6 border-0 shadow-none"
                          min="0"
                          step="0.01"
                        />
                      </div>
                    </TableCell>

                    {/* Taxed */}
                    <TableCell className="text-center">
                        <Checkbox
                          checked={item.taxed}
                        onCheckedChange={(checked) => updateItem(group.id, item.id, { taxed: checked as boolean })}
                        className="mx-auto"
                        />
                    </TableCell>

                    {/* Total */}
                    <TableCell className="font-medium">
                      ${item.total.toFixed(2)}
                    </TableCell>

                    {/* Actions */}
                    <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                          </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => addImprint(group.id, item.id)}>
                            <Image className="mr-2 h-4 w-4" />
                              Attach Mockups
                            </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => duplicateItem(group.id, item.id)}>
                            <Copy className="mr-2 h-4 w-4" />
                              Duplicate
                            </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => deleteItem(group.id, item.id)}
                            className="text-red-600"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
                // Group Imprints row directly under this group's items
                , (
                  group.imprints && group.imprints.length > 0 ? (
                    <TableRow key={`group-imprints-${group.id}`} className="border-b bg-slate-50">
                      <TableCell colSpan={14} className="p-4">
                  <div className="space-y-3">
                    <h4 className="font-medium text-sm">Imprint Details</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       {group.imprints.filter((imp) => {
                         const hasText = (imp?.method && String(imp.method).trim() !== '') || (imp?.location && String(imp.location).trim() !== '');
                         const fileCount = (imp?.customerArt?.length || 0) + (imp?.productionFiles?.length || 0) + (imp?.proofMockup?.length || 0);
                         const hasNotes = !!(imp?.notes && String(imp.notes).trim() !== '');
                         const keep = hasText || fileCount > 0 || hasNotes;
                         if (!keep) {
                           console.debug('[QuoteItemsSection] filter blank imprint in table', { id: imp?.id, method: imp?.method, location: imp?.location, fileCount, hasNotes });
                         }
                         return keep;
                       }).map((imprint) => (
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
                                      {imprint.customerArt.map((file: any, idx: number) => {
                                        const src = resolveFileUrl(file);
                                        const alt = resolveFileName(file, `img-${idx}`);
                                        return (
                                        <div key={`ca-${imprint.id}-${idx}`} className="w-16 h-16 border rounded-md overflow-hidden">
                                            {src ? (
                                              <img src={src} alt={alt} className="w-full h-full object-cover" onError={() => console.warn('[QuoteItemsSection] customerArt image error', { src, alt })} />
                                            ) : (
                                              <span className="text-xs">{(alt || 'FILE').split('.').pop()?.toUpperCase()}</span>
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
                                      {imprint.productionFiles.map((file: any, idx: number) => {
                                        const src = resolveFileUrl(file);
                                        const name = resolveFileName(file, `prod-${idx}`);
                                        const isImage = !!src && /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(name);
                                        if (isImage) {
                                          const alt = name || `prod-${idx}`;
                                          return (
                                            <div key={`pf-${imprint.id}-${idx}`} className="w-16 h-16 border rounded-md overflow-hidden">
                                              <img src={src!} alt={alt} className="w-full h-full object-cover" onError={() => console.warn('[QuoteItemsSection] productionFiles image error', { src, alt })} />
                                            </div>
                                          );
                                        }
                                        return (
                                        <div key={`pf-${imprint.id}-${idx}`} className="w-16 h-16 border rounded-md overflow-hidden flex items-center justify-center">
                                            <span className="text-xs">{(name || 'FILE').split('.').pop()?.toUpperCase()}</span>
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
                                      {imprint.proofMockup.map((file: any, idx: number) => {
                                        const src = resolveFileUrl(file);
                                        const alt = resolveFileName(file, `mock-${idx}`);
                                        return (
                                        <div key={`pm-${imprint.id}-${idx}`} className="w-16 h-16 border rounded-md overflow-hidden">
                                            {src ? (
                                              <img src={src} alt={alt} className="w-full h-full object-cover" onError={() => console.warn('[QuoteItemsSection] proofMockup image error', { src, alt })} />
                                            ) : (
                                              <span className="text-xs">{(alt || 'FILE').split('.').pop()?.toUpperCase()}</span>
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
                </TableCell>
              </TableRow>
                  ) : null
                )
              ].flat())}
          </TableBody>
        </Table>
        </div>
        {/* Removed global imprint list to prevent duplicate rendering. Imprints now render inline per group above. */}
        
        {/* Action Buttons under table: left (Line Item, Imprint), right (Line Item Group) */}
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => {
                const targetGroup = activeGroupId || itemGroups[0]?.id || "";
                if (targetGroup) addLineItem(targetGroup);
              }}
              disabled={itemGroups.length === 0}
            >
              <Plus className="h-4 w-4" />
              Line Item
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => {
                const targetGroup = activeGroupId || itemGroups[0]?.id || "";
                if (targetGroup) addImprint(targetGroup, getFirstItemId(targetGroup));
              }}
              disabled={itemGroups.length === 0}
            >
              <Plus className="h-4 w-4" />
              Imprint
            </Button>
          </div>
          <Button onClick={addLineItemGroup} variant="outline" className="gap-2">
            <Plus className="h-4 w-4" />
            Line Item Group
          </Button>
        </div>

        {itemGroups.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <p>No items added yet.</p>
            <Button onClick={addLineItemGroup} className="mt-4 gap-2">
            <Plus className="h-4 w-4" />
              Add First Item
            </Button>
                            </div>
                          )}
                          
        {/* Imprint Upload Dialog */}
        <Dialog open={imprintDialogOpen} onOpenChange={setImprintDialogOpen}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Image className="h-5 w-5" />
            Imprint
              </DialogTitle>
              <div className="flex items-center gap-2 ml-auto">
                <Button variant="outline" size="sm" className="gap-2" onClick={() => setLibraryOpen(true)}>
                  <Image className="h-4 w-4" />
                  Select from Library
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleImprintDialogClose}
                  className="h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
          </Button>
        </div>
            </DialogHeader>

            {/* Target selection for where to attach this imprint */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Attach to Group</label>
                  <Select
                    value={selectedGroupId}
                    onValueChange={(value) => {
                      setSelectedGroupId(value);
                      setActiveGroupId(value);
                      const first = getFirstItemId(value);
                      setSelectedItemId(first);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select group" />
                    </SelectTrigger>
                    <SelectContent>
                      {itemGroups.map((g, idx) => (
                        <SelectItem key={g.id} value={g.id}>Group {idx + 1}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Attach to Item</label>
                  <Select
                    value={selectedItemId}
                    onValueChange={(value) => setSelectedItemId(value)}
                    disabled={!selectedGroupId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select item" />
                    </SelectTrigger>
                    <SelectContent>
                      {(itemGroups.find(g => g.id === selectedGroupId)?.items || []).map((it) => (
                        <SelectItem key={it.id} value={it.id}>
                          {(it.itemNumber || 'Item')} — {(it.description || 'No description')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            
            <div className="space-y-6">
              {/* Imprint Details Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-sm">Imprint 1</h4>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-500 hover:text-red-700">
                    <Trash2 className="h-4 w-4" />
                  </Button>
      </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Method */}
    <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">
                      Method <span className="text-red-500">*</span>
                    </label>
                    <Select 
                      value={imprintData.method} 
                      onValueChange={(value) => setImprintData(prev => ({ ...prev, method: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select Imprint Method" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="screen_print">Screen Printing</SelectItem>
                        <SelectItem value="embroidery">Embroidery</SelectItem>
                        <SelectItem value="dtf">DTF</SelectItem>
                        <SelectItem value="dtg">DTG</SelectItem>
                      </SelectContent>
                    </Select>
                            </div>
                  
                  {/* Location */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">
                      Location <span className="text-red-500">*</span>
                    </label>
                    <Input 
                      placeholder="e.g., Front chest, Back, Left sleeve" 
                      className="w-full"
                      value={imprintData.location}
                      onChange={(e) => setImprintData(prev => ({ ...prev, location: e.target.value }))}
                    />
                                      </div>
                                  </div>
                
                <div className="grid grid-cols-2 gap-4">
                  {/* Width */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">
                      Width (in) <span className="text-red-500">*</span>
                    </label>
                    <Input 
                      type="number" 
                      placeholder="0.0" 
                      step="0.1" 
                      min="0"
                      className="w-full"
                      value={imprintData.width}
                      onChange={(e) => setImprintData(prev => ({ ...prev, width: parseFloat(e.target.value) || 0 }))}
                    />
                              </div>
                  
                  {/* Height */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">
                      Height (in) <span className="text-red-500">*</span>
                    </label>
                    <Input 
                      type="number" 
                      placeholder="0.0" 
                      step="0.1" 
                      min="0"
                      className="w-full"
                      value={imprintData.height}
                      onChange={(e) => setImprintData(prev => ({ ...prev, height: parseFloat(e.target.value) || 0 }))}
                    />
                            </div>
                        </div>
                
                {/* Colors or Threads */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">
                    Colors or Threads
                  </label>
                  <Input 
                    placeholder="e.g., Black, White, Navy Blue | Thread colors: 5563, 5606" 
                    className="w-full"
                    value={imprintData.colorsOrThreads}
                    onChange={(e) => setImprintData(prev => ({ ...prev, colorsOrThreads: e.target.value }))}
                  />
                    </div>
                
                {/* Notes */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">
                    Notes
                  </label>
                  <textarea 
                    placeholder="Additional details, special instructions..." 
                    className="w-full min-h-[80px] p-3 border border-gray-300 rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={imprintData.notes}
                    onChange={(e) => setImprintData(prev => ({ ...prev, notes: e.target.value }))}
                  />
                  </div>
                        </div>
              
              {/* Artwork Upload Sections */}
              <div className="space-y-4">
                <h4 className="font-medium text-sm">Artwork Upload</h4>
                
                {/* Upload 1: Customer Provided Art */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">
                    Upload 1: Customer Provided Art
                  </label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                    <Upload className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                    <input
                      id="customer-art-upload"
                      type="file"
                      multiple
                      accept=".jpg,.jpeg,.png,.pdf,.ai,.eps,.svg"
                      onChange={handleCustomerArtUpload}
                      className="hidden"
                    />
          <Button 
            variant="outline" 
                      size="sm" 
            className="gap-2"
                      onClick={() => document.getElementById('customer-art-upload')?.click()}
          >
                      <Upload className="h-4 w-4" />
                      Upload
        </Button>
                    {uploadedFiles.length > 0 && (
                      <div className="mt-2 text-sm text-green-600">
                        ✓ {uploadedFiles.length} file(s) selected
        </div>
                    )}
      </div>
      </div>
      
                {/* Upload 2: Production-Ready Files */}
    <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">
                    Upload 2: Production-Ready Files
                  </label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                    <Upload className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                    <input
                      id="production-files-upload"
                      type="file"
                      multiple
                      accept=".eps,.ai,.pdf,.png,.jpg,.jpeg"
                      onChange={handleProductionFilesUpload}
                      className="hidden"
                    />
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="gap-2"
                      onClick={() => document.getElementById('production-files-upload')?.click()}
                    >
                      <Upload className="h-4 w-4" />
                      Upload
        </Button>
                  </div>
      </div>
      
                {/* Optional: Proof/Mockup */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">
                    Optional: Proof/Mockup
                  </label>
                  <p className="text-xs text-gray-500">Visual proof, mockup, or reference images</p>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                    <Image className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                    <input
                      id="proof-mockup-upload"
                      type="file"
                      accept=".jpg,.jpeg,.png,.pdf,.gif"
                      onChange={handleProofMockupUpload}
                      className="hidden"
                    />
          <Button 
            variant="outline" 
                      size="sm" 
            className="gap-2"
                      onClick={() => document.getElementById('proof-mockup-upload')?.click()}
          >
                      <Image className="h-4 w-4" />
                      Upload
          </Button>
                    {proofMockupFile && (
                      <div className="mt-2 text-sm text-green-600">
                        ✓ {proofMockupFile.name}
        </div>
                    )}
      </div>
                </div>
              </div>
            </div>

            <DialogFooter className="flex justify-between">
              <Button variant="outline" onClick={handleImprintDialogClose} className="gap-2">
          <Plus className="h-4 w-4" />
                Add New Imprint
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleImprintDialogClose}>
                  Discard
                </Button>
                <Button 
                  onClick={() => {

                    handleImprintSave();
                  }} 
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Save Imprint
        </Button>
      </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <LibrarySelectorDialog
          open={libraryOpen}
          onOpenChange={setLibraryOpen}
          methodFilter={imprintData.method || null}
          customerIdFilter={undefined}
          onSelect={({ imprint, mockup, files }) => {
            setImprintData((prev) => ({
              ...prev,
              method: imprint.method,
              location: (mockup?.location ?? prev.location ?? ''),
              width: (mockup?.width ?? prev.width ?? 0),
              height: (mockup?.height ?? prev.height ?? 0),
              colorsOrThreads: (mockup?.colors_or_threads ?? prev.colorsOrThreads ?? ''),
            }));
            const targetGroupId = selectedGroupId || itemGroups[0]?.id || '';
            const targetItemId = selectedItemId || getFirstItemId(targetGroupId);
            if (!targetGroupId || !targetItemId) return;
            const newImprint: ItemImprint = {
              id: `imprint-${Date.now()}`,
              method: imprint.method,
              location: (mockup?.location ?? ''),
              width: (mockup?.width ?? 0),
              height: (mockup?.height ?? 0),
              colorsOrThreads: (mockup?.colors_or_threads ?? ''),
              notes: '',
              itemId: targetItemId,
              libraryImprintId: imprint.id,
              customerArt: (files.customerArt || []) as any,
              productionFiles: (files.productionFiles || []) as any,
              proofMockup: (files.proofMockup || []) as any,
            } as any;
            console.debug('[QuoteItemsSection] Library onSelect attach', {
              targetGroupId,
              targetItemId,
              libraryImprintId: imprint.id,
              method: newImprint.method,
              location: newImprint.location,
              ca: newImprint.customerArt.length,
              pf: newImprint.productionFiles.length,
              pm: newImprint.proofMockup.length,
            });
            // If a library imprint exists for this item+method (empty location), update its core fields to ensure details are visible
            setItemGroups(prev => prev.map(group => {
              if (group.id !== targetGroupId) return group;
              const idx = group.imprints.findIndex(imp => imp.itemId === newImprint.itemId && imp.method === newImprint.method);
              if (idx >= 0) {
                const updated = [...group.imprints];
                updated[idx] = {
                  ...updated[idx],
                  location: newImprint.location || updated[idx].location,
                  width: newImprint.width || updated[idx].width,
                  height: newImprint.height || updated[idx].height,
                  colorsOrThreads: newImprint.colorsOrThreads || (updated[idx] as any).colorsOrThreads,
                  customerArt: newImprint.customerArt,
                  productionFiles: newImprint.productionFiles,
                  proofMockup: newImprint.proofMockup,
                } as any;
                return { ...group, imprints: updated };
              }
              return { ...group, imprints: [...group.imprints, newImprint] };
            }));
            setLibraryOpen(false);
          }}
        />
    </div>
  );
  }
);

QuoteItemsSection.displayName = "QuoteItemsSection";
