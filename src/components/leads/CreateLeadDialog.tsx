
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Lead, LeadStatus } from '@/types/lead';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface CreateLeadDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (lead: Omit<Lead, 'id' | 'createdAt'>) => void;
}

export default function CreateLeadDialog({ open, onClose, onSave }: CreateLeadDialogProps) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    name: '',
    company: '',
    email: '',
    phone: '',
    status: 'new_lead' as LeadStatus,
    value: 0,
    notes: '',
    // Business info
    website: '',
    companySize: '',
    estimatedSpend: '' as any,
    linkedin: '',
    facebook: '',
    twitter: '',
  });

  const onlyDigits = (s: string) => (s || '').replace(/\D+/g, '');
  const formatPhone = (raw: string) => {
    const digits = onlyDigits(raw);
    // Handle US/CA 10-digit format; keep country code 1 if present
    let d = digits;
    if (d.length === 11 && d.startsWith('1')) d = d.slice(1);
    if (d.length <= 3) return d;
    if (d.length <= 6) return `(${d.slice(0,3)}) ${d.slice(3)}`;
    return `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6,10)}`;
  };

  const handleCompanyBlur = () => {
    const digits = onlyDigits(formData.company);
    const looksLikePhone = digits.length >= 7 && digits.length <= 15 && formData.company.replace(/[\d\s()+\-\.]/g, '') === '';
    if (looksLikePhone) {
      setFormData(prev => ({ ...prev, company: '', phone: formatPhone(prev.company) }));
    }
  };

  const handlePhoneBlur = () => {
    if (formData.phone) {
      setFormData(prev => ({ ...prev, phone: formatPhone(prev.phone) }));
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    // Detect phone typed into company field → move to phone with formatting
    if (name === 'company') {
      const digits = onlyDigits(value);
      const looksLikePhone = digits.length >= 7 && digits.length <= 15 && value.replace(/[\d\s()+\-\.]/g, '') === '';
      if (looksLikePhone) {
        setFormData(prev => ({
          ...prev,
          company: '',
          phone: formatPhone(value),
        }));
        return;
      }
    }
    // Live-format phone input
    if (name === 'phone') {
      setFormData(prev => ({ ...prev, phone: formatPhone(value) }));
      return;
    }
    setFormData(prev => ({
      ...prev,
      [name]: name === 'value' ? parseFloat(value) || 0 : name === 'estimatedSpend' ? (value === '' ? '' : parseFloat(value) || 0) : value,
    }));
  };

  const handleStatusChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      status: value as LeadStatus,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
      onSave({
      name: formData.name,
      company: formData.company,
      email: formData.email,
      phone: formData.phone,
      status: formData.status,
      value: formData.value,
      notes: formData.notes,
      customerType: 'new',
        dataSource: 'manual',
        aiEnriched: false,
      companyInfo: {
        website: formData.website || undefined,
        size: formData.companySize || undefined,
        estimatedAnnualSpend: typeof formData.estimatedSpend === 'number' ? formData.estimatedSpend : undefined,
      },
      socialProfiles: {
        linkedin: formData.linkedin || undefined,
        facebook: formData.facebook || undefined,
        twitter: formData.twitter || undefined,
      },
    } as any);
      // Reset form
      setFormData({
        name: '',
        company: '',
        email: '',
        phone: '',
        status: 'new_lead',
        value: 0,
        notes: '',
      website: '',
      companySize: '',
      estimatedSpend: '',
      linkedin: '',
      facebook: '',
      twitter: '',
    });
    setStep(1);
  };

  const isValid = formData.name && formData.company && formData.email;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[640px] md:max-w-[720px]">
        <DialogHeader>
          <DialogTitle>Add New Lead</DialogTitle>
          <DialogDescription>
            {step === 1 ? 'Enter contact details' : 'Enter business information'}
          </DialogDescription>
        </DialogHeader>
        {/* Step indicator */}
        <div className="mb-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <div className={(step >= 1 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground') + ' h-6 w-6 rounded-full flex items-center justify-center'}>1</div>
            <span className={step === 1 ? 'text-foreground' : 'text-muted-foreground'}>Contact</span>
            <div className="h-px flex-1 bg-border" />
            <div className={(step >= 2 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground') + ' h-6 w-6 rounded-full flex items-center justify-center'}>2</div>
            <span className={step === 2 ? 'text-foreground' : 'text-muted-foreground'}>Business</span>
          </div>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            {step === 1 ? (
              <>
                <div className="rounded-lg border bg-background p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                      <Input id="name" name="name" placeholder="Jane Doe" value={formData.name} onChange={handleInputChange} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company">Company *</Label>
                      <Input id="company" name="company" placeholder="Acme Corp" value={formData.company} onChange={handleInputChange} onBlur={handleCompanyBlur} required />
              </div>
            </div>
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                      <Input id="email" name="email" type="email" placeholder="name@company.com" value={formData.email} onChange={handleInputChange} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                      <Input id="phone" name="phone" placeholder="(555) 555-5555" value={formData.phone || ''} onChange={handleInputChange} onBlur={handlePhoneBlur} />
              </div>
            </div>
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                      <Select defaultValue={formData.status} onValueChange={handleStatusChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new_lead">New Lead</SelectItem>
                    <SelectItem value="in_contact">In Contact</SelectItem>
                    <SelectItem value="qualified">Qualified</SelectItem>
                    <SelectItem value="quoted">Quoted</SelectItem>
                    <SelectItem value="follow_up">Follow Up</SelectItem>
                    <SelectItem value="closed_won">Closed Won</SelectItem>
                    <SelectItem value="closed_lost">Closed Lost</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="value">Deal Value ($)</Label>
                      <Input id="value" name="value" type="number" min="0" placeholder="e.g., 12000" value={formData.value || ''} onChange={handleInputChange} />
                    </div>
                  </div>
                  <div className="mt-4 space-y-2">
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea id="notes" name="notes" rows={3} placeholder="Add context about the request, timeline, products, etc." value={formData.notes || ''} onChange={handleInputChange} />
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="rounded-lg border bg-background p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="website">Website</Label>
                      <Input id="website" name="website" placeholder="https://company.com" value={formData.website} onChange={handleInputChange} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="companySize">Company Size</Label>
                      <Input id="companySize" name="companySize" placeholder="e.g., 50-200" value={formData.companySize} onChange={handleInputChange} />
              </div>
            </div>
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="estimatedSpend">Estimated Merch Spend ($/yr)</Label>
                      <Input id="estimatedSpend" name="estimatedSpend" type="number" min="0" placeholder="e.g., 15000" value={formData.estimatedSpend} onChange={handleInputChange} />
                    </div>
                    <div className="space-y-2" />
                  </div>
                  <div className="mt-4">
                    <div className="text-sm text-muted-foreground mb-2">Social media (optional)</div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="linkedin">LinkedIn</Label>
                        <Input id="linkedin" name="linkedin" placeholder="https://linkedin.com/company/..." value={formData.linkedin} onChange={handleInputChange} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="facebook">Facebook</Label>
                        <Input id="facebook" name="facebook" placeholder="https://facebook.com/..." value={formData.facebook} onChange={handleInputChange} />
                      </div>
            <div className="space-y-2">
                        <Label htmlFor="twitter">Twitter / X</Label>
                        <Input id="twitter" name="twitter" placeholder="https://twitter.com/..." value={formData.twitter} onChange={handleInputChange} />
                      </div>
                    </div>
            </div>
                </div>
              </>
            )}
          </div>
          
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            {step === 2 ? (
              <>
                <Button type="button" variant="secondary" onClick={() => setStep(1)}>Back</Button>
                <Button type="submit" disabled={!isValid}>Add Lead</Button>
              </>
            ) : (
              <Button type="button" onClick={() => setStep(2)} disabled={!isValid}>Next</Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
