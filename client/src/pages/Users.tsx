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
import { UserPlus, Copy, Check, Mail, Eye, User, Phone, AtSign, Shield, Clock, Settings, Calendar, RefreshCw, XCircle, ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";

// API returns camelCase fields from Drizzle ORM
interface AppUser {
  id: number;
  accountsId: number | null;
  fullName1: string | null;
  email: string | null;
  phone: string | null;
  timezone: string | null;
  role: "Admin" | "Operator" | "Manager" | "Agent" | "Viewer" | null;
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
  const [viewingUser, setViewingUser] = useState<AppUser | null>(null);

  // Invite flow state
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("Viewer");
  const [inviteAccountId, setInviteAccountId] = useState<string>("none");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteResult, setInviteResult] = useState<{ token: string; email: string } | null>(null);
  const [tokenCopied, setTokenCopied] = useState(false);
  const [togglingUserId, setTogglingUserId] = useState<number | null>(null);

  // Invite management state
  const [invitesExpanded, setInvitesExpanded] = useState(true);
  const [resendingUserId, setResendingUserId] = useState<number | null>(null);
  const [revokingUserId, setRevokingUserId] = useState<number | null>(null);
  const [resendResult, setResendResult] = useState<{ userId: number; token: string } | null>(null);

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

  // Pending invites: users with "Invited" status who have an invite_token in preferences
  const pendingInvites = useMemo(() => {
    return users.filter(u => {
      if ((u.status || "").toLowerCase() !== "invited") return false;
      // Must have invite token in preferences
      try {
        const prefs = typeof u.preferences === "string" ? JSON.parse(u.preferences || "{}") : (u.preferences || {});
        return !!prefs?.invite_token;
      } catch {
        return false;
      }
    });
  }, [users]);

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

  const handleStatusToggle = async (user: AppUser, checked: boolean) => {
    const newStatus = checked ? "Active" : "Inactive";
    if (togglingUserId === user.id) return; // prevent double-click

    // Optimistic update
    setUsers(prev => prev.map(u => u.id === user.id ? { ...u, status: newStatus } : u));
    setTogglingUserId(user.id);

    try {
      const res = await apiFetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        const updated = await res.json();
        setUsers(prev => prev.map(u => u.id === user.id ? { ...u, ...updated } : u));
        toast({
          title: checked ? "User activated" : "User deactivated",
          description: `${user.fullName1 || user.email} is now ${newStatus}`,
        });
      } else {
        // Revert on failure
        setUsers(prev => prev.map(u => u.id === user.id ? { ...u, status: user.status } : u));
        toast({ title: "Failed to update status", variant: "destructive" });
      }
    } catch (err) {
      // Revert on error
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, status: user.status } : u));
      toast({ title: "Failed to update status", variant: "destructive" });
    } finally {
      setTogglingUserId(null);
    }
  };

  const handleInviteOpen = () => {
    setInviteEmail("");
    setInviteRole("Viewer");
    setInviteAccountId("none");
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
      if (inviteAccountId && inviteAccountId !== "none") body.accountsId = Number(inviteAccountId);
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

  // Helper: parse invite_sent_at from user.preferences
  const getInviteSentAt = (u: AppUser): Date | null => {
    if (!u.preferences) return null;
    try {
      const parsed = typeof u.preferences === "string" ? JSON.parse(u.preferences) : u.preferences;
      if (parsed?.invite_sent_at) return new Date(parsed.invite_sent_at);
    } catch {}
    return null;
  };

  // Helper: check if invite is expired (older than 7 days)
  const isInviteExpired = (u: AppUser): boolean => {
    const sentAt = getInviteSentAt(u);
    if (!sentAt) return false;
    const now = new Date();
    const diffMs = now.getTime() - sentAt.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    return diffDays > 7;
  };

  // Handle resend invite
  const handleResendInvite = async (u: AppUser) => {
    if (resendingUserId === u.id) return;
    setResendingUserId(u.id);
    setResendResult(null);
    try {
      const res = await apiFetch(`/api/users/${u.id}/resend-invite`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to resend invite");
      // Update user in local state with new preferences
      if (data.user) {
        setUsers(prev => prev.map(usr => usr.id === u.id ? { ...usr, ...data.user } : usr));
      }
      setResendResult({ userId: u.id, token: data.invite_token });
      toast({ title: "Invite resent", description: `New invite token generated for ${u.email}` });
    } catch (err: any) {
      toast({ title: "Failed to resend invite", description: err.message, variant: "destructive" });
    } finally {
      setResendingUserId(null);
    }
  };

  // Handle revoke invite
  const handleRevokeInvite = async (u: AppUser) => {
    if (revokingUserId === u.id) return;
    setRevokingUserId(u.id);
    try {
      const res = await apiFetch(`/api/users/${u.id}/revoke-invite`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to revoke invite");
      // Update user in local state
      if (data.user) {
        setUsers(prev => prev.map(usr => usr.id === u.id ? { ...usr, ...data.user } : usr));
      }
      if (resendResult?.userId === u.id) setResendResult(null);
      toast({ title: "Invite revoked", description: `Invite for ${u.email} has been revoked` });
    } catch (err: any) {
      toast({ title: "Failed to revoke invite", description: err.message, variant: "destructive" });
    } finally {
      setRevokingUserId(null);
    }
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

          {/* ─── Pending Invites Panel (Admin only) ─── */}
          {isAdmin && !loading && pendingInvites.length > 0 && (
            <div
              className="mb-4 rounded-2xl border border-amber-200 dark:border-amber-700/50 bg-amber-50 dark:bg-amber-900/10 shadow-sm overflow-hidden"
              data-testid="section-pending-invites"
            >
              {/* Header */}
              <button
                className="w-full flex items-center justify-between px-5 py-3 hover:bg-amber-100/50 dark:hover:bg-amber-900/20 transition-colors text-left"
                onClick={() => setInvitesExpanded(v => !v)}
                data-testid="button-toggle-invites"
                aria-expanded={invitesExpanded}
              >
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span className="font-semibold text-sm text-amber-800 dark:text-amber-300">
                    Pending Invites
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-amber-200 dark:bg-amber-700/50 text-amber-800 dark:text-amber-300 text-xs font-bold">
                    {pendingInvites.length}
                  </span>
                </div>
                {invitesExpanded
                  ? <ChevronUp className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  : <ChevronDown className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                }
              </button>

              {/* Invites list */}
              {invitesExpanded && (
                <div className="divide-y divide-amber-100 dark:divide-amber-800/30">
                  {pendingInvites.map(u => {
                    const sentAt = getInviteSentAt(u);
                    const expired = isInviteExpired(u);
                    const isResending = resendingUserId === u.id;
                    const isRevoking = revokingUserId === u.id;
                    const justResent = resendResult?.userId === u.id;

                    return (
                      <div
                        key={u.id}
                        className="flex items-center justify-between gap-4 px-5 py-3"
                        data-testid={`invite-row-${u.id}`}
                      >
                        {/* User info */}
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center shrink-0">
                            <User className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate" data-testid={`invite-email-${u.id}`}>
                              {u.email || <span className="italic text-muted-foreground">No email</span>}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
                              {u.role && (
                                <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-medium", getRoleStyle(u.role))}>
                                  {u.role}
                                </span>
                              )}
                              {sentAt && (
                                <span className="text-[10px] text-muted-foreground flex items-center gap-1" data-testid={`invite-sent-at-${u.id}`}>
                                  <Clock className="w-3 h-3" />
                                  Sent {sentAt.toLocaleDateString(undefined, { dateStyle: "medium" })}
                                </span>
                              )}
                              {expired && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-[10px] font-medium" data-testid={`invite-expired-${u.id}`}>
                                  <AlertTriangle className="w-3 h-3" />
                                  Expired
                                </span>
                              )}
                              {justResent && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-[10px] font-medium" data-testid={`invite-resent-badge-${u.id}`}>
                                  <Check className="w-3 h-3" />
                                  Resent
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 shrink-0">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 gap-1.5 text-xs border-amber-200 dark:border-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/30"
                            onClick={() => handleResendInvite(u)}
                            disabled={isResending || isRevoking}
                            data-testid={`button-resend-invite-${u.id}`}
                            title="Resend invite with a new token"
                          >
                            <RefreshCw className={cn("w-3 h-3", isResending && "animate-spin")} />
                            {isResending ? "Sending…" : "Resend"}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 gap-1.5 text-xs border-red-200 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                            onClick={() => handleRevokeInvite(u)}
                            disabled={isResending || isRevoking}
                            data-testid={`button-revoke-invite-${u.id}`}
                            title="Revoke this invite"
                          >
                            <XCircle className={cn("w-3 h-3", isRevoking && "animate-spin")} />
                            {isRevoking ? "Revoking…" : "Revoke"}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

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
                <div className="shrink-0 grid grid-cols-[80px_1.5fr_1.2fr_1.5fr_1fr_1fr_120px_150px] min-w-[800px] text-[11px] uppercase tracking-wider font-bold text-muted-foreground bg-muted/50 border-b border-border px-6 py-4 z-10">
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
                      className="grid grid-cols-[80px_1.5fr_1.2fr_1.5fr_1fr_1fr_120px_150px] min-w-[800px] px-6 py-5 text-sm items-center hover:bg-muted/50 transition-colors"
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
                      <div className="flex items-center gap-2" data-testid={`toggle-user-status-${u.id}`}>
                        {isAdmin ? (
                          <>
                            <Switch
                              checked={isActive(u.status)}
                              onCheckedChange={(checked) => handleStatusToggle(u, checked)}
                              disabled={togglingUserId === u.id}
                              data-testid={`switch-user-status-${u.id}`}
                              title={isActive(u.status) ? "Click to deactivate" : "Click to activate"}
                            />
                            <span className={cn(
                              "text-[10px] font-bold uppercase",
                              isActive(u.status) ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
                            )}>
                              {togglingUserId === u.id ? "…" : (u.status || "—")}
                            </span>
                          </>
                        ) : (
                          u.status ? (
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
                          )
                        )}
                      </div>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 rounded-lg hover:bg-muted p-0"
                          onClick={() => setViewingUser(u)}
                          data-testid={`button-view-user-${u.id}`}
                          title="View profile"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
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
                      <SelectItem value="Operator">Operator</SelectItem>
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
                      <SelectItem value="none">No account</SelectItem>
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

        {/* ─── User Detail View Dialog ─── */}
        <Dialog open={!!viewingUser} onOpenChange={(open) => !open && setViewingUser(null)}>
          <DialogContent className="max-w-lg" data-testid="dialog-user-detail">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <User className="w-5 h-5 text-brand-blue" />
                User Profile
              </DialogTitle>
              <DialogDescription>
                Full profile details for this user.
              </DialogDescription>
            </DialogHeader>

            {viewingUser && (
              <div className="py-2 space-y-4">
                {/* Avatar / Name Header */}
                <div className="flex items-center gap-4 pb-4 border-b border-border">
                  <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center shrink-0">
                    {viewingUser.avatarUrl ? (
                      <img
                        src={viewingUser.avatarUrl}
                        alt={viewingUser.fullName1 || "User"}
                        className="w-14 h-14 rounded-full object-cover"
                      />
                    ) : (
                      <User className="w-6 h-6 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-foreground" data-testid="detail-full-name">
                      {viewingUser.fullName1 || <span className="text-muted-foreground italic text-sm">No name set</span>}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      {viewingUser.role && (
                        <span className={cn(
                          "px-2.5 py-0.5 rounded-lg text-xs font-medium",
                          getRoleStyle(viewingUser.role)
                        )} data-testid="detail-role">
                          {viewingUser.role}
                        </span>
                      )}
                      {viewingUser.status && (
                        <span className={cn(
                          "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase",
                          isActive(viewingUser.status)
                            ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
                            : "bg-muted text-muted-foreground"
                        )}>
                          <span className={cn(
                            "w-1.5 h-1.5 rounded-full",
                            isActive(viewingUser.status) ? "bg-emerald-500" : "bg-muted-foreground"
                          )} />
                          {viewingUser.status}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Profile Fields */}
                <div className="space-y-3">
                  {/* Email */}
                  <div className="flex items-start gap-3" data-testid="detail-email">
                    <AtSign className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-0.5">Email</p>
                      <p className="text-sm text-foreground break-all">{viewingUser.email || <span className="italic text-muted-foreground">Not set</span>}</p>
                    </div>
                  </div>

                  {/* Phone */}
                  <div className="flex items-start gap-3" data-testid="detail-phone">
                    <Phone className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-0.5">Phone</p>
                      <p className="text-sm text-foreground">{viewingUser.phone || <span className="italic text-muted-foreground">Not set</span>}</p>
                    </div>
                  </div>

                  {/* Last Login */}
                  <div className="flex items-start gap-3" data-testid="detail-last-login">
                    <Clock className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-0.5">Last Login</p>
                      <p className="text-sm text-foreground">
                        {viewingUser.lastLoginAt
                          ? new Date(viewingUser.lastLoginAt).toLocaleString(undefined, {
                              dateStyle: "medium",
                              timeStyle: "short",
                            })
                          : <span className="italic text-muted-foreground">Never logged in</span>
                        }
                      </p>
                    </div>
                  </div>

                  {/* Account */}
                  {viewingUser.accountsId && (
                    <div className="flex items-start gap-3" data-testid="detail-account">
                      <Shield className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-0.5">Account</p>
                        <p className="text-sm text-foreground">
                          {accounts[viewingUser.accountsId] || `Account #${viewingUser.accountsId}`}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Timezone */}
                  {viewingUser.timezone && (
                    <div className="flex items-start gap-3" data-testid="detail-timezone">
                      <Calendar className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-0.5">Timezone</p>
                        <p className="text-sm text-foreground">{viewingUser.timezone}</p>
                      </div>
                    </div>
                  )}

                  {/* Member Since */}
                  {viewingUser.createdAt && (
                    <div className="flex items-start gap-3" data-testid="detail-created-at">
                      <Calendar className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-0.5">Member Since</p>
                        <p className="text-sm text-foreground">
                          {new Date(viewingUser.createdAt).toLocaleDateString(undefined, { dateStyle: "medium" })}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Preferences */}
                  <div className="flex items-start gap-3" data-testid="detail-preferences">
                    <Settings className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="min-w-0 w-full">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-0.5">Preferences</p>
                      {viewingUser.preferences ? (
                        (() => {
                          try {
                            const parsed = typeof viewingUser.preferences === "string"
                              ? JSON.parse(viewingUser.preferences)
                              : viewingUser.preferences;
                            const keys = Object.keys(parsed).filter(k => k !== "invite_token");
                            if (keys.length === 0) return <p className="text-sm text-muted-foreground italic">No preferences set</p>;
                            return (
                              <div className="rounded-lg bg-muted/50 border border-border p-3 space-y-1.5">
                                {keys.map(k => (
                                  <div key={k} className="flex items-start gap-2 text-xs">
                                    <span className="font-mono text-muted-foreground shrink-0">{k}:</span>
                                    <span className="text-foreground break-all">{String(parsed[k])}</span>
                                  </div>
                                ))}
                              </div>
                            );
                          } catch {
                            return (
                              <p className="text-sm text-foreground font-mono break-all bg-muted/50 rounded-lg border border-border p-2 text-xs">
                                {String(viewingUser.preferences)}
                              </p>
                            );
                          }
                        })()
                      ) : (
                        <p className="text-sm text-muted-foreground italic">No preferences set</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Notification Preferences */}
                <div className="pt-3 border-t border-border">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-2">Notifications</p>
                  <div className="flex gap-4">
                    <span className={cn(
                      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
                      viewingUser.notificationEmail
                        ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
                        : "bg-muted text-muted-foreground"
                    )}>
                      <Mail className="w-3 h-3" />
                      Email {viewingUser.notificationEmail ? "On" : "Off"}
                    </span>
                    <span className={cn(
                      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
                      viewingUser.notificationSms
                        ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                        : "bg-muted text-muted-foreground"
                    )}>
                      <Phone className="w-3 h-3" />
                      SMS {viewingUser.notificationSms ? "On" : "Off"}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setViewingUser(null)}>
                Close
              </Button>
              {viewingUser && (isAdmin || viewingUser.email === currentUserEmail) && (
                <Button
                  onClick={() => {
                    const u = viewingUser;
                    setViewingUser(null);
                    setEditingUser(u);
                  }}
                  data-testid="button-detail-edit"
                >
                  Edit Profile
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
                      <SelectItem value="Operator">Operator</SelectItem>
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
