// What each placeholder of a voice prompt became in the engine's render. The
// engine has no list of values to hand back: only a few are marked in its text,
// so the rest are read by walking the template's fixed text through the render
// (the same walk as Call settings' resolvedSegments), which cannot drift from
// what she hears.

const PLACEHOLDER = /(\{\w+\})/;
const FILLED = /([a-z_]+)([\s\S]*?)/g;

// The placeholder -> the engine's mark name (build_live_session_config m(), _MARK_NAMES).
export const MARK_OF: Record<string, string> = {
  agent: "agent_name", agent_name: "agent_name", company: "company_name", company_name: "company_name",
  business_description: "business", tone: "tone", pronunciation: "pronunciation", address: "address",
  client_rules: "client_rules", service_name: "service_name", city: "city",
};

// Sentences the engine adds after or around the last placeholder, so they are not part of its value.
const TODAY = /\n\n(?:Today is |Vandaag is het |Hoje é )/;
// _KNOWLEDGE_LABELS: the detail rules land just above this heading (detail_rules.with_detail_rules).
const KNOWLEDGE_HEADING = /\n\n(?:What you know about the business|Je bedrijfskennis|O que você sabe sobre a empresa|O que sabe sobre a empresa)[^\n]*:\n/;

// _backend_kb, then client_setup_slots._HEADING, then the call's own lines.
const BACKEND_DETAILS = /\n\n(?:## Knowledge base\n|## This client's setup\n|## Instellingen van deze klant\n|## Configuração deste cliente\n|The caller is ringing from |Today is )/;

/** Values the engine marked in its text, by mark name. The first one of each. */
export function markedValues(marked: string | null | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of (marked ?? "").matchAll(FILLED)) if (!(m[1]! in out)) out[m[1]!] = m[2]!;
  return out;
}

function findLiteral(text: string, literal: string, from: number): { at: number; end: number } | null {
  const exact = text.indexOf(literal, from);
  if (exact !== -1) return { at: exact, end: exact + literal.length };
  // Only the row's outer whitespace may differ: the engine strips it.
  const trimmed = literal.trim();
  const at = trimmed ? text.indexOf(trimmed, from) : -1;
  return at === -1 ? null : { at, end: at + trimmed.length };
}

/**
 * placeholder -> its rendered value. Empty for one that rendered to nothing;
 * absent where the render left the template (a client's own greeting replaces
 * the row altogether).
 */
export function placeholderValues(template: string, rendered: string, marked?: string | null): Record<string, string> {
  const marks = markedValues(marked);
  const out: Record<string, string> = {};

  const assign = (names: string[], gap: string) => {
    // The backend frame's two parts touch: the details start at the first section the engine adds.
    if (names.includes("task_instructions") && names.includes("call_details")) {
      const at = gap.search(BACKEND_DETAILS);
      out.task_instructions = (at === -1 ? gap : gap.slice(0, at)).trim();
      out.call_details = at === -1 ? "" : gap.slice(at).trim();
      return;
    }
    let rest = gap;
    const free: string[] = [];
    for (const name of names) {
      const value = marks[MARK_OF[name] ?? ""];
      if (value === undefined) { free.push(name); continue; }
      out[name] = value.trim();
      rest = rest.replace(value, "");
    }
    // Side by side with no text between them, the one left over takes the gap.
    free.forEach((name, i) => { out[name] = i === 0 ? rest.trim() : ""; });
  };

  const parts = template.split(PLACEHOLDER);
  let pos = 0;
  let pending: string[] = [];
  // After text the engine dropped, the next gap is not one placeholder's value.
  let lost = false;
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]!;
    if (i % 2 === 1) { pending.push(part.slice(1, -1)); continue; }
    if (!part) continue;
    const found = findLiteral(rendered, part, pos);
    if (!found) { pending = []; lost = true; continue; }
    if (pending.length && !lost) assign(pending, rendered.slice(pos, found.at));
    pending = [];
    lost = false;
    pos = found.end;
  }
  if (pending.length && !lost) {
    const tail = rendered.slice(pos);
    const today = tail.search(TODAY);
    assign(pending, today === -1 ? tail : tail.slice(0, today));
  }
  // A marked value doesn't need the walk: it may sit in a line the engine rewrote.
  for (const part of parts) {
    const name = part.startsWith("{") ? part.slice(1, -1) : "";
    const value = marks[MARK_OF[name] ?? ""];
    if (value !== undefined && !(name in out)) out[name] = value.trim();
  }
  if (out.knowledge) {
    const at = out.knowledge.search(KNOWLEDGE_HEADING);
    // Trimmed, so the heading sits at the very start when no rules came before it.
    out.knowledge = (at === -1 ? out.knowledge : out.knowledge.slice(at)).trim();
  }
  return out;
}
