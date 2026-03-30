// Formatting utilities extracted from LeadsCardView.tsx

// ── Score color — blue (#4F46E5) at 0 → yellow (#FCB803) at 100 ───────────────
export function getScoreColor(score: number): string {
  const t = Math.max(0, Math.min(1, score / 100));
  const h = Math.round(229 - t * (229 - 45));
  const s = Math.round(100 - t * 3);
  const l = Math.round(66 - t * 16);
  return `hsl(${h}, ${s}%, ${l}%)`;
}

export function getScorePastelBg(score: number): string {
  const t = Math.max(0, Math.min(1, score / 100));
  const h = Math.round(229 - t * (229 - 45));
  return `hsl(${h}, 55%, 88%)`;
}

export function getScoreDarkText(score: number): string {
  const t = Math.max(0, Math.min(1, score / 100));
  const h = Math.round(229 - t * (229 - 45));
  return `hsl(${h}, 75%, 36%)`;
}

export function getGrade(score: number): string {
  if (score >= 90) return "A";
  if (score >= 75) return "B";
  if (score >= 60) return "C";
  if (score >= 45) return "D";
  return "F";
}

// ── Date group label ───────────────────────────────────────────────────────────
export function getDateGroupLabel(dateStr: string | null | undefined, t: (key: string) => string): string {
  if (!dateStr) return t("time.noActivity");
  try {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000);
    if (diff <= 0)  return t("time.today");
    if (diff === 1) return t("time.yesterday");
    if (diff < 7)   return t("time.thisWeek");
    if (diff < 30)  return t("time.thisMonth");
    if (diff < 90)  return t("time.last3Months");
    return t("time.older");
  } catch { return t("time.noActivity"); }
}

export function formatRelativeTime(dateStr: string | null | undefined, t: (key: string, opts?: Record<string, any>) => string): string {
  if (!dateStr) return "";
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return "";
    const diffMs = Date.now() - date.getTime();
    if (diffMs <= 0) return t("relativeTime.justNow");
    const diffMins = Math.floor(diffMs / 60_000);
    if (diffMins < 1) return t("relativeTime.justNow");
    if (diffMins < 60) return t("relativeTime.minutesAgo", { count: diffMins });
    const h = Math.floor(diffMs / 3_600_000);
    const diffDays = Math.floor(diffMs / 86_400_000);
    if (diffDays === 0) return t("relativeTime.hoursAgo", { count: h });
    if (diffDays === 1) return t("relativeTime.yesterday");
    if (diffDays < 7) return t("relativeTime.daysAgo", { count: diffDays });
    if (diffDays < 30) return t("relativeTime.weeksAgo", { count: Math.floor(diffDays / 7) });
    return t("relativeTime.monthsAgo", { count: Math.floor(diffDays / 30) });
  } catch { return ""; }
}

// ── Date helpers (matching ChatPanel) ─────────────────────────────────────────
export function getDateKey(ts: string | null | undefined): string {
  if (!ts) return "";
  const d = new Date(ts);
  if (isNaN(d.getTime())) return "";
  return d.toDateString();
}

export function formatDateLabel(ts: string, t: (key: string) => string): string {
  const d = new Date(ts);
  if (isNaN(d.getTime())) return "";
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.round((today.getTime() - msgDay.getTime()) / 86_400_000);
  if (diff === 0) return t("time.today");
  if (diff === 1) return t("time.yesterday");
  return d.toLocaleDateString([], { month: "long", day: "numeric" });
}

export function formatBubbleTime(ts: string | null | undefined, timezone?: string): string {
  if (!ts) return "";
  const d = new Date(ts);
  if (isNaN(d.getTime())) return "";
  const opts: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" };
  if (timezone) opts.timeZone = timezone;
  return d.toLocaleTimeString([], opts);
}

export function formatMsgTime(dateStr: string, timezone?: string): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    const timeOpts: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" };
    const dateOpts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
    if (timezone) { timeOpts.timeZone = timezone; dateOpts.timeZone = timezone; }
    const now = new Date();
    const dayFmt = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", ...(timezone ? { timeZone: timezone } : {}) });
    const sameDay = dayFmt.format(d) === dayFmt.format(now);
    if (sameDay) return d.toLocaleTimeString([], timeOpts);
    return d.toLocaleDateString([], dateOpts) + " · " + d.toLocaleTimeString([], timeOpts);
  } catch { return ""; }
}

export function formatTagTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString([], { month: "short", day: "numeric" }) + " · " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch { return "—"; }
}

/** Extract the hour (0–23) from a date in a given timezone, falls back to getHours(). */
export function getHoursInTimezone(date: Date, timezone?: string): number {
  if (!timezone) return date.getHours();
  try {
    const parts = new Intl.DateTimeFormat("en", { timeZone: timezone, hour: "numeric", hour12: false }).formatToParts(date);
    const h = parts.find((p) => p.type === "hour");
    return h ? Number(h.value) % 24 : date.getHours();
  } catch { return date.getHours(); }
}

/** Extract the minutes (0–59) from a date in a given timezone, falls back to getMinutes(). */
export function getMinutesInTimezone(date: Date, timezone?: string): number {
  if (!timezone) return date.getMinutes();
  try {
    const parts = new Intl.DateTimeFormat("en", { timeZone: timezone, minute: "numeric" }).formatToParts(date);
    const m = parts.find((p) => p.type === "minute");
    return m ? Number(m.value) : date.getMinutes();
  } catch { return date.getMinutes(); }
}

/** Return a "YYYY-MM-DD" string for the given date in a given timezone (for day grouping). */
export function toLocaleDateStringTz(date: Date, timezone?: string): string {
  if (!timezone) return new Intl.DateTimeFormat("en-CA").format(date);
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(date);
  } catch { return new Intl.DateTimeFormat("en-CA").format(date); }
}

/** Extract a short UTC offset label like "(UTC+2)" from an IANA timezone name. */
export function getUtcOffsetLabel(timezone: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en", { timeZone: timezone, timeZoneName: "shortOffset" }).formatToParts(new Date());
    const tzPart = parts.find((p) => p.type === "timeZoneName");
    return tzPart ? `(${tzPart.value})` : "";
  } catch { return ""; }
}

export function formatBookedDate(dateStr: string, timezone?: string): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    const dateOpts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
    const timeOpts: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" };
    if (timezone) { dateOpts.timeZone = timezone; timeOpts.timeZone = timezone; }
    const label = d.toLocaleDateString([], dateOpts) + " · " + d.toLocaleTimeString([], timeOpts);
    if (timezone) {
      const offset = getUtcOffsetLabel(timezone);
      return offset ? `${label} ${offset}` : label;
    }
    return label;
  } catch { return ""; }
}
