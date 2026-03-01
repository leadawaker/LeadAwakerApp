import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import {
  ArrowUpDown, Filter, Eye, Check, Search, X,
  UserPlus, Mail, Phone, Copy, Clock, User, Shield, Calendar,
  Layers, Trash2, ExternalLink, Megaphone, Users, HandMetal,
} from "lucide-react";
import { useLocation } from "wouter";
import { UsersInlineTable } from "./UsersInlineTable";
import type { UserTableItem, UserColKey } from "./UsersInlineTable";
import type { AppUser, AccountMap } from "../types";
import { apiFetch } from "@/lib/apiUtils";
import { cn } from "@/lib/utils";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
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
import { ToolbarPill } from "@/components/ui/toolbar-pill";
import { EntityAvatar } from "@/components/ui/entity-avatar";
import { getInitials, ROLE_AVATAR } from "@/lib/avatarUtils";

// ── Constants ────────────────────────────────────────────────────────────────
type SortBy = "name_asc" | "name_desc" | "recent";
type GroupBy = "role" | "status" | "account" | "none";

const VISIBLE_COLS_KEY = "users-table-visible-cols";
const DEFAULT_VISIBLE_COLS: UserColKey[] = ["name", "role", "account", "email", "lastLogin"];

const ROLE_OPTIONS = ["Admin", "Operator", "Manager", "Agent", "Viewer"] as const;
const STATUS_OPTIONS = ["Active", "Inactive", "Invited"];
const ROLE_GROUP_ORDER = ["Admin", "Operator", "Manager", "Agent", "Viewer"];
const STATUS_GROUP_ORDER = ["Active", "Invited", "Inactive"];

const SORT_LABELS: Record<SortBy, string> = {
  name_asc: "Name A → Z",
  name_desc: "Name Z → A",
  recent: "Most Recent",
};
const GROUP_LABELS: Record<GroupBy, string> = {
  role: "Role", status: "Status", account: "Account", none: "None",
};
const COL_META: { key: UserColKey; label: string; defaultVisible: boolean }[] = [
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

// Toolbar pill base classes (§17.1)
const tbBase    = "h-10 px-3 rounded-full inline-flex items-center gap-1.5 text-[12px] font-medium transition-colors whitespace-nowrap shrink-0 select-none";
const tbDefault = "border border-black/[0.125] text-foreground/60 hover:text-foreground hover:bg-card";

function isActiveStatus(s: string | null | undefined) { return (s || "").toLowerCase() === "active"; }
function getUserName(u: AppUser) { return u.fullName1 || u.email || `User #${u.id}`; }

// ── Role badge styles ────────────────────────────────────────────────────────
const ROLE_STYLES: Record<string, string> = {
  Admin:    "bg-brand-yellow/20 text-brand-deep-blue dark:bg-brand-yellow/15 dark:text-brand-yellow",
  Manager:  "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  Agent:    "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  Operator: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  Viewer:   "bg-muted text-muted-foreground",
};

// ── Inline confirmation button ───────────────────────────────────────────────
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
      <div className="h-10 flex items-center gap-1 rounded-full border border-black/[0.125] bg-card px-2.5 text-[12px] shrink-0">
        <span className="text-foreground/60 mr-0.5 whitespace-nowrap">{label}?</span>
        <button
          className="px-2 py-0.5 rounded-full bg-brand-indigo text-white font-semibold text-[11px] hover:opacity-90 disabled:opacity-50"
          onClick={async () => { setLoading(true); try { await onConfirm(); } finally { setLoading(false); setConfirming(false); } }}
          disabled={loading}
        >{loading ? "…" : "Yes"}</button>
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
          : "border-black/[0.125] text-foreground/70 hover:bg-card hover:text-foreground",
      )}
      onClick={() => setConfirming(true)}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

// ── Pending invites sub-section ──────────────────────────────────────────────
function PendingInvitesSection({
  invites, accounts, resendingUserId, revokingUserId, resendResult,
  onResend, onRevoke,
}: {
  invites: AppUser[];
  accounts: AccountMap;
  resendingUserId: number | null;
  revokingUserId: number | null;
  resendResult: { userId: number; token: string } | null;
  onResend: (u: AppUser) => void;
  onRevoke: (u: AppUser) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  if (invites.length === 0) return null;

  return (
    <div className="rounded-xl border border-amber-200/80 dark:border-amber-700/40 bg-amber-50 dark:bg-amber-900/10 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left"
      >
        <Mail className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
        <span className="text-[12px] font-semibold text-amber-800 dark:text-amber-300 flex-1">
          Pending Invites
        </span>
        <span className="px-1.5 py-0.5 rounded-full bg-amber-200 dark:bg-amber-700/50 text-amber-800 dark:text-amber-300 text-[10px] font-bold tabular-nums">
          {invites.length}
        </span>
      </button>
      {expanded && (
        <div className={cn("border-t border-amber-200/60 dark:border-amber-700/30 divide-y divide-amber-100/80 dark:divide-amber-800/30", invites.length > 3 && "max-h-[176px] overflow-y-auto")}>
          {invites.map((u) => {
            const sentAt = getInviteSentAt(u);
            const expired = isInviteExpired(u);
            const resending = resendingUserId === u.id;
            const revoking  = revokingUserId === u.id;
            const busy      = resending || revoking;
            const justResent = resendResult?.userId === u.id;
            return (
              <div key={u.id} className="px-3 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="h-6 w-6 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center shrink-0">
                    <User className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-medium text-foreground truncate leading-tight">{u.email || "—"}</p>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      {u.role && <span className="px-1.5 py-px rounded text-[9px] font-semibold bg-muted text-muted-foreground">{u.role}</span>}
                      {sentAt && <span className="text-[9px] text-muted-foreground flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" />{sentAt.toLocaleDateString(undefined, { dateStyle: "medium" })}</span>}
                      {expired && <span className="px-1 py-px rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-[9px] font-medium">Expired</span>}
                      {justResent && <span className="px-1 py-px rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-[9px] font-medium">Resent</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 mt-1.5">
                  <button onClick={() => onResend(u)} disabled={busy} className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium border border-amber-300 dark:border-amber-700 bg-amber-100/60 hover:bg-amber-200/60 text-amber-800 dark:text-amber-300 disabled:opacity-50 disabled:cursor-not-allowed">
                    <Clock className={cn("w-2.5 h-2.5", resending && "animate-spin")} />{resending ? "Sending…" : "Resend"}
                  </button>
                  <button onClick={() => onRevoke(u)} disabled={busy} className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium border border-red-200 dark:border-red-700/50 bg-red-50/60 hover:bg-red-100/60 text-red-600 dark:text-red-400 disabled:opacity-50 disabled:cursor-not-allowed">
                    <X className={cn("w-2.5 h-2.5", revoking && "animate-spin")} />{revoking ? "Revoking…" : "Revoke"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function getInviteSentAt(u: AppUser): Date | null {
  if (!u.preferences) return null;
  try {
    const parsed = typeof u.preferences === "string" ? JSON.parse(u.preferences) : u.preferences;
    if (parsed?.invite_sent_at) return new Date(parsed.invite_sent_at);
  } catch {}
  return null;
}

function isInviteExpired(u: AppUser): boolean {
  const sentAt = getInviteSentAt(u);
  return sentAt ? (Date.now() - sentAt.getTime()) / (1000 * 60 * 60 * 24) > 7 : false;
}

// ══════════════════════════════════════════════════════════════════════════════
// SettingsTeamSection — main export
// ══════════════════════════════════════════════════════════════════════════════
export function SettingsTeamSection() {
  const [, setLocation] = useLocation();

  // ── Data fetching ──────────────────────────────────────────────────────────
  const [users, setUsers] = useState<AppUser[]>([]);
  const [accounts, setAccounts] = useState<AccountMap>({});
  const [campaignsByAccount, setCampaignsByAccount] = useState<Record<number, { id: number; name: string }[]>>({});
  const [loading, setLoading] = useState(true);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const [usersRes, accountsRes, campaignsRes] = await Promise.all([
        apiFetch("/api/users"),
        apiFetch("/api/accounts"),
        apiFetch("/api/campaigns"),
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
      if (campaignsRes.ok) {
        const campaignsData = await campaignsRes.json();
        const byAccount: Record<number, { id: number; name: string }[]> = {};
        if (Array.isArray(campaignsData)) {
          campaignsData.forEach((c: any) => {
            const accId = c.Accounts_id ?? c.accountsId;
            if (!accId) return;
            if (!byAccount[accId]) byAccount[accId] = [];
            byAccount[accId].push({ id: c.id, name: c.name || "Unnamed" });
          });
        }
        setCampaignsByAccount(byAccount);
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

  // ── Table state ────────────────────────────────────────────────────────────
  const [search, setSearch]       = useState("");
  const [sortBy, setSortBy]       = useState<SortBy>("name_asc");
  const [groupBy, setGroupBy]     = useState<GroupBy>("role");
  const [filterRole, setFilterRole]     = useState<string[]>([]);
  const [filterStatus, setFilterStatus] = useState<string[]>([]);
  const [selectedIds, setSelectedIds]   = useState<Set<number>>(new Set());

  const isFilterActive    = filterRole.length > 0 || filterStatus.length > 0;
  const activeFilterCount = filterRole.length + filterStatus.length;

  const toggleFilterRole   = useCallback((r: string) => setFilterRole(p => p.includes(r) ? p.filter(x => x !== r) : [...p, r]), []);
  const toggleFilterStatus = useCallback((s: string) => setFilterStatus(p => p.includes(s) ? p.filter(x => x !== s) : [...p, s]), []);
  const clearFilters       = useCallback(() => { setFilterRole([]); setFilterStatus([]); }, []);

  // ── Column visibility (persisted) ──────────────────────────────────────────
  const [visibleCols, setVisibleCols] = useState<Set<UserColKey>>(() => {
    try {
      const s = localStorage.getItem(VISIBLE_COLS_KEY);
      if (s) { const arr = JSON.parse(s); if (Array.isArray(arr) && arr.length > 0) return new Set(arr); }
    } catch {}
    return new Set(DEFAULT_VISIBLE_COLS);
  });
  useEffect(() => { try { localStorage.setItem(VISIBLE_COLS_KEY, JSON.stringify(Array.from(visibleCols))); } catch {} }, [visibleCols]);

  // ── Flat items (filtered + sorted + grouped) ──────────────────────────────
  const flatItems = useMemo((): UserTableItem[] => {
    let source = [...users];
    if (search.trim()) {
      const q = search.toLowerCase();
      source = source.filter(u =>
        (u.fullName1 || "").toLowerCase().includes(q) ||
        (u.email || "").toLowerCase().includes(q) ||
        (u.phone || "").toLowerCase().includes(q) ||
        (u.role || "").toLowerCase().includes(q) ||
        (accounts[u.accountsId ?? 0] || "").toLowerCase().includes(q)
      );
    }
    if (filterRole.length > 0)   source = source.filter(u => filterRole.includes(u.role || ""));
    if (filterStatus.length > 0) source = source.filter(u => filterStatus.includes(u.status || ""));

    source.sort((a, b) => {
      switch (sortBy) {
        case "name_asc":  return getUserName(a).localeCompare(getUserName(b));
        case "name_desc": return getUserName(b).localeCompare(getUserName(a));
        default: {
          const da = a.lastLoginAt || a.createdAt || "";
          const db = b.lastLoginAt || b.createdAt || "";
          return db.localeCompare(da);
        }
      }
    });

    if (groupBy === "none") return source.map(u => ({ kind: "user" as const, user: u }));

    const buckets = new Map<string, AppUser[]>();
    source.forEach(u => {
      let key: string;
      switch (groupBy) {
        case "role":    key = u.role || "No Role"; break;
        case "status":  key = u.status || "Unknown"; break;
        case "account": key = accounts[u.accountsId ?? 0] || "No Account"; break;
        default:        key = u.role || "No Role";
      }
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key)!.push(u);
    });

    const allKeys = Array.from(buckets.keys());
    const orderedKeys =
      groupBy === "role"
        ? ROLE_GROUP_ORDER.filter(k => buckets.has(k)).concat(allKeys.filter(k => !ROLE_GROUP_ORDER.includes(k)))
        : groupBy === "status"
        ? STATUS_GROUP_ORDER.filter(k => buckets.has(k)).concat(allKeys.filter(k => !STATUS_GROUP_ORDER.includes(k)))
        : allKeys.sort();

    const result: UserTableItem[] = [];
    orderedKeys.forEach(key => {
      const group = buckets.get(key);
      if (!group || group.length === 0) return;
      result.push({ kind: "header", label: key, count: group.length });
      group.forEach(u => result.push({ kind: "user", user: u }));
    });
    return result;
  }, [users, search, filterRole, filterStatus, sortBy, groupBy, accounts]);

  // ── CRUD handlers ──────────────────────────────────────────────────────────
  const handleUpdateField = useCallback(async (userId: number, field: string, value: any) => {
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, [field]: value } : u));
    try {
      const res = await apiFetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      if (res.ok) {
        const updated = await res.json();
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, ...updated } : u));
      } else {
        toast({ title: "Failed to update field", variant: "destructive" });
        fetchUsers();
      }
    } catch {
      toast({ title: "Failed to update field", variant: "destructive" });
      fetchUsers();
    }
  }, [fetchUsers]);

  const handleBulkDeactivate = useCallback(async () => {
    if (selectedIds.size === 0) return;
    try {
      await Promise.all(
        Array.from(selectedIds).map(id =>
          apiFetch(`/api/users/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "Inactive" }) })
        )
      );
      setSelectedIds(new Set());
      fetchUsers();
    } catch { toast({ title: "Bulk deactivate failed", variant: "destructive" }); }
  }, [selectedIds, fetchUsers]);

  // ── Invite flow ────────────────────────────────────────────────────────────
  const [inviteOpen, setInviteOpen]       = useState(false);
  const [inviteEmail, setInviteEmail]     = useState("");
  const [inviteRole, setInviteRole]       = useState("Viewer");
  const [inviteAccountId, setInviteAccountId] = useState("none");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteResult, setInviteResult]   = useState<{ token: string; email: string } | null>(null);
  const [tokenCopied, setTokenCopied]     = useState(false);

  const handleInviteOpen = useCallback(() => {
    setInviteEmail(""); setInviteRole("Viewer"); setInviteAccountId("none");
    setInviteResult(null); setTokenCopied(false); setInviteOpen(true);
  }, []);

  const handleSendInvite = useCallback(async () => {
    if (!inviteEmail.trim()) { toast({ title: "Email required", variant: "destructive" }); return; }
    setInviteLoading(true);
    try {
      const body: Record<string, any> = { email: inviteEmail.trim(), role: inviteRole };
      body.frontendOrigin = window.location.origin;
      if (inviteAccountId !== "none") body.accountsId = Number(inviteAccountId);
      const res = await apiFetch("/api/users/invite", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to send invite");
      setInviteResult({ token: data.invite_token, email: inviteEmail.trim() });
      if (data.user) setUsers(prev => [...prev, data.user]);
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

  // ── Pending invites ────────────────────────────────────────────────────────
  const pendingInvites = useMemo(() => users.filter(u => {
    if ((u.status || "").toLowerCase() !== "invited") return false;
    try {
      const prefs = typeof u.preferences === "string" ? JSON.parse(u.preferences || "{}") : (u.preferences || {});
      return !!prefs?.invite_token;
    } catch { return false; }
  }), [users]);

  const [resendingUserId, setResendingUserId] = useState<number | null>(null);
  const [revokingUserId, setRevokingUserId]   = useState<number | null>(null);
  const [resendResult, setResendResult]       = useState<{ userId: number; token: string } | null>(null);

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
      if (data.user) setUsers(prev => prev.map(usr => usr.id === u.id ? { ...usr, ...data.user } : usr));
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
      if (data.user) setUsers(prev => prev.map(usr => usr.id === u.id ? { ...usr, ...data.user } : usr));
      if (resendResult?.userId === u.id) setResendResult(null);
      toast({ title: "Invite revoked" });
    } catch (err: any) {
      toast({ title: "Failed to revoke invite", description: err.message, variant: "destructive" });
    } finally { setRevokingUserId(null); }
  }, [revokingUserId, resendResult]);

  // ── View user dialog ───────────────────────────────────────────────────────
  const [viewingUser, setViewingUser] = useState<AppUser | null>(null);
  const [viewCampaigns, setViewCampaigns] = useState<any[]>([]);
  const [viewTakeoverCount, setViewTakeoverCount] = useState(0);
  const [viewDataLoading, setViewDataLoading]     = useState(false);

  useEffect(() => {
    if (!viewingUser?.accountsId) {
      setViewCampaigns([]); setViewTakeoverCount(0);
      return;
    }
    let cancelled = false;
    setViewDataLoading(true);
    const accountId = viewingUser.accountsId;
    Promise.all([
      apiFetch(`/api/campaigns?accountId=${accountId}`).then(r => r.ok ? r.json() : []).catch(() => []),
      apiFetch(`/api/interactions?accountId=${accountId}`).then(r => r.ok ? r.json() : []).catch(() => []),
    ]).then(([campaignsData, interactionsData]) => {
      if (cancelled) return;
      setViewCampaigns(Array.isArray(campaignsData) ? campaignsData : []);
      const allInteractions = Array.isArray(interactionsData) ? interactionsData : [];
      const takeoverCount = allInteractions.filter((i: any) =>
        i.ai_generated === false && i.direction === "outbound" && (i.Who === viewingUser.fullName1 || i.Users_id === viewingUser.id || i.is_manual_follow_up === true)
      ).length;
      setViewTakeoverCount(takeoverCount);
    }).finally(() => { if (!cancelled) setViewDataLoading(false); });
    return () => { cancelled = true; };
  }, [viewingUser?.accountsId, viewingUser?.id, viewingUser?.fullName1]);

  // ── Edit user dialog ───────────────────────────────────────────────────────
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
      setUsers(prev => prev.map(u => u.id === editingUser.id ? { ...u, ...updated } : u));
      setEditingUser(null);
      toast({ title: "User updated", description: `Successfully updated ${getUserName(editingUser)}` });
    } catch {
      setEditingUser(null);
      toast({ title: "Update failed", variant: "destructive" });
    }
  }, [editingUser, currentUserEmail]);

  // ── Search input open state ────────────────────────────────────────────────
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchOpen && searchInputRef.current) searchInputRef.current.focus();
  }, [searchOpen]);

  // ── ResizeObserver for narrow toolbar ──────────────────────────────────────
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [isNarrow, setIsNarrow] = useState(false);
  useEffect(() => {
    const el = toolbarRef.current;
    if (!el) return;
    const obs = new ResizeObserver(([entry]) => setIsNarrow(entry.contentRect.width < 920));
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="flex flex-col flex-1 min-h-0 h-full">
      {/* ── Toolbar ─────────────────────────────────────────────────────────── */}
      <div ref={toolbarRef} className="flex items-center gap-1.5 flex-wrap px-3.5 pt-3 pb-2.5 shrink-0">
        {/* Invite button — opens popover below */}
        {isAdmin && (
          <Popover open={inviteOpen} onOpenChange={(open) => { if (!open) { setInviteOpen(false); setInviteResult(null); } else { handleInviteOpen(); } }} modal={false}>
            <PopoverTrigger asChild>
              <button
                className={cn(tbBase, "bg-brand-indigo text-white hover:bg-brand-indigo/90 border-brand-indigo")}
              >
                <UserPlus className="h-4 w-4" />
                {!isNarrow && "Invite"}
              </button>
            </PopoverTrigger>
            <PopoverContent side="bottom" align="start" sideOffset={6} className="w-80 p-0 rounded-xl shadow-lg border border-border/40">
              {inviteResult ? (
                <div className="p-4 space-y-3">
                  <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 p-3 space-y-1">
                    <p className="text-[12px] font-semibold text-emerald-700 dark:text-emerald-400">Invite created for {inviteResult.email}</p>
                    <p className="text-[10px] text-muted-foreground">Share this invite token with the user:</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px]">Invite Token</Label>
                    <div className="flex items-center gap-1.5">
                      <Input readOnly value={inviteResult.token} className="font-mono text-[10px] bg-muted h-8" />
                      <Button size="icon" variant="outline" onClick={handleCopyToken} className="h-8 w-8 shrink-0">
                        {tokenCopied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      </Button>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="w-full h-8 text-[11px]" onClick={() => { setInviteOpen(false); setInviteResult(null); }}>
                    Done
                  </Button>
                </div>
              ) : (
                <div className="p-4 space-y-3">
                  <div className="flex items-center gap-2 pb-2 border-b border-border/30">
                    <Mail className="w-4 h-4 text-brand-indigo shrink-0" />
                    <span className="text-[13px] font-semibold">Invite New User</span>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="invite-email" className="text-[11px]">Email *</Label>
                    <Input id="invite-email" type="email" placeholder="user@example.com" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} autoFocus className="h-8 text-[12px]" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="invite-role" className="text-[11px]">Role *</Label>
                    <Select value={inviteRole} onValueChange={setInviteRole}>
                      <SelectTrigger id="invite-role" className="h-8 text-[12px]"><SelectValue placeholder="Select role…" /></SelectTrigger>
                      <SelectContent>
                        {ROLE_OPTIONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="invite-account" className="text-[11px]">Account</Label>
                    <Select value={inviteAccountId} onValueChange={setInviteAccountId}>
                      <SelectTrigger id="invite-account" className="h-8 text-[12px]"><SelectValue placeholder="No account" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No account</SelectItem>
                        {Object.entries(accounts).map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button variant="outline" size="sm" className="flex-1 h-8 text-[11px]" onClick={() => { setInviteOpen(false); setInviteResult(null); }}>
                      Cancel
                    </Button>
                    <Button size="sm" className="flex-1 h-8 text-[11px]" onClick={handleSendInvite} disabled={inviteLoading || !inviteEmail.trim()}>
                      {inviteLoading ? "Sending…" : "Send Invite"}
                    </Button>
                  </div>
                </div>
              )}
            </PopoverContent>
          </Popover>
        )}

        <div className="w-px h-5 bg-border/40 mx-0.5 shrink-0" />

        {/* Search */}
        {searchOpen ? (
          <div className="h-10 flex items-center gap-1.5 rounded-full border border-black/[0.125] bg-card px-3 shrink-0">
            <Search className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
            <input
              ref={searchInputRef}
              className="h-full bg-transparent border-none outline-none text-[12px] text-foreground placeholder:text-muted-foreground/40 w-32 min-w-0"
              placeholder="Search users…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <button onClick={() => { setSearch(""); setSearchOpen(false); }} className="text-muted-foreground/40 hover:text-muted-foreground shrink-0">
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <button className={cn(tbBase, tbDefault)} onClick={() => setSearchOpen(true)}>
            <Search className="h-4 w-4" />
            {!isNarrow && "Search"}
          </button>
        )}

        {/* Sort */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <ToolbarPill
              icon={ArrowUpDown}
              label={isNarrow ? "" : "Sort"}
              active={sortBy !== "name_asc"}
              activeValue={sortBy !== "name_asc" ? SORT_LABELS[sortBy].split(" ")[0] : undefined}
            />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-44">
            <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">Sort by</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {(Object.keys(SORT_LABELS) as SortBy[]).map(opt => (
              <DropdownMenuItem key={opt} onClick={() => setSortBy(opt)} className={cn("text-[12px]", sortBy === opt && "font-semibold text-brand-indigo")}>
                {SORT_LABELS[opt]}
                {sortBy === opt && <Check className="h-3 w-3 ml-auto" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Filter */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <ToolbarPill
              icon={Filter}
              label={isNarrow ? "" : "Filter"}
              active={isFilterActive}
              activeValue={isFilterActive ? activeFilterCount : undefined}
            />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-52 max-h-80 overflow-y-auto">
            <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">Role</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {ROLE_OPTIONS.map(r => (
              <DropdownMenuItem key={r} onClick={e => { e.preventDefault(); toggleFilterRole(r); }} className="flex items-center gap-2 text-[12px]">
                <span className="flex-1">{r}</span>
                {filterRole.includes(r) && <Check className="h-3 w-3 text-brand-indigo shrink-0" />}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">Status</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {STATUS_OPTIONS.map(s => (
              <DropdownMenuItem key={s} onClick={e => { e.preventDefault(); toggleFilterStatus(s); }} className="flex items-center gap-2 text-[12px]">
                <span className="flex-1">{s}</span>
                {filterStatus.includes(s) && <Check className="h-3 w-3 text-brand-indigo shrink-0" />}
              </DropdownMenuItem>
            ))}
            {isFilterActive && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={clearFilters} className="text-[12px] text-destructive">Clear all filters</DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Group */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <ToolbarPill
              icon={Layers}
              label={isNarrow ? "" : "Group"}
              active={groupBy !== "role"}
              activeValue={groupBy !== "role" ? GROUP_LABELS[groupBy] : undefined}
            />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-44">
            {(Object.keys(GROUP_LABELS) as GroupBy[]).map(opt => (
              <DropdownMenuItem key={opt} onClick={() => setGroupBy(opt)} className={cn("text-[12px]", groupBy === opt && "font-semibold text-brand-indigo")}>
                {GROUP_LABELS[opt]}
                {groupBy === opt && <Check className="h-3 w-3 ml-auto" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Fields (column visibility) */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <ToolbarPill
              icon={Eye}
              label={isNarrow ? "" : "Fields"}
              active={visibleCols.size !== DEFAULT_VISIBLE_COLS.length}
            />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-52 max-h-72 overflow-y-auto">
            <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">Show / Hide Columns</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {COL_META.map(col => {
              const isVisible = visibleCols.has(col.key);
              return (
                <DropdownMenuItem
                  key={col.key}
                  onClick={e => { e.preventDefault(); setVisibleCols(prev => { const next = new Set(prev); if (next.has(col.key)) { if (next.size > 1) next.delete(col.key); } else next.add(col.key); return next; }); }}
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

        {/* Bulk deactivate — far right, when rows selected */}
        {selectedIds.size > 0 && (
          <>
            <div className="flex-1 min-w-0" />
            <ConfirmToolbarButton icon={Trash2} label="Deactivate" onConfirm={handleBulkDeactivate} variant="danger" />
          </>
        )}
      </div>

      {/* ── Pending invites ─────────────────────────────────────────────────── */}
      {isAdmin && pendingInvites.length > 0 && (
        <div className="pb-2 px-3.5 shrink-0">
          <PendingInvitesSection
            invites={pendingInvites}
            accounts={accounts}
            resendingUserId={resendingUserId}
            revokingUserId={revokingUserId}
            resendResult={resendResult}
            onResend={handleResendInvite}
            onRevoke={handleRevokeInvite}
          />
        </div>
      )}

      {/* ── Table — fills remaining space, edge-to-edge, no rounded corners */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <UsersInlineTable
          flatItems={flatItems}
          loading={loading}
          selectedUserId={null}
          onSelectUser={u => setViewingUser(u)}
          accounts={accounts}
          visibleCols={visibleCols}
          tableSearch={search}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
          campaignsByAccount={campaignsByAccount}
        />
      </div>

      {/* Invite popover is now inline in the toolbar */}

      {/* ── View User Dialog ────────────────────────────────────────────────── */}
      <Dialog open={!!viewingUser} onOpenChange={open => !open && setViewingUser(null)}>
        <DialogContent className="max-w-lg">
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
                <EntityAvatar
                  name={getUserName(viewingUser)}
                  photoUrl={viewingUser.avatarUrl}
                  bgColor={(ROLE_AVATAR[viewingUser.role || "Viewer"] ?? ROLE_AVATAR.Viewer).bg}
                  textColor={(ROLE_AVATAR[viewingUser.role || "Viewer"] ?? ROLE_AVATAR.Viewer).text}
                  size={56}
                />
                <div>
                  <h3 className="text-lg font-bold text-foreground">
                    {viewingUser.fullName1 || <span className="text-muted-foreground italic text-sm">No name set</span>}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    {viewingUser.role && (
                      <span className={cn("px-2.5 py-0.5 rounded-lg text-xs font-medium", ROLE_STYLES[viewingUser.role] ?? "bg-muted text-muted-foreground")}>{viewingUser.role}</span>
                    )}
                    {viewingUser.status && (
                      <span className={cn("inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase",
                        isActiveStatus(viewingUser.status) ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400" : "bg-muted text-muted-foreground"
                      )}>
                        <span className={cn("w-1.5 h-1.5 rounded-full", isActiveStatus(viewingUser.status) ? "bg-emerald-500" : "bg-muted-foreground")} />
                        {viewingUser.status}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                {[
                  { icon: Mail,     label: "Email",      value: viewingUser.email },
                  { icon: Phone,    label: "Phone",      value: viewingUser.phone },
                  { icon: Clock,    label: "Last Login",  value: viewingUser.lastLoginAt ? new Date(viewingUser.lastLoginAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "Never logged in" },
                  viewingUser.timezone  ? { icon: Calendar, label: "Timezone",     value: viewingUser.timezone } : null,
                  viewingUser.createdAt ? { icon: Calendar, label: "Member Since", value: new Date(viewingUser.createdAt).toLocaleDateString(undefined, { dateStyle: "medium" }) } : null,
                ].filter(Boolean).map((row) => row && (
                  <div key={row.label} className="flex items-start gap-3">
                    <row.icon className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-0.5">{row.label}</p>
                      <p className="text-sm text-foreground break-all">{row.value || <span className="italic text-muted-foreground">Not set</span>}</p>
                    </div>
                  </div>
                ))}

                {/* Account */}
                {viewingUser.accountsId && (
                  <div className="flex items-start gap-3">
                    <Shield className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-0.5">Account</p>
                      <button
                        className="text-sm text-brand-indigo hover:underline font-medium cursor-pointer inline-flex items-center gap-1"
                        onClick={() => {
                          sessionStorage.setItem("pendingAccountId", String(viewingUser.accountsId));
                          setViewingUser(null);
                          const isAgencyView = localStorage.getItem("leadawaker_user_role") !== "Manager" && localStorage.getItem("leadawaker_user_role") !== "Viewer";
                          setLocation(isAgencyView ? "/agency/accounts" : "/subaccount/accounts");
                        }}
                      >
                        {accounts[viewingUser.accountsId] || `Account #${viewingUser.accountsId}`}
                        <ExternalLink className="w-3 h-3 shrink-0" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Human Takeover count */}
                <div className="flex items-start gap-3">
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
              </div>

              {/* Campaigns */}
              <div className="pt-3 border-t border-border">
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-2 flex items-center gap-1.5">
                  <Megaphone className="w-3.5 h-3.5" />
                  Campaigns
                  {!viewDataLoading && <span className="text-[10px] tabular-nums font-normal text-muted-foreground/60 ml-0.5">({viewCampaigns.length})</span>}
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
                            const isAgencyView = localStorage.getItem("leadawaker_user_role") !== "Manager" && localStorage.getItem("leadawaker_user_role") !== "Viewer";
                            setLocation(isAgencyView ? "/agency/campaigns" : "/subaccount/campaigns");
                          }}
                        >
                          <span className="w-7 h-7 rounded-full bg-brand-indigo/10 text-brand-indigo text-[10px] font-bold flex items-center justify-center shrink-0">{acronym}</span>
                          <span className="text-sm text-foreground truncate group-hover:text-brand-indigo transition-colors">{name}</span>
                          <ExternalLink className="w-3 h-3 text-muted-foreground/40 group-hover:text-brand-indigo ml-auto shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setViewingUser(null)}>Close</Button>
            {viewingUser && (isAdmin || viewingUser.email === currentUserEmail) && (
              <Button onClick={() => { const u = viewingUser; setViewingUser(null); setEditingUser(u); }}>
                Edit Profile
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit User Dialog ────────────────────────────────────────────────── */}
      <Dialog open={!!editingUser} onOpenChange={open => !open && setEditingUser(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit User: {editingUser?.fullName1 || editingUser?.email}</DialogTitle>
          </DialogHeader>
          {editingUser && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input value={editingUser.fullName1 || ""} onChange={e => setEditingUser({ ...editingUser, fullName1: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={editingUser.email || ""} onChange={e => setEditingUser({ ...editingUser, email: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={editingUser.phone || ""} onChange={e => setEditingUser({ ...editingUser, phone: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Timezone</Label>
                <Input value={editingUser.timezone || ""} onChange={e => setEditingUser({ ...editingUser, timezone: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={editingUser.role || ""} onValueChange={(val: any) => setEditingUser({ ...editingUser, role: val })} disabled={!isAdmin}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROLE_OPTIONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={editingUser.status || ""} onValueChange={(val: any) => setEditingUser({ ...editingUser, status: val })} disabled={!isAdmin}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {editingUser.email === currentUserEmail && (
                <div className="space-y-2">
                  <Label>Password</Label>
                  <Input type="password" placeholder="Enter new password" onChange={e => setEditingUser({ ...editingUser, password: e.target.value } as any)} />
                </div>
              )}
              {editingUser.email === currentUserEmail && (
                <div className="space-y-2 flex flex-col justify-end gap-4">
                  <div className="flex items-center justify-between">
                    <Label>Email Notifications</Label>
                    <Switch checked={!!editingUser.notificationEmail} onCheckedChange={checked => setEditingUser({ ...editingUser, notificationEmail: checked })} />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>SMS Notifications</Label>
                    <Switch checked={!!editingUser.notificationSms} onCheckedChange={checked => setEditingUser({ ...editingUser, notificationSms: checked })} />
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingUser(null)}>Cancel</Button>
            <Button onClick={handleSaveUser}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
