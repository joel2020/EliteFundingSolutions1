'use client';

import { useEffect, useState } from 'react';
import { CrmTopbar } from '@/components/crm/topbar';
import { supabase, DEFAULT_ORG_ID } from '@/lib/supabase';
import { Plus, MoreVertical, Mail, Shield, UserCheck, UserX } from 'lucide-react';
import type { UserProfile } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';

const roleConfig: Record<string, { label: string; color: string }> = {
  super_admin: { label: 'Super Admin', color: 'bg-purple-100 text-purple-700' },
  admin: { label: 'Admin', color: 'bg-blue-100 text-blue-700' },
  manager: { label: 'Manager', color: 'bg-green-100 text-green-700' },
  sales_rep: { label: 'Sales Rep', color: 'bg-yellow-100 text-yellow-700' },
  underwriter: { label: 'Underwriter', color: 'bg-orange-100 text-orange-700' },
  processor: { label: 'Processor', color: 'bg-pink-100 text-pink-700' },
  iso_broker: { label: 'ISO/Broker', color: 'bg-indigo-100 text-indigo-700' },
  client: { label: 'Client', color: 'bg-gray-100 text-gray-700' },
  viewer: { label: 'Viewer', color: 'bg-slate-100 text-slate-700' },
};

export default function UsersPage() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('sales_rep');
  const [inviteFirstName, setInviteFirstName] = useState('');
  const [inviteLastName, setInviteLastName] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('organization_id', DEFAULT_ORG_ID)
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Failed to load users');
      console.error(error);
    } else if (data) {
      setUsers(data as UserProfile[]);
    }
    setLoading(false);
  };

  const handleInvite = async () => {
    if (!inviteEmail || !inviteFirstName || !inviteLastName) {
      toast.error('Please fill in all required fields');
      return;
    }

    setSending(true);

    const { error } = await supabase.from('user_profiles').insert({
      organization_id: DEFAULT_ORG_ID,
      email: inviteEmail,
      first_name: inviteFirstName,
      last_name: inviteLastName,
      role: inviteRole,
      is_active: false,
    });

    if (error) {
      toast.error('Failed to send invitation');
      console.error(error);
    } else {
      toast.success(`Invitation sent to ${inviteEmail}`);
      setShowInviteDialog(false);
      setInviteEmail('');
      setInviteFirstName('');
      setInviteLastName('');
      setInviteRole('sales_rep');
      loadUsers();
    }

    setSending(false);
  };

  const toggleUserStatus = async (userId: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from('user_profiles')
      .update({ is_active: !currentStatus })
      .eq('id', userId);

    if (error) {
      toast.error('Failed to update user status');
    } else {
      toast.success(`User ${!currentStatus ? 'activated' : 'deactivated'}`);
      loadUsers();
    }
  };

  const updateUserRole = async (userId: string, newRole: string) => {
    const { error } = await supabase
      .from('user_profiles')
      .update({ role: newRole })
      .eq('id', userId);

    if (error) {
      toast.error('Failed to update role');
    } else {
      toast.success('Role updated successfully');
      loadUsers();
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <CrmTopbar
        title="Users"
        subtitle={`${users.length} team members`}
        actions={
          <Button onClick={() => setShowInviteDialog(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Invite User
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="bg-white border border-[#E4E4E7] rounded-[16px] overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-[#F4F4F5]">
                {['Name', 'Email', 'Role', 'Status', 'Last Login', 'Actions'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-[12px] font-semibold uppercase tracking-[0.04em] text-[#71717A]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-[#A1A1AA]">Loading…</td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-[#A1A1AA]">No users found</td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="border-b border-[#F4F4F5] hover:bg-[#FAFAFA]">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold">
                          {user.first_name[0]}{user.last_name[0]}
                        </div>
                        <div>
                          <div className="font-medium text-[#09090B]">
                            {user.first_name} {user.last_name}
                          </div>
                          {user.title && (
                            <div className="text-xs text-[#71717A]">{user.title}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <a href={`mailto:${user.email}`} className="text-[#2563EB] hover:underline flex items-center gap-1">
                        <Mail className="w-3 h-3" />
                        {user.email}
                      </a>
                    </td>
                    <td className="px-4 py-3">
                      <Select value={user.role} onValueChange={(v) => updateUserRole(user.id, v)}>
                        <SelectTrigger className="w-[140px] h-8">
                          <Badge className={roleConfig[user.role]?.color || 'bg-gray-100'}>
                            <Shield className="w-3 h-3 mr-1" />
                            {roleConfig[user.role]?.label || user.role}
                          </Badge>
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(roleConfig).map(([key, config]) => (
                            <SelectItem key={key} value={key}>{config.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-4 py-3">
                      {user.is_active ? (
                        <Badge className="bg-green-100 text-green-700">
                          <UserCheck className="w-3 h-3 mr-1" />
                          Active
                        </Badge>
                      ) : (
                        <Badge className="bg-gray-100 text-gray-700">
                          <UserX className="w-3 h-3 mr-1" />
                          Inactive
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[#52525B] text-sm">
                      {user.last_login_at 
                        ? new Date(user.last_login_at).toLocaleDateString('en-US', { 
                            month: 'short', 
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit'
                          })
                        : 'Never'}
                    </td>
                    <td className="px-4 py-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => toggleUserStatus(user.id, user.is_active)}>
                            {user.is_active ? (
                              <>
                                <UserX className="w-4 h-4 mr-2" />
                                Deactivate
                              </>
                            ) : (
                              <>
                                <UserCheck className="w-4 h-4 mr-2" />
                                Activate
                              </>
                            )}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invite User Dialog */}
      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite Team Member</DialogTitle>
            <DialogDescription>
              Send an invitation to join your organization
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="first_name">First Name *</Label>
                <Input
                  id="first_name"
                  value={inviteFirstName}
                  onChange={(e) => setInviteFirstName(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="last_name">Last Name *</Label>
                <Input
                  id="last_name"
                  value={inviteLastName}
                  onChange={(e) => setInviteLastName(e.target.value)}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="email">Email Address *</Label>
              <Input
                id="email"
                type="email"
                placeholder="user@company.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="role">Role</Label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(roleConfig).map(([key, config]) => (
                    <SelectItem key={key} value={key}>{config.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInviteDialog(false)}>Cancel</Button>
            <Button onClick={handleInvite} disabled={sending}>
              {sending ? 'Sending...' : 'Send Invitation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
