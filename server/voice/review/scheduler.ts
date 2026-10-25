/**
 * The weekly voice call review scheduler: an hourly tick in this process. From Monday 07:00
 * (Europe/Amsterdam) the week before is due; every tick offers it to each account with phone calls
 * in it, and claimWeeklyReview lets exactly one tick review each account and week, so a restart, a
 * missed hour or an overlapping tick never reviews a week twice.
 */
import { dueWeek, type ReviewWeek } from "./weekWindow";
import { liveReviewDeps, runReview, type ReviewJob } from "./runReview";

const FIRST_TICK_MS = 5 * 60_000;
const TICK_MS = 60 * 60_000;

export interface WeeklyDeps {
  now(): Date;
  accountsWithCalls(start: Date, end: Date): Promise<number[]>;
  claim(accountId: number, week: ReviewWeek): Promise<number | null>;
  run(job: ReviewJob): Promise<"done" | "failed">;
  /** Marks reviews that stalled and will not run again (manual, or weekly with every attempt used) as failed, so none shows as running forever. */
  failStalled?(): Promise<number>;
}

const messageOf = (err: unknown) => (err instanceof Error ? err.message : String(err));

/** Runs the due week's review for every account that has calls in it. Returns how many reviews ran. */
export async function tickWeeklyReviews(deps: WeeklyDeps): Promise<number> {
  if (deps.failStalled) {
    try {
      const n = await deps.failStalled();
      if (n > 0) console.warn(`[voice-review] ${n} stalled review(s) marked failed`);
    } catch (err) {
      console.error(`[voice-review] could not fail stalled reviews: ${messageOf(err)}`);
    }
  }
  const week = dueWeek(deps.now());
  const accounts = await deps.accountsWithCalls(week.periodStart, week.periodEnd);
  let ran = 0;
  for (const accountId of accounts) {
    try {
      const reviewId = await deps.claim(accountId, week);
      if (reviewId == null) continue;
      await deps.run({ reviewId, accountId, periodStart: week.periodStart, periodEnd: week.periodEnd });
      ran++;
    } catch (err) {
      console.error(`[voice-review] account ${accountId} week ${week.weekKey}: ${messageOf(err)}`);
    }
  }
  return ran;
}

/** A call while the previous one is still running returns at once. Errors are logged, never thrown. */
export function guarded(fn: () => Promise<unknown>): () => Promise<void> {
  let running = false;
  return async () => {
    if (running) return;
    running = true;
    try { await fn(); }
    catch (err) { console.error(`[voice-review] tick failed: ${messageOf(err)}`); }
    finally { running = false; }
  };
}

function liveWeeklyDeps(): WeeklyDeps {
  const storage = async () => (await import("../../storage")).storage;
  return {
    now: () => new Date(),
    accountsWithCalls: async (start, end) => (await storage()).accountsWithElevenCalls(start, end),
    claim: async (accountId, week) => (await storage()).claimWeeklyReview(accountId, week),
    run: (job) => runReview(liveReviewDeps(), job),
    failStalled: async () => (await storage()).failStalledReviews(),
  };
}

export function startVoiceReviewScheduler(): void {
  console.log("[voice-review] started (1h)");
  const tick = guarded(() => tickWeeklyReviews(liveWeeklyDeps()));
  setTimeout(() => {
    void tick();
    setInterval(() => void tick(), TICK_MS);
  }, FIRST_TICK_MS);
}
