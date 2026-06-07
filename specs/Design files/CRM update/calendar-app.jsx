// calendar-app.jsx — Calendar shell: top header (title + week/month + KPIs) and a
// 3-column row of white floating cards with aligned headers:
//   left  = agenda list (filter tabs header)
//   center= week/month grid (big centered month title header)
//   right = meeting detail (nav header, no bottom buttons)
// Depends on: calendar.jsx, components.jsx, leads-components.jsx, leads-data.js, calendar-data.js

const HEADER_H = 60;       // shared column-header height → headers align
const cardStyle = { background: 'var(--card)', borderRadius: 'var(--r-card)', boxShadow: 'var(--sh-raised-large)', display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' };

// ─── KPI chip (top header, right) ──────────────────────────────────
function CalKpi({ value, label, delta }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 18px', borderLeft: '1px solid var(--line)' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{ fontFamily: 'var(--serif)', fontSize: 23, color: 'var(--ink)', lineHeight: 1, letterSpacing: '-0.01em' }}>{value}</span>
        {delta && <span style={{ fontFamily: 'var(--mono)', fontSize: 9.5, color: 'var(--good)', fontWeight: 700 }}>{delta}</span>}
      </div>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 8.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--mute)', marginTop: 4 }}>{label}</div>
    </div>
  );
}

// ─── Top page header ───────────────────────────────────────────────
function CalendarHeader({ view, setView, stats }) {
  return (
    <div style={{ height: 64, flexShrink: 0, padding: '0 18px 0 22px', display: 'flex', alignItems: 'center', gap: 20 }}>
      <span style={{ fontFamily: 'var(--serif)', fontSize: 27, color: 'var(--ink)', letterSpacing: '-0.01em' }}>Calendar</span>

      <div className="la-seg">
        {[['week', 'Week'], ['month', 'Month']].map(([k, label]) => (
          <button key={k} onClick={() => setView(k)} className={`la-seg-btn${k === view ? ' on' : ''}`}>{label}</button>
        ))}
      </div>

      <div style={{ flex: 1 }} />

      <div style={{ display: 'flex', alignItems: 'stretch', height: 44 }}>
        {stats.map((s, i) => <CalKpi key={i} {...s} />)}
      </div>
    </div>
  );
}

// ─── Left card header: status filter tabs ──────────────────────────
function FilterTabs({ value, setValue, counts, compact }) {
  const tabs = [
    ['all', 'All'], ['booked', 'Booked'], ['noshow', 'No-show'], ['rescheduled', 'Rescheduled'],
  ];
  return (
    <div style={{ height: compact ? 44 : HEADER_H, flexShrink: 0, padding: '0 12px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 4 }}>
      {tabs.map(([k, label]) => {
        const on = k === value;
        return (
          <button key={k} onClick={() => setValue(k)} style={{
            display: 'flex', alignItems: 'center', gap: 5, padding: '6px 9px', borderRadius: 'var(--r-button)', border: 'none', cursor: 'pointer',
            background: on ? 'var(--wine)' : 'transparent',
            color: on ? 'var(--paper)' : 'var(--mute)',
            fontFamily: 'var(--mono)', fontSize: 8.5, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: on ? 700 : 500,
            transition: 'all 120ms', whiteSpace: 'nowrap',
          }}>
            {label}
            <span style={{ fontFamily: 'var(--mono)', fontSize: 8, fontWeight: 700, color: on ? 'var(--paper)' : 'var(--mute-2)', opacity: on ? 0.85 : 1 }}>{counts[k]}</span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Center card header: ‹ big month title › centered ──────────────
function CenterHeader({ rangeLabel, onPrev, onNext, onToday, stats }) {
  return (
    <div style={{ height: HEADER_H, flexShrink: 0, padding: '0 14px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, position: 'relative' }}>
      <button onClick={onToday} className="la-btn la-btn--soft" style={{ position: 'absolute', left: 14 }}>Today</button>
      <button onClick={onPrev} style={navBtn}><CIconChevL size={17} /></button>
      <span style={{ fontFamily: 'var(--serif)', fontSize: 26, color: 'var(--ink)', letterSpacing: '-0.01em', minWidth: 220, textAlign: 'center', whiteSpace: 'nowrap' }}>{rangeLabel}</span>
      <button onClick={onNext} style={navBtn}><CIconChevR size={17} /></button>
      {stats && stats.length > 0 && (
        <div style={{ position: 'absolute', right: 14, display: 'flex', alignItems: 'stretch', height: 44 }}>
          {stats.map((s, i) => <CalKpi key={i} {...s} />)}
        </div>
      )}
    </div>
  );
}
const navBtn = { width: 34, height: 34, borderRadius: 'var(--r-button)', border: 'none', cursor: 'pointer', background: 'var(--surface)', boxShadow: 'var(--sh-raised-crisp)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--mute)' };

// ─── Center card legend (footer) ───────────────────────────────────
function CalLegend() {
  const items = [
    { c: 'var(--good)', label: 'High intent · 70%+' },
    { c: 'var(--warn)', label: 'Needs confirmation · 40–70%' },
    { c: 'var(--stage-lost)', label: 'At risk · <40%' },
  ];
  return (
    <div style={{ height: 40, flexShrink: 0, borderTop: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 18, padding: '0 18px' }}>
      {items.map((it, i) => (
        <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: it.c }} />
          <span style={{ fontFamily: 'var(--mono)', fontSize: 8.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--mute)' }}>{it.label}</span>
        </span>
      ))}
      <div style={{ flex: 1 }} />
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--wine)' }}>
        <CIconSpark2 size={11} /><span style={{ fontFamily: 'var(--mono)', fontSize: 8.5, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Booked by AI</span>
      </span>
    </div>
  );
}

// ═══ RIGHT CARD — meeting detail (nav in header, no bottom buttons) ═
function Fact({ icon, label, value }) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 8.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--mute-2)', marginBottom: 5, display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ color: 'var(--mute)', display: 'flex' }}>{icon}</span>{label}</div>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-soft)' }}>{value}</div>
    </div>
  );
}

function CalendarDetail({ ev, onPrev, onNext, stacked }) {
  if (!ev) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--mute-2)', fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Select a meeting</div>
  );
  const detail = window.LEADS_DATA.getDetail(ev.leadId);
  const it = intentOf(ev.likelihood);
  const sm = statusMeta(ev.status);
  const d = parseISO(ev.iso);
  const reasons = (detail.summary && detail.summary.points ? detail.summary.points : []).map(p => p.text).slice(0, 3);
  const recent = (detail.messages || []).filter(m => m.dir === 'in' || m.dir === 'out').slice(-2);

  return (
    <>
      {/* header row (aligned with other columns) */}
      <div style={{ height: HEADER_H, flexShrink: 0, padding: '0 14px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <AITag />
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={onPrev} style={navBtn}><CIconChevL size={15} /></button>
          <button onClick={onNext} style={navBtn}><CIconChevR size={15} /></button>
          <a href="Leads Page.html" style={{ ...navBtn, textDecoration: 'none' }}><CIconExpand size={13} /></a>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '18px 16px 22px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* identity */}
        <div style={{ display: 'flex', gap: 13, alignItems: 'center' }}>
          <StageAvatar lead={{ ini: ev.ini, stage: ev.stage }} size={48} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 23, color: 'var(--ink)', lineHeight: 1.1, letterSpacing: '-0.01em' }}>{ev.leadName}</div>
            <div style={{ fontSize: 12, color: 'var(--mute)', marginTop: 2 }}>{ev.type} · {ev.campaign}</div>
          </div>
        </div>

        {/* status banner if not plain booked */}
        {ev.status !== 'booked' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', borderRadius: 'var(--r-surface)', background: sm.tint, border: `1px solid ${sm.color}33` }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: sm.color }} />
            <span style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: sm.color, fontWeight: 700 }}>{sm.label}</span>
          </div>
        )}

        {/* meeting facts — raised neumorphic; 2-col when wide, stacked when narrow */}
        <div style={{ background: 'var(--surface)', boxShadow: 'var(--sh-raised-crisp)', borderRadius: 'var(--r-card)', padding: 16, display: 'grid', gridTemplateColumns: stacked ? '1fr' : '1fr 1fr', columnGap: 12, rowGap: 14 }}>
          <Fact icon={<IconCal size={14} />} label="Date" value={`${DOW_FULL[d.getUTCDay()]}, ${MON_FULL[d.getUTCMonth()]} ${d.getUTCDate()}`} />
          <Fact icon={ev.via === 'Phone' ? <CIconPhoneC size={14} /> : <CIconVideo size={14} />} label="Channel" value={ev.via} />
          <Fact icon={<CIconClock size={14} />} label="Time" value={`${fmtTime(ev.start)} – ${fmtTime(ev.end)}`} />
          <div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 8.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--mute-2)', marginBottom: 5 }}>Attendance</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{ fontFamily: 'var(--serif)', fontSize: 20, color: it.color, lineHeight: 1 }}>{ev.likelihood}%</span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 8.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--mute)' }}>{it.label}</span>
            </div>
          </div>
        </div>

        {/* AI summary */}
        {detail.summary && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 9 }}>
              <span style={{ color: 'var(--wine)', display: 'flex' }}><CIconSpark2 size={14} /></span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--wine)', fontWeight: 700 }}>Why AI booked this</span>
            </div>
            <p style={{ margin: '0 0 12px', fontSize: 12.5, lineHeight: 1.55, color: 'var(--ink-soft)', textWrap: 'pretty' }}>{detail.summary.headline}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {reasons.map((r, i) => (
                <div key={i} style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
                  <span style={{ width: 16, height: 16, borderRadius: 5, flexShrink: 0, marginTop: 1, background: 'var(--good-tint)', color: 'var(--good)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CIconCheck2 size={11} /></span>
                  <span style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--ink-soft)', textWrap: 'pretty' }}>{r}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* recent conversation */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 }}>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--mute)', fontWeight: 700 }}>Recent conversation</span>
            <a href="Leads Page.html" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: 'var(--mono)', fontSize: 8.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--wine)', fontWeight: 700 }}>Open in lead <CIconArrow size={11} /></a>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {recent.map((m, i) => {
              const isIn = m.dir === 'in';
              return (
                <div key={i} style={{
                  alignSelf: isIn ? 'flex-start' : 'flex-end', maxWidth: '88%',
                  background: isIn ? 'var(--surface)' : 'var(--wine-tint)',
                  border: isIn ? '1px solid var(--line)' : '1px solid var(--wine-glow)',
                  borderRadius: isIn ? '3px 12px 12px 12px' : '12px 3px 12px 12px',
                  padding: '8px 11px',
                }}>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 7.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: isIn ? 'var(--good)' : 'var(--wine)', fontWeight: 700, marginBottom: 3 }}>{isIn ? ev.leadName.split(' ')[0] : 'AI Agent'}</div>
                  <p style={{ margin: 0, fontSize: 11.5, lineHeight: 1.5, color: 'var(--ink-soft)', textWrap: 'pretty' }}>{m.text}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}

// ═══ APP ═══════════════════════════════════════════════════════════
function CalendarApp() {
  const C = window.LA_CAL;
  const [view, setView] = React.useState('week');
  const [weekStart, setWeekStart] = React.useState(C.weekStart);
  const [monthAnchor, setMonthAnchor] = React.useState(C.monthAnchor);
  const [filter, setFilter] = React.useState('all');
  const [selId, setSelId] = React.useState(C.events[0].id);

  // Collapse the agenda to an icon rail when tight; stack detail facts on narrow
  const [vw, setVw] = React.useState(typeof window !== 'undefined' ? window.innerWidth : 1600);
  React.useEffect(() => {
    const onResize = () => setVw(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  const narrow = vw < 1480;

  const counts = React.useMemo(() => ({
    all: C.events.length,
    booked: C.events.filter(e => e.status === 'booked').length,
    noshow: C.events.filter(e => e.status === 'noshow').length,
    rescheduled: C.events.filter(e => e.status === 'rescheduled').length,
  }), [C.events]);

  const events = React.useMemo(() => filter === 'all' ? C.events : C.events.filter(e => e.status === filter), [C.events, filter]);

  const weekDaysList = React.useMemo(() => {
    const s = parseISO(weekStart);
    return Array.from({ length: 7 }, (_, i) => addDays(s, i));
  }, [weekStart]);

  const rangeLabel = React.useMemo(() => {
    if (view === 'month') { const a = parseISO(monthAnchor); return `${MON_FULL[a.getUTCMonth()]} ${a.getUTCFullYear()}`; }
    const a = weekDaysList[0], b = weekDaysList[6];
    const sameMonth = a.getUTCMonth() === b.getUTCMonth();
    return sameMonth
      ? `${MON[a.getUTCMonth()]} ${a.getUTCDate()} – ${b.getUTCDate()}`
      : `${MON[a.getUTCMonth()]} ${a.getUTCDate()} – ${MON[b.getUTCMonth()]} ${b.getUTCDate()}`;
  }, [view, weekStart, monthAnchor, weekDaysList]);

  const shiftMonth = (n) => { const a = parseISO(monthAnchor); setMonthAnchor(isoOf(new Date(Date.UTC(a.getUTCFullYear(), a.getUTCMonth() + n, 1)))); };
  const prev = () => view === 'week' ? setWeekStart(isoOf(addDays(parseISO(weekStart), -7))) : shiftMonth(-1);
  const next = () => view === 'week' ? setWeekStart(isoOf(addDays(parseISO(weekStart), 7))) : shiftMonth(1);
  const today = () => { setWeekStart(C.weekStart); setMonthAnchor(C.monthAnchor); };

  const ordered = React.useMemo(() => [...events].sort((a, b) => (a.iso + a.start).localeCompare(b.iso + b.start)), [events]);
  const selIdx = ordered.findIndex(e => e.id === selId);
  const stepSel = (n) => { if (!ordered.length) return; const i = (selIdx + n + ordered.length) % ordered.length; setSelId(ordered[i].id); };
  const selEv = events.find(e => e.id === selId) || C.events.find(e => e.id === selId);

  return (
    <div className="la-app" style={{ width: '100%', height: '100%', display: 'flex', overflow: 'hidden' }}>
      <Sidebar active="Calendar" />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg)' }}>
        {/* 3 floating cards — no top header bar; full padding on all sides */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 14, padding: '14px', overflow: 'hidden' }}>

          {/* LEFT — agenda card with full Campaigns-style header */}
          <div style={{ ...cardStyle, width: narrow ? 68 : 356, flexShrink: 0, background: 'var(--bg-2)' }}>
            {narrow ? (
              /* Collapsed: icon-only header slot */
              <div style={{ height: HEADER_H, flexShrink: 0, borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ width: 34, height: 34, borderRadius: 'var(--r-button)', background: 'var(--surface)', boxShadow: 'var(--sh-raised-crisp)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--wine)' }}>
                  <CIconClock size={15} />
                </span>
              </div>
            ) : (
              <>
                {/* Title row — 60px, aligns with sidebar logo row */}
                <div style={{ height: HEADER_H, flexShrink: 0, padding: '0 16px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontFamily: 'var(--serif)', fontSize: 22, color: 'var(--ink)', letterSpacing: '-0.01em' }}>Calendar</span>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--mute-2)', letterSpacing: '0.1em' }}>#{C.events.length}</span>
                </div>

                {/* Week / Month switcher — taller padding, 11px, tracked caps */}
                <div style={{ padding: '12px 16px 0', flexShrink: 0 }}>
                  <div className="la-seg la-seg--fill" style={{ width: '100%' }}>
                    {[['week', 'Week'], ['month', 'Month']].map(([k, label]) => (
                      <button key={k} onClick={() => setView(k)}
                        className={`la-seg-btn${k === view ? ' on' : ''}`}
                        style={{ padding: '10px 14px', fontSize: 11, letterSpacing: '0.13em' }}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Toolbar: search + Filter + wine + */}
                <div style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                  <div style={{ position: 'relative', flex: '1 1 80px', minWidth: 0 }}>
                    <input className="neu-input" placeholder="Search…" style={{ padding: '7px 10px 7px 27px', fontSize: 11, width: '100%' }} />
                    <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--mute-2)', display: 'flex', pointerEvents: 'none' }}>
                      <IconSearch size={12} />
                    </span>
                  </div>
                  <button title="Filter" className="la-btn la-btn--soft la-btn--icon"><IconFilter size={13} /></button>
                  <button title="New event" className="la-btn la-btn--wine la-btn--icon"><IconPlus size={14} /></button>
                </div>

                {/* Status filter tabs — compact row below toolbar */}
                <FilterTabs value={filter} setValue={setFilter} counts={counts} compact />
              </>
            )}
            {narrow
              ? <AgendaRail events={events} weekDaysList={weekDaysList} selId={selId} onSelect={setSelId} />
              : <AgendaList events={events} weekDaysList={weekDaysList} selId={selId} onSelect={setSelId} />}
          </div>

          {/* CENTER — calendar grid; KPIs sit in the header right side */}
          <div style={{ ...cardStyle, flex: 1, minWidth: 0, background: 'var(--bg-2)' }}>
            <CenterHeader rangeLabel={rangeLabel} onPrev={prev} onNext={next} onToday={today} stats={C.stats} />
            {view === 'week'
              ? <WeekGrid events={events} weekDaysList={weekDaysList} todayISO={C.today} nowTime={C.nowTime} selId={selId} onSelect={setSelId} />
              : <MonthGrid events={events} monthAnchor={monthAnchor} todayISO={C.today} selId={selId} onSelect={setSelId} />}
            <CalLegend />
          </div>

          {/* RIGHT — meeting detail */}
          <div style={{ ...cardStyle, width: narrow ? 326 : 372, flexShrink: 0 }}>
            <CalendarDetail ev={selEv} onPrev={() => stepSel(-1)} onNext={() => stepSel(1)} stacked={narrow} />
          </div>

        </div>
      </div>
    </div>
  );
}

Object.assign(window, { CalKpi, CalendarHeader, FilterTabs, CenterHeader, CalLegend, CalendarDetail, Fact, CalendarApp });
