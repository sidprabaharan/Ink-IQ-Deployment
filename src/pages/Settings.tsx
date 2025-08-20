
import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { 
  Users, Building, ListChecks, CreditCard, Workflow, ClipboardList, 
  Mail, Upload, DownloadCloud, Truck, FileSpreadsheet, 
  Zap, CreditCard as BillingIcon, Settings as SettingsIcon, Package2, Factory, Palette
} from 'lucide-react';

import { UserManagement } from '@/components/settings/UserManagement';
import { CompanyInfo } from '@/components/settings/CompanyInfo';
import { OrderStatuses } from '@/components/settings/OrderStatuses';
import { PaymentIntegration } from '@/components/settings/PaymentIntegration';
import { Automations } from '@/components/settings/Automations';
import { PresetTasks } from '@/components/settings/PresetTasks';
import { EmailIntegration } from '@/components/settings/EmailIntegration';
import { DataManagement } from '@/components/settings/DataManagement';
import { ShippingIntegration } from '@/components/settings/ShippingIntegration';
import { QuickbooksIntegration } from '@/components/settings/QuickbooksIntegration';
import { ZapierIntegration } from '@/components/settings/ZapierIntegration';
import { Billing } from '@/components/settings/Billing';
import { GeneralSettings } from '@/components/settings/GeneralSettings';
import { SupplierIntegrations } from '@/components/settings/SupplierIntegrations';
import { OutsourcingPreferences } from '@/components/settings/OutsourcingPreferences';
import { ProductionSettings } from '@/components/settings/ProductionSettings';
import { ImprintMethodsSettings } from '@/components/settings/ImprintMethodsSettings';
import { useOrganization } from '@/context/OrganizationContext';
 


export default function Settings() {
  const [activeTab, setActiveTab] = useState('users');
  const { organization } = useOrganization();
  const role = (organization?.user_role || '').toLowerCase();
  const isManager = ['production_manager', 'manager', 'admin', 'owner'].includes(role);
  
  const settingsSections = [
    { id: 'users', name: 'User Management', icon: Users, component: UserManagement },
    { id: 'company', name: 'Company Information', icon: Building, component: CompanyInfo },
    { id: 'production', name: 'Production Settings', icon: Factory, component: ProductionSettings },
    { id: 'imprints', name: 'Imprint Methods', icon: Palette, component: ImprintMethodsSettings },
    { id: 'statuses', name: 'Order Statuses', icon: ListChecks, component: OrderStatuses },
    { id: 'payments', name: 'Payment Integration', icon: CreditCard, component: PaymentIntegration },
    { id: 'automations', name: 'Automations', icon: Workflow, component: Automations },
    { id: 'tasks', name: 'Preset Tasks', icon: ClipboardList, component: PresetTasks },
    { id: 'email', name: 'Email Integration', icon: Mail, component: EmailIntegration },
    { id: 'data', name: 'Import/Export Data', icon: DownloadCloud, component: DataManagement },
    { id: 'shipping', name: 'Shipping Integration', icon: Truck, component: ShippingIntegration },
    { id: 'suppliers', name: 'Supplier Integrations', icon: Package2, component: SupplierIntegrations },
    { id: 'outsourcing', name: 'Outsourcing', icon: Workflow, component: () => <OutsourcingPreferences onSave={(prefs) => console.log(prefs)} /> },
    { id: 'quickbooks', name: 'QuickBooks', icon: FileSpreadsheet, component: QuickbooksIntegration },
    { id: 'zapier', name: 'Zapier Integration', icon: Zap, component: ZapierIntegration },
    { id: 'billing', name: 'Billing & Subscription', icon: BillingIcon, component: Billing },
    { id: 'general', name: 'General Settings', icon: SettingsIcon, component: GeneralSettings },
  ];

  

  return (
    <div className="flex-1 p-6 md:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Admin Settings</h1>
      </div>
      
      <div className="flex flex-col md:flex-row gap-6">
        <Card className="w-full md:w-64 shrink-0">
          <CardHeader>
            <CardTitle>Settings</CardTitle>
            <CardDescription>Manage your system settings</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <nav className="flex flex-col space-y-1 p-2">
              {settingsSections.map((section) => (
                <Button
                  key={section.id}
                  variant={activeTab === section.id ? 'secondary' : 'ghost'}
                  className="justify-start"
                  onClick={() => setActiveTab(section.id)}
                >
                  <section.icon className="mr-2 h-4 w-4" />
                  {section.name}
                </Button>
              ))}
            </nav>
          </CardContent>
        </Card>
        
        <div className="flex-1">
          <Card className="w-full">
            <CardHeader>
              <CardTitle>
                {settingsSections.find(s => s.id === activeTab)?.name}
              </CardTitle>
              <CardDescription>
                Manage {settingsSections.find(s => s.id === activeTab)?.name.toLowerCase()}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {settingsSections.map((section) => (
                activeTab === section.id && <section.component key={section.id} />
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
