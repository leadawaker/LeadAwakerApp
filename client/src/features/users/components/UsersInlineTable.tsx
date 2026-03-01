import React, { useState, useMemo, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight, Check, Eye, Users, Megaphone, HandMetal, Calendar, Clock } from "lucide-react";
import { ROLE_AVATAR } from "@/lib/avatarUtils";
import { EntityAvatar } from "@/components/ui/entity-avatar";
import type { AppUser, AccountMap } from "../types";

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
  { key: "role",        label: "Role",         width: 115 },
  { key: "account",     label: "Account",      width: 160 },
  { key: "email",       label: "Email",        width: 210 },
  { key: "phone",       label: "Phone",        width: 140 },
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

// ── Group header solid background colors ─────────────────────────────────────
// Light pastel tints — fully opaque so they don't darken over the #D8D8D8 bg
const GROUP_HEADER_BG: Record<string, string> = {
  Admin:    "#FEF3C7", // warm yellow tint
  Operator: "#FFEDD5", // soft orange tint
  Manager:  "#DBEAFE", // light blue tint
  Agent:    "#F3E8FF", // soft purple tint
  Viewer:   "#E8E8E8", // neutral gray tint
  Active:   "#D1FAE5", // light emerald tint
  Invited:  "#FEF3C7", // warm amber tint
  Inactive: "#E8E8E8", // neutral gray tint
};

function getGroupHeaderBg(label: string): string {
  return GROUP_HEADER_BG[label] || "#E8E8E8";
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
          className="h-[52px] bg-card/70 rounded-xl animate-pulse"
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
  /** Campaigns grouped by account ID — for hover tooltip */
  campaignsByAccount?: Record<number, { id: number; name: string }[]>;
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
  campaignsByAccount = {},
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

  // ── Group checkbox helpers (§27) ─────────────────────────────────────────
  const getGroupUserIds = useCallback((label: string): number[] => {
    const ids: number[] = [];
    let inGroup = false;
    for (const item of flatItems) {
      if (item.kind === "header") {
        inGroup = item.label === label;
        continue;
      }
      if (inGroup) ids.push(item.user.id);
    }
    return ids;
  }, [flatItems]);

  const handleGroupCheckbox = useCallback((label: string) => {
    const groupIds = getGroupUserIds(label);
    if (groupIds.length === 0) return;
    const allSelected = groupIds.every((id) => selectedIds.has(id));
    const next = new Set(selectedIds);
    if (allSelected) {
      groupIds.forEach((id) => next.delete(id));
    } else {
      groupIds.forEach((id) => next.add(id));
    }
    onSelectionChange(next);
  }, [getGroupUserIds, selectedIds, onSelectionChange]);

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

  // ── Hover tooltip state (must be above early return to respect rules of hooks) ──
  const [hoveredUserId, setHoveredUserId] = useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number } | null>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleRowMouseEnter = useCallback((user: AppUser, e: React.MouseEvent<HTMLTableRowElement>) => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    const row = e.currentTarget; // capture before async
    hoverTimeoutRef.current = setTimeout(() => {
      const container = tableContainerRef.current;
      if (!row || !container) return;
      const rowRect = row.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      setTooltipPos({
        top: rowRect.top - containerRect.top + rowRect.height + 4,
        left: Math.min(rowRect.left - containerRect.left + 40, containerRect.width - 280),
      });
      setHoveredUserId(user.id);
    }, 400);
  }, []);

  const handleRowMouseLeave = useCallback(() => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setHoveredUserId(null);
    setTooltipPos(null);
  }, []);

  const hoveredUser = useMemo(() => {
    if (!hoveredUserId) return null;
    return userOnlyItems.find(i => i.user.id === hoveredUserId)?.user ?? null;
  }, [hoveredUserId, userOnlyItems]);

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
  let rowIdx = 0;

  return (
    <div ref={tableContainerRef} className="h-full flex flex-col overflow-hidden bg-[#D8D8D8] relative">

      {/* ── Table ── */}
      <div className="flex-1 min-h-0 overflow-auto">
        <table className="w-full" style={{ borderCollapse: "separate", borderSpacing: "0 3px", minWidth: 700 }}>

          {/* Sticky column header */}
          <thead className="sticky top-0 z-20">
            <tr>
              {/* Checkbox column header */}
              <th className="py-2 w-[36px] px-0 bg-[#D8D8D8] border-b border-black/[0.06] sticky left-0 z-30" />

              {visibleColumns.map((col, ci) => (
                <th
                  key={col.key}
                  className={cn(
                    "px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-foreground/50 whitespace-nowrap select-none bg-[#D8D8D8] border-b border-black/[0.06]",
                    ci === 0 && "sticky left-[36px] z-30",
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
                const headerBg = getGroupHeaderBg(item.label);
                const groupIds = getGroupUserIds(item.label);
                const isGroupFullySelected = groupIds.length > 0 && groupIds.every((id) => selectedIds.has(id));
                return (
                  <tr
                    key={`h-${item.label}-${index}`}
                    className="cursor-pointer select-none h-[44px]"
                    onClick={() => toggleGroup(item.label)}
                  >
                    {/* Cell 1: Checkbox */}
                    <td className="sticky left-0 z-30 w-[36px] px-0" style={{ backgroundColor: headerBg }}>
                      <div className="flex items-center justify-center h-full">
                        <div
                          className={cn(
                            "h-4 w-4 rounded border flex items-center justify-center shrink-0 cursor-pointer",
                            isGroupFullySelected ? "border-brand-indigo bg-brand-indigo" : "border-border/40"
                          )}
                          onClick={(e) => { e.stopPropagation(); handleGroupCheckbox(item.label); }}
                        >
                          {isGroupFullySelected && <Check className="h-2.5 w-2.5 text-white" />}
                        </div>
                      </div>
                    </td>

                    {/* Cell 2: Label */}
                    <td className="sticky left-[36px] z-30 pl-1 pr-3" style={{ backgroundColor: headerBg }}>
                      <div className="flex items-center gap-2">
                        {isCollapsed ? <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/50" />}
                        <span className="text-[11px] font-bold text-foreground/70">{item.label}</span>
                        <span className="text-[10px] text-muted-foreground/50 font-medium tabular-nums">{item.count}</span>
                      </div>
                    </td>

                    {/* Cell 3: Spacer */}
                    <td colSpan={Math.max(1, visibleColumns.length - 1)} style={{ backgroundColor: headerBg }} />
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
              const userIdx = userIndexMap.get(uid) ?? -1;

              const currentRowIdx = rowIdx++;
              return (
                <tr
                  key={uid}
                  className={cn(
                    "group/row cursor-pointer h-[52px] animate-card-enter",
                    isHighlighted ? "bg-highlight-selected" : "bg-[#F1F1F1] hover:bg-[#FAFAFA]",
                  )}
                  style={{ animationDelay: `${Math.min(currentRowIdx, 15) * 30}ms` }}
                  onClick={(e) => handleRowClick(user, e)}
                  onMouseEnter={(e) => handleRowMouseEnter(user, e)}
                  onMouseLeave={handleRowMouseLeave}
                >
                  {/* Checkbox cell — sticky left */}
                  <td className={cn(
                    "w-[36px] px-0 sticky left-0 z-10",
                    isHighlighted ? "bg-highlight-selected" : "bg-[#F1F1F1] group-hover/row:bg-[#FAFAFA]",
                  )}>
                    <div className="flex items-center justify-center h-full">
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
                    </div>
                  </td>

                  {visibleColumns.map((col, ci) => {
                    const isFirst = ci === 0;
                    const tdClass = cn(
                      isFirst && "sticky left-[36px] z-10",
                      isFirst && (isHighlighted ? "bg-highlight-selected" : "bg-[#F1F1F1] group-hover/row:bg-[#FAFAFA]"),
                    );

                    // ── Name cell (sticky, with avatar) ──
                    if (col.key === "name") {
                      return (
                        <td key="name" className={cn("px-2.5", tdClass)} style={{ width: 220, minWidth: 220 }}>
                          <div className="flex items-center gap-2 min-w-0">
                            <EntityAvatar
                              name={user.fullName1 || "?"}
                              photoUrl={user.avatarUrl}
                              bgColor={avatarColor.bg}
                              textColor={avatarColor.text}
                            />
                            <span className="text-[12px] font-medium truncate text-foreground">
                              {user.fullName1 || <span className="italic text-muted-foreground">No name</span>}
                            </span>
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

      {/* ── Hover tooltip ── */}
      {hoveredUser && tooltipPos && (
        <div
          className="absolute z-50 w-64 bg-popover border border-border/40 rounded-xl shadow-lg p-3 pointer-events-none"
          style={{ top: tooltipPos.top, left: tooltipPos.left }}
        >
          {/* Campaigns under this account */}
          {hoveredUser.accountsId ? (() => {
            const campaigns = campaignsByAccount[hoveredUser.accountsId] ?? [];
            return (
              <>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Megaphone className="w-3 h-3 text-muted-foreground shrink-0" />
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Campaigns</span>
                  <span className="text-[9px] text-muted-foreground/50 tabular-nums">({campaigns.length})</span>
                </div>
                {campaigns.length === 0 ? (
                  <p className="text-[10px] text-muted-foreground italic pl-4">No campaigns</p>
                ) : (
                  <div className="space-y-0.5 pl-4 max-h-20 overflow-y-auto">
                    {campaigns.slice(0, 6).map(c => (
                      <p key={c.id} className="text-[11px] text-foreground truncate">{c.name}</p>
                    ))}
                    {campaigns.length > 6 && <p className="text-[10px] text-muted-foreground italic">+{campaigns.length - 6} more</p>}
                  </div>
                )}
              </>
            );
          })() : (
            <p className="text-[10px] text-muted-foreground italic">No account assigned</p>
          )}

          {/* Member since */}
          {hoveredUser.createdAt && (
            <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-border/20">
              <Calendar className="w-3 h-3 text-muted-foreground shrink-0" />
              <span className="text-[10px] text-muted-foreground">Member since</span>
              <span className="text-[10px] font-medium text-foreground ml-auto">{formatShortDate(hoveredUser.createdAt)}</span>
            </div>
          )}

          {/* Last login */}
          {hoveredUser.lastLoginAt && (
            <div className="flex items-center gap-1.5 mt-1">
              <Clock className="w-3 h-3 text-muted-foreground shrink-0" />
              <span className="text-[10px] text-muted-foreground">Last seen</span>
              <span className="text-[10px] font-medium text-foreground ml-auto">{formatRelativeDate(hoveredUser.lastLoginAt)}</span>
            </div>
          )}

          {/* Timezone */}
          {hoveredUser.timezone && (
            <div className="flex items-center gap-1.5 mt-1">
              <span className="w-3 h-3 text-center text-[8px] text-muted-foreground shrink-0">TZ</span>
              <span className="text-[10px] text-muted-foreground truncate">{hoveredUser.timezone}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
