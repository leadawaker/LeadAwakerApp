// Cal.com adapter — API key based, read-only busy source. Bookings made through
// Cal.com count as busy time; we don't push events into Cal.com (bookings
// originate there). Connect by pasting a Cal.com API key.
import type { CalendarConnection } from "@shared/schema";
import { encryptSecret, decryptSecret } from "./crypto";
import { CalendarNotConfiguredError } from "./types";
import type { CalendarAdapter, BusySlot, WorkingHours } from "./types";

const API = "https://api.cal.com/v1";

/** Validate a key + return the row fields to persist (called from the connect route). */
export async function connectCalcom(apiKey: string): Promise<Partial<CalendarConnection>> {
  const res = await fetch(`${API}/me?apiKey=${encodeURIComponent(apiKey)}`);
  if (!res.ok) throw new CalendarNotConfiguredError(`Cal.com key rejected (${res.status}).`);
  const json = (await res.json()) as { user?: { username?: string; email?: string } };
  return {
    provider: "calcom",
    status: "connected",
    displayName: json.user?.email || json.user?.username || "Cal.com",
    externalId: json.user?.username || null,
    apiKeyEncrypted: encryptSecret(apiKey),
  };
}

export const calcomAdapter: CalendarAdapter = {
  id: "calcom",
  capabilities: { authType: "apikey", canPush: false, canFreeBusy: true },

  async getFreeBusy(conn: CalendarConnection, timeMin: string, timeMax: string): Promise<BusySlot[]> {
    if (!conn.apiKeyEncrypted) throw new CalendarNotConfiguredError("Cal.com not connected.");
    const apiKey = decryptSecret<string>(conn.apiKeyEncrypted);
    const res = await fetch(`${API}/bookings?apiKey=${encodeURIComponent(apiKey)}`);
    if (!res.ok) throw new Error(`Cal.com bookings failed: ${res.status}`);
    const json = (await res.json()) as { bookings?: Array<{ startTime: string; endTime: string; status?: string }> };
    const min = new Date(timeMin).getTime();
    const max = new Date(timeMax).getTime();
    return (json.bookings || [])
      .filter((b) => b.status !== "cancelled" && b.startTime && b.endTime)
      .map((b) => ({ start: new Date(b.startTime).toISOString(), end: new Date(b.endTime).toISOString() }))
      .filter((s) => new Date(s.end).getTime() >= min && new Date(s.start).getTime() <= max);
  },

  async getWorkingHours(conn: CalendarConnection): Promise<WorkingHours> {
    if (!conn.apiKeyEncrypted) return { start: 9, end: 17 };
    const apiKey = decryptSecret<string>(conn.apiKeyEncrypted);
    try {
      const res = await fetch(`${API}/schedules?apiKey=${encodeURIComponent(apiKey)}`);
      if (!res.ok) return { start: 9, end: 17 };
      const json = (await res.json()) as { schedules?: Array<{ availability?: Array<{ startTime: string; endTime: string }> }> };
      const schedules = json.schedules || [];
      if (!schedules.length) return { start: 9, end: 17 };
      const slots = schedules[0].availability || [];
      if (!slots.length) return { start: 9, end: 17 };
      let earliest = 24, latest = 0;
      for (const s of slots) {
        const sh = parseInt(s.startTime.split(":")[0], 10);
        const eh = parseInt(s.endTime.split(":")[0], 10);
        if (!isNaN(sh) && sh < earliest) earliest = sh;
        if (!isNaN(eh) && eh > latest) latest = eh;
      }
      if (earliest >= latest) return { start: 9, end: 17 };
      return { start: earliest, end: latest };
    } catch {
      return { start: 9, end: 17 };
    }
  },

  async createEvent(): Promise<{ externalEventId: string }> {
    throw new CalendarNotConfiguredError("Cal.com bookings are created in Cal.com; cannot push events.");
  },

  async deleteEvent(): Promise<void> {
    // no-op
  },
};
