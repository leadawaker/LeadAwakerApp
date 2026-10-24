/**
 * Wires the scheduled-post routes (server/social/postRoutes.ts) to the real storage, auth,
 * ffmpeg-backed upload checks and notifications.
 */
import type { Express } from "express";
import { storage } from "../storage";
import { requireAuth } from "../auth";
import { registerSocialPostRoutes as mountSocialPostRoutes } from "../social/postRoutes";
import { MAX_UPLOAD_BYTES, SOCIAL_UPLOAD_DIR } from "../social/media";
import { inspectVideo, receiveVideo } from "../social/upload";
import { notifyAccountManagers, notifyAgency } from "../social/notify";

export function registerSocialPostRoutes(app: Express): void {
  mountSocialPostRoutes(app, {
    requireAuth,
    now: () => new Date(),
    uploadDir: SOCIAL_UPLOAD_DIR,
    maxUploadBytes: MAX_UPLOAD_BYTES,
    store: {
      async getAccount(accountId) {
        const a = await storage.getAccountById(accountId);
        return a ? { timezone: a.timezone, language: a.language, socialEnabled: a.socialEnabled === true } : null;
      },
      getSocialConnection: (id) => storage.getSocialConnection(id),
      listSocialPosts: (id) => storage.listSocialPosts(id),
      getSocialPost: (accountId, postId) => storage.getSocialPost(accountId, postId),
      getSocialPostByPublicId: (publicId) => storage.getSocialPostByPublicId(publicId),
      getSocialPostByCoverId: (coverPublicId) => storage.getSocialPostByCoverId(coverPublicId),
      getThumbnail: (accountId, thumbnailId) => storage.getThumbnail(accountId, thumbnailId),
      insertSocialPost: (row) => storage.insertSocialPost(row),
      updateSocialPostIf: (postId, allowed, fields, opts) => storage.updateSocialPostIf(postId, allowed, fields, opts),
      getSocialUserNames: (ids) => storage.getSocialUserNames(ids),
      async isUploadHeldByScript(publicId) {
        try {
          return await storage.isUploadHeldByScript(publicId);
        } catch (err: any) {
          if (err?.code === "42P01") return false; // studio tables not created yet: no script holds anything
          throw err;
        }
      },
    },
    video: { receive: receiveVideo, inspect: inspectVideo },
    notifyAgency,
    notifyAccountManagers,
  });
}
