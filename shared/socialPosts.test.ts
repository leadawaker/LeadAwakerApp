import { test } from "node:test";
import assert from "node:assert/strict";
import { isApprovalSatisfied, approvalAfterEdit, classifyScheduledPost, validateCaption, sectionFor } from "./socialPosts";

const at = (iso: string) => new Date(iso);
const base = { status: "scheduled", requiresApproval: true, approvalStatus: "pending", scheduledAt: at("2026-10-27T21:00:00Z") } as const;

test("approval satisfied only when not required or approved", () => {
  assert.equal(isApprovalSatisfied({ requiresApproval: false, approvalStatus: "rejected" }), true);
  assert.equal(isApprovalSatisfied({ requiresApproval: true, approvalStatus: "approved" }), true);
  assert.equal(isApprovalSatisfied({ requiresApproval: true, approvalStatus: "pending" }), false);
  assert.equal(isApprovalSatisfied({ requiresApproval: true, approvalStatus: "rejected" }), false);
});

test("video or caption change resets approval to pending", () => {
  const prev = { requiresApproval: true, approvalStatus: "approved" } as const;
  assert.equal(approvalAfterEdit(prev, { videoChanged: true, captionChanged: false, requiresApproval: true }), "pending");
  assert.equal(approvalAfterEdit(prev, { videoChanged: false, captionChanged: true, requiresApproval: true }), "pending");
});

test("time-only change keeps approval", () => {
  const prev = { requiresApproval: true, approvalStatus: "approved" } as const;
  assert.equal(approvalAfterEdit(prev, { videoChanged: false, captionChanged: false, requiresApproval: true }), "approved");
});

test("switching approval off gives not_required, switching on gives pending", () => {
  assert.equal(approvalAfterEdit({ requiresApproval: true, approvalStatus: "rejected" }, { videoChanged: false, captionChanged: false, requiresApproval: false }), "not_required");
  assert.equal(approvalAfterEdit({ requiresApproval: false, approvalStatus: "not_required" }, { videoChanged: false, captionChanged: false, requiresApproval: true }), "pending");
});

test("classify: future post waits", () => {
  assert.equal(classifyScheduledPost(base, at("2026-10-27T20:59:00Z"), "connected"), "wait");
});
test("classify: due and unapproved holds, even if rejected", () => {
  assert.equal(classifyScheduledPost(base, at("2026-10-27T21:00:00Z"), "connected"), "hold");
  assert.equal(classifyScheduledPost({ ...base, approvalStatus: "rejected" }, at("2026-10-27T21:01:00Z"), "connected"), "hold");
});
test("classify: due and approved starts", () => {
  assert.equal(classifyScheduledPost({ ...base, approvalStatus: "approved" }, at("2026-10-27T21:00:30Z"), "connected"), "start");
});
test("classify: due, approved, disconnected or missing connection fails", () => {
  assert.equal(classifyScheduledPost({ ...base, approvalStatus: "approved" }, at("2026-10-27T21:01:00Z"), "disconnected"), "fail_disconnected");
  assert.equal(classifyScheduledPost({ ...base, approvalStatus: "approved" }, at("2026-10-27T21:01:00Z"), null), "fail_disconnected");
});
test("classify: needs_attention still tries to publish (the token may still be valid)", () => {
  assert.equal(classifyScheduledPost({ ...base, approvalStatus: "approved" }, at("2026-10-27T21:01:00Z"), "needs_attention"), "start");
});
test("classify: non-scheduled statuses always wait", () => {
  for (const s of ["held", "publishing", "published", "failed", "cancelled"] as const)
    assert.equal(classifyScheduledPost({ ...base, status: s, approvalStatus: "approved" }, at("2027-01-01T00:00:00Z"), "connected"), "wait");
});

test("caption limits", () => {
  assert.deepEqual(validateCaption("a".repeat(2200)), { ok: true });
  assert.deepEqual(validateCaption("a".repeat(2201)), { ok: false, reason: "too_long" });
  assert.deepEqual(validateCaption(Array.from({ length: 31 }, (_, i) => `#t${i}`).join(" ")), { ok: false, reason: "too_many_hashtags" });
  assert.deepEqual(validateCaption(Array.from({ length: 21 }, (_, i) => `@u${i}`).join(" ")), { ok: false, reason: "too_many_mentions" });
  assert.deepEqual(validateCaption("mail me at a@b.com #ok"), { ok: true });
});

test("caption length counts code points, not UTF-16 units", () => {
  assert.deepEqual(validateCaption("😀".repeat(2200)), { ok: true });
  assert.deepEqual(validateCaption("😀".repeat(2201)), { ok: false, reason: "too_long" });
});

test("list sections", () => {
  assert.equal(sectionFor({ status: "scheduled", requiresApproval: true, approvalStatus: "pending" }), "needs_approval");
  assert.equal(sectionFor({ status: "scheduled", requiresApproval: true, approvalStatus: "rejected" }), "needs_approval");
  assert.equal(sectionFor({ status: "scheduled", requiresApproval: true, approvalStatus: "approved" }), "upcoming");
  assert.equal(sectionFor({ status: "publishing", requiresApproval: false, approvalStatus: "not_required" }), "upcoming");
  assert.equal(sectionFor({ status: "held", requiresApproval: true, approvalStatus: "pending" }), "held");
  assert.equal(sectionFor({ status: "failed", requiresApproval: false, approvalStatus: "not_required" }), "failed");
  assert.equal(sectionFor({ status: "published", requiresApproval: false, approvalStatus: "not_required" }), "published");
  assert.equal(sectionFor({ status: "cancelled", requiresApproval: false, approvalStatus: "not_required" }), null);
});
