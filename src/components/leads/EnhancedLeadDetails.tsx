import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Lead } from '@/types/lead';
import { X, Edit, Building2, User, Globe, Phone, Mail, MapPin, DollarSign, Calendar, Activity, Bot, ExternalLink, FileText, Zap, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import ContactInfoSection from './ContactInfoSection';
import ActivityTimeline from './ActivityTimeline';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { supabase } from '@/lib/supabase';

interface EnhancedLeadDetailsProps {
  lead: Lead | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEditLead?: (lead: Lead) => void;
}

export default function EnhancedLeadDetails({ 
  lead, 
  open, 
  onOpenChange, 
  onEditLead 
}: EnhancedLeadDetailsProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const navigate = useNavigate();
  
  if (!lead) return null;

  const createdAt = new Date(lead.createdAt);
  const lastContactedAt = lead.lastContactedAt ? new Date(lead.lastContactedAt) : null;

  const handleEdit = () => {
    if (onEditLead) {
      onEditLead(lead);
    }
  };

  const handleCreateQuote = () => {
    // Pass lead data to quote creation
    const leadData = encodeURIComponent(JSON.stringify({
      leadId: lead.id,
      customerName: lead.name,
      company: lead.company,
      email: lead.email,
      phone: lead.phone,
      address: lead.address,
      estimatedValue: lead.value
    }));
    navigate(`/quotes/new?lead=${leadData}`);
    onOpenChange(false);
  };

  const handleDeleteLead = async () => {
    if (!lead) return;
    const { error } = await supabase.rpc('delete_lead', { p_lead_id: lead.id });
    if (error) {
      console.error('Failed to delete lead', error);
      return;
    }
    onOpenChange(false);
    // Emit a custom event so the page can refresh its list
    window.dispatchEvent(new CustomEvent('leads:refresh'));
  };

  // Check if quote exists based on lead status and quoteId
  const hasExistingQuote = lead.quoteId || ['quoted', 'follow_up', 'closed_won', 'closed_lost'].includes(lead.status);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl h-[90vh] flex flex-col p-0">
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <DialogTitle className="text-xl font-semibold">{lead.name}</DialogTitle>
              <Badge variant={lead.customerType === 'new' ? 'default' : 'secondary'}>
                {lead.customerType === 'new' ? 'New Customer' : 'Existing Customer'}
              </Badge>
            </div>
            <div className="flex items-center space-x-2 mr-10">
              <Button variant="outline" size="sm" onClick={handleEdit}>
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this lead?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete the lead and remove it from your pipeline.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteLead}>Delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
          <div className="flex items-center space-x-4 text-sm text-muted-foreground mt-2">
            <span className="flex items-center">
              <Building2 className="h-4 w-4 mr-1" />
              {lead.company}
            </span>
            <span className="flex items-center">
              <DollarSign className="h-4 w-4 mr-1" />
              ${lead.value.toLocaleString()}
            </span>
            <span className="flex items-center">
              <Calendar className="h-4 w-4 mr-1" />
              Created {formatDistanceToNow(createdAt, { addSuffix: true })}
            </span>
          </div>
        </DialogHeader>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
            <TabsList className="mx-6 mt-4 w-fit">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="activity">Activity & Communication</TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-auto px-6 pb-6">
              <TabsContent value="overview" className="mt-4 space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <ContactInfoSection lead={lead} />
                  
                  {/* Company Information Card */}
                  <div className="bg-card p-6 rounded-lg border">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold flex items-center">
                        <Building2 className="h-5 w-5 mr-2" />
                        Company Information
                      </h3>
                    </div>
                    
                    <div className="space-y-4">
                      {/* Company Name */}
                      <div>
                        <div className="font-medium">{lead.company}</div>
                        <div className="text-sm text-muted-foreground">Company Name</div>
                      </div>

                      {/* Website */}
                      {lead.companyInfo?.website && (
                        <div>
                          <div className="font-medium flex items-center">
                            <span className="mr-2">{lead.companyInfo.website}</span>
                            <Button variant="ghost" size="sm" asChild>
                              <a href={lead.companyInfo.website} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            </Button>
                          </div>
                          <div className="text-sm text-muted-foreground">Website</div>
                        </div>
                      )}

                      {/* Company Size */}
                      {lead.companyInfo?.size && (
                        <div>
                          <div className="font-medium">{lead.companyInfo.size}</div>
                          <div className="text-sm text-muted-foreground">Company Size</div>
                        </div>
                      )}

                      {/* Industry */}
                      {lead.companyInfo?.industry && (
                        <div>
                          <div className="flex flex-wrap gap-1 mb-1">
                            {lead.companyInfo.industry.split(',').map((industry, index) => (
                              <Badge key={index} variant="secondary" className="text-xs">
                                {industry.trim()}
                              </Badge>
                            ))}
                          </div>
                          <div className="text-sm text-muted-foreground">Industry</div>
                        </div>
                      )}

                      {/* Estimated Annual Spend */}
                      {lead.companyInfo?.estimatedAnnualSpend && (
                        <div>
                          <div className="font-medium">
                            ${(lead.companyInfo.estimatedAnnualSpend / 1000).toFixed(0)}K annually
                          </div>
                          <div className="text-sm text-muted-foreground">Estimated Merch Spend</div>
                        </div>
                      )}

                       {/* Company Social Links */}
                       {lead.companyInfo?.socialProfiles && Object.values(lead.companyInfo.socialProfiles).some(url => url) && (
                         <div>
                           <div className="text-sm text-muted-foreground mb-2">Company Social Media</div>
                           <div className="space-y-2">
                             {lead.companyInfo.socialProfiles.linkedin && (
                               <div className="flex items-center justify-between">
                                 <span className="text-sm">LinkedIn</span>
                                 <Button variant="ghost" size="sm" asChild>
                                   <a href={lead.companyInfo.socialProfiles.linkedin} target="_blank" rel="noopener noreferrer">
                                     <ExternalLink className="h-4 w-4" />
                                   </a>
                                 </Button>
                               </div>
                             )}
                             {lead.companyInfo.socialProfiles.facebook && (
                               <div className="flex items-center justify-between">
                                 <span className="text-sm">Facebook</span>
                                 <Button variant="ghost" size="sm" asChild>
                                   <a href={lead.companyInfo.socialProfiles.facebook} target="_blank" rel="noopener noreferrer">
                                     <ExternalLink className="h-4 w-4" />
                                   </a>
                                 </Button>
                               </div>
                             )}
                             {lead.companyInfo.socialProfiles.twitter && (
                               <div className="flex items-center justify-between">
                                 <span className="text-sm">Twitter</span>
                                 <Button variant="ghost" size="sm" asChild>
                                   <a href={lead.companyInfo.socialProfiles.twitter} target="_blank" rel="noopener noreferrer">
                                     <ExternalLink className="h-4 w-4" />
                                   </a>
                                 </Button>
                               </div>
                             )}
                             {lead.companyInfo.socialProfiles.youtube && (
                               <div className="flex items-center justify-between">
                                 <span className="text-sm">YouTube</span>
                                 <Button variant="ghost" size="sm" asChild>
                                   <a href={lead.companyInfo.socialProfiles.youtube} target="_blank" rel="noopener noreferrer">
                                     <ExternalLink className="h-4 w-4" />
                                   </a>
                                 </Button>
                               </div>
                             )}
                           </div>
                         </div>
                       )}
                     </div>
                  </div>
                  
                  {/* Quote Actions Card */}
                  <div className="bg-card p-6 rounded-lg border">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold">Quote Management</h3>
                    </div>
                    
                    <div className="space-y-4">
                      {/* Estimated Value */}
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Estimated Value</span>
                        <span className="font-semibold">${lead.value.toLocaleString()}</span>
                      </div>
                      
                      {/* Quote Status */}
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Quote Status</span>
                        <Badge variant={hasExistingQuote ? "default" : "outline"}>
                          {hasExistingQuote ? "Quote Exists" : "No Quote"}
                        </Badge>
                      </div>
                      
                      {/* Action Button */}
                      <div className="pt-2">
                        <Button 
                          onClick={handleCreateQuote} 
                          className="w-full"
                          variant={hasExistingQuote ? "outline" : "default"}
                        >
                          <FileText className="h-4 w-4 mr-2" />
                          {hasExistingQuote ? "View Quote" : "Create Quote"}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Notes */}
                  <div className="bg-card p-6 rounded-lg border">
                    <div className="mb-4">
                      <h3 className="text-lg font-semibold flex items-center">
                        <FileText className="h-5 w-5 mr-2" />
                        Notes
                      </h3>
                    </div>
                  
                  <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {lead.notes || lead.inquirySummary || lead.currentStage || "No notes available for this customer yet."}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="activity" className="mt-4">
                <ActivityTimeline leadId={lead.id} />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}