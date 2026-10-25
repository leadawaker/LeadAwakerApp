// Cover title helper: the prompt, the parsing of the model's answer and the HTTP route over a fake model.
import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";
import type { SocialPost, SocialScript } from "@shared/schema";
import { createRateLimiter } from "./rateLimit";
import type { AiComplete } from "./captions";
import { registerThumbnailTitleRoutes, type TitleDeps } from "./thumbnailTitleRoutes";
import { buildTitlePrompt, parseTitleOptions } from "./thumbnailTitles";

const options = (...o: unknown[]) => JSON.stringify({ options: o });

test("parse: trims, drops quotes, dashes, full stops, duplicates and long ones", () => {
  const long = "x".repeat(41);
  const out = parseTitleOptions(options('"3 mistakes"', "3 mistakes", " Stop scrolling. ", "Rest — or burnout?", long, "", 7, "Five"));
  assert.deepEqual(out, ["3 mistakes", "Stop scrolling", "Rest: or burnout?", "Five"]);
});

test("parse: titles already offered are not offered again; at most 5; junk gives none", () => {
  assert.deepEqual(parseTitleOptions(options("One", "Two", "Three"), ["one"]), ["Two", "Three"]);
  assert.equal(parseTitleOptions(options("a", "b", "c", "d", "e", "f", "g")).length, 5);
  assert.deepEqual(parseTitleOptions("not json"), []);
  assert.deepEqual(parseTitleOptions(JSON.stringify({ options: "x" })), []);
});

test("prompt: language, script, hint and the titles to avoid", () => {
  const { system, user } = buildTitlePrompt({
    context: { kind: "script", text: "Stretch every morning." },
    hint: "something about mornings",
    aboutMe: "Physio in Lisbon",
    language: "Portuguese",
    avoid: ["Morning magic"],
  });
  assert.match(system, /Brazilian Portuguese/);
  assert.match(system, /Physio in Lisbon/);
  assert.match(system, /exactly 5/);
  assert.match(user, /Stretch every morning\./);
  assert.match(user, /something about mornings/);
  assert.match(user, /- Morning magic/);
});

const A = 7;
const AGENCY = { id: 1, role: "Owner", accountsId: 1 };
const MANAGER_A = { id: 21, role: "Manager", accountsId: A };
const VIEWER_A = { id: 22, role: "Viewer", accountsId: A };
const MANAGER_B = { id: 31, role: "Manager", accountsId: 8 };

let scripts: SocialScript[];
let posts: SocialPost[];
let aiCalls: Array<{ system: string; user: string }>;
let aiAnswer: () => Promise<{ text: string } | { error: string }>;

const deps: TitleDeps = {
  requireAuth: (req, res, next) => {
    const raw = req.headers["x-test-user"];
    if (typeof raw !== "string") return res.status(401).json({ message: "Unauthorized" });
    (req as any).user = JSON.parse(raw);
    next();
  },
  now: () => new Date("2026-10-25T12:00:00Z"),
  store: {
    async getAccount(id) { return id === A || id === 8 ? { timezone: "Europe/Amsterdam", language: "Dutch", socialEnabled: true } : null; },
    async getSocialSettings(id) { return id === A ? ({ aboutMe: "Fitness coach" } as any) : null; },
    async getSocialScript(accountId, id) { return scripts.find((s) => s.accountsId === accountId && s.id === id) ?? null; },
    async getSocialPost(accountId, id) { return posts.find((p) => p.accountsId === accountId && p.id === id) ?? null; },
  },
  ai: async (opts) => { aiCalls.push({ system: opts.system, user: opts.user }); return aiAnswer(); },
};

let base = "";
let server: http.Server;
before(async () => {
  const app = express();
  app.use(express.json());
  registerThumbnailTitleRoutes(app, deps, createRateLimiter({ max: 50, windowMs: 60_000 }));
  server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(() => new Promise<void>((r) => server.close(() => r())));

beforeEach(() => {
  scripts = [{ id: 1, accountsId: A, title: "Morning stretch", body: "Stretch every morning.", reviewStatus: "none" } as any];
  posts = [{ id: 5, accountsId: A, caption: "New week, new habits" } as any];
  aiCalls = [];
  aiAnswer = async () => ({ text: options("Stretch first", "Why mornings win", "Start here", "Two minutes a day", "Don't skip this") });
});

async function post(user: object | null, accountId: number, body: object) {
  const res = await fetch(`${base}/api/social/accounts/${accountId}/thumbnail-titles`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(user ? { "x-test-user": JSON.stringify(user) } : {}) },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: (await res.json()) as any };
}

test("titles: from a script, in the account's language, with the profile", async () => {
  const r = await post(AGENCY, A, { scriptId: 1 });
  assert.equal(r.status, 200);
  assert.equal(r.json.options.length, 5);
  assert.match(aiCalls[0].system, /Dutch/);
  assert.match(aiCalls[0].system, /Fitness coach/);
  assert.match(aiCalls[0].user, /Stretch every morning\./);
});

test("titles: from a post caption, or from a typed idea alone", async () => {
  assert.equal((await post(AGENCY, A, { postId: 5 })).status, 200);
  assert.match(aiCalls[0].user, /New week, new habits/);
  assert.equal((await post(AGENCY, A, { about: "three sleep tips" })).status, 200);
  assert.match(aiCalls[1].user, /three sleep tips/);
});

test("titles: titles already shown are passed along to avoid", async () => {
  await post(AGENCY, A, { scriptId: 1, avoid: ["Stretch first", 3] });
  assert.match(aiCalls[0].user, /- Stretch first/);
});

test("titles: nothing to write from is refused before the model is asked", async () => {
  const r = await post(MANAGER_A, A, {});
  assert.equal(r.status, 422);
  assert.equal(r.json.reason, "no_input");
  assert.equal((await post(MANAGER_A, A, { about: "   " })).status, 422);
  assert.equal(aiCalls.length, 0);
});

test("titles: unknown or other-account sources are 404, a bad id is 400", async () => {
  assert.equal((await post(MANAGER_A, A, { scriptId: 99 })).json.reason, "script_missing");
  assert.equal((await post(MANAGER_A, A, { postId: 99 })).json.reason, "post_missing");
  assert.equal((await post(MANAGER_A, A, { scriptId: "1" })).status, 400);
});

test("titles: a client user only reaches scripts that were sent to them", async () => {
  assert.equal((await post(MANAGER_A, A, { scriptId: 1 })).json.reason, "script_missing");
  scripts[0].reviewStatus = "sent";
  assert.equal((await post(MANAGER_A, A, { scriptId: 1 })).status, 200);
});

test("titles: viewers, strangers and other accounts' managers are turned away", async () => {
  assert.equal((await post(null, A, { about: "x" })).status, 401);
  assert.equal((await post(VIEWER_A, A, { about: "x" })).status, 403);
  assert.notEqual((await post(MANAGER_B, A, { about: "x" })).status, 200);
  assert.equal(aiCalls.length, 0);
});

test("titles: a failing or useless model answer is a 502 with a reason", async () => {
  aiAnswer = async () => ({ error: "timeout" });
  assert.deepEqual((await post(MANAGER_A, A, { about: "x" })).json.reason, "ai_failed");
  aiAnswer = async () => ({ text: "sorry" });
  const r = await post(MANAGER_A, A, { about: "x" });
  assert.equal(r.status, 502);
  assert.equal(r.json.reason, "no_options");
});
