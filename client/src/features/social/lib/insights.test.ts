import { test } from "node:test";
import assert from "node:assert/strict";
import type { PostInsight } from "../api/insightsApi";
import { cell, compact, niceDomain, signed, sortPosts } from "./insights";

const p = (id: string, postedAt: string, metrics: Record<string, number>): PostInsight => ({ igMediaId: id, postId: null, caption: "", permalink: null, postedAt, productType: "REELS", metrics });

test("sort by views, missing values last, ties newest first", () => {
  const posts = [p("a", "2026-10-01T00:00:00Z", { views: 10 }), p("b", "2026-10-02T00:00:00Z", {}), p("c", "2026-10-03T00:00:00Z", { views: 50 }), p("d", "2026-10-04T00:00:00Z", {})];
  assert.deepEqual(sortPosts(posts, "views").map((x) => x.igMediaId), ["c", "a", "d", "b"]);
  assert.deepEqual(sortPosts(posts, "views", "asc").map((x) => x.igMediaId), ["a", "c", "d", "b"]);
  assert.deepEqual(sortPosts(posts, "postedAt").map((x) => x.igMediaId), ["d", "c", "b", "a"]);
});

test("formats: compact from 10K, watch time in seconds, skip rate in percent, signed change", () => {
  assert.equal(compact(1284, "en"), "1,284");
  assert.equal(compact(12900, "en"), "12.9K");
  assert.equal(compact(null, "en"), "–");
  assert.equal(cell("ig_reels_avg_watch_time", 8400, "en"), "8.4 s");
  assert.equal(cell("reels_skip_rate", 41.6, "pt-BR"), "42%");
  assert.equal(cell("views", undefined, "en"), "–");
  assert.equal(signed(51, "en"), "+51");
  assert.equal(signed(-3, "en"), "-3");
  assert.equal(signed(null, "en"), null);
});

test("nice domain: round ticks around the data, never below zero", () => {
  assert.deepEqual(niceDomain(4050, 4171), { domain: [4050, 4200], ticks: [4050, 4100, 4150, 4200] });
  const small = niceDomain(0, 7);
  assert.equal(small.domain[0], 0);
  assert.ok(small.ticks.every((t) => Number.isInteger(t * 2)));
  assert.deepEqual(niceDomain(10, 10).domain[0] <= 10, true);
});
