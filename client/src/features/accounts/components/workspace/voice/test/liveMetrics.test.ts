import { test } from "node:test";
import assert from "node:assert/strict";
import {
  eventToTool, formatClock, formatCost, formatDelay, newestFirst, pairAgentDelays, replyDelay, runningCost,
} from "./liveMetrics";

test("runningCost is elapsed minutes times the per-minute rate", () => {
  assert.ok(Math.abs(runningCost(90_000, 0.09) - 0.135) < 1e-9);
  assert.equal(runningCost(0, 0.09), 0);
});

test("runningCost never goes negative or non-finite", () => {
  assert.equal(runningCost(-5_000, 0.09), 0);
  assert.equal(runningCost(60_000, -1), 0);
  assert.equal(runningCost(Number.NaN, 0.09), 0);
});

test("replyDelay is null when either time is missing", () => {
  assert.equal(replyDelay(null, 1000), null);
  assert.equal(replyDelay(1000, null), null);
  assert.equal(replyDelay(null, null), null);
  assert.equal(replyDelay(undefined, 5), null);
});

test("replyDelay is the gap and never negative", () => {
  assert.equal(replyDelay(1000, 1800), 800);
  assert.equal(replyDelay(2000, 1500), 0);
  assert.equal(replyDelay(1000, 1000), 0);
});

test("formatDelay marks the value as approximate", () => {
  assert.equal(formatDelay(800), "≈ 0.8 s");
  assert.equal(formatDelay(1250), "≈ 1.3 s");
  assert.equal(formatDelay(0), "≈ 0.0 s");
});

test("formatClock is m:ss and tolerates no start", () => {
  assert.equal(formatClock(0), "0:00");
  assert.equal(formatClock(65_400), "1:05");
  assert.equal(formatClock(3_725_000), "62:05");
  assert.equal(formatClock(null), "0:00");
  assert.equal(formatClock(-3), "0:00");
});

test("formatCost uses three decimals under a dollar, two above", () => {
  assert.equal(formatCost(0.135), "$0.135");
  assert.equal(formatCost(0), "$0.000");
  assert.equal(formatCost(2.5), "$2.50");
});

test("newestFirst puts the newest line on top without touching the input", () => {
  const input = [1, 2, 3];
  assert.deepEqual(newestFirst(input), [3, 2, 1]);
  assert.deepEqual(input, [1, 2, 3]);
  assert.deepEqual(newestFirst([]), []);
});

test("eventToTool names the tool, shortens the result and keeps the engine ms", () => {
  const t = eventToTool({ id: 7, kind: "tool", toolName: "check_availability", status: "ok", error: null, result: { slots: ["a"] }, latencyMs: 412 });
  assert.deepEqual(t, { id: 7, name: "check_availability", result: '{"slots":["a"]}', ms: 412, failed: false });
});

test("eventToTool falls back to the kind, shows errors and truncates long results", () => {
  const e = eventToTool({ id: 1, kind: "delegation", toolName: null, status: "error", error: "timeout", result: null, latencyMs: null });
  assert.equal(e.name, "delegation");
  assert.equal(e.result, "timeout");
  assert.equal(e.ms, null);
  assert.equal(e.failed, true);
  const long = eventToTool({ id: 2, kind: "tool", toolName: "x", status: "ok", error: null, result: "y".repeat(500), latencyMs: 1 });
  assert.ok(long.result.length <= 120);
  assert.ok(long.result.endsWith("…"));
});

test("pairAgentDelays gives each agent line after the greeting the next delay, in order", () => {
  const lines = [{ role: "agent" }, { role: "user" }, { role: "agent" }, { role: "user" }, { role: "agent" }] as const;
  assert.deepEqual(pairAgentDelays(lines, [800, 1200]), [null, null, 800, null, 1200]);
});

test("pairAgentDelays: a caller-first call pairs from the first agent line, and missing delays are null", () => {
  const lines = [{ role: "user" }, { role: "agent" }, { role: "user" }, { role: "agent" }] as const;
  assert.deepEqual(pairAgentDelays(lines, [500]), [null, 500, null, null]);
  assert.deepEqual(pairAgentDelays([], [1]), []);
});
