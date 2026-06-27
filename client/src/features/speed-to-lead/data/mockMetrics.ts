// Mock metrics for the Speed-to-Lead mission-control dashboard.
//
// This module is the single source of truth for every number on the page. It is
// shaped exactly like a future real API response (`GET /api/speed-to-lead/metrics`)
// so the page can be swapped to live data later without touching any component.
// The values match the design reference image 1:1.
//
// IMPORTANT: numbers live here, *labels* go through i18n in the components.

export type ResponseTone = "good" | "warn";
export type FeedStatus = "delivered" | "fallback";
export type LeadRange = "24h" | "1w" | "1m";

export interface ChannelMixEntry {
  /** i18n key suffix under `channelMix.*` (e.g. "whatsapp", "emailFallback"). */
  key: string;
  pct: number;
  count: number;
  /** Median response time for this channel, pre-formatted (e.g. "18s", "2m 14s"). */
  medianLabel: string;
  /** Token color for the donut segment + legend bar. */
  color: string;
}

export interface DistributionBucket {
  /** i18n key suffix under `distribution.*` (e.g. "under15s"). */
  key: string;
  pct: number;
  tone: ResponseTone;
}

export interface TotalLeadsRange {
  range: LeadRange;
  value: number;
  deltaPct: number;
  /** Time series for the area chart. `t` = x-axis label, `v` = lead count. */
  series: { t: string; v: number }[];
}

export interface LeadSource {
  /** i18n key suffix under `sources.*` (e.g. "webForm"). */
  key: string;
  pct: number;
}

export interface FeedRow {
  name: string;
  /** i18n key suffix under `sources.*`. */
  sourceKey: string;
  /** "whatsapp" | "emailFallback" — i18n key suffix under `channels.*`. */
  channelKey: string;
  /** Pre-formatted first-touch time (e.g. "12s", "2m 14s"). */
  touchLabel: string;
  touchTone: ResponseTone;
  status: FeedStatus;
  /** Minutes since the touch — rendered as "N min ago". */
  agoMin: number;
}

export interface InsightRow {
  tone: ResponseTone;
  /** i18n key suffix under `insights.*` for the headline + detail. */
  key: string;
}

/** A single day of the 7-day median-first-touch trend (seconds). */
export interface MedianTrendPoint {
  /** i18n key suffix under `weekday.*` (e.g. "mon"). */
  day: string;
  sec: number;
}

export interface SpeedToLeadMetrics {
  medianFirstTouchSec: number;
  medianLabel: string;
  targetSec: number;
  /** 7-day median-first-touch trend, in seconds, for the hero area chart. */
  medianTrend7d: MedianTrendPoint[];
  /** Donut center: dominant channel share label. */
  dominantChannelPct: number;
  channelMix: ChannelMixEntry[];
  distribution: DistributionBucket[];
  totalLeads: TotalLeadsRange[];
  sources: LeadSource[];
  feed: FeedRow[];
  insights: InsightRow[];
}

export type SpeedToLeadStatus = "active" | "paused" | "draft";

/**
 * A Speed-to-Lead campaign for the left toolbar. Shaped as the subset of a real
 * `Campaign` row where `campaign_type === "speed_to_lead"`, so this can later be
 * swapped for a filtered campaigns query without touching the components.
 */
export interface SpeedToLeadCampaign {
  id: number;
  name: string;
  status: SpeedToLeadStatus;
  /** Response SLA in seconds (config identity, e.g. 60). */
  responseTargetSec: number;
  /** i18n key suffix under `channels.*`. */
  primaryChannel: string;
  /** i18n key suffix under `channels.*`. */
  fallbackChannel: string;
  accountName: string;
  /** Mono-tile hue rotation for light per-campaign color variation. */
  hue: number;
}

const WHATSAPP = "var(--good)";
const SMS = "var(--warn)"; // orange — SMS fallback
const FALLBACK = "var(--wine)"; // wine — email fallback

// 24-hour curve climbing through the day, matching the reference area chart.
const series24h = [
  { t: "12AM", v: 6 },
  { t: "2AM", v: 4 },
  { t: "4AM", v: 5 },
  { t: "6AM", v: 12 },
  { t: "8AM", v: 28 },
  { t: "10AM", v: 41 },
  { t: "12PM", v: 55 },
  { t: "2PM", v: 49 },
  { t: "4PM", v: 63 },
  { t: "6PM", v: 71 },
  { t: "8PM", v: 84 },
  { t: "10PM", v: 92 },
  { t: "12AM", v: 100 },
];

const series1w = [
  { t: "Mon", v: 310 },
  { t: "Tue", v: 352 },
  { t: "Wed", v: 298 },
  { t: "Thu", v: 401 },
  { t: "Fri", v: 388 },
  { t: "Sat", v: 274 },
  { t: "Sun", v: 333 },
];

const series1m = [
  { t: "W1", v: 1980 },
  { t: "W2", v: 2240 },
  { t: "W3", v: 2105 },
  { t: "W4", v: 2510 },
];

// 7-day median first-touch trend (seconds), gently improving toward the 23s today.
const medianTrend7d: MedianTrendPoint[] = [
  { day: "mon", sec: 31 },
  { day: "tue", sec: 29 },
  { day: "wed", sec: 27 },
  { day: "thu", sec: 28 },
  { day: "fri", sec: 25 },
  { day: "sat", sec: 24 },
  { day: "sun", sec: 23 },
];

export const mockSpeedToLeadMetrics: SpeedToLeadMetrics = {
  medianFirstTouchSec: 23,
  medianLabel: "23s",
  targetSec: 60,
  medianTrend7d,
  dominantChannelPct: 88,
  channelMix: [
    { key: "whatsapp", pct: 88, count: 1165, medianLabel: "18s", color: WHATSAPP },
    { key: "smsFallback", pct: 8, count: 106, medianLabel: "47s", color: SMS },
    { key: "emailFallback", pct: 4, count: 53, medianLabel: "2m 14s", color: FALLBACK },
  ],
  distribution: [
    { key: "under15s", pct: 48, tone: "good" },
    { key: "from15to30s", pct: 31, tone: "good" },
    { key: "from30to60s", pct: 14, tone: "good" },
    { key: "from1to5m", pct: 5, tone: "warn" },
    { key: "over5m", pct: 2, tone: "warn" },
  ],
  totalLeads: [
    { range: "24h", value: 412, deltaPct: 18, series: series24h },
    { range: "1w", value: 2356, deltaPct: 9, series: series1w },
    { range: "1m", value: 8835, deltaPct: 14, series: series1m },
  ],
  sources: [
    { key: "webForm", pct: 43 },
    { key: "facebook", pct: 22 },
    { key: "instagram", pct: 16 },
    { key: "hubspot", pct: 10 },
    { key: "zapier", pct: 5 },
    { key: "other", pct: 4 },
  ],
  feed: [
    { name: "Olivia Carter", sourceKey: "facebook", channelKey: "whatsapp", touchLabel: "12s", touchTone: "good", status: "delivered", agoMin: 2 },
    { name: "Ethan Brooks", sourceKey: "webForm", channelKey: "whatsapp", touchLabel: "28s", touchTone: "good", status: "delivered", agoMin: 3 },
    { name: "Sophie Nguyen", sourceKey: "instagram", channelKey: "whatsapp", touchLabel: "18s", touchTone: "good", status: "delivered", agoMin: 4 },
    { name: "Liam Patel", sourceKey: "hubspot", channelKey: "emailFallback", touchLabel: "2m 14s", touchTone: "warn", status: "fallback", agoMin: 5 },
    { name: "Ava Johnson", sourceKey: "zapier", channelKey: "whatsapp", touchLabel: "35s", touchTone: "good", status: "delivered", agoMin: 6 },
    { name: "Michael Chen", sourceKey: "webForm", channelKey: "whatsapp", touchLabel: "14s", touchTone: "good", status: "delivered", agoMin: 7 },
    { name: "Rachel Singh", sourceKey: "facebook", channelKey: "whatsapp", touchLabel: "43s", touchTone: "good", status: "delivered", agoMin: 8 },
    { name: "Daniel Thomas", sourceKey: "instagram", channelKey: "emailFallback", touchLabel: "1m 32s", touchTone: "warn", status: "fallback", agoMin: 9 },
  ],
  insights: [
    { tone: "good", key: "responseSpeed" },
    { tone: "good", key: "whatsappShare" },
    { tone: "warn", key: "webFormSlower" },
    { tone: "warn", key: "emailFallbacks" },
  ],
};

// ── Toolbar campaigns ────────────────────────────────────────────────────────
// The mock Speed-to-Lead campaigns listed in the left toolbar. A real future
// query is `campaign_type === "speed_to_lead"`, so these mirror that subset.
export const mockSpeedToLeadCampaigns: SpeedToLeadCampaign[] = [
  { id: 1, name: "Solar Q3 Inbound", status: "active", responseTargetSec: 60, primaryChannel: "whatsapp", fallbackChannel: "emailFallback", accountName: "Zonnestroom NL", hue: 0 },
  { id: 2, name: "Roofing Leads", status: "active", responseTargetSec: 60, primaryChannel: "whatsapp", fallbackChannel: "emailFallback", accountName: "DakMeesters", hue: 40 },
  { id: 3, name: "Dental New Patients", status: "paused", responseTargetSec: 90, primaryChannel: "whatsapp", fallbackChannel: "emailFallback", accountName: "SmileClinic", hue: 200 },
  { id: 4, name: "Home Services FB", status: "draft", responseTargetSec: 60, primaryChannel: "whatsapp", fallbackChannel: "emailFallback", accountName: "FixIt Pro", hue: 300 },
];

// Per-campaign headline overrides — light variation on top of the shared base so
// selecting a campaign visibly changes the dashboard. Distribution/sources/feed/
// insights stay shared in the mockup.
const CAMPAIGN_OVERRIDES: Record<number, Partial<SpeedToLeadMetrics>> = {
  2: {
    medianFirstTouchSec: 31,
    medianLabel: "31s",
    medianTrend7d: [
      { day: "mon", sec: 44 }, { day: "tue", sec: 41 }, { day: "wed", sec: 38 },
      { day: "thu", sec: 36 }, { day: "fri", sec: 34 }, { day: "sat", sec: 33 }, { day: "sun", sec: 31 },
    ],
    dominantChannelPct: 82,
    channelMix: [
      { key: "whatsapp", pct: 82, count: 598, medianLabel: "27s", color: WHATSAPP },
      { key: "smsFallback", pct: 10, count: 73, medianLabel: "1m 12s", color: SMS },
      { key: "emailFallback", pct: 8, count: 58, medianLabel: "2m 51s", color: FALLBACK },
    ],
    totalLeads: [
      { range: "24h", value: 188, deltaPct: 11, series: series24h },
      { range: "1w", value: 1042, deltaPct: 6, series: series1w },
      { range: "1m", value: 4120, deltaPct: 9, series: series1m },
    ],
  },
  3: {
    medianFirstTouchSec: 47,
    medianLabel: "47s",
    targetSec: 90,
    medianTrend7d: [
      { day: "mon", sec: 58 }, { day: "tue", sec: 55 }, { day: "wed", sec: 52 },
      { day: "thu", sec: 51 }, { day: "fri", sec: 49 }, { day: "sat", sec: 48 }, { day: "sun", sec: 47 },
    ],
    dominantChannelPct: 75,
    channelMix: [
      { key: "whatsapp", pct: 75, count: 288, medianLabel: "41s", color: WHATSAPP },
      { key: "smsFallback", pct: 14, count: 54, medianLabel: "1m 38s", color: SMS },
      { key: "emailFallback", pct: 11, count: 42, medianLabel: "3m 22s", color: FALLBACK },
    ],
    totalLeads: [
      { range: "24h", value: 96, deltaPct: -4, series: series24h },
      { range: "1w", value: 612, deltaPct: 3, series: series1w },
      { range: "1m", value: 2480, deltaPct: 7, series: series1m },
    ],
  },
  4: {
    medianFirstTouchSec: 19,
    medianLabel: "19s",
    medianTrend7d: [
      { day: "mon", sec: 26 }, { day: "tue", sec: 25 }, { day: "wed", sec: 23 },
      { day: "thu", sec: 22 }, { day: "fri", sec: 21 }, { day: "sat", sec: 20 }, { day: "sun", sec: 19 },
    ],
    dominantChannelPct: 91,
    channelMix: [
      { key: "whatsapp", pct: 91, count: 476, medianLabel: "15s", color: WHATSAPP },
      { key: "smsFallback", pct: 6, count: 31, medianLabel: "52s", color: SMS },
      { key: "emailFallback", pct: 3, count: 16, medianLabel: "1m 58s", color: FALLBACK },
    ],
    totalLeads: [
      { range: "24h", value: 142, deltaPct: 22, series: series24h },
      { range: "1w", value: 798, deltaPct: 13, series: series1w },
      { range: "1m", value: 3060, deltaPct: 17, series: series1m },
    ],
  },
};

/**
 * Per-campaign metrics, shaped like `GET /api/speed-to-lead/metrics?campaignId=`.
 * Returns the shared base merged with light per-campaign overrides.
 */
export function getSpeedToLeadMetrics(campaignId: number): SpeedToLeadMetrics {
  const override = CAMPAIGN_OVERRIDES[campaignId];
  return override ? { ...mockSpeedToLeadMetrics, ...override } : mockSpeedToLeadMetrics;
}
