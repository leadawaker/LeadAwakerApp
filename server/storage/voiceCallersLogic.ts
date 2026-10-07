/**
 * Pure rules behind the Voice calls Callers view: which outcome represents a
 * caller, whether a call back now lands outside the account's opening hours,
 * and whether the lead asked not to be contacted. No DB, so it is unit tested.
 */
import type { VoiceOutcome } from "@shared/voiceOutcome";

const RANK: Record<VoiceOutcome, number> = {
  booked: 5,
  transferred: 4,
  callback: 3,
  other: 2,
  hung_up: 1,
};

export function rankOutcome(o: VoiceOutcome): number {
  return RANK[o] ?? 0;
}

/** The best thing any call achieved for this caller; no calls gives "other". */
export function bestOutcome(list: VoiceOutcome[]): VoiceOutcome {
  let best: VoiceOutcome | null = null;
  for (const o of list) if (best === null || rankOutcome(o) > rankOutcome(best)) best = o;
  return best ?? "other";
}

/** "HH:MM" or "HH:MM:SS" (Postgres `time`) to minutes after midnight, else null. */
function parseMinutes(v: unknown): number | null {
  if (typeof v !== "string") return null;
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?$/.exec(v.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/**
 * `open_days` is jsonb, live rows hold weekday numbers with 0 = Sunday.
 * null/undefined means "not set" (hours alone decide). Anything else that is not
 * a non-empty list of valid days is unknown, signalled by "invalid".
 */
function parseDays(v: unknown): Set<number> | null | "invalid" {
  if (v === null || v === undefined) return null;
  if (!Array.isArray(v)) return "invalid";
  const days = new Set<number>();
  for (const d of v) {
    const n = typeof d === "number" ? d : typeof d === "string" && d.trim() !== "" ? Number(d) : NaN;
    if (Number.isInteger(n) && n >= 0 && n <= 6) days.add(n);
  }
  return days.size ? days : "invalid";
}

const WEEKDAY: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

function localClock(now: Date, timeZone: string): { day: number; minutes: number } | null {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(now);
    const get = (t: string) => parts.find((p) => p.type === t)?.value;
    const day = WEEKDAY[get("weekday") ?? ""];
    const h = Number(get("hour"));
    const m = Number(get("minute"));
    if (day === undefined || !Number.isFinite(h) || !Number.isFinite(m)) return null;
    return { day, minutes: (h % 24) * 60 + m };
  } catch {
    return null; // unknown timezone
  }
}

/**
 * True only when the account's hours are known and `now` falls outside them.
 * Unknown or unparseable hours give false: no warning beats a false warning.
 * The window is [start, end); end before start wraps past midnight.
 */
export function isOutOfHours(
  hours: { start: unknown; end: unknown; openDays: unknown; timezone: unknown },
  now: Date,
): boolean {
  if (Number.isNaN(now.getTime())) return false;
  const start = parseMinutes(hours.start);
  const end = parseMinutes(hours.end);
  if (start === null || end === null || start === end) return false;
  if (typeof hours.timezone !== "string" || !hours.timezone.trim()) return false;
  const days = parseDays(hours.openDays);
  if (days === "invalid") return false;
  const clock = localClock(now, hours.timezone.trim());
  if (!clock) return false;
  if (days && !days.has(clock.day)) return true;
  const t = clock.minutes;
  const open = start < end ? t >= start && t < end : t >= start || t < end;
  return !open;
}

/** DND = opted out, or a DNC reason on file, or the pipeline status DND. */
export function isDnd(lead: { optedOut: unknown; dncReason: unknown; conversionStatus: unknown }): boolean {
  if (lead.optedOut === true) return true;
  if (typeof lead.dncReason === "string" && lead.dncReason.trim() !== "") return true;
  return typeof lead.conversionStatus === "string" && lead.conversionStatus.trim().toUpperCase() === "DND";
}
