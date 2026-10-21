import { test } from "node:test";
import assert from "node:assert/strict";
import {
  clearVersions, hasUnsaved, initialVersions, loadVersions, MAX_VERSIONS, saveVersions, versionsKey, withImproved, withSelected, withSnapshot,
} from "./scriptVersions";

function memory() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m };
}

test("an AI pass becomes a new shown version; the Original stays", () => {
  const s = withImproved(initialVersions("orig"), "orig", { title: "T", body: "ai 1" }, "shorter");
  assert.deepEqual(s.versions.map((v) => [v.kind, v.body]), [["original", "orig"], ["ai", "ai 1"]]);
  assert.equal(s.index, 1);
  assert.equal(s.versions[1].title, "T");
  assert.equal(s.versions[1].notes, "shorter");
  assert.ok(hasUnsaved(s));
  assert.ok(!hasUnsaved(initialVersions("orig")));
});

test("text typed over a version is kept as an edit before the next pass or a flip", () => {
  let s = withImproved(initialVersions("orig"), "orig", { title: "", body: "ai 1" }, "");
  s = withImproved(s, "ai 1 typed over", { title: "", body: "ai 2" }, "");
  assert.deepEqual(s.versions.map((v) => v.kind), ["original", "ai", "edit", "ai"]);
  assert.equal(s.versions[2].body, "ai 1 typed over");
  assert.equal(s.versions[3].title, null, "an empty AI title is no title");
  const flipped = withSelected(s, "ai 2 typed", 0);
  assert.equal(flipped.index, 0);
  assert.equal(flipped.versions.at(-1)?.body, "ai 2 typed");
  assert.equal(withSelected(s, "ai 2", 1).versions.length, 4, "no edit when nothing was typed");
  assert.equal(withSelected(s, "ai 2", 9), s, "out of range is ignored");
  assert.equal(withSnapshot(s, "ai 2"), s);
});

test("past the cap the oldest passes drop, never the Original", () => {
  let s = initialVersions("orig");
  for (let i = 1; i <= MAX_VERSIONS + 5; i++) s = withImproved(s, s.versions[s.index].body, { title: "", body: `ai ${i}` }, "");
  assert.equal(s.versions.length, MAX_VERSIONS);
  assert.equal(s.versions[0].body, "orig");
  assert.equal(s.versions[1].body, "ai 7");
  assert.equal(s.index, MAX_VERSIONS - 1);
});

test("localStorage mirror: unsaved versions round-trip, a lone Original or junk is nothing", () => {
  const store = memory();
  const key = versionsKey(7, 3);
  assert.equal(key, "la-social-script-versions:7:3");
  const s = withImproved(initialVersions("orig"), "orig", { title: "T", body: "ai" }, "n");
  saveVersions(key, s, store);
  assert.deepEqual(loadVersions(key, store), s);
  saveVersions(key, initialVersions("orig"), store);
  assert.equal(store.m.has(key), false);
  store.setItem(key, "{bad json");
  assert.equal(loadVersions(key, store), null);
  store.setItem(key, JSON.stringify({ versions: [{ kind: "ai", body: "x", title: null, notes: "" }], index: 0 }));
  assert.equal(loadVersions(key, store), null, "must start with the Original");
  saveVersions(key, s, store);
  clearVersions(key, store);
  assert.equal(loadVersions(key, store), null);
  const throwing = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); }, removeItem: () => { throw new Error("blocked"); } };
  assert.equal(loadVersions(key, throwing), null);
  assert.doesNotThrow(() => saveVersions(key, s, throwing));
  assert.doesNotThrow(() => clearVersions(key, throwing));
});
