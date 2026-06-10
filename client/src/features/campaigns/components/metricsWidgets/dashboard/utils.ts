// Data helpers for the campaign Summary dashboard (Claude-design CampaignMonitor).
// Aggregate real campaign data (metrics history, leads, interactions) into the
// shapes the dashboard panels need. No fabricated data — everything derives from
// what the API already returns.
import type { CampaignMetricsHistory } from "@/types/models";
import { PIPELINE_HEX } from "@/lib/avatarUtils";

const DAY_MS = 86_400_000;

// ── Lead field accessors (API returns both snake_case and camelCase) ───────────
type AnyRec = Record<string, any>;
const f = (o: AnyRec, ...keys: string[]) => {
  for (const k of keys) if (o[k] != null) return o[k];
  return undefined;
};

// ── Timeframe aggregation (today=1, week=7, month=30) ──────────────────────────
export type Timeframe = "1D" | "7D" | "1M";
export const TIMEFRAME_DAYS: Record<Timeframe, number> = { "1D": 1, "7D": 7, "1M": 30 };

export interface TimeframeAgg {
  leadsTargeted: number;
  messagesSent: number;
  responseRate: number;
  bookingRate: number;
}

function metricsInRange(metrics: CampaignMetricsHistory[], days: number) {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const start = new Date(end.getTime() - (days - 1) * DAY_MS);
  const endNext = new Date(end.getTime() + DAY_MS);
  return metrics.filter((m) => {
    if (!m.metric_date) return false;
    const d = new Date(`${m.metric_date}T00:00:00`);
    return d >= start && d < endNext;
  });
}

export function aggregateByTimeframe(metrics: CampaignMetricsHistory[], tf: Timeframe): TimeframeAgg {
  const rows = metricsInRange(metrics, TIMEFRAME_DAYS[tf]);
  const sum = (key: string) => rows.reduce((s, m: AnyRec) => s + (Number(m[key]) || 0), 0);
  const avg = (key: string) =>
    rows.length ? Math.round(rows.reduce((s, m: AnyRec) => s + (Number(m[key]) || 0), 0) / rows.length) : 0;
  return {
    leadsTargeted: sum("total_leads_targeted"),
    messagesSent: sum("total_messages_sent"),
    responseRate: avg("response_rate_percent"),
    bookingRate: avg("booking_rate_percent"),
  };
}

export interface TrendPoint { date: string; response: number; booking: number }
export function trendPoints(metrics: CampaignMetricsHistory[], tf: Timeframe): TrendPoint[] {
  const sorted = [...metrics]
    .filter((m) => m.metric_date)
    .sort((a, b) => (a.metric_date || "").localeCompare(b.metric_date || ""));
  return sorted.slice(-TIMEFRAME_DAYS[tf]).map((m: AnyRec) => ({
    date: m.metric_date ? new Date(m.metric_date).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "",
    response: Number(m.response_rate_percent) || 0,
    booking: Number(m.booking_rate_percent) || 0,
  }));
}

// ── Pipeline (donut + bars) from leads ─────────────────────────────────────────
export interface PipeStage { key: string; label: string; count: number; pct: number; color: string; star?: boolean }
const PIPE_DEFS: Array<{ key: string; label: string; star?: boolean }> = [
  { key: "New", label: "New" },
  { key: "Contacted", label: "Contacted" },
  { key: "Responded", label: "Responded" },
  { key: "Multiple Responses", label: "Multi-Response" },
  { key: "Qualified", label: "Qualified" },
  { key: "Booked", label: "Booked", star: true },
  { key: "Lost", label: "Lost" },
  { key: "DND", label: "DND" },
];

export function pipelineFromLeads(leads: AnyRec[]): { total: number; stages: PipeStage[] } {
  const counts: Record<string, number> = {};
  for (const l of leads) {
    let s = f(l, "conversion_status", "conversionStatus") ?? "New";
    if (s === "Closed") s = "Booked"; // direct-booking final → counts as Booked
    counts[s] = (counts[s] || 0) + 1;
  }
  const total = leads.length;
  const stages = PIPE_DEFS.map((d) => {
    const count = counts[d.key] || 0;
    return { ...d, count, pct: total ? Math.round((count / total) * 100) : 0, color: PIPELINE_HEX[d.key] || "var(--mute)" };
  });
  return { total, stages };
}

// ── Lead Heat bands (engagement readiness, bucketed by lead_score) ─────────────
export interface HeatBand { key: string; label: string; count: number; desc: string; color: string }
export function heatFromLeads(leads: AnyRec[]): { total: number; bands: HeatBand[] } {
  const defs = [
    { key: "hot", label: "Hot", min: 70, desc: "engaged · ready to book", color: "var(--wine)" },
    { key: "warm", label: "Warm", min: 50, desc: "replying · nurturing", color: "var(--warn)" },
    { key: "revivable", label: "Revivable", min: 30, desc: "dormant · worth a bump", color: "var(--stage-responded)" },
    { key: "cold", label: "Cold", min: -Infinity, desc: "no signal yet", color: "var(--mute-2)" },
  ];
  const bands = defs.map((d) => ({ ...d, count: 0 }));
  for (const l of leads) {
    const score = Number(f(l, "lead_score", "leadScore") ?? 0);
    const idx = bands.findIndex((b) => score >= b.min);
    if (idx >= 0) bands[idx].count++;
  }
  return { total: leads.length, bands: bands.map(({ min, ...b }) => b) };
}

// ── Today's bump distribution (leads due today, bucketed by next bump stage) ────
export interface CadenceRow { key: string; label: string; dayLabel: string; count: number }
export function bumpDistribution(leads: AnyRec[], campaign: AnyRec): { queuedToday: number; cadence: CadenceRow[] } {
  const now = new Date();
  const endTodayMs = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();
  const hrs = (...keys: string[]) => Number(f(campaign, ...keys)) || 0;
  const d1 = hrs("bump_1_delay_hours", "bump1DelayHours");
  const d2 = hrs("bump_2_delay_hours", "bump2DelayHours");
  const d3 = hrs("bump_3_delay_hours", "bump3DelayHours");
  const toDay = (h: number) => `D+${Math.max(0, Math.round(h / 24))}`;
  const rows: Array<CadenceRow & { stage: number }> = [
    { key: "initial", label: "Message 1", dayLabel: "D+0", stage: 0, count: 0 },
    { key: "b1", label: "Bump 1", dayLabel: toDay(d1), stage: 1, count: 0 },
    { key: "b2", label: "Bump 2", dayLabel: toDay(d1 + d2), stage: 2, count: 0 },
    { key: "b3", label: "Bump 3", dayLabel: toDay(d1 + d2 + d3), stage: 3, count: 0 },
    { key: "last", label: "Bump 4", dayLabel: "", stage: 4, count: 0 },
  ];
  let queuedToday = 0;
  const terminal = new Set(["Booked", "Closed", "Lost", "DND"]);
  for (const l of leads) {
    const status = f(l, "conversion_status", "conversionStatus");
    if (terminal.has(status)) continue;
    const next = f(l, "next_action_at", "nextActionAt");
    if (!next) continue;
    const t = new Date(next).getTime();
    if (Number.isNaN(t) || t >= endTodayMs) continue; // due today or overdue
    const stage = Math.min(4, Math.max(0, Number(f(l, "current_bump_stage", "currentBumpStage") ?? 0)));
    rows[stage].count++;
    queuedToday++;
  }
  return { queuedToday, cadence: rows.map(({ stage, ...r }) => r) };
}

// ── Recent messages ("Just happened") from interactions ────────────────────────
export interface RecentMsg {
  id: number | string;
  name: string;
  direction: "in" | "out";
  preview: string;
  ago: string;
  ts: number;
}
function relTime(iso?: string): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const mins = Math.round((Date.now() - t) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}
export function recentMessages(
  interactions: AnyRec[],
  campaignId: number,
  leadName: (leadId: number) => string,
  limit = 20,
): RecentMsg[] {
  return interactions
    .filter((i) => {
      const cid = Number(f(i, "campaigns_id", "campaign_id", "campaignsId", "campaignId") ?? 0);
      const type = f(i, "type");
      return cid === campaignId && type !== "Note";
    })
    .map((i) => {
      const ts = new Date(f(i, "created_at", "createdAt") ?? 0).getTime();
      const leadId = Number(f(i, "leads_id", "lead_id", "leadsId", "leadId") ?? 0);
      const dir = String(f(i, "direction") ?? "").toLowerCase().startsWith("in") ? "in" : "out";
      const content = String(f(i, "content", "Content") ?? "").replace(/\s+/g, " ").trim();
      return {
        id: f(i, "id") ?? ts,
        name: leadName(leadId) || "—",
        direction: dir as "in" | "out",
        preview: content,
        ts,
        ago: relTime(f(i, "created_at", "createdAt")),
      };
    })
    .sort((a, b) => b.ts - a.ts)
    .slice(0, limit);
}

// ── Calls / handoffs ("Next") from leads ───────────────────────────────────────
export interface CallItem {
  id: number;
  name: string;
  time: string;
  dateLabel: string;
  isToday: boolean;
  kind: "Call" | "AI Handoff";
  stage: string;
  ts: number;
}
function dayLabel(d: Date): string {
  const now = new Date();
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((startOf(d) - startOf(now)) / DAY_MS);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric" });
}
export function upcomingCalls(leads: AnyRec[]): CallItem[] {
  const now = Date.now();
  const weekEnd = now + 7 * DAY_MS;
  const out: CallItem[] = [];
  for (const l of leads) {
    const status = f(l, "conversion_status", "conversionStatus");
    const booked = f(l, "booked_call_date", "bookedCallDate");
    const handoff = f(l, "manual_takeover", "manualTakeover");
    if (booked) {
      const t = new Date(booked).getTime();
      if (!Number.isNaN(t) && t >= now - DAY_MS && t <= weekEnd) {
        const d = new Date(booked);
        out.push({
          id: Number(f(l, "id") ?? 0),
          name: f(l, "full_name", "fullName", "name") ?? "—",
          time: d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }),
          dateLabel: dayLabel(d),
          isToday: dayLabel(d) === "Today",
          kind: handoff ? "AI Handoff" : "Call",
          stage: status ?? "Booked",
          ts: t,
        });
      }
    }
  }
  return out.sort((a, b) => a.ts - b.ts);
}
