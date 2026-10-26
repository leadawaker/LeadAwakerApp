// The weekly voice call review (Voice tab): the saved reviews and "Run now". Owner only, like the
// prompt routes: the review proposes edits to the shared ElevenLabs prompt. A run never writes the
// live prompt, it only adds change cards (routes/voicePromptDrafts.ts decides what happens to them).
import type { Express } from "express";
import { storage } from "../storage";
import { requireOwner } from "../auth";
import { accountIdFor, wrapAsync } from "./_helpers";
import { lastDays } from "../voice/review/weekWindow";
import { liveReviewDeps, runReview } from "../voice/review/runReview";

export function registerVoiceReviewRoutes(app: Express) {
  app.get("/api/accounts/:id/voice/reviews", requireOwner, wrapAsync(async (req, res) => {
    const accountId = accountIdFor(req, res);
    if (accountId == null) return;
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

  // Reviews the last 7 days. The review itself takes minutes, so this answers 202 and the page polls the list.
  app.post("/api/accounts/:id/voice/reviews/run", requireOwner, wrapAsync(async (req, res) => {
    const accountId = accountIdFor(req, res);
    if (accountId == null) return;
    const period = lastDays(new Date());
    const reviewId = await storage.createManualReview(accountId, period.periodStart, period.periodEnd);
    if (reviewId == null) return res.status(409).json({ message: "A review is already running." });
    res.status(202).json({ id: reviewId });
    void runReview(liveReviewDeps(), { reviewId, accountId, ...period });
  }));
}
