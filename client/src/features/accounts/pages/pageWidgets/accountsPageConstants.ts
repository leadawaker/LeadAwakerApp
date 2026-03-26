// src/features/accounts/pages/pageWidgets/accountsPageConstants.ts

export type AccountViewMode = "list" | "table";
export type AccountGroupBy  = "status" | "type" | "none";
export type AccountSortBy   = "recent" | "name_asc" | "name_desc";

export const VIEW_MODE_KEY    = "accounts-view-mode";
export const VISIBLE_COLS_KEY = "accounts-table-visible-cols";
export const LIST_PREFS_KEY   = "accounts-list-prefs";
export const TABLE_PREFS_KEY  = "accounts-table-prefs";

/* ── Table column metadata for Fields dropdown ── */
export const TABLE_COL_META_KEYS = [
  { key: "name",            labelKey: "columns.name",          defaultVisible: true  },
  { key: "status",          labelKey: "columns.status",        defaultVisible: true  },
  { key: "type",            labelKey: "columns.type",          defaultVisible: true  },
  { key: "owner_email",     labelKey: "columns.ownerEmail",    defaultVisible: true  },
  { key: "phone",           labelKey: "columns.phone",         defaultVisible: true  },
  { key: "business_niche",  labelKey: "columns.niche",         defaultVisible: true  },
  { key: "website",         labelKey: "columns.website",       defaultVisible: false },
  { key: "timezone",        labelKey: "columns.timezone",      defaultVisible: false },
  { key: "max_daily_sends", labelKey: "columns.dailySends",    defaultVisible: false },
  { key: "notes",           labelKey: "columns.notes",         defaultVisible: false },
];

export const DEFAULT_VISIBLE = TABLE_COL_META_KEYS.filter((c) => c.defaultVisible).map((c) => c.key);

/* ── Table sort / group types ── */
export type TableSortByOption  = "recent" | "name_asc" | "name_desc";
export type TableGroupByOption = "status" | "type" | "none";

export const TABLE_SORT_KEYS: Record<TableSortByOption, string> = {
  recent:    "sort.mostRecent",
  name_asc:  "sort.nameAZ",
  name_desc: "sort.nameZA",
};

export const TABLE_GROUP_KEYS: Record<TableGroupByOption, string> = {
  status: "group.status",
  type:   "group.type",
  none:   "group.none",
};

export const STATUS_OPTIONS = ["Active", "Trial", "Inactive", "Suspended"];
export const ACCOUNT_STATUS_ORDER = ["Active", "Trial", "Inactive", "Suspended"];

export const STATUS_DOT: Record<string, string> = {
  Active:    "bg-emerald-500",
  Trial:     "bg-amber-500",
  Inactive:  "bg-slate-400",
  Suspended: "bg-rose-500",
};

/* ── Expand-on-hover button constants ── */
export const xBase    = "group inline-flex items-center h-9 pl-[9px] rounded-full border text-[12px] font-medium overflow-hidden shrink-0 transition-[max-width,color,border-color] duration-200 max-w-9";
export const xDefault = "border-black/[0.125] text-foreground/60 hover:text-foreground";
export const xActive  = "border-brand-indigo text-brand-indigo";
export const xSpan    = "whitespace-nowrap pl-1.5 pr-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150";
