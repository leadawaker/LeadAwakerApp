import { useRef, useMemo, useEffect, useCallback, useState } from "react";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { PullToRefreshIndicator } from "@/components/ui/PullToRefreshIndicator";
import { useTranslation } from "react-i18next";
import { useVirtualizer } from "@tanstack/react-virtual";
import { cn } from "@/lib/utils";
import { SkeletonList } from "@/components/ui/skeleton";
import { DataEmptyState } from "@/components/crm/DataEmptyState";
import { EntityAvatar } from "@/components/ui/entity-avatar";
import { Inbox, BellDot, UserSearch, Headphones, Search, X, BotMessageSquare, Zap, Bot, Settings, ChevronDown, Plus, Loader2, Mail, MessageCircle, User, ArrowUpDown, Filter, Layers, Check, ArrowUp, ArrowDown, MoreVertical, Paintbrush } from "lucide-react";
import type { ProspectThread } from "../hooks/useProspectConversations";
import type { Thread, Lead, Interaction } from "../hooks/useConversationsData";
import { ViewTabBar, type TabDef } from "@/components/ui/view-tab-bar";
import {
  getStatus,
  getStatusAvatarColor,
  formatRelativeTime,
} from "../utils/conversationHelpers";
import { apiFetch } from "@/lib/apiUtils";
import { getInitials, getProspectAvatarColor } from "@/lib/avatarUtils";
import { useLocation } from "wouter";
import { SearchPill } from "@/components/ui/search-pill";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { useChatDoodle, type ChatBgStyle } from "@/hooks/useChatDoodle";
import { CURATED_PATTERNS } from "@/components/ui/doodle-patterns";
import { BUBBLE_WIDTH_KEY, DEFAULT_BUBBLE_WIDTH } from "./chatView/constants";
import {
  PIPELINE_STATUSES,
  PIPELINE_HEX,
} from "../utils/conversationHelpers";
import { UncontactedProspectPicker } from "./UncontactedProspectPicker";

const PROSPECT_OUTREACH_STATUSES = ["new", "contacted", "responded", "call_booked", "demo_given", "deal_closed", "not_interested"];

function getLeadTagNames(lead: Lead): string[] {
  const raw = lead.tags;
  if (!raw) return [];
  if (typeof raw === "string") {
    try { return JSON.parse(raw); } catch { return []; }
  }
  if (Array.isArray(raw)) {
    return raw.map((t: any) => typeof t === "string" ? t : t?.name ?? "").filter(Boolean);
  }
  return [];
}

function getLastMessageDisplay(last: Interaction | undefined): string {
  if (!last) return "";
  const content = last.content ?? last.Content ?? "";
  const attachment = last.attachment ?? last.Attachment;
  if (attachment && !content) {
    if (/\.(jpg|jpeg|png|gif|webp|bmp|svg)/i.test(attachment)) return "Image";
    if (/\.(mp4|mov|avi|webm)/i.test(attachment)) return "Video";
    if (/\.(mp3|wav|ogg|aac)/i.test(attachment)) return "🎵 Voice message";
    return "File";
  }
  return content;
}

// Group / Sort label maps are exported for use by the settings dropdown in Conversations.tsx
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

// ── Toolbar expand-on-hover constants (same pattern as PromptsListView) ──────
const xBase    = "group inline-flex items-center h-9 pl-[9px] rounded-full border text-[12px] font-medium overflow-hidden shrink-0 transition-[max-width,color,border-color] duration-200 max-w-9";
const xDefault = "border-black/[0.125] text-foreground/60 hover:text-foreground";
const xActive  = "border-brand-indigo text-brand-indigo";
const xSpan    = "whitespace-nowrap pl-1.5 pr-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150";

const STATUS_GROUP_ORDER = ["New", "Contacted", "Responded", "Multiple Responses", "Qualified", "Booked", "Closed", "Lost", "DND"];

// ── Date group helpers ─────────────────────────────────────────────────────────
function getDateGroupLabel(dateStr: string | null | undefined): string {
  if (!dateStr) return "No Activity";
  try {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000);
    if (diff <= 0)  return "Today";
    if (diff === 1) return "Yesterday";
    if (diff < 7)   return "This Week";
    if (diff < 30)  return "This Month";
    if (diff < 90)  return "Last 3 Months";
    return "Older";
  } catch { return "No Activity"; }
}

const DATE_GROUP_ORDER = ["Today", "Yesterday", "This Week", "This Month", "Last 3 Months", "Older", "No Activity"];

// ── Virtual list item type ─────────────────────────────────────────────────────
type VirtualItem =
  | { type: "header"; label: string; count: number }
  | { type: "thread"; thread: Thread };

// ── Types ──────────────────────────────────────────────────────────────────────
export type ChatGroupBy = "date" | "status" | "campaign" | "none";
export type GroupDirection = "asc" | "desc";
export type ChatSortBy = "newest" | "oldest" | "name_asc" | "name_desc" | "status_asc" | "status_desc";
export type InboxTab = "all" | "unread" | "support" | "prospects";

// ── Agent inbox row (expandable with recent chats) ──────────────────────────────
interface AgentRecentChat {
  id: number;
  sessionId: string;
  title: string | null;
  messageCount: number;
  updatedAt: string;
  lastMessage: { content: string; role: string } | null;
}

type AgentRowProps = {
  agent: { id: number; name: string; type: string; photoUrl: string | null; enabled?: boolean };
  isSelected: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onSelectChat: (agentId: number, sessionId?: string) => void;
  activeSessionId?: string | null;
  onSettingsClick?: (agentId: number) => void;
};

function AgentInboxRow({ agent, isSelected, isExpanded, onToggleExpand, onSelectChat, activeSessionId, onSettingsClick }: AgentRowProps) {
  const typeChip: Record<string, string> = {
    code_runner: "Code Runner",
    custom: "Custom",
  };
  const chipLabel = typeChip[agent.type] ?? agent.type;
  const isEnabled = agent.enabled !== false;

  const [recentChats, setRecentChats] = useState<AgentRecentChat[]>([]);
  const [loadingChats, setLoadingChats] = useState(false);
  const fetchedRef = useRef(false);

  // Fetch recent chats when expanded
  useEffect(() => {
    if (!isExpanded) return;
    // Re-fetch each time expanded (in case new chats were created)
    setLoadingChats(true);
    let cancelled = false;
    apiFetch(`/api/agents/${agent.id}/conversations`)
      .then(async (res) => {
        if (cancelled || !res.ok) return;
        const data = await res.json();
        // Take only the 5 most recent
        setRecentChats(data.slice(0, 5));
        fetchedRef.current = true;
      })
      .catch((err) => console.error("[InboxPanel] Failed to fetch agent conversations:", err))
      .finally(() => { if (!cancelled) setLoadingChats(false); });
    return () => { cancelled = true; };
  }, [isExpanded, agent.id, activeSessionId]);

  const AgentIcon = () => {
    if (agent.photoUrl) {
      return (
        <div className="relative">
          <img
            src={agent.photoUrl}
            alt={agent.name}
            className="h-9 w-9 rounded-full object-cover"
          />
          <span
            className={cn(
              "absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2",
              isSelected ? "border-highlight-selected" : "border-card",
              isEnabled ? "bg-green-500" : "bg-muted-foreground/40"
            )}
          />
        </div>
      );
    }
    if (agent.type === "code_runner") {
      return (
        <div className="relative">
          <div className="h-9 w-9 rounded-full bg-green-500/10 flex items-center justify-center shrink-0">
            <Zap className="h-4 w-4 text-green-600" />
          </div>
          <span
            className={cn(
              "absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2",
              isSelected ? "border-highlight-selected" : "border-card",
              isEnabled ? "bg-green-500" : "bg-muted-foreground/40"
            )}
          />
        </div>
      );
    }
    return (
      <div className="relative">
        <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0">
          <Bot className="h-4 w-4 text-muted-foreground" />
        </div>
        <span
          className={cn(
            "absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2",
            isSelected ? "border-highlight-selected" : "border-card",
            isEnabled ? "bg-green-500" : "bg-muted-foreground/40"
          )}
        />
      </div>
    );
  };

  const formatTime = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "now";
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d`;
    return new Date(dateStr).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };

  return (
    <div data-testid={`agent-expandable-${agent.id}`}>
      {/* Agent header row */}
      <div
        role="button"
        tabIndex={0}
        onClick={onToggleExpand}
        onKeyDown={(e) => e.key === "Enter" && onToggleExpand()}
        className={cn(
          "flex items-center gap-2 px-2.5 py-2 rounded-xl cursor-pointer transition-colors group",
          isSelected ? "bg-highlight-selected" : "bg-card hover:bg-card-hover"
        )}
        data-testid={`button-agent-${agent.id}`}
      >
        <div className="shrink-0">
          <AgentIcon />
        </div>
        <div className="flex-1 min-w-0 pt-0.5">
          <p className="text-[15px] font-semibold font-heading leading-tight truncate text-foreground">
            {agent.name}
          </p>
          <p className="text-[11px] text-muted-foreground leading-tight truncate mt-0.5">
            {chipLabel}
          </p>
        </div>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 text-muted-foreground/60 transition-transform shrink-0",
            isExpanded && "rotate-180"
          )}
        />
        {onSettingsClick && (
          <button
            onClick={(e) => { e.stopPropagation(); onSettingsClick(agent.id); }}
            className="h-7 w-7 rounded-full flex items-center justify-center text-muted-foreground/50 hover:text-foreground hover:bg-muted opacity-0 group-hover:opacity-100 transition-all shrink-0"
            title="Agent settings"
            data-testid={`agent-settings-${agent.id}`}
          >
            <Settings className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Expanded: recent chats + new chat button */}
      {isExpanded && (
        <div className="ml-5 mt-0.5 mb-1 border-l-2 border-border/40 pl-2.5 space-y-0.5">
          {/* New chat button */}
          <button
            onClick={() => onSelectChat(agent.id)}
            className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-lg text-xs font-medium text-brand-indigo hover:bg-brand-indigo/5 transition-colors"
            data-testid={`agent-new-chat-${agent.id}`}
          >
            <Plus className="h-3 w-3" />
            New conversation
          </button>

          {loadingChats ? (
            <div className="flex items-center justify-center py-3">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
            </div>
          ) : recentChats.length === 0 ? (
            <p className="text-[11px] text-muted-foreground/60 px-2.5 py-2">No conversations yet</p>
          ) : (
            recentChats.map((chat) => (
              <button
                key={chat.sessionId}
                onClick={() => onSelectChat(agent.id, chat.sessionId)}
                className={cn(
                  "flex flex-col w-full px-2.5 py-1.5 rounded-lg text-left transition-colors",
                  activeSessionId === chat.sessionId
                    ? "bg-highlight-selected"
                    : "hover:bg-card-hover"
                )}
                data-testid={`agent-chat-${chat.sessionId}`}
              >
                <div className="flex items-center gap-1.5 w-full min-w-0">
                  <span className="text-[12px] font-medium text-foreground truncate flex-1 min-w-0">
                    {chat.title || "Untitled"}
                  </span>
                  <span className="text-[10px] text-muted-foreground/60 shrink-0">
                    {formatTime(chat.updatedAt)}
                  </span>
                </div>
                {chat.lastMessage && (
                  <p className="text-[11px] text-muted-foreground truncate mt-0.5 w-full">
                    {chat.lastMessage.content.slice(0, 60)}
                  </p>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

interface InboxPanelProps {
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
  /** Bot config for the support tab card — name & photo */
  supportBotConfig?: { name: string; photoUrl: string | null };
  /** Unread count badge for the support tab */
  supportUnreadCount?: number;
  /** Optional refresh callback for pull-to-refresh */
  onRefresh?: () => Promise<void> | void;
  /** Mobile: called when user taps the support bot card to open the support chat */
  onSelectSupport?: () => void;
  /** Mobile: called when user types in the inline search input */
  onSearchChange?: (q: string) => void;
  /** AI agents to show as pinned rows above the thread list (agency users only) */
  aiAgents?: { id: number; name: string; type: string; photoUrl: string | null; enabled?: boolean }[];
  /** Currently selected agent id */
  selectedAgentId?: number | null;
  /** Called when user clicks an agent row (old: navigates away) */
  onSelectAgent?: (id: number) => void;
  /** Called when user selects a specific agent chat or clicks "New conversation" */
  onSelectAgentChat?: (agentId: number, sessionId?: string) => void;
  /** Currently active agent session ID (to highlight in expanded list) */
  activeAgentSessionId?: string | null;
  /** Called when user clicks the settings icon on an agent row */
  onAgentSettings?: (agentId: number) => void;
  /** Called to deselect the active agent (e.g. when clicking Bob) */
  onDeselectAgent?: () => void;
  /** Map of campaign ID → campaign name, used when grouping by campaign */
  campaignsMap?: Map<number, string>;
  /** Prospect conversation threads (agency only, prospects tab) */
  prospectThreads?: ProspectThread[];
  /** Currently selected prospect ID */
  selectedProspectId?: number | null;
  /** Called when user selects a prospect from the list */
  onSelectProspect?: (prospectId: number) => void;
  /** Whether the founder inbox is currently shown (admin only) */
  showFounderInbox?: boolean;
  /** Toggle the founder inbox view (admin only) */
  onToggleFounderInbox?: () => void;
  /** Toolbar: client accounts list for agency filter */
  clientAccounts?: { id: number; name: string }[];
  /** Toolbar: all campaigns list for agency filter */
  allCampaigns?: { id: number; name: string; account_id?: number; accounts_id?: number }[];
  /** Toolbar: set group-by */
  onSetGroupBy?: (v: ChatGroupBy) => void;
  /** Group sort direction */
  groupDirection?: GroupDirection;
  /** Toolbar: set group direction */
  onSetGroupDirection?: (v: GroupDirection) => void;
  /** Toolbar: set sort-by */
  onSetSortBy?: (v: ChatSortBy) => void;
  /** Toolbar: toggle a status filter */
  onToggleFilterStatus?: (status: string) => void;
  /** Toolbar: set account filter (agency) */
  onSetFilterAccountId?: (id: number | "all") => void;
  /** Toolbar: set campaign filter */
  onSetCampaignId?: (id: number | "all") => void;
  /** Toolbar: search open state */
  searchOpen?: boolean;
  /** Toolbar: set search open state */
  onSearchOpenChange?: (open: boolean) => void;
  /** Toolbar: filter dropdown open state */
  filterOpen?: boolean;
  /** Toolbar: set filter dropdown open state */
  onFilterOpenChange?: (open: boolean) => void;
}

// ── Component ──────────────────────────────────────────────────────────────────
export function InboxPanel({
  threads,
  loading,
  selectedLeadId,
  scrollToLeadId,
  onSelectLead,
  tab,
  onTabChange,
  searchQuery,
  groupBy,
  sortBy,
  filterStatus,
  selectedCampaignId,
  selectedAccountId,
  isAgencyUser = false,
  onClearAll,
  className,
  supportBotConfig,
  supportUnreadCount = 0,
  onRefresh,
  onSelectSupport,
  onSearchChange,
  aiAgents = [],
  selectedAgentId,
  onSelectAgent,
  onSelectAgentChat,
  activeAgentSessionId,
  onAgentSettings,
  onDeselectAgent,
  campaignsMap,
  prospectThreads = [],
  selectedProspectId,
  onSelectProspect,
  showFounderInbox,
  onToggleFounderInbox,
  clientAccounts = [],
  allCampaigns = [],
  onSetGroupBy,
  groupDirection = "asc",
  onSetGroupDirection,
  onSetSortBy,
  onToggleFilterStatus,
  onSetFilterAccountId,
  onSetCampaignId,
  searchOpen: searchOpenProp = true,
  onSearchOpenChange,
  filterOpen: filterOpenProp = false,
  onFilterOpenChange,
}: InboxPanelProps) {
  const { t } = useTranslation("conversations");

  // Chat customization state (shared with ChatPanelMain via localStorage + custom events)
  const { config: doodleConfig, setConfig: setDoodleConfig } = useChatDoodle();
  const [bubbleWidth, setBubbleWidthState] = useState<number>(() => {
    const stored = localStorage.getItem(BUBBLE_WIDTH_KEY);
    const parsed = stored !== null ? parseInt(stored, 10) : NaN;
    return isNaN(parsed) ? DEFAULT_BUBBLE_WIDTH : Math.min(90, Math.max(40, parsed));
  });
  useEffect(() => {
    const readBubbleWidth = () => {
      const stored = localStorage.getItem(BUBBLE_WIDTH_KEY);
      const parsed = stored !== null ? parseInt(stored, 10) : NaN;
      if (!isNaN(parsed)) setBubbleWidthState(Math.min(90, Math.max(40, parsed)));
    };
    window.addEventListener("bubble-width-change", readBubbleWidth);
    return () => window.removeEventListener("bubble-width-change", readBubbleWidth);
  }, []);
  const setBubbleWidth = useCallback((val: number) => {
    const clamped = Math.min(90, Math.max(40, val));
    localStorage.setItem(BUBBLE_WIDTH_KEY, String(clamped));
    setBubbleWidthState(clamped);
    window.dispatchEvent(new Event("bubble-width-change"));
  }, []);

  // Track which agent is expanded in the support tab
  const [expandedAgentId, setExpandedAgentId] = useState<number | null>(null);
  const [founderSelected, setFounderSelected] = useState(false);

  // Toolbar: derived state
  const isGroupNonDefault = groupBy !== "date";
  const isSortNonDefault = sortBy !== "newest";
  const filterActive =
    filterOpenProp ||
    filterStatus.length > 0 ||
    selectedCampaignId !== "all" ||
    (isAgencyUser && selectedAccountId !== "all");

  // Prospects tab state
  const [prospectSearch, setProspectSearch] = useState("");
  const [prospectSearchOpen, setProspectSearchOpen] = useState(false);
  const [prospectGroupBy, setProspectGroupBy] = useState<"date" | "status" | "none">("date");
  const [prospectSortBy, setProspectSortBy] = useState<"newest" | "oldest" | "name_asc" | "name_desc">("newest");
  const [prospectFilterStatus, setProspectFilterStatus] = useState<string[]>([]);
  const [prospectPickerOpen, setProspectPickerOpen] = useState(false);
  const [, navigate] = useLocation();

  // Filter prospects by search query + status filter
  const filteredProspects = useMemo(() => {
    let result = prospectThreads;
    if (prospectFilterStatus.length > 0) {
      result = result.filter((pt) => prospectFilterStatus.includes(pt.outreach_status || "new"));
    }
    if (prospectSearch.trim()) {
      const q = prospectSearch.trim().toLowerCase();
      result = result.filter((pt) => {
        const haystack = [pt.company, pt.contact_name, pt.contact_email, pt.name]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(q);
      });
    }
    // Sort
    result = [...result].sort((a, b) => {
      if (prospectSortBy === "newest") return new Date(b.last_message_at || 0).getTime() - new Date(a.last_message_at || 0).getTime();
      if (prospectSortBy === "oldest") return new Date(a.last_message_at || 0).getTime() - new Date(b.last_message_at || 0).getTime();
      if (prospectSortBy === "name_asc") return (a.company || a.name || "").localeCompare(b.company || b.name || "");
      return (b.company || b.name || "").localeCompare(a.company || a.name || "");
    });
    return result;
  }, [prospectThreads, prospectSearch, prospectFilterStatus, prospectSortBy]);

  // Group prospects by date or status
  const groupedProspects = useMemo(() => {
    if (prospectGroupBy === "none") {
      return [{ label: "All", threads: filteredProspects }];
    }

    const groups: { label: string; threads: ProspectThread[] }[] = [];
    const groupMap = new Map<string, ProspectThread[]>();

    for (const pt of filteredProspects) {
      const label = prospectGroupBy === "status"
        ? (pt.outreach_status || "new").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
        : getDateGroupLabel(pt.last_message_at);
      if (!groupMap.has(label)) groupMap.set(label, []);
      groupMap.get(label)!.push(pt);
    }

    if (prospectGroupBy === "date") {
      const dateOrder = ["Today", "Yesterday", "This Week", "This Month", "Last 3 Months", "Older", "No Activity"];
      for (const label of dateOrder) {
        const threads = groupMap.get(label);
        if (threads && threads.length > 0) groups.push({ label, threads });
      }
    } else {
      for (const [label, threads] of groupMap) {
        groups.push({ label, threads });
      }
    }

    return groups;
  }, [filteredProspects, prospectGroupBy]);

  const prospectsPagePath = isAgencyUser ? "/agency/prospects" : "/subaccount/prospects";

  const hasNonDefaultControls =
    groupBy !== "date" ||
    sortBy !== "newest" ||
    filterStatus.length > 0 ||
    selectedCampaignId !== "all" ||
    (isAgencyUser && selectedAccountId !== "all");

  // When in "unread" tab, show only threads the hook marked as unread
  const tabFiltered =
    tab === "unread"
      ? threads.filter((t) => t.unread)
      : threads;

  // Apply local status filter
  const statusFiltered = useMemo(() => {
    if (filterStatus.length === 0) return tabFiltered;
    return tabFiltered.filter((t) => filterStatus.includes(getStatus(t.lead)));
  }, [tabFiltered, filterStatus]);

  // Apply local sort
  const sorted = useMemo(() => {
    return [...statusFiltered].sort((a, b) => {
      switch (sortBy) {
        case "oldest": {
          const aT = a.last?.created_at ?? a.last?.createdAt ?? "";
          const bT = b.last?.created_at ?? b.last?.createdAt ?? "";
          return aT.localeCompare(bT);
        }
        case "name_asc": {
          const aName = a.lead.full_name || `${a.lead.first_name ?? ""} ${a.lead.last_name ?? ""}`;
          const bName = b.lead.full_name || `${b.lead.first_name ?? ""} ${b.lead.last_name ?? ""}`;
          return aName.localeCompare(bName);
        }
        case "name_desc": {
          const aName = a.lead.full_name || `${a.lead.first_name ?? ""} ${a.lead.last_name ?? ""}`;
          const bName = b.lead.full_name || `${b.lead.first_name ?? ""} ${b.lead.last_name ?? ""}`;
          return bName.localeCompare(aName);
        }
        case "status_asc":
        case "status_desc": {
          const aStatus = getStatus(a.lead) || "Unknown";
          const bStatus = getStatus(b.lead) || "Unknown";
          // Lost and DND always last regardless of direction
          const aPinned = aStatus === "Lost" || aStatus === "DND";
          const bPinned = bStatus === "Lost" || bStatus === "DND";
          if (aPinned && !bPinned) return 1;
          if (!aPinned && bPinned) return -1;
          const aIdx = STATUS_GROUP_ORDER.indexOf(aStatus);
          const bIdx = STATUS_GROUP_ORDER.indexOf(bStatus);
          const aVal = aIdx === -1 ? 999 : aIdx;
          const bVal = bIdx === -1 ? 999 : bIdx;
          return sortBy === "status_asc" ? aVal - bVal : bVal - aVal;
        }
        default: {
          const aT = a.last?.created_at ?? a.last?.createdAt ?? "";
          const bT = b.last?.created_at ?? b.last?.createdAt ?? "";
          return bT.localeCompare(aT);
        }
      }
    });
  }, [statusFiltered, sortBy]);

  // Build virtualised item list with group headers
  const virtualItems = useMemo((): VirtualItem[] => {
    if (sorted.length === 0) return [];

    if (groupBy === "none") {
      return sorted.map((t) => ({ type: "thread" as const, thread: t }));
    }

    const buckets = new Map<string, Thread[]>();
    for (const t of sorted) {
      let key: string;
      switch (groupBy) {
        case "date":
          key = getDateGroupLabel(t.last?.created_at ?? t.last?.createdAt);
          break;
        case "status":
          key = getStatus(t.lead) || "Unknown";
          break;
        case "campaign": {
          const cId = Number(t.lead.campaigns_id ?? t.lead.campaign_id ?? t.lead.Campaigns_id ?? 0);
          key = t.lead.Campaign ?? t.lead.campaign_name ?? t.lead.campaign
            ?? (cId && campaignsMap?.get(cId))
            ?? "No Campaign";
          break;
        }
        default:
          key = "Unknown";
      }
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key)!.push(t);
    }

    // Order bucket keys
    let orderedKeys: string[];
    if (groupBy === "date") {
      orderedKeys = DATE_GROUP_ORDER.filter((k) => buckets.has(k));
    } else if (groupBy === "status") {
      orderedKeys = STATUS_GROUP_ORDER.filter((k) => buckets.has(k)).concat(
        Array.from(buckets.keys()).filter((k) => !STATUS_GROUP_ORDER.includes(k))
      );
    } else {
      orderedKeys = Array.from(buckets.keys()).sort();
    }

    // Reverse if descending
    if (groupDirection === "desc") {
      orderedKeys = orderedKeys.slice().reverse();
    }

    const items: VirtualItem[] = [];
    for (const key of orderedKeys) {
      const group = buckets.get(key);
      if (!group?.length) continue;
      items.push({ type: "header", label: key, count: group.length });
      for (const t of group) {
        items.push({ type: "thread", thread: t });
      }
    }
    return items;
  }, [sorted, groupBy, groupDirection]);

  const listContainerRef = useRef<HTMLDivElement>(null);

  // ── Pull-to-refresh (mobile) ─────────────────────────────────────────────
  const { pullDistance: convoPullDistance, isRefreshing: convoIsRefreshing } = usePullToRefresh({
    containerRef: listContainerRef,
    onRefresh: async () => { onRefresh?.(); },
  });

  const threadVirtualizer = useVirtualizer({
    count: virtualItems.length,
    getScrollElement: () => listContainerRef.current,
    estimateSize: (i) => (virtualItems[i]?.type === "header" ? 38 : 95),
    overscan: 5,
  });

  // Scroll to selected lead once on initial load (when threads arrive from the API).
  // Does NOT scroll again on user card clicks.
  // Uses two rAFs: first lets React commit the new virtualizer count, second lets
  // the virtualizer measure and compute item offsets before scrollToIndex is called.
  const hasScrolledRef = useRef(false);
  const virtualizerRef = useRef(threadVirtualizer);
  virtualizerRef.current = threadVirtualizer;

  // Returns the pixel offset for a virtualizer index, accounting for the group header above it.
  const getScrollTopForIdx = useCallback((idx: number): number => {
    const cache = (virtualizerRef.current as any).measurementsCache as Array<{ start: number }> | undefined;
    let itemStart: number;
    if (cache && cache[idx]) {
      itemStart = cache[idx].start;
    } else {
      // Fallback: estimate from item sizes
      let offset = 0;
      for (let i = 0; i < idx; i++) {
        offset += virtualItems[i]?.type === "header" ? 35 : 91;
      }
      itemStart = offset;
    }
    // Subtract the preceding group header height so the card sits just below it
    let headerHeight = 0;
    for (let i = idx - 1; i >= 0; i--) {
      if (virtualItems[i]?.type === "header") {
        const hCache = cache && cache[i];
        headerHeight = hCache ? (cache![i + 1]!.start - hCache.start) : 35;
        break;
      }
    }
    return itemStart - headerHeight;
  }, [virtualItems]);

  // Initial load: scroll to the stored lead ID once data arrives
  useEffect(() => {
    const targetId = scrollToLeadId ?? null;
    if (targetId == null) return;
    if (hasScrolledRef.current) return;

    const idx = virtualItems.findIndex(
      (item) => item.type === "thread" && item.thread.lead.id === targetId
    );
    if (idx === -1) return;

    hasScrolledRef.current = true;
    window.setTimeout(() => {
      const container = listContainerRef.current;
      if (!container) return;
      container.scrollTop = getScrollTopForIdx(idx);
    }, 300);
  }, [scrollToLeadId, virtualItems, getScrollTopForIdx]);

  // On card selection: smooth-scroll the newly selected thread to the top.
  // Uses setTimeout (no cleanup) so re-renders don't cancel the scroll mid-flight.
  const prevScrolledIdRef = useRef<number | null>(null);
  useEffect(() => {
    if (selectedLeadId == null) return;
    if (prevScrolledIdRef.current === null) { prevScrolledIdRef.current = selectedLeadId; return; }
    if (prevScrolledIdRef.current === selectedLeadId) return;
    prevScrolledIdRef.current = selectedLeadId;

    const capturedId = selectedLeadId;
    const capturedItems = virtualItems;
    window.setTimeout(() => {
      const idx = capturedItems.findIndex(
        (item) => item.type === "thread" && item.thread.lead.id === capturedId
      );
      if (idx === -1) return;
      const container = listContainerRef.current;
      if (!container) return;
      container.scrollTo({ top: getScrollTopForIdx(idx), behavior: "smooth" });
    }, 0);
  }, [selectedLeadId, virtualItems, getScrollTopForIdx]);

  // Sticky group header — tracks the active group label as the user scrolls
  const [activeGroupLabel, setActiveGroupLabel] = useState<{ label: string; count: number } | null>(null);

  const updateStickyHeader = useCallback(() => {
    if (groupBy === "none") { setActiveGroupLabel(null); return; }
    const container = listContainerRef.current;
    if (!container) return;
    const scrollTop = container.scrollTop;

    // Use virtualizer's offset cache (available for all items, not just rendered ones).
    // threadVirtualizer.measurementsCache[i].start gives the absolute top of each item.
    const cache = (threadVirtualizer as any).measurementsCache as Array<{ start: number; end: number }> | undefined;

    let activeLabel = "";
    let activeCount = 0;

    if (cache && cache.length === virtualItems.length) {
      // Fast path: use the measurements cache — available for all items regardless of render window
      for (let i = 0; i < virtualItems.length; i++) {
        const item = virtualItems[i];
        if (item.type !== "header") continue;
        const start = cache[i]?.start ?? 0;
        if (start <= scrollTop + 1) {
          activeLabel = item.label;
          activeCount = item.count;
        }
      }
    } else {
      // Fallback: DOM query — read positions directly from rendered header spacer elements
      const headerEls = container.querySelectorAll<HTMLElement>("[data-group-label]");
      headerEls.forEach((el) => {
        const elTop = el.getBoundingClientRect().top - container.getBoundingClientRect().top + scrollTop;
        if (elTop <= scrollTop + 1) {
          const label = el.dataset.groupLabel ?? "";
          const count = parseInt(el.dataset.groupCount ?? "0", 10);
          if (label) { activeLabel = label; activeCount = count; }
        }
      });
    }

    // Fallback: use first header if none found above scroll
    if (!activeLabel) {
      const first = virtualItems.find((i) => i.type === "header");
      if (first?.type === "header") { activeLabel = first.label; activeCount = first.count; }
    }

    setActiveGroupLabel(activeLabel ? { label: activeLabel, count: activeCount } : null);
  }, [groupBy, virtualItems, threadVirtualizer]);

  useEffect(() => {
    const container = listContainerRef.current;
    if (!container) return;
    updateStickyHeader();
    container.addEventListener("scroll", updateStickyHeader, { passive: true });
    return () => container.removeEventListener("scroll", updateStickyHeader);
  }, [updateStickyHeader]);

  const totalUnread = threads.filter((t) => t.unread).length;

  const prospectUnread = prospectThreads?.reduce((sum, t) => sum + t.unread_count, 0) || 0;

  const INBOX_TABS: TabDef[] = [
    { id: "all", label: "Inbox", icon: Inbox },
    {
      id: "unread",
      label: "Unread",
      icon: BellDot,
      badge: totalUnread > 0 ? (
        <span className="ml-0.5 inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full bg-brand-indigo text-white text-[9px] font-bold leading-none">
          {totalUnread > 99 ? "99+" : totalUnread}
        </span>
      ) : undefined,
    },
    {
      id: "support" as const,
      label: "Support",
      icon: Headphones,
      badge: supportUnreadCount > 0 ? (
        <span className="ml-0.5 inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full bg-red-500 text-white text-[9px] font-bold leading-none">
          {supportUnreadCount > 9 ? "9+" : supportUnreadCount}
        </span>
      ) : undefined,
    },
    ...(isAgencyUser ? [{
      id: "prospects" as const,
      label: "Prospects",
      icon: UserSearch,
      badge: prospectUnread > 0 ? (
        <span className="ml-0.5 inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full bg-brand-indigo text-white text-[9px] font-bold leading-none">
          {prospectUnread > 99 ? "99+" : prospectUnread}
        </span>
      ) : undefined,
    }] : []),
  ];

  return (
    <section
      className={cn(
        "flex flex-col bg-muted rounded-lg overflow-hidden h-full",
        className,
      )}
      data-testid="panel-inbox"
      data-onboarding="conversations-inbox"
    >
      {/* ── Header: title + Inbox/Unread tabs on same row ── */}
      <div className="pl-[17px] pr-3.5 pt-3 md:pt-10 pb-3 shrink-0 flex items-center" data-testid="panel-inbox-head">
        <div className="flex items-center justify-between w-full md:w-[309px] shrink-0">
          <h2 className="text-2xl font-semibold font-heading text-foreground leading-tight">Chats</h2>
          <ViewTabBar
            tabs={INBOX_TABS}
            activeId={tab}
            onTabChange={(id) => onTabChange(id as InboxTab)}
            variant="segment"
          />
        </div>
      </div>

      {/* ── List toolbar: search + sort + filter + group ── */}
      {tab !== "support" && tab !== "prospects" && onSearchChange && onSetGroupBy && onSetSortBy && onToggleFilterStatus && (
        <div className="px-2 pb-2 flex items-center gap-1 shrink-0">
          <SearchPill
            value={searchQuery}
            onChange={onSearchChange}
            open={searchOpenProp}
            onOpenChange={onSearchOpenChange ?? (() => {})}
            placeholder="Search conversations…"
          />

          {/* Filter */}
          <DropdownMenu open={filterOpenProp} onOpenChange={onFilterOpenChange}>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(xBase, "hover:max-w-[100px]", filterActive ? xActive : xDefault)}
                title="Filter"
                data-testid="button-toggle-filters"
              >
                <Filter className="h-4 w-4 shrink-0" />
                <span className={xSpan}>Filter</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              {/* Status */}
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="text-[12px]">
                  Status
                  {filterStatus.length > 0 && (
                    <span className="ml-auto text-[10px] text-brand-indigo font-medium">{filterStatus.length}</span>
                  )}
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-48 max-h-60 overflow-y-auto">
                  {PIPELINE_STATUSES.map((s) => (
                    <DropdownMenuItem
                      key={s}
                      onClick={(e) => { e.preventDefault(); onToggleFilterStatus(s); }}
                      className="flex items-center gap-2 text-[12px]"
                    >
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: PIPELINE_HEX[s] ?? "#6B7280" }} />
                      <span className="flex-1">{s}</span>
                      {filterStatus.includes(s) && <Check className="h-3 w-3 text-brand-indigo shrink-0" />}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>

              {/* Account → Campaign drill-down (agency users only) */}
              {isAgencyUser && clientAccounts.length > 0 && onSetFilterAccountId && onSetCampaignId && (
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="text-[12px]">
                    Account
                    {selectedAccountId !== "all" && (
                      <span className="ml-auto text-[10px] text-brand-indigo font-medium truncate max-w-[70px]">
                        {clientAccounts.find((a) => a.id === selectedAccountId)?.name ?? ""}
                      </span>
                    )}
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-48 max-h-60 overflow-y-auto">
                    <DropdownMenuItem
                      onClick={() => { onSetFilterAccountId("all"); onSetCampaignId("all"); }}
                      className={cn("text-[12px]", selectedAccountId === "all" && "font-semibold text-brand-indigo")}
                    >
                      All Accounts
                      {selectedAccountId === "all" && <Check className="h-3 w-3 ml-auto" />}
                    </DropdownMenuItem>
                    {clientAccounts.map((account) => (
                      <DropdownMenuSub key={account.id}>
                        <DropdownMenuSubTrigger
                          className={cn("text-[12px]", selectedAccountId === account.id && "font-semibold text-brand-indigo")}
                          onClick={() => { onSetFilterAccountId(account.id); onSetCampaignId("all"); }}
                        >
                          {account.name}
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent className="w-44 max-h-48 overflow-y-auto">
                          <DropdownMenuItem
                            onClick={() => { onSetFilterAccountId(account.id); onSetCampaignId("all"); }}
                            className={cn("text-[12px]", selectedAccountId === account.id && selectedCampaignId === "all" && "font-semibold text-brand-indigo")}
                          >
                            All Campaigns
                            {selectedAccountId === account.id && selectedCampaignId === "all" && <Check className="h-3 w-3 ml-auto" />}
                          </DropdownMenuItem>
                          {allCampaigns
                            .filter((c) => c.account_id === account.id || c.accounts_id === account.id)
                            .map((c) => (
                              <DropdownMenuItem
                                key={c.id}
                                onClick={() => { onSetFilterAccountId(account.id); onSetCampaignId(c.id); }}
                                className={cn("text-[12px]", selectedAccountId === account.id && selectedCampaignId === c.id && "font-semibold text-brand-indigo")}
                              >
                                {c.name}
                                {selectedAccountId === account.id && selectedCampaignId === c.id && <Check className="h-3 w-3 ml-auto" />}
                              </DropdownMenuItem>
                            ))
                          }
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Sort */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(xBase, "hover:max-w-[80px]", isSortNonDefault ? xActive : xDefault)}
                title="Sort"
              >
                <ArrowUpDown className="h-4 w-4 shrink-0" />
                <span className={xSpan}>Sort</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-52">
              {([
                { key: "recent", label: "Most Recent", asc: "oldest" as ChatSortBy, desc: "newest" as ChatSortBy },
                { key: "name", label: "Name", asc: "name_asc" as ChatSortBy, desc: "name_desc" as ChatSortBy },
                { key: "status", label: "Status", asc: "status_asc" as ChatSortBy, desc: "status_desc" as ChatSortBy },
              ]).map((group) => {
                const isActive = sortBy === group.asc || sortBy === group.desc;
                const activeDir: "asc" | "desc" = sortBy === group.asc ? "asc" : "desc";
                return (
                  <DropdownMenuItem
                    key={group.key}
                    onSelect={(e) => { e.preventDefault(); onSetSortBy?.(isActive ? sortBy : group.desc); }}
                    className="text-[12px] flex items-center gap-2"
                  >
                    <span className={cn("flex-1", isActive && "font-semibold !text-brand-indigo")}>{group.label}</span>
                    {isActive && (
                      <>
                        <button
                          type="button"
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onSetSortBy?.(group.asc); }}
                          className={cn("p-0.5 rounded hover:bg-muted/60 transition-colors", activeDir === "asc" ? "text-brand-indigo" : "text-foreground/30")}
                          title="Ascending"
                        >
                          <ArrowUp className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onSetSortBy?.(group.desc); }}
                          className={cn("p-0.5 rounded hover:bg-muted/60 transition-colors", activeDir === "desc" ? "text-brand-indigo" : "text-foreground/30")}
                          title="Descending"
                        >
                          <ArrowDown className="h-3 w-3" />
                        </button>
                      </>
                    )}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Group */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(xBase, "hover:max-w-[90px]", isGroupNonDefault ? xActive : xDefault)}
                title="Group"
              >
                <Layers className="h-4 w-4 shrink-0" />
                <span className={xSpan}>Group</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-52">
              {(Object.keys(GROUP_LABELS) as ChatGroupBy[]).map((opt) => (
                <DropdownMenuItem
                  key={opt}
                  onSelect={(e) => { e.preventDefault(); onSetGroupBy?.(opt); }}
                  className="text-[12px] flex items-center gap-2"
                >
                  <span className={cn("flex-1", groupBy === opt && "font-semibold !text-brand-indigo")}>{GROUP_LABELS[opt]}</span>
                  {groupBy === opt && opt !== "none" && (
                    <>
                      <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onSetGroupDirection?.("asc"); }}
                        className={cn("p-0.5 rounded hover:bg-muted/60 transition-colors", groupDirection === "asc" ? "text-brand-indigo" : "text-foreground/30")}
                        title="Ascending"
                      >
                        <ArrowUp className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onSetGroupDirection?.("desc"); }}
                        className={cn("p-0.5 rounded hover:bg-muted/60 transition-colors", groupDirection === "desc" ? "text-brand-indigo" : "text-foreground/30")}
                        title="Descending"
                      >
                        <ArrowDown className="h-3 w-3" />
                      </button>
                    </>
                  )}
                  {groupBy === opt && opt === "none" && <Check className="h-3 w-3" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Customize */}
          <Popover>
            <PopoverTrigger asChild>
              <button
                className={cn(xBase, "hover:max-w-[120px]", xDefault)}
                title={t("chat.customization.title")}
              >
                <MoreVertical className="h-4 w-4 shrink-0" />
                <span className={xSpan}>{t("chat.customization.title")}</span>
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-64 p-3 space-y-3">
              <span className="text-[13px] font-semibold">{t("chat.customization.title")}</span>

              {/* Chat bubble width slider */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">{t("chat.customization.bubbleWidth")}</span>
                  <span className="text-[11px] font-semibold tabular-nums text-foreground/70">{bubbleWidth}%</span>
                </div>
                <Slider
                  value={[bubbleWidth]}
                  onValueChange={([v]) => setBubbleWidth(v)}
                  min={40}
                  max={90}
                  step={1}
                />
              </div>

              {/* Hide avatars toggle */}
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-semibold">{t("chat.customization.hideAvatars")}</span>
                <Switch
                  checked={doodleConfig.hideAvatars}
                  onCheckedChange={(hideAvatars) => setDoodleConfig({ hideAvatars })}
                />
              </div>

              {/* Background style picker */}
              <div className="space-y-1.5">
                <span className="text-[12px] font-semibold">{t("chat.background.title")}</span>
                <div className="grid grid-cols-5 gap-1">
                  {(["crm", "social1", "social2", "social3", "social4"] as ChatBgStyle[]).map((style) => (
                    <button
                      key={style}
                      type="button"
                      onClick={() => setDoodleConfig({ bgStyle: style })}
                      className={cn(
                        "h-8 rounded-md border text-[10px] font-medium transition-colors",
                        doodleConfig.bgStyle === style || (!doodleConfig.bgStyle && style === "social1")
                          ? "border-brand-indigo text-brand-indigo bg-brand-indigo/5"
                          : "border-black/[0.125] text-foreground/60 hover:text-foreground hover:border-black/[0.175]"
                      )}
                    >
                      {style === "crm" ? "CRM" : `#${style.replace("social", "")}`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Doodle overlay toggle */}
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-semibold">{t("chat.background.doodleOverlay")}</span>
                <Switch
                  checked={doodleConfig.enabled}
                  onCheckedChange={(enabled) => setDoodleConfig({ enabled })}
                />
              </div>
              {doodleConfig.enabled && (
                <>
                  {/* Pattern picker */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-muted-foreground">{t("chat.background.pattern")}</span>
                      <span className="text-[11px] font-semibold tabular-nums text-foreground/70">
                        #{(CURATED_PATTERNS.findIndex(p => p.id === doodleConfig.patternId) + 1) || 1}
                      </span>
                    </div>
                    <Slider
                      value={[(CURATED_PATTERNS.findIndex(p => p.id === doodleConfig.patternId) + 1) || 1]}
                      onValueChange={([v]) => {
                        const entry = CURATED_PATTERNS[v - 1];
                        if (entry) setDoodleConfig({ patternId: entry.id, size: entry.size });
                      }}
                      min={1}
                      max={10}
                      step={1}
                    />
                  </div>
                  {/* Size slider */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-muted-foreground">{t("chat.background.size")}</span>
                      <span className="text-[11px] text-muted-foreground tabular-nums">{doodleConfig.size}px</span>
                    </div>
                    <Slider
                      value={[doodleConfig.size]}
                      onValueChange={([v]) => setDoodleConfig({ size: v })}
                      min={200}
                      max={800}
                      step={25}
                    />
                  </div>
                  {/* Opacity slider */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-muted-foreground">{t("chat.background.opacity")}</span>
                      <span className="text-[11px] text-muted-foreground tabular-nums">{doodleConfig.color}%</span>
                    </div>
                    <Slider
                      value={[doodleConfig.color]}
                      onValueChange={([v]) => setDoodleConfig({ color: v })}
                      min={0}
                      max={100}
                      step={1}
                    />
                  </div>
                </>
              )}

              {/* Gradient tester button (embedded) */}
              <button
                type="button"
                onClick={() => window.dispatchEvent(new Event("toggle-gradient-tester"))}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[12px] font-medium text-foreground/60 hover:text-foreground hover:bg-muted/50 transition-colors border border-black/[0.08]"
              >
                <Paintbrush className="h-3.5 w-3.5" />
                {t("chat.background.gradientTester")}
              </button>
            </PopoverContent>
          </Popover>

        </div>
      )}

      {/* ── Prospects toolbar: search + sort + group + filter + customize + "+" ── */}
      {tab === "prospects" && (
        <div className="px-2 pb-2 flex items-center gap-1 shrink-0 flex-wrap">
          <SearchPill
            value={prospectSearch}
            onChange={setProspectSearch}
            open={prospectSearchOpen}
            onOpenChange={setProspectSearchOpen}
            placeholder="Search prospects…"
          />

          {/* Sort */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(xBase, "hover:max-w-[80px]", prospectSortBy !== "newest" ? xActive : xDefault)}
                title="Sort"
              >
                <ArrowUpDown className="h-4 w-4 shrink-0" />
                <span className={xSpan}>Sort</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-44">
              {(["newest", "oldest", "name_asc", "name_desc"] as const).map((opt) => (
                <DropdownMenuItem
                  key={opt}
                  onClick={() => setProspectSortBy(opt)}
                  className={cn("text-[12px]", prospectSortBy === opt && "font-semibold text-brand-indigo")}
                >
                  {{ newest: "Most Recent", oldest: "Oldest First", name_asc: "Name A → Z", name_desc: "Name Z → A" }[opt]}
                  {prospectSortBy === opt && <Check className="h-3 w-3 ml-auto" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Group */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(xBase, "hover:max-w-[90px]", prospectGroupBy !== "date" ? xActive : xDefault)}
                title="Group"
              >
                <Layers className="h-4 w-4 shrink-0" />
                <span className={xSpan}>Group</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-44">
              {(["date", "status", "none"] as const).map((opt) => (
                <DropdownMenuItem
                  key={opt}
                  onClick={() => setProspectGroupBy(opt)}
                  className={cn("text-[12px]", prospectGroupBy === opt && "font-semibold text-brand-indigo")}
                >
                  {{ date: "Date", status: "Status", none: "None" }[opt]}
                  {prospectGroupBy === opt && <Check className="h-3 w-3 ml-auto" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Filter by outreach status */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(xBase, "hover:max-w-[100px]", prospectFilterStatus.length > 0 ? xActive : xDefault)}
                title="Filter"
              >
                <Filter className="h-4 w-4 shrink-0" />
                <span className={xSpan}>Filter{prospectFilterStatus.length > 0 ? ` (${prospectFilterStatus.length})` : ""}</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              {PROSPECT_OUTREACH_STATUSES.map((s) => (
                <DropdownMenuItem
                  key={s}
                  onClick={(e) => {
                    e.preventDefault();
                    setProspectFilterStatus((prev) =>
                      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
                    );
                  }}
                  className="flex items-center gap-2 text-[12px]"
                >
                  <span className="flex-1 capitalize">{s.replace(/_/g, " ")}</span>
                  {prospectFilterStatus.includes(s) && <Check className="h-3 w-3 text-brand-indigo shrink-0" />}
                </DropdownMenuItem>
              ))}
              {prospectFilterStatus.length > 0 && (
                <DropdownMenuItem onClick={() => setProspectFilterStatus([])} className="text-[12px] text-muted-foreground border-t mt-1 pt-1">
                  Clear filters
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>


          {/* "+" — new chat with uncontacted prospect */}
          <button
            className={cn(xBase, "hover:max-w-[100px] ml-auto", xDefault)}
            onClick={() => setProspectPickerOpen(true)}
            title="Start new chat"
          >
            <Plus className="h-4 w-4 shrink-0" />
            <span className={xSpan}>New chat</span>
          </button>
        </div>
      )}

      <UncontactedProspectPicker
        open={prospectPickerOpen}
        onClose={() => setProspectPickerOpen(false)}
        onSelect={(prospectId) => { setProspectPickerOpen(false); onSelectProspect?.(prospectId); }}
        existingProspectIds={prospectThreads.map((p) => p.prospect_id)}
      />

      {/* ── Mobile search bar (hidden on desktop) ── */}
      {tab !== "prospects" && tab !== "support" && onSearchChange && (
        <div
          className="md:hidden px-3 pb-2 shrink-0"
          data-testid="mobile-inbox-search"
        >
          <div
            className={cn(
              "flex items-center gap-2 h-9 px-3 rounded-full border bg-background transition-colors",
              searchQuery
                ? "border-brand-indigo/50"
                : "border-black/[0.125]"
            )}
          >
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search conversations…"
              className="flex-1 min-w-0 bg-transparent outline-none text-[13px] text-foreground placeholder:text-muted-foreground/60"
              data-testid="mobile-inbox-search-input"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange("")}
                className="shrink-0 p-0.5 rounded-full hover:bg-muted"
                data-testid="mobile-inbox-search-clear"
              >
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Support tab: Assistants list (Bob + AI agents) ── */}
      {tab === "support" && (
        <div className="flex-1 overflow-y-auto p-[3px]">
          <div className="px-3 py-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            <BotMessageSquare className="h-3 w-3" />
            Assistants
          </div>
          <div className="flex flex-col gap-[3px]">
            {/* Bob — support assistant (non-expandable) */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => {
                onDeselectAgent?.();
                onSelectSupport?.();
                setFounderSelected(false);
                window.dispatchEvent(new Event("switch-to-bot-channel"));
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  onDeselectAgent?.();
                  onSelectSupport?.();
                  setFounderSelected(false);
                  window.dispatchEvent(new Event("switch-to-bot-channel"));
                }
              }}
              className={cn(
                "flex items-center gap-2 px-2.5 py-2 rounded-xl cursor-pointer transition-colors",
                !selectedAgentId && !founderSelected ? "bg-highlight-selected" : "bg-card hover:bg-card-hover"
              )}
              data-testid="button-support-tab-open"
            >
              <div className="shrink-0">
                <div className="relative">
                  <div className="h-9 w-9 rounded-full bg-brand-indigo/10 flex items-center justify-center shrink-0 overflow-hidden">
                    {supportBotConfig?.photoUrl ? (
                      <img
                        src={supportBotConfig.photoUrl}
                        alt={supportBotConfig?.name || "Support"}
                        className="h-9 w-9 rounded-full object-cover"
                      />
                    ) : (
                      <Headphones className="h-4 w-4 text-brand-indigo" />
                    )}
                  </div>
                  <span
                    className={cn(
                      "absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 bg-green-500",
                      !selectedAgentId ? "border-highlight-selected" : "border-card"
                    )}
                  />
                </div>
              </div>
              <div className="flex-1 min-w-0 pt-0.5">
                <p className="text-[15px] font-semibold font-heading leading-tight truncate text-foreground">
                  {supportBotConfig?.name || "Support"}
                </p>
                <p className="text-[11px] text-muted-foreground leading-tight truncate mt-0.5">
                  Support Assistant
                </p>
              </div>
            </div>

            {aiAgents.map((agent) => (
              <AgentInboxRow
                key={agent.id}
                agent={agent}
                isSelected={selectedAgentId === agent.id}
                isExpanded={expandedAgentId === agent.id}
                onToggleExpand={() =>
                  setExpandedAgentId(expandedAgentId === agent.id ? null : agent.id)
                }
                onSelectChat={onSelectAgentChat ?? ((id) => onSelectAgent?.(id))}
                activeSessionId={selectedAgentId === agent.id ? activeAgentSessionId : null}
                onSettingsClick={onAgentSettings}
              />
            ))}
          </div>

          {/* Founder section (non-agency users — direct chat with Gabriel) */}
          {!isAgencyUser && (
            <>
              <div className="px-3 py-1.5 mt-3 flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                <User className="h-3 w-3" />
                Founder
              </div>
              <div
                role="button"
                tabIndex={0}
                onClick={() => {
                  onDeselectAgent?.();
                  onSelectSupport?.();
                  setFounderSelected(true);
                  window.dispatchEvent(new Event("switch-to-founder-channel"));
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    onDeselectAgent?.();
                    onSelectSupport?.();
                    setFounderSelected(true);
                    window.dispatchEvent(new Event("switch-to-founder-channel"));
                  }
                }}
                className={cn(
                  "flex items-center gap-2 px-2.5 py-2 rounded-xl cursor-pointer transition-colors",
                  founderSelected && !selectedAgentId ? "bg-highlight-selected" : "bg-card hover:bg-card-hover"
                )}
              >
                <img src="/founder-photo.webp" alt="Gabriel" className="h-9 w-9 rounded-full object-cover shrink-0" />
                <div className="flex-1 min-w-0 pt-0.5">
                  <p className="text-[15px] font-semibold font-heading leading-tight truncate text-foreground">
                    Gabriel Barbosa Fronza
                  </p>
                  <p className="text-[11px] text-muted-foreground leading-tight truncate mt-0.5">
                    Founder, Lead Awaker
                  </p>
                </div>
              </div>
            </>
          )}

          {/* Founder DMs section (admin only) */}
          {isAgencyUser && onToggleFounderInbox && (
            <>
              <div className="px-3 py-1.5 mt-3 flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                <User className="h-3 w-3" />
                Direct Messages
              </div>
              <div className="px-[3px]">
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    onDeselectAgent?.();
                    onToggleFounderInbox();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      onDeselectAgent?.();
                      onToggleFounderInbox();
                    }
                  }}
                  className={cn(
                    "flex items-center gap-2 px-2.5 py-2 rounded-xl cursor-pointer transition-colors",
                    showFounderInbox ? "bg-highlight-selected" : "bg-card hover:bg-card-hover"
                  )}
                >
                  <img src="/founder-photo.webp" alt="Gabriel" className="h-9 w-9 rounded-full object-cover shrink-0" />
                  <div className="flex-1 min-w-0 pt-0.5">
                    <p className="text-[15px] font-semibold font-heading leading-tight truncate text-foreground">
                      Founder Inbox
                    </p>
                    <p className="text-[11px] text-muted-foreground leading-tight truncate mt-0.5">
                      Direct messages from users
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Prospects tab: prospect conversation list ── */}
      {tab === "prospects" && (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto p-[3px]">
            {filteredProspects.length === 0 ? (
              <DataEmptyState
                variant="conversations"
                title={prospectSearch ? "No matching prospects" : "No prospect conversations"}
                description={prospectSearch ? "Try a different search term." : "Prospect conversations will appear here when you start outreach."}
                compact
              />
            ) : (
              <div className="flex flex-col gap-[3px]">
                {groupedProspects.map((group) => (
                  <div key={group.label}>
                    {/* Date group header */}
                    <div className="px-3 py-2">
                      <div className="flex items-center gap-[10px]">
                        <div className="flex-1 h-px bg-foreground/15" />
                        <span className="text-[12px] font-bold text-foreground tracking-wide">{group.label}</span>
                        <span className="text-foreground/20">-</span>
                        <span className="text-[12px] font-medium text-muted-foreground tabular-nums">{group.threads.length}</span>
                        <div className="flex-1 h-px bg-foreground/15" />
                      </div>
                    </div>

                    {/* Prospect cards in this group */}
                    <div className="flex flex-col gap-[3px]">
                    {group.threads.map((pt) => {
                      const active = selectedProspectId === pt.prospect_id;
                      const displayName = pt.company || pt.name || "Unknown";
                      const avatarColor = getProspectAvatarColor(pt.outreach_status);
                      const isDealClosed = pt.outreach_status === "deal_closed";
                      const lastTs = pt.last_message_at;
                      const timeAgo = lastTs ? formatRelativeTime(lastTs) : "";

                      return (
                        <div
                          key={pt.prospect_id}
                          role="button"
                          tabIndex={0}
                          onClick={() => onSelectProspect?.(pt.prospect_id)}
                          onKeyDown={(e) => e.key === "Enter" && onSelectProspect?.(pt.prospect_id)}
                          className={cn(
                            "group relative rounded-xl cursor-pointer transition-colors",
                            active ? "bg-highlight-selected" : "bg-card hover:bg-card-hover"
                          )}
                          data-testid={`button-prospect-${pt.prospect_id}`}
                        >
                          <div className="px-2.5 pt-2.5 pb-2 flex flex-col gap-[3px]">
                            <div className="flex items-start gap-2">
                              {/* Avatar with status-based colors */}
                              <div className="relative shrink-0">
                                <EntityAvatar
                                  name={displayName}
                                  bgColor={isDealClosed ? "#1a1a1a" : avatarColor.bg}
                                  textColor={isDealClosed ? "#ffffff" : avatarColor.text}
                                  size={36}
                                  className="shrink-0"
                                />
                                {pt.unread_count > 0 && (
                                  <span
                                    className={cn(
                                      "absolute -top-1.5 -right-1.5 min-w-[16px] h-[16px] rounded-full bg-[#FCB803] text-[#131B49] text-[8px] font-bold flex items-center justify-center px-0.5",
                                      active ? "shadow-[0_0_0_2px_var(--color-highlight-selected)]" : "shadow-[0_0_0_2px_var(--color-card)]"
                                    )}
                                  >
                                    {pt.unread_count > 99 ? "99+" : pt.unread_count}
                                  </span>
                                )}
                              </div>

                              {/* Company + contact */}
                              <div className="flex-1 min-w-0 pt-0.5">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-[16px] font-semibold font-heading leading-tight truncate text-foreground flex-1 min-w-0">
                                    {displayName}
                                  </p>
                                  <span className="flex items-center gap-1 shrink-0">
                                    {pt.last_message_type === "email" ? (
                                      <Mail className="h-3 w-3 text-muted-foreground/50" />
                                    ) : pt.last_message_type === "whatsapp" ? (
                                      <MessageCircle className="h-3 w-3 text-muted-foreground/50" />
                                    ) : null}
                                    {timeAgo && (
                                      <span className="text-[10px] text-muted-foreground/70 tabular-nums">
                                        {timeAgo}
                                      </span>
                                    )}
                                  </span>
                                </div>
                                {pt.contact_name && (
                                  <p className="text-[11px] text-muted-foreground leading-tight truncate mt-0.5">
                                    {pt.contact_name}
                                  </p>
                                )}

                                {/* Last message preview: hidden by default, shown on hover */}
                                {pt.last_message && (
                                  <p className="hidden group-hover:block text-[13px] text-muted-foreground truncate leading-snug mt-1">
                                    <span className="truncate">{pt.last_message}</span>
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Thread list (all / unread tabs) ── */}
      {/* Outer wrapper: relative so absolute overlay can pin to top */}
      <div className={cn("flex-1 min-h-0 relative", (tab === "support" || tab === "prospects") && "hidden")}>
        {/* Sticky group header overlay — absolute so it doesn't push content down */}
        {groupBy !== "none" && !loading && sorted.length > 0 && activeGroupLabel && (
          <div className="absolute top-0 left-0 right-0 z-20 bg-muted px-3 pt-3 pb-3 pointer-events-none">
            <div className="flex items-center gap-[10px]">
              <div className="flex-1 h-px bg-foreground/15" />
              <span className="text-[12px] font-bold text-foreground tracking-wide shrink-0">
                {activeGroupLabel.label}
              </span>
              <span className="text-foreground/20 shrink-0">{"\u2013"}</span>
              <span className="text-[12px] font-medium text-muted-foreground tabular-nums shrink-0">
                {activeGroupLabel.count}
              </span>
              <div className="flex-1 h-px bg-foreground/15" />
            </div>
          </div>
        )}
        <div ref={listContainerRef} className="h-full overflow-y-auto" data-testid="list-inbox">
        {/* Pull-to-refresh indicator — mobile only */}
        <PullToRefreshIndicator pullDistance={convoPullDistance} isRefreshing={convoIsRefreshing} />
        <div className="p-[3px]">
        {loading ? (
          <SkeletonList count={6} />
        ) : sorted.length === 0 ? (
          searchQuery ? (
            <DataEmptyState
              variant="search"
              title="No conversations found"
              description={`No conversations match "${searchQuery}".`}
              compact
              data-testid="empty-state-search"
            />
          ) : hasNonDefaultControls || tab === "unread" ? (
            <DataEmptyState
              variant="search"
              title={tab === "unread" ? "All caught up!" : "No matches"}
              description={
                tab === "unread"
                  ? "You have no unread conversations right now."
                  : "No conversations match the selected filters."
              }
              actionLabel={hasNonDefaultControls ? "Clear filters" : undefined}
              onAction={hasNonDefaultControls && onClearAll ? onClearAll : undefined}
              compact
              data-testid="empty-state-filtered"
            />
          ) : (
            <DataEmptyState
              variant="conversations"
              compact
              data-testid="empty-state-no-conversations"
            />
          )
        ) : (
          <div style={{ height: `${threadVirtualizer.getTotalSize()}px`, position: "relative" }}>
            {threadVirtualizer.getVirtualItems().map((virtualRow) => {
              const item = virtualItems[virtualRow.index];
              if (!item) return null;

              // ── Group header — visible in the virtualizer; the absolute overlay floats on top ──
              if (item.type === "header") {
                return (
                  <div
                    key={`header-${item.label}`}
                    data-index={virtualRow.index}
                    data-group-label={item.label}
                    data-group-count={item.count}
                    ref={threadVirtualizer.measureElement}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      right: 0,
                      paddingBottom: 3,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    <div className="px-3 pt-3 pb-3">
                      <div className="flex items-center gap-[10px]">
                        <div className="flex-1 h-px bg-foreground/15" />
                        <span className="text-[12px] font-bold text-foreground tracking-wide shrink-0">{item.label}</span>
                        <span className="text-foreground/20 shrink-0">{"\u2013"}</span>
                        <span className="text-[12px] font-medium text-muted-foreground tabular-nums shrink-0">{item.count}</span>
                        <div className="flex-1 h-px bg-foreground/15" />
                      </div>
                    </div>
                  </div>
                );
              }

              // ── Thread card ──
              const { lead, last, unread, unreadCount } = item.thread;
              const active = selectedLeadId === lead.id;
              const showUnreadBadge = unread;
              const status = getStatus(lead);
              const avatarColor = getStatusAvatarColor(status);
              const lastContent = getLastMessageDisplay(last);
              const lastTs = last?.created_at ?? last?.createdAt;
              const tags = getLeadTagNames(lead);

              return (
                <div
                  key={lead.id}
                  data-index={virtualRow.index}
                  ref={threadVirtualizer.measureElement}
                  className="animate-fade-in"
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    paddingBottom: 3,
                    transform: `translateY(${virtualRow.start}px)`,
                    animationDelay: `${Math.min(virtualRow.index, 12) * 25}ms`,
                  }}
                >
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => onSelectLead(lead.id)}
                    onKeyDown={(e) => e.key === "Enter" && onSelectLead(lead.id)}
                    className={cn(
                      "relative rounded-xl cursor-pointer transition-colors min-h-[64px]",
                      active ? "bg-highlight-selected" : "bg-card hover:bg-card-hover"
                    )}
                    data-testid={`button-thread-${lead.id}`}
                  >
                    <div className="px-2.5 pt-2.5 pb-2 flex flex-col gap-1">

                      {/* Row 1: Avatar (+ unread badge) + Name + Status + Time */}
                      <div className="flex items-start gap-2">
                        {/* Avatar with unread badge overlay */}
                        <div className="relative shrink-0">
                          <EntityAvatar
                            name={`${lead.first_name || ""} ${lead.last_name || ""}`.trim() || "?"}
                            bgColor={avatarColor.bg}
                            textColor={avatarColor.text}
                          />
                          {showUnreadBadge && (
                            <span
                              className={cn(
                                "absolute -top-1.5 -right-1.5 min-w-[16px] h-[16px] rounded-full bg-[#FCB803] text-[#131B49] text-[8px] font-bold flex items-center justify-center px-0.5",
                                active ? "shadow-[0_0_0_2px_var(--color-highlight-selected)]" : "shadow-[0_0_0_2px_var(--color-card)]"
                              )}
                            >
                              {unreadCount > 99 ? "99+" : unreadCount}
                            </span>
                          )}
                        </div>

                        {/* Name + conversion status */}
                        <div className="flex-1 min-w-0 pt-0.5">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-[16px] font-semibold font-heading leading-tight truncate text-foreground">
                              {lead.full_name ||
                                `${lead.first_name ?? ""} ${lead.last_name ?? ""}`.trim() ||
                                "Unknown"}
                            </p>
                            {lastTs && (
                              <span className="text-[10px] text-muted-foreground/70 shrink-0 tabular-nums">
                                {formatRelativeTime(lastTs)}
                              </span>
                            )}
                          </div>
                          {/* Conversion status — hide when grouped by status */}
                          {status && groupBy !== "status" && (
                            <p className="text-[11px] text-muted-foreground leading-tight truncate mt-0.5 flex items-center gap-1">
                              <span
                                className="w-1.5 h-1.5 rounded-full shrink-0"
                                style={{ backgroundColor: avatarColor.bg }}
                              />
                              {status}
                            </p>
                          )}

                          {/* Last message — aligned with name */}
                          {lastContent && (
                            <p className="text-[13px] text-muted-foreground truncate leading-snug mt-1">
                              {lastContent}
                            </p>
                          )}

                          {/* Tags — inside name column so they align with name */}
                          {tags.length > 0 && (
                            <div className="flex items-center gap-1 flex-wrap mt-0.5">
                              {tags.slice(0, 3).map((t) => (
                                <span
                                  key={t}
                                  className="inline-flex items-center px-1.5 py-px rounded-full text-[10px] font-medium"
                                  style={{
                                    backgroundColor: active ? "rgba(255,255,255,0.75)" : "rgba(0,0,0,0.09)",
                                    color: "rgba(0,0,0,0.45)",
                                  }}
                                >
                                  {t}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        </div>
        </div>{/* end listContainerRef */}
      </div>{/* end outer relative wrapper */}
    </section>
  );
}

