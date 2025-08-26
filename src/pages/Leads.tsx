import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import LeadBoard from '@/components/leads/LeadBoard';
import LeadCard from '@/components/leads/LeadCard';
import EnhancedLeadDetails from '@/components/leads/EnhancedLeadDetails';
import CreateLeadDialog from '@/components/leads/CreateLeadDialog';
import EditLeadDialog from '@/components/leads/EditLeadDialog';
import { Lead, LeadColumn, LeadStatus } from '@/types/lead';

const initialLeads: Lead[] = [
  /* removed demo leads */
  /* {
    id: 'pamela-hunt',
    name: 'Pamela Hunt',
    company: 'Western Alliance Transport',
    email: 'pamela@westernalliancetransport.com',
    phone: '514-512-9926',
    status: 'quoted',
    value: 12000,
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days ago
    lastContactedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
    notes: 'Urgent order for staff merchandise - needs delivery by next Thursday. Quantities: T-shirts & Hoodies (20 S, 50 M, 50 L, 20 XL), Hats (140 units). Selected: Gildan 5000 t-shirts, Comfort Colors 1467 hoodies, Valucap VC300A hats. Logo placement: front decoration on all items, back slogan on shirts/hoodies, embroidered logo on hats.',
    customerType: 'new',
    aiEnriched: true,
    dataSource: 'email',
    confidenceScore: 0.92,
    jobTitle: 'Procurement Manager',
    address: {
      street: '2450 Boulevard Industriel',
      city: 'Montreal',
      state: 'QC',
      zip: 'H1P 3K2',
      country: 'Canada'
    },
    socialProfiles: {
      linkedin: 'https://linkedin.com/in/pamelahunt'
    },
    companyInfo: {
      size: '100-500 employees',
      industry: 'Transportation & Logistics',
      estimatedAnnualSpend: 20000,
      website: 'https://westernalliancetransport.com',
      socialProfiles: {
        linkedin: 'https://linkedin.com/company/western-alliance-transport',
        facebook: 'https://facebook.com/westernalliancetransport'
      }
    },
    lastEnrichedAt: new Date().toISOString(),
    totalActivities: 6,
    lastActivityType: 'email',
    quoteId: '3046'
  }, */
  {
    id: '1',
    name: 'John Smith',
    company: 'Acme Corp',
    email: 'john@acmecorp.com',
    phone: '555-123-4567',
    status: 'new_lead',
    value: 5000,
    createdAt: new Date().toISOString(),
    lastContactedAt: new Date().toISOString(),
    notes: 'Customer needs custom t-shirts and hats for their annual music festival scheduled for September 1st. They are expecting approximately 2,500 attendees and want to offer branded merchandise at their vendor booths. • T-shirt requirements: 500 units in various sizes (S-XXL), preferably 100% cotton, with festival logo and date on front, sponsor logos on back • Hat requirements: 300 units, adjustable baseball caps or snapbacks, embroidered festival logo • Timeline is tight - need final designs approved by August 15th for production to meet September 1st deadline • Budget range: $8,000-$12,000 total • Previous experience with local suppliers was disappointing due to quality issues • Looking for a reliable partner who can handle rush orders and maintain consistent quality standards • Interested in potential ongoing partnership for future events',
    customerType: 'new',
    aiEnriched: true,
    dataSource: 'email',
    confidenceScore: 0.85,
    jobTitle: 'Marketing Director',
    address: {
      street: '123 Business Ave',
      city: 'New York',
      state: 'NY',
      zip: '10001',
      country: 'USA'
    },
    socialProfiles: {
      linkedin: 'https://linkedin.com/in/johnsmith'
    },
    companyInfo: {
      size: '50-200 employees',
      industry: 'Technology, Software',
      estimatedAnnualSpend: 15000,
      website: 'https://acmecorp.com',
      socialProfiles: {
        linkedin: 'https://linkedin.com/company/acme-corp',
        facebook: 'https://facebook.com/acmecorp',
        twitter: 'https://twitter.com/acmecorp'
      }
    },
    lastEnrichedAt: new Date().toISOString(),
    totalActivities: 3,
    lastActivityType: 'email'
  },
  {
    id: '2',
    name: 'Sarah Johnson',
    company: 'XYZ Industries',
    email: 'sarah@xyzind.com',
    status: 'in_contact',
    value: 7500,
    createdAt: new Date().toISOString(),
    lastContactedAt: new Date().toISOString(),
    customerType: 'existing',
    existingCustomerId: 'cust-123',
    aiEnriched: true,
    dataSource: 'form',
    confidenceScore: 0.92,
    jobTitle: 'Operations Manager',
    socialProfiles: {
      linkedin: 'https://linkedin.com/in/sarahjohnson'
    },
    companyInfo: {
      size: '200-500 employees',
      industry: 'Manufacturing',
      estimatedAnnualSpend: 25000,
      website: 'https://xyzindustries.com',
      socialProfiles: {
        linkedin: 'https://linkedin.com/company/xyz-industries',
        facebook: 'https://facebook.com/xyzindustries'
      }
    },
    totalActivities: 5,
    lastActivityType: 'call'
  },
  {
    id: '3',
    name: 'Michael Brown',
    company: 'Global Solutions',
    email: 'michael@globalsolutions.com',
    status: 'qualified',
    value: 10000,
    createdAt: new Date().toISOString(),
    customerType: 'new',
    aiEnriched: false,
    dataSource: 'manual',
    jobTitle: 'VP of Operations',
    socialProfiles: {
      linkedin: 'https://linkedin.com/in/michaelbrown'
    },
    companyInfo: {
      size: '1000+ employees',
      industry: 'Consulting, Enterprise Solutions',
      estimatedAnnualSpend: 35000,
      website: 'https://globalsolutions.com',
      socialProfiles: {
        linkedin: 'https://linkedin.com/company/global-solutions',
        twitter: 'https://twitter.com/globalsolutions',
        youtube: 'https://youtube.com/globalsolutions'
      }
    },
    totalActivities: 1,
    lastActivityType: 'note'
  },
  {
    id: '4',
    name: 'Emily Davis',
    company: 'Merchly Promotional Products',
    email: 'emily@merchlypromo.com',
    status: 'quoted',
    value: 3240,
    createdAt: new Date().toISOString(),
    lastContactedAt: new Date().toISOString(),
    customerType: 'existing',
    aiEnriched: true,
    dataSource: 'ai',
    confidenceScore: 0.78,
    quoteId: 'quote-001',
    jobTitle: 'Product Manager',
    socialProfiles: {
      linkedin: 'https://linkedin.com/in/emilydavis'
    },
    companyInfo: {
      size: '10-50 employees',
      industry: 'Technology, Startups',
      estimatedAnnualSpend: 8000,
      website: 'https://techinnovators.com',
      socialProfiles: {
        linkedin: 'https://linkedin.com/company/tech-innovators',
        twitter: 'https://twitter.com/techinnovators',
        facebook: 'https://facebook.com/techinnovators'
      }
    },
    totalActivities: 7,
    lastActivityType: 'meeting'
  },
  {
    id: '5',
    name: 'Robert Wilson',
    company: 'Future Enterprises',
    email: 'robert@futureent.com',
    status: 'follow_up',
    value: 25000,
    createdAt: new Date().toISOString(),
    customerType: 'new',
    aiEnriched: true,
    dataSource: 'email',
    confidenceScore: 0.95,
    quoteId: 'quote-002',
    jobTitle: 'Chief Technology Officer',
    socialProfiles: {
      linkedin: 'https://linkedin.com/in/robertwilson'
    },
    companyInfo: {
      size: '500+ employees',
      industry: 'Enterprise, Consulting',
      estimatedAnnualSpend: 50000,
      website: 'https://futureenterprises.com',
      socialProfiles: {
        linkedin: 'https://linkedin.com/company/future-enterprises',
        facebook: 'https://facebook.com/futureenterprises',
        twitter: 'https://twitter.com/futureent',
        youtube: 'https://youtube.com/futureenterprises'
      }
    },
    totalActivities: 12,
    lastActivityType: 'email'
  },
  {
    id: '6',
    name: 'Lisa Chen',
    company: 'Startup Hub',
    email: 'lisa@startuphub.com',
    phone: '555-789-0123',
    status: 'new_lead',
    value: 3200,
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    lastContactedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    notes: 'Looking for branded merchandise for tech startup accelerator program. Need hoodies, water bottles, and laptop stickers for 50 startups.',
    customerType: 'new',
    aiEnriched: true,
    dataSource: 'form',
    confidenceScore: 0.88,
    jobTitle: 'Community Manager',
    address: {
      street: '500 Innovation Way',
      city: 'San Francisco',
      state: 'CA',
      zip: '94105',
      country: 'USA'
    },
    companyInfo: {
      size: '20-50 employees',
      industry: 'Startups, Incubators',
      estimatedAnnualSpend: 12000,
      website: 'https://startuphub.com'
    },
    totalActivities: 2,
    lastActivityType: 'form_submission'
  },
  {
    id: '7',
    name: 'David Rodriguez',
    company: 'Local Sports League',
    email: 'david@localsports.org',
    phone: '555-456-7890',
    status: 'in_contact',
    value: 8500,
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    lastContactedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    notes: 'Annual uniform order for 8 teams. Need jerseys, shorts, and warm-up gear. Looking for sublimation printing options.',
    customerType: 'existing',
    existingCustomerId: 'cust-456',
    aiEnriched: true,
    dataSource: 'email',
    confidenceScore: 0.91,
    jobTitle: 'League Commissioner',
    companyInfo: {
      size: '10-20 employees',
      industry: 'Sports, Recreation',
      estimatedAnnualSpend: 18000,
      website: 'https://localsportsleague.org'
    },
    totalActivities: 8,
    lastActivityType: 'call'
  },
  {
    id: '8',
    name: 'Amanda Thompson',
    company: 'Green Energy Solutions',
    email: 'amanda@greenenergy.com',
    phone: '555-321-6547',
    status: 'qualified',
    value: 18000,
    createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    lastContactedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    notes: 'Corporate rebranding project. Need new uniforms, promotional items, and trade show materials. Sustainability focus important.',
    customerType: 'new',
    aiEnriched: true,
    dataSource: 'ai',
    confidenceScore: 0.87,
    jobTitle: 'Marketing Director',
    address: {
      street: '789 Renewable Blvd',
      city: 'Austin',
      state: 'TX',
      zip: '78701',
      country: 'USA'
    },
    companyInfo: {
      size: '100-200 employees',
      industry: 'Renewable Energy',
      estimatedAnnualSpend: 30000,
      website: 'https://greenenergysolutions.com'
    },
    totalActivities: 6,
    lastActivityType: 'meeting'
  },
  {
    id: '9',
    name: 'Carlos Martinez',
    company: 'Restaurant Chain Plus',
    email: 'carlos@restaurantplus.com',
    status: 'follow_up',
    value: 22000,
    createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    lastContactedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    notes: 'Multi-location uniform program. 15 restaurants need server uniforms, aprons, and branded merchandise for customer giveaways.',
    customerType: 'new',
    aiEnriched: false,
    dataSource: 'manual',
    quoteId: 'quote-003',
    jobTitle: 'Operations Director',
    companyInfo: {
      size: '200-500 employees',
      industry: 'Food Service, Restaurants',
      estimatedAnnualSpend: 40000,
      website: 'https://restaurantchainplus.com'
    },
    totalActivities: 15,
    lastActivityType: 'email'
  },
  {
    id: '10',
    name: 'Jennifer Lee',
    company: 'Healthcare Associates',
    email: 'jennifer@healthcareassoc.com',
    phone: '555-987-6543',
    status: 'closed_won',
    value: 35000,
    createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    lastContactedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    notes: 'Large healthcare network uniform contract. Successfully delivered scrubs, lab coats, and accessories for 3 facilities.',
    customerType: 'existing',
    existingCustomerId: 'cust-789',
    aiEnriched: true,
    dataSource: 'email',
    confidenceScore: 0.96,
    quoteId: 'quote-004',
    jobTitle: 'Procurement Manager',
    companyInfo: {
      size: '1000+ employees',
      industry: 'Healthcare',
      estimatedAnnualSpend: 75000,
      website: 'https://healthcareassociates.com'
    },
    totalActivities: 25,
    lastActivityType: 'meeting'
  },
  {
    id: '11',
    name: 'Mark Johnson',
    company: 'Construction Pro',
    email: 'mark@constructionpro.com',
    phone: '555-111-2222',
    status: 'closed_lost',
    value: 12000,
    createdAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
    lastContactedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
    notes: 'Safety workwear for construction crews. Lost to competitor due to pricing. Consider more competitive options for future.',
    customerType: 'new',
    aiEnriched: true,
    dataSource: 'form',
    confidenceScore: 0.83,
    jobTitle: 'Safety Coordinator',
    companyInfo: {
      size: '50-100 employees',
      industry: 'Construction',
      estimatedAnnualSpend: 25000,
      website: 'https://constructionpro.com'
    },
    totalActivities: 8,
    lastActivityType: 'email'
  },
  {
    id: '12',
    name: 'Rachel Kim',
    company: 'University Athletics',
    email: 'rachel@universityathletics.edu',
    phone: '555-333-4444',
    status: 'quoted',
    value: 45000,
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    lastContactedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    notes: 'Complete athletic department rebrand. Need uniforms for 12 sports teams, coaching staff apparel, and fan merchandise.',
    customerType: 'existing',
    existingCustomerId: 'cust-101',
    aiEnriched: true,
    dataSource: 'email',
    confidenceScore: 0.94,
    quoteId: 'quote-005',
    jobTitle: 'Athletic Director',
    companyInfo: {
      size: '500+ employees',
      industry: 'Education, Sports',
      estimatedAnnualSpend: 85000,
      website: 'https://universityathletics.edu'
    },
    totalActivities: 12,
    lastActivityType: 'meeting'
  },
  {
    id: '13',
    name: 'Kevin O\'Brien',
    company: 'Tech Solutions Inc',
    email: 'kevin@techsolutions.com',
    status: 'new_lead',
    value: 6800,
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    notes: 'Corporate event merchandise needed. Company retreat for 200 employees in 6 weeks.',
    customerType: 'new',
    aiEnriched: false,
    dataSource: 'manual',
    jobTitle: 'HR Manager',
    companyInfo: {
      size: '100-300 employees',
      industry: 'Technology',
      estimatedAnnualSpend: 15000,
      website: 'https://techsolutions.com'
    },
    totalActivities: 1,
    lastActivityType: 'note'
  },
  {
    id: '14',
    name: 'Sophie Williams',
    company: 'Fitness First Gyms',
    email: 'sophie@fitnessfirst.com',
    phone: '555-777-8888',
    status: 'in_contact',
    value: 16500,
    createdAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
    lastContactedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    notes: 'Staff uniforms for 8 gym locations. Need performance fabrics for trainers and front desk staff.',
    customerType: 'new',
    aiEnriched: true,
    dataSource: 'email',
    confidenceScore: 0.89,
    jobTitle: 'Regional Manager',
    companyInfo: {
      size: '200-400 employees',
      industry: 'Fitness, Health',
      estimatedAnnualSpend: 28000,
      website: 'https://fitnessfirst.com'
    },
    totalActivities: 7,
    lastActivityType: 'call'
  },
  {
    id: '15',
    name: 'Thomas Anderson',
    company: 'Manufacturing Corp',
    email: 'thomas@manufacturingcorp.com',
    phone: '555-555-5555',
    status: 'qualified',
    value: 28000,
    createdAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(),
    lastContactedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    notes: 'Industrial workwear program. Safety compliance requirements for 300+ workers across 3 shifts.',
    customerType: 'existing',
    existingCustomerId: 'cust-202',
    aiEnriched: true,
    dataSource: 'ai',
    confidenceScore: 0.92,
    jobTitle: 'Plant Manager',
    companyInfo: {
      size: '500+ employees',
      industry: 'Manufacturing',
      estimatedAnnualSpend: 55000,
      website: 'https://manufacturingcorp.com'
    },
    totalActivities: 9,
    lastActivityType: 'meeting'
  }
];

const columns: LeadColumn[] = [
  { id: 'new_lead', title: 'New Lead', leads: [] },
  { id: 'in_contact', title: 'In Contact', leads: [] },
  { id: 'qualified', title: 'Qualified', leads: [] },
  { id: 'quoted', title: 'Quoted', leads: [] },
  { id: 'follow_up', title: 'Follow Up', leads: [] },
  { id: 'closed_won', title: 'Closed Won', leads: [] },
  { id: 'closed_lost', title: 'Closed Lost', leads: [] },
];

export default function Leads() {
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [boardColumns, setBoardColumns] = useState<LeadColumn[]>(columns);
  
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeLead, setActiveLead] = useState<Lead | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [showLeadDetails, setShowLeadDetails] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [leadToEdit, setLeadToEdit] = useState<Lead | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    setActiveId(active.id as string);
    
    const lead = leads.find(lead => lead.id === active.id);
    if (lead) {
      setActiveLead(lead);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      const leadId = active.id as string;
      const newStatus = over.id as LeadStatus;
      
      setLeads(prevLeads => 
        prevLeads.map(lead => 
          lead.id === leadId 
            ? { ...lead, status: newStatus }
            : lead
        )
      );
      
      const updatedColumns = boardColumns.map(column => ({
        ...column,
        leads: column.leads.filter(lead => lead.id !== leadId)
      }));
      
      const targetColumnIndex = updatedColumns.findIndex(column => column.id === newStatus);
      const leadToMove = leads.find(lead => lead.id === leadId);
      
      if (targetColumnIndex !== -1 && leadToMove) {
        updatedColumns[targetColumnIndex].leads.push({
          ...leadToMove,
          status: newStatus
        });
      }
      
      setBoardColumns(updatedColumns);
    }
    
    setActiveId(null);
    setActiveLead(null);
  };

  const handleCreateLead = (newLead: Omit<Lead, 'id' | 'createdAt'>) => {
    const lead: Lead = {
      ...newLead,
      id: `lead-${Date.now()}`,
      createdAt: new Date().toISOString()
    };
    
    setLeads(prev => [...prev, lead]);
    
    const updatedColumns = [...boardColumns];
    const columnIndex = updatedColumns.findIndex(col => col.id === lead.status);
    if (columnIndex !== -1) {
      updatedColumns[columnIndex].leads.push(lead);
      setBoardColumns(updatedColumns);
    }
    
    setShowCreateDialog(false);
  };

  const handleLeadClick = (lead: Lead) => {
    setSelectedLead(lead);
    setShowLeadDetails(true);
  };

  const handleLeadDetailsClose = (open: boolean) => {
    setShowLeadDetails(open);
    if (!open) {
      setSelectedLead(null);
    }
  };

  const handleEditLead = (lead: Lead) => {
    setLeadToEdit(lead);
    setShowEditDialog(true);
    setShowLeadDetails(false); // Close the details dialog
  };

  const handleSaveEditedLead = (updatedLead: Lead) => {
    setLeads(prevLeads => 
      prevLeads.map(lead => 
        lead.id === updatedLead.id ? updatedLead : lead
      )
    );

    // Update the board columns
    const updatedColumns = boardColumns.map(column => ({
      ...column,
      leads: column.leads.map(lead => 
        lead.id === updatedLead.id ? updatedLead : lead
      )
    }));
    setBoardColumns(updatedColumns);

    // Update selected lead if it's currently displayed
    if (selectedLead?.id === updatedLead.id) {
      setSelectedLead(updatedLead);
    }

    setShowEditDialog(false);
    setLeadToEdit(null);
  };

  return (
    <div className="flex flex-col w-full h-full p-6 overflow-hidden">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Lead Pipeline</h1>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Lead
        </Button>
      </div>
      
      <div className="flex-1 overflow-hidden">
        <DndContext 
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <LeadBoard columns={boardColumns} onLeadClick={handleLeadClick} />
          <DragOverlay>
            {activeId && activeLead ? (
              <LeadCard 
                lead={activeLead} 
                isDragging 
                onClick={() => {}}
              />
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
      
      {showCreateDialog && (
        <CreateLeadDialog 
          open={showCreateDialog}
          onClose={() => setShowCreateDialog(false)}
          onSave={handleCreateLead}
        />
      )}

      <EnhancedLeadDetails 
        lead={selectedLead}
        open={showLeadDetails}
        onOpenChange={handleLeadDetailsClose}
        onEditLead={handleEditLead}
      />

      <EditLeadDialog
        open={showEditDialog}
        onClose={() => setShowEditDialog(false)}
        onSave={handleSaveEditedLead}
        lead={leadToEdit}
      />
    </div>
  );
}
