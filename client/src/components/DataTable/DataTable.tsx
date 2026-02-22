import React, { useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import type {
  DraggableAttributes,
  DraggableSyntheticListeners,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { DataEmptyState } from "@/components/crm/DataEmptyState";

import {
  Activity,
  Briefcase,
  Building2,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  Database,
  Download,
  Eye,
  EyeOff,
  FileText,
  Filter,
  Globe,
  Hash,
  LayoutGrid,
  Link as LinkIcon,
  ListFilter,
  Mail,
  MoreHorizontal,
  Phone,
  Plus,
  RefreshCw,
  Settings,
  Tag,
  User,
  Zap,
} from "lucide-react";

export interface DataTableRow {
  Id: number;
  [key: string]: any;
}

export type SortDirection = "asc" | "desc" | null;

export interface SortConfig {
  key: string;
  direction: SortDirection;
}

export type RowSpacing = "tight" | "medium" | "spacious";

interface LabeledOption {
  value: string;
  label: string;
}

type ViewMenuOption =
  | { type: "workspace"; value: string; label: string }
  | { type: "preset"; value: string; label: string; presetKey: string };

export interface DataTableProps<TRow extends DataTableRow = DataTableRow> {
  loading?: boolean;

  rows: TRow[];
  columns: string[];

  visibleColumns: string[];
  onVisibleColumnsChange: (next: string[]) => void;

  selectedIds: number[];
  onSelectedIdsChange: (next: number[]) => void;

  sortConfig: SortConfig;
  onSortChange: (next: SortConfig) => void;

  groupBy: string;
  onGroupByChange?: (next: string) => void;
  groupOptions?: { value: string; label: string }[];

  colWidths: Record<string, number>;
  onColWidthsChange: (next: Record<string, number>) => void;

  rowSpacing: RowSpacing;
  onRowSpacingChange?: (next: RowSpacing) => void;
  showVerticalLines: boolean;
  onShowVerticalLinesChange?: (next: boolean) => void;

  onUpdate: (rowId: number, col: string, value: any) => void;
  onDelete?: (ids: number[]) => void;

  statusOptions: string[];
  typeOptions: string[];
  timezoneOptions: string[];

  automationStatusOptions?: string[];
  hiddenFields: string[];
  nonEditableFields: string[];
  smallWidthCols?: string[];

  onUndoRedoReady?: (api: {
    undo: () => void;
    redo: () => void;
    canUndo: boolean;
    canRedo: boolean;
  }) => void;

  // ─────────────────────
  // Toolbar-related props
  // ─────────────────────
  filterConfig?: Record<string, string>;
  onFilterConfigChange?: (next: Record<string, string>) => void;
  searchValue?: string;
  onSearchValueChange?: (value: string) => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;

  workspaceViewOptions?: { value: string; label: string }[];
  activeWorkspaceView?: string;
  onWorkspaceViewChange?: (value: string) => void;

  onAdd?: () => void;
  addLabel?: string;
  onViewSelected?: () => void;
  canViewSelected?: boolean;

  /** Called when a data row is clicked (not the checkbox column) */
  onRowClick?: (row: TRow) => void;

  onImportCSV?: (file: File) => void;
  onExportCSV?: () => void;

  /** Enable self-contained CSV export with field-selection dialog */
  exportable?: boolean;
  /** Filename (without extension) for the exported CSV — defaults to "export" */
  exportFilename?: string;

  // ─────────────────────
  // Empty state
  // ─────────────────────
  /** Variant for the empty state design when no rows exist */
  emptyStateVariant?: import("@/components/crm/DataEmptyState").EmptyStateVariant;
  /** Override empty state title */
  emptyStateTitle?: string;
  /** Override empty state description */
  emptyStateDescription?: string;

  // ─────────────────────
  // Pagination
  // ─────────────────────
  pageSize?: number; // If set, enables client-side pagination (initial value)
  /** If provided, shows a page-size selector with these options (e.g. [25, 50, 100]) */
  pageSizeOptions?: number[];

  // ─────────────────────
  // Virtualization
  // ─────────────────────
  /** When true, uses TanStack Virtual for efficient rendering of 1000+ rows */
  virtualized?: boolean;
  /** Height of the virtualized scroll container (default: "calc(100vh - 320px)") */
  virtualizedContainerHeight?: string;

  // ─────────────────────
  // Bulk actions slot
  // ─────────────────────
  /** Render custom bulk action buttons when rows are selected */
  renderBulkActions?: (selectedIds: number[], clearSelection: () => void) => React.ReactNode;
}

const defaultRowPadding: Record<RowSpacing, string> = {
  tight: "py-2",
  medium: "py-4",
  spacious: "py-8",
};

const initialsColors = [
  { text: "text-[#1a3a6f]", bg: "bg-[#1a3a6f]/10", dot: "bg-[#1a3a6f]", border: "border-[#1a3a6f]/20" },
  { text: "text-[#2d5aa8]", bg: "bg-[#2d5aa8]/10", dot: "bg-[#2d5aa8]", border: "border-[#2d5aa8]/20" },
  { text: "text-[#1E90FF]", bg: "bg-[#1E90FF]/10", dot: "bg-[#1E90FF]", border: "border-[#1E90FF]/20" },
  { text: "text-[#17A398]", bg: "bg-[#17A398]/10", dot: "bg-[#17A398]", border: "border-[#17A398]/20" },
  { text: "text-[#10b981]", bg: "bg-[#10b981]/10", dot: "bg-[#10b981]", border: "border-[#10b981]/20" },
  { text: "text-[#ca8a04]", bg: "bg-[#facc15]/20", dot: "bg-[#facc15]", border: "border-[#facc15]/30" },
];

const normalizeCol = (col: string) =>
  col.toLowerCase().replace(/\s+/g, " ").trim();

const getInitials = (name: string) => {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2)
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name[0].toUpperCase();
};

const getAccountColor = (id: number) => initialsColors[id % initialsColors.length];

const statusColors: Record<
  string,
  { text: string; bg: string; border: string; dot: string }
> = {
  Active: {
    text: "text-[#10b981]",
    bg: "bg-[#10b981]/10",
    border: "border-[#10b981]/20",
    dot: "bg-[#10b981]",
  },
  Paused: {
    text: "text-[#f59e0b]",
    bg: "bg-[#f59e0b]/10",
    border: "border-[#f59e0b]/20",
    dot: "bg-[#f59e0b]",
  },
  Completed: {
    text: "text-[#6b7280]",
    bg: "bg-[#6b7280]/10",
    border: "border-[#6b7280]/20",
    dot: "bg-[#6b7280]",
  },
  Finished: {
    text: "text-[#6b7280]",
    bg: "bg-[#6b7280]/10",
    border: "border-[#6b7280]/20",
    dot: "bg-[#6b7280]",
  },
  Draft: {
    text: "text-[#6b7280]",
    bg: "bg-[#6b7280]/10",
    border: "border-[#6b7280]/20",
    dot: "bg-[#6b7280]",
  },
  Inactive: {
    text: "text-[#ef4444]",
    bg: "bg-[#ef4444]/10",
    border: "border-[#ef4444]/20",
    dot: "bg-[#ef4444]",
  },
  Trial: {
    text: "text-[#1E90FF]",
    bg: "bg-[#1E90FF]/10",
    border: "border-[#1E90FF]/20",
    dot: "bg-[#1E90FF]",
  },
  Suspended: {
    text: "text-[#ef4444]",
    bg: "bg-[#ef4444]/10",
    border: "border-[#ef4444]/20",
    dot: "bg-[#ef4444]",
  },
  Unknown: {
    text: "text-muted-foreground",
    bg: "bg-muted/10",
    border: "border-border",
    dot: "bg-muted-foreground",
  },
};

const timezoneColors: Record<string, { text: string; bg: string; border: string }> = {
  UTC: { text: "text-[#64748b] dark:text-[#94a3b8]", bg: "bg-[#64748b]/10", border: "border-[#64748b]/20" },
  "Europe/London": { text: "text-[#2563eb] dark:text-[#60a5fa]", bg: "bg-[#2563eb]/10", border: "border-[#2563eb]/20" },
  "Europe/Paris": { text: "text-[#4f46e5] dark:text-[#818cf8]", bg: "bg-[#4f46e5]/10", border: "border-[#4f46e5]/20" },
  "Europe/Berlin": { text: "text-[#7c3aed] dark:text-[#a78bfa]", bg: "bg-[#7c3aed]/10", border: "border-[#7c3aed]/20" },
  "Europe/Amsterdam": { text: "text-[#ea580c] dark:text-[#fb923c]", bg: "bg-[#ea580c]/10", border: "border-[#ea580c]/20" },
  "America/New_York": { text: "text-[#059669] dark:text-[#34d399]", bg: "bg-[#059669]/10", border: "border-[#059669]/20" },
  "America/Los_Angeles": { text: "text-[#e11d48] dark:text-[#fb7185]", bg: "bg-[#e11d48]/10", border: "border-[#e11d48]/20" },
  "America/Sao_Paulo": { text: "text-[#16a34a] dark:text-[#4ade80]", bg: "bg-[#16a34a]/10", border: "border-[#16a34a]/20" },
  "Asia/Tokyo": { text: "text-[#dc2626] dark:text-[#f87171]", bg: "bg-[#dc2626]/10", border: "border-[#dc2626]/20" },
  "Asia/Dubai": { text: "text-[#d97706] dark:text-[#fbbf24]", bg: "bg-[#d97706]/10", border: "border-[#d97706]/20" },
};

const getIconForField = (col: string) => {
  const c = col.toLowerCase();
  if (c === "name") return <Building2 className="h-3.5 w-3.5" />;
  if (c.includes("email")) return <Mail className="h-3.5 w-3.5" />;
  if (c.includes("phone")) return <Phone className="h-3.5 w-3.5" />;
  if (c.includes("status")) return <Activity className="h-3.5 w-3.5" />;
  if (c.includes("type")) return <Briefcase className="h-3.5 w-3.5" />;
  if (c.includes("website")) return <Globe className="h-3.5 w-3.5" />;
  if (c.includes("notes")) return <FileText className="h-3.5 w-3.5" />;
  if (c.includes("timezone")) return <Clock className="h-3.5 w-3.5" />;
  if (c.includes("account_id") || c.includes("campaign_id")) return <Hash className="h-3.5 w-3.5" />;
  if (c.includes("twilio") || c.includes("twillio"))
    return <Zap className="h-3.5 w-3.5" />;
  if (c.includes("webhook")) return <LinkIcon className="h-3.5 w-3.5" />;
  if (c.includes("user")) return <User className="h-3.5 w-3.5" />;
  if (c.includes("tag")) return <Tag className="h-3.5 w-3.5" />;
  if (c.includes("id")) return <Hash className="h-3.5 w-3.5" />;
  if (c.includes("time") || c.includes("at")) return <Clock className="h-3.5 w-3.5" />;
  return <Database className="h-3.5 w-3.5" />;
};

const formatHeaderTitle = (col: string) => {
  if (col === "name") return "Campaign Name";
  if (col === "Account ID" || col === "account_id") return "Account ID";
  if (col === "campaign_id") return "Campaign ID";
  if (col === "full_name") return "Full Name";
  if (col === "conversion_status") return "Conversion";
  if (col === "twilio_account_sid") return "Twilio Account SID";
  if (col === "twilio_auth_token") return "Twilio Auth Token";
  if (col === "twilio_messaging_service_sid") return "Messaging Service SID";
  if (col === "twilio_default_from_number") return "Default From Number";
  return col
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

/** Fields that contain sensitive Twilio credentials and should be masked by default */
const TWILIO_SENSITIVE_FIELDS = [
  "twilio_account_sid",
  "twilio_auth_token",
  "twilio_messaging_service_sid",
];

/** Fields that should show a partially-masked phone-style display */
const TWILIO_PHONE_FIELDS = ["twilio_default_from_number"];

const isTwilioField = (col: string) =>
  TWILIO_SENSITIVE_FIELDS.includes(col) || TWILIO_PHONE_FIELDS.includes(col);

/**
 * Mask a Twilio value for display.
 * Shows first 4 and last 4 characters with dots in between.
 * For short values (<= 8 chars), masks everything except last 4.
 */
const maskTwilioValue = (value: string): string => {
  if (!value) return "—";
  const str = String(value);
  if (str.length <= 4) return "••••";
  if (str.length <= 8) return "••••" + str.slice(-4);
  const prefix = str.slice(0, 4);
  const suffix = str.slice(-4);
  const dots = "•".repeat(Math.min(str.length - 8, 12));
  return `${prefix}${dots}${suffix}`;
};

const formatDateTimeParts = (value: any) => {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;

  const day = String(d.getDate()).padStart(2, "0");
  const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  const mon = months[d.getMonth()];
  const yr = String(d.getFullYear()).slice(-2);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return { date: `${day}/${mon}/${yr}`, time: `${hh}:${mm}`, d };
};

const formatDateTime = (value: any) => {
  const parts = formatDateTimeParts(value);
  if (!parts) return value ? String(value) : "-";
  return `${parts.date}   ${parts.time}`;
};

const formatHHmm = (value: any) => {
  if (!value) return "-";
  if (typeof value === "string" && value.includes(":")) {
    const parts = value.split(":");
    return `${parts[0].padStart(2, "0")}:${parts[1].padStart(2, "0")}`;
  }
  const d = new Date(value);
  if (!Number.isNaN(d.getTime())) {
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }
  return String(value);
};

const DATE_COLS = new Set([
  "created time",
  "last modified time",
  "createdat",
  "updatedat",
  "created_at",
  "updated_at",
  "next_action_at",
  "first_message_sent_at",
  "bump_1_sent_at",
  "bump_2_sent_at",
  "bump_3_sent_at",
  "last_message_sent_at",
  "booking_confirmed_at",
]);

const TIME_COLS = new Set(["business_hours_open", "business_hours_closed"]);

const ROLLUP_COLS_ORDER = [
  "Leads",
  "Campaigns",
  "Automation Logs",
  "Prompt Libraries",
  "Users",
  "Interactions",
  "Tags",
];

const AUTOMATION_MATCH = [
  "automation",
  "ai",
  "prompt",
  "assistant",
  "model",
  "max messages",
  "max_messages",
  "workflow",
  "trigger",
  "automation logs",
  "prompt libraries",
];

const isDateCol = (col: string) => DATE_COLS.has(normalizeCol(col));
const isTimeCol = (col: string) => TIME_COLS.has(normalizeCol(col));
const isRollupCol = (col: string) =>
  ROLLUP_COLS_ORDER.some((c) => normalizeCol(c) === normalizeCol(col));

const ALWAYS_VISIBLE_MATCH = [
  "id",
  "account id",
  "image",
  "acc",
  "name",
  "company name",
  "email",
  "phone",
  "last modified time",
  "updatedat",
  "updated_at",
];

const VIEW_PRESETS = [
  { key: "all", label: "All Fields", icon: <LayoutGrid className="h-4 w-4" /> },
  { key: "rollups", label: "Roll ups", icon: <ListFilter className="h-4 w-4" /> },
  { key: "twilio", label: "Twilio", icon: <Zap className="h-4 w-4" /> },
  { key: "basic", label: "Basic View", icon: <Eye className="h-4 w-4" /> },
  { key: "automation", label: "Automation", icon: <Settings className="h-4 w-4" /> },
];

const matchesAny = (col: string, list: string[]) => {
  const n = normalizeCol(col);
  return list.some((item) => n === normalizeCol(item));
};

const includesAny = (col: string, list: string[]) => {
  const n = normalizeCol(col);
  return list.some((item) => n.includes(normalizeCol(item)));
};

/* -------------------- helper cells/components -------------------- */

const DateTimeCell = ({ value }: { value: any }) => {
  const parts = formatDateTimeParts(value);
  if (!parts) return <span className="text-muted-foreground">-</span>;

  const now = new Date();
  const isToday =
    parts.d.getFullYear() === now.getFullYear() &&
    parts.d.getMonth() === now.getMonth() &&
    parts.d.getDate() === now.getDate();

  return (
    <div className="flex items-center gap-3 whitespace-nowrap">
      <span className={cn(isToday ? "text-brand-blue font-semibold" : "")}>
        {parts.date}
      </span>
      <span className="text-muted-foreground">{parts.time}</span>
    </div>
  );
};

const TruncatedCell = ({
  value,
  title,
  onUpdate,
  rowId,
  col,
}: {
  value: any;
  title?: string;
  onUpdate?: (rowId: number, col: string, next: any) => void;
  rowId?: number;
  col?: string;
}) => {
  const text = value === null || value === undefined ? "" : String(value);
  const tooltipTitle = title || text;

  const ref = useRef<HTMLDivElement>(null);
  const [isTruncated, setIsTruncated] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(text);

  // Keep draft in sync when the external value changes
  useEffect(() => {
    setDraft(text);
  }, [text]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => {
      const truncated = el.scrollWidth > el.clientWidth;
      setIsTruncated(truncated);
    };
    check();
    const observer = new ResizeObserver(check);
    observer.observe(el);
    return () => observer.disconnect();
  }, [text]);

  if (isEditing && onUpdate && rowId && col) {
    const widthCh = Math.max(12, draft.length + 2);
    return (
      <Input
        autoFocus
        className="h-8 w-auto min-w-[200px] max-w-none bg-card dark:bg-card shadow-lg border-brand-blue focus:ring-2 focus:ring-brand-blue/20 relative z-30"
        style={{ width: `${widthCh}ch` }}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (draft !== text) {
            onUpdate(rowId, col, draft);
          }
          setIsEditing(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            if (draft !== text) {
              onUpdate(rowId, col, draft);
            }
            setIsEditing(false);
            e.currentTarget.blur();
          }
          if (e.key === "Escape") {
            setIsEditing(false);
            e.currentTarget.blur();
          }
        }}
      />
    );
  }

  const content = (
    <div
      ref={ref}
      className="w-full min-h-[1.5rem] overflow-hidden whitespace-nowrap text-ellipsis cursor-text flex items-center"
      role="button"
      tabIndex={0}
      aria-label={`Edit ${text || 'cell'}`}
      onClick={() => setIsEditing(true)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setIsEditing(true); } }}
    >
      {text || "\u00A0"}
    </div>
  );

  return (
    <Popover open={isTruncated ? undefined : false}>
      <PopoverTrigger asChild>{content}</PopoverTrigger>
      <PopoverContent className="w-fit max-w-[420px] p-2 text-xs break-words shadow-xl border border-border bg-card z-[100]">
        {tooltipTitle}
      </PopoverContent>
    </Popover>
  );
};


const RollupCell = ({ value, type }: { value: any; type: string }) => {
  const list = useMemo(() => {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    if (typeof value === "string") {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [value];
      } catch {
        return value
          .split(",")
          .map((s: string) => s.trim())
          .filter(Boolean);
      }
    }
    return [String(value)];
  }, [value]);

  const count = list.length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <div className="flex items-center gap-1.5 cursor-pointer hover:opacity-80 transition-opacity bg-muted/30 p-1 rounded border border-transparent hover:border-border overflow-hidden w-full">
          <Badge
            variant="secondary"
            className="bg-muted text-muted-foreground border-border font-bold px-1.5 h-5 min-w-[24px] justify-center shrink-0"
          >
            {count}
          </Badge>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold truncate">
            {type}
          </span>
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3 shadow-2xl border border-border bg-card z-[100]">
        <div className="space-y-2">
          <div className="flex items-center justify-between border-b pb-2">
            <h4 className="font-black text-[10px] uppercase tracking-widest text-muted-foreground">
              {type}
            </h4>
            <Badge className="bg-brand-blue/10 text-brand-blue border-brand-blue/20">
              {count}
            </Badge>
          </div>
          <ScrollArea className="max-h-[200px]">
            <div className="space-y-1">
              {list.length > 0 ? (
                list.map((item: any, i: number) => (
                  <div
                    key={i}
                    className="text-xs py-1 px-2 rounded hover:bg-muted/50 text-foreground/80 border border-transparent hover:border-border"
                  >
                    {typeof item === "object"
                      ? item.name || item.title || JSON.stringify(item)
                      : String(item)}
                  </div>
                ))
              ) : (
                <div className="text-xs text-muted-foreground italic p-2">No items</div>
              )}
            </div>
          </ScrollArea>
        </div>
      </PopoverContent>
    </Popover>
  );
};

const SortableTableHead = ({
  col,
  idx,
  style,
  className,
  children,
  handleResize,
}: {
  col: string;
  idx: number;
  style: React.CSSProperties;
  className: string;
  children: (drag: {
    attributes: DraggableAttributes;
    listeners: DraggableSyntheticListeners;
  }) => React.ReactNode;
  handleResize: (col: string, e: React.MouseEvent) => void;
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: col });

  const combinedStyle = {
    ...style,
    transform: CSS.Translate.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.8 : undefined,
  };

  return (
    <TableHead
      ref={setNodeRef}
      style={combinedStyle}
      className={cn(className, isDragging && "bg-muted shadow-inner")}
    >
      {children({ attributes, listeners })}
      <div
        className="absolute right-[-4px] top-0 bottom-0 w-[8px] cursor-col-resize hover:bg-brand-blue/50 active:bg-brand-blue z-20"
        onMouseDown={(e) => handleResize(col, e)}
      />
    </TableHead>
  );
};

/* ---------------------------------------------------------------- */

type HistoryEntry = { rowId: number; col: string; prev: any; next: any };

const conversionColors: Record<string, { text: string; bg: string; border: string; dot: string }> = {
  "New": { text: "text-[#1a3a6f]", bg: "bg-[#1a3a6f]/10", border: "border-[#1a3a6f]/20", dot: "bg-[#1a3a6f]" },
  "Contacted": { text: "text-[#2d5aa8]", bg: "bg-[#2d5aa8]/10", border: "border-[#2d5aa8]/20", dot: "bg-[#2d5aa8]" },
  "Responded": { text: "text-[#1E90FF]", bg: "bg-[#1E90FF]/10", border: "border-[#1E90FF]/20", dot: "bg-[#1E90FF]" },
  "Multiple Responses": { text: "text-[#17A398]", bg: "bg-[#17A398]/10", border: "border-[#17A398]/20", dot: "bg-[#17A398]" },
  "Qualified": { text: "text-[#10b981]", bg: "bg-[#10b981]/10", border: "border-[#10b981]/20", dot: "bg-[#10b981]" },
  "Booked": { text: "text-brand-yellow", bg: "bg-brand-yellow/20", border: "border-brand-yellow/30", dot: "bg-brand-yellow" },
  "DND": { text: "text-[#ef4444]", bg: "bg-[#ef4444]/10", border: "border-[#ef4444]/20", dot: "bg-[#ef4444]" },
  "Lost": { text: "text-[#be185d] dark:text-[#f9a8d4]", bg: "bg-[#be185d]/10", border: "border-[#be185d]/20", dot: "bg-[#ec4899]" },
};

const automationStatusColors: Record<string, { text: string; bg: string; border: string; dot: string }> = {
  completed: { text: "text-[#059669] dark:text-[#34d399]", bg: "bg-[#059669]/10", border: "border-[#059669]/20", dot: "bg-[#10b981]" },
  queued: { text: "text-[#2563eb] dark:text-[#60a5fa]", bg: "bg-[#2563eb]/10", border: "border-[#2563eb]/20", dot: "bg-[#3b82f6]" },
  active: { text: "text-[#4f46e5] dark:text-[#818cf8]", bg: "bg-[#4f46e5]/10", border: "border-[#4f46e5]/20", dot: "bg-[#6366f1]" },
  paused: { text: "text-[#d97706] dark:text-[#fbbf24]", bg: "bg-[#d97706]/10", border: "border-[#d97706]/20", dot: "bg-[#f59e0b]" },
  dnd: { text: "text-[#e11d48] dark:text-[#fb7185]", bg: "bg-[#e11d48]/10", border: "border-[#e11d48]/20", dot: "bg-[#f43f5e]" },
  error: { text: "text-[#dc2626] dark:text-[#f87171]", bg: "bg-[#dc2626]/10", border: "border-[#dc2626]/20", dot: "bg-[#ef4444]" },
};

function TwilioFieldRow({ label, value }: { label: string; value: string | null | undefined }) {
  const [revealed, setRevealed] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const displayValue = revealed ? (value || "—") : (value ? maskTwilioValue(String(value)) : "Not configured");
  const handleCopy = () => {
    if (!value) return;
    navigator.clipboard.writeText(String(value)).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 text-[10px] font-black uppercase text-muted-foreground tracking-widest">
        <Zap className="h-3.5 w-3.5" />
        <span>{label}</span>
      </div>
      <div className={cn("flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-mono", value ? "bg-card dark:bg-secondary border-border text-foreground" : "bg-muted/50 border-border text-muted-foreground italic text-xs font-sans tracking-normal")}>
        <span className="flex-1 truncate">{displayValue}</span>
        {value && (
          <div className="flex items-center gap-1 shrink-0">
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-muted rounded" onClick={() => setRevealed((r) => !r)} title={revealed ? "Hide value" : "Show value"}>
              {revealed ? <EyeOff className="h-3.5 w-3.5 text-muted-foreground" /> : <Eye className="h-3.5 w-3.5 text-muted-foreground" />}
            </Button>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-muted rounded" onClick={handleCopy} title={copied ? "Copied!" : "Copy"}>
              <Copy className={cn("h-3.5 w-3.5", copied ? "text-emerald-500" : "text-muted-foreground")} />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function DataTable<TRow extends DataTableRow = DataTableRow>(
  props: DataTableProps<TRow>,
) {
  const {
    loading,
    rows,
    columns,
    visibleColumns,
    onVisibleColumnsChange,
    selectedIds,
    onSelectedIdsChange,
    sortConfig,
    onSortChange,
    groupBy,
    onGroupByChange,
    groupOptions,
    colWidths,
    onColWidthsChange,
    rowSpacing,
    onRowSpacingChange,
    showVerticalLines,
    onShowVerticalLinesChange,
    onUpdate,
    statusOptions,
    typeOptions,
    timezoneOptions,
    hiddenFields,
    nonEditableFields,
    onUndoRedoReady,
    filterConfig,
    onFilterConfigChange,
    searchValue,
    onSearchValueChange,
    onRefresh,
    isRefreshing,
    onAdd,
    addLabel = "Add",
    onDelete,
    onImportCSV,
    onExportCSV,
    emptyStateVariant = "generic",
    emptyStateTitle,
    emptyStateDescription,
    pageSize,
    pageSizeOptions,
    renderBulkActions,
    onRowClick,
  } = props;

  const exportable = props.exportable ?? false;
  const exportFilename = props.exportFilename ?? "export";

  const virtualized = props.virtualized ?? false;
  const virtualizedContainerHeight = props.virtualizedContainerHeight ?? "calc(100vh - 320px)";

  // Ref for the scroll container used by the row virtualizer
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const [currentPage, setCurrentPage] = useState(1);

  // Internal page size — can be changed by the user via the page-size selector.
  // Initial value: pageSizeOptions[0] ?? pageSize ?? 50
  const [internalPageSize, setInternalPageSize] = useState<number>(
    pageSizeOptions?.[0] ?? pageSize ?? 50
  );

  // Reset page when rows change (e.g. search/filter) or page size changes
  useEffect(() => { setCurrentPage(1); }, [rows.length, searchValue, internalPageSize]);

  const [groupColoring, setGroupColoring] = useState(true);
  const [groupSortOrder, setGroupSortOrder] = useState<"asc" | "desc">("asc");
  const [hideEmptyGroups, setHideEmptyGroups] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  // CSV Export state
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportSelectedFields, setExportSelectedFields] = useState<string[]>([]);

  // When dialog opens, default selection to currently visible columns
  const handleOpenExportDialog = () => {
    setExportSelectedFields([...visibleColumns]);
    setExportDialogOpen(true);
  };

  const toggleExportField = (col: string) => {
    setExportSelectedFields((prev) =>
      prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]
    );
  };

  const generateAndDownloadCSV = () => {
    const fields = exportSelectedFields.length > 0 ? exportSelectedFields : visibleColumns;
    // Header row with human-readable titles
    const header = fields.map((f) => {
      const title = formatHeaderTitle(f);
      return title.includes(",") || title.includes('"') ? `"${title.replace(/"/g, '""')}"` : title;
    }).join(",");
    // Data rows
    const lines = rows.map((row) =>
      fields.map((f) => {
        const val = (row as Record<string, any>)[f];
        const str = val === null || val === undefined ? "" : String(val);
        // RFC-4180 CSV escaping
        if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      }).join(",")
    );
    // Combine with UTF-8 BOM for Excel compatibility
    const csv = [header, ...lines].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${exportFilename}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setExportDialogOpen(false);
  };

  const toggleGroupCollapse = (groupName: string) => {
    setCollapsedGroups(prev => ({
      ...prev,
      [groupName]: !prev[groupName]
    }));
  };

  const [viewLabel, setViewLabel] = useState(() => {
    return localStorage.getItem("dataTable_viewLabel") || "Default View";
  });

  const [viewKey, setViewKey] = useState(() => {
    return localStorage.getItem("dataTable_viewKey") || "all";
  });

  useEffect(() => {
    localStorage.setItem("dataTable_viewLabel", viewLabel);
    localStorage.setItem("dataTable_viewKey", viewKey);
  }, [viewLabel, viewKey]);

  useEffect(() => {
    if (viewKey) {
      applyView(viewKey);
    }
  }, [rows, viewKey]);

  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filterValues = filterConfig ?? {};
  const filterCount = Object.values(filterValues).filter(Boolean).length;

  useEffect(() => {
    if (!onSearchValueChange) return;
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onSearchValueChange]);

  const undoStack = useRef<HistoryEntry[]>([]);
  const redoStack = useRef<HistoryEntry[]>([]);
  const [historyState, setHistoryState] = useState({
    canUndo: false,
    canRedo: false,
  });

  const updateHistoryState = () => {
    setHistoryState({
      canUndo: undoStack.current.length > 0,
      canRedo: redoStack.current.length > 0,
    });
  };

  const handleUpdate = (rowId: number, col: string, value: any) => {
    const row = rows.find((r) => r.Id === rowId);
    const prev = row ? row[col] : undefined;

    if (prev === value) return;

    const last = undoStack.current[undoStack.current.length - 1];
    if (last && last.rowId === rowId && last.col === col) {
      last.next = value;
    } else {
      undoStack.current.push({ rowId, col, prev, next: value });
    }

    redoStack.current = [];
    updateHistoryState();
    onUpdate(rowId, col, value);
  };

  const undo = () => {
    const last = undoStack.current.pop();
    if (!last) return;
    redoStack.current.push(last);
    updateHistoryState();
    onUpdate(last.rowId, last.col, last.prev);
  };

  const redo = () => {
    const last = redoStack.current.pop();
    if (!last) return;
    undoStack.current.push(last);
    updateHistoryState();
    onUpdate(last.rowId, last.col, last.next);
  };

  useEffect(() => {
    onUndoRedoReady?.({
      undo,
      redo,
      canUndo: historyState.canUndo,
      canRedo: historyState.canRedo,
    });
  }, [historyState]);

  const toggleSelect = (id: number) => {
    if (selectedIds.includes(id)) {
      onSelectedIdsChange(selectedIds.filter((x) => x !== id));
    } else {
      onSelectedIdsChange([...selectedIds, id]);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === rows.length) {
      onSelectedIdsChange([]);
    } else {
      onSelectedIdsChange(rows.map((r) => r.Id));
    }
  };

  const handleResize = (col: string, e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.pageX;
    const startW = colWidths[col] || 150;

    const onMove = (me: MouseEvent) => {
      const nextW = Math.max(50, startW + (me.pageX - startX));
      onColWidthsChange({ ...colWidths, [col]: nextW });
    };

    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIdx = visibleColumns.indexOf(active.id as string);
      const newIdx = visibleColumns.indexOf(over.id as string);
      onVisibleColumnsChange(arrayMove(visibleColumns, oldIdx, newIdx));
    }
  };

  const sortedRows = useMemo(() => {
    if (!sortConfig.key || !sortConfig.direction) return rows;
    const key = sortConfig.key;
    const dir = sortConfig.direction === "asc" ? 1 : -1;

    return [...rows].sort((a, b) => {
      const valA = a[key];
      const valB = b[key];
      if (valA < valB) return -1 * dir;
      if (valA > valB) return 1 * dir;
      return 0;
    });
  }, [rows, sortConfig]);

  // Estimated row height for the virtualizer based on rowSpacing
  const estimatedRowHeight = rowSpacing === "tight" ? 40 : rowSpacing === "medium" ? 56 : 88;

  // Row virtualizer — always called (hooks must not be conditional)
  // When `virtualized` is false, count=0 so it has no effect.
  const rowVirtualizer = useVirtualizer({
    count: virtualized ? displayRows.length : 0,
    getScrollElement: () => (virtualized ? scrollContainerRef.current : null),
    estimateSize: () => estimatedRowHeight,
    overscan: 10,
    measureElement: (el) => {
      // Use the element's actual height for dynamic measurement
      if (el && el instanceof HTMLElement) return el.getBoundingClientRect().height;
      return estimatedRowHeight;
    },
  });

  const virtualItems = rowVirtualizer.getVirtualItems();
  const totalVirtualSize = rowVirtualizer.getTotalSize();
  const virtualPaddingTop = virtualItems.length > 0 ? virtualItems[0].start : 0;
  const virtualPaddingBottom =
    virtualItems.length > 0 ? totalVirtualSize - virtualItems[virtualItems.length - 1].end : 0;

  // Pagination: slice sorted rows when a page size is active.
  // Works in both virtualized and non-virtualized modes.
  // `effectivePageSize` is set when pageSizeOptions is provided OR pageSize prop is given.
  const effectivePageSize: number | null =
    pageSizeOptions && pageSizeOptions.length > 0
      ? internalPageSize
      : pageSize ?? null;

  const totalRows = sortedRows.length;
  const totalPages = effectivePageSize
    ? Math.max(1, Math.ceil(totalRows / effectivePageSize))
    : 1;
  const safePage = Math.min(currentPage, totalPages);

  const displayRows = useMemo(() => {
    if (!effectivePageSize) return sortedRows;
    const start = (safePage - 1) * effectivePageSize;
    return sortedRows.slice(start, start + effectivePageSize);
  }, [sortedRows, effectivePageSize, safePage]);

  const groupedRows = useMemo(() => {
    if (groupBy === "None") return { "All Records": displayRows };
    const groups: Record<string, TRow[]> = {};
    
    // Determine order
    let order: string[] = [];
    const g = groupBy.toLowerCase();
    if (g === "conversion_status") order = statusOptions;
    else if (g === "automation_status") order = props.automationStatusOptions || [];
    else if (g === "type") order = typeOptions;
    
    if (order.length > 0) {
      order.forEach(opt => { groups[opt] = []; });
    }

    displayRows.forEach((r) => {
      // Try the exact groupBy key first (handles "Campaign", "Account" with capital letters),
      // then fall back to lowercase (handles "conversion_status", "automation_status").
      const rawVal = (r as any)[groupBy] !== undefined
        ? (r as any)[groupBy]
        : (r as any)[groupBy.toLowerCase()];
      const key = String(rawVal ?? "") || "Unknown";
      if (!groups[key]) groups[key] = [];
      groups[key].push(r);
    });
    
    // Remove empty groups that weren't in order list
    if (order.length > 0) {
      Object.keys(groups).forEach(k => {
        if (groups[k].length === 0 && !order.includes(k)) delete groups[k];
      });
    }

    return groups;
  }, [displayRows, groupBy, statusOptions, props.automationStatusOptions, typeOptions]);

  const visibleCols = visibleColumns.filter((c) => !hiddenFields.includes(c));
  const rowPadding = defaultRowPadding[rowSpacing];

  const applyView = (key: string) => {
    let next: string[] = [];
    if (key === "all") {
      next = columns;
    } else if (key === "rollups") {
      next = columns.filter((c) => matchesAny(c, ALWAYS_VISIBLE_MATCH) || isRollupCol(c));
    } else if (key === "twilio") {
      next = columns.filter((c) => matchesAny(c, ALWAYS_VISIBLE_MATCH) || includesAny(c, ["twilio", "twillio", "webhook"]));
    } else if (key === "basic") {
      next = columns.filter((c) => matchesAny(c, ALWAYS_VISIBLE_MATCH) || matchesAny(c, ["status", "type", "timezone"]));
    } else if (key === "automation") {
      next = columns.filter((c) => matchesAny(c, ALWAYS_VISIBLE_MATCH) || includesAny(c, AUTOMATION_MATCH));
    }
    if (next.length > 0) onVisibleColumnsChange(next);
  };

  const renderHeader = (col: string, drag: { attributes: any; listeners: any }) => {
    const isSorted = sortConfig.key === col && sortConfig.direction !== null;
    const title = formatHeaderTitle(col);

    return (
      <div className="flex items-center gap-2 group/h">
        <div
          {...drag.attributes}
          {...drag.listeners}
          className="cursor-grab active:cursor-grabbing hover:text-brand-blue transition-colors"
        >
          {getIconForField(col)}
        </div>
        <span
          className={cn(
            "flex-1 cursor-pointer select-none truncate transition-colors",
            isSorted ? "text-brand-blue font-semibold" : "hover:text-brand-blue/70",
          )}
          onClick={() => {
            const nextDir =
              sortConfig.key === col
                ? sortConfig.direction === "asc"
                  ? "desc"
                  : sortConfig.direction === "desc"
                    ? null
                    : "asc"
                : "asc";
            onSortChange({ key: col, direction: nextDir });
          }}
          title={isSorted ? `Sorted ${sortConfig.direction === "asc" ? "ascending" : "descending"} — click to ${sortConfig.direction === "asc" ? "reverse" : "clear"} sort` : `Click to sort by ${title}`}
          data-testid={`sort-header-${col}`}
          aria-sort={isSorted ? (sortConfig.direction === "asc" ? "ascending" : "descending") : "none"}
        >
          {title}
        </span>
        {isSorted ? (
          <span className="text-brand-blue font-bold shrink-0" data-testid={`sort-indicator-${col}`} aria-hidden="true">
            {sortConfig.direction === "asc" ? (
              <ChevronUp className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
          </span>
        ) : (
          <span className="opacity-0 group-hover/h:opacity-30 transition-opacity shrink-0 text-muted-foreground" aria-hidden="true">
            <ChevronUp className="h-3 w-3" />
          </span>
        )}
      </div>
    );
  };

  const viewMenuGroups = useMemo(() => {
    const presets = VIEW_PRESETS.map((p) => ({
      type: "preset" as const,
      value: p.label,
      label: p.label,
      presetKey: p.key,
    }));

    const groups: { label: string; options: ViewMenuOption[] }[] = [];
    if (presets.length > 0) {
      groups.push({
        label: "",
        options: presets,
      });
    }
    return groups;
  }, []);

  const handleViewMenuSelect = (option: ViewMenuOption) => {
    if (option.type === "preset") {
      setViewKey(option.presetKey);
      applyView(option.presetKey);
    }
    setViewLabel(option.label);
    localStorage.setItem("dataTable_viewLabel", option.label);
  };

  const effectiveGroupOptions =
    groupOptions ??
    [
      { value: "None", label: "No Grouping" },
      { value: "Type", label: "By Type" },
      { value: "Status", label: "By Status" },
      { value: "Timezone", label: "By Time Zone" },
    ];

  const handleFilterInputChange = (col: string, value: string) => {
    if (!onFilterConfigChange) return;
    const next = { ...filterValues };
    if (value) next[col] = value;
    else delete next[col];
    onFilterConfigChange(next);
  };

  const handleImportClick = () => {
    if (!onImportCSV) return;
    fileInputRef.current?.click();
  };

  const toolbarHasControls =
    onRefresh ||
    onSearchValueChange ||
    onFilterConfigChange ||
    viewMenuGroups.length > 0 ||
    effectiveGroupOptions.length > 0 ||
    onAdd ||
    onImportCSV ||
    onExportCSV ||
    exportable;

  const sortedGroupNames = useMemo(() => {
    let keys = Object.keys(groupedRows);
    if (hideEmptyGroups && groupBy !== "None") {
      keys = keys.filter(key => groupedRows[key].length > 0);
    }

    const conversionOrder = [
      "New",
      "Contacted",
      "Responded",
      "Multiple Responses",
      "Qualified",
      "Booked",
      "DND",
      "Lost"
    ];

    return keys.sort((a, b) => {
      const g = groupBy.toLowerCase();
      const dir = groupSortOrder === "asc" ? 1 : -1;

      if (g === "conversion_status" || g === "conversion") {
        const indexA = conversionOrder.indexOf(a);
        const indexB = conversionOrder.indexOf(b);
        
        if (indexA !== -1 && indexB !== -1) {
          return (indexA - indexB) * dir;
        }
      }

      return a.localeCompare(b) * dir;
    });
  }, [groupedRows, groupSortOrder, hideEmptyGroups, groupBy]);

  return (
    <div className="space-y-0">
      {toolbarHasControls && (
        <div className="flex flex-wrap items-center gap-3 mb-6">
          {onRefresh && (
            <Button
              variant="outline"
              className="h-10 w-10 p-0 rounded-xl bg-card dark:bg-secondary border-border shadow-none"
              onClick={onRefresh}
            >
              <RefreshCw
                className={cn("h-4 w-4", isRefreshing && "animate-spin")}
              />
            </Button>
          )}

          {onSearchValueChange && (
            <Input
              ref={searchInputRef}
              placeholder="Search records (Ctrl+K)"
              className="w-[240px] h-10 rounded-xl bg-card dark:bg-secondary shadow-none border-border"
              value={searchValue ?? ""}
              onChange={(e) => onSearchValueChange(e.target.value)}
            />
          )}

          {onFilterConfigChange && (
            <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="h-10 rounded-xl gap-2 font-semibold bg-card dark:bg-secondary border-border shadow-none relative"
                >
                  <Filter className="h-4 w-4" />
                  <span>Filter</span>
                  {filterCount > 0 && (
                    <Badge className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 bg-brand-blue">
                      {filterCount}
                    </Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold">Filters</h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onFilterConfigChange?.({})}
                      className="h-8 text-xs"
                    >
                      Clear all
                    </Button>
                  </div>
                  <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                    {columns.map((col) => (
                      <div key={col} className="space-y-1">
                        <label className="text-[10px] font-bold uppercase text-muted-foreground">
                          {col}
                        </label>
                        <Input
                          placeholder={`Filter ${col}...`}
                          className="h-8 text-sm"
                          value={filterValues[col] || ""}
                          onChange={(e) =>
                            handleFilterInputChange(col, e.target.value)
                          }
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          )}

          {onGroupByChange && effectiveGroupOptions.length > 0 && (
            <div className="flex items-center gap-1 bg-card dark:bg-secondary rounded-xl border border-border px-1">
              <Select value={groupBy} onValueChange={onGroupByChange}>
                <SelectTrigger className="h-10 w-[160px] border-none shadow-none font-semibold gap-2 focus:ring-0 [&>svg]:hidden">
                  <LayoutGrid className="h-4 w-4" />
                  <SelectValue placeholder="Group by..." />
                </SelectTrigger>
                <SelectContent>
                  {effectiveGroupOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {groupBy !== "None" && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 hover:bg-muted rounded-lg"
                    >
                      {groupSortOrder === "asc" ? (
                        <ChevronUp className="h-4 w-4 text-brand-blue" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-brand-blue" />
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuLabel>Group Options</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuRadioGroup 
                      value={groupSortOrder} 
                      onValueChange={(v) => setGroupSortOrder(v as "asc" | "desc")}
                    >
                      <DropdownMenuRadioItem value="asc">Sort Ascending</DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="desc">Sort Descending</DropdownMenuRadioItem>
                    </DropdownMenuRadioGroup>
                    <DropdownMenuSeparator />
                    <DropdownMenuCheckboxItem
                      checked={hideEmptyGroups}
                      onCheckedChange={setHideEmptyGroups}
                    >
                      Hide empty groups
                    </DropdownMenuCheckboxItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          )}

          {selectedIds.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap" data-testid="bulk-selection-bar">
              {renderBulkActions ? (
                renderBulkActions(selectedIds, () => onSelectedIdsChange([]))
              ) : (
                <>
                  <Badge className="h-7 px-3 bg-brand-blue hover:bg-brand-blue/90 text-brand-blue-foreground text-sm font-semibold rounded-full">
                    {selectedIds.length} selected
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => onSelectedIdsChange([])}
                  >
                    Clear
                  </Button>
                </>
              )}
              {onDelete && (
                <Button
                  variant="destructive"
                  className="h-8 px-3 rounded-xl text-sm font-semibold gap-2 shadow-none"
                  onClick={() => {
                    onDelete(selectedIds);
                    onSelectedIdsChange([]);
                  }}
                >
                  Delete ({selectedIds.length})
                </Button>
              )}
            </div>
          )}

          <div className="flex-1" />

          {viewMenuGroups.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="w-[160px] h-10 rounded-xl bg-card dark:bg-secondary shadow-none border-border font-bold flex items-center gap-2 text-foreground">
                  {VIEW_PRESETS.find(p => p.key === viewKey)?.icon || <LayoutGrid className="h-4 w-4" />}
                  <span className="truncate">{viewLabel}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-48">
                {viewMenuGroups.map((group, idx) => (
                  <div key={idx}>
                    {group.label && <DropdownMenuLabel>{group.label}</DropdownMenuLabel>}
                    {group.options.map((option) => {
                      const preset = option.type === 'preset' ? VIEW_PRESETS.find(p => p.key === option.presetKey) : null;
                      return (
                        <DropdownMenuItem
                          key={`${group.label}-${option.value}`}
                          onClick={() => handleViewMenuSelect(option)}
                          className="flex items-center gap-2"
                        >
                          {preset?.icon}
                          {option.label}
                        </DropdownMenuItem>
                      );
                    })}
                    {idx < viewMenuGroups.length - 1 && (
                      <DropdownMenuSeparator />
                    )}
                  </div>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Export CSV button — shown when exportable=true */}
          {exportable && (
            <Button
              variant="outline"
              data-testid="export-csv-trigger"
              className="h-10 rounded-xl gap-2 font-semibold bg-card dark:bg-secondary border-border shadow-none text-foreground"
              onClick={handleOpenExportDialog}
            >
              <Download className="h-4 w-4 text-muted-foreground" />
              Export
            </Button>
          )}

          {(() => {
            // Columns that can be toggled (exclude internal hiddenFields)
            const toggleableCols = columns.filter((c) => !hiddenFields.includes(c));
            const hiddenCount = toggleableCols.filter((c) => !visibleColumns.includes(c)).length;
            return (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    data-testid="column-config-trigger"
                    className="h-10 rounded-xl gap-2 font-semibold bg-card dark:bg-secondary border-border shadow-none text-foreground"
                  >
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                    Fields
                    {hiddenCount > 0 && (
                      <span
                        data-testid="column-config-hidden-count"
                        className="ml-0.5 inline-flex items-center justify-center h-4 min-w-[1rem] px-1 rounded-full bg-brand-blue text-brand-blue-foreground text-[10px] font-bold"
                      >
                        {hiddenCount}
                      </span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-64 p-0 overflow-hidden"
                  data-testid="column-config-panel"
                  align="end"
                >
                  {/* Header */}
                  <div className="flex items-center justify-between px-3 py-2.5 border-b border-border bg-muted/40">
                    <span className="text-xs font-semibold text-foreground uppercase tracking-wide">
                      Column Visibility
                    </span>
                    <div className="flex gap-1">
                      <button
                        data-testid="column-config-show-all"
                        onClick={() => onVisibleColumnsChange(toggleableCols)}
                        className="text-[11px] text-brand-blue hover:text-brand-blue/80 font-medium px-1.5 py-0.5 rounded hover:bg-brand-blue/10 transition-colors"
                      >
                        All
                      </button>
                      <span className="text-border">·</span>
                      <button
                        data-testid="column-config-hide-all"
                        onClick={() => {
                          // Keep at least the first column visible
                          const first = toggleableCols[0];
                          onVisibleColumnsChange(first ? [first] : []);
                        }}
                        className="text-[11px] text-muted-foreground hover:text-foreground font-medium px-1.5 py-0.5 rounded hover:bg-muted transition-colors"
                      >
                        None
                      </button>
                    </div>
                  </div>
                  {/* Column list */}
                  <ScrollArea className="h-72">
                    <div className="p-1.5 space-y-0.5">
                      {toggleableCols.map((col) => {
                        const isVisible = visibleColumns.includes(col);
                        return (
                          <div
                            key={col}
                            data-testid={`column-toggle-${col}`}
                            className={cn(
                              "flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer transition-colors select-none",
                              isVisible
                                ? "hover:bg-muted/60"
                                : "hover:bg-muted/40 opacity-60 hover:opacity-80",
                            )}
                            onClick={() => {
                              if (isVisible) {
                                onVisibleColumnsChange(
                                  visibleColumns.filter((c) => c !== col),
                                );
                              } else {
                                onVisibleColumnsChange([...visibleColumns, col]);
                              }
                            }}
                          >
                            <Checkbox
                              checked={isVisible}
                              data-testid={`column-checkbox-${col}`}
                              className="pointer-events-none"
                            />
                            <span className={cn("text-sm flex-1 truncate", isVisible ? "font-medium text-foreground" : "text-muted-foreground")}>
                              {formatHeaderTitle(col)}
                            </span>
                            {isVisible ? (
                              <Eye className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
                            ) : (
                              <EyeOff className="h-3.5 w-3.5 text-muted-foreground/30 shrink-0" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                  {/* Footer: show hidden count */}
                  {hiddenCount > 0 && (
                    <div className="px-3 py-2 border-t border-border bg-muted/20 text-[11px] text-muted-foreground">
                      {hiddenCount} column{hiddenCount !== 1 ? "s" : ""} hidden
                    </div>
                  )}
                </PopoverContent>
              </Popover>
            );
          })()}

          {onAdd && (
            <Button
              className="h-10 px-4 rounded-xl bg-brand-blue text-brand-blue-foreground hover:bg-brand-blue/90 text-sm font-semibold gap-2 shadow-none border-none"
              onClick={onAdd}
            >
              <Plus className="h-4 w-4" /> {addLabel}
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="h-10 w-10 p-0 rounded-xl bg-card dark:bg-secondary border-border shadow-none"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Settings</DropdownMenuLabel>
              <DropdownMenuCheckboxItem
                checked={groupColoring}
                onCheckedChange={setGroupColoring}
              >
                Group Coloring
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Row Spacing</DropdownMenuLabel>
              {onImportCSV && (
                <DropdownMenuRadioGroup
                  value={rowSpacing}
                  onValueChange={(value) =>
                    onRowSpacingChange?.(value as RowSpacing)
                  }
                >
                  <DropdownMenuRadioItem value="tight" disabled={!onRowSpacingChange}>
                    Tight
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="medium" disabled={!onRowSpacingChange}>
                    Medium
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="spacious" disabled={!onRowSpacingChange}>
                    Spacious
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <input
            type="file"
            accept=".csv"
            className="hidden"
            ref={fileInputRef}
            onChange={(event) => {
              const file = event.target.files?.[0] || null;
              if (file && onImportCSV) onImportCSV(file);
              if (fileInputRef.current) fileInputRef.current.value = "";
            }}
          />
        </div>
      )}

      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div
          ref={scrollContainerRef}
          className="overflow-x-auto"
          style={virtualized ? { overflowY: "auto", height: virtualizedContainerHeight } : undefined}
          data-virtualized={virtualized}
        >
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <Table className="table-fixed w-full">
            <TableHeader
              className={cn(
                "bg-muted/50",
                virtualized && "sticky top-0 z-10 shadow-sm",
              )}
            >
              <TableRow className="hover:bg-transparent border-b border-border">
                <TableHead className="w-[40px] px-4">
                  <Checkbox
                    checked={
                      selectedIds.length === sortedRows.length &&
                      sortedRows.length > 0
                    }
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>

                <SortableContext
                  items={visibleCols}
                  strategy={horizontalListSortingStrategy}
                >
                  {visibleCols.map((col, idx) => (
                    <SortableTableHead
                      key={col}
                      col={col}
                      idx={idx}
                      style={{ width: colWidths[col] }}
                      className={cn(
                        "relative px-4 overflow-visible whitespace-nowrap",
                        showVerticalLines &&
                          idx < visibleCols.length - 1 &&
                          "border-r border-border/50",
                      )}
                      handleResize={handleResize}
                    >
                      {(drag) => renderHeader(col, drag)}
                    </SortableTableHead>
                  ))}
                </SortableContext>
              </TableRow>
            </TableHeader>

            <TableBody>
              {/* Skeleton loading rows */}
              {loading && rows.length === 0 && (
                <>
                  {Array.from({ length: 8 }).map((_, rowIdx) => {
                    const widths = ["w-3/4", "w-1/2", "w-2/3", "w-1/3", "w-4/5", "w-2/5", "w-3/5"];
                    return (
                      <TableRow
                        key={`skeleton-${rowIdx}`}
                        data-testid="skeleton-row"
                        className="hover:bg-transparent border-b border-border/40 animate-in fade-in-0 duration-300"
                        style={{ animationDelay: `${rowIdx * 30}ms`, animationFillMode: "both" }}
                      >
                        <TableCell className="w-[40px] px-4">
                          <Skeleton className="h-4 w-4 rounded" />
                        </TableCell>
                        {visibleCols.map((col, colIdx) => (
                          <TableCell key={col} style={{ width: colWidths[col] }} className="px-4">
                            <Skeleton className={cn("h-3.5 rounded", widths[(rowIdx + colIdx) % widths.length])} />
                          </TableCell>
                        ))}
                      </TableRow>
                    );
                  })}
                </>
              )}
              {/* Empty state when no rows and not loading */}
              {!loading && rows.length === 0 && (
                <TableRow className="hover:bg-transparent">
                  <TableCell
                    colSpan={visibleCols.length + 1}
                    className="p-0 border-b-0"
                  >
                    <DataEmptyState
                      variant={emptyStateVariant}
                      title={emptyStateTitle}
                      description={emptyStateDescription}
                      compact
                    />
                  </TableCell>
                </TableRow>
              )}

              {/* ── Virtualized rows (TanStack Virtual) ── */}
              {virtualized && !loading && rows.length > 0 && (
                <>
                  {/* Top spacer row — pushes virtual rows to their correct offset */}
                  {virtualPaddingTop > 0 && (
                    <tr aria-hidden="true">
                      <td colSpan={visibleCols.length + 1} style={{ height: virtualPaddingTop }} />
                    </tr>
                  )}
                  {virtualItems.map((virtualRow) => {
                    const row = displayRows[virtualRow.index] as any;
                    if (!row) return null;
                    return (
                      <TableRow
                        key={row.Id}
                        id={`row-${row.Id}`}
                        data-index={virtualRow.index}
                        ref={rowVirtualizer.measureElement}
                        className={cn(
                          "group hover:bg-muted/30 transition-colors border-b border-border/50 last:border-0",
                          selectedIds.includes(row.Id) && "bg-primary/5 hover:bg-primary/10",
                          onRowClick && "cursor-pointer",
                        )}
                        onClick={onRowClick ? (e) => {
                          const target = e.target as HTMLElement;
                          if (target.closest("[data-row-checkbox]")) return;
                          onRowClick(row);
                        } : undefined}
                      >
                        <TableCell className="px-4" data-row-checkbox>
                          <Checkbox
                            checked={selectedIds.includes(row.Id)}
                            onCheckedChange={() => toggleSelect(row.Id)}
                          />
                        </TableCell>
                        {visibleCols.map((col, idx) => (
                          <TableCell
                            key={col}
                            style={{ width: colWidths[col] }}
                            className={cn(
                              "px-4 font-medium text-foreground/80 transition-all overflow-visible",
                              rowPadding,
                              showVerticalLines && idx < visibleCols.length - 1 && "border-r border-border/30",
                            )}
                          >
                            {isRollupCol(col) ? (
                              <RollupCell value={row[col]} type={col === "Automation Logs" ? "automations" : col === "Prompt Libraries" ? "prompts" : col} />
                            ) : (col.toLowerCase().includes("use") || typeof row[col] === "boolean") && (row[col] === 0 || row[col] === 1 || row[col] === true || row[col] === false) ? (
                              <div className="flex justify-center w-full">
                                <Checkbox
                                  checked={Boolean(row[col])}
                                  onCheckedChange={(checked) => handleUpdate(row.Id, col, !!checked)}
                                />
                              </div>
                            ) : col === "Image" || col === "ACC" || col === "full_name" ? (
                              <Sheet>
                                <SheetTrigger asChild>
                                  {col === "full_name" ? (
                                    <div className="font-bold text-brand-blue cursor-pointer hover:text-brand-blue/80 transition-colors">
                                      {row[col]}
                                    </div>
                                  ) : (
                                    <div
                                      className={cn(
                                        "w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold cursor-pointer transition-transform hover:scale-110",
                                        getAccountColor(row.Id).bg,
                                        getAccountColor(row.Id).text,
                                      )}
                                    >
                                      {row.image ? (
                                        <img
                                          src={row.image}
                                          alt={row.full_name || row.name}
                                          className="w-full h-full rounded-full object-cover"
                                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                                        />
                                      ) : getInitials(row.full_name || row.name)}
                                    </div>
                                  )}
                                </SheetTrigger>
                                <SheetContent className="sm:max-w-lg w-[400px]">
                                  <SheetHeader className="border-b pb-6">
                                    <div className="flex items-center gap-4">
                                      <div className={cn("w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold", getAccountColor(row.Id).bg, getAccountColor(row.Id).text)}>
                                        {getInitials(row.name)}
                                      </div>
                                      <div>
                                        <SheetTitle className="text-xl">{row.name || "Record Details"}</SheetTitle>
                                        <SheetDescription>View and edit information</SheetDescription>
                                      </div>
                                    </div>
                                  </SheetHeader>
                                  <ScrollArea className="h-[calc(100vh-140px)] py-6 pr-4">
                                    <div className="space-y-6">
                                      {columns.filter((c) => !hiddenFields.includes(c)).map((c) => (
                                        <div key={c} className="space-y-1.5">
                                          <div className="flex items-center gap-2 text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                                            {getIconForField(c)}
                                            <span>{formatHeaderTitle(c)}</span>
                                          </div>
                                          {nonEditableFields.includes(c) ? (
                                            <div className="px-3 py-2 bg-muted/50 rounded-lg text-sm font-medium text-muted-foreground border border-border">
                                              {isDateCol(c) ? formatDateTime(row[c]) : isTimeCol(c) ? formatHHmm(row[c]) : row[c] || "-"}
                                            </div>
                                          ) : (
                                            <Input
                                              value={row[c] || ""}
                                              onChange={(e) => handleUpdate(row.Id, c, e.target.value)}
                                              className="bg-card dark:bg-secondary border-border focus:ring-brand-blue"
                                            />
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </ScrollArea>
                                </SheetContent>
                              </Sheet>
                            ) : col === "automation_status" && props.automationStatusOptions ? (
                              <Select value={row[col] || ""} onValueChange={(v) => handleUpdate(row.Id, col, v)}>
                                <SelectTrigger className={cn("h-7 px-2 rounded-lg border-none shadow-none font-bold text-[10px] uppercase tracking-wider w-full truncate", (automationStatusColors as any)[row[col]]?.bg || "bg-muted", (automationStatusColors as any)[row[col]]?.text || "text-muted-foreground")}>
                                  <div className="flex items-center gap-1.5 overflow-hidden">
                                    <div className={cn("h-1.5 w-1.5 rounded-full shrink-0", (automationStatusColors as any)[row[col]]?.dot || "bg-muted-foreground")} />
                                    <SelectValue />
                                  </div>
                                </SelectTrigger>
                                <SelectContent>
                                  {props.automationStatusOptions.map((o) => (
                                    <SelectItem key={o} value={o} className="text-[10px] font-bold uppercase tracking-wider">
                                      <div className="flex items-center gap-2">
                                        <div className={cn("h-1.5 w-1.5 rounded-full", (automationStatusColors as any)[o]?.dot || "bg-muted-foreground")} />
                                        {o}
                                      </div>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : col === "conversion_status" ? (
                              <Select value={row[col] || ""} onValueChange={(v) => handleUpdate(row.Id, col, v)}>
                                <SelectTrigger className={cn("h-7 px-2 rounded-lg border-none shadow-none font-bold text-[10px] uppercase tracking-wider w-full truncate", (conversionColors as any)[row[col]]?.bg || "bg-muted", (conversionColors as any)[row[col]]?.text || "text-muted-foreground")}>
                                  <div className="flex items-center gap-1.5 overflow-hidden"><SelectValue /></div>
                                </SelectTrigger>
                                <SelectContent>
                                  {statusOptions.map((o) => (
                                    <SelectItem key={o} value={o} className="text-[10px] font-bold uppercase tracking-wider">
                                      <div className="flex items-center gap-2">
                                        <div className={cn("h-1.5 w-1.5 rounded-full", (conversionColors as any)[o]?.dot || "bg-muted-foreground")} />
                                        {o}
                                      </div>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : col === "status" ? (
                              <Select value={row[col] || ""} onValueChange={(v) => handleUpdate(row.Id, col, v)}>
                                <SelectTrigger className={cn("h-7 px-2 rounded-lg border-none shadow-none font-bold text-[10px] uppercase tracking-wider w-full truncate", (statusColors as any)[row[col]]?.bg, (statusColors as any)[row[col]]?.text)}>
                                  <div className="flex items-center gap-1.5 overflow-hidden">
                                    <div className={cn("h-1.5 w-1.5 rounded-full shrink-0", (statusColors as any)[row[col]]?.dot)} />
                                    <SelectValue />
                                  </div>
                                </SelectTrigger>
                                <SelectContent>
                                  {statusOptions.map((o) => (<SelectItem key={o} value={o}>{o}</SelectItem>))}
                                </SelectContent>
                              </Select>
                            ) : col === "type" ? (
                              <Select value={row[col] || ""} onValueChange={(v) => handleUpdate(row.Id, col, v)}>
                                <SelectTrigger className={cn("h-7 px-2 rounded-lg border-none shadow-none font-bold text-[10px] uppercase tracking-wider w-full truncate", row[col]?.toLowerCase() === "agency" ? "bg-brand-yellow/20 text-brand-yellow" : "bg-brand-blue/20 text-brand-blue")}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {typeOptions.map((o) => (<SelectItem key={o} value={o} className="text-[10px] font-bold uppercase tracking-wider">{o}</SelectItem>))}
                                </SelectContent>
                              </Select>
                            ) : col === "timezone" ? (
                              <Select value={row[col] || ""} onValueChange={(v) => handleUpdate(row.Id, col, v)}>
                                <SelectTrigger className={cn("h-7 px-2 rounded-lg border border-transparent shadow-none font-bold text-[10px] uppercase tracking-wider w-full truncate bg-muted/50 text-muted-foreground", (timezoneColors as any)[row[col]]?.bg, (timezoneColors as any)[row[col]]?.text, (timezoneColors as any)[row[col]]?.border)}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {timezoneOptions.map((o) => (<SelectItem key={o} value={o}>{o}</SelectItem>))}
                                </SelectContent>
                              </Select>
                            ) : isDateCol(col) ? (
                              <DateTimeCell value={row[col]} />
                            ) : isTimeCol(col) ? (
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-bold bg-muted/30 px-2 py-1 rounded">
                                <Clock className="h-3 w-3" />
                                {formatHHmm(row[col])}
                              </div>
                            ) : (
                              <TruncatedCell value={row[col]} onUpdate={handleUpdate} rowId={row.Id} col={col} />
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    );
                  })}
                  {/* Bottom spacer row — fills remaining virtual space */}
                  {virtualPaddingBottom > 0 && (
                    <tr aria-hidden="true">
                      <td colSpan={visibleCols.length + 1} style={{ height: virtualPaddingBottom }} />
                    </tr>
                  )}
                </>
              )}

              {/* ── Grouped / paginated rows (non-virtualized mode) ── */}
              {!virtualized && sortedGroupNames.map((groupName) => {
                const groupRows = groupedRows[groupName];
                return (
                  <React.Fragment key={groupName}>
                    {groupBy !== "None" && (
                      <TableRow
                        className="bg-muted/20 hover:bg-muted/30 border-y border-border/60 cursor-pointer"
                        tabIndex={0}
                        role="button"
                        aria-label={`Toggle group ${groupName}`}
                        aria-expanded={!collapsedGroups[groupName]}
                        data-testid={`group-header-${groupName}`}
                        onClick={() => toggleGroupCollapse(groupName)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleGroupCollapse(groupName); } }}
                      >
                        <TableCell
                          colSpan={visibleCols.length + 1}
                          className="py-2 px-4"
                        >
                          <div className="flex items-center gap-2">
                            {(() => {
                              const g = groupBy.toLowerCase();
                              let color: any = null;
                              if (groupColoring) {
                                if (g === "conversion_status" || g === "conversion") color = (conversionColors as any)[groupName];
                                else if (g === "automation_status") color = (automationStatusColors as any)[groupName];
                                else if (g === "type") {
                                  if (groupName.toLowerCase() === "agency") color = { bg: "bg-brand-yellow/20", text: "text-brand-yellow" };
                                  else color = { bg: "bg-brand-blue/20", text: "text-brand-blue" };
                                }
                              }

                              return (
                                <Badge
                                  variant="secondary"
                                  data-testid={`group-label-${groupName}`}
                                  className={cn(
                                    "text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md",
                                    color ? cn(color.bg, color.text) : "bg-muted text-muted-foreground"
                                  )}
                                >
                                  {groupName}
                                </Badge>
                              );
                            })()}
                            <Badge
                              variant="secondary"
                              data-testid={`group-count-${groupName}`}
                              className="bg-muted/50 text-muted-foreground h-6 px-2.5 text-xs font-bold border-none shadow-none"
                            >
                              {groupRows.length}
                            </Badge>
                            <div className="flex-1" />
                            {collapsedGroups[groupName] ? (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronUp className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                    {!collapsedGroups[groupName] && groupRows.map((row: any) => (
                      <TableRow
                        key={row.Id}
                        id={`row-${row.Id}`}
                        className={cn(
                          "group hover:bg-muted/30 transition-colors border-b border-border/50 last:border-0",
                          selectedIds.includes(row.Id) &&
                            "bg-primary/5 hover:bg-primary/10",
                          onRowClick && "cursor-pointer",
                        )}
                        onClick={onRowClick ? (e) => {
                          // Don't fire if clicking the checkbox column
                          const target = e.target as HTMLElement;
                          if (target.closest('[data-row-checkbox]')) return;
                          onRowClick(row);
                        } : undefined}
                      >
                        <TableCell className="px-4" data-row-checkbox>
                          <Checkbox
                            checked={selectedIds.includes(row.Id)}
                            onCheckedChange={() => toggleSelect(row.Id)}
                          />
                        </TableCell>

                        {visibleCols.map((col, idx) => (
                          <TableCell
                            key={col}
                            style={{ width: colWidths[col] }}
                            className={cn(
                              "px-4 font-medium text-foreground/80 transition-all overflow-visible",
                              rowPadding,
                              showVerticalLines &&
                                idx < visibleCols.length - 1 &&
                                "border-r border-border/30",
                            )}
                          >
                            {isRollupCol(col) ? (
                              <RollupCell value={row[col]} type={col === "Automation Logs" ? "automations" : col === "Prompt Libraries" ? "prompts" : col} />
                            ) : (col.toLowerCase().includes("use") || typeof row[col] === "boolean") && (row[col] === 0 || row[col] === 1 || row[col] === true || row[col] === false) ? (
                              <div className="flex justify-center w-full">
                                <Checkbox
                                  checked={Boolean(row[col])}
                                  onCheckedChange={(checked) => handleUpdate(row.Id, col, !!checked)}
                                />
                              </div>
                            ) : col === "Image" || col === "ACC" || col === "full_name" ? (
                              <Sheet>
                                <SheetTrigger asChild>
                                  {col === "full_name" ? (
                                    <div className="font-bold text-brand-blue cursor-pointer hover:text-brand-blue/80 transition-colors">
                                      {row[col]}
                                    </div>
                                  ) : (
                                    <div
                                      className={cn(
                                        "w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold cursor-pointer transition-transform hover:scale-110",
                                        getAccountColor(row.Id).bg,
                                        getAccountColor(row.Id).text,
                                      )}
                                    >
                                      {row.image ? (
                                        <img 
                                          src={row.image} 
                                          alt={row.full_name || row.name} 
                                          className="w-full h-full rounded-full object-cover"
                                          onError={(e) => {
                                            (e.target as HTMLImageElement).style.display = 'none';
                                          }}
                                        />
                                      ) : getInitials(row.full_name || row.name)}
                                    </div>
                                  )}
                                </SheetTrigger>
                                <SheetContent className="sm:max-w-lg w-[400px]">
                                  <SheetHeader className="border-b pb-6">
                                    <div className="flex items-center gap-4">
                                      <div
                                        className={cn(
                                          "w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold",
                                          getAccountColor(row.Id).bg,
                                          getAccountColor(row.Id).text,
                                        )}
                                      >
                                        {getInitials(row.name)}
                                      </div>
                                      <div>
                                        <SheetTitle className="text-xl">
                                          {row.name || "Record Details"}
                                        </SheetTitle>
                                        <SheetDescription>
                                          View and edit information
                                        </SheetDescription>
                                      </div>
                                    </div>
                                  </SheetHeader>
                                  <ScrollArea className="h-[calc(100vh-140px)] py-6 pr-4">
                                    <div className="space-y-6">
                                      {(() => {
                                        const visibleCols = columns.filter((c) => !hiddenFields.includes(c));
                                        const twilioFields = ["twilio_account_sid", "twilio_auth_token", "twilio_messaging_service_sid", "twilio_default_from_number"];
                                        const hasTwilio = visibleCols.some((c) => twilioFields.includes(c));
                                        let twilioSectionAdded = false;
                                        return visibleCols.map((c) => {
                                          const isTwilio = twilioFields.includes(c);
                                          const showTwilioHeader = isTwilio && !twilioSectionAdded;
                                          if (isTwilio) twilioSectionAdded = true;
                                          return (
                                            <React.Fragment key={c}>
                                              {showTwilioHeader && (
                                                <div className="flex items-center gap-2 pt-2">
                                                  <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-brand-blue">
                                                    <Zap className="h-3.5 w-3.5" />
                                                    <span>Twilio Configuration</span>
                                                  </div>
                                                  <div className="flex-1 h-px bg-brand-blue/20" />
                                                </div>
                                              )}
                                              {isTwilio ? (
                                                <TwilioFieldRow
                                                  label={formatHeaderTitle(c)}
                                                  value={row[c]}
                                                />
                                              ) : (
                                                <div className="space-y-1.5">
                                                  <div className="flex items-center gap-2 text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                                                    {getIconForField(c)}
                                                    <span>{formatHeaderTitle(c)}</span>
                                                  </div>
                                                  {nonEditableFields.includes(c) ? (
                                                    <div className="px-3 py-2 bg-muted/50 rounded-lg text-sm font-medium text-muted-foreground border border-border">
                                                      {isDateCol(c)
                                                        ? formatDateTime(row[c])
                                                        : isTimeCol(c)
                                                          ? formatHHmm(row[c])
                                                          : row[c] || "-"}
                                                    </div>
                                                  ) : c === "status" ? (
                                                    <Select
                                                      value={row[c] || ""}
                                                      onValueChange={(v) =>
                                                        handleUpdate(row.Id, c, v)
                                                      }
                                                    >
                                                      <SelectTrigger className="w-full bg-card dark:bg-secondary border-border">
                                                        <SelectValue />
                                                      </SelectTrigger>
                                                      <SelectContent>
                                                        {statusOptions.map((o) => (
                                                          <SelectItem key={o} value={o}>
                                                            {o}
                                                          </SelectItem>
                                                        ))}
                                                      </SelectContent>
                                                    </Select>
                                                  ) : c === "type" ? (
                                                    <Select
                                                      value={row[c] || ""}
                                                      onValueChange={(v) =>
                                                        handleUpdate(row.Id, c, v)
                                                      }
                                                    >
                                                      <SelectTrigger className="w-full bg-card dark:bg-secondary border-border">
                                                        <SelectValue />
                                                      </SelectTrigger>
                                                      <SelectContent>
                                                        {typeOptions.map((o) => (
                                                          <SelectItem key={o} value={o}>
                                                            {o}
                                                          </SelectItem>
                                                        ))}
                                                      </SelectContent>
                                                    </Select>
                                                  ) : c === "timezone" ? (
                                                    <Select
                                                      value={row[c] || ""}
                                                      onValueChange={(v) =>
                                                        handleUpdate(row.Id, c, v)
                                                      }
                                                    >
                                                      <SelectTrigger className="w-full bg-card dark:bg-secondary border-border">
                                                        <SelectValue />
                                                      </SelectTrigger>
                                                      <SelectContent>
                                                        {timezoneOptions.map((o) => (
                                                          <SelectItem key={o} value={o}>
                                                            {o}
                                                          </SelectItem>
                                                        ))}
                                                      </SelectContent>
                                                    </Select>
                                                  ) : (
                                                    <Input
                                                      value={row[c] || ""}
                                                      onChange={(e) =>
                                                        handleUpdate(
                                                          row.Id,
                                                          c,
                                                          e.target.value,
                                                        )
                                                      }
                                                      className="bg-card dark:bg-secondary border-border focus:ring-brand-blue"
                                                    />
                                                  )}
                                                </div>
                                              )}
                                            </React.Fragment>
                                          );
                                        });
                                      })()}
                                    </div>
                                  </ScrollArea>
                                </SheetContent>
                              </Sheet>
                            ) : col === "automation_status" && props.automationStatusOptions ? (
                              <Select
                                value={row[col] || ""}
                                onValueChange={(v) => handleUpdate(row.Id, col, v)}
                              >
                                <SelectTrigger
                                  className={cn(
                                    "h-7 px-2 rounded-lg border-none shadow-none font-bold text-[10px] uppercase tracking-wider w-full truncate",
                                    (automationStatusColors as any)[row[col]]?.bg || "bg-muted",
                                    (automationStatusColors as any)[row[col]]?.text || "text-muted-foreground",
                                  )}
                                >
                                  <div className="flex items-center gap-1.5 overflow-hidden">
                                    <div
                                      className={cn(
                                        "h-1.5 w-1.5 rounded-full shrink-0",
                                        (automationStatusColors as any)[row[col]]?.dot || "bg-muted-foreground",
                                      )}
                                    />
                                    <SelectValue />
                                  </div>
                                </SelectTrigger>
                                <SelectContent>
                                  {props.automationStatusOptions.map((o) => (
                                    <SelectItem key={o} value={o} className="text-[10px] font-bold uppercase tracking-wider">
                                      <div className="flex items-center gap-2">
                                        <div className={cn("h-1.5 w-1.5 rounded-full", (automationStatusColors as any)[o]?.dot || "bg-muted-foreground")} />
                                        {o}
                                      </div>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : col === "conversion_status" ? (
                              <Select
                                value={row[col] || ""}
                                onValueChange={(v) => handleUpdate(row.Id, col, v)}
                              >
                                <SelectTrigger
                                  className={cn(
                                    "h-7 px-2 rounded-lg border-none shadow-none font-bold text-[10px] uppercase tracking-wider w-full truncate",
                                    (conversionColors as any)[row[col]]?.bg || "bg-muted",
                                    (conversionColors as any)[row[col]]?.text || "text-muted-foreground",
                                  )}
                                >
                                  <div className="flex items-center gap-1.5 overflow-hidden">
                                    <SelectValue />
                                  </div>
                                </SelectTrigger>
                                <SelectContent>
                                  {statusOptions.map((o) => (
                                    <SelectItem key={o} value={o} className="text-[10px] font-bold uppercase tracking-wider">
                                      <div className="flex items-center gap-2">
                                        <div className={cn("h-1.5 w-1.5 rounded-full", (conversionColors as any)[o]?.dot || "bg-muted-foreground")} />
                                        {o}
                                      </div>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : col === "status" ? (
                              <Select
                                value={row[col] || ""}
                                onValueChange={(v) =>
                                  handleUpdate(row.Id, col, v)
                                }
                              >
                                <SelectTrigger
                                  className={cn(
                                    "h-7 px-2 rounded-lg border-none shadow-none font-bold text-[10px] uppercase tracking-wider w-full truncate",
                                    (statusColors as any)[row[col]]?.bg,
                                    (statusColors as any)[row[col]]?.text,
                                  )}
                                >
                                  <div className="flex items-center gap-1.5 overflow-hidden">
                                    <div
                                      className={cn(
                                        "h-1.5 w-1.5 rounded-full shrink-0",
                                        (statusColors as any)[row[col]]?.dot,
                                      )}
                                    />
                                    <SelectValue />
                                  </div>
                                </SelectTrigger>
                                <SelectContent>
                                  {statusOptions.map((o) => (
                                    <SelectItem key={o} value={o}>
                                      {o}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : col === "type" ? (
                              <Select
                                value={row[col] || ""}
                                onValueChange={(v) =>
                                  handleUpdate(row.Id, col, v)
                                }
                              >
                                <SelectTrigger
                                  className={cn(
                                    "h-7 px-2 rounded-lg border-none shadow-none font-bold text-[10px] uppercase tracking-wider w-full truncate",
                                    row[col]?.toLowerCase() === "agency"
                                      ? "bg-brand-yellow/20 text-brand-yellow"
                                      : "bg-brand-blue/20 text-brand-blue",
                                  )}
                                >
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {typeOptions.map((o) => (
                                    <SelectItem
                                      key={o}
                                      value={o}
                                      className="text-[10px] font-bold uppercase tracking-wider"
                                    >
                                      {o}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : col === "timezone" ? (
                              <Select
                                value={row[col] || ""}
                                onValueChange={(v) =>
                                  handleUpdate(row.Id, col, v)
                                }
                              >
                                <SelectTrigger
                                  className={cn(
                                    "h-7 px-2 rounded-lg border border-transparent shadow-none font-bold text-[10px] uppercase tracking-wider w-full truncate bg-muted/50 text-muted-foreground",
                                    (timezoneColors as any)[row[col]]?.bg,
                                    (timezoneColors as any)[row[col]]?.text,
                                    (timezoneColors as any)[row[col]]?.border,
                                  )}
                                >
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {timezoneOptions.map((o) => (
                                    <SelectItem key={o} value={o}>
                                      {o}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : isDateCol(col) ? (
                              <DateTimeCell value={row[col]} />
                            ) : isTimeCol(col) ? (
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-bold bg-muted/30 px-2 py-1 rounded">
                                <Clock className="h-3 w-3" />
                                {formatHHmm(row[col])}
                              </div>
                            ) : (
                              <TruncatedCell
                                value={row[col]}
                                onUpdate={handleUpdate}
                                rowId={row.Id}
                                col={col}
                              />
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </React.Fragment>
                );
              })}
            </TableBody>
          </Table>
        </DndContext>
        </div>
      </div>

      {/* ─── Unified Pagination Footer ─── */}
      {/* Show when pageSizeOptions is provided (always) or legacy pageSize prop without virtualization */}
      {!loading && rows.length > 0 && (pageSizeOptions?.length || (effectivePageSize && !virtualized && totalPages > 1)) && (
        <div
          className="flex items-center justify-between px-4 py-2 border-t border-border bg-muted/10 text-sm"
          data-testid="pagination-footer"
        >
          {/* Left: row count info */}
          <div className="text-muted-foreground" data-testid="pagination-row-info">
            {effectivePageSize
              ? <>
                  Showing{" "}
                  <span className="font-medium text-foreground">
                    {((safePage - 1) * effectivePageSize + 1).toLocaleString()}
                    –
                    {Math.min(safePage * effectivePageSize, totalRows).toLocaleString()}
                  </span>{" "}
                  of{" "}
                  <span className="font-medium text-foreground" data-testid="virtual-row-count">
                    {totalRows.toLocaleString()}
                  </span>{" "}
                  rows
                </>
              : <span data-testid="virtual-row-count">{totalRows.toLocaleString()} rows</span>
            }
          </div>

          {/* Right: page-size selector + navigation */}
          <div className="flex items-center gap-3">
            {/* Page size selector — only when pageSizeOptions is provided */}
            {pageSizeOptions && pageSizeOptions.length > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground text-xs">Rows per page:</span>
                <Select
                  value={String(internalPageSize)}
                  onValueChange={(val) => {
                    setInternalPageSize(Number(val));
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger
                    className="h-7 w-[72px] text-xs"
                    data-testid="page-size-selector"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {pageSizeOptions.map((opt) => (
                      <SelectItem
                        key={opt}
                        value={String(opt)}
                        data-testid={`page-size-option-${opt}`}
                      >
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Page navigation — only when there are multiple pages */}
            {totalPages > 1 && (
              <div className="flex items-center gap-1" data-testid="pagination-nav">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  disabled={safePage <= 1}
                  onClick={() => setCurrentPage(1)}
                  data-testid="pagination-first"
                >
                  First
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  disabled={safePage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  data-testid="pagination-prev"
                >
                  Prev
                </Button>
                <span className="px-2 font-medium text-xs" data-testid="pagination-page-info">
                  Page {safePage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  disabled={safePage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  data-testid="pagination-next"
                >
                  Next
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  disabled={safePage >= totalPages}
                  onClick={() => setCurrentPage(totalPages)}
                  data-testid="pagination-last"
                >
                  Last
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── CSV Export Field-Selection Dialog ─── */}
      <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
        <DialogContent className="max-w-md" data-testid="export-csv-dialog">
          <DialogHeader>
            <DialogTitle>Export CSV</DialogTitle>
            <DialogDescription>
              Choose which fields to include in the exported file.{" "}
              <span className="font-medium text-foreground">{rows.length} row{rows.length !== 1 ? "s" : ""}</span>{" "}
              will be exported.
            </DialogDescription>
          </DialogHeader>

          {/* Field selection */}
          <div className="space-y-2">
            {/* Select All / Deselect All */}
            <div className="flex items-center justify-between pb-1 border-b border-border">
              <span className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
                Fields ({exportSelectedFields.length}/{columns.length} selected)
              </span>
              <div className="flex gap-2">
                <button
                  data-testid="export-select-all"
                  className="text-[11px] text-brand-blue hover:text-brand-blue/80 font-medium px-1.5 py-0.5 rounded hover:bg-brand-blue/10 transition-colors"
                  onClick={() => setExportSelectedFields([...columns])}
                >
                  All
                </button>
                <span className="text-border">·</span>
                <button
                  data-testid="export-select-visible"
                  className="text-[11px] text-green-600 hover:text-green-700 font-medium px-1.5 py-0.5 rounded hover:bg-green-50 transition-colors"
                  onClick={() => setExportSelectedFields([...visibleColumns])}
                >
                  Visible
                </button>
                <span className="text-border">·</span>
                <button
                  data-testid="export-deselect-all"
                  className="text-[11px] text-muted-foreground hover:text-foreground font-medium px-1.5 py-0.5 rounded hover:bg-muted transition-colors"
                  onClick={() => setExportSelectedFields([])}
                >
                  None
                </button>
              </div>
            </div>

            <ScrollArea className="h-64">
              <div className="space-y-0.5 pr-2">
                {columns.map((col) => {
                  const isSelected = exportSelectedFields.includes(col);
                  return (
                    <div
                      key={col}
                      data-testid={`export-field-${col}`}
                      className={cn(
                        "flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer transition-colors select-none",
                        isSelected
                          ? "hover:bg-muted/60"
                          : "hover:bg-muted/40 opacity-60 hover:opacity-80"
                      )}
                      onClick={() => toggleExportField(col)}
                    >
                      <Checkbox
                        checked={isSelected}
                        className="pointer-events-none"
                        data-testid={`export-checkbox-${col}`}
                      />
                      <span className={cn("text-sm flex-1 truncate", isSelected ? "font-medium text-foreground" : "text-muted-foreground")}>
                        {formatHeaderTitle(col)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setExportDialogOpen(false)}
              data-testid="export-cancel"
            >
              Cancel
            </Button>
            <Button
              onClick={generateAndDownloadCSV}
              disabled={exportSelectedFields.length === 0}
              data-testid="export-confirm"
              className="bg-brand-blue text-brand-blue-foreground hover:bg-brand-blue/90 gap-2"
            >
              <Download className="h-4 w-4" />
              Download CSV
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
