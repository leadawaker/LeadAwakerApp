// HTTP tests for the studio routes (settings, Sobre mim, caption writer, topics, scripts, HeyGen).
// No database, no model, no HeyGen, no Groq: every dependency is an in-memory fake.
import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { Readable } from "node:stream";
import express from "express";
import type { SocialHeygenPull, SocialPost, SocialScript, SocialSettings, SocialTopic } from "@shared/schema";
import type { HeygenClient, HeygenVideo } from "./heygen";
import { createRateLimiter } from "./rateLimit";
import { registerScriptRoutes } from "./scriptRoutes";
import type { StudioDeps } from "./studioDeps";
import { registerStudioRoutes } from "./studioRoutes";

const tmp = mkdtempSync(join(tmpdir(), "social-studio-"));
after(() => rmSync(tmp, { recursive: true, force: true }));

const A = 7, B = 8, OFF = 9;
const AGENCY = { id: 1, role: "Owner", accountsId: 1 };
const MANAGER_A = { id: 21, role: "Manager", accountsId: A };
const VIEWER_A = { id: 22, role: "Viewer", accountsId: A };
const MANAGER_B = { id: 31, role: "Manager", accountsId: B };
const MANAGER_OFF = { id: 41, role: "Manager", accountsId: OFF };
const NOW = new Date("2026-10-20T12:00:00Z");
const UP1 = "0b9f1c1e-0000-4000-8000-0000000000a1";

let settings: SocialSettings[];
let topics: SocialTopic[];
let scripts: SocialScript[];
let pulls: SocialHeygenPull[];
let posts: SocialPost[];
let aiCalls: Array<{ system: string; user: string; model: string }>;
let aiAnswer: { text: string } | { error: string };
let transcribeCalls: Array<{ bytes: number; language: string | null }>;
let transcribeAnswer: { text: string } | { error: string };
let agencyNotes: Array<{ type: string; link: string }>;
let managerNotes: Array<{ accountId: number; key: string; link: string }>;
let heygenVideos: HeygenVideo[];
let heygenOn: boolean;
let receiveCalls: number;

const row = <T>(over: Partial<T>, defaults: Partial<T>) => ({ ...defaults, ...over }) as T;

function fakeHeygen(): HeygenClient {
  return {
    async listVideos() { return { videos: heygenVideos, nextToken: "next1" }; },
    async getVideo(id) { return heygenVideos.find((v) => v.id === id) ?? null; },
    async downloadVideo() { return Readable.from([Buffer.from("mp4bytes")]); },
  };
}

const deps: StudioDeps = {
  requireAuth: (req, res, next) => {
    const raw = req.headers["x-test-user"];
    if (typeof raw !== "string") return res.status(401).json({ message: "Unauthorized" });
    (req as any).user = JSON.parse(raw);
    next();
  },
  now: () => NOW,
  uploadDir: join(tmp, "social"),
  maxUploadBytes: 1000,
  store: {
    async getAccount(id) {
      if (id === A || id === B) return { timezone: "America/Sao_Paulo", language: "Portuguese", socialEnabled: true };
      if (id === OFF) return { timezone: "Europe/Amsterdam", language: "Dutch", socialEnabled: false };
      return null;
    },
    async getSocialSettings(id) { return settings.find((s) => s.accountsId === id) ?? null; },
    async upsertSocialSettings(id, fields, userId) {
      let s = settings.find((x) => x.accountsId === id);
      if (!s) { s = row<SocialSettings>({ accountsId: id }, { id: settings.length + 1, captionStyle: "", voiceGuide: "", aboutMe: "", dmMode: "off", dmHourlyCap: 20, createdAt: NOW, updatedAt: NOW }); settings.push(s); }
      Object.assign(s, fields, { updatedByUserId: userId });
      return s;
    },
    async listSocialTopics(id) { return topics.filter((t) => t.accountsId === id); },
    async insertSocialTopic(r) { const t = row<SocialTopic>(r as Partial<SocialTopic>, { id: topics.length + 1, scriptId: null, createdAt: NOW, updatedAt: NOW }); topics.push(t); return t; },
    async updateSocialTopic(accountId, topicId, fields) { const t = topics.find((x) => x.id === topicId && x.accountsId === accountId); if (!t) return null; Object.assign(t, fields); return t; },
    async listSocialScripts(id) { return scripts.filter((s) => s.accountsId === id); },
    async getSocialScript(accountId, scriptId) { return scripts.find((s) => s.id === scriptId && s.accountsId === accountId) ?? null; },
    async insertSocialScript(r) {
      const s = row<SocialScript>(r as Partial<SocialScript>, { id: scripts.length + 1, body: "", status: "idea", topicId: null, postId: null, videoUploadId: null, heygenVideoId: null, reviewStatus: "none", reviewNote: null, reviewedByUserId: null, reviewedAt: null, seedKey: null, createdAt: NOW, updatedAt: NOW });
      scripts.push(s);
      return s;
    },
    async updateSocialScript(accountId, scriptId, fields) { const s = scripts.find((x) => x.id === scriptId && x.accountsId === accountId); if (!s) return null; Object.assign(s, fields); return s; },
    async listHeygenPulls(id) { return pulls.filter((p) => p.accountsId === id); },
    async insertHeygenPull(r) {
      if (pulls.some((p) => p.accountsId === r.accountsId && p.heygenVideoId === r.heygenVideoId)) throw Object.assign(new Error("dup"), { code: "23505" });
      const p = row<SocialHeygenPull>(r as Partial<SocialHeygenPull>, { id: pulls.length + 1, pulledAt: NOW });
      pulls.push(p);
      return p;
    },
    async listSocialPosts(id) { return posts.filter((p) => p.accountsId === id); },
    async getSocialPost(accountId, postId) { return posts.find((p) => p.id === postId && p.accountsId === accountId) ?? null; },
    async getSocialPostByPublicId(publicId) { return posts.find((p) => p.videoPublicId === publicId) ?? null; },
  },
  ai: async (o) => { aiCalls.push({ system: o.system, user: o.user, model: o.model }); return aiAnswer; },
  transcribe: async (audio, _mime, language) => { transcribeCalls.push({ bytes: audio.length, language }); return transcribeAnswer; },
  heygen: () => (heygenOn ? fakeHeygen() : null),
  video: {
    async receive(src, dest) {
      receiveCalls++;
      const chunks: Buffer[] = [];
      for await (const c of src as AsyncIterable<Buffer>) chunks.push(Buffer.from(c));
      mkdirSync(dirname(dest), { recursive: true });
      writeFileSync(dest, Buffer.concat(chunks));
      return { ok: true, durationS: 50, width: 1080, height: 1920, bytes: 8 };
    },
    async inspect(path) { return existsSync(path) ? { ok: true, durationS: 50, width: 1080, height: 1920, bytes: 8 } : null; },
  },
  dmLiveSwitch: () => false,
  notifyAgency: async (n) => { agencyNotes.push({ type: n.type, link: n.link }); },
  notifyAccountManagers: async (accountId, n) => { managerNotes.push({ accountId, key: n.key, link: n.link }); },
};

let base = "";
let server: http.Server;
before(async () => {
  const app = express();
  app.use(express.json({ limit: "20mb" }));
  const limiter = createRateLimiter({ max: 3, windowMs: 60_000 });
  registerStudioRoutes(app, deps, limiter);
  registerScriptRoutes(app, deps, limiter);
  server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(() => new Promise<void>((r) => server.close(() => r())));

let userSeq = 1000;
beforeEach(() => {
  settings = [];
  topics = [];
  scripts = [];
  pulls = [];
  posts = [];
  aiCalls = [];
  aiAnswer = { text: '{"options":["Opção 1 #draugustofronza","Opção 2","Opção 3"]}' };
  transcribeCalls = [];
  transcribeAnswer = { text: " Quero falar sobre sono e fome " };
  agencyNotes = [];
  managerNotes = [];
  heygenVideos = [];
  heygenOn = true;
  receiveCalls = 0;
  rmSync(join(tmp, "social"), { recursive: true, force: true });
});

/** A fresh agency user id per test, so the shared limiter never carries over. */
const freshAgency = () => ({ ...AGENCY, id: ++userSeq });

async function call(method: string, path: string, user: object | null, body?: unknown) {
  const h: Record<string, string> = {};
  if (user) h["x-test-user"] = JSON.stringify(user);
  let payload: string | undefined;
  if (body !== undefined) { payload = JSON.stringify(body); h["content-type"] = "application/json"; }
  const res = await fetch(base + path, { method, headers: h, body: payload });
  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: res.status, json };
}

const P = (id: number, rest = "") => `/api/social/accounts/${id}${rest}`;

// ─── Settings ────────────────────────────────────────────────────────────────

test("settings: agency sees everything, client users only Sobre mim", async () => {
  settings.push({ id: 1, accountsId: A, captionStyle: "STYLE", voiceGuide: "VOICE", aboutMe: "CRM 28148/SC", dmMode: "dry_run", dmHourlyCap: 20, updatedByUserId: null, createdAt: NOW, updatedAt: NOW });
  const ag = await call("GET", P(A, "/settings"), AGENCY);
  assert.equal(ag.status, 200);
  assert.equal(ag.json.captionStyle, "STYLE");
  assert.equal(ag.json.dmMode, "dry_run");
  assert.equal(ag.json.dmLiveSwitch, false);
  const mgr = await call("GET", P(A, "/settings"), MANAGER_A);
  assert.deepEqual(mgr.json, { aboutMe: "CRM 28148/SC" });
  assert.deepEqual((await call("GET", P(A, "/settings"), VIEWER_A)).json, { aboutMe: "CRM 28148/SC" });
});

test("settings: the gate refuses other accounts and Social off", async () => {
  assert.equal((await call("GET", P(A, "/settings"), MANAGER_B)).status, 403);
  const off = await call("GET", P(OFF, "/settings"), MANAGER_OFF);
  assert.equal(off.status, 403);
  assert.equal(off.json.reason, "not_enabled");
  assert.equal((await call("GET", P(404, "/settings"), AGENCY)).status, 404);
  assert.equal((await call("GET", P(A, "/settings"), null)).status, 401);
});

test("settings: only agency writes the style and the DM mode; bad values are 400", async () => {
  assert.equal((await call("PUT", P(A, "/settings"), MANAGER_A, { captionStyle: "x" })).status, 403);
  const ok = await call("PUT", P(A, "/settings"), AGENCY, { captionStyle: "Sober.", voiceGuide: "Então...", dmMode: "dry_run", dmHourlyCap: 10 });
  assert.equal(ok.status, 200);
  assert.equal(settings[0].captionStyle, "Sober.");
  assert.equal(settings[0].dmHourlyCap, 10);
  assert.equal((await call("PUT", P(A, "/settings"), AGENCY, { dmMode: "yolo" })).status, 400);
  assert.equal((await call("PUT", P(A, "/settings"), AGENCY, { dmHourlyCap: 0 })).status, 400);
  assert.equal((await call("PUT", P(A, "/settings"), AGENCY, { captionStyle: "x".repeat(20_001) })).status, 400);
  assert.equal((await call("PUT", P(A, "/settings"), AGENCY, {})).status, 400);
});

test("Sobre mim: a Manager edits it, a Viewer cannot", async () => {
  const r = await call("PUT", P(A, "/settings/about"), MANAGER_A, { aboutMe: "Médico, CRM 28148/SC" });
  assert.equal(r.status, 200);
  assert.equal(r.json.aboutMe, "Médico, CRM 28148/SC");
  assert.equal(r.json.captionStyle, undefined, "a Manager is never shown the style");
  assert.equal((await call("PUT", P(A, "/settings/about"), VIEWER_A, { aboutMe: "x" })).status, 403);
  assert.equal((await call("PUT", P(A, "/settings/about"), MANAGER_A, {})).status, 400);
});

// ─── Caption writer ──────────────────────────────────────────────────────────

test("captions: 3 options from the account's style; the style and Sobre mim reach the prompt", async () => {
  settings.push({ id: 1, accountsId: A, captionStyle: "Feche com: agende sua avaliação (link na bio)", voiceGuide: "", aboutMe: "CRM 28148/SC", dmMode: "off", dmHourlyCap: 20, updatedByUserId: null, createdAt: NOW, updatedAt: NOW });
  const r = await call("POST", P(A, "/captions/suggest"), freshAgency(), { about: "Fome à noite" });
  assert.equal(r.status, 200);
  assert.equal(r.json.options.length, 3);
  assert.match(aiCalls[0].system, /agende sua avaliação/);
  assert.match(aiCalls[0].system, /CRM 28148/);
  assert.match(aiCalls[0].system, /Brazilian Portuguese/);
  assert.match(aiCalls[0].user, /Fome à noite/);
  assert.equal(settings.length, 1, "nothing saved");
  assert.equal(posts.length, 0, "nothing posted");
});

test("captions: from a linked script; another account's script is not found", async () => {
  scripts.push({ id: 1, accountsId: A, title: "Fome", body: "Você em casa...", status: "approved" } as SocialScript, { id: 2, accountsId: B, title: "B", body: "secret", status: "draft" } as SocialScript);
  const r = await call("POST", P(A, "/captions/suggest"), MANAGER_A, { scriptId: 1 });
  assert.equal(r.status, 200);
  assert.match(aiCalls[0].user, /The video's script/);
  assert.match(aiCalls[0].user, /Você em casa/);
  assert.equal((await call("POST", P(A, "/captions/suggest"), freshAgency(), { scriptId: 2 })).status, 404);
});

test("captions: Viewer refused, empty input 422 without a model call, model failure 502", async () => {
  assert.equal((await call("POST", P(A, "/captions/suggest"), VIEWER_A, { about: "x" })).status, 403);
  const empty = await call("POST", P(A, "/captions/suggest"), freshAgency(), { about: "   " });
  assert.equal(empty.status, 422);
  assert.equal(empty.json.reason, "no_input");
  assert.equal(aiCalls.length, 0);
  aiAnswer = { error: "Claude sonnet timed out after 90s" };
  const fail = await call("POST", P(A, "/captions/suggest"), freshAgency(), { about: "x" });
  assert.equal(fail.status, 502);
  assert.equal(fail.json.reason, "ai_failed");
  aiAnswer = { text: "no json here" };
  assert.equal((await call("POST", P(A, "/captions/suggest"), freshAgency(), { about: "x" })).json.reason, "no_options");
});

test("captions: rate limited per user", async () => {
  const u = freshAgency();
  for (let i = 0; i < 3; i++) assert.equal((await call("POST", P(A, "/captions/suggest"), u, { about: "x" })).status, 200);
  const r = await call("POST", P(A, "/captions/suggest"), u, { about: "x" });
  assert.equal(r.status, 429);
  assert.equal(r.json.reason, "rate_limited");
  assert.equal((await call("POST", P(A, "/captions/suggest"), freshAgency(), { about: "x" })).status, 200, "another user is not affected");
});

// ─── Topics ──────────────────────────────────────────────────────────────────

test("topics: a Manager adds one and agency is told; agency's own topic tells nobody", async () => {
  const r = await call("POST", P(A, "/topics"), MANAGER_A, { text: "Sono e fome", source: "voice" });
  assert.equal(r.status, 201);
  assert.equal(r.json.source, "voice");
  assert.equal(agencyNotes.length, 1);
  assert.equal(agencyNotes[0].type, "social_topic_new");
  assert.equal(agencyNotes[0].link, "/platform/social?account=7&section=studio");
  await call("POST", P(A, "/topics"), AGENCY, { text: "Menopausa" });
  assert.equal(agencyNotes.length, 1);
  assert.equal((await call("GET", P(A, "/topics"), VIEWER_A)).json.length, 2);
  assert.equal((await call("POST", P(A, "/topics"), VIEWER_A, { text: "x" })).status, 403);
  assert.equal((await call("POST", P(A, "/topics"), MANAGER_A, { text: "  " })).status, 400);
  assert.equal((await call("PATCH", P(A, "/topics/1"), MANAGER_A, { status: "dismissed" })).status, 403);
  assert.equal((await call("PATCH", P(A, "/topics/1"), AGENCY, { status: "dismissed" })).json.status, "dismissed");
});

test("topics: spoken topic is transcribed in the account's language, saves nothing", async () => {
  const audio = `data:audio/webm;base64,${Buffer.from("fake audio").toString("base64")}`;
  const r = await call("POST", P(A, "/topics/transcribe"), MANAGER_A, { audio_data: audio, mime_type: "audio/webm" });
  assert.equal(r.status, 200);
  assert.equal(r.json.text, "Quero falar sobre sono e fome");
  assert.deepEqual(transcribeCalls, [{ bytes: 10, language: "Portuguese" }]);
  assert.equal(topics.length, 0);
  assert.equal((await call("POST", P(A, "/topics/transcribe"), VIEWER_A, { audio_data: audio })).status, 403);
  assert.equal((await call("POST", P(A, "/topics/transcribe"), MANAGER_A, {})).status, 400);
  transcribeAnswer = { text: "  " };
  assert.equal((await call("POST", P(A, "/topics/transcribe"), MANAGER_A, { audio_data: audio })).json.reason, "no_speech");
  transcribeAnswer = { error: "NO_GROQ_API_KEY" };
  assert.equal((await call("POST", P(A, "/topics/transcribe"), MANAGER_A, { audio_data: audio })).status, 502);
});

// ─── Scripts ─────────────────────────────────────────────────────────────────

test("scripts: agency creates one from a topic; the topic is marked used; Managers cannot create", async () => {
  topics.push({ id: 1, accountsId: A, text: "Sono", source: "typed", status: "new", scriptId: null, createdByUserId: 21, createdAt: NOW, updatedAt: NOW });
  const r = await call("POST", P(A, "/scripts"), AGENCY, { title: "Sono e fome", topicId: 1 });
  assert.equal(r.status, 201);
  assert.equal(r.json.status, "idea");
  assert.equal(topics[0].status, "used");
  assert.equal(topics[0].scriptId, r.json.id);
  assert.equal((await call("POST", P(A, "/scripts"), AGENCY, { title: "x", topicId: 99 })).status, 404);
  assert.equal((await call("POST", P(A, "/scripts"), MANAGER_A, { title: "x" })).status, 403);
  assert.equal((await call("POST", P(A, "/scripts"), AGENCY, { title: "With body", body: "Então..." })).json.status, "draft");
});

test("scripts: clients see only what was sent to them", async () => {
  scripts.push(
    { id: 1, accountsId: A, title: "Private", body: "x", status: "draft", reviewStatus: "none", postId: null, updatedAt: NOW } as SocialScript,
    { id: 2, accountsId: A, title: "Sent", body: "y", status: "draft", reviewStatus: "waiting", postId: null, updatedAt: NOW } as SocialScript,
  );
  assert.equal((await call("GET", P(A, "/scripts"), AGENCY)).json.length, 2);
  const mine = (await call("GET", P(A, "/scripts"), MANAGER_A)).json;
  assert.deepEqual(mine.map((s: any) => s.title), ["Sent"]);
  assert.equal((await call("POST", P(A, "/scripts/1/review"), MANAGER_A, { decision: "ok" })).status, 404, "an unsent script is invisible to the Manager");
});

test("scripts: AI draft uses the voice guide as the system prompt and avoids earlier closes", async () => {
  settings.push({ id: 1, accountsId: A, captionStyle: "", voiceGuide: "VOICE GUIDE: Então é o conector", aboutMe: "", dmMode: "off", dmHourlyCap: 20, updatedByUserId: null, createdAt: NOW, updatedAt: NOW });
  scripts.push(
    { id: 1, accountsId: A, title: "Menopausa", body: "", status: "idea", reviewStatus: "none", postId: null, updatedAt: NOW } as SocialScript,
    { id: 2, accountsId: A, title: "Old", body: "Texto\nEntão, se precisar de ajuda, é só entrar em contato.", status: "approved", reviewStatus: "none", postId: null, updatedAt: NOW } as SocialScript,
  );
  aiAnswer = { text: JSON.stringify({ title: "Menopausa", body: "Você em casa que está na menopausa..." }) };
  const r = await call("POST", P(A, "/scripts/1/draft"), freshAgency(), { notes: "mais curto" });
  assert.equal(r.status, 200);
  assert.equal(r.json.status, "draft");
  assert.match(r.json.body, /menopausa/);
  assert.match(aiCalls[0].system, /^VOICE GUIDE/);
  assert.equal(aiCalls[0].model, "opus");
  assert.match(aiCalls[0].user, /é só entrar em contato/);
  assert.match(aiCalls[0].user, /mais curto/);
  assert.equal((await call("POST", P(A, "/scripts/1/draft"), MANAGER_A)).status, 403);
  aiAnswer = { error: "x" };
  assert.equal((await call("POST", P(A, "/scripts/1/draft"), freshAgency())).json.reason, "ai_failed");
});

test("scripts: send for review, the Manager's answer, and an edit afterwards resets it", async () => {
  scripts.push({ id: 1, accountsId: A, title: "Fome", body: "Texto", status: "draft", reviewStatus: "none", reviewNote: null, postId: null, updatedAt: NOW } as SocialScript);
  assert.equal((await call("POST", P(A, "/scripts/1/review"), AGENCY, { decision: "ok" })).status, 409, "not sent yet");
  const sent = await call("POST", P(A, "/scripts/1/send-for-review"), AGENCY);
  assert.equal(sent.json.reviewStatus, "waiting");
  assert.deepEqual(managerNotes, [{ accountId: A, key: "script_review", link: "/platform/social?account=7&section=home" }]);
  assert.equal((await call("POST", P(A, "/scripts/1/review"), VIEWER_A, { decision: "ok" })).status, 403);
  assert.equal((await call("POST", P(A, "/scripts/1/review"), MANAGER_A, { decision: "changes" })).status, 400, "changes need a note");
  const ok = await call("POST", P(A, "/scripts/1/review"), MANAGER_A, { decision: "ok" });
  assert.equal(ok.json.reviewStatus, "ok");
  assert.equal(ok.json.status, "approved");
  assert.equal(agencyNotes.at(-1)?.type, "social_script_review");
  const edited = await call("PATCH", P(A, "/scripts/1"), AGENCY, { body: "Texto novo" });
  assert.equal(edited.json.reviewStatus, "none", "he said yes to the old text");
  assert.equal((await call("PATCH", P(A, "/scripts/1"), AGENCY, { status: "published" })).status, 400, "published follows the post");
  assert.equal((await call("PATCH", P(A, "/scripts/1"), MANAGER_A, { body: "hack" })).status, 403);
  scripts[0].body = "";
  assert.equal((await call("POST", P(A, "/scripts/1/send-for-review"), AGENCY)).json.reason, "empty_script");
});

test("scripts: attach an uploaded video; a missing or used upload is refused", async () => {
  scripts.push({ id: 1, accountsId: A, title: "Fome", body: "x", status: "approved", reviewStatus: "none", postId: null, updatedAt: NOW } as SocialScript);
  assert.equal((await call("POST", P(A, "/scripts/1/video"), AGENCY, { uploadId: UP1 })).json.reason, "upload_missing");
  const p = join(tmp, "social", String(A), `${UP1}.mp4`);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, "x");
  const r = await call("POST", P(A, "/scripts/1/video"), AGENCY, { uploadId: UP1 });
  assert.equal(r.json.status, "video_ready");
  assert.equal(r.json.videoUploadId, UP1);
  posts.push({ id: 5, accountsId: A, videoPublicId: UP1, status: "scheduled", scheduledAt: NOW, permalink: null } as SocialPost);
  assert.equal((await call("POST", P(A, "/scripts/1/video"), AGENCY, { uploadId: UP1 })).json.reason, "upload_used");
  assert.equal((await call("POST", P(A, "/scripts/1/video"), AGENCY, { uploadId: "../../etc" })).status, 400);
});

test("scripts: link the post; the script then shows the post's state", async () => {
  scripts.push({ id: 1, accountsId: A, title: "Fome", body: "x", status: "video_ready", videoUploadId: UP1, reviewStatus: "none", postId: null, updatedAt: NOW } as SocialScript);
  posts.push({ id: 5, accountsId: A, videoPublicId: UP1, status: "published", scheduledAt: NOW, permalink: "https://ig/p/1" } as SocialPost, { id: 6, accountsId: B, status: "scheduled", scheduledAt: NOW } as SocialPost);
  assert.equal((await call("POST", P(A, "/scripts/1/link-post"), AGENCY, { postId: 6 })).status, 404, "another account's post");
  const r = await call("POST", P(A, "/scripts/1/link-post"), AGENCY, { postId: 5 });
  assert.equal(r.json.status, "published");
  assert.equal(r.json.post.permalink, "https://ig/p/1");
  assert.equal(r.json.videoUploadId, null, "the video belongs to the post now");
});

// ─── HeyGen ──────────────────────────────────────────────────────────────────

const vid = (id: string, status = "completed"): HeygenVideo => ({ id, title: `Video ${id}`, status, durationS: 55, createdAt: NOW.toISOString(), thumbnailUrl: "https://t/x.jpg", videoPageUrl: null, videoUrl: `https://files/${id}.mp4?sig=secret` });

test("HeyGen list: agency only, never the presigned link, marks used and unfinished videos", async () => {
  heygenVideos = [vid("v1"), vid("v2", "processing")];
  pulls.push({ id: 1, accountsId: A, heygenVideoId: "v1", scriptId: 3, uploadId: UP1, pulledByUserId: 1, pulledAt: NOW });
  const r = await call("GET", P(A, "/heygen/videos"), AGENCY);
  assert.equal(r.json.configured, true);
  assert.equal(r.json.nextToken, "next1");
  assert.equal(JSON.stringify(r.json).includes("sig=secret"), false);
  assert.deepEqual(r.json.videos.map((v: any) => [v.id, v.selectable, v.alreadyUsed, v.usedByScriptId]), [["v1", true, true, 3], ["v2", false, false, null]]);
  assert.equal((await call("GET", P(A, "/heygen/videos"), MANAGER_A)).status, 403);
  heygenOn = false;
  assert.deepEqual((await call("GET", P(A, "/heygen/videos"), AGENCY)).json, { configured: false, videos: [], nextToken: null });
});

test("HeyGen pull: downloads into the upload layout once, then refuses the same video", async () => {
  heygenVideos = [vid("v1"), vid("v2", "processing")];
  scripts.push({ id: 1, accountsId: A, title: "Fome", body: "x", status: "approved", reviewStatus: "none", postId: null, updatedAt: NOW } as SocialScript);
  const r = await call("POST", P(A, "/scripts/1/heygen"), AGENCY, { videoId: "v1" });
  assert.equal(r.status, 200);
  assert.equal(r.json.script.status, "video_ready");
  assert.equal(r.json.script.heygenVideoId, "v1");
  const uploadId = r.json.upload.uploadId;
  assert.match(uploadId, /^[0-9a-f-]{36}$/);
  assert.ok(existsSync(join(tmp, "social", String(A), `${uploadId}.mp4`)));
  assert.equal(pulls.length, 1);
  assert.equal((await call("POST", P(A, "/scripts/1/heygen"), AGENCY, { videoId: "v1" })).json.reason, "already_used");
  assert.equal((await call("POST", P(A, "/scripts/1/heygen"), AGENCY, { videoId: "v2" })).json.reason, "not_ready");
  assert.equal((await call("POST", P(A, "/scripts/1/heygen"), AGENCY, { videoId: "nope" })).status, 404);
  assert.equal((await call("POST", P(A, "/scripts/1/heygen"), AGENCY, { videoId: "../x" })).status, 400);
  assert.equal((await call("POST", P(A, "/scripts/1/heygen"), MANAGER_A, { videoId: "v1" })).status, 403);
  assert.equal(receiveCalls, 1);
  heygenOn = false;
  assert.equal((await call("POST", P(A, "/scripts/1/heygen"), AGENCY, { videoId: "v3" })).status, 501);
});
