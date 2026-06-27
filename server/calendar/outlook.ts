// Microsoft Outlook / Graph adapter. Needs a separate Azure app registration:
//   MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET, MICROSOFT_CALENDAR_REDIRECT_URI
// Errors with CalendarNotConfiguredError until those are provisioned.
import type { CalendarConnection } from "@shared/schema";
import { encryptSecret, decryptSecret } from "./crypto";
import { CalendarNotConfiguredError } from "./types";
import type { CalendarAdapter, BusySlot, CalendarEventInput } from "./types";

const CLIENT_ID = process.env.MICROSOFT_CLIENT_ID || "";
const CLIENT_SECRET = process.env.MICROSOFT_CLIENT_SECRET || "";
const REDIRECT_URI =
  process.env.MICROSOFT_CALENDAR_REDIRECT_URI ||
  "https://app.leadawaker.com/api/calendar/oauth/outlook/callback";
const AUTHORITY = "https://login.microsoftonline.com/common/oauth2/v2.0";
const SCOPES = "offline_access User.Read Calendars.ReadWrite";
const GRAPH = "https://graph.microsoft.com/v1.0";

interface OutlookTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number; // epoch ms
}

function requireConfig() {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new CalendarNotConfiguredError("Outlook OAuth is not configured (MICROSOFT_CLIENT_ID/SECRET).");
  }
}

async function tokenRequest(params: Record<string, string>): Promise<OutlookTokens> {
  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    redirect_uri: REDIRECT_URI,
    ...params,
  });
  const res = await fetch(`${AUTHORITY}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`Outlook token request failed: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { access_token: string; refresh_token: string; expires_in: number };
  return {
    access_token: json.access_token,
    refresh_token: json.refresh_token,
    expires_at: Date.now() + (json.expires_in - 60) * 1000,
  };
}

/** Returns a valid access token, refreshing + re-persisting if expired. */
async function accessTokenFor(conn: CalendarConnection): Promise<string> {
  if (!conn.oauthTokensEncrypted) throw new CalendarNotConfiguredError("Outlook calendar not connected.");
  requireConfig();
  let tokens = decryptSecret<OutlookTokens>(conn.oauthTokensEncrypted);
  if (Date.now() >= tokens.expires_at) {
    const refreshed = await tokenRequest({ grant_type: "refresh_token", refresh_token: tokens.refresh_token, scope: SCOPES });
    // Microsoft may not return a new refresh_token; keep the old one if so.
    tokens = { ...refreshed, refresh_token: refreshed.refresh_token || tokens.refresh_token };
    // Lazy import to avoid a cycle with the storage barrel.
    const { storage } = await import("../storage");
    await storage.upsertCalendarConnection({ ...conn, oauthTokensEncrypted: encryptSecret(tokens) } as any);
  }
  return tokens.access_token;
}

async function graph(token: string, path: string, init?: RequestInit) {
  const res = await fetch(`${GRAPH}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  if (!res.ok) throw new Error(`Graph ${path} failed: ${res.status} ${await res.text()}`);
  return res.status === 204 ? null : await res.json();
}

export const outlookAdapter: CalendarAdapter = {
  id: "outlook",
  capabilities: { authType: "oauth", canPush: true, canFreeBusy: true },

  getAuthUrl(state: string) {
    requireConfig();
    const p = new URLSearchParams({
      client_id: CLIENT_ID,
      response_type: "code",
      redirect_uri: REDIRECT_URI,
      response_mode: "query",
      scope: SCOPES,
      state,
    });
    return `${AUTHORITY}/authorize?${p.toString()}`;
  },

  async exchangeCode(code: string): Promise<Partial<CalendarConnection>> {
    const tokens = await tokenRequest({ grant_type: "authorization_code", code, scope: SCOPES });
    const me = (await graph(tokens.access_token, "/me")) as { mail?: string; userPrincipalName?: string };
    return {
      provider: "outlook",
      status: "connected",
      displayName: me.mail || me.userPrincipalName || "Outlook Calendar",
      calendarId: "primary",
      oauthTokensEncrypted: encryptSecret(tokens),
    };
  },

  async getFreeBusy(conn: CalendarConnection, timeMin: string, timeMax: string): Promise<BusySlot[]> {
    const token = await accessTokenFor(conn);
    const data = (await graph(
      token,
      `/me/calendarView?startDateTime=${encodeURIComponent(timeMin)}&endDateTime=${encodeURIComponent(timeMax)}&$select=start,end&$top=200`,
    )) as { value: Array<{ start: { dateTime: string }; end: { dateTime: string } }> };
    return (data.value || [])
      .filter((e) => e.start?.dateTime && e.end?.dateTime)
      .map((e) => ({ start: new Date(e.start.dateTime + "Z").toISOString(), end: new Date(e.end.dateTime + "Z").toISOString() }));
  },

  async createEvent(conn: CalendarConnection, event: CalendarEventInput) {
    const token = await accessTokenFor(conn);
    const created = (await graph(token, "/me/events", {
      method: "POST",
      body: JSON.stringify({
        subject: event.title,
        body: event.description ? { contentType: "text", content: event.description } : undefined,
        location: event.location ? { displayName: event.location } : undefined,
        start: { dateTime: event.start, timeZone: event.timezone || conn.timezone || "UTC" },
        end: { dateTime: event.end, timeZone: event.timezone || conn.timezone || "UTC" },
        attendees: event.attendees?.map((email) => ({ emailAddress: { address: email }, type: "required" })),
      }),
    })) as { id: string };
    return { externalEventId: created.id };
  },

  async deleteEvent(conn: CalendarConnection, externalEventId: string) {
    const token = await accessTokenFor(conn);
    await graph(token, `/me/events/${externalEventId}`, { method: "DELETE" });
  },
};
