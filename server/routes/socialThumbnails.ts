/**
 * Wires the thumbnail creator routes (server/social/thumbnailRoutes.ts) to the real storage, auth,
 * the image model (OpenAI, only when OPENAI_API_KEY is set) and ffmpeg.
 */
import { readFile, mkdir, unlink, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { Express } from "express";
import { storage } from "../storage";
import { requireAuth } from "../auth";
import { claudeJson } from "../aiTextHelper";
import { registerThumbnailRoutes } from "../social/thumbnailRoutes";
import { registerThumbnailTitleRoutes } from "../social/thumbnailTitleRoutes";
import { imageProviderFromEnv, writeThumbnailJpeg } from "../social/thumbnailImage";

export const SOCIAL_THUMBNAIL_DIR = resolve("uploads/social-thumbnails");

export function registerSocialThumbnailRoutes(app: Express): void {
  registerThumbnailTitleRoutes(app, {
    requireAuth,
    now: () => new Date(),
    store: {
      async getAccount(accountId) {
        const a = await storage.getAccountById(accountId);
        return a ? { timezone: a.timezone, language: a.language, socialEnabled: a.socialEnabled === true } : null;
      },
      getSocialSettings: (id) => storage.getSocialSettings(id),
      getSocialScript: (accountId, scriptId) => storage.getSocialScript(accountId, scriptId),
      getSocialPost: (accountId, postId) => storage.getSocialPost(accountId, postId),
    },
    ai: claudeJson,
  });
  registerThumbnailRoutes(app, {
    requireAuth,
    now: () => new Date(),
    dir: SOCIAL_THUMBNAIL_DIR,
    store: {
      async getAccount(accountId) {
        const a = await storage.getAccountById(accountId);
        return a ? { timezone: a.timezone, language: a.language, socialEnabled: a.socialEnabled === true } : null;
      },
      getSocialSettings: (id) => storage.getSocialSettings(id),
      getSocialScript: (accountId, scriptId) => storage.getSocialScript(accountId, scriptId),
      getSocialPost: (accountId, postId) => storage.getSocialPost(accountId, postId),
      listThumbnailRefs: (id) => storage.listThumbnailRefs(id),
      getThumbnailRef: (accountId, refId) => storage.getThumbnailRef(accountId, refId),
      insertThumbnailRef: (row) => storage.insertThumbnailRef(row),
      deleteThumbnailRef: (accountId, refId) => storage.deleteThumbnailRef(accountId, refId),
      listThumbnailStyles: (id) => storage.listThumbnailStyles(id),
      insertThumbnailStyle: (row) => storage.insertThumbnailStyle(row),
      updateThumbnailStyle: (accountId, styleId, fields) => storage.updateThumbnailStyle(accountId, styleId, fields),
      deleteThumbnailStyle: (accountId, styleId) => storage.deleteThumbnailStyle(accountId, styleId),
      listThumbnails: (id) => storage.listThumbnails(id),
      getThumbnail: (accountId, thumbId) => storage.getThumbnail(accountId, thumbId),
      insertThumbnails: (rows) => storage.insertThumbnails(rows),
      updateThumbnails: (ids, fields) => storage.updateThumbnails(ids, fields),
      setThumbnailStarred: (accountId, thumbId, starred) => storage.setThumbnailStarred(accountId, thumbId, starred),
      approveThumbnail: (accountId, thumbId) => storage.approveThumbnail(accountId, thumbId),
      deleteThumbnail: (accountId, thumbId) => storage.deleteThumbnail(accountId, thumbId),
    },
    images: () => imageProviderFromEnv(),
    files: {
      read: (path) => readFile(path),
      async write(path, data) {
        await mkdir(dirname(path), { recursive: true });
        await writeFile(path, data);
      },
      async remove(path) {
        try {
          await unlink(path);
        } catch (err: any) {
          if (err?.code !== "ENOENT") throw err;
        }
      },
      writeJpeg: writeThumbnailJpeg,
    },
  });
}
