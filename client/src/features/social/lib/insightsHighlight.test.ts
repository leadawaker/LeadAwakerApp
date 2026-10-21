import { test } from "node:test";
import assert from "node:assert/strict";
import { highPerformers, highlightThreshold, median } from "./insightsHighlight";

const posts = (...views: (number | undefined)[]) => views.map((v, i) => ({ igMediaId: `m${i}`, metrics: v === undefined ? {} : { views: v } }));
const ids = (s: Set<string>) => [...s].sort();

test("median of odd, even and empty lists", () => {
  assert.equal(median([]), null);
  assert.equal(median([5]), 5);
  assert.equal(median([4, 1, 3]), 3);
  assert.equal(median([1, 2, 3, 10]), 2.5);
});

test("empty list: nothing highlighted", () => {
  assert.equal(highPerformers([]).size, 0);
  assert.equal(highlightThreshold([]), null);
});

test("fewer than 4 posts with views: nothing highlighted, even a huge outlier", () => {
  assert.equal(highPerformers(posts(1, 1, 1000)).size, 0);
  assert.equal(highPerformers(posts(1, 1, 1000, undefined)).size, 0, "a post without views does not count");
});

test("ties: all equal never reaches 2 x the median", () => {
  assert.equal(highPerformers(posts(10, 10, 10, 10, 10)).size, 0);
});

test("a clear outlier is highlighted, and exactly 2 x the median counts", () => {
  assert.deepEqual(ids(highPerformers(posts(100, 120, 90, 800))), ["m3"]);
  assert.deepEqual(ids(highPerformers(posts(100, 100, 100, 200))), ["m3"], "median 100, bar 200, >= includes it");
  assert.deepEqual(ids(highPerformers(posts(100, 100, 100, 199))), []);
});

test("zero median: the bar is 1 view, so only posts with views stand out", () => {
  assert.equal(highlightThreshold([0, 0, 0, 5]), 1);
  assert.deepEqual(ids(highPerformers(posts(0, 0, 0, 5))), ["m3"]);
  assert.equal(highPerformers(posts(0, 0, 0, 0)).size, 0);
});
