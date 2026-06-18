// iCal / ICS adapter — read-only public feed URL (no OAuth). Free/busy only;
// cannot push events. Minimal VEVENT parser, no external dependency.
import type { CalendarConnection } from "@shared/schema";
import { CalendarNotConfiguredError } from "./types";
import type { CalendarAdapter, BusySlot } from "./types";

/** Parse an ICS datetime (DTSTART/DTEND value) into an ISO string. */
function parseIcsDate(raw: string): string | null {
  // Forms: 20260617T133000Z | 20260617T133000 | 20260617 (date only)
  const m = raw.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/);
  if (!m) {
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }
  const [, y, mo, da, hh = "00", mi = "00", ss = "00", z] = m;
  const iso = `${y}-${mo}-${da}T${hh}:${mi}:${ss}${z ? "Z" : ""}`;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function parseVevents(ics: string): BusySlot[] {
  // Unfold folded lines (RFC 5545: continuation lines start with space/tab).
  const lines = ics.replace(/\r\n[ \t]/g, "").split(/\r?\n/);
  const slots: BusySlot[] = [];
  let cur: { start?: string; end?: string } | null = null;
  for (const line of lines) {
    if (line.startsWith("BEGIN:VEVENT")) cur = {};
    else if (line.startsWith("END:VEVENT")) {
      if (cur?.start && cur?.end) slots.push({ start: cur.start, end: cur.end });
      cur = null;
    } else if (cur) {
      const idx = line.indexOf(":");
      if (idx === -1) continue;
      const key = line.slice(0, idx).split(";")[0];
      const val = line.slice(idx + 1).trim();
      if (key === "DTSTART") cur.start = parseIcsDate(val) || undefined;
      else if (key === "DTEND") cur.end = parseIcsDate(val) || undefined;
    }
  }
  return slots;
}

export const icalAdapter: CalendarAdapter = {
  id: "ical",
  capabilities: { authType: "url", canPush: false, canFreeBusy: true },

  async getFreeBusy(conn: CalendarConnection, timeMin: string, timeMax: string): Promise<BusySlot[]> {
    if (!conn.icalUrl) throw new CalendarNotConfiguredError("iCal feed URL not set.");
    const res = await fetch(conn.icalUrl);
    if (!res.ok) throw new Error(`iCal feed returned ${res.status}`);
    const ics = await res.text();
    const min = new Date(timeMin).getTime();
    const max = new Date(timeMax).getTime();
    return parseVevents(ics).filter((s) => {
      const e = new Date(s.end).getTime();
      const st = new Date(s.start).getTime();
      return e >= min && st <= max; // overlaps the window
    });
  },

  async createEvent(): Promise<{ externalEventId: string }> {
    throw new CalendarNotConfiguredError("iCal feeds are read-only; cannot create events.");
  },

  async deleteEvent(): Promise<void> {
    // no-op: read-only
  },
};
