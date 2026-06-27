// accounts-workspace.jsx — standalone Accounts page (promoted Direction C).
//   Sidebar │ ┌ TopBar: Accounts · Overview Integrations Knowledge · actions ┐
//           │ ├──────────┬───────────────────────────────────────────────────┤
//           │ │  Rail    │  ░ Identity card (name + metachips) ░              │
//           │ │ +Create  │  Tab body (scrolls) — Overview reflows 2⇄4 col     │
//           │ └──────────┴───────────────────────────────────────────────────┘
// Depends on: components.jsx, accounts-components.jsx, accounts-kb.jsx, accounts-data.js

const RAIL_W = 290;
const ULTRA_AT = 1450; // detail-area width (px) at which ultra-wide engages

// ── ultra-wide detection (ResizeObserver on the detail area) ─────────
function useUltraWide(ref, override) {
  const [w, setW] = React.useState(0);
  React.useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver((entries) => { for (const e of entries) setW(e.contentRect.width); });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, [ref]);
  if (override === 'regular') return false;
  if (override === 'ultra') return true;
  return w >= ULTRA_AT;
}

// ── derived key metrics (shown as metachips in the identity card) ────
function deriveMetrics(d) {
  const avgResp = Math.round(d.campaigns.reduce((s, c) => s + c.resp, 0) / d.campaigns.length);
  const activeContracts = d.contracts.filter((c) => c.status === 'active').length;
  return [
    { key: 'campaigns', label: 'Campaigns', value: d.campaigns.length, sub: 'all active', accent: 'var(--wine)' },
    { key: 'response',  label: 'Avg response', value: `${avgResp}%`, sub: 'across all', accent: 'var(--good)' },
    { key: 'contracts', label: 'Contracts', value: d.contracts.length, sub: `${activeContracts} active`, accent: 'var(--stage-contacted)' },
    { key: 'team',      label: 'Team', value: d.team.length, sub: '1 owner', accent: 'var(--mute)' },
  ];
}

function MetaChip({ m }) {
  return (
    <div className="neu-inset-crisp" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px 8px 12px', borderRadius: 'var(--r-button)', minWidth: 0 }}>
      <span style={{ width: 3, height: 26, borderRadius: 2, background: m.accent, flexShrink: 0 }} />
      <div style={{ lineHeight: 1 }}>
        <div className="row" style={{ alignItems: 'baseline', gap: 5 }}>
          <span className="serif" style={{ fontSize: 21, color: 'var(--ink)', lineHeight: 1 }}>{m.value}</span>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 8.5, color: 'var(--mute-2)', letterSpacing: '0.04em' }}>{m.sub}</span>
        </div>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 8.5, letterSpacing: '0.13em', textTransform: 'uppercase', color: 'var(--mute)', marginTop: 4 }}>{m.label}</div>
      </div>
    </div>
  );
}

// ── Top bar — one continuous element (title · tabs · actions) ────────
const TABS = [
  ['overview', 'Overview'],
  ['integrations', 'Integrations'],
  ['knowledge', 'Knowledge'],
];

function TopBar({ tab, setTab, count }) {
  return (
    <header className="row" style={{ height: 60, flexShrink: 0, gap: 18, padding: '0 22px', background: 'var(--bg)', borderBottom: '1px solid var(--line)' }}>
      <div className="row" style={{ gap: 10, flexShrink: 0 }}>
        <span className="serif" style={{ fontSize: 24, color: 'var(--ink)', letterSpacing: '-0.01em' }}>Accounts</span>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--mute)', background: 'var(--bg-2)', boxShadow: 'var(--sh-inset-crisp)', padding: '2px 8px', borderRadius: 'var(--r-pill)' }}>{count}</span>
      </div>

      <nav className="la-seg" role="tablist" style={{ flexShrink: 0 }}>
        {TABS.map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={`la-seg-btn${tab === k ? ' on' : ''}`} onClick={() => setTab(k)} style={{ padding: '8px 16px' }}>{label}</button>
        ))}
      </nav>

      <div style={{ flex: 1 }} />

      <div className="row" style={{ gap: 8, flexShrink: 0 }}>
        <button className="la-btn la-btn--inset la-btn--icon" title="Search" style={{ width: 36, height: 36 }}><IconSearch size={15} /></button>
        <button className="la-btn la-btn--inset la-btn--icon" title="Filter" style={{ width: 36, height: 36 }}><IconFilter size={15} /></button>
        <button className="la-btn la-btn--wine la-btn--lg"><IconEdit size={14} />Edit account</button>
        <button className="la-btn la-btn--inset la-btn--icon" title="More" style={{ width: 36, height: 36 }}><IconMore size={15} /></button>
      </div>
    </header>
  );
}

// ── Rail — accounts list with a Create button ────────────────────────
function Rail({ data }) {
  return (
    <div style={{ width: RAIL_W, flexShrink: 0, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: 'var(--bg)', borderRight: '1px solid var(--line)' }}>
      <div style={{ padding: '14px 16px 8px', flexShrink: 0 }}>
        <button className="la-btn la-btn--soft" style={{ width: '100%', justifyContent: 'center', padding: '11px 14px' }}>
          <span style={{ display: 'flex', color: 'var(--wine)' }}><IconPlus size={15} /></span>Create account
        </button>
      </div>
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

// ── Identity card (white raised card; metrics as metachips) ──────────
function IdentityCard({ d, metrics }) {
  return (
    <div className="neu-raised" style={{ borderRadius: 'var(--r-panel)', padding: '22px 26px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
      <div className="row" style={{ gap: 16, minWidth: 0 }}>
        <div style={{ width: 56, height: 56, borderRadius: 'var(--r-card)', flexShrink: 0, background: 'var(--wine-grad)', boxShadow: 'var(--sh-raised-medium), inset 0 1px 0 rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--paper)', fontFamily: '"Yeseva One", serif', fontSize: 25, paddingBottom: 2 }}>{d.mono[0]}</div>
        <div style={{ minWidth: 0 }}>
          <div className="row" style={{ gap: 12, marginBottom: 5 }}>
            <h1 className="serif" style={{ margin: 0, fontSize: 31, color: 'var(--ink)', lineHeight: 1, letterSpacing: '-0.015em' }}>{d.name}</h1>
            <StatusPill status={d.status} />
          </div>
          <div className="row" style={{ gap: 9, fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--mute)' }}>
            <span>{d.type}</span><span style={{ color: 'var(--mute-2)' }}>·</span><span>{d.niche}</span><span style={{ color: 'var(--mute-2)' }}>·</span><span style={{ color: 'var(--mute-2)' }}>#{d.id}</span>
          </div>
        </div>
      </div>
      <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
        {metrics.map((m) => <MetaChip key={m.key} m={m} />)}
      </div>
    </div>
  );
}

// ════ Section panels ═════════════════════════════════════════════════
function GroupLabel({ icon, children }) {
  return (
    <div className="row" style={{ gap: 8, padding: '2px 0 8px' }}>
      {icon && <span style={{ color: 'var(--mute-2)', display: 'flex' }}>{icon}</span>}
      <span className="eyebrow eyebrow-sm">{children}</span>
      <div className="rule" style={{ flex: 1 }} />
    </div>
  );
}

function AccountDetailsPanel({ d, cols = 2 }) {
  const ColA = (
    <div>
      <GroupLabel icon={<IconShield size={13} />}>Overview</GroupLabel>
      <FieldRow label="Status" value={d.overview.status} dropdown />
      <FieldRow label="Type" value={d.overview.type} dropdown />
      <FieldRow label="Niche" value={d.overview.niche} />
      <div style={{ height: 10 }} />
      <GroupLabel icon={<IconMail size={13} />}>Contact</GroupLabel>
      <FieldRow label="Email" value={d.contact.email} />
      <FieldRow label="Phone" value={d.contact.phone} mono />
      <FieldRow label="Website" value={d.contact.website} mono />
      <FieldRow label="Address" value={d.contact.address} />
    </div>
  );
  const ColB = (
    <div>
      <GroupLabel icon={<IconClock size={13} />}>Schedule</GroupLabel>
      <FieldRow label="Timezone" value={d.schedule.timezone} dropdown />
      <FieldRow label="Language" value={d.schedule.language} dropdown />
      <FieldRow label="Hours" value={`${d.schedule.hoursOpen} – ${d.schedule.hoursClose}`} mono />
      <FieldRow label="Daily sends" value={d.schedule.dailySends} mono />
      <FieldRow label="Opt-out" value={d.schedule.optOut} mono />
      <div style={{ height: 10 }} />
      <GroupLabel icon={<IconFile size={13} />}>Notes</GroupLabel>
      <FieldRow label="Tax ID" value={d.meta.taxId} mono muted />
      <div style={{ padding: '7px 0' }}>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 9.5, letterSpacing: '0.13em', textTransform: 'uppercase', color: 'var(--mute)', marginBottom: 7 }}>Description</div>
        <div className="neu-inset-crisp" style={{ padding: '11px 13px', borderRadius: 'var(--r-button)', fontSize: 12.5, lineHeight: 1.55, color: 'var(--ink-soft)' }}>{d.meta.description}</div>
      </div>
    </div>
  );
  return (
    <Panel eyebrow="01" title="Account Details"
      action={<button className="la-btn la-btn--inset"><IconEdit size={12} />Edit</button>}>
      {cols === 2
        ? <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 30 }}>{ColA}{ColB}</div>
        : <div>{ColA}<div style={{ height: 10 }} />{ColB}</div>}
    </Panel>
  );
}

function CampaignsPanel({ d }) {
  return (
    <Panel eyebrow="02" title="Campaigns" count={`${d.campaigns.length} active`}
      action={<PanelAction wine icon={<IconPlus size={12} />}>New</PanelAction>}>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {d.campaigns.map((c, i) => (
          <React.Fragment key={c.id}>
            {i > 0 && <div className="rule" style={{ margin: '0 14px' }} />}
            <CampaignRow c={c} />
          </React.Fragment>
        ))}
      </div>
      <button className="la-btn la-btn--soft" style={{ alignSelf: 'center', marginTop: 12 }}>View all campaigns<IconChev size={12} /></button>
    </Panel>
  );
}

function TeamPanel({ d }) {
  return (
    <Panel eyebrow="03" title="Team" count={`${d.team.length} members`}
      action={<PanelAction icon={<IconPlus size={12} />}>Invite</PanelAction>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {d.team.map((m) => <TeamRow key={m.id} m={m} />)}
      </div>
    </Panel>
  );
}

function ContractsPanel({ d }) {
  return (
    <Panel eyebrow="04" title="Contracts" count={d.contracts.length}
      action={<PanelAction icon={<IconPlus size={12} />}>Add</PanelAction>}>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {d.contracts.map((c, i) => (
          <React.Fragment key={c.id}>
            {i > 0 && <div className="rule" style={{ margin: '0 14px' }} />}
            <ContractRow c={c} />
          </React.Fragment>
        ))}
      </div>
    </Panel>
  );
}

// Integrations — Twilio + Instagram + coming soon, with Voice Clone folded in.
function IntegrationCard({ name, init, fields, cols }) {
  return (
    <div className="neu-inset" style={{ borderRadius: 'var(--r-card)', padding: 18 }}>
      <div className="row" style={{ gap: 12, marginBottom: 16 }}>
        <BrandTile init={init} size={36} />
        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', flex: 1 }}>{name}</span>
        <ConnectedPill />
        <button className="la-btn la-btn--soft"><IconEdit size={12} />Edit</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))`, gap: 14 }}>
        {fields.map((f) => (
          <div key={f.label} style={{ gridColumn: f.wrap ? `span ${Math.min(2, cols)}` : 'span 1' }}>
            <IntegrationField f={f} />
          </div>
        ))}
      </div>
    </div>
  );
}

function IntegrationsPanel({ d, fieldCols = 3, stacked = false, withVoice = true }) {
  const ready = d.voices.filter((v) => v.ready).length;
  return (
    <Panel icon={<IconLink size={16} />} title="Integrations" count="2 connected"
      action={<PanelAction icon={<IconPlus size={12} />}>Add integration</PanelAction>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <IntegrationCard name="Twilio" init="T" fields={d.twilio.fields} cols={fieldCols} />
        <div style={{ display: stacked ? 'flex' : 'grid', flexDirection: stacked ? 'column' : undefined, gridTemplateColumns: stacked ? undefined : '1.1fr 1fr', gap: 16, alignItems: 'start' }}>
          <IntegrationCard name="Instagram" init="Ig" fields={d.instagram.fields} cols={2} />
          <div>
            <GroupLabel>Available</GroupLabel>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {d.comingSoon.map((s) => <ComingSoonChip key={s.key} s={s} />)}
            </div>
          </div>
        </div>

        {withVoice && (
          <div style={{ marginTop: 4, paddingTop: 18, borderTop: '1px solid var(--line)' }}>
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
              <div className="row" style={{ gap: 9 }}>
                <span style={{ color: 'var(--wine)', display: 'flex' }}><IconMic size={16} /></span>
                <h4 className="serif" style={{ margin: 0, fontSize: 18, color: 'var(--ink-soft)', fontWeight: 400 }}>Voice Clone</h4>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 9.5, color: 'var(--mute)', background: 'var(--bg)', boxShadow: 'var(--sh-inset-crisp)', padding: '2px 8px', borderRadius: 'var(--r-pill)' }}>{ready}/{d.voices.length} ready</span>
              </div>
              <PanelAction>Manage</PanelAction>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: stacked ? '1fr' : 'repeat(auto-fit,minmax(240px,1fr))', gap: 10 }}>
              {d.voices.map((v) => <VoiceRow key={v.lang} v={v} />)}
            </div>
          </div>
        )}
      </div>
    </Panel>
  );
}

// ════ Tab bodies ═════════════════════════════════════════════════════
function OverviewRegular({ d }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <AccountDetailsPanel d={d} cols={2} />
      <div style={{ display: 'grid', gridTemplateColumns: '1.45fr 1fr', gap: 22, alignItems: 'start' }}>
        <CampaignsPanel d={d} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          <TeamPanel d={d} />
          <ContractsPanel d={d} />
        </div>
      </div>
    </div>
  );
}

function OverviewUltra({ d }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(560px, 600px) minmax(360px, 1.05fr) minmax(320px, 0.9fr) minmax(320px, 0.95fr)', gap: 20, alignItems: 'start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <AccountDetailsPanel d={d} cols={2} />
        <IntegrationsPanel d={d} fieldCols={2} stacked />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <CampaignsPanel d={d} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <TeamPanel d={d} />
        <ContractsPanel d={d} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, height: '100%' }}>
        <KBPanel d={d} />
      </div>
    </div>
  );
}

function TabContent({ tab, ultra, d }) {
  if (tab === 'overview') return ultra ? <OverviewUltra d={d} /> : <OverviewRegular d={d} />;
  if (tab === 'integrations') return <IntegrationsPanel d={d} fieldCols={3} />;
  if (tab === 'knowledge') return <KBPanel d={d} />;
  return null;
}

// ════ Workspace shell ════════════════════════════════════════════════
function AccountsWorkspace({ layoutOverride = 'auto' }) {
  const data = window.ACCOUNTS_DATA;
  const d = data.detail;
  const [tab, setTab] = React.useState('overview');
  const detailRef = React.useRef(null);
  const ultra = useUltraWide(detailRef, layoutOverride);
  const metrics = React.useMemo(() => deriveMetrics(d), [d]);
  const count = data.accountsList.reduce((n, g) => n + g.items.length, 0);

  const maxW = tab === 'overview' ? (ultra ? null : 1180) : tab === 'integrations' ? 1120 : 1080;

  return (
    <div className="la-app" style={{ display: 'flex', width: '100%', height: '100%', overflow: 'hidden' }}>
      <Sidebar active="Accounts" />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', height: '100%' }}>
        <TopBar tab={tab} setTab={setTab} count={count} />
        <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
          <Rail data={data} />
          <div ref={detailRef} style={{ flex: 1, minWidth: 0, overflowY: 'auto', background: 'var(--bg)', padding: '24px 30px 40px' }}>
            <div style={{ maxWidth: maxW || 'none', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 22 }}>
              <IdentityCard d={d} metrics={metrics} />
              <TabContent tab={tab} ultra={ultra} d={d} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, {
  useUltraWide, deriveMetrics, MetaChip, TopBar, Rail, IdentityCard, GroupLabel,
  AccountDetailsPanel, CampaignsPanel, TeamPanel, ContractsPanel, IntegrationsPanel,
  OverviewRegular, OverviewUltra, TabContent, AccountsWorkspace,
});
