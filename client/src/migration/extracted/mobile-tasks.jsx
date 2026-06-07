// mobile-tasks.jsx — Tasks tab for the Lead Awaker mobile app.
// Reflows the desktop Tasks page (grouped agenda + kanban board + filters +
// assignee toggle) into a single-pane phone screen. Tapping a task opens a
// detail bottom-sheet (variation B), consistent with Campaigns.
// Self-contained on purpose: depends only on tasks-data.js (LA_TASKS),
// components.jsx (icons), mobile-shell.jsx (MobSheet, IconBtn) — NOT
// tasks-views.jsx, whose StatusPill would clobber the campaign one.

// ─── Local date helpers (UTC) ──────────────────────────────────────
const MT_MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MT_DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
function mtParse(iso) { const [y, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); }
function mtAdd(d, n) { const x = new Date(d); x.setUTCDate(d.getUTCDate() + n); return x; }
function mtDue(iso, todayISO) {
  const days = Math.round((mtParse(iso) - mtParse(todayISO)) / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days === -1) return 'Yesterday';
  const d = mtParse(iso);
  return `${MT_DOW[d.getUTCDay()]} ${MT_MON[d.getUTCMonth()]} ${d.getUTCDate()}`;
}
function mtTime(s) { let [h, m] = s.split(':').map(Number); const ap = h < 12 ? 'AM' : 'PM'; let hh = h % 12; if (hh === 0) hh = 12; return `${hh}:${String(m).padStart(2, '0')} ${ap}`; }
function mtGroup(tasks, todayISO) {
  const g = { Overdue: [], Today: [], 'This Week': [], Upcoming: [], Completed: [] };
  const today = mtParse(todayISO);
  const weekEnd = mtAdd(today, 7 - ((today.getUTCDay() + 6) % 7));
  tasks.forEach(t => {
    if (t.status === 'done') { g.Completed.push(t); return; }
    const d = mtParse(t.due);
    const days = Math.round((d - today) / 86400000);
    if (days < 0) g.Overdue.push(t);
    else if (days === 0) g.Today.push(t);
    else if (d <= weekEnd) g['This Week'].push(t);
    else g.Upcoming.push(t);
  });
  return g;
}

// ─── Small inline glyphs (avoid colliding with task-views icons) ───
const MTCheckGlyph = ({ s = 13 }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 5 5 9-12" /></svg>;
const MTClock = ({ s = 11 }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;

// ─── Task primitives (mobile-scoped) ───────────────────────────────
function MTAvatar({ who, size = 26 }) {
  const p = window.LA_TASKS.people[who];
  return (
    <span title={p.name} style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: p.color, color: '#fff', boxShadow: 'var(--sh-raised-crisp)',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'var(--mono)', fontSize: size * 0.36, fontWeight: 700,
    }}>{p.ini}</span>
  );
}

function MTStatusPill({ k }) {
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

function MTCheckbox({ on, onClick }) {
  return (
    <button onClick={(e) => { e.stopPropagation(); onClick && onClick(); }} style={{
      width: 24, height: 24, flexShrink: 0, borderRadius: 'var(--r-flush)', cursor: 'pointer', padding: 0,
      border: 'none', background: on ? 'var(--good)' : 'var(--bg)',
      boxShadow: on ? 'var(--sh-raised-crisp)' : 'var(--sh-inset-crisp)',
      color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    }}>{on && <MTCheckGlyph />}</button>
  );
}

function MTDue({ due, today }) {
  const days = Math.round((mtParse(due) - mtParse(today)) / 86400000);
  const overdue = days < 0, soon = days === 0;
  return (
    <span style={{ fontFamily: 'var(--mono)', fontSize: 10, fontWeight: overdue || soon ? 700 : 400, color: overdue ? 'var(--stage-lost)' : soon ? 'var(--wine)' : 'var(--mute)' }}>
      {mtDue(due, today)}
    </span>
  );
}

// ─── Agenda row (full-width touch card) ────────────────────────────
function MTTaskRow({ task, onOpen, onToggle, today }) {
  const T = window.LA_TASKS;
  const cat = T.CATEGORY[task.category];
  const pr = T.PRIORITY[task.priority];
  const done = task.status === 'done';
  return (
    <button onClick={() => onOpen(task)} style={{
      width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer',
      display: 'flex', alignItems: 'center', gap: 13, padding: '12px 14px',
      borderRadius: 'var(--r-card)', minHeight: 60, borderLeft: `3px solid ${cat.color}`,
      background: 'var(--surface)', boxShadow: 'var(--sh-raised-crisp)',
    }}>
      <MTCheckbox on={done} onClick={() => onToggle(task.id)} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: done ? 'var(--mute-2)' : 'var(--ink)', textDecoration: done ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.title}</div>
        <div className="row" style={{ gap: 9, marginTop: 4 }}>
          <span className="row" style={{ gap: 5 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: pr.color, flexShrink: 0 }} />
            <MTDue due={task.due} today={today} />
          </span>
          {task.sched && (
            <span className="row" style={{ gap: 4, fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--mute-2)' }}>
              <MTClock />{mtTime(task.sched.start)}
            </span>
          )}
        </div>
      </div>
      <MTAvatar who={task.who} size={26} />
    </button>
  );
}

// ─── Group header ──────────────────────────────────────────────────
function MTGroupBar({ label, count, accent }) {
  return (
    <div className="row" style={{ gap: 9, padding: '14px 2px 6px' }}>
      <span style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: accent || 'var(--ink-soft)', fontWeight: 700 }}>{label}</span>
      <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--mute-2)', background: 'var(--card)', boxShadow: 'var(--sh-raised-crisp)', borderRadius: 'var(--r-pill)', padding: '1px 8px' }}>{count}</span>
      <div className="rule" style={{ flex: 1 }} />
    </div>
  );
}

// ─── Board card (compact) ──────────────────────────────────────────
function MTBoardCard({ task, onOpen, today }) {
  const T = window.LA_TASKS;
  const cat = T.CATEGORY[task.category];
  const pr = T.PRIORITY[task.priority];
  const done = task.status === 'done';
  return (
    <button onClick={() => onOpen(task)} style={{
      width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer',
      background: 'var(--card)', borderRadius: 'var(--r-surface)', padding: '12px 13px',
      borderLeft: `3px solid ${cat.color}`, boxShadow: 'var(--sh-raised-crisp)',
      display: 'block',
    }}>
      <div className="row" style={{ alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', textDecoration: done ? 'line-through' : 'none', textWrap: 'pretty', lineHeight: 1.3 }}>{task.title}</span>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: pr.color, flexShrink: 0, marginTop: 5 }} />
      </div>
      <div className="row" style={{ justifyContent: 'space-between', gap: 8, marginTop: 11 }}>
        <span className="row" style={{ gap: 6 }}>
          <span style={{ width: 7, height: 7, borderRadius: 2, background: cat.color }} />
          <span style={{ fontFamily: 'var(--mono)', fontSize: 8.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--mute)' }}>{cat.label}</span>
        </span>
        <span className="row" style={{ gap: 7 }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--mute-2)' }}>{mtDue(task.due, today)}</span>
          <MTAvatar who={task.who} size={22} />
        </span>
      </div>
    </button>
  );
}

// ─── Detail body (inside the bottom sheet) ─────────────────────────
function MTField({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      <span style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--mute-2)' }}>{label}</span>
      <span style={{ fontSize: 13.5, color: 'var(--ink)' }}>{children}</span>
    </div>
  );
}

function MTDetailBody({ task, onClose, onToggle, today }) {
  const T = window.LA_TASKS;
  const cat = T.CATEGORY[task.category];
  const pr = T.PRIORITY[task.priority];
  const done = task.status === 'done';
  return (
    <div className="la-app" style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      {/* header */}
      <div style={{ flexShrink: 0, background: 'var(--bg)', borderBottom: '1px solid var(--line)', padding: '30px 18px 16px' }}>
        <div className="row" style={{ gap: 9, marginBottom: 12 }}>
          <span style={{ width: 9, height: 9, borderRadius: 3, background: cat.color }} />
          <span style={{ fontFamily: 'var(--mono)', fontSize: 9.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--mute)' }}>{cat.label}</span>
          <div style={{ flex: 1 }} />
          <MTStatusPill k={task.status} />
        </div>
        <div className="serif" style={{ fontSize: 25, lineHeight: 1.2, color: 'var(--ink)', letterSpacing: '-0.01em', textWrap: 'pretty', textDecoration: done ? 'line-through' : 'none' }}>{task.title}</div>
      </div>

      {/* body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '18px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: 'var(--ink-soft)' }}>{task.sub}</p>

        <div className="neu-raised" style={{ borderRadius: 'var(--r-card)', padding: 18, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
          <MTField label="Assignee">
            <span className="row" style={{ gap: 8 }}><MTAvatar who={task.who} size={24} />{T.people[task.who].short}</span>
          </MTField>
          <MTField label="Priority">
            <span className="row" style={{ gap: 7 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: pr.color }} />{pr.label}</span>
          </MTField>
          <MTField label="Due">
            <MTDue due={task.due} today={today} />
          </MTField>
          <MTField label="Status"><MTStatusPill k={task.status} /></MTField>
          {task.sched && (
            <div style={{ gridColumn: '1 / -1' }}>
              <MTField label="Scheduled">
                <span className="row" style={{ gap: 7, fontFamily: 'var(--mono)', fontSize: 12 }}>
                  <MTClock s={13} />
                  {MT_DOW[mtParse(task.sched.day).getUTCDay()]} · {mtTime(task.sched.start)} – {mtTime(task.sched.end)}
                </span>
              </MTField>
            </div>
          )}
        </div>
      </div>

      {/* actions */}
      <div style={{ flexShrink: 0, borderTop: '1px solid var(--line)', padding: '14px 18px', display: 'flex', gap: 10 }}>
        <button onClick={() => { onToggle(task.id); onClose(); }} style={{
          flex: 1, height: 48, borderRadius: 'var(--r-surface)', border: 'none', cursor: 'pointer',
          background: done ? 'var(--surface)' : 'linear-gradient(145deg, #2F7A52, #1F5C3C)',
          boxShadow: done ? 'var(--sh-raised-crisp)' : 'var(--sh-raised-medium)',
          color: done ? 'var(--ink-soft)' : 'var(--paper)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
          fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700,
        }}>
          <MTCheckGlyph s={15} />{done ? 'Reopen task' : 'Mark complete'}
        </button>
        <button style={{
          width: 48, height: 48, borderRadius: 'var(--r-surface)', border: 'none', cursor: 'pointer',
          background: 'var(--surface)', boxShadow: 'var(--sh-raised-crisp)', color: 'var(--mute)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}><IconSettings size={18} /></button>
      </div>
    </div>
  );
}

// ─── Top bar + filters ─────────────────────────────────────────────
function MTTasksBar({ view, setView }) {
  return (
    <div style={{ flexShrink: 0, background: 'var(--bg)', borderBottom: '1px solid var(--line)' }}>
      <div className="row" style={{ justifyContent: 'space-between', padding: '12px 16px 6px' }}>
        <button className="la-switcher" style={{ width: 'auto', padding: '7px 12px', gap: 8 }}>
          <span className="row" style={{ gap: 8 }}><IconSwap size={13} /><span>Agency View</span></span>
          <span style={{ display: 'flex', transform: 'rotate(90deg)', color: 'var(--mute-2)' }}><IconChev size={11} /></span>
        </button>
        <div className="row" style={{ gap: 8 }}>
          <IconBtn Ic={IconSearch} />
          <IconBtn Ic={IconBell} dot />
        </div>
      </div>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-end', padding: '4px 18px 14px' }}>
        <span className="serif" style={{ fontSize: 34, color: 'var(--ink)', letterSpacing: '-0.02em' }}>Tasks</span>
        {/* Agenda / Board segmented */}
        <div className="la-seg">
          {[['agenda', IconTasks, 'Agenda'], ['board', IconLayers, 'Board']].map(([k, Ic, label]) => {
            const on = k === view;
            return (
              <button key={k} onClick={() => setView(k)} className={`la-seg-btn${on ? ' on' : ''}`}><Ic size={13} />{label}</button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function MTFilters({ filter, setFilter, counts, who, setWho }) {
  const T = window.LA_TASKS;
  const chips = [['all', 'All'], ['next7', 'Next 7'], ['overdue', 'Overdue'], ['waiting', 'Waiting'], ['completed', 'Completed']];
  return (
    <div style={{ flexShrink: 0, background: 'var(--bg)', borderBottom: '1px solid var(--line)', padding: '11px 0' }}>
      {/* assignee toggle */}
      <div style={{ padding: '0 16px 11px' }}>
        <div style={{ display: 'inline-flex', gap: 3, background: 'var(--bg-2)', boxShadow: 'var(--sh-inset-crisp)', borderRadius: 'var(--r-pill)', padding: 3 }}>
          {[['all', 'Everyone'], ['gabriel', T.people.gabriel.short], ['finn', T.people.finn.short]].map(([k, label]) => {
            const on = k === who;
            return (
              <button key={k} onClick={() => setWho(k)} style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: k === 'all' ? '6px 13px' : '5px 13px 5px 5px', borderRadius: 'var(--r-pill)', border: 'none', cursor: 'pointer',
                background: on ? 'var(--card)' : 'transparent', boxShadow: on ? 'var(--sh-raised-crisp)' : 'none',
                color: on ? 'var(--ink)' : 'var(--mute)', fontSize: 12, fontWeight: on ? 600 : 400,
              }}>
                {k !== 'all' && <MTAvatar who={k} size={22} />}{label}
              </button>
            );
          })}
        </div>
      </div>
      {/* filter chips — horizontal scroll */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '0 16px', scrollbarWidth: 'none' }}>
        {chips.map(([k, label]) => {
          const on = k === filter;
          return (
            <button key={k} onClick={() => setFilter(k)} style={{
              flexShrink: 0, display: 'flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 'var(--r-pill)', border: 'none', cursor: 'pointer',
              background: on ? 'var(--wine)' : 'var(--surface)', boxShadow: on ? 'none' : 'var(--sh-raised-crisp)',
              color: on ? 'var(--paper)' : 'var(--ink-soft)', fontSize: 12.5, fontWeight: on ? 700 : 500,
            }}>
              {label}
              <span style={{ fontFamily: 'var(--mono)', fontSize: 9, fontWeight: 700, color: on ? 'var(--paper)' : 'var(--mute-2)', background: on ? 'rgba(255,255,255,0.18)' : 'var(--bg-2)', borderRadius: 'var(--r-pill)', padding: '1px 7px' }}>{counts[k]}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Tasks screen ──────────────────────────────────────────────────
function MobTasksScreen() {
  const T = window.LA_TASKS;
  const today = T.today;
  const [view, setView] = React.useState('agenda');
  const [filter, setFilter] = React.useState('all');
  const [who, setWho] = React.useState('all');
  const [doneIds, setDoneIds] = React.useState(() => new Set());
  const [sel, setSel] = React.useState(null);
  const [open, setOpen] = React.useState(false);

  const toggle = (id) => setDoneIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allTasks = React.useMemo(() => T.tasks.map(t => doneIds.has(t.id) ? { ...t, status: 'done' } : t), [T.tasks, doneIds]);

  const within7 = (iso) => { const d = Math.round((mtParse(iso) - mtParse(today)) / 86400000); return d >= 0 && d <= 7; };
  const byWho = who === 'all' ? allTasks : allTasks.filter(t => t.who === who);
  const tasks = React.useMemo(() => byWho.filter(t => {
    switch (filter) {
      case 'next7':     return t.status !== 'done' && within7(t.due);
      case 'overdue':   return t.status !== 'done' && mtParse(t.due) < mtParse(today);
      case 'waiting':   return t.status === 'waiting';
      case 'completed': return t.status === 'done';
      default:          return true;
    }
  }), [byWho, filter]);
  const counts = React.useMemo(() => ({
    all: byWho.length,
    next7: byWho.filter(t => t.status !== 'done' && within7(t.due)).length,
    overdue: byWho.filter(t => t.status !== 'done' && mtParse(t.due) < mtParse(today)).length,
    waiting: byWho.filter(t => t.status === 'waiting').length,
    completed: byWho.filter(t => t.status === 'done').length,
  }), [byWho]);

  const openTask = (t) => { setSel(t); requestAnimationFrame(() => requestAnimationFrame(() => setOpen(true))); };
  const closeTask = () => setOpen(false);

  const groups = mtGroup(tasks, today);
  const order = [['Overdue', 'var(--stage-lost)'], ['Today', 'var(--wine)'], ['This Week', null], ['Upcoming', null], ['Completed', 'var(--good)']];
  const boardCols = ['todo', 'inprogress', 'waiting', 'done'];

  // live version of the selected task (keeps detail status in sync with toggles)
  const selLive = sel ? (allTasks.find(t => t.id === sel.id) || sel) : null;

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <MobRecede open={open}>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
          <MTTasksBar view={view} setView={setView} />
          <MTFilters filter={filter} setFilter={setFilter} counts={counts} who={who} setWho={setWho} />

          {view === 'agenda' ? (
            <div style={{ flex: 1, overflowY: 'auto', padding: '6px 14px 90px' }}>
              {order.every(([l]) => groups[l].length === 0) && (
                <div style={{ padding: '60px 20px', textAlign: 'center', fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--mute-2)' }}>No tasks match</div>
              )}
              {order.map(([label, accent]) => groups[label].length > 0 && (
                <div key={label}>
                  <MTGroupBar label={label} count={groups[label].length} accent={accent} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                    {groups[label].map(t => <MTTaskRow key={t.id} task={t} onOpen={openTask} onToggle={toggle} today={today} />)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ flex: 1, display: 'flex', gap: 13, overflowX: 'auto', padding: '14px 14px 90px', scrollbarWidth: 'none' }}>
              {boardCols.map(k => {
                const s = T.STATUS[k];
                const items = tasks.filter(t => t.status === k);
                return (
                  <div key={k} style={{ flex: '0 0 252px', display: 'flex', flexDirection: 'column' }}>
                    <div className="row" style={{ gap: 9, padding: '0 4px 11px' }}>
                      <span style={{ width: 9, height: 9, borderRadius: '50%', background: s.color }} />
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-soft)', fontWeight: 700 }}>{s.label}</span>
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--mute-2)', background: 'var(--card)', boxShadow: 'var(--sh-raised-crisp)', borderRadius: 'var(--r-pill)', padding: '1px 8px', marginLeft: 'auto' }}>{items.length}</span>
                    </div>
                    <div className="neu-inset" style={{ flex: 1, borderRadius: 'var(--r-card)', padding: 10, display: 'flex', flexDirection: 'column', gap: 10, background: 'var(--bg-2)', minHeight: 120 }}>
                      {items.length === 0
                        ? <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 70, fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--mute-2)' }}>Empty</div>
                        : items.map(t => <MTBoardCard key={t.id} task={t} onOpen={openTask} today={today} />)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* FAB */}
          <button style={{
            position: 'absolute', right: 18, bottom: 18,
            height: 52, padding: '0 22px', borderRadius: 'var(--r-card)', border: 'none', cursor: 'pointer',
            background: 'var(--wine-grad)', boxShadow: 'var(--sh-raised-medium)',
            color: 'var(--paper)', display: 'flex', alignItems: 'center', gap: 9,
            fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
            Add
          </button>
        </div>
      </MobRecede>

      <MobSheet open={open} onClose={closeTask}>
        {selLive && <MTDetailBody task={selLive} onClose={closeTask} onToggle={toggle} today={today} />}
      </MobSheet>
    </div>
  );
}

Object.assign(window, { MobTasksScreen });
