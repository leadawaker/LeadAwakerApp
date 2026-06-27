// referrals-app.jsx — standalone Referrals page (design mockup).
// Board view of the referral funnel: asked → received → converted.
// Depends on: components.jsx (Icon set, Sidebar), referrals-data.js
//
// The story: a happy customer leaves a 5★ review → the engine sends an
// opt-in referral ask on WhatsApp (Asked) → they reply with a name
// (Received) → a human works it until that person books (Converted).

// ─── small inline icons (match components.jsx stroke style) ──────
const RfStar  = ({ size = 12 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M12 3l2.5 5.4 5.9.6-4.4 4 1.2 5.8L12 17.8 6.8 18.8 8 13 3.6 9l5.9-.6z"/></svg>;
const RfWA    = ({ size = 13 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15l-1.3 4.7 4.8-1.3A10 10 0 1 0 12 2zm5.3 14c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.1-4.5-3.9-4.7-4.1-.1-.2-1.1-1.4-1.1-2.7s.7-1.9.9-2.2c.2-.2.5-.3.6-.3h.5c.2 0 .4 0 .6.5l.8 1.9c.1.2.1.4 0 .5l-.4.5c-.2.2-.3.4-.1.7.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.4 2.4 1.5.2.1.4.1.6-.1l.7-.9c.2-.2.4-.2.6-.1l1.9.9c.2.1.4.2.4.3.1.2.1.6 0 1z"/></svg>;
const RfMail  = ({ size = 13 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>;
const RfPhone = ({ size = 13 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 4h3l2 5-2.5 1.5a11 11 0 0 0 5 5L19 13l2 5v3a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1z"/></svg>;
const RfArrow = ({ size = 14 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>;
const RfCheck = ({ size = 13 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4 10-11"/></svg>;
const RfClock = ({ size = 12 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>;
const RfBell  = ({ size = 16 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 21a2 2 0 0 0 4 0"/></svg>;
const RfGiftSm = ({ size = 15 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="9" width="16" height="11" rx="1.5"/><path d="M2.5 9h19M12 9v11"/><path d="M12 9c-1.6 0-4.2.2-5-1.3C6.3 6.4 8 5 9.1 6c1.4 1.2 2.9 3 2.9 3zM12 9c1.6 0 4.2.2 5-1.3.7-1.3-1-2.7-2.1-1.7C13.5 7.2 12 9 12 9z"/></svg>;

// ─── avatar tile ─────────────────────────────────────────────────
function RefAvatar({ name, ini, size = 34, role = 'referrer' }) {
  const palette = role === 'converted'
    ? { bg: 'var(--good)', fg: 'var(--paper)' }
    : role === 'referred'
      ? { bg: 'var(--wine-grad)', fg: 'var(--paper)' }
      : { bg: 'var(--surface)', fg: 'var(--ink-soft)' };
  return (
    <span className={role === 'referrer' ? 'neu-raised-crisp' : ''} style={{
      width: size, height: size, flexShrink: 0, borderRadius: 'var(--r-button)',
      background: palette.bg, color: palette.fg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'var(--mono)', fontSize: size * 0.32, fontWeight: 700, letterSpacing: '0.04em',
      boxShadow: role === 'referrer' ? 'var(--sh-raised-crisp)' : 'var(--sh-raised-crisp)',
    }}>{ini}</span>
  );
}

function RefStars({ rating, size = 11 }) {
  return (
    <span style={{ display: 'inline-flex', gap: 1, color: rating >= 4 ? 'var(--good)' : 'var(--warn)' }}>
      {[1, 2, 3, 4, 5].map(i => (
        <span key={i} style={{ display: 'flex', opacity: i <= rating ? 1 : 0.25 }}><RfStar size={size} /></span>
      ))}
    </span>
  );
}

function RefChannelChip({ channel = 'whatsapp' }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: 'var(--mono)', fontSize: 8.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--good)', background: 'rgba(31,138,91,0.10)', borderRadius: 'var(--r-pill)', padding: '3px 8px' }}>
      <RfWA size={11} />WhatsApp
    </span>
  );
}

// ─── KPI card ────────────────────────────────────────────────────
function RefKpi({ label, value, suffix, sub, Ic, accent }) {
  return (
    <div className="neu-raised" style={{ flex: '1 1 180px', minWidth: 0, borderRadius: 'var(--r-card)', background: 'var(--card)', padding: '15px 17px', display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 9.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--mute)' }}>{label}</span>
        <span style={{ display: 'flex', color: accent || 'var(--mute-2)' }}><Ic size={15} /></span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <span style={{ fontFamily: 'var(--serif)', fontSize: 40, lineHeight: 0.95, color: 'var(--ink)', letterSpacing: '-0.01em' }}>{value}</span>
        {suffix && <span style={{ fontFamily: 'var(--serif)', fontSize: 20, color: 'var(--mute)' }}>{suffix}</span>}
      </div>
      {sub && <span style={{ fontSize: 11.5, color: 'var(--mute)' }}>{sub}</span>}
    </div>
  );
}

// ─── board card (varies by status) ───────────────────────────────
function RefCard({ r, active, onClick }) {
  const baseStyle = {
    padding: '11px 12px', borderRadius: 'var(--r-surface)', cursor: 'pointer',
    background: 'var(--card)', display: 'flex', flexDirection: 'column', gap: 9,
    outline: active ? '2px solid var(--wine)' : '2px solid transparent', transition: 'outline 120ms',
  };

  if (r.status === 'asked') {
    return (
      <div onClick={onClick} className="neu-raised-crisp" style={baseStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <RefAvatar name={r.referrer} ini={r.refIni} role="referrer" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.referrer}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
              <RefStars rating={r.refRating} />
              <span style={{ fontSize: 10.5, color: 'var(--mute)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.refJob}</span>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--mute-2)', letterSpacing: '0.05em' }}>
            <RfClock size={11} />Asked {r.askedAgo} ago
          </span>
          {r.followUp
            ? <span style={{ fontFamily: 'var(--mono)', fontSize: 8, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--warn)', background: 'var(--warn-tint)', borderRadius: 'var(--r-pill)', padding: '2px 7px' }}>Nudged</span>
            : <RfWA size={12} />}
        </div>
      </div>
    );
  }

  if (r.status === 'received') {
    return (
      <div onClick={onClick} className="neu-raised-crisp" style={{ ...baseStyle, boxShadow: 'var(--sh-raised-crisp), inset 0 0 0 1.5px rgba(94,34,48,0.18)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
          <RefAvatar name={r.referred} ini={r.refdIni} role="referred" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.referred}</div>
            <div style={{ fontSize: 11, color: 'var(--mute)', marginTop: 2 }}>referred by {r.referrer}</div>
          </div>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--wine)', flexShrink: 0, marginTop: 5 }} />
        </div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start', fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-soft)', background: 'var(--bg)', boxShadow: 'var(--sh-inset-crisp)', borderRadius: 'var(--r-flush)', padding: '4px 9px' }}>
          {r.contactType === 'email' ? <RfMail size={11} /> : <RfPhone size={11} />}
          {r.contact}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--mute-2)', letterSpacing: '0.05em' }}>Received {r.receivedAgo} ago</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: 'var(--mono)', fontSize: 8.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--wine)' }}>Work it <RfArrow size={11} /></span>
        </div>
      </div>
    );
  }

  // converted
  return (
    <div onClick={onClick} className="neu-raised-crisp" style={baseStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <RefAvatar name={r.referred} ini={<RfCheck size={15} />} role="converted" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.referred}</div>
          <div style={{ fontSize: 10.5, color: 'var(--mute)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>via {r.referrer} · {r.refdJob}</div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--good)', letterSpacing: '0.05em', fontWeight: 700 }}><RfCheck size={11} />Converted {r.convertedAgo} ago</span>
      </div>
    </div>
  );
}

// ─── board column ────────────────────────────────────────────────
function RefColumn({ stage, items, activeId, onSelect }) {
  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 4px 11px', flexShrink: 0 }}>
        <span style={{ width: 9, height: 9, borderRadius: 3, background: stage.color }} />
        <span style={{ fontFamily: 'var(--mono)', fontSize: 10.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-soft)', fontWeight: 700 }}>{stage.label}</span>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 8, letterSpacing: '0.1em', textTransform: 'uppercase', color: stage.owner === 'engine' ? 'var(--stage-contacted)' : 'var(--wine)', border: `1px solid ${stage.owner === 'engine' ? 'var(--stage-contacted)' : 'var(--wine)'}`, borderRadius: 'var(--r-pill)', padding: '1px 7px', opacity: 0.85 }}>{stage.owner === 'engine' ? 'AUTO' : 'YOU'}</span>
        <span style={{ marginLeft: 'auto', fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--mute-2)', background: 'var(--bg)', boxShadow: 'var(--sh-inset-crisp)', padding: '1px 8px', borderRadius: 'var(--r-pill)' }}>{items.length}</span>
      </div>
      <div style={{ fontSize: 10.5, color: 'var(--mute)', padding: '0 4px 10px', flexShrink: 0 }}>{stage.desc}</div>
      <div className="neu-inset" style={{
        flex: 1, minHeight: 0, borderRadius: 'var(--r-card)', padding: 9, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 9,
        background: stage.star ? 'var(--good-tint, rgba(31,138,91,0.07))' : undefined,
        boxShadow: stage.star ? 'var(--sh-inset-crisp), inset 0 0 0 1.5px rgba(31,138,91,0.22)' : undefined,
      }}>
        {items.length === 0
          ? <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--mute-2)', minHeight: 70 }}>Empty</div>
          : items.map(r => <RefCard key={r.id} r={r} active={r.id === activeId} onClick={() => onSelect(r.id)} />)}
      </div>
    </div>
  );
}

// ─── list view (rows) ────────────────────────────────────────────
function RefListView({ stages, referrals, activeId, onSelect }) {
  const stageMap = {};
  stages.forEach(s => { stageMap[s.key] = s; });
  const order = { received: 0, asked: 1, converted: 2 };
  const rows = [...referrals].sort((a, b) => (order[a.status] - order[b.status]));

  const ago = (r) => r.status === 'converted' ? `${r.convertedAgo} ago` : r.status === 'received' ? `${r.receivedAgo} ago` : `${r.askedAgo} ago`;

  return (
    <div className="neu-raised" style={{ borderRadius: 'var(--r-card)', background: 'var(--card)', overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {/* header */}
      <div style={{ flexShrink: 0, display: 'grid', gridTemplateColumns: '1.4fr 1.4fr 1fr 0.9fr 0.7fr', gap: 14, padding: '12px 18px', borderBottom: '1px solid var(--line)', fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--mute)' }}>
        <span>Referrer</span><span>Referred</span><span>Contact</span><span>Stage</span><span style={{ textAlign: 'right' }}>Updated</span>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {rows.map((r, i) => {
          const st = stageMap[r.status];
          const on = r.id === activeId;
          return (
            <div key={r.id} onClick={() => onSelect(r.id)} style={{
              display: 'grid', gridTemplateColumns: '1.4fr 1.4fr 1fr 0.9fr 0.7fr', gap: 14, alignItems: 'center',
              padding: '12px 18px', cursor: 'pointer', borderBottom: i < rows.length - 1 ? '1px solid var(--line)' : 'none',
              background: on ? 'var(--wine-tint)' : 'transparent', transition: 'background 120ms',
            }}>
              {/* referrer */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
                <RefAvatar name={r.referrer} ini={r.refIni} role="referrer" size={30} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.referrer}</div>
                  <div style={{ marginTop: 2 }}><RefStars rating={r.refRating} size={9} /></div>
                </div>
              </div>
              {/* referred */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
                {r.referred
                  ? <>
                      <RefAvatar name={r.referred} ini={r.status === 'converted' ? <RfCheck size={13} /> : r.refdIni} role={r.status === 'converted' ? 'converted' : 'referred'} size={30} />
                      <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.referred}</span>
                    </>
                  : <span style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--mute-2)', fontStyle: 'italic' }}>awaiting name…</span>}
              </div>
              {/* contact */}
              <span style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: r.contact ? 'var(--ink-soft)' : 'var(--mute-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                {r.contact ? <>{r.contactType === 'email' ? <RfMail size={11} /> : <RfPhone size={11} />}{r.contact}</> : '—'}
              </span>
              {/* stage */}
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'var(--mono)', fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: st.color }}>
                <span style={{ width: 7, height: 7, borderRadius: 2, background: st.color }} />{st.label}
              </span>
              {/* updated */}
              <span style={{ fontFamily: 'var(--mono)', fontSize: 9.5, color: 'var(--mute-2)', textAlign: 'right' }}>{ago(r)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── notifications: meta + row + popover ─────────────────────────
const REF_NOTIF_META = {
  referral_received:  { Ic: RfGiftSm, color: 'var(--wine)', tint: 'var(--wine-tint)' },
  referral_converted: { Ic: RfCheck,  color: 'var(--good)', tint: 'rgba(31,138,91,0.12)' },
  referral_asked:     { Ic: RfWA,     color: 'var(--stage-contacted)', tint: 'rgba(84,123,176,0.12)' },
};

function RefNotifRow({ n, onClick }) {
  const m = REF_NOTIF_META[n.type] || REF_NOTIF_META.referral_received;
  return (
    <div onClick={() => onClick(n)} style={{
      display: 'flex', gap: 12, padding: '13px 16px', cursor: 'pointer', position: 'relative',
      background: n.unread ? 'var(--wine-tint)' : 'transparent', borderBottom: '1px solid var(--line)', transition: 'background 140ms',
    }}
    onMouseEnter={(e) => { e.currentTarget.style.background = n.unread ? 'rgba(94,34,48,0.12)' : 'var(--surface)'; }}
    onMouseLeave={(e) => { e.currentTarget.style.background = n.unread ? 'var(--wine-tint)' : 'transparent'; }}>
      {n.unread && <span style={{ position: 'absolute', left: 0, top: 12, bottom: 12, width: 3, background: 'var(--wine)', borderRadius: '0 3px 3px 0' }} />}
      <span style={{ width: 36, height: 36, borderRadius: 'var(--r-surface)', flexShrink: 0, background: m.tint, color: m.color, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--sh-inset-crisp)' }}><m.Ic size={16} /></span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', gap: 7, alignItems: 'flex-start' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.3, textWrap: 'pretty', flex: 1 }}>{n.title}</span>
          {n.unread && <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--wine)', flexShrink: 0, marginTop: 4 }} />}
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--mute)', marginTop: 3, lineHeight: 1.45, textWrap: 'pretty' }}>{n.body}</div>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--mute-2)', marginTop: 6, letterSpacing: '0.04em' }}>{n.time}</div>
      </div>
    </div>
  );
}

function RefNotifPopover({ list, onClose, onMarkAll, onOpenRef }) {
  const [filter, setFilter] = React.useState('all');
  const unread = list.filter(n => n.unread).length;
  const shown = filter === 'all' ? list : list.filter(n => n.unread);
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 60 }} />
      <div style={{ position: 'absolute', top: 56, right: 20, zIndex: 61, width: 372, maxHeight: 'min(560px, 78vh)', display: 'flex', flexDirection: 'column', background: 'var(--card)', borderRadius: 'var(--r-card)', border: '1px solid var(--line)', boxShadow: 'var(--sh-raised-tall)', overflow: 'hidden' }}>
        <div style={{ padding: '15px 17px 12px', flexShrink: 0, borderBottom: '1px solid var(--line)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontFamily: 'var(--serif)', fontSize: 21, color: 'var(--ink)' }}>Referral activity</span>
            <button onClick={onMarkAll} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--wine)', fontSize: 12, fontWeight: 600 }}><RfCheck size={12} />Mark all read</button>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            {[['all', 'All'], ['unread', 'Unread']].map(([k, label]) => {
              const on = k === filter;
              return (
                <button key={k} onClick={() => setFilter(k)} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, border: 'none', cursor: 'pointer', padding: '5px 13px', borderRadius: 'var(--r-pill)', background: on ? 'var(--surface)' : 'transparent', boxShadow: on ? 'var(--sh-inset-crisp)' : 'none', color: on ? 'var(--ink)' : 'var(--mute)', fontSize: 12.5, fontWeight: on ? 700 : 500 }}>
                  {label}{k === 'unread' && <span style={{ fontFamily: 'var(--mono)', fontSize: 9, fontWeight: 700, padding: '1px 7px', borderRadius: 'var(--r-pill)', background: 'var(--wine)', color: 'var(--paper)' }}>{unread}</span>}
                </button>
              );
            })}
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          {shown.length === 0
            ? <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--mute-2)' }}><RfBell size={24} /><div style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', marginTop: 10 }}>All caught up</div></div>
            : shown.map(n => <RefNotifRow key={n.id} n={n} onClick={onOpenRef} />)}
        </div>
      </div>
    </>
  );
}

// ─── ask-message preview (reflects framing) ──────────────────────
function buildAsk(r, config) {
  const first = r.referrer.split(/\s+/)[0];
  const nl = r.lang === 'nl';
  let base = nl
    ? `Hoi ${first}, bedankt voor je mooie review! Ken je iemand die ook ${r.refJob.toLowerCase()} of ander werk nodig heeft? Stuur dit bericht gerust door of laat hun naam achter.`
    : `Hi ${first}, thanks for the lovely review! Know anyone who could use ${r.refJob.toLowerCase()} or similar work? Forward this message, or just send us their name.`;
  if (config.framing === 'reward') base += nl
    ? ` Als dank krijg je ${config.reward} op je volgende klus. 🙏`
    : ` As a thank-you, we'll add ${config.reward} to your next job. 🙏`;
  if (config.framing === 'charity') base += nl
    ? ` Voor elke aanmelding die boekt doneren we €25 aan een goed doel.`
    : ` For every referral that books, we donate €25 to charity.`;
  return base;
}

// ─── detail panel ────────────────────────────────────────────────
function RefDetail({ r, config }) {
  if (!r) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40, textAlign: 'center', color: 'var(--mute-2)' }}>
        <div>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 22, color: 'var(--mute)' }}>Pick a referral</div>
          <div style={{ fontSize: 12.5, marginTop: 6 }}>Select a card to see the chain and next step.</div>
        </div>
      </div>
    );
  }

  const isAsked = r.status === 'asked';
  const isReceived = r.status === 'received';
  const isConverted = r.status === 'converted';
  const headName = isAsked ? r.referrer : r.referred;
  const headIni = isAsked ? r.refIni : r.refdIni;
  const headRole = isConverted ? 'converted' : isAsked ? 'referrer' : 'referred';

  const Section = ({ label, children }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
      <div className="eyebrow eyebrow-sm" style={{ color: 'var(--mute)' }}>{label}</div>
      {children}
    </div>
  );

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      {/* header */}
      <div style={{ flexShrink: 0, padding: '20px 22px 16px', borderBottom: '1px solid var(--line)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <RefAvatar name={headName} ini={isConverted ? <RfCheck size={18} /> : headIni} role={headRole} size={44} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <span className="neu-raised" style={{ display: 'inline-flex', alignItems: 'center', gap: 9, background: 'var(--card)', borderRadius: 'var(--r-surface)', padding: '6px 13px' }}>
              <span style={{ fontFamily: 'var(--serif)', fontSize: 23, color: 'var(--ink)', lineHeight: 1, whiteSpace: 'nowrap' }}>{headName}</span>
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: isConverted ? 'var(--good)' : isReceived ? 'var(--wine)' : 'var(--stage-contacted)' }}>
                {isAsked ? 'Invite sent' : isReceived ? 'Name received' : 'Converted'}
              </span>
              <RefChannelChip channel={r.channel} />
            </div>
          </div>
        </div>
      </div>

      {/* body */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* the chain */}
        <Section label="Referral chain">
          <div className="neu-inset" style={{ borderRadius: 'var(--r-card)', padding: '14px 15px', display: 'flex', alignItems: 'center', gap: 11 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
              <RefAvatar name={r.referrer} ini={r.refIni} role="referrer" size={36} />
              <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink)', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>{r.referrer}</div>
              <RefStars rating={r.refRating} size={10} />
              <div style={{ fontFamily: 'var(--mono)', fontSize: 8, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--mute-2)' }}>Referrer</div>
            </div>
            <span style={{ color: 'var(--mute-2)', flexShrink: 0 }}><RfArrow size={18} /></span>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
              {r.referred
                ? <>
                    <RefAvatar name={r.referred} ini={isConverted ? <RfCheck size={15} /> : r.refdIni} role={isConverted ? 'converted' : 'referred'} size={36} />
                    <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink)', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>{r.referred}</div>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 8, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--mute-2)' }}>{isConverted ? 'Customer' : 'Referred'}</div>
                  </>
                : <>
                    <span style={{ width: 36, height: 36, borderRadius: 'var(--r-button)', border: '1.5px dashed var(--mute-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--mute-2)' }}>?</span>
                    <div style={{ fontSize: 11.5, color: 'var(--mute-2)', textAlign: 'center' }}>Awaiting name</div>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 8, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--mute-2)' }}>Referred</div>
                  </>}
            </div>
          </div>
        </Section>

        {/* what came back */}
        {(isReceived || isConverted) && r.reply && (
          <Section label="What they sent back">
            <div className="neu-inset" style={{ borderRadius: 'var(--r-card)', padding: '13px 15px' }}>
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: 'var(--ink-soft)', textWrap: 'pretty' }}>“{r.reply}”</p>
            </div>
            {r.note && <div style={{ fontSize: 11.5, color: 'var(--mute)', fontStyle: 'italic' }}>Note: {r.note}</div>}
          </Section>
        )}

        {/* contact */}
        {r.contact && (
          <Section label="Contact">
            <div style={{ display: 'inline-flex', alignSelf: 'flex-start', alignItems: 'center', gap: 8, fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-soft)', background: 'var(--bg)', boxShadow: 'var(--sh-inset-crisp)', borderRadius: 'var(--r-button)', padding: '8px 13px' }}>
              {r.contactType === 'email' ? <RfMail size={13} /> : <RfPhone size={13} />}{r.contact}
            </div>
          </Section>
        )}

        {/* the ask (asked state) */}
        {isAsked && (
          <Section label={`The ask — sent on WhatsApp`}>
            <div className="neu-inset" style={{ borderRadius: 'var(--r-card)', padding: '13px 15px' }}>
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: 'var(--ink-soft)', textWrap: 'pretty' }}>{buildAsk(r, config)}</p>
            </div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 9.5, color: 'var(--mute-2)', letterSpacing: '0.04em' }}>One-tap forwardable · {config.framing === 'reward' ? `reward framing (${config.reward})` : config.framing === 'charity' ? 'charity framing' : 'no incentive'}</div>
          </Section>
        )}

        {/* timeline */}
        <Section label="Timeline">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {[
              { k: 'asked', label: 'Referral asked', ago: r.askedAgo, on: true },
              { k: 'received', label: 'Name received', ago: r.receivedAgo, on: isReceived || isConverted },
              { k: 'converted', label: 'Booked a job', ago: r.convertedAgo, on: isConverted },
            ].map((s, i, arr) => (
              <div key={s.k} style={{ display: 'flex', gap: 11 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <span style={{ width: 11, height: 11, borderRadius: '50%', background: s.on ? 'var(--wine)' : 'var(--bg)', boxShadow: s.on ? 'none' : 'var(--sh-inset-crisp)', border: s.on ? 'none' : '1px solid var(--mute-2)' }} />
                  {i < arr.length - 1 && <span style={{ width: 2, flex: 1, minHeight: 22, background: arr[i + 1].on ? 'var(--wine)' : 'var(--line)' }} />}
                </div>
                <div style={{ paddingBottom: 14 }}>
                  <div style={{ fontSize: 12.5, fontWeight: s.on ? 600 : 400, color: s.on ? 'var(--ink)' : 'var(--mute-2)' }}>{s.label}</div>
                  {s.on && s.ago && <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--mute-2)', letterSpacing: '0.05em', marginTop: 2 }}>{s.ago} ago</div>}
                </div>
              </div>
            ))}
          </div>
        </Section>
      </div>

      {/* action bar */}
      <div style={{ flexShrink: 0, padding: '13px 22px', borderTop: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 10, background: 'var(--card)', flexWrap: 'wrap' }}>
        {isAsked && (<>
          <button className="la-btn la-btn--soft la-btn--lg"><RfWA size={14} />Send a nudge</button>
          <button className="la-btn la-btn--inset">Cancel ask</button>
        </>)}
        {isReceived && (<>
          <button className="la-btn la-btn--wine la-btn--lg"><RfWA size={14} />Message {r.referred.split(/\s+/)[0]}</button>
          <button className="la-btn la-btn--soft la-btn--lg"><RfCheck size={13} />Mark converted</button>
          <button className="la-btn la-btn--inset" style={{ marginLeft: 'auto' }}>Dismiss</button>
        </>)}
        {isConverted && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--good)', fontWeight: 600 }}><RfCheck size={15} />Referral closed — {r.referred.split(/\s+/)[0]} booked {r.refdJob}</span>
        )}
      </div>
    </div>
  );
}

// ═══ Page shell ════════════════════════════════════════════════════
function ReferralsPage({ framing = 'reward', defaultStatus = 'received' }) {
  const D = window.REF_DATA;
  const config = { ...D.config, framing };
  const [view, setView] = React.useState('board');
  const [time, setTime] = React.useState('month');

  const byStatus = (s) => D.referrals.filter(r => r.status === s);
  const received = byStatus('received');

  // default-select the freshest received referral (the thing needing action)
  const initial = (received[0] || D.referrals[0]);
  const [activeId, setActiveId] = React.useState(initial ? initial.id : null);
  const active = D.referrals.find(r => r.id === activeId) || null;

  // notifications (bell feed) — referral_received is the headline event
  const [notifs, setNotifs] = React.useState(D.notifications);
  const [notifOpen, setNotifOpen] = React.useState(false);
  const unread = notifs.filter(n => n.unread).length;
  const openFromNotif = (n) => {
    setNotifs(list => list.map(x => x.id === n.id ? { ...x, unread: false } : x));
    if (n.refId && D.referrals.some(r => r.id === n.refId)) setActiveId(n.refId);
    setNotifOpen(false);
  };

  const receivedCount = received.length;

  return (
    <div className="la-app" style={{ width: '100%', height: '100%', display: 'flex', overflow: 'hidden' }}>
      <Sidebar active="Referrals" badges={{ Referrals: receivedCount }} />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg)' }}>

        {/* toolbar */}
        <div style={{ height: 64, flexShrink: 0, padding: '0 22px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--mute)' }}>Referrals</span>
          <div className="la-seg">
            <button onClick={() => setView('board')} className={`la-seg-btn${view === 'board' ? ' on' : ''}`}>Board</button>
            <button onClick={() => setView('list')} className={`la-seg-btn${view === 'list' ? ' on' : ''}`}>List</button>
          </div>
          <div style={{ flex: 1 }} />
          {/* notifications bell */}
          <div style={{ position: 'relative' }}>
            <button onClick={() => setNotifOpen(o => !o)} aria-label="Referral activity" style={{
              width: 38, height: 38, borderRadius: 'var(--r-pill)', position: 'relative', border: 'none', cursor: 'pointer',
              background: notifOpen ? 'var(--wine-tint)' : 'var(--surface)', boxShadow: notifOpen ? 'var(--sh-inset-crisp)' : 'var(--sh-raised-crisp)',
              color: notifOpen ? 'var(--wine)' : 'var(--mute)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <RfBell size={17} />
              {unread > 0 && <span style={{ position: 'absolute', top: 6, right: 6, minWidth: 15, height: 15, padding: '0 4px', borderRadius: 'var(--r-pill)', background: 'var(--wine)', color: 'var(--paper)', fontFamily: 'var(--mono)', fontSize: 8.5, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 0 2px var(--bg)' }}>{unread}</span>}
            </button>
            {notifOpen && <RefNotifPopover list={notifs} onClose={() => setNotifOpen(false)} onMarkAll={() => setNotifs(l => l.map(n => ({ ...n, unread: false })))} onOpenRef={openFromNotif} />}
          </div>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontFamily: 'var(--mono)', fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: config.enabled ? 'var(--good)' : 'var(--mute)', background: config.enabled ? 'rgba(31,138,91,0.10)' : 'var(--bg)', borderRadius: 'var(--r-pill)', padding: '6px 12px' }}>
            <IconGift size={13} />Referral ask · {config.enabled ? 'On' : 'Off'}
          </span>
          <div className="la-seg">
            {['week', 'month', 'qtr'].map(t => <button key={t} onClick={() => setTime(t)} className={`la-seg-btn${time === t ? ' on' : ''}`}>{t === 'week' ? 'Week' : t === 'month' ? 'Month' : 'Quarter'}</button>)}
          </div>
        </div>

        {/* KPI strip */}
        <div style={{ flexShrink: 0, padding: '16px 22px 0', display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          <RefKpi label="Asks sent" value={D.kpis.asksSent} sub="this month" Ic={RfWA} accent="var(--stage-contacted)" />
          <RefKpi label="Names received" value={D.kpis.namesReceived} sub={`${receivedCount} need your attention`} Ic={IconGift} accent="var(--wine)" />
          <RefKpi label="Converted" value={D.kpis.converted} sub="referred → customer" Ic={RfCheck} accent="var(--good)" />
          <RefKpi label="Conversion rate" value={D.kpis.conversionRate} suffix="%" sub="of asks booked a job" Ic={RfArrow} accent="var(--ink-soft)" />
        </div>

        {/* model ribbon */}
        <div style={{ flexShrink: 0, margin: '14px 22px 0', display: 'flex', alignItems: 'center', gap: 10, background: 'var(--wine-tint)', borderRadius: 'var(--r-surface)', padding: '9px 14px' }}>
          <span style={{ display: 'flex', color: 'var(--wine)' }}><IconGift size={15} /></span>
          <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}><strong>Happy customers are asked for a referral</strong> right after a great review. The engine handles <strong>asked → received</strong>; you take it from <strong>received → converted</strong>.</span>
        </div>

        {/* main: board/list + detail */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden', marginTop: 14, borderTop: '1px solid var(--line)' }}>
          <div style={{ flex: 1, minWidth: 0, padding: 18, overflow: 'hidden', display: 'flex' }}>
            {view === 'board' ? (
              <div style={{ display: 'flex', gap: 16, height: '100%', width: '100%' }}>
                {D.stages.map(stage => (
                  <RefColumn key={stage.key} stage={stage} items={byStatus(stage.key)} activeId={activeId} onSelect={setActiveId} />
                ))}
              </div>
            ) : (
              <RefListView stages={D.stages} referrals={D.referrals} activeId={activeId} onSelect={setActiveId} />
            )}
          </div>
          <div style={{ flex: '0 0 clamp(360px, 30vw, 440px)', minWidth: 0, display: 'flex', flexDirection: 'column', borderLeft: '1px solid var(--line)', background: 'var(--surface)' }}>
            <RefDetail r={active} config={config} />
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { ReferralsPage });
