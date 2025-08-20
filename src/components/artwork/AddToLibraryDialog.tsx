import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Upload } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { IMPRINT_METHODS } from '@/types/imprint';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated?: () => void;
}

export default function AddToLibraryDialog({ open, onOpenChange, onCreated }: Props) {
  const [designName, setDesignName] = useState('');
  const [method, setMethod] = useState<string>('embroidery');
  const [notes, setNotes] = useState('');
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [customerArt, setCustomerArt] = useState<File[]>([]);
  const [productionFiles, setProductionFiles] = useState<File[]>([]);
  const [mockups, setMockups] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setDesignName('');
      setMethod('embroidery');
      setNotes('');
      setPreviewFile(null);
      setCustomerArt([]);
      setProductionFiles([]);
      setMockups([]);
      setSubmitting(false);
    }
  }, [open]);

  const handleSave = async () => {
    if (!designName.trim()) return;
    setSubmitting(true);
    try {
      // Get org info
      const { data: orgInfo, error: orgErr } = await supabase.rpc('get_user_org_info');
      if (orgErr || !orgInfo?.org_id) throw new Error('Unable to resolve org');
      const orgId = orgInfo.org_id as string;

      // Insert library imprint
      const { data: imprintRow, error: impErr } = await supabase
        .from('library_imprints')
        .insert({ org_id: orgId, design_name: designName.trim(), method, notes })
        .select('*')
        .single();
      if (impErr) throw impErr;
      const imprintId = imprintRow.id as string;

      // Upload preview if provided and update row
      if (previewFile) {
        const previewPath = `${orgId}/library/${imprintId}/preview/${Date.now()}-${previewFile.name}`;
        const { error: upPrevErr } = await supabase.storage.from('artwork').upload(previewPath, previewFile, { cacheControl: '3600', upsert: false });
        if (!upPrevErr) {
          await supabase.from('library_imprints').update({ preview_path: previewPath }).eq('id', imprintId);
        }
      }

      // Helper upload function per category
      const uploadFiles = async (files: File[], category: 'customer_art'|'production_files'|'proof_mockup') => {
        for (const file of files) {
          const filePath = `${orgId}/library/${imprintId}/${category}/${Date.now()}-${file.name}`;
          const { error: upErr } = await supabase.storage.from('artwork').upload(filePath, file, { cacheControl: '3600', upsert: false });
          if (upErr) continue;
          await supabase.from('artwork_files').insert({
            org_id: orgId,
            file_name: file.name,
            file_path: filePath,
            file_type: file.type || 'application/octet-stream',
            file_size: file.size,
            category,
            is_library: true,
            library_imprint_id: imprintId,
          });
        }
      };

      await uploadFiles(customerArt, 'customer_art');
      await uploadFiles(productionFiles, 'production_files');
      await uploadFiles(mockups, 'proof_mockup');

      onCreated?.();
      onOpenChange(false);
    } catch (e) {
      console.error('AddToLibrary error', e);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Add to Library</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Design Name</Label>
              <Input value={designName} onChange={(e)=>setDesignName(e.target.value)} placeholder="e.g., American Flag" />
            </div>
            <div>
              <Label>Method</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger><SelectValue placeholder="Method" /></SelectTrigger>
                <SelectContent>
                  {IMPRINT_METHODS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Notes</Label>
            <textarea className="w-full min-h-[80px] p-2 border rounded" value={notes} onChange={(e)=>setNotes(e.target.value)} placeholder="Optional notes" />
          </div>

          <div className="space-y-2">
            <Label>Preview Image (transparent PNG recommended)</Label>
            <div className="border-2 border-dashed rounded p-4 text-center">
              <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
              <input type="file" accept=".png,.jpg,.jpeg" className="hidden" id="preview-upload" onChange={(e)=>setPreviewFile(e.target.files?.[0] || null)} />
              <Button variant="outline" size="sm" onClick={()=>document.getElementById('preview-upload')?.click()}>Upload Preview</Button>
              {previewFile && <div className="text-xs mt-2">{previewFile.name}</div>}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Customer Art</Label>
              <div className="border-2 border-dashed rounded p-4 text-center">
                <Upload className="mx-auto h-6 w-6 text-muted-foreground mb-2" />
                <input type="file" multiple accept=".png,.jpg,.jpeg,.svg,.pdf" className="hidden" id="lib-customer-art" onChange={(e)=>setCustomerArt(Array.from(e.target.files||[]))} />
                <Button variant="outline" size="sm" onClick={()=>document.getElementById('lib-customer-art')?.click()}>Upload</Button>
                {customerArt.length>0 && <div className="text-xs mt-1">{customerArt.length} file(s)</div>}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Production Files</Label>
              <div className="border-2 border-dashed rounded p-4 text-center">
                <Upload className="mx-auto h-6 w-6 text-muted-foreground mb-2" />
                <input type="file" multiple accept=".pdf,.ai,.eps,.emb,.dst,.png,.jpg,.jpeg" className="hidden" id="lib-production-files" onChange={(e)=>setProductionFiles(Array.from(e.target.files||[]))} />
                <Button variant="outline" size="sm" onClick={()=>document.getElementById('lib-production-files')?.click()}>Upload</Button>
                {productionFiles.length>0 && <div className="text-xs mt-1">{productionFiles.length} file(s)</div>}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Mockups</Label>
              <div className="border-2 border-dashed rounded p-4 text-center">
                <Upload className="mx-auto h-6 w-6 text-muted-foreground mb-2" />
                <input type="file" multiple accept=".png,.jpg,.jpeg,.pdf" className="hidden" id="lib-mockups" onChange={(e)=>setMockups(Array.from(e.target.files||[]))} />
                <Button variant="outline" size="sm" onClick={()=>document.getElementById('lib-mockups')?.click()}>Upload</Button>
                {mockups.length>0 && <div className="text-xs mt-1">{mockups.length} file(s)</div>}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={()=>onOpenChange(false)} disabled={submitting}>Cancel</Button>
            <Button onClick={handleSave} disabled={submitting || !designName.trim()}>Save to Library</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}


