/* ════════════════════════════════════════════════════════════════════════════
   Tags — shared types, constants, and color utilities
   ════════════════════════════════════════════════════════════════════════════ */

/* ── Core interfaces ──────────────────────────────────────────────────────── */

export interface Tag {
  id: number;
  name: string;
  color: string | null;
  category: string | null;
  description: string | null;
  auto_applied?: boolean;
  account_id?: number | null;
  Accounts_id?: number | null;
  campaign_id?: number | null;
  campaign_name?: string | null;
  count?: number;
}

export interface EnrichedTag extends Tag {
  leadCount: number;
  hexColor: string;
}

/* ── Sort / Group / View / Filter type unions ─────────────────────────────── */

export type TagSortOption = "name_asc" | "name_desc" | "count_desc" | "category_asc";
export type TagGroupOption = "category" | "color" | "none";
export type TagViewMode = "list" | "cards";
export type TagAutoAppliedFilter = "all" | "yes" | "no";

/* ── Discriminated union for table flat-list ──────────────────────────────── */

export type TagTableItem =
  | { kind: "header"; label: string; count: number }
  | { kind: "tag"; tag: EnrichedTag };

/* ── Column key type ──────────────────────────────────────────────────────── */

export type TagColKey =
  | "checkbox"
  | "color"
  | "name"
  | "category"
  | "leadCount"
  | "description"
  | "autoApplied"
  | "account"
  | "campaign";

/* ════════════════════════════════════════════════════════════════════════════
   Color utilities
   ════════════════════════════════════════════════════════════════════════════ */

export const COLOR_MAP: Record<string, string> = {
  blue: "#3B82F6",
  green: "#22C55E",
  red: "#EF4444",
  yellow: "#EAB308",
  orange: "#F97316",
  purple: "#A855F7",
  gray: "#64748B",
  grey: "#64748B",
  pink: "#EC4899",
  teal: "#14B8A6",
  cyan: "#06B6D4",
  indigo: "#6366F1",
};

export const COLOR_PALETTE = Object.entries(COLOR_MAP).filter(([k]) => k !== "grey");

export function resolveColor(color: string | null | undefined): string {
  if (!color) return "#64748B";
  if (color.startsWith("#")) return color;
  return COLOR_MAP[color.toLowerCase()] ?? "#64748B";
}

/* ════════════════════════════════════════════════════════════════════════════
   Table column configuration
   ════════════════════════════════════════════════════════════════════════════ */

export const TAG_TABLE_COLUMNS: {
  key: TagColKey;
  label: string;
  width: number;
  defaultVisible: boolean;
  alwaysVisible?: boolean;
}[] = [
  { key: "checkbox",    label: "",            width: 36,  defaultVisible: true, alwaysVisible: true },
  { key: "color",       label: "",            width: 40,  defaultVisible: true  },
  { key: "name",        label: "Tag Name",    width: 180, defaultVisible: true  },
  { key: "category",    label: "Category",    width: 120, defaultVisible: true  },
  { key: "account",     label: "Account",     width: 150, defaultVisible: true  },
  { key: "campaign",    label: "Campaign",    width: 150, defaultVisible: true  },
  { key: "leadCount",   label: "Leads",       width: 70,  defaultVisible: true  },
  { key: "description", label: "Description", width: 200, defaultVisible: true  },
  { key: "autoApplied", label: "Auto",        width: 60,  defaultVisible: true  },
];

export const DEFAULT_VISIBLE_COLS = TAG_TABLE_COLUMNS.filter((c) => c.defaultVisible).map((c) => c.key);

/* ════════════════════════════════════════════════════════════════════════════
   Persistence keys
   ════════════════════════════════════════════════════════════════════════════ */

export const VISIBLE_COLS_KEY = "tags-table-visible-cols-v2";
export const VIEW_MODE_KEY = "tags-view-mode";

/* ════════════════════════════════════════════════════════════════════════════
   Label records for dropdowns
   ════════════════════════════════════════════════════════════════════════════ */

export const TAG_SORT_LABELS: Record<TagSortOption, string> = {
  name_asc:     "Name A \u2192 Z",
  name_desc:    "Name Z \u2192 A",
  count_desc:   "Lead Count \u2193",
  category_asc: "Category A \u2192 Z",
};

export const TAG_GROUP_LABELS: Record<TagGroupOption, string> = {
  category: "Category",
  color:    "Color",
  none:     "None",
};
