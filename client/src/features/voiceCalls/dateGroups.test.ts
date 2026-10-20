import { test } from "node:test";
import assert from "node:assert/strict";
import { dateGroupKey, groupByDate } from "./dateGroups";

// Tuesday 20 October 2026, 10:00 in Amsterdam (08:00 UTC).
const now = new Date("2026-10-20T08:00:00Z");
const tz = "Europe/Amsterdam";

test("today, yesterday, this week, last week, then months", () => {
  assert.equal(dateGroupKey("2026-10-20T06:00:00Z", now, tz), "today");
  assert.equal(dateGroupKey("2026-10-19T12:00:00Z", now, tz), "yesterday");
  assert.equal(dateGroupKey("2026-10-18T12:00:00Z", now, tz), "lastWeek"); // Sunday: the week started Monday 19th
  assert.equal(dateGroupKey("2026-10-12T12:00:00Z", now, tz), "lastWeek");
  assert.equal(dateGroupKey("2026-10-11T12:00:00Z", now, tz), "2026-10");
  assert.equal(dateGroupKey("2026-09-30T12:00:00Z", now, tz), "2026-09");
});

test("the account timezone decides the day, not UTC", () => {
  // 23:30 UTC on the 19th is already the 20th in Amsterdam.
  assert.equal(dateGroupKey("2026-10-19T23:30:00Z", now, tz), "today");
  assert.equal(dateGroupKey("2026-10-19T23:30:00Z", now, "UTC"), "yesterday");
});

test("this week holds the days before yesterday since Monday", () => {
  const thu = new Date("2026-10-22T09:00:00Z");
  assert.equal(dateGroupKey("2026-10-19T09:00:00Z", thu, tz), "thisWeek");
  assert.equal(dateGroupKey("2026-10-21T09:00:00Z", thu, tz), "yesterday");
});

test("groups come out newest first with month labels in the UI language", () => {
  const items = ["2026-08-01T10:00:00Z", "2026-10-20T07:00:00Z", "2026-09-02T10:00:00Z", "2026-10-19T10:00:00Z"];
  const groups = groupByDate(items, (x) => x, { now, timeZone: tz, locale: "nl" });
  assert.deepEqual(groups.map((g) => g.key), ["today", "yesterday", "2026-09", "2026-08"]);
  assert.equal(groups[2].monthLabel, "September 2026");
  assert.equal(groups[0].monthLabel, null);
});
