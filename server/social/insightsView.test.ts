import { test } from "node:test";
import assert from "node:assert/strict";
import { BEST_TIME_MIN_POSTS, buildInsightsView, computeBestTimes, type PostInsight } from "./insightsView";

const NOW = new Date("2026-10-20T12:00:00Z");

test("headline sums the day totals of the period (today left out); followers and their change", () => {
  const account = [
    ...Array.from({ length: 10 }, (_, i) => ({ metric: "views", bucket: `2026-10-${String(10 + i).padStart(2, "0")}`, value: 100 })),
    { metric: "views", bucket: "2026-10-20", value: 999 },
    { metric: "reach", bucket: "2026-10-19", value: 40 },
    { metric: "followers_count", bucket: "2026-10-12", value: 4100 },
    { metric: "followers_count", bucket: "2026-10-13", value: 4120 },
    { metric: "followers_count", bucket: "2026-10-20", value: 4171 },
  ];
  const v = buildInsightsView({ days: 7, now: NOW, timeZone: "America/Sao_Paulo", media: [], latest: [], account, skipped: ["reels_skip_rate"] });
  assert.equal(v.headline.views, 700, "13th to 19th");
  assert.equal(v.headline.reach, 40);
  assert.equal(v.headline.interactions, null, "no data is null, not 0");
  assert.equal(v.headline.followers, 4171);
  assert.equal(v.headline.followersDelta, 4171 - 4120);
  assert.equal(v.headline.followersDeltaSince, "2026-10-13", "from the snapshot at the period start");
  assert.deepEqual(v.followerTrend.map((f) => f.value), [4100, 4120, 4171]);
  assert.deepEqual(v.skipped, ["reels_skip_rate"]);
});

test("no follower history yet: no change shown", () => {
  const v = buildInsightsView({ days: 30, now: NOW, timeZone: "UTC", media: [], latest: [], account: [{ metric: "followers_count", bucket: "2026-10-20", value: 10 }], skipped: [] });
  assert.equal(v.headline.followersDelta, null);
  assert.equal(v.headline.followersDeltaSince, null);
});

test("history shorter than the period: the change is labelled with its real start day", () => {
  const account = [
    { metric: "followers_count", bucket: "2026-10-17", value: 4150 },
    { metric: "followers_count", bucket: "2026-10-20", value: 4171 },
  ];
  const v = buildInsightsView({ days: 30, now: NOW, timeZone: "UTC", media: [], latest: [], account, skipped: [] });
  assert.equal(v.headline.followersDelta, 21);
  assert.equal(v.headline.followersDeltaSince, "2026-10-17", "not 30 days ago");
});

test("posts carry their newest values and a one-line caption", () => {
  const v = buildInsightsView({
    days: 7, now: NOW, timeZone: "UTC",
    media: [{ igMediaId: "m1", postId: 5, caption: "\n  \"Posso comer?\"\nresto", permalink: "p", postedAt: new Date("2026-10-18T13:00:00Z"), productType: "REELS" }],
    latest: [{ igMediaId: "m1", metric: "views", value: 1200 }, { igMediaId: "m1", metric: "ig_reels_avg_watch_time", value: 8400 }],
    account: [], skipped: [],
  });
  assert.equal(v.posts[0].caption, "\"Posso comer?\"");
  assert.deepEqual(v.posts[0].metrics, { views: 1200, ig_reels_avg_watch_time: 8400 });
});

const post = (iso: string, views: number): PostInsight => ({ igMediaId: iso, postId: null, caption: "", permalink: null, postedAt: iso, productType: "REELS", metrics: { views } });

test("best time: not enough data under the threshold", () => {
  const b = computeBestTimes([post("2026-10-19T13:00:00Z", 100)], "UTC");
  assert.equal(b.enough, false);
  assert.equal(b.bestWeekday, null);
  assert.equal(b.postsWithViews, 1);
});

test("best weekday and hour in the account's zone, each needing two posts", () => {
  // Tuesdays at 13:00 UTC = 10:00 in São Paulo do best; one lucky Sunday post does not count alone.
  const posts = [
    post("2026-09-29T13:00:00Z", 900), post("2026-10-06T13:00:00Z", 1100), post("2026-10-13T13:00:00Z", 1000),
    post("2026-10-01T22:00:00Z", 300), post("2026-10-08T22:00:00Z", 200),
    post("2026-10-02T15:00:00Z", 400), post("2026-10-09T15:00:00Z", 500),
    post("2026-10-04T12:00:00Z", 5000),
  ];
  assert.equal(posts.length, BEST_TIME_MIN_POSTS);
  const b = computeBestTimes(posts, "America/Sao_Paulo");
  assert.equal(b.enough, true);
  assert.equal(b.bestWeekday, 1, "Tuesday");
  assert.equal(b.bestHour, 10);
  assert.equal(b.byWeekday[6].posts, 1);
  assert.equal(b.byWeekday[6].avgViews, 5000);
});
