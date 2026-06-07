import { useState, useCallback, useMemo } from "react";
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
} from "@/components/ui/dropdown-menu";
import { useCreateTask, useUpdateTask } from "../api/tasksApi";
import TaskDetailPanel from "./TaskDetailPanel";
import TasksBoardView from "./TasksBoardView";
import TasksBoardCard from "./TasksBoardCard";
import TasksWeekCalendar, {
  rescheduleDate, taskDueISO, getMondayISO, weekRangeLabel, addDays, isoToUTC, utcToISO,
} from "./TasksWeekCalendar";
import { SORT_OPTIONS, sortTasks, type SortOption, type Task } from "../types";
import { loadLocal, saveLocal, applyDesktopFilter, type DesktopFilter, AVATAR_BG } from "../lib/taskViewUtils";

type AccountUser = { id: number; fullName1: string | null; email: string | null; avatarUrl: string | null };

const SORT_KEYS: Record<string, string> = {
  due_date_asc:  "sort.dueDateAsc",  due_date_desc: "sort.dueDateDesc",
  priority_desc: "sort.priorityDesc", priority_asc:  "sort.priorityAsc",
  category_asc:  "sort.categoryAsc",  category_desc: "sort.categoryDesc",
  id_asc:        "sort.idAsc",        id_desc:        "sort.idDesc",
  created_desc:  "sort.createdDesc",  created_asc:   "sort.createdAsc",
  title_asc:     "sort.titleAsc",     title_desc:    "sort.titleDesc",
};

const CHIPS: Array<[DesktopFilter, string]> = [
  ['all', 'All'], ['next7', 'Next 7 Days'], ['overdue', 'Overdue'], ['waiting', 'Waiting'], ['completed', 'Done'],
];

interface Props {
  tasks: Task[];
  categories: any[];
  users: AccountUser[];
  todayISO: string;
  currentUserName: string;
}

export default function DesktopTasksView({ tasks, categories, users, todayISO, currentUserName }: Props) {
  const { t } = useTranslation("tasks");
  const createMutation = useCreateTask();
  const updateMutation = useUpdateTask();
  const workspace = useWorkspace();

  const [desktopFilter, setDesktopFilter] = useState<DesktopFilter>(() => loadLocal<DesktopFilter>("tasks-desktop-filter", "all"));
  const [desktopWho, setDesktopWho] = useState<string>(() => loadLocal<string>("tasks-desktop-who", "all"));
  const [desktopSearch, setDesktopSearch] = useState("");
  const [sort, setSort] = useState<SortOption>(() => loadLocal("tasks-sort", "due_date_asc"));
  const [openTaskId, setOpenTaskId] = useState<number | null>(null);

  const handleDesktopFilter = useCallback((f: DesktopFilter) => { setDesktopFilter(f); saveLocal('tasks-desktop-filter', f); }, []);
  const handleDesktopWho = useCallback((w: string) => { setDesktopWho(w); saveLocal('tasks-desktop-who', w); }, []);
  const handleSort = useCallback((v: SortOption) => { setSort(v); saveLocal("tasks-sort", v); }, []);

  // ── Filtered tasks ──────────────────────────────────────────────────
  const baseByWho = useMemo(() => {
    if (desktopWho === 'all') return tasks;
    const uid = parseInt(desktopWho, 10);
    const name = users.find(x => x.id === uid)?.fullName1 ?? null;
    return tasks.filter(t => t.assignedToUserId === uid || (name && t.assigneeName === name));
  }, [tasks, desktopWho, users]);

  const desktopTasks = useMemo(() => {
    let result = applyDesktopFilter(baseByWho, desktopFilter, todayISO);
    const q = desktopSearch.trim().toLowerCase();
    if (q) {
      result = result.filter(t =>
        t.title?.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q) ||
        t.assigneeName?.toLowerCase().includes(q));
    }
    return sortTasks(result, sort);
  }, [baseByWho, desktopFilter, desktopSearch, todayISO, sort]);

  const counts = useMemo(() => ({
    all: baseByWho.length,
    next7: applyDesktopFilter(baseByWho, 'next7', todayISO).length,
    overdue: applyDesktopFilter(baseByWho, 'overdue', todayISO).length,
    waiting: applyDesktopFilter(baseByWho, 'waiting', todayISO).length,
    completed: applyDesktopFilter(baseByWho, 'completed', todayISO).length,
  }) as Record<DesktopFilter, number>, [baseByWho, todayISO]);

  // ── Week navigation (controls live in the top bar) ──────────────────
  const [weekStart, setWeekStart] = useState(() => getMondayISO(todayISO));
  const goToday = useCallback(() => setWeekStart(getMondayISO(todayISO)), [todayISO]);
  const goPrevWeek = useCallback(() => setWeekStart(w => utcToISO(addDays(isoToUTC(w), -7))), []);
  const goNextWeek = useCallback(() => setWeekStart(w => utcToISO(addDays(isoToUTC(w), 7))), []);

  // ── Shared drag context (board status + calendar reschedule) ────────
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const dndSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const draggingTask = draggingId ? tasks.find(t => t.id === draggingId) ?? null : null;

  const handleDndStart = useCallback((e: DragStartEvent) => setDraggingId(e.active.id as number), []);
  const handleDndEnd = useCallback((e: DragEndEvent) => {
    setDraggingId(null);
    const { active, over } = e;
    if (!over) return;
    const task = tasks.find(t => t.id === active.id);
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
    try {
      const res = await createMutation.mutateAsync({
        title: t("card.newTask"), description: null, accountsId: acctId, accountName: "",
        campaignName: null, leadName: null, status: "todo", priority: "medium",
        taskType: "admin", dueDate: null, assigneeName: currentUserName || null,
      });
      const created = await (res as Response).json().catch(() => null);
      if (created?.id) setOpenTaskId(created.id);
    } catch { /* handled by TanStack */ }
  }, [createMutation, t, workspace, currentUserName]);

  const catColor = (id: number | null | undefined) => categories.find(c => c.id === id)?.color ?? 'var(--mute-2)';
  const catName = (id: number | null | undefined) => categories.find(c => c.id === id)?.name ?? '';

  return (
    <div className="la-page" style={{ background: 'var(--bg)' }}>

      {/* Top header bar */}
      <div style={{ flexShrink: 0, borderBottom: '1px solid var(--line)' }}>
        <div style={{ maxWidth: 1600, margin: '0 auto', height: 60, padding: '0 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontFamily: 'var(--serif)', fontSize: 24, color: 'var(--ink)', letterSpacing: '-0.01em' }}>Tasks</span>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--mute-2)', letterSpacing: '0.1em' }}>{desktopTasks.length}</span>

          {/* Calendar week navigation */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 6 }}>
            <button onClick={goToday} className="la-btn la-btn--soft">Today</button>
            <button onClick={goPrevWeek} className="la-btn la-btn--soft la-btn--icon"><ChevronLeft size={15} /></button>
            <span style={{ fontFamily: 'var(--serif)', fontSize: 17, color: 'var(--ink)', letterSpacing: '-0.01em', minWidth: 116, textAlign: 'center' }}>
              {weekRangeLabel(weekStart)}
            </span>
            <button onClick={goNextWeek} className="la-btn la-btn--soft la-btn--icon"><ChevronRight size={15} /></button>
          </div>

          <div style={{ flex: 1 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Search */}
            <div style={{ position: 'relative' }}>
              <input className="neu-input" placeholder="Search tasks…" value={desktopSearch} onChange={e => setDesktopSearch(e.target.value)} style={{ paddingLeft: 32, fontSize: 12, width: 190 }} />
              <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--mute-2)', display: 'flex', pointerEvents: 'none' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
              </span>
            </div>

            {/* Filter */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button title="Filter" className={`la-btn la-btn--soft${desktopFilter !== 'all' ? ' on' : ''}`}>
                  <Filter size={13} />
                  {desktopFilter !== 'all' && <span style={{ fontSize: 12, maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis' }}>{CHIPS.find(([k]) => k === desktopFilter)?.[1]}</span>}
                  <ChevronDown size={12} style={{ opacity: 0.5 }} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>Show</DropdownMenuLabel>
                {CHIPS.map(([k, lbl]) => (
                  <DropdownMenuItem key={k} onClick={() => handleDesktopFilter(k)} className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2">
                      {k === desktopFilter && <Check className="h-3.5 w-3.5 text-brand-indigo" />}
                      <span className={cn(k === desktopFilter && "font-semibold")}>{lbl}</span>
                    </span>
                    <span className="font-mono text-[10px] text-muted-foreground tabular-nums">{counts[k]}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Sort */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button title="Sort" className={`la-btn la-btn--soft${sort !== 'due_date_asc' ? ' on' : ''}`}>
                  <ArrowUpDown size={13} /><ChevronDown size={12} style={{ opacity: 0.5 }} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52 max-h-[60vh] overflow-y-auto">
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
              <div className="la-seg" title="Assignee">
                <button className={`la-seg-btn${desktopWho === 'all' ? ' on' : ''}`} onClick={() => handleDesktopWho('all')} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <Users size={12} /> Everyone
                </button>
                {users.map((u, i) => {
                  const bg = AVATAR_BG[i % AVATAR_BG.length];
                  return (
                    <button key={u.id} className={`la-seg-btn${String(u.id) === desktopWho ? ' on' : ''}`} onClick={() => handleDesktopWho(String(u.id))} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ position: 'relative', width: 19, height: 19, borderRadius: '50%', background: bg, boxShadow: `0 0 7px ${bg}99`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                        {u.avatarUrl ? <img src={u.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ color: '#fff', fontFamily: 'var(--mono)', fontSize: 7, fontWeight: 700 }}>{initials(u)}</span>}
                      </span>
                      {firstName(u)}
                    </button>
                  );
                })}
              </div>
            )}

            <button title={t("create.title")} onClick={handleCreate} className="la-btn la-btn--wine"><Plus size={13} /> Add task</button>
          </div>
        </div>
      </div>

      {/* Content — merged board + calendar (responsive), one shared drag context */}
      <DndContext sensors={dndSensors} collisionDetection={pointerWithin} onDragStart={handleDndStart} onDragEnd={handleDndEnd}>
        <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex' }}>
          <div className="tasks-merged" style={{ maxWidth: 1600, margin: '0 auto', width: '100%' }}>
            <div className="tasks-merged__board">
              <TasksBoardView tasks={desktopTasks} categories={categories as any} activeId={openTaskId} onSelect={setOpenTaskId} todayISO={todayISO} />
            </div>
            <div className="tasks-merged__cal">
              <TasksWeekCalendar tasks={desktopTasks} categories={categories as any} activeId={openTaskId} onSelect={setOpenTaskId} todayISO={todayISO} weekStart={weekStart} compact />
            </div>
          </div>
        </div>

        <DragOverlay>
          {draggingTask ? (
            <div style={{ transform: 'rotate(1.5deg)', cursor: 'grabbing', width: 260 }}>
              <TasksBoardCard task={draggingTask} active={false} onSelect={() => {}} categoryColor={catColor(draggingTask.categoryId)} categoryName={catName(draggingTask.categoryId)} todayISO={todayISO} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Detail modal */}
      {openTaskId !== null && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40 backdrop-blur-[3px]" onClick={() => setOpenTaskId(null)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 pointer-events-none">
            <div className="glass-strong w-full max-w-4xl max-h-[88vh] overflow-hidden flex flex-col pointer-events-auto" style={{ borderRadius: 'var(--r-panel)' }}>
              <TaskDetailPanel taskId={openTaskId} onClose={() => setOpenTaskId(null)} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
