import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyHomeOutcome } from "./homeOutcome";

const base = {
  outcome: "other" as string | null,
  transferOutcome: null as string | null,
  bookedIso: null as string | null,
  intents: [] as string[],
  durationSeconds: 120 as number | null,
  hasSummary: true,
  abandoned: false,
  needsCallback: false,
};

test("booked wins over everything", () => {
  assert.equal(classifyHomeOutcome({ ...base, outcome: "booked", transferOutcome: "failed", needsCallback: false }), "booked");
});

test("a failed transfer is a callback", () => {
  assert.equal(classifyHomeOutcome({ ...base, transferOutcome: "failed", needsCallback: true }), "callback");
});

test("a leave_message intent is a callback", () => {
  assert.equal(classifyHomeOutcome({ ...base, intents: ["leave_message"], needsCallback: true }), "callback");
});

test("outcome callback is a callback", () => {
  assert.equal(classifyHomeOutcome({ ...base, outcome: "callback", needsCallback: true }), "callback");
});

test("a transferred call that needs a callback is a callback", () => {
  assert.equal(classifyHomeOutcome({ ...base, outcome: "transferred", transferOutcome: "transferred", needsCallback: true }), "callback");
});

test("outcome booked beats needsCallback", () => {
  assert.equal(classifyHomeOutcome({ ...base, outcome: "booked", needsCallback: true }), "booked");
});

test("a completed transfer is transferred", () => {
  assert.equal(classifyHomeOutcome({ ...base, transferOutcome: "completed" }), "transferred");
});

test("hung up stays hung up", () => {
  assert.equal(classifyHomeOutcome({ ...base, outcome: "hung_up" }), "hung_up");
});

test("a null-outcome legacy row gets the derived outcome", () => {
  // voiceOutcome.test.ts: "4s with no summary gives hung_up"
  assert.equal(classifyHomeOutcome({ ...base, outcome: null, durationSeconds: 4, hasSummary: false }), "hung_up");
  // "callback_now intent gives callback"
  assert.equal(classifyHomeOutcome({ ...base, outcome: null, intents: ["callback_now"], needsCallback: false }), "callback");
  // a legacy booked_iso
  assert.equal(classifyHomeOutcome({ ...base, outcome: null, bookedIso: "2026-10-01T10:00:00Z" }), "booked");
  // "other" maps to answered
  assert.equal(classifyHomeOutcome({ ...base, outcome: null }), "answered");
});

test("a plain answered call is answered", () => {
  assert.equal(classifyHomeOutcome(base), "answered");
});
