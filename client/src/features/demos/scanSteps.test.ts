import { test } from "node:test";
import assert from "node:assert/strict";
import { SCAN_STEP_SWITCH_MS, scanStepAt } from "./scanSteps";

test("the scan reads the site for the first 15 seconds, then builds the client", () => {
  assert.equal(scanStepAt(0), "reading");
  assert.equal(scanStepAt(14_999), "reading");
  assert.equal(scanStepAt(15_000), "building");
  assert.equal(SCAN_STEP_SWITCH_MS, 15000);
});

test("a clock that ran backwards still reads as the first step", () => {
  assert.equal(scanStepAt(-500), "reading");
});
