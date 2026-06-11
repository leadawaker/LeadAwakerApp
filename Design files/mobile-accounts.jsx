// mobile-accounts.jsx — Accounts for the Lead Awaker mobile app.
// Reflows desktop Direction C (tabbed workspace) into a phone screen:
// a grouped accounts list → account detail in a bottom sheet with a
// horizontally-scrolling tab bar (Overview · Campaigns · Contracts · Team ·
// Integrations). Reached from the More menu (Admin → Accounts).
//
// Depends on: accounts-data.js (ACCOUNTS_DATA), mobile-shell.jsx (MobSheet,
// MobRecede, IconBtn), mobile-detail.jsx (MobCard), components.jsx (icons,
// StatusPill). MA*-prefixed to avoid global clashes.

// ─── Local icons ────────────────────────────────────────────────────
const MAIArrow  = (p) => <Icon {...p} d={<path d="M15 6l-6 6 6 6"/>} />;
const MAIFile   = (p) => <Icon {...p} d={<><path d="M6 3h9l4 4v14H6z"/><path d="M15 3v5h4"/></>} />;
const MAIBook   = (p) => <Icon {...p} d={<><path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h11"/></>} />;
const MAIMic    = (p) => <Icon {...p} d={<><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></>} />;
const MAILink   = (p) => <Icon {...p} d={<><path d="M9 15l6-6"/><path d="M11 7l1-1a4 4 0 0 1 6 6l-1 1M13 17l-1 1a4 4 0 0 1-6-6l1-1"/></>} />;
const MAIEye    = (p) => <Icon {...p} d={<><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></>} />;
const MAICopy   = (p) => <Icon {...p} d={<><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/></>} />;
const MAIEdit   = (p) => <Icon {...p} d={<><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M14 6l4 4"/></>} />;
const MAIShare  = (p) => <Icon {...p} d={<><circle cx="6" cy="12" r="2.5"/><circle cx="17" cy="6" r="2.5"/><circle cx="17" cy="18" r="2.5"/><path d="M8.2 10.8l6.6-3.6M8.2 13.2l6.6 3.6"/></>} />;
const MAIPlay   = (p) => <Icon {...p} d={<path d="M7 4v16l13-8z" fill="currentColor" stroke="none"/>} />;
const MAIUp     = (p) => <Icon {...p} d={<><path d="M12 16V4M8 8l4-4 4 4"/><path d="M5 20h14"/></>} />;
const MAIUsers  = (p) => <Icon {...p} d={<><circle cx="9" cy="9" r="3.2"/><path d="M3 19c1-3 3.2-4.5 6-4.5s5 1.5 6 4.5"/><circle cx="17.5" cy="7.5" r="2.2"/><path d="M15.5 15.5c.6-1.2 2-2 3.5-2s2.6.6 3.2 1.6"/></>} />;
const MAIGrid   = (p) => <Icon {...p} d={<><rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/></>} />;

// ─── Pills ──────────────────────────────────────────────────────────
function MARolePill({ role }) {
  const owner = role === 'Owner';
  return (
    <span style={{
      fontFamily: 'var(--mono)', fontSize: 8.5, fontWeight: 700, letterSpacing: '0.1em',
      textTransform: 'uppercase', padding: '3px 8px', borderRadius: 'var(--r-pill)',
      color: owner ? 'var(--wine)' : 'var(--mute)',
      background: owner ? 'var(--wine-tint)' : 'var(--bg)',
      boxShadow: owner ? 'inset 0 0 0 1px rgba(94,34,48,0.18)' : 'var(--sh-inset-crisp)',
    }}>{role}</span>
  );
}
function MAContractPill({ status }) {
  const map = {
    active:  { c: 'var(--good)', t: 'Active',  tint: 'var(--good-tint)' },
    pending: { c: 'var(--warn)', t: 'Pending', tint: 'var(--warn-tint)' },
    expired: { c: 'var(--mute-2)', t: 'Expired', tint: 'var(--bg)' },
  };
  const s = map[status] || map.expired;
  return (
    <span className="row" style={{
      gap: 5, fontFamily: 'var(--mono)', fontSize: 8.5, fontWeight: 700, letterSpacing: '0.09em',
      textTransform: 'uppercase', padding: '3px 8px', borderRadius: 'var(--r-pill)',
      color: s.c, background: s.tint, boxShadow: status === 'expired' ? 'var(--sh-inset-crisp)' : 'none',
    }}><span className="dot" style={{ background: s.c }} />{s.t}</span>
  );
}
function MAConnectedPill() {
  return (
    <span className="row" style={{
      gap: 5, fontFamily: 'var(--mono)', fontSize: 8.5, fontWeight: 700, letterSpacing: '0.1em',
      textTransform: 'uppercase', padding: '3px 9px', borderRadius: 'var(--r-pill)',
      color: 'var(--good)', background: 'var(--good-tint)',
    }}><span className="dot" style={{ background: 'var(--good)' }} />Connected</span>
  );
}
function MABrandTile({ init, size = 34, connected = true }) {
  return (
    <span style={{
      width: size, height: size, borderRadius: 'var(--r-button)', flexShrink: 0,
      background: connected ? 'var(--wine-grad)' : 'var(--bg)',
      boxShadow: connected ? 'var(--sh-raised-crisp), inset 0 1px 0 rgba(255,255,255,0.12)' : 'var(--sh-inset-crisp)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: connected ? 'var(--paper)' : 'var(--mute-2)', fontFamily: '"Yeseva One", serif',
      fontSize: size * 0.46, lineHeight: 1, paddingBottom: 1,
    }}>{init}</span>
  );
}
function MAAvatar({ init, size = 38, tone = 'bark' }) {
  const bg = tone === 'wine' ? 'var(--wine-grad)' : 'linear-gradient(145deg, #8a6e4a, #5a4530)';
  return (
    <span style={{
      width: size, height: size, borderRadius: 'var(--r-pill)', flexShrink: 0,
      background: bg, boxShadow: 'var(--sh-raised-crisp)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: 'var(--paper)', fontFamily: 'var(--mono)', fontSize: size * 0.32, letterSpacing: '0.03em',
    }}>{init}</span>
  );
}

// ─── List screen ────────────────────────────────────────────────────
function MAListBar({ onBack }) {
  return (
    <div style={{ flexShrink: 0, background: 'var(--bg)', borderBottom: '1px solid var(--line)' }}>
      <div className="row" style={{ justifyContent: 'space-between', padding: '12px 12px 6px' }}>
        <button onClick={onBack} className="row" style={{
          gap: 7, padding: '7px 13px 7px 9px', borderRadius: 'var(--r-pill)', border: 'none', cursor: 'pointer',
          background: 'var(--surface)', boxShadow: 'var(--sh-raised-crisp)', color: 'var(--ink)',
          fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase',
        }}><MAIArrow size={15} />More</button>
        <div className="row" style={{ gap: 8 }}>
          <IconBtn Ic={IconSearch} />
          <IconBtn Ic={IconBell} dot />
        </div>
      </div>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-end', padding: '4px 18px 16px' }}>
        <span className="serif" style={{ fontSize: 34, color: 'var(--ink)', letterSpacing: '-0.02em' }}>Accounts</span>
        <div className="row" style={{ gap: 8 }}>
          <IconBtn Ic={IconFilter} />
          <IconBtn Ic={MAIGrid} />
        </div>
      </div>
    </div>
  );
}

function MAListCard({ a, onOpen }) {
  return (
    <button onClick={(e) => onOpen(a, e)} className="la-camp-card" style={{
      width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer',
      padding: '14px 16px', borderRadius: 'var(--r-card)', gap: 14, minHeight: 64,
      background: 'var(--surface)', boxShadow: 'var(--sh-raised-crisp)',
    }}>
      <div className="la-mono-tile" style={{ width: 46, height: 46, fontFamily: 'var(--mono)', fontSize: 15 }}>{a.mono}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="row" style={{ gap: 7, marginBottom: 5 }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: '0 1 auto' }}>{a.name}</span>
          {a.type && <span style={{ fontFamily: 'var(--mono)', fontSize: 7.5, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--mute-2)', border: '1px solid var(--line-strong)', borderRadius: 3, padding: '1px 5px', flexShrink: 0 }}>{a.type}</span>}
        </div>
        <div className="row" style={{ gap: 8 }}>
          <span className="row" style={{ gap: 5, fontSize: 11.5, color: 'var(--mute)' }}><span className="dot" style={{ background: 'var(--good)' }} />Active</span>
          {a.members > 0 && <span className="row" style={{ gap: 5, fontSize: 11, color: 'var(--mute-2)' }}><MAIUsers size={12} />{a.members}</span>}
        </div>
      </div>
      <span style={{ color: 'var(--mute-2)', flexShrink: 0, display: 'flex' }}><IconChev size={16} /></span>
    </button>
  );
}

function MAListScreen({ onBack, onOpen }) {
  const D = window.ACCOUNTS_DATA;
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
      <MAListBar onBack={onBack} />
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 14px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {D.accountsList.map((g) => (
          <React.Fragment key={g.group}>
            <div className="row" style={{ gap: 10, padding: '4px 2px 0' }}>
              <span className="eyebrow eyebrow-sm">{g.group} — {g.items.length}</span>
              <div className="rule" style={{ flex: 1 }} />
            </div>
            {g.items.map((a) => <MAListCard key={a.id} a={a} onOpen={onOpen} />)}
          </React.Fragment>
        ))}
      </div>
      <button style={{
        position: 'absolute', right: 18, bottom: 18, height: 52, padding: '0 22px', borderRadius: 'var(--r-card)',
        border: 'none', cursor: 'pointer', background: 'var(--wine-grad)', boxShadow: 'var(--sh-raised-medium)',
        color: 'var(--paper)', display: 'flex', alignItems: 'center', gap: 9,
        fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase',
      }}>
        <IconPlus size={16} />New
      </button>
    </div>
  );
}

// ─── Detail: header + tab bar ───────────────────────────────────────
function MADetailHeader({ d, onBack }) {
  return (
    <div style={{ flexShrink: 0, background: 'var(--bg)', borderBottom: '1px solid var(--line)', padding: '6px 14px 0' }}>
      <div className="row" style={{ gap: 12, padding: '8px 0 12px' }}>
        <div style={{
          width: 46, height: 46, borderRadius: 'var(--r-card)', flexShrink: 0, background: 'var(--wine-grad)',
          boxShadow: 'var(--sh-raised-medium), inset 0 1px 0 rgba(255,255,255,0.12)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--paper)',
          fontFamily: '"Yeseva One", serif', fontSize: 21, paddingBottom: 2,
        }}>{d.mono[0]}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="row" style={{ gap: 9, marginBottom: 3 }}>
            <span className="serif" style={{ flex: '0 1 auto', minWidth: 0, fontSize: 22, color: 'var(--ink)', letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</span>
            <span style={{ flexShrink: 0 }}><StatusPill status={d.status} /></span>
          </div>
          <div className="row" style={{ gap: 7, fontFamily: 'var(--mono)', fontSize: 9.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--mute)' }}>
            <span>{d.type}</span><span style={{ color: 'var(--mute-2)' }}>·</span><span>{d.niche}</span><span style={{ color: 'var(--mute-2)' }}>·</span><span style={{ color: 'var(--mute-2)' }}>#{d.id}</span>
          </div>
        </div>
        <IconBtn Ic={IconMore} />
      </div>
    </div>
  );
}

function MATabBar({ tabs, tab, setTab }) {
  return (
    <div style={{ flexShrink: 0, background: 'var(--bg)', borderBottom: '1px solid var(--line)', padding: '0 10px' }}>
      <div style={{ display: 'flex', gap: 4, overflowX: 'auto', scrollbarWidth: 'none', padding: '0 0 0' }}>
        {tabs.map(([k, label]) => {
          const on = k === tab;
          return (
            <button key={k} onClick={() => setTab(k)} style={{
              flex: '0 0 auto', border: 'none', cursor: 'pointer', background: 'transparent',
              padding: '13px 12px 11px', position: 'relative',
              fontFamily: 'var(--mono)', fontSize: 10.5, letterSpacing: '0.08em', textTransform: 'uppercase',
              fontWeight: on ? 700 : 500, color: on ? 'var(--wine)' : 'var(--mute)',
            }}>
              {label}
              <span style={{ position: 'absolute', left: 12, right: 12, bottom: 0, height: 2, borderRadius: '2px 2px 0 0', background: on ? 'var(--wine)' : 'transparent' }} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Detail: tab bodies ─────────────────────────────────────────────
function MAFieldRows({ rows }) {
  return (
    <MobCard pad={6}>
      {rows.map(([k, v, mono], i) => (
        <div key={i} className="row" style={{ justifyContent: 'space-between', gap: 14, padding: '12px 14px', borderTop: i ? '1px solid var(--line)' : 'none' }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 9.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--mute-2)', flexShrink: 0, paddingTop: 2 }}>{k}</span>
          <span style={{ fontSize: 13, color: v ? 'var(--ink-soft)' : 'var(--mute-2)', textAlign: 'right', fontFamily: mono ? 'var(--mono)' : 'var(--sans)', maxWidth: '64%', wordBreak: mono ? 'break-all' : 'normal' }}>{v || '—'}</span>
        </div>
      ))}
    </MobCard>
  );
}

function MAOverview({ d }) {
  const cards = [
    { label: 'Campaigns', value: String(d.campaigns.length), sub: 'All active', accent: 'var(--wine)', Ic: IconCampaigns },
    { label: 'Avg response', value: '25%', sub: 'Across all', accent: 'var(--good)', Ic: IconActivity },
    { label: 'Contracts', value: String(d.contracts.length), sub: '1 active', accent: 'var(--stage-contacted)', Ic: MAIFile },
    { label: 'Team', value: String(d.team.length), sub: '1 owner', accent: 'var(--mute-2)', Ic: MAIUsers },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '14px 0 28px' }}>
      <div><MBStatStrip cards={cards} /></div>
      <div style={{ padding: '0 14px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <div className="row" style={{ gap: 8, padding: '0 2px 8px' }}><span className="eyebrow eyebrow-sm">Overview</span><div className="rule" style={{ flex: 1 }} /></div>
          <MAFieldRows rows={[['Status', d.overview.status], ['Type', d.overview.type], ['Niche', d.overview.niche]]} />
        </div>
        <div>
          <div className="row" style={{ gap: 8, padding: '0 2px 8px' }}><span className="eyebrow eyebrow-sm">Contact</span><div className="rule" style={{ flex: 1 }} /></div>
          <MAFieldRows rows={[['Email', d.contact.email], ['Phone', d.contact.phone, true], ['Website', d.contact.website, true], ['Address', d.contact.address]]} />
        </div>
        <div>
          <div className="row" style={{ gap: 8, padding: '0 2px 8px' }}><span className="eyebrow eyebrow-sm">Schedule</span><div className="rule" style={{ flex: 1 }} /></div>
          <MAFieldRows rows={[['Timezone', d.schedule.timezone], ['Language', d.schedule.language], ['Hours', `${d.schedule.hoursOpen} – ${d.schedule.hoursClose}`, true], ['Daily sends', d.schedule.dailySends, true], ['Opt-out', d.schedule.optOut, true]]} />
        </div>
        <div>
          <div className="row" style={{ gap: 8, padding: '0 2px 8px' }}><span className="eyebrow eyebrow-sm">Description</span><div className="rule" style={{ flex: 1 }} /></div>
          <MobCard pad={16}><div style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--ink-soft)' }}>{d.meta.description}</div></MobCard>
        </div>
      </div>
    </div>
  );
}

function MACampaignRow({ c }) {
  return (
    <MobCard pad={13} style={{ marginBottom: 10 }}>
      <div className="row" style={{ gap: 13 }}>
        <div className="la-mono-tile" style={{ width: 42, height: 42, fontFamily: 'var(--mono)', fontSize: 14, background: 'var(--bg)', boxShadow: 'var(--sh-inset-crisp)', color: 'var(--mute)' }}>{c.mono}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 5 }}>{c.name}</div>
          <div className="row" style={{ gap: 8 }}>
            <StatusPill status={c.status} />
            <span className="row" style={{ gap: 5, fontFamily: 'var(--mono)', fontSize: 9.5, color: 'var(--mute)', letterSpacing: '0.06em' }}><IconWA size={12} />{c.channel}</span>
          </div>
        </div>
      </div>
      <div className="row" style={{ justifyContent: 'space-between', marginTop: 12, paddingTop: 11, borderTop: '1px solid var(--line)' }}>
        <div><div className="serif" style={{ fontSize: 19, color: 'var(--ink)', lineHeight: 1 }}>{c.leads}</div><div style={{ fontFamily: 'var(--mono)', fontSize: 8, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--mute-2)', marginTop: 3 }}>Leads</div></div>
        <div style={{ textAlign: 'right' }}><div className="serif" style={{ fontSize: 19, color: 'var(--wine)', lineHeight: 1 }}>{c.resp}%</div><div style={{ fontFamily: 'var(--mono)', fontSize: 8, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--mute-2)', marginTop: 3 }}>Response</div></div>
      </div>
    </MobCard>
  );
}

function MAContractRow({ c }) {
  return (
    <MobCard pad={14} style={{ marginBottom: 10 }}>
      <div className="row" style={{ gap: 13 }}>
        <div style={{ width: 38, height: 38, borderRadius: 'var(--r-button)', flexShrink: 0, background: 'var(--bg)', boxShadow: 'var(--sh-inset-crisp)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--mute)' }}><MAIFile size={17} /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 5 }}>{c.name}</div>
          <MAContractPill status={c.status} />
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div className="row" style={{ justifyContent: 'flex-end', alignItems: 'baseline', gap: 2 }}>
            <span className="serif" style={{ fontSize: 18, color: 'var(--ink)', lineHeight: 1 }}>{c.value}</span>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--mute-2)' }}>/mo</span>
          </div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 8.5, color: 'var(--mute-2)', marginTop: 5 }}>Renews {c.renewal}</div>
        </div>
      </div>
    </MobCard>
  );
}

function MATeamRow({ m }) {
  return (
    <div className="row" style={{ gap: 13, padding: '12px 14px', borderTop: '1px solid var(--line)' }}>
      <MAAvatar init={m.init} size={38} tone={m.role === 'Owner' ? 'wine' : 'bark'} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</div>
        <div style={{ fontSize: 11.5, color: 'var(--mute)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.email}</div>
      </div>
      <MARolePill role={m.role} />
    </div>
  );
}

function MAVoiceRow({ v }) {
  return (
    <div className="row" style={{ gap: 12, padding: '12px 13px', borderRadius: 'var(--r-surface)', background: v.ready ? 'var(--surface)' : 'var(--bg)', boxShadow: v.ready ? 'var(--sh-raised-crisp)' : 'var(--sh-inset-crisp)' }}>
      <span style={{ width: 32, height: 32, borderRadius: 'var(--r-button)', flexShrink: 0, background: 'var(--card)', boxShadow: 'var(--sh-raised-crisp)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>{v.flag}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="row" style={{ gap: 8, marginBottom: v.ready ? 3 : 0 }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 10.5, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--ink-soft)' }}>{v.lang}</span>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 8, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: v.ready ? 'var(--good)' : 'var(--mute-2)' }}>{v.ready ? '● Ready' : '○ None'}</span>
        </div>
        {v.ready && <div style={{ fontSize: 11, color: 'var(--mute)', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>"{v.sample}"</div>}
      </div>
      {v.ready
        ? <button className="la-btn la-btn--soft la-btn--icon" style={{ flexShrink: 0 }}><MAIPlay size={12} /></button>
        : <button className="la-btn la-btn--soft" style={{ flexShrink: 0 }}><MAIUp size={12} />Upload</button>}
    </div>
  );
}

function MATeamTab({ d }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '14px 14px 28px' }}>
      <div>
        <div className="row" style={{ gap: 10, padding: '0 2px 8px' }}><span className="eyebrow eyebrow-sm">Members — {d.team.length}</span><div className="rule" style={{ flex: 1 }} /><button className="la-btn la-btn--soft"><IconPlus size={12} />Invite</button></div>
        <MobCard pad={2}>
          {d.team.map((m, i) => <MATeamRowFirst key={m.id} m={m} first={i === 0} />)}
        </MobCard>
      </div>
      <div>
        <div className="row" style={{ gap: 10, padding: '0 2px 8px' }}><span className="eyebrow eyebrow-sm">Knowledge base</span><div className="rule" style={{ flex: 1 }} /></div>
        <MobCard pad={20}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 9 }}>
            <div style={{ width: 44, height: 44, borderRadius: 'var(--r-surface)', background: 'var(--bg)', boxShadow: 'var(--sh-inset-crisp)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--mute-2)' }}><MAIBook size={20} /></div>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink-soft)' }}>No entries yet</div>
            <div style={{ fontSize: 12, color: 'var(--mute)', lineHeight: 1.5, maxWidth: 250 }}>Add pricing, services and FAQs so the AI can answer lead questions accurately.</div>
            <button className="la-btn la-btn--wine" style={{ marginTop: 6 }}><IconPlus size={12} />Add entry</button>
          </div>
        </MobCard>
      </div>
    </div>
  );
}
// team row that hides its top border when it's the first in the card
function MATeamRowFirst({ m, first }) {
  return (
    <div className="row" style={{ gap: 13, padding: '12px 14px', borderTop: first ? 'none' : '1px solid var(--line)' }}>
      <MAAvatar init={m.init} size={38} tone={m.role === 'Owner' ? 'wine' : 'bark'} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</div>
        <div style={{ fontSize: 11.5, color: 'var(--mute)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.email}</div>
      </div>
      <MARolePill role={m.role} />
    </div>
  );
}

function MAIntegrationField({ f }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 8.5, letterSpacing: '0.13em', textTransform: 'uppercase', color: 'var(--mute-2)', marginBottom: 5 }}>{f.label}</div>
      <div className="row" style={{ gap: 8, background: 'var(--bg)', boxShadow: 'var(--sh-inset-crisp)', borderRadius: 'var(--r-button)', padding: '8px 11px' }}>
        <span style={{ flex: 1, minWidth: 0, fontFamily: f.mono ? 'var(--mono)' : 'var(--sans)', fontSize: 11, color: f.secret ? 'var(--mute)' : 'var(--ink-soft)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: f.secret ? '0.1em' : 0 }}>{f.value}</span>
        {f.secret && <span style={{ color: 'var(--mute-2)', display: 'flex' }}><MAIEye size={13} /></span>}
        {f.copy && <span style={{ color: 'var(--mute-2)', display: 'flex' }}><MAICopy size={13} /></span>}
      </div>
    </div>
  );
}

function MAIntegrationCard({ name, init, fields }) {
  return (
    <MobCard pad={16}>
      <div className="row" style={{ gap: 11, marginBottom: 15 }}>
        <MABrandTile init={init} size={36} />
        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', flex: 1 }}>{name}</span>
        <MAConnectedPill />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {fields.map((f) => <MAIntegrationField key={f.label} f={f} />)}
      </div>
      <button className="la-btn la-btn--soft" style={{ width: '100%', marginTop: 14, justifyContent: 'center' }}><MAIEdit size={12} />Edit connection</button>
    </MobCard>
  );
}

function MAIntegrationsTab({ d }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '14px 14px 28px' }}>
      <MAIntegrationCard name="Twilio" init="T" fields={d.twilio.fields} />
      <MAIntegrationCard name="Instagram" init="Ig" fields={d.instagram.fields} />
      <div>
        <div className="row" style={{ gap: 10, padding: '2px 2px 8px' }}><span className="eyebrow eyebrow-sm">Available</span><div className="rule" style={{ flex: 1 }} /></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {d.comingSoon.map((s) => (
            <div key={s.key} className="row" style={{ gap: 10, padding: '11px 12px', borderRadius: 'var(--r-surface)', background: 'var(--bg)', boxShadow: 'var(--sh-inset-crisp)' }}>
              <MABrandTile init={s.init} size={30} connected={false} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--mute)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.label}</div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 8, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--mute-2)', marginTop: 2 }}>Soon</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Detail body (in the sheet) ─────────────────────────────────────
function MADetailBody({ d, onBack }) {
  const [tab, setTab] = React.useState('overview');
  const tabs = [['overview', 'Overview'], ['campaigns', 'Campaigns'], ['contracts', 'Contracts'], ['team', 'Team'], ['integrations', 'Integrations']];
  return (
    <div className="la-app" style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      <div style={{ flexShrink: 0, paddingTop: 14 }}>
        <MADetailHeader d={d} onBack={onBack} />
      </div>
      {/* sticky action row */}
      <div className="row" style={{ gap: 8, padding: '12px 14px', flexShrink: 0, background: 'var(--bg)', borderBottom: '1px solid var(--line)' }}>
        <button className="la-btn la-btn--soft" style={{ flex: 1, justifyContent: 'center' }}><MAIShare size={13} />Share</button>
        <button className="la-btn la-btn--wine" style={{ flex: 1, justifyContent: 'center' }}><MAIEdit size={13} />Edit account</button>
      </div>
      <MATabBar tabs={tabs} tab={tab} setTab={setTab} />
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {tab === 'overview' && <MAOverview d={d} />}
        {tab === 'campaigns' && (
          <div style={{ padding: '14px 14px 28px' }}>
            <div className="row" style={{ gap: 10, padding: '0 2px 10px' }}><span className="eyebrow eyebrow-sm">Active — {d.campaigns.length}</span><div className="rule" style={{ flex: 1 }} /><button className="la-btn la-btn--wine"><IconPlus size={12} />New</button></div>
            {d.campaigns.map((c) => <MACampaignRow key={c.id} c={c} />)}
          </div>
        )}
        {tab === 'contracts' && (
          <div style={{ padding: '14px 14px 28px' }}>
            <div className="row" style={{ gap: 10, padding: '0 2px 10px' }}><span className="eyebrow eyebrow-sm">Contracts — {d.contracts.length}</span><div className="rule" style={{ flex: 1 }} /><button className="la-btn la-btn--soft"><IconPlus size={12} />Add</button></div>
            {d.contracts.map((c) => <MAContractRow key={c.id} c={c} />)}
            <div className="row" style={{ gap: 10, padding: '18px 2px 10px' }}><MAIMic size={13} style={{ color: 'var(--mute-2)' }} /><span className="eyebrow eyebrow-sm">Voice clone</span><div className="rule" style={{ flex: 1 }} /></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>{d.voices.map((v) => <MAVoiceRow key={v.lang} v={v} />)}</div>
          </div>
        )}
        {tab === 'team' && <MATeamTab d={d} />}
        {tab === 'integrations' && <MAIntegrationsTab d={d} />}
      </div>
    </div>
  );
}

// ─── Screen (list + detail sheet) ───────────────────────────────────
function MobAccountsScreen({ onBack }) {
  const D = window.ACCOUNTS_DATA;
  const [sel, setSel] = React.useState(null);
  const [open, setOpen] = React.useState(false);
  const openAccount = (a) => {
    // Lead Awaker (id 1) has the full detail; others reuse it as a stand-in.
    setSel(D.detail);
    requestAnimationFrame(() => requestAnimationFrame(() => setOpen(true)));
  };
  const close = () => setOpen(false);
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <MobRecede open={open}>
        <MAListScreen onBack={onBack} onOpen={openAccount} />
      </MobRecede>
      <MobSheet open={open} onClose={close}>
        {sel && <MADetailBody d={sel} onBack={close} />}
      </MobSheet>
    </div>
  );
}

Object.assign(window, { MobAccountsScreen, MAListScreen, MADetailBody, MAOverview });
