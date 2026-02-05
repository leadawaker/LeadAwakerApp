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

export default function UsersPage() {
  const { currentAccountId } = useWorkspace();
  const [q, setQ] = useState("");
  const [users, setUsers] = useState<AppUser[]>(initialUsers);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);

  const rows = useMemo(() => {
    return users
      .filter((u) => u.account_id === currentAccountId)
      .filter((u) => (q ? u.email.toLowerCase().includes(q.toLowerCase()) || u.full_name.toLowerCase().includes(q.toLowerCase()) : true));
  }, [currentAccountId, q, users]);

  const handleSaveUser = () => {
    if (!editingUser) return;
    setUsers(prev => prev.map(u => u.id === editingUser.id ? editingUser : u));
    setEditingUser(null);
    toast({
      title: "User updated",
      description: `Successfully updated ${editingUser.full_name}`,
    });
  };

  return (
    <CrmShell>
      <div className="bg-white min-h-full" data-testid="page-users">
        <h1 className="text-2xl font-extrabold tracking-tight hidden" data-testid="text-title">Users</h1>

        <div className="flex items-center gap-2" data-testid="bar-users">
          <input
            className="h-10 w-[280px] max-w-full rounded-xl border border-border bg-muted/20 px-3 text-sm"
            placeholder="Search name or email…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            data-testid="input-user-search"
          />
        </div>

        <div className="mt-4 rounded-2xl border border-border bg-background overflow-hidden" data-testid="table-users">
          <div className="grid grid-cols-[1fr_1fr_100px_100px_120px] text-xs font-semibold text-muted-foreground bg-muted/20 border-b border-border px-4 py-3">
            <div>name</div>
            <div>email</div>
            <div>role</div>
            <div>status</div>
            <div>actions</div>
          </div>
          <div className="divide-y divide-border">
            {rows.map((u) => (
              <div key={u.id} className="grid grid-cols-[1fr_1fr_100px_100px_120px] px-4 py-3 text-sm items-center" data-testid={`row-user-${u.id}`}>
                <div className="font-semibold" data-testid={`text-user-name-${u.id}`}>{u.full_name}</div>
                <div className="text-muted-foreground" data-testid={`text-user-email-${u.id}`}>{u.email}</div>
                <div className="text-muted-foreground" data-testid={`text-user-role-${u.id}`}>{u.role}</div>
                <div data-testid={`text-user-status-${u.id}`}>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${u.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                    {u.status}
                  </span>
                </div>
                <div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setEditingUser(u)}
                    data-testid={`button-edit-user-${u.id}`}
                  >
                    Edit
                  </Button>
                </div>
              </div>
            ))}
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
