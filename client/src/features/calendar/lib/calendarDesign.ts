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
  leadScore: number;
};

// ── Shared card chrome ───────────────────────────────────────────────────────
export const HEADER_H = 60; // aligned column-header height across the 3 cards

export const CARD_STYLE: CSSProperties = {
  background: "var(--card)",
  borderRadius: "var(--r-card)",
  display: "flex",
  flexDirection: "column",
  minHeight: 0,
  overflow: "hidden",
};

// Week-grid window: 6am–9pm.
export const HOUR0 = 6;
export const HOUR1 = 21;
export const SPAN = HOUR1 - HOUR0;
// Height per hour row — 30% taller than the original 64px.
export const PX_PER_HOUR = 83;

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
      // Pale gold treatment — distinct from a lost lead, visually muted
      return { key, label: t("design.status.noShow"), color: "var(--warn)", tint: "var(--warn-tint)" };
    case "rescheduled":
      return { key, label: t("design.status.rescheduled"), color: "var(--warn)", tint: "var(--warn-tint)" };
    default:
      return { key, label: t("design.status.booked"), color: "var(--good)", tint: "var(--good-tint)" };
  }
}

// ── Channel (calendar_link → video meet, else phone) ─────────────────────────
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
