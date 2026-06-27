// tasks-views.jsx — Tasks primitives + List (grouped table) + Board (kanban).
// Schedule (table + week calendar) + header + orchestrator live in tasks-app.jsx.
// Depends on: components.jsx (Icon, Sidebar, icons), tasks-data.js (LA_TASKS)

// ─── Local icons ───────────────────────────────────────────────────
const TIconList   = (p) => <Icon {...p} d={<><path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3.5" cy="6" r="1"/><circle cx="3.5" cy="12" r="1"/><circle cx="3.5" cy="18" r="1"/></>} />;
const TIconBoard  = (p) => <Icon {...p} d={<><rect x="3" y="4" width="5" height="16" rx="1.5"/><rect x="10" y="4" width="5" height="11" rx="1.5"/><rect x="17" y="4" width="4" height="14" rx="1.5"/></>} />;
const TIconSplit  = (p) => <Icon {...p} d={<><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M13 4v16"/><path d="M6.5 8h3.5M6.5 11h3.5M6.5 14h2"/></>} />;
const TIconChevL  = (p) => <Icon {...p} d={<path d="m15 18-6-6 6-6"/>} />;
const TIconChevR  = (p) => <Icon {...p} d={<path d="m9 6 6 6-6 6"/>} />;
const TIconPlus   = (p) => <Icon {...p} d={<path d="M12 5v14M5 12h14"/>} />;
const TIconSearch = (p) => <Icon {...p} d={<><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></>} />;
const TIconFilter = (p) => <Icon {...p} d={<path d="M3 5h18l-7 8v6l-4-2v-4z"/>} />;
const TIconGroup  = (p) => <Icon {...p} d={<><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>} />;
const TIconCheck  = (p) => <Icon {...p} d={<path d="m5 12 5 5 9-12"/>} />;
const TIconClock  = (p) => <Icon {...p} d={<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>} />;
const TIconFlag   = (p) => <Icon {...p} d={<><path d="M5 21V4M5 4h12l-2 4 2 4H5"/></>} />;
const TIconCal    = (p) => <Icon {...p} d={<><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></>} />;

// ─── Date helpers (UTC) ────────────────────────────────────────────
const T_DOW  = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const T_MON  = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function tParse(iso) { const [y, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); }
function tIso(d) { return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`; }
function tAdd(d, n) { const x = new Date(d); x.setUTCDate(d.getUTCDate() + n); return x; }
function tHm(s) { const [h, m] = s.split(':').map(Number); return h + m / 60; }
function tFmt(s) { let [h, m] = s.split(':').map(Number); const ap = h < 12 ? 'AM' : 'PM'; let hh = h % 12; if (hh === 0) hh = 12; return `${hh}:${String(m).padStart(2, '0')} ${ap}`; }
function tDueLabel(iso, todayISO) {
  const days = Math.round((tParse(iso) - tParse(todayISO)) / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days === -1) return 'Yesterday';
  const d = tParse(iso);
  return `${T_MON[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

// ─── Primitives ────────────────────────────────────────────────────
function Avatar({ who, size = 26 }) {
  const p = window.LA_TASKS.people[who];
  return (
    <span title={p.name} style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: p.color, color: '#fff', boxShadow: 'var(--sh-raised-crisp)',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'var(--mono)', fontSize: size * 0.36, fontWeight: 700, letterSpacing: '0.02em',
    }}>{p.ini}</span>
  );
}

function PriorityFlag({ k }) {
  const p = window.LA_TASKS.PRIORITY[k];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
      <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{p.label}</span>
    </span>
  );
}

function StatusPill({ k }) {
  const s = window.LA_TASKS.STATUS[k];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 'var(--r-pill)',
      background: s.tint, color: s.color,
      fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 700,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.color }} />{s.label}
    </span>
  );
}

function CategoryTag({ k }) {
  const c = window.LA_TASKS.CATEGORY[k];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span style={{ width: 8, height: 8, borderRadius: 3, background: c.color, flexShrink: 0 }} />
      <span style={{ fontSize: 12, color: 'var(--mute)' }}>{c.label}</span>
    </span>
  );
}

function Checkbox({ on, onClick }) {
  return (
    <button onClick={(e) => { e.stopPropagation(); onClick && onClick(); }} style={{
      width: 20, height: 20, flexShrink: 0, borderRadius: 'var(--r-flush)', cursor: 'pointer', padding: 0,
      border: 'none', background: on ? 'var(--good)' : 'var(--bg)',
      boxShadow: on ? 'var(--sh-raised-crisp)' : 'var(--sh-inset-crisp)',
      color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    }}>{on && <TIconCheck size={13} />}</button>
  );
}

// ═══ LIST — grouped table ══════════════════════════════════════════
const T_COLS = [
  { key: 'task',     label: 'Task',     flex: '1 1 320px' },
  { key: 'assignee', label: 'Assignee', w: 130 },
  { key: 'priority', label: 'Priority', w: 120 },
  { key: 'status',   label: 'Status',   w: 140 },
  { key: 'due',      label: 'Due',      w: 110 },
  { key: 'category', label: 'Category', w: 150 },
];

function TaskRow({ task, active, onClick, onToggle }) {
  const done = task.status === 'done';
  const T = window.LA_TASKS;
  return (
    <div onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 14, padding: '0 22px', height: 60, cursor: 'pointer',
      borderBottom: '1px solid var(--line)',
      background: active ? 'var(--surface)' : 'transparent',
      boxShadow: active ? 'inset 3px 0 0 var(--wine)' : 'none',
      transition: 'background 120ms',
    }}
    onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'var(--surface)'; }}
    onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}>
      <Checkbox on={done} onClick={() => onToggle && onToggle(task.id)} />
      <div style={{ flex: '1 1 320px', minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: done ? 'var(--mute-2)' : 'var(--ink)', textDecoration: done ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.title}</div>
        <div style={{ fontSize: 11.5, color: 'var(--mute-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>{task.sub}</div>
      </div>
      <div style={{ width: 130, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 9 }}>
        <Avatar who={task.who} size={26} />
        <span style={{ fontSize: 12, color: 'var(--ink-soft)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{T.people[task.who].short}</span>
      </div>
      <div style={{ width: 120, flexShrink: 0 }}><PriorityFlag k={task.priority} /></div>
      <div style={{ width: 140, flexShrink: 0 }}><StatusPill k={task.status} /></div>
      <div style={{ width: 110, flexShrink: 0 }}>
        <DueLabel due={task.due} />
      </div>
      <div style={{ width: 150, flexShrink: 0 }}><CategoryTag k={task.category} /></div>
    </div>
  );
}

function DueLabel({ due }) {
  const T = window.LA_TASKS;
  const days = Math.round((tParse(due) - tParse(T.today)) / 86400000);
  const overdue = days < 0;
  const soon = days === 0;
  return (
    <span style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: overdue || soon ? 700 : 400, color: overdue ? 'var(--stage-lost)' : soon ? 'var(--wine)' : 'var(--mute)' }}>
      {tDueLabel(due, T.today)}
    </span>
  );
}

function GroupBar({ label, count, accent }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 22px', height: 38, background: 'var(--bg-2)', borderBottom: '1px solid var(--line)' }}>
      <span style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: accent || 'var(--ink-soft)', fontWeight: 700 }}>{label}</span>
      <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--mute-2)', background: 'var(--card)', boxShadow: 'var(--sh-raised-crisp)', borderRadius: 'var(--r-pill)', padding: '1px 8px' }}>{count}</span>
    </div>
  );
}

function groupTasks(tasks, todayISO) {
  const g = { Overdue: [], Today: [], 'This Week': [], Upcoming: [], Completed: [] };
  const today = tParse(todayISO);
  const weekEnd = tAdd(today, 7 - ((today.getUTCDay() + 6) % 7));   // Sunday of this week
  tasks.forEach(t => {
    if (t.status === 'done') { g.Completed.push(t); return; }
    const d = tParse(t.due);
    const days = Math.round((d - today) / 86400000);
    if (days < 0) g.Overdue.push(t);
    else if (days === 0) g.Today.push(t);
    else if (d <= weekEnd) g['This Week'].push(t);
    else g.Upcoming.push(t);
  });
  return g;
}

function TaskTable({ tasks, activeId, onSelect, onToggle, dense }) {
  const T = window.LA_TASKS;
  const groups = groupTasks(tasks, T.today);
  const order = [
    ['Overdue', 'var(--stage-lost)'], ['Today', 'var(--wine)'], ['This Week', null], ['Upcoming', null], ['Completed', 'var(--good)'],
  ];
  return (
    <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
      <div style={{ minWidth: dense ? 0 : 940 }}>
        {/* column header */}
        {!dense && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '0 22px', height: 42, borderBottom: '1px solid var(--line)', position: 'sticky', top: 0, background: 'var(--card)', zIndex: 3 }}>
            <span style={{ width: 20, flexShrink: 0 }} />
            {T_COLS.map(c => (
              <span key={c.key} style={{ flex: c.flex || `0 0 ${c.w}px`, width: c.w, fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--mute-2)' }}>{c.label}</span>
            ))}
          </div>
        )}
        {order.map(([label, accent]) => groups[label].length > 0 && (
          <React.Fragment key={label}>
            <GroupBar label={label} count={groups[label].length} accent={accent} />
            {groups[label].map(t => (
              <TaskRow key={t.id} task={t} active={t.id === activeId} onClick={() => onSelect && onSelect(t.id)} onToggle={onToggle} />
            ))}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

// ═══ BOARD — kanban by status ══════════════════════════════════════
function BoardCard({ task, active, onClick }) {
  const T = window.LA_TASKS;
  const cat = T.CATEGORY[task.category];
  const pr = T.PRIORITY[task.priority];
  const done = task.status === 'done';
  return (
    <div onClick={onClick} className="neu-raised-crisp" style={{
      background: 'var(--card)', borderRadius: 'var(--r-surface)', padding: '13px 14px', cursor: 'pointer',
      borderLeft: `3px solid ${cat.color}`,
      boxShadow: active ? 'var(--sh-raised-medium), 0 0 0 1.5px var(--wine)' : 'var(--sh-raised-crisp)',
      transition: 'box-shadow 120ms',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', textDecoration: done ? 'line-through' : 'none', textWrap: 'pretty', lineHeight: 1.3 }}>{task.title}</span>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: pr.color, flexShrink: 0, marginTop: 5 }} title={pr.label + ' priority'} />
      </div>
      <div style={{ fontSize: 11, color: 'var(--mute-2)', marginTop: 4, textWrap: 'pretty', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{task.sub}</div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 11 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 7, height: 7, borderRadius: 2, background: cat.color }} />
          <span style={{ fontFamily: 'var(--mono)', fontSize: 8.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--mute)' }}>{cat.label}</span>
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--mute-2)' }}>{tDueLabel(task.due, T.today)}</span>
          <Avatar who={task.who} size={22} />
        </span>
      </div>
    </div>
  );
}

function Board({ tasks, activeId, onSelect }) {
  const T = window.LA_TASKS;
  const cols = ['todo', 'inprogress', 'waiting', 'done'];
  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 14, padding: '16px 16px 6px', overflowX: 'auto' }}>
      {cols.map(k => {
        const s = T.STATUS[k];
        const items = tasks.filter(t => t.status === k);
        return (
          <div key={k} style={{ flex: '1 1 0', minWidth: 244, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '0 6px 12px', flexShrink: 0 }}>
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: s.color }} />
              <span style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-soft)', fontWeight: 700 }}>{s.label}</span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--mute-2)', background: 'var(--card)', boxShadow: 'var(--sh-raised-crisp)', borderRadius: 'var(--r-pill)', padding: '1px 8px', marginLeft: 'auto' }}>{items.length}</span>
            </div>
            <div className="neu-inset" style={{ flex: 1, minHeight: 0, borderRadius: 'var(--r-card)', padding: 10, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, background: 'var(--bg-2)' }}>
              {items.length === 0
                ? <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 70, fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--mute-2)' }}>Empty</div>
                : items.map(t => <BoardCard key={t.id} task={t} active={t.id === activeId} onClick={() => onSelect && onSelect(t.id)} />)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

Object.assign(window, {
  TIconList, TIconBoard, TIconSplit, TIconChevL, TIconChevR, TIconPlus, TIconSearch, TIconFilter, TIconGroup, TIconCheck, TIconClock, TIconFlag, TIconCal,
  T_DOW, T_MON, tParse, tIso, tAdd, tHm, tFmt, tDueLabel,
  Avatar, PriorityFlag, StatusPill, CategoryTag, Checkbox,
  TaskRow, DueLabel, GroupBar, groupTasks, TaskTable, BoardCard, Board,
});
