// Reputation v2 — public review response routes (Google Business Profile).
//
// OAuth (reuse-the-Google-app) + location selection + the approval queue. The AI
// draft is produced by the engine (review_drafter); these routes own Google I/O
// (poll/post) and the human approve/edit/reject step. Posting happens here because
// the CRM holds the OAuth tokens.

import type { Express } from "express";
import { storage } from "../storage";
import { requireAuth, requireAgency } from "../auth";
import { wrapAsync } from "./_helpers";
import {
  REVIEWS_PROVIDER,
  getAuthUrl,
  exchangeCode,
  listLocations,
  postReply,
  ReviewsNotConfiguredError,
} from "../reviews/google";
import { pollNow, persistTokensFor } from "../reviews/poller";

function frontendBase(req: import("express").Request): string {
  return process.env.FRONTEND_URL || `${req.protocol}://${req.get("host")}`;
}

export function registerReviewsRoutes(app: Express): void {
  // ─── OAuth: start ─────────────────────────────────────────────────────────
  app.get("/api/reviews/oauth/google/authorize", requireAuth, requireAgency, wrapAsync(async (req, res) => {
    const accountId = Number(req.query.accountId);
    if (!accountId) return res.status(400).json({ message: "accountId required" });
    try {
      res.redirect(getAuthUrl(accountId));
    } catch (err: any) {
      if (err instanceof ReviewsNotConfiguredError) return res.status(501).json({ message: err.message });
      throw err;
    }
  }));

  // ─── OAuth: callback (browser redirect from Google; accountId in `state`) ──
  app.get("/api/reviews/oauth/google/callback", wrapAsync(async (req, res) => {
    const base = frontendBase(req);
    const dest = (status: string, extra = "") => `${base}/platform/accounts?reviews=${status}${extra}`;

    const error = req.query.error as string;
    if (error) return res.redirect(dest("error", `&reason=${encodeURIComponent(error)}`));

    const code = req.query.code as string;
    const accountId = Number(req.query.state);
    if (!code || !accountId) return res.redirect(dest("error", "&reason=missing_code"));

    try {
      const fields = await exchangeCode(code);
      await storage.upsertCalendarConnection({ accountId, ...fields } as any);
      res.redirect(dest("connected"));
    } catch (err: any) {
      console.error("[Reviews OAuth] callback error:", err);
      res.redirect(dest("error"));
    }
  }));

  // ─── Connection status for the settings card ──────────────────────────────
  app.get("/api/accounts/:id/reviews/connection", requireAuth, requireAgency, wrapAsync(async (req, res) => {
    const accountId = Number(req.params.id);
    const conn = await storage.getCalendarConnection(accountId, REVIEWS_PROVIDER);
    if (!conn) return res.json({ connected: false });
    res.json({
      connected: true,
      status: conn.status,
      displayName: conn.displayName,
      locationName: conn.externalId,      // accounts/{a}/locations/{l} when chosen
      locationSelected: !!conn.externalId,
      lastError: conn.lastError,
    });
  }));

  // ─── List the connected account's Business Profile locations ──────────────
  app.get("/api/accounts/:id/reviews/locations", requireAuth, requireAgency, wrapAsync(async (req, res) => {
    const accountId = Number(req.params.id);
    const conn = await storage.getCalendarConnection(accountId, REVIEWS_PROVIDER);
    if (!conn) return res.status(400).json({ message: "Google Business Profile not connected" });
    try {
      const locations = await listLocations(conn, persistTokensFor(accountId));
      res.json(locations);
    } catch (err: any) {
      if (err instanceof ReviewsNotConfiguredError) return res.status(501).json({ message: err.message });
      // Surface Google access-not-granted (403) clearly to the UI.
      res.status(err.status === 403 ? 403 : 502).json({ message: err.message || "Could not list locations" });
    }
  }));

  // ─── Select the location to monitor ───────────────────────────────────────
  app.post("/api/accounts/:id/reviews/location", requireAuth, requireAgency, wrapAsync(async (req, res) => {
    const accountId = Number(req.params.id);
    const { name, title } = req.body || {};
    if (!name) return res.status(400).json({ message: "location name required" });
    const conn = await storage.getCalendarConnection(accountId, REVIEWS_PROVIDER);
    if (!conn) return res.status(400).json({ message: "Google Business Profile not connected" });
    await storage.upsertCalendarConnection({
      accountId,
      provider: REVIEWS_PROVIDER,
      externalId: name,
      displayName: title || conn.displayName,
    } as any);
    res.json({ ok: true });
  }));

  // ─── Disconnect ───────────────────────────────────────────────────────────
  app.post("/api/reviews/disconnect", requireAuth, requireAgency, wrapAsync(async (req, res) => {
    const accountId = Number(req.body?.accountId);
    if (!accountId) return res.status(400).json({ message: "accountId required" });
    const ok = await storage.deleteCalendarConnection(accountId, REVIEWS_PROVIDER);
    res.json({ ok });
  }));

  // ─── Approval queue ───────────────────────────────────────────────────────
  // ?status=new,drafted (default: everything not posted/skipped)
  app.get("/api/accounts/:id/reviews", requireAuth, requireAgency, wrapAsync(async (req, res) => {
    const accountId = Number(req.params.id);
    const statusParam = (req.query.status as string) || "";
    const statuses = statusParam ? statusParam.split(",").map((s) => s.trim()).filter(Boolean) : undefined;
    const reviews = await storage.listReviewsForAccount(accountId, statuses);
    res.json(reviews);
  }));

  // ─── Manual poll (the "refresh" button) ───────────────────────────────────
  app.post("/api/accounts/:id/reviews/poll", requireAuth, requireAgency, wrapAsync(async (_req, res) => {
    await pollNow();
    res.json({ ok: true });
  }));

  // ─── Edit / approve / reject a review draft ───────────────────────────────
  app.patch("/api/reviews/:id", requireAuth, requireAgency, wrapAsync(async (req, res) => {
    const reviewId = Number(req.params.id);
    const { action, draftReply } = req.body || {};
    const review = await storage.getReviewById(reviewId);
    if (!review) return res.status(404).json({ message: "Review not found" });

    if (action === "edit") {
      if (typeof draftReply !== "string") return res.status(400).json({ message: "draftReply required" });
      const updated = await storage.updateReview(reviewId, { draftReply });
      return res.json(updated);
    }

    if (action === "reject") {
      const updated = await storage.updateReview(reviewId, { status: "skipped" });
      return res.json(updated);
    }

    if (action === "approve") {
      const reply = (typeof draftReply === "string" && draftReply.trim()) || review.draftReply || "";
      if (!reply.trim()) return res.status(400).json({ message: "Nothing to post — draft is empty" });
      if (!review.externalReviewId) return res.status(400).json({ message: "Review has no external id" });
      const conn = await storage.getCalendarConnection(review.accountsId, REVIEWS_PROVIDER);
      if (!conn || !conn.externalId) return res.status(400).json({ message: "Google Business Profile not connected" });
      try {
        await postReply(conn, review.externalReviewId, reply, persistTokensFor(review.accountsId));
      } catch (err: any) {
        return res.status(err.status === 403 ? 403 : 502).json({ message: err.message || "Could not post reply to Google" });
      }
      const updated = await storage.updateReview(reviewId, {
        draftReply: reply,
        postedReply: reply,
        status: "posted",
        postedAt: new Date(), // server-side timestamp
      });
      return res.json(updated);
    }

    return res.status(400).json({ message: "Unknown action" });
  }));
}
