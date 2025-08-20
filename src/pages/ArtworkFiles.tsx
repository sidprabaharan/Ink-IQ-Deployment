import React, { useState, useMemo } from 'react';
import { Search, Upload, Grid, List, FileImage, Download, Eye, MoreVertical, User, Tag, Layers } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { IMPRINT_METHODS } from '@/types/imprint';
import { supabase } from '@/lib/supabase';
import AddToLibraryDialog from '@/components/artwork/AddToLibraryDialog';
import { useNavigate } from 'react-router-dom';

// Unified imprint type that combines MasterArtwork and SharedImprint
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
  previewUrl?: string;
}

export default function ArtworkFiles() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<string>('all');
  const [selectedMethod, setSelectedMethod] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedArtwork, setSelectedArtwork] = useState<UnifiedImprint | null>(null);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [folderViewOpen, setFolderViewOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [unifiedImprints, setUnifiedImprints] = useState<UnifiedImprint[]>([]);

  const fetchImprints = async () => {
    const { data, error } = await supabase.rpc('get_library_imprints', { p_method: null, p_search: null });
    if (error) {
      console.error('[ArtworkFiles] get_library_imprints error', error);
      return;
    }
    const arr = (data as any[]) || [];
    console.log('[ArtworkFiles] fetched imprints count=', arr.length);
    const mapped = await Promise.all(arr.map(async (row: any) => {
      let previewUrl: string | undefined;
      if (row.preview_path) {
        try {
          console.log('[ArtworkFiles] preview_path found', row.preview_path);
          const { data: signed, error: signErr } = await supabase.storage.from('artwork').createSignedUrl(row.preview_path, 3600);
          if (signErr) {
            console.warn('[ArtworkFiles] createSignedUrl error', signErr);
          }
          previewUrl = signed?.signedUrl;
          console.log('[ArtworkFiles] preview signedUrl', previewUrl);
        } catch (e) {
          console.warn('[ArtworkFiles] failed to sign preview', row.preview_path, e);
        }
      } else {
        console.log('[ArtworkFiles] no preview_path for imprint', row.id);
      }
      return {
        id: row.id,
        designName: row.design_name,
        imprintMethod: row.method,
        associatedCustomers: (row.customers || []).map((c: any) => ({ id: c.id, name: c.name })),
        customerArt: [], productionFiles: [], mockups: [],
        fileCount: row.file_count || 0,
        totalSizeBytes: row.total_size || 0,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
        notes: row.notes || '',
        previewUrl,
      } as UnifiedImprint;
    }));
    setUnifiedImprints(mapped);
  };

  React.useEffect(() => { fetchImprints(); }, []);

  // Get unique customers for filter (from unified imprints)
  const customers = useMemo(() => {
    const customerMap = new Map();
    unifiedImprints.forEach(imprint => {
      imprint.associatedCustomers.forEach(customer => {
        customerMap.set(customer.id, customer);
      });
    });
    return Array.from(customerMap.values());
  }, [unifiedImprints]);

  // Group imprints by method to create folders
  const imprintFolders = useMemo(() => {
    const folders = new Map<string, UnifiedImprint[]>();
    
    unifiedImprints.forEach(imprint => {
      // Apply customer filter
      if (selectedCustomer !== 'all') {
        const hasCustomer = imprint.associatedCustomers.some(c => c.id === selectedCustomer);
        if (!hasCustomer) return;
      }

      // Apply method filter
      if (selectedMethod !== 'all' && imprint.imprintMethod !== selectedMethod) {
        return;
      }

      // Apply search filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const matchesSearch = (
          imprint.designName.toLowerCase().includes(searchLower) ||
          imprint.associatedCustomers.some(c => c.name.toLowerCase().includes(searchLower)) ||
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
  }, [unifiedImprints, searchTerm, selectedCustomer, selectedMethod]);

  // Get imprints for selected folder
  const folderImprints = useMemo(() => {
    if (!selectedFolder) return [];
    const folder = imprintFolders.find(f => f.method === selectedFolder);
    return folder ? folder.imprints : [];
  }, [selectedFolder, imprintFolders]);

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

  const getTotalStats = () => {
    const totalImprints = unifiedImprints.length;
    const totalSize = unifiedImprints.reduce((sum, imprint) => sum + imprint.totalSizeBytes, 0);
    const totalCustomers = customers.length;
    
    return { totalImprints, totalSize, totalCustomers };
  };

  const stats = getTotalStats();

  return (
    <div className="flex-1 space-y-6 p-6 md:p-8">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Imprint Library</h1>
          <p className="text-muted-foreground">
            Manage all imprints, artwork files, and associated customers
          </p>
        </div>
        <Button className="gap-2" onClick={()=>setAddOpen(true)}>
          <Upload className="h-4 w-4" />
          Upload Artwork
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Imprints</CardTitle>
            <FileImage className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalImprints}</div>
            <p className="text-xs text-muted-foreground">
              Across {stats.totalCustomers} customers
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
            <CardTitle className="text-sm font-medium">Associated Customers</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalCustomers}</div>
            <p className="text-xs text-muted-foreground">
              With artwork on file
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:gap-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search imprints by name, customer, or notes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Customers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Customers</SelectItem>
                {customers.map((customer) => (
                  <SelectItem key={customer.id} value={customer.id}>
                    {customer.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedMethod} onValueChange={setSelectedMethod}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Methods" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Methods</SelectItem>
                {IMPRINT_METHODS.map((method) => (
                  <SelectItem key={method.value} value={method.value}>
                    {method.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
            {imprintFolders.length} folder{imprintFolders.length !== 1 ? 's' : ''} found
          </p>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setFolderViewOpen(false)}
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

      {/* Folder View vs Imprints View */}
      {!folderViewOpen ? (
        // Folders Grid
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {imprintFolders.map((folder) => (
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
                        {imprint.associatedCustomers.length === 1 
                          ? imprint.associatedCustomers[0].name
                          : `${imprint.associatedCustomers.length} customers`
                        }
                      </CardDescription>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handlePreviewArtwork(imprint)}>
                          <Eye className="h-4 w-4 mr-2" />
                          Preview
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate(`/imprint/${imprint.id}`)}>
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
                  {/* Image Preview */}
                  <div className="aspect-square bg-muted rounded-lg flex items-center justify-center overflow-hidden">
                    {imprint.previewUrl ? (
                      <img 
                        src={imprint.previewUrl}
                        alt={imprint.designName}
                        className="w-full h-full object-contain"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          target.nextElementSibling?.classList.remove('hidden');
                          console.warn('[ArtworkFiles] preview image failed to render', imprint.id);
                        }}
                      />
                    ) : null}
                    <div className={`flex flex-col items-center text-muted-foreground ${imprint.previewUrl ? 'hidden' : ''}`}>
                      <FileImage className="h-8 w-8 mb-2" />
                      <span className="text-xs">No Preview</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {imprint.associatedCustomers.length > 1 && (
                      <Badge variant="outline">
                        Shared
                      </Badge>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                    <div className="text-center">
                      <div className="font-medium">{imprint.customerArt.length}</div>
                      <div>Customer</div>
                    </div>
                    <div className="text-center">
                      <div className="font-medium">{imprint.productionFiles.length}</div>
                      <div>Production</div>
                    </div>
                    <div className="text-center">
                      <div className="font-medium">{imprint.mockups.length}</div>
                      <div>Mockups</div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">
                      <span className="font-medium">Notes:</span>
                    </div>
                    <div className="text-xs text-muted-foreground p-2 bg-muted/30 rounded">
                      {imprint.notes || "No notes available"}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="divide-y">
                {folderImprints.map((imprint) => (
                  <div key={imprint.id} className="flex items-center gap-4 p-4 hover:bg-muted/50 cursor-pointer"
                       onClick={() => navigate(`/imprint/${imprint.id}`)}>
                    {/* Image Preview */}
                    <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                      {imprint.previewUrl ? (
                        <img 
                          src={imprint.previewUrl}
                          alt={imprint.designName}
                          className="w-full h-full object-contain"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            target.nextElementSibling?.classList.remove('hidden');
                            console.warn('[ArtworkFiles] preview image failed to render (list)', imprint.id);
                          }}
                        />
                      ) : null}
                      <div className={`flex flex-col items-center text-muted-foreground text-xs ${imprint.previewUrl ? 'hidden' : ''}`}>
                        <FileImage className="h-6 w-6" />
                      </div>
                    </div>
                    
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold truncate">{imprint.designName}</h3>
                        {imprint.associatedCustomers.length > 1 && (
                          <Badge variant="outline">Shared</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>{imprint.fileCount} files</span>
                        <span>{formatFileSize(imprint.totalSizeBytes)}</span>
                        <span>
                          {imprint.associatedCustomers.length === 1 
                            ? imprint.associatedCustomers[0].name
                            : `${imprint.associatedCustomers.length} customers`
                          }
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                        <span className="font-medium">Notes:</span> {imprint.notes || "No notes"}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" onClick={(e) => {
                        e.stopPropagation();
                        handlePreviewArtwork(imprint);
                      }}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <Download className="h-4 w-4 mr-2" />
                            Download All
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

      {/* Preview Dialog */}
      <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{selectedArtwork?.designName}</DialogTitle>
          </DialogHeader>
          {selectedArtwork && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Method:</span>{' '}
                  {IMPRINT_METHODS.find(m => m.value === selectedArtwork.imprintMethod)?.label || selectedArtwork.imprintMethod}
                </div>
                <div>
                  <span className="font-medium">Files:</span> {selectedArtwork.fileCount}
                </div>
                <div>
                  <span className="font-medium">Associated Customers:</span>{' '}
                  {selectedArtwork.associatedCustomers.length}
                </div>
                <div>
                  <span className="font-medium">Size:</span> {formatFileSize(selectedArtwork.totalSizeBytes)}
                </div>
              </div>
              
              <div>
                <span className="font-medium">Customers:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {selectedArtwork.associatedCustomers.map((customer) => (
                    <Badge key={customer.id} variant="outline">
                      {customer.name}
                    </Badge>
                  ))}
                </div>
              </div>

              <Tabs defaultValue="customer-art" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="customer-art">Customer Art ({selectedArtwork.customerArt.length})</TabsTrigger>
                  <TabsTrigger value="production">Production ({selectedArtwork.productionFiles.length})</TabsTrigger>
                  <TabsTrigger value="mockups">Mockups ({selectedArtwork.mockups.length})</TabsTrigger>
                </TabsList>
                
                <TabsContent value="customer-art" className="space-y-2">
                  <ScrollArea className="h-[200px]">
                    {selectedArtwork.customerArt.map((file) => (
                      <div key={file.id} className="flex items-center justify-between p-2 border rounded">
                        <div>
                          <div className="font-medium">{file.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {formatFileSize(file.sizeBytes)} • {formatDate(file.uploadedAt)}
                          </div>
                        </div>
                        <Button variant="ghost" size="sm">
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </ScrollArea>
                </TabsContent>
                
                <TabsContent value="production" className="space-y-2">
                  <ScrollArea className="h-[200px]">
                    {selectedArtwork.productionFiles.map((file) => (
                      <div key={file.id} className="flex items-center justify-between p-2 border rounded">
                        <div>
                          <div className="font-medium">{file.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {formatFileSize(file.sizeBytes)} • {formatDate(file.uploadedAt)}
                          </div>
                        </div>
                        <Button variant="ghost" size="sm">
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </ScrollArea>
                </TabsContent>
                
                <TabsContent value="mockups" className="space-y-2">
                  <ScrollArea className="h-[200px]">
                    {selectedArtwork.mockups.map((file) => (
                      <div key={file.id} className="flex items-center justify-between p-2 border rounded">
                        <div>
                          <div className="font-medium">{file.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {formatFileSize(file.sizeBytes)} • {formatDate(file.uploadedAt)}
                          </div>
                        </div>
                        <Button variant="ghost" size="sm">
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </ScrollArea>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <AddToLibraryDialog open={addOpen} onOpenChange={(v)=>{ setAddOpen(v); if(!v) fetchImprints(); }} onCreated={fetchImprints} />
    </div>
  );
}