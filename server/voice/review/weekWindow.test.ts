import { test } from "node:test";
import assert from "node:assert/strict";
import { amsterdamToUtc, dayRange, dueWeek, lastDays } from "./weekWindow";

test("the Monday after DST ended: week 43 is due at 07:00 Amsterdam, window spans the clock change", () => {
  const w = dueWeek(new Date("2026-10-26T06:30:00Z")); // Mon 07:30 CET
  assert.equal(w.weekKey, "2026-W43");
  assert.equal(w.periodStart.toISOString(), "2026-10-18T22:00:00.000Z");
  assert.equal(w.periodEnd.toISOString(), "2026-10-25T23:00:00.000Z");
});

test("Monday before 07:00 Amsterdam: last week is not due yet", () => {
  const before = dueWeek(new Date("2026-10-26T05:30:00Z")); // Mon 06:30 CET
  assert.equal(before.weekKey, "2026-W42");
  assert.equal(before.periodStart.toISOString(), "2026-10-11T22:00:00.000Z");
  assert.equal(before.periodEnd.toISOString(), "2026-10-18T22:00:00.000Z");
});

test("the due moment itself is inclusive, one millisecond earlier is not", () => {
  assert.equal(dueWeek(new Date("2026-10-26T06:00:00.000Z")).weekKey, "2026-W43");
  assert.equal(dueWeek(new Date("2026-10-26T05:59:59.999Z")).weekKey, "2026-W42");
});

test("midweek and Sunday still point at the last finished week", () => {
  assert.equal(dueWeek(new Date("2026-10-28T12:00:00Z")).weekKey, "2026-W43");
  assert.equal(dueWeek(new Date("2026-11-01T22:30:00Z")).weekKey, "2026-W43"); // Sun 23:30 CET
});

test("year end: 2026 has 53 weeks and the window starts in December", () => {
  const ny = dueWeek(new Date("2027-01-04T08:00:00Z"));
  assert.equal(ny.weekKey, "2026-W53");
  assert.equal(ny.periodStart.toISOString(), "2026-12-27T23:00:00.000Z");
  assert.equal(ny.periodEnd.toISOString(), "2027-01-03T23:00:00.000Z");
});

test("a week that starts in the previous calendar year takes its ISO year from Thursday", () => {
  const w = dueWeek(new Date("2025-01-06T10:00:00Z")); // week of Mon 30 Dec 2024 is 2025-W01
  assert.equal(w.weekKey, "2025-W01");
  assert.equal(w.periodStart.toISOString(), "2024-12-29T23:00:00.000Z");
});

test("spring forward: the window ends after the clock change and is one hour short", () => {
  const w = dueWeek(new Date("2026-03-30T06:00:00Z")); // Mon 08:00 CEST, DST began Sun 29 Mar
  assert.equal(w.weekKey, "2026-W13");
  assert.equal(w.periodStart.toISOString(), "2026-03-22T23:00:00.000Z");
  assert.equal(w.periodEnd.toISOString(), "2026-03-29T22:00:00.000Z");
});

test("amsterdamToUtc converts wall clock in summer and winter time", () => {
  assert.equal(amsterdamToUtc(2026, 7, 1, 7).toISOString(), "2026-07-01T05:00:00.000Z");
  assert.equal(amsterdamToUtc(2026, 1, 15, 0).toISOString(), "2026-01-14T23:00:00.000Z");
  assert.equal(amsterdamToUtc(2026, 10, 26, 0).toISOString(), "2026-10-25T23:00:00.000Z");
});

test("lastDays is a plain rolling window ending now", () => {
  const l = lastDays(new Date("2026-10-26T12:00:00Z"));
  assert.equal(l.periodStart.toISOString(), "2026-10-19T12:00:00.000Z");
  assert.equal(l.periodEnd.toISOString(), "2026-10-26T12:00:00.000Z");
  assert.equal(lastDays(new Date("2026-10-26T12:00:00Z"), 3).periodStart.toISOString(), "2026-10-23T12:00:00.000Z");
});

test("a picked range covers whole Amsterdam days, both ends included", () => {
  const r = dayRange("2026-10-24", "2026-10-26", new Date("2026-10-26T10:00:00Z"));
  assert.ok(r.ok);
  assert.equal(r.periodStart.toISOString(), "2026-10-23T22:00:00.000Z"); // summer time
  assert.equal(r.periodEnd.toISOString(), "2026-10-26T23:00:00.000Z"); // winter time
});

test("a single day is a range of one day", () => {
  const r = dayRange("2026-10-24", "2026-10-24", new Date("2026-10-26T10:00:00Z"));
  assert.ok(r.ok);
  assert.equal(r.periodEnd.getTime() - r.periodStart.getTime(), 24 * 3_600_000);
});

test("bad ranges are refused with a reason", () => {
  const now = new Date("2026-10-26T10:00:00Z");
  assert.deepEqual(dayRange("2026-10-26", "2026-10-24", now), { ok: false, reason: "order" });
  assert.deepEqual(dayRange("2026-02-30", "2026-03-02", now), { ok: false, reason: "invalid" });
  assert.deepEqual(dayRange("26-10-2026", "2026-10-26", now), { ok: false, reason: "invalid" });
  assert.deepEqual(dayRange(undefined, "2026-10-26", now), { ok: false, reason: "invalid" });
  assert.deepEqual(dayRange("2026-10-28", "2026-10-29", now), { ok: false, reason: "future" });
  assert.deepEqual(dayRange("2026-01-01", "2026-10-26", now), { ok: false, reason: "too_long" });
  assert.ok(dayRange("2026-07-27", "2026-10-26", now).ok); // 92 days
});
