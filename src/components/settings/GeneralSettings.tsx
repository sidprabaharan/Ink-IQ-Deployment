import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Settings, Bell, Lock, Globe, Moon, Sun, Monitor } from 'lucide-react';
import { useOrganization } from '@/context/OrganizationContext';

export function GeneralSettings() {
  const { toast } = useToast();
  const { organization, updateOrganizationSettings } = useOrganization();

  const initial = useMemo(() => {
    const g = (organization?.org_settings as any)?.general || {};
    return {
      dateFormat: g.dateFormat || 'MM/DD/YYYY',
      timeFormat: g.timeFormat || '12h',
      timezone: g.timezone || 'America/New_York',
      language: g.language || 'en',
      theme: g.theme || 'system',
      emailNotifications: g.emailNotifications ?? true,
      browserNotifications: g.browserNotifications ?? false,
      saveLoginInfo: g.saveLoginInfo ?? true,
      twoFactorAuth: g.twoFactorAuth ?? false,
    };
  }, [organization?.org_id]);

  const [settings, setSettings] = useState(initial);

  useEffect(() => { setSettings(initial); }, [initial]);

  const handleSaveSettings = async () => {
    const res = await updateOrganizationSettings({ general: settings });
    if (res.success) {
      toast({ title: 'Settings Saved', description: 'Your settings have been updated successfully.' });
    } else {
      toast({ variant: 'destructive', title: 'Save failed', description: res.error || 'Please try again.' });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">General Settings</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Configure general application settings and preferences
        </p>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Settings className="h-4 w-4" />
            System Preferences
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date-format">Date Format</Label>
                <Select 
                  value={settings.dateFormat} 
                  onValueChange={(value) => setSettings({...settings, dateFormat: value})}
                >
                  <SelectTrigger id="date-format">
                    <SelectValue placeholder="Select date format" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                    <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                    <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="time-format">Time Format</Label>
                <Select 
                  value={settings.timeFormat} 
                  onValueChange={(value) => setSettings({...settings, timeFormat: value})}
                >
                  <SelectTrigger id="time-format">
                    <SelectValue placeholder="Select time format" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="12h">12-hour (AM/PM)</SelectItem>
                    <SelectItem value="24h">24-hour</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="timezone">Timezone</Label>
                <Select 
                  value={settings.timezone} 
                  onValueChange={(value) => setSettings({...settings, timezone: value})}
                >
                  <SelectTrigger id="timezone">
                    <SelectValue placeholder="Select timezone" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="America/New_York">Eastern Time (ET)</SelectItem>
                    <SelectItem value="America/Chicago">Central Time (CT)</SelectItem>
                    <SelectItem value="America/Denver">Mountain Time (MT)</SelectItem>
                    <SelectItem value="America/Los_Angeles">Pacific Time (PT)</SelectItem>
                    <SelectItem value="Europe/London">Greenwich Mean Time (GMT)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="language">Language</Label>
                <Select 
                  value={settings.language} 
                  onValueChange={(value) => setSettings({...settings, language: value})}
                >
                  <SelectTrigger id="language">
                    <SelectValue placeholder="Select language" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="es">Español</SelectItem>
                    <SelectItem value="fr">Français</SelectItem>
                    <SelectItem value="de">Deutsch</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Theme</Label>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  type="button"
                  variant={settings.theme === 'light' ? 'default' : 'outline'}
                  className="gap-2 justify-center"
                  onClick={() => setSettings({...settings, theme: 'light'})}
                >
                  <Sun className="h-4 w-4" />
                  Light
                </Button>
                <Button
                  type="button"
                  variant={settings.theme === 'dark' ? 'default' : 'outline'}
                  className="gap-2 justify-center"
                  onClick={() => setSettings({...settings, theme: 'dark'})}
                >
                  <Moon className="h-4 w-4" />
                  Dark
                </Button>
                <Button
                  type="button"
                  variant={settings.theme === 'system' ? 'default' : 'outline'}
                  className="gap-2 justify-center"
                  onClick={() => setSettings({...settings, theme: 'system'})}
                >
                  <Monitor className="h-4 w-4" />
                  System
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Notifications
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Email Notifications</p>
                <p className="text-sm text-muted-foreground">Receive important updates via email</p>
              </div>
              <Switch 
                checked={settings.emailNotifications}
                onCheckedChange={(checked) => setSettings({...settings, emailNotifications: checked})}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Browser Notifications</p>
                <p className="text-sm text-muted-foreground">Show desktop notifications</p>
              </div>
              <Switch 
                checked={settings.browserNotifications}
                onCheckedChange={(checked) => setSettings({...settings, browserNotifications: checked})}
              />
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Lock className="h-4 w-4" />
            Security Settings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Save Login Information</p>
                <p className="text-sm text-muted-foreground">Remember your login session</p>
              </div>
              <Switch 
                checked={settings.saveLoginInfo}
                onCheckedChange={(checked) => setSettings({...settings, saveLoginInfo: checked})}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Two-Factor Authentication</p>
                <p className="text-sm text-muted-foreground">Add an extra layer of security</p>
              </div>
              <Switch 
                checked={settings.twoFactorAuth}
                onCheckedChange={(checked) => setSettings({...settings, twoFactorAuth: checked})}
              />
            </div>
            <Button variant="outline" className="w-full">Change Password</Button>
          </div>
        </CardContent>
      </Card>
      
      <Button onClick={handleSaveSettings} className="w-full">Save Settings</Button>
    </div>
  );
}
