// mobile-billing.jsx — Billing for the Lead Awaker mobile app.
// Reflows the desktop Billing page (Invoices · Expenses · Contracts, list + table,
// admin/client views, notification panel) into a single-pane phone screen.
// Selected segment buttons render NEUMORPHIC RAISED in a lighter cream (--cream).
//
// Depends on: billing-data.js (LA_BILLING), billing-components.jsx (formatters,
// status pills, NOTIF_META/NotifRow, icons), mobile-shell.jsx (MobSheet, IconBtn),
// components.jsx (shared icons). MB*-prefixed to avoid global clashes.

// ─── Cream raised segment control (the signature mobile control) ───
// options: [{key,label,Ic,badge}]
function MBSegment({ options, value, onChange, small }) {
  return (
    <div className="la-seg la-seg--fill">
      {options.map(o => {
        const on = o.key === value;
        return (
          <button key={o.key} onClick={() => onChange(o.key)} className={`la-seg-btn${on ? ' on' : ''}`}
            style={{ padding: small ? '8px 4px' : '11px 6px', fontSize: small ? 9.5 : 10.5 }}>
            {o.Ic && <o.Ic size={small ? 13 : 15} />}{o.label}
            {o.badge != null && o.badge > 0 && (
              <span style={{ fontFamily: 'var(--mono)', fontSize: 8, fontWeight: 700, padding: '1px 5px', borderRadius: 'var(--r-pill)',
                background: on ? 'var(--wine)' : 'var(--mute-2)', color: 'var(--paper)' }}>{o.badge}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── Icon-only cream toggle (list / table) ─────────────────────────
function MBViewToggle({ value, onChange }) {
  const opts = [['list', BIList], ['table', BITable]];
  return (
    <div className="la-seg">
      {opts.map(([k, Ic]) => {
        const on = k === value;
        return (
          <button key={k} onClick={() => onChange(k)} className={`la-seg-btn${on ? ' on' : ''}`}
            style={{ width: 36, height: 32, padding: 0 }}><Ic size={15} /></button>
        );
      })}
    </div>
  );
}

// ─── Top bar ───────────────────────────────────────────────────────
function MBTopBar({ role, setRole, unread, onBell, onSearch }) {
  return (
    <div style={{ flexShrink: 0, background: 'var(--bg)', borderBottom: '1px solid var(--line)' }}>
      <div className="row" style={{ justifyContent: 'space-between', padding: '12px 16px 6px' }}>
        <button className="la-switcher" style={{ width: 'auto', padding: '7px 12px', gap: 8 }}>
          <span className="row" style={{ gap: 8 }}><IconSwap size={13} /><span>Agency View</span></span>
          <span style={{ display: 'flex', transform: 'rotate(90deg)', color: 'var(--mute-2)' }}><IconChev size={11} /></span>
        </button>
        <div className="row" style={{ gap: 8 }}>
          <IconBtn Ic={IconSearch} onClick={onSearch} />
          <button onClick={onBell} style={{
            width: 38, height: 38, borderRadius: 'var(--r-pill)', position: 'relative', border: 'none', cursor: 'pointer',
            background: 'var(--surface)', boxShadow: 'var(--sh-raised-crisp)', color: 'var(--mute)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <IconBell size={16} />
            {unread > 0 && (
              <span style={{ position: 'absolute', top: -2, right: -2, minWidth: 17, height: 17, padding: '0 4px', borderRadius: 'var(--r-pill)',
                background: 'var(--wine)', color: 'var(--paper)', fontFamily: 'var(--mono)', fontSize: 9, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--sh-raised-crisp)', border: '1.5px solid var(--bg)' }}>{unread > 9 ? '9+' : unread}</span>
            )}
          </button>
        </div>
      </div>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-end', padding: '4px 18px 14px' }}>
        <span className="serif" style={{ fontSize: 34, color: 'var(--ink)', letterSpacing: '-0.02em' }}>Billing</span>
        <MBSegment small value={role} onChange={setRole} options={[{ key: 'admin', label: 'Me' }, { key: 'client', label: 'Client' }]} />
      </div>
    </div>
  );
}

// ─── Stat strip (horizontal scroll) ────────────────────────────────
function MBStatStrip({ cards }) {
  return (
    <div style={{ display: 'flex', gap: 10, overflowX: 'auto', padding: '2px 16px 2px', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
      {cards.map((s, i) => (
        <div key={i} className="neu-raised" style={{ flex: '0 0 auto', minWidth: 132, padding: '13px 15px', borderRadius: 'var(--r-card)', position: 'relative', overflow: 'hidden' }}>
          {s.accent && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: s.accent }} />}
          <div className="row" style={{ justifyContent: 'space-between', gap: 8 }}>
            <span className="eyebrow eyebrow-sm" style={{ fontSize: 8.5 }}>{s.label}</span>
            {s.Ic && <span style={{ color: s.accent || 'var(--mute-2)', display: 'flex' }}><s.Ic size={13} /></span>}
          </div>
          <div className="serif" style={{ fontSize: 25, color: 'var(--ink)', lineHeight: 1.05, marginTop: 6 }}>{s.value}</div>
          {s.sub && <div style={{ fontSize: 10.5, color: 'var(--mute)', marginTop: 3 }}>{s.sub}</div>}
        </div>
      ))}
    </div>
  );
}

// ─── Filter chips (horizontal scroll) ──────────────────────────────
function MBChips({ chips, value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 7, overflowX: 'auto', padding: '0 16px', scrollbarWidth: 'none' }}>
      {chips.map(([k, label, count]) => {
        const on = k === value;
        return (
          <button key={k} onClick={() => onChange(k)} style={{
            flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 6, padding: '7px 13px', borderRadius: 'var(--r-pill)', border: 'none', cursor: 'pointer',
            background: on ? 'var(--wine)' : 'var(--surface)', boxShadow: on ? 'none' : 'var(--sh-raised-crisp)',
            color: on ? 'var(--paper)' : 'var(--ink-soft)', fontSize: 12, fontWeight: on ? 700 : 500, whiteSpace: 'nowrap',
          }}>
            {label}
            {count != null && <span style={{ fontFamily: 'var(--mono)', fontSize: 8.5, fontWeight: 700, color: on ? 'var(--paper)' : 'var(--mute-2)', background: on ? 'rgba(255,255,255,0.18)' : 'var(--bg-2)', borderRadius: 'var(--r-pill)', padding: '1px 6px' }}>{count}</span>}
          </button>
        );
      })}
    </div>
  );
}

// ─── Section header ────────────────────────────────────────────────
function MBSection({ label, accent, count, amount }) {
  return (
    <div className="row" style={{ gap: 9, padding: '16px 4px 9px' }}>
      {accent && <span style={{ width: 8, height: 8, borderRadius: '50%', background: accent, flexShrink: 0 }} />}
      <span style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-soft)', fontWeight: 700 }}>{label}</span>
      {count != null && <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--mute-2)', background: 'var(--card)', boxShadow: 'var(--sh-raised-crisp)', borderRadius: 'var(--r-pill)', padding: '1px 7px' }}>{count}</span>}
      <div className="rule" style={{ flex: 1, marginLeft: 2 }} />
      {amount != null && <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--mute)', fontWeight: 600 }}>{amount}</span>}
    </div>
  );
}

// ═══ INVOICE — mobile card ═════════════════════════════════════════
function MBInvoiceCard({ inv, onClick, today }) {
  const c = LA_BILLING.clients[inv.client];
  return (
    <div onClick={onClick} className="neu-raised" style={{ padding: 15, borderRadius: 'var(--r-card)', cursor: 'pointer', marginBottom: 10 }}>
      <div className="row" style={{ gap: 12 }}>
        <BAvatar who={inv.client} size={40} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
          <div className="row" style={{ gap: 7, marginTop: 3 }}>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--mute-2)' }}>{inv.id}</span>
            <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--mute-2)' }} />
            <BDueLabel due={inv.due} status={inv.status} today={today} />
          </div>
        </div>
        <BInvoiceStatus k={inv.status} />
      </div>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 13, paddingTop: 12, borderTop: '1px solid var(--line)' }}>
        <span style={{ fontSize: 11, color: 'var(--mute)' }}>{inv.status === 'paid' ? 'Paid' : 'Amount due'}</span>
        <span className="serif" style={{ fontSize: 26, color: 'var(--ink)', lineHeight: 1 }}>{bEur(inv.amount)}</span>
      </div>
    </div>
  );
}
function MBInvoiceList({ items, onSelect, today, clientView }) {
  const order = [['overdue','Overdue','var(--stage-lost)'],['sent','Outstanding',null],['draft','Drafts',null],['paid','Paid','var(--good)']];
  return order.map(([k, label, accent]) => {
    const group = items.filter(i => i.status === k);
    if (!group.length) return null;
    return (
      <div key={k}>
        <MBSection label={label} accent={accent} count={group.length} amount={bEur0(group.reduce((s,i)=>s+i.amount,0))} />
        {group.map(inv => <MBInvoiceCard key={inv.id} inv={inv} today={today} onClick={() => onSelect('invoice', inv)} />)}
      </div>
    );
  });
}

// ═══ EXPENSE — mobile card (BTW model) ═════════════════════════════
function MBExpenseCard({ exp, onClick }) {
  return (
    <div onClick={onClick} className="neu-raised" style={{ padding: 15, borderRadius: 'var(--r-card)', cursor: 'pointer', marginBottom: 10 }}>
      <div className="row" style={{ justifyContent: 'space-between', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{exp.desc}</div>
          <div className="row" style={{ gap: 7, marginTop: 3 }}>
            <span style={{ fontSize: 11.5, color: 'var(--mute)' }}>{exp.supplier}</span>
            <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--mute-2)', flexShrink: 0 }} />
            <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--mute-2)' }}>{exp.date}</span>
          </div>
        </div>
        <span className="serif" style={{ fontSize: 21, color: 'var(--ink)', lineHeight: 1, flexShrink: 0 }}>{bMoney(exp.total, exp.cur)}</span>
      </div>
      <div className="row" style={{ gap: 7, marginTop: 12, paddingTop: 11, borderTop: '1px solid var(--line)' }}>
        <BDedBadge ded={exp.ded} />
        {exp.btw > 0 && <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--good)', fontWeight: 600 }}>BTW {bMoney(exp.btw, 'EUR')}</span>}
        <div style={{ flex: 1 }} />
        <BPdfBadge />
      </div>
    </div>
  );
}
function MBExpenseList({ items, onSelect }) {
  const groups = window.bExpenseGroups(items);
  return groups.map(g => g.quarters.map(qg => {
    const s = window.bSums(qg.items);
    return (
      <div key={g.y + '-' + qg.q}>
        <MBSection label={`${g.y} · Q${qg.q}`} count={qg.items.length} amount={bMoney(s.totalEur, 'EUR') + (s.totalUsd ? ' + ' + bMoney(s.totalUsd,'USD') : '')} />
        {qg.items.map(exp => <MBExpenseCard key={exp.id} exp={exp} onClick={() => onSelect('expense', exp)} />)}
      </div>
    );
  }));
}

// ═══ CONTRACT — mobile card ════════════════════════════════════════
function MBContractCard({ ctr, onClick }) {
  const c = LA_BILLING.clients[ctr.client];
  return (
    <div onClick={onClick} className="neu-raised" style={{ padding: 15, borderRadius: 'var(--r-card)', cursor: 'pointer', marginBottom: 10 }}>
      <div className="row" style={{ gap: 12 }}>
        <BAvatar who={ctr.client} size={40} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ctr.title}</div>
          <div className="row" style={{ gap: 7, marginTop: 3 }}>
            <span style={{ fontSize: 11.5, color: 'var(--mute)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
          </div>
        </div>
        <BContractStatus k={ctr.status} />
      </div>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 13, paddingTop: 12, borderTop: '1px solid var(--line)' }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--mute-2)' }}>{ctr.term}{ctr.start ? ` · from ${bDate(ctr.start)}` : ''}</span>
        <span className="serif" style={{ fontSize: 22, color: 'var(--ink)', lineHeight: 1 }}>{bEur0(ctr.value)}</span>
      </div>
    </div>
  );
}
function MBContractList({ items, onSelect }) {
  const order = [['sent','Awaiting signature','var(--warn)'],['draft','Drafts',null],['active','Active','var(--good)'],['signed','Signed',null]];
  return order.map(([k, label, accent]) => {
    const group = items.filter(i => i.status === k);
    if (!group.length) return null;
    return (
      <div key={k}>
        <MBSection label={label} accent={accent} count={group.length} />
        {group.map(ctr => <MBContractCard key={ctr.id} ctr={ctr} onClick={() => onSelect('contract', ctr)} />)}
      </div>
    );
  });
}

// ═══ TABLE views (horizontal scroll, compact) ══════════════════════
function MBTableScroll({ children, minWidth }) {
  return (
    <div className="neu-raised" style={{ borderRadius: 'var(--r-card)', overflow: 'hidden', background: 'var(--card)', marginTop: 4 }}>
      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <div style={{ minWidth }}>{children}</div>
      </div>
    </div>
  );
}
function mbTh(label, w, right) {
  return <span style={{ flex: `0 0 ${w}px`, width: w, textAlign: right ? 'right' : 'left', fontFamily: 'var(--mono)', fontSize: 8.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--mute-2)' }}>{label}</span>;
}
function MBInvoiceTable({ items, onSelect, today }) {
  const c = LA_BILLING.clients;
  return (
    <MBTableScroll minWidth={560}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px', height: 40, borderBottom: '1px solid var(--line)', background: 'var(--bg-2)' }}>
        {mbTh('Invoice', 92)}{mbTh('Client', 150)}{mbTh('Due', 96)}{mbTh('Amount', 92, true)}{mbTh('Status', 90)}
      </div>
      {items.map(inv => (
        <div key={inv.id} onClick={() => onSelect('invoice', inv)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px', height: 56, borderBottom: '1px solid var(--line)', cursor: 'pointer' }}>
          <span style={{ flex: '0 0 92px', fontFamily: 'var(--mono)', fontSize: 11.5, fontWeight: 600, color: 'var(--ink)' }}>{inv.id}</span>
          <span style={{ flex: '0 0 150px', display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}><BAvatar who={inv.client} size={24} /><span style={{ fontSize: 12.5, color: 'var(--ink-soft)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c[inv.client].name}</span></span>
          <span style={{ flex: '0 0 96px', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--mute)' }}>{bDate(inv.due)}</span>
          <span style={{ flex: '0 0 92px', textAlign: 'right', fontFamily: 'var(--serif)', fontSize: 16, color: 'var(--ink)' }}>{bEur(inv.amount)}</span>
          <span style={{ flex: '0 0 90px' }}><BInvoiceStatus k={inv.status} /></span>
        </div>
      ))}
    </MBTableScroll>
  );
}
function MBExpenseTable({ items, onSelect }) {
  const groups = window.bExpenseGroups(items);
  return (
    <MBTableScroll minWidth={640}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px', height: 40, borderBottom: '1px solid var(--line)', background: 'var(--bg-2)' }}>
        {mbTh('Date', 84)}{mbTh('Supplier', 130)}{mbTh('Excl.', 80, true)}{mbTh('VAT', 50, true)}{mbTh('Total', 88, true)}{mbTh('BTW', 80, true)}
      </div>
      {groups.map(g => g.quarters.map(qg => {
        const s = window.bSums(qg.items);
        return (
          <React.Fragment key={g.y + '-' + qg.q}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px', minHeight: 32, background: 'var(--wine-tint)', borderBottom: '1px solid var(--line)' }}>
              <span style={{ flex: '0 0 214px', fontFamily: 'var(--mono)', fontSize: 9.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--wine)', fontWeight: 700 }}>{g.y} · Q{qg.q}</span>
              <span style={{ flex: '0 0 80px', textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--ink-soft)', fontWeight: 600 }}>{bMoney(s.exclEur,'EUR')}</span>
              <span style={{ flex: '0 0 50px' }} />
              <span style={{ flex: '0 0 88px', textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--ink-soft)', fontWeight: 600 }}>{bMoney(s.totalEur,'EUR')}</span>
              <span style={{ flex: '0 0 80px', textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--good)', fontWeight: 600 }}>{bMoney(s.btw,'EUR')}</span>
            </div>
            {qg.items.map(exp => (
              <div key={exp.id} onClick={() => onSelect('expense', exp)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px', minHeight: 50, borderBottom: '1px solid var(--line)', cursor: 'pointer' }}>
                <span style={{ flex: '0 0 84px', fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--mute)' }}>{exp.date.slice(5)}</span>
                <span style={{ flex: '0 0 130px', fontSize: 12, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{exp.supplier}</span>
                <span style={{ flex: '0 0 80px', textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--mute)' }}>{bMoney(exp.excl, exp.cur)}</span>
                <span style={{ flex: '0 0 50px', textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--mute-2)' }}>{exp.vat}%</span>
                <span style={{ flex: '0 0 88px', textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 12.5, fontWeight: 700, color: 'var(--ink)' }}>{bMoney(exp.total, exp.cur)}</span>
                <span style={{ flex: '0 0 80px', textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 11, color: exp.ded ? 'var(--good)' : 'var(--mute-2)', fontWeight: exp.ded ? 600 : 400 }}>{exp.ded ? bMoney(exp.btw,'EUR') : '—'}</span>
              </div>
            ))}
          </React.Fragment>
        );
      }))}
    </MBTableScroll>
  );
}
function MBContractTable({ items, onSelect }) {
  const c = LA_BILLING.clients;
  return (
    <MBTableScroll minWidth={580}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px', height: 40, borderBottom: '1px solid var(--line)', background: 'var(--bg-2)' }}>
        {mbTh('Contract', 110)}{mbTh('Client', 140)}{mbTh('Term', 80)}{mbTh('Value', 84, true)}{mbTh('Status', 90)}
      </div>
      {items.map(ctr => (
        <div key={ctr.id} onClick={() => onSelect('contract', ctr)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px', minHeight: 56, borderBottom: '1px solid var(--line)', cursor: 'pointer' }}>
          <span style={{ flex: '0 0 110px', minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ctr.title}</span>
            <span style={{ display: 'block', fontFamily: 'var(--mono)', fontSize: 9.5, color: 'var(--mute-2)' }}>{ctr.id}</span>
          </span>
          <span style={{ flex: '0 0 140px', display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}><BAvatar who={ctr.client} size={24} /><span style={{ fontSize: 12, color: 'var(--ink-soft)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c[ctr.client].name}</span></span>
          <span style={{ flex: '0 0 80px', fontSize: 12, color: 'var(--mute)' }}>{ctr.term}</span>
          <span style={{ flex: '0 0 84px', textAlign: 'right', fontFamily: 'var(--serif)', fontSize: 16, color: 'var(--ink)' }}>{bEur0(ctr.value)}</span>
          <span style={{ flex: '0 0 90px' }}><BContractStatus k={ctr.status} /></span>
        </div>
      ))}
    </MBTableScroll>
  );
}

Object.assign(window, {
  MBSegment, MBViewToggle, MBTopBar, MBStatStrip, MBChips, MBSection,
  MBInvoiceCard, MBInvoiceList, MBExpenseCard, MBExpenseList, MBContractCard, MBContractList,
  MBTableScroll, MBInvoiceTable, MBExpenseTable, MBContractTable,
});
