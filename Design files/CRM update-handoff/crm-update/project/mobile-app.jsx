// mobile-app.jsx — Campaigns mobile app. Orchestrates the list screen, the
// campaign detail (Stats/Settings), the bottom tab routing, and the three
// list→detail transition variations (push / sheet / expand).
// Depends on: mobile-shell.jsx, mobile-detail.jsx, components.jsx, data.js.

// ─── Mobile campaign card (full-width, large touch target) ─────────
function MobCampaignCard({ c, onOpen }) {
  return (
    <button onClick={(e) => onOpen(c, e)} className={`la-camp-card ${c.active ? 'active' : ''}`} style={{
      width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer',
      padding: '14px 16px', borderRadius: 'var(--r-card)', gap: 14, minHeight: 64,
      background: c.active ? 'var(--card)' : 'var(--surface)',
      boxShadow: c.active ? 'var(--sh-raised-crisp)' : 'var(--sh-raised-crisp)',
    }}>
      <div className={`la-mono-tile ${c.active ? 'wine' : c.status === 'inactive' ? 'inactive' : ''}`} style={{ width: 46, height: 46 }}>{c.mono}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 5 }}>{c.name}</div>
        <div className="row" style={{ gap: 8 }}>
          <StatusPill status={c.status} />
          <span className="row" style={{ gap: 5, fontSize: 11, color: 'var(--mute)', minWidth: 0 }}>
            <span style={{ display: 'inline-block', width: 4, height: 4, borderRadius: '50%', background: 'var(--mute-2)', flexShrink: 0 }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.client}</span>
          </span>
        </div>
      </div>
      <span style={{ color: 'var(--mute-2)', flexShrink: 0, display: 'flex' }}><IconChev size={16} /></span>
    </button>
  );
}

// ─── List screen ───────────────────────────────────────────────────
function MobListScreen({ onOpen }) {
  const D = window.LA_DATA;
  const active = D.campaigns.filter(c => c.section === 'active');
  const inactive = D.campaigns.filter(c => c.section === 'inactive');
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
      <MobListBar />
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 14px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="row" style={{ gap: 10, padding: '0 2px 2px' }}>
          <span className="eyebrow eyebrow-sm">Active — {active.length}</span>
          <div className="rule" style={{ flex: 1 }} />
        </div>
        {active.map(c => <MobCampaignCard key={c.id} c={c} onOpen={onOpen} />)}
        <div className="row" style={{ gap: 10, padding: '10px 2px 2px' }}>
          <div className="rule" style={{ flex: 1 }} />
          <span className="eyebrow eyebrow-sm">Inactive — {inactive.length}</span>
          <div className="rule" style={{ flex: 1 }} />
        </div>
        {inactive.map(c => <MobCampaignCard key={c.id} c={c} onOpen={onOpen} />)}
      </div>
      {/* FAB */}
      <button style={{
        position: 'absolute', right: 18, bottom: 18,
        height: 52, padding: '0 22px', borderRadius: 'var(--r-card)', border: 'none', cursor: 'pointer',
        background: 'var(--wine-grad)', boxShadow: 'var(--sh-raised-medium)',
        color: 'var(--paper)', display: 'flex', alignItems: 'center', gap: 9,
        fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase',
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
        New
      </button>
    </div>
  );
}

// ─── Detail screen body (shared across transitions) ────────────────
function MobDetailBody({ campaign, onBack }) {
  const [tab, setTab] = React.useState('stats');
  return (
    <div className="la-app" style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      <MobDetailBar campaign={campaign} tab={tab} setTab={setTab} onBack={onBack} />
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {tab === 'stats' ? <MobStats /> : <MobSettings />}
      </div>
    </div>
  );
}

// ─── More menu ─────────────────────────────────────────────────────
function MobMore({ onNavigate }) {
  const groups = [
    { section: 'Engage', list: [['Referrals', IconGift], ['Chats', IconChats], ['Prospects', IconProspect]] },
    { section: 'Outreach', list: [['Cadence', IconCadence], ['Automations', IconAuto]] },
    { section: 'Admin', list: [['Accounts', IconAccts], ['Billing', IconBilling]] },
    { section: 'Backend', list: [['Prompt Library', IconLibrary], ['Settings', IconSettings]] },
  ];
  const routable = { Billing: 'Billing', Accounts: 'Accounts', Referrals: 'Referrals' };
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
      <div style={{ flexShrink: 0, background: 'var(--bg)', borderBottom: '1px solid var(--line)', padding: '16px 18px 14px' }}>
        <span className="serif" style={{ fontSize: 32, color: 'var(--ink)', letterSpacing: '-0.02em' }}>More</span>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 14px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* profile */}
        <MobCard pad={6}>
          <div className="row" style={{ gap: 12, padding: '10px 12px' }}>
            <span className="la-profile-av" style={{ width: 42, height: 42, borderRadius: 'var(--r-surface)', fontSize: 16 }}>RD</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>Ricardo D.</div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--mute-2)' }}>Agency Admin</div>
            </div>
            <span style={{ color: 'var(--mute-2)', display: 'flex' }}><IconChev size={16} /></span>
          </div>
        </MobCard>
        {groups.map((g, gi) => (
          <MobCard key={gi} pad={6}>
            <div className="eyebrow eyebrow-sm" style={{ padding: '12px 14px 6px' }}>{g.section}</div>
            {g.list.map(([label, Ic], i) => {
              const route = routable[label];
              return (
                <div key={i} onClick={() => route && onNavigate && onNavigate(route)} className="row" style={{ gap: 14, padding: '13px 14px', borderTop: i ? '1px solid var(--line)' : 'none', cursor: 'pointer' }}>
                  <span style={{ color: route ? 'var(--wine)' : 'var(--mute)', display: 'flex' }}><Ic size={18} /></span>
                  <span style={{ flex: 1, fontSize: 14, color: 'var(--ink)' }}>{label}</span>
                  <span style={{ color: 'var(--mute-2)', display: 'flex' }}><IconChev size={15} /></span>
                </div>
              );
            })}
          </MobCard>
        ))}
      </div>
    </div>
  );
}

// ─── Campaigns screen (owns its detail sheet — variation B) ────────
function MobCampaignsScreen() {
  const [sel, setSel] = React.useState(null);
  const [open, setOpen] = React.useState(false);
  const openCampaign = (c) => { setSel(c); requestAnimationFrame(() => requestAnimationFrame(() => setOpen(true))); };
  const close = () => setOpen(false);
  const campaign = sel || window.LA_DATA.campaigns.find(c => c.active);
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <MobRecede open={open}>
        <MobListScreen onOpen={openCampaign} />
      </MobRecede>
      <MobSheet open={open} onClose={close}>
        {sel && <MobDetailBody campaign={campaign} onBack={close} />}
      </MobSheet>
    </div>
  );
}

// ─── App — bottom-tab router + persistent nav ──────────────────────
function MobileApp() {
  const [tab, setTab] = React.useState('Campaigns');
  return (
    <div className="la-app" style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {tab === 'Campaigns' && <MobCampaignsScreen />}
        {tab === 'Tasks'     && <MobTasksScreen />}
        {tab === 'Leads'     && <MobLeadsScreen />}
        {tab === 'Calendar'  && <MobCalendarScreen />}
        {tab === 'Billing'   && <MobileBilling embedded />}
        {tab === 'Accounts'  && <MobAccountsScreen onBack={() => setTab('More')} />}
        {tab === 'Referrals' && <MobReferralsScreen onBack={() => setTab('More')} />}
        {tab === 'More'      && <MobMore onNavigate={setTab} />}
      </div>
      {/* Billing, Accounts & Referrals are sub-screens reached from More — keep More lit while there */}
      <MobBottomNav active={(tab === 'Billing' || tab === 'Accounts' || tab === 'Referrals') ? 'More' : tab} onTab={setTab} />
    </div>
  );
}

Object.assign(window, { MobileApp, MobCampaignsScreen, MobListScreen, MobCampaignCard, MobDetailBody, MobMore });
