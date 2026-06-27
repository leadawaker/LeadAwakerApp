/* Shared components for Lead Awaker campaign stats redesign */

// ─── Icons (inline SVG, stroke 1.5) ─────────────────────────────────

const Icon = ({ d, size = 18, strokeWidth = 1.5, fill = 'none' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke="currentColor"
       strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    {d}
  </svg>
);

const IconCampaigns = (p) => <Icon {...p} d={<><path d="M3 11l16-5v12L3 13z"/><path d="M7 12v5a2 2 0 0 0 2 2"/></>} />;
const IconLeads     = (p) => <Icon {...p} d={<><circle cx="12" cy="8" r="3.5"/><path d="M5 20c1.5-3.5 4-5 7-5s5.5 1.5 7 5"/></>} />;
const IconChats     = (p) => <Icon {...p} d={<path d="M4 5h16v11H8l-4 4z"/>} />;
const IconCal       = (p) => <Icon {...p} d={<><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></>} />;
const IconGift      = (p) => <Icon {...p} d={<><rect x="4" y="9" width="16" height="11" rx="1.5"/><path d="M2.5 9h19M12 9v11M12 9c-1.6 0-4.2.2-5-1.3C6.3 6.4 8 5 9.1 6c1.4 1.2 2.9 3 2.9 3zM12 9c1.6 0 4.2.2 5-1.3.7-1.3-1-2.7-2.1-1.7C13.5 7.2 12 9 12 9z"/></>} />;
const IconProspect  = (p) => <Icon {...p} d={<><circle cx="9" cy="9" r="3.5"/><path d="M3 19c1-3 3.5-4.5 6-4.5s5 1.5 6 4.5"/><circle cx="17.5" cy="7" r="2"/><path d="M14 16c.6-1.7 2-2.5 3.5-2.5s2.7.6 3.5 1.6"/></>} />;
const IconCadence   = (p) => <Icon {...p} d={<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>} />;
const IconAccts     = (p) => <Icon {...p} d={<><circle cx="12" cy="8" r="3.5"/><path d="M5 20c1.5-3.5 4-5 7-5s5.5 1.5 7 5"/></>} />;
const IconBilling   = (p) => <Icon {...p} d={<><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 11h18"/></>} />;
const IconTasks     = (p) => <Icon {...p} d={<><path d="M4 7l3 3 5-6"/><path d="M4 14l3 3 5-6"/><path d="M13 9h7M13 17h7"/></>} />;
const IconLibrary   = (p) => <Icon {...p} d={<><path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h11"/></>} />;
const IconAuto      = (p) => <Icon {...p} d={<><path d="M3 12h4l3-8 4 16 3-8h4"/></>} />;
const IconSettings  = (p) => <Icon {...p} d={<><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.5-2.4.9a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.5a7 7 0 0 0-2 1.2L5 5.8l-2 3.5 2 1.5A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.5 2.4-.9a7 7 0 0 0 2 1.2L10 21h4l.5-2.5a7 7 0 0 0 2-1.2l2.4.9 2-3.5-2-1.5c0-.4.1-.8.1-1.2z"/></>} />;
const IconSearch    = (p) => <Icon {...p} d={<><circle cx="11" cy="11" r="6"/><path d="m20 20-3.5-3.5"/></>} />;
const IconFilter    = (p) => <Icon {...p} d={<path d="M4 5h16l-6 7v6l-4 2v-8z"/>} />;
const IconSort      = (p) => <Icon {...p} d={<><path d="M7 4v16M3 8l4-4 4 4"/><path d="M17 20V4M13 16l4 4 4-4"/></>} />;
const IconLayers    = (p) => <Icon {...p} d={<><path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5M3 18l9 5 9-5"/></>} />;
const IconMore      = (p) => <Icon {...p} d={<><circle cx="6" cy="12" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="18" cy="12" r="1.2" fill="currentColor"/></>} />;
const IconChev      = (p) => <Icon {...p} d={<path d="m9 6 6 6-6 6"/>} />;
const IconWA        = (p) => <Icon {...p} d={<><path d="M20 12a8 8 0 1 1-3.5-6.6L20 4l-1.4 3.4A8 8 0 0 1 20 12z"/><path d="M8.5 9.5c.5 2 1.5 3.5 3 4.5l1.5-1 2 1.5c-1 1.5-3 1.5-4.5.5s-3-2.5-3.5-4.5z"/></>} />;
const IconPhone     = (p) => <Icon {...p} d={<path d="M5 4h3l2 5-2.5 1.5a11 11 0 0 0 6 6L15 14l5 2v3a2 2 0 0 1-2 2A15 15 0 0 1 3 6a2 2 0 0 1 2-2z"/>} />;
const IconSpark     = (p) => <Icon {...p} d={<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>} />;
const IconBell      = (p) => <Icon {...p} d={<><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 21a2 2 0 0 0 4 0"/></>} />;
const IconHelp      = (p) => <Icon {...p} d={<><circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 0 1 5 0c0 1.5-2.5 2-2.5 4"/><circle cx="12" cy="17" r=".8" fill="currentColor"/></>} />;
const IconHeadset   = (p) => <Icon {...p} d={<><path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="3" y="14" width="4" height="6" rx="1.5"/><rect x="17" y="14" width="4" height="6" rx="1.5"/></>} />;
const IconMoon      = (p) => <Icon {...p} d={<path d="M20 14A8 8 0 1 1 10 4a7 7 0 0 0 10 10z"/>} />;
const IconDoc       = (p) => <Icon {...p} d={<><path d="M6 3h9l4 4v14H6z"/><path d="M15 3v5h4M9 13h7M9 17h7"/></>} />;
const IconBox       = (p) => <Icon {...p} d={<><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M3 9h18"/></>} />;
const IconUp        = (p) => <Icon {...p} d={<path d="m6 15 6-6 6 6"/>} />;
const IconActivity  = (p) => <Icon {...p} d={<path d="M3 12h4l3-8 4 16 3-8h4"/>} />;
const IconBump      = (p) => <Icon {...p} d={<><path d="M3 19l4-4 4 4 4-8 4 4 2-2"/><circle cx="3" cy="19" r="1" fill="currentColor"/></>} />;
const IconCheck     = (p) => <Icon {...p} d={<path d="m5 12 5 5 9-12"/>} />;
const IconLogout    = (p) => <Icon {...p} d={<><path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4"/><path d="M9 12h11M16 8l4 4-4 4"/></>} />;
const IconSwap      = (p) => <Icon {...p} d={<><path d="M7 4 3 8l4 4"/><path d="M3 8h13a4 4 0 0 1 4 4M17 20l4-4-4-4"/><path d="M21 16H8a4 4 0 0 1-4-4"/></>} />;
const IconPlus      = (p) => <Icon {...p} d={<path d="M12 5v14M5 12h14"/>} />;
const IconStar      = (p) => <Icon {...p} d={<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>} />;

// ─── Logo ──────────────────────────────────────────────────────────

function Logo({ size = 24 }) {
  return (
    <div className="row" style={{ gap: 10 }}>
      <div style={{
        width: size + 8, height: size + 8, borderRadius: 'var(--r-button)',
        background: 'linear-gradient(145deg, #2A2218, #14110D)',
        boxShadow: 'var(--sh-raised-crisp)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--paper)',
        fontFamily: '"Yeseva One", serif',
        fontSize: size * 0.7,
        lineHeight: 1,
        paddingBottom: 2,
      }}>A</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
        <span style={{ fontFamily: '"Yeseva One", serif', fontSize: size * 0.8, color: 'var(--ink)', letterSpacing: '-0.01em' }}>LEAD</span>
        <span style={{ fontFamily: 'var(--sans)', fontSize: size * 0.7, color: 'var(--ink)', fontWeight: 400 }}>Awaker</span>
        <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--wine)', marginLeft: 2, transform: 'translateY(-3px)' }} />
      </div>
    </div>
  );
}

// ─── Status pill ───────────────────────────────────────────────────

function StatusPill({ status }) {
  const map = { paused: 'paused', active: 'active-s', inactive: 'inactive' };
  const label = status === 'active' ? 'Active' : status === 'paused' ? 'Paused' : 'Inactive';
  return (
    <span className={`la-status ${map[status]}`}>
      <span className="dot" />{label}
    </span>
  );
}

// ─── Channel chip ──────────────────────────────────────────────────

function ChannelChip({ ch }) {
  const Ic = ch === 'Call' ? IconPhone : ch === 'AI Handoff' ? IconSpark : IconWA;
  return (
    <span className="row" style={{ gap: 6, fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--mute)' }}>
      <Ic size={12} />{ch}
    </span>
  );
}

// ─── Header bar ────────────────────────────────────────────────────

function HeaderBar() {
  return (
    <div className="row" style={{
      height: 64,
      padding: '0 28px',
      borderBottom: '1px solid var(--line)',
      background: 'var(--bg)',
      justifyContent: 'space-between',
      gap: 24,
    }}>
      <div className="row" style={{ gap: 28 }}>
        <Logo size={22} />
        <div className="divider-v" style={{ height: 28, alignSelf: 'center' }} />
        <span className="row" style={{ gap: 6, fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--mute)' }}>
          Agency View <IconChev size={12} />
        </span>
      </div>
      <div className="row" style={{ gap: 18 }}>
        <span className="row" style={{ gap: 8, fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--mute)' }}>
          Campaigns <span style={{ color: 'var(--mute-2)' }}>/</span> <span style={{ color: 'var(--ink)' }}>Leads Frios — Google Ads</span>
        </span>
        <div className="row" style={{ gap: 8 }}>
          {[IconSearch, IconMoon, IconHeadset, IconBox, IconHelp].map((Ic, i) => (
            <button key={i} className="btn-ghost" style={{ padding: 8, borderRadius: 'var(--r-pill)', border: '1px solid var(--line)', background: 'var(--surface)', boxShadow: 'var(--sh-raised-crisp)' }}>
              <Ic size={16} />
            </button>
          ))}
          <button className="btn-ghost" style={{ padding: 8, borderRadius: 'var(--r-pill)', border: '1px solid var(--line)', background: 'var(--surface)', boxShadow: 'var(--sh-raised-crisp)', position: 'relative' }}>
            <IconBell size={16} />
            <span style={{ position: 'absolute', top: 4, right: 4, width: 6, height: 6, background: 'var(--wine)', borderRadius: '50%' }} />
          </button>
          <div style={{
            width: 36, height: 36, borderRadius: 'var(--r-pill)',
            background: 'linear-gradient(145deg, #8a6e4a, #5a4530)',
            boxShadow: 'var(--sh-raised-crisp)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--paper)', fontFamily: 'var(--serif)', fontSize: 14,
          }}>RD</div>
        </div>
      </div>
    </div>
  );
}

// ─── Sidebar nav ───────────────────────────────────────────────────

function Sidebar({ width = 214, active = 'Campaigns', badges = {} }) {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const items = [
    { section: 'Menu', list: [{ label: 'Campaigns', Ic: IconCampaigns }] },
    { section: 'Engage', list: [
      { label: 'Leads', Ic: IconLeads },
      { label: 'Chats', Ic: IconChats },
      { label: 'Reputation', Ic: IconStar },
      { label: 'Referrals', Ic: IconGift },
      { label: 'Calendar', Ic: IconCal },
    ]},
    { section: 'Outreach', list: [
      { label: 'Prospects', Ic: IconProspect },
      { label: 'Cadence', Ic: IconCadence },
    ]},
    { section: 'Admin', list: [
      { label: 'Accounts', Ic: IconAccts },
      { label: 'Billing', Ic: IconBilling },
      { label: 'Tasks', Ic: IconTasks },
    ]},
    { section: 'Backend', list: [
      { label: 'Prompt Library', Ic: IconLibrary },
      { label: 'Automations', Ic: IconAuto },
    ]},
  ];
  const utils = [
    { Ic: IconSearch, label: 'Search' },
    { Ic: IconBell,   label: 'Notifications', dot: true },
    { Ic: IconMoon,   label: 'Theme' },
    { Ic: IconHelp,   label: 'Help' },
    { Ic: IconHeadset,label: 'Support' },
  ];
  return (
    <div style={{
      width,
      background: 'var(--bg-2)',
      borderRight: '1px solid var(--line)',
      display: 'flex', flexDirection: 'column',
      height: '100%', flexShrink: 0,
    }}>
      {/* ── Top: brand (fixed 60px to align with page toolbar divider) ── */}
      <div style={{ height: 60, flexShrink: 0, padding: '0 16px', display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--line)' }}>
        <Logo size={19} />
      </div>

      {/* ── Nav (scrolls) ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 12px', display: 'flex', flexDirection: 'column', gap: 3 }}>
        <button className="la-switcher" style={{ marginBottom: 12 }}>
          <span className="row" style={{ gap: 8 }}>
            <IconSwap size={13} />
            <span>Agency View</span>
          </span>
          <span style={{ display: 'flex', transform: 'rotate(90deg)', color: 'var(--mute-2)' }}><IconChev size={12} /></span>
        </button>
        {items.map((g, gi) => (
          <React.Fragment key={gi}>
            <div className="la-nav-section">{g.section}</div>
            {g.list.map((it, i) => (
              <div key={i} className={`la-nav-item ${it.label === active ? 'active' : ''}`}>
                <span className="icon"><it.Ic size={16} /></span>{it.label}
                {badges[it.label] != null && (
                  <span style={{
                    marginLeft: 'auto', fontFamily: 'var(--mono)', fontSize: 9, fontWeight: 700,
                    minWidth: 18, height: 18, padding: '0 5px', borderRadius: 'var(--r-pill)',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    background: 'var(--wine-grad)', color: 'var(--paper)',
                    boxShadow: 'var(--sh-raised-crisp)',
                  }}>{badges[it.label]}</span>
                )}
              </div>
            ))}
          </React.Fragment>
        ))}
      </div>

      {/* ── Bottom: utilities + profile ── */}
      <div style={{ padding: '12px 12px 14px', borderTop: '1px solid var(--line)' }}>
        <div className="la-util-row">
          {utils.map((u, i) => (
            <button key={i} className="la-util-btn" title={u.label}>
              <u.Ic size={15} />
              {u.dot && <span className="la-util-dot" />}
            </button>
          ))}
        </div>

        <div style={{ position: 'relative', marginTop: 10 }}>
          {menuOpen && (
            <div className="la-profile-menu">
              <button className="la-profile-menu-item"><IconSettings size={14} />Settings</button>
              <button className="la-profile-menu-item"><IconAccts size={14} />Account</button>
              <button className="la-profile-menu-item"><IconHelp size={14} />Help &amp; docs</button>
              <div className="rule" style={{ margin: '6px 8px' }} />
              <button className="la-profile-menu-item"><IconLogout size={14} />Sign out</button>
            </div>
          )}
          <button className={`la-profile ${menuOpen ? 'open' : ''}`} onClick={() => setMenuOpen(o => !o)}>
            <span className="la-profile-av">RD</span>
            <span style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
              <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Ricardo D.</span>
              <span style={{ display: 'block', fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--mute-2)' }}>Agency Admin</span>
            </span>
            <span style={{ display: 'flex', transform: menuOpen ? 'rotate(-90deg)' : 'rotate(90deg)', transition: 'transform 160ms', color: 'var(--mute-2)' }}><IconChev size={12} /></span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Campaign list ─────────────────────────────────────────────────

function CampaignList({ width = 300, tab, setTab }) {
  const D = window.LA_DATA;
  const active   = D.campaigns.filter((c) => c.section === 'active');
  const inactive = D.campaigns.filter((c) => c.section === 'inactive');

  return (
    <div style={{
      width, flexShrink: 0, padding: '0 16px',
      display: 'flex', flexDirection: 'column',
      height: '100%', overflow: 'hidden',
      borderRight: '1px solid var(--line)',
    }}>

      {/* ── Active label ── */}
      <div className="row" style={{ gap: 8, padding: '0 4px 2px', flexShrink: 0 }}>
        <span className="eyebrow eyebrow-sm">Active — {active.length}</span>
        <div className="rule" style={{ flex: 1 }} />
      </div>

      {/* ── Scrolling list ── */}
      <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, flex: 1, paddingRight: 4, marginRight: -4, marginTop: 8 }}>
        {active.map((c) => <CampaignCard key={c.id} c={c} />)}
        <div className="row" style={{ gap: 10, padding: '12px 0 6px' }}>
          <div className="rule" style={{ flex: 1 }} />
          <span className="eyebrow eyebrow-sm">Inactive — {inactive.length}</span>
          <div className="rule" style={{ flex: 1 }} />
        </div>
        {inactive.map((c) => <CampaignCard key={c.id} c={c} />)}
      </div>
    </div>
  );
}

function CampaignCard({ c }) {
  return (
    <div className={`la-camp-card ${c.active ? 'active' : ''}`}>
      <div className={`la-mono-tile ${c.active ? 'wine' : c.status === 'inactive' ? 'inactive' : ''}`}>{c.mono}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 4 }}>{c.name}</div>
        <div className="row" style={{ gap: 8, marginBottom: 6 }}>
          <StatusPill status={c.status} />
          <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--mute-2)', letterSpacing: '0.1em' }}>#{c.id}</span>
        </div>
        <div className="row" style={{ gap: 5, fontSize: 11, color: 'var(--mute)' }}>
          <span style={{ display: 'inline-block', width: 4, height: 4, borderRadius: '50%', background: 'var(--mute-2)' }} />
          {c.client}
        </div>
      </div>
    </div>
  );
}

// ─── Active campaign meta strip ────────────────────────────────────

function CampaignMeta({ compact = false }) {
  const D = window.LA_DATA.active;
  return (
    <div className="row" style={{ gap: compact ? 24 : 36, flexWrap: 'wrap' }}>
      <Meta label="Channel" value={<span className="row" style={{ gap: 6 }}><IconWA size={14} />{D.channel}</span>} />
      <Meta label="Daily Limit" value={D.dailyLimit} />
      <Meta label="Active Hours" value={D.activeHours} />
      <Meta label="Owner" value={
        <span className="row" style={{ gap: 8 }}>
          <span style={{
            width: 24, height: 24, borderRadius: 'var(--r-flush)',
            background: 'linear-gradient(145deg, #8a6e4a, #5a4530)',
            color: 'var(--paper)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, fontFamily: 'var(--mono)', letterSpacing: '0.06em',
          }}>{D.ownerInit}</span>
          {D.owner}
        </span>
      } />
    </div>
  );
}

function Meta({ label, value }) {
  return (
    <div>
      <div className="eyebrow eyebrow-sm">{label}</div>
      <div style={{ fontSize: 13, color: 'var(--ink)', marginTop: 4 }}>{value}</div>
    </div>
  );
}

// ─── Pipeline donut + bars ─────────────────────────────────────────

function PipelineDonut({ size = 220, thickness = 30, hoveredStage, onHoverStage }) {
  const D = window.LA_DATA.pipeline;
  const r = (size - thickness) / 2;
  const cx = size / 2, cy = size / 2;
  const c = 2 * Math.PI * r;
  const visible = D.stages.filter((s) => s.pct > 0);
  let offset = 0;
  const hovered = hoveredStage ? D.stages.find(s => s.key === hoveredStage) : null;
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', cursor: 'pointer' }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--bg)" strokeWidth={thickness} />
        {visible.map((s) => {
          const len = (s.pct / 100) * c;
          const isActive = hoveredStage === s.key;
          const dimmed  = hoveredStage && !isActive;
          const seg = (
            <circle key={s.key} cx={cx} cy={cy} r={r} fill="none"
              stroke={s.color}
              strokeWidth={isActive ? thickness + 5 : thickness}
              strokeDasharray={`${len} ${c - len}`}
              strokeDashoffset={-offset}
              strokeLinecap="butt"
              opacity={dimmed ? 0.22 : 1}
              style={{ transition: 'opacity 140ms, stroke-width 140ms' }}
              onMouseEnter={() => onHoverStage && onHoverStage(s.key)}
              onMouseLeave={() => onHoverStage && onHoverStage(null)}
            />
          );
          offset += len + 2;
          return seg;
        })}
      </svg>
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        transition: 'all 140ms',
      }}>
        {hovered ? (
          <>
            <div className="eyebrow eyebrow-sm" style={{ color: hovered.color }}>{hovered.label}</div>
            <div className="serif" style={{ fontSize: 52, color: 'var(--ink)', lineHeight: 1, marginTop: 4 }}>{hovered.count}</div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--mute)', marginTop: 3 }}>{hovered.pct}%</div>
          </>
        ) : (
          <>
            <div className="eyebrow eyebrow-sm">Total Leads</div>
            <div className="serif" style={{ fontSize: 56, color: 'var(--ink)', lineHeight: 1, marginTop: 4 }}>{D.total}</div>
          </>
        )}
      </div>
    </div>
  );
}

function PipelineBars({ compact = false, hoveredStage, onHoverStage }) {
  const D = window.LA_DATA.pipeline;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? 8 : 10, width: '100%' }}>
      {D.stages.map((s) => {
        const isActive = hoveredStage === s.key;
        const dimmed   = hoveredStage && !isActive;
        return (
          <div key={s.key}
            onMouseEnter={() => onHoverStage && onHoverStage(s.key)}
            onMouseLeave={() => onHoverStage && onHoverStage(null)}
            style={{
              borderRadius: 'var(--r-surface)',
              cursor: 'default',
              opacity: dimmed ? 0.25 : 1,
              transition: 'opacity 140ms, box-shadow 140ms',
              ...(s.star ? {
                background: 'var(--warn-tint)',
                padding: '7px 10px',
                margin: '2px -10px',
                boxShadow: isActive
                  ? `inset 0 0 0 1.5px ${s.color}`
                  : 'inset 0 0 0 1px rgba(196,138,47,0.28)',
              } : {
                padding: '3px 6px',
                margin: '0 -6px',
                boxShadow: isActive ? `inset 0 0 0 1.5px ${s.color}55` : 'none',
                background: isActive ? `${s.color}0f` : 'transparent',
              }),
            }}>
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: 4 }}>
              <span className="row" style={{ gap: 8, fontSize: 12, color: s.star ? 'var(--ink)' : 'var(--ink-soft)', fontWeight: s.star ? 700 : 400 }}>
                <span className="dot" style={{ background: s.color }} />{s.label}
                {s.star && <span style={{ fontFamily: 'var(--mono)', fontSize: 8, letterSpacing: '0.14em', color: s.color, border: `1px solid ${s.color}`, borderRadius: 4, padding: '1px 5px' }}>★ NORTH STAR</span>}
              </span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: s.star ? 'var(--ink)' : 'var(--mute)', fontWeight: s.star ? 700 : 400 }}>{s.count}</span>
            </div>
            <div style={{ height: s.star ? 10 : 8, background: 'var(--bg)', boxShadow: 'var(--sh-inset-crisp)', borderRadius: 'var(--r-pill)', overflow: 'hidden' }}>
              <div style={{ width: `${s.pct}%`, height: '100%', background: s.color, borderRadius: 'var(--r-pill)', transition: 'width 400ms' }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Key Metric card ───────────────────────────────────────────────

function MetricCard({ label, value, suffix, accent, delta }) {
  return (
    <div className="neu-raised" style={{ padding: 22, borderRadius: 'var(--r-card)', position: 'relative', overflow: 'hidden' }}>
      {accent && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: accent }} />
      )}
      <div className="eyebrow eyebrow-sm">{label}</div>
      <div className="row" style={{ alignItems: 'baseline', gap: 6, marginTop: 10 }}>
        <span className="serif" style={{ fontSize: 44, color: 'var(--ink)', lineHeight: 1 }}>{value}</span>
        {suffix && <span style={{ fontSize: 18, color: 'var(--mute)' }}>{suffix}</span>}
      </div>
      {delta && (
        <div className="row" style={{ gap: 4, marginTop: 8, fontSize: 11, color: delta.startsWith('+') ? 'var(--good)' : delta.startsWith('-') ? 'var(--wine)' : 'var(--mute)', fontFamily: 'var(--mono)', letterSpacing: '0.05em' }}>
          {delta}
        </div>
      )}
    </div>
  );
}

// ─── Performance trend (sparkline-style) ───────────────────────────

function TrendChart({ height = 140, respPts: rProp, bookPts: bProp, axis: aProp }) {
  // hand-drawn line points — accept external data or fall back to defaults
  const respPts = rProp || [12, 15, 14, 17, 18, 16, 19, 22, 20, 18, 21, 23, 22, 24, 26, 25, 27, 28, 30, 28];
  const bookPts = bProp || [2,  3,  3,  5,  4,  6,  5,  7,  8,  7,  9,  10, 9,  11, 12, 11, 13, 14, 13, 15];
  const axisLabels = aProp || ['FEB 21', 'MAR 1', 'MAR 11', 'MAR 21'];
  const w = 100;
  const max = 32;
  const toPath = (arr) => arr.map((v, i) => {
    const x = (i / (arr.length - 1)) * w;
    const y = 100 - (v / max) * 100;
    return `${i === 0 ? 'M' : 'L'}${x},${y}`;
  }).join(' ');
  const toArea = (arr) => toPath(arr) + ` L${w},100 L0,100 Z`;

  return (
    <div style={{ width: '100%', height, position: 'relative' }}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" width="100%" height="100%">
        {[20, 40, 60, 80].map((y) => (
          <line key={y} x1="0" y1={y} x2="100" y2={y} stroke="var(--line)" strokeWidth="0.2" />
        ))}
        <path d={toArea(respPts)} fill="rgba(63,142,142,0.10)" />
        <path d={toPath(respPts)} fill="none" stroke="var(--stage-responded)" strokeWidth="0.8" vectorEffect="non-scaling-stroke" strokeLinecap="round" />
        <path d={toPath(bookPts)} fill="none" stroke="var(--wine)" strokeWidth="0.8" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeDasharray="0" />
      </svg>
      {/* axis */}
      <div className="row" style={{ justifyContent: 'space-between', marginTop: 4, fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--mute-2)', letterSpacing: '0.1em' }}>
        {axisLabels.map((l, i) => <span key={i}>{l}</span>)}
      </div>
    </div>
  );
}

// ─── Time-frame toggle (1D/7D/1M/Custom) ───────────────────────────

function TimeToggle({ value = '1M', onChange }) {
  const opts = ['1D', '7D', '1M'];
  return (
    <div className="la-seg la-seg--pill">
      {opts.map((o) => (
        <button key={o} onClick={() => onChange && onChange(o)} className={`la-seg-btn${value === o ? ' on' : ''}`}>{o}</button>
      ))}
      <button className="la-seg-btn"><IconCal size={12} />Custom</button>
    </div>
  );
}

// ─── Stats / Settings page tabs (shared by monitor + settings) ─────

function PageTabs({ tab, setTab }) {
  const opts = [['stats', 'Stats'], ['settings', 'Settings']];
  return (
    <div className="la-seg">
      {opts.map(([k, label]) => (
        <button key={k} onClick={() => setTab && setTab(k)} className={`la-seg-btn${tab === k ? ' on' : ''}`}>{label}</button>
      ))}
    </div>
  );
}

// ─── Section eyebrow + title ───────────────────────────────────────

function SectionHead({ eyebrow, title, action }) {
  return (
    <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 18 }}>
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <div className="serif" style={{ fontSize: 28, color: 'var(--ink-soft)', marginTop: eyebrow ? 4 : 0, lineHeight: 1.1 }}>{title}</div>
      </div>
      {action}
    </div>
  );
}

// Expose to other scripts
Object.assign(window, {
  Icon, IconCampaigns, IconLeads, IconChats, IconCal, IconGift, IconProspect, IconCadence,
  IconAccts, IconBilling, IconTasks, IconLibrary, IconAuto, IconSettings,
  IconSearch, IconFilter, IconSort, IconLayers, IconMore, IconChev,
  IconWA, IconPhone, IconSpark, IconBell, IconHelp, IconHeadset, IconMoon,
  IconDoc, IconBox, IconUp, IconActivity, IconBump, IconCheck, IconLogout, IconSwap, IconPlus, IconStar,
  Logo, StatusPill, ChannelChip, HeaderBar, Sidebar, CampaignList, CampaignCard,
  CampaignMeta, Meta, PipelineDonut, PipelineBars, MetricCard, TrendChart,
  TimeToggle, SectionHead, PageTabs,
});
