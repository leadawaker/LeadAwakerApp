import { test } from "node:test";
import assert from "node:assert/strict";
import { extractLogoCandidates, logoUrlFor } from "./clientLogo";

const BASE = "https://example.com/home";

test("the app icon outranks a header wordmark and the favicon", () => {
  const html = `<link rel="icon" href="/favicon-32.png" sizes="32x32">
    <link rel="apple-touch-icon" sizes="180x180" href="/apple.png">
    <img class="site-logo" src="/img/wordmark.svg" alt="Acme">`;
  const c = extractLogoCandidates(html, BASE).map((x) => x.url);
  assert.equal(c[0], "https://example.com/apple.png");
  assert.ok(c.indexOf("https://example.com/img/wordmark.svg") < c.indexOf("https://example.com/favicon-32.png"));
});

test("reads schema.org logo, as a string and as an ImageObject", () => {
  const html = `<script type="application/ld+json">{"@type":"Organization","logo":"https:\\/\\/cdn.example.com\\/l.png"}</script>
    <script type="application/ld+json">{"logo":{"@type":"ImageObject","url":"https://cdn.example.com/obj.png"}}</script>`;
  const c = extractLogoCandidates(html, BASE).map((x) => x.url);
  assert.ok(c.includes("https://cdn.example.com/l.png"));
  assert.ok(c.includes("https://cdn.example.com/obj.png"));
});

test("a large or SVG icon ranks as a real candidate", () => {
  const html = `<link rel="icon" type="image/svg+xml" href="/mark.svg"><link rel="shortcut icon" href="/favicon.ico">`;
  const c = extractLogoCandidates(html, BASE);
  assert.equal(c[0].url, "https://example.com/mark.svg");
});

test("non-http hrefs are dropped, data images kept, fallbacks always present", () => {
  const html = `<img class="logo" src="javascript:alert(1)"><img id="logo" src="data:image/png;base64,AAAA">`;
  const c = extractLogoCandidates(html, BASE).map((x) => x.url);
  assert.ok(!c.some((u) => u.startsWith("javascript:")));
  assert.ok(c.includes("data:image/png;base64,AAAA"));
  assert.ok(c.includes("https://example.com/apple-touch-icon.png"));
  assert.ok(c.includes("https://example.com/favicon.ico"));
});

test("logoUrlFor respects the switch and the file-name shape", () => {
  assert.equal(logoUrlFor({ logoPath: "0123456789abcdef.webp", logoEnabled: true }), "/api/site-shot/0123456789abcdef.webp");
  assert.equal(logoUrlFor({ logoPath: "0123456789abcdef.webp", logoEnabled: false }), null);
  assert.equal(logoUrlFor({ logoPath: "../etc/passwd", logoEnabled: true }), null);
  assert.equal(logoUrlFor(null), null);
});
