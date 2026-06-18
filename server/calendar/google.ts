// Google Calendar adapter. Reuses the existing Google Cloud OAuth app
// (GOOGLE_CLIENT_ID/SECRET) — only the redirect URI + scope differ from Gmail.
import { google } from "googleapis";
import type { CalendarConnection } from "@shared/schema";
import { encryptSecret, decryptSecret } from "./crypto";
import { CalendarNotConfiguredError } from "./types";
import type { CalendarAdapter, BusySlot, CalendarEventInput } from "./types";

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
const REDIRECT_URI =
  process.env.GOOGLE_CALENDAR_REDIRECT_URI ||
  "https://app.leadawaker.com/api/calendar/oauth/google/callback";
const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
];

function oauthClient() {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new CalendarNotConfiguredError("Google OAuth is not configured (GOOGLE_CLIENT_ID/SECRET).");
  }
  return new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
}

/** Build an authed calendar client from a stored connection, auto-refreshing tokens. */
function clientFor(conn: CalendarConnection) {
  if (!conn.oauthTokensEncrypted) throw new CalendarNotConfiguredError("Google calendar not connected.");
  const tokens = decryptSecret(conn.oauthTokensEncrypted);
  const client = oauthClient();
  client.setCredentials(tokens);
  return google.calendar({ version: "v3", auth: client });
}

export const googleAdapter: CalendarAdapter = {
  id: "google",
  capabilities: { authType: "oauth", canPush: true, canFreeBusy: true },

  getAuthUrl(accountId: number) {
    return oauthClient().generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: SCOPES,
      state: String(accountId),
    });
  },

  async exchangeCode(code: string): Promise<Partial<CalendarConnection>> {
    const client = oauthClient();
    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: "v2", auth: client });
    const profile = await oauth2.userinfo.get();
    return {
      provider: "google",
      status: "connected",
      displayName: profile.data.email || "Google Calendar",
      calendarId: "primary",
      oauthTokensEncrypted: encryptSecret(tokens),
    };
  },

  async getFreeBusy(conn: CalendarConnection, timeMin: string, timeMax: string): Promise<BusySlot[]> {
    const cal = clientFor(conn);
    const res = await cal.freebusy.query({
      requestBody: {
        timeMin,
        timeMax,
        items: [{ id: conn.calendarId || "primary" }],
      },
    });
    const cals = res.data.calendars || {};
    const key = conn.calendarId || "primary";
    const busy = cals[key]?.busy || [];
    return busy
      .filter((b) => b.start && b.end)
      .map((b) => ({ start: b.start as string, end: b.end as string }));
  },

  async createEvent(conn: CalendarConnection, event: CalendarEventInput) {
    const cal = clientFor(conn);
    const res = await cal.events.insert({
      calendarId: conn.calendarId || "primary",
      requestBody: {
        summary: event.title,
        description: event.description,
        location: event.location,
        start: { dateTime: event.start, timeZone: event.timezone || conn.timezone || undefined },
        end: { dateTime: event.end, timeZone: event.timezone || conn.timezone || undefined },
        attendees: event.attendees?.map((email) => ({ email })),
      },
    });
    return { externalEventId: res.data.id || "" };
  },

  async deleteEvent(conn: CalendarConnection, externalEventId: string) {
    const cal = clientFor(conn);
    await cal.events.delete({ calendarId: conn.calendarId || "primary", eventId: externalEventId });
  },
};
