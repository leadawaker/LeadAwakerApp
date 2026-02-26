import { useState, useCallback, useRef, useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  Pencil,
  Check,
  X,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { updateCampaign } from "../api/campaignsApi";
import type { Campaign } from "@/types/models";

// ── Column definitions ─────────────────────────────────────────────────────────
type ColKey =
  | "name" | "status" | "account" | "type" | "leads" | "responseRate"
  | "bookingRate" | "cost" | "roi" | "description"
  | "startDate" | "endDate" | "lastModified";

interface ColumnDef {
  key: ColKey;
  label: string;
  width: number;
  editable: boolean;
  type: "text" | "select";
}

const ALL_TABLE_COLUMNS: ColumnDef[] = [
  { key: "name",         label: "Name",          width: 200, editable: false, type: "text"   },
  { key: "status",       label: "Status",        width: 130, editable: true,  type: "select" },
  { key: "account",      label: "Account",       width: 130, editable: false, type: "text"   },
  { key: "type",         label: "Type",          width: 130, editable: false, type: "text"   },
  { key: "leads",        label: "Leads",         width: 80,  editable: false, type: "text"   },
  { key: "responseRate", label: "Response %",    width: 100, editable: false, type: "text"   },
  { key: "bookingRate",  label: "Booking %",     width: 100, editable: false, type: "text"   },
  { key: "cost",         label: "Cost",          width: 90,  editable: false, type: "text"   },
  { key: "roi",          label: "ROI %",         width: 80,  editable: false, type: "text"   },
  { key: "description",  label: "Description",   width: 200, editable: true,  type: "text"   },
  { key: "startDate",    label: "Start",         width: 110, editable: false, type: "text"   },
  { key: "endDate",      label: "End",           width: 110, editable: false, type: "text"   },
  { key: "lastModified", label: "Last Modified", width: 110, editable: false, type: "text"   },
];

export const DEFAULT_CAMPAIGN_COLS = [
  "name", "status", "account", "type", "leads", "responseRate", "bookingRate", "description",
];

const STATUS_OPTIONS = ["Active", "Paused", "Completed", "Inactive", "Draft"];

const DB_FIELD_MAP: Partial<Record<ColKey, string>> = {
  status:      "status",
  description: "description",
};

const CAMPAIGN_STATUS_HEX: Record<string, string> = {
  Active:    "#22C55E",
  Paused:    "#F59E0B",
  Completed: "#3B82F6",
  Finished:  "#3B82F6",
  Inactive:  "#94A3B8",
  Archived:  "#94A3B8",
  Draft:     "#6B7280",
};

const STATUS_DOT: Record<string, string> = {
  Active:    "bg-green-500",
  Paused:    "bg-amber-500",
  Completed: "bg-blue-500",
  Finished:  "bg-blue-500",
  Inactive:  "bg-slate-400",
  Archived:  "bg-slate-400",
  Draft:     "bg-gray-400",
};

const CAMPAIGN_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  Active:    { bg: "#DCFCE7", text: "#15803D" },
  Paused:    { bg: "#FEF3C7", text: "#92400E" },
  Completed: { bg: "#DBEAFE", text: "#1D4ED8" },
  Finished:  { bg: "#DBEAFE", text: "#1D4ED8" },
  Inactive:  { bg: "#F4F4F5", text: "#52525B" },
  Archived:  { bg: "#F4F4F5", text: "#52525B" },
  Draft:     { bg: "#E5E7EB", text: "#374151" },
};

// ── Virtual list item type ─────────────────────────────────────────────────────
export type CampaignTableItem =
  | { kind: "header"; label: string; count: number }
  | { kind: "campaign"; campaign: Campaign };

// ── Helpers ───────────────────────────────────────────────────────────────────
function getCampaignId(c: Campaign): number {
  return c.id || (c as any).Id || 0;
}

function getCampaignInitials(name: string): string {
  return name.split(" ").map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "?";
}

function getCampaignAvatarColor(status: string): { bg: string; text: string } {
  return CAMPAIGN_STATUS_COLORS[status] ?? { bg: "#E5E7EB", text: "#374151" };
}

function formatDate(s: string | null | undefined): string {
  if (!s) return "";
  try { return new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }
  catch { return ""; }
}

function formatRelativeTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return "";
    const diffMs = Date.now() - date.getTime();
    const diffDays = Math.floor(diffMs / 86_400_000);
    if (diffDays === 0) {
      const h = Math.floor(diffMs / 3_600_000);
      return h === 0 ? "Just now" : `${h}h ago`;
    }
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    return `${Math.floor(diffDays / 30)}mo ago`;
  } catch { return ""; }
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function TableSkeleton() {
  return (
    <div className="p-3 space-y-1.5">
      <div className="h-8 bg-[#D1D1D1] rounded animate-pulse mb-2" />
      {Array.from({ length: 10 }).map((_, i) => (
        <div
          key={i}
          className="h-[52px] bg-[#F1F1F1]/70 rounded-xl animate-pulse"
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
        className="w-full h-[28px] text-[11px] bg-white rounded px-1.5 ring-1 ring-brand-blue/40 outline-none cursor-pointer"
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
        className="w-full h-[28px] text-[11px] bg-white px-1.5 rounded ring-1 ring-brand-blue/40 outline-none"
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
        <div className="h-2.5 w-2.5 border border-brand-blue/40 border-t-brand-blue rounded-full animate-spin ml-1 shrink-0" />
      )}
      {hasError && !isSaving && (
        <span className="text-red-500 ml-1 shrink-0 text-[9px] font-bold">!</span>
      )}
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface CampaignsInlineTableProps {
  flatItems: CampaignTableItem[];
  loading: boolean;
  selectedCampaignId: number | null;
  onSelectCampaign: (campaign: Campaign) => void;
  onRefresh?: () => void;
  visibleCols: Set<string>;
  tableSearch: string;
  /** Multi-select state — lifted to parent */
  selectedIds: Set<number>;
  onSelectionChange: (ids: Set<number>) => void;
}

// ── Main component ─────────────────────────────────────────────────────────────
export function CampaignsInlineTable({
  flatItems,
  loading,
  selectedCampaignId,
  onSelectCampaign,
  onRefresh,
  visibleCols,
  tableSearch,
  selectedIds,
  onSelectionChange,
}: CampaignsInlineTableProps) {

  // ── Editing state ─────────────────────────────────────────────────────────
  const [editingCell,    setEditingCell]    = useState<{ cid: number; field: ColKey } | null>(null);
  const [editValue,      setEditValue]      = useState<string>("");
  const [savingCell,     setSavingCell]     = useState<{ cid: number; field: ColKey } | null>(null);
  const [saveError,      setSaveError]      = useState<{ cid: number; field: ColKey } | null>(null);
  const [localOverrides, setLocalOverrides] = useState<Map<number, Partial<Record<ColKey, string>>>>(new Map());

  // ── Shift-click ref ────────────────────────────────────────────────────────
  const lastClickedIndexRef = useRef<number>(-1);
  const [bulkStageOpen, setBulkStageOpen] = useState(false);

  // ── Group collapse ─────────────────────────────────────────────────────────
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const toggleGroupCollapse = (label: string) =>
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label); else next.add(label);
      return next;
    });

  // ── Visible columns ─────────────────────────────────────────────────────────
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
      const name = String(item.campaign.name || "").toLowerCase();
      const desc = String(item.campaign.description || "").toLowerCase();
      const acct = String(item.campaign.account_name || "").toLowerCase();
      return name.includes(q) || desc.includes(q) || acct.includes(q);
    });
  }, [flatItems, tableSearch]);

  // ── Campaign index map (for shift-click range selection) ─────────────────
  const campaignIndexMap = useMemo(() => {
    const map = new Map<number, number>();
    let idx = 0;
    displayItems.forEach((item) => {
      if (item.kind === "campaign") { map.set(getCampaignId(item.campaign), idx); idx++; }
    });
    return map;
  }, [displayItems]);

  const campaignOnlyItems = useMemo(
    () => displayItems.filter((i): i is Extract<CampaignTableItem, { kind: "campaign" }> => i.kind === "campaign"),
    [displayItems],
  );

  const campaignCount = campaignOnlyItems.length;
  const hasSelection = selectedIds.size > 0;

  // ── getCellValue ──────────────────────────────────────────────────────────
  function getCellValue(campaign: Campaign, field: ColKey): string {
    const cid = getCampaignId(campaign);
    const overrides = localOverrides.get(cid);
    if (overrides?.[field] !== undefined) return overrides[field]!;
    switch (field) {
      case "status":       return String(campaign.status || "");
      case "account":      return String(campaign.account_name || "");
      case "type":         return String(campaign.type || "");
      case "leads":        return String(Number(campaign.total_leads_targeted ?? (campaign as any).Leads ?? 0));
      case "responseRate": {
        const r = Number(campaign.response_rate_percent ?? 0);
        return r > 0 ? `${r}%` : "";
      }
      case "bookingRate": {
        const r = Number(campaign.booking_rate_percent ?? 0);
        return r > 0 ? `${r}%` : "";
      }
      case "cost":         return Number(campaign.total_cost) > 0 ? `$${Number(campaign.total_cost).toFixed(0)}` : "";
      case "roi": {
        const r = Number(campaign.roi_percent ?? 0);
        return r !== 0 ? `${r >= 0 ? "+" : ""}${r}%` : "";
      }
      case "description":  return String(campaign.description || "");
      case "startDate":    return formatDate(campaign.start_date);
      case "endDate":      return formatDate(campaign.end_date);
      case "lastModified": return formatRelativeTime((campaign as any).updated_at || (campaign as any).nc_updated_at);
      default:             return "";
    }
  }

  // ── Editing helpers ────────────────────────────────────────────────────────
  const startEdit = useCallback((cid: number, field: ColKey, currentValue: string) => {
    setEditingCell({ cid, field });
    setEditValue(currentValue);
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingCell(null);
    setEditValue("");
  }, []);

  const handleSave = useCallback(async (cid: number, field: ColKey, newValue: string, originalValue: string) => {
    setEditingCell(null);
    if (newValue === originalValue) return;
    const dbField = DB_FIELD_MAP[field];
    if (!dbField) return;

    setLocalOverrides((prev) => {
      const next = new Map(prev);
      next.set(cid, { ...next.get(cid), [field]: newValue });
      return next;
    });
    setSavingCell({ cid, field });
    setSaveError(null);

    try {
      await updateCampaign(cid, { [dbField]: newValue });
    } catch {
      setLocalOverrides((prev) => {
        const next = new Map(prev);
        next.set(cid, { ...next.get(cid), [field]: originalValue });
        return next;
      });
      setSaveError({ cid, field });
      setTimeout(() => setSaveError(null), 3000);
    } finally {
      setSavingCell(null);
    }
  }, []);

  // ── Row click handler ──────────────────────────────────────────────────────
  // Simple click = single select + open detail (checkbox checked)
  const handleRowClick = useCallback((campaign: Campaign, e: React.MouseEvent) => {
    const cid = getCampaignId(campaign);
    const idx = campaignIndexMap.get(cid) ?? -1;

    if (e.shiftKey && lastClickedIndexRef.current >= 0) {
      const lo = Math.min(lastClickedIndexRef.current, idx);
      const hi = Math.max(lastClickedIndexRef.current, idx);
      const rangeIds = campaignOnlyItems.slice(lo, hi + 1).map((item) => getCampaignId(item.campaign));
      const next = new Set(selectedIds);
      rangeIds.forEach((id) => next.add(id));
      onSelectionChange(next);
      if (next.size === 1) {
        const only = campaignOnlyItems.find((i) => getCampaignId(i.campaign) === Array.from(next)[0]);
        if (only) onSelectCampaign(only.campaign);
      }
    } else if (e.ctrlKey || e.metaKey) {
      const next = new Set(selectedIds);
      if (next.has(cid)) next.delete(cid); else next.add(cid);
      onSelectionChange(next);
      if (next.size === 1) {
        const only = campaignOnlyItems.find((i) => getCampaignId(i.campaign) === Array.from(next)[0]);
        if (only) onSelectCampaign(only.campaign);
      }
      lastClickedIndexRef.current = idx;
    } else {
      // Simple click: single select + open detail
      onSelectionChange(new Set([cid]));
      onSelectCampaign(campaign);
      lastClickedIndexRef.current = idx;
    }
  }, [campaignIndexMap, campaignOnlyItems, onSelectCampaign, onSelectionChange, selectedIds]);

  // ── Bulk stage change ─────────────────────────────────────────────────────
  const handleBulkStageChange = useCallback(async (stage: string) => {
    if (selectedIds.size === 0) return;
    try {
      await Promise.all(Array.from(selectedIds).map((id) => updateCampaign(id, { status: stage })));
      onSelectionChange(new Set());
      setBulkStageOpen(false);
      onRefresh?.();
    } catch (err) { console.error("Bulk stage change failed", err); }
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
              <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">Move to</DropdownMenuLabel>
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
        <div className="flex-1 min-h-0 overflow-auto bg-[#F1F1F1]">
          <table className="w-full" style={{ borderCollapse: "collapse", minWidth: 600 }}>

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
                      width: col.key === "description" ? undefined : col.width,
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
              {campaignCount === 0 && (
                <tr>
                  <td colSpan={colSpan} className="py-12 text-center text-xs text-muted-foreground">
                    {tableSearch ? "No campaigns match your search" : "No campaigns found"}
                  </td>
                </tr>
              )}

              {(() => {
                let currentGroup: string | null = null;
                return displayItems.map((item, index) => {
                  if (item.kind === "header") {
                    currentGroup = item.label;
                    const isCollapsed = collapsedGroups.has(item.label);
                    const hexColor = CAMPAIGN_STATUS_HEX[item.label] || "#6B7280";
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

                  const { campaign } = item;
                  const cid = getCampaignId(campaign);
                  const isDetailSelected = selectedCampaignId === cid;
                  const isMultiSelected = selectedIds.has(cid);
                  const isHighlighted = isMultiSelected || isDetailSelected;
                  const name = String(campaign.name || "Unnamed");
                  const status = String(campaign.status || "");
                  const avatarColor = getCampaignAvatarColor(status);

                  return (
                    <tr
                      key={cid}
                      className={cn(
                        "group/row cursor-pointer h-[52px] border-b border-border/15",
                        isHighlighted ? "bg-[#FFF1C8]" : "bg-[#F1F1F1] hover:bg-[#F8F8F8]",
                      )}
                      onClick={(e) => handleRowClick(campaign, e)}
                    >
                      {visibleColumns.map((col, ci) => {
                        const isFirst = ci === 0;
                        const tdClass = cn(
                          isFirst && "sticky left-0 z-10",
                          isFirst && (isHighlighted ? "bg-[#FFF1C8]" : "bg-[#F1F1F1] group-hover/row:bg-[#F8F8F8]"),
                        );

                        // ── Name ──
                        if (col.key === "name") {
                          return (
                            <td key="name" className={cn("px-2.5", tdClass)} style={{ width: 200, minWidth: 200 }}>
                              <div className="flex items-center gap-2 min-w-0">
                                {/* Checkbox — always visible */}
                                <div
                                  className={cn(
                                    "h-4 w-4 rounded border flex items-center justify-center shrink-0 cursor-pointer",
                                    isMultiSelected ? "border-brand-blue bg-brand-blue" : "border-border/40"
                                  )}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const next = new Set(selectedIds);
                                    if (next.has(cid)) next.delete(cid); else next.add(cid);
                                    onSelectionChange(next);
                                    if (next.size === 1) {
                                      const only = campaignOnlyItems.find((i) => getCampaignId(i.campaign) === Array.from(next)[0]);
                                      if (only) onSelectCampaign(only.campaign);
                                    }
                                  }}
                                >
                                  {isMultiSelected && <Check className="h-2.5 w-2.5 text-white" />}
                                </div>
                                <div
                                  className="h-10 w-10 rounded-full flex items-center justify-center text-[13px] font-bold shrink-0"
                                  style={{ backgroundColor: avatarColor.bg, color: avatarColor.text }}
                                >
                                  {getCampaignInitials(name)}
                                </div>
                                <span className="text-[12px] font-medium truncate text-foreground">{name}</span>
                              </div>
                            </td>
                          );
                        }

                        // ── Status (editable select) ──
                        if (col.key === "status") {
                          const cellVal = getCellValue(campaign, "status");
                          const isEdit = editingCell?.cid === cid && editingCell?.field === "status";
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
                                  isSaving={savingCell?.cid === cid && savingCell?.field === "status"}
                                  hasError={saveError?.cid === cid && saveError?.field === "status"}
                                  onStartEdit={() => startEdit(cid, "status", cellVal)}
                                  onEditChange={setEditValue}
                                  onSave={(v) => handleSave(cid, "status", v, cellVal)}
                                  onCancel={cancelEdit}
                                />
                              </div>
                            </td>
                          );
                        }

                        // ── Leads (read-only, numeric) ──
                        if (col.key === "leads") {
                          const val = getCellValue(campaign, "leads");
                          return (
                            <td key="leads" className={cn("px-2.5 tabular-nums", tdClass)} style={{ width: 80, minWidth: 80 }}>
                              <span className="text-[11px] font-medium text-foreground">
                                {val && val !== "0" ? val : <span className="text-muted-foreground/30">—</span>}
                              </span>
                            </td>
                          );
                        }

                        // ── ROI (color-coded) ──
                        if (col.key === "roi") {
                          const val = getCellValue(campaign, "roi");
                          const numVal = Number(campaign.roi_percent ?? 0);
                          const color = numVal >= 100 ? "text-emerald-600" : numVal >= 0 ? "text-blue-600" : "text-rose-600";
                          return (
                            <td key="roi" className={cn("px-2.5 tabular-nums", tdClass)} style={{ width: 80, minWidth: 80 }}>
                              <span className={cn("text-[11px] font-medium", val ? color : "text-muted-foreground/30")}>
                                {val || "—"}
                              </span>
                            </td>
                          );
                        }

                        // ── Editable text columns ──
                        const colDef = ALL_TABLE_COLUMNS.find((c) => c.key === col.key)!;
                        if (colDef?.editable && colDef.type === "text") {
                          const cellVal = getCellValue(campaign, col.key);
                          const isEdit = editingCell?.cid === cid && editingCell?.field === col.key;
                          return (
                            <td
                              key={col.key}
                              className={cn("px-1", tdClass)}
                              style={col.key === "description" ? { minWidth: col.width } : { width: col.width, minWidth: col.width }}
                            >
                              <EditableCell
                                value={cellVal}
                                type="text"
                                isEditing={isEdit}
                                editValue={isEdit ? editValue : ""}
                                isSaving={savingCell?.cid === cid && savingCell?.field === col.key}
                                hasError={saveError?.cid === cid && saveError?.field === col.key}
                                onStartEdit={() => startEdit(cid, col.key, cellVal)}
                                onEditChange={setEditValue}
                                onSave={(v) => handleSave(cid, col.key, v, cellVal)}
                                onCancel={cancelEdit}
                              />
                            </td>
                          );
                        }

                        // ── Read-only text fallback ──
                        return (
                          <td key={col.key} className={cn("px-2.5", tdClass)} style={{ width: col.width, minWidth: col.width }}>
                            <span className="text-[11px] text-muted-foreground truncate block">
                              {getCellValue(campaign, col.key) || <span className="text-muted-foreground/30">—</span>}
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
