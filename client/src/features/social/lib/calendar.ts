// Pure date grids for the Socials calendar. Days are "YYYY-MM-DD" strings in the account's zone, so a
// post at 23:30 in São Paulo lands on the right day whatever the browser's zone. Weeks start on Monday.
import { toLocalDateTime } from "./posts";

export interface CalendarDay { date: string; inMonth: boolean }

const pad = (n: number) => String(n).padStart(2, "0");
export const isoDay = (y: number, m0: number, d: number) => `${y}-${pad(m0 + 1)}-${pad(d)}`;

/** Day arithmetic on the calendar date only (UTC noon avoids any DST edge). */
export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d, 12) + n * 86_400_000);
  return isoDay(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate());
}

/** 0 = Monday ... 6 = Sunday. */
function mondayIndex(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return (new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay() + 6) % 7;
}

export function startOfWeek(date: string): string {
  return addDays(date, -mondayIndex(date));
}

/** Whole weeks (Monday to Sunday) covering the month. */
export function monthGrid(year: number, month0: number): CalendarDay[][] {
  const first = isoDay(year, month0, 1);
  const daysInMonth = new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
  const last = isoDay(year, month0, daysInMonth);
  const month = first.slice(0, 7);
  const weeks: CalendarDay[][] = [];
  let day = startOfWeek(first);
  while (day <= last) {
    const week: CalendarDay[] = [];
    for (let i = 0; i < 7; i++, day = addDays(day, 1)) week.push({ date: day, inMonth: day.slice(0, 7) === month });
    weeks.push(week);
  }
  return weeks;
}

export function weekDays(anyDay: string): string[] {
  const start = startOfWeek(anyDay);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** Items grouped by their day in the account's zone, each day sorted by time. */
export function byDay<T extends { scheduledAt: string }>(items: T[], timeZone: string): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const it of [...items].sort((a, b) => Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt))) {
    const { date } = toLocalDateTime(it.scheduledAt, timeZone);
    out.set(date, [...(out.get(date) ?? []), it]);
  }
  return out;
}

export function shiftMonth(year: number, month0: number, delta: number): { year: number; month0: number } {
  const total = year * 12 + month0 + delta;
  return { year: Math.floor(total / 12), month0: ((total % 12) + 12) % 12 };
}
