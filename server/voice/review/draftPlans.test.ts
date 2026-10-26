import { test } from "node:test";
import assert from "node:assert/strict";
import { draftTextOf, isStale, planAccept, planSaveToLive, staleTransitions, STALE_NOTE, type CardEdit, type DraftRowState } from "./draftPlans";

const nl: DraftRowState = { promptId: 130, useCase: "eleven_layer_nl", language: "nl", liveText: "A\nB", draft: null };
const en: DraftRowState = { promptId: 131, useCase: "eleven_layer_en", language: "en", liveText: "a\nb", draft: null };
const card: CardEdit = { id: 9, promptId: 130, find: "B", replace: "C", mirrorPromptId: 131, mirrorFind: "b", mirrorReplace: "c" };

test("draftTextOf prefers the draft and falls back to live", () => {
  assert.equal(draftTextOf(nl), "A\nB");
  assert.equal(draftTextOf({ ...nl, draft: { draftText: "A\nZ", baseText: "A\nB", acceptedIds: [] } }), "A\nZ");
  assert.equal(draftTextOf({ ...nl, draft: { draftText: "", baseText: "A\nB", acceptedIds: [] } }), "");
});

test("planAccept writes the target and the mirror, each based on live", () => {
  assert.deepEqual(planAccept(card, [nl, en]), { ok: true, writes: [
    { promptId: 130, useCase: "eleven_layer_nl", draftText: "A\nC", baseText: "A\nB", acceptedIds: [9] },
    { promptId: 131, useCase: "eleven_layer_en", draftText: "a\nc", baseText: "a\nb", acceptedIds: [9] } ] });
});

test("planAccept builds on the existing draft, keeps its base and accepted ids, and never repeats a card id", () => {
  const drafted: DraftRowState = { ...nl, draft: { draftText: "A\nB\nExtra", baseText: "OLD", acceptedIds: [4, 9] } };
  const r = planAccept({ ...card, mirrorFind: null, mirrorReplace: null, mirrorPromptId: null }, [drafted, en]);
  assert.deepEqual(r, { ok: true, writes: [{ promptId: 130, useCase: "eleven_layer_nl", draftText: "A\nC\nExtra", baseText: "OLD", acceptedIds: [4, 9] }] });
  const fresh = planAccept({ ...card, mirrorFind: null, mirrorReplace: null, mirrorPromptId: null }, [{ ...drafted, draft: { ...drafted.draft!, acceptedIds: [4] } }]);
  assert.deepEqual(fresh.ok && fresh.writes[0].acceptedIds, [4, 9]);
});

test("planAccept without a mirror touches only the target row", () => {
  const r = planAccept({ ...card, mirrorFind: null, mirrorReplace: null }, [nl, en]);
  assert.equal(r.ok && r.writes.length, 1);
});

test("planAccept with a null mirror replace deletes the mirror text", () => {
  const r = planAccept({ ...card, mirrorReplace: null }, [nl, en]);
  assert.deepEqual(r.ok && r.writes[1].draftText, "a\n");
});

test("planAccept failure reasons", () => {
  assert.deepEqual(planAccept(card, [en]), { ok: false, reason: "no_row" });
  assert.deepEqual(planAccept(card, [nl]), { ok: false, reason: "no_row" });
  assert.deepEqual(planAccept({ ...card, mirrorPromptId: null }, [nl, en]), { ok: false, reason: "no_row" });
  assert.deepEqual(planAccept({ ...card, find: "Q" }, [nl, en]), { ok: false, reason: "not_found" });
  assert.deepEqual(planAccept({ ...card, mirrorFind: "q" }, [nl, en]), { ok: false, reason: "not_found" });
  assert.deepEqual(planAccept({ ...card, find: "\n", replace: " " }, [{ ...nl, liveText: "A\nB\nC" }, en]), { ok: false, reason: "ambiguous" });
});

test("a card made against live is stale once the draft no longer has its text", () => {
  const edited: DraftRowState = { ...nl, draft: { draftText: "A\nZ", baseText: "A\nB", acceptedIds: [] } };
  assert.equal(isStale(card, [edited, en]), true);
  assert.equal(isStale(card, [nl, en]), false);
});

const open = (id: number, status: string, statusNote: string | null = null, extra: Partial<CardEdit> = {}) => ({ ...card, id, status, statusNote, ...extra });
const editedNl: DraftRowState = { ...nl, draft: { draftText: "A\nZ", baseText: "A\nB", acceptedIds: [] } };

test("staleTransitions: a proposed card whose text is gone goes stale, one that still applies stays", () => {
  assert.deepEqual(staleTransitions([open(1, "proposed"), open(2, "proposed", null, { find: "A", replace: "A2", mirrorFind: null, mirrorReplace: null })], [editedNl, en]),
    { toStale: [1], toProposed: [] });
});

test("staleTransitions: a card stale for find_text_gone returns to proposed once its text is back", () => {
  assert.deepEqual(staleTransitions([open(1, "stale", STALE_NOTE)], [nl, en]), { toStale: [], toProposed: [1] });
  // still gone (the draft is still edited): it stays stale
  assert.deepEqual(staleTransitions([open(1, "stale", STALE_NOTE)], [editedNl, en]), { toStale: [], toProposed: [] });
});

test("staleTransitions: a mirror card needs the text back on both rows", () => {
  const editedEn: DraftRowState = { ...en, draft: { draftText: "a\nz", baseText: "a\nb", acceptedIds: [] } };
  assert.deepEqual(staleTransitions([open(1, "stale", STALE_NOTE)], [nl, editedEn]), { toStale: [], toProposed: [] });
  assert.deepEqual(staleTransitions([open(1, "stale", STALE_NOTE)], [nl]), { toStale: [], toProposed: [] }, "a missing row cannot apply");
});

test("staleTransitions: a stale card without the find_text_gone note, and any other status, never moves", () => {
  const others = [open(1, "stale", null), open(2, "stale", "something_else"), open(3, "accepted"), open(4, "rejected"), open(5, "live")];
  assert.deepEqual(staleTransitions(others, [nl, en]), { toStale: [], toProposed: [] });
  assert.deepEqual(staleTransitions(others, [editedNl, en]), { toStale: [], toProposed: [] });
});

test("staleTransitions: with no eleven rows nothing can be judged, so nothing moves", () => {
  assert.deepEqual(staleTransitions([open(1, "proposed"), open(2, "stale", STALE_NOTE)], []), { toStale: [], toProposed: [] });
});

test("staleTransitions: a mixed list is sorted into both buckets", () => {
  const other = { find: "A", replace: "A2", mirrorFind: null, mirrorReplace: null, mirrorPromptId: null };
  const cards = [open(1, "proposed"), open(2, "stale", STALE_NOTE, other), open(3, "stale", STALE_NOTE), open(4, "proposed", null, other)];
  assert.deepEqual(staleTransitions(cards, [editedNl, en]), { toStale: [1], toProposed: [2] });
});

test("planSaveToLive snapshots the current live text, not the base", () => {
  const plan = planSaveToLive([{ ...nl, draft: { draftText: "A\nC", baseText: "OLD", acceptedIds: [9, 4] } }, en],
    [{ promptId: 130, liveText: "A\nB2", version: "3", systemMessage: null }, { promptId: 131, liveText: "a\nb", version: null, systemMessage: null }], "2026-10-26");
  assert.deepEqual(plan.versions, [{ promptId: 130, versionNumber: "3", promptText: "A\nB2", systemMessage: null, label: "Before save to live 2026-10-26, cards #9 #4" }]);
  assert.deepEqual(plan.updates, [{ promptId: 130, promptText: "A\nC" }]);
  assert.deepEqual(plan.liveCardIds, [9, 4]);
  assert.deepEqual(plan.deleteDraftPromptIds, [130]);
});

test("planSaveToLive label has no card list when nothing was accepted, and carries the system message", () => {
  const plan = planSaveToLive([{ ...nl, draft: { draftText: "hand edit", baseText: "A\nB", acceptedIds: [] } }],
    [{ promptId: 130, liveText: "A\nB", version: "7", systemMessage: "sys" }], "2026-10-26");
  assert.deepEqual(plan.versions, [{ promptId: 130, versionNumber: "7", promptText: "A\nB", systemMessage: "sys", label: "Before save to live 2026-10-26" }]);
  assert.deepEqual(plan.liveCardIds, []);
});

test("planSaveToLive: a draft equal to live gives no version, no update, and the draft is still removed", () => {
  const plan = planSaveToLive([nl, { ...en, draft: { draftText: "a\nb", baseText: "a\nb", acceptedIds: [5] } }],
    [{ promptId: 130, liveText: "A\nB", version: null, systemMessage: null }, { promptId: 131, liveText: "a\nb", version: "2", systemMessage: null }], "2026-10-26");
  assert.deepEqual(plan.versions, []);
  assert.deepEqual(plan.updates, []);
  assert.deepEqual(plan.deleteDraftPromptIds, [131]);
  assert.deepEqual(plan.liveCardIds, [5]);
});

test("planSaveToLive: a mirrored card accepted on both rows is listed once, and rows without a draft are untouched", () => {
  const plan = planSaveToLive([
    { ...nl, draft: { draftText: "A\nC", baseText: "A\nB", acceptedIds: [9] } },
    { ...en, draft: { draftText: "a\nc", baseText: "a\nb", acceptedIds: [9] } }],
  [{ promptId: 130, liveText: "A\nB", version: "1", systemMessage: null }, { promptId: 131, liveText: "a\nb", version: "1", systemMessage: null }], "2026-10-26");
  assert.deepEqual(plan.liveCardIds, [9]);
  assert.deepEqual(plan.deleteDraftPromptIds, [130, 131]);
  assert.deepEqual(plan.versions.map((v) => v.promptId), [130, 131]);
  assert.deepEqual(plan.updates.map((u) => u.promptId), [130, 131]);
  assert.deepEqual(planSaveToLive([nl, en], [], "2026-10-26"), { versions: [], updates: [], liveCardIds: [], deleteDraftPromptIds: [] });
});
