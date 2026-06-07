// billing-views.jsx — Invoices / Expenses / Contracts: list (cards) + table views, + detail drawer.
// Depends on: billing-components.jsx, billing-data.js, components.jsx

// ─── shared row chrome ─────────────────────────────────────────────
function BGroupBar({ label, count, accent }) {
  return (
    <div className="row" style={{ gap: 10, padding: '14px 4px 8px' }}>
      <span style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: accent || 'var(--ink-soft)', fontWeight: 700 }}>{label}</span>
      <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--mute-2)', background: 'var(--card)', boxShadow: 'var(--sh-raised-crisp)', borderRadius: 'var(--r-pill)', padding: '1px 8px' }}>{count}</span>
      <div className="rule" style={{ flex: 1, marginLeft: 4 }} />
    </div>
  );
}
const bCardStyle = (active) => ({
  display: 'flex', alignItems: 'center', gap: 16, padding: '15px 18px', borderRadius: 'var(--r-card)', cursor: 'pointer',
  background: 'var(--card)', boxShadow: active ? 'var(--sh-raised-medium), 0 0 0 1.5px var(--wine)' : 'var(--sh-raised-crisp)',
  transition: 'box-shadow 130ms, transform 130ms',
});
function bHoverOn(e, active) { if (!active) e.currentTarget.style.transform = 'translateY(-1px)'; }
function bHoverOff(e) { e.currentTarget.style.transform = 'translateY(0)'; }

// ═══ INVOICES ══════════════════════════════════════════════════════
function BDueLabel({ due, status, today }) {
  if (status === 'paid')  return <span style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--good)' }}>Paid</span>;
  if (status === 'draft') return <span style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--mute-2)' }}>Not sent</span>;
  const d = bDaysFrom(due, today);
  if (d < 0)  return <span style={{ fontFamily: 'var(--mono)', fontSize: 10.5, fontWeight: 700, color: 'var(--stage-lost)' }}>{Math.abs(d)}d overdue</span>;
  if (d === 0) return <span style={{ fontFamily: 'var(--mono)', fontSize: 10.5, fontWeight: 700, color: 'var(--wine)' }}>Due today</span>;
  return <span style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--mute)' }}>Due in {d}d</span>;
}

function InvoiceCard({ inv, active, onClick, today }) {
  const c = LA_BILLING.clients[inv.client];
  return (
    <div onClick={onClick} style={bCardStyle(active)} onMouseEnter={(e)=>bHoverOn(e,active)} onMouseLeave={bHoverOff}>
      <BAvatar who={inv.client} size={42} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
        <div className="row" style={{ gap: 8, marginTop: 4, whiteSpace: 'nowrap' }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--mute-2)', letterSpacing: '0.06em' }}>{inv.id}</span>
          <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--mute-2)' }} />
          <span style={{ fontSize: 11.5, color: 'var(--mute)' }}>Issued {bDate(inv.issued)}</span>
        </div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 7 }}>
        <span className="serif" style={{ fontSize: 24, color: 'var(--ink)', lineHeight: 1 }}>{bEur(inv.amount)}</span>
        <div className="row" style={{ gap: 10 }}>
          <BDueLabel due={inv.due} status={inv.status} today={today} />
          <BInvoiceStatus k={inv.status} />
        </div>
      </div>
    </div>
  );
}

function InvoiceList({ items, activeId, onSelect, today }) {
  const order = [['overdue','Overdue','var(--stage-lost)'],['sent','Outstanding',null],['draft','Drafts',null],['paid','Paid','var(--good)']];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {order.map(([k, label, accent]) => {
        const group = items.filter(i => i.status === k);
        if (!group.length) return null;
        return (
          <React.Fragment key={k}>
            <BGroupBar label={label} count={group.length} accent={accent} />
            {group.map(inv => <InvoiceCard key={inv.id} inv={inv} active={inv.id === activeId} onClick={() => onSelect(inv)} today={today} />)}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function BTableShell({ cols, children }) {
  const minWidth = cols.reduce((a, c) => a + (c.w || 220), 0) + 16 * (cols.length - 1) + 44;
  return (
    <div className="neu-raised" style={{ borderRadius: 'var(--r-card)', overflow: 'hidden', background: 'var(--card)' }}>
      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <div style={{ minWidth }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '0 22px', height: 44, borderBottom: '1px solid var(--line)', background: 'var(--bg-2)' }}>
            {cols.map(c => (
              <span key={c.key} style={{ flex: c.flex || `0 0 ${c.w}px`, width: c.w, textAlign: c.right ? 'right' : 'left',
                fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--mute-2)' }}>{c.label}</span>
            ))}
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
function BTableRow({ active, onClick, children }) {
  return (
    <div onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 16, padding: '0 22px', height: 62, cursor: 'pointer', borderBottom: '1px solid var(--line)',
      background: active ? 'var(--surface)' : 'transparent', boxShadow: active ? 'inset 3px 0 0 var(--wine)' : 'none', transition: 'background 120ms',
    }}
    onMouseEnter={(e)=>{ if(!active) e.currentTarget.style.background='var(--surface)'; }}
    onMouseLeave={(e)=>{ if(!active) e.currentTarget.style.background='transparent'; }}>
      {children}
    </div>
  );
}

const INV_COLS = [
  { key: 'inv', label: 'Invoice', w: 168 },
  { key: 'client', label: 'Client', flex: '1 1 200px' },
  { key: 'issued', label: 'Issued', w: 100 },
  { key: 'due', label: 'Due', w: 130 },
  { key: 'amount', label: 'Amount', w: 130, right: true },
  { key: 'status', label: 'Status', w: 120 },
];
function InvoiceTable({ items, activeId, onSelect, today }) {
  const c = LA_BILLING.clients;
  return (
    <BTableShell cols={INV_COLS}>
      {items.map(inv => (
        <BTableRow key={inv.id} active={inv.id === activeId} onClick={() => onSelect(inv)}>
          <div style={{ width: 168, flexShrink: 0, minWidth: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ width: 30, height: 30, borderRadius: 'var(--r-button)', flexShrink: 0, background: 'var(--bg)', boxShadow: 'var(--sh-inset-crisp)', color: 'var(--mute)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><BIInvoice size={15} /></span>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 12.5, fontWeight: 600, color: 'var(--ink)', letterSpacing: '0.02em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inv.id}</span>
          </div>
          <div style={{ flex: '1 1 200px', minWidth: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <BAvatar who={inv.client} size={26} />
            <span style={{ fontSize: 13, color: 'var(--ink-soft)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c[inv.client].name}</span>
          </div>
          <span style={{ width: 100, flexShrink: 0, fontSize: 12.5, color: 'var(--mute)' }}>{bDate(inv.issued)}</span>
          <div style={{ width: 130, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 12.5, color: 'var(--ink-soft)' }}>{bDate(inv.due)}</span>
            <BDueLabel due={inv.due} status={inv.status} today={today} />
          </div>
          <span style={{ width: 130, flexShrink: 0, textAlign: 'right', fontFamily: 'var(--serif)', fontSize: 18, color: 'var(--ink)' }}>{bEur(inv.amount)}</span>
          <div style={{ width: 120, flexShrink: 0 }}><BInvoiceStatus k={inv.status} /></div>
        </BTableRow>
      ))}
    </BTableShell>
  );
}

// ═══ EXPENSES (NL-tax / BTW model) ═════════════════════════════════
const Q_LABEL = { 1: 'Q1 · Jan–Mar', 2: 'Q2 · Apr–Jun', 3: 'Q3 · Jul–Sep', 4: 'Q4 · Oct–Dec' };
function bExpenseGroups(items) {
  const years = {};
  items.forEach(e => { (years[e.y] = years[e.y] || {})[e.q] = (years[e.y][e.q] || []).concat(e); });
  return Object.keys(years).sort((a, b) => b - a).map(y => ({
    y: +y,
    quarters: Object.keys(years[y]).sort((a, b) => b - a).map(q => ({ q: +q, items: years[y][q] })),
  }));
}
function bSums(items) {
  const s = { exclEur: 0, exclUsd: 0, totalEur: 0, totalUsd: 0, btw: 0 };
  items.forEach(e => { if (e.cur === 'USD') { s.exclUsd += e.excl; s.totalUsd += e.total; } else { s.exclEur += e.excl; s.totalEur += e.total; } s.btw += e.btw; });
  return s;
}

function ExpenseCard({ exp, active, onClick }) {
  return (
    <div onClick={onClick} style={bCardStyle(active)} onMouseEnter={(e)=>bHoverOn(e,active)} onMouseLeave={bHoverOff}>
      <span style={{ width: 42, height: 42, borderRadius: 'var(--r-surface)', flexShrink: 0, background: 'var(--bg)', boxShadow: 'var(--sh-inset-crisp)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--mute)' }}><BIExpense size={18} /></span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{exp.desc}</div>
        <div className="row" style={{ gap: 7, marginTop: 4 }}>
          <span style={{ fontSize: 12, color: 'var(--mute)' }}>{exp.supplier}</span>
          <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--mute-2)', flexShrink: 0 }} />
          <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--mute-2)' }}>{bDate(exp.date)}</span>
        </div>
        <div className="row" style={{ gap: 7, marginTop: 8 }}><BDedBadge ded={exp.ded} /><BPdfBadge /></div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
        <span className="serif" style={{ fontSize: 21, color: 'var(--ink)', lineHeight: 1 }}>{bMoney(exp.total, exp.cur)}</span>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 9.5, color: 'var(--mute-2)', letterSpacing: '0.04em' }}>Q{exp.q} {exp.y}</span>
      </div>
    </div>
  );
}
function ExpenseList({ items, activeId, onSelect }) {
  const groups = bExpenseGroups(items);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {groups.map(g => g.quarters.map(qg => (
        <React.Fragment key={g.y + '-' + qg.q}>
          <BGroupBar label={`${g.y} · Q${qg.q}`} count={qg.items.length} />
          {qg.items.map(exp => <ExpenseCard key={exp.id} exp={exp} active={exp.id === activeId} onClick={() => onSelect(exp)} />)}
        </React.Fragment>
      )))}
    </div>
  );
}

// ── Table view — grouped year → quarter with subtotal rows ──
const EXP_TCOLS = [
  { key: 'date', label: 'Date', w: 104 },
  { key: 'supplier', label: 'Supplier', w: 150 },
  { key: 'desc', label: 'Description', flex: '1 1 200px' },
  { key: 'inv', label: 'Invoice #', w: 150 },
  { key: 'excl', label: 'Excl. VAT', w: 96, right: true },
  { key: 'vat', label: 'VAT %', w: 64, right: true },
  { key: 'total', label: 'Total', w: 104, right: true },
  { key: 'btw', label: 'NL BTW', w: 96, right: true },
  { key: 'pdf', label: 'PDF', w: 44, center: true },
];
function BSumCell({ eur, usd, color }) {
  return (
    <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1.25 }}>
      {eur > 0 && <span style={{ fontFamily: 'var(--mono)', fontSize: 11.5, color: color || 'var(--ink-soft)', fontWeight: 600 }}>{bMoney(eur, 'EUR')}</span>}
      {usd > 0 && <span style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--mute-2)' }}>{bMoney(usd, 'USD')}</span>}
    </span>
  );
}
function ExpSubRow({ label, s, kind }) {
  const isYear = kind === 'year';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '0 18px', minHeight: isYear ? 40 : 34,
      background: isYear ? 'var(--wine-tint)' : 'var(--bg-2)', borderBottom: '1px solid var(--line)' }}>
      <span style={{ flex: EXP_TCOLS[0].w + EXP_TCOLS[1].w + 14, display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, minWidth: EXP_TCOLS[0].w + EXP_TCOLS[1].w }}>
        <span style={{ display: 'flex', color: isYear ? 'var(--wine)' : 'var(--mute-2)', transform: 'rotate(90deg)' }}><BIChevR size={12} /></span>
        <span style={{ fontFamily: 'var(--mono)', fontSize: isYear ? 11 : 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: isYear ? 'var(--wine)' : 'var(--ink-soft)', fontWeight: 700 }}>{label}</span>
      </span>
      <span style={{ flex: '1 1 200px' }} />
      <span style={{ width: 150, flexShrink: 0 }} />
      <span style={{ width: 96, flexShrink: 0, textAlign: 'right' }}><BSumCell eur={s.exclEur} usd={s.exclUsd} /></span>
      <span style={{ width: 64, flexShrink: 0 }} />
      <span style={{ width: 104, flexShrink: 0, textAlign: 'right' }}><BSumCell eur={s.totalEur} usd={s.totalUsd} /></span>
      <span style={{ width: 96, flexShrink: 0, textAlign: 'right' }}><BSumCell eur={s.btw} usd={0} color="var(--good)" /></span>
      <span style={{ width: 44, flexShrink: 0 }} />
    </div>
  );
}
function ExpenseTable({ items, activeId, onSelect }) {
  const groups = bExpenseGroups(items);
  return (
    <div className="neu-raised" style={{ borderRadius: 'var(--r-card)', overflow: 'hidden', background: 'var(--card)' }}>
      <div style={{ overflowX: 'auto' }}>
        <div style={{ minWidth: 940 }}>
          {/* header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '0 18px', height: 44, borderBottom: '1px solid var(--line)', background: 'var(--bg-2)' }}>
            {EXP_TCOLS.map(c => (
              <span key={c.key} style={{ flex: c.flex || `0 0 ${c.w}px`, width: c.w, textAlign: c.right ? 'right' : c.center ? 'center' : 'left',
                fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--mute-2)' }}>{c.label}</span>
            ))}
          </div>
          {groups.map(g => (
            <React.Fragment key={g.y}>
              <ExpSubRow label={String(g.y)} s={bSums(g.quarters.flatMap(q => q.items))} kind="year" />
              {g.quarters.map(qg => (
                <React.Fragment key={qg.q}>
                  <ExpSubRow label={Q_LABEL[qg.q]} s={bSums(qg.items)} kind="quarter" />
                  {qg.items.map(exp => (
                    <div key={exp.id} onClick={() => onSelect(exp)} style={{
                      display: 'flex', alignItems: 'center', gap: 14, padding: '0 18px', minHeight: 56, cursor: 'pointer', borderBottom: '1px solid var(--line)',
                      background: exp.id === activeId ? 'var(--surface)' : 'transparent', boxShadow: exp.id === activeId ? 'inset 3px 0 0 var(--wine)' : 'none', transition: 'background 120ms',
                    }}
                    onMouseEnter={(e)=>{ if(exp.id!==activeId) e.currentTarget.style.background='var(--surface)'; }}
                    onMouseLeave={(e)=>{ if(exp.id!==activeId) e.currentTarget.style.background='transparent'; }}>
                      <span style={{ width: 104, flexShrink: 0, fontFamily: 'var(--mono)', fontSize: 11.5, color: 'var(--mute)' }}>{exp.date}</span>
                      <span style={{ width: 150, flexShrink: 0, fontSize: 12.5, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{exp.supplier}</span>
                      <span style={{ flex: '1 1 200px', minWidth: 0, fontSize: 12.5, color: 'var(--ink-soft)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{exp.desc}</span>
                      <span style={{ width: 150, flexShrink: 0, fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--mute-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{exp.inv}</span>
                      <span style={{ width: 96, flexShrink: 0, textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--mute)' }}>{bMoney(exp.excl, exp.cur)}</span>
                      <span style={{ width: 64, flexShrink: 0, textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 11.5, color: 'var(--mute-2)' }}>{exp.vat.toFixed(0)}%</span>
                      <span style={{ width: 104, flexShrink: 0, textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{bMoney(exp.total, exp.cur)}</span>
                      <span style={{ width: 96, flexShrink: 0, textAlign: 'right' }}>
                        {exp.ded
                          ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--good)', fontWeight: 600 }}><span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--good)' }} />{bMoney(exp.btw, 'EUR')}</span>
                          : <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--mute-2)' }}>—</span>}
                      </span>
                      <span style={{ width: 44, flexShrink: 0, display: 'flex', justifyContent: 'center', color: 'var(--wine)' }}><BIInvoice size={15} /></span>
                    </div>
                  ))}
                </React.Fragment>
              ))}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══ CONTRACTS ═════════════════════════════════════════════════════
function ContractCard({ ctr, active, onClick }) {
  const c = LA_BILLING.clients[ctr.client];
  return (
    <div onClick={onClick} style={bCardStyle(active)} onMouseEnter={(e)=>bHoverOn(e,active)} onMouseLeave={bHoverOff}>
      <BAvatar who={ctr.client} size={42} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ctr.title}</div>
        <div className="row" style={{ gap: 8, marginTop: 4 }}>
          <span style={{ fontSize: 12, color: 'var(--mute)' }}>{c.name}</span>
          <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--mute-2)' }} />
          <span style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--mute-2)' }}>{ctr.term}</span>
        </div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 7 }}>
        <span className="serif" style={{ fontSize: 22, color: 'var(--ink)', lineHeight: 1 }}>{bEur0(ctr.value)}</span>
        <div className="row" style={{ gap: 10 }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--mute-2)' }}>{ctr.signed ? bDate(ctr.signed) : bDate(ctr.created)}</span>
          <BContractStatus k={ctr.status} />
        </div>
      </div>
    </div>
  );
}
function ContractList({ items, activeId, onSelect }) {
  const order = [['sent','Awaiting signature','var(--warn)'],['draft','Drafts',null],['active','Active','var(--good)'],['signed','Signed',null]];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {order.map(([k,label,accent]) => {
        const group = items.filter(i => i.status === k);
        if (!group.length) return null;
        return (
          <React.Fragment key={k}>
            <BGroupBar label={label} count={group.length} accent={accent} />
            {group.map(ctr => <ContractCard key={ctr.id} ctr={ctr} active={ctr.id === activeId} onClick={() => onSelect(ctr)} />)}
          </React.Fragment>
        );
      })}
    </div>
  );
}
const CTR_COLS = [
  { key: 'ctr', label: 'Contract', flex: '1 1 240px' },
  { key: 'client', label: 'Client', w: 210 },
  { key: 'term', label: 'Term', w: 110 },
  { key: 'value', label: 'Value', w: 120, right: true },
  { key: 'date', label: 'Date', w: 100 },
  { key: 'status', label: 'Status', w: 180 },
];
function ContractTable({ items, activeId, onSelect }) {
  const c = LA_BILLING.clients;
  return (
    <BTableShell cols={CTR_COLS}>
      {items.map(ctr => (
        <BTableRow key={ctr.id} active={ctr.id === activeId} onClick={() => onSelect(ctr)}>
          <div style={{ flex: '1 1 240px', minWidth: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ width: 30, height: 30, borderRadius: 'var(--r-button)', flexShrink: 0, background: 'var(--bg)', boxShadow: 'var(--sh-inset-crisp)', color: 'var(--mute)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><BIContract size={15} /></span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ctr.title}</div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--mute-2)', marginTop: 2 }}>{ctr.id}</div>
            </div>
          </div>
          <div style={{ width: 210, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <BAvatar who={ctr.client} size={26} />
            <span style={{ fontSize: 13, color: 'var(--ink-soft)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c[ctr.client].name}</span>
          </div>
          <span style={{ width: 110, flexShrink: 0, fontSize: 12.5, color: 'var(--mute)' }}>{ctr.term}</span>
          <span style={{ width: 120, flexShrink: 0, textAlign: 'right', fontFamily: 'var(--serif)', fontSize: 18, color: 'var(--ink)' }}>{bEur0(ctr.value)}</span>
          <span style={{ width: 100, flexShrink: 0, fontSize: 12.5, color: 'var(--mute)' }}>{ctr.signed ? bDate(ctr.signed) : bDate(ctr.created)}</span>
          <div style={{ width: 180, flexShrink: 0 }}><BContractStatus k={ctr.status} /></div>
        </BTableRow>
      ))}
    </BTableShell>
  );
}

// ═══ DETAIL DRAWER ═════════════════════════════════════════════════
function BDrawer({ open, onClose, children }) {
  const [render, setRender] = React.useState(open);
  const [vis, setVis] = React.useState(false);
  React.useEffect(() => {
    if (open) { setRender(true); requestAnimationFrame(() => requestAnimationFrame(() => setVis(true))); }
    else setVis(false);
  }, [open]);
  if (!render) return null;
  const ease = 'cubic-bezier(0.22, 1, 0.36, 1)';
  return (
    <>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, zIndex: 40, background: 'rgba(31,26,20,0.28)', opacity: vis ? 1 : 0, transition: 'opacity 300ms ease', pointerEvents: vis ? 'auto' : 'none' }} />
      <div onTransitionEnd={() => { if (!vis) setRender(false); }} style={{
        position: 'absolute', top: 0, right: 0, bottom: 0, width: 'min(460px, 92%)', zIndex: 41,
        transform: vis ? 'translateX(0)' : 'translateX(100%)', transition: `transform 340ms ${ease}`,
        background: 'var(--paper)', boxShadow: '-18px 0 48px rgba(60,45,25,0.20)', display: 'flex', flexDirection: 'column',
      }}>{children}</div>
    </>
  );
}
function BDrawerHead({ eyebrow, title, onClose }) {
  return (
    <div style={{ flexShrink: 0, padding: '18px 22px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
      <div>
        <div className="eyebrow eyebrow-sm">{eyebrow}</div>
        <div className="serif" style={{ fontSize: 26, color: 'var(--ink)', marginTop: 4, lineHeight: 1.1 }}>{title}</div>
      </div>
      <button onClick={onClose} style={{ width: 36, height: 36, borderRadius: 'var(--r-pill)', flexShrink: 0, border: 'none', cursor: 'pointer', background: 'var(--surface)', boxShadow: 'var(--sh-raised-crisp)', color: 'var(--mute)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><BIX size={16} /></button>
    </div>
  );
}
function BField({ label, children }) {
  return (
    <div style={{ flex: '1 1 0', minWidth: 0 }}>
      <div className="eyebrow eyebrow-sm">{label}</div>
      <div style={{ fontSize: 13.5, color: 'var(--ink)', marginTop: 5 }}>{children}</div>
    </div>
  );
}

function InvoiceDetail({ inv, today, clientView, onClose }) {
  const c = LA_BILLING.clients[inv.client];
  const sub = inv.items.reduce((a, [, q, u]) => a + q * u, 0);
  const vat = Math.round(sub * 0.21 * 100) / 100;
  return (
    <>
      <BDrawerHead eyebrow={inv.id} title={bEur(inv.amount)} onClose={onClose} />
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 22px 28px' }}>
        <div className="row" style={{ gap: 10, marginBottom: 20 }}>
          <BInvoiceStatus k={inv.status} />
          <BDueLabel due={inv.due} status={inv.status} today={today} />
        </div>
        <div className="neu-inset" style={{ borderRadius: 'var(--r-surface)', padding: 16, display: 'flex', alignItems: 'center', gap: 13, marginBottom: 18 }}>
          <BAvatar who={inv.client} size={40} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{c.name}</div>
            <div style={{ fontSize: 12, color: 'var(--mute)', marginTop: 2 }}>billing@{c.ini.toLowerCase()}.example</div>
          </div>
        </div>
        <div className="row" style={{ gap: 20, marginBottom: 22 }}>
          <BField label="Issued">{bDateFull(inv.issued)}</BField>
          <BField label="Due">{bDateFull(inv.due)}</BField>
        </div>
        {!clientView && inv.status !== 'draft' && (
          <div className="neu-inset" style={{ borderRadius: 'var(--r-surface)', padding: '12px 15px', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 14 }}>
            <span className="row" style={{ gap: 8 }}>
              <span style={{ color: 'var(--mute-2)', display: 'flex' }}><BISend size={14} /></span>
              <span style={{ fontSize: 12, color: 'var(--mute)' }}>Sent {inv.sentAt || '—'}</span>
            </span>
            <span style={{ width: 1, height: 18, background: 'var(--line)' }} />
            <span className="row" style={{ gap: 8 }}>
              <span style={{ color: inv.views > 0 ? 'var(--good)' : 'var(--mute-2)', display: 'flex' }}><BIEye size={14} /></span>
              <span style={{ fontSize: 12, color: 'var(--mute)' }}>
                {inv.views > 0 ? <><b style={{ color: 'var(--ink)' }}>Viewed</b> {inv.views}×</> : 'Not yet opened'}
              </span>
            </span>
          </div>
        )}
        <div className="eyebrow eyebrow-sm" style={{ marginBottom: 10 }}>Line items</div>
        <div className="neu-raised-crisp" style={{ borderRadius: 'var(--r-surface)', overflow: 'hidden', background: 'var(--card)', marginBottom: 18 }}>
          {inv.items.map(([desc, qty, unit], i) => (
            <div key={i} className="row" style={{ justifyContent: 'space-between', gap: 12, padding: '12px 15px', borderBottom: i < inv.items.length - 1 ? '1px solid var(--line)' : 'none' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, color: 'var(--ink-soft)' }}>{desc}</div>
                {qty > 1 && <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--mute-2)', marginTop: 2 }}>{qty} × {bEur(unit)}</div>}
              </div>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--ink)', flexShrink: 0 }}>{bEur(qty * unit)}</span>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
          <div className="row" style={{ justifyContent: 'space-between', fontSize: 13, color: 'var(--mute)' }}><span>Subtotal</span><span style={{ fontFamily: 'var(--mono)' }}>{bEur(sub)}</span></div>
          <div className="row" style={{ justifyContent: 'space-between', fontSize: 13, color: 'var(--mute)' }}><span>VAT 21%</span><span style={{ fontFamily: 'var(--mono)' }}>{bEur(vat)}</span></div>
          <div className="rule" />
          <div className="row" style={{ justifyContent: 'space-between' }}><span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>Total</span><span className="serif" style={{ fontSize: 22, color: 'var(--ink)' }}>{bEur(sub + vat)}</span></div>
        </div>
        <div className="row" style={{ gap: 10 }}>
          {clientView
            ? <><BToolBtn Ic={BICard} label="Pay now" primary onClick={()=>{}} /><BToolBtn Ic={BIDownload} label="Download PDF" /></>
            : inv.status === 'paid'
              ? <BToolBtn Ic={BIDownload} label="Download PDF" />
              : <><BToolBtn Ic={BISend} label={inv.status === 'draft' ? 'Send invoice' : 'Resend'} primary onClick={()=>{}} /><BToolBtn Ic={BICheck} label="Mark paid" /></>}
        </div>
      </div>
    </>
  );
}

function ExpenseDetail({ exp, onClose }) {
  const P = LA_BILLING.provider;
  return (
    <>
      <BDrawerHead eyebrow={exp.id + ' · ' + exp.supplier} title={bMoney(exp.total, exp.cur)} onClose={onClose} />
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 22px 28px' }}>
        <div className="row" style={{ gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
          <BDedBadge ded={exp.ded} />
          <span style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--mute)', background: 'var(--bg)', boxShadow: 'var(--sh-inset-crisp)', borderRadius: 'var(--r-pill)', padding: '3px 9px' }}>{exp.cur}</span>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--mute)', background: 'var(--bg)', boxShadow: 'var(--sh-inset-crisp)', borderRadius: 'var(--r-pill)', padding: '3px 9px' }}>Q{exp.q} {exp.y}</span>
        </div>
        <div style={{ fontSize: 15, color: 'var(--ink)', lineHeight: 1.45, marginBottom: 18, textWrap: 'pretty' }}>{exp.desc}</div>
        <div className="row" style={{ gap: 20, marginBottom: 18 }}>
          <BField label="Date">{bDateFull(exp.date)}</BField>
          <BField label="Invoice #"><span style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{exp.inv}</span></BField>
        </div>
        {/* VAT breakdown */}
        <div className="eyebrow eyebrow-sm" style={{ marginBottom: 10 }}>VAT breakdown</div>
        <div className="neu-raised-crisp" style={{ borderRadius: 'var(--r-surface)', overflow: 'hidden', background: 'var(--card)', marginBottom: 16 }}>
          <div className="row" style={{ justifyContent: 'space-between', padding: '11px 15px', borderBottom: '1px solid var(--line)' }}>
            <span style={{ fontSize: 13, color: 'var(--mute)' }}>Amount excl. VAT</span>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--ink)' }}>{bMoney(exp.excl, exp.cur)}</span>
          </div>
          <div className="row" style={{ justifyContent: 'space-between', padding: '11px 15px', borderBottom: '1px solid var(--line)' }}>
            <span style={{ fontSize: 13, color: 'var(--mute)' }}>VAT @ {exp.vat}%</span>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--ink)' }}>{bMoney(exp.total - exp.excl, exp.cur)}</span>
          </div>
          <div className="row" style={{ justifyContent: 'space-between', padding: '12px 15px', background: 'var(--bg-2)' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>Total</span>
            <span className="serif" style={{ fontSize: 20, color: 'var(--ink)' }}>{bMoney(exp.total, exp.cur)}</span>
          </div>
        </div>
        {/* NL BTW reclaim callout */}
        <div className="row" style={{ gap: 12, padding: '13px 15px', borderRadius: 'var(--r-surface)', marginBottom: 18,
          background: exp.ded ? 'var(--good-tint)' : 'rgba(148,138,119,0.12)' }}>
          <span style={{ width: 34, height: 34, borderRadius: 'var(--r-surface)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--card)', boxShadow: 'var(--sh-raised-crisp)', color: exp.ded ? 'var(--good)' : 'var(--mute-2)' }}>
            {exp.ded ? <BICheck size={17} /> : <BIInfo size={17} />}
          </span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>
              {exp.ded ? `Reclaimable NL BTW · ${bMoney(exp.btw, 'EUR')}` : 'No reclaimable NL BTW'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--mute)', marginTop: 2, lineHeight: 1.4 }}>{exp.notes}</div>
          </div>
        </div>
        {/* document */}
        <div className="eyebrow eyebrow-sm" style={{ marginBottom: 10 }}>Source document</div>
        <div className="row" style={{ gap: 12, padding: 14, borderRadius: 'var(--r-surface)', background: 'var(--card)', boxShadow: 'var(--sh-raised-crisp)', marginBottom: 22 }}>
          <span style={{ width: 40, height: 48, borderRadius: 'var(--r-button)', flexShrink: 0, background: 'var(--wine-tint)', color: 'var(--wine)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><BIInvoice size={20} /></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{exp.supplier} — {exp.inv}.pdf</div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--mute-2)', marginTop: 2 }}>Invoice / receipt</div>
          </div>
          <button style={{ width: 34, height: 34, borderRadius: 'var(--r-button)', flexShrink: 0, border: 'none', cursor: 'pointer', background: 'var(--surface)', boxShadow: 'var(--sh-raised-crisp)', color: 'var(--mute)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><BIDownload size={15} /></button>
        </div>
        <div className="row" style={{ gap: 10 }}>
          <BToolBtn Ic={BIDownload} label="Download" primary onClick={()=>{}} />
          <BToolBtn Ic={BIPen} label="Edit" />
        </div>
      </div>
    </>
  );
}

function ContractDetail({ ctr, clientView, onClose }) {
  const c = LA_BILLING.clients[ctr.client];
  const P = LA_BILLING.provider;
  const signedOrActive = ctr.status === 'signed' || ctr.status === 'active';
  const steps = [
    { k: 'created', label: 'Drafted',             date: ctr.created, done: true },
    { k: 'sent',    label: 'Sent for signature',  date: ctr.sent,    done: ctr.status !== 'draft' },
    { k: 'signed',  label: `Signed by ${signedOrActive ? ctr.signatory : 'client'}`, date: ctr.signed, done: signedOrActive },
    { k: 'active',  label: 'Active until ' + (ctr.end ? bDateFull(ctr.end) : '—'), date: ctr.start, done: ctr.status === 'active' },
  ];
  return (
    <>
      <BDrawerHead eyebrow={ctr.id} title={ctr.title} onClose={onClose} />
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 22px 28px' }}>
        <div className="row" style={{ gap: 10, marginBottom: 20 }}>
          <BContractStatus k={ctr.status} />
          {!clientView && ctr.status !== 'draft' && (
            <span className="row" style={{ gap: 6, color: ctr.views > 0 ? 'var(--good)' : 'var(--mute-2)' }}><BIEye size={13} /><span style={{ fontSize: 11.5, color: 'var(--mute)' }}>{ctr.views > 0 ? `Viewed ${ctr.views}×` : 'Not opened'}</span></span>
          )}
          <span className="serif" style={{ fontSize: 22, color: 'var(--ink)', marginLeft: 'auto' }}>{bEur0(ctr.value)}</span>
        </div>
        <div className="neu-inset" style={{ borderRadius: 'var(--r-surface)', padding: 16, display: 'flex', alignItems: 'center', gap: 13, marginBottom: 18 }}>
          <BAvatar who={ctr.client} size={40} />
          <div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{c.name}</div><div style={{ fontSize: 12, color: 'var(--mute)', marginTop: 2 }}>Counterparty · {ctr.campaign}</div></div>
        </div>
        <div className="row" style={{ gap: 18, marginBottom: 18, flexWrap: 'wrap' }}>
          <BField label="Term">{ctr.term}</BField>
          <BField label="Period">{ctr.start ? `${bDate(ctr.start)} → ${bDate(ctr.end)}` : '—'}</BField>
          <BField label="Annual value">{bEur0(ctr.value)}</BField>
        </div>

        {/* rendered contract text */}
        <div className="eyebrow eyebrow-sm" style={{ marginBottom: 10 }}>Agreement</div>
        <div className="neu-inset" style={{ borderRadius: 'var(--r-surface)', padding: '16px 18px', marginBottom: 18 }}>
          <div className="serif" style={{ fontSize: 18, color: 'var(--ink)', marginBottom: 4 }}>{ctr.title}</div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 9.5, letterSpacing: '0.06em', color: 'var(--mute-2)', marginBottom: 12 }}>SERVICE AGREEMENT · {ctr.id}</div>
          <div style={{ fontSize: 12, color: 'var(--mute)', lineHeight: 1.5, marginBottom: 12 }}>
            Between <b style={{ color: 'var(--ink-soft)' }}>{P.trading}</b> ({P.name}, KvK {P.kvk}) and <b style={{ color: 'var(--ink-soft)' }}>{c.name}</b>.
          </div>
          <div className="eyebrow eyebrow-sm" style={{ marginBottom: 6 }}>Scope of services</div>
          <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', lineHeight: 1.55, textWrap: 'pretty' }}>{ctr.scope}</div>
          <div className="rule" style={{ margin: '14px 0' }} />
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div><div className="eyebrow eyebrow-sm">Fee</div><div className="serif" style={{ fontSize: 18, color: 'var(--ink)', marginTop: 2 }}>{bEur0(ctr.value)}<span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--mute-2)' }}> /year</span></div></div>
            <div style={{ textAlign: 'right' }}><div className="eyebrow eyebrow-sm">Signature</div>
              <div className="serif" style={{ fontSize: 17, color: signedOrActive ? 'var(--ink)' : 'var(--mute-2)', marginTop: 2, fontStyle: 'italic' }}>{signedOrActive ? ctr.signatory : 'Unsigned'}</div>
            </div>
          </div>
        </div>

        {/* signature timeline */}
        <div className="eyebrow eyebrow-sm" style={{ marginBottom: 14 }}>Signature status</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0, marginBottom: 22 }}>
          {steps.map((s, i) => (
            <div key={s.k} style={{ display: 'flex', gap: 13 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span style={{ width: 26, height: 26, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: s.done ? 'var(--good)' : 'var(--bg)', boxShadow: s.done ? 'var(--sh-raised-crisp)' : 'var(--sh-inset-crisp)', color: s.done ? '#fff' : 'var(--mute-2)' }}>
                  {s.done ? <BICheck size={13} /> : <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--mute-2)' }} />}
                </span>
                {i < steps.length - 1 && <span style={{ width: 2, flex: 1, minHeight: 22, background: s.done ? 'var(--good)' : 'var(--line)' }} />}
              </div>
              <div style={{ paddingBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: s.done ? 'var(--ink)' : 'var(--mute)' }}>{s.label}</div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--mute-2)', marginTop: 2 }}>{s.date ? bDateFull(s.date) : 'Pending'}</div>
              </div>
            </div>
          ))}
        </div>

        {/* signed PDF attachment (admin, signed) */}
        {!clientView && signedOrActive && (
          <div className="row" style={{ gap: 12, padding: 14, borderRadius: 'var(--r-surface)', background: 'var(--card)', boxShadow: 'var(--sh-raised-crisp)', marginBottom: 22 }}>
            <span style={{ width: 40, height: 48, borderRadius: 'var(--r-button)', flexShrink: 0, background: 'var(--good-tint)', color: 'var(--good)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><BIContract size={20} /></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ctr.id}-signed.pdf</div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--mute-2)', marginTop: 2 }}>Signed copy on file</div>
            </div>
            <button style={{ width: 34, height: 34, borderRadius: 'var(--r-button)', flexShrink: 0, border: 'none', cursor: 'pointer', background: 'var(--surface)', boxShadow: 'var(--sh-raised-crisp)', color: 'var(--mute)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><BIDownload size={15} /></button>
          </div>
        )}

        <div className="row" style={{ gap: 10 }}>
          {clientView
            ? (ctr.status === 'sent'
                ? <><BToolBtn Ic={BIPen} label="Review & sign" primary onClick={()=>{}} /><BToolBtn Ic={BIDownload} label="Download" /></>
                : <BToolBtn Ic={BIDownload} label="Download" primary onClick={()=>{}} />)
            : (signedOrActive
                ? <><BToolBtn Ic={BIDownload} label="Download" primary onClick={()=>{}} /><BToolBtn Ic={BICopy} label="Duplicate" /></>
                : <><BToolBtn Ic={BISend} label={ctr.status === 'draft' ? 'Send for signature' : 'Resend'} primary onClick={()=>{}} /><BToolBtn Ic={BIUpload} label="Attach signed" /></>)}
        </div>
      </div>
    </>
  );
}
function bDaysSentGuess(ctr) { return ctr.created; }

Object.assign(window, {
  BGroupBar, BDueLabel, InvoiceCard, InvoiceList, InvoiceTable,
  BTableShell, BTableRow, ExpenseCard, ExpenseList, ExpenseTable, bExpenseGroups, bSums, Q_LABEL,
  ContractCard, ContractList, ContractTable,
  BDrawer, BDrawerHead, BField, InvoiceDetail, ExpenseDetail, ContractDetail,
});
