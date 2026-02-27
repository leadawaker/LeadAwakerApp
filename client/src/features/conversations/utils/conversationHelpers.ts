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
export function formatRelativeTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return "";
    const diffMs = Date.now() - date.getTime();
    const diffDays = Math.floor(diffMs / 86_400_000);
    if (diffDays === 0) {
      const h = Math.floor(diffMs / 3_600_000);
      return h === 0 ? "Just now" : `${h}h ago`;
    }
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    return `${Math.floor(diffDays / 30)}mo ago`;
  } catch { return ""; }
}
