import type { CardOp } from "@shared/voiceReview";
import { applyEdit } from "./promptEdits";

// An account's own phone instructions (its client prompt row) and how a card goes onto its draft (pure: no db).

export interface ClientRowState {
  /** The account's live client row; null until its first Save to live. */
  promptId: number | null;
  liveText: string;
  draft: { draftText: string; baseText: string; acceptedIds: number[] } | null;
}

/** The text a card is judged against and accepted into: the draft when there is one (even an empty one), else live. */
export const clientTextOf = (s: ClientRowState): string => s.draft?.draftText ?? s.liveText;

/** Add a rule as a new last line of the text. */
export function appendRule(text: string, rule: string): string {
  const base = text.trimEnd();
  return `${base}${base ? "\n" : ""}${rule.trim()}`;
}

type AcceptFailure = "not_found" | "ambiguous" | "no_change";

/** What accepting a client card writes onto the draft: a find/replace on the text, or the rule appended to it. */
export function planClientAccept(
  card: { id: number; op: CardOp; find: string; replace: string },
  s: ClientRowState,
): { ok: true; draftText: string; baseText: string; acceptedIds: number[] } | { ok: false; reason: AcceptFailure } {
  const text = clientTextOf(s);
  let draftText: string;
  if (card.op === "add") {
    if (text.includes(card.replace.trim())) return { ok: false, reason: "no_change" };
    draftText = appendRule(text, card.replace);
  } else {
    const applied = applyEdit(text, card.find, card.replace);
    if (!applied.ok) return { ok: false, reason: applied.reason };
    draftText = applied.text;
  }
  const accepted = s.draft?.acceptedIds ?? [];
  return {
    ok: true,
    draftText,
    baseText: s.draft?.baseText ?? s.liveText,
    acceptedIds: accepted.includes(card.id) ? [...accepted] : [...accepted, card.id],
  };
}
