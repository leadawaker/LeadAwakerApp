// Publisher ticks against in-memory posts and a fake Instagram. No database, no network.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import type { SocialPost } from "@shared/schema";
import type { ApprovalStatus, SocialPostStatus } from "@shared/socialPosts";
import { IgApiError } from "./instagramApi";
import { runPublishOnce, type PublisherDeps } from "./publisher";

const NOW = new Date("2026-10-27T21:00:30Z");
const ID1 = "0b9f1c1e-0000-4000-8000-000000000001";
const ID2 = "0b9f1c1e-0000-4000-8000-000000000002";
const min = (n: number) => new Date(NOW.getTime() + n * 60_000);

function makePost(over: Partial<SocialPost>): SocialPost {
  return {
    id: 1, accountsId: 7, connectionId: 3, mediaType: "REELS",
    videoPath: `/srv/uploads/social/7/${ID1}.mp4`, videoPublicId: ID1, videoExt: "mp4",
    videoDurationS: 58, videoWidth: 1080, videoHeight: 1920, videoBytes: 1000,
    caption: "Olá", shareToFeed: true, isAiGenerated: true,
    scheduledAt: new Date("2026-10-27T21:00:00Z"),
    requiresApproval: true, approvalStatus: "approved", approvalNote: null,
    approvedByUserId: 21, approvedAt: min(-600), approvalWaivedByUserId: null, approvalWaivedAt: null, approvalReminderSentAt: null,
    status: "scheduled", igContainerId: null, publishingStartedAt: null, igMediaId: null, permalink: null,
    attempts: 0, lastError: null, publishedAt: null, createdByUserId: 1, createdAt: min(-6000), updatedAt: min(-6000),
    ...over,
  } as SocialPost;
}

let posts: SocialPost[];
let connStatus: string | null;
let token: string | null;
let agencyNotes: Array<{ type: string; body: string }>;
let managerNotes: Array<{ key: string; accountId: number }>;
let beforeUpdate: ((p: SocialPost) => void) | null;
let ig: {
  created: Array<{ videoUrl: string; caption: string; shareToFeed: boolean; isAiGenerated: boolean }>;
  publishCalls: number;
  status: { code: "IN_PROGRESS" | "FINISHED" | "ERROR" | "EXPIRED" | "PUBLISHED"; message: string | null };
  quota: number | null;
  createError: ((caption: string) => Error | null) | null;
  publishError: Error | null;
};

function deps(): PublisherDeps {
  return {
    now: () => NOW,
    listDue: async (now) => posts.filter((p) => p.status === "scheduled" && p.scheduledAt <= now).map((p) => ({ ...p })),
    listPublishing: async () => posts.filter((p) => p.status === "publishing").map((p) => ({ ...p })),
    listNeedingReminder: async (now) => posts.filter((p) =>
      p.status === "scheduled" && p.requiresApproval && p.approvalStatus === "pending" && !p.approvalReminderSentAt &&
      p.scheduledAt > now && p.scheduledAt.getTime() - now.getTime() <= 86_400_000).map((p) => ({ ...p })),
    getConnection: async () => (connStatus === null ? null : { status: connStatus, externalUserId: "1784", token }),
    getAccount: async () => ({ timeZone: "America/Sao_Paulo", language: "Portuguese" }),
    updateIf: async (postId, allowed: SocialPostStatus[], fields, opts: { approvalStatuses?: ApprovalStatus[]; content?: { caption: string; videoPublicId: string | null } } = {}) => {
      const p = posts.find((x) => x.id === postId);
      if (!p) return null;
      beforeUpdate?.(p);
      if (!allowed.includes(p.status as SocialPostStatus)) return null;
      if (opts.approvalStatuses?.length && !opts.approvalStatuses.includes(p.approvalStatus as ApprovalStatus)) return null;
      if (opts.content && (opts.content.caption !== p.caption || opts.content.videoPublicId !== p.videoPublicId)) return null;
      Object.assign(p, fields);
      return p;
    },
    ig: {
      createReelContainer: async (_u, _t, input) => {
        const err = ig.createError?.(input.caption);
        if (err) throw err;
        ig.created.push(input);
        return `c${ig.created.length}`;
      },
      getContainerStatus: async () => ig.status,
      publishContainer: async () => {
        if (ig.publishError) throw ig.publishError;
        ig.publishCalls++;
        return "m1";
      },
      getPermalink: async () => "https://www.instagram.com/reel/abc/",
      getPublishingQuotaLeft: async () => ig.quota,
    },
    mediaUrl: (publicId, ext) => `https://app.leadawaker.com/media/social/${publicId}.${ext}`,
    notifyAgency: async (n) => { agencyNotes.push({ type: n.type, body: n.body }); },
    notifyAccountManagers: async (accountId, n) => { managerNotes.push({ key: n.key, accountId }); },
  };
}

beforeEach(() => {
  posts = [];
  connStatus = "connected";
  token = "tok";
  agencyNotes = [];
  managerNotes = [];
  beforeUpdate = null;
  ig = { created: [], publishCalls: 0, status: { code: "IN_PROGRESS", message: null }, quota: 50, createError: null, publishError: null };
});

// ─── Unapproved posts never go out ───────────────────────────────────────────

test("due unapproved post is held, agency notified, nothing sent to Instagram", async () => {
  posts = [makePost({ approvalStatus: "pending" })];
  await runPublishOnce(deps());
  assert.equal(posts[0].status, "held");
  assert.equal(agencyNotes[0].type, "social_post_held");
  assert.equal(ig.created.length, 0);
});

test("a rejected post is held at its time, never published", async () => {
  posts = [makePost({ approvalStatus: "rejected" })];
  await runPublishOnce(deps());
  await runPublishOnce(deps());
  assert.equal(posts[0].status, "held");
  assert.equal(ig.created.length, 0);
});

test("a held post stays held on later ticks, even long after its time", async () => {
  posts = [makePost({ status: "held", approvalStatus: "pending", scheduledAt: min(-6000) })];
  await runPublishOnce(deps());
  assert.equal(posts[0].status, "held");
  assert.equal(ig.created.length, 0);
});

test("a Manager rejecting while the container is created: the post is not claimed for publishing", async () => {
  posts = [makePost({ approvalStatus: "approved" })];
  beforeUpdate = (p) => { p.approvalStatus = "rejected"; };
  await runPublishOnce(deps());
  assert.equal(posts[0].status, "scheduled");
  assert.equal(posts[0].igContainerId, null);
  beforeUpdate = null;
  await runPublishOnce(deps());
  assert.equal(posts[0].status, "held");
  assert.equal(ig.publishCalls, 0);
});

test("a caption edited while the container is created is not published with the old caption", async () => {
  posts = [makePost({ approvalStatus: "approved" })];
  beforeUpdate = (p) => { p.caption = "new caption"; p.approvalStatus = "pending"; };
  await runPublishOnce(deps());
  assert.equal(posts[0].status, "scheduled");
  assert.equal(posts[0].igContainerId, null);
});

test("approval not required: a due post starts", async () => {
  posts = [makePost({ requiresApproval: false, approvalStatus: "not_required" })];
  await runPublishOnce(deps());
  assert.equal(posts[0].status, "publishing");
});

// ─── Start ───────────────────────────────────────────────────────────────────

test("due approved post creates a container with the public media URL and the AI label", async () => {
  posts = [makePost({})];
  await runPublishOnce(deps());
  assert.equal(posts[0].status, "publishing");
  assert.equal(posts[0].igContainerId, "c1");
  assert.ok(posts[0].publishingStartedAt instanceof Date);
  assert.deepEqual(ig.created[0], { videoUrl: `https://app.leadawaker.com/media/social/${ID1}.mp4`, caption: "Olá", shareToFeed: true, isAiGenerated: true });
});

test("future posts wait", async () => {
  posts = [makePost({ scheduledAt: min(5) })];
  await runPublishOnce(deps());
  assert.equal(posts[0].status, "scheduled");
  assert.equal(ig.created.length, 0);
});

test("no publishing quota left: the post waits for the next tick", async () => {
  posts = [makePost({})];
  ig.quota = 0;
  await runPublishOnce(deps());
  assert.equal(posts[0].status, "scheduled");
  assert.equal(ig.created.length, 0);
});

test("disconnected or missing connection fails the due post", async () => {
  posts = [makePost({})];
  connStatus = "disconnected";
  await runPublishOnce(deps());
  assert.equal(posts[0].status, "failed");
  assert.equal(posts[0].lastError, "Instagram disconnected");
  assert.equal(agencyNotes[0].type, "social_post_failed");
  posts = [makePost({ id: 2 })];
  connStatus = null;
  await runPublishOnce(deps());
  assert.equal(posts[0].status, "failed");
});

test("a Graph error creating the container fails the post with Meta's message", async () => {
  posts = [makePost({})];
  ig.createError = () => new IgApiError("Invalid video", 9004, "http");
  await runPublishOnce(deps());
  assert.equal(posts[0].status, "failed");
  assert.match(posts[0].lastError!, /Invalid video/);
});

test("one failing post does not stop the others", async () => {
  posts = [makePost({ id: 1, caption: "boom" }), makePost({ id: 2, videoPublicId: ID2 })];
  ig.createError = (caption) => (caption === "boom" ? new Error("socket hang up") : null);
  await runPublishOnce(deps());
  assert.equal(posts[0].status, "scheduled", "a network error is retried on the next tick");
  assert.equal(posts[1].status, "publishing");
});

test("a network error that keeps failing for 15 minutes fails the post", async () => {
  posts = [makePost({ scheduledAt: min(-16) })];
  ig.createError = () => new Error("socket hang up");
  await runPublishOnce(deps());
  assert.equal(posts[0].status, "failed");
});

test("an edit that moved the post out of 'scheduled' wins over the publisher", async () => {
  posts = [makePost({})];
  beforeUpdate = (p) => { p.status = "cancelled"; };
  await runPublishOnce(deps());
  assert.equal(posts[0].status, "cancelled");
});

// ─── Finish, and a restart mid-post ──────────────────────────────────────────

test("finished container publishes once and stores media id and permalink", async () => {
  posts = [makePost({ status: "publishing", igContainerId: "c1", publishingStartedAt: min(-2) })];
  ig.status = { code: "FINISHED", message: null };
  await runPublishOnce(deps());
  assert.equal(posts[0].status, "published");
  assert.equal(posts[0].igMediaId, "m1");
  assert.equal(posts[0].permalink, "https://www.instagram.com/reel/abc/");
  assert.ok(posts[0].publishedAt instanceof Date);
  assert.equal(ig.publishCalls, 1);
  assert.deepEqual(agencyNotes.map((n) => n.type), ["social_post_published"]);
  assert.deepEqual(managerNotes.map((n) => n.key), ["published"]);
  await runPublishOnce(deps());
  assert.equal(ig.publishCalls, 1, "a published post is never published again");
});

test("restart after the container was created: the next tick resumes from the stored container, no new one", async () => {
  // State a pm2 restart leaves behind: publishing with a container id, nothing in memory.
  posts = [makePost({ status: "publishing", igContainerId: "c9", publishingStartedAt: min(-3) })];
  ig.status = { code: "FINISHED", message: null };
  await runPublishOnce(deps());
  assert.equal(ig.created.length, 0);
  assert.equal(ig.publishCalls, 1);
  assert.equal(posts[0].status, "published");
});

test("restart between media_publish and saving: container already PUBLISHED is marked published without publishing again", async () => {
  posts = [makePost({ status: "publishing", igContainerId: "c1", publishingStartedAt: min(-3) })];
  ig.status = { code: "PUBLISHED", message: null };
  await runPublishOnce(deps());
  assert.equal(posts[0].status, "published");
  assert.equal(ig.publishCalls, 0);
});

test("a publish call that errors is not failed at once: the next tick checks the container again", async () => {
  posts = [makePost({ status: "publishing", igContainerId: "c1", publishingStartedAt: min(-3) })];
  ig.status = { code: "FINISHED", message: null };
  ig.publishError = new Error("timeout");
  await runPublishOnce(deps());
  assert.equal(posts[0].status, "publishing");
  ig.publishError = null;
  ig.status = { code: "PUBLISHED", message: null }; // it went through after all
  await runPublishOnce(deps());
  assert.equal(posts[0].status, "published");
  assert.equal(ig.publishCalls, 0);
});

test("container ERROR fails the post with Meta's message", async () => {
  posts = [makePost({ status: "publishing", igContainerId: "c1", publishingStartedAt: min(-2) })];
  ig.status = { code: "ERROR", message: "Error: video too long" };
  await runPublishOnce(deps());
  assert.equal(posts[0].status, "failed");
  assert.match(posts[0].lastError!, /video too long/);
});

test("IN_PROGRESS after 15 minutes fails as timed out; before that it waits", async () => {
  posts = [makePost({ status: "publishing", igContainerId: "c1", publishingStartedAt: min(-5) })];
  await runPublishOnce(deps());
  assert.equal(posts[0].status, "publishing");
  posts[0].publishingStartedAt = min(-16);
  await runPublishOnce(deps());
  assert.equal(posts[0].status, "failed");
});

// ─── Reminders ───────────────────────────────────────────────────────────────

test("reminder sent once for pending posts within 24h", async () => {
  posts = [makePost({ approvalStatus: "pending", scheduledAt: min(600) })];
  await runPublishOnce(deps());
  await runPublishOnce(deps());
  assert.equal(managerNotes.length, 1);
  assert.equal(managerNotes[0].key, "needs_approval");
  assert.ok(posts[0].approvalReminderSentAt instanceof Date);
});
