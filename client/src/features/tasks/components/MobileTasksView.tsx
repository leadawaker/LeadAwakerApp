import { useState, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import { useUpdateTask } from "../api/tasksApi";
import MobileTaskListCard, {
  MobileTaskBoardCard, MTGroupBar, MTAvatar, dueToISO, mtParse,
} from "./MobileTaskListCard";
import MobileTaskDetailPanel from "./MobileTaskDetailPanel";
import MobileTaskCreatePanel from "./MobileTaskCreatePanel";
import { sortTasks, type SortOption, type Task, type TaskStatus } from "../types";
import { loadLocal, saveLocal, applyDesktopFilter, type DesktopFilter } from "../lib/taskViewUtils";

type AccountUser = { id: number; fullName1: string | null; email: string | null };

interface Props {
  tasks: Task[];
  categories: any[];
  users: AccountUser[];
  todayISO: string;
}

export default function MobileTasksView({ tasks, categories, users, todayISO }: Props) {
  const { t } = useTranslation("tasks");
  const updateMutation = useUpdateTask();

  const [mobileView, setMobileView] = useState<'agenda' | 'board'>(() => loadLocal<'agenda' | 'board'>("tasks-mobile-view", "agenda"));
  const [mobileFilter, setMobileFilter] = useState<DesktopFilter>(() => loadLocal<DesktopFilter>("tasks-mobile-filter", "all"));
  const [mobileWho, setMobileWho] = useState<string>(() => loadLocal<string>("tasks-mobile-who", "all"));
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [mobileCreateOpen, setMobileCreateOpen] = useState(false);

  const handleMobileView = useCallback((v: 'agenda' | 'board') => { setMobileView(v); saveLocal("tasks-mobile-view", v); }, []);
  const handleMobileFilter = useCallback((f: DesktopFilter) => { setMobileFilter(f); saveLocal("tasks-mobile-filter", f); }, []);
  const handleMobileWho = useCallback((w: string) => { setMobileWho(w); saveLocal("tasks-mobile-who", w); }, []);

  const sort = loadLocal<SortOption>("tasks-sort", "due_date_asc");

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

  const filtered = useMemo(
    () => sortTasks(applyDesktopFilter(baseByWho, mobileFilter, todayISO), sort),
    [baseByWho, mobileFilter, todayISO, sort]
  );

  const chipCounts = useMemo(() => ({
    all: baseByWho.length,
    next7: applyDesktopFilter(baseByWho, 'next7', todayISO).length,
    overdue: applyDesktopFilter(baseByWho, 'overdue', todayISO).length,
    waiting: applyDesktopFilter(baseByWho, 'waiting', todayISO).length,
    completed: applyDesktopFilter(baseByWho, 'completed', todayISO).length,
  }) as Record<DesktopFilter, number>, [baseByWho, todayISO]);

  const groups = useMemo(() => {
    const g: Record<string, Task[]> = { overdue: [], today: [], week: [], upcoming: [], completed: [] };
    const [ty, tm, td] = todayISO.split("-").map(Number);
    const today = new Date(Date.UTC(ty, tm - 1, td));
    const weekEnd = new Date(Date.UTC(ty, tm - 1, td + (7 - ((today.getUTCDay() + 6) % 7))));
    for (const tk of filtered) {
      if (tk.status === "done") { g.completed.push(tk); continue; }
      const iso = dueToISO(tk.dueDate);
      if (!iso) { g.upcoming.push(tk); continue; }
      const d = mtParse(iso);
      const days = Math.round((d.getTime() - today.getTime()) / 86400000);
      if (days < 0) g.overdue.push(tk);
      else if (days === 0) g.today.push(tk);
      else if (d <= weekEnd) g.week.push(tk);
      else g.upcoming.push(tk);
    }
    return g;
  }, [filtered, todayISO]);

  const groupOrder: Array<[string, string, string | null]> = [
    ["overdue",   t("groups.overdue"),  "var(--stage-lost)"],
    ["today",     t("groups.today"),    "var(--wine)"],
    ["week",      t("groups.thisWeek"), null],
    ["upcoming",  t("groups.upcoming"), null],
    ["completed", t("groups.completed"), "var(--good)"],
  ];

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

  const empty = groupOrder.every(([k]) => groups[k].length === 0);

  return (
    <>
      <div className="relative h-full min-h-0 flex flex-col overflow-hidden" style={{ background: 'var(--bg)' }} data-testid="page-tasks">

        {/* Top bar: serif title + Agenda/Board segmented */}
        <div style={{ flexShrink: 0, background: 'var(--bg)', borderBottom: '1px solid var(--line)' }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-end', padding: '14px 18px 12px' }}>
            <span className="serif" style={{ fontFamily: 'var(--serif)', fontSize: 30, color: 'var(--ink)', letterSpacing: '-0.02em' }}>{t("page.title")}</span>
            <div className="la-seg">
              <button className={`la-seg-btn${mobileView === 'agenda' ? ' on' : ''}`} onClick={() => handleMobileView('agenda')}>{t("views.agenda")}</button>
              <button className={`la-seg-btn${mobileView === 'board' ? ' on' : ''}`} onClick={() => handleMobileView('board')}>{t("views.board")}</button>
            </div>
          </div>
        </div>

        {/* Filters: assignee toggle + filter chips */}
        <div style={{ flexShrink: 0, background: 'var(--bg)', borderBottom: '1px solid var(--line)', padding: '11px 0' }}>
          <div style={{ padding: '0 16px 11px', display: 'flex', overflowX: 'auto', scrollbarWidth: 'none' }}>
            <div style={{ display: 'inline-flex', gap: 3, background: 'var(--bg-2)', boxShadow: 'var(--sh-inset-crisp)', borderRadius: 'var(--r-pill)', padding: 3 }}>
              <button onClick={() => handleMobileWho('all')} style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '6px 13px', borderRadius: 'var(--r-pill)', border: 'none', cursor: 'pointer',
                background: mobileWho === 'all' ? 'var(--card)' : 'transparent', boxShadow: mobileWho === 'all' ? 'var(--sh-raised-crisp)' : 'none',
                color: mobileWho === 'all' ? 'var(--ink)' : 'var(--mute)', fontSize: 12, fontWeight: mobileWho === 'all' ? 600 : 400, whiteSpace: 'nowrap',
              }}>{t("assignee.everyone")}</button>
              {users.map(u => {
                const on = String(u.id) === mobileWho;
                const name = u.fullName1 ?? u.email ?? '?';
                return (
                  <button key={u.id} onClick={() => handleMobileWho(String(u.id))} style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '5px 13px 5px 5px', borderRadius: 'var(--r-pill)', border: 'none', cursor: 'pointer',
                    background: on ? 'var(--card)' : 'transparent', boxShadow: on ? 'var(--sh-raised-crisp)' : 'none',
                    color: on ? 'var(--ink)' : 'var(--mute)', fontSize: 12, fontWeight: on ? 600 : 400, whiteSpace: 'nowrap',
                  }}>
                    <MTAvatar name={name} size={22} />{name.split(' ')[0]}
                  </button>
                );
              })}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '0 16px', scrollbarWidth: 'none' }}>
            {filterChips.map(([k, lbl]) => {
              const on = k === mobileFilter;
              return (
                <button key={k} onClick={() => handleMobileFilter(k)} style={{
                  flexShrink: 0, display: 'flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 'var(--r-pill)', border: 'none', cursor: 'pointer',
                  background: on ? 'var(--wine)' : 'var(--surface)', boxShadow: on ? 'none' : 'var(--sh-raised-crisp)',
                  color: on ? 'var(--paper)' : 'var(--ink-soft)', fontSize: 12.5, fontWeight: on ? 700 : 500,
                }}>
                  {lbl}
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 9, fontWeight: 700, color: on ? 'var(--paper)' : 'var(--mute-2)', background: on ? 'rgba(255,255,255,0.18)' : 'var(--bg-2)', borderRadius: 'var(--r-pill)', padding: '1px 7px' }}>
                    {chipCounts[k]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Content */}
        {mobileView === 'agenda' ? (
          <div style={{ flex: 1, overflowY: 'auto', padding: '6px 14px 90px' }} data-testid="mobile-tasks-list">
            {empty && (
              <div style={{ padding: '60px 20px', textAlign: 'center', fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--mute-2)' }}>
                {t("page.noTasksFound")}
              </div>
            )}
            {groupOrder.map(([key, lbl, accent]) =>
              groups[key].length > 0 ? (
                <div key={key}>
                  <MTGroupBar label={lbl} count={groups[key].length} accent={accent} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                    {groups[key].map(task => (
                      <MobileTaskListCard key={task.id} task={task} category={task.categoryId ? categoryMap.get(task.categoryId) ?? null : null} todayISO={todayISO} dueLabels={mobileDueLabels} onClick={() => setSelectedTaskId(task.id)} onToggle={() => handleToggle(task)} />
                    ))}
                  </div>
                </div>
              ) : null
            )}
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', gap: 13, overflowX: 'auto', padding: '14px 14px 90px', scrollbarWidth: 'none' }} data-testid="mobile-tasks-board">
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
        )}

        {/* FAB */}
        <button onClick={() => setMobileCreateOpen(true)} aria-label={t("create.title")} style={{
          position: 'absolute', right: 18, bottom: 18, zIndex: 10, height: 52, padding: '0 22px', borderRadius: 'var(--r-card)', border: 'none', cursor: 'pointer',
          background: 'var(--wine-grad)', boxShadow: 'var(--sh-raised-medium)', color: 'var(--paper)', display: 'flex', alignItems: 'center', gap: 9,
          fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase',
        }}>
          <Plus className="h-4 w-4" />{t("toolbar.add")}
        </button>
      </div>

      {selectedTaskId !== null && (
        <MobileTaskDetailPanel taskId={selectedTaskId} onBack={() => setSelectedTaskId(null)} />
      )}
      {mobileCreateOpen && (
        <MobileTaskCreatePanel onClose={() => setMobileCreateOpen(false)} onCreated={id => { setMobileCreateOpen(false); setSelectedTaskId(id); }} />
      )}
    </>
  );
}
