// reputation-components.jsx — shared primitives + Reviews two-pane
// Depends on: components.jsx (Icon + icon set + Sidebar on window), reputation-data.js
// All declarations are uniquely named (Rep* / RIcon*) to avoid global collisions.

// ─── Local icons (R-prefixed to avoid clashing with components.jsx) ──
const RIconExt    = (p) => <Icon {...p} d={<><path d="M14 5h5v5"/><path d="M19 5l-8 8"/><path d="M18 14v4a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h4"/></>} />;
const RIconRefresh= (p) => <Icon {...p} d={<><path d="M21 12a9 9 0 1 1-2.6-6.4"/><path d="M21 4v5h-5"/></>} />;
const RIconFlag   = (p) => <Icon {...p} d={<><path d="M5 21V4"/><path d="M5 5h12l-2 3 2 3H5"/></>} />;
const RIconStarF  = (p) => <Icon {...p} fill="currentColor" strokeWidth={0} d={<path d="M12 2.6l2.9 5.9 6.5 1-4.7 4.6 1.1 6.5L12 21.5 6.2 20.6l1.1-6.5L2.6 9.5l6.5-1z"/>} />;
const RIconEdit   = (p) => <Icon {...p} d={<><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></>} />;
const RIconSend   = (p) => <Icon {...p} d={<><path d="M22 2 11 13"/><path d="M22 2l-7 20-4-9-9-4z"/></>} />;
const RIconNote   = (p) => <Icon {...p} d={<><path d="M4 4h16v12H8l-4 4z"/><path d="M8 9h8M8 12h5"/></>} />;
const RIconWA     = (p) => <Icon {...p} d={<><path d="M20 12a8 8 0 1 1-3.5-6.6L20 4l-1.4 3.4A8 8 0 0 1 20 12z"/><path d="M8.5 9.5c.5 2 1.5 3.5 3 4.5l1.5-1 2 1.5c-1 1.5-3 1.5-4.5.5s-3-2.5-3.5-4.5z"/></>} />;
const RIconSms    = (p) => <Icon {...p} d={<><path d="M4 5h16v11H8l-4 4z"/><path d="M9 10h.01M13 10h.01"/></>} />;
const RIconArrow  = (p) => <Icon {...p} d={<path d="M5 12h14M13 6l6 6-6 6"/>} />;
const RIconClock  = (p) => <Icon {...p} d={<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>} />;
// ─── Tone icons for composer rewrite-style seg ───────────────────
const TIconApologetic   = (p) => <Icon {...p} d={<path d="M12 21c-4-3-8-6.5-8-11a5 5 0 0 1 8-4 5 5 0 0 1 8 4c0 4.5-4 8-8 11z"/>} />;
const TIconGrateful     = (p) => <Icon {...p} d={<><path d="M12 2l2.4 4.9 5.4.8-3.9 3.8.9 5.3L12 14.3 6.2 16.8l.9-5.3L3.2 7.7l5.4-.8z"/></>} />;
const TIconProfessional = (p) => <Icon {...p} d={<><path d="M4 7h16a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></>} />;
const TIconConcise      = (p) => <Icon {...p} d={<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>} />;

// ─── Rating → sentiment color ────────────────────────────────────
function repRatingColor(rating) {
  if (rating <= 2) return 'var(--wine)';   // calm brand emphasis, not panic-red
  if (rating === 3) return 'var(--warn)';
  return 'var(--good)';
}

// ─── Automation rule: does this review's reply post hands-free? ───
// The single source of truth for the auto-mode ripple. A reply auto-posts only
// when the threshold is set, the rating clears it, negatives aren't being held,
// and the AI is confident enough. Everything else routes to the queue.
function repAutoPosts(r, auto) {
  if (!auto || auto.threshold === 'never' || auto.threshold == null) return false;
  if ((r.rating || 0) < auto.threshold) return false;
  if (auto.holdNegative && r.rating <= 3) return false;
  if (auto.confidenceHold && r.confidence != null && r.confidence < auto.confidenceMin) return false;
  return true;
}
function repDelayLabel(d) { return d === '15m' ? '15 min' : d === '2h' ? '2 hours' : '1 hour'; }

// ─── Stars ────────────────────────────────────────────────────────
function RepStars({ rating, size = 14, gap = 2 }) {
  const color = repRatingColor(rating);
  return (
    <span style={{ display: 'inline-flex', gap, alignItems: 'center' }} aria-label={`${rating} of 5 stars`}>
      {[1, 2, 3, 4, 5].map(i => (
        <span key={i} style={{ display: 'flex', color: i <= rating ? color : 'var(--line-strong)' }}>
          <RIconStarF size={size} />
        </span>
      ))}
    </span>
  );
}

// ─── Platform glyph (Google now; extensible) ─────────────────────
function RepPlatformGlyph({ platform = 'google', size = 16, withLabel = false }) {
  // Simple monogram tile — no external brand asset.
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span style={{
        width: size, height: size, borderRadius: 'var(--r-flush)', flexShrink: 0,
        background: 'var(--surface)', boxShadow: 'var(--sh-raised-crisp)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--mono)', fontWeight: 700, fontSize: size * 0.62, color: 'var(--wine)',
      }}>G</span>
      {withLabel && <span style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.1em', color: 'var(--mute)', textTransform: 'uppercase' }}>Google</span>}
    </span>
  );
}

// ─── Reviewer avatar (square, tinted by sentiment) ───────────────
function RepAvatar({ ini, rating, size = 38, radius }) {
  const color = repRatingColor(rating);
  return (
    <div style={{
      width: size, height: size, borderRadius: radius != null ? radius : Math.round(size * 0.28),
      flexShrink: 0, background: color,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff', fontFamily: 'var(--mono)', fontWeight: 600,
      fontSize: Math.round(size * 0.34), letterSpacing: '0.01em',
      boxShadow: 'var(--sh-raised-crisp)',
    }}>{ini}</div>
  );
}

// ─── Review status pill ──────────────────────────────────────────
function RepStatusPill({ status, small }) {
  const map = {
    needs:   { label: 'Needs reply', fg: 'var(--wine)',  bg: 'var(--wine-tint)' },
    drafted: { label: 'Drafted',     fg: 'var(--warn)',  bg: 'var(--warn-tint)' },
    replied: { label: 'Replied',     fg: 'var(--good)',  bg: 'var(--good-tint)' },
    ignored: { label: 'Ignored',     fg: 'var(--mute-2)',bg: 'var(--bg)' },
  };
  const c = map[status] || map.needs;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      fontFamily: 'var(--mono)', fontSize: small ? 8 : 9, fontWeight: 700,
      letterSpacing: '0.12em', textTransform: 'uppercase',
      padding: small ? '2px 7px' : '3px 9px', borderRadius: 'var(--r-pill)',
      color: c.fg, background: c.bg,
      boxShadow: status === 'ignored' ? 'var(--sh-inset-crisp)' : 'none',
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: c.fg }} />{c.label}
    </span>
  );
}

// ─── Shared channel / sender status pill ─────────────────────────
// SMS ready (emerald) · WhatsApp pending Meta review (amber) · approved (emerald) · rejected (wine)
function RepChannelPill({ channel, state }) {
  const map = {
    ready:    { label: 'ready',                fg: 'var(--good)' },
    approved: { label: 'approved',             fg: 'var(--good)' },
    pending:  { label: 'pending Meta review',  fg: 'var(--warn)' },
    rejected: { label: 'rejected',             fg: 'var(--wine)' },
  };
  const c = map[state] || map.pending;
  const Ic = channel.toLowerCase().includes('whats') ? RIconWA : RIconSms;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 7,
      fontFamily: 'var(--mono)', fontSize: 9.5, fontWeight: 600,
      letterSpacing: '0.08em', textTransform: 'uppercase',
      padding: '5px 11px', borderRadius: 'var(--r-pill)',
      background: 'var(--bg)', boxShadow: 'var(--sh-inset-crisp)', color: 'var(--mute)',
    }}>
      <span style={{ display: 'flex', color: c.fg }}><Ic size={13} /></span>
      <span style={{ color: 'var(--ink-soft)' }}>{channel}</span>
      <span style={{ width: 4, height: 4, borderRadius: '50%', background: c.fg }} />
      <span style={{ color: c.fg }}>{c.label}</span>
    </span>
  );
}

// ─── Rating summary chip ─────────────────────────────────────────
function RepSummaryChip({ avg, count }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 8,
      padding: '6px 12px', borderRadius: 'var(--r-pill)',
      background: 'var(--bg)', boxShadow: 'var(--sh-inset-crisp)',
    }}>
      <span style={{ display: 'flex', color: 'var(--good)' }}><RIconStarF size={13} /></span>
      <span style={{ fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 700, color: 'var(--ink)' }}>{avg}</span>
      <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--mute-2)' }} />
      <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--mute)', letterSpacing: '0.04em' }}>{count} reviews</span>
    </span>
  );
}

// ─── Language badge ──────────────────────────────────────────────
function RepLangBadge({ lang }) {
  return (
    <span style={{
      fontFamily: 'var(--mono)', fontSize: 8, fontWeight: 700, letterSpacing: '0.14em',
      textTransform: 'uppercase', color: 'var(--mute)',
      border: '1px solid var(--line-strong)', borderRadius: 4, padding: '1px 5px',
    }}>{lang}</span>
  );
}

// ─── Generic header card (local, self-contained) ─────────────────
function RepCard({ headLeft, headRight, children, style, bodyStyle, variant = 'raised' }) {
  const wrapClass = variant === 'raised' ? 'neu-raised' : '';
  const wrapBg = variant === 'raised' ? { background: 'var(--card)' }
    : variant === 'inset' ? { background: 'var(--bg)', boxShadow: 'var(--sh-inset-crisp), inset 0 0 0 1px rgba(0,0,0,0.06)' }
    : { background: 'transparent' };
  return (
    <div className={wrapClass} style={{ borderRadius: 'var(--r-card)', overflow: 'hidden', display: 'flex', flexDirection: 'column', ...wrapBg, ...style }}>
      {(headLeft || headRight) && (
        <div style={{ height: 50, flexShrink: 0, padding: '0 16px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>{headLeft}</div>
          {headRight}
        </div>
      )}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', ...bodyStyle }}>{children}</div>
    </div>
  );
}
function RepLabel({ children, color }) {
  return <span style={{ fontFamily: 'var(--mono)', fontSize: 9.5, letterSpacing: '0.18em', textTransform: 'uppercase', color: color || 'var(--mute)' }}>{children}</span>;
}

// ═══ Left list card ════════════════════════════════════════════════
function RepListCard({ review, active, onClick, autoPosted }) {
  return (
    <div onClick={onClick} style={{
      borderRadius: 'var(--r-surface)', position: 'relative', cursor: 'pointer',
      background: active ? 'var(--card)' : 'transparent',
      boxShadow: active ? 'var(--sh-raised-medium), inset 0 0 0 1px var(--line-strong)' : 'none',
      transform: active ? 'translateX(2px)' : 'none',
      transition: 'all 130ms',
    }}
    onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'var(--wine-tint)'; }}
    onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}>
      {active && <div style={{ position: 'absolute', left: 0, top: 6, bottom: 6, width: 3, background: 'var(--wine)', borderRadius: '0 3px 3px 0' }} />}
      <div style={{ padding: '8px 12px', display: 'flex', gap: 10 }}>
        <RepAvatar ini={review.ini} rating={review.rating} size={36} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 3 }}>
            <span style={{ fontFamily: 'var(--serif)', fontSize: 16, color: 'var(--ink)', fontWeight: active ? 600 : 400, lineHeight: 1.1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{review.name}</span>
            <RepStars rating={review.rating} size={11} />
          </div>
          <p style={{ margin: '0 0 5px', fontSize: 12, lineHeight: 1.5, color: 'var(--mute)', textWrap: 'pretty', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{review.text}</p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontFamily: 'var(--mono)', fontSize: 9.5, color: 'var(--mute-2)', letterSpacing: '0.06em' }}>
              <RepPlatformGlyph size={13} /> · {review.ago}
            </span>
            {autoPosted
              ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'var(--mono)', fontSize: 8, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', padding: '2px 7px', borderRadius: 'var(--r-pill)', color: 'var(--wine)', background: 'var(--wine-tint)' }}><IconSpark size={9} />Auto-posted</span>
              : <RepStatusPill status={review.status} small={!active} />}
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══ AI Composer — the centerpiece ═════════════════════════════════
function RepComposer({ review }) {
  const TONES = window.REP_DATA.tones;
  const [tone, setTone] = React.useState(review.tone || 'apologetic');
  const [text, setText] = React.useState(review.draft || '');
  const [thinking, setThinking] = React.useState(false);
  const [focused, setFocused] = React.useState(false);

  // Re-seed when switching reviews
  React.useEffect(() => { setText(review.draft || ''); setTone(review.tone || 'apologetic'); setThinking(false); }, [review.id]);

  const regenerate = (nextTone) => {
    setThinking(true);
    setText('');
    setTimeout(() => { setText(review.draft || ''); setThinking(false); }, 1100);
  };

  const len = text.length;
  const lenHint = len < 180 ? 'Good length' : len < 320 ? 'A touch long' : 'Consider trimming';

  return (
    <div className="neu-raised" style={{ borderRadius: 'var(--r-card)', background: 'var(--card)', overflow: 'hidden', flexShrink: 0 }}>
      {/* eyebrow header */}
      <div style={{ padding: '13px 16px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, background: 'var(--wine-tint)' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}>
          <span style={{ width: 22, height: 22, borderRadius: 'var(--r-button)', background: 'var(--wine-grad)', boxShadow: 'var(--sh-raised-crisp)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--paper)' }}><IconSpark size={12} /></span>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 9.5, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--wine)' }}>AI-drafted reply — review before posting</span>
        </span>
        <RepLangBadge lang={review.lang} />
      </div>

      {/* editable well — styled as a real editor */}
      <div style={{ padding: 16 }}>
        <div style={{
          position: 'relative', borderRadius: 'var(--r-surface)', overflow: 'hidden',
          background: 'var(--card)',
          border: `1.5px solid ${focused ? 'var(--wine)' : 'var(--line-strong)'}`,
          boxShadow: focused ? '0 0 0 3px var(--wine-tint)' : 'var(--sh-inset-crisp)',
          transition: 'border-color 130ms, box-shadow 130ms',
        }}>
          {!thinking && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '8px 13px', borderBottom: '1px solid var(--line)', background: 'var(--surface)' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontFamily: 'var(--mono)', fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--mute)' }}><RIconEdit size={11} />Editable draft</span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 9.5, fontWeight: 700, letterSpacing: '0.04em', color: len < 320 ? 'var(--mute-2)' : 'var(--warn)' }}>{len} / 320</span>
            </div>
          )}
          {thinking ? (
            <div style={{ padding: '16px 15px' }}>
              <div className="rep-shimmer" style={{ height: 12, borderRadius: 'var(--r-pill)', marginBottom: 9, width: '96%' }} />
              <div className="rep-shimmer" style={{ height: 12, borderRadius: 'var(--r-pill)', marginBottom: 9, width: '88%' }} />
              <div className="rep-shimmer" style={{ height: 12, borderRadius: 'var(--r-pill)', width: '70%' }} />
              <div style={{ marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--wine)' }}>
                <span className="rep-dots"><i></i><i></i><i></i></span> Drafting in {review.lang === 'nl' ? 'Dutch' : 'English'}…
              </div>
            </div>
          ) : (
            <textarea value={text} onChange={(e) => setText(e.target.value)} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} rows={5}
              style={{ width: '100%', display: 'block', border: 'none', background: 'transparent', outline: 'none', resize: 'none', fontFamily: 'var(--sans)', fontSize: 13.5, lineHeight: 1.6, color: 'var(--ink-soft)', padding: '13px 15px' }} />
          )}
        </div>

        {/* rewrite-style controls — the product's core lever, surfaced */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--wine)' }}>Rewrite style</span>
          <div className="la-seg">
            {TONES.map(t => {
              const TIc = { apologetic: TIconApologetic, grateful: TIconGrateful, professional: TIconProfessional, concise: TIconConcise }[t.key];
              return (
                <button key={t.key} onClick={() => { setTone(t.key); regenerate(t.key); }} className={`la-seg-btn${tone === t.key ? ' on' : ''}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  {TIc && <TIc size={11} />}{t.label}
                </button>
              );
            })}
          </div>
          <button onClick={() => regenerate(tone)} className="la-btn la-btn--soft" style={{ marginLeft: 'auto' }}><RIconRefresh size={13} />Regenerate</button>
        </div>
        <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.06em', color: 'var(--mute-2)' }}>
          <RepPlatformGlyph size={12} /> Posts publicly to Google as the business · {lenHint}
        </div>
      </div>
    </div>
  );
}

// ═══ Status timeline (compact vertical) ════════════════════════════
function RepTimeline({ timeline }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {timeline.map((step, i) => {
        const last = i === timeline.length - 1;
        const color = step.done ? 'var(--good)' : 'var(--mute-2)';
        return (
          <div key={step.key} style={{ display: 'flex', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ width: 11, height: 11, borderRadius: '50%', flexShrink: 0, marginTop: 2,
                background: step.done ? color : 'transparent',
                border: step.done ? 'none' : '2px solid var(--line-strong)',
                boxShadow: step.done ? '0 0 0 3px var(--good-tint)' : 'none' }} />
              {!last && <span style={{ width: 2, flex: 1, minHeight: 18, background: step.done ? 'var(--good)' : 'var(--line)', margin: '2px 0' }} />}
            </div>
            <div style={{ paddingBottom: last ? 0 : 12 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: step.done ? 'var(--ink)' : 'var(--mute-2)' }}>{step.label}</div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--mute-2)', letterSpacing: '0.06em', marginTop: 2 }}>
                {step.done ? `${step.who && step.who !== 'auto' ? step.who + ' · ' : step.who === 'auto' ? 'automatic · ' : ''}${step.ago} ago` : 'pending'}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ═══ Right detail pane ═════════════════════════════════════════════
// ═══ AI analysis — the sentiment read that justifies the draft ════
function RepAIAnalysis({ review }) {
  const a = review.analysis || {};
  const r = review.rating || 0;
  const positive = r >= 4;
  const sentiment = r <= 1 ? 'Very negative' : r === 2 ? 'Negative' : r === 3 ? 'Mixed' : r === 4 ? 'Positive' : 'Very positive';
  const sColor = repRatingColor(r);
  const sTint = r <= 2 ? 'var(--wine-tint)' : r === 3 ? 'var(--warn-tint)' : 'var(--good-tint)';
  const risk = r <= 1 ? 'High' : r === 2 ? 'Medium' : r === 3 ? 'Low' : 'None';
  const riskColor = r <= 1 ? 'var(--wine)' : r === 2 ? 'var(--warn)' : r === 3 ? 'var(--mute)' : 'var(--good)';
  const conf = review.confidence != null ? review.confidence : 85;
  const issues = a.issues || [];
  const reco = a.reco || (review.tone ? review.tone[0].toUpperCase() + review.tone.slice(1) : 'Professional');
  const Lbl = ({ children }) => (
    <span style={{ fontFamily: 'var(--mono)', fontSize: 8, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--mute-2)' }}>{children}</span>
  );
  return (
    <div style={{
      width: 230, flexShrink: 0, alignSelf: 'flex-start',
      background: 'var(--surface)', borderRadius: 'var(--r-surface)',
      boxShadow: 'var(--sh-inset-crisp)', padding: '14px 15px',
      display: 'flex', flexDirection: 'column', gap: 14,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 20, height: 20, borderRadius: 'var(--r-button)', background: 'var(--wine-grad)', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--paper)' }}><IconSpark size={11} /></span>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 9, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--ink-soft)' }}>AI analysis</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <Lbl>Sentiment</Lbl>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '4px 10px', borderRadius: 'var(--r-pill)', background: sTint, alignSelf: 'flex-start' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: sColor, flexShrink: 0 }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: sColor }}>{sentiment}</span>
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <Lbl>Confidence</Lbl>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{ flex: 1, height: 5, borderRadius: 'var(--r-pill)', background: 'var(--line)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${conf}%`, borderRadius: 'var(--r-pill)',
              background: conf >= 75 ? 'var(--good)' : conf >= 50 ? 'var(--warn)' : 'var(--wine)',
              transition: 'width 500ms ease' }} />
          </div>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 700, flexShrink: 0,
            color: conf >= 75 ? 'var(--good)' : conf >= 50 ? 'var(--warn)' : 'var(--wine)' }}>{conf}%</span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <Lbl>Risk level</Lbl>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: riskColor }}>{risk}</span>
      </div>

      {issues.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Lbl>{positive ? 'Themes' : 'Issues'}</Lbl>
          <ul style={{ margin: 0, padding: '0 0 0 15px', display: 'flex', flexDirection: 'column', gap: 5 }}>
            {issues.map((it, i) => (
              <li key={i} style={{ fontSize: 12, color: 'var(--ink-soft)', lineHeight: 1.45 }}>{it}</li>
            ))}
          </ul>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <Lbl>Recommended</Lbl>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 'var(--r-pill)',
          background: 'var(--wine-tint)', color: 'var(--wine)', fontSize: 12, fontWeight: 700, alignSelf: 'flex-start' }}>
          <IconSpark size={10} />{reco}
        </span>
      </div>
    </div>
  );
}

function RepReviewDetail({ review, autoPosted = false, autoDelay = '1h', onUndo, onEditRepost }) {
  if (!review) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, color: 'var(--mute-2)' }}>
        <RIconStarF size={28} />
        <span style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase' }}>Select a review</span>
      </div>
    );
  }
  const replied = review.status === 'replied';
  const neg = review.rating <= 2;
  const displayTimeline = autoPosted
    ? review.timeline.map(s => s.key === 'posted' ? { ...s, done: true, who: 'auto', ago: repDelayLabel(autoDelay) } : s)
    : review.timeline;

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* header */}
      <div style={{ flexShrink: 0, padding: '18px 22px 16px', borderBottom: '1px solid var(--line)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
          <RepAvatar ini={review.ini} rating={review.rating} size={46} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 7 }}>
              <span className="neu-raised" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, background: 'var(--card)', borderRadius: 'var(--r-surface)', padding: '7px 14px' }}>
                <span style={{ fontFamily: 'var(--serif)', fontSize: 24, color: 'var(--ink)', lineHeight: 1, whiteSpace: 'nowrap' }}>{review.name}</span>
                <RepStars rating={review.rating} size={14} />
              </span>
              <RepStatusPill status={review.status} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', fontFamily: 'var(--mono)', fontSize: 9.5, color: 'var(--mute)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              <RepPlatformGlyph size={13} withLabel />
              <span style={{ color: 'var(--line-strong)' }}>·</span>
              <span>{review.date}</span>
              <span style={{ color: 'var(--line-strong)' }}>·</span>
              <span>{review.job}</span>
            </div>
          </div>
          <a href="#" onClick={(e) => e.preventDefault()} className="la-btn la-btn--soft" style={{ flexShrink: 0 }}><RIconExt size={13} />View on Google</a>
        </div>
      </div>

      {/* scroll body */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 22, display: 'flex', flexDirection: 'column', gap: 18 }}>
        {/* quoted review */}
        <div className="neu-raised" style={{ borderRadius: 'var(--r-surface)', background: 'var(--card)', padding: '18px 20px', position: 'relative' }}>
          <span style={{ position: 'absolute', top: 8, left: 14, fontFamily: 'var(--serif)', fontSize: 48, lineHeight: 1, color: 'var(--line-strong)' }}>“</span>
          <p style={{ margin: 0, paddingLeft: 22, fontFamily: 'var(--serif)', fontSize: 19, lineHeight: 1.5, color: 'var(--ink-soft)', letterSpacing: '-0.01em', textWrap: 'pretty' }}>{review.text}</p>
        </div>

        {replied ? (
          <RepCard variant="raised" style={{ borderRadius: 'var(--r-surface)' }} headLeft={<><span style={{ display: 'flex', color: 'var(--good)' }}><IconCheck size={14} /></span><RepLabel color="var(--good)">Posted reply</RepLabel></>}>
            <div style={{ padding: '16px 18px' }}>
              <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: 'var(--ink-soft)', textWrap: 'pretty' }}>{review.reply.text}</p>
              <div style={{ marginTop: 12, fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.08em', color: 'var(--mute-2)', textTransform: 'uppercase' }}>Posted by {review.reply.by} · {review.reply.ago} ago</div>
            </div>
          </RepCard>
        ) : autoPosted ? (
          <>
            <div style={{ display: 'inline-flex', alignSelf: 'flex-start', alignItems: 'center', gap: 9, background: 'var(--wine-tint)', borderRadius: 'var(--r-pill)', padding: '6px 13px' }}>
              <span style={{ display: 'flex', color: 'var(--wine)' }}><IconSpark size={13} /></span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--wine)' }}>Auto-posted by AI · {repDelayLabel(autoDelay)} after the review</span>
            </div>
            <RepCard variant="raised" style={{ borderRadius: 'var(--r-surface)' }} headLeft={<><span style={{ display: 'flex', color: 'var(--wine)' }}><IconSpark size={14} /></span><RepLabel color="var(--wine)">Auto-posted reply</RepLabel></>}
                     headRight={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'var(--mono)', fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--good)' }}><span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--good)' }} />{review.confidence}% confident</span>}>
              <div style={{ padding: '16px 18px' }}>
                <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: 'var(--ink-soft)', textWrap: 'pretty' }}>{review.draft}</p>
                <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.06em', color: 'var(--mute-2)' }}>
                  <RepPlatformGlyph size={12} /> Live on Google · posted automatically
                </div>
              </div>
            </RepCard>
          </>
        ) : (
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            {review.analysis && <RepAIAnalysis review={review} />}
            <div style={{ flex: 1, minWidth: 0 }}><RepComposer review={review} /></div>
          </div>
        )}



      </div>

      {/* ── 3-panel bottom: Internal note · Actions · Status ── */}
      <div style={{ flexShrink: 0, borderTop: '1px solid var(--line)', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', background: 'var(--card)', minHeight: 168 }}>
        {/* Internal note */}
        <div style={{ padding: '13px 18px', borderRight: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 8, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--mute-2)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <RIconNote size={12} />Internal note
          </span>
          <textarea className="neu-input" rows={4} placeholder="Private note — not posted publicly…"
            style={{ flex: 1, resize: 'none', fontSize: 12, lineHeight: 1.5, padding: '8px 11px', background: 'var(--bg)', width: '100%' }} />
        </div>
        {/* Actions */}
        <div style={{ padding: '13px 18px', borderRight: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: 7 }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 8, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--mute-2)' }}>Actions</span>
          {autoPosted ? (<>
            <button onClick={onEditRepost} className="la-btn la-btn--wine" style={{ width: '100%', justifyContent: 'center' }}><RIconEdit size={13} />Edit &amp; repost</button>
            <button onClick={onUndo} className="la-btn la-btn--soft" style={{ width: '100%', justifyContent: 'center' }}><RIconRefresh size={13} />Undo post</button>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--mute)', marginTop: 4 }}>Posted hands-free — no action needed</span>
          </>) : !replied ? (<>
            <button className="la-btn la-btn--wine" style={{ width: '100%', justifyContent: 'center' }}><RIconSend size={13} />Post reply</button>
            <button className="la-btn la-btn--inset" style={{ width: '100%', justifyContent: 'center' }}>Save draft</button>
            {neg && <button className="la-btn" style={{ color: 'var(--wine)', background: 'transparent', boxShadow: 'none', marginTop: 2 }}><RIconFlag size={12} />Escalate to manager</button>}
            <button className="la-btn" style={{ color: 'var(--mute)', background: 'transparent', boxShadow: 'none', marginTop: 8, fontSize: 11 }}>Mark handled</button>
          </>) : (
            <button className="la-btn la-btn--soft" style={{ width: '100%', justifyContent: 'center' }}><RIconEdit size={12} />Edit reply</button>
          )}
        </div>
        {/* Status */}
        <div style={{ padding: '13px 18px', display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto' }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 8, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--mute-2)' }}>Status</span>
          <RepTimeline timeline={displayTimeline} />
        </div>
      </div>
    </div>
  );
}

Object.assign(window, {
  RIconExt, RIconRefresh, RIconFlag, RIconStarF, RIconEdit, RIconSend, RIconNote, RIconWA, RIconSms, RIconArrow, RIconClock,
  repRatingColor, repAutoPosts, repDelayLabel, RepStars, RepPlatformGlyph, RepAvatar, RepStatusPill, RepChannelPill,
  RepSummaryChip, RepLangBadge, RepCard, RepLabel,
  RepListCard, RepComposer, RepAIAnalysis, RepTimeline, RepReviewDetail,
});
