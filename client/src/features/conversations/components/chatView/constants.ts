// ─── Bubble width context ─────────────────────────────────────────────────────
export const BUBBLE_WIDTH_KEY = "chatBubbleWidth";
export const DEFAULT_BUBBLE_WIDTH = 60;

// ─── Tag Event Chip (inline in chat timeline) ─────────────────────────────────

export const TAG_COLOR_MAP: Record<string, string> = {
  yellow: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  blue: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  green: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  red: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  orange: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  purple: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  gray: "bg-gray-100 text-gray-600 dark:bg-gray-800/60 dark:text-gray-400",
};

export const TAG_HEX: Record<string, string> = {
  red: "#EF4444",
  orange: "#F97316",
  yellow: "#EAB308",
  green: "#22C55E",
  blue: "#3B82F6",
  indigo: "#6366F1",
  purple: "#A855F7",
  pink: "#EC4899",
  gray: "#6B7280",
};

// ─── Status Event Chip (conversion status changes in timeline) ────────────────

/** Tag names that represent a conversion status change. These render as status chips instead of tag chips. */
export const CONVERSION_STATUS_TAGS = new Set([
  "New",
  "Contacted",
  "Responded",
  "Multiple Responses",
  "Qualified",
  "Booked",
  "Lost",
  "DND",
  "Opted Out",
  "DNC",
]);

/** Case-insensitive lookup: returns the canonical status name or null */
export const _STATUS_LOWER = new Map<string, string>();
Array.from(CONVERSION_STATUS_TAGS).forEach(s => _STATUS_LOWER.set(s.toLowerCase(), s));

/** Returns true if this interaction was generated/sent by the AI/automation system */
export const AI_TRIGGERED_BY = new Set([
  "automation", "ai_conversation", "campaign_launcher",
  "bump_scheduler", "manual_bump_trigger",
  "inbound_handler", "booking_webhook", "booking_confirmation",
]);

// ─── Thread Grouping ──────────────────────────────────────────────────────────

export const THREAD_GAP_MS = 2 * 60 * 60 * 1000;
