import { useMemo, useState, useEffect, useCallback } from "react";
import { CrmShell } from "@/components/crm/CrmShell";
import { apiFetch } from "@/lib/apiUtils";
import { ApiErrorFallback } from "@/components/crm/ApiErrorFallback";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { SkeletonTable } from "@/components/ui/skeleton";
import { DataEmptyState } from "@/components/crm/DataEmptyState";
import { UserPlus, Copy, Check, Mail } from "lucide-react";

// API returns camelCase fields from Drizzle ORM
interface AppUser {
  id: number;
  accountsId: number | null;
  fullName1: string | null;
  email: string | null;
  phone: string | null;
  timezone: string | null;
  role: "Admin" | "Manager" | "Agent" | "Viewer" | null;
  status: string | null;
  avatarUrl: string | null;
  n8nWebhookUrl: string | null;
  notificationEmail: boolean | null;
  notificationSms: boolean | null;
  lastLoginAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  ncOrder: string | null;
  preferences: string | null;
  [key: string]: any;
}

interface AccountMap {
  [id: number]: string;
}

const ROLE_STYLES: Record<string, string> = {
  Admin: "bg-brand-yellow/20 text-brand-deep-blue dark:bg-brand-yellow/15 dark:text-brand-yellow",
  Manager: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  Agent: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  Operator: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  Viewer: "bg-muted text-muted-foreground",
};

function getRoleStyle(role: string | null): string {
  if (!role) return "bg-muted text-muted-foreground";
  return ROLE_STYLES[role] ?? "bg-muted text-muted-foreground";
}

function isActive(status: string | null | undefined): boolean {
  if (!status) return false;
  return status.toLowerCase() === "active";
}

export default function UsersPage() {
  const [q, setQ] = useState("");
  const [users, setUsers] = useState<AppUser[]>([]);
  const [accounts, setAccounts] = useState<AccountMap>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);

  // Invite flow state
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("Viewer");
  const [inviteAccountId, setInviteAccountId] = useState<string>("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteResult, setInviteResult] = useState<{ token: string; email: string } | null>(null);
  const [tokenCopied, setTokenCopied] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [usersRes, accountsRes] = await Promise.all([
        apiFetch("/api/users"),
        apiFetch("/api/accounts"),
      ]);
      if (!usersRes.ok) throw new Error(`${usersRes.status}: Failed to fetch users`);
      const userData = await usersRes.json();
      setUsers(Array.isArray(userData) ? userData : []);

      if (accountsRes.ok) {
        const accountsData = await accountsRes.json();
        const map: AccountMap = {};
        if (Array.isArray(accountsData)) {
          accountsData.forEach((a: any) => {
            if (a.id && a.name) map[a.id] = a.name;
          });
        }
        setAccounts(map);
      }
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
  const currentUserRole = localStorage.getItem("leadawaker_user_role") || "Viewer";
  const isAdmin = currentUserRole === "Admin" || currentUserEmail === "leadawaker@gmail.com";

  const rows = useMemo(() => {
    const matchesSearch = (u: AppUser) =>
      !q ||
      (u.email || "").toLowerCase().includes(q.toLowerCase()) ||
      (u.fullName1 || "").toLowerCase().includes(q.toLowerCase());

    return users.filter(matchesSearch);
  }, [q, users]);

  const handleSaveUser = async () => {
    if (!editingUser) return;
    if (!isAdmin && editingUser.email !== currentUserEmail) return;

    try {
      const res = await apiFetch(`/api/users/${editingUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName1: editingUser.fullName1,
          email: editingUser.email,
          phone: editingUser.phone,
          timezone: editingUser.timezone,
          role: editingUser.role,
          status: editingUser.status,
          n8nWebhookUrl: editingUser.n8nWebhookUrl,
          notificationEmail: editingUser.notificationEmail,
          notificationSms: editingUser.notificationSms,
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setUsers(prev => prev.map(u => u.id === editingUser.id ? { ...u, ...updated } : u));
        setEditingUser(null);
        toast({
          title: "User updated",
          description: `Successfully updated ${editingUser.fullName1 || editingUser.email}`,
        });
      } else {
        // Optimistic local update as fallback
        setUsers(prev => prev.map(u => u.id === editingUser.id ? editingUser : u));
        setEditingUser(null);
        toast({
          title: "User updated locally",
          description: `Changes saved locally for ${editingUser.fullName1 || editingUser.email}`,
        });
      }
    } catch (err) {
      // Optimistic update on network error
      setUsers(prev => prev.map(u => u.id === editingUser.id ? editingUser : u));
      setEditingUser(null);
      toast({
        title: "User updated locally",
        description: `Changes saved locally for ${editingUser.fullName1 || editingUser.email}`,
      });
    }
  };

  const handleInviteOpen = () => {
    setInviteEmail("");
    setInviteRole("Viewer");
    setInviteAccountId("");
    setInviteResult(null);
    setTokenCopied(false);
    setInviteOpen(true);
  };

  const handleSendInvite = async () => {
    if (!inviteEmail.trim()) {
      toast({ title: "Email required", description: "Please enter an email address", variant: "destructive" });
      return;
    }
    if (!inviteRole) {
      toast({ title: "Role required", description: "Please select a role", variant: "destructive" });
      return;
    }
    setInviteLoading(true);
    try {
      const body: Record<string, any> = { email: inviteEmail.trim(), role: inviteRole };
      if (inviteAccountId) body.accountsId = Number(inviteAccountId);
      const res = await apiFetch("/api/users/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to send invite");
      }
      // Show success result with invite token
      setInviteResult({ token: data.invite_token, email: inviteEmail.trim() });
      // Add new user to local list
      if (data.user) {
        setUsers(prev => [...prev, data.user]);
      }
      toast({
        title: "Invite sent",
        description: `Invite created for ${inviteEmail.trim()} as ${inviteRole}`,
      });
    } catch (err: any) {
      toast({ title: "Invite failed", description: err.message, variant: "destructive" });
    } finally {
      setInviteLoading(false);
    }
  };

  const handleCopyToken = async () => {
    if (!inviteResult) return;
    await navigator.clipboard.writeText(inviteResult.token).catch(() => {});
    setTokenCopied(true);
    setTimeout(() => setTokenCopied(false), 2000);
  };

  return (
    <CrmShell>
      <div className="h-full overflow-hidden flex flex-col" data-testid="page-users">
        <div className="flex-1 min-h-0 py-4 flex flex-col">
          <div className="flex items-center justify-between mb-6 shrink-0">
            <div className="flex items-center gap-2 w-full md:w-auto" data-testid="bar-users">
              <input
                className="h-10 w-full md:w-[320px] rounded-xl border border-border bg-card px-4 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20 transition-all text-foreground"
                placeholder="Search name or email…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                data-testid="input-user-search"
              />
            </div>
            {isAdmin && (
              <Button
                onClick={handleInviteOpen}
                className="ml-3 gap-2 shrink-0"
                data-testid="button-invite-user"
              >
                <UserPlus className="w-4 h-4" />
                Invite User
              </Button>
            )}
          </div>

          {error && users.length === 0 && !loading ? (
            <ApiErrorFallback
              error={error}
              onRetry={fetchUsers}
              isRetrying={loading}
            />
          ) : loading ? (
            <SkeletonTable rows={6} columns={7} className="flex-1" />
          ) : (
            <div className="flex-1 min-h-0 bg-card rounded-2xl border border-border shadow-sm flex flex-col overflow-hidden" data-testid="table-users">
              <div className="overflow-x-auto flex-1 min-h-0 flex flex-col">
                <div className="shrink-0 grid grid-cols-[80px_1.5fr_1.2fr_1.5fr_1fr_1fr_120px_100px] min-w-[800px] text-[11px] uppercase tracking-wider font-bold text-muted-foreground bg-muted/50 border-b border-border px-6 py-4 z-10">
                  <div>ID</div>
                  <div>Name</div>
                  <div>Account</div>
                  <div>Email</div>
                  <div>Phone</div>
                  <div>Role</div>
                  <div>Status</div>
                  <div className="text-right">Actions</div>
                </div>
                <div className="flex-1 overflow-y-auto divide-y divide-border">
                  {!loading && rows.length === 0 && (
                    <DataEmptyState
                      variant={q ? "search" : "users"}
                      compact
                    />
                  )}
                  {rows.map((u) => (
                    <div
                      key={u.id}
                      className="grid grid-cols-[80px_1.5fr_1.2fr_1.5fr_1fr_1fr_120px_100px] min-w-[800px] px-6 py-5 text-sm items-center hover:bg-muted/50 transition-colors"
                      data-testid={`row-user-${u.id}`}
                    >
                      <div className="text-muted-foreground font-mono text-xs">#{u.id}</div>
                      <div className="font-semibold text-foreground" data-testid={`text-user-name-${u.id}`}>
                        {u.fullName1 || <span className="text-muted-foreground italic text-xs">—</span>}
                      </div>
                      <div className="text-muted-foreground truncate pr-4">
                        {u.accountsId ? (accounts[u.accountsId] || `Account #${u.accountsId}`) : <span className="italic text-xs">—</span>}
                      </div>
                      <div className="text-muted-foreground truncate pr-4">{u.email || <span className="italic text-xs">—</span>}</div>
                      <div className="text-muted-foreground">{u.phone || <span className="italic text-xs">—</span>}</div>
                      <div data-testid={`badge-user-role-${u.id}`}>
                        {u.role ? (
                          <span className={cn(
                            "px-2.5 py-1 rounded-lg text-xs font-medium",
                            getRoleStyle(u.role)
                          )}>
                            {u.role}
                          </span>
                        ) : (
                          <span className="text-muted-foreground italic text-xs">—</span>
                        )}
                      </div>
                      <div data-testid={`text-user-status-${u.id}`}>
                        {u.status ? (
                          <span className={cn(
                            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase",
                            isActive(u.status)
                              ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
                              : "bg-muted text-muted-foreground"
                          )}>
                            <span className={cn(
                              "w-1.5 h-1.5 rounded-full",
                              isActive(u.status) ? "bg-emerald-500" : "bg-muted-foreground"
                            )} />
                            {u.status}
                          </span>
                        ) : (
                          <span className="text-muted-foreground italic text-xs">—</span>
                        )}
                      </div>
                      <div className="text-right">
                        {(isAdmin || u.email === currentUserEmail) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 rounded-lg hover:bg-muted"
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
          )}
        </div>

        {/* ─── Invite User Dialog ─── */}
        <Dialog open={inviteOpen} onOpenChange={(open) => { if (!open) { setInviteOpen(false); setInviteResult(null); } }}>
          <DialogContent className="max-w-md" data-testid="dialog-invite-user">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Mail className="w-5 h-5 text-brand-blue" />
                Invite New User
              </DialogTitle>
              <DialogDescription>
                Send an invite to add a new user to the platform. They will receive a token to set up their account.
              </DialogDescription>
            </DialogHeader>

            {inviteResult ? (
              /* Success state — show invite token */
              <div className="py-4 space-y-4">
                <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 p-4 space-y-2">
                  <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                    ✓ Invite created for {inviteResult.email}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Share this invite token with the user to complete their registration:
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Invite Token</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      readOnly
                      value={inviteResult.token}
                      className="font-mono text-xs bg-muted"
                      data-testid="input-invite-token"
                    />
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={handleCopyToken}
                      data-testid="button-copy-token"
                      title="Copy token"
                    >
                      {tokenCopied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  The invite link has also been logged to the server console (dev mode).
                </p>
              </div>
            ) : (
              /* Form state */
              <div className="py-4 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="invite-email">Email Address *</Label>
                  <Input
                    id="invite-email"
                    type="email"
                    placeholder="user@example.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    data-testid="input-invite-email"
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="invite-role">Role *</Label>
                  <Select value={inviteRole} onValueChange={setInviteRole}>
                    <SelectTrigger id="invite-role" data-testid="select-invite-role">
                      <SelectValue placeholder="Select role…" />
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
                  <Label htmlFor="invite-account">Account (optional)</Label>
                  <Select value={inviteAccountId} onValueChange={setInviteAccountId}>
                    <SelectTrigger id="invite-account" data-testid="select-invite-account">
                      <SelectValue placeholder="No account assigned" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">No account</SelectItem>
                      {Object.entries(accounts).map(([id, name]) => (
                        <SelectItem key={id} value={id}>{name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => { setInviteOpen(false); setInviteResult(null); }}>
                {inviteResult ? "Close" : "Cancel"}
              </Button>
              {!inviteResult && (
                <Button
                  onClick={handleSendInvite}
                  disabled={inviteLoading || !inviteEmail.trim() || !inviteRole}
                  data-testid="button-send-invite"
                >
                  {inviteLoading ? "Sending…" : "Send Invite"}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit User: {editingUser?.fullName1 || editingUser?.email}</DialogTitle>
            </DialogHeader>

            {editingUser && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <Input
                    value={editingUser.fullName1 || ""}
                    onChange={e => setEditingUser({...editingUser, fullName1: e.target.value})}
                    data-testid="input-edit-full-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    value={editingUser.email || ""}
                    onChange={e => setEditingUser({...editingUser, email: e.target.value})}
                    data-testid="input-edit-email"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input
                    value={editingUser.phone || ""}
                    onChange={e => setEditingUser({...editingUser, phone: e.target.value})}
                    data-testid="input-edit-phone"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Timezone</Label>
                  <Input
                    value={editingUser.timezone || ""}
                    onChange={e => setEditingUser({...editingUser, timezone: e.target.value})}
                    data-testid="input-edit-timezone"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select
                    value={editingUser.role || ""}
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
                    value={editingUser.status || ""}
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
                    value={editingUser.n8nWebhookUrl || ""}
                    onChange={e => setEditingUser({...editingUser, n8nWebhookUrl: e.target.value})}
                    data-testid="input-edit-webhook"
                  />
                </div>
                <div className="space-y-2 flex flex-col justify-end gap-4">
                  <div className="flex items-center justify-between">
                    <Label>Email Notifications</Label>
                    <Switch
                      checked={!!editingUser.notificationEmail}
                      onCheckedChange={checked => setEditingUser({...editingUser, notificationEmail: checked})}
                      data-testid="switch-edit-email-notif"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>SMS Notifications</Label>
                    <Switch
                      checked={!!editingUser.notificationSms}
                      onCheckedChange={checked => setEditingUser({...editingUser, notificationSms: checked})}
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
