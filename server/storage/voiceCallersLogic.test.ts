import { test } from "node:test";
import assert from "node:assert/strict";
import { bestOutcome, isDnd, isOutOfHours, rankOutcome } from "./voiceCallersLogic";

test("rank: booked > transferred > callback > other > hung_up", () => {
  const order = ["booked", "transferred", "callback", "other", "hung_up"] as const;
  for (let i = 0; i < order.length - 1; i++) {
    assert.ok(rankOutcome(order[i]) > rankOutcome(order[i + 1]), `${order[i]} > ${order[i + 1]}`);
  }
});

test("best: picks the highest ranked outcome", () => {
  assert.equal(bestOutcome(["hung_up", "callback", "other"]), "callback");
  assert.equal(bestOutcome(["other", "booked", "transferred"]), "booked");
  assert.equal(bestOutcome(["hung_up"]), "hung_up");
});

test("best: empty list gives other", () => {
  assert.equal(bestOutcome([]), "other");
});

const ams = { start: "09:00:00", end: "17:00:00", openDays: [1, 2, 3, 4, 5], timezone: "Europe/Amsterdam" };

test("hours: inside opening hours on a weekday is not out of hours", () => {
  // Tue 2026-10-06 10:00 UTC = 12:00 Amsterdam (CEST, UTC+2)
  assert.equal(isOutOfHours(ams, new Date("2026-10-06T10:00:00Z")), false);
});

test("hours: timezone matters (UTC time inside, local time outside)", () => {
  // 15:30 UTC = 17:30 Amsterdam: closed, though 15:30 would be open in UTC
  assert.equal(isOutOfHours(ams, new Date("2026-10-06T15:30:00Z")), true);
  // 07:30 UTC = 09:30 Amsterdam: open, though 07:30 would be closed in UTC
  assert.equal(isOutOfHours(ams, new Date("2026-10-06T07:30:00Z")), false);
  // Same instant, account in Sao Paulo (UTC-3): 04:30 local, closed
  assert.equal(isOutOfHours({ ...ams, timezone: "America/Sao_Paulo" }, new Date("2026-10-06T07:30:00Z")), true);
});

test("hours: end boundary is closed, start boundary is open", () => {
  assert.equal(isOutOfHours(ams, new Date("2026-10-06T15:00:00Z")), true); // 17:00 local
  assert.equal(isOutOfHours(ams, new Date("2026-10-06T07:00:00Z")), false); // 09:00 local
});

test("hours: closed day is out of hours", () => {
  // Sun 2026-10-04 12:00 Amsterdam
  assert.equal(isOutOfHours(ams, new Date("2026-10-04T10:00:00Z")), true);
  // Sunday open when 0 is in open_days
  assert.equal(isOutOfHours({ ...ams, openDays: [0, 1, 2, 3, 4, 5, 6] }, new Date("2026-10-04T10:00:00Z")), false);
});

test("hours: the weekday is taken in the account timezone", () => {
  // Mon 2026-10-05 02:00 UTC is still Sunday 2026-10-04 in Sao Paulo (23:00)
  const sp = { start: "00:00", end: "23:59", openDays: [1, 2, 3, 4, 5], timezone: "America/Sao_Paulo" };
  assert.equal(isOutOfHours(sp, new Date("2026-10-05T02:00:00Z")), true);
});

test("hours: numeric-string days and HH:MM times parse", () => {
  const h = { start: "9:00", end: "17:30", openDays: ["1", "2"], timezone: "Europe/Amsterdam" };
  assert.equal(isOutOfHours(h, new Date("2026-10-06T15:15:00Z")), false); // Tue 17:15
});

test("hours: overnight window wraps past midnight", () => {
  const night = { start: "22:00", end: "06:00", openDays: null, timezone: "UTC" };
  assert.equal(isOutOfHours(night, new Date("2026-10-06T23:00:00Z")), false);
  assert.equal(isOutOfHours(night, new Date("2026-10-06T03:00:00Z")), false);
  assert.equal(isOutOfHours(night, new Date("2026-10-06T12:00:00Z")), true);
});

test("hours: missing open_days checks the hours only", () => {
  assert.equal(isOutOfHours({ ...ams, openDays: null }, new Date("2026-10-04T10:00:00Z")), false);
  assert.equal(isOutOfHours({ ...ams, openDays: undefined }, new Date("2026-10-04T20:00:00Z")), true);
});

test("hours: unknown or garbage values give false, never throw", () => {
  const now = new Date("2026-10-04T23:00:00Z"); // Sunday night: out of hours if it were known
  const garbage: Array<Record<string, unknown>> = [
    { start: null, end: null, openDays: null, timezone: null },
    { ...ams, start: null },
    { ...ams, end: "late" },
    { ...ams, start: "25:00" },
    { ...ams, start: 900 },
    { ...ams, start: "17:00", end: "17:00" },
    { ...ams, timezone: "Not/AZone" },
    { ...ams, timezone: null },
    { ...ams, timezone: 42 },
    { ...ams, openDays: "weekdays" },
    { ...ams, openDays: [] },
    { ...ams, openDays: ["x", 9, null] },
    { ...ams, openDays: { mon: true } },
  ];
  for (const g of garbage) {
    const h = g as { start: unknown; end: unknown; openDays: unknown; timezone: unknown };
    assert.equal(isOutOfHours(h, now), false, JSON.stringify(g));
  }
  assert.equal(isOutOfHours(ams, new Date("invalid")), false);
});

test("dnd: opted out, dnc reason or DND status", () => {
  const none = { optedOut: null, dncReason: null, conversionStatus: null };
  assert.equal(isDnd(none), false);
  assert.equal(isDnd({ ...none, optedOut: false, dncReason: "", conversionStatus: "Booked" }), false);
  assert.equal(isDnd({ ...none, dncReason: "   " }), false);
  assert.equal(isDnd({ ...none, optedOut: true }), true);
  assert.equal(isDnd({ ...none, dncReason: "asked to stop" }), true);
  assert.equal(isDnd({ ...none, conversionStatus: "DND" }), true);
  assert.equal(isDnd({ ...none, conversionStatus: "dnd" }), true);
  assert.equal(isDnd({ ...none, optedOut: "yes" }), false);
});
