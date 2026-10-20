import { test } from "node:test";
import assert from "node:assert/strict";
import { refreshDecision, shouldWarnExpiry } from "./tokenRules";

const now = new Date("2026-10-19T12:00:00Z");
const days = (n: number) => new Date(now.getTime() + n * 86_400_000);
test("refresh when expiring within 20 days and at least 24h old", () => {
  assert.equal(refreshDecision({ status: "connected", tokenExpiresAt: days(19), tokenRefreshedAt: days(-41), createdAt: days(-41) }, now), "refresh");
});
test("skip when more than 20 days left", () => {
  assert.equal(refreshDecision({ status: "connected", tokenExpiresAt: days(21), tokenRefreshedAt: days(-39), createdAt: days(-39) }, now), "skip");
});
test("skip when token younger than 24h", () => {
  assert.equal(refreshDecision({ status: "connected", tokenExpiresAt: days(10), tokenRefreshedAt: new Date(now.getTime() - 3_600_000), createdAt: days(-50) }, now), "skip");
});
test("expired token is expired", () => {
  assert.equal(refreshDecision({ status: "connected", tokenExpiresAt: days(-1), tokenRefreshedAt: days(-61), createdAt: days(-61) }, now), "expired");
});
test("disconnected is skipped", () => {
  assert.equal(refreshDecision({ status: "disconnected", tokenExpiresAt: days(5), tokenRefreshedAt: days(-55), createdAt: days(-55) }, now), "skip");
});
test("warn within 7 days, at most once a day", () => {
  assert.equal(shouldWarnExpiry({ status: "needs_attention", tokenExpiresAt: days(6), expiryWarnedAt: null }, now), true);
  assert.equal(shouldWarnExpiry({ status: "needs_attention", tokenExpiresAt: days(6), expiryWarnedAt: new Date(now.getTime() - 3_600_000) }, now), false);
  assert.equal(shouldWarnExpiry({ status: "connected", tokenExpiresAt: days(8), expiryWarnedAt: null }, now), false);
});
