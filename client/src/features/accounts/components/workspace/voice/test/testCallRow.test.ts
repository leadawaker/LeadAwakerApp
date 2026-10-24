import { test } from "node:test";
import assert from "node:assert/strict";
import { rowCostLabel, rowDelayLabel } from "./testCallRow";

test("rowCostLabel: GPT Live is exact, ElevenLabs carries the approximate sign", () => {
  assert.equal(rowCostLabel({ costUsd: 0.5, engine: "gpt-live" }, "n/a"), "$0.50");
  assert.equal(rowCostLabel({ costUsd: 0.1234, engine: "elevenlabs" }, "n/a"), "≈ $0.12");
});

test("rowCostLabel: no cost is the unknown label", () => {
  assert.equal(rowCostLabel({ costUsd: null, engine: "gpt-live" }, "Unknown"), "Unknown");
  assert.equal(rowCostLabel({}, "Unknown"), "Unknown");
  assert.equal(rowCostLabel({ costUsd: Number.NaN }, "Unknown"), "Unknown");
});

test("rowDelayLabel: approximate seconds, or null without a delay", () => {
  assert.equal(rowDelayLabel(800), "≈ 0.8 s");
  assert.equal(rowDelayLabel(null), null);
  assert.equal(rowDelayLabel(undefined), null);
  assert.equal(rowDelayLabel(0), null);
  assert.equal(rowDelayLabel(Number.NaN), null);
});

test("rowCostLabel: an ElevenLabs row priced before this feature is the unknown label", () => {
  assert.equal(rowCostLabel({ costUsd: 0.04, engine: "elevenlabs", costCurrent: false }, "Unknown"), "Unknown");
  assert.equal(rowCostLabel({ costUsd: 0.1234, engine: "elevenlabs", costCurrent: true }, "Unknown"), "≈ $0.12");
  // An older server without the flag: shown as before.
  assert.equal(rowCostLabel({ costUsd: 0.1234, engine: "elevenlabs" }, "Unknown"), "≈ $0.12");
  assert.equal(rowCostLabel({ costUsd: 0.5, engine: "gpt-live", costCurrent: true }, "Unknown"), "$0.50");
});
