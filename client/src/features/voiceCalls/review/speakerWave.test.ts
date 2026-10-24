import { test } from "node:test";
import assert from "node:assert/strict";
import { peakOf, sortedTurns, speakerAt } from "./speakerWave";

const turns = [
  { role: "agent" as const, atS: 0.5 },
  { role: "user" as const, atS: 4 },
  { role: "agent" as const, atS: 9.2 },
];

test("before the first turn is silence", () => {
  assert.equal(speakerAt(turns, 0), "silence");
  assert.equal(speakerAt(turns, 0.49), "silence");
  assert.equal(speakerAt([], 3), "silence");
});

test("a turn lasts until the next one starts, the last one to the end", () => {
  assert.equal(speakerAt(turns, 0.5), "agent");
  assert.equal(speakerAt(turns, 3.99), "agent");
  assert.equal(speakerAt(turns, 4), "user");
  assert.equal(speakerAt(turns, 9.1), "user");
  assert.equal(speakerAt(turns, 9.2), "agent");
  assert.equal(speakerAt(turns, 600), "agent");
});

test("turns are searched in time order even when a row came in late", () => {
  const late = sortedTurns([turns[2], turns[0], turns[1]]);
  assert.deepEqual(late.map((x) => x.atS), [0.5, 4, 9.2]);
  assert.equal(speakerAt(late, 5), "user");
});

test("peakOf is the loudest absolute sample", () => {
  assert.equal(peakOf(new Float32Array([0.1, -0.75, 0.5])), 0.75);
  assert.equal(peakOf([]), 0);
});
