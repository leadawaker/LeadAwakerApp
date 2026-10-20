import { test } from "node:test";
import assert from "node:assert/strict";
import { localToUtc } from "./time";

test("São Paulo has no DST: 18:00 is 21:00Z", () => {
  assert.equal(localToUtc("2026-10-27", "18:00", "America/Sao_Paulo").toISOString(), "2026-10-27T21:00:00.000Z");
});
test("Amsterdam after DST ends (25 Oct 2026): 18:00 is 17:00Z", () => {
  assert.equal(localToUtc("2026-10-25", "18:00", "Europe/Amsterdam").toISOString(), "2026-10-25T17:00:00.000Z");
});
test("Amsterdam summer: 18:00 is 16:00Z", () => {
  assert.equal(localToUtc("2026-07-01", "18:00", "Europe/Amsterdam").toISOString(), "2026-07-01T16:00:00.000Z");
});
test("rejects malformed input", () => {
  assert.throws(() => localToUtc("2026-13-01", "18:00", "Europe/Amsterdam"));
  assert.throws(() => localToUtc("2026-10-01", "25:00", "Europe/Amsterdam"));
  assert.throws(() => localToUtc("2026-10-01", "18:00", "Not/AZone"));
});
