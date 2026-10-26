import type { PromptLang, ProposalInput } from "@shared/voiceReview";

export function countOccurrences(text: string, find: string): number {
  if (!find) return 0;
  let n = 0;
  for (let i = text.indexOf(find); i !== -1; i = text.indexOf(find, i + find.length)) n++;
  return n;
}

export type EditResult = { ok: true; text: string } | { ok: false; reason: "not_found" | "ambiguous" };

/** Replace `find` with `replace`; the find must occur exactly once. The replacement is inserted literally. */
export function applyEdit(text: string, find: string, replace: string): EditResult {
  const n = countOccurrences(text, find);
  if (n === 0) return { ok: false, reason: "not_found" };
  if (n > 1) return { ok: false, reason: "ambiguous" };
  const at = text.indexOf(find);
  return { ok: true, text: text.slice(0, at) + replace + text.slice(at + find.length) };
}

const MARK = /\{\??!?[A-Za-z_][A-Za-z0-9_]*\}/g;

/** Template marks in `replace` that the full prompt does not already use. */
export function newMarks(replace: string, fullText: string): string[] {
  const out: string[] = [];
  for (const m of replace.matchAll(MARK)) if (!fullText.includes(m[0]) && !out.includes(m[0])) out.push(m[0]);
  return out;
}

export function cleanCopy(s: string): string {
  return s.replace(/\s*\u2014\s*/g, ", ").trim();
}

export type ProposalProblem = "empty" | "no_change" | "too_long" | "not_found" | "ambiguous" | "new_mark"
  | "mirror_not_found" | "mirror_ambiguous" | "mirror_new_mark" | "rejected_before";

const collapse = (s: string) => s.replace(/\s+/g, " ").trim();
const other = (l: PromptLang): PromptLang => (l === "nl" ? "en" : "nl");

function checkEdit(text: string | undefined, find: string, replace: string): "not_found" | "ambiguous" | "new_mark" | null {
  if (text === undefined) return "not_found";
  const r = applyEdit(text, find, replace);
  if (!r.ok) return r.reason;
  return newMarks(replace, text).length ? "new_mark" : null;
}

export function validateProposal(
  p: ProposalInput,
  texts: Partial<Record<PromptLang, string>>,
  rejected: { find: string; replace: string }[],
): { ok: true } | { ok: false; reason: ProposalProblem } {
  const fail = (reason: ProposalProblem) => ({ ok: false as const, reason });
  if (!p.find.trim() || !p.title.trim()) return fail("empty");
  if (p.find === p.replace) return fail("no_change");
  if (p.find.length > 2000 || p.replace.length > 3000) return fail("too_long");
  const main = checkEdit(texts[p.language], p.find, p.replace);
  if (main) return fail(main);
  if (p.mirrorFind) {
    const mirror = checkEdit(texts[other(p.language)], p.mirrorFind, p.mirrorReplace ?? "");
    if (mirror) return fail(`mirror_${mirror}`);
  }
  const f = collapse(p.find);
  const r = collapse(p.replace);
  if (rejected.some((x) => collapse(x.find) === f && collapse(x.replace) === r)) return fail("rejected_before");
  return { ok: true };
}
