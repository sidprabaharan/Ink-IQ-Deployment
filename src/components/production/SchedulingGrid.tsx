import { StationGrid } from "./StationGrid";
import { ImprintJob } from "@/types/imprint-job";
import { DecorationMethod, ProductionStage } from "./PrintavoPowerScheduler";

interface SchedulingGridProps {
  jobs: ImprintJob[];
  allJobs: ImprintJob[]; // All jobs for dependency checking
  selectedDate: Date;
  selectedMethod: DecorationMethod;
  selectedStage: ProductionStage;
  terminalStageId?: ProductionStage;
  onJobSchedule: (jobId: string, equipmentId: string, startTime: Date, endTime: Date) => void;
  onJobUnschedule: (jobId: string) => void;
  onStageAdvance: (jobId: string) => void;
  onJobStart?: (jobId: string) => void;
  onJobMarkDone?: (jobId: string) => void;
  onJobBlockToggle?: (jobId: string, block: boolean) => void;
  onJobReopen?: (jobId: string) => void;
  onJobClick?: (job: ImprintJob) => void;
}

// Equipment configurations for different decoration methods and stages
const equipmentConfig = {
  screen_printing: {
    burn_screens: [
      { id: "screen-room-1", name: "Screen Room A", capacity: 20, type: "Screen Station" },
      { id: "screen-room-2", name: "Screen Room B", capacity: 20, type: "Screen Station" }
    ],
    mix_ink: [
      { id: "ink-station-1", name: "Ink Station 1", capacity: 10, type: "Ink Mixing" },
      { id: "ink-station-2", name: "Ink Station 2", capacity: 10, type: "Ink Mixing" }
    ],
    print: [
      { id: "press-1", name: "M&R Sportsman E", capacity: 840, type: "Automatic Press" },
      { id: "press-2", name: "M&R Gauntlet III", capacity: 720, type: "Automatic Press" },
      { id: "press-3", name: "Manual Press #1", capacity: 300, type: "Manual Press" }
    ]
  },
  embroidery: {
    digitize: [
      { id: "digitize-1", name: "Digitizing Station 1", capacity: 5, type: "Digitizing" },
      { id: "digitize-2", name: "Digitizing Station 2", capacity: 5, type: "Digitizing" }
    ],
    hoop: [
      { id: "hoop-station-1", name: "Hooping Station", capacity: 50, type: "Hooping" }
    ],
    embroider: [
      { id: "emb-1", name: "Brother PR-1050X", capacity: 200, type: "10-Head Machine" },
      { id: "emb-2", name: "Tajima TMAR-1501", capacity: 180, type: "15-Head Machine" }
    ]
  },
  dtf: {
    design_file: [
      { id: "design-station-1", name: "Design Station", capacity: 10, type: "Design Work" }
    ],
    dtf_print: [
      { id: "dtf-printer-1", name: "Epson F570", capacity: 400, type: "DTF Printer" }
    ],
    powder: [
      { id: "powder-station-1", name: "Powder Station", capacity: 200, type: "Powder Application" }
    ],
    cure: [
      { id: "cure-oven-1", name: "Cure Oven", capacity: 100, type: "Curing Oven" }
    ]
  },
  dtg: {
    pretreat: [
      { id: "pretreat-1", name: "Pretreat Station", capacity: 500, type: "Pretreatment" }
    ],
    dtg_print: [
      { id: "dtg-1", name: "Brother GTX", capacity: 300, type: "DTG Printer" },
      { id: "dtg-2", name: "Epson F2100", capacity: 250, type: "DTG Printer" }
    ],
    dtg_cure: [
      { id: "dtg-cure-1", name: "DTG Cure Tunnel", capacity: 200, type: "Curing" }
    ]
  }
};

export function SchedulingGrid({ 
  jobs, 
  allJobs,
  selectedDate, 
  selectedMethod, 
  selectedStage,
  terminalStageId,
  onJobSchedule,
  onJobUnschedule,
  onStageAdvance,
  onJobStart,
  onJobMarkDone,
  onJobBlockToggle,
  onJobReopen,
  onJobClick
}: SchedulingGridProps) {
  const equipment = equipmentConfig[selectedMethod]?.[selectedStage] || [];

  return (
    <div className="flex-1 overflow-auto bg-background p-4">
      <div className="space-y-4 w-full">
        {equipment.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No equipment available for this stage
          </div>
        ) : (
          equipment.map(eq => (
            <StationGrid
              key={eq.id}
              equipment={eq}
              jobs={jobs}
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
          ))
        )}
      </div>
    </div>
  );
}