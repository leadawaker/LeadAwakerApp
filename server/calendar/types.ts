// Provider-agnostic calendar contract. Each provider (google, outlook, calcom,
// calendly, ical) implements CalendarAdapter; the registry in index.ts dispatches.
import type { CalendarConnection } from "@shared/schema";

export type CalendarProviderId = "google" | "outlook" | "calcom" | "calendly" | "ical";

export type AuthType = "oauth" | "apikey" | "url";

/** A busy interval on the connected calendar. */
export interface BusySlot {
  start: string; // ISO
  end: string;   // ISO
}

/** Business hours as decimal hours (e.g. { start: 9, end: 17 }). */
export interface WorkingHours {
  start: number;
  end: number;
}

export interface CalendarEventInput {
  title: string;
  description?: string;
  start: string;       // ISO
  end: string;         // ISO
  timezone?: string;
  attendees?: string[]; // emails
  location?: string;
}

export interface AdapterCapabilities {
  authType: AuthType;
  /** Can create/delete events (push booked calls). iCal feeds are read-only. */
  canPush: boolean;
  /** Can report busy intervals / free windows. */
  canFreeBusy: boolean;
}

export interface CalendarAdapter {
  id: CalendarProviderId;
  capabilities: AdapterCapabilities;

  /** OAuth providers: build the consent URL (state carries accountId). */
  getAuthUrl?(accountId: number): string;
  /** OAuth providers: exchange the code, returning the row fields to persist. */
  exchangeCode?(code: string): Promise<Partial<CalendarConnection>>;

  /** Busy intervals between timeMin/timeMax (ISO). */
  getFreeBusy(conn: CalendarConnection, timeMin: string, timeMax: string): Promise<BusySlot[]>;

  /** Working hours from the account's schedule (decimal hours). Optional — not all providers support this. */
  getWorkingHours?(conn: CalendarConnection): Promise<WorkingHours>;

  /** Create an event; returns the provider's event id. Throws if !canPush. */
  createEvent(conn: CalendarConnection, event: CalendarEventInput): Promise<{ externalEventId: string }>;
  /** Delete a previously created event. No-op if !canPush. */
  deleteEvent(conn: CalendarConnection, externalEventId: string): Promise<void>;
}

export class CalendarNotConfiguredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CalendarNotConfiguredError";
  }
}
