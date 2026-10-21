import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import type { InsertSocialInsightSnapshot } from "@shared/schema";
import { fetchMetrics, type IgMedia, type MetricResult } from "./insightsApi";
import { IgApiError } from "./instagramApi";
import { daysToRead, mediaDue, resetRefusedMetrics, runInsightsOnce, type InsightsDeps, type PolledMedia } from "./insightsCollector";

let now: Date;
let state: Map<number, { backfilledAt: Date | null; lastAccountRunAt: Date | null; lastError?: string | null }>;
let media: Map<string, PolledMedia>;
let snaps: Map<string, InsertSocialInsightSnapshot>;
let calls: { media: number; insights: string[][]; days: string[]; profile: number; followerAsks: number };
/** Account ids whose Graph answers refuse reels_skip_rate as an unknown metric (code 100). */
let refuseSkipRateFor: Set<number>;
let missingSaved: boolean;
let boom: boolean;
/** What the fake Graph answers for the daily follower_count: net change per day, or an error to throw. */
let followerAnswer: Record<string, number> | Error;
let accounts: { accountId: number; igUserId: string; token: string }[];

const key = (r: InsertSocialInsightSnapshot) => [r.accountsId, r.scope, r.igMediaId, r.metric, r.bucket].join("|");
const reel = (id: string, postedAt: Date): IgMedia => ({ id, mediaType: "VIDEO", productType: "REELS", permalink: null, caption: "", postedAt, likeCount: 1, commentsCount: 0 });

const deps: InsightsDeps = {
  now: () => now,
  async listAccounts() { return accounts; },
  async getState(id) { return state.get(id) ?? null; },
  async setState(id, f) { state.set(id, { backfilledAt: null, lastAccountRunAt: null, ...state.get(id), ...f }); },
  async upsertMedia(id, list) { for (const m of list) if (!media.has(`${id}|${m.id}`)) media.set(`${id}|${m.id}`, { igMediaId: m.id, productType: m.productType, postedAt: m.postedAt, lastPolledAt: null }); },
  async listMediaToPoll(id) { return [...media.entries()].filter(([k]) => k.startsWith(`${id}|`)).map(([, m]) => m); },
  async markPolled(id, mid, at) { media.get(`${id}|${mid}`)!.lastPolledAt = at; },
  async upsertSnapshots(rows) { for (const r of rows) snaps.set(key(r), r); },
  async followerBuckets(id, sinceDay) {
    return new Set([...snaps.values()].filter((r) => r.accountsId === id && r.metric === "followers_count" && r.value !== null && r.bucket >= sinceDay).map((r) => r.bucket));
  },
  ig: {
    async profile() { calls.profile++; return { followers: 4171, mediaCount: 3 }; },
    async recentMedia() {
      calls.media++;
      if (boom) throw new IgApiError("Error validating access token", 190, "http");
      return [reel("old", new Date(now.getTime() - 10 * 86_400_000)), reel("new", new Date(now.getTime() - 3_600_000))];
    },
    // A fake Graph answer behind the real fetchMetrics, so the refusal logic runs end to end.
    async mediaInsights(a, _m, metrics): Promise<MetricResult> {
      calls.insights.push([...metrics]);
      return fetchMetrics(async (asked) => {
        if (asked.includes("reels_skip_rate") && refuseSkipRateFor.has(a.accountId)) throw new IgApiError("(#100) metric[0] must be one of the following values", 100, "http");
        return { data: asked.filter((x) => !(x === "saved" && missingSaved)).map((name) => ({ name, values: [{ value: 10 }] })) };
      }, metrics);
    },
    async followerChanges() {
      calls.followerAsks++;
      if (followerAnswer instanceof Error) throw followerAnswer;
      return followerAnswer;
    },
    async dayTotals(_a, metrics, day) { calls.days.push(day); return { values: Object.fromEntries(metrics.map((m) => [m, 7])), skipped: {}, unsupported: [] }; },
  },
};

beforeEach(() => {
  now = new Date("2026-10-20T12:00:00Z");
  state = new Map();
  media = new Map();
  snaps = new Map();
  calls = { media: 0, insights: [], days: [], profile: 0, followerAsks: 0 };
  refuseSkipRateFor = new Set([56]);
  missingSaved = false;
  boom = false;
  followerAnswer = { "2026-10-17": 2, "2026-10-18": 5, "2026-10-19": -1, "2026-10-20": 3 };
  accounts = [{ accountId: 56, igUserId: "17841", token: "SECRET-TOKEN" }];
  resetRefusedMetrics();
});

test("first run backfills: 30 days of account totals, the followers, every recent media item", async () => {
  await runInsightsOnce(deps);
  assert.equal(calls.days.length, 30);
  assert.equal(calls.days[0], "2026-09-20");
  assert.equal(calls.days.at(-1), "2026-10-19");
  assert.equal(snaps.get("56|account||followers_count|2026-10-20")?.value, 4171);
  assert.equal(calls.insights.length, 2, "both media read");
  assert.ok(state.get(56)?.backfilledAt);
});

test("an unsupported metric is a recorded skip, never a crash, and is not asked again", async () => {
  await runInsightsOnce(deps);
  const skip = [...snaps.values()].filter((r) => r.metric === "reels_skip_rate");
  assert.equal(skip.length, 1, "asked once: the second media item no longer asks for it");
  assert.equal(skip[0].value, null);
  assert.match(skip[0].skippedReason!, /#100/);
  assert.ok(!calls.insights[1].includes("reels_skip_rate"));
  assert.ok(calls.insights[0].includes("views"));
});

test("a refusal on one account does not stop another account from asking for that metric", async () => {
  accounts = [{ accountId: 56, igUserId: "17841", token: "A" }, { accountId: 77, igUserId: "17842", token: "B" }];
  await runInsightsOnce(deps);
  const skipRate = [...snaps.values()].filter((r) => r.metric === "reels_skip_rate");
  assert.ok(skipRate.some((r) => r.accountsId === 56 && r.value === null), "56: recorded skip");
  assert.equal(skipRate.filter((r) => r.accountsId === 77 && r.value === 10).length, 2, "77: asked and stored for both media");
});

test("a metric that was only missing from one answer is asked again next time", async () => {
  missingSaved = true;
  await runInsightsOnce(deps);
  assert.equal([...snaps.values()].find((r) => r.metric === "saved")?.skippedReason, "not returned");
  assert.ok(calls.insights[1].includes("saved"), "the second media item still asks for it");
});

test("a token error while reading a media item stops the account and is never stored as skips", async () => {
  await runInsightsOnce(deps);
  const before = snaps.size;
  for (const m of media.values()) m.lastPolledAt = null;
  const real = deps.ig.mediaInsights;
  deps.ig.mediaInsights = (a, m, metrics) => fetchMetrics(async () => { throw new IgApiError("Error validating access token", 190, "http"); }, metrics);
  try {
    await runInsightsOnce(deps);
  } finally {
    deps.ig.mediaInsights = real;
  }
  assert.equal(snaps.size, before, "no skip rows written");
  assert.match(state.get(56)?.lastError ?? "", /access token/);
});

test("snapshots are idempotent: the same hour twice replaces, it never duplicates", async () => {
  await runInsightsOnce(deps);
  const n = snaps.size;
  for (const m of media.values()) m.lastPolledAt = null; // force a re-read in the same hour
  state.get(56)!.lastAccountRunAt = null;
  await runInsightsOnce(deps);
  assert.equal(snaps.size, n);
});

test("later runs: fresh posts every hour, older ones every 6 h, account every 6 h with only the last 2 days", async () => {
  await runInsightsOnce(deps);
  calls = { media: 0, insights: [], days: [], profile: 0, followerAsks: 0 };
  now = new Date(now.getTime() + 3_600_000);
  await runInsightsOnce(deps);
  assert.equal(calls.insights.length, 1, "only the fresh Reel after one hour");
  assert.equal(calls.media, 0, "the account part waits 6 h");
  now = new Date(now.getTime() + 5 * 3_600_000);
  calls = { media: 0, insights: [], days: [], profile: 0, followerAsks: 0 };
  await runInsightsOnce(deps);
  assert.equal(calls.insights.length, 2);
  assert.deepEqual(calls.days, ["2026-10-18", "2026-10-19"]);
});

test("a bad token for one account is logged in its state and never thrown", async () => {
  boom = true;
  await runInsightsOnce(deps);
  assert.match(state.get(56)?.lastError ?? "", /access token/);
  assert.ok(!JSON.stringify([...state.values()]).includes("SECRET-TOKEN"), "no token in the state");
});

test("cadence rules", () => {
  const n = new Date("2026-10-20T12:00:00Z");
  const fresh: PolledMedia = { igMediaId: "a", productType: "REELS", postedAt: new Date(n.getTime() - 86_400_000), lastPolledAt: new Date(n.getTime() - 56 * 60_000) };
  assert.equal(mediaDue(fresh, n), true, "55 min counts as the hourly read");
  assert.equal(mediaDue({ ...fresh, lastPolledAt: new Date(n.getTime() - 30 * 60_000) }, n), false);
  assert.equal(mediaDue({ ...fresh, postedAt: new Date(n.getTime() - 5 * 86_400_000) }, n), false, "older: 6 h");
  assert.equal(mediaDue({ ...fresh, lastPolledAt: null }, n), true);
  assert.deepEqual(daysToRead(n, true), ["2026-10-18", "2026-10-19"]);
});

test("missing tables (before the script ran): one clear warning, no error per account, nothing thrown", async () => {
  const realGet = deps.getState;
  deps.getState = async () => { throw Object.assign(new Error('relation "Social_Insight_State" does not exist'), { code: "42P01" }); };
  try {
    await runInsightsOnce(deps);
    assert.equal(calls.media, 0);
  } finally {
    deps.getState = realGet;
  }
});

const followerRows = () => [...snaps.values()].filter((r) => r.metric === "followers_count" && r.scope === "account").sort((x, y) => x.bucket.localeCompare(y.bucket));

test("first backfill rebuilds the follower history: today's count minus the later net changes", async () => {
  await runInsightsOnce(deps);
  // Today (10-20) has 4171 after +3 today, so the end of 10-19 is 4168; 10-18 ended at 4168 - (-1) = 4169; 10-17 at 4169 - 5 = 4164.
  assert.deepEqual(followerRows().map((r) => [r.bucket, r.value]), [["2026-10-17", 4164], ["2026-10-18", 4169], ["2026-10-19", 4168], ["2026-10-20", 4171]]);
  assert.equal(calls.followerAsks, 1);
});

test("Meta refusing the daily follower metric is a recorded skip and the run carries on", async () => {
  followerAnswer = new IgApiError("(#100) metric[0] must be one of the following values", 100, "http");
  await runInsightsOnce(deps);
  assert.equal(followerRows().length, 1, "only today's real snapshot");
  const skip = snaps.get("56|account||follower_count|2026-10-20");
  assert.equal(skip?.value, null);
  assert.match(skip?.skippedReason ?? "", /#100/);
  assert.equal(calls.days.length, 30, "the day totals still ran");
  assert.equal(calls.insights.length, 2, "so did the media");
  assert.ok(state.get(56)?.backfilledAt);
  assert.equal(state.get(56)?.lastError ?? null, null, "not an account error");
});

test("an account under 100 followers (Meta's error) is skipped the same way", async () => {
  followerAnswer = new IgApiError("(#100) Not enough followers: follower_count needs at least 100 followers", 100, "http");
  await runInsightsOnce(deps);
  assert.match(snaps.get("56|account||follower_count|2026-10-20")?.skippedReason ?? "", /100 followers/);
  assert.equal(followerRows().length, 1);
  assert.ok(state.get(56)?.backfilledAt);
});

test("an answer that does not add up (a count below 0) is a skip, nothing invented is stored", async () => {
  followerAnswer = { "2026-10-17": 1, "2026-10-19": 9000 };
  await runInsightsOnce(deps);
  assert.equal(followerRows().length, 1);
  assert.match(snaps.get("56|account||follower_count|2026-10-20")?.skippedReason ?? "", /do not add up/);
});

test("the rebuild never overwrites a real snapshot, and a forced re-run changes nothing", async () => {
  snaps.set("56|account||followers_count|2026-10-18", { accountsId: 56, scope: "account", igMediaId: "", metric: "followers_count", value: 4000, skippedReason: null, bucket: "2026-10-18" });
  await runInsightsOnce(deps);
  assert.equal(snaps.get("56|account||followers_count|2026-10-18")?.value, 4000, "the real one stays");
  assert.equal(snaps.get("56|account||followers_count|2026-10-19")?.value, 4168);
  const before = JSON.stringify(followerRows());
  state.delete(56); // as if the first backfill had never been recorded
  await runInsightsOnce(deps);
  assert.equal(JSON.stringify(followerRows()), before);
});

test("later runs do not ask for the follower history again", async () => {
  await runInsightsOnce(deps);
  now = new Date(now.getTime() + 6 * 3_600_000);
  await runInsightsOnce(deps);
  assert.equal(calls.followerAsks, 1);
});
