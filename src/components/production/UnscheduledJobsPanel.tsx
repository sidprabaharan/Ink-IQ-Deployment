import { HorizontalJobCard } from "./HorizontalJobCard";
import { ImprintJob } from "@/types/imprint-job";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Filter, Trash2, Calendar as CalIcon, StickyNote, Send } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { supabase } from "@/lib/supabase";
import { useOrganization } from "@/context/OrganizationContext";
import { useToast } from "@/hooks/use-toast";

interface UnscheduledJobsPanelProps {
	jobs: ImprintJob[];
	allJobs: ImprintJob[]; // All jobs for dependency checking
	selectedDate: Date;
	onStageAdvance: (jobId: string) => void;
	onJobClick?: (job: ImprintJob) => void;
}

export function UnscheduledJobsPanel({ jobs, allJobs, onStageAdvance, onJobClick }: UnscheduledJobsPanelProps) {
	const [isOpen, setIsOpen] = useState(false);
	const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
	const [methodFilter, setMethodFilter] = useState<string>("all");
	const [decorationFilter, setDecorationFilter] = useState<string>("all");
	const [customerSearch, setCustomerSearch] = useState("");
	const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
	const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const { organization } = useOrganization();
  const { toast } = useToast();
  const role = (organization?.user_role || '').toLowerCase();
  const isManager = ['production_manager', 'manager', 'admin', 'owner'].includes(role);
  const isOperator = ['operator'].includes(role);
  // Permissions relaxed: allow anyone to drag from Unscheduled
  const canScheduleHere = true;
  const canOperate = true;

	useEffect(() => {
		// Clear selection when list closes
		if (!isOpen) setSelectedIds(new Set());
	}, [isOpen]);

	const filteredJobs = useMemo(() => {
		const out = jobs.filter((j) => {
			if (methodFilter !== "all" && (j as any).decorationMethod !== methodFilter) return false;
			if (decorationFilter !== "all" && ((j as any).decoration_code || (j as any).decorationCode) !== decorationFilter) return false;
			if (customerSearch && !String(j.customerName || "").toLowerCase().includes(customerSearch.toLowerCase())) return false;
			if (dateFrom && new Date(j.dueDate).getTime() < new Date(dateFrom).setHours(0, 0, 0, 0)) return false;
			if (dateTo && new Date(j.dueDate).getTime() > new Date(dateTo).setHours(23, 59, 59, 999)) return false;
			return true;
		});
		console.debug('[DnD] Unscheduled filter', { in: jobs.length, out: out.length, methodFilter, decorationFilter, customerSearch, dateFrom: !!dateFrom, dateTo: !!dateTo });
		return out;
	}, [jobs, methodFilter, decorationFilter, customerSearch, dateFrom, dateTo]);

	// Sort jobs by due date then by order
	const sortedJobs = [...filteredJobs].sort((a, b) => {
		const dateCompare = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
		if (dateCompare !== 0) return dateCompare;
		if (a.orderId !== b.orderId) {
			return a.orderId.localeCompare(b.orderId);
		}
		return (a.sequenceOrder || 0) - (b.sequenceOrder || 0);
	});

	// Group unscheduled by Production Rules (Job Grouping)
	const rules = (organization?.org_settings as any)?.production?.productionRules as any | undefined;
	const groupingEnabled = !!rules?.autoGrouping?.enabled;
	const groupByDesign = !!rules?.autoGrouping?.groupByDesign;
	const groupByColors = !!rules?.autoGrouping?.groupByColors;
	const groupByGarmentType = !!rules?.autoGrouping?.groupByGarmentType;

	const groupedJobs = useMemo(() => {
		if (!groupingEnabled) return { All: sortedJobs } as Record<string, ImprintJob[]>;
		const map: Record<string, ImprintJob[]> = {};
		for (const j of sortedJobs) {
			const parts: string[] = [];
			if (groupByDesign) parts.push(String((j as any).description || '').trim().toLowerCase());
			if (groupByColors) parts.push(String((j as any).imprintColors || (j as any).colours || '').trim().toLowerCase());
			if (groupByGarmentType) parts.push(String((j as any).products?.[0]?.description || (j as any).garmentType || '').trim().toLowerCase());
			const key = parts.filter(Boolean).join(' | ') || 'Ungrouped';
			(map[key] ||= []).push(j);
		}
		return map;
	}, [sortedJobs, groupingEnabled, groupByDesign, groupByColors, groupByGarmentType]);

	const toggleSelect = (id: string, checked: boolean) => {
		setSelectedIds((prev) => {
			const next = new Set(prev);
			if (checked) next.add(id); else next.delete(id);
			return next;
		});
	};
	const toggleSelectAll = (checked: boolean) => {
		setSelectedIds(checked ? new Set(sortedJobs.map((j) => j.id)) : new Set());
	};

	const applyBulkDueDate = async (date: Date) => {
		if (!canOperate) {
			toast({ title: 'Not allowed', description: 'You do not have permission to update due dates.', variant: 'destructive' });
			return;
		}
		const yyyy = date.getFullYear(); const mm = String(date.getMonth() + 1).padStart(2, "0"); const dd = String(date.getDate()).padStart(2, "0");
		await Promise.all(Array.from(selectedIds).map((id) => supabase.rpc('move_job', { p_job_id: id, p_stage_code: null, p_scheduled_date: `${yyyy}-${mm}-${dd}`})));
		setSelectedIds(new Set());
	};
	const applyBulkNote = async (note: string) => {
		if (!canOperate) {
			toast({ title: 'Not allowed', description: 'You do not have permission to add notes.', variant: 'destructive' });
			return;
		}
		await Promise.all(Array.from(selectedIds).map((id) => supabase.from('production_jobs').update({ notes: note }).eq('id', id)));
		setSelectedIds(new Set());
	};
	const applyBulkDelete = async () => {
		if (!window.confirm(`Delete ${selectedIds.size} job(s)? This cannot be undone.`)) return;
		await Promise.all(Array.from(selectedIds).map((id) => supabase.from('production_jobs').delete().eq('id', id)));
		setSelectedIds(new Set());
	};

	return (
		<Collapsible open={isOpen} onOpenChange={setIsOpen} className="border-b border-border bg-muted/30">
			<CollapsibleTrigger asChild>
				<div className="flex items-center justify-between w-full p-4 hover:bg-muted/50 transition-colors">
				<div className="flex items-center gap-3">
					<h3 className="font-semibold text-foreground">Unscheduled Jobs</h3>
					<span className="text-sm text-muted-foreground">{sortedJobs.length} job{sortedJobs.length !== 1 ? 's' : ''}</span>
				</div>
				<div className="flex items-center gap-2">
					<div className="flex items-center gap-2">
						<Input placeholder="Search customer" value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} className="h-8 w-44" />
						<Select value={methodFilter} onValueChange={setMethodFilter}>
							<SelectTrigger className="h-8 w-40">
								<SelectValue placeholder="Method" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All Methods</SelectItem>
								<SelectItem value="screen_printing">Screen Printing</SelectItem>
								<SelectItem value="embroidery">Embroidery</SelectItem>
								<SelectItem value="dtf">DTF</SelectItem>
								<SelectItem value="dtg">DTG</SelectItem>
							</SelectContent>
						</Select>
						<Select value={decorationFilter} onValueChange={setDecorationFilter}>
							<SelectTrigger className="h-8 w-44">
								<SelectValue placeholder="Decoration" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All Decorations</SelectItem>
								<SelectItem value="standard">Standard</SelectItem>
							</SelectContent>
						</Select>
						<Popover>
							<PopoverTrigger asChild>
								<Button variant="outline" size="sm" className="h-8 gap-1"><Filter className="h-4 w-4" /> Due</Button>
							</PopoverTrigger>
							<PopoverContent align="end" className="w-auto p-2">
								<div className="flex gap-4">
									<div>
										<p className="text-xs mb-1">From</p>
										<Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus />
									</div>
									<div>
										<p className="text-xs mb-1">To</p>
										<Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus />
									</div>
								</div>
							</PopoverContent>
						</Popover>
					</div>
					<div className="flex items-center gap-2">
						<Checkbox checked={selectedIds.size === sortedJobs.length && sortedJobs.length > 0} onCheckedChange={(c) => toggleSelectAll(!!c)} />
						<Popover>
							<PopoverTrigger asChild>
								<Button variant="outline" size="sm" className="h-8">Bulk Actions</Button>
							</PopoverTrigger>
							<PopoverContent align="end" className="w-64">
								<div className="space-y-2 text-sm">
									<div className="font-medium">Apply to {selectedIds.size} selected</div>
									<div className="flex items-center gap-2">
										<CalIcon className="h-4 w-4" />
										<Popover>
											<PopoverTrigger asChild>
												<Button variant="outline" size="sm" disabled={!canOperate} title={!canOperate ? 'View-only role' : undefined}>Assign due date</Button>
											</PopoverTrigger>
											<PopoverContent className="w-auto p-2">
												<Calendar mode="single" onSelect={(d) => d && applyBulkDueDate(d)} initialFocus />
											</PopoverContent>
										</Popover>
									</div>
									<div className="flex items-center gap-2">
										<StickyNote className="h-4 w-4" />
										<Button variant="outline" size="sm" disabled={!canOperate} title={!canOperate ? 'View-only role' : undefined} onClick={async () => {
											const note = window.prompt('Note to add to selected jobs:') || '';
											if (note) await applyBulkNote(note);
										}}>Add note</Button>
									</div>
									<div className="flex items-center gap-2">
										<Trash2 className="h-4 w-4 text-red-600" />
										<Button variant="destructive" size="sm" disabled={!isManager} title={!isManager ? 'Managers only' : undefined} onClick={applyBulkDelete}>Delete</Button>
									</div>
									<div className="flex items-center gap-2">
										<Send className="h-4 w-4" />
										<Button variant="outline" size="sm" onClick={() => setIsOpen(false)}>Send to Scheduler</Button>
									</div>
								</div>
							</PopoverContent>
						</Popover>
					</div>
				</div>
				</div>
			</CollapsibleTrigger>

			<CollapsibleContent>
				<div className="px-4 pb-4">
					<ScrollArea className="h-48">
						<div className="space-y-4 pr-4">
							{Object.entries(groupedJobs).map(([group, list]) => (
								<div key={group}>
									{groupingEnabled && (
										<div className="text-xs text-muted-foreground mb-1">{group} — {list.length}</div>
									)}
									{list.slice(0, 100).map(job => (
										<div
											key={job.id}
											className="flex items-center gap-2 select-none"
											onDragStart={(e) => {
												try {
													const payload = JSON.stringify({ ...job, isScheduledMove: false });
													e.dataTransfer.setData("application/json", payload);
													e.dataTransfer.setData("text/plain", payload);
													e.dataTransfer.effectAllowed = "move";
												} catch {}
											}}
										>
											<div onMouseDown={(e) => e.stopPropagation()} onDragStart={(e) => e.preventDefault()}>
												<Checkbox checked={selectedIds.has(job.id)} onCheckedChange={(c) => toggleSelect(job.id, !!c)} />
											</div>
											<HorizontalJobCard
												job={job}
												allJobs={allJobs}
												variant="unscheduled"
												draggable={canScheduleHere}
												onStageAdvance={() => onStageAdvance(job.id)}
												onClick={onJobClick ? () => onJobClick(job) : undefined}
											/>
										</div>
									))}
								</div>
							))}
							{sortedJobs.length > 100 && (
								<div className="text-xs text-muted-foreground py-2">Showing first 100 jobs… refine filters to narrow results.</div>
							)}
						</div>
					</ScrollArea>

					{sortedJobs.length === 0 && (
						<p className="text-sm text-muted-foreground py-8 text-center">
							No unscheduled jobs for this decoration method
						</p>
					)}
				</div>
			</CollapsibleContent>
		</Collapsible>
	);
}