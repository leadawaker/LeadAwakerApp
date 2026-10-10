// Checks and tidies what client/public/site/visit.js sends before it is stored.
// The endpoint is public, so nothing in the payload is trusted: every field is
// cut to a shape and a length, and anything else is dropped.
import type { NewSiteVisit } from "../storage/siteVisits";

// Only page views of the public site count. app.leadawaker.com serves the same
// pages as a dev copy, and its views (ours) must not land in the numbers.
const SITE_ORIGINS = new Set(["https://www.leadawaker.com", "https://leadawaker.com"]);

export function isSiteOrigin(origin: string | undefined): boolean {
  return SITE_ORIGINS.has(String(origin || "").replace(/\/$/, ""));
}

// Crawlers and link previewers that run JavaScript. Most bots never get this
// far: the beacon only fires in a real browser.
const BOT_RE = /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|preview|monitor|scrape|curl|wget|python|httpclient|facebookexternalhit|whatsapp|phantom|puppeteer|playwright/i;

export function isBot(userAgent: string | undefined): boolean {
  return !userAgent || BOT_RE.test(userAgent);
}

/** A short, single-line tag (utm value), or null. */
function tag(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const clean = value.replace(/[\u0000-\u001f\u007f]+/g, " ").trim().toLowerCase().slice(0, 80);
  return clean || null;
}

function deviceOf(width: unknown): string | null {
  const w = Number(width);
  if (!Number.isFinite(w) || w <= 0 || w > 20_000) return null;
  if (w < 768) return "mobile";
  return w < 1100 ? "tablet" : "desktop";
}

/** The visit to store, or null when the payload is not a page view of the site. */
export function parseVisit(body: unknown): NewSiteVisit | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;

  if (typeof b.p !== "string" || !b.p.startsWith("/")) return null;
  // Pathname only, and "/nl/" counts as "/nl".
  const path = b.p.split(/[?#]/)[0].replace(/(.)\/+$/, "$1").slice(0, 200);

  const host = typeof b.r === "string" ? b.r.trim().toLowerCase().replace(/^www\./, "") : "";
  const lang = typeof b.l === "string" && /^[a-z]{2}(-[a-z]{2,4})?$/i.test(b.l) ? b.l.slice(0, 2).toLowerCase() : null;
  const timezone = typeof b.z === "string" && /^[A-Za-z0-9_+\-/]{1,64}$/.test(b.z) ? b.z : null;

  return {
    path,
    lang,
    isEntry: b.e === 1 || b.e === true,
    referrerHost: /^[a-z0-9.-]{1,100}$/.test(host) ? host : null,
    utmSource: tag(b.s),
    utmMedium: tag(b.m),
    utmCampaign: tag(b.c),
    device: deviceOf(b.w),
    timezone,
  };
}
