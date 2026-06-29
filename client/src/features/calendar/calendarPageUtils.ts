export const MONTH_KEYS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
export const FULL_MONTH_KEYS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

export function formatDate(date: Date, tFn: (key: string) => string) {
  const day = String(date.getDate()).padStart(2, '0');
  const month = tFn(`months.short.${MONTH_KEYS[date.getMonth()]}`);
  const year = date.getFullYear();
  return `${day} ${month} - ${year}`;
}

export type ViewMode = "month" | "week" | "list";

export type ApptSortBy = "time_asc" | "time_desc" | "name_asc" | "name_desc" | "campaign_asc" | "campaign_desc" | "status_asc" | "status_desc";
export type ApptGroupBy = "date" | "campaign" | "status" | "none";
export type ApptFilterStatus = "no_show" | "rescheduled" | "confirmed";

export type DateGroupKey = "past" | "today" | "tomorrow" | "thisWeek" | "later";

export function getApptDateGroup(dateStr: string): DateGroupKey {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  const nextWeek = new Date(today); nextWeek.setDate(today.getDate() + 7);
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "later";
  const dDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  if (dDay.getTime() < today.getTime()) return "past";
  if (dDay.getTime() === today.getTime()) return "today";
  if (dDay.getTime() === tomorrow.getTime()) return "tomorrow";
  if (dDay.getTime() < nextWeek.getTime()) return "thisWeek";
  return "later";
}

export const DATE_GROUP_ORDER: DateGroupKey[] = ["today", "tomorrow", "thisWeek", "later", "past"];
