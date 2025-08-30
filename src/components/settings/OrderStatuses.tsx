
import React, { useEffect, useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useOrganization } from '@/context/OrganizationContext';
import { CircleCheck, PlusCircle, GripVertical, Pencil, Trash } from 'lucide-react';

// Local fallback if org settings not yet loaded
const initialStatuses = [
  { id: 1, name: 'New', color: '#3498db', active: true },
  { id: 2, name: 'Processing', color: '#f39c12', active: true },
  { id: 3, name: 'Artwork Ready', color: '#27ae60', active: true },
  { id: 4, name: 'Production', color: '#8e44ad', active: true },
  { id: 5, name: 'Shipping', color: '#16a085', active: true },
  { id: 6, name: 'Completed', color: '#2ecc71', active: true },
  { id: 7, name: 'Cancelled', color: '#e74c3c', active: true },
  { id: 8, name: 'On Hold', color: '#95a5a6', active: false },
];

export function OrderStatuses() {
  const { organization, updateOrganizationSettings } = useOrganization();
  const [statuses, setStatuses] = useState(initialStatuses);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<any>(null);
  const [newStatus, setNewStatus] = useState({ name: '', color: '#3498db', active: true });
  const { toast } = useToast();

  // Load from org settings if available
  useEffect(() => {
    try {
      const fromSettings = (organization?.org_settings as any)?.orderStatuses as Array<{ id?: number; name: string; color: string; active?: boolean }> | undefined;
      if (Array.isArray(fromSettings) && fromSettings.length) {
        // Ensure IDs
        const withIds = fromSettings.map((s, idx) => ({ id: s.id || idx + 1, name: s.name, color: s.color || '#3498db', active: s.active !== false }));
        setStatuses(withIds);
      }
    } catch {}
  }, [organization?.org_settings]);

  const persist = async (next: typeof statuses) => {
    await updateOrganizationSettings({ orderStatuses: next.map(s => ({ id: s.id, name: s.name, color: s.color, active: s.active })) });
  };

  const handleAddStatus = () => {
    if (!newStatus.name) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Status name is required",
      });
      return;
    }

    const id = Math.max(0, ...statuses.map(s => s.id)) + 1;
    const next = [...statuses, { ...newStatus, id }];
    setStatuses(next);
    persist(next);
    setNewStatus({ name: '', color: '#3498db', active: true });
    setIsAddOpen(false);
    
    toast({
      title: "Status added",
      description: `${newStatus.name} status has been added successfully`,
    });
  };

  const handleUpdateStatus = () => {
    if (!currentStatus) return;
    
    const next = statuses.map(status => 
      status.id === currentStatus.id ? currentStatus : status
    );
    setStatuses(next);
    persist(next);
    setIsEditOpen(false);
    
    toast({
      title: "Status updated",
      description: `${currentStatus.name} status has been updated`,
    });
  };

  const handleDeleteStatus = (id: number) => {
    if (window.confirm('Are you sure you want to delete this status?')) {
      const status = statuses.find(s => s.id === id);
      const next = statuses.filter(status => status.id !== id);
      setStatuses(next);
      persist(next);
      
      toast({
        title: "Status deleted",
        description: `${status?.name} status has been removed`,
      });
    }
  };

  const handleEditStatus = (status: any) => {
    setCurrentStatus(status);
    setIsEditOpen(true);
  };

  const toggleStatusActive = (id: number) => {
    const next = statuses.map(status => 
      status.id === id ? { ...status, active: !status.active } : status
    );
    setStatuses(next);
    persist(next);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Order Statuses</h3>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <PlusCircle size={16} /> Add Status
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Status</DialogTitle>
              <DialogDescription>
                Create a new order status for your workflow.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="status-name" className="text-right">Name</Label>
                <Input
                  id="status-name"
                  value={newStatus.name}
                  onChange={(e) => setNewStatus({...newStatus, name: e.target.value})}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="status-color" className="text-right">Color</Label>
                <div className="col-span-3 flex gap-2 items-center">
                  <Input
                    id="status-color"
                    type="color"
                    value={newStatus.color}
                    onChange={(e) => setNewStatus({...newStatus, color: e.target.value})}
                    className="w-16 h-8 p-1"
                  />
                  <span className="text-sm">
                    Selected color: {newStatus.color}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="status-active" className="text-right">Active</Label>
                <Switch
                  id="status-active"
                  checked={newStatus.active}
                  onCheckedChange={(checked) => setNewStatus({...newStatus, active: checked})}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
              <Button onClick={handleAddStatus}>Create Status</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      
      <p className="text-sm text-muted-foreground">
        Drag and drop statuses to reorder them. Inactive statuses will not appear in order status dropdowns.
      </p>
      
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[40px]"></TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Color</TableHead>
            <TableHead>Active</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {statuses.map((status) => (
            <TableRow key={status.id}>
              <TableCell>
                <GripVertical className="h-4 w-4 text-muted-foreground cursor-move" />
              </TableCell>
              <TableCell className="font-medium">
                <div className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: status.color }}
                  ></div>
                  {status.name}
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <div 
                    className="w-6 h-6 rounded" 
                    style={{ backgroundColor: status.color }}
                  ></div>
                  <code className="text-xs bg-gray-100 px-2 py-1 rounded">{status.color}</code>
                </div>
              </TableCell>
              <TableCell>
                <Switch 
                  checked={status.active} 
                  onCheckedChange={() => toggleStatusActive(status.id)}
                />
              </TableCell>
              <TableCell className="text-right space-x-2">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => handleEditStatus(status)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDeleteStatus(status.id)}
                >
                  <Trash className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Status</DialogTitle>
            <DialogDescription>
              Update the order status properties.
            </DialogDescription>
          </DialogHeader>
          {currentStatus && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-status-name" className="text-right">Name</Label>
                <Input
                  id="edit-status-name"
                  value={currentStatus.name}
                  onChange={(e) => setCurrentStatus({...currentStatus, name: e.target.value})}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-status-color" className="text-right">Color</Label>
                <div className="col-span-3 flex gap-2 items-center">
                  <Input
                    id="edit-status-color"
                    type="color"
                    value={currentStatus.color}
                    onChange={(e) => setCurrentStatus({...currentStatus, color: e.target.value})}
                    className="w-16 h-8 p-1"
                  />
                  <span className="text-sm">
                    Selected color: {currentStatus.color}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-status-active" className="text-right">Active</Label>
                <Switch
                  id="edit-status-active"
                  checked={currentStatus.active}
                  onCheckedChange={(checked) => setCurrentStatus({...currentStatus, active: checked})}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</Button>
            <Button onClick={handleUpdateStatus}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
