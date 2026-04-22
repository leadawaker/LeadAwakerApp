import type { ChatGroupBy, ChatSortBy } from "./types";

export const PROSPECT_OUTREACH_STATUSES = [
  "new", "contacted", "responded", "call_booked", "demo_given", "deal_closed", "not_interested",
];

export const STATUS_GROUP_ORDER = [
  "New", "Contacted", "Responded", "Multiple Responses", "Qualified", "Booked", "Closed", "Lost", "DND",
];

export const DATE_GROUP_ORDER = [
  "Today", "Yesterday", "This Week", "This Month", "Last 3 Months", "Older", "No Activity",
];

// Toolbar expand-on-hover pattern (same as PromptsListView).
export const xBase    = "group inline-flex items-center h-9 pl-[9px] rounded-full border text-[12px] font-medium overflow-hidden shrink-0 transition-[max-width,color,border-color] duration-200 max-w-9";
export const xDefault = "border-black/[0.125] text-foreground/60 hover:text-foreground";
export const xActive  = "border-brand-indigo text-brand-indigo";
export const xSpan    = "whitespace-nowrap pl-1.5 pr-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150";

// Group / Sort label maps used by Conversations.tsx settings dropdown.
export const GROUP_LABELS: Record<ChatGroupBy, string> = {
  date:     "Date",
  status:   "Status",
  campaign: "Campaign",
  none:     "None",
};

export const SORT_LABELS: Record<ChatSortBy, string> = {
  newest:     "Most Recent",
  oldest:     "Oldest First",
  name_asc:   "Name A \u2192 Z",
  name_desc:  "Name Z \u2192 A",
  status_asc: "Status (New \u2192 Done)",
  status_desc:"Status (Done \u2192 New)",
};
