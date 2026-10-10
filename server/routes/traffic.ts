import type { Express, Request } from "express";
import { storage } from "../storage";
import { requireOwner } from "../auth";
import { wrapAsync } from "./_helpers";
import { TRAFFIC_PERIODS, type TrafficDays } from "@shared/trafficTypes";
import { getIndexStatus, getSearchOverview } from "../traffic/searchConsole";
import { isBot, isSiteOrigin, parseVisit } from "../traffic/visit";

// ─── Traffic (Owner only) + the public site's visit counter ──────────────
// /platform/traffic shows who finds the public site: Google Search Console
// (clicks, queries, index status) and our own count of page views, which is
// what shows the visits Google cannot (AI assistants, LinkedIn, direct).

function periodOf(req: Request): TrafficDays {
  const days = Number(req.query.days);
  return (TRAFFIC_PERIODS as readonly number[]).includes(days) ? (days as TrafficDays) : 28;
}

// The counter is public, so it is capped twice: per address (a person opens a
// handful of pages a minute, not sixty) and in total per day, so a flood can
// never fill the disk. The address is used for this count only, never stored.
const PER_MINUTE = 30;
const PER_DAY = 20_000;
const hits = new Map<string, number[]>();
let today = { day: "", count: 0 };

function allow(ip: string): boolean {
  const now = Date.now();
  const day = new Date(now).toISOString().slice(0, 10);
  if (today.day !== day) today = { day, count: 0 };
  if (today.count >= PER_DAY) return false;

  const recent = (hits.get(ip) || []).filter((t) => now - t < 60_000);
  if (recent.length >= PER_MINUTE) {
    hits.set(ip, recent);
    return false;
  }
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) {
    for (const [key, times] of hits) {
      if (!times.some((t) => now - t < 60_000)) hits.delete(key);
    }
  }
  today.count += 1;
  return true;
}

// Vercel forwards the site's /api calls here; the visitor's own address is in
// x-vercel-forwarded-for (x-forwarded-for ends at Vercel's edge).
function clientIp(req: Request): string {
  const forwarded = String(req.get("x-vercel-forwarded-for") || req.get("x-forwarded-for") || "");
  return forwarded.split(",")[0].trim() || req.ip || "unknown";
}

export function registerTrafficRoutes(app: Express): void {
  // Sent by client/public/site/visit.js on every page view of the public site.
  // Always answers 204: the page has no use for the outcome.
  app.post("/api/site/visit", (req, res) => {
    res.status(204).end();
    if (!isSiteOrigin(req.get("origin")) || isBot(req.get("user-agent"))) return;
    const visit = parseVisit(req.body);
    if (!visit || !allow(clientIp(req))) return;
    storage.recordSiteVisit(visit).catch((err) => console.error("[traffic] could not store a visit:", err.message));
  });

  app.get("/api/traffic/visits", requireOwner, wrapAsync(async (req, res) => {
    res.json(await storage.getSiteVisitsOverview(periodOf(req)));
  }));

  app.get("/api/traffic/search", requireOwner, wrapAsync(async (req, res) => {
    res.json(await getSearchOverview(periodOf(req), req.query.fresh === "1"));
  }));

  // Asks Google about each sitemap page in turn: slow the first time (about
  // twenty seconds), then served from memory for half a day.
  app.get("/api/traffic/index", requireOwner, wrapAsync(async (req, res) => {
    res.json(await getIndexStatus(req.query.fresh === "1"));
  }));

  const prune = () => storage.pruneSiteVisits().catch((err) => console.error("[traffic] prune failed:", err.message));
  prune();
  setInterval(prune, 24 * 60 * 60 * 1000).unref();
}
