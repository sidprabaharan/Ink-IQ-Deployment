import React, { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { ChevronDown } from 'lucide-react';
import { GarmentStatus, GARMENT_STATUS_CONFIG, GarmentDetails } from '@/types/garment';
import { useOrganization } from '@/context/OrganizationContext';
import { useToast } from '@/hooks/use-toast';
import { runStatusChangeAutomations } from '@/lib/automation';
import { GarmentStatusBadge } from './GarmentStatusBadge';
import { deliverWithRetry } from '@/lib/webhook';
import { triggerViaRelay } from '@/lib/webhookRelay';

interface GarmentStatusDropdownProps {
  garmentDetails: GarmentDetails;
  onStatusChange: (status: GarmentStatus, notes?: string) => void;
  onReportIssue: () => void;
}

export function GarmentStatusDropdown({ 
  garmentDetails, 
  onStatusChange, 
  onReportIssue 
}: GarmentStatusDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const hasIssues = garmentDetails.stockIssues.length > 0;
  const { organization } = useOrganization();
  const { toast } = useToast();

  const handleStatusChange = (newStatus: GarmentStatus) => {
    try {
      if (!garmentDetails.id) {
        console.warn('[ui] GarmentStatusDropdown missing garment id');
      }
      console.groupCollapsed('[ui] GarmentStatusDropdown change', { id: garmentDetails.id, from: garmentDetails.status, to: newStatus });
    } catch {}
    onStatusChange(newStatus);
    setIsOpen(false);

    // Fire status-change automations for garments
    try {
      const label = GARMENT_STATUS_CONFIG[newStatus]?.label || String(newStatus);
      runStatusChangeAutomations(organization?.org_settings, {
        entityType: 'garment',
        toStatus: label,
        payload: { garmentId: garmentDetails.id || '(unknown)' }
      }, {
        notify: (title, description) => toast({ title, description }),
        triggerWebhook: async (url, payload, opts) => {
          try {
            // Prefer server-side relay to avoid CORS
            await triggerViaRelay({ url, payload, secret: opts?.secret })
          } catch (e) {
            console.warn('[relay] failed, falling back to direct webhook', e)
            try { await deliverWithRetry(url, payload, { secret: opts?.secret }); } catch (e2) { console.warn('[webhook] failed', e2); }
          }
        }
      });
    } catch {}
    try { console.groupEnd?.(); } catch {}
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          className="h-auto p-1 hover:bg-muted"
        >
          <div className="flex items-center gap-2">
            <GarmentStatusBadge 
              status={garmentDetails.status} 
              hasIssues={hasIssues}
            />
            <ChevronDown className="h-3 w-3" />
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56 bg-background border">
        <DropdownMenuLabel>Update Status</DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {Object.entries(GARMENT_STATUS_CONFIG).map(([status, config]) => (
          <DropdownMenuItem
            key={status}
            onClick={() => handleStatusChange(status as GarmentStatus)}
            className={`cursor-pointer ${
              status === garmentDetails.status ? 'bg-muted' : ''
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <span>{config.label}</span>
              {status === garmentDetails.status && (
                <span className="text-xs text-muted-foreground">Current</span>
              )}
            </div>
          </DropdownMenuItem>
        ))}
        
        <DropdownMenuSeparator />
        
        <DropdownMenuItem 
          onClick={onReportIssue}
          className="cursor-pointer text-orange-600 hover:text-orange-700"
        >
          Report Issue
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}