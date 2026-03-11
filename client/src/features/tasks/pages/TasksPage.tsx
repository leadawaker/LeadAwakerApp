import { useState, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { CrmShell } from "@/components/crm/CrmShell";
import { cn } from "@/lib/utils";
import { ArrowUpDown, ClipboardList, Filter, Plus } from "lucide-react";

import { SearchPill } from "@/components/ui/search-pill";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTasks, useCreateTask } from "../api/tasksApi";
import TasksKanbanView from "../components/TasksKanbanView";
import MobileTaskListCard from "../components/MobileTaskListCard";
import MobileTaskDetailPanel from "../components/MobileTaskDetailPanel";
import MobileTaskCreatePanel from "../components/MobileTaskCreatePanel";
import { useIsMobile } from "@/hooks/useIsMobile";
import {
  SORT_OPTIONS,
  STATUS_OPTIONS,
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

// ── Component ────────────────────────────────────────────────────────
// Map sort option values to translation keys
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

// Map status option values to translation keys
const STATUS_KEYS: Record<string, string> = {
  todo: "status.todo",
  in_progress: "status.inProgress",
  done: "status.done",
  cancelled: "status.cancelled",
};

export default function TasksPage() {
  const { t } = useTranslation("tasks");
  const { data: rawTasks } = useTasks();
  const tasks = (rawTasks ?? []) as Task[];
  const createMutation = useCreateTask();
  const isMobile = useIsMobile(768);

  // Persisted state
  const [sort, setSort] = useState<SortOption>(() => loadLocal("tasks-sort", "due_date_asc"));

  // Transient state
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<TaskStatus[]>([]);

  // Mobile detail panel state
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);

  // Mobile create panel state
  const [mobileCreateOpen, setMobileCreateOpen] = useState(false);

  // Setters with persistence
  const handleSort = useCallback((v: SortOption) => {
    setSort(v);
    saveLocal("tasks-sort", v);
  }, []);

  const toggleFilterStatus = useCallback((s: TaskStatus) => {
    setFilterStatus((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  }, []);

  // Filtered tasks (for desktop kanban)
  const filteredTasks = filterStatus.length
    ? tasks.filter((t) => filterStatus.includes(t.status as TaskStatus))
    : tasks;

  // Mobile tasks: filtered + searched + sorted
  const mobileTasks = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const statusFiltered = filterStatus.length
      ? tasks.filter((t) => filterStatus.includes(t.status as TaskStatus))
      : tasks;
    const searched = q
      ? statusFiltered.filter(
          (t) =>
            t.title?.toLowerCase().includes(q) ||
            t.description?.toLowerCase().includes(q) ||
            t.leadName?.toLowerCase().includes(q) ||
            t.accountName?.toLowerCase().includes(q)
        )
      : statusFiltered;
    return sortTasks(searched, sort);
  }, [tasks, filterStatus, searchQuery, sort]);

  const handleCreate = useCallback(async () => {
    // On mobile, open the full-screen create form instead of silently creating
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

      {/* Filter */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className={cn(xBase, "hover:max-w-[100px]", filterStatus.length > 0 ? xActive : xDefault)} title={t("toolbar.filter")}>
            <Filter className="h-4 w-4 shrink-0" />
            <span className={xSpan}>{t("toolbar.filter")}</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          {STATUS_OPTIONS.map((o) => (
            <DropdownMenuItem key={o.value} onClick={() => toggleFilterStatus(o.value)} className={cn(filterStatus.includes(o.value) && "font-bold text-brand-indigo")}>
              {t(STATUS_KEYS[o.value] ?? o.label)}
            </DropdownMenuItem>
          ))}
          {filterStatus.length > 0 && (
            <DropdownMenuItem onClick={() => setFilterStatus([])} className="text-red-500">{t("toolbar.clearFilters")}</DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

    </>
  );

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <CrmShell>
      <div className="h-full min-h-0 flex flex-col overflow-hidden bg-muted rounded-lg" data-testid="page-tasks">

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
          /* ── Mobile: vertical scrollable task list ── */
          <div className="flex-1 min-h-0 relative overflow-hidden flex flex-col">
            <div className="flex-1 overflow-y-auto px-3 pb-20 flex flex-col gap-2" data-testid="mobile-tasks-list">
              {mobileTasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center flex-1 gap-2 text-muted-foreground py-16">
                  <ClipboardList className="h-8 w-8 opacity-30" />
                  <p className="text-sm font-medium">{t("page.noTasksFound")}</p>
                </div>
              ) : (
                mobileTasks.map((task) => (
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
          /* ── Desktop: kanban board (unchanged) ── */
          <div className="flex-1 min-h-0 overflow-hidden p-[6px] pt-0">
            <TasksKanbanView
              tasks={filteredTasks}
              searchQuery={searchQuery}
              sort={sort}
            />
          </div>
        )}
      </div>

      {/* Mobile full-screen task detail panel (portal → document.body) */}
      {isMobile && selectedTaskId !== null && (
        <MobileTaskDetailPanel
          taskId={selectedTaskId}
          onBack={() => setSelectedTaskId(null)}
        />
      )}

      {/* Mobile full-screen task create panel (portal → document.body) */}
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
