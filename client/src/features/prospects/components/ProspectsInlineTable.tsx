import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Building2,
  Globe,
  MapPin,
  Link,
  Phone,
  Mail,
  Linkedin,
  FileText,
  Target,
  BarChart3,
  Briefcase,
  StickyNote,
  ArrowRight,
  User,
  BadgeCheck,
} from "lucide-react";
import { updateProspect } from "../api/prospectsApi";
import { DndContext, closestCenter, DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, horizontalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { EntityAvatar } from "@/components/ui/entity-avatar";
import type { ProspectRow } from "./ProspectListView";

// ── Column definitions ────────────────────────────────────────────────────────

type ColKey =
  | "company" | "niche" | "country" | "city"
  | "website" | "source"
  | "status" | "priority" | "notes" | "next_action" | "action"
  | "contact_name" | "contact_role" | "contact_email" | "contact_phone" | "contact_linkedin"
  | "contact2_name" | "contact2_role" | "contact2_email" | "contact2_phone" | "contact2_linkedin";

interface ColumnDef {
  key: ColKey;
  tKey: string;
  width: number;
  editable: boolean;
  type: "text" | "select";
  icon?: React.ElementType;
}

const ALL_TABLE_COLUMNS: ColumnDef[] = [
  { key: "company",     tKey: "columns.company",      width: 200, editable: false, type: "text",   icon: Building2   },
  { key: "status",      tKey: "columns.status",       width: 110, editable: true,  type: "select", icon: Target      },
  { key: "priority",    tKey: "columns.priority",     width: 120, editable: true,  type: "select", icon: BarChart3    },
  { key: "niche",       tKey: "columns.niche",        width: 140, editable: true,  type: "text",   icon: Briefcase   },
  { key: "country",     tKey: "columns.country",      width: 120, editable: true,  type: "text",   icon: Globe       },
  { key: "city",        tKey: "columns.city",         width: 120, editable: true,  type: "text",   icon: MapPin      },
  { key: "website",     tKey: "columns.website",      width: 160, editable: true,  type: "text",   icon: Link        },
  { key: "notes",            tKey: "columns.notes",           width: 400, editable: true, type: "text", icon: StickyNote },
  { key: "next_action",      tKey: "columns.nextAction",      width: 360, editable: true, type: "text", icon: ArrowRight },
  { key: "source",      tKey: "columns.source",       width: 140, editable: true,  type: "select", icon: FileText    },
  { key: "contact_name",     tKey: "columns.contactName",     width: 160, editable: true, type: "text", icon: User       },
  { key: "contact_role",     tKey: "columns.contactRole",     width: 140, editable: true, type: "text", icon: BadgeCheck  },
  { key: "contact_email",    tKey: "columns.contactEmail",    width: 190, editable: true, type: "text", icon: Mail       },
  { key: "contact_phone",    tKey: "columns.contactPhone",    width: 140, editable: true, type: "text", icon: Phone      },
  { key: "contact_linkedin", tKey: "columns.contactLinkedin", width: 160, editable: true, type: "text", icon: Linkedin   },
  { key: "contact2_name",     tKey: "columns.contact2Name",     width: 160, editable: true, type: "text", icon: User       },
  { key: "contact2_role",     tKey: "columns.contact2Role",     width: 140, editable: true, type: "text", icon: BadgeCheck  },
  { key: "contact2_email",    tKey: "columns.contact2Email",    width: 190, editable: true, type: "text", icon: Mail       },
  { key: "contact2_phone",    tKey: "columns.contact2Phone",    width: 140, editable: true, type: "text", icon: Phone      },
  { key: "contact2_linkedin", tKey: "columns.contact2Linkedin", width: 160, editable: true, type: "text", icon: Linkedin   },
  { key: "action",           tKey: "columns.action",          width: 150, editable: true, type: "select", icon: Target    },
];

const STATUS_OPTIONS   = ["New", "Contacted", "In Progress", "Converted", "Archived"];
const PRIORITY_OPTIONS = ["low", "medium", "high", "urgent"];
const SOURCE_OPTIONS   = ["Web Research", "Referral", "LinkedIn", "Cold Email", "Conference", "Other"];
const ACTION_OPTIONS   = ["Contacted", "Responded", "Researched", "Meeting Scheduled", "Proposal Sent", "Follow-up", "No Response"];

const STATUS_DOT: Record<string, string> = {
  New:            "bg-blue-500",
  Contacted:      "bg-amber-500",
  "In Progress":  "bg-indigo-500",
  Converted:      "bg-emerald-500",
  Archived:       "bg-slate-400",
};

const PRIORITY_GROUP_COLORS: Record<string, string> = {
  High: "#EF4444",
  Medium: "#F59E0B",
  Low: "#22C55E",
};


// ── Niche color palette (deterministic hash) ─────────────────────────────────

const NICHE_COLORS: { hex: string; bg: string; text: string }[] = [
  { hex: "#6366F1", bg: "#EEF2FF", text: "#4338CA" }, // indigo
  { hex: "#F59E0B", bg: "#FFFBEB", text: "#B45309" }, // amber
  { hex: "#10B981", bg: "#ECFDF5", text: "#047857" }, // emerald
  { hex: "#EC4899", bg: "#FDF2F8", text: "#BE185D" }, // pink
  { hex: "#8B5CF6", bg: "#F5F3FF", text: "#6D28D9" }, // violet
  { hex: "#14B8A6", bg: "#F0FDFA", text: "#0F766E" }, // teal
  { hex: "#F97316", bg: "#FFF7ED", text: "#C2410C" }, // orange
  { hex: "#3B82F6", bg: "#EFF6FF", text: "#1D4ED8" }, // blue
  { hex: "#EF4444", bg: "#FEF2F2", text: "#B91C1C" }, // red
  { hex: "#84CC16", bg: "#F7FEE7", text: "#4D7C0F" }, // lime
  { hex: "#06B6D4", bg: "#ECFEFF", text: "#0E7490" }, // cyan
  { hex: "#A855F7", bg: "#FAF5FF", text: "#7E22CE" }, // purple
];

/** Build a stable niche→color map: sort niches alphabetically, assign colors round-robin */
function buildNicheColorMap(niches: string[]): Map<string, typeof NICHE_COLORS[number]> {
  const sorted = Array.from(new Set(niches.map((n) => n.toLowerCase()))).sort();
  const map = new Map<string, typeof NICHE_COLORS[number]>();
  sorted.forEach((n, i) => map.set(n, NICHE_COLORS[i % NICHE_COLORS.length]));
  return map;
}

const FALLBACK_NICHE_COLOR = NICHE_COLORS[0];

/** Convert hex + 18% alpha to an opaque RGB string (for sticky cells that can't be transparent) */
function opaqueNicheTint(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const a = 0.12;
  return `rgb(${Math.round(r * a + 255 * (1 - a))}, ${Math.round(g * a + 255 * (1 - a))}, ${Math.round(b * a + 255 * (1 - a))})`;
}

const SELECT_OPTIONS_MAP: Record<string, string[]> = {
  status:   STATUS_OPTIONS,
  priority: PRIORITY_OPTIONS,
  source:   SOURCE_OPTIONS,
  action:   ACTION_OPTIONS,
};

const DB_FIELD_MAP: Partial<Record<ColKey, string>> = {
  company:     "company",
  niche:       "niche",
  country:     "country",
  city:        "city",
  website:     "website",
  source:      "source",
  status:      "status",
  priority:    "priority",
  notes:            "notes",
  next_action:      "next_action",
  action:           "action",
  contact_name:     "contact_name",
  contact_role:     "contact_role",
  contact_email:    "contact_email",
  contact_phone:    "contact_phone",
  contact_linkedin: "contact_linkedin",
  contact2_name:     "contact2_name",
  contact2_role:     "contact2_role",
  contact2_email:    "contact2_email",
  contact2_phone:    "contact2_phone",
  contact2_linkedin: "contact2_linkedin",
};

// ── Country flag utility ──────────────────────────────────────────────────────

const COUNTRY_ISO: Record<string, string> = {
  "netherlands": "NL", "nederland": "NL", "the netherlands": "NL",
  "united states": "US", "usa": "US", "us": "US",
  "united kingdom": "GB", "uk": "GB", "england": "GB",
  "germany": "DE", "deutschland": "DE",
  "france": "FR", "belgium": "BE", "spain": "ES", "italy": "IT",
  "portugal": "PT", "brazil": "BR", "canada": "CA", "australia": "AU",
  "japan": "JP", "china": "CN", "india": "IN", "mexico": "MX",
  "argentina": "AR", "switzerland": "CH", "austria": "AT",
  "sweden": "SE", "norway": "NO", "denmark": "DK", "finland": "FI",
  "poland": "PL", "ireland": "IE", "new zealand": "NZ",
  "south africa": "ZA", "south korea": "KR", "korea": "KR",
  "turkey": "TR", "greece": "GR", "czech republic": "CZ", "czechia": "CZ",
  "romania": "RO", "hungary": "HU", "colombia": "CO", "chile": "CL",
  "peru": "PE", "ukraine": "UA", "russia": "RU", "israel": "IL",
  "singapore": "SG", "thailand": "TH", "indonesia": "ID", "philippines": "PH",
  "malaysia": "MY", "vietnam": "VN", "egypt": "EG", "nigeria": "NG",
  "morocco": "MA", "uae": "AE", "united arab emirates": "AE",
  "saudi arabia": "SA", "qatar": "QA", "kuwait": "KW",
  "luxembourg": "LU", "croatia": "HR", "serbia": "RS", "bulgaria": "BG",
  "slovakia": "SK", "slovenia": "SI", "estonia": "EE", "latvia": "LV", "lithuania": "LT",
  "iceland": "IS", "malta": "MT", "cyprus": "CY",
};

function countryFlag(name: string): string {
  const iso = COUNTRY_ISO[name.toLowerCase().trim()];
  if (!iso) return "";
  return String.fromCodePoint(...iso.split("").map(c => 0x1F1E6 + c.charCodeAt(0) - 65));
}

// ── Signal bars for priority (matches tasks page) ───────────────────────────
const SIGNAL_FILLED: Record<string, number> = { low: 1, medium: 2, high: 3, urgent: 4 };
const SIGNAL_COLOR: Record<string, string> = {
  low: "#22C55E", medium: "#EAB308", high: "#F97316", urgent: "#EF4444",
};

function PriorityBars({ value }: { value: string }) {
  const v = value?.toLowerCase() ?? "medium";
  const filled = SIGNAL_FILLED[v] ?? 2;
  const color = SIGNAL_COLOR[v] ?? "#9CA3AF";
  return (
    <div className="flex items-end gap-[2px] mr-1 shrink-0">
      {[5, 8, 11, 14].map((h, i) => (
        <div
          key={i}
          className="w-[3px] rounded-[1px]"
          style={{ height: `${h}px`, backgroundColor: i < filled ? color : "#D1D5DB" }}
        />
      ))}
    </div>
  );
}

// ── Virtual list item type ────────────────────────────────────────────────────

export type ProspectTableItem =
  | { kind: "header"; label: string; count: number }
  | { kind: "prospect"; prospect: ProspectRow };

// ── Helpers ───────────────────────────────────────────────────────────────────

function getProspectId(p: ProspectRow): number {
  return p.Id ?? p.id ?? 0;
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
  selectOptions?: string[];
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
  value, type, selectOptions, isEditing, editValue, isSaving, hasError,
  onStartEdit, onEditChange, onSave, onCancel,
}: EditableCellProps) {
  const { t } = useTranslation("prospects");
  if (isEditing && type === "select") {
    const options = selectOptions || [];
    return (
      <select
        autoFocus
        value={editValue}
        onChange={(e) => onSave(e.target.value)}
        onBlur={() => onSave(editValue)}
        onKeyDown={(e) => { if (e.key === "Escape") onCancel(); }}
        className="w-full h-[26px] text-[11px] bg-white dark:bg-card rounded px-1.5 ring-1 ring-brand-indigo/40 outline-none cursor-pointer"
      >
        {options.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
    );
  }

  if (isEditing) {
    return (
      <div style={{ position: "relative" }}>
        {/* Invisible spacer keeps the row height stable */}
        <div className="h-[26px]" />
        <textarea
          autoFocus
          value={editValue}
          onChange={(e) => {
            onEditChange(e.target.value);
            e.target.style.height = "auto";
            e.target.style.height = Math.max(32, e.target.scrollHeight) + "px";
          }}
          onBlur={() => onSave(editValue)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); e.currentTarget.blur(); }
            if (e.key === "Escape") onCancel();
          }}
          ref={(ta) => {
            if (!ta) return;
            ta.style.height = "auto";
            ta.style.height = Math.max(32, ta.scrollHeight) + "px";
            ta.selectionStart = ta.selectionEnd = ta.value.length;
          }}
          className="absolute top-0 left-0 w-full min-h-[32px] max-h-[300px] text-[12px] leading-relaxed bg-white dark:bg-card px-2.5 py-1.5 ring-2 ring-brand-indigo/50 shadow-[0_4px_24px_rgba(0,0,0,0.12)] outline-none resize-none rounded-none"
          style={{ zIndex: 9999, minWidth: 240, borderRadius: 0 }}
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "w-full h-[26px] px-1.5 flex items-center text-[11px] truncate rounded cursor-text select-text",
        hasError && "ring-1 ring-red-400/60 bg-red-50/30",
        isSaving && "opacity-50",
      )}
      onClick={(e) => { e.stopPropagation(); onStartEdit(); }}
      title={hasError ? t("table.saveFailed") : value}
    >
      <span className="truncate flex-1">
        {value || <span className="text-muted-foreground/35 italic not-italic">&mdash;</span>}
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

// ── Sortable header cell for drag-to-reorder ─────────────────────────────────

function SortableHeaderCell({ col, isFirst, t, onResizeStart }: { col: ColumnDef; isFirst: boolean; t: any; onResizeStart: (colKey: string, e: React.MouseEvent) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: col.key });
  const Icon = col.icon;
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    ...(isFirst ? {} : { position: "relative" as const }),
  };
  return (
    <th
      ref={setNodeRef}
      style={style}
      className={cn(
        "px-3 py-1.5 text-left text-[10px] font-bold uppercase tracking-wider text-foreground/50 whitespace-nowrap select-none bg-muted border-b border-border/20",
        isFirst && "sticky left-[36px] z-30",
      )}
    >
      {/* Drag handle = the label area only */}
      <div className="flex items-center gap-1 cursor-grab" {...attributes} {...listeners}>
        {Icon && <Icon className="h-3 w-3 text-muted-foreground/40" />}
        {t(col.tKey)}
      </div>
      {/* Resize handle — isolated from DnD listeners */}
      <div
        className="absolute right-0 top-0 bottom-0 w-[6px] cursor-col-resize hover:bg-brand-indigo/30"
        onMouseDown={(e) => { e.stopPropagation(); onResizeStart(col.key, e); }}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      />
    </th>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface ProspectsInlineTableProps {
  flatItems: ProspectTableItem[];
  loading: boolean;
  selectedProspectId: number | null;
  onSelectProspect: (prospect: ProspectRow) => void;
  onRefresh?: () => void;
  visibleCols: Set<string>;
  tableSearch: string;
  /** Multi-select state -- lifted to parent */
  selectedIds: Set<number>;
  onSelectionChange: (ids: Set<number>) => void;
  showVerticalLines?: boolean;
  fullWidthTable?: boolean;
  groupBy?: string;
  columnOrder?: string[];
  onColumnOrderChange?: (order: string[]) => void;
  columnWidths?: Record<string, number>;
  onColumnWidthsChange?: (widths: Record<string, number>) => void;
}

// ── Main component ────────────────────────────────────────────────────────────

export function ProspectsInlineTable({
  flatItems,
  loading,
  selectedProspectId,
  onSelectProspect,
  onRefresh,
  visibleCols,
  tableSearch,
  selectedIds,
  onSelectionChange,
  showVerticalLines,
  fullWidthTable,
  groupBy,
  columnOrder,
  onColumnOrderChange,
  columnWidths,
  onColumnWidthsChange,
}: ProspectsInlineTableProps) {

  const { t } = useTranslation("prospects");

  // Scroll selected row into view (e.g. from search)
  useEffect(() => {
    if (!selectedProspectId) return;
    const raf = requestAnimationFrame(() => {
      const row = document.querySelector(`tr[data-prospect-id="${selectedProspectId}"]`) as HTMLElement | null;
      if (row) row.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    return () => cancelAnimationFrame(raf);
  }, [selectedProspectId]);

  // ── Editing state ─────────────────────────────────────────────────────────
  const [editingCell,    setEditingCell]    = useState<{ pid: number; field: ColKey } | null>(null);
  const [editValue,      setEditValue]      = useState<string>("");
  const [savingCell,     setSavingCell]     = useState<{ pid: number; field: ColKey } | null>(null);
  const [saveError,      setSaveError]      = useState<{ pid: number; field: ColKey } | null>(null);
  const [localOverrides, setLocalOverrides] = useState<Map<number, Partial<Record<ColKey, string>>>>(new Map());

  // ── Shift-click ref ────────────────────────────────────────────────────────
  const lastClickedIndexRef = useRef<number>(-1);

  // ── Group collapse ────────────────────────────────────────────────────────
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const toggleGroupCollapse = (label: string) =>
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label); else next.add(label);
      return next;
    });

  // ── Visible columns (with smart contact folding) ────────────────────────
  const visibleColumns = useMemo(() => {
    const base = ALL_TABLE_COLUMNS.filter((c) => visibleCols.has(c.key));

    // Extract prospects from flatItems
    const prospects = flatItems
      .filter((i): i is Extract<ProspectTableItem, { kind: "prospect" }> => i.kind === "prospect")
      .map((i) => i.prospect);

    const hasContact1 = prospects.some((p) => !!(p as any).contact_name);
    const hasContact2 = prospects.some((p) => !!(p as any).contact2_name);

    const contact1SubCols: ColKey[] = ["contact_role", "contact_email", "contact_phone", "contact_linkedin"];
    const contact2SubCols: ColKey[] = ["contact2_role", "contact2_email", "contact2_phone", "contact2_linkedin"];

    const result = base.filter((c) => {
      if (!hasContact1 && contact1SubCols.includes(c.key)) return false;
      if (!hasContact2 && contact2SubCols.includes(c.key)) return false;
      return true;
    });

    // Apply custom column order if set
    if (columnOrder && columnOrder.length > 0) {
      const orderMap = new Map(columnOrder.map((key, idx) => [key, idx]));
      result.sort((a, b) => {
        const ai = orderMap.get(a.key) ?? 999;
        const bi = orderMap.get(b.key) ?? 999;
        return ai - bi;
      });
    }

    return result;
  }, [visibleCols, flatItems, columnOrder]);

  const colSpan = visibleColumns.length;

  // ── Niche color map (stable: sorted alphabetically → sequential colors) ──
  const nicheColorMap = useMemo(() => {
    const niches: string[] = [];
    for (const item of flatItems) {
      if (item.kind === "prospect") {
        const n = String(item.prospect.niche || "");
        if (n) niches.push(n);
      }
    }
    return buildNicheColorMap(niches);
  }, [flatItems]);

  const getNicheColor = useCallback(
    (niche: string) => nicheColorMap.get(niche.toLowerCase()) ?? FALLBACK_NICHE_COLOR,
    [nicheColorMap],
  );

  // ── Filter by text search ─────────────────────────────────────────────────
  const displayItems = useMemo(() => {
    if (!tableSearch.trim()) return flatItems;
    const q = tableSearch.toLowerCase();
    return flatItems.filter((item) => {
      if (item.kind === "header") return false;
      const p = item.prospect;
      return (
        String(p.name || "").toLowerCase().includes(q) ||
        String(p.company || "").toLowerCase().includes(q) ||
        String(p.niche || "").toLowerCase().includes(q) ||
        String(p.email || "").toLowerCase().includes(q) ||
        String(p.status || "").toLowerCase().includes(q)
      );
    });
  }, [flatItems, tableSearch]);

  // ── Prospect index map ─────────────────────────────────────────────────────
  const prospectIndexMap = useMemo(() => {
    const map = new Map<number, number>();
    let idx = 0;
    displayItems.forEach((item) => {
      if (item.kind === "prospect") { map.set(getProspectId(item.prospect), idx); idx++; }
    });
    return map;
  }, [displayItems]);

  const prospectOnlyItems = useMemo(
    () => displayItems.filter((i): i is Extract<ProspectTableItem, { kind: "prospect" }> => i.kind === "prospect"),
    [displayItems]
  );

  const prospectCount = prospectOnlyItems.length;

  // ── getCellValue ──────────────────────────────────────────────────────────
  function getCellValue(prospect: ProspectRow, field: ColKey): string {
    const pid = getProspectId(prospect);
    const overrides = localOverrides.get(pid);
    if (overrides?.[field] !== undefined) return overrides[field]!;
    switch (field) {
      case "company":     return String(prospect.company || "");
      case "niche":       return String(prospect.niche || "");
      case "country":     return String(prospect.country || "");
      case "city":        return String(prospect.city || "");
      case "website":     return String(prospect.website || "");
      case "source":      return String(prospect.source || "");
      case "status":      return String(prospect.status || "");
      case "priority":    return String(prospect.priority || "");
      case "notes":            return String(prospect.notes || "");
      case "next_action":      return String(prospect.next_action || "");
      case "action":           return String((prospect as any).action || "");
      case "contact_name":     return String((prospect as any).contact_name || "");
      case "contact_role":     return String((prospect as any).contact_role || "");
      case "contact_email":    return String((prospect as any).contact_email || "");
      case "contact_phone":    return String((prospect as any).contact_phone || "");
      case "contact_linkedin": return String((prospect as any).contact_linkedin || "");
      case "contact2_name":     return String((prospect as any).contact2_name || "");
      case "contact2_role":     return String((prospect as any).contact2_role || "");
      case "contact2_email":    return String((prospect as any).contact2_email || "");
      case "contact2_phone":    return String((prospect as any).contact2_phone || "");
      case "contact2_linkedin": return String((prospect as any).contact2_linkedin || "");
      default:                 return "";
    }
  }

  // ── Editing helpers ───────────────────────────────────────────────────────
  const startEdit = useCallback((pid: number, field: ColKey, currentValue: string) => {
    setEditingCell({ pid, field });
    setEditValue(currentValue);
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingCell(null);
    setEditValue("");
  }, []);

  const handleSave = useCallback(async (pid: number, field: ColKey, newValue: string, originalValue: string) => {
    setEditingCell(null);
    if (newValue === originalValue) return;
    const dbField = DB_FIELD_MAP[field];
    if (!dbField) return;

    setLocalOverrides((prev) => {
      const next = new Map(prev);
      next.set(pid, { ...next.get(pid), [field]: newValue });
      return next;
    });
    setSavingCell({ pid, field });
    setSaveError(null);

    try {
      await updateProspect(pid, { [dbField]: newValue });
    } catch {
      setLocalOverrides((prev) => {
        const next = new Map(prev);
        next.set(pid, { ...next.get(pid), [field]: originalValue });
        return next;
      });
      setSaveError({ pid, field });
      setTimeout(() => setSaveError(null), 3000);
    } finally {
      setSavingCell(null);
    }
  }, []);

  // ── Row click ─────────────────────────────────────────────────────────────
  const handleRowClick = useCallback((prospect: ProspectRow, e: React.MouseEvent) => {
    const pid = getProspectId(prospect);
    const idx = prospectIndexMap.get(pid) ?? -1;

    if (e.shiftKey && lastClickedIndexRef.current >= 0) {
      const lo = Math.min(lastClickedIndexRef.current, idx);
      const hi = Math.max(lastClickedIndexRef.current, idx);
      const rangeIds = prospectOnlyItems.slice(lo, hi + 1).map((item) => getProspectId(item.prospect));
      const next = new Set(selectedIds);
      rangeIds.forEach((id) => next.add(id));
      onSelectionChange(next);
      if (next.size === 1) {
        const only = prospectOnlyItems.find((i) => getProspectId(i.prospect) === Array.from(next)[0]);
        if (only) onSelectProspect(only.prospect);
      }
    } else if (e.ctrlKey || e.metaKey) {
      const next = new Set(selectedIds);
      if (next.has(pid)) next.delete(pid); else next.add(pid);
      onSelectionChange(next);
      if (next.size === 1) {
        const only = prospectOnlyItems.find((i) => getProspectId(i.prospect) === Array.from(next)[0]);
        if (only) onSelectProspect(only.prospect);
      }
      lastClickedIndexRef.current = idx;
    } else {
      // Simple click: single select + open detail
      onSelectionChange(new Set([pid]));
      onSelectProspect(prospect);
      lastClickedIndexRef.current = idx;
    }
  }, [prospectIndexMap, prospectOnlyItems, onSelectProspect, onSelectionChange, selectedIds]);

  // ── Group checkbox helpers ──────────────────────────────────────────────────
  const getGroupProspectIds = useCallback((groupLabel: string): number[] => {
    const ids: number[] = [];
    let inGroup = false;
    for (const item of displayItems) {
      if (item.kind === "header") {
        inGroup = item.label === groupLabel;
        continue;
      }
      if (inGroup) ids.push(getProspectId(item.prospect));
    }
    return ids;
  }, [displayItems]);

  const handleGroupCheckbox = useCallback((groupLabel: string) => {
    const groupIds = getGroupProspectIds(groupLabel);
    const allSelected = groupIds.every((id) => selectedIds.has(id));
    const next = new Set(selectedIds);
    if (allSelected) {
      groupIds.forEach((id) => next.delete(id));
    } else {
      groupIds.forEach((id) => next.add(id));
    }
    onSelectionChange(next);
  }, [getGroupProspectIds, selectedIds, onSelectionChange]);

  // ── Drag-to-reorder columns ──────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = visibleColumns.findIndex((c) => c.key === active.id);
    const newIndex = visibleColumns.findIndex((c) => c.key === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const newOrder = arrayMove(visibleColumns.map((c) => c.key), oldIndex, newIndex);
    onColumnOrderChange?.(newOrder);
  }, [visibleColumns, onColumnOrderChange]);

  // ── Column resize ──────────────────────────────────────────────────────────
  const [liveWidths, setLiveWidths] = useState<Record<string, number>>({});

  const getColWidth = useCallback((col: ColumnDef) => {
    if (liveWidths[col.key]) return liveWidths[col.key];
    return columnWidths?.[col.key] ?? col.width;
  }, [columnWidths, liveWidths]);

  const handleResizeStart = useCallback((colKey: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const col = visibleColumns.find(c => c.key === colKey);
    if (!col) return;
    const startWidth = columnWidths?.[colKey] ?? col.width;
    const startX = e.clientX;

    const onMouseMove = (ev: MouseEvent) => {
      const delta = ev.clientX - startX;
      const newWidth = Math.max(60, startWidth + delta);
      setLiveWidths(prev => ({ ...prev, [colKey]: newWidth }));
    };
    const onMouseUp = (ev: MouseEvent) => {
      const delta = ev.clientX - startX;
      const newWidth = Math.max(60, startWidth + delta);
      const updated = { ...columnWidths, [colKey]: newWidth };
      onColumnWidthsChange?.(updated);
      setLiveWidths({});
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }, [columnWidths, visibleColumns, onColumnWidthsChange]);

  return (
    <div className="h-full flex flex-col overflow-hidden bg-transparent">

      {/* ── Table ── */}
      {loading ? (
        <TableSkeleton />
      ) : (
        <div className="flex-1 min-h-0 overflow-auto">
          <table className={cn("min-w-full w-full", showVerticalLines && "[&_td]:border-r [&_td]:border-border/10 [&_th]:border-r [&_th]:border-border/10")} style={{ borderCollapse: "separate", borderSpacing: "0 2px", tableLayout: "fixed" }}>

            {/* Enforce column widths + trailing fill column */}
            <colgroup>
              <col style={{ width: 36 }} />
              {visibleColumns.map((col) => (
                <col key={col.key} style={{ width: getColWidth(col) }} />
              ))}
              <col />
            </colgroup>

            {/* Sticky header */}
            <thead className="sticky top-0 z-40 bg-muted" style={{ boxShadow: "0 2px 0 0 hsl(var(--muted))" }}>
              <tr>
                {/* Select-all checkbox */}
                <th className="sticky left-0 z-30 w-[36px] px-1 bg-muted border-b border-border/20">
                  <div className="flex items-center justify-center h-full">
                    <div
                      className={cn(
                        "h-4 w-4 rounded border flex items-center justify-center shrink-0 cursor-pointer",
                        prospectCount > 0 && selectedIds.size === prospectCount
                          ? "border-brand-indigo bg-brand-indigo"
                          : "border-border/40"
                      )}
                      onClick={() => {
                        if (selectedIds.size === prospectCount) {
                          onSelectionChange(new Set());
                        } else {
                          const allIds = new Set(prospectOnlyItems.map((i) => getProspectId(i.prospect)));
                          onSelectionChange(allIds);
                        }
                      }}
                    >
                      {prospectCount > 0 && selectedIds.size === prospectCount && (
                        <Check className="h-2.5 w-2.5 text-white" />
                      )}
                    </div>
                  </div>
                </th>
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={visibleColumns.map(c => c.key)} strategy={horizontalListSortingStrategy}>
                    {visibleColumns.map((col, ci) => (
                      <SortableHeaderCell key={col.key} col={col} isFirst={ci === 0} t={t} onResizeStart={handleResizeStart} />
                    ))}
                  </SortableContext>
                </DndContext>
                <th className="bg-muted border-b border-border/20" />
              </tr>
            </thead>

            <tbody>
              {/* Empty state */}
              {prospectCount === 0 && (
                <tr>
                  <td colSpan={colSpan + 2} className="py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Building2 className="h-7 w-7 text-muted-foreground/30" />
                      <p className="text-xs text-muted-foreground">
                        {tableSearch ? t("page.noProspectsMatch") : t("page.noProspectsFound")}
                      </p>
                    </div>
                  </td>
                </tr>
              )}

              {(() => {
                let currentGroup: string | null = null;
                let rowIdx = 0;
                return displayItems.map((item, index) => {
                  if (item.kind === "header") {
                    currentGroup = item.label;
                    const isCollapsed = collapsedGroups.has(item.label);
                    const nicheC = getNicheColor(item.label);
                    // Use priority group color when grouping by priority
                    const hexColor = groupBy === "priority" && PRIORITY_GROUP_COLORS[item.label]
                      ? PRIORITY_GROUP_COLORS[item.label]
                      : nicheC.hex;
                    const opaqueTint = opaqueNicheTint(hexColor);
                    const groupIds = getGroupProspectIds(item.label);
                    const isGroupFullySelected = groupIds.length > 0 && groupIds.every((id) => selectedIds.has(id));
                    const flag = groupBy === "country" ? countryFlag(item.label) : "";
                    return (
                      <tr
                        key={`h-${item.label}-${index}`}
                        className="cursor-pointer select-none h-[36px] sticky z-[15]"
                        style={{ top: 30 }}
                        onClick={() => toggleGroupCollapse(item.label)}
                      >
                        {/* Cell 1: Checkbox */}
                        <td className="sticky left-0 z-30 w-[36px] px-1" style={{ backgroundColor: opaqueTint }}>
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

                        {/* Cell 2: Label — sticky */}
                        <td
                          className="sticky left-[36px] z-30 pl-1 pr-3 min-w-[300px]"
                          style={{ backgroundColor: opaqueTint }}
                        >
                          <div className="flex items-center gap-2">
                            {isCollapsed ? <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/50" />}
                            {flag && <span className="text-sm">{flag}</span>}
                            <span className="text-[11px] font-bold text-foreground/70">{item.label}</span>
                            <span className="text-[10px] text-muted-foreground/50 font-medium tabular-nums">{item.count}</span>
                          </div>
                        </td>

                        {/* Cell 3: Filler */}
                        <td
                          colSpan={visibleColumns.length}
                          style={{ backgroundColor: opaqueTint }}
                        />
                      </tr>
                    );
                  }

                  if (currentGroup && collapsedGroups.has(currentGroup)) return null;

                  const { prospect } = item;
                  const pid = getProspectId(prospect);
                  const isDetailSelected = selectedProspectId === pid;
                  const isMultiSelected = selectedIds.has(pid);
                  const isHighlighted = isMultiSelected || isDetailSelected;
                  const company = String(prospect.company || t("detail.unnamedProspect"));
                  const niche = String(prospect.niche || "");
                  const nicheColor = getNicheColor(niche);
                  const bgClass = isHighlighted ? "bg-highlight-selected" : "bg-card group-hover/row:bg-card-hover";

                  const isRowEditing = editingCell?.pid === pid;
                  const currentRowIdx = rowIdx++;
                  return (
                    <tr
                      key={pid}
                      data-prospect-id={pid}
                      className={cn(
                        "group/row cursor-pointer h-[40px] animate-card-enter",
                        isHighlighted ? "bg-highlight-selected" : "bg-card hover:bg-card-hover",
                      )}
                      style={{ animationDelay: `${Math.min(currentRowIdx, 15) * 30}ms`, ...(isRowEditing ? { position: "relative" as const, zIndex: 50 } : {}) }}
                      onClick={(e) => handleRowClick(prospect, e)}
                    >
                      {/* Separate checkbox td */}
                      <td className={cn("sticky left-0 z-10 w-[36px] px-1", bgClass)}>
                        <div className="flex items-center justify-center h-full">
                          <div
                            className={cn(
                              "h-4 w-4 rounded border flex items-center justify-center shrink-0 cursor-pointer",
                              isMultiSelected ? "border-brand-indigo bg-brand-indigo" : "border-border/40"
                            )}
                            onClick={(e) => {
                              e.stopPropagation();
                              const next = new Set(selectedIds);
                              if (next.has(pid)) next.delete(pid); else next.add(pid);
                              onSelectionChange(next);
                              if (next.size === 1) {
                                const only = prospectOnlyItems.find((i) => getProspectId(i.prospect) === Array.from(next)[0]);
                                if (only) onSelectProspect(only.prospect);
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
                          isFirst && bgClass,
                        );

                        // ── Company column (sticky, with avatar) ──
                        if (col.key === "company") {
                          return (
                            <td key="company" className={cn("px-2.5", tdClass)}>
                              <div className="flex items-center gap-2 min-w-0">
                                <EntityAvatar
                                  name={company}
                                  photoUrl={prospect.photo_url}
                                  bgColor={nicheColor.hex}
                                  textColor="#fff"
                                  size={32}
                                  className="font-normal"
                                />
                                <span className="text-[12px] font-medium truncate text-foreground">{company}</span>
                              </div>
                            </td>
                          );
                        }

                        // ── Status (editable select with dot) ──
                        if (col.key === "status") {
                          const cellVal = getCellValue(prospect, "status");
                          const isEdit = editingCell?.pid === pid && editingCell?.field === "status";
                          return (
                            <td key="status" className={cn("px-1", tdClass)} style={isEdit ? { overflow: "visible" } : undefined}>
                              <div className="flex items-center gap-1.5 min-w-0">
                                {!isEdit && (
                                  <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", STATUS_DOT[cellVal] ?? "bg-zinc-400")} />
                                )}
                                <EditableCell
                                  value={cellVal}
                                  type="select"
                                  selectOptions={STATUS_OPTIONS}
                                  isEditing={isEdit}
                                  editValue={isEdit ? editValue : ""}
                                  isSaving={savingCell?.pid === pid && savingCell?.field === "status"}
                                  hasError={saveError?.pid === pid && saveError?.field === "status"}
                                  onStartEdit={() => startEdit(pid, "status", cellVal)}
                                  onEditChange={setEditValue}
                                  onSave={(v) => handleSave(pid, "status", v, cellVal)}
                                  onCancel={cancelEdit}
                                />
                              </div>
                            </td>
                          );
                        }

                        // ── Priority (editable select with bars) ──
                        if (col.key === "priority") {
                          const cellVal = getCellValue(prospect, "priority");
                          const isEdit = editingCell?.pid === pid && editingCell?.field === "priority";
                          return (
                            <td key="priority" className={cn("px-1", tdClass)} style={isEdit ? { overflow: "visible" } : undefined}>
                              <div className="flex items-center gap-1.5 min-w-0">
                                {!isEdit && cellVal && <PriorityBars value={cellVal} />}
                                <EditableCell
                                  value={cellVal}
                                  type="select"
                                  selectOptions={PRIORITY_OPTIONS}
                                  isEditing={isEdit}
                                  editValue={isEdit ? editValue : ""}
                                  isSaving={savingCell?.pid === pid && savingCell?.field === "priority"}
                                  hasError={saveError?.pid === pid && saveError?.field === "priority"}
                                  onStartEdit={() => startEdit(pid, "priority", cellVal)}
                                  onEditChange={setEditValue}
                                  onSave={(v) => handleSave(pid, "priority", v, cellVal)}
                                  onCancel={cancelEdit}
                                />
                              </div>
                            </td>
                          );
                        }

                        // ── Country (with flag) ──
                        if (col.key === "country") {
                          const cellVal = getCellValue(prospect, "country");
                          const isEdit = editingCell?.pid === pid && editingCell?.field === "country";
                          const flag = cellVal ? countryFlag(cellVal) : "";
                          return (
                            <td key="country" className={cn("px-1", tdClass)} style={isEdit ? { overflow: "visible" } : undefined}>
                              <div className="flex items-center gap-1.5 min-w-0">
                                {!isEdit && flag && <span className="text-sm shrink-0">{flag}</span>}
                                <EditableCell
                                  value={cellVal}
                                  type="text"
                                  isEditing={isEdit}
                                  editValue={isEdit ? editValue : ""}
                                  isSaving={savingCell?.pid === pid && savingCell?.field === "country"}
                                  hasError={saveError?.pid === pid && saveError?.field === "country"}
                                  onStartEdit={() => startEdit(pid, "country", cellVal)}
                                  onEditChange={setEditValue}
                                  onSave={(v) => handleSave(pid, "country", v, cellVal)}
                                  onCancel={cancelEdit}
                                />
                              </div>
                            </td>
                          );
                        }

                        // ── Source (editable select) ──
                        if (col.key === "source") {
                          const cellVal = getCellValue(prospect, "source");
                          const isEdit = editingCell?.pid === pid && editingCell?.field === "source";
                          return (
                            <td key="source" className={cn("px-1", tdClass)} style={isEdit ? { overflow: "visible" } : undefined}>
                              <EditableCell
                                value={cellVal}
                                type="select"
                                selectOptions={SOURCE_OPTIONS}
                                isEditing={isEdit}
                                editValue={isEdit ? editValue : ""}
                                isSaving={savingCell?.pid === pid && savingCell?.field === "source"}
                                hasError={saveError?.pid === pid && saveError?.field === "source"}
                                onStartEdit={() => startEdit(pid, "source", cellVal)}
                                onEditChange={setEditValue}
                                onSave={(v) => handleSave(pid, "source", v, cellVal)}
                                onCancel={cancelEdit}
                              />
                            </td>
                          );
                        }

                        // ── Action (editable select) ──
                        if (col.key === "action") {
                          const cellVal = getCellValue(prospect, "action");
                          const isEdit = editingCell?.pid === pid && editingCell?.field === "action";
                          return (
                            <td key="action" className={cn("px-1", tdClass)} style={isEdit ? { overflow: "visible" } : undefined}>
                              <EditableCell
                                value={cellVal}
                                type="select"
                                selectOptions={ACTION_OPTIONS}
                                isEditing={isEdit}
                                editValue={isEdit ? editValue : ""}
                                isSaving={savingCell?.pid === pid && savingCell?.field === "action"}
                                hasError={saveError?.pid === pid && saveError?.field === "action"}
                                onStartEdit={() => startEdit(pid, "action", cellVal)}
                                onEditChange={setEditValue}
                                onSave={(v) => handleSave(pid, "action", v, cellVal)}
                                onCancel={cancelEdit}
                              />
                            </td>
                          );
                        }

                        // ── Editable text columns ──
                        const colDef = ALL_TABLE_COLUMNS.find((c) => c.key === col.key)!;
                        if (colDef?.editable) {
                          const cellVal = getCellValue(prospect, col.key);
                          const isEdit = editingCell?.pid === pid && editingCell?.field === col.key;
                          return (
                            <td
                              key={col.key}
                              className={cn("px-1", tdClass)}
                              style={isEdit ? { overflow: "visible" } : undefined}
                            >
                              <EditableCell
                                value={cellVal}
                                type="text"
                                isEditing={isEdit}
                                editValue={isEdit ? editValue : ""}
                                isSaving={savingCell?.pid === pid && savingCell?.field === col.key}
                                hasError={saveError?.pid === pid && saveError?.field === col.key}
                                onStartEdit={() => startEdit(pid, col.key, cellVal)}
                                onEditChange={setEditValue}
                                onSave={(v) => handleSave(pid, col.key, v, cellVal)}
                                onCancel={cancelEdit}
                              />
                            </td>
                          );
                        }

                        // ── Read-only text fallback ──
                        return (
                          <td key={col.key} className={cn("px-2.5", tdClass)}>
                            <span className="text-[11px] text-muted-foreground truncate block">
                              {getCellValue(prospect, col.key) || <span className="text-muted-foreground/30">&mdash;</span>}
                            </span>
                          </td>
                        );
                      })}
                      {/* Trailing fill cell */}
                      <td className={bgClass} />
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
