import { useEffect, useRef, useState } from "react";
import { SchedulerHeader } from "./SchedulerHeader";
import { DecorationMethodDropdown } from "./DecorationMethodDropdown";
import { ProductionStageDropdown } from "./ProductionStageDropdown";
import { UnscheduledJobsPanel } from "./UnscheduledJobsPanel";
import { SchedulingGrid } from "./SchedulingGrid";
import { JobDetailModal } from "./JobDetailModal";
import { ImprintJob } from "@/types/imprint-job";
import { convertOrderBreakdownToImprintJobs } from "@/utils/imprintJobUtils";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { getAvailableStages, isJobReadyForStage } from "@/utils/stageDependencyUtils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { track } from "@/lib/utils";
import { useOrganization } from "@/context/OrganizationContext";
import { useAuth } from "@/context/AuthContext";

export type DecorationMethod = "screen_printing" | "embroidery" | "dtf" | "dtg";

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
  const [selectedMethod, setSelectedMethod] = useState<DecorationMethod>("screen_printing");
  const [selectedStage, setSelectedStage] = useState<ProductionStage>("burn_screens");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedJob, setSelectedJob] = useState<ImprintJob | null>(null);
  const [isJobDetailModalOpen, setIsJobDetailModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'board' | 'calendar'>('board');
  const [selectedDecoration, setSelectedDecoration] = useState<string>('all');
  
  // Config loaded from backend
  const [stagesByMethod, setStagesByMethod] = useState<Record<DecorationMethod, Array<{ id: string; name: string; color: string }>>>({
    screen_printing: [],
    embroidery: [],
    dtf: [],
    dtg: [],
  });

  // Jobs state
  const [jobs, setJobs] = useState<ImprintJob[]>(convertOrderBreakdownToImprintJobs());
  const { toast } = useToast();
  const { organization } = useOrganization();
  const { user } = useAuth();
  const [loading, setLoading] = useState<boolean>(true);
  const pendingOpsRef = useRef<Set<string>>(new Set());
  const role = (organization?.user_role || '').toLowerCase();
  const isManager = ['production_manager', 'manager', 'admin', 'owner'].includes(role);
  const isOperator = ['operator'].includes(role);
  const canOperateBase = isManager || isOperator; // can move stages/change statuses
  const canScheduleHere = isManager || isOperator; // CSR can schedule from Quotes, not here
  const isAssigned = (job?: ImprintJob) => !!(job && user && job.assignedUserId && job.assignedUserId === user.id);
  const canOperate = (job?: ImprintJob) => isManager || (isOperator && isAssigned(job));

  // Load config and jobs from Supabase (without altering visual behavior)
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
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
          const next: Record<DecorationMethod, Array<{ id: string; name: string; color: string }>> = {
            screen_printing: [], embroidery: [], dtf: [], dtg: [],
          };
          (cfg.data as any[]).forEach((m: any) => {
            const key = methodToKey[m.method_code];
            if (!key) return;
            const decos = m.decorations?.[0]?.stages || [];
            next[key] = decos.map((s: any, idx: number) => ({ id: s.stage_code, name: s.display_name, color: colors[idx % colors.length] }));
          });
          console.debug('[Scheduler] stagesByMethod computed', next);
          setStagesByMethod(next);
        } else {
          // Fallback default stages when RPC fails
          const defaults: Record<DecorationMethod, Array<{ id: string; name: string; color: string }>> = {
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
          setStagesByMethod(defaults);
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
          estimatedHours: Number(j.estimated_hours || 0),
          dueDate: j.due_date ? new Date(j.due_date) : new Date(),
          priority: (j.priority as any) || 'medium',
          artworkApproved: true,
          currentStage: (j.current_stage as any),
          equipmentId: j.equipment_id || undefined,
          scheduledStart: j.scheduled_start ? new Date(j.scheduled_start) : undefined,
          scheduledEnd: j.scheduled_end ? new Date(j.scheduled_end) : undefined,
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
                .select('id, product_name, product_description, product_sku, color, quantity, xs, s, m, l, xl, xxl, xxxl')
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
        // Prepend loaded jobs to preserve current visuals; do not remove demo data yet
        setJobs((prev) => {
          const existingIds = new Set(prev.map(p => p.id));
          const merged = [...mapped.filter(m => !existingIds.has(m.id)), ...prev];
          console.debug('[Scheduler] mapped jobs merged', { incoming: mapped.length, preExisting: prev.length, merged: merged.length });
          return merged;
        });
      } catch {}
      finally { setLoading(false); }
    };
    load();
  }, []);

  // Update selected stage when method changes
  const handleMethodChange = (method: DecorationMethod) => {
    setSelectedMethod(method);
    const firstStage = stagesByMethod[method][0];
    setSelectedStage(firstStage.id as ProductionStage);
  };

  // Filter jobs by selected method and stage
  const filteredJobs = jobs.filter(job => 
    job.decorationMethod === selectedMethod && 
    (selectedDecoration === 'all' || (job as any).decoration_code === selectedDecoration) &&
    (!job.currentStage || job.currentStage === selectedStage)
  );
  const filterDiagnostics = (() => {
    let byMethod = 0, byDecoration = 0, byStage = 0;
    jobs.forEach(job => {
      if (job.decorationMethod !== selectedMethod) {
        byMethod++;
        return;
      }
      if (!(selectedDecoration === 'all' || (job as any).decoration_code === selectedDecoration)) {
        byDecoration++;
        return;
      }
      if (!!job.currentStage && job.currentStage !== selectedStage) {
        byStage++;
        return;
      }
    });
    return { byMethod, byDecoration, byStage };
  })();
  console.debug('[Scheduler] filter', { selectedMethod, selectedStage, selectedDecoration, totalJobs: jobs.length, filtered: filteredJobs.length, dropped: filterDiagnostics });
  
  const unscheduledJobs = filteredJobs.filter(job => job.status === "unscheduled");
  const scheduledJobs = filteredJobs.filter(job => job.status === "scheduled" || job.status === "in_progress");
  const terminalStageId = (stagesByMethod[selectedMethod]?.[stagesByMethod[selectedMethod].length - 1]?.id || undefined) as ProductionStage | undefined;
  
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
    if (!canScheduleHere) {
      toast({ title: 'Not allowed', description: 'Your role cannot schedule from the Scheduler. Use Quotes to schedule.', variant: 'destructive' });
      return;
    }
    if (pendingOpsRef.current.has(jobId)) return;
    pendingOpsRef.current.add(jobId);
    const job = jobs.find(j => j.id === jobId);
    if (!job) return;

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

    setJobs(jobs => jobs.map(j =>
      j.id === jobId
        ? { ...j, status: "scheduled", currentStage: toStage, equipmentId, scheduledStart: startTime, scheduledEnd: endTime }
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
    if (!canOperate(jobs.find(j => j.id === jobId))) {
      toast({ title: 'Not allowed', description: 'You do not have permission to unschedule jobs.', variant: 'destructive' });
      return;
    }
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
      await supabase.rpc('unschedule_job', { p_job_id: jobId }); 
      track('job_status_changed', { job_id: jobId, from_status: 'scheduled', to_status: 'unscheduled' });
      await logAudit(jobId, 'unschedule', { fromStage, toStage: null });
    } catch {}
    finally { pendingOpsRef.current.delete(jobId); }
  };

  const handleStageAdvance = async (jobId: string) => {
    if (!canOperate(jobs.find(j => j.id === jobId))) {
      toast({ title: 'Not allowed', description: 'You do not have permission to advance stages.', variant: 'destructive' });
      return;
    }
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
    if (!canOperate(jobs.find(j => j.id === jobId))) {
      toast({ title: 'Not allowed', description: 'You do not have permission to start jobs.', variant: 'destructive' });
      return;
    }
    if (pendingOpsRef.current.has(jobId)) return;
    pendingOpsRef.current.add(jobId);
    setJobs(jobs => jobs.map(j => j.id === jobId ? { ...j, status: 'in_progress' } : j));
    try {
      await supabase.rpc('update_job_status', { p_job_id: jobId, p_status: 'in_progress' });
      track('job_status_changed', { job_id: jobId, from_status: 'scheduled', to_status: 'in_progress' });
      await logAudit(jobId, 'start', { stage: selectedStage });
    } catch {}
    finally { pendingOpsRef.current.delete(jobId); }
  };

  const handleJobMarkDone = async (jobId: string) => {
    if (!canOperate(jobs.find(j => j.id === jobId))) {
      toast({ title: 'Not allowed', description: 'You do not have permission to complete jobs.', variant: 'destructive' });
      return;
    }
    if (pendingOpsRef.current.has(jobId)) return;
    pendingOpsRef.current.add(jobId);
    setJobs(jobs => jobs.map(j => j.id === jobId ? { ...j, status: 'done' } : j));
    try {
      await supabase.rpc('update_job_status', { p_job_id: jobId, p_status: 'done' });
      track('job_done', { job_id: jobId });
      track('job_status_changed', { job_id: jobId, from_status: 'in_progress', to_status: 'done' });
      await logAudit(jobId, 'mark_done', { stage: selectedStage });
    } catch {}
    finally { pendingOpsRef.current.delete(jobId); }
  };

  const handleJobBlockToggle = async (jobId: string, block: boolean) => {
    if (!canOperate(jobs.find(j => j.id === jobId))) {
      toast({ title: 'Not allowed', description: 'You do not have permission to change block status.', variant: 'destructive' });
      return;
    }
    if (pendingOpsRef.current.has(jobId)) return;
    pendingOpsRef.current.add(jobId);
    setJobs(jobs => jobs.map(j => j.id === jobId ? { ...j, status: block ? 'blocked' as any : 'scheduled' } : j));
    try {
      await supabase.rpc('update_job_status', { p_job_id: jobId, p_status: block ? 'blocked' : 'scheduled' });
      track('job_status_changed', { job_id: jobId, from_status: block ? 'scheduled' : 'blocked', to_status: block ? 'blocked' : 'scheduled' });
      await logAudit(jobId, block ? 'block' : 'unblock', { stage: selectedStage });
    } catch {}
    finally { pendingOpsRef.current.delete(jobId); }
  };

  const handleJobReopen = async (jobId: string) => {
    if (!canOperate(jobs.find(j => j.id === jobId))) {
      toast({ title: 'Not allowed', description: 'You do not have permission to reopen jobs.', variant: 'destructive' });
      return;
    }
    if (pendingOpsRef.current.has(jobId)) return;
    pendingOpsRef.current.add(jobId);
    setJobs(jobs => jobs.map(j => j.id === jobId ? { ...j, status: 'scheduled' } : j));
    try {
      await supabase.rpc('update_job_status', { p_job_id: jobId, p_status: 'scheduled' });
      track('job_status_changed', { job_id: jobId, from_status: 'canceled_or_blocked', to_status: 'scheduled' });
      await logAudit(jobId, 'reopen', { stage: selectedStage });
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
          />
          
          <ProductionStageDropdown
            selectedStage={selectedStage}
            onStageChange={setSelectedStage}
            stages={stagesByMethod[selectedMethod]}
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
              const dayJobs = jobs.filter(j => j.scheduledStart ? new Date(j.scheduledStart).toDateString() === d.toDateString() : false);
              return (
                <div key={idx} className="border rounded-md p-2 min-h-[200px]">
                  <div className="text-sm font-medium mb-2">{d.toLocaleDateString()}</div>
                  <div className="space-y-2">
                    {dayJobs.map(j => (
                      <div key={j.id} className="text-xs p-2 rounded bg-muted cursor-pointer" onClick={() => setSelectedJob(j)}>
                        {j.customerName} — {j.description}
                      </div>
                    ))}
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
      />
    </div>
  );
}
