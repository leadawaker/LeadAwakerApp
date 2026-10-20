// Shared config for the Leads page orchestrator (LeadsTable.tsx) and its
// topbars: table columns, sort/group options, quick views, and the mapping from
// the page's persisted prefs to the server query (GET /api/leads/page).
import { Table2, List, Kanban } from "lucide-react";

export type ViewMode = "list" | "table" | "pipeline";
export type LeadsPageMode = "conversations" | "contacts" | "all";
export type TableSortByOption = "recent" | "oldest" | "name_asc" | "name_desc" | "activity_desc" | "activity_asc" | "created_desc" | "created_asc";
export type TableGroupByOption = "status" | "campaign" | "account" | "service" | "source" | "tag" | "none";
export type QuickView = "all" | "needsReply" | "upcoming";
export type ChannelFilter = "all" | "website" | "whatsapp" | "phone";
export type PipelineSort = "recency" | "alpha" | null;

export const VIEW_MODE_KEY = "leads-view-mode";
export const VISIBLE_COLS_KEY = "leads-table-visible-cols";
export const LIST_PREFS_KEY = "leads-list-prefs";
export const TABLE_PREFS_KEY = "leads-table-prefs";
export const PIPE_PREFS_KEY = "leads-pipe-prefs";
export const COL_ORDER_KEY = "leads-column-order";
export const COL_WIDTHS_KEY = "leads-column-widths";
export const QUICK_PREFS_KEY = "leads-quick-filters";

/** Column metadata for the visibility menu. The lead score column was removed. */
export const TABLE_COL_META = [
  { key: "name",         defaultVisible: true  },
  { key: "status",       defaultVisible: true  },
  { key: "lastContact",  defaultVisible: true  },
  { key: "appointment",  defaultVisible: true  },
  { key: "phone",        defaultVisible: true  },
  { key: "email",        defaultVisible: true  },
  { key: "campaign",     defaultVisible: true  },
  { key: "lastMessage",  defaultVisible: true  },
  { key: "tags",         defaultVisible: true  },
  { key: "notes",        defaultVisible: false },
  { key: "lastActivity", defaultVisible: false },
  { key: "chats",        defaultVisible: false },
  { key: "account",      defaultVisible: false },
  { key: "source",       defaultVisible: false },
  { key: "bumpStage",    defaultVisible: false },
  { key: "createdAt",    defaultVisible: false },
] as const;

export const DEFAULT_VISIBLE_COLS: string[] = TABLE_COL_META.filter((c) => c.defaultVisible).map((c) => c.key);

export const VIEW_TAB_KEYS: { id: ViewMode; tKey: string; icon: typeof List }[] = [
  { id: "list",     tKey: "viewTabs.list",     icon: List   },
  { id: "table",    tKey: "viewTabs.table",    icon: Table2 },
  { id: "pipeline", tKey: "viewTabs.pipeline", icon: Kanban },
];

export const ALLOWED_VIEWS_BY_MODE: Record<LeadsPageMode, ViewMode[]> = {
  conversations: ["list"],
  contacts: ["table", "pipeline"],
  all: ["list", "table", "pipeline"],
};

export const TABLE_GROUP_TKEYS: Record<TableGroupByOption, string> = {
  status: "group.status", campaign: "group.campaign", account: "group.account",
  service: "group.service", source: "group.source", tag: "group.tag", none: "group.none",
};

export const TABLE_SORT_GROUPS: { key: string; tKey: string; asc: TableSortByOption; desc: TableSortByOption }[] = [
  { key: "recent",   tKey: "sort.mostRecent", asc: "oldest",       desc: "recent" },
  { key: "name",     tKey: "sort.name",       asc: "name_asc",     desc: "name_desc" },
  { key: "activity", tKey: "sort.activity",   asc: "activity_asc", desc: "activity_desc" },
  { key: "created",  tKey: "sort.created",    asc: "created_asc",  desc: "created_desc" },
];

/** Persisted prefs may still hold the removed score sorts; they fall back to recent. */
export function safeListSort(v: string): string {
  return v === "score_desc" || v === "score_asc" || v === "latest_message" ? "recent" : v;
}
export function safeTableSort(v: string): TableSortByOption {
  return (["recent", "oldest", "name_asc", "name_desc", "activity_desc", "activity_asc", "created_desc", "created_asc"] as string[]).includes(v)
    ? (v as TableSortByOption) : "recent";
}

export const tsOf = (v: any): number => {
  if (!v) return 0;
  const t = Date.parse(v);
  return Number.isNaN(t) ? 0 : t;
};

type NameMaps = {
  accountsById: Map<number, string>;
  campaignsById: Map<number, { name: string }>;
};

/** Same UI-friendly fields useLeadsData adds, for rows from /api/leads/page. */
export function normalizeLead(l: Record<string, any>, { accountsById, campaignsById }: NameMaps): Record<string, any> {
  const rowId = l.Id ?? l.id;
  const acctId = Number(l.Accounts_id || l.accounts_id || 0);
  const campId = Number(l.Campaigns_id || l.campaigns_id || 0);
  return {
    ...l,
    Id: rowId,
    id: rowId,
    Account: l.account_name || accountsById.get(acctId) || (acctId ? `Account ${acctId}` : ""),
    Campaign: campaignsById.get(campId)?.name || l.campaign_name || (campId ? `Campaign ${campId}` : ""),
    conversion_status: l.conversion_status || l.Conversion_Status || "",
    email: l.Email || l.email || "",
    full_name: l.full_name || `${l.first_name || ""} ${l.last_name || ""}`.trim(),
    phone: l.Phone || l.phone || "",
  };
}
