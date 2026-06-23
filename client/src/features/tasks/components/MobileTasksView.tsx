import { useState, useCallback, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Check, Users } from "lucide-react";
import { PRIORITY_OPTIONS, TYPE_OPTIONS, type TaskPriority, type TaskType } from "../types";
import { cn } from "@/lib/utils";
import { MobileRecede } from "@/components/crm/mobile/MobileSheet";
import { MobileListHeader, MobileTabSeg, MobileDrawerOption, MobileDrawerSubheading } from "@/components/crm/mobile/MobileListHeader";
import { useUpdateTask } from "../api/tasksApi";
import { MobileTaskBoardCard, initials } from "./MobileTaskListCard";
import MobileTaskDetailPanel from "./MobileTaskDetailPanel";
import MobileTaskCreatePanel from "./MobileTaskCreatePanel";
import MobileTaskWeekStrip from "./MobileTaskWeekStrip";
import { sortTasks, SORT_OPTIONS, type SortOption, type Task, type TaskStatus } from "../types";
import { loadLocal, saveLocal, applyDesktopFilter, type DesktopFilter } from "../lib/taskViewUtils";
import { getUserAvatarColor } from "@/lib/avatarUtils";

type AccountUser = { id: number; fullName1: string | null; email: string | null; avatarUrl?: string | null };

interface Props {
  tasks: Task[];
  categories: any[];
  users: AccountUser[];
  todayISO: string;
}

export default function MobileTasksView({ tasks, categories, users, todayISO }: Props) {
  const { t } = useTranslation("tasks");
  const updateMutation = useUpdateTask();

  const [mobileFilter, setMobileFilter] = useState<DesktopFilter>(() => loadLocal<DesktopFilter>("tasks-mobile-filter", "all"));
  const [mobileWho, setMobileWho] = useState<string>(() => loadLocal<string>("tasks-mobile-who", "all"));
  const [filterPriority, setFilterPriority] = useState<TaskPriority[]>(() => loadLocal<TaskPriority[]>("tasks-mobile-filter-priority", []));
  const [filterType, setFilterType] = useState<TaskType[]>(() => loadLocal<TaskType[]>("tasks-mobile-filter-type", []));
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const lastTaskIdRef = useRef<number | null>(null);
  const [mobileCreateOpen, setMobileCreateOpen] = useState(false);
  const [sort, setSort] = useState<SortOption>(() => loadLocal<SortOption>("tasks-sort", "due_date_asc"));

  const handleMobileFilter = useCallback((f: DesktopFilter) => { setMobileFilter(f); saveLocal("tasks-mobile-filter", f); }, []);
  const handleMobileWho = useCallback((w: string) => { setMobileWho(w); saveLocal("tasks-mobile-who", w); }, []);
  const toggleFilterPriority = useCallback((p: TaskPriority) => {
    setFilterPriority((prev) => {
      const next = prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p];
      saveLocal("tasks-mobile-filter-priority", next);
      return next;
    });
  }, []);
  const toggleFilterType = useCallback((tp: TaskType) => {
    setFilterType((prev) => {
      const next = prev.includes(tp) ? prev.filter((x) => x !== tp) : [...prev, tp];
      saveLocal("tasks-mobile-filter-type", next);
      return next;
    });
  }, []);
  const handleSort = useCallback((s: SortOption) => { setSort(s); saveLocal("tasks-sort", s); }, []);

  const categoryMap = useMemo(() => new Map((categories ?? []).map(c => [c.id, c])), [categories]);
  const mobileDueLabels = useMemo(
    () => ({ today: t("relative.today"), tomorrow: t("relative.tomorrow"), yesterday: t("relative.yesterday") }),
    [t]
  );

  const baseByWho = useMemo(() => {
    if (mobileWho === "all") return tasks;
    const uid = parseInt(mobileWho, 10);
    const name = users.find(x => x.id === uid)?.fullName1 ?? null;
    return tasks.filter(tk => tk.assignedToUserId === uid || (name && tk.assigneeName === name));
  }, [tasks, mobileWho, users]);

  const filtered = useMemo(() => {
    let result = applyDesktopFilter(baseByWho, mobileFilter, todayISO);
    if (filterPriority.length > 0) result = result.filter((tk) => filterPriority.includes(tk.priority as TaskPriority));
    if (filterType.length > 0) result = result.filter((tk) => filterType.includes(tk.taskType as TaskType));
    return sortTasks(result, sort);
  }, [baseByWho, mobileFilter, todayISO, filterPriority, filterType, sort]);

  const chipCounts = useMemo(() => ({
    all: baseByWho.length,
    next7: applyDesktopFilter(baseByWho, 'next7', todayISO).length,
    overdue: applyDesktopFilter(baseByWho, 'overdue', todayISO).length,
    waiting: applyDesktopFilter(baseByWho, 'waiting', todayISO).length,
    completed: applyDesktopFilter(baseByWho, 'completed', todayISO).length,
  }) as Record<DesktopFilter, number>, [baseByWho, todayISO]);

  const filterChips: Array<[DesktopFilter, string]> = [
    ["all", t("filter.all")], ["next7", t("filter.next7")], ["overdue", t("filter.overdue")],
    ["waiting", t("filter.waiting")], ["completed", t("filter.completed")],
  ];

  const boardCols: Array<{ key: TaskStatus; label: string; color: string }> = [
    { key: "todo",        label: t("status.todo"),       color: "var(--mute)" },
    { key: "in_progress", label: t("status.inProgress"), color: "var(--stage-contacted)" },
    { key: "waiting",     label: t("status.waiting"),    color: "var(--warn)" },
    { key: "done",        label: t("status.done"),       color: "var(--good)" },
  ];

  const handleToggle = useCallback((task: Task) => {
    updateMutation.mutate({ id: task.id, data: { status: task.status === "done" ? "todo" : "done" } });
  }, [updateMutation]);

  return (
    <>
      <MobileRecede open={selectedTaskId !== null}>
      <div className="relative h-full min-h-0 flex flex-col overflow-hidden" style={{ background: 'var(--bg)' }} data-testid="page-tasks">

        {/* Top bar: shared mobile header — assignee tabs (title row) + filter/sort drawers */}
        <MobileListHeader
          title={t("page.title")}
          tabSwitcher={(
            <MobileTabSeg
              tabs={[
                { id: "all", label: t("assignee.everyone"), icon: Users },
                ...users.map((u) => {
                  const name = u.fullName1 ?? u.email ?? "?";
                  const bg = getUserAvatarColor(name);
                  return {
                    id: String(u.id),
                    label: name.split(/\s+/)[0],
                    iconNode: (
                      <span style={{
                        position: "relative", width: 18, height: 18, borderRadius: "50%", flexShrink: 0,
                        background: bg, boxShadow: `0 0 6px ${bg}99`,
                        display: "inline-flex", alignItems: "center", justifyContent: "center", overflow: "hidden",
                      }}>
                        {u.avatarUrl ? (
                          <img src={u.avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        ) : (
                          <span style={{ color: "#fff", fontFamily: "var(--mono)", fontSize: 7, fontWeight: 700 }}>{initials(name)}</span>
                        )}
                      </span>
                    ),
                  };
                }),
              ]}
              activeId={mobileWho}
              onChange={handleMobileWho}
            />
          )}
          filterPanel={(
            <>
              <MobileDrawerSubheading>{t("filter.title", "Date")}</MobileDrawerSubheading>
              {filterChips.map(([k, lbl]) => (
                <MobileDrawerOption
                  key={k}
                  label={`${lbl}  ${chipCounts[k]}`}
                  selected={mobileFilter === k}
                  onClick={() => handleMobileFilter(k)}
                />
              ))}
              <MobileDrawerSubheading>{t("columns.priority", "Priority")}</MobileDrawerSubheading>
              {PRIORITY_OPTIONS.map((opt) => (
                <MobileDrawerOption
                  key={opt.value}
                  label={t(`priority.${opt.value}`, opt.label)}
                  selected={filterPriority.includes(opt.value)}
                  onClick={() => toggleFilterPriority(opt.value)}
                />
              ))}
              <MobileDrawerSubheading>{t("columns.type", "Type")}</MobileDrawerSubheading>
              {TYPE_OPTIONS.map((opt) => (
                <MobileDrawerOption
                  key={opt.value}
                  label={t(`taskType.${opt.value.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())}`, opt.label)}
                  selected={filterType.includes(opt.value)}
                  onClick={() => toggleFilterType(opt.value)}
                />
              ))}
            </>
          )}
          sortPanel={(
            <>
              <MobileDrawerSubheading>{t("sort.title", "Sort")}</MobileDrawerSubheading>
              {SORT_OPTIONS.map((opt) => (
                <MobileDrawerOption
                  key={opt.value}
                  label={t(`sortOptions.${opt.value}`, opt.label)}
                  selected={sort === opt.value}
                  onClick={() => handleSort(opt.value)}
                />
              ))}
            </>
          )}
          filterActive={mobileFilter !== "all" || filterPriority.length > 0 || filterType.length > 0}
          sortActive={sort !== "due_date_asc"}
        />

        {/* Content: weekly task calendar (top) then kanban (below), one vertical scroll */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 0 90px' }} data-testid="mobile-tasks-content">
          {/* Weekly task calendar (tasks plotted by due date) */}
          <MobileTaskWeekStrip tasks={filtered} todayISO={todayISO} categoryMap={categoryMap} onSelect={setSelectedTaskId} />

          {/* Kanban board */}
          <div style={{ display: 'flex', gap: 13, overflowX: 'auto', padding: '14px 14px 8px', scrollbarWidth: 'none' }} data-testid="mobile-tasks-board">
            {boardCols.map(col => {
              const items = filtered.filter(tk => tk.status === col.key);
              return (
                <div key={col.key} style={{ flex: '0 0 252px', display: 'flex', flexDirection: 'column' }}>
                  <div className="row" style={{ gap: 9, padding: '0 4px 11px' }}>
                    <span style={{ width: 9, height: 9, borderRadius: '50%', background: col.color }} />
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-soft)', fontWeight: 700 }}>{col.label}</span>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--mute-2)', background: 'var(--card)', boxShadow: 'var(--sh-raised-crisp)', borderRadius: 'var(--r-pill)', padding: '1px 8px', marginLeft: 'auto' }}>{items.length}</span>
                  </div>
                  <div className="neu-inset" style={{ flex: 1, borderRadius: 'var(--r-card)', padding: 10, display: 'flex', flexDirection: 'column', gap: 10, background: 'var(--bg)', minHeight: 120 }}>
                    {items.length === 0 ? (
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 70, fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--mute-2)' }}>{t("board.empty")}</div>
                    ) : (
                      items.map(task => (
                        <MobileTaskBoardCard key={task.id} task={task} category={task.categoryId ? categoryMap.get(task.categoryId) ?? null : null} todayISO={todayISO} dueLabels={mobileDueLabels} onClick={() => setSelectedTaskId(task.id)} />
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* FAB */}
        <button onClick={() => setMobileCreateOpen(true)} aria-label={t("create.title")} style={{
          position: 'absolute', right: 18, bottom: 18, zIndex: 10, height: 52, padding: '0 22px', borderRadius: 'var(--r-card)', border: 'none', cursor: 'pointer',
          background: 'var(--wine-grad)', boxShadow: 'var(--sh-raised-medium)', color: 'var(--paper)', display: 'flex', alignItems: 'center', gap: 9,
          fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase',
        }}>
          <Plus className="h-4 w-4" />{t("toolbar.add")}
        </button>
      </div>
      </MobileRecede>

      {/* Keep the panel mounted with the last id so the close gesture can animate down */}
      {(() => {
        if (selectedTaskId !== null) lastTaskIdRef.current = selectedTaskId;
        const detailTaskId = selectedTaskId ?? lastTaskIdRef.current;
        return detailTaskId !== null ? (
          <MobileTaskDetailPanel
            taskId={detailTaskId}
            open={selectedTaskId !== null}
            onBack={() => setSelectedTaskId(null)}
          />
        ) : null;
      })()}
      {mobileCreateOpen && (
        <MobileTaskCreatePanel onClose={() => setMobileCreateOpen(false)} onCreated={id => { setMobileCreateOpen(false); setSelectedTaskId(id); }} />
      )}
    </>
  );
}
