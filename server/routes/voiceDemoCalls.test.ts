import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEMO_CALL_ID, engineStartBody, isE164, relayDemoCall, saraSchema, startDemoCallSchema,
} from "./voiceDemoCallsRelay";

test("start: a token, a number and a mode pass", () => {
  const r = startDemoCallSchema.safeParse({ token: "abc123XY", toNumber: "06 12345678", mode: "sara" });
  assert.equal(r.success, true);
});

test("start: mode must be sara or bridge", () => {
  assert.equal(startDemoCallSchema.safeParse({ token: "abc123XY", toNumber: "+31612345678", mode: "conference" }).success, false);
  assert.equal(startDemoCallSchema.safeParse({ token: "abc123XY", toNumber: "+31612345678" }).success, false);
});

test("start: bad tokens and empty numbers fail", () => {
  for (const token of ["", "a/b", "../x", "x".repeat(65)]) {
    assert.equal(startDemoCallSchema.safeParse({ token, toNumber: "+31612345678", mode: "sara" }).success, false, token);
  }
  assert.equal(startDemoCallSchema.safeParse({ token: "abc123XY", toNumber: "", mode: "sara" }).success, false);
});

test("start: locale is one of the ElevenLabs demo locales", () => {
  for (const locale of ["nl", "en-GB", "en-US", "pt-BR"]) {
    assert.equal(startDemoCallSchema.safeParse({ token: "abc123XY", toNumber: "+31612345678", mode: "sara", locale }).success, true, locale);
  }
  assert.equal(startDemoCallSchema.safeParse({ token: "abc123XY", toNumber: "+31612345678", mode: "sara", locale: "pt-PT" }).success, false);
});

test("engine body: owner number only in bridge mode", () => {
  const base = { token: "abc123XY", toNumber: "+31612345678" };
  assert.deepEqual(engineStartBody({ ...base, mode: "sara" }, "+31684446349"),
    { token: "abc123XY", to_number: "+31612345678", mode: "sara" });
  assert.deepEqual(engineStartBody({ ...base, mode: "bridge", locale: "nl", voice: "v1" }, "+31684446349"),
    { token: "abc123XY", to_number: "+31612345678", mode: "bridge", owner_number: "+31684446349", locale: "nl", voice: "v1" });
});

test("sara: join or leave only", () => {
  assert.equal(saraSchema.safeParse({ action: "join" }).success, true);
  assert.equal(saraSchema.safeParse({ action: "leave" }).success, true);
  assert.equal(saraSchema.safeParse({ action: "kick" }).success, false);
  assert.equal(saraSchema.safeParse({}).success, false);
});

test("call id and E.164 formats", () => {
  assert.equal(DEMO_CALL_ID.test("dc_01ab-XY"), true);
  assert.equal(DEMO_CALL_ID.test("../x"), false);
  assert.equal(DEMO_CALL_ID.test(""), false);
  assert.equal(isE164("+31612345678"), true);
  assert.equal(isE164("0612345678"), false);
});

function fakeFetch(status: number, body: unknown) {
  const calls: { url: string; init: RequestInit }[] = [];
  const impl = async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(status === 204 ? null : JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  };
  return { impl, calls };
}

test("relay: POST carries the key and the body, 201 passes through", async () => {
  const f = fakeFetch(201, { id: "dc_1", status: "dialing_prospect" });
  const r = await relayDemoCall("http://e", "POST", "/voice/demo-calls", { token: "t" }, "k", f.impl);
  assert.deepEqual(r, { status: 201, body: { id: "dc_1", status: "dialing_prospect" } });
  assert.equal(f.calls[0].url, "http://e/voice/demo-calls");
  assert.equal(f.calls[0].init.method, "POST");
  assert.equal((f.calls[0].init.headers as Record<string, string>)["X-Internal-Key"], "k");
  assert.deepEqual(JSON.parse(String(f.calls[0].init.body)), { token: "t" });
});

test("relay: GET sends no body", async () => {
  const f = fakeFetch(200, { id: "dc_1", status: "live" });
  const r = await relayDemoCall("http://e", "GET", "/voice/demo-calls/dc_1", null, "k", f.impl);
  assert.equal(r.status, 200);
  assert.equal(f.calls[0].init.method, "GET");
  assert.equal(f.calls[0].init.body, undefined);
});

test("relay: engine 409 and 503 pass through with their detail", async () => {
  const r = await relayDemoCall("http://e", "POST", "/x", {}, "k", fakeFetch(409, { detail: "Another demo call is live." }).impl);
  assert.equal(r.status, 409);
  assert.equal((r.body as { message: string }).message, "Another demo call is live.");
  assert.equal((await relayDemoCall("http://e", "POST", "/x", {}, "k", fakeFetch(503, {}).impl)).status, 503);
});

test("relay: engine 401 (our key) becomes 502", async () => {
  const r = await relayDemoCall("http://e", "POST", "/x", {}, "k", fakeFetch(401, { detail: "bad key" }).impl);
  assert.equal(r.status, 502);
});

test("relay: unreachable engine is 502, 204 has no body", async () => {
  const r = await relayDemoCall("http://e", "GET", "/x", null, "k", async () => { throw new Error("ECONNREFUSED"); });
  assert.equal(r.status, 502);
  assert.deepEqual(await relayDemoCall("http://e", "POST", "/x", {}, "k", fakeFetch(204, null).impl), { status: 204, body: null });
});
