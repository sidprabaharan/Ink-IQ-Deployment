import { DecorationMethod, ProductionStage } from "@/components/production/PrintavoPowerScheduler";

export interface ImprintProduct {
  id: string;
  itemNumber: string;
  color: string;
  description: string;
  quantity: number;
  status: string;
}

export interface ImprintFile {
  id: string;
  name: string;
  type: string;
  url: string;
}

export interface ImprintJob {
  id: string;
  jobNumber: string;
  orderId: string;
  lineItemGroupId: string;
  imprintSectionId: string;
  status: "unscheduled" | "scheduled" | "in_progress" | "completed" | "done" | "blocked" | "canceled";
  customerName: string;
  description: string;
  decorationMethod: DecorationMethod;
  placement: string;
  size: string;
  colours: string;
  notes?: string;
  files: ImprintFile[];
  products: ImprintProduct[];
  totalQuantity: number;
  estimatedHours: number;
  dueDate: Date;
  priority: "low" | "medium" | "high";
  artworkApproved: boolean;
  currentStage?: ProductionStage;
  equipmentId?: string;
  scheduledStart?: Date;
  scheduledEnd?: Date;
  setupRequired?: boolean;
  specialInstructions?: string;
  sequenceOrder?: number;
  dependsOnJobs?: string[];
  blocksJobs?: string[];
  orderGroupColor?: string;
  assignedUserId?: string;
  jobCreatedAt?: Date;
  quoteLastUpdatedAt?: Date;
  cancelReason?: string;
  
  // Visual elements
  mockupImage?: string;
  imprintLogo?: string;
  
  // Detailed imprint specifications
  imprintMethod?: string;
  imprintLocation?: string;
  imprintSize?: string;
  imprintColors?: string;
  imprintNotes?: string;
  customerArt?: ImprintFile[];
  productionFiles?: ImprintFile[];
  proofMockup?: ImprintFile[];
  
  // Product size breakdown
  sizeBreakdown?: {
    [productId: string]: {
      [size: string]: number;
    };
  };
  
  // Routing instructions for job splitting and destination management
  routingInstructions?: {
    id: string;
    type: "imprint_routing" | "shipping_routing" | "size_split" | "general_routing";
    title: string;
    description: string;
    splits: {
      id: string;
      destinationType: "next_imprint" | "shipping_location" | "quality_check" | "storage";
      destinationId?: string; // ID of next job, shipping location, etc.
      destinationName: string; // Human readable name
      criteria: {
        sizes?: string[]; // e.g., ["S", "M"]
        quantities?: { [size: string]: number }; // e.g., { "S": 50, "M": 75 }
        productIds?: string[]; // specific products
        conditions?: string; // additional conditions
      };
      instructions: string; // specific instructions for this split
      priority?: number; // order of processing
    }[];
  }[];
}

export function getDecorationMethodFromType(type: string): DecorationMethod {
  const methodMap: Record<string, DecorationMethod> = {
    "Screen Print": "screen_printing",
    "Embroidery": "embroidery",
    "DTF": "dtf",
    "Digital Print": "dtg",
    "DTG": "dtg",
    "Heat Transfer": "dtf"
  };
  
  return methodMap[type] || "screen_printing";
}

export function calculateEstimatedHours(method: DecorationMethod, quantity: number): number {
  const baseRates: Record<DecorationMethod, number> = {
    screen_printing: 0.02, // 2 minutes per piece
    embroidery: 0.08, // 5 minutes per piece  
    dtf: 0.03, // 2 minutes per piece
    dtg: 0.05 // 3 minutes per piece
  };
  
  const setupTimes: Record<DecorationMethod, number> = {
    screen_printing: 1.5, // 1.5 hours setup
    embroidery: 0.5, // 30 minutes setup
    dtf: 0.75, // 45 minutes setup
    dtg: 0.25 // 15 minutes setup
  };
  
  return setupTimes[method] + (baseRates[method] * quantity);
}

export function determineArtworkApproval(products: ImprintProduct[]): boolean {
  return products.every(product => 
    product.status === "Complete" || 
    product.status === "In Production"
  );
}

export function determinePriority(dueDate: Date): "low" | "medium" | "high" {
  const now = new Date();
  const daysDiff = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  
  if (daysDiff <= 3) return "high";
  if (daysDiff <= 7) return "medium";
  return "low";
}