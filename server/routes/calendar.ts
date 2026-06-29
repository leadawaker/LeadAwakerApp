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
import { provisionCaldiyForAccount, injectCalendarCredentialToCaldiy, injectCaldavCredentialToCaldiy, debouncedResyncCaldiySchedule } from "../calendar/caldiy";
import { createOAuthState, consumeOAuthState, saveSessionThen } from "../oauthState";

const OAUTH_PROVIDERS = new Set(["google", "outlook"]);
const calendarOAuthFlow = (provider: string) => `calendar:${provider}`;

function buildBlockTimestamps(date: string, startTime: string | undefined, endTime: string | undefined, allDay: boolean) {
  const startsAt = allDay ? new Date(`${date}T00:00:00`) : new Date(`${date}T${startTime || "00:00"}:00`);
  const endsAt   = allDay ? new Date(`${date}T23:59:59`) : new Date(`${date}T${endTime   || "00:00"}:00`);
  return { startsAt, endsAt };
}

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
      const state = createOAuthState(req, calendarOAuthFlow(provider), accountId);
      const url = getAdapter(provider).getAuthUrl!(state);
      saveSessionThen(req, () => res.redirect(url));
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
    const accountId = consumeOAuthState(req, calendarOAuthFlow(provider), req.query.state);
    if (!code) return res.redirect(dest("error", "&reason=missing_code"));
    if (!accountId) return res.redirect(dest("error", "&reason=invalid_state"));

    try {
      const fields = await getAdapter(provider).exchangeCode!(code);
      await storage.upsertCalendarConnection({ accountId, ...fields } as any);
      // Fire-and-forget: wire this calendar into the account's Cal.diy booking page
      // so availability + booking-event creation happen natively in Cal.com.
      void injectCalendarCredentialToCaldiy(accountId, provider);
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

  // ─── Apple / CalDAV connect (no OAuth; username + app-specific password) ─────
  app.post("/api/calendar/connect-caldav", requireAuth, requireAgency, wrapAsync(async (req, res) => {
    const { accountId, kind, username, password, url } = req.body || {};
    if (!accountId) return res.status(400).json({ message: "accountId required" });
    if (!username) return res.status(400).json({ message: "username required" });
    if (!password) return res.status(400).json({ message: "password required" });
    if (kind !== "apple" && kind !== "caldav") return res.status(400).json({ message: "kind must be 'apple' or 'caldav'" });
    if (kind === "caldav" && !url) return res.status(400).json({ message: "url required for caldav kind" });

    try {
      const result = await injectCaldavCredentialToCaldiy(Number(accountId), { kind, username, password, url });
      res.json({ ok: true, ...result });
    } catch (err: any) {
      res.status(400).json({ message: err.message || "Failed to connect Apple / CalDAV calendar" });
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

  // ─── Calendar Blocks: CRUD ────────────────────────────────────────────────

  app.get("/api/calendar/blocks", requireAuth, wrapAsync(async (req, res) => {
    const accountId = Number(req.query.accountId);
    if (!accountId) return res.status(400).json({ message: "accountId required" });
    const from = req.query.from ? new Date(req.query.from as string) : undefined;
    const to = req.query.to ? new Date(req.query.to as string) : undefined;
    const blocks = await storage.listCalendarBlocks(accountId, from, to);
    res.json(blocks);
  }));

  app.post("/api/calendar/blocks", requireAuth, wrapAsync(async (req, res) => {
    const { accountId, date, startTime, endTime, allDay, label } = req.body || {};
    if (!accountId || !date) return res.status(400).json({ message: "accountId and date required" });

    const { startsAt, endsAt } = buildBlockTimestamps(date, startTime, endTime, Boolean(allDay));
    if (isNaN(startsAt.getTime()) || isNaN(endsAt.getTime())) {
      return res.status(400).json({ message: "Invalid date/time values" });
    }

    const block = await storage.createCalendarBlock({
      accountId: Number(accountId),
      startsAt,
      endsAt,
      allDay: Boolean(allDay),
      label: label || null,
      createdBy: req.user?.id ?? null,
    });

    debouncedResyncCaldiySchedule(Number(accountId));

    res.status(201).json(block);
  }));

  app.patch("/api/calendar/blocks/:id", requireAuth, wrapAsync(async (req, res) => {
    const id = Number(req.params.id);
    const existing = await storage.getCalendarBlock(id);
    if (!existing) return res.status(404).json({ message: "Block not found" });
    const callerAccountId = req.user!.accountsId;
    if (callerAccountId !== 1 && existing.accountId !== callerAccountId) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const { date, startTime, endTime, allDay, label } = req.body || {};
    const patch: Parameters<typeof storage.updateCalendarBlock>[2] = {};
    if (label !== undefined) patch.label = label || null;
    if (allDay !== undefined) patch.allDay = Boolean(allDay);

    if (date) {
      const isAllDay = allDay !== undefined ? Boolean(allDay) : existing.allDay;
      const { startsAt, endsAt } = buildBlockTimestamps(date, startTime, endTime, isAllDay);
      if (isNaN(startsAt.getTime()) || isNaN(endsAt.getTime())) {
        return res.status(400).json({ message: "Invalid date/time values" });
      }
      patch.startsAt = startsAt;
      patch.endsAt = endsAt;
    }

    const block = await storage.updateCalendarBlock(id, existing.accountId, patch);
    if (!block) return res.status(404).json({ message: "Block not found" });

    debouncedResyncCaldiySchedule(block.accountId);
    res.json(block);
  }));

  app.delete("/api/calendar/blocks/:id", requireAuth, wrapAsync(async (req, res) => {
    const id = Number(req.params.id);
    // accountId is required so we can trigger a resync after deletion.
    const accountId = Number(req.query.accountId || req.body?.accountId || 0);
    if (!accountId) return res.status(400).json({ message: "accountId required" });

    const ok = await storage.deleteCalendarBlock(id, accountId);
    if (!ok) return res.status(404).json({ message: "Block not found" });

    debouncedResyncCaldiySchedule(accountId);

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
