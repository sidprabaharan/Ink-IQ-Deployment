import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Plus, Copy, Trash2, Settings2 } from 'lucide-react';
import { IMPRINT_METHODS } from '@/types/imprint';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { track } from '@/lib/utils';
import { useOrganization } from '@/context/OrganizationContext';

// Use the canonical list across the app: Screen Printing, Embroidery, DTF, DTG
const imprintMethods = IMPRINT_METHODS;

interface ImprintMethodConfig {
  id: string;
  method: string;
  label: string;
  enabled: boolean;
  inkSpecialties?: string[];
  capabilities?: {
    simulatedProcess?: boolean;
    printOverZippers?: boolean;
    printOverHoodiePockets?: boolean;
    printOffBottomEdge?: boolean;
    printOnTshirtPockets?: boolean;
    printOnSleeves?: boolean;
    printNeckLabels?: boolean;
    oversizedPrints?: boolean;
    printOnFoamTruckerCaps?: boolean;
    printOnKidInfantShirts?: boolean;
  };
  maxColors?: number;
  colorNotes?: string;
  maxWidth?: number;
  maxHeight?: number;
  maxSleeveWidth?: number;
  maxSleeveHeight?: number;
  logoSizeNotes?: string;
  minQuantity?: number;
  maxQuantity?: number;
  dailyCapacity?: number;
  damageRate?: number;
  turnaroundTimes?: Array<{
    type: string;
    days: number;
    extraCharge: number;
  }>;
  pricingGrid?: Array<{
    quantity: string;
    oneColor: number;
    twoColors: number;
    threeColors: number;
    fourPlusColors: number;
  }>;
  fees?: Array<{
    name: string;
    price: number;
  }>;
  extraCharges?: Array<{
    name: string;
    price: number;
  }>;
  embroideryPricing?: {
    stitchColumns: string[];
    rows: Array<{ quantity: string; values: number[] }>;
  };
  // DTG-specific pricing (by logo size)
  dtgWhitePricing?: Array<{
    quantity: string;
    size4x4: number;
    size10x10: number;
    size15x15: number;
  }>;
  dtgColoredPricing?: Array<{
    quantity: string;
    size4x4: number;
    size10x10: number;
    size15x15: number;
  }>;
}

export function ImprintMethodsSettings() {
  const [configuredMethods, setConfiguredMethods] = useState<ImprintMethodConfig[]>([]);
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newMethodType, setNewMethodType] = useState<string>('');
  const { toast } = useToast();
  const { organization, updateOrganizationSettings } = useOrganization();

  useEffect(() => {
    const s: any = organization?.org_settings || {};
    const fromOrg = (s.imprints?.methods as ImprintMethodConfig[] | undefined) || [];
    if (Array.isArray(fromOrg)) {
      console.debug('[Imprints] load from org settings', { count: fromOrg.length, methods: fromOrg.map(m => ({ id: m.id, method: m.method, label: m.label })) });
      setConfiguredMethods(fromOrg);
    }
  }, [organization]);

  const persistImprintMethods = async (methods: ImprintMethodConfig[] = configuredMethods) => {
    const existing = ((organization?.org_settings as any)?.imprints) || {};
    const res = await updateOrganizationSettings({ imprints: { ...existing, methods } });
    if (res.success) {
      toast({ title: 'Saved', description: 'Imprint methods saved.' });
      track('prod_settings_updated', { entity_type: 'imprint_methods', action: 'save', count: methods.length });
    } else {
      toast({ variant: 'destructive', title: 'Save failed', description: res.error || 'Please try again.' });
    }
  };

  const handleAddMethod = () => {
    if (!newMethodType) return;
    
    const methodInfo = imprintMethods.find(m => m.value === newMethodType);
    if (!methodInfo) return;

    const base: ImprintMethodConfig = {
      id: `${newMethodType}_${Date.now()}`,
      method: newMethodType,
      label: methodInfo.label,
      enabled: true,
      inkSpecialties: [],
      capabilities: {},
      maxColors: 0,
      colorNotes: '',
      maxWidth: 0,
      maxHeight: 0,
      maxSleeveWidth: 0,
      maxSleeveHeight: 0,
      logoSizeNotes: '',
      minQuantity: 0,
      maxQuantity: 0,
      dailyCapacity: 0,
      damageRate: 0,
      turnaroundTimes: [
        { type: 'Standard', days: 0, extraCharge: 0 },
        { type: 'Rush 1', days: 0, extraCharge: 0 },
        { type: 'Rush 2', days: 0, extraCharge: 0 },
        { type: 'Rush 3', days: 0, extraCharge: 0 }
      ],
      pricingGrid: [
        { quantity: '12-23', oneColor: 0, twoColors: 0, threeColors: 0, fourPlusColors: 0 },
        { quantity: '24-47', oneColor: 0, twoColors: 0, threeColors: 0, fourPlusColors: 0 },
        { quantity: '48-71', oneColor: 0, twoColors: 0, threeColors: 0, fourPlusColors: 0 },
        { quantity: '72-143', oneColor: 0, twoColors: 0, threeColors: 0, fourPlusColors: 0 },
        { quantity: '144-287', oneColor: 0, twoColors: 0, threeColors: 0, fourPlusColors: 0 },
        { quantity: '288+', oneColor: 0, twoColors: 0, threeColors: 0, fourPlusColors: 0 }
      ],
      fees: [
        { name: 'Vectorizing', price: 0 },
        { name: 'Set Up', price: 0 },
        { name: 'Screens', price: 0 },
        { name: 'Colour Separations', price: 0 },
        { name: 'Print Sample', price: 0 }
      ],
      extraCharges: [
        { name: 'Oversized Print', price: 0 },
        { name: 'Sleeve Print', price: 0 },
        { name: 'Print on Fleece', price: 0 },
        { name: 'Water Based Ink', price: 0 },
        { name: 'Discharge Ink', price: 0 },
        { name: 'Puff Ink', price: 0 },
        { name: 'High Density', price: 0 },
        { name: 'Glitter', price: 0 },
        { name: 'Silicone', price: 0 },
        { name: 'Metallic', price: 0 },
        { name: 'Shimmer', price: 0 },
        { name: 'Foil', price: 0 },
        { name: 'Reflective', price: 0 },
        { name: 'Glow in the Dark', price: 0 },
        { name: 'Flocking', price: 0 }
      ]
    };

    const newMethod: ImprintMethodConfig = newMethodType === 'dtg' ? {
      ...base,
      fees: [ { name: 'Setup', price: 0 } ],
      extraCharges: [ { name: 'Sleeves', price: 0 }, { name: 'Fleece', price: 0 }, { name: 'Over Zipper', price: 0 }, { name: 'Over Pocket', price: 0 }, { name: 'Neck Label', price: 0 }, { name: 'Kids Shirts', price: 0 } ],
      dtgWhitePricing: [
        { quantity: '12-24', size4x4: 0, size10x10: 0, size15x15: 0 },
        { quantity: '25-50', size4x4: 0, size10x10: 0, size15x15: 0 },
        { quantity: '51-100', size4x4: 0, size10x10: 0, size15x15: 0 },
        { quantity: '101-500', size4x4: 0, size10x10: 0, size15x15: 0 },
      ],
      dtgColoredPricing: [
        { quantity: '12-24', size4x4: 0, size10x10: 0, size15x15: 0 },
        { quantity: '25-50', size4x4: 0, size10x10: 0, size15x15: 0 },
        { quantity: '51-100', size4x4: 0, size10x10: 0, size15x15: 0 },
        { quantity: '101-500', size4x4: 0, size10x10: 0, size15x15: 0 },
      ]
    } : newMethodType === 'embroidery' ? {
      ...base,
      // Seed an embroidery pricing grid (stitch ranges x quantity ranges)
      embroideryPricing: {
        stitchColumns: ['0-7000', '7001-8000', '8001-9000', '9001-10000', '10001+'],
        rows: [
          { quantity: '12-24', values: [0, 0, 0, 0, 0] },
          { quantity: '25-50', values: [0, 0, 0, 0, 0] },
          { quantity: '51-100', values: [0, 0, 0, 0, 0] },
          { quantity: '101-250', values: [0, 0, 0, 0, 0] },
          { quantity: '251-500', values: [0, 0, 0, 0, 0] },
          { quantity: '501+', values: [0, 0, 0, 0, 0] },
        ],
      },
      // Embroidery-specific common fees and charges
      fees: [
        { name: 'Digitizing', price: 0 },
        { name: 'Sew Out Sample', price: 0 },
        { name: 'Artwork Adjustments', price: 0 },
        { name: 'Names', price: 0 },
      ],
      extraCharges: [
        { name: 'Metallic Thread', price: 0 },
        { name: '3D Puff', price: 0 },
        { name: 'Appliqué', price: 0 },
        { name: 'Glow in the Dark Thread', price: 0 },
        { name: 'Rayon Thread', price: 0 },
        { name: 'Reflective Thread', price: 0 },
      ],
    } : base;

    console.debug('[Imprints] add method', { id: newMethod.id, method: newMethod.method, label: newMethod.label });
    setConfiguredMethods(prev => [...prev, newMethod]);
    setSelectedMethod(newMethod.id);
    setIsAddDialogOpen(false);
    setNewMethodType('');
    
    toast({
      title: "Imprint Method Added",
      description: `${methodInfo.label} has been added to your configuration.`
    });
    track('prod_settings_updated', { entity_type: 'imprint_method', entity_id: newMethod.id, action: 'create' });
  };

  // Deactivate method with warning if unscheduled jobs exist; allow scheduled; block new selection via enabled flag
  const handleToggleEnabled = async (id: string, enabled: boolean) => {
    const cfg = configuredMethods.find(m => m.id === id);
    if (!cfg) return;
    if (!enabled) {
      // turning off
      const methodCode = cfg.method;
      try {
        const { data, error } = await supabase.rpc('get_production_jobs', { p_method: methodCode, p_stage: null });
        if (!error) {
          const hasUnscheduled = Array.isArray(data) && (data as any[]).some(j => (j.status || 'unscheduled') === 'unscheduled');
          if (hasUnscheduled) {
            toast({ title: 'Heads up', description: 'There are unscheduled jobs for this method. They will remain; new selections will be blocked while inactive.', variant: 'destructive' });
          }
        }
      } catch {}
    }
    setConfiguredMethods(prev => prev.map(m => m.id === id ? { ...m, enabled } : m));
    track('prod_settings_updated', { entity_type: 'imprint_method', entity_id: id, action: enabled ? 'enable' : 'disable' });
  };

  const selectedConfig = configuredMethods.find(m => m.id === selectedMethod);
  if (selectedConfig) {
    console.debug('[Imprints] selected method config', { id: selectedConfig.id, method: selectedConfig.method, label: selectedConfig.label });
  } else {
    if (selectedMethod) console.debug('[Imprints] no config found for selectedMethod', selectedMethod);
  }
  const availableMethods = imprintMethods.filter(method => 
    !configuredMethods.some(config => config.method === method.value)
  );

  if (selectedConfig) {
    if (selectedConfig.method === 'embroidery') {
      console.debug('[Imprints] rendering EmbroideryConfig');
      return <EmbroideryConfig config={selectedConfig} onBack={() => setSelectedMethod(null)} onUpdate={(updated) => {
        setConfiguredMethods(prev => prev.map(m => m.id === updated.id ? updated : m));
      }} onPersist={() => persistImprintMethods()} />;
    }
    if (selectedConfig.method === 'general') {
      return <GeneralConfig config={selectedConfig} onBack={() => setSelectedMethod(null)} onUpdate={(updated) => {
        setConfiguredMethods(prev => prev.map(m => m.id === updated.id ? updated : m));
      }} onPersist={() => persistImprintMethods()} />;
    }
    if (selectedConfig.method === 'dtg') {
      return <DTGConfig config={selectedConfig} onBack={() => setSelectedMethod(null)} onUpdate={(updated) => {
        setConfiguredMethods(prev => prev.map(m => m.id === updated.id ? updated : m));
      }} onPersist={() => persistImprintMethods()} />;
    }
    return <ScreenPrintingConfig config={selectedConfig} onBack={() => setSelectedMethod(null)} onUpdate={(updated) => {
      setConfiguredMethods(prev => prev.map(m => m.id === updated.id ? updated : m));
    }} onPersist={() => persistImprintMethods()} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Imprint Methods</h3>
          <p className="text-sm text-muted-foreground">Manage imprint methods</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Imprint Methods</CardTitle>
            <CardDescription>Manage imprint methods</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-lg font-medium">Imprint Method Configuration</h4>
                <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Imprint Method
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add New Imprint Method</DialogTitle>
                      <DialogDescription>
                        Select an imprint method to configure for your business
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Select Imprint Method</Label>
                        <Select value={newMethodType} onValueChange={setNewMethodType}>
                          <SelectTrigger>
                            <SelectValue placeholder="Choose an imprint method" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableMethods.map((method) => (
                              <SelectItem key={method.value} value={method.value}>
                                <div className="flex items-center">
                                  <Settings2 className="h-4 w-4 mr-2" />
                                  {method.label}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                          Cancel
                        </Button>
                        <Button onClick={handleAddMethod} disabled={!newMethodType}>
                          Add Method
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
              <p className="text-sm text-muted-foreground">
                Configure your available imprint methods and their settings
              </p>
              
              {configuredMethods.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                    <Settings2 className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-medium mb-2">No Imprint Methods Configured</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Get started by adding your first imprint method. Configure pricing, capabilities, and constraints for each method you offer.
                  </p>
                  <Button onClick={() => setIsAddDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Your First Method
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {configuredMethods.map((method) => (
                    <div key={method.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Settings2 className="h-5 w-5 text-primary" />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{method.label}</span>
                            <Badge variant={method.enabled ? "default" : "secondary"}>
                              {method.enabled ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Configure your {method.label.toLowerCase()} settings
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" onClick={() => {
                          const clone = { ...method, id: `${method.method}_${Date.now()}` };
                          setConfiguredMethods(prev => [...prev, clone]);
                        }}>
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => {
                          setConfiguredMethods(prev => prev.filter(m => m.id !== method.id));
                        }}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setSelectedMethod(method.id)}
                        >
                          Configure
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex justify-end pt-4">
                <Button onClick={() => persistImprintMethods()}>Save Changes</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ScreenPrintingConfig({ config, onBack, onUpdate, onPersist }: { 
  config: ImprintMethodConfig; 
  onBack: () => void;
  onUpdate: (config: ImprintMethodConfig) => void;
  onPersist: () => void;
}) {
  const [localConfig, setLocalConfig] = useState(config);
  const [newSpecialty, setNewSpecialty] = useState('');

  const inkSpecialties = [
    'Plastisol (Industry Standard)', 'Water Based', 'Discharge', 'Puff Ink',
    'High Density', 'Silicone', 'Glitter', 'Metallic', 'Shimmer', 'Foil',
    'Reflective', 'Glow in the Dark', 'Flocking'
  ];

  const updateConfig = (updates: Partial<ImprintMethodConfig>) => {
    const updated = { ...localConfig, ...updates };
    setLocalConfig(updated);
    onUpdate(updated);
  };

  const updateCapability = (key: string, value: boolean) => {
    updateConfig({
      capabilities: {
        ...localConfig.capabilities,
        [key]: value
      }
    });
  };

  // Embroidery pricing helpers (single definition)
  const getDefaultEP = () => ({
    stitchColumns: ['0-7000', '7001-8000', '8001-9000', '9001-10000', '10001+'],
    rows: [
      { quantity: '12-24', values: [0,0,0,0,0] },
      { quantity: '25-50', values: [0,0,0,0,0] },
      { quantity: '51-100', values: [0,0,0,0,0] },
      { quantity: '101-250', values: [0,0,0,0,0] },
      { quantity: '251-500', values: [0,0,0,0,0] },
      { quantity: '501+', values: [0,0,0,0,0] },
    ]
  });

  const addStitchColumn = () => {
    const ep = localConfig.embroideryPricing || getDefaultEP();
    const nextCols = [...ep.stitchColumns, 'New'];
    const nextRows = ep.rows.map(r => ({ ...r, values: [...r.values, 0] }));
    updateConfig({ embroideryPricing: { stitchColumns: nextCols, rows: nextRows } });
  };

  const addQuantityRow = () => {
    const ep = localConfig.embroideryPricing || getDefaultEP();
    const values = Array(ep.stitchColumns.length).fill(0);
    updateConfig({ embroideryPricing: { stitchColumns: ep.stitchColumns, rows: [...ep.rows, { quantity: 'New', values }] } });
  };

  const setPriceCell = (rowIdx: number, colIdx: number, val: number) => {
    const ep = localConfig.embroideryPricing || getDefaultEP();
    const rows = ep.rows.map((r, i) => i === rowIdx ? { ...r, values: r.values.map((v, j) => j === colIdx ? val : v) } : r);
    updateConfig({ embroideryPricing: { stitchColumns: ep.stitchColumns, rows } });
  };

  const updateTurnaroundTime = (index: number, field: string, value: number) => {
    const updated = [...(localConfig.turnaroundTimes || [])];
    updated[index] = { ...updated[index], [field]: value };
    updateConfig({ turnaroundTimes: updated });
  };

  const updatePricingGrid = (index: number, field: string, value: number) => {
    const updated = [...(localConfig.pricingGrid || [])];
    updated[index] = { ...updated[index], [field]: value };
    updateConfig({ pricingGrid: updated });
  };

  const updateFee = (index: number, field: string, value: number | string) => {
    const updated = [...(localConfig.fees || [])];
    updated[index] = { ...updated[index], [field]: value };
    updateConfig({ fees: updated });
  };

  const updateExtraCharge = (index: number, field: string, value: number | string) => {
    const updated = [...(localConfig.extraCharges || [])];
    updated[index] = { ...updated[index], [field]: value };
    updateConfig({ extraCharges: updated });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" onClick={onBack}>
          ← Back
        </Button>
        <div className="flex items-center gap-3">
          <Settings2 className="h-6 w-6 text-primary" />
          <div>
            <h2 className="text-xl font-semibold">{localConfig.label}</h2>
            <p className="text-sm text-muted-foreground">Configure your {localConfig.label.toLowerCase()} settings</p>
          </div>
          <div className="ml-auto">
            <Switch
              checked={localConfig.enabled}
              onCheckedChange={(enabled) => handleToggleEnabled(localConfig.id, enabled)}
            />
            <Label className="ml-2">Active</Label>
          </div>
        </div>
      </div>

      <div className="space-y-6" style={{ maxHeight: '70vh', overflowY: 'auto', paddingRight: 4 }}>
      <Card>
        <CardHeader>
          <CardTitle>{localConfig.label} Information</CardTitle>
          <CardDescription>Fill out this page if you offer {localConfig.label.toLowerCase()}. Skip if you don't.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h4 className="font-medium mb-3">Select the {localConfig.label.toLowerCase()} inks / specialties you offer.</h4>
            <div className="grid grid-cols-2 gap-3">
              {inkSpecialties.map((specialty) => (
                <div key={specialty} className="flex items-center space-x-2">
                  <Checkbox
                    id={specialty}
                    checked={localConfig.inkSpecialties?.includes(specialty) || false}
                    onCheckedChange={(checked) => {
                      const current = localConfig.inkSpecialties || [];
                      if (checked) {
                        updateConfig({ inkSpecialties: [...current, specialty] });
                      } else {
                        updateConfig({ inkSpecialties: current.filter(s => s !== specialty) });
                      }
                    }}
                  />
                  <Label htmlFor={specialty} className="text-sm">{specialty}</Label>
                </div>
              ))}
            </div>
            <Button variant="ghost" size="sm" className="mt-2">
              <Plus className="h-4 w-4 mr-2" />
              Add custom ink specialty...
            </Button>
            <div className="flex gap-2 mt-2">
              <Input placeholder="Add custom ink specialty..." value={newSpecialty} onChange={(e) => setNewSpecialty(e.target.value)} />
              <Button type="button" onClick={() => {
                const name = newSpecialty.trim();
                if (!name) return;
                const current = localConfig.inkSpecialties || [];
                if (!current.includes(name)) updateConfig({ inkSpecialties: [...current, name] });
                setNewSpecialty('');
              }}>Add</Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium">Are you good at simulated process screen printing?</Label>
                <RadioGroup 
                  value={localConfig.capabilities?.simulatedProcess ? "yes" : "no"}
                  onValueChange={(value) => updateCapability('simulatedProcess', value === "yes")}
                  className="flex gap-4 mt-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="yes" id="sim-yes" />
                    <Label htmlFor="sim-yes">Yes</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="no" id="sim-no" />
                    <Label htmlFor="sim-no">No</Label>
                  </div>
                </RadioGroup>
              </div>

              <div>
                <Label className="text-sm font-medium">Do you print over zippers?</Label>
                <RadioGroup 
                  value={localConfig.capabilities?.printOverZippers ? "yes" : "no"}
                  onValueChange={(value) => updateCapability('printOverZippers', value === "yes")}
                  className="flex gap-4 mt-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="yes" id="zip-yes" />
                    <Label htmlFor="zip-yes">Yes</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="no" id="zip-no" />
                    <Label htmlFor="zip-no">No</Label>
                  </div>
                </RadioGroup>
              </div>

              <div>
                <Label className="text-sm font-medium">Do you print over hoodie pockets?</Label>
                <RadioGroup 
                  value={localConfig.capabilities?.printOverHoodiePockets ? "yes" : "no"}
                  onValueChange={(value) => updateCapability('printOverHoodiePockets', value === "yes")}
                  className="flex gap-4 mt-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="yes" id="hoodie-yes" />
                    <Label htmlFor="hoodie-yes">Yes</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="no" id="hoodie-no" />
                    <Label htmlFor="hoodie-no">No</Label>
                  </div>
                </RadioGroup>
              </div>

              <div>
                <Label className="text-sm font-medium">Do you print off the bottom edge of shirts?</Label>
                <RadioGroup 
                  value={localConfig.capabilities?.printOffBottomEdge ? "yes" : "no"}
                  onValueChange={(value) => updateCapability('printOffBottomEdge', value === "yes")}
                  className="flex gap-4 mt-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="yes" id="bottom-yes" />
                    <Label htmlFor="bottom-yes">Yes</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="no" id="bottom-no" />
                    <Label htmlFor="bottom-no">No</Label>
                  </div>
                </RadioGroup>
              </div>

              <div>
                <Label className="text-sm font-medium">Do you print on t-shirt pockets?</Label>
                <RadioGroup 
                  value={localConfig.capabilities?.printOnTshirtPockets ? "yes" : "no"}
                  onValueChange={(value) => updateCapability('printOnTshirtPockets', value === "yes")}
                  className="flex gap-4 mt-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="yes" id="pocket-yes" />
                    <Label htmlFor="pocket-yes">Yes</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="no" id="pocket-no" />
                    <Label htmlFor="pocket-no">No</Label>
                  </div>
                </RadioGroup>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium">Do you print on sleeves?</Label>
                <RadioGroup 
                  value={localConfig.capabilities?.printOnSleeves ? "yes" : "no"}
                  onValueChange={(value) => updateCapability('printOnSleeves', value === "yes")}
                  className="flex gap-4 mt-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="yes" id="sleeves-yes" />
                    <Label htmlFor="sleeves-yes">Yes</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="no" id="sleeves-no" />
                    <Label htmlFor="sleeves-no">No</Label>
                  </div>
                </RadioGroup>
              </div>

              <div>
                <Label className="text-sm font-medium">Do you print neck labels?</Label>
                <RadioGroup 
                  value={localConfig.capabilities?.printNeckLabels ? "yes" : "no"}
                  onValueChange={(value) => updateCapability('printNeckLabels', value === "yes")}
                  className="flex gap-4 mt-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="yes" id="neck-yes" />
                    <Label htmlFor="neck-yes">Yes</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="no" id="neck-no" />
                    <Label htmlFor="neck-no">No</Label>
                  </div>
                </RadioGroup>
              </div>

              <div>
                <Label className="text-sm font-medium">Do you offer over sized / all over prints?</Label>
                <RadioGroup 
                  value={localConfig.capabilities?.oversizedPrints ? "yes" : "no"}
                  onValueChange={(value) => updateCapability('oversizedPrints', value === "yes")}
                  className="flex gap-4 mt-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="yes" id="oversized-yes" />
                    <Label htmlFor="oversized-yes">Yes</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="no" id="oversized-no" />
                    <Label htmlFor="oversized-no">No</Label>
                  </div>
                </RadioGroup>
              </div>

              <div>
                <Label className="text-sm font-medium">Do you print on foam trucker caps?</Label>
                <RadioGroup 
                  value={localConfig.capabilities?.printOnFoamTruckerCaps ? "yes" : "no"}
                  onValueChange={(value) => updateCapability('printOnFoamTruckerCaps', value === "yes")}
                  className="flex gap-4 mt-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="yes" id="trucker-yes" />
                    <Label htmlFor="trucker-yes">Yes</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="no" id="trucker-no" />
                    <Label htmlFor="trucker-no">No</Label>
                  </div>
                </RadioGroup>
              </div>

              <div>
                <Label className="text-sm font-medium">Do you print on kid or infant shirts?</Label>
                <RadioGroup 
                  value={localConfig.capabilities?.printOnKidInfantShirts ? "yes" : "no"}
                  onValueChange={(value) => updateCapability('printOnKidInfantShirts', value === "yes")}
                  className="flex gap-4 mt-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="yes" id="kids-yes" />
                    <Label htmlFor="kids-yes">Yes</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="no" id="kids-no" />
                    <Label htmlFor="kids-no">No</Label>
                  </div>
                </RadioGroup>
              </div>
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <Label htmlFor="max-colors">Maximum Colors (Screens)</Label>
                <Input
                  id="max-colors"
                  type="number"
                  value={localConfig.maxColors || ''}
                  onChange={(e) => updateConfig({ maxColors: parseInt(e.target.value) || 0 })}
                  placeholder="Enter maximum colors"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  What's the max number of colors / screens you can print?
                </p>
              </div>

              <div>
                <Label htmlFor="color-notes">Ink Color Additional Notes</Label>
                <Textarea
                  id="color-notes"
                  value={localConfig.colorNotes || ''}
                  onChange={(e) => updateConfig({ colorNotes: e.target.value })}
                  placeholder="Any additional notes about ink colors..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="max-width">Maximum Width in Inches</Label>
                  <Input
                    id="max-width"
                    type="number"
                    value={localConfig.maxWidth || ''}
                    onChange={(e) => updateConfig({ maxWidth: parseInt(e.target.value) || 0 })}
                    placeholder="Width"
                  />
                </div>
                <div>
                  <Label htmlFor="max-height">Maximum Height in Inches</Label>
                  <Input
                    id="max-height"
                    type="number"
                    value={localConfig.maxHeight || ''}
                    onChange={(e) => updateConfig({ maxHeight: parseInt(e.target.value) || 0 })}
                    placeholder="Height"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="sleeve-width">Maximum Sleeve Width</Label>
                  <Input
                    id="sleeve-width"
                    type="number"
                    value={localConfig.maxSleeveWidth || ''}
                    onChange={(e) => updateConfig({ maxSleeveWidth: parseInt(e.target.value) || 0 })}
                    placeholder="Sleeve Width"
                  />
                </div>
                <div>
                  <Label htmlFor="sleeve-height">Maximum Sleeve Height</Label>
                  <Input
                    id="sleeve-height"
                    type="number"
                    value={localConfig.maxSleeveHeight || ''}
                    onChange={(e) => updateConfig({ maxSleeveHeight: parseInt(e.target.value) || 0 })}
                    placeholder="Sleeve Height"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="logo-notes">Logo size additional notes</Label>
                <Textarea
                  id="logo-notes"
                  value={localConfig.logoSizeNotes || ''}
                  onChange={(e) => updateConfig({ logoSizeNotes: e.target.value })}
                  placeholder="Any additional notes about logo sizing..."
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="min-quantity">Minimum Order Quantity</Label>
                  <Input
                    id="min-quantity"
                    type="number"
                    value={localConfig.minQuantity || ''}
                    onChange={(e) => updateConfig({ minQuantity: parseInt(e.target.value) || 0 })}
                    placeholder="Min quantity"
                  />
                </div>
                <div>
                  <Label htmlFor="max-quantity">Maximum Order Quantity</Label>
                  <Input
                    id="max-quantity"
                    type="number"
                    value={localConfig.maxQuantity || ''}
                    onChange={(e) => updateConfig({ maxQuantity: parseInt(e.target.value) || 0 })}
                    placeholder="Max quantity"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="daily-capacity">Daily Capacity</Label>
                  <Input
                    id="daily-capacity"
                    type="number"
                    value={localConfig.dailyCapacity || ''}
                    onChange={(e) => updateConfig({ dailyCapacity: parseInt(e.target.value) || 0 })}
                    placeholder="Daily capacity"
                  />
                </div>
                <div>
                  <Label htmlFor="damage-rate">Damage Rate %</Label>
                  <Input
                    id="damage-rate"
                    type="number"
                    value={localConfig.damageRate || ''}
                    onChange={(e) => updateConfig({ damageRate: parseInt(e.target.value) || 0 })}
                    placeholder="Damage rate"
                  />
                </div>
              </div>
            </div>
          </div>

          <Separator />

          <div>
            <h4 className="font-medium mb-4">{localConfig.label} Production Turnaround Times</h4>
            <p className="text-sm text-muted-foreground mb-4">
              How many business days does it take you to produce {localConfig.label.toLowerCase()} orders? Don't include shipping time here - that's handled elsewhere. If you don't offer rush, you can delete those rows.
            </p>
            <div className="border rounded-lg overflow-hidden">
              <div className="grid grid-cols-3 gap-0 bg-muted">
                <div className="p-3 font-medium">Type</div>
                <div className="p-3 font-medium">Days</div>
                <div className="p-3 font-medium">Extra Charge %</div>
              </div>
              {localConfig.turnaroundTimes?.map((time, index) => (
                <div key={index} className="grid grid-cols-3 gap-0 border-t">
                  <div className="p-3">{time.type}</div>
                  <div className="p-3">
                    <Input
                      type="number"
                      value={time.days}
                      onChange={(e) => updateTurnaroundTime(index, 'days', parseInt(e.target.value) || 0)}
                      placeholder="Days"
                      className="h-8"
                    />
                  </div>
                  <div className="p-3">
                    <Input
                      type="number"
                      value={time.extraCharge}
                      onChange={(e) => updateTurnaroundTime(index, 'extraCharge', parseInt(e.target.value) || 0)}
                      placeholder="%"
                      className="h-8"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          <div>
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-medium">Pricing Grid</h4>
              <div className="space-x-2">
                <Button variant="outline" size="sm" onClick={() => {
                  const next = [ ...(localConfig.pricingGrid || []), { quantity: 'New Range', oneColor: 0, twoColors: 0, threeColors: 0, fourPlusColors: 0 } ];
                  updateConfig({ pricingGrid: next });
                }}>Add Quantity Range</Button>
                <Button variant="outline" size="sm" onClick={() => {
                  alert('Color columns are fixed up to 4+ Colors for now.');
                }}>Add Color Count</Button>
              </div>
            </div>
            <div className="border rounded-lg overflow-hidden">
              <div className="grid grid-cols-5 gap-0 bg-muted">
                <div className="p-3 font-medium">Quantity</div>
                <div className="p-3 font-medium">1 Color</div>
                <div className="p-3 font-medium">2 Colors</div>
                <div className="p-3 font-medium">3 Colors</div>
                <div className="p-3 font-medium">4+ Colors</div>
              </div>
              {localConfig.pricingGrid?.map((row, index) => (
                <div key={index} className="grid grid-cols-5 gap-0 border-t">
                  <div className="p-3">{row.quantity}</div>
                  <div className="p-3">
                    <Input
                      type="number"
                      step="0.01"
                      value={row.oneColor}
                      onChange={(e) => updatePricingGrid(index, 'oneColor', parseFloat(e.target.value) || 0)}
                      placeholder="$0.00"
                      className="h-8"
                    />
                  </div>
                  <div className="p-3">
                    <Input
                      type="number"
                      step="0.01"
                      value={row.twoColors}
                      onChange={(e) => updatePricingGrid(index, 'twoColors', parseFloat(e.target.value) || 0)}
                      placeholder="$0.00"
                      className="h-8"
                    />
                  </div>
                  <div className="p-3">
                    <Input
                      type="number"
                      step="0.01"
                      value={row.threeColors}
                      onChange={(e) => updatePricingGrid(index, 'threeColors', parseFloat(e.target.value) || 0)}
                      placeholder="$0.00"
                      className="h-8"
                    />
                  </div>
                  <div className="p-3">
                    <Input
                      type="number"
                      step="0.01"
                      value={row.fourPlusColors}
                      onChange={(e) => updatePricingGrid(index, 'fourPlusColors', parseFloat(e.target.value) || 0)}
                      placeholder="$0.00"
                      className="h-8"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          <div>
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-medium">Fees</h4>
            </div>
            <div className="border rounded-lg overflow-hidden">
              <div className="grid grid-cols-3 gap-0 bg-muted">
                <div className="p-3 font-medium">Name</div>
                <div className="p-3 font-medium">Price</div>
                <div className="p-3 font-medium">Actions</div>
              </div>
              {localConfig.fees?.map((fee, index) => (
                <div key={index} className="grid grid-cols-3 gap-0 border-t">
                  <div className="p-3">{fee.name}</div>
                  <div className="p-3">
                    <Input
                      type="number"
                      step="0.01"
                      value={fee.price}
                      onChange={(e) => updateFee(index, 'price', parseFloat(e.target.value) || 0)}
                      placeholder="$0.00"
                      className="h-8"
                    />
                  </div>
                  <div className="p-3">
                    <Button variant="ghost" size="sm" onClick={() => {
                      const updated = [...(localConfig.fees || [])];
                      updated.splice(index, 1);
                      updateConfig({ fees: updated });
                    }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <Button variant="ghost" size="sm" className="mt-2" onClick={() => updateConfig({ fees: [ ...(localConfig.fees || []), { name: 'New Fee', price: 0 } ] })}>Add Fee</Button>
          </div>

          <Separator />

          <div>
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-medium">Extra Charges</h4>
            </div>
            <div className="border rounded-lg overflow-hidden">
              <div className="grid grid-cols-3 gap-0 bg-muted">
                <div className="p-3 font-medium">Name</div>
                <div className="p-3 font-medium">Price</div>
                <div className="p-3 font-medium">Actions</div>
              </div>
              {localConfig.extraCharges?.map((charge, index) => (
                <div key={index} className="grid grid-cols-3 gap-0 border-t">
                  <div className="p-3">{charge.name}</div>
                  <div className="p-3">
                    <Input
                      type="number"
                      step="0.01"
                      value={charge.price}
                      onChange={(e) => updateExtraCharge(index, 'price', parseFloat(e.target.value) || 0)}
                      placeholder="$0.00"
                      className="h-8"
                    />
                  </div>
                  <div className="p-3">
                    <Button variant="ghost" size="sm" onClick={() => {
                      const updated = [...(localConfig.extraCharges || [])];
                      updated.splice(index, 1);
                      updateConfig({ extraCharges: updated });
                    }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <Button variant="ghost" size="sm" className="mt-2" onClick={() => updateConfig({ extraCharges: [ ...(localConfig.extraCharges || []), { name: 'New Charge', price: 0 } ] })}>Add Charge</Button>
          </div>
        </CardContent>
      </Card>

      {/* Size limits & quantities */}
      <Card>
        <CardHeader>
          <CardTitle>Size Limits</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Maximum Width in Inches</Label>
              <Input type="number" value={localConfig.maxWidth || ''} onChange={(e) => updateConfig({ maxWidth: parseInt(e.target.value) || 0 })} placeholder="e.g., 12" />
            </div>
            <div>
              <Label>Maximum Height in Inches</Label>
              <Input type="number" value={localConfig.maxHeight || ''} onChange={(e) => updateConfig({ maxHeight: parseInt(e.target.value) || 0 })} placeholder="e.g., 16" />
            </div>
            <div>
              <Label>Maximum Sleeve Width in Inches</Label>
              <Input type="number" value={localConfig.maxSleeveWidth || ''} onChange={(e) => updateConfig({ maxSleeveWidth: parseInt(e.target.value) || 0 })} placeholder="e.g., 3" />
            </div>
            <div>
              <Label>Maximum Sleeve Height in Inches</Label>
              <Input type="number" value={localConfig.maxSleeveHeight || ''} onChange={(e) => updateConfig({ maxSleeveHeight: parseInt(e.target.value) || 0 })} placeholder="e.g., 5" />
            </div>
          </div>
          <div className="mt-3">
            <Label>Logo size additional notes</Label>
            <Textarea value={localConfig.logoSizeNotes || ''} onChange={(e) => updateConfig({ logoSizeNotes: e.target.value })} placeholder="Any additional notes about logo sizing..." />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Order Quantities & Capacity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Minimum Order Quantity</Label>
              <Input type="number" value={localConfig.minQuantity || ''} onChange={(e) => updateConfig({ minQuantity: parseInt(e.target.value) || 0 })} placeholder="e.g., 1" />
            </div>
            <div>
              <Label>Max Order Quantity</Label>
              <Input type="number" value={localConfig.maxQuantity || ''} onChange={(e) => updateConfig({ maxQuantity: parseInt(e.target.value) || 0 })} placeholder="e.g., 1000" />
            </div>
            <div>
              <Label>Daily Capacity (Average Logo)</Label>
              <Input type="number" value={localConfig.dailyCapacity || ''} onChange={(e) => updateConfig({ dailyCapacity: parseInt(e.target.value) || 0 })} placeholder="e.g., 150" />
            </div>
            <div>
              <Label>Damage Rate (%)</Label>
              <Input type="number" value={localConfig.damageRate || ''} onChange={(e) => updateConfig({ damageRate: parseInt(e.target.value) || 0 })} placeholder="e.g., 1.5" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Turnaround Times */}
      <Card>
        <CardHeader>
          <CardTitle>Embroidery Production Turnaround Times</CardTitle>
          <CardDescription>How many business days does it take you to produce embroidery orders?</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-hidden">
            <div className="grid grid-cols-3 gap-0 bg-muted">
              <div className="p-3 font-medium">Type</div>
              <div className="p-3 font-medium">Days</div>
              <div className="p-3 font-medium">Extra Charge %</div>
            </div>
            {(localConfig.turnaroundTimes || []).map((t, i) => (
              <div key={i} className="grid grid-cols-3 gap-0 border-t">
                <div className="p-3">{t.type}</div>
                <div className="p-3"><Input type="number" value={t.days} onChange={(e) => {
                  const up = [...(localConfig.turnaroundTimes || [])];
                  up[i] = { ...up[i], days: parseInt(e.target.value) || 0 } as any;
                  updateConfig({ turnaroundTimes: up });
                }} className="h-8" /></div>
                <div className="p-3"><Input type="number" value={t.extraCharge} onChange={(e) => {
                  const up = [...(localConfig.turnaroundTimes || [])];
                  up[i] = { ...up[i], extraCharge: parseInt(e.target.value) || 0 } as any;
                  updateConfig({ turnaroundTimes: up });
                }} className="h-8" /></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Pricing Grid */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Embroidery Pricing Grid</CardTitle>
            <div className="space-x-2">
              <Button variant="outline" size="sm" onClick={addQuantityRow}>Add Quantity Range</Button>
              <Button variant="outline" size="sm" onClick={addStitchColumn}>Add Stitch Range</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {(() => {
            const ep = localConfig.embroideryPricing || getDefaultEP();
            const header = (
              <div className="grid" style={{ gridTemplateColumns: `200px repeat(${ep.stitchColumns.length}, 1fr)` }}>
                <div className="p-3 bg-muted font-medium">Stitch Count</div>
                {ep.stitchColumns.map((c, ci) => (
                  <div key={ci} className="p-3 bg-muted font-medium">{c}</div>
                ))}
              </div>
            );
            const rows = ep.rows.map((r, ri) => (
              <div key={ri} className="grid border-t" style={{ gridTemplateColumns: `200px repeat(${ep.stitchColumns.length}, 1fr)` }}>
                <div className="p-3">{r.quantity}</div>
                {r.values.map((v, vi) => (
                  <div key={vi} className="p-3"><Input type="number" step="0.01" value={v} onChange={(e) => setPriceCell(ri, vi, parseFloat(e.target.value) || 0)} className="h-8" /></div>
                ))}
              </div>
            ));
            return (
              <div className="border rounded-lg overflow-hidden">
                {header}
                {rows}
              </div>
            );
          })()}
        </CardContent>
      </Card>

      {/* Fees */}
      <Card>
        <CardHeader>
          <CardTitle>Fees</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-hidden">
            <div className="grid grid-cols-3 gap-0 bg-muted">
              <div className="p-3 font-medium">Name</div>
              <div className="p-3 font-medium">Price</div>
              <div className="p-3 font-medium">Actions</div>
            </div>
            {(localConfig.fees || [ { name: 'Digitizing', price: 0 }, { name: 'Sew Out Sample', price: 0 }, { name: 'Artwork Adjustments', price: 0 }, { name: 'Names', price: 0 } ]).map((fee, idx) => (
              <div key={idx} className="grid grid-cols-3 gap-0 border-t">
                <div className="p-3">{fee.name}</div>
                <div className="p-3"><Input type="number" step="0.01" value={fee.price} onChange={(e) => {
                  const up = [...(localConfig.fees || [])]; if (!up[idx]) up[idx] = { name: fee.name, price: 0 } as any; up[idx].price = parseFloat(e.target.value) || 0; updateConfig({ fees: up });
                }} className="h-8" /></div>
                <div className="p-3"><Button variant="ghost" size="sm" onClick={() => { const up = [...(localConfig.fees || [])]; up.splice(idx, 1); updateConfig({ fees: up }); }}><Trash2 className="h-4 w-4" /></Button></div>
              </div>
            ))}
          </div>
          <Button variant="ghost" size="sm" className="mt-2" onClick={() => updateConfig({ fees: [ ...(localConfig.fees || []), { name: 'New Fee', price: 0 } ] })}>Add Fee</Button>
        </CardContent>
      </Card>

      {/* Extra Charges */}
      <Card>
        <CardHeader>
          <CardTitle>Extra Charges</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-hidden">
            <div className="grid grid-cols-3 gap-0 bg-muted">
              <div className="p-3 font-medium">Name</div>
              <div className="p-3 font-medium">Price</div>
              <div className="p-3 font-medium">Actions</div>
            </div>
            {(localConfig.extraCharges || [ { name: 'Metallic Thread', price: 0 }, { name: '3D Puff', price: 0 }, { name: 'Appliqué', price: 0 }, { name: 'Glow in the Dark Thread', price: 0 }, { name: 'Rayon Thread', price: 0 }, { name: 'Reflective Thread', price: 0 } ]).map((ch, idx) => (
              <div key={idx} className="grid grid-cols-3 gap-0 border-t">
                <div className="p-3">{ch.name}</div>
                <div className="p-3"><Input type="number" step="0.01" value={ch.price} onChange={(e) => {
                  const up = [...(localConfig.extraCharges || [])]; if (!up[idx]) up[idx] = { name: ch.name, price: 0 } as any; up[idx].price = parseFloat(e.target.value) || 0; updateConfig({ extraCharges: up });
                }} className="h-8" /></div>
                <div className="p-3"><Button variant="ghost" size="sm" onClick={() => { const up = [...(localConfig.extraCharges || [])]; up.splice(idx, 1); updateConfig({ extraCharges: up }); }}><Trash2 className="h-4 w-4" /></Button></div>
              </div>
            ))}
          </div>
          <Button variant="ghost" size="sm" className="mt-2" onClick={() => updateConfig({ extraCharges: [ ...(localConfig.extraCharges || []), { name: 'New Charge', price: 0 } ] })}>Add Charge</Button>
        </CardContent>
      </Card>

      </div>

      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={() => onBack()}>Back</Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => {
            // reset minimal fields
            const reset = { ...localConfig, inkSpecialties: [], capabilities: {}, fees: [], extraCharges: [] } as any;
            setLocalConfig(reset);
            onUpdate(reset);
          }}>Reset to Defaults</Button>
          <Button onClick={onPersist}>Save Changes</Button>
        </div>
      </div>
    </div>
  );
}

function EmbroideryConfig({ config, onBack, onUpdate, onPersist }: {
  config: ImprintMethodConfig;
  onBack: () => void;
  onUpdate: (config: ImprintMethodConfig) => void;
  onPersist: () => void;
}) {
  const [localConfig, setLocalConfig] = useState(config);
  const [newSpecialty, setNewSpecialty] = useState('');

  const threadSpecialties = [
    'Rayon', 'Polyester', '3D Puff', 'Glow in the Dark Thread', 'Cotton', 'Metallic', 'Appliqué', 'Reflective Thread'
  ];

  const updateConfig = (updates: Partial<ImprintMethodConfig>) => {
    const updated = { ...localConfig, ...updates };
    setLocalConfig(updated);
    onUpdate(updated);
  };

  const updateCapability = (key: string, value: boolean) => {
    updateConfig({
      capabilities: {
        ...localConfig.capabilities,
        [key]: value
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" onClick={onBack}>← Back</Button>
        <div className="flex items-center gap-3">
          <Settings2 className="h-6 w-6 text-primary" />
          <div>
            <h2 className="text-xl font-semibold">{localConfig.label}</h2>
            <p className="text-sm text-muted-foreground">Configure your {localConfig.label.toLowerCase()} settings</p>
          </div>
          <div className="ml-auto">
            <Switch checked={localConfig.enabled} onCheckedChange={(enabled) => handleToggleEnabled(localConfig.id, enabled)} />
            <Label className="ml-2">Active</Label>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{localConfig.label} Information</CardTitle>
          <CardDescription>Fill out this page if you offer {localConfig.label.toLowerCase()}. Skip if you don't.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Thread Specialties */}
          <div>
            <h4 className="font-medium mb-3">Select the embroidery thread types / specialties you offer.</h4>
            <div className="grid grid-cols-2 gap-3">
              {threadSpecialties.map((specialty) => (
                <div key={specialty} className="flex items-center space-x-2">
                  <Checkbox
                    id={specialty}
                    checked={localConfig.inkSpecialties?.includes(specialty) || false}
                    onCheckedChange={(checked) => {
                      const current = localConfig.inkSpecialties || [];
                      if (checked) updateConfig({ inkSpecialties: [...current, specialty] });
                      else updateConfig({ inkSpecialties: current.filter(s => s !== specialty) });
                    }}
                  />
                  <Label htmlFor={specialty} className="text-sm">{specialty}</Label>
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-2">
              <Input placeholder="Add custom thread specialty..." value={newSpecialty} onChange={(e) => setNewSpecialty(e.target.value)} />
              <Button type="button" onClick={() => {
                const name = newSpecialty.trim();
                if (!name) return;
                const current = localConfig.inkSpecialties || [];
                if (!current.includes(name)) updateConfig({ inkSpecialties: [...current, name] });
                setNewSpecialty('');
              }}>Add</Button>
            </div>
          </div>

          {/* UI Questions */}
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium">Do you embroider individual sleeve names?</Label>
              <RadioGroup 
                value={localConfig.capabilities?.sleeveNames ? 'yes' : 'no'}
                onValueChange={(v) => updateCapability('sleeveNames', v === 'yes')}
                className="flex gap-4 mt-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="yes" id="sleevenames-yes" />
                  <Label htmlFor="sleevenames-yes">Yes</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="no" id="sleevenames-no" />
                  <Label htmlFor="sleevenames-no">No</Label>
                </div>
              </RadioGroup>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={() => onBack()}>Back</Button>
        <Button onClick={onPersist}>Save Changes</Button>
      </div>
    </div>
  );
}

function DTGConfig({ config, onBack, onUpdate, onPersist }: {
  config: ImprintMethodConfig;
  onBack: () => void;
  onUpdate: (config: ImprintMethodConfig) => void;
  onPersist: () => void;
}) {
  const [localConfig, setLocalConfig] = useState(config);

  const updateConfig = (updates: Partial<ImprintMethodConfig>) => {
    const updated = { ...localConfig, ...updates };
    setLocalConfig(updated);
    onUpdate(updated);
  };

  const addQuantityRow = (target: 'white' | 'colored') => {
    const row = { quantity: 'New', size4x4: 0, size10x10: 0, size15x15: 0 };
    if (target === 'white') updateConfig({ dtgWhitePricing: [ ...(localConfig.dtgWhitePricing || []), row ] });
    else updateConfig({ dtgColoredPricing: [ ...(localConfig.dtgColoredPricing || []), row ] });
  };

  const updatePriceCell = (target: 'white' | 'colored', index: number, field: 'size4x4' | 'size10x10' | 'size15x15', value: number) => {
    const list = [...((target === 'white' ? localConfig.dtgWhitePricing : localConfig.dtgColoredPricing) || [])];
    list[index] = { ...list[index], [field]: value } as any;
    if (target === 'white') updateConfig({ dtgWhitePricing: list }); else updateConfig({ dtgColoredPricing: list });
  };

  const section = (title: string, target: 'white' | 'colored', rows?: any[]) => (
    <Card className="mt-6">
      <CardHeader className="pb-2">
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="border rounded-lg overflow-hidden">
          <div className="grid grid-cols-4 gap-0 bg-muted">
            <div className="p-3 font-medium">Quantity</div>
            <div className="p-3 font-medium">4"x4"</div>
            <div className="p-3 font-medium">10"x10"</div>
            <div className="p-3 font-medium">15"x15"</div>
          </div>
          {(rows || []).map((r, idx) => (
            <div key={idx} className="grid grid-cols-4 gap-0 border-t">
              <div className="p-3">{r.quantity}</div>
              <div className="p-3"><Input type="number" step="0.01" value={r.size4x4} onChange={(e) => updatePriceCell(target, idx, 'size4x4', parseFloat(e.target.value) || 0)} className="h-8" /></div>
              <div className="p-3"><Input type="number" step="0.01" value={r.size10x10} onChange={(e) => updatePriceCell(target, idx, 'size10x10', parseFloat(e.target.value) || 0)} className="h-8" /></div>
              <div className="p-3"><Input type="number" step="0.01" value={r.size15x15} onChange={(e) => updatePriceCell(target, idx, 'size15x15', parseFloat(e.target.value) || 0)} className="h-8" /></div>
            </div>
          ))}
        </div>
        <div className="mt-3">
          <Button variant="outline" size="sm" onClick={() => addQuantityRow(target)}>Add Quantity Range</Button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" onClick={onBack}>← Back</Button>
        <div className="flex items-center gap-3">
          <Settings2 className="h-6 w-6 text-primary" />
          <div>
            <h2 className="text-xl font-semibold">{localConfig.label}</h2>
            <p className="text-sm text-muted-foreground">Configure your {localConfig.label.toLowerCase()} settings</p>
          </div>
          <div className="ml-auto">
            <Switch checked={localConfig.enabled} onCheckedChange={(enabled) => handleToggleEnabled(localConfig.id, enabled)} />
            <Label className="ml-2">Active</Label>
          </div>
        </div>
      </div>

      {section('White Garment Pricing (Based on Size)', 'white', localConfig.dtgWhitePricing)}
      {section('Colored Garment Pricing (Based on Size)', 'colored', localConfig.dtgColoredPricing)}

      {/* DTG Fees */}
      <Card>
        <CardHeader>
          <CardTitle>Fees</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-hidden">
            <div className="grid grid-cols-3 gap-0 bg-muted">
              <div className="p-3 font-medium">Name</div>
              <div className="p-3 font-medium">Price</div>
              <div className="p-3 font-medium">Actions</div>
            </div>
            {(localConfig.fees || [ { name: 'Setup', price: 0 } ]).map((fee, idx) => (
              <div key={idx} className="grid grid-cols-3 gap-0 border-t">
                <div className="p-3">{fee.name}</div>
                <div className="p-3"><Input type="number" step="0.01" value={fee.price} onChange={(e) => {
                  const up = [...(localConfig.fees || [])]; if (!up[idx]) up[idx] = { name: fee.name, price: 0 } as any; up[idx].price = parseFloat(e.target.value) || 0; updateConfig({ fees: up });
                }} className="h-8" /></div>
                <div className="p-3"><Button variant="ghost" size="sm" onClick={() => { const up = [...(localConfig.fees || [])]; up.splice(idx, 1); updateConfig({ fees: up }); }}><Trash2 className="h-4 w-4" /></Button></div>
              </div>
            ))}
          </div>
          <Button variant="ghost" size="sm" className="mt-2" onClick={() => updateConfig({ fees: [ ...(localConfig.fees || []), { name: 'New Fee', price: 0 } ] })}>Add Fee</Button>
        </CardContent>
      </Card>

      {/* DTG Extra Charges */}
      <Card>
        <CardHeader>
          <CardTitle>Extra Charges</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-hidden">
            <div className="grid grid-cols-3 gap-0 bg-muted">
              <div className="p-3 font-medium">Name</div>
              <div className="p-3 font-medium">Price</div>
              <div className="p-3 font-medium">Actions</div>
            </div>
            {(localConfig.extraCharges || [ { name: 'Sleeves', price: 0 }, { name: 'Fleece', price: 0 }, { name: 'Over Zipper', price: 0 }, { name: 'Over Pocket', price: 0 }, { name: 'Neck Label', price: 0 }, { name: 'Kids Shirts', price: 0 } ]).map((ch, idx) => (
              <div key={idx} className="grid grid-cols-3 gap-0 border-t">
                <div className="p-3">{ch.name}</div>
                <div className="p-3"><Input type="number" step="0.01" value={ch.price} onChange={(e) => {
                  const up = [...(localConfig.extraCharges || [])]; if (!up[idx]) up[idx] = { name: ch.name, price: 0 } as any; up[idx].price = parseFloat(e.target.value) || 0; updateConfig({ extraCharges: up });
                }} className="h-8" /></div>
                <div className="p-3"><Button variant="ghost" size="sm" onClick={() => { const up = [...(localConfig.extraCharges || [])]; up.splice(idx, 1); updateConfig({ extraCharges: up }); }}><Trash2 className="h-4 w-4" /></Button></div>
              </div>
            ))}
          </div>
          <Button variant="ghost" size="sm" className="mt-2" onClick={() => updateConfig({ extraCharges: [ ...(localConfig.extraCharges || []), { name: 'New Charge', price: 0 } ] })}>Add Charge</Button>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={() => onBack()}>Back</Button>
        <Button onClick={onPersist}>Save Changes</Button>
      </div>
    </div>
  );
}

function GeneralConfig({ config, onBack, onUpdate, onPersist }: {
  config: ImprintMethodConfig;
  onBack: () => void;
  onUpdate: (config: ImprintMethodConfig) => void;
  onPersist: () => void;
}) {
  const [localConfig, setLocalConfig] = useState(config);

  const updateConfig = (updates: Partial<ImprintMethodConfig>) => {
    const updated = { ...localConfig, ...updates };
    setLocalConfig(updated);
    onUpdate(updated);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" onClick={onBack}>← Back</Button>
        <div className="flex items-center gap-3">
          <Settings2 className="h-6 w-6 text-primary" />
          <div>
            <h2 className="text-xl font-semibold">{localConfig.label}</h2>
            <p className="text-sm text-muted-foreground">Configure your {localConfig.label.toLowerCase()} settings</p>
          </div>
          <div className="ml-auto">
            <Switch checked={localConfig.enabled} onCheckedChange={(enabled) => handleToggleEnabled(localConfig.id, enabled)} />
            <Label className="ml-2">Active</Label>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>General Information</CardTitle>
          <CardDescription>Use this method for custom workflows or temporary pricing.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-sm">Method Label</Label>
            <Input value={localConfig.label} onChange={(e) => updateConfig({ label: e.target.value })} />
          </div>
          <div>
            <Label className="text-sm">Notes</Label>
            <Textarea value={localConfig.colorNotes || ''} onChange={(e) => updateConfig({ colorNotes: e.target.value })} placeholder="Any general notes for this imprint method..." />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={() => onBack()}>Back</Button>
        <Button onClick={onPersist}>Save Changes</Button>
      </div>
    </div>
  );
}