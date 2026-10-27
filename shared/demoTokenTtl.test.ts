import { test } from "node:test";
import assert from "node:assert/strict";
import { TOKEN_TTL_DAYS, VOICE_TOKEN_TTL_DAYS, PUBLIC_DEMO_SOURCE, ttlDaysFor, isLinkExpired } from "./demoTokenTtl";

const now = Date.parse("2026-10-27T12:00:00Z");
const ago = (d: number) => new Date(now - d * 86_400_000);

test("the lifetimes are pinned", () => {
  assert.equal(TOKEN_TTL_DAYS, 7);
  assert.equal(VOICE_TOKEN_TTL_DAYS, 14);
  assert.equal(PUBLIC_DEMO_SOURCE, "Public Website Demo");
});

test("ttlDaysFor: voice is 14, anything else 7", () => {
  assert.equal(ttlDaysFor("voice"), 14);
  assert.equal(ttlDaysFor("speed"), 7);
  assert.equal(ttlDaysFor(""), 7);
});

test("voice links live 14 days from the mint", () => {
  assert.equal(isLinkExpired({ service: "voice", mintedAt: ago(13) }, now), false);
  assert.equal(isLinkExpired({ service: "voice", mintedAt: ago(15) }, now), true);
  // A browser open does not extend a voice link.
  assert.equal(isLinkExpired({ service: "voice", mintedAt: ago(15), openedAt: ago(1) }, now), true);
});

test("chat links live 7 days from the mint, or from the first open", () => {
  assert.equal(isLinkExpired({ service: "speed", mintedAt: ago(6) }, now), false);
  assert.equal(isLinkExpired({ service: "speed", mintedAt: ago(8) }, now), true);
  assert.equal(isLinkExpired({ service: "speed", mintedAt: ago(12), openedAt: ago(6) }, now), false);
  assert.equal(isLinkExpired({ service: "speed", mintedAt: ago(12), openedAt: ago(8) }, now), true);
  assert.equal(isLinkExpired({ service: "speed", mintedAt: ago(8), openedAt: null }, now), true);
});

test("revoked is always expired", () => {
  assert.equal(isLinkExpired({ service: "speed", mintedAt: ago(1), revokedAt: ago(0) }, now), true);
  assert.equal(isLinkExpired({ service: "voice", mintedAt: ago(1), revokedAt: ago(0) }, now), true);
  assert.equal(isLinkExpired({ service: "dbr", mintedAt: null, revokedAt: ago(0) }, now), true);
  assert.equal(isLinkExpired({ service: "speed", mintedAt: ago(1), revokedAt: null }, now), false);
});

test("a link with no mint date and no revoke is not expired", () => {
  assert.equal(isLinkExpired({ service: "dbr", mintedAt: null }, now), false);
  assert.equal(isLinkExpired({ service: "dbr", mintedAt: "not a date" }, now), false);
});

test("string dates are accepted", () => {
  assert.equal(isLinkExpired({ service: "speed", mintedAt: ago(8).toISOString() }, now), true);
  assert.equal(isLinkExpired({ service: "speed", mintedAt: ago(1).toISOString() }, now), false);
});
