import type { Express, Request } from "express";
import { storage } from "../storage";
import { requireAuth, scopeToAccount } from "../auth";
import { wrapAsync } from "./_helpers";
import { resolveVoiceAccess } from "./voiceCallsAccess";
import { resolveHomeQuery, type HomeQuery } from "./homeScope";

// scopeToAccount rejects the internal-key bypass (no session user) and sets
// forcedAccountId for any user off account 1 and for view-as. resolveHomeQuery
// applies that lock first, so an Admin on a client account never gets the agency view.
const guards = [requireAuth, scopeToAccount];

function queryOf(req: Request): HomeQuery {
  const user = req.user!;
  const access = resolveVoiceAccess({
    role: user.role ?? "",
    accountsId: user.accountsId ?? null,
    impersonatedAccountId: req.session?.impersonation?.accountId ?? null,
    impersonatedRole: req.session?.impersonation?.role ?? null,
  });
  return resolveHomeQuery(access, req.query, (req as any).forcedAccountId);
}

export function registerHomeRoutes(app: Express): void {
  app.get("/api/home/services", ...guards, wrapAsync(async (req, res) => {
    res.json(await storage.getHomeServices(queryOf(req).accountId));
  }));
  app.get("/api/home/overview", ...guards, wrapAsync(async (req, res) => {
    res.json(await storage.getHomeOverview(queryOf(req)));
  }));
  app.get("/api/home/phone", ...guards, wrapAsync(async (req, res) => {
    res.json(await storage.getHomePhone(queryOf(req)));
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
  app.get("/api/home/reputation", ...guards, wrapAsync(async (req, res) => {
    res.json(await storage.getHomeReputation(queryOf(req)));
  }));
  app.get("/api/home/social", ...guards, wrapAsync(async (req, res) => {
    res.json(await storage.getHomeSocial(queryOf(req)));
  }));
}
