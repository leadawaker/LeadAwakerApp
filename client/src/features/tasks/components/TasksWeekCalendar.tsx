import { useMemo } from "react";
import { useDroppable, useDraggable } from "@dnd-kit/core";
import type { Task, TaskCategory } from "@shared/schema";

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const STATUS_EDGE: Record<string, string> = {
  todo:        'var(--mute)',
  in_progress: 'var(--stage-contacted)',
  waiting:     'var(--warn)',
  done:        'var(--good)',
  cancelled:   'var(--stage-lost)',
};

const PRIORITY_COLOR: Record<string, string> = {
  low:    'var(--mute)',
  medium: 'var(--stage-contacted)',
  high:   'var(--warn)',
  urgent: 'var(--stage-lost)',
};
const PRIORITY_LEVEL: Record<string, number> = { low: 1, medium: 2, high: 3, urgent: 4 };

function PriorityBars({ priority }: { priority: string }) {
  const level = PRIORITY_LEVEL[priority] ?? 2;
  const color = PRIORITY_COLOR[priority] ?? 'var(--mute)';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'flex-end', gap: 1.5, flexShrink: 0 }} title={`${priority} priority`}>
      {[1, 2, 3, 4].map(i => (
        <span key={i} style={{ width: 2.5, height: 3 + i * 2.5, borderRadius: 1, background: i <= level ? color : 'var(--line)', flexShrink: 0 }} />
      ))}
    </span>
  );
}

export function isoToUTC(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function utcToISO(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setUTCDate(d.getUTCDate() + n);
  return x;
}

export function getMondayISO(todayISO: string): string {
  const d = isoToUTC(todayISO);
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  return utcToISO(addDays(d, diff));
}

// Label for the week starting at weekStartISO, e.g. "Jun 2 – 8".
export function weekRangeLabel(weekStartISO: string): string {
  const first = isoToUTC(weekStartISO);
  const last = addDays(first, 6);
  return first.getUTCMonth() === last.getUTCMonth()
    ? `${MON[first.getUTCMonth()]} ${first.getUTCDate()} – ${last.getUTCDate()}`
    : `${MON[first.getUTCMonth()]} ${first.getUTCDate()} – ${MON[last.getUTCMonth()]} ${last.getUTCDate()}`;
}

// Label for the month of the given weekStartISO, e.g. "June 2026".
export function monthLabel(weekStartISO: string): string {
  const d = isoToUTC(weekStartISO);
  return `${MONTH_FULL[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

// Returns the Monday-ISO of the first week to show for the month containing weekStartISO.
function getMonthFirstWeekMonday(weekStartISO: string): string {
  const d = isoToUTC(weekStartISO);
  const firstOfMonth = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  const dow = firstOfMonth.getUTCDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  return utcToISO(addDays(firstOfMonth, diff));
}

// Returns the Monday-ISO for the same weekday in the next month.
export function nextMonthMonday(weekStartISO: string): string {
  const d = isoToUTC(weekStartISO);
  const nextMonth = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
  const dow = nextMonth.getUTCDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  return utcToISO(addDays(nextMonth, diff));
}

// Returns the Monday-ISO for the first week of the previous month.
export function prevMonthMonday(weekStartISO: string): string {
  const d = isoToUTC(weekStartISO);
  const prevMonth = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1));
  const dow = prevMonth.getUTCDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  return utcToISO(addDays(prevMonth, diff));
}

export function taskDueISO(task: Task): string | null {
  if (!task.dueDate) return null;
  const d = new Date(task.dueDate as any);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Build a new due date on the target day, preserving the original time-of-day.
export function rescheduleDate(task: Task, iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  const prev = task.dueDate ? new Date(task.dueDate as any) : null;
  const h = prev ? prev.getHours() : 9;
  const min = prev ? prev.getMinutes() : 0;
  return new Date(y, m - 1, d, h, min);
}

interface Props {
  tasks: Task[];
  categories: TaskCategory[];
  activeId: number | null;
  onSelect: (id: number) => void;
  todayISO: string;
  /** Controlled week start (Monday ISO) — navigation lives in the page top bar. */
  weekStart: string;
  /** Compact mode: day columns cap at ~2 rows then scroll; component sizes to content. */
  compact?: boolean;
  /** Monthly mode: show 5 weeks covering the month containing weekStart. */
  monthly?: boolean;
  /** Hide Saturday and Sunday columns. */
  hideWeekends?: boolean;
}

// Compact day body fits ~2 task cards, then scrolls.
const CAL_BODY_H = 112;

// ── Draggable agenda card (matches the Calendar page's event cards) ────
function AgendaCard({
  task, catName, isActive, onSelect,
}: { task: Task; catName: string; isActive: boolean; onSelect: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `cal:${task.id}` });
  const done = task.status === 'done';
  const statusColor = STATUS_EDGE[task.status ?? 'todo'] ?? 'var(--mute)';
  const leftBorder = isActive ? 'var(--wine-soft)' : statusColor;
  const firstNameOnly = task.assigneeName ? task.assigneeName.split(' ')[0] : null;

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
      style={{
        textAlign: 'left', width: '100%', cursor: 'grab', touchAction: 'none',
        background: isActive ? 'var(--wine)' : 'var(--card)',
        borderLeft: `3px solid ${leftBorder}`,
        borderRadius: 'var(--r-button)',
        boxShadow: isActive ? 'var(--sh-raised-medium)' : 'var(--sh-raised-crisp)',
        padding: '5px 8px', overflow: 'hidden', flexShrink: 0,
        transition: 'box-shadow 120ms',
        opacity: isDragging ? 0.35 : done ? 0.62 : 1,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{
          flex: 1, fontSize: 11.5, fontWeight: 600,
          color: isActive ? 'var(--paper)' : 'var(--ink)',
          textDecoration: done ? 'line-through' : 'none',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {task.title}
        </span>
        <PriorityBars priority={task.priority ?? 'medium'} />
      </div>
      {(catName || firstNameOnly) && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
          <div style={{
            fontFamily: 'var(--mono)', fontSize: 8,
            color: isActive ? 'rgba(255,250,240,0.7)' : 'var(--mute-2)',
            textTransform: 'uppercase' as const, letterSpacing: '0.06em',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
          }}>
            {catName}
          </div>
          {firstNameOnly && (
            <span style={{
              fontFamily: 'var(--mono)', fontSize: 8, fontWeight: 600, flexShrink: 0,
              color: isActive ? 'rgba(255,250,240,0.6)' : 'var(--mute)',
              letterSpacing: '0.04em',
            }}>
              {firstNameOnly}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ── Droppable day column ───────────────────────────────────────────────
function DayColumn({
  iso, isToday, isWeekend, firstCol, dow, dateNum, dayTasks, catMap, activeId, onSelect, compact, dimmed,
}: {
  iso: string; isToday: boolean; isWeekend: boolean; firstCol: boolean;
  dow: string; dateNum: number; dayTasks: Task[];
  catMap: Map<number, TaskCategory>; activeId: number | null; onSelect: (id: number) => void;
  compact?: boolean; dimmed?: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: iso });
  return (
    <div
      style={{
        flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0,
        borderLeft: firstCol ? 'none' : '1px solid var(--line)',
        background: isOver ? 'rgba(94,34,48,0.06)' : isToday ? 'rgba(94,34,48,0.022)' : isWeekend ? 'var(--bg-2)' : 'transparent',
        transition: 'background 120ms',
        opacity: dimmed ? 0.45 : 1,
      }}
    >
      {/* Day header — compact: number + weekday side by side */}
      <div style={{ padding: '5px 8px', flexShrink: 0, borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          minWidth: 22, height: 22, borderRadius: 'var(--r-button)',
          fontFamily: 'var(--serif)', fontSize: 15,
          color: isToday ? 'var(--paper)' : 'var(--ink)',
          background: isToday ? 'var(--wine)' : 'transparent',
          boxShadow: isToday ? 'var(--sh-raised-crisp)' : 'none',
        }}>
          {dateNum}
        </span>
        <span style={{
          fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.1em',
          textTransform: 'uppercase' as const,
          color: isToday ? 'var(--wine)' : 'var(--mute-2)', fontWeight: 700,
        }}>
          {dow}
        </span>
      </div>

      {/* Day body — scrollable, droppable task stack (capped to ~2 rows when compact) */}
      <div ref={setNodeRef} style={{ ...(compact ? { height: CAL_BODY_H } : { flex: 1, minHeight: 0 }), overflowY: 'auto', padding: '8px 7px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {dayTasks.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', alignItems: isOver ? 'center' : 'flex-start', justifyContent: 'center', paddingTop: isOver ? 0 : 14, color: 'var(--mute-2)', opacity: isOver ? 0.8 : 0.5 }}>
            {isOver
              ? <span style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: 'var(--wine)' }}>Drop</span>
              : <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'currentColor' }} />}
          </div>
        ) : (
          dayTasks.map(t => {
            const cat = t.categoryId ? catMap.get(t.categoryId) : null;
            return (
              <AgendaCard
                key={t.id}
                task={t}
                catName={cat?.name ?? ''}
                isActive={t.id === activeId}
                onSelect={() => onSelect(t.id)}
              />
            );
          })
        )}
      </div>
    </div>
  );
}

// Presentational only — drag + week navigation are handled by TasksPage.
export default function TasksWeekCalendar({ tasks, categories, activeId, onSelect, todayISO, weekStart, compact, monthly, hideWeekends }: Props) {
  const catMap = useMemo(() => new Map(categories.map(c => [c.id, c])), [categories]);

  // For monthly mode: build 5 week rows covering the month
  const monthWeekStarts = useMemo(() => {
    if (!monthly) return null;
    const firstMonday = getMonthFirstWeekMonday(weekStart);
    return Array.from({ length: 5 }, (_, i) => utcToISO(addDays(isoToUTC(firstMonday), i * 7)));
  }, [monthly, weekStart]);

  const weekDays = useMemo(() => {
    if (monthly) return []; // use monthWeekStarts instead
    const s = isoToUTC(weekStart);
    return Array.from({ length: 7 }, (_, i) => addDays(s, i));
  }, [monthly, weekStart]);

  // All visible ISOs (7 for weekly, 35 for monthly)
  const visibleISOs = useMemo(() => {
    if (monthly && monthWeekStarts) {
      const isos: string[] = [];
      for (const ws of monthWeekStarts) {
        for (let i = 0; i < 7; i++) isos.push(utcToISO(addDays(isoToUTC(ws), i)));
      }
      return isos;
    }
    return weekDays.map(d => utcToISO(d));
  }, [monthly, monthWeekStarts, weekDays]);

  const isoSet = useMemo(() => new Set(visibleISOs), [visibleISOs]);

  // Expand recurring tasks across all visible days
  const tasksByDay = useMemo(() => {
    const map = new Map<string, Task[]>();

    const addTo = (iso: string, t: Task) => {
      if (!isoSet.has(iso)) return;
      const arr = map.get(iso) ?? [];
      arr.push(t);
      map.set(iso, arr);
    };

    for (const t of tasks) {
      const anchor = taskDueISO(t);

      if (!t.isRecurring || !anchor) {
        if (anchor) addTo(anchor, t);
        continue;
      }

      const period = t.recurringPeriod ?? 'weekly';
      const anchorDate = isoToUTC(anchor);

      for (const iso of visibleISOs) {
        const d = isoToUTC(iso);
        const dow = d.getUTCDay();

        if (period === 'daily') {
          if (dow === 0 || dow === 6) continue;
          if (d.getTime() >= anchorDate.getTime()) addTo(iso, t);
        } else if (period === 'weekly') {
          if (d.getUTCDay() === anchorDate.getUTCDay() && d.getTime() >= anchorDate.getTime()) addTo(iso, t);
        } else if (period === 'biweekly') {
          const diffDays = Math.round((d.getTime() - anchorDate.getTime()) / 86400000);
          if (d.getUTCDay() === anchorDate.getUTCDay() && diffDays >= 0 && diffDays % 14 === 0) addTo(iso, t);
        } else if (period === 'monthly') {
          if (d.getUTCDate() === anchorDate.getUTCDate() && d.getTime() >= anchorDate.getTime()) addTo(iso, t);
        }
      }
    }

    return map;
  }, [tasks, visibleISOs, isoSet]);

  // ── Monthly view ─────────────────────────────────────────────────────
  if (monthly && monthWeekStarts) {
    const monthYear = isoToUTC(weekStart);
    const currentMonth = monthYear.getUTCMonth();
    return (
      <div style={{ flex: 1, width: '100%', minWidth: 0, background: 'var(--bg-2)', display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden', borderRadius: 'var(--r-card)', border: '1px solid var(--line)' }}>
        {monthWeekStarts.map((ws, wi) => {
          const days = Array.from({ length: 7 }, (_, i) => addDays(isoToUTC(ws), i))
            .filter(d => !hideWeekends || (d.getUTCDay() !== 0 && d.getUTCDay() !== 6));
          return (
            <div key={ws} style={{ flex: '1 1 0', minHeight: 0, display: 'flex', borderTop: wi > 0 ? '1px solid var(--line)' : 'none', overflow: 'hidden' }}>
              {days.map((d, di) => {
                const iso = utcToISO(d);
                const outOfMonth = d.getUTCMonth() !== currentMonth;
                return (
                  <DayColumn
                    key={iso}
                    iso={iso}
                    isToday={iso === todayISO}
                    isWeekend={d.getUTCDay() === 0 || d.getUTCDay() === 6}
                    firstCol={di === 0}
                    dow={DOW[d.getUTCDay()]}
                    dateNum={d.getUTCDate()}
                    dayTasks={tasksByDay.get(iso) ?? []}
                    catMap={catMap}
                    activeId={activeId}
                    onSelect={onSelect}
                    compact={false}
                    dimmed={outOfMonth}
                  />
                );
              })}
            </div>
          );
        })}
      </div>
    );
  }

  // ── Weekly view ──────────────────────────────────────────────────────
  const visibleWeekDays = hideWeekends
    ? weekDays.filter(d => d.getUTCDay() !== 0 && d.getUTCDay() !== 6)
    : weekDays;

  return (
    <div style={{ ...(compact ? { flex: '0 0 auto' } : { flex: 1 }), width: '100%', minWidth: 0, background: 'var(--bg-2)', display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden', borderRadius: 'var(--r-card)', border: '1px solid var(--line)' }}>
      <div style={{ ...(compact ? { flex: '0 0 auto' } : { flex: 1, minHeight: 0 }), display: 'flex', overflow: 'hidden' }}>
        {visibleWeekDays.map((d, di) => {
          const iso = utcToISO(d);
          return (
            <DayColumn
              key={iso}
              iso={iso}
              isToday={iso === todayISO}
              isWeekend={d.getUTCDay() === 0 || d.getUTCDay() === 6}
              firstCol={di === 0}
              dow={DOW[d.getUTCDay()]}
              dateNum={d.getUTCDate()}
              dayTasks={tasksByDay.get(iso) ?? []}
              catMap={catMap}
              activeId={activeId}
              onSelect={onSelect}
              compact={compact}
            />
          );
        })}
      </div>
    </div>
  );
}
