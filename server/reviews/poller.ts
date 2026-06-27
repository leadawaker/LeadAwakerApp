// Reputation v2 — review poller (CRM side).
//
// Runs on an interval (>= 15 min per the spec NFR; default 20). Two jobs per
// connected account:
//   1. INGEST  — fetch the location's reviews, insert new ones (status='new').
//                Dedup is enforced by the (account, external id) unique index;
//                the AI draft is produced separately by the engine's review_drafter.
//   2. AUTO-POST — if review_reply_auto_positive is on, post drafted positive
//                  (4-5★) replies via the Business Profile API → status='posted'.
//                  Negatives/neutrals are NEVER auto-posted; they wait for a human
//                  in the approval queue (server/routes/reviews.ts).
//
// Logs each step to Automation_Logs under workflow_name="review_response" so it
// surfaces on the existing Automation Logs page.
//
// ⚠️ Until Google grants Business Profile API access, listReviews/postReply return
// 403 and the poller logs the failure and moves on (set REVIEWS_MOCK=1 to test the
// ingest→post flow against fixtures).

import { db } from "../db";
import { automationLogs } from "@shared/schema";
import type { CalendarConnection } from "@shared/schema";
import { storage } from "../storage";
import {
  REVIEWS_PROVIDER,
  listReviews,
  postReply,
  isPositiveRating,
  ReviewsNotConfiguredError,
  type RemoteReview,
} from "./google";

const POLL_INTERVAL_MS = Number(process.env.REVIEWS_POLL_INTERVAL_MS) || 20 * 60 * 1000;

async function logStep(
  accountsId: number,
  stepName: string,
  status: "Success" | "Failure",
  outputData: string,
  execId: string,
) {
  try {
    await db.insert(automationLogs).values({
      workflowName: "review_response",
      stepName,
      status,
      accountsId,
      outputData: outputData.slice(0, 500),
      workflowExecutionId: execId,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);
  } catch (err) {
    console.warn("[reviews poller] log write failed:", (err as Error).message);
  }
}

/** Make a token-persist callback bound to one account's gbp connection. */
export function persistTokensFor(accountId: number) {
  return (encrypted: string) =>
    storage
      .upsertCalendarConnection({ accountId, provider: REVIEWS_PROVIDER, oauthTokensEncrypted: encrypted } as any)
      .then(() => undefined);
}

async function ingestForAccount(account: any, conn: CalendarConnection, execId: string): Promise<void> {
  const accountId = account.id;
  const persist = persistTokensFor(accountId);
  let remote: RemoteReview[];
  try {
    remote = await listReviews(conn, persist);
  } catch (err: any) {
    if (err instanceof ReviewsNotConfiguredError) return;
    await logStep(accountId, "poll", "Failure", err.message || "listReviews failed", execId);
    return;
  }

  let inserted = 0;
  for (const r of remote) {
    if (!r.externalReviewId) continue;
    if (r.hasReply) continue; // already replied on Google — leave it alone (idempotency)
    const existing = await storage.getReviewByExternalId(accountId, r.externalReviewId);
    if (existing) continue;
    try {
      await storage.insertReview({
        accountsId: accountId,
        platform: "google",
        externalReviewId: r.externalReviewId,
        authorName: r.authorName || null,
        rating: r.rating ?? null,
        reviewText: r.reviewText || null,
        reviewCreatedAt: r.reviewCreatedAt,
        status: "new",
      } as any);
      inserted++;
    } catch {
      // Unique-index race on (account, external id) — already ingested, skip.
    }
  }
  if (inserted > 0) {
    await logStep(accountId, "poll", "Success", `Ingested ${inserted} new review(s)`, execId);
  }
}

async function autoPostForAccount(account: any, conn: CalendarConnection, execId: string): Promise<void> {
  if (!(account.reviewReplyAutoPositive ?? account.review_reply_auto_positive)) return;
  const accountId = account.id;
  const drafted = await storage.listAutoPostable(accountId);
  const persist = persistTokensFor(accountId);
  for (const review of drafted) {
    if (!isPositiveRating(review.rating)) continue; // never auto-post non-positives
    if (!review.draftReply || !review.externalReviewId) continue;
    try {
      await postReply(conn, review.externalReviewId, review.draftReply, persist);
      await storage.updateReview(review.id, {
        status: "posted",
        postedReply: review.draftReply,
        postedAt: new Date(),
      } as any);
      await logStep(accountId, "auto_post", "Success", `Posted reply to review #${review.id} (${review.rating}★)`, execId);
    } catch (err: any) {
      await logStep(accountId, "auto_post", "Failure", `review #${review.id}: ${err.message}`, execId);
    }
  }
}

let timer: NodeJS.Timeout | null = null;
let running = false;

async function runOnce(onlyAccountId?: number): Promise<void> {
  // Guard against overlapping runs (interval tick colliding with a manual poll),
  // which would double-post the same drafted reply before status flips to 'posted'.
  if (running) {
    console.log("[reviews poller] run already in progress, skipping");
    return;
  }
  running = true;
  try {
    const execId = `review_poll_${Date.now()}`;
    let accounts: any[];
    try {
      accounts = await storage.getAccounts();
    } catch (err) {
      console.warn("[reviews poller] getAccounts failed:", (err as Error).message);
      return;
    }
    const enabled = accounts.filter(
      (a) =>
        (a.enableReviewResponse ?? a.enable_review_response) &&
        (onlyAccountId == null || a.id === onlyAccountId),
    );
    for (const account of enabled) {
      try {
        const conn = await storage.getCalendarConnection(account.id, REVIEWS_PROVIDER);
        if (!conn || !conn.externalId) continue; // not connected / no location selected
        await ingestForAccount(account, conn, execId);
        await autoPostForAccount(account, conn, execId);
      } catch (err) {
        console.warn(`[reviews poller] account ${account.id} failed:`, (err as Error).message);
      }
    }
  } finally {
    running = false;
  }
}

/** Start the periodic review poller. Safe to call once at server startup. */
export function startReviewPoller(): void {
  if (timer) return;
  // First run shortly after boot, then on the interval.
  setTimeout(() => { runOnce().catch(() => {}); }, 30_000);
  timer = setInterval(() => { runOnce().catch(() => {}); }, POLL_INTERVAL_MS);
  console.log(`[reviews poller] started (every ${Math.round(POLL_INTERVAL_MS / 60000)} min)`);
}

/** Trigger an immediate poll (used by the manual "refresh" route). */
export async function pollNow(accountId?: number): Promise<void> {
  await runOnce(accountId);
}
