import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import {
  List, Table2, ArrowUpDown, Filter, Eye, Check,
  UserPlus, Mail, Phone, Copy, Clock, User, Shield, Calendar,
  Settings, Layers, Trash2, ExternalLink, Megaphone, Users, HandMetal,
} from "lucide-react";
import { useLocation } from "wouter";
import { CrmShell } from "@/components/crm/CrmShell";
import { usePersistedSelection } from "@/hooks/usePersistedSelection";
import { UsersListView } from "../components/UsersListView";
import { UsersInlineTable } from "../components/UsersInlineTable";
import type { UserTableItem, UserColKey } from "../components/UsersInlineTable";
import { apiFetch } from "@/lib/apiUtils";
import { cn } from "@/lib/utils";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTopbarActions } from "@/contexts/TopbarActionsContext";
import { ViewTabBar, type TabDef } from "@/components/ui/view-tab-bar";
import { ToolbarPill } from "@/components/ui/toolbar-pill";

// ── Types (exported for child components) ─────────────────────────────────────
export interface AppUser {
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
export type AccountMap = Record<number, string>;

// ── Constants ─────────────────────────────────────────────────────────────────
type ViewMode    = "list" | "table";
type TableSortBy = "name_asc" | "name_desc" | "recent";
type TableGroupBy = "role" | "status" | "account" | "none";

const VIEW_MODE_KEY    = "users-view-mode";
const VISIBLE_COLS_KEY = "users-table-visible-cols";

const DEFAULT_VISIBLE_COLS: UserColKey[] = ["name", "account", "email", "role", "status", "lastLogin"];

const ROLE_OPTIONS = ["Admin", "Operator", "Manager", "Agent", "Viewer"] as const;
const STATUS_OPTIONS = ["Active", "Inactive", "Invited"];
const ROLE_GROUP_ORDER   = ["Admin", "Operator", "Manager", "Agent", "Viewer"];
const STATUS_GROUP_ORDER = ["Active", "Invited", "Inactive"];

const VIEW_TABS: TabDef[] = [
  { id: "list",  label: "List",  icon: List  },
  { id: "table", label: "Table", icon: Table2 },
];

const TABLE_SORT_LABELS: Record<TableSortBy, string> = {
  name_asc:  "Name A → Z",
  name_desc: "Name Z → A",
  recent:    "Most Recent",
};

const TABLE_GROUP_LABELS: Record<TableGroupBy, string> = {
  role:    "Role",
  status:  "Status",
  account: "Account",
  none:    "None",
};

const TABLE_COL_META: { key: UserColKey; label: string; defaultVisible: boolean }[] = [
  { key: "name",        label: "Name",         defaultVisible: true  },
  { key: "account",     label: "Account",      defaultVisible: true  },
  { key: "email",       label: "Email",        defaultVisible: true  },
  { key: "phone",       label: "Phone",        defaultVisible: false },
  { key: "role",        label: "Role",         defaultVisible: true  },
  { key: "status",      label: "Status",       defaultVisible: true  },
  { key: "lastLogin",   label: "Last Login",   defaultVisible: true  },
  { key: "memberSince", label: "Member Since", defaultVisible: false },
  { key: "timezone",    label: "Timezone",     defaultVisible: false },
];

function isActive(s: string | null | undefined) { return (s || "").toLowerCase() === "active"; }
function getUserName(u: AppUser) { return u.fullName1 || u.email || `User #${u.id}`; }

// ── Role badge styles for the view dialog ────────────────────────────────────
const ROLE_STYLES: Record<string, string> = {
  Admin:    "bg-brand-yellow/20 text-brand-deep-blue dark:bg-brand-yellow/15 dark:text-brand-yellow",
  Manager:  "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  Agent:    "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  Operator: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  Viewer:   "bg-muted text-muted-foreground",
};

// ── Inline confirmation button ────────────────────────────────────────────────
function ConfirmToolbarButton({
  icon: Icon, label, onConfirm, variant = "default",
}: {
  icon: React.ElementType; label: string;
  onConfirm: () => Promise<void> | void;
  variant?: "default" | "danger";
}) {
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  if (confirming) {
    return (
      <div className="h-10 flex items-center gap-1 rounded-full border border-border/30 bg-card px-2.5 text-[12px] shrink-0">
        <span className="text-foreground/60 mr-0.5 whitespace-nowrap">{label}?</span>
        <button
          className="px-2 py-0.5 rounded-full bg-brand-indigo text-white font-semibold text-[11px] hover:opacity-90 disabled:opacity-50"
          onClick={async () => { setLoading(true); try { await onConfirm(); } finally { setLoading(false); setConfirming(false); } }}
          disabled={loading}
        >
          {loading ? "…" : "Yes"}
        </button>
        <button className="px-2 py-0.5 rounded-full text-muted-foreground text-[11px] hover:text-foreground" onClick={() => setConfirming(false)}>No</button>
      </div>
    );
  }
  return (
    <button
      className={cn(
        "h-10 inline-flex items-center gap-1.5 rounded-full border px-3 text-[12px] font-medium shrink-0",
        variant === "danger"
          ? "border-red-300/50 text-red-600 hover:bg-red-50/60"
          : "border-border/30 text-foreground/70 hover:bg-card hover:text-foreground",
      )}
      onClick={() => setConfirming(true)}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

// ── Inner component ───────────────────────────────────────────────────────────
function UsersContent() {
  const [, setLocation] = useLocation();

  // ── View mode (persisted)
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    try {
      const s = localStorage.getItem(VIEW_MODE_KEY);
      if (s && ["list", "table"].includes(s)) return s as ViewMode;
    } catch {}
    return "list";
  });
  useEffect(() => { try { localStorage.setItem(VIEW_MODE_KEY, viewMode); } catch {} }, [viewMode]);

  const { clearTopbarActions } = useTopbarActions();
  useEffect(() => { clearTopbarActions(); }, [clearTopbarActions]);

  // ── Data fetching
  const [users, setUsers] = useState<AppUser[]>([]);
  const [accounts, setAccounts] = useState<AccountMap>({});
  const [loading, setLoading] = useState(true);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const [usersRes, accountsRes] = await Promise.all([
        apiFetch("/api/users"),
        apiFetch("/api/accounts"),
      ]);
      if (!usersRes.ok) throw new Error("Failed to fetch users");
      const userData = await usersRes.json();
      setUsers(Array.isArray(userData) ? userData : []);
      if (accountsRes.ok) {
        const accountsData = await accountsRes.json();
        const map: AccountMap = {};
        if (Array.isArray(accountsData)) {
          accountsData.forEach((a: any) => { if (a.id && a.name) map[a.id] = a.name; });
        }
        setAccounts(map);
      }
    } catch {
      toast({ title: "Failed to load users", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const currentUserEmail = localStorage.getItem("leadawaker_user_email") || "";
  const currentUserRole  = localStorage.getItem("leadawaker_user_role") || "Viewer";
  const isAdmin = currentUserRole === "Admin" || currentUserEmail === "leadawaker@gmail.com";

  // ── Selection
  const [selectedUser, setSelectedUser] = usePersistedSelection<AppUser>(
    "selected-user-id",
    (u) => u.id,
    users,
  );
  const selectedUserRef = useRef(selectedUser);
  selectedUserRef.current = selectedUser;

  // Auto-select current user (own profile) when data loads and nothing is selected
  useEffect(() => {
    if (!loading && users.length > 0 && !selectedUser) {
      const self = users.find((u) => u.email === currentUserEmail);
      setSelectedUser(self || users[0]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, users]);

  // Navigate-to-profile: topbar "View My Profile" stores email in sessionStorage
  useEffect(() => {
    if (loading || users.length === 0) return;
    const pendingEmail = sessionStorage.getItem("pendingUserEmail");
    if (!pendingEmail) return;
    sessionStorage.removeItem("pendingUserEmail");
    const match = users.find((u) => u.email === pendingEmail);
    if (match) setSelectedUser(match);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, users]);

  const handleSelectUser  = useCallback((u: AppUser) => setSelectedUser(u), []);
  const handleViewSwitch  = useCallback((mode: ViewMode) => { setViewMode(mode); }, []);

  // ── Status toggle
  const [togglingUserId, setTogglingUserId] = useState<number | null>(null);

  const handleStatusToggle = useCallback(async (user: AppUser, checked: boolean) => {
    const newStatus = checked ? "Active" : "Inactive";
    if (togglingUserId === user.id) return;
    setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, status: newStatus } : u));
    const sel = selectedUserRef.current;
    if (sel?.id === user.id) setSelectedUser({ ...sel, status: newStatus });
    setTogglingUserId(user.id);
    try {
      const res = await apiFetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        const updated = await res.json();
        setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, ...updated } : u));
        const sel2 = selectedUserRef.current;
        if (sel2?.id === user.id) setSelectedUser({ ...sel2, ...updated });
        toast({ title: checked ? "User activated" : "User deactivated", description: `${getUserName(user)} is now ${newStatus}` });
      } else {
        setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, status: user.status } : u));
        const sel2 = selectedUserRef.current;
        if (sel2?.id === user.id) setSelectedUser({ ...sel2, status: user.status });
        toast({ title: "Failed to update status", variant: "destructive" });
      }
    } catch {
      setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, status: user.status } : u));
      toast({ title: "Failed to update status", variant: "destructive" });
    } finally {
      setTogglingUserId(null);
    }
  }, [togglingUserId]);

  // ── Inline field update (used by list view inline editing)
  const handleUpdateField = useCallback(async (userId: number, field: string, value: any) => {
    // Optimistic
    setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, [field]: value } : u));
    const sel = selectedUserRef.current;
    if (sel?.id === userId) setSelectedUser({ ...sel, [field]: value });
    // Sync avatar to localStorage for topbar if this is the current user's avatar
    if (field === "avatarUrl") {
      const targetUser = users.find((u) => u.id === userId);
      if (targetUser?.email === currentUserEmail) {
        if (value != null) {
          localStorage.setItem("leadawaker_user_avatar", String(value));
        } else {
          localStorage.removeItem("leadawaker_user_avatar");
        }
        window.dispatchEvent(new Event("leadawaker-avatar-changed"));
      }
    }
    try {
      const res = await apiFetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      if (res.ok) {
        const updated = await res.json();
        setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, ...updated } : u));
        const sel2 = selectedUserRef.current;
        if (sel2?.id === userId) setSelectedUser({ ...sel2, ...updated });
      } else {
        toast({ title: "Failed to update field", variant: "destructive" });
        fetchUsers();
      }
    } catch {
      toast({ title: "Failed to update field", variant: "destructive" });
      fetchUsers();
    }
  }, [fetchUsers]);

  // ── Password reset
  const handlePasswordReset = useCallback(async (user: AppUser) => {
    if (!user.email) {
      toast({ title: "No email address", description: "This user has no email set.", variant: "destructive" });
      return;
    }
    try {
      const res = await apiFetch(`/api/users/${user.id}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user.email }),
      });
      if (res.ok) {
        toast({ title: "Password reset sent", description: `Reset email sent to ${user.email}` });
      } else {
        const data = await res.json().catch(() => ({}));
        toast({ title: "Password reset failed", description: data.message || "Could not send reset email", variant: "destructive" });
      }
    } catch {
      toast({ title: "Password reset failed", description: "Could not send reset email", variant: "destructive" });
    }
  }, []);

  // ── Edit user
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);

  const handleSaveUser = useCallback(async () => {
    if (!editingUser) return;
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
          ...(editingUser.email === currentUserEmail ? {
            notificationEmail: editingUser.notificationEmail,
            notificationSms: editingUser.notificationSms,
          } : {}),
          ...((editingUser as any).password ? { password: (editingUser as any).password } : {}),
        }),
      });
      const updated = res.ok ? await res.json() : editingUser;
      setUsers((prev) => prev.map((u) => u.id === editingUser.id ? { ...u, ...updated } : u));
      const sel = selectedUserRef.current;
      if (sel?.id === editingUser.id) setSelectedUser({ ...sel, ...updated });
      setEditingUser(null);
      toast({ title: "User updated", description: `Successfully updated ${getUserName(editingUser)}` });
    } catch {
      setUsers((prev) => prev.map((u) => u.id === editingUser.id ? editingUser : u));
      setEditingUser(null);
      toast({ title: "User updated locally" });
    }
  }, [editingUser]);

  // ── View user dialog
  const [viewingUser, setViewingUser] = useState<AppUser | null>(null);

  // ── View dialog enrichment: campaigns, leads, human takeover count
  const [viewCampaigns, setViewCampaigns] = useState<any[]>([]);
  const [viewLeads, setViewLeads]         = useState<any[]>([]);
  const [viewTakeoverCount, setViewTakeoverCount] = useState<number>(0);
  const [viewDataLoading, setViewDataLoading]     = useState(false);

  useEffect(() => {
    if (!viewingUser?.accountsId) {
      setViewCampaigns([]); setViewLeads([]); setViewTakeoverCount(0);
      return;
    }
    let cancelled = false;
    setViewDataLoading(true);
    const accountId = viewingUser.accountsId;
    Promise.all([
      apiFetch(`/api/campaigns?accountId=${accountId}`).then((r) => r.ok ? r.json() : []).catch(() => []),
      apiFetch(`/api/leads?accountId=${accountId}`).then((r) => r.ok ? r.json() : []).catch(() => []),
      apiFetch(`/api/interactions?accountId=${accountId}`).then((r) => r.ok ? r.json() : []).catch(() => []),
    ]).then(([campaignsData, leadsData, interactionsData]) => {
      if (cancelled) return;
      setViewCampaigns(Array.isArray(campaignsData) ? campaignsData : []);
      setViewLeads(Array.isArray(leadsData) ? leadsData : []);
      // Count human takeovers: interactions that are NOT ai_generated and were sent by this user
      const allInteractions = Array.isArray(interactionsData) ? interactionsData : [];
      const takeoverCount = allInteractions.filter((i: any) =>
        i.ai_generated === false && i.direction === "outbound" && (i.Who === viewingUser.fullName1 || i.Users_id === viewingUser.id || i.is_manual_follow_up === true)
      ).length;
      setViewTakeoverCount(takeoverCount);
    }).finally(() => { if (!cancelled) setViewDataLoading(false); });
    return () => { cancelled = true; };
  }, [viewingUser?.accountsId, viewingUser?.id, viewingUser?.fullName1]);

  // ── Invite flow
  const [inviteOpen, setInviteOpen]           = useState(false);
  const [inviteEmail, setInviteEmail]         = useState("");
  const [inviteRole, setInviteRole]           = useState("Viewer");
  const [inviteAccountId, setInviteAccountId] = useState("none");
  const [inviteLoading, setInviteLoading]     = useState(false);
  const [inviteResult, setInviteResult]       = useState<{ token: string; email: string } | null>(null);
  const [tokenCopied, setTokenCopied]         = useState(false);

  const handleInviteOpen = useCallback(() => {
    setInviteEmail(""); setInviteRole("Viewer"); setInviteAccountId("none");
    setInviteResult(null); setTokenCopied(false); setInviteOpen(true);
  }, []);

  const handleSendInvite = useCallback(async () => {
    if (!inviteEmail.trim()) { toast({ title: "Email required", variant: "destructive" }); return; }
    setInviteLoading(true);
    try {
      const body: Record<string, any> = { email: inviteEmail.trim(), role: inviteRole };
      if (inviteAccountId !== "none") body.accountsId = Number(inviteAccountId);
      const res = await apiFetch("/api/users/invite", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to send invite");
      setInviteResult({ token: data.invite_token, email: inviteEmail.trim() });
      if (data.user) setUsers((prev) => [...prev, data.user]);
      toast({ title: "Invite sent", description: `Invite created for ${inviteEmail.trim()} as ${inviteRole}` });
    } catch (err: any) {
      toast({ title: "Invite failed", description: err.message, variant: "destructive" });
    } finally {
      setInviteLoading(false);
    }
  }, [inviteEmail, inviteRole, inviteAccountId]);

  const handleCopyToken = useCallback(async () => {
    if (!inviteResult) return;
    await navigator.clipboard.writeText(inviteResult.token).catch(() => {});
    setTokenCopied(true);
    setTimeout(() => setTokenCopied(false), 2000);
  }, [inviteResult]);

  // ── Pending invites
  const pendingInvites = useMemo(() => users.filter((u) => {
    if ((u.status || "").toLowerCase() !== "invited") return false;
    try {
      const prefs = typeof u.preferences === "string" ? JSON.parse(u.preferences || "{}") : (u.preferences || {});
      return !!prefs?.invite_token;
    } catch { return false; }
  }), [users]);

  const [resendingUserId, setResendingUserId] = useState<number | null>(null);
  const [revokingUserId,  setRevokingUserId]  = useState<number | null>(null);
  const [resendResult, setResendResult]       = useState<{ userId: number; token: string } | null>(null);

  const getInviteSentAt = useCallback((u: AppUser): Date | null => {
    if (!u.preferences) return null;
    try {
      const parsed = typeof u.preferences === "string" ? JSON.parse(u.preferences) : u.preferences;
      if (parsed?.invite_sent_at) return new Date(parsed.invite_sent_at);
    } catch {}
    return null;
  }, []);

  const isInviteExpired = useCallback((u: AppUser) => {
    const sentAt = getInviteSentAt(u);
    return sentAt ? (Date.now() - sentAt.getTime()) / (1000 * 60 * 60 * 24) > 7 : false;
  }, [getInviteSentAt]);

  const handleResendInvite = useCallback(async (u: AppUser) => {
    if (resendingUserId === u.id) return;
    setResendingUserId(u.id); setResendResult(null);
    try {
      const res = await apiFetch(`/api/users/${u.id}/resend-invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ frontendOrigin: window.location.origin }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to resend");
      if (data.user) setUsers((prev) => prev.map((usr) => usr.id === u.id ? { ...usr, ...data.user } : usr));
      setResendResult({ userId: u.id, token: data.invite_token });
      toast({ title: "Invite resent" });
    } catch (err: any) {
      toast({ title: "Failed to resend invite", description: err.message, variant: "destructive" });
    } finally { setResendingUserId(null); }
  }, [resendingUserId]);

  const handleRevokeInvite = useCallback(async (u: AppUser) => {
    if (revokingUserId === u.id) return;
    setRevokingUserId(u.id);
    try {
      const res = await apiFetch(`/api/users/${u.id}/revoke-invite`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to revoke");
      if (data.user) setUsers((prev) => prev.map((usr) => usr.id === u.id ? { ...usr, ...data.user } : usr));
      if (resendResult?.userId === u.id) setResendResult(null);
      toast({ title: "Invite revoked" });
    } catch (err: any) {
      toast({ title: "Failed to revoke invite", description: err.message, variant: "destructive" });
    } finally { setRevokingUserId(null); }
  }, [revokingUserId, resendResult]);

  // ── List view lifted state
  const [listSearch,       setListSearch]       = useState("");
  const [searchOpen,       setSearchOpen]       = useState(false);
  const [listGroupBy,      setListGroupBy]      = useState<"role" | "status" | "account" | "none">("role");
  const [listSortBy,       setListSortBy]       = useState<"name_asc" | "name_desc" | "recent">("name_asc");
  const [listFilterRole,   setListFilterRole]   = useState<string[]>([]);
  const [listFilterStatus, setListFilterStatus] = useState<string[]>([]);

  const hasNonDefaultControls = listGroupBy !== "role" || listSortBy !== "name_asc" || listFilterRole.length > 0 || listFilterStatus.length > 0;
  const isGroupNonDefault     = listGroupBy !== "role";
  const isSortNonDefault      = listSortBy !== "name_asc";

  const handleResetControls   = useCallback(() => { setListGroupBy("role"); setListSortBy("name_asc"); setListFilterRole([]); setListFilterStatus([]); }, []);
  const toggleListFilterRole  = useCallback((r: string) => setListFilterRole((p) => p.includes(r) ? p.filter((x) => x !== r) : [...p, r]), []);
  const toggleListFilterStatus = useCallback((s: string) => setListFilterStatus((p) => p.includes(s) ? p.filter((x) => x !== s) : [...p, s]), []);

  // ── Table view state
  const [tableSearch,       setTableSearch]       = useState("");
  const [tableSortBy,       setTableSortBy]       = useState<TableSortBy>("name_asc");
  const [tableGroupBy,      setTableGroupBy]      = useState<TableGroupBy>("role");
  const [tableFilterRole,   setTableFilterRole]   = useState<string[]>([]);
  const [tableFilterStatus, setTableFilterStatus] = useState<string[]>([]);
  const [tableSelectedIds,  setTableSelectedIds]  = useState<Set<number>>(new Set());

  const isTableFilterActive    = tableFilterRole.length > 0 || tableFilterStatus.length > 0;
  const tableActiveFilterCount = tableFilterRole.length + tableFilterStatus.length;

  const toggleTableFilterRole   = useCallback((r: string) => setTableFilterRole((p) => p.includes(r) ? p.filter((x) => x !== r) : [...p, r]), []);
  const toggleTableFilterStatus = useCallback((s: string) => setTableFilterStatus((p) => p.includes(s) ? p.filter((x) => x !== s) : [...p, s]), []);
  const clearTableFilters       = useCallback(() => { setTableFilterRole([]); setTableFilterStatus([]); }, []);

  const handleBulkDeactivateUsers = useCallback(async () => {
    if (tableSelectedIds.size === 0) return;
    try {
      await Promise.all(
        Array.from(tableSelectedIds).map((id) =>
          apiFetch(`/api/users/${id}`, { method: "PATCH", body: JSON.stringify({ status: "Inactive" }) })
        )
      );
      setTableSelectedIds(new Set());
      fetchUsers();
    } catch (err) { console.error("Bulk deactivate users failed", err); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableSelectedIds, fetchUsers]);

  // ── Column visibility (persisted)
  const [visibleCols, setVisibleCols] = useState<Set<UserColKey>>(() => {
    try {
      const s = localStorage.getItem(VISIBLE_COLS_KEY);
      if (s) { const arr = JSON.parse(s); if (Array.isArray(arr) && arr.length > 0) return new Set(arr); }
    } catch {}
    return new Set(DEFAULT_VISIBLE_COLS);
  });
  useEffect(() => { try { localStorage.setItem(VISIBLE_COLS_KEY, JSON.stringify(Array.from(visibleCols))); } catch {} }, [visibleCols]);

  // ── Table flat items
  const tableFlatItems = useMemo((): UserTableItem[] => {
    let source = [...users];
    if (tableFilterRole.length > 0)   source = source.filter((u) => tableFilterRole.includes(u.role || ""));
    if (tableFilterStatus.length > 0) source = source.filter((u) => tableFilterStatus.includes(u.status || ""));

    source.sort((a, b) => {
      switch (tableSortBy) {
        case "name_asc":  return getUserName(a).localeCompare(getUserName(b));
        case "name_desc": return getUserName(b).localeCompare(getUserName(a));
        default: {
          const da = a.lastLoginAt || a.createdAt || "";
          const db = b.lastLoginAt || b.createdAt || "";
          return db.localeCompare(da);
        }
      }
    });

    if (tableGroupBy === "none") return source.map((u) => ({ kind: "user" as const, user: u }));

    const buckets = new Map<string, AppUser[]>();
    source.forEach((u) => {
      let key: string;
      switch (tableGroupBy) {
        case "role":    key = u.role || "No Role"; break;
        case "status":  key = u.status || "Unknown"; break;
        case "account": key = accounts[u.accountsId ?? 0] || "No Account"; break;
        default:        key = u.role || "No Role";
      }
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key)!.push(u);
    });

    const allKeys      = Array.from(buckets.keys());
    const orderedKeys  =
      tableGroupBy === "role"
        ? ROLE_GROUP_ORDER.filter((k) => buckets.has(k)).concat(allKeys.filter((k) => !ROLE_GROUP_ORDER.includes(k)))
        : tableGroupBy === "status"
        ? STATUS_GROUP_ORDER.filter((k) => buckets.has(k)).concat(allKeys.filter((k) => !STATUS_GROUP_ORDER.includes(k)))
        : allKeys.sort();

    const result: UserTableItem[] = [];
    orderedKeys.forEach((key) => {
      const group = buckets.get(key);
      if (!group || group.length === 0) return;
      result.push({ kind: "header", label: key, count: group.length });
      group.forEach((u) => result.push({ kind: "user", user: u }));
    });
    return result;
  }, [users, tableFilterRole, tableFilterStatus, tableSortBy, tableGroupBy, accounts]);

  // ── Table toolbar (rendered inline)
  const tableToolbar = (
    <>
      <div className="w-px h-4 bg-border/25 mx-0.5 shrink-0" />

      {/* Search — always open */}
      <div className="h-10 flex items-center gap-1.5 rounded-full border border-border/30 bg-card px-3 shrink-0">
        <svg className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
        </svg>
        <input
          className="h-full bg-transparent border-none outline-none text-[12px] text-foreground placeholder:text-muted-foreground/40 w-32 min-w-0"
          placeholder="Search users…"
          value={tableSearch}
          onChange={(e) => setTableSearch(e.target.value)}
        />
        {tableSearch && (
          <button onClick={() => setTableSearch("")} className="text-muted-foreground/40 hover:text-muted-foreground shrink-0">
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        )}
      </div>

      {/* Sort */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <ToolbarPill
            icon={ArrowUpDown}
            label="Sort"
            active={tableSortBy !== "name_asc"}
            activeValue={tableSortBy !== "name_asc" ? TABLE_SORT_LABELS[tableSortBy].split(" ")[0] : undefined}
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-44">
          <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">Sort by</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {(Object.keys(TABLE_SORT_LABELS) as TableSortBy[]).map((opt) => (
            <DropdownMenuItem key={opt} onClick={() => setTableSortBy(opt)} className={cn("text-[12px]", tableSortBy === opt && "font-semibold text-brand-indigo")}>
              {TABLE_SORT_LABELS[opt]}
              {tableSortBy === opt && <Check className="h-3 w-3 ml-auto" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Filter */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <ToolbarPill
            icon={Filter}
            label="Filter"
            active={isTableFilterActive}
            activeValue={isTableFilterActive ? tableActiveFilterCount : undefined}
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-52 max-h-80 overflow-y-auto">
          <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">Role</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {ROLE_OPTIONS.map((r) => (
            <DropdownMenuItem key={r} onClick={(e) => { e.preventDefault(); toggleTableFilterRole(r); }} className="flex items-center gap-2 text-[12px]">
              <span className="flex-1">{r}</span>
              {tableFilterRole.includes(r) && <Check className="h-3 w-3 text-brand-indigo shrink-0" />}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">Status</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {STATUS_OPTIONS.map((s) => (
            <DropdownMenuItem key={s} onClick={(e) => { e.preventDefault(); toggleTableFilterStatus(s); }} className="flex items-center gap-2 text-[12px]">
              <span className="flex-1">{s}</span>
              {tableFilterStatus.includes(s) && <Check className="h-3 w-3 text-brand-indigo shrink-0" />}
            </DropdownMenuItem>
          ))}
          {isTableFilterActive && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={clearTableFilters} className="text-[12px] text-destructive">Clear all filters</DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Group */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <ToolbarPill
            icon={Layers}
            label="Group"
            active={tableGroupBy !== "role"}
            activeValue={tableGroupBy !== "role" ? TABLE_GROUP_LABELS[tableGroupBy] : undefined}
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-44">
          {(Object.keys(TABLE_GROUP_LABELS) as TableGroupBy[]).map((opt) => (
            <DropdownMenuItem key={opt} onClick={() => setTableGroupBy(opt)} className={cn("text-[12px]", tableGroupBy === opt && "font-semibold text-brand-indigo")}>
              {TABLE_GROUP_LABELS[opt]}
              {tableGroupBy === opt && <Check className="h-3 w-3 ml-auto" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Fields (column visibility) */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <ToolbarPill
            icon={Eye}
            label="Fields"
            active={visibleCols.size !== DEFAULT_VISIBLE_COLS.length}
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-52 max-h-72 overflow-y-auto">
          <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">Show / Hide Columns</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {TABLE_COL_META.map((col) => {
            const isVisible = visibleCols.has(col.key);
            return (
              <DropdownMenuItem
                key={col.key}
                onClick={(e) => { e.preventDefault(); setVisibleCols((prev) => { const next = new Set(prev); if (next.has(col.key)) { if (next.size > 1) next.delete(col.key); } else next.add(col.key); return next; }); }}
                className="flex items-center gap-2 text-[12px]"
              >
                <div className={cn("h-3.5 w-3.5 rounded border flex items-center justify-center shrink-0", isVisible ? "bg-brand-indigo border-brand-indigo" : "border-border/50")}>
                  {isVisible && <Check className="h-2 w-2 text-white" />}
                </div>
                <span className="flex-1">{col.label}</span>
                {!col.defaultVisible && <span className="text-[9px] text-muted-foreground/40 px-1 bg-muted rounded font-medium">+</span>}
              </DropdownMenuItem>
            );
          })}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setVisibleCols(new Set(DEFAULT_VISIBLE_COLS))} className="text-[12px] text-muted-foreground">Reset to default</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Deactivate — far right, when rows selected */}
      {tableSelectedIds.size > 0 && (
        <>
          <div className="flex-1 min-w-0" />
          <div className="flex items-center gap-1 shrink-0">
            <ConfirmToolbarButton icon={Trash2} label="Deactivate" onConfirm={handleBulkDeactivateUsers} variant="danger" />
          </div>
        </>
      )}
    </>
  );

  return (
    <>
      <div className="flex flex-col h-full overflow-hidden" data-testid="page-users">

        {/* ── Main view ─────────────────────────────────────────────────────── */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {viewMode === "list" ? (
            <UsersListView
              users={users}
              accounts={accounts}
              loading={loading}
              selectedUser={selectedUser}
              onSelectUser={handleSelectUser}
              onStatusToggle={handleStatusToggle}
              togglingUserId={togglingUserId}
              isAdmin={isAdmin}
              currentUserEmail={currentUserEmail}
              onInviteCreated={(u) => setUsers((prev) => [...prev, u])}
              viewMode={viewMode}
              onViewModeChange={handleViewSwitch}
              listSearch={listSearch}
              onListSearchChange={setListSearch}
              searchOpen={searchOpen}
              onSearchOpenChange={setSearchOpen}
              groupBy={listGroupBy}
              onGroupByChange={setListGroupBy}
              sortBy={listSortBy}
              onSortByChange={setListSortBy}
              filterRole={listFilterRole}
              onToggleFilterRole={toggleListFilterRole}
              filterStatus={listFilterStatus}
              onToggleFilterStatus={toggleListFilterStatus}
              hasNonDefaultControls={hasNonDefaultControls}
              isGroupNonDefault={isGroupNonDefault}
              isSortNonDefault={isSortNonDefault}
              onResetControls={handleResetControls}
              pendingInvites={pendingInvites}
              resendingUserId={resendingUserId}
              revokingUserId={revokingUserId}
              resendResult={resendResult}
              onResendInvite={handleResendInvite}
              onRevokeInvite={handleRevokeInvite}
              onUpdateField={handleUpdateField}
              onPasswordReset={handlePasswordReset}
            />
          ) : (
            <div className="flex-1 min-h-0 flex gap-[3px] overflow-hidden h-full">
              <div className="flex flex-col bg-muted rounded-lg overflow-hidden flex-1 min-w-0">
                {/* Title */}
                <div className="px-3.5 pt-5 pb-1 shrink-0">
                  <h2 className="text-2xl font-semibold font-heading text-foreground leading-tight">My Users</h2>
                </div>
                {/* Controls row: tabs + toolbar */}
                <div className="px-3 pt-1.5 pb-3 shrink-0 flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none]">
                  <ViewTabBar tabs={VIEW_TABS} activeId={viewMode} onTabChange={(id) => handleViewSwitch(id as ViewMode)} />
                  {tableToolbar}
                </div>
                {/* Table content */}
                <div className="flex-1 min-h-0 overflow-hidden">
                  <UsersInlineTable
                    flatItems={tableFlatItems}
                    loading={loading}
                    selectedUserId={selectedUser?.id ?? null}
                    onSelectUser={handleSelectUser}
                    accounts={accounts}
                    visibleCols={visibleCols}
                    tableSearch={tableSearch}
                    selectedIds={tableSelectedIds}
                    onSelectionChange={setTableSelectedIds}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Invite Dialog ─────────────────────────────────────────────────────── */}
      <Dialog open={inviteOpen} onOpenChange={(open) => { if (!open) { setInviteOpen(false); setInviteResult(null); } }}>
        <DialogContent className="max-w-md" data-testid="dialog-invite-user">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-brand-indigo" />
              Invite New User
            </DialogTitle>
            <DialogDescription>
              Send an invite to add a new user to the platform. They will receive a token to set up their account.
            </DialogDescription>
          </DialogHeader>
          {inviteResult ? (
            <div className="py-4 space-y-4">
              <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 p-4 space-y-1">
                <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">✓ Invite created for {inviteResult.email}</p>
                <p className="text-xs text-muted-foreground">Share this invite token with the user to complete their registration:</p>
              </div>
              <div className="space-y-2">
                <Label>Invite Token</Label>
                <div className="flex items-center gap-2">
                  <Input readOnly value={inviteResult.token} className="font-mono text-xs bg-muted" data-testid="input-invite-token" />
                  <Button size="icon" variant="outline" onClick={handleCopyToken} data-testid="button-copy-token">
                    {tokenCopied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="invite-email">Email Address *</Label>
                <Input id="invite-email" type="email" placeholder="user@example.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} data-testid="input-invite-email" autoFocus />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-role">Role *</Label>
                <Select value={inviteRole} onValueChange={setInviteRole}>
                  <SelectTrigger id="invite-role" data-testid="select-invite-role"><SelectValue placeholder="Select role…" /></SelectTrigger>
                  <SelectContent>
                    {ROLE_OPTIONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-account">Account (optional)</Label>
                <Select value={inviteAccountId} onValueChange={setInviteAccountId}>
                  <SelectTrigger id="invite-account" data-testid="select-invite-account"><SelectValue placeholder="No account assigned" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No account</SelectItem>
                    {Object.entries(accounts).map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setInviteOpen(false); setInviteResult(null); }}>{inviteResult ? "Close" : "Cancel"}</Button>
            {!inviteResult && (
              <Button onClick={handleSendInvite} disabled={inviteLoading || !inviteEmail.trim()} data-testid="button-send-invite">
                {inviteLoading ? "Sending…" : "Send Invite"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── View User Dialog ────────────────────────────────────────────────── */}
      <Dialog open={!!viewingUser} onOpenChange={(open) => !open && setViewingUser(null)}>
        <DialogContent className="max-w-lg" data-testid="dialog-user-detail">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="w-5 h-5 text-brand-indigo" />
              User Profile
            </DialogTitle>
            <DialogDescription>Full profile details for this user.</DialogDescription>
          </DialogHeader>
          {viewingUser && (
            <div className="py-2 space-y-4">
              <div className="flex items-center gap-4 pb-4 border-b border-border">
                <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center shrink-0">
                  {viewingUser.avatarUrl
                    ? <img src={viewingUser.avatarUrl} alt={viewingUser.fullName1 || "User"} className="w-14 h-14 rounded-full object-cover" />
                    : <User className="w-6 h-6 text-muted-foreground" />
                  }
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground" data-testid="detail-full-name">
                    {viewingUser.fullName1 || <span className="text-muted-foreground italic text-sm">No name set</span>}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    {viewingUser.role && (
                      <span className={cn("px-2.5 py-0.5 rounded-lg text-xs font-medium", ROLE_STYLES[viewingUser.role] ?? "bg-muted text-muted-foreground")} data-testid="detail-role">{viewingUser.role}</span>
                    )}
                    {viewingUser.status && (
                      <span className={cn("inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase",
                        isActive(viewingUser.status) ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400" : "bg-muted text-muted-foreground"
                      )}>
                        <span className={cn("w-1.5 h-1.5 rounded-full", isActive(viewingUser.status) ? "bg-emerald-500" : "bg-muted-foreground")} />
                        {viewingUser.status}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                {[
                  { icon: Mail,     label: "Email",        value: viewingUser.email,        testid: "detail-email"    },
                  { icon: Phone,    label: "Phone",        value: viewingUser.phone,        testid: "detail-phone"    },
                  { icon: Clock,    label: "Last Login",   value: viewingUser.lastLoginAt ? new Date(viewingUser.lastLoginAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "Never logged in", testid: "detail-last-login" },
                  viewingUser.timezone   ? { icon: Calendar, label: "Timezone", value: viewingUser.timezone, testid: "detail-timezone" } : null,
                  viewingUser.createdAt  ? { icon: Calendar, label: "Member Since", value: new Date(viewingUser.createdAt).toLocaleDateString(undefined, { dateStyle: "medium" }), testid: "detail-created-at" } : null,
                ].filter(Boolean).map((row) => row && (
                  <div key={row.testid} className="flex items-start gap-3" data-testid={row.testid}>
                    <row.icon className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-0.5">{row.label}</p>
                      <p className="text-sm text-foreground break-all">{row.value || <span className="italic text-muted-foreground">Not set</span>}</p>
                    </div>
                  </div>
                ))}

                {/* Account — clickable link to Accounts page */}
                {viewingUser.accountsId && (
                  <div className="flex items-start gap-3" data-testid="detail-account">
                    <Shield className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-0.5">Account</p>
                      <div className="flex items-center gap-2">
                        <button
                          className="text-sm text-brand-indigo hover:underline font-medium cursor-pointer inline-flex items-center gap-1"
                          onClick={() => {
                            sessionStorage.setItem("pendingAccountId", String(viewingUser.accountsId));
                            setViewingUser(null);
                            setLocation("/agency/accounts");
                          }}
                        >
                          {accounts[viewingUser.accountsId] || `Account #${viewingUser.accountsId}`}
                          <ExternalLink className="w-3 h-3 shrink-0" />
                        </button>
                        {isAdmin && (
                          <button
                            className="text-muted-foreground hover:text-foreground p-0.5 rounded"
                            title="Change account assignment"
                            onClick={() => {
                              const u = viewingUser;
                              setViewingUser(null);
                              setEditingUser(u);
                            }}
                          >
                            <Settings className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Human Takeover count */}
                <div className="flex items-start gap-3" data-testid="detail-takeovers">
                  <HandMetal className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-0.5">Human Takeovers</p>
                    <p className="text-sm text-foreground">
                      {viewDataLoading ? (
                        <span className="text-muted-foreground italic">Loading...</span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5">
                          <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-brand-indigo/10 text-brand-indigo text-xs font-bold tabular-nums">
                            {viewTakeoverCount}
                          </span>
                          <span className="text-muted-foreground text-xs">manual messages sent</span>
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                {viewingUser.preferences && (() => {
                  try {
                    const parsed = typeof viewingUser.preferences === "string" ? JSON.parse(viewingUser.preferences) : viewingUser.preferences;
                    const keys = Object.keys(parsed).filter((k) => k !== "invite_token");
                    if (keys.length === 0) return null;
                    return (
                      <div className="flex items-start gap-3" data-testid="detail-preferences">
                        <Settings className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                        <div className="min-w-0 w-full">
                          <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">Preferences</p>
                          <div className="rounded-lg bg-muted/50 border border-border p-3 space-y-1.5">
                            {keys.map((k) => (
                              <div key={k} className="flex items-start gap-2 text-xs">
                                <span className="font-mono text-muted-foreground shrink-0">{k}:</span>
                                <span className="text-foreground break-all">{String(parsed[k])}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  } catch { return null; }
                })()}
              </div>

              {/* ── Campaigns section ── */}
              <div className="pt-3 border-t border-border">
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-2 flex items-center gap-1.5">
                  <Megaphone className="w-3.5 h-3.5" />
                  Campaigns
                  {!viewDataLoading && (
                    <span className="text-[10px] tabular-nums font-normal text-muted-foreground/60 ml-0.5">({viewCampaigns.length})</span>
                  )}
                </p>
                {viewDataLoading ? (
                  <p className="text-xs text-muted-foreground italic">Loading...</p>
                ) : viewCampaigns.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">No campaigns for this account</p>
                ) : (
                  <div className="space-y-1.5 max-h-32 overflow-y-auto">
                    {viewCampaigns.map((c: any) => {
                      const name = c.name || "Unnamed";
                      const acronym = name.split(/\s+/).map((w: string) => w[0]?.toUpperCase()).join("").slice(0, 2);
                      return (
                        <button
                          key={c.id}
                          className="flex items-center gap-2.5 w-full text-left px-2 py-1.5 rounded-lg hover:bg-muted/60 transition-colors group"
                          onClick={() => {
                            sessionStorage.setItem("pendingCampaignId", String(c.id));
                            setViewingUser(null);
                            setLocation("/agency/campaigns");
                          }}
                        >
                          <span className="w-7 h-7 rounded-full bg-brand-indigo/10 text-brand-indigo text-[10px] font-bold flex items-center justify-center shrink-0">
                            {acronym}
                          </span>
                          <span className="text-sm text-foreground truncate group-hover:text-brand-indigo transition-colors">{name}</span>
                          <ExternalLink className="w-3 h-3 text-muted-foreground/40 group-hover:text-brand-indigo ml-auto shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* ── Leads section ── */}
              <div className="pt-3 border-t border-border">
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-2 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" />
                  Leads
                  {!viewDataLoading && (
                    <span className="text-[10px] tabular-nums font-normal text-muted-foreground/60 ml-0.5">({viewLeads.length})</span>
                  )}
                </p>
                {viewDataLoading ? (
                  <p className="text-xs text-muted-foreground italic">Loading...</p>
                ) : viewLeads.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">No leads for this account</p>
                ) : (
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {viewLeads.slice(0, 50).map((l: any) => {
                      const name = l.full_name_1 || l.email || `Lead #${l.id}`;
                      return (
                        <div key={l.id} className="flex items-center gap-2 px-2 py-1 rounded-lg text-sm text-foreground">
                          <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30 shrink-0" />
                          <span className="truncate">{name}</span>
                        </div>
                      );
                    })}
                    {viewLeads.length > 50 && (
                      <p className="text-xs text-muted-foreground italic px-2 pt-1">+{viewLeads.length - 50} more</p>
                    )}
                  </div>
                )}
              </div>
              {viewingUser.email === currentUserEmail && (
                <div className="pt-3 border-t border-border">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-2">Notifications</p>
                  <div className="flex gap-4">
                    <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
                      viewingUser.notificationEmail ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400" : "bg-muted text-muted-foreground"
                    )}>
                      <Mail className="w-3 h-3" />
                      Email {viewingUser.notificationEmail ? "On" : "Off"}
                    </span>
                    <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
                      viewingUser.notificationSms ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" : "bg-muted text-muted-foreground"
                    )}>
                      <Phone className="w-3 h-3" />
                      SMS {viewingUser.notificationSms ? "On" : "Off"}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setViewingUser(null)}>Close</Button>
            {viewingUser && (isAdmin || viewingUser.email === currentUserEmail) && (
              <Button onClick={() => { const u = viewingUser; setViewingUser(null); setEditingUser(u); }} data-testid="button-detail-edit">
                Edit Profile
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit User Dialog ────────────────────────────────────────────────── */}
      <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit User: {editingUser?.fullName1 || editingUser?.email}</DialogTitle>
          </DialogHeader>
          {editingUser && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input value={editingUser.fullName1 || ""} onChange={(e) => setEditingUser({ ...editingUser, fullName1: e.target.value })} data-testid="input-edit-full-name" />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={editingUser.email || ""} onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })} data-testid="input-edit-email" />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={editingUser.phone || ""} onChange={(e) => setEditingUser({ ...editingUser, phone: e.target.value })} data-testid="input-edit-phone" />
              </div>
              <div className="space-y-2">
                <Label>Timezone</Label>
                <Input value={editingUser.timezone || ""} onChange={(e) => setEditingUser({ ...editingUser, timezone: e.target.value })} data-testid="input-edit-timezone" />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={editingUser.role || ""} onValueChange={(val: any) => setEditingUser({ ...editingUser, role: val })} disabled={!isAdmin}>
                  <SelectTrigger data-testid="select-edit-role"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROLE_OPTIONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={editingUser.status || ""} onValueChange={(val: any) => setEditingUser({ ...editingUser, status: val })} disabled={!isAdmin}>
                  <SelectTrigger data-testid="select-edit-status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {editingUser.email === currentUserEmail && (
                <div className="space-y-2">
                  <Label>Password</Label>
                  <Input type="password" placeholder="Enter new password" onChange={(e) => setEditingUser({ ...editingUser, password: e.target.value } as any)} data-testid="input-edit-password" />
                </div>
              )}
              {editingUser.email === currentUserEmail && (
                <div className="space-y-2 flex flex-col justify-end gap-4">
                  <div className="flex items-center justify-between">
                    <Label>Email Notifications</Label>
                    <Switch checked={!!editingUser.notificationEmail} onCheckedChange={(checked) => setEditingUser({ ...editingUser, notificationEmail: checked })} data-testid="switch-edit-email-notif" />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>SMS Notifications</Label>
                    <Switch checked={!!editingUser.notificationSms} onCheckedChange={(checked) => setEditingUser({ ...editingUser, notificationSms: checked })} data-testid="switch-edit-sms-notif" />
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingUser(null)}>Cancel</Button>
            <Button onClick={handleSaveUser} data-testid="button-save-user">Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── Page export ───────────────────────────────────────────────────────────────
export function UsersPage() {
  return (
    <CrmShell>
      <UsersContent />
    </CrmShell>
  );
}
