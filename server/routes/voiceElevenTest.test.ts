import { test } from "node:test";
import assert from "node:assert/strict";
import { CONVERSATION_ID, elevenTestSchema, relayToEngine, releaseSchema, startedSchema } from "./voiceElevenTestRelay";

test("schema: ids and an E.164 caller pass", () => {
  const r = elevenTestSchema.safeParse({ accountId: 5, lineId: 12, callerNumber: "+31612345678" });
  assert.equal(r.success, true);
});

test("schema: callerNumber may be absent", () => {
  assert.equal(elevenTestSchema.safeParse({ accountId: 5, lineId: 12 }).success, true);
});

test("schema: callerNumber that is not E.164 fails", () => {
  for (const n of ["0612345678", "+0612345678", "31612345678", "+31 6 12345678", "", "+3161"]) {
    assert.equal(elevenTestSchema.safeParse({ accountId: 5, lineId: 12, callerNumber: n }).success, false, n);
  }
});

test("schema: no agent pick is relayed (ElevenLabs always runs Realtime Max)", () => {
  const r = elevenTestSchema.safeParse({ accountId: 5, lineId: 12, model: "mini" });
  assert.equal(r.success, true);
  assert.equal(r.success && "model" in r.data, false);
});

test("schema: draft is an optional boolean", () => {
  for (const ok of [{ draft: true }, { draft: false }, {}]) {
    assert.equal(elevenTestSchema.safeParse({ accountId: 5, lineId: 12, ...ok }).success, true, JSON.stringify(ok));
  }
  assert.equal(elevenTestSchema.safeParse({ accountId: 5, lineId: 12, draft: "yes" }).success, false);
});

test("schema: ids must be positive integers", () => {
  for (const bad of [{ accountId: 0, lineId: 1 }, { accountId: 1, lineId: -2 }, { accountId: 1.5, lineId: 1 }, { accountId: "1", lineId: 1 }, { accountId: 1 }]) {
    assert.equal(elevenTestSchema.safeParse(bad).success, false, JSON.stringify(bad));
  }
});

test("started: body optional, conversation id format", () => {
  assert.equal(startedSchema.safeParse({}).success, true);
  assert.equal(startedSchema.safeParse({ conversationId: "conv_abc" }).success, true);
  assert.equal(CONVERSATION_ID.test("conv_01abc-XY"), true);
  assert.equal(CONVERSATION_ID.test("../x"), false);
  assert.equal(CONVERSATION_ID.test("a/b"), false);
});

test("release: needs the account id as a positive integer", () => {
  assert.equal(releaseSchema.safeParse({ accountId: 5 }).success, true);
  for (const bad of [{}, { accountId: 0 }, { accountId: -1 }, { accountId: 1.5 }, { accountId: "5" }]) {
    assert.equal(releaseSchema.safeParse(bad).success, false, JSON.stringify(bad));
  }
});

function fakeFetch(status: number, body: unknown) {
  const calls: { url: string; init: RequestInit }[] = [];
  const impl = async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(status === 204 ? null : JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  };
  return { impl, calls };
}

test("relay: success passes body through with the internal key", async () => {
  const f = fakeFetch(200, { conversation_token: "t", conversation_id: "conv_1" });
  const r = await relayToEngine("http://e", "/voice/eleven/browser-session", { account_id: 1 }, "k", f.impl);
  assert.equal(r.status, 200);
  assert.deepEqual(r.body, { conversation_token: "t", conversation_id: "conv_1" });
  assert.equal(f.calls[0].url, "http://e/voice/eleven/browser-session");
  assert.equal((f.calls[0].init.headers as Record<string, string>)["X-Internal-Key"], "k");
});

test("relay: success passes the engine's rates through unchanged", async () => {
  const rates = { gptLivePerMin: 0.05, elevenPerMin: 0.1 };
  const f = fakeFetch(200, { conversation_token: "t", conversation_id: "conv_1", rates });
  const r = await relayToEngine("http://e", "/voice/eleven/browser-session", { line_id: 12 }, "k", f.impl);
  assert.deepEqual((r.body as { rates: unknown }).rates, rates);
  assert.deepEqual(JSON.parse(String(f.calls[0].init.body)), { line_id: 12 });
});

test("relay: engine 403 passes through with its detail", async () => {
  const f = fakeFetch(403, { detail: "Not an ElevenLabs demo or test line of this account." });
  const r = await relayToEngine("http://e", "/x", {}, "k", f.impl);
  assert.equal(r.status, 403);
  assert.equal((r.body as { message: string }).message, "Not an ElevenLabs demo or test line of this account.");
});

test("relay: engine 502 and 429 pass through", async () => {
  assert.equal((await relayToEngine("http://e", "/x", {}, "k", fakeFetch(502, { detail: "ElevenLabs gave no session" }).impl)).status, 502);
  assert.equal((await relayToEngine("http://e", "/x", {}, "k", fakeFetch(429, { detail: "busy" }).impl)).status, 429);
});

test("relay: engine 401 (our key) becomes 502, never a login redirect", async () => {
  const r = await relayToEngine("http://e", "/x", {}, "k", fakeFetch(401, { detail: "invalid internal key" }).impl);
  assert.equal(r.status, 502);
});

test("relay: 204 passes through with no body", async () => {
  const r = await relayToEngine("http://e", "/x", {}, "k", fakeFetch(204, null).impl);
  assert.deepEqual(r, { status: 204, body: null });
});

test("relay: engine unreachable is 502", async () => {
  const r = await relayToEngine("http://e", "/x", {}, "k", async () => { throw new Error("ECONNREFUSED"); });
  assert.equal(r.status, 502);
});

test("relay: release is forwarded to the engine with the internal key and the account", async () => {
  const f = fakeFetch(200, { released: true });
  const r = await relayToEngine("http://e", "/voice/eleven/browser-session/conv_1/release", { account_id: 5 }, "k", f.impl);
  assert.deepEqual(r, { status: 200, body: { released: true } });
  assert.equal(f.calls[0].url, "http://e/voice/eleven/browser-session/conv_1/release");
  assert.equal((f.calls[0].init.headers as Record<string, string>)["X-Internal-Key"], "k");
  assert.deepEqual(JSON.parse(String(f.calls[0].init.body)), { account_id: 5 });
});

test("relay: release of another account's session passes the engine's 403 through", async () => {
  const r = await relayToEngine("http://e", "/x/release", { account_id: 9 }, "k", fakeFetch(403, { detail: "Not a session of this account." }).impl);
  assert.equal(r.status, 403);
});
