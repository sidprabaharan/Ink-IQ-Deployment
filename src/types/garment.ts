export type GarmentStatus = 
  | 'pending'
  | 'artwork_pending'
  | 'artwork_approved'
  | 'scheduled'
  | 'in_production'
  | 'quality_check'
  | 'production_complete'
  | 'po_created'
  | 'ordered'
  | 'received'
  | 'damaged'
  | 'stock_issue'
  | 'ready'
  | 'shipped'
  | 'delivered';

export type GarmentIssueType = 
  | 'damaged'
  | 'missing'
  | 'quality_issue'
  | 'delayed'
  | 'incorrect_item'
  | 'size_issue';

export interface GarmentIssue {
  id: string;
  type: GarmentIssueType;
  description: string;
  reportedDate: Date;
  resolvedDate?: Date;
  severity: 'low' | 'medium' | 'high';
  affectedQuantity: number;
  notes?: string;
}

export interface GarmentStatusHistory {
  id: string;
  status: GarmentStatus;
  timestamp: Date;
  notes?: string;
  updatedBy?: string;
}

export interface GarmentDetails {
  id?: string;
  status: GarmentStatus;
  poReference?: string;
  stockIssues: GarmentIssue[];
  receivedQuantity: number;
  expectedQuantity: number;
  statusHistory: GarmentStatusHistory[];
  notes?: string;
  lastUpdated: Date;
}

export const GARMENT_STATUS_CONFIG = {
  pending: {
    label: 'Pending',
    color: 'bg-gray-100 text-gray-800',
    description: 'Awaiting production scheduling'
  },
  artwork_pending: {
    label: 'Artwork Pending',
    color: 'bg-amber-100 text-amber-800',
    description: 'Waiting for artwork approval'
  },
  artwork_approved: {
    label: 'Artwork Approved',
    color: 'bg-lime-100 text-lime-800',
    description: 'Artwork ready for production'
  },
  scheduled: {
    label: 'Scheduled',
    color: 'bg-indigo-100 text-indigo-800',
    description: 'Scheduled for production'
  },
  in_production: {
    label: 'In Production',
    color: 'bg-purple-100 text-purple-800',
    description: 'Currently being produced'
  },
  quality_check: {
    label: 'Quality Check',
    color: 'bg-cyan-100 text-cyan-800',
    description: 'In quality control'
  },
  production_complete: {
    label: 'Production Complete',
    color: 'bg-teal-100 text-teal-800',
    description: 'Production finished, ready for shipping'
  },
  po_created: {
    label: 'PO Created',
    color: 'bg-blue-100 text-blue-800',
    description: 'Purchase order has been created'
  },
  ordered: {
    label: 'Ordered',
    color: 'bg-yellow-100 text-yellow-800',
    description: 'Order has been placed with supplier'
  },
  received: {
    label: 'Received',
    color: 'bg-green-100 text-green-800',
    description: 'Items have been received'
  },
  damaged: {
    label: 'Damaged',
    color: 'bg-red-100 text-red-800',
    description: 'Items are damaged and need replacement'
  },
  stock_issue: {
    label: 'Stock Issue',
    color: 'bg-orange-100 text-orange-800',
    description: 'Stock availability issues'
  },
  ready: {
    label: 'Ready',
    color: 'bg-emerald-100 text-emerald-800',
    description: 'Ready for delivery'
  },
  shipped: {
    label: 'Shipped',
    color: 'bg-sky-100 text-sky-800',
    description: 'Shipped to customer'
  },
  delivered: {
    label: 'Delivered',
    color: 'bg-green-200 text-green-900',
    description: 'Delivered to customer'
  }
} as const;