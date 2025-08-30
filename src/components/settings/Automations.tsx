
import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Workflow, MoreVertical, Settings as Gear, Trash2, ChevronDown, Plus, Mail, Calendar, Clock, Zap } from 'lucide-react';
import { useOrganization } from '@/context/OrganizationContext';
import { useToast } from '@/hooks/use-toast';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

type AutomationAction = {
  type:
    | 'send_email'
    | 'apply_preset_tasks'
    | 'add_to_po'
    | 'outsource_garments'
    | 'send_to_schedule'
    | 'create_notification'
    | 'trigger_webhook'
    | 'request_artwork_approval'
    | 'request_payment'
    | 'notify_internal'
    | 'create_tasks';
  params?: Record<string, any>;
};

type StatusChangeRule = {
  id: string;
  name: string;
  enabled: boolean;
  toStatus: string; // human name like "Processing"
  actions: (AutomationAction & { id?: string; enabled?: boolean })[];
  createdAt?: string;
};

type SchedulingRule = {
  id: string;
  name: string;
  enabled: boolean;
  methods: string[]; // e.g. ['screen_printing','embroidery']
  priorityFilter: 'all' | 'high' | 'rush';
  days: string[]; // Mon..Sun
  startHour: string; // '08:00'
  endHour: string;   // '17:00'
  preferredEquipment?: string[];
  createdAt?: string;
};

// Built-in statuses used by the Automations dropdown
const defaultStatuses = [
  'New',
  'Processing',
  'Artwork Ready',
  'Production',
  'Shipping',
  'Complete',
  'Cancelled',
  'On Hold',
];

export function Automations() {
  const { organization, updateOrganizationSettings } = useOrganization();
  const { toast } = useToast();

  const existing = (organization?.org_settings as any)?.automations || {};
  const initialStatusRules: StatusChangeRule[] = useMemo(
    () => Array.isArray(existing.statusChanges) ? existing.statusChanges : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [organization?.org_id]
  );
  const initialSchedulingRules: SchedulingRule[] = useMemo(
    () => Array.isArray(existing.schedulingRules) ? existing.schedulingRules : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [organization?.org_id]
  );
  const initialMixed = useMemo(() => (existing.mixedWorkflows || {
    autoDetect: true,
    sequence: ['screen_printing','dtf','dtg','embroidery'],
    defaultSupplier: 'Primary Supplier',
    defaultWarehouse: 'Main Warehouse',
    preferExpressBetweenSteps: false,
  }), // eslint-disable-next-line react-hooks/exhaustive-deps
  [organization?.org_id]);
  const initialOutsourcing = useMemo(() => (existing.outsourcing || {
    enabled: true,
    strategy: 'method_based',
    minQuality: 4,
    maxLeadDays: 7,
    autoAssignBest: true,
    methodRules: {
      screen_printing: 'capacity',
      embroidery: 'capacity',
      dtf: 'capacity',
      dtg: 'capacity',
      heat_transfer: 'capacity',
      sublimation: 'capacity',
      laser_engraving: 'capacity',
    },
    fallback: { enabled: true, toInHouseIfNone: true }
  }), // eslint-disable-next-line react-hooks/exhaustive-deps
  [organization?.org_id]);
  const initialPurchaseOrders = useMemo(
    () => Array.isArray(existing.purchaseOrders) ? existing.purchaseOrders : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [organization?.org_id]
  );
  const initialEmails = useMemo(() => (existing.emails || {
    enabled: true,
    trustMode: 'manual', // manual | full | draft | threshold
    confidenceThreshold: 0.8,
    businessHoursOnly: false,
    excludeDomains: [] as string[],
  }), // eslint-disable-next-line react-hooks/exhaustive-deps
  [organization?.org_id]);
  const initialLeads = useMemo(() => (existing.leads || {
    enabled: true,
    trustMode: 'manual',
    confidenceThreshold: 0.8,
    assignTo: 'none',
    followupDays: 3,
  }), // eslint-disable-next-line react-hooks/exhaustive-deps
  [organization?.org_id]);
  const initialLeadWorkflows = useMemo(() => (existing.leadWorkflows || {
    enabled: true,
    globals: {
      emailDetection: true,
      autoStatus: true,
      autoFollowups: true,
      businessHoursOnly: false,
    },
    trustMode: 'manual',
    confidenceThreshold: 0.8,
    rules: [
      { id: 'rule_new_lead', key: 'new_lead_detection', label: 'New Lead from Email Detection', trigger: 'new lead detected', actions: 2, enabled: true },
      { id: 'rule_auto_reply', key: 'auto_reply', label: 'Auto-reply to New Lead', trigger: 'lead status change', actions: 2, enabled: true },
      { id: 'rule_followup_unresp', key: 'followup_unresponsive', label: 'Follow-up for Unresponsive Leads', trigger: 'follow up due', actions: 1, enabled: true },
      { id: 'rule_auto_quote', key: 'auto_create_quote', label: 'Auto-create Quote for Qualified Leads', trigger: 'lead status change', actions: 2, enabled: true },
      { id: 'rule_quote_followup', key: 'quote_sent_followup', label: 'Quote Sent Follow-up', trigger: 'quote sent', actions: 2, enabled: true },
    ],
  }), // eslint-disable-next-line react-hooks/exhaustive-deps
  [organization?.org_id]);
  const initialQuotes = useMemo(() => (existing.quotes || {
    enabled: true,
    trustMode: 'manual', // full | draft | threshold | manual
    confidenceThreshold: 0.8,
    behavior: {
      autoSendWhenAllowed: false,
      maxAutoAmount: '',
      defaultDepositPercent: 50,
    },
  }), // eslint-disable-next-line react-hooks/exhaustive-deps
  [organization?.org_id]);

  const [rules, setRules] = useState<StatusChangeRule[]>(initialStatusRules);
  const [schedRules, setSchedRules] = useState<SchedulingRule[]>(initialSchedulingRules);
  const [mixed, setMixed] = useState<any>(initialMixed);
  const [outsourcing, setOutsourcing] = useState<any>(initialOutsourcing);
  const [outsourcingTab, setOutsourcingTab] = useState<'rules' | 'decorator' | 'fallback'>('rules');
  const [poRules, setPoRules] = useState<any[]>(initialPurchaseOrders);
  const [poFormOpen, setPoFormOpen] = useState<boolean>(false);
  const [poConfig, setPoConfig] = useState<any>({
    enabled: true,
    manualApprovalThreshold: 500,
    shippingLogic: 'smart',
    defaultUrgency: 'standard',
    notifyOnPlacement: true,
  });
  const [emailAuto, setEmailAuto] = useState<any>(initialEmails);
  const [leadAuto, setLeadAuto] = useState<any>(initialLeads);
  const [leadWork, setLeadWork] = useState<any>(initialLeadWorkflows);
  const [quoteAuto, setQuoteAuto] = useState<any>(initialQuotes);
  const [activeCategory, setActiveCategory] = useState<'status' | 'scheduling' | 'mixed' | 'outsourcing' | 'po' | 'emails' | 'leads' | 'lead_workflows' | 'quotes' | 'system'>('status');
  const [expandedRuleId, setExpandedRuleId] = useState<string | null>(null);
  const [isAddActionOpen, setIsAddActionOpen] = useState(false);
  const [actionTargetRule, setActionTargetRule] = useState<string | null>(null);
  const [actionType, setActionType] = useState<AutomationAction['type']>('send_email');
  const [actionParams, setActionParams] = useState<Record<string, any>>({});
  const [isEditActionOpen, setIsEditActionOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<{ ruleId: string; action: AutomationAction & { id?: string; enabled?: boolean } } | null>(null);
  const [editParams, setEditParams] = useState<Record<string, any>>({});

  const getDefaultParams = (t: AutomationAction['type']): Record<string, any> => {
    switch (t) {
      case 'send_email':
        return { recipient: 'customer', template: 'order_confirmation', subject: '' };
      case 'apply_preset_tasks':
        return { preset: 'production_ready' };
      case 'add_to_po':
        return { poType: 'garments' };
      case 'outsource_garments':
        return { vendor: '' };
      case 'send_to_schedule':
        return { stage: 'Production', daysOffset: 0 };
      case 'create_notification':
        return { message: 'Automation notification', level: 'info' };
      case 'trigger_webhook':
        return { url: '', method: 'POST', payload: '{}' };
      case 'request_artwork_approval':
        return { target: 'customer', template: 'artwork_approval' };
      case 'request_payment':
        return { mode: 'balance', amount: 0 };
      default:
        return {};
    }
  };
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newToStatus, setNewToStatus] = useState<string>('Processing');
  const [tile, setTile] = useState<Record<string, boolean>>({
    send_email: true,
    apply_preset_tasks: false,
    add_to_po: false,
    outsource_garments: false,
    send_to_schedule: false,
    create_notification: false,
    trigger_webhook: false,
    request_artwork_approval: false,
    request_payment: false,
  });

  useEffect(() => {
    setRules(initialStatusRules);
    setSchedRules(initialSchedulingRules);
  }, [initialStatusRules, initialSchedulingRules]);

  // Seed default rules on first run if none exist
  useEffect(() => {
    if ((rules || []).length > 0) return;
    const starters: StatusChangeRule[] = [
      { id: `status_${Date.now()}_approved`, name: 'Approved → Email Customer', enabled: true, toStatus: 'Approved', actions: [{ type: 'send_email', params: { recipient: 'customer', template: 'approval_confirmation' } }] as any, createdAt: new Date().toISOString() },
      { id: `status_${Date.now()}_inprod`, name: 'In Production → Notify Team', enabled: true, toStatus: 'In Production', actions: [{ type: 'create_notification', params: { message: 'Order moved to production' } }] as any, createdAt: new Date().toISOString() },
      { id: `status_${Date.now()}_completed`, name: 'Complete → Email Customer', enabled: true, toStatus: 'Complete', actions: [{ type: 'send_email', params: { recipient: 'customer', template: 'completion_notice' } }] as any, createdAt: new Date().toISOString() },
    ];
    if (starters.length) {
      setRules(starters);
      persist(starters);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persist = async (next: StatusChangeRule[]) => {
    const automations = { ...(organization?.org_settings?.automations || {}), statusChanges: next, schedulingRules: schedRules, mixedWorkflows: mixed, outsourcing, purchaseOrders: poRules, emails: emailAuto, leads: leadAuto, leadWorkflows: leadWork, quotes: quoteAuto };
    try { console.groupCollapsed('[automations] save'); console.debug('payload', automations); console.groupEnd?.(); } catch {}
    const res = await updateOrganizationSettings({ automations });
    if (!res.success) {
      toast({ variant: 'destructive', title: 'Save failed', description: res.error || 'Please try again.' });
    } else {
      toast({ title: 'Saved', description: 'Automations updated.' });
    }
  };

  const addRule = async () => {
    if (!newName.trim()) {
      toast({ variant: 'destructive', title: 'Name required', description: 'Enter a rule name.' });
      return;
    }
    const actions: (AutomationAction & { id?: string; enabled?: boolean })[] = Object.entries(tile)
      .filter(([, enabled]) => enabled)
      .map(([k]) => ({ id: `act_${Date.now()}_${k}`, type: k as AutomationAction['type'], enabled: true }));

    const rule: StatusChangeRule = {
      id: `status_${Date.now()}`,
      name: newName.trim(),
      enabled: true,
      toStatus: newToStatus,
      actions,
      createdAt: new Date().toISOString(),
    };
    const next = [...rules, rule];
    setRules(next);
    setIsAddOpen(false);
    setNewName('');
    setNewToStatus('Processing');
    setTile({
      send_email: true,
      apply_preset_tasks: false,
      add_to_po: false,
      outsource_garments: false,
      send_to_schedule: false,
      create_notification: false,
      trigger_webhook: false,
      request_artwork_approval: false,
      request_payment: false,
    });
    await persist(next);
  };

  const toggleEnabled = async (id: string, enabled: boolean) => {
    const next = rules.map(r => (r.id === id ? { ...r, enabled } : r));
    setRules(next);
    await persist(next);
  };

  const deleteRule = async (id: string) => {
    const next = rules.filter(r => r.id !== id);
    setRules(next);
    await persist(next);
  };

  const toggleActionEnabled = async (ruleId: string, actId: string, enabled: boolean) => {
    const next = rules.map(r => r.id === ruleId ? {
      ...r,
      actions: (r.actions || []).map(a => (a.id === actId ? { ...a, enabled } : a))
    } : r);
    setRules(next);
    await persist(next);
  };

  const addAction = async () => {
    if (!actionTargetRule) return;
    const next = rules.map(r => r.id === actionTargetRule ? {
      ...r,
      actions: [
        ...(r.actions || []),
        { id: `act_${Date.now()}`, type: actionType, enabled: true, params: { ...actionParams } },
      ]
    } : r);
    setRules(next);
    setIsAddActionOpen(false);
    setActionParams({});
    await persist(next);
  };

  const saveEditAction = async () => {
    if (!editTarget) return;
    const { ruleId, action } = editTarget;
    const next = rules.map(r => r.id === ruleId ? {
      ...r,
      actions: (r.actions || []).map(a => a.id === action.id ? { ...a, params: { ...editParams } } : a)
    } : r);
    setRules(next);
    setIsEditActionOpen(false);
    setEditTarget(null);
    setEditParams({});
    await persist(next);
  };

  const deleteAction = async (ruleId: string, actId: string) => {
    const next = rules.map(r => r.id === ruleId ? {
      ...r,
      actions: (r.actions || []).filter(a => a.id !== actId)
    } : r);
    setRules(next);
    await persist(next);
  };

  const ActionSummary = (a: AutomationAction) => {
    if (a.type === 'send_email') {
      const t = (a as any).params?.template || 'template';
      const rec = (a as any).params?.recipient || 'customer';
      return <span className="text-xs text-muted-foreground">to {rec} using template: {t}</span>;
    }
    return <span className="text-xs text-muted-foreground">{String(a.type).replace(/_/g,' ')}</span>;
  };

  const ActionParamsForm = ({params, setParams, type}:{params:Record<string,any>, setParams:(p:Record<string,any>)=>void, type:AutomationAction['type']}) => {
    const on = (k:string, v:any) => setParams({ ...params, [k]: v });
    switch (type) {
      case 'send_email':
        return (
          <div className="grid gap-3">
            <div>
              <Label>Recipient</Label>
              <Select value={params.recipient || 'customer'} onValueChange={(v)=>on('recipient', v)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="customer">Customer</SelectItem>
                  <SelectItem value="internal">Internal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Template</Label>
              <Input value={params.template || ''} onChange={(e)=>on('template', e.target.value)} placeholder="order_confirmation" />
            </div>
            <div>
              <Label>Subject (optional)</Label>
              <Input value={params.subject || ''} onChange={(e)=>on('subject', e.target.value)} placeholder="Subject override" />
            </div>
          </div>
        );
      case 'apply_preset_tasks':
        return (
          <div className="grid gap-3">
            <Label>Preset</Label>
            <Input value={params.preset || ''} onChange={(e)=>on('preset', e.target.value)} placeholder="production_ready" />
          </div>
        );
      case 'trigger_webhook':
        return (
          <div className="grid gap-3">
            <div>
              <Label>URL</Label>
              <Input value={params.url || ''} onChange={(e)=>on('url', e.target.value)} placeholder="https://example.com/hook" />
            </div>
            <div>
              <Label>Method</Label>
              <Select value={params.method || 'POST'} onValueChange={(v)=>on('method', v)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="POST">POST</SelectItem>
                  <SelectItem value="GET">GET</SelectItem>
                  <SelectItem value="PUT">PUT</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Payload (JSON)</Label>
              <Input value={params.payload || '{}'} onChange={(e)=>on('payload', e.target.value)} />
            </div>
          </div>
        );
      default:
        return (
          <div className="grid gap-3">
            <Label>Notes</Label>
            <Input value={params.note || ''} onChange={(e)=>on('note', e.target.value)} placeholder="Optional" />
          </div>
        );
    }
  };

  function SchedulingRuleForm({ onCreate }: { onCreate: (rule: SchedulingRule) => void }) {
    const [name, setName] = useState('');
    const [methods, setMethods] = useState<string[]>([]);
    const [priority, setPriority] = useState<'all'|'high'|'rush'>('all');
    const [days, setDays] = useState<string[]>(['Mon','Tue','Wed','Thu','Fri']);
    const [startHour, setStartHour] = useState('09:00');
    const [endHour, setEndHour] = useState('17:00');
    const [equipment, setEquipment] = useState<string>('');

    const toggle = (list: string[], val: string) => list.includes(val) ? list.filter(v => v !== val) : [...list, val];

    return (
      <div className="space-y-4">
        <div>
          <Label>Rule Name</Label>
          <Input value={name} onChange={(e)=>setName(e.target.value)} placeholder="e.g., Auto-schedule urgent screen printing jobs" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Decoration Methods</Label>
            <div className="mt-2 space-y-2">
              {['screen_printing','embroidery','dtg','dtf'].map(m => (
                <label key={m} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={methods.includes(m)} onChange={()=>setMethods(prev=>toggle(prev,m))} />
                  <span className="capitalize">{m.replace(/_/g,' ')}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <Label>Priority Filter</Label>
            <Select value={priority} onValueChange={(v)=>setPriority(v as any)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="high">High Priority Only</SelectItem>
                <SelectItem value="rush">Rush Only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Start Hour</Label>
            <Input value={startHour} onChange={(e)=>setStartHour(e.target.value)} placeholder="08:00" />
          </div>
          <div>
            <Label>End Hour</Label>
            <Input value={endHour} onChange={(e)=>setEndHour(e.target.value)} placeholder="17:00" />
          </div>
        </div>
        <div>
          <Label>Working Days</Label>
          <div className="grid grid-cols-7 gap-2 mt-2 text-sm">
            {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => (
              <button key={d} type="button" className={`border rounded px-2 py-1 ${days.includes(d)?'bg-primary text-white border-primary':'bg-white'}`} onClick={()=>setDays(prev=>toggle(prev,d))}>{d}</button>
            ))}
          </div>
        </div>
        <div>
          <Label>Preferred Equipment (comma separated)</Label>
          <Input value={equipment} onChange={(e)=>setEquipment(e.target.value)} placeholder="screen_press_1, screen_press_2" />
        </div>
        <div className="flex justify-end gap-2">
          <Button
            onClick={() => onCreate({
              id: `sched_${Date.now()}`,
              name: name || 'New Scheduling Rule',
              enabled: true,
              methods,
              priorityFilter: priority,
              days,
              startHour,
              endHour,
              preferredEquipment: equipment ? equipment.split(',').map(s=>s.trim()).filter(Boolean) : [],
              createdAt: new Date().toISOString(),
            })}
          >
            Create Rule
          </Button>
        </div>
      </div>
    );
  }

  const formatTime = (t: string) => {
    if (!t) return '';
    const [hhStr, mmStr] = t.split(':');
    const hh = parseInt(hhStr || '0', 10);
    const mm = parseInt(mmStr || '0', 10);
    const h12 = ((hh + 11) % 12) + 1;
    const ampm = hh < 12 ? 'AM' : 'PM';
    return `${h12}:${String(isNaN(mm) ? 0 : mm).padStart(2, '0')} ${ampm}`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Automations</h3>
        <p className="text-sm text-muted-foreground mt-1">Setup automated workflows to save time and reduce manual effort across your business process</p>
      </div>

      {/* Category chips */}
      <div className="flex flex-wrap gap-2 sticky top-0 z-10 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/60 py-2">
        {[
          { key: 'status', label: 'Status Changes' },
          { key: 'system', label: 'System Notifications' },
          { key: 'scheduling', label: 'Scheduling' },
          { key: 'leads', label: 'Leads' },
          { key: 'lead_workflows', label: 'Lead Workflows' },
          { key: 'quotes', label: 'Quotes' },
          { key: 'emails', label: 'Emails' },
          { key: 'po', label: 'Purchase Orders' },
          { key: 'mixed', label: 'Mixed Workflows' },
          { key: 'outsourcing', label: 'Outsourcing' },
        ].map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveCategory(key as any)}
            className={`rounded-full px-3 py-1 text-xs border ${activeCategory === key ? 'bg-primary text-white border-primary' : 'bg-white text-muted-foreground hover:bg-muted'}`}
          >
            {label}
          </button>
        ))}
      </div>
      
      {activeCategory === 'status' && (
      <>
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-medium">Status Change Automations</h4>
          <p className="text-sm text-muted-foreground">Configure automated actions when order status changes</p>
        </div>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">Add Automation</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Status Change Automation</DialogTitle>
              <DialogDescription>Run actions when an order enters a specific status.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Name</Label>
                <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g., New Order Email" />
              </div>
                <div>
                <Label>When status changes to</Label>
                <Select value={newToStatus} onValueChange={setNewToStatus}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Choose status" /></SelectTrigger>
                  <SelectContent>
                    {[...defaultStatuses, 'Approved', 'In Production'].filter((v, i, a) => a.indexOf(v) === i).map(s => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Then perform these actions:</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {([
                    ['send_email','Send Email'],
                    ['apply_preset_tasks','Apply Preset Tasks'],
                    ['add_to_po','Add to Purchase Order'],
                    ['outsource_garments','Outsource Garments'],
                    ['send_to_schedule','Send to Production Schedule'],
                    ['create_notification','Create Notification'],
                    ['trigger_webhook','Trigger Webhook'],
                    ['request_artwork_approval','Request Artwork Approval'],
                    ['request_payment','Request Payment'],
                  ] as Array<[keyof typeof tile,string]>).map(([key,label]) => (
                    <Button
                      key={key as string}
                      type="button"
                      variant={tile[key] ? 'default' : 'outline'}
                      className="justify-start"
                      onClick={() => setTile(prev => ({ ...prev, [key]: !prev[key] }))}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
                <Button onClick={addRule}>Create</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-3">
        {rules.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">No automations yet. Click "Add Automation" to create one.</CardContent>
          </Card>
        ) : (
          rules.map(rule => (
            <Card key={rule.id}>
              <CardContent className="py-4">
                <div className="flex items-center gap-4">
                  <Switch checked={rule.enabled} onCheckedChange={(v) => toggleEnabled(rule.id, v)} />
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-2 min-h-[28px]">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{rule.name}</span>
                        <Badge variant="secondary">{rule.enabled ? 'Active' : 'Inactive'}</Badge>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => setExpandedRuleId(expandedRuleId === rule.id ? null : rule.id)} aria-label="Expand rule">
                          <ChevronDown className={`h-4 w-4 transition-transform ${expandedRuleId === rule.id ? 'rotate-180' : ''}`} />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon" variant="ghost"><MoreVertical className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => deleteRule(rule.id)}>Delete</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">When status changes to <Badge variant="outline">{rule.toStatus}</Badge> → {rule.actions.length} action(s)</div>
                    {/* Actions list */}
                    {expandedRuleId === rule.id && (
                      <div className="mt-4">
                        <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Actions</div>
                        <div className="space-y-2">
                          {(rule.actions || []).map(a => (
                            <div key={a.id} className="flex items-center justify-between rounded-md border bg-white hover:bg-muted/50 transition px-3 py-2">
                              <div className="flex items-center gap-3">
                                <Switch checked={a.enabled !== false} onCheckedChange={(v) => toggleActionEnabled(rule.id, a.id as string, v)} />
                                <div className="flex items-center gap-2">
                                  <Mail className="h-4 w-4 text-muted-foreground" />
                <div>
                                    <div className="text-sm font-medium capitalize">{String(a.type).replace(/_/g,' ')}</div>
                                    <ActionSummary {...a} />
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                <Button variant="ghost" size="icon" onClick={() => { setEditTarget({ ruleId: rule.id, action: a }); setEditParams({ ...(a as any).params || {} }); setIsEditActionOpen(true); }}>
                                  <Gear className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => deleteAction(rule.id, a.id as string)}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                        <Button variant="outline" className="mt-3 gap-2" onClick={() => { setActionTargetRule(rule.id); setIsAddActionOpen(true); }}>
                          <Plus className="h-4 w-4" /> Add Action
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
      </>
      )}

      {activeCategory === 'system' && (
      <>
      <Card>
        <CardHeader>
          <CardTitle>System Settings</CardTitle>
          <CardDescription>Global values used by automation actions</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Webhook Signing Secret</Label>
            <Input
              value={(organization?.org_settings?.automations?.webhookSecret as string) || ''}
              onChange={(e)=>{
                const secret = e.target.value;
                const next = { ...(organization?.org_settings?.automations || {}), webhookSecret: secret };
                updateOrganizationSettings({ automations: next });
              }}
              placeholder="Set shared secret for outgoing webhooks"
            />
            <div className="text-xs text-muted-foreground mt-1">Used to sign outgoing webhooks in header X-InkIQ-Signature</div>
          </div>
        </CardContent>
      </Card>
      </>
      )}

      {/* Production Scheduling Automations */}
      {activeCategory === 'scheduling' && (
      <>
      <div className="flex items-center justify-between mt-2">
        <div>
          <h4 className="font-medium">Production Scheduling Automations</h4>
          <p className="text-sm text-muted-foreground">Automatically schedule jobs instead of sending them to the unscheduled queue</p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button className="gap-2">Add Scheduling Rule</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New Scheduling Rule</DialogTitle>
              <DialogDescription>Define filters and working window; matching jobs will be auto-scheduled.</DialogDescription>
            </DialogHeader>
            <SchedulingRuleForm onCreate={(rule) => {
              const next = [...schedRules, rule];
              setSchedRules(next);
              updateOrganizationSettings({ automations: { ...(organization?.org_settings?.automations || {}), statusChanges: rules, schedulingRules: next } });
            }} />
          </DialogContent>
        </Dialog>
      </div>
      
      <div className="space-y-3">
        {schedRules.length === 0 ? (
          <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">No scheduling rules yet.</CardContent></Card>
        ) : (
          schedRules.map(sr => (
            <Card key={sr.id}>
              <CardContent className="py-5">
              <div className="flex items-center justify-between">
                  <div className="flex items-start gap-4">
                    <Switch checked={sr.enabled} onCheckedChange={(v)=>{ const next=schedRules.map(r=>r.id===sr.id?{...r,enabled:v}:r); setSchedRules(next); updateOrganizationSettings({ automations: { ...(organization?.org_settings?.automations || {}), statusChanges: rules, schedulingRules: next } }); }} />
                <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{sr.name}</span>
                        <Badge variant="secondary">{sr.enabled ? 'Active' : 'Inactive'}</Badge>
                      </div>
                      <div className="flex items-center gap-6 text-xs text-muted-foreground mt-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="capitalize">{(sr.methods[0] || '').replace(/_/g,' ')}</Badge>
                          {sr.methods.length > 1 && <span className="text-muted-foreground">+{sr.methods.length - 1} more</span>}
                        </div>
                        <div className="flex items-center gap-2">
                          <Zap className="h-3.5 w-3.5" />
                          {sr.priorityFilter === 'all' ? 'All Priorities' : sr.priorityFilter === 'high' ? 'High Priority Only' : 'Rush Only'}
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="h-3.5 w-3.5" />
                          {formatTime(sr.startHour)} - {formatTime(sr.endHour)}
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-3.5 w-3.5" />
                          {sr.days.join(', ')}
                        </div>
                      </div>
                      {sr.preferredEquipment && sr.preferredEquipment.length > 0 && (
                        <div className="text-xs text-muted-foreground mt-2">Preferred Equipment: {sr.preferredEquipment.join(', ')}</div>
                      )}
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="icon" variant="ghost"><MoreVertical className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={()=>{ const next=schedRules.filter(r=>r.id!==sr.id); setSchedRules(next); updateOrganizationSettings({ automations: { ...(organization?.org_settings?.automations || {}), statusChanges: rules, schedulingRules: next } }); }}>Delete</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
      </>
      )}

      {/* Outsourcing */}
      {activeCategory === 'outsourcing' && (
      <>
        <Card>
        <CardHeader>
          <CardTitle>Outsourcing Decision Engine</CardTitle>
          <CardDescription>Configure automated outsourcing decisions based on capacity, methods, deadlines, and customer requirements.</CardDescription>
          </CardHeader>
        <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
            <div className="font-medium">Enable Outsourcing Engine</div>
            <Switch checked={!!outsourcing.enabled} onCheckedChange={(v)=>{ const next={...outsourcing, enabled:v}; setOutsourcing(next); updateOrganizationSettings({ automations: { ...(organization?.org_settings?.automations || {}), statusChanges: rules, schedulingRules: schedRules, mixedWorkflows: mixed, outsourcing: next } }); }} />
          </div>
          <div>
            <Label>Outsourcing Strategy</Label>
            <Select value={outsourcing.strategy} onValueChange={(v)=>{ const next={...outsourcing, strategy:v}; setOutsourcing(next); updateOrganizationSettings({ automations: { ...(organization?.org_settings?.automations || {}), statusChanges: rules, schedulingRules: schedRules, mixedWorkflows: mixed, outsourcing: next } }); }}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="method_based">Method-Based (by decoration type)</SelectItem>
                <SelectItem value="capacity_based">Capacity-Based (when overloaded)</SelectItem>
                <SelectItem value="mixed">Mixed Strategy (methods + capacity)</SelectItem>
                <SelectItem value="rush_based">Rush-Based (tight deadlines)</SelectItem>
                <SelectItem value="customer_based">Customer-Based (by tier)</SelectItem>
                <SelectItem value="cost_based">Cost-Based (by order value)</SelectItem>
                <SelectItem value="vendor_pool">Vendor Pool (best fit)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Sub-tabs */}
          <div className="grid grid-cols-3 gap-2 text-sm">
            <button type="button" onClick={()=>setOutsourcingTab('rules')} className={`rounded px-3 py-2 text-left ${outsourcingTab==='rules' ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'}`}>Strategy Rules</button>
            <button type="button" onClick={()=>setOutsourcingTab('decorator')} className={`rounded px-3 py-2 text-left ${outsourcingTab==='decorator' ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'}`}>Decorator Selection</button>
            <button type="button" onClick={()=>setOutsourcingTab('fallback')} className={`rounded px-3 py-2 text-left ${outsourcingTab==='fallback' ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'}`}>Fallback & Safety</button>
          </div>

          {outsourcingTab==='rules' && (
            <div className="space-y-2">
              {[['screen_printing','Screen Printing'],['embroidery','Embroidery'],['dtf','DTF'],['dtg','DTG'],['heat_transfer','Heat Transfer'],['sublimation','Sublimation'],['laser_engraving','Laser Engraving']].map(([key,label]) => (
                <div key={key} className="flex items-center justify-between rounded border px-3 py-2">
                  <div className="font-medium">{label}</div>
                  <Select value={outsourcing.methodRules?.[key] || 'capacity'} onValueChange={(v)=>{ const next={...outsourcing, methodRules:{ ...(outsourcing.methodRules||{}), [key]: v } }; setOutsourcing(next); updateOrganizationSettings({ automations: { ...(organization?.org_settings?.automations || {}), statusChanges: rules, schedulingRules: schedRules, mixedWorkflows: mixed, outsourcing: next } }); }}>
                    <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="capacity">Based on Capacity</SelectItem>
                      <SelectItem value="price">Based on Price</SelectItem>
                      <SelectItem value="quality">Based on Quality</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          )}

          {outsourcingTab==='decorator' && (
            <div className="rounded border p-3 space-y-3">
              <div className="text-sm font-medium">Decorator Selection</div>
                <div>
                <Label>Minimum Quality Rating</Label>
                <div className="flex items-center gap-3">
                  <input type="range" min={1} max={5} step={1} value={outsourcing.minQuality || 4} onChange={(e)=>{ const next={...outsourcing, minQuality: parseInt(e.target.value,10)}; setOutsourcing(next); }} className="w-full" />
                  <Badge variant="secondary">{outsourcing.minQuality || 4}+</Badge>
                </div>
                <div className="text-xs text-muted-foreground">Only use decorators with {outsourcing.minQuality || 4}+ star rating</div>
                </div>
              <div>
                <Label>Maximum Lead Time (Days)</Label>
                <Input value={outsourcing.maxLeadDays || 7} onChange={(e)=>{ const next={...outsourcing, maxLeadDays: parseInt(e.target.value||'0',10)}; setOutsourcing(next); }} />
              </div>
              <div className="flex items-center justify-between">
                <div className="font-medium">Auto-Assign Best Decorator</div>
                <Switch checked={!!outsourcing.autoAssignBest} onCheckedChange={(v)=>{ const next={...outsourcing, autoAssignBest:v}; setOutsourcing(next); }} />
              </div>
                </div>
          )}

          {outsourcingTab==='fallback' && (
            <div className="rounded border p-3 space-y-3">
              <div className="text-sm font-medium">Fallback & Safety</div>
              <div className="flex items-center justify-between">
                <div className="font-medium">Enable Fallback Logic</div>
                <Switch checked={!!outsourcing.fallback?.enabled} onCheckedChange={(v)=>{ const next={...outsourcing, fallback:{ ...(outsourcing.fallback||{}), enabled:v } }; setOutsourcing(next); }} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Fallback to In-House if No Decorators Available</div>
                  <div className="text-xs text-muted-foreground">Notifications will be sent when fallback logic is triggered</div>
                </div>
                <Switch checked={!!outsourcing.fallback?.toInHouseIfNone} onCheckedChange={(v)=>{ const next={...outsourcing, fallback:{ ...(outsourcing.fallback||{}), toInHouseIfNone:v } }; setOutsourcing(next); }} />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={()=>{ const def = initialOutsourcing; setOutsourcing(def); updateOrganizationSettings({ automations: { ...(organization?.org_settings?.automations || {}), statusChanges: rules, schedulingRules: schedRules, mixedWorkflows: mixed, outsourcing: def } }); }}>Cancel</Button>
            <Button onClick={()=>updateOrganizationSettings({ automations: { ...(organization?.org_settings?.automations || {}), statusChanges: rules, schedulingRules: schedRules, mixedWorkflows: mixed, outsourcing } })}>Save Outsourcing Strategy</Button>
          </div>
        </CardContent>
      </Card>
      </>
      )}

      {/* Quotes */}
      {activeCategory === 'quotes' && (
      <>
      <Card>
        <CardHeader>
          <CardTitle>AI Quote Generation</CardTitle>
          <CardDescription>Configure how InkIQ should handle quote requests automatically</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="font-medium">Enable Quote Automation</div>
            <Switch checked={!!quoteAuto.enabled} onCheckedChange={(v)=>{ const next={...quoteAuto, enabled:v}; setQuoteAuto(next); updateOrganizationSettings({ automations: { ...(organization?.org_settings?.automations || {}), quotes: next } }); }} />
          </div>

          <div>
            <div className="font-medium mb-2">AI Trust Mode</div>
            <RadioGroup value={quoteAuto.trustMode} onValueChange={(v)=>{ const next={...quoteAuto, trustMode:v}; setQuoteAuto(next); }}>
              <div className="flex items-start gap-3 py-1"><RadioGroupItem value="full" id="q-full" /><div><Label htmlFor="q-full">Full Auto</Label><div className="text-xs text-muted-foreground">Let InkIQ generate and send quotes automatically</div></div></div>
              <div className="flex items-start gap-3 py-1"><RadioGroupItem value="draft" id="q-draft" /><div><Label htmlFor="q-draft">Draft for Approval</Label><div className="text-xs text-muted-foreground">InkIQ prepares quotes, you review before sending</div></div></div>
              <div className="flex items-start gap-3 py-1"><RadioGroupItem value="threshold" id="q-threshold" /><div><Label htmlFor="q-threshold">Confidence Threshold</Label><div className="text-xs text-muted-foreground">Auto-send when confident, draft when uncertain</div></div></div>
              <div className="flex items-start gap-3 py-1"><RadioGroupItem value="manual" id="q-manual" /><div><Label htmlFor="q-manual">Manual Only</Label><div className="text-xs text-muted-foreground">Create all quotes manually</div></div></div>
            </RadioGroup>
          </div>

          <div>
            <div className="font-medium mb-2">Quote Behavior</div>
            <div className="flex items-center gap-3">
              <Switch checked={!!quoteAuto.behavior.autoSendWhenAllowed} onCheckedChange={(v)=>setQuoteAuto((c:any)=>({ ...c, behavior:{ ...c.behavior, autoSendWhenAllowed:v } }))} />
              <div className="text-sm">Auto-send quotes (when mode allows)</div>
            </div>
            <div className="mt-3">
              <Label>Max amount for auto-quotes</Label>
              <div className="flex items-center gap-2">
                <Input value={quoteAuto.behavior.maxAutoAmount} onChange={(e)=>setQuoteAuto((c:any)=>({ ...c, behavior:{ ...c.behavior, maxAutoAmount: e.target.value } }))} className="w-[240px]" />
                <span className="text-sm text-muted-foreground">USD</span>
              </div>
              <div className="text-xs text-muted-foreground">Quotes above this amount require approval regardless of mode</div>
            </div>
            <div className="mt-3">
              <Label>Default deposit percentage</Label>
              <div className="flex items-center gap-2">
                <Input type="number" min="0" max="100" value={quoteAuto.behavior.defaultDepositPercent} onChange={(e)=>setQuoteAuto((c:any)=>({ ...c, behavior:{ ...c.behavior, defaultDepositPercent: parseInt(e.target.value||'0',10) } }))} className="w-[120px]" />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
            </div>
          </div>

          <div>
            <div className="font-medium mb-2">Test Automation</div>
            <Button variant="outline">Test with Sample Quote</Button>
            <div className="text-xs text-muted-foreground mt-1">Simulates: "100 t-shirts @ 1-color front logo" ($1,250 value)</div>
          </div>

          <div className="flex items-center gap-2">
            <Button onClick={()=>updateOrganizationSettings({ automations: { ...(organization?.org_settings?.automations || {}), quotes: quoteAuto } })}>Save Settings</Button>
            <Button variant="outline" onClick={()=>setQuoteAuto(initialQuotes)}>Reset to Defaults</Button>
          </div>
        </CardContent>
      </Card>
      </>
      )}
      {/* Lead Workflows */}
      {activeCategory === 'lead_workflows' && (
      <>
      <Card>
        <CardHeader>
          <CardTitle>Lead Workflow Automations</CardTitle>
          <CardDescription>Configure advanced event-driven automation rules for lead management</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="font-medium">Enable Lead Workflow</div>
            <Switch checked={!!leadWork.enabled} onCheckedChange={(v)=>{ const next={...leadWork, enabled:v}; setLeadWork(next); updateOrganizationSettings({ automations: { ...(organization?.org_settings?.automations || {}), leadWorkflows: next } }); }} />
          </div>

          <div>
            <div className="font-medium mb-2">Global Settings</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="flex items-center justify-between rounded border p-3"><div>Email Detection</div><Switch checked={!!leadWork.globals.emailDetection} onCheckedChange={(v)=>setLeadWork((c:any)=>({ ...c, globals:{...c.globals, emailDetection:v} }))} /></div>
              <div className="flex items-center justify-between rounded border p-3"><div>Auto Status Changes</div><Switch checked={!!leadWork.globals.autoStatus} onCheckedChange={(v)=>setLeadWork((c:any)=>({ ...c, globals:{...c.globals, autoStatus:v} }))} /></div>
              <div className="flex items-center justify-between rounded border p-3"><div>Auto Follow-ups</div><Switch checked={!!leadWork.globals.autoFollowups} onCheckedChange={(v)=>setLeadWork((c:any)=>({ ...c, globals:{...c.globals, autoFollowups:v} }))} /></div>
              <div className="flex items-center justify-between rounded border p-3"><div>Business Hours Only</div><Switch checked={!!leadWork.globals.businessHoursOnly} onCheckedChange={(v)=>setLeadWork((c:any)=>({ ...c, globals:{...c.globals, businessHoursOnly:v} }))} /></div>
            </div>
          </div>

          <div>
            <div className="font-medium mb-2">AI Trust Mode</div>
            <RadioGroup value={leadWork.trustMode} onValueChange={(v)=>setLeadWork((c:any)=>({ ...c, trustMode:v }))}>
              <div className="flex items-start gap-3 py-1"><RadioGroupItem value="full" id="lw-full" /><div><Label htmlFor="lw-full">Full Auto</Label><div className="text-xs text-muted-foreground">Execute all workflow actions automatically</div></div></div>
              <div className="flex items-start gap-3 py-1"><RadioGroupItem value="draft" id="lw-draft" /><div><Label htmlFor="lw-draft">Draft for Approval</Label><div className="text-xs text-muted-foreground">Prepare actions for review before execution</div></div></div>
              <div className="flex items-start gap-3 py-1"><RadioGroupItem value="threshold" id="lw-threshold" /><div><Label htmlFor="lw-threshold">Confidence Threshold</Label><div className="text-xs text-muted-foreground">Auto-execute when confident, review when uncertain</div></div></div>
              <div className="flex items-start gap-3 py-1"><RadioGroupItem value="manual" id="lw-manual" /><div><Label htmlFor="lw-manual">Manual Only</Label><div className="text-xs text-muted-foreground">Review all workflow actions manually</div></div></div>
            </RadioGroup>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="font-medium">Workflow Rules</div>
              <Button variant="outline" size="sm">Add Rule</Button>
            </div>
            <div className="space-y-2">
              {(leadWork.rules||[]).map((r:any) => (
                <div key={r.id} className="flex items-center justify-between rounded border px-3 py-2">
                  <div className="flex items-center gap-3">
                    <Switch checked={!!r.enabled} onCheckedChange={(v)=>{ const next={...leadWork, rules:(leadWork.rules||[]).map((x:any)=>x.id===r.id?{...x, enabled:v}:x)}; setLeadWork(next); }} />
                    <div>
                      <div className="font-medium">{r.label}</div>
                      <div className="text-xs text-muted-foreground">Trigger: {r.trigger}</div>
                    </div>
                  </div>
                  <Badge variant="secondary">{r.actions} actions</Badge>
                </div>
              ))}
              </div>
            </div>

          <div>
            <div className="font-medium mb-2">Test Workflow</div>
            <Button variant="outline">Test with Sample Lead</Button>
            <div className="text-xs text-muted-foreground mt-1">Simulates: "New lead from email inquiry" with 92% confidence</div>
          </div>

          <div className="flex items-center gap-2">
            <Button onClick={()=>updateOrganizationSettings({ automations: { ...(organization?.org_settings?.automations || {}), leadWorkflows: leadWork, leads: leadAuto, emails: emailAuto, statusChanges: rules, schedulingRules: schedRules, mixedWorkflows: mixed, outsourcing, purchaseOrders: poRules } })}>Save Settings</Button>
            <Button variant="outline" onClick={()=>setLeadWork(initialLeadWorkflows)}>Reset to Defaults</Button>
          </div>
          </CardContent>
        </Card>
      </>
      )}
      {/* Leads */}
      {activeCategory === 'leads' && (
      <>
      <Card>
        <CardHeader>
          <CardTitle>AI Lead Processing</CardTitle>
          <CardDescription>Configure how InkIQ should handle new leads automatically</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="font-medium">Enable Lead Processing</div>
            <Switch checked={!!leadAuto.enabled} onCheckedChange={(v)=>{ const next={...leadAuto, enabled:v}; setLeadAuto(next); updateOrganizationSettings({ automations: { ...(organization?.org_settings?.automations || {}), leads: next, emails: emailAuto, statusChanges: rules, schedulingRules: schedRules, mixedWorkflows: mixed, outsourcing, purchaseOrders: poRules } }); }} />
          </div>

          <div>
            <div className="font-medium mb-2">AI Trust Mode</div>
            <RadioGroup value={leadAuto.trustMode} onValueChange={(v)=>{ const next={...leadAuto, trustMode:v}; setLeadAuto(next); }}>
              <div className="flex items-start gap-3 py-1"><RadioGroupItem value="full" id="lead-full" /><div><Label htmlFor="lead-full">Full Auto</Label><div className="text-xs text-muted-foreground">Let InkIQ process and assign leads automatically</div></div></div>
              <div className="flex items-start gap-3 py-1"><RadioGroupItem value="draft" id="lead-draft" /><div><Label htmlFor="lead-draft">Draft for Approval</Label><div className="text-xs text-muted-foreground">InkIQ prepares lead details, you review before assignment</div></div></div>
              <div className="flex items-start gap-3 py-1"><RadioGroupItem value="threshold" id="lead-threshold" /><div><Label htmlFor="lead-threshold">Confidence Threshold</Label><div className="text-xs text-muted-foreground">Auto-process when confident, review when uncertain</div></div></div>
              <div className="flex items-start gap-3 py-1"><RadioGroupItem value="manual" id="lead-manual" /><div><Label htmlFor="lead-manual">Manual Only</Label><div className="text-xs text-muted-foreground">Review and assign all leads manually</div></div></div>
            </RadioGroup>
            {leadAuto.trustMode === 'threshold' && (
              <div className="mt-2">
                <Label>Confidence Threshold</Label>
                <Input type="number" step="0.05" min="0" max="1" value={leadAuto.confidenceThreshold} onChange={(e)=>setLeadAuto((c:any)=>({ ...c, confidenceThreshold: parseFloat(e.target.value)||0 }))} className="w-[160px]" />
              </div>
            )}
          </div>

          <div>
            <div className="font-medium mb-2">Assignment & Follow-ups</div>
            <div>
              <Label>Auto-assign to</Label>
              <Select value={leadAuto.assignTo} onValueChange={(v)=>setLeadAuto((c:any)=>({ ...c, assignTo: v }))}>
                <SelectTrigger className="w-full"><SelectValue placeholder="No auto-assignment" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No auto-assignment</SelectItem>
                  <SelectItem value="sales_team">Sales Team</SelectItem>
                  <SelectItem value="account_manager">Account Manager</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="mt-3">
              <Label>Follow-up cadence (days)</Label>
              <Input type="number" min="1" value={leadAuto.followupDays} onChange={(e)=>setLeadAuto((c:any)=>({ ...c, followupDays: parseInt(e.target.value||'0',10) }))} className="w-[120px]" />
              <div className="text-xs text-muted-foreground">Days between automated follow-up reminders</div>
            </div>
          </div>

          <div>
            <div className="font-medium mb-2">Test Automation</div>
            <div className="flex gap-2 items-center">
              <Button variant="outline">Test with Sample Lead</Button>
            </div>
            <div className="text-xs text-muted-foreground mt-1">Simulates: "Customer requests 100 t-shirts with logo" from website form</div>
          </div>

          <div className="flex items-center gap-2">
            <Button onClick={()=>updateOrganizationSettings({ automations: { ...(organization?.org_settings?.automations || {}), leads: leadAuto, emails: emailAuto, statusChanges: rules, schedulingRules: schedRules, mixedWorkflows: mixed, outsourcing, purchaseOrders: poRules } })}>Save Settings</Button>
            <Button variant="outline" onClick={()=>setLeadAuto(initialLeads)}>Reset to Defaults</Button>
          </div>
        </CardContent>
      </Card>
      </>
      )}
      {/* Emails */}
      {activeCategory === 'emails' && (
      <>
        <Card>
        <CardHeader>
          <CardTitle>AI Email Auto-Response</CardTitle>
          <CardDescription>Configure how InkIQ should handle incoming emails automatically</CardDescription>
          </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="font-medium">Enable Auto-Response</div>
            <Switch checked={!!emailAuto.enabled} onCheckedChange={(v)=>{ const next={...emailAuto, enabled:v}; setEmailAuto(next); updateOrganizationSettings({ automations: { ...(organization?.org_settings?.automations || {}), emails: next, statusChanges: rules, schedulingRules: schedRules, mixedWorkflows: mixed, outsourcing, purchaseOrders: poRules } }); }} />
          </div>

          <div>
            <div className="font-medium mb-2">AI Trust Mode</div>
            <RadioGroup value={emailAuto.trustMode} onValueChange={(v)=>{ const next={...emailAuto, trustMode:v}; setEmailAuto(next); }}>
              <div className="flex items-start gap-3 py-1">
                <RadioGroupItem value="full" id="full" />
                <div>
                  <Label htmlFor="full">Full Auto</Label>
                  <div className="text-xs text-muted-foreground">Let InkIQ handle everything automatically</div>
                </div>
              </div>
              <div className="flex items-start gap-3 py-1">
                <RadioGroupItem value="draft" id="draft" />
                <div>
                  <Label htmlFor="draft">Draft for Approval</Label>
                  <div className="text-xs text-muted-foreground">InkIQ prepares drafts; you review and send</div>
                </div>
              </div>
              <div className="flex items-start gap-3 py-1">
                <RadioGroupItem value="threshold" id="threshold" />
                <div>
                  <Label htmlFor="threshold">Confidence Threshold</Label>
                  <div className="text-xs text-muted-foreground">Auto-reply when confident, draft when uncertain</div>
                </div>
              </div>
              <div className="flex items-start gap-3 py-1">
                <RadioGroupItem value="manual" id="manual" />
                <div>
                  <Label htmlFor="manual">Manual Only</Label>
                  <div className="text-xs text-muted-foreground">Handle all emails manually</div>
                </div>
              </div>
            </RadioGroup>
            {emailAuto.trustMode === 'threshold' && (
              <div className="mt-2">
                <Label>Confidence Threshold</Label>
                <Input type="number" step="0.05" min="0" max="1" value={emailAuto.confidenceThreshold} onChange={(e)=>setEmailAuto((c:any)=>({ ...c, confidenceThreshold: parseFloat(e.target.value)||0 }))} className="w-[160px]" />
              </div>
            )}
          </div>

          <div>
            <div className="font-medium mb-2">Scope & Safety</div>
            <div className="flex items-center gap-3">
              <Switch checked={!!emailAuto.businessHoursOnly} onCheckedChange={(v)=>setEmailAuto((c:any)=>({ ...c, businessHoursOnly: v }))} />
              <div className="text-sm">Business Hours Only (9 AM - 5 PM, Mon-Fri)</div>
            </div>
            <div className="mt-3">
              <Label>Exclude Domains</Label>
              <div className="flex gap-2 items-center mt-1">
                <Input placeholder="domain.com" value={emailAuto._pendingDomain || ''} onChange={(e)=>setEmailAuto((c:any)=>({ ...c, _pendingDomain: e.target.value }))} className="w-[240px]" />
                <Button size="sm" onClick={()=>{ const d=(emailAuto._pendingDomain||'').trim(); if(!d) return; const next={...emailAuto, excludeDomains:[...(emailAuto.excludeDomains||[]), d], _pendingDomain:''}; setEmailAuto(next); }}>Add</Button>
              </div>
              {(emailAuto.excludeDomains||[]).length>0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {(emailAuto.excludeDomains||[]).map((d:string, idx:number)=> (
                    <Badge key={idx} variant="secondary">{d}</Badge>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div>
            <div className="font-medium mb-2">Test Automation</div>
            <div className="flex gap-2 items-center">
              <Input placeholder="Type a sample email subject or sender..." className="flex-1" />
              <Button variant="outline">Test</Button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button onClick={()=>updateOrganizationSettings({ automations: { ...(organization?.org_settings?.automations || {}), emails: emailAuto, statusChanges: rules, schedulingRules: schedRules, mixedWorkflows: mixed, outsourcing, purchaseOrders: poRules } })}>Save Settings</Button>
            <Button variant="outline" onClick={()=>setEmailAuto(initialEmails)}>Reset to Defaults</Button>
          </div>
        </CardContent>
      </Card>
      </>
      )}
      {/* Purchase Orders */}
      {activeCategory === 'po' && (
      <>
              <div className="flex items-center justify-between">
                <div>
          <h4 className="font-medium">Configure Automatic Order Placement</h4>
          <p className="text-sm text-muted-foreground">Set up rules for automatically placing purchase orders when garments are added to PO</p>
                </div>
        <Button variant="outline">Cancel</Button>
              </div>

      <Card className="mt-3">
        <CardHeader>
          <CardTitle className="text-base">Basic Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
              <div className="font-medium">Enable Automatic Order Placement</div>
              <div className="text-xs text-muted-foreground">Automatically place orders when garments are added to purchase orders</div>
            </div>
            <Switch checked={poConfig.enabled} onCheckedChange={(v)=>setPoConfig((c:any)=>({ ...c, enabled:v }))} />
          </div>
          <div>
            <Label>Manual Approval Threshold</Label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">$</span>
              <Input value={poConfig.manualApprovalThreshold} onChange={(e)=>setPoConfig((c:any)=>({ ...c, manualApprovalThreshold: parseInt(e.target.value||'0',10) }))} className="w-[200px]" />
            </div>
            <div className="text-xs text-muted-foreground">Orders above this amount will require manual approval</div>
          </div>
          <div>
            <Label>Shipping Logic</Label>
            <Select value={poConfig.shippingLogic} onValueChange={(v)=>setPoConfig((c:any)=>({ ...c, shippingLogic: v }))}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="smart">Smart Routing (In-house → Warehouse, Outsourced → Partner)</SelectItem>
                <SelectItem value="warehouse_only">Warehouse Only</SelectItem>
                <SelectItem value="partner_only">Partner Only</SelectItem>
              </SelectContent>
            </Select>
                </div>
          <div>
            <Label>Default Shipping Urgency</Label>
            <Select value={poConfig.defaultUrgency} onValueChange={(v)=>setPoConfig((c:any)=>({ ...c, defaultUrgency: v }))}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="standard">Standard (5-7 business days)</SelectItem>
                <SelectItem value="expedited">Expedited (2-3 business days)</SelectItem>
                <SelectItem value="rush">Rush (overnight)</SelectItem>
              </SelectContent>
            </Select>
              </div>
          <div className="flex items-center justify-between">
            <div className="font-medium">Send Notification on Order Placement</div>
            <Switch checked={poConfig.notifyOnPlacement} onCheckedChange={(v)=>setPoConfig((c:any)=>({ ...c, notifyOnPlacement: v }))} />
          </div>
        </CardContent>
        <div className="flex items-center justify-end gap-2 px-6 pb-6">
          <Button variant="outline">Cancel</Button>
          <Button onClick={()=>{ const next=[...poRules, { id:`po_${Date.now()}`, ...poConfig }]; setPoRules(next); updateOrganizationSettings({ automations: { ...(organization?.org_settings?.automations || {}), statusChanges: rules, schedulingRules: schedRules, mixedWorkflows: mixed, outsourcing, purchaseOrders: next } }); }}>Create Automation</Button>
        </div>
      </Card>
      </>
      )}

      {/* Mixed Workflows */}
      {activeCategory === 'mixed' && (
      <>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Workflow Detection</CardTitle>
            <CardDescription>Automatically identify orders that require multiple decoration methods</CardDescription>
          </CardHeader>
          <CardContent>
              <div className="flex items-center justify-between">
                <div>
                <div className="font-medium">Automatically detect multi-step workflows</div>
                <div className="text-sm text-muted-foreground">Automatically detect orders that require multiple decoration methods</div>
                </div>
              <Switch checked={!!mixed.autoDetect} onCheckedChange={(v)=>{ const next={...mixed, autoDetect:v}; setMixed(next); updateOrganizationSettings({ automations: { ...(organization?.org_settings?.automations || {}), statusChanges: rules, schedulingRules: schedRules, mixedWorkflows: next } }); }} />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Decoration Sequence</CardTitle>
            <CardDescription>Drag to reorder or use arrow buttons to define the optimal order for decoration methods</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(mixed.sequence || []).map((m: string, idx: number) => (
                <div key={m} className="flex items-center justify-between rounded border px-3 py-2">
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full border flex items-center justify-center text-xs">{idx+1}</div>
                <div>
                      <div className="font-medium capitalize">{m.replace(/_/g,' ')}</div>
                      <div className="text-xs text-muted-foreground">{idx===0 ? 'Usually first due to setup requirements' : idx=== (mixed.sequence.length-1) ? "Often last as it's most delicate" : 'Can be done early'}</div>
                </div>
              </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" onClick={()=>{ if (idx===0) return; const seq=[...mixed.sequence]; const [it]=seq.splice(idx,1); seq.splice(idx-1,0,it); const next={...mixed, sequence:seq}; setMixed(next); updateOrganizationSettings({ automations: { ...(organization?.org_settings?.automations || {}), statusChanges: rules, schedulingRules: schedRules, mixedWorkflows: next } }); }}>↑</Button>
                    <Button variant="ghost" size="icon" onClick={()=>{ if (idx===mixed.sequence.length-1) return; const seq=[...mixed.sequence]; const [it]=seq.splice(idx,1); seq.splice(idx+1,0,it); const next={...mixed, sequence:seq}; setMixed(next); updateOrganizationSettings({ automations: { ...(organization?.org_settings?.automations || {}), statusChanges: rules, schedulingRules: schedRules, mixedWorkflows: next } }); }}>↓</Button>
              </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Default Routing</CardTitle>
            <CardDescription>Configure default locations and shipping preferences for multi-step workflows</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                <Label>Default Supplier</Label>
                <Input value={mixed.defaultSupplier || ''} onChange={(e)=>{ const next={...mixed, defaultSupplier:e.target.value}; setMixed(next); updateOrganizationSettings({ automations: { ...(organization?.org_settings?.automations || {}), statusChanges: rules, schedulingRules: schedRules, mixedWorkflows: next } }); }} placeholder="Primary Supplier" />
                </div>
                <div>
                <Label>Default Warehouse</Label>
                <Input value={mixed.defaultWarehouse || ''} onChange={(e)=>{ const next={...mixed, defaultWarehouse:e.target.value}; setMixed(next); updateOrganizationSettings({ automations: { ...(organization?.org_settings?.automations || {}), statusChanges: rules, schedulingRules: schedRules, mixedWorkflows: next } }); }} placeholder="Main Warehouse" />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div>
                <div className="font-medium">Prefer express shipping between steps</div>
                <div className="text-sm text-muted-foreground">Use faster shipping to minimize delays between decoration steps</div>
              </div>
              <Switch checked={!!mixed.preferExpressBetweenSteps} onCheckedChange={(v)=>{ const next={...mixed, preferExpressBetweenSteps:v}; setMixed(next); updateOrganizationSettings({ automations: { ...(organization?.org_settings?.automations || {}), statusChanges: rules, schedulingRules: schedRules, mixedWorkflows: next } }); }} />
                </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={()=>{ const def = { autoDetect:true, sequence:['screen_printing','dtf','dtg','embroidery'], defaultSupplier:'Primary Supplier', defaultWarehouse:'Main Warehouse', preferExpressBetweenSteps:false }; setMixed(def); updateOrganizationSettings({ automations: { ...(organization?.org_settings?.automations || {}), statusChanges: rules, schedulingRules: schedRules, mixedWorkflows: def } }); }}>Reset to Defaults</Button>
          <Button onClick={()=>updateOrganizationSettings({ automations: { ...(organization?.org_settings?.automations || {}), statusChanges: rules, schedulingRules: schedRules, mixedWorkflows: mixed } })}>Save Workflow Settings</Button>
              </div>

        {/* Example Workflow */}
        <Card>
          <CardHeader>
            <CardTitle>Example Workflow</CardTitle>
            <CardDescription>Based on your current decoration sequence, here’s how a mixed order would be processed:</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground mb-2">Scenario: Order requiring multiple decorations from your sequence</div>
            <div className="flex items-center flex-wrap gap-2">
              <Badge variant="secondary">{mixed.defaultSupplier || 'Primary Supplier'}</Badge>
              <span>→</span>
              {(mixed.sequence || []).map((m: string, idx: number) => (
                <React.Fragment key={m}>
                  <Badge variant="outline" className="capitalize">{m.replace(/_/g,' ')} {`(Step ${idx+1})`}</Badge>
                  {idx < mixed.sequence.length - 1 && <span>→</span>}
                </React.Fragment>
              ))}
              <span>→</span>
              <Badge variant="secondary">Customer</Badge>
            </div>
            <div className="text-xs text-muted-foreground mt-2">* Decoration order follows your sequence priority. Routing locations depend on outsourcing rules. Express shipping enabled between steps {mixed.preferExpressBetweenSteps ? 'is ON' : 'is OFF'}.</div>
          </CardContent>
        </Card>
      </div>
      </>
      )}

      {/* Add Action Dialog */}
      <Dialog open={isAddActionOpen} onOpenChange={setIsAddActionOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Action</DialogTitle>
            <DialogDescription>Select an action to add to this automation.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label>Action Type</Label>
            <Select value={actionType} onValueChange={(v) => setActionType(v as AutomationAction['type'])}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Select action" /></SelectTrigger>
              <SelectContent>
                {[
                  'send_email',
                  'apply_preset_tasks',
                  'add_to_po',
                  'outsource_garments',
                  'send_to_schedule',
                  'create_notification',
                  'trigger_webhook',
                  'request_artwork_approval',
                  'request_payment',
                ].map(a => (<SelectItem key={a} value={a}>{a.replace(/_/g,' ')}</SelectItem>))}
              </SelectContent>
            </Select>
            {/* Params */}
            <ActionParamsForm params={actionParams && Object.keys(actionParams).length ? actionParams : getDefaultParams(actionType)} setParams={(p)=>setActionParams(p)} type={actionType} />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsAddActionOpen(false)}>Cancel</Button>
              <Button onClick={addAction}>Add</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Action Dialog */}
      <Dialog open={isEditActionOpen} onOpenChange={setIsEditActionOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Action</DialogTitle>
            <DialogDescription>Update action parameters.</DialogDescription>
          </DialogHeader>
          {editTarget && (
            <div className="space-y-3">
              <Label>Type</Label>
              <div className="text-sm capitalize">{String(editTarget.action.type).replace(/_/g,' ')}</div>
              <ActionParamsForm params={editParams} setParams={setEditParams} type={editTarget.action.type} />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsEditActionOpen(false)}>Cancel</Button>
                <Button onClick={saveEditAction}>Save</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Workflow className="h-4 w-4" />
        Status Changes
      </div>
    </div>
  );
}

