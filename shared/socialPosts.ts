// Pure rules for scheduled social posts. Shared by server and client: no Node-only imports.

export type SocialPostStatus = "scheduled" | "held" | "publishing" | "published" | "failed" | "cancelled";
export type ApprovalStatus = "not_required" | "pending" | "approved" | "rejected";

/** Accounts.timezone's column default: server and client fall back to the same zone. */
export const DEFAULT_TIMEZONE = "Europe/Amsterdam";

export const IG_CAPTION_MAX = 2200;
export const IG_MAX_HASHTAGS = 30;
export const IG_MAX_MENTIONS = 20;

export interface PostRuleView {
  status: SocialPostStatus;
  requiresApproval: boolean;
  approvalStatus: ApprovalStatus;
  scheduledAt: Date;
}

export function isApprovalSatisfied(p: Pick<PostRuleView, "requiresApproval" | "approvalStatus">): boolean {
  return !p.requiresApproval || p.approvalStatus === "approved";
}

export function approvalAfterEdit(
  prev: Pick<PostRuleView, "requiresApproval" | "approvalStatus">,
  change: { videoChanged: boolean; captionChanged: boolean; requiresApproval: boolean },
): ApprovalStatus {
  if (!change.requiresApproval) return "not_required";
  if (!prev.requiresApproval) return "pending";
  if (change.videoChanged || change.captionChanged) return "pending";
  return prev.approvalStatus;
}

export type DueAction = "wait" | "hold" | "start" | "fail_disconnected";

export function classifyScheduledPost(p: PostRuleView, now: Date, connectionStatus: string | null): DueAction {
  if (p.status !== "scheduled") return "wait";
  if (p.scheduledAt.getTime() > now.getTime()) return "wait";
  if (!isApprovalSatisfied(p)) return "hold";
  if (connectionStatus === null || connectionStatus === "disconnected") return "fail_disconnected";
  return "start";
}

export type CaptionCheck = { ok: true } | { ok: false; reason: "too_long" | "too_many_hashtags" | "too_many_mentions" };

export function validateCaption(caption: string): CaptionCheck {
  if ([...caption].length > IG_CAPTION_MAX) return { ok: false, reason: "too_long" };
  const hashtags = caption.match(/(^|\s)#[\p{L}\p{N}_]+/gu)?.length ?? 0;
  if (hashtags > IG_MAX_HASHTAGS) return { ok: false, reason: "too_many_hashtags" };
  const mentions = caption.match(/(^|\s)@[\w.]+/g)?.length ?? 0;
  if (mentions > IG_MAX_MENTIONS) return { ok: false, reason: "too_many_mentions" };
  return { ok: true };
}

export type PostListSection = "needs_approval" | "upcoming" | "held" | "failed" | "published";

export function sectionFor(p: Pick<PostRuleView, "status" | "requiresApproval" | "approvalStatus">): PostListSection | null {
  switch (p.status) {
    case "scheduled":
      return isApprovalSatisfied(p) ? "upcoming" : "needs_approval";
    case "publishing":
      return "upcoming";
    case "held":
      return "held";
    case "failed":
      return "failed";
    case "published":
      return "published";
    default:
      return null;
  }
}
