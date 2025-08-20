import { HorizontalJobCard } from "./HorizontalJobCard";
import { ImprintJob } from "@/types/imprint-job";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface Equipment {
  id: string;
  name: string;
  capacity: number;
  type: string;
}

interface TimeSlot {
  hour: number;
  minute: number;
  totalMinutes: number;
  label: string;
  isHourMark: boolean;
}

interface HourlyTimeSlotProps {
  timeSlot: TimeSlot;
  equipment: Equipment;
  jobs: ImprintJob[];
  allJobs: ImprintJob[];
  selectedDate: Date;
  onJobSchedule: (jobId: string, equipmentId: string, startTime: Date, endTime: Date) => void;
  onJobUnschedule: (jobId: string) => void;
  onStageAdvance: (jobId: string) => void;
  terminalStageId?: string;
  onJobStart?: (jobId: string) => void;
  onJobMarkDone?: (jobId: string) => void;
  onJobBlockToggle?: (jobId: string, block: boolean) => void;
  onJobReopen?: (jobId: string) => void;
  onJobClick?: (job: ImprintJob) => void;
}

export function HourlyTimeSlot({ 
  timeSlot, 
  equipment, 
  jobs,
  allJobs,
  selectedDate,
  onJobSchedule,
  onJobUnschedule,
  onStageAdvance,
  terminalStageId,
  onJobStart,
  onJobMarkDone,
  onJobBlockToggle,
  onJobReopen,
  onJobClick
}: HourlyTimeSlotProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    try {
      const jobData = e.dataTransfer.getData("application/json");
      if (!jobData) {
        console.warn("No job data in drag transfer");
        return;
      }

      const job = JSON.parse(jobData) as ImprintJob & { isScheduledMove?: boolean };
      console.log("Dropping job:", job.jobNumber, "onto equipment:", equipment.name, "at hour:", timeSlot.hour);
      
      // Simplify to start-of-hour scheduling
      const startTime = new Date(selectedDate);
      startTime.setHours(timeSlot.hour, 0, 0, 0);
      const endTime = new Date(startTime);
      endTime.setTime(endTime.getTime() + (job.estimatedHours * 60 * 60 * 1000));
      
      console.log("Scheduling from:", startTime.toLocaleTimeString(), "to:", endTime.toLocaleTimeString());
      onJobSchedule(job.id, equipment.id, startTime, endTime);
    } catch (error) {
      console.error("Error handling job drop:", error);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    // Only clear if we're truly leaving the drop zone
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  };

  // Detect overlapping jobs and assign columns
  const detectOverlaps = (jobs: { job: ImprintJob; startMinutes: number; endMinutes: number }[]) => {
    const columns: { job: ImprintJob; startMinutes: number; endMinutes: number; column: number }[] = [];
    
    jobs.forEach(jobData => {
      let column = 0;
      // Find the first column where this job doesn't overlap with existing jobs
      while (columns.some(existing => 
        existing.column === column &&
        jobData.startMinutes < existing.endMinutes &&
        jobData.endMinutes > existing.startMinutes
      )) {
        column++;
      }
      columns.push({ ...jobData, column });
    });
    
    const maxColumns = Math.max(...columns.map(c => c.column), 0) + 1;
    return { columns, maxColumns };
  };

  // Calculate job positions and detect overlaps
  const jobsWithTiming = jobs.map(job => {
    if (!job.scheduledStart) return null;
    
    const startMinutes = job.scheduledStart.getMinutes();
    const durationMinutes = job.estimatedHours * 60;
    const endMinutes = startMinutes + durationMinutes;
    
    return { job, startMinutes, endMinutes };
  }).filter(Boolean);

  const { columns, maxColumns } = detectOverlaps(jobsWithTiming);

  // Calculate positioned jobs with column layout
  const positionedJobs = columns.map(({ job, startMinutes, endMinutes, column }) => {
    const durationMinutes = job.estimatedHours * 60;
    
    // Position within the hour (0-100%)
    const topPercent = (startMinutes / 60) * 100;
    
    // Height based on full duration (allow spanning beyond current hour)
    const heightPercent = (durationMinutes / 60) * 100;
    
    // Column positioning
    const columnWidth = 100 / maxColumns;
    const leftPercent = column * columnWidth;
    const widthPercent = columnWidth - 1; // Small gap between columns
    
    // Fix "Continues..." logic: Only show if job actually extends beyond current hour boundary
    // Check if the job's visual representation extends beyond this hour slot
    const jobStartsInThisHour = job.scheduledStart.getHours() === timeSlot.hour;
    const jobDurationInThisHour = jobStartsInThisHour ? 
      Math.min(durationMinutes, 60 - startMinutes) : 0;
    
    // Only show "Continues..." if this job starts in this hour but extends beyond it
    const spansNextHour = jobStartsInThisHour && (startMinutes + durationMinutes) > 60;
    
    return {
      job,
      topPercent,
      heightPercent,
      leftPercent,
      widthPercent,
      spansNextHour
    };
  });

  const hasJobs = jobs.length > 0;
  
  // Fix over-utilization logic: only mark as over-utilized if jobs actually overlap in time
  const hasOverlappingJobs = maxColumns > 1;
  const isOverUtilized = hasOverlappingJobs;

  return (
    <div 
      className={cn(
        "relative h-12 flex border-b border-border/50 transition-colors",
        isOverUtilized && "bg-warning/10 border-l-2 border-warning",
        hasJobs && "hover:bg-muted/5",
        isDragOver && "bg-primary/5"
      )}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      {/* Time label */}
      <div className="w-16 flex-shrink-0 px-2 py-1 border-r border-border/30 flex flex-col justify-center">
        <span className="text-xs font-medium text-foreground">
          {timeSlot.label}
        </span>
        {isOverUtilized && (
          <div className="text-xs text-warning-foreground">
            Conflict
          </div>
        )}
      </div>

      {/* Drop zone visual feedback */}
      <div className={cn(
        "absolute left-16 right-0 top-0 bottom-0 pointer-events-none transition-all",
        isDragOver && "bg-primary/10 border-2 border-dashed border-primary/50 rounded"
      )} />

      {/* Jobs container */}
      <div className="flex-1 relative">
        {!hasJobs && (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground/60 italic pointer-events-none">
            Drop jobs here to schedule
          </div>
        )}
        
        {positionedJobs.map(({ job, topPercent, heightPercent, leftPercent, widthPercent, spansNextHour }) => (
          <div
            key={job.id}
            className="absolute z-10"
            style={{
              top: `${topPercent}%`,
              left: `calc(${leftPercent}% + 8px)`,
              width: `calc(${widthPercent}% - 8px)`,
              height: `${Math.max(heightPercent, 50)}%`,
              minHeight: '48px'
            }}
          >
            <div 
              className="h-full transition-all"
              draggable={job.status !== 'done' && job.status !== 'blocked' && job.status !== 'completed'}
              onDragStart={(e) => {
                e.dataTransfer.setData("application/json", JSON.stringify({
                  ...job,
                  isScheduledMove: true
                }));
                e.dataTransfer.effectAllowed = "move";
              }}
            >
              <HorizontalJobCard
                job={job}
                allJobs={allJobs}
                variant="scheduled"
                draggable={false}
                onStageAdvance={() => onStageAdvance(job.id)}
                onClick={onJobClick ? () => onJobClick(job) : undefined}
                onUnschedule={() => onJobUnschedule(job.id)}
                className="h-full min-h-[48px] text-xs"
              />
              {/* Inline actions per rules: start, mark done, block/unblock, reopen */}
              <div className="absolute -top-2 right-2 flex gap-1">
                {onJobStart && job.status === 'scheduled' && (
                  <button className="text-[10px] px-1 py-0.5 rounded border bg-background" onClick={(e) => { e.stopPropagation(); onJobStart(job.id); }}>Start</button>
                )}
                {onJobMarkDone && terminalStageId && job.currentStage === (terminalStageId as any) && job.status === 'in_progress' && (
                  <button className="text-[10px] px-1 py-0.5 rounded border bg-background" onClick={(e) => { e.stopPropagation(); onJobMarkDone(job.id); }}>Mark Done</button>
                )}
                {onJobBlockToggle && job.status !== 'done' && job.status !== 'completed' && (
                  <button className="text-[10px] px-1 py-0.5 rounded border bg-background" onClick={(e) => { e.stopPropagation(); onJobBlockToggle(job.id, job.status !== 'blocked'); }}>{job.status === 'blocked' ? 'Unblock' : 'Block'}</button>
                )}
                {onJobReopen && (job.status === 'done' || job.status === 'completed' || job.status === 'blocked') && (
                  <button className="text-[10px] px-1 py-0.5 rounded border bg-background" onClick={(e) => { e.stopPropagation(); onJobReopen(job.id); }}>Reopen</button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}