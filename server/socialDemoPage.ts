import type { PublicSocialPost } from "./demoSocial/types";

export interface SocialBoot {
  token: string;
  language: "en" | "nl" | "pt";
  started: boolean;
  /** Past the engine's token TTL: the page shows its expired state only. */
  expired?: boolean;
  company: string;
  agentName: string;
  post: PublicSocialPost | null;
  imageUrl: string;
}

// The engine's token lifetime (TOKEN_TTL_DAYS in automations
// src/webhooks/web_demo_routes.py): _find_lead and _find_wa_lead only match a
// lead created within it. Past it every engine call 404s, so the page says so
// up front instead of letting a comment open a DM that can never load.
export const TOKEN_TTL_DAYS = 7;

export function isTokenExpired(createdAt: Date | string | null | undefined, now = Date.now()): boolean {
  if (!createdAt) return false;
  const t = new Date(createdAt).getTime();
  return Number.isFinite(t) && now - t > TOKEN_TTL_DAYS * 86_400_000;
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
