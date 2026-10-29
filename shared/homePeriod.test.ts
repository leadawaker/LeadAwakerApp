import { test } from "node:test";
import assert from "node:assert/strict";
import { bucketOf, eachBucket, eachDay, isHomePeriod, periodDates, todayIn } from "./homePeriod";

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

test("week starts on Monday and compares with the same days of last week", () => {
  // 2026-10-28 is a Wednesday.
  assert.deepEqual(periodDates("week", "2026-10-28"),
    { from: "2026-10-26", to: "2026-10-29", prevFrom: "2026-10-19", prevTo: "2026-10-22" });
  // A Sunday still belongs to the week that began on Monday.
  assert.equal(periodDates("week", "2026-11-01").from, "2026-10-26");
  assert.equal(periodDates("week", "2026-10-26").from, "2026-10-26");
});

test("year: year to date, compared with the same days of last year", () => {
  assert.deepEqual(periodDates("year", "2026-02-10"),
    { from: "2026-01-01", to: "2026-02-11", prevFrom: "2025-01-01", prevTo: "2025-02-11" });
});

test("today is compared with yesterday", () => {
  assert.deepEqual(periodDates("today", "2026-03-01"),
    { from: "2026-03-01", to: "2026-03-02", prevFrom: "2026-02-28", prevTo: "2026-03-01" });
});

test("all starts at the first data and has nothing to compare with", () => {
  assert.deepEqual(periodDates("all", "2026-10-28", "2026-01-22"),
    { from: "2026-01-22", to: "2026-10-29", prevFrom: "2026-01-22", prevTo: "2026-01-22" });
  // No first date (or a future one): this month.
  assert.equal(periodDates("all", "2026-10-28").from, "2026-10-01");
  assert.equal(periodDates("all", "2026-10-28", "2027-01-01").from, "2026-10-01");
});

test("ranges never overlap", () => {
  for (const p of ["year", "month", "week", "today"] as const) {
    const d = periodDates(p, "2026-03-31");
    assert.ok(d.prevTo <= d.from, p);
    assert.ok(d.prevFrom < d.prevTo, p);
    assert.ok(d.from < d.to, p);
  }
});

test("buckets: month for all and year, day for month and week, hour for today", () => {
  assert.equal(bucketOf("all"), "month");
  assert.equal(bucketOf("year"), "month");
  assert.equal(bucketOf("month"), "day");
  assert.equal(bucketOf("week"), "day");
  assert.equal(bucketOf("today"), "hour");
});

test("eachBucket lists months from a mid-month start, and 24 hours a day", () => {
  assert.deepEqual(eachBucket("2025-11-20", "2026-02-03", "month"), ["2025-11", "2025-12", "2026-01", "2026-02"]);
  const hours = eachBucket("2026-10-28", "2026-10-29", "hour");
  assert.equal(hours.length, 24);
  assert.equal(hours[0], "2026-10-28 00");
  assert.equal(hours[23], "2026-10-28 23");
});

test("eachDay lists every date, end exclusive", () => {
  assert.deepEqual(eachDay("2026-02-27", "2026-03-02"), ["2026-02-27", "2026-02-28", "2026-03-01"]);
});

test("todayIn uses the account's timezone, not UTC", () => {
  assert.equal(todayIn("Europe/Amsterdam", new Date("2026-10-11T22:30:00Z")), "2026-10-12");
  assert.equal(todayIn("America/Sao_Paulo", new Date("2026-10-12T01:00:00Z")), "2026-10-11");
});

test("isHomePeriod rejects junk and the retired periods", () => {
  assert.equal(isHomePeriod("week"), true);
  assert.equal(isHomePeriod("all"), true);
  assert.equal(isHomePeriod("7d"), false);
  assert.equal(isHomePeriod(undefined), false);
});
