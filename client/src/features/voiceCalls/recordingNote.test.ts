import { test } from "node:test";
import assert from "node:assert/strict";
import { recordingMayStillCome, recordingMissingKey } from "./recordingNote";

const NOW = new Date("2026-10-24T12:00:00.000Z").getTime();
const ago = (ms: number) => new Date(NOW - ms).toISOString();
const MIN = 60_000, DAY = 24 * 60 * MIN;

test("a fresh call's recording is pending, an old one expired, in between unavailable", () => {
  assert.equal(recordingMissingKey(ago(5 * MIN), NOW), "recordingPending");
  assert.equal(recordingMissingKey(ago(2 * DAY), NOW), "recordingUnavailable");
  assert.equal(recordingMissingKey(ago(31 * DAY), NOW), "recordingExpired");
});

test("only a fresh call is asked again for its recording", () => {
  assert.equal(recordingMayStillCome(ago(10 * MIN), NOW), true);
  assert.equal(recordingMayStillCome(ago(2 * 60 * MIN), NOW), false);
});
