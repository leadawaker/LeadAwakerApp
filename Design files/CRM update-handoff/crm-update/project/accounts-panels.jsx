// accounts-panels.jsx — the section panels that make up the Accounts detail.
// Pure presentational pieces: each takes the account `d` and renders one card.
// Composed by accounts-page.jsx into the Overview dashboard + the focused tabs.
// Depends on: components.jsx, accounts-components.jsx, accounts-data.js

// ─── Summary stat tile (key metrics) ─────────────────────────────────
function StatTile({ eyebrow, big, sub, accent }) {
  return (
    <div className="neu-raised" style={{ borderRadius: 'var(--r-card)', padding: '15px 17px' }}>
      <div className="eyebrow eyebrow-sm">{eyebrow}</div>
      <div style={{ marginTop: 7 }}>
        <span className="serif" style={{ fontSize: 28, color: accent ? 'var(--wine)' : 'var(--ink)', lineHeight: 1 }}>{big}</span>
      </div>
      <div style={{ fontSize: 10.5, color: 'var(--mute)', marginTop: 5 }}>{sub}</div>
    </div>
  );
}

// ─── Reusable composer panels ────────────────────────────────────────

function AccountDetailsPanel({ d, cols = 1, polished = false }) {
  const left = (
    <>
      <div className="row" style={{ gap: 8, padding: '2px 0 8px' }}>
        <IconShield size={13} style={{ color: 'var(--mute-2)' }} />
        <span className="eyebrow eyebrow-sm">Overview</span>
        <div className="rule" style={{ flex: 1 }} />
      </div>
      <FieldRow label="Status"  value={d.overview.status} dropdown />
      <FieldRow label="Type"    value={d.overview.type}   dropdown />
      <FieldRow label="Niche"   value={d.overview.niche} />
      <div className="row" style={{ gap: 8, padding: '16px 0 8px' }}>
        <IconMail size={13} style={{ color: 'var(--mute-2)' }} />
        <span className="eyebrow eyebrow-sm">Contact</span>
        <div className="rule" style={{ flex: 1 }} />
      </div>
      <FieldRow label="Email"   value={d.contact.email} />
      <FieldRow label="Phone"   value={d.contact.phone}   mono />
      <FieldRow label="Website" value={d.contact.website} mono />
      <FieldRow label="Address" value={d.contact.address} />
    </>
  );
  const right = (
    <>
      <div className="row" style={{ gap: 8, padding: '2px 0 8px' }}>
        <IconClock size={13} style={{ color: 'var(--mute-2)' }} />
        <span className="eyebrow eyebrow-sm">Schedule</span>
        <div className="rule" style={{ flex: 1 }} />
      </div>
      <FieldRow label="Timezone"   value={d.schedule.timezone}  dropdown />
      <FieldRow label="Language"   value={d.schedule.language}  dropdown />
      <FieldRow label="Hours"      value={`${d.schedule.hoursOpen} – ${d.schedule.hoursClose}`} mono />
      <FieldRow label="Daily sends" value={d.schedule.dailySends} mono />
      <FieldRow label="Opt-out"    value={d.schedule.optOut}    mono />
      <div className="row" style={{ gap: 8, padding: '16px 0 8px' }}>
        <IconFile size={13} style={{ color: 'var(--mute-2)' }} />
        <span className="eyebrow eyebrow-sm">Notes</span>
        <div className="rule" style={{ flex: 1 }} />
      </div>
      <FieldRow label="Tax ID"     value={d.meta.taxId}         mono muted />
      <div style={{ padding: '7px 0' }}>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 9.5, letterSpacing: '0.13em', textTransform: 'uppercase', color: 'var(--mute)', marginBottom: 7 }}>Description</div>
        <div className="neu-inset-crisp" style={{ padding: '11px 13px', borderRadius: 'var(--r-button)', fontSize: 12.5, lineHeight: 1.55, color: 'var(--ink-soft)' }}>{d.meta.description}</div>
      </div>
    </>
  );
  return (
    <Panel eyebrow="01" title="Account Details" polished={polished}
      action={<button className="la-btn la-btn--inset"><IconEdit size={12} />Edit</button>}>
      {cols === 2
        ? <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 28 }}><div>{left}</div><div>{right}</div></div>
        : <div>{left}{right}</div>}
    </Panel>
  );
}

function CampaignsPanel({ d, polished = false }) {
  return (
    <Panel eyebrow="02" title="Campaigns" count={`${d.campaigns.length} active`} polished={polished}
      action={<PanelAction wine icon={<IconPlus size={12} />}>New campaign</PanelAction>}
      bodyStyle={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
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

function ContractsPanel({ d, polished = false }) {
  return (
    <Panel eyebrow="03" title="Contracts" count={d.contracts.length} polished={polished}
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

function TeamPanel({ d, polished = false }) {
  return (
    <Panel eyebrow="04" title="Team" count={`${d.team.length} members`} polished={polished}
      action={<PanelAction icon={<IconPlus size={12} />}>Invite</PanelAction>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {d.team.map((m) => <TeamRow key={m.id} m={m} />)}
      </div>
    </Panel>
  );
}

function VoicePanel({ d, polished = false }) {
  const ready = d.voices.filter((v) => v.ready).length;
  return (
    <Panel icon={<IconMic size={17} />} title="Voice Clone" count={`${ready}/${d.voices.length} ready`} polished={polished}
      action={<PanelAction>Manage</PanelAction>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {d.voices.map((v) => <VoiceRow key={v.lang} v={v} />)}
      </div>
    </Panel>
  );
}

function KnowledgePanel({ d, polished = false, compact = false }) {
  return (
    <Panel icon={<IconBook size={16} />} title="Knowledge Base" count={`${d.knowledge.count} entries`} polished={polished}
      action={<PanelAction icon={<IconPlus size={12} />}>Add</PanelAction>}>
      <KnowledgeEmpty compact={compact} />
    </Panel>
  );
}

function IntegrationsPanel({ d, fieldCols = 3, polished = false }) {
  const IntegrationCard = ({ name, init, fields, cols }) => (
    <div className="neu-inset" style={{ borderRadius: 'var(--r-card)', padding: 18 }}>
      <div className="row" style={{ gap: 12, marginBottom: 16 }}>
        <BrandTile init={init} size={36} />
        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', flex: 1 }}>{name}</span>
        <ConnectedPill />
        <button className="la-btn la-btn--soft"><IconEdit size={12} />Edit</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 14 }}>
        {fields.map((f) => (
          <div key={f.label} style={{ gridColumn: f.wrap ? `span ${Math.min(2, cols)}` : 'span 1' }}>
            <IntegrationField f={f} />
          </div>
        ))}
      </div>
    </div>
  );
  return (
    <Panel icon={<IconLink size={16} />} title="Integrations" count="2 connected" polished={polished}
      action={<PanelAction icon={<IconPlus size={12} />}>Add integration</PanelAction>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <IntegrationCard name="Twilio" init="T" fields={d.twilio.fields} cols={fieldCols} />
        <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 16, alignItems: 'start' }}>
          <IntegrationCard name="Instagram" init="Ig" fields={d.instagram.fields} cols={2} />
          <div>
            <div className="row" style={{ gap: 8, padding: '2px 0 10px' }}>
              <span className="eyebrow eyebrow-sm">Available</span>
              <div className="rule" style={{ flex: 1 }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {d.comingSoon.map((s) => <ComingSoonChip key={s.key} s={s} />)}
            </div>
          </div>
        </div>
      </div>
    </Panel>
  );
}

Object.assign(window, {
  StatTile, AccountDetailsPanel, CampaignsPanel, ContractsPanel, TeamPanel,
  VoicePanel, KnowledgePanel, IntegrationsPanel,
});
