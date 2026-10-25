import type { PromptLang, SuggestionDto } from "@shared/voiceReview";
import { applyEdit } from "./promptEdits";

export interface DraftRowState {
  promptId: number;
  useCase: string;
  language: PromptLang;
  liveText: string;
  draft: { draftText: string; baseText: string; acceptedIds: number[] } | null;
}

export interface DraftWrite { promptId: number; useCase: string; draftText: string; baseText: string; acceptedIds: number[] }

export type CardEdit = Pick<SuggestionDto, "id" | "promptId" | "find" | "replace" | "mirrorPromptId" | "mirrorFind" | "mirrorReplace">;

export const draftTextOf = (row: DraftRowState): string => row.draft?.draftText ?? row.liveText;

type AcceptFailure = "no_row" | "not_found" | "ambiguous";

/** What accepting a card writes: its edit on the draft (or live) text of the target row, and of the mirror row if it has one. */
export function planAccept(card: CardEdit, rows: DraftRowState[]): { ok: true; writes: DraftWrite[] } | { ok: false; reason: AcceptFailure } {
  const edits: { promptId: number | null; find: string; replace: string }[] = [{ promptId: card.promptId, find: card.find, replace: card.replace }];
  if (card.mirrorFind) edits.push({ promptId: card.mirrorPromptId, find: card.mirrorFind, replace: card.mirrorReplace ?? "" });
  const writes: DraftWrite[] = [];
  for (const e of edits) {
    const row = rows.find((r) => r.promptId === e.promptId);
    if (!row) return { ok: false, reason: "no_row" };
    const applied = applyEdit(draftTextOf(row), e.find, e.replace);
    if (!applied.ok) return { ok: false, reason: applied.reason };
    const accepted = row.draft?.acceptedIds ?? [];
    writes.push({
      promptId: row.promptId,
      useCase: row.useCase,
      draftText: applied.text,
      baseText: row.draft?.baseText ?? row.liveText,
      acceptedIds: accepted.includes(card.id) ? [...accepted] : [...accepted, card.id],
    });
  }
  return { ok: true, writes };
}

/** A card is stale when its edit no longer applies cleanly to the text it would be accepted into. */
export const isStale = (card: CardEdit, rows: DraftRowState[]): boolean => !planAccept(card, rows).ok;

export interface SavePlan {
  versions: { promptId: number; versionNumber: string | null; promptText: string; systemMessage: string | null; label: string }[];
  updates: { promptId: number; promptText: string }[];
  liveCardIds: number[];
  deleteDraftPromptIds: number[];
}

/** What "Save to live" does: snapshot each changed live prompt, write the draft over it, drop the draft, mark its cards live. */
export function planSaveToLive(
  rows: DraftRowState[],
  current: { promptId: number; liveText: string; version: string | null; systemMessage: string | null }[],
  today: string,
): SavePlan {
  const plan: SavePlan = { versions: [], updates: [], liveCardIds: [], deleteDraftPromptIds: [] };
  for (const row of rows) {
    if (!row.draft) continue;
    const { draftText, acceptedIds } = row.draft;
    plan.deleteDraftPromptIds.push(row.promptId);
    for (const id of acceptedIds) if (!plan.liveCardIds.includes(id)) plan.liveCardIds.push(id);
    const live = current.find((c) => c.promptId === row.promptId) ?? { promptId: row.promptId, liveText: row.liveText, version: null, systemMessage: null };
    if (draftText === live.liveText) continue;
    plan.versions.push({
      promptId: row.promptId,
      versionNumber: live.version,
      promptText: live.liveText,
      systemMessage: live.systemMessage,
      label: `Before save to live ${today}${acceptedIds.length ? `, cards ${acceptedIds.map((id) => `#${id}`).join(" ")}` : ""}`,
    });
    plan.updates.push({ promptId: row.promptId, promptText: draftText });
  }
  return plan;
}
