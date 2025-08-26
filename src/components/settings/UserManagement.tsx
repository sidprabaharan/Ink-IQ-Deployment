
import React, { useEffect, useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Pencil, Trash, UserPlus, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Form, FormField, FormItem, FormLabel, FormControl, FormDescription } from '@/components/ui/form';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { supabase } from '@/lib/supabase';
import { useOrganization } from '@/context/OrganizationContext';
import { useAuth } from '@/context/AuthContext';

type Member = {
  id: string;
  user_id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
};

const permissionsList = [
  { id: 'super_admin', label: 'Super Admin' },
  { id: 'view_analytics', label: 'Can view analytics and payments/expenses' },
  { id: 'create_payments', label: 'Can create payments/expenses' },
  { id: 'delete_payments', label: 'Can delete payments/expenses' },
  { id: 'create_quotes', label: 'Can create quotes/invoices' },
  { id: 'delete_quotes', label: 'Can delete quotes/invoices' },
  { id: 'create_customers', label: 'Can create customers' },
  { id: 'delete_customers', label: 'Can delete customers' },
  { id: 'view_customer_info', label: 'Can view customer information' },
  { id: 'view_own_quotes', label: 'Can only view the quotes/invoices they own' },
  { id: 'no_view_pricing', label: 'Can not view pricing' },
  { id: 'view_own_customers', label: 'Can only view the customers they\'ve created' },
  { id: 'view_assigned_tasks', label: 'Can only see tasks assigned to them on the Tasks page' },
  { id: 'view_received_messages', label: 'Can only view the messages they\'ve received' },
  { id: 'no_view_tasks', label: 'Can not see any tasks' },
  { id: 'no_view_messages', label: 'Can not see any messages' },
  { id: 'no_view_inquiries', label: 'Can not see any inquiries' },
  { id: 'edit_production_details', label: 'Can edit the production date, estimated time and split an imprint on the Power Scheduler' },
  { id: 'add_quote_imprints', label: 'Can manually add quote/invoice imprints to the Power Scheduler' },
  { id: 'remove_quote_imprints', label: 'Can manually remove quote/invoice imprints from the Power Scheduler' },
];

export function UserManagement() {
  const { organization } = useOrganization();
  const orgId = organization?.org_id || null;
  const { user: currentSupabaseUser } = useAuth();
  const [users, setUsers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [userPermissionsOpen, setUserPermissionsOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [newUser, setNewUser] = useState({ name: '', email: '', role: 'member', active: true });
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const { toast } = useToast();

  const fetchMembers = async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const { data: orgUsers, error } = await supabase
        .from('org_users')
        .select('user_id, role, status')
        .eq('org_id', orgId);
      if (error) throw error;
      const ids = (orgUsers || []).map((r: any) => r.user_id);
      let profiles: any[] = [];
      if (ids.length) {
        const { data: pRows } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', ids);
        profiles = Array.isArray(pRows) ? pRows : [];
      }
      const byId = new Map(profiles.map(p => [p.id, p]));
      const mapped: Member[] = (orgUsers || []).map((r: any) => {
        const prof = byId.get(r.user_id) || {};
        const name = prof.full_name || (prof.email ? prof.email.split('@')[0] : 'User');
        return {
          id: r.user_id,
          user_id: r.user_id,
          name,
          email: prof.email || '',
          role: r.role || 'member',
          active: (r.status || 'active') === 'active',
        };
      });
      setUsers(mapped);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Failed to load users', description: e?.message || 'Error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchMembers(); }, [orgId]);

  const handleAddUser = async () => {
    if (!newUser.email) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Email is required",
      });
      return;
    }
    try {
      const { error } = await supabase.rpc('invite_user_to_org', {
        invitee_email: newUser.email,
        invitee_role: newUser.role,
      });
      if (error) throw error;
      toast({ title: 'Invite sent', description: `${newUser.email} invited as ${newUser.role}` });
      setIsAddOpen(false);
      setNewUser({ name: '', email: '', role: 'member', active: true });
      await fetchMembers();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Invite failed', description: e?.message || 'Error' });
    }
  };

  const handleUpdateUser = async () => {
    if (!currentUser || !orgId) return;
    try {
      const { error } = await supabase
        .from('org_users')
        .update({ role: currentUser.role })
        .eq('org_id', orgId)
        .eq('user_id', currentUser.user_id);
      if (error) throw error;
      toast({ title: 'User updated', description: `${currentUser.email} role updated` });
      setIsEditOpen(false);
      await fetchMembers();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Update failed', description: e?.message || 'Error' });
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (!orgId) return;
    if (!window.confirm('Remove this user from the organization?')) return;
    try {
      const { error } = await supabase.from('org_users').delete().eq('org_id', orgId).eq('user_id', id);
      if (error) throw error;
      setUsers(users.filter(user => user.id !== id));
      toast({ title: 'User removed', description: 'The user was removed from the organization' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Remove failed', description: e?.message || 'Error' });
    }
  };

  const handleEditUser = (user: any) => {
    setCurrentUser(user);
    setIsEditOpen(true);
  };
  
  const openUserPermissions = (user: any) => {
    setCurrentUser(user);
    // In a real application, these would be loaded from the user's saved permissions
    setSelectedPermissions(['super_admin', 'view_analytics']);
    setUserPermissionsOpen(true);
  };

  const handlePermissionChange = (permissionId: string, checked: boolean) => {
    if (checked) {
      setSelectedPermissions([...selectedPermissions, permissionId]);
    } else {
      setSelectedPermissions(selectedPermissions.filter(id => id !== permissionId));
    }
  };

  const savePermissions = () => {
    // Here you would save the permissions to the server
    toast({
      title: "Permissions saved",
      description: `Permissions for ${currentUser?.name} have been updated`,
    });
    setUserPermissionsOpen(false);
  };

  const toggleUserStatus = async (id: string) => {
    const user = users.find(u => u.id === id);
    if (!user || !orgId) return;
    const next = !user.active;
    try {
      const { error } = await supabase
        .from('org_users')
        .update({ status: next ? 'active' : 'inactive' })
        .eq('org_id', orgId)
        .eq('user_id', id);
      if (error) throw error;
      setUsers(users.map(u => u.id === id ? { ...u, active: next } : u));
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Status change failed', description: e?.message || 'Error' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Users & Permissions</h3>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchMembers} disabled={loading} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <UserPlus size={16} /> Add User
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New User</DialogTitle>
              <DialogDescription>
                Create a new user account and set their permissions.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right">Name</Label>
                <Input
                  id="name"
                  value={newUser.name}
                  onChange={(e) => setNewUser({...newUser, name: e.target.value})}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="email" className="text-right">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="role" className="text-right">Role</Label>
                <Select
                  value={newUser.role}
                  onValueChange={(value) => setNewUser({...newUser, role: value})}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="sales">Sales</SelectItem>
                    <SelectItem value="designer">Designer</SelectItem>
                    <SelectItem value="user">Regular User</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="status" className="text-right">Active</Label>
                <Switch
                  id="status"
                  checked={newUser.active}
                  onCheckedChange={(checked) => setNewUser({...newUser, active: checked})}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
              <Button onClick={handleAddUser}>Create User</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
      </div>
      
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => (
            <TableRow key={user.id}>
              <TableCell className="font-medium flex items-center gap-2">
                {user.name}
                {user.role === 'owner' && (
                  <Badge variant="secondary" className="text-xs">Owner</Badge>
                )}
              </TableCell>
              <TableCell>{user.email}</TableCell>
              <TableCell className="capitalize">{user.role}</TableCell>
              <TableCell>
                <Switch 
                  checked={user.active} 
                  onCheckedChange={() => toggleUserStatus(user.id)}
                  disabled={user.role === 'owner'}
                />
              </TableCell>
              <TableCell className="text-right space-x-2">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => handleEditUser(user)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDeleteUser(user.id)}
                  disabled={user.role === 'owner' || user.id === currentSupabaseUser?.id}
                >
                  <Trash className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openUserPermissions(user)}
                  disabled={user.role === 'owner'}
                >
                  Permissions
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update user account information and permissions.
            </DialogDescription>
          </DialogHeader>
          {currentUser && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-name" className="text-right">Name</Label>
                <Input
                  id="edit-name"
                  value={currentUser.name}
                  onChange={(e) => setCurrentUser({...currentUser, name: e.target.value})}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-email" className="text-right">Email</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={currentUser.email}
                  onChange={(e) => setCurrentUser({...currentUser, email: e.target.value})}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-role" className="text-right">Role</Label>
                <Select
                  value={currentUser.role}
                  onValueChange={(value) => setCurrentUser({...currentUser, role: value})}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="sales">Sales</SelectItem>
                    <SelectItem value="designer">Designer</SelectItem>
                    <SelectItem value="user">Regular User</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-status" className="text-right">Active</Label>
                <Switch
                  id="edit-status"
                  checked={currentUser.active}
                  onCheckedChange={(checked) => setCurrentUser({...currentUser, active: checked})}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</Button>
            <Button onClick={handleUpdateUser}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={userPermissionsOpen} onOpenChange={setUserPermissionsOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>User Permissions</DialogTitle>
            <DialogDescription>
              Set permissions for {currentUser?.name}
            </DialogDescription>
          </DialogHeader>
          {currentUser && (
            <div className="py-4">
              <div className="flex items-center space-x-4 mb-6 pb-4 border-b">
                <Avatar className="h-12 w-12 bg-primary/10">
                  <AvatarFallback className="text-lg">
                    {currentUser.name.split(' ').map((n: string) => n[0]).join('')}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-medium text-lg">{currentUser.name}</h3>
                  <p className="text-sm text-muted-foreground">{currentUser.email}</p>
                </div>
              </div>
              
              <div className="space-y-3">
                {permissionsList.map((permission) => (
                  <div key={permission.id} className="flex items-start space-x-2">
                    <Checkbox 
                      id={permission.id}
                      checked={selectedPermissions.includes(permission.id)}
                      onCheckedChange={(checked) => 
                        handlePermissionChange(permission.id, checked as boolean)
                      }
                    />
                    <label 
                      htmlFor={permission.id}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      {permission.label}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setUserPermissionsOpen(false)}>Cancel</Button>
            <Button onClick={savePermissions}>Save Permissions</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
