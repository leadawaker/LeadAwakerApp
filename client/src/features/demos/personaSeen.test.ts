import { test } from "node:test";
import assert from "node:assert/strict";
import { markSeen, parseSeen, seenStorageKey, SEEN_KEEP_MS } from "./personaSeen";

const now = Date.parse("2026-10-28T12:00:00Z");
const ago = (ms: number) => new Date(now - ms).toISOString();
const DAY = 24 * 60 * 60 * 1000;

test("the storage key carries the user id, anon without one", () => {
  assert.equal(seenStorageKey("12"), "demos.personaSeen.12");
  assert.equal(seenStorageKey(null), "demos.personaSeen.anon");
  assert.equal(seenStorageKey(""), "demos.personaSeen.anon");
  assert.equal(seenStorageKey(undefined), "demos.personaSeen.anon");
});

test("parseSeen never throws: nothing, bad JSON and non-objects give an empty map", () => {
  assert.deepEqual(parseSeen(null), {});
  assert.deepEqual(parseSeen("{bad"), {});
  assert.deepEqual(parseSeen("[1]"), {});
  assert.deepEqual(parseSeen("5"), {});
  assert.deepEqual(parseSeen("null"), {});
});

test("parseSeen drops entries whose value is not a parseable date string", () => {
  assert.deepEqual(parseSeen('{"a":"2026-10-27T00:00:00.000Z","b":5,"c":"nope"}'), { a: "2026-10-27T00:00:00.000Z" });
});

test("markSeen sets the key to now", () => {
  assert.deepEqual(markSeen({}, "robben", now), { robben: new Date(now).toISOString() });
});

test("markSeen drops entries older than the keep window and keeps the rest", () => {
  const old = ago(SEEN_KEEP_MS + DAY);
  const keep = ago(SEEN_KEEP_MS - DAY);
  assert.equal(SEEN_KEEP_MS, 14 * DAY);
  const next = markSeen({ old, keep }, "x", now);
  assert.deepEqual(next, { keep, x: new Date(now).toISOString() });
});

test("markSeen leaves the input untouched", () => {
  const input = { a: ago(DAY) };
  const copy = { ...input };
  const next = markSeen(input, "b", now);
  assert.deepEqual(input, copy);
  assert.notEqual(next, input);
});
