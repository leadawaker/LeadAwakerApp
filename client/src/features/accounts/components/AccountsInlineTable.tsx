import { useState, useCallback, useRef, useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  Pencil,
  Check,
  X,
  ChevronDown,
  ChevronRight,
  Building2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { updateAccount } from "../api/accountsApi";
import { getAccountAvatarColor } from "@/lib/avatarUtils";
import { EntityAvatar } from "@/components/ui/entity-avatar";
import type { AccountRow } from "./AccountDetailsDialog";

// ── Column definitions ────────────────────────────────────────────────────────

type ColKey =
  | "name" | "status" | "type" | "owner_email" | "phone"
  | "business_niche" | "website" | "timezone" | "max_daily_sends" | "notes";

interface ColumnDef {
  key: ColKey;
  label: string;
  width: number;
  editable: boolean;
  type: "text" | "select";
}

const ALL_TABLE_COLUMNS: ColumnDef[] = [
  { key: "name",            label: "Account Name",  width: 200, editable: false, type: "text"   },
  { key: "status",          label: "Status",        width: 130, editable: true,  type: "select" },
  { key: "type",            label: "Type",          width: 120, editable: false, type: "text"   },
  { key: "owner_email",     label: "Owner Email",   width: 190, editable: true,  type: "text"   },
  { key: "phone",           label: "Phone",         width: 140, editable: true,  type: "text"   },
  { key: "business_niche",  label: "Niche",         width: 160, editable: true,  type: "text"   },
  { key: "website",         label: "Website",       width: 160, editable: true,  type: "text"   },
  { key: "timezone",        label: "Timezone",      width: 160, editable: false, type: "text"   },
  { key: "max_daily_sends", label: "Daily Sends",   width: 110, editable: false, type: "text"   },
  { key: "notes",           label: "Notes",         width: 200, editable: true,  type: "text"   },
];

const STATUS_OPTIONS = ["Active", "Trial", "Inactive", "Suspended"];

const STATUS_DOT: Record<string, string> = {
  Active:    "bg-emerald-500",
  Trial:     "bg-amber-500",
  Inactive:  "bg-slate-400",
  Suspended: "bg-rose-500",
};

const ACCOUNT_STATUS_HEX: Record<string, string> = {
  Active:    "#10B981",
  Trial:     "#F59E0B",
  Inactive:  "#94A3B8",
  Suspended: "#F43F5E",
};

const DB_FIELD_MAP: Partial<Record<ColKey, string>> = {
  status:         "status",
  owner_email:    "owner_email",
  phone:          "phone",
  business_niche: "business_niche",
  website:        "website",
  notes:          "notes",
};

// ── Virtual list item type ────────────────────────────────────────────────────

export type AccountTableItem =
  | { kind: "header"; label: string; count: number }
  | { kind: "account"; account: AccountRow };

// ── Helpers ───────────────────────────────────────────────────────────────────

function getAccountId(a: AccountRow): number {
  return a.Id ?? a.id ?? 0;
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <div className="p-3 space-y-1.5">
      <div className="h-8 bg-[#D1D1D1] rounded animate-pulse mb-2" />
      {Array.from({ length: 10 }).map((_, i) => (
        <div
          key={i}
          className="h-9 bg-card/70 rounded-xl animate-pulse"
          style={{ animationDelay: `${i * 35}ms` }}
        />
      ))}
    </div>
  );
}

// ── Editable cell ─────────────────────────────────────────────────────────────

interface EditableCellProps {
  value: string;
  type: "text" | "select";
  isEditing: boolean;
  editValue: string;
  isSaving: boolean;
  hasError: boolean;
  onStartEdit: () => void;
  onEditChange: (v: string) => void;
  onSave: (v: string) => void;
  onCancel: () => void;
}

function EditableCell({
  value, type, isEditing, editValue, isSaving, hasError,
  onStartEdit, onEditChange, onSave, onCancel,
}: EditableCellProps) {
  if (isEditing && type === "select") {
    return (
      <select
        autoFocus
        value={editValue}
        onChange={(e) => onSave(e.target.value)}
        onBlur={() => onSave(editValue)}
        onKeyDown={(e) => { if (e.key === "Escape") onCancel(); }}
        className="w-full h-[28px] text-[11px] bg-white rounded px-1.5 ring-1 ring-brand-indigo/40 outline-none cursor-pointer"
      >
        {STATUS_OPTIONS.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
    );
  }

  if (isEditing) {
    return (
      <input
        autoFocus
        type="text"
        value={editValue}
        onChange={(e) => onEditChange(e.target.value)}
        onBlur={() => onSave(editValue)}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") onCancel();
        }}
        className="w-full h-[28px] text-[11px] bg-white px-1.5 rounded ring-1 ring-brand-indigo/40 outline-none"
      />
    );
  }

  return (
    <div
      className={cn(
        "w-full h-[28px] px-1.5 flex items-center text-[11px] truncate rounded cursor-text select-none",
        hasError && "ring-1 ring-red-400/60 bg-red-50/30",
        isSaving && "opacity-50",
      )}
      onClick={(e) => { e.stopPropagation(); onStartEdit(); }}
      title={hasError ? "Save failed — click to retry" : value}
    >
      <span className="truncate flex-1">
        {value || <span className="text-muted-foreground/35 italic not-italic">—</span>}
      </span>
      {isSaving && (
        <div className="h-2.5 w-2.5 border border-brand-indigo/40 border-t-brand-indigo rounded-full animate-spin ml-1 shrink-0" />
      )}
      {hasError && !isSaving && (
        <span className="text-red-500 ml-1 shrink-0 text-[9px] font-bold">!</span>
      )}
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface AccountsInlineTableProps {
  flatItems: AccountTableItem[];
  loading: boolean;
  selectedAccountId: number | null;
  onSelectAccount: (account: AccountRow) => void;
  onRefresh?: () => void;
  visibleCols: Set<string>;
  tableSearch: string;
  /** Multi-select state — lifted to parent */
  selectedIds: Set<number>;
  onSelectionChange: (ids: Set<number>) => void;
}

// ── Main component ────────────────────────────────────────────────────────────

export function AccountsInlineTable({
  flatItems,
  loading,
  selectedAccountId,
  onSelectAccount,
  onRefresh,
  visibleCols,
  tableSearch,
  selectedIds,
  onSelectionChange,
}: AccountsInlineTableProps) {

  // ── Editing state ─────────────────────────────────────────────────────────
  const [editingCell,    setEditingCell]    = useState<{ aid: number; field: ColKey } | null>(null);
  const [editValue,      setEditValue]      = useState<string>("");
  const [savingCell,     setSavingCell]     = useState<{ aid: number; field: ColKey } | null>(null);
  const [saveError,      setSaveError]      = useState<{ aid: number; field: ColKey } | null>(null);
  const [localOverrides, setLocalOverrides] = useState<Map<number, Partial<Record<ColKey, string>>>>(new Map());

  // ── Shift-click ref ────────────────────────────────────────────────────────
  const lastClickedIndexRef = useRef<number>(-1);
  const [bulkStageOpen, setBulkStageOpen] = useState(false);

  // ── Group collapse ────────────────────────────────────────────────────────
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const toggleGroupCollapse = (label: string) =>
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label); else next.add(label);
      return next;
    });

  // ── Visible columns ───────────────────────────────────────────────────────
  const visibleColumns = useMemo(
    () => ALL_TABLE_COLUMNS.filter((c) => visibleCols.has(c.key)),
    [visibleCols]
  );
  const colSpan = visibleColumns.length;

  // ── Filter by text search ─────────────────────────────────────────────────
  const displayItems = useMemo(() => {
    if (!tableSearch.trim()) return flatItems;
    const q = tableSearch.toLowerCase();
    return flatItems.filter((item) => {
      if (item.kind === "header") return false;
      const a = item.account;
      return (
        String(a.name || "").toLowerCase().includes(q) ||
        String(a.owner_email || "").toLowerCase().includes(q) ||
        String(a.business_niche || "").toLowerCase().includes(q) ||
        String(a.type || "").toLowerCase().includes(q) ||
        String(a.status || "").toLowerCase().includes(q)
      );
    });
  }, [flatItems, tableSearch]);

  // ── Account index map ─────────────────────────────────────────────────────
  const accountIndexMap = useMemo(() => {
    const map = new Map<number, number>();
    let idx = 0;
    displayItems.forEach((item) => {
      if (item.kind === "account") { map.set(getAccountId(item.account), idx); idx++; }
    });
    return map;
  }, [displayItems]);

  const accountOnlyItems = useMemo(
    () => displayItems.filter((i): i is Extract<AccountTableItem, { kind: "account" }> => i.kind === "account"),
    [displayItems]
  );

  const accountCount = accountOnlyItems.length;

  // ── getCellValue ──────────────────────────────────────────────────────────
  function getCellValue(account: AccountRow, field: ColKey): string {
    const aid = getAccountId(account);
    const overrides = localOverrides.get(aid);
    if (overrides?.[field] !== undefined) return overrides[field]!;
    switch (field) {
      case "name":            return String(account.name || "");
      case "status":          return String(account.status || "");
      case "type":            return String(account.type || "");
      case "owner_email":     return String(account.owner_email || "");
      case "phone":           return String(account.phone || "");
      case "business_niche":  return String(account.business_niche || "");
      case "website":         return String(account.website || "");
      case "timezone":        return String(account.timezone || "");
      case "max_daily_sends": return account.max_daily_sends != null ? String(account.max_daily_sends) : "";
      case "notes":           return String(account.notes || "");
      default:                return "";
    }
  }

  // ── Editing helpers ───────────────────────────────────────────────────────
  const startEdit = useCallback((aid: number, field: ColKey, currentValue: string) => {
    setEditingCell({ aid, field });
    setEditValue(currentValue);
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingCell(null);
    setEditValue("");
  }, []);

  const handleSave = useCallback(async (aid: number, field: ColKey, newValue: string, originalValue: string) => {
    setEditingCell(null);
    if (newValue === originalValue) return;
    const dbField = DB_FIELD_MAP[field];
    if (!dbField) return;

    setLocalOverrides((prev) => {
      const next = new Map(prev);
      next.set(aid, { ...next.get(aid), [field]: newValue });
      return next;
    });
    setSavingCell({ aid, field });
    setSaveError(null);

    try {
      await updateAccount(aid, { [dbField]: newValue });
    } catch {
      setLocalOverrides((prev) => {
        const next = new Map(prev);
        next.set(aid, { ...next.get(aid), [field]: originalValue });
        return next;
      });
      setSaveError({ aid, field });
      setTimeout(() => setSaveError(null), 3000);
    } finally {
      setSavingCell(null);
    }
  }, []);

  // ── Row click ─────────────────────────────────────────────────────────────
  const handleRowClick = useCallback((account: AccountRow, e: React.MouseEvent) => {
    const aid = getAccountId(account);
    const idx = accountIndexMap.get(aid) ?? -1;

    if (e.shiftKey && lastClickedIndexRef.current >= 0) {
      const lo = Math.min(lastClickedIndexRef.current, idx);
      const hi = Math.max(lastClickedIndexRef.current, idx);
      const rangeIds = accountOnlyItems.slice(lo, hi + 1).map((item) => getAccountId(item.account));
      const next = new Set(selectedIds);
      rangeIds.forEach((id) => next.add(id));
      onSelectionChange(next);
      if (next.size === 1) {
        const only = accountOnlyItems.find((i) => getAccountId(i.account) === Array.from(next)[0]);
        if (only) onSelectAccount(only.account);
      }
    } else if (e.ctrlKey || e.metaKey) {
      const next = new Set(selectedIds);
      if (next.has(aid)) next.delete(aid); else next.add(aid);
      onSelectionChange(next);
      if (next.size === 1) {
        const only = accountOnlyItems.find((i) => getAccountId(i.account) === Array.from(next)[0]);
        if (only) onSelectAccount(only.account);
      }
      lastClickedIndexRef.current = idx;
    } else {
      // Simple click: single select + open detail
      onSelectionChange(new Set([aid]));
      onSelectAccount(account);
      lastClickedIndexRef.current = idx;
    }
  }, [accountIndexMap, accountOnlyItems, onSelectAccount, onSelectionChange, selectedIds]);

  // ── Bulk status change ────────────────────────────────────────────────────
  const handleBulkStageChange = useCallback(async (stage: string) => {
    if (selectedIds.size === 0) return;
    try {
      await Promise.all(Array.from(selectedIds).map((id) => updateAccount(id, { status: stage })));
      onSelectionChange(new Set());
      setBulkStageOpen(false);
      onRefresh?.();
    } catch (err) { console.error("Bulk status change failed", err); }
  }, [selectedIds, onRefresh, onSelectionChange]);

  return (
    <div className="h-full flex flex-col overflow-hidden bg-transparent">

      {/* ── Change Status bar (only when multi-selection active) ── */}
      {selectedIds.size > 1 && (
        <div className="shrink-0 px-3 py-1.5 flex items-center gap-1.5 border-b border-border/20">
          <span className="text-[11px] font-semibold text-foreground tabular-nums mr-1">
            {selectedIds.size} selected
          </span>

          <DropdownMenu open={bulkStageOpen} onOpenChange={setBulkStageOpen}>
            <DropdownMenuTrigger asChild>
              <button className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium border border-border/30 bg-transparent text-muted-foreground hover:bg-card hover:text-foreground">
                <Pencil className="h-3 w-3" />
                Change Status
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-44">
              <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">Set status</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {STATUS_OPTIONS.map((s) => (
                <DropdownMenuItem key={s} onClick={() => handleBulkStageChange(s)} className="text-[12px]">
                  <span className={cn("w-1.5 h-1.5 rounded-full shrink-0 mr-2", STATUS_DOT[s] ?? "bg-zinc-400")} />
                  {s}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <button
            className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground"
            onClick={() => onSelectionChange(new Set())}
          >
            <X className="h-3 w-3" />
            Clear
          </button>
        </div>
      )}

      {/* ── Table ── */}
      {loading ? (
        <TableSkeleton />
      ) : (
        <div className="flex-1 min-h-0 overflow-auto">
          <table className="w-full" style={{ borderCollapse: "separate", borderSpacing: "0 3px", minWidth: 700 }}>

            {/* Sticky header */}
            <thead className="sticky top-0 z-20">
              <tr>
                {visibleColumns.map((col, ci) => (
                  <th
                    key={col.key}
                    className={cn(
                      "px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-foreground/50 whitespace-nowrap select-none bg-muted border-b border-border/20",
                      ci === 0 && "sticky left-0 z-30",
                    )}
                    style={{
                      width: col.key === "notes" ? undefined : col.width,
                      minWidth: col.width,
                    }}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {/* Empty state */}
              {accountCount === 0 && (
                <tr>
                  <td colSpan={colSpan} className="py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Building2 className="h-7 w-7 text-muted-foreground/30" />
                      <p className="text-xs text-muted-foreground">
                        {tableSearch ? "No accounts match your search" : "No accounts found"}
                      </p>
                    </div>
                  </td>
                </tr>
              )}

              {(() => {
                let currentGroup: string | null = null;
                return displayItems.map((item, index) => {
                  if (item.kind === "header") {
                    currentGroup = item.label;
                    const isCollapsed = collapsedGroups.has(item.label);
                    const hexColor = ACCOUNT_STATUS_HEX[item.label] || "#94A3B8";
                    return (
                      <tr
                        key={`h-${item.label}-${index}`}
                        className="cursor-pointer select-none hover:bg-black/[0.02]"
                        onClick={() => toggleGroupCollapse(item.label)}
                      >
                        {/* Sticky group title — stays fixed during horizontal scroll */}
                        <td colSpan={colSpan} className="px-4 pt-4 pb-1.5 sticky left-0 z-30 bg-muted">
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: hexColor }} />
                            <span className="text-[11px] font-bold uppercase tracking-widest text-foreground/55">{item.label}</span>
                            <span className="text-[10px] text-muted-foreground/40 font-medium tabular-nums">{item.count}</span>
                            <div className="ml-auto text-muted-foreground/40">
                              {isCollapsed
                                ? <ChevronRight className="h-3.5 w-3.5" />
                                : <ChevronDown className="h-3.5 w-3.5" />}
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  }

                  if (currentGroup && collapsedGroups.has(currentGroup)) return null;

                  const { account } = item;
                  const aid = getAccountId(account);
                  const isDetailSelected = selectedAccountId === aid;
                  const isMultiSelected = selectedIds.has(aid);
                  const isHighlighted = isMultiSelected || isDetailSelected;
                  const name = String(account.name || "Unnamed");
                  const status = String(account.status || "");
                  const avatarColor = getAccountAvatarColor(status);

                  return (
                    <tr
                      key={aid}
                      className={cn(
                        "group/row cursor-pointer h-[52px]",
                        isHighlighted ? "bg-highlight-selected" : "bg-card hover:bg-card-hover",
                      )}
                      onClick={(e) => handleRowClick(account, e)}
                    >
                      {visibleColumns.map((col, ci) => {
                        const isFirst = ci === 0;
                        const tdClass = cn(
                          isFirst && "sticky left-0 z-10",
                          isFirst && (isHighlighted ? "bg-highlight-selected" : "bg-card group-hover/row:bg-card-hover"),
                        );

                        // ── Name (sticky, with avatar) ──
                        if (col.key === "name") {
                          return (
                            <td key="name" className={cn("px-2.5", tdClass)} style={{ width: 200, minWidth: 200 }}>
                              <div className="flex items-center gap-2 min-w-0">
                                {/* Checkbox — always visible */}
                                <div
                                  className={cn(
                                    "h-4 w-4 rounded border flex items-center justify-center shrink-0 cursor-pointer",
                                    isMultiSelected ? "border-brand-indigo bg-brand-indigo" : "border-border/40"
                                  )}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const next = new Set(selectedIds);
                                    if (next.has(aid)) next.delete(aid); else next.add(aid);
                                    onSelectionChange(next);
                                    if (next.size === 1) {
                                      const only = accountOnlyItems.find((i) => getAccountId(i.account) === Array.from(next)[0]);
                                      if (only) onSelectAccount(only.account);
                                    }
                                  }}
                                >
                                  {isMultiSelected && <Check className="h-2.5 w-2.5 text-white" />}
                                </div>
                                <EntityAvatar
                                  name={name}
                                  photoUrl={account.logo_url}
                                  bgColor={avatarColor.bg}
                                  textColor={avatarColor.text}
                                />
                                <span className="text-[12px] font-medium truncate text-foreground">{name}</span>
                              </div>
                            </td>
                          );
                        }

                        // ── Status (editable select) ──
                        if (col.key === "status") {
                          const cellVal = getCellValue(account, "status");
                          const isEdit = editingCell?.aid === aid && editingCell?.field === "status";
                          return (
                            <td key="status" className={cn("px-1", tdClass)} style={{ width: 130, minWidth: 130 }}>
                              <div className="flex items-center gap-1.5 min-w-0">
                                {!isEdit && (
                                  <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", STATUS_DOT[cellVal] ?? "bg-zinc-400")} />
                                )}
                                <EditableCell
                                  value={cellVal}
                                  type="select"
                                  isEditing={isEdit}
                                  editValue={isEdit ? editValue : ""}
                                  isSaving={savingCell?.aid === aid && savingCell?.field === "status"}
                                  hasError={saveError?.aid === aid && saveError?.field === "status"}
                                  onStartEdit={() => startEdit(aid, "status", cellVal)}
                                  onEditChange={setEditValue}
                                  onSave={(v) => handleSave(aid, "status", v, cellVal)}
                                  onCancel={cancelEdit}
                                />
                              </div>
                            </td>
                          );
                        }

                        // ── Max daily sends (read-only, numeric) ──
                        if (col.key === "max_daily_sends") {
                          const val = getCellValue(account, "max_daily_sends");
                          return (
                            <td key="max_daily_sends" className={cn("px-2.5 tabular-nums", tdClass)} style={{ width: 110, minWidth: 110 }}>
                              <span className="text-[11px] font-medium text-foreground">
                                {val || <span className="text-muted-foreground/30">—</span>}
                              </span>
                            </td>
                          );
                        }

                        // ── Website (link-style) ──
                        if (col.key === "website") {
                          const val = getCellValue(account, "website");
                          const colDef = ALL_TABLE_COLUMNS.find((c) => c.key === col.key)!;
                          const isEdit = editingCell?.aid === aid && editingCell?.field === col.key;
                          return (
                            <td key="website" className={cn("px-1", tdClass)} style={{ width: col.width, minWidth: col.width }}>
                              <EditableCell
                                value={val}
                                type="text"
                                isEditing={isEdit}
                                editValue={isEdit ? editValue : ""}
                                isSaving={savingCell?.aid === aid && savingCell?.field === col.key}
                                hasError={saveError?.aid === aid && saveError?.field === col.key}
                                onStartEdit={() => startEdit(aid, col.key, val)}
                                onEditChange={setEditValue}
                                onSave={(v) => handleSave(aid, col.key, v, val)}
                                onCancel={cancelEdit}
                              />
                            </td>
                          );
                        }

                        // ── Editable text columns ──
                        const colDef = ALL_TABLE_COLUMNS.find((c) => c.key === col.key)!;
                        if (colDef?.editable) {
                          const cellVal = getCellValue(account, col.key);
                          const isEdit = editingCell?.aid === aid && editingCell?.field === col.key;
                          return (
                            <td
                              key={col.key}
                              className={cn("px-1", tdClass)}
                              style={col.key === "notes" ? { minWidth: col.width } : { width: col.width, minWidth: col.width }}
                            >
                              <EditableCell
                                value={cellVal}
                                type="text"
                                isEditing={isEdit}
                                editValue={isEdit ? editValue : ""}
                                isSaving={savingCell?.aid === aid && savingCell?.field === col.key}
                                hasError={saveError?.aid === aid && saveError?.field === col.key}
                                onStartEdit={() => startEdit(aid, col.key, cellVal)}
                                onEditChange={setEditValue}
                                onSave={(v) => handleSave(aid, col.key, v, cellVal)}
                                onCancel={cancelEdit}
                              />
                            </td>
                          );
                        }

                        // ── Read-only text fallback ──
                        return (
                          <td key={col.key} className={cn("px-2.5", tdClass)} style={{ width: col.width, minWidth: col.width }}>
                            <span className="text-[11px] text-muted-foreground truncate block">
                              {getCellValue(account, col.key) || <span className="text-muted-foreground/30">—</span>}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  );
                });
              })()}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
