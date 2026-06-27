// prompt-panels.jsx — Prompt Library panels: list (collapsible), syntax editor, preview.
// Depends on: components.jsx, prompt-engine.jsx, prompt-data.js

// ── Icons ──────────────────────────────────────────────────────────
const PIconSearch = (p) => <Icon {...p} d={<><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></>} />;
const PIconSort   = (p) => <Icon {...p} d={<path d="M7 4v16M7 4 4 7m3-3 3 3M17 20V4m0 16-3-3m3 3 3-3"/>} />;
const PIconFilter = (p) => <Icon {...p} d={<path d="M3 5h18l-7 8v6l-4-2v-4z"/>} />;
const PIconLayers = (p) => <Icon {...p} d={<path d="m12 2 9 5-9 5-9-5 9-5zM3 12l9 5 9-5M3 17l9 5 9-5"/>} />;
const PIconPlus   = (p) => <Icon {...p} d={<path d="M12 5v14M5 12h14"/>} />;
const PIconBot    = (p) => <Icon {...p} d={<><rect x="4" y="8" width="16" height="11" rx="3"/><path d="M12 8V4M9 4h6"/><circle cx="9" cy="13" r="1"/><circle cx="15" cy="13" r="1"/></>} />;
const PIconEye    = (p) => <Icon {...p} d={<><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></>} />;
const PIconEyeOff = (p) => <Icon {...p} d={<path d="M9.9 5A10.9 10.9 0 0 1 12 5c6.5 0 10 7 10 7a13.2 13.2 0 0 1-2.2 2.9M6.1 6.1A13.3 13.3 0 0 0 2 12s3.5 7 10 7a10.9 10.9 0 0 0 4-.7M3 3l18 18"/>} />;
const PIconSave   = (p) => <Icon {...p} d={<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2zM7 3v6h8M7 21v-6h10v6"/>} />;
const PIconTrash  = (p) => <Icon {...p} d={<path d="M3 6h18M8 6V4h8v2m-9 0v14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V6"/>} />;
const PIconPause  = (p) => <Icon {...p} d={<><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></>} />;
const PIconCopy   = (p) => <Icon {...p} d={<><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></>} />;
const PIconChevD  = (p) => <Icon {...p} d={<path d="m6 9 6 6 6-6"/>} />;
const PIconChevL  = (p) => <Icon {...p} d={<path d="m15 18-6-6 6-6"/>} />;
const PIconSidebar = (p) => <Icon {...p} d={<><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/></>} />;

// ════════════════════════════════════════════════════════════════════
// LIST (left) — grouped, collapsible to an icon rail
// ════════════════════════════════════════════════════════════════════
function PromptListItem({ p, active, collapsed, onClick }) {
  if (collapsed) {
    return (
      <button onClick={onClick} title={p.name} style={{
        position: 'relative', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 'var(--r-surface)', display: 'flex',
        background: active ? 'var(--card)' : 'transparent',
        boxShadow: active ? 'var(--sh-raised-crisp), 0 0 0 2px var(--wine)' : 'none', transition: 'box-shadow 120ms',
      }}>
        <span style={{ width: 38, height: 38, borderRadius: 'var(--r-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: active ? 'var(--wine-tint)' : 'var(--bg)', boxShadow: active ? 'none' : 'var(--sh-inset-crisp)', color: active ? 'var(--wine)' : 'var(--mute)' }}>
          <PIconBot size={19} />
        </span>
      </button>
    );
  }
  return (
    <div onClick={onClick} style={{
      position: 'relative', cursor: 'pointer', borderRadius: 'var(--r-surface)', padding: '11px 13px', display: 'flex', gap: 12, alignItems: 'center',
      background: active ? 'var(--card)' : 'transparent',
      boxShadow: active ? 'var(--sh-raised-crisp)' : 'none', transition: 'all 130ms',
    }}
    onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'var(--wine-tint)'; }}
    onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}>
      {active && <div style={{ position: 'absolute', left: 0, top: 12, bottom: 12, width: 3, background: 'var(--wine)', borderRadius: '0 3px 3px 0' }} />}
      <span style={{ width: 38, height: 38, flexShrink: 0, borderRadius: 'var(--r-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: active ? 'var(--wine-tint)' : 'var(--bg)', boxShadow: active ? 'none' : 'var(--sh-inset-crisp)', color: active ? 'var(--wine)' : 'var(--mute)' }}>
        <PIconBot size={19} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 3 }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 9.5, color: 'var(--mute-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.model}</span>
        </div>
      </div>
      {active && p.active && <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--good)', flexShrink: 0 }} title="Active prompt" />}
      <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--mute-2)', flexShrink: 0 }}>{p.updated}</span>
    </div>
  );
}

function PromptList({ prompts, activeId, collapsed, onSelect, tab }) {
  const W = collapsed ? 70 : 300;
  const D = window.LA_PROMPTS;
  const shownGroups = tab === 'system' ? D.systemGroups : D.campaignGroups;
  return (
    <div style={{ width: W, flexShrink: 0, borderRight: '1px solid var(--line)', display: 'flex', flexDirection: 'column', minHeight: 0, background: 'var(--bg)', transition: 'width 160ms' }}>
      {/* groups (search / actions now live in the page header) */}
      <div style={{ flex: 1, overflowY: 'auto', padding: collapsed ? '12px 0 16px' : '8px 10px 16px', display: 'flex', flexDirection: 'column', alignItems: collapsed ? 'center' : 'stretch', gap: collapsed ? 6 : 0 }}>
        {collapsed
          ? prompts.filter(p => shownGroups.includes(p.group)).map(p => <PromptListItem key={p.id} p={p} active={p.id === activeId} collapsed onClick={() => onSelect(p.id)} />)
          : shownGroups.map((g) => {
            const items = prompts.filter(p => p.group === g);
            if (!items.length) return null;
            return (
              <React.Fragment key={g}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '14px 6px 7px' }}>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--mute-2)', fontWeight: 700 }}>{g}</span>
                  <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--mute-2)' }}>{items.length}</span>
                </div>
                {items.map(p => <PromptListItem key={p.id} p={p} active={p.id === activeId} collapsed={false} onClick={() => onSelect(p.id)} />)}
              </React.Fragment>
            );
          })}
      </div>
    </div>
  );
}
const railBtn = { width: 36, height: 36, flexShrink: 0, borderRadius: 'var(--r-button)', border: 'none', cursor: 'pointer', background: 'var(--surface)', boxShadow: 'var(--sh-raised-crisp)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--mute)' };

// ════════════════════════════════════════════════════════════════════
// EDITOR (center) — textarea + synced syntax-highlight mirror
// ════════════════════════════════════════════════════════════════════
const EDITOR_FONT = { fontFamily: 'var(--mono)', fontSize: 14, lineHeight: 1.7, letterSpacing: 0, tabSize: 2 };

function HighlightLayer({ src, padding = 24 }) {
  const tokens = tokenizePrompt(src);
  let depth = 0;
  return (
    <div aria-hidden style={{
      ...EDITOR_FONT, position: 'absolute', inset: 0, padding, margin: 0,
      whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflowWrap: 'break-word',
      color: 'var(--ink-soft)', pointerEvents: 'none',
    }}>
      {tokens.map((t, i) => {
        if (t.type === 'var') return <span key={i} style={hl.var}>{t.value}</span>;
        if (t.type === 'if')  { depth++; return <span key={i} style={hl.cond}>{t.value}</span>; }
        if (t.type === 'endif') { depth = Math.max(0, depth - 1); return <span key={i} style={hl.cond}>{t.value}</span>; }
        // heading lines get a touch of weight
        return <span key={i}>{t.value}</span>;
      })}
      {'\n'}
    </div>
  );
}
const hl = {
  var:  { color: 'var(--wine)', background: 'var(--wine-tint)', borderRadius: 4, boxShadow: '0 0 0 1px var(--wine-glow)' },
  cond: { color: '#3A6B8A', background: 'rgba(58,107,138,0.10)', borderRadius: 4, boxShadow: '0 0 0 1px rgba(58,107,138,0.22)' },
};

// Reusable code area: textarea + synced highlight mirror.
function CodeArea({ value, onChange, padding = 24, minHeight }) {
  const taRef = React.useRef(null);
  const mirRef = React.useRef(null);
  const sync = () => { if (mirRef.current && taRef.current) { mirRef.current.scrollTop = taRef.current.scrollTop; mirRef.current.scrollLeft = taRef.current.scrollLeft; } };
  return (
    <div style={{ flex: minHeight ? undefined : 1, minHeight: minHeight || 0, position: 'relative', height: minHeight || '100%' }}>
      <div ref={mirRef} style={{ position: 'absolute', inset: 0, overflow: 'auto' }}>
        <HighlightLayer src={value} padding={padding} />
      </div>
      <textarea
        ref={taRef} value={value} spellCheck={false}
        onChange={(e) => onChange(e.target.value)} onScroll={sync}
        style={{
          ...EDITOR_FONT, position: 'absolute', inset: 0, width: '100%', height: '100%',
          padding, margin: 0, border: 'none', outline: 'none', resize: 'none',
          background: 'transparent', color: 'transparent', caretColor: 'var(--wine)',
          whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflowWrap: 'break-word', overflow: 'auto',
        }}
      />
    </div>
  );
}

// ── Structured section cards (collapsible) ─────────────────────────
function SectionCard({ section, idx, open, onToggle, onChangeBody }) {
  return (
    <div style={{ background: 'var(--card)', borderRadius: 'var(--r-surface)', boxShadow: 'var(--sh-raised-crisp)', overflow: 'hidden' }}>
      <button onClick={onToggle} style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', border: 'none', cursor: 'pointer',
        background: 'transparent', textAlign: 'left',
      }}>
        <span style={{ color: 'var(--mute-2)', display: 'flex', transform: open ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 150ms' }}><PIconChevD size={15} /></span>
        <span style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--ink)', flex: 1 }}>{section.heading}</span>
        {section.rules > 0 && <span style={{ fontFamily: 'var(--mono)', fontSize: 9.5, color: 'var(--mute)', background: 'var(--bg)', boxShadow: 'var(--sh-inset-crisp)', borderRadius: 'var(--r-pill)', padding: '3px 10px' }}>{section.rules} {section.rules === 1 ? 'rule' : 'rules'}</span>}
      </button>
      {open && (
        <div style={{ borderTop: '1px solid var(--line)', background: 'var(--paper)' }}>
          <CodeArea value={section.body} onChange={onChangeBody} padding={16} minHeight={Math.max(90, section.body.split('\n').length * 24 + 32)} />
        </div>
      )}
    </div>
  );
}

function StructuredEditor({ value, onChange }) {
  const parsed = React.useMemo(() => splitSections(value), [value]);
  const [open, setOpen] = React.useState(() => parsed.sections.map((_, i) => i === 0));
  // keep open-state length in sync if sections count changes
  React.useEffect(() => {
    setOpen(prev => parsed.sections.map((_, i) => prev[i] != null ? prev[i] : false));
  }, [parsed.sections.length]);

  const setBody = (i, body) => {
    const next = parsed.sections.map((s, j) => j === i ? { ...s, body } : s);
    onChange(joinSections(parsed.title, parsed.intro, next));
  };
  const allOpen = open.every(Boolean);

  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '16px 20px 24px', background: 'var(--bg)' }}>
      {/* title + intro block */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--mute-2)', fontWeight: 700 }}>Prompt Structure</span>
          <button onClick={() => setOpen(parsed.sections.map(() => !allOpen))} style={{ border: 'none', cursor: 'pointer', background: 'var(--surface)', boxShadow: 'var(--sh-raised-crisp)', borderRadius: 'var(--r-button)', padding: '6px 12px', fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-soft)' }}>{allOpen ? 'Collapse all' : 'Expand all'}</button>
        </div>
        {(parsed.title || parsed.intro) && (
          <div style={{ background: 'var(--card)', borderRadius: 'var(--r-surface)', boxShadow: 'var(--sh-raised-crisp)', padding: '13px 16px', borderLeft: '3px solid var(--wine)' }}>
            {parsed.title && <div style={{ fontFamily: 'var(--serif)', fontSize: 22, color: 'var(--ink)', lineHeight: 1.1 }}>{parsed.title}</div>}
            {parsed.intro && <div style={{ fontFamily: 'var(--mono)', fontSize: 11.5, color: 'var(--mute)', marginTop: 6, whiteSpace: 'pre-wrap' }}>{parsed.intro}</div>}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {parsed.sections.map((s, i) => (
          <SectionCard key={i} section={s} idx={i} open={!!open[i]} onToggle={() => setOpen(o => o.map((v, j) => j === i ? !v : v))} onChangeBody={(b) => setBody(i, b)} />
        ))}
      </div>
    </div>
  );
}

function PromptEditor({ value, onChange, mode, setMode }) {
  const used = promptVarsUsed(value);
  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      {/* sub-header with mode toggle */}
      <div style={{ flexShrink: 0, padding: '12px 20px 12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--line)' }}>
        <div className="la-seg">
          {[['raw', 'Raw'], ['structured', 'Sections']].map(([k, label]) => {
            const on = k === mode;
            return (
              <button key={k} onClick={() => setMode(k)} className={`la-seg-btn${on ? ' on' : ''}`}>{label}</button>
            );
          })}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--mute-2)' }}>~{Math.round(value.length / 3.6)} tokens</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 'var(--r-pill)', background: 'var(--bg)', boxShadow: 'var(--sh-inset-crisp)', fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--mute)' }}>{used.length} vars</span>
        </div>
      </div>
      {/* body */}
      {mode === 'structured'
        ? <StructuredEditor value={value} onChange={onChange} />
        : (
          <div style={{ flex: 1, minHeight: 0, position: 'relative', background: 'var(--paper)' }}>
            <CodeArea value={value} onChange={onChange} padding={24} />
          </div>
        )}
      {/* variable legend strip */}
      <div style={{ flexShrink: 0, borderTop: '1px solid var(--line)', padding: '10px 24px', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', background: 'var(--bg)' }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 8.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--mute-2)', marginRight: 2 }}>Variables</span>
        {used.map(v => (
          <span key={v} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 9px', borderRadius: 'var(--r-pill)', background: 'var(--wine-tint)', boxShadow: '0 0 0 1px var(--wine-glow)', fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--wine)' }}>
            {`{${v}}`}
          </span>
        ))}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// PREVIEW (right) — resolved markdown with highlighted variable values
// ════════════════════════════════════════════════════════════════════
function PromptPreview({ src, vars, name }) {
  // Resolve, but wrap filled variable values in a sentinel so we can highlight
  // them after markdown rendering.
  const SENT = '\u0000';
  const markedVars = {};
  Object.keys(vars).forEach(k => { markedVars[k] = `${SENT}${vars[k]}${SENT}`; });
  const resolved = resolvePrompt(src, markedVars);

  // Custom inline renderer that highlights sentinel-wrapped spans.
  const segments = resolved.split(SENT);
  // Rebuild markdown without sentinels for block parsing, then re-mark.
  const clean = resolved.split(SENT).join('');

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <div style={{ flexShrink: 0, padding: '14px 24px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--ink-soft)', fontWeight: 700 }}>Preview</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--good)' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--good)' }} />Resolved
        </span>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '26px 28px 40px', background: 'var(--paper)' }}>
        <MarkdownResolved clean={clean} vars={vars} />
      </div>
    </div>
  );
}

// Renders markdown and highlights any substring equal to a variable value.
function MarkdownResolved({ clean, vars }) {
  const values = Object.values(vars).filter(v => typeof v === 'string' && v.length > 1)
    .sort((a, b) => b.length - a.length);
  // Build a highlight-aware inline by splitting text on known values.
  const highlight = (text, key) => {
    if (!values.length) return text;
    const esc = values.map(v => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const re = new RegExp(`(${esc.join('|')})`, 'g');
    const parts = String(text).split(re);
    return parts.map((part, i) => values.includes(part)
      ? <mark key={`${key}-${i}`} style={{ background: 'var(--warn-tint)', color: 'var(--ink)', borderRadius: 4, padding: '0 3px', boxShadow: '0 0 0 1px rgba(218,148,38,0.3)' }}>{part}</mark>
      : part);
  };
  return <div>{renderMarkdownHL(clean, highlight)}</div>;
}

// Variant of renderMarkdown that runs each text run through `highlight`.
function renderMarkdownHL(md, highlight) {
  const lines = md.split('\n');
  const blocks = []; let list = null;
  const flush = () => { if (list) { blocks.push({ type: 'ul', items: list }); list = null; } };
  lines.forEach(raw => {
    const line = raw.replace(/\s+$/, ''); let m;
    if (!line.trim()) { flush(); return; }
    if ((m = line.match(/^#\s+(.*)/)))       { flush(); blocks.push({ type: 'h1', text: m[1] }); }
    else if ((m = line.match(/^##\s+(.*)/))) { flush(); blocks.push({ type: 'h2', text: m[1] }); }
    else if ((m = line.match(/^###\s+(.*)/))){ flush(); blocks.push({ type: 'h3', text: m[1] }); }
    else if ((m = line.match(/^[-*]\s+(.*)/))) { (list = list || []).push(m[1]); }
    else { flush(); blocks.push({ type: 'p', text: line }); }
  });
  flush();
  return blocks.map((b, i) => {
    if (b.type === 'h1') return <h1 key={i} style={mdStyle.h1}>{highlight(b.text, i)}</h1>;
    if (b.type === 'h2') return <h2 key={i} style={mdStyle.h2}>{highlight(b.text, i)}</h2>;
    if (b.type === 'h3') return <h3 key={i} style={mdStyle.h3}>{highlight(b.text, i)}</h3>;
    if (b.type === 'ul') return (
      <ul key={i} style={mdStyle.ul}>
        {b.items.map((it, j) => (
          <li key={j} style={mdStyle.li}>
            <span style={{ position: 'absolute', left: 4, color: 'var(--wine)' }}>·</span>
            {highlight(it, `${i}-${j}`)}
          </li>
        ))}
      </ul>
    );
    return <p key={i} style={mdStyle.p}>{highlight(b.text, i)}</p>;
  });
}

// ════════════════════════════════════════════════════════════════════
// HISTORY (right) — version list + diff against current + restore
// ════════════════════════════════════════════════════════════════════
function HistoryPanel({ prompt, onRestore }) {
  const history = prompt.history || [];
  const current = history[0];
  const [selVer, setSelVer] = React.useState(history[1] ? history[1].ver : history[0].ver);
  const sel = history.find(h => h.ver === selVer) || current;
  const isCurrent = sel.ver === current.ver;
  const diff = lineDiff(sel.content, current.content); // older → current
  const adds = diff.filter(d => d.type === 'add').length;
  const dels = diff.filter(d => d.type === 'del').length;

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <div style={{ flexShrink: 0, padding: '14px 20px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--ink-soft)', fontWeight: 700 }}>Version History</span>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 9.5, color: 'var(--mute-2)' }}>{history.length} versions</span>
      </div>

      {/* version timeline */}
      <div style={{ flexShrink: 0, maxHeight: 188, overflowY: 'auto', padding: '10px 14px', borderBottom: '1px solid var(--line)', background: 'var(--bg)', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {history.map((h, i) => {
          const on = h.ver === selVer;
          const cur = i === 0;
          return (
            <button key={h.ver} onClick={() => setSelVer(h.ver)} style={{
              display: 'flex', alignItems: 'center', gap: 11, padding: '9px 11px', borderRadius: 'var(--r-surface)', border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%',
              background: on ? 'var(--card)' : 'transparent', boxShadow: on ? 'var(--sh-raised-crisp)' : 'none', transition: 'all 120ms',
            }}>
              <span style={{ width: 30, height: 30, flexShrink: 0, borderRadius: '50%', background: cur ? 'var(--wine)' : 'var(--bg-2)', color: cur ? 'var(--paper)' : 'var(--mute)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--mono)', fontSize: 9.5, fontWeight: 700 }}>{h.ini}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 700, color: 'var(--ink)' }}>{h.ver}</span>
                  {cur && <span style={{ fontFamily: 'var(--mono)', fontSize: 7.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--good)', background: 'var(--good-tint)', borderRadius: 4, padding: '1px 6px', fontWeight: 700 }}>Current</span>}
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--mute-2)', marginLeft: 'auto' }}>{h.date}</span>
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--mute)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.author} · {h.note}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* diff header */}
      <div style={{ flexShrink: 0, padding: '11px 20px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid var(--line)', background: 'var(--paper)' }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 9.5, color: 'var(--ink-soft)' }}>{isCurrent ? 'Current version' : <>Diff <span style={{ color: 'var(--mute-2)' }}>{sel.ver} → {current.ver}</span></>}</span>
        {!isCurrent && (
          <div style={{ display: 'flex', gap: 8 }}>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--good)', fontWeight: 700 }}>+{adds}</span>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--stage-lost)', fontWeight: 700 }}>−{dels}</span>
          </div>
        )}
        <div style={{ flex: 1 }} />
        {!isCurrent && (
          <button onClick={() => onRestore && onRestore(sel)} className="la-btn la-btn--wine"><PIconRestore size={13} />Restore {sel.ver}</button>
        )}
      </div>

      {/* diff body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 0', background: 'var(--paper)' }}>
        {isCurrent
          ? <div style={{ ...EDITOR_FONT, padding: '0 20px', whiteSpace: 'pre-wrap', color: 'var(--ink-soft)' }}>{sel.content}</div>
          : diff.map((d, i) => (
            <div key={i} style={{
              ...EDITOR_FONT, padding: '1px 20px 1px 34px', position: 'relative', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              background: d.type === 'add' ? 'rgba(47,148,97,0.10)' : d.type === 'del' ? 'rgba(162,75,63,0.10)' : 'transparent',
              color: d.type === 'same' ? 'var(--mute)' : 'var(--ink-soft)',
            }}>
              <span style={{ position: 'absolute', left: 14, color: d.type === 'add' ? 'var(--good)' : d.type === 'del' ? 'var(--stage-lost)' : 'var(--mute-2)', fontWeight: 700 }}>{d.type === 'add' ? '+' : d.type === 'del' ? '−' : ''}</span>
              {d.text || '\u00a0'}
            </div>
          ))}
      </div>
    </div>
  );
}

Object.assign(window, {
  PIconSearch, PIconSort, PIconFilter, PIconLayers, PIconPlus, PIconBot, PIconEye, PIconEyeOff, PIconSave, PIconTrash, PIconPause, PIconCopy, PIconChevD, PIconChevL, PIconSidebar,
  PromptListItem, PromptList, PromptEditor, HighlightLayer, CodeArea, SectionCard, StructuredEditor, PromptPreview, MarkdownResolved, renderMarkdownHL,
});
