// Instagram Reel publisher (spec "Publishing"). Every 60 s:
//   1. Due posts: hold the unapproved ones, fail the ones whose account is disconnected, and start
//      the rest (quota check, create the container with the public video URL, status publishing).
//   2. Publishing posts: poll the container. FINISHED -> media_publish -> published. PUBLISHED (a
//      restart between media_publish and saving) -> published without publishing again. ERROR,
//      EXPIRED, or still processing 15 minutes in -> failed with Meta's message.
//   3. Reminders: the account's Managers hear once, within 24 h of the time, about a post still pending.
//
// State lives in the database only, so a pm2 restart resumes from the stored ig_container_id.
// Every write is conditional (updateIf) on the status, approval and content the decision was made
// from: if a Manager rejects or the agency edits mid-tick, their change wins and nothing goes out.
// Each post has its own try/catch; one failure never stops the tick.
import type { InsertSocialPost, SocialPost } from "@shared/schema";
import { DEFAULT_TIMEZONE, classifyScheduledPost, type ApprovalStatus, type SocialPostStatus } from "@shared/socialPosts";
import { isTransientIgError } from "./instagramApi";
import type { SocialNotifType } from "./notify";
import { formatWhen } from "./postService";

const TICK_MS = 60_000;
const FIRST_RUN_MS = 30_000;
const PROCESSING_TIMEOUT_MS = 15 * 60_000;
/** A due post that keeps hitting network errors (not Graph errors) is retried for this long. */
const START_RETRY_WINDOW_MS = 15 * 60_000;
const POST_LINK = "/platform/accounts?tab=social";
const ERROR_MAX = 500;

type ContainerCode = "IN_PROGRESS" | "FINISHED" | "ERROR" | "EXPIRED" | "PUBLISHED";

export interface PublisherDeps {
  now(): Date;
  /** status scheduled AND scheduled_at <= now */
  listDue(now: Date): Promise<SocialPost[]>;
  listPublishing(): Promise<SocialPost[]>;
  /** scheduled, approval pending, scheduled_at within the next 24 h, reminder not sent */
  listNeedingReminder(now: Date): Promise<SocialPost[]>;
  getConnection(accountId: number): Promise<{ status: string; externalUserId: string; token: string | null } | null>;
  getAccount(accountId: number): Promise<{ timeZone: string; language: string | null } | null>;
  updateIf(
    postId: number,
    allowedStatuses: SocialPostStatus[],
    fields: Partial<InsertSocialPost>,
    opts?: {
      approvalStatuses?: ApprovalStatus[];
      content?: { caption: string; videoPublicId: string | null; scheduledAt?: Date; shareToFeed?: boolean; isAiGenerated?: boolean };
    },
  ): Promise<SocialPost | null>;
  ig: {
    createReelContainer(igUserId: string, token: string, input: { videoUrl: string; caption: string; shareToFeed: boolean; isAiGenerated: boolean }): Promise<string>;
    getContainerStatus(containerId: string, token: string): Promise<{ code: ContainerCode; message: string | null }>;
    publishContainer(igUserId: string, token: string, containerId: string): Promise<string>;
    getPermalink(mediaId: string, token: string): Promise<string | null>;
    getPublishingQuotaLeft(igUserId: string, token: string): Promise<number | null>;
  };
  mediaUrl(publicId: string, ext: string): string;
  notifyAgency(n: { type: SocialNotifType; title: string; body: string; accountId: number; link: string }): Promise<void>;
  notifyAccountManagers(accountId: number, n: { type: SocialNotifType; key: "needs_approval" | "published"; vars: Record<string, string>; link: string }): Promise<void>;
}

function errorText(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.slice(0, ERROR_MAX) || "Unknown error";
}

function label(p: SocialPost): string {
  const first = p.caption.split(/\r?\n/)[0]?.trim() ?? "";
  return first ? `"${first.length > 60 ? `${first.slice(0, 59)}…` : first}"` : `Post ${p.id}`;
}

async function fail(d: PublisherDeps, p: SocialPost, from: SocialPostStatus, reason: string): Promise<void> {
  const updated = await d.updateIf(p.id, [from], { status: "failed", lastError: reason.slice(0, ERROR_MAX) });
  if (!updated) return;
  await d.notifyAgency({
    type: "social_post_failed",
    title: "Instagram post failed",
    body: `${label(p)} (account ${p.accountsId}) failed: ${reason.slice(0, 200)}`,
    accountId: p.accountsId,
    link: POST_LINK,
  });
}

/** The write that claims (or holds) a due post must find it exactly as the decision saw it: approval, content, time and toggles. */
function sameAsSeen(p: SocialPost) {
  return {
    approvalStatuses: [p.approvalStatus as ApprovalStatus],
    content: { caption: p.caption, videoPublicId: p.videoPublicId, scheduledAt: p.scheduledAt, shareToFeed: p.shareToFeed, isAiGenerated: p.isAiGenerated },
  };
}

async function handleDue(d: PublisherDeps, p: SocialPost, now: Date): Promise<void> {
  const conn = await d.getConnection(p.accountsId);
  const action = classifyScheduledPost(
    { status: p.status as SocialPostStatus, requiresApproval: p.requiresApproval, approvalStatus: p.approvalStatus as ApprovalStatus, scheduledAt: p.scheduledAt },
    now,
    conn?.status ?? null,
  );
  if (action === "wait") return;

  if (action === "hold") {
    const held = await d.updateIf(p.id, ["scheduled"], { status: "held" }, sameAsSeen(p));
    if (!held) return;
    await d.notifyAgency({
      type: "social_post_held",
      title: "Instagram post held",
      body: `${label(p)} (account ${p.accountsId}) reached its time without approval. Pick a new time to schedule it again.`,
      accountId: p.accountsId,
      link: POST_LINK,
    });
    return;
  }

  if (action === "fail_disconnected" || !conn) return fail(d, p, "scheduled", "Instagram disconnected");
  if (!conn.token) return fail(d, p, "scheduled", "Instagram token unavailable, reconnect needed");
  if (!p.videoPublicId || !p.videoExt) return fail(d, p, "scheduled", "Video missing");

  try {
    const left = await d.ig.getPublishingQuotaLeft(conn.externalUserId, conn.token).catch(() => null);
    if (left !== null && left <= 0) {
      console.warn(`[social-publisher] post ${p.id}: no Instagram publishing quota left for account ${p.accountsId}; trying again next tick`);
      return;
    }
    const containerId = await d.ig.createReelContainer(conn.externalUserId, conn.token, {
      videoUrl: d.mediaUrl(p.videoPublicId, p.videoExt),
      caption: p.caption,
      shareToFeed: p.shareToFeed,
      isAiGenerated: p.isAiGenerated,
    });
    // An unclaimed container is harmless: Meta expires it after 24 h and nothing is published.
    await d.updateIf(p.id, ["scheduled"], { status: "publishing", igContainerId: containerId, publishingStartedAt: now }, sameAsSeen(p));
  } catch (err) {
    if (!isTransientIgError(err)) return fail(d, p, "scheduled", errorText(err));
    if (now.getTime() - p.scheduledAt.getTime() > START_RETRY_WINDOW_MS) return fail(d, p, "scheduled", errorText(err));
    console.warn(`[social-publisher] post ${p.id}: ${errorText(err)}; retrying next tick`);
  }
}

async function markPublished(d: PublisherDeps, p: SocialPost, token: string, mediaId: string | null, now: Date): Promise<void> {
  const done = await d.updateIf(p.id, ["publishing"], { status: "published", igMediaId: mediaId, publishedAt: now, lastError: null });
  if (!done) return;
  let permalink: string | null = null;
  if (mediaId) {
    permalink = await d.ig.getPermalink(mediaId, token).catch(() => null);
    if (permalink) await d.updateIf(p.id, ["published"], { permalink });
  }
  console.log(`[social-publisher] post ${p.id} (account ${p.accountsId}) published${permalink ? `: ${permalink}` : ""}`);
  await d.notifyAgency({
    type: "social_post_published",
    title: "Instagram post published",
    body: `${label(p)} (account ${p.accountsId}) is live${permalink ? `: ${permalink}` : "."}`,
    accountId: p.accountsId,
    link: POST_LINK,
  });
  await d.notifyAccountManagers(p.accountsId, { type: "social_post_published", key: "published", vars: { caption: p.caption }, link: POST_LINK });
}

async function handlePublishing(d: PublisherDeps, p: SocialPost, now: Date): Promise<void> {
  const startedAt = (p.publishingStartedAt ?? p.updatedAt).getTime();
  const timedOut = now.getTime() - startedAt > PROCESSING_TIMEOUT_MS;
  const conn = await d.getConnection(p.accountsId);
  if (!p.igContainerId || !conn?.token || conn.status === "disconnected") {
    if (timedOut) await fail(d, p, "publishing", !p.igContainerId ? "Container missing" : "Instagram disconnected");
    return;
  }
  const token = conn.token;
  let status: { code: ContainerCode; message: string | null };
  try {
    status = await d.ig.getContainerStatus(p.igContainerId, token);
  } catch (err) {
    if (timedOut) await fail(d, p, "publishing", errorText(err));
    return;
  }

  if (status.code === "PUBLISHED") return markPublished(d, p, token, p.igMediaId, now);
  if (status.code === "ERROR" || status.code === "EXPIRED") {
    return fail(d, p, "publishing", status.message || `Instagram could not process the video (${status.code})`);
  }
  if (status.code === "IN_PROGRESS") {
    if (timedOut) await fail(d, p, "publishing", "Instagram did not finish processing the video within 15 minutes");
    return;
  }
  // FINISHED. A publish error is never a failure straight away: the response may have been lost
  // while the Reel went live, and a failed post can be retried (a second Reel). The error is kept in
  // lastError; only a later tick that still sees FINISHED (so it did not go out) may fail the post.
  if (timedOut && p.lastError) return fail(d, p, "publishing", p.lastError);
  let mediaId: string;
  try {
    mediaId = await d.ig.publishContainer(conn.externalUserId, token, p.igContainerId);
  } catch (err) {
    console.warn(`[social-publisher] post ${p.id}: media_publish failed (${errorText(err)}); checking again next tick`);
    await d.updateIf(p.id, ["publishing"], { lastError: errorText(err) });
    return;
  }
  await markPublished(d, p, token, mediaId, now);
}

async function handleReminder(d: PublisherDeps, p: SocialPost, now: Date): Promise<void> {
  // Mark first: a reminder is better missed once than sent twice.
  const marked = await d.updateIf(p.id, ["scheduled"], { approvalReminderSentAt: now }, { approvalStatuses: ["pending"] });
  if (!marked) return;
  const account = await d.getAccount(p.accountsId);
  await d.notifyAccountManagers(p.accountsId, {
    type: "social_post_needs_approval",
    key: "needs_approval",
    vars: { caption: p.caption, when: formatWhen(p.scheduledAt, account?.timeZone || DEFAULT_TIMEZONE, account?.language) },
    link: POST_LINK,
  });
}

async function each(posts: SocialPost[], fn: (p: SocialPost) => Promise<void>): Promise<void> {
  for (const p of posts) {
    try {
      await fn(p);
    } catch (err) {
      console.error(`[social-publisher] post ${p.id}: ${errorText(err)}`);
    }
  }
}

export async function runPublishOnce(d: PublisherDeps): Promise<void> {
  const now = d.now();
  // Publishing posts first, so a post started in this tick is not polled straight away.
  await each(await d.listPublishing(), (p) => handlePublishing(d, p, now));
  await each(await d.listDue(now), (p) => handleDue(d, p, now));
  await each(await d.listNeedingReminder(now), (p) => handleReminder(d, p, now));
}

let running = false;

/** Live wiring is imported lazily so the tests above never load the database. */
async function tick(): Promise<void> {
  if (running) return;
  running = true;
  try {
    const { livePublisherDeps } = await import("./liveDeps");
    await runPublishOnce(livePublisherDeps());
  } catch (err) {
    console.error(`[social-publisher] tick failed: ${errorText(err)}`);
  } finally {
    running = false;
  }
}

export function startSocialPublisher(): void {
  console.log("[social-publisher] started (60s)");
  setTimeout(() => {
    void tick();
    setInterval(() => void tick(), TICK_MS);
  }, FIRST_RUN_MS);
}
