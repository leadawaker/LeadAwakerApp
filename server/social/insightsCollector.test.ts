import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import type { InsertSocialInsightSnapshot } from "@shared/schema";
import type { IgMedia, MetricResult } from "./insightsApi";
import { IgApiError } from "./instagramApi";
import { daysToRead, mediaDue, resetRefusedMetrics, runInsightsOnce, type InsightsDeps, type PolledMedia } from "./insightsCollector";

let now: Date;
let state: Map<number, { backfilledAt: Date | null; lastAccountRunAt: Date | null; lastError?: string | null }>;
let media: Map<string, PolledMedia>;
let snaps: Map<string, InsertSocialInsightSnapshot>;
let calls: { media: number; insights: string[][]; days: string[]; profile: number };
let refuseSkipRate: boolean;
let boom: boolean;

const key = (r: InsertSocialInsightSnapshot) => [r.accountsId, r.scope, r.igMediaId, r.metric, r.bucket].join("|");
const reel = (id: string, postedAt: Date): IgMedia => ({ id, mediaType: "VIDEO", productType: "REELS", permalink: null, caption: "", postedAt, likeCount: 1, commentsCount: 0 });

const deps: InsightsDeps = {
  now: () => now,
  async listAccounts() { return [{ accountId: 56, igUserId: "17841", token: "SECRET-TOKEN" }]; },
  async getState(id) { return state.get(id) ?? null; },
  async setState(id, f) { state.set(id, { backfilledAt: null, lastAccountRunAt: null, ...state.get(id), ...f }); },
  async upsertMedia(_id, list) { for (const m of list) if (!media.has(m.id)) media.set(m.id, { igMediaId: m.id, productType: m.productType, postedAt: m.postedAt, lastPolledAt: null }); },
  async listMediaToPoll() { return [...media.values()]; },
  async markPolled(_id, mid, at) { media.get(mid)!.lastPolledAt = at; },
  async upsertSnapshots(rows) { for (const r of rows) snaps.set(key(r), r); },
  ig: {
    async profile() { calls.profile++; return { followers: 4171, mediaCount: 3 }; },
    async recentMedia() {
      calls.media++;
      if (boom) throw new IgApiError("Error validating access token", 190, "http");
      return [reel("old", new Date(now.getTime() - 10 * 86_400_000)), reel("new", new Date(now.getTime() - 3_600_000))];
    },
    async mediaInsights(_a, _m, metrics): Promise<MetricResult> {
      calls.insights.push([...metrics]);
      const values: Record<string, number> = {};
      const skipped: Record<string, string> = {};
      for (const x of metrics) {
        if (x === "reels_skip_rate" && refuseSkipRate) skipped[x] = "(#100) not supported";
        else values[x] = 10;
      }
      return { values, skipped };
    },
    async dayTotals(_a, metrics, day) { calls.days.push(day); return { values: Object.fromEntries(metrics.map((m) => [m, 7])), skipped: {} }; },
  },
};

beforeEach(() => {
  now = new Date("2026-10-20T12:00:00Z");
  state = new Map();
  media = new Map();
  snaps = new Map();
  calls = { media: 0, insights: [], days: [], profile: 0 };
  refuseSkipRate = true;
  boom = false;
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
  assert.match(skip[0].skippedReason!, /not supported/);
  assert.ok(!calls.insights[1].includes("reels_skip_rate"));
  assert.ok(calls.insights[0].includes("views"));
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
  calls = { media: 0, insights: [], days: [], profile: 0 };
  now = new Date(now.getTime() + 3_600_000);
  await runInsightsOnce(deps);
  assert.equal(calls.insights.length, 1, "only the fresh Reel after one hour");
  assert.equal(calls.media, 0, "the account part waits 6 h");
  now = new Date(now.getTime() + 5 * 3_600_000);
  calls = { media: 0, insights: [], days: [], profile: 0 };
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
