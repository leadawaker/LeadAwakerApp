import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";
import { registerInsightRoutes } from "./insightsRoutes";

const NOW = new Date("2026-10-20T12:00:00Z");
let base = "";
let server: http.Server;
before(async () => {
  const app = express();
  registerInsightRoutes(app, {
    requireAuth: (req, res, next) => { const raw = req.headers["x-test-user"]; if (typeof raw !== "string") return res.status(401).end(); (req as any).user = JSON.parse(raw); next(); },
    now: () => NOW,
    store: {
      async getAccount(id) { return id === 7 ? { timezone: "America/Sao_Paulo", language: "Portuguese", socialEnabled: true } : id === 9 ? { timezone: null, language: null, socialEnabled: false } : null; },
      async listInsightMedia() { return [{ id: 1, accountsId: 7, igMediaId: "m1", mediaType: "VIDEO", productType: "REELS", permalink: "p", caption: "Oi", postedAt: NOW, postId: 3, firstSeenAt: NOW, lastPolledAt: NOW }]; },
      async latestMediaValues() { return [{ igMediaId: "m1", metric: "views", value: 42 }]; },
      async accountSnapshots() { return [{ metric: "views", bucket: "2026-10-19", value: 10 }]; },
      async skippedMetrics() { return ["reels_skip_rate"]; },
      async getInsightState() { return { lastAccountRunAt: NOW, lastError: null }; },
    },
  });
  server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(() => new Promise<void>((r) => server.close(() => r())));

const get = async (path: string, user: object) => {
  const res = await fetch(base + path, { headers: { "x-test-user": JSON.stringify(user) } });
  return { status: res.status, json: await res.json().catch(() => null) };
};

test("a Viewer of the account reads its insights; the zone and period come back", async () => {
  const r = await get("/api/social/accounts/7/insights?days=30", { id: 22, role: "Viewer", accountsId: 7 });
  assert.equal(r.status, 200);
  assert.equal(r.json.days, 30);
  assert.equal(r.json.timeZone, "America/Sao_Paulo");
  assert.equal(r.json.posts[0].metrics.views, 42);
  assert.equal(r.json.headline.views, 10);
  assert.deepEqual(r.json.skipped, ["reels_skip_rate"]);
  assert.equal((await get("/api/social/accounts/7/insights?days=99", { id: 1, role: "Owner", accountsId: 1 })).json.days, 7, "anything else is 7");
});

test("another account's users and an account with Social off are refused", async () => {
  assert.equal((await get("/api/social/accounts/7/insights", { id: 31, role: "Manager", accountsId: 8 })).status, 403);
  assert.equal((await get("/api/social/accounts/9/insights", { id: 41, role: "Manager", accountsId: 9 })).status, 403);
});
