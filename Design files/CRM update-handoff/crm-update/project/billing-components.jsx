// billing-components.jsx — primitives for Billing + the Notification system.
// Depends on: components.jsx (Icon, icons), billing-data.js (LA_BILLING), design-system.css
// All names B*-prefixed to avoid colliding with campaign/task globals.

// ─── Formatters ────────────────────────────────────────────────────
function bEur(n) {
  return '€' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function bEur0(n) { return '€' + Math.round(n).toLocaleString('en-US'); }
function bMoney(n, cur) { return (cur === 'USD' ? '$' : '€') + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
const B_MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function bDate(iso) { if (!iso) return '—'; const [y,m,d] = iso.split('-').map(Number); return `${B_MON[m-1]} ${d}`; }
function bDateFull(iso) { if (!iso) return '—'; const [y,m,d] = iso.split('-').map(Number); return `${B_MON[m-1]} ${d}, ${y}`; }
function bDaysFrom(iso, today) {
  const p = (s) => { const [y,m,d] = s.split('-').map(Number); return Date.UTC(y,m-1,d); };
  return Math.round((p(iso) - p(today)) / 86400000);
}

// ─── Local icons (stroke 1.5) ──────────────────────────────────────
const BIInvoice  = (p) => <Icon {...p} d={<><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/></>} />;
const BIExpense  = (p) => <Icon {...p} d={<><rect x="2.5" y="5.5" width="19" height="13" rx="2.5"/><path d="M2.5 10h19"/></>} />;
const BIContract = (p) => <Icon {...p} d={<><path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4"/><path d="M10 13c1-1.4 2.4-1.4 3 0s2 1.4 3 0"/></>} />;
const BILock     = (p) => <Icon {...p} d={<><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></>} />;
const BIPlus     = (p) => <Icon {...p} d={<path d="M12 5v14M5 12h14"/>} />;
const BIList     = (p) => <Icon {...p} d={<><path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3.6" cy="6" r="1.1"/><circle cx="3.6" cy="12" r="1.1"/><circle cx="3.6" cy="18" r="1.1"/></>} />;
const BITable    = (p) => <Icon {...p} d={<><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9.5h18M3 15h18M12 4v16"/></>} />;
const BISearch   = (p) => <Icon {...p} d={<><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></>} />;
const BIFilter   = (p) => <Icon {...p} d={<path d="M3 5h18l-7 8v6l-4-2v-4z"/>} />;
const BISort     = (p) => <Icon {...p} d={<><path d="M7 4v16M3 8l4-4 4 4"/><path d="M17 20V4M13 16l4 4 4-4"/></>} />;
const BIDownload = (p) => <Icon {...p} d={<><path d="M12 4v11M8 11l4 4 4-4"/><path d="M5 20h14"/></>} />;
const BISend     = (p) => <Icon {...p} d={<path d="M21 4 3 11l6 2 2 6z"/>} />;
const BIClock    = (p) => <Icon {...p} d={<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>} />;
const BIInfo     = (p) => <Icon {...p} d={<><circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><circle cx="12" cy="8" r=".7" fill="currentColor"/></>} />;
const BIMsg      = (p) => <Icon {...p} d={<path d="M4 5h16v11H8l-4 4z"/>} />;
const BICheck    = (p) => <Icon {...p} d={<path d="m5 12 5 5 9-12"/>} />;
const BIBell     = (p) => <Icon {...p} d={<><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 21a2 2 0 0 0 4 0"/></>} />;
const BITrash    = (p) => <Icon {...p} d={<><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></>} />;
const BIX         = (p) => <Icon {...p} d={<path d="M6 6l12 12M18 6 6 18"/>} />;
const BIChevR    = (p) => <Icon {...p} d={<path d="m9 6 6 6-6 6"/>} />;
const BICard     = (p) => <Icon {...p} d={<><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 9h18M7 15h4"/></>} />;
const BICoins    = (p) => <Icon {...p} d={<><ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v6c0 1.7 3 3 7 3s7-1.3 7-3V6M5 12v6c0 1.7 3 3 7 3s7-1.3 7-3v-6"/></>} />;
const BIPen      = (p) => <Icon {...p} d={<><path d="M14 4l6 6L8 22l-6 1 1-6z"/><path d="M12 6l6 6"/></>} />;
const BIWarn     = (p) => <Icon {...p} d={<><path d="M12 3 22 20H2z"/><path d="M12 10v4"/><circle cx="12" cy="17" r=".7" fill="currentColor"/></>} />;
const BIBuilding = (p) => <Icon {...p} d={<><rect x="4" y="3" width="16" height="18" rx="1.5"/><path d="M8 7h2M14 7h2M8 11h2M14 11h2M8 15h2M14 15h2"/></>} />;
const BIEye      = (p) => <Icon {...p} d={<><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></>} />;
const BIPrint    = (p) => <Icon {...p} d={<><rect x="6" y="3" width="12" height="6"/><path d="M6 18H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="7"/></>} />;
const BICopy     = (p) => <Icon {...p} d={<><rect x="8" y="8" width="13" height="13" rx="2"/><path d="M5 16V5a2 2 0 0 1 2-2h9"/></>} />;
const BILink     = (p) => <Icon {...p} d={<><path d="M9 15l6-6"/><path d="M11 6l1-1a4 4 0 0 1 6 6l-1 1M7 13l-1 1a4 4 0 0 0 6 6l1-1"/></>} />;
const BIUpload   = (p) => <Icon {...p} d={<><path d="M12 16V5M8 9l4-4 4 4"/><path d="M5 16v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2"/></>} />;

// ─── Client avatar ─────────────────────────────────────────────────
function BAvatar({ who, size = 34 }) {
  const c = LA_BILLING.clients[who];
  return (
    <span title={c.name} style={{
      width: size, height: size, borderRadius: Math.round(size * 0.28), flexShrink: 0,
      background: c.color, color: '#fff', boxShadow: 'var(--sh-raised-crisp)',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'var(--mono)', fontSize: size * 0.34, fontWeight: 700, letterSpacing: '0.01em',
    }}>{c.ini}</span>
  );
}

// ─── Status pills ──────────────────────────────────────────────────
function BStatus({ map, k, dot = true }) {
  const s = map[k];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 'var(--r-pill)',
      background: s.tint, color: s.color,
      fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700,
      whiteSpace: 'nowrap',
    }}>
      {dot && <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.color, flexShrink: 0 }} />}
      {s.short || s.label}
    </span>
  );
}
const BInvoiceStatus  = ({ k }) => <BStatus map={LA_BILLING.INVOICE_STATUS} k={k} />;
const BContractStatus = ({ k }) => <BStatus map={LA_BILLING.CONTRACT_STATUS} k={k} />;

function BCatTag({ k, big }) {
  const c = LA_BILLING.EXPENSE_CAT[k];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
      <span style={{ width: big ? 9 : 8, height: big ? 9 : 8, borderRadius: 3, background: c.color, flexShrink: 0 }} />
      <span style={{ fontSize: big ? 12.5 : 12, color: 'var(--mute)' }}>{c.label}</span>
    </span>
  );
}

// ─── Expense badges (deductibility + document) ─────────────────────
function BDedBadge({ ded }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 'var(--r-pill)',
      background: ded ? 'var(--good-tint)' : 'rgba(148,138,119,0.14)', color: ded ? 'var(--good)' : 'var(--mute-2)',
      fontFamily: 'var(--mono)', fontSize: 8.5, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 700, whiteSpace: 'nowrap' }}>
      {ded && <BICheck size={10} />}{ded ? 'BTW Deductible' : 'Non-deductible'}
    </span>
  );
}
function BPdfBadge() {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 'var(--r-pill)',
      background: 'var(--wine-tint)', color: 'var(--wine)', fontFamily: 'var(--mono)', fontSize: 8.5, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 700 }}>
      PDF
    </span>
  );
}

// ─── Stat card (stats strip) ───────────────────────────────────────
function BStat({ label, value, sub, accent, Ic }) {
  return (
    <div className="neu-raised" style={{ flex: '1 1 0', minWidth: 0, padding: '16px 18px', borderRadius: 'var(--r-card)', position: 'relative', overflow: 'hidden' }}>
      {accent && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: accent }} />}
      <div className="row" style={{ justifyContent: 'space-between', gap: 8 }}>
        <span className="eyebrow eyebrow-sm">{label}</span>
        {Ic && <span style={{ color: accent || 'var(--mute-2)', display: 'flex' }}><Ic size={15} /></span>}
      </div>
      <div className="serif" style={{ fontSize: 32, color: 'var(--ink)', lineHeight: 1.05, marginTop: 8, letterSpacing: '-0.01em' }}>{value}</div>
      {sub && <div style={{ fontSize: 11.5, color: 'var(--mute)', marginTop: 5 }}>{sub}</div>}
    </div>
  );
}

// ─── Generic segmented control ─────────────────────────────────────
// options: [{key,label,Ic,badge}]; size: 'md'|'sm'
function BSeg({ options, value, onChange, size = 'md', grow }) {
  return (
    <div className={`la-seg${grow ? ' la-seg--fill' : ''}`}>
      {options.map(o => {
        const on = o.key === value;
        return (
          <button key={o.key} onClick={() => onChange(o.key)} title={o.label} className={`la-seg-btn${on ? ' on' : ''}`}>
            {o.Ic && <o.Ic size={13} />}{o.label}
            {o.badge != null && (
              <span style={{ fontFamily: 'var(--mono)', fontSize: 8.5, fontWeight: 700, padding: '1px 6px', borderRadius: 'var(--r-pill)',
                background: on ? 'var(--wine)' : 'var(--bg)', color: on ? 'var(--paper)' : 'var(--mute-2)',
                boxShadow: on ? 'none' : 'var(--sh-inset-crisp)' }}>{o.badge}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── Toolbar button ────────────────────────────────────────────────
function BToolBtn({ Ic, label, onClick, primary }) {
  return (
    <button onClick={onClick} title={label} className={`la-btn ${primary ? 'la-btn--wine' : 'la-btn--soft'}`}>
      {Ic && <Ic size={14} />}{label}
    </button>
  );
}

// ═══ NOTIFICATION SYSTEM ═══════════════════════════════════════════
const NOTIF_META = {
  booking: { Ic: BIClock, color: 'var(--warn)',  tint: 'var(--warn-tint)',  label: 'Bookings' },
  message: { Ic: BIMsg,   color: 'var(--stage-responded)', tint: 'rgba(63,142,142,0.13)', label: 'Messages' },
  task:    { Ic: BICheck, color: 'var(--good)',  tint: 'var(--good-tint)',  label: 'Tasks' },
  billing: { Ic: BICard,  color: 'var(--wine)',  tint: 'var(--wine-tint)',  label: 'Billing' },
  system:  { Ic: BIInfo,  color: 'var(--mute)',  tint: 'rgba(108,99,84,0.12)', label: 'System' },
};

function NotifRow({ n, onRead }) {
  const m = NOTIF_META[n.type];
  return (
    <div onClick={() => n.unread && onRead(n.id)} style={{
      display: 'flex', gap: 13, padding: '14px 16px 14px 18px', cursor: n.unread ? 'pointer' : 'default', position: 'relative',
      background: n.unread ? 'var(--wine-tint)' : 'transparent',
      borderBottom: '1px solid var(--line)',
      transition: 'background 140ms',
    }}
    onMouseEnter={(e) => { e.currentTarget.style.background = n.unread ? 'rgba(94,34,48,0.12)' : 'var(--surface)'; }}
    onMouseLeave={(e) => { e.currentTarget.style.background = n.unread ? 'var(--wine-tint)' : 'transparent'; }}>
      {n.unread && <span style={{ position: 'absolute', left: 0, top: 12, bottom: 12, width: 3, background: 'var(--wine)', borderRadius: '0 3px 3px 0' }} />}
      <span style={{ width: 38, height: 38, borderRadius: 'var(--r-surface)', flexShrink: 0, background: m.tint, color: m.color,
        display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--sh-inset-crisp)' }}>
        <m.Ic size={17} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="row" style={{ gap: 7, alignItems: 'flex-start' }}>
          <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.3, textWrap: 'pretty', flex: 1 }}>{n.title}</span>
          {n.unread && <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--wine)', flexShrink: 0, marginTop: 5 }} />}
        </div>
        <div style={{ fontSize: 12, color: 'var(--mute)', marginTop: 3, lineHeight: 1.4, textWrap: 'pretty' }}>{n.body}</div>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 9.5, color: 'var(--mute-2)', marginTop: 6, letterSpacing: '0.04em' }}>{n.time}</div>
      </div>
    </div>
  );
}

// Floating panel. `anchor` = inline style object positioning it. width fixed.
function NotificationPanel({ items, onClose, anchor, onState }) {
  const [list, setList] = React.useState(items);
  const [readFilter, setReadFilter] = React.useState('all');   // all | unread
  const [cat, setCat] = React.useState('all');

  React.useEffect(() => { onState && onState(list); }, [list]);

  const unreadCount = list.filter(n => n.unread).length;
  const markAll  = () => setList(l => l.map(n => ({ ...n, unread: false })));
  const clearAll = () => setList([]);
  const readOne  = (id) => setList(l => l.map(n => n.id === id ? { ...n, unread: false } : n));

  const cats = [['all','All'],['message','Messages'],['task','Tasks'],['booking','Bookings'],['billing','Billing'],['system','System']];
  const filtered = list.filter(n => (readFilter === 'all' || n.unread) && (cat === 'all' || n.type === cat));
  const week = filtered.filter(n => n.group === 'week');
  const older = filtered.filter(n => n.group === 'older');

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 60 }} />
      <div style={{
        position: 'fixed', zIndex: 61, width: 396, maxHeight: 'min(620px, 86vh)', display: 'flex', flexDirection: 'column',
        background: 'var(--card)', borderRadius: 'var(--r-card)', border: '1px solid var(--line)',
        boxShadow: 'var(--sh-raised-large)', overflow: 'hidden', ...anchor,
      }}>
        {/* header */}
        <div style={{ padding: '16px 18px 0', flexShrink: 0 }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className="serif" style={{ fontSize: 23, color: 'var(--ink)' }}>Notifications</span>
            <div className="row" style={{ gap: 14 }}>
              <button onClick={markAll} style={{ display: 'flex', alignItems: 'center', gap: 5, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--wine)', fontSize: 12, fontWeight: 600 }}>
                <BICheck size={13} />Mark all read
              </button>
              <button onClick={clearAll} style={{ display: 'flex', alignItems: 'center', gap: 5, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--mute)', fontSize: 12, fontWeight: 500 }}>
                <BITrash size={13} />Clear all
              </button>
            </div>
          </div>
          {/* read filter */}
          <div className="row" style={{ gap: 16, marginTop: 14 }}>
            {[['all','All'],['unread','Unread']].map(([k,label]) => {
              const on = k === readFilter;
              return (
                <button key={k} onClick={() => setReadFilter(k)} style={{
                  display: 'flex', alignItems: 'center', gap: 7, border: 'none', cursor: 'pointer', padding: '6px 14px', borderRadius: 'var(--r-pill)',
                  background: on ? 'var(--surface)' : 'transparent', boxShadow: on ? 'var(--sh-inset-crisp)' : 'none',
                  color: on ? 'var(--ink)' : 'var(--mute)', fontSize: 13, fontWeight: on ? 700 : 500,
                }}>
                  {label}
                  {k === 'unread' && <span style={{ fontFamily: 'var(--mono)', fontSize: 9, fontWeight: 700, padding: '1px 7px', borderRadius: 'var(--r-pill)', background: 'var(--wine)', color: 'var(--paper)' }}>{unreadCount}</span>}
                </button>
              );
            })}
          </div>
          {/* category tabs */}
          <div className="row" style={{ gap: 4, marginTop: 10, overflowX: 'auto', paddingBottom: 12, borderBottom: '1px solid var(--line)' }}>
            {cats.map(([k,label]) => {
              const on = k === cat;
              return (
                <button key={k} onClick={() => setCat(k)} style={{
                  border: 'none', cursor: 'pointer', padding: '5px 11px', borderRadius: 'var(--r-button)', background: 'transparent', whiteSpace: 'nowrap',
                  color: on ? 'var(--wine)' : 'var(--mute)', fontSize: 12.5, fontWeight: on ? 700 : 500,
                }}>{label}</button>
              );
            })}
          </div>
        </div>
        {/* list */}
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          {filtered.length === 0 && (
            <div style={{ padding: '54px 20px', textAlign: 'center', color: 'var(--mute-2)' }}>
              <BIBell size={26} />
              <div style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', marginTop: 12 }}>You're all caught up</div>
            </div>
          )}
          {week.length > 0 && <NotifGroupBar label="This week" />}
          {week.map(n => <NotifRow key={n.id} n={n} onRead={readOne} />)}
          {older.length > 0 && <NotifGroupBar label="Older" />}
          {older.map(n => <NotifRow key={n.id} n={n} onRead={readOne} />)}
        </div>
      </div>
    </>
  );
}
function NotifGroupBar({ label }) {
  return (
    <div style={{ padding: '11px 18px 7px', position: 'sticky', top: 0, background: 'var(--card)', zIndex: 2 }}>
      <span style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--mute-2)', fontWeight: 700 }}>{label}</span>
    </div>
  );
}

Object.assign(window, {
  bEur, bEur0, bMoney, bDate, bDateFull, bDaysFrom, B_MON,
  BIInvoice, BIExpense, BIContract, BILock, BIPlus, BIList, BITable, BISearch, BIFilter, BISort,
  BIDownload, BISend, BIClock, BIInfo, BIMsg, BICheck, BIBell, BITrash, BIX, BIChevR, BICard, BICoins, BIPen, BIWarn, BIBuilding, BIEye, BIPrint, BICopy, BILink, BIUpload,
  BAvatar, BStatus, BInvoiceStatus, BContractStatus, BCatTag, BDedBadge, BPdfBadge, BStat, BSeg, BToolBtn,
  NOTIF_META, NotifRow, NotificationPanel, NotifGroupBar,
});
