// HTTP tests for the scheduled-post routes. No database, no ffmpeg, no pm2: storage is an
// in-memory fake, the video probe is faked, and files live in a temp dir.
import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import express from "express";
import type { InsertSocialPost, SocialConnection, SocialPost } from "@shared/schema";
import type { ApprovalStatus, SocialPostStatus } from "@shared/socialPosts";
import { receiveVideo } from "./upload";
import { contentVersion } from "./postService";
import { registerSocialPostRoutes, type PostRouteDeps } from "./postRoutes";

const tmp = mkdtempSync(join(tmpdir(), "social-routes-"));
after(() => rmSync(tmp, { recursive: true, force: true }));

const A = 7; // client account with Social on
const B = 8; // another client account
const OFF = 9; // client account with Social off
const ID1 = "0b9f1c1e-0000-4000-8000-000000000001";
const ID2 = "0b9f1c1e-0000-4000-8000-000000000002";
const ID3 = "0b9f1c1e-0000-4000-8000-000000000003";

const AGENCY = { id: 1, role: "Owner", accountsId: 1 };
const MANAGER_A = { id: 21, role: "Manager", accountsId: A };
const VIEWER_A = { id: 22, role: "Viewer", accountsId: A };
const MANAGER_B = { id: 31, role: "Manager", accountsId: B };
const MANAGER_OFF = { id: 41, role: "Manager", accountsId: OFF };

const NOW = new Date("2026-10-20T12:00:00Z");

function makePost(over: Partial<SocialPost>): SocialPost {
  const publicId = over.videoPublicId ?? ID1;
  const accountsId = over.accountsId ?? A;
  return {
    id: 1, accountsId, connectionId: 3, mediaType: "REELS",
    videoPath: join(tmp, "social", String(accountsId), `${publicId}.mp4`),
    videoPublicId: publicId, videoExt: "mp4", videoDurationS: 58, videoWidth: 1080, videoHeight: 1920, videoBytes: 1000,
    caption: "hello", shareToFeed: true, isAiGenerated: true,
    scheduledAt: new Date("2026-10-27T21:00:00Z"),
    requiresApproval: true, approvalStatus: "pending", approvalNote: null,
    approvedByUserId: null, approvedAt: null, approvalWaivedByUserId: null, approvalWaivedAt: null, approvalReminderSentAt: null,
    status: "scheduled", igContainerId: null, publishingStartedAt: null, igMediaId: null, permalink: null,
    attempts: 0, lastError: null, publishedAt: null, createdByUserId: 1,
    createdAt: NOW, updatedAt: NOW,
    ...over,
  } as SocialPost;
}

function conn(accountsId: number, status: string): SocialConnection {
  return { id: 100 + accountsId, accountsId, provider: "instagram", status, externalUserId: "1784" } as unknown as SocialConnection;
}

let posts: SocialPost[];
let connections: SocialConnection[];
let managerNotes: Array<{ accountId: number; key: string }>;
let agencyNotes: Array<{ type: string }>;
let probeResult: { ok: true; durationS: number; width: number; height: number; bytes: number } | { ok: false; reason: string };
/** Runs inside updateIf just before it checks the row: simulates another writer (the publisher, a Manager). */
let beforeUpdate: ((p: SocialPost) => void) | null;
let realReceive: boolean;
/** Upload ids a studio script still holds. */
let heldByScript: Set<string>;

function writeUpload(accountId: number, id: string, ext = "mp4"): string {
  const p = join(tmp, "social", String(accountId), `${id}.${ext}`);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, Buffer.alloc(1000, 1));
  return p;
}

const deps: PostRouteDeps = {
  requireAuth: (req, res, next) => {
    const raw = req.headers["x-test-user"];
    if (typeof raw !== "string") return res.status(401).json({ message: "Unauthorized" });
    (req as any).user = JSON.parse(raw);
    next();
  },
  now: () => NOW,
  uploadDir: join(tmp, "social"),
  maxUploadBytes: 2000,
  store: {
    async getAccount(id) {
      if (id === A || id === B) return { timezone: "America/Sao_Paulo", language: "Portuguese", socialEnabled: true };
      if (id === OFF) return { timezone: "Europe/Amsterdam", language: "Dutch", socialEnabled: false };
      return null;
    },
    async getSocialConnection(id) { return connections.find((c) => c.accountsId === id) ?? null; },
    async listSocialPosts(id) { return posts.filter((p) => p.accountsId === id && p.status !== "cancelled"); },
    async getSocialPost(accountId, postId) { return posts.find((p) => p.id === postId && p.accountsId === accountId) ?? null; },
    async getSocialPostByPublicId(publicId) { return posts.find((p) => p.videoPublicId === publicId) ?? null; },
    async insertSocialPost(row: InsertSocialPost) {
      const p = makePost({ ...(row as Partial<SocialPost>), id: posts.length + 1 });
      posts.push(p);
      return p;
    },
    async updateSocialPostIf(postId, allowed: SocialPostStatus[], fields, opts: { approvalStatuses?: ApprovalStatus[]; content?: { caption: string; videoPublicId: string | null } } = {}) {
      const p = posts.find((x) => x.id === postId);
      if (!p) return null;
      beforeUpdate?.(p);
      if (!allowed.includes(p.status as SocialPostStatus)) return null;
      if (opts.approvalStatuses?.length && !opts.approvalStatuses.includes(p.approvalStatus as ApprovalStatus)) return null;
      if (opts.content && (opts.content.caption !== p.caption || opts.content.videoPublicId !== p.videoPublicId)) return null;
      Object.assign(p, fields);
      return p;
    },
    async getSocialUserNames(ids) { return new Map(ids.filter((i) => i === 21).map((i) => [i, "Augusto"])); },
    async isUploadHeldByScript(publicId) { return heldByScript.has(publicId); },
  },
  video: {
    async receive(src, dest, max) {
      if (realReceive) return receiveVideo(src, dest, max);
      // Fake: store the bytes, skip ffmpeg.
      const chunks: Buffer[] = [];
      for await (const c of src as AsyncIterable<Buffer>) chunks.push(Buffer.from(c));
      mkdirSync(dirname(dest), { recursive: true });
      writeFileSync(dest, Buffer.concat(chunks));
      if (!probeResult.ok) { rmSync(dest, { force: true }); return { ok: false, status: 422, reason: probeResult.reason }; }
      return probeResult;
    },
    async inspect(path) { return existsSync(path) ? probeResult : null; },
  },
  notifyAgency: async (n) => { agencyNotes.push({ type: n.type }); },
  notifyAccountManagers: async (accountId, n) => { managerNotes.push({ accountId, key: n.key }); },
};

let base = "";
let server: http.Server;
before(async () => {
  const app = express();
  app.use(express.json());
  registerSocialPostRoutes(app, deps);
  server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(() => new Promise<void>((r) => server.close(() => r())));

beforeEach(() => {
  posts = [];
  connections = [conn(A, "connected"), conn(B, "connected")];
  managerNotes = [];
  agencyNotes = [];
  probeResult = { ok: true, durationS: 58, width: 1080, height: 1920, bytes: 1000 };
  beforeUpdate = null;
  realReceive = false;
  heldByScript = new Set();
  rmSync(join(tmp, "social"), { recursive: true, force: true });
});

async function call(method: string, path: string, user: object | null, body?: unknown, headers: Record<string, string> = {}) {
  const h: Record<string, string> = { ...headers };
  if (user) h["x-test-user"] = JSON.stringify(user);
  let payload: BodyInit | undefined;
  if (body instanceof Buffer) payload = body;
  else if (body !== undefined) { payload = JSON.stringify(body); h["content-type"] = "application/json"; }
  const res = await fetch(base + path, { method, headers: h, body: payload });
  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: res.status, json, headers: res.headers, text };
}

const newPostBody = (uploadId = ID1) => ({ uploadId, caption: "Olá", date: "2026-10-27", time: "18:00", shareToFeed: true, isAiGenerated: true, requiresApproval: true });

// ─── Cross-account access ────────────────────────────────────────────────────

test("a Manager of A cannot list, approve or read B's posts", async () => {
  posts = [makePost({ id: 1, accountsId: B })];
  assert.equal((await call("GET", `/api/social/accounts/${B}/posts`, MANAGER_A)).status, 403);
  assert.equal((await call("POST", `/api/social/accounts/${B}/posts/1/approve`, MANAGER_A)).status, 403);
  assert.equal(posts[0].approvalStatus, "pending");
});

test("B's post id under A's URL is not found, and nothing changes", async () => {
  posts = [makePost({ id: 1, accountsId: B })];
  assert.equal((await call("POST", `/api/social/accounts/${A}/posts/1/approve`, MANAGER_A)).status, 404);
  assert.equal((await call("POST", `/api/social/accounts/${A}/posts/1/reject`, MANAGER_A, { note: "no" })).status, 404);
  assert.equal((await call("PATCH", `/api/social/accounts/${A}/posts/1`, AGENCY, { caption: "x" })).status, 404);
  assert.equal((await call("DELETE", `/api/social/accounts/${A}/posts/1`, AGENCY)).status, 404);
  assert.equal(posts[0].approvalStatus, "pending");
  assert.equal(posts[0].status, "scheduled");
  assert.equal(posts[0].caption, "hello");
});

test("the list only holds the account's own posts and never file paths", async () => {
  posts = [makePost({ id: 1, accountsId: A }), makePost({ id: 2, accountsId: B, videoPublicId: ID2 })];
  const r = await call("GET", `/api/social/accounts/${A}/posts`, VIEWER_A);
  assert.equal(r.status, 200);
  assert.deepEqual(r.json.map((p: any) => p.id), [1]);
  assert.equal(r.json[0].videoUrl, `/media/social/${ID1}.mp4`);
  assert.ok(!r.text.includes(tmp), "no server path in the response");
});

test("an upload id from another account cannot be used for a post", async () => {
  writeUpload(B, ID1);
  const r = await call("POST", `/api/social/accounts/${A}/posts`, AGENCY, newPostBody(ID1));
  assert.equal(r.status, 422);
  assert.equal(r.json.reason, "upload_missing");
  assert.equal(posts.length, 0);
});

test("client users only reach the Social routes when Social is on for their account", async () => {
  assert.equal((await call("GET", `/api/social/accounts/${OFF}/posts`, MANAGER_OFF)).status, 403);
  assert.equal((await call("GET", `/api/social/accounts/${OFF}/posts`, AGENCY)).status, 200);
});

test("no session is 401", async () => {
  assert.equal((await call("GET", `/api/social/accounts/${A}/posts`, null)).status, 401);
});

// ─── Roles ───────────────────────────────────────────────────────────────────

test("a Viewer cannot approve or reject; a Manager cannot create, edit, retry or cancel", async () => {
  posts = [makePost({ id: 1 })];
  assert.equal((await call("POST", `/api/social/accounts/${A}/posts/1/approve`, VIEWER_A)).status, 403);
  assert.equal((await call("POST", `/api/social/accounts/${A}/posts/1/reject`, VIEWER_A, { note: "x" })).status, 403);
  assert.equal((await call("POST", `/api/social/accounts/${A}/posts`, MANAGER_A, newPostBody())).status, 403);
  assert.equal((await call("PATCH", `/api/social/accounts/${A}/posts/1`, MANAGER_A, { caption: "x" })).status, 403);
  assert.equal((await call("POST", `/api/social/accounts/${A}/posts/1/retry`, MANAGER_A)).status, 403);
  assert.equal((await call("DELETE", `/api/social/accounts/${A}/posts/1`, MANAGER_A)).status, 403);
  assert.equal((await call("POST", `/api/social/accounts/${A}/uploads`, MANAGER_A, Buffer.alloc(10), { "content-type": "video/mp4" })).status, 403);
  assert.equal(posts[0].approvalStatus, "pending");
});

// ─── Uploads ─────────────────────────────────────────────────────────────────

test("an accepted upload is stored under the account and described", async () => {
  const r = await call("POST", `/api/social/accounts/${A}/uploads`, AGENCY, Buffer.alloc(1000), { "content-type": "video/mp4" });
  assert.equal(r.status, 200);
  assert.match(r.json.uploadId, /^[0-9a-f-]{36}$/);
  assert.equal(r.json.ext, "mp4");
  assert.equal(r.json.durationS, 58);
  assert.ok(existsSync(join(tmp, "social", String(A), `${r.json.uploadId}.mp4`)));
});

test("a wrong content type is 415 before anything is written", async () => {
  const r = await call("POST", `/api/social/accounts/${A}/uploads`, AGENCY, Buffer.alloc(100), { "content-type": "video/webm" });
  assert.equal(r.status, 415);
  assert.equal(existsSync(join(tmp, "social", String(A))), false);
});

test("an oversized upload by Content-Length is 413 before reading", async () => {
  const status = await new Promise<number>((resolve, reject) => {
    const req = http.request(`${base}/api/social/accounts/${A}/uploads`, {
      method: "POST",
      headers: { "content-type": "video/mp4", "content-length": String(150 * 1024 * 1024), "x-test-user": JSON.stringify(AGENCY) },
    }, (res) => { res.resume(); resolve(res.statusCode ?? 0); });
    req.on("error", reject);
    req.write(Buffer.alloc(100));
  });
  assert.equal(status, 413);
  assert.equal(existsSync(join(tmp, "social", String(A))) ? readdirSync(join(tmp, "social", String(A))).length : 0, 0);
});

test("an oversized chunked upload is refused and leaves no partial file", async () => {
  realReceive = true; // the real streaming limit (no ffmpeg is reached: it stops at the byte count)
  const outcome = await new Promise<number | "reset">((resolve) => {
    const req = http.request(`${base}/api/social/accounts/${A}/uploads`, {
      method: "POST",
      headers: { "content-type": "video/mp4", "transfer-encoding": "chunked", "x-test-user": JSON.stringify(AGENCY) },
    }, (res) => { res.resume(); resolve(res.statusCode ?? 0); });
    req.on("error", () => resolve("reset"));
    req.write(Buffer.alloc(1500));
    req.end(Buffer.alloc(1500));
  });
  assert.ok(outcome === 413 || outcome === "reset", `got ${outcome}`);
  await new Promise((r) => setTimeout(r, 50));
  const dir = join(tmp, "social", String(A));
  assert.equal(existsSync(dir) ? readdirSync(dir).length : 0, 0);
});

test("a video outside Meta's specs is 422 with the reason and no file", async () => {
  probeResult = { ok: false, reason: "fps" };
  const r = await call("POST", `/api/social/accounts/${A}/uploads`, AGENCY, Buffer.alloc(500), { "content-type": "video/quicktime" });
  assert.equal(r.status, 422);
  assert.equal(r.json.reason, "fps");
  assert.equal(readdirSync(join(tmp, "social", String(A))).length, 0);
});

// ─── Creating posts ──────────────────────────────────────────────────────────

test("a new post needing approval is pending and notifies the Managers", async () => {
  writeUpload(A, ID1);
  const r = await call("POST", `/api/social/accounts/${A}/posts`, AGENCY, newPostBody());
  assert.equal(r.status, 201);
  assert.equal(posts[0].approvalStatus, "pending");
  assert.equal(posts[0].scheduledAt.toISOString(), "2026-10-27T21:00:00.000Z");
  assert.ok(posts[0].scheduledAt instanceof Date);
  assert.deepEqual(managerNotes, [{ accountId: A, key: "needs_approval" }]);
  assert.equal(r.json.section, "needs_approval");
});

test("a new post refuses a missing connection, a past time and a long caption", async () => {
  writeUpload(A, ID1);
  connections = [conn(A, "disconnected")];
  assert.equal((await call("POST", `/api/social/accounts/${A}/posts`, AGENCY, newPostBody())).json.reason, "not_connected");
  connections = [conn(A, "connected")];
  assert.equal((await call("POST", `/api/social/accounts/${A}/posts`, AGENCY, { ...newPostBody(), date: "2026-10-19" })).json.reason, "in_past");
  assert.equal((await call("POST", `/api/social/accounts/${A}/posts`, AGENCY, { ...newPostBody(), caption: "a".repeat(2201) })).json.reason, "too_long");
  assert.equal(posts.length, 0);
});

test("an upload already used by a post cannot start a second post", async () => {
  writeUpload(A, ID1);
  posts = [makePost({ id: 1 })];
  const r = await call("POST", `/api/social/accounts/${A}/posts`, AGENCY, newPostBody(ID1));
  assert.equal(r.status, 409);
  assert.equal(posts.length, 1);
});

// ─── Unapproved posts never get approved by accident ─────────────────────────

test("editing the caption of an approved post sends it back for approval", async () => {
  posts = [makePost({ id: 1, approvalStatus: "approved", approvedByUserId: 21 })];
  const r = await call("PATCH", `/api/social/accounts/${A}/posts/1`, AGENCY, { caption: "new" });
  assert.equal(r.status, 200);
  assert.equal(posts[0].approvalStatus, "pending");
  assert.deepEqual(managerNotes.map((n) => n.key), ["needs_approval"]);
});

test("an edit loses to a Manager approving at the same moment (no approval is wiped)", async () => {
  posts = [makePost({ id: 1, approvalStatus: "pending" })];
  beforeUpdate = (p) => { p.approvalStatus = "approved"; p.approvedByUserId = 21; };
  const r = await call("PATCH", `/api/social/accounts/${A}/posts/1`, AGENCY, { date: "2026-10-28", time: "09:00" });
  assert.equal(r.status, 409);
  assert.equal(posts[0].approvalStatus, "approved");
  assert.equal(posts[0].scheduledAt.toISOString(), "2026-10-27T21:00:00.000Z");
});

test("an edit racing the publisher is 409 and the post publishes as approved", async () => {
  posts = [makePost({ id: 1, approvalStatus: "approved" })];
  beforeUpdate = (p) => { p.status = "publishing"; };
  const r = await call("PATCH", `/api/social/accounts/${A}/posts/1`, AGENCY, { caption: "half-edited" });
  assert.equal(r.status, 409);
  assert.equal(r.json.reason, "not_editable");
  assert.equal(posts[0].caption, "hello");
  assert.equal(posts[0].approvalStatus, "approved");
});

test("approve and reject follow the rules and record who and why", async () => {
  posts = [makePost({ id: 1 })];
  const rej = await call("POST", `/api/social/accounts/${A}/posts/1/reject`, MANAGER_A, { note: "Outra legenda" });
  assert.equal(rej.status, 200);
  assert.equal(posts[0].approvalStatus, "rejected");
  assert.equal(posts[0].approvalNote, "Outra legenda");
  assert.deepEqual(agencyNotes.map((n) => n.type), ["social_post_rejected"]);
  const app = await call("POST", `/api/social/accounts/${A}/posts/1/approve`, MANAGER_A, { version: contentVersion(posts[0]) });
  assert.equal(app.status, 200);
  assert.equal(posts[0].approvalStatus, "approved");
  assert.equal(posts[0].approvedByUserId, 21);
  assert.ok(posts[0].approvedAt instanceof Date);
  assert.equal(app.json.approvedByName, "Augusto");
});

test("a post that started publishing cannot be approved, rejected or cancelled", async () => {
  posts = [makePost({ id: 1, status: "publishing", approvalStatus: "approved" })];
  assert.equal((await call("POST", `/api/social/accounts/${A}/posts/1/reject`, MANAGER_A, { note: "x" })).status, 409);
  assert.equal((await call("DELETE", `/api/social/accounts/${A}/posts/1`, AGENCY)).status, 409);
  assert.equal(posts[0].approvalStatus, "approved");
  assert.equal(posts[0].status, "publishing");
});

test("a post without approval required cannot be approved", async () => {
  posts = [makePost({ id: 1, requiresApproval: false, approvalStatus: "not_required" })];
  assert.equal((await call("POST", `/api/social/accounts/${A}/posts/1/approve`, MANAGER_A, { version: contentVersion(posts[0]) })).status, 409);
});

test("a Manager cannot approve a caption the agency changed after they loaded it", async () => {
  posts = [makePost({ id: 1, caption: "seen" })];
  const seen = (await call("GET", `/api/social/accounts/${A}/posts`, MANAGER_A)).json[0].version;
  posts[0].caption = "edited later";
  const r = await call("POST", `/api/social/accounts/${A}/posts/1/approve`, MANAGER_A, { version: seen });
  assert.equal(r.status, 409);
  assert.equal(r.json.reason, "changed");
  assert.equal(posts[0].approvalStatus, "pending");
  assert.equal((await call("POST", `/api/social/accounts/${A}/posts/1/approve`, MANAGER_A)).status, 409, "no version, no approval");
});

test("an edit landing between the approve check and its write leaves the post unapproved", async () => {
  posts = [makePost({ id: 1 })];
  const version = contentVersion(posts[0]);
  beforeUpdate = (p) => { p.caption = "swapped"; };
  assert.equal((await call("POST", `/api/social/accounts/${A}/posts/1/approve`, MANAGER_A, { version })).status, 409);
  assert.equal(posts[0].approvalStatus, "pending");
});

// ─── Retry and cancel ────────────────────────────────────────────────────────

test("retry resets a failed post to now and counts the attempt", async () => {
  posts = [makePost({ id: 1, status: "failed", lastError: "boom", igContainerId: "c1", attempts: 1, approvalStatus: "approved" })];
  const r = await call("POST", `/api/social/accounts/${A}/posts/1/retry`, AGENCY);
  assert.equal(r.status, 200);
  assert.equal(posts[0].status, "scheduled");
  assert.equal(posts[0].scheduledAt.getTime(), NOW.getTime());
  assert.equal(posts[0].igContainerId, null);
  assert.equal(posts[0].lastError, null);
  assert.equal(posts[0].attempts, 2);
  assert.equal((await call("POST", `/api/social/accounts/${A}/posts/1/retry`, AGENCY)).status, 409);
});

test("cancelling deletes the video file", async () => {
  const path = writeUpload(A, ID1);
  posts = [makePost({ id: 1, videoPath: path })];
  assert.equal((await call("DELETE", `/api/social/accounts/${A}/posts/1`, AGENCY)).status, 200);
  assert.equal(posts[0].status, "cancelled");
  assert.equal(existsSync(path), false);
});

test("cancelling keeps the file when a studio script still holds the same upload", async () => {
  const path = writeUpload(A, ID1);
  posts = [makePost({ id: 1, videoPath: path })];
  heldByScript.add(ID1);
  assert.equal((await call("DELETE", `/api/social/accounts/${A}/posts/1`, AGENCY)).status, 200);
  assert.equal(posts[0].status, "cancelled");
  assert.equal(existsSync(path), true);
});

// ─── Public media ────────────────────────────────────────────────────────────

test("public media serves a post's video with ranges, never a cancelled one or an unknown id", async () => {
  const path = writeUpload(A, ID1);
  posts = [makePost({ id: 1, videoPath: path })];
  const ok = await call("GET", `/media/social/${ID1}.mp4`, null);
  assert.equal(ok.status, 200);
  assert.equal(ok.headers.get("content-type"), "video/mp4");
  assert.equal(ok.headers.get("accept-ranges"), "bytes");
  const ranged = await call("GET", `/media/social/${ID1}.mp4`, null, undefined, { range: "bytes=0-9" });
  assert.equal(ranged.status, 206);
  assert.equal((await call("GET", `/media/social/${ID1}.mov`, null)).status, 404);
  assert.equal((await call("GET", `/media/social/${ID3}.mp4`, null)).status, 404);
  assert.equal((await call("GET", `/media/social/..%2F..%2Fetc.mp4`, null)).status, 404);
  posts[0].status = "cancelled";
  assert.equal((await call("GET", `/media/social/${ID1}.mp4`, null)).status, 404);
});

test("public media refuses a stored path outside the upload dir", async () => {
  const outside = join(tmp, "secret.mp4");
  writeFileSync(outside, "x");
  posts = [makePost({ id: 1, videoPath: outside })];
  assert.equal((await call("GET", `/media/social/${ID1}.mp4`, null)).status, 404);
});

test("a session user without an id cannot write a post or an approval", async () => {
  writeUpload(A, ID1);
  posts = [makePost({ id: 1 })];
  const noId = { id: null, role: "Owner", accountsId: 1 };
  assert.equal((await call("POST", `/api/social/accounts/${A}/posts`, noId, newPostBody(ID2))).status, 403);
  assert.equal((await call("POST", `/api/social/accounts/${A}/posts/1/approve`, { ...noId }, { version: contentVersion(posts[0]) })).status, 403);
  assert.equal(posts[0].approvalStatus, "pending");
});
