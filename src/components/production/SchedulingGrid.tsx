import { StationGrid } from "./StationGrid";
import { ImprintJob } from "@/types/imprint-job";
import { DecorationMethod, ProductionStage } from "./PrintavoPowerScheduler";
import { useOrganization } from "@/context/OrganizationContext";

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
  const { organization } = useOrganization();
  // Normalize ids to broaden matching across custom configurations, but scoped per method
  const norm = (s: string) => (s || '')
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/-/g, '_');
  const normalizeMethodId = (id: string) => (id || '')
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/\s+/g, '_')
    .replace(/-/g, '_')
    .toLowerCase();
  const toTitle = (s: string) => (s || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substring(1));
  const methodKey = selectedMethod as keyof typeof equipmentConfig;
  const stageKey = selectedStage as keyof (typeof equipmentConfig)[typeof methodKey];
  // Prefer org-configured equipment lanes if available
  const orgEquipment = ((organization as any)?.org_settings?.production?.equipment as Array<any>) || [];
  const preferred = orgEquipment
    .filter((eq: any) => Array.isArray(eq?.stageAssignments) && eq.stageAssignments.some((sa: any) => {
      const saMethod = normalizeMethodId(sa?.decorationMethod || '');
      const methodMatches = saMethod === (methodKey as string);
      const stageMatches = Array.isArray(sa?.stageIds) && sa.stageIds.includes(selectedStage as string);
      return methodMatches && stageMatches;
    }))
    .map((eq: any) => ({
      id: String(eq.id || `${methodKey}-${stageKey}-${Math.random().toString(36).slice(2)}`),
      name: String(eq.name || toTitle(String(eq.type || 'Work Cell'))),
      capacity: Number(eq.capacity || 100),
      type: String(eq.type || 'Work Cell'),
    }));

  let equipment = (preferred && preferred.length)
    ? preferred
    : (equipmentConfig as any)[methodKey]?.[stageKey] || [];
  if (!equipment.length) {
    const ns = norm(selectedStage as string);
    switch (methodKey) {
      case 'screen_printing': {
        if (/burn/.test(ns) || /screen/.test(ns)) {
          equipment = (equipmentConfig as any).screen_printing?.burn_screens || [];
        } else if (/mix/.test(ns) || /ink/.test(ns)) {
          equipment = (equipmentConfig as any).screen_printing?.mix_ink || [];
        } else if (/print/.test(ns)) {
          equipment = (equipmentConfig as any).screen_printing?.print || [];
        }
        // Strong fallback: always show Screen Room lanes if still empty
        if (!equipment.length) {
          equipment = (equipmentConfig as any).screen_printing?.burn_screens || [
            { id: "screen-room-1", name: "Screen Room A", capacity: 20, type: "Screen Station" },
            { id: "screen-room-2", name: "Screen Room B", capacity: 20, type: "Screen Station" }
          ];
        }
        break;
      }
      case 'dtf': {
        if (/design/.test(ns) || /art/.test(ns)) {
          equipment = (equipmentConfig as any).dtf?.design_file || [];
        } else if (/(^|_)dtf(_|$)/.test(ns) || /print/.test(ns)) {
          equipment = (equipmentConfig as any).dtf?.dtf_print || [];
        } else if (/powder/.test(ns)) {
          equipment = (equipmentConfig as any).dtf?.powder || [];
        } else if (/cure/.test(ns) || /oven/.test(ns) || /bake/.test(ns)) {
          equipment = (equipmentConfig as any).dtf?.cure || [];
        }
        break;
      }
      case 'dtg': {
        if (/pretreat/.test(ns) || /pre_treat/.test(ns)) {
          equipment = (equipmentConfig as any).dtg?.pretreat || [];
        } else if (/print/.test(ns)) {
          equipment = (equipmentConfig as any).dtg?.dtg_print || [];
        } else if (/cure/.test(ns) || /oven/.test(ns)) {
          equipment = (equipmentConfig as any).dtg?.dtg_cure || [];
        }
        break;
      }
      default:
        // Generic fallback for custom methods: provide two lanes based on method and stage
        equipment = [
          { id: `${methodKey}-${stageKey}-1`, name: `${toTitle(methodKey as string)} ${toTitle(stageKey as string)} 1`, capacity: 100, type: 'Work Cell' },
          { id: `${methodKey}-${stageKey}-2`, name: `${toTitle(methodKey as string)} ${toTitle(stageKey as string)} 2`, capacity: 100, type: 'Work Cell' },
        ];
        break;
    }
  }

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
              selectedStage={selectedStage}
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