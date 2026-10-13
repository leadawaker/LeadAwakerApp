import { HOME_PERIODS, type HomePeriod } from "./homeTypes";

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
const min = (a: string, b: string) => (a < b ? a : b);

export function periodDates(period: HomePeriod, today: string): PeriodDates {
  const tomorrow = addDays(today, 1);
  if (period === "7d" || period === "30d") {
    const n = period === "7d" ? 7 : 30;
    const from = addDays(tomorrow, -n);
    return { from, to: tomorrow, prevFrom: addDays(from, -n), prevTo: from };
  }
  if (period === "last_month") {
    const to = monthStart(today);
    const from = monthStart(today, -1);
    return { from, to, prevFrom: monthStart(today, -2), prevTo: from };
  }
  const from = monthStart(today);
  const prevFrom = monthStart(today, -1);
  const elapsed = Math.round((parse(tomorrow).getTime() - parse(from).getTime()) / 86_400_000);
  return { from, to: tomorrow, prevFrom, prevTo: min(addDays(prevFrom, elapsed), from) };
}

export function eachDay(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d < to; d = addDays(d, 1)) out.push(d);
  return out;
}
