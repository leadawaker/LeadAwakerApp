import { useDroppable, useDraggable } from "@dnd-kit/core";
import type { Task, TaskCategory } from "@shared/schema";
import TasksBoardCard from "./TasksBoardCard";

interface Props {
  tasks: Task[];
  categories: TaskCategory[];
  activeId: number | null;
  onSelect: (id: number) => void;
  todayISO: string;
}

export const BOARD_COLS = [
  { key: 'todo',        label: 'To Do',       color: 'var(--mute)' },
  { key: 'in_progress', label: 'In Progress',  color: 'var(--stage-contacted)' },
  { key: 'waiting',     label: 'Waiting',      color: 'var(--warn)' },
  { key: 'done',        label: 'Done',         color: 'var(--good)' },
] as const;

// ── Draggable card ─────────────────────────────────────────────────────
function DraggableCard({
  task, active, onSelect, categoryColor, categoryName, todayISO,
}: {
  task: Task; active: boolean; onSelect: () => void;
  categoryColor: string; categoryName: string; todayISO: string;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{ touchAction: 'none', cursor: 'grab', opacity: isDragging ? 0.4 : 1 }}
    >
      <TasksBoardCard
        task={task}
        active={active}
        onSelect={onSelect}
        categoryColor={categoryColor}
        categoryName={categoryName}
        todayISO={todayISO}
      />
    </div>
  );
}

// ── Droppable column ───────────────────────────────────────────────────
function Column({
  col, items, categories, activeId, onSelect, todayISO,
}: {
  col: (typeof BOARD_COLS)[number]; items: Task[]; categories: TaskCategory[];
  activeId: number | null; onSelect: (id: number) => void; todayISO: string;
}) {
  const catMap = new Map(categories.map(c => [c.id, c]));
  const { setNodeRef, isOver } = useDroppable({ id: `col-${col.key}`, data: { status: col.key } });

  return (
    <div style={{ flex: '1 1 0', minWidth: 244, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {/* Column header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '0 6px 12px', flexShrink: 0 }}>
        <span style={{ width: 9, height: 9, borderRadius: '50%', background: col.color }} />
        <span style={{
          fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.12em',
          textTransform: 'uppercase' as const, color: 'var(--ink-soft)', fontWeight: 700,
        }}>
          {col.label}
        </span>
        <span style={{
          fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--mute-2)',
          background: 'var(--card)', boxShadow: 'var(--sh-raised-crisp)',
          borderRadius: 'var(--r-pill)', padding: '1px 8px', marginLeft: 'auto',
        }}>
          {items.length}
        </span>
      </div>

      {/* Column body */}
      <div
        ref={setNodeRef}
        className="neu-inset"
        style={{
          flex: 1, minHeight: 0, borderRadius: 'var(--r-card)', padding: 10,
          overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10,
          background: 'var(--bg-2)',
          boxShadow: isOver ? 'inset 0 0 0 1.5px var(--wine)' : undefined,
          transition: 'box-shadow 120ms',
        }}
      >
        {items.length === 0 ? (
          <div style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 70,
            fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.12em',
            textTransform: 'uppercase' as const, color: 'var(--mute-2)',
          }}>
            {isOver ? 'Drop here' : 'Empty'}
          </div>
        ) : (
          items.map(t => {
            const cat = t.categoryId ? catMap.get(t.categoryId) : null;
            return (
              <DraggableCard
                key={t.id}
                task={t}
                active={t.id === activeId}
                onSelect={() => onSelect(t.id)}
                categoryColor={cat?.color ?? 'var(--mute-2)'}
                categoryName={cat?.name ?? ''}
                todayISO={todayISO}
              />
            );
          })
        )}
      </div>
    </div>
  );
}

// Presentational only — drag is handled by the shared DndContext in TasksPage.
export default function TasksBoardView({ tasks, categories, activeId, onSelect, todayISO }: Props) {
  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 14, padding: '16px 16px 6px', overflowX: 'auto' }}>
      {BOARD_COLS.map(col => (
        <Column
          key={col.key}
          col={col}
          items={tasks.filter(t => t.status === col.key)}
          categories={categories}
          activeId={activeId}
          onSelect={onSelect}
          todayISO={todayISO}
        />
      ))}
    </div>
  );
}
