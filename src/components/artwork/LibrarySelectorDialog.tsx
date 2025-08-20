import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileImage, Search } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { IMPRINT_METHODS } from '@/types/imprint';

interface LibraryImprint {
  id: string;
  design_name: string;
  method: string;
  notes?: string;
  preview_path?: string;
  customers?: { id: string; name: string }[];
  file_count?: number;
  previewUrl?: string | null;
}

interface LibraryMockup {
  id: string;
  name?: string;
  location?: string;
  width?: number;
  height?: number;
  colors_or_threads?: string;
  notes?: string;
}

interface LibraryFile {
  id: string;
  category: 'customer_art' | 'production_files' | 'proof_mockup';
  file_path: string;
  file_name?: string;
  file_type?: string;
}

interface LibraryImprintDetail {
  imprint: LibraryImprint;
  mockups: LibraryMockup[];
  files: LibraryFile[];
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  methodFilter?: string | null;
  customerIdFilter?: string | null;
  onSelect: (payload: {
    imprint: LibraryImprint;
    mockup?: LibraryMockup | null;
    files: { customerArt: any[]; productionFiles: any[]; proofMockup: any[] };
  }) => void;
}

export default function LibrarySelectorDialog({ open, onOpenChange, methodFilter, customerIdFilter, onSelect }: Props) {
  const [search, setSearch] = useState('');
  const [method, setMethod] = useState<string>(methodFilter || 'all');
  const [loading, setLoading] = useState(false);
  const [imprints, setImprints] = useState<LibraryImprint[]>([]);
  const [selected, setSelected] = useState<LibraryImprint | null>(null);
  const [detail, setDetail] = useState<LibraryImprintDetail | null>(null);
  const [selectedMockupId, setSelectedMockupId] = useState<string | null>(null);

  useEffect(() => { if (methodFilter) setMethod(methodFilter); }, [methodFilter]);

  useEffect(() => {
    if (!open) {
      setImprints([]);
      setSelected(null);
      setDetail(null);
      setSelectedMockupId(null);
      setSearch('');
    }
  }, [open]);

  const fetchImprints = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_library_imprints', {
        p_method: method === 'all' ? null : method,
        p_search: search ? search : null,
      });
      if (error) throw error;
      const arr = ((data as any[]) || []);
      const withUrls = await Promise.all(arr.map(async (imp: any) => {
        let previewUrl: string | null = null;
        if (imp.preview_path) {
          const { data: signed } = await supabase.storage.from('artwork').createSignedUrl(imp.preview_path, 3600);
          previewUrl = signed?.signedUrl || null;
        }
        return { ...imp, previewUrl } as LibraryImprint;
      }));
      setImprints(withUrls);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (open) { fetchImprints(); } }, [open, method]);

  const filteredImprints = useMemo(() => {
    if (!customerIdFilter) return imprints;
    return (imprints || []).filter((imp) => (imp.customers || []).some((c) => c.id === customerIdFilter));
  }, [imprints, customerIdFilter]);

  const loadDetail = async (imprint: LibraryImprint) => {
    setSelected(imprint);
    setDetail(null);
    setSelectedMockupId(null);
    const { data, error } = await supabase.rpc('get_library_imprint_detail', { p_imprint_id: imprint.id });
    if (!error && data) setDetail(data as any);
  };

  const handleUse = async () => {
    if (!detail || !selected) return;
    // Use selected mockup, otherwise default to the first available so imprint fields (location/size/colors) are populated
    const mockup = (detail.mockups || []).find((m) => m.id === selectedMockupId) || (detail.mockups && detail.mockups[0]) || null;
    // Convert files to UI-friendly objects with signed URLs
    const sign = async (filePath: string) => {
      const { data } = await supabase.storage.from('artwork').createSignedUrl(filePath, 3600);
      return data?.signedUrl || null;
    };
    const filesByCat = { customerArt: [] as any[], productionFiles: [] as any[], proofMockup: [] as any[] };
    for (const f of detail.files || []) {
      const url = await sign(f.file_path);
      const obj = { id: f.id, name: f.file_name || f.file_path.split('/').pop() || 'file', url, type: f.file_type || 'application/octet-stream', path: f.file_path } as any;
      if (f.category === 'customer_art') filesByCat.customerArt.push(obj);
      else if (f.category === 'production_files') filesByCat.productionFiles.push(obj);
      else filesByCat.proofMockup.push(obj);
    }
    // Fallback: if no files were found in the library design, use preview image as a proof/mockup so the imprint block shows a thumbnail
    if ((filesByCat.customerArt.length + filesByCat.productionFiles.length + filesByCat.proofMockup.length) === 0 && selected.preview_path) {
      const signedPreview = await sign(selected.preview_path);
      if (signedPreview) {
        filesByCat.proofMockup.push({ id: `${selected.id}-preview`, name: 'Preview', url: signedPreview, type: 'image/jpeg' });
      }
    }
    onSelect({ imprint: selected, mockup, files: filesByCat });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Select from Library</DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-2 mb-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search designs..." value={search} onChange={(e)=>setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={method} onValueChange={(v)=>setMethod(v)}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Method" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Methods</SelectItem>
              {IMPRINT_METHODS.map((m) => (
                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={fetchImprints} disabled={loading}>Search</Button>
        </div>

        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-6">
            <ScrollArea className="h-[420px]">
              <div className="grid grid-cols-2 gap-3">
                {filteredImprints.map((imp) => (
                  <Card key={imp.id} className={`cursor-pointer ${selected?.id===imp.id ? 'ring-2 ring-primary' : ''}`} onClick={()=>loadDetail(imp)}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm truncate">{imp.design_name}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="aspect-[4/3] bg-muted rounded flex items-center justify-center overflow-hidden">
                        {imp.previewUrl ? (
                          <img src={imp.previewUrl} alt={imp.design_name} className="w-full h-full object-contain" />
                        ) : (
                          <div className="text-muted-foreground flex flex-col items-center"><FileImage className="h-6 w-6" /><span className="text-xs">No preview</span></div>
                        )}
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground flex justify-between">
                        <span>{imp.method}</span>
                        <span>{imp.file_count || 0} files</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </div>

          <div className="col-span-6">
            {!detail ? (
              <div className="h-[420px] flex items-center justify-center text-sm text-muted-foreground">Select a design to preview mockups and files</div>
            ) : (
              <div className="space-y-3">
                <div className="text-sm font-medium">{detail.imprint.design_name}</div>
                {detail.mockups && detail.mockups.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">Mockups</div>
                    <div className="grid grid-cols-2 gap-2">
                      {detail.mockups.map((m) => (
                        <button key={m.id} className={`border rounded p-2 text-left text-xs ${selectedMockupId===m.id?'border-primary':'border-muted'}`} onClick={()=>setSelectedMockupId(m.id)}>
                          <div className="font-medium">{m.name || m.location || 'Mockup'}</div>
                          <div className="text-muted-foreground">{m.location || ''}</div>
                          {(m.width || m.height) ? (<div className="text-muted-foreground">{m.width || 0}" × {m.height || 0}"</div>) : null}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="text-xs text-muted-foreground">{(detail.files || []).length} files</div>
                <div className="flex justify-end">
                  <Button onClick={handleUse}>Use this imprint</Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}


