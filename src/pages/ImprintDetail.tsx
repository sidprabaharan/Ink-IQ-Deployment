import React, { useEffect, useState } from 'react';
import { ArrowLeft, Download, Eye, FileImage, Users, Calendar, Tag, Layers, MoreVertical, Package, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArtworkFile } from '@/types/artwork';
import { IMPRINT_METHODS } from '@/types/imprint';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

interface PreviousItem { id: string; quote_id: string; product_name?: string; item_number?: string; quantity?: number; created_at?: string; }

export default function ImprintDetail() {
  const navigate = useNavigate();
  const { imprintId } = useParams();
  const [selectedFile, setSelectedFile] = useState<ArtworkFile | null>(null);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [imprint, setImprint] = useState<any | null>(null);
  const [previousItems, setPreviousItems] = useState<PreviousItem[]>([]);

  useEffect(() => {
    const load = async () => {
      if (!imprintId) { setLoading(false); return; }
      try {
        const { data: detail } = await supabase.rpc('get_library_imprint_detail', { p_imprint_id: imprintId });
        if (detail) {
          const d: any = detail as any;
          const files = (d.files || []) as Array<{ id: string; category: string; file_path: string; file_name?: string; file_type?: string; }>
          const sign = async (path: string) => (await supabase.storage.from('artwork').createSignedUrl(path, 3600)).data?.signedUrl || '';
          const toArtworkFile = async (f: any): Promise<ArtworkFile> => ({ id: f.id, name: f.file_name || f.file_path.split('/').pop() || 'file', url: await sign(f.file_path), type: f.file_type || 'application/octet-stream', sizeBytes: 0, uploadedAt: new Date() } as any);
          const customerArt = await Promise.all(files.filter(f => f.category === 'customer_art').map(toArtworkFile));
          const productionFiles = await Promise.all(files.filter(f => f.category === 'production_files').map(toArtworkFile));
          const proofMockup = await Promise.all(files.filter(f => f.category === 'proof_mockup').map(toArtworkFile));
          const previewUrl = d.imprint?.preview_path ? (await supabase.storage.from('artwork').createSignedUrl(d.imprint.preview_path, 3600)).data?.signedUrl : undefined;
          setImprint({
            id: d.imprint?.id || imprintId,
            designName: d.imprint?.design_name || 'Design',
            method: d.imprint?.method || 'screenPrinting',
            size: { width: 0, height: 0 },
            createdAt: d.imprint?.created_at ? new Date(d.imprint.created_at) : new Date(),
            updatedAt: d.imprint?.updated_at ? new Date(d.imprint.updated_at) : new Date(),
            associatedCustomers: (d.imprint?.customers || []).map((c: any) => ({ customerId: c.id, customerName: c.name, usageCount: 0, lastUsedAt: new Date() })),
            usageCount: 0,
            productionFiles,
            mockups: proofMockup,
            customerArt,
            previewUrl,
          });
        }
        const { data: itemsData } = await supabase.rpc('get_items_for_library_imprint', { p_library_imprint_id: imprintId });
        setPreviousItems(((itemsData as any[]) || []).map((i: any) => ({ id: i.id, quote_id: i.quote_id, product_name: i.product_name, item_number: i.item_number, quantity: i.quantity, created_at: i.created_at })));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [imprintId]);

  if (loading) {
    return <div className="flex-1 space-y-6 p-6 md:p-8">Loading...</div>;
  }

  if (!imprint) {
    return (
      <div className="flex-1 space-y-6 p-6 md:p-8">
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold">Imprint not found</h2>
          <p className="text-muted-foreground mt-2">The requested imprint could not be found.</p>
          <Button onClick={() => navigate('/artwork-files')} className="mt-4">Back to Artwork Files</Button>
        </div>
      </div>
    );
  }

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

  const handlePreviewFile = (file: ArtworkFile) => {
    setSelectedFile(file);
    setPreviewDialogOpen(true);
  };

  const methodLabel = IMPRINT_METHODS.find(m => m.value === imprint.method)?.label || imprint.method;

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "Completed":
        return "default";
      case "Production": 
        return "destructive";
      case "Shipped":
        return "secondary";
      case "Quote":
        return "outline";
      default:
        return "outline";
    }
  };

  return (
    <div className="flex-1 space-y-6 p-6 md:p-8">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate('/artwork-files')}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Artwork
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{imprint.designName}</h1>
            <p className="text-muted-foreground">#34675</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Download All
          </Button>
        </div>
      </div>

      {/* Imprint Info Card */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 bg-muted rounded-lg flex items-center justify-center overflow-hidden">
                {imprint.previewUrl ? (
                  <img src={imprint.previewUrl} alt={imprint.designName} className="w-full h-full object-contain" />
                ) : imprint.customerArt.length > 0 ? (
                  <img src={imprint.customerArt[0].url} alt={imprint.designName} className="w-full h-full object-contain" />
                ) : (
                  <FileImage className="h-8 w-8 text-muted-foreground" />
                )}
              </div>
              <div>
                <CardTitle className="text-xl">{imprint.designName}</CardTitle>
                <div className="text-sm text-muted-foreground mt-1">#34675</div>
                <div className="flex items-center gap-4 mt-3">
                  <Badge variant="secondary">{methodLabel}</Badge>
                  <span className="text-sm text-muted-foreground">
                    {imprint.size.width}" × {imprint.size.height}"
                  </span>
                </div>
              </div>
            </div>
            <div className="text-right text-sm text-muted-foreground">
              <div>Created: {formatDate(imprint.createdAt)}</div>
              <div>Updated: {formatDate(imprint.updatedAt)}</div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold">{previousItems.length}</div>
              <div className="text-sm text-muted-foreground">Times Used</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{imprint.associatedCustomers.length}</div>
              <div className="text-sm text-muted-foreground">Customers</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{imprint.productionFiles.length}</div>
              <div className="text-sm text-muted-foreground">Production Files</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{imprint.mockups.length}</div>
              <div className="text-sm text-muted-foreground">Mockups</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Associated Customers */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Associated Customers ({imprint.associatedCustomers.length})
          </CardTitle>
          <CardDescription>
            Customers who have used this imprint in their orders
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2">
            {imprint.associatedCustomers.map((customer) => (
              <div key={customer.customerId} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs">
                      {customer.customerName.split(' ').map(n => n[0]).join('').toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium">{customer.customerName}</div>
                    <div className="text-sm text-muted-foreground">
                      Used {customer.usageCount} time{customer.usageCount !== 1 ? 's' : ''}
                    </div>
                  </div>
                </div>
                <div className="text-sm text-muted-foreground">
                  Last: {formatDate(customer.lastUsedAt)}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Previous Items */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Previous Items ({previousItems.length})
          </CardTitle>
          <CardDescription>
            Items that used this design
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2">
            {previousItems.map((it) => (
              <div key={it.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                    <Package className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="font-medium">{it.item_number || it.id}</div>
                    <div className="text-sm text-muted-foreground">{it.product_name || ''}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Button variant="ghost" size="sm" onClick={() => navigate(`/quotes/${it.quote_id}`)}>
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Files Tabs */}
      <Tabs defaultValue="production" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="production">
            Production Files ({imprint.productionFiles.length})
          </TabsTrigger>
          <TabsTrigger value="mockups">
            Mockups ({imprint.mockups.length})
          </TabsTrigger>
          <TabsTrigger value="customer">
            Customer Art ({imprint.customerArt.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="production" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Production Files</CardTitle>
              <CardDescription>
                Ready-to-use files for production equipment
              </CardDescription>
            </CardHeader>
            <CardContent>
              {imprint.productionFiles.length > 0 ? (
                <div className="grid gap-3">
                  {imprint.productionFiles.map((file) => (
                    <div key={file.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <FileImage className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <div className="font-medium">{file.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {formatFileSize(file.sizeBytes)} • {formatDate(file.uploadedAt)}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" onClick={() => handlePreviewFile(file)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Download className="h-4 w-4" />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>Edit</DropdownMenuItem>
                            <DropdownMenuItem>Duplicate</DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <FileImage className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No production files uploaded yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mockups" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Mockups</CardTitle>
              <CardDescription>
                Visual representations of the final product
              </CardDescription>
            </CardHeader>
            <CardContent>
              {imprint.mockups.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {imprint.mockups.map((file) => (
                    <div key={file.id} className="group cursor-pointer" onClick={() => handlePreviewFile(file)}>
                      <div className="aspect-square bg-muted rounded-lg overflow-hidden mb-2">
                        <img 
                          src={file.url} 
                          alt={file.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                      </div>
                      <div className="text-sm font-medium truncate">{file.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatFileSize(file.sizeBytes)} • {formatDate(file.uploadedAt)}
                      </div>
                      {file.colors && (
                        <div className="mt-1">
                          <Badge variant="outline" className="text-xs">
                            {file.colors}
                          </Badge>
                        </div>
                      )}
                      {file.notes && (
                        <div className="mt-1 text-xs text-muted-foreground">
                          {file.notes}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <FileImage className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No mockups uploaded yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="customer" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Customer Art</CardTitle>
              <CardDescription>
                Original artwork files provided by customers
              </CardDescription>
            </CardHeader>
            <CardContent>
              {imprint.customerArt.length > 0 ? (
                <div className="grid gap-3">
                  {imprint.customerArt.map((file) => (
                    <div key={file.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-muted rounded-lg overflow-hidden">
                          <img 
                            src={file.url} 
                            alt={file.name}
                            className="w-full h-full object-contain"
                          />
                        </div>
                        <div>
                          <div className="font-medium">{file.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {formatFileSize(file.sizeBytes)} • {formatDate(file.uploadedAt)}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" onClick={() => handlePreviewFile(file)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <FileImage className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No customer art files uploaded yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Preview Dialog */}
      <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{selectedFile?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedFile && (
              <>
                <div className="aspect-video bg-muted rounded-lg overflow-hidden flex items-center justify-center">
                  <img 
                    src={selectedFile.url} 
                    alt={selectedFile.name}
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="font-medium">File Size</div>
                    <div className="text-muted-foreground">{formatFileSize(selectedFile.sizeBytes)}</div>
                  </div>
                  <div>
                    <div className="font-medium">Uploaded</div>
                    <div className="text-muted-foreground">{formatDate(selectedFile.uploadedAt)}</div>
                  </div>
                  <div>
                    <div className="font-medium">Type</div>
                    <div className="text-muted-foreground">{selectedFile.type}</div>
                  </div>
                  <div>
                    <div className="font-medium">Category</div>
                    <div className="text-muted-foreground capitalize">{selectedFile.category}</div>
                  </div>
                  {selectedFile.colors && (
                    <div>
                      <div className="font-medium">Colors</div>
                      <div className="text-muted-foreground">{selectedFile.colors}</div>
                    </div>
                  )}
                  {selectedFile.notes && (
                    <div>
                      <div className="font-medium">Notes</div>
                      <div className="text-muted-foreground">{selectedFile.notes}</div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}