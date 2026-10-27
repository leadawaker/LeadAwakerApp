import { test } from "node:test";
import assert from "node:assert/strict";
import type { DraftRowState } from "./draftPlans";
import { judgeTransitions, knowledgeUndo, settingUndo, staleReason, type JudgeContext, type JudgedCard } from "./cardJudge";

const nl: DraftRowState = { promptId: 130, useCase: "eleven_layer_nl", language: "nl", liveText: "A\nB", draft: null };
const en: DraftRowState = { promptId: 131, useCase: "eleven_layer_en", language: "en", liveText: "a\nb", draft: null };
const editedNl: DraftRowState = { ...nl, draft: { draftText: "A\nZ", baseText: "A\nB", acceptedIds: [] } };
const settings = { greeting: "Hoi", intake: "", pronunciation: [], afterHours: "message" as const, screening: { sales: true, robocalls: true, abuse: true } };

const card0: JudgedCard = { id: 1, scope: "shared", op: "replace", promptId: null, find: "", replace: "", mirrorPromptId: null, mirrorFind: null,
  mirrorReplace: null, kbId: null, settingKey: null, settingOld: null, status: "proposed", statusNote: null };
const ctx0: JudgeContext = { shared: [], client: null, knowledge: null, settings: null };

// The cases of staleTransitions (draftPlans.test.ts), as shared cards judged by judgeTransitions.
const card = { find: "B", replace: "C", promptId: 130, mirrorPromptId: 131, mirrorFind: "b", mirrorReplace: "c" };
const open = (id: number, status: string, statusNote: string | null = null, extra: Partial<JudgedCard> = {}): JudgedCard =>
  ({ ...card0, ...card, id, status, statusNote, ...extra });
const rows = (...r: DraftRowState[]): JudgeContext => ({ ...ctx0, shared: r });
const gone = (id: number) => ({ id, note: "find_text_gone" as const });

test("judgeTransitions: a proposed card whose text is gone goes stale, one that still applies stays", () => {
  assert.deepEqual(judgeTransitions([open(1, "proposed"), open(2, "proposed", null, { find: "A", replace: "A2", mirrorFind: null, mirrorReplace: null })], rows(editedNl, en)),
    { toStale: [gone(1)], toProposed: [] });
});

test("judgeTransitions: a card stale for find_text_gone returns to proposed once its text is back", () => {
  assert.deepEqual(judgeTransitions([open(1, "stale", "find_text_gone")], rows(nl, en)), { toStale: [], toProposed: [1] });
  // still gone (the draft is still edited): it stays stale
  assert.deepEqual(judgeTransitions([open(1, "stale", "find_text_gone")], rows(editedNl, en)), { toStale: [], toProposed: [] });
});

test("judgeTransitions: a mirror card needs the text back on both rows", () => {
  const editedEn: DraftRowState = { ...en, draft: { draftText: "a\nz", baseText: "a\nb", acceptedIds: [] } };
  assert.deepEqual(judgeTransitions([open(1, "stale", "find_text_gone")], rows(nl, editedEn)), { toStale: [], toProposed: [] });
  assert.deepEqual(judgeTransitions([open(1, "stale", "find_text_gone")], rows(nl)), { toStale: [], toProposed: [] }, "a missing row cannot apply");
});

test("judgeTransitions: a stale card without a judge note, and any other status, never moves", () => {
  const others = [open(1, "stale", null), open(2, "stale", "something_else"), open(3, "accepted"), open(4, "rejected"), open(5, "live")];
  assert.deepEqual(judgeTransitions(others, rows(nl, en)), { toStale: [], toProposed: [] });
  assert.deepEqual(judgeTransitions(others, rows(editedNl, en)), { toStale: [], toProposed: [] });
});

test("judgeTransitions: with no eleven rows nothing can be judged, so nothing moves", () => {
  assert.deepEqual(judgeTransitions([open(1, "proposed"), open(2, "stale", "find_text_gone")], rows()), { toStale: [], toProposed: [] });
});

test("judgeTransitions: a mixed list is sorted into both buckets", () => {
  const other = { find: "A", replace: "A2", mirrorFind: null, mirrorReplace: null, mirrorPromptId: null };
  const cards = [open(1, "proposed"), open(2, "stale", "find_text_gone", other), open(3, "stale", "find_text_gone"), open(4, "proposed", null, other)];
  assert.deepEqual(judgeTransitions(cards, rows(editedNl, en)), { toStale: [gone(1)], toProposed: [2] });
});

const clientCard = (extra: Partial<JudgedCard> = {}): JudgedCard => ({ ...card0, scope: "client", find: "kenteken", replace: "chassisnummer", ...extra });

test("judgeTransitions: a client replace goes stale when the client text lost its find, and comes back with it", () => {
  const edited: JudgeContext = { ...ctx0, client: "- Vraag de naam." };
  const intact: JudgeContext = { ...ctx0, client: "- Vraag het kenteken." };
  assert.deepEqual(judgeTransitions([clientCard()], edited), { toStale: [gone(1)], toProposed: [] });
  assert.deepEqual(judgeTransitions([clientCard()], intact), { toStale: [], toProposed: [] });
  assert.deepEqual(judgeTransitions([clientCard({ status: "stale", statusNote: "find_text_gone" })], intact), { toStale: [], toProposed: [1] });
  assert.deepEqual(judgeTransitions([clientCard({ status: "stale", statusNote: "find_text_gone" })], edited), { toStale: [], toProposed: [] });
});

test("staleReason: a client replace is stale when its find is missing or no longer unique", () => {
  assert.equal(staleReason(clientCard(), { ...ctx0, client: "- Vraag de naam." }), "find_text_gone");
  assert.equal(staleReason(clientCard(), { ...ctx0, client: "kenteken en kenteken" }), "find_text_gone");
  assert.equal(staleReason(clientCard(), { ...ctx0, client: "- Vraag het kenteken." }), null);
  assert.equal(staleReason(clientCard(), { ...ctx0, client: "" }), "find_text_gone", "an emptied client text is judged, not skipped");
  assert.equal(staleReason(clientCard(), ctx0), null, "no client context is not judged");
});

test("staleReason: add cards and note cards are never stale", () => {
  assert.equal(staleReason({ ...card0, scope: "client", op: "add" }, { ...ctx0, client: "" }), null);
  assert.equal(staleReason({ ...card0, scope: "client", op: "add", replace: "- A." }, { ...ctx0, client: "- A." }), null);
  assert.equal(staleReason({ ...card0, scope: "knowledge", op: "add" }, { ...ctx0, knowledge: new Map() }), null);
  assert.equal(staleReason({ ...card0, scope: "setting", settingKey: "hours", settingOld: null }, { ...ctx0, settings }), null);
});

test("staleReason: a knowledge edit is stale when its entry is gone or its content moved", () => {
  const kb: JudgedCard = { ...card0, scope: "knowledge", kbId: 12, find: "elke" };
  assert.equal(staleReason(kb, { ...ctx0, knowledge: new Map() }), "entry_gone");
  assert.equal(staleReason({ ...kb, kbId: null }, { ...ctx0, knowledge: new Map([[12, "Wij nemen elke auto in."]]) }), "entry_gone");
  assert.equal(staleReason(kb, { ...ctx0, knowledge: new Map([[12, "Wij nemen niets in."]]) }), "find_text_gone");
  assert.equal(staleReason(kb, { ...ctx0, knowledge: new Map([[12, "elke auto, elke boot"]]) }), "find_text_gone");
  assert.equal(staleReason(kb, { ...ctx0, knowledge: new Map([[12, "Wij nemen elke auto in."]]) }), null);
  assert.equal(staleReason(kb, ctx0), null, "no knowledge context is not judged");
});

test("staleReason: a setting card is stale once the setting is no longer what it was made against", () => {
  const settingCard: JudgedCard = { ...card0, scope: "setting", settingKey: "afterHours", settingOld: "message" };
  assert.equal(staleReason(settingCard, { ...ctx0, settings: { ...settings, afterHours: "callback" } }), "setting_changed");
  assert.equal(staleReason(settingCard, { ...ctx0, settings }), null);
  assert.equal(staleReason(settingCard, ctx0), null, "no settings context is not judged");
  assert.equal(staleReason({ ...settingCard, settingKey: "hours" }, { ...ctx0, settings }), null);
  const screening: JudgedCard = { ...settingCard, settingKey: "screening", settingOld: { abuse: true, robocalls: true, sales: true } };
  assert.equal(staleReason(screening, { ...ctx0, settings }), null, "key order does not matter");
  assert.equal(staleReason(screening, { ...ctx0, settings: { ...settings, screening: { sales: false, robocalls: true, abuse: true } } }), "setting_changed");
});

test("staleReason: shared cards use the draft or live text of the eleven rows", () => {
  assert.equal(staleReason(open(1, "proposed"), rows(editedNl, en)), "find_text_gone");
  assert.equal(staleReason(open(1, "proposed"), rows(nl, en)), null);
  assert.equal(staleReason(open(1, "proposed"), rows()), null, "no rows is not judged");
});

test("judgeTransitions: setting, knowledge and client cards move on their own notes", () => {
  const settingCard: JudgedCard = { ...card0, scope: "setting", settingKey: "afterHours", settingOld: "message" };
  const moved = { ...ctx0, settings: { ...settings, afterHours: "callback" as const } };
  assert.deepEqual(judgeTransitions([settingCard], moved), { toStale: [{ id: 1, note: "setting_changed" }], toProposed: [] });
  assert.deepEqual(judgeTransitions([{ ...settingCard, status: "stale", statusNote: "setting_changed" }], { ...ctx0, settings }), { toStale: [], toProposed: [1] });
  assert.deepEqual(judgeTransitions([{ ...settingCard, status: "stale", statusNote: "setting_changed" }], moved), { toStale: [], toProposed: [] });
  const kb: JudgedCard = { ...card0, id: 2, scope: "knowledge", kbId: 12, find: "elke" };
  assert.deepEqual(judgeTransitions([kb], { ...ctx0, knowledge: new Map() }), { toStale: [{ id: 2, note: "entry_gone" }], toProposed: [] });
  assert.deepEqual(judgeTransitions([{ ...kb, status: "stale", statusNote: "entry_gone" }], { ...ctx0, knowledge: new Map([[12, "elke auto"]]) }), { toStale: [], toProposed: [2] });
  assert.deepEqual(judgeTransitions([{ ...kb, status: "stale", statusNote: "entry_gone" }], { ...ctx0, knowledge: new Map() }), { toStale: [], toProposed: [] });
});

test("judgeTransitions: a stale card whose context was not read stays stale, and a proposed one stays proposed", () => {
  const stales: JudgedCard[] = [
    clientCard({ id: 1, status: "stale", statusNote: "find_text_gone" }),
    { ...card0, id: 2, scope: "knowledge", kbId: 12, find: "elke", status: "stale", statusNote: "entry_gone" },
    { ...card0, id: 3, scope: "setting", settingKey: "afterHours", settingOld: "message", status: "stale", statusNote: "setting_changed" },
    open(4, "stale", "find_text_gone"),
  ];
  assert.deepEqual(judgeTransitions(stales, ctx0), { toStale: [], toProposed: [] });
  assert.deepEqual(judgeTransitions(stales.map((c) => ({ ...c, status: "proposed", statusNote: null })), ctx0), { toStale: [], toProposed: [] });
  // each scope only needs its own part of the context
  assert.deepEqual(judgeTransitions(stales, { ...ctx0, client: "kenteken" }), { toStale: [], toProposed: [1] });
});

const edit = { op: "replace" as const, find: "elke auto", replace: "elke auto tot 15 jaar", kbTitle: "Inruil", kbPrevTitle: "Inruil", kbPrevContent: "Wij nemen elke auto in." };
const made = { op: "add" as const, find: "", replace: "6 maanden.", kbTitle: "Garantie", kbPrevTitle: null, kbPrevContent: null };

test("knowledgeUndo: an edit is restored, and flags a title or content changed since", () => {
  assert.deepEqual(knowledgeUndo(edit, { title: "Inruil", content: "Wij nemen elke auto tot 15 jaar in." }), { action: "restore", changedSince: false });
  assert.deepEqual(knowledgeUndo(edit, { title: "Inruil", content: "hand edited" }), { action: "restore", changedSince: true });
  assert.deepEqual(knowledgeUndo(edit, { title: "Inruilen", content: "Wij nemen elke auto tot 15 jaar in." }), { action: "restore", changedSince: true });
});

test("knowledgeUndo: an edit whose entry was deleted is gone, and one with nothing stored has nothing to restore", () => {
  assert.deepEqual(knowledgeUndo(edit, null), { action: "gone", changedSince: true });
  assert.deepEqual(knowledgeUndo({ ...edit, kbPrevContent: null }, { title: "Inruil", content: "x" }), { action: "nothing", changedSince: false });
  assert.deepEqual(knowledgeUndo({ ...edit, kbPrevContent: null }, null), { action: "gone", changedSince: true });
});

test("knowledgeUndo: an edit that cannot be re-applied to the stored content counts as changed", () => {
  const broken = { ...edit, find: "elke boot" };
  assert.deepEqual(knowledgeUndo(broken, { title: "Inruil", content: "Wij nemen elke auto in." }), { action: "restore", changedSince: true });
});

test("knowledgeUndo: an added entry is deleted, and flags a title or content changed since", () => {
  assert.deepEqual(knowledgeUndo(made, { title: "Garantie", content: "6 maanden." }), { action: "delete", changedSince: false });
  assert.deepEqual(knowledgeUndo(made, { title: "Garantie", content: "6 maanden, plus." }), { action: "delete", changedSince: true });
  assert.deepEqual(knowledgeUndo(made, { title: "Garanties", content: "6 maanden." }), { action: "delete", changedSince: true });
  assert.deepEqual(knowledgeUndo(made, null), { action: "nothing", changedSince: false });
});

test("settingUndo: changed since when the setting no longer holds the card's new value", () => {
  assert.deepEqual(settingUndo("afterHours", "message", "callback"), { changedSince: true });
  assert.deepEqual(settingUndo("afterHours", "callback", "callback"), { changedSince: false });
  assert.deepEqual(settingUndo("screening", { abuse: true, robocalls: true, sales: false }, { sales: false, robocalls: true, abuse: true }), { changedSince: false });
  assert.deepEqual(settingUndo("intake", " Kenteken\n\nKilometerstand ", "Kenteken\nKilometerstand"), { changedSince: false });
});
