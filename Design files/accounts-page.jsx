// accounts-page.jsx — standalone Accounts page (promoted Direction C).
//
// Chrome:  Sidebar (nav) · AccountRail (master list) · detail column.
// Detail column = a 60px TopBar (account context + section tabs + actions)
// over a scrolling content area.
//
// Sections (tabs): Overview · Integrations · Voice Clone · KB.
// The Overview is responsive: a single/▸two-column read at normal widths, and
// a four-column dashboard once the content area passes the ultra-wide
// threshold (ULTRA_AT). The ultra layout surfaces Integrations / Voice / KB
// inline so a wide monitor shows the whole account at a glance; the tabs stay
// for focused work on narrower screens.
//
// Depends on: components.jsx, accounts-components.jsx, accounts-panels.jsx,
// accounts-data.js

const ULTRA_AT = 1560;   // content-area width (px) at which we go ultra-wide

// ─── Element-width hook (drives the responsive layout) ───────────────
function useElementWidth() {
  const ref = React.useRef(null);
  const [w, setW] = React.useState(0);
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0].contentRect;
      setW(Math.round(cr.width));
    });
    ro.observe(el);
    setW(Math.round(el.getBoundingClientRect().width));
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

// ─── Section tabs ────────────────────────────────────────────────────
const ACCT_TABS = [
  ['overview',     'Overview'],
  ['integrations', 'Integrations'],
  ['voice',        'Voice Clone'],
  ['kb',           'KB'],
];

// ─── Top bar ─────────────────────────────────────────────────────────
// account context (avatar + name + status) · section tabs · actions.
function AccountTopBar({ d, tab, setTab, collapsed }) {
  return (
    <div style={{
      height: 60, flexShrink: 0, padding: '0 18px 0 20px',
      borderBottom: '1px solid var(--line)', background: 'var(--bg)',
      display: 'flex', alignItems: 'center', gap: 18,
    }}>
      {/* account context */}
      <div className="row" style={{ gap: 12, minWidth: 0, flexShrink: 1 }}>
        <div style={{
          width: 38, height: 38, borderRadius: 'var(--r-button)', flexShrink: 0,
          background: 'var(--wine-grad)', boxShadow: 'var(--sh-raised-crisp), inset 0 1px 0 rgba(255,255,255,0.12)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--paper)', fontFamily: '"Yeseva One", serif', fontSize: 17, paddingBottom: 1,
        }}>{d.mono[0]}</div>
        <div style={{ minWidth: 0 }}>
          <div className="row" style={{ gap: 8 }}>
            <span className="serif" style={{ fontSize: 19, color: 'var(--ink)', letterSpacing: '-0.01em', lineHeight: 1.1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</span>
            <span style={{ flexShrink: 0 }}><StatusPill status={d.status} /></span>
          </div>
          {!collapsed && (
            <div style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--mute)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {d.type} · {d.niche} · #{d.id}
            </div>
          )}
        </div>
      </div>

      {/* divider */}
      <div style={{ width: 1, height: 28, background: 'var(--line)', flexShrink: 0 }} />

      {/* section tabs */}
      <div className="la-seg" style={{ flexShrink: 0 }}>
        {ACCT_TABS.map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} className={`la-seg-btn${tab === k ? ' on' : ''}`} style={{ padding: '8px 15px', fontSize: 10 }}>{label}</button>
        ))}
      </div>

      <div style={{ flex: 1 }} />

      {/* actions */}
      <div className="row" style={{ gap: 8, flexShrink: 0 }}>
        {collapsed ? (
          <button title="Search" className="la-btn la-btn--soft la-btn--icon"><IconSearch size={13} /></button>
        ) : (
          <div style={{ position: 'relative' }}>
            <input className="neu-input" placeholder="Search…" style={{ padding: '8px 12px 8px 32px', fontSize: 12, width: 150 }} />
            <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--mute-2)', display: 'flex', pointerEvents: 'none' }}><IconSearch size={12} /></span>
          </div>
        )}
        <button title="Filter" className="la-btn la-btn--soft la-btn--icon"><IconFilter size={13} /></button>
        <button title="More" className="la-btn la-btn--soft la-btn--icon"><IconMore size={15} /></button>
        <button className="la-btn la-btn--wine"><IconEdit size={13} />{!collapsed && 'Edit account'}</button>
      </div>
    </div>
  );
}

// ─── Overview · normal width (≤ ULTRA_AT) ────────────────────────────
function OverviewNormal({ d }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1180, margin: '0 auto' }}>
      {/* Key metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        <StatTile eyebrow="Campaigns"    big={d.campaigns.length} sub="All active" />
        <StatTile eyebrow="Avg response" big="25%"                sub="Across campaigns" accent />
        <StatTile eyebrow="Contracts"    big={d.contracts.length} sub="1 active · $2.5k/mo" />
        <StatTile eyebrow="Team"         big={d.team.length}      sub="1 owner · 1 admin" />
      </div>
      {/* Account details — full-width, two inner columns */}
      <AccountDetailsPanel d={d} cols={2} />
      {/* Campaigns + (Team over Contracts) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 20, alignItems: 'start' }}>
        <CampaignsPanel d={d} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <TeamPanel d={d} />
          <ContractsPanel d={d} />
        </div>
      </div>
    </div>
  );
}

// ─── Overview · ultra-wide (> ULTRA_AT) ──────────────────────────────
// 4 columns: [details + integrations] [campaigns + voice] [team + contracts] [KB]
function OverviewUltra({ d }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1.15fr) minmax(0, 1fr) minmax(0, 0.95fr)',
      gap: 22, alignItems: 'start',
    }}>
      {/* ① Account details (+ metrics on top) + Integrations */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          <StatTile eyebrow="Campaigns"    big={d.campaigns.length} sub="Active" />
          <StatTile eyebrow="Response"     big="25%"                sub="Avg" accent />
          <StatTile eyebrow="Contracts"    big={d.contracts.length} sub="$2.5k/mo" />
          <StatTile eyebrow="Team"         big={d.team.length}      sub="members" />
        </div>
        <AccountDetailsPanel d={d} cols={2} />
        <IntegrationsPanel d={d} fieldCols={2} />
      </div>

      {/* ② Campaigns + Voice Clone */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
        <CampaignsPanel d={d} />
        <VoicePanel d={d} />
      </div>

      {/* ③ Team + Contracts */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
        <TeamPanel d={d} />
        <ContractsPanel d={d} />
      </div>

      {/* ④ Knowledge Base (its own column — grows tall over time) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
        <KnowledgePanel d={d} />
      </div>
    </div>
  );
}

// ─── Focused single-section tabs ─────────────────────────────────────
function SectionView({ tab, d }) {
  if (tab === 'integrations') return <IntegrationsPanel d={d} fieldCols={3} />;
  if (tab === 'voice')        return <div style={{ maxWidth: 720 }}><VoicePanel d={d} /></div>;
  if (tab === 'kb')           return <div style={{ maxWidth: 820 }}><KnowledgePanel d={d} /></div>;
  return null;
}

// ─── Page ────────────────────────────────────────────────────────────
function AccountsPage({ cls }) {
  const d = window.ACCOUNTS_DATA.detail;
  const [tab, setTab] = React.useState('overview');
  const [contentRef, w] = useElementWidth();
  const ultra = w > ULTRA_AT;
  const collapsed = w < 720;   // tighten the top bar on a narrow content area

  return (
    <div className={cls} style={{ width: '100%', height: '100%' }}>
      <div className="la-app" style={{ display: 'flex', width: '100%', height: '100%', overflow: 'hidden' }}>
        <Sidebar active="Accounts" />
        <AccountRail data={window.ACCOUNTS_DATA} />
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg)', overflow: 'hidden' }}>
          <AccountTopBar d={d} tab={tab} setTab={setTab} collapsed={collapsed} />
          <div ref={contentRef} style={{ flex: 1, overflowY: 'auto', padding: ultra ? '24px 28px 56px' : '24px 30px 56px' }}>
            {tab === 'overview'
              ? (ultra ? <OverviewUltra d={d} /> : <OverviewNormal d={d} />)
              : <div style={{ maxWidth: ultra ? 'none' : 1180, margin: '0 auto' }}><SectionView tab={tab} d={d} /></div>}
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { AccountsPage, AccountTopBar, OverviewNormal, OverviewUltra, useElementWidth });
