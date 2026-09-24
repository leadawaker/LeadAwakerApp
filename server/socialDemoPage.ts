import type { PublicSocialPost } from "./demoSocial/types";

export interface SocialBoot {
  token: string;
  language: "en" | "nl" | "pt";
  started: boolean;
  company: string;
  agentName: string;
  post: PublicSocialPost | null;
  imageUrl: string;
}

const SHOT = /^[a-f0-9]{16}\.webp$/;

export function pickPostImage(opts: { socialImage: string | null | undefined; screenshot: string | null | undefined }): string {
  for (const f of [opts.socialImage, opts.screenshot]) {
    if (f && SHOT.test(f)) return `/api/site-shot/${f}`;
  }
  return "";
}

// Cloudflare caches static paths for hours: version the whole module graph,
// including the reused /premium/demo modules the page imports.
const ASSET_V = Date.now().toString(36);
const MODULES = [
  "/social-demo-assets/main.js",
  "/social-demo-assets/feed.js",
  "/social-demo-assets/dm.js",
  "/social-demo-assets/copy.js",
  "/social-demo-assets/keyword.js",
  "/premium/demo/transport.js",
  "/premium/demo/chat.js",
  "/premium/demo/tracker.js",
  "/premium/demo/recap.js",
  "/premium/demo/confetti.js",
  "/premium/demo/admin.js",
  "/premium/demo/copy.js",
  "/premium/demo/format.js",
  "/premium/demo/icons.js",
];

function importMap(): string {
  const imports: Record<string, string> = {};
  for (const m of MODULES) imports[m] = `${m}?v=${ASSET_V}`;
  return JSON.stringify({ imports });
}

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

export function renderSocialDemoHtml(boot: SocialBoot): string {
  const bootJson = JSON.stringify(boot).replace(/</g, "\\u003c");
  return `<!doctype html>
<html lang="${esc(boot.language)}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<meta name="robots" content="noindex, nofollow" />
<title>${esc(boot.company || "Demo")}</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Grand+Hotel&display=swap" rel="stylesheet" />
<link rel="stylesheet" href="/premium/demo/demo.css?v=${ASSET_V}" />
<link rel="stylesheet" href="/social-demo-assets/social.css?v=${ASSET_V}" />
<script type="importmap">${importMap()}</script>
<script>window.__SOCIAL__ = ${bootJson};</script>
</head>
<body>
<div id="root"></div>
<script type="module" src="/social-demo-assets/main.js"></script>
</body>
</html>`;
}
