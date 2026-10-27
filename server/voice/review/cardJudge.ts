import type { CardOp, CardScope } from "@shared/voiceReview";
import { isSettingCardKey, type SettingCardKey, type SettingValues } from "@shared/voiceSettings";
import { applyEdit } from "./promptEdits";
import { isStale, type DraftRowState } from "./draftPlans";
import { sameSetting } from "./settingCards";

// Whether an open card still fits what it would change, and what Undo may do (pure: no db).

export type StaleNote = "find_text_gone" | "entry_gone" | "setting_changed";
const STALE_NOTES: readonly string[] = ["find_text_gone", "entry_gone", "setting_changed"];

export interface JudgedCard {
  id: number;
  scope: CardScope;
  op: CardOp;
  promptId: number | null;
  find: string;
  replace: string;
  mirrorPromptId: number | null;
  mirrorFind: string | null;
  mirrorReplace: string | null;
  kbId: number | null;
  settingKey: string | null;
  settingOld: unknown;
  status: string;
  statusNote: string | null;
}

/** What each scope is judged against. A part that is null (or no shared rows) was not read, so its cards are not judged. */
export interface JudgeContext {
  shared: DraftRowState[];
  /** The account's client text (draft when there is one, else live). */
  client: string | null;
  /** Content of each of the account's knowledge entries by id. */
  knowledge: Map<number, string> | null;
  settings: SettingValues | null;
}

interface Verdict {
  /** False when the context this card is judged against was not read: it can neither go stale nor come back. */
  judged: boolean;
  note: StaleNote | null;
}

const fits: Verdict = { judged: true, note: null };
const unjudged: Verdict = { judged: false, note: null };
const stale = (note: StaleNote): Verdict => ({ judged: true, note });
const editFits = (text: string, card: JudgedCard): Verdict => (applyEdit(text, card.find, card.replace).ok ? fits : stale("find_text_gone"));

function judge(card: JudgedCard, ctx: JudgeContext): Verdict {
  switch (card.scope) {
    case "shared":
      if (!ctx.shared.length) return unjudged;
      return isStale(card, ctx.shared) ? stale("find_text_gone") : fits;
    case "client":
      if (card.op !== "replace") return fits;
      return ctx.client === null ? unjudged : editFits(ctx.client, card);
    case "knowledge": {
      if (card.op !== "replace") return fits;
      if (!ctx.knowledge) return unjudged;
      const content = card.kbId === null ? undefined : ctx.knowledge.get(card.kbId);
      return content === undefined ? stale("entry_gone") : editFits(content, card);
    }
    case "setting":
      if (!isSettingCardKey(card.settingKey)) return fits;
      if (!ctx.settings) return unjudged;
      return sameSetting(card.settingKey, ctx.settings[card.settingKey], card.settingOld) ? fits : stale("setting_changed");
    default:
      return fits;
  }
}

/** Why a card no longer fits, or null when it does (or cannot be judged). Add cards and note cards always fit. */
export const staleReason = (card: JudgedCard, ctx: JudgeContext): StaleNote | null => judge(card, ctx).note;

/**
 * Which open cards change status on a list fetch. A proposed card that no longer fits goes stale with the
 * reason; a stale card whose note is one of ours goes back to proposed once it is judged to fit again (a
 * draft was discarded, a version restored, a hand edit undone, the setting set back). A card whose context
 * was not read does not move.
 */
export function judgeTransitions(
  cards: JudgedCard[],
  ctx: JudgeContext,
): { toStale: { id: number; note: StaleNote }[]; toProposed: number[] } {
  const toStale: { id: number; note: StaleNote }[] = [];
  const toProposed: number[] = [];
  for (const c of cards) {
    if (c.status === "proposed") {
      const { note } = judge(c, ctx);
      if (note) toStale.push({ id: c.id, note });
    } else if (c.status === "stale" && c.statusNote !== null && STALE_NOTES.includes(c.statusNote)) {
      const { judged, note } = judge(c, ctx);
      if (judged && !note) toProposed.push(c.id);
    }
  }
  return { toStale, toProposed };
}

/**
 * What Undo does to a knowledge entry and whether it was changed by hand since Accept. An edit restores
 * the title and content kept on the card; an add deletes the entry the card made. An entry deleted since
 * leaves nothing to undo (an edit answers "gone": the card keeps no more than the previous title and content).
 */
export function knowledgeUndo(
  card: { op: CardOp; find: string; replace: string; kbTitle: string | null; kbPrevTitle: string | null; kbPrevContent: string | null },
  current: { title: string; content: string } | null,
): { action: "restore" | "delete" | "nothing" | "gone"; changedSince: boolean } {
  if (card.op === "add") {
    if (!current) return { action: "nothing", changedSince: false };
    return { action: "delete", changedSince: current.title !== card.kbTitle || current.content !== card.replace };
  }
  if (!current) return { action: "gone", changedSince: true };
  if (card.kbPrevContent === null) return { action: "nothing", changedSince: false };
  const expected = applyEdit(card.kbPrevContent, card.find, card.replace);
  return { action: "restore", changedSince: current.title !== card.kbPrevTitle || !expected.ok || current.content !== expected.text };
}

/** A setting changed since Accept when it no longer holds the value the card wrote. */
export function settingUndo(key: SettingCardKey, current: unknown, cardNew: unknown): { changedSince: boolean } {
  return { changedSince: !sameSetting(key, current, cardNew) };
}
