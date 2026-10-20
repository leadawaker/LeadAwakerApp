import { test } from "node:test";
import assert from "node:assert/strict";
import type { SocialPost } from "@shared/schema";
import {
  canApprove,
  canReject,
  contentVersion,
  formatWhen,
  parseMediaFile,
  parseNewPostBody,
  parsePostEditBody,
  planNewPost,
  planPostEdit,
  toPostView,
  uploadExtFor,
} from "./postService";

const PUBLIC_ID = "0b9f1c1e-0000-4000-8000-000000000001";
const NEW_ID = "0b9f1c1e-0000-4000-8000-000000000002";

const post: SocialPost = {
  id: 11,
  accountsId: 7,
  connectionId: 3,
  mediaType: "REELS",
  videoPath: `/srv/uploads/social/7/${PUBLIC_ID}.mp4`,
  videoPublicId: PUBLIC_ID,
  videoExt: "mp4",
  videoDurationS: 58,
  videoWidth: 1080,
  videoHeight: 1920,
  videoBytes: 40_000_000,
  caption: "old",
  shareToFeed: true,
  isAiGenerated: true,
  scheduledAt: new Date("2026-10-27T21:00:00Z"),
  requiresApproval: true,
  approvalStatus: "approved",
  approvalNote: null,
  approvedByUserId: 9,
  approvedAt: new Date("2026-10-20T10:00:00Z"),
  approvalWaivedByUserId: null,
  approvalWaivedAt: null,
  approvalReminderSentAt: null,
  status: "scheduled",
  igContainerId: null,
  publishingStartedAt: null,
  igMediaId: null,
  permalink: null,
  attempts: 0,
  lastError: null,
  publishedAt: null,
  createdByUserId: 5,
  createdAt: new Date("2026-10-19T12:00:00Z"),
  updatedAt: new Date("2026-10-19T12:00:00Z"),
};
const ctx = { timeZone: "America/Sao_Paulo", now: new Date("2026-10-20T12:00:00Z"), userId: 5 };
const newVideo = { path: `/srv/uploads/social/7/${NEW_ID}.mov`, ext: "mov", durationS: 30, width: 720, height: 1280, bytes: 9_000_000 };

// ─── planPostEdit: the brief's cases, verbatim ──────────────────────────────

test("publishing post is not editable", () => {
  assert.deepEqual(planPostEdit({ ...post, status: "publishing" }, { caption: "new" }, ctx), { ok: false, status: 409, reason: "not_editable" });
});
test("caption change resets approval and notifies", () => {
  const r = planPostEdit(post, { caption: "new" }, ctx);
  assert.ok(r.ok); assert.equal(r.fields.approvalStatus, "pending"); assert.equal(r.notifyManagers, true);
});
test("time change keeps approval, converts with the account zone", () => {
  const r = planPostEdit(post, { date: "2026-10-28", time: "09:30" }, ctx);
  assert.ok(r.ok); assert.equal(r.fields.approvalStatus, "approved");
  assert.equal(r.fields.scheduledAt!.toISOString(), "2026-10-28T12:30:00.000Z"); assert.equal(r.notifyManagers, false);
});
test("past time is refused", () => {
  assert.deepEqual(planPostEdit(post, { date: "2026-10-19", time: "09:00" }, ctx), { ok: false, status: 422, reason: "in_past" });
});
test("held post with a new time is scheduled again but still needs approval", () => {
  const r = planPostEdit({ ...post, status: "held", approvalStatus: "pending" }, { date: "2026-10-30", time: "18:00" }, ctx);
  assert.ok(r.ok); assert.equal(r.fields.status, "scheduled"); assert.equal(r.fields.approvalStatus ?? "pending", "pending");
});
test("waiving approval records who and when", () => {
  const r = planPostEdit({ ...post, approvalStatus: "rejected" }, { requiresApproval: false }, ctx);
  assert.ok(r.ok); assert.equal(r.fields.approvalStatus, "not_required");
  assert.equal(r.fields.approvalWaivedByUserId, 5); assert.ok(r.fields.approvalWaivedAt instanceof Date);
});
test("caption over limits is refused at save time", () => {
  assert.deepEqual(planPostEdit(post, { caption: "a".repeat(2201) }, ctx), { ok: false, status: 422, reason: "too_long" });
});

// ─── planPostEdit: further rules ────────────────────────────────────────────

test("only scheduled and held posts are editable", () => {
  for (const status of ["published", "failed", "cancelled"]) {
    assert.deepEqual(planPostEdit({ ...post, status }, { caption: "x" }, ctx), { ok: false, status: 409, reason: "not_editable" });
  }
});
test("held post rescheduled re-notifies the Managers (spec: it still needs approval)", () => {
  const r = planPostEdit({ ...post, status: "held", approvalStatus: "pending", approvalReminderSentAt: new Date() }, { date: "2026-10-30", time: "18:00" }, ctx);
  assert.ok(r.ok); assert.equal(r.notifyManagers, true);
  assert.equal(r.fields.approvalReminderSentAt, null);
});
test("held post edited without a new time stays held", () => {
  const r = planPostEdit({ ...post, status: "held" }, { shareToFeed: false }, ctx);
  assert.ok(r.ok); assert.equal(r.fields.status, undefined); assert.equal(r.fields.shareToFeed, false);
});
test("share-to-feed and AI label changes keep approval and do not notify", () => {
  const r = planPostEdit(post, { shareToFeed: false, isAiGenerated: false }, ctx);
  assert.ok(r.ok); assert.equal(r.fields.approvalStatus, "approved"); assert.equal(r.notifyManagers, false);
  assert.equal(r.fields.shareToFeed, false); assert.equal(r.fields.isAiGenerated, false);
});
test("same caption is not a change", () => {
  const r = planPostEdit(post, { caption: "old" }, ctx);
  assert.ok(r.ok); assert.equal(r.fields.approvalStatus, "approved"); assert.equal(r.notifyManagers, false);
});
test("going back to pending clears the reminder marker", () => {
  const r = planPostEdit({ ...post, approvalReminderSentAt: new Date() }, { caption: "new" }, ctx);
  assert.ok(r.ok); assert.equal(r.fields.approvalReminderSentAt, null);
});
test("a pending post with a caption change notifies again", () => {
  const r = planPostEdit({ ...post, approvalStatus: "pending" }, { caption: "new" }, ctx);
  assert.ok(r.ok); assert.equal(r.notifyManagers, true);
});
test("a new video replaces the video fields and resets approval", () => {
  const r = planPostEdit(post, { uploadId: NEW_ID }, { ...ctx, newVideo });
  assert.ok(r.ok);
  assert.equal(r.fields.approvalStatus, "pending"); assert.equal(r.notifyManagers, true);
  assert.equal(r.fields.videoPublicId, NEW_ID); assert.equal(r.fields.videoPath, newVideo.path); assert.equal(r.fields.videoExt, "mov");
  assert.equal(r.fields.videoDurationS, 30); assert.equal(r.fields.videoWidth, 720); assert.equal(r.fields.videoHeight, 1280); assert.equal(r.fields.videoBytes, 9_000_000);
});
test("the current upload id is not a video change", () => {
  const r = planPostEdit(post, { uploadId: PUBLIC_ID }, ctx);
  assert.ok(r.ok); assert.equal(r.fields.videoPublicId, undefined); assert.equal(r.fields.approvalStatus, "approved");
});
test("a new upload id without its probed video is refused", () => {
  assert.deepEqual(planPostEdit(post, { uploadId: NEW_ID }, ctx), { ok: false, status: 422, reason: "upload_missing" });
});
test("date without time, or a malformed time, is refused", () => {
  assert.deepEqual(planPostEdit(post, { date: "2026-10-28" }, ctx), { ok: false, status: 422, reason: "invalid_time" });
  assert.deepEqual(planPostEdit(post, { date: "2026-10-28", time: "9:30" }, ctx), { ok: false, status: 422, reason: "invalid_time" });
  assert.deepEqual(planPostEdit(post, { date: "2026-10-28", time: "09:30" }, { ...ctx, timeZone: "Not/AZone" }), { ok: false, status: 422, reason: "invalid_time" });
});
test("switching approval back on asks again and notifies", () => {
  const r = planPostEdit({ ...post, requiresApproval: false, approvalStatus: "not_required" }, { requiresApproval: true }, ctx);
  assert.ok(r.ok); assert.equal(r.fields.requiresApproval, true); assert.equal(r.fields.approvalStatus, "pending"); assert.equal(r.notifyManagers, true);
});
test("waiver is recorded only when approval is switched off, not re-sent as off", () => {
  const r = planPostEdit({ ...post, requiresApproval: false, approvalStatus: "not_required" }, { requiresApproval: false }, ctx);
  assert.ok(r.ok); assert.equal(r.fields.approvalWaivedByUserId, undefined); assert.equal(r.notifyManagers, false);
});

// ─── planNewPost ────────────────────────────────────────────────────────────

const video = { path: `/srv/uploads/social/7/${PUBLIC_ID}.mp4`, ext: "mp4", durationS: 58, width: 1080, height: 1920, bytes: 40_000_000 };
const newCtx = { ...ctx, accountId: 7, connectionId: 3, video };
const newInput = { uploadId: PUBLIC_ID, caption: "Hello #reel", date: "2026-10-27", time: "18:00", shareToFeed: true, isAiGenerated: true, requiresApproval: true };

test("new post needing approval is pending and notifies", () => {
  const r = planNewPost(newInput, newCtx);
  assert.ok(r.ok);
  assert.equal(r.notifyManagers, true);
  assert.equal(r.row.approvalStatus, "pending");
  assert.equal(r.row.status, "scheduled");
  assert.equal(r.row.scheduledAt.toISOString(), "2026-10-27T21:00:00.000Z");
  assert.equal(r.row.videoPublicId, PUBLIC_ID);
  assert.equal(r.row.videoPath, video.path);
  assert.equal(r.row.accountsId, 7); assert.equal(r.row.connectionId, 3); assert.equal(r.row.createdByUserId, 5);
  assert.equal(r.row.mediaType, "REELS");
});
test("new post without approval is not_required and silent", () => {
  const r = planNewPost({ ...newInput, requiresApproval: false }, newCtx);
  assert.ok(r.ok); assert.equal(r.row.approvalStatus, "not_required"); assert.equal(r.notifyManagers, false);
});
test("new post refusals: past time, caption limits, bad time", () => {
  assert.deepEqual(planNewPost({ ...newInput, date: "2026-10-20", time: "08:59" }, newCtx), { ok: false, status: 422, reason: "in_past" });
  assert.deepEqual(planNewPost({ ...newInput, caption: "#a ".repeat(31) }, newCtx), { ok: false, status: 422, reason: "too_many_hashtags" });
  assert.deepEqual(planNewPost({ ...newInput, date: "2026-02-30" }, newCtx), { ok: false, status: 422, reason: "invalid_time" });
});

// ─── Approval rules (mirrored by the client's PostCard) ─────────────────────

test("approve: scheduled or held, pending or rejected", () => {
  assert.equal(canApprove({ ...post, approvalStatus: "pending" }), true);
  assert.equal(canApprove({ ...post, status: "held", approvalStatus: "rejected" }), true);
  assert.equal(canApprove(post), false); // already approved
  assert.equal(canApprove({ ...post, requiresApproval: false, approvalStatus: "not_required" }), false);
  assert.equal(canApprove({ ...post, status: "publishing", approvalStatus: "pending" }), false);
  assert.equal(canApprove({ ...post, status: "failed", approvalStatus: "rejected" }), false);
});
test("reject: scheduled only, pending or approved", () => {
  assert.equal(canReject(post), true);
  assert.equal(canReject({ ...post, approvalStatus: "pending" }), true);
  assert.equal(canReject({ ...post, approvalStatus: "rejected" }), false);
  assert.equal(canReject({ ...post, status: "held", approvalStatus: "pending" }), false);
  assert.equal(canReject({ ...post, requiresApproval: false, approvalStatus: "not_required" }), false);
});

// ─── View ───────────────────────────────────────────────────────────────────

test("content version changes with the caption or the video, not with the time", () => {
  const v = contentVersion(post);
  assert.notEqual(contentVersion({ ...post, caption: "other" }), v);
  assert.notEqual(contentVersion({ ...post, videoPublicId: NEW_ID }), v);
  assert.equal(contentVersion({ ...post, scheduledAt: new Date() } as typeof post), v);
});

test("view carries the public path and display names, never the file path", () => {
  const names = new Map([[9, "Augusto Silva"], [5, "Gabriel"]]);
  const v = toPostView(post, names);
  assert.deepEqual(v, {
    id: 11,
    version: contentVersion(post),
    section: "upcoming",
    status: "scheduled",
    approvalStatus: "approved",
    requiresApproval: true,
    caption: "old",
    scheduledAt: "2026-10-27T21:00:00.000Z",
    videoUrl: `/media/social/${PUBLIC_ID}.mp4`,
    durationS: 58,
    permalink: null,
    lastError: null,
    approvalNote: null,
    approvedByName: "Augusto Silva",
    waivedByName: null,
    shareToFeed: true,
    isAiGenerated: true,
  });
  assert.ok(!JSON.stringify(v).includes("/srv/"));
});
test("view shows only the names and note that apply to the current approval state", () => {
  const names = new Map([[9, "Augusto Silva"], [5, "Gabriel"]]);
  const pendingAgain = toPostView({ ...post, approvalStatus: "pending", approvalNote: "old note" }, names)!;
  assert.equal(pendingAgain.section, "needs_approval");
  assert.equal(pendingAgain.approvedByName, null);
  assert.equal(pendingAgain.approvalNote, null);
  const rejected = toPostView({ ...post, approvalStatus: "rejected", approvalNote: "Wrong price" }, names)!;
  assert.equal(rejected.approvalNote, "Wrong price");
  const waived = toPostView({ ...post, requiresApproval: false, approvalStatus: "not_required", approvalWaivedByUserId: 5 }, names)!;
  assert.equal(waived.waivedByName, "Gabriel"); assert.equal(waived.approvedByName, null);
  assert.equal(toPostView({ ...post, status: "cancelled" }, names), null);
});

// ─── Media file names, upload types, request bodies ─────────────────────────

test("media file name must be a lowercase uuid with mp4 or mov", () => {
  assert.deepEqual(parseMediaFile(`${PUBLIC_ID}.mp4`), { publicId: PUBLIC_ID, ext: "mp4" });
  assert.deepEqual(parseMediaFile(`${PUBLIC_ID}.mov`), { publicId: PUBLIC_ID, ext: "mov" });
  assert.equal(parseMediaFile("not-a-uuid.mp4"), null);
  assert.equal(parseMediaFile(`${PUBLIC_ID.toUpperCase()}.mp4`), null);
  assert.equal(parseMediaFile(`${PUBLIC_ID}.webm`), null);
  assert.equal(parseMediaFile(`../${PUBLIC_ID}.mp4`), null);
  assert.equal(parseMediaFile(`${PUBLIC_ID}.mp4.mp4`), null);
});
test("upload content types", () => {
  assert.equal(uploadExtFor("video/mp4"), "mp4");
  assert.equal(uploadExtFor("Video/QuickTime; charset=binary"), "mov");
  assert.equal(uploadExtFor("video/webm"), null);
  assert.equal(uploadExtFor("multipart/form-data; boundary=x"), null);
  assert.equal(uploadExtFor(undefined), null);
});
test("new post body: defaults the toggles on, checks types", () => {
  const r = parseNewPostBody({ uploadId: PUBLIC_ID, caption: "hi", date: "2026-10-27", time: "18:00" });
  assert.ok(r.ok);
  assert.deepEqual(r.input, { uploadId: PUBLIC_ID, caption: "hi", date: "2026-10-27", time: "18:00", shareToFeed: true, isAiGenerated: true, requiresApproval: true });
  assert.equal(parseNewPostBody({ caption: "hi", date: "2026-10-27", time: "18:00" }).ok, false);
  assert.equal(parseNewPostBody({ uploadId: "../x", caption: "hi", date: "2026-10-27", time: "18:00" }).ok, false);
  assert.equal(parseNewPostBody({ uploadId: PUBLIC_ID, caption: 5, date: "2026-10-27", time: "18:00" }).ok, false);
  assert.equal(parseNewPostBody({ uploadId: PUBLIC_ID, caption: "hi", date: "2026-10-27", time: "18:00", requiresApproval: "no" }).ok, false);
  assert.equal(parseNewPostBody(null).ok, false);
});
test("edit body: only known fields, each with its type", () => {
  const r = parsePostEditBody({ caption: "x", shareToFeed: false, other: 1 });
  assert.ok(r.ok); assert.deepEqual(r.input, { caption: "x", shareToFeed: false });
  assert.equal(parsePostEditBody({ caption: null }).ok, false);
  assert.equal(parsePostEditBody({ uploadId: "nope" }).ok, false);
  assert.equal(parsePostEditBody({ date: 20261027 }).ok, false);
  assert.equal(parsePostEditBody({ requiresApproval: 1 }).ok, false);
  assert.deepEqual(parsePostEditBody({}), { ok: true, input: {} });
});
test("notification time is shown in the account zone and language", () => {
  const at = new Date("2026-10-27T21:00:00Z");
  assert.match(formatWhen(at, "America/Sao_Paulo", "Portuguese"), /18:00/);
  assert.match(formatWhen(at, "Europe/Amsterdam", "nl"), /22:00/);
  assert.match(formatWhen(at, "Europe/Amsterdam", null), /22:00/);
  assert.match(formatWhen(at, "Not/AZone", "en"), /2026/);
});
