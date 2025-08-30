import React from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, FileText, Palette, CheckCircle, Cog, Package, DollarSign, CreditCard, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useOrganization } from "@/context/OrganizationContext";
import { runStatusChangeAutomations } from "@/lib/automation";
import { renderTemplate, sendGmail } from "@/lib/email";
import { deliverWithRetry } from "@/lib/webhook";
import { triggerViaRelay } from "@/lib/webhookRelay";
import { supabase } from "@/lib/supabase";

interface QuoteStatusDropdownProps {
  currentStatus: string;
  onStatusChange: (newStatus: string) => void;
  useDbStatuses?: boolean; // if true, show DB statuses (draft/sent/...) instead of friendly labels
}

const quoteStatusOptions = [
  { name: "Quote", icon: FileText, color: "text-gray-600" },
  { name: "Artwork Pending", icon: Palette, color: "text-yellow-600" },
  { name: "Approved", icon: CheckCircle, color: "text-blue-600" },
  { name: "In Production", icon: Cog, color: "text-purple-600" },
  { name: "Complete", icon: Package, color: "text-green-600" },
  { name: "Invoiced", icon: FileText, color: "text-teal-600" },
  { name: "Paid", icon: CreditCard, color: "text-green-700" },
  { name: "Cancelled", icon: X, color: "text-red-600" },
];

// Database-backed statuses used by quotes table
const dbStatusOptions = [
  { name: "draft", icon: FileText, color: "text-gray-600" },
  { name: "sent", icon: FileText, color: "text-blue-600" },
  { name: "pending_approval", icon: Palette, color: "text-yellow-600" },
  { name: "approved", icon: CheckCircle, color: "text-green-600" },
  { name: "rejected", icon: X, color: "text-red-600" },
  { name: "expired", icon: Package, color: "text-purple-600" },
  { name: "converted", icon: CreditCard, color: "text-teal-600" },
];

export function QuoteStatusDropdown({ currentStatus, onStatusChange, useDbStatuses = false }: QuoteStatusDropdownProps) {
  const { toast } = useToast();
  const { organization } = useOrganization();

  const handleStatusSelect = (status: string) => {
    try { console.groupCollapsed('[ui] QuoteStatusDropdown change', { from: currentStatus, to: status }); } catch {}
    onStatusChange(status);
    toast({
      title: "Status Updated",
      description: `Quote status changed to ${status}`,
    });

    // Fire status-change automations
    runStatusChangeAutomations(organization?.org_settings, {
      entityType: 'quote',
      toStatus: status,
      payload: {
        quote: { id: (organization as any)?.lastQuoteId, total: undefined, link: undefined },
        customer: undefined
      }
    }, {
      notify: (title, description) => toast({ title, description }),
      sendEmail: async ({ to, template, subject, body, variables }) => {
        try {
          const templates = (organization as any)?.org_settings?.emails?.templates as Array<any> | undefined;
          const found = Array.isArray(templates) ? templates.find(t => t.name === template) : undefined;
          const rendered = found ? renderTemplate(found, variables || {}) : { subject: subject || (template || ''), body: body || '' };
          await sendGmail({ to: to || 'customer', subject: rendered.subject, body: rendered.body });
        } catch (e) { console.warn('[email] send failed', e); }
      },
      triggerWebhook: async (url, payload, opts) => {
        try {
          await triggerViaRelay({ url, payload, secret: opts?.secret })
        } catch (e) {
          console.warn('[relay] failed, falling back to direct webhook', e)
          try { await deliverWithRetry(url, payload, { secret: opts?.secret }); } catch (e2) { console.warn('[webhook] failed', e2); }
        }
      },
      createTask: async ({ title, dueAt, assigneeId, status }) => {
        try {
          const { error } = await supabase.from('tasks').insert({ title, due_date: dueAt || null, assignee_id: assigneeId || null, status: status || 'open' });
          if (error) throw error;
        } catch (e) { console.warn('[tasks] create failed (ignored)', e); }
      }
    });
    try { console.groupEnd?.(); } catch {}
  };

  // Prefer org-configured statuses when not using DB statuses
  const orgStatuses = Array.isArray((organization as any)?.org_settings?.orderStatuses)
    ? ((organization as any).org_settings.orderStatuses as Array<{ name: string; color?: string; active?: boolean }>)
        .filter(s => s && (s.active !== false))
        .map(s => ({ name: s.name, icon: FileText, color: 'text-gray-600' }))
    : [] as Array<{ name: string; icon: any; color: string }>;
  const options = useDbStatuses ? dbStatusOptions : (orgStatuses.length ? orgStatuses : quoteStatusOptions);

  const currentStatusConfig = options.find(option => 
    option.name.toLowerCase() === currentStatus.toLowerCase()
  ) || options[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2">
          <currentStatusConfig.icon className={`h-4 w-4 ${currentStatusConfig.color}`} />
          {useDbStatuses ? currentStatus.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : currentStatus}
          <ChevronDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-48 bg-white">
        {options.map((option) => (
          <DropdownMenuItem
            key={option.name}
            onClick={() => handleStatusSelect(option.name)}
            className="flex items-center gap-2 cursor-pointer"
          >
            <option.icon className={`h-4 w-4 ${option.color}`} />
            {useDbStatuses ? option.name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : option.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}