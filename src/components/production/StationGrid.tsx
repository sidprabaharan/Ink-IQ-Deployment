import { useState } from "react";
import { ImprintJob } from "@/types/imprint-job";
import { HourlyTimeSlot } from "./HourlyTimeSlot";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Equipment {
  id: string;
  name: string;
  capacity: number;
  type: string;
}

interface StationGridProps {
  equipment: Equipment;
  jobs: ImprintJob[];
  allJobs: ImprintJob[]; // All jobs for dependency checking
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

export function StationGrid({ 
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
}: StationGridProps) {
  const [isOpen, setIsOpen] = useState(true);

  // Generate hourly time slots from 8 AM to 6 PM (Google Calendar style)
  const timeSlots = Array.from({ length: 10 }, (_, i) => {
    const hour = 8 + i; // 8 AM to 5 PM (10 hours)
    return {
      hour,
      minute: 0,
      totalMinutes: hour * 60,
      label: `${hour % 12 || 12}:00 ${hour >= 12 ? 'PM' : 'AM'}`,
      isHourMark: true
    };
  });

  // Filter jobs for this equipment
  const equipmentJobs = jobs.filter(job => job.equipmentId === equipment.id);
  
  // Calculate utilization
  const totalScheduledHours = equipmentJobs.reduce((sum, job) => sum + job.estimatedHours, 0);
  const maxHours = 10; // 10 hours (8 AM to 6 PM)
  const utilization = Math.round((totalScheduledHours / maxHours) * 100);

  return (
    <Collapsible 
      open={isOpen} 
      onOpenChange={setIsOpen}
      className="w-full border border-border rounded-lg bg-card"
    >
      <CollapsibleTrigger asChild>
        <div className="flex items-center justify-between p-4 hover:bg-muted/50 cursor-pointer">
          <div className="flex items-center gap-3">
            <h3 className="font-semibold text-foreground">{equipment.name}</h3>
            <Badge variant="outline" className="text-xs">
              {equipment.type}
            </Badge>
            <Badge 
              variant={utilization > 80 ? "destructive" : utilization > 50 ? "default" : "secondary"}
              className="text-xs"
            >
              {utilization}% utilized
            </Badge>
            <Badge variant="outline" className="text-xs">
              {equipmentJobs.length} jobs
            </Badge>
          </div>
          <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </CollapsibleTrigger>
      
      <CollapsibleContent className="border-t border-border">
        <div className="w-full">
          {timeSlots.map(timeSlot => {
            // Filter jobs that start in this hour
            const slotJobs = equipmentJobs.filter(job => {
              if (!job.scheduledStart) return false;
              const jobStartHour = job.scheduledStart.getHours();
              return jobStartHour === timeSlot.hour;
            });

            return (
              <HourlyTimeSlot
                key={timeSlot.hour}
                timeSlot={timeSlot}
                equipment={equipment}
                jobs={slotJobs}
                allJobs={allJobs}
                selectedDate={selectedDate}
                onJobSchedule={onJobSchedule}
                onJobUnschedule={onJobUnschedule}
                onStageAdvance={onStageAdvance}
                terminalStageId={terminalStageId}
                onJobStart={onJobStart}
                onJobMarkDone={onJobMarkDone}
                onJobBlockToggle={onJobBlockToggle}
                onJobReopen={onJobReopen}
                onJobClick={onJobClick}
              />
            );
          })}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}