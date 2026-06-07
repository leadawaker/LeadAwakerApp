// billing-app.jsx — Billing orchestrator: sidebar (with live notification bell),
// header (Admin/Client view), tabs (Invoices/Expenses/Contracts), stats, filters, content + drawer.
// Depends on: billing-components.jsx, billing-views.jsx, billing-data.js, components.jsx

// ─── Sidebar (mirrors components.jsx Sidebar, but wires the bell) ───
function BillingSidebar({ onBell, unread, notifOpen }) {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const groups = [
    { section: 'Menu',    list: [['Campaigns', IconCampaigns]] },
    { section: 'Engage',  list: [['Leads', IconLeads], ['Chats', IconChats], ['Calendar', IconCal]] },
    { section: 'Admin',   list: [['Accounts', IconAccts], ['Billing', IconBilling], ['Tasks', IconTasks]] },
    { section: 'Backend', list: [['Prompt Library', IconLibrary], ['Automations', IconAuto]] },
    { section: 'Outreach',list: [['Prospects', IconProspect], ['Cadence', IconCadence]] },
  ];
  return (
    <div style={{ width: 214, background: 'var(--bg-2)', borderRight: '1px solid var(--line)', display: 'flex', flexDirection: 'column', height: '100%', flexShrink: 0 }}>
      <div style={{ height: 60, flexShrink: 0, padding: '0 16px', display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--line)' }}>
        <Logo size={19} />
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 12px', display: 'flex', flexDirection: 'column', gap: 3 }}>
        <button className="la-switcher" style={{ marginBottom: 12 }}>
          <span className="row" style={{ gap: 8 }}><IconSwap size={13} /><span>Agency View</span></span>
          <span style={{ display: 'flex', transform: 'rotate(90deg)', color: 'var(--mute-2)' }}><IconChev size={12} /></span>
        </button>
        {groups.map((g, gi) => (
          <React.Fragment key={gi}>
            <div className="la-nav-section">{g.section}</div>
            {g.list.map(([label, Ic]) => (
              <div key={label} className={`la-nav-item ${label === 'Billing' ? 'active' : ''}`}>
                <span className="icon"><Ic size={16} /></span>{label}
              </div>
            ))}
          </React.Fragment>
        ))}
      </div>
      <div style={{ padding: '12px 12px 14px', borderTop: '1px solid var(--line)' }}>
        <div className="la-util-row">
          {[[IconSearch,'Search',false],[IconBell,'Notifications',true],[IconMoon,'Theme',false],[IconHelp,'Help',false],[IconHeadset,'Support',false]].map(([Ic,label,isBell],i) => (
            <button key={i} className="la-util-btn" title={label} onClick={isBell ? onBell : undefined}
              style={isBell && notifOpen ? { color: 'var(--wine)', boxShadow: 'var(--sh-inset-crisp)' } : undefined}>
              <Ic size={15} />
              {isBell && unread > 0 && (
                <span style={{ position: 'absolute', top: 1, right: 1, minWidth: 15, height: 15, padding: '0 4px', borderRadius: 'var(--r-pill)', background: 'var(--wine)', color: 'var(--paper)', fontFamily: 'var(--mono)', fontSize: 8.5, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--sh-raised-crisp)' }}>{unread > 9 ? '9+' : unread}</span>
              )}
            </button>
          ))}
        </div>
        <div style={{ position: 'relative', marginTop: 10 }}>
          {menuOpen && (
            <div className="la-profile-menu">
              <button className="la-profile-menu-item"><IconSettings size={14} />Settings</button>
              <button className="la-profile-menu-item"><IconAccts size={14} />Account</button>
              <div className="rule" style={{ margin: '6px 8px' }} />
              <button className="la-profile-menu-item"><IconLogout size={14} />Sign out</button>
            </div>
          )}
          <button className={`la-profile ${menuOpen ? 'open' : ''}`} onClick={() => setMenuOpen(o => !o)}>
            <span className="la-profile-av">GB</span>
            <span style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
              <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Gabriel Barbosa</span>
              <span style={{ display: 'block', fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--mute-2)' }}>Agency Admin</span>
            </span>
            <span style={{ display: 'flex', transform: menuOpen ? 'rotate(-90deg)' : 'rotate(90deg)', transition: 'transform 160ms', color: 'var(--mute-2)' }}><IconChev size={12} /></span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Filter chips ──────────────────────────────────────────────────
function BFilterChips({ chips, value, setValue }) {
  return (
    <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
      {chips.map(([k, label, count]) => {
        const on = k === value;
        return (
          <button key={k} onClick={() => setValue(k)} style={{
            display: 'flex', alignItems: 'center', gap: 7, padding: '7px 13px', borderRadius: 'var(--r-pill)', border: 'none', cursor: 'pointer',
            background: on ? 'var(--wine)' : 'var(--surface)', boxShadow: on ? 'none' : 'var(--sh-raised-crisp)',
            color: on ? 'var(--paper)' : 'var(--ink-soft)', fontSize: 12, fontWeight: on ? 700 : 500, transition: 'all 120ms',
          }}>
            {label}
            {count != null && <span style={{ fontFamily: 'var(--mono)', fontSize: 9, fontWeight: 700, color: on ? 'var(--paper)' : 'var(--mute-2)', background: on ? 'rgba(255,255,255,0.18)' : 'var(--bg-2)', borderRadius: 'var(--r-pill)', padding: '1px 7px' }}>{count}</span>}
          </button>
        );
      })}
    </div>
  );
}

// ═══ APP ═══════════════════════════════════════════════════════════
function BillingApp() {
  const B = window.LA_BILLING;
  const [role, setRole] = React.useState('admin');           // admin | client
  const [tab, setTab] = React.useState('invoices');          // invoices | expenses | contracts
  const [view, setView] = React.useState('list');            // list | table
  const [filter, setFilter] = React.useState('all');
  const [sel, setSel] = React.useState(null);                // selected item (data object)
  const [formOpen, setFormOpen] = React.useState(false);     // New X form takeover
  const [notifOpen, setNotifOpen] = React.useState(false);
  const [notifs, setNotifs] = React.useState(B.notifications);
  const clientView = role === 'client';
  const CLIENT = 'gourmet';                                   // impersonated client in Client View

  // role/tab guards
  React.useEffect(() => { if (clientView && tab === 'expenses') setTab('invoices'); }, [clientView, tab]);
  React.useEffect(() => { setFilter('all'); setFormOpen(false); }, [tab, role]);
  const unread = notifs.filter(n => n.unread).length;

  // ── data per tab (filtered by role + chip) ──
  const invoices = (clientView ? B.invoices.filter(i => i.client === CLIENT && i.status !== 'draft') : B.invoices)
    .filter(i => filter === 'all' ? true : i.status === filter);
  const expenses = B.expenses.filter(e => filter === 'all' ? true : filter === 'ded' ? e.ded : filter === 'nonded' ? !e.ded : ('y' + e.y) === filter);
  const contracts = (clientView ? B.contracts.filter(c => c.client === CLIENT && c.status !== 'draft') : B.contracts)
    .filter(c => filter === 'all' ? true : c.status === filter);

  const select = (kind, data) => setSel({ kind, data: { ...data } });

  const currentItems = tab === 'invoices' ? invoices : tab === 'expenses' ? expenses : contracts;
  const selValid = sel && currentItems.some(x => x.id === sel.id);
  // keep a selection live as tab/role/filter change
  React.useEffect(() => {
    setSel(prev => (prev && currentItems.some(x => x.id === prev.id)) ? prev : (currentItems[0] || null));
  }, [tab, role, filter]);

  // ── tab segmented options ──
  const tabOpts = [
    { key: 'invoices', label: 'Invoices', Ic: BIInvoice },
    ...(!clientView ? [{ key: 'expenses', label: 'Expenses', Ic: BIExpense }] : []),
    { key: 'contracts', label: 'Contracts', Ic: BIContract },
  ];

  // ── filter chip sets ──
  const fc = window.bCount;
  const invChips = [['all','All'],['sent','Outstanding'],['overdue','Overdue'],['paid','Paid'], ...(!clientView ? [['draft','Drafts']] : [])];
  const expChips = [['all','All'],['y2026','2026'],['y2025','2025'],['ded','Deductible'],['nonded','Non-deductible']];
  const ctrChips = [['all','All'],['sent','Awaiting'],['active','Active'],['signed','Signed'], ...(!clientView ? [['draft','Drafts']] : [])];

  const newLabel = tab === 'invoices' ? 'New invoice' : tab === 'expenses' ? 'Add expense' : 'New contract';
  const chipsForTab = (tab === 'invoices' ? invChips : tab === 'expenses' ? expChips : ctrChips)
    .map(([k, label]) => [k, label, chipCount(tab, k, clientView, B, CLIENT)]);

  // rail footer total
  const totalLabel = tab === 'invoices'
    ? { label: 'Outstanding', value: bEur0(sum(invoices.filter(i=>i.status!=='paid'), i=>i.amount)) }
    : tab === 'expenses'
      ? { label: 'Total spend', value: bEur0(sum(expenses.filter(e=>e.cur==='EUR'), e=>e.total)) }
      : { label: 'Annual value', value: bEur0(sum(contracts.filter(c=>c.status==='active'||c.status==='signed'), c=>c.value)) };

  // List view = fixed rail + detail. Table view = full-width table with the
  // stat widgets as a header row above it (no right-side panel).
  const isList = view === 'list';

  return (
    <div className="la-app" style={{ width: '100%', height: '100%', display: 'flex', overflow: 'hidden', position: 'relative' }}>
      {!formOpen && <BillingSidebar onBell={() => setNotifOpen(o => !o)} unread={unread} notifOpen={notifOpen} />}

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg)', position: 'relative' }}>
        {formOpen ? (
          tab === 'invoices' ? <InvoiceForm onClose={() => setFormOpen(false)} />
          : tab === 'expenses' ? <ExpenseForm onClose={() => setFormOpen(false)} />
          : <ContractBuilder onClose={() => setFormOpen(false)} />
        ) : (
            <div style={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden' }}>
              <BillingRail
                tab={tab} setTab={setTab} tabOpts={tabOpts}
                view={view} setView={setView}
                role={role} setRole={setRole}
                filter={filter} setFilter={setFilter} chips={chipsForTab}
                items={currentItems} activeId={sel?.id} onSelect={(d) => setSel(d)} onNew={() => setFormOpen(true)}
                today={B.today} clientView={clientView} newLabel={newLabel} count={currentItems.length} totalLabel={totalLabel} />
              {isList ? (
                /* list: detail area */
                <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', background: 'var(--bg)' }}>
                  {selValid ? (
                    <div style={{ maxWidth: 720, margin: '0 auto' }}>
                      {tab === 'invoices'  && <InvoiceDetail  inv={sel} today={B.today} clientView={clientView} onClose={() => setSel(null)} />}
                      {tab === 'expenses'  && <ExpenseDetail  exp={sel} onClose={() => setSel(null)} />}
                      {tab === 'contracts' && <ContractDetail ctr={sel} clientView={clientView} onClose={() => setSel(null)} />}
                    </div>
                  ) : (
                    <div style={{ padding: '28px 32px' }}>
                      {clientView && <ClientBanner client={B.clients[CLIENT]} />}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14, marginBottom: 26 }}>
                        {statCards(tab, clientView, B, CLIENT).map((s, i) => <BStat key={i} {...s} />)}
                      </div>
                      <div style={{ padding: '50px 20px', textAlign: 'center', color: 'var(--mute-2)' }}>
                        <BIInvoice size={26} />
                        <div style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', marginTop: 12 }}>Select an item to view it here</div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* table view: stat cards + full-width table to the right of the rail */
                <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', background: 'var(--bg)', padding: '24px 28px 40px' }}>
                  {clientView && <ClientBanner client={B.clients[CLIENT]} />}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14, marginBottom: 18 }}>
                    {statCards(tab, clientView, B, CLIENT).map((s, i) => <BStat key={i} {...s} />)}
                  </div>
                  {tab === 'invoices'  && <InvoiceTable  items={currentItems} activeId={sel?.id} today={B.today} onSelect={(d) => { setSel(d); setView('list'); }} />}
                  {tab === 'expenses'  && <ExpenseTable  items={currentItems} activeId={sel?.id} onSelect={(d) => { setSel(d); setView('list'); }} />}
                  {tab === 'contracts' && <ContractTable items={currentItems} activeId={sel?.id} onSelect={(d) => { setSel(d); setView('list'); }} />}
                  {currentItems.length === 0 && <BEmpty />}
                </div>
              )}
            </div>
        )}
      </div>

      {/* ── Notification panel (anchored to sidebar bell) ── */}
      {notifOpen && !formOpen && (
        <NotificationPanel items={notifs} onState={setNotifs} onClose={() => setNotifOpen(false)}
          anchor={{ left: 16, bottom: 60 }} />
      )}
    </div>
  );
}

function ClientBanner({ client }) {
  return (
    <div className="glass" style={{ borderRadius: 'var(--r-surface)', padding: '13px 16px', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 11 }}>
      <span style={{ width: 30, height: 30, borderRadius: 'var(--r-button)', background: 'var(--wine-tint)', color: 'var(--wine)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><BIBuilding size={16} /></span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>Client portal preview</div>
        <div style={{ fontSize: 12, color: 'var(--mute)', marginTop: 1 }}>This is exactly what {client.name} sees — invoices to pay and contracts to sign. Expenses stay private to you.</div>
      </div>
    </div>
  );
}
function BEmpty() {
  return (
    <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--mute-2)' }}>
      <BIInvoice size={26} />
      <div style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', marginTop: 12 }}>Nothing here</div>
    </div>
  );
}

// ─── stats + counts ────────────────────────────────────────────────
function sum(arr, f) { return arr.reduce((a, x) => a + f(x), 0); }
function statCards(tab, clientView, B, CLIENT) {
  if (tab === 'invoices') {
    if (clientView) {
      const mine = B.invoices.filter(i => i.client === CLIENT && i.status !== 'draft');
      return [
        { label: 'Outstanding', value: bEur0(sum(mine.filter(i=>i.status!=='paid'), i=>i.amount)), sub: 'Across open invoices', accent: 'var(--stage-contacted)', Ic: BIInvoice },
        { label: 'Overdue',     value: bEur0(sum(mine.filter(i=>i.status==='overdue'), i=>i.amount)), sub: 'Please settle soon', accent: 'var(--stage-lost)', Ic: BIWarn },
        { label: 'Paid to date',value: bEur0(sum(mine.filter(i=>i.status==='paid'), i=>i.amount)), sub: 'Thank you', accent: 'var(--good)', Ic: BICheck },
      ];
    }
    return [
      { label: 'Billed this month', value: bEur0(sum(B.invoices.filter(i=>i.issued>='2026-05-01'), i=>i.amount)), sub: '6 invoices issued', accent: 'var(--wine)', Ic: BIInvoice },
      { label: 'Outstanding', value: bEur0(sum(B.invoices.filter(i=>i.status==='sent'||i.status==='overdue'), i=>i.amount)), sub: '5 awaiting payment', accent: 'var(--stage-contacted)', Ic: BIClock },
      { label: 'Overdue', value: bEur0(sum(B.invoices.filter(i=>i.status==='overdue'), i=>i.amount)), sub: '2 invoices past due', accent: 'var(--stage-lost)', Ic: BIWarn },
      { label: 'Collected', value: bEur0(sum(B.invoices.filter(i=>i.status==='paid'), i=>i.amount)), sub: 'Last 30 days', accent: 'var(--good)', Ic: BICheck },
    ];
  }
  if (tab === 'expenses') {
    const e = B.expenses;
    const eurTotal = sum(e.filter(x=>x.cur==='EUR'), x=>x.total);
    const usdTotal = sum(e.filter(x=>x.cur==='USD'), x=>x.total);
    const btw = sum(e, x=>x.btw);
    const dedTotal = sum(e.filter(x=>x.ded), x=>x.total);
    return [
      { label: 'Total spend', value: bEur0(eurTotal), sub: usdTotal > 0 ? ('+ ' + bMoney(usdTotal,'USD') + ' USD · ' + e.length + ' items') : (e.length + ' items'), accent: 'var(--wine)', Ic: BIExpense },
      { label: 'Reclaimable NL BTW', value: bEur0(btw), sub: 'Input VAT to reclaim', accent: 'var(--good)', Ic: BICheck },
      { label: 'Deductible', value: bEur0(dedTotal), sub: e.filter(x=>x.ded).length + ' of ' + e.length + ' expenses', accent: 'var(--stage-contacted)', Ic: BICoins },
      { label: 'Non-deductible', value: bEur0(sum(e.filter(x=>!x.ded), x=>x.total)), sub: e.filter(x=>!x.ded).length + ' US-billed items', accent: 'var(--mute-2)', Ic: BICard },
    ];
  }
  // contracts
  if (clientView) {
    const mine = B.contracts.filter(c => c.client === CLIENT && c.status !== 'draft');
    return [
      { label: 'Active contracts', value: String(mine.filter(c=>c.status==='active'||c.status==='signed').length), sub: 'Currently in effect', accent: 'var(--good)', Ic: BIContract },
      { label: 'Annual value', value: bEur0(sum(mine.filter(c=>c.status==='active'||c.status==='signed'), c=>c.value)), sub: 'Committed', accent: 'var(--wine)', Ic: BICoins },
      { label: 'To sign', value: String(mine.filter(c=>c.status==='sent').length), sub: 'Awaiting your signature', accent: 'var(--warn)', Ic: BIPen },
    ];
  }
  const c = B.contracts;
  const live = c.filter(x=>x.status==='active'||x.status==='signed');
  return [
    { label: 'Active contracts', value: String(live.length), sub: 'Signed & in effect', accent: 'var(--good)', Ic: BIContract },
    { label: 'Annual value', value: bEur0(sum(live, x=>x.value)), sub: 'Recurring revenue', accent: 'var(--wine)', Ic: BICoins },
    { label: 'Awaiting signature', value: String(c.filter(x=>x.status==='sent').length), sub: bEur0(sum(c.filter(x=>x.status==='sent'), x=>x.value)) + ' in play', accent: 'var(--warn)', Ic: BIPen },
    { label: 'Expiring ≤90d', value: String(c.filter(x=>x.end && bDaysFrom(x.end, B.today) <= 90 && bDaysFrom(x.end, B.today) >= 0).length), sub: 'Plan renewals', accent: 'var(--stage-contacted)', Ic: BIClock },
  ];
}
function chipCount(tab, k, clientView, B, CLIENT) {
  if (k === 'all') return null;
  if (tab === 'invoices') { const arr = clientView ? B.invoices.filter(i=>i.client===CLIENT&&i.status!=='draft') : B.invoices; return arr.filter(i=>i.status===k).length; }
  if (tab === 'expenses') return k === 'ded' ? B.expenses.filter(e=>e.ded).length : k === 'nonded' ? B.expenses.filter(e=>!e.ded).length : B.expenses.filter(e=>('y'+e.y)===k).length;
  const arr = clientView ? B.contracts.filter(c=>c.client===CLIENT&&c.status!=='draft') : B.contracts; return arr.filter(c=>c.status===k).length;
}

Object.assign(window, { BillingApp, BillingSidebar, BFilterChips, ClientBanner, BEmpty });
