import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import {
  ChevronRight,
  Calendar,
  GripVertical,
  LocateFixed,
  Plus,
  Target,
  User,
  Code,
  Megaphone,
  Briefcase,
  Maximize2,
  Minimize2,
  X,
} from "lucide-react";
import type { Task, TaskCategory } from "@shared/schema";
import { useTaskCategories, useUpdateTask } from "../api/tasksApi";
import {
  STATUS_COLORS,
  PRIORITY_COLORS,
  PRIORITY_BADGE,
  TAG_COLORS,
  parseTags,
  type TaskStatus,
  type TaskPriority,
} from "../types";

// ── Types ──────────────────────────────────────────────────────────────
interface TreeNode {
  task: Task;
  children: TreeNode[];
}

interface TasksGanttViewProps {
  tasks: Task[];
  searchQuery?: string;
  onTaskClick?: (taskId: number) => void;
  /** Render gantt-specific controls in the page toolbar */
  toolbarPortal?: React.RefObject<HTMLDivElement | null>;
  /** Max tree depth to display (null = all) */
  maxDepth?: number | null;
  /** Grouping mode */
  groupBy?: GanttGroupBy;
  onGroupByChange?: (g: GanttGroupBy) => void;
}

type ZoomLevel = "day" | "week" | "month";
type GanttGroupBy = "hierarchy" | "status" | "priority";

// ── Constants ──────────────────────────────────────────────────────────
const MIN_LEFT_PANEL = 180;
const MAX_LEFT_PANEL = 500;
const ROW_HEIGHT = 36;
const BAR_HEIGHT = 22;
const BAR_Y_OFFSET = (ROW_HEIGHT - BAR_HEIGHT) / 2;

const MIN_PX_PER_DAY = 3;
const MAX_PX_PER_DAY = 1200; // allow deep hourly zoom

const ZOOM_PRESETS: Record<ZoomLevel, number> = {
  day: 960, // hourly granularity: ~40px per hour for clear daily view
  week: 120, // ~7 days visible: one full Mon-Sun week in viewport
  month: 15, // show week starts within each month
};

// ── Category icons (same as tree view) ────────────────────────────────
const CATEGORY_ICON: Record<number, React.FC<{ className?: string }>> = {
  4: User, 5: Code, 6: Megaphone, 7: Briefcase,
};

// ── Priority bars (horizontal, 4 sections, same as tree view) ─────────
function PriorityBars({ priority }: { priority: string }) {
  const filled = priority === "urgent" ? 4 : priority === "high" ? 3 : priority === "medium" ? 2 : 1;
  const color = priority === "urgent" ? "#DC2626" : priority === "high" ? "#D97706" : priority === "medium" ? "#2563EB" : "#94A3B8";
  return (
    <span className="inline-flex items-center gap-[1px] h-3 shrink-0" title={priority}>
      {[1, 2, 3, 4].map((i) => (
        <span key={i} className="rounded-[1px]" style={{ width: 6, height: 3, backgroundColor: i <= filled ? color : "#e2e2e2" }} />
      ))}
    </span>
  );
}

// ── Expand/collapse persistence ────────────────────────────────────────
const EXPANDED_KEY = "tasks-gantt-expanded";

function loadExpanded(): Set<number> {
  try {
    const raw = localStorage.getItem(EXPANDED_KEY);
    if (raw) return new Set(JSON.parse(raw) as number[]);
  } catch {}
  return new Set();
}

function saveExpanded(ids: Set<number>) {
  try {
    localStorage.setItem(EXPANDED_KEY, JSON.stringify(Array.from(ids)));
  } catch {}
}

// ── Build tree ─────────────────────────────────────────────────────────
function buildTree(tasks: Task[]): TreeNode[] {
  const activeTasks = tasks.filter((t) => t.status !== "cancelled");
  const map = new Map<number, TreeNode>();
  const roots: TreeNode[] = [];
  for (const task of activeTasks) map.set(task.id, { task, children: [] });
  for (const task of activeTasks) {
    const node = map.get(task.id)!;
    if (task.parentTaskId && map.has(task.parentTaskId))
      map.get(task.parentTaskId)!.children.push(node);
    else roots.push(node);
  }
  const priorityRank: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
  const statusRank: Record<string, number> = { in_progress: 0, todo: 1, done: 2 };
  const sortNodes = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => {
      const sa = statusRank[a.task.status ?? "todo"] ?? 1;
      const sb = statusRank[b.task.status ?? "todo"] ?? 1;
      if (sa !== sb) return sa - sb;
      const pa = priorityRank[a.task.priority ?? "low"] ?? 3;
      const pb = priorityRank[b.task.priority ?? "low"] ?? 3;
      if (pa !== pb) return pa - pb;
      return (a.task.title ?? "").localeCompare(b.task.title ?? "");
    });
    for (const n of nodes) sortNodes(n.children);
  };
  sortNodes(roots);
  return roots;
}

// ── Build grouped tree (status or priority) ─────────────────────────────
const STATUS_GROUP_ORDER: { key: string; label: string }[] = [
  { key: "in_progress", label: "In Progress" },
  { key: "todo", label: "To Do" },
  { key: "done", label: "Done" },
];
const PRIORITY_GROUP_ORDER: { key: string; label: string }[] = [
  { key: "urgent", label: "Urgent" },
  { key: "high", label: "High" },
  { key: "medium", label: "Medium" },
  { key: "low", label: "Low" },
];

function buildGroupedTree(tasks: Task[], groupBy: "status" | "priority"): TreeNode[] {
  const activeTasks = tasks.filter((t) => t.status !== "cancelled");
  const groups = groupBy === "status" ? STATUS_GROUP_ORDER : PRIORITY_GROUP_ORDER;
  const buckets = new Map<string, Task[]>();
  for (const g of groups) buckets.set(g.key, []);

  for (const task of activeTasks) {
    const key = groupBy === "status" ? (task.status ?? "todo") : (task.priority ?? "medium");
    const bucket = buckets.get(key);
    if (bucket) bucket.push(task);
    else buckets.get(groups[groups.length - 1].key)!.push(task);
  }

  const priorityRank: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
  const sortByPriThenTitle = (a: Task, b: Task) => {
    const pa = priorityRank[a.priority ?? "low"] ?? 3;
    const pb = priorityRank[b.priority ?? "low"] ?? 3;
    if (pa !== pb) return pa - pb;
    return (a.title ?? "").localeCompare(b.title ?? "");
  };

  const roots: TreeNode[] = [];
  for (const g of groups) {
    const items = buckets.get(g.key) ?? [];
    if (items.length === 0) continue;
    items.sort(sortByPriThenTitle);

    // Virtual group node (negative ID to avoid conflicts)
    const virtualTask = {
      id: -(groups.indexOf(g) + 1) * 10000,
      title: g.label,
      status: groupBy === "status" ? g.key : null,
      priority: groupBy === "priority" ? g.key : null,
      parentTaskId: null,
      categoryId: null,
    } as unknown as Task;

    roots.push({
      task: virtualTask,
      children: items.map((task) => ({ task, children: [] })),
    });
  }
  return roots;
}

// ── Flatten visible rows ───────────────────────────────────────────────
interface FlatRow {
  node: TreeNode;
  depth: number;
  hasChildren: boolean;
  parentIndex: number | null;
}

function flattenTree(
  nodes: TreeNode[],
  expanded: Set<number>,
  depth = 0,
  parentIndex: number | null = null,
  rows: FlatRow[] = []
): FlatRow[] {
  for (const node of nodes) {
    const hasChildren = node.children.length > 0;
    const myIndex = rows.length;
    rows.push({ node, depth, hasChildren, parentIndex });
    if (hasChildren && expanded.has(node.task.id)) {
      flattenTree(node.children, expanded, depth + 1, myIndex, rows);
    }
  }
  return rows;
}

// ── Date helpers ───────────────────────────────────────────────────────
const DAY_MS = 86_400_000;

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * DAY_MS);
}

function diffDays(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / DAY_MS;
}

function getEffectiveDates(task: Task): { start: Date | null; end: Date | null } {
  const end = task.dueDate ? startOfDay(new Date(task.dueDate)) : null;
  let start = task.startDate ? startOfDay(new Date(task.startDate)) : null;
  if (!start && end && task.timeEstimate) {
    start = addDays(end, -Math.ceil(task.timeEstimate / (60 * 8)));
  }
  return { start, end };
}

function getNodeSpan(node: TreeNode): { start: Date | null; end: Date | null } {
  const own = getEffectiveDates(node.task);
  let minStart = own.start;
  let maxEnd = own.end;
  for (const child of node.children) {
    const childSpan = getNodeSpan(child);
    if (childSpan.start) {
      if (!minStart || childSpan.start < minStart) minStart = childSpan.start;
    }
    if (childSpan.end) {
      if (!maxEnd || childSpan.end > maxEnd) maxEnd = childSpan.end;
    }
  }
  return { start: minStart, end: maxEnd };
}

// ── Compute timeline range ─────────────────────────────────────────────
function computeTimelineRange(rows: FlatRow[]): { rangeStart: Date; rangeEnd: Date } {
  const today = startOfDay(new Date());
  let min = addDays(today, -30);
  let max = addDays(today, 180);
  for (const row of rows) {
    const { start, end } = getNodeSpan(row.node);
    if (start && start < min) min = start;
    if (end && end > max) max = end;
  }
  min = addDays(min, -14);
  max = addDays(max, 30);
  return { rangeStart: min, rangeEnd: max };
}

// ── Tick generation ────────────────────────────────────────────────────
interface Tick {
  date: Date;
  x: number;
  label: string;
  isMajor?: boolean;
}

function generateTicks(
  rangeStart: Date,
  rangeEnd: Date,
  pxPerDay: number
): { ticks: Tick[]; monthBars: Array<{ x: number; w: number; label: string }> } {
  const ticks: Tick[] = [];
  const monthBars: Array<{ x: number; w: number; label: string }> = [];
  const totalDays = Math.ceil(diffDays(rangeStart, rangeEnd));

  // Month bars (top header row)
  let mStart = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1);
  while (mStart <= rangeEnd) {
    const mEnd = new Date(mStart.getFullYear(), mStart.getMonth() + 1, 1);
    const x = Math.max(0, diffDays(rangeStart, mStart) * pxPerDay);
    const xEnd = diffDays(rangeStart, mEnd) * pxPerDay;
    monthBars.push({
      x,
      w: xEnd - x,
      label: mStart.toLocaleString("default", { month: "long", year: "numeric" }),
    });
    mStart = mEnd;
  }

  // Sub-ticks depend on zoom level
  if (pxPerDay >= 100) {
    // Hourly view: show hours within each day
    // Calculate spacing: only show hours that have enough room
    const hourGap = pxPerDay / 24; // pixels per hour
    // Skip hours if they'd overlap (need ~30px per label)
    const hourStep = hourGap < 15 ? 4 : hourGap < 25 ? 2 : 1;
    for (let i = 0; i <= totalDays; i++) {
      const d = addDays(rangeStart, i);
      // Day tick (major)
      ticks.push({
        date: d,
        x: i * pxPerDay,
        label: `${d.toLocaleString("default", { weekday: "short" })} ${d.getDate()}`,
        isMajor: true,
      });
      // Hour ticks within the day
      for (let h = 6; h <= 22; h += hourStep) {
        const frac = h / 24;
        ticks.push({
          date: d,
          x: i * pxPerDay + frac * pxPerDay,
          label: `${h}:00`,
          isMajor: false,
        });
      }
    }
  } else if (pxPerDay >= 30) {
    // Show every day
    for (let i = 0; i <= totalDays; i++) {
      const d = addDays(rangeStart, i);
      const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      ticks.push({
        date: d,
        x: i * pxPerDay,
        label: `${dayNames[d.getDay()]} ${d.getDate()}`,
        isMajor: d.getDay() === 1,
      });
    }
  } else if (pxPerDay >= 10) {
    // Weekly
    let d = new Date(rangeStart);
    const dow = d.getDay();
    const toMon = dow === 0 ? 1 : dow === 1 ? 0 : 8 - dow;
    d = addDays(d, toMon);
    while (d <= rangeEnd) {
      const offset = diffDays(rangeStart, d);
      ticks.push({
        date: d,
        x: offset * pxPerDay,
        label: `${d.getDate()} ${d.toLocaleString("default", { month: "short" })}`,
        isMajor: true,
      });
      d = addDays(d, 7);
    }
  } else {
    // Monthly only
    let d = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1);
    while (d <= rangeEnd) {
      ticks.push({
        date: d,
        x: diffDays(rangeStart, d) * pxPerDay,
        label: d.toLocaleString("default", { month: "short" }),
        isMajor: true,
      });
      d = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    }
  }

  return { ticks, monthBars };
}

// ── Tooltip ────────────────────────────────────────────────────────────
function BarTooltip({
  task,
  start,
  end,
  x,
  y,
}: {
  task: Task;
  start: Date | null;
  end: Date | null;
  x: number;
  y: number;
}) {
  const { t } = useTranslation("tasks");
  const duration =
    start && end ? Math.max(1, Math.round(diffDays(start, end))) : null;
  const fmt = (d: Date | null) =>
    d
      ? d.toLocaleDateString("default", { day: "numeric", month: "short", year: "numeric" })
      : "-";
  const priority = (task.priority ?? "medium") as TaskPriority;
  const priorityLabel = priority.charAt(0).toUpperCase() + priority.slice(1);
  const priorityColors = PRIORITY_BADGE[priority];
  const tags = parseTags((task as any).tags);

  return (
    <div
      className="bg-popover border border-border rounded-lg shadow-xl px-3.5 py-3 pointer-events-none text-[12px] max-w-[360px]"
    >
      {/* Title */}
      <div className="font-semibold text-foreground text-[13px] leading-tight">
        {task.title}
      </div>

      {/* Description */}
      {task.description && (
        <p className="text-muted-foreground text-[11px] mt-1 leading-relaxed whitespace-pre-wrap">
          {task.description}
        </p>
      )}

      {/* Date info */}
      <div className="text-muted-foreground mt-2 space-y-0.5 text-[11px]">
        <div className="flex justify-between gap-4">
          <span>{t("gantt.startDate")}:</span>
          <span className="font-medium text-foreground">{fmt(start)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span>Due:</span>
          <span className="font-medium text-foreground">{fmt(end)}</span>
        </div>
        {duration && (
          <div className="flex justify-between gap-4">
            <span>{t("gantt.duration")}:</span>
            <span className="font-medium text-foreground">{duration}d</span>
          </div>
        )}
      </div>

      {/* Priority + Status + Progress */}
      <div className="flex items-center gap-2 mt-2">
        <span
          className="text-[10px] font-medium px-1.5 py-0.5 rounded"
          style={{ backgroundColor: priorityColors.bg, color: priorityColors.text }}
        >
          {priorityLabel}
        </span>
        <span className="text-[10px] text-muted-foreground capitalize">
          {task.status?.replace("_", " ")}
        </span>
        {task.status === "in_progress" && start && end && (
          <span className="text-[10px] text-brand-indigo font-medium">
            {Math.min(95, Math.max(0, Math.round((diffDays(start, startOfDay(new Date())) / Math.max(1, diffDays(start, end))) * 100)))}%
          </span>
        )}
      </div>

      {/* Tags */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {tags.slice(0, 4).map((tag) => {
            const tc = TAG_COLORS[tag];
            return (
              <span
                key={tag}
                className="text-[9px] px-1.5 py-0.5 rounded"
                style={
                  tc
                    ? { backgroundColor: tc.bg, color: tc.text }
                    : { backgroundColor: "rgba(0,0,0,0.05)", color: "#666" }
                }
              >
                {tag}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────
export default function TasksGanttView({
  tasks,
  searchQuery: _searchQuery,
  onTaskClick,
  toolbarPortal,
  maxDepth: maxDepthProp = null,
  groupBy: ganttGroupBy = "hierarchy",
  onGroupByChange,
}: TasksGanttViewProps) {
  const { t } = useTranslation("tasks");
  const { data: categories = [] } = useTaskCategories();
  const updateTask = useUpdateTask();

  // ── Zoom ─────────────────────────────────────────────────────────────
  const [pxPerDay, setPxPerDay] = useState<number>(() => {
    try {
      const v = localStorage.getItem("tasks-gantt-pxperday");
      if (v) {
        const n = Number(v);
        if (n >= MIN_PX_PER_DAY && n <= MAX_PX_PER_DAY) return n;
      }
    } catch {}
    return ZOOM_PRESETS.day;
  });

  const [activePreset, setActivePreset] = useState<ZoomLevel | null>(() => {
    const stored = localStorage.getItem("tasks-gantt-pxperday");
    if (!stored) return "day";
    const n = Number(stored);
    for (const [key, val] of Object.entries(ZOOM_PRESETS)) {
      if (Math.abs(n - val) < 1) return key as ZoomLevel;
    }
    return null;
  });

  useEffect(() => {
    localStorage.setItem("tasks-gantt-pxperday", String(pxPerDay));
  }, [pxPerDay]);

  const setZoomPreset = useCallback((z: ZoomLevel) => {
    setPxPerDay(ZOOM_PRESETS[z]);
    setActivePreset(z);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const panel = rightPanelRef.current;
        if (panel) {
          const rs = computeTimelineRange(flatRowsRef.current).rangeStart;
          const tod = startOfDay(new Date());
          if (z === "week") {
            // Snap to Monday of current week
            const dow = tod.getDay(); // 0=Sun
            const monday = addDays(tod, dow === 0 ? -6 : 1 - dow);
            const mondayX = diffDays(rs, monday) * ZOOM_PRESETS[z];
            panel.scrollLeft = Math.max(0, mondayX - panel.clientWidth * 0.15);
          } else {
            const todX = diffDays(rs, tod) * ZOOM_PRESETS[z];
            panel.scrollLeft = Math.max(0, todX - panel.clientWidth * 0.15);
          }
        }
      });
    });
  }, []);

  // Ctrl+scroll zoom toward cursor position (attached to outer container)
  const rightPanelRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pxPerDayRef = useRef(pxPerDay);
  pxPerDayRef.current = pxPerDay;

  // Ctrl+scroll zoom: anchor to selected task bar or today line
  const zoomAnchorDayRef = useRef<number | null>(null);
  const expandedTaskIdRef = useRef<number | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handler = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      const rect = container.getBoundingClientRect();
      if (
        e.clientX < rect.left || e.clientX > rect.right ||
        e.clientY < rect.top || e.clientY > rect.bottom
      ) return;

      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      // Determine anchor day: selected task's midpoint, or today
      let anchorDay: number;
      const todayDay = diffDays(
        computeTimelineRange(flatRowsRef.current).rangeStart,
        startOfDay(new Date())
      );

      if (expandedTaskIdRef.current) {
        const selRow = flatRowsRef.current.find((r) => r.node.task.id === expandedTaskIdRef.current);
        if (selRow) {
          const span = selRow.hasChildren ? getNodeSpan(selRow.node) : getEffectiveDates(selRow.node.task);
          const rs = computeTimelineRange(flatRowsRef.current).rangeStart;
          if (span.start && span.end) {
            const mid = new Date((span.start.getTime() + span.end.getTime()) / 2);
            anchorDay = diffDays(rs, mid);
          } else if (span.end) {
            anchorDay = diffDays(rs, span.end);
          } else {
            anchorDay = todayDay;
          }
        } else {
          anchorDay = todayDay;
        }
      } else {
        anchorDay = todayDay;
      }

      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      const newPxPerDay = Math.max(
        MIN_PX_PER_DAY,
        Math.min(MAX_PX_PER_DAY, pxPerDayRef.current * factor)
      );

      zoomAnchorDayRef.current = anchorDay;
      pxPerDayRef.current = newPxPerDay;

      setPxPerDay(newPxPerDay);
      setActivePreset(null);
    };

    document.addEventListener("wheel", handler, { passive: false, capture: true });
    return () => document.removeEventListener("wheel", handler, { capture: true } as any);
  }, []);

  // Apply scroll position after zoom re-render: keep anchor day at viewport center
  useEffect(() => {
    if (zoomAnchorDayRef.current !== null) {
      const panel = rightPanelRef.current;
      if (panel) {
        const anchorPx = zoomAnchorDayRef.current * pxPerDay;
        panel.scrollLeft = Math.max(0, anchorPx - panel.clientWidth / 2);
      }
      zoomAnchorDayRef.current = null;
    }
  }, [pxPerDay]);

  // ── Resizable left panel ─────────────────────────────────────────────
  const [leftWidth, setLeftWidth] = useState<number>(() => {
    try {
      const v = localStorage.getItem("tasks-gantt-left-width");
      if (v) return Math.max(MIN_LEFT_PANEL, Math.min(MAX_LEFT_PANEL, Number(v)));
    } catch {}
    return 280;
  });
  const leftWidthRef = useRef(leftWidth);
  leftWidthRef.current = leftWidth;

  useEffect(() => {
    try { localStorage.setItem("tasks-gantt-left-width", String(leftWidth)); } catch {}
  }, [leftWidth]);

  const startResize = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startW = leftWidth;
      const onMove = (ev: MouseEvent) => {
        setLeftWidth(Math.max(MIN_LEFT_PANEL, Math.min(MAX_LEFT_PANEL, startW + ev.clientX - startX)));
      };
      const onUp = () => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [leftWidth]
  );

  // ── Expand/collapse ──────────────────────────────────────────────────
  const [expanded, setExpanded] = useState<Set<number>>(() => {
    const persisted = loadExpanded();
    if (persisted.size > 0) return persisted;
    const childIds = new Set(tasks.filter((t) => t.parentTaskId).map((t) => t.parentTaskId!));
    const roots = new Set<number>();
    for (const t of tasks) {
      if (!t.parentTaskId && childIds.has(t.id)) roots.add(t.id);
    }
    return roots;
  });

  // Collect all descendant IDs for expand-all
  const getAllDescendantIds = useCallback((nodeId: number, taskMap: Map<number, TreeNode>): number[] => {
    const node = taskMap.get(nodeId);
    if (!node) return [];
    const ids: number[] = [];
    const collect = (n: TreeNode) => {
      for (const child of n.children) {
        if (child.children.length > 0) {
          ids.push(child.task.id);
          collect(child);
        }
      }
    };
    collect(node);
    return ids;
  }, []);

  const [hoveredRow, setHoveredRow] = useState<number | null>(null);
  const [expandedTaskId, setExpandedTaskId] = useState<number | null>(null);
  expandedTaskIdRef.current = expandedTaskId;

  const toggleTaskExpand = useCallback((taskId: number) => {
    setExpandedTaskId((prev) => (prev === taskId ? null : taskId));
  }, []);

  // ── Color-by mode ─────────────────────────────────────────────────────
  type ColorByMode = "category" | "status" | "priority";
  const [colorBy, setColorBy] = useState<ColorByMode>(() => {
    try {
      const v = localStorage.getItem("tasks-gantt-colorby");
      if (v === "status" || v === "priority") return v;
    } catch {}
    return "category";
  });

  useEffect(() => {
    try { localStorage.setItem("tasks-gantt-colorby", colorBy); } catch {}
  }, [colorBy]);

  const maxDepth = maxDepthProp;

  // ── Category color map ───────────────────────────────────────────────
  const categoryColorMap = useMemo(() => {
    const map = new Map<number, string>();
    for (const cat of categories) {
      if ((cat as TaskCategory).color)
        map.set((cat as TaskCategory).id, (cat as TaskCategory).color!);
    }
    return map;
  }, [categories]);

  // ── Build tree + flatten ─────────────────────────────────────────────
  const tree = useMemo(() => {
    if (ganttGroupBy === "status" || ganttGroupBy === "priority") {
      return buildGroupedTree(tasks, ganttGroupBy);
    }
    return buildTree(tasks);
  }, [tasks, ganttGroupBy]);

  // Auto-expand virtual group nodes when using grouped mode
  useEffect(() => {
    if (ganttGroupBy !== "hierarchy") {
      setExpanded((prev) => {
        const next = new Set(prev);
        for (const root of tree) {
          if (root.task.id < 0) next.add(root.task.id);
        }
        return next;
      });
    }
  }, [tree, ganttGroupBy]);

  const taskNodeMap = useMemo(() => {
    const map = new Map<number, TreeNode>();
    const walk = (nodes: TreeNode[]) => {
      for (const n of nodes) { map.set(n.task.id, n); walk(n.children); }
    };
    walk(tree);
    return map;
  }, [tree]);

  const onToggle = useCallback((id: number, expandAll = false) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (expandAll) {
        if (next.has(id)) {
          next.delete(id);
          for (const descId of getAllDescendantIds(id, taskNodeMap)) next.delete(descId);
        } else {
          next.add(id);
          for (const descId of getAllDescendantIds(id, taskNodeMap)) next.add(descId);
        }
      } else {
        if (next.has(id)) next.delete(id);
        else next.add(id);
      }
      saveExpanded(next);
      return next;
    });
  }, [getAllDescendantIds, taskNodeMap]);

  const flatRows = useMemo(() => {
    const all = flattenTree(tree, expanded);
    if (maxDepth === null) return all;
    // Filter by depth and remap parentIndex to new positions
    const filtered: FlatRow[] = [];
    const indexMap = new Map<number, number>();
    for (let i = 0; i < all.length; i++) {
      if (all[i].depth <= maxDepth) {
        indexMap.set(i, filtered.length);
        filtered.push({
          ...all[i],
          parentIndex: all[i].parentIndex !== null ? (indexMap.get(all[i].parentIndex!) ?? null) : null,
        });
      }
    }
    return filtered;
  }, [tree, expanded, maxDepth]);
  const flatRowsRef = useRef(flatRows);
  flatRowsRef.current = flatRows;

  // Simple row position: all rows are fixed height
  const rowTops = useMemo(() => flatRows.map((_, i) => i * ROW_HEIGHT), [flatRows]);
  const totalContentHeight = flatRows.length * ROW_HEIGHT + 40;

  // ── Timeline range ───────────────────────────────────────────────────
  const { rangeStart, rangeEnd } = useMemo(
    () => computeTimelineRange(flatRows),
    [flatRows]
  );
  const totalDays = Math.ceil(diffDays(rangeStart, rangeEnd));
  const timelineWidth = totalDays * pxPerDay;

  const { ticks, monthBars } = useMemo(
    () => generateTicks(rangeStart, rangeEnd, pxPerDay),
    [rangeStart, rangeEnd, pxPerDay]
  );

  const today = startOfDay(new Date());
  const yearEnd = useMemo(() => new Date(today.getFullYear(), 11, 31), []);
  const todayX = diffDays(rangeStart, today) * pxPerDay;

  const leftPanelRef = useRef<HTMLDivElement>(null);
  const scrollRafRef = useRef<number | null>(null);

  // ── Virtualization: only render visible rows ──────────────────────
  const [visibleScrollTop, setVisibleScrollTop] = useState(0);
  const viewportHeightRef = useRef(600);
  const VIRT_BUFFER = 5;
  const firstVisibleRow = Math.max(0, Math.floor(visibleScrollTop / ROW_HEIGHT) - VIRT_BUFFER);
  const lastVisibleRow = Math.min(flatRows.length - 1, Math.ceil((visibleScrollTop + viewportHeightRef.current) / ROW_HEIGHT) + VIRT_BUFFER);
  const headerRef = useRef<HTMLDivElement>(null);

  // Sync timeline header horizontal scroll with body
  const syncHorizontalScroll = useCallback(() => {
    const body = rightPanelRef.current;
    const header = headerRef.current;
    if (body && header) {
      header.style.transform = `translateX(-${body.scrollLeft}px)`;
    }
  }, []);

  // Scroll sync: lock flag prevents ping-pong between panels
  const scrollLockRef = useRef(false);
  const syncVerticalScroll = useCallback((source: "left" | "right") => {
    if (scrollLockRef.current) return;
    scrollLockRef.current = true;
    const left = leftPanelRef.current;
    const right = rightPanelRef.current;
    if (left && right) {
      if (source === "left") {
        right.scrollTop = left.scrollTop;
      } else {
        left.scrollTop = right.scrollTop;
      }
    }
    requestAnimationFrame(() => { scrollLockRef.current = false; });
  }, []);

  // Full-width toggle
  const [isFullWidth, setIsFullWidth] = useState(() => {
    try { return localStorage.getItem("gantt-full-width") === "true"; } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem("gantt-full-width", String(isFullWidth)); } catch {}
    window.dispatchEvent(new Event("gantt-fullwidth-change"));
  }, [isFullWidth]);

  // ── Scroll to today (left-aligned with small padding) ──────────────
  const didAutoScroll = useRef(false);
  const scrollToToday = useCallback(() => {
    const panel = rightPanelRef.current;
    if (panel) {
      // In day view, scroll to current hour; otherwise scroll to today
      const now = new Date();
      const hourFrac = (now.getHours() + now.getMinutes() / 60) / 24;
      const nowX = todayX + hourFrac * pxPerDay;
      panel.scrollLeft = Math.max(0, nowX - panel.clientWidth * 0.3);
    }
  }, [todayX, pxPerDay]);

  useEffect(() => {
    if (didAutoScroll.current) return;
    didAutoScroll.current = true;
    scrollToToday();
    // Set sticky-label CSS variable after initial scroll
    requestAnimationFrame(() => {
      const panel = rightPanelRef.current;
      if (panel) panel.style.setProperty('--gantt-sl', `${panel.scrollLeft}px`);
    });
  }, [scrollToToday]);

  // F key to focus on today
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "f" || e.key === "F") {
        scrollToToday();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [scrollToToday]);

  // ── Tooltip (ref-based position to avoid 60fps re-renders) ──────────
  const [tooltipData, setTooltipData] = useState<{
    task: Task;
    start: Date | null;
    end: Date | null;
  } | null>(null);
  const tooltipPosRef = useRef({ x: 0, y: 0 });
  const tooltipElRef = useRef<HTMLDivElement>(null);

  // ── Drag state (visual-only during drag, mutate once on mouseup) ────
  const [dragState, setDragState] = useState<{
    taskId: number;
    mode: "move" | "resize-left" | "resize-right";
    startMouseX: number;
    origStart: Date;
    origEnd: Date;
  } | null>(null);
  const [dragDaysDelta, setDragDaysDelta] = useState(0);

  const startDrag = useCallback(
    (
      e: React.MouseEvent,
      task: Task,
      mode: "move" | "resize-left" | "resize-right",
      barStart: Date,
      barEnd: Date
    ) => {
      const row = flatRows.find((r) => r.node.task.id === task.id);
      if (row?.hasChildren) return;
      e.preventDefault();
      e.stopPropagation();
      setDragDaysDelta(0);
      setDragState({
        taskId: task.id,
        mode,
        startMouseX: e.clientX,
        origStart: barStart,
        origEnd: barEnd,
      });
    },
    [flatRows]
  );

  useEffect(() => {
    if (!dragState) return;
    const pxRef = pxPerDay; // capture for closure
    const onMove = (e: MouseEvent) => {
      const dx = e.clientX - dragState.startMouseX;
      setDragDaysDelta(Math.round(dx / pxRef));
    };
    const onUp = (e: MouseEvent) => {
      const dx = e.clientX - dragState.startMouseX;
      const delta = Math.round(dx / pxRef);
      // Single API call on release
      if (delta !== 0) {
        if (dragState.mode === "move") {
          updateTask.mutate({
            id: dragState.taskId,
            data: { startDate: addDays(dragState.origStart, delta).toISOString(), dueDate: addDays(dragState.origEnd, delta).toISOString() } as any,
          });
        } else if (dragState.mode === "resize-left") {
          const ns = addDays(dragState.origStart, delta);
          if (ns < dragState.origEnd) updateTask.mutate({ id: dragState.taskId, data: { startDate: ns.toISOString() } as any });
        } else {
          const ne = addDays(dragState.origEnd, delta);
          if (ne > dragState.origStart) updateTask.mutate({ id: dragState.taskId, data: { dueDate: ne.toISOString() } as any });
        }
      }
      setDragState(null);
      setDragDaysDelta(0);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.body.style.cursor = dragState.mode === "move" ? "grabbing" : "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, [dragState, pxPerDay, updateTask]);

  // ── Bar position helper ──────────────────────────────────────────────
  const getBarPos = useCallback(
    (start: Date | null, end: Date | null) => {
      if (!start && !end) return null;
      const bStart = start
        ? diffDays(rangeStart, start) * pxPerDay
        : end ? diffDays(rangeStart, end) * pxPerDay - pxPerDay : 0;
      const bEnd = end
        ? diffDays(rangeStart, addDays(end, 1)) * pxPerDay
        : start ? diffDays(rangeStart, addDays(start, 1)) * pxPerDay : 0;
      return { left: bStart, width: Math.max(6, bEnd - bStart) };
    },
    [rangeStart, pxPerDay]
  );

  // ── Determine color for a row (respects color-by mode) ──
  const getRowColor = useCallback(
    (row: FlatRow): string => {
      const task = row.node.task;
      if (colorBy === "status") {
        return STATUS_COLORS[task.status as TaskStatus] ?? "#6366f1";
      }
      if (colorBy === "priority") {
        const p = (task.priority ?? "medium") as TaskPriority;
        return PRIORITY_BADGE[p]?.text ?? "#6366f1";
      }
      // Default: category
      const catColor = task.categoryId
        ? categoryColorMap.get(task.categoryId)
        : undefined;
      return catColor ?? STATUS_COLORS[task.status as TaskStatus] ?? "#6366f1";
    },
    [categoryColorMap, colorBy]
  );

  // ── Precompute L2 parent row spans (for extending deadline lines through children) ──
  const l2Spans = useMemo(() => {
    const spans = new Map<number, { startRow: number; endRow: number }>();
    for (let i = 0; i < flatRows.length; i++) {
      const row = flatRows[i];
      if (row.depth === 2 && row.hasChildren) {
        let endRow = i + 1;
        while (endRow < flatRows.length && flatRows[endRow].depth > 2) {
          endRow++;
        }
        spans.set(i, { startRow: i, endRow });
      }
    }
    return spans;
  }, [flatRows]);

  // ── Precompute L3 parent row spans (for extending deadline lines through children) ──
  const l3Spans = useMemo(() => {
    const spans = new Map<number, { startRow: number; endRow: number }>();
    for (let i = 0; i < flatRows.length; i++) {
      const row = flatRows[i];
      if (row.depth === 3 && row.hasChildren) {
        let endRow = i + 1;
        while (endRow < flatRows.length && flatRows[endRow].depth > 3) {
          endRow++;
        }
        spans.set(i, { startRow: i, endRow });
      }
    }
    return spans;
  }, [flatRows]);

  // ── Pre-compute all node spans (avoids repeated recursive getNodeSpan during render) ──
  const nodeSpanCache = useMemo(() => {
    const cache = new Map<number, { start: Date | null; end: Date | null }>();
    for (let i = 0; i < flatRows.length; i++) {
      const row = flatRows[i];
      cache.set(i, row.hasChildren ? getNodeSpan(row.node) : getEffectiveDates(row.node.task));
    }
    return cache;
  }, [flatRows]);

  // ── Precompute L1 background bands (category color spans across all children) ──
  const l1Bands = useMemo(() => {
    const bands: Array<{
      startRow: number;
      endRow: number; // exclusive
      color: string;
      left: number;
      width: number;
    }> = [];

    for (let i = 0; i < flatRows.length; i++) {
      const row = flatRows[i];
      if (row.depth !== 1 || !row.hasChildren) continue;

      // Find where this L1's children end
      let endRow = i + 1;
      while (endRow < flatRows.length && flatRows[endRow].depth > 1) {
        endRow++;
      }

      const catColor = getRowColor(row);
      // The band extends to Dec 31 of current year
      const bandStart = diffDays(rangeStart, rangeStart) * pxPerDay; // start of timeline
      const bandEnd = diffDays(rangeStart, yearEnd) * pxPerDay;

      bands.push({
        startRow: i,
        endRow,
        color: catColor,
        left: Math.max(0, bandStart),
        width: Math.max(0, bandEnd - bandStart),
      });
    }
    return bands;
  }, [flatRows, getRowColor, rangeStart, pxPerDay]);

  // ── Render ───────────────────────────────────────────────────────────
  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2 py-16">
        <Calendar className="h-10 w-10 opacity-40" />
        <p className="text-sm">{t("gantt.noDate")}</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="h-full flex flex-col overflow-hidden">
      {/* ── Main split panel ────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 flex">
        {/* ── Left panel ──────────────────────────────────────────── */}
        <div
          className="shrink-0 flex flex-col border-r border-border/30 relative"
          style={{ width: leftWidth }}
        >
          {/* Left header */}
          <div className="shrink-0 h-[52px] flex items-end px-3 pb-1.5 border-b border-border/30 bg-muted/50 text-[11px] font-medium text-muted-foreground">
            {t("columns.title")}
          </div>

          {/* Left rows */}
          <div
            ref={leftPanelRef}
            className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden [scrollbar-width:none]"
            onScroll={() => { if (!scrollRafRef.current) { scrollRafRef.current = requestAnimationFrame(() => { syncVerticalScroll("left"); scrollRafRef.current = null; }); } }}
            onMouseOver={(e) => {
              const el = (e.target as HTMLElement).closest("[data-row-idx]");
              if (el) setHoveredRow(Number(el.getAttribute("data-row-idx")));
            }}
            onMouseOut={(e) => {
              const el = (e.target as HTMLElement).closest("[data-row-idx]");
              if (el) setHoveredRow(null);
            }}
            onClick={(e) => {
              const el = (e.target as HTMLElement).closest("[data-row-idx]");
              if (!el) return;
              const idx = Number(el.getAttribute("data-row-idx"));
              const row = flatRows[idx];
              if (row) toggleTaskExpand(row.node.task.id);
            }}
          >
            {/* Spacer for virtualized rows above */}
            {firstVisibleRow > 0 && <div style={{ height: firstVisibleRow * ROW_HEIGHT }} />}
            {flatRows.slice(firstVisibleRow, lastVisibleRow + 1).map((row, sliceIdx) => {
              const i = firstVisibleRow + sliceIdx;
              const { task } = row.node;
              const catColorRaw = task.categoryId ? categoryColorMap.get(task.categoryId) : undefined;
              const catColor = catColorRaw ?? "#6366f1";
              const isDone = task.status === "done";
              const isInProgress = task.status === "in_progress";
              const isRoot = row.depth === 0;
              const isL1 = row.depth === 1 && row.hasChildren;
              const priority = (task.priority ?? "medium") as TaskPriority;
              const childCount = row.node.children.length;
              const isSelected = expandedTaskId === task.id;
              const CatIcon = task.categoryId ? CATEGORY_ICON[task.categoryId] : undefined;
              const l1Bg = isL1 && colorBy === "category" ? catColor : undefined;

              return (
                <div
                  key={task.id}
                  data-row-idx={i}
                  className={cn(
                    "flex items-center gap-1 pr-1 border-b border-border/10 cursor-pointer transition-colors",
                    isSelected
                      ? "bg-white dark:bg-white/15"
                      : hoveredRow === i
                        ? "bg-white dark:bg-white/10"
                        : "hover:bg-white/70 dark:hover:bg-white/5"
                  )}
                  style={{
                    height: ROW_HEIGHT,
                    paddingLeft: 4 + row.depth * 24,
                    ...(isRoot && !isSelected
                      ? { backgroundColor: "rgba(26,26,26,0.08)" }
                      : l1Bg && !isSelected
                      ? { backgroundColor: l1Bg, color: "white" }
                      : {}),
                  }}
                >
                  {row.hasChildren ? (
                    <button
                      onClick={(e) => { e.stopPropagation(); onToggle(task.id, e.shiftKey); }}
                      className="shrink-0 h-4 w-4 flex items-center justify-center rounded hover:bg-black/5 dark:hover:bg-white/10 text-muted-foreground"
                    >
                      <ChevronRight className={cn("h-3 w-3 transition-transform duration-150", expanded.has(task.id) && "rotate-90")} />
                    </button>
                  ) : (
                    <span className="shrink-0 w-4" />
                  )}

                  {(isRoot || isL1) ? (() => {
                    const sz = isRoot ? 28 : 30;
                    const iconSz = isRoot ? "h-3.5 w-3.5" : "h-4 w-4";
                    return (
                      <div className="shrink-0 relative" style={{ width: sz, height: sz }}>
                        <div className="absolute inset-0 flex items-center justify-center rounded-full" style={{ backgroundColor: isRoot ? "#1a1a1a" : catColor }}>
                          {isRoot && <Target className={cn(iconSz, "text-white")} />}
                          {CatIcon && !isRoot && <CatIcon className={cn(iconSz, "text-white")} />}
                        </div>
                      </div>
                    );
                  })() : (
                    <div className="shrink-0 relative" style={{ width: 14, height: 14 }}>
                      <span className="absolute rounded-full" style={{ width: 8, height: 8, top: 3, left: 3, backgroundColor: catColor, opacity: isDone ? 0.4 : 0.8 }} />
                      {isInProgress && row.depth >= 2 && (
                        <svg className="absolute inset-0 animate-spin" width={14} height={14} viewBox="0 0 14 14" fill="none" style={{ animationDuration: "1.5s" }}>
                          <circle cx={7} cy={7} r={6} stroke={catColor} strokeWidth={1.5} strokeOpacity={0.2} />
                          <circle cx={7} cy={7} r={6} stroke={catColor} strokeWidth={1.5} strokeDasharray={`${2 * Math.PI * 6 * 0.25} ${2 * Math.PI * 6 * 0.75}`} strokeLinecap="round" />
                        </svg>
                      )}
                    </div>
                  )}

                  {task.id > 0 && <span className={cn("shrink-0 text-[9px] font-mono w-[22px] text-right", l1Bg && !isSelected ? "text-white/60" : "text-muted-foreground/40")}>#{task.id}</span>}
                  <span className={cn("truncate text-[11px] flex-1 min-w-0", isRoot ? "font-bold" : isL1 ? "font-semibold" : "font-normal", isDone && "line-through text-muted-foreground/50", l1Bg && !isSelected && "text-white")} title={task.title ?? ""}>{task.title}</span>
                  <span className="ml-auto flex items-center gap-1 shrink-0">
                    {childCount > 0 && !expanded.has(task.id) && (
                      <span className={cn("text-[8px] font-medium px-1 py-0.5 rounded-full", l1Bg && !isSelected ? "bg-white/20 text-white/80" : "text-muted-foreground/50 bg-muted/60 dark:bg-white/8")}>+{childCount}</span>
                    )}
                    {row.depth >= 2 && <PriorityBars priority={priority} />}
                  </span>
                </div>
              );
            })}
            {/* Spacer for virtualized rows below */}
            <div style={{ height: Math.max(0, (flatRows.length - lastVisibleRow - 1) * ROW_HEIGHT + 40) }} />
          </div>

          {/* Resize handle */}
          <div className="absolute top-0 bottom-0 right-0 w-2 cursor-col-resize group z-20" onMouseDown={startResize}>
            <div className="w-px h-full mx-auto bg-transparent group-hover:bg-brand-indigo/40 transition-colors" />
          </div>
        </div>

        {/* ── Right panel: timeline ───────────────────────────────── */}
        <div className="flex-1 min-w-0 flex flex-col">
          {/* Timeline header (OUTSIDE scroll, so both panels scroll identically) */}
          <div className="shrink-0 relative border-b border-border/30 bg-muted/50 overflow-hidden" style={{ height: 52 }}>
            <div ref={headerRef} className="absolute inset-0" style={{ width: timelineWidth }}>
              {monthBars.map((mb, mi) => (
                <div key={`month-${mi}`} className="absolute top-0 h-[24px] flex items-center px-2 border-l border-border/30 text-[10px] font-semibold text-muted-foreground overflow-hidden" style={{ left: mb.x, width: mb.w }}>{mb.label}</div>
              ))}
              {ticks.map((tick, ti) => {
                const isToday = tick.isMajor && tick.date.getTime() === today.getTime();
                const isWeekend = pxPerDay >= 30 && tick.isMajor && (tick.date.getDay() === 0 || tick.date.getDay() === 6);
                const nextTickX = ti + 1 < ticks.length ? ticks[ti + 1].x : tick.x + pxPerDay;
                const tickWidth = Math.max(20, nextTickX - tick.x - 1);
                return (
                  <div key={`tick-${ti}`} className={cn("absolute top-[24px] h-[28px] flex items-center border-l text-[9px] overflow-hidden", tick.isMajor ? "border-border/30 font-medium text-muted-foreground" : "border-border/10 text-muted-foreground/40", isToday && "font-bold text-brand-indigo", isWeekend && !isToday && "bg-muted/30 text-muted-foreground/35")} style={{ left: tick.x, width: tickWidth }}>
                    <span className="pl-1 truncate">{tick.label}</span>
                  </div>
                );
              })}
              <div className="absolute top-0 h-full w-0.5 bg-brand-indigo z-10" style={{ left: todayX }} />
            </div>
          </div>

          {/* Timeline body (scrolls in sync with left panel - no offset) */}
          <div
            ref={rightPanelRef}
            className="flex-1 min-h-0 overflow-auto"
            onScroll={(e) => { const el = e.currentTarget; if (!scrollRafRef.current) { scrollRafRef.current = requestAnimationFrame(() => { syncVerticalScroll("right"); syncHorizontalScroll(); viewportHeightRef.current = el.clientHeight; setVisibleScrollTop(el.scrollTop); el.style.setProperty('--gantt-sl', `${el.scrollLeft}px`); scrollRafRef.current = null; }); } }}
          >
            <div className="relative" style={{ width: timelineWidth, height: totalContentHeight }}>
              {/* Grid lines */}
              {ticks.map((tick, i) => {
                const isWeekend =
                  pxPerDay >= 30 &&
                  tick.isMajor &&
                  (tick.date.getDay() === 0 || tick.date.getDay() === 6);
                const isToday = tick.isMajor && tick.date.getTime() === today.getTime();
                return (
                  <div
                    key={`grid-${i}`}
                    className={cn(
                      "absolute top-0 bottom-0 border-l",
                      tick.isMajor ? "border-border/20" : "border-border/6",
                      isWeekend && "bg-muted/10",
                      isToday && "bg-white/40 dark:bg-white/8"
                    )}
                    style={{
                      left: tick.x,
                      width: (isWeekend || isToday) && pxPerDay >= 30 ? pxPerDay : undefined,
                    }}
                  />
                );
              })}

              {/* L1 category background bands spanning all children (category mode only) */}
              {colorBy === "category" && l1Bands.map((band, bi) => (
                <div
                  key={`l1band-${bi}`}
                  className="absolute z-[1] rounded-sm pointer-events-none"
                  style={{
                    top: band.startRow * ROW_HEIGHT,
                    height: (band.endRow - band.startRow) * ROW_HEIGHT,
                    left: band.left,
                    width: band.width,
                    backgroundColor: band.color,
                    opacity: 0.04,
                  }}
                />
              ))}

              {/* Row stripes + hover + L0/L1 colored rows (virtualized) */}
              {flatRows.slice(firstVisibleRow, lastVisibleRow + 1).map((row, sliceIdx) => {
                const i = firstVisibleRow + sliceIdx;
                const isRootRow = row.depth === 0;
                const isL1Row = row.depth === 1 && row.hasChildren;
                const l1CatColor = isL1Row && colorBy === "category"
                  ? (row.node.task.categoryId ? categoryColorMap.get(row.node.task.categoryId) : undefined)
                  : undefined;
                const isSelectedRow = expandedTaskId === row.node.task.id;

                return (
                  <div
                    key={`stripe-${i}`}
                    className={cn(
                      "absolute left-0 right-0 border-b border-border/8 transition-colors z-[2]",
                      isSelectedRow
                        ? "bg-white/80 dark:bg-white/15"
                        : hoveredRow === i
                          ? "bg-white/60 dark:bg-white/8"
                          : i % 2 === 1 ? "bg-muted/5" : ""
                    )}
                    style={{
                      top: rowTops[i],
                      height: ROW_HEIGHT,
                      ...(isRootRow ? { backgroundColor: "#1a1a1a", opacity: hoveredRow === i ? 0.12 : 0.08 } : {}),
                      ...(l1CatColor ? { backgroundColor: l1CatColor, opacity: hoveredRow === i ? 0.85 : 0.75 } : {}),
                    }}
                    onMouseEnter={() => setHoveredRow(i)}
                    onMouseLeave={() => setHoveredRow(null)}
                  />
                );
              })}

              {/* Today marker */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-brand-indigo/60 z-10"
                style={{ left: todayX }}
              />

              {/* Dependency lines: colored, from parent to child */}
              <svg
                className="absolute inset-0 pointer-events-none z-[5]"
                width={timelineWidth}
                height={totalContentHeight}
              >
                {flatRows.map((row, i) => {
                  if (row.parentIndex === null) return null;
                  const parentRow = flatRows[row.parentIndex];
                  // Only show dependency lines from L3+ parents to their children
                  if (parentRow.depth <= 2) return null;
                  // Performance: skip lines entirely outside visible range
                  if (i > lastVisibleRow + 10 && row.parentIndex > lastVisibleRow + 10) return null;
                  if (i < firstVisibleRow - 10 && row.parentIndex < firstVisibleRow - 10) return null;

                  const parentSpan = nodeSpanCache.get(row.parentIndex) ?? (parentRow.hasChildren
                    ? getNodeSpan(parentRow.node)
                    : getEffectiveDates(parentRow.node.task));
                  const childSpan = nodeSpanCache.get(i) ?? (row.hasChildren
                    ? getNodeSpan(row.node)
                    : getEffectiveDates(row.node.task));

                  const parentPos = getBarPos(parentSpan.start, parentSpan.end);
                  const childPos = getBarPos(childSpan.start, childSpan.end);
                  if (!parentPos || !childPos) return null;

                  const lineColor = getRowColor(parentRow);

                  // Drop from parent bar's left area, down to child
                  const dropX = parentPos.left + Math.min(20, parentPos.width * 0.15);
                  const parentBottom =
                    rowTops[row.parentIndex] +
                    (parentRow.hasChildren
                      ? ROW_HEIGHT / 2 + 8
                      : BAR_Y_OFFSET + BAR_HEIGHT);
                  const childMidY = rowTops[i] + ROW_HEIGHT / 2;
                  const childLeft = childPos.left;

                  return (
                    <g key={`dep-${i}`}>
                      <line
                        x1={dropX} y1={parentBottom}
                        x2={dropX} y2={childMidY}
                        stroke={lineColor} strokeWidth={1.5}
                        strokeDasharray="4 3" strokeOpacity={0.35}
                      />
                      <line
                        x1={dropX} y1={childMidY}
                        x2={childLeft} y2={childMidY}
                        stroke={lineColor} strokeWidth={1.5}
                        strokeDasharray="4 3" strokeOpacity={0.35}
                      />
                      <polygon
                        points={`${childLeft},${childMidY} ${childLeft - 4},${childMidY - 3} ${childLeft - 4},${childMidY + 3}`}
                        fill={lineColor} fillOpacity={0.35}
                      />
                    </g>
                  );
                })}
              </svg>

              {/* ── Task bars (virtualized) ────────────────────────── */}
              {flatRows.slice(firstVisibleRow, lastVisibleRow + 1).map((row, sliceIdx) => {
                const i = firstVisibleRow + sliceIdx;
                const { task } = row.node;
                const isParent = row.hasChildren;
                const isRoot = row.depth === 0;
                const isL1 = row.depth === 1 && isParent;
                const span = nodeSpanCache.get(i) ?? (isParent ? getNodeSpan(row.node) : getEffectiveDates(task));
                const { start, end } = span;
                const catColor = getRowColor(row);
                const isDone = task.status === "done";

                // L1 categories: rendered as background bands, no bar needed
                if (isL1) return null;

                // L0 root: dark bar extending to Dec 31 2026
                if (isRoot) {
                  const barStart = start ?? today;
                  const barEndDate = yearEnd;
                  const rootPos = getBarPos(barStart, barEndDate);
                  if (!rootPos) return null;
                  return (
                    <div
                      key={`bar-${task.id}`}
                      className="absolute cursor-pointer group/bar z-[6]"
                      style={{
                        top: rowTops[i] + ROW_HEIGHT / 2 - 4,
                        left: rootPos.left,
                        width: rootPos.width,
                        height: 8,
                      }}
                      onClick={() => { toggleTaskExpand(task.id); onTaskClick?.(task.id); }}
                      onMouseEnter={(e) => {
                        setHoveredRow(i);
                        tooltipPosRef.current = { x: e.clientX, y: e.clientY }; setTooltipData({ task, start: barStart, end: barEndDate });
                      }}
                      onMouseMove={(e) => {
                        tooltipPosRef.current = { x: e.clientX, y: e.clientY };
                        if (tooltipElRef.current) { tooltipElRef.current.style.left = `${e.clientX}px`; tooltipElRef.current.style.top = `${e.clientY - 12}px`; }
                      }}
                      onMouseLeave={() => { setHoveredRow(null); setTooltipData(null); }}
                    >
                      <div className="h-full rounded-sm" style={{ backgroundColor: "#1a1a1a", opacity: 0.85 }} />
                      {rootPos.width > 60 && (
                        <span
                          className="absolute top-0 bottom-0 flex items-center text-[9px] font-bold truncate pointer-events-none text-white"
                          style={{
                            left: `clamp(0px, calc(var(--gantt-sl, 0px) - ${rootPos.left}px), ${Math.max(0, rootPos.width - 60)}px)`,
                            right: 0,
                            paddingLeft: 8,
                            paddingRight: 8,
                            textShadow: "0 1px 2px rgba(0,0,0,0.5)",
                          }}
                        >
                          {task.title}
                        </span>
                      )}
                    </div>
                  );
                }

                if (!start && !end) {
                  // Unscheduled ghost pill
                  return (
                    <div
                      key={`bar-${task.id}`}
                      className="absolute cursor-pointer group/bar z-[6]"
                      style={{
                        top: rowTops[i] + BAR_Y_OFFSET + 2,
                        left: todayX - 20,
                        width: 40,
                        height: BAR_HEIGHT - 4,
                      }}
                      onClick={() => { toggleTaskExpand(task.id); onTaskClick?.(task.id); }}
                      onMouseEnter={(e) => {
                        setHoveredRow(i);
                        tooltipPosRef.current = { x: e.clientX, y: e.clientY }; setTooltipData({ task, start: null, end: null });
                      }}
                      onMouseLeave={() => { setHoveredRow(null); setTooltipData(null); }}
                    >
                      <div
                        className="h-full rounded-full opacity-25 group-hover/bar:opacity-40 transition-opacity border"
                        style={{ backgroundColor: catColor, borderColor: catColor }}
                      />
                    </div>
                  );
                }

                const pos = getBarPos(start, end);
                if (!pos) return null;

                const commonHandlers = {
                  onClick: () => { toggleTaskExpand(task.id); onTaskClick?.(task.id); },
                  onMouseEnter: (e: React.MouseEvent) => {
                    setHoveredRow(i);
                    tooltipPosRef.current = { x: e.clientX, y: e.clientY };
                    setTooltipData({ task, start, end });
                  },
                  onMouseMove: (e: React.MouseEvent) => {
                    tooltipPosRef.current = { x: e.clientX, y: e.clientY };
                    if (tooltipElRef.current) {
                      tooltipElRef.current.style.left = `${e.clientX}px`;
                      tooltipElRef.current.style.top = `${e.clientY - 12}px`;
                    }
                  },
                  onMouseLeave: () => { setHoveredRow(null); setTooltipData(null); },
                };

                if (isParent) {
                  // Depth 2: vertical deadline line extending through all children
                  if (row.depth === 2) {
                    // Position at the right edge of the due date (end of that day)
                    const deadlineX = end
                      ? diffDays(rangeStart, addDays(end, 1)) * pxPerDay
                      : pos.left + pos.width;

                    const rowSpan = l2Spans.get(i);
                    const lineHeight = rowSpan && rowSpan.endRow < rowTops.length
                      ? rowTops[rowSpan.endRow] - rowTops[rowSpan.startRow]
                      : rowSpan
                        ? (rowSpan.endRow - rowSpan.startRow) * ROW_HEIGHT
                        : ROW_HEIGHT;

                    return (
                      <div key={`bar-${task.id}`} className="absolute z-[7] pointer-events-none" style={{ top: rowTops[i], height: lineHeight }}>
                        {/* Span range: subtle background bar showing the time window */}
                        <div
                          className="absolute rounded-sm"
                          style={{
                            top: ROW_HEIGHT / 2 - 3,
                            left: pos.left,
                            width: pos.width,
                            height: 6,
                            backgroundColor: catColor,
                            opacity: 0.15,
                          }}
                        />
                        {/* Vertical deadline line extending through children */}
                        <div
                          className="absolute pointer-events-auto cursor-pointer"
                          style={{
                            left: deadlineX - 1,
                            top: 2,
                            width: 2,
                            height: lineHeight - 4,
                            backgroundColor: catColor,
                            opacity: 0.3,
                          }}
                          onClick={() => onTaskClick?.(task.id)}
                          onMouseEnter={(e) => {
                            setHoveredRow(i);
                            tooltipPosRef.current = { x: e.clientX, y: e.clientY }; setTooltipData({ task, start, end });
                          }}
                          onMouseMove={(e) => {
                            tooltipPosRef.current = { x: e.clientX, y: e.clientY };
                            if (tooltipElRef.current) { tooltipElRef.current.style.left = `${e.clientX}px`; tooltipElRef.current.style.top = `${e.clientY - 12}px`; }
                          }}
                          onMouseLeave={() => { setHoveredRow(null); setTooltipData(null); }}
                        />
                        {/* Diamond marker at top of deadline line */}
                        <div
                          className="absolute pointer-events-auto cursor-pointer"
                          style={{
                            left: deadlineX - 5,
                            top: ROW_HEIGHT / 2 - 5,
                            width: 10,
                            height: 10,
                            backgroundColor: catColor,
                            opacity: 0.8,
                            transform: "rotate(45deg)",
                            borderRadius: 2,
                          }}
                          onClick={() => onTaskClick?.(task.id)}
                          onMouseEnter={(e) => {
                            setHoveredRow(i);
                            tooltipPosRef.current = { x: e.clientX, y: e.clientY }; setTooltipData({ task, start, end });
                          }}
                          onMouseLeave={() => { setHoveredRow(null); setTooltipData(null); }}
                        />
                        {/* Label next to the diamond */}
                        <div
                          className="absolute text-[9px] font-semibold truncate pointer-events-none"
                          style={{
                            left: deadlineX + 8,
                            top: ROW_HEIGHT / 2 - 6,
                            maxWidth: 140,
                            color: catColor,
                            opacity: 0.85,
                          }}
                        >
                          {task.title}
                        </div>
                      </div>
                    );
                  }

                  // Depth 3: thin line with vertical deadline line + diamond + label (like L2 but thinner)
                  if (row.depth === 3) {
                    const deadlineX = end
                      ? diffDays(rangeStart, addDays(end, 1)) * pxPerDay
                      : pos.left + pos.width;

                    const rowSpan = l3Spans.get(i);
                    const lineHeight = rowSpan && rowSpan.endRow < rowTops.length
                      ? rowTops[rowSpan.endRow] - rowTops[rowSpan.startRow]
                      : rowSpan
                        ? (rowSpan.endRow - rowSpan.startRow) * ROW_HEIGHT
                        : ROW_HEIGHT;

                    return (
                      <div key={`bar-${task.id}`} className="absolute z-[7] pointer-events-none" style={{ top: rowTops[i], height: lineHeight }}>
                        {/* Thin horizontal line */}
                        <div
                          className="absolute"
                          style={{
                            top: ROW_HEIGHT / 2 - 1,
                            left: pos.left,
                            width: pos.width,
                            height: 2,
                            backgroundColor: catColor,
                            opacity: 0.35,
                          }}
                        />
                        {/* Vertical deadline line extending through children (1px) */}
                        <div
                          className="absolute pointer-events-auto cursor-pointer"
                          style={{
                            left: deadlineX,
                            top: 2,
                            width: 1,
                            height: lineHeight - 4,
                            backgroundColor: catColor,
                            opacity: 0.3,
                          }}
                          onClick={() => onTaskClick?.(task.id)}
                          onMouseEnter={(e) => {
                            setHoveredRow(i);
                            tooltipPosRef.current = { x: e.clientX, y: e.clientY }; setTooltipData({ task, start, end });
                          }}
                          onMouseMove={(e) => {
                            tooltipPosRef.current = { x: e.clientX, y: e.clientY };
                            if (tooltipElRef.current) { tooltipElRef.current.style.left = `${e.clientX}px`; tooltipElRef.current.style.top = `${e.clientY - 12}px`; }
                          }}
                          onMouseLeave={() => { setHoveredRow(null); setTooltipData(null); }}
                        />
                        {/* Diamond marker at deadline */}
                        <div
                          className="absolute pointer-events-auto cursor-pointer"
                          style={{
                            left: deadlineX - 4,
                            top: ROW_HEIGHT / 2 - 4,
                            width: 8,
                            height: 8,
                            backgroundColor: catColor,
                            opacity: 0.7,
                            transform: "rotate(45deg)",
                            borderRadius: 1,
                          }}
                          onClick={() => onTaskClick?.(task.id)}
                          onMouseEnter={(e) => {
                            setHoveredRow(i);
                            tooltipPosRef.current = { x: e.clientX, y: e.clientY }; setTooltipData({ task, start, end });
                          }}
                          onMouseLeave={() => { setHoveredRow(null); setTooltipData(null); }}
                        />
                        {/* Label next to the diamond */}
                        <div
                          className="absolute text-[9px] font-semibold truncate pointer-events-none"
                          style={{
                            left: deadlineX + 7,
                            top: ROW_HEIGHT / 2 - 6,
                            maxWidth: 120,
                            color: catColor,
                            opacity: 0.75,
                          }}
                        >
                          {task.title}
                        </div>
                      </div>
                    );
                  }

                  // Depth 4+: thin summary bar with end caps (standard parent)
                  return (
                    <div
                      key={`bar-${task.id}`}
                      className="absolute cursor-pointer group/bar z-[6]"
                      style={{
                        top: rowTops[i] + ROW_HEIGHT / 2 - 4,
                        left: pos.left,
                        width: pos.width,
                        height: 8,
                      }}
                      {...commonHandlers}
                    >
                      <div className="h-full rounded-sm" style={{ backgroundColor: catColor, opacity: 0.55 }} />
                      {pos.width > 50 && (
                        <span
                          className="absolute top-0 bottom-0 flex items-center text-[9px] font-bold truncate pointer-events-none text-white"
                          style={{
                            left: `clamp(0px, calc(var(--gantt-sl, 0px) - ${pos.left}px), ${Math.max(0, pos.width - 50)}px)`,
                            right: 0,
                            paddingLeft: 8,
                            paddingRight: 8,
                            textShadow: "0 1px 2px rgba(0,0,0,0.4)",
                          }}
                        >
                          {task.title}
                        </span>
                      )}
                    </div>
                  );
                }

                // ── Leaf task bar (draggable, resizable) ────────────
                const effectiveStart = start ?? addDays(end!, -1);
                const effectiveEnd = end ?? addDays(start!, 1);

                // Progress: compute from status + time elapsed
                const progressPct = isDone ? 100
                  : task.status === "in_progress"
                    ? (start && end
                      ? Math.min(95, Math.max(10, Math.round(
                          (diffDays(start, today) / Math.max(1, diffDays(start, end))) * 100
                        )))
                      : 50)
                  : 0;

                const isDragging = dragState?.taskId === task.id;
                const dragPx = isDragging ? dragDaysDelta * pxPerDay : 0;
                const dragLeft = isDragging && dragState.mode === "resize-left" ? dragPx : 0;
                const dragWidth = isDragging
                  ? dragState.mode === "move" ? 0
                    : dragState.mode === "resize-left" ? -dragPx
                    : dragPx
                  : 0;

                return (
                  <div
                    key={`bar-${task.id}`}
                    className="absolute group/bar z-[6]"
                    style={{
                      top: rowTops[i] + BAR_Y_OFFSET,
                      left: pos.left + (isDragging && dragState.mode === "move" ? dragPx : dragLeft),
                      width: Math.max(6, pos.width + dragWidth),
                      height: BAR_HEIGHT,
                    }}
                    {...commonHandlers}
                  >
                    {/* Main bar body */}
                    <div
                      className={cn(
                        "absolute inset-0 rounded-[5px] cursor-grab active:cursor-grabbing transition-opacity overflow-hidden",
                        expandedTaskId === task.id
                          ? "opacity-100 ring-2 ring-brand-indigo/50 ring-offset-1"
                          : isDone ? "opacity-40" : "opacity-75 group-hover/bar:opacity-100"
                      )}
                      style={{ backgroundColor: catColor }}
                      onMouseDown={(e) => startDrag(e, task, "move", effectiveStart, effectiveEnd)}
                    >
                      {/* Progress fill */}
                      {progressPct > 0 && progressPct < 100 && (
                        <div
                          className="absolute inset-y-0 left-0 rounded-l-[5px]"
                          style={{
                            width: `${progressPct}%`,
                            backgroundColor: "rgba(255,255,255,0.2)",
                          }}
                        />
                      )}
                    </div>

                    {/* Left resize handle */}
                    <div
                      className="absolute -left-1 top-0 bottom-0 w-3 cursor-col-resize z-10 opacity-0 group-hover/bar:opacity-100"
                      onMouseDown={(e) => startDrag(e, task, "resize-left", effectiveStart, effectiveEnd)}
                    >
                      <div className="absolute left-1 top-1/2 -translate-y-1/2 w-1 h-3.5 rounded-sm bg-white/80" />
                    </div>

                    {/* Right resize handle */}
                    <div
                      className="absolute -right-1 top-0 bottom-0 w-3 cursor-col-resize z-10 opacity-0 group-hover/bar:opacity-100"
                      onMouseDown={(e) => startDrag(e, task, "resize-right", effectiveStart, effectiveEnd)}
                    >
                      <div className="absolute right-1 top-1/2 -translate-y-1/2 w-1 h-3.5 rounded-sm bg-white/80" />
                    </div>

                    {/* Label (sticky: slides with horizontal scroll, stays visible until bar exits) */}
                    {pos.width > 40 && (
                      <span
                        className="absolute top-0 bottom-0 flex items-center text-[10px] font-medium text-white truncate pointer-events-none"
                        style={{
                          left: `clamp(0px, calc(var(--gantt-sl, 0px) - ${pos.left}px), ${Math.max(0, pos.width - 40)}px)`,
                          right: 0,
                          paddingLeft: 8,
                          paddingRight: 8,
                          textShadow: "0 1px 2px rgba(0,0,0,0.3)",
                        }}
                      >
                        {task.title}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Hover tooltip (timeline bars) — position via ref, no re-render on move */}
      {tooltipData && !expandedTaskId && (
        <div
          ref={tooltipElRef}
          className="fixed z-[100] pointer-events-none"
          style={{ left: tooltipPosRef.current.x, top: tooltipPosRef.current.y - 12, transform: "translate(-50%, -100%)" }}
        >
          <BarTooltip
            task={tooltipData.task}
            start={tooltipData.start}
            end={tooltipData.end}
            x={0}
            y={0}
          />
        </div>
      )}

      {/* Selected task detail panel (floating, always editable) */}
      {expandedTaskId && (() => {
        const rowIdx = flatRows.findIndex((r) => r.node.task.id === expandedTaskId);
        if (rowIdx < 0) return null;
        const row = flatRows[rowIdx];
        const task = row.node.task;
        const dates = getEffectiveDates(task);
        const tags = parseTags((task as any).tags);
        const catColor = getRowColor(row);

        // Position the panel below the row
        const scrollEl = rightPanelRef.current;
        const containerEl = containerRef.current;
        if (!scrollEl || !containerEl) return null;
        const containerRect = containerEl.getBoundingClientRect();
        const rowVisualTop = 52 + rowTops[rowIdx] - scrollEl.scrollTop;
        const panelTop = containerRect.top + rowVisualTop + ROW_HEIGHT + 4;

        return (
          <div
            className="fixed z-[100] bg-popover border border-border rounded-lg shadow-xl text-[12px] w-[320px]"
            style={{
              left: containerRect.left + 12,
              top: Math.min(panelTop, containerRect.bottom - 280),
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header with category color accent + X close */}
            <div className="rounded-t-lg px-3.5 pt-2.5 pb-2 relative" style={{ borderTop: `3px solid ${catColor}` }}>
              <button
                className="absolute top-2 right-2 h-5 w-5 flex items-center justify-center rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setExpandedTaskId(null)}
              >
                <X className="h-3 w-3" />
              </button>
              {task.id > 0 && <span className="text-muted-foreground/40 text-[10px] font-mono">#{task.id}</span>}
              <input
                className="w-full bg-transparent text-[13px] font-semibold text-foreground outline-none border-b border-transparent focus:border-border/40 pb-0.5 pr-5"
                defaultValue={task.title ?? ""}
                onBlur={(e) => {
                  if (e.target.value !== task.title) updateTask.mutate({ id: task.id, data: { title: e.target.value } as any });
                }}
                onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
              />
            </div>

            <div className="px-3.5 pb-3 space-y-2">
              {/* Description */}
              <textarea
                className="w-full bg-muted/30 rounded text-[11px] text-foreground/80 outline-none p-1.5 resize-none focus:ring-1 focus:ring-border/40"
                rows={2}
                defaultValue={task.description ?? ""}
                placeholder="Description..."
                onBlur={(e) => {
                  if (e.target.value !== (task.description ?? "")) updateTask.mutate({ id: task.id, data: { description: e.target.value } as any });
                }}
              />

              {/* Dates */}
              <div className="flex gap-2 items-center flex-wrap text-[10px]">
                <label className="text-muted-foreground">Start:</label>
                <input type="date" className="bg-muted/30 rounded px-1 py-0.5 text-foreground outline-none text-[10px]"
                  defaultValue={dates.start ? dates.start.toISOString().slice(0, 10) : ""}
                  onChange={(e) => { if (e.target.value) updateTask.mutate({ id: task.id, data: { startDate: e.target.value } as any }); }}
                />
                <label className="text-muted-foreground">Due:</label>
                <input type="date" className="bg-muted/30 rounded px-1 py-0.5 text-foreground outline-none text-[10px]"
                  defaultValue={dates.end ? dates.end.toISOString().slice(0, 10) : ""}
                  onChange={(e) => { if (e.target.value) updateTask.mutate({ id: task.id, data: { dueDate: e.target.value } as any }); }}
                />
              </div>

              {/* Status + Priority */}
              <div className="flex gap-1.5 items-center flex-wrap text-[10px]">
                <select className="bg-muted/30 rounded px-1 py-0.5 text-foreground outline-none text-[10px]"
                  defaultValue={task.status ?? "todo"}
                  onChange={(e) => updateTask.mutate({ id: task.id, data: { status: e.target.value } as any })}
                >
                  <option value="todo">To Do</option>
                  <option value="in_progress">In Progress</option>
                  <option value="done">Done</option>
                </select>
                <select className="bg-muted/30 rounded px-1 py-0.5 text-foreground outline-none text-[10px]"
                  defaultValue={task.priority ?? "medium"}
                  onChange={(e) => updateTask.mutate({ id: task.id, data: { priority: e.target.value } as any })}
                >
                  <option value="urgent">Urgent</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>

              {/* Tags */}
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {tags.map((tag) => {
                    const tc = TAG_COLORS[tag];
                    return (
                      <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded"
                        style={tc ? { backgroundColor: tc.bg, color: tc.text } : { backgroundColor: "rgba(0,0,0,0.05)", color: "#666" }}
                      >{tag}</span>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Portal gantt controls into page toolbar */}
      {toolbarPortal?.current && createPortal(
        <div className="flex items-center gap-1.5">
          {/* ── Zoom tab ── */}
          <div className="inline-flex items-center bg-muted/60 rounded-lg p-0.5 gap-0.5">
            {(["day", "week", "month"] as ZoomLevel[]).map((z) => (
              <button key={z} onClick={() => setZoomPreset(z)}
                className={cn("px-2 py-0.5 rounded-md text-[10px] font-medium transition-all", activePreset === z ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
              >{t(`gantt.zoom${z.charAt(0).toUpperCase() + z.slice(1)}` as any)}</button>
            ))}
            <button onClick={scrollToToday}
              className="px-1.5 py-0.5 rounded-md text-[10px] font-semibold text-brand-indigo hover:bg-brand-indigo/10 transition-colors">{t("gantt.today")}</button>
          </div>

          {/* ── Color tab (compact: no label prefix) ── */}
          <div className="inline-flex items-center bg-muted/60 rounded-lg p-0.5 gap-0.5">
            {(["category", "status", "priority"] as ColorByMode[]).map((mode) => (
              <button key={mode} onClick={() => setColorBy(mode)}
                className={cn("px-1.5 py-0.5 rounded-md text-[10px] font-medium transition-all", colorBy === mode ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
                title={`Color by ${mode}`}
              >{t(`gantt.colorMode${mode.charAt(0).toUpperCase() + mode.slice(1)}` as any)}</button>
            ))}
          </div>

          {/* ── Group tab (compact: no label prefix) ── */}
          {onGroupByChange && (
            <div className="inline-flex items-center bg-muted/60 rounded-lg p-0.5 gap-0.5">
              {(["hierarchy", "status", "priority"] as GanttGroupBy[]).map((g) => (
                <button key={g} onClick={() => onGroupByChange(g)}
                  className={cn("px-1.5 py-0.5 rounded-md text-[10px] font-medium transition-all", ganttGroupBy === g ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
                  title={`Group by ${g}`}
                >
                  {g === "hierarchy" ? "Tree" : g.charAt(0).toUpperCase() + g.slice(1)}
                </button>
              ))}
            </div>
          )}
        </div>,
        toolbarPortal.current
      )}
    </div>
  );
}
