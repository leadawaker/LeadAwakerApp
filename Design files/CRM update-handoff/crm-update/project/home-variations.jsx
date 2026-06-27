/* Lead Awaker — Home Hub: three desktop layout variations.
   Each renders a full page (sidebar + content) for a design-canvas artboard. */

// ── Shared section label ────────────────────────────────────────────
function SectionLabel({ text, count, right, style }) {
  return (
    <div className="row" style={{ justifyContent: 'space-between', marginBottom: 16, ...style }}>
      <span className="row" style={{ gap: 10, alignItems: 'center' }}>
        <span className="serif" style={{ fontSize: 21, lineHeight: 1, color: 'var(--ink)', fontFamily: "\"Playfair Display\"", letterSpacing: '-0.01em' }}>{text}</span>
        {count != null &&
        <span style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700, color: 'var(--wine)', background: 'var(--wine-tint)', borderRadius: 'var(--r-pill)', padding: '2px 9px' }}>{count}</span>
        }
      </span>
      {right}
    </div>);

}

function Greeting({ size = 46, sub = "Here's what's happening across your services.", style }) {
  const D = window.HOME_DATA;
  return (
    <div style={{ flex: 1, minWidth: 0, ...style }}>
      <div className="eyebrow" style={{ fontSize: 11, letterSpacing: '0.22em' }}>{D.date}</div>
      <h1 className="serif" style={{ margin: '10px 0 0', fontSize: size, lineHeight: 1.02, color: 'var(--ink)', letterSpacing: '-0.015em', whiteSpace: 'nowrap', fontFamily: "\"Playfair Display\"" }}>
        Good morning, {D.user.first}.
      </h1>
      <p style={{ margin: '8px 0 0', fontSize: 15, color: 'var(--mute)' }}>{sub}</p>
    </div>);

}

const PAGE = { flex: 1, minWidth: 0, height: '100%', overflowY: 'auto', background: 'var(--bg)' };
const CARD = { background: 'var(--card)', boxShadow: 'var(--sh-raised-medium)', borderRadius: 'var(--r-card)', minWidth: 0 };

/* ════════════════════════════════════════════════════════════════════
   VARIANT A — COMMAND GRID  (faithful to the reference)
   4-up service grid · two-column triage+activity · quick actions + upsell
   ════════════════════════════════════════════════════════════════════ */
function ServiceCardA({ s }) {
  return (
    <div className="home-card" style={{ ...CARD, padding: 22, display: 'flex', flexDirection: 'column' }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div className="eyebrow" style={{ fontSize: 9.5 }}>{s.eyebrow}</div>
          <div className="serif" style={{ fontSize: 25, color: 'var(--ink)', marginTop: 4, lineHeight: 1.05 }}>{s.name}</div>
        </div>
        <span style={{ width: 38, height: 38, borderRadius: 'var(--r-pill)', flexShrink: 0, background: 'var(--surface)', boxShadow: 'var(--sh-raised-crisp)', color: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <HIcon name={s.icon} size={18} />
        </span>
      </div>
      <div className="eyebrow eyebrow-sm" style={{ marginTop: 18 }}>{s.northLabel}</div>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 4 }}>
        <div className="row" style={{ alignItems: 'baseline', gap: 3 }}>
          <span className="serif" style={{ fontSize: 52, lineHeight: 0.9, color: s.northAmber ? 'var(--warn)' : 'var(--ink)' }}>{s.northValue}</span>
          {s.northSuffix && <span className="serif" style={{ fontSize: 26, color: s.northAmber ? 'var(--warn)' : 'var(--mute)' }}>{s.northSuffix}</span>}
        </div>
        <Sparkline pts={s.spark} color={s.color} w={118} h={42} />
      </div>
      <div style={{ marginTop: 12 }}><Delta text={s.delta} dir={s.dir} /></div>
      <div className="rule" style={{ margin: '18px 0 14px' }} />
      <div className="row" style={{ gap: 20 }}>
        {s.support.map((sup) =>
        <div key={sup.label} style={{ flex: 1 }}>
            <div className="eyebrow eyebrow-sm">{sup.label}</div>
            <div style={{ fontSize: 19, fontWeight: 700, color: 'var(--ink-soft)', marginTop: 4 }}>{sup.value}</div>
          </div>
        )}
      </div>
      <button className="home-open row" style={{ marginTop: 16, alignSelf: 'flex-end', gap: 6, border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--wine)' }}>
        Open <HIcon name="arrow" size={14} sw={2} />
      </button>
    </div>);

}

function VariantA() {
  const D = window.HOME_DATA;
  return (
    <div className="la-app" style={{ display: 'flex', height: '100%' }}>
      <HomeSidebar active="Home" />
      <div style={PAGE}>
        <div style={{ maxWidth: 1386, margin: '0 auto', padding: '34px 40px 44px', display: 'flex', flexDirection: 'column', gap: 26 }}>
          {/* header */}
          <div className="row" style={{ alignItems: 'flex-start', justifyContent: 'space-between', gap: 32 }}>
            <Greeting size={46} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'flex-end', flexShrink: 0 }}>
              <AccountSwitcher />
              <div style={{ width: 480, maxWidth: '100%' }}><PulseStrip items={D.pulse} /></div>
            </div>
          </div>
          {/* service grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}>
            {D.services.map((s) => <ServiceCardA key={s.key} s={s} />)}
          </div>
          {/* triage + activity */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.32fr 1fr', gap: 20 }}>
            <div style={{ ...CARD, padding: '20px 18px' }}>
              <SectionLabel text="Needs Attention" count={D.needs.length} style={{ padding: '0 8px' }}
              right={<button className="la-btn la-btn--soft">View all</button>} />
              {D.needs.map((n, i) => <NeedsRow key={n.id} n={n} last={i === D.needs.length - 1} />)}
            </div>
            <div style={{ ...CARD, padding: '20px 18px' }}>
              <SectionLabel text="Recent Activity" style={{ padding: '0 8px' }}
              right={<span className="row" style={{ gap: 6, fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--mute)' }}>All services <IconChev size={11} /></span>} />
              {D.activity.map((a, i) => <ActivityRow key={a.id} a={a} last={i === D.activity.length - 1} />)}
            </div>
          </div>
          {/* quick actions + upsell */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: 20 }}>
            <div style={{ ...CARD, padding: '20px 22px' }}>
              <SectionLabel text="Quick Actions" />
              <div className="row" style={{ gap: 14, alignItems: 'stretch' }}>
                {D.quickActions.map((q) => <QuickAction key={q.key} q={q} />)}
              </div>
            </div>
            <div style={{ ...CARD, padding: '20px 22px' }}>
              <SectionLabel text="Add more power to your CRM" />
              <div className="row" style={{ gap: 16, alignItems: 'stretch' }}>
                {D.upsell.map((u) => <UpsellTile key={u.key} u={u} />)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>);

}

/* ════════════════════════════════════════════════════════════════════
   VARIANT B — TRIAGE-FIRST  (the action queue is the hero)
   wide Needs-Attention panel · compact service-health rail · activity below
   ════════════════════════════════════════════════════════════════════ */
function ServiceRowB({ s }) {
  return (
    <div className="home-srow row" style={{ gap: 14, padding: '14px 16px', borderRadius: 'var(--r-surface)', cursor: 'pointer', transition: 'background 120ms' }}>
      <span style={{ width: 40, height: 40, flexShrink: 0, borderRadius: 'var(--r-surface)', background: 'var(--surface)', boxShadow: 'var(--sh-raised-crisp)', color: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <HIcon name={s.icon} size={19} />
      </span>
      <div style={{ width: 132, flexShrink: 0 }}>
        <div style={{ fontFamily: 'var(--serif)', fontSize: 17, color: 'var(--ink)', lineHeight: 1.1 }}>{s.name}</div>
        <div className="eyebrow eyebrow-sm" style={{ marginTop: 3 }}>{s.northLabel}</div>
      </div>
      <div style={{ width: 92, flexShrink: 0 }}>
        <div className="row" style={{ alignItems: 'baseline', gap: 2 }}>
          <span className="serif" style={{ fontSize: 32, lineHeight: 0.9, color: s.northAmber ? 'var(--warn)' : 'var(--ink)' }}>{s.northValue}</span>
          {s.northSuffix && <span className="serif" style={{ fontSize: 17, color: 'var(--mute)' }}>{s.northSuffix}</span>}
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', justifyContent: 'center' }}><Sparkline pts={s.spark} color={s.color} w={120} h={40} /></div>
      <div style={{ flexShrink: 0 }}><Delta text={s.delta} dir={s.dir} /></div>
      <button className="la-btn la-btn--inset la-btn--icon la-btn--pill" style={{ flexShrink: 0 }}><HIcon name="arrow" size={15} sw={2} /></button>
    </div>);

}

function VariantB() {
  const D = window.HOME_DATA;
  return (
    <div className="la-app" style={{ display: 'flex', height: '100%' }}>
      <HomeSidebar active="Home" />
      <div style={PAGE}>
        <div style={{ maxWidth: 1386, margin: '0 auto', padding: '34px 40px 44px', display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 32 }}>
            <Greeting size={42} />
            <AccountSwitcher />
          </div>
          <PulseStrip items={D.pulse} />

          {/* hero split: triage queue (left) + service health rail (right) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 22, alignItems: 'start' }}>
            {/* TRIAGE — the hero */}
            <div style={{ ...CARD, padding: '24px 22px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, var(--stage-lost), var(--warn), var(--stage-qualified))' }} />
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 6 }}>
                <div>
                  <div className="eyebrow" style={{ color: 'var(--wine)' }}>Needs Attention</div>
                  <div className="serif" style={{ fontSize: 28, color: 'var(--ink)', marginTop: 4 }}>Your morning triage</div>
                </div>
                <span className="serif" style={{ fontSize: 44, color: 'var(--wine)', lineHeight: 0.9 }}>{D.needs.length}</span>
              </div>
              <div className="rule" style={{ margin: '4px 0 6px' }} />
              {D.needs.map((n, i) => <NeedsRow key={n.id} n={n} last={i === D.needs.length - 1} />)}
              <button className="la-btn la-btn--soft" style={{ marginTop: 14, marginLeft: 8 }}>View all {D.needs.length} items</button>
            </div>
            {/* SERVICE HEALTH rail */}
            <div style={{ ...CARD, padding: '20px 14px' }}>
              <SectionLabel text="Service Health" style={{ padding: '0 10px' }}
              right={<span className="row" style={{ gap: 5, fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--good)' }}><span className="dot" style={{ background: 'var(--good)' }} />All live</span>} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {D.services.map((s, i) =>
                <React.Fragment key={s.key}>
                    <ServiceRowB s={s} />
                    {i < D.services.length - 1 && <div className="rule" style={{ margin: '0 16px' }} />}
                  </React.Fragment>
                )}
              </div>
            </div>
          </div>

          {/* activity + quick actions */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 22, alignItems: 'start' }}>
            <div style={{ ...CARD, padding: '20px 18px' }}>
              <SectionLabel text="Recent Activity" style={{ padding: '0 8px' }}
              right={<button className="la-btn la-btn--soft">View all activity</button>} />
              {D.activity.map((a, i) => <ActivityRow key={a.id} a={a} last={i === D.activity.length - 1} />)}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
              <div style={{ ...CARD, padding: '20px 22px' }}>
                <SectionLabel text="Quick Actions" />
                <div className="row" style={{ gap: 12, alignItems: 'stretch' }}>
                  {D.quickActions.map((q) => <QuickAction key={q.key} q={q} />)}
                </div>
              </div>
              <div style={{ ...CARD, padding: '20px 22px' }}>
                <SectionLabel text="Add more power" />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {D.upsell.map((u) => <UpsellTile key={u.key} u={u} />)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>);

}

/* ════════════════════════════════════════════════════════════════════
   VARIANT C — EDITORIAL NORTH-STAR
   curvy hero band w/ inline pulse · big serif north-star strip · airy triage
   ════════════════════════════════════════════════════════════════════ */
function NorthStarCell({ s, numColorMode = 'black' }) {
  const open = () => {/* navigate to service page (prototype) */};
  const onKey = (e) => {if (e.key === 'Enter' || e.key === ' ') {e.preventDefault();open();}};
  const numColor = numColorMode === 'wine' ? 'var(--wine)' : numColorMode === 'service' ? s.color : 'var(--ink)';

  return (
    <div className="home-card" style={{ ...CARD, padding: 24, display: 'flex', flexDirection: 'column' }}>
      {/* Clickable header — mascot above the (large) title; no eyebrow, no badge */}
      <div className="home-nsopen" role="button" tabIndex={0} onClick={open} onKeyDown={onKey}
      title={`Open ${s.name}`} aria-label={`Open ${s.name}`}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', cursor: 'pointer', outline: 'none' }}>
        {s.mascot && <img className="ns-mascot" src={s.mascot} alt="" style={{ height: 152, width: 'auto', objectFit: 'contain', objectPosition: 'left bottom', display: 'block', marginBottom: 12 }} />}
        <div className="serif ns-name" style={{ fontSize: 28, color: 'var(--ink)', lineHeight: 1.04, letterSpacing: '-0.01em', fontFamily: "\"Playfair Display\"" }}>{s.name}</div>
      </div>

      {/* north-star description (no icon) */}
      <div className="eyebrow eyebrow-sm" style={{ color: 'var(--mute-2)', marginTop: 22 }}>{s.northLabel}</div>

      {/* big number + suffix + value icon (right, bottom-aligned) */}
      <div className="row" style={{ alignItems: 'flex-end', gap: 6, marginTop: 8 }}>
        <span className="serif" style={{ fontSize: 80, lineHeight: 0.78, color: numColor, letterSpacing: '-0.02em', fontFamily: "\"Playfair Display\"" }}>{s.northValue}</span>
        {s.northSuffix && <span className="serif" style={{ fontFamily: "\"Playfair Display\"", fontSize: 34, lineHeight: 1, color: s.color, paddingBottom: 4 }}>{s.northSuffix}</span>}
        {s.northValueIcon && <span style={{ color: s.color, display: 'flex', alignSelf: 'flex-end', paddingBottom: 6 }}><HIcon name={s.northValueIcon} size={28} sw={1.7} /></span>}
      </div>

      {/* trend vs recent */}
      <div style={{ marginTop: 10 }}><Delta text={s.delta} dir={s.dir} /></div>

      {/* sparkline underneath, full-width, per-day dots */}
      <div style={{ marginTop: 16 }}>
        <Sparkline pts={s.spark} color={s.color} w={260} h={62} sw={2} full dots interactive peak={parseFloat(s.northValue)} suffix={s.northSuffix || ''} />
      </div>

      {/* support metrics — number above label, vertical divider between */}
      <div className="row" style={{ justifyContent: 'flex-start', alignItems: 'stretch', gap: 18, marginTop: 16 }}>
        {s.support.map((sup, i) =>
        <React.Fragment key={sup.label}>
            {i > 0 && <div style={{ width: 1, background: 'var(--line)', alignSelf: 'stretch' }} />}
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 19, fontWeight: 700, color: 'var(--ink-soft)' }}>{sup.value}</div>
              <div className="eyebrow eyebrow-sm" style={{ fontSize: 9, whiteSpace: 'nowrap', marginTop: 4 }}>{sup.label}</div>
            </div>
          </React.Fragment>
        )}
      </div>

      {/* Open — raised card pinned to the bottom */}
      <button onClick={open} className="home-openbtn row" style={{
        marginTop: 'auto', width: '100%', justifyContent: 'center', gap: 8,
        border: 'none', cursor: 'pointer', background: 'var(--surface)', boxShadow: 'var(--sh-raised-crisp)',
        borderRadius: 'var(--r-card)', padding: '14px',
        fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--wine)',
        transition: 'transform 120ms, box-shadow 120ms'
      }}>Open <HIcon name="arrow" size={14} sw={2} /></button>
    </div>);

}

function NeedsCardC({ n }) {
  const sevBg = { red: 'var(--stage-lost)', orange: 'var(--warn)', yellow: 'var(--stage-qualified)' }[n.sev];
  const wine = n.action === 'Resolve' || n.action === 'Reply now';
  return (
    <div className="home-card" style={{ ...CARD, padding: '16px 18px', display: 'flex', gap: 14, alignItems: 'center', position: 'relative', overflow: 'hidden' }}>
      <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: sevBg }} />
      <span style={{ width: 40, height: 40, flexShrink: 0, borderRadius: 'var(--r-surface)', background: sevBg, color: 'var(--paper)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--sh-raised-crisp)' }}>
        <HIcon name={n.icon} size={18} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="row" style={{ gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{n.title}</span>
          <span className="home-tag" style={{ color: n.color }}>{n.svc}</span>
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--mute)', marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          <span style={{ color: 'var(--ink-soft)', fontWeight: 500 }}>{n.who}</span> · <span style={{ fontStyle: n.snippet.startsWith('“') ? 'italic' : 'normal' }}>{n.snippet}</span>
        </div>
      </div>
      <span style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--mute-2)', whiteSpace: 'nowrap' }}>{n.time}</span>
      <button className={`la-btn ${wine ? 'la-btn--wine' : 'la-btn--soft'}`} style={{ flexShrink: 0 }}>{n.action}</button>
    </div>);

}

function VariantC() {
  const D = window.HOME_DATA;
  return (
    <div className="la-app" style={{ display: 'flex', height: '100%' }}>
      <HomeSidebar active="Home" />
      <div style={PAGE}>
        <div style={{ maxWidth: 1386, margin: '0 auto', padding: '30px 36px 44px', display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* curvy editorial hero */}
          <div style={{
            borderRadius: 'var(--r-panel)', padding: '34px 38px', position: 'relative', overflow: 'hidden',
            background: 'radial-gradient(ellipse 55% 120% at 98% -10%, rgba(255,226,168,0.45), transparent 60%), radial-gradient(ellipse 40% 90% at 2% 120%, rgba(94,34,48,0.07), transparent 65%), var(--paper)',
            boxShadow: 'var(--sh-raised-large)'
          }}>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 32 }}>
              <Greeting size={50} />
              <AccountSwitcher />
            </div>
            <div className="rule" style={{ margin: '26px 0 18px' }} />
            <div className="row" style={{ gap: 0 }}>
              {D.pulse.map((s, i) => <PulseStat key={s.key} s={s} divider={i > 0} />)}
            </div>
          </div>

          {/* north-star strip */}
          <div style={{ ...CARD, padding: '26px 30px' }}>
            <SectionLabel text="Service North-Stars" style={{ marginBottom: 22 }}
            right={<span className="row" style={{ gap: 5, fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--good)' }}><span className="dot" style={{ background: 'var(--good)' }} />4 services live</span>} />
            <div className="row" style={{ alignItems: 'stretch', gap: 28 }}>
              {D.services.map((s, i) => <NorthStarCell key={s.key} s={s} divider={i > 0} />)}
            </div>
          </div>

          {/* airy triage list */}
          <div>
            <SectionLabel text="Needs Attention" count={D.needs.length}
            right={<button className="la-btn la-btn--soft">View all</button>} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {D.needs.map((n) => <NeedsCardC key={n.id} n={n} />)}
            </div>
          </div>

          {/* activity + actions */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 22, alignItems: 'start' }}>
            <div style={{ ...CARD, padding: '20px 18px' }}>
              <SectionLabel text="Recent Activity" style={{ padding: '0 8px' }} />
              {D.activity.map((a, i) => <ActivityRow key={a.id} a={a} last={i === D.activity.length - 1} />)}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
              <div style={{ ...CARD, padding: '20px 22px' }}>
                <SectionLabel text="Quick Actions" />
                <div className="row" style={{ gap: 12, alignItems: 'stretch' }}>
                  {D.quickActions.map((q) => <QuickAction key={q.key} q={q} />)}
                </div>
              </div>
              <div style={{ ...CARD, padding: '20px 22px' }}>
                <SectionLabel text="Add more power" />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {D.upsell.map((u) => <UpsellTile key={u.key} u={u} />)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>);

}

/* ════════════════════════════════════════════════════════════════════
   FINAL — Variation C hero + north-star strip · A-style triage + activity
   · "Add more power" (left) + Quick Actions (right)
   ════════════════════════════════════════════════════════════════════ */
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "numColor": "black"
} /*EDITMODE-END*/;

// Explore-services panel — sits as the 4th card beside the live services
function ExplorePanel() {
  const D = window.HOME_DATA;
  return (
    <div className="home-card" style={{
      borderRadius: 'var(--r-card)', padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center',
      background: 'transparent', border: '1.5px dashed var(--wine-glow)', minWidth: 0
    }}>
      <span style={{
        width: 56, height: 56, borderRadius: 'var(--r-pill)', flexShrink: 0,
        border: '1.5px dashed var(--wine)', color: 'var(--wine)',
        display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}><HIcon name="plus" size={24} sw={1.8} /></span>
      <div className="serif" style={{ fontSize: 24, color: 'var(--ink)', marginTop: 16, lineHeight: 1.1, letterSpacing: '-0.01em', fontFamily: "\"Playfair Display\"", textAlign: 'center' }}>Explore services</div>
      <p style={{ fontSize: 12.5, color: 'var(--mute)', margin: '8px 0 0', lineHeight: 1.5, textAlign: 'center' }}>Add more power to your CRM.</p>
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 16, marginTop: 'auto', paddingTop: 22 }}>
        {D.upsell.map((u) =>
        <div key={u.key} style={{ width: '100%' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{u.name}</div>
            <div style={{ fontSize: 11.5, color: 'var(--mute)', margin: '4px 0 10px', lineHeight: 1.4 }}>{u.blurb}</div>
            <button className="home-addbtn row" style={{
            width: '100%', gap: 8, padding: '9px 12px', borderRadius: 'var(--r-button)', cursor: 'pointer',
            border: '1px solid var(--wine)', background: 'transparent', color: 'var(--wine)',
            justifyContent: 'center', fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
            transition: 'background 120ms'
          }}>Add this service <HIcon name="arrow" size={13} sw={2} /></button>
          </div>
        )}
      </div>
    </div>);

}

function HomeHub() {
  const D = window.HOME_DATA;
  const cards = D.services.filter((s) => s.key !== 'nurture');
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [shown, setShown] = React.useState(false);
  React.useEffect(() => {const t = setTimeout(() => setShown(true), 40);return () => clearTimeout(t);}, []);
  return (
    <div className={`la-app home-stage ${shown ? 'shown' : ''}`} style={{ display: 'flex', height: '100%' }}>
      <HomeSidebar active="Home" />
      <div style={PAGE}>
        <div style={{ maxWidth: 1386, margin: '0 auto', padding: '30px 36px 44px', display: 'flex', flexDirection: 'column', gap: 22 }}>
          <div className="home-rise row" style={{ alignItems: 'flex-end', justifyContent: 'space-between', gap: 32, transitionDelay: '0s' }}>
            <Greeting size={46} />
            <div style={{ width: 624, maxWidth: '100%', flexShrink: 0 }}>
              <div className="eyebrow eyebrow-sm" style={{ color: 'var(--mute-2)', marginBottom: 8, marginLeft: 4 }}>Today</div>
              <PulseStrip items={D.pulse} />
            </div>
          </div>

          {/* service cards — one card per live service + Explore panel */}
          <div className="home-rise" style={{ display: 'grid', gridTemplateColumns: `repeat(${cards.length}, 1fr) 0.74fr`, gap: 20, transitionDelay: '0.1s' }}>
            {cards.map((s) => <NorthStarCell key={s.key} s={s} numColorMode={t.numColor} />)}
            <ExplorePanel />
          </div>

          {/* Needs Attention | Recent Activity — side by side, equal height */}
          <div className="home-rise" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'stretch', transitionDelay: '0.16s' }}>
            <div style={{ ...CARD, padding: '18px 16px', display: 'flex', flexDirection: 'column' }}>
              <SectionLabel text="Needs Attention" count={D.needs.length} style={{ padding: '0 8px' }}
              right={<button className="la-btn la-btn--soft">View all</button>} />
              {D.needs.map((n, i) => <NeedsRow key={n.id} n={n} last={i === D.needs.length - 1} />)}
            </div>
            <div style={{ ...CARD, padding: '18px 16px', display: 'flex', flexDirection: 'column' }}>
              <SectionLabel text="Recent Activity" style={{ padding: '0 8px' }}
              right={<span className="row" style={{ gap: 6, fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--mute)' }}>All services <IconChev size={11} /></span>} />
              {D.activity.map((a, i) => <ActivityRow key={a.id} a={a} last={i === D.activity.length - 1} />)}
            </div>
          </div>

          {/* Quick Actions — bottom row */}
          <div className="home-rise" style={{ ...CARD, padding: '18px 20px', transitionDelay: '0.22s' }}>
            <SectionLabel text="Quick Actions" />
            <div className="row" style={{ gap: 16, alignItems: 'stretch' }}>
              {D.quickActions.map((q) => <QuickAction key={q.key} q={q} />)}
            </div>
          </div>
        </div>
      </div>
      <TweaksPanel title="Tweaks">
        <TweakSection label="Service metrics" />
        <TweakRadio label="Number color" value={t.numColor}
        options={[{ value: 'black', label: 'Black' }, { value: 'wine', label: 'Wine' }, { value: 'service', label: 'Per service' }]}
        onChange={(v) => setTweak('numColor', v)} />
      </TweaksPanel>
    </div>);

}

Object.assign(window, { VariantA, VariantB, VariantC, HomeHub, SectionLabel, Greeting });