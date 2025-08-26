import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Plus, Trash2, Edit, Settings, Clock, Factory, Palette, GripVertical, ChevronDown, ChevronRight, AlertCircle, DollarSign, Truck, Package, Bell } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { IMPRINT_METHODS, getMethodConfig } from '@/types/imprint';
import { EquipmentConstraints } from '@/types/equipment';
import { EquipmentConstraintsForm } from '@/components/settings/EquipmentConstraintsForm';
import { useOrganization } from '@/context/OrganizationContext';

interface DecorationMethod {
  id: string;
  name: string;
  label: string;
  enabled: boolean;
  stages: ProductionStage[];
}

interface ProductionStage {
  id: string;
  name: string;
  color: string;
  order: number;
}

interface StageAssignment {
  decorationMethod: string;
  stageIds: string[];
}

interface Equipment {
  id: string;
  name: string;
  type: string;
  stageAssignments: StageAssignment[];
  capacity: number;
  workingHours: WorkingHours;
  status: 'active' | 'maintenance' | 'offline';
  constraints: EquipmentConstraints;
}


interface WorkingHours {
  monday: { enabled: boolean; start: string; end: string };
  tuesday: { enabled: boolean; start: string; end: string };
  wednesday: { enabled: boolean; start: string; end: string };
  thursday: { enabled: boolean; start: string; end: string };
  friday: { enabled: boolean; start: string; end: string };
  saturday: { enabled: boolean; start: string; end: string };
  sunday: { enabled: boolean; start: string; end: string };
}

interface ProductionRules {
  // Job Grouping & Batching
  autoGrouping: {
    enabled: boolean;
    groupByDesign: boolean;
    groupByColors: boolean;
    groupByGarmentType: boolean;
  };
  batchingRules: {
    [decorationMethod: string]: {
      minBatchSize: number;
      maxBatchSize: number;
      bufferTime: number; // minutes
    };
  };
  
  // Quality Control
  qualityControl: {
    artApprovalRequired: boolean;
    sampleApprovalThreshold: number;
    qualityCheckpoints: {
      [stageId: string]: {
        enabled: boolean;
        checklistItems: string[];
      };
    };
  };
  
  // Material & Inventory
  materialRules: {
    checkStockBeforeScheduling: boolean;
    reorderPointWarnings: boolean;
    lowStockThreshold: number;
  };
  
  // Notifications
  notificationRules: {
    dueDateWarnings: {
      enabled: boolean;
      warningHours: number[];
    };
    equipmentMaintenance: {
      enabled: boolean;
      maintenanceIntervalHours: number;
    };
    capacityOverload: {
      enabled: boolean;
      thresholdPercentage: number;
    };
  };
  
  // Cost Optimization
  costOptimization: {
    rushJobSurcharge: {
      enabled: boolean;
      surchargePercentage: number;
      rushThresholdHours: number;
    };
    smallQuantityPenalty: {
      enabled: boolean;
      minimumQuantity: number;
      penaltyPercentage: number;
    };
    equipmentUtilizationTarget: number;
  };
  
  // Outsourcing
  outsourcingRules: {
    autoOutsourcing: {
      enabled: boolean;
      capacityThreshold: number;
      leadTimeBuffer: number; // days
    };
    preferredVendors: {
      [decorationMethod: string]: string[];
    };
  };
  
  // Legacy rules
  autoScheduling: boolean;
  setupTimeBuffer: number;
  rushJobPriority: boolean;
}

const defaultWorkingHours: WorkingHours = {
  monday: { enabled: true, start: '09:00', end: '17:00' },
  tuesday: { enabled: true, start: '09:00', end: '17:00' },
  wednesday: { enabled: true, start: '09:00', end: '17:00' },
  thursday: { enabled: true, start: '09:00', end: '17:00' },
  friday: { enabled: true, start: '09:00', end: '17:00' },
  saturday: { enabled: false, start: '09:00', end: '17:00' },
  sunday: { enabled: false, start: '09:00', end: '17:00' },
};

export function ProductionSettings() {
  const { organization, updateOrganizationSettings } = useOrganization();
  const orgMethods = useMemo(() => {
    const s: any = organization?.org_settings || {};
    return s.production?.decorationMethods as DecorationMethod[] | undefined;
  }, [organization]);
  const [decorationMethods, setDecorationMethods] = useState<DecorationMethod[]>([]);

  useEffect(() => {
    if (orgMethods && Array.isArray(orgMethods) && orgMethods.length) {
      setDecorationMethods(orgMethods);
      return;
    }
    // Fallback to sensible defaults (first 4 imprint methods)
    const defaults = IMPRINT_METHODS.slice(0, 4).map((method) => ({
      id: method.value,
      name: method.value,
      label: method.label,
      enabled: true,
      stages: getDefaultStagesForMethod(method.value)
    }));
    setDecorationMethods(defaults);
  }, [orgMethods]);

  const [editingMethod, setEditingMethod] = useState<DecorationMethod | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [newMethodName, setNewMethodName] = useState('');
  const [savingMethods, setSavingMethods] = useState(false);

  function getDefaultStagesForMethod(methodValue: string): ProductionStage[] {
    const stageMap: Record<string, ProductionStage[]> = {
      // Canonical IDs aligned with scheduler equipmentConfig
      screenPrinting: [
        { id: 'burn_screens', name: 'Burn Screens', color: 'bg-blue-500', order: 1 },
        { id: 'mix_ink', name: 'Mix Ink', color: 'bg-purple-500', order: 2 },
        { id: 'print', name: 'Print', color: 'bg-green-500', order: 3 },
      ],
      embroidery: [
        { id: 'digitizing', name: 'Digitizing', color: 'bg-blue-500', order: 1 },
        { id: 'hooping', name: 'Hooping', color: 'bg-purple-500', order: 2 },
        { id: 'embroidering', name: 'Embroidering', color: 'bg-green-500', order: 3 },
        { id: 'trimming', name: 'Trimming', color: 'bg-yellow-500', order: 4 },
      ],
      dtf: [
        { id: 'printing', name: 'Printing', color: 'bg-blue-500', order: 1 },
        { id: 'powder', name: 'Powder Application', color: 'bg-purple-500', order: 2 },
        { id: 'curing', name: 'Curing', color: 'bg-orange-500', order: 3 },
        { id: 'pressing', name: 'Heat Pressing', color: 'bg-red-500', order: 4 },
      ],
      dtg: [
        { id: 'pretreat', name: 'Pretreatment', color: 'bg-blue-500', order: 1 },
        { id: 'dtg_print', name: 'DTG Print', color: 'bg-green-500', order: 2 },
        { id: 'dtg_cure', name: 'DTG Cure', color: 'bg-orange-500', order: 3 },
      ],
    };
    
    return stageMap[methodValue] || [
      { id: 'preparation', name: 'Preparation', color: 'bg-blue-500', order: 1 },
      { id: 'production', name: 'Production', color: 'bg-green-500', order: 2 },
      { id: 'finishing', name: 'Finishing', color: 'bg-orange-500', order: 3 },
    ];
  }

  const handleEditMethod = (method: DecorationMethod) => {
    setEditingMethod({ ...method });
    setIsEditDialogOpen(true);
  };

  const handleSaveMethod = () => {
    if (!editingMethod) return;
    
    setDecorationMethods(prev => 
      prev.map(method => 
        method.id === editingMethod.id ? editingMethod : method
      )
    );
    setIsEditDialogOpen(false);
    setEditingMethod(null);
    // Persist changes to org settings
    handlePersistMethods().catch(() => {});
  };

  const slugify = (txt: string) => txt.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

  const handleAddMethod = () => {
    const name = newMethodName.trim();
    if (!name) return;
    const id = slugify(name);
    if (decorationMethods.some(m => m.id === id)) {
      setNewMethodName('');
      return;
    }
    const method: DecorationMethod = {
      id,
      name: id,
      label: name,
      enabled: true,
      stages: getDefaultStagesForMethod(id)
    };
    const next = [...decorationMethods, method];
    setDecorationMethods(next);
    setNewMethodName('');
    // Persist immediately so Production reflects without extra steps
    handlePersistMethods(next).catch(() => {});
  };

  const handlePersistMethods = async (override?: DecorationMethod[]) => {
    try {
      setSavingMethods(true);
      const methodsToSave = override ?? decorationMethods;
      const existingProduction = (organization?.org_settings as any)?.production || {};
      const payload = { production: { ...existingProduction, decorationMethods: methodsToSave, equipment } } as any;
      const res = await updateOrganizationSettings(payload);
      // no toast here; Settings page parent already provides feedback patterns elsewhere
      return res;
    } finally {
      setSavingMethods(false);
    }
  };

  const handleToggleMethod = (methodId: string) => {
    const next = decorationMethods.map(method =>
        method.id === methodId ? { ...method, enabled: !method.enabled } : method
    );
    setDecorationMethods(next);
    // Persist immediately to reflect on Production page
    handlePersistMethods(next).catch(() => {});
  };

  const handleDeleteMethod = (methodId: string) => {
    const next = decorationMethods.filter(method => method.id !== methodId);
    setDecorationMethods(next);
    // Persist immediately to reflect on Production page
    handlePersistMethods(next).catch(() => {});
  };

  const handleAddStage = () => {
    if (!editingMethod) return;
    
    const newStage: ProductionStage = {
      id: `stage_${Date.now()}`,
      name: 'New Stage',
      color: 'bg-gray-500',
      order: editingMethod.stages.length + 1
    };
    
    const nextEditing = {
      ...editingMethod,
      stages: [...editingMethod.stages, newStage]
    };
    setEditingMethod(nextEditing);
    // Persist current method draft into list and save to org settings
    const next = decorationMethods.map(m => m.id === nextEditing.id ? nextEditing : m);
    setDecorationMethods(next);
    handlePersistMethods(next).catch(() => {});
  };

  const handleUpdateStage = (stageId: string, updates: Partial<ProductionStage>) => {
    if (!editingMethod) return;
    
    const updated = {
      ...editingMethod,
      stages: editingMethod.stages.map(stage =>
        stage.id === stageId ? { ...stage, ...updates } : stage
      )
    };
    setEditingMethod(updated);
    // Persist draft to list and save to org settings so Production reflects immediately
    const next = decorationMethods.map(m => m.id === updated.id ? updated : m);
    setDecorationMethods(next);
    handlePersistMethods(next).catch(() => {});
  };

  const handleDeleteStage = (stageId: string) => {
    if (!editingMethod) return;
    
    const updated = {
      ...editingMethod,
      stages: editingMethod.stages.filter(stage => stage.id !== stageId)
    };
    setEditingMethod(updated);
    // Persist draft to list and save
    const next = decorationMethods.map(m => m.id === updated.id ? updated : m);
    setDecorationMethods(next);
    handlePersistMethods(next).catch(() => {});
  };

  const stageColors = [
    'bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-green-500',
    'bg-blue-500', 'bg-purple-500', 'bg-pink-500', 'bg-indigo-500'
  ];

  const defaultConstraints: EquipmentConstraints = {
    supportedSizes: ['S', 'M', 'L', 'XL'],
    maxImprintWidth: 12,
    maxImprintHeight: 14,
    supportedGarmentTypes: ['tshirt', 'polo', 'hoodie'],
    supportedPlacements: ['front_center', 'back_center'],
    minQuantityPerRun: 1,
    maxQuantityPerRun: 1000,
  };

  const [equipment, setEquipment] = useState<Equipment[]>([
    {
      id: 'screen_press_1',
      name: 'Manual Screen Press #1',
      type: 'Screen Printing Press',
      stageAssignments: [
        { decorationMethod: 'screenPrinting', stageIds: ['printing', 'curing'] }
      ],
      capacity: 200,
      workingHours: defaultWorkingHours,
      status: 'active',
      constraints: { ...defaultConstraints, maxColors: 6, maxScreens: 8 },
    },
    {
      id: 'embroidery_1',
      name: 'Brother 6-Head Embroidery',
      type: 'Embroidery Machine',
      stageAssignments: [
        { decorationMethod: 'embroidery', stageIds: ['hooping', 'embroidering', 'trimming'] }
      ],
      capacity: 150,
      workingHours: { ...defaultWorkingHours, saturday: { enabled: true, start: '09:00', end: '15:00' } },
      status: 'active',
      constraints: { ...defaultConstraints, maxColors: 15, supportedGarmentTypes: ['tshirt', 'polo', 'hoodie', 'cap'] },
    },
    {
      id: 'dtf_printer_1',
      name: 'DTF Printer Station',
      type: 'DTF Printer',
      stageAssignments: [
        { decorationMethod: 'dtf', stageIds: ['printing', 'powder'] }
      ],
      capacity: 100,
      workingHours: defaultWorkingHours,
      status: 'active',
      constraints: { ...defaultConstraints, unlimitedColors: true },
    },
  ]);

  const [newEquipment, setNewEquipment] = useState<Partial<Equipment>>({
    name: '',
    type: '',
    stageAssignments: [],
    capacity: 100,
    workingHours: defaultWorkingHours,
    status: 'active',
    constraints: defaultConstraints,
  });

  const [editingEquipment, setEditingEquipment] = useState<Equipment | null>(null);
  const [isEquipmentDialogOpen, setIsEquipmentDialogOpen] = useState(false);
  const [isEditingEquipment, setIsEditingEquipment] = useState(false);
  
  const [editingEquipmentHours, setEditingEquipmentHours] = useState<Equipment | null>(null);
  const [isHoursDialogOpen, setIsHoursDialogOpen] = useState(false);

  const [globalWorkingHours, setGlobalWorkingHours] = useState<WorkingHours>(defaultWorkingHours);
  const [savingWH, setSavingWH] = useState(false);
  // Load working hours from org settings when available
  useEffect(() => {
    const s: any = organization?.org_settings || {};
    const fromOrg = s.production?.workingHours as WorkingHours | undefined;
    if (fromOrg && typeof fromOrg === 'object') {
      setGlobalWorkingHours({
        monday: fromOrg.monday || defaultWorkingHours.monday,
        tuesday: fromOrg.tuesday || defaultWorkingHours.tuesday,
        wednesday: fromOrg.wednesday || defaultWorkingHours.wednesday,
        thursday: fromOrg.thursday || defaultWorkingHours.thursday,
        friday: fromOrg.friday || defaultWorkingHours.friday,
        saturday: fromOrg.saturday || defaultWorkingHours.saturday,
        sunday: fromOrg.sunday || defaultWorkingHours.sunday,
      });
    }
  }, [organization]);
  // Load equipment from org settings when available
  useEffect(() => {
    const s: any = organization?.org_settings || {};
    const fromOrg = s.production?.equipment as Equipment[] | undefined;
    if (Array.isArray(fromOrg)) {
      setEquipment(fromOrg);
    }
  }, [organization]);

  const [productionRules, setProductionRules] = useState<ProductionRules>({
    autoGrouping: {
      enabled: true,
      groupByDesign: true,
      groupByColors: true,
      groupByGarmentType: false,
    },
    batchingRules: {
      screenPrinting: { minBatchSize: 12, maxBatchSize: 144, bufferTime: 15 },
      embroidery: { minBatchSize: 6, maxBatchSize: 72, bufferTime: 10 },
      dtf: { minBatchSize: 1, maxBatchSize: 50, bufferTime: 5 },
      dtg: { minBatchSize: 1, maxBatchSize: 25, bufferTime: 5 },
    },
    qualityControl: {
      artApprovalRequired: true,
      sampleApprovalThreshold: 50,
      qualityCheckpoints: {
        art_prep: { enabled: true, checklistItems: ['Colors match specifications', 'Artwork is print-ready'] },
        printing: { enabled: true, checklistItems: ['Registration is correct', 'Colors are accurate'] },
        finishing: { enabled: true, checklistItems: ['Quality check passed', 'Packaging complete'] },
      },
    },
    materialRules: {
      checkStockBeforeScheduling: true,
      reorderPointWarnings: true,
      lowStockThreshold: 20,
    },
    notificationRules: {
      dueDateWarnings: {
        enabled: true,
        warningHours: [24, 48, 72],
      },
      equipmentMaintenance: {
        enabled: true,
        maintenanceIntervalHours: 200,
      },
      capacityOverload: {
        enabled: true,
        thresholdPercentage: 90,
      },
    },
    costOptimization: {
      rushJobSurcharge: {
        enabled: true,
        surchargePercentage: 25,
        rushThresholdHours: 48,
      },
      smallQuantityPenalty: {
        enabled: false,
        minimumQuantity: 12,
        penaltyPercentage: 15,
      },
      equipmentUtilizationTarget: 85,
    },
    outsourcingRules: {
      autoOutsourcing: {
        enabled: false,
        capacityThreshold: 95,
        leadTimeBuffer: 2,
      },
      preferredVendors: {
        screenPrinting: ['Local Screen Shop', 'Quick Print Co.'],
        embroidery: ['Stitch Masters', 'Thread Works'],
      },
    },
    autoScheduling: true,
    setupTimeBuffer: 15,
    rushJobPriority: true,
  });

  // QC editor state
  const allStageOptions = useMemo(() => {
    return (decorationMethods || []).flatMap((m) =>
      (m.stages || []).map((st) => ({
        methodId: m.id,
        methodLabel: m.label,
        stageId: st.id,
        stageName: st.name,
      }))
    );
  }, [decorationMethods]);
  const [qcNew, setQcNew] = useState<{ methodId: string; stageId: string; itemInput: string; items: string[] }>({ methodId: '', stageId: '', itemInput: '', items: [] });
  const qcEntries = useMemo(() => {
    const qp = productionRules.qualityControl.qualityCheckpoints || {};
    return Object.entries(qp).map(([key, v]) => ({ key, ...v }));
  }, [productionRules]);

  const makeQcKey = (methodId: string, stageId: string) => {
    // Prefer compound key to avoid cross-method collisions; also support legacy stage-only keys when reading elsewhere
    return methodId && stageId ? `${methodId}.${stageId}` : (stageId || '');
  };

  const handleAddQcItemToNew = () => {
    const txt = (qcNew.itemInput || '').trim();
    if (!txt) return;
    setQcNew(prev => ({ ...prev, items: [...prev.items, txt], itemInput: '' }));
  };

  const handleAddQcCheckpoint = () => {
    if (!qcNew.methodId || !qcNew.stageId) return;
    const key = makeQcKey(qcNew.methodId, qcNew.stageId);
    setProductionRules(prev => {
      const current = prev.qualityControl.qualityCheckpoints || {};
      const next = {
        ...current,
        [key]: { enabled: true, checklistItems: [...qcNew.items] }
      } as any;
      return {
        ...prev,
        qualityControl: { ...prev.qualityControl, qualityCheckpoints: next }
      };
    });
    setQcNew({ methodId: '', stageId: '', itemInput: '', items: [] });
  };

  const handleRemoveQcCheckpoint = (key: string) => {
    setProductionRules(prev => {
      const current = { ...(prev.qualityControl.qualityCheckpoints || {}) } as any;
      delete current[key];
      return { ...prev, qualityControl: { ...prev.qualityControl, qualityCheckpoints: current } };
    });
  };

  const handleToggleQcCheckpoint = (key: string, enabled: boolean) => {
    setProductionRules(prev => {
      const current = { ...(prev.qualityControl.qualityCheckpoints || {}) } as any;
      const row = current[key] || { enabled: false, checklistItems: [] };
      current[key] = { ...row, enabled };
      return { ...prev, qualityControl: { ...prev.qualityControl, qualityCheckpoints: current } };
    });
  };

  const handleAddQcItemToExisting = (key: string, item: string) => {
    const txt = (item || '').trim();
    if (!txt) return;
    setProductionRules(prev => {
      const current = { ...(prev.qualityControl.qualityCheckpoints || {}) } as any;
      const row = current[key] || { enabled: true, checklistItems: [] };
      current[key] = { ...row, checklistItems: [...(row.checklistItems || []), txt] };
      return { ...prev, qualityControl: { ...prev.qualityControl, qualityCheckpoints: current } };
    });
  };

  const handleRemoveQcItem = (key: string, index: number) => {
    setProductionRules(prev => {
      const current = { ...(prev.qualityControl.qualityCheckpoints || {}) } as any;
      const row = current[key];
      if (!row) return prev;
      const nextItems = (row.checklistItems || []).filter((_: string, i: number) => i !== index);
      current[key] = { ...row, checklistItems: nextItems };
      return { ...prev, qualityControl: { ...prev.qualityControl, qualityCheckpoints: current } };
    });
  };

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    jobGrouping: true,
    qualityControl: false,
    materialRules: false,
    notifications: false,
    costOptimization: false,
    outsourcing: false,
  });

  // Load production rules from org settings if present
  useEffect(() => {
    const s: any = organization?.org_settings || {};
    const rules = s.production?.productionRules as ProductionRules | undefined;
    if (rules && typeof rules === 'object') {
      setProductionRules({
        ...productionRules,
        ...rules,
        autoGrouping: { ...productionRules.autoGrouping, ...(rules as any).autoGrouping },
        batchingRules: { ...productionRules.batchingRules, ...(rules as any).batchingRules },
        qualityControl: { ...productionRules.qualityControl, ...(rules as any).qualityControl },
        materialRules: { ...productionRules.materialRules, ...(rules as any).materialRules },
        notificationRules: { ...productionRules.notificationRules, ...(rules as any).notificationRules },
        costOptimization: { ...productionRules.costOptimization, ...(rules as any).costOptimization },
        outsourcingRules: { ...productionRules.outsourcingRules, ...(rules as any).outsourcingRules },
      });
    }
  }, [organization]);

  const [savingRules, setSavingRules] = useState(false);
  const handlePersistProductionRules = async () => {
    try {
      setSavingRules(true);
      const existingProduction = (organization?.org_settings as any)?.production || {};
      await updateOrganizationSettings({
        production: {
          ...existingProduction,
          productionRules,
        },
      });
    } finally {
      setSavingRules(false);
    }
  };

  // Equipment handlers
  const handleAddEquipment = () => {
    if (!newEquipment.name || !newEquipment.type) return;
    
    const newItem: Equipment = {
      id: `equipment_${Date.now()}`,
      name: newEquipment.name,
      type: newEquipment.type,
      stageAssignments: newEquipment.stageAssignments || [],
      capacity: newEquipment.capacity || 100,
      workingHours: newEquipment.workingHours || defaultWorkingHours,
      status: newEquipment.status || 'active',
      constraints: newEquipment.constraints || defaultConstraints,
    };
    
    const next = [...equipment, newItem];
    setEquipment(next);
    // Persist to org settings including decorationMethods and equipment
    const existingProduction = (organization?.org_settings as any)?.production || {};
    updateOrganizationSettings({ production: { ...existingProduction, decorationMethods, equipment: next } }).catch(() => {});
    setNewEquipment({
      name: '',
      type: '',
      stageAssignments: [],
      capacity: 100,
      workingHours: defaultWorkingHours,
      status: 'active',
      constraints: defaultConstraints,
    });
    setIsEquipmentDialogOpen(false);
  };

  const handleEditEquipment = (equipment: Equipment) => {
    setEditingEquipment({ ...equipment });
    setIsEditingEquipment(true);
    setIsEquipmentDialogOpen(true);
  };

  const handleSaveEquipment = () => {
    if (!editingEquipment) return;
    
    const next = equipment.map(eq => eq.id === editingEquipment.id ? editingEquipment : eq);
    setEquipment(next);
    const existingProduction = (organization?.org_settings as any)?.production || {};
    updateOrganizationSettings({ production: { ...existingProduction, decorationMethods, equipment: next } }).catch(() => {});
    setIsEquipmentDialogOpen(false);
    setEditingEquipment(null);
    setIsEditingEquipment(false);
  };

  const handleDeleteEquipment = (equipmentId: string) => {
    const next = equipment.filter(eq => eq.id !== equipmentId);
    setEquipment(next);
    const existingProduction = (organization?.org_settings as any)?.production || {};
    updateOrganizationSettings({ production: { ...existingProduction, decorationMethods, equipment: next } }).catch(() => {});
  };

  const handleAddStageAssignment = (equipmentToEdit: Equipment | Partial<Equipment>) => {
    const newAssignment: StageAssignment = {
      decorationMethod: '',
      stageIds: []
    };
    
    if (isEditingEquipment && editingEquipment) {
      setEditingEquipment({
        ...editingEquipment,
        stageAssignments: [...editingEquipment.stageAssignments, newAssignment]
      });
    } else {
      setNewEquipment({
        ...newEquipment,
        stageAssignments: [...(newEquipment.stageAssignments || []), newAssignment]
      });
    }
  };

  const handleUpdateStageAssignment = (index: number, updates: Partial<StageAssignment>) => {
    if (isEditingEquipment && editingEquipment) {
      const updatedAssignments = editingEquipment.stageAssignments.map((assignment, i) =>
        i === index ? { ...assignment, ...updates } : assignment
      );
      setEditingEquipment({
        ...editingEquipment,
        stageAssignments: updatedAssignments
      });
    } else {
      const updatedAssignments = (newEquipment.stageAssignments || []).map((assignment, i) =>
        i === index ? { ...assignment, ...updates } : assignment
      );
      setNewEquipment({
        ...newEquipment,
        stageAssignments: updatedAssignments
      });
    }
  };

  const handleRemoveStageAssignment = (index: number) => {
    if (isEditingEquipment && editingEquipment) {
      setEditingEquipment({
        ...editingEquipment,
        stageAssignments: editingEquipment.stageAssignments.filter((_, i) => i !== index)
      });
    } else {
      setNewEquipment({
        ...newEquipment,
        stageAssignments: (newEquipment.stageAssignments || []).filter((_, i) => i !== index)
      });
    }
  };

  const getStagesForMethod = (methodId: string) => {
    const method = decorationMethods.find(m => m.id === methodId);
    return method?.stages || [];
  };

  // Working hours handlers
  const handleEditEquipmentHours = (equipment: Equipment) => {
    setEditingEquipmentHours({ ...equipment });
    setIsHoursDialogOpen(true);
  };

  const handleSaveEquipmentHours = () => {
    if (!editingEquipmentHours) return;
    
    setEquipment(prev => 
      prev.map(eq => 
        eq.id === editingEquipmentHours.id 
          ? { ...eq, workingHours: editingEquipmentHours.workingHours }
          : eq
      )
    );
    // Persist equipment hours to org settings
    try {
      const existingProduction = (organization?.org_settings as any)?.production || {};
      updateOrganizationSettings({ production: { ...existingProduction, decorationMethods, equipment } }).catch(() => {});
    } catch {}
    setIsHoursDialogOpen(false);
    setEditingEquipmentHours(null);
  };

  const handleUpdateEquipmentWorkingHours = (day: keyof WorkingHours, updates: Partial<WorkingHours[keyof WorkingHours]>) => {
    if (!editingEquipmentHours) return;
    
    setEditingEquipmentHours({
      ...editingEquipmentHours,
      workingHours: {
        ...editingEquipmentHours.workingHours,
        [day]: {
          ...editingEquipmentHours.workingHours[day],
          ...updates
        }
      }
    });
    
  };

  // Update global working hours
  const handleUpdateGlobalWorkingHours = (day: keyof WorkingHours, updates: Partial<WorkingHours[keyof WorkingHours]>) => {
    setGlobalWorkingHours(prev => ({ ...prev, [day]: { ...prev[day], ...updates } } as WorkingHours));
  };

  // Persist global working hours
  const handlePersistWorkingHours = async () => {
    const existingProduction = (organization?.org_settings as any)?.production || {};
    const payload = { production: { ...existingProduction, workingHours: globalWorkingHours, decorationMethods, equipment } } as any;
    await updateOrganizationSettings(payload);
  };

  const handlePersistWorkingHoursClick = async () => {
    try {
      setSavingWH(true);
      await handlePersistWorkingHours();
    } finally {
      setSavingWH(false);
    }
  };

  const formatWorkingHoursDisplay = (workingHours: WorkingHours): string => {
    const enabledDays = Object.entries(workingHours)
      .filter(([_, hours]) => hours.enabled)
      .map(([day, hours]) => ({
        day: day.charAt(0).toUpperCase() + day.slice(1, 3),
        start: hours.start,
        end: hours.end
      }));
    
    if (enabledDays.length === 0) return 'No working hours set';
    
    const groupedHours = enabledDays.reduce((acc, { day, start, end }) => {
      const timeRange = `${start}-${end}`;
      if (!acc[timeRange]) acc[timeRange] = [];
      acc[timeRange].push(day);
      return acc;
    }, {} as Record<string, string[]>);
    
    return Object.entries(groupedHours)
      .map(([timeRange, days]) => `${days.join(', ')}: ${timeRange}`)
      .join(' | ');
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const updateProductionRules = (path: string, value: any) => {
    setProductionRules(prev => {
      const pathArray = path.split('.');
      const updatedRules = { ...prev };
      let current = updatedRules as any;
      
      for (let i = 0; i < pathArray.length - 1; i++) {
        current[pathArray[i]] = { ...current[pathArray[i]] };
        current = current[pathArray[i]];
      }
      
      current[pathArray[pathArray.length - 1]] = value;
      return updatedRules;
    });
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="methods" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="methods">Decoration Methods</TabsTrigger>
          <TabsTrigger value="equipment">Equipment & Stations</TabsTrigger>
          <TabsTrigger value="hours">Working Hours</TabsTrigger>
          <TabsTrigger value="rules">Production Rules</TabsTrigger>
        </TabsList>

        <TabsContent value="methods" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Palette className="h-5 w-5" />
                    Decoration Methods
                  </CardTitle>
                  <CardDescription>
                    Configure the decoration methods available in your shop
                  </CardDescription>
                </div>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Method
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Decoration Method</DialogTitle>
                      <DialogDescription>
                        Create a new decoration method with custom stages
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="method-name">Method Name</Label>
                        <Input id="method-name" placeholder="e.g., Heat Transfer Vinyl" value={newMethodName} onChange={(e) => setNewMethodName(e.target.value)} />
                      </div>
                      <div>
                        <Label htmlFor="method-stages">Production Stages</Label>
                        <div className="text-sm text-muted-foreground mt-1">
                          Initial stages will be created based on method type; you can edit after adding.
                        </div>
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button variant="outline">Cancel</Button>
                        <Button onClick={handleAddMethod}>Add Method</Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
                <Button variant="secondary" onClick={handlePersistMethods} disabled={savingMethods}>
                  {savingMethods ? 'Saving…' : 'Save Methods'}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {decorationMethods.map((method) => (
                  <div key={method.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <Switch 
                          checked={method.enabled} 
                          onCheckedChange={() => handleToggleMethod(method.id)}
                        />
                        <div>
                          <h4 className="font-medium">{method.label}</h4>
                          <p className="text-sm text-muted-foreground">
                            {method.stages.length} production stages
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleEditMethod(method)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleDeleteMethod(method.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {method.stages.map((stage) => (
                        <Badge key={stage.id} variant="secondary" className="gap-2">
                          <div className={`w-3 h-3 rounded-full ${stage.color}`} />
                          {stage.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Edit Method Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Decoration Method</DialogTitle>
              <DialogDescription>
                Customize the stages and settings for {editingMethod?.label}
              </DialogDescription>
            </DialogHeader>
            
            {editingMethod && (
              <div className="space-y-6">
                {/* Method Info */}
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="edit-method-name">Method Name</Label>
                    <Input
                      id="edit-method-name"
                      value={editingMethod.label}
                      onChange={(e) => setEditingMethod({
                        ...editingMethod,
                        label: e.target.value
                      })}
                    />
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={editingMethod.enabled}
                      onCheckedChange={(checked) => setEditingMethod({
                        ...editingMethod,
                        enabled: checked
                      })}
                    />
                    <Label>Enable this decoration method</Label>
                  </div>
                </div>

                <Separator />

                {/* Production Stages */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Production Stages</h4>
                    <Button onClick={handleAddStage} size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Stage
                    </Button>
                  </div>
                  
                  <div className="space-y-3">
                    {editingMethod.stages.map((stage, index) => (
                      <div key={stage.id} className="border rounded-lg p-4">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2">
                            <GripVertical className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">#{index + 1}</span>
                          </div>
                          
                          <div className="flex-1">
                            <Input
                              value={stage.name}
                              onChange={(e) => handleUpdateStage(stage.id, { name: e.target.value })}
                              placeholder="Stage name"
                            />
                          </div>
                          
                          <Select
                            value={stage.color}
                            onValueChange={(color) => handleUpdateStage(stage.id, { color })}
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue>
                                <div className="flex items-center gap-2">
                                  <div className={`w-3 h-3 rounded-full ${stage.color}`} />
                                  Color
                                </div>
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {stageColors.map((color) => (
                                <SelectItem key={color} value={color}>
                                  <div className="flex items-center gap-2">
                                    <div className={`w-3 h-3 rounded-full ${color}`} />
                                    {color.replace('bg-', '').replace('-500', '')}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteStage(stage.id)}
                            disabled={editingMethod.stages.length <= 1}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Method Info from IMPRINT_METHODS */}
                {getMethodConfig(editingMethod.name) && (
                  <>
                    <Separator />
                    <div className="space-y-3">
                      <h4 className="font-medium">Method Requirements</h4>
                      <div className="text-sm text-muted-foreground">
                        {getMethodConfig(editingMethod.name)?.instructions}
                      </div>
                      {getMethodConfig(editingMethod.name)?.requirements && (
                        <div className="space-y-2">
                          <p className="text-sm font-medium">Requirements:</p>
                          <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                            {getMethodConfig(editingMethod.name)?.requirements?.map((req, index) => (
                              <li key={index}>{req}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* Action Buttons */}
                <div className="flex justify-end gap-2 pt-4">
                  <Button 
                    variant="outline" 
                    onClick={() => setIsEditDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleSaveMethod}>
                    Save Changes
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <TabsContent value="equipment" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Factory className="h-5 w-5" />
                    Equipment & Stations
                  </CardTitle>
                  <CardDescription>
                    Manage your production equipment and their capabilities
                  </CardDescription>
                </div>
                <Dialog open={isEquipmentDialogOpen} onOpenChange={setIsEquipmentDialogOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={() => {
                      setIsEditingEquipment(false);
                      setNewEquipment({
                        name: '',
                        type: '',
                        stageAssignments: [],
                        capacity: 100,
                        workingHours: defaultWorkingHours,
                        status: 'active',
                      });
                    }}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Equipment
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>
                        {isEditingEquipment ? 'Edit Equipment' : 'Add Equipment'}
                      </DialogTitle>
                      <DialogDescription>
                        {isEditingEquipment 
                          ? 'Update equipment configuration and stage assignments'
                          : 'Add new production equipment and assign it to production stages'
                        }
                      </DialogDescription>
                    </DialogHeader>
                    
                    <div className="space-y-6">
                      {/* Basic Equipment Info */}
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="equipment-name">Equipment Name</Label>
                          <Input 
                            id="equipment-name" 
                            placeholder="e.g., Screen Press #2"
                            value={isEditingEquipment ? editingEquipment?.name || '' : newEquipment.name || ''}
                            onChange={(e) => {
                              if (isEditingEquipment && editingEquipment) {
                                setEditingEquipment({ ...editingEquipment, name: e.target.value });
                              } else {
                                setNewEquipment({ ...newEquipment, name: e.target.value });
                              }
                            }}
                          />
                        </div>
                        
                        <div>
                          <Label htmlFor="equipment-type">Equipment Type</Label>
                          <Input
                            id="equipment-type"
                            placeholder="e.g., Screen Printing Press"
                            value={isEditingEquipment ? editingEquipment?.type || '' : newEquipment.type || ''}
                            onChange={(e) => {
                              if (isEditingEquipment && editingEquipment) {
                                setEditingEquipment({ ...editingEquipment, type: e.target.value });
                              } else {
                                setNewEquipment({ ...newEquipment, type: e.target.value });
                              }
                            }}
                          />
                        </div>
                        
                        <div>
                          <Label htmlFor="capacity">Daily Capacity</Label>
                          <Input 
                            id="capacity" 
                            type="number" 
                            placeholder="Items per day"
                            value={isEditingEquipment ? editingEquipment?.capacity || 100 : newEquipment.capacity || 100}
                            onChange={(e) => {
                              const capacity = parseInt(e.target.value) || 100;
                              if (isEditingEquipment && editingEquipment) {
                                setEditingEquipment({ ...editingEquipment, capacity });
                              } else {
                                setNewEquipment({ ...newEquipment, capacity });
                              }
                            }}
                          />
                        </div>
                      </div>

                      <Separator />

                      {/* Stage Assignments */}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium">Stage Assignments</h4>
                          <Button 
                            onClick={() => handleAddStageAssignment(isEditingEquipment ? editingEquipment! : newEquipment)} 
                            size="sm"
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Add Assignment
                          </Button>
                        </div>
                        
                        <div className="space-y-3">
                          {((isEditingEquipment ? editingEquipment?.stageAssignments : newEquipment.stageAssignments) || []).map((assignment, index) => (
                            <div key={index} className="border rounded-lg p-4">
                              <div className="space-y-3">
                                <div className="flex items-center gap-3">
                                  <div className="flex-1">
                                    <Label>Decoration Method</Label>
                                    <Select
                                      value={assignment.decorationMethod}
                                      onValueChange={(value) => handleUpdateStageAssignment(index, { decorationMethod: value, stageIds: [] })}
                                    >
                                      <SelectTrigger>
                                        <SelectValue placeholder="Select decoration method" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {decorationMethods.filter(m => m.enabled).map((method) => (
                                          <SelectItem key={method.id} value={method.id}>
                                            {method.label}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleRemoveStageAssignment(index)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                                
                                {assignment.decorationMethod && (
                                  <div>
                                    <Label>Production Stages</Label>
                                    <div className="grid grid-cols-2 gap-2 mt-2">
                                      {getStagesForMethod(assignment.decorationMethod).map((stage) => (
                                        <div key={stage.id} className="flex items-center space-x-2">
                                          <input
                                            type="checkbox"
                                            id={`stage-${index}-${stage.id}`}
                                            checked={assignment.stageIds.includes(stage.id)}
                                            onChange={(e) => {
                                              const updatedStageIds = e.target.checked
                                                ? [...assignment.stageIds, stage.id]
                                                : assignment.stageIds.filter(id => id !== stage.id);
                                              handleUpdateStageAssignment(index, { stageIds: updatedStageIds });
                                            }}
                                            className="rounded border-gray-300"
                                          />
                                          <label 
                                            htmlFor={`stage-${index}-${stage.id}`}
                                            className="text-sm flex items-center gap-2"
                                          >
                                            <div className={`w-3 h-3 rounded-full ${stage.color}`} />
                                            {stage.name}
                                          </label>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                          
                          {((isEditingEquipment ? editingEquipment?.stageAssignments : newEquipment.stageAssignments) || []).length === 0 && (
                            <div className="text-center text-muted-foreground py-8">
                              <Factory className="h-8 w-8 mx-auto mb-2 opacity-50" />
                              <p>No stage assignments yet</p>
                              <p className="text-sm">Click "Add Assignment" to configure which stages this equipment handles</p>
                            </div>
                          )}
                        </div>
                      </div>

                      <Separator />

                      {/* Equipment Constraints */}
                      <div className="space-y-4">
                        <h4 className="font-medium">Equipment Constraints</h4>
                        <EquipmentConstraintsForm
                          constraints={isEditingEquipment ? editingEquipment?.constraints || defaultConstraints : newEquipment.constraints || defaultConstraints}
                          onChange={(constraints) => {
                            if (isEditingEquipment && editingEquipment) {
                              setEditingEquipment({ ...editingEquipment, constraints });
                            } else {
                              setNewEquipment({ ...newEquipment, constraints });
                            }
                          }}
                          equipmentType={isEditingEquipment ? editingEquipment?.type || '' : newEquipment.type || ''}
                        />
                      </div>

                      {/* Action Buttons */}
                      <div className="flex justify-end gap-2 pt-4">
                        <Button 
                          variant="outline" 
                          onClick={() => {
                            setIsEquipmentDialogOpen(false);
                            setEditingEquipment(null);
                            setIsEditingEquipment(false);
                          }}
                        >
                          Cancel
                        </Button>
                        <Button onClick={isEditingEquipment ? handleSaveEquipment : handleAddEquipment}>
                          {isEditingEquipment ? 'Save Changes' : 'Add Equipment'}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {equipment.map((item) => (
                  <div key={item.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h4 className="font-medium">{item.name}</h4>
                        <p className="text-sm text-muted-foreground">{item.type}</p>
                        <div className="flex items-center gap-4 mt-2 text-sm">
                          <span>Capacity: {item.capacity}/day</span>
                          <Badge variant={item.status === 'active' ? 'default' : 'secondary'}>
                            {item.status}
                          </Badge>
                        </div>
                        
                        {/* Constraints Summary */}
                        <div className="flex flex-wrap gap-1 mt-2">
                          {item.constraints.maxColors && (
                            <Badge variant="outline" className="text-xs">
                              Max {item.constraints.maxColors} Colors
                            </Badge>
                          )}
                          {item.constraints.maxScreens && (
                            <Badge variant="outline" className="text-xs">
                              {item.constraints.maxScreens} Screens
                            </Badge>
                          )}
                          <Badge variant="outline" className="text-xs">
                            {item.constraints.supportedGarmentTypes.length} Garment Types
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {item.constraints.supportedSizes.length} Sizes
                          </Badge>
                          {item.constraints.supportedPlacements.length > 0 && (
                            <Badge variant="outline" className="text-xs">
                              {item.constraints.supportedPlacements.length} Placements
                            </Badge>
                          )}
                        </div>
                        
                        {/* Stage Assignments Display */}
                        <div className="mt-3">
                          <p className="text-sm font-medium mb-2">Assigned Stages:</p>
                          {item.stageAssignments.length > 0 ? (
                            <div className="space-y-2">
                              {item.stageAssignments.map((assignment, index) => {
                                const method = decorationMethods.find(m => m.id === assignment.decorationMethod);
                                return (
                                  <div key={index} className="flex items-center gap-2">
                                    <span className="text-sm font-medium">{method?.label}:</span>
                                    <div className="flex flex-wrap gap-1">
                                      {assignment.stageIds.map(stageId => {
                                        const stage = method?.stages.find(s => s.id === stageId);
                                        return stage ? (
                                          <Badge key={stageId} variant="outline" className="gap-1 text-xs">
                                            <div className={`w-2 h-2 rounded-full ${stage.color}`} />
                                            {stage.name}
                                          </Badge>
                                        ) : null;
                                      })}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground">No stages assigned</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleEditEquipment(item)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleDeleteEquipment(item.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="hours" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Global Working Hours
              </CardTitle>
              <CardDescription>
                Set default working hours for your shop
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(globalWorkingHours).map(([day, hours]) => (
                  <div key={day} className="flex items-center gap-4">
                    <div className="w-24">
                      <Label className="capitalize">{day}</Label>
                    </div>
                    <Switch checked={hours.enabled} onCheckedChange={(enabled) => handleUpdateGlobalWorkingHours(day as keyof WorkingHours, { enabled })} />
                    <div className="flex items-center gap-2">
                      <Input
                        type="time"
                        value={hours.start}
                        disabled={!hours.enabled}
                        className="w-32"
                        onChange={(e) => handleUpdateGlobalWorkingHours(day as keyof WorkingHours, { start: e.target.value })}
                      />
                      <span className="text-muted-foreground">to</span>
                      <Input
                        type="time"
                        value={hours.end}
                        disabled={!hours.enabled}
                        className="w-32"
                        onChange={(e) => handleUpdateGlobalWorkingHours(day as keyof WorkingHours, { end: e.target.value })}
                      />
                    </div>
                  </div>
                ))}
                <div className="flex justify-end">
                  <Button type="button" variant="secondary" disabled={savingWH} onClick={handlePersistWorkingHoursClick}>{savingWH ? 'Saving…' : 'Save Working Hours'}</Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Equipment-Specific Hours</CardTitle>
              <CardDescription>
                Override working hours for specific equipment
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {equipment.map((item) => (
                  <div key={item.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-medium">{item.name}</h4>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleEditEquipmentHours(item)}
                      >
                        <Settings className="h-4 w-4 mr-2" />
                        Configure Hours
                      </Button>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {formatWorkingHoursDisplay(item.workingHours)}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rules" className="space-y-6">
          {/* Job Grouping & Batching */}
          <Card>
            <Collapsible 
              open={expandedSections.jobGrouping} 
              onOpenChange={() => toggleSection('jobGrouping')}
            >
              <CollapsibleTrigger className="w-full">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Package className="h-5 w-5" />
                      <CardTitle>Job Grouping & Batching</CardTitle>
                    </div>
                    {expandedSections.jobGrouping ? 
                      <ChevronDown className="h-4 w-4" /> : 
                      <ChevronRight className="h-4 w-4" />
                    }
                  </div>
                  <CardDescription className="text-left">
                    Configure how jobs are grouped and batched for efficiency
                  </CardDescription>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-6">
                  <div>
                    <Label>Auto-Grouping</Label>
                    <div className="space-y-3 mt-2">
                      <div className="flex items-center gap-2">
                        <Switch 
                          checked={productionRules.autoGrouping.enabled}
                          onCheckedChange={(checked) => updateProductionRules('autoGrouping.enabled', checked)}
                        />
                        <span className="text-sm">Enable automatic job grouping</span>
                      </div>
                      <div className="ml-6 space-y-2">
                        <div className="flex items-center gap-2">
                          <Switch 
                            checked={productionRules.autoGrouping.groupByDesign}
                            onCheckedChange={(checked) => updateProductionRules('autoGrouping.groupByDesign', checked)}
                            disabled={!productionRules.autoGrouping.enabled}
                          />
                          <span className="text-sm text-muted-foreground">Group by same design/artwork</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch 
                            checked={productionRules.autoGrouping.groupByColors}
                            onCheckedChange={(checked) => updateProductionRules('autoGrouping.groupByColors', checked)}
                            disabled={!productionRules.autoGrouping.enabled}
                          />
                          <span className="text-sm text-muted-foreground">Group by same colors</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch 
                            checked={productionRules.autoGrouping.groupByGarmentType}
                            onCheckedChange={(checked) => updateProductionRules('autoGrouping.groupByGarmentType', checked)}
                            disabled={!productionRules.autoGrouping.enabled}
                          />
                          <span className="text-sm text-muted-foreground">Group by garment type</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <Label>Batch Size Settings</Label>
                    <div className="space-y-4 mt-2">
                      {Object.entries(productionRules.batchingRules).map(([method, rules]) => (
                        <div key={method} className="border rounded-lg p-3">
                          <h4 className="font-medium mb-3 capitalize">{method.replace(/([A-Z])/g, ' $1').toLowerCase()}</h4>
                          <div className="grid grid-cols-3 gap-3">
                            <div>
                              <Label className="text-xs">Min Batch</Label>
                              <Input
                                type="number"
                                value={rules.minBatchSize}
                                onChange={(e) => updateProductionRules(`batchingRules.${method}.minBatchSize`, parseInt(e.target.value))}
                                className="h-8"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Max Batch</Label>
                              <Input
                                type="number"
                                value={rules.maxBatchSize}
                                onChange={(e) => updateProductionRules(`batchingRules.${method}.maxBatchSize`, parseInt(e.target.value))}
                                className="h-8"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Buffer (min)</Label>
                              <Input
                                type="number"
                                value={rules.bufferTime}
                                onChange={(e) => updateProductionRules(`batchingRules.${method}.bufferTime`, parseInt(e.target.value))}
                                className="h-8"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>

          {/* Quality Control Points */}
          <Card>
            <Collapsible 
              open={expandedSections.qualityControl} 
              onOpenChange={() => toggleSection('qualityControl')}
            >
              <CollapsibleTrigger className="w-full">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-5 w-5" />
                      <CardTitle>Quality Control Points</CardTitle>
                    </div>
                    {expandedSections.qualityControl ? 
                      <ChevronDown className="h-4 w-4" /> : 
                      <ChevronRight className="h-4 w-4" />
                    }
                  </div>
                  <CardDescription className="text-left">
                    Define quality checkpoints and approval requirements
                  </CardDescription>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-6">
                  <div>
                    <div className="flex items-center gap-2">
                      <Switch 
                        checked={productionRules.qualityControl.artApprovalRequired}
                        onCheckedChange={(checked) => updateProductionRules('qualityControl.artApprovalRequired', checked)}
                      />
                      <Label>Art approval required before production</Label>
                    </div>
                  </div>

                  <div>
                    <Label>Sample approval threshold</Label>
                    <div className="flex items-center gap-2 mt-2">
                      <Input
                        type="number"
                        value={productionRules.qualityControl.sampleApprovalThreshold}
                        onChange={(e) => updateProductionRules('qualityControl.sampleApprovalThreshold', parseInt(e.target.value))}
                        className="w-20"
                      />
                      <span className="text-sm text-muted-foreground">pieces - require sample approval for orders above this quantity</span>
                    </div>
                  </div>

                  <div>
                    <Label>Quality Checkpoints</Label>
                    {/* Add new checkpoint */}
                    <div className="border rounded-lg p-3 mt-2 space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <Label className="text-xs">Decoration Method</Label>
                          <Select
                            value={qcNew.methodId}
                            onValueChange={(v) => setQcNew(prev => ({ ...prev, methodId: v, stageId: '' }))}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select method" />
                            </SelectTrigger>
                            <SelectContent>
                              {decorationMethods.map((m) => (
                                <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs">Stage</Label>
                          <Select
                            value={qcNew.stageId}
                            onValueChange={(v) => setQcNew(prev => ({ ...prev, stageId: v }))}
                            disabled={!qcNew.methodId}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={qcNew.methodId ? 'Select stage' : 'Select method first'} />
                            </SelectTrigger>
                            <SelectContent>
                              {(decorationMethods.find(m => m.id === qcNew.methodId)?.stages || []).map((st) => (
                                <SelectItem key={st.id} value={st.id}>{st.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex items-end">
                          <Button onClick={handleAddQcCheckpoint} disabled={!qcNew.methodId || !qcNew.stageId || qcNew.items.length === 0}>Add Checkpoint</Button>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="md:col-span-2">
                          <Label className="text-xs">Checklist item</Label>
                          <div className="flex gap-2 mt-1">
                            <Input value={qcNew.itemInput} onChange={(e) => setQcNew(prev => ({ ...prev, itemInput: e.target.value }))} placeholder="e.g., Verify registration" />
                            <Button variant="outline" type="button" onClick={handleAddQcItemToNew}>Add</Button>
                          </div>
                          {qcNew.items.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-2">
                              {qcNew.items.map((it, idx) => (
                                <Badge key={idx} variant="secondary" className="gap-1">
                                  {it}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Existing checkpoints */}
                    <div className="space-y-3 mt-4">
                      {qcEntries.length === 0 && (
                        <div className="text-sm text-muted-foreground">No checkpoints defined yet</div>
                      )}
                      {qcEntries.map((row) => (
                        <div key={row.key} className="border rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Label className="capitalize">
                                {row.key.includes('.')
                                  ? (() => { const [m, s] = row.key.split('.'); const mLbl = decorationMethods.find(mm => mm.id === m)?.label || m; const sLbl = decorationMethods.find(mm => mm.id === m)?.stages.find(ss => ss.id === s)?.name || s; return `${mLbl} — ${sLbl}`; })()
                                  : row.key.replace('_', ' ')
                                }
                              </Label>
                              <Badge variant={row.enabled ? 'default' : 'secondary'}>{row.enabled ? 'Enabled' : 'Disabled'}</Badge>
                          </div>
                            <div className="flex items-center gap-2">
                              <Button variant="outline" size="sm" onClick={() => handleToggleQcCheckpoint(row.key, !row.enabled)}>{row.enabled ? 'Disable' : 'Enable'}</Button>
                              <Button variant="outline" size="sm" onClick={() => handleRemoveQcCheckpoint(row.key)}>Remove</Button>
                          </div>
                        </div>
                          <div className="text-xs text-muted-foreground mb-2">
                            {(row.checklistItems || []).length === 0 ? 'No checklist items' : (row.checklistItems || []).join(' • ')}
                          </div>
                          <div className="flex gap-2">
                            <Input placeholder="Add item" onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                const target = e.target as HTMLInputElement;
                                const val = (target.value || '').trim();
                                if (val) { handleAddQcItemToExisting(row.key, val); target.value = ''; }
                              }
                            }} />
                            <Button variant="outline" type="button" onClick={(e) => {
                              const wrap = (e.currentTarget.previousSibling as HTMLInputElement);
                              const val = (wrap?.value || '').trim();
                              if (val) { handleAddQcItemToExisting(row.key, val); (wrap as any).value = ''; }
                            }}>Add</Button>
                          </div>
                          {(row.checklistItems || []).length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-2">
                              {(row.checklistItems || []).map((it: string, idx: number) => (
                                <Badge key={idx} variant="secondary" className="gap-1">
                                  {it}
                                  <button className="ml-1 text-xs" onClick={() => handleRemoveQcItem(row.key, idx)}>×</button>
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>

          {/* Material & Inventory Rules */}
          <Card>
            <Collapsible 
              open={expandedSections.materialRules} 
              onOpenChange={() => toggleSection('materialRules')}
            >
              <CollapsibleTrigger className="w-full">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Package className="h-5 w-5" />
                      <CardTitle>Material & Inventory Rules</CardTitle>
                    </div>
                    {expandedSections.materialRules ? 
                      <ChevronDown className="h-4 w-4" /> : 
                      <ChevronRight className="h-4 w-4" />
                    }
                  </div>
                  <CardDescription className="text-left">
                    Configure stock checking and inventory management
                  </CardDescription>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-6">
                  <div className="flex items-center gap-2">
                    <Switch 
                      checked={productionRules.materialRules.checkStockBeforeScheduling}
                      onCheckedChange={(checked) => updateProductionRules('materialRules.checkStockBeforeScheduling', checked)}
                    />
                    <Label>Check material availability before scheduling</Label>
                  </div>

                  <div className="flex items-center gap-2">
                    <Switch 
                      checked={productionRules.materialRules.reorderPointWarnings}
                      onCheckedChange={(checked) => updateProductionRules('materialRules.reorderPointWarnings', checked)}
                    />
                    <Label>Show reorder point warnings</Label>
                  </div>

                  <div>
                    <Label>Low stock threshold</Label>
                    <div className="flex items-center gap-2 mt-2">
                      <Input
                        type="number"
                        value={productionRules.materialRules.lowStockThreshold}
                        onChange={(e) => updateProductionRules('materialRules.lowStockThreshold', parseInt(e.target.value))}
                        className="w-20"
                      />
                      <span className="text-sm text-muted-foreground">units remaining to trigger low stock warning</span>
                    </div>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>

          {/* Notification Rules */}
          <Card>
            <Collapsible 
              open={expandedSections.notifications} 
              onOpenChange={() => toggleSection('notifications')}
            >
              <CollapsibleTrigger className="w-full">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Bell className="h-5 w-5" />
                      <CardTitle>Notification Rules</CardTitle>
                    </div>
                    {expandedSections.notifications ? 
                      <ChevronDown className="h-4 w-4" /> : 
                      <ChevronRight className="h-4 w-4" />
                    }
                  </div>
                  <CardDescription className="text-left">
                    Configure alerts and notifications for production events
                  </CardDescription>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-6">
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Switch 
                        checked={productionRules.notificationRules.dueDateWarnings.enabled}
                        onCheckedChange={(checked) => updateProductionRules('notificationRules.dueDateWarnings.enabled', checked)}
                      />
                      <Label>Due date warnings</Label>
                    </div>
                    <div className="ml-6">
                      <Label className="text-sm">Warning times (hours before due date)</Label>
                      <div className="flex gap-2 mt-1">
                        {productionRules.notificationRules.dueDateWarnings.warningHours.map((hours, index) => (
                          <Badge key={index} variant="secondary">{hours}h</Badge>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Switch 
                        checked={productionRules.notificationRules.equipmentMaintenance.enabled}
                        onCheckedChange={(checked) => updateProductionRules('notificationRules.equipmentMaintenance.enabled', checked)}
                      />
                      <Label>Equipment maintenance alerts</Label>
                    </div>
                    <div className="ml-6">
                      <Label className="text-sm">Maintenance interval</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <Input
                          type="number"
                          value={productionRules.notificationRules.equipmentMaintenance.maintenanceIntervalHours}
                          onChange={(e) => updateProductionRules('notificationRules.equipmentMaintenance.maintenanceIntervalHours', parseInt(e.target.value))}
                          className="w-20 h-8"
                        />
                        <span className="text-sm text-muted-foreground">hours of operation</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Switch 
                        checked={productionRules.notificationRules.capacityOverload.enabled}
                        onCheckedChange={(checked) => updateProductionRules('notificationRules.capacityOverload.enabled', checked)}
                      />
                      <Label>Capacity overload alerts</Label>
                    </div>
                    <div className="ml-6">
                      <Label className="text-sm">Alert threshold</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <Input
                          type="number"
                          value={productionRules.notificationRules.capacityOverload.thresholdPercentage}
                          onChange={(e) => updateProductionRules('notificationRules.capacityOverload.thresholdPercentage', parseInt(e.target.value))}
                          className="w-20 h-8"
                        />
                        <span className="text-sm text-muted-foreground">% capacity utilization</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>

          {/* Cost Optimization Rules */}
          <Card>
            <Collapsible 
              open={expandedSections.costOptimization} 
              onOpenChange={() => toggleSection('costOptimization')}
            >
              <CollapsibleTrigger className="w-full">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-5 w-5" />
                      <CardTitle>Cost Optimization Rules</CardTitle>
                    </div>
                    {expandedSections.costOptimization ? 
                      <ChevronDown className="h-4 w-4" /> : 
                      <ChevronRight className="h-4 w-4" />
                    }
                  </div>
                  <CardDescription className="text-left">
                    Configure pricing rules and cost optimization settings
                  </CardDescription>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-6">
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Switch 
                        checked={productionRules.costOptimization.rushJobSurcharge.enabled}
                        onCheckedChange={(checked) => updateProductionRules('costOptimization.rushJobSurcharge.enabled', checked)}
                      />
                      <Label>Rush job surcharge</Label>
                    </div>
                    <div className="ml-6 grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-sm">Surcharge %</Label>
                        <Input
                          type="number"
                          value={productionRules.costOptimization.rushJobSurcharge.surchargePercentage}
                          onChange={(e) => updateProductionRules('costOptimization.rushJobSurcharge.surchargePercentage', parseInt(e.target.value))}
                          className="h-8"
                          disabled={!productionRules.costOptimization.rushJobSurcharge.enabled}
                        />
                      </div>
                      <div>
                        <Label className="text-sm">Rush threshold (hours)</Label>
                        <Input
                          type="number"
                          value={productionRules.costOptimization.rushJobSurcharge.rushThresholdHours}
                          onChange={(e) => updateProductionRules('costOptimization.rushJobSurcharge.rushThresholdHours', parseInt(e.target.value))}
                          className="h-8"
                          disabled={!productionRules.costOptimization.rushJobSurcharge.enabled}
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Switch 
                        checked={productionRules.costOptimization.smallQuantityPenalty.enabled}
                        onCheckedChange={(checked) => updateProductionRules('costOptimization.smallQuantityPenalty.enabled', checked)}
                      />
                      <Label>Small quantity penalty</Label>
                    </div>
                    <div className="ml-6 grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-sm">Minimum quantity</Label>
                        <Input
                          type="number"
                          value={productionRules.costOptimization.smallQuantityPenalty.minimumQuantity}
                          onChange={(e) => updateProductionRules('costOptimization.smallQuantityPenalty.minimumQuantity', parseInt(e.target.value))}
                          className="h-8"
                          disabled={!productionRules.costOptimization.smallQuantityPenalty.enabled}
                        />
                      </div>
                      <div>
                        <Label className="text-sm">Penalty %</Label>
                        <Input
                          type="number"
                          value={productionRules.costOptimization.smallQuantityPenalty.penaltyPercentage}
                          onChange={(e) => updateProductionRules('costOptimization.smallQuantityPenalty.penaltyPercentage', parseInt(e.target.value))}
                          className="h-8"
                          disabled={!productionRules.costOptimization.smallQuantityPenalty.enabled}
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <Label>Equipment utilization target</Label>
                    <div className="flex items-center gap-2 mt-2">
                      <Input
                        type="number"
                        value={productionRules.costOptimization.equipmentUtilizationTarget}
                        onChange={(e) => updateProductionRules('costOptimization.equipmentUtilizationTarget', parseInt(e.target.value))}
                        className="w-20"
                      />
                      <span className="text-sm text-muted-foreground">% target utilization for optimal efficiency</span>
                    </div>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>

          {/* Outsourcing Rules */}
          <Card>
            <Collapsible 
              open={expandedSections.outsourcing} 
              onOpenChange={() => toggleSection('outsourcing')}
            >
              <CollapsibleTrigger className="w-full">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Truck className="h-5 w-5" />
                      <CardTitle>Outsourcing Rules</CardTitle>
                    </div>
                    {expandedSections.outsourcing ? 
                      <ChevronDown className="h-4 w-4" /> : 
                      <ChevronRight className="h-4 w-4" />
                    }
                  </div>
                  <CardDescription className="text-left">
                    Configure automatic outsourcing and vendor preferences
                  </CardDescription>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-6">
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Switch 
                        checked={productionRules.outsourcingRules.autoOutsourcing.enabled}
                        onCheckedChange={(checked) => updateProductionRules('outsourcingRules.autoOutsourcing.enabled', checked)}
                      />
                      <Label>Automatic outsourcing</Label>
                    </div>
                    <div className="ml-6 grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-sm">Capacity threshold (%)</Label>
                        <Input
                          type="number"
                          value={productionRules.outsourcingRules.autoOutsourcing.capacityThreshold}
                          onChange={(e) => updateProductionRules('outsourcingRules.autoOutsourcing.capacityThreshold', parseInt(e.target.value))}
                          className="h-8"
                          disabled={!productionRules.outsourcingRules.autoOutsourcing.enabled}
                        />
                      </div>
                      <div>
                        <Label className="text-sm">Lead time buffer (days)</Label>
                        <Input
                          type="number"
                          value={productionRules.outsourcingRules.autoOutsourcing.leadTimeBuffer}
                          onChange={(e) => updateProductionRules('outsourcingRules.autoOutsourcing.leadTimeBuffer', parseInt(e.target.value))}
                          className="h-8"
                          disabled={!productionRules.outsourcingRules.autoOutsourcing.enabled}
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <Label>Preferred Vendors</Label>
                    <div className="space-y-3 mt-2">
                      {Object.entries(productionRules.outsourcingRules.preferredVendors).map(([method, vendors]) => (
                        <div key={method} className="border rounded-lg p-3">
                          <Label className="text-sm font-medium capitalize">{method.replace(/([A-Z])/g, ' $1').toLowerCase()}</Label>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {vendors.map((vendor, index) => (
                              <Badge key={index} variant="outline">{vendor}</Badge>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>

          {/* Legacy Rules */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Scheduling Rules</CardTitle>
              <CardDescription>
                Core scheduling and automation settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <div className="flex items-center gap-2">
                  <Switch 
                    checked={productionRules.autoScheduling}
                    onCheckedChange={(checked) => updateProductionRules('autoScheduling', checked)}
                  />
                  <Label>Auto-scheduling</Label>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Automatically schedule jobs based on due dates and capacity
                </p>
              </div>

              <div>
                <Label>Setup time buffer</Label>
                <div className="flex items-center gap-2 mt-2">
                  <Input
                    type="number"
                    value={productionRules.setupTimeBuffer}
                    onChange={(e) => updateProductionRules('setupTimeBuffer', parseInt(e.target.value))}
                    className="w-20"
                  />
                  <span className="text-sm text-muted-foreground">minutes buffer between jobs for setup</span>
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <Switch 
                    checked={productionRules.rushJobPriority}
                    onCheckedChange={(checked) => updateProductionRules('rushJobPriority', checked)}
                  />
                  <Label>Rush job priority</Label>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Automatically prioritize rush jobs in scheduling
                </p>
              </div>
            </CardContent>
          </Card>
          <div className="flex justify-end">
            <Button variant="secondary" disabled={savingRules} onClick={handlePersistProductionRules}>
              {savingRules ? 'Saving…' : 'Save Rules'}
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      {/* Equipment Working Hours Dialog */}
      <Dialog open={isHoursDialogOpen} onOpenChange={setIsHoursDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Configure Working Hours</DialogTitle>
            <DialogDescription>
              Set custom working hours for {editingEquipmentHours?.name}
            </DialogDescription>
          </DialogHeader>
          
          {editingEquipmentHours && (
            <div className="space-y-4">
              {Object.entries(editingEquipmentHours.workingHours).map(([day, hours]) => (
                <div key={day} className="flex items-center gap-4">
                  <div className="w-24">
                    <Label className="capitalize">{day}</Label>
                  </div>
                  <Switch 
                    checked={hours.enabled}
                    onCheckedChange={(enabled) => 
                      handleUpdateEquipmentWorkingHours(day as keyof WorkingHours, { enabled })
                    }
                  />
                  <div className="flex items-center gap-2">
                    <Input
                      type="time"
                      value={hours.start}
                      disabled={!hours.enabled}
                      className="w-32"
                      onChange={(e) => 
                        handleUpdateEquipmentWorkingHours(day as keyof WorkingHours, { start: e.target.value })
                      }
                    />
                    <span className="text-muted-foreground">to</span>
                    <Input
                      type="time"
                      value={hours.end}
                      disabled={!hours.enabled}
                      className="w-32"
                      onChange={(e) => 
                        handleUpdateEquipmentWorkingHours(day as keyof WorkingHours, { end: e.target.value })
                      }
                    />
                  </div>
                </div>
              ))}
              
              <div className="flex justify-end gap-2 pt-4">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setIsHoursDialogOpen(false);
                    setEditingEquipmentHours(null);
                  }}
                >
                  Cancel
                </Button>
                <Button onClick={handleSaveEquipmentHours}>
                  Save Hours
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}