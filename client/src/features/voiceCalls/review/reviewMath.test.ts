import { test } from "node:test";
import assert from "node:assert/strict";
import {
  activeTurnIndex, clampTime, costParts, formatCost, formatReviewDelay, formatUsd, markerLeftPct, nextSpeed, nextZoom,
  REVIEW_SPEEDS, scaleTicks, stillProcessing, type CallReview, type ReviewCost,
} from "./reviewMath";

const cost = (over: Partial<ReviewCost> = {}): ReviewCost => ({
  total: 0.1234, minutes: 1.5, ai: 0.08, recap: 0.0034, telephony: 0.04, estimate: true, ...over,
});

test("markerLeftPct is the share of the call, clamped to 0..100", () => {
  assert.equal(markerLeftPct(-1, 60), 0);
  assert.equal(markerLeftPct(90, 60), 100);
  assert.equal(markerLeftPct(30, 60), 50);
  assert.equal(markerLeftPct(5, 0), 0);
});

test("markerLeftPct is 0 for unusable input", () => {
  assert.equal(markerLeftPct(Number.NaN, 60), 0);
  assert.equal(markerLeftPct(10, Number.NaN), 0);
  assert.equal(markerLeftPct(10, -5), 0);
});

test("formatCost marks an estimate with the approximate sign", () => {
  assert.equal(formatCost(cost(), "n/a"), "≈ $0.12");
  assert.equal(formatCost(cost({ total: 2.5, estimate: false }), "n/a"), "$2.50");
});

test("formatCost without a cost is the locale's label, never a dash", () => {
  assert.equal(formatCost(null, "n/a"), "n/a");
  assert.equal(formatCost(undefined, "unknown"), "unknown");
  assert.equal(formatCost(cost({ total: Number.NaN }), "n/a"), "n/a");
});

test("formatUsd shows small parts with three decimals", () => {
  assert.equal(formatUsd(0.0034), "$0.003");
  assert.equal(formatUsd(0.08), "$0.08");
  assert.equal(formatUsd(1.234), "$1.23");
});

test("costParts lists the breakdown and leaves out zero parts", () => {
  assert.deepEqual(costParts(cost()), [
    { key: "ai", usd: 0.08 }, { key: "telephony", usd: 0.04 }, { key: "recap", usd: 0.0034 },
  ]);
  assert.deepEqual(costParts(cost({ telephony: 0 })).map((p) => p.key), ["ai", "recap"]);
  assert.deepEqual(costParts(null), []);
});

test("formatReviewDelay is approximate seconds, or the label when unknown", () => {
  assert.equal(formatReviewDelay(820, "n/a"), "≈ 0.8 s");
  assert.equal(formatReviewDelay(null, "n/a"), "n/a");
});

test("clampTime keeps a skip inside the recording", () => {
  assert.equal(clampTime(-4, 60), 0);
  assert.equal(clampTime(75, 60), 60);
  assert.equal(clampTime(12.5, 60), 12.5);
  assert.equal(clampTime(5, 0), 0);
});

test("activeTurnIndex is the last line that has started", () => {
  const turns = [{ atS: 0 }, { atS: 4 }, { atS: 9.5 }];
  assert.equal(activeTurnIndex(turns, 0), 0);
  assert.equal(activeTurnIndex(turns, 5), 1);
  assert.equal(activeTurnIndex(turns, 30), 2);
  assert.equal(activeTurnIndex([{ atS: 2 }], 1), -1);
  assert.equal(activeTurnIndex([], 3), -1);
});

test("the speeds are the four the review offers", () => {
  assert.deepEqual([...REVIEW_SPEEDS], [1, 1.25, 1.5, 2]);
});

test("nextZoom steps through the levels and stops at the ends", () => {
  assert.equal(nextZoom(0, 1), 1);
  assert.equal(nextZoom(1, -1), 0);
  assert.equal(nextZoom(0, -1), 0);
  assert.equal(nextZoom(3, 1), 3);
});

const reviewOf = (over: Partial<CallReview> = {}): CallReview => ({
  callId: "el_conv_1", engine: "elevenlabs", startedAt: "2026-10-24T10:00:00.000Z", durationSeconds: 60,
  recordingUrl: null, stereo: false, turns: [{ i: 0, role: "agent", text: "Hi", atS: 0.5, delayMs: null }], tools: [],
  summary: { medianDelayMs: null, slowestDelayMs: null, toolCount: 0 }, cost: cost(), ...over,
});
// The call above ended at 10:01:00.
const after = (s: number) => new Date("2026-10-24T10:01:00.000Z").getTime() + s * 1000;

test("stillProcessing while turns or cost are missing, up to 3 minutes after the call ended", () => {
  assert.equal(stillProcessing(reviewOf({ turns: [] }), after(30)), true);
  assert.equal(stillProcessing(reviewOf({ cost: null }), after(150)), true);
  assert.equal(stillProcessing(reviewOf({ turns: [], cost: null }), after(179)), true);
  assert.equal(stillProcessing(reviewOf({ turns: [] }), after(181)), false);
  assert.equal(stillProcessing(reviewOf(), after(30)), false);
  assert.equal(stillProcessing(reviewOf({ startedAt: "nope", turns: [] }), after(30)), false);
});

test("stillProcessing: no turns and no duration yet counts from the first fetch, not the call's start", () => {
  // A 3.5 minute ElevenLabs test: ended_at (so the duration) only lands at wrap-up.
  const now = new Date("2026-10-24T10:03:30.000Z").getTime();
  const waiting = reviewOf({ turns: [], cost: null, durationSeconds: 0 });
  assert.equal(stillProcessing(waiting, now, { firstSeenMs: now - 10_000 }), true);
  assert.equal(stillProcessing(waiting, now + 2.9 * 60_000, { firstSeenMs: now }), true);
  assert.equal(stillProcessing(waiting, now + 3.1 * 60_000, { firstSeenMs: now }), false);
  // An old call that never got a duration does not poll when it is opened later.
  assert.equal(stillProcessing(waiting, now + 2 * 3600_000, { firstSeenMs: now + 2 * 3600_000 }), false);
});

test("stillProcessing: a missing cost only waits when the viewer gets one (Owner)", () => {
  assert.equal(stillProcessing(reviewOf({ cost: null }), after(30), { costExpected: false }), false);
  assert.equal(stillProcessing(reviewOf({ cost: null }), after(30), { costExpected: true }), true);
  assert.equal(stillProcessing(reviewOf({ turns: [], cost: null }), after(30), { costExpected: false }), true);
});

test("nextSpeed cycles through the speeds and wraps", () => {
  assert.equal(nextSpeed(1), 1.25);
  assert.equal(nextSpeed(2), 1);
  assert.equal(nextSpeed(3), REVIEW_SPEEDS[0]);
});

test("scaleTicks picks a round step for the part in view", () => {
  assert.deepEqual(scaleTicks(0, 90), { step: 15, ticks: [0, 15, 30, 45, 60, 75, 90] });
  assert.deepEqual(scaleTicks(12, 30), { step: 5, ticks: [15, 20, 25, 30] });
  assert.deepEqual(scaleTicks(0, 0), { step: 1, ticks: [] });
});

test("activeTurnIndex is not stopped by a line out of time order", () => {
  const turns = [{ atS: 4 }, { atS: 14 }, { atS: 12 }];
  assert.equal(activeTurnIndex(turns, 13), 2);
  assert.equal(activeTurnIndex(turns, 15), 1);
});
