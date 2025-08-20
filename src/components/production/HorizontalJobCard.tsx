import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ImprintJob } from "@/types/imprint-job";
import { Clock, Calendar, Package, FileCheck, AlertCircle, ChevronRight, X, FlagTriangleRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { getJobReadinessStatus } from "@/utils/stageDependencyUtils";

interface HorizontalJobCardProps {
  job: ImprintJob;
  allJobs?: ImprintJob[]; // All jobs for dependency checking
  variant: "unscheduled" | "scheduled";
  draggable?: boolean;
  className?: string;
  onStageAdvance?: () => void;
  onClick?: () => void;
  onUnschedule?: () => void;
}

export function HorizontalJobCard({ 
  job, 
  allJobs = [],
  variant, 
  draggable = false, 
  className, 
  onStageAdvance, 
  onClick,
  onUnschedule
}: HorizontalJobCardProps) {
  const isPriority = job.priority === "high";
  const isOverdue = job.dueDate < new Date() && job.status !== "completed";
  const isBlocked = (job.status as any) === 'blocked';
  const isCanceled = (job.status as any) === 'canceled';
  
  // Get dependency status for unscheduled jobs
  const readinessStatus = variant === "unscheduled" ? getJobReadinessStatus(job, allJobs) : { isReady: true };

  const handleDragStart = (e: React.DragEvent) => {
    if (draggable) {
      e.dataTransfer.setData("application/json", JSON.stringify({
        ...job,
        isScheduledMove: variant === "scheduled"
      }));
      e.dataTransfer.effectAllowed = "move";
    }
  };

  return (
    <div
      className={cn(
        "bg-card border border-border rounded-lg p-3 transition-all hover:shadow-sm relative",
        "flex items-center gap-3 min-h-[60px]", // Horizontal layout
        variant === "scheduled" && "bg-muted/50 border-muted",
        variant === "unscheduled" && (!isBlocked ? (readinessStatus.isReady 
          ? "bg-green-50 border-green-200" 
          : "bg-red-50 border-red-200") : "bg-yellow-50 border-yellow-300"),
        isCanceled && "opacity-60",
        isPriority && "border-orange-300 bg-orange-50",
        isOverdue && "border-red-300 bg-red-50",
        draggable && "cursor-grab active:cursor-grabbing",
        onClick && "cursor-pointer hover:border-primary/50",
        className
      )}
      draggable={draggable}
      onDragStart={handleDragStart}
      onClick={onClick}
    >
      {/* Visual previews */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {job.mockupImage && (
          <div className="w-8 h-8 rounded border overflow-hidden bg-muted">
            <img 
              src={job.mockupImage} 
              alt="Garment mockup" 
              className="w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
        )}
        {job.imprintLogo && (
          <div className="w-8 h-8 rounded border overflow-hidden bg-muted">
            <img 
              src={job.imprintLogo} 
              alt="Imprint logo" 
              className="w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
        )}
      </div>

      {/* Job number and sequence */}
      <div className="flex items-center gap-2 flex-shrink-0 min-w-[80px]">
        <span className="font-semibold text-sm text-foreground">
          {job.jobNumber}
        </span>
        {job.sequenceOrder && (
          <Badge variant="outline" className="text-xs px-1 py-0 h-4">
            {job.sequenceOrder}
          </Badge>
        )}
      </div>

      {/* Priority and status indicators */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {isBlocked && (
          <FlagTriangleRight className="h-3 w-3 text-yellow-600" />
        )}
        {isCanceled && (
          <Badge variant="outline" className="text-xs px-1 py-0 h-4 text-red-600 border-red-300">CANCELED</Badge>
        )}
        {variant === "unscheduled" && !readinessStatus.isReady && (
          <Badge variant="destructive" className="text-xs px-1 py-0 h-4">
            WAITING
          </Badge>
        )}
        {variant === "unscheduled" && readinessStatus.isReady && (
          <Badge variant="secondary" className="text-xs px-1 py-0 h-4 bg-green-100 text-green-700">
            READY
          </Badge>
        )}
        {isPriority && (
          <Badge variant="destructive" className="text-xs px-1 py-0 h-4">
            HIGH
          </Badge>
        )}
        {isOverdue && (
          <AlertCircle className="h-3 w-3 text-red-500" />
        )}
        {job.artworkApproved && (
          <FileCheck className="h-3 w-3 text-green-600" />
        )}
      </div>

      {/* Customer and description */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-foreground truncate">
          {job.customerName}
        </div>
        <div className="text-xs text-muted-foreground truncate">
          {job.description}
        </div>
        {job.quoteLastUpdatedAt && job.jobCreatedAt && job.quoteLastUpdatedAt > job.jobCreatedAt && (
          <div className="text-[10px] text-amber-700 mt-1">Quote was edited after this job was created. Review for resync.</div>
        )}
        {job.cancelReason && (
          <div className="text-[10px] text-red-700 mt-1">{job.cancelReason}</div>
        )}
      </div>

      {/* Quantity and method */}
      <div className="flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0">
        <Package className="h-3 w-3" />
        <span>{job.totalQuantity}</span>
      </div>

      {/* Decoration method */}
      <div className="flex-shrink-0">
        <Badge variant="secondary" className="text-xs">
          {job.decorationMethod.replace('_', ' ').toUpperCase()}
        </Badge>
      </div>

      {/* Time estimate */}
      <div className="flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0">
        <Clock className="h-3 w-3" />
        <span>{job.estimatedHours}h</span>
      </div>

      {/* Due date */}
      <div className="flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0">
        <Calendar className="h-3 w-3" />
        <span>{format(job.dueDate, "MMM d")}</span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {onStageAdvance && variant === "scheduled" && (
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              onStageAdvance();
            }}
            className="text-xs h-6 px-2"
          >
            <ChevronRight className="h-3 w-3" />
          </Button>
        )}
        {onUnschedule && variant === "scheduled" && (
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              onUnschedule();
            }}
            className="text-xs h-6 px-1 text-muted-foreground hover:text-destructive"
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  );
}