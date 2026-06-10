import type { Task } from "@shared/schema";

interface AccountUser { id: number; fullName1: string | null; email: string | null; avatarUrl: string | null; }

interface Props {
  task: Task;
  active: boolean;
  onSelect: () => void;
  categoryColor: string;
  categoryName: string;
  todayISO: string;
  users?: AccountUser[];
  commentCount?: number;
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// Left-edge color follows task status
const STATUS_EDGE: Record<string, string> = {
  todo:        'var(--mute)',
  in_progress: 'var(--stage-contacted)',
  waiting:     'var(--warn)',
  done:        'var(--good)',
};

// Signal-bar colors by priority level
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
    <span style={{ display: 'inline-flex', alignItems: 'flex-end', gap: 1.5 }} title={`${priority} priority`}>
      {[1, 2, 3, 4].map(i => (
        <span key={i} style={{
          width: 3,
          height: 4 + i * 3,
          borderRadius: 1,
          background: i <= level ? color : 'var(--line)',
          flexShrink: 0,
        }} />
      ))}
    </span>
  );
}

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
  const COLORS = ['#5E2230', '#3D2A66', '#2F5E4A', '#5E4A22', '#3D7EAA', '#607080'];
  if (!name) return COLORS[0];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffff;
  return COLORS[Math.abs(h) % COLORS.length];
}

export default function TasksBoardCard({ task, active, onSelect, categoryColor, categoryName, todayISO, users = [], commentCount = 0 }: Props) {
  const { label: dueLabel, color: dueColor } = getDueInfo(task.dueDate, todayISO);
  const done = task.status === 'done';
  const edgeColor = STATUS_EDGE[task.status ?? 'todo'] ?? 'var(--mute)';

  // Resolve assignee avatar from users list
  const assigneeUser = task.assigneeName
    ? users.find(u => u.fullName1 === task.assigneeName || u.email === task.assigneeName)
    : null;

  return (
    <div
      onClick={onSelect}
      style={{
        background: 'var(--card)',
        borderRadius: 'var(--r-surface)',
        padding: '13px 14px',
        cursor: 'pointer',
        borderLeft: `3px solid ${edgeColor}`,
        boxShadow: active
          ? 'var(--sh-raised-medium), 0 0 0 1.5px var(--wine)'
          : 'var(--sh-raised-crisp)',
        transition: 'box-shadow 120ms',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <span style={{
          fontSize: 15, fontWeight: 600, color: 'var(--ink)',
          textDecoration: done ? 'line-through' : 'none',
          lineHeight: 1.3,
        }}>
          {task.title}
        </span>
        <PriorityBars priority={task.priority ?? 'medium'} />
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
        {/* Category tag */}
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 7, height: 7, borderRadius: 2, background: categoryColor, flexShrink: 0 }} />
          <span style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: 'var(--mute)' }}>
            {categoryName || 'Uncategorized'}
          </span>
        </span>

        {/* Right cluster: comment icon, due date, assignee */}
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
          {commentCount > 0 && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: 'var(--mute-2)' }} title={`${commentCount} comment${commentCount > 1 ? 's' : ''}`}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 8.5, color: 'var(--mute-2)' }}>{commentCount}</span>
            </span>
          )}
          {dueLabel && (
            <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: dueColor, fontWeight: dueLabel === 'Today' || dueLabel === 'Overdue' ? 700 : 400 }}>
              {dueLabel}
            </span>
          )}
          {task.assigneeName && (
            <span
              style={{
                width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                background: assigneeUser?.avatarUrl ? 'transparent' : nameColor(task.assigneeName),
                boxShadow: 'var(--sh-raised-crisp)',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                overflow: 'hidden',
                fontFamily: 'var(--mono)', fontSize: 8, fontWeight: 700, letterSpacing: '0.02em',
                color: '#fff',
              }}
              title={task.assigneeName}
            >
              {assigneeUser?.avatarUrl ? (
                <img src={assigneeUser.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                getInitials(task.assigneeName)
              )}
            </span>
          )}
        </span>
      </div>
    </div>
  );
}
