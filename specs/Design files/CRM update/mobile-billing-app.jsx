// mobile-billing-app.jsx — Billing orchestrator for mobile.
// Ties the top bar, cream segmented tabs, list/table toggle, stats, chips,
// the three tab contents, a detail bottom-sheet and a notification bottom-sheet.
// Depends on: mobile-billing.jsx, billing-views.jsx (detail components + helpers),
// billing-components.jsx, mobile-shell.jsx (MobSheet), billing-data.js.

// ─── Detail bottom-sheet (reuses the desktop detail bodies) ────────
function MBDetailSheet({ sel, today, clientView, onClose }) {
  return (
    <MobSheet open={!!sel} onClose={onClose}>
      <div style={{ height: '100%', background: 'var(--paper)', display: 'flex', flexDirection: 'column', paddingTop: 8 }}>
        {sel?.kind === 'invoice'  && <InvoiceDetail  inv={sel.data} today={today} clientView={clientView} onClose={onClose} />}
        {sel?.kind === 'expense'  && <ExpenseDetail  exp={sel.data} onClose={onClose} />}
        {sel?.kind === 'contract' && <ContractDetail ctr={sel.data} clientView={clientView} onClose={onClose} />}
      </div>
    </MobSheet>
  );
}

// ─── Notification bottom-sheet ─────────────────────────────────────
function MBNotifSheet({ open, items, onState, onClose }) {
  const [list, setList] = React.useState(items);
  const [filter, setFilter] = React.useState('all');   // all | unread
  React.useEffect(() => { if (open) setList(items); }, [open]);
  React.useEffect(() => { onState && onState(list); }, [list]);

  const unread = list.filter(n => n.unread).length;
  const markAll = () => setList(l => l.map(n => ({ ...n, unread: false })));
  const clearAll = () => setList([]);
  const readOne = (id) => setList(l => l.map(n => n.id === id ? { ...n, unread: false } : n));

  const shown = list.filter(n => filter === 'all' || n.unread);
  const week = shown.filter(n => n.group === 'week');
  const older = shown.filter(n => n.group === 'older');

  return (
    <MobSheet open={open} onClose={onClose}>
      <div style={{ height: '100%', background: 'var(--paper)', display: 'flex', flexDirection: 'column', paddingTop: 8 }}>
        <div style={{ flexShrink: 0, padding: '14px 18px 0' }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className="serif" style={{ fontSize: 27, color: 'var(--ink)' }}>Notifications</span>
            <button onClick={markAll} style={{ display: 'flex', alignItems: 'center', gap: 5, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--wine)', fontSize: 12.5, fontWeight: 600 }}>
              <BICheck size={13} />Read all
            </button>
          </div>
          <div className="row" style={{ gap: 8, marginTop: 12, marginBottom: 12 }}>
            <MBSegment small value={filter} onChange={setFilter}
              options={[{ key: 'all', label: 'All' }, { key: 'unread', label: 'Unread', badge: unread }]} />
            <div style={{ flex: 1 }} />
            <button onClick={clearAll} style={{ display: 'flex', alignItems: 'center', gap: 5, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--mute)', fontSize: 12, fontWeight: 500 }}>
              <BITrash size={13} />Clear
            </button>
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, borderTop: '1px solid var(--line)' }}>
          {shown.length === 0 && (
            <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--mute-2)' }}>
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
    </MobSheet>
  );
}

// ─── Bottom nav (Billing active, cream raised) ─────────────────────
function MBBottomNav() {
  const tabs = [
    { key: 'Leads', Ic: IconLeads, label: 'Leads' },
    { key: 'Chats', Ic: IconChats, label: 'Chats' },
    { key: 'Billing', Ic: IconBilling, label: 'Billing' },
    { key: 'Tasks', Ic: IconTasks, label: 'Tasks' },
    { key: 'More', Ic: IconMore, label: 'More' },
  ];
  const active = 'Billing';
  return (
    <div style={{ flexShrink: 0, display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', background: 'var(--bg-2)', borderTop: '1px solid var(--line)', minHeight: 'var(--bottombar-h)', padding: '8px 6px calc(10px + var(--safe-bottom))' }}>
      {tabs.map(t => {
        const on = t.key === active;
        return (
          <button key={t.key} style={{ border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, padding: '4px 0' }}>
            <span style={{ width: 56, height: 30, borderRadius: 'var(--r-pill)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: on ? 'var(--wine)' : 'var(--mute)',
              background: on ? 'var(--wine-tint)' : 'transparent',
              boxShadow: on ? 'inset 0 0 0 1px rgba(94,34,48,0.14)' : 'none', transition: 'all 160ms' }}>
              <t.Ic size={21} />
            </span>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase', color: on ? 'var(--wine)' : 'var(--mute-2)', fontWeight: on ? 700 : 400 }}>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ═══ APP ═══════════════════════════════════════════════════════════
function MobileBilling({ embedded }) {
  const B = window.LA_BILLING;
  const [role, setRole] = React.useState('admin');
  const [tab, setTab] = React.useState('invoices');
  const [view, setView] = React.useState('list');
  const [filter, setFilter] = React.useState('all');
  const [sel, setSel] = React.useState(null);
  const [notifOpen, setNotifOpen] = React.useState(false);
  const [notifs, setNotifs] = React.useState(B.notifications);
  const clientView = role === 'client';
  const CLIENT = 'gourmet';

  React.useEffect(() => { if (clientView && tab === 'expenses') setTab('invoices'); }, [clientView, tab]);
  React.useEffect(() => { setFilter('all'); }, [tab, role]);
  const unread = notifs.filter(n => n.unread).length;
  const select = (kind, data) => setSel({ kind, data: { ...data } });

  // data
  const invoices = (clientView ? B.invoices.filter(i => i.client === CLIENT && i.status !== 'draft') : B.invoices)
    .filter(i => filter === 'all' ? true : i.status === filter);
  const expenses = B.expenses.filter(e => filter === 'all' ? true : filter === 'ded' ? e.ded : filter === 'nonded' ? !e.ded : ('y' + e.y) === filter);
  const contracts = (clientView ? B.contracts.filter(c => c.client === CLIENT && c.status !== 'draft') : B.contracts)
    .filter(c => filter === 'all' ? true : c.status === filter);

  const tabOpts = [
    { key: 'invoices', label: 'Invoices', Ic: BIInvoice },
    ...(!clientView ? [{ key: 'expenses', label: 'Expenses', Ic: BIExpense }] : []),
    { key: 'contracts', label: 'Contracts', Ic: BIContract },
  ];

  const cnt = (t, k) => window.MB_chipCount ? window.MB_chipCount(t, k, clientView, B, CLIENT) : null;
  const invChips = [['all','All'],['sent','Outstanding'],['overdue','Overdue'],['paid','Paid'], ...(!clientView ? [['draft','Drafts']] : [])];
  const expChips = [['all','All'],['y2026','2026'],['y2025','2025'],['ded','Deductible'],['nonded','Non-ded.']];
  const ctrChips = [['all','All'],['sent','Awaiting'],['active','Active'],['signed','Signed'], ...(!clientView ? [['draft','Drafts']] : [])];
  const chips = (tab === 'invoices' ? invChips : tab === 'expenses' ? expChips : ctrChips).map(([k, l]) => [k, l, mbChipCount(tab, k, clientView, B, CLIENT)]);

  const cards = mbStatCards(tab, clientView, B, CLIENT);

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg)', overflow: 'hidden' }}>
      <MBTopBar role={role} setRole={setRole} unread={unread} onBell={() => setNotifOpen(true)} onSearch={() => {}} />

      {/* tabs */}
      <div style={{ flexShrink: 0, padding: '12px 16px 0' }}>
        <MBSegment value={tab} onChange={setTab} options={tabOpts} />
      </div>

      {/* scroll body */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, paddingBottom: 28 }}>
        {clientView && (
          <div className="glass" style={{ margin: '12px 16px 0', borderRadius: 'var(--r-surface)', padding: '11px 13px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 28, height: 28, borderRadius: 'var(--r-button)', background: 'var(--wine-tint)', color: 'var(--wine)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><BIBuilding size={15} /></span>
            <span style={{ fontSize: 11.5, color: 'var(--mute)', lineHeight: 1.35 }}>Previewing what <b style={{ color: 'var(--ink)' }}>{B.clients[CLIENT].name}</b> sees. Expenses stay private.</span>
          </div>
        )}

        <div style={{ marginTop: 14 }}><MBStatStrip cards={cards} /></div>

        {/* private badge for expenses */}
        {tab === 'expenses' && !clientView && (
          <div className="row" style={{ gap: 6, margin: '14px 16px 0', padding: '7px 11px', borderRadius: 'var(--r-pill)', background: 'var(--wine-tint)', color: 'var(--wine)', width: 'fit-content' }}>
            <BILock size={12} /><span style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700 }}>Private to you</span>
          </div>
        )}

        {/* chips + view toggle */}
        <div className="row" style={{ gap: 10, margin: '14px 0 4px', alignItems: 'center' }}>
          <div style={{ flex: 1, minWidth: 0 }}><MBChips chips={chips} value={filter} onChange={setFilter} /></div>
          <div style={{ paddingRight: 16, flexShrink: 0 }}><MBViewToggle value={view} onChange={setView} /></div>
        </div>

        {/* content */}
        <div style={{ padding: '0 16px' }}>
          {tab === 'invoices' && (view === 'list'
            ? <MBInvoiceList items={invoices} today={B.today} clientView={clientView} onSelect={select} />
            : <MBInvoiceTable items={invoices} today={B.today} onSelect={select} />)}
          {tab === 'expenses' && !clientView && (view === 'list'
            ? <MBExpenseList items={expenses} onSelect={select} />
            : <MBExpenseTable items={expenses} onSelect={select} />)}
          {tab === 'contracts' && (view === 'list'
            ? <MBContractList items={contracts} onSelect={select} />
            : <MBContractTable items={contracts} onSelect={select} />)}
        </div>
      </div>

      {/* FAB — new (admin only) */}
      {!clientView && (
        <button onClick={() => {}} style={{
          position: 'absolute', right: 18, bottom: embedded ? 24 : 92, zIndex: 15, width: 56, height: 56, borderRadius: 'var(--r-card)', border: 'none', cursor: 'pointer',
          background: 'var(--wine-grad)', color: 'var(--paper)',
          boxShadow: 'var(--sh-raised-large), inset 0 1px 0 rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}><BIPlus size={24} /></button>
      )}

      {!embedded && <MBBottomNav />}

      <MBDetailSheet sel={sel} today={B.today} clientView={clientView} onClose={() => setSel(null)} />
      <MBNotifSheet open={notifOpen} items={notifs} onState={setNotifs} onClose={() => setNotifOpen(false)} />
    </div>
  );
}

// ─── stats + counts (mobile) ───────────────────────────────────────
function mbSum(arr, f) { return arr.reduce((a, x) => a + f(x), 0); }
function mbStatCards(tab, clientView, B, CLIENT) {
  if (tab === 'invoices') {
    if (clientView) {
      const mine = B.invoices.filter(i => i.client === CLIENT && i.status !== 'draft');
      return [
        { label: 'Outstanding', value: bEur0(mbSum(mine.filter(i=>i.status!=='paid'), i=>i.amount)), sub: 'Open invoices', accent: 'var(--stage-contacted)', Ic: BIInvoice },
        { label: 'Overdue', value: bEur0(mbSum(mine.filter(i=>i.status==='overdue'), i=>i.amount)), sub: 'Settle soon', accent: 'var(--stage-lost)', Ic: BIWarn },
        { label: 'Paid', value: bEur0(mbSum(mine.filter(i=>i.status==='paid'), i=>i.amount)), sub: 'To date', accent: 'var(--good)', Ic: BICheck },
      ];
    }
    return [
      { label: 'Billed (May)', value: bEur0(mbSum(B.invoices.filter(i=>i.issued>='2026-05-01'), i=>i.amount)), sub: '6 issued', accent: 'var(--wine)', Ic: BIInvoice },
      { label: 'Outstanding', value: bEur0(mbSum(B.invoices.filter(i=>i.status==='sent'||i.status==='overdue'), i=>i.amount)), sub: '5 open', accent: 'var(--stage-contacted)', Ic: BIClock },
      { label: 'Overdue', value: bEur0(mbSum(B.invoices.filter(i=>i.status==='overdue'), i=>i.amount)), sub: '2 past due', accent: 'var(--stage-lost)', Ic: BIWarn },
      { label: 'Collected', value: bEur0(mbSum(B.invoices.filter(i=>i.status==='paid'), i=>i.amount)), sub: '30 days', accent: 'var(--good)', Ic: BICheck },
    ];
  }
  if (tab === 'expenses') {
    const e = B.expenses;
    return [
      { label: 'Total spend', value: bEur0(mbSum(e.filter(x=>x.cur==='EUR'), x=>x.total)), sub: `${e.length} items`, accent: 'var(--wine)', Ic: BIExpense },
      { label: 'NL BTW', value: bEur0(mbSum(e, x=>x.btw)), sub: 'Reclaimable', accent: 'var(--good)', Ic: BICheck },
      { label: 'Deductible', value: bEur0(mbSum(e.filter(x=>x.ded), x=>x.total)), sub: `${e.filter(x=>x.ded).length}/${e.length}`, accent: 'var(--stage-contacted)', Ic: BICoins },
      { label: 'USD spend', value: '$' + mbSum(e.filter(x=>x.cur==='USD'), x=>x.total).toFixed(2), sub: 'No EU VAT', accent: 'var(--mute-2)', Ic: BICard },
    ];
  }
  if (clientView) {
    const mine = B.contracts.filter(c => c.client === CLIENT && c.status !== 'draft');
    return [
      { label: 'Active', value: String(mine.filter(c=>c.status==='active'||c.status==='signed').length), sub: 'In effect', accent: 'var(--good)', Ic: BIContract },
      { label: 'Value', value: bEur0(mbSum(mine.filter(c=>c.status==='active'||c.status==='signed'), c=>c.value)), sub: 'Committed', accent: 'var(--wine)', Ic: BICoins },
      { label: 'To sign', value: String(mine.filter(c=>c.status==='sent').length), sub: 'Awaiting you', accent: 'var(--warn)', Ic: BIPen },
    ];
  }
  const c = B.contracts;
  const live = c.filter(x=>x.status==='active'||x.status==='signed');
  return [
    { label: 'Active', value: String(live.length), sub: 'In effect', accent: 'var(--good)', Ic: BIContract },
    { label: 'Annual value', value: bEur0(mbSum(live, x=>x.value)), sub: 'Recurring', accent: 'var(--wine)', Ic: BICoins },
    { label: 'Awaiting', value: String(c.filter(x=>x.status==='sent').length), sub: bEur0(mbSum(c.filter(x=>x.status==='sent'), x=>x.value)), accent: 'var(--warn)', Ic: BIPen },
  ];
}
function mbChipCount(tab, k, clientView, B, CLIENT) {
  if (k === 'all') return null;
  if (tab === 'invoices') { const arr = clientView ? B.invoices.filter(i=>i.client===CLIENT&&i.status!=='draft') : B.invoices; return arr.filter(i=>i.status===k).length; }
  if (tab === 'expenses') return k === 'ded' ? B.expenses.filter(e=>e.ded).length : k === 'nonded' ? B.expenses.filter(e=>!e.ded).length : B.expenses.filter(e=>('y'+e.y)===k).length;
  const arr = clientView ? B.contracts.filter(c=>c.client===CLIENT&&c.status!=='draft') : B.contracts; return arr.filter(c=>c.status===k).length;
}

Object.assign(window, { MobileBilling, MBDetailSheet, MBNotifSheet, MBBottomNav, mbStatCards, mbChipCount });
