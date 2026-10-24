// Pure rules behind the scheduled-post routes: what a new post or an edit writes, who may approve
// or reject, how request bodies are read, and what the client is shown. No database and no files:
// server/routes/socialPosts.ts does the I/O. Spec: docs/superpowers/specs/2026-10-19-instagram-connect-and-publishing-design.md
import { createHash } from "node:crypto";
import type { InsertSocialPost, SocialPost } from "@shared/schema";
import {
  approvalAfterEdit,
  isApprovalSatisfied,
  sectionFor,
  validateCaption,
  type ApprovalStatus,
  type PostListSection,
  type SocialPostStatus,
} from "@shared/socialPosts";
import { localToUtc } from "./time";

export type VideoExt = "mp4" | "mov";

/** Statuses each write may start from. Routes pass these to updateSocialPostIf so a concurrent change wins. */
export const EDITABLE_STATUSES: SocialPostStatus[] = ["scheduled", "held"];
export const CANCELLABLE_STATUSES: SocialPostStatus[] = ["scheduled", "held", "failed"];
export const APPROVE_FROM = { statuses: ["scheduled", "held"] as SocialPostStatus[], approval: ["pending", "rejected"] as ApprovalStatus[] };
export const REJECT_FROM = { statuses: ["scheduled"] as SocialPostStatus[], approval: ["pending", "approved"] as ApprovalStatus[] };

/** randomUUID() output: the upload id and the post's public video id. */
export const UPLOAD_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const MEDIA_FILE = /^([0-9a-f-]{36})\.(mp4|mov)$/;
const UPLOAD_TYPES = new Map<string, VideoExt>([["video/mp4", "mp4"], ["video/quicktime", "mov"]]);

export interface ProbedVideo { path: string; ext: string; durationS: number; width: number; height: number; bytes: number }

/** coverThumbnailId: a ready thumbnail of the account to use as the Reel cover; null removes the cover. */
export interface PostEditInput { uploadId?: string; caption?: string; date?: string; time?: string; shareToFeed?: boolean; isAiGenerated?: boolean; requiresApproval?: boolean; coverThumbnailId?: number | null }
export interface NewPostInput { uploadId: string; caption: string; date: string; time: string; shareToFeed: boolean; isAiGenerated: boolean; requiresApproval: boolean; coverThumbnailId: number | null }

/** The post's own copy of a thumbnail (the thumbnail can be deleted later), already written to disk by the route. */
export interface CoverCopy { thumbnailId: number; publicId: string; path: string }

function coverFields(c: CoverCopy | null): Partial<InsertSocialPost> {
  return c
    ? { coverThumbnailId: c.thumbnailId, coverPublicId: c.publicId, coverPath: c.path }
    : { coverThumbnailId: null, coverPublicId: null, coverPath: null };
}

export type Refusal = { ok: false; status: 409 | 422; reason: string };

function refuse(status: 409 | 422, reason: string): Refusal {
  return { ok: false, status, reason };
}

function within(list: readonly string[], value: string): boolean {
  return list.includes(value);
}

function captionRefusal(caption: string): Refusal | null {
  const check = validateCaption(caption);
  return check.ok ? null : refuse(422, check.reason);
}

/** The account-local date and time as a UTC instant, which must be in the future. */
function futureInstant(date: string, time: string, timeZone: string, now: Date): { ok: true; at: Date } | Refusal {
  let at: Date;
  try {
    at = localToUtc(date, time, timeZone);
  } catch {
    return refuse(422, "invalid_time");
  }
  if (at.getTime() <= now.getTime()) return refuse(422, "in_past");
  return { ok: true, at };
}

function videoFields(publicId: string, v: ProbedVideo): Partial<InsertSocialPost> {
  return {
    videoPath: v.path,
    videoPublicId: publicId,
    videoExt: v.ext,
    videoDurationS: v.durationS,
    videoWidth: v.width,
    videoHeight: v.height,
    videoBytes: v.bytes,
  };
}

/** What an agency edit writes (spec "Approval rules"). Only scheduled and held posts can be edited. */
export function planPostEdit(
  post: SocialPost,
  input: PostEditInput,
  ctx: { timeZone: string; now: Date; userId: number; newVideo?: ProbedVideo; newCover?: CoverCopy },
): { ok: true; fields: Partial<InsertSocialPost>; notifyManagers: boolean } | Refusal {
  if (!within(EDITABLE_STATUSES, post.status)) return refuse(409, "not_editable");
  const fields: Partial<InsertSocialPost> = {};

  if (input.caption !== undefined) {
    const bad = captionRefusal(input.caption);
    if (bad) return bad;
    fields.caption = input.caption;
  }
  const captionChanged = input.caption !== undefined && input.caption !== post.caption;

  let timeChanged = false;
  if (input.date !== undefined || input.time !== undefined) {
    if (input.date === undefined || input.time === undefined) return refuse(422, "invalid_time");
    const when = futureInstant(input.date, input.time, ctx.timeZone, ctx.now);
    if (!when.ok) return when;
    fields.scheduledAt = when.at;
    timeChanged = when.at.getTime() !== post.scheduledAt.getTime();
  }

  const videoChanged = input.uploadId !== undefined && input.uploadId !== post.videoPublicId;
  if (videoChanged) {
    if (!ctx.newVideo) return refuse(422, "upload_missing");
    Object.assign(fields, videoFields(input.uploadId!, ctx.newVideo));
  }

  let coverChanged = false;
  if (input.coverThumbnailId !== undefined && input.coverThumbnailId !== post.coverThumbnailId) {
    if (input.coverThumbnailId !== null && !ctx.newCover) return refuse(422, "cover_missing");
    Object.assign(fields, coverFields(input.coverThumbnailId === null ? null : ctx.newCover!));
    coverChanged = true;
  }

  if (input.shareToFeed !== undefined) fields.shareToFeed = input.shareToFeed;
  if (input.isAiGenerated !== undefined) fields.isAiGenerated = input.isAiGenerated;

  const prevApproval = post.approvalStatus as ApprovalStatus;
  const requiresApproval = input.requiresApproval ?? post.requiresApproval;
  const approvalStatus = approvalAfterEdit(
    { requiresApproval: post.requiresApproval, approvalStatus: prevApproval },
    { videoChanged, captionChanged, coverChanged, requiresApproval },
  );
  fields.approvalStatus = approvalStatus;
  if (input.requiresApproval !== undefined) fields.requiresApproval = input.requiresApproval;
  if (post.requiresApproval && !requiresApproval) {
    // Deliberate agency override: the post shows "approval waived by <name>".
    fields.approvalWaivedByUserId = ctx.userId;
    fields.approvalWaivedAt = ctx.now;
  }

  // Rescheduling a held post puts it back in the queue; it still needs approval before it publishes.
  const rescheduledFromHeld = post.status === "held" && fields.scheduledAt !== undefined;
  if (rescheduledFromHeld) fields.status = "scheduled";

  const pending = approvalStatus === "pending";
  // The 24-hour reminder belongs to this version and this time: allow it again.
  if (pending && (prevApproval !== "pending" || timeChanged)) fields.approvalReminderSentAt = null;

  const notifyManagers =
    (pending && (prevApproval !== "pending" || videoChanged || captionChanged || coverChanged)) ||
    (rescheduledFromHeld && !isApprovalSatisfied({ requiresApproval, approvalStatus }));

  return { ok: true, fields, notifyManagers };
}

/** The row for a new post, from an upload that has already been probed. */
export function planNewPost(
  input: NewPostInput,
  ctx: { timeZone: string; now: Date; userId: number; accountId: number; connectionId: number; video: ProbedVideo; cover?: CoverCopy },
): { ok: true; row: InsertSocialPost; notifyManagers: boolean } | Refusal {
  const bad = captionRefusal(input.caption);
  if (bad) return bad;
  const when = futureInstant(input.date, input.time, ctx.timeZone, ctx.now);
  if (!when.ok) return when;
  const approvalStatus: ApprovalStatus = input.requiresApproval ? "pending" : "not_required";
  const row: InsertSocialPost = {
    accountsId: ctx.accountId,
    connectionId: ctx.connectionId,
    mediaType: "REELS",
    ...videoFields(input.uploadId, ctx.video),
    ...(ctx.cover ? coverFields(ctx.cover) : {}),
    caption: input.caption,
    shareToFeed: input.shareToFeed,
    isAiGenerated: input.isAiGenerated,
    scheduledAt: when.at,
    requiresApproval: input.requiresApproval,
    approvalStatus,
    status: "scheduled",
    attempts: 0,
    createdByUserId: ctx.userId,
  };
  return { ok: true, row, notifyManagers: approvalStatus === "pending" };
}

type ApprovalView = Pick<SocialPost, "status" | "requiresApproval" | "approvalStatus">;

/** Manager approval: a scheduled or held post waiting for approval, or one rejected earlier. */
export function canApprove(p: ApprovalView): boolean {
  return p.requiresApproval && within(APPROVE_FROM.statuses, p.status) && within(APPROVE_FROM.approval, p.approvalStatus);
}

/** Manager rejection: a scheduled post that is pending or was approved. */
export function canReject(p: ApprovalView): boolean {
  return p.requiresApproval && within(REJECT_FROM.statuses, p.status) && within(REJECT_FROM.approval, p.approvalStatus);
}

/** What the client gets for a post (client type SocialPostView). Never a file path. */
export interface SocialPostView {
  id: number;
  /** contentVersion(): sent back with Approve and Reject. */
  version: string;
  section: PostListSection;
  status: SocialPostStatus;
  approvalStatus: ApprovalStatus;
  requiresApproval: boolean;
  caption: string;
  scheduledAt: string;
  videoUrl: string;
  durationS: number | null;
  permalink: string | null;
  lastError: string | null;
  approvalNote: string | null;
  approvedByName: string | null;
  waivedByName: string | null;
  shareToFeed: boolean;
  isAiGenerated: boolean;
  /** Path on the API host of the Reel cover, or null. */
  coverUrl: string | null;
  coverThumbnailId: number | null;
}

/**
 * What a Manager approves: the video and the caption. The client sends it back with Approve, so an
 * agency edit that landed after the Manager loaded the list is refused (409 changed), not approved unseen.
 */
export function contentVersion(p: Pick<SocialPost, "videoPublicId" | "caption"> & { coverPublicId?: string | null }): string {
  // The cover only counts when there is one, so versions of posts without a cover stay as they were.
  const cover = p.coverPublicId ? `\n${p.coverPublicId}` : "";
  return createHash("sha256").update(`${p.videoPublicId ?? ""}\n${p.caption}${cover}`).digest("hex").slice(0, 16);
}

export function coverMediaPath(publicId: string): string {
  return `/media/social/cover/${publicId}.jpg`;
}

/** `<uuid>.jpg` from the public cover URL, or null. */
export function parseCoverFile(file: string): string | null {
  return /^([0-9a-f-]{36})\.jpg$/.exec(file)?.[1] ?? null;
}

export function mediaPath(publicId: string, ext: string): string {
  return `/media/social/${publicId}.${ext}`;
}

/** null for a post the list never shows (cancelled). Names and the note only show while they apply. */
export function toPostView(p: SocialPost, names: ReadonlyMap<number, string>): SocialPostView | null {
  const status = p.status as SocialPostStatus;
  const approvalStatus = p.approvalStatus as ApprovalStatus;
  const section = sectionFor({ status, requiresApproval: p.requiresApproval, approvalStatus });
  if (!section) return null;
  const nameOf = (id: number | null) => (id == null ? null : names.get(id) ?? null);
  return {
    id: p.id,
    version: contentVersion(p),
    section,
    status,
    approvalStatus,
    requiresApproval: p.requiresApproval,
    caption: p.caption,
    scheduledAt: p.scheduledAt.toISOString(),
    videoUrl: p.videoPublicId && p.videoExt ? mediaPath(p.videoPublicId, p.videoExt) : "",
    durationS: p.videoDurationS,
    permalink: p.permalink,
    lastError: p.lastError,
    approvalNote: approvalStatus === "rejected" ? p.approvalNote : null,
    approvedByName: approvalStatus === "approved" ? nameOf(p.approvedByUserId) : null,
    waivedByName: p.requiresApproval ? null : nameOf(p.approvalWaivedByUserId),
    shareToFeed: p.shareToFeed,
    isAiGenerated: p.isAiGenerated,
    coverUrl: p.coverPublicId ? coverMediaPath(p.coverPublicId) : null,
    coverThumbnailId: p.coverThumbnailId,
  };
}

/** `<uuid>.<mp4|mov>` from the public media URL, or null. */
export function parseMediaFile(file: string): { publicId: string; ext: VideoExt } | null {
  const m = MEDIA_FILE.exec(file);
  return m ? { publicId: m[1], ext: m[2] as VideoExt } : null;
}

/** The file extension for an upload's Content-Type, or null when it is not an accepted video type. */
export function uploadExtFor(contentType: string | undefined): VideoExt | null {
  if (!contentType) return null;
  return UPLOAD_TYPES.get(contentType.split(";")[0].trim().toLowerCase()) ?? null;
}

type Parsed<T> = { ok: true; input: T } | { ok: false; message: string };

/** PATCH body: known fields only, each with its type checked. Rules (caption, time) are planPostEdit's job. */
export function parsePostEditBody(body: unknown): Parsed<PostEditInput> {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return { ok: false, message: "Body must be an object" };
  const b = body as Record<string, unknown>;
  const input: PostEditInput = {};
  if (b.uploadId !== undefined) {
    if (typeof b.uploadId !== "string" || !UPLOAD_ID.test(b.uploadId)) return { ok: false, message: "uploadId is invalid" };
    input.uploadId = b.uploadId;
  }
  for (const k of ["caption", "date", "time"] as const) {
    if (b[k] === undefined) continue;
    if (typeof b[k] !== "string") return { ok: false, message: `${k} must be a string` };
    input[k] = b[k] as string;
  }
  for (const k of ["shareToFeed", "isAiGenerated", "requiresApproval"] as const) {
    if (b[k] === undefined) continue;
    if (typeof b[k] !== "boolean") return { ok: false, message: `${k} must be a boolean` };
    input[k] = b[k] as boolean;
  }
  if (b.coverThumbnailId !== undefined) {
    const c = b.coverThumbnailId;
    if (c !== null && !(typeof c === "number" && Number.isInteger(c) && c > 0)) return { ok: false, message: "coverThumbnailId is invalid" };
    input.coverThumbnailId = c;
  }
  return { ok: true, input };
}

/** POST body: an upload id, a date and a time are required; the three toggles default to on. */
export function parseNewPostBody(body: unknown): Parsed<NewPostInput> {
  const parsed = parsePostEditBody(body);
  if (!parsed.ok) return parsed;
  const i = parsed.input;
  if (!i.uploadId) return { ok: false, message: "uploadId is required" };
  if (i.date === undefined || i.time === undefined) return { ok: false, message: "date and time are required" };
  return {
    ok: true,
    input: {
      uploadId: i.uploadId,
      caption: i.caption ?? "",
      date: i.date,
      time: i.time,
      shareToFeed: i.shareToFeed ?? true,
      isAiGenerated: i.isAiGenerated ?? true,
      requiresApproval: i.requiresApproval ?? true,
      coverThumbnailId: i.coverThumbnailId ?? null,
    },
  };
}

/** Accounts store "English" / "Dutch" / "Portuguese" (or a code), as in social/notify.ts. */
function localeFor(language: string | null | undefined): string {
  const l = (language ?? "").trim().toLowerCase();
  if (l.startsWith("pt") || l.startsWith("portug")) return "pt-BR";
  if (l.startsWith("nl") || l.startsWith("dutch") || l.startsWith("neder")) return "nl-NL";
  return "en-GB";
}

/** The {when} in the Managers' notification: the post's time in the account's zone and language. */
export function formatWhen(at: Date, timeZone: string, language: string | null | undefined): string {
  const opts = { dateStyle: "medium", timeStyle: "short" } as const;
  try {
    return new Intl.DateTimeFormat(localeFor(language), { ...opts, timeZone }).format(at);
  } catch {
    return `${new Intl.DateTimeFormat(localeFor(language), { ...opts, timeZone: "UTC" }).format(at)} UTC`;
  }
}
