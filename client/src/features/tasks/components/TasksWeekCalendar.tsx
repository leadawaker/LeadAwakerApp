import { useMemo } from "react";
import { useDroppable, useDraggable } from "@dnd-kit/core";
import type { Task, TaskCategory } from "@shared/schema";

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

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
}

// Compact day body fits ~2 task cards, then scrolls.
const CAL_BODY_H = 112;

// ── Draggable agenda card (matches the Calendar page's event cards) ────
function AgendaCard({
  task, catColor, catName, isActive, onSelect,
}: { task: Task; catColor: string; catName: string; isActive: boolean; onSelect: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id });
  const done = task.status === 'done';
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
      style={{
        textAlign: 'left', width: '100%', cursor: 'grab', touchAction: 'none',
        background: isActive ? 'var(--wine)' : 'var(--card)',
        borderLeft: `3px solid ${isActive ? 'var(--wine-soft)' : catColor}`,
        borderRadius: 'var(--r-button)',
        boxShadow: isActive ? 'var(--sh-raised-medium)' : 'var(--sh-raised-crisp)',
        padding: '5px 8px', overflow: 'hidden', flexShrink: 0,
        transition: 'box-shadow 120ms',
        opacity: isDragging ? 0.35 : done ? 0.62 : 1,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{
          flex: 1, fontSize: 11.5, fontWeight: 600,
          color: isActive ? 'var(--paper)' : 'var(--ink)',
          textDecoration: done ? 'line-through' : 'none',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {task.title}
        </span>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: isActive ? 'var(--paper)' : catColor, flexShrink: 0 }} />
      </div>
      {catName && (
        <div style={{
          fontFamily: 'var(--mono)', fontSize: 8, marginTop: 2,
          color: isActive ? 'rgba(255,250,240,0.7)' : 'var(--mute-2)',
          textTransform: 'uppercase' as const, letterSpacing: '0.06em',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {catName}
        </div>
      )}
    </div>
  );
}

// ── Droppable day column ───────────────────────────────────────────────
function DayColumn({
  iso, isToday, isWeekend, firstCol, dow, dateNum, dayTasks, catMap, activeId, onSelect, compact,
}: {
  iso: string; isToday: boolean; isWeekend: boolean; firstCol: boolean;
  dow: string; dateNum: number; dayTasks: Task[];
  catMap: Map<number, TaskCategory>; activeId: number | null; onSelect: (id: number) => void;
  compact?: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: iso });
  return (
    <div
      style={{
        flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0,
        borderLeft: firstCol ? 'none' : '1px solid var(--line)',
        background: isOver ? 'rgba(94,34,48,0.06)' : isToday ? 'rgba(94,34,48,0.022)' : isWeekend ? 'var(--bg-2)' : 'transparent',
        transition: 'background 120ms',
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
                catColor={cat?.color ?? '#888888'}
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
export default function TasksWeekCalendar({ tasks, categories, activeId, onSelect, todayISO, weekStart, compact }: Props) {
  const catMap = useMemo(() => new Map(categories.map(c => [c.id, c])), [categories]);

  const weekDays = useMemo(() => {
    const s = isoToUTC(weekStart);
    return Array.from({ length: 7 }, (_, i) => addDays(s, i));
  }, [weekStart]);

  // Group tasks by due date ISO
  const tasksByDay = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of tasks) {
      const iso = taskDueISO(t);
      if (iso) {
        const arr = map.get(iso) ?? [];
        arr.push(t);
        map.set(iso, arr);
      }
    }
    return map;
  }, [tasks]);

  return (
    <div style={{ ...(compact ? { flex: '0 0 auto' } : { flex: 1 }), width: '100%', minWidth: 0, background: 'var(--bg-2)', display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>

      {/* Agenda — 7 day columns, each a droppable vertical stack of tasks due that day */}
      <div style={{ ...(compact ? { flex: '0 0 auto' } : { flex: 1, minHeight: 0 }), display: 'flex', overflow: 'hidden' }}>
        {weekDays.map((d, di) => {
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
