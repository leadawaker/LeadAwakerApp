import { statSync } from "fs";
import path from "path";
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
  /** The Client's logo (read live, may be switched off), else null: initials circle. */
  logoUrl?: string | null;
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

// Cloudflare caches static paths for hours (it overrides the no-cache header
// with a 4h browser TTL): version the whole module graph, including the
// reused /premium/demo modules the page imports, the entry script and the CSS.
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

const STYLES = ["/premium/demo/demo.css", "/social-demo-assets/social.css"];

/** URL path -> file on disk, for the modification-time version below. */
function diskPath(url: string): string {
  return url.startsWith("/social-demo-assets/")
    ? path.resolve("client/public/social-demo", url.slice("/social-demo-assets/".length))
    : path.resolve("client/public", url.slice(1));
}

// Derived from the files' modification times rather than the process start, so
// editing a static file alone (no server restart) still busts every cache.
// Re-stat at most every 5s: a page view should not cost 16 stat calls.
let versionCache = { at: 0, v: "" };
export function assetVersion(now = Date.now()): string {
  if (versionCache.v && now - versionCache.at < 5000) return versionCache.v;
  let newest = 0;
  for (const f of [...MODULES, ...STYLES]) {
    try { newest = Math.max(newest, statSync(diskPath(f)).mtimeMs); } catch { /* missing: ignore */ }
  }
  versionCache = { at: now, v: Math.floor(newest || now).toString(36) };
  return versionCache.v;
}

function importMap(v: string): string {
  const imports: Record<string, string> = {};
  for (const m of MODULES) imports[m] = `${m}?v=${v}`;
  return JSON.stringify({ imports });
}

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

export function renderSocialDemoHtml(boot: SocialBoot): string {
  const bootJson = JSON.stringify(boot).replace(/</g, "\\u003c");
  const v = assetVersion();
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
<link rel="stylesheet" href="/premium/demo/demo.css?v=${v}" />
<link rel="stylesheet" href="/social-demo-assets/social.css?v=${v}" />
<script type="importmap">${importMap(v)}</script>
<script>window.__SOCIAL__ = ${bootJson};</script>
</head>
<body>
<div id="root"></div>
<script type="module" src="/social-demo-assets/main.js?v=${v}"></script>
</body>
</html>`;
}
