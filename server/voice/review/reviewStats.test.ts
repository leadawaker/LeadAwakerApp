import { test } from "node:test";
import assert from "node:assert/strict";
import { computeStats, pickTranscriptCalls, problemScore, type ReviewCallRow } from "./reviewStats";

const row = (o: Partial<ReviewCallRow> = {}): ReviewCallRow => ({
  callId: "el_x", startedAt: "2026-10-20T10:00:00Z", endedAt: "2026-10-20T10:02:00Z", outcome: "booked", endReason: "goodbye",
  costUsd: 0.1, latencyMs: 900, latencyP90Ms: 1500, toolErrors: 0, ...o,
});
const ok = (id: string, date: string) => row({ callId: id, startedAt: date, outcome: "booked", endReason: "goodbye", toolErrors: 0 });
const bad = (id: string, date: string) => row({ callId: id, startedAt: date, outcome: "hung_up", toolErrors: 1 });

test("computeStats counts outcomes and end reasons, averages latency, sums cost and minutes", () => {
  const s = computeStats([
    row({ outcome: "booked", endReason: "goodbye", latencyMs: 800, latencyP90Ms: 1500, costUsd: 0.12, startedAt: "2026-10-20T10:00:00Z", endedAt: "2026-10-20T10:03:00Z" }),
    row({ outcome: null, endReason: null, latencyMs: 1200, latencyP90Ms: 3000, costUsd: 0.2049, startedAt: "2026-10-21T10:00:00Z", endedAt: null }),
  ]);
  assert.deepEqual(s.byOutcome, { booked: 1, unknown: 1 });
  assert.deepEqual(s.byEndReason, { goodbye: 1, unknown: 1 });
  assert.equal(s.latencyAvgMs, 1000);
  assert.equal(s.latencyP90Ms, 3000);
  assert.equal(s.costUsd, 0.32);
  assert.equal(s.minutes, 3);
  assert.equal(s.calls, 2);
});

test("computeStats of no calls is all zero and null", () => {
  assert.deepEqual(computeStats([]), { calls: 0, byOutcome: {}, byEndReason: {}, latencyAvgMs: null, latencyP90Ms: null, costUsd: 0, minutes: 0 });
});

test("latency ignores null values and is null when there are none", () => {
  const s = computeStats([row({ latencyMs: null, latencyP90Ms: null }), row({ latencyMs: 701, latencyP90Ms: 2000 }), row({ latencyMs: 1000, latencyP90Ms: null })]);
  assert.equal(s.latencyAvgMs, 851);
  assert.equal(s.latencyP90Ms, 2000);
  const none = computeStats([row({ latencyMs: null, latencyP90Ms: null })]);
  assert.equal(none.latencyAvgMs, null);
  assert.equal(none.latencyP90Ms, null);
});

test("p90 is nearest rank", () => {
  const ten = Array.from({ length: 10 }, (_, i) => row({ latencyP90Ms: (i + 1) * 100 }));
  assert.equal(computeStats(ten).latencyP90Ms, 900);
  const eleven = Array.from({ length: 11 }, (_, i) => row({ latencyP90Ms: (i + 1) * 100 }));
  assert.equal(computeStats(eleven).latencyP90Ms, 1000);
  assert.equal(computeStats([row({ latencyP90Ms: 400 })]).latencyP90Ms, 400);
});

test("null cost counts as zero and minutes round to one decimal", () => {
  const s = computeStats([
    row({ costUsd: null, startedAt: "2026-10-20T10:00:00Z", endedAt: "2026-10-20T10:01:20Z" }),
    row({ costUsd: 0.01, startedAt: "2026-10-20T11:00:00Z", endedAt: "2026-10-20T11:00:10Z" }),
  ]);
  assert.equal(s.costUsd, 0.01);
  assert.equal(s.minutes, 1.5);
});

test("problemScore adds up outcome, end reason, tool error and latency signals", () => {
  assert.equal(problemScore(row()), 0);
  assert.equal(problemScore(row({ outcome: null })), 2);
  assert.equal(problemScore(row({ outcome: "hung_up" })), 2);
  assert.equal(problemScore(row({ outcome: "other" })), 2);
  assert.equal(problemScore(row({ outcome: "info_only" })), 0);
  for (const r of ["silence", "lost", "caller_hung_up", "time_limit", "no_greeting"]) assert.equal(problemScore(row({ endReason: r })), 2, r);
  assert.equal(problemScore(row({ endReason: null })), 0);
  assert.equal(problemScore(row({ toolErrors: 3 })), 2);
  assert.equal(problemScore(row({ latencyP90Ms: 2501 })), 1);
  assert.equal(problemScore(row({ latencyP90Ms: 2500 })), 0);
  assert.equal(problemScore(row({ latencyP90Ms: null })), 0);
  assert.equal(problemScore(row({ outcome: null, endReason: "silence", toolErrors: 1, latencyP90Ms: 4000 })), 7);
});

test("pickTranscriptCalls puts a hung up call with a tool error before a newer booked one and respects max", () => {
  assert.deepEqual(pickTranscriptCalls([ok("el_a", "2026-10-22"), bad("el_b", "2026-10-20")], 1), ["el_b"]);
  assert.deepEqual(pickTranscriptCalls([ok("el_a", "2026-10-22"), bad("el_b", "2026-10-20")], 5), ["el_b", "el_a"]);
  assert.deepEqual(pickTranscriptCalls([ok("el_a", "2026-10-22")], 0), []);
});

test("pickTranscriptCalls breaks score ties by newest first and does not reorder the input", () => {
  const input = [ok("el_old", "2026-10-20T10:00:00Z"), ok("el_new", "2026-10-22T10:00:00Z"), ok("el_mid", "2026-10-21T10:00:00Z")];
  assert.deepEqual(pickTranscriptCalls(input, 3), ["el_new", "el_mid", "el_old"]);
  assert.deepEqual(input.map((c) => c.callId), ["el_old", "el_new", "el_mid"]);
});
