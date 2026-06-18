// Calendly adapter — personal access token, read-only busy source. Calendly
// bookings count as busy time; we don't push events into Calendly.
import type { CalendarConnection } from "@shared/schema";
import { encryptSecret, decryptSecret } from "./crypto";
import { CalendarNotConfiguredError } from "./types";
import type { CalendarAdapter, BusySlot } from "./types";

const API = "https://api.calendly.com";

async function calendly(token: string, path: string) {
  const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Calendly ${path} failed: ${res.status}`);
  return res.json();
}

/** Validate a token + return the row fields to persist (called from the connect route). */
export async function connectCalendly(token: string): Promise<Partial<CalendarConnection>> {
  const me = (await calendly(token, "/users/me").catch(() => {
    throw new CalendarNotConfiguredError("Calendly token rejected.");
  })) as { resource?: { uri?: string; email?: string; name?: string } };
  return {
    provider: "calendly",
    status: "connected",
    displayName: me.resource?.email || me.resource?.name || "Calendly",
    externalId: me.resource?.uri || null,
    apiKeyEncrypted: encryptSecret(token),
  };
}

export const calendlyAdapter: CalendarAdapter = {
  id: "calendly",
  capabilities: { authType: "apikey", canPush: false, canFreeBusy: true },

  async getFreeBusy(conn: CalendarConnection, timeMin: string, timeMax: string): Promise<BusySlot[]> {
    if (!conn.apiKeyEncrypted || !conn.externalId) throw new CalendarNotConfiguredError("Calendly not connected.");
    const token = decryptSecret<string>(conn.apiKeyEncrypted);
    // Calendly caps busy-time queries at 7-day windows; chunk the range.
    const slots: BusySlot[] = [];
    let cursor = new Date(timeMin).getTime();
    const end = new Date(timeMax).getTime();
    const WEEK = 7 * 24 * 60 * 60 * 1000;
    while (cursor < end) {
      const chunkEnd = Math.min(cursor + WEEK, end);
      const q = new URLSearchParams({
        user: conn.externalId,
        start_time: new Date(cursor).toISOString(),
        end_time: new Date(chunkEnd).toISOString(),
      });
      const data = (await calendly(token, `/user_busy_times?${q.toString()}`)) as {
        collection?: Array<{ start_time: string; end_time: string }>;
      };
      for (const b of data.collection || []) {
        if (b.start_time && b.end_time) slots.push({ start: b.start_time, end: b.end_time });
      }
      cursor = chunkEnd;
    }
    return slots;
  },

  async createEvent(): Promise<{ externalEventId: string }> {
    throw new CalendarNotConfiguredError("Calendly events are created in Calendly; cannot push events.");
  },

  async deleteEvent(): Promise<void> {
    // no-op
  },
};
