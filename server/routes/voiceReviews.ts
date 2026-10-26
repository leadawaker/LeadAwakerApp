// The voice call review (Voice tab): the saved reviews, a run over a picked period, and the labels
// (caller name or number) of the calls they cite. Owner only, like the
// prompt routes: the review proposes edits to the shared ElevenLabs prompt. A run never writes the
// live prompt, it only adds change cards (routes/voicePromptDrafts.ts decides what happens to them).
import type { Express } from "express";
import { storage } from "../storage";
import { requireOwner } from "../auth";
import { accountIdFor, wrapAsync } from "./_helpers";
import { dayRange, lastDays } from "../voice/review/weekWindow";
import { liveReviewDeps, runReview } from "../voice/review/runReview";

export function registerVoiceReviewRoutes(app: Express) {
  app.get("/api/accounts/:id/voice/reviews", requireOwner, wrapAsync(async (req, res) => {
    const accountId = accountIdFor(req, res);
    if (accountId == null) return;
    // No scheduler runs any more to end a review a restart cut off: the list does it, so the page stops polling.
    await storage.failStalledReviews();
    res.json(await storage.listVoiceReviews(accountId));
  }));

  app.get("/api/accounts/:id/voice/reviews/:rid", requireOwner, wrapAsync(async (req, res) => {
    const accountId = accountIdFor(req, res);
    if (accountId == null) return;
    const rid = Number(req.params.rid);
    if (!Number.isInteger(rid) || rid <= 0) return res.status(400).json({ message: "Invalid review id" });
    const review = await storage.getVoiceReview(accountId, rid);
    if (!review) return res.status(404).json({ message: "Review not found" });
    res.json(review);
  }));

  // Who each cited call was with: the lead's name or the caller's number, and when.
  app.get("/api/accounts/:id/voice/call-labels", requireOwner, wrapAsync(async (req, res) => {
    const accountId = accountIdFor(req, res);
    if (accountId == null) return;
    res.json(await storage.voiceCallLabels(accountId));
  }));

  // Reviews the picked days ({ from, to }: YYYY-MM-DD, Amsterdam, both included), or the last 7 days
  // without them; `withTests: true` counts browser test calls too. The review itself takes minutes, so this answers 202 and the page polls the list.
  app.post("/api/accounts/:id/voice/reviews/run", requireOwner, wrapAsync(async (req, res) => {
    const accountId = accountIdFor(req, res);
    if (accountId == null) return;
    const { from, to, withTests } = (req.body ?? {}) as { from?: unknown; to?: unknown; withTests?: unknown };
    let period = lastDays(new Date());
    if (from != null || to != null) {
      const picked = dayRange(from, to, new Date());
      if (!picked.ok) return res.status(400).json({ message: "Invalid period", reason: picked.reason });
      period = picked;
    }
    const reviewId = await storage.createManualReview(accountId, period.periodStart, period.periodEnd);
    if (reviewId == null) return res.status(409).json({ message: "A review is already running." });
    res.status(202).json({ id: reviewId });
    void runReview(liveReviewDeps(), {
      reviewId, accountId, periodStart: period.periodStart, periodEnd: period.periodEnd, withTests: withTests === true,
    });
  }));
}
