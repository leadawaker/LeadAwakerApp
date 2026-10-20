/**
 * Date groups for the Calls and People lists, in the account's timezone:
 * Today, Yesterday, This week, Last week, then one group per month
 * ("October 2026"). Weeks start on Monday. Pure, so node:test can run it.
 */
export type RelativeGroup = "today" | "yesterday" | "thisWeek" | "lastWeek";

export interface DateGroup<T> {
  /** A RelativeGroup, or "YYYY-MM" for a month. */
  key: string;
  /** Month label in the UI locale; null for the relative groups (the caller translates those). */
  monthLabel: string | null;
  items: T[];
}

/** "YYYY-MM-DD" of the instant in `timeZone` (the browser's when not given). */
export function dayInZone(d: Date, timeZone?: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  } catch {
    return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  }
}

function dayNumber(ymd: string): number {
  const [y, m, d] = ymd.split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
}

/** Monday-based week index of a day number (1970-01-01 was a Thursday). */
function weekNumber(day: number): number {
  return Math.floor((day + 3) / 7);
}

export function dateGroupKey(iso: string, now: Date, timeZone?: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "unknown";
  const ymd = dayInZone(d, timeZone);
  const day = dayNumber(ymd);
  const today = dayNumber(dayInZone(now, timeZone));
  if (day >= today) return "today";
  if (day === today - 1) return "yesterday";
  const week = weekNumber(day);
  const thisWeek = weekNumber(today);
  if (week === thisWeek) return "thisWeek";
  if (week === thisWeek - 1) return "lastWeek";
  return ymd.slice(0, 7);
}

function monthLabel(key: string, locale: string): string {
  const [y, m] = key.split("-").map(Number);
  const label = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, 15)));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Groups in display order (newest first). Items keep their order inside a group. */
export function groupByDate<T>(items: T[], isoOf: (item: T) => string, opts: { now?: Date; timeZone?: string; locale?: string } = {}): DateGroup<T>[] {
  const now = opts.now ?? new Date();
  const order: string[] = [];
  const byKey = new Map<string, T[]>();
  for (const it of items) {
    const key = dateGroupKey(isoOf(it), now, opts.timeZone);
    if (!byKey.has(key)) {
      byKey.set(key, []);
      order.push(key);
    }
    byKey.get(key)!.push(it);
  }
  const rank = (k: string) => ({ today: 0, yesterday: 1, thisWeek: 2, lastWeek: 3 } as Record<string, number>)[k] ?? (k === "unknown" ? 1e9 : 10);
  order.sort((a, b) => rank(a) - rank(b) || (rank(a) === 10 ? b.localeCompare(a) : 0));
  return order.map((key) => ({
    key,
    monthLabel: /^\d{4}-\d{2}$/.test(key) ? monthLabel(key, opts.locale ?? "en") : null,
    items: byKey.get(key)!,
  }));
}
