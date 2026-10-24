import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildCallReview, callEngine, costIsCurrent, recapOf,
  type ReviewCall, type ReviewEvent, type ReviewTurn,
} from "./voiceCallReview";

const START = "2026-10-23T10:00:00.000Z";
const at = (s: number) => new Date(new Date(START).getTime() + s * 1000).toISOString();

const GPT: ReviewCall = { callId: "live_call_1", sessionId: "live_abc", startedAt: START, recordingStartedAt: null, durationSeconds: 60 };
const ELEVEN: ReviewCall = { callId: "el_conv_x1", sessionId: "el_conv_x1", startedAt: START, recordingStartedAt: at(1), durationSeconds: 90 };

const turn = (direction: "inbound" | "outbound", content: string, createdS: number, spokenS: number | null = null, kind: string | null = null): ReviewTurn => ({
  direction, content, createdAt: at(createdS), spokenAt: spokenS === null ? null : at(spokenS), kind,
});

const event = (over: Partial<ReviewEvent> = {}): ReviewEvent => ({
  kind: "tool", toolName: "check_availability", status: "ok", error: null,
  args: { day: "monday" }, result: { slots: ["10:00"] }, startedAt: at(12), latencyMs: 340, ...over,
});

test("engine comes from the call id prefix", () => {
  assert.equal(callEngine("el_conv_1", null), "elevenlabs");
  assert.equal(callEngine("x", "el_conv_1"), "elevenlabs");
  assert.equal(callEngine("live_1", "live_s"), "gpt-live");
  assert.equal(callEngine("call_1", null), "gpt-live");
});

test("median and slowest ignore null delays", () => {
  const turns = [
    turn("inbound", "a", 1), turn("outbound", "b", 3), turn("inbound", "c", 5),
    turn("outbound", "d", 7), turn("inbound", "e", 9), turn("outbound", "f", 11),
  ];
  const metrics = { turns: [
    { i: 0, role: "caller", at_s: 1, delay_ms: null },
    { i: 1, role: "agent", at_s: 3, delay_ms: 900 },
    { i: 2, role: "caller", at_s: 5, delay_ms: null },
    { i: 3, role: "agent", at_s: 7, delay_ms: 500 },
    { i: 4, role: "caller", at_s: 9, delay_ms: null },
    { i: 5, role: "agent", at_s: 11, delay_ms: 1700 },
  ] };
  const r = buildCallReview(GPT, turns, [], metrics);
  assert.equal(r.summary.medianDelayMs, 900);
  assert.equal(r.summary.slowestDelayMs, 1700);
  assert.deepEqual(r.turns.map((t) => t.delayMs), [null, 900, null, 500, null, 1700]);
});

test("an even count of delays takes the middle pair's mean", () => {
  const turns = [turn("inbound", "a", 1), turn("outbound", "b", 3), turn("inbound", "c", 5), turn("outbound", "d", 7)];
  const metrics = { turns: [
    { i: 0, role: "caller" }, { i: 1, role: "agent", delay_ms: 800 },
    { i: 2, role: "caller" }, { i: 3, role: "agent", delay_ms: 1000 },
  ] };
  assert.equal(buildCallReview(GPT, turns, [], metrics).summary.medianDelayMs, 900);
});

test("no delays at all gives null summary figures", () => {
  const r = buildCallReview(GPT, [turn("inbound", "hi", 1)], [], null);
  assert.equal(r.summary.medianDelayMs, null);
  assert.equal(r.summary.slowestDelayMs, null);
});

test("args and result are cut to 120 characters", () => {
  const long = "x".repeat(500);
  const r = buildCallReview(GPT, [], [event({ args: { note: long }, result: long })], null);
  assert.equal(r.tools.length, 1);
  assert.ok(r.tools[0].args.length <= 120);
  assert.ok(r.tools[0].result.length <= 120);
  assert.equal(r.tools[0].name, "check_availability");
  assert.equal(r.tools[0].ms, 340);
  assert.equal(r.tools[0].atS, 12);
});

test("a call without events has no tools", () => {
  const r = buildCallReview(GPT, [turn("inbound", "hi", 1)], [], null);
  assert.deepEqual(r.tools, []);
  assert.equal(r.summary.toolCount, 0);
});

test("tool markers fall back to turn_metrics when there are no events", () => {
  const r = buildCallReview(ELEVEN, [], [], { tools: [{ name: "book_slot", at_s: 20.4, latency_ms: 250 }] });
  assert.deepEqual(r.tools, [{ name: "book_slot", atS: 20.4, ms: 250, args: "", result: "" }]);
  assert.equal(r.summary.toolCount, 1);
});

test("delegations are not tool markers", () => {
  const r = buildCallReview(GPT, [], [event({ kind: "delegation" })], null);
  assert.equal(r.summary.toolCount, 0);
});

test("recordingUrl is null when the call has no recording", () => {
  const r = buildCallReview({ ...GPT, sessionId: null }, [], [], null);
  assert.equal(r.recordingUrl, null);
  assert.equal(buildCallReview(GPT, [], [], null).recordingUrl, "/api/voice-calls/live_call_1/recording");
});

test("secret-like keys never reach the review", () => {
  const dirty = {
    day: "monday", token: "tok-123", secret: "sec-456", headers: { "X-Secret": "hdr-789" },
    nested: { Authorization: "Bearer abc", apiKey: "key-1", keep: "fine" },
  };
  const r = buildCallReview(GPT, [], [event({ args: dirty, result: dirty })], {
    tools: [{ name: "x", at_s: 1, latency_ms: 1, headers: { a: "b" }, secret: "s" }],
  });
  const json = JSON.stringify(r);
  for (const bad of ["tok-123", "sec-456", "hdr-789", "Bearer abc", "key-1"]) assert.ok(!json.includes(bad), bad);
  for (const bad of ["secret", "token", "headers", "Authorization", "apiKey"]) assert.ok(!json.toLowerCase().includes(bad.toLowerCase()), bad);
  assert.ok(json.includes("fine"));
});

test("caller and user roles both read as user", () => {
  const turns = [turn("inbound", "hello", 1), turn("outbound", "hi", 3)];
  const gpt = buildCallReview(GPT, turns, [], { turns: [{ i: 0, role: "caller", at_s: 1 }, { i: 1, role: "agent", at_s: 3, delay_ms: 600 }] });
  const eleven = buildCallReview(ELEVEN, turns, [], { turns: [{ i: 0, role: "user", at_s: 1 }, { i: 1, role: "agent", at_s: 3, delay_ms: 600 }] });
  assert.deepEqual(gpt.turns.map((t) => t.role), ["user", "agent"]);
  assert.deepEqual(eleven.turns.map((t) => t.role), ["user", "agent"]);
  assert.equal(gpt.turns[1].delayMs, 600);
  assert.equal(eleven.turns[1].delayMs, 600);
});

test("ElevenLabs offsets come from turn_metrics, GPT Live without metrics from timestamps", () => {
  const turns = [turn("inbound", "hello", 5), turn("outbound", "hi", 8, 6.5)];
  const metrics = { turns: [{ i: 0, role: "user", at_s: 2.5 }, { i: 1, role: "agent", at_s: 4, delay_ms: 700 }] };
  const eleven = buildCallReview(ELEVEN, turns, [], metrics);
  assert.deepEqual(eleven.turns.map((t) => t.atS), [2.5, 4]);
  const gpt = buildCallReview(GPT, turns, [], null);
  // First turn has only created_at (written 1.4 s after the last words); the second has spoken_at.
  assert.deepEqual(gpt.turns.map((t) => t.atS), [3.6, 6.5]);
});

test("ElevenLabs without metrics counts from the recording start", () => {
  const r = buildCallReview(ELEVEN, [turn("outbound", "hi", 8, 6)], [], null);
  assert.equal(r.turns[0].atS, 5);
});

test("an older call without metrics still gets approximate delays from timestamps", () => {
  const turns = [turn("inbound", "hello", 6, 4), turn("outbound", "hi there", 9, 6.0)];
  const r = buildCallReview(GPT, turns, [], null);
  // Caller's last words end at 6 - 1.4 = 4.6 s, she is heard at 6.0 s.
  assert.equal(r.turns[0].delayMs, null);
  assert.equal(r.turns[1].delayMs, 1400);
});

test("booking receipts are never turns", () => {
  const turns = [turn("inbound", "hello", 1), turn("outbound", "Booked Monday", 4, null, "receipt"), turn("outbound", "hi", 3, 2.5)];
  const r = buildCallReview(GPT, turns, [], null);
  assert.deepEqual(r.turns.map((t) => t.text), ["hello", "hi"]);
  assert.deepEqual(r.turns.map((t) => t.i), [0, 1]);
});

test("metrics that do not line up with the turns are ignored", () => {
  const turns = [turn("inbound", "hello", 1)];
  const r = buildCallReview(ELEVEN, turns, [], { turns: [{ i: 0, role: "agent", at_s: 99, delay_ms: 5 }] });
  assert.equal(r.turns[0].delayMs, null);
  assert.equal(r.turns[0].atS, 0);
});

test("engine, stereo, duration and cost", () => {
  const cost = { total: 0.42, minutes: 1.5, ai: 0.3, recap: 0.02, telephony: 0.1, estimate: true };
  const eleven = buildCallReview(ELEVEN, [], [], { cost });
  assert.equal(eleven.engine, "elevenlabs");
  assert.equal(eleven.stereo, false);
  assert.equal(eleven.durationSeconds, 90);
  assert.deepEqual(eleven.cost, cost);
  const gpt = buildCallReview(GPT, [], [], { cost: { ...cost, estimate: false } });
  assert.equal(gpt.engine, "gpt-live");
  assert.equal(gpt.stereo, true);
  assert.equal(gpt.cost?.estimate, false);
});

test("a call without turn_metrics has no cost, and junk metrics do not throw", () => {
  assert.equal(buildCallReview(GPT, [], [], null).cost, null);
  assert.equal(buildCallReview(GPT, [], [], "nope").cost, null);
  assert.equal(buildCallReview(GPT, [], [], { cost: { total: "x" }, turns: 5, tools: "no" }).cost, null);
});

test("a JSON-encoded string cannot smuggle secret keys past the scrub", () => {
  const encoded = JSON.stringify({ day: "monday", headers: { "X-Secret": "hdr-789" }, secret: "sec-456", keep: "fine" });
  const nested = JSON.stringify({ truncated: JSON.stringify({ status: "found", token: "tok-123", car: "Audi" }) });
  const r = buildCallReview(GPT, [], [event({ args: encoded, result: nested })], null);
  const json = JSON.stringify(r).toLowerCase();
  for (const bad of ["hdr-789", "sec-456", "tok-123", "headers", "secret", "token", "x-secret"]) assert.ok(!json.includes(bad), bad);
  assert.ok(json.includes("fine"));
  assert.ok(json.includes("audi"));
});

test("a cut-off JSON string loses its secret pairs too", () => {
  const cut = '{"day":"monday","headers":{"X-Secret":"hdr-789"},"api_key":"key-1","note":"abc';
  const r = buildCallReview(GPT, [], [event({ args: cut, result: "plain text" })], null);
  const json = JSON.stringify(r).toLowerCase();
  for (const bad of ["hdr-789", "key-1", "headers", "api_key"]) assert.ok(!json.includes(bad), bad);
  assert.equal(r.tools[0].result, "plain text");
});

test("recapOf takes distinct intents, interests and notes and the outcome", () => {
  const r = recapOf({
    intents: ["book_appointment", "book_appointment", "ask_advice"],
    outcome: "booked",
    summary: { items: [{ interest: "Golf 7", notes: "Tuesday" }, { interest: "Golf 7", notes: null }, { interest: " ", notes: "Call back" }] },
  });
  assert.deepEqual(r, { intents: ["book_appointment", "ask_advice"], interests: ["Golf 7"], notes: ["Tuesday", "Call back"], outcome: "booked" });
  assert.deepEqual(recapOf({}), { intents: [], interests: [], notes: [], outcome: null });
});

test("the review carries the recap it is given, and an empty one by default", () => {
  assert.deepEqual(buildCallReview(GPT, [], [], null).recap, { intents: [], interests: [], notes: [], outcome: null });
  const recap = { intents: ["callback_now"], interests: [], notes: [], outcome: "callback" };
  assert.deepEqual(buildCallReview(GPT, [], [], null, recap).recap, recap);
});

test("GPT Live with turn_metrics places turns and tools at the metric at_s (the trace clock)", () => {
  // Rows land on the server clock after each turn; the trace counts from session start.
  const turns = [turn("outbound", "Hi, Robben here", 3.2), turn("inbound", "I want a car", 7), turn("outbound", "Sure", 10, 9)];
  const metrics = {
    turns: [
      { i: 0, role: "agent", at_s: 0.4 }, { i: 1, role: "caller", at_s: 3.1 },
      { i: 2, role: "agent", at_s: 6.2, delay_ms: 650 },
    ],
    tools: [{ name: "check_availability", at_s: 9.3, latency_ms: 340 }],
  };
  // The tool events carry the browser clock: the matching metric tool sets where the trace began.
  const events = [event(), event({ toolName: "book_appointment", startedAt: at(15), latencyMs: 120 })];
  const r = buildCallReview(GPT, turns, events, metrics);
  assert.deepEqual(r.turns.map((t) => t.atS), [0.4, 3.1, 6.2]);
  assert.deepEqual(r.tools.map((t) => t.atS), [9.3, 12.3]);
  assert.equal(r.tools[0].args, JSON.stringify({ day: "monday" }));
});

test("GPT Live without turn_metrics keeps the timestamp fallback for turns and tools", () => {
  const turns = [turn("inbound", "hello", 5), turn("outbound", "hi", 8, 6.5)];
  const r = buildCallReview(GPT, turns, [event()], null);
  assert.deepEqual(r.turns.map((t) => t.atS), [3.6, 6.5]);
  assert.deepEqual(r.tools.map((t) => t.atS), [12]);
});

test("costIsCurrent: an ElevenLabs cost counts only when priced by this feature", () => {
  const metrics = { cost: { total: 0.12, minutes: 1, ai: 0.1, recap: 0.02, telephony: 0, estimate: true } };
  assert.equal(costIsCurrent("elevenlabs", { prices_version: "2026-10-23" }, metrics), true);
  assert.equal(costIsCurrent("elevenlabs", { prices_version: "2026-11-02" }, metrics), true);
  // Priced before ElevenLabs minutes were (the old "~$0.04"), or without the review's cost.
  assert.equal(costIsCurrent("elevenlabs", { prices_version: "2026-10-01" }, metrics), false);
  assert.equal(costIsCurrent("elevenlabs", {}, metrics), false);
  assert.equal(costIsCurrent("elevenlabs", null, metrics), false);
  assert.equal(costIsCurrent("elevenlabs", { prices_version: "2026-10-23" }, null), false);
  assert.equal(costIsCurrent("elevenlabs", { prices_version: "2026-10-23" }, { cost: { total: "x" } }), false);
  // GPT Live was priced right before this feature.
  assert.equal(costIsCurrent("gpt-live", null, null), true);
});
