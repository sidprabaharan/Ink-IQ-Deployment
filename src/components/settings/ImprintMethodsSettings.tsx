import React, { useState } from 'react';
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
}

export function ImprintMethodsSettings() {
  const [configuredMethods, setConfiguredMethods] = useState<ImprintMethodConfig[]>([]);
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newMethodType, setNewMethodType] = useState<string>('');
  const { toast } = useToast();

  const handleAddMethod = () => {
    if (!newMethodType) return;
    
    const methodInfo = imprintMethods.find(m => m.value === newMethodType);
    if (!methodInfo) return;

    const newMethod: ImprintMethodConfig = {
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
  const availableMethods = imprintMethods.filter(method => 
    !configuredMethods.some(config => config.method === method.value)
  );

  if (selectedConfig) {
    return <ScreenPrintingConfig config={selectedConfig} onBack={() => setSelectedMethod(null)} onUpdate={(updated) => {
      setConfiguredMethods(prev => prev.map(m => m.id === updated.id ? updated : m));
    }} />;
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
                        <Button variant="ghost" size="sm">
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
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
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ScreenPrintingConfig({ config, onBack, onUpdate }: { 
  config: ImprintMethodConfig; 
  onBack: () => void;
  onUpdate: (config: ImprintMethodConfig) => void;
}) {
  const [localConfig, setLocalConfig] = useState(config);

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
                <Button variant="outline" size="sm">Add Quantity Range</Button>
                <Button variant="outline" size="sm">Add Color Count</Button>
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
                    <Button variant="ghost" size="sm">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <Button variant="ghost" size="sm" className="mt-2">Add Fee</Button>
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
                    <Button variant="ghost" size="sm">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}