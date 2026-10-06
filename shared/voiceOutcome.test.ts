import { test } from "node:test";
import assert from "node:assert/strict";
import { deriveOutcome, isVoiceOutcome } from "./voiceOutcome";

const base = {
  transferred: false,
  bookedSlot: null as string | null,
  intents: [] as string[],
  durationSeconds: 120 as number | null,
  hasSummary: true,
  abandoned: false,
};

test("transferred beats booked", () => {
  assert.equal(deriveOutcome({ ...base, transferred: true, bookedSlot: "Thu 14:30" }), "transferred");
});

test("booked slot gives booked", () => {
  assert.equal(deriveOutcome({ ...base, bookedSlot: "Thu 14:30" }), "booked");
});

test("callback_now intent gives callback", () => {
  assert.equal(deriveOutcome({ ...base, intents: ["callback_now"] }), "callback");
});

test("booked beats callback", () => {
  assert.equal(deriveOutcome({ ...base, bookedSlot: "Thu 14:30", intents: ["callback_now"] }), "booked");
});

test("abandoned gives hung_up", () => {
  assert.equal(deriveOutcome({ ...base, abandoned: true }), "hung_up");
});

test("callback beats abandoned", () => {
  assert.equal(deriveOutcome({ ...base, abandoned: true, intents: ["callback_now"] }), "callback");
});

test("4s with no summary gives hung_up", () => {
  assert.equal(deriveOutcome({ ...base, durationSeconds: 4, hasSummary: false }), "hung_up");
});

test("4s with a summary gives other", () => {
  assert.equal(deriveOutcome({ ...base, durationSeconds: 4, hasSummary: true }), "other");
});

test("exactly 10s with no summary is not hung_up", () => {
  assert.equal(deriveOutcome({ ...base, durationSeconds: 10, hasSummary: false }), "other");
});

test("null duration gives other", () => {
  assert.equal(deriveOutcome({ ...base, durationSeconds: null, hasSummary: false }), "other");
});

test("isVoiceOutcome accepts the five values and nothing else", () => {
  for (const v of ["booked", "callback", "transferred", "hung_up", "other"]) assert.equal(isVoiceOutcome(v), true);
  for (const v of ["", "Booked", null, undefined, 3, "hungup"]) assert.equal(isVoiceOutcome(v), false);
});
