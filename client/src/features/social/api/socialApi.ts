// Instagram connection and scheduled posts (server/routes/social.ts, server/social/postRoutes.ts).
import type { ApprovalStatus, PostListSection, SocialPostStatus } from "@shared/socialPosts";
import { apiFetch, API_BASE } from "@/lib/apiUtils";
import { uploadContentType } from "../lib/posts";

export interface SocialConnectionView {
  status: "connected" | "needs_attention" | "disconnected";
  username: string | null;
  profilePictureUrl: string | null;
  accountType: string | null;
  tokenExpiresAt: string | null;
  lastError: string | null;
  scopes: string[];
}

export interface SocialStatus { enabled: boolean; connection: SocialConnectionView | null }

/** A refused request: `reason` is the server's code (translated by the caller), `status` the HTTP status. */
export class SocialApiError extends Error {
  constructor(public reason: string, public status: number) {
    super(reason);
    this.name = "SocialApiError";
  }
}

export async function throwUnlessOk(res: Response): Promise<Response> {
  if (res.ok) return res;
  let reason = "failed";
  try {
    const body = await res.json();
    reason = typeof body?.reason === "string" ? body.reason : reason;
  } catch {
    // not JSON
  }
  throw new SocialApiError(reason, res.status);
}

export function jsonInit(method: string, body?: unknown): RequestInit {
  return body === undefined
    ? { method }
    : { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}

export const socialStatusKey = (accountId: number) => ["social-status", accountId] as const;

export async function fetchSocialStatus(accountId: number): Promise<SocialStatus> {
  const res = await throwUnlessOk(await apiFetch(`/api/social/accounts/${accountId}/status`));
  return res.json();
}

/** Full-page redirect to Instagram; the callback comes back to this same frontend. */
export function startInstagramConnect(accountId: number): void {
  window.location.href = `${API_BASE}/api/social/accounts/${accountId}/instagram/authorize?origin=${encodeURIComponent(window.location.origin)}`;
}

export async function disconnectInstagram(accountId: number): Promise<void> {
  await throwUnlessOk(await apiFetch(`/api/social/accounts/${accountId}/connection`, jsonInit("DELETE")));
}

export async function setSocialEnabled(accountId: number, enabled: boolean): Promise<void> {
  await throwUnlessOk(await apiFetch(`/api/social/accounts/${accountId}/enabled`, jsonInit("PUT", { enabled })));
}

// ─── Scheduled posts ─────────────────────────────────────────────────────────

export interface SocialPostView {
  id: number;
  /** Sent back with Approve and Reject: an edit since the list loaded is refused, not approved unseen. */
  version: string;
  section: PostListSection;
  status: SocialPostStatus;
  approvalStatus: ApprovalStatus;
  requiresApproval: boolean;
  caption: string;
  scheduledAt: string;
  /** Path on the API host: prefix API_BASE (the production frontend is on another host). */
  videoUrl: string;
  durationS: number | null;
  permalink: string | null;
  lastError: string | null;
  approvalNote: string | null;
  approvedByName: string | null;
  waivedByName: string | null;
  shareToFeed: boolean;
  isAiGenerated: boolean;
  /** Path on the API host of the Reel cover (a copy of a thumbnail), or null. */
  coverUrl: string | null;
  coverThumbnailId: number | null;
}

export interface UploadedVideo { uploadId: string; ext: string; durationS: number; width: number; height: number; bytes: number }

export interface PostBody { uploadId: string; caption: string; date: string; time: string; shareToFeed: boolean; isAiGenerated: boolean; requiresApproval: boolean; coverThumbnailId: number | null }

export const socialPostsKey = (accountId: number) => ["social-posts", accountId] as const;

const postsUrl = (accountId: number) => `/api/social/accounts/${accountId}/posts`;

export async function fetchSocialPosts(accountId: number): Promise<SocialPostView[]> {
  const res = await throwUnlessOk(await apiFetch(postsUrl(accountId)));
  return res.json();
}

/**
 * XMLHttpRequest (not fetch) so upload progress is reported. Rejects with the server's reason.
 * Pass a signal to abort it (the panel closed).
 */
export function uploadSocialVideo(accountId: number, file: File, onProgress: (pct: number) => void, signal?: AbortSignal): Promise<UploadedVideo> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE}/api/social/accounts/${accountId}/uploads`);
    xhr.withCredentials = true;
    xhr.setRequestHeader("Content-Type", uploadContentType(file) ?? file.type);
    signal?.addEventListener("abort", () => xhr.abort());
    xhr.onabort = () => reject(new SocialApiError("aborted", 0));
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      let body: any = null;
      try { body = JSON.parse(xhr.responseText); } catch { /* not JSON */ }
      if (xhr.status === 401) {
        // Same as apiFetch: the session expired.
        localStorage.removeItem("leadawaker_auth");
        window.location.href = "/login";
      }
      if (xhr.status >= 200 && xhr.status < 300 && body) resolve(body as UploadedVideo);
      else reject(new SocialApiError(typeof body?.reason === "string" ? body.reason : xhr.status === 413 ? "size" : "failed", xhr.status));
    };
    // A refused oversized upload can close the connection before the 413 is read.
    xhr.onerror = () => reject(new SocialApiError("aborted", 0));
    xhr.send(file);
  });
}

export async function createSocialPost(accountId: number, body: PostBody): Promise<SocialPostView> {
  return (await throwUnlessOk(await apiFetch(postsUrl(accountId), jsonInit("POST", body)))).json();
}

export async function updateSocialPost(accountId: number, postId: number, body: Partial<PostBody>): Promise<void> {
  await throwUnlessOk(await apiFetch(`${postsUrl(accountId)}/${postId}`, jsonInit("PATCH", body)));
}

export async function approveSocialPost(accountId: number, post: Pick<SocialPostView, "id" | "version">): Promise<void> {
  await throwUnlessOk(await apiFetch(`${postsUrl(accountId)}/${post.id}/approve`, jsonInit("POST", { version: post.version })));
}

export async function rejectSocialPost(accountId: number, post: Pick<SocialPostView, "id" | "version">, note: string): Promise<void> {
  await throwUnlessOk(await apiFetch(`${postsUrl(accountId)}/${post.id}/reject`, jsonInit("POST", { version: post.version, note })));
}

export async function retrySocialPost(accountId: number, postId: number): Promise<void> {
  await throwUnlessOk(await apiFetch(`${postsUrl(accountId)}/${postId}/retry`, jsonInit("POST")));
}

export async function cancelSocialPost(accountId: number, postId: number): Promise<void> {
  await throwUnlessOk(await apiFetch(`${postsUrl(accountId)}/${postId}`, jsonInit("DELETE")));
}
