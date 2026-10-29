import { HOME_PERIODS, type HomeBucket, type HomePeriod } from "./homeTypes";

/**
 * Local dates (YYYY-MM-DD), end exclusive. With no earlier period to compare
 * with ("all"), prevFrom equals prevTo: an empty range.
 */
export interface PeriodDates { from: string; to: string; prevFrom: string; prevTo: string }

export function isHomePeriod(v: unknown): v is HomePeriod {
  return typeof v === "string" && (HOME_PERIODS as readonly string[]).includes(v);
}

export function todayIn(tz: string, now: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

// Dates are handled as UTC midnights so no local timezone or DST shift can move them.
const parse = (d: string) => new Date(`${d}T00:00:00Z`);
const fmt = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: string, n: number) => { const x = parse(d); x.setUTCDate(x.getUTCDate() + n); return fmt(x); };
const monthStart = (d: string, offset = 0) => {
  const x = parse(d);
  return fmt(new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth() + offset, 1)));
};
const yearStart = (d: string, offset = 0) => fmt(new Date(Date.UTC(parse(d).getUTCFullYear() + offset, 0, 1)));
/** Monday of the date's week. */
const weekStart = (d: string) => addDays(d, -((parse(d).getUTCDay() + 6) % 7));
const daysBetween = (a: string, b: string) => Math.round((parse(b).getTime() - parse(a).getTime()) / 86_400_000);
const min = (a: string, b: string) => (a < b ? a : b);

/**
 * The period up to and including today, compared with the same stretch of the
 * period before (the first 12 days of last month on the 12th). `allFrom` is
 * where "all" starts (the account's first data); it falls back to this month.
 * "today" compares with all of yesterday here; rangeOf (server/storage/homeSql.ts)
 * cuts yesterday at the current time of day, which a date string cannot hold.
 */
export function periodDates(period: HomePeriod, today: string, allFrom?: string | null): PeriodDates {
  const tomorrow = addDays(today, 1);
  if (period === "all") {
    const from = allFrom && allFrom <= today ? allFrom : monthStart(today);
    return { from, to: tomorrow, prevFrom: from, prevTo: from };
  }
  if (period === "today") return { from: today, to: tomorrow, prevFrom: addDays(today, -1), prevTo: today };
  const from = period === "year" ? yearStart(today) : period === "week" ? weekStart(today) : monthStart(today);
  const prevFrom = period === "year" ? yearStart(today, -1) : period === "week" ? addDays(from, -7) : monthStart(today, -1);
  return { from, to: tomorrow, prevFrom, prevTo: min(addDays(prevFrom, daysBetween(from, tomorrow)), from) };
}

export function bucketOf(period: HomePeriod): HomeBucket {
  return period === "all" || period === "year" ? "month" : period === "today" ? "hour" : "day";
}

export function eachDay(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d < to; d = addDays(d, 1)) out.push(d);
  return out;
}

/** Every bucket key in [from, to): YYYY-MM, YYYY-MM-DD or YYYY-MM-DD HH (see DayPoint). */
export function eachBucket(from: string, to: string, bucket: HomeBucket): string[] {
  if (bucket === "day") return eachDay(from, to);
  if (bucket === "hour") {
    return eachDay(from, to).flatMap((d) => Array.from({ length: 24 }, (_, h) => `${d} ${String(h).padStart(2, "0")}`));
  }
  const out: string[] = [];
  for (let m = monthStart(from); m < to; m = monthStart(m, 1)) out.push(m.slice(0, 7));
  return out;
}
