import { useState, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { CrmShell } from "@/components/crm/CrmShell";
import { cn } from "@/lib/utils";
import { ArrowUpDown, CalendarDays, ClipboardList, GitBranch, Columns3, Plus, Tag } from "lucide-react";

import { SearchPill } from "@/components/ui/search-pill";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTasks, useCreateTask } from "../api/tasksApi";
import TasksKanbanView from "../components/TasksKanbanView";
import TasksTreeView from "../components/TasksTreeView";
import ProgressChart from "../components/ProgressChart";
import CategorySidebar from "../components/CategorySidebar";
import MobileTaskListCard from "../components/MobileTaskListCard";
import MobileTaskDetailPanel from "../components/MobileTaskDetailPanel";
import MobileTaskCreatePanel from "../components/MobileTaskCreatePanel";
import { useIsMobile } from "@/hooks/useIsMobile";
import {
  SORT_OPTIONS,
  TASK_TAG_PRESETS,
  parseTags,
  sortTasks,
  type SortOption,
  type TaskStatus,
  type Task,
} from "../types";

// ── Expand-on-hover button classes (§28) ─────────────────────────────
const xBase =
  "group inline-flex items-center h-9 pl-[9px] rounded-full border text-[12px] font-medium overflow-hidden shrink-0 transition-[max-width,color,border-color] duration-200 max-w-9";
const xDefault = "border-black/[0.125] dark:border-white/[0.125] text-foreground/60 hover:text-foreground";
const xActive = "border-brand-indigo text-brand-indigo";
const xSpan =
  "whitespace-nowrap pl-1.5 pr-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150";

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

// ── Desktop view mode ────────────────────────────────────────────────
type ViewMode = "kanban" | "tree";

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
  created_desc: "sort.createdDesc",
  created_asc: "sort.createdAsc",
  title_asc: "sort.titleAsc",
  title_desc: "sort.titleDesc",
};

export default function TasksPage() {
  const { t } = useTranslation("tasks");
  const { data: rawTasks } = useTasks();
  const tasks = (rawTasks ?? []) as Task[];
  const createMutation = useCreateTask();
  const isMobile = useIsMobile(768);

  // Persisted state
  const [sort, setSort] = useState<SortOption>(() => loadLocal("tasks-sort", "due_date_asc"));
  const [viewMode, setViewMode] = useState<ViewMode>(() => loadLocal("tasks-view-mode", "kanban"));
  const [catSidebarCollapsed, setCatSidebarCollapsed] = useState<boolean>(() => loadLocal("tasks-cat-sidebar-collapsed", false));
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);

  // Transient state
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTags, setFilterTags] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<DateRange>("all");

  // Mobile tab state
  const [mobileTab, setMobileTab] = useState<TaskStatus>("todo");

  // Mobile detail panel state
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);

  // Mobile create panel state
  const [mobileCreateOpen, setMobileCreateOpen] = useState(false);

  // Setters with persistence
  const handleSort = useCallback((v: SortOption) => {
    setSort(v);
    saveLocal("tasks-sort", v);
  }, []);

  const handleViewMode = useCallback((v: ViewMode) => {
    setViewMode(v);
    saveLocal("tasks-view-mode", v);
  }, []);

  const handleCatSidebarCollapse = useCallback((v: boolean) => {
    setCatSidebarCollapsed(v);
    saveLocal("tasks-cat-sidebar-collapsed", v);
  }, []);

  const toggleFilterTag = useCallback((tag: string) => {
    setFilterTags((prev) =>
      prev.includes(tag) ? prev.filter((x) => x !== tag) : [...prev, tag]
    );
  }, []);

  // Filtered tasks (desktop kanban)
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (!taskInRange(t, dateRange)) return false;
      if (filterTags.length > 0) {
        const taskTags = parseTags((t as any).tags);
        if (!filterTags.some((tag) => taskTags.includes(tag))) return false;
      }
      if (selectedCategoryId !== null && (t as any).categoryId !== selectedCategoryId) return false;
      return true;
    });
  }, [tasks, dateRange, filterTags, selectedCategoryId]);

  // Mobile tasks: filtered + searched + sorted
  const mobileTasks = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
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
  }, [tasks, filterTags, dateRange, searchQuery, sort]);

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
      <button onClick={handleCreate} className={cn(xBase, "hover:max-w-[90px]", xDefault)} title={t("create.title")}>
        <Plus className="h-4 w-4 shrink-0" />
        <span className={xSpan}>{t("toolbar.add")}</span>
      </button>

      <SearchPill
        value={searchQuery}
        onChange={setSearchQuery}
        open={searchOpen}
        onOpenChange={setSearchOpen}
        placeholder={t("page.searchPlaceholder")}
      />

      {/* Sort */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className={cn(xBase, "hover:max-w-[80px]", sort !== "due_date_asc" ? xActive : xDefault)} title={t("toolbar.sort")}>
            <ArrowUpDown className="h-4 w-4 shrink-0" />
            <span className={xSpan}>{t("toolbar.sort")}</span>
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

      {/* Tags filter */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className={cn(xBase, "hover:max-w-[80px]", filterTags.length > 0 ? xActive : xDefault)} title="Filter by tags">
            <Tag className="h-4 w-4 shrink-0" />
            <span className={xSpan}>Tags</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44 max-h-72 overflow-y-auto">
          {TASK_TAG_PRESETS.map((tag) => (
            <DropdownMenuItem
              key={tag}
              onClick={() => toggleFilterTag(tag)}
              className={cn(filterTags.includes(tag) && "font-bold text-brand-indigo")}
            >
              {tag}
            </DropdownMenuItem>
          ))}
          {filterTags.length > 0 && (
            <DropdownMenuItem onClick={() => setFilterTags([])} className="text-red-500 border-t border-border/40 mt-1">
              Clear tags
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Date range filter */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className={cn(xBase, "hover:max-w-[110px]", dateRange !== "all" ? xActive : xDefault)} title="Filter by date">
            <CalendarDays className="h-4 w-4 shrink-0" />
            <span className={xSpan}>
              {DATE_RANGE_OPTIONS.find((o) => o.value === dateRange)?.label ?? "Date"}
            </span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          {DATE_RANGE_OPTIONS.map((o) => (
            <DropdownMenuItem
              key={o.value}
              onClick={() => setDateRange(o.value)}
              className={cn(dateRange === o.value && "font-bold text-brand-indigo")}
            >
              {o.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* View mode toggle (desktop only) */}
      {!isMobile && (
        <>
          <div className="w-px h-5 bg-border/40 mx-0.5 shrink-0" />
          <button
            onClick={() => handleViewMode("kanban")}
            className={cn(xBase, "hover:max-w-[90px]", viewMode === "kanban" ? xActive : xDefault)}
            title="Kanban view"
          >
            <Columns3 className="h-4 w-4 shrink-0" />
            <span className={xSpan}>Kanban</span>
          </button>
          <button
            onClick={() => handleViewMode("tree")}
            className={cn(xBase, "hover:max-w-[80px]", viewMode === "tree" ? xActive : xDefault)}
            title="Tree view"
          >
            <GitBranch className="h-4 w-4 shrink-0" />
            <span className={xSpan}>Tree</span>
          </button>
        </>
      )}
    </>
  );

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <CrmShell>
      <div className="h-full min-h-0 flex overflow-hidden" data-testid="page-tasks">

        {/* Category sidebar — desktop only */}
        {!isMobile && (
          <CategorySidebar
            collapsed={catSidebarCollapsed}
            onCollapse={handleCatSidebarCollapse}
            selectedCategoryId={selectedCategoryId}
            onSelectCategory={setSelectedCategoryId}
            tasks={tasks}
          />
        )}

        {/* Main content */}
        <div className="flex-1 min-w-0 h-full flex flex-col overflow-hidden bg-muted rounded-lg">

        {/* Header: title + toolbar inline */}
        <div className="pl-[17px] pr-3.5 pt-10 pb-3 shrink-0 flex items-center gap-3 overflow-x-auto [scrollbar-width:none] max-w-[1386px] w-full mr-auto">
          <h2 className="text-2xl font-semibold font-heading text-foreground leading-tight">{t("page.title")}</h2>
          <div className="w-px h-5 bg-border/40 mx-0.5 shrink-0" />
          <div className="flex items-center gap-1.5">
            {toolbarButtons}
          </div>
        </div>

        {/* Mobile list view / Desktop kanban board */}
        {isMobile ? (
          /* ── Mobile: 3 tabs (Todo / In Progress / Done) ── */
          <div className="flex-1 min-h-0 relative overflow-hidden flex flex-col">

            {/* Tab bar */}
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

            {/* Task list for active tab */}
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
              {viewMode === "tree" ? (
                <TasksTreeView
                  tasks={filteredTasks}
                  searchQuery={searchQuery}
                />
              ) : (
                <TasksKanbanView
                  tasks={filteredTasks}
                  searchQuery={searchQuery}
                  sort={sort}
                />
              )}
            </div>
          </div>
        )}
        </div>{/* end main content */}
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
  );
}
