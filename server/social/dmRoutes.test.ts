import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";
import type { SocialDmLogRow, SocialDmRule, SocialPost, SocialSettings } from "@shared/schema";
import { registerDmRoutes, type DmRouteDeps } from "./dmRoutes";

const A = 7, B = 8;
const AGENCY = { id: 1, role: "Owner", accountsId: 1 };
const MANAGER_A = { id: 21, role: "Manager", accountsId: A };
const NOW = new Date("2026-10-20T12:00:00Z");

let rules: SocialDmRule[];
let posts: SocialPost[];
let settings: SocialSettings | null;
let env: NodeJS.ProcessEnv;
let logs: SocialDmLogRow[];

const deps: DmRouteDeps = {
  requireAuth: (req, res, next) => {
    const raw = req.headers["x-test-user"];
    if (typeof raw !== "string") return res.status(401).end();
    (req as any).user = JSON.parse(raw);
    next();
  },
  now: () => NOW,
  env: () => env,
  webhookReady: () => true,
  store: {
    async getAccount(id) { return id === A || id === B ? { timezone: "America/Sao_Paulo", language: "Portuguese", socialEnabled: true } : null; },
    async getSocialSettings() { return settings; },
    async listDmRules(id) { return rules.filter((r) => r.accountsId === id); },
    async insertDmRule(row) { const r = { id: rules.length + 1, createdAt: NOW, updatedAt: NOW, ...row } as SocialDmRule; rules.push(r); return r; },
    async updateDmRule(accountId, id, fields) { const r = rules.find((x) => x.id === id && x.accountsId === accountId); if (!r) return null; Object.assign(r, fields); return r; },
    async deleteDmRule(accountId, id) { const n = rules.length; rules = rules.filter((x) => !(x.id === id && x.accountsId === accountId)); return rules.length < n; },
    async listDmLog(id, limit) { return logs.filter((l) => l.accountsId === id).slice(0, limit); },
    async countDmSentSince() { return 3; },
    async listSocialPosts(id) { return posts.filter((p) => p.accountsId === id); },
    async getSocialPost(accountId, postId) { return posts.find((p) => p.id === postId && p.accountsId === accountId) ?? null; },
  },
};

let base = "";
let server: http.Server;
before(async () => {
  const app = express();
  app.use(express.json());
  registerDmRoutes(app, deps);
  server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(() => new Promise<void>((r) => server.close(() => r())));
beforeEach(() => {
  rules = [];
  posts = [
    { id: 1, accountsId: A, status: "published", igMediaId: "m1", caption: "Fome à noite\nmais", scheduledAt: NOW, publishedAt: NOW, permalink: "https://ig/p/1" } as SocialPost,
    { id: 2, accountsId: A, status: "scheduled", igMediaId: null, caption: "Soon", scheduledAt: NOW, publishedAt: null, permalink: null } as SocialPost,
    { id: 3, accountsId: B, status: "published", igMediaId: "mB", caption: "B", scheduledAt: NOW, publishedAt: NOW, permalink: null } as SocialPost,
  ];
  settings = null;
  env = {};
  logs = [];
});

async function call(method: string, path: string, user: object | null, body?: unknown) {
  const h: Record<string, string> = {};
  if (user) h["x-test-user"] = JSON.stringify(user);
  if (body !== undefined) h["content-type"] = "application/json";
  const res = await fetch(base + path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: res.status, json };
}

const P = (rest: string, id = A) => `/api/social/accounts/${id}${rest}`;

test("status: off by default; live needs the server switch too; only published posts are offered", async () => {
  const r = await call("GET", P("/dm"), AGENCY);
  assert.equal(r.status, 200);
  assert.deepEqual([r.json.mode, r.json.effectiveMode, r.json.liveSwitch, r.json.hourlyCap, r.json.sentLastHour], ["off", "off", false, 20, 3]);
  assert.deepEqual(r.json.posts.map((p: any) => [p.id, p.caption]), [[1, "Fome à noite"]]);
  settings = { dmMode: "live", dmHourlyCap: 5 } as SocialSettings;
  assert.equal((await call("GET", P("/dm"), AGENCY)).json.effectiveMode, "dry_run");
  env = { INSTAGRAM_DM_LIVE: "1" };
  assert.equal((await call("GET", P("/dm"), AGENCY)).json.effectiveMode, "live");
});

test("agency only, every route", async () => {
  for (const [m, p, b] of [["GET", "/dm"], ["POST", "/dm/rules", { keyword: "GUIA", firstMessage: "x" }], ["PATCH", "/dm/rules/1", { active: false }], ["DELETE", "/dm/rules/1"], ["GET", "/dm/log"]] as const) {
    assert.equal((await call(m, P(p), MANAGER_A, b)).status, 403, `${m} ${p}`);
  }
});

test("rules: create for all posts or a published post; bad keyword, message or post refused", async () => {
  const all = await call("POST", P("/dm/rules"), AGENCY, { keyword: " Guia! ", firstMessage: "Oi {username}!" });
  assert.equal(all.status, 201);
  assert.equal(all.json.keyword, "Guia!");
  assert.equal(rules[0].keywordNorm, "GUIA");
  assert.equal(rules[0].igMediaId, null);
  const one = await call("POST", P("/dm/rules"), AGENCY, { keyword: "FOME", firstMessage: "x", postId: 1, aiFollowUp: true });
  assert.equal(rules[1].igMediaId, "m1");
  assert.equal(one.json.aiFollowUp, true);
  assert.equal((await call("POST", P("/dm/rules"), AGENCY, { keyword: "X", firstMessage: "x", postId: 2 })).json.reason, "post_not_published");
  assert.equal((await call("POST", P("/dm/rules"), AGENCY, { keyword: "X", firstMessage: "x", postId: 3 })).json.reason, "post_not_published", "another account's post");
  assert.equal((await call("POST", P("/dm/rules"), AGENCY, { keyword: "!!!", firstMessage: "x" })).status, 400);
  assert.equal((await call("POST", P("/dm/rules"), AGENCY, { keyword: "A".repeat(31), firstMessage: "x" })).status, 400);
  assert.equal((await call("POST", P("/dm/rules"), AGENCY, { keyword: "OK", firstMessage: "  " })).status, 400);
});

test("rules: edit, pause, move to all posts, delete; another account's rule is not found", async () => {
  await call("POST", P("/dm/rules"), AGENCY, { keyword: "FOME", firstMessage: "x", postId: 1 });
  const paused = await call("PATCH", P("/dm/rules/1"), AGENCY, { active: false, keyword: "Sono" });
  assert.equal(paused.json.active, false);
  assert.equal(rules[0].keywordNorm, "SONO");
  await call("PATCH", P("/dm/rules/1"), AGENCY, { postId: null });
  assert.equal(rules[0].igMediaId, null);
  assert.equal((await call("PATCH", P("/dm/rules/1", B), AGENCY, { active: true })).status, 404);
  assert.equal((await call("DELETE", P("/dm/rules/1"), AGENCY)).status, 200);
  assert.equal(rules.length, 0);
});

test("log: newest rows, limited", async () => {
  logs = Array.from({ length: 5 }, (_, i) => ({ id: i + 1, accountsId: A, kind: "private_reply", mode: "dry_run", status: "would_send", reason: null, text: "Oi", username: "maria", ruleId: 1, leadId: null, createdAt: NOW } as SocialDmLogRow));
  const r = await call("GET", P("/dm/log?limit=2"), AGENCY);
  assert.equal(r.json.length, 2);
  assert.equal(r.json[0].status, "would_send");
});
