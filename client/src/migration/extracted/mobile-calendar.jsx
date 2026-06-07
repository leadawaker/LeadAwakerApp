// mobile-calendar.jsx — Calendar tab for the Lead Awaker mobile app.
// Reflows the desktop Calendar page into a single-pane phone screen. The locked
// mobile decision is an AGENDA / day-list default (a week's AI-booked meetings
// grouped by day); the month grid is offered only as a secondary toggle for a
// bird's-eye glance. Tapping a meeting raises a detail bottom-sheet (variation B)
// holding the meeting facts + (when the event maps to a known lead) the AI
// summary and contact pulled from LEADS_DATA.getDetail.
//
// Self-contained on purpose: depends only on calendar-data.js (LA_CAL),
// leads-data.js (LEADS_DATA.getDetail — data only), components.jsx (icons),
// mobile-shell.jsx (MobSheet, MobRecede, IconBtn) — NOT calendar.jsx, whose
// AgendaList/WeekGrid/intentOf/etc. would clobber peers. Small bits re-implemented
// here with MC* prefixes.

// ─── Glyphs not present as shared icons ────────────────────────────
const MCVideoGlyph = ({ s = 15 }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="13" height="12" rx="2" /><path d="m22 8-5 4 5 4z" /></svg>;
const MCPhoneGlyph = ({ s = 14 }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.6A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.4-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z" /></svg>;
const MCClockGlyph = ({ s = 11 }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
const MCSparkGlyph = ({ s = 12 }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" /></svg>;
const MCReschedGlyph = ({ s = 15 }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7" /><path d="M21 3v4h-4" /></svg>;
const MCCheckGlyph  = ({ s = 11 }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 5 5 9-12" /></svg>;
const MCArrowGlyph  = ({ s = 11 }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
const MCChevL = ({ s = 16 }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>;
const MCChevR = ({ s = 16 }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 6 6 6-6 6" /></svg>;

// ─── Date helpers (UTC to avoid TZ drift) ──────────────────────────
const MC_DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MC_DOW_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MC_MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MC_MON_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
function mcParse(iso) { const [y, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); }
function mcISO(d) { return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`; }
function mcAdd(d, n) { const x = new Date(d); x.setUTCDate(d.getUTCDate() + n); return x; }
function mcHM(t) { const [h, m] = t.split(':').map(Number); return h + m / 60; }
function mcTime(t) { let [h, m] = t.split(':').map(Number); const ap = h < 12 ? 'AM' : 'PM'; let hh = h % 12; if (hh === 0) hh = 12; return `${hh}:${String(m).padStart(2, '0')} ${ap}`; }

function mcIntent(l) {
  if (l >= 70) return { key: 'high',   color: 'var(--good)',       label: 'High' };
  if (l >= 40) return { key: 'medium', color: 'var(--warn)',       label: 'Medium' };
  return         { key: 'low',    color: 'var(--stage-lost)', label: 'Low' };
}
function mcStatus(s) {
  switch (s) {
    case 'noshow':      return { label: 'No-show',     color: 'var(--stage-lost)', tint: 'rgba(162,75,63,0.12)' };
    case 'rescheduled': return { label: 'Rescheduled', color: 'var(--warn)',       tint: 'var(--warn-tint)' };
    default:            return { label: 'Booked',      color: 'var(--good)',       tint: 'var(--good-tint)' };
  }
}
function mcStageColor(stageKey) {
  const P = window.LEADS_DATA && window.LEADS_DATA.pipeline;
  const s = P && P.find(x => x.key === stageKey);
  return s ? s.color : 'var(--wine)';
}

// ─── Stage-tinted avatar ───────────────────────────────────────────
function MCAvatar({ ini, stage, size = 38, radius }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: radius != null ? radius : Math.round(size * 0.28),
      flexShrink: 0, background: mcStageColor(stage),
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff', fontFamily: 'var(--mono)', fontWeight: 600,
      fontSize: Math.round(size * 0.34), letterSpacing: '0.01em',
      boxShadow: 'var(--sh-raised-crisp)',
    }}>{ini}</div>
  );
}

// ─── Booked-by-AI tag ──────────────────────────────────────────────
function MCAITag({ small }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      background: 'var(--wine-tint)', border: '1px solid var(--wine-glow)', color: 'var(--wine)',
      borderRadius: 'var(--r-pill)', padding: small ? '2px 8px' : '3px 10px',
      fontFamily: 'var(--mono)', fontSize: small ? 7.5 : 8.5, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 700,
    }}><MCSparkGlyph s={small ? 9 : 11} />Booked by AI</span>
  );
}

function MCIntentDot({ likelihood, showPct }) {
  const it = mcIntent(likelihood);
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: it.color, flexShrink: 0 }} />
      {showPct && <span style={{ fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 700, color: it.color }}>{likelihood}%</span>}
      <span style={{ fontFamily: 'var(--mono)', fontSize: 8.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--mute)' }}>{it.label}</span>
    </span>
  );
}

// ─── Agenda event row (full-width touch card) ──────────────────────
function MCEventRow({ ev, onOpen }) {
  const it = mcIntent(ev.likelihood);
  const sm = mcStatus(ev.status);
  const faded = ev.status === 'noshow';
  return (
    <button onClick={() => onOpen(ev)} style={{
      width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer',
      display: 'flex', alignItems: 'center', gap: 13, padding: '12px 14px',
      borderRadius: 'var(--r-card)', minHeight: 62, borderLeft: `3px solid ${it.color}`,
      background: 'var(--surface)', boxShadow: 'var(--sh-raised-crisp)',
      opacity: faded ? 0.7 : 1,
    }}>
      <MCAvatar ini={ev.ini} stage={ev.stage} size={40} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: faded ? 'line-through' : 'none' }}>{ev.leadName}</div>
        <div style={{ fontSize: 11, color: 'var(--mute)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>{ev.type} · {ev.campaign}</div>
        <div className="row" style={{ gap: 9, marginTop: 6 }}>
          <span className="row" style={{ gap: 4, fontFamily: 'var(--mono)', fontSize: 9.5, color: 'var(--ink-soft)' }}>
            <MCClockGlyph />{mcTime(ev.start)}
          </span>
          {ev.status !== 'booked' && (
            <span style={{ fontFamily: 'var(--mono)', fontSize: 7.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: sm.color, background: sm.tint, borderRadius: 4, padding: '2px 6px', fontWeight: 700 }}>{sm.label}</span>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 7, flexShrink: 0 }}>
        <span style={{ color: 'var(--mute-2)', display: 'flex' }}>{ev.via === 'Phone' ? <MCPhoneGlyph /> : <MCVideoGlyph />}</span>
        <MCIntentDot likelihood={ev.likelihood} showPct />
      </div>
    </button>
  );
}

// ─── Day group header ──────────────────────────────────────────────
function MCDayBar({ d, count, isToday }) {
  return (
    <div className="row" style={{ gap: 9, padding: '15px 2px 7px' }}>
      <span style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: isToday ? 'var(--wine)' : 'var(--ink-soft)', fontWeight: 700 }}>
        {MC_DOW_FULL[d.getUTCDay()]}, {MC_MON[d.getUTCMonth()]} {d.getUTCDate()}
      </span>
      {isToday && <span style={{ fontFamily: 'var(--mono)', fontSize: 8, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--paper)', background: 'var(--wine)', borderRadius: 'var(--r-pill)', padding: '2px 8px', fontWeight: 700 }}>Today</span>}
      <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--mute-2)', background: 'var(--card)', boxShadow: 'var(--sh-raised-crisp)', borderRadius: 'var(--r-pill)', padding: '1px 8px' }}>{count}</span>
      <div className="rule" style={{ flex: 1 }} />
    </div>
  );
}

// ═══ MONTH GRID (secondary toggle — bird's-eye, tap a day → agenda) ═
function MCMonthGrid({ events, monthAnchor, todayISO, onPickDay }) {
  const anchor = mcParse(monthAnchor);
  const y = anchor.getUTCFullYear(), m = anchor.getUTCMonth();
  const first = new Date(Date.UTC(y, m, 1));
  const offset = (first.getUTCDay() + 6) % 7;       // Monday-led
  const gridStart = mcAdd(first, -offset);
  const cells = Array.from({ length: 42 }, (_, i) => mcAdd(gridStart, i));
  const weeks = [];
  for (let i = 0; i < 6; i++) {
    const wk = cells.slice(i * 7, i * 7 + 7);
    if (wk[0].getUTCMonth() === m || wk[6].getUTCMonth() === m) weeks.push(wk);
  }
  const byDay = (iso) => events.filter(e => e.iso === iso).sort((a, b) => mcHM(a.start) - mcHM(b.start));

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '14px 14px 90px' }}>
      <div className="row" style={{ gap: 9, padding: '0 2px 12px' }}>
        <span className="serif" style={{ fontSize: 22, color: 'var(--ink)', letterSpacing: '-0.01em' }}>{MC_MON_FULL[m]} {y}</span>
        <div className="rule" style={{ flex: 1 }} />
        <span style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--mute-2)' }}>Tap a day</span>
      </div>
      {/* weekday header */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', marginBottom: 6 }}>
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <div key={i} style={{ textAlign: 'center', fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.06em', color: 'var(--mute-2)', fontWeight: 700 }}>{d}</div>
        ))}
      </div>
      {/* weeks */}
      <div className="neu-inset" style={{ borderRadius: 'var(--r-card)', padding: 6, background: 'var(--bg-2)' }}>
        {weeks.map((wk, wi) => (
          <div key={wi} style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 3 }}>
            {wk.map((d) => {
              const iso = mcISO(d), inMonth = d.getUTCMonth() === m, isToday = iso === todayISO;
              const items = byDay(iso);
              const has = items.length > 0;
              return (
                <button key={iso} disabled={!has} onClick={() => has && onPickDay(iso)} style={{
                  aspectRatio: '1 / 1.15', border: 'none', cursor: has ? 'pointer' : 'default',
                  borderRadius: 'var(--r-surface)', padding: '5px 0 4px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                  background: isToday ? 'var(--wine-tint)' : has ? 'var(--card)' : 'transparent',
                  boxShadow: isToday ? 'inset 0 0 0 1.5px var(--wine-glow)' : has ? 'var(--sh-raised-crisp)' : 'none',
                  opacity: inMonth ? 1 : 0.32,
                }}>
                  <span style={{ fontFamily: 'var(--serif)', fontSize: 14, color: isToday ? 'var(--wine)' : 'var(--ink-soft)', fontWeight: isToday ? 700 : 400 }}>{d.getUTCDate()}</span>
                  <span style={{ display: 'flex', gap: 2, alignItems: 'center', minHeight: 5 }}>
                    {items.slice(0, 3).map(e => {
                      const it = mcIntent(e.likelihood);
                      return <span key={e.id} style={{ width: 4.5, height: 4.5, borderRadius: '50%', background: e.status === 'noshow' ? 'var(--line-strong)' : it.color }} />;
                    })}
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
      {/* legend */}
      <div className="row" style={{ gap: 14, justifyContent: 'center', padding: '16px 0 0', flexWrap: 'wrap' }}>
        {[['var(--good)', 'High intent'], ['var(--warn)', 'Medium'], ['var(--stage-lost)', 'Low']].map(([c, l]) => (
          <span key={l} className="row" style={{ gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: c }} />
            <span style={{ fontFamily: 'var(--mono)', fontSize: 8.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--mute)' }}>{l}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// ═══ DETAIL SHEET BODY ═════════════════════════════════════════════
function MCField({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
      <span style={{ fontFamily: 'var(--mono)', fontSize: 8.5, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--mute-2)' }}>{label}</span>
      <span style={{ fontSize: 13.5, color: 'var(--ink)', wordBreak: 'break-word' }}>{children}</span>
    </div>
  );
}

function MCDetailBody({ ev, onClose }) {
  const it = mcIntent(ev.likelihood);
  const sm = mcStatus(ev.status);
  const d = mcParse(ev.iso);
  // Mirror desktop CalendarDetail exactly: call getDetail() unconditionally and
  // render summary.headline + summary.points + recent messages verbatim.
  const detail = window.LEADS_DATA ? window.LEADS_DATA.getDetail(ev.leadId) : null;
  const reasons = detail && detail.summary && detail.summary.points
    ? detail.summary.points.map(p => p.text).slice(0, 3)
    : [];
  const recent = detail && detail.messages
    ? detail.messages.filter(m => m.dir === 'in' || m.dir === 'out').slice(-2)
    : [];

  return (
    <div className="la-app" style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      {/* hero */}
      <div style={{ flexShrink: 0, background: 'var(--bg)', borderBottom: '1px solid var(--line)', padding: '28px 16px 16px' }}>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 14 }}>
          <MCAITag />
          <MCIntentDot likelihood={ev.likelihood} showPct />
        </div>
        <div className="row" style={{ gap: 13, alignItems: 'center' }}>
          <MCAvatar ini={ev.ini} stage={ev.stage} size={46} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 24, color: 'var(--ink)', lineHeight: 1.05, letterSpacing: '-0.01em' }}>{ev.leadName}</div>
            <div style={{ fontSize: 12.5, color: 'var(--mute)', marginTop: 3 }}>{ev.type} · {ev.campaign}</div>
          </div>
        </div>
      </div>

      {/* body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '18px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        {/* meeting facts */}
        <div className="neu-raised" style={{ borderRadius: 'var(--r-card)', padding: 18, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
          <MCField label="Date">{MC_DOW_FULL[d.getUTCDay()]}<br /><span style={{ color: 'var(--mute)', fontSize: 12 }}>{MC_MON_FULL[d.getUTCMonth()]} {d.getUTCDate()}, {d.getUTCFullYear()}</span></MCField>
          <MCField label="Time">
            <span className="row" style={{ gap: 6 }}><MCClockGlyph s={13} />{mcTime(ev.start)} – {mcTime(ev.end)}</span>
          </MCField>
          <MCField label="Via">
            <span className="row" style={{ gap: 7 }}>{ev.via === 'Phone' ? <MCPhoneGlyph s={13} /> : <MCVideoGlyph s={14} />}{ev.via}</span>
          </MCField>
          <MCField label="Status">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase', color: sm.color, background: sm.tint, borderRadius: 'var(--r-pill)', padding: '4px 10px', fontWeight: 700 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: sm.color }} />{sm.label}
            </span>
          </MCField>
          <div style={{ gridColumn: '1 / -1' }}>
            <MCField label="Attendance likelihood">
              <span className="row" style={{ gap: 9 }}>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 15, fontWeight: 700, color: it.color }}>{ev.likelihood}%</span>
                <div style={{ flex: 1, height: 6, background: 'var(--bg)', boxShadow: 'var(--sh-inset-crisp)', borderRadius: 'var(--r-pill)', overflow: 'hidden' }}>
                  <div style={{ width: `${ev.likelihood}%`, height: '100%', background: it.color, borderRadius: 'var(--r-pill)' }} />
                </div>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 8.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--mute)' }}>{it.label}</span>
              </span>
            </MCField>
          </div>
        </div>

        {/* AI summary — mirrors desktop CalendarDetail verbatim */}
        {detail && detail.summary && (
          <div>
            <div className="row" style={{ gap: 7, marginBottom: 9 }}>
              <span style={{ color: 'var(--wine)', display: 'flex' }}><MCSparkGlyph s={14} /></span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--wine)', fontWeight: 700 }}>Why AI booked this</span>
            </div>
            <p style={{ margin: '0 0 12px', fontSize: 13, lineHeight: 1.55, color: 'var(--ink-soft)', textWrap: 'pretty' }}>{detail.summary.headline}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {reasons.map((r, i) => (
                <div key={i} style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
                  <span style={{ width: 16, height: 16, borderRadius: 5, flexShrink: 0, marginTop: 1, background: 'var(--good-tint)', color: 'var(--good)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><MCCheckGlyph /></span>
                  <span style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--ink-soft)', textWrap: 'pretty' }}>{r}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent conversation — mirrors desktop CalendarDetail verbatim */}
        {recent.length > 0 && (
          <div>
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: 9 }}>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--mute)', fontWeight: 700 }}>Recent conversation</span>
              <a href="Leads Page.html" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: 'var(--mono)', fontSize: 8.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--wine)', fontWeight: 700 }}>Open in lead <MCArrowGlyph /></a>
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
        )}

        {/* contact (when available) */}
        {detail && detail.contact && (
          <div>
            <div className="eyebrow eyebrow-sm" style={{ marginBottom: 9 }}>Contact</div>
            <div className="neu-raised" style={{ borderRadius: 'var(--r-card)', padding: 18, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <MCField label="Phone">{detail.contact.phone}</MCField>
              <MCField label="Email">{detail.contact.email}</MCField>
              <MCField label="Source">{detail.contact.source}</MCField>
              <MCField label="Lead score">
                <span className="row" style={{ gap: 7 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: detail.score >= 55 ? 'var(--good)' : detail.score >= 40 ? 'var(--warn)' : 'var(--stage-contacted)' }} />
                  {detail.score}/100
                </span>
              </MCField>
            </div>
          </div>
        )}
      </div>

      {/* actions */}
      <div style={{ flexShrink: 0, borderTop: '1px solid var(--line)', padding: '14px 18px', display: 'flex', gap: 10 }}>
        <button style={{
          flex: 1, height: 48, borderRadius: 'var(--r-surface)', border: 'none', cursor: 'pointer',
          background: 'var(--wine-grad)', boxShadow: 'var(--sh-raised-medium)',
          color: 'var(--paper)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
          fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700,
        }}>
          {ev.via === 'Phone' ? <MCPhoneGlyph s={15} /> : <MCVideoGlyph s={16} />}{ev.via === 'Phone' ? 'Call now' : 'Join meeting'}
        </button>
        <button title="Reschedule" style={{
          width: 48, height: 48, borderRadius: 'var(--r-surface)', border: 'none', cursor: 'pointer',
          background: 'var(--surface)', boxShadow: 'var(--sh-raised-crisp)', color: 'var(--mute)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}><MCReschedGlyph s={18} /></button>
      </div>
    </div>
  );
}

// ─── Top bar (title + week nav + Agenda/Month toggle) ──────────────
function MCCalendarBar({ view, setView, weekLabel, onPrev, onNext }) {
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
        <span className="serif" style={{ fontSize: 34, color: 'var(--ink)', letterSpacing: '-0.02em' }}>Calendar</span>
        <div className="la-seg">
          {[['agenda', IconTasks, 'Agenda'], ['month', IconLayers, 'Month']].map(([k, Ic, label]) => {
            const on = k === view;
            return (
              <button key={k} onClick={() => setView(k)} className={`la-seg-btn${on ? ' on' : ''}`}><Ic size={13} />{label}</button>
            );
          })}
        </div>
      </div>
      {/* week navigator — agenda only */}
      {view === 'agenda' && (
        <div className="row" style={{ justifyContent: 'space-between', padding: '0 16px 12px' }}>
          <button onClick={onPrev} style={{
            width: 38, height: 38, borderRadius: 'var(--r-surface)', flexShrink: 0, border: 'none', cursor: 'pointer',
            background: 'var(--surface)', boxShadow: 'var(--sh-raised-crisp)', color: 'var(--mute)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}><MCChevL /></button>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 8.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--mute-2)' }}>Week of</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', marginTop: 2 }}>{weekLabel}</div>
          </div>
          <button onClick={onNext} style={{
            width: 38, height: 38, borderRadius: 'var(--r-surface)', flexShrink: 0, border: 'none', cursor: 'pointer',
            background: 'var(--surface)', boxShadow: 'var(--sh-raised-crisp)', color: 'var(--mute)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}><MCChevR /></button>
        </div>
      )}
    </div>
  );
}

// ─── Stat strip + intent filter chips ──────────────────────────────
function MCFilters({ filter, setFilter, counts, stats }) {
  const chips = [['all', 'All'], ['high', 'High intent'], ['medium', 'Medium'], ['attention', 'Needs attention']];
  return (
    <div style={{ flexShrink: 0, background: 'var(--bg)', borderBottom: '1px solid var(--line)', padding: '12px 0 11px' }}>
      {/* week stat strip */}
      <div style={{ display: 'flex', gap: 9, overflowX: 'auto', padding: '0 16px 11px', scrollbarWidth: 'none' }}>
        {stats.map((s, i) => (
          <div key={i} style={{ flexShrink: 0, background: 'var(--surface)', boxShadow: 'var(--sh-raised-crisp)', borderRadius: 'var(--r-surface)', padding: '9px 13px', minWidth: 116 }}>
            <div className="row" style={{ gap: 7, alignItems: 'baseline' }}>
              <span style={{ fontFamily: 'var(--serif)', fontSize: 22, color: 'var(--ink)', letterSpacing: '-0.01em', lineHeight: 1 }}>{s.value}</span>
              {s.delta && <span style={{ fontFamily: 'var(--mono)', fontSize: 9, fontWeight: 700, color: 'var(--good)' }}>{s.delta}</span>}
            </div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 8, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--mute-2)', marginTop: 5 }}>{s.label}</div>
          </div>
        ))}
      </div>
      {/* intent chips */}
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

// ═══ CALENDAR SCREEN ═══════════════════════════════════════════════
function MobCalendarScreen() {
  const C = window.LA_CAL;
  const [view, setView] = React.useState('agenda');
  const [filter, setFilter] = React.useState('all');
  const [weekOffset, setWeekOffset] = React.useState(0);
  const [sel, setSel] = React.useState(null);
  const [open, setOpen] = React.useState(false);

  const openEvent = (e) => { setSel(e); requestAnimationFrame(() => requestAnimationFrame(() => setOpen(true))); };
  const closeEvent = () => setOpen(false);

  const matches = (e, f) => {
    switch (f) {
      case 'high':      return e.likelihood >= 70;
      case 'medium':    return e.likelihood >= 40 && e.likelihood < 70;
      case 'attention': return e.status === 'noshow' || e.status === 'rescheduled';
      default:          return true;
    }
  };

  // active week window (Mon–Sun) from data weekStart, shifted by weekOffset
  const baseMon = mcParse(C.weekStart);
  const weekMon = mcAdd(baseMon, weekOffset * 7);
  const weekDays = Array.from({ length: 7 }, (_, i) => mcAdd(weekMon, i));
  const weekISO = new Set(weekDays.map(mcISO));
  const weekEnd = weekDays[6];
  const weekLabel = `${MC_MON[weekMon.getUTCMonth()]} ${weekMon.getUTCDate()} – ${weekMon.getUTCMonth() === weekEnd.getUTCMonth() ? '' : MC_MON[weekEnd.getUTCMonth()] + ' '}${weekEnd.getUTCDate()}`;

  // scope for counts = this week's events (agenda), filtered later
  const weekEvents = C.events.filter(e => weekISO.has(e.iso));
  const counts = React.useMemo(() => ({
    all: weekEvents.length,
    high: weekEvents.filter(e => matches(e, 'high')).length,
    medium: weekEvents.filter(e => matches(e, 'medium')).length,
    attention: weekEvents.filter(e => matches(e, 'attention')).length,
  }), [weekOffset]);

  // agenda groups: each day in the week that has (filtered) events
  const dayGroups = weekDays.map(d => {
    const iso = mcISO(d);
    const items = weekEvents.filter(e => e.iso === iso && matches(e, filter)).sort((a, b) => mcHM(a.start) - mcHM(b.start));
    return { d, iso, items };
  }).filter(g => g.items.length);

  // jump from month grid → agenda scoped to the picked day's week
  const pickDay = (iso) => {
    const diff = Math.round((mcParse(iso) - baseMon) / 86400000);
    setWeekOffset(Math.floor(diff / 7));
    setFilter('all');
    setView('agenda');
  };

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <MobRecede open={open}>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
          <MCCalendarBar
            view={view} setView={setView} weekLabel={weekLabel}
            onPrev={() => setWeekOffset(o => o - 1)} onNext={() => setWeekOffset(o => o + 1)}
          />

          {view === 'agenda' ? (
            <>
              <MCFilters filter={filter} setFilter={setFilter} counts={counts} stats={C.stats} />
              <div style={{ flex: 1, overflowY: 'auto', padding: '4px 14px 90px' }}>
                {dayGroups.length === 0 ? (
                  <div style={{ padding: '70px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
                    <div style={{ width: 60, height: 60, borderRadius: 'var(--r-card)', background: 'var(--surface)', boxShadow: 'var(--sh-raised-medium)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--mute-2)' }}><IconCal size={26} /></div>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--mute-2)' }}>No meetings this week</div>
                  </div>
                ) : dayGroups.map(g => (
                  <div key={g.iso}>
                    <MCDayBar d={g.d} count={g.items.length} isToday={g.iso === C.today} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                      {g.items.map(e => <MCEventRow key={e.id} ev={e} onOpen={openEvent} />)}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <MCMonthGrid events={C.events} monthAnchor={C.monthAnchor} todayISO={C.today} onPickDay={pickDay} />
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
            Book
          </button>
        </div>
      </MobRecede>

      <MobSheet open={open} onClose={closeEvent}>
        {sel && <MCDetailBody ev={sel} onClose={closeEvent} />}
      </MobSheet>
    </div>
  );
}

Object.assign(window, { MobCalendarScreen });
