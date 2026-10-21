import { test } from "node:test";
import assert from "node:assert/strict";
import { addDays, byDay, monthGrid, shiftMonth, startOfWeek, weekDays } from "./calendar";

test("day arithmetic across months, years and DST", () => {
  assert.equal(addDays("2026-10-31", 1), "2026-11-01");
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(addDays("2026-03-29", 1), "2026-03-30");
  assert.equal(addDays("2026-03-01", -1), "2026-02-28");
});

test("weeks start on Monday", () => {
  assert.equal(startOfWeek("2026-10-20"), "2026-10-19"); // a Tuesday
  assert.equal(startOfWeek("2026-10-25"), "2026-10-19"); // a Sunday
  assert.deepEqual(weekDays("2026-10-20"), ["2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23", "2026-10-24", "2026-10-25"]);
});

test("month grid: whole weeks, the month's days flagged", () => {
  const oct = monthGrid(2026, 9);
  assert.equal(oct[0][0].date, "2026-09-28");
  assert.equal(oct[0][3].date, "2026-10-01");
  assert.equal(oct[0][0].inMonth, false);
  assert.ok(oct.every((w) => w.length === 7));
  assert.equal(oct.flat().filter((d) => d.inMonth).length, 31);
  assert.equal(oct.at(-1)!.at(-1)!.date, "2026-11-01");
  // February 2027 starts on a Monday and has exactly 4 weeks.
  assert.equal(monthGrid(2027, 1).length, 4);
});

test("posts land on their day in the account's zone, sorted by time", () => {
  const posts = [
    { id: 2, scheduledAt: "2026-10-22T02:30:00Z" }, // 23:30 on the 21st in São Paulo
    { id: 1, scheduledAt: "2026-10-21T12:00:00Z" },
  ];
  const sp = byDay(posts, "America/Sao_Paulo");
  assert.deepEqual(sp.get("2026-10-21")?.map((p) => p.id), [1, 2]);
  assert.deepEqual(byDay(posts, "Europe/Amsterdam").get("2026-10-22")?.map((p) => p.id), [2]);
});

test("month shifting wraps the year", () => {
  assert.deepEqual(shiftMonth(2026, 11, 1), { year: 2027, month0: 0 });
  assert.deepEqual(shiftMonth(2026, 0, -1), { year: 2025, month0: 11 });
});
