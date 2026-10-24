// Wraps each case-insensitive match of the transcript search in a wine mark (the Calls page).
import type { ReactNode } from "react";

const MARK = { background: "var(--wine-tint)", color: "inherit", borderRadius: 3, padding: "0 1px", boxShadow: "0 0 0 1px var(--wine)" } as const;

export function highlight(text: string, query: string): ReactNode {
  const q = query.trim();
  if (!q) return text;
  const lower = text.toLowerCase();
  const needle = q.toLowerCase();
  const out: ReactNode[] = [];
  let from = 0;
  let at = lower.indexOf(needle);
  while (at !== -1) {
    if (at > from) out.push(text.slice(from, at));
    out.push(<mark key={at} style={MARK}>{text.slice(at, at + q.length)}</mark>);
    from = at + q.length;
    at = lower.indexOf(needle, from);
  }
  out.push(text.slice(from));
  return out;
}

/** How many transcript lines contain the query (the search field's count). */
export function countMatches(texts: readonly string[], query: string): number {
  const q = query.trim().toLowerCase();
  return q ? texts.filter((x) => x.toLowerCase().includes(q)).length : 0;
}
