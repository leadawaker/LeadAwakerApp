import { Megaphone, Zap, CalendarCheck, Star, Phone, MessagesSquare, Cog, CircleHelp, type LucideIcon } from "lucide-react";
import type { AutomationService } from "@shared/automationCatalogue";
import type { HealthState, HourlyPulse, OverviewRow } from "@shared/automationTypes";

/** The four states Gabriel actually cares about, folded from the seven health states. */
export type Bucket = "fine" | "attention" | "broken" | "waiting";
export const BUCKETS: Bucket[] = ["broken", "attention", "fine", "waiting"];

export function bucketOf(h: HealthState): Bucket {
  if (h === "healthy") return "fine";
  if (h === "warning" || h === "late") return "attention";
  if (h === "failing") return "broken";
  return "waiting";
}

export const BUCKET_COLOR: Record<Bucket, string> = {
  fine: "var(--good)",
  attention: "var(--warn)",
  broken: "hsl(var(--destructive))",
  waiting: "var(--mute-2)",
};

export const SERVICE_ICON: Record<AutomationService | "unlisted", LucideIcon> = {
  reactivation: Megaphone,
  speed_to_lead: Zap,
  bookings: CalendarCheck,
  reputation: Star,
  receptionist: Phone,
  inbox: MessagesSquare,
  internal: Cog,
  unlisted: CircleHelp,
};

export const pulseTotal = (p: HourlyPulse) => p.ok.reduce((a, b) => a + b, 0) + p.failed.reduce((a, b) => a + b, 0);

export function sumPulses(rows: OverviewRow[]): HourlyPulse {
  const out: HourlyPulse = { ok: Array(24).fill(0), failed: Array(24).fill(0) };
  for (const r of rows) {
    r.pulse?.ok.forEach((n, i) => { out.ok[i] += n; });
    r.pulse?.failed.forEach((n, i) => { out.failed[i] += n; });
  }
  return out;
}

export const rowActions24h = (r: OverviewRow) => r.counts24h.success + r.counts24h.failed + r.counts24h.skipped;
