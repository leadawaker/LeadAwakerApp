// leads-views.jsx — collection views (list / table / kanban) + the Leads app
// Depends on: components.jsx, leads-components.jsx, leads-data.js

const IconCheckS = (p) => <Icon {...p} d={<path d="m5 12 5 5 9-12"/>} />;
const IconChevL  = (p) => <Icon {...p} d={<path d="m15 18-6-6 6-6"/>} />;
const IconChevR  = (p) => <Icon {...p} d={<path d="m9 6 6 6-6 6"/>} />;

// ─── Checkbox ──────────────────────────────────────────────────────
function Check({ on, onClick, ariaAll }) {
  return (
    <button onClick={(e) => { e.stopPropagation(); onClick(); }} style={{
      width: 18, height: 18, borderRadius: 5, flexShrink: 0,
      border: on ? 'none' : '1.5px solid var(--line-strong)',
      background: on ? 'var(--wine)' : 'transparent',
      display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff',
      transition: 'all 120ms',
    }}>{on && <IconCheckS size={12} />}</button>
  );
}

// ─── Stage status pill (used in table) ─────────────────────────────
function StatusDot({ lead }) {
  const s = stageOf(lead);
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
      <span style={{ fontSize: 12.5, color: 'var(--ink-soft)', fontWeight: 500 }}>{s.label}</span>
    </span>
  );
}

// ═══ Collection toolbar (page header) ══════════════════════════════
function CollectionToolbar({ view, setView, total, selectedCount, onClearSel, peekOn, onTogglePeek }) {
  const views = [
    { key: 'list',   Ic: IconListV,   label: 'List' },
    { key: 'table',  Ic: IconTableV,  label: 'Table' },
    { key: 'kanban', Ic: IconKanbanV, label: 'Pipeline' },
  ];
  return (
    <div style={{ height: 60, flexShrink: 0, padding: '0 20px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <span style={{ fontFamily: 'var(--serif)', fontSize: 24, color: 'var(--ink)', letterSpacing: '-0.01em' }}>My Leads</span>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--mute-2)', letterSpacing: '0.1em' }}>{total}</span>
      </div>

      {/* View switcher */}
      <div className="la-seg">
        {views.map(v => {
          const on = v.key === view;
          return (
            <button key={v.key} onClick={() => setView(v.key)} title={v.label} className={`la-seg-btn${on ? ' on' : ''}`}><v.Ic size={14} />{v.label}</button>
          );
        })}
      </div>

      {/* Single chat-peek toggle — reveals the last message under every lead.
          In Table view the last message is its own always-on column, so this
          toggle is only relevant in List view. */}
      {view === 'list' && (
        <button onClick={onTogglePeek} title="Show last message for every lead"
                className={`la-btn ${peekOn ? 'la-btn--wine' : 'la-btn--soft'}`}><IconChatPeek size={14} />Chats</button>
      )}

      <div style={{ flex: 1 }} />

      {selectedCount > 0 ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--wine)', fontWeight: 700 }}>{selectedCount} selected</span>
          {['Bump', 'Tag', 'Export'].map(a => (
            <button key={a} className="la-btn la-btn--soft">{a}</button>
          ))}
          <button onClick={onClearSel} className="la-btn la-btn--soft la-btn--icon"><IconX size={13} /></button>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ position: 'relative' }}>
            <input className="neu-input" placeholder="Search leads…" style={{ paddingLeft: 32, fontSize: 12, padding: '8px 12px 8px 32px', width: 200 }} />
            <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--mute-2)', display: 'flex' }}><IconSearch size={13} /></span>
          </div>
          {[IconFilter, IconSort].map((Ic, i) => (
            <button key={i} className="la-btn la-btn--inset la-btn--icon"><Ic size={13} /></button>
          ))}
          <button className="la-btn la-btn--wine"><IconPlus size={12} />New</button>
        </div>
      )}
    </div>
  );
}

function GroupHeader({ label, count }) {
  return (
    <div style={{ padding: '8px 6px 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontFamily: 'var(--mono)', fontSize: 8.5, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--mute-2)' }}>{label}</span>
      <span style={{ fontFamily: 'var(--mono)', fontSize: 8.5, color: 'var(--mute-2)', background: 'var(--bg)', boxShadow: 'var(--sh-inset-crisp)', padding: '1px 6px', borderRadius: 'var(--r-pill)' }}>{count}</span>
    </div>
  );
}

// ═══ LIST view ═════════════════════════════════════════════════════
function ListRow({ lead, active, selected, showPeek, onClick, onToggle }) {
  const stage = stageOf(lead);
  return (
    <div style={{
      borderRadius: 'var(--r-surface)', position: 'relative',
      background: active ? 'var(--card)' : 'transparent',
      boxShadow: active ? 'var(--sh-raised-crisp)' : 'none',
      transition: 'all 130ms',
    }}>
      {active && <div style={{ position: 'absolute', left: 0, top: 10, bottom: 10, width: 3, background: 'var(--wine)', borderRadius: '0 3px 3px 0' }} />}
      <div onClick={onClick} style={{ padding: '10px 10px', cursor: 'pointer', display: 'flex', gap: 10, alignItems: 'center' }}>
        <Check on={selected} onClick={onToggle} />
        <StageAvatar lead={lead} size={36} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lead.name}</span>
            {lead.demo && <span style={{ fontFamily: 'var(--mono)', fontSize: 7.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--mute-2)', border: '1px solid var(--line-strong)', borderRadius: 3, padding: '1px 4px', flexShrink: 0 }}>demo</span>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: stage.color, flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: 'var(--mute)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{stage.label}{lead.campaign ? ` · ${lead.campaign}` : ''}</span>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5, flexShrink: 0 }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 8.5, color: 'var(--mute-2)', letterSpacing: '0.06em' }}>{lead.ago}</span>
          {lead.score > 0 && <ScoreArc score={lead.score} size={28} sw={2.5} />}
        </div>
      </div>
      {showPeek && <LastMsgPeek lead={lead} />}
    </div>
  );
}

function ListView({ leads, activeId, selected, showPeek, onSelectLead, onToggle }) {
  const week = leads.filter(l => l.grp === 'week');
  const month = leads.filter(l => l.grp === 'month');
  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '6px 10px' }}>
      <GroupHeader label="This Week" count={week.length} />
      {week.map(l => <ListRow key={l.id} lead={l} active={l.id === activeId} selected={selected.has(l.id)} showPeek={showPeek} onClick={() => onSelectLead(l.id)} onToggle={() => onToggle(l.id)} />)}
      <div style={{ height: 1, background: 'var(--line)', margin: '8px 4px 2px' }} />
      <GroupHeader label="This Month" count={month.length} />
      {month.map(l => <ListRow key={l.id} lead={l} active={l.id === activeId} selected={selected.has(l.id)} showPeek={showPeek} onClick={() => onSelectLead(l.id)} onToggle={() => onToggle(l.id)} />)}
    </div>
  );
}

// ═══ TABLE view ════════════════════════════════════════════════════
const TABLE_COLS = [
  { key: 'name',     label: 'Name',          w: 210 },
  { key: 'status',   label: 'Status',        w: 150 },
  { key: 'score',    label: 'Score',         w: 110 },
  { key: 'phone',    label: 'Phone',         w: 150 },
  { key: 'email',    label: 'Email',         w: 210 },
  { key: 'campaign', label: 'Campaign',      w: 160 },
  { key: 'account',  label: 'Account',       w: 120 },
  { key: 'ago',      label: 'Last Activity', w: 120 },
  { key: 'lastmsg',  label: 'Last Message',  w: 320 },
];
const TABLE_MIN = TABLE_COLS.reduce((a, c) => a + c.w, 0) + 46;
const PAGE_SIZES = [10, 25, 50];

function TableCell({ w, children, style }) {
  return <div style={{ width: w, flexShrink: 0, paddingRight: 16, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', ...style }}>{children}</div>;
}

// ─── Always-on "Last Message" cell — compact, single-line peek of the
// latest exchange. Sender tag (lead first name vs AI) + truncated text.
function LastMsgCell({ lead }) {
  const m = lead.lastMsg;
  if (!m) return <span style={{ color: 'var(--mute-2)' }}>—</span>;
  const isIn = m.dir === 'in';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
      <span style={{
        fontFamily: 'var(--mono)', fontSize: 7.5, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700,
        color: isIn ? 'var(--good)' : 'var(--wine)',
        background: isIn ? 'var(--good-tint)' : 'var(--wine-tint)',
        borderRadius: 'var(--r-pill)', padding: '2px 7px', flexShrink: 0, maxWidth: 78,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>{isIn ? lead.name.split(/\s+/)[0] : 'AI'}</span>
      <span style={{ fontSize: 12, color: 'var(--ink-soft)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>{m.text}</span>
      <span style={{ fontFamily: 'var(--mono)', fontSize: 8.5, color: 'var(--mute-2)', flexShrink: 0 }}>{m.time}</span>
    </div>
  );
}

// ─── Pagination footer ──────────────────────────────────────────────
function TablePager({ page, pages, pageSize, total, from, to, onPage, onPageSize }) {
  const PageBtn = ({ n, label, disabled, on }) => (
    <button
      onClick={() => !disabled && onPage(n)}
      disabled={disabled}
      className={`la-btn ${on ? 'la-btn--wine' : 'la-btn--soft'}`}
      style={{ minWidth: 30, height: 30, justifyContent: 'center', padding: '0 9px', opacity: disabled ? 0.4 : 1, cursor: disabled ? 'default' : 'pointer' }}>
      {label != null ? label : n + 1}
    </button>
  );
  // Window the page buttons so we never render a huge run.
  const win = [];
  const span = 5;
  let start = Math.max(0, Math.min(page - 2, pages - span));
  let end = Math.min(pages, start + span);
  for (let i = start; i < end; i++) win.push(i);

  return (
    <div style={{
      flexShrink: 0, height: 52, borderTop: '1px solid var(--line)',
      display: 'flex', alignItems: 'center', gap: 14, padding: '0 16px', background: 'var(--bg)',
    }}>
      <span style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.06em', color: 'var(--mute)' }}>
        {total === 0 ? '0 of 0' : `${from}–${to}`} <span style={{ color: 'var(--mute-2)' }}>of {total}</span>
      </span>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--mute-2)' }}>Rows</span>
        <div className="la-seg">
          {PAGE_SIZES.map(s => (
            <button key={s} onClick={() => onPageSize(s)} className={`la-seg-btn${s === pageSize ? ' on' : ''}`} style={{ minWidth: 30 }}>{s}</button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1 }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <PageBtn n={page - 1} label={<IconChevL size={13} />} disabled={page === 0} />
        {start > 0 && <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--mute-2)' }}>…</span>}
        {win.map(n => <PageBtn key={n} n={n} on={n === page} />)}
        {end < pages && <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--mute-2)' }}>…</span>}
        <PageBtn n={page + 1} label={<IconChevR size={13} />} disabled={page >= pages - 1} />
      </div>
    </div>
  );
}

function TableView({ leads, activeId, selected, onSelectLead, onToggle, onToggleAll, allSelected }) {
  const [page, setPage] = React.useState(0);
  const [pageSize, setPageSize] = React.useState(10);

  const total = leads.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  // Keep page in range if data / pageSize changes.
  const safePage = Math.min(page, pages - 1);
  React.useEffect(() => { if (page !== safePage) setPage(safePage); }, [safePage]);

  const from = total === 0 ? 0 : safePage * pageSize + 1;
  const to = Math.min(total, (safePage + 1) * pageSize);
  const pageLeads = leads.slice(safePage * pageSize, safePage * pageSize + pageSize);

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        <div style={{ minWidth: TABLE_MIN }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', height: 44, padding: '0 16px', borderBottom: '1px solid var(--line)', position: 'sticky', top: 0, background: 'var(--bg)', zIndex: 2 }}>
            <div style={{ width: 30, flexShrink: 0 }}><Check on={allSelected} onClick={onToggleAll} /></div>
            {TABLE_COLS.map(c => (
              <TableCell key={c.key} w={c.w}>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--mute-2)' }}>{c.label}</span>
              </TableCell>
            ))}
          </div>
          {/* Rows */}
          {pageLeads.map(l => {
            const active = l.id === activeId;
            return (
              <div key={l.id} style={{
                borderBottom: '1px solid var(--line)',
                background: active ? 'var(--card)' : 'transparent',
                boxShadow: active ? 'inset 3px 0 0 var(--wine)' : 'none',
              }}>
                <div onClick={() => onSelectLead(l.id)} style={{
                  display: 'flex', alignItems: 'center', height: 52, padding: '0 16px', cursor: 'pointer', transition: 'background 120ms',
                }}
                onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'var(--surface)'; }}
                onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}>
                  <div style={{ width: 30, flexShrink: 0 }}><Check on={selected.has(l.id)} onClick={() => onToggle(l.id)} /></div>
                  <TableCell w={210} style={{ overflow: 'visible' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                      <StageAvatar lead={l} size={30} radius={8} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.name}</span>
                      {l.demo && <span style={{ fontFamily: 'var(--mono)', fontSize: 7.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--mute-2)', border: '1px solid var(--line-strong)', borderRadius: 3, padding: '1px 4px', flexShrink: 0 }}>demo</span>}
                    </div>
                  </TableCell>
                  <TableCell w={150} style={{ overflow: 'visible' }}><StatusDot lead={l} /></TableCell>
                  <TableCell w={110}>
                    {l.score > 0 ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 700, color: 'var(--ink)', width: 20 }}>{l.score}</span>
                        <div style={{ flex: 1, height: 5, background: 'var(--bg)', boxShadow: 'var(--sh-inset-crisp)', borderRadius: 'var(--r-pill)', overflow: 'hidden' }}>
                          <div style={{ width: `${l.score}%`, height: '100%', background: l.score >= 55 ? 'var(--good)' : l.score >= 40 ? 'var(--warn)' : 'var(--stage-contacted)', borderRadius: 'var(--r-pill)' }} />
                        </div>
                      </div>
                    ) : <span style={{ color: 'var(--mute-2)' }}>—</span>}
                  </TableCell>
                  <TableCell w={150}><span style={{ fontFamily: 'var(--mono)', fontSize: 11.5, color: 'var(--ink-soft)' }}>{l.phone}</span></TableCell>
                  <TableCell w={210}><span style={{ fontSize: 12, color: 'var(--mute)' }}>{l.email}</span></TableCell>
                  <TableCell w={160}><span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{l.campaign || '—'}</span></TableCell>
                  <TableCell w={120}><span style={{ fontSize: 12, color: 'var(--mute)' }}>{l.account}</span></TableCell>
                  <TableCell w={120}><span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--mute-2)' }}>{l.ago} ago</span></TableCell>
                  <TableCell w={320}><LastMsgCell lead={l} /></TableCell>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <TablePager page={safePage} pages={pages} pageSize={pageSize} total={total} from={from} to={to}
                  onPage={setPage} onPageSize={(s) => { setPageSize(s); setPage(0); }} />
    </div>
  );
}

// ═══ KANBAN view ═══════════════════════════════════════════════════
function KanbanCard({ lead, active, onClick }) {
  return (
    <div onClick={onClick} className="neu-raised-crisp" style={{
      padding: '10px 11px', borderRadius: 'var(--r-surface)', cursor: 'pointer',
      display: 'flex', alignItems: 'center', gap: 9,
      background: 'var(--card)',
      outline: active ? '2px solid var(--wine)' : '2px solid transparent',
      transition: 'outline 120ms',
    }}>
      <StageAvatar lead={lead} size={30} radius={8} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lead.name}</div>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 8.5, color: 'var(--mute-2)', letterSpacing: '0.06em', marginTop: 2 }}>{lead.ago} ago</div>
      </div>
      {lead.score > 0 && <ScoreArc score={lead.score} size={26} sw={2.5} />}
    </div>
  );
}

function KanbanView({ leads, activeId, onSelectLead }) {
  const { pipeline } = window.LEADS_DATA;
  return (
    <div style={{ flex: 1, overflowX: 'auto', overflowY: 'hidden', padding: 16 }}>
      <div style={{ display: 'flex', gap: 14, height: '100%', minWidth: 'min-content' }}>
        {pipeline.map(stage => {
          const items = leads.filter(l => l.stage === stage.key);
          return (
            <div key={stage.key} style={{ width: 256, flexShrink: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 4px 10px', flexShrink: 0 }}>
                <span style={{ width: 9, height: 9, borderRadius: 3, background: stage.color }} />
                <span style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-soft)', fontWeight: 700 }}>{stage.label}</span>
                {stage.star && <span style={{ fontFamily: 'var(--mono)', fontSize: 7.5, letterSpacing: '0.12em', color: stage.color, border: `1px solid ${stage.color}`, borderRadius: 4, padding: '1px 5px' }}>★ NORTH STAR</span>}
                <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--mute-2)', background: 'var(--bg)', boxShadow: 'var(--sh-inset-crisp)', padding: '1px 7px', borderRadius: 'var(--r-pill)', marginLeft: 'auto' }}>{items.length}</span>
              </div>
              <div className="neu-inset" style={{
                flex: 1, minHeight: 0, borderRadius: 'var(--r-card)', padding: 8, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8,
                background: stage.star ? 'var(--warn-tint)' : undefined,
                boxShadow: stage.star ? 'var(--sh-inset-crisp), inset 0 0 0 1.5px rgba(196,138,47,0.35)' : undefined,
              }}>
                {items.length === 0
                  ? <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--mute-2)', minHeight: 60 }}>Empty</div>
                  : items.map(l => <KanbanCard key={l.id} lead={l} active={l.id === activeId} onClick={() => onSelectLead(l.id)} />)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══ LIST RAIL (collapsed) — icon-only rail with hover-card peek ════
function RailHoverCard({ lead, top, left }) {
  const stage = stageOf(lead);
  return (
    <div style={{ position: 'fixed', top: Math.max(8, Math.min(top, (typeof window !== 'undefined' ? window.innerHeight : 900) - 96)), left, zIndex: 60, width: 264, pointerEvents: 'none' }}>
      <div className="neu-raised" style={{ borderRadius: 'var(--r-surface)', background: 'var(--card)', padding: '11px 13px', boxShadow: 'var(--sh-raised-medium)', display: 'flex', gap: 11, alignItems: 'center' }}>
        <StageAvatar lead={lead} size={36} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lead.name}</span>
            {lead.demo && <span style={{ fontFamily: 'var(--mono)', fontSize: 7.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--mute-2)', border: '1px solid var(--line-strong)', borderRadius: 3, padding: '1px 4px', flexShrink: 0 }}>demo</span>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 3 }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: stage.color, flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: 'var(--mute)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{stage.label}{lead.campaign ? ` · ${lead.campaign}` : ''}</span>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 8.5, color: 'var(--mute-2)' }}>{lead.ago}</span>
          {lead.score > 0 && <ScoreArc score={lead.score} size={26} sw={2.5} />}
        </div>
      </div>
    </div>
  );
}

function ListRail({ leads, activeId, onSelectLead }) {
  const week = leads.filter(l => l.grp === 'week');
  const month = leads.filter(l => l.grp === 'month');
  const [hover, setHover] = React.useState(null);
  const show = (lead, e) => { const r = e.currentTarget.getBoundingClientRect(); setHover({ lead, top: r.top - 4, left: r.right + 12 }); };

  const Avatar = (l) => {
    const active = l.id === activeId;
    return (
      <button key={l.id} onClick={() => onSelectLead(l.id)} onMouseEnter={(e) => show(l, e)} onMouseLeave={() => setHover(null)} title={l.name}
        style={{
          position: 'relative', border: 'none', background: active ? 'var(--card)' : 'transparent',
          padding: 3, cursor: 'pointer', borderRadius: 'var(--r-surface)', display: 'flex',
          boxShadow: active ? 'var(--sh-raised-crisp), 0 0 0 2px var(--wine)' : 'none', transition: 'box-shadow 120ms',
        }}>
        <StageAvatar lead={l} size={38} />
      </button>
    );
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '12px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 9 }}>
      {week.map(Avatar)}
      <div style={{ width: 26, height: 1, background: 'var(--line-strong)', margin: '3px 0' }} />
      {month.map(Avatar)}
      {hover && <RailHoverCard lead={hover.lead} top={hover.top} left={hover.left} />}
    </div>
  );
}

// ═══ App orchestrator ══════════════════════════════════════════════
function LeadsApp() {
  const D = window.LEADS_DATA;
  const [view, setView] = React.useState('list');
  const [activeId, setActiveId] = React.useState(D.activeLeadId);
  const [selected, setSelected] = React.useState(() => new Set());
  const [clientView, setClientView] = React.useState(false);
  const [showPeek, setShowPeek] = React.useState(false);

  const [vw, setVw] = React.useState(typeof window !== 'undefined' ? window.innerWidth : 1600);
  React.useEffect(() => {
    const onResize = () => setVw(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const detail = activeId ? D.getDetail(activeId) : null;
  // In table/kanban: clicking the already-active lead closes the panel
  const handleSelectLead = (id) => {
    if (view !== 'list' && id === activeId) setActiveId(null);
    else setActiveId(id);
  };
  const toggle = (id) => setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allSelected = selected.size === D.leads.length && D.leads.length > 0;
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(D.leads.map(l => l.id)));

  const isList = view === 'list';
  // Narrow window → collapse the lead list to an icon rail (hover to peek the
  // full card) so the detail panel keeps the room it needs.
  const railCollapsed = isList && vw < 1240;

  // Collection pane: list = fixed (or thin rail); table/pipeline = flex fill.
  const collFlex = isList ? (railCollapsed ? '0 0 66px' : '0 0 332px') : '1 1 0';
  // Detail pane: fills the rest in list view; in table/pipeline it's a side
  // panel that widens on big monitors so it can adopt the wide multi-column
  // layout instead of the stacked one.
  const detailFlex = isList ? '1 1 0' : '0 0 clamp(380px, 36vw, 840px)';
  // In table/kanban the detail panel only appears after a lead is selected
  const showDetail = isList || activeId !== null;

  return (
    <div className="la-app" style={{ width: '100%', height: '100%', display: 'flex', overflow: 'hidden' }}>
      <Sidebar active="Leads" />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg)' }}>
        <CollectionToolbar
          view={view}
          setView={(v) => {
            setView(v);
            if (v !== 'list') setActiveId(null);
            else setActiveId(prev => prev || D.activeLeadId);
          }}
          total={D.leads.length} selectedCount={selected.size} onClearSel={() => setSelected(new Set())} peekOn={showPeek} onTogglePeek={() => setShowPeek(p => !p)} />
        <div style={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden' }}>
          {/* Collection pane */}
          <div style={{
            display: 'flex', flexDirection: 'column', minWidth: 0,
            flex: collFlex,
            borderRight: showDetail ? '1px solid var(--line)' : 'none',
            overflow: 'hidden',
          }}>
            {view === 'list'   && (railCollapsed
              ? <ListRail leads={D.leads} activeId={activeId} onSelectLead={setActiveId} />
              : <ListView leads={D.leads} activeId={activeId} selected={selected} showPeek={showPeek} onSelectLead={setActiveId} onToggle={toggle} />)}
            {view === 'table'  && <TableView leads={D.leads} activeId={activeId} selected={selected} onSelectLead={handleSelectLead} onToggle={toggle} onToggleAll={toggleAll} allSelected={allSelected} />}
            {view === 'kanban' && <KanbanView leads={D.leads} activeId={activeId} onSelectLead={handleSelectLead} />}
          </div>
          {/* Detail pane — always in list view; only when a lead is selected in table/kanban */}
          {showDetail && (
            <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: detailFlex, minWidth: 0 }}>
              <LeadDetail detail={detail} clientView={clientView} onToggleClient={() => setClientView(v => !v)} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, {
  IconCheckS, Check, StatusDot, CollectionToolbar, GroupHeader,
  ListRow, ListView, ListRail, RailHoverCard, TableView, KanbanView, KanbanCard, LeadsApp,
});
