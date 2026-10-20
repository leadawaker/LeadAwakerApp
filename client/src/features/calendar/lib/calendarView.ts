export type CalendarView = "month" | "week" | "list";

export function isCalendarView(v: unknown): v is CalendarView {
  return v === "month" || v === "week" || v === "list";
}

/** Phones (below 768px) open on the list; everything wider opens on the week grid. */
export function defaultCalendarView(width: number): CalendarView {
  return width < 768 ? "list" : "week";
}

/** The list tab exists on phones only; a restored "list" becomes the week grid on wider screens. */
export function coerceCalendarView(view: CalendarView, isPhone: boolean): CalendarView {
  return view === "list" && !isPhone ? "week" : view;
}

/** Clients never group or sort by campaign (agency-only column). */
export function clientSafeCampaignKey<T extends string>(value: T, isAgencyUser: boolean, fallback: T): T {
  return !isAgencyUser && value.startsWith("campaign") ? fallback : value;
}
