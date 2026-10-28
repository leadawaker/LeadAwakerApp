import { test } from "node:test";
import assert from "node:assert/strict";
import { afterAdd, clearDraft, draftKey, emptyDraft, patchIfSameGroup, readDraft, writeDraft, type DemoDraft } from "./createDraft";

function memory(init: Record<string, string> = {}) {
  const m = new Map(Object.entries(init));
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m };
}

function throwing() {
  return {
    getItem: (): string | null => { throw new Error("blocked"); },
    setItem: (): void => { throw new Error("blocked"); },
  };
}

const KEY = "la.demoDraft.7";
const user = { leadawaker_user_id: "7" };

function counter() {
  let n = 0;
  return () => `id-${++n}`;
}

test("the key is per user", () => {
  assert.equal(draftKey("7"), KEY);
});

test("an empty draft starts on Existing client in English with a fresh prospect group", () => {
  const d = emptyDraft("g1");
  assert.equal(d.v, 1);
  assert.equal(d.mode, "existing");
  assert.equal(d.language, "en");
  assert.equal(d.prospectGroup, "g1");
  assert.equal(d.review, null);
  assert.equal(d.moreOpen, false);
  assert.equal(d.foldOpen, false);
  assert.equal(d.firstName, "");
  assert.equal(d.notes, "");
});

test("a missing or throwing storage reads as an empty draft", () => {
  const id = counter();
  assert.equal(readDraft(id, null).prospectGroup, "id-1");
  assert.equal(readDraft(id, throwing()).mode, "existing");
  assert.equal(readDraft(id, memory(user)).firstName, "");
});

test("a value that cannot be read as the current shape reads as an empty draft", () => {
  const id = counter();
  const s = memory({ ...user, [KEY]: "{not json" });
  assert.equal(readDraft(id, s).firstName, "");

  s.m.set(KEY, JSON.stringify({ v: 0, firstName: "Old" }));
  assert.equal(readDraft(id, s).firstName, "");

  s.m.set(KEY, JSON.stringify({ ...emptyDraft("g9"), firstName: 42 }));
  assert.equal(readDraft(id, s).firstName, "");

  s.m.set(KEY, JSON.stringify({ ...emptyDraft("g9"), mode: "elsewhere", firstName: "Anna" }));
  assert.equal(readDraft(id, s).firstName, "");

  s.m.set(KEY, JSON.stringify({ ...emptyDraft("g9"), market: "fr", firstName: "Anna" }));
  assert.equal(readDraft(id, s).firstName, "");

  s.m.set(KEY, JSON.stringify({ ...emptyDraft("g9"), review: { client: "Acme" }, firstName: "Anna" }));
  assert.equal(readDraft(id, s).firstName, "");

  s.m.set(KEY, "null");
  assert.equal(readDraft(id, s).firstName, "");
  s.m.set(KEY, "[]");
  assert.equal(readDraft(id, s).firstName, "");
});

test("a draft round-trips, review included", () => {
  const id = counter();
  const s = memory(user);
  const d: DemoDraft = {
    ...emptyDraft("g1"),
    firstName: "Anna",
    mode: "website",
    websiteUrl: "https://example.com",
    foldOpen: true,
    review: {
      client: "Acme Cars",
      language: "nl",
      summary: "A dealer.",
      products: [{ name: "Golf", detail: "2021", price: "EUR 15000" }],
      city: "Utrecht",
      stockUrl: "https://example.com/stock",
    },
  };
  writeDraft(d, s);
  assert.deepEqual(readDraft(id, s), d);
});

test("a stored draft without a prospect group gets a new one", () => {
  const id = counter();
  const { prospectGroup: _group, ...rest } = emptyDraft("g1");
  const s = memory({ ...user, [KEY]: JSON.stringify({ ...rest, firstName: "Anna" }) });
  const d = readDraft(id, s);
  assert.equal(d.firstName, "Anna");
  assert.equal(d.prospectGroup, "id-1");
});

test("each user keeps their own draft", () => {
  const id = counter();
  const s = memory(user);
  writeDraft({ ...emptyDraft("g1"), firstName: "Anna" }, s);
  s.m.set("leadawaker_user_id", "8");
  assert.equal(readDraft(id, s).firstName, "");
  s.m.set("leadawaker_user_id", "7");
  assert.equal(readDraft(id, s).firstName, "Anna");
});

test("writing never throws, with a throwing or missing storage", () => {
  const d = emptyDraft("g1");
  assert.doesNotThrow(() => writeDraft(d, throwing()));
  assert.doesNotThrow(() => writeDraft(d, null));
});

test("after an add the fields stay and the prospect group is new", () => {
  const id = counter();
  const d = { ...emptyDraft("g1"), firstName: "Anna", mode: "website" as const };
  const a = afterAdd(d, id);
  assert.equal(a.firstName, "Anna");
  assert.equal(a.mode, "website");
  assert.notEqual(a.prospectGroup, "g1");
  assert.equal(d.prospectGroup, "g1");
});

test("clear empties the stored draft and starts a new prospect group", () => {
  const id = counter();
  const s = memory(user);
  writeDraft({ ...emptyDraft("g1"), firstName: "Anna", notes: "call back" }, s);

  const c = clearDraft(id, s);
  assert.equal(c.firstName, "");
  assert.equal(c.notes, "");
  assert.notEqual(c.prospectGroup, "g1");

  const after = readDraft(id, s);
  assert.equal(after.firstName, "");
  assert.equal(after.notes, "");
  assert.notEqual(after.prospectGroup, "g1");
  assert.equal(after.prospectGroup, c.prospectGroup);
});

test("clear with a throwing storage still returns an empty draft", () => {
  const c = clearDraft(counter(), throwing());
  assert.equal(c.firstName, "");
  assert.equal(c.prospectGroup, "id-1");
});

test("a late result is applied only to the prospect it was started for", () => {
  const d = emptyDraft("g1");
  const applied = patchIfSameGroup(d, "g1", { websiteUrl: "https://a.nl" });
  assert.equal(applied?.websiteUrl, "https://a.nl");
  assert.equal(applied?.prospectGroup, "g1");
  assert.equal(d.websiteUrl, "", "the draft passed in is not changed");

  // After Clear or an add the draft has a new group: the old request's result is dropped.
  const cleared = clearDraft(counter(), null);
  assert.notEqual(cleared.prospectGroup, "g1");
  assert.equal(patchIfSameGroup(cleared, "g1", { mode: "website" }), null);
  const added = afterAdd(d, counter());
  assert.equal(patchIfSameGroup(added, "g1", { clientNiche: "Old scan" }), null);
});
