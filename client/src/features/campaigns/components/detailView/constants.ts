import type { CampaignSortBy, CampaignGroupBy } from "../pages/CampaignsPage";

/* ── Reactivation tag template (source: campaign_id=1) ────────────────────── */
export const REACTIVATION_TAG_TEMPLATE: { name: string; color: string; category: string }[] = [
  { name: "First Message Sent", color: "gray", category: "automation" },
  { name: "ai stop", color: "red", category: "Automation" },
  { name: "bump 2.1", color: "blue", category: "Automation" },
  { name: "bump 3.1", color: "blue", category: "Automation" },
  { name: "no bump", color: "gray", category: "Automation" },
  { name: "reply generating", color: "yellow", category: "Automation" },
  { name: "dnd", color: "red", category: "Behavior" },
  { name: "manual takeover", color: "orange", category: "Behavior" },
  { name: "appointment booked", color: "green", category: "Outcome" },
  { name: "goodbye", color: "gray", category: "Outcome" },
  { name: "no response", color: "gray", category: "Outcome" },
  { name: "schedule", color: "green", category: "Outcome" },
  { name: "high priority", color: "red", category: "Priority" },
  { name: "warm lead", color: "orange", category: "Priority" },
  { name: "dbr android", color: "purple", category: "Source" },
  { name: "fb lead", color: "purple", category: "Source" },
  { name: "sleeping beauty android optin", color: "purple", category: "Source" },
  { name: "bump 2 reply", color: "blue", category: "Status" },
  { name: "bump 3 reply", color: "blue", category: "Status" },
  { name: "bump response", color: "blue", category: "Status" },
  { name: "first message", color: "yellow", category: "Status" },
  { name: "follow-up", color: "orange", category: "Status" },
  { name: "lead", color: "blue", category: "Status" },
  { name: "multiple messages", color: "blue", category: "Status" },
  { name: "qualify", color: "green", category: "Status" },
  { name: "responded", color: "green", category: "Status" },
  { name: "second message", color: "yellow", category: "Status" },
];

// ── Toolbar button tokens ─────────────────────────────────────────────────────
export const xBase    = "group inline-flex items-center h-9 pl-[9px] rounded-full border text-[12px] font-medium overflow-hidden shrink-0 transition-[max-width,color,border-color] duration-200 max-w-9";
export const xDefault = "border-black/[0.125] text-foreground/60 hover:text-foreground";
export const xActive  = "border-brand-indigo text-brand-indigo";
export const xSpan    = "whitespace-nowrap pl-1.5 pr-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150";

// ── Sort / Group / Filter labels ──────────────────────────────────────────────
export const DETAIL_SORT_LABEL_KEYS: Record<CampaignSortBy, string> = {
  recent:        "sortOptions.recent",
  name_asc:      "sortOptions.nameAsc",
  name_desc:     "sortOptions.nameDesc",
  leads_desc:    "sortOptions.leadsDesc",
  response_desc: "sortOptions.responseDesc",
};
export const DETAIL_GROUP_LABEL_KEYS: Record<CampaignGroupBy, string> = {
  none:    "groupBy.none",
  status:  "groupBy.status",
  account: "groupBy.account",
  type:    "groupBy.type",
};
export const DETAIL_STATUS_FILTER_OPTIONS = ["Active", "Paused", "Completed", "Inactive", "Draft"];
export const DETAIL_STATUS_HEX: Record<string, string> = {
  Active:    "#22C55E",
  Paused:    "#F59E0B",
  Completed: "#3B82F6",
  Finished:  "#3B82F6",
  Inactive:  "#94A3B8",
  Archived:  "#94A3B8",
  Draft:     "#6B7280",
};
