import { Check } from "lucide-react";
import type { Task } from "@shared/schema";

interface Props {
  task: Task;
  active: boolean;
  categoryColor: string;
  todayISO: string;
  onClick: () => void;
  onToggle: (id: number) => void;
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

export default function TasksMiniRow({ task, active, categoryColor, todayISO, onClick, onToggle }: Props) {
  const done = task.status === 'done';
  const { label: dueLabel, color: dueColor } = getDueInfo(task.dueDate, todayISO);
  const priorityColor = PRIORITY_COLORS[task.priority ?? 'medium'] ?? 'var(--mute)';

  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 11, padding: '9px 12px',
        borderRadius: 'var(--r-surface)', cursor: 'pointer',
        borderLeft: `3px solid ${categoryColor}`,
        background: active ? 'var(--card)' : 'transparent',
        boxShadow: active ? 'var(--sh-raised-crisp)' : 'none',
        transition: 'all 120ms',
      }}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'var(--surface)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = active ? 'var(--card)' : 'transparent'; }}
    >
      <button
        onClick={(e) => { e.stopPropagation(); onToggle(task.id); }}
        style={{
          width: 20, height: 20, flexShrink: 0,
          borderRadius: 'var(--r-flush)', cursor: 'pointer', padding: 0, border: 'none',
          background: done ? 'var(--good)' : 'var(--bg)',
          boxShadow: done ? 'var(--sh-raised-crisp)' : 'var(--sh-inset-crisp)',
          color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        {done && <Check size={12} />}
      </button>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 12.5, fontWeight: 600,
          color: done ? 'var(--mute-2)' : 'var(--ink)',
          textDecoration: done ? 'line-through' : 'none',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {task.title}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 3 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: priorityColor, flexShrink: 0 }} />
          {dueLabel && (
            <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: dueColor }}>{dueLabel}</span>
          )}
        </div>
      </div>

      {task.assigneeName && (
        <span
          style={{
            width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
            background: nameColor(task.assigneeName), color: '#fff',
            boxShadow: 'var(--sh-raised-crisp)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--mono)', fontSize: 8.5, fontWeight: 700,
          }}
          title={task.assigneeName}
        >
          {getInitials(task.assigneeName)}
        </span>
      )}
    </div>
  );
}
