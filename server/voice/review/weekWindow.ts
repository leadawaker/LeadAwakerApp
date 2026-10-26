// Review weeks run Monday 00:00 to Monday 00:00 in Europe/Amsterdam and become due
// the following Monday at 07:00. No date library: offsets come from Intl.
const TZ = "Europe/Amsterdam";
const DAY_MS = 24 * 60 * 60 * 1000;
const dtf = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric",
  hour: "numeric", minute: "numeric", second: "numeric",
});

export interface ReviewWeek { weekKey: string; periodStart: Date; periodEnd: Date }

interface Wall { y: number; month: number; d: number; h: number; min: number; s: number }

function wallClock(at: Date): Wall {
  const get: Record<string, number> = {};
  for (const p of dtf.formatToParts(at)) if (p.type !== "literal") get[p.type] = Number(p.value);
  return { y: get.year, month: get.month, d: get.day, h: get.hour, min: get.minute, s: get.second };
}

// Amsterdam's offset from UTC at an instant, in ms (the wall clock read as if it were UTC, minus the instant).
function offsetMs(at: Date): number {
  const w = wallClock(at);
  return Date.UTC(w.y, w.month - 1, w.d, w.h, w.min, w.s) - Math.floor(at.getTime() / 1000) * 1000;
}

/** Wall clock in Europe/Amsterdam (month 1-12) to the UTC instant. DST safe. */
export function amsterdamToUtc(y: number, month: number, d: number, h: number): Date {
  const asUtc = Date.UTC(y, month - 1, d, h);
  const first = asUtc - offsetMs(new Date(asUtc));
  // The guess can sit on the other side of a clock change: look the offset up again at the result.
  const second = asUtc - offsetMs(new Date(first));
  return new Date(second);
}

const addDays = (y: number, month: number, d: number, n: number) => {
  const x = new Date(Date.UTC(y, month - 1, d + n));
  return { y: x.getUTCFullYear(), month: x.getUTCMonth() + 1, d: x.getUTCDate() };
};

/** ISO week (YYYY-Www) of a calendar date. */
function isoWeekKey(y: number, month: number, d: number): string {
  const t = Date.UTC(y, month - 1, d);
  const weekday = (new Date(t).getUTCDay() + 6) % 7; // Monday = 0
  const thursday = new Date(t + (3 - weekday) * DAY_MS);
  const isoYear = thursday.getUTCFullYear();
  const dayOfYear = Math.floor((thursday.getTime() - Date.UTC(isoYear, 0, 1)) / DAY_MS);
  return `${isoYear}-W${String(Math.floor(dayOfYear / 7) + 1).padStart(2, "0")}`;
}

/** The latest Monday to Sunday Amsterdam week whose following Monday 07:00 Amsterdam is at or before now. */
export function dueWeek(now: Date): ReviewWeek {
  const today = wallClock(now);
  const weekday = (new Date(Date.UTC(today.y, today.month - 1, today.d)).getUTCDay() + 6) % 7;
  let end = addDays(today.y, today.month, today.d, -weekday); // Monday on or before today
  if (amsterdamToUtc(end.y, end.month, end.d, 7).getTime() > now.getTime()) end = addDays(end.y, end.month, end.d, -7);
  const start = addDays(end.y, end.month, end.d, -7);
  return {
    weekKey: isoWeekKey(start.y, start.month, start.d),
    periodStart: amsterdamToUtc(start.y, start.month, start.d, 0),
    periodEnd: amsterdamToUtc(end.y, end.month, end.d, 0),
  };
}

/** A rolling window ending now. */
export function lastDays(now: Date, days = 7): { periodStart: Date; periodEnd: Date } {
  return { periodStart: new Date(now.getTime() - days * DAY_MS), periodEnd: new Date(now.getTime()) };
}

/** The longest period one review may cover, in days. */
export const MAX_RANGE_DAYS = 92;
const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseDay(s: unknown): { y: number; month: number; d: number } | null {
  const m = typeof s === "string" ? DAY_RE.exec(s) : null;
  if (!m) return null;
  const [y, month, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const check = new Date(Date.UTC(y, month - 1, d));
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== d) return null;
  return { y, month, d };
}

/**
 * A picked period of Amsterdam calendar days, both included ("2026-10-24" to "2026-10-26"):
 * from the first day's 00:00 to the 00:00 after the last day. The first day may not be after
 * today, and the period is at most MAX_RANGE_DAYS long.
 */
export function dayRange(from: unknown, to: unknown, now: Date):
  { ok: true; periodStart: Date; periodEnd: Date } | { ok: false; reason: "invalid" | "order" | "future" | "too_long" } {
  const a = parseDay(from);
  const b = parseDay(to);
  if (!a || !b) return { ok: false, reason: "invalid" };
  const days = (Date.UTC(b.y, b.month - 1, b.d) - Date.UTC(a.y, a.month - 1, a.d)) / DAY_MS + 1;
  if (days < 1) return { ok: false, reason: "order" };
  if (days > MAX_RANGE_DAYS) return { ok: false, reason: "too_long" };
  const periodStart = amsterdamToUtc(a.y, a.month, a.d, 0);
  if (periodStart.getTime() > now.getTime()) return { ok: false, reason: "future" };
  const end = addDays(b.y, b.month, b.d, 1);
  return { ok: true, periodStart, periodEnd: amsterdamToUtc(end.y, end.month, end.d, 0) };
}
