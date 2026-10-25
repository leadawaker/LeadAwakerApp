/**
 * "Suggest titles" for the thumbnail form: POST /api/social/accounts/:id/thumbnail-titles answers with a
 * few short cover titles written from a script, a post caption or a typed idea. Saves nothing. Agency or
 * a Manager (canManageSocial), like the rest of the thumbnail creator. Same layering as thumbnailRoutes.ts:
 * all I/O comes in through TitleDeps, so the route is tested over HTTP with a fake model.
 */
import type { Express, RequestHandler } from "express";
import type { SocialPost, SocialScript, SocialSettings } from "@shared/schema";
import { THUMB_LIMITS } from "@shared/socialThumbnails";
import { wrapAsync } from "../routes/_helpers";
import { canManageSocial, isAgency } from "./access";
import type { AiComplete } from "./captions";
import { actorIdOf, forbidden, makeAccountGate, refused, type GetAccount } from "./gate";
import { createRateLimiter, type RateLimiter } from "./rateLimit";
import { visibleToClient } from "./scripts";
import { suggestTitles } from "./thumbnailTitles";

export interface TitleDeps {
  requireAuth: RequestHandler;
  now(): Date;
  store: {
    getAccount: GetAccount;
    getSocialSettings(accountId: number): Promise<SocialSettings | null>;
    getSocialScript(accountId: number, scriptId: number): Promise<SocialScript | null>;
    getSocialPost(accountId: number, postId: number): Promise<SocialPost | null>;
  };
  /** claudeJson (server/aiTextHelper.ts). */
  ai: AiComplete;
}

/** 30 title requests per user per 10 minutes. */
export function titleLimiter(): RateLimiter {
  return createRateLimiter({ max: 30, windowMs: 10 * 60_000 });
}

const positiveInt = (v: unknown) => typeof v === "number" && Number.isInteger(v) && v > 0;

export function registerThumbnailTitleRoutes(app: Express, deps: TitleDeps, limiter: RateLimiter = titleLimiter()): void {
  const { store } = deps;
  const accountGate = makeAccountGate((id) => store.getAccount(id));
  const inFlight = new Set<number>();

  app.post("/api/social/accounts/:id/thumbnail-titles", deps.requireAuth, wrapAsync(async (req, res) => {
    const ctx = await accountGate(req, res);
    if (!ctx) return;
    if (!canManageSocial(req.user, ctx.accountId)) return forbidden(res);
    const userId = actorIdOf(req, res);
    if (userId === null) return;

    const { scriptId, postId, about, avoid } = req.body ?? {};
    if ((scriptId != null && !positiveInt(scriptId)) || (postId != null && !positiveInt(postId))) return res.status(400).json({ message: "Invalid source" });
    const hint = typeof about === "string" ? about.slice(0, THUMB_LIMITS.prompt) : "";
    const seen = Array.isArray(avoid) ? avoid.filter((a): a is string => typeof a === "string").map((a) => a.slice(0, 80)).slice(0, 15) : [];

    let context: { kind: "script" | "post"; text: string } | null = null;
    if (scriptId != null) {
      const script = await store.getSocialScript(ctx.accountId, scriptId);
      // A client user only reaches the scripts that were sent to them.
      if (!script || (!isAgency(req.user) && !visibleToClient(script))) return refused(res, 404, "script_missing");
      context = { kind: "script", text: script.body.trim() || script.title };
    } else if (postId != null) {
      const post = await store.getSocialPost(ctx.accountId, postId);
      if (!post) return refused(res, 404, "post_missing");
      context = { kind: "post", text: post.caption };
    }
    if (!context?.text.trim() && !hint.trim()) return refused(res, 422, "no_input");

    if (inFlight.has(userId)) return refused(res, 429, "busy");
    const now = deps.now().getTime();
    if (!limiter.take(`titles:${userId}`, now)) {
      res.setHeader("Retry-After", String(limiter.retryAfterS(`titles:${userId}`, now)));
      return refused(res, 429, "rate_limited");
    }
    inFlight.add(userId);
    try {
      const settings = await store.getSocialSettings(ctx.accountId);
      const outcome = await suggestTitles(deps.ai, {
        context: context?.text.trim() ? context : null,
        hint,
        aboutMe: settings?.aboutMe ?? "",
        language: ctx.language,
        avoid: seen,
      });
      if (!outcome.ok) return refused(res, outcome.reason === "no_input" ? 422 : 502, outcome.reason);
      res.json({ options: outcome.options });
    } finally {
      inFlight.delete(userId);
    }
  }));
}
