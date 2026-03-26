import { useState, useCallback, useMemo, useEffect, useRef, useDeferredValue } from "react";
import { useTranslation } from "react-i18next";
import { CrmShell } from "@/components/crm/CrmShell";
import { cn } from "@/lib/utils";
import { ArrowUpDown, CalendarDays, Check, ClipboardList, Columns3, Filter, FolderOpen, Gauge, Layers, Plus, Settings, Tag } from "lucide-react";
import { usePersistedState } from "@/hooks/usePersistedState";

import { SearchPill } from "@/components/ui/search-pill";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTasks, useCreateTask, useTaskCategories } from "../api/tasksApi";
import TasksKanbanView from "../components/TasksKanbanView";
import TasksTableView from "../components/TasksTableView";
import TasksInlineTable from "../components/TasksInlineTable";
import TasksGanttView from "../components/TasksGanttView";
import ViewSwitcher from "../components/ViewSwitcher";
import ProgressChart from "../components/ProgressChart";
import MobileTaskListCard from "../components/MobileTaskListCard";
import MobileTaskDetailPanel from "../components/MobileTaskDetailPanel";
import MobileTaskCreatePanel from "../components/MobileTaskCreatePanel";
import { useIsMobile } from "@/hooks/useIsMobile";
import {
  SORT_OPTIONS,
  GROUP_OPTIONS,
  TASK_TAG_PRESETS,
  parseTags,
  sortTasks,
  type SortOption,
  type GroupOption,
  type TaskStatus,
  type TaskPriority,
  type Task,
  type ViewMode,
} from "../types";
import { TagVisibilityContext } from "../context/TagVisibilityContext";

// ── Expand-on-hover button classes (§28) ─────────────────────────────
const xBase =
  "group inline-flex items-center h-9 pl-[9px] rounded-full border text-[12px] font-medium overflow-hidden shrink-0 transition-[max-width,color,border-color] duration-200 max-w-9 md:hover:max-w-[200px]";
const xDefault = "border-black/[0.125] dark:border-white/[0.125] text-foreground/60 hover:text-foreground";
const xActive = "border-brand-indigo text-brand-indigo";
// When filter is active, button stays expanded (override max-w and show label)
const xExpanded = "!max-w-[200px]";
const xSpan =
  "whitespace-nowrap pl-1.5 pr-2.5 opacity-0 md:group-hover:opacity-100 transition-opacity duration-150";
const xSpanVisible = "whitespace-nowrap pl-1.5 pr-2.5 opacity-100";

// ── localStorage helpers ─────────────────────────────────────────────
function loadLocal<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
function saveLocal(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

// ── Date range filter ────────────────────────────────────────────────
type DateRange = "all" | "today" | "this_week" | "this_month" | "this_year";

const DATE_RANGE_OPTIONS: { value: DateRange; label: string }[] = [
  { value: "all",        label: "All time" },
  { value: "today",      label: "Today" },
  { value: "this_week",  label: "This week" },
  { value: "this_month", label: "This month" },
  { value: "this_year",  label: "This year" },
];

function matchesDateRange(date: Date, range: DateRange): boolean {
  const now = new Date();
  const sod = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  switch (range) {
    case "today":
      return date >= sod && date < new Date(sod.getTime() + 86_400_000);
    case "this_week": {
      const sw = new Date(sod);
      sw.setDate(sod.getDate() - sod.getDay());
      return date >= sw && date < new Date(sw.getTime() + 7 * 86_400_000);
    }
    case "this_month":
      return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
    case "this_year":
      return date.getFullYear() === now.getFullYear();
    default:
      return true;
  }
}

function taskInRange(task: Task, range: DateRange): boolean {
  if (range === "all") return true;
  const raw = task.dueDate ?? task.createdAt;
  if (!raw) return true;
  return matchesDateRange(new Date(raw), range);
}

// ── Sort key map ─────────────────────────────────────────────────────
const SORT_KEYS: Record<string, string> = {
  due_date_asc: "sort.dueDateAsc",
  due_date_desc: "sort.dueDateDesc",
  priority_desc: "sort.priorityDesc",
  priority_asc: "sort.priorityAsc",
  category_asc: "sort.categoryAsc",
  category_desc: "sort.categoryDesc",
  id_asc: "sort.idAsc",
  id_desc: "sort.idDesc",
  created_desc: "sort.createdDesc",
  created_asc: "sort.createdAsc",
  title_asc: "sort.titleAsc",
  title_desc: "sort.titleDesc",
};

const GROUP_KEYS: Record<string, string> = {
  none: "groupBy.none",
  status: "groupBy.status",
  priority: "groupBy.priority",
  taskType: "groupBy.type",
  category: "groupBy.category",
  assigneeName: "groupBy.assignee",
  accountName: "groupBy.account",
};

// ── Status filter labels ─────────────────────────────────────────────
const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: "todo",        label: "To Do" },
  { value: "in_progress", label: "In Progress" },
  { value: "done",        label: "Done" },
];

const PRIORITY_OPTIONS: { value: TaskPriority; label: string }[] = [
  { value: "urgent", label: "Urgent" },
  { value: "high",   label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low",    label: "Low" },
];

export default function TasksPage() {
  const { t } = useTranslation("tasks");
  const { data: rawTasks } = useTasks();
  const tasks = (rawTasks ?? []) as Task[];
  const createMutation = useCreateTask();
  const isMobile = useIsMobile(768);
  const { data: categories = [] } = useTaskCategories();
  const ganttToolbarRef = useRef<HTMLDivElement>(null);

  // Persisted state (viewMode first: other states reference it for per-view keys)
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const stored = loadLocal<string>("tasks-view-mode", "kanban");
    if (stored === "tree") return "gantt";
    return stored as ViewMode;
  });
  const [sort, setSort] = useState<SortOption>(() => loadLocal(`tasks-${viewMode}-sort`, "due_date_asc"));
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [showTags, setShowTags] = useState<boolean>(() => loadLocal("tasks-show-tags", true));
  const [tableGroupBy, setTableGroupBy] = useState<GroupOption>(() => loadLocal("tasks-table-group", "category"));

  // ── Table column visibility (persisted) ──────────────────────────────────
  const TABLE_COL_META = useMemo(() => [
    { key: "title",        label: t("columns.title"),        defaultVisible: true  },
    { key: "status",       label: t("columns.status"),       defaultVisible: true  },
    { key: "priority",     label: t("columns.priority"),     defaultVisible: true  },
    { key: "category",     label: t("columns.category"),     defaultVisible: true  },
    { key: "tags",         label: t("columns.tags"),         defaultVisible: true  },
    { key: "taskType",     label: t("columns.type"),         defaultVisible: true  },
    { key: "timeEstimate", label: t("columns.timeEstimate"), defaultVisible: true  },
    { key: "parentTask",   label: t("columns.parentTask"),   defaultVisible: true  },
    { key: "dueDate",      label: t("columns.due"),          defaultVisible: true  },
    { key: "createdAt",    label: t("columns.created"),      defaultVisible: true  },
    { key: "description",  label: t("columns.description"),  defaultVisible: false },
    { key: "assignee",     label: t("columns.assignee"),     defaultVisible: false },
    { key: "account",      label: t("columns.account"),      defaultVisible: false },
  ], [t]);

  const DEFAULT_VISIBLE_COLS = useMemo(() => TABLE_COL_META.filter(c => c.defaultVisible).map(c => c.key), [TABLE_COL_META]);

  const [visibleCols, setVisibleCols] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem("tasks-table-visible-cols");
      if (stored) { const arr = JSON.parse(stored); if (Array.isArray(arr) && arr.length > 0) return new Set(arr); }
    } catch {}
    return new Set(TABLE_COL_META.filter(c => c.defaultVisible).map(c => c.key));
  });

  useEffect(() => {
    try { localStorage.setItem("tasks-table-visible-cols", JSON.stringify(Array.from(visibleCols))); } catch {}
  }, [visibleCols]);

  // ── Column order persistence ──────────────────────────────────────────
  const [columnOrder, setColumnOrder] = useState<string[]>(() => {
    try { const stored = localStorage.getItem("tasks-column-order"); if (stored) return JSON.parse(stored); } catch {}
    return [];
  });
  useEffect(() => { try { localStorage.setItem("tasks-column-order", JSON.stringify(columnOrder)); } catch {} }, [columnOrder]);

  // ── Column widths persistence ─────────────────────────────────────────
  const [columnWidths, setColumnWidths] = usePersistedState<Record<string, number>>("tasks-column-widths", {});

  // ── Settings toggles ──────────────────────────────────────────────────
  const [showVerticalLines, setShowVerticalLines] = useState(() => {
    try { return localStorage.getItem("tasks-vertical-lines") === "true"; } catch { return false; }
  });
  useEffect(() => { try { localStorage.setItem("tasks-vertical-lines", String(showVerticalLines)); } catch {} }, [showVerticalLines]);

  // ── Multi-select state ────────────────────────────────────────────────
  const [tableSelectedIds, setTableSelectedIds] = useState<Set<number>>(new Set());

  // Transient state
  const [searchOpen, setSearchOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearch = useDeferredValue(searchQuery);
  const [filterTags, setFilterTags] = useState<string[]>(() => loadLocal<string[]>(`tasks-${viewMode}-filter-tags`, []));
  const [filterStatuses, setFilterStatuses] = useState<TaskStatus[]>(() => loadLocal<TaskStatus[]>(`tasks-${viewMode}-filter-statuses`, viewMode === "kanban" ? [] : ["todo", "in_progress"]));
  const [filterPriorities, setFilterPriorities] = useState<TaskPriority[]>(() => loadLocal<TaskPriority[]>(`tasks-${viewMode}-filter-priorities`, []));
  const [dateRange, setDateRange] = useState<DateRange>(() => loadLocal<DateRange>(`tasks-${viewMode}-filter-daterange`, "all"));
  const [kanbanLeafOnly, setKanbanLeafOnly] = useState<boolean>(() => loadLocal("tasks-kanban-leaf-only", true));
  const [ganttMaxDepth, setGanttMaxDepth] = useState<number | null>(() => loadLocal<number | null>("tasks-gantt-maxdepth", null));
  const [ganttGroupBy, setGanttGroupBy] = useState<"hierarchy" | "status" | "priority">(() => loadLocal<"hierarchy" | "status" | "priority">("tasks-gantt-groupby", "hierarchy"));

  // Mobile tab state
  const [mobileTab, setMobileTab] = useState<TaskStatus>("todo");

  // Mobile detail panel state
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);

  // Mobile create panel state
  const [mobileCreateOpen, setMobileCreateOpen] = useState(false);

  // Desktop detail panel state (for table views)
  const [desktopSelectedTaskId, setDesktopSelectedTaskId] = useState<number | null>(null);

  // ── Per-view filter reload (each view keeps its own filters) ────────
  const prevViewRef = useRef(viewMode);
  useEffect(() => {
    if (prevViewRef.current === viewMode) return;
    prevViewRef.current = viewMode;
    setSort(loadLocal(`tasks-${viewMode}-sort`, "due_date_asc"));
    setFilterStatuses(loadLocal(`tasks-${viewMode}-filter-statuses`, viewMode === "kanban" ? [] : ["todo", "in_progress"]));
    setFilterPriorities(loadLocal(`tasks-${viewMode}-filter-priorities`, []));
    setFilterTags(loadLocal(`tasks-${viewMode}-filter-tags`, []));
    setDateRange(loadLocal(`tasks-${viewMode}-filter-daterange`, "all"));
  }, [viewMode]);

  // ── Task depth map (for L3+ kanban filter) ────────────────────────────
  const taskDepthMap = useMemo(() => {
    const parentMap = new Map(tasks.map(t => [t.id, t.parentTaskId]));
    const depths = new Map<number, number>();
    function getDepth(id: number): number {
      if (depths.has(id)) return depths.get(id)!;
      const pid = parentMap.get(id);
      if (!pid) { depths.set(id, 1); return 1; }
      const d = getDepth(pid) + 1;
      depths.set(id, d);
      return d;
    }
    for (const t of tasks) getDepth(t.id);
    return depths;
  }, [tasks]);

  // Setters with persistence (per-view keys)
  const handleSort = useCallback((v: SortOption) => {
    setSort(v);
    saveLocal(`tasks-${viewMode}-sort`, v);
  }, [viewMode]);

  const handleViewMode = useCallback((v: ViewMode) => {
    setViewMode(v);
    saveLocal("tasks-view-mode", v);
  }, []);

  const handleToggleTags = useCallback(() => {
    setShowTags((prev) => {
      const next = !prev;
      saveLocal("tasks-show-tags", next);
      return next;
    });
  }, []);

  const handleTableGroupBy = useCallback((v: GroupOption) => {
    setTableGroupBy(v);
    saveLocal("tasks-table-group", v);
  }, []);

  const toggleFilterTag = useCallback((tag: string) => {
    setFilterTags((prev) => {
      const next = prev.includes(tag) ? prev.filter((x) => x !== tag) : [...prev, tag];
      saveLocal(`tasks-${viewMode}-filter-tags`, next);
      return next;
    });
  }, [viewMode]);

  const toggleFilterStatus = useCallback((status: TaskStatus) => {
    setFilterStatuses((prev) => {
      const next = prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status];
      saveLocal(`tasks-${viewMode}-filter-statuses`, next);
      return next;
    });
  }, [viewMode]);

  const toggleFilterPriority = useCallback((priority: TaskPriority) => {
    setFilterPriorities((prev) => {
      const next = prev.includes(priority) ? prev.filter((p) => p !== priority) : [...prev, priority];
      saveLocal(`tasks-${viewMode}-filter-priorities`, next);
      return next;
    });
  }, [viewMode]);

  const handleSetFilterStatuses = useCallback((v: TaskStatus[]) => {
    setFilterStatuses(v);
    saveLocal(`tasks-${viewMode}-filter-statuses`, v);
  }, [viewMode]);

  const handleSetFilterPriorities = useCallback((v: TaskPriority[]) => {
    setFilterPriorities(v);
    saveLocal(`tasks-${viewMode}-filter-priorities`, v);
  }, [viewMode]);

  const handleSetFilterTags = useCallback((v: string[]) => {
    setFilterTags(v);
    saveLocal(`tasks-${viewMode}-filter-tags`, v);
  }, [viewMode]);

  const handleSetDateRange = useCallback((v: DateRange) => {
    setDateRange(v);
    saveLocal(`tasks-${viewMode}-filter-daterange`, v);
  }, [viewMode]);

  const handleKanbanLeafOnly = useCallback(() => {
    setKanbanLeafOnly(prev => {
      const next = !prev;
      saveLocal("tasks-kanban-leaf-only", next);
      return next;
    });
  }, []);

  const handleSetGanttMaxDepth = useCallback((v: number | null) => {
    setGanttMaxDepth(v);
    saveLocal("tasks-gantt-maxdepth", v);
  }, []);

  const handleSetGanttGroupBy = useCallback((v: "hierarchy" | "status" | "priority") => {
    setGanttGroupBy(v);
    saveLocal("tasks-gantt-groupby", v);
  }, []);

  // Filtered tasks (desktop kanban)
  const filteredTasks = useMemo(() => {
    let result = tasks.filter((t) => {
      if (!taskInRange(t, dateRange)) return false;
      if (filterTags.length > 0) {
        const taskTags = parseTags((t as any).tags);
        if (!filterTags.some((tag) => taskTags.includes(tag))) return false;
      }
      if (selectedCategoryId !== null && (t as any).categoryId !== selectedCategoryId) return false;
      if (filterStatuses.length > 0 && !filterStatuses.includes(t.status as TaskStatus)) return false;
      if (filterPriorities.length > 0 && !filterPriorities.includes((t.priority ?? "medium") as TaskPriority)) return false;
      return true;
    });

    // For gantt view: preserve tree structure by including ancestors of filtered tasks
    const hasAnyFilter = selectedCategoryId !== null || filterStatuses.length > 0 || filterTags.length > 0 || filterPriorities.length > 0;
    if (viewMode === "gantt" && hasAnyFilter) {
      const filteredIds = new Set(result.map((t) => t.id));
      // Walk up the parent chain for every matched task so the tree stays connected
      const taskMap = new Map(tasks.map((t) => [t.id, t]));
      for (const t of [...result]) {
        let current = t;
        while (current.parentTaskId && !filteredIds.has(current.parentTaskId)) {
          const parent = taskMap.get(current.parentTaskId);
          if (!parent) break;
          result.push(parent);
          filteredIds.add(parent.id);
          current = parent;
        }
      }
    }

    // Kanban L3+ filter: only show actionable (leaf-level) tasks
    if (viewMode === "kanban" && kanbanLeafOnly) {
      result = result.filter(t => (taskDepthMap.get(t.id) ?? 1) >= 3);
    }

    return result;
  }, [tasks, dateRange, filterTags, selectedCategoryId, filterStatuses, filterPriorities, viewMode, kanbanLeafOnly, taskDepthMap]);

  // Mobile tasks: filtered + searched + sorted
  const mobileTasks = useMemo(() => {
    const q = deferredSearch.toLowerCase().trim();
    const rangeFiltered = tasks.filter((t) => taskInRange(t, dateRange));
    const tagFiltered = filterTags.length
      ? rangeFiltered.filter((t) => {
          const taskTags = parseTags((t as any).tags);
          return filterTags.some((tag) => taskTags.includes(tag));
        })
      : rangeFiltered;
    const searched = q
      ? tagFiltered.filter(
          (t) =>
            t.title?.toLowerCase().includes(q) ||
            t.description?.toLowerCase().includes(q) ||
            t.leadName?.toLowerCase().includes(q) ||
            t.accountName?.toLowerCase().includes(q)
        )
      : tagFiltered;
    return sortTasks(searched, sort);
  }, [tasks, filterTags, dateRange, deferredSearch, sort]);

  // Mobile: tasks filtered to the active tab
  const tabTasks = useMemo(
    () => mobileTasks.filter((t) => t.status === mobileTab),
    [mobileTasks, mobileTab]
  );

  // Mobile tab definitions
  const MOBILE_TABS: { key: TaskStatus; label: string }[] = [
    { key: "todo",        label: t("status.todo") },
    { key: "in_progress", label: t("status.inProgress") },
    { key: "done",        label: t("status.done") },
  ];

  const handleCreate = useCallback(async () => {
    if (isMobile) {
      setMobileCreateOpen(true);
      return;
    }
    if (createMutation.isPending) return;
    const acctId = parseInt(localStorage.getItem("leadawaker_current_account_id") ?? "1", 10);
    try {
      await createMutation.mutateAsync({
        title: t("card.newTask"),
        description: null,
        accountsId: acctId,
        accountName: "",
        campaignName: null,
        leadName: null,
        status: "todo",
        priority: "medium",
        taskType: "admin",
        dueDate: null,
        assigneeName: null,
      });
    } catch { /* mutation error handled by TanStack */ }
  }, [isMobile, createMutation, t]);

  // ── Toolbar ─────────────────────────────────────────────────────────
  const toolbarButtons = (
    <>
      {/* 1. Add */}
      <button onClick={handleCreate} className={cn(xBase, "md:hover:max-w-[90px]", xDefault)} title={t("create.title")}>
        <Plus className="h-4 w-4 shrink-0" />
        <span className={xSpan}>{t("toolbar.add")}</span>
      </button>

      {/* 2. Search */}
      <SearchPill
        value={searchQuery}
        onChange={setSearchQuery}
        open={searchOpen}
        onOpenChange={setSearchOpen}
        placeholder={t("page.searchPlaceholder")}
      />

      {/* 3. Status filter */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className={cn(xBase, "md:hover:max-w-[140px]", filterStatuses.length > 0 ? [xActive, xExpanded] : xDefault)} title="Status">
            <Filter className="h-4 w-4 shrink-0" />
            <span className={filterStatuses.length > 0 ? xSpanVisible : xSpan}>
              {filterStatuses.length > 0
                ? filterStatuses.map((s) => STATUS_OPTIONS.find((o) => o.value === s)?.label ?? s).join(", ")
                : "Status"}
            </span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onClick={() => handleSetFilterStatuses([])} className={cn(filterStatuses.length === 0 && "font-bold text-brand-indigo")}>All statuses</DropdownMenuItem>
          {STATUS_OPTIONS.map((o) => (
            <DropdownMenuItem key={o.value} onClick={() => toggleFilterStatus(o.value)} className={cn(filterStatuses.includes(o.value) && "font-bold text-brand-indigo")}>{o.label}</DropdownMenuItem>
          ))}
          {filterStatuses.length > 0 && <DropdownMenuItem onClick={() => handleSetFilterStatuses([])} className="text-red-500 border-t border-border/40 mt-1">Clear</DropdownMenuItem>}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* 4. Priority filter */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className={cn(xBase, "md:hover:max-w-[140px]", filterPriorities.length > 0 ? [xActive, xExpanded] : xDefault)} title="Priority">
            <Gauge className="h-4 w-4 shrink-0" />
            <span className={filterPriorities.length > 0 ? xSpanVisible : xSpan}>
              {filterPriorities.length > 0
                ? filterPriorities.map((p) => PRIORITY_OPTIONS.find((o) => o.value === p)?.label ?? p).join(", ")
                : "Priority"}
            </span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onClick={() => handleSetFilterPriorities([])} className={cn(filterPriorities.length === 0 && "font-bold text-brand-indigo")}>All priorities</DropdownMenuItem>
          {PRIORITY_OPTIONS.map((o) => (
            <DropdownMenuItem key={o.value} onClick={() => toggleFilterPriority(o.value)} className={cn(filterPriorities.includes(o.value) && "font-bold text-brand-indigo")}>{o.label}</DropdownMenuItem>
          ))}
          {filterPriorities.length > 0 && <DropdownMenuItem onClick={() => handleSetFilterPriorities([])} className="text-red-500 border-t border-border/40 mt-1">Clear</DropdownMenuItem>}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* 5. Category filter */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className={cn(xBase, "md:hover:max-w-[160px]", selectedCategoryId !== null ? [xActive, xExpanded] : xDefault)} title="Category">
            <FolderOpen className="h-4 w-4 shrink-0" />
            <span className={selectedCategoryId !== null ? xSpanVisible : xSpan}>
              {selectedCategoryId !== null
                ? (categories.find((c: any) => c.id === selectedCategoryId) as any)?.name ?? "Category"
                : "Category"}
            </span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48 max-h-72 overflow-y-auto">
          <DropdownMenuItem onClick={() => setSelectedCategoryId(null)} className={cn(selectedCategoryId === null && "font-bold text-brand-indigo")}>All</DropdownMenuItem>
          {categories.map((cat: any) => (
            <DropdownMenuItem key={cat.id} onClick={() => setSelectedCategoryId(cat.id)} className={cn(selectedCategoryId === cat.id && "font-bold text-brand-indigo")}>{cat.name}</DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* 6. Tags filter */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className={cn(xBase, "md:hover:max-w-[140px]", filterTags.length > 0 ? [xActive, xExpanded] : xDefault)} title="Tags">
            <Tag className="h-4 w-4 shrink-0" />
            <span className={filterTags.length > 0 ? xSpanVisible : xSpan}>
              {filterTags.length > 0 ? filterTags.join(", ") : "Tags"}
            </span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44 max-h-72 overflow-y-auto">
          {TASK_TAG_PRESETS.map((tag) => (
            <DropdownMenuItem key={tag} onClick={() => toggleFilterTag(tag)} className={cn(filterTags.includes(tag) && "font-bold text-brand-indigo")}>{tag}</DropdownMenuItem>
          ))}
          {filterTags.length > 0 && <DropdownMenuItem onClick={() => handleSetFilterTags([])} className="text-red-500 border-t border-border/40 mt-1">Clear</DropdownMenuItem>}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* 7a. L3+ filter (kanban only) */}
      {viewMode === "kanban" && (
        <button
          onClick={handleKanbanLeafOnly}
          className={cn(xBase, "md:hover:max-w-[100px]", kanbanLeafOnly ? [xActive, xExpanded] : xDefault)}
          title="Show only actionable tasks (L3+)"
        >
          <Layers className="h-4 w-4 shrink-0" />
          <span className={kanbanLeafOnly ? xSpanVisible : xSpan}>
            {kanbanLeafOnly ? "L3+" : "All levels"}
          </span>
        </button>
      )}

      {/* 7b. Levels filter (gantt only) */}
      {viewMode === "gantt" && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className={cn(xBase, "md:hover:max-w-[100px]", ganttMaxDepth !== null ? [xActive, xExpanded] : xDefault)} title="Levels">
              <Layers className="h-4 w-4 shrink-0" />
              <span className={ganttMaxDepth !== null ? xSpanVisible : xSpan}>
                {ganttMaxDepth !== null ? `L${ganttMaxDepth}` : "Levels"}
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-36">
            <DropdownMenuItem onClick={() => handleSetGanttMaxDepth(null)} className={cn(ganttMaxDepth === null && "font-bold text-brand-indigo")}>All levels</DropdownMenuItem>
            {[1, 2, 3, 4, 5].map((lvl) => (
              <DropdownMenuItem key={lvl} onClick={() => handleSetGanttMaxDepth(lvl)} className={cn(ganttMaxDepth === lvl && "font-bold text-brand-indigo")}>Up to L{lvl}</DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* 8. Sort */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className={cn(xBase, "md:hover:max-w-[160px]", sort !== "due_date_asc" ? [xActive, xExpanded] : xDefault)} title={t("toolbar.sort")}>
            <ArrowUpDown className="h-4 w-4 shrink-0" />
            <span className={sort !== "due_date_asc" ? xSpanVisible : xSpan}>
              {sort !== "due_date_asc" ? t(SORT_KEYS[sort] ?? "Sort") : t("toolbar.sort")}
            </span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {SORT_OPTIONS.map((o) => (
            <DropdownMenuItem key={o.value} onClick={() => handleSort(o.value)} className={cn(sort === o.value && "font-bold text-brand-indigo")}>
              {t(SORT_KEYS[o.value] ?? o.label)}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* 5. Date range filter */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className={cn(xBase, "md:hover:max-w-[140px]", dateRange !== "all" ? [xActive, xExpanded] : xDefault)} title="Filter by date">
            <CalendarDays className="h-4 w-4 shrink-0" />
            <span className={dateRange !== "all" ? xSpanVisible : xSpan}>
              {DATE_RANGE_OPTIONS.find((o) => o.value === dateRange)?.label ?? "Date"}
            </span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          {DATE_RANGE_OPTIONS.map((o) => (
            <DropdownMenuItem
              key={o.value}
              onClick={() => handleSetDateRange(o.value)}
              className={cn(dateRange === o.value && "font-bold text-brand-indigo")}
            >
              {o.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* 9. Group-by (table view only) */}
      {!isMobile && viewMode === "table" && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className={cn(xBase, "md:hover:max-w-[90px]", tableGroupBy !== "none" ? xActive : xDefault)} title={t("toolbar.groupBy")}>
              <Layers className="h-4 w-4 shrink-0" />
              <span className={xSpan}>{t("toolbar.groupBy")}</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            {GROUP_OPTIONS.map((o) => (
              <DropdownMenuItem
                key={o.value}
                onClick={() => handleTableGroupBy(o.value)}
                className={cn(tableGroupBy === o.value && "font-bold text-brand-indigo")}
              >
                {t(GROUP_KEYS[o.value] ?? o.label)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* 10. Fields (column visibility — table view only) */}
      {!isMobile && viewMode === "table" && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className={cn(xBase, "md:hover:max-w-[90px]", xDefault)} title="Fields">
              <Columns3 className="h-4 w-4 shrink-0" />
              <span className={xSpan}>Fields</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 max-h-72 overflow-y-auto">
            {TABLE_COL_META.map((col) => {
              const isVisible = visibleCols.has(col.key);
              return (
                <DropdownMenuItem
                  key={col.key}
                  onClick={(e) => {
                    e.preventDefault();
                    setVisibleCols((prev) => {
                      const next = new Set(prev);
                      if (next.has(col.key)) next.delete(col.key); else next.add(col.key);
                      return next;
                    });
                  }}
                  className="flex items-center gap-2 text-[12px]"
                >
                  <div className={cn("h-3.5 w-3.5 rounded border flex items-center justify-center shrink-0", isVisible ? "bg-brand-indigo border-brand-indigo" : "border-border/50")}>
                    {isVisible && <Check className="h-2 w-2 text-white" />}
                  </div>
                  {col.label}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* 11. Settings (table view only) */}
      {!isMobile && viewMode === "table" && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className={cn(xBase, "md:hover:max-w-[100px]", xDefault)} title="Settings">
              <Settings className="h-4 w-4 shrink-0" />
              <span className={xSpan}>Settings</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem onClick={(e) => { e.preventDefault(); setShowVerticalLines(!showVerticalLines); }} className="flex items-center gap-2 text-[12px]">
              <div className={cn("h-3.5 w-3.5 rounded border flex items-center justify-center shrink-0", showVerticalLines ? "bg-brand-indigo border-brand-indigo" : "border-border/50")}>
                {showVerticalLines && <Check className="h-2 w-2 text-white" />}
              </div>
              Vertical lines
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => { setColumnWidths({}); setColumnOrder([]); }}
              className="text-[12px] text-muted-foreground"
            >
              Reset column widths
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setVisibleCols(new Set(DEFAULT_VISIBLE_COLS))}
              className="text-[12px] text-muted-foreground"
            >
              Reset visible columns
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </>
  );

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <TagVisibilityContext.Provider value={showTags}>
    <CrmShell>
      <div className="h-full min-h-0 flex flex-col overflow-hidden bg-muted rounded-lg" data-testid="page-tasks">

        {/* Header: title + view switcher + toolbar */}
        <div className="pl-[17px] pr-3.5 pt-4 md:pt-10 pb-3 shrink-0 flex items-center gap-3 max-w-[1386px] w-full mr-auto">
          {/* Left section: title + toolbar (scrolls horizontally if needed) */}
          <div className="flex-1 min-w-0 flex items-center gap-3 overflow-x-auto [scrollbar-width:none]">
            <h2 className="text-2xl font-semibold font-heading text-foreground shrink-0">{t("page.title")}</h2>
            {!isMobile && <ViewSwitcher value={viewMode} onChange={handleViewMode} />}
            <div className="w-px h-5 bg-border/40 mx-0.5 shrink-0" />
            <div className="flex items-center gap-1.5">
              {toolbarButtons}
            </div>
          </div>
          {/* Right section: gantt controls (always visible at right edge) */}
          {viewMode === "gantt" && (
            <div ref={ganttToolbarRef} className="flex items-center gap-1 shrink-0" />
          )}
        </div>

        {/* Mobile list view / Desktop kanban board */}
        {isMobile ? (
          /* ── Mobile: view switcher + content ── */
          <div className="flex-1 min-h-0 relative overflow-hidden flex flex-col">

            {/* Mobile view switcher */}
            <div className="shrink-0 border-b border-border/30 bg-background/40 dark:bg-white/[0.02]">
              <ViewSwitcher value={viewMode} onChange={handleViewMode} compact />
            </div>

            {/* Status tab bar (only for kanban view) */}
            {viewMode === "kanban" && (
              <div className="flex gap-1 px-3 pt-2 pb-1.5 shrink-0">
                {MOBILE_TABS.map((tab) => {
                  const count = mobileTasks.filter((t) => t.status === tab.key).length;
                  const isActive = mobileTab === tab.key;
                  return (
                    <button
                      key={tab.key}
                      onClick={() => setMobileTab(tab.key)}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-1.5 h-9 rounded-xl text-[13px] font-medium transition-all duration-150",
                        isActive
                          ? tab.key === "in_progress"
                            ? "bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300"
                            : tab.key === "done"
                            ? "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
                            : "bg-foreground/10 text-foreground"
                          : "text-muted-foreground hover:bg-muted/50"
                      )}
                    >
                      {tab.label}
                      {count > 0 && (
                        <span className="text-[11px] tabular-nums opacity-60">
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Mobile content based on view mode */}
            {viewMode === "kanban" ? (
              /* Card list grouped by status tab */
              <div className="flex-1 overflow-y-auto px-3 pb-20 flex flex-col gap-2" data-testid="mobile-tasks-list">
                {tabTasks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center flex-1 gap-2 text-muted-foreground py-16">
                    <ClipboardList className="h-8 w-8 opacity-30" />
                    <p className="text-sm font-medium">{t("page.noTasksFound")}</p>
                  </div>
                ) : (
                  tabTasks.map((task) => (
                    <MobileTaskListCard
                      key={task.id}
                      task={task}
                      onClick={() => setSelectedTaskId(task.id)}
                    />
                  ))
                )}
              </div>
            ) : viewMode === "table" ? (
              <div className="flex-1 min-h-0 overflow-hidden pb-16">
                <TasksInlineTable
                  tasks={filteredTasks}
                  searchQuery={deferredSearch}
                  sort={sort}
                  groupBy="none"
                  onSelectTask={(id) => setSelectedTaskId(id)}
                  selectedTaskId={selectedTaskId}
                  visibleCols={visibleCols}
                  selectedIds={tableSelectedIds}
                  onSelectionChange={setTableSelectedIds}
                  columnOrder={columnOrder}
                  onColumnOrderChange={setColumnOrder}
                  columnWidths={columnWidths}
                  onColumnWidthsChange={setColumnWidths}
                  showVerticalLines={showVerticalLines}
                />
              </div>
            ) : viewMode === "gantt" ? (
              <div className="flex-1 min-h-0 overflow-hidden pb-16">
                <TasksGanttView
                  tasks={filteredTasks}
                  searchQuery={deferredSearch}
                  onTaskClick={(id) => setSelectedTaskId(id)}
                  maxDepth={ganttMaxDepth}
                  groupBy={ganttGroupBy}
                  onGroupByChange={handleSetGanttGroupBy}
                />
              </div>
            ) : null}

            {/* Mobile FAB — New Task */}
            <button
              onClick={() => setMobileCreateOpen(true)}
              className="absolute bottom-4 right-4 h-12 w-12 rounded-full bg-brand-indigo text-white shadow-lg flex items-center justify-center active:scale-95 transition-transform z-10"
              aria-label="New Task"
              data-testid="mobile-new-task-btn"
            >
              <Plus className="h-5 w-5" />
            </button>
          </div>
        ) : (
          /* ── Desktop: view area ── */
          <div className="flex-1 min-h-0 overflow-hidden p-[6px] pt-0 flex flex-col">
            {viewMode === "kanban" && (
              <div className="shrink-0 px-2 pt-1">
                <ProgressChart />
              </div>
            )}
            <div className="flex-1 min-h-0 overflow-hidden">
              {viewMode === "kanban" && (
                <TasksKanbanView
                  tasks={filteredTasks}
                  searchQuery={deferredSearch}
                  sort={sort}
                />
              )}
              {viewMode === "table" && (
                <TasksInlineTable
                  tasks={filteredTasks}
                  searchQuery={deferredSearch}
                  sort={sort}
                  groupBy={tableGroupBy}
                  onSelectTask={setDesktopSelectedTaskId}
                  selectedTaskId={desktopSelectedTaskId}
                  visibleCols={visibleCols}
                  selectedIds={tableSelectedIds}
                  onSelectionChange={setTableSelectedIds}
                  columnOrder={columnOrder}
                  onColumnOrderChange={setColumnOrder}
                  columnWidths={columnWidths}
                  onColumnWidthsChange={setColumnWidths}
                  showVerticalLines={showVerticalLines}
                />
              )}
              {viewMode === "gantt" && (
                <TasksGanttView
                  tasks={filteredTasks}
                  searchQuery={deferredSearch}
                  onTaskClick={setDesktopSelectedTaskId}
                  toolbarPortal={ganttToolbarRef}
                  maxDepth={ganttMaxDepth}
                  groupBy={ganttGroupBy}
                  onGroupByChange={handleSetGanttGroupBy}
                />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Mobile full-screen task detail panel */}
      {isMobile && selectedTaskId !== null && (
        <MobileTaskDetailPanel
          taskId={selectedTaskId}
          onBack={() => setSelectedTaskId(null)}
        />
      )}

      {/* Mobile full-screen task create panel */}
      {isMobile && mobileCreateOpen && (
        <MobileTaskCreatePanel
          onClose={() => setMobileCreateOpen(false)}
          onCreated={(id) => {
            setMobileCreateOpen(false);
            setSelectedTaskId(id);
          }}
        />
      )}
    </CrmShell>
    </TagVisibilityContext.Provider>
  );
}
