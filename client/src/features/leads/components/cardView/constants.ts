// Constants extracted from LeadsCardView.tsx
import {
  CircleDot,
  Send,
  MessageSquare,
  Users,
  Star,
  Calendar,
  Check,
  Ban,
  AlertTriangle,
  Zap,
  Bot,
  UserIcon as UserIconLucide,
  Shield,
  TagIcon,
} from "lucide-react";
import type { SortByOption } from "../LeadsCardView";

// ── Re-export PIPELINE_HEX from its canonical source ─────────────────────────
export { PIPELINE_HEX as PIPELINE_HEX } from "@/lib/avatarUtils";

// ── LIST_RING_SIZE ─────────────────────────────────────────────────────────────
export const LIST_RING_SIZE = 34; // kept for backward compat (used by InlineTable import)

// ── Pipeline stages ────────────────────────────────────────────────────────────
export const PIPELINE_STAGES = [
  { key: "New",                short: "New" },
  { key: "Contacted",          short: "Contacted" },
  { key: "Responded",          short: "Responded" },
  { key: "Multiple Responses", short: "Multi" },
  { key: "Qualified",          short: "Qualified" },
  { key: "Booked",             short: "Booked ★" },
  { key: "Closed",             short: "Closed" },
];

export const LOST_STAGES = ["Lost", "DND"];

// ── Status colour map ──────────────────────────────────────────────────────────
export const STATUS_COLORS: Record<string, { bg: string; text: string; dot: string; badge: string }> = {
  New:                  { bg: "bg-blue-500/10",    text: "text-blue-700 dark:text-blue-400",    dot: "bg-blue-500",    badge: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800" },
  Contacted:            { bg: "bg-indigo-500/10",  text: "text-indigo-700 dark:text-indigo-400", dot: "bg-indigo-500",  badge: "bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800" },
  Responded:            { bg: "bg-violet-500/10",  text: "text-violet-700 dark:text-violet-400", dot: "bg-violet-500",  badge: "bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-900/30 dark:text-violet-300 dark:border-violet-800" },
  "Multiple Responses": { bg: "bg-purple-500/10",  text: "text-purple-700 dark:text-purple-400", dot: "bg-purple-500",  badge: "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800" },
  Qualified:            { bg: "bg-emerald-500/10", text: "text-emerald-700 dark:text-emerald-400",dot: "bg-emerald-500", badge: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800" },
  Booked:               { bg: "bg-amber-400/15",   text: "text-amber-700 dark:text-amber-400",  dot: "bg-amber-500",   badge: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800" },
  Closed:               { bg: "bg-emerald-500/10", text: "text-emerald-700 dark:text-emerald-400",dot: "bg-emerald-500", badge: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800" },
  Lost:                 { bg: "bg-red-500/10",     text: "text-red-700 dark:text-red-400",      dot: "bg-red-500",     badge: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800" },
  DND:                  { bg: "bg-zinc-500/10",    text: "text-zinc-600 dark:text-zinc-400",    dot: "bg-zinc-500",    badge: "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800/60 dark:text-zinc-400 dark:border-zinc-700" },
};

// ── Per-stage icon map ────────────────────────────────────────────────────────
export const STAGE_ICON: Record<string, React.ElementType> = {
  New: CircleDot,
  Contacted: Send,
  Responded: MessageSquare,
  "Multiple Responses": Users,
  Qualified: Star,
  Booked: Calendar,
  Closed: Check,
};

// ── Default anchor stage for terminal statuses ───────────────────────────────
export const TERMINAL_DEFAULT_ANCHOR: Record<string, number> = {
  DND:  3,
  Lost: 3,
};

// ── Map variant statuses to their canonical pipeline stage ────────────────────
export const STATUS_TO_STAGE: Record<string, string> = {};

// ── Avatar pastel palette ─────────────────────────────────────────────────────
export const AVATAR_PASTELS = [
  { bg: "#C8D8FF", text: "#3B5BDB" },
  { bg: "#FFD9C0", text: "#C05621" },
  { bg: "#C8F2C2", text: "#276749" },
  { bg: "#FFC8C8", text: "#9B2C2C" },
  { bg: "#E0C8FF", text: "#6B21A8" },
  { bg: "#FFF2C0", text: "#92400E" },
  { bg: "#C8F2F2", text: "#1A7F7F" },
  { bg: "#FFD9E8", text: "#9D174D" },
];

// ── Dimension colors ──────────────────────────────────────────────────────────
export const DIMENSION_COLORS: Record<string, string> = {
  Engagement: "#3B82F6", // blue
  Activity:   "#10B981", // green
  Funnel:     "#F59E0B", // amber
};

export const DIMENSION_TOOLTIPS: Record<string, string> = {
  Engagement: "Measures how responsive and engaged the lead is: reply recency, sentiment, and interaction quality.",
  Activity:   "Tracks message volume and reply rates. Shows how actively the lead participates in the conversation.",
  Funnel:     "Reflects conversion progress: qualified status, booked calls, and pipeline stage advancement.",
};

// ── Card funnel hints ─────────────────────────────────────────────────────────
export const CARD_FUNNEL_HINTS: Record<string, string> = {
  New: "Waiting to contact",
  Queued: "Queued for outreach",
  Contacted: "Awaiting first reply",
  Responded: "Engage to qualify",
  "Multiple Responses": "Ready to qualify",
  Qualified: "Schedule a call",
  Booked: "Call scheduled",
  Closed: "Deal closed",
  DND: "Do not contact",
  Lost: "Lead lost",
};

// ── Client-side funnel weights (mirrors server scoring logic) ─────────────────
export const CLIENT_FUNNEL_WEIGHTS: Record<string, number> = {
  New: 0, Contacted: 5, Responded: 15, "Multiple Responses": 25,
  Qualified: 35, Booked: 45, Closed: 50, DND: 0, Lost: 0,
};

// ── AI triggered-by set ───────────────────────────────────────────────────────
export const AI_TRIGGERED_BY = new Set([
  "automation", "ai_conversation", "campaign_launcher",
  "bump_scheduler", "manual_bump_trigger",
  "inbound_handler", "booking_webhook", "booking_confirmation",
]);

// ── Mini thread gap ───────────────────────────────────────────────────────────
export const MINI_THREAD_GAP_MS = 2 * 60 * 60 * 1000;

// ── Swipe tray width ──────────────────────────────────────────────────────────
export const TRAY_WIDTH = 220; // Swipe-left action tray width in px (Feature #41)

// ── Status group order ────────────────────────────────────────────────────────
export const STATUS_GROUP_ORDER = ["New", "Contacted", "Responded", "Multiple Responses", "Qualified", "Booked", "Lost", "DND"];

// ── All mobile kanban stages ──────────────────────────────────────────────────
export const ALL_MOBILE_KANBAN_STAGES = [
  { key: "New",                short: "New"     },
  { key: "Contacted",          short: "Contact" },
  { key: "Responded",          short: "Respond" },
  { key: "Multiple Responses", short: "Multi"   },
  { key: "Qualified",          short: "Qualify" },
  { key: "Booked",             short: "Booked ★"},
  { key: "Closed",             short: "Closed"  },
  { key: "Lost",               short: "Lost"    },
  { key: "DND",                short: "DND"     },
] as const;

// ── All lead filter stages ────────────────────────────────────────────────────
export const ALL_LEAD_FILTER_STAGES = [
  "New", "Contacted", "Responded", "Multiple Responses",
  "Qualified", "Booked", "Closed", "Lost", "DND",
];

// ── Lead sort options ─────────────────────────────────────────────────────────
export const LEAD_SORT_OPTIONS: { value: SortByOption; label: string }[] = [
  { value: "recent",     label: "Most Recent" },
  { value: "name_asc",   label: "Name A → Z" },
  { value: "name_desc",  label: "Name Z → A" },
  { value: "score_desc", label: "Score ↓" },
  { value: "score_asc",  label: "Score ↑" },
];

// ── Timeline icon map ─────────────────────────────────────────────────────────
export const TIMELINE_ICON: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  bump:           { icon: Zap,            color: "text-brand-indigo",                             bg: "bg-brand-indigo/10" },
  outbound_ai:    { icon: Bot,            color: "text-brand-indigo",                             bg: "bg-brand-indigo/10" },
  outbound_agent: { icon: UserIconLucide, color: "text-emerald-700 dark:text-emerald-400",        bg: "bg-emerald-50 dark:bg-emerald-950/30" },
  inbound:        { icon: MessageSquare,  color: "text-emerald-600 dark:text-emerald-400",        bg: "bg-emerald-50 dark:bg-emerald-950/30" },
  booked:         { icon: Calendar,       color: "text-amber-500 dark:text-amber-400",            bg: "bg-amber-50 dark:bg-amber-950/30" },
  dnd:            { icon: Ban,            color: "text-red-500 dark:text-red-400",                bg: "bg-red-50 dark:bg-red-950/30" },
  optout:         { icon: Shield,         color: "text-red-500 dark:text-red-400",                bg: "bg-red-50 dark:bg-red-950/30" },
  tag:            { icon: TagIcon,        color: "text-violet-600 dark:text-violet-400",          bg: "bg-violet-50 dark:bg-violet-950/30" },
};

// ── Mini tag hex colors ───────────────────────────────────────────────────────
export const MINI_TAG_HEX: Record<string, string> = {
  yellow: "#EAB308", blue: "#3B82F6", green: "#22C55E", red: "#EF4444",
  purple: "#A855F7", orange: "#F97316", pink: "#EC4899", gray: "#6B7280",
};

// ── Mini conversion status tags (shown as status-event chips in timeline) ─────
export const MINI_CONVERSION_STATUS_TAGS = new Set([
  "Booked", "Responded", "Multiple Responses", "Qualified", "Opted Out", "DNC",
]);

// ── Mini stage icon map ───────────────────────────────────────────────────────
export const MINI_STAGE_ICON: Record<string, React.ElementType> = {
  New: CircleDot, Contacted: Send, Responded: MessageSquare,
  "Multiple Responses": Users, Qualified: Star, Booked: Calendar,
  Closed: Check, Lost: AlertTriangle, DND: Ban,
};

// ── Tag color class map ───────────────────────────────────────────────────────
export const TAG_COLOR_MAP: Record<string, string> = {
  red:    "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  green:  "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  blue:   "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  yellow: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  purple: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  orange: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  gray:   "bg-zinc-100 text-zinc-600 dark:bg-zinc-800/60 dark:text-zinc-400",
};
