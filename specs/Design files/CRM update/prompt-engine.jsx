// prompt-engine.jsx — parsing + resolution + markdown for the Prompt Library.
// Pure helpers (no UI). Exposed on window for the panel components.

// ── Tokenize raw prompt source into typed spans ────────────────────
// Recognizes: {variable}, {{#if expr}}, {{/if}}, plain text.
function tokenizePrompt(src) {
  const tokens = [];
  const re = /(\{\{#if\s+[^}]+\}\})|(\{\{\/if\}\})|(\{[a-zA-Z0-9_]+\})/g;
  let last = 0, m;
  while ((m = re.exec(src)) !== null) {
    if (m.index > last) tokens.push({ type: 'text', value: src.slice(last, m.index) });
    if (m[1]) {
      const expr = m[1].slice(5, -2).trim(); // strip {{#if  ...  }}
      tokens.push({ type: 'if', value: m[1], expr });
    } else if (m[2]) {
      tokens.push({ type: 'endif', value: m[2] });
    } else if (m[3]) {
      tokens.push({ type: 'var', value: m[3], name: m[3].slice(1, -1) });
    }
    last = re.lastIndex;
  }
  if (last < src.length) tokens.push({ type: 'text', value: src.slice(last) });
  return tokens;
}

// ── Evaluate a simple `name == "value"` (or bare truthy) condition ──
function evalCond(expr, vars) {
  const eq = expr.match(/^([a-zA-Z0-9_]+)\s*==\s*"([^"]*)"$/);
  if (eq) return String(vars[eq[1]] ?? '') === eq[2];
  const neq = expr.match(/^([a-zA-Z0-9_]+)\s*!=\s*"([^"]*)"$/);
  if (neq) return String(vars[neq[1]] ?? '') !== neq[2];
  return !!vars[expr.trim()];
}

// ── Resolve raw source → final string (conditionals applied, vars filled) ──
function resolvePrompt(src, vars) {
  const tokens = tokenizePrompt(src);
  let out = '';
  const stack = [true]; // visibility stack
  const visible = () => stack.every(Boolean);
  for (const t of tokens) {
    if (t.type === 'if') stack.push(evalCond(t.expr, vars));
    else if (t.type === 'endif') { if (stack.length > 1) stack.pop(); }
    else if (!visible()) continue;
    else if (t.type === 'var') out += (vars[t.name] != null ? vars[t.name] : t.value);
    else out += t.value;
  }
  return out.replace(/\n{3,}/g, '\n\n');
}

// ── Which variables / conditionals does this prompt use? ───────────
function promptVarsUsed(src) {
  const set = new Set();
  tokenizePrompt(src).forEach(t => { if (t.type === 'var') set.add(t.name); });
  return [...set];
}

// ── Minimal markdown → React (headings, lists, bold, inline code) ──
// `marks` optionally wraps resolved variable values in a highlight span.
function renderMarkdown(md, opts) {
  opts = opts || {};
  const lines = md.split('\n');
  const blocks = [];
  let list = null;
  const flushList = () => { if (list) { blocks.push({ type: 'ul', items: list }); list = null; } };

  lines.forEach((raw) => {
    const line = raw.replace(/\s+$/, '');
    if (!line.trim()) { flushList(); return; }
    let m;
    if ((m = line.match(/^#\s+(.*)/)))      { flushList(); blocks.push({ type: 'h1', text: m[1] }); }
    else if ((m = line.match(/^##\s+(.*)/))) { flushList(); blocks.push({ type: 'h2', text: m[1] }); }
    else if ((m = line.match(/^###\s+(.*)/))){ flushList(); blocks.push({ type: 'h3', text: m[1] }); }
    else if ((m = line.match(/^[-*]\s+(.*)/))) { (list = list || []).push(m[1]); }
    else { flushList(); blocks.push({ type: 'p', text: line }); }
  });
  flushList();

  const inline = (text, key) => {
    // bold **x** then plain — keep it light.
    const parts = [];
    const re = /\*\*([^*]+)\*\*/g;
    let last = 0, mm, i = 0;
    while ((mm = re.exec(text)) !== null) {
      if (mm.index > last) parts.push(text.slice(last, mm.index));
      parts.push(<strong key={`${key}-b${i++}`} style={{ fontWeight: 700, color: 'var(--ink)' }}>{mm[1]}</strong>);
      last = re.lastIndex;
    }
    if (last < text.length) parts.push(text.slice(last));
    return parts;
  };

  return blocks.map((b, i) => {
    switch (b.type) {
      case 'h1': return <h1 key={i} style={mdStyle.h1}>{b.text}</h1>;
      case 'h2': return <h2 key={i} style={mdStyle.h2}>{b.text}</h2>;
      case 'h3': return <h3 key={i} style={mdStyle.h3}>{b.text}</h3>;
      case 'ul': return (
        <ul key={i} style={mdStyle.ul}>
          {b.items.map((it, j) => <li key={j} style={mdStyle.li}>{inline(it, `${i}-${j}`)}</li>)}
        </ul>
      );
      default: return <p key={i} style={mdStyle.p}>{inline(b.text, i)}</p>;
    }
  });
}

const mdStyle = {
  h1: { fontFamily: 'var(--serif)', fontSize: 38, lineHeight: 1.1, color: 'var(--ink)', letterSpacing: '-0.015em', margin: '0 0 18px' },
  h2: { fontFamily: 'var(--serif)', fontSize: 26, lineHeight: 1.15, color: 'var(--ink)', letterSpacing: '-0.01em', margin: '28px 0 12px' },
  h3: { fontFamily: 'var(--sans)', fontSize: 15, fontWeight: 700, color: 'var(--ink-soft)', margin: '20px 0 8px', textTransform: 'none' },
  p:  { fontSize: 14.5, lineHeight: 1.65, color: 'var(--ink-soft)', margin: '0 0 12px', textWrap: 'pretty' },
  ul: { margin: '0 0 14px', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 },
  li: { fontSize: 14.5, lineHeight: 1.6, color: 'var(--ink-soft)', paddingLeft: 20, position: 'relative', textWrap: 'pretty' },
};

// ── Split a prompt into ## sections (for the collapsible card view) ──
// Returns { title, intro, sections: [{ heading, body, rules }] }.
// `title` is the leading `# H1` line, `intro` is any text before the first ##.
function splitSections(src) {
  const lines = src.split('\n');
  let title = '', i = 0;
  // capture leading H1
  while (i < lines.length && !lines[i].trim()) i++;
  if (i < lines.length && /^#\s+/.test(lines[i])) { title = lines[i].replace(/^#\s+/, '').trim(); i++; }
  const rest = lines.slice(i);
  const sections = [];
  let intro = [];
  let cur = null;
  rest.forEach(line => {
    const m = line.match(/^##\s+(.*)/);
    if (m) {
      if (cur) sections.push(cur);
      cur = { heading: m[1].trim(), bodyLines: [] };
    } else if (cur) {
      cur.bodyLines.push(line);
    } else {
      intro.push(line);
    }
  });
  if (cur) sections.push(cur);
  sections.forEach(s => {
    s.body = s.bodyLines.join('\n').replace(/^\n+|\n+$/g, '');
    s.rules = s.bodyLines.filter(l => /^\s*[-*]\s+/.test(l)).length;
    delete s.bodyLines;
  });
  return { title, intro: intro.join('\n').trim(), sections };
}

// ── Reassemble sections back into a single prompt string ───────────
function joinSections(title, intro, sections) {
  let out = '';
  if (title) out += `# ${title}\n\n`;
  if (intro) out += `${intro}\n\n`;
  sections.forEach(s => { out += `## ${s.heading}\n\n${s.body}\n\n`; });
  return out.replace(/\n{3,}/g, '\n\n').replace(/\n+$/,'') + '\n';
}

// ── Line diff (LCS) between two texts → [{type:'same'|'add'|'del', text}] ──
// `from` is the older version, `to` is the newer. add = in new only, del = in old only.
function lineDiff(from, to) {
  const a = from.split('\n'), b = to.split('\n');
  const n = a.length, m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { out.push({ type: 'same', text: a[i] }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { out.push({ type: 'del', text: a[i] }); i++; }
    else { out.push({ type: 'add', text: b[j] }); j++; }
  }
  while (i < n) { out.push({ type: 'del', text: a[i++] }); }
  while (j < m) { out.push({ type: 'add', text: b[j++] }); }
  return out;
}

Object.assign(window, { tokenizePrompt, evalCond, resolvePrompt, promptVarsUsed, renderMarkdown, mdStyle, splitSections, joinSections, lineDiff });
