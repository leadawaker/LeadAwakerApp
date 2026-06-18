import { useState, useCallback, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { ArrowUpDown, Check, ChevronDown, ChevronLeft, ChevronRight, Filter, Plus, Users } from "lucide-react";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useTranslation } from "react-i18next";
import {
  DndContext, DragOverlay, pointerWithin, PointerSensor, useSensor, useSensors,
  type DragStartEvent, type DragEndEvent,
} from "@dnd-kit/core";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger,
  DropdownMenuSeparator, DropdownMenuCheckboxItem,
  DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { useCreateTask, useUpdateTask } from "../api/tasksApi";
import TaskDetailPanel from "./TaskDetailPanel";
import TasksBoardView from "./TasksBoardView";
import TasksBoardCard from "./TasksBoardCard";
import TasksLoadingSkeleton from "./TasksLoadingSkeleton";
import TasksWeekCalendar, {
  rescheduleDate, taskDueISO, getMondayISO, weekRangeLabel, monthLabel, nextMonthMonday, prevMonthMonday,
  addDays, isoToUTC, utcToISO,
} from "./TasksWeekCalendar";
import { SORT_OPTIONS, sortTasks, type SortOption, type Task } from "../types";
import { loadLocal, saveLocal, AVATAR_BG } from "../lib/taskViewUtils";

type AccountUser = { id: number; fullName1: string | null; email: string | null; avatarUrl: string | null };

const SORT_KEYS: Record<string, string> = {
  due_date_asc:  "sort.dueDateAsc",  due_date_desc: "sort.dueDateDesc",
  priority_desc: "sort.priorityDesc", priority_asc:  "sort.priorityAsc",
  category_asc:  "sort.categoryAsc",  category_desc: "sort.categoryDesc",
  id_asc:        "sort.idAsc",        id_desc:        "sort.idDesc",
  created_desc:  "sort.createdDesc",  created_asc:   "sort.createdAsc",
  title_asc:     "sort.titleAsc",     title_desc:    "sort.titleDesc",
};

type PriorityFilter = 'all' | 'low' | 'medium' | 'high' | 'urgent';
const PRIORITY_OPTS: Array<[PriorityFilter, string]> = [
  ['all', 'All'], ['low', 'Low'], ['medium', 'Medium'], ['high', 'High'], ['urgent', 'Urgent'],
];

// Calendar status filter options
const CAL_STATUS_OPTS = [
  { key: 'all',         label: 'All' },
  { key: 'todo',        label: 'To Do' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'waiting',     label: 'Waiting' },
  { key: 'done',        label: 'Done' },
] as const;

type CalStatusFilter = (typeof CAL_STATUS_OPTS)[number]['key'];

// Default category by user name (Gabriel=Dev/5, Finn=Sales/6)
function defaultCategoryId(userName: string): number | null {
  const n = userName.toLowerCase();
  if (n.includes('gabriel')) return 5;
  if (n.includes('finn'))    return 6;
  return null;
}

interface Props {
  tasks: Task[];
  categories: any[];
  users: AccountUser[];
  todayISO: string;
  currentUserName: string;
  loading?: boolean;
}

export default function DesktopTasksView({ tasks, categories, users, todayISO, currentUserName, loading = false }: Props) {
  const { t } = useTranslation("tasks");
  const createMutation = useCreateTask();
  const updateMutation = useUpdateTask();
  const workspace = useWorkspace();

  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>(() => loadLocal<PriorityFilter>("tasks-priority-filter", "all"));
  const [categoryFilter, setCategoryFilter] = useState<number | 'all'>(() => {
    const stored = loadLocal<string>("tasks-category-filter", "all");
    return stored === "all" ? "all" : Number(stored);
  });
  const [desktopWho, setDesktopWho] = useState<string>(() => loadLocal<string>("tasks-desktop-who", "all"));
  const [desktopSearch, setDesktopSearch] = useState("");
  const [sort, setSort] = useState<SortOption>(() => loadLocal("tasks-sort", "due_date_asc"));
  const [calStatusFilter, setCalStatusFilter] = useState<CalStatusFilter>(() => loadLocal<CalStatusFilter>("tasks-cal-status", "all"));
  const [hideWeekends, setHideWeekends] = useState(() => loadLocal<boolean>("tasks-hide-weekends", true));
  const [dateFrom, setDateFrom] = useState(() => loadLocal<string>("tasks-date-from", ""));
  const [dateTo, setDateTo] = useState(() => loadLocal<string>("tasks-date-to", ""));
  const [openTaskId, setOpenTaskId] = useState<number | null>(null);

  const handlePriorityFilter = useCallback((p: PriorityFilter) => { setPriorityFilter(p); saveLocal('tasks-priority-filter', p); }, []);
  const handleCategoryFilter = useCallback((c: number | 'all') => { setCategoryFilter(c); saveLocal('tasks-category-filter', String(c)); }, []);
  const handleDesktopWho = useCallback((w: string) => { setDesktopWho(w); saveLocal('tasks-desktop-who', w); }, []);
  const handleSort = useCallback((v: SortOption) => { setSort(v); saveLocal("tasks-sort", v); }, []);
  const handleCalStatus = useCallback((s: CalStatusFilter) => { setCalStatusFilter(s); saveLocal("tasks-cal-status", s); }, []);
  const handleHideWeekends = useCallback((v: boolean) => { setHideWeekends(v); saveLocal("tasks-hide-weekends", v); }, []);
  const handleDateFrom = useCallback((v: string) => { setDateFrom(v); saveLocal("tasks-date-from", v); }, []);
  const handleDateTo = useCallback((v: string) => { setDateTo(v); saveLocal("tasks-date-to", v); }, []);
  const handleThisMonth = useCallback(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const last = new Date(y, now.getMonth() + 1, 0).getDate();
    const from = `${y}-${m}-01`;
    const to = `${y}-${m}-${String(last).padStart(2, '0')}`;
    setDateFrom(from); saveLocal("tasks-date-from", from);
    setDateTo(to);   saveLocal("tasks-date-to", to);
  }, []);

  // ── Filtered tasks ──────────────────────────────────────────────────
  const baseByWho = useMemo(() => {
    if (desktopWho === 'all') return tasks;
    const uid = parseInt(desktopWho, 10);
    const name = users.find(x => x.id === uid)?.fullName1 ?? null;
    return tasks.filter(t => t.assignedToUserId === uid || (name && t.assigneeName === name));
  }, [tasks, desktopWho, users]);

  // Board uses priority + category + date filters — calendar also inherits them via calendarTasks
  const boardTasks = useMemo(() => {
    let result = priorityFilter === 'all' ? baseByWho : baseByWho.filter(t => t.priority === priorityFilter);
    if (categoryFilter !== 'all') result = result.filter(t => t.categoryId === categoryFilter);
    if (dateFrom) result = result.filter(t => { const iso = taskDueISO(t); return iso && iso >= dateFrom; });
    if (dateTo)   result = result.filter(t => { const iso = taskDueISO(t); return iso && iso <= dateTo; });
    const q = desktopSearch.trim().toLowerCase();
    if (q) {
      result = result.filter(t =>
        t.title?.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q) ||
        t.assigneeName?.toLowerCase().includes(q));
    }
    return sortTasks(result, sort);
  }, [baseByWho, priorityFilter, categoryFilter, dateFrom, dateTo, desktopSearch, sort]);

  // Calendar gets the same base then optionally filtered by status only
  const calendarTasks = useMemo(() => {
    if (calStatusFilter === 'all') return boardTasks;
    return boardTasks.filter(t => t.status === calStatusFilter);
  }, [boardTasks, calStatusFilter]);

  const priorityCounts = useMemo(() => {
    const map: Record<string, number> = { all: baseByWho.length };
    for (const p of ['low', 'medium', 'high', 'urgent']) {
      map[p] = baseByWho.filter(t => t.priority === p).length;
    }
    return map;
  }, [baseByWho]);

  // ── Wide-screen detection (≥1800px → right-rail monthly calendar) ───
  const [isWide, setIsWide] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 1800);
  useEffect(() => {
    const handler = () => setIsWide(window.innerWidth >= 1800);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  // ── Week / month navigation (controls live in the top bar) ───────────
  const [weekStart, setWeekStart] = useState(() => getMondayISO(todayISO));
  const goToday = useCallback(() => setWeekStart(getMondayISO(todayISO)), [todayISO]);
  const goPrevWeek = useCallback(() => setWeekStart(w => utcToISO(addDays(isoToUTC(w), -7))), []);
  const goNextWeek = useCallback(() => setWeekStart(w => utcToISO(addDays(isoToUTC(w), 7))), []);
  const goPrevMonth = useCallback(() => setWeekStart(w => prevMonthMonday(w)), []);
  const goNextMonth = useCallback(() => setWeekStart(w => nextMonthMonday(w)), []);

  // ── Shared drag context (board status + calendar reschedule) ────────
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const dndSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const draggingTask = draggingId ? tasks.find(t => t.id === draggingId) ?? null : null;

  // Draggable ids are surface-prefixed ("board:42" / "cal:42") to disambiguate same task on both surfaces.
  const taskIdOf = (dragId: unknown) => Number(String(dragId).split(':')[1]);

  const handleDndStart = useCallback((e: DragStartEvent) => setDraggingId(taskIdOf(e.active.id)), []);
  const handleDndEnd = useCallback((e: DragEndEvent) => {
    setDraggingId(null);
    const { active, over } = e;
    if (!over) return;
    const task = tasks.find(t => t.id === taskIdOf(active.id));
    if (!task) return;
    const overId = String(over.id);
    if (overId.startsWith('col-')) {
      const status = overId.slice(4);
      if (task.status !== status) updateMutation.mutate({ id: task.id, data: { status } });
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(overId)) {
      if (taskDueISO(task) !== overId) updateMutation.mutate({ id: task.id, data: { dueDate: rescheduleDate(task, overId) } });
    }
  }, [tasks, updateMutation]);

  // ── Assignee toggle helpers ─────────────────────────────────────────
  const label = (u: AccountUser) => u.fullName1 ?? u.email ?? '?';
  const firstName = (u: AccountUser) => label(u).split(' ')[0];
  const initials = (u: AccountUser) => label(u).split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  const handleCreate = useCallback(async () => {
    if (createMutation.isPending) return;
    const acctId = workspace.currentAccountId || workspace.accounts[0]?.id || 1;
    const currentUser = users.find(u => (u.fullName1 || u.email) === currentUserName);
    try {
      const res = await createMutation.mutateAsync({
        title: t("card.newTask"), description: null, accountsId: acctId, accountName: "",
        campaignName: null, leadName: null, status: "todo", priority: "medium",
        taskType: "admin", dueDate: null, assigneeName: currentUserName || null,
        assignedToUserId: currentUser?.id ?? null,
        categoryId: defaultCategoryId(currentUserName),
      });
      const created = await (res as Response).json().catch(() => null);
      if (created?.id) setOpenTaskId(created.id);
    } catch { /* handled by TanStack */ }
  }, [createMutation, t, workspace, currentUserName, users]);

  const catColor = (id: number | null | undefined) => categories.find(c => c.id === id)?.color ?? 'var(--mute-2)';
  const catName = (id: number | null | undefined) => categories.find(c => c.id === id)?.name ?? '';

  // Shared button height for the top bar
  const BTN_H = 32;

  return (
    <div className="la-page" style={{ background: 'var(--bg)' }}>

      {/* Top header bar — full width, no inner centering so title never shifts */}
      <div style={{ height: 60, flexShrink: 0, borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)', background: 'var(--surface)', display: 'flex', alignItems: 'center', padding: '0 20px', gap: 12 }}>

        {/* Title — always at left edge */}
        <span style={{ fontFamily: 'var(--serif)', fontSize: 24, color: 'var(--ink)', letterSpacing: '-0.01em', flexShrink: 0 }}>Tasks</span>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--mute-2)', letterSpacing: '0.1em', flexShrink: 0 }}>{boardTasks.length}</span>

        {/* Calendar navigation */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button onClick={goToday} className="la-btn la-btn--soft" style={{ height: BTN_H }}>Today</button>
          <button onClick={isWide ? goPrevMonth : goPrevWeek} className="la-btn la-btn--soft la-btn--icon" style={{ width: BTN_H, height: BTN_H }}><ChevronLeft size={15} /></button>
          <span style={{ fontFamily: 'var(--serif)', fontSize: 17, color: 'var(--ink)', letterSpacing: '-0.01em', minWidth: isWide ? 140 : 116, textAlign: 'center' }}>
            {isWide ? monthLabel(weekStart) : weekRangeLabel(weekStart)}
          </span>
          <button onClick={isWide ? goNextMonth : goNextWeek} className="la-btn la-btn--soft la-btn--icon" style={{ width: BTN_H, height: BTN_H }}><ChevronRight size={15} /></button>
        </div>

        {/* Calendar filter */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button title="Calendar filter" className={`la-btn la-btn--soft${calStatusFilter !== 'all' || dateFrom || dateTo ? ' on' : ''}`} style={{ height: BTN_H }}>
              Cal
              <ChevronDown size={12} style={{ opacity: 0.5 }} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48 glass-strong border-none">
            <DropdownMenuLabel>Status</DropdownMenuLabel>
            {CAL_STATUS_OPTS.map(o => (
              <DropdownMenuItem key={o.key} onClick={() => handleCalStatus(o.key)} className="flex items-center gap-2">
                {calStatusFilter === o.key && <Check className="h-3.5 w-3.5 text-brand-indigo" />}
                <span className={cn(calStatusFilter === o.key ? "font-semibold ml-0" : "ml-[22px]")}>{o.label}</span>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem checked={!hideWeekends} onCheckedChange={v => handleHideWeekends(!v)}>
              Show weekends
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div style={{ flex: 1 }} />

        {/* Right controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Search */}
          <div style={{ position: 'relative' }}>
            <input
              className="neu-input"
              placeholder="Search tasks…"
              value={desktopSearch}
              onChange={e => setDesktopSearch(e.target.value)}
              style={{ paddingLeft: 32, paddingTop: 0, paddingBottom: 0, height: BTN_H, fontSize: 12, width: 190 }}
            />
            <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--mute-2)', display: 'flex', pointerEvents: 'none' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
            </span>
          </div>

          {/* Filter — Priority + Category + Date Range (all in one, cascading submenus) */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button title="Filters" className={`la-btn la-btn--soft${priorityFilter !== 'all' || categoryFilter !== 'all' || dateFrom || dateTo ? ' on' : ''}`} style={{ height: BTN_H }}>
                <Filter size={13} />
                <ChevronDown size={12} style={{ opacity: 0.5 }} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44 glass-strong border-none">
              {/* Priority submenu */}
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="flex items-center justify-between gap-2">
                  <span>Priority</span>
                  {priorityFilter !== 'all' && <span className="text-[10px] font-mono text-brand-indigo capitalize">{priorityFilter}</span>}
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-44 glass-strong border-none">
                  {PRIORITY_OPTS.map(([k, lbl]) => (
                    <DropdownMenuItem key={k} onClick={() => handlePriorityFilter(k)} className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2">
                        {k === priorityFilter && <Check className="h-3.5 w-3.5 text-brand-indigo" />}
                        <span className={cn(k === priorityFilter && "font-semibold", k === priorityFilter ? "" : "ml-[22px]")}>{lbl}</span>
                      </span>
                      <span className="font-mono text-[10px] text-muted-foreground tabular-nums">{priorityCounts[k]}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>

              {/* Category submenu */}
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="flex items-center justify-between gap-2">
                  <span>Category</span>
                  {categoryFilter !== 'all' && <span className="text-[10px] font-mono text-brand-indigo truncate max-w-[60px]">{categories.find((c: any) => c.id === categoryFilter)?.name}</span>}
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-48 glass-strong border-none">
                  <DropdownMenuItem onClick={() => handleCategoryFilter('all')} className="flex items-center gap-2">
                    {categoryFilter === 'all' && <Check className="h-3.5 w-3.5 text-brand-indigo" />}
                    <span className={cn(categoryFilter === 'all' ? "font-semibold ml-0" : "ml-[22px]")}>All</span>
                  </DropdownMenuItem>
                  {categories.map((c: any) => (
                    <DropdownMenuItem key={c.id} onClick={() => handleCategoryFilter(c.id)} className="flex items-center gap-2">
                      {categoryFilter === c.id && <Check className="h-3.5 w-3.5 text-brand-indigo" />}
                      <span className={cn(categoryFilter === c.id ? "font-semibold ml-0" : "ml-[22px]", "flex items-center gap-1.5")}>
                        {c.icon && <span>{c.icon}</span>}
                        <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: c.color ?? 'var(--mute-2)', flexShrink: 0 }} />
                        {c.name}
                      </span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>

              {/* Date Range submenu */}
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="flex items-center justify-between gap-2">
                  <span>Date range</span>
                  {(dateFrom || dateTo) && <span className="text-[10px] font-mono text-brand-indigo">on</span>}
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-56 glass-strong border-none">
                  <DropdownMenuItem onClick={handleThisMonth} className="flex items-center gap-2">
                    <span className="font-medium">This Month</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <div className="px-2 pb-1 flex flex-col gap-1.5 pt-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-muted-foreground w-8 shrink-0">From</span>
                      <input type="date" value={dateFrom} onChange={e => handleDateFrom(e.target.value)}
                        className="flex-1 text-[11px] rounded-[5px] bg-[var(--bg)] border border-[var(--line)] px-2 py-1 text-[var(--ink)] focus:outline-none" />
                      {dateFrom && <button onClick={() => handleDateFrom('')} className="text-muted-foreground hover:text-foreground text-[10px]">✕</button>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-muted-foreground w-8 shrink-0">To</span>
                      <input type="date" value={dateTo} onChange={e => handleDateTo(e.target.value)}
                        className="flex-1 text-[11px] rounded-[5px] bg-[var(--bg)] border border-[var(--line)] px-2 py-1 text-[var(--ink)] focus:outline-none" />
                      {dateTo && <button onClick={() => handleDateTo('')} className="text-muted-foreground hover:text-foreground text-[10px]">✕</button>}
                    </div>
                  </div>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Sort */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button title="Sort" className={`la-btn la-btn--soft${sort !== 'due_date_asc' ? ' on' : ''}`} style={{ height: BTN_H }}>
                <ArrowUpDown size={13} /><ChevronDown size={12} style={{ opacity: 0.5 }} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 max-h-[60vh] overflow-y-auto glass-strong border-none">
              <DropdownMenuLabel>Sort by</DropdownMenuLabel>
              {SORT_OPTIONS.map(o => (
                <DropdownMenuItem key={o.value} onClick={() => handleSort(o.value)} className="flex items-center gap-2">
                  {sort === o.value && <Check className="h-3.5 w-3.5 text-brand-indigo" />}
                  <span className={cn(sort === o.value ? "font-semibold" : "ml-[22px]")}>{t(SORT_KEYS[o.value] ?? o.label)}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Assignee — inline segmented toggle */}
          {users.length > 0 && (
            <div className="la-seg" title="Assignee" style={{ height: BTN_H }}>
              <button className={`la-seg-btn${desktopWho === 'all' ? ' on' : ''}`} onClick={() => handleDesktopWho('all')} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, height: '100%' }}>
                <Users size={12} /> Everyone
              </button>
              {users.map((u, i) => {
                const bg = AVATAR_BG[i % AVATAR_BG.length];
                return (
                  <button key={u.id} className={`la-seg-btn${String(u.id) === desktopWho ? ' on' : ''}`} onClick={() => handleDesktopWho(String(u.id))} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: '100%' }}>
                    <span style={{ position: 'relative', width: 19, height: 19, borderRadius: '50%', background: bg, boxShadow: `0 0 7px ${bg}99`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                      {u.avatarUrl ? <img src={u.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ color: '#fff', fontFamily: 'var(--mono)', fontSize: 7, fontWeight: 700 }}>{initials(u)}</span>}
                    </span>
                    {firstName(u)}
                  </button>
                );
              })}
            </div>
          )}

          <button title={t("create.title")} onClick={handleCreate} className="la-btn la-btn--wine la-btn--lg" style={{ height: BTN_H, padding: '0 18px' }}>
            <Plus size={14} /> Add task
          </button>
        </div>
      </div>

      {/* Content — merged board + calendar (responsive), one shared drag context */}
      <DndContext sensors={dndSensors} collisionDetection={pointerWithin} onDragStart={handleDndStart} onDragEnd={handleDndEnd}>
        <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex' }}>
          {loading ? (
            <TasksLoadingSkeleton />
          ) : (
            <div className="tasks-merged" style={{ width: '100%' }}>
              <div className="tasks-merged__board">
                <TasksBoardView tasks={boardTasks} categories={categories as any} activeId={openTaskId} onSelect={setOpenTaskId} todayISO={todayISO} users={users} />
              </div>
              <div className="tasks-merged__cal">
                <TasksWeekCalendar tasks={calendarTasks} categories={categories as any} activeId={openTaskId} onSelect={setOpenTaskId} todayISO={todayISO} weekStart={weekStart} compact={!isWide} monthly={isWide} hideWeekends={hideWeekends} />
              </div>
            </div>
          )}
        </div>

        {/* Portal to body so position:fixed anchors to the viewport, not the
            framer-motion PageTransition ancestor (which would offset the overlay). */}
        {createPortal(
          <DragOverlay>
            {draggingTask ? (
              <div style={{ transform: 'rotate(1.5deg)', cursor: 'grabbing', width: 260 }}>
                <TasksBoardCard task={draggingTask} active={false} onSelect={() => {}} categoryColor={catColor(draggingTask.categoryId)} categoryName={catName(draggingTask.categoryId)} todayISO={todayISO} users={users} />
              </div>
            ) : null}
          </DragOverlay>,
          document.body
        )}
      </DndContext>

      {/* Detail modal — plain white card, not glass */}
      {openTaskId !== null && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40 backdrop-blur-[3px]" onClick={() => setOpenTaskId(null)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 pointer-events-none">
            <div
              className="w-full max-w-4xl max-h-[88vh] overflow-hidden flex flex-col pointer-events-auto"
              style={{
                borderRadius: 'var(--r-panel)',
                background: 'var(--bone)',
                boxShadow: '0 24px 48px rgba(0,0,0,0.18)',
              }}
            >
              <TaskDetailPanel taskId={openTaskId} onClose={() => setOpenTaskId(null)} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
