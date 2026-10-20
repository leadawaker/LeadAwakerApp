/**
 * Socials studio routes, part 2: topic ideas (typed or spoken), scripts (write, AI draft, send to the
 * Manager, his answer), a video for a script (HeyGen pull, read-only, or an upload) and the link to
 * the post that was scheduled from it. Spec: docs/superpowers/specs/2026-10-20-caption-writer-and-studio-design.md
 *
 * Who: topics are added by agency or the account's Managers; scripts are agency's (Gabriel stays in
 * control), the Manager only answers a script sent to him. Viewers read. Every lookup is account-scoped.
 */
import { randomUUID } from "node:crypto";
import { unlink } from "node:fs/promises";
import { resolve } from "node:path";
import type { Express } from "express";
import type { SocialPost } from "@shared/schema";
import { socialPageLink } from "@shared/socialStudio";
import { wrapAsync } from "../routes/_helpers";
import { decodeAudioPayload } from "../lib/groqTranscribe";
import { canManageSocial, isAgency } from "./access";
import { actorIdOf, forbidden, makeAccountGate, positiveIntParam, refused } from "./gate";
import { pullHeygenVideo } from "./heygenPull";
import { UPLOAD_ID } from "./postService";
import type { RateLimiter } from "./rateLimit";
import {
  buildScriptPrompt,
  parseNewScriptBody,
  parseNewTopicBody,
  parseReviewBody,
  parseScriptDraft,
  parseScriptEditBody,
  planReview,
  planScriptEdit,
  recentCloses,
  scriptVersion,
  SCRIPT_SCHEMA,
  SCRIPT_TIMEOUT_MS,
  toScriptView,
  toTopicView,
  visibleToClient,
} from "./scripts";
import type { StudioDeps } from "./studioDeps";

const MAX_AUDIO_BYTES = 15 * 1024 * 1024;

export function registerScriptRoutes(app: Express, deps: StudioDeps, limiter: RateLimiter): void {
  const { store } = deps;
  const accountGate = makeAccountGate((id) => store.getAccount(id));
  const uploadRoot = resolve(deps.uploadDir);
  const pathFor = (accountId: number, uploadId: string, ext: string) => resolve(uploadRoot, String(accountId), `${uploadId}.${ext}`);
  const drafting = new Set<number>();

  const postsById = async (accountId: number) => new Map((await store.listSocialPosts(accountId)).map((p) => [p.id, p] as [number, SocialPost]));

  /** Upload ids still in use: held by a script, or the video of a post that was not cancelled. */
  async function uploadsInUse(accountId: number): Promise<Set<string>> {
    const [scripts, posts] = await Promise.all([store.listSocialScripts(accountId), store.listSocialPosts(accountId)]);
    const held = new Set<string>();
    for (const sc of scripts) if (sc.videoUploadId) held.add(sc.videoUploadId);
    for (const p of posts) if (p.videoPublicId && p.status !== "cancelled") held.add(p.videoPublicId);
    return held;
  }

  async function scriptView(accountId: number, scriptId: number) {
    const s = await store.getSocialScript(accountId, scriptId);
    if (!s) return null;
    const post = s.postId ? await store.getSocialPost(accountId, s.postId) : null;
    return toScriptView(s, post);
  }

  // ─── Topics: any user of the account reads ────────────────────────────────
  app.get("/api/social/accounts/:id/topics", deps.requireAuth, wrapAsync(async (req, res) => {
    const ctx = await accountGate(req, res);
    if (!ctx) return;
    res.json((await store.listSocialTopics(ctx.accountId)).map(toTopicView));
  }));

  // ─── Add a topic: agency, or a Manager of the account ─────────────────────
  app.post("/api/social/accounts/:id/topics", deps.requireAuth, wrapAsync(async (req, res) => {
    const ctx = await accountGate(req, res);
    if (!ctx) return;
    if (!canManageSocial(req.user, ctx.accountId)) return forbidden(res);
    const userId = actorIdOf(req, res);
    if (userId === null) return;
    const parsed = parseNewTopicBody(req.body);
    if (!parsed.ok) return res.status(400).json({ message: parsed.message });
    const topic = await store.insertSocialTopic({ accountsId: ctx.accountId, text: parsed.input.text, source: parsed.input.source, status: "new", createdByUserId: userId });
    if (!isAgency(req.user)) {
      const preview = topic.text.length > 120 ? `${topic.text.slice(0, 119)}…` : topic.text;
      void deps.notifyAgency({
        type: "social_topic_new",
        title: "New video topic",
        body: `Account ${ctx.accountId} sent a topic idea: "${preview}"`,
        accountId: ctx.accountId,
        link: socialPageLink(ctx.accountId, "studio"),
      }).catch(() => {});
    }
    res.status(201).json(toTopicView(topic));
  }));

  // ─── Topic status (used / dismissed / new): agency only ───────────────────
  app.patch("/api/social/accounts/:id/topics/:topicId", deps.requireAuth, wrapAsync(async (req, res) => {
    const ctx = await accountGate(req, res);
    if (!ctx) return;
    if (!isAgency(req.user)) return forbidden(res);
    const topicId = positiveIntParam(req, res, "topicId");
    if (topicId === null) return;
    const status = req.body?.status;
    if (status !== "new" && status !== "used" && status !== "dismissed") return res.status(400).json({ message: "status must be new, used or dismissed" });
    const updated = await store.updateSocialTopic(ctx.accountId, topicId, { status });
    if (!updated) return res.status(404).json({ message: "Topic not found" });
    res.json(toTopicView(updated));
  }));

  // ─── Spoken topic to text: agency, or a Manager. Saves nothing ────────────
  app.post("/api/social/accounts/:id/topics/transcribe", deps.requireAuth, wrapAsync(async (req, res) => {
    const ctx = await accountGate(req, res);
    if (!ctx) return;
    if (!canManageSocial(req.user, ctx.accountId)) return forbidden(res);
    const userId = actorIdOf(req, res);
    if (userId === null) return;
    const audio = req.body?.audio_data;
    if (typeof audio !== "string" || !audio) return res.status(400).json({ message: "No audio data provided" });
    const buffer = decodeAudioPayload(audio);
    if (buffer.length === 0) return res.status(400).json({ message: "No audio data provided" });
    if (buffer.length > MAX_AUDIO_BYTES) return refused(res, 413, "too_long");
    if (!limiter.take(`stt:${userId}`, deps.now().getTime())) return refused(res, 429, "rate_limited");
    const mime = typeof req.body?.mime_type === "string" ? req.body.mime_type : "audio/webm";
    const result = await deps.transcribe(buffer, mime, ctx.language);
    if ("error" in result) {
      console.warn(`[social-topics] transcription failed for account ${ctx.accountId}: ${result.error}`);
      return refused(res, 502, "transcribe_failed");
    }
    if (!result.text.trim()) return refused(res, 422, "no_speech");
    res.json({ text: result.text.trim() });
  }));

  // ─── Scripts: agency sees all; client users the ones sent to them ─────────
  app.get("/api/social/accounts/:id/scripts", deps.requireAuth, wrapAsync(async (req, res) => {
    const ctx = await accountGate(req, res);
    if (!ctx) return;
    const [scripts, posts] = await Promise.all([store.listSocialScripts(ctx.accountId), postsById(ctx.accountId)]);
    const agency = isAgency(req.user);
    res.json(scripts.filter((s) => agency || visibleToClient(s)).map((s) => toScriptView(s, s.postId ? posts.get(s.postId) : null)));
  }));

  // ─── New script (optionally from a topic): agency only ────────────────────
  app.post("/api/social/accounts/:id/scripts", deps.requireAuth, wrapAsync(async (req, res) => {
    const ctx = await accountGate(req, res);
    if (!ctx) return;
    if (!isAgency(req.user)) return forbidden(res);
    const userId = actorIdOf(req, res);
    if (userId === null) return;
    const parsed = parseNewScriptBody(req.body);
    if (!parsed.ok) return res.status(400).json({ message: parsed.message });
    const { title, body, topicId } = parsed.input;
    if (topicId !== null && !(await store.listSocialTopics(ctx.accountId)).some((t) => t.id === topicId)) {
      return res.status(404).json({ message: "Topic not found" });
    }
    const script = await store.insertSocialScript({
      accountsId: ctx.accountId, title, body, status: body ? "draft" : "idea", topicId, createdByUserId: userId,
    });
    if (topicId !== null) await store.updateSocialTopic(ctx.accountId, topicId, { status: "used", scriptId: script.id });
    res.status(201).json(toScriptView(script, null));
  }));

  // ─── Edit title / body / manual status: agency only ───────────────────────
  app.patch("/api/social/accounts/:id/scripts/:scriptId", deps.requireAuth, wrapAsync(async (req, res) => {
    const ctx = await accountGate(req, res);
    if (!ctx) return;
    if (!isAgency(req.user)) return forbidden(res);
    const scriptId = positiveIntParam(req, res, "scriptId");
    if (scriptId === null) return;
    const parsed = parseScriptEditBody(req.body);
    if (!parsed.ok) return res.status(400).json({ message: parsed.message });
    const script = await store.getSocialScript(ctx.accountId, scriptId);
    if (!script) return res.status(404).json({ message: "Script not found" });
    await store.updateSocialScript(ctx.accountId, scriptId, planScriptEdit(script, parsed.input));
    res.json(await scriptView(ctx.accountId, scriptId));
  }));

  // ─── Draft the script with the voice guide: agency only ───────────────────
  app.post("/api/social/accounts/:id/scripts/:scriptId/draft", deps.requireAuth, wrapAsync(async (req, res) => {
    const ctx = await accountGate(req, res);
    if (!ctx) return;
    if (!isAgency(req.user)) return forbidden(res);
    const userId = actorIdOf(req, res);
    if (userId === null) return;
    const scriptId = positiveIntParam(req, res, "scriptId");
    if (scriptId === null) return;
    const script = await store.getSocialScript(ctx.accountId, scriptId);
    if (!script) return res.status(404).json({ message: "Script not found" });
    if (drafting.has(userId)) return refused(res, 429, "busy");
    if (!limiter.take(`ai:${userId}`, deps.now().getTime())) return refused(res, 429, "rate_limited");
    drafting.add(userId);
    try {
      const [settings, all] = await Promise.all([store.getSocialSettings(ctx.accountId), store.listSocialScripts(ctx.accountId)]);
      const prompt = buildScriptPrompt({
        voiceGuide: settings?.voiceGuide ?? "",
        aboutMe: settings?.aboutMe ?? "",
        language: ctx.language,
        title: script.title,
        notes: typeof req.body?.notes === "string" ? req.body.notes.slice(0, 2000) : "",
        currentBody: script.body,
        closesUsed: recentCloses(all, script.id),
      });
      const answer = await deps.ai({ ...prompt, model: "opus", timeoutMs: SCRIPT_TIMEOUT_MS, jsonSchema: SCRIPT_SCHEMA });
      if ("error" in answer) {
        console.warn(`[social-scripts] draft for script ${scriptId} failed: ${answer.error.slice(0, 200)}`);
        return refused(res, 502, "ai_failed");
      }
      const draft = parseScriptDraft(answer.text);
      if (!draft) return refused(res, 502, "no_options");
      // The model took a while: plan the edit on the script as it is now (the Manager may have answered meanwhile).
      const fresh = await store.getSocialScript(ctx.accountId, scriptId);
      if (!fresh) return res.status(404).json({ message: "Script not found" });
      await store.updateSocialScript(ctx.accountId, scriptId, planScriptEdit(fresh, { body: draft.body }));
      res.json(await scriptView(ctx.accountId, scriptId));
    } finally {
      drafting.delete(userId);
    }
  }));

  // ─── Send to the Manager for a look: agency only ──────────────────────────
  app.post("/api/social/accounts/:id/scripts/:scriptId/send-for-review", deps.requireAuth, wrapAsync(async (req, res) => {
    const ctx = await accountGate(req, res);
    if (!ctx) return;
    if (!isAgency(req.user)) return forbidden(res);
    const scriptId = positiveIntParam(req, res, "scriptId");
    if (scriptId === null) return;
    const script = await store.getSocialScript(ctx.accountId, scriptId);
    if (!script) return res.status(404).json({ message: "Script not found" });
    if (!script.body.trim()) return refused(res, 422, "empty_script");
    await store.updateSocialScript(ctx.accountId, scriptId, { reviewStatus: "waiting", reviewNote: null, reviewedAt: null, reviewedByUserId: null });
    void deps.notifyAccountManagers(ctx.accountId, {
      type: "social_script_review", key: "script_review", vars: { title: script.title }, link: socialPageLink(ctx.accountId, "home"),
    }).catch(() => {});
    res.json(await scriptView(ctx.accountId, scriptId));
  }));

  // ─── The Manager's answer (ok, or changes with a note) ────────────────────
  app.post("/api/social/accounts/:id/scripts/:scriptId/review", deps.requireAuth, wrapAsync(async (req, res) => {
    const ctx = await accountGate(req, res);
    if (!ctx) return;
    if (!canManageSocial(req.user, ctx.accountId)) return forbidden(res);
    const userId = actorIdOf(req, res);
    if (userId === null) return;
    const scriptId = positiveIntParam(req, res, "scriptId");
    if (scriptId === null) return;
    const parsed = parseReviewBody(req.body);
    if (!parsed.ok) return res.status(400).json({ message: parsed.message });
    const script = await store.getSocialScript(ctx.accountId, scriptId);
    if (!script || (!isAgency(req.user) && !visibleToClient(script))) return res.status(404).json({ message: "Script not found" });
    if (script.reviewStatus === "none") return refused(res, 409, "not_sent");
    // He answers the text he saw: an edit since he loaded it is refused, never approved unseen.
    if (parsed.input.version !== scriptVersion(script)) return refused(res, 409, "changed");
    await store.updateSocialScript(ctx.accountId, scriptId, planReview(script, parsed.input.decision, parsed.input.note, userId, deps.now()));
    if (!isAgency(req.user)) {
      void deps.notifyAgency({
        type: "social_script_review",
        title: parsed.input.decision === "ok" ? "Script approved by the client" : "Client asked for script changes",
        body: parsed.input.note ? `"${script.title}": ${parsed.input.note}` : `"${script.title}" is good to go.`,
        accountId: ctx.accountId,
        link: socialPageLink(ctx.accountId, "studio"),
      }).catch(() => {});
    }
    res.json(await scriptView(ctx.accountId, scriptId));
  }));

  // ─── Attach an uploaded mp4 (the existing upload endpoint): agency only ───
  app.post("/api/social/accounts/:id/scripts/:scriptId/video", deps.requireAuth, wrapAsync(async (req, res) => {
    const ctx = await accountGate(req, res);
    if (!ctx) return;
    if (!isAgency(req.user)) return forbidden(res);
    const scriptId = positiveIntParam(req, res, "scriptId");
    if (scriptId === null) return;
    const uploadId = req.body?.uploadId;
    if (typeof uploadId !== "string" || !UPLOAD_ID.test(uploadId)) return res.status(400).json({ message: "uploadId is invalid" });
    const script = await store.getSocialScript(ctx.accountId, scriptId);
    if (!script) return res.status(404).json({ message: "Script not found" });
    if (await store.getSocialPostByPublicId(uploadId)) return refused(res, 409, "upload_used");
    if ((await store.listSocialScripts(ctx.accountId)).some((x) => x.id !== scriptId && x.videoUploadId === uploadId)) return refused(res, 409, "upload_used");
    let found = false;
    for (const ext of ["mp4", "mov"]) {
      const check = await deps.video.inspect(pathFor(ctx.accountId, uploadId, ext));
      if (!check) continue;
      if (!check.ok) return refused(res, 422, check.reason);
      found = true;
      break;
    }
    if (!found) return refused(res, 422, "upload_missing");
    await store.updateSocialScript(ctx.accountId, scriptId, { videoUploadId: uploadId, heygenVideoId: null, status: "video_ready" });
    res.json(await scriptView(ctx.accountId, scriptId));
  }));

  // ─── HeyGen: the account's finished videos (read-only): agency only ───────
  app.get("/api/social/accounts/:id/heygen/videos", deps.requireAuth, wrapAsync(async (req, res) => {
    const ctx = await accountGate(req, res);
    if (!ctx) return;
    if (!isAgency(req.user)) return forbidden(res);
    const client = deps.heygen();
    if (!client) return res.json({ configured: false, videos: [], nextToken: null });
    const token = typeof req.query.token === "string" && /^[\w=+/.-]{1,512}$/.test(req.query.token) ? req.query.token : undefined;
    let page;
    try {
      page = await client.listVideos({ limit: 20, token });
    } catch (err: any) {
      console.warn(`[social-heygen] list failed: ${err?.message ?? err}`);
      return refused(res, 502, "heygen_failed");
    }
    // "Already used" only while its copy is still on a script or a live post: a replaced or cancelled one can be pulled again.
    const inUse = await uploadsInUse(ctx.accountId);
    const used = new Map((await store.listHeygenPulls(ctx.accountId)).filter((p) => inUse.has(p.uploadId)).map((p) => [p.heygenVideoId, p.scriptId]));
    res.json({
      configured: true,
      nextToken: page.nextToken,
      // Never a presigned link (the video, and the thumbnail, which may be signed too): the server downloads the video itself.
      videos: page.videos.map(({ videoUrl: _v, thumbnailUrl: _t, ...v }) => ({ ...v, selectable: v.status === "completed", alreadyUsed: used.has(v.id), usedByScriptId: used.get(v.id) ?? null })),
    });
  }));

  // ─── Use a HeyGen video for a script: download it like an upload ──────────
  app.post("/api/social/accounts/:id/scripts/:scriptId/heygen", deps.requireAuth, wrapAsync(async (req, res) => {
    const ctx = await accountGate(req, res);
    if (!ctx) return;
    if (!isAgency(req.user)) return forbidden(res);
    const userId = actorIdOf(req, res);
    if (userId === null) return;
    const scriptId = positiveIntParam(req, res, "scriptId");
    if (scriptId === null) return;
    const videoId = req.body?.videoId;
    if (typeof videoId !== "string" || !/^[\w-]{1,128}$/.test(videoId)) return res.status(400).json({ message: "videoId is invalid" });
    const client = deps.heygen();
    if (!client) return refused(res, 501, "heygen_not_configured");
    const script = await store.getSocialScript(ctx.accountId, scriptId);
    if (!script) return res.status(404).json({ message: "Script not found" });
    const earlier = (await store.listHeygenPulls(ctx.accountId)).find((p) => p.heygenVideoId === videoId);
    if (earlier) {
      if ((await uploadsInUse(ctx.accountId)).has(earlier.uploadId)) return refused(res, 409, "already_used");
      await store.deleteHeygenPull(ctx.accountId, videoId); // its copy is gone: pull it again
    }

    const uploadId = randomUUID();
    const destPath = pathFor(ctx.accountId, uploadId, "mp4");
    let outcome;
    try {
      outcome = await pullHeygenVideo({ client, videoId, destPath, maxBytes: deps.maxUploadBytes, receive: deps.video.receive });
    } catch (err: any) {
      console.warn(`[social-heygen] pull of ${videoId} failed: ${err?.message ?? err}`);
      return refused(res, 502, "download_failed");
    }
    if (!outcome.ok) return refused(res, outcome.status, outcome.reason);
    try {
      await store.insertHeygenPull({ accountsId: ctx.accountId, heygenVideoId: videoId, scriptId, uploadId, pulledByUserId: userId });
    } catch (err: any) {
      // Two pulls of the same video at once: the unique index decides, the loser removes its copy.
      await unlink(destPath).catch(() => {});
      if (err?.code === "23505") return refused(res, 409, "already_used");
      throw err;
    }
    await store.updateSocialScript(ctx.accountId, scriptId, { videoUploadId: uploadId, heygenVideoId: videoId, status: "video_ready" });
    const { ok: _ok, ...video } = outcome.video;
    res.json({ script: await scriptView(ctx.accountId, scriptId), upload: { uploadId, ext: "mp4", ...video } });
  }));

  // ─── The post scheduled from this script: agency only ─────────────────────
  app.post("/api/social/accounts/:id/scripts/:scriptId/link-post", deps.requireAuth, wrapAsync(async (req, res) => {
    const ctx = await accountGate(req, res);
    if (!ctx) return;
    if (!isAgency(req.user)) return forbidden(res);
    const scriptId = positiveIntParam(req, res, "scriptId");
    if (scriptId === null) return;
    const postId = req.body?.postId;
    if (!Number.isInteger(postId) || postId <= 0) return res.status(400).json({ message: "Invalid postId" });
    const [script, post] = await Promise.all([store.getSocialScript(ctx.accountId, scriptId), store.getSocialPost(ctx.accountId, postId)]);
    if (!script) return res.status(404).json({ message: "Script not found" });
    if (!post) return res.status(404).json({ message: "Post not found" });
    // The video now belongs to the post; the script no longer holds it. "scheduled" and "published" are read from
    // the post (effectiveScriptStatus); stored, the script is approved, so a cancelled post leaves it workable again.
    await store.updateSocialScript(ctx.accountId, scriptId, {
      postId,
      status: "approved",
      videoUploadId: post.videoPublicId === script.videoUploadId ? null : script.videoUploadId,
    });
    res.json(await scriptView(ctx.accountId, scriptId));
  }));
}
