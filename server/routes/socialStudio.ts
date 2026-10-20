/**
 * Wires the Socials studio routes (server/social/studioRoutes.ts, scriptRoutes.ts) to the real
 * storage, auth, Claude CLI, Groq Whisper, HeyGen (read-only) and the Reel upload checks.
 */
import type { Express } from "express";
import { storage } from "../storage";
import { requireAuth } from "../auth";
import { claudeJson } from "../aiTextHelper";
import { transcribeWithGroq, whisperLanguage } from "../lib/groqTranscribe";
import { MAX_UPLOAD_BYTES, SOCIAL_UPLOAD_DIR } from "../social/media";
import { inspectVideo, receiveVideo } from "../social/upload";
import { notifyAccountManagers, notifyAgency } from "../social/notify";
import { heygenFromEnv } from "../social/heygen";
import { aiLimiter, registerStudioRoutes } from "../social/studioRoutes";
import { registerScriptRoutes } from "../social/scriptRoutes";
import { dmLiveSwitchOn } from "../social/dmSafety";
import type { StudioDeps } from "../social/studioDeps";

export function registerSocialStudioRoutes(app: Express): void {
  const deps: StudioDeps = {
    requireAuth,
    now: () => new Date(),
    uploadDir: SOCIAL_UPLOAD_DIR,
    maxUploadBytes: MAX_UPLOAD_BYTES,
    store: {
      async getAccount(accountId) {
        const a = await storage.getAccountById(accountId);
        return a ? { timezone: a.timezone, language: a.language, socialEnabled: a.socialEnabled === true } : null;
      },
      getSocialSettings: (id) => storage.getSocialSettings(id),
      upsertSocialSettings: (id, fields, userId) => storage.upsertSocialSettings(id, fields, userId),
      listSocialTopics: (id) => storage.listSocialTopics(id),
      insertSocialTopic: (row) => storage.insertSocialTopic(row),
      updateSocialTopic: (accountId, topicId, fields) => storage.updateSocialTopic(accountId, topicId, fields),
      listSocialScripts: (id) => storage.listSocialScripts(id),
      getSocialScript: (accountId, scriptId) => storage.getSocialScript(accountId, scriptId),
      insertSocialScript: (row) => storage.insertSocialScript(row),
      updateSocialScript: (accountId, scriptId, fields) => storage.updateSocialScript(accountId, scriptId, fields),
      listHeygenPulls: (id) => storage.listHeygenPulls(id),
      insertHeygenPull: (row) => storage.insertHeygenPull(row),
      listSocialPosts: (id) => storage.listSocialPosts(id),
      getSocialPost: (accountId, postId) => storage.getSocialPost(accountId, postId),
      getSocialPostByPublicId: (publicId) => storage.getSocialPostByPublicId(publicId),
    },
    ai: claudeJson,
    transcribe: (audio, mimeType, language) => transcribeWithGroq(audio, mimeType, { language: whisperLanguage(language) }),
    heygen: heygenFromEnv,
    video: { receive: receiveVideo, inspect: inspectVideo },
    dmLiveSwitch: dmLiveSwitchOn,
    notifyAgency,
    notifyAccountManagers,
  };
  // One limiter for both AI buttons, so a user cannot get around it by alternating.
  const limiter = aiLimiter();
  registerStudioRoutes(app, deps, limiter);
  registerScriptRoutes(app, deps, limiter);
}
