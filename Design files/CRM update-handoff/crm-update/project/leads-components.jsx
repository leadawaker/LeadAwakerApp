// leads-components.jsx — primitives + detail-panel cards for the Leads page
// Depends on: components.jsx (Icon, Logo, Sidebar, icons on window), leads-data.js

// ─── Local icons ───────────────────────────────────────────────────
const IconPlus    = (p) => <Icon {...p} d={<path d="M12 5v14M5 12h14"/>} />;
const IconMic     = (p) => <Icon {...p} d={<><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 19v3"/></>} />;
const IconAttach  = (p) => <Icon {...p} d={<path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/>} />;
const IconX       = (p) => <Icon {...p} d={<path d="m18 6-12 12M6 6l12 12"/>} />;
const IconEye     = (p) => <Icon {...p} d={<><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></>} />;
const IconSummary = (p) => <Icon {...p} d={<><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></>} />;
const IconListV   = (p) => <Icon {...p} d={<><path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3.5" cy="6" r="1.2" fill="currentColor"/><circle cx="3.5" cy="12" r="1.2" fill="currentColor"/><circle cx="3.5" cy="18" r="1.2" fill="currentColor"/></>} />;
const IconTableV  = (p) => <Icon {...p} d={<><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M3 14h18M9 4v16"/></>} />;
const IconKanbanV = (p) => <Icon {...p} d={<><rect x="3" y="4" width="5" height="16" rx="1.5"/><rect x="10" y="4" width="5" height="11" rx="1.5"/><rect x="17" y="4" width="4" height="14" rx="1.5"/></>} />;
const IconChatPeek = (p) => <Icon {...p} d={<path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7a8.5 8.5 0 0 1-.9-3.8A8.38 8.38 0 0 1 12.5 3 8.38 8.38 0 0 1 21 11.5z"/>} />;
const IconCal      = (p) => <Icon {...p} d={<><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></>} />;

const HEAD_H = 52; // shared header height → keeps every panel divider on one line

// ─── Last-message peek (inline snippet shown under a list row) ─────
// Replaces a standalone Chats inbox: the latest exchange, triageable in place.
function LastMsgPeek({ lead }) {
  const m = lead.lastMsg;
  if (!m) return null;
  const isIn = m.dir === 'in';
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '2px 2px 4px 46px' }}>
      <div style={{
        flex: 1, minWidth: 0,
        background: isIn ? 'var(--bg)' : 'var(--ink)',
        boxShadow: isIn ? 'var(--sh-inset-crisp)' : 'none',
        border: 'none',
        borderRadius: isIn ? '3px 11px 11px 11px' : '11px 3px 11px 11px',
        padding: '8px 11px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 7.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: isIn ? 'var(--good)' : '#E7B7A0', fontWeight: 700 }}>{isIn ? lead.name.split(/\s+/)[0] : 'AI Agent'}</span>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 8, color: isIn ? 'var(--mute-2)' : 'rgba(240,231,213,0.45)' }}>· {m.time} ago</span>
        </div>
        <p style={{ margin: 0, fontSize: 11.5, lineHeight: 1.5, color: isIn ? 'var(--ink-soft)' : '#F0E7D5', textWrap: 'pretty', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{m.text}</p>
      </div>
    </div>
  );
}

// ─── Stage helpers ─────────────────────────────────────────────────
function stageOf(lead) {
  const P = window.LEADS_DATA.pipeline;
  return P.find(s => s.key === lead.stage) || P[0];
}

// Square, rounded avatar tinted by conversion-stage color, with initials
function StageAvatar({ lead, size = 36, radius }) {
  const s = stageOf(lead);
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
function TempBadge({ temp }) {
  if (!temp) return null;
  const map = {
    Hot:      { bg: 'rgba(162,75,63,0.10)',  fg: '#A24B3F', br: 'rgba(162,75,63,0.22)' },
    Warm:     { bg: 'rgba(185,130,31,0.10)', fg: '#B9821F', br: 'rgba(185,130,31,0.22)' },
    Lukewarm: { bg: 'rgba(185,130,31,0.08)', fg: '#B9821F', br: 'rgba(185,130,31,0.18)' },
    Cold:     { bg: 'rgba(84,123,176,0.10)', fg: '#547BB0', br: 'rgba(84,123,176,0.22)' },
  };
  const c = map[temp] || map.Cold;
  return (
    <span style={{
      fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.16em', textTransform: 'uppercase',
      padding: '3px 9px', borderRadius: 'var(--r-pill)', background: c.bg, color: c.fg, border: `1px solid ${c.br}`,
    }}>{temp}</span>
  );
}

// ─── Score arc — mini donut showing score 0–100 (used in list rows) ─
function ScoreArc({ score, size = 32, sw = 2.5 }) {
  const r = (size - sw) / 2;
  const c = 2 * Math.PI * r;
  const fill = (score / 100) * c;
  const color = score >= 55 ? 'var(--good)' : score >= 40 ? 'var(--warn)' : 'var(--stage-contacted)';
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', display: 'block' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--line)" strokeWidth={sw} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={sw}
          strokeDasharray={`${fill} ${c - fill}`} strokeLinecap="round" />
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
        justifyContent: 'center', fontFamily: 'var(--mono)', fontSize: size < 38 ? 8 : 11,
        fontWeight: 700, color: 'var(--ink)',
      }}>{score}</div>
    </div>
  );
}

// ─── Pipeline bar — segmented journey bar with stage labels ────────
function PipelineBar({ stages, stageIdx }) {
  const cur = stages[stageIdx] || stages[0];
  return (
    <div>
      {/* Bars — bottom-aligned so current stage grows taller upward */}
      <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 18 }}>
        {stages.map((s, i) => {
          const reached = i <= stageIdx, current = i === stageIdx;
          return (
            <div key={s.key} style={{
              flex: 1, borderRadius: 'var(--r-pill)',
              height: current ? 16 : reached ? 9 : 5,
              background: reached ? s.color : 'var(--line)',
              boxShadow: current ? `0 3px 10px ${s.color}55`
                       : reached ? 'inset 0 1px 0 rgba(255,255,255,0.28)' : 'none',
              transition: 'all 280ms',
            }} />
          );
        })}
      </div>
      {/* Stage labels — same flex + gap layout so they align under their bars */}
      <div style={{ display: 'flex', gap: 4, marginTop: 7 }}>
        {stages.map((s, i) => {
          const current = i === stageIdx, reached = i < stageIdx;
          return (
            <div key={s.key} style={{ flex: 1, overflow: 'hidden' }}>
              <span style={{
                display: 'block', textAlign: 'center',
                fontFamily: 'var(--mono)',
                fontSize: current ? 8.5 : 7.5,
                fontWeight: current ? 700 : 400,
                color: current ? s.color : reached ? 'var(--mute)' : 'var(--mute-2)',
                letterSpacing: '0.07em',
                textTransform: 'uppercase',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>{s.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Reusable rounded card with a fixed-height header (divider aligns) ─
// variant: 'raised' (default) | 'inset' | 'flat'
function Card({ headLeft, headRight, children, style, bodyStyle, variant }) {
  const v = variant || 'raised';
  const wrapClass = v === 'raised' ? 'neu-raised' : '';
  const wrapBg =
    v === 'raised' ? { background: 'var(--card)' }
    : v === 'inset' ? { background: 'var(--bg)', boxShadow: 'var(--sh-inset-crisp), inset 0 0 0 1px rgba(0,0,0,0.07)' }
    : { background: 'transparent', boxShadow: 'none' };
  const headBorder = v === 'flat' ? '1px solid var(--mute-2)' : '1px solid var(--line)';
  const radius = v === 'flat' ? 0 : 'var(--r-card)';
  return (
    <div className={wrapClass} style={{ borderRadius: radius, overflow: 'hidden', display: 'flex', flexDirection: 'column', ...wrapBg, ...style }}>
      <div style={{ height: HEAD_H, flexShrink: 0, padding: '0 16px', borderBottom: headBorder, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>{headLeft}</div>
        {headRight}
      </div>
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', ...bodyStyle }}>{children}</div>
    </div>
  );
}

function CardLabel({ children, color }) {
  return <span style={{ fontFamily: 'var(--mono)', fontSize: 9.5, letterSpacing: '0.18em', textTransform: 'uppercase', color: color || 'var(--mute)' }}>{children}</span>;
}

// ─── Contact card ──────────────────────────────────────────────────
function ContactCard({ detail, style }) {
  const c = detail.contact;
  const fields = [
    { label: 'First Name', val: c.firstName },
    { label: 'Phone',      val: c.phone },
    { label: 'Email',      val: c.email },
    { label: 'Source',     val: c.source },
    { label: 'Created',    val: c.created },
  ].filter(f => f.val);
  return (
    <Card headLeft={<CardLabel>Contact</CardLabel>} style={style} variant="flat">
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {detail.booking && (
          <div style={{ background: 'var(--warn-tint)', border: '1px solid rgba(196,138,47,0.32)', borderRadius: 'var(--r-surface)', padding: '11px 13px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 7 }}>
              <span style={{ color: 'var(--stage-booked)', display: 'flex' }}><IconCal size={13} /></span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 8.5, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--stage-booked)', fontWeight: 700 }}>Meeting booked</span>
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{detail.booking.day}, {detail.booking.mon} {detail.booking.d}, 2026</div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--ink-soft)', marginTop: 2 }}>{detail.booking.start} – {detail.booking.end} · {detail.booking.via}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 8.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--mute)' }}>Attendance</span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700, color: detail.booking.likelihood >= 70 ? 'var(--good)' : 'var(--warn)' }}>{detail.booking.likelihood}%</span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 8.5, color: 'var(--mute-2)' }}>{detail.booking.conf}</span>
            </div>
          </div>
        )}
        {fields.map(f => (
          <div key={f.label}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 8.5, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--mute-2)', marginBottom: 3 }}>{f.label}</div>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-soft)', wordBreak: 'break-word' }}>{f.val}</div>
          </div>
        ))}
        <div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 8.5, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--mute-2)', marginBottom: 5 }}>Campaign</div>
          <div style={{ background: 'var(--bg)', boxShadow: 'var(--sh-inset-crisp)', borderRadius: 'var(--r-button)', padding: '8px 11px', fontSize: 12, color: 'var(--ink-soft)' }}>{detail.campaign || '—'}</div>
        </div>
        <div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 8.5, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--mute-2)', marginBottom: 6 }}>Notes</div>
          <textarea className="neu-input" defaultValue={detail.note} placeholder="Add notes about this lead…" rows={4} style={{ width: '100%', resize: 'none', lineHeight: 1.55, fontSize: 12, padding: '9px 11px' }} />
        </div>
      </div>
    </Card>
  );
}

// ─── Chat message ──────────────────────────────────────────────────
function ChatMsg({ msg }) {
  if (msg.dir === 'div') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
        <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
        <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--mute-2)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>{msg.text}</span>
        <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
      </div>
    );
  }
  const isOut = msg.dir === 'out'; // outbound = our AI agent
  return (
    <div style={{ display: 'flex', justifyContent: isOut ? 'flex-end' : 'flex-start', marginBottom: 2 }}>
      <div style={{
        maxWidth: '80%',
        // AI agent (outbound): flat black balloon, cream text, no neumorphism.
        // Incoming (lead): carved-in neumorphic inset, crisp.
        background: isOut ? 'var(--ink)' : 'var(--bg)',
        boxShadow: isOut ? 'none' : 'var(--sh-inset-crisp)',
        borderRadius: isOut ? '13px 3px 13px 13px' : '3px 13px 13px 13px',
        padding: '9px 13px',
      }}>
        <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.55, color: isOut ? '#F0E7D5' : 'var(--ink-soft)', textWrap: 'pretty' }}>{msg.text}</p>
        <div style={{ marginTop: 3, textAlign: isOut ? 'right' : 'left', fontFamily: 'var(--mono)', fontSize: 8.5, color: isOut ? 'rgba(240,231,213,0.5)' : 'var(--mute-2)', letterSpacing: '0.06em' }}>{msg.time}</div>
      </div>
    </div>
  );
}

// ─── Chat card ─────────────────────────────────────────────────────
// withSummaryToggle: when the Summary panel is NOT shown separately (compact
// detail), the header gets a Chat/Summary toggle. When summary has its own
// column (wide detail), the chat shows only the wine balloon at the end.
function ChatCard({ detail, withSummaryToggle, style }) {
  const summary = detail.summary;
  const hasSummary = summary && summary.ready;
  const [view, setView] = React.useState('chat');
  const showToggle = withSummaryToggle && hasSummary;

  const head = showToggle ? (
    <div className="la-seg la-seg--pill">
      {[['chat', 'Chat'], ['summary', 'Summary']].map(([k, label]) => (
        <button key={k} onClick={() => setView(k)} className={`la-seg-btn${view === k ? ' on' : ''}`}>{label}</button>
      ))}
    </div>
  ) : <CardLabel>Chat</CardLabel>;

  return (
    <Card headLeft={head}
          headRight={<button className="la-btn la-btn--soft la-btn--icon" style={{ width: 26, height: 26 }}><IconBox size={12} /></button>}
          style={style} variant="inset">
      {showToggle && view === 'summary' ? (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <SummaryContent summary={summary} />
        </div>
      ) : (
        <>
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 3 }}>
            {detail.messages.map(m => <ChatMsg key={m.id} msg={m} />)}
            {hasSummary && <SummaryBalloon summary={summary} onOpen={() => showToggle ? setView('summary') : null} compact={!showToggle} />}
          </div>
          <div style={{ padding: '10px 14px', borderTop: '1px solid var(--line)', display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
            <div style={{ flex: 1, background: 'var(--bg)', boxShadow: 'var(--sh-inset-crisp)', borderRadius: 'var(--r-pill)', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 9 }}>
              <input style={{ flex: 1, minWidth: 0, border: 'none', background: 'transparent', outline: 'none', fontSize: 12, fontFamily: 'var(--sans)', color: 'var(--ink)' }} placeholder="Type a message…" />
              <span style={{ color: 'var(--mute-2)', display: 'flex', cursor: 'pointer' }}><IconAttach size={13} /></span>
            </div>
            <button className="la-btn la-btn--wine la-btn--pill" style={{ width: 36, height: 36, padding: 0, flexShrink: 0 }}><IconMic size={14} /></button>
          </div>
        </>
      )}
    </Card>
  );
}

// ─── Summary content (shared body) ─────────────────────────────────
function SummaryContent({ summary }) {
  const toneColor = { good: 'var(--good)', warn: 'var(--warn)', neutral: 'var(--mute)' };
  return (
    <div style={{ padding: '16px 16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', padding: '4px 10px', borderRadius: 'var(--r-pill)', color: 'var(--paper)', background: 'var(--wine-grad)' }}>{summary.outcome}</span>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', padding: '4px 10px', borderRadius: 'var(--r-pill)', color: 'var(--mute)', background: 'var(--bg)', boxShadow: 'var(--sh-inset-crisp)' }}>{summary.sentiment}</span>
      </div>
      <p className="serif" style={{ margin: 0, fontSize: 19, lineHeight: 1.4, color: 'var(--ink)', letterSpacing: '-0.01em', textWrap: 'pretty' }}>{summary.headline}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="eyebrow eyebrow-sm">Key points</div>
        {summary.points.map((p, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <span style={{ width: 7, height: 7, borderRadius: 2, marginTop: 6, flexShrink: 0, background: toneColor[p.tone] || 'var(--mute)' }} />
            <span style={{ fontSize: 12.5, lineHeight: 1.55, color: 'var(--ink-soft)', textWrap: 'pretty' }}>{p.text}</span>
          </div>
        ))}
      </div>
      <div style={{ background: 'var(--wine-tint)', borderRadius: 'var(--r-surface)', padding: '13px 15px', display: 'flex', gap: 11, alignItems: 'flex-start' }}>
        <span style={{ color: 'var(--wine)', display: 'flex', marginTop: 1, flexShrink: 0 }}><IconSpark size={15} /></span>
        <div>
          <div className="eyebrow eyebrow-sm wine" style={{ marginBottom: 4 }}>Recommended next step</div>
          <div style={{ fontSize: 12.5, lineHeight: 1.55, color: 'var(--ink-soft)' }}>{summary.nextStep}</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
        {summary.topics.map((tp, i) => (
          <span key={i} style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '4px 9px', borderRadius: 'var(--r-pill)', color: 'var(--mute)', border: '1px solid var(--line-strong)' }}>{tp}</span>
        ))}
      </div>
    </div>
  );
}

// ─── Summary card (own column / panel) ─────────────────────────────
function SummaryCard({ detail, clientView, style }) {
  const summary = detail.summary;
  return (
    <Card
      headLeft={<><span style={{ color: 'var(--wine)', display: 'flex' }}><IconSummary size={13} /></span><CardLabel color="var(--wine)">AI Summary</CardLabel></>}
      headRight={<span style={{ fontFamily: 'var(--mono)', fontSize: 8.5, color: 'var(--mute-2)', letterSpacing: '0.08em' }}>finished {summary.finishedAgo}</span>}
      style={style} variant="inset">
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {clientView && (
          <div style={{ padding: '12px 16px 0', fontFamily: 'var(--mono)', fontSize: 8.5, color: 'var(--mute-2)', letterSpacing: '0.08em' }}>
            This is the only thing your client sees — the AI summary of the finished interaction.
          </div>
        )}
        <SummaryContent summary={summary} />
      </div>
    </Card>
  );
}

// ─── Wine summary balloon (pins at the end of a finished chat) ─────
function SummaryBalloon({ summary, onOpen, compact }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '14px 0 6px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', margin: '4px 0 12px' }}>
        <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
        <span style={{ fontFamily: 'var(--mono)', fontSize: 8.5, color: 'var(--mute-2)', letterSpacing: '0.16em', textTransform: 'uppercase' }}>Interaction finished</span>
        <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
      </div>
      <div style={{ width: '94%', background: 'var(--wine-grad)', borderRadius: 'var(--r-card)', boxShadow: 'var(--sh-raised-medium), inset 0 1px 0 rgba(255,255,255,0.12)', padding: '15px 17px', color: 'var(--paper)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 9 }}>
          <span style={{ width: 24, height: 24, borderRadius: 'var(--r-button)', flexShrink: 0, background: 'rgba(255,255,255,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--paper)' }}><IconSpark size={13} /></span>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.82)' }}>AI Summary</span>
        </div>
        <p className="serif" style={{ margin: 0, fontSize: 15.5, lineHeight: 1.45, color: 'var(--paper)', textWrap: 'pretty' }}>{summary.headline}</p>
        {compact && (
          <button onClick={onOpen} style={{ marginTop: 12, border: 'none', cursor: 'pointer', background: 'rgba(255,255,255,0.16)', color: 'var(--paper)', padding: '7px 14px', borderRadius: 'var(--r-pill)', fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', display: 'inline-flex', alignItems: 'center', gap: 7 }}>View full summary <IconChev size={11} /></button>
        )}
      </div>
    </div>
  );
}

// ─── Score card (single big number — no duplicate) ─────────────────
function ScoreCard({ detail, style }) {
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
    <Card headLeft={<CardLabel>Lead Score</CardLabel>}
          headRight={<span style={{ fontFamily: 'var(--mono)', fontSize: 8.5, color: 'var(--mute-2)' }}>just now</span>}
          style={style}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        {/* Score hero — one number only */}
        <div>
          <TempBadge temp={temp} />
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 6 }}>
            <span style={{ fontFamily: 'var(--serif)', fontSize: 64, lineHeight: 1, color: 'var(--ink)', letterSpacing: '-0.02em' }}>{score}</span>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--mute-2)' }}>/100</span>
          </div>
          <div style={{ height: 6, background: 'var(--bg)', boxShadow: 'var(--sh-inset-crisp)', borderRadius: 'var(--r-pill)', overflow: 'hidden', marginTop: 12 }}>
            <div style={{ width: `${score}%`, height: '100%', background: scoreColor, borderRadius: 'var(--r-pill)', transition: 'width 500ms' }} />
          </div>
        </div>

        {/* Sparkline */}
        <div>
          <div className="eyebrow eyebrow-sm" style={{ marginBottom: 8 }}>Score trend · 5 weeks</div>
          <div style={{ background: 'var(--bg)', boxShadow: 'var(--sh-inset-crisp)', borderRadius: 'var(--r-button)', padding: '10px 12px' }}>
            <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" width="100%" height={h} style={{ display: 'block' }}>
              {[25, 50, 75].map(y => <line key={y} x1="0" y1={y * h / 100} x2={w} y2={y * h / 100} stroke="var(--line)" strokeWidth="0.3" vectorEffect="non-scaling-stroke" />)}
              <polyline points={pts} fill="none" stroke="var(--warn)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
              <circle cx={lastX} cy={lastY} r="3" fill="var(--warn)" vectorEffect="non-scaling-stroke" />
            </svg>
          </div>
        </div>

        {/* Sub-scores */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
          {scoreBreakdown.map(s => (
            <div key={s.label}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink-soft)' }}>{s.label}</span>
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
    </Card>
  );
}

// ─── Detail hero (rounded, detached) ───────────────────────────────
function LeadHero({ detail, clientView, onToggleClient, compact }) {
  const { pipeline } = window.LEADS_DATA;
  return (
    <div className="neu-raised" style={{ borderRadius: 'var(--r-card)', background: 'var(--card)', overflow: 'hidden', flexShrink: 0 }}>
      <div style={{ padding: compact ? '14px 16px' : '16px 20px', display: 'flex', alignItems: 'center', gap: compact ? 12 : 16 }}>
        <StageAvatar lead={detail} size={compact ? 42 : 50} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 5, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'var(--serif)', fontSize: compact ? 22 : 27, color: 'var(--ink)', lineHeight: 1, letterSpacing: '-0.01em' }}>{detail.name}</span>
            <TempBadge temp={detail.temp} />
            <span style={{ fontFamily: 'var(--mono)', fontSize: 8.5, color: 'var(--mute-2)', letterSpacing: '0.1em', textTransform: 'uppercase', border: '1px solid var(--line-strong)', borderRadius: 4, padding: '2px 6px' }}>Lead {detail.id}</span>
            {detail.booking && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: 'var(--warn-tint)', border: '1px solid rgba(196,138,47,0.4)',
                borderRadius: 'var(--r-pill)', padding: '3px 10px 3px 8px',
                color: 'var(--stage-booked)', fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 700,
              }}>
                <IconCal size={11} />Booked · {detail.booking.day} {detail.booking.mon} {detail.booking.d} · {detail.booking.start}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 12, fontFamily: 'var(--mono)', fontSize: 9.5, color: 'var(--mute)', letterSpacing: '0.1em', textTransform: 'uppercase', flexWrap: 'wrap' }}>
            <span>Activity {detail.lastActivity}</span>
            <span style={{ color: 'var(--line-strong)' }}>·</span>
            <span>{detail.campaign || 'No campaign'}</span>
            {!compact && <><span style={{ color: 'var(--line-strong)' }}>·</span><span>{detail.account}</span></>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 7, flexShrink: 0, alignItems: 'center' }}>
          <button onClick={onToggleClient} title="Preview what your client sees" style={{
            padding: '8px 13px', borderRadius: 'var(--r-button)', cursor: 'pointer',
            border: clientView ? 'none' : '1px solid var(--line-strong)',
            background: clientView ? 'var(--wine-grad)' : 'transparent',
            boxShadow: clientView ? 'var(--sh-raised-crisp)' : 'none',
            color: clientView ? 'var(--paper)' : 'var(--mute)',
            fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase',
            display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
          }}><IconEye size={12} />{clientView ? 'Client view: on' : 'Client view'}</button>
          {!compact && (
            <button className="la-btn la-btn--wine">{detail.booking ? <><IconCal size={12} />View booking</> : <><IconPhone size={12} />Book call</>}</button>
          )}
          <button className="la-btn la-btn--soft la-btn--icon" style={{ width: 34, height: 34 }}><IconMore size={14} /></button>
        </div>
      </div>
      <div style={{ padding: compact ? '0 16px 14px' : '0 20px 16px' }}>
        <PipelineBar stages={pipeline} stageIdx={detail.stageIdx} />
      </div>
    </div>
  );
}

// ─── Lead detail — assembles hero + cards (wide row / compact stack) ─
function LeadDetail({ detail, clientView, onToggleClient }) {
  // Choose layout from the detail panel's OWN width (not the active view), so
  // table / pipeline get the rich wide layout on big monitors, and every view
  // falls back to the stacked layout when the panel gets tight.
  const ref = React.useRef(null);
  const [dw, setDw] = React.useState(1000);
  React.useEffect(() => {
    if (!ref.current || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setDw(e.contentRect.width);
    });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  const wide = dw >= 780;
  const splitSummary = dw >= 1180; // room for chat + summary as their own columns

  return (
    <div ref={ref} style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {wide ? (
        <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 14, padding: 14, overflow: 'hidden' }}>
          <LeadHero detail={detail} clientView={clientView} onToggleClient={onToggleClient} />
          <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 14 }}>
            <ContactCard detail={detail} style={{ width: 200, flexShrink: 0 }} />
            {clientView ? (
              <SummaryCard detail={detail} clientView style={{ flex: 1, minWidth: 230 }} />
            ) : splitSummary ? (
              <>
                <ChatCard detail={detail} withSummaryToggle={false} style={{ flex: 1.2, minWidth: 230 }} />
                <SummaryCard detail={detail} style={{ flex: 1, minWidth: 230 }} />
              </>
            ) : (
              <ChatCard detail={detail} withSummaryToggle style={{ flex: 1, minWidth: 260 }} />
            )}
            <ScoreCard detail={detail} style={{ width: 228, flexShrink: 0 }} />
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 12, padding: 12, overflowY: 'auto' }}>
          <LeadHero detail={detail} clientView={clientView} onToggleClient={onToggleClient} compact />
          <ContactCard detail={detail} style={{ flexShrink: 0, maxHeight: 280 }} />
          {clientView
            ? <SummaryCard detail={detail} clientView style={{ flexShrink: 0 }} />
            : <ChatCard detail={detail} withSummaryToggle style={{ flexShrink: 0, height: 440 }} />}
          <ScoreCard detail={detail} style={{ flexShrink: 0 }} />
        </div>
      )}
    </div>
  );
}

Object.assign(window, {
  IconPlus, IconMic, IconAttach, IconX, IconEye, IconSummary, IconListV, IconTableV, IconKanbanV,
  IconChatPeek, IconCal,
  HEAD_H, stageOf, StageAvatar, TempBadge, ScoreArc, PipelineBar, LastMsgPeek,
  Card, CardLabel,
  ContactCard, ChatCard, ChatMsg, SummaryContent, SummaryCard, SummaryBalloon, ScoreCard,
  LeadHero, LeadDetail,
});
