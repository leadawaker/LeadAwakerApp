// The guarantee that matters most in Phase C: without BOTH switches (account dm_mode "live" and
// INSTAGRAM_DM_LIVE=1) no request to Meta is possible, from any sender.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { DmBlockedError, sendDirectMessage, sendPrivateReply, withinMessagingWindow, withinPrivateReplyWindow } from "./igMessaging";

function counting() {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetch = (async (url: any, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify({ recipient_id: "r", message_id: "m.1" }), { status: 200 });
  }) as typeof globalThis.fetch;
  return { calls, deps: { fetch } };
}

const ON = { INSTAGRAM_DM_LIVE: "1" } as NodeJS.ProcessEnv;
const OFF = {} as NodeJS.ProcessEnv;

test("no network call unless both switches are on, for both senders and every mode", async () => {
  for (const accountMode of ["off", "dry_run", "live", "LIVE", "", "yes"]) {
    for (const env of [OFF, ON, { INSTAGRAM_DM_LIVE: "true" } as NodeJS.ProcessEnv, { INSTAGRAM_DM_LIVE: "0" } as NodeJS.ProcessEnv]) {
      const allowed = accountMode === "live" && env.INSTAGRAM_DM_LIVE === "1";
      const { calls, deps } = counting();
      const ctx = { accountMode, igUserId: "17841", token: "tok", deps, env };
      for (const send of [() => sendPrivateReply(ctx, "c1", "hi"), () => sendDirectMessage(ctx, "u1", "hi")]) {
        if (allowed) assert.equal(await send(), "m.1");
        else await assert.rejects(send(), DmBlockedError);
      }
      assert.equal(calls.length, allowed ? 2 : 0, `${accountMode} / ${JSON.stringify(env)}`);
    }
  }
});

test("process.env decides when no env is passed (the live wiring)", async () => {
  const prev = process.env.INSTAGRAM_DM_LIVE;
  delete process.env.INSTAGRAM_DM_LIVE;
  try {
    const { calls, deps } = counting();
    await assert.rejects(sendPrivateReply({ accountMode: "live", igUserId: "1", token: "t", deps }, "c", "x"), DmBlockedError);
    assert.equal(calls.length, 0);
  } finally {
    if (prev === undefined) delete process.env.INSTAGRAM_DM_LIVE;
    else process.env.INSTAGRAM_DM_LIVE = prev;
  }
});

test("a live private reply posts recipient.comment_id; a DM posts recipient.id; the token goes in the header", async () => {
  const { calls, deps } = counting();
  await sendPrivateReply({ accountMode: "live", igUserId: "17841", token: "tok", deps, env: ON }, "c1", "Oi");
  await sendDirectMessage({ accountMode: "live", igUserId: "17841", token: "tok", deps, env: ON }, "u9", "Oi de novo");
  assert.match(calls[0].url, /\/17841\/messages$/);
  assert.deepEqual(JSON.parse(String(calls[0].init?.body)), { recipient: { comment_id: "c1" }, message: { text: "Oi" } });
  assert.deepEqual(JSON.parse(String(calls[1].init?.body)), { recipient: { id: "u9" }, message: { text: "Oi de novo" } });
  assert.equal((calls[0].init?.headers as Record<string, string>).Authorization, "Bearer tok");
  assert.ok(!calls[0].url.includes("tok"), "the token is never in a URL");
});

test("windows: 7 days for the private reply, 24 h after the person's last message", () => {
  const now = new Date("2026-10-20T12:00:00Z");
  assert.ok(withinPrivateReplyWindow(new Date("2026-10-14T12:00:00Z"), now));
  assert.ok(!withinPrivateReplyWindow(new Date("2026-10-13T11:00:00Z"), now));
  assert.ok(withinMessagingWindow(new Date("2026-10-19T13:00:00Z"), now));
  assert.ok(!withinMessagingWindow(new Date("2026-10-19T11:00:00Z"), now));
  assert.ok(!withinMessagingWindow(null, now));
});

test("nothing else in server/ calls the Instagram messages endpoint directly", () => {
  const root = join(import.meta.dirname, "..");
  const hits: string[] = [];
  const walk = (d: string) => {
    for (const n of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, n.name);
      if (n.isDirectory()) { if (n.name !== "node_modules") walk(p); continue; }
      if (!p.endsWith(".ts") || p.endsWith(".test.ts") || p.endsWith("igMessaging.ts")) continue;
      const src = readFileSync(p, "utf8");
      if (/IG_MESSAGES_PATH|\/messages[`"']/.test(src) && /graph\.instagram\.com|IG_GRAPH/.test(src)) hits.push(p);
    }
  };
  walk(root);
  assert.deepEqual(hits, []);
});
