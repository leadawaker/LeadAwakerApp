import { test } from "node:test";
import assert from "node:assert/strict";
import {
  RESET_TTL_MS, createResetToken, verifyResetToken, pickResetLang, buildResetUrl, normalizeEmail, parsePrefs,
} from "./passwordReset";
import { buildResetEmail } from "./passwordResetEmail";

const prefsWith = (record: unknown, extra: Record<string, unknown> = {}) => JSON.stringify({ ...extra, password_reset: record });

test("token is 32 random bytes and only its hash is stored", () => {
  const a = createResetToken(1_000);
  const b = createResetToken(1_000);
  assert.match(a.token, /^[0-9a-f]{64}$/);
  assert.notEqual(a.token, b.token);
  assert.match(a.record.token_hash, /^[0-9a-f]{64}$/);
  assert.notEqual(a.record.token_hash, a.token);
  assert.equal(JSON.stringify(a.record).includes(a.token), false);
  assert.equal(a.record.created_at, new Date(1_000).toISOString());
  assert.equal(a.record.expires_at, new Date(1_000 + RESET_TTL_MS).toISOString());
});

test("a valid token verifies until it expires", () => {
  const { token, record } = createResetToken(0);
  const prefs = prefsWith(record);
  assert.equal(verifyResetToken(prefs, token, 1_000), true);
  assert.equal(verifyResetToken(prefs, token, RESET_TTL_MS), true, "valid at the exact expiry instant");
  assert.equal(verifyResetToken(prefs, token, RESET_TTL_MS + 1), false);
});

test("wrong, malformed, or missing tokens never verify", () => {
  const { token, record } = createResetToken(0);
  const other = createResetToken(0).token;
  assert.equal(verifyResetToken(prefsWith(record), other, 1), false);
  assert.equal(verifyResetToken(prefsWith(record), record.token_hash, 1), false, "the stored hash is not a token");
  for (const bad of ["", "abc", token.slice(1), token + "00", undefined, null, 42, {}]) {
    assert.equal(verifyResetToken(prefsWith(record), bad, 1), false);
  }
  assert.equal(verifyResetToken(prefsWith(null), token, 1), false, "cleared record = single use");
  assert.equal(verifyResetToken("{}", token, 1), false);
  assert.equal(verifyResetToken("not json", token, 1), false);
  assert.equal(verifyResetToken(null, token, 1), false);
  assert.equal(verifyResetToken(prefsWith({ token_hash: record.token_hash, expires_at: "garbage" }), token, 1), false);
  assert.equal(verifyResetToken(prefsWith({ token_hash: "zz", expires_at: record.expires_at }), token, 1), false);
});

test("an invite token in the same preferences is not a reset token", () => {
  const { token } = createResetToken(0);
  assert.equal(verifyResetToken(JSON.stringify({ invite_token: token, invite_sent_at: new Date(0).toISOString() }), token, 1), false);
});

test("language: saved preference wins, then the request, then en", () => {
  assert.equal(pickResetLang(JSON.stringify({ language: "nl", lang: "pt" }), "pt"), "nl");
  assert.equal(pickResetLang(JSON.stringify({ lang: "pt" }), "nl"), "pt");
  assert.equal(pickResetLang("{}", "nl"), "nl");
  assert.equal(pickResetLang({ language: "fr" }, "de"), "en");
  assert.equal(pickResetLang(null, undefined), "en");
});

test("reset URL points at the production site and encodes the email", () => {
  const url = buildResetUrl("a".repeat(64), "jan+x@bedrijf.nl", "nl", "https://www.leadawaker.com/");
  assert.equal(url, `https://www.leadawaker.com/reset-password?token=${"a".repeat(64)}&email=jan%2Bx%40bedrijf.nl&lang=nl`);
});

test("normalizeEmail trims, lowercases and rejects junk", () => {
  assert.equal(normalizeEmail("  Jan@Bedrijf.NL "), "jan@bedrijf.nl");
  for (const bad of ["", "no-at", "a@b", "a b@c.com", 5, null, undefined, "x@y.z".padEnd(300, "z")]) assert.equal(normalizeEmail(bad), null);
});

test("parsePrefs tolerates objects, strings and junk", () => {
  assert.deepEqual(parsePrefs({ a: 1 }), { a: 1 });
  assert.deepEqual(parsePrefs('{"a":1}'), { a: 1 });
  assert.deepEqual(parsePrefs("[1]"), {});
  assert.deepEqual(parsePrefs(undefined), {});
});

test("email renders in all three languages with the link and the 1-hour footer", () => {
  const link = "https://www.leadawaker.com/reset-password?token=t&email=a%40b.nl&lang=x";
  const subjects = new Set<string>();
  for (const lang of ["en", "nl", "pt"] as const) {
    const m = buildResetEmail(lang, link);
    subjects.add(m.subject);
    assert.ok(m.html.includes(`lang="${lang}"`));
    assert.ok(m.html.includes("reset-password?token=t&amp;email=a%40b.nl"), "button href is escaped");
    assert.ok(m.text.includes(link));
    assert.match(m.text, /1 (hour|uur|hora)/);
  }
  assert.equal(subjects.size, 3);
});
