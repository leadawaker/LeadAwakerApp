import { cn } from "@/lib/utils";
import { CSS } from "@dnd-kit/utilities";
import { useSortable } from "@dnd-kit/sortable";
import type { Task, TaskStatus } from "../types";
import { TASK_STATUSES } from "../types";

// ── Color helpers ───────────────────────────────────────────────────────────

export function opaqueTint(hex: string): string {
  let r = parseInt(hex.slice(1, 3), 16);
  let g = parseInt(hex.slice(3, 5), 16);
  let b = parseInt(hex.slice(5, 7), 16);
  const gray = 0.299 * r + 0.587 * g + 0.114 * b;
  r = Math.round(r + (gray - r) * 0.7);
  g = Math.round(g + (gray - g) * 0.7);
  b = Math.round(b + (gray - b) * 0.7);
  const blend = (c: number) => Math.round(c * 0.18 + 255 * 0.82);
  return `rgb(${blend(r)}, ${blend(g)}, ${blend(b)})`;
}

export const STATUS_HEX: Record<string, string> = {
  todo: "#6B7280",
  in_progress: "#3B82F6",
  done: "#10B981",
  cancelled: "#9CA3AF",
};

export const PRIORITY_HEX: Record<string, string> = {
  low: "#9CA3AF",
  medium: "#3B82F6",
  high: "#F59E0B",
  urgent: "#EF4444",
};

// ── Column definitions ──────────────────────────────────────────────────────

export type ColKey =
  | "title" | "status" | "priority" | "category"
  | "timeEstimate" | "dueDate" | "createdAt"
  | "description" | "assignee" | "account";

export interface ColumnDef {
  key: ColKey;
  label: string;
  width: number;
  editable: boolean;
  type: "text" | "select";
}

export const ALL_TABLE_COLUMNS: ColumnDef[] = [
  { key: "title",        label: "Title",        width: 240, editable: false, type: "text"   },
  { key: "status",       label: "Status",       width: 130, editable: true,  type: "select" },
  { key: "priority",     label: "Priority",     width: 110, editable: true,  type: "select" },
  { key: "category",     label: "Category",     width: 130, editable: false, type: "text"   },
  { key: "timeEstimate", label: "Estimate",     width: 90,  editable: false, type: "text"   },
  { key: "dueDate",      label: "Due",          width: 100, editable: false, type: "text"   },
  { key: "createdAt",    label: "Created",      width: 100, editable: false, type: "text"   },
  { key: "assignee",     label: "Assignee",     width: 130, editable: false, type: "text"   },
  { key: "description",  label: "Description",  width: 200, editable: false, type: "text"   },
  { key: "account",      label: "Account",      width: 130, editable: false, type: "text"   },
];

export const STATUS_DOT: Record<string, string> = {
  todo:        "bg-gray-500",
  in_progress: "bg-blue-500",
  done:        "bg-emerald-500",
  cancelled:   "bg-zinc-400",
};

export const PRIORITY_DOT: Record<string, string> = {
  low:    "bg-gray-400",
  medium: "bg-blue-500",
  high:   "bg-amber-500",
  urgent: "bg-red-500",
};

const SIGNAL_FILLED: Record<string, number> = { low: 1, medium: 2, high: 3, urgent: 4 };
const SIGNAL_COLOR: Record<string, string> = {
  low: "#3B82F6", medium: "#22C55E", high: "#F97316", urgent: "#EF4444",
};

export function SignalBars({ priority }: { priority: string }) {
  const filled = SIGNAL_FILLED[priority] ?? 2;
  const color = SIGNAL_COLOR[priority] ?? "#9CA3AF";
  return (
    <div className="flex items-end gap-[2px]">
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

// ── Helpers ─────────────────────────────────────────────────────────────────

export function isOverdue(task: Task): boolean {
  if (!task.dueDate) return false;
  if (task.status === "done" || task.status === "cancelled") return false;
  return new Date(task.dueDate) < new Date();
}

export function formatDueDate(date: Date | string | null | undefined): string {
  if (!date) return "";
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function formatTimeEstimate(minutes: number | null | undefined): string {
  if (minutes == null || minutes <= 0) return "";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

export function formatRelativeTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return "";
    const diffMs = Date.now() - date.getTime();
    const diffDays = Math.floor(diffMs / 86_400_000);
    if (diffDays === 0) {
      const h = Math.floor(diffMs / 3_600_000);
      return h === 0 ? "just now" : `${h}h ago`;
    }
    if (diffDays === 1) return "yesterday";
    if (diffDays < 7)  return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    return `${Math.floor(diffDays / 30)}mo ago`;
  } catch { return ""; }
}

export function getNextStatus(current: TaskStatus): TaskStatus {
  const idx = TASK_STATUSES.indexOf(current);
  return TASK_STATUSES[(idx + 1) % TASK_STATUSES.length];
}

// ── Skeleton ─────────────────────────────────────────────────────────────────

export function TableSkeleton() {
  return (
    <div className="p-3 space-y-1.5">
      <div className="h-8 bg-[#D1D1D1] rounded animate-pulse mb-2" />
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="h-[52px] bg-card/70 rounded-xl animate-pulse" style={{ animationDelay: `${i * 35}ms` }} />
      ))}
    </div>
  );
}

// ── EditableCell ─────────────────────────────────────────────────────────────

export interface EditableCellProps {
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
  renderLabel?: (v: string) => React.ReactNode;
}

export function EditableCell({
  value, type, selectOptions, isEditing, editValue, isSaving, hasError,
  onStartEdit, onEditChange, onSave, onCancel, renderLabel,
}: EditableCellProps) {
  if (isEditing && type === "select" && selectOptions) {
    return (
      <select
        autoFocus
        value={editValue}
        onChange={(e) => onSave(e.target.value)}
        onBlur={() => onSave(editValue)}
        onKeyDown={(e) => { if (e.key === "Escape") onCancel(); }}
        className="w-full h-[28px] text-[11px] bg-white rounded px-1.5 ring-1 ring-brand-indigo/40 outline-none cursor-pointer"
      >
        {selectOptions.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
    );
  }

  if (isEditing) {
    return (
      <div style={{ position: "relative" }}>
        <div className="h-[26px]" />
        <textarea
          autoFocus
          value={editValue}
          onChange={(e) => { onEditChange(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.max(32, e.target.scrollHeight) + "px"; }}
          onBlur={() => onSave(editValue)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); e.currentTarget.blur(); }
            if (e.key === "Escape") onCancel();
          }}
          ref={(ta) => { if (!ta) return; ta.style.height = "auto"; ta.style.height = Math.max(32, ta.scrollHeight) + "px"; ta.selectionStart = ta.selectionEnd = ta.value.length; }}
          className="absolute top-0 left-0 w-full min-h-[32px] max-h-[300px] text-[12px] leading-relaxed bg-white px-2.5 py-1.5 ring-2 ring-brand-indigo/50 shadow-[0_4px_24px_rgba(0,0,0,0.12)] outline-none resize-none rounded-none"
          style={{ zIndex: 9999, minWidth: 240, borderRadius: 0 }}
        />
      </div>
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
      title={hasError ? "Save failed" : value}
    >
      <span className="truncate flex-1">
        {value
          ? (renderLabel ? renderLabel(value) : value)
          : <span className="text-muted-foreground/35 italic not-italic">&mdash;</span>}
      </span>
      {isSaving && <div className="h-2.5 w-2.5 border border-brand-indigo/40 border-t-brand-indigo rounded-full animate-spin ml-1 shrink-0" />}
      {hasError && !isSaving && <span className="text-red-500 ml-1 shrink-0 text-[9px] font-bold">!</span>}
    </div>
  );
}

// ── SortableHeaderCell ────────────────────────────────────────────────────────

export function SortableHeaderCell({ col, isFirst, label, onResizeStart }: {
  col: ColumnDef;
  isFirst: boolean;
  label: string;
  onResizeStart: (colKey: string, e: React.MouseEvent) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: col.key });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: "relative",
  };
  return (
    <th
      ref={setNodeRef}
      style={style}
      className={cn(
        "px-2.5 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-foreground/50 whitespace-nowrap select-none bg-muted border-b border-border/20",
        isFirst && "sticky left-[36px] z-30",
      )}
    >
      <div className="flex items-center gap-1 cursor-grab" {...attributes} {...listeners}>
        {label}
      </div>
      <div
        className="absolute right-0 top-0 bottom-0 w-[6px] cursor-col-resize hover:bg-brand-indigo/30"
        onMouseDown={(e) => { e.stopPropagation(); onResizeStart(col.key, e); }}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      />
    </th>
  );
}

// ── FlatRow type ─────────────────────────────────────────────────────────────

export type FlatRow =
  | { type: "header"; label: string; count: number }
  | { type: "task"; task: Task };
