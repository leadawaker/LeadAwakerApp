// calendarDesign.ts — shared types, design tokens, and helpers for the
// wine/neumorphic desktop Calendar redesign (ports the Claude-design calendar).
// The visual language lives in styles/design-system.css (--wine, --bg-2, --r-card,
// --sh-raised-large, --serif, --mono, etc.) which is loaded globally.

import type { CSSProperties } from "react";

// ── Appointment type (shared with pages/Calendar.tsx) ────────────────────────
export type Appointment = {
  id: number;
  lead_name: string;
  campaign_name: string | null;
  date: string;
  formattedDate: string;
  time: string;
  hour: number;
  minutes: number;
  status: string | undefined;
  calendar_link: string;
  no_show: boolean;
  re_scheduled_count: number;
  raw_booked_call_date: string;
  raw_previous_booked_call_date: string | null;
  phone: string | null;
  email: string | null;
  callDurationMinutes: number;
  rawLead: Record<string, any>;
  timezone?: string;
};

// ── Shared card chrome ───────────────────────────────────────────────────────
export const HEADER_H = 60; // aligned column-header height across the 3 cards

export const CARD_STYLE: CSSProperties = {
  background: "var(--card)",
  borderRadius: "var(--r-card)",
  boxShadow: "var(--sh-raised-large)",
  display: "flex",
  flexDirection: "column",
  minHeight: 0,
  overflow: "hidden",
};

// Week-grid window (matches the design): 8am–7pm.
export const HOUR0 = 8;
export const HOUR1 = 19;
export const SPAN = HOUR1 - HOUR0;

// ── Intent (placeholder %, colour driven by REAL meeting status) ─────────────
// Real leads have no "likelihood" score, so the % is a deterministic placeholder
// derived from the lead id (stable per lead). The colour band, however, reflects
// real data: no-show → at-risk, rescheduled → needs-confirmation, else high.
export type Intent = { key: "high" | "medium" | "low"; color: string; tint: string; label: string; pct: number };

export function intentFor(appt: Pick<Appointment, "id" | "no_show" | "re_scheduled_count">): Intent {
  const id = Number(appt.id) || 0;
  if (appt.no_show) {
    return { key: "low", color: "var(--stage-lost)", tint: "rgba(162,75,63,0.12)", label: "Low", pct: 28 + (id % 11) };
  }
  if (appt.re_scheduled_count > 0) {
    return { key: "medium", color: "var(--warn)", tint: "var(--warn-tint)", label: "Medium", pct: 48 + (id % 21) };
  }
  return { key: "high", color: "var(--good)", tint: "var(--good-tint)", label: "High", pct: 72 + (id % 25) };
}

// ── Meeting lifecycle status (filter dimension) ──────────────────────────────
export type StatusKey = "booked" | "noshow" | "rescheduled";
export function statusKeyOf(appt: Pick<Appointment, "no_show" | "re_scheduled_count">): StatusKey {
  if (appt.no_show) return "noshow";
  if (appt.re_scheduled_count > 0) return "rescheduled";
  return "booked";
}
export function statusMetaOf(
  appt: Pick<Appointment, "no_show" | "re_scheduled_count">,
  t: (k: string) => string,
): { key: StatusKey; label: string; color: string; tint: string } {
  const key = statusKeyOf(appt);
  switch (key) {
    case "noshow":
      return { key, label: t("design.status.noShow"), color: "var(--stage-lost)", tint: "rgba(162,75,63,0.12)" };
    case "rescheduled":
      return { key, label: t("design.status.rescheduled"), color: "var(--warn)", tint: "var(--warn-tint)" };
    default:
      return { key, label: t("design.status.booked"), color: "var(--good)", tint: "var(--good-tint)" };
  }
}

// ── Channel (placeholder: calendar_link → video meet, else phone) ────────────
export function channelOf(appt: Pick<Appointment, "calendar_link" | "phone" | "email">): "video" | "phone" {
  if (!appt.email && appt.phone && !appt.calendar_link) return "phone";
  return "video";
}

// ── Time helpers ─────────────────────────────────────────────────────────────
// Fractional hour from an appointment's local hour/minute.
export function apptHm(appt: Pick<Appointment, "hour" | "minutes">): number {
  return appt.hour + appt.minutes / 60;
}

export function fmtClock(hour: number, minutes: number): string {
  const ap = hour < 12 ? "AM" : "PM";
  let hh = hour % 12;
  if (hh === 0) hh = 12;
  return `${hh}:${String(minutes).padStart(2, "0")} ${ap}`;
}

// End-time string given a start appointment + duration.
export function endClockOf(appt: Pick<Appointment, "hour" | "minutes" | "callDurationMinutes">): string {
  const total = appt.hour * 60 + appt.minutes + (appt.callDurationMinutes || 60);
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return fmtClock(h, m);
}

// en-CA gives YYYY-MM-DD which is what pages/Calendar.tsx uses for date keys.
export function dateKeyOf(d: Date): string {
  return new Intl.DateTimeFormat("en-CA").format(d);
}
