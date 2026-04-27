import type { ProspectThread } from "../../hooks/useProspectConversations";
import type { Thread, Lead, Interaction } from "../../hooks/useConversationsData";

export type ChatGroupBy = "date" | "status" | "campaign" | "none";
export type GroupDirection = "asc" | "desc";
export type ChatSortBy = "newest" | "oldest" | "name_asc" | "name_desc" | "status_asc" | "status_desc";
export type InboxTab = "all" | "unread" | "prospects";

export type VirtualItem =
  | { type: "header"; label: string; count: number }
  | { type: "thread"; thread: Thread };

export interface AgentRecentChat {
  id: number;
  sessionId: string;
  title: string | null;
  messageCount: number;
  updatedAt: string;
  lastMessage: { content: string; role: string } | null;
}

export type AgentRowProps = {
  agent: { id: number; name: string; type: string; photoUrl: string | null; enabled?: boolean };
  isSelected: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onSelectChat: (agentId: number, sessionId?: string) => void;
  activeSessionId?: string | null;
  onSettingsClick?: (agentId: number) => void;
};

export interface InboxPanelProps {
  threads: Thread[];
  loading: boolean;
  selectedLeadId: number | null;
  /** The explicitly stored/requested lead ID to scroll to on load — distinct from the
   *  auto-fallback selectedLeadId which may resolve to threads[0]. */
  scrollToLeadId?: number | null;
  onSelectLead: (id: number) => void;
  tab: InboxTab;
  onTabChange: (tab: InboxTab) => void;
  searchQuery: string;
  groupBy: ChatGroupBy;
  sortBy: ChatSortBy;
  filterStatus: string[];
  selectedCampaignId: number | "all";
  selectedAccountId?: number | "all";
  isAgencyUser?: boolean;
  onClearAll?: () => void;
  className?: string;
  onRefresh?: () => Promise<void> | void;
  onSearchChange?: (q: string) => void;
  aiAgents?: { id: number; name: string; type: string; photoUrl: string | null; enabled?: boolean }[];
  selectedAgentId?: number | null;
  onSelectAgent?: (id: number) => void;
  onSelectAgentChat?: (agentId: number, sessionId?: string) => void;
  activeAgentSessionId?: string | null;
  onAgentSettings?: (agentId: number) => void;
  onDeselectAgent?: () => void;
  campaignsMap?: Map<number, string>;
  prospectThreads?: ProspectThread[];
  selectedProspectId?: number | null;
  onSelectProspect?: (prospectId: number) => void;
  clientAccounts?: { id: number; name: string }[];
  allCampaigns?: { id: number; name: string; account_id?: number; accounts_id?: number }[];
  onSetGroupBy?: (v: ChatGroupBy) => void;
  groupDirection?: GroupDirection;
  onSetGroupDirection?: (v: GroupDirection) => void;
  onSetSortBy?: (v: ChatSortBy) => void;
  onToggleFilterStatus?: (status: string) => void;
  onSetFilterAccountId?: (id: number | "all") => void;
  onSetCampaignId?: (id: number | "all") => void;
  searchOpen?: boolean;
  onSearchOpenChange?: (open: boolean) => void;
  filterOpen?: boolean;
  onFilterOpenChange?: (open: boolean) => void;
  /** Compact rail state (from parent). "hidden" fully hides the panel; "compact" renders 65px rail; "full" renders standard panel. */
  listPanelState?: "full" | "compact" | "hidden";
  onDialProspect?: (prospectId: number) => void;
}

export type { Thread, Lead, Interaction, ProspectThread };
