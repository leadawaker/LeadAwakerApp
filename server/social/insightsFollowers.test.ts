import { test } from "node:test";
import assert from "node:assert/strict";
import { dayOfEndTime, deriveFollowerHistory, parseFollowerChanges } from "./insightsFollowers";

test("derivation: each day ends at today's count minus the net changes after it", () => {
  const h = deriveFollowerHistory(1000, "2026-10-20", { "2026-10-17": 10, "2026-10-18": -4, "2026-10-19": 6 });
  assert.deepEqual(h, [{ day: "2026-10-19", value: 1000 }, { day: "2026-10-18", value: 994 }, { day: "2026-10-17", value: 998 }]);
});

test("today's partial change is taken off first, a missing day counts as no change", () => {
  const h = deriveFollowerHistory(1000, "2026-10-20", { "2026-10-17": 1, "2026-10-20": 5 });
  assert.deepEqual(h, [{ day: "2026-10-19", value: 995 }, { day: "2026-10-18", value: 995 }, { day: "2026-10-17", value: 995 }]);
});

test("nothing to derive from, and numbers that go below zero", () => {
  assert.deepEqual(deriveFollowerHistory(100, "2026-10-20", {}), []);
  assert.deepEqual(deriveFollowerHistory(100, "2026-10-20", { "2026-10-20": 2 }), []);
  assert.equal(deriveFollowerHistory(10, "2026-10-20", { "2026-10-17": 1, "2026-10-19": 50 }), null);
});

test("parse: end_time stamps the end of the day, so the day is the UTC date a day earlier; bad rows are ignored", () => {
  assert.equal(dayOfEndTime("2026-10-20T07:00:00+0000"), "2026-10-19");
  assert.equal(dayOfEndTime("nope"), null);
  assert.deepEqual(parseFollowerChanges({ data: [{ name: "follower_count", values: [{ value: 2, end_time: "2026-10-20T07:00:00+0000" }, { value: "x", end_time: "2026-10-21T07:00:00+0000" }, { value: 1 }] }] }), { "2026-10-19": 2 });
  assert.equal(parseFollowerChanges({ data: [{ name: "reach", values: [] }] }), null);
  assert.equal(parseFollowerChanges(null), null);
});
