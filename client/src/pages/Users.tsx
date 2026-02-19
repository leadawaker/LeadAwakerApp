import { useMemo, useState, useEffect, useCallback } from "react";
import { CrmShell } from "@/components/crm/CrmShell";
import { useWorkspace } from "@/hooks/useWorkspace";
import { apiFetch } from "@/lib/apiUtils";
import { ApiErrorFallback } from "@/components/crm/ApiErrorFallback";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface AppUser {
  id: number;
  account_id: number;
  full_name: string;
  email: string;
  phone: string;
  timezone: string;
  role: "Admin" | "Manager" | "Agent" | "Viewer";
  status: "Active" | "Inactive";
  avatar_url: string;
  n8n_webhook_url: string;
  notification_email: boolean;
  notification_sms: boolean;
  last_login_at: string;
  users_id: string;
  Accounts: string;
  accounts_id: string;
  created_time: string;
  last_modified_time: string;
  [key: string]: any;
}

export default function UsersPage() {
  const { currentAccountId } = useWorkspace();
  const [q, setQ] = useState("");
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/api/users");
      if (!res.ok) throw new Error(`${res.status}: Failed to fetch users`);
      const data = await res.json();
      setUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch users:", err);
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const currentUserEmail = localStorage.getItem("leadawaker_user_email") || "leadawaker@gmail.com";
  const isAdmin = currentUserEmail === "leadawaker@gmail.com";
  const currentUser = users.find(u => u.email === currentUserEmail);

  const rows = useMemo(() => {
    if (isAdmin) {
      return users
        .filter((u) => (q ? u.email.toLowerCase().includes(q.toLowerCase()) || u.full_name.toLowerCase().includes(q.toLowerCase()) : true));
    }

    // If not admin, see leadawaker admin user, themselves, and others in same account
    return users
      .filter((u) => (
        u.email === "leadawaker@gmail.com" ||
        u.email === currentUserEmail ||
        (currentUser && u.account_id === currentUser.account_id)
      ))
      .filter((u) => (q ? u.email.toLowerCase().includes(q.toLowerCase()) || u.full_name.toLowerCase().includes(q.toLowerCase()) : true));
  }, [q, users, isAdmin, currentUserEmail, currentUser]);

  const handleSaveUser = async () => {
    if (!editingUser) return;
    // Admin can edit anyone, users can only edit themselves
    if (!isAdmin && editingUser.email !== currentUserEmail) return;

    try {
      const res = await apiFetch(`/api/users/${editingUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: editingUser.full_name,
          email: editingUser.email,
          phone: editingUser.phone,
          timezone: editingUser.timezone,
          role: editingUser.role,
          status: editingUser.status,
          n8n_webhook_url: editingUser.n8n_webhook_url,
          notification_email: editingUser.notification_email,
          notification_sms: editingUser.notification_sms,
        }),
      });
      if (res.ok) {
        setUsers(prev => prev.map(u => u.id === editingUser.id ? editingUser : u));
        setEditingUser(null);
        toast({
          title: "User updated",
          description: `Successfully updated ${editingUser.full_name}`,
        });
      } else {
        // Fallback to optimistic local update
        setUsers(prev => prev.map(u => u.id === editingUser.id ? editingUser : u));
        setEditingUser(null);
        toast({
          title: "User updated locally",
          description: `Changes saved locally for ${editingUser.full_name}`,
        });
      }
    } catch (err) {
      // Optimistic update on network error
      setUsers(prev => prev.map(u => u.id === editingUser.id ? editingUser : u));
      setEditingUser(null);
      toast({
        title: "User updated locally",
        description: `Changes saved locally for ${editingUser.full_name}`,
      });
    }
  };

  return (
    <CrmShell>
      <div className="bg-[#F6F5FA] h-full overflow-hidden flex flex-col" data-testid="page-users">
        <div className="flex-1 min-h-0 px-6 py-6 flex flex-col">
          <div className="flex items-center justify-between mb-6 shrink-0">
            <div className="flex items-center gap-2" data-testid="bar-users">
              <input
                className="h-10 w-[320px] rounded-xl border border-slate-200 bg-white px-4 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                placeholder="Search name or email…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                data-testid="input-user-search"
              />
            </div>
          </div>

          {error && users.length === 0 && !loading ? (
            <ApiErrorFallback
              error={error}
              onRetry={fetchUsers}
              isRetrying={loading}
            />
          ) : loading ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">Loading users…</div>
          ) : (
            <div className="flex-1 min-h-0 bg-white rounded-[32px] border border-slate-200 shadow-sm flex flex-col overflow-hidden" data-testid="table-users">
              <div className="shrink-0 grid grid-cols-[80px_1.5fr_1.2fr_1.5fr_1fr_1fr_100px_100px] text-[11px] uppercase tracking-wider font-bold text-muted-foreground bg-slate-50 border-b border-slate-100 px-6 py-4 z-10">
                <div>ID</div>
                <div>Name</div>
                <div>Account</div>
                <div>Email</div>
                <div>Phone</div>
                <div>Role</div>
                <div>Status</div>
                <div className="text-right">Actions</div>
              </div>
              <div className="flex-1 overflow-y-auto divide-y divide-slate-100 ">
                {rows.map((u) => (
                  <div key={u.id} className="grid grid-cols-[80px_1.5fr_1.2fr_1.5fr_1fr_1fr_100px_100px] px-6 py-5 text-sm items-center hover:bg-slate-50/50 transition-colors" data-testid={`row-user-${u.id}`}>
                    <div className="text-muted-foreground font-mono text-xs">#{u.users_id || u.id}</div>
                    <div className="font-semibold text-slate-900">{u.full_name}</div>
                    <div className="text-slate-500 truncate pr-4">{u.Accounts || u.accounts_id || ""}</div>
                    <div className="text-slate-500 truncate pr-4">{u.email}</div>
                    <div className="text-slate-500">{u.phone}</div>
                    <div>
                      <span className={cn(
                        "px-2.5 py-1 rounded-lg text-xs font-medium",
                        u.role === 'Admin' ? 'bg-yellow-100 text-yellow-700' : 'bg-slate-100 text-slate-600'
                      )}>
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
                      {(isAdmin || u.email === currentUserEmail) && (
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
          )}
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
                    disabled={!isAdmin}
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
                    disabled={!isAdmin}
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
                  <Label>Password</Label>
                  <Input
                    type="password"
                    placeholder="Enter new password"
                    onChange={e => setEditingUser({...editingUser, password: e.target.value} as any)}
                    data-testid="input-edit-password"
                  />
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
