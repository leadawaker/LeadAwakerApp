// calendar.jsx — Calendar page bodies: agenda list (left) · week/month grid (center)
// Headers + the 3-column shell live in calendar-app.jsx so the column header rows align.
// Depends on: components.jsx (Icon, Sidebar), leads-components.jsx (StageAvatar),
//             leads-data.js (getDetail), calendar-data.js (LA_CAL)

// ─── Local icons ───────────────────────────────────────────────────
const CIconChevL = (p) => <Icon {...p} d={<path d="m15 18-6-6 6-6"/>} />;
const CIconChevR = (p) => <Icon {...p} d={<path d="m9 6 6 6-6 6"/>} />;
const CIconExpand = (p) => <Icon {...p} d={<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>} />;
const CIconClose  = (p) => <Icon {...p} d={<path d="m18 6-12 12M6 6l12 12"/>} />;
const CIconVideo  = (p) => <Icon {...p} d={<><rect x="2" y="6" width="13" height="12" rx="2"/><path d="m22 8-5 4 5 4z"/></>} />;
const CIconPhoneC = (p) => <Icon {...p} d={<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.6A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.4-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/>} />;
const CIconClock  = (p) => <Icon {...p} d={<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>} />;
const CIconCheck2 = (p) => <Icon {...p} d={<path d="m5 12 5 5 9-12"/>} />;
const CIconArrow  = (p) => <Icon {...p} d={<path d="M5 12h14M13 6l6 6-6 6"/>} />;
const CIconReschedule = (p) => <Icon {...p} d={<><path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 3v4h-4"/></>} />;
const CIconSpark2 = (p) => <Icon {...p} d={<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>} />;

// ─── Date helpers (UTC to avoid TZ drift) ──────────────────────────
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DOW_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MON_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function parseISO(iso) { const [y, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); }
function isoOf(d) { return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`; }
function addDays(d, n) { const x = new Date(d); x.setUTCDate(d.getUTCDate() + n); return x; }
function hm(t) { const [h, m] = t.split(':').map(Number); return h + m / 60; }
function fmtTime(t) { let [h, m] = t.split(':').map(Number); const ap = h < 12 ? 'AM' : 'PM'; let hh = h % 12; if (hh === 0) hh = 12; return `${hh}:${String(m).padStart(2, '0')} ${ap}`; }

function intentOf(l) {
  if (l >= 70) return { key: 'high',   color: 'var(--good)',       tint: 'var(--good-tint)',     label: 'High' };
  if (l >= 40) return { key: 'medium', color: 'var(--warn)',       tint: 'var(--warn-tint)',     label: 'Medium' };
  return         { key: 'low',    color: 'var(--stage-lost)', tint: 'rgba(162,75,63,0.12)', label: 'Low' };
}

// Meeting lifecycle status (filter dimension)
function statusMeta(s) {
  switch (s) {
    case 'noshow':      return { label: 'No-show',     color: 'var(--stage-lost)', tint: 'rgba(162,75,63,0.12)' };
    case 'rescheduled': return { label: 'Rescheduled', color: 'var(--warn)',       tint: 'var(--warn-tint)' };
    default:            return { label: 'Booked',      color: 'var(--good)',       tint: 'var(--good-tint)' };
  }
}

const HOUR0 = 8, HOUR1 = 19, SPAN = HOUR1 - HOUR0; // 8am–7pm window

// ─── Booked-by-AI tag ──────────────────────────────────────────────
function AITag({ small }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'var(--wine-tint)', border: '1px solid var(--wine-glow)', color: 'var(--wine)', borderRadius: 'var(--r-pill)', padding: small ? '2px 7px' : '3px 9px', fontFamily: 'var(--mono)', fontSize: small ? 7.5 : 8.5, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 700 }}>
      <CIconSpark2 size={small ? 9 : 10} />Booked by AI
    </span>
  );
}

function IntentDot({ likelihood, showPct }) {
  const it = intentOf(likelihood);
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: it.color, flexShrink: 0 }} />
      {showPct && <span style={{ fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 700, color: it.color }}>{likelihood}%</span>}
      <span style={{ fontFamily: 'var(--mono)', fontSize: 8.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--mute)' }}>{it.label}</span>
    </span>
  );
}

// ═══ AGENDA (left column body) ═════════════════════════════════════
function AgendaCard({ ev, active, onClick }) {
  const sm = statusMeta(ev.status);
  return (
    <div onClick={onClick} style={{
      position: 'relative', cursor: 'pointer', borderRadius: 'var(--r-surface)', padding: '11px 12px 11px 14px',
      background: active ? 'var(--card)' : 'transparent',
      boxShadow: active ? 'var(--sh-raised-crisp)' : 'none',
      transition: 'all 130ms', display: 'flex', gap: 11, alignItems: 'center',
    }}>
      {active && <div style={{ position: 'absolute', left: 0, top: 11, bottom: 11, width: 3, background: 'var(--wine)', borderRadius: '0 3px 3px 0' }} />}
      <StageAvatar lead={{ ini: ev.ini, stage: ev.stage }} size={36} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.leadName}</div>
        <div style={{ fontSize: 10.5, color: 'var(--mute)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>{ev.type} · {ev.campaign}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 9.5, color: 'var(--ink-soft)', display: 'inline-flex', alignItems: 'center', gap: 4 }}><CIconClock size={11} />{fmtTime(ev.start)}</span>
          {ev.status !== 'booked' && <span style={{ fontFamily: 'var(--mono)', fontSize: 7.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: sm.color, background: sm.tint, borderRadius: 4, padding: '1px 5px', fontWeight: 700 }}>{sm.label}</span>}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
        <span style={{ flexShrink: 0, color: 'var(--mute-2)', display: 'flex' }}>{ev.via === 'Phone' ? <CIconPhoneC size={14} /> : <CIconVideo size={15} />}</span>
        <IntentDot likelihood={ev.likelihood} showPct />
      </div>
    </div>
  );
}

function AgendaList({ events, weekDaysList, selId, onSelect }) {
  const inWeek = weekDaysList.map(d => {
    const iso = isoOf(d);
    return { d, iso, items: events.filter(e => e.iso === iso).sort((a, b) => hm(a.start) - hm(b.start)) };
  }).filter(g => g.items.length);

  if (!inWeek.length) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--mute-2)', fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase' }}>No meetings</div>
  );

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '6px 9px 16px' }}>
      {inWeek.map(g => (
        <div key={g.iso} style={{ marginBottom: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 6px 5px' }}>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-soft)', fontWeight: 700 }}>{DOW_FULL[g.d.getUTCDay()]}, {MON[g.d.getUTCMonth()]} {g.d.getUTCDate()}</span>
            <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
            <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--mute-2)' }}>{g.items.length}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {g.items.map(e => <AgendaCard key={e.id} ev={e} active={e.id === selId} onClick={() => onSelect(e.id)} />)}
          </div>
        </div>
      ))}
    </div>
  );
}

// ═══ AGENDA RAIL (collapsed — avatars only, hover to peek) ═════════
function AgendaPeek({ ev, top, left }) {
  const sm = statusMeta(ev.status);
  const it = intentOf(ev.likelihood);
  const vh = typeof window !== 'undefined' ? window.innerHeight : 900;
  return (
    <div style={{ position: 'fixed', top: Math.max(8, Math.min(top, vh - 92)), left, zIndex: 60, width: 252, pointerEvents: 'none' }}>
      <div style={{ borderRadius: 'var(--r-surface)', background: 'var(--card)', padding: '11px 13px', boxShadow: 'var(--sh-raised-large)', display: 'flex', gap: 11, alignItems: 'center' }}>
        <StageAvatar lead={{ ini: ev.ini, stage: ev.stage }} size={36} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.leadName}</div>
          <div style={{ fontSize: 11, color: 'var(--mute)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>{ev.type}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 5 }}>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 9.5, color: 'var(--ink-soft)', display: 'inline-flex', alignItems: 'center', gap: 4 }}><CIconClock size={10} />{fmtTime(ev.start)}</span>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: it.color }} />
            {ev.status !== 'booked' && <span style={{ fontFamily: 'var(--mono)', fontSize: 7.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: sm.color, fontWeight: 700 }}>{sm.label}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

function AgendaRail({ events, weekDaysList, selId, onSelect }) {
  const [hover, setHover] = React.useState(null);
  const show = (ev, e) => { const r = e.currentTarget.getBoundingClientRect(); setHover({ ev, top: r.top - 4, left: r.right + 12 }); };

  const groups = weekDaysList.map(d => {
    const iso = isoOf(d);
    return { iso, d, items: events.filter(e => e.iso === iso).sort((a, b) => hm(a.start) - hm(b.start)) };
  }).filter(g => g.items.length);

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '10px 0 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      {groups.map((g, gi) => (
        <React.Fragment key={g.iso}>
          {gi > 0 && <div style={{ width: 24, height: 1, background: 'var(--line)', margin: '4px 0' }} />}
          <div style={{ fontFamily: 'var(--mono)', fontSize: 8, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--mute-2)', fontWeight: 700, padding: '2px 0' }}>{DOW[g.d.getUTCDay()]} {g.d.getUTCDate()}</div>
          {g.items.map(ev => {
            const active = ev.id === selId;
            const faded = ev.status === 'noshow';
            return (
              <button key={ev.id} onClick={() => onSelect(ev.id)} onMouseEnter={(e) => show(ev, e)} onMouseLeave={() => setHover(null)} title={ev.leadName} style={{
                position: 'relative', border: 'none', cursor: 'pointer', padding: 3, borderRadius: 'var(--r-surface)', display: 'flex',
                background: active ? 'var(--card)' : 'transparent',
                boxShadow: active ? 'var(--sh-raised-crisp), 0 0 0 2px var(--wine)' : 'none',
                opacity: faded ? 0.55 : 1, transition: 'box-shadow 120ms',
              }}>
                <StageAvatar lead={{ ini: ev.ini, stage: ev.stage }} size={36} />
              </button>
            );
          })}
        </React.Fragment>
      ))}
      {hover && <AgendaPeek ev={hover.ev} top={hover.top} left={hover.left} />}
    </div>
  );
}

// ═══ WEEK GRID (center body — fills full height, % positioned) ═════
function WeekEvent({ ev, active, onClick, dayIdx }) {
  const it = intentOf(ev.likelihood);
  const sm = statusMeta(ev.status);
  const topPct = ((hm(ev.start) - HOUR0) / SPAN) * 100;
  const hPct = Math.max(((hm(ev.end) - hm(ev.start)) / SPAN) * 100, 4.2);
  // each day column = (100% - gutter)/7 ; gutter = 56px
  const left = `calc(56px + (100% - 56px) * ${dayIdx} / 7 + 3px)`;
  const width = `calc((100% - 56px) / 7 - 6px)`;
  const faded = ev.status === 'noshow';
  return (
    <div onClick={(e) => { e.stopPropagation(); onClick(); }} style={{
      position: 'absolute', top: `${topPct}%`, height: `${hPct}%`, left, width,
      background: active ? 'var(--wine)' : 'var(--card)',
      borderRadius: 'var(--r-button)', borderLeft: `3px solid ${active ? 'var(--wine-soft)' : it.color}`,
      boxShadow: active ? 'var(--sh-raised-medium)' : 'var(--sh-raised-crisp)',
      padding: '5px 8px', overflow: 'hidden', cursor: 'pointer', transition: 'box-shadow 120ms',
      opacity: faded ? 0.62 : 1,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{ fontSize: 11.5, fontWeight: 600, color: active ? 'var(--paper)' : 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, textDecoration: faded ? 'line-through' : 'none' }}>{ev.leadName}</span>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: active ? 'var(--paper)' : it.color, flexShrink: 0 }} />
      </div>
      <div style={{ fontSize: 9.5, color: active ? 'rgba(255,250,240,0.82)' : 'var(--mute)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>{ev.type}</div>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 8, color: active ? 'rgba(255,250,240,0.7)' : 'var(--mute-2)', marginTop: 2 }}>{fmtTime(ev.start)}{ev.status !== 'booked' ? ` · ${sm.label}` : ''}</div>
    </div>
  );
}

function WeekGrid({ events, weekDaysList, todayISO, nowTime, selId, onSelect }) {
  const hours = [];
  for (let h = HOUR0; h <= HOUR1; h++) hours.push(h);
  const gridCols = '56px repeat(7, minmax(0, 1fr))';
  const todayIdx = weekDaysList.findIndex(d => isoOf(d) === todayISO);
  const nowH = nowTime ? hm(nowTime) : null;
  const nowPct = (nowH != null && nowH >= HOUR0 && nowH <= HOUR1) ? ((nowH - HOUR0) / SPAN) * 100 : null;

  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {/* Day header row */}
      <div style={{ display: 'grid', gridTemplateColumns: gridCols, borderBottom: '1px solid var(--line)', flexShrink: 0 }}>
        <div />
        {weekDaysList.map(d => {
          const iso = isoOf(d), isToday = iso === todayISO;
          return (
            <div key={iso} style={{ padding: '9px 6px 11px', textAlign: 'center', borderLeft: '1px solid var(--line)' }}>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: isToday ? 'var(--wine)' : 'var(--mute-2)', fontWeight: 700 }}>{DOW[d.getUTCDay()]}</div>
              <div style={{ marginTop: 4, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 30, height: 30, borderRadius: 'var(--r-button)', fontFamily: 'var(--serif)', fontSize: 18, color: isToday ? 'var(--paper)' : 'var(--ink)', background: isToday ? 'var(--wine)' : 'transparent', boxShadow: isToday ? 'var(--sh-raised-crisp)' : 'none' }}>{d.getUTCDate()}</div>
            </div>
          );
        })}
      </div>

      {/* Body — fills remaining height; events positioned by % */}
      <div style={{ flex: 1, position: 'relative', minHeight: 0, overflow: 'hidden' }}>
        {/* vertical day separators + today tint */}
        <div style={{ position: 'absolute', inset: 0, display: 'grid', gridTemplateColumns: gridCols }}>
          <div />
          {weekDaysList.map(d => {
            const iso = isoOf(d), isToday = iso === todayISO;
            return <div key={iso} style={{ borderLeft: '1px solid var(--line)', background: isToday ? 'rgba(94,34,48,0.022)' : 'transparent' }} />;
          })}
        </div>
        {/* horizontal hour lines + gutter labels */}
        {hours.map((h, i) => {
          const pct = (i / SPAN) * 100;
          return (
            <React.Fragment key={h}>
              {i > 0 && <div style={{ position: 'absolute', top: `${pct}%`, left: 56, right: 0, borderTop: '1px solid var(--line)' }} />}
              <div style={{ position: 'absolute', top: `calc(${pct}% - 6px)`, left: 0, width: 50, textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 8.5, color: 'var(--mute-2)' }}>{h <= 12 ? h : h - 12}{h < 12 ? 'a' : 'p'}</div>
            </React.Fragment>
          );
        })}
        {/* events */}
        {weekDaysList.map((d, di) => {
          const iso = isoOf(d);
          return events.filter(e => e.iso === iso).map(e => (
            <WeekEvent key={e.id} ev={e} dayIdx={di} active={e.id === selId} onClick={() => onSelect(e.id)} />
          ));
        })}
        {/* current-time line */}
        {nowPct != null && (
          <div style={{ position: 'absolute', top: `${nowPct}%`, left: 56, right: 0, height: 0, borderTop: '1.5px solid var(--wine)', zIndex: 5, pointerEvents: 'none' }}>
            <span style={{ position: 'absolute', left: -4, top: -4, width: 8, height: 8, borderRadius: '50%', background: 'var(--wine)', boxShadow: '0 0 0 3px rgba(94,34,48,0.18)' }} />
            {todayIdx >= 0 && <span style={{ position: 'absolute', left: `calc((100% - 0px) * ${todayIdx} / 7)`, top: -7, fontFamily: 'var(--mono)', fontSize: 8, fontWeight: 700, color: 'var(--paper)', background: 'var(--wine)', borderRadius: 4, padding: '1px 5px', transform: 'translateX(6px)' }}>{fmtTime(nowTime)}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══ MONTH GRID (center body — fills full height) ══════════════════
function MonthGrid({ events, monthAnchor, todayISO, selId, onSelect }) {
  const anchor = parseISO(monthAnchor);
  const y = anchor.getUTCFullYear(), m = anchor.getUTCMonth();
  const first = new Date(Date.UTC(y, m, 1));
  const offset = (first.getUTCDay() + 6) % 7;
  const gridStart = addDays(first, -offset);
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const weeks = [];
  for (let i = 0; i < 6; i++) {
    const wk = cells.slice(i * 7, i * 7 + 7);
    if (wk[0].getUTCMonth() === m || wk[6].getUTCMonth() === m) weeks.push(wk);
  }
  const byDay = (iso) => events.filter(e => e.iso === iso).sort((a, b) => hm(a.start) - hm(b.start));

  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', borderBottom: '1px solid var(--line)', flexShrink: 0 }}>
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d, i) => (
          <div key={d} style={{ padding: '10px 0', textAlign: 'center', fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--mute-2)', fontWeight: 700, borderLeft: i ? '1px solid var(--line)' : 'none' }}>{d}</div>
        ))}
      </div>
      <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateRows: `repeat(${weeks.length}, 1fr)` }}>
        {weeks.map((wk, wi) => (
          <div key={wi} style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', borderBottom: wi < weeks.length - 1 ? '1px solid var(--line)' : 'none' }}>
            {wk.map((d, di) => {
              const iso = isoOf(d), inMonth = d.getUTCMonth() === m, isToday = iso === todayISO;
              const items = byDay(iso);
              return (
                <div key={iso} style={{ borderLeft: di ? '1px solid var(--line)' : 'none', padding: '7px 8px', minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 3, background: isToday ? 'rgba(94,34,48,0.03)' : 'transparent', opacity: inMonth ? 1 : 0.38 }}>
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 24, height: 24, borderRadius: 'var(--r-button)', fontFamily: 'var(--serif)', fontSize: 14, fontWeight: isToday ? 700 : 400, color: isToday ? 'var(--paper)' : 'var(--ink-soft)', background: isToday ? 'var(--wine)' : 'transparent' }}>{d.getUTCDate()}</span>
                  </div>
                  {items.slice(0, 4).map(e => {
                    const it = intentOf(e.likelihood);
                    return (
                      <div key={e.id} onClick={() => onSelect(e.id)} style={{
                        cursor: 'pointer', borderRadius: 'var(--r-flush)', padding: '3px 7px', display: 'flex', alignItems: 'center', gap: 6,
                        background: e.id === selId ? 'var(--wine)' : 'var(--card)',
                        boxShadow: 'var(--sh-raised-crisp)',
                      }}>
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: e.id === selId ? 'var(--paper)' : it.color, flexShrink: 0 }} />
                        <span style={{ fontSize: 10.5, color: e.id === selId ? 'var(--paper)' : 'var(--ink-soft)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fmtTime(e.start).replace(':00', '')} {e.leadName.split(' ')[0]}</span>
                      </div>
                    );
                  })}
                  {items.length > 4 && <span style={{ fontFamily: 'var(--mono)', fontSize: 8.5, color: 'var(--mute-2)', paddingLeft: 7 }}>+{items.length - 4} more</span>}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, {
  CIconChevL, CIconChevR, CIconExpand, CIconClose, CIconVideo, CIconPhoneC, CIconClock, CIconCheck2, CIconArrow, CIconReschedule, CIconSpark2,
  DOW, DOW_FULL, MON, MON_FULL, parseISO, isoOf, addDays, hm, fmtTime, intentOf, statusMeta, HOUR0, HOUR1, SPAN,
  AITag, IntentDot, AgendaList, AgendaCard, AgendaRail, AgendaPeek, WeekGrid, WeekEvent, MonthGrid,
});
