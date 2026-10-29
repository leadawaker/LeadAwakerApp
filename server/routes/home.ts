import type { Express, Request } from "express";
import { storage } from "../storage";
import { requireAuth, scopeToAccount } from "../auth";
import { wrapAsync } from "./_helpers";
import { resolveVoiceAccess } from "./voiceCallsAccess";
import { resolveHomeQuery, type HomeQuery } from "./homeScope";
import { ATTENTION_KINDS, type AttentionRef } from "../storage/homeAttention";

// scopeToAccount rejects the internal-key bypass (no session user) and sets
// forcedAccountId for any user off account 1 and for view-as. resolveHomeQuery
// applies that lock first, so an Admin on a client account never gets the agency view.
const guards = [requireAuth, scopeToAccount];

function accessOf(req: Request) {
  const user = req.user!;
  return resolveVoiceAccess({
    role: user.role ?? "",
    accountsId: user.accountsId ?? null,
    impersonatedAccountId: req.session?.impersonation?.accountId ?? null,
    impersonatedRole: req.session?.impersonation?.role ?? null,
  });
}

function queryOf(req: Request, source: Record<string, unknown> = req.query): HomeQuery {
  return resolveHomeQuery(accessOf(req), source, (req as any).forcedAccountId);
}

/** Needs attention refs from a request body: at most 1000, known kinds, short string ids. */
function refsOf(body: unknown): AttentionRef[] | null {
  const items = (body as { items?: unknown })?.items;
  if (!Array.isArray(items) || items.length === 0 || items.length > 1000) return null;
  const out: AttentionRef[] = [];
  for (const it of items) {
    const { kind, refId } = (it ?? {}) as { kind?: unknown; refId?: unknown };
    if (!(ATTENTION_KINDS as readonly unknown[]).includes(kind) || typeof refId !== "string" || !refId || refId.length > 128) return null;
    out.push({ kind: kind as AttentionRef["kind"], refId });
  }
  return out;
}

/** Writes need a known account for client users (the agency may act across accounts). */
function writeQueryOf(req: Request): HomeQuery | null {
  const q = queryOf(req, (req.body ?? {}) as Record<string, unknown>);
  return q.accountId === null && !accessOf(req).isAgency ? null : q;
}

export function registerHomeRoutes(app: Express): void {
  app.get("/api/home/services", ...guards, wrapAsync(async (req, res) => {
    res.json(await storage.getHomeServices(queryOf(req).accountId));
  }));
  app.get("/api/home/overview", ...guards, wrapAsync(async (req, res) => {
    res.json(await storage.getHomeOverview(queryOf(req)));
  }));
  // Needs attention: mark rows as handled (per account), and undo.
  app.post("/api/home/attention/dismiss", ...guards, wrapAsync(async (req, res) => {
    const q = writeQueryOf(req);
    if (!q) return res.status(403).json({ message: "Forbidden" });
    const all = req.body?.all === true;
    const items = all ? "all" as const : refsOf(req.body);
    if (!items) return res.status(400).json({ message: "Invalid items" });
    const userId = typeof req.user?.id === "number" ? req.user.id : null;
    res.json({ items: await storage.dismissAttention(q, items, userId) });
  }));
  app.post("/api/home/attention/restore", ...guards, wrapAsync(async (req, res) => {
    const q = writeQueryOf(req);
    if (!q) return res.status(403).json({ message: "Forbidden" });
    const items = refsOf(req.body);
    if (!items) return res.status(400).json({ message: "Invalid items" });
    res.json({ restored: await storage.restoreAttention(q, items) });
  }));
  app.get("/api/home/phone", ...guards, wrapAsync(async (req, res) => {
    const phone = await storage.getHomePhone(queryOf(req));
    // What calls cost us is the Owner's number only.
    if (!accessOf(req).isOwner) delete phone.cost;
    res.json(phone);
  }));
  app.get("/api/home/whatsapp", ...guards, wrapAsync(async (req, res) => {
    res.json(await storage.getHomeWhatsapp(queryOf(req)));
  }));
  app.get("/api/home/website", ...guards, wrapAsync(async (req, res) => {
    res.json(await storage.getHomeWebsite(queryOf(req)));
  }));
  app.get("/api/home/reactivation", ...guards, wrapAsync(async (req, res) => {
    res.json(await storage.getHomeReactivation(queryOf(req)));
  }));
  app.get("/api/home/reactivation/live", ...guards, wrapAsync(async (req, res) => {
    res.json(await storage.getHomeReactivationLive(queryOf(req)));
  }));
  app.get("/api/home/reputation", ...guards, wrapAsync(async (req, res) => {
    res.json(await storage.getHomeReputation(queryOf(req)));
  }));
  app.get("/api/home/social", ...guards, wrapAsync(async (req, res) => {
    res.json(await storage.getHomeSocial(queryOf(req)));
  }));
}
