// accounts-kb.jsx — Knowledge Base for the Accounts page.
// Grouped, collapsible categories of entries the AI injects into a lead
// conversation. Each entry carries a campaign SCOPE (all / hidden / specific)
// and an INJECT-AFTER rule (always, or after N inbound messages). Includes an
// inline Add-entry composer.
// Depends on: components.jsx (Icon, IconPlus, IconChev, IconHelp, IconCheck),
// accounts-components.jsx (Panel, PanelAction, IconEdit, IconTrash, IconUsers,
// IconClock, IconShield, IconBook), accounts-data.js

// ── category icons ───────────────────────────────────────────────────
const KBIServices = (p) => <Icon {...p} d={<><path d="M14.5 5.5a3.5 3.5 0 0 0-4.6 4.6L4 16l4 4 5.9-5.9a3.5 3.5 0 0 0 4.6-4.6l-2.3 2.3-2-2z"/></>} />;
const KBITag      = (p) => <Icon {...p} d={<><path d="M4 12l8-8 7 1 1 7-8 8z"/><circle cx="14.5" cy="9.5" r="1.3" fill="currentColor"/></>} />;
const KBIPin      = (p) => <Icon {...p} d={<><path d="M12 21s7-6.5 7-11a7 7 0 0 0-14 0c0 4.5 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/></>} />;
const KBIQuote    = (p) => <Icon {...p} d={<><path d="M8 7H5a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h2v-2a3 3 0 0 0-2-2.8"/><path d="M19 7h-3a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h2v-2a3 3 0 0 0-2-2.8"/></>} />;
const KBIClipboard= (p) => <Icon {...p} d={<><rect x="6" y="4" width="12" height="17" rx="2"/><path d="M9 4V3h6v1"/><path d="M9 10h6M9 14h4"/></>} />;

const KB_ICON = {
  services: KBIServices, faq: IconHelp, team: IconUsers, hours: IconClock,
  policies: KBIClipboard, pricing: KBITag, location: KBIPin, testimonials: KBIQuote,
};

// ── chips ────────────────────────────────────────────────────────────
function ScopeChip({ scope, campaigns }) {
  let label, kind;
  if (scope === 'all') { label = 'All'; kind = 'all'; }
  else if (scope === 'hidden') { label = 'Hidden'; kind = 'hidden'; }
  else {
    const idx = scope.map((id) => 'C' + (campaigns.findIndex((c) => c.id === id) + 1)).join('+');
    label = idx; kind = 'some';
  }
  const styles = {
    all:    { color: 'var(--wine)', bg: 'var(--wine-tint)', sh: 'inset 0 0 0 1px rgba(94,34,48,0.14)' },
    some:   { color: 'var(--warn)', bg: 'var(--warn-tint)', sh: 'none' },
    hidden: { color: 'var(--mute)', bg: 'var(--bg)', sh: 'var(--sh-inset-crisp)' },
  }[kind];
  return (
    <span style={{ fontFamily: 'var(--mono)', fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', padding: '2px 7px', borderRadius: 'var(--r-flush)', color: styles.color, background: styles.bg, boxShadow: styles.sh, whiteSpace: 'nowrap' }}>{label}</span>
  );
}

function InjectChip({ value }) {
  if (!value || value === 'always') return null;
  return (
    <span style={{ fontFamily: 'var(--mono)', fontSize: 9, fontWeight: 700, letterSpacing: '0.04em', padding: '2px 7px', borderRadius: 'var(--r-flush)', color: 'var(--stage-new)', background: 'rgba(108,90,140,0.13)', whiteSpace: 'nowrap' }}>{value}msg</span>
  );
}

// ── one entry row ────────────────────────────────────────────────────
function KBEntry({ e, campaigns, last }) {
  const [hover, setHover] = React.useState(false);
  return (
    <div onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ position: 'relative', padding: '11px 14px 13px 22px', borderLeft: '2px solid var(--line)' }}>
      <div className="row" style={{ gap: 8, marginBottom: 5, flexWrap: 'wrap', paddingRight: 56 }}>
        <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{e.title}</span>
        <ScopeChip scope={e.scope} campaigns={campaigns} />
        <InjectChip value={e.injectAfter} />
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--mute)', lineHeight: 1.5 }}>{e.body}</div>
      <div className="row" style={{ gap: 5, position: 'absolute', top: 8, right: 10, opacity: hover ? 1 : 0, transition: 'opacity 130ms', pointerEvents: hover ? 'auto' : 'none' }}>
        <button className="la-btn la-btn--inset la-btn--icon" style={{ width: 26, height: 26 }}><IconEdit size={12} /></button>
        <button className="la-btn la-btn--inset la-btn--icon" style={{ width: 26, height: 26, color: 'var(--wine)' }}><IconTrash size={12} /></button>
      </div>
    </div>
  );
}

// ── a collapsible category ───────────────────────────────────────────
function KBCategory({ cat, campaigns }) {
  const [open, setOpen] = React.useState(true);
  const Ic = KB_ICON[cat.icon] || IconBook;
  return (
    <div>
      <button onClick={() => setOpen((o) => !o)} className="row" style={{
        width: '100%', gap: 11, padding: '10px 14px', borderRadius: 'var(--r-surface)', cursor: 'pointer',
        border: 'none', background: 'var(--bg-2)', boxShadow: 'var(--sh-raised-crisp)', textAlign: 'left',
      }}>
        <span style={{ display: 'flex', color: 'var(--wine)' }}><Ic size={16} /></span>
        <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{cat.label}</span>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--mute)' }}>{cat.entries.length}</span>
        <span style={{ display: 'flex', color: 'var(--mute-2)', transform: open ? 'rotate(-90deg)' : 'rotate(90deg)', transition: 'transform 160ms' }}><IconChev size={13} /></span>
      </button>
      {open && (
        <div style={{ padding: '4px 0 8px 8px' }}>
          {cat.entries.map((e, i) => <KBEntry key={e.id} e={e} campaigns={campaigns} last={i === cat.entries.length - 1} />)}
        </div>
      )}
    </div>
  );
}

// ── campaign scope picker (popover) ──────────────────────────────────
function ScopePicker({ campaigns }) {
  const [open, setOpen] = React.useState(false);
  const [mode, setMode] = React.useState('all'); // all | hidden | some
  const [sel, setSel] = React.useState([]);
  const label = mode === 'all' ? 'All' : mode === 'hidden' ? 'Hidden' : `${sel.length || 0} selected`;
  const toggle = (id) => { setMode('some'); setSel((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]); };
  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen((o) => !o)} className="row" style={{ gap: 7, padding: '6px 11px', borderRadius: 'var(--r-pill)', border: 'none', cursor: 'pointer', background: 'var(--wine-tint)', boxShadow: 'inset 0 0 0 1px rgba(94,34,48,0.14)', color: 'var(--wine)', fontFamily: 'var(--mono)', fontSize: 10.5, fontWeight: 700, letterSpacing: '0.04em' }}>
        {label}<span style={{ display: 'flex', transform: 'rotate(90deg)' }}><IconChev size={11} /></span>
      </button>
      {open && (
        <div style={{ position: 'absolute', top: '110%', left: 0, zIndex: 30, width: 260, background: 'var(--card)', borderRadius: 'var(--r-card)', boxShadow: 'var(--sh-raised-tall)', padding: 8, maxHeight: 300, overflowY: 'auto' }}>
          {[['all', 'All campaigns'], ['hidden', 'Hidden from all']].map(([k, lbl]) => (
            <button key={k} onClick={() => { setMode(k); }} className="row" style={{ width: '100%', gap: 10, padding: '9px 10px', border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: 'var(--r-button)', textAlign: 'left' }}>
              <span style={{ width: 16, height: 16, borderRadius: '50%', flexShrink: 0, boxShadow: mode === k ? 'none' : 'var(--sh-inset-crisp)', background: mode === k ? 'var(--wine)' : 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{mode === k && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--paper)' }} />}</span>
              <span style={{ fontSize: 13, color: 'var(--ink)' }}>{lbl}</span>
            </button>
          ))}
          <div className="rule" style={{ margin: '6px 8px' }} />
          {campaigns.map((c) => (
            <button key={c.id} onClick={() => toggle(c.id)} className="row" style={{ width: '100%', gap: 10, padding: '8px 10px', border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: 'var(--r-button)', textAlign: 'left' }}>
              <span style={{ width: 16, height: 16, borderRadius: 5, flexShrink: 0, boxShadow: sel.includes(c.id) ? 'none' : 'var(--sh-inset-crisp)', background: sel.includes(c.id) ? 'var(--wine)' : 'var(--bg)', color: 'var(--paper)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{sel.includes(c.id) && <IconCheck size={11} />}</span>
              <span style={{ fontSize: 13, color: 'var(--ink-soft)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── add-entry composer ───────────────────────────────────────────────
function KBForm({ d, onClose }) {
  const kb = d.knowledge;
  const [cat, setCat] = React.useState(kb.categories[1] ? kb.categories[1].label : 'FAQ');
  const [inject, setInject] = React.useState('always');
  const Ic = KB_ICON[(kb.categories.find((c) => c.label === cat) || {}).icon] || IconHelp;
  return (
    <div className="neu-inset" style={{ borderRadius: 'var(--r-card)', padding: 18, marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <div className="row" style={{ gap: 8, padding: '10px 14px', borderRadius: 'var(--r-button)', background: 'var(--card)', boxShadow: 'var(--sh-raised-crisp)', minWidth: 130 }}>
            <span style={{ display: 'flex', color: 'var(--wine)' }}><Ic size={15} /></span>
            <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{cat}</span>
            <span style={{ display: 'flex', color: 'var(--mute-2)', transform: 'rotate(90deg)' }}><IconChev size={12} /></span>
          </div>
        </div>
        <input className="neu-input" placeholder="Entry title…" style={{ flex: 1, minWidth: 180, background: 'var(--card)', boxShadow: 'var(--sh-raised-crisp)' }} />
      </div>
      <textarea className="neu-input" placeholder="Content the AI will use to answer questions…" rows={3} style={{ resize: 'vertical', lineHeight: 1.5, background: 'var(--card)', boxShadow: 'var(--sh-raised-crisp)', fontFamily: 'var(--sans)' }} />
      <div className="row" style={{ gap: 14 }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--mute)', width: 78, flexShrink: 0 }}>Campaigns</span>
        <ScopePicker campaigns={d.campaigns} />
      </div>
      <div className="row" style={{ gap: 14, alignItems: 'center' }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--mute)', width: 78, flexShrink: 0 }}>Inject after</span>
        <div className="la-seg" style={{ flexWrap: 'wrap' }}>
          {kb.injectOptions.map((o) => (
            <button key={o} onClick={() => setInject(o)} className={`la-seg-btn${inject === o ? ' on' : ''}`} style={{ padding: '7px 12px' }}>{o === 'always' ? 'always' : `${o}msg`}</button>
          ))}
        </div>
      </div>
      <div className="row" style={{ gap: 10, justifyContent: 'flex-end', marginTop: 2 }}>
        <button className="la-btn la-btn--soft la-btn--lg" onClick={onClose}>Cancel</button>
        <button className="la-btn la-btn--wine la-btn--lg" onClick={onClose}><IconCheck size={14} />Save</button>
      </div>
    </div>
  );
}

// ── the panel ────────────────────────────────────────────────────────
function KBPanel({ d, compact = false }) {
  const kb = d.knowledge;
  const [adding, setAdding] = React.useState(false);
  return (
    <Panel icon={<IconBook size={16} />} title="Knowledge Base" count={`${kb.count} entries`}
      action={<PanelAction wine icon={<IconPlus size={12} />} onClick={() => setAdding((a) => !a)}>Add entry</PanelAction>}
      style={{ height: '100%' }}>
      {adding && <KBForm d={d} onClose={() => setAdding(false)} />}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {kb.categories.map((cat) => <KBCategory key={cat.key} cat={cat} campaigns={d.campaigns} />)}
      </div>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.13em', textTransform: 'uppercase', color: 'var(--mute-2)', marginRight: 2 }}>Add category</span>
        {kb.available.map((a) => (
          <button key={a.key} className="row" style={{ gap: 6, padding: '5px 11px', borderRadius: 'var(--r-pill)', border: '1px dashed var(--line-strong)', background: 'transparent', cursor: 'pointer', color: 'var(--mute)', fontSize: 12, fontWeight: 500 }}>
            <IconPlus size={11} />{a.label}
          </button>
        ))}
      </div>
    </Panel>
  );
}

Object.assign(window, { KBPanel, KBCategory, KBEntry, KBForm, ScopeChip, InjectChip, ScopePicker, KB_ICON });
