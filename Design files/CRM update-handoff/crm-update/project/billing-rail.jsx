// billing-rail.jsx — persistent left list rail for the Billing master-detail layout.
// Header (title + tab icons + search/filter/sort/new) and a compact, grouped list.
// Selected row = white card. Depends on billing-components.jsx, billing-data.js.

// ─── Compact rail row shell ────────────────────────────────────────
function RailRow({ active, onClick, children }) {
  return (
    <div onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 11, padding: '11px 12px', borderRadius: 'var(--r-surface)', cursor: 'pointer',
      background: active ? 'var(--card)' : 'transparent',
      boxShadow: active ? 'var(--sh-raised-crisp)' : 'none',
      position: 'relative', transition: 'background 120ms',
    }}
    onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'var(--surface)'; }}
    onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}>
      {active && <span style={{ position: 'absolute', left: 0, top: 12, bottom: 12, width: 3, borderRadius: '0 3px 3px 0', background: 'var(--wine)' }} />}
      {children}
    </div>
  );
}
function RailGroup({ label, count, accent, amount }) {
  return (
    <div className="row" style={{ gap: 8, padding: '14px 6px 7px' }}>
      {accent && <span style={{ width: 7, height: 7, borderRadius: '50%', background: accent, flexShrink: 0 }} />}
      <span style={{ fontFamily: 'var(--mono)', fontSize: 9.5, letterSpacing: '0.13em', textTransform: 'uppercase', color: 'var(--ink-soft)', fontWeight: 700 }}>{label}</span>
      {count != null && <span style={{ fontFamily: 'var(--mono)', fontSize: 8.5, color: 'var(--mute-2)' }}>{count}</span>}
      <div className="rule" style={{ flex: 1, marginLeft: 2 }} />
      {amount != null && <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--mute)', fontWeight: 600 }}>{amount}</span>}
    </div>
  );
}

// ─── Invoice rail item ─────────────────────────────────────────────
function InvoiceRailItem({ inv, active, onClick, today }) {
  const c = LA_BILLING.clients[inv.client];
  return (
    <RailRow active={active} onClick={onClick}>
      <BAvatar who={inv.client} size={36} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="row" style={{ justifyContent: 'space-between', gap: 8 }}>
          <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
          <span style={{ fontFamily: 'var(--serif)', fontSize: 15, color: 'var(--ink)', flexShrink: 0 }}>{bEur0(inv.amount)}</span>
        </div>
        <div className="row" style={{ justifyContent: 'space-between', gap: 8, marginTop: 4 }}>
          <span className="row" style={{ gap: 6, minWidth: 0 }}>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 9.5, color: 'var(--mute-2)' }}>{inv.id}</span>
            <BInvoiceStatus k={inv.status} />
          </span>
          <span style={{ flexShrink: 0 }}><BDueLabel due={inv.due} status={inv.status} today={today} /></span>
        </div>
      </div>
    </RailRow>
  );
}
function InvoiceRailList({ items, activeId, onSelect, today }) {
  const order = [['overdue','Overdue','var(--stage-lost)'],['sent','Outstanding',null],['draft','Drafts',null],['paid','Paid','var(--good)']];
  return order.map(([k, label, accent]) => {
    const g = items.filter(i => i.status === k);
    if (!g.length) return null;
    return (
      <div key={k}>
        <RailGroup label={label} count={g.length} accent={accent} amount={bEur0(g.reduce((s,i)=>s+i.amount,0))} />
        {g.map(inv => <InvoiceRailItem key={inv.id} inv={inv} active={inv.id === activeId} onClick={() => onSelect(inv)} today={today} />)}
      </div>
    );
  });
}

// ─── Expense rail item ─────────────────────────────────────────────
function ExpenseRailItem({ exp, active, onClick }) {
  return (
    <RailRow active={active} onClick={onClick}>
      <span style={{ width: 36, height: 36, borderRadius: 'var(--r-surface)', flexShrink: 0, background: 'var(--bg)', boxShadow: 'var(--sh-inset-crisp)', color: 'var(--mute)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><BIExpense size={16} /></span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="row" style={{ justifyContent: 'space-between', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{exp.desc}</span>
          <span style={{ fontFamily: 'var(--serif)', fontSize: 14, color: 'var(--ink)', flexShrink: 0 }}>{bMoney(exp.total, exp.cur)}</span>
        </div>
        <div className="row" style={{ justifyContent: 'space-between', gap: 8, marginTop: 4 }}>
          <span className="row" style={{ gap: 6, minWidth: 0 }}>
            <span style={{ fontSize: 10.5, color: 'var(--mute)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 90 }}>{exp.supplier}</span>
            <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--mute-2)', flexShrink: 0 }} />
            <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: exp.ded ? 'var(--good)' : 'var(--mute-2)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{exp.ded ? 'BTW' : 'No BTW'}</span>
          </span>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--mute-2)', flexShrink: 0 }}>{exp.date.slice(5)}</span>
        </div>
      </div>
    </RailRow>
  );
}
function ExpenseRailList({ items, activeId, onSelect }) {
  const groups = window.bExpenseGroups(items);
  return groups.map(g => g.quarters.map(qg => {
    const s = window.bSums(qg.items);
    return (
      <div key={g.y + '-' + qg.q}>
        <RailGroup label={`${g.y} · Q${qg.q}`} count={qg.items.length} amount={bMoney(s.totalEur, 'EUR')} />
        {qg.items.map(exp => <ExpenseRailItem key={exp.id} exp={exp} active={exp.id === activeId} onClick={() => onSelect(exp)} />)}
      </div>
    );
  }));
}

// ─── Contract rail item ────────────────────────────────────────────
function ContractRailItem({ ctr, active, onClick }) {
  const c = LA_BILLING.clients[ctr.client];
  return (
    <RailRow active={active} onClick={onClick}>
      <BAvatar who={ctr.client} size={36} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="row" style={{ justifyContent: 'space-between', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ctr.title}</span>
          <span style={{ fontFamily: 'var(--serif)', fontSize: 14, color: 'var(--ink)', flexShrink: 0 }}>{bEur0(ctr.value)}</span>
        </div>
        <div className="row" style={{ justifyContent: 'space-between', gap: 8, marginTop: 4 }}>
          <span style={{ fontSize: 10.5, color: 'var(--mute)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
          <BContractStatus k={ctr.status} />
        </div>
      </div>
    </RailRow>
  );
}
function ContractRailList({ items, activeId, onSelect }) {
  const order = [['sent','Awaiting signature','var(--warn)'],['draft','Drafts',null],['active','Active','var(--good)'],['signed','Signed',null]];
  return order.map(([k, label, accent]) => {
    const g = items.filter(i => i.status === k);
    if (!g.length) return null;
    return (
      <div key={k}>
        <RailGroup label={label} count={g.length} accent={accent} />
        {g.map(ctr => <ContractRailItem key={ctr.id} ctr={ctr} active={ctr.id === activeId} onClick={() => onSelect(ctr)} />)}
      </div>
    );
  });
}

// ─── Icon-only tab segment for the rail header ─────────────────────
function RailTabs({ tab, setTab, tabs }) {
  return (
    <div className="la-seg">
      {tabs.map(o => {
        const on = o.key === tab;
        return (
          <button key={o.key} onClick={() => setTab(o.key)} title={o.label} className={`la-seg-btn${on ? ' on' : ''}`}>
            <o.Ic size={14} />{on ? o.label : ''}
          </button>
        );
      })}
    </div>
  );
}

// ─── Small round rail action button ───────────────────────────────
function RailIconBtn({ Ic, onClick, active, title }) {
  return (
    <button onClick={onClick} title={title} style={{
      width: 34, height: 34, borderRadius: 'var(--r-button)', flexShrink: 0, border: 'none', cursor: 'pointer',
      background: active ? 'var(--card)' : 'var(--surface)', boxShadow: active ? 'var(--sh-inset-crisp)' : 'var(--sh-raised-crisp)',
      color: active ? 'var(--wine)' : 'var(--mute)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}><Ic size={15} /></button>
  );
}

// ═══ The rail — list only (header lives in BillingApp top bar) ═══
function BillingRail({ tab, setTab, tabOpts,
  view, setView, role, setRole,
  filter, setFilter, chips,
  items, activeId, onSelect, onNew,
  today, clientView, newLabel, count, totalLabel }) {
  const B = window.LA_BILLING;
  return (
    <div style={{ width: 320, flexShrink: 0, background: 'var(--bg)', borderRight: '1px solid var(--line)', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* Private badge (expenses only) */}
      {tab === 'expenses' && !clientView && (
        <div style={{ padding: '8px 10px 0', display: 'flex' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 11px', borderRadius: 'var(--r-pill)', background: 'var(--wine-tint)', color: 'var(--wine)' }}>
            <BILock size={11} />
            <span style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700 }}>Private</span>
          </span>
        </div>
      )}

      {/* Client view compact hint */}
      {clientView && (
        <div style={{ padding: '8px 10px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 'var(--r-surface)', background: 'var(--surface)', boxShadow: 'var(--sh-raised-crisp)' }}>
            <BAvatar who="gourmet" size={20} />
            <span style={{ fontSize: 11, color: 'var(--mute)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              Client portal · {B.clients['gourmet'].name}
            </span>
          </div>
        </div>
      )}

      {/* Filter chips */}
      {(
        <div style={{ padding: '8px 10px 0', display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {chips.map(([k, label, cnt]) => {
            const on = k === filter;
            return (
              <button key={k} onClick={() => setFilter(k)} style={{
                display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 'var(--r-pill)', border: 'none', cursor: 'pointer',
                background: on ? 'var(--wine)' : 'var(--surface)', boxShadow: on ? 'none' : 'var(--sh-raised-crisp)',
                color: on ? 'var(--paper)' : 'var(--ink-soft)', fontSize: 11, fontWeight: on ? 700 : 500,
              }}>{label}{cnt != null && <span style={{ fontFamily: 'var(--mono)', fontSize: 8, fontWeight: 700, color: on ? 'var(--paper)' : 'var(--mute-2)', background: on ? 'rgba(255,255,255,0.2)' : 'var(--bg-2)', borderRadius: 'var(--r-pill)', padding: '0 5px' }}>{cnt}</span>}</button>
            );
          })}
        </div>
      )}

      {/* Divider before list */}
      <div style={{ margin: '10px 10px 0', height: 1, background: 'var(--line)' }} />
      {/* list */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '4px 10px 16px' }}>
        {count === 0 && (
          <div style={{ padding: '48px 16px', textAlign: 'center', color: 'var(--mute-2)' }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 9.5, letterSpacing: '0.14em', textTransform: 'uppercase' }}>Nothing here</div>
          </div>
        )}
        {tab === 'invoices' && <InvoiceRailList items={items} activeId={activeId} onSelect={onSelect} today={today} />}
        {tab === 'expenses' && <ExpenseRailList items={items} activeId={activeId} onSelect={onSelect} />}
        {tab === 'contracts' && <ContractRailList items={items} activeId={activeId} onSelect={onSelect} />}
      </div>
      {/* footer total */}
      {totalLabel && (
        <div className="row" style={{ flexShrink: 0, justifyContent: 'space-between', padding: '12px 18px', borderTop: '1px solid var(--line)', background: 'var(--bg-2)' }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 9.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--mute-2)' }}>{totalLabel.label}</span>
          <span className="serif" style={{ fontSize: 18, color: 'var(--ink)' }}>{totalLabel.value}</span>
        </div>
      )}
    </div>
  );
}

Object.assign(window, {
  RailRow, RailGroup, InvoiceRailItem, InvoiceRailList, ExpenseRailItem, ExpenseRailList,
  ContractRailItem, ContractRailList, RailTabs, RailIconBtn, BillingRail,
});
