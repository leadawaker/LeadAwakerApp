import type { CardOp, CardScope, PromptLang, ProposalInput } from "@shared/voiceReview";
import { isSettingCardKey, type SettingValues } from "@shared/voiceSettings";
import { KB_CATEGORIES, KB_DEFAULT_CATEGORY, KB_STOCK_PREFIX } from "@shared/knowledgeBase";
import { applyEdit, collapse, newMarks, validateProposal, type ProposalProblem } from "./promptEdits";
import { parseSettingValue, sameSetting, settingText } from "./settingCards";

// Which proposals become cards, for every card scope (pure: no db). The model's proposal is checked
// against what it would change; the checks fill the card's scope columns on the way.

export interface KnowledgeFact { id: number; title: string; content: string; category: string }

/** The scope columns a valid proposal turns into (the shared prompt uses none of them). */
export interface ScopedFields {
  scope: CardScope;
  op: CardOp;
  kbId: number | null;
  kbTitle: string | null;
  kbCategory: string | null;
  settingKey: string | null;
  settingOld: unknown;
  settingNew: unknown;
}

export const SHARED_FIELDS: ScopedFields = {
  scope: "shared", op: "replace", kbId: null, kbTitle: null, kbCategory: null, settingKey: null, settingOld: null, settingNew: null,
};

export interface ProposalContext {
  /** The live shared prompt text per language. */
  shared: Partial<Record<PromptLang, string>>;
  /** The account's client text (draft when there is one, else live). */
  client: string;
  /** The account's knowledge entries, without the generated stock entry. */
  knowledge: KnowledgeFact[];
  /** The account's Voice tab values; null when it has no voice line (setting cards cannot be checked). */
  settings: SettingValues | null;
}

export type ScopedProblem = ProposalProblem | "bad_scope" | "kb_unknown" | "kb_stock" | "setting_invalid";

/**
 * A rejected card. A bare find/replace pair is the same change in any scope but setting. A card read from
 * Voice_Prompt_Suggestions also carries its scope columns, and is then the same change only in its own scope:
 * a knowledge edit for the same entry (or an add with the same title and content), a setting card for the
 * same key and new value (its `replace` holds the new value as text, see settingText).
 */
export interface RejectedCard {
  find: string;
  replace: string;
  scope?: CardScope;
  op?: CardOp;
  kbId?: number | null;
  kbTitle?: string | null;
  settingKey?: string | null;
}

export type ScopedVerdict = { ok: true; fields: ScopedFields } | { ok: false; reason: ScopedProblem };

const REPLACE_MAX = 3000;
const fail = (reason: ScopedProblem): ScopedVerdict => ({ ok: false, reason });
const pass = (over: Partial<ScopedFields> = {}): ScopedVerdict => ({ ok: true, fields: { ...SHARED_FIELDS, ...over } });
const sameTitle = (a: string | null | undefined, b: string | null | undefined) => collapse(a ?? "").toLowerCase() === collapse(b ?? "").toLowerCase();

/** Whether a rejected card is the same change as the proposal (never for setting cards: see sameSettingCard). */
function sameChange(r: RejectedCard, p: ProposalInput, scope: CardScope, op: CardOp): boolean {
  if (r.scope !== undefined && (r.scope !== scope || (r.op !== undefined && r.op !== op))) return false;
  if (r.scope === "knowledge") {
    if (op === "add") return sameTitle(r.kbTitle, p.kbTitle) && collapse(r.replace) === collapse(p.replace);
    if ((r.kbId ?? null) !== (p.kbId ?? null)) return false;
  }
  return collapse(r.find) === collapse(p.find) && collapse(r.replace) === collapse(p.replace);
}

const sameSettingCard = (r: RejectedCard, key: string, newValue: unknown): boolean =>
  r.scope === "setting" && r.settingKey === key && collapse(r.replace) === collapse(settingText(newValue));

export function validateScoped(p: ProposalInput, ctx: ProposalContext, rejected: RejectedCard[]): ScopedVerdict {
  if (!p.title.trim()) return fail("empty");
  const scope = p.scope ?? "shared";
  const op = p.op ?? "replace";
  if (scope !== "setting" && rejected.some((r) => sameChange(r, p, scope, op))) return fail("rejected_before");
  switch (scope) {
    case "shared": return validateShared(p, op, ctx);
    case "client": return validateClient(p, op, ctx);
    case "knowledge": return validateKnowledge(p, op, ctx);
    case "setting": return validateSetting(p, ctx, rejected);
    default: return fail("bad_scope");
  }
}

function validateShared(p: ProposalInput, op: CardOp, ctx: ProposalContext): ScopedVerdict {
  if (op !== "replace" || !p.language) return fail("bad_scope");
  // Rejection memory was checked above (scope aware), so the pair check inside is given nothing.
  const checked = validateProposal(p, ctx.shared, []);
  return checked.ok ? pass() : fail(checked.reason);
}

function validateClient(p: ProposalInput, op: CardOp, ctx: ProposalContext): ScopedVerdict {
  // The client text is inserted as it stands, never rendered, so a template mark would reach the call as text.
  if (newMarks(p.replace, "").length) return fail("new_mark");
  if (p.replace.length > REPLACE_MAX) return fail("too_long");
  if (op === "add") {
    if (p.find !== "") return fail("bad_scope");
    const rule = p.replace.trim();
    if (!rule) return fail("empty");
    return ctx.client.includes(rule) ? fail("no_change") : pass({ scope: "client", op });
  }
  if (!p.find.trim()) return fail("empty");
  if (p.find === p.replace) return fail("no_change");
  const applied = applyEdit(ctx.client, p.find, p.replace);
  return applied.ok ? pass({ scope: "client", op }) : fail(applied.reason);
}

function validateKnowledge(p: ProposalInput, op: CardOp, ctx: ProposalContext): ScopedVerdict {
  if (op === "replace") {
    const entry = ctx.knowledge.find((k) => k.id === p.kbId);
    if (!entry) return fail("kb_unknown");
    if (!p.find.trim()) return fail("empty");
    if (p.find === p.replace) return fail("no_change");
    const applied = applyEdit(entry.content, p.find, p.replace);
    return applied.ok ? pass({ scope: "knowledge", op, kbId: entry.id, kbTitle: entry.title }) : fail(applied.reason);
  }
  const title = (p.kbTitle ?? "").trim();
  if (!title || !p.replace.trim()) return fail("empty");
  if (title.toLowerCase().startsWith(KB_STOCK_PREFIX.toLowerCase())) return fail("kb_stock");
  const wanted = p.kbCategory ?? "";
  const known = (KB_CATEGORIES as readonly string[]).includes(wanted) && ctx.knowledge.some((k) => k.category === wanted);
  return pass({ scope: "knowledge", op, kbTitle: title, kbCategory: known ? wanted : KB_DEFAULT_CATEGORY });
}

function validateSetting(p: ProposalInput, ctx: ProposalContext, rejected: RejectedCard[]): ScopedVerdict {
  const key = (p.settingKey ?? "").trim();
  if (!key) return fail("empty");
  let fields: Partial<ScopedFields>;
  if (isSettingCardKey(key)) {
    // A missing value is not "": a card must never clear a setting because the model left the value out.
    if (!ctx.settings || p.settingValue == null) return fail("setting_invalid");
    const parsed = parseSettingValue(key, p.settingValue);
    if (!parsed.ok) return fail("setting_invalid");
    const current = ctx.settings[key];
    if (sameSetting(key, parsed.value, current)) return fail("no_change");
    fields = { settingOld: current, settingNew: parsed.value };
  } else {
    // Not a setting a card can apply: the card tells Gabriel what to change by hand.
    fields = { settingOld: null, settingNew: p.settingValue ?? "" };
  }
  if (rejected.some((r) => sameSettingCard(r, key, fields.settingNew))) return fail("rejected_before");
  return pass({ ...fields, scope: "setting", settingKey: key });
}
