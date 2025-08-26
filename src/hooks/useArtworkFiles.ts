import { useState } from 'react';
import { supabase } from '@/lib/supabase';

export interface ArtworkFile {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  file_type: string;
  category: 'customer_art' | 'production_files' | 'proof_mockup';
  imprint_method?: string;
  imprint_location?: string;
  imprint_size?: string;
  colors_or_threads?: string;
  notes?: string;
  upload_status: 'uploading' | 'completed' | 'failed';
  created_at: string;
  url?: string; // Generated signed URL
}

export interface UploadArtworkFileParams {
  quoteItemId: string;
  file: File;
  category: 'customer_art' | 'production_files' | 'proof_mockup';
  imprintMethod?: string;
  imprintLocation?: string;
  imprintSize?: string;
  colorsOrThreads?: string;
  notes?: string;
}

export function useArtworkFiles() {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const uploadArtworkFile = async (params: UploadArtworkFileParams): Promise<{ success: boolean; file?: ArtworkFile; error?: string }> => {
    try {
      setUploading(true);
      setUploadProgress(0);

      const assetsMode = import.meta.env.VITE_ASSETS_MODE;
      let orgId = 'local';
      if (assetsMode !== 'local') {
        // Get user's org_id from server in cloud mode
        const { data: userOrgData, error: userOrgError } = await supabase.rpc('get_user_org_info');
        if (userOrgError || !userOrgData?.org_id) {
          throw new Error('Unable to get organization information');
        }
        orgId = userOrgData.org_id;
      }
      
      // Generate unique file path
      const fileExt = params.file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `${orgId}/${params.quoteItemId}/${params.category}/${fileName}`;

      if (assetsMode === 'local') {
        // Send to local assets server
        const form = new FormData();
        form.append('orgId', orgId);
        form.append('quoteItemId', params.quoteItemId);
        form.append('category', params.category);
        form.append('file', params.file);
        const resp = await fetch('http://localhost:4000/artwork/upload', { method: 'POST', body: form });
        if (!resp.ok) throw new Error('Local upload failed');
        const payload: any = await resp.json();
        const f = payload?.file;
        setUploadProgress(50);
        return {
          success: true,
          file: {
            id: crypto.randomUUID(),
            file_name: f?.file_name || params.file.name,
            file_path: f?.file_path || filePath,
            file_size: f?.file_size || params.file.size,
            file_type: f?.file_type || params.file.type,
            category: params.category,
            imprint_method: params.imprintMethod,
            imprint_location: params.imprintLocation,
            imprint_size: params.imprintSize,
            colors_or_threads: params.colorsOrThreads,
            notes: params.notes,
            upload_status: 'completed',
            created_at: new Date().toISOString(),
            url: f?.url,
          }
        };
      } else {
        // Upload file to Supabase Storage
        const { error: uploadError } = await supabase.storage
          .from('artwork')
          .upload(filePath, params.file, {
            cacheControl: '3600',
            upsert: false
          });
        if (uploadError) throw uploadError;
      }

      setUploadProgress(50);

      if (assetsMode !== 'local') {
        // Save file metadata to database in cloud mode only
        const { data, error } = await supabase.rpc('upload_artwork_file', {
          p_quote_item_id: params.quoteItemId,
          p_file_name: params.file.name,
          p_file_path: filePath,
          p_file_size: params.file.size,
          p_file_type: params.file.type,
          p_category: params.category,
          p_imprint_method: params.imprintMethod,
          p_imprint_location: params.imprintLocation,
          p_imprint_size: params.imprintSize,
          p_colors_or_threads: params.colorsOrThreads,
          p_notes: params.notes
        });
        if (error) {
          await supabase.storage.from('artwork').remove([filePath]);
          throw error;
        }
      }

      setUploadProgress(100);

      if (assetsMode !== 'local') {
        return {
          success: true,
          file: {
            id: 'server-generated',
            file_name: params.file.name,
            file_path: filePath,
            file_size: params.file.size,
            file_type: params.file.type,
            category: params.category,
            imprint_method: params.imprintMethod,
            imprint_location: params.imprintLocation,
            imprint_size: params.imprintSize,
            colors_or_threads: params.colorsOrThreads,
            notes: params.notes,
            upload_status: 'completed',
            created_at: new Date().toISOString()
          }
        };
      }

    } catch (err) {
      console.error('Error uploading artwork file:', err);
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to upload file'
      };
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const getArtworkFiles = async (quoteItemId: string): Promise<{ success: boolean; files?: ArtworkFile[]; error?: string }> => {
    try {
      const { data, error } = await supabase.rpc('get_artwork_files', {
        p_quote_item_id: quoteItemId
      });

      if (error) {
        throw error;
      }

      // Generate URLs for files (local mode uses public paths)
      const filesWithUrls = await Promise.all(
        (data || []).map(async (file: ArtworkFile) => {
          try {
            const mode = import.meta.env.VITE_ASSETS_MODE;
            if (mode === 'local') {
              const { getAssetUrl } = await import('@/lib/utils');
              return { ...file, url: await getAssetUrl(file.file_path) } as ArtworkFile;
            } else {
              const { data: urlData } = await supabase.storage
                .from('artwork')
                .createSignedUrl(file.file_path, 3600); // 1 hour expiry
              return { ...file, url: urlData?.signedUrl } as ArtworkFile;
            }
          } catch (urlError) {
            console.warn('Failed to generate signed URL for file:', file.file_name, urlError);
            return file;
          }
        })
      );

      return {
        success: true,
        files: filesWithUrls
      };

    } catch (err) {
      console.error('Error getting artwork files:', err);
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to get artwork files'
      };
    }
  };

  const deleteArtworkFile = async (fileId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { data, error } = await supabase.rpc('delete_artwork_file', {
        p_file_id: fileId
      });

      if (error) {
        throw error;
      }

      // Delete from storage
      if (data?.file_path) {
        await supabase.storage
          .from('artwork')
          .remove([data.file_path]);
      }

      return { success: true };

    } catch (err) {
      console.error('Error deleting artwork file:', err);
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to delete file'
      };
    }
  };

  const generateSignedUrl = async (filePath: string): Promise<string | null> => {
    try {
      const mode = import.meta.env.VITE_ASSETS_MODE;
      if (mode === 'local') {
        const { getAssetUrl } = await import('@/lib/utils');
        return await getAssetUrl(filePath);
      }
      const { data, error } = await supabase.storage.from('artwork').createSignedUrl(filePath, 3600);

      if (error) {
        throw error;
      }

      return data?.signedUrl || null;
    } catch (err) {
      console.error('Error generating signed URL:', err);
      return null;
    }
  };

  return {
    uploading,
    uploadProgress,
    uploadArtworkFile,
    getArtworkFiles,
    deleteArtworkFile,
    generateSignedUrl
  };
}



