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
