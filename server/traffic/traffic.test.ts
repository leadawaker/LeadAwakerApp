import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyVisit } from "./sources";
import { isBot, isSiteOrigin, parseVisit } from "./visit";

const from = (referrerHost: string | null, utmSource: string | null = null, utmMedium: string | null = null) =>
  classifyVisit({ referrerHost, utmSource, utmMedium });

test("sources: AI assistants, by referrer or by the utm tag they add", () => {
  assert.deepEqual(from("chatgpt.com"), { channel: "ai", label: "ChatGPT" });
  assert.deepEqual(from(null, "chatgpt.com"), { channel: "ai", label: "ChatGPT" });
  assert.deepEqual(from("www.perplexity.ai"), { channel: "ai", label: "Perplexity" });
  assert.deepEqual(from("claude.ai"), { channel: "ai", label: "Claude" });
});

test("sources: gemini.google.com is an assistant, the rest of Google is search", () => {
  assert.deepEqual(from("gemini.google.com"), { channel: "ai", label: "Gemini" });
  assert.deepEqual(from("google.com.br"), { channel: "search", label: "Google" });
  assert.deepEqual(from("www.google.nl"), { channel: "search", label: "Google" });
  assert.deepEqual(from("mail.google.com"), { channel: "email", label: "Email" });
});

test("sources: social apps report a package name", () => {
  assert.deepEqual(from("com.linkedin.android"), { channel: "social", label: "LinkedIn" });
  assert.deepEqual(from("lnkd.in"), { channel: "social", label: "LinkedIn" });
  assert.deepEqual(from("netflix.com"), { channel: "referral", label: "netflix.com" });
});

test("sources: the utm tag wins over the referrer; nothing at all is direct", () => {
  assert.deepEqual(from("google.com", "linkedin"), { channel: "social", label: "LinkedIn" });
  assert.deepEqual(from(null, "spring-letter", "email"), { channel: "email", label: "spring-letter" });
  assert.deepEqual(from(null, "flyer"), { channel: "campaign", label: "flyer" });
  assert.deepEqual(from(null), { channel: "direct", label: null });
});

test("visit: a page view is tidied before it is stored", () => {
  assert.deepEqual(parseVisit({ p: "/nl/?utm_source=x#top", l: "nl-NL", e: 1, r: "WWW.Google.com", s: " LinkedIn ", m: "", w: 390, z: "Europe/Amsterdam" }), {
    path: "/nl", lang: "nl", isEntry: true, referrerHost: "google.com",
    utmSource: "linkedin", utmMedium: null, utmCampaign: null, device: "mobile", timezone: "Europe/Amsterdam",
  });
  assert.equal(parseVisit({ p: "/", w: 1440 })?.device, "desktop");
  assert.equal(parseVisit({ p: "/", e: 0 })?.isEntry, false);
});

test("visit: junk is dropped, not stored", () => {
  assert.equal(parseVisit(null), null);
  assert.equal(parseVisit({ p: "https://evil.example/" }), null);
  const odd = parseVisit({ p: "/" + "a".repeat(500), r: "<script>", z: "x y", l: "klingon", w: "wide" });
  assert.equal(odd?.path.length, 200);
  assert.equal(odd?.referrerHost, null);
  assert.equal(odd?.timezone, null);
  assert.equal(odd?.lang, null);
  assert.equal(odd?.device, null);
});

test("visit: only the public site counts, and not crawlers", () => {
  assert.equal(isSiteOrigin("https://www.leadawaker.com"), true);
  assert.equal(isSiteOrigin("https://app.leadawaker.com"), false);
  assert.equal(isSiteOrigin(undefined), false);
  assert.equal(isBot("Mozilla/5.0 (compatible; Googlebot/2.1)"), true);
  assert.equal(isBot(undefined), true);
  assert.equal(isBot("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15"), false);
});
