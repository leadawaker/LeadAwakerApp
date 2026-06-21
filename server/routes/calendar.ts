import type { Express } from "express";
import { storage } from "../storage";
import { requireAuth, requireAgency } from "../auth";
import { wrapAsync } from "./_helpers";
import { decryptSecret } from "../calendar/crypto";
import {
  getAdapter,
  getFreeBusyForAccount,
  getWorkingHoursForAccount,
  pushBookingEvent,
  removeBookingEvent,
  publicConnection,
  PROVIDER_META,
  CalendarNotConfiguredError,
} from "../calendar";
import { provisionCaldiyForAccount } from "../calendar/caldiy";

const OAUTH_PROVIDERS = new Set(["google", "outlook"]);

function frontendBase(req: import("express").Request): string {
  return process.env.FRONTEND_URL || `${req.protocol}://${req.get("host")}`;
}

export function registerCalendarRoutes(app: Express): void {
  // ─── Provider capabilities (for the connect UI) ───────────────────────────
  app.get("/api/calendar/providers", requireAuth, wrapAsync(async (_req, res) => {
    res.json(PROVIDER_META);
  }));

  // ─── List connections for an account ──────────────────────────────────────
  app.get("/api/calendar/connections", requireAuth, requireAgency, wrapAsync(async (req, res) => {
    const accountId = Number(req.query.accountId);
    if (!accountId) return res.status(400).json({ message: "accountId required" });
    const conns = await storage.listCalendarConnections(accountId);
    res.json(conns.map(publicConnection));
  }));

  // ─── OAuth: start (google | outlook) ──────────────────────────────────────
  app.get("/api/calendar/oauth/:provider/authorize", requireAuth, requireAgency, wrapAsync(async (req, res) => {
    const { provider } = req.params;
    const accountId = Number(req.query.accountId);
    if (!OAUTH_PROVIDERS.has(provider)) return res.status(400).json({ message: "Provider is not OAuth-based" });
    if (!accountId) return res.status(400).json({ message: "accountId required" });
    try {
      const url = getAdapter(provider).getAuthUrl!(accountId);
      res.redirect(url);
    } catch (err: any) {
      if (err instanceof CalendarNotConfiguredError) return res.status(501).json({ message: err.message });
      throw err;
    }
  }));

  // ─── OAuth: callback ──────────────────────────────────────────────────────
  // No auth guard: this is a browser redirect from the provider. accountId is
  // carried in `state`. Always redirects back to the Accounts integrations tab.
  app.get("/api/calendar/oauth/:provider/callback", wrapAsync(async (req, res) => {
    const { provider } = req.params;
    const base = frontendBase(req);
    const dest = (status: string, extra = "") =>
      `${base}/platform/accounts?calendar=${status}&provider=${provider}${extra}`;

    const error = req.query.error as string;
    if (error) return res.redirect(dest("error", `&reason=${encodeURIComponent(error)}`));

    const code = req.query.code as string;
    const accountId = Number(req.query.state);
    if (!code || !accountId) return res.redirect(dest("error", "&reason=missing_code"));

    try {
      const fields = await getAdapter(provider).exchangeCode!(code);
      await storage.upsertCalendarConnection({ accountId, ...fields } as any);
      res.redirect(dest("connected"));
    } catch (err: any) {
      console.error(`[Calendar OAuth ${provider}] callback error:`, err);
      res.redirect(dest("error"));
    }
  }));

  // ─── API-key / URL connect (calcom | calendly | ical) ─────────────────────
  app.post("/api/calendar/connect/:provider", requireAuth, requireAgency, wrapAsync(async (req, res) => {
    const { provider } = req.params;
    const { accountId, apiKey, icalUrl } = req.body || {};
    if (!accountId) return res.status(400).json({ message: "accountId required" });

    try {
      let fields: Record<string, unknown>;
      if (provider === "calcom") {
        if (!apiKey) return res.status(400).json({ message: "apiKey required" });
        const { connectCalcom } = await import("../calendar/calcom");
        fields = await connectCalcom(apiKey);
      } else if (provider === "calendly") {
        if (!apiKey) return res.status(400).json({ message: "apiKey required" });
        const { connectCalendly } = await import("../calendar/calendly");
        fields = await connectCalendly(apiKey);
      } else if (provider === "ical") {
        if (!icalUrl) return res.status(400).json({ message: "icalUrl required" });
        // Validate the feed is reachable + parseable before saving.
        const probe = await getAdapter("ical").getFreeBusy(
          { icalUrl } as any,
          new Date().toISOString(),
          new Date(Date.now() + 86400000).toISOString(),
        ).then(() => true).catch(() => false);
        if (!probe) return res.status(400).json({ message: "Could not read that iCal feed." });
        fields = { provider: "ical", status: "connected", displayName: "iCal feed", icalUrl };
      } else {
        return res.status(400).json({ message: "Unsupported provider for key/URL connect" });
      }
      const saved = await storage.upsertCalendarConnection({ accountId: Number(accountId), ...fields } as any);
      res.status(201).json(publicConnection(saved));
    } catch (err: any) {
      if (err instanceof CalendarNotConfiguredError) return res.status(400).json({ message: err.message });
      throw err;
    }
  }));

  // ─── Disconnect ───────────────────────────────────────────────────────────
  app.post("/api/calendar/disconnect", requireAuth, requireAgency, wrapAsync(async (req, res) => {
    const { accountId, provider } = req.body || {};
    if (!accountId || !provider) return res.status(400).json({ message: "accountId and provider required" });
    const ok = await storage.deleteCalendarConnection(Number(accountId), provider);
    res.json({ ok });
  }));

  // ─── Working hours from the account's primary Cal.com schedule ───────────
  app.get("/api/calendar/working-hours", requireAuth, wrapAsync(async (req, res) => {
    const accountId = Number(req.query.accountId);
    if (!accountId) return res.status(400).json({ message: "accountId required" });
    const wh = await getWorkingHoursForAccount(accountId);
    res.json(wh);
  }));

  // ─── Free/busy (merged across all connected calendars) ────────────────────
  app.get("/api/calendar/freebusy", requireAuth, wrapAsync(async (req, res) => {
    const accountId = Number(req.query.accountId);
    const timeMin = req.query.timeMin as string;
    const timeMax = req.query.timeMax as string;
    if (!accountId || !timeMin || !timeMax) {
      return res.status(400).json({ message: "accountId, timeMin, timeMax required" });
    }
    const busy = await getFreeBusyForAccount(accountId, timeMin, timeMax);
    res.json({ busy });
  }));

  // ─── Push a booked call as a calendar event ───────────────────────────────
  // Used by server write-sites and (via x-internal-key) the Python engine.
  app.post("/api/calendar/sync-booking", requireAuth, wrapAsync(async (req, res) => {
    const { accountId, title, description, start, end, timezone, attendees, location } = req.body || {};
    if (!accountId || !title || !start || !end) {
      return res.status(400).json({ message: "accountId, title, start, end required" });
    }
    try {
      const result = await pushBookingEvent(Number(accountId), { title, description, start, end, timezone, attendees, location });
      res.json({ pushed: !!result, ...result });
    } catch (err: any) {
      if (err instanceof CalendarNotConfiguredError) return res.json({ pushed: false, reason: err.message });
      throw err;
    }
  }));

  // ─── Cancel a previously-pushed event ─────────────────────────────────────
  app.post("/api/calendar/cancel-booking", requireAuth, wrapAsync(async (req, res) => {
    const { accountId, provider, externalEventId } = req.body || {};
    if (!accountId || !provider || !externalEventId) {
      return res.status(400).json({ message: "accountId, provider, externalEventId required" });
    }
    await removeBookingEvent(Number(accountId), provider, externalEventId);
    res.json({ ok: true });
  }));

  // ─── Cal.diy: provision a bookable user for an account's client ───────────
  app.post("/api/calendar/provision-booking", requireAuth, requireAgency, wrapAsync(async (req, res) => {
    const { accountId } = req.body || {};
    if (!accountId) return res.status(400).json({ message: "accountId required" });
    const account = await storage.getAccountById(Number(accountId));
    if (!account) return res.status(404).json({ message: "Account not found" });
    if (!account.ownerEmail) return res.status(400).json({ message: "Account has no owner email set" });

    const creds = await provisionCaldiyForAccount(Number(accountId));
    if (!creds) return res.status(500).json({ message: "Failed to provision booking page" });
    res.json(creds);
  }));

  // ─── Cal.diy: re-reveal stored credentials ─────────────────────────────────
  app.get("/api/calendar/caldiy-credentials", requireAuth, requireAgency, wrapAsync(async (req, res) => {
    const accountId = Number(req.query.accountId);
    if (!accountId) return res.status(400).json({ message: "accountId required" });
    const conn = await storage.getCalendarConnection(accountId, "caldiy");
    if (!conn || !conn.apiKeyEncrypted) return res.json(null);
    const password = decryptSecret<string>(conn.apiKeyEncrypted);
    res.json({ username: conn.externalId, password, bookingUrl: conn.displayName });
  }));
}
