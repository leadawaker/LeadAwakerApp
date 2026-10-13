import { test } from "node:test";
import assert from "node:assert/strict";
import { eachDay, isHomePeriod, periodDates, todayIn } from "./homePeriod";

test("month: month to date, compared with the same days of the previous month", () => {
  assert.deepEqual(periodDates("month", "2026-10-12"),
    { from: "2026-10-01", to: "2026-10-13", prevFrom: "2026-09-01", prevTo: "2026-09-13" });
});

test("month on 1 January reaches back into December of the previous year", () => {
  assert.deepEqual(periodDates("month", "2026-01-01"),
    { from: "2026-01-01", to: "2026-01-02", prevFrom: "2025-12-01", prevTo: "2025-12-02" });
});

test("month: a 31-day month never compares past the end of a shorter one", () => {
  const p = periodDates("month", "2026-03-31");
  assert.equal(p.prevFrom, "2026-02-01");
  assert.equal(p.prevTo, "2026-03-01");
});

test("7d: today and the six days before, compared with the seven before that", () => {
  assert.deepEqual(periodDates("7d", "2026-10-12"),
    { from: "2026-10-06", to: "2026-10-13", prevFrom: "2026-09-29", prevTo: "2026-10-06" });
});

test("30d", () => {
  assert.deepEqual(periodDates("30d", "2026-10-12"),
    { from: "2026-09-13", to: "2026-10-13", prevFrom: "2026-08-14", prevTo: "2026-09-13" });
});

test("last_month in January is December, compared with November", () => {
  assert.deepEqual(periodDates("last_month", "2026-01-15"),
    { from: "2025-12-01", to: "2026-01-01", prevFrom: "2025-11-01", prevTo: "2025-12-01" });
});

test("ranges never overlap", () => {
  for (const p of ["month", "7d", "30d", "last_month"] as const) {
    const d = periodDates(p, "2026-03-31");
    assert.ok(d.prevTo <= d.from, p);
    assert.ok(d.prevFrom < d.prevTo, p);
    assert.ok(d.from < d.to, p);
  }
});

test("eachDay lists every date, end exclusive", () => {
  assert.deepEqual(eachDay("2026-02-27", "2026-03-02"), ["2026-02-27", "2026-02-28", "2026-03-01"]);
});

test("todayIn uses the account's timezone, not UTC", () => {
  assert.equal(todayIn("Europe/Amsterdam", new Date("2026-10-11T22:30:00Z")), "2026-10-12");
  assert.equal(todayIn("America/Sao_Paulo", new Date("2026-10-12T01:00:00Z")), "2026-10-11");
});

test("isHomePeriod rejects junk", () => {
  assert.equal(isHomePeriod("7d"), true);
  assert.equal(isHomePeriod("year"), false);
  assert.equal(isHomePeriod(undefined), false);
});
