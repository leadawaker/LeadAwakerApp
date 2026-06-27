// accounts-components.jsx — shared building blocks for the Accounts page.
// Depends on: components.jsx (Icon, Logo, Sidebar, StatusPill, IconWA, IconChev,
// IconPlus, IconSearch, IconFilter, IconSort, IconLayers, IconMore...), design-system.css

// ─── Extra icons ────────────────────────────────────────────────────
const IconGlobe   = (p) => <Icon {...p} d={<><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.5 2.5 15 0 18M12 3c-2.5 2.5-2.5 15 0 18"/></>} />;
const IconMic     = (p) => <Icon {...p} d={<><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></>} />;
const IconLink    = (p) => <Icon {...p} d={<><path d="M9 15l6-6"/><path d="M11 7l1-1a4 4 0 0 1 6 6l-1 1M13 17l-1 1a4 4 0 0 1-6-6l1-1"/></>} />;
const IconCopy    = (p) => <Icon {...p} d={<><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/></>} />;
const IconEye     = (p) => <Icon {...p} d={<><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></>} />;
const IconFile    = (p) => <Icon {...p} d={<><path d="M6 3h9l4 4v14H6z"/><path d="M15 3v5h4"/></>} />;
const IconBook    = (p) => <Icon {...p} d={<><path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h11"/></>} />;
const IconMail    = (p) => <Icon {...p} d={<><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M4 7l8 6 8-6"/></>} />;
const IconPin     = (p) => <Icon {...p} d={<><path d="M12 21s7-6.5 7-11a7 7 0 0 0-14 0c0 4.5 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/></>} />;
const IconClock   = (p) => <Icon {...p} d={<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>} />;
const IconShare   = (p) => <Icon {...p} d={<><circle cx="6" cy="12" r="2.5"/><circle cx="17" cy="6" r="2.5"/><circle cx="17" cy="18" r="2.5"/><path d="M8.2 10.8l6.6-3.6M8.2 13.2l6.6 3.6"/></>} />;
const IconEdit    = (p) => <Icon {...p} d={<><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M14 6l4 4"/></>} />;
const IconTrash   = (p) => <Icon {...p} d={<><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13h10l1-13"/></>} />;
const IconPlay    = (p) => <Icon {...p} d={<path d="M7 4v16l13-8z" fill="currentColor" stroke="none"/>} />;
const IconExternal= (p) => <Icon {...p} d={<><path d="M14 4h6v6"/><path d="M20 4l-9 9"/><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/></>} />;
const IconUsers   = (p) => <Icon {...p} d={<><circle cx="9" cy="9" r="3.2"/><path d="M3 19c1-3 3.2-4.5 6-4.5s5 1.5 6 4.5"/><circle cx="17.5" cy="7.5" r="2.2"/><path d="M15.5 15.5c.6-1.2 2-2 3.5-2s2.6.6 3.2 1.6"/></>} />;
const IconPause   = (p) => <Icon {...p} d={<><rect x="7" y="5" width="3" height="14" rx="1" fill="currentColor" stroke="none"/><rect x="14" y="5" width="3" height="14" rx="1" fill="currentColor" stroke="none"/></>} />;
const IconShield  = (p) => <Icon {...p} d={<><path d="M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6z"/><path d="m9 12 2 2 4-4"/></>} />;
const IconArrowUp = (p) => <Icon {...p} d={<path d="M12 19V6M6 12l6-6 6 6"/>} />;

// ─── Avatar (initials) ──────────────────────────────────────────────
function Avatar({ init, size = 36, radius = 'var(--r-surface)', tone = 'bark' }) {
  const bg = tone === 'wine' ? 'var(--wine-grad)' : 'linear-gradient(145deg, #8a6e4a, #5a4530)';
  return (
    <span style={{
      width: size, height: size, borderRadius: radius, flexShrink: 0,
      background: bg, boxShadow: 'var(--sh-raised-crisp)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: 'var(--paper)', fontFamily: 'var(--mono)', fontSize: size * 0.34,
      letterSpacing: '0.04em', fontWeight: 500,
    }}>{init}</span>
  );
}

// ─── Generic role / status pills ────────────────────────────────────
function RolePill({ role }) {
  const owner = role === 'Owner';
  return (
    <span style={{
      fontFamily: 'var(--mono)', fontSize: 9, fontWeight: 700, letterSpacing: '0.12em',
      textTransform: 'uppercase', padding: '3px 9px', borderRadius: 'var(--r-pill)',
      color: owner ? 'var(--wine)' : 'var(--mute)',
      background: owner ? 'var(--wine-tint)' : 'var(--bg)',
      boxShadow: owner ? 'inset 0 0 0 1px rgba(94,34,48,0.18)' : 'var(--sh-inset-crisp)',
    }}>{role}</span>
  );
}

function ContractPill({ status }) {
  const map = {
    active:  { c: 'var(--good)', t: 'Active',  tint: 'var(--good-tint)' },
    pending: { c: 'var(--warn)', t: 'Pending', tint: 'var(--warn-tint)' },
    expired: { c: 'var(--mute-2)', t: 'Expired', tint: 'var(--bg)' },
  };
  const s = map[status] || map.expired;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontFamily: 'var(--mono)', fontSize: 9, fontWeight: 700, letterSpacing: '0.1em',
      textTransform: 'uppercase', padding: '3px 9px', borderRadius: 'var(--r-pill)',
      color: s.c, background: s.tint, boxShadow: status === 'expired' ? 'var(--sh-inset-crisp)' : 'none',
    }}>
      <span className="dot" style={{ background: s.c }} />{s.t}
    </span>
  );
}

function ConnectedPill({ on = true }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      fontFamily: 'var(--mono)', fontSize: 9, fontWeight: 700, letterSpacing: '0.12em',
      textTransform: 'uppercase', padding: '4px 10px', borderRadius: 'var(--r-pill)',
      color: on ? 'var(--good)' : 'var(--mute-2)', background: on ? 'var(--good-tint)' : 'var(--bg)',
      boxShadow: on ? 'none' : 'var(--sh-inset-crisp)',
    }}>
      <span className="dot" style={{ background: on ? 'var(--good)' : 'var(--mute-2)' }} />{on ? 'Connected' : 'Not set'}
    </span>
  );
}

// ─── Panel — a titled neumorphic card ───────────────────────────────
function Panel({ icon, eyebrow, title, count, action, children, pad = 24, style, bodyStyle, polished = false }) {
  return (
    <section className={polished ? 'neu-polished' : 'neu-raised'} style={{
      borderRadius: 'var(--r-card)', overflow: 'hidden', display: 'flex', flexDirection: 'column', ...style,
    }}>
      {(title || action) && (
        <header style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: `${pad - 6}px ${pad}px ${pad - 12}px`,
        }}>
          {icon && <span style={{ color: 'var(--wine)', display: 'flex' }}>{icon}</span>}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flex: 1, minWidth: 0 }}>
            {eyebrow && <div className="eyebrow eyebrow-sm" style={{ marginRight: 2 }}>{eyebrow}</div>}
            <h3 className="serif" style={{ margin: 0, fontSize: 23, color: 'var(--ink-soft)', lineHeight: 1, letterSpacing: '-0.01em' }}>{title}</h3>
            {count != null && (
              <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--mute)', letterSpacing: '0.08em',
                background: 'var(--bg)', boxShadow: 'var(--sh-inset-crisp)', padding: '2px 9px', borderRadius: 'var(--r-pill)' }}>{count}</span>
            )}
          </div>
          {action}
        </header>
      )}
      <div style={{ padding: `0 ${pad}px ${pad}px`, flex: 1, minHeight: 0, ...bodyStyle }}>{children}</div>
    </section>
  );
}

// Small mono action button used in panel headers
function PanelAction({ icon, children, wine = false, onClick }) {
  return (
    <button className={`la-btn ${wine ? 'la-btn--wine' : 'la-btn--soft'}`} onClick={onClick}>
      {icon}{children}
    </button>
  );
}

// ─── Account header band ────────────────────────────────────────────
function AccountHeader({ a, polished = true }) {
  return (
    <div className={polished ? 'neu-polished-large' : ''} style={{
      display: 'flex', alignItems: 'center', gap: 22,
      padding: polished ? '22px 26px' : '4px 2px',
      borderRadius: polished ? 'var(--r-panel)' : 0,
    }}>
      <div style={{
        width: 58, height: 58, borderRadius: 'var(--r-card)', flexShrink: 0,
        background: 'var(--wine-grad)', boxShadow: 'var(--sh-raised-medium), inset 0 1px 0 rgba(255,255,255,0.12)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--paper)', fontFamily: '"Yeseva One", serif', fontSize: 26, lineHeight: 1, paddingBottom: 2,
      }}>{a.mono[0]}</div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 6 }}>
          <h1 className="serif" style={{ margin: 0, fontSize: 34, color: 'var(--ink)', lineHeight: 1, letterSpacing: '-0.015em' }}>{a.name}</h1>
          <StatusPill status={a.status} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--mute)' }}>
          <span>{a.type}</span>
          <span style={{ color: 'var(--mute-2)' }}>·</span>
          <span>{a.niche}</span>
          <span style={{ color: 'var(--mute-2)' }}>·</span>
          <span style={{ color: 'var(--mute-2)' }}>#{a.id}</span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <button className="la-btn la-btn--soft la-btn--lg"><IconShare size={14} />Share access</button>
        <button className="la-btn la-btn--soft la-btn--icon" style={{ width: 38, height: 38 }}><IconMore size={15} /></button>
        <button className="la-btn la-btn--wine la-btn--lg"><IconEdit size={14} />Edit account</button>
      </div>
    </div>
  );
}

// ─── Accounts rail (master list) ────────────────────────────────────
function AccountRail({ data, width = 290 }) {
  return (
    <div style={{
      width, flexShrink: 0, display: 'flex', flexDirection: 'column',
      height: '100%', overflow: 'hidden', background: 'var(--bg)', borderRight: '1px solid var(--line)',
    }}>
      {/* header */}
      <div style={{ height: 60, flexShrink: 0, padding: '0 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--line)' }}>
        <span className="serif" style={{ fontSize: 25, color: 'var(--ink)', letterSpacing: '-0.01em' }}>Accounts</span>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--mute-2)', letterSpacing: '0.1em', background: 'var(--bg)', boxShadow: 'var(--sh-inset-crisp)', padding: '3px 10px', borderRadius: 'var(--r-pill)' }}>
          {data.accountsList.reduce((n, g) => n + g.items.length, 0)}
        </span>
      </div>

      {/* search + tools */}
      <div style={{ padding: '14px 16px 10px', display: 'flex', gap: 8, flexShrink: 0 }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <input className="neu-input" placeholder="Search accounts…" style={{ fontSize: 12.5, padding: '9px 12px 9px 32px' }} />
          <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--mute-2)', display: 'flex' }}><IconSearch size={13} /></span>
        </div>
        <button className="la-btn la-btn--inset la-btn--icon"><IconFilter size={13} /></button>
        <button className="la-btn la-btn--wine la-btn--icon"><IconPlus size={14} /></button>
      </div>

      {/* grouped list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 12px 16px', display: 'flex', flexDirection: 'column', gap: 3 }}>
        {data.accountsList.map((g) => (
          <React.Fragment key={g.group}>
            <div className="row" style={{ gap: 10, padding: '12px 4px 6px' }}>
              <span className="eyebrow eyebrow-sm">{g.group}</span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--mute-2)' }}>{g.items.length}</span>
              <div className="rule" style={{ flex: 1 }} />
            </div>
            {g.items.map((it) => <AccountRailCard key={it.id} a={it} />)}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

function AccountRailCard({ a }) {
  return (
    <div className={`la-camp-card ${a.active ? 'active' : ''}`} style={{ padding: '12px 14px', borderRadius: 'var(--r-surface)' }}>
      <div className={`la-mono-tile ${a.active ? 'wine' : ''}`} style={{ width: 40, height: 40, fontFamily: 'var(--mono)', fontSize: 13, letterSpacing: '0.02em' }}>{a.mono}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
          <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</span>
          {a.type && <span style={{ fontFamily: 'var(--mono)', fontSize: 7.5, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--mute-2)', border: '1px solid var(--line-strong)', borderRadius: 3, padding: '1px 4px', flexShrink: 0 }}>{a.type}</span>}
        </div>
        <div className="row" style={{ gap: 7, fontSize: 11, color: 'var(--mute)' }}>
          <span className="row" style={{ gap: 5 }}>
            <span className="dot" style={{ background: 'var(--good)' }} />Active
          </span>
          {a.members > 0 && <><span style={{ color: 'var(--mute-2)' }}>·</span><span className="row" style={{ gap: 4 }}><IconUsers size={11} />{a.members}</span></>}
          <span style={{ marginLeft: 'auto', fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--mute-2)' }}>{a.ago}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Spec rows (account details) ────────────────────────────────────
// Inline label/value rows split by hairlines — the "read" treatment.
function SpecGroup({ label, icon, items }) {
  return (
    <div style={{ marginBottom: 4 }}>
      {label && (
        <div className="row" style={{ gap: 8, padding: '14px 0 10px' }}>
          {icon && <span style={{ color: 'var(--mute-2)', display: 'flex' }}>{icon}</span>}
          <span className="eyebrow eyebrow-sm">{label}</span>
          <div className="rule" style={{ flex: 1 }} />
        </div>
      )}
      <div>
        {items.map((it, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16,
            padding: '9px 0', borderTop: i === 0 ? 'none' : '1px solid var(--line)',
          }}>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 9.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--mute-2)', flexShrink: 0 }}>{it.label}</span>
            <span style={{ fontSize: 13, color: it.muted ? 'var(--mute-2)' : 'var(--ink-soft)', textAlign: 'right', fontFamily: it.mono ? 'var(--mono)' : 'var(--sans)', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '62%' }}>{it.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Editable-style field rows: label + inset "field" chip (premium form look).
function FieldRow({ label, value, mono, dropdown, muted }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '7px 0' }}>
      <span style={{ width: 96, flexShrink: 0, fontFamily: 'var(--mono)', fontSize: 9.5, letterSpacing: '0.13em', textTransform: 'uppercase', color: 'var(--mute)' }}>{label}</span>
      <div className="neu-inset-crisp" style={{
        flex: 1, minWidth: 0, padding: '9px 13px', borderRadius: 'var(--r-button)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
        fontSize: 13, color: muted ? 'var(--mute-2)' : 'var(--ink-soft)', fontFamily: mono ? 'var(--mono)' : 'var(--sans)',
      }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</span>
        {dropdown && <span style={{ color: 'var(--mute-2)', display: 'flex', transform: 'rotate(90deg)' }}><IconChev size={12} /></span>}
      </div>
    </div>
  );
}

// ─── Campaign row ───────────────────────────────────────────────────
function CampaignRow({ c, compact = false }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14, padding: compact ? '11px 12px' : '13px 14px',
      borderRadius: 'var(--r-surface)', cursor: 'pointer', transition: 'background 130ms',
      background: 'transparent',
    }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--wine-tint)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
      <div className="la-mono-tile" style={{ width: 38, height: 38, fontFamily: 'var(--mono)', fontSize: 12, background: 'var(--bg)', boxShadow: 'var(--sh-inset-crisp)', color: 'var(--mute)' }}>{c.mono}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 4 }}>
          <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
          {c.ends && <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--mute-2)', letterSpacing: '0.06em' }}>· {c.ends}</span>}
        </div>
        <div className="row" style={{ gap: 10 }}>
          <StatusPill status={c.status} />
          <span className="row" style={{ gap: 5, fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--mute)', letterSpacing: '0.06em' }}><IconWA size={12} />{c.channel}</span>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 22, flexShrink: 0 }}>
        <Stat n={c.leads} l="Leads" />
        <Stat n={`${c.resp}%`} l="Response" accent />
      </div>
      <button className="la-btn la-btn--inset la-btn--icon" style={{ flexShrink: 0 }}><IconMore size={14} /></button>
    </div>
  );
}

function Stat({ n, l, accent }) {
  return (
    <div style={{ textAlign: 'right', minWidth: 44 }}>
      <div className="serif" style={{ fontSize: 19, color: accent ? 'var(--wine)' : 'var(--ink)', lineHeight: 1 }}>{n}</div>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 8, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--mute-2)', marginTop: 3 }}>{l}</div>
    </div>
  );
}

// ─── Contract row ───────────────────────────────────────────────────
function ContractRow({ c }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 14px', borderRadius: 'var(--r-surface)', transition: 'background 130ms' }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--wine-tint)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
      <div style={{ width: 36, height: 36, borderRadius: 'var(--r-button)', flexShrink: 0, background: 'var(--bg)', boxShadow: 'var(--sh-inset-crisp)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--mute)' }}><IconFile size={17} /></div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', marginBottom: 5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
        <ContractPill status={c.status} />
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div className="row" style={{ justifyContent: 'flex-end', alignItems: 'baseline', gap: 3 }}>
          <span className="serif" style={{ fontSize: 18, color: 'var(--ink)', lineHeight: 1 }}>{c.value}</span>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--mute-2)' }}>/mo</span>
        </div>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--mute-2)', marginTop: 5, letterSpacing: '0.04em' }}>Renews {c.renewal}</div>
      </div>
    </div>
  );
}

// ─── Team row ───────────────────────────────────────────────────────
function TeamRow({ m }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '11px 12px', borderRadius: 'var(--r-surface)', transition: 'background 130ms' }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--wine-tint)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
      <Avatar init={m.init} size={38} tone={m.role === 'Owner' ? 'wine' : 'bark'} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</div>
        <div style={{ fontSize: 11.5, color: 'var(--mute)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.email}</div>
      </div>
      <RolePill role={m.role} />
    </div>
  );
}

// ─── Knowledge base (empty state) ───────────────────────────────────
function KnowledgeEmpty({ compact = false }) {
  return (
    <div className="neu-inset" style={{
      borderRadius: 'var(--r-card)', padding: compact ? '22px 20px' : '30px 24px',
      display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 8,
    }}>
      <div style={{ width: 44, height: 44, borderRadius: 'var(--r-surface)', background: 'var(--surface)', boxShadow: 'var(--sh-raised-crisp)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--mute-2)', marginBottom: 4 }}><IconBook size={20} /></div>
      <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink-soft)' }}>No knowledge base entries yet</div>
      {!compact && <div style={{ fontSize: 12, color: 'var(--mute)', maxWidth: 280, lineHeight: 1.5 }}>Add pricing, services and FAQs so the AI can answer lead questions accurately.</div>}
      <button className="la-btn la-btn--wine" style={{ marginTop: 8 }}><IconPlus size={12} />Add entry</button>
    </div>
  );
}

// ─── Voice clone row ────────────────────────────────────────────────
function VoiceRow({ v }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '12px 13px', borderRadius: 'var(--r-surface)', background: v.ready ? 'var(--surface)' : 'var(--bg)', boxShadow: v.ready ? 'var(--sh-raised-crisp)' : 'var(--sh-inset-crisp)' }}>
      <span style={{ width: 34, height: 34, borderRadius: 'var(--r-button)', flexShrink: 0, background: 'var(--card)', boxShadow: 'var(--sh-raised-crisp)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17 }}>{v.flag}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="row" style={{ gap: 8, marginBottom: v.ready ? 4 : 0 }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--ink-soft)' }}>{v.lang}</span>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 8.5, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: v.ready ? 'var(--good)' : 'var(--mute-2)' }}>{v.ready ? '● Ready' : '○ No sample'}</span>
        </div>
        {v.ready && <div style={{ fontSize: 11.5, color: 'var(--mute)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontStyle: 'italic' }}>"{v.sample}"</div>}
      </div>
      {v.ready
        ? <button className="la-btn la-btn--soft la-btn--icon"><IconPlay size={12} /></button>
        : <button className="la-btn la-btn--soft"><IconArrowUp size={12} />Upload</button>}
    </div>
  );
}

// ─── Integration field + brand tile + coming-soon chip ──────────────
function BrandTile({ init, size = 34, connected = true }) {
  return (
    <span style={{
      width: size, height: size, borderRadius: 'var(--r-button)', flexShrink: 0,
      background: connected ? 'var(--wine-grad)' : 'var(--bg)',
      boxShadow: connected ? 'var(--sh-raised-crisp), inset 0 1px 0 rgba(255,255,255,0.12)' : 'var(--sh-inset-crisp)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: connected ? 'var(--paper)' : 'var(--mute-2)', fontFamily: '"Yeseva One", serif', fontSize: size * 0.46, lineHeight: 1, paddingBottom: 1,
    }}>{init}</span>
  );
}

function IntegrationField({ f }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div className="row" style={{ gap: 6, marginBottom: 5 }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--mute-2)' }}>{f.label}</span>
      </div>
      <div className="neu-inset-crisp" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 11px', borderRadius: 'var(--r-button)' }}>
        <span style={{ flex: 1, minWidth: 0, fontFamily: f.mono ? 'var(--mono)' : 'var(--sans)', fontSize: 11.5, color: f.secret ? 'var(--mute)' : 'var(--ink-soft)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: f.secret ? '0.1em' : 0 }}>{f.value}</span>
        {f.secret && <span style={{ color: 'var(--mute-2)', display: 'flex', cursor: 'pointer' }}><IconEye size={13} /></span>}
        {f.copy && <span style={{ color: 'var(--mute-2)', display: 'flex', cursor: 'pointer' }}><IconCopy size={13} /></span>}
      </div>
    </div>
  );
}

function ComingSoonChip({ s }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 13px', borderRadius: 'var(--r-surface)', background: 'var(--bg)', boxShadow: 'var(--sh-inset-crisp)' }}>
      <BrandTile init={s.init} size={32} connected={false} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--mute)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.label}</div>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 8.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--mute-2)', marginTop: 2 }}>Coming soon</div>
      </div>
    </div>
  );
}

// List-view icon (rail toggle) — small, local
const IconListV = (p) => <Icon {...p} d={<><path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4" cy="6" r="1" fill="currentColor"/><circle cx="4" cy="12" r="1" fill="currentColor"/><circle cx="4" cy="18" r="1" fill="currentColor"/></>} />;

Object.assign(window, {
  IconGlobe, IconMic, IconLink, IconCopy, IconEye, IconFile, IconBook, IconMail,
  IconPin, IconClock, IconShare, IconEdit, IconTrash, IconPlay, IconExternal,
  IconUsers, IconPause, IconShield, IconArrowUp, IconListV,
  Avatar, RolePill, ContractPill, ConnectedPill, Panel, PanelAction, AccountHeader,
  AccountRail, AccountRailCard, SpecGroup, FieldRow, CampaignRow, Stat, ContractRow,
  TeamRow, KnowledgeEmpty, VoiceRow, BrandTile, IntegrationField, ComingSoonChip,
});
