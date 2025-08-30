import { useEffect, useRef, useState } from "react";
import { SchedulerHeader } from "./SchedulerHeader";
import { DecorationMethodDropdown } from "./DecorationMethodDropdown";
import { ProductionStageDropdown } from "./ProductionStageDropdown";
import { UnscheduledJobsPanel } from "./UnscheduledJobsPanel";
import { SchedulingGrid } from "./SchedulingGrid";
import { JobDetailModal } from "./JobDetailModal";
import { ImprintJob } from "@/types/imprint-job";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { getAvailableStages, isJobReadyForStage } from "@/utils/stageDependencyUtils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { track } from "@/lib/utils";
import { useOrganization } from "@/context/OrganizationContext";
import { useAuth } from "@/context/AuthContext";
import { runStatusChangeAutomations } from "@/lib/automation";

export type DecorationMethod = "screen_printing" | "embroidery" | "dtf" | "dtg" | string;

export type ProductionStage = 
  | "burn_screens" | "mix_ink" | "print" // Screen printing stages
  | "digitize" | "hoop" | "embroider" // Embroidery stages  
  | "design_file" | "dtf_print" | "powder" | "cure" // DTF stages
  | "pretreat" | "dtg_print" | "dtg_cure"; // DTG stages

// Keep PrintavoJob for backward compatibility but prefer ImprintJob
export interface PrintavoJob extends ImprintJob {
  // Legacy fields for compatibility
  quantity: number;
  imprintLocation: string;
  parentOrderId: string;
  relatedJobIds: string[];
  garmentType: string;
  garmentColors: string[];
}

export default function PrintavoPowerScheduler() {
  const [selectedMethod, setSelectedMethod] = useState<string>("screen_printing");
  const [selectedStage, setSelectedStage] = useState<ProductionStage>("burn_screens");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedJob, setSelectedJob] = useState<ImprintJob | null>(null);
  const [isJobDetailModalOpen, setIsJobDetailModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'board' | 'calendar'>('board');
  const [selectedDecoration, setSelectedDecoration] = useState<string>('all');
  
  // Config loaded from backend
  const [stagesByMethod, setStagesByMethod] = useState<Record<string, Array<{ id: string; name: string; color: string }>>>({
    screen_printing: [],
    embroidery: [],
    dtf: [],
    dtg: [],
  });
  const [methodOptions, setMethodOptions] = useState<Array<{ value: string; label: string }>>([]);
  const normalizeMethodId = (id: string) => (id || '')
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/\s+/g, '_')
    .replace(/-/g, '_')
    .toLowerCase();

  // Context and toast (must be declared before effects that use them)
  const { organization } = useOrganization();
  const { user } = useAuth();
  const { toast } = useToast();

  // Prefer organization context for methods/stages when available
  useEffect(() => {
    const s: any = organization?.org_settings || {};
    const configured = s.production?.decorationMethods as Array<{ id: string; label?: string; enabled?: boolean; stages?: Array<{ id: string; name: string }> }> | undefined;
    const equipmentFromOrg = s.production?.equipment as Array<any> | undefined;
    if (!configured || !configured.length) return;
    const opts = configured
      .filter(m => m.enabled !== false)
      .map(m => ({ value: normalizeMethodId(m.id || ''), label: m.label || m.id }));
    setMethodOptions(opts);
    if (opts.length && !opts.find(o => o.value === selectedMethod)) {
      setSelectedMethod(opts[0].value);
    }
    const colors = [
      'bg-orange-100 text-orange-800','bg-purple-100 text-purple-800','bg-green-100 text-green-800','bg-blue-100 text-blue-800','bg-yellow-100 text-yellow-800','bg-indigo-100 text-indigo-800','bg-pink-100 text-pink-800','bg-amber-100 text-amber-800'
    ];
    const nextLocal: Record<string, Array<{ id: string; name: string; color: string }>> = {};
    configured.filter(m => m.enabled !== false).forEach((m) => {
      const key = normalizeMethodId(m.id || '');
      const stages = Array.isArray(m.stages) && m.stages.length
        ? m.stages.map((st, idx) => ({ id: st.id, name: st.name, color: colors[idx % colors.length] }))
        : [];
      nextLocal[key] = stages;
    });
    if (Object.keys(nextLocal).length) {
      setStagesByMethod(prev => ({ ...prev, ...nextLocal }));
    }
    // If org has equipment, we could enrich in future; lanes are still mapped heuristically per stage
    console.debug('[Production] org ctx applied', { opts, nextLocal });
  }, [organization]);

  // Ensure selectedStage is valid whenever stages or method change
  useEffect(() => {
    const list = stagesByMethod[selectedMethod] || [];
    if (!list.find(s => s.id === selectedStage)) {
      const next = list[0]?.id as ProductionStage | undefined;
      if (next) setSelectedStage(next);
    }
  }, [stagesByMethod, selectedMethod]);

  // Jobs state
  const [jobs, setJobs] = useState<ImprintJob[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const pendingOpsRef = useRef<Set<string>>(new Set());
  const lastAutoKeyRef = useRef<string>("");
  const role = (organization?.user_role || '').toLowerCase();
  const isManager = ['production_manager', 'manager', 'admin', 'owner'].includes(role);
  const isOperator = ['operator'].includes(role);
  // Permissions relaxed: allow all users to operate and schedule from Scheduler
  const canOperateBase = true;
  const canScheduleHere = true;
  const isAssigned = (job?: ImprintJob) => !!(job && user && job.assignedUserId && job.assignedUserId === user.id);
  const canOperate = (_job?: ImprintJob) => true;

  // Load config and jobs from Supabase (without altering visual behavior)
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        // Load organization methods if configured in settings
        try {
          // Load methods from org settings without importing OrganizationContext twice
          const orgRes = await supabase.rpc('get_user_org_info');
          console.debug('[Production] get_user_org_info', { error: orgRes.error, rows: Array.isArray(orgRes.data) ? orgRes.data.length : null, sample: Array.isArray(orgRes.data) ? orgRes.data[0] : null });
          const row = Array.isArray(orgRes.data) ? orgRes.data[0] : null;
          const s: any = row?.org_settings || {};
          const configured = s.production?.decorationMethods as Array<{ id: string; label: string; enabled: boolean; stages?: any[] }> | undefined;
          console.debug('[Production] org_settings.production.decorationMethods', configured);
          if (configured && configured.length) {
            const opts = configured
              .filter(m => m.enabled !== false)
              .map(m => ({ value: normalizeMethodId(m.id || ''), label: m.label || m.id }));
            console.debug('[Production] methodOptions computed from settings', opts);
            if (opts.length) {
              setMethodOptions(opts);
              // If current selection not present, default to first configured method
              if (!opts.find(o => o.value === selectedMethod)) {
                const nextMethod = opts[0].value;
                setSelectedMethod(nextMethod);
                console.debug('[Production] defaulting selectedMethod to first option', nextMethod);
              }
            }
          }
        } catch {}

        // If methods configured in org settings, build stages from settings when available
        if (methodOptions.length) {
          try {
            const orgRes2 = await supabase.rpc('get_user_org_info');
            const row2 = Array.isArray(orgRes2.data) ? orgRes2.data[0] : null;
            const s2: any = row2?.org_settings || {};
            const configured2 = s2.production?.decorationMethods as Array<{ id: string; label: string; enabled: boolean; stages?: Array<{ id: string; name: string }> }> | undefined;
            if (configured2 && configured2.length) {
              const colors = [
                'bg-orange-100 text-orange-800','bg-purple-100 text-purple-800','bg-green-100 text-green-800','bg-blue-100 text-blue-800','bg-yellow-100 text-yellow-800','bg-indigo-100 text-indigo-800','bg-pink-100 text-pink-800','bg-amber-100 text-amber-800'
              ];
              const nextLocal: Record<string, Array<{ id: string; name: string; color: string }>> = {};
              configured2.filter(m => m.enabled !== false).forEach((m) => {
                const key = normalizeMethodId(m.id || '');
                const stages = Array.isArray(m.stages) && m.stages.length
                  ? m.stages.map((st, idx) => ({ id: st.id, name: st.name, color: colors[idx % colors.length] }))
                  : [];
                nextLocal[key] = stages;
              });
              setStagesByMethod(prev => ({ ...prev, ...nextLocal }));
              console.debug('[Production] stagesByMethod merged from settings', nextLocal);
            }
          } catch {}
        }

        // Load config
        const cfg = await supabase.rpc('get_production_config');
        console.debug('[Scheduler] get_production_config result', { error: cfg.error, rows: Array.isArray(cfg.data) ? cfg.data.length : 0, sample: Array.isArray(cfg.data) ? cfg.data.slice(0, 2) : null });
        if (!cfg.error && Array.isArray(cfg.data)) {
          const methodToKey: Record<string, DecorationMethod> = {
            screen_printing: 'screen_printing',
            embroidery: 'embroidery',
            dtf: 'dtf',
            dtg: 'dtg',
          };
          const colors = [
            'bg-orange-100 text-orange-800',
            'bg-purple-100 text-purple-800',
            'bg-green-100 text-green-800',
            'bg-blue-100 text-blue-800',
            'bg-yellow-100 text-yellow-800',
            'bg-indigo-100 text-indigo-800',
            'bg-pink-100 text-pink-800',
            'bg-amber-100 text-amber-800',
            'bg-cyan-100 text-cyan-800',
            'bg-emerald-100 text-emerald-800',
          ];
          const next: Record<string, Array<{ id: string; name: string; color: string }>> = {
            screen_printing: [], embroidery: [], dtf: [], dtg: [],
          };
          (cfg.data as any[]).forEach((m: any) => {
            const key = methodToKey[m.method_code];
            if (!key) return;
            const decos = m.decorations?.[0]?.stages || [];
            next[key] = decos.map((s: any, idx: number) => ({ id: s.stage_code, name: s.display_name, color: colors[idx % colors.length] }));
          });
          console.debug('[Scheduler] stagesByMethod computed', next);
          // Merge RPC config under any existing org-settings stages (org settings take precedence)
          setStagesByMethod((prev) => ({ ...next, ...prev }));
        } else {
          // Fallback default stages when RPC fails
          const defaults: Record<string, Array<{ id: string; name: string; color: string }>> = {
    screen_printing: [
              { id: 'burn_screens', name: 'Burn Screens', color: 'bg-orange-100 text-orange-800' },
              { id: 'mix_ink', name: 'Mix Ink', color: 'bg-purple-100 text-purple-800' },
              { id: 'print', name: 'Print', color: 'bg-green-100 text-green-800' },
    ],
    embroidery: [
              { id: 'digitize', name: 'Digitize', color: 'bg-orange-100 text-orange-800' },
              { id: 'hoop', name: 'Hoop', color: 'bg-purple-100 text-purple-800' },
              { id: 'embroider', name: 'Embroider', color: 'bg-green-100 text-green-800' },
    ],
    dtf: [
              { id: 'design_file', name: 'Design File', color: 'bg-orange-100 text-orange-800' },
              { id: 'dtf_print', name: 'DTF Print', color: 'bg-purple-100 text-purple-800' },
              { id: 'powder', name: 'Powder', color: 'bg-green-100 text-green-800' },
              { id: 'cure', name: 'Cure', color: 'bg-blue-100 text-blue-800' },
    ],
    dtg: [
              { id: 'pretreat', name: 'Pretreat', color: 'bg-orange-100 text-orange-800' },
              { id: 'dtg_print', name: 'DTG Print', color: 'bg-purple-100 text-purple-800' },
              { id: 'dtg_cure', name: 'DTG Cure', color: 'bg-green-100 text-green-800' },
            ],
          };
          console.debug('[Scheduler] stagesByMethod fallback defaults');
          // Merge defaults under any existing org-settings stages
          setStagesByMethod((prev) => ({ ...defaults, ...prev }));
        }

        const methodMap: Record<string, DecorationMethod> = {
          screen_printing: "screen_printing",
          embroidery: "embroidery",
          dtf: "dtf",
          dtg: "dtg",
        };
        const { data, error } = await supabase.rpc('get_production_jobs', { p_method: null, p_stage: null });
        if (error) {
          console.warn('[Scheduler] get_production_jobs error', error);
          return;
        }
        if (!Array.isArray(data)) {
          console.debug('[Scheduler] get_production_jobs returned non-array', data);
          return;
        }
        console.debug('[Scheduler] get_production_jobs rows', { count: data.length, sample: data.slice(0, 3) });
        const mapped: ImprintJob[] = (data as any[]).map((j) => {
          const rawStatus = (j.status ?? 'unscheduled').toString().toLowerCase();
          const normalizedStatus =
            rawStatus === 'unscheduled' ? 'unscheduled' :
            rawStatus === 'scheduled' ? 'scheduled' :
            rawStatus === 'in_progress' || rawStatus === 'in-progress' ? 'in_progress' :
            rawStatus === 'blocked' ? 'blocked' :
            rawStatus === 'done' || rawStatus === 'completed' ? 'done' : 'unscheduled';
          const stageDurations = (j.stage_durations as any) || {};
          const sumStageHours = Object.values(stageDurations || {}).reduce((acc: number, v: any) => acc + (Number(v || 0) || 0), 0);
          return {
          id: j.id,
          jobNumber: j.job_number,
          orderId: j.quote_id,
          lineItemGroupId: j.quote_item_id || '',
          imprintSectionId: j.imprint_id || '',
          status: normalizedStatus as any,
          customerName: j.customer_name || 'Customer',
          description: j.description || '',
          decorationMethod: methodMap[j.decoration_method] || 'screen_printing',
          placement: j.placement || '',
          size: j.size || '',
          colours: j.colours || '',
          files: [],
          products: [],
          totalQuantity: j.total_quantity || 0,
          estimatedHours: Number(j.estimated_hours || sumStageHours || 0),
          stageDurations: stageDurations,
          dueDate: j.due_date ? new Date(j.due_date) : new Date(),
          priority: (j.priority as any) || 'medium',
          artworkApproved: true,
          currentStage: (j.current_stage as any),
          equipmentId: j.equipment_id || undefined,
          // use per-stage schedule if provided by rpc; fallback to legacy
          scheduledStart: j.stage_scheduled_start ? new Date(j.stage_scheduled_start) : (j.scheduled_start ? new Date(j.scheduled_start) : undefined),
          scheduledEnd: j.stage_scheduled_end ? new Date(j.stage_scheduled_end) : (j.scheduled_end ? new Date(j.scheduled_end) : undefined),
          setupRequired: true,
          mockupImage: j.mockup_image_path ? (supabase.storage.from('artwork').getPublicUrl(j.mockup_image_path).data.publicUrl) : undefined,
          imprintLogo: j.imprint_logo_path ? (supabase.storage.from('artwork').getPublicUrl(j.imprint_logo_path).data.publicUrl) : undefined,
          assignedUserId: j.assigned_user_id || undefined,
          jobCreatedAt: j.created_at ? new Date(j.created_at) : undefined,
          quoteLastUpdatedAt: j.quote_updated_at ? new Date(j.quote_updated_at) : undefined,
          };
        });

        // Enrich jobs with quote item details and artwork files so JobDetailModal has data
        try {
          const qiIds = Array.from(new Set(mapped.map(m => m.lineItemGroupId).filter(Boolean)));
          if (qiIds.length > 0) {
            const [
              { data: qiRows, error: qiErr },
              { data: afRows, error: afErr },
              { data: imRows, error: imErr },
            ] = await Promise.all([
              supabase.from('quote_items')
                .select('id, product_name, product_description, product_sku, color, quantity, garment_status, xs, s, m, l, xl, xxl, xxxl')
                .in('id', qiIds),
              supabase.from('artwork_files')
                .select('id, quote_item_id, file_name, file_path, file_type, category')
                .in('quote_item_id', qiIds),
              supabase.from('quote_imprints')
                .select('id, quote_item_id, location, width, height, colors_or_threads, notes')
                .in('quote_item_id', qiIds)
            ]);
            if (!qiErr && Array.isArray(qiRows)) {
              const qiById = new Map<string, any>();
              qiRows.forEach(r => qiById.set(r.id, r));
              // Group artwork files by item id
              const filesByItem = new Map<string, any[]>();
              if (!afErr && Array.isArray(afRows)) {
                afRows.forEach((f: any) => {
                  const arr = filesByItem.get(f.quote_item_id) || [];
                  arr.push(f);
                  filesByItem.set(f.quote_item_id, arr);
                });
              }
              // First imprint per item
              const imprintByItem = new Map<string, any>();
              if (!imErr && Array.isArray(imRows)) {
                imRows.forEach((im: any) => {
                  if (!imprintByItem.has(im.quote_item_id)) imprintByItem.set(im.quote_item_id, im);
                });
              }
              const sign = async (path: string) => {
                const mode = import.meta.env.VITE_ASSETS_MODE;
                if (mode === 'local') {
                  try {
                    const { getAssetUrl } = await import('@/lib/utils');
                    return await getAssetUrl(path);
                  } catch { return undefined; }
                }
                try {
                  const { data } = await supabase.storage.from('artwork').createSignedUrl(path, 3600);
                  return data?.signedUrl as string | undefined;
                } catch { return undefined; }
              };

              await Promise.all(mapped.map(async (m) => {
                const qi = qiById.get(m.lineItemGroupId);
                if (qi) {
                  m.products = [{
                    id: qi.id,
                    itemNumber: qi.product_sku || '',
                    color: qi.color || '',
                    description: qi.product_description || qi.product_name || '',
                    quantity: qi.quantity || 0,
                    status: 'In Production'
                  }];
                  // Derive a simple material status from quote item garment_status
                  const rawGs = (qi as any).garment_status ? String((qi as any).garment_status).toLowerCase() : '';
                  const normalizedGs = rawGs.includes('receive') || rawGs.includes('ready') || rawGs.includes('in_stock') ? 'ready'
                    : rawGs.includes('backorder') || rawGs.includes('back-ordered') ? 'backorder'
                    : rawGs.includes('out') ? 'out_of_stock'
                    : rawGs.includes('low') ? 'low_stock'
                    : rawGs || '';
                  (m as any).materialStatus = normalizedGs;
                  m.sizeBreakdown = {
                    [qi.id]: {
                      S: qi.s || 0,
                      M: qi.m || 0,
                      L: qi.l || 0,
                      XL: qi.xl || 0,
                      XXL: qi.xxl || 0,
                    }
                  } as any;
                }
                const im = imprintByItem.get(m.lineItemGroupId);
                if (im) {
                  m.imprintLocation = im.location || '';
                  const wh = [im.width, im.height].filter((v: any) => v != null).join('x');
                  m.imprintSize = wh ? `${wh}` : '';
                  m.imprintColors = im.colors_or_threads || m.colours;
                  m.imprintNotes = im.notes || '';
                }
                let files = filesByItem.get(m.lineItemGroupId) || [];
                // Fallback: if DB has no files, try listing from Storage using quoteId/itemId path
                if (!files.length && m.orderId && m.lineItemGroupId) {
                  try {
                    const root = `${m.orderId}/${m.lineItemGroupId}`;
                    const { data: folders } = await supabase.storage.from('artwork').list(root, { limit: 100 });
                    const collected: any[] = [];
                    if (Array.isArray(folders)) {
                      for (const entry of folders) {
                        const imprintFolder = `${root}/${entry.name}`;
                        for (const cat of ['customer_art','production_files','proof_mockup'] as const) {
                          const catPath = `${imprintFolder}/${cat}`;
                          const { data: listed } = await supabase.storage.from('artwork').list(catPath, { limit: 100 });
                          if (!Array.isArray(listed)) continue;
                          for (const obj of listed) {
                            const fullPath = `${catPath}/${obj.name}`;
                            collected.push({
                              id: `${entry.name}-${cat}-${obj.name}`,
                              quote_item_id: m.lineItemGroupId,
                              category: cat,
                              file_name: obj.name,
                              file_type: (obj as any).metadata?.mimetype || 'application/octet-stream',
                              file_path: fullPath,
                            });
                          }
                        }
                      }
                    }
                    files = collected;
                  } catch {}
                }
                const cust = files.filter(f => f.category === 'customer_art');
                const prod = files.filter(f => f.category === 'production_files');
                const mock = files.filter(f => f.category === 'proof_mockup');
                m.customerArt = await Promise.all(cust.map(async (f: any) => ({ id: f.id, name: f.file_name, type: f.file_type, url: (await sign(f.file_path)) || '' })));
                m.productionFiles = await Promise.all(prod.map(async (f: any) => ({ id: f.id, name: f.file_name, type: f.file_type, url: (await sign(f.file_path)) || '' })));
                m.proofMockup = await Promise.all(mock.map(async (f: any) => ({ id: f.id, name: f.file_name, type: f.file_type, url: (await sign(f.file_path)) || '' })));
                // Fallbacks for visuals
                if (!m.mockupImage && m.proofMockup && m.proofMockup[0]) {
                  m.mockupImage = m.proofMockup[0].url;
                }
                if (!m.imprintLogo && m.customerArt && m.customerArt[0]) {
                  m.imprintLogo = m.customerArt[0].url;
                }
                // Basic imprint detail fallbacks
                m.imprintMethod = m.decorationMethod.replace('_', ' ').toUpperCase();
                m.imprintColors = m.colours;
              }));
            }
          }
        } catch (e) {
          console.debug('[Scheduler] enrichment failed', e);
        }
        const countsByMethod = mapped.reduce<Record<string, number>>((acc, m) => {
          acc[m.decorationMethod] = (acc[m.decorationMethod] || 0) + 1;
          return acc;
        }, {});
        const countsByStatus = mapped.reduce<Record<string, number>>((acc, m) => {
          acc[m.status] = (acc[m.status] || 0) + 1;
          return acc;
        }, {} as any);
        console.debug('[Scheduler] mapped jobs summary', { countsByMethod, countsByStatus, ids: mapped.slice(0, 5).map(m => ({ id: m.id, quote_item_id: m.lineItemGroupId, status: m.status, method: m.decorationMethod })) });
        // Replace any demo data with live jobs only
        setJobs(mapped);
      } catch {}
      finally { setLoading(false); }
        console.debug('[Production] final methodOptions', methodOptions, 'selectedMethod', selectedMethod, 'stagesByMethod keys', Object.keys(stagesByMethod));
    };
    load();
  }, []);

  // Reload stage-specific schedules whenever stage changes
  useEffect(() => {
    const loadForStage = async () => {
      try {
        console.debug('[Stage] loading jobs for stage', { selectedStage });
        const { data, error } = await supabase.rpc('get_production_jobs', { p_method: null, p_stage: selectedStage });
        if (error) {
          console.warn('[Stage] get_production_jobs error', error);
          return;
        }
        if (!Array.isArray(data)) {
          console.debug('[Stage] get_production_jobs non-array', data);
          return;
        }
        console.debug('[Stage] get_production_jobs rows', { count: data.length, sample: data.slice(0,2) });
        const methodMap: Record<string, DecorationMethod> = {
          screen_printing: 'screen_printing', embroidery: 'embroidery', dtf: 'dtf', dtg: 'dtg'
        };
        const mapped: ImprintJob[] = (data as any[]).map((j) => {
          const rawStatus = (j.status ?? 'unscheduled').toString().toLowerCase();
          const normalizedStatus =
            rawStatus === 'unscheduled' ? 'unscheduled' :
            rawStatus === 'scheduled' ? 'scheduled' :
            rawStatus === 'in_progress' || rawStatus === 'in-progress' ? 'in_progress' :
            rawStatus === 'blocked' ? 'blocked' :
            rawStatus === 'done' || rawStatus === 'completed' ? 'done' : 'unscheduled';
          const stageDurations = (j.stage_durations as any) || {};
          const sumStageHours = Object.values(stageDurations || {}).reduce((acc: number, v: any) => acc + (Number(v || 0) || 0), 0);
          return {
            id: j.id,
            jobNumber: j.job_number,
            orderId: j.quote_id,
            lineItemGroupId: j.quote_item_id || '',
            imprintSectionId: j.imprint_id || '',
            status: normalizedStatus as any,
            customerName: j.customer_name || 'Customer',
            description: j.description || '',
            decorationMethod: methodMap[j.decoration_method] || 'screen_printing',
            placement: j.placement || '',
            size: j.size || '',
            colours: j.colours || '',
            files: [],
            products: [],
            totalQuantity: j.total_quantity || 0,
            estimatedHours: Number(j.estimated_hours || sumStageHours || 0),
            stageDurations: stageDurations,
            dueDate: j.due_date ? new Date(j.due_date) : new Date(),
            priority: (j.priority as any) || 'medium',
            artworkApproved: true,
            currentStage: (j.current_stage as any) || selectedStage,
            equipmentId: j.stage_equipment_id || j.equipment_id || undefined,
            // IMPORTANT: for stage-focused reloads, use only per-stage values; do NOT fallback to legacy here
            scheduledStart: j.stage_scheduled_start ? new Date(j.stage_scheduled_start) : undefined,
            scheduledEnd: j.stage_scheduled_end ? new Date(j.stage_scheduled_end) : undefined,
            setupRequired: true,
            assignedUserId: j.assigned_user_id || undefined,
            jobCreatedAt: undefined,
            quoteLastUpdatedAt: j.quote_updated_at ? new Date(j.quote_updated_at) : undefined,
          } as ImprintJob;
        });
        setJobs(prev => {
          const byId = new Map<string, ImprintJob>();
          prev.forEach(p => byId.set(p.id, p));
          mapped.forEach(m => {
            const existing = byId.get(m.id);
            byId.set(m.id, existing ? { ...existing, scheduledStart: m.scheduledStart, scheduledEnd: m.scheduledEnd, equipmentId: m.equipmentId } : m);
          });
          const merged = Array.from(byId.values());
          console.debug('[Stage] merged into state', { merged: merged.length });
          return merged;
        });
      } catch (e) {
        console.warn('[Stage] load error', e);
      }
    };
    loadForStage();
  }, [selectedStage]);

  // Update selected stage when method changes
  const handleMethodChange = (method: string) => {
    setSelectedMethod(method);
    const list = stagesByMethod[method] || [];
    let nextStage = list[0]?.id as ProductionStage | undefined;
    if (!nextStage) {
      // Fallback sensible defaults per method
      if (method === 'screen_printing') nextStage = 'burn_screens' as ProductionStage;
      else if (method === 'dtf') nextStage = 'design_file' as ProductionStage;
      else if (method === 'dtg') nextStage = 'pretreat' as ProductionStage;
    }
    if (nextStage) setSelectedStage(nextStage);
  };

  // Filter by method/decoration first; stage-specific filtering applied only to scheduled jobs below
  const methodFiltered = jobs.filter(job => 
    job.decorationMethod === selectedMethod && 
    (selectedDecoration === 'all' || (job as any).decoration_code === selectedDecoration)
  );
  // Minimal status log
  const dndEligible = methodFiltered.filter(j => j.status === 'unscheduled');
  console.debug('[DnD] eligible unscheduled for drag', { count: dndEligible.length, sample: dndEligible.slice(0,3).map(j => ({ id: j.id, num: j.jobNumber })) });
  
  // Stage-aware lists: unscheduled = not scheduled for this selected stage (regardless of global status)
  const isScheduledForSelectedStage = (j: ImprintJob) => !!j.scheduledStart;
  const unscheduledJobs = methodFiltered.filter(job => !isScheduledForSelectedStage(job));
  // Board view: only show jobs that have a schedule for the selected stage
  const scheduledJobs = methodFiltered.filter(job => isScheduledForSelectedStage(job));
  // Compact partition log for debugging only
  // console.debug('[Stage] partition', { stage: selectedStage, mf: methodFiltered.map(j => ({ id: j.id, ss: !!j.scheduledStart })), un: unscheduledJobs.map(j => j.id), sc: scheduledJobs.map(j => j.id) });
  const terminalStageId = (stagesByMethod[selectedMethod]?.[stagesByMethod[selectedMethod].length - 1]?.id || undefined) as ProductionStage | undefined;
  
  // Auto-scheduling (basic): place a few eligible unscheduled jobs into the earliest slot when enabled
  useEffect(() => {
    try {
      const rules: any = (organization?.org_settings as any)?.production?.productionRules || {};
      if (!rules?.autoScheduling) return;
      const key = `${selectedMethod}|${selectedStage}|${selectedDate.toDateString()}|${organization?.org_id || 'org'}`;
      if (lastAutoKeyRef.current === key) return;
      // Compute eligible unscheduled jobs for this stage
      const toStage = selectedStage;
      const eligible = unscheduledJobs.filter(j => {
        try { return isJobReadyForStage(j as any, jobs).includes(toStage); } catch { return true; }
      });
      if (!eligible.length) return;
      // Find matching equipment lanes from org settings
      const orgEq = ((organization as any)?.org_settings?.production?.equipment as Array<any>) || [];
      const normId = (id: string) => normalizeMethodId(id || '');
      const lanes = orgEq
        .filter(eq => Array.isArray(eq?.stageAssignments) && eq.stageAssignments.some((sa: any) => normId(sa?.decorationMethod || '') === selectedMethod && Array.isArray(sa?.stageIds) && sa.stageIds.includes(selectedStage as string)))
        .map(eq => String(eq.id));
      if (!lanes.length) return; // require explicit lanes for predictability
      const equipmentId = lanes[0];
      // Determine buffer from batching rules
      const methodKeyCamel = selectedMethod === 'screen_printing' ? 'screenPrinting' : selectedMethod;
      const bufferMin = Number((rules?.batchingRules?.[methodKeyCamel]?.bufferTime) || 0);
      // Determine day window start
      const base = new Date(selectedDate);
      base.setHours(9, 0, 0, 0);
      const today = new Date();
      let startCursor = base;
      if (base.toDateString() === today.toDateString()) {
        startCursor = new Date(Math.max(base.getTime(), Date.now()));
      }
      // Find last scheduled end on that equipment for the day
      const sameDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      const dayKey = sameDay(startCursor);
      const eqJobs = jobs
        .filter(j => j.equipmentId === equipmentId && j.scheduledStart && sameDay(new Date(j.scheduledStart)) === dayKey)
        .sort((a, b) => new Date(a.scheduledEnd || a.scheduledStart as any).getTime() - new Date(b.scheduledEnd || b.scheduledStart as any).getTime());
      if (eqJobs.length) {
        const last = eqJobs[eqJobs.length - 1];
        const lastEnd = new Date((last.scheduledEnd || last.scheduledStart) as any).getTime();
        startCursor = new Date(Math.max(startCursor.getTime(), lastEnd + bufferMin * 60000));
      }
      // Schedule up to 3 jobs
      const take = eligible.slice(0, 3);
      take.forEach((job) => {
        if (pendingOpsRef.current.has(job.id)) return;
        const stageHours = (job as any).stageDurations && toStage ? Number((job as any).stageDurations[toStage] || 0) : 0;
        const hoursToUse = stageHours || job.estimatedHours || 1;
        const start = new Date(startCursor);
        const end = new Date(start.getTime() + Math.round(hoursToUse * 60) * 60000);
        // Advance cursor with buffer for the next job
        startCursor = new Date(end.getTime() + bufferMin * 60000);
        // Delegate to existing scheduler which applies all validations and persistence
        handleJobSchedule(job.id, equipmentId, start, end);
      });
      lastAutoKeyRef.current = key;
    } catch {}
  }, [organization, jobs, selectedMethod, selectedStage, selectedDate]);
  
  const logAudit = async (jobId: string, action: string, details: Record<string, any>) => {
    try {
      // Prefer RPC if available; fall back to direct insert if table exists
      const payload = { p_job_id: jobId, p_action: action, p_details: details } as any;
      const tryRpc = await supabase.rpc('create_job_audit_event', payload);
      if (tryRpc.error) {
        await supabase.from('production_job_audit').insert({ job_id: jobId, action, details, created_at: new Date().toISOString() });
      }
    } catch (e) {
      // Non-fatal
      console.warn('[audit] failed', e);
    }
  };

  const handleJobSchedule = async (jobId: string, equipmentId: string, startTime: Date, endTime: Date) => {
    // Permissions relaxed: allow scheduling from here
    if (pendingOpsRef.current.has(jobId)) return;
    pendingOpsRef.current.add(jobId);
    const job = jobs.find(j => j.id === jobId);
    if (!job) {
      console.warn('[DnD] handleJobSchedule: job not found in state', { jobId, equipmentId });
      pendingOpsRef.current.delete(jobId);
      return;
    }

    if (job.status === 'blocked' || job.status === 'done' || job.status === 'completed') {
      toast({ title: 'Cannot schedule', description: 'Job is blocked or completed. Reopen it first.', variant: 'destructive' });
      return;
    }

    const fromStage = job.currentStage as ProductionStage | undefined;
    const toStage = selectedStage;

    // If changing stage, validate dependencies for target stage
    if (fromStage && fromStage !== toStage) {
      const available = getAvailableStages({ ...job, currentStage: toStage } as ImprintJob, jobs);
      if (!available.includes(toStage)) {
        toast({ title: 'Invalid move', description: `Cannot move to stage "${toStage}" yet. Dependencies not met.`, variant: 'destructive' });
        return;
      }
    }

    const stageHours = (job as any).stageDurations && toStage ? Number((job as any).stageDurations[toStage] || 0) : 0;
    const hoursToUse = stageHours || job.estimatedHours || 1;
    // Enforce Production Rules → Batching & Material rules
    try {
      const rules: any = (organization?.org_settings as any)?.production?.productionRules || {};
      const methodKeyCamel = selectedMethod === 'screen_printing'
        ? 'screenPrinting'
        : selectedMethod;
      const br = (rules?.batchingRules || {})[methodKeyCamel] || {};
      const minBatch = Number(br.minBatchSize || 0);
      const maxBatch = Number(br.maxBatchSize || 0);
      const bufferMin = Number(br.bufferTime || 0);
      if (minBatch > 0 && Number(job.totalQuantity || 0) < minBatch) {
        toast({ variant: 'destructive', title: 'Batch too small', description: `Minimum batch for ${methodKeyCamel} is ${minBatch}.` });
        pendingOpsRef.current.delete(jobId);
        return;
      }
      if (maxBatch > 0 && Number(job.totalQuantity || 0) > maxBatch) {
        toast({ variant: 'destructive', title: 'Batch too large', description: `Maximum batch for ${methodKeyCamel} is ${maxBatch}.` });
        pendingOpsRef.current.delete(jobId);
        return;
      }
      if (bufferMin > 0) {
        // Ensure no job scheduled on this equipment within buffer window around start/end
        const bufferMs = bufferMin * 60000;
        const startWithBuf = new Date(startTime.getTime() - bufferMs);
        const endWithBuf = new Date((endTime || startTime).getTime() + bufferMs);
        const conflict = jobs.some(j => j.equipmentId === equipmentId && j.scheduledStart && (
          (new Date(j.scheduledStart).getTime() < endWithBuf.getTime()) &&
          (new Date(j.scheduledEnd || j.scheduledStart as any).getTime() > startWithBuf.getTime())
        ));
        if (conflict) {
          toast({ variant: 'destructive', title: 'Buffer time conflict', description: `Requires ${bufferMin} min buffer on this station.` });
          pendingOpsRef.current.delete(jobId);
          return;
        }
      }
      // Material & Inventory rules
      try {
        const mr = (rules?.materialRules || {}) as any;
        if (mr.checkStockBeforeScheduling) {
          const materialStatus = (job as any).materialStatus as string | undefined;
          const ready = materialStatus && (materialStatus === 'ready' || materialStatus === 'in_stock' || materialStatus === 'received');
          if (!ready) {
            toast({ variant: 'destructive', title: 'Materials not ready', description: 'This job cannot be scheduled until garments/materials are received.' });
            pendingOpsRef.current.delete(jobId);
            return;
          }
        }
        if (mr.reorderPointWarnings) {
          const threshold = Number(mr.lowStockThreshold || 0);
          const materialStatus = (job as any).materialStatus as string | undefined;
          if (materialStatus === 'low_stock') {
            toast({ title: 'Low stock warning', description: 'Garments are flagged low stock for this item.' });
          } else if (threshold > 0 && Number(job.totalQuantity || 0) >= threshold) {
            toast({ title: 'Large order — verify stock', description: `Quantity ${job.totalQuantity} meets/exceeds threshold ${threshold}.` });
          }
        }
      } catch {}

      // Outsourcing rules
      try {
        const orules = (rules?.outsourcingRules || {}) as any;
        if (orules.autoOutsourcing?.enabled) {
          const camelize = (s: string) => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
          const methodKeyCamel = selectedMethod === 'screen_printing' ? 'screenPrinting' : camelize(selectedMethod);
          // Capacity-based outsourcing
          const thresholdPct = Number(orules.autoOutsourcing.capacityThreshold || 0);
          if (thresholdPct > 0) {
            const sameDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
            const dayKey = sameDay(startTime);
            const eqJobs = jobs.filter(j => j.equipmentId === equipmentId && j.scheduledStart && sameDay(new Date(j.scheduledStart)) === dayKey);
            const totalHours = eqJobs.reduce((acc, j) => {
              const s = new Date(j.scheduledStart as any).getTime();
              const e = new Date((j.scheduledEnd || j.scheduledStart) as any).getTime();
              return acc + Math.max(0, (e - s) / 3600000);
            }, 0) + Math.max(0, ((endTime.getTime() - startTime.getTime()) / 3600000));
            const orgEq = (organization as any)?.org_settings?.production?.equipment as Array<any> | undefined;
            const capPerDay = (() => {
              const meta = (orgEq || []).find(eq => String(eq.id) === String(equipmentId));
              const cap = Number(meta?.capacity || 0);
              return cap > 0 ? cap / 60 : 8; // fallback 8h/day
            })();
            const utilization = capPerDay > 0 ? (totalHours / capPerDay) * 100 : 0;
            if (utilization >= thresholdPct) {
              const vendors = ((orules.preferredVendors || {})[methodKeyCamel] || []) as string[];
              const vendorMsg = vendors.length ? `Preferred vendors: ${vendors.join(', ')}` : 'No preferred vendors configured.';
              toast({ variant: 'destructive', title: 'Auto-outsourcing recommended', description: `Capacity exceeds ${thresholdPct}%. ${vendorMsg}` });
              try { await logAudit(jobId, 'auto_outsource_recommended', { reason: 'capacity', utilization, thresholdPct, equipment_id: equipmentId }); } catch {}
              pendingOpsRef.current.delete(jobId);
              return;
            }
          }
          // Lead-time-based outsourcing
          const bufferDays = Number(orules.autoOutsourcing.leadTimeBuffer || 0);
          if (bufferDays > 0 && job.dueDate) {
            const hoursLeft = Math.ceil(((new Date(job.dueDate).getTime()) - startTime.getTime()) / 3600000);
            if (hoursLeft < bufferDays * 24) {
              const vendors = ((orules.preferredVendors || {})[methodKeyCamel] || []) as string[];
              const vendorMsg = vendors.length ? `Preferred vendors: ${vendors.join(', ')}` : 'No preferred vendors configured.';
              toast({ variant: 'destructive', title: 'Auto-outsourcing recommended', description: `Lead time < ${bufferDays} day(s). ${vendorMsg}` });
              try { await logAudit(jobId, 'auto_outsource_recommended', { reason: 'lead_time', hoursLeft, bufferDays }); } catch {}
              pendingOpsRef.current.delete(jobId);
              return;
            }
          }
        }
      } catch {}
      // Notification Rules
      try {
        const notif = (rules?.notificationRules || {}) as any;
        // Due Date warnings: when scheduling a job close to/after its due date
        if (notif.dueDateWarnings?.enabled && job.dueDate) {
          const hoursLeft = Math.ceil(((new Date(job.dueDate).getTime()) - startTime.getTime()) / 3600000);
          const triggers: number[] = Array.isArray(notif.dueDateWarnings.warningHours) ? notif.dueDateWarnings.warningHours : [];
          const hit = triggers.find(t => hoursLeft <= t);
          if (hit != null) {
            toast({ title: 'Due soon', description: `Job due in ~${Math.max(hoursLeft, 0)}h (threshold ${hit}h).` });
          }
        }
        // Capacity overload: warn if total scheduled hours on this equipment/day cross threshold
        if (notif.capacityOverload?.enabled) {
          const thresholdPct = Number(notif.capacityOverload.thresholdPercentage || 0);
          if (thresholdPct > 0) {
            const sameDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
            const dayKey = sameDay(startTime);
            const eqJobs = jobs.filter(j => j.equipmentId === equipmentId && j.scheduledStart && sameDay(new Date(j.scheduledStart)) === dayKey);
            const totalHours = eqJobs.reduce((acc, j) => {
              const s = new Date(j.scheduledStart as any).getTime();
              const e = new Date((j.scheduledEnd || j.scheduledStart) as any).getTime();
              return acc + Math.max(0, (e - s) / 3600000);
            }, 0) + Math.max(0, ((endTime.getTime() - startTime.getTime()) / 3600000));
            // Capacity via org equipment if available; fallback to 8h/day
            const orgEq = (organization as any)?.org_settings?.production?.equipment as Array<any> | undefined;
            const capPerDay = (() => {
              const meta = (orgEq || []).find(eq => String(eq.id) === String(equipmentId));
              const cap = Number(meta?.capacity || 0);
              return cap > 0 ? cap / 60 /* if capacity was per day units; adjust as needed */ : 8; // assume hours/day fallback
            })();
            const utilization = capPerDay > 0 ? (totalHours / capPerDay) * 100 : 0;
            if (utilization >= thresholdPct) {
              toast({ title: 'Capacity warning', description: `This station is at ~${Math.round(utilization)}% capacity for the day.` });
            }
          }
        }
        // Equipment maintenance reminders: heuristic placeholder based on scheduled hours
        if (notif.equipmentMaintenance?.enabled) {
          const interval = Number(notif.equipmentMaintenance.maintenanceIntervalHours || 0);
          if (interval > 0) {
            const eqJobs = jobs.filter(j => j.equipmentId === equipmentId);
            const accumulated = eqJobs.reduce((acc, j) => {
              const s = j.scheduledStart ? new Date(j.scheduledStart).getTime() : 0;
              const e = j.scheduledEnd ? new Date(j.scheduledEnd).getTime() : s;
              return acc + Math.max(0, (e - s) / 3600000);
            }, 0) + Math.max(0, ((endTime.getTime() - startTime.getTime()) / 3600000));
            if (accumulated >= interval && Math.abs(accumulated - interval) < 2 /* within 2 hours window */) {
              toast({ title: 'Maintenance reminder', description: 'This station is due for maintenance soon.' });
            }
          }
        }
      } catch {}
      // Basic Scheduling rules: setup buffer and rush priority
      try {
        const setupBufMin = Number(rules?.setupTimeBuffer || 0);
        if (setupBufMin > 0) {
          // Apply setup buffer by extending the end time
          endTime = new Date(endTime.getTime() + setupBufMin * 60000);
        }
        if (rules?.rushJobPriority) {
          // Warn if placing a non-rush job ahead of a rush job due earlier on the same equipment
          const rushSoon = jobs.some(j => j.equipmentId === equipmentId && (j as any).priority === 'high' && j.dueDate && new Date(j.dueDate).getTime() < (job.dueDate ? new Date(job.dueDate).getTime() : Number.MAX_SAFE_INTEGER));
          if (rushSoon && (job as any).priority !== 'high') {
            toast({ title: 'Rush priority policy', description: 'A rush job due earlier is queued on this station.' });
          }
        }
      } catch {}

      // Cost Optimization rules (suggestions only)
      try {
        const cost = (rules?.costOptimization || {}) as any;
        // Rush job surcharge suggestion
        if (cost.rushJobSurcharge?.enabled && job.dueDate) {
          const hoursLeft = Math.ceil(((new Date(job.dueDate).getTime()) - startTime.getTime()) / 3600000);
          const threshold = Number(cost.rushJobSurcharge.rushThresholdHours || 0);
          if (threshold > 0 && hoursLeft <= threshold) {
            const pct = Number(cost.rushJobSurcharge.surchargePercentage || 0);
            toast({ title: 'Rush surcharge suggested', description: `Due in ~${Math.max(hoursLeft, 0)}h. Consider surcharge ${pct}%` });
          }
        }
        // Small quantity penalty suggestion
        if (cost.smallQuantityPenalty?.enabled) {
          const minQty = Number(cost.smallQuantityPenalty.minimumQuantity || 0);
          if (minQty > 0 && Number(job.totalQuantity || 0) < minQty) {
            const pct = Number(cost.smallQuantityPenalty.penaltyPercentage || 0);
            toast({ title: 'Small quantity penalty suggested', description: `Qty ${job.totalQuantity} < ${minQty}. Consider ${pct}% penalty` });
          }
        }
        // Utilization target hint
        if (Number(cost.equipmentUtilizationTarget || 0) > 0) {
          const target = Number(cost.equipmentUtilizationTarget);
          const sameDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
          const dayKey = sameDay(startTime);
          const eqJobs = jobs.filter(j => j.equipmentId === equipmentId && j.scheduledStart && sameDay(new Date(j.scheduledStart)) === dayKey);
          const totalHours = eqJobs.reduce((acc, j) => {
            const s = new Date(j.scheduledStart as any).getTime();
            const e = new Date((j.scheduledEnd || j.scheduledStart) as any).getTime();
            return acc + Math.max(0, (e - s) / 3600000);
          }, 0) + Math.max(0, ((endTime.getTime() - startTime.getTime()) / 3600000));
          const orgEq = (organization as any)?.org_settings?.production?.equipment as Array<any> | undefined;
          const capPerDay = (() => {
            const meta = (orgEq || []).find(eq => String(eq.id) === String(equipmentId));
            const cap = Number(meta?.capacity || 0);
            return cap > 0 ? cap / 60 : 8; // fallback 8h/day
          })();
          const utilization = capPerDay > 0 ? (totalHours / capPerDay) * 100 : 0;
          if (utilization < target - 5) {
            toast({ description: `Station utilization ~${Math.round(utilization)}% (< target ${target}%).` });
          } else if (utilization > target + 5) {
            toast({ description: `Station utilization ~${Math.round(utilization)}% (> target ${target}%).` });
          }
        }
      } catch {}
      // Quality Control reminder: surface checklist when the target stage has an enabled checkpoint
      try {
        const qc = (rules?.qualityControl || {}) as any;
        const checkpoints = (qc?.qualityCheckpoints || {}) as Record<string, { enabled: boolean; checklistItems: string[] }>;
        // Build candidate keys to match how settings are saved (methodId.stageId) or legacy (stageId)
        const camelize = (s: string) => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
        const methodCandidates = new Set<string>([
          selectedMethod,
          selectedMethod === 'screen_printing' ? 'screenPrinting' : camelize(selectedMethod)
        ]);
        const keyCandidates: string[] = [
          ...Array.from(methodCandidates).map(m => `${m}.${toStage}`),
          `${toStage}`,
        ];
        const key = keyCandidates.find(k => checkpoints[k]?.enabled);
        if (key) {
          const items = checkpoints[key]?.checklistItems || [];
          if (items.length) {
            const preview = items.slice(0, 3).join(' • ');
            const more = items.length > 3 ? ` (+${items.length - 3} more)` : '';
            toast({ title: 'QC checkpoint for this stage', description: `${preview}${more}` });
          } else {
            toast({ title: 'QC checkpoint for this stage', description: 'Checklist required' });
          }
        }
      } catch {}
    } catch {}
    // ensure endTime matches the duration we expect to render
    endTime = new Date(startTime.getTime() + Math.round(hoursToUse * 60) * 60000);
    // console.debug('[DnD] handleJobSchedule', { jobId, equipmentId, start: startTime.toISOString(), end: endTime.toISOString(), stage: toStage, hours: hoursToUse });
    setJobs(jobs => jobs.map(j =>
      j.id === jobId
        ? { ...j, status: "scheduled", currentStage: toStage, equipmentId, scheduledStart: startTime, scheduledEnd: endTime, estimatedHours: stageHours || j.estimatedHours || 1 }
        : j
    ));
    try {
      await supabase.rpc('move_job', {
        p_job_id: jobId,
        p_stage: toStage,
        p_start: startTime.toISOString(),
        p_end: endTime.toISOString(),
        p_equipment_id: equipmentId || null,
      });
      track('job_scheduled', { job_id: jobId, stage_id: toStage, start: startTime.toISOString(), end: endTime.toISOString(), equipment_id: equipmentId || null });
      await logAudit(jobId, 'schedule', { fromStage, toStage, start: startTime.toISOString(), end: endTime.toISOString(), equipment_id: equipmentId || null });
    } catch (e) {
      console.warn('move_job failed', e);
    } finally { pendingOpsRef.current.delete(jobId); }
  };

  const handleJobUnschedule = async (jobId: string) => {
    // Permissions relaxed
    if (pendingOpsRef.current.has(jobId)) return;
    pendingOpsRef.current.add(jobId);
    const job = jobs.find(j => j.id === jobId);
    const fromStage = job?.currentStage ?? null;
    setJobs(jobs => jobs.map(j => 
      j.id === jobId 
        ? { ...j, status: "unscheduled", equipmentId: undefined, scheduledStart: undefined, scheduledEnd: undefined }
        : j
    ));
    try { 
      // Unschedule only for the active stage
      await supabase.rpc('unschedule_job_stage', { p_job_id: jobId, p_stage: selectedStage }); 
      console.debug('[Stage] unschedule_job_stage ok', { jobId, selectedStage });
      track('job_status_changed', { job_id: jobId, from_status: 'scheduled', to_status: 'unscheduled' });
      await logAudit(jobId, 'unschedule', { fromStage, toStage: null });
    } catch {}
    finally { pendingOpsRef.current.delete(jobId); }
  };

  const handleStageAdvance = async (jobId: string) => {
    // Permissions relaxed
    if (pendingOpsRef.current.has(jobId)) return;
    pendingOpsRef.current.add(jobId);
    const currentStages = stagesByMethod[selectedMethod];
    const currentIndex = currentStages.findIndex(stage => stage.id === selectedStage);
    
    if (currentIndex < currentStages.length - 1) {
      const nextStage = currentStages[currentIndex + 1];
      setJobs(jobs => jobs.map(job => 
        job.id === jobId 
          ? { ...job, currentStage: nextStage.id as ProductionStage, status: "unscheduled", equipmentId: undefined, scheduledStart: undefined, scheduledEnd: undefined }
          : job
      ));
      try {
        await supabase.rpc('move_job', { p_job_id: jobId, p_stage_code: nextStage.id, p_scheduled_date: null });
        track('job_stage_changed', { job_id: jobId, from_stage_id: selectedStage, to_stage_id: nextStage.id });
        await logAudit(jobId, 'advance_stage', { fromStage: selectedStage, toStage: nextStage.id });
      } catch (e) {
        console.warn('move_job stage failed', e);
      } finally { pendingOpsRef.current.delete(jobId); }
    }
    setIsJobDetailModalOpen(false);
  };

  const handleJobStart = async (jobId: string) => {
    // Permissions relaxed
    if (pendingOpsRef.current.has(jobId)) return;
    pendingOpsRef.current.add(jobId);
    setJobs(jobs => jobs.map(j => j.id === jobId ? { ...j, status: 'in_progress' } : j));
    try {
      await supabase.rpc('update_job_status', { p_job_id: jobId, p_status: 'in_progress' });
      track('job_status_changed', { job_id: jobId, from_status: 'scheduled', to_status: 'in_progress' });
      await logAudit(jobId, 'start', { stage: selectedStage });
      try {
        runStatusChangeAutomations(organization?.org_settings, { entityType: 'job', entityId: jobId, toStatus: 'in_progress', fromStatus: 'scheduled', payload: { stage: selectedStage } }, { notify: (t, d) => toast({ title: t, description: d }) });
      } catch {}
    } catch {}
    finally { pendingOpsRef.current.delete(jobId); }
  };

  const handleJobMarkDone = async (jobId: string) => {
    // Permissions relaxed
    if (pendingOpsRef.current.has(jobId)) return;
    pendingOpsRef.current.add(jobId);
    setJobs(jobs => jobs.map(j => j.id === jobId ? { ...j, status: 'done' } : j));
    try {
      await supabase.rpc('update_job_status', { p_job_id: jobId, p_status: 'done' });
      track('job_done', { job_id: jobId });
      track('job_status_changed', { job_id: jobId, from_status: 'in_progress', to_status: 'done' });
      await logAudit(jobId, 'mark_done', { stage: selectedStage });
      try {
        runStatusChangeAutomations(organization?.org_settings, { entityType: 'job', entityId: jobId, toStatus: 'done', fromStatus: 'in_progress', payload: { stage: selectedStage } }, { notify: (t, d) => toast({ title: t, description: d }) });
      } catch {}
    } catch {}
    finally { pendingOpsRef.current.delete(jobId); }
  };

  const handleJobBlockToggle = async (jobId: string, block: boolean) => {
    // Permissions relaxed
    if (pendingOpsRef.current.has(jobId)) return;
    pendingOpsRef.current.add(jobId);
    setJobs(jobs => jobs.map(j => j.id === jobId ? { ...j, status: block ? 'blocked' as any : 'scheduled' } : j));
    try {
      await supabase.rpc('update_job_status', { p_job_id: jobId, p_status: block ? 'blocked' : 'scheduled' });
      track('job_status_changed', { job_id: jobId, from_status: block ? 'scheduled' : 'blocked', to_status: block ? 'blocked' : 'scheduled' });
      await logAudit(jobId, block ? 'block' : 'unblock', { stage: selectedStage });
      try {
        runStatusChangeAutomations(organization?.org_settings, { entityType: 'job', entityId: jobId, toStatus: block ? 'blocked' : 'scheduled', fromStatus: block ? 'scheduled' : 'blocked', payload: { stage: selectedStage } }, { notify: (t, d) => toast({ title: t, description: d }) });
      } catch {}
    } catch {}
    finally { pendingOpsRef.current.delete(jobId); }
  };

  const handleJobReopen = async (jobId: string) => {
    // Permissions relaxed
    if (pendingOpsRef.current.has(jobId)) return;
    pendingOpsRef.current.add(jobId);
    setJobs(jobs => jobs.map(j => j.id === jobId ? { ...j, status: 'scheduled' } : j));
    try {
      await supabase.rpc('update_job_status', { p_job_id: jobId, p_status: 'scheduled' });
      track('job_status_changed', { job_id: jobId, from_status: 'canceled_or_blocked', to_status: 'scheduled' });
      await logAudit(jobId, 'reopen', { stage: selectedStage });
      try {
        runStatusChangeAutomations(organization?.org_settings, { entityType: 'job', entityId: jobId, toStatus: 'scheduled', fromStatus: 'canceled_or_blocked', payload: { stage: selectedStage } }, { notify: (t, d) => toast({ title: t, description: d }) });
      } catch {}
    } catch {}
    finally { pendingOpsRef.current.delete(jobId); }
  };

  const handleJobClick = (job: ImprintJob) => {
    setSelectedJob(job);
    setIsJobDetailModalOpen(true);
  };

  const handleJobUnscheduleFromModal = (jobId: string) => {
    handleJobUnschedule(jobId);
    setIsJobDetailModalOpen(false);
  };

  const handleStageChangeFromModal = async (stageId: string) => {
    if (!selectedJob) return;
    const jobId = selectedJob.id;
    setJobs(prev => prev.map(j => j.id === jobId ? { ...j, currentStage: stageId as any } : j));
    try {
      await supabase.rpc('move_job', { p_job_id: jobId, p_stage: stageId, p_start: null, p_end: null, p_equipment_id: null });
    } catch {}
  };

  const handleDeleteJob = async (jobId: string) => {
    try {
      await supabase.from('production_jobs').delete().eq('id', jobId);
    } catch (e) {
      console.warn('delete production_job failed', e);
    } finally {
      setJobs(prev => prev.filter(j => j.id !== jobId));
      setIsJobDetailModalOpen(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-background">
      <SchedulerHeader 
        selectedDate={selectedDate}
        onDateChange={setSelectedDate}
        selectedMethod={selectedMethod}
      />
      
      <div className="border-b border-border bg-background px-6 py-4">
        <div className="flex items-center gap-8">
          <DecorationMethodDropdown 
            selectedMethod={selectedMethod}
            onMethodChange={handleMethodChange}
            methods={methodOptions}
          />
          
          <ProductionStageDropdown
            selectedStage={selectedStage}
            onStageChange={setSelectedStage as any}
            stages={stagesByMethod[selectedMethod] || []}
          />

          <div className="flex items-center gap-3 ml-auto">
            <Select value={selectedDecoration} onValueChange={setSelectedDecoration}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Decoration (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Decorations</SelectItem>
                {(stagesByMethod[selectedMethod] || []).length > 0 && (
                  <SelectItem value="standard">Standard</SelectItem>
                )}
              </SelectContent>
            </Select>
            <Select value={viewMode} onValueChange={(v) => setViewMode(v as any)}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="View" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="board">Board</SelectItem>
                <SelectItem value="calendar">Calendar</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
      
      <UnscheduledJobsPanel 
        jobs={unscheduledJobs}
        allJobs={jobs}
        selectedDate={selectedDate}
        onStageAdvance={handleStageAdvance}
        onJobClick={handleJobClick}
      />
      
      {loading ? (
        <div className="flex-1 p-6 space-y-3">
          <div className="h-6 w-40 bg-muted animate-pulse rounded" />
          <div className="h-32 bg-muted animate-pulse rounded" />
          <div className="h-32 bg-muted animate-pulse rounded" />
        </div>
      ) : viewMode === 'board' ? (
      <SchedulingGrid 
        jobs={scheduledJobs}
        allJobs={jobs}
        selectedDate={selectedDate}
        selectedMethod={selectedMethod}
        selectedStage={selectedStage}
        terminalStageId={terminalStageId}
        onJobSchedule={handleJobSchedule}
        onJobUnschedule={handleJobUnschedule}
        onStageAdvance={handleStageAdvance}
        onJobStart={handleJobStart}
        onJobMarkDone={handleJobMarkDone}
        onJobBlockToggle={handleJobBlockToggle}
        onJobReopen={handleJobReopen}
        onJobClick={handleJobClick}
      />
      ) : (
        <div className="flex-1 overflow-auto bg-background p-4">
          <div className="grid grid-cols-7 gap-3">
            {Array.from({ length: 7 }).map((_, idx) => {
              const d = new Date(selectedDate);
              d.setDate(selectedDate.getDate() - d.getDay() + idx);
              const dayJobs = jobs.filter(j => (
                j.decorationMethod === selectedMethod &&
                j.scheduledStart ? new Date(j.scheduledStart).toDateString() === d.toDateString() : false
              ));
              return (
                <div key={idx} className="border rounded-md p-2 min-h-[200px]">
                  <div className="text-sm font-medium mb-2">{d.toLocaleDateString()}</div>
                  <div className="space-y-2">
                    {dayJobs.map(j => (
                      <div key={j.id} className="text-xs p-2 rounded bg-muted cursor-pointer" onClick={() => setSelectedJob(j)}>
                        {j.customerName} — {j.description}
                      </div>
                    ))}
                    {dayJobs.length === 0 && (
                      <div className="text-xs text-muted-foreground">No scheduled jobs</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <JobDetailModal
        job={selectedJob}
        open={isJobDetailModalOpen}
        onOpenChange={setIsJobDetailModalOpen}
        onStageAdvance={selectedJob ? () => handleStageAdvance(selectedJob.id) : undefined}
        onUnschedule={selectedJob ? () => handleJobUnscheduleFromModal(selectedJob.id) : undefined}
        allJobs={jobs}
        onStageChange={handleStageChangeFromModal}
        onDelete={selectedJob ? () => handleDeleteJob(selectedJob.id) : undefined}
      />
    </div>
  );
}
