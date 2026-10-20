import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { createHmac } from "node:crypto";
import type { AddressInfo } from "node:net";
import express from "express";
import { registerInstagramWebhook, verifyHubSignature, WEBHOOK_PATH } from "./webhookRoutes";

const SECRET = "app-secret";
let processed: unknown[];
let secret: string | undefined;
let base = "";
let server: http.Server;
let hook: { idle(): Promise<void> };

before(async () => {
  const app = express();
  // Same raw-body capture as server/index.ts.
  app.use(express.json({ verify: (req, _res, buf) => { (req as any).rawBody = buf; } }));
  hook = registerInstagramWebhook(app, {
    verifyToken: () => "verify-me",
    appSecret: () => secret,
    process: async (body) => { processed.push(body); },
  });
  server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(() => new Promise<void>((r) => server.close(() => r())));
beforeEach(() => { processed = []; secret = SECRET; });

const sign = (body: string, s = SECRET) => `sha256=${createHmac("sha256", s).update(body).digest("hex")}`;

test("verify handshake: echoes the challenge only with the right token", async () => {
  const ok = await fetch(`${base}${WEBHOOK_PATH}?hub.mode=subscribe&hub.verify_token=verify-me&hub.challenge=1158201444`);
  assert.equal(ok.status, 200);
  assert.equal(await ok.text(), "1158201444");
  assert.equal((await fetch(`${base}${WEBHOOK_PATH}?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=1`)).status, 403);
  assert.equal((await fetch(`${base}${WEBHOOK_PATH}?hub.mode=unsubscribe&hub.verify_token=verify-me&hub.challenge=1`)).status, 403);
});

test("POST: a good signature gets 200 and is processed; bad or missing ones are refused and never processed", async () => {
  const body = JSON.stringify({ object: "instagram", entry: [] });
  const post = (headers: Record<string, string>, b = body) => fetch(`${base}${WEBHOOK_PATH}`, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: b });
  assert.equal((await post({ "x-hub-signature-256": sign(body) })).status, 200);
  await hook.idle();
  assert.equal(processed.length, 1);
  assert.equal((await post({ "x-hub-signature-256": sign(body, "other") })).status, 401);
  assert.equal((await post({})).status, 401);
  assert.equal((await post({ "x-hub-signature-256": sign(body) }, body.replace("[]", "[1]"))).status, 401, "body changed after signing");
  secret = undefined;
  assert.equal((await post({ "x-hub-signature-256": sign(body) })).status, 503);
  await hook.idle();
  assert.equal(processed.length, 1);
});

test("signature check is exact", () => {
  const raw = Buffer.from('{"a":1}');
  assert.ok(verifyHubSignature(raw, sign('{"a":1}'), SECRET));
  assert.ok(verifyHubSignature(raw, sign('{"a":1}').toUpperCase().replace("SHA256=", "sha256="), SECRET));
  assert.ok(!verifyHubSignature(raw, "sha1=abc", SECRET));
  assert.ok(!verifyHubSignature(null, sign('{"a":1}'), SECRET));
  assert.ok(!verifyHubSignature(raw, sign('{"a":1}'), ""));
});
