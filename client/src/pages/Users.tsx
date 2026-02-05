import { useMemo, useState } from "react";
import { CrmShell } from "@/components/crm/CrmShell";
import { useWorkspace } from "@/hooks/useWorkspace";
import { users as initialUsers, AppUser } from "@/data/mocks";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export default function UsersPage() {
  const { currentAccountId } = useWorkspace();
  const [q, setQ] = useState("");
  const [users, setUsers] = useState<AppUser[]>(initialUsers);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);

  const currentUserEmail = localStorage.getItem("leadawaker_user_email") || "leadawaker@gmail.com";
  const isAdmin = currentUserEmail === "leadawaker@gmail.com";

  const rows = useMemo(() => {
    // Admins see everything in the current account, others only themselves? 
    // Request says: "Only the admin, leadawaker@gmail.com has the power to switch accounts... only see their own"
    // So if not admin, we should probably filter by email too if we want true "only see their own"
    return users
      .filter((u) => u.account_id === currentAccountId)
      .filter((u) => (q ? u.email.toLowerCase().includes(q.toLowerCase()) || u.full_name.toLowerCase().includes(q.toLowerCase()) : true))
      .filter((u) => isAdmin || u.email === currentUserEmail);
  }, [currentAccountId, q, users, isAdmin, currentUserEmail]);

  const handleSaveUser = () => {
    if (!editingUser || !isAdmin) return;
    setUsers(prev => prev.map(u => u.id === editingUser.id ? editingUser : u));
    setEditingUser(null);
    toast({
      title: "User updated",
      description: `Successfully updated ${editingUser.full_name}`,
    });
  };

  return (
    <CrmShell>
      <div className="bg-[#F6F5FA] min-h-full p-8" data-testid="page-users">
        <div className="max-w-[1200px] mx-auto">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Users</h1>
            <div className="flex items-center gap-2" data-testid="bar-users">
              <input
                className="h-11 w-[320px] rounded-xl border border-slate-200 bg-white px-4 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                placeholder="Search name or email…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                data-testid="input-user-search"
              />
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden" data-testid="table-users">
            <div className="grid grid-cols-[80px_1.5fr_1.5fr_1.2fr_1fr_1fr_100px_100px] text-[11px] uppercase tracking-wider font-bold text-muted-foreground bg-slate-50 border-b border-slate-100 px-6 py-4">
              <div>ID</div>
              <div>Name</div>
              <div>Email</div>
              <div>Account</div>
              <div>Phone</div>
              <div>Role</div>
              <div>Status</div>
              <div className="text-right">Actions</div>
            </div>
            <div className="divide-y divide-slate-100">
              {rows.map((u) => (
                <div key={u.id} className="grid grid-cols-[80px_1.5fr_1.5fr_1.2fr_1fr_1fr_100px_100px] px-6 py-5 text-sm items-center hover:bg-slate-50/50 transition-colors" data-testid={`row-user-${u.id}`}>
                  <div className="text-muted-foreground font-mono text-xs">#{u.users_id}</div>
                  <div className="font-semibold text-slate-900">{u.full_name}</div>
                  <div className="text-slate-500 truncate pr-4">{u.email}</div>
                  <div className="text-slate-500">{u.Accounts}</div>
                  <div className="text-slate-500">{u.phone}</div>
                  <div>
                    <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 text-xs font-medium">
                      {u.role}
                    </span>
                  </div>
                  <div data-testid={`text-user-status-${u.id}`}>
                    <span className={cn(
                      "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase",
                      u.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                    )}>
                      {u.status}
                    </span>
                  </div>
                  <div className="text-right">
                    {isAdmin && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-8 rounded-lg hover:bg-slate-100"
                        onClick={() => setEditingUser(u)}
                        data-testid={`button-edit-user-${u.id}`}
                      >
                        Edit
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit User: {editingUser?.full_name}</DialogTitle>
            </DialogHeader>
            
            {editingUser && (
              <div className="grid grid-cols-2 gap-4 py-4">
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <Input 
                    value={editingUser.full_name} 
                    onChange={e => setEditingUser({...editingUser, full_name: e.target.value})}
                    data-testid="input-edit-full-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input 
                    value={editingUser.email} 
                    onChange={e => setEditingUser({...editingUser, email: e.target.value})}
                    data-testid="input-edit-email"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input 
                    value={editingUser.phone} 
                    onChange={e => setEditingUser({...editingUser, phone: e.target.value})}
                    data-testid="input-edit-phone"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Timezone</Label>
                  <Input 
                    value={editingUser.timezone} 
                    onChange={e => setEditingUser({...editingUser, timezone: e.target.value})}
                    data-testid="input-edit-timezone"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select 
                    value={editingUser.role} 
                    onValueChange={(val: any) => setEditingUser({...editingUser, role: val})}
                  >
                    <SelectTrigger data-testid="select-edit-role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Admin">Admin</SelectItem>
                      <SelectItem value="Manager">Manager</SelectItem>
                      <SelectItem value="Agent">Agent</SelectItem>
                      <SelectItem value="Viewer">Viewer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select 
                    value={editingUser.status} 
                    onValueChange={(val: any) => setEditingUser({...editingUser, status: val})}
                  >
                    <SelectTrigger data-testid="select-edit-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="Inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>n8n Webhook URL</Label>
                  <Input 
                    value={editingUser.n8n_webhook_url} 
                    onChange={e => setEditingUser({...editingUser, n8n_webhook_url: e.target.value})}
                    data-testid="input-edit-webhook"
                  />
                </div>
                <div className="space-y-2 flex flex-col justify-end gap-4">
                  <div className="flex items-center justify-between">
                    <Label>Email Notifications</Label>
                    <Switch 
                      checked={editingUser.notification_email} 
                      onCheckedChange={checked => setEditingUser({...editingUser, notification_email: checked})}
                      data-testid="switch-edit-email-notif"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>SMS Notifications</Label>
                    <Switch 
                      checked={editingUser.notification_sms} 
                      onCheckedChange={checked => setEditingUser({...editingUser, notification_sms: checked})}
                      data-testid="switch-edit-sms-notif"
                    />
                  </div>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingUser(null)}>Cancel</Button>
              <Button onClick={handleSaveUser} data-testid="button-save-user">Save Changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </CrmShell>
  );
}
