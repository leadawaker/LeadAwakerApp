import type { HomeIconName } from "./icons";
import reactivationMascot from "@/assets/home/reactivation.webp";
import reputationMascot from "@/assets/home/reputation.webp";
import speedMascot from "@/assets/home/speed.webp";

/**
 * Home-hub static config + sample data — a faithful copy of the Claude Design
 * mockup (`docs/plans/home-data.js` + `home-variations.jsx`). Everything here is
 * SAMPLE data so the page matches the mockup pixel-for-pixel; real metrics get
 * wired in later (the `useHomeMetrics` hook is kept for that). Translatable copy
 * lives in the `home` i18n namespace; this file holds only non-translatable
 * config (colors, sparkline shapes, icons, sample numbers) + proper nouns.
 */

/** Services that get a north-star card (Nurture is intentionally not a card). */
export type ServiceKey = "reactivation" | "reputation" | "speed";
/** Tag keys used by the cross-service needs/activity rows (cards + nurture). */
export type TagKey = ServiceKey | "nurture";
export type Severity = "red" | "orange" | "yellow";
export type DeltaDir = "up" | "down" | "good-down";

/** Service accent colors (mockup values: warn / purple / blue). */
export const SERVICE_COLOR: Record<ServiceKey, string> = {
  reactivation: "var(--warn)",
  reputation: "oklch(55% 0.17 295)",
  speed: "oklch(50% 0.19 242)",
};

/** Tag colors for needs/activity chips — extends service colors with nurture. */
export const TAG_COLOR: Record<TagKey, string> = {
  ...SERVICE_COLOR,
  nurture: "var(--stage-new)",
};

export interface ServiceSample {
  /** Sparkline points, normalized 0..1. */
  spark: number[];
  /** North-star metric value (display string). */
  northValue: string;
  northSuffix?: string;
  /** Render the big number in the amber/warn color (Reactivation). */
  northAmber?: boolean;
  /** Optional north-star icon shown beside the big number. */
  northValueIcon?: HomeIconName;
  /** Sample trend phrase ("+20% vs last 7d") — overridden by i18n. */
  deltaDir: DeltaDir;
  support1Value: string;
  support2Value: string;
}

export interface ServiceConfig {
  key: ServiceKey;
  icon: HomeIconName;
  color: string;
  /** True once the service has a real page; false renders the Open button inert. */
  live: boolean;
  href?: string;
  /** Mascot illustration (e.g. an imported webp). Undefined → icon-badge fallback. */
  mascot?: string;
  sample: ServiceSample;
}

export const SERVICES: ServiceConfig[] = [
  {
    key: "reactivation",
    icon: "refresh",
    color: SERVICE_COLOR.reactivation,
    live: true,
    href: "/platform/campaigns",
    mascot: reactivationMascot,
    sample: {
      spark: [0.3, 0.36, 0.32, 0.44, 0.4, 0.52, 0.48, 0.58, 0.66, 0.6, 0.72, 0.78, 0.74, 0.85, 0.92, 0.88, 1],
      northValue: "24",
      northAmber: true,
      northValueIcon: "calbook",
      deltaDir: "up",
      support1Value: "28%",
      support2Value: "7",
    },
  },
  {
    key: "reputation",
    icon: "star",
    color: SERVICE_COLOR.reputation,
    live: false,
    mascot: reputationMascot,
    sample: {
      spark: [0.5, 0.46, 0.54, 0.58, 0.55, 0.62, 0.6, 0.68, 0.66, 0.72, 0.7, 0.78, 0.82, 0.8, 0.88, 0.92, 0.96],
      northValue: "4.6",
      northSuffix: "★",
      deltaDir: "up",
      support1Value: "32",
      support2Value: "118",
    },
  },
  {
    key: "speed",
    icon: "bolt",
    color: SERVICE_COLOR.speed,
    live: false,
    mascot: speedMascot,
    sample: {
      spark: [0.4, 0.52, 0.46, 0.6, 0.55, 0.66, 0.62, 0.58, 0.7, 0.66, 0.78, 0.72, 0.84, 0.8, 0.9, 0.86, 0.94],
      northValue: "22",
      northSuffix: "s",
      deltaDir: "good-down",
      support1Value: "37",
      support2Value: "24%",
    },
  },
];

export interface PulseConfig {
  key: string;
  icon: HomeIconName;
  value: string;
}

/** Today's cross-service numbers (mockup: Bookings / Messages Sent / Replies / Reviews). */
export const PULSE: PulseConfig[] = [
  { key: "bookings", icon: "cal", value: "18" },
  { key: "sent", icon: "send", value: "426" },
  { key: "replies", icon: "chat", value: "112" },
  { key: "reviews", icon: "star", value: "32" },
];

export interface NeedSample {
  id: number;
  /** Key into home:needs.samples.<key>.{title,snippet}. */
  key: string;
  sev: Severity;
  icon: HomeIconName;
  tag: TagKey;
  /** Proper noun — not translated. */
  who: string;
  /** Language-neutral relative time. */
  time: string;
}

export const SAMPLE_NEEDS: NeedSample[] = [
  { id: 1, key: "negFeedback", sev: "red", icon: "alert", tag: "reputation", who: "Jason Miller", time: "8m" },
  { id: 2, key: "hotInbound", sev: "orange", icon: "chat", tag: "speed", who: "Maria Lopez", time: "5m" },
  { id: 3, key: "aiHandoff", sev: "yellow", icon: "handoff", tag: "reactivation", who: "Tom Reynolds", time: "15m" },
  { id: 4, key: "stalledLead", sev: "yellow", icon: "clock", tag: "nurture", who: "Alex Johnson", time: "2h" },
  { id: 5, key: "reviewRisk", sev: "red", icon: "alert", tag: "reputation", who: "Sarah Davis", time: "3h" },
];

export interface ActivitySample {
  id: number;
  /** Key into home:activity.samples.<key>.{title,meta}. */
  key: string;
  icon: HomeIconName;
  tag: TagKey;
  /** Optional proper-noun prefix shown before the localized meta. */
  name?: string;
  time: string;
}

export const SAMPLE_ACTIVITY: ActivitySample[] = [
  { id: 1, key: "newReview", icon: "star", tag: "reputation", name: "Mike Anderson", time: "10m" },
  { id: 2, key: "bookingConfirmed", icon: "cal", tag: "reactivation", time: "25m" },
  { id: 3, key: "replyReceived", icon: "chat", tag: "speed", name: "Maria Lopez", time: "32m" },
  { id: 4, key: "campaignSent", icon: "send", tag: "reactivation", time: "1h" },
  { id: 5, key: "sequenceSent", icon: "mail", tag: "nurture", time: "2h" },
];

export interface QuickActionConfig {
  key: "newCampaign" | "importContacts" | "newSequence";
  icon: HomeIconName;
  href?: string;
}

export const QUICK_ACTIONS: QuickActionConfig[] = [
  { key: "newCampaign", icon: "send", href: "/platform/campaigns" },
  { key: "importContacts", icon: "import", href: "/platform/contacts" },
  { key: "newSequence", icon: "mail" },
];

export interface UpsellConfig {
  key: "voice" | "referral";
  icon: HomeIconName;
}

export const UPSELL: UpsellConfig[] = [
  { key: "voice", icon: "phone" },
  { key: "referral", icon: "branch" },
];

/** Severity → token color for the needs-row icon tile. */
export const SEVERITY_COLOR: Record<Severity, string> = {
  red: "var(--stage-lost)",
  orange: "var(--warn)",
  yellow: "var(--stage-qualified)",
};
