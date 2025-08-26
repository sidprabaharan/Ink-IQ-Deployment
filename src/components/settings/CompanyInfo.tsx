
import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { MapPin, Phone, Mail, Globe, Building, Users } from 'lucide-react';
import { useOrganization } from '@/context/OrganizationContext';
import { supabase } from '@/lib/supabase';

export function CompanyInfo() {
  const { toast } = useToast();
  const { organization, updateOrganizationSettings, createOrganization, loading } = useOrganization();
  const initialCompany = useMemo(() => {
    const s: any = organization?.org_settings || {};
    return {
      name: s.companyName || organization?.org_name || 'Your Company',
      address: s.address || '',
      city: s.city || '',
      state: s.state || '',
      zip: s.zip || '',
      country: s.country || '',
      phone: s.phone || '',
      email: s.email || '',
      website: s.website || '',
      taxId: s.taxId || '',
      description: s.description || '',
      logoUrl: s.logoUrl || '/placeholder.svg'
    };
  }, [organization]);
  const [company, setCompany] = useState(initialCompany);

  const [isEditing, setIsEditing] = useState(false);
  const [editedCompany, setEditedCompany] = useState({...company});
  const [uploadingLogo, setUploadingLogo] = useState(false);

  useEffect(() => {
    setCompany(initialCompany);
    setEditedCompany(initialCompany);
  }, [initialCompany]);

  const handleSave = async () => {
    setCompany({...editedCompany});
    const payload = {
      companyName: editedCompany.name,
      address: editedCompany.address,
      city: editedCompany.city,
      state: editedCompany.state,
      zip: editedCompany.zip,
      country: editedCompany.country,
      phone: editedCompany.phone,
      email: editedCompany.email,
      website: editedCompany.website,
      taxId: editedCompany.taxId,
      description: editedCompany.description,
      logoUrl: editedCompany.logoUrl,
    };
    const res = await updateOrganizationSettings(payload);
    if (res.success) {
      setIsEditing(false);
      toast({ title: 'Company information updated', description: 'Saved successfully.' });
    } else {
      toast({ variant: 'destructive', title: 'Save failed', description: res.error || 'Error saving' });
    }
  };

  const handleLogoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const file = e.target.files?.[0];
      if (!file) return;
      setUploadingLogo(true);

      // Resolve org id
      let orgId = organization?.org_id as string | undefined;
      if (!orgId) {
        const { data: orgRes, error: orgErr } = await supabase.rpc('get_user_org');
        if (orgErr || !orgRes) {
          toast({ variant: 'destructive', title: 'Upload failed', description: 'No organization found for upload.' });
          setUploadingLogo(false);
          return;
        }
        orgId = orgRes as string;
      }

      const ext = (file.name.split('.').pop() || 'png').toLowerCase();
      const path = `orgs/${orgId}/logo.${ext}`;
      const { error: upErr } = await supabase
        .storage
        .from('org-logos')
        .upload(path, file, { upsert: true, cacheControl: '3600', contentType: file.type || undefined });
      if (upErr) {
        toast({ variant: 'destructive', title: 'Upload failed', description: upErr.message });
        setUploadingLogo(false);
        return;
      }

      const { data: pub } = supabase
        .storage
        .from('org-logos')
        .getPublicUrl(path);
      const publicUrl = pub.publicUrl;
      setEditedCompany({ ...editedCompany, logoUrl: publicUrl });

      // Persist immediately so read view shows it without manual save
      const save = await updateOrganizationSettings({ logoUrl: publicUrl });
      if (save.success) {
        setCompany((c) => ({ ...c, logoUrl: publicUrl }));
        toast({ title: 'Logo updated', description: 'Company logo was uploaded successfully.' });
      } else {
        toast({ variant: 'destructive', title: 'Save failed', description: save.error || 'Could not save logo URL' });
      }
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Upload error', description: err?.message || 'Unknown error' });
    } finally {
      setUploadingLogo(false);
      // reset input so same file can be re-selected
      try { (e.target as HTMLInputElement).value = ''; } catch {}
    }
  };

  const handleCancel = () => {
    setEditedCompany({...company});
    setIsEditing(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Company Information</h3>
        {!isEditing ? (
          <div className="flex gap-2">
            {!organization && (
              <Button variant="outline" onClick={async () => {
                const name = prompt('Enter company name to create your organization:', editedCompany.name || 'My Company') || 'My Company';
                const res = await createOrganization(name, editedCompany.name || undefined);
                if (!res.success) {
                  toast({ variant: 'destructive', title: 'Failed to create organization', description: res.error });
                } else {
                  toast({ title: 'Organization created', description: 'You can now edit company info.' });
                  setIsEditing(true);
                }
              }}>Create Organization</Button>
            )}
            <Button onClick={() => setIsEditing(true)} disabled={loading || !organization}>Edit Information</Button>
          </div>
        ) : (
          <div className="space-x-2">
            <Button variant="outline" onClick={handleCancel}>Cancel</Button>
            <Button onClick={handleSave}>Save Changes</Button>
          </div>
        )}
      </div>
      
      {isEditing ? (
        <div className="grid gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="company-name">Company Name</Label>
              <Input 
                id="company-name" 
                value={editedCompany.name}
                onChange={(e) => setEditedCompany({...editedCompany, name: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company-tax">Tax ID / EIN</Label>
              <Input 
                id="company-tax" 
                value={editedCompany.taxId}
                onChange={(e) => setEditedCompany({...editedCompany, taxId: e.target.value})}
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="company-description">Company Description</Label>
            <Textarea 
              id="company-description" 
              value={editedCompany.description}
              onChange={(e) => setEditedCompany({...editedCompany, description: e.target.value})}
              rows={3}
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="company-address">Street Address</Label>
              <Input 
                id="company-address" 
                value={editedCompany.address}
                onChange={(e) => setEditedCompany({...editedCompany, address: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company-city">City</Label>
              <Input 
                id="company-city" 
                value={editedCompany.city}
                onChange={(e) => setEditedCompany({...editedCompany, city: e.target.value})}
              />
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="company-state">State/Province</Label>
              <Input 
                id="company-state" 
                value={editedCompany.state}
                onChange={(e) => setEditedCompany({...editedCompany, state: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company-zip">ZIP/Postal Code</Label>
              <Input 
                id="company-zip" 
                value={editedCompany.zip}
                onChange={(e) => setEditedCompany({...editedCompany, zip: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company-country">Country</Label>
              <Input 
                id="company-country" 
                value={editedCompany.country}
                onChange={(e) => setEditedCompany({...editedCompany, country: e.target.value})}
              />
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="company-phone">Phone Number</Label>
              <Input 
                id="company-phone" 
                value={editedCompany.phone}
                onChange={(e) => setEditedCompany({...editedCompany, phone: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company-email">Email</Label>
              <Input 
                id="company-email" 
                value={editedCompany.email}
                onChange={(e) => setEditedCompany({...editedCompany, email: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company-website">Website</Label>
              <Input 
                id="company-website" 
                value={editedCompany.website}
                onChange={(e) => setEditedCompany({...editedCompany, website: e.target.value})}
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="company-logo-url">Company Logo</Label>
            <div className="flex items-center gap-4">
              <img src={editedCompany.logoUrl} alt="Company Logo" className="w-16 h-16 object-contain border rounded p-1" onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/placeholder.svg' }} />
              <div className="flex flex-col gap-2">
                <Input
                  id="company-logo-url"
                  type="url"
                  placeholder="https://example.com/logo.png"
                  value={editedCompany.logoUrl}
                  onChange={(e) => setEditedCompany({ ...editedCompany, logoUrl: e.target.value })}
                />
                <Input id="company-logo-file" type="file" accept="image/*" onChange={handleLogoFileChange} disabled={uploadingLogo} />
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center space-y-2">
                <img src={company.logoUrl} alt="Company Logo" className="w-24 h-24 object-contain" onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/placeholder.svg' }} />
                <h3 className="text-xl font-bold">{company.name}</h3>
                <p className="text-sm text-muted-foreground">{company.description}</p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <h4 className="font-medium mb-4 flex items-center gap-2"><Building className="h-4 w-4" /> Contact Information</h4>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{company.phone}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span>{company.email}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <span>{company.website}</span>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <h4 className="font-medium mb-4 flex items-center gap-2"><MapPin className="h-4 w-4" /> Address</h4>
              <address className="not-italic space-y-1">
                <p>{company.address}</p>
                <p>{company.city}, {company.state} {company.zip}</p>
                <p>{company.country}</p>
              </address>
              <div className="mt-4 pt-4 border-t">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span>Tax ID: {company.taxId}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
