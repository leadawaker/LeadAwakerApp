// tasks-app.jsx — Left panel owns the full header: title + view seg + toolbar + filter chips.
// ScheduleView is now just the right-side week calendar. Board fills the remaining width.
// Depends on: tasks-views.jsx, tasks-data.js, components.jsx (Sidebar, Icon)

const T_HOUR0 = 8, T_HOUR1 = 18, T_SPAN = T_HOUR1 - T_HOUR0;

// TIconSort — used in the toolbar
const TIconSort = (p) => <Icon {...p} d={<path d="M3 6h18M7 12h10M11 18h2"/>} />;

// ─── Tasks Left Panel ──────────────────────────────────────────────
// 356px flush left card: 60px title + view seg + toolbar + filter chips + assignee + task list
function TasksLeftPanel({ view, setView, filter, setFilter, who, setWho, counts, tasks, activeId, onSelect, onToggle }) {
  const T = window.LA_TASKS;
  const [collapsed, setCollapsed] = React.useState(() => window.innerWidth < 1200);
  React.useEffect(() => {
    const handler = () => setCollapsed(window.innerWidth < 1200);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  const viewTabs = [
    { key: 'schedule', Ic: TIconSplit, label: 'Schedule' },
    { key: 'board',    Ic: TIconBoard, label: 'Board' },
  ];
  const chips = [
    ['all', 'All'], ['next7', 'Next 7 Days'], ['overdue', 'Overdue'], ['waiting', 'Waiting'], ['completed', 'Done'],
  ];
  const groups = view === 'schedule' ? groupTasks(tasks, T.today) : null;
  const order = [['Overdue', 'var(--stage-lost)'], ['Today', 'var(--wine)'], ['This Week', null], ['Upcoming', null], ['Completed', 'var(--good)']];

  return (
    <div style={{ width: 356, flexShrink: 0, borderRight: '1px solid var(--line)', background: 'var(--bg-2)', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* 60px title header — aligns with sidebar logo row */}
      <div style={{ height: 60, flexShrink: 0, borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', padding: '0 16px', gap: 10 }}>
        <span style={{ fontFamily: 'var(--serif)', fontSize: 22, color: 'var(--ink)', letterSpacing: '-0.01em', flex: 1 }}>Tasks</span>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--mute-2)', background: 'var(--bg)', boxShadow: 'var(--sh-inset-crisp)', borderRadius: 'var(--r-pill)', padding: '2px 9px' }}>{tasks.length}</span>
      </div>

      {/* View seg — taller tabs */}
      <div style={{ padding: '12px 10px 0' }}>
        <div className="la-seg la-seg--fill">
          {viewTabs.map(v => {
            const on = v.key === view;
            return (
              <button key={v.key} onClick={() => setView(v.key)} className={`la-seg-btn${on ? ' on' : ''}`}
                style={{ padding: '10px 14px', fontSize: 11, letterSpacing: '0.13em', display: 'flex', alignItems: 'center', gap: 6 }}>
                <v.Ic size={13} />{v.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Toolbar: search + Filter/Sort/Group (collapsible) + Add */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '10px 10px 0' }}>
        <div style={{ position: 'relative', flex: '1 1 80px', minWidth: 0 }}>
          <input className="neu-input" placeholder="Search tasks…" style={{ padding: '7px 10px 7px 30px', width: '100%', fontSize: 12, boxSizing: 'border-box' }} />
          <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--mute-2)', display: 'flex' }}><TIconSearch size={13} /></span>
        </div>
        {collapsed ? (
          <button title="Options" className="la-btn la-btn--soft la-btn--icon"><TIconGroup size={13} /></button>
        ) : (
          <>
            <button title="Filter" className="la-btn la-btn--soft la-btn--icon"><TIconFilter size={13} /></button>
            <button title="Sort" className="la-btn la-btn--soft la-btn--icon"><TIconSort size={13} /></button>
            <button title="Group" className="la-btn la-btn--soft la-btn--icon"><TIconGroup size={13} /></button>
          </>
        )}
        <button title="Add Task" className="la-btn la-btn--wine la-btn--icon"><TIconPlus size={14} /></button>
      </div>

      {/* Rule */}
      <div style={{ margin: '10px 10px 0', height: 1, background: 'var(--line)' }} />

      {/* Filter chips — inline, no outer bar */}
      <div style={{ padding: '8px 10px 0', display: 'flex', flexWrap: 'wrap', gap: 5 }}>
        {chips.map(([k, label]) => {
          const on = k === filter;
          return (
            <button key={k} onClick={() => setFilter(k)} style={{
              display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 'var(--r-pill)', border: 'none', cursor: 'pointer',
              background: on ? 'var(--wine)' : 'var(--surface)', boxShadow: on ? 'none' : 'var(--sh-raised-crisp)',
              color: on ? 'var(--paper)' : 'var(--ink-soft)', fontSize: 11, fontWeight: on ? 700 : 500, transition: 'all 120ms',
            }}>
              {label}
              <span style={{ fontFamily: 'var(--mono)', fontSize: 9, fontWeight: 700, color: on ? 'var(--paper)' : 'var(--mute-2)', background: on ? 'rgba(255,255,255,0.18)' : 'var(--bg-2)', borderRadius: 'var(--r-pill)', padding: '1px 6px' }}>{counts[k]}</span>
            </button>
          );
        })}
      </div>

      {/* Assignee toggle */}
      <div style={{ padding: '6px 10px 0', display: 'flex' }}>
        <div style={{ display: 'flex', gap: 3, background: 'var(--bg)', boxShadow: 'var(--sh-inset-crisp)', borderRadius: 'var(--r-pill)', padding: 3 }}>
          {[['all', 'Everyone'], ['gabriel', T.people.gabriel.short], ['finn', T.people.finn.short]].map(([k, label]) => {
            const on = k === who;
            return (
              <button key={k} onClick={() => setWho(k)} style={{
                display: 'flex', alignItems: 'center', gap: 5, padding: '4px 9px 4px 5px', borderRadius: 'var(--r-pill)', border: 'none', cursor: 'pointer',
                background: on ? 'var(--card)' : 'transparent', boxShadow: on ? 'var(--sh-raised-crisp)' : 'none',
                color: on ? 'var(--ink)' : 'var(--mute)', fontSize: 11, fontWeight: on ? 600 : 400,
              }}>
                {k === 'all'
                  ? <span style={{ width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--mute)' }}><TIconGroup size={11} /></span>
                  : <Avatar who={k} size={20} />}
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Rule */}
      <div style={{ margin: '8px 10px 0', height: 1, background: 'var(--line)' }} />

      {/* Task list (schedule view only) */}
      {view === 'schedule' && groups && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '6px 8px 14px' }}>
          {order.map(([label, accent]) => groups[label].length > 0 && (
            <div key={label} style={{ marginBottom: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 8px 4px' }}>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: accent || 'var(--mute)', fontWeight: 700 }}>{label}</span>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 8.5, color: 'var(--mute-2)' }}>{groups[label].length}</span>
              </div>
              {groups[label].map(t => <MiniTaskRow key={t.id} task={t} active={t.id === activeId} onClick={() => onSelect && onSelect(t.id)} onToggle={onToggle} />)}
            </div>
          ))}
        </div>
      )}

      {/* Footer drag hint (schedule only) */}
      {view === 'schedule' && (
        <div style={{ flexShrink: 0, borderTop: '1px solid var(--line)', padding: '9px 14px', display: 'flex', alignItems: 'center', gap: 8, color: 'var(--mute)' }}>
          <TIconClock size={12} />
          <span style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Drag tasks onto the calendar to schedule</span>
        </div>
      )}

      {/* Board view: spacer fills height */}
      {view === 'board' && <div style={{ flex: 1 }} />}
    </div>
  );
}

// ─── Filter chips + assignee toggle ────────────────────────────────
function FilterChips({ value, setValue, counts, who, setWho }) {
  const T = window.LA_TASKS;
  const chips = [
    ['all', 'All Tasks'], ['next7', 'Next 7 Days'], ['overdue', 'Overdue'], ['waiting', 'Waiting'], ['completed', 'Completed'],
  ];
  return (
    <div style={{ height: 50, flexShrink: 0, padding: '0 20px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg)' }}>
      {chips.map(([k, label]) => {
        const on = k === value;
        return (
          <button key={k} onClick={() => setValue(k)} style={{
            display: 'flex', alignItems: 'center', gap: 7, padding: '7px 13px', borderRadius: 'var(--r-pill)', border: 'none', cursor: 'pointer',
            background: on ? 'var(--wine)' : 'var(--surface)',
            boxShadow: on ? 'none' : 'var(--sh-raised-crisp)',
            color: on ? 'var(--paper)' : 'var(--ink-soft)',
            fontSize: 12, fontWeight: on ? 700 : 500, transition: 'all 120ms',
          }}>
            {label}
            <span style={{ fontFamily: 'var(--mono)', fontSize: 9, fontWeight: 700, color: on ? 'var(--paper)' : 'var(--mute-2)', background: on ? 'rgba(255,255,255,0.18)' : 'var(--bg-2)', borderRadius: 'var(--r-pill)', padding: '1px 7px' }}>{counts[k]}</span>
          </button>
        );
      })}

      <div style={{ flex: 1 }} />

      {/* Assignee toggle — only two people */}
      <div style={{ display: 'flex', gap: 3, background: 'var(--bg-2)', boxShadow: 'var(--sh-inset-crisp)', borderRadius: 'var(--r-pill)', padding: 3 }}>
        {[['all', 'Everyone'], ['gabriel', T.people.gabriel.short], ['finn', T.people.finn.short]].map(([k, label]) => {
          const on = k === who;
          return (
            <button key={k} onClick={() => setWho(k)} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px 5px 6px', borderRadius: 'var(--r-pill)', border: 'none', cursor: 'pointer',
              background: on ? 'var(--card)' : 'transparent', boxShadow: on ? 'var(--sh-raised-crisp)' : 'none',
              color: on ? 'var(--ink)' : 'var(--mute)', fontSize: 11.5, fontWeight: on ? 600 : 400,
            }}>
              {k === 'all'
                ? <span style={{ width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--mute)' }}><TIconGroup size={12} /></span>
                : <Avatar who={k} size={22} />}
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Schedule: compact task row (left list) ────────────────────────
function MiniTaskRow({ task, active, onClick, onToggle }) {
  const T = window.LA_TASKS;
  const done = task.status === 'done';
  const cat = T.CATEGORY[task.category];
  const pr = T.PRIORITY[task.priority];
  return (
    <div onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 11, padding: '9px 12px', borderRadius: 'var(--r-surface)', cursor: 'pointer',
      borderLeft: `3px solid ${cat.color}`,
      background: active ? 'var(--card)' : 'transparent',
      boxShadow: active ? 'var(--sh-raised-crisp)' : 'none',
      transition: 'all 120ms',
    }}
    onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'var(--surface)'; }}
    onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}>
      <Checkbox on={done} onClick={() => onToggle && onToggle(task.id)} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: done ? 'var(--mute-2)' : 'var(--ink)', textDecoration: done ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.title}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 3 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: pr.color, flexShrink: 0 }} />
          <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--mute-2)' }}>{tDueLabel(task.due, T.today)}</span>
          {task.sched && <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--mute-2)', display: 'inline-flex', alignItems: 'center', gap: 3 }}><TIconClock size={10} />{tFmt(task.sched.start)}</span>}
        </div>
      </div>
      <Avatar who={task.who} size={24} />
    </div>
  );
}

// ─── Schedule: week calendar (right) ───────────────────────────────
function TaskWeek({ tasks, weekDaysList, todayISO, nowTime, selId, onSelect }) {
  const T = window.LA_TASKS;
  const hours = [];
  for (let h = T_HOUR0; h <= T_HOUR1; h++) hours.push(h);
  const gridCols = '52px repeat(7, minmax(0, 1fr))';
  const nowH = nowTime ? tHm(nowTime) : null;
  const nowPct = (nowH != null && nowH >= T_HOUR0 && nowH <= T_HOUR1) ? ((nowH - T_HOUR0) / T_SPAN) * 100 : null;
  const todayIdx = weekDaysList.findIndex(d => tIso(d) === todayISO);

  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {/* day header */}
      <div style={{ display: 'grid', gridTemplateColumns: gridCols, borderBottom: '1px solid var(--line)', flexShrink: 0 }}>
        <div />
        {weekDaysList.map(d => {
          const iso = tIso(d), isToday = iso === todayISO;
          return (
            <div key={iso} style={{ padding: '9px 6px 11px', textAlign: 'center', borderLeft: '1px solid var(--line)' }}>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: isToday ? 'var(--wine)' : 'var(--mute-2)', fontWeight: 700 }}>{T_DOW[d.getUTCDay()]}</div>
              <div style={{ marginTop: 4, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 30, height: 30, borderRadius: 'var(--r-button)', fontFamily: 'var(--serif)', fontSize: 18, color: isToday ? 'var(--paper)' : 'var(--ink)', background: isToday ? 'var(--wine)' : 'transparent', boxShadow: isToday ? 'var(--sh-raised-crisp)' : 'none' }}>{d.getUTCDate()}</div>
            </div>
          );
        })}
      </div>

      {/* body */}
      <div style={{ flex: 1, position: 'relative', minHeight: 0, overflow: 'hidden' }}>
        {/* columns + today tint */}
        <div style={{ position: 'absolute', inset: 0, display: 'grid', gridTemplateColumns: gridCols }}>
          <div />
          {weekDaysList.map(d => {
            const iso = tIso(d), isToday = iso === todayISO;
            return <div key={iso} style={{ borderLeft: '1px solid var(--line)', background: isToday ? 'rgba(94,34,48,0.022)' : 'transparent' }} />;
          })}
        </div>
        {/* hour lines + labels */}
        {hours.map((h, i) => {
          const pct = (i / T_SPAN) * 100;
          return (
            <React.Fragment key={h}>
              {i > 0 && <div style={{ position: 'absolute', top: `${pct}%`, left: 52, right: 0, borderTop: '1px solid var(--line)' }} />}
              <div style={{ position: 'absolute', top: `calc(${pct}% - 6px)`, left: 0, width: 46, textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 8.5, color: 'var(--mute-2)' }}>{h <= 12 ? h : h - 12}{h < 12 ? 'a' : 'p'}</div>
            </React.Fragment>
          );
        })}
        {/* task blocks */}
        {weekDaysList.map((d, di) => {
          const iso = tIso(d);
          return tasks.filter(t => t.sched && t.sched.day === iso).map(t => {
            const cat = T.CATEGORY[t.category];
            const topPct = ((tHm(t.sched.start) - T_HOUR0) / T_SPAN) * 100;
            const hPct = Math.max(((tHm(t.sched.end) - tHm(t.sched.start)) / T_SPAN) * 100, 5);
            const left = `calc(52px + (100% - 52px) * ${di} / 7 + 3px)`;
            const width = `calc((100% - 52px) / 7 - 6px)`;
            const active = t.id === selId;
            const done = t.status === 'done';
            return (
              <div key={t.id} onClick={(e) => { e.stopPropagation(); onSelect && onSelect(t.id); }} style={{
                position: 'absolute', top: `${topPct}%`, height: `${hPct}%`, left, width,
                background: cat.color + '1A', borderLeft: `3px solid ${cat.color}`, borderRadius: 'var(--r-button)',
                boxShadow: active ? '0 0 0 1.5px var(--wine)' : 'none',
                padding: '5px 7px', overflow: 'hidden', cursor: 'pointer',
              }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink)', textDecoration: done ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.25 }}>{t.title}</div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--mute)', marginTop: 2 }}>{tFmt(t.sched.start)}</div>
              </div>
            );
          });
        })}
        {/* current-time line */}
        {nowPct != null && (
          <div style={{ position: 'absolute', top: `${nowPct}%`, left: 52, right: 0, height: 0, borderTop: '1.5px solid var(--wine)', zIndex: 5, pointerEvents: 'none' }}>
            <span style={{ position: 'absolute', left: -4, top: -4, width: 8, height: 8, borderRadius: '50%', background: 'var(--wine)', boxShadow: '0 0 0 3px rgba(94,34,48,0.18)' }} />
            {todayIdx >= 0 && <span style={{ position: 'absolute', left: `calc((100% - 0px) * ${todayIdx} / 7)`, top: -7, fontFamily: 'var(--mono)', fontSize: 8, fontWeight: 700, color: 'var(--paper)', background: 'var(--wine)', borderRadius: 4, padding: '1px 5px', transform: 'translateX(6px)' }}>{tFmt(nowTime)}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Schedule: right-side week calendar only ──────────────────────
// (Left panel / task list now lives in TasksLeftPanel)
function ScheduleView({ tasks, activeId, onSelect }) {
  const T = window.LA_TASKS;
  const [weekStart, setWeekStart] = React.useState(T.weekStart);
  const weekDaysList = React.useMemo(() => {
    const s = tParse(weekStart);
    return Array.from({ length: 7 }, (_, i) => tAdd(s, i));
  }, [weekStart]);
  const a = weekDaysList[0], b = weekDaysList[6];
  const rangeLabel = a.getUTCMonth() === b.getUTCMonth()
    ? `${T_MON[a.getUTCMonth()]} ${a.getUTCDate()} – ${b.getUTCDate()}`
    : `${T_MON[a.getUTCMonth()]} ${a.getUTCDate()} – ${T_MON[b.getUTCMonth()]} ${b.getUTCDate()}`;
  const prev = () => setWeekStart(tIso(tAdd(tParse(weekStart), -7)));
  const next = () => setWeekStart(tIso(tAdd(tParse(weekStart), 7)));

  return (
    <div style={{ flex: 1, minWidth: 0, background: 'var(--card)', display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
      <div style={{ height: 56, flexShrink: 0, padding: '0 16px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, position: 'relative' }}>
        <button onClick={() => setWeekStart(T.weekStart)} className="la-btn la-btn--soft" style={{ position: 'absolute', left: 16 }}>Today</button>
        <button onClick={prev} className="la-btn la-btn--soft la-btn--icon"><TIconChevL size={16} /></button>
        <span style={{ fontFamily: 'var(--serif)', fontSize: 23, color: 'var(--ink)', letterSpacing: '-0.01em', minWidth: 180, textAlign: 'center' }}>{rangeLabel}</span>
        <button onClick={next} className="la-btn la-btn--soft la-btn--icon"><TIconChevR size={16} /></button>
      </div>
      <TaskWeek tasks={tasks} weekDaysList={weekDaysList} todayISO={T.today} nowTime={T.nowTime} selId={activeId} onSelect={onSelect} />
    </div>
  );
}

// ═══ APP ═══════════════════════════════════════════════════════════
function TasksApp() {
  const T = window.LA_TASKS;
  const [view, setView] = React.useState('schedule');
  const [filter, setFilter] = React.useState('all');
  const [who, setWho] = React.useState('all');
  const [activeId, setActiveId] = React.useState(null);
  const [doneIds, setDoneIds] = React.useState(() => new Set());

  const allTasks = React.useMemo(() => T.tasks.map(t => doneIds.has(t.id) ? { ...t, status: 'done' } : t), [T.tasks, doneIds]);
  const toggle = (id) => setDoneIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const today = T.today;
  const within7 = (iso) => { const days = Math.round((tParse(iso) - tParse(today)) / 86400000); return days >= 0 && days <= 7; };

  const byWho = who === 'all' ? allTasks : allTasks.filter(t => t.who === who);
  const tasks = React.useMemo(() => byWho.filter(t => {
    switch (filter) {
      case 'next7':     return t.status !== 'done' && within7(t.due);
      case 'overdue':   return t.status !== 'done' && tParse(t.due) < tParse(today);
      case 'waiting':   return t.status === 'waiting';
      case 'completed': return t.status === 'done';
      default:          return true;
    }
  }), [byWho, filter, today]);

  const counts = React.useMemo(() => ({
    all: byWho.length,
    next7: byWho.filter(t => t.status !== 'done' && within7(t.due)).length,
    overdue: byWho.filter(t => t.status !== 'done' && tParse(t.due) < tParse(today)).length,
    waiting: byWho.filter(t => t.status === 'waiting').length,
    completed: byWho.filter(t => t.status === 'done').length,
  }), [byWho, today]);

  return (
    <div className="la-app" style={{ width: '100%', height: '100%', display: 'flex', overflow: 'hidden' }}>
      <Sidebar active="Tasks" />
      {/* Left panel owns title + view seg + toolbar + chips — no top bar */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', overflow: 'hidden', background: 'var(--bg)' }}>
        <TasksLeftPanel
          view={view} setView={setView}
          filter={filter} setFilter={setFilter}
          who={who} setWho={setWho}
          counts={counts} tasks={tasks}
          activeId={activeId} onSelect={setActiveId} onToggle={toggle}
        />
        {view === 'schedule' && <ScheduleView tasks={tasks} activeId={activeId} onSelect={setActiveId} />}
        {view === 'board' && <Board tasks={tasks} activeId={activeId} onSelect={setActiveId} />}
      </div>
    </div>
  );
}

Object.assign(window, { FilterChips, MiniTaskRow, TaskWeek, TasksLeftPanel, ScheduleView, TasksApp });
