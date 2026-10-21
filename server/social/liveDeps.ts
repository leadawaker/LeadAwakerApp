// Real storage, Instagram and notification wiring for the publisher and the token refresher.
// Kept apart from publisher.ts / tokenRefresher.ts so their tests never load the database.
import type { SocialConnection } from "@shared/schema";
import { storage } from "../storage";
import {
  createReelContainer,
  defaultIgDeps,
  getContainerStatus,
  getPermalink,
  getPublishingQuotaLeft,
  publishContainer,
  refreshLongLivedToken,
} from "./instagramApi";
import { SOCIAL_UPLOAD_DIR } from "./media";
import { notifyAccountManagers, notifyAgency } from "./notify";
import type { PublisherDeps } from "./publisher";
import { cleanupOrphanUploads, type RefresherDeps } from "./tokenRefresher";
import { DEFAULT_TIMEZONE } from "@shared/socialPosts";

const DEFAULT_MEDIA_BASE = "https://app.leadawaker.com";

function mediaBase(): string {
  return (process.env.SOCIAL_MEDIA_BASE_URL || DEFAULT_MEDIA_BASE).replace(/\/+$/, "");
}

export function livePublisherDeps(): PublisherDeps {
  const ig = defaultIgDeps();
  return {
    now: () => new Date(),
    listDue: (now) => storage.listDueSocialPosts(now),
    listPublishing: () => storage.listPublishingSocialPosts(),
    listNeedingReminder: (now) => storage.listPostsNeedingReminder(now),
    async getConnection(accountId) {
      const c = await storage.getSocialConnection(accountId);
      if (!c || !c.externalUserId) return null;
      return { status: c.status, externalUserId: c.externalUserId, token: storage.getSocialAccessToken(c) };
    },
    async getAccount(accountId) {
      const a = await storage.getAccountById(accountId);
      return a ? { timeZone: a.timezone || DEFAULT_TIMEZONE, language: a.language } : null;
    },
    updateIf: (postId, allowed, fields, opts) => storage.updateSocialPostIf(postId, allowed, fields, opts),
    ig: {
      createReelContainer: (u, t, input) => createReelContainer(u, t, input, ig),
      getContainerStatus: (c, t) => getContainerStatus(c, t, ig),
      publishContainer: (u, t, c) => publishContainer(u, t, c, ig),
      getPermalink: (m, t) => getPermalink(m, t, ig),
      getPublishingQuotaLeft: (u, t) => getPublishingQuotaLeft(u, t, ig),
    },
    mediaUrl: (publicId, ext) => `${mediaBase()}/media/social/${publicId}.${ext}`,
    notifyAgency,
    notifyAccountManagers,
  };
}

export function liveRefresherDeps(): RefresherDeps {
  const ig = defaultIgDeps();
  return {
    now: () => new Date(),
    listConnections: () => storage.listSocialConnectionsForRefresh(),
    // listConnections hands back full rows, so the narrower type is a real SocialConnection.
    getToken: (c) => storage.getSocialAccessToken(c as SocialConnection),
    refresh: (token) => refreshLongLivedToken(token, ig),
    updateToken: (id, token, expiresAt) => storage.updateSocialToken(id, token, expiresAt),
    setStatus: (id, status, lastError) => storage.setSocialConnectionStatus(id, status, lastError),
    markWarned: (id, at) => storage.markSocialExpiryWarned(id, at),
    notifyAgency,
  };
}

/** An upload is kept while a post or a studio script uses it. */
async function uploadInUse(publicId: string): Promise<boolean> {
  if ((await storage.getSocialPostByPublicId(publicId)) !== null) return true;
  try {
    return await storage.isUploadHeldByScript(publicId);
  } catch (err: any) {
    // Social_Scripts not created yet (script/create-social-studio-tables.mjs): keep the file, delete nothing by mistake.
    if (err?.code === "42P01") return true;
    throw err;
  }
}

export function liveCleanup(): Promise<number> {
  return cleanupOrphanUploads(SOCIAL_UPLOAD_DIR, uploadInUse, new Date());
}
