// mobile-referrals.jsx — Referrals tab for the Lead Awaker mobile app.
// Reflows the desktop Referrals board into a single phone pane: a funnel
// strip (asked / received / converted), status filter chips, a referral
// list (received-first — your action queue), and a detail bottom-sheet
// showing the chain, what came back, contact, timeline and next action.
//
// Reached from the More menu (like Billing / Accounts). Self-contained:
// depends only on referrals-data.js (REF_DATA), components.jsx (icons),
// mobile-shell.jsx (MobSheet, MobRecede, IconBtn). MR* prefixes avoid
// clobbering the desktop Ref* peers.

// ─── Glyphs ────────────────────────────────────────────────────────
const MRWA    = ({ s = 13 }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15l-1.3 4.7 4.8-1.3A10 10 0 1 0 12 2zm5.3 14c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.1-4.5-3.9-4.7-4.1-.1-.2-1.1-1.4-1.1-2.7s.7-1.9.9-2.2c.2-.2.5-.3.6-.3h.5c.2 0 .4 0 .6.5l.8 1.9c.1.2.1.4 0 .5l-.4.5c-.2.2-.3.4-.1.7.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.4 2.4 1.5.2.1.4.1.6-.1l.7-.9c.2-.2.4-.2.6-.1l1.9.9c.2.1.4.2.4.3.1.2.1.6 0 1z"/></svg>;
const MRMail  = ({ s = 13 }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>;
const MRPhone = ({ s = 13 }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 4h3l2 5-2.5 1.5a11 11 0 0 0 5 5L19 13l2 5v3a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1z"/></svg>;
const MRArrow = ({ s = 14 }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>;
const MRCheck = ({ s = 13 }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4 10-11"/></svg>;
const MRClock = ({ s = 12 }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>;
const MRStar  = ({ s = 11 }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor"><path d="M12 3l2.5 5.4 5.9.6-4.4 4 1.2 5.8L12 17.8 6.8 18.8 8 13 3.6 9l5.9-.6z"/></svg>;

// ─── Stage meta ────────────────────────────────────────────────────
function mrStage(key) {
  return window.REF_DATA.stages.find(s => s.key === key) || window.REF_DATA.stages[0];
}

function MRAvatar({ ini, size = 38, role = 'referrer' }) {
  const palette = role === 'converted'
    ? { bg: 'var(--good)', fg: 'var(--paper)' }
    : role === 'referred'
      ? { bg: 'var(--wine-grad)', fg: 'var(--paper)' }
      : { bg: 'var(--surface)', fg: 'var(--ink-soft)' };
  return (
    <span style={{
      width: size, height: size, flexShrink: 0, borderRadius: Math.round(size * 0.26),
      background: palette.bg, color: palette.fg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'var(--mono)', fontSize: size * 0.32, fontWeight: 700,
      boxShadow: 'var(--sh-raised-crisp)',
    }}>{ini}</span>
  );
}

function MRStars({ rating, size = 11 }) {
  return (
    <span style={{ display: 'inline-flex', gap: 1, color: rating >= 4 ? 'var(--good)' : 'var(--warn)' }}>
      {[1, 2, 3, 4, 5].map(i => <span key={i} style={{ display: 'flex', opacity: i <= rating ? 1 : 0.25 }}><MRStar s={size} /></span>)}
    </span>
  );
}

function MRStageTag({ stage }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'var(--mono)', fontSize: 8.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: stage.color }}>
      <span style={{ width: 7, height: 7, borderRadius: 2, background: stage.color }} />{stage.label}
    </span>
  );
}

// ─── Funnel strip (3 mini stats) ───────────────────────────────────
function MRFunnel({ kpis }) {
  const cells = [
    { label: 'Asked', value: kpis.asksSent, color: 'var(--stage-contacted)' },
    { label: 'Received', value: kpis.namesReceived, color: 'var(--wine)' },
    { label: 'Converted', value: kpis.converted, color: 'var(--good)' },
  ];
  return (
    <div className="neu-raised" style={{ borderRadius: 'var(--r-card)', padding: '13px 8px', display: 'flex', alignItems: 'center' }}>
      {cells.map((c, i) => (
        <React.Fragment key={c.label}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
            <span style={{ fontFamily: 'var(--serif)', fontSize: 30, lineHeight: 1, color: 'var(--ink)' }}>{c.value}</span>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 8, letterSpacing: '0.1em', textTransform: 'uppercase', color: c.color, fontWeight: 700 }}>{c.label}</span>
          </div>
          {i < cells.length - 1 && <span style={{ color: 'var(--mute-2)', flexShrink: 0 }}><MRArrow s={14} /></span>}
        </React.Fragment>
      ))}
    </div>
  );
}

// ─── Referral list row ─────────────────────────────────────────────
function MRRow({ r, onOpen }) {
  const stage = mrStage(r.status);
  const isAsked = r.status === 'asked';
  const isReceived = r.status === 'received';
  const headIni = isAsked ? r.refIni : (r.status === 'converted' ? <MRCheck s={14} /> : r.refdIni);
  const headName = isAsked ? r.referrer : r.referred;
  const headRole = r.status === 'converted' ? 'converted' : isAsked ? 'referrer' : 'referred';
  const ago = r.status === 'converted' ? `${r.convertedAgo} ago` : isReceived ? `${r.receivedAgo} ago` : `Asked ${r.askedAgo} ago`;
  return (
    <button onClick={() => onOpen(r)} style={{
      width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer',
      background: 'var(--surface)', borderRadius: 'var(--r-card)', padding: '12px 14px', minHeight: 60,
      boxShadow: isReceived ? 'var(--sh-raised-crisp), inset 0 0 0 1.5px rgba(94,34,48,0.16)' : 'var(--sh-raised-crisp)',
      display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <MRAvatar ini={headIni} size={40} role={headRole} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 4 }}>{headName}</div>
        <div style={{ fontSize: 11.5, color: 'var(--mute)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {isAsked ? <>Waiting on a name · {r.refJob}</> : <>referred by {r.referrer}</>}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
        <MRStageTag stage={stage} />
        <span style={{ fontFamily: 'var(--mono)', fontSize: 8.5, color: 'var(--mute-2)', letterSpacing: '0.05em' }}>{ago}</span>
      </div>
    </button>
  );
}

// ─── Detail bottom-sheet body ──────────────────────────────────────
function MRDetailBody({ r, config }) {
  const isAsked = r.status === 'asked';
  const isReceived = r.status === 'received';
  const isConverted = r.status === 'converted';
  const headName = isAsked ? r.referrer : r.referred;
  const headIni = isConverted ? <MRCheck s={18} /> : (isAsked ? r.refIni : r.refdIni);
  const headRole = isConverted ? 'converted' : isAsked ? 'referrer' : 'referred';

  const first = (r.referrer || '').split(/\s+/)[0];
  const nl = r.lang === 'nl';
  let ask = nl
    ? `Hoi ${first}, bedankt voor je mooie review! Ken je iemand die ook werk nodig heeft? Stuur dit bericht gerust door of laat hun naam achter.`
    : `Hi ${first}, thanks for the lovely review! Know anyone who could use similar work? Forward this message, or just send us their name.`;
  if (config.framing === 'reward') ask += nl ? ` Als dank krijg je ${config.reward} op je volgende klus. 🙏` : ` As a thank-you, we'll add ${config.reward} to your next job. 🙏`;
  if (config.framing === 'charity') ask += nl ? ` Voor elke aanmelding die boekt doneren we €25 aan een goed doel.` : ` For every referral that books, we donate €25 to charity.`;

  const Section = ({ label, children }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
      <div className="eyebrow eyebrow-sm" style={{ color: 'var(--mute)' }}>{label}</div>
      {children}
    </div>
  );

  return (
    <div className="la-app" style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      {/* hero */}
      <div style={{ flexShrink: 0, background: 'var(--bg)', borderBottom: '1px solid var(--line)', padding: '28px 16px 16px' }}>
        <div className="row" style={{ gap: 13, alignItems: 'center' }}>
          <MRAvatar ini={headIni} size={46} role={headRole} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 24, color: 'var(--ink)', lineHeight: 1, letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{headName}</div>
            <div className="row" style={{ gap: 8, marginTop: 6 }}>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: isConverted ? 'var(--good)' : isReceived ? 'var(--wine)' : 'var(--stage-contacted)' }}>
                {isAsked ? 'Invite sent' : isReceived ? 'Name received' : 'Converted'}
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: 'var(--mono)', fontSize: 8, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--good)' }}><MRWA s={11} />WhatsApp</span>
            </div>
          </div>
        </div>
      </div>

      {/* body */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '18px 16px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* chain */}
        <Section label="Referral chain">
          <div className="neu-inset" style={{ borderRadius: 'var(--r-card)', padding: '14px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <MRAvatar ini={r.refIni} size={36} role="referrer" />
              <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink)', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>{r.referrer}</span>
              <MRStars rating={r.refRating} size={10} />
              <span style={{ fontFamily: 'var(--mono)', fontSize: 7.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--mute-2)' }}>Referrer</span>
            </div>
            <span style={{ color: 'var(--mute-2)', flexShrink: 0 }}><MRArrow s={18} /></span>
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              {r.referred ? <>
                <MRAvatar ini={isConverted ? <MRCheck s={15} /> : r.refdIni} size={36} role={isConverted ? 'converted' : 'referred'} />
                <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink)', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>{r.referred}</span>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 7.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--mute-2)' }}>{isConverted ? 'Customer' : 'Referred'}</span>
              </> : <>
                <span style={{ width: 36, height: 36, borderRadius: 9, border: '1.5px dashed var(--mute-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--mute-2)' }}>?</span>
                <span style={{ fontSize: 11.5, color: 'var(--mute-2)' }}>Awaiting name</span>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 7.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--mute-2)' }}>Referred</span>
              </>}
            </div>
          </div>
        </Section>

        {(isReceived || isConverted) && r.reply && (
          <Section label="What they sent back">
            <div className="neu-inset" style={{ borderRadius: 'var(--r-card)', padding: '13px 15px' }}>
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: 'var(--ink-soft)', textWrap: 'pretty' }}>“{r.reply}”</p>
            </div>
            {r.note && <div style={{ fontSize: 11.5, color: 'var(--mute)', fontStyle: 'italic' }}>Note: {r.note}</div>}
          </Section>
        )}

        {r.contact && (
          <Section label="Contact">
            <div style={{ display: 'inline-flex', alignSelf: 'flex-start', alignItems: 'center', gap: 8, fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-soft)', background: 'var(--bg)', boxShadow: 'var(--sh-inset-crisp)', borderRadius: 'var(--r-button)', padding: '9px 13px' }}>
              {r.contactType === 'email' ? <MRMail s={13} /> : <MRPhone s={13} />}{r.contact}
            </div>
          </Section>
        )}

        {isAsked && (
          <Section label="The ask — sent on WhatsApp">
            <div className="neu-inset" style={{ borderRadius: 'var(--r-card)', padding: '13px 15px' }}>
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: 'var(--ink-soft)', textWrap: 'pretty' }}>{ask}</p>
            </div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--mute-2)', letterSpacing: '0.04em' }}>Forwardable · {config.framing === 'reward' ? `reward (${config.reward})` : config.framing === 'charity' ? 'charity framing' : 'no incentive'}</div>
          </Section>
        )}

        {/* timeline */}
        <Section label="Timeline">
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {[
              { k: 'asked', label: 'Referral asked', ago: r.askedAgo, on: true },
              { k: 'received', label: 'Name received', ago: r.receivedAgo, on: isReceived || isConverted },
              { k: 'converted', label: 'Booked a job', ago: r.convertedAgo, on: isConverted },
            ].map((s, i, arr) => (
              <div key={s.k} className="row" style={{ gap: 11, alignItems: 'stretch' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <span style={{ width: 11, height: 11, borderRadius: '50%', background: s.on ? 'var(--wine)' : 'var(--bg)', boxShadow: s.on ? 'none' : 'var(--sh-inset-crisp)', border: s.on ? 'none' : '1px solid var(--mute-2)' }} />
                  {i < arr.length - 1 && <span style={{ width: 2, flex: 1, minHeight: 20, background: arr[i + 1].on ? 'var(--wine)' : 'var(--line)' }} />}
                </div>
                <div style={{ paddingBottom: 14 }}>
                  <div style={{ fontSize: 12.5, fontWeight: s.on ? 600 : 400, color: s.on ? 'var(--ink)' : 'var(--mute-2)' }}>{s.label}</div>
                  {s.on && s.ago && <div style={{ fontFamily: 'var(--mono)', fontSize: 8.5, color: 'var(--mute-2)', letterSpacing: '0.05em', marginTop: 2 }}>{s.ago} ago</div>}
                </div>
              </div>
            ))}
          </div>
        </Section>
      </div>

      {/* actions */}
      <div style={{ flexShrink: 0, borderTop: '1px solid var(--line)', padding: '13px 16px calc(13px + var(--safe-bottom))', display: 'flex', gap: 10 }}>
        {isAsked && (
          <button style={{ flex: 1, height: 48, borderRadius: 'var(--r-surface)', border: 'none', cursor: 'pointer', background: 'var(--surface)', boxShadow: 'var(--sh-raised-crisp)', color: 'var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700 }}><MRWA s={15} />Send a nudge</button>
        )}
        {isReceived && (<>
          <button style={{ flex: 1, height: 48, borderRadius: 'var(--r-surface)', border: 'none', cursor: 'pointer', background: 'var(--wine-grad)', boxShadow: 'var(--sh-raised-medium)', color: 'var(--paper)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700 }}><MRWA s={15} />Message</button>
          <button style={{ flex: 1, height: 48, borderRadius: 'var(--r-surface)', border: 'none', cursor: 'pointer', background: 'var(--surface)', boxShadow: 'var(--sh-raised-crisp)', color: 'var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700 }}><MRCheck s={14} />Converted</button>
        </>)}
        {isConverted && (
          <div style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 12.5, color: 'var(--good)', fontWeight: 600 }}><MRCheck s={15} />Booked {r.refdJob}</div>
        )}
      </div>
    </div>
  );
}

// ─── Screen ────────────────────────────────────────────────────────
function MobReferralsScreen({ onBack, framing = 'reward' }) {
  const D = window.REF_DATA;
  const config = { ...D.config, framing };
  const [filter, setFilter] = React.useState('all');
  const [sel, setSel] = React.useState(null);
  const [open, setOpen] = React.useState(false);

  const openRef = (r) => { setSel(r); requestAnimationFrame(() => requestAnimationFrame(() => setOpen(true))); };
  const closeRef = () => setOpen(false);

  // received-first ordering so the action queue sits on top
  const order = { received: 0, asked: 1, converted: 2 };
  const all = [...D.referrals].sort((a, b) => order[a.status] - order[b.status]);
  const items = filter === 'all' ? all : all.filter(r => r.status === filter);

  const chips = [
    { k: 'all', label: 'All', count: all.length },
    { k: 'received', label: 'Received', count: D.referrals.filter(r => r.status === 'received').length },
    { k: 'asked', label: 'Asked', count: D.referrals.filter(r => r.status === 'asked').length },
    { k: 'converted', label: 'Converted', count: D.referrals.filter(r => r.status === 'converted').length },
  ];

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <MobRecede open={open}>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
          {/* top bar */}
          <div style={{ flexShrink: 0, background: 'var(--bg)', borderBottom: '1px solid var(--line)' }}>
            <div className="row" style={{ gap: 10, padding: '12px 14px 6px', justifyContent: 'space-between' }}>
              <button onClick={onBack} style={{ width: 38, height: 38, borderRadius: 'var(--r-pill)', flexShrink: 0, border: 'none', cursor: 'pointer', background: 'var(--surface)', boxShadow: 'var(--sh-raised-crisp)', color: 'var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ display: 'flex', transform: 'rotate(180deg)' }}><IconChev size={16} /></span>
              </button>
              <IconBtn Ic={IconBell} dot />
            </div>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-end', padding: '0 18px 14px' }}>
              <span className="serif" style={{ fontSize: 34, color: 'var(--ink)', letterSpacing: '-0.02em' }}>Referrals</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'var(--mono)', fontSize: 8.5, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: config.enabled ? 'var(--good)' : 'var(--mute)', background: config.enabled ? 'rgba(31,138,91,0.10)' : 'var(--bg-2)', borderRadius: 'var(--r-pill)', padding: '5px 10px' }}>
                <IconGift size={12} />Ask {config.enabled ? 'On' : 'Off'}
              </span>
            </div>
          </div>

          {/* scroll body */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '14px 14px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <MRFunnel kpis={D.kpis} />

            <div style={{ background: 'var(--wine-tint)', borderRadius: 'var(--r-surface)', padding: '11px 13px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ color: 'var(--wine)', display: 'flex', marginTop: 1, flexShrink: 0 }}><IconGift size={15} /></span>
              <span style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--ink-soft)' }}>The engine handles <strong>asked → received</strong>. You take it from <strong>received → converted</strong>.</span>
            </div>

            {/* filter chips */}
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 2 }}>
              {chips.map(c => {
                const on = c.k === filter;
                return (
                  <button key={c.k} onClick={() => setFilter(c.k)} style={{
                    flexShrink: 0, display: 'flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 'var(--r-pill)', border: 'none', cursor: 'pointer',
                    background: on ? 'var(--wine)' : 'var(--surface)', boxShadow: on ? 'none' : 'var(--sh-raised-crisp)',
                    color: on ? 'var(--paper)' : 'var(--ink-soft)', fontSize: 12.5, fontWeight: on ? 700 : 500,
                  }}>
                    {c.label}
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 9, fontWeight: 700, color: on ? 'var(--paper)' : 'var(--mute-2)', background: on ? 'rgba(255,255,255,0.18)' : 'var(--bg-2)', borderRadius: 'var(--r-pill)', padding: '1px 7px' }}>{c.count}</span>
                  </button>
                );
              })}
            </div>

            {/* list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {items.length === 0
                ? <div style={{ padding: '50px 20px', textAlign: 'center', fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--mute-2)' }}>Nothing here</div>
                : items.map(r => <MRRow key={r.id} r={r} onOpen={openRef} />)}
            </div>
          </div>
        </div>
      </MobRecede>

      <MobSheet open={open} onClose={closeRef}>
        {sel && <MRDetailBody r={sel} config={config} />}
      </MobSheet>
    </div>
  );
}

Object.assign(window, { MobReferralsScreen });
