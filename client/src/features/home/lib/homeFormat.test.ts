import { test } from "node:test";
import assert from "node:assert/strict";
import { barWidths, formatDuration, rateOf, trendOf } from "./homeFormat";

test("trend: up, down, flat", () => {
  assert.deepEqual(trendOf({ value: 118, previous: 100 }), { dir: "up", pct: 18 });
  assert.deepEqual(trendOf({ value: 80, previous: 100 }), { dir: "down", pct: 20 });
  assert.deepEqual(trendOf({ value: 50, previous: 50 }), { dir: "flat", pct: 0 });
});

test("trend: nothing to compare with is null, never Infinity or NaN", () => {
  assert.equal(trendOf({ value: 12, previous: 0 }), null);
  assert.equal(trendOf({ value: 0, previous: 0 }), null);
});

test("trend: a non-finite percent is null", () => {
  assert.equal(trendOf({ value: Number.NaN, previous: 5 }), null);
  assert.equal(trendOf({ value: Number.POSITIVE_INFINITY, previous: 5 }), null);
});

test("trend: a drop to zero is 100% down", () => {
  assert.deepEqual(trendOf({ value: 0, previous: 7 }), { dir: "down", pct: 100 });
});

test("duration", () => {
  assert.equal(formatDuration(134), "2m 14s");
  assert.equal(formatDuration(45), "45s");
  assert.equal(formatDuration(120), "2m 0s");
  assert.equal(formatDuration(0), "0s");
  assert.equal(formatDuration(null), "0s");
  assert.equal(formatDuration(-5), "0s");
});

test("rate: zero denominator is null", () => {
  assert.equal(rateOf(4, 38), 11);
  assert.equal(rateOf(0, 0), null);
  assert.equal(rateOf(3, 0), null);
});

test("bar widths scale to the largest; all zero stays zero", () => {
  assert.deepEqual(barWidths([96, 48, 0]), [100, 50, 0]);
  assert.deepEqual(barWidths([0, 0]), [0, 0]);
  assert.deepEqual(barWidths([]), []);
});
