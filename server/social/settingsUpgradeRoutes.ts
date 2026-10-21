/**
 * "Upgrade with AI" routes for Socials > Settings (caption style, voice guide). Agency only, save
 * nothing: the client shows the proposal as a new version in the editor, and the card's normal Save
 * stores it.
 *   GET  /api/social/accounts/:id/settings/upgrade/captions   how many published captions there are
 *   POST /api/social/accounts/:id/settings/upgrade/video      raw video body, returns its transcript
 *   POST /api/social/accounts/:id/settings/upgrade            { field, currentText, notes, useCaptions, transcripts }
 * Same layering as studioRoutes.ts: I/O comes in through UpgradeDeps (wired in routes/socialStudio.ts).
 */
import type { Express, RequestHandler } from "express";
import { wrapAsync } from "../routes/_helpers";
import { isAgency } from "./access";
import type { AiComplete } from "./captions";
import { actorIdOf, forbidden, makeAccountGate, refused, type GetAccount } from "./gate";
import type { RateLimiter } from "./rateLimit";
import {
  MAX_CAPTIONS,
  UPGRADE_SCHEMA,
  UPGRADE_TIMEOUT_MS,
  buildUpgradePrompt,
  hasUpgradeInput,
  parseUpgradeAnswer,
  parseUpgradeBody,
  selectCaptions,
  type CaptionRow,
} from "./settingsUpgrade";
import { isMediaContentType, type VideoTranscript } from "./videoAudio";

export interface UpgradeDeps {
  requireAuth: RequestHandler;
  now(): Date;
  maxUploadBytes: number;
  getAccount: GetAccount;
  getAboutMe(accountId: number): Promise<string>;
  /** Social_Insight_Media rows (what Instagram lists), newest first. */
  listInsightCaptions(accountId: number, limit: number): Promise<CaptionRow[]>;
  /** Published Social_Posts rows. */
  listPublishedPostCaptions(accountId: number): Promise<CaptionRow[]>;
  ai: AiComplete;
  /** videoAudio.transcribeVideoStream bound to Groq in the account's language. */
  transcribeVideo(src: NodeJS.ReadableStream, maxBytes: number, language: string | null): Promise<VideoTranscript>;
}

export function registerSettingsUpgradeRoutes(app: Express, deps: UpgradeDeps, limiter: RateLimiter): void {
  const accountGate = makeAccountGate(deps.getAccount);
  const upgrading = new Set<number>();
  const transcribing = new Set<number>();

  async function captionsFor(accountId: number): Promise<string[]> {
    const [insight, posts] = await Promise.all([deps.listInsightCaptions(accountId, MAX_CAPTIONS * 2), deps.listPublishedPostCaptions(accountId)]);
    return selectCaptions(insight, posts);
  }

  app.get("/api/social/accounts/:id/settings/upgrade/captions", deps.requireAuth, wrapAsync(async (req, res) => {
    const ctx = await accountGate(req, res);
    if (!ctx) return;
    if (!isAgency(req.user)) return forbidden(res);
    res.json({ count: (await captionsFor(ctx.accountId)).length });
  }));

  // ─── One video to text. Streamed to a temp file, never through express.json ─
  app.post("/api/social/accounts/:id/settings/upgrade/video", deps.requireAuth, wrapAsync(async (req, res) => {
    const ctx = await accountGate(req, res);
    if (!ctx) return;
    if (!isAgency(req.user)) return forbidden(res);
    const userId = actorIdOf(req, res);
    if (userId === null) return;
    if (!isMediaContentType(req.headers["content-type"])) return refused(res, 415, "format");
    const declared = Number(req.headers["content-length"]);
    if (Number.isFinite(declared) && declared > deps.maxUploadBytes) {
      res.setHeader("Connection", "close");
      return refused(res, 413, "size");
    }
    if (transcribing.has(userId)) return refused(res, 429, "busy");
    if (!limiter.take(`stt:${userId}`, deps.now().getTime())) return refused(res, 429, "rate_limited");
    transcribing.add(userId);
    try {
      const out = await deps.transcribeVideo(req, deps.maxUploadBytes, ctx.language);
      if (!out.ok) {
        if (out.status === 413) res.setHeader("Connection", "close");
        if (!res.headersSent && !res.destroyed) refused(res, out.status, out.reason);
        return;
      }
      res.json({ text: out.text, durationS: Math.round(out.durationS) });
    } finally {
      transcribing.delete(userId);
    }
  }));

  // ─── The upgrade itself: returns a proposal, saves nothing ────────────────
  app.post("/api/social/accounts/:id/settings/upgrade", deps.requireAuth, wrapAsync(async (req, res) => {
    const ctx = await accountGate(req, res);
    if (!ctx) return;
    if (!isAgency(req.user)) return forbidden(res);
    const userId = actorIdOf(req, res);
    if (userId === null) return;
    const parsed = parseUpgradeBody(req.body);
    if (!parsed.ok) return res.status(400).json({ message: parsed.message });
    const input = parsed.input;
    const captions = input.useCaptions ? await captionsFor(ctx.accountId) : [];
    if (!hasUpgradeInput(input, captions)) return refused(res, 422, "no_input");
    if (upgrading.has(userId)) return refused(res, 429, "busy");
    if (!limiter.take(`ai:${userId}`, deps.now().getTime())) {
      res.setHeader("Retry-After", String(limiter.retryAfterS(`ai:${userId}`, deps.now().getTime())));
      return refused(res, 429, "rate_limited");
    }
    upgrading.add(userId);
    try {
      const prompt = buildUpgradePrompt({ ...input, captions, aboutMe: await deps.getAboutMe(ctx.accountId), accountLanguage: ctx.language });
      const answer = await deps.ai({ ...prompt, model: "opus", timeoutMs: UPGRADE_TIMEOUT_MS, jsonSchema: UPGRADE_SCHEMA });
      if ("error" in answer) {
        console.warn(`[social-upgrade] ${input.field} for account ${ctx.accountId} failed: ${answer.error.slice(0, 200)}`);
        return refused(res, 502, "ai_failed");
      }
      const out = parseUpgradeAnswer(answer.text, input.field);
      if (!out.ok) return refused(res, 502, out.reason === "too_long" ? "result_too_long" : "no_options");
      res.json({ text: out.text, changes: out.changes, captionsUsed: captions.length });
    } finally {
      upgrading.delete(userId);
    }
  }));
}
