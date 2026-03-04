import { useState, useCallback } from "react";
import { CrmShell } from "@/components/crm/CrmShell";
import { cn } from "@/lib/utils";
import { ArrowUpDown, Filter, Plus } from "lucide-react";

import { SearchPill } from "@/components/ui/search-pill";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTasks, useCreateTask } from "../api/tasksApi";
import TasksKanbanView from "../components/TasksKanbanView";
import {
  SORT_OPTIONS,
  STATUS_OPTIONS,
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
export default function TasksPage() {
  const { data: rawTasks } = useTasks();
  const tasks = (rawTasks ?? []) as Task[];
  const createMutation = useCreateTask();

  // Persisted state
  const [sort, setSort] = useState<SortOption>(() => loadLocal("tasks-sort", "due_date_asc"));

  // Transient state
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<TaskStatus[]>([]);

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

  // Filtered tasks
  const filteredTasks = filterStatus.length
    ? tasks.filter((t) => filterStatus.includes(t.status as TaskStatus))
    : tasks;

  const handleCreate = useCallback(async () => {
    if (createMutation.isPending) return;
    const acctId = parseInt(localStorage.getItem("leadawaker_current_account_id") ?? "1", 10);
    try {
      await createMutation.mutateAsync({
        title: "New Task",
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
  }, [createMutation]);

  // ── Toolbar ─────────────────────────────────────────────────────────
  const toolbarButtons = (
    <>
      <button onClick={handleCreate} className={cn(xBase, "hover:max-w-[90px]", xDefault)} title="New task">
        <Plus className="h-4 w-4 shrink-0" />
        <span className={xSpan}>Add</span>
      </button>

      <SearchPill
        value={searchQuery}
        onChange={setSearchQuery}
        open={searchOpen}
        onOpenChange={setSearchOpen}
        placeholder="Search tasks..."
      />

      {/* Sort */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className={cn(xBase, "hover:max-w-[80px]", sort !== "due_date_asc" ? xActive : xDefault)} title="Sort">
            <ArrowUpDown className="h-4 w-4 shrink-0" />
            <span className={xSpan}>Sort</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {SORT_OPTIONS.map((o) => (
            <DropdownMenuItem key={o.value} onClick={() => handleSort(o.value)} className={cn(sort === o.value && "font-bold text-brand-indigo")}>
              {o.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Filter */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className={cn(xBase, "hover:max-w-[100px]", filterStatus.length > 0 ? xActive : xDefault)} title="Filter">
            <Filter className="h-4 w-4 shrink-0" />
            <span className={xSpan}>Filter</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          {STATUS_OPTIONS.map((o) => (
            <DropdownMenuItem key={o.value} onClick={() => toggleFilterStatus(o.value)} className={cn(filterStatus.includes(o.value) && "font-bold text-brand-indigo")}>
              {o.label}
            </DropdownMenuItem>
          ))}
          {filterStatus.length > 0 && (
            <DropdownMenuItem onClick={() => setFilterStatus([])} className="text-red-500">Clear filters</DropdownMenuItem>
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
        <div className="pl-[17px] pr-3.5 pt-10 pb-3 shrink-0 flex items-center gap-3 overflow-x-auto [scrollbar-width:none]">
          <h2 className="text-2xl font-semibold font-heading text-foreground leading-tight">Tasks</h2>
          <div className="w-px h-5 bg-border/40 mx-0.5 shrink-0" />
          <div className="flex items-center gap-1.5">
            {toolbarButtons}
          </div>
        </div>

        {/* Kanban board */}
        <div className="flex-1 min-h-0 overflow-hidden p-[6px] pt-0">
          <TasksKanbanView
            tasks={filteredTasks}
            searchQuery={searchQuery}
            sort={sort}
          />
        </div>
      </div>
    </CrmShell>
  );
}
