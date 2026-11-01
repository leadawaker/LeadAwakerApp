import { test } from "node:test";
import assert from "node:assert/strict";
import { appendRule, clientTextOf, planClientAccept } from "./clientRules";

test("appendRule trims, and starts a line only when there is text before it", () => {
  assert.equal(appendRule("", "- Vraag eerst het kenteken. "), "- Vraag eerst het kenteken.");
  assert.equal(appendRule("- A.\n\n", "- B."), "- A.\n- B.");
  assert.equal(appendRule("   \n", "- B."), "- B.");
  assert.equal(appendRule("- A.", "\n  - B.  \n"), "- A.\n- B.");
});

test("clientTextOf prefers the draft, even an empty one", () => {
  assert.equal(clientTextOf({ promptId: 900, liveText: "- A.", draft: null }), "- A.");
  assert.equal(clientTextOf({ promptId: 900, liveText: "- A.", draft: { draftText: "- Z.", baseText: "- A.", acceptedIds: [] } }), "- Z.");
  assert.equal(clientTextOf({ promptId: 900, liveText: "- A.", draft: { draftText: "", baseText: "- A.", acceptedIds: [] } }), "");
});

const s = { promptId: 900, liveText: "- A.", draft: null };

test("planClientAccept add: appends to the live text and starts the draft from it", () => {
  assert.deepEqual(
    planClientAccept({ id: 4, op: "add", find: "", replace: "- B." }, s),
    { ok: true, draftText: "- A.\n- B.", baseText: "- A.", acceptedIds: [4] },
  );
});

test("planClientAccept add: a rule that is already there changes nothing", () => {
  assert.deepEqual(planClientAccept({ id: 4, op: "add", find: "", replace: "- A." }, s), { ok: false, reason: "no_change" });
  assert.deepEqual(planClientAccept({ id: 4, op: "add", find: "", replace: "  - A.  " }, s), { ok: false, reason: "no_change" });
});

test("planClientAccept add: with no client row yet the draft is just the rule", () => {
  assert.deepEqual(
    planClientAccept({ id: 4, op: "add", find: "", replace: "- B." }, { promptId: null, liveText: "", draft: null }),
    { ok: true, draftText: "- B.", baseText: "", acceptedIds: [4] },
  );
});

test("planClientAccept add: keeps the draft's base and accepted ids, and adds the card id once", () => {
  const withDraft = { ...s, draft: { draftText: "- A.\n- X.", baseText: "- A.", acceptedIds: [2] } };
  assert.deepEqual(
    planClientAccept({ id: 4, op: "add", find: "", replace: "- B." }, withDraft),
    { ok: true, draftText: "- A.\n- X.\n- B.", baseText: "- A.", acceptedIds: [2, 4] },
  );
  const again = { ...s, draft: { draftText: "- A.", baseText: "- A.", acceptedIds: [4] } };
  assert.deepEqual(
    planClientAccept({ id: 4, op: "add", find: "", replace: "- B." }, again),
    { ok: true, draftText: "- A.\n- B.", baseText: "- A.", acceptedIds: [4] },
  );
});

test("planClientAccept replace: edits the draft text when there is a draft, else the live text", () => {
  assert.deepEqual(
    planClientAccept({ id: 5, op: "replace", find: "A", replace: "C" }, s),
    { ok: true, draftText: "- C.", baseText: "- A.", acceptedIds: [5] },
  );
  assert.deepEqual(
    planClientAccept({ id: 5, op: "replace", find: "X", replace: "C" }, { ...s, draft: { draftText: "- A.\n- X.", baseText: "- A.", acceptedIds: [4] } }),
    { ok: true, draftText: "- A.\n- C.", baseText: "- A.", acceptedIds: [4, 5] },
  );
});

test("planClientAccept replace: the find must occur exactly once", () => {
  assert.deepEqual(
    planClientAccept({ id: 5, op: "replace", find: "A", replace: "C" }, { ...s, draft: { draftText: "- A. A", baseText: "- A.", acceptedIds: [4] } }),
    { ok: false, reason: "ambiguous" },
  );
  assert.deepEqual(planClientAccept({ id: 5, op: "replace", find: "Z", replace: "C" }, s), { ok: false, reason: "not_found" });
});
