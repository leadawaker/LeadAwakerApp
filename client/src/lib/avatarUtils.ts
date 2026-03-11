// ── Shared avatar utilities — single source of truth for initials, colors, palettes ──
// All features import from here instead of defining their own duplicates.

// ── Dark mode detection ──────────────────────────────────────────────────────
function isDarkMode(): boolean {
  return typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
}

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

/** Derive a dark-mode pastel bg (low lightness, desaturated) */
function pastelBgDark(hex: string): string {
  const [h, s, _l] = hexToHsl(hex);
  return hslToHex(h, s * 0.5, 0.15);
}

/** Derive a dark-mode pastel text (high lightness, moderate saturation) */
function pastelTextDark(hex: string): string {
  const [h, s, _l] = hexToHsl(hex);
  return hslToHex(h, s * 0.6, 0.78);
}

// ── Pipeline stage hex colors ─────────────────────────────────────────────────
export const PIPELINE_HEX: Record<string, string> = {
  New:                  "#6B7280",
  Contacted:            "#7A73FF",
  Responded:            "#3ACBDF",
  "Multiple Responses": "#31D35C",
  Qualified:            "#AED62E",
  Booked:               "#F7BF0E",
  "Call Booked":        "#F7BF0E",
  "Appointment Booked":   "#F7BF0E",
  "Appointment Rebooked": "#A78BFA",
  "Booking Confirmed":    "#22C55E",
  "Calendar Link Sent": "#F7BF0E",
  Closed:               "#FFFFFF",
  Lost:                 "#DC2626",
  DND:                  "#722F37",
};

// ── Lead avatar colors — hand-picked pastels, mutable for Color Tester ───────
export const LEAD_AVATAR_BG: Record<string, string> = {
  New:                  "#C9C9C9",
  Contacted:            "#BBB9FF",
  Responded:            "#B9E7EF",
  "Multiple Responses": "#AFE3BB",
  Qualified:            "#C7DF7D",
  Booked:               "#FFDB74",
  "Call Booked":        "#FFDB74",
  Closed:               "#FFFFFF",
  Lost:                 "#F5BFBF",
  DND:                  "#D4B5B9",
};
export const LEAD_AVATAR_TEXT: Record<string, string> = {
  New:                  "#374151",
  Contacted:            "#2E3A6B",
  Responded:            "#0F5F5A",
  "Multiple Responses": "#166534",
  Qualified:            "#3F6212",
  Booked:               "#78350F",
  "Call Booked":        "#78350F",
  Closed:               "#374151",
  Lost:                 "#991B1B",
  DND:                  "#4A1A20",
};

// ── Dark mode lead avatar colors ────────────────────────────────────────────
export const LEAD_AVATAR_BG_DARK: Record<string, string> = {
  New:                  "#2A2D33",
  Contacted:            "#272547",
  Responded:            "#1A3338",
  "Multiple Responses": "#1A3325",
  Qualified:            "#283314",
  Booked:               "#33290A",
  "Call Booked":        "#33290A",
  Closed:               "#2A2D33",
  Lost:                 "#3D1A1A",
  DND:                  "#3D2228",
};
export const LEAD_AVATAR_TEXT_DARK: Record<string, string> = {
  New:                  "#9CA3AF",
  Contacted:            "#BBB9FF",
  Responded:            "#7CDCE8",
  "Multiple Responses": "#6AE87C",
  Qualified:            "#B5E050",
  Booked:               "#FFD54F",
  "Call Booked":        "#FFD54F",
  Closed:               "#E0E0E0",
  Lost:                 "#F48A8A",
  DND:                  "#E0A0A8",
};

/** Recalculate LEAD_AVATAR_BG/TEXT from current PIPELINE_HEX values (used by Color Tester reset) */
export function refreshLeadAvatarColors(): void {
  for (const key of Object.keys(PIPELINE_HEX)) {
    LEAD_AVATAR_BG[key] = pastelBg(PIPELINE_HEX[key]);
    LEAD_AVATAR_TEXT[key] = pastelText(PIPELINE_HEX[key]);
    LEAD_AVATAR_BG_DARK[key] = pastelBgDark(PIPELINE_HEX[key]);
    LEAD_AVATAR_TEXT_DARK[key] = pastelTextDark(PIPELINE_HEX[key]);
  }
}

// ── Lead / Pipeline status avatar colors ──────────────────────────────────────
// Reads from the mutable LEAD_AVATAR_BG/TEXT maps (pastel-derived from PIPELINE_HEX).
// Dark-mode-aware: picks from dark maps when .dark class is on <html>.
export function getLeadStatusAvatarColor(status: string): { bg: string; text: string } {
  if (isDarkMode()) {
    return {
      bg:   LEAD_AVATAR_BG_DARK[status]   ?? LEAD_AVATAR_BG_DARK["New"]   ?? "#2A2D33",
      text: LEAD_AVATAR_TEXT_DARK[status]  ?? LEAD_AVATAR_TEXT_DARK["New"]  ?? "#9CA3AF",
    };
  }
  return {
    bg:   LEAD_AVATAR_BG[status]   ?? LEAD_AVATAR_BG["New"]   ?? "#d1d5db",
    text: LEAD_AVATAR_TEXT[status]  ?? LEAD_AVATAR_TEXT["New"]  ?? "#374151",
  };
}

export const PIPELINE_STATUSES = [
  "New", "Contacted", "Responded", "Multiple Responses",
  "Qualified", "Booked", "Call Booked", "Closed", "Lost", "DND",
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

// ── Dark mode account avatar colors ─────────────────────────────────────────
export const ACCOUNT_AVATAR_BG_DARK: Record<string, string> = {
  Active:    "#0A2E1F",
  Trial:     "#2E2508",
  Inactive:  "#27272A",
  Suspended: "#2E0A14",
};
export const ACCOUNT_AVATAR_TEXT_DARK: Record<string, string> = {
  Active:    "#6EE7B7",
  Trial:     "#FCD34D",
  Inactive:  "#A1A1AA",
  Suspended: "#FDA4AF",
};

export function getAccountAvatarColor(status: string): { bg: string; text: string } {
  if (isDarkMode()) {
    return {
      bg:   ACCOUNT_AVATAR_BG_DARK[status]   ?? "#27272A",
      text: ACCOUNT_AVATAR_TEXT_DARK[status] ?? "#A1A1AA",
    };
  }
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

// ── Dark mode campaign avatar colors ────────────────────────────────────────
export const CAMPAIGN_AVATAR_BG_DARK: Record<string, string> = {
  Active:    "#0A2E1A",
  Paused:    "#2E2508",
  Completed: "#0A1A2E",
  Finished:  "#0A1A2E",
  Inactive:  "#27272A",
  Archived:  "#27272A",
  Draft:     "#1F2937",
};
export const CAMPAIGN_AVATAR_TEXT_DARK: Record<string, string> = {
  Active:    "#86EFAC",
  Paused:    "#FCD34D",
  Completed: "#93C5FD",
  Finished:  "#93C5FD",
  Inactive:  "#A1A1AA",
  Archived:  "#A1A1AA",
  Draft:     "#9CA3AF",
};

export function getCampaignAvatarColor(status: string): { bg: string; text: string } {
  if (isDarkMode()) {
    return {
      bg:   CAMPAIGN_AVATAR_BG_DARK[status]   ?? "#27272A",
      text: CAMPAIGN_AVATAR_TEXT_DARK[status] ?? "#9CA3AF",
    };
  }
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

// ── Dark mode user role avatar colors ───────────────────────────────────────
export const ROLE_AVATAR_DARK: Record<string, { bg: string; text: string }> = {
  Admin:    { bg: "#2E2508", text: "#FCD34D" },
  Operator: { bg: "#2E1508", text: "#FDBA74" },
  Manager:  { bg: "#0A1A2E", text: "#93C5FD" },
  Agent:    { bg: "#1A0A2E", text: "#C4B5FD" },
  Viewer:   { bg: "#1F2937", text: "#9CA3AF" },
};

export function getUserRoleAvatarColor(role: string): { bg: string; text: string } {
  if (isDarkMode()) {
    return ROLE_AVATAR_DARK[role] ?? { bg: "#1F2937", text: "#9CA3AF" };
  }
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

// ── Dark mode prompt avatar colors ──────────────────────────────────────────
export const PROMPT_AVATAR_BG_DARK: Record<string, string> = {
  Active:   "#0A2E1F",
  Archived: "#27272A",
};
export const PROMPT_AVATAR_TEXT_DARK: Record<string, string> = {
  Active:   "#6EE7B7",
  Archived: "#A1A1AA",
};

export function getPromptAvatarColor(status: string): { bg: string; text: string } {
  if (isDarkMode()) {
    return {
      bg:   PROMPT_AVATAR_BG_DARK[status]   ?? "#27272A",
      text: PROMPT_AVATAR_TEXT_DARK[status] ?? "#A1A1AA",
    };
  }
  return {
    bg:   PROMPT_AVATAR_BG[status]   ?? "#E5E7EB",
    text: PROMPT_AVATAR_TEXT[status] ?? "#374151",
  };
}

// ── Automation type avatar colors ────────────────────────────────────────────
export const AUTOMATION_AVATAR_BG: Record<string, string> = {
  ai_conversation: "#DBEAFE",   // blue-100 wash
  messaging:       "#D1FAE5",   // green-100 wash
  error_handler:   "#FFE4E6",   // rose-100 wash
  scoring:         "#FEF3C7",   // amber-100 wash
  generic:         "#F3F4F6",   // gray-100 wash
};
export const AUTOMATION_AVATAR_TEXT: Record<string, string> = {
  ai_conversation: "#1E40AF",   // blue-800
  messaging:       "#065F46",   // green-800
  error_handler:   "#9F1239",   // rose-800
  scoring:         "#92400E",   // amber-800
  generic:         "#374151",   // gray-700
};

export const AUTOMATION_AVATAR_BG_DARK: Record<string, string> = {
  ai_conversation: "#0C1A2E",
  messaging:       "#0A2E1F",
  error_handler:   "#2E0A14",
  scoring:         "#2E1F0A",
  generic:         "#1F2937",
};
export const AUTOMATION_AVATAR_TEXT_DARK: Record<string, string> = {
  ai_conversation: "#93C5FD",   // blue-300
  messaging:       "#6EE7B7",   // green-300
  error_handler:   "#FDA4AF",   // rose-300
  scoring:         "#FCD34D",   // amber-300
  generic:         "#9CA3AF",   // gray-400
};

export function getAutomationTypeAvatarColor(typeId: string): { bg: string; text: string } {
  if (isDarkMode()) {
    return {
      bg:   AUTOMATION_AVATAR_BG_DARK[typeId]   ?? AUTOMATION_AVATAR_BG_DARK.generic,
      text: AUTOMATION_AVATAR_TEXT_DARK[typeId]  ?? AUTOMATION_AVATAR_TEXT_DARK.generic,
    };
  }
  return {
    bg:   AUTOMATION_AVATAR_BG[typeId]   ?? AUTOMATION_AVATAR_BG.generic,
    text: AUTOMATION_AVATAR_TEXT[typeId]  ?? AUTOMATION_AVATAR_TEXT.generic,
  };
}

// ─── Task Type Avatar Colors ────────────────────────────────────────

const TASK_TYPE_AVATAR_BG: Record<string, string> = {
  follow_up: "#DBEAFE",
  call: "#D1FAE5",
  review: "#FEF3C7",
  admin: "#F3E8FF",
  custom: "#F3F4F6",
};

const TASK_TYPE_AVATAR_TEXT: Record<string, string> = {
  follow_up: "#1E40AF",
  call: "#065F46",
  review: "#92400E",
  admin: "#6B21A8",
  custom: "#374151",
};

const TASK_TYPE_AVATAR_BG_DARK: Record<string, string> = {
  follow_up: "#1E3A5F",
  call: "#064E3B",
  review: "#78350F",
  admin: "#4C1D95",
  custom: "#374151",
};

const TASK_TYPE_AVATAR_TEXT_DARK: Record<string, string> = {
  follow_up: "#93C5FD",
  call: "#6EE7B7",
  review: "#FCD34D",
  admin: "#C4B5FD",
  custom: "#D1D5DB",
};

export function getTaskTypeAvatarColor(typeId: string): { bg: string; text: string } {
  const dark = isDarkMode();
  return {
    bg: (dark ? TASK_TYPE_AVATAR_BG_DARK : TASK_TYPE_AVATAR_BG)[typeId] ?? (dark ? "#374151" : "#F3F4F6"),
    text: (dark ? TASK_TYPE_AVATAR_TEXT_DARK : TASK_TYPE_AVATAR_TEXT)[typeId] ?? (dark ? "#D1D5DB" : "#374151"),
  };
}

// ── Prompt icon colors — deterministic per-name, gray circle + colored icon ──
const PROMPT_ICON_PALETTE = [
  { icon: "#6366F1", bg: "#EEF2FF", bgDark: "#1E1B4B" }, // indigo
  { icon: "#8B5CF6", bg: "#F5F3FF", bgDark: "#2E1065" }, // violet
  { icon: "#EC4899", bg: "#FDF2F8", bgDark: "#500724" }, // pink
  { icon: "#F97316", bg: "#FFF7ED", bgDark: "#431407" }, // orange
  { icon: "#14B8A6", bg: "#F0FDFA", bgDark: "#042F2E" }, // teal
  { icon: "#0EA5E9", bg: "#F0F9FF", bgDark: "#082F49" }, // sky
  { icon: "#10B981", bg: "#ECFDF5", bgDark: "#022C22" }, // emerald
  { icon: "#F43F5E", bg: "#FFF1F2", bgDark: "#4C0519" }, // rose
  { icon: "#A855F7", bg: "#FAF5FF", bgDark: "#3B0764" }, // purple
  { icon: "#EAB308", bg: "#FEFCE8", bgDark: "#422006" }, // yellow
];

function hashString(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/** Returns a deterministic icon color + circle bg for a prompt, based on its name. */
export function getPromptIconColor(name: string): { icon: string; bg: string } {
  const idx = hashString(name || "P") % PROMPT_ICON_PALETTE.length;
  const entry = PROMPT_ICON_PALETTE[idx];
  if (isDarkMode()) {
    return { icon: entry.icon, bg: entry.bgDark };
  }
  return { icon: entry.icon, bg: entry.bg };
}
