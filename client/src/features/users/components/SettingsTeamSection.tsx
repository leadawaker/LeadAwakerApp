import React, { useState, useMemo, useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { usePersistedState } from "@/hooks/usePersistedState";
import { useIsMobile } from "@/hooks/useIsMobile";
import {
  ArrowUpDown, Filter, Check, Search, X, Plus,
  Mail, Phone, Copy, Clock, User, Shield, Calendar,
  Layers, Trash2, ExternalLink, Megaphone, Users, HandMetal, Eye,
} from "lucide-react";
import { useLocation } from "wouter";
import { ProfileSection } from "@/features/settings/components/ProfileSection";
import { UsersCardGrid } from "./UsersCardGrid";
import type { UserTableItem } from "./UsersInlineTable";
import type { AppUser, AccountMap } from "../types";
import { apiFetch } from "@/lib/apiUtils";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useSession } from "@/hooks/useSession";
import { useImpersonation } from "@/hooks/useImpersonation";
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
import { EntityAvatar } from "@/components/ui/entity-avatar";
import { getInitials, ROLE_AVATAR } from "@/lib/avatarUtils";

// ── Constants ────────────────────────────────────────────────────────────────
type SortBy = "name_asc" | "name_desc" | "recent";
type GroupBy = "role" | "status" | "account" | "none";

const ROLE_OPTIONS = ["Admin", "Manager", "Viewer"] as const;
const STATUS_OPTIONS = ["Active", "Inactive", "Invited"];
const ROLE_GROUP_ORDER = ["Admin", "Manager", "Viewer"];
const STATUS_GROUP_ORDER = ["Active", "Invited", "Inactive"];

const SORT_LABELS: Record<SortBy, string> = {
  name_asc: "Name A → Z",
  name_desc: "Name Z → A",
  recent: "Most Recent",
};
const GROUP_LABELS: Record<GroupBy, string> = {
  role: "Role", status: "Status", account: "Account", none: "None",
};

// Expand-on-hover button constants
const xBase    = "group inline-flex items-center h-9 pl-[9px] rounded-full border text-[12px] font-medium overflow-hidden shrink-0 transition-[max-width,color,border-color] duration-200 max-w-9";
const xDefault = "border-[var(--line)] text-foreground/60 hover:text-foreground";
const xSpan    = "whitespace-nowrap pl-1.5 pr-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150";

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
  const isMobile = useIsMobile();
  if (confirming) {
    return (
      <div className="h-9 flex items-center gap-1 rounded-full border border-[var(--line)] bg-card px-2.5 text-[12px] shrink-0">
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
        xBase,
        variant === "danger"
          ? cn("border-red-300/50 text-foreground/60 hover:text-red-600 hover:border-red-300/50", isMobile ? "max-w-[120px]" : "hover:max-w-[120px]")
          : cn(xDefault, isMobile ? "max-w-[120px]" : "hover:max-w-[120px]"),
      )}
      onClick={() => setConfirming(true)}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className={cn(xSpan, isMobile && "!opacity-100")}>{label}</span>
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
export function SettingsTeamSection({ isUltrawide = false }: { isUltrawide?: boolean }) {
  const { t } = useTranslation("settings");
  const [, setLocation] = useLocation();
  const isMobile = useIsMobile();
  const { currentAccountId, isOwner } = useWorkspace();
  const session = useSession();
  const { impersonate } = useImpersonation();

  // ── Data fetching ──────────────────────────────────────────────────────────
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

  // ── Toolbar portal: renders toolbar into Settings topbar slot when available ─
  const [slotEl, setSlotEl] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    const el = document.getElementById("settings-team-toolbar-slot") ?? null;
    setSlotEl((prev) => (prev !== el ? el : prev));
  });

  // ── Default-select current user once list loads ─────────────────────────────
  const defaultApplied = useRef(false);
  useEffect(() => {
    if (defaultApplied.current || loading || users.length === 0) return;
    const sessionEmail = session.status === "authenticated" ? session.user.email : null;
    const match = sessionEmail ? users.find((u) => u.email === sessionEmail) : null;
    if (match) {
      setViewingUser(match);
      defaultApplied.current = true;
    }
  }, [loading, users, session.status]);

  const currentUserEmail = localStorage.getItem("leadawaker_user_email") || "";
  const currentUserRole  = localStorage.getItem("leadawaker_user_role") || "Viewer";
  const isAdmin = currentUserRole === "Admin";

  // ── Table state (persisted) ────────────────────────────────────────────────
  const [search, setSearch]       = useState("");
  const [teamPrefs, setTeamPrefs] = usePersistedState("team-prefs", {
    sortBy: "name_asc" as SortBy,
    groupBy: "account" as GroupBy,
    filterRole: [] as string[],
    filterStatus: [] as string[],
  });
  const sortBy = teamPrefs.sortBy;
  const groupBy = teamPrefs.groupBy;
  const filterRole = teamPrefs.filterRole;
  const filterStatus = teamPrefs.filterStatus;
  const setSortBy = useCallback((v: SortBy) => setTeamPrefs(p => ({ ...p, sortBy: v })), [setTeamPrefs]);
  const setGroupBy = useCallback((v: GroupBy) => setTeamPrefs(p => ({ ...p, groupBy: v })), [setTeamPrefs]);
  const setFilterRole = useCallback((v: string[] | ((p: string[]) => string[])) => setTeamPrefs(p => ({ ...p, filterRole: typeof v === "function" ? v(p.filterRole) : v })), [setTeamPrefs]);
  const setFilterStatus = useCallback((v: string[] | ((p: string[]) => string[])) => setTeamPrefs(p => ({ ...p, filterStatus: typeof v === "function" ? v(p.filterStatus) : v })), [setTeamPrefs]);
  const [selectedIds, setSelectedIds]   = useState<Set<number>>(new Set());

  const isFilterActive    = filterRole.length > 0 || filterStatus.length > 0;
  const activeFilterCount = filterRole.length + filterStatus.length;

  const toggleFilterRole   = useCallback((r: string) => setFilterRole(p => p.includes(r) ? p.filter(x => x !== r) : [...p, r]), []);
  const toggleFilterStatus = useCallback((s: string) => setFilterStatus(p => p.includes(s) ? p.filter(x => x !== s) : [...p, s]), []);
  const clearFilters       = useCallback(() => { setFilterRole([]); setFilterStatus([]); }, []);

  const toggleSelectUser = useCallback((id: number) => {
    if (!isOwner) return;
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, [isOwner]);

  // ── Flat items (filtered + sorted + grouped) ──────────────────────────────
  const flatItems = useMemo((): UserTableItem[] => {
    let source = [...users];
    // When a specific subaccount is selected, show only users belonging to it
    if (currentAccountId > 0) {
      source = source.filter(u => u.accountsId === currentAccountId);
    }
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
  const [inviteAccountId, setInviteAccountId] = useState("");
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
      if (inviteAccountId) body.accountsId = Number(inviteAccountId);
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

  // Deep-link: AccountDetailView sets pendingUserSelection to auto-open a user
  useEffect(() => {
    if (loading || users.length === 0) return;
    const pending = sessionStorage.getItem("pendingUserSelection");
    if (!pending) return;
    sessionStorage.removeItem("pendingUserSelection");
    const uid = Number(pending);
    const match = users.find((u) => u.id === uid);
    if (match) setViewingUser(match);
  }, [loading, users]);

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
  // Self-edit reuses the full ProfileSection (avatar, secure password, Gmail, impersonation)
  const [editingSelf, setEditingSelf] = useState(false);

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

  const searchInputRef = useRef<HTMLInputElement>(null);

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="flex flex-col flex-1 min-h-0 h-full">
      {/* ── Toolbar — portaled into Settings topbar on normal screens, inline on ultrawide ── */}
      {(() => {
        const toolbarInner = (
          <div className={cn(
            "flex items-center gap-1.5 flex-wrap shrink-0",
            slotEl ? "" : isUltrawide ? "px-3.5 py-2.5 border-b border-[color:var(--line)]" : "px-3.5 pt-3 pb-2.5",
          )}>
        {/* Spacer — pushes invite / search / filter / sort / group to the right edge */}
        <div className="flex-1 min-w-0" />

        {/* Invite button — opens popover below (owner or admin) */}
        {(isAdmin || isOwner) && (
          <Popover open={inviteOpen} onOpenChange={(open) => { if (!open) { setInviteOpen(false); setInviteResult(null); } else { handleInviteOpen(); } }} modal={false}>
            <PopoverTrigger asChild>
              <button
                className="la-btn la-btn--wine la-btn--icon shrink-0"
                title="Invite user"
                data-testid="button-invite-user"
              >
                <Plus className="h-4 w-4 shrink-0" />
              </button>
            </PopoverTrigger>
            <PopoverContent side="bottom" align="start" sideOffset={6} className="w-80 p-0 rounded-xl shadow-lg border border-border/40">
              {inviteResult ? (
                <div className="p-4 space-y-3">
                  <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <p className="text-[12px] font-semibold text-emerald-700 dark:text-emerald-400">Invite email sent to {inviteResult.email}</p>
                    </div>
                    <p className="text-[10px] text-muted-foreground">They'll receive an email with a link to set up their account. No action needed from you.</p>
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
                      <SelectTrigger id="invite-account" className="h-8 text-[12px]"><SelectValue placeholder="Select account…" /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(accounts).map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button variant="outline" size="sm" className="flex-1 h-8 text-[11px]" onClick={() => { setInviteOpen(false); setInviteResult(null); }}>
                      Cancel
                    </Button>
                    <Button size="sm" className="flex-1 h-8 text-[11px]" onClick={handleSendInvite} disabled={inviteLoading || !inviteEmail.trim() || !inviteAccountId}>
                      {inviteLoading ? "Sending…" : "Send Invite"}
                    </Button>
                  </div>
                </div>
              )}
            </PopoverContent>
          </Popover>
        )}

        {/* Search — persistent inline input */}
        <div className="relative shrink-0" style={{ width: 160 }}>
          <input
            ref={searchInputRef}
            className="neu-input"
            style={{ paddingLeft: 28, paddingTop: 0, paddingBottom: 0, paddingRight: search ? 28 : 10, height: 32, fontSize: 12 }}
            placeholder="Search users…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <span className="absolute left-[9px] top-1/2 -translate-y-1/2 text-[var(--mute-2)] flex pointer-events-none">
            <Search className="h-3 w-3" />
          </span>
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-[9px] top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-muted-foreground">
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Filter */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="la-btn la-btn--soft la-btn--icon shrink-0" style={{ position: "relative" }} title="Filter" data-testid="button-filter">
              <Filter className="h-4 w-4 shrink-0" />
              {isFilterActive && <span style={{ position: "absolute", bottom: 4, left: "50%", transform: "translateX(-50%)", width: 4, height: 4, borderRadius: "50%", background: "var(--wine)" }} />}
            </button>
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

        {/* Sort */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="la-btn la-btn--soft la-btn--icon shrink-0" style={{ position: "relative" }} title="Sort" data-testid="button-sort">
              <ArrowUpDown className="h-4 w-4 shrink-0" />
              {sortBy !== "name_asc" && <span style={{ position: "absolute", bottom: 4, left: "50%", transform: "translateX(-50%)", width: 4, height: 4, borderRadius: "50%", background: "var(--wine)" }} />}
            </button>
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

        {/* Group */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="la-btn la-btn--soft la-btn--icon shrink-0" style={{ position: "relative" }} title="Group" data-testid="button-group">
              <Layers className="h-4 w-4 shrink-0" />
              {groupBy !== "account" && <span style={{ position: "absolute", bottom: 4, left: "50%", transform: "translateX(-50%)", width: 4, height: 4, borderRadius: "50%", background: "var(--wine)" }} />}
            </button>
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

        {/* Bulk deactivate — when avatars are multi-selected (Owner-only) */}
        {isOwner && selectedIds.size > 0 && (
          <ConfirmToolbarButton icon={Trash2} label="Deactivate" onConfirm={handleBulkDeactivate} variant="danger" />
        )}
          </div>
        );
        return slotEl ? createPortal(toolbarInner, slotEl) : toolbarInner;
      })()}

      {/* ── Team section lives directly on the page background ── */}
      <div className="flex flex-col flex-1 min-h-0">
        {/* Pending invites */}
        {(isAdmin || isOwner) && pendingInvites.length > 0 && (
          <div className="pb-2 shrink-0 px-2">
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

        {/* Team title */}
        <div className="px-2 pb-3 shrink-0">
          <div className="px-3.5">
            <span className="serif" style={{ fontSize: 24, color: "var(--ink)", letterSpacing: "0.02em", fontWeight: 400, lineHeight: 1 }}>{t("team.title", "Team")}</span>
          </div>
        </div>

        {/* Split: cards (left) + detail (right, raised white panel) */}
        <div className="flex flex-1 min-h-0 gap-4 flex-row-reverse">
          {/* Detail — its own raised white panel, on the right */}
          {viewingUser && (
            <div className="neu-raised rounded-2xl bg-card shrink-0 flex flex-col min-h-0" style={{ width: 600 }}>
              {/* Header: big name + badges + close */}
              <div className="px-6 pt-5 pb-4 shrink-0">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex items-start gap-4">
                    <EntityAvatar
                      name={getUserName(viewingUser)}
                      photoUrl={viewingUser.avatarUrl}
                      bgColor={ROLE_AVATAR[viewingUser.role || "Viewer"]?.bg}
                      textColor={ROLE_AVATAR[viewingUser.role || "Viewer"]?.text}
                      size={120}
                    />
                    <div className="min-w-0 pt-1">
                      <h3 className="text-[34px] font-heading text-foreground leading-[1.05] truncate" style={{ fontWeight: 300, fontStyle: "italic", letterSpacing: "-0.015em" }}>
                        {viewingUser.fullName1 || <span className="text-muted-foreground italic text-2xl">No name set</span>}
                      </h3>
                    <div className="flex flex-wrap items-center gap-2 mt-3">
                      {viewingUser.role && (
                        <span className={cn("px-2.5 py-1 rounded-md text-[12px] font-semibold", ROLE_STYLES[viewingUser.role] ?? "bg-muted text-muted-foreground")}>
                          {viewingUser.role}
                        </span>
                      )}
                      {viewingUser.status && (
                        <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase",
                          isActiveStatus(viewingUser.status) ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400" : "bg-muted text-muted-foreground"
                        )}>
                          <span className={cn("w-1.5 h-1.5 rounded-full", isActiveStatus(viewingUser.status) ? "bg-emerald-500" : "bg-muted-foreground")} />
                          {viewingUser.status}
                        </span>
                      )}
                    </div>
                    </div>
                  </div>
                  {(isAdmin || isOwner || viewingUser.email === currentUserEmail) && (
                    <button
                      type="button"
                      className="h-10 px-4 rounded-md inline-flex items-center justify-center gap-2 text-[13px] font-semibold shrink-0"
                      style={{ background: "var(--bg)", boxShadow: "0 2px 4px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)", color: "var(--ink)" }}
                      onClick={() => {
                        const u = viewingUser;
                        if (u.email === currentUserEmail) setEditingSelf(true);
                        else { setViewingUser(null); setEditingUser(u); }
                      }}
                    >
                      <User className="h-4 w-4" />
                      Edit Profile
                    </button>
                  )}
                </div>
              </div>

              {/* Body: 2-column info grid + campaigns */}
              <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-5">
                <div className="grid grid-cols-2 gap-x-5 gap-y-4">
                  {[
                    { label: "Email",        value: viewingUser.email },
                    { label: "Phone",        value: viewingUser.phone },
                    { label: "Last Login",   value: viewingUser.lastLoginAt && viewingUser.lastLoginAt !== ""
                      ? new Date(viewingUser.lastLoginAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
                      : "Never logged in" },
                    { label: "Member Since", value: viewingUser.createdAt ? new Date(viewingUser.createdAt).toLocaleDateString(undefined, { dateStyle: "medium" }) : null },
                    viewingUser.timezone ? { label: "Timezone", value: viewingUser.timezone } : null,
                    viewingUser.accountsId ? { label: "Account", value: accounts[viewingUser.accountsId] || `Account #${viewingUser.accountsId}`, isAccount: true } : null,
                  ].filter(Boolean).map((row) => row && (
                    <div key={row.label} className="min-w-0">
                      <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium mb-1">{row.label}</p>
                      {(row as any).isAccount ? (
                        <button
                          className="text-[14px] font-medium hover:underline inline-flex items-center gap-1 leading-snug truncate max-w-full"
                          style={{ color: "var(--wine)" }}
                          onClick={() => {
                            sessionStorage.setItem("pendingAccountId", String(viewingUser.accountsId));
                            setViewingUser(null);
                            setLocation("/platform/accounts");
                          }}
                        >
                          <span className="truncate">{(row as any).value}</span>
                          <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                        </button>
                      ) : (
                        <p className="text-[14px] text-foreground break-words leading-snug">
                          {row.value || <span className="italic text-muted-foreground">Not set</span>}
                        </p>
                      )}
                    </div>
                  ))}
                </div>

                {/* Takeovers */}
                <div className="mt-5 pt-4 border-t" style={{ borderColor: "var(--line)" }}>
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium mb-1.5 flex items-center gap-1.5">
                    <HandMetal className="w-3.5 h-3.5" />Takeovers
                  </p>
                  {viewDataLoading ? <span className="text-[12px] italic text-muted-foreground">…</span> : (
                    <span className="inline-flex items-center gap-2">
                      <span className="inline-flex items-center justify-center min-w-[24px] h-6 px-2 rounded-full text-[13px] font-bold tabular-nums" style={{ background: "var(--wine-tint)", color: "var(--wine)" }}>{viewTakeoverCount}</span>
                      <span className="text-[12px] text-muted-foreground">messages sent</span>
                    </span>
                  )}
                </div>

                {/* Campaigns — bigger, with avatars */}
                <div className="mt-4 pt-4 border-t" style={{ borderColor: "var(--line)" }}>
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium mb-2 flex items-center gap-1.5">
                    <Megaphone className="w-3.5 h-3.5" />Campaigns
                    {!viewDataLoading && <span className="font-normal text-muted-foreground/50 ml-0.5">({viewCampaigns.length})</span>}
                  </p>
                  {viewDataLoading ? <span className="text-[12px] italic text-muted-foreground">…</span> :
                  viewCampaigns.length === 0 ? <span className="text-[12px] italic text-muted-foreground">None</span> : (
                    <div className="space-y-1.5">
                      {viewCampaigns.slice(0, 8).map((c: any) => {
                        const cname = c.name || "Unnamed";
                        return (
                          <button
                            key={c.id}
                            className="flex items-center gap-2.5 w-full text-left group rounded-lg px-1.5 py-1 -mx-1.5 hover:bg-muted/40 transition-colors"
                            onClick={() => { sessionStorage.setItem("pendingCampaignId", String(c.id)); setViewingUser(null); setLocation("/platform/campaigns"); }}
                          >
                            <EntityAvatar name={cname} size={30} bgColor="var(--wine-tint)" textColor="var(--wine)" />
                            <span className="text-[13px] font-medium text-foreground truncate group-hover:underline">{cname}</span>
                          </button>
                        );
                      })}
                      {viewCampaigns.length > 8 && <span className="text-[11px] text-muted-foreground italic">+{viewCampaigns.length - 8} more</span>}
                    </div>
                  )}
                </div>

                {/* Impersonation — Owner only, at the bottom */}
                {isOwner && viewingUser.email === currentUserEmail && (
                  <div className="mt-4 pt-4 border-t" style={{ borderColor: "var(--line)" }}>
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium mb-3 flex items-center gap-1.5">
                      <Eye className="w-3.5 h-3.5" />View As
                    </p>
                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={() => impersonate("Admin")}
                        className="w-full h-9 rounded-lg inline-flex items-center justify-center gap-2.5 text-[12px] font-semibold border"
                        style={{ background: "var(--bg)", borderColor: "var(--line)", color: "var(--ink)" }}
                      >
                        <div className="h-4 w-4 rounded flex items-center justify-center text-[9px] font-bold shrink-0 bg-primary text-primary-foreground">A</div>
                        Admin
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const selectedAccount = currentAccountId > 0 ? accounts.find(a => a.id === currentAccountId) : null;
                          const clientLabel = selectedAccount
                            ? `Client: ${selectedAccount.name}`
                            : "Client (sandbox)";
                          impersonate("Manager", selectedAccount ? currentAccountId : undefined);
                        }}
                        className="w-full h-9 rounded-lg inline-flex items-center justify-center gap-2.5 text-[12px] font-semibold border"
                        style={{ background: "var(--bg)", borderColor: "var(--line)", color: "var(--ink)" }}
                      >
                        <div className="h-4 w-4 rounded flex items-center justify-center text-[9px] font-bold shrink-0 bg-muted-foreground/20 text-muted-foreground">C</div>
                        View as Client
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Cards — left side */}
          <div className="flex-1 min-w-0 flex flex-col min-h-0 overflow-hidden px-2">
            <div className="flex-1 min-h-0 overflow-y-auto">
              <UsersCardGrid
                flatItems={flatItems}
                loading={loading}
                accounts={accounts}
                selectedUserId={viewingUser?.id ?? null}
                onSelectUser={u => setViewingUser(u)}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelectUser}
                canMultiSelect={isOwner}
              />
            </div>
          </div>
        </div>
      </div>

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
                <Select value={editingUser.timezone || ""} onValueChange={(val: any) => setEditingUser({ ...editingUser, timezone: val })}>
                  <SelectTrigger><SelectValue placeholder="Select timezone" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="America/Sao_Paulo">America/Sao Paulo</SelectItem>
                    <SelectItem value="Europe/Amsterdam">Europe/Amsterdam</SelectItem>
                  </SelectContent>
                </Select>
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

      {/* ── Self-edit popup — full ProfileSection (avatar, secure password, Gmail, impersonation) ── */}
      <Dialog open={editingSelf} onOpenChange={(o) => setEditingSelf(o)}>
        <DialogContent className="max-w-3xl max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("team.editMyProfile", "Edit My Profile")}</DialogTitle>
            <DialogDescription className="sr-only">{t("team.editMyProfile", "Edit My Profile")}</DialogDescription>
          </DialogHeader>
          <ProfileSection />
        </DialogContent>
      </Dialog>
    </div>
  );
}
