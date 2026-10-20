import { test } from "node:test";
import assert from "node:assert/strict";
import { callerNeedsYou, callerStage, callOutcomeStatus, isStageTag, personStageFromKey, STATUS_TONE } from "./statusPill";

test("a call maps to exactly one of the five outcomes", () => {
  assert.equal(callOutcomeStatus("booked"), "booked");
  assert.equal(callOutcomeStatus("callback"), "callback");
  assert.equal(callOutcomeStatus("transferred"), "transferred");
  assert.equal(callOutcomeStatus("hung_up"), "hungUp");
  assert.equal(callOutcomeStatus("other"), "answered");
  assert.equal(callOutcomeStatus(null), "answered");
});

test("receptionist stage keys map to the four person stages, DBR stages to null", () => {
  assert.equal(personStageFromKey("rx_new"), "newInquiry");
  assert.equal(personStageFromKey("rx_answered"), "answered");
  assert.equal(personStageFromKey("Booked"), "booked");
  assert.equal(personStageFromKey("rx_done"), "done");
  assert.equal(personStageFromKey("Qualified"), null);
});

test("Booked is the same tone for a call and a person", () => {
  assert.equal(STATUS_TONE.booked, "var(--stage-booked)");
});

test("a caller's stage", () => {
  assert.equal(callerStage({ leadStatus: "Booked", dnd: false, bestOutcome: "other" }), "booked");
  assert.equal(callerStage({ leadStatus: null, dnd: false, bestOutcome: "booked" }), "booked");
  assert.equal(callerStage({ leadStatus: "New", dnd: true, bestOutcome: "booked" }), "done");
  assert.equal(callerStage({ leadStatus: "Lost", dnd: false, bestOutcome: "other" }), "done");
  assert.equal(callerStage({ leadStatus: null, dnd: false, bestOutcome: "hung_up" }), "newInquiry");
  assert.equal(callerStage({ leadStatus: "New", dnd: false, bestOutcome: "callback" }), "answered");
});

test("needs you while a callback waits", () => {
  const base = { latestOutcome: "callback", lastCallAt: "2026-10-20T10:00:00Z", lastCalledBackAt: null };
  assert.equal(callerNeedsYou(base), true);
  assert.equal(callerNeedsYou({ ...base, lastCalledBackAt: "2026-10-20T11:00:00Z" }), false);
  assert.equal(callerNeedsYou({ ...base, lastCalledBackAt: "2026-10-19T11:00:00Z" }), true);
  assert.equal(callerNeedsYou({ ...base, latestOutcome: "booked" }), false);
});

test("stage-named tags are recognised whatever their case", () => {
  assert.equal(isStageTag("Booked"), true);
  assert.equal(isStageTag(" multiple responses "), true);
  assert.equal(isStageTag("VIP"), false);
  assert.equal(isStageTag(null), false);
});
