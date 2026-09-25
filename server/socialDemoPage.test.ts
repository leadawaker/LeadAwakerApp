import { test } from "node:test";
import assert from "node:assert/strict";
import { isTokenExpired, pickPostImage, renderSocialDemoHtml, TOKEN_TTL_DAYS } from "./socialDemoPage";

const post = { handle: "dak", caption: "</script><b>x</b>", keyword: "DAK", cta_line: "Reageer DAK", offer: "o", likes: 3 };

test("pickPostImage prefers the social image, then the screenshot", () => {
  assert.equal(pickPostImage({ socialImage: "0123456789abcdef.webp", screenshot: "fedcba9876543210.webp" }), "/api/site-shot/0123456789abcdef.webp");
  assert.equal(pickPostImage({ socialImage: null, screenshot: "fedcba9876543210.webp" }), "/api/site-shot/fedcba9876543210.webp");
  assert.equal(pickPostImage({ socialImage: "../../etc/passwd", screenshot: "" }), "");
});

test("boot JSON cannot break out of the script tag", () => {
  const html = renderSocialDemoHtml({ token: "abcd1234", language: "nl", started: false, company: "Dak", agentName: "Sarah", post, imageUrl: "" });
  assert.equal(html.includes("</script><b>"), false);
  assert.match(html, /<html lang="nl"/);
  assert.match(html, /noindex/);
});

test("every module in the graph is versioned", () => {
  const html = renderSocialDemoHtml({ token: "abcd1234", language: "en", started: false, company: "", agentName: "", post: null, imageUrl: "" });
  const map = JSON.parse(html.match(/<script type="importmap">([\s\S]*?)<\/script>/)![1]);
  for (const target of Object.values(map.imports) as string[]) assert.match(target, /\?v=/);
  assert.ok(map.imports["/premium/demo/transport.js"]);
  assert.ok(map.imports["/social-demo-assets/main.js"]);
});

test("token expiry matches the engine's 7-day TTL", () => {
  const now = Date.parse("2026-09-25T12:00:00Z");
  assert.equal(TOKEN_TTL_DAYS, 7);
  assert.equal(isTokenExpired(new Date(now - 6.9 * 86_400_000), now), false);
  assert.equal(isTokenExpired(new Date(now - 7.1 * 86_400_000), now), true);
  assert.equal(isTokenExpired(null, now), false);
});

test("the expired page carries the flag and no persona", () => {
  const html = renderSocialDemoHtml({ token: "abcd1234", language: "pt", started: false, expired: true, company: "", agentName: "", post: null, imageUrl: "" });
  const boot = JSON.parse(html.match(/window.__SOCIAL__ = (.*?);<\/script>/)![1]);
  assert.equal(boot.expired, true);
  assert.equal(boot.post, null);
});
