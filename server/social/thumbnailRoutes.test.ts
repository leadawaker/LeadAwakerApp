// HTTP tests for the thumbnail creator routes. No database, no image model, no ffmpeg: every
// dependency is an in-memory fake.
import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import express from "express";
import type { SocialPost, SocialScript, SocialThumbnail, SocialThumbnailRef, SocialThumbnailStyle } from "@shared/schema";
import { createRateLimiter } from "./rateLimit";
import type { ImageRequest } from "./thumbnailImage";
import { registerThumbnailRoutes, type ThumbnailDeps } from "./thumbnailRoutes";

const tmp = mkdtempSync(join(tmpdir(), "social-thumbs-"));
after(() => rmSync(tmp, { recursive: true, force: true }));

const A = 7, B = 8;
const AGENCY = { id: 1, role: "Owner", accountsId: 1 };
const MANAGER_A = { id: 21, role: "Manager", accountsId: A };
const VIEWER_A = { id: 22, role: "Viewer", accountsId: A };
const NOW = new Date("2026-10-24T12:00:00Z");
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from("rest-of-png")]);
const PNG_DATA_URL = `data:image/png;base64,${PNG.toString("base64")}`;

let refs: SocialThumbnailRef[];
let styles: SocialThumbnailStyle[];
let thumbs: SocialThumbnail[];
let scripts: SocialScript[];
let posts: SocialPost[];
let imageCalls: ImageRequest[];
let imageAnswer: () => Promise<{ images: Buffer[]; model: string }>;
let imagesOn: boolean;
let seq: number;

const row = <T>(over: Partial<T>, defaults: Partial<T>) => ({ ...defaults, ...over }) as T;

const deps: ThumbnailDeps = {
  requireAuth: (req, res, next) => {
    const raw = req.headers["x-test-user"];
    if (typeof raw !== "string") return res.status(401).json({ message: "Unauthorized" });
    (req as any).user = JSON.parse(raw);
    next();
  },
  now: () => NOW,
  dir: join(tmp, "thumbs"),
  store: {
    async getAccount(id) {
      return id === A || id === B ? { timezone: "Europe/Amsterdam", language: "Dutch", socialEnabled: true } : null;
    },
    async getSocialSettings(id) { return id === A ? ({ aboutMe: "Fitness coach in Lisbon" } as any) : null; },
    async getSocialScript(accountId, id) { return scripts.find((s) => s.accountsId === accountId && s.id === id) ?? null; },
    async getSocialPost(accountId, id) { return posts.find((p) => p.accountsId === accountId && p.id === id) ?? null; },
    async listThumbnailRefs(id) { return refs.filter((r) => r.accountsId === id).reverse(); },
    async getThumbnailRef(accountId, id) { return refs.find((r) => r.accountsId === accountId && r.id === id) ?? null; },
    async insertThumbnailRef(r) { const x = row<SocialThumbnailRef>(r as any, { id: ++seq, createdAt: NOW }); refs.push(x); return x; },
    async deleteThumbnailRef(accountId, id) {
      const x = refs.find((r) => r.accountsId === accountId && r.id === id);
      refs = refs.filter((r) => r !== x);
      return x ?? null;
    },
    async listThumbnailStyles(id) { return styles.filter((s) => s.accountsId === id); },
    async insertThumbnailStyle(r) { const x = row<SocialThumbnailStyle>(r as any, { id: ++seq, createdAt: NOW, updatedAt: NOW }); styles.push(x); return x; },
    async updateThumbnailStyle(accountId, id, fields) { const x = styles.find((s) => s.accountsId === accountId && s.id === id); if (!x) return null; Object.assign(x, fields); return x; },
    async deleteThumbnailStyle(accountId, id) { const before = styles.length; styles = styles.filter((s) => !(s.accountsId === accountId && s.id === id)); return styles.length < before; },
    async listThumbnails(id) { return thumbs.filter((t) => t.accountsId === id); },
    async getThumbnail(accountId, id) { return thumbs.find((t) => t.accountsId === accountId && t.id === id) ?? null; },
    async insertThumbnails(rows) {
      const made = rows.map((r) => row<SocialThumbnail>(r as any, { id: ++seq, error: null, filePath: null, model: null, starred: false, createdAt: NOW, updatedAt: NOW }));
      thumbs.push(...made);
      return made.map((m) => ({ ...m }));
    },
    async updateThumbnails(ids, fields) { for (const t of thumbs) if (ids.includes(t.id)) Object.assign(t, fields); },
    async setThumbnailStarred(accountId, id, starred) { const x = thumbs.find((t) => t.accountsId === accountId && t.id === id); if (!x) return null; x.starred = starred; return x; },
    async deleteThumbnail(accountId, id) {
      const x = thumbs.find((t) => t.accountsId === accountId && t.id === id);
      thumbs = thumbs.filter((t) => t !== x);
      return x ?? null;
    },
  },
  images: () => (imagesOn ? { generate: async (req) => { imageCalls.push(req); return imageAnswer(); } } : null),
  files: {
    read: async (path) => readFileSync(path),
    write: async (path, data) => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, data); },
    remove: (path) => rm(path, { force: true }),
    writeJpeg: async (image, plan, dest) => { mkdirSync(dirname(dest), { recursive: true }); writeFileSync(dest, Buffer.concat([Buffer.from(`${plan.out.width}x${plan.out.height}:`), image])); },
  },
};

let base = "";
let server: http.Server;
let routes: { idle(): Promise<void> };
before(async () => {
  const app = express();
  app.use(express.json({ limit: "20mb" }));
  routes = registerThumbnailRoutes(app, deps, createRateLimiter({ max: 50, windowMs: 60_000 }));
  server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(() => new Promise<void>((r) => server.close(() => r())));

beforeEach(() => {
  refs = [];
  styles = [];
  thumbs = [];
  scripts = [];
  posts = [];
  imageCalls = [];
  imageAnswer = async () => ({ images: [Buffer.from("img1"), Buffer.from("img2"), Buffer.from("img3")], model: "gpt-image-test" });
  imagesOn = true;
  seq = 100;
});

async function call(method: string, path: string, user: object | null, body?: unknown) {
  const headers: Record<string, string> = {};
  if (user) headers["x-test-user"] = JSON.stringify(user);
  if (body !== undefined) headers["content-type"] = "application/json";
  const res = await fetch(`${base}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { /* not JSON */ }
  return { status: res.status, json, text };
}

const addRef = (kind: string, label = "") => call("POST", `/api/social/accounts/${A}/thumbnail-refs`, AGENCY, { kind, label, data: PNG_DATA_URL });

test("config says whether an image model is on, and who may create", async () => {
  assert.deepEqual((await call("GET", `/api/social/accounts/${A}/thumbnails/config`, VIEWER_A)).json, { configured: true, canCreate: false });
  imagesOn = false;
  assert.deepEqual((await call("GET", `/api/social/accounts/${A}/thumbnails/config`, MANAGER_A)).json, { configured: false, canCreate: true });
});

test("references: upload sniffs the type, lists, serves and deletes the file", async () => {
  const up = await addRef("person", "Mia");
  assert.equal(up.status, 201);
  assert.equal(up.json.kind, "person");
  assert.equal(up.json.label, "Mia");
  assert.match(up.json.imageUrl, new RegExp(`/api/social/accounts/${A}/thumbnail-refs/\\d+/image$`));
  const stored = refs[0];
  assert.ok(existsSync(stored.filePath));
  assert.equal(stored.mimeType, "image/png");

  const img = await fetch(`${base}${up.json.imageUrl}`, { headers: { "x-test-user": JSON.stringify(VIEWER_A) } });
  assert.equal(img.status, 200);
  assert.equal(img.headers.get("content-type"), "image/png");

  assert.equal((await call("DELETE", `/api/social/accounts/${A}/thumbnail-refs/${stored.id}`, MANAGER_A)).status, 200);
  assert.equal(refs.length, 0);
  assert.ok(!existsSync(stored.filePath));
});

test("references: not an image, a viewer, or another account are refused", async () => {
  const bad = await call("POST", `/api/social/accounts/${A}/thumbnail-refs`, AGENCY, { kind: "person", data: "data:image/png;base64,aGVsbG8=" });
  assert.equal(bad.status, 415);
  assert.equal(bad.json.reason, "bad_image");
  assert.equal((await call("POST", `/api/social/accounts/${A}/thumbnail-refs`, AGENCY, { kind: "face", data: PNG_DATA_URL })).status, 400);
  assert.equal((await call("POST", `/api/social/accounts/${A}/thumbnail-refs`, VIEWER_A, { kind: "person", data: PNG_DATA_URL })).status, 403);
  assert.equal((await call("POST", `/api/social/accounts/${B}/thumbnail-refs`, MANAGER_A, { kind: "person", data: PNG_DATA_URL })).status, 403);
});

test("generate: answers 202 with generating rows, then fills them as JPEGs in the format", async () => {
  const res = await call("POST", `/api/social/accounts/${A}/thumbnails`, MANAGER_A, { kind: "title", title: "3 mistakes", variants: 2 });
  assert.equal(res.status, 202);
  assert.equal(res.json.length, 2);
  assert.ok(res.json.every((t: any) => t.status === "generating" && t.format === "portrait" && t.imageUrl === null));
  assert.equal(res.json[0].batchId, res.json[1].batchId);
  await routes.idle();

  assert.equal(imageCalls.length, 1);
  assert.equal(imageCalls[0].n, 2);
  assert.equal(imageCalls[0].size, "1024x1536");
  assert.equal(imageCalls[0].references.length, 0);
  assert.match(imageCalls[0].prompt, /"3 mistakes"/);
  assert.match(imageCalls[0].prompt, /Fitness coach in Lisbon/);

  const list = await call("GET", `/api/social/accounts/${A}/thumbnails`, VIEWER_A);
  assert.ok(list.json.every((t: any) => t.status === "ready" && t.imageUrl));
  const img = await fetch(`${base}${list.json[0].imageUrl}?download=1`, { headers: { "x-test-user": JSON.stringify(VIEWER_A) } });
  assert.equal(img.headers.get("content-type"), "image/jpeg");
  assert.match(img.headers.get("content-disposition") ?? "", /attachment; filename="thumbnail-\d+\.jpg"/);
  assert.match(await img.text(), /^1080x1440:img/);
});

test("generate: picked references go along, a presenter cover adds the account's person photos", async () => {
  const mia = (await addRef("person", "Mia")).json;
  const look = (await addRef("style", "bold yellow")).json;
  const res = await call("POST", `/api/social/accounts/${A}/thumbnails`, AGENCY, { kind: "presenter", title: "Hi", refIds: [look.id], format: "post" });
  assert.equal(res.status, 202);
  await routes.idle();
  assert.equal(imageCalls[0].references.length, 2);
  assert.equal(imageCalls[0].size, "1024x1536");
  assert.deepEqual(thumbs[0].refIds, [mia.id, look.id]);
  assert.match(imageCalls[0].prompt, /image 1 is a photo of the person to feature \(Mia\); image 2 is a style example/);
});

test("generate: presenter without any person photo, title without a title, unknown refs", async () => {
  assert.equal((await call("POST", `/api/social/accounts/${A}/thumbnails`, AGENCY, { kind: "presenter" })).json.reason, "no_person");
  assert.equal((await call("POST", `/api/social/accounts/${A}/thumbnails`, AGENCY, { kind: "title" })).json.reason, "no_title");
  assert.equal((await call("POST", `/api/social/accounts/${A}/thumbnails`, AGENCY, { kind: "auto", refIds: [999] })).json.reason, "ref_missing");
  assert.equal((await call("POST", `/api/social/accounts/${A}/thumbnails`, AGENCY, { kind: "auto", variants: 4 })).status, 400);
  assert.equal((await call("POST", `/api/social/accounts/${A}/thumbnails`, VIEWER_A, { kind: "auto" })).status, 403);
  assert.equal(thumbs.length, 0);
});

test("generate: without an image model the answer is 501 not_configured", async () => {
  imagesOn = false;
  const res = await call("POST", `/api/social/accounts/${A}/thumbnails`, AGENCY, { kind: "auto" });
  assert.equal(res.status, 501);
  assert.equal(res.json.reason, "not_configured");
});

test("generate: from a script takes its title and body; a client only reaches scripts sent to them", async () => {
  scripts.push({ id: 5, accountsId: A, title: "Why you plateau", body: "Most people stop progressing because...", reviewStatus: "none" } as SocialScript);
  assert.equal((await call("POST", `/api/social/accounts/${A}/thumbnails`, MANAGER_A, { kind: "auto", scriptId: 5 })).json.reason, "script_missing");
  const res = await call("POST", `/api/social/accounts/${A}/thumbnails`, AGENCY, { kind: "auto", scriptId: 5 });
  assert.equal(res.status, 202);
  assert.equal(res.json[0].title, "Why you plateau");
  await routes.idle();
  assert.match(imageCalls[0].prompt, /Most people stop progressing/);
});

test("generate: a model error marks every row failed with the reason", async () => {
  imageAnswer = async () => { throw new Error("image API 400: content policy"); };
  await call("POST", `/api/social/accounts/${A}/thumbnails`, AGENCY, { kind: "auto", variants: 2 });
  await routes.idle();
  const list = (await call("GET", `/api/social/accounts/${A}/thumbnails`, AGENCY)).json;
  assert.ok(list.every((t: any) => t.status === "failed" && t.error === "image API 400: content policy"));
});

test("generate: fewer images than variants fails only the missing ones", async () => {
  imageAnswer = async () => ({ images: [Buffer.from("only")], model: "m" });
  await call("POST", `/api/social/accounts/${A}/thumbnails`, AGENCY, { kind: "auto", variants: 2 });
  await routes.idle();
  assert.deepEqual(thumbs.map((t) => t.status), ["ready", "failed"]);
});

test("star and delete; delete removes the file; viewers cannot", async () => {
  await call("POST", `/api/social/accounts/${A}/thumbnails`, AGENCY, { kind: "auto" });
  await routes.idle();
  const id = thumbs[0].id;
  assert.equal((await call("PATCH", `/api/social/accounts/${A}/thumbnails/${id}`, VIEWER_A, { starred: true })).status, 403);
  assert.equal((await call("PATCH", `/api/social/accounts/${A}/thumbnails/${id}`, MANAGER_A, { starred: true })).json.starred, true);
  const file = thumbs[0].filePath!;
  assert.ok(existsSync(file));
  assert.equal((await call("DELETE", `/api/social/accounts/${A}/thumbnails/${id}`, MANAGER_A)).status, 200);
  assert.ok(!existsSync(file));
  assert.equal((await call("DELETE", `/api/social/accounts/${A}/thumbnails/${id}`, MANAGER_A)).status, 404);
});

test("styles: create, list (deleted refs dropped), update, delete", async () => {
  const mia = (await addRef("person", "Mia")).json;
  const made = await call("POST", `/api/social/accounts/${A}/thumbnail-styles`, MANAGER_A, { name: "Mia cover", kind: "presenter", prompt: "warm light", refIds: [mia.id] });
  assert.equal(made.status, 201);
  assert.deepEqual({ ...made.json, id: 0 }, { id: 0, name: "Mia cover", kind: "presenter", prompt: "warm light", format: "portrait", refIds: [mia.id] });
  assert.equal((await call("POST", `/api/social/accounts/${A}/thumbnail-styles`, MANAGER_A, { name: "x", kind: "auto", refIds: [999] })).json.reason, "ref_missing");

  await call("DELETE", `/api/social/accounts/${A}/thumbnail-refs/${mia.id}`, MANAGER_A);
  assert.deepEqual((await call("GET", `/api/social/accounts/${A}/thumbnail-styles`, VIEWER_A)).json[0].refIds, []);

  const put = await call("PUT", `/api/social/accounts/${A}/thumbnail-styles/${made.json.id}`, MANAGER_A, { name: "Title card", kind: "title", format: "square" });
  assert.equal(put.json.name, "Title card");
  assert.equal(put.json.format, "square");
  assert.equal((await call("DELETE", `/api/social/accounts/${A}/thumbnail-styles/${made.json.id}`, VIEWER_A)).status, 403);
  assert.equal((await call("DELETE", `/api/social/accounts/${A}/thumbnail-styles/${made.json.id}`, MANAGER_A)).status, 200);
  assert.equal(styles.length, 0);
});

test("a row stuck generating for longer than 15 minutes shows as failed", async () => {
  thumbs.push({ id: 1, accountsId: A, batchId: "b", status: "generating", createdAt: new Date(NOW.getTime() - 16 * 60_000), refIds: [] } as unknown as SocialThumbnail);
  const [t] = (await call("GET", `/api/social/accounts/${A}/thumbnails`, AGENCY)).json;
  assert.equal(t.status, "failed");
  assert.equal(t.error, "timed_out");
});
