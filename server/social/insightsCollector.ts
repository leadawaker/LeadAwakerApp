/**
 * Insights collector (Phase D), the same job shape as tokenRefresher.ts: an hourly tick, a lazily loaded
 * live wiring, errors logged per account and never thrown, skipped entirely with DISABLE_BACKGROUND_JOBS=1
 * (it is started after that check in routes/index.ts). Spec: docs/superpowers/specs/2026-10-20-insights-design.md
 *
 * Per connected account:
 * - every 6 h: the recent media list (the first run backfills the newest 50, posts made in the Instagram
 *   app included), today's follower count (the first run also rebuilds the last ~30 days from Meta's
 *   daily net follower changes), and the account's day totals (the first run backfills 30 days,
 *   later runs re-read the last 2 days because Meta fills them in late);
 * - every media item: its lifetime metrics, every hour in its first 3 days, every 6 hours after.
 * Snapshots are keyed by bucket, so a re-run in the same hour (or day) replaces instead of duplicating.
 */
import type { InsertSocialInsightSnapshot } from "@shared/schema";
import type { IgMedia, MetricResult } from "./insightsApi";
import { deriveFollowerHistory } from "./insightsFollowers";
import { ACCOUNT_DAY_METRICS, FEED_METRICS, POLL, REEL_METRICS } from "./insightsMetrics";

export interface InsightsAccount { accountId: number; igUserId: string; token: string }
export interface PolledMedia { igMediaId: string; productType: string | null; postedAt: Date | null; lastPolledAt: Date | null }

export interface InsightsDeps {
  now(): Date;
  listAccounts(): Promise<InsightsAccount[]>;
  getState(accountId: number): Promise<{ backfilledAt: Date | null; lastAccountRunAt: Date | null } | null>;
  setState(accountId: number, fields: { backfilledAt?: Date; lastAccountRunAt?: Date; lastError?: string | null }): Promise<void>;
  upsertMedia(accountId: number, media: IgMedia[]): Promise<void>;
  listMediaToPoll(accountId: number, limit: number): Promise<PolledMedia[]>;
  markPolled(accountId: number, igMediaId: string, at: Date): Promise<void>;
  upsertSnapshots(rows: InsertSocialInsightSnapshot[]): Promise<void>;
  ig: {
    profile(a: InsightsAccount): Promise<{ followers: number | null; mediaCount: number | null }>;
    recentMedia(a: InsightsAccount, limit: number): Promise<IgMedia[]>;
    mediaInsights(a: InsightsAccount, igMediaId: string, metrics: readonly string[]): Promise<MetricResult>;
    dayTotals(a: InsightsAccount, metrics: readonly string[], day: string): Promise<MetricResult>;
    /** Net follower change per UTC day for about the last 30 days; throws when Meta refuses. */
    followerChanges(a: InsightsAccount, now: Date): Promise<Record<string, number>>;
  };
  /** Days from `sinceDay` on that already hold a real follower count, so a rebuild never overwrites one. */
  followerBuckets(accountId: number, sinceDay: string): Promise<Set<string>>;
}

export const dayBucket = (d: Date) => d.toISOString().slice(0, 10);
export const hourBucket = (d: Date) => d.toISOString().slice(0, 13);

export function metricsFor(productType: string | null): readonly string[] {
  return productType === "REELS" ? REEL_METRICS : FEED_METRICS;
}

/** Due when never read, every hour in the first 3 days after posting, every 6 hours after that. */
export function mediaDue(m: PolledMedia, now: Date): boolean {
  if (!m.lastPolledAt) return true;
  const since = now.getTime() - m.lastPolledAt.getTime();
  const fresh = !!m.postedAt && now.getTime() - m.postedAt.getTime() < POLL.freshForMs;
  // A few minutes of slack so an hourly tick that runs a little early still counts.
  return since >= (fresh ? POLL.freshEveryMs : POLL.matureEveryMs) - 5 * 60_000;
}

/** The UTC days to read account totals for: the 30 before today on the first run, else the last 2. */
export function daysToRead(now: Date, backfilled: boolean): string[] {
  const n = backfilled ? POLL.refreshDays : POLL.backfillDays;
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Array.from({ length: n }, (_, i) => dayBucket(new Date(today - (n - i) * 86_400_000)));
}

export function snapshotRows(accountId: number, scope: "account" | "media", igMediaId: string, bucket: string, r: MetricResult): InsertSocialInsightSnapshot[] {
  return [
    ...Object.entries(r.values).map(([metric, value]) => ({ accountsId: accountId, scope, igMediaId, metric, value, skippedReason: null, bucket })),
    ...Object.entries(r.skipped).map(([metric, reason]) => ({ accountsId: accountId, scope, igMediaId, metric, value: null, skippedReason: reason.slice(0, 300), bucket })),
  ];
}

/**
 * First backfill only: rebuild the follower counts of the days before today from today's count and
 * Meta's daily net changes, without overwriting a day that already has a real snapshot. Never throws:
 * any failure (Meta refusing the metric, an account under 100 followers, odd numbers) is stored as a
 * skip for "follower_count" and the run carries on.
 */
async function backfillFollowers(d: InsightsDeps, a: InsightsAccount, now: Date, current: number): Promise<string | null> {
  const today = dayBucket(now);
  try {
    const history = deriveFollowerHistory(current, today, await d.ig.followerChanges(a, now));
    if (history === null) throw new Error("follower changes do not add up");
    const have = await d.followerBuckets(a.accountId, history.at(-1)?.day ?? today);
    const rows = history.filter((h) => !have.has(h.day)).map((h) => ({ accountsId: a.accountId, scope: "account" as const, igMediaId: "", metric: "followers_count", value: h.value, skippedReason: null, bucket: h.day }));
    await d.upsertSnapshots(rows);
    return rows.length ? `${rows.length} follower days` : null;
  } catch (err: any) {
    const reason = String(err?.message ?? err).slice(0, 300);
    await d.upsertSnapshots([{ accountsId: a.accountId, scope: "account", igMediaId: "", metric: "follower_count", value: null, skippedReason: reason, bucket: today }]).catch(() => {});
    return null;
  }
}

/**
 * Metrics Meta refused as unsupported (code 100), per account and product type, in this process: asked
 * once, recorded, not asked again until a restart. Per account because support can differ between
 * accounts. Other skips ("not returned", too few viewers) are asked again next time.
 */
const refused = new Map<string, Set<string>>();

async function collectAccount(d: InsightsDeps, a: InsightsAccount, now: Date): Promise<string[]> {
  const notes: string[] = [];
  const state = await d.getState(a.accountId);
  const accountDue = !state?.lastAccountRunAt || now.getTime() - state.lastAccountRunAt.getTime() >= POLL.accountEveryMs - 5 * 60_000;
  if (accountDue) {
    await d.upsertMedia(a.accountId, await d.ig.recentMedia(a, POLL.recentMedia));
    const profile = await d.ig.profile(a);
    if (profile.followers !== null) {
      await d.upsertSnapshots([{ accountsId: a.accountId, scope: "account", igMediaId: "", metric: "followers_count", value: profile.followers, skippedReason: null, bucket: dayBucket(now) }]);
      if (!state?.backfilledAt) {
        const note = await backfillFollowers(d, a, now, profile.followers);
        if (note) notes.push(note);
      }
    }
    const days = daysToRead(now, !!state?.backfilledAt);
    for (const day of days) {
      await d.upsertSnapshots(snapshotRows(a.accountId, "account", "", day, await d.ig.dayTotals(a, ACCOUNT_DAY_METRICS, day)));
    }
    await d.setState(a.accountId, { lastAccountRunAt: now, lastError: null, ...(state?.backfilledAt ? {} : { backfilledAt: now }) });
    notes.push(`account (${days.length} day${days.length === 1 ? "" : "s"})`);
  }
  let polled = 0;
  for (const m of await d.listMediaToPoll(a.accountId, POLL.recentMedia)) {
    if (!mediaDue(m, now)) continue;
    const key = `${a.accountId}:${m.productType ?? "?"}`;
    const skip = refused.get(key) ?? new Set<string>();
    const metrics = metricsFor(m.productType).filter((x) => !skip.has(x));
    const r = await d.ig.mediaInsights(a, m.igMediaId, metrics);
    for (const x of r.unsupported) skip.add(x);
    refused.set(key, skip);
    await d.upsertSnapshots(snapshotRows(a.accountId, "media", m.igMediaId, hourBucket(now), r));
    await d.markPolled(a.accountId, m.igMediaId, now);
    polled++;
  }
  if (polled) notes.push(`${polled} media`);
  return notes;
}

export async function runInsightsOnce(d: InsightsDeps): Promise<void> {
  const now = d.now();
  for (const a of await d.listAccounts()) {
    try {
      const notes = await collectAccount(d, a, now);
      if (notes.length) console.log(`[social-insights] account ${a.accountId}: ${notes.join(", ")}`);
    } catch (err: any) {
      if (err?.code === "42P01") {
        console.warn("[social-insights] the insights tables do not exist yet: run script/create-social-studio-tables.mjs. Skipping this run.");
        return;
      }
      const msg = String(err?.message ?? err).slice(0, 300);
      console.error(`[social-insights] account ${a.accountId}: ${msg}`);
      await d.setState(a.accountId, { lastError: msg }).catch(() => {});
    }
  }
}

/** For tests: forget what Meta refused. */
export function resetRefusedMetrics(): void {
  refused.clear();
}

let running = false;

async function tick(): Promise<void> {
  if (running) return;
  running = true;
  try {
    const { liveInsightsDeps } = await import("./insightsLive");
    await runInsightsOnce(liveInsightsDeps());
  } catch (err: any) {
    console.error(`[social-insights] tick failed: ${err?.message ?? err}`);
  } finally {
    running = false;
  }
}

export function startSocialInsights(): void {
  console.log("[social-insights] started (1h)");
  // Spread from the other jobs: first run 2 to 7 minutes after start.
  const first = 120_000 + Math.floor(Math.random() * 300_000);
  setTimeout(() => {
    void tick();
    setInterval(() => void tick(), POLL.tickMs);
  }, first);
}
