import { test } from "node:test";
import assert from "node:assert/strict";
import type { SocialPostView } from "../api/socialApi";
import {
  MAX_UPLOAD_BYTES,
  POST_SECTIONS,
  editBody,
  errorKey,
  groupBySection,
  postActions,
  showSocialTab,
  toLocalDateTime,
  uploadPrecheck,
} from "./posts";

const view = (over: Partial<SocialPostView>): SocialPostView => ({
  id: 1, version: "v1", section: "needs_approval", status: "scheduled", approvalStatus: "pending", requiresApproval: true,
  caption: "Olá", scheduledAt: "2026-10-27T21:00:00.000Z", videoUrl: "/media/social/x.mp4", durationS: 58, permalink: null,
  lastError: null, approvalNote: null, approvedByName: null, waivedByName: null, shareToFeed: true, isAiGenerated: true, ...over,
});

const AGENCY = { isAgency: true, userRole: "Owner" };
const MANAGER = { isAgency: false, userRole: "Manager" };
const VIEWER = { isAgency: false, userRole: "Viewer" };

test("sections come in order; published newest first, the rest soonest first", () => {
  assert.deepEqual(POST_SECTIONS, ["needs_approval", "upcoming", "held", "failed", "published"]);
  const g = groupBySection([
    view({ id: 1, section: "published", scheduledAt: "2026-10-01T10:00:00Z" }),
    view({ id: 2, section: "published", scheduledAt: "2026-10-05T10:00:00Z" }),
    view({ id: 3, section: "upcoming", scheduledAt: "2026-11-05T10:00:00Z" }),
    view({ id: 4, section: "upcoming", scheduledAt: "2026-11-01T10:00:00Z" }),
  ]);
  assert.deepEqual(g.map((s) => s.section), ["upcoming", "published"]);
  assert.deepEqual(g[0].posts.map((p) => p.id), [4, 3]);
  assert.deepEqual(g[1].posts.map((p) => p.id), [2, 1]);
});

test("a Viewer gets no actions on any post", () => {
  for (const p of [view({}), view({ status: "failed", section: "failed" }), view({ status: "held", section: "held" })])
    assert.deepEqual(postActions(p, VIEWER), []);
});

test("a Manager approves and rejects a pending post, nothing else", () => {
  assert.deepEqual(postActions(view({}), MANAGER), ["approve", "reject"]);
});

test("approve and reject mirror the server rules", () => {
  assert.deepEqual(postActions(view({ approvalStatus: "rejected" }), MANAGER), ["approve"]);
  assert.deepEqual(postActions(view({ approvalStatus: "approved", section: "upcoming" }), MANAGER), ["reject"]);
  assert.deepEqual(postActions(view({ status: "held", section: "held", approvalStatus: "pending" }), MANAGER), ["approve"]);
  assert.deepEqual(postActions(view({ requiresApproval: false, approvalStatus: "not_required", section: "upcoming" }), MANAGER), []);
  assert.deepEqual(postActions(view({ status: "publishing", approvalStatus: "approved", section: "upcoming" }), MANAGER), []);
});

test("agency edits, reschedules held posts, retries failed ones and cancels", () => {
  assert.deepEqual(postActions(view({}), AGENCY), ["approve", "reject", "edit", "cancel"]);
  assert.deepEqual(postActions(view({ status: "held", section: "held" }), AGENCY), ["approve", "reschedule", "edit", "cancel"]);
  assert.deepEqual(postActions(view({ status: "failed", section: "failed", approvalStatus: "approved" }), AGENCY), ["retry", "cancel"]);
  assert.deepEqual(postActions(view({ status: "published", section: "published", approvalStatus: "approved" }), AGENCY), []);
  assert.deepEqual(postActions(view({ status: "publishing", section: "upcoming", approvalStatus: "approved" }), AGENCY), []);
});

test("the tab shows for agency always, for client users once Social is on", () => {
  assert.equal(showSocialTab({ isAgency: true, enabled: false }), true);
  assert.equal(showSocialTab({ isAgency: false, enabled: false }), false);
  assert.equal(showSocialTab({ isAgency: false, enabled: true }), true);
});

test("oversized or wrong-type files are refused before upload", () => {
  assert.equal(MAX_UPLOAD_BYTES, 100 * 1024 * 1024);
  assert.equal(uploadPrecheck({ type: "video/mp4", size: 1000 }), null);
  assert.equal(uploadPrecheck({ type: "video/quicktime", size: 1000 }), null);
  assert.equal(uploadPrecheck({ type: "video/mp4", size: MAX_UPLOAD_BYTES + 1 }), "size");
  assert.equal(uploadPrecheck({ type: "video/webm", size: 1000 }), "format");
});

test("a post's time in the account's zone, as the date and time the form sends", () => {
  assert.deepEqual(toLocalDateTime("2026-10-27T21:00:00.000Z", "America/Sao_Paulo"), { date: "2026-10-27", time: "18:00" });
  assert.deepEqual(toLocalDateTime("2026-10-25T23:30:00.000Z", "Europe/Amsterdam"), { date: "2026-10-26", time: "00:30" });
});

test("an edit sends only what changed, as strings (never an ISO timestamp)", () => {
  const original = { uploadId: "u1", caption: "a", date: "2026-10-27", time: "18:00", shareToFeed: true, isAiGenerated: true, requiresApproval: true };
  assert.deepEqual(editBody(original, { ...original }), {});
  assert.deepEqual(editBody(original, { ...original, caption: "b", time: "19:00" }), { caption: "b", date: "2026-10-27", time: "19:00" });
  assert.deepEqual(editBody(original, { ...original, requiresApproval: false }), { requiresApproval: false });
});

test("server reasons map to translated keys, unknown ones to a generic message", () => {
  assert.equal(errorKey("not_editable"), "social.posts.errors.not_editable");
  assert.equal(errorKey("too_many_hashtags"), "social.posts.errors.too_many_hashtags");
  assert.equal(errorKey("duration_long"), "social.posts.errors.duration_long");
  assert.equal(errorKey("some_new_thing"), "social.posts.errors.failed");
});
