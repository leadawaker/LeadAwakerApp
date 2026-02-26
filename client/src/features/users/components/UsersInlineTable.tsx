import { useState, useMemo, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight, Check, Eye, Users } from "lucide-react";
import type { AppUser, AccountMap } from "../pages/UsersPage";

// ── Types ─────────────────────────────────────────────────────────────────────
export type UserTableItem =
  | { kind: "header"; label: string; count: number }
  | { kind: "user"; user: AppUser };

export type UserColKey =
  | "name" | "account" | "email" | "phone"
  | "role" | "status" | "lastLogin" | "memberSince" | "timezone";

interface ColumnDef {
  key: UserColKey;
  label: string;
  width: number;
}

const ALL_TABLE_COLUMNS: ColumnDef[] = [
  { key: "name",        label: "Name",         width: 220 },
  { key: "account",     label: "Account",      width: 160 },
  { key: "email",       label: "Email",        width: 210 },
  { key: "phone",       label: "Phone",        width: 140 },
  { key: "role",        label: "Role",         width: 115 },
  { key: "status",      label: "Status",       width: 115 },
  { key: "lastLogin",   label: "Last Login",   width: 130 },
  { key: "memberSince", label: "Member Since", width: 125 },
  { key: "timezone",    label: "Timezone",     width: 160 },
];

// ── Role + Status badge styles ────────────────────────────────────────────────
const ROLE_BADGE: Record<string, string> = {
  Admin:    "bg-brand-yellow/20 text-brand-deep-blue",
  Operator: "bg-orange-100 text-orange-700",
  Manager:  "bg-blue-100 text-blue-700",
  Agent:    "bg-purple-100 text-purple-700",
  Viewer:   "bg-muted text-muted-foreground",
};

const ROLE_AVATAR: Record<string, { bg: string; text: string }> = {
  Admin:    { bg: "#FEF9C3", text: "#854D0E" },
  Operator: { bg: "#FFEDD5", text: "#9A3412" },
  Manager:  { bg: "#DBEAFE", text: "#1E40AF" },
  Agent:    { bg: "#EDE9FE", text: "#5B21B6" },
  Viewer:   { bg: "#E5E7EB", text: "#374151" },
};

function getInitials(name: string): string {
  return name.split(" ").map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "?";
}

function isActiveStatus(status: string | null | undefined): boolean {
  return (status || "").toLowerCase() === "active";
}

function isInvited(status: string | null | undefined): boolean {
  return (status || "").toLowerCase() === "invited";
}

function formatRelativeDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "—";
    const diff = Math.floor((Date.now() - d.getTime()) / 86_400_000);
    if (diff === 0) return "Today";
    if (diff === 1) return "Yesterday";
    if (diff < 7) return `${diff}d ago`;
    if (diff < 30) return `${Math.floor(diff / 7)}w ago`;
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  } catch { return "—"; }
}

function formatShortDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString([], { dateStyle: "medium" });
  } catch { return "—"; }
}

// ── Loading skeleton ──────────────────────────────────────────────────────────
function TableSkeleton() {
  return (
    <div className="p-3 space-y-1.5">
      <div className="h-8 bg-[#D1D1D1] rounded animate-pulse mb-2" />
      {Array.from({ length: 9 }).map((_, i) => (
        <div
          key={i}
          className="h-[52px] bg-[#F1F1F1]/70 rounded-xl animate-pulse"
          style={{ animationDelay: `${i * 35}ms` }}
        />
      ))}
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface UsersInlineTableProps {
  flatItems: UserTableItem[];
  loading: boolean;
  selectedUserId: number | null;
  onSelectUser: (user: AppUser) => void;
  accounts: AccountMap;
  visibleCols: Set<UserColKey>;
  tableSearch: string;
  /** Multi-select state — lifted to parent */
  selectedIds: Set<number>;
  onSelectionChange: (ids: Set<number>) => void;
}

// ── Main component ─────────────────────────────────────────────────────────────
export function UsersInlineTable({
  flatItems,
  loading,
  selectedUserId,
  onSelectUser,
  accounts,
  visibleCols,
  tableSearch,
  selectedIds,
  onSelectionChange,
}: UsersInlineTableProps) {
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const lastClickedIndexRef = useRef<number>(-1);

  const toggleGroup = useCallback((label: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      next.has(label) ? next.delete(label) : next.add(label);
      return next;
    });
  }, []);

  const visibleColumns = useMemo(
    () => ALL_TABLE_COLUMNS.filter((c) => visibleCols.has(c.key)),
    [visibleCols]
  );

  // +1 for checkbox column, +1 for name (always first sticky)
  const colSpan = visibleColumns.length;

  // Client-side search filter
  const displayItems = useMemo(() => {
    if (!tableSearch.trim()) return flatItems;
    const q = tableSearch.toLowerCase();
    const result: UserTableItem[] = [];
    for (const item of flatItems) {
      if (item.kind === "header") { result.push(item); continue; }
      const u = item.user;
      const matches =
        (u.fullName1 || "").toLowerCase().includes(q) ||
        (u.email || "").toLowerCase().includes(q) ||
        (u.phone || "").toLowerCase().includes(q) ||
        (u.role || "").toLowerCase().includes(q) ||
        (accounts[u.accountsId ?? 0] || "").toLowerCase().includes(q);
      if (matches) result.push(item);
    }
    return result;
  }, [flatItems, tableSearch, accounts]);

  // ── Ordered user-only items (for shift-click range) ───────────────────────
  const userOnlyItems = useMemo(
    () => displayItems.filter((i): i is Extract<UserTableItem, { kind: "user" }> => i.kind === "user"),
    [displayItems]
  );

  const userIndexMap = useMemo(() => {
    const map = new Map<number, number>();
    userOnlyItems.forEach((item, idx) => map.set(item.user.id, idx));
    return map;
  }, [userOnlyItems]);

  const userCount = userOnlyItems.length;

  // ── Row click ────────────────────────────────────────────────────────────
  const handleRowClick = useCallback((user: AppUser, e: React.MouseEvent) => {
    const uid = user.id;
    const idx = userIndexMap.get(uid) ?? -1;

    if (e.shiftKey && lastClickedIndexRef.current >= 0) {
      const lo = Math.min(lastClickedIndexRef.current, idx);
      const hi = Math.max(lastClickedIndexRef.current, idx);
      const rangeIds = userOnlyItems.slice(lo, hi + 1).map((i) => i.user.id);
      const next = new Set(selectedIds);
      rangeIds.forEach((id) => next.add(id));
      onSelectionChange(next);
      if (next.size === 1) {
        const only = userOnlyItems.find((i) => i.user.id === Array.from(next)[0]);
        if (only) onSelectUser(only.user);
      }
    } else if (e.ctrlKey || e.metaKey) {
      const next = new Set(selectedIds);
      if (next.has(uid)) next.delete(uid); else next.add(uid);
      onSelectionChange(next);
      if (next.size === 1) {
        const only = userOnlyItems.find((i) => i.user.id === Array.from(next)[0]);
        if (only) onSelectUser(only.user);
      }
      lastClickedIndexRef.current = idx;
    } else {
      // Simple click: single select + open detail
      onSelectionChange(new Set([uid]));
      onSelectUser(user);
      lastClickedIndexRef.current = idx;
    }
  }, [userIndexMap, userOnlyItems, onSelectUser, onSelectionChange, selectedIds]);

  // ── Cell content ──────────────────────────────────────────────────────────
  function getCellContent(user: AppUser, key: UserColKey, isHighlighted: boolean): React.ReactNode {
    switch (key) {
      case "name":
        return null; // rendered separately as the sticky first cell
      case "account":
        return (
          <span className="text-muted-foreground text-[12px] truncate">
            {user.accountsId
              ? (accounts[user.accountsId] || `Account #${user.accountsId}`)
              : <span className="italic opacity-50">—</span>}
          </span>
        );
      case "email":
        return <span className="text-muted-foreground text-[12px] truncate">{user.email || <span className="italic opacity-50">—</span>}</span>;
      case "phone":
        return <span className="text-muted-foreground text-[12px] font-mono">{user.phone || <span className="italic opacity-50">—</span>}</span>;
      case "role":
        return user.role ? (
          <span className={cn("px-2 py-0.5 rounded-lg text-[11px] font-semibold", ROLE_BADGE[user.role] ?? "bg-muted text-muted-foreground")}>
            {user.role}
          </span>
        ) : <span className="text-muted-foreground italic text-xs">—</span>;
      case "status":
        return (
          <span className={cn(
            "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase",
            isActiveStatus(user.status)
              ? "bg-emerald-100 text-emerald-700"
              : isInvited(user.status)
              ? "bg-amber-100 text-amber-700"
              : "bg-muted text-muted-foreground"
          )}>
            <span className={cn("w-1.5 h-1.5 rounded-full shrink-0",
              isActiveStatus(user.status) ? "bg-emerald-500"
              : isInvited(user.status) ? "bg-amber-500"
              : "bg-muted-foreground"
            )} />
            {user.status || "—"}
          </span>
        );
      case "lastLogin":
        return <span className="text-muted-foreground text-[12px] tabular-nums">{formatRelativeDate(user.lastLoginAt)}</span>;
      case "memberSince":
        return <span className="text-muted-foreground text-[12px]">{formatShortDate(user.createdAt)}</span>;
      case "timezone":
        return <span className="text-muted-foreground text-[12px] truncate">{user.timezone || <span className="italic opacity-50">—</span>}</span>;
    }
  }

  if (loading) return <TableSkeleton />;

  // Track current group for collapse logic
  let currentGroup: string | null = null;

  return (
    <div className="h-full flex flex-col overflow-hidden bg-transparent">

      {/* ── Table ── */}
      <div className="flex-1 min-h-0 overflow-auto">
        <table className="w-full" style={{ borderCollapse: "collapse", minWidth: 700 }}>

          {/* Sticky column header */}
          <thead className="sticky top-0 z-20">
            <tr>
              {/* Checkbox column header */}
              <th className="px-2.5 py-2 w-10 min-w-[40px] bg-muted border-b border-border/20 sticky left-0 z-30" />

              {visibleColumns.map((col, ci) => (
                <th
                  key={col.key}
                  className={cn(
                    "px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-foreground/50 whitespace-nowrap select-none bg-muted border-b border-border/20",
                    ci === 0 && col.key !== "name" && "sticky left-10 z-30",
                  )}
                  style={{ width: col.width, minWidth: col.width }}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {/* Empty state */}
            {userCount === 0 && (
              <tr>
                <td colSpan={colSpan + 1} className="py-12 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <Users className="h-7 w-7 text-muted-foreground/30" />
                    <p className="text-xs text-muted-foreground">
                      {tableSearch ? "No users match your search" : "No users found"}
                    </p>
                  </div>
                </td>
              </tr>
            )}

            {displayItems.map((item, index) => {
              if (item.kind === "header") {
                currentGroup = item.label;
                const isCollapsed = collapsedGroups.has(item.label);
                return (
                  <tr
                    key={`h-${item.label}-${index}`}
                    className="cursor-pointer select-none hover:bg-black/[0.02]"
                    onClick={() => toggleGroup(item.label)}
                  >
                    {/* Sticky group title — stays fixed during horizontal scroll */}
                    <td colSpan={colSpan + 1} className="px-4 pt-4 pb-1.5 sticky left-0 z-30 bg-muted">
                      <div className="flex items-center gap-2">
                        <div className="text-muted-foreground/40">
                          {isCollapsed
                            ? <ChevronRight className="h-3.5 w-3.5" />
                            : <ChevronDown className="h-3.5 w-3.5" />}
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{item.label}</span>
                        <span className="text-[10px] text-muted-foreground/40 font-medium tabular-nums">{item.count}</span>
                      </div>
                    </td>
                  </tr>
                );
              }

              if (currentGroup && collapsedGroups.has(currentGroup)) return null;

              const user = item.user;
              const uid = user.id;
              const isDetailSelected = selectedUserId === uid;
              const isMultiSelected = selectedIds.has(uid);
              const isHighlighted = isMultiSelected || isDetailSelected;
              const name = user.fullName1 || user.email || `User #${uid}`;
              const role = user.role || "Viewer";
              const avatarColor = ROLE_AVATAR[role] ?? ROLE_AVATAR.Viewer;
              const initials = getInitials(name);
              const userIdx = userIndexMap.get(uid) ?? -1;

              return (
                <tr
                  key={uid}
                  className={cn(
                    "group/row cursor-pointer h-[52px] border-b border-border/15",
                    isHighlighted ? "bg-[#FFF1C8]" : "bg-[#F1F1F1] hover:bg-[#F8F8F8]",
                  )}
                  onClick={(e) => handleRowClick(user, e)}
                >
                  {/* Checkbox cell — sticky left */}
                  <td className={cn(
                    "px-2.5 w-10 min-w-[40px] sticky left-0 z-10",
                    isHighlighted ? "bg-[#FFF1C8]" : "bg-[#F1F1F1] group-hover/row:bg-[#F8F8F8]",
                  )}>
                    <div
                      className={cn(
                        "h-4 w-4 rounded border flex items-center justify-center shrink-0 cursor-pointer",
                        isMultiSelected ? "border-brand-indigo bg-brand-indigo" : "border-border/40"
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        const next = new Set(selectedIds);
                        if (next.has(uid)) next.delete(uid); else next.add(uid);
                        onSelectionChange(next);
                        if (next.size === 1) {
                          const only = userOnlyItems.find((i) => i.user.id === Array.from(next)[0]);
                          if (only) onSelectUser(only.user);
                        }
                      }}
                    >
                      {isMultiSelected && <Check className="h-2.5 w-2.5 text-white" />}
                    </div>
                  </td>

                  {visibleColumns.map((col, ci) => {
                    const isFirst = ci === 0;
                    const tdClass = cn(
                      isFirst && "sticky left-10 z-10",
                      isFirst && (isHighlighted ? "bg-[#FFF1C8]" : "bg-[#F1F1F1] group-hover/row:bg-[#F8F8F8]"),
                    );

                    // ── Name cell (sticky, with avatar) ──
                    if (col.key === "name") {
                      return (
                        <td key="name" className={cn("px-2.5", tdClass)} style={{ width: 220, minWidth: 220 }}>
                          <div className="flex items-center gap-2 min-w-0">
                            <div
                              className="h-10 w-10 rounded-full flex items-center justify-center text-[13px] font-bold shrink-0"
                              style={{ backgroundColor: avatarColor.bg, color: avatarColor.text }}
                            >
                              {initials}
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="text-[12px] font-medium truncate text-foreground leading-tight">
                                {user.fullName1 || <span className="italic text-muted-foreground">No name</span>}
                              </span>
                              {user.email && (
                                <span className="text-[10px] text-muted-foreground/60 truncate leading-tight">{user.email}</span>
                              )}
                            </div>
                          </div>
                        </td>
                      );
                    }

                    // ── All other cells ──
                    return (
                      <td
                        key={col.key}
                        className={cn("px-3", tdClass)}
                        style={{ width: col.width, minWidth: col.width }}
                      >
                        {getCellContent(user, col.key, isHighlighted)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
