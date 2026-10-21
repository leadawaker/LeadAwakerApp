/**
 * Wires the "Upgrade with AI" routes (server/social/settingsUpgradeRoutes.ts) to the real storage,
 * Claude CLI, ffmpeg and Groq Whisper. Called from socialStudio.ts so it shares the AI limiter.
 */
import type { Express } from "express";
import { storage } from "../storage";
import { requireAuth } from "../auth";
import { claudeJson } from "../aiTextHelper";
import { transcribeWithGroq, whisperLanguage } from "../lib/groqTranscribe";
import { MAX_UPLOAD_BYTES } from "../social/media";
import type { RateLimiter } from "../social/rateLimit";
import { registerSettingsUpgradeRoutes } from "../social/settingsUpgradeRoutes";
import { transcribeVideoStream } from "../social/videoAudio";

export function registerSocialUpgradeRoutes(app: Express, limiter: RateLimiter): void {
  registerSettingsUpgradeRoutes(app, {
    requireAuth,
    now: () => new Date(),
    maxUploadBytes: MAX_UPLOAD_BYTES,
    async getAccount(accountId) {
      const a = await storage.getAccountById(accountId);
      return a ? { timezone: a.timezone, language: a.language, socialEnabled: a.socialEnabled === true } : null;
    },
    getAboutMe: async (accountId) => (await storage.getSocialSettings(accountId))?.aboutMe ?? "",
    listInsightCaptions: async (accountId, limit) =>
      (await storage.listInsightMedia(accountId, limit)).map((m) => ({ caption: m.caption, at: m.postedAt ?? m.firstSeenAt, igMediaId: m.igMediaId, postId: m.postId })),
    listPublishedPostCaptions: async (accountId) =>
      (await storage.listSocialPosts(accountId)).filter((p) => p.status === "published").map((p) => ({ caption: p.caption, at: p.publishedAt, postId: p.id })),
    ai: claudeJson,
    transcribeVideo: (src, maxBytes, language) =>
      transcribeVideoStream(src, maxBytes, (audio, mime) => transcribeWithGroq(audio, mime, { language: whisperLanguage(language) })),
  }, limiter);
}
