// ── Shared avatar utilities — single source of truth for initials, colors, palettes ──
// All features import from here instead of defining their own duplicates.

// ── Universal initials extraction ─────────────────────────────────────────────
export function getInitials(name: string): string {
  return name.split(" ").map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "?";
}

/** Lead-specific: builds initials from first_name + last_name fields */
export function initialsForLead(lead: { first_name?: string | null; last_name?: string | null }): string {
  const a = (lead.first_name ?? "").slice(0, 1);
  const b = (lead.last_name ?? "").slice(0, 1);
  return `${a}${b}`.toUpperCase() || "?";
}

// ── Hex → HSL → Hex helpers (for pastel derivation) ─────────────────────────
function hexToHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return [h * 360, s, l];
}

function hslToHex(h: number, s: number, l: number): string {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * c).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/** Derive a pastel bg from a saturated hex (brighter, less saturated) */
function pastelBg(hex: string): string {
  const [h, s, _l] = hexToHsl(hex);
  return hslToHex(h, s * 0.45, 0.87);
}

/** Derive a dark text color from a saturated hex */
function pastelText(hex: string): string {
  const [h, s, _l] = hexToHsl(hex);
  return hslToHex(h, s * 0.7, 0.25);
}

// ── Pipeline stage hex colors ─────────────────────────────────────────────────
export const PIPELINE_HEX: Record<string, string> = {
  New:                  "#6B7280",
  Contacted:            "#7A73FF",
  Responded:            "#3ACBDF",
  "Multiple Responses": "#31D35C",
  Qualified:            "#AED62E",
  Booked:               "#F7BF0E",
  Closed:               "#FFFFFF",
  Lost:                 "#FF0000",
  DND:                  "#CB257D",
};

// ── Lead avatar colors — hand-picked pastels, mutable for Color Tester ───────
export const LEAD_AVATAR_BG: Record<string, string> = {
  New:                  "#DDDDDF",
  Contacted:            "#BEBDEC",
  Responded:            "#BDE8EC",
  "Multiple Responses": "#B7E6C2",
  Qualified:            "#D8E3BB",
  Booked:               "#FDEAAD",
  Closed:               "#DEDEDE",
  Lost:                 "#EDCFCF",
  DND:                  "#E8D4DE",
};
export const LEAD_AVATAR_TEXT: Record<string, string> = {
  New:                  "#374151",
  Contacted:            "#2E3A6B",
  Responded:            "#0F5F5A",
  "Multiple Responses": "#166534",
  Qualified:            "#3F6212",
  Booked:               "#78350F",
  Closed:               "#374151",
  Lost:                 "#991B1B",
  DND:                  "#6B2154",
};

/** Recalculate LEAD_AVATAR_BG/TEXT from current PIPELINE_HEX values (used by Color Tester reset) */
export function refreshLeadAvatarColors(): void {
  for (const key of Object.keys(PIPELINE_HEX)) {
    LEAD_AVATAR_BG[key] = pastelBg(PIPELINE_HEX[key]);
    LEAD_AVATAR_TEXT[key] = pastelText(PIPELINE_HEX[key]);
  }
}

// ── Lead / Pipeline status avatar colors ──────────────────────────────────────
// Reads from the mutable LEAD_AVATAR_BG/TEXT maps (pastel-derived from PIPELINE_HEX).
export function getLeadStatusAvatarColor(status: string): { bg: string; text: string } {
  return {
    bg:   LEAD_AVATAR_BG[status]   ?? LEAD_AVATAR_BG["New"]   ?? "#d1d5db",
    text: LEAD_AVATAR_TEXT[status]  ?? LEAD_AVATAR_TEXT["New"]  ?? "#374151",
  };
}

export const PIPELINE_STATUSES = [
  "New", "Contacted", "Responded", "Multiple Responses",
  "Qualified", "Booked", "Closed", "Lost", "DND",
];

// ── Account status colors — exported mutable for Color Tester ─────────────────
export const ACCOUNT_STATUS_HEX: Record<string, string> = {
  Active:    "#10B981",
  Trial:     "#F59E0B",
  Inactive:  "#94A3B8",
  Suspended: "#F43F5E",
};

export const ACCOUNT_AVATAR_BG: Record<string, string> = {
  Active:    "#D1FAE5",
  Trial:     "#FEF3C7",
  Inactive:  "#F4F4F5",
  Suspended: "#FFE4E6",
};
export const ACCOUNT_AVATAR_TEXT: Record<string, string> = {
  Active:    "#065F46",
  Trial:     "#92400E",
  Inactive:  "#52525B",
  Suspended: "#9F1239",
};

export function getAccountAvatarColor(status: string): { bg: string; text: string } {
  return {
    bg:   ACCOUNT_AVATAR_BG[status]   ?? "#E5E7EB",
    text: ACCOUNT_AVATAR_TEXT[status] ?? "#374151",
  };
}

// ── Campaign status colors — exported mutable for Color Tester ────────────────
export const CAMPAIGN_STATUS_HEX: Record<string, string> = {
  Active:    "#22C55E",
  Paused:    "#F59E0B",
  Completed: "#3B82F6",
  Finished:  "#3B82F6",
  Inactive:  "#94A3B8",
  Archived:  "#94A3B8",
  Draft:     "#6B7280",
};

export const CAMPAIGN_AVATAR_BG: Record<string, string> = {
  Active:    "#DCFCE7",
  Paused:    "#FEF3C7",
  Completed: "#DBEAFE",
  Finished:  "#DBEAFE",
  Inactive:  "#F4F4F5",
  Archived:  "#F4F4F5",
  Draft:     "#E5E7EB",
};
export const CAMPAIGN_AVATAR_TEXT: Record<string, string> = {
  Active:    "#15803D",
  Paused:    "#92400E",
  Completed: "#1D4ED8",
  Finished:  "#1D4ED8",
  Inactive:  "#52525B",
  Archived:  "#52525B",
  Draft:     "#374151",
};

export function getCampaignAvatarColor(status: string): { bg: string; text: string } {
  return {
    bg:   CAMPAIGN_AVATAR_BG[status]   ?? "#E5E7EB",
    text: CAMPAIGN_AVATAR_TEXT[status] ?? "#374151",
  };
}

// ── User role avatar colors ───────────────────────────────────────────────────
export const ROLE_AVATAR: Record<string, { bg: string; text: string }> = {
  Admin:    { bg: "#FEF9C3", text: "#854D0E" },
  Operator: { bg: "#FFEDD5", text: "#9A3412" },
  Manager:  { bg: "#DBEAFE", text: "#1E40AF" },
  Agent:    { bg: "#EDE9FE", text: "#5B21B6" },
  Viewer:   { bg: "#E5E7EB", text: "#374151" },
};

export function getUserRoleAvatarColor(role: string): { bg: string; text: string } {
  return ROLE_AVATAR[role] ?? { bg: "#E5E7EB", text: "#374151" };
}

// ── Prompt status avatar colors — exported mutable for Color Tester ───────────
export const PROMPT_AVATAR_BG: Record<string, string> = {
  Active:   "#D1FAE5",
  Archived: "#F4F4F5",
};
export const PROMPT_AVATAR_TEXT: Record<string, string> = {
  Active:   "#065F46",
  Archived: "#52525B",
};

export function getPromptAvatarColor(status: string): { bg: string; text: string } {
  return {
    bg:   PROMPT_AVATAR_BG[status]   ?? "#E5E7EB",
    text: PROMPT_AVATAR_TEXT[status] ?? "#374151",
  };
}
