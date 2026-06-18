// Calendar service: provider registry + high-level operations used by routes.
import type { CalendarConnection } from "@shared/schema";
import { storage } from "../storage";
import type { CalendarAdapter, CalendarProviderId, BusySlot, CalendarEventInput } from "./types";
import { CalendarNotConfiguredError } from "./types";
import { googleAdapter } from "./google";
import { outlookAdapter } from "./outlook";
import { calcomAdapter } from "./calcom";
import { calendlyAdapter } from "./calendly";
import { icalAdapter } from "./ical";

export { CalendarNotConfiguredError };
export type { BusySlot, CalendarEventInput, CalendarProviderId, WorkingHours } from "./types";

const ADAPTERS: Record<CalendarProviderId, CalendarAdapter> = {
  google: googleAdapter,
  outlook: outlookAdapter,
  calcom: calcomAdapter,
  calendly: calendlyAdapter,
  ical: icalAdapter,
};

export function getAdapter(provider: string): CalendarAdapter {
  const a = ADAPTERS[provider as CalendarProviderId];
  if (!a) throw new CalendarNotConfiguredError(`Unknown calendar provider: ${provider}`);
  return a;
}

/** Capability metadata for every provider — safe to expose to the client. */
export const PROVIDER_META = Object.values(ADAPTERS).map((a) => ({
  id: a.id,
  authType: a.capabilities.authType,
  canPush: a.capabilities.canPush,
  canFreeBusy: a.capabilities.canFreeBusy,
}));

/** Merge overlapping/adjacent busy intervals into a sorted, non-overlapping list. */
export function mergeBusy(slots: BusySlot[]): BusySlot[] {
  const sorted = slots
    .filter((s) => s.start && s.end)
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  const out: BusySlot[] = [];
  for (const s of sorted) {
    const last = out[out.length - 1];
    if (last && new Date(s.start).getTime() <= new Date(last.end).getTime()) {
      if (new Date(s.end).getTime() > new Date(last.end).getTime()) last.end = s.end;
    } else {
      out.push({ ...s });
    }
  }
  return out;
}

/** Merged busy intervals across every connected calendar on an account. */
export async function getFreeBusyForAccount(accountId: number, timeMin: string, timeMax: string): Promise<BusySlot[]> {
  const allConns = (await storage.listCalendarConnections(accountId)).filter((c) => c.status === "connected");
  const conns = allConns.filter((c) => !!ADAPTERS[c.provider as CalendarProviderId]);
  const results = await Promise.allSettled(
    conns.map((c) => getAdapter(c.provider).getFreeBusy(c, timeMin, timeMax)),
  );
  const all: BusySlot[] = [];
  for (const r of results) if (r.status === "fulfilled") all.push(...r.value);
  return mergeBusy(all);
}

/** Working hours from the account's primary schedule (Cal.com-sourced; fallback 9-17). */
export async function getWorkingHoursForAccount(accountId: number): Promise<{ start: number; end: number }> {
  const allConns = (await storage.listCalendarConnections(accountId)).filter((c) => c.status === "connected");
  const conns = allConns.filter((c) => !!ADAPTERS[c.provider as CalendarProviderId]);
  for (const c of conns) {
    const adapter = getAdapter(c.provider);
    if (!adapter.getWorkingHours) continue;
    try {
      return await adapter.getWorkingHours(c);
    } catch {}
  }
  return { start: 9, end: 17 };
}

/** Push a booked call to the first push-capable connection (Google/Outlook). */
export async function pushBookingEvent(
  accountId: number,
  event: CalendarEventInput,
): Promise<{ provider: CalendarProviderId; externalEventId: string } | null> {
  const conns = (await storage.listCalendarConnections(accountId))
    .filter((c) => c.status === "connected" && !!ADAPTERS[c.provider as CalendarProviderId]);
  for (const c of conns) {
    const adapter = getAdapter(c.provider);
    if (!adapter.capabilities.canPush) continue;
    const { externalEventId } = await adapter.createEvent(c, event);
    return { provider: c.provider as CalendarProviderId, externalEventId };
  }
  return null;
}

export async function removeBookingEvent(accountId: number, provider: string, externalEventId: string): Promise<void> {
  const conn = (await storage.listCalendarConnections(accountId)).find((c) => c.provider === provider);
  if (!conn) return;
  await getAdapter(provider).deleteEvent(conn, externalEventId);
}

/** Strip secret fields before sending a connection to the client. */
export function publicConnection(c: CalendarConnection) {
  return {
    id: c.id,
    accountId: c.accountId,
    provider: c.provider,
    status: c.status,
    displayName: c.displayName,
    calendarId: c.calendarId,
    timezone: c.timezone,
    lastError: c.lastError,
    lastSyncAt: c.lastSyncAt,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}
