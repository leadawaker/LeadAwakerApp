export function formatDuration(seconds: number | null): string {
  if (seconds == null) return "–";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
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
