import type { Task } from "@shared/schema";

interface Props {
  task: Task;
  active: boolean;
  onSelect: () => void;
  categoryColor: string;
  categoryName: string;
  todayISO: string;
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const PRIORITY_COLORS: Record<string, string> = {
  low: 'var(--mute)',
  medium: 'var(--stage-contacted)',
  high: 'var(--warn)',
  urgent: 'var(--stage-lost)',
};

function getDueInfo(dueDate: Date | string | null, todayISO: string): { label: string | null; color: string } {
  if (!dueDate) return { label: null, color: 'var(--mute-2)' };
  const due = new Date(dueDate as any);
  const [ty, tm, td] = todayISO.split('-').map(Number);
  const today = new Date(Date.UTC(ty, tm - 1, td));
  const dueUTC = new Date(Date.UTC(due.getFullYear(), due.getMonth(), due.getDate()));
  const days = Math.round((dueUTC.getTime() - today.getTime()) / 86400000);
  if (days < 0) return { label: 'Overdue', color: 'var(--stage-lost)' };
  if (days === 0) return { label: 'Today', color: 'var(--wine)' };
  if (days === 1) return { label: 'Tomorrow', color: 'var(--mute-2)' };
  return { label: `${MONTHS[due.getMonth()]} ${due.getDate()}`, color: 'var(--mute-2)' };
}

function getInitials(name: string | null | undefined): string {
  if (!name) return '?';
  return name.trim().split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function nameColor(name: string | null | undefined): string {
  const COLORS = ['#7B5EA7', '#3D7EAA', '#5E9E6E', '#C07850', '#A0522D', '#607080'];
  if (!name) return COLORS[0];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffff;
  return COLORS[Math.abs(h) % COLORS.length];
}

export default function TasksBoardCard({ task, active, onSelect, categoryColor, categoryName, todayISO }: Props) {
  const { label: dueLabel, color: dueColor } = getDueInfo(task.dueDate, todayISO);
  const priorityColor = PRIORITY_COLORS[task.priority ?? 'medium'] ?? 'var(--mute)';
  const done = task.status === 'done';

  return (
    <div
      onClick={onSelect}
      style={{
        background: 'var(--card)',
        borderRadius: 'var(--r-surface)',
        padding: '13px 14px',
        cursor: 'pointer',
        borderLeft: `3px solid ${categoryColor}`,
        boxShadow: active
          ? 'var(--sh-raised-medium), 0 0 0 1.5px var(--wine)'
          : 'var(--sh-raised-crisp)',
        transition: 'box-shadow 120ms',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <span style={{
          fontSize: 13, fontWeight: 600, color: 'var(--ink)',
          textDecoration: done ? 'line-through' : 'none',
          lineHeight: 1.3,
        }}>
          {task.title}
        </span>
        <span
          style={{ width: 7, height: 7, borderRadius: '50%', background: priorityColor, flexShrink: 0, marginTop: 5 }}
          title={`${task.priority ?? 'medium'} priority`}
        />
      </div>

      {task.description && (
        <div style={{
          fontSize: 11, color: 'var(--mute-2)', marginTop: 4, lineHeight: 1.4,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden',
        }}>
          {task.description}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 11 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 7, height: 7, borderRadius: 2, background: categoryColor, flexShrink: 0 }} />
          <span style={{ fontFamily: 'var(--mono)', fontSize: 8.5, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: 'var(--mute)' }}>
            {categoryName || 'Uncategorized'}
          </span>
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
          {dueLabel && (
            <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: dueColor, fontWeight: dueLabel === 'Today' || dueLabel === 'Overdue' ? 700 : 400 }}>
              {dueLabel}
            </span>
          )}
          {task.assigneeName && (
            <span
              style={{
                width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                background: nameColor(task.assigneeName), color: '#fff',
                boxShadow: 'var(--sh-raised-crisp)',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--mono)', fontSize: 8, fontWeight: 700, letterSpacing: '0.02em',
              }}
              title={task.assigneeName}
            >
              {getInitials(task.assigneeName)}
            </span>
          )}
        </span>
      </div>
    </div>
  );
}
