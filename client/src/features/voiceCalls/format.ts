export function formatDuration(seconds: number | null): string {
  if (seconds == null) return "–";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * List-row length: "4s" under a minute, "m:ss" from there ("1:00", "12:34"), no unit suffix.
 * `sec` is the locale's seconds pattern (`duration.sec`).
 */
export function formatRowDuration(seconds: number, sec: (s: number) => string): string {
  const total = Math.max(0, Math.round(seconds));
  return total < 60 ? sec(total) : formatDuration(total);
}

export function formatDateTime(iso: string, locale: string): string {
  return new Date(iso).toLocaleString(locale, {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

export function formatBooked(iso: string, locale: string): string {
  return new Date(iso).toLocaleString(locale, {
    weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit",
  });
}

export function formatClock(iso: string | null, locale: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
}

export function isToday(iso: string): boolean {
  return new Date(iso).toDateString() === new Date().toDateString();
}

/** List-row stamp: clock time for today's calls, short date otherwise. */
export function formatListTime(iso: string, locale: string): string {
  return isToday(iso)
    ? formatClock(iso, locale)
    : new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "short" });
}

/** "1m 40s" / "40s", with the units from the locale (`duration.*` keys). */
export function formatDurationUnits(seconds: number | null, t: (key: string, opts?: Record<string, unknown>) => string): string {
  if (seconds == null) return "–";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return m > 0 ? t("duration.minSec", { m, s }) : t("duration.sec", { s });
}
