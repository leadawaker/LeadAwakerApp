// Types extracted from LeadsCardView.tsx

import type { Interaction } from "@/types/models";

// ── View mode ─────────────────────────────────────────────────────────────────
export type ViewMode = "list" | "table" | "pipeline";

// ── Group / sort option types ─────────────────────────────────────────────────
export type GroupByOption = "date" | "status" | "campaign" | "tag" | "none";
export type SortByOption  = "recent" | "name_asc" | "name_desc" | "score_desc" | "score_asc";

// ── Virtual list item union type ──────────────────────────────────────────────
export type VirtualListItem =
  | { kind: "header"; label: string; count: number }
  | { kind: "lead"; lead: Record<string, any>; tags: { name: string; color: string }[] };

// ── Score insight tag type ────────────────────────────────────────────────────
export type ScoreInsight = { direction: "up" | "down"; label: string; column: "engagement" | "activity" | "funnel" };

// ── Sender run tracking ───────────────────────────────────────────────────────
export type MiniSenderKey = "inbound" | "ai" | "human";

export interface MiniMsgMeta {
  senderKey: MiniSenderKey;
  isFirstInRun: boolean;
  isLastInRun: boolean;
}

// ── Thread grouping ───────────────────────────────────────────────────────────
export interface MiniThreadGroup {
  threadId: string;
  threadIndex: number;
  msgs: Interaction[];
}

// ── Activity timeline event ───────────────────────────────────────────────────
export type TimelineEvent = { ts: string; styleKey: string; label: string; detail?: string };

// ── Kanban detail panel tab ───────────────────────────────────────────────────
export type KanbanTab = "chat" | "contact" | "score" | "activity" | "notes";

// ── Mobile full-screen lead detail tab ───────────────────────────────────────
export type MobileDetailTab = "info" | "chat";

// ── Mobile Notes Tab parsed note ─────────────────────────────────────────────
export interface ParsedNote {
  date: string | null;
  content: string;
  rawTs: string | null;
}

// ── Lead filter bottom sheet state ───────────────────────────────────────────
export interface LeadFilterSheetApplyState {
  filterStatus: string[];
  filterTags: string[];
  sortBy: SortByOption;
  filterCampaign: string;
  filterAccount: string;
}

// ── Lead filter bottom sheet props ───────────────────────────────────────────
export interface LeadFilterBottomSheetProps {
  open: boolean;
  onClose: () => void;
  filterStatus: string[];
  filterTags: string[];
  sortBy: SortByOption;
  filterCampaign: string;
  filterAccount: string;
  allTags: { name: string; color: string }[];
  availableCampaigns: { id: string; name: string }[];
  availableAccounts: { id: string; name: string }[];
  onApply: (state: LeadFilterSheetApplyState) => void;
  onReset: () => void;
}

// ── LeadsCardView component props ─────────────────────────────────────────────
export interface LeadsCardViewProps {
  leads: Record<string, any>[];
  loading: boolean;
  selectedLead: Record<string, any> | null;
  onSelectLead: (lead: Record<string, any>) => void;
  onClose: () => void;
  leadTagsInfo: Map<number, { name: string; color: string }[]>;
  onRefresh?: () => void;
  // Lifted search/filter/sort state
  listSearch: string;
  groupBy: GroupByOption;
  sortBy: SortByOption;
  filterStatus: string[];
  filterTags: string[];
  // View tab switching
  viewMode: ViewMode;
  onViewModeChange: (v: ViewMode) => void;
  // Search popup
  searchOpen: boolean;
  onSearchOpenChange: (v: boolean) => void;
  onListSearchChange: (v: string) => void;
  // Group / Sort / Filter setters
  onGroupByChange: (v: GroupByOption) => void;
  onSortByChange: (v: SortByOption) => void;
  onToggleFilterStatus: (s: string) => void;
  onToggleFilterTag: (t: string) => void;
  allTags: { name: string; color: string }[];
  hasNonDefaultControls: boolean;
  isGroupNonDefault: boolean;
  isSortNonDefault: boolean;
  onResetControls: () => void;
  onCreateLead?: () => void;
  mobileView?: "list" | "detail";
  onMobileViewChange?: (v: "list" | "detail") => void;
  accountsById?: Map<number, string>;
  campaignsById?: Map<number, { name: string; accountId: number | null; bookingMode?: string | null }>;
}
