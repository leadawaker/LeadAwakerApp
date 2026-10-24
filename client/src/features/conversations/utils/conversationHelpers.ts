import type { Lead } from "../hooks/useConversationsData";

// ── Re-export shared avatar utilities (aliased so existing imports keep working) ──
export { getLeadStatusAvatarColor as getStatusAvatarColor, PIPELINE_HEX, PIPELINE_STATUSES } from "@/lib/avatarUtils";

// ── Lead helpers ─────────────────────────────────────────────────────────────
export function initialsFor(lead: Lead): string {
  const a = (lead.first_name ?? "").slice(0, 1);
  const b = (lead.last_name ?? "").slice(0, 1);
  return `${a}${b}`.toUpperCase() || "?";
}

export function getStatus(lead: Lead): string {
  return lead.Conversion_Status ?? lead.conversion_status ?? lead.conversionStatus ?? "";
}

// ── Relative time formatting ─────────────────────────────────────────────────
type RelT = (key: string, opts?: Record<string, unknown>) => string;

// English fallback for callers that don't pass `t` yet (the lead chat parts).
const REL_EN: Record<string, (n: number) => string> = {
  justNow: () => "Just now", minutesAgo: (n) => `${n}m ago`, hoursAgo: (n) => `${n}h ago`,
  yesterday: () => "Yesterday", daysAgo: (n) => `${n}d ago`, weeksAgo: (n) => `${n}w ago`, monthsAgo: (n) => `${n}mo ago`,
};

/** "5m ago", "Yesterday". Pass the conversations `t` to get it in the UI language (`relativeTime.*`). */
export function formatRelativeTime(dateStr: string | null | undefined, t?: RelT): string {
  if (!dateStr) return "";
  const say = (key: string, count = 0) => (t ? t(`relativeTime.${key}`, { count }) : REL_EN[key](count));
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return "";
    const diffMs = Date.now() - date.getTime();
    if (diffMs <= 0) return say("justNow");
    const diffMins = Math.floor(diffMs / 60_000);
    if (diffMins < 1) return say("justNow");
    if (diffMins < 60) return say("minutesAgo", diffMins);
    const h = Math.floor(diffMs / 3_600_000);
    const diffDays = Math.floor(diffMs / 86_400_000);
    if (diffDays === 0) return say("hoursAgo", h);
    if (diffDays === 1) return say("yesterday");
    if (diffDays < 7) return say("daysAgo", diffDays);
    if (diffDays < 30) return say("weeksAgo", Math.floor(diffDays / 7));
    return say("monthsAgo", Math.floor(diffDays / 30));
  } catch { return ""; }
}

// Date-group labels ("Today", "This Week"...) are English keys internally; this maps them to
// inbox.dateGroups.* at render. Anything else (a month name) is shown as it is.
const DATE_GROUP_KEY: Record<string, string> = {
  "Today": "today", "Yesterday": "yesterday", "This Week": "thisWeek", "This Month": "thisMonth",
  "Last 3 Months": "last3Months", "Older": "older", "No Activity": "noActivity",
};
export function dateGroupText(label: string, t: RelT): string {
  const key = DATE_GROUP_KEY[label];
  return key ? t(`inbox.dateGroups.${key}`) : label;
}
