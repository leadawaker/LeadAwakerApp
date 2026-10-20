/**
 * Scheduled-post routes: uploads, the post list, create / edit / approve / reject / retry / cancel,
 * and the public video URL Meta downloads from. Spec:
 * docs/superpowers/specs/2026-10-19-instagram-connect-and-publishing-design.md
 *
 * Everything with I/O comes in through PostRouteDeps (server/routes/socialPosts.ts wires the real
 * ones), so the routes are tested over HTTP without a database or ffmpeg.
 *
 * Auth on /api/social/accounts/:id/...: requireAuth, accountIdFor (a client user only reaches their
 * own account), the account must exist and, for client users, have Social switched on. Posts are
 * always looked up by account AND id, so another account's post id is a 404.
 *
 * Every write is a conditional update (updateSocialPostIf) on the status and approval the decision
 * was made from: when the publisher or another user moved the post on meanwhile, the write loses
 * with 409 instead of overwriting their change.
 */
import { randomUUID } from "node:crypto";
import { unlink } from "node:fs/promises";
import { resolve, sep } from "node:path";
import type { Express, Request, RequestHandler, Response } from "express";
import type { InsertSocialPost, SocialConnection, SocialPost } from "@shared/schema";
import { DEFAULT_TIMEZONE, type ApprovalStatus, type SocialPostStatus } from "@shared/socialPosts";
import { accountIdFor, wrapAsync } from "../routes/_helpers";
import { canManageSocial, isAgency } from "./access";
import type { SocialNotifType } from "./notify";
import {
  APPROVE_FROM,
  CANCELLABLE_STATUSES,
  REJECT_FROM,
  UPLOAD_ID,
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
  type ProbedVideo,
  type VideoExt,
} from "./postService";
import type { UploadOutcome, VideoCheck } from "./upload";

const REJECT_NOTE_MAX = 1000;
const POST_LINK = "/platform/accounts?tab=social";
const MEDIA_CONTENT_TYPE: Record<VideoExt, string> = { mp4: "video/mp4", mov: "video/quicktime" };

export interface PostRouteDeps {
  requireAuth: RequestHandler;
  now(): Date;
  /** SOCIAL_UPLOAD_DIR in production: uploads live at <uploadDir>/<accountId>/<uuid>.<ext>. */
  uploadDir: string;
  maxUploadBytes: number;
  store: {
    getAccount(accountId: number): Promise<{ timezone: string | null; language: string | null; socialEnabled: boolean } | null>;
    getSocialConnection(accountId: number): Promise<SocialConnection | null>;
    listSocialPosts(accountId: number): Promise<SocialPost[]>;
    getSocialPost(accountId: number, postId: number): Promise<SocialPost | null>;
    getSocialPostByPublicId(publicId: string): Promise<SocialPost | null>;
    insertSocialPost(row: InsertSocialPost): Promise<SocialPost>;
    updateSocialPostIf(
      postId: number,
      allowedStatuses: SocialPostStatus[],
      fields: Partial<InsertSocialPost>,
      opts?: {
        approvalStatuses?: ApprovalStatus[];
        content?: { caption: string; videoPublicId: string | null; scheduledAt?: Date; shareToFeed?: boolean; isAiGenerated?: boolean };
      },
    ): Promise<SocialPost | null>;
    getSocialUserNames(ids: number[]): Promise<Map<number, string>>;
  };
  video: {
    /** Stream, faststart, probe, spec check (upload.receiveVideo). Leaves no file on failure. */
    receive(src: NodeJS.ReadableStream, destPath: string, maxBytes: number): Promise<UploadOutcome>;
    /** Probe a stored upload again (upload.inspectVideo). null when the file is gone. */
    inspect(path: string): Promise<VideoCheck | null>;
  };
  notifyAgency(n: { type: SocialNotifType; title: string; body: string; accountId: number; link: string }): Promise<void>;
  notifyAccountManagers(accountId: number, n: { type: SocialNotifType; key: "needs_approval" | "published"; vars: Record<string, string>; link: string }): Promise<void>;
}

type AccountCtx = { accountId: number; timeZone: string; language: string | null };

export function registerSocialPostRoutes(app: Express, deps: PostRouteDeps): void {
  const { store } = deps;
  const uploadRoot = resolve(deps.uploadDir);
  const pathFor = (accountId: number, publicId: string, ext: VideoExt) => resolve(uploadRoot, String(accountId), `${publicId}.${ext}`);
  const insideUploads = (path: string | null): path is string => !!path && resolve(path).startsWith(uploadRoot + sep);

  async function removeFile(path: string | null): Promise<void> {
    if (!insideUploads(path)) return;
    try {
      await unlink(resolve(path));
    } catch (err: any) {
      if (err?.code !== "ENOENT") console.error(`[social] could not delete ${path}: ${err?.message ?? err}`);
    }
  }

  /** The uploaded file for this account, probed again, or null when it is not there. */
  async function findUpload(accountId: number, uploadId: string): Promise<ProbedVideo | { ok: false; reason: string } | null> {
    for (const ext of ["mp4", "mov"] as const) {
      const path = pathFor(accountId, uploadId, ext);
      const check = await deps.video.inspect(path);
      if (!check) continue;
      if (!check.ok) return check;
      return { path, ext, durationS: check.durationS, width: check.width, height: check.height, bytes: check.bytes };
    }
    return null;
  }

  /** accountIdFor, then the account must exist and (for client users) have Social switched on. Sends the error itself. */
  async function accountGate(req: Request, res: Response): Promise<AccountCtx | null> {
    const accountId = accountIdFor(req, res);
    if (accountId === null) return null;
    const account = await store.getAccount(accountId);
    if (!account) {
      res.status(404).json({ message: "Account not found" });
      return null;
    }
    if (req.user && !isAgency(req.user) && !account.socialEnabled) {
      res.status(403).json({ message: "Social is not enabled for this account", reason: "not_enabled" });
      return null;
    }
    return { accountId, timeZone: account.timezone || DEFAULT_TIMEZONE, language: account.language };
  }

  function postIdOf(req: Request, res: Response): number | null {
    const id = Number(req.params.postId);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ message: "Invalid post id" });
      return null;
    }
    return id;
  }

  async function viewOf(p: SocialPost) {
    const ids = [p.approvedByUserId, p.approvalWaivedByUserId].filter((x): x is number => x != null);
    return toPostView(p, await store.getSocialUserNames(ids));
  }

  function notifyNeedsApproval(ctx: AccountCtx, p: SocialPost): void {
    void deps.notifyAccountManagers(ctx.accountId, {
      type: "social_post_needs_approval",
      key: "needs_approval",
      vars: { caption: p.caption, when: formatWhen(p.scheduledAt, ctx.timeZone, ctx.language) },
      link: POST_LINK,
    }).catch(() => {});
  }

  const forbidden = (res: Response) => res.status(403).json({ message: "Forbidden" });
  /** Users.id is nullable in the schema: a write that records who did it needs a real id. */
  const actorId = (req: Request, res: Response): number | null => {
    const id = req.user?.id;
    if (typeof id === "number") return id;
    forbidden(res);
    return null;
  };
  const refused = (res: Response, status: number, reason: string) => res.status(status).json({ message: reason, reason });

  // ─── Upload: agency only. Streamed to disk, never through express.json ────
  app.post("/api/social/accounts/:id/uploads", deps.requireAuth, wrapAsync(async (req, res) => {
    const ctx = await accountGate(req, res);
    if (!ctx) return;
    if (!isAgency(req.user)) return forbidden(res);
    const ext = uploadExtFor(req.headers["content-type"]);
    if (!ext) return refused(res, 415, "format");
    const declared = Number(req.headers["content-length"]);
    if (Number.isFinite(declared) && declared > deps.maxUploadBytes) {
      res.setHeader("Connection", "close");
      return refused(res, 413, "size");
    }
    const uploadId = randomUUID();
    const outcome = await deps.video.receive(req, pathFor(ctx.accountId, uploadId, ext), deps.maxUploadBytes);
    if (!outcome.ok) {
      if (outcome.status === 413) res.setHeader("Connection", "close");
      if (!res.headersSent && !res.destroyed) refused(res, outcome.status, outcome.reason);
      return;
    }
    res.json({ uploadId, ext, durationS: outcome.durationS, width: outcome.width, height: outcome.height, bytes: outcome.bytes });
  }));

  // ─── List: any user of the account, or agency ─────────────────────────────
  app.get("/api/social/accounts/:id/posts", deps.requireAuth, wrapAsync(async (req, res) => {
    const ctx = await accountGate(req, res);
    if (!ctx) return;
    const rows = await store.listSocialPosts(ctx.accountId);
    const ids = rows.flatMap((p) => [p.approvedByUserId, p.approvalWaivedByUserId]).filter((x): x is number => x != null);
    const names = await store.getSocialUserNames(ids);
    res.json(rows.map((p) => toPostView(p, names)).filter((v) => v !== null));
  }));

  // ─── Create: agency only ──────────────────────────────────────────────────
  app.post("/api/social/accounts/:id/posts", deps.requireAuth, wrapAsync(async (req, res) => {
    const ctx = await accountGate(req, res);
    if (!ctx) return;
    if (!isAgency(req.user)) return forbidden(res);
    const userId = actorId(req, res);
    if (userId === null) return;
    const parsed = parseNewPostBody(req.body);
    if (!parsed.ok) return res.status(400).json({ message: parsed.message });
    const input = parsed.input;

    const connection = await store.getSocialConnection(ctx.accountId);
    if (!connection || connection.status === "disconnected") return refused(res, 409, "not_connected");
    if (await store.getSocialPostByPublicId(input.uploadId)) return refused(res, 409, "upload_used");
    const video = await findUpload(ctx.accountId, input.uploadId);
    if (!video) return refused(res, 422, "upload_missing");
    if ("ok" in video) return refused(res, 422, video.reason);

    const plan = planNewPost(input, {
      timeZone: ctx.timeZone, now: deps.now(), userId, accountId: ctx.accountId, connectionId: connection.id, video,
    });
    if (!plan.ok) return refused(res, plan.status, plan.reason);
    let created: SocialPost;
    try {
      created = await store.insertSocialPost(plan.row);
    } catch (err: any) {
      // Two creates with the same upload at once: the unique index on video_public_id decides.
      if (err?.code === "23505") return refused(res, 409, "upload_used");
      throw err;
    }
    if (plan.notifyManagers) notifyNeedsApproval(ctx, created);
    res.status(201).json(await viewOf(created));
  }));

  // ─── Edit: agency only, scheduled or held posts ───────────────────────────
  app.patch("/api/social/accounts/:id/posts/:postId", deps.requireAuth, wrapAsync(async (req, res) => {
    const ctx = await accountGate(req, res);
    if (!ctx) return;
    if (!isAgency(req.user)) return forbidden(res);
    const postId = postIdOf(req, res);
    if (postId === null) return;
    const post = await store.getSocialPost(ctx.accountId, postId);
    if (!post) return res.status(404).json({ message: "Post not found" });
    const parsed = parsePostEditBody(req.body);
    if (!parsed.ok) return res.status(400).json({ message: parsed.message });
    const input = parsed.input;

    let newVideo: ProbedVideo | undefined;
    if (input.uploadId !== undefined && input.uploadId !== post.videoPublicId) {
      if (await store.getSocialPostByPublicId(input.uploadId)) return refused(res, 409, "upload_used");
      const found = await findUpload(ctx.accountId, input.uploadId);
      if (!found) return refused(res, 422, "upload_missing");
      if ("ok" in found) return refused(res, 422, found.reason);
      newVideo = found;
    }

    const userId = actorId(req, res);
    if (userId === null) return;
    const plan = planPostEdit(post, input, { timeZone: ctx.timeZone, now: deps.now(), userId, newVideo });
    if (!plan.ok) return refused(res, plan.status, plan.reason);
    // Only applies when the post is still in the state the plan was made from.
    const updated = await store.updateSocialPostIf(postId, [post.status as SocialPostStatus], plan.fields, {
      approvalStatuses: [post.approvalStatus as ApprovalStatus],
    });
    if (!updated) {
      const now = await store.getSocialPost(ctx.accountId, postId);
      const stillEditable = now && (now.status === "scheduled" || now.status === "held");
      return refused(res, 409, stillEditable ? "changed" : "not_editable");
    }
    if (newVideo && post.videoPath !== updated.videoPath) await removeFile(post.videoPath);
    if (plan.notifyManagers) notifyNeedsApproval(ctx, updated);
    res.json(await viewOf(updated));
  }));

  // ─── Approve: agency, or a Manager of the account ─────────────────────────
  app.post("/api/social/accounts/:id/posts/:postId/approve", deps.requireAuth, wrapAsync(async (req, res) => {
    const ctx = await accountGate(req, res);
    if (!ctx) return;
    if (!canManageSocial(req.user, ctx.accountId)) return forbidden(res);
    const postId = postIdOf(req, res);
    if (postId === null) return;
    const post = await store.getSocialPost(ctx.accountId, postId);
    if (!post) return res.status(404).json({ message: "Post not found" });
    if (!canApprove(post)) return refused(res, 409, "not_allowed");
    // The Manager approves the version they saw: a caption or video edited since is not approved unseen.
    if (req.body?.version !== contentVersion(post)) return refused(res, 409, "changed");
    const userId = actorId(req, res);
    if (userId === null) return;
    const updated = await store.updateSocialPostIf(
      postId,
      APPROVE_FROM.statuses,
      { approvalStatus: "approved", approvedByUserId: userId, approvedAt: deps.now(), approvalNote: null },
      { approvalStatuses: APPROVE_FROM.approval, content: { caption: post.caption, videoPublicId: post.videoPublicId } },
    );
    if (!updated) return refused(res, 409, "changed");
    res.json(await viewOf(updated));
  }));

  // ─── Reject (with a note): agency, or a Manager of the account ────────────
  app.post("/api/social/accounts/:id/posts/:postId/reject", deps.requireAuth, wrapAsync(async (req, res) => {
    const ctx = await accountGate(req, res);
    if (!ctx) return;
    if (!canManageSocial(req.user, ctx.accountId)) return forbidden(res);
    const postId = postIdOf(req, res);
    if (postId === null) return;
    const note = typeof req.body?.note === "string" ? req.body.note.trim().slice(0, REJECT_NOTE_MAX) : "";
    const post = await store.getSocialPost(ctx.accountId, postId);
    if (!post) return res.status(404).json({ message: "Post not found" });
    if (!canReject(post)) return refused(res, 409, "not_allowed");
    if (req.body?.version !== undefined && req.body.version !== contentVersion(post)) return refused(res, 409, "changed");
    const updated = await store.updateSocialPostIf(
      postId,
      REJECT_FROM.statuses,
      { approvalStatus: "rejected", approvalNote: note || null, approvedByUserId: null, approvedAt: null },
      { approvalStatuses: REJECT_FROM.approval },
    );
    if (!updated) return refused(res, 409, "not_allowed");
    void deps.notifyAgency({
      type: "social_post_rejected",
      title: "Client rejected a post",
      body: note ? `Post ${postId} was rejected: "${note}"` : `Post ${postId} was rejected without a note.`,
      accountId: ctx.accountId,
      link: POST_LINK,
    }).catch(() => {});
    res.json(await viewOf(updated));
  }));

  // ─── Retry a failed post now: agency only ─────────────────────────────────
  app.post("/api/social/accounts/:id/posts/:postId/retry", deps.requireAuth, wrapAsync(async (req, res) => {
    const ctx = await accountGate(req, res);
    if (!ctx) return;
    if (!isAgency(req.user)) return forbidden(res);
    const postId = postIdOf(req, res);
    if (postId === null) return;
    const post = await store.getSocialPost(ctx.accountId, postId);
    if (!post) return res.status(404).json({ message: "Post not found" });
    const updated = await store.updateSocialPostIf(postId, ["failed"], {
      status: "scheduled",
      scheduledAt: deps.now(),
      igContainerId: null,
      publishingStartedAt: null,
      lastError: null,
      attempts: post.attempts + 1,
    });
    if (!updated) return refused(res, 409, "not_failed");
    res.json(await viewOf(updated));
  }));

  // ─── Cancel: agency only. Deletes the video file ──────────────────────────
  app.delete("/api/social/accounts/:id/posts/:postId", deps.requireAuth, wrapAsync(async (req, res) => {
    const ctx = await accountGate(req, res);
    if (!ctx) return;
    if (!isAgency(req.user)) return forbidden(res);
    const postId = postIdOf(req, res);
    if (postId === null) return;
    const post = await store.getSocialPost(ctx.accountId, postId);
    if (!post) return res.status(404).json({ message: "Post not found" });
    const updated = await store.updateSocialPostIf(postId, CANCELLABLE_STATUSES, { status: "cancelled" });
    if (!updated) return refused(res, 409, "not_editable");
    await removeFile(post.videoPath);
    res.json({ ok: true });
  }));

  // ─── Public video for Meta (no auth). Random id, so files can't be enumerated ─
  app.get("/media/social/:file", wrapAsync(async (req, res) => {
    const notFound = () => res.status(404).type("text/plain").send("Not found");
    const parsed = parseMediaFile(String(req.params.file ?? ""));
    if (!parsed || !UPLOAD_ID.test(parsed.publicId)) return notFound();
    const post = await store.getSocialPostByPublicId(parsed.publicId);
    if (!post || post.status === "cancelled" || post.videoExt !== parsed.ext || !insideUploads(post.videoPath)) return notFound();
    res.sendFile(resolve(post.videoPath), {
      acceptRanges: true,
      headers: { "Content-Type": MEDIA_CONTENT_TYPE[parsed.ext], "Cache-Control": "public, max-age=3600" },
    }, (err) => {
      if (err && !res.headersSent) res.status((err as { status?: number }).status ?? 404).end();
    });
  }));
}
