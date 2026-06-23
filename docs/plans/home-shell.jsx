/* Lead Awaker — Home Hub shared shell + primitives
   Depends on components.jsx (Icon, IconChev, IconSwap, IconPlus, etc.) */

// ─── Icon set specific to the Home hub ──────────────────────────────
const HOME_PATHS = {
  home:    <><path d="M4 11.5 12 4l8 7.5"/><path d="M6 10v9h12v-9"/><path d="M10 19v-5h4v5"/></>,
  refresh: <><path d="M4 12a8 8 0 0 1 13.7-5.6L20 8"/><path d="M20 4v4h-4"/><path d="M20 12a8 8 0 0 1-13.7 5.6L4 16"/><path d="M4 20v-4h4"/></>,
  star:    <path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 17l-5.2 2.7 1-5.9L3.5 9.7l5.9-.8z"/>,
  bolt:    <path d="M13 3 5 13h6l-1 8 8-10h-6z"/>,
  mail:    <><rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="m4 7 8 5 8-5"/></>,
  chat:    <path d="M4 5h16v11H8l-4 4z"/>,
  users:   <><circle cx="9" cy="9" r="3.2"/><path d="M3 19c1.2-3 3.6-4.4 6-4.4s4.8 1.4 6 4.4"/><circle cx="17.5" cy="7.5" r="2.2"/><path d="M15 15c.8-1.4 2.2-2 3.5-2s2.4.5 3.2 1.4"/></>,
  alert:   <><circle cx="12" cy="12" r="9"/><path d="M12 7.5v5"/><circle cx="12" cy="16" r=".7" fill="currentColor" stroke="none"/></>,
  handoff: <><circle cx="8" cy="8" r="3"/><path d="M2.5 19c.8-3 3-4.4 5.5-4.4 1.2 0 2.3.3 3.2.9"/><path d="M14 13h6m0 0-2.5-2.5M20 13l-2.5 2.5"/></>,
  clock:   <><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></>,
  send:    <><path d="M21 4 3 11l6 2.5L21 4z"/><path d="m9 13.5 2.5 6L21 4"/></>,
  import:  <><path d="M12 3v11m0 0 4-4m-4 4-4-4"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></>,
  phone:   <path d="M5 4h3l2 5-2.5 1.5a11 11 0 0 0 6 6L16 14l5 2v3a2 2 0 0 1-2 2A15 15 0 0 1 3 6a2 2 0 0 1 2-2z"/>,
  branch:  <><circle cx="6" cy="6" r="2.4"/><circle cx="6" cy="18" r="2.4"/><circle cx="18" cy="12" r="2.4"/><path d="M6 8.4v7.2M8.2 6.6c4 0 4 5.4 7.6 5.4M8.2 17.4c4 0 4-5.4 7.6-5.4"/></>,
  shield:  <><path d="M12 3 5 5.5v5c0 4.4 3 8 7 9.5 4-1.5 7-5.1 7-9.5v-5z"/></>,
  arrow:   <path d="M5 12h14m0 0-5-5m5 5-5 5"/>,
  trendUp: <><path d="M4 16 10 10l3 3 7-7"/><path d="M20 6v5h-5"/></>,
  trendDn: <><path d="M4 8 10 14l3-3 7 7"/><path d="M20 18v-5h-5"/></>,
  cal:     <><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M8 2v4M16 2v4"/></>,
  calbook: <><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M8 2v4M16 2v4"/><rect x="9.5" y="12" width="5" height="4" rx="0.8" fill="currentColor" stroke="none"/></>,
  plus:    <path d="M12 5v14M5 12h14"/>,
};
function HIcon({ name, size = 18, sw = 1.6 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
      {HOME_PATHS[name] || HOME_PATHS.home}
    </svg>
  );
}

// ─── Sparkline (soft area + line) ───────────────────────────────────
function Sparkline({ pts, color, w = 132, h = 46, fill = true, sw = 2, drawDelay = '0.28s', full = false, interactive = false, peak, suffix = '', dots = false }) {
  const n = pts.length;
  const toX = (i) => (i / (n - 1)) * w;
  const toY = (v) => h - 3 - v * (h - 8);
  const line = pts.map((v, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(v).toFixed(1)}`).join(' ');
  const area = `${line} L${w},${h} L0,${h} Z`;
  const gid = React.useMemo(() => 'sg' + Math.random().toString(36).slice(2, 8), []);
  const [hi, setHi] = React.useState(null);
  const lastV = pts[n - 1] || 1;
  const labelFor = (i) => {
    const d = new Date(2026, 4, 15);
    d.setDate(d.getDate() - (n - 1 - i));
    const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    let val = '';
    if (peak != null && !Number.isNaN(peak)) {
      const num = peak * (pts[i] / lastV);
      val = (peak % 1 === 0 ? Math.round(num) : num.toFixed(1)) + (suffix || '');
    }
    return { date, val };
  };
  const svg = (
    <svg width={full ? '100%' : w} height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio={full ? 'none' : 'xMidYMid meet'} style={{ display: 'block', overflow: 'visible', width: full ? '100%' : w }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {fill && <path className="spark-area" d={area} fill={`url(#${gid})`} style={{ animationDelay: drawDelay }} />}
      <path className="spark-draw" style={{ animationDelay: drawDelay }} d={line} fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      {/* last-point dot — always visible, no animation */}
      <circle cx={toX(n - 1)} cy={toY(pts[n - 1])} r={2.6} fill={color} />
      {dots && pts.slice(0, -1).map((v, i) => (
        <circle key={'pd' + i} cx={toX(i)} cy={toY(v)} r={1.9} fill={color} opacity={0.45} />
      ))}
      {interactive && hi != null && (
        <React.Fragment>
          <line x1={toX(hi)} y1={0} x2={toX(hi)} y2={h} stroke={color} strokeWidth={1} strokeDasharray="3 3" opacity={0.5} vectorEffect="non-scaling-stroke" />
          <circle cx={toX(hi)} cy={toY(pts[hi])} r={3.6} fill={color} stroke="var(--card)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
        </React.Fragment>
      )}
      {interactive && pts.map((v, i) => (
        <rect key={i} x={toX(i) - (w / n) / 2} y={0} width={w / n} height={h} fill="transparent" style={{ cursor: 'crosshair' }} onMouseEnter={() => setHi(i)} />
      ))}
    </svg>
  );
  if (!interactive) return svg;
  const lbl = hi != null ? labelFor(hi) : null;
  return (
    <div style={{ position: 'relative', width: full ? '100%' : w }} onMouseLeave={() => setHi(null)}>
      {svg}
      {lbl && (
        <div style={{ position: 'absolute', left: `${(toX(hi) / w) * 100}%`, bottom: 'calc(100% + 6px)', transform: 'translateX(-50%)', background: 'var(--ink)', color: 'var(--paper)', padding: '4px 8px', borderRadius: 'var(--r-flush)', fontFamily: 'var(--mono)', fontSize: 9.5, whiteSpace: 'nowrap', pointerEvents: 'none', boxShadow: 'var(--sh-raised-medium)', zIndex: 6 }}>
          <span style={{ opacity: 0.65 }}>{lbl.date}</span>{lbl.val ? <span style={{ fontWeight: 700 }}>{'  ' + lbl.val}</span> : null}
        </div>
      )}
    </div>
  );
}

// ─── Delta chip (trend pill) ────────────────────────────────────────
function Delta({ text, dir, color }) {
  // dir: up | down | good-down (improvement shown as down) | flat
  const good = dir === 'up' || dir === 'good-down';
  const col = color || (good ? 'var(--good)' : 'var(--stage-lost)');
  const arrow = (dir === 'up') ? 'trendUp' : (dir === 'down' || dir === 'good-down') ? 'trendDn' : 'trendUp';
  return (
    <span className="row" style={{
      gap: 5, alignSelf: 'flex-start',
      padding: '3px 9px 3px 7px', borderRadius: 'var(--r-pill)',
      background: 'transparent',
      color: col, fontFamily: 'var(--mono)', fontSize: 10.5, fontWeight: 600, letterSpacing: '0.02em',
    }}>
      <HIcon name={arrow} size={12} sw={2} />{text}
    </span>
  );
}

// ─── Pulse strip stat — daily metric (icon left · number above label) ───
function PulseStat({ s, divider }) {
  return (
    <div style={{
      flex: 1, minWidth: 0, display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 11,
      padding: '12px 16px', borderLeft: divider ? '1px solid var(--line)' : 'none',
    }}>
      <span style={{ color: 'var(--mute-2)', display: 'flex', flexShrink: 0 }}><HIcon name={s.icon} size={17} sw={1.6} /></span>
      <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <span className="serif" style={{ fontSize: 28, lineHeight: 1.05, color: 'var(--wine)', fontFamily: '"Playfair Display"' }}>{s.value}</span>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 8, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--mute)', lineHeight: 1.3, whiteSpace: 'nowrap', marginTop: 2 }}>{s.label}</span>
      </div>
    </div>
  );
}

function PulseStrip({ items }) {
  return (
    <div style={{ display: 'flex', background: 'var(--card)', boxShadow: 'var(--sh-raised-medium)', borderRadius: 'var(--r-card)', padding: '3px 2px' }}>
      {items.map((s, i) => <PulseStat key={s.key} s={s} divider={i > 0} />)}
    </div>
  );
}

// ─── Home sidebar — service-grouped nav ─────────────────────────────
function HomeSidebar({ active = 'Home', width = 259 }) {
  const D = window.HOME_DATA;
  const services = [
    { label: 'Reactivation',     icon: 'refresh' },
    { label: 'Reputation',       icon: 'star' },
    { label: 'Speed-to-Lead',    icon: 'bolt' },
    { label: 'Nurture Sequences', icon: 'mail' },
  ];
  const shared = [
    { label: 'Inbox', icon: 'chat', badge: 24 },
    { label: 'Contacts', icon: 'users' },
  ];
  const NavRow = ({ it, on }) => (
    <div className={`la-nav-item ${on ? 'active' : ''}`} style={{ borderRadius: 'var(--r-surface)', padding: '11px 14px', justifyContent: 'space-between' }}>
      <span className="row" style={{ gap: 12 }}>
        <span className="icon"><HIcon name={it.icon} size={17} /></span>{it.label}
      </span>
      {it.badge != null && (
        <span style={{
          fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 700, color: 'var(--paper)',
          background: 'var(--wine)', borderRadius: 'var(--r-pill)', padding: '2px 8px', lineHeight: 1.3,
        }}>{it.badge}</span>
      )}
    </div>
  );
  return (
    <div style={{ width, flexShrink: 0, background: 'var(--bg-2)', borderRight: '1px solid var(--line)', display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '22px 18px 6px' }}><Logo size={22} /></div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 14px', display: 'flex', flexDirection: 'column', gap: 3 }}>
        <NavRow it={{ label: 'Home', icon: 'home' }} on={active === 'Home'} />
        <div className="la-nav-section" style={{ paddingTop: 22 }}>Services</div>
        {services.map((it) => <NavRow key={it.label} it={it} on={active === it.label} />)}
        <div className="rule" style={{ margin: '14px 6px' }} />
        <div className="la-nav-section" style={{ paddingTop: 0 }}>Shared</div>
        {shared.map((it) => <NavRow key={it.label} it={it} on={active === it.label} />)}
      </div>
      <div style={{ padding: '12px 14px 16px', borderTop: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button className="la-switcher" style={{ padding: '10px 12px', borderRadius: 'var(--r-surface)' }}>
          <span className="row" style={{ gap: 9, minWidth: 0 }}>
            <span style={{ width: 24, height: 24, borderRadius: 'var(--r-flush)', flexShrink: 0, background: 'linear-gradient(145deg,#8a6e4a,#5a4530)', boxShadow: 'var(--sh-raised-crisp)' }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{D.account.name}</span>
          </span>
          <span style={{ display: 'flex', transform: 'rotate(90deg)', color: 'var(--mute-2)' }}><IconChev size={12} /></span>
        </button>
        <button className="la-profile">
          <span className="la-profile-av">{D.user.init}</span>
          <span style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
            <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{D.user.full}</span>
            <span style={{ display: 'block', fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--mute-2)' }}>{D.user.role}</span>
          </span>
          <IconMore size={16} />
        </button>
      </div>
    </div>
  );
}

// ─── Account switcher (page top-right) ──────────────────────────────
function AccountSwitcher() {
  const D = window.HOME_DATA;
  return (
    <button className="la-profile" style={{ width: 224, flexShrink: 0, padding: '7px 11px 7px 9px', gap: 10 }}>
      <span style={{ width: 28, height: 28, borderRadius: 'var(--r-button)', flexShrink: 0, background: 'linear-gradient(145deg,#8a6e4a,#5a4530)', boxShadow: 'var(--sh-raised-crisp)' }} />
      <span style={{ minWidth: 0, maxWidth: 150, textAlign: 'left' }}>
        <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{D.account.name}</span>
        <span style={{ display: 'block', fontFamily: 'var(--mono)', fontSize: 8.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--mute-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{D.account.kind}</span>
      </span>
      <span style={{ display: 'flex', transform: 'rotate(90deg)', color: 'var(--mute-2)' }}><IconChev size={12} /></span>
    </button>
  );
}

// ─── Needs-attention row (columnized, uniform action) ──────────────
function NeedsRow({ n, last }) {
  const sevBg = { red: 'var(--stage-lost)', orange: 'var(--warn)', yellow: 'var(--stage-qualified)' }[n.sev];
  return (
    <div className="home-needs-row row" style={{
      gap: 12, padding: '13px 8px', borderBottom: last ? 'none' : '1px solid var(--line)',
      borderRadius: 'var(--r-surface)', transition: 'background 120ms',
    }}>
      <span style={{
        width: 36, height: 36, flexShrink: 0, borderRadius: 'var(--r-surface)',
        background: sevBg, color: 'var(--paper)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: 'var(--sh-raised-crisp)',
      }}><HIcon name={n.icon} size={17} /></span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n.title}</div>
        <div className="row" style={{ gap: 6, marginTop: 3, fontSize: 12, color: 'var(--mute)', minWidth: 0 }}>
          <span style={{ color: 'var(--ink-soft)', fontWeight: 500, flexShrink: 0 }}>{n.who}</span>
          <span style={{ color: 'var(--mute-2)' }}>·</span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontStyle: n.snippet.startsWith('“') ? 'italic' : 'normal' }}>{n.snippet}</span>
        </div>
      </div>
      <div style={{ width: 96, flexShrink: 0, display: 'flex' }}>
        <span className="home-tag" style={{ color: SVC_COLOR[n.svc] || 'var(--mute)' }}>{n.svc}</span>
      </div>
      <span style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--mute-2)', whiteSpace: 'nowrap', width: 48, textAlign: 'left', flexShrink: 0 }}>{n.time}</span>
      <button className="la-btn la-btn--soft" style={{ flexShrink: 0, width: 92, justifyContent: 'center' }}>{n.action}</button>
    </div>
  );
}

// ─── Activity row ───────────────────────────────────────────────────
const SVC_COLOR = { Reputation: 'oklch(55% 0.17 295)', Reactivation: 'var(--warn)', 'Speed-to-Lead': 'oklch(50% 0.19 242)', Nurture: 'var(--stage-new)' };
const SVC_ICON  = { Reputation: 'star', Reactivation: 'refresh', 'Speed-to-Lead': 'bolt', Nurture: 'mail' };
function ActivityRow({ a, last, grow }) {
  return (
    <div className="home-act-row row" style={{ gap: 13, padding: '12px 8px', borderBottom: last ? 'none' : '1px solid var(--line)', borderRadius: 'var(--r-surface)', ...(grow ? { flex: 1, minHeight: 0 } : {}) }}>
      <span style={{
        width: 34, height: 34, flexShrink: 0, borderRadius: 'var(--r-surface)',
        background: 'var(--surface)', boxShadow: 'var(--sh-inset-crisp)', color: SVC_COLOR[a.svc] || 'var(--mute)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}><HIcon name={a.icon} size={16} /></span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.title}</div>
        <div style={{ fontSize: 12, color: 'var(--mute)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.meta}</div>
      </div>
      <div style={{ width: 100, flexShrink: 0, display: 'flex' }}>
        <span className="home-tag" style={{ color: SVC_COLOR[a.svc] || 'var(--mute)' }}>{a.svc}</span>
      </div>
      <span style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--mute-2)', whiteSpace: 'nowrap', width: 50, textAlign: 'right', flexShrink: 0 }}>{a.time}</span>
    </div>
  );
}

// ─── Quick action tile ──────────────────────────────────────────────
function QuickAction({ q }) {
  return (
    <button className="home-quick" style={{
      flex: 1, border: 'none', cursor: 'pointer', background: 'var(--card)', boxShadow: 'var(--sh-raised-crisp)',
      borderRadius: 'var(--r-card)', padding: '24px 16px', display: 'flex', flexDirection: 'column',
      alignItems: 'center', gap: 12, transition: 'transform 120ms, box-shadow 120ms',
    }}>
      <span style={{ color: 'var(--wine)' }}><HIcon name={q.icon} size={26} sw={1.5} /></span>
      <span style={{ fontFamily: 'var(--sans)', fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{q.label}</span>
    </button>
  );
}

// ─── Upsell tile (locked service) ───────────────────────────────────
function UpsellTile({ u }) {
  return (
    <div className="home-upsell" style={{
      flex: 1, minWidth: 0, borderRadius: 'var(--r-card)', padding: '20px 22px',
      background: 'transparent', border: '1.5px dashed var(--wine-glow)',
      display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      <div className="row" style={{ gap: 12 }}>
        <span style={{ width: 38, height: 38, flexShrink: 0, borderRadius: 'var(--r-surface)', background: 'var(--wine-tint)', color: 'var(--wine)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <HIcon name={u.icon} size={19} />
        </span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 19, color: 'var(--ink-soft)', lineHeight: 1.1 }}>{u.name}</div>
          <div style={{ fontSize: 12.5, color: 'var(--mute)', marginTop: 3 }}>{u.blurb}</div>
        </div>
      </div>
      <button className="la-btn la-btn--soft" style={{ alignSelf: 'flex-start', color: 'var(--wine)' }}>
        Add this service <HIcon name="arrow" size={13} sw={2} />
      </button>
    </div>
  );
}

Object.assign(window, {
  HIcon, Sparkline, Delta, PulseStat, PulseStrip, HomeSidebar, AccountSwitcher,
  NeedsRow, ActivityRow, QuickAction, UpsellTile, SVC_COLOR,
});
