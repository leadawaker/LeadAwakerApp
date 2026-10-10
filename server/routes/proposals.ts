import type { Express, Request, Response } from "express";
import fs from "fs";
import path from "path";
import { storage } from "../storage";
import { createAndDispatchNotification } from "../notification-dispatcher";

// ─── Private proposal pages (public, unlisted) ───────────────────────────
// leadawaker.com/p/<token>/ → Vercel forwards /p/* here. Each proposal is
// built by script/proposal/build.cjs into proposals/<slug>/dist/ (gitignored,
// lives on the Pi) and found by the token in proposals/<slug>/proposal.json.
// Opening the page notifies the agency users, except previews (?preview=1),
// logged-in users, and link-preview bots (WhatsApp unfurls the link when it's sent).

const ROOT = path.resolve("proposals");
const AGENCY_ACCOUNT_ID = 1;
const NOTIFICATION_TYPE = "proposal_view";
const BOT = /bot|crawl|spider|preview|facebookexternalhit|whatsapp|telegram|slack|discord|skype|curl|wget|python|headless/i;
const QUIET_MS = 30 * 60 * 1000; // one notification per visit, not per reload

type Meta = { slug: string; title: string; company: string; contact?: string; token: string; crmLink?: string };

function findByToken(token: string): Meta | null {
  if (!/^[A-Za-z0-9_-]{8,40}$/.test(token) || !fs.existsSync(ROOT)) return null;
  for (const slug of fs.readdirSync(ROOT)) {
    try {
      const meta = JSON.parse(fs.readFileSync(path.join(ROOT, slug, "proposal.json"), "utf8"));
      if (meta.token === token) return { ...meta, slug };
    } catch {
      // not a proposal folder
    }
  }
  return null;
}

const lastNotified = new Map<string, number>();

async function trackView(req: Request, meta: Meta): Promise<void> {
  const ua = String(req.headers["user-agent"] || "");
  const preview = "preview" in req.query || (req.isAuthenticated?.() ?? false) || BOT.test(ua) || !ua;
  const ip = String(req.headers["x-forwarded-for"] || req.ip || "").split(",")[0].trim();
  const log = path.join(ROOT, meta.slug, "views.jsonl");
  fs.appendFileSync(log, JSON.stringify({ at: new Date().toISOString(), ip, ua, preview }) + "\n");
  if (preview) return;

  const now = Date.now();
  if (now - (lastNotified.get(meta.token) || 0) < QUIET_MS) return;
  lastNotified.set(meta.token, now);

  const views = fs.readFileSync(log, "utf8").split("\n").filter(l => l.includes('"preview":false')).length;
  const who = meta.contact || meta.company;
  const users = (await storage.getAppUsers()).filter((u: any) => u.accountsId === AGENCY_ACCOUNT_ID);
  for (const user of users) {
    await createAndDispatchNotification({
      type: NOTIFICATION_TYPE,
      title: views === 1 ? `${who} opened your proposal` : `${who} is back on your proposal`,
      body: `${meta.title} · visit ${views}`,
      userId: user.id!,
      accountId: AGENCY_ACCOUNT_ID,
      read: false,
      link: meta.crmLink || "/platform/prospects",
    } as any).catch((err: any) => console.error(`[proposals] notify user ${user.id} failed:`, err.message));
  }
}

export function registerProposalRoutes(app: Express) {
  // The page carries <base href="/p/<token>/">, so it works with or without the trailing slash
  // (Vercel may drop it when forwarding).
  app.get(["/p/:token", "/p/:token/*"], (req: Request, res: Response) => {
    res.set("x-robots-tag", "noindex, nofollow");
    const meta = findByToken(req.params.token);
    if (!meta) return res.status(404).send("This link does not exist.");
    const dist = path.join(ROOT, meta.slug, "dist");
    const rel = (req.params as any)[0] || "index.html";
    const file = path.resolve(dist, rel);
    if (!file.startsWith(dist + path.sep) || !fs.existsSync(file)) return res.status(404).send("Not found.");
    if (rel === "index.html") {
      res.set("cache-control", "no-store");
      trackView(req, meta).catch(err => console.error("[proposals] track failed:", err.message));
    }
    res.sendFile(file);
  });
}
