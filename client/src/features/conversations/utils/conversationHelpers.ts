import type { Lead } from "../hooks/useConversationsData";

// ── Status avatar colors — shared across InboxPanel + ContactSidebar ─────────
export function getStatusAvatarColor(status: string): { bg: string; text: string } {
  const solids: Record<string, { bg: string; text: string }> = {
    New:                  { bg: "#E5E7EB", text: "#374151" },
    Contacted:            { bg: "#DBEAFE", text: "#1D4ED8" },
    Responded:            { bg: "#CCFBF1", text: "#0F766E" },
    "Multiple Responses": { bg: "#DCFCE7", text: "#15803D" },
    Qualified:            { bg: "#ECFCCB", text: "#3F6212" },
    Booked:               { bg: "#FEF9C3", text: "#854D0E" },
    Closed:               { bg: "#D1FAE5", text: "#065F46" },
    Lost:                 { bg: "#FEE2E2", text: "#991B1B" },
    DND:                  { bg: "#F4F4F5", text: "#52525B" },
  };
  return solids[status] ?? { bg: "#E5E7EB", text: "#374151" };
}

// ── Pipeline constants ───────────────────────────────────────────────────────
export const PIPELINE_STATUSES = [
  "New", "Contacted", "Responded", "Multiple Responses",
  "Qualified", "Booked", "Closed", "Lost", "DND",
];

export const PIPELINE_HEX: Record<string, string> = {
  New:                  "#6B7280",
  Contacted:            "#4F46E5",
  Responded:            "#14B8A6",
  "Multiple Responses": "#22C55E",
  Qualified:            "#84CC16",
  Booked:               "#FCB803",
  Closed:               "#10B981",
  Lost:                 "#EF4444",
  DND:                  "#71717A",
};

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
