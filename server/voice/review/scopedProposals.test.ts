import { test } from "node:test";
import assert from "node:assert/strict";
import type { ProposalInput } from "@shared/voiceReview";
import { SHARED_FIELDS, validateScoped, type ProposalContext, type RejectedCard } from "./scopedProposals";

const ctx: ProposalContext = {
  shared: { nl: "- Zeg nooit X.", en: "- Never say X." },
  client: "- Vraag het kenteken.",
  knowledge: [{ id: 12, title: "Inruil", content: "Wij nemen elke auto in.", category: "services" }],
  settings: { greeting: "Hoi", intake: "", pronunciation: [], afterHours: "message", screening: { sales: true, robocalls: true, abuse: true } },
};
const base: ProposalInput = { language: null, title: "t", reason: "r", find: "", replace: "", mirrorFind: null, mirrorReplace: null, callIds: [] };
const v = (p: Partial<ProposalInput>, rejected: RejectedCard[] = [], c: ProposalContext = ctx) => validateScoped({ ...base, ...p }, c, rejected);

test("shared: a find/replace on the live prompt passes with the shared fields", () => {
  assert.deepEqual(v({ language: "nl", find: "- Zeg nooit X.", replace: "- Als X, dan Y." }), { ok: true, fields: SHARED_FIELDS });
  assert.deepEqual(SHARED_FIELDS, { scope: "shared", op: "replace", kbId: null, kbTitle: null, kbCategory: null, settingKey: null, settingOld: null, settingNew: null });
});

test("shared: add op or no language is bad_scope, and the existing prompt checks still apply", () => {
  assert.deepEqual(v({ scope: "shared", op: "add", language: "nl", replace: "x" }), { ok: false, reason: "bad_scope" });
  assert.deepEqual(v({ scope: "shared", find: "- Zeg nooit X.", replace: "- Y." }), { ok: false, reason: "bad_scope" });
  assert.deepEqual(v({ language: "nl", find: "- Niet daar.", replace: "- Y." }), { ok: false, reason: "not_found" });
  assert.deepEqual(v({ language: "nl", find: "- Zeg nooit X.", replace: "- Zeg {agent}." }), { ok: false, reason: "new_mark" });
  assert.deepEqual(v({ language: "nl", find: "- Zeg nooit X.", replace: "- Zeg nooit X." }), { ok: false, reason: "no_change" });
});

test("an empty title is refused in every scope", () => {
  assert.deepEqual(v({ title: " ", language: "nl", find: "- Zeg nooit X.", replace: "- Y." }), { ok: false, reason: "empty" });
  assert.deepEqual(v({ title: "", scope: "client", op: "add", replace: "- Y." }), { ok: false, reason: "empty" });
  assert.deepEqual(v({ title: "", scope: "knowledge", op: "add", kbTitle: "Garantie", replace: "x" }), { ok: false, reason: "empty" });
  assert.deepEqual(v({ title: "", scope: "setting", settingKey: "afterHours", settingValue: "\"callback\"" }), { ok: false, reason: "empty" });
});

test("client: add and replace on the client text", () => {
  const add = v({ scope: "client", op: "add", replace: "- Noem nooit een levertijd." });
  assert.deepEqual(add, { ok: true, fields: { ...SHARED_FIELDS, scope: "client", op: "add" } });
  const edit = v({ scope: "client", op: "replace", find: "het kenteken", replace: "eerst het kenteken" });
  assert.deepEqual(edit, { ok: true, fields: { ...SHARED_FIELDS, scope: "client", op: "replace" } });
  assert.equal(v({ scope: "client", find: "het kenteken", replace: "eerst het kenteken" }).ok, true, "op defaults to replace");
});

test("client: marks, length and no-ops are refused", () => {
  assert.deepEqual(v({ scope: "client", op: "add", replace: "- Zeg {agent}." }), { ok: false, reason: "new_mark" });
  assert.deepEqual(v({ scope: "client", op: "replace", find: "kenteken", replace: "{?x}" }), { ok: false, reason: "new_mark" });
  assert.deepEqual(v({ scope: "client", op: "add", replace: "x".repeat(3001) }), { ok: false, reason: "too_long" });
  assert.equal(v({ scope: "client", op: "add", replace: "x".repeat(3000) }).ok, true);
  assert.deepEqual(v({ scope: "client", op: "add", replace: "- Vraag het kenteken." }), { ok: false, reason: "no_change" });
  assert.deepEqual(v({ scope: "client", op: "add", replace: "  - Vraag het kenteken.  " }), { ok: false, reason: "no_change" });
  assert.deepEqual(v({ scope: "client", op: "replace", find: "kenteken", replace: "kenteken" }), { ok: false, reason: "no_change" });
});

test("client: the find must be in the text exactly once, and add takes no find", () => {
  assert.deepEqual(v({ scope: "client", op: "replace", find: "naam", replace: "x" }), { ok: false, reason: "not_found" });
  assert.deepEqual(v({ scope: "client", op: "replace", find: "e", replace: "x" }), { ok: false, reason: "ambiguous" });
  assert.deepEqual(v({ scope: "client", op: "replace", find: "", replace: "x" }), { ok: false, reason: "empty" });
  assert.deepEqual(v({ scope: "client", op: "add", find: "kenteken", replace: "x" }), { ok: false, reason: "bad_scope" });
  assert.deepEqual(v({ scope: "client", op: "add", replace: "  " }), { ok: false, reason: "empty" });
  // an account with no client text yet: a replace has nothing to find, an add works
  const none = { ...ctx, client: "" };
  assert.deepEqual(v({ scope: "client", op: "replace", find: "x", replace: "y" }, [], none), { ok: false, reason: "not_found" });
  assert.equal(v({ scope: "client", op: "add", replace: "- A." }, [], none).ok, true);
});

test("knowledge: an edit names an entry on the list and its find must apply to the content", () => {
  assert.deepEqual(v({ scope: "knowledge", op: "replace", kbId: 99, find: "a", replace: "b" }), { ok: false, reason: "kb_unknown" });
  assert.deepEqual(v({ scope: "knowledge", op: "replace", kbId: null, find: "a", replace: "b" }), { ok: false, reason: "kb_unknown" });
  assert.deepEqual(v({ scope: "knowledge", op: "replace", find: "a", replace: "b" }), { ok: false, reason: "kb_unknown" });
  const kb = v({ scope: "knowledge", op: "replace", kbId: 12, find: "elke auto", replace: "elke auto tot 15 jaar" });
  assert.deepEqual(kb, { ok: true, fields: { ...SHARED_FIELDS, scope: "knowledge", op: "replace", kbId: 12, kbTitle: "Inruil" } });
  assert.deepEqual(v({ scope: "knowledge", op: "replace", kbId: 12, find: "elke boot", replace: "x" }), { ok: false, reason: "not_found" });
  assert.deepEqual(v({ scope: "knowledge", op: "replace", kbId: 12, find: "e", replace: "x" }), { ok: false, reason: "ambiguous" });
  assert.deepEqual(v({ scope: "knowledge", op: "replace", kbId: 12, find: "", replace: "x" }), { ok: false, reason: "empty" });
  assert.deepEqual(v({ scope: "knowledge", op: "replace", kbId: 12, find: "elke auto", replace: "elke auto" }), { ok: false, reason: "no_change" });
});

test("knowledge: the stock entry can never be edited or created", () => {
  assert.deepEqual(v({ scope: "knowledge", op: "add", kbTitle: "Current stock, updated every hour", replace: "x" }), { ok: false, reason: "kb_stock" });
  assert.deepEqual(v({ scope: "knowledge", op: "add", kbTitle: "  current stock list", replace: "x" }), { ok: false, reason: "kb_stock" });
  // the stock entry is not on ctx.knowledge, so an edit naming its id is an unknown entry
  assert.deepEqual(v({ scope: "knowledge", op: "replace", kbId: 7, find: "a", replace: "b" }), { ok: false, reason: "kb_unknown" });
});

test("knowledge: an add needs a title and content, and a category that exists", () => {
  assert.deepEqual(v({ scope: "knowledge", op: "add", kbTitle: " ", replace: "x" }), { ok: false, reason: "empty" });
  assert.deepEqual(v({ scope: "knowledge", op: "add", kbTitle: "Garantie", replace: " " }), { ok: false, reason: "empty" });
  assert.deepEqual(v({ scope: "knowledge", op: "add", kbTitle: "Garantie" }), { ok: false, reason: "empty" });
  const add = v({ scope: "knowledge", op: "add", kbTitle: " Garantie ", kbCategory: "sales_strategy", replace: "6 maanden." });
  assert.deepEqual(add, { ok: true, fields: { ...SHARED_FIELDS, scope: "knowledge", op: "add", kbTitle: "Garantie", kbCategory: "faq" } });
  const kept = v({ scope: "knowledge", op: "add", kbTitle: "Garantie", kbCategory: "services", replace: "6 maanden." });
  assert.equal(kept.ok && kept.fields.kbCategory, "services");
  // a displayable category with no entry yet in this account falls back too
  const unused = v({ scope: "knowledge", op: "add", kbTitle: "Garantie", kbCategory: "pricing", replace: "x" });
  assert.equal(unused.ok && unused.fields.kbCategory, "faq");
  const none = v({ scope: "knowledge", op: "add", kbTitle: "Garantie", replace: "x" });
  assert.equal(none.ok && none.fields.kbCategory, "faq");
});

test("setting: a whitelisted key must hold a value the Voice tab accepts and change it", () => {
  assert.deepEqual(v({ scope: "setting", settingKey: "afterHours", settingValue: "\"sometimes\"" }), { ok: false, reason: "setting_invalid" });
  assert.deepEqual(v({ scope: "setting", settingKey: "pronunciation", settingValue: JSON.stringify(Array(51).fill({ word: "a", sayAs: "b" })) }), { ok: false, reason: "setting_invalid" });
  assert.deepEqual(v({ scope: "setting", settingKey: "afterHours", settingValue: "\"message\"" }), { ok: false, reason: "no_change" });
  assert.deepEqual(v({ scope: "setting", settingKey: "afterHours", settingValue: null }), { ok: false, reason: "setting_invalid" });
  assert.deepEqual(v({ scope: "setting", settingKey: "afterHours" }), { ok: false, reason: "setting_invalid" });
  assert.deepEqual(v({ scope: "setting", settingKey: "afterHours", settingValue: "\"callback\"" }, [], { ...ctx, settings: null }), { ok: false, reason: "setting_invalid" });
  const set = v({ scope: "setting", settingKey: "afterHours", settingValue: "\"callback\"" });
  assert.deepEqual(set.ok && [set.fields.settingOld, set.fields.settingNew], ["message", "callback"]);
  assert.deepEqual(set, { ok: true, fields: { ...SHARED_FIELDS, scope: "setting", settingKey: "afterHours", settingOld: "message", settingNew: "callback" } });
});

test("setting: plain text keys, normalised intake, and equal objects count as no change", () => {
  const greeting = v({ scope: "setting", settingKey: "greeting", settingValue: "Goedemiddag" });
  assert.deepEqual(greeting.ok && [greeting.fields.settingOld, greeting.fields.settingNew], ["Hoi", "Goedemiddag"]);
  assert.deepEqual(v({ scope: "setting", settingKey: "greeting", settingValue: "Hoi" }), { ok: false, reason: "no_change" });
  const intake = v({ scope: "setting", settingKey: "intake", settingValue: " Kenteken \n\n Kilometerstand " });
  assert.equal(intake.ok && intake.fields.settingNew, "Kenteken\nKilometerstand");
  assert.deepEqual(v({ scope: "setting", settingKey: "screening", settingValue: "{\"abuse\":true,\"robocalls\":true,\"sales\":true}" }), { ok: false, reason: "no_change" });
  const screen = v({ scope: "setting", settingKey: "screening", settingValue: "{\"sales\":false,\"robocalls\":true,\"abuse\":true}" });
  assert.deepEqual(screen.ok && screen.fields.settingNew, { sales: false, robocalls: true, abuse: true });
});

test("setting: any other key is a note card and an empty key is refused", () => {
  const note = v({ scope: "setting", settingKey: "hours", settingValue: "Open op zaterdag tot 17:00" });
  assert.deepEqual(note.ok && [note.fields.settingOld, note.fields.settingNew], [null, "Open op zaterdag tot 17:00"]);
  assert.deepEqual(note, { ok: true, fields: { ...SHARED_FIELDS, scope: "setting", settingKey: "hours", settingOld: null, settingNew: "Open op zaterdag tot 17:00" } });
  const blank = v({ scope: "setting", settingKey: "hours" });
  assert.equal(blank.ok && blank.fields.settingNew, "");
  assert.equal(v({ scope: "setting", settingKey: "hours" }, [], { ...ctx, settings: null }).ok, true, "a note card needs no current settings");
  assert.deepEqual(v({ scope: "setting", settingKey: " ", settingValue: "x" }), { ok: false, reason: "empty" });
  assert.deepEqual(v({ scope: "setting", settingValue: "x" }), { ok: false, reason: "empty" });
});

test("rejected before: the same find and replace is refused in the shared, client and knowledge scopes", () => {
  const spaced = [{ find: "- Zeg  nooit X.", replace: "- Als X,\n dan Y." }];
  assert.deepEqual(v({ language: "nl", find: "- Zeg nooit X.", replace: "- Als X, dan Y." }, spaced), { ok: false, reason: "rejected_before" });
  assert.deepEqual(v({ scope: "client", op: "add", replace: "- Noem nooit een levertijd." }, [{ find: "", replace: "- Noem  nooit een levertijd." }]), { ok: false, reason: "rejected_before" });
  assert.deepEqual(v({ scope: "client", op: "replace", find: "het kenteken", replace: "x" }, [{ find: "het kenteken", replace: "x" }]), { ok: false, reason: "rejected_before" });
  assert.deepEqual(v({ scope: "knowledge", op: "replace", kbId: 12, find: "elke auto", replace: "elke auto tot 15 jaar" }, [{ find: "elke auto", replace: "elke auto tot 15 jaar" }]), { ok: false, reason: "rejected_before" });
  assert.equal(v({ language: "nl", find: "- Zeg nooit X.", replace: "- Als X, dan Z." }, spaced).ok, true, "a different replace is a new proposal");
});

test("rejected before: a knowledge card is the same only for the same entry (edit) or title and content (add)", () => {
  const edit: RejectedCard = { scope: "knowledge", op: "replace", kbId: 12, kbTitle: "Inruil", find: "elke auto", replace: "elke auto tot 15 jaar" };
  const same = { scope: "knowledge" as const, op: "replace" as const, kbId: 12, find: "elke auto", replace: "elke auto tot 15 jaar" };
  assert.deepEqual(v(same, [edit]), { ok: false, reason: "rejected_before" });
  const twoEntries = { ...ctx, knowledge: [...ctx.knowledge, { id: 13, title: "Inkoop", content: "Wij nemen elke auto in.", category: "services" }] };
  assert.equal(v({ ...same, kbId: 13 }, [edit], twoEntries).ok, true, "same words on another entry is not the rejected change");
  assert.equal(v({ ...same, scope: "client", op: "replace", find: "kenteken" }, [edit]).ok, true, "another scope never matches a tagged card");

  const add: RejectedCard = { scope: "knowledge", op: "add", kbId: null, kbTitle: "Garantie", find: "", replace: "6 maanden." };
  const made = { scope: "knowledge" as const, op: "add" as const, kbTitle: " garantie ", replace: "6  maanden." };
  assert.deepEqual(v(made, [add]), { ok: false, reason: "rejected_before" }, "title case and whitespace do not matter");
  assert.equal(v({ ...made, kbTitle: "Garantie plus" }, [add]).ok, true);
  assert.equal(v({ ...made, kbTitle: "Garantie", replace: "12 maanden." }, [add]).ok, true);
  assert.equal(v({ ...made, kbTitle: "Garantie" }, [{ ...edit, kbTitle: "Garantie", replace: "6 maanden." }]).ok, true, "a rejected edit does not block an add");
});

test("rejected before: a setting card is the same for the same key and new value, not for the same value on another key", () => {
  const set = { scope: "setting" as const, settingKey: "afterHours", settingValue: "\"callback\"" };
  const rej: RejectedCard = { scope: "setting", op: "replace", settingKey: "afterHours", find: "", replace: "callback" };
  assert.deepEqual(v(set, [rej]), { ok: false, reason: "rejected_before" });
  assert.equal(v({ ...set, settingValue: "\"ringHot\"" }, [rej]).ok, true);
  assert.equal(v(set, [{ ...rej, settingKey: "screening" }]).ok, true);
  assert.equal(v(set, [{ find: "", replace: "callback" }]).ok, true, "a bare pair carries no setting key");
  const json: RejectedCard = { scope: "setting", settingKey: "screening", find: "", replace: JSON.stringify({ sales: false, robocalls: true, abuse: true }) };
  assert.deepEqual(v({ scope: "setting", settingKey: "screening", settingValue: "{\"sales\":false,\"robocalls\":true,\"abuse\":true}" }, [json]), { ok: false, reason: "rejected_before" });
  const note: RejectedCard = { scope: "setting", settingKey: "hours", find: "", replace: "Open op zaterdag" };
  assert.deepEqual(v({ scope: "setting", settingKey: "hours", settingValue: "Open op  zaterdag" }, [note]), { ok: false, reason: "rejected_before" });
  assert.equal(v({ scope: "setting", settingKey: "voice", settingValue: "Open op zaterdag" }, [note]).ok, true);
});
