// mobile-leads.jsx — Leads tab for the Lead Awaker mobile app.
// Reflows the desktop Leads page (list rail + lead detail + activity) into a
// single-pane phone screen: a grouped lead list (with an optional last-message
// "Chats" peek under every row) and a horizontal pipeline board. Tapping a lead
// raises a detail bottom-sheet (variation B) holding the hero, pipeline, and
// Chat / Summary / Score / Info tabs.
//
// Self-contained on purpose: depends only on leads-data.js (LEADS_DATA),
// components.jsx (icons), mobile-shell.jsx (MobSheet, MobRecede, IconBtn) —
// NOT leads-components.jsx / leads-views.jsx, whose StageAvatar/StatusDot/etc.
// would clobber peers. Small bits are re-implemented here with ML* prefixes.

// ─── Glyphs not present as shared icons ────────────────────────────
const MLPlusGlyph  = ({ s = 16 }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>;
const MLListGlyph  = ({ s = 13 }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><path d="M8 6h13M8 12h13M8 18h13" /><circle cx="3.5" cy="6" r="1.2" fill="currentColor" stroke="none" /><circle cx="3.5" cy="12" r="1.2" fill="currentColor" stroke="none" /><circle cx="3.5" cy="18" r="1.2" fill="currentColor" stroke="none" /></svg>;
const MLPipeGlyph  = ({ s = 13 }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="5" height="16" rx="1.5" /><rect x="10" y="4" width="5" height="11" rx="1.5" /><rect x="17" y="4" width="4" height="14" rx="1.5" /></svg>;
const MLSendGlyph  = ({ s = 15 }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12 20 4l-6 16-3-7z" /></svg>;

// ─── Stage helpers ─────────────────────────────────────────────────
function mlStage(lead) {
  const P = window.LEADS_DATA.pipeline;
  return P.find(s => s.key === lead.stage) || P[0];
}

// Square, rounded avatar tinted by conversion-stage color
function MLAvatar({ lead, size = 38, radius }) {
  const s = mlStage(lead);
  return (
    <div style={{
      width: size, height: size, borderRadius: radius != null ? radius : Math.round(size * 0.28),
      flexShrink: 0, background: s.color,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff', fontFamily: 'var(--mono)', fontWeight: 600,
      fontSize: Math.round(size * 0.34), letterSpacing: '0.01em',
      boxShadow: 'var(--sh-raised-crisp)',
    }}>{lead.ini}</div>
  );
}

// ─── Temperature badge ─────────────────────────────────────────────
const ML_TEMP = {
  Hot:      { bg: 'rgba(162,75,63,0.10)',  fg: '#A24B3F', br: 'rgba(162,75,63,0.22)' },
  Warm:     { bg: 'rgba(185,130,31,0.10)', fg: '#B9821F', br: 'rgba(185,130,31,0.22)' },
  Lukewarm: { bg: 'rgba(185,130,31,0.08)', fg: '#B9821F', br: 'rgba(185,130,31,0.18)' },
  Cold:     { bg: 'rgba(84,123,176,0.10)', fg: '#547BB0', br: 'rgba(84,123,176,0.22)' },
};
function MLTempBadge({ temp }) {
  if (!temp) return null;
  const c = ML_TEMP[temp] || ML_TEMP.Cold;
  return (
    <span style={{
      fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.16em', textTransform: 'uppercase',
      padding: '3px 9px', borderRadius: 'var(--r-pill)', background: c.bg, color: c.fg, border: `1px solid ${c.br}`,
    }}>{temp}</span>
  );
}

// ─── Score arc — mini donut 0–100 ──────────────────────────────────
function MLScoreArc({ score, size = 30, sw = 2.5 }) {
  const r = (size - sw) / 2;
  const c = 2 * Math.PI * r;
  const fill = (score / 100) * c;
  const color = score >= 55 ? 'var(--good)' : score >= 40 ? 'var(--warn)' : 'var(--stage-contacted)';
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', display: 'block' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={sw} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={sw}
          strokeDasharray={`${fill} ${c - fill}`} strokeLinecap="round" />
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
        justifyContent: 'center', fontFamily: 'var(--mono)', fontSize: size < 34 ? 8.5 : 11,
        fontWeight: 700, color: 'var(--ink)',
      }}>{score}</div>
    </div>
  );
}

// ─── Pipeline bar — segmented, colored by stage ────────────────────
function MLPipelineBar({ stages, stageIdx }) {
  const cur = stages[stageIdx] || stages[0];
  return (
    <div>
      <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
        {stages.map((s, i) => {
          const reached = i <= stageIdx, current = i === stageIdx;
          return (
            <div key={s.key} style={{
              flex: 1, height: current ? 10 : 6, borderRadius: 'var(--r-pill)',
              background: reached ? s.color : 'var(--line)',
              boxShadow: current ? '0 2px 7px rgba(0,0,0,0.16)'
                : reached ? 'inset 0 1px 0 rgba(255,255,255,0.3)' : 'none',
              transition: 'all 260ms',
            }} />
          );
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 9.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--mute-2)' }}>
          Stage {stageIdx + 1} of {stages.length}
        </span>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 7,
          background: 'var(--surface)', boxShadow: 'var(--sh-raised-crisp)',
          borderRadius: 'var(--r-pill)', padding: '4px 11px 4px 9px',
        }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: cur.color }} />
          <span style={{ fontFamily: 'var(--mono)', fontSize: 9.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: cur.color, fontWeight: 700 }}>{cur.label}</span>
        </span>
      </div>
    </div>
  );
}

// ─── Last-message peek (revealed under list rows by the Chats toggle) ─
function MLPeek({ lead }) {
  const m = lead.lastMsg;
  if (!m) return null;
  const isIn = m.dir === 'in';
  return (
    <div style={{ padding: '0 14px 12px 60px' }}>
      <div style={{
        background: isIn ? 'var(--card-bright)' : 'var(--wine-tint)',
        boxShadow: isIn ? 'var(--sh-raised-crisp)' : 'none',
        border: isIn ? 'none' : '1px solid var(--wine-glow)',
        borderRadius: isIn ? '3px 12px 12px 12px' : '12px 3px 12px 12px',
        padding: '9px 12px',
      }}>
        <div className="row" style={{ gap: 6, marginBottom: 3 }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 8, letterSpacing: '0.14em', textTransform: 'uppercase', color: isIn ? 'var(--good)' : 'var(--wine)', fontWeight: 700 }}>{isIn ? lead.name.split(/\s+/)[0] : 'AI Agent'}</span>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 8.5, color: 'var(--mute-2)' }}>· {m.time} ago</span>
        </div>
        <p style={{ margin: 0, fontSize: 12, lineHeight: 1.5, color: 'var(--ink-soft)', textWrap: 'pretty', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{m.text}</p>
      </div>
    </div>
  );
}

// ─── Agenda-style lead row (full-width touch card) ─────────────────
function MLLeadRow({ lead, onOpen, showPeek }) {
  const stage = mlStage(lead);
  return (
    <div style={{ background: 'var(--surface)', borderRadius: 'var(--r-card)', boxShadow: 'var(--sh-raised-crisp)', overflow: 'hidden' }}>
      <button onClick={() => onOpen(lead)} style={{
        width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer', background: 'transparent',
        display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', minHeight: 60,
      }}>
        <MLAvatar lead={lead} size={38} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="row" style={{ gap: 6, marginBottom: 4 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lead.name}</span>
            {lead.demo && <span style={{ fontFamily: 'var(--mono)', fontSize: 7.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--mute-2)', border: '1px solid var(--line-strong)', borderRadius: 3, padding: '1px 4px', flexShrink: 0 }}>demo</span>}
          </div>
          <div className="row" style={{ gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: stage.color, flexShrink: 0 }} />
            <span style={{ fontSize: 11.5, color: 'var(--mute)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{stage.label}{lead.campaign ? ` · ${lead.campaign}` : ''}</span>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--mute-2)', letterSpacing: '0.06em' }}>{lead.ago}</span>
          {lead.score > 0 ? <MLScoreArc score={lead.score} size={30} /> : <MLTempBadge temp={lead.temp} />}
        </div>
      </button>
      {showPeek && <MLPeek lead={lead} />}
    </div>
  );
}

// ─── Group header ──────────────────────────────────────────────────
function MLGroupBar({ label, count }) {
  return (
    <div className="row" style={{ gap: 9, padding: '14px 2px 8px' }}>
      <span style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-soft)', fontWeight: 700 }}>{label}</span>
      <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--mute-2)', background: 'var(--card)', boxShadow: 'var(--sh-raised-crisp)', borderRadius: 'var(--r-pill)', padding: '1px 8px' }}>{count}</span>
      <div className="rule" style={{ flex: 1 }} />
    </div>
  );
}

// ─── Pipeline board card (compact) ─────────────────────────────────
function MLBoardCard({ lead, onOpen }) {
  return (
    <button onClick={() => onOpen(lead)} style={{
      width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer',
      background: 'var(--card)', borderRadius: 'var(--r-surface)', padding: '11px 12px',
      boxShadow: 'var(--sh-raised-crisp)', display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <MLAvatar lead={lead} size={32} radius={9} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lead.name}</div>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 8.5, color: 'var(--mute-2)', letterSpacing: '0.06em', marginTop: 2 }}>{lead.ago} ago</div>
      </div>
      {lead.score > 0 && <MLScoreArc score={lead.score} size={26} />}
    </button>
  );
}

// ─── Chat message (inside the detail sheet) ────────────────────────
function MLChatMsg({ msg }) {
  if (msg.dir === 'div') {
    return (
      <div className="row" style={{ gap: 10, padding: '6px 0' }}>
        <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
        <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--mute-2)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>{msg.text}</span>
        <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
      </div>
    );
  }
  const isOut = msg.dir === 'out';
  return (
    <div style={{ display: 'flex', justifyContent: isOut ? 'flex-end' : 'flex-start', marginBottom: 2 }}>
      <div style={{
        maxWidth: '82%',
        background: isOut ? 'var(--card)' : 'var(--card-bright)',
        boxShadow: isOut ? 'var(--sh-raised-crisp)' : 'var(--sh-raised-medium)',
        borderRadius: isOut ? '14px 4px 14px 14px' : '4px 14px 14px 14px',
        padding: '9px 13px',
      }}>
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: 'var(--ink-soft)', textWrap: 'pretty' }}>{msg.text}</p>
        <div style={{ marginTop: 3, textAlign: isOut ? 'right' : 'left', fontFamily: 'var(--mono)', fontSize: 8.5, color: 'var(--mute-2)', letterSpacing: '0.06em' }}>{msg.time}</div>
      </div>
    </div>
  );
}

// ─── Summary content ───────────────────────────────────────────────
function MLSummary({ summary }) {
  const toneColor = { good: 'var(--good)', warn: 'var(--warn)', neutral: 'var(--mute)' };
  return (
    <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', padding: '4px 10px', borderRadius: 'var(--r-pill)', color: 'var(--paper)', background: 'var(--wine-grad)' }}>{summary.outcome}</span>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', padding: '4px 10px', borderRadius: 'var(--r-pill)', color: 'var(--mute)', background: 'var(--bg)', boxShadow: 'var(--sh-inset-crisp)' }}>{summary.sentiment}</span>
      </div>
      <p className="serif" style={{ margin: 0, fontSize: 19, lineHeight: 1.4, color: 'var(--ink)', letterSpacing: '-0.01em', textWrap: 'pretty' }}>{summary.headline}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
        <div className="eyebrow eyebrow-sm">Key points</div>
        {summary.points.map((p, i) => (
          <div key={i} className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
            <span style={{ width: 7, height: 7, borderRadius: 2, marginTop: 6, flexShrink: 0, background: toneColor[p.tone] || 'var(--mute)' }} />
            <span style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--ink-soft)', textWrap: 'pretty' }}>{p.text}</span>
          </div>
        ))}
      </div>
      <div style={{ background: 'var(--wine-tint)', borderRadius: 'var(--r-surface)', padding: '13px 15px', display: 'flex', gap: 11, alignItems: 'flex-start' }}>
        <span style={{ color: 'var(--wine)', display: 'flex', marginTop: 1, flexShrink: 0 }}><IconSpark size={15} /></span>
        <div>
          <div className="eyebrow eyebrow-sm wine" style={{ marginBottom: 4 }}>Recommended next step</div>
          <div style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--ink-soft)' }}>{summary.nextStep}</div>
        </div>
      </div>
      <div className="row" style={{ gap: 7, flexWrap: 'wrap' }}>
        {summary.topics.map((tp, i) => (
          <span key={i} style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '4px 9px', borderRadius: 'var(--r-pill)', color: 'var(--mute)', border: '1px solid var(--line-strong)' }}>{tp}</span>
        ))}
      </div>
    </div>
  );
}

// ─── Score content ─────────────────────────────────────────────────
function MLScore({ detail }) {
  const { score, temp, scoreBreakdown, scoreHistory } = detail;
  const w = 100, h = 48;
  const max = Math.max(...scoreHistory) + 4;
  const min = Math.max(0, Math.min(...scoreHistory) - 4);
  const pts = scoreHistory.map((v, i) => {
    const x = (i / (scoreHistory.length - 1)) * w;
    const y = h - ((v - min) / (max - min)) * (h - 4) - 2;
    return `${x},${y}`;
  }).join(' ');
  const lastX = w, lastY = h - ((scoreHistory[scoreHistory.length - 1] - min) / (max - min)) * (h - 4) - 2;
  const scoreColor = score >= 55 ? 'var(--good)' : score >= 40 ? 'var(--warn)' : 'var(--stage-contacted)';
  return (
    <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* hero number */}
      <div>
        <MLTempBadge temp={temp} />
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginTop: 8 }}>
          <span style={{ fontFamily: 'var(--serif)', fontSize: 64, lineHeight: 1, color: 'var(--ink)', letterSpacing: '-0.02em' }}>{score}</span>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--mute-2)' }}>/100</span>
        </div>
        <div style={{ height: 6, background: 'var(--bg)', boxShadow: 'var(--sh-inset-crisp)', borderRadius: 'var(--r-pill)', overflow: 'hidden', marginTop: 13 }}>
          <div style={{ width: `${score}%`, height: '100%', background: scoreColor, borderRadius: 'var(--r-pill)', transition: 'width 500ms' }} />
        </div>
      </div>
      {/* sparkline */}
      <div>
        <div className="eyebrow eyebrow-sm" style={{ marginBottom: 9 }}>Score trend · 5 weeks</div>
        <div style={{ background: 'var(--bg)', boxShadow: 'var(--sh-inset-crisp)', borderRadius: 'var(--r-button)', padding: '12px 14px' }}>
          <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" width="100%" height={h} style={{ display: 'block' }}>
            {[25, 50, 75].map(y => <line key={y} x1="0" y1={y * h / 100} x2={w} y2={y * h / 100} stroke="var(--line)" strokeWidth="0.3" vectorEffect="non-scaling-stroke" />)}
            <polyline points={pts} fill="none" stroke="var(--warn)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            <circle cx={lastX} cy={lastY} r="3" fill="var(--warn)" vectorEffect="non-scaling-stroke" />
          </svg>
        </div>
      </div>
      {/* sub-scores */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {scoreBreakdown.map(s => (
          <div key={s.label}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
              <span style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--ink-soft)' }}>{s.label}</span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--mute)' }}>{s.value}/{s.max}</span>
            </div>
            <div style={{ height: 5, background: 'var(--bg)', boxShadow: 'var(--sh-inset-crisp)', borderRadius: 'var(--r-pill)', overflow: 'hidden', marginBottom: 4 }}>
              <div style={{ width: `${(s.value / s.max) * 100}%`, height: '100%', background: s.color, borderRadius: 'var(--r-pill)', transition: 'width 500ms' }} />
            </div>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 8.5, color: 'var(--mute-2)', letterSpacing: '0.04em' }}>{s.note}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Info (contact) content ────────────────────────────────────────
function MLInfo({ detail }) {
  const c = detail.contact;
  const fields = [
    { label: 'First Name', val: c.firstName },
    { label: 'Phone', val: c.phone },
    { label: 'Email', val: c.email },
    { label: 'Source', val: c.source },
    { label: 'Campaign', val: detail.campaign || '—' },
    { label: 'Account', val: detail.account },
    { label: 'Created', val: c.created },
  ];
  return (
    <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {detail.booking && (
        <div style={{ background: 'var(--warn-tint)', border: '1px solid rgba(196,138,47,0.32)', borderRadius: 'var(--r-surface)', padding: '13px 15px' }}>
          <div className="row" style={{ gap: 7, marginBottom: 8 }}>
            <span style={{ color: 'var(--stage-booked)', display: 'flex' }}><IconCal size={14} /></span>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--stage-booked)', fontWeight: 700 }}>Meeting booked</span>
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{detail.booking.day}, {detail.booking.mon} {detail.booking.d}, 2026</div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-soft)', marginTop: 3 }}>{detail.booking.start} – {detail.booking.end} · {detail.booking.via}</div>
          <div className="row" style={{ gap: 7, marginTop: 9 }}>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--mute)' }}>Attendance</span>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 700, color: detail.booking.likelihood >= 70 ? 'var(--good)' : 'var(--warn)' }}>{detail.booking.likelihood}%</span>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--mute-2)' }}>{detail.booking.conf}</span>
          </div>
        </div>
      )}
      <div className="neu-raised" style={{ borderRadius: 'var(--r-card)', padding: 18, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {fields.map(f => (
          <div key={f.label} style={{ minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 8.5, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--mute-2)', marginBottom: 4 }}>{f.label}</div>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-soft)', wordBreak: 'break-word' }}>{f.val}</div>
          </div>
        ))}
      </div>
      <div>
        <div className="eyebrow eyebrow-sm" style={{ marginBottom: 7 }}>Notes</div>
        <textarea className="neu-input" defaultValue={detail.note} placeholder="Add notes about this lead…" rows={4} style={{ width: '100%', resize: 'none', lineHeight: 1.55, fontSize: 13, padding: '11px 13px' }} />
      </div>
    </div>
  );
}

// ─── Detail body (inside the bottom sheet) ─────────────────────────
function MLDetailBody({ detail, onClose }) {
  const { pipeline } = window.LEADS_DATA;
  const [tab, setTab] = React.useState('chat');
  const stage = mlStage(detail);
  const hasSummary = detail.summary && detail.summary.ready;
  const tabs = [['chat', 'Chat'], ['summary', 'Summary'], ['score', 'Score'], ['info', 'Info']];

  return (
    <div className="la-app" style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      {/* hero */}
      <div style={{ flexShrink: 0, background: 'var(--bg)', borderBottom: '1px solid var(--line)', padding: '28px 16px 0' }}>
        <div className="row" style={{ gap: 13, alignItems: 'center' }}>
          <MLAvatar lead={detail} size={46} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="row" style={{ gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'var(--serif)', fontSize: 24, color: 'var(--ink)', lineHeight: 1, letterSpacing: '-0.01em' }}>{detail.name}</span>
              <MLTempBadge temp={detail.temp} />
            </div>
            <div className="row" style={{ gap: 9, fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--mute)', letterSpacing: '0.1em', textTransform: 'uppercase', flexWrap: 'wrap' }}>
              <span>Lead {detail.id}</span>
              <span style={{ color: 'var(--line-strong)' }}>·</span>
              <span>Activity {detail.lastActivity}</span>
            </div>
          </div>
        </div>
        {detail.booking && (
          <div className="row" style={{ gap: 7, marginTop: 12 }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: 'var(--warn-tint)', border: '1px solid rgba(196,138,47,0.4)',
              borderRadius: 'var(--r-pill)', padding: '4px 11px 4px 9px',
              color: 'var(--stage-booked)', fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 700,
            }}>
              <IconCal size={11} />Booked · {detail.booking.day} {detail.booking.mon} {detail.booking.d} · {detail.booking.start}
            </span>
          </div>
        )}
        <div style={{ padding: '16px 0 14px' }}>
          <MLPipelineBar stages={pipeline} stageIdx={detail.stageIdx} />
        </div>
        {/* tab switcher */}
        <div className="la-seg la-seg--fill" style={{ marginBottom: 12 }}>
          {tabs.map(([k, label]) => {
            const on = k === tab;
            return (
              <button key={k} onClick={() => setTab(k)} className={`la-seg-btn${on ? ' on' : ''}`} style={{ padding: '9px 0' }}>{label}</button>
            );
          })}
        </div>
      </div>

      {/* body */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {tab === 'chat' && (
          <>
            <div style={{ flex: 1, overflowY: 'auto', padding: '14px', display: 'flex', flexDirection: 'column', gap: 3 }}>
              {detail.messages.map(m => <MLChatMsg key={m.id} msg={m} />)}
              {hasSummary && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '14px 0 4px' }}>
                  <div className="row" style={{ gap: 10, width: '100%', margin: '4px 0 12px' }}>
                    <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 8.5, color: 'var(--mute-2)', letterSpacing: '0.16em', textTransform: 'uppercase' }}>Interaction finished</span>
                    <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
                  </div>
                  <div style={{ width: '96%', background: 'var(--wine-grad)', borderRadius: 'var(--r-card)', boxShadow: 'var(--sh-raised-medium), inset 0 1px 0 rgba(255,255,255,0.12)', padding: '15px 17px', color: 'var(--paper)' }}>
                    <div className="row" style={{ gap: 8, marginBottom: 9 }}>
                      <span style={{ width: 24, height: 24, borderRadius: 'var(--r-flush)', flexShrink: 0, background: 'rgba(255,255,255,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--paper)' }}><IconSpark size={13} /></span>
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.82)' }}>AI Summary</span>
                    </div>
                    <p className="serif" style={{ margin: 0, fontSize: 15.5, lineHeight: 1.45, color: 'var(--paper)', textWrap: 'pretty' }}>{detail.summary.headline}</p>
                    <button onClick={() => setTab('summary')} style={{ marginTop: 12, border: 'none', cursor: 'pointer', background: 'rgba(255,255,255,0.16)', color: 'var(--paper)', padding: '7px 14px', borderRadius: 'var(--r-pill)', fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', display: 'inline-flex', alignItems: 'center', gap: 7 }}>View full summary <IconChev size={11} /></button>
                  </div>
                </div>
              )}
            </div>
            {/* composer */}
            <div style={{ flexShrink: 0, padding: '10px 14px', borderTop: '1px solid var(--line)', display: 'flex', gap: 9, alignItems: 'center' }}>
              <div style={{ flex: 1, background: 'var(--bg)', boxShadow: 'var(--sh-inset-crisp)', borderRadius: 'var(--r-panel)', padding: '10px 16px' }}>
                <input style={{ width: '100%', border: 'none', background: 'transparent', outline: 'none', fontSize: 13, fontFamily: 'var(--sans)', color: 'var(--ink)' }} placeholder="Type a message…" />
              </div>
              <button style={{ width: 44, height: 44, borderRadius: '50%', border: 'none', flexShrink: 0, background: 'var(--wine-grad)', boxShadow: 'var(--sh-raised-crisp)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}><MLSendGlyph /></button>
            </div>
          </>
        )}
        {tab === 'summary' && <div style={{ flex: 1, overflowY: 'auto' }}>{hasSummary ? <MLSummary summary={detail.summary} /> : <div style={{ padding: '50px 20px', textAlign: 'center', fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--mute-2)' }}>No summary yet</div>}</div>}
        {tab === 'score' && <div style={{ flex: 1, overflowY: 'auto' }}><MLScore detail={detail} /></div>}
        {tab === 'info' && <div style={{ flex: 1, overflowY: 'auto' }}><MLInfo detail={detail} /></div>}
      </div>

      {/* actions */}
      <div style={{ flexShrink: 0, borderTop: '1px solid var(--line)', padding: '14px 18px', display: 'flex', gap: 10 }}>
        <button style={{
          flex: 1, height: 48, borderRadius: 'var(--r-surface)', border: 'none', cursor: 'pointer',
          background: 'var(--wine-grad)', boxShadow: 'var(--sh-raised-medium)',
          color: 'var(--paper)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
          fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700,
        }}>
          {detail.booking ? <><IconCal size={15} />View booking</> : <><IconPhone size={15} />Book call</>}
        </button>
        <button style={{
          width: 48, height: 48, borderRadius: 'var(--r-surface)', border: 'none', cursor: 'pointer',
          background: 'var(--surface)', boxShadow: 'var(--sh-raised-crisp)', color: 'var(--mute)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}><IconMore size={18} /></button>
      </div>
    </div>
  );
}

// ─── Top bar + filters ─────────────────────────────────────────────
function MLLeadsBar({ view, setView }) {
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
        <span className="serif" style={{ fontSize: 34, color: 'var(--ink)', letterSpacing: '-0.02em' }}>My Leads</span>
        <div className="la-seg">
          {[['list', MLListGlyph, 'List'], ['pipeline', MLPipeGlyph, 'Pipeline']].map(([k, Gly, label]) => {
            const on = k === view;
            return (
              <button key={k} onClick={() => setView(k)} className={`la-seg-btn${on ? ' on' : ''}`}><Gly s={13} />{label}</button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function MLFilters({ filter, setFilter, counts, peekOn, setPeekOn }) {
  const chips = [['all', 'All'], ['reply', 'Needs reply'], ['hot', 'Hot'], ['booked', 'Booked'], ['new', 'New']];
  return (
    <div style={{ flexShrink: 0, background: 'var(--bg)', borderBottom: '1px solid var(--line)', padding: '11px 0' }}>
      <div className="row" style={{ gap: 8, padding: '0 16px 11px' }}>
        <button onClick={() => setPeekOn(p => !p)} style={{
          display: 'flex', alignItems: 'center', gap: 7, padding: '7px 13px', borderRadius: 'var(--r-pill)', border: 'none', cursor: 'pointer',
          background: peekOn ? 'var(--wine-grad)' : 'var(--surface)', boxShadow: 'var(--sh-raised-crisp)',
          color: peekOn ? 'var(--paper)' : 'var(--mute)',
          fontFamily: 'var(--mono)', fontSize: 9.5, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: peekOn ? 700 : 400,
        }}><IconChats size={14} />Chats peek</button>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--mute-2)', letterSpacing: '0.06em' }}>last message per lead</span>
      </div>
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

// ─── Leads screen ──────────────────────────────────────────────────
function MobLeadsScreen() {
  const D = window.LEADS_DATA;
  const [view, setView] = React.useState('list');
  const [filter, setFilter] = React.useState('all');
  const [peekOn, setPeekOn] = React.useState(false);
  const [sel, setSel] = React.useState(null);
  const [open, setOpen] = React.useState(false);

  const replyStages = ['contacted', 'responded', 'multi', 'qualified'];
  const matches = (l, f) => {
    switch (f) {
      case 'reply':  return l.lastMsg && l.lastMsg.dir === 'in' && replyStages.includes(l.stage);
      case 'hot':    return l.temp === 'Hot';
      case 'booked': return l.stage === 'booked';
      case 'new':    return l.stage === 'new';
      default:       return true;
    }
  };
  const leads = React.useMemo(() => D.leads.filter(l => matches(l, filter)), [D.leads, filter]);
  const counts = React.useMemo(() => ({
    all: D.leads.length,
    reply: D.leads.filter(l => matches(l, 'reply')).length,
    hot: D.leads.filter(l => matches(l, 'hot')).length,
    booked: D.leads.filter(l => matches(l, 'booked')).length,
    new: D.leads.filter(l => matches(l, 'new')).length,
  }), [D.leads]);

  const openLead = (l) => { setSel(l); requestAnimationFrame(() => requestAnimationFrame(() => setOpen(true))); };
  const closeLead = () => setOpen(false);

  const week = leads.filter(l => l.grp === 'week');
  const month = leads.filter(l => l.grp === 'month');
  const detail = sel ? D.getDetail(sel.id) : null;

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <MobRecede open={open}>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
          <MLLeadsBar view={view} setView={setView} />
          <MLFilters filter={filter} setFilter={setFilter} counts={counts} peekOn={peekOn} setPeekOn={setPeekOn} />

          {view === 'list' ? (
            <div style={{ flex: 1, overflowY: 'auto', padding: '6px 14px 90px' }}>
              {leads.length === 0 && (
                <div style={{ padding: '60px 20px', textAlign: 'center', fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--mute-2)' }}>No leads match</div>
              )}
              {[['This Week', week], ['This Month', month]].map(([label, items]) => items.length > 0 && (
                <div key={label}>
                  <MLGroupBar label={label} count={items.length} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                    {items.map(l => <MLLeadRow key={l.id} lead={l} onOpen={openLead} showPeek={peekOn} />)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ flex: 1, display: 'flex', gap: 13, overflowX: 'auto', padding: '14px 14px 90px', scrollbarWidth: 'none' }}>
              {D.pipeline.map(stage => {
                const items = leads.filter(l => l.stage === stage.key);
                return (
                  <div key={stage.key} style={{ flex: '0 0 248px', display: 'flex', flexDirection: 'column' }}>
                    <div className="row" style={{ gap: 9, padding: '0 4px 11px' }}>
                      <span style={{ width: 9, height: 9, borderRadius: 3, background: stage.color }} />
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-soft)', fontWeight: 700 }}>{stage.label}</span>
                      {stage.star && <span style={{ fontFamily: 'var(--mono)', fontSize: 7.5, letterSpacing: '0.1em', color: stage.color, border: `1px solid ${stage.color}`, borderRadius: 4, padding: '1px 5px' }}>★</span>}
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--mute-2)', background: 'var(--card)', boxShadow: 'var(--sh-raised-crisp)', borderRadius: 'var(--r-pill)', padding: '1px 8px', marginLeft: 'auto' }}>{items.length}</span>
                    </div>
                    <div className="neu-inset" style={{
                      flex: 1, borderRadius: 'var(--r-card)', padding: 10, display: 'flex', flexDirection: 'column', gap: 9, minHeight: 120,
                      background: stage.star ? 'var(--warn-tint)' : 'var(--bg-2)',
                      boxShadow: stage.star ? 'var(--sh-inset-crisp), inset 0 0 0 1.5px rgba(196,138,47,0.35)' : 'var(--sh-inset-crisp)',
                    }}>
                      {items.length === 0
                        ? <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 70, fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--mute-2)' }}>Empty</div>
                        : items.map(l => <MLBoardCard key={l.id} lead={l} onOpen={openLead} />)}
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
            <MLPlusGlyph />New
          </button>
        </div>
      </MobRecede>

      <MobSheet open={open} onClose={closeLead}>
        {detail && <MLDetailBody detail={detail} onClose={closeLead} />}
      </MobSheet>
    </div>
  );
}

Object.assign(window, { MobLeadsScreen });
