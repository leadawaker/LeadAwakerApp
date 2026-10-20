/**
 * Socials studio routes, part 1: settings (caption style, voice guide, DM mode), Sobre mim, and the
 * caption writer. Scripts, topics and HeyGen are in scriptRoutes.ts.
 * Spec: docs/superpowers/specs/2026-10-20-caption-writer-and-studio-design.md
 *
 * Same layering as postRoutes.ts: everything with I/O comes in through StudioDeps
 * (server/routes/socialStudio.ts wires the real ones), so the routes are tested over HTTP without
 * a database or a model. Auth: requireAuth, then the account gate (gate.ts), then the action's rule.
 */
import type { Express } from "express";
import { TEXT_LIMITS } from "@shared/socialStudio";
import { wrapAsync } from "../routes/_helpers";
import { canManageSocial, isAgency } from "./access";
import { suggestCaptions } from "./captions";
import { actorIdOf, forbidden, makeAccountGate, refused } from "./gate";
import { createRateLimiter, type RateLimiter } from "./rateLimit";
import { parseAboutBody, parseAgencySettingsBody, toSettingsView } from "./studioSettings";
import type { StudioDeps } from "./studioDeps";

/** The caption writer and the script drafter share this: 12 model calls per user per 10 minutes. */
export function aiLimiter(): RateLimiter {
  return createRateLimiter({ max: 12, windowMs: 10 * 60_000 });
}

export function registerStudioRoutes(app: Express, deps: StudioDeps, limiter: RateLimiter): void {
  const { store } = deps;
  const accountGate = makeAccountGate((id) => store.getAccount(id));
  const inFlight = new Set<number>();

  // ─── Settings: any user of the account reads (clients get Sobre mim only) ──
  app.get("/api/social/accounts/:id/settings", deps.requireAuth, wrapAsync(async (req, res) => {
    const ctx = await accountGate(req, res);
    if (!ctx) return;
    const row = await store.getSocialSettings(ctx.accountId);
    res.json(toSettingsView(row, isAgency(req.user), deps.dmLiveSwitch()));
  }));

  // ─── Settings: agency writes the style, the voice guide and the DM mode ───
  app.put("/api/social/accounts/:id/settings", deps.requireAuth, wrapAsync(async (req, res) => {
    const ctx = await accountGate(req, res);
    if (!ctx) return;
    if (!isAgency(req.user)) return forbidden(res);
    const userId = actorIdOf(req, res);
    if (userId === null) return;
    const parsed = parseAgencySettingsBody(req.body);
    if (!parsed.ok) return res.status(400).json({ message: parsed.message });
    const row = await store.upsertSocialSettings(ctx.accountId, parsed.fields, userId);
    res.json(toSettingsView(row, true, deps.dmLiveSwitch()));
  }));

  // ─── Sobre mim: agency, or a Manager of the account ───────────────────────
  app.put("/api/social/accounts/:id/settings/about", deps.requireAuth, wrapAsync(async (req, res) => {
    const ctx = await accountGate(req, res);
    if (!ctx) return;
    if (!canManageSocial(req.user, ctx.accountId)) return forbidden(res);
    const userId = actorIdOf(req, res);
    if (userId === null) return;
    const parsed = parseAboutBody(req.body);
    if (!parsed.ok) return res.status(400).json({ message: parsed.message });
    const row = await store.upsertSocialSettings(ctx.accountId, parsed.fields, userId);
    res.json(toSettingsView(row, isAgency(req.user), deps.dmLiveSwitch()));
  }));

  // ─── Caption writer: agency, or a Manager. Saves nothing, publishes nothing ─
  app.post("/api/social/accounts/:id/captions/suggest", deps.requireAuth, wrapAsync(async (req, res) => {
    const ctx = await accountGate(req, res);
    if (!ctx) return;
    if (!canManageSocial(req.user, ctx.accountId)) return forbidden(res);
    const userId = actorIdOf(req, res);
    if (userId === null) return;

    const scriptId = req.body?.scriptId;
    let source: { kind: "script" | "about"; text: string };
    if (scriptId !== undefined && scriptId !== null) {
      if (!Number.isInteger(scriptId) || scriptId <= 0) return res.status(400).json({ message: "Invalid scriptId" });
      const script = await store.getSocialScript(ctx.accountId, scriptId);
      if (!script) return res.status(404).json({ message: "Script not found" });
      source = { kind: "script", text: script.body.trim() || script.title };
    } else {
      const about = typeof req.body?.about === "string" ? req.body.about.slice(0, TEXT_LIMITS.captionAbout) : "";
      source = { kind: "about", text: about };
    }
    if (!source.text.trim()) return refused(res, 422, "no_input");

    if (inFlight.has(userId)) return refused(res, 429, "busy");
    if (!limiter.take(`ai:${userId}`, deps.now().getTime())) {
      res.setHeader("Retry-After", String(limiter.retryAfterS(`ai:${userId}`, deps.now().getTime())));
      return refused(res, 429, "rate_limited");
    }
    inFlight.add(userId);
    try {
      const settings = await store.getSocialSettings(ctx.accountId);
      const outcome = await suggestCaptions(deps.ai, {
        source,
        captionStyle: settings?.captionStyle ?? "",
        aboutMe: settings?.aboutMe ?? "",
        language: ctx.language,
      });
      if (!outcome.ok) return refused(res, outcome.reason === "no_input" ? 422 : 502, outcome.reason);
      res.json({ options: outcome.options });
    } finally {
      inFlight.delete(userId);
    }
  }));
}
