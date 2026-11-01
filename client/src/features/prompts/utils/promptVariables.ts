// What a prompt's text actually uses: its {variables} and the
// {{#if var == "x"}} / {{#if var != "x"}} conditions, read from the text
// itself (never a hardcoded list), so the Variables panel and the Preview
// conditions show only what this prompt needs.

/** A `{{#if}}` condition variable and the values the text compares it with. */
export interface PromptCondition {
  name: string;
  /** Values found in the text, in order of first appearance. */
  values: string[];
}

export interface PromptVariableUse {
  /** Every `{var}` and condition variable, in order of first appearance. */
  names: string[];
  /** The subset used in `{{#if}}` conditions, with their compared values. */
  conditions: PromptCondition[];
}

const VAR_RE = /\{(\w+)\}/g;
const COND_RE = /\{\{#if\s+(\w+)\s*(?:==|!=)\s*"([^"]*)"\s*\}\}/g;

/** Reads the variables and conditions used by one or more texts (prompt + system message). */
export function detectPromptVariables(...texts: (string | null | undefined)[]): PromptVariableUse {
  const order: string[] = [];
  const seen = new Set<string>();
  const condValues = new Map<string, string[]>();
  const note = (name: string) => {
    const key = name.toLowerCase();
    if (!seen.has(key)) { seen.add(key); order.push(key); }
    return key;
  };

  for (const text of texts) {
    if (!text) continue;
    // Conditions and plain variables share one ordering by position in the text.
    const hits: { index: number; name: string; value?: string }[] = [];
    for (const m of text.matchAll(COND_RE)) hits.push({ index: m.index ?? 0, name: m[1]!, value: m[2]! });
    for (const m of text.matchAll(VAR_RE)) {
      // `{{#if ...}}` never matches (\w must follow "{"), but `{{else}}` holds "{else}".
      if (m[1] === "else") continue;
      hits.push({ index: m.index ?? 0, name: m[1]! });
    }
    hits.sort((a, b) => a.index - b.index);
    for (const h of hits) {
      const key = note(h.name);
      if (h.value === undefined) continue;
      const list = condValues.get(key) ?? [];
      if (!list.includes(h.value)) list.push(h.value);
      condValues.set(key, list);
    }
  }

  return {
    names: order,
    conditions: order.filter((n) => condValues.has(n)).map((n) => ({ name: n, values: condValues.get(n)! })),
  };
}

/** Markdown headings (#, ##, ###) with their line index, for the Sections rail. */
export function readHeadings(text: string): { level: number; text: string; lineIndex: number }[] {
  const out: { level: number; text: string; lineIndex: number }[] = [];
  text.split("\n").forEach((line, i) => {
    const m = line.match(/^(#{1,3})\s+(.+)/);
    if (m) out.push({ level: m[1]!.length, text: m[2]!, lineIndex: i });
  });
  return out;
}
