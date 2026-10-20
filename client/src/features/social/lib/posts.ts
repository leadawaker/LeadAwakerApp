// Pure rules behind the Social tab: sections, who may do what to a post (mirrors
// server/social/postService.ts canApprove / canReject and the route guards), the upload
// pre-check, and the date/time strings the form sends. No React, no fetch.
import type { PostListSection } from "@shared/socialPosts";
import type { SocialPostView } from "../api/socialApi";

export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;
export const UPLOAD_TYPES = ["video/mp4", "video/quicktime"] as const;
export const POST_SECTIONS: PostListSection[] = ["needs_approval", "upcoming", "held", "failed", "published"];

export type PostAction = "approve" | "reject" | "reschedule" | "edit" | "retry" | "cancel";

/** Reasons the server sends that have their own message under social.posts.errors. */
export const KNOWN_REASONS = [
  "not_editable", "changed", "in_past", "invalid_time", "not_connected", "not_allowed", "not_failed", "not_enabled",
  "upload_missing", "upload_used", "aborted",
  "too_long", "too_many_hashtags", "too_many_mentions",
  "format", "video_codec", "audio_codec", "audio_rate", "duration_short", "duration_long", "fps", "width", "size",
] as const;

export function errorKey(reason: string | null | undefined): string {
  return `social.posts.errors.${reason && (KNOWN_REASONS as readonly string[]).includes(reason) ? reason : "failed"}`;
}

export function showSocialTab(p: { isAgency: boolean; enabled: boolean }): boolean {
  return p.isAgency || p.enabled;
}

/** Sections in display order, empty ones left out. Published newest first, the rest soonest first. */
export function groupBySection(posts: SocialPostView[]): { section: PostListSection; posts: SocialPostView[] }[] {
  const time = (p: SocialPostView) => Date.parse(p.scheduledAt);
  return POST_SECTIONS
    .map((section) => ({
      section,
      posts: posts
        .filter((p) => p.section === section)
        .sort((a, b) => (section === "published" ? time(b) - time(a) : time(a) - time(b))),
    }))
    .filter((g) => g.posts.length > 0);
}

/** The buttons a post gets, in display order. The server checks every one of them again. */
export function postActions(p: SocialPostView, who: { isAgency: boolean; userRole: string }): PostAction[] {
  const manages = who.isAgency || who.userRole === "Manager";
  const out: PostAction[] = [];
  if (manages && p.requiresApproval) {
    if ((p.status === "scheduled" || p.status === "held") && (p.approvalStatus === "pending" || p.approvalStatus === "rejected")) out.push("approve");
    if (p.status === "scheduled" && (p.approvalStatus === "pending" || p.approvalStatus === "approved")) out.push("reject");
  }
  if (who.isAgency) {
    if (p.status === "held") out.push("reschedule");
    if (p.status === "scheduled" || p.status === "held") out.push("edit");
    if (p.status === "failed") out.push("retry");
    if (p.status === "scheduled" || p.status === "held" || p.status === "failed") out.push("cancel");
  }
  return out;
}

export function uploadPrecheck(file: { type: string; size: number }): "format" | "size" | null {
  if (!(UPLOAD_TYPES as readonly string[]).includes(file.type)) return "format";
  if (file.size > MAX_UPLOAD_BYTES) return "size";
  return null;
}

/** An instant as the account-local "YYYY-MM-DD" and "HH:mm" the form shows and sends. */
export function toLocalDateTime(iso: string, timeZone: string): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` };
}

export interface PostForm {
  uploadId: string;
  caption: string;
  date: string;
  time: string;
  shareToFeed: boolean;
  isAiGenerated: boolean;
  requiresApproval: boolean;
}

/** PATCH body: only the changed fields; a new date or time sends both, as the server needs. */
export function editBody(original: PostForm, form: PostForm): Partial<PostForm> {
  const body: Partial<PostForm> = {};
  if (form.uploadId !== original.uploadId) body.uploadId = form.uploadId;
  if (form.caption !== original.caption) body.caption = form.caption;
  if (form.date !== original.date || form.time !== original.time) {
    body.date = form.date;
    body.time = form.time;
  }
  for (const k of ["shareToFeed", "isAiGenerated", "requiresApproval"] as const) if (form[k] !== original[k]) body[k] = form[k];
  return body;
}
